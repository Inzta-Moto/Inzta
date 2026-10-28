// F-013 phase B (requirement 9.2, decision B-12): after `npm run build`, prove that the visual editor (Tiptap,
// ProseMirror) and the marked lexer load only on the article editor pages, and sanitize-html on none.
// Usage: node scripts/check-client-bundle.mjs [repo-root]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const next = path.join(root, '.next');
const manifest = JSON.parse(fs.readFileSync(path.join(next, 'app-build-manifest.json'), 'utf8')).pages;

const EDITOR_PAGES = ['/admin/(panel)/artikel/baru/page', '/admin/(panel)/artikel/[slug]/page'];
// Strings that survive minification: CSS class names and option keys the libraries use at runtime.
const MARKERS = {
  tiptap: ['ProseMirror-focused', 'tiptap'],
  marked: ['walkTokens', 'childTokens'],
  'sanitize-html': ['allowedSchemesByTag', 'allowProtocolRelative'],
};

const cache = new Map();
function libsIn(chunk) {
  if (!cache.has(chunk)) {
    const file = path.join(next, chunk);
    const src = chunk.endsWith('.js') && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    cache.set(chunk, Object.keys(MARKERS).filter(lib => MARKERS[lib].some(m => src.includes(m))));
  }
  return cache.get(chunk);
}

const errors = [];
const editorOnly = new Set();
for (const [page, chunks] of Object.entries(manifest)) {
  const libs = new Set(chunks.flatMap(libsIn));
  const isEditor = EDITOR_PAGES.includes(page);
  if (libs.has('sanitize-html')) errors.push(`${page}: sanitize-html in a client chunk`);
  if (!isEditor && (libs.has('tiptap') || libs.has('marked'))) errors.push(`${page}: ${[...libs].join(', ')} in a client chunk`);
  if (isEditor && !(libs.has('tiptap') && libs.has('marked'))) errors.push(`${page}: editor libraries not found (check is blind)`);
  if (isEditor) chunks.filter(c => libsIn(c).length).forEach(c => editorOnly.add(c));
  console.log(`${isEditor ? 'editor' : 'other '}  ${page}  ${[...libs].join(', ') || '-'}`);
}
for (const page of EDITOR_PAGES) if (!manifest[page]) errors.push(`${page}: not in app-build-manifest.json`);

// Chunks loaded later through next/dynamic are not in the manifest (review REV-08): every client chunk with an
// editor library must be one the editor pages list, and none may contain sanitize-html.
const listed = new Set(EDITOR_PAGES.flatMap(p => manifest[p] || []));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const file of walk(path.join(next, 'static')).filter(f => f.endsWith('.js'))) {
  const chunk = path.relative(next, file);
  const libs = libsIn(chunk);
  if (libs.includes('sanitize-html')) errors.push(`${chunk}: sanitize-html`);
  if ((libs.includes('tiptap') || libs.includes('marked')) && !listed.has(chunk)) errors.push(`${chunk}: ${libs.join(', ')} in a chunk the editor pages do not list`);
}

const kb = [...editorOnly].reduce((n, c) => n + fs.statSync(path.join(next, c)).size, 0) / 1024;
console.log(`\nEditor library chunks: ${[...editorOnly].join(', ')} (${kb.toFixed(0)} KB uncompressed)`);
if (errors.length) {
  console.error('\nFAIL\n' + errors.join('\n'));
  process.exit(1);
}
console.log('PASS: Tiptap and marked only on the article editor pages; sanitize-html in no client chunk');
