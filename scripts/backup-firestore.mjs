// FB-04 (audit Firebase 2026-10-30): read-only manual backup of every Firestore collection to one JSON file.
// Run weekly and before every migration or rules deploy. Costs about two reads per stored document (list + get)
// and writes nothing to Firestore.
//
// The file holds buyer data (orders, affiliates, commissions). --out must be outside this repo; keep the file in
// the team's private storage, never in a repo, chat, or Cloud Storage.
// --project must name the Firebase project the credentials belong to, so the wrong project cannot be read by
// accident.
//
// Usage (credentials from the same variables as lib/firebaseAdmin.ts, e.g. with node --env-file):
//   node --env-file=.env.local scripts/backup-firestore.mjs --project <project-id> --out <dir outside repo>
//
// Types Firestore has and JSON lacks are tagged ({"__type": "timestamp" | "ref" | "geopoint" | "bytes", ...}) so a
// restore can rebuild them.
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const projectArg = arg('--project');
const outArg = arg('--out');

const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectArg || !outArg) {
  console.error('Usage: backup-firestore.mjs --project <project-id> --out <dir outside repo>');
  process.exit(2);
}
if (!privateKey || !clientEmail || !projectId) {
  console.error('Missing Firebase Admin credentials (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID).');
  process.exit(2);
}
if (projectArg !== projectId) {
  console.error(`--project ${projectArg} does not match the credentials' project. Nothing was read.`);
  process.exit(2);
}
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(outArg);
if (outDir === repoRoot || outDir.startsWith(repoRoot + path.sep)) {
  console.error('--out is inside the repo. Backups hold buyer data; pick a private folder outside the repo.');
  process.exit(2);
}

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) });
const db = admin.firestore();

function encode(value) {
  if (value instanceof admin.firestore.Timestamp) return { __type: 'timestamp', value: value.toDate().toISOString() };
  if (value instanceof admin.firestore.DocumentReference) return { __type: 'ref', path: value.path };
  if (value instanceof admin.firestore.GeoPoint) return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

// listDocuments (not get) so a document that has no fields but holds subcollections is kept; its data is null.
async function dumpCollection(ref) {
  const out = {};
  const refs = await ref.listDocuments();
  for (const snap of refs.length ? await db.getAll(...refs) : []) {
    const subcollections = {};
    for (const sub of await snap.ref.listCollections()) subcollections[sub.id] = await dumpCollection(sub);
    out[snap.id] = { data: snap.exists ? encode(snap.data()) : null, ...(Object.keys(subcollections).length ? { subcollections } : {}) };
  }
  return out;
}

const exportedAt = new Date().toISOString();
const collections = {};
for (const col of await db.listCollections()) collections[col.id] = await dumpCollection(col);

fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
const file = path.join(outDir, `firestore-${projectId}-${exportedAt.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify({ project: projectId, exportedAt, collections }, null, 2), { mode: 0o600, flag: 'wx' });

// Re-open the written file so a truncated or unreadable backup fails here, not on the day it is needed.
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log(`Backup ${file}`);
for (const [name, docs] of Object.entries(check.collections)) console.log(`  ${name}: ${Object.keys(docs).length} documents`);
