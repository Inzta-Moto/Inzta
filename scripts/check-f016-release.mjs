// F-016 18.3: counts placeholder markers on the v2 pages of a running local production build. Prints the counts;
// with F016_RELEASE=1 it exits non-zero while any marker remains, so placeholders cannot reach main unnoticed.
// Usage: node scripts/check-f016-release.mjs [baseUrl]   (default http://localhost:3000)
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const pages = ['/', '/produk', '/tas-motor/retro', '/blog', '/tentang'];
const markers = [
  ['PLACEHOLDER', /PLACEHOLDER/g],
  ['Foto contoh', /Foto contoh/g],
  ['Nama tersamar', /Nama tersamar/g],
  ['href="#"', /href="#"/g],
];

let total = 0;
for (const path of pages) {
  let html = '';
  try {
    const res = await fetch(base + path);
    html = await res.text();
    if (!res.ok) console.log(`${path}: HTTP ${res.status}`);
  } catch (e) {
    console.log(`${path}: unreachable (${e.message})`);
    total++;
    continue;
  }
  // Only visible HTML counts; the RSC payload in <script> repeats every string.
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const counts = markers.map(([name, re]) => [name, (visible.match(re) || []).length]);
  total += counts.reduce((n, [, c]) => n + c, 0);
  console.log(`${path}: ${counts.map(([n, c]) => `${n}=${c}`).join(', ')}`);
}
console.log(`total markers: ${total}`);
if (process.env.F016_RELEASE === '1' && total > 0) {
  console.error('F016_RELEASE=1: placeholders remain, see docs/specs/F-016-landing-page-v2/design.md section 10 in inzta-hq');
  process.exit(1);
}
