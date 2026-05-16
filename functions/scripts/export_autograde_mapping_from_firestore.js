#!/usr/bin/env node
/**
 * Build autograde mapping CSV by merging bridge repo list with Firestore assignments.
 *
 * Usage:
 *   node functions/scripts/export_autograde_mapping_from_firestore.js \
 *     --bridge-csv=docs/examples/classroom-bridge-sync-units-only.csv \
 *     --output=docs/examples/autograde-repo-mapping.firestore.csv
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    bridgeCsv: "docs/examples/classroom-bridge-sync-units-only.csv",
    output: "docs/examples/autograde-repo-mapping.firestore.csv",
    preferStatus: "submitted,graded",
  };

  for (const t of argv.slice(2)) {
    if (t.startsWith("--bridge-csv=")) args.bridgeCsv = t.split("=")[1] || args.bridgeCsv;
    else if (t.startsWith("--output=")) args.output = t.split("=")[1] || args.output;
    else if (t.startsWith("--prefer-status=")) args.preferStatus = t.split("=")[1] || args.preferStatus;
  }
  return args;
}

function readCsvLines(p) {
  return fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractAssignmentIdFromBridgeRepo(repo) {
  const prefix = "vibe-coding-classroom/vibe-coding-classroom-";
  if (!repo.startsWith(prefix)) return "";
  const short = repo.slice(prefix.length);
  const parts = short.split("-");
  if (parts.length < 4) return short;
  if (parts.length % 2 === 0) {
    return parts.slice(0, parts.length / 2).join("-");
  }
  return short;
}

function pickBestCandidate(list, preferredStatuses) {
  if (!list || list.length === 0) return null;

  const statusRank = new Map();
  preferredStatuses.forEach((s, i) => statusRank.set(s, i));

  const normalized = list.slice().sort((a, b) => {
    const ar = statusRank.has(a.currentStatus) ? statusRank.get(a.currentStatus) : 999;
    const br = statusRank.has(b.currentStatus) ? statusRank.get(b.currentStatus) : 999;
    if (ar !== br) return ar - br;

    const at = a.updatedAtMs || a.submittedAtMs || 0;
    const bt = b.updatedAtMs || b.submittedAtMs || 0;
    return bt - at;
  });

  return normalized[0];
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "number") return ts;
  return 0;
}

async function loadAssignmentsIndex() {
  const snap = await db.collection("assignments").get();
  const byAssignmentId = new Map();

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const assignmentId = String(d.assignmentId || "").trim();
    if (!assignmentId) continue;

    const userId = String(d.userId || d.uid || "").trim();
    const item = {
      docId: doc.id,
      assignmentId,
      userId,
      currentStatus: String(d.currentStatus || "").trim(),
      updatedAtMs: tsToMs(d.updatedAt),
      submittedAtMs: tsToMs(d.submittedAt),
    };

    if (!byAssignmentId.has(assignmentId)) byAssignmentId.set(assignmentId, []);
    byAssignmentId.get(assignmentId).push(item);
  }

  return byAssignmentId;
}

async function main() {
  const args = parseArgs(process.argv);
  const bridgeCsvPath = path.resolve(process.cwd(), args.bridgeCsv);
  const outputPath = path.resolve(process.cwd(), args.output);
  const preferredStatuses = args.preferStatus
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!fs.existsSync(bridgeCsvPath)) {
    throw new Error(`Bridge CSV not found: ${bridgeCsvPath}`);
  }

  const lines = readCsvLines(bridgeCsvPath);
  if (lines.length <= 1) {
    throw new Error(`Bridge CSV is empty: ${bridgeCsvPath}`);
  }

  const index = await loadAssignmentsIndex();

  const out = [];
  out.push("repo,assignment_doc_id,user_id,assignment_id,candidate_count,selected_status");

  for (const line of lines.slice(1)) {
    const [repo] = line.split(",");
    const assignmentId = extractAssignmentIdFromBridgeRepo(repo);

    const candidates = index.get(assignmentId) || [];
    const best = pickBestCandidate(candidates, preferredStatuses);

    const docId = best ? best.docId : "";
    const userId = best ? best.userId : "";
    const status = best ? best.currentStatus : "";

    out.push(
      [
        repo,
        docId,
        userId,
        assignmentId,
        String(candidates.length),
        status,
      ].join(",")
    );
  }

  fs.writeFileSync(outputPath, `${out.join("\n")}\n`, "utf8");

  const total = out.length - 1;
  const matched = out.slice(1).filter((r) => r.split(",")[1]).length;
  const unmatched = total - matched;

  console.log(`[DONE] ${outputPath}`);
  console.log(`[SUMMARY] total=${total} matched=${matched} unmatched=${unmatched}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
