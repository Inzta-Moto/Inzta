// F-016 D2, design.md §3.2 (P-22, A-049): prints a proposed kategoriMotor per product from public product data,
// marked "perlu validasi Bang Raja". It never writes anywhere: applying the values is Angkasa's or Bang Raja's
// action in the admin form after validation (inzta-dev first).
// Usage: node scripts/f016-kategori-draft.mjs --dry-run [--from <products.json>] [--json]
//   --from  a JSON file with { products: [...] } or [...] (e.g. the F016_FIXTURE file); default: GET
//           https://inzta.id/api/products (public read-only endpoint).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (!args.includes('--dry-run')) {
  console.error('Usage: node scripts/f016-kategori-draft.mjs --dry-run [--from <products.json>] [--json]');
  console.error('This script only prints proposals; --dry-run is required so nobody mistakes it for a migration.');
  process.exit(1);
}

// Loads the TypeScript helper with the repo's typescript, like the tests, so the rule lives in one place.
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, 'node_modules/typescript'));
function loadTs(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', out.outputText)(mod.exports, require, mod);
  return mod.exports;
}
const { draftKategoriMotor, normalizeKategoriMotor, CATEGORY_SLUGS } = loadTs(path.join(ROOT, 'lib/v2/motor-category.ts'));

async function readProducts() {
  const i = args.indexOf('--from');
  if (i !== -1) {
    const file = args[i + 1];
    if (!file) throw new Error('--from needs a file path');
    const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    return Array.isArray(data) ? data : data.products ?? [];
  }
  const res = await fetch('https://inzta.id/api/products', { method: 'GET' });
  if (!res.ok) throw new Error(`GET /api/products: HTTP ${res.status}`);
  return (await res.json()).products ?? [];
}

const products = (await readProducts())
  .map(p => ({ slug: p.slug ?? p.id, name: String(p.name ?? ''), isActive: p.isActive !== false, current: normalizeKategoriMotor(p.kategoriMotor) }))
  .filter(p => p.slug)
  .sort((a, b) => a.slug.localeCompare(b.slug));

const proposals = products.map(p => ({ ...p, proposed: draftKategoriMotor(p) }));

if (args.includes('--json')) {
  console.log(JSON.stringify({
    note: 'perlu validasi Bang Raja (A-049); dry run, nothing written',
    proposals: proposals.map(({ slug, name, isActive, current, proposed }) => ({ slug, name, isActive, current, proposed })),
  }, null, 2));
} else {
  console.log('DRY RUN: proposed kategoriMotor, perlu validasi Bang Raja (A-049). Nothing is written.\n');
  for (const p of proposals) {
    const changed = p.proposed.join(',') !== p.current.join(',');
    const flag = changed ? '*' : ' ';
    console.log(`${flag} ${p.slug}${p.isActive ? '' : ' (nonaktif)'}\n    ${p.name}\n    sekarang: [${p.current.join(', ')}]  usulan: [${p.proposed.join(', ')}]`);
  }
  const counts = CATEGORY_SLUGS.map(c => `${c}=${proposals.filter(p => p.isActive && p.proposed.includes(c)).length}`);
  const none = proposals.filter(p => p.isActive && p.proposed.length === 0).length;
  console.log(`\nactive products per proposed category: ${counts.join(', ')}; without proposal: ${none}`);
  console.log(`products: ${proposals.length}; "*" = proposal differs from the stored value`);
}
