// F-012 task 18 (approval-gated): adds status: "published" and contentFormat: "plain" to article documents
// written before F-012. Optional clean-up only; the code already treats missing fields that way.
//
// Dry-run by default: prints what would change and writes nothing. Writes only with --apply.
// --project must name the Firebase project the credentials belong to, so the script cannot run against
// production by accident. Run against inzta-dev first; production only with Sehan's approval, by Angkasa.
//
// Usage (credentials from the same variables as lib/firebaseAdmin.ts, e.g. with node --env-file):
//   node --env-file=.env.local scripts/migrate-article-status.mjs --project <project-id>
//   node --env-file=.env.local scripts/migrate-article-status.mjs --project <project-id> --apply
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const projectArg = args[args.indexOf('--project') + 1];

const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!args.includes('--project') || !projectArg) {
  console.error('Missing --project <project-id>. Pass the project you intend to migrate.');
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

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) });
const db = admin.firestore();

const snap = await db.collection('articles').get();
const changes = [];
for (const doc of snap.docs) {
  const data = doc.data();
  const patch = {};
  if (data.status === undefined) patch.status = 'published';
  if (data.contentFormat === undefined) patch.contentFormat = 'plain';
  if (Object.keys(patch).length) changes.push({ doc, patch });
}

console.log(`Project ${projectId}: ${snap.size} articles, ${changes.length} to update (${apply ? 'APPLY' : 'dry-run'}).`);
for (const { doc, patch } of changes) console.log(`  ${doc.id}: ${JSON.stringify(patch)}`);

if (!apply) {
  console.log('Dry-run only. Re-run with --apply to write.');
  process.exit(0);
}

let written = 0;
for (const { doc, patch } of changes) {
  try {
    // updatedAt is left alone on purpose: this is not an edit, and the sitemap lastModified must not move.
    await doc.ref.update(patch, { lastUpdateTime: doc.updateTime });
    written++;
  } catch (error) {
    console.error(`  ${doc.id}: not updated (${error.code ?? ''} ${error.message}); it changed since it was read, re-run the script.`);
  }
}
console.log(`Updated ${written} of ${changes.length}.`);
process.exit(written === changes.length ? 0 : 1);
