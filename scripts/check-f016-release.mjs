// F-016 release check (design.md §15 condition 3; S1.4.3, S1.10.3, C-8): counts placeholder markers and lists copy
// that still waits for written approval on the v2 pages of a running local build. Prints everything; with
// F016_RELEASE=1 it exits non-zero while any marker or unapproved item remains, so neither can reach main unnoticed.
// Usage: node scripts/check-f016-release.mjs [baseUrl]   (default http://localhost:3000)
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const pages = ['/', '/produk', '/tas-motor/retro', '/blog', '/tentang'];
const markers = [
  ['PLACEHOLDER', /PLACEHOLDER/g],
  ['Foto contoh', /Foto contoh/g],
  ['Nama tersamar', /Nama tersamar/g],
  ['href="#"', /href="#"/g],
];

// Copy on the page that is waiting for INZTA (placeholder register P-*, conflict C-8). An item is listed while its
// text is in the HTML and its id is not in APPROVED. Approval is recorded by adding the id here in the same commit
// that cites the written approval (date, who, where); never to silence the check.
const PENDING = [
  { id: 'P-8', page: '/', what: 'S1.4 item 1 "Jujur soal kecocokan" (values copy, G2)', re: /Jujur soal kecocokan/ },
  { id: 'P-8', page: '/', what: 'S1.4 item 3 "Dibalas manusia" (values copy, G2)', re: /Dibalas manusia/ },
  { id: 'P-8', page: '/', what: 'S1.4 item 4 "Ikut turun ke jalan" (values copy, G2)', re: /Ikut turun ke jalan/ },
  { id: 'P-5', page: '/', what: 'S1.10 pill "Garansi: PLACEHOLDER" (A-023)', re: /Garansi: PLACEHOLDER/ },
  { id: 'P-6', page: '/', what: 'S1.10 pill "Waktu kirim: PLACEHOLDER"', re: /Waktu kirim: PLACEHOLDER/ },
  { id: 'P-9', page: '/', what: 'S1.1/S1.2 "kami tandai tas" (kategoriMotor data validated, D2)', re: /[Kk]ami tandai tas/ },
  { id: 'P-10', page: '/', what: '"sejak 2023" (owner confirmation)', re: /sejak 2023/ },
  { id: 'C-8', page: '/', what: 'S1.9 Tokopedia reviews (buyer permission or written approval by Bang Raja)', re: /Kata pembeli INZTA\./ },
];
const APPROVED = new Set([]);

let total = 0;
const html = {};
for (const path of pages) {
  let text = '';
  try {
    const res = await fetch(base + path);
    text = await res.text();
    if (!res.ok) console.log(`${path}: HTTP ${res.status}`);
  } catch (e) {
    console.log(`${path}: unreachable (${e.message})`);
    total++;
    continue;
  }
  // Only visible HTML counts; the RSC payload in <script> repeats every string.
  html[path] = text.replace(/<script[\s\S]*?<\/script>/g, '');
  const counts = markers.map(([name, re]) => [name, (html[path].match(re) || []).length]);
  total += counts.reduce((n, [, c]) => n + c, 0);
  console.log(`${path}: ${counts.map(([n, c]) => `${n}=${c}`).join(', ')}`);
}
console.log(`total markers: ${total}`);

const unapproved = PENDING.filter(p => !APPROVED.has(p.id) && html[p.page] !== undefined && p.re.test(html[p.page]));
console.log(`unapproved copy: ${unapproved.length}`);
for (const p of unapproved) console.log(`  ${p.id}  ${p.page}  ${p.what}`);

if (process.env.F016_RELEASE === '1' && total + unapproved.length > 0) {
  console.error('F016_RELEASE=1: placeholders or unapproved copy remain, see inzta-hq docs/specs/F-016-website-v2/requirements.md §5 and §6 (C-8)');
  process.exit(1);
}
