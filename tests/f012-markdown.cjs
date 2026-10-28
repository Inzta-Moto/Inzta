// F-012: renderArticle() (lib/markdown.ts) with the real marked + sanitize-html, and the pre-publish
// checklist (lib/article-checklist.ts). Includes XSS attack fixtures and the K-02 and K-06 "Naskah".
// Usage: npm run test:markdown  (or: node tests/f012-markdown.cjs <repo-root>)
// F-013: `--write-snapshots` (once, on the unchanged renderer) writes tests/fixtures/K-0x-naskah.html.
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ARGS = process.argv.slice(2);
const WRITE_SNAPSHOTS = ARGS.includes('--write-snapshots');
const ROOT = path.resolve(ARGS.find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
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

const { renderArticle } = require(path.join(ROOT, 'lib/markdown.ts'));
const fmt = require(path.join(ROOT, 'lib/article-format.ts'));
const { runChecklist, canPublish } = require(path.join(ROOT, 'lib/article-checklist.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
const md = (content) => renderArticle({ content, contentFormat: 'markdown' });
const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/foto.jpg';
const count = (html, re) => (html.match(re) || []).length;
// Every tag and attribute in the output must be on the allowlist of requirement 4.3 / 4.10.
const ALLOWED = { h2: [], h3: [], p: [], ul: [], ol: [], li: [], strong: [], em: [], br: [], figure: [], figcaption: [], table: [], thead: [], tbody: [], tr: [], th: [], td: [], a: ['href', 'rel', 'target'], img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'decoding'] };
function assertAllowlisted(html) {
  for (const m of html.matchAll(/<([a-zA-Z0-9]+)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    assert.ok(tag in ALLOWED, `tag <${tag}> not allowed in: ${html.slice(0, 200)}`);
    for (const a of m[2].matchAll(/([a-zA-Z-:]+)=/g)) assert.ok(ALLOWED[tag].includes(a[1].toLowerCase()), `attribute ${a[1]} on <${tag}>`);
  }
}

// Structure
check('headings: # -> h2, ## -> h2, ### -> h3, #### to ###### -> h3, never h1', () => {
  const { html } = md('# A\n\n## B\n\n### C\n\n#### D\n\n###### E');
  assert.strictEqual(count(html, /<h1/g), 0);
  assert.deepStrictEqual([...html.matchAll(/<(h\d)>/g)].map(m => m[1]), ['h2', 'h2', 'h3', 'h3', 'h3']);
  assert.ok(!/ id=/.test(html));
});
check('lists, bold, italic, paragraphs', () => {
  const { html } = md('Teks **tebal** dan *miring*.\n\n- satu\n- dua\n\n1. a\n2. b');
  assert.ok(html.includes('<strong>tebal</strong>') && html.includes('<em>miring</em>'));
  assert.ok(/<ul>\s*<li>satu<\/li>\s*<li>dua<\/li>\s*<\/ul>/.test(html));
  assert.ok(/<ol>\s*<li>a<\/li>/.test(html));
  assertAllowlisted(html);
});
check('constructs outside the subset keep their text but lose their tags (code, quote, rule, strike)', () => {
  const { html } = md('```\nkode()\n```\n\n> kutipan\n\n---\n\n~~coret~~ `x`');
  assert.ok(html.includes('kode()') && html.includes('kutipan') && html.includes('coret'));
  assertAllowlisted(html);
});

// Links
check('links: http, https, and /path kept; internal links have no target', () => {
  const { html } = md('[produk](/produk) [situs](https://inzta.id/blog) [luar](http://example.com/a)');
  assert.ok(html.includes('<a href="/produk">produk</a>'));
  assert.ok(html.includes('<a href="https://inzta.id/blog">situs</a>'));
  assert.ok(html.includes('<a href="http://example.com/a" rel="noopener noreferrer" target="_blank">luar</a>'));
});
check('links: javascript:, mixed case, entity-encoded, data:, vbscript:, //host, /\\host lose href', () => {
  const attacks = [
    '[a](javascript:alert(1))', '[a](JaVaScRiPt:alert(1))', '[a](&#106;avascript:alert(1))', '[a](&#x6A;avascript:alert(1))',
    '[a](java\tscript:alert(1))', '[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)', '[a](vbscript:msgbox)',
    '[a](//evil.example)', '[a](/\\evil.example)', '[a](<javascript:alert(1)>)', '<javascript:alert(1)>', '[a][r]\n\n[r]: javascript:alert(1)',
  ];
  for (const src of attacks) {
    const { html } = md(src);
    assert.ok(!/href/i.test(html), `${src} -> ${html}`);
    assert.ok(!/javascript|vbscript|data:/i.test(html.replace(/>[^<]*</g, '><')), `${src} -> ${html}`);
  }
});

// Raw HTML
check('raw HTML: script, img onerror, iframe, a href=javascript, svg onload, style are dropped', () => {
  const src = [
    '<script>alert(1)</script>',
    'Teks <img src=x onerror=alert(1)> lanjut',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="javascript:alert(1)">klik</a>',
    '<svg onload=alert(1)><circle/></svg>',
    '<style>body{display:none}</style>',
    '<p onclick="alert(1)" style="color:red" class="x" id="y">para</p>',
    '<details open ontoggle=alert(1)>',
  ].join('\n\n');
  const { html, warnings } = md(src);
  assert.ok(!/<script|onerror|<iframe|javascript:|<svg|onload|<style|onclick|style=|class=|id=|ontoggle|alert\(1\)/i.test(html), html);
  assert.ok(warnings.some(w => w.kind === 'raw-html'));
  assertAllowlisted(html);
});
check('raw HTML inside a list item, heading, and emphasis is dropped too', () => {
  const { html } = md('- <img src=x onerror=alert(1)>\n\n## Judul <script>alert(1)</script>\n\n**<b onmouseover=alert(1)>x</b>**');
  // Inline tags are dropped one by one, so text between them (here "alert(1)") stays as inert text.
  assert.ok(!/onerror|<script|onmouseover|<img|<b /i.test(html), html);
  assertAllowlisted(html);
});
check('sanitizer layer alone: foreign src or srcset candidate, javascript: href, attributes outside the allowlist', () => {
  const { sanitizeArticleHtml } = require(path.join(ROOT, 'lib/markdown.ts'));
  const okSet = `${CLD.replace('upload/', 'upload/f_auto,q_auto,w_480/')} 480w, ${CLD.replace('upload/', 'upload/f_auto,q_auto,w_800/')} 800w`;
  assert.ok(/<img/.test(sanitizeArticleHtml(`<img src="${CLD}" srcset="${okSet}" alt="a">`)));
  for (const img of [
    `<img src="https://evil.example/x.jpg" alt="a">`,
    `<img src="${CLD}" srcset="${okSet}, https://evil.example/x.jpg 1200w" alt="a">`,
    `<img src="https://res.cloudinary.com/dukddlp0b/../x/a.jpg" alt="a">`,
    `<img src="${CLD}" onerror="alert(1)" style="x" class="y" alt="a">`,
  ]) {
    const out = sanitizeArticleHtml(img);
    assert.ok(!/evil|\.\.|onerror|style|class/.test(out), `${img} -> ${out}`);
  }
  assert.strictEqual(sanitizeArticleHtml('<a href="javascript:alert(1)" onclick="x">a</a>'), '<a>a</a>');
  assert.strictEqual(sanitizeArticleHtml('<h1 id="x">a</h1><table class="t" style="x"><tr onclick="x"><td align="left" colspan="9">b</td></tr></table>'), 'a<table><tr><td>b</td></tr></table>');
});
// Tables: spec amendment 2026-10-27 (approved by Sehan)
check('tables: GFM table -> table/thead/tbody/tr/th/td without attributes (alignment dropped)', () => {
  const { html, warnings } = md('| Posisi | Kapasitas |\n|:---|---:|\n| Depan | **4,4 liter** |\n| [Belakang](/produk/side-bag-inzta-universal-motor) | 7 liter |');
  assert.deepStrictEqual(warnings, []);
  assert.ok(/<table>\s*<thead>\s*<tr>\s*<th>Posisi<\/th>/.test(html), html);
  assert.ok(html.includes('<td><strong>4,4 liter</strong></td>'));
  assert.ok(html.includes('<td><a href="/produk/side-bag-inzta-universal-motor">Belakang</a></td>'));
  assert.ok(!/align=|style=/.test(html), html);
  assertAllowlisted(html);
});
check('tables: attacks inside cells (raw HTML, javascript: link, image) are neutralised', () => {
  const src = '| A | B |\n|---|---|\n| <img src=x onerror=alert(1)> | [x](javascript:alert(1)) |\n| <script>alert(1)</script> | ![a](https://evil.example/a.jpg) |';
  const { html, warnings } = md(src);
  assert.ok(!/onerror|<script|javascript:|evil\.example|<img/i.test(html), html);
  assert.ok(warnings.some(w => w.kind === 'raw-html') && warnings.some(w => w.kind === 'image-host'));
  assertAllowlisted(html);
});
check('caption (Markdown title) -> figcaption, quotes and markup escaped', () => {
  const { html } = md(`![Alt "kutip" & <b>](${CLD} "Foto: \\"Tim\\" & <i>INZTA</i>")`);
  assert.ok(html.includes('<figcaption>Foto: "Tim" &amp; &lt;i&gt;INZTA&lt;/i&gt;</figcaption>'), html);
  assert.ok(html.includes('alt="Alt &quot;kutip&quot; &amp; &lt;b&gt;"'), html);
  assertAllowlisted(html);
});
check('image hosts: other cloud, http, lookalike host, query-string trick, path traversal -> dropped with warning', () => {
  const bad = [
    'https://res.cloudinary.com/other/image/upload/a.jpg',
    'http://res.cloudinary.com/dukddlp0b/image/upload/a.jpg',
    'https://res.cloudinary.com.evil.example/dukddlp0b/a.jpg',
    'https://evil.example/x.jpg?u=https://res.cloudinary.com/dukddlp0b/a.jpg',
    'https://res.cloudinary.com/dukddlp0b/../other/image/upload/a.jpg',
    'https://res.cloudinary.com/dukddlp0b/%2e%2e/other/image/upload/a.jpg',
    '//res.cloudinary.com/dukddlp0b/a.jpg',
    'data:image/png;base64,iVBORw0KGgo=',
  ];
  for (const url of bad) {
    const { html, warnings } = md(`![x](${url})`);
    assert.ok(!/<img/.test(html), `${url} -> ${html}`);
    assert.strictEqual(warnings.length, 1, url);
    assert.strictEqual(warnings[0].kind, 'image-host', url);
  }
});
check('placeholders: local ../images/K-03/<file> (ADR-0013) and GAMBAR-N -> dropped with placeholder warning', () => {
  const { html, warnings } = md('![Tank bag TK5 di tangki](../images/K-03/tk5-tangki-1.jpg)\n\n![Foto touring](GAMBAR-2 "nanti")');
  assert.ok(!/<img|<figure/.test(html), html);
  assert.deepStrictEqual(warnings.map(w => [w.kind, w.src, w.alt]), [
    ['placeholder', '../images/K-03/tk5-tangki-1.jpg', 'Tank bag TK5 di tangki'],
    ['placeholder', 'GAMBAR-2', 'Foto touring'],
  ]);
});
check('inline image mixed with text, in a list, or in a link -> dropped with inline-image warning', () => {
  const { html, warnings } = md(`Lihat ![a](${CLD}) ini.\n\n- ![b](${CLD})\n\n[![c](${CLD})](/produk)`);
  assert.ok(!/<img/.test(html), html);
  assert.deepStrictEqual(warnings.map(w => w.kind), ['inline-image', 'inline-image', 'inline-image']);
  assert.ok(html.includes('Lihat') && html.includes('ini.'));
});

// Plain (legacy) articles
check('plain: every non-empty line is one escaped <p>, no Markdown, no HTML', () => {
  const { html, warnings } = renderArticle({ content: 'Baris satu\n\n## bukan heading\r\n<script>alert(1)</script>\n  **tidak tebal**  ', contentFormat: 'plain' });
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(html, '<p>Baris satu</p>\n<p>## bukan heading</p>\n<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n<p>**tidak tebal**</p>');
});
check('missing contentFormat means plain (legacy documents)', () => {
  assert.strictEqual(renderArticle({ content: '## a' }).html, '<p>## a</p>');
});
check('empty and missing content render nothing', () => {
  for (const c of ['', '   \n\n', null, undefined]) {
    assert.strictEqual(renderArticle({ content: c, contentFormat: 'markdown' }).html.trim(), '');
    assert.strictEqual(renderArticle({ content: c }).html, '');
  }
});
check('a 50,000-character body renders in under a second', () => {
  const para = 'Tas motor untuk touring dengan **bahan tahan air** dan [link](/produk). ';
  const body = Array.from({ length: 700 }, (_, i) => (i % 10 === 0 ? `## Bagian ${i}\n\n` : '') + para).join('\n\n').slice(0, 50000);
  const t = Date.now();
  const { html } = md(body);
  assert.ok(Date.now() - t < 1000, `${Date.now() - t} ms`);
  assert.ok(count(html, /<h2>/g) > 50);
});

check('deep nesting that overflows marked returns a render-error warning instead of throwing, and blocks publishing', () => {
  const quietErr = console.error; console.error = () => {};
  try {
    for (const src of ['> '.repeat(5000) + 'x', '- '.repeat(5000) + 'x']) {
      const r = md(src);
      assert.strictEqual(r.html, '');
      assert.deepStrictEqual(r.warnings, [{ kind: 'render-error' }]);
    }
    const failedIds = runChecklist({ title: 't', slug: 's', excerpt: 'e', content: '> '.repeat(5000), contentFormat: 'markdown' }, { renderWarnings: [{ kind: 'render-error' }] }).blocking.filter(c => !c.ok).map(c => c.id);
    assert.ok(failedIds.includes('C-4'), failedIds.join());
  } finally { console.error = quietErr; }
});

// Real naskah from the article pipeline
const fixture = (name) => fs.readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8');
check('K-06 "Naskah": 4 figures, no h1, no raw Markdown, /produk link kept, no warnings', () => {
  const { html, warnings } = md(fixture('K-06-naskah.md'));
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(count(html, /<figure>/g), 4);
  assert.strictEqual(count(html, /<h1/g), 0);
  assert.ok(count(html, /<h2>/g) >= 7);
  assert.ok(html.includes('<a href="/produk">'));
  assert.ok(!/(^|\s)##\s|\*\*|!\[/.test(html.replace(/<[^>]+>/g, ' ')), 'raw Markdown left in text');
  assertAllowlisted(html);
});
check('K-02 "Naskah": h2 and h3, 4 figures, product links, lists, no h1, no raw Markdown', () => {
  const { html, warnings } = md(fixture('K-02-naskah.md'));
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(count(html, /<figure>/g), 4);
  assert.strictEqual(count(html, /<h1/g), 0);
  assert.ok(count(html, /<h2>/g) >= 6 && count(html, /<h3>/g) >= 2);
  assert.ok(html.includes('<a href="/produk/side-bag-inzta-xsr-155">'));
  assert.ok(/<ol>/.test(html));
  // Both K-02 comparison tables render as tables, not as run-together text (amendment 2026-10-27).
  assert.strictEqual(count(html, /<table>/g), 2);
  assert.ok(html.includes('<th>Posisi</th>') && !/\|---/.test(html));
  assert.ok(!/(^|\s)##\s|\*\*|!\[/.test(html.replace(/<[^>]+>/g, ' ')), 'raw Markdown left in text');
  assertAllowlisted(html);
});
// F-013 requirement 7.2: renderArticle() output for both naskah stays byte-identical to the snapshots
// captured from the renderer before F-013 changed it (task A2).
for (const name of ['K-02-naskah', 'K-06-naskah']) {
  const snapshot = path.join(ROOT, 'tests/fixtures', `${name}.html`);
  if (WRITE_SNAPSHOTS) fs.writeFileSync(snapshot, md(fixture(`${name}.md`)).html);
  check(`F-013 snapshot: ${name}.md renders byte-identical to ${name}.html`, () => {
    assert.ok(fs.existsSync(snapshot), `missing ${snapshot}; run once with --write-snapshots on the unchanged renderer`);
    assert.strictEqual(md(fixture(`${name}.md`)).html, fs.readFileSync(snapshot, 'utf8'));
  });
}

// Helpers used by the editor and the checklist
check('extractBodyImages: kinds, alt, caption, line, file name; skips fenced code', () => {
  const content = `Intro\n\n![Satu](${CLD} "Cap 1")\n\n\`\`\`\n![kode](${CLD})\n\`\`\`\n\n![Dua \\] x](../images/K-03/tk5.jpg)\n\n![](https://evil.example/a.png)`;
  const imgs = fmt.extractBodyImages(content);
  assert.deepStrictEqual(imgs.map(i => [i.kind, i.alt, i.caption, i.line, i.fileName]), [
    ['allowed', 'Satu', 'Cap 1', 3, 'foto.jpg'],
    ['placeholder', 'Dua ] x', '', 9, 'tk5.jpg'],
    ['foreign', '', '', 11, 'a.png'],
  ]);
  assert.strictEqual(content.slice(imgs[1].start, imgs[1].end), imgs[1].raw);
});
check('escapeAlt and escapeCaption round-trip through renderArticle()', () => {
  const alt = 'Tas [baru] \\ "XSR"\nbaris';
  const caption = 'Kata "kutip" \\ dan ]';
  const { html } = md(fmt.imageMarkdown(CLD, alt, caption));
  assert.ok(html.includes('alt="Tas [baru] \\ &quot;XSR&quot; baris"'), html);
  assert.ok(html.includes('<figcaption>Kata "kutip" \\ dan ]</figcaption>'), html);
  const [img] = fmt.extractBodyImages(fmt.imageMarkdown(CLD, alt, caption));
  assert.deepStrictEqual([img.alt, img.caption], ['Tas [baru] \\ "XSR" baris', 'Kata "kutip" \\ dan ]']);
});
check('hasH1: "# x" outside code only; "##", "#tag", and fenced "# x" do not count', () => {
  assert.strictEqual(fmt.hasH1('# Judul'), true);
  assert.strictEqual(fmt.hasH1('teks\n   # Judul'), true);
  assert.strictEqual(fmt.hasH1('## a\n#Gasber16\n```\n# komentar\n```'), false);
});
check('legacy defaults: statusOf, formatOf, isEverPublished, publicDate', () => {
  assert.strictEqual(fmt.statusOf({}), 'published');
  assert.strictEqual(fmt.formatOf({}), 'plain');
  assert.strictEqual(fmt.isEverPublished({}), true);
  assert.strictEqual(fmt.isEverPublished({ status: 'draft' }), false);
  assert.strictEqual(fmt.isEverPublished({ status: 'draft', publishedAt: '2026-10-01' }), true);
  assert.strictEqual(fmt.publicDate({ publishedAt: 2, createdAt: 1 }), 2);
  assert.strictEqual(fmt.publicDate({ publishedAt: null, createdAt: 1 }), 1);
});
check('firstLineSummary: skips headings and images, strips Markdown, cuts near 160 at a word', () => {
  const s = fmt.firstLineSummary(`## Judul\n\n![a](${CLD})\n\nTas **samping** untuk [XSR 155](/produk) ${'kata '.repeat(60)}`);
  assert.ok(s.startsWith('Tas samping untuk XSR 155 kata'));
  assert.ok(s.length <= 161 && s.endsWith('…'));
});

// Checklist (requirement 10)
const ok = {
  title: 'Tas samping XSR 155', slug: 'tas-samping-xsr-155', excerpt: 'Ringkasan', content: `## A\n\n![Alt](${CLD})`,
  contentFormat: 'markdown', coverImage: CLD, coverAlt: 'Sampul', metaTitle: 'x'.repeat(60), metaDescription: 'y'.repeat(155),
};
const failed = (r) => r.blocking.filter(c => !c.ok).map(c => c.id);
const warned = (r) => r.warnings.filter(c => !c.ok).map(c => c.id);
check('checklist: a complete markdown article passes every check', () => {
  const r = runChecklist(ok, { coverWidth: 1200 });
  assert.deepStrictEqual(failed(r), []);
  assert.deepStrictEqual(warned(r), []);
  assert.strictEqual(canPublish(r), true);
});
check('checklist: C-1 to C-8 each fail on their own case', () => {
  const cases = {
    'C-1': { title: ' ' }, 'C-2': { slug: 'Bad_Slug' }, 'C-3': { excerpt: '' }, 'C-4': { content: '' },
    'C-5': { coverAlt: '' }, 'C-6': { content: `![](${CLD})` }, 'C-7': { content: '![Alt](../images/K-03/a.jpg)' }, 'C-8': { content: '# H1' },
  };
  for (const [id, patch] of Object.entries(cases)) {
    const f = failed(runChecklist({ ...ok, ...patch }));
    assert.ok(f.includes(id), `${id}: ${f}`);
    assert.strictEqual(canPublish(runChecklist({ ...ok, ...patch })), false);
  }
  assert.ok(failed(runChecklist({ ...ok, slug: 'baru' })).includes('C-2'));
  assert.ok(failed(runChecklist({ ...ok, title: 'x'.repeat(151) })).includes('C-1'));
  assert.ok(failed(runChecklist({ ...ok, coverImage: 'https://evil.example/a.jpg' })).includes('C-5'));
  assert.ok(failed(runChecklist({ ...ok, content: '![Alt](https://evil.example/a.jpg)' })).includes('C-6'));
});
check('checklist: renderer warnings block even when the regex finds nothing', () => {
  assert.ok(failed(runChecklist(ok, { renderWarnings: [{ kind: 'inline-image', src: CLD, alt: 'a' }] })).includes('C-6'));
  assert.ok(failed(runChecklist(ok, { renderWarnings: [{ kind: 'placeholder', src: 'GAMBAR-1', alt: 'a' }] })).includes('C-7'));
  assert.deepStrictEqual(failed(runChecklist(ok, { renderWarnings: [{ kind: 'raw-html' }] })), []);
});
check('checklist: W-1 to W-4 are warnings at 61/156 characters and under 1200 px, never blocking (ADR-0014)', () => {
  const r = runChecklist({ ...ok, metaTitle: 'x'.repeat(61), metaDescription: 'y'.repeat(156) }, { coverWidth: 800 });
  assert.deepStrictEqual(warned(r), ['W-1', 'W-2', 'W-4']);
  assert.strictEqual(canPublish(r), true);
  assert.deepStrictEqual(warned(runChecklist({ ...ok, metaDescription: '' })), ['W-3']);
  assert.ok(!runChecklist(ok).warnings.some(w => w.id === 'W-4'), 'W-4 only when the editor knows the width');
});
check('checklist: legacy plain article runs only C-1 to C-3', () => {
  const r = runChecklist({ title: 'K-06', slug: 'gasber-16', excerpt: 'x', content: '# bukan masalah\n![](GAMBAR-1)' });
  assert.deepStrictEqual(r.blocking.map(c => c.id), ['C-1', 'C-2', 'C-3']);
  assert.strictEqual(canPublish(r), true);
  assert.ok(failed(runChecklist({ title: 'K-06', slug: 'gasber-16', excerpt: '', content: 'x' })).includes('C-3'));
});
check('checklist: legacy slug passes C-2 only for an existing document', () => {
  assert.ok(failed(runChecklist({ ...ok, slug: 'Legacy_Slug' })).includes('C-2'));
  assert.ok(!failed(runChecklist({ ...ok, slug: 'Legacy_Slug' }, { legacySlugOk: true })).includes('C-2'));
});

for (const [s, n] of results) console.log(`${s}  ${n}`);
const failedCount = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failedCount}/${results.length} passed`);
process.exit(failedCount ? 1 : 0);
