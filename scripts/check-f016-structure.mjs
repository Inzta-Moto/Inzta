// F-016 design.md §19: compares each canvas artboard with the HTML of its route. For every page-level block (the
// children of .iz-page, and of main#isi on the site) it checks block order, the iz-/t- classes of the outer two levels,
// and the h1-h3 headings. Exceptions with a reason and a requirement id live in scripts/f016-structure-exceptions.json.
// Usage: node scripts/check-f016-structure.mjs [--base http://localhost:3016] [--design D:/Projects/inzta-web-design]
//        [--only Main,produk] [--dom m-nav=path/to/dump.html]
// Phone artboards are covered by their desktop source (same markup, CSS layout). Laptop only.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = opt('base', 'http://localhost:3016');
const DESIGN = path.join(opt('design', 'D:/Projects/inzta-web-design'), 'claude-design/canvas/project');
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const DOMS = Object.fromEntries((args.flatMap((a, i) => (a === '--dom' ? [args[i + 1]] : []))).map(d => d.split('=')));

// Artboard → route and the fixture state it needs (design.md §19). `server` reads the route HTML; `dom` needs a
// DOM dump after interaction (--dom); `component` is covered by an exception entry.
const ARTBOARDS = {
  Main: { mode: 'server', route: '/', state: 'F016_FLASH=off' },
  'Main-flash': { mode: 'server', route: '/', state: 'F016_FLASH=active' },
  nav: { mode: 'server', route: '/' },
  'm-nav': { mode: 'dom', route: '/', state: 'phone menu open' },
  produk: { mode: 'server', route: '/produk' },
  'produk-detail': { mode: 'server', route: '/produk/tail-bag-inzta-tourmax-30' },
  'produk-sisi': { mode: 'server', route: '/produk/side-bag-inzta-xsr-155', state: 'F016_KATEGORI=draft' },
  motor: { mode: 'server', route: '/tas-motor/retro', state: 'F016_KATEGORI=draft' },
  blog: { mode: 'server', route: '/blog' },
  artikel: { mode: 'server', route: '/blog/komunitas-gasber-rider-bandung' },
  tentang: { mode: 'server', route: '/tentang' },
  'admin-sisi': { mode: 'component' },
};
const PHONE = { 'm-index': 'Main', 'm-index-flash': 'Main-flash', 'm-produk': 'produk', 'm-produk-detail': 'produk-detail', 'm-produk-sisi': 'produk-sisi', 'm-motor': 'motor', 'm-blog': 'blog', 'm-artikel': 'artikel', 'm-tentang': 'tentang' };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// Minimal HTML tree builder: enough for well-formed canvas and React output (no implied end tags beyond void ones).
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(script|style|svg|template|noscript)\b[^>]*>[\s\S]*?<\/\1>|<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[4]) {
      for (const el of stack) el.text += m[4];
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[0].startsWith('</')) {
      const idx = stack.map(e => e.tag).lastIndexOf(tag);
      if (idx > 0) stack.length = idx;
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1].toLowerCase()] = a[2] ?? '';
    const el = { tag, attrs, children: [], text: '' };
    top.children.push(el);
    if (!VOID.has(tag) && !m[3].trim().endsWith('/')) stack.push(el);
  }
  return root;
}

const classes = el => (el.attrs.class || '').split(/\s+/).filter(c => /^(iz-|t-)/.test(c));
const find = (el, pred) => {
  if (pred(el)) return el;
  for (const c of el.children) {
    const r = find(c, pred);
    if (r) return r;
  }
  return null;
};
const all = (el, pred, out = []) => {
  if (pred(el)) out.push(el);
  el.children.forEach(c => all(c, pred, out));
  return out;
};
const norm = s => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Page-level blocks: children of .iz-page; on the site, main#isi is unwrapped so its sections line up with the canvas.
function blocks(tree) {
  const page = find(tree, e => classes(e).includes('iz-page'));
  if (!page) return [];
  const out = [];
  for (const c of page.children) {
    if (c.tag === 'main') out.push(...c.children);
    else if (c.tag !== 'a' || !classes(c).includes('iz-skip')) out.push(c);
  }
  return out.filter(b => classes(b).length);
}
const key = b => classes(b)[0];
const outer = b => new Set([...classes(b), ...b.children.flatMap(c => [...classes(c), ...c.children.flatMap(classes)])]);

const exceptions = JSON.parse(fs.readFileSync(path.join('scripts', 'f016-structure-exceptions.json'), 'utf8'));
for (const e of exceptions) {
  if (!e.reason || !e.requirement) throw new Error(`exception without reason/requirement: ${JSON.stringify(e)}`);
}
const excepted = (artboard, kind, value) =>
  exceptions.some(e => e.artboard === artboard && e.kind === kind && (e.value === '*' || e.value === value));

let failures = 0;
const report = [];
for (const [name, cfg] of Object.entries(ARTBOARDS)) {
  if (ONLY && !ONLY.includes(name)) continue;
  if (cfg.mode === 'component') {
    const ok = excepted(name, 'artboard', '*');
    report.push(`${ok ? 'OK  ' : 'FAIL'} ${name}: component mode${ok ? ' (exception entry)' : ' needs an exception entry'}`);
    if (!ok) failures++;
    continue;
  }
  let html;
  if (cfg.mode === 'dom') {
    if (!DOMS[name]) {
      report.push(`SKIP ${name}: pass --dom ${name}=<dump of the DOM in state "${cfg.state}">`);
      failures++;
      continue;
    }
    html = fs.readFileSync(DOMS[name], 'utf8');
  } else {
    const res = await fetch(BASE + cfg.route);
    html = await res.text();
    if (res.status !== 200) {
      report.push(`FAIL ${name}: ${cfg.route} answered ${res.status}`);
      failures++;
      continue;
    }
  }
  const canvas = parse(fs.readFileSync(path.join(DESIGN, `${name}.dc.html`), 'utf8'));
  const site = parse(html);
  const cb = blocks(canvas);
  const sb = blocks(site);
  const issues = [];

  // Order: every canvas block key appears in the site in the same relative order.
  let cursor = 0;
  const matched = [];
  for (const b of cb) {
    const k = key(b);
    const idx = sb.findIndex((s, i) => i >= cursor && key(s) === k);
    if (idx === -1) {
      if (!excepted(name, 'block', k)) issues.push(`missing block .${k}`);
      continue;
    }
    matched.push([b, sb[idx]]);
    cursor = idx + 1;
  }
  for (const [c, s] of matched) {
    const have = outer(s);
    for (const cls of outer(c)) {
      if (!have.has(cls) && !excepted(name, 'class', cls)) issues.push(`.${key(c)}: class .${cls} missing`);
    }
  }
  const siteText = norm(site.text);
  for (const h of all(canvas, e => /^h[1-3]$/.test(e.tag))) {
    const t = norm(h.text);
    if (t && !siteText.includes(t) && !excepted(name, 'heading', t)) issues.push(`heading "${t}" not found`);
  }
  failures += issues.length;
  report.push(`${issues.length ? 'FAIL' : 'OK  '} ${name} → ${cfg.route}${cfg.state ? ` [${cfg.state}]` : ''}${issues.map(i => `\n       - ${i}`).join('')}`);
}
for (const [phone, desk] of Object.entries(PHONE)) if (!ONLY || ONLY.includes(desk)) report.push(`OK   ${phone}: covered by ${desk}`);

console.log(report.join('\n'));
console.log(`\ncheck-f016-structure: ${failures ? `${failures} problem(s)` : 'ok'}`);
process.exit(failures ? 1 : 0);
