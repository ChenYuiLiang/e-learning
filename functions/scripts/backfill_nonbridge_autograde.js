#!/usr/bin/env node
/**
 * Backfill autograde scores for non-bridge classroom repos without GitHub Actions.
 *
 * Inputs:
 *   --repos-file=/tmp/non_bridge_repos.txt   (one repo full_name per line)
 *   --apply                                  (actually write Firestore; default dry-run)
 *   --max-score=100
 *
 * Logic aligned with current autograde-and-sync.yml:
 *   - README.md exists and is non-empty => score=100
 *   - otherwise => score=0
 *   - score >= maxScore => completed
 *   - score > 0 => in_progress
 *   - else => failed
 */

const fs = require("fs");
const { execSync } = require("child_process");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function arg(name, fallback = "") {
  const token = process.argv.find((t) => t.startsWith(`${name}=`));
  if (!token) return fallback;
  return token.slice(name.length + 1);
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function runJson(cmd) {
  const out = execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function safeRunJson(cmd) {
  try {
    return runJson(cmd);
  } catch (err) {
    return null;
  }
}

function getRepoVar(repo, name) {
  const data = safeRunJson(
    `gh api repos/${repo}/actions/variables/${name}`
  );
  return data && typeof data.value === "string" ? data.value.trim() : "";
}

function getReadmeText(repo) {
  const data = safeRunJson(`gh api repos/${repo}/readme`);
  if (!data || !data.content) return "";
  const enc = String(data.encoding || "").toLowerCase();
  if (enc !== "base64") return "";
  return Buffer.from(data.content, "base64").toString("utf8");
}

function scoreStatus(score, maxScore) {
  if (score >= maxScore) return "completed";
  if (score > 0) return "in_progress";
  return "failed";
}

async function loadUsersIndex() {
  const snap = await db.collection("users").get();
  const byGithub = new Map();
  const byEmailLocal = new Map();

  snap.forEach((doc) => {
    const d = doc.data() || {};
    const uid = doc.id;
    const email = String(d.email || "").trim();
    const emailLocal = email.includes("@") ? email.split("@")[0].toLowerCase() : "";
    const githubLogin = String(d.githubLogin || d.githubUsername || "").trim().toLowerCase();

    const row = { uid, email, githubLogin };
    if (githubLogin) byGithub.set(githubLogin, row);
    if (emailLocal) byEmailLocal.set(emailLocal, row);
  });

  return { byGithub, byEmailLocal };
}

async function loadKnownUnitIds() {
  const snap = await db.collection("assignments").limit(5000).get();
  const set = new Set();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const u = String(d.unitId || "").replace(/\.html$/, "").trim();
    if (u) set.add(u);
  });
  return Array.from(set).sort((a, b) => b.length - a.length);
}

function splitRepoUnitAndHandle(repoFullName, knownUnits) {
  const name = String(repoFullName || "").split("/")[1] || "";
  for (const unit of knownUnits || []) {
    if (name === unit) return { unitId: unit, handle: "" };
    if (name.startsWith(`${unit}-`)) {
      return { unitId: unit, handle: name.slice(unit.length + 1) };
    }
  }
  return { unitId: "", handle: "" };
}

async function resolveAssignmentDoc(userId, unitId, repo) {
  const normUnit = String(unitId || "").replace(/\.html$/, "").trim();
  if (!userId || !normUnit) return null;

  const query = await db
    .collection("assignments")
    .where("userId", "==", userId)
    .where("unitId", "==", normUnit)
    .limit(50)
    .get();

  if (query.empty) return null;

  let rows = query.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  if (repo) {
    const strict = rows.filter((r) =>
      String(r.data.assignmentUrl || "").includes(repo)
    );
    if (strict.length > 0) rows = strict;
  }

  rows.sort((a, b) => {
    const aUpdated = a.data.updatedAt && typeof a.data.updatedAt.toMillis === "function"
      ? a.data.updatedAt.toMillis()
      : 0;
    const bUpdated = b.data.updatedAt && typeof b.data.updatedAt.toMillis === "function"
      ? b.data.updatedAt.toMillis()
      : 0;
    return bUpdated - aUpdated;
  });

  return rows[0];
}

async function resolveAssignmentByRepoOnly(repo) {
  const snap = await db.collection("assignments").limit(5000).get();
  const matches = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const url = String(d.assignmentUrl || "");
    if (!repo || !url.includes(repo)) return;
    matches.push({
      id: doc.id,
      data: d,
    });
  });
  if (matches.length === 0) return null;

  const rank = (s = "") => {
    const v = String(s || "").toLowerCase();
    if (v === "graded") return 0;
    if (v === "submitted") return 1;
    if (v === "started") return 9;
    return 5;
  };
  const ts = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
  matches.sort((a, b) => {
    const sr = rank(a.data.currentStatus) - rank(b.data.currentStatus);
    if (sr !== 0) return sr;
    return ts(b.data.updatedAt) - ts(a.data.updatedAt);
  });
  return matches[0];
}

async function main() {
  const reposFile = arg("--repos-file", "/tmp/non_bridge_repos.txt");
  const apply = hasFlag("--apply");
  const maxScore = Number(arg("--max-score", "100")) || 100;
  const reportPath = arg(
    "--report",
    `/tmp/non_bridge_autograde_backfill_${Date.now()}.csv`
  );

  if (!fs.existsSync(reposFile)) {
    throw new Error(`repos file not found: ${reposFile}`);
  }

  const repos = fs
    .readFileSync(reposFile, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = [];
  rows.push(
    "repo,user_id,unit_id,assignment_doc_id,score,max_score,status,mode,result,error"
  );

  let ok = 0;
  let fail = 0;
  const usersIndex = await loadUsersIndex();
  const knownUnits = await loadKnownUnitIds();

  for (const repo of repos) {
    try {
      let userId = getRepoVar(repo, "VC_USER_ID");
      let unitId = getRepoVar(repo, "VC_UNIT_ID");

      if (!unitId || !userId) {
        const parsed = splitRepoUnitAndHandle(repo, knownUnits);
        if (!unitId && parsed.unitId) unitId = parsed.unitId;
        if (!userId && parsed.handle) {
          const key = parsed.handle.toLowerCase();
          const hit = usersIndex.byGithub.get(key) || usersIndex.byEmailLocal.get(key) || null;
          if (hit && hit.uid) userId = hit.uid;
        }
      }

      const readme = getReadmeText(repo);
      const score = readme.trim() ? maxScore : 0;
      const status = scoreStatus(score, maxScore);

      let target = null;
      if (userId && unitId) {
        target = await resolveAssignmentDoc(userId, unitId, repo);
      }
      if (!target) {
        target = await resolveAssignmentByRepoOnly(repo);
        if (target) {
          userId = String(target.data.userId || target.data.uid || userId || "").trim();
          unitId = String(target.data.unitId || unitId || "").trim();
        }
      }
      if (!target) {
        fail += 1;
        rows.push(
          `${repo},${userId},${unitId},,,${score},${maxScore},${status},fail,assignment not found via vars or assignmentUrl`
        );
        continue;
      }

      const assignmentDocId = target.id;

      if (apply) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        await db.collection("assignments").doc(assignmentDocId).set(
          {
            autoGrade: {
              score,
              maxScore,
              status,
              source: "manual_backfill",
              runUrl: `manual://github-actions-billing-bypass/${repo}`,
              workflow: "manual-backfill-nonbridge-autograde",
              commitSha: "",
              repo,
              actor: "system-manual-backfill",
              updatedAt: now,
            },
            autoGradeSource: "manual_backfill",
            autoGradeUpdatedAt: now,
            currentStatus: status === "completed" ? "graded" : "submitted",
            updatedAt: now,
          },
          { merge: true }
        );
      }

      ok += 1;
      rows.push(
        `${repo},${userId},${unitId},${assignmentDocId},${score},${maxScore},${status},${apply ? "apply" : "dry-run"},ok,`
      );
    } catch (err) {
      fail += 1;
      rows.push(
        `${repo},,,,,,,,fail,${String(err.message || err).replace(/,/g, ";")}`
      );
    }
  }

  fs.writeFileSync(reportPath, `${rows.join("\n")}\n`, "utf8");
  console.log(`[DONE] report=${reportPath}`);
  console.log(`[SUMMARY] total=${repos.length} ok=${ok} fail=${fail} mode=${apply ? "apply" : "dry-run"}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
