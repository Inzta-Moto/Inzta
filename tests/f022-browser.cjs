// F-022 browser tests (Playwright). Starts `next dev` with a generated fixture (lib/v2/dev-fixture.ts), serves the
// product photos and the Cloudinary upload API from the test (no network), and drives the product page gallery and the
// real admin uploader on the dev-only page /uji-dev/upload-foto. Nothing is written to Firebase or Cloudinary.
// Usage: npm run test:images-browser            (local; needs the Playwright package and Chromium, preinstalled in
//                                                 Claude cloud sessions, else `npm i -g playwright && npx playwright install chromium`)
//        node tests/f022-browser.cjs --base https://inzta-staging.vercel.app --slug <product with ≥2 photos> [--var <variable product>]
//        (read-only check of a deployed site: gallery only, no uploader page, real images)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const http = require('http');
const assert = require('assert');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium, devices } = playwright;

const args = process.argv.slice(2);
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const ROOT = path.join(__dirname, '..');
const MODE = opt('base') ? 'staging' : 'local';
const PORT = Number(opt('port') || 3122);
let BASE = (opt('base') || `http://localhost:${PORT}`).replace(/\/$/, '');
const STAGING_SLUG = opt('slug');
const STAGING_VAR = opt('var');
const SHOTS = opt('shots') || path.join(os.tmpdir(), 'f022-shots');
fs.mkdirSync(SHOTS, { recursive: true });

// ── Generated test data ─────────────────────────────────────────────────────
const CDN = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/f022/';
const v = (id, attrs, x = {}) => ({ variationId: id, sku: id, attributes: attrs, price: 150000, compareAtPrice: null, stock: 5, images: [], isActive: true, ...x });
const FIXTURE = { articles: [], products: [
  { slug: 'tas-uji-f022', name: 'Tas uji F-022 sepuluh foto', productType: 'simple', price: 250000, compareAtPrice: null, stock: 4, images: Array.from({ length: 10 }, (_, i) => `${CDN}p${i + 1}.jpg`), features: [], badge: null, isActive: true, description: 'Uji galeri', category: 'hardcase', createdAt: '2026-11-06T00:00:00.000Z' },
  { slug: 'tas-variasi-f022', name: 'Tas variasi F-022', productType: 'variable', priceFrom: 150000, priceTo: 150000, images: Array.from({ length: 10 }, (_, i) => `${CDN}m${i + 1}.jpg`), features: [], badge: null, isActive: true, description: '', category: 'softcase',
    attributes: [{ id: 'a', name: 'Warna', values: ['Hitam', 'Abu'] }], variants: [v('v1', { Warna: 'Hitam' }, { images: [`${CDN}hitam.jpg`] }), v('v2', { Warna: 'Abu' }, { images: [`${CDN}abu.jpg`] })], createdAt: '2026-11-05T00:00:00.000Z' },
  { slug: 'tas-satu-foto-f022', name: 'Tas satu foto F-022', productType: 'simple', price: 99000, compareAtPrice: null, stock: 2, images: [`${CDN}solo.jpg`], features: [], badge: null, isActive: true, description: '', category: 'hardcase', createdAt: '2026-11-04T00:00:00.000Z' },
  { slug: 'side-uji-f022', name: 'Side bag uji F-022', productType: 'variable', jualPerSisi: true, bisaSepasang: true, priceFrom: 150000, priceTo: 150000, images: [`${CDN}s1.jpg`, `${CDN}s2.jpg`, `${CDN}s3.jpg`], features: [], badge: null, isActive: true, description: '', category: 'softcase',
    attributes: [{ id: 'a', name: 'Sisi', values: ['Kiri', 'Kanan'] }], variants: [v('vk', { Sisi: 'Kiri' }, { images: [`${CDN}kiri.jpg`] }), v('vn', { Sisi: 'Kanan' })], createdAt: '2026-11-03T00:00:00.000Z' },
] };

// A labelled square per photo name, so a screenshot shows which photo is on screen.
function photoSvg(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="hsl(${h},55%,72%)"/><text x="400" y="460" font-family="sans-serif" font-size="200" font-weight="700" text-anchor="middle" fill="#141414">${name.replace(/\.[a-z]+$/, '')}</text></svg>`;
}

// Minimal PNG encoder (RGB, no filter): upload test files whose width carries their number.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function imageWidth(buf) {
  const sig = buf.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (sig >= 0) return buf.readUInt32BE(sig + 16);
  for (let i = 0; i < buf.length - 9; i++) if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) return buf.readUInt16BE(i + 7);
  return 0;
}
const UPLOADS = {};
for (let i = 1; i <= 12; i++) UPLOADS[`u${String(i).padStart(2, '0')}.jpg`] = { name: `u${String(i).padStart(2, '0')}.png`, mimeType: 'image/png', buffer: png(600 + i, 400, [(30 * i) % 255, 90, 150]) };
UPLOADS['anim.gif'] = { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1') };
UPLOADS['notes.txt'] = { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bukan gambar') };
UPLOADS['big.png'] = { name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) };

// ── Harness ─────────────────────────────────────────────────────────────────
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('PASS ', name); } catch (e) { results.push(['FAIL', `${name}: ${e && e.message}`]); console.log('FAIL ', name, '::', e && e.message); }
}

async function wireImages(context) {
  if (MODE !== 'local') return;
  await context.route('https://res.cloudinary.com/**', route => {
    const name = route.request().url().split('/').pop().split('?')[0];
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(name) });
  });
  await context.route(/googletagmanager|google-analytics|connect\.facebook|cdn\.jsdelivr\.net/, r => r.abort());
}

function trackErrors(page) {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  return errs;
}

const counter = page => page.locator('.iz-gallery__count').textContent();
const mainSrc = page => page.locator('.iz-gallery__main img').first().evaluate(i => i.currentSrc || i.src);
async function thumbVisible(page, n) {
  // Smooth scroll may still be running; poll up to 2 s.
  for (let t = 0; t < 20; t++) {
    if (await thumbVisibleNow(page, n)) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
async function thumbVisibleNow(page, n) {
  return page.evaluate((n) => {
    const strip = document.querySelector('.iz-gallery .iz-thumbs');
    const t = strip.querySelectorAll('.iz-thumb')[n - 1];
    const s = strip.getBoundingClientRect(), r = t.getBoundingClientRect();
    return r.left >= s.left - 1 && r.right <= s.right + 1;
  }, n);
}
async function settle(page) { await page.waitForTimeout(450); }

async function storefront(browser) {
  const slug = MODE === 'local' ? 'tas-uji-f022' : STAGING_SLUG;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await wireImages(ctx);
  const page = await ctx.newPage();
  const errs = trackErrors(page);
  await page.goto(`${BASE}/produk/${slug}`, { waitUntil: 'networkidle' });
  const total = await page.locator('.iz-gallery .iz-thumb').count();

  await check(`B-1 desktop ${slug}: ${total} thumbnails, counter 1/${total}, photo 1 is the main image`, async () => {
    if (MODE === 'local') assert.strictEqual(total, 10);
    else assert.ok(total >= 2, `staging product needs ≥2 photos, has ${total}`);
    assert.strictEqual(await counter(page), `1/${total}`);
    const first = await page.locator('.iz-gallery .iz-thumb img').first().getAttribute('src');
    const main = await mainSrc(page);
    if (MODE === 'local') assert.match(main, /p1\.jpg/);
    assert.ok(first);
    await page.screenshot({ path: path.join(SHOTS, `${MODE}-desk-1.png`) });
  });

  await check('B-2 desktop: arrows hidden until hover/focus, visible on hover', async () => {
    const next = page.getByRole('button', { name: 'Foto berikutnya' });
    assert.strictEqual(await next.evaluate(b => getComputedStyle(b).opacity), '0');
    await page.locator('.iz-gallery__main').hover();
    await page.waitForTimeout(250);
    assert.strictEqual(await next.evaluate(b => getComputedStyle(b).opacity), '1');
  });

  await check(`B-3 desktop: "Foto berikutnya" steps 2..${total} then wraps to 1; main image and aria-current follow; active thumb always visible`, async () => {
    const next = page.getByRole('button', { name: 'Foto berikutnya' });
    for (let i = 2; i <= total + 1; i++) {
      await page.locator('.iz-gallery__main').hover();
      await next.click();
      await settle(page);
      const want = i > total ? 1 : i;
      assert.strictEqual(await counter(page), `${want}/${total}`, `step ${i}`);
      assert.strictEqual(await page.locator('.iz-gallery .iz-thumb[aria-current="true"]').getAttribute('aria-label'), `Foto ${want} dari ${total}`);
      if (MODE === 'local') assert.match(await mainSrc(page), new RegExp(`p${want}\\.jpg`));
      assert.ok(await thumbVisible(page, want), `thumb ${want} visible`);
      if (want === total) await page.screenshot({ path: path.join(SHOTS, `${MODE}-desk-last.png`) });
    }
  });

  await check(`B-4 desktop: "Foto sebelumnya" from 1 wraps to ${total}`, async () => {
    await page.locator('.iz-gallery__main').hover();
    await page.getByRole('button', { name: 'Foto sebelumnya' }).click();
    await settle(page);
    assert.strictEqual(await counter(page), `${total}/${total}`);
    assert.ok(await thumbVisible(page, total));
  });

  await check('B-5 desktop keyboard: Home/End/arrow keys on thumbnails move selection and keep it in view; Tab reaches the arrows', async () => {
    await page.locator('.iz-gallery .iz-thumb[aria-current="true"]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    assert.strictEqual(await counter(page), `1/${total}`);
    assert.ok(await thumbVisible(page, 1));
    await page.keyboard.press('End');
    await settle(page);
    assert.strictEqual(await counter(page), `${total}/${total}`);
    assert.ok(await thumbVisible(page, total));
    await page.keyboard.press('ArrowLeft');
    await settle(page);
    assert.strictEqual(await counter(page), `${total - 1}/${total}`);
    // Arrow buttons are reachable by keyboard and visible on focus.
    await page.getByRole('button', { name: 'Foto berikutnya' }).focus();
    await page.waitForTimeout(250);
    assert.strictEqual(await page.getByRole('button', { name: 'Foto berikutnya' }).evaluate(b => getComputedStyle(b).opacity), '1');
    await page.keyboard.press('Enter');
    await settle(page);
    assert.strictEqual(await counter(page), `${total}/${total}`);
  });

  await check('B-6 desktop: clicking a thumbnail selects it; page does not scroll horizontally', async () => {
    await page.locator('.iz-gallery .iz-thumb').nth(1).click();
    await settle(page);
    assert.strictEqual(await counter(page), `2/${total}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });

  await check('B-18 screen readers: the live region says "Foto n dari N" after a switch (review REV-04)', async () => {
    assert.strictEqual(await page.locator('.iz-gallery__live').textContent(), `Foto 2 dari ${total}`);
    await page.locator('.iz-gallery__main').hover();
    await page.getByRole('button', { name: 'Foto berikutnya' }).click();
    await settle(page);
    assert.strictEqual(await page.locator('.iz-gallery__live').textContent(), `Foto 3 dari ${total}`);
    assert.strictEqual(await page.locator('.iz-gallery__live').getAttribute('aria-live'), 'polite');
    const box = await page.locator('.iz-gallery__live').boundingBox();
    assert.ok(box.width <= 1 && box.height <= 1, 'visually hidden');
  });

  await check('B-7 desktop: no console or page errors (hydration included)', async () => {
    const real = errs.filter(e => !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|favicon/i.test(e));
    assert.deepStrictEqual(real, []);
  });
  await ctx.close();

  // Laptop width (1280, v2-fit scaling) quick check
  const lap = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await wireImages(lap);
  const lp = await lap.newPage();
  await lp.goto(`${BASE}/produk/${slug}`, { waitUntil: 'networkidle' });
  await check('B-8 laptop 1280: counter and arrows inside the main photo box; no horizontal scroll', async () => {
    const box = await lp.locator('.iz-gallery__main').boundingBox();
    const c = await lp.locator('.iz-gallery__count').boundingBox();
    assert.ok(c.x >= box.x && c.x + c.width <= box.x + box.width && c.y + c.height <= box.y + box.height);
    for (const name of ['Foto sebelumnya', 'Foto berikutnya']) {
      const b = await lp.getByRole('button', { name }).boundingBox();
      assert.ok(b.x >= box.x && b.x + b.width <= box.x + box.width, name);
      assert.ok(b.width >= 44 && b.height >= 44, `${name} ${b.width}x${b.height}`);
    }
    assert.ok(await lp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await lp.screenshot({ path: path.join(SHOTS, `${MODE}-laptop.png`) });
  });
  await lap.close();

  // Phone
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  await wireImages(phone);
  const pp = await phone.newPage();
  const perrs = trackErrors(pp);
  await pp.goto(`${BASE}/produk/${slug}`, { waitUntil: 'networkidle' });
  // Touch handlers exist only after hydration (dev hydration is slow); wait for React to own the gallery.
  await pp.waitForFunction(() => { const el = document.querySelector('.iz-gallery__main'); return !!el && Object.keys(el).some(k => k.startsWith('__reactProps')); }, null, { timeout: 30000 });
  // The page-transition curtain (iz-curtain) covers the page right after load; touches must land on the gallery.
  await pp.waitForFunction(() => { const m = document.querySelector('.iz-gallery__main'); const r = m.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && m.contains(hit); }, null, { timeout: 30000 });
  const cdp = await phone.newCDPSession(pp);
  const swipe = async (dx, dy = 0) => {
    const b = await pp.locator('.iz-gallery__main').boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * k) / 5, y: y + (dy * k) / 5 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(pp);
  };
  await check('B-9 phone (iPhone 13): counter 1/N and arrows visible; arrow targets ≥ 40 px (48 px hit area); no horizontal scroll', async () => {
    assert.strictEqual(await counter(pp), `1/${total}`);
    const nb = await pp.getByRole('button', { name: 'Foto berikutnya' });
    assert.strictEqual(await nb.evaluate(b => getComputedStyle(b).opacity), '1');
    const b = await nb.boundingBox();
    assert.ok(b.width >= 40 && b.height >= 40);
    assert.strictEqual(await nb.evaluate(b => getComputedStyle(b, '::after').inset || getComputedStyle(b, '::after').top), '-4px');
    assert.ok(await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await pp.screenshot({ path: path.join(SHOTS, `${MODE}-phone-1.png`) });
  });
  await check('B-10 phone: swipe left = next, swipe right = previous (wraps), vertical or short swipe = no change', async () => {
    await swipe(-150);
    assert.strictEqual(await counter(pp), `2/${total}`);
    await swipe(-150);
    assert.strictEqual(await counter(pp), `3/${total}`);
    await swipe(150);
    assert.strictEqual(await counter(pp), `2/${total}`);
    await swipe(150);
    await swipe(150);
    assert.strictEqual(await counter(pp), `${total}/${total}`);
    assert.ok(await thumbVisible(pp, total), 'last thumb scrolled into view');
    await swipe(-20);
    assert.strictEqual(await counter(pp), `${total}/${total}`);
    await swipe(-60, 200);
    assert.strictEqual(await counter(pp), `${total}/${total}`);
    await pp.screenshot({ path: path.join(SHOTS, `${MODE}-phone-last.png`) });
  });
  await check('B-11 phone: tapping arrows steps photos; no console errors', async () => {
    await pp.getByRole('button', { name: 'Foto berikutnya' }).tap();
    await settle(pp);
    assert.strictEqual(await counter(pp), `1/${total}`);
    const real = perrs.filter(e => !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|favicon/i.test(e));
    assert.deepStrictEqual(real, []);
  });
  await phone.close();

  // No JavaScript
  const nojs = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await wireImages(nojs);
  const np = await nojs.newPage();
  await np.goto(`${BASE}/produk/${slug}`, { waitUntil: 'load' });
  await check('B-12 without JavaScript: all thumbnails and the counter are in the HTML, arrows are hidden', async () => {
    assert.strictEqual(await np.locator('.iz-gallery .iz-thumb').count(), total);
    assert.strictEqual(await counter(np), `1/${total}`);
    assert.strictEqual(await np.locator('.iz-gallery__nav').evaluate(n => getComputedStyle(n).display), 'none');
  });
  await nojs.close();
}

async function variableAndEdge(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await wireImages(ctx);
  const page = await ctx.newPage();
  const errs = trackErrors(page);
  if (MODE === 'local') {
    await page.goto(`${BASE}/produk/tas-variasi-f022`, { waitUntil: 'networkidle' });
    await check('B-13 variable: 10 gallery + 2 variant photos = 12 thumbnails; picking "Abu" shows its photo at 12/12 and scrolls it into view', async () => {
      assert.strictEqual(await page.locator('.iz-gallery .iz-thumb').count(), 12);
      assert.strictEqual(await counter(page), '1/12');
      await page.getByText('Abu', { exact: true }).click();
      await settle(page);
      assert.strictEqual(await counter(page), '12/12');
      assert.match(await mainSrc(page), /abu\.jpg/);
      assert.ok(await thumbVisible(page, 12));
      await page.getByText('Hitam', { exact: true }).click();
      await settle(page);
      assert.strictEqual(await counter(page), '11/12');
      assert.match(await mainSrc(page), /hitam\.jpg/);
      await page.screenshot({ path: path.join(SHOTS, 'local-variable.png') });
    });
    await page.goto(`${BASE}/produk/tas-satu-foto-f022`, { waitUntil: 'networkidle' });
    await check('B-14 one photo: no counter, no arrows, no thumbnail strip', async () => {
      assert.strictEqual(await page.locator('.iz-gallery__count').count(), 0);
      assert.strictEqual(await page.locator('.iz-gallery__nav').count(), 0);
      assert.strictEqual(await page.locator('.iz-gallery .iz-thumbs').count(), 0);
    });
    await page.goto(`${BASE}/produk/side-uji-f022`, { waitUntil: 'networkidle' });
    await check('B-15 side product: counter counts photos only (1/4); arrows skip the "Foto kanan"/"Foto sepasang" placeholders; Kiri switches to its photo', async () => {
      assert.strictEqual(await counter(page), '1/4');
      for (let i = 0; i < 4; i++) {
        await page.locator('.iz-gallery__main').hover();
        await page.getByRole('button', { name: 'Foto berikutnya' }).click();
        await settle(page);
      }
      assert.strictEqual(await counter(page), '1/4');
      await page.locator('.iz-gallery__main').hover();
      await page.getByRole('button', { name: 'Foto sebelumnya' }).click();
      await settle(page);
      assert.strictEqual(await counter(page), '4/4');
      assert.match(await mainSrc(page), /kiri\.jpg/);
      await page.locator('.iz-gallery__main').hover();
      await page.getByRole('button', { name: 'Foto berikutnya' }).click();
      await settle(page);
      await page.getByText('Kiri', { exact: true }).first().click();
      await settle(page);
      assert.strictEqual(await counter(page), '4/4');
    });
    await page.goto(`${BASE}/produk`, { waitUntil: 'networkidle' });
    await check('B-16 catalog card of the 10-photo product uses photo 1', async () => {
      const card = page.locator('a[href="/produk/tas-uji-f022"] img').first();
      assert.match(await card.evaluate(i => i.currentSrc || i.src), /p1\.jpg/);
    });
    await check('B-17 variable/side/catalog pages: no console errors (except the catalog iz-rise hydration warning that staging already has)', async () => {
      const real = errs.filter(e => !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|favicon/i.test(e) && !/did not match[\s\S]*iz-rise iz-rise--wait/.test(e));
      assert.deepStrictEqual(real, []);
    });
  } else if (STAGING_VAR) {
    await page.goto(`${BASE}/produk/${STAGING_VAR}`, { waitUntil: 'networkidle' });
    await check(`B-13s staging variable ${STAGING_VAR}: counter matches thumbnails, arrows wrap`, async () => {
      const n = await page.locator('.iz-gallery .iz-thumb:not(.iz-thumb--placeholder)').count();
      assert.strictEqual(await counter(page), `1/${n}`);
      await page.locator('.iz-gallery__main').hover();
      await page.getByRole('button', { name: 'Foto sebelumnya' }).click();
      await settle(page);
      assert.strictEqual(await counter(page), `${n}/${n}`);
    });
  }
  await ctx.close();
}

async function uploader(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await wireImages(ctx);
  let n = 0;
  let failNext = false;
  let delay = 300;
  const uploads = [];
  await ctx.route('https://api.cloudinary.com/**', async route => {
    const body = route.request().postDataBuffer() || Buffer.alloc(0);
    // The uploader sends the compressed blob (filename "blob"), so test files carry their number in the image width
    // (u01 = 601 px ... u12 = 612 px); other files keep their multipart filename.
    let name = (/filename="([^"]+)"/.exec(body.toString('latin1')) || [])[1] || '?';
    const w = imageWidth(body);
    if (w > 600 && w <= 612) name = `u${String(w - 600).padStart(2, '0')}.jpg`;
    await new Promise(r => setTimeout(r, delay));
    if (failNext) { failNext = false; return route.fulfill({ status: 500, body: 'err' }); }
    n++;
    uploads.push(name);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: `https://res.cloudinary.com/dukddlp0b/image/upload/v1/f022/up${n}-${name}`, width: 600, height: 400 }) });
  });
  const page = await ctx.newPage();
  const errs = trackErrors(page);
  page.on('dialog', d => { errs.push('unexpected dialog: ' + d.message()); d.dismiss(); });
  await page.goto(`${BASE}/uji-dev/upload-foto`, { waitUntil: 'networkidle' });
  const ten = page.locator('#ten');
  const val = async (id = 'ten') => JSON.parse(await page.locator(`#${id}-value`).textContent());
  const up = f => UPLOADS[f];
  const items = () => ten.locator('.upload-multi-item');

  await check('H-1 pick 3 files at once: 3 uploads in picked order, numbered 1-3, "Utama" on photo 1, add box shows 3/10, progress shows batch "n/3"', async () => {
    assert.strictEqual(await ten.locator('input[type=file]').getAttribute('multiple'), '');
    const input = ten.locator('input[type=file]');
    await input.setInputFiles([up('u01.jpg'), up('u02.jpg'), up('u03.jpg')]);
    await ten.locator('.upload-progress-text').filter({ hasText: /\/3 · / }).first().waitFor({ timeout: 10000 });
    // Controls are locked while uploading.
    await page.waitForFunction(() => document.querySelectorAll('#ten .upload-multi-item').length === 3, null, { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress'), null, { timeout: 30000 });
    const v = await val();
    assert.strictEqual(v.length, 3);
    assert.deepStrictEqual(v.map(u => /up\d+-(u\d+)/.exec(u)[1]), ['u01', 'u02', 'u03']);
    assert.deepStrictEqual(await ten.locator('.upload-multi-num').allTextContents(), ['1', '2', '3']);
    assert.strictEqual(await ten.locator('.upload-multi-main').count(), 1);
    assert.strictEqual(await items().first().locator('.upload-multi-main').textContent(), 'Utama');
    assert.match(await ten.locator('.upload-area').getAttribute('aria-label'), /3 dari 10/);
    assert.strictEqual(await ten.locator('.upload-msg').count(), 0, 'no message when all uploaded');
    await page.screenshot({ path: path.join(SHOTS, 'harness-3.png') });
  });

  await check('H-2 pick 9 more (12 total): only 7 uploaded, message says 2 skipped (limit 10), add box hidden at 10/10', async () => {
    await ten.locator('input[type=file]').setInputFiles(['u04', 'u05', 'u06', 'u07', 'u08', 'u09', 'u10', 'u11', 'u12'].map(f => up(f + '.jpg')));
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress') && document.querySelectorAll('#ten .upload-multi-item').length === 10, null, { timeout: 60000 });
    const v = await val();
    assert.strictEqual(v.length, 10);
    assert.deepStrictEqual(v.map(u => /up\d+-(u\d+)/.exec(u)[1]), ['u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07', 'u08', 'u09', 'u10']);
    assert.strictEqual(await ten.locator('.upload-msg').textContent(), '7 foto berhasil diunggah. 2 foto tidak diunggah karena batasnya 10 foto.');
    assert.strictEqual(await ten.locator('.upload-area').count(), 0);
    assert.ok(!uploads.includes('u11.jpg') && !uploads.includes('u12.jpg'), 'skipped files never sent');
    await page.screenshot({ path: path.join(SHOTS, 'harness-10.png') });
  });

  await check('H-3 reorder with buttons: photo 1 → right, last → left; first-left and last-right disabled', async () => {
    const before = await val();
    assert.ok(await page.getByRole('button', { name: 'Geser gambar 1 ke kiri' }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Geser gambar 10 ke kanan' }).isDisabled());
    await page.getByRole('button', { name: 'Geser gambar 1 ke kanan' }).click();
    let v = await val();
    assert.deepStrictEqual(v.slice(0, 2), [before[1], before[0]]);
    await page.getByRole('button', { name: 'Geser gambar 10 ke kiri' }).click();
    v = await val();
    assert.deepStrictEqual(v.slice(8), [before[9], before[8]]);
    assert.strictEqual(await items().first().locator('.upload-multi-main').count(), 1, '"Utama" follows position 1');
  });

  await check('H-4 reorder by drag: drag photo 10 onto photo 1 → it becomes photo 1 (Utama)', async () => {
    const before = await val();
    await items().nth(9).dragTo(items().nth(0));
    await page.waitForTimeout(200);
    const v = await val();
    assert.strictEqual(v[0], before[9]);
    assert.deepStrictEqual(v.slice(1), before.slice(0, 9));
    assert.match(await items().first().locator('img').getAttribute('src'), new RegExp(before[9].split('/').pop().replace('.', '\\.')));
  });

  await check('H-5 remove photo 3: 9 left in order, add box back at 9/10', async () => {
    const before = await val();
    await page.getByRole('button', { name: 'Hapus gambar 3' }).click();
    const v = await val();
    assert.deepStrictEqual(v, [...before.slice(0, 2), ...before.slice(3)]);
    assert.match(await ten.locator('.upload-area').getAttribute('aria-label'), /9 dari 10/);
  });

  await check('H-6 drop 2 files from the computer onto the add box: 1 uploaded (room for 1), 1 skipped', async () => {
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      const blob = (name) => new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])], name, { type: 'image/jpeg' });
      d.items.add(blob('drop1.jpg'));
      d.items.add(blob('drop2.jpg'));
      return d;
    });
    await ten.locator('.upload-area').dispatchEvent('drop', { dataTransfer: dt });
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress') && document.querySelectorAll('#ten .upload-multi-item').length === 10, null, { timeout: 30000 });
    const v = await val();
    assert.match(v[9], /drop1\.jpg$/);
    assert.ok(!uploads.includes('drop2.jpg'));
    assert.strictEqual(await ten.locator('.upload-msg').textContent(), '1 foto berhasil diunggah. 1 foto tidak diunggah karena batasnya 10 foto.');
  });

  await check('H-7 bad files in a batch (gif, txt, 6 MB): good ones upload, each bad file named with its reason; Cloudinary 500 reported, list kept', async () => {
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Hapus gambar 1$/ }).click();
    assert.strictEqual((await val()).length, 6);
    await ten.locator('input[type=file]').setInputFiles([up('anim.gif'), up('u11.jpg'), up('notes.txt'), up('big.png'), up('u12.jpg')]);
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress'), null, { timeout: 60000 });
    await page.waitForTimeout(200);
    const v = await val();
    // GIF passes the image/* check and Cloudinary accepts it (unchanged pre-F-022 rule). txt and the 6 MB file are
    // refused before upload and take no slot, so all 3 good files fit the 4 free slots, in order.
    assert.strictEqual(v.length, 9);
    assert.deepStrictEqual(v.slice(6).map(u => u.split('-').slice(1).join('-')), ['anim.gif', 'u11.jpg', 'u12.jpg']);
    const msg = await ten.locator('.upload-msg').textContent();
    // gif passes the image/* check (Cloudinary accepts it); txt is not an image; big.png is over 5 MB.
    assert.match(msg, /^3 foto berhasil diunggah\. /);
    assert.match(msg, /notes\.txt: Format harus gambar \(JPG, PNG, WebP\)/);
    assert.match(msg, /big\.png: Ukuran maksimal 5MB/);
    failNext = true;
    const len = (await val()).length;
    await ten.locator('input[type=file]').setInputFiles([up('u01.jpg')]);
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress'), null, { timeout: 30000 });
    await page.waitForTimeout(200);
    assert.strictEqual((await val()).length, len);
    assert.match(await ten.locator('.upload-msg').textContent(), /u01\.png: Upload gagal\. Coba lagi\./);
  });

  await check('H-8 11 legacy photos in a max-10 list: alert asks to remove 1, add box hidden; removing one clears it', async () => {
    await page.locator('#seed11').click();
    assert.strictEqual(await ten.locator('.upload-msg--error').textContent(), 'Melebihi batas 10 foto. Hapus 1 foto sebelum menyimpan.');
    assert.strictEqual(await ten.locator('.upload-area').count(), 0);
    await page.getByRole('button', { name: 'Hapus gambar 11' }).click();
    assert.strictEqual(await ten.locator('.upload-msg--error').count(), 0);
  });

  const one = page.locator('#one');
  await check('H-9 max 1 (variant photo): single-file input, no reorder controls, dropping 2 files uploads only 1', async () => {
    assert.strictEqual(await one.locator('input[type=file]').getAttribute('multiple'), null);
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      for (const name of ['v1.jpg', 'v2.jpg']) d.items.add(new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' }));
      return d;
    });
    await one.locator('.upload-area').dispatchEvent('drop', { dataTransfer: dt });
    await page.waitForFunction(() => document.querySelectorAll('#one .upload-multi-item').length === 1 && !document.querySelector('#one .upload-progress'), null, { timeout: 30000 });
    const v = await val('one');
    assert.strictEqual(v.length, 1);
    assert.match(v[0], /v1\.jpg$/);
    assert.ok(!uploads.includes('v2.jpg'));
    assert.strictEqual(await one.locator('.upload-multi-move').count(), 0);
    assert.strictEqual(await one.locator('.upload-area').count(), 0);
    assert.strictEqual(await one.locator('[draggable="true"]').count(), 0);
  });

  await check('H-10 keyboard: add box is focusable and Enter opens the file picker', async () => {
    await page.getByRole('button', { name: 'Hapus gambar 1' }).last().click(); // empty the max-1 list
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
    await one.locator('.upload-area').focus();
    await page.keyboard.press('Enter');
    const fc = await chooser;
    assert.strictEqual(fc.isMultiple(), false);
    const chooser10 = page.waitForEvent('filechooser', { timeout: 5000 });
    await page.getByRole('button', { name: 'Hapus gambar 10' }).click();
    await ten.locator('.upload-area').focus();
    await page.keyboard.press(' ');
    assert.strictEqual((await chooser10).isMultiple(), true);
  });

  await check('H-12 form closed mid-batch (review REV-01): busy=1 while uploading; after unmount no more photos are written and busy returns to 0', async () => {
    while ((await val()).length > 7) await page.getByRole('button', { name: 'Hapus gambar 1' }).first().click();
    delay = 1500;
    await ten.locator('input[type=file]').setInputFiles([up('u01.jpg'), up('u02.jpg'), up('u03.jpg')]);
    await page.waitForFunction(() => document.querySelector('#busy').textContent === '1', null, { timeout: 10000 });
    await page.waitForFunction(() => JSON.parse(document.querySelector('#ten-value').textContent).length === 8, null, { timeout: 30000 });
    await page.locator('#toggle').click(); // the form closes: uploader unmounts with 2 files to go
    await page.waitForFunction(() => document.querySelector('#busy').textContent === '0', null, { timeout: 5000 });
    await page.waitForTimeout(4000); // the in-flight upload finishes in the background
    assert.strictEqual((await val()).length, 8, 'no write after unmount');
    delay = 300;
    await page.locator('#toggle').click();
    assert.strictEqual(await page.locator('#ten .upload-multi-item').count(), 8);
    assert.strictEqual(await page.locator('#busy').textContent(), '0');
  });

  await check('H-13 keyboard reorder keeps focus (review REV-02): Enter on "ke kanan" moves and focus follows; at the end it flips to "ke kiri"', async () => {
    const t = page.locator('#ten');
    const before = await val();
    await t.getByRole('button', { name: 'Geser gambar 2 ke kanan' }).focus();
    await page.keyboard.press('Enter');
    let v = await val();
    assert.deepStrictEqual(v.slice(1, 3), [before[2], before[1]]);
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Geser gambar 3 ke kanan');
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Geser gambar 4 ke kanan');
    await t.getByRole('button', { name: 'Geser gambar 7 ke kanan' }).focus();
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Geser gambar 8 ke kiri');
    await t.getByRole('button', { name: 'Geser gambar 2 ke kiri' }).focus();
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Geser gambar 1 ke kanan');
    v = await val();
    assert.strictEqual(v.length, 8);
    const r = await t.getByRole('button', { name: 'Geser gambar 3 ke kanan' }).boundingBox();
    assert.ok(r.width >= 24 && r.height >= 24, `arrow ${r.width}x${r.height}`);
  });

  await check('H-14 a file dropped on a thumbnail (not the add box) uploads and the page stays (review REV-D1)', async () => {
    const url = page.url();
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      d.items.add(new File([new Uint8Array([255, 216, 255, 224, 0, 16])], 'thumbdrop.jpg', { type: 'image/jpeg' }));
      return d;
    });
    await page.locator('#ten .upload-multi-item').nth(2).dispatchEvent('drop', { dataTransfer: dt });
    await page.waitForFunction(() => !document.querySelector('#ten .upload-progress') && JSON.parse(document.querySelector('#ten-value').textContent).length === 9, null, { timeout: 30000 });
    assert.match((await val())[8], /thumbdrop\.jpg$/);
    assert.strictEqual(page.url(), url);
  });

  await check('H-11 no alerts and no console errors in the uploader', async () => {
    const real = errs.filter(e => !/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED|favicon|Error compressing image/i.test(e));
    assert.deepStrictEqual(real, []);
  });
  await page.screenshot({ path: path.join(SHOTS, 'harness-end.png'), fullPage: true });
  await ctx.close();
}


function get(url) {
  return new Promise(res => { const r = http.get(url, x => { x.resume(); res(x.statusCode); }); r.on('error', () => res(0)); r.setTimeout(240000, () => { r.destroy(); res(0); }); });
}

(async () => {
  let server = null;
  let fixtureFile = null;
  if (MODE === 'local') {
    fixtureFile = path.join(os.tmpdir(), `f022-fixture-${process.pid}.json`);
    fs.writeFileSync(fixtureFile, JSON.stringify(FIXTURE));
    const env = { ...process.env, NODE_ENV: 'development', F016_FIXTURE: fixtureFile, NEXT_TELEMETRY_DISABLED: '1' };
    for (const k of ['API_KEY', 'APP_ID', 'AUTH_DOMAIN', 'MESSAGING_SENDER_ID', 'PROJECT_ID', 'STORAGE_BUCKET'])
      env[`NEXT_PUBLIC_FIREBASE_${k}`] = env[`NEXT_PUBLIC_FIREBASE_${k}`] || (k === 'APP_ID' ? '1:1:web:1' : 'dummy');
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT)], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let log = '';
    server.stdout.on('data', d => { log += d; });
    server.stderr.on('data', d => { log += d; });
    const t0 = Date.now();
    while (!(await get(`${BASE}/uji-dev/upload-foto`) === 200)) {
      if (Date.now() - t0 > 300000 || server.exitCode !== null) { console.error(log.slice(-3000)); throw new Error('next dev did not start'); }
      await new Promise(r => setTimeout(r, 1000));
    }
    // Compile every route once before timing-sensitive checks.
    for (const p of ['/produk/tas-uji-f022', '/produk/tas-variasi-f022', '/produk/side-uji-f022', '/produk/tas-satu-foto-f022', '/produk']) await get(BASE + p);
  }
  const browser = await chromium.launch();
  try {
    await storefront(browser);
    await variableAndEdge(browser);
    if (MODE === 'local') await uploader(browser);
  } finally {
    await browser.close();
    if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } }
    if (fixtureFile) fs.rmSync(fixtureFile, { force: true });
  }
  const failed = results.filter(r => r[0] === 'FAIL');
  for (const f of failed) console.log('FAIL', f[1]);
  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
