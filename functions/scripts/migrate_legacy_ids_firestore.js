#!/usr/bin/env node
/**
 * Migrate legacy course/unit ids in Firestore documents.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
 *   node functions/scripts/migrate_legacy_ids_firestore.js --dry-run
 *
 *   GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
 *   node functions/scripts/migrate_legacy_ids_firestore.js --apply
 */

const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const LEGACY_ID_MAP = {
  '01': 'ydb63bg',
  '02': 'a45cwlak',
  '03': 'a7smdfeq',
  '04': 'hkdq5j3m',
  '05': 'io5rxgxl',
  '01-master-identity': '01-master-getting-started.html',

  '04-master-ai-agents.html': '02-master-ai-agents.html',
  '04-unit-agent-mode.html': '02-unit-agent-mode.html',
  '04-unit-web-agents.html': '02-unit-web-agents.html',
  '04-unit-vibe-coding.html': '02-unit-vibe-coding.html',

  '02-unit-vibe-coding-intro.html': '03-unit-github-classroom.html',
  '02-unit-classroom-workflow.html': '03-unit-github-classroom.html',
  '02-unit-teacher-matrix.html': '03-unit-github-classroom.html',

  '04-unit-wifi-setup.html': '03-unit-wifi-setup.html',
  '04-unit-motor-ramping.html': '03-unit-motor-ramping.html',

  // no-extension variants
  '04-master-ai-agents': '02-master-ai-agents',
  '04-unit-agent-mode': '02-unit-agent-mode',
  '04-unit-web-agents': '02-unit-web-agents',
  '04-unit-vibe-coding': '02-unit-vibe-coding',
  '02-unit-vibe-coding-intro': '03-unit-github-classroom',
  '02-unit-classroom-workflow': '03-unit-github-classroom',
  '02-unit-teacher-matrix': '03-unit-github-classroom',
  '04-unit-wifi-setup': '03-unit-wifi-setup',
  '04-unit-motor-ramping': '03-unit-motor-ramping',
};

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    limit: 0,
    out: '',
  };
  for (const t of argv.slice(2)) {
    if (t === '--apply') {
      args.apply = true;
      args.dryRun = false;
    } else if (t === '--dry-run') {
      args.dryRun = true;
      args.apply = false;
    } else if (t.startsWith('--limit=')) {
      const n = Number(t.split('=')[1]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
    } else if (t.startsWith('--out=')) {
      args.out = t.split('=')[1] || '';
    }
  }
  return args;
}

function mapId(value) {
  if (typeof value !== 'string') return value;
  return LEGACY_ID_MAP[value] || value;
}

function mapObjectKeys(obj) {
  const out = {};
  let changed = false;
  for (const [k, v] of Object.entries(obj || {})) {
    const nk = mapId(k);
    if (nk !== k) changed = true;
    if (out[nk] === undefined) out[nk] = v;
    else {
      // if key collision, prefer existing new-key value, keep data deterministic
      changed = true;
    }
  }
  return { value: out, changed };
}

function mapArray(arr) {
  if (!Array.isArray(arr)) return { value: arr, changed: false };
  let changed = false;
  const mapped = arr.map((x) => {
    const nx = mapId(x);
    if (nx !== x) changed = true;
    return nx;
  });
  const dedup = [];
  const seen = new Set();
  for (const x of mapped) {
    const key = `${typeof x}:${String(x)}`;
    if (!seen.has(key)) {
      dedup.push(x);
      seen.add(key);
    } else {
      changed = true;
    }
  }
  return { value: dedup, changed };
}

function patchIfChanged(patch, key, before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) patch[key] = after;
}

async function migrateUsers(doc) {
  const d = doc.data() || {};
  const patch = {};

  const ua = mapObjectKeys(d.unitAssignments || {});
  patchIfChanged(patch, 'unitAssignments', d.unitAssignments || {}, ua.value);

  const tc = mapObjectKeys(d.tutorConfigs || {});
  patchIfChanged(patch, 'tutorConfigs', d.tutorConfigs || {}, tc.value);

  const cp = mapObjectKeys(d.courseProgress || {});
  patchIfChanged(patch, 'courseProgress', d.courseProgress || {}, cp.value);

  return patch;
}

async function migrateOrders(doc) {
  const d = doc.data() || {};
  const patch = {};

  const items = d.items || {};
  const mappedItems = {};
  let itemsChanged = false;
  for (const [k, v] of Object.entries(items)) {
    const nk = mapId(k);
    if (nk !== k) itemsChanged = true;
    mappedItems[nk] = v;
  }
  if (itemsChanged) patch.items = mappedItems;

  if (typeof d.courseId === 'string') {
    const nc = mapId(d.courseId);
    if (nc !== d.courseId) patch.courseId = nc;
  }

  return patch;
}

async function migrateAssignments(doc) {
  const d = doc.data() || {};
  const patch = {};

  if (typeof d.courseId === 'string') {
    const nc = mapId(d.courseId);
    if (nc !== d.courseId) patch.courseId = nc;
  }
  if (typeof d.unitId === 'string') {
    const nu = mapId(d.unitId);
    if (nu !== d.unitId) patch.unitId = nu;
  }

  return patch;
}

async function migrateTutorApplications(doc) {
  const d = doc.data() || {};
  const patch = {};
  if (typeof d.unitId === 'string') {
    const nu = mapId(d.unitId);
    if (nu !== d.unitId) patch.unitId = nu;
  }
  return patch;
}

async function migrateReferralLinks(doc) {
  const d = doc.data() || {};
  const patch = {};
  if (typeof d.unitId === 'string') {
    const nu = mapId(d.unitId);
    if (nu !== d.unitId) patch.unitId = nu;
  }
  return patch;
}

async function migrateMetadataLessons(doc) {
  const d = doc.data() || {};
  const patch = {};
  if (typeof d.courseId === 'string') {
    const nc = mapId(d.courseId);
    if (nc !== d.courseId) patch.courseId = nc;
  }
  const units = mapArray(d.courseUnits || []);
  patchIfChanged(patch, 'courseUnits', d.courseUnits || [], units.value);
  return patch;
}

async function processCollection(name, migrator, args, report) {
  let q = db.collection(name);
  if (args.limit > 0) q = q.limit(args.limit);
  const snap = await q.get();

  for (const doc of snap.docs) {
    const patch = await migrator(doc);
    const keys = Object.keys(patch);
    if (keys.length === 0) {
      report.summary.noop += 1;
      continue;
    }

    report.summary.changed += 1;
    report.changes.push({ collection: name, id: doc.id, patch });

    if (args.apply) {
      await doc.ref.set(
        { ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      report.summary.updated += 1;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = args.out || `legacy_id_migration_report_${ts}.json`;

  const report = {
    startedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    limit: args.limit,
    summary: { changed: 0, updated: 0, noop: 0 },
    changes: [],
  };

  await processCollection('users', migrateUsers, args, report);
  await processCollection('orders', migrateOrders, args, report);
  await processCollection('assignments', migrateAssignments, args, report);
  await processCollection('tutor_applications', migrateTutorApplications, args, report);
  await processCollection('referral_links', migrateReferralLinks, args, report);
  await processCollection('metadata_lessons', migrateMetadataLessons, args, report);

  report.finishedAt = new Date().toISOString();
  require('fs').writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`[DONE] ${out}`);
  console.log(`[SUMMARY] mode=${report.mode} changed=${report.summary.changed} updated=${report.summary.updated} noop=${report.summary.noop}`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message || err);
  process.exit(1);
});
