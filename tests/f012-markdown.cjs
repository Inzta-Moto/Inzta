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
// Every tag and attribute in the output must be on the allowlist of requirement 4.3 / 4.10, amended by
// F-013 3.5 / 8.3: `class` on <figure> only, and only with the five image-layout classes.
const ALLOWED = { h2: [], h3: [], p: [], ul: [], ol: [], li: [], strong: [], em: [], br: [], figure: ['class'], figcaption: [], table: [], thead: [], tbody: [], tr: [], th: [], td: ['data-label'], a: ['href', 'rel', 'target'], img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'decoding'] };
const FIGURE_CLASS_SET = ['article-figure--kiri', 'article-figure--kanan', 'article-figure--kecil', 'article-figure--sedang', 'article-figure--besar'];
function assertAllowlisted(html) {
  for (const m of html.matchAll(/<([a-zA-Z0-9]+)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    assert.ok(tag in ALLOWED, `tag <${tag}> not allowed in: ${html.slice(0, 200)}`);
    for (const a of m[2].matchAll(/([a-zA-Z-:]+)=/g)) assert.ok(ALLOWED[tag].includes(a[1].toLowerCase()), `attribute ${a[1]} on <${tag}>`);
    if (tag === 'figure') {
      for (const c of m[2].matchAll(/\bclass="([^"]*)"/gi)) {
        const values = c[1].split(/\s+/).filter(Boolean);
        assert.ok(values.length > 0, `empty class on <figure>`);
        for (const v of values) assert.ok(FIGURE_CLASS_SET.includes(v), `class ${v} on <figure>`);
      }
    }
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
// F-013 review SEC-01: after an inline raw <pre>/<code>/<kbd>/<script>, marked emits the following text
// unescaped, so an unclosed tag fragment there used to reach the sanitizer as a real tag.
check('text after an inline raw tag is escaped: no <figure>/<h2> from an unclosed fragment (review SEC-01)', () => {
  const cases = [
    ['x <pre> <figure class="article-figure--kiri evil" style="float:left"', '&lt;figure class="article-figure--kiri evil" style="float:left"'],
    ['x <code> <h2', '&lt;h2'],
    ['x <script> <figure class="article-figure--kanan"', '&lt;figure class="article-figure--kanan"'],
    ['- a <kbd> <h2\n- b', '&lt;h2'],
    ['| A |\n|---|\n| x <pre> <figure class="article-figure--kiri" |', '&lt;figure class="article-figure--kiri"'],
  ];
  for (const [src, shown] of cases) {
    const { html, warnings } = md(src);
    assert.ok(!/<figure|<h2/i.test(html), `${JSON.stringify(src)} -> ${html}`);
    assert.ok(html.includes(shown), `text must stay visible, escaped: ${JSON.stringify(src)} -> ${html}`);
    assert.ok(warnings.some(w => w.kind === 'raw-html'), JSON.stringify(src));
    assertAllowlisted(html);
  }
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
check('tables: GFM table -> table/thead/tbody/tr/th/td, alignment dropped, body cells carry their column heading (F-013 4.10)', () => {
  const { html, warnings } = md('| Posisi | Kapasitas |\n|:---|---:|\n| Depan | **4,4 liter** |\n| [Belakang](/produk/side-bag-inzta-universal-motor) | 7 liter |');
  assert.deepStrictEqual(warnings, []);
  assert.ok(/<table>\s*<thead>\s*<tr>\s*<th>Posisi<\/th>/.test(html), html);
  assert.ok(html.includes('<td data-label="Kapasitas"><strong>4,4 liter</strong></td>'), html);
  assert.ok(html.includes('<td data-label="Posisi"><a href="/produk/side-bag-inzta-universal-motor">Belakang</a></td>'), html);
  assert.ok(!/<th [^>]*data-label/.test(html), html);
  assert.ok(!/align=|style=/.test(html), html);
  assertAllowlisted(html);
});
check('F-013 4.10: data-label is plain escaped text; formatting, quotes, and attack headings cannot break out', () => {
  const { html } = md('| **Tebal** [link](/x) | "kutip" <b>x</b> | `k` "><img src=x onerror=alert(1)> |\n|---|---|---|\n| 1 | 2 | 3 |\n\n| | B |\n|---|---|\n| tanpa judul | 2 |');
  assert.ok(html.includes('<td data-label="Tebal link">1</td>'), html);
  assert.ok(html.includes('<td data-label="&quot;kutip&quot; x">2</td>'), html);
  assert.ok(html.includes('<td data-label="k &quot;&gt;">3</td>'), html);
  assert.ok(!/onerror|<img|<b>/i.test(html), html);
  assert.ok(html.includes('<td>tanpa judul</td>'), 'empty heading writes no data-label: ' + html);
  assertAllowlisted(html);
});
check('F-013 4.10: the sanitizer keeps data-label on td only, and no other data-* attribute', () => {
  const { sanitizeArticleHtml } = require(path.join(ROOT, 'lib/markdown.ts'));
  const out = sanitizeArticleHtml('<table><tbody><tr><td data-label="A" data-x="1" class="c">1</td></tr></tbody></table><p data-label="p">x</p><th data-label="h">h</th>');
  assert.ok(out.includes('<td data-label="A">1</td>'), out);
  assert.ok(!/data-x|class=|<p data-label/.test(out), out);
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

// F-013 pure helpers (requirements 2.1–2.7, 3.8, 5.9, 8.2)
const POS = ['kiri', 'tengah', 'kanan'];
const UK = ['kecil', 'sedang', 'besar', 'penuh'];
const layoutOf = (block) => fmt.resolveLayout(fmt.parseImageAttrs(block));
// Rows of the resolution table in design.md ("Attribute syntax"): block content -> [posisi, ukuran, classes].
const RESOLUTION = [
  ['', 'tengah', 'penuh', []],
  ['posisi=kanan ukuran=sedang', 'kanan', 'sedang', ['article-figure--kanan', 'article-figure--sedang']],
  ['posisi=kiri ukuran=kecil', 'kiri', 'kecil', ['article-figure--kiri', 'article-figure--kecil']],
  ['posisi=tengah ukuran=besar', 'tengah', 'besar', ['article-figure--besar']],
  ['posisi=kiri', 'kiri', 'sedang', ['article-figure--kiri', 'article-figure--sedang']],
  ['ukuran=kecil', 'tengah', 'kecil', ['article-figure--kecil']],
  ['posisi=kanan ukuran=penuh', 'tengah', 'penuh', []],
  ['Posisi=KANAN  ukuran=Sedang', 'kanan', 'sedang', ['article-figure--kanan', 'article-figure--sedang']],
  ['\tposisi=kanan\tukuran=kecil ', 'kanan', 'kecil', ['article-figure--kanan', 'article-figure--kecil']],
  ['posisi=atas lebar=300 .kelas #id', 'tengah', 'penuh', []],
  ['posisi="kanan"', 'tengah', 'penuh', []],
  ["posisi='kanan' ukuran=\"kecil\"", 'tengah', 'penuh', []],
  ['posisi=kiri posisi=kanan', 'kanan', 'sedang', ['article-figure--kanan', 'article-figure--sedang']],
  ['posisi=kanan posisi=atas', 'kanan', 'sedang', ['article-figure--kanan', 'article-figure--sedang']],
  ['posisi kanan =kiri ukuran= ukuran', 'tengah', 'penuh', []],
  ['posisi=*kanan*', 'tengah', 'penuh', []],
  ['class=x style=color:red onerror=alert(1) id=y', 'tengah', 'penuh', []],
  ['posisi=kanan" onload="x', 'tengah', 'penuh', []],
];
check('F-013 helpers: resolution table (defaults, penuh rule, case, spaces, unknown, quoted, repeated, attack items)', () => {
  for (const [block, posisi, ukuran, classes] of RESOLUTION) {
    const l = layoutOf(block);
    assert.deepStrictEqual(l, { posisi, ukuran }, `{${block}}`);
    assert.deepStrictEqual(fmt.layoutClasses(l), classes, `{${block}}`);
    for (const c of fmt.layoutClasses(l)) assert.ok(fmt.FIGURE_CLASSES.includes(c), c);
  }
  assert.deepStrictEqual(fmt.parseImageAttrs('posisi=atas ukuran=besar'), { ukuran: 'besar' });
  assert.deepStrictEqual(fmt.resolveLayout({ posisi: 'atas', ukuran: 'x' }), fmt.DEFAULT_LAYOUT, 'runtime values outside the lists');
  assert.deepStrictEqual(fmt.resolveLayout(undefined), fmt.DEFAULT_LAYOUT);
  assert.deepStrictEqual(fmt.DEFAULT_LAYOUT, { posisi: 'tengah', ukuran: 'penuh' });
  assert.deepStrictEqual([...fmt.FIGURE_CLASSES], ['article-figure--kiri', 'article-figure--kanan', 'article-figure--kecil', 'article-figure--sedang', 'article-figure--besar']);
});
check('F-013 helpers: ATTR_BLOCK_RE accepts spaces or tabs before "{", not a line break or nested braces', () => {
  assert.strictEqual(fmt.ATTR_BLOCK_RE.exec('{posisi=kiri} lanjut')[1], 'posisi=kiri');
  assert.strictEqual(fmt.ATTR_BLOCK_RE.exec(' \t{posisi=kiri}')[1], 'posisi=kiri');
  assert.strictEqual(fmt.ATTR_BLOCK_RE.exec('{}')[1], '');
  for (const t of ['\n{posisi=kiri}', 'x{posisi=kiri}', '{posisi=\nkiri}', '{a{b}}', '{posisi=kiri']) assert.strictEqual(fmt.ATTR_BLOCK_RE.exec(t), null, JSON.stringify(t));
});
check('F-013 helpers: canonical block, classes, and sizes per layout', () => {
  assert.strictEqual(fmt.layoutBlock(fmt.DEFAULT_LAYOUT), '');
  assert.strictEqual(fmt.layoutBlock({ posisi: 'kanan', ukuran: 'sedang' }), '{posisi=kanan ukuran=sedang}');
  assert.strictEqual(fmt.layoutBlock({ posisi: 'tengah', ukuran: 'besar' }), '{posisi=tengah ukuran=besar}');
  assert.strictEqual(fmt.layoutBlock({ posisi: 'kiri', ukuran: 'penuh' }), '', 'penuh never floats, so it is the default');
  assert.deepStrictEqual(UK.map(u => fmt.layoutSizes({ posisi: 'tengah', ukuran: u })), [
    '(max-width: 767px) 100vw, 240px', '(max-width: 767px) 100vw, 364px', '(max-width: 767px) 100vw, 546px', '(max-width: 768px) 100vw, 720px',
  ]);
  assert.strictEqual(fmt.layoutSizes(fmt.DEFAULT_LAYOUT), '(max-width: 768px) 100vw, 720px');
});
check('F-013 helpers: imageMarkdown() writes the canonical block, none for the default or without a layout', () => {
  const url = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/xsr.jpg';
  assert.strictEqual(fmt.imageMarkdown(url, 'Tas samping XSR 155', 'Foto: INZTA', { posisi: 'kanan', ukuran: 'sedang' }),
    `![Tas samping XSR 155](${url} "Foto: INZTA"){posisi=kanan ukuran=sedang}`);
  assert.strictEqual(fmt.imageMarkdown(url, 'a', '', { posisi: 'kiri', ukuran: 'kecil' }), `![a](${url}){posisi=kiri ukuran=kecil}`);
  assert.strictEqual(fmt.imageMarkdown(url, 'a', 'c', fmt.DEFAULT_LAYOUT), `![a](${url} "c")`);
  assert.strictEqual(fmt.imageMarkdown(url, 'a', 'c'), `![a](${url} "c")`);
  assert.strictEqual(fmt.imageMarkdown(url, ''), `![](${url})`, '"Ubah ke Markdown" gallery images: no block (5.9)');
});
check('F-013 helpers: parse -> serialize -> parse is stable for all 12 posisi x ukuran combinations', () => {
  let n = 0;
  for (const posisi of POS) for (const ukuran of UK) {
    const first = fmt.resolveLayout({ posisi, ukuran });
    const block = fmt.layoutBlock(first);
    const second = layoutOf(block.slice(1, -1));
    assert.deepStrictEqual(second, first, `${posisi}/${ukuran}`);
    assert.strictEqual(fmt.layoutBlock(second), block, `${posisi}/${ukuran}`);
    const markdown = fmt.imageMarkdown(CLD, 'Alt', 'Cap', first);
    const [img] = fmt.extractBodyImages(markdown);
    assert.deepStrictEqual([img.raw, img.layout, img.alt, img.caption], [markdown, first, 'Alt', 'Cap'], `${posisi}/${ukuran}`);
    assert.strictEqual(fmt.imageMarkdown(img.url, img.alt, img.caption, img.layout), markdown, `${posisi}/${ukuran}`);
    n++;
  }
  assert.strictEqual(n, 12);
});
check('F-013 helpers: extractBodyImages includes the block in raw and offsets and resolves the layout', () => {
  const a = `![Satu](${CLD} "Cap 1"){posisi=kanan ukuran=sedang}`;
  const b = `![Dua](../images/K-03/tk5.jpg) \t{Posisi=KIRI}`;
  const c = `![Tiga](${CLD})\n{posisi=kiri}`;
  const content = `Intro\n\n${a}\n\n\`\`\`\n![kode](${CLD}){posisi=kiri}\n\`\`\`\n\n${b}\n\n${c}\n\nTeks ![Empat](${CLD}){ukuran=kecil} lanjut`;
  const imgs = fmt.extractBodyImages(content);
  assert.deepStrictEqual(imgs.map(i => [i.kind, i.alt, i.caption, i.line, i.layout.posisi, i.layout.ukuran]), [
    ['allowed', 'Satu', 'Cap 1', 3, 'kanan', 'sedang'],
    ['placeholder', 'Dua', '', 9, 'kiri', 'sedang'],
    ['allowed', 'Tiga', '', 11, 'tengah', 'penuh'],
    ['allowed', 'Empat', '', 14, 'tengah', 'kecil'],
  ]);
  assert.deepStrictEqual(imgs.map(i => i.raw), [a, b, `![Tiga](${CLD})`, `![Empat](${CLD}){ukuran=kecil}`]);
  for (const i of imgs) assert.strictEqual(content.slice(i.start, i.end), i.raw);
  // Replacing raw swaps image and block together, so no old block stays behind (editor replaceImage()).
  const replaced = content.slice(0, imgs[0].start) + fmt.imageMarkdown(CLD, 'Satu', 'Cap 1') + content.slice(imgs[0].end);
  assert.ok(!replaced.includes('posisi=kanan'), replaced);
  assert.deepStrictEqual(fmt.extractBodyImages(replaced)[0].layout, fmt.DEFAULT_LAYOUT);
});
check('F-013 helpers: countWords and firstLineSummary ignore block contents', () => {
  const plain = `Tas samping untuk XSR.\n\n![Alt](${CLD} "Cap")`;
  const withBlock = `Tas samping untuk XSR.\n\n![Alt](${CLD} "Cap"){posisi=kanan ukuran=sedang}`;
  assert.strictEqual(fmt.countWords(withBlock), fmt.countWords(plain));
  assert.strictEqual(fmt.countWords(withBlock), 4);
  assert.strictEqual(fmt.firstLineSummary(`![a](${CLD}){posisi=kiri}\n\nIsi pertama.`), 'Isi pertama.');
  assert.strictEqual(fmt.firstLineSummary(`Lihat ![a](${CLD}){posisi=kiri ukuran=kecil} foto ini.`), 'Lihat  foto ini.');
});
check('F-013 helpers: changeLayout() couples Posisi and Ukuran as the image dialog does (5.2)', () => {
  const L = (posisi, ukuran) => ({ posisi, ukuran });
  // Kiri or Kanan while Penuh -> Sedang; Tengah keeps Penuh.
  assert.deepStrictEqual(fmt.changeLayout(fmt.DEFAULT_LAYOUT, { posisi: 'kiri' }), L('kiri', 'sedang'));
  assert.deepStrictEqual(fmt.changeLayout(fmt.DEFAULT_LAYOUT, { posisi: 'kanan' }), L('kanan', 'sedang'));
  assert.deepStrictEqual(fmt.changeLayout(fmt.DEFAULT_LAYOUT, { posisi: 'tengah' }), L('tengah', 'penuh'));
  // Another size is kept when the position changes.
  assert.deepStrictEqual(fmt.changeLayout(L('tengah', 'kecil'), { posisi: 'kanan' }), L('kanan', 'kecil'));
  assert.deepStrictEqual(fmt.changeLayout(L('kiri', 'besar'), { posisi: 'kanan' }), L('kanan', 'besar'));
  assert.deepStrictEqual(fmt.changeLayout(L('kanan', 'sedang'), { posisi: 'tengah' }), L('tengah', 'sedang'));
  // Penuh -> Tengah; other sizes keep the position.
  assert.deepStrictEqual(fmt.changeLayout(L('kanan', 'sedang'), { ukuran: 'penuh' }), L('tengah', 'penuh'));
  assert.deepStrictEqual(fmt.changeLayout(L('kiri', 'kecil'), { ukuran: 'penuh' }), L('tengah', 'penuh'));
  assert.deepStrictEqual(fmt.changeLayout(L('kiri', 'sedang'), { ukuran: 'besar' }), L('kiri', 'besar'));
  assert.deepStrictEqual(fmt.changeLayout(fmt.DEFAULT_LAYOUT, { ukuran: 'kecil' }), L('tengah', 'kecil'));
  // Every reachable state is a resolved layout, so the editor writes it back unchanged.
  for (const posisi of POS) for (const ukuran of UK) {
    const start = fmt.resolveLayout({ posisi, ukuran });
    for (const p of POS) {
      const next = fmt.changeLayout(start, { posisi: p });
      assert.strictEqual(next.posisi, p, `${posisi}/${ukuran} -> posisi ${p}`);
      assert.deepStrictEqual(fmt.resolveLayout(next), next);
    }
    for (const u of UK) {
      const next = fmt.changeLayout(start, { ukuran: u });
      assert.strictEqual(next.ukuran, u, `${posisi}/${ukuran} -> ukuran ${u}`);
      assert.deepStrictEqual(fmt.resolveLayout(next), next);
    }
  }
  // Values outside the lists change nothing; the shared default is not mutated.
  assert.deepStrictEqual(fmt.changeLayout(L('kanan', 'kecil'), { posisi: 'atas', ukuran: 'x' }), L('kanan', 'kecil'));
  assert.deepStrictEqual(fmt.DEFAULT_LAYOUT, { posisi: 'tengah', ukuran: 'penuh' });
});
check('F-013 helpers: placeholder upload keeps alt, caption, and layout, written canonically (5.4, 5.5)', () => {
  // The editor's path, without React: extractBodyImages() -> dialog initial.layout -> upload -> imageMarkdown()
  // with the dialog layout -> replaceImage() swaps exactly `raw` (block included).
  const upload = (content, img, url) => {
    assert.strictEqual(content.slice(img.start, img.end), img.raw);
    const layout = fmt.resolveLayout(img.layout ?? fmt.DEFAULT_LAYOUT); // ImageDialog's initial state
    return content.slice(0, img.start) + fmt.imageMarkdown(url, img.alt, img.caption, layout) + content.slice(img.end);
  };
  const cases = [
    ['{posisi=kiri ukuran=kecil}', '{posisi=kiri ukuran=kecil}', { posisi: 'kiri', ukuran: 'kecil' }],
    [' {Posisi=KANAN  lebar=300 ukuran=Besar}', '{posisi=kanan ukuran=besar}', { posisi: 'kanan', ukuran: 'besar' }],
    ['{posisi=kanan}', '{posisi=kanan ukuran=sedang}', { posisi: 'kanan', ukuran: 'sedang' }],
    ['', '', fmt.DEFAULT_LAYOUT],
    ['{posisi=kanan ukuran=penuh}', '', fmt.DEFAULT_LAYOUT],
  ];
  for (const [block, canonical, layout] of cases) {
    const content = `Intro TK5.\n\n![Tank bag TK5 di tangki NMAX](../images/K-03/tk5.jpg "Foto: INZTA")${block}\n\nPenutup.`;
    const [before] = fmt.extractBodyImages(content);
    assert.deepStrictEqual([before.kind, before.fileName, before.layout], ['placeholder', 'tk5.jpg', layout], block);
    assert.deepStrictEqual(md(content).warnings.map(w => w.kind), ['placeholder'], block);
    const after = upload(content, before, CLD);
    assert.strictEqual(after, `Intro TK5.\n\n![Tank bag TK5 di tangki NMAX](${CLD} "Foto: INZTA")${canonical}\n\nPenutup.`, block);
    const [img] = fmt.extractBodyImages(after);
    assert.deepStrictEqual([img.kind, img.alt, img.caption, img.layout], ['allowed', 'Tank bag TK5 di tangki NMAX', 'Foto: INZTA', layout], block);
    const out = md(after);
    assert.deepStrictEqual(out.warnings, [], block);
    const cls = fmt.layoutClasses(layout);
    assert.ok(out.html.includes(cls.length ? `<figure class="${cls.join(' ')}">` : '<figure><img'), `${block}: ${out.html}`);
    assert.ok(!out.html.includes('{'), block);
  }
});
// F-013 review ERR-01 (insertionPoint) moved to the visual editor in phase B: an image is a node there, so a caret
// cannot be inside one (requirement 9.6, checked in the browser).

// Checklist (requirement 10). The cover differs from the body image so W-6 (F-013 A2) stays quiet.
const COVER = CLD.replace(/\.jpg$/, '-sampul.jpg');
const ok = {
  title: 'Tas samping XSR 155', slug: 'tas-samping-xsr-155', excerpt: 'Ringkasan', content: `## A\n\n![Alt](${CLD})`,
  contentFormat: 'markdown', coverImage: COVER, coverAlt: 'Sampul', metaTitle: 'x'.repeat(60), metaDescription: 'y'.repeat(155),
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
check('checklist W-6 (F-013 A2): cover also in the body warns while showCover is on or missing, never blocks', () => {
  const twice = { ...ok, coverImage: CLD };
  assert.deepStrictEqual(warned(runChecklist(twice)), ['W-6']);
  assert.deepStrictEqual(warned(runChecklist({ ...twice, showCover: true })), ['W-6']);
  assert.strictEqual(canPublish(runChecklist(twice)), true);
  assert.match(runChecklist(twice).warnings.find(w => w.id === 'W-6').detail, /Tampilkan sampul di halaman artikel/);
  assert.deepStrictEqual(warned(runChecklist({ ...twice, showCover: false })), [], 'cover hidden on the page');
  assert.deepStrictEqual(warned(runChecklist(ok)), [], 'different URLs');
  assert.ok(!runChecklist({ ...twice, showCover: false }).warnings.some(w => w.id === 'W-6'), 'not listed when the cover is hidden');
  assert.ok(!runChecklist({ ...twice, contentFormat: 'plain' }).warnings.some(w => w.id === 'W-6'), 'plain articles have no W-6');
  assert.ok(!runChecklist({ ...twice, coverImage: '' }).warnings.some(w => w.id === 'W-6'), 'no cover, no W-6');
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

// F-013 renderer and sanitizer (requirements 2.8, 2.9, 3.1–3.7, 7.4, 8.1, 8.3)
const figureOf = (html) => (html.match(/<figure[^>]*>/) || [''])[0];
const sizesOf = (html) => (html.match(/ sizes="([^"]*)"/) || [, ''])[1];
// Review WEB-01 (amendment 3.4, 2026-10-28): kecil/sedang/besar use the 767 px phone breakpoint; penuh keeps F-012's string.
const SIZES_BY = { kecil: '(max-width: 767px) 100vw, 240px', sedang: '(max-width: 767px) 100vw, 364px', besar: '(max-width: 767px) 100vw, 546px', penuh: '(max-width: 768px) 100vw, 720px' };
check('F-013 render: all 12 posisi x ukuran combinations -> figure classes and sizes', () => {
  const plainFigure = md(`![Alt](${CLD} "Cap")`).html;
  let n = 0;
  for (const posisi of POS) for (const ukuran of UK) {
    const { html, warnings } = md(`![Alt](${CLD} "Cap"){posisi=${posisi} ukuran=${ukuran}}`);
    const l = fmt.resolveLayout({ posisi, ukuran });
    const classes = [l.posisi !== 'tengah' ? `article-figure--${l.posisi}` : '', l.ukuran !== 'penuh' ? `article-figure--${l.ukuran}` : ''].filter(Boolean);
    assert.deepStrictEqual(warnings, [], `${posisi}/${ukuran}`);
    assert.strictEqual(figureOf(html), classes.length ? `<figure class="${classes.join(' ')}">` : '<figure>', `${posisi}/${ukuran}: ${html}`);
    assert.strictEqual(sizesOf(html), SIZES_BY[l.ukuran], `${posisi}/${ukuran}`);
    assert.ok(!/[{}]|posisi|ukuran=/.test(html), `${posisi}/${ukuran}: ${html}`);
    assert.ok(html.includes('alt="Alt"') && html.includes('<figcaption>Cap</figcaption>'));
    // Apart from class and sizes, the figure is F-012's (3.3, 3.7).
    const normalised = html.replace(/ class="[^"]*"/, '').replace(/ sizes="[^"]*"/, ` sizes="${SIZES_BY.penuh}"`);
    assert.strictEqual(normalised, plainFigure, `${posisi}/${ukuran}`);
    if (l.ukuran === 'penuh') assert.strictEqual(html, plainFigure, `${posisi}/${ukuran} is the default layout`);
    assertAllowlisted(html);
    n++;
  }
  assert.strictEqual(n, 12);
});
check('F-013 render: resolution table rows -> classes; default and recognised-but-empty blocks give F-012 HTML', () => {
  const plain = md(`![Alt](${CLD})`).html;
  for (const [block, , , classes] of RESOLUTION) {
    if (/[*]/.test(block)) continue; // not a block for marked (2.9); covered by the malformed-block case
    for (const sep of ['', ' ', '\t']) {
      const { html, warnings } = md(`![Alt](${CLD})${sep}{${block}}`);
      assert.deepStrictEqual(warnings, [], `{${block}}`);
      assert.strictEqual(figureOf(html), classes.length ? `<figure class="${classes.join(' ')}">` : '<figure>', `{${block}} -> ${html}`);
      if (!classes.length) assert.strictEqual(html, plain, `{${block}}`);
      assert.ok(!/[{}]/.test(html), `{${block}} -> ${html}`);
      assertAllowlisted(html);
    }
  }
});
check('F-013 render: a block is stripped wherever the image is, and warnings stay as without it (2.8, 3.7)', () => {
  const B = '{posisi=kanan ukuran=kecil}';
  const cases = [
    ['placeholder', (b) => `![Tank bag](../images/K-03/tk5.jpg)${b}`],
    ['GAMBAR-N', (b) => `![Foto](GAMBAR-2 "nanti")${b}`],
    ['foreign host', (b) => `![x](https://evil.example/a.jpg)${b}`],
    ['inline with text', (b) => `Lihat ![a](${CLD})${b} ini.`],
    ['inline at paragraph end', (b) => `Lihat ini ![a](${CLD})${b}`],
    ['list item', (b) => `- ![b](${CLD})${b}\n- dua`],
    ['ordered list', (b) => `1. teks ![b](${CLD})${b} lanjut`],
    ['link', (b) => `[![c](${CLD})${b}](/produk)`],
    ['emphasis', (b) => `*![c](${CLD})${b}* teks`],
    ['heading', (b) => `## Judul ![c](${CLD})${b}`],
    ['table cell', (b) => `| A | B |\n|---|---|\n| ![a](${CLD})${b} | x |`],
    ['table header', (b) => `| ![a](${CLD})${b} | B |\n|---|---|\n| y | x |`],
    ['table cell with text', (b) => `| A |\n|---|\n| teks ![a](${CLD})${b} lanjut |`],
  ];
  for (const [name, build] of cases) {
    const without = md(build(''));
    const withBlock = md(build(B));
    assert.ok(!/[{}]|posisi|ukuran/.test(withBlock.html), `${name}: ${withBlock.html}`);
    assert.strictEqual(withBlock.html, without.html, name);
    assert.deepStrictEqual(withBlock.warnings, without.warnings, name);
    assert.ok(withBlock.warnings.length >= 1 && !/<img/.test(withBlock.html), `${name}: image must still be dropped`);
    assertAllowlisted(withBlock.html);
  }
});
check('F-013 render: malformed blocks are text and make the image inline-dropped with a warning (2.9)', () => {
  for (const src of [
    `![a](${CLD}){posisi=*kanan*}`,
    `![a](${CLD}){posisi=kiri_x ukuran=*besar*}`,
    `![a](${CLD})\n{posisi=kanan}`,
    `![a](${CLD}){posisi=kiri}\nbaris berikut`,
    `![a](${CLD}){posisi=kiri`,
  ]) {
    const { html, warnings } = md(src);
    assert.ok(!/<img|<figure/.test(html), `${JSON.stringify(src)} -> ${html}`);
    assert.deepStrictEqual(warnings.map(w => w.kind), ['inline-image'], JSON.stringify(src));
    assert.ok(!/class=/.test(html), html);
    assertAllowlisted(html);
  }
  // Text in braces that is not a block stays visible (it is ordinary text, not a layout).
  assert.ok(md(`![a](${CLD}){posisi=*kanan*}`).html.includes('{posisi=<em>kanan</em>}'));
  assert.ok(md(`![a](${CLD})\n{posisi=kanan}`).html.includes('{posisi=kanan}'));
  // The checklist blocks publishing on the renderer warning (C-6).
  const content = `## A\n\n![Alt](${CLD}){posisi=*kanan*}`;
  assert.ok(failed(runChecklist({ ...ok, content }, { renderWarnings: md(content).warnings })).includes('C-6'));
});
check('F-013 render: attack blocks never become attributes, classes, or styles', () => {
  const plain = md(`![Alt](${CLD})`).html;
  for (const block of [
    '{class=x}', '{.kelas}', '{#id}', '{style=color:red}', '{onerror=alert(1)}', '{onload=alert(1) posisi=kiri}',
    '{posisi=kanan" onload="x}', "{posisi=kanan' onload='x}", '{posisi=kanan><script>alert(1)</script>}', '{ukuran=kecil&quot; onload=x}',
    '{posisi=article-figure--kanan}', '{class=article-figure--kiri}',
  ]) {
    const { html } = md(`![Alt](${CLD})${block}`);
    assert.ok(!/onload|onerror|style=|<script|id=|kelas|class="(?!article-figure--)/i.test(html), `${block} -> ${html}`);
    assertAllowlisted(html);
    if (!/posisi=kiri\b/.test(block) && !/[<>]/.test(block)) assert.strictEqual(html, plain, block);
  }
  // A recognised item next to junk still works; the junk does not.
  assert.strictEqual(figureOf(md(`![Alt](${CLD}){onload=alert(1) posisi=kiri}`).html), '<figure class="article-figure--kiri article-figure--sedang">');
});
check('F-013 sanitizer alone: only the five classes, only on <figure>', () => {
  const { sanitizeArticleHtml } = require(path.join(ROOT, 'lib/markdown.ts'));
  assert.strictEqual(
    sanitizeArticleHtml(`<figure class="article-figure--kanan evil article-figure--sedang" style="x" id="y"><img class="article-figure--kanan" src="${CLD}" alt="a"></figure>`),
    `<figure class="article-figure--kanan article-figure--sedang"><img src="${CLD}" alt="a" /></figure>`,
  );
  assert.strictEqual(sanitizeArticleHtml('<figure class="evil">x</figure>'), '<figure>x</figure>');
  assert.strictEqual(sanitizeArticleHtml('<figure class="article-figure--*">x</figure>'), '<figure>x</figure>');
  assert.strictEqual(sanitizeArticleHtml('<figure class="ARTICLE-FIGURE--KANAN article-figure--kanan-x">x</figure>'), '<figure>x</figure>');
  for (const tag of ['p', 'a', 'figcaption', 'h2', 'li', 'td', 'table', 'strong']) {
    const out = sanitizeArticleHtml(`<${tag} class="article-figure--kanan evil">x</${tag}>`);
    assert.ok(!/class/.test(out), `${tag}: ${out}`);
  }
  assert.ok(!/class/.test(sanitizeArticleHtml(`<img class="article-figure--kanan" src="${CLD}" alt="a">`)));
});
check('F-013 allowlist check: accepts class on <figure> only, with the five classes only (8.3)', () => {
  assertAllowlisted('<figure class="article-figure--kiri article-figure--kecil"><img src="x" alt="a" /></figure>');
  assertAllowlisted('<figure><img src="x" alt="a" /></figure>');
  for (const bad of ['<figure class="evil">', '<figure class="article-figure--kiri x">', '<figure class="">', '<p class="article-figure--kiri">', '<img class="article-figure--kiri">', '<a class="article-figure--kiri">']) {
    assert.throws(() => assertAllowlisted(bad), undefined, bad);
  }
});
check('F-013 checklist: a recognised attribute block triggers no check (7.4)', () => {
  for (const block of ['{posisi=kanan ukuran=sedang}', '{posisi=kiri}', '{ukuran=kecil}', '{}', ' {posisi=tengah ukuran=besar}']) {
    const content = `## A\n\nTeks.\n\n![Alt](${CLD})${block}\n\nLanjut.`;
    const r = runChecklist({ ...ok, content }, { coverWidth: 1200, renderWarnings: md(content).warnings });
    assert.deepStrictEqual(failed(r), [], block);
    assert.deepStrictEqual(warned(r), [], block);
  }
  const placeholder = `## A\n\n![Alt](../images/K-03/a.jpg){posisi=kiri ukuran=kecil}`;
  const r = runChecklist({ ...ok, content: placeholder }, { renderWarnings: md(placeholder).warnings });
  assert.deepStrictEqual(failed(r), ['C-7'], 'a block does not hide a placeholder');
});

// F-013 phase C: [[produk:…]] and [[artikel:…]] markers (requirements 17, 18, 22.1, 22.4).
const htmlOf = (blocks) => blocks.filter(b => b.type === 'html').map(b => b.html).join('');
const kinds = (warnings) => warnings.map(w => w.kind);
check('F-013 C: markers become blocks in Markdown order; html is the joined HTML blocks', () => {
  const r = md('Pembuka.\n\n[[produk:side-bag-z10]]\n\n## Lanjut\n\nTeks.\n\n[[ARTIKEL:cara-pasang]]\n\nPenutup.');
  assert.deepStrictEqual(r.blocks.map(b => b.type === 'html' ? 'html' : `${b.type}:${b.slug}`), ['html', 'product:side-bag-z10', 'html', 'article:cara-pasang', 'html']);
  assert.strictEqual(r.html, htmlOf(r.blocks));
  assert.ok(!r.html.includes('[['), r.html);
  assert.deepStrictEqual(r.warnings, []);
  for (const b of r.blocks) if (b.type === 'html') assertAllowlisted(b.html);
});
check('F-013 C: marker at start or end, adjacent markers, surrounding spaces; no empty HTML block', () => {
  const r = md('[[produk:a]]\n\n  [[artikel:b]]  \n\nTeks.\n\n[[produk:c]]');
  assert.deepStrictEqual(r.blocks.map(b => b.type), ['product', 'article', 'html', 'product']);
  assert.ok(r.blocks.every(b => b.type !== 'html' || b.html));
});
check('F-013 C: body without markers is one HTML block equal to html (K-02/K-06 snapshots above stay byte-identical)', () => {
  for (const name of ['K-02-naskah', 'K-06-naskah']) {
    const r = md(fixture(`${name}.md`));
    assert.strictEqual(r.blocks.length, 1, name);
    assert.strictEqual(r.blocks[0].html, r.html, name);
  }
  assert.deepStrictEqual(md('').blocks, []);
  const plain = renderArticle({ content: 'Satu\nDua', contentFormat: 'plain' });
  assert.deepStrictEqual(plain.blocks, [{ type: 'html', html: plain.html }]);
});
check('F-013 C: invalid slug stays text with embed-invalid', () => {
  for (const marker of ['[[produk:Tas_Besar]]', '[[produk:]]', '[[artikel:-x]]', '[[produk:a--b]]', '[[produk:ä]]']) {
    const r = md(`A.\n\n${marker}\n\nB.`);
    assert.ok(r.blocks.every(b => b.type === 'html'), marker);
    assert.deepStrictEqual(kinds(r.warnings), ['embed-invalid'], marker);
    assert.strictEqual(r.warnings[0].marker, marker);
    assertAllowlisted(r.html);
  }
});
check('F-013 C: marker in a sentence, list, quote, table, heading, or next to a line stays text with embed-inline', () => {
  const cases = [
    'Lihat [[produk:a]] ya.',
    '- [[produk:a]]',
    '> [[artikel:b]]',
    '| x |\n|---|\n| [[produk:a]] |',
    '## [[produk:a]]',
    'Teks di atas\n[[produk:a]]',
    '[[produk:a]]\nteks di bawah',
  ];
  for (const c of cases) {
    const r = md(c);
    assert.ok(r.blocks.every(b => b.type === 'html'), c);
    assert.deepStrictEqual(kinds(r.warnings), ['embed-inline'], c);
    assert.ok(r.html.includes('[[produk:a]]') || r.html.includes('[[artikel:b]]'), c);
  }
});
check('F-013 C: marker in fenced or indented code, or escaped, is neither a card nor a warning', () => {
  for (const c of ['```\n[[produk:a]]\n```', '    [[produk:a]]', '\\[\\[produk:a\\]\\]']) {
    const r = md(c);
    assert.ok(r.blocks.every(b => b.type === 'html'), c);
    assert.deepStrictEqual(r.warnings, [], c);
  }
});
check('F-013 C: only the first 10 markers become cards; the rest give embed-limit and no output', () => {
  const content = Array.from({ length: 12 }, (_, i) => `[[produk:p-${i + 1}]]`).join('\n\nTeks.\n\n');
  const r = md(content);
  assert.strictEqual(r.blocks.filter(b => b.type === 'product').length, 10);
  assert.deepStrictEqual(r.warnings.map(w => `${w.kind}:${w.marker}`), ['embed-limit:[[produk:p-11]]', 'embed-limit:[[produk:p-12]]']);
  assert.ok(!r.html.includes('[['));
});
check('F-013 C: markers cannot inject HTML; every HTML block passes the allowlist', () => {
  const attacks = [
    '[[produk:x" onload="alert(1)]]',
    '[[produk:<img src=x onerror=alert(1)>]]',
    '[[artikel:javascript:alert(1)]]',
    '[[produk:../../users/admin]]',
    '<div>[[produk:a]]</div>',
    '[[produk:a]]<script>alert(1)</script>',
  ];
  for (const a of attacks) {
    const r = md(`A.\n\n${a}\n\nB.`);
    assert.ok(r.blocks.every(b => b.type === 'html'), a);
    for (const b of r.blocks) assertAllowlisted(b.html);
    assert.ok(!/<(script|div|img)\b|<[^>]*\son\w+=/i.test(r.html), `${a}: ${r.html}`);
  }
});
check('F-013 C: a floated image before a card keeps its layout; the image block is sanitized on its own', () => {
  const r = md(`![Tas](${CLD}){posisi=kanan ukuran=sedang}\n\nTeks.\n\n[[produk:a]]\n\nLagi.`);
  assert.strictEqual(r.blocks[0].type, 'html');
  assert.ok(r.blocks[0].html.includes('class="article-figure--kanan article-figure--sedang"'));
  assert.deepStrictEqual(r.blocks.map(b => b.type), ['html', 'product', 'html']);
});
check('F-013 C: an unparseable body still returns render-error and no blocks', () => {
  const r = md('>'.repeat(20000) + ' x');
  if (r.warnings.some(w => w.kind === 'render-error')) assert.deepStrictEqual(r.blocks, []);
  else assert.strictEqual(r.html, htmlOf(r.blocks));
});
check('F-013 C: countWords and firstLineSummary ignore marker lines', () => {
  assert.strictEqual(fmt.countWords('[[produk:side-bag-z10]]\n\nDua kata'), 2);
  assert.strictEqual(fmt.countWords('  [[ARTIKEL:a]]  \nDua kata'), 2);
  assert.strictEqual(fmt.firstLineSummary('[[produk:a]]\n\nKalimat pertama.'), 'Kalimat pertama.');
});
check('F-013 C: C-9 fails on each embed warning and is absent without markers', () => {
  const run = (content) => runChecklist({ ...ok, content }, { coverWidth: 1200, renderWarnings: md(content).warnings });
  assert.ok(!run(`## A\n\nTeks.`).blocking.some(c => c.id === 'C-9'));
  const good = run(`## A\n\nTeks.\n\n[[produk:a]]\n\n[[artikel:b]]`);
  assert.deepStrictEqual(good.blocking.find(c => c.id === 'C-9'), { id: 'C-9', label: good.blocking.find(c => c.id === 'C-9').label, ok: true });
  assert.ok(canPublish(good));
  for (const content of ['## A\n\nLihat [[produk:a]].', '## A\n\n[[produk:A_B]]', Array.from({ length: 11 }, (_, i) => `[[produk:p${i}]]`).join('\n\n')]) {
    const r = run(content);
    assert.deepStrictEqual(failed(r), ['C-9'], content);
    assert.ok(r.blocking.find(c => c.id === 'C-9').detail);
  }
  // The editor has no renderer: without render warnings a marker alone never blocks there.
  assert.ok(canPublish(runChecklist({ ...ok, content: '## A\n\nLihat [[produk:a]].' }, { coverWidth: 1200 })));
});

// F-013 phase C4 (requirements 22.1, 22.2).
check('F-013 C4: C-9 fails on missing targets given by the server or the editor, deduplicated', () => {
  const content = '## A\n\nTeks.\n\n[[produk:a]]\n\n[[artikel:b]]';
  const r = runChecklist({ ...ok, content }, { coverWidth: 1200, renderWarnings: md(content).warnings, missingEmbeds: ['[[produk:a]]', '[[produk:a]]'] });
  assert.deepStrictEqual(failed(r), ['C-9']);
  assert.strictEqual(r.blocking.find(c => c.id === 'C-9').detail, 'tidak ada, nonaktif, belum terbit, atau artikel ini sendiri: [[produk:a]]');
  assert.ok(canPublish(runChecklist({ ...ok, content }, { coverWidth: 1200, missingEmbeds: [] })));
});
check('F-013 C4: siteLinks finds /blog and /produk links outside code, with titles and <...>; not anchors or queries', () => {
  const content = '[a](/blog/satu) [b](/produk/dua "Judul") [c](</blog/tiga>) [d](/produk/empat#x) [e](/produk?x=1) [f](https://inzta.id/blog/lima)\n\n```\n[g](/blog/enam)\n```';
  assert.deepStrictEqual(fmt.siteLinks(content).map(l => `${l.kind}:${l.slug}`), ['artikel:satu', 'produk:dua', 'artikel:tiga']);
});
check('F-013 C4: W-5 lists links to pages that are not public; absent without the editor list or without links', () => {
  const content = '## A\n\nLihat [tas](/produk/tas-aktif), [lama](/produk/tas-nonaktif), dan [draf](/blog/draf-x). Lagi [draf](/blog/draf-x).';
  const targets = { produk: ['tas-aktif'], artikel: ['terbit'] };
  const r = runChecklist({ ...ok, content }, { coverWidth: 1200, publicTargets: targets });
  assert.deepStrictEqual(warned(r), ['W-5']);
  assert.strictEqual(r.warnings.find(c => c.id === 'W-5').detail, 'Belum tayang atau tidak ada: /produk/tas-nonaktif, /blog/draf-x');
  assert.ok(canPublish(r), 'W-5 is a warning only');
  assert.ok(!runChecklist({ ...ok, content }, { coverWidth: 1200 }).warnings.some(c => c.id === 'W-5'));
  assert.ok(!runChecklist({ ...ok, content: '## A\n\nTanpa link.' }, { coverWidth: 1200, publicTargets: targets }).warnings.some(c => c.id === 'W-5'));
  assert.deepStrictEqual(warned(runChecklist({ ...ok, content: '## A\n\n[tas](/produk/tas-aktif)' }, { coverWidth: 1200, publicTargets: targets })), []);
});

for (const [s, n] of results) console.log(`${s}  ${n}`);
const failedCount = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failedCount}/${results.length} passed`);
process.exit(failedCount ? 1 : 0);
