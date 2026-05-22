#!/usr/bin/env node
/**
 * Backfill tutor referral fields on paid orders and generate profit_ledger rows immediately.
 *
 * Usage:
 *   node functions/scripts/backfill_tutor_sharing.js --apply --student-email=chen.yuiliang@gmail.com --unit-id=start-01-unit-html5-basics.html
 */

const crypto = require("crypto");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    studentEmail: "",
    unitId: "",
    tutorEmail: "",
    assignmentUrl: "",
    promotionCode: "",
  };
  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (token.startsWith("--student-email=")) {
      args.studentEmail = token.split("=")[1] || "";
    } else if (token.startsWith("--unit-id=")) {
      args.unitId = token.split("=")[1] || "";
    } else if (token.startsWith("--tutor-email=")) {
      args.tutorEmail = token.split("=")[1] || "";
    } else if (token.startsWith("--assignment-url=")) {
      args.assignmentUrl = token.split("=")[1] || "";
    } else if (token.startsWith("--promotion-code=")) {
      args.promotionCode = token.split("=")[1] || "";
    }
  }
  return args;
}

function toPeriod(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function loadLessons() {
  const snap = await db.collection("metadata_lessons").get();
  return snap.docs.map((d) => d.data() || {});
}

function canonicalUnit(unitId) {
  const str = String(unitId || "").trim();
  if (!str) return "";
  return str.endsWith(".html") ? str : `${str}.html`;
}

function itemContainsUnit(itemKey, targetUnitId, lessons) {
  const unit = canonicalUnit(targetUnitId);
  if (!itemKey || !unit) return false;
  if (canonicalUnit(itemKey) === unit) return true;
  const lesson = lessons.find((l) => String(l.courseId || "").trim() === String(itemKey || "").trim());
  if (!lesson || !Array.isArray(lesson.courseUnits)) return false;
  return lesson.courseUnits.map(canonicalUnit).includes(unit);
}

async function findUserByEmail(email) {
  const snap = await db.collection("users").where("email", "==", String(email || "").trim().toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() || {} };
}

async function getUplineTutorEmail(tutorEmail) {
  const tutor = await findUserByEmail(tutorEmail);
  if (!tutor) return "info@vibe-coding.tw";
  const up = String(tutor.data.tutorEmail || "").trim();
  return up || "info@vibe-coding.tw";
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.studentEmail || !args.unitId) {
    throw new Error("Missing --student-email or --unit-id");
  }

  const lessons = await loadLessons();
  const student = await findUserByEmail(args.studentEmail);
  if (!student) throw new Error(`Student not found: ${args.studentEmail}`);

  const unitId = canonicalUnit(args.unitId);
  const assignmentMeta = (student.data.unitAssignmentMeta || {})[unitId] || {};
  const tutorEmail =
    String(args.tutorEmail || assignmentMeta.tutorEmail || "").trim().toLowerCase() || "rover.k.chen@gmail.com";
  const promotionCode = String(args.promotionCode || assignmentMeta.promotionCode || "").trim().toUpperCase();
  const assignmentUrl = String(args.assignmentUrl || "").trim();

  const ordersSnap = await db.collection("orders")
    .where("uid", "==", student.id)
    .where("status", "==", "SUCCESS")
    .get();

  const report = {
    mode: args.dryRun ? "dry-run" : "apply",
    studentUid: student.id,
    studentEmail: args.studentEmail,
    unitId,
    tutorEmail,
    promotionCode,
    updatedOrders: 0,
    updatedItems: 0,
    writtenLedger: 0,
    inspectedOrders: ordersSnap.size,
  };

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data() || {};
    const items = JSON.parse(JSON.stringify(order.items || {}));
    let changed = false;

    for (const [itemKey, itemValue] of Object.entries(items)) {
      if (!itemContainsUnit(itemKey, unitId, lessons)) continue;
      if (!itemValue || typeof itemValue !== "object") continue;

      itemValue.referredTutorEmail = tutorEmail;
      itemValue.referralTutor = tutorEmail;
      if (assignmentUrl) {
        itemValue.referralLink = assignmentUrl;
        itemValue.promoCode = assignmentUrl;
      }
      if (promotionCode) itemValue.promotionCode = promotionCode;
      changed = true;
      report.updatedItems += 1;
    }

    if (changed) {
      report.updatedOrders += 1;
      if (args.apply) {
        await db.collection("orders").doc(orderDoc.id).set({
          items,
          lastTutorBindingBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
          lastTutorBindingBackfillSource: "manualBackfillScript",
        }, { merge: true });
      }
    }

    const effectiveItems = changed ? items : (order.items || {});
    const period = toPeriod(order.paidAt || order.createdAt || order.updatedAt);
    if (!period) continue;

    for (const [itemKey, itemValue] of Object.entries(effectiveItems)) {
      if (!itemContainsUnit(itemKey, unitId, lessons)) continue;
      const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
      const itemPrice = parseFloat(itemValue?.price || 0) || 0;
      const lineAmount = itemPrice * quantity;
      if (lineAmount <= 0) continue;

      let currentTutorEmail = String(itemValue?.referredTutorEmail || tutorEmail || "info@vibe-coding.tw").trim().toLowerCase();
      let currentShare = lineAmount * 0.2;
      let level = 1;
      while (currentTutorEmail && currentShare >= 0.01) {
        const seed = `${period}|${orderDoc.id}|${itemKey}|${level}|${currentTutorEmail}`;
        const idempotencyKey = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40);
        const shareRecord = {
          idempotencyKey,
          tutorEmail: currentTutorEmail,
          studentUid: student.id,
          orderId: orderDoc.id,
          orderItemId: itemKey,
          orderAmount: lineAmount,
          shareAmount: Math.round(currentShare * 100) / 100,
          level,
          referralLink: itemValue?.referralLink || itemValue?.promoCode || null,
          calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
          period,
        };
        if (args.apply) {
          await db.collection("profit_ledger").doc(idempotencyKey).set(shareRecord, { merge: true });
        }
        report.writtenLedger += 1;

        if (currentTutorEmail === "info@vibe-coding.tw") break;
        currentTutorEmail = await getUplineTutorEmail(currentTutorEmail);
        currentShare = currentShare * 0.2;
        level += 1;
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

