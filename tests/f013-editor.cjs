// F-013 phase B: Markdown <-> visual editor document (app/admin/(panel)/artikel/_editor/markdown-doc.ts).
// Requirement 10: for Markdown m, renderArticle(s(p(m))) equals renderArticle(m) with the same warnings, s(p(.)) is
// stable, the document fits the editor schema, and Markdown outside the subset is kept verbatim.
// Usage: npm run test:editor  (or: node tests/f013-editor.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  else if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const EDITOR = path.join(ROOT, 'app/admin/(panel)/artikel/_editor');
const { renderArticle } = require(path.join(ROOT, 'lib/markdown.ts'));
const { extractBodyImages } = require(path.join(ROOT, 'lib/article-format.ts'));
const { markdownToDoc, docToMarkdown, countRawBlocks, imageOccurrence } = require(path.join(EDITOR, 'markdown-doc.ts'));
const { articleExtensions } = require(path.join(EDITOR, 'editor-extensions.ts'));
const { getSchema } = require('@tiptap/core');
const { Node: PMNode } = require('@tiptap/pm/model');

const schema = getSchema(articleExtensions());
const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/foto.jpg';
const p = md => markdownToDoc(md);
const s = doc => docToMarkdown(doc);
const render = md => renderArticle({ content: md, contentFormat: 'markdown' });
const squash = html => html.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const fixture = name => fs.readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8');

/** The round-trip contract of requirement 10.2 and the schema check of 10.7. Returns s(p(m)). */
function roundTrip(md) {
  const doc = p(md);
  PMNode.fromJSON(schema, doc).check();
  const out = s(doc);
  const before = render(md);
  const after = render(out);
  assert.strictEqual(squash(after.html), squash(before.html), `HTML changed.\n--- in:\n${md}\n--- out:\n${out}`);
  assert.deepStrictEqual(after.warnings, before.warnings, 'warnings changed');
  assert.strictEqual(s(p(out)), out, `canonical form not stable for:\n${out}`);
  return out;
}

// Real naskah
for (const name of ['K-02-naskah.md', 'K-03-naskah.md', 'K-06-naskah.md']) {
  check(`${name}: same HTML and warnings after the round-trip, stable, no raw blocks, schema-valid`, () => {
    const md = fixture(name);
    roundTrip(md);
    assert.strictEqual(countRawBlocks(p(md)), 0);
  });
}
check('K-03 placeholders keep path, alt, and kind through the round-trip (10.3)', () => {
  const md = fixture('K-03-naskah.md');
  const before = extractBodyImages(md).map(i => [i.url, i.alt, i.caption, i.kind, i.layout]);
  const after = extractBodyImages(roundTrip(md)).map(i => [i.url, i.alt, i.caption, i.kind, i.layout]);
  assert.strictEqual(before.length, 5);
  assert.deepStrictEqual(after, before);
});

// Layout fixture: 12 combinations, placeholders with a layout, captions with quotes
const POS = ['kiri', 'tengah', 'kanan'];
const SIZE = ['kecil', 'sedang', 'besar', 'penuh'];
const LAYOUT_MD = [
  'Pembuka artikel.',
  ...POS.flatMap(po => SIZE.map(sz => `![Foto ${po} ${sz}](${CLD} "Caption \\"${po}\\" ${sz}"){posisi=${po} ukuran=${sz}}\n\nTeks di samping ${po} ${sz}.`)),
  '![Belum ada](../images/K-03/tk5.jpg "Dok. INZTA"){posisi=kiri ukuran=kecil}',
  '![Nanti](GAMBAR-2){ukuran=besar}',
  '![Luar](https://example.com/x.jpg)',
  '![Alt \\] kurung](' + CLD + ' "C:\\\\path")',
].join('\n\n');
check('layout fixture: 12 combinations + placeholders round-trip with identical HTML and warnings', () => {
  const out = roundTrip(LAYOUT_MD);
  const imgs = extractBodyImages(out);
  assert.strictEqual(imgs.length, 16);
  assert.deepStrictEqual(imgs.slice(0, 12).map(i => `${i.layout.posisi}/${i.layout.ukuran}`),
    POS.flatMap(po => SIZE.map(sz => (sz === 'penuh' ? 'tengah/penuh' : `${po}/${sz}`))));
  assert.deepStrictEqual(imgs.map(i => i.caption).slice(0, 2), ['Caption "kiri" kecil', 'Caption "kiri" sedang']);
  assert.deepStrictEqual([imgs[12].kind, imgs[12].layout, imgs[13].layout, imgs[14].kind], ['placeholder', { posisi: 'kiri', ukuran: 'kecil' }, { posisi: 'tengah', ukuran: 'besar' }, 'foreign']);
  assert.strictEqual(imgs[15].alt, 'Alt ] kurung');
  assert.strictEqual(imgs[15].caption, 'C:\\path');
});
check('images are written with the phase A canonical block, none for the default layout', () => {
  assert.strictEqual(s(p(`![a](${CLD}){Posisi=KANAN}`)), `![a](${CLD}){posisi=kanan ukuran=sedang}`);
  assert.strictEqual(s(p(`![a](${CLD}){posisi=tengah ukuran=penuh}`)), `![a](${CLD})`);
  assert.strictEqual(s(p(`![a](${CLD}) {posisi=kanan ukuran=penuh}`)), `![a](${CLD})`);
  const doc = p(`![a](${CLD} "cap"){posisi=kiri ukuran=besar}`);
  assert.deepStrictEqual(doc.content[0], { type: 'articleImage', attrs: { src: CLD, alt: 'a', caption: 'cap', posisi: 'kiri', ukuran: 'besar' } });
});
check('image paths with spaces or parentheses use the <...> form', () => {
  const md = '![a](<../images/K 03/foto (1).jpg>)';
  assert.strictEqual(roundTrip(md), md);
  assert.strictEqual(extractBodyImages(md)[0].url, '../images/K 03/foto (1).jpg');
});

// Raw blocks (B-4, 10.4)
const RAW_CASES = {
  'fenced code': '```\nkode()\n```',
  quote: '> kutipan *penting*',
  rule: '---',
  'raw HTML block': '<div>halo</div>',
  'inline HTML': 'Teks <b>tebal</b> lagi.',
  strike: 'Ini ~~coret~~ ya.',
  'inline code': 'Pakai `npm` saja.',
  'image with text': `Lihat ![a](${CLD}) ini.`,
  'image in a tight list': `- ![a](${CLD})`,
  'image in a table cell': `| a |\n| --- |\n| ![x](${CLD}) |`,
  'task list': '- [ ] belum\n- [x] sudah',
  'unknown entity': 'Tunggu&hellip; ya.',
  'link with title': '[INZTA](/produk "judul")',
  'indented code': '    kode',
};
for (const [name, md] of Object.entries(RAW_CASES)) {
  check(`raw block kept verbatim: ${name}`, () => {
    const doc = p(`Sebelum.\n\n${md}\n\nSesudah.`);
    assert.strictEqual(countRawBlocks(doc), 1, JSON.stringify(doc));
    const out = roundTrip(`Sebelum.\n\n${md}\n\nSesudah.`);
    assert.ok(out.includes(md), out);
  });
}
check('countRawBlocks counts raw blocks inside list items too', () => {
  const doc = { type: 'doc', content: [{ type: 'bulletList', attrs: { tight: false }, content: [{ type: 'listItem', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'rawMarkdown', content: [{ type: 'text', text: '> q' }] }] }] }, { type: 'rawMarkdown' }] };
  assert.strictEqual(countRawBlocks(doc), 2);
  assert.strictEqual(s(doc), '- a\n\n  > q');
  PMNode.fromJSON(schema, doc).check();
});
check('the lexer failing (deep nesting) keeps the whole body as one raw block', () => {
  const md = '> '.repeat(5000) + 'x';
  const quiet = console.error;
  console.error = () => {};
  try {
    const doc = p(md);
    assert.strictEqual(doc.content.length, 1);
    assert.strictEqual(doc.content[0].type, 'rawMarkdown');
    assert.strictEqual(s(doc), md);
  } finally { console.error = quiet; }
});

// Serializer: text that looks like Markdown stays text
const para = (text, marks) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] }] });
const TRICKY = ['# bukan judul', '## juga bukan', '- bukan daftar', '+ plus', '* bintang', '1. bukan nomor', '2026) tahun', '> bukan kutipan', '---', '===', '**bukan tebal**', '*bukan miring*', '_garis_', 'nama_file_foto', '`kode`', '~~coret~~', 'a\\b', '[teks](url)', '![alt](url)', 'a < b > c', 'R&D &amp; &#169; &copy;', 'kolom | pipa', 'harga {posisi=kanan}', '<b>tag</b>', '    menjorok'];
for (const text of TRICKY) {
  check(`escaping keeps text as text: ${JSON.stringify(text)}`, () => {
    const md = s(para(text));
    const back = p(md);
    assert.strictEqual(back.content.length, 1, md);
    assert.strictEqual(back.content[0].type, 'paragraph', md);
    assert.deepStrictEqual(back.content[0].content, [{ type: 'text', text: text.trimStart() }], md);
    assert.strictEqual(s(back), md);
  });
}
check('bold and italic move edge spaces outside the markers; nested marks and links round-trip', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Ini ' },
    { type: 'text', text: ' tebal ', marks: [{ type: 'bold' }] },
    { type: 'text', text: 'dan ' },
    { type: 'text', text: 'link tebal', marks: [{ type: 'link', attrs: { href: '/produk/a b(1)|x' } }, { type: 'bold' }] },
    { type: 'text', text: ' dan ' },
    { type: 'text', text: 'miring tebal', marks: [{ type: 'bold' }, { type: 'italic' }] },
    { type: 'text', text: '.' },
  ] }] };
  const md = s(doc);
  assert.strictEqual(md, 'Ini  **tebal** dan [**link tebal**](/produk/a%20b%281%29%7Cx) dan ***miring tebal***.');
  roundTrip(md);
  const back = p(md).content[0].content;
  assert.deepStrictEqual(back.find(n => n.text === 'link tebal').marks, [{ type: 'link', attrs: { href: '/produk/a%20b%281%29%7Cx' } }, { type: 'bold' }]);
});
check('review REV-01: a "!" typed right before a link stays text, the link stays a link', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Pesan sekarang!' }, { type: 'text', text: 'WhatsApp', marks: [{ type: 'link', attrs: { href: 'https://wa.me/62' } }] }, { type: 'text', text: ' Mantap!' }] }] };
  const md = s(doc);
  assert.strictEqual(md, 'Pesan sekarang\\![WhatsApp](https://wa.me/62) Mantap!');
  assert.deepStrictEqual(p(md), doc);
  assert.deepStrictEqual(render(md).warnings, []);
  roundTrip('Wow\\![x](/produk)');
});
check('review REV-03: nested emphasis of the same kind is one mark (schema-valid, same text)', () => {
  for (const md of ['**a **b** c**', '*a *b* c*', '[a [b](/y) c](/x)']) {
    const doc = p(md);
    PMNode.fromJSON(schema, doc).check();
    assert.strictEqual(s(p(s(doc))), s(doc), md);
  }
  assert.strictEqual(s(p('**a **b** c**')), '**a b c**');
});
check('review REV-07: line breaks in an image src cannot inject Markdown', () => {
  const doc = { type: 'doc', content: [{ type: 'articleImage', attrs: { src: 'https://example.com/a\n\n## Judul\n\nx.jpg', alt: 'a', caption: '', posisi: 'tengah', ukuran: 'penuh' } }] };
  const md = s(doc);
  assert.ok(!md.includes('\n'), md);
  assert.strictEqual(p(md).content.length, 1);
});
check('hard break round-trips as backslash-newline; a trailing one is dropped', () => {
  assert.strictEqual(roundTrip('baris satu\\\nbaris dua'), 'baris satu\\\nbaris dua');
  assert.strictEqual(roundTrip('baris satu  \nbaris dua'), 'baris satu\\\nbaris dua');
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }] }] };
  assert.strictEqual(s(doc), 'a');
  const lineStart = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: '# b' }] }] };
  assert.strictEqual(s(lineStart), 'a\\\n\\# b');
});
check('soft line breaks become spaces (same page text)', () => {
  assert.strictEqual(roundTrip('satu\ndua'), 'satu dua');
});

// Headings
check('headings: # loads as H2, #### as H3; a trailing # is escaped', () => {
  assert.strictEqual(roundTrip('# Satu\n\n#### Empat'), '## Satu\n\n### Empat');
  const doc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nomor #' }] }] };
  assert.strictEqual(s(doc), '## Nomor \\#');
  assert.deepStrictEqual(p(s(doc)).content[0].content, [{ type: 'text', text: 'Nomor #' }]);
});

// Lists
check('lists: tight and loose kept, nested, ordered start, markers normalised', () => {
  assert.strictEqual(roundTrip('* a\n* b\n  * c'), '- a\n- b\n  - c');
  assert.strictEqual(roundTrip('- a\n\n- b'), '- a\n\n- b');
  assert.strictEqual(roundTrip('3. tiga\n4. empat'), '3. tiga\n4. empat');
  assert.strictEqual(roundTrip('1. satu\n\n   paragraf kedua\n2. dua'), '1. satu\n\n   paragraf kedua\n\n2. dua');
  roundTrip('- **tebal** di [link](/produk)\n- 10. bukan nomor');
});
check('two adjacent lists of the same kind stay two lists', () => {
  const list = (type, text) => ({ type, attrs: { tight: true }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }] });
  const doc = { type: 'doc', content: [list('bulletList', 'a'), list('bulletList', 'b'), list('bulletList', 'c'), list('orderedList', 'd'), list('orderedList', 'e')] };
  const md = s(doc);
  assert.strictEqual(p(md).content.length, 5, md);
  roundTrip(md);
});
check('a list item with two paragraphs is written loose so they stay apart', () => {
  const doc = { type: 'doc', content: [{ type: 'bulletList', attrs: { tight: true }, content: [{ type: 'listItem', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'a' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }] }] };
  const md = s(doc);
  assert.strictEqual(md, '- a\n\n  b');
  assert.strictEqual(p(md).content[0].content[0].content.length, 2);
});

// Tables
check('tables: header row, pipes and links in cells, alignment dropped (sanitizer drops it too)', () => {
  const md = '| Produk | Harga |\n|:--|--:|\n| Tas \\| samping | [Lihat](/produk/z10) |\n| **TK5** | Rp 1 |';
  const out = roundTrip(md);
  assert.strictEqual(out, '| Produk | Harga |\n| --- | --- |\n| Tas \\| samping | [Lihat](/produk/z10) |\n| **TK5** | Rp 1 |');
  const doc = p(md);
  assert.strictEqual(doc.content[0].content[0].content[0].type, 'tableHeader');
});

// Edge cases together
check('mixed edge-case article round-trips', () => {
  roundTrip([
    '# Judul di isi', 'Paragraf dengan \\*bintang\\*, nama_file, R&amp;D, &#169; dan https://inzta.id.',
    '- satu\n- dua\n\n1) tiga', '| a | b |\n| --- | --- |\n| 1 | 2 |', `![Foto](${CLD}){posisi=kanan ukuran=kecil}`,
    'Teks **tebal *miring* lagi** dan [*link*](https://example.com).', '```js\nx()\n```', '> kutipan',
  ].join('\n\n'));
});
check('emphasis around a link is written inside it (marks are a set; same look, 10.2 exception)', () => {
  const out = s(p('*[link](/produk)* dan **[tebal](/blog)**'));
  assert.strictEqual(out, '[*link*](/produk) dan [**tebal**](/blog)');
  assert.strictEqual(render(out).html, '<p><a href="/produk"><em>link</em></a> dan <a href="/blog"><strong>tebal</strong></a></p>\n');
});
check('empty documents write nothing; empty paragraphs and headings are skipped', () => {
  assert.strictEqual(s(p('')), '');
  assert.strictEqual(s({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'heading', attrs: { level: 2 } }, { type: 'paragraph', content: [{ type: 'text', text: 'x' }] }, { type: 'paragraph' }] }), 'x');
  PMNode.fromJSON(schema, p('')).check();
});
check('imageOccurrence: n-th image with the same src and alt', () => {
  const md = `![a](${CLD})\n\n![b](${CLD})\n\n![a](${CLD})`;
  const imgs = extractBodyImages(md);
  assert.deepStrictEqual(imgs.map(i => imageOccurrence(imgs, i)), [0, 0, 1]);
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
