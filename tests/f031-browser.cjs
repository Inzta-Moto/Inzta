// F-031 browser tests (Playwright): warranty entries on /, /produk, and a product page; /garansi layout, claim form
// (errors and focus, HEIC refused, upload progress with a stubbed Cloudinary, success panel, WhatsApp video link), the
// switch to #masukan and the feedback form; privacy sections and sitemap. Widths 320, 360, 375, 768, 1024, 1440.
// Starts `next dev` with an invented product fixture (lib/v2/dev-fixture.ts) and no Firebase credentials; every
// warranty API call and the Cloudinary upload are answered by page.route stubs, so nothing is written anywhere.
// Usage: npm run test:warranty-browser -- --shots <dir> [--port 3031] [--no-server]
// Needs the Playwright package and Chromium (global install is fine, as for tests/f022-browser.cjs).
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium } = playwright;

const args = process.argv.slice(2);
const opt = name => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const ROOT = path.join(__dirname, '..');
const PORT = Number(opt('port') || 3031);
const BASE = `http://localhost:${PORT}`;
const SHOTS = opt('shots') || path.join(os.tmpdir(), 'f031-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [320, 360, 375, 768, 1024, 1440];
// Navbar widths of D-W2 (Sehan, 2026-11-11: icon on small phones, button after the logo from 1024 px replacing the
// menu link, text link at 768-1023 px and in the phone menu).
const NAV_WIDTHS = [320, 360, 375, 390, 430, 460, 768, 900, 1024, 1100, 1280, 1440, 1600];
// Expected form of the entry after the logo; a chosen motor widens its chip, so the entry takes a shorter form there.
function expectedSlot(w, motor) {
  if (w < 360 || (w >= 768 && w < 1024)) return 'hidden';
  if (motor && w >= 400 && w < 460) return 'hidden';
  if (w < 460 || (motor && w < 560) || (motor && w >= 1024 && w < 1200)) return 'icon';
  if (w < 1440 || (motor && w < 1600)) return 'short';
  return 'long';
}
// 768-899 px already wrapped "Produk", "Pilih motor", and "Chat admin" before F-031 (F-030 cart icon); F-031 keeps
// that range from growing, the fix itself is a follow-up outside this spec.
const PREEXISTING_WRAP = w => w >= 768 && w < 900;
const height = w => (w < 768 ? 844 : w < 1024 ? 1024 : 900);
const HEIC_MSG = 'Foto format HEIC belum bisa diunggah. Ubah ke JPG, atau kirim fotonya lewat WhatsApp admin.';

const FIXTURE = {
  articles: [],
  products: [
    { slug: 'tail-bag-uji-f031', name: 'Tail bag uji F-031 (contoh)', productType: 'simple', price: 450000, compareAtPrice: null, stock: 5, images: ['/logo-inzta.png'], features: [], badge: null, isActive: true, description: 'Data karangan', category: 'softcase', createdAt: '2026-11-10T00:00:00.000Z' },
    { slug: 'tank-bag-uji-f031', name: 'Tank bag uji F-031 (contoh)', productType: 'simple', price: 380000, compareAtPrice: null, stock: 3, images: ['/logo-inzta.png'], features: [], badge: null, isActive: true, description: 'Data karangan', category: 'softcase', createdAt: '2026-11-09T00:00:00.000Z' },
  ],
};

const results = [];
function record(ok, name, detail = '') {
  results.push([ok ? 'PASS' : 'FAIL', name, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    record(true, name, typeof detail === 'string' ? detail : '');
  } catch (e) {
    record(false, name, e && e.message ? e.message.split('\n')[0] : String(e));
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}
function get(url) {
  return new Promise(res => {
    const r = http.get(url, x => { x.resume(); res(x.statusCode); });
    r.on('error', () => res(0));
    r.setTimeout(240000, () => { r.destroy(); res(0); });
  });
}
function fetchText(url) {
  return new Promise((res, rej) => {
    http.get(url, x => { let d = ''; x.on('data', c => (d += c)); x.on('end', () => res(d)); }).on('error', rej);
  });
}

// Tiny valid PNG so the compression library can decode it.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Stubs for every warranty endpoint; returns the captured request bodies. */
async function stubApis(ctx, o = {}) {
  const seen = { claims: [], feedback: [], signatures: 0, uploads: 0, signBodies: [] };
  // External hosts (product photos, GA4, fonts) are answered locally, so the run never waits on the network.
  await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u.href) && !u.href.startsWith('https://api.cloudinary.com/'), r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
  await ctx.route('**/api/garansi/form-token', r => r.fulfill({ json: { token: 'token-uji' } }));
  await ctx.route('**/api/garansi/upload-signature', r => {
    seen.signatures++;
    seen.signBodies.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill({ json: { cloudName: 'cloud-uji', apiKey: 'kunci-uji', timestamp: 1, signature: 'tanda-uji', folder: 'garansi-staging/', publicId: `garansi-staging/${'U'.repeat(20)}${seen.signatures}xyz`, allowedFormats: 'jpg,png,webp', type: 'authenticated', overwrite: false, maxBytes: 10485760 } });
  });
  await ctx.route('https://api.cloudinary.com/**', async r => {
    seen.uploads++;
    const n = seen.uploads;
    await new Promise(res => setTimeout(res, o.uploadDelay ?? 1500));
    return r.fulfill({ json: { public_id: `garansi-staging/${'U'.repeat(20)}${n}xyz`, version: 1731300000 + n, width: 1600, height: 1200, format: 'jpg', type: 'authenticated' } });
  });
  await ctx.route('**/api/garansi', r => {
    const body = JSON.parse(r.request().postData() || '{}');
    seen.claims.push(body);
    if (o.claimAnswer) return r.fulfill(o.claimAnswer(body));
    return r.fulfill({ status: 201, json: { ticket: 'GRN-UJ2345' } });
  });
  await ctx.route('**/api/masukan', r => {
    seen.feedback.push(JSON.parse(r.request().postData() || '{}'));
    return r.fulfill({ status: 201, json: { ref: 'MSK-UJ6789' } });
  });
  return seen;
}

// The forms are client islands: typing before React hydrates would be lost, so wait for React's props on the field.
async function hydrated(page, sel = '#gr-name') {
  await page.waitForFunction(s => { const el = document.querySelector(s); return !!el && Object.keys(el).some(k => k.startsWith('__reactProps')); }, sel, { timeout: 60000 });
}

async function navMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.iz-nav');
    const vis = el => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    const r = el => el.getBoundingClientRect();
    const slot = document.querySelector('.iz-navgaransi');
    const links = document.querySelector('.iz-nav__links');
    const actions = document.querySelector('.iz-nav__actions');
    const start = document.querySelector('.iz-nav__start');
    const items = links ? [...links.children].filter(vis) : [];
    const tops = [...new Set(items.map(e => Math.round(r(e).top)))];
    const nr = r(nav);
    const overlap = (a, b) => a && b && vis(a) && vis(b) && r(a).right > r(b).left + 0.5 && r(a).left < r(b).right - 0.5;
    const lastRight = items.length ? Math.max(...items.map(e => r(e).right)) : r(start).right;
    return {
      noHScroll: document.documentElement.scrollWidth <= innerWidth,
      slot: vis(slot),
      slotMode: !vis(slot) ? 'hidden' : (() => {
        const shown = el => vis(el) && getComputedStyle(el).position !== 'absolute';
        return shown(slot.querySelector('.iz-navgaransi__long')) ? 'long' : shown(slot.querySelector('.iz-navgaransi__short')) ? 'short' : 'icon';
      })(),
      slotName: slot ? slot.textContent.replace(/\s+/g, ' ').trim() : '',
      slotH: slot && vis(slot) ? Math.round(r(slot).height) : null,
      slotHit: slot && vis(slot) ? (() => { const a = getComputedStyle(slot, '::after'); return a.content !== 'none' ? Math.round(r(slot).height - 2 * parseFloat(a.top || '0')) : Math.round(r(slot).height); })() : null,
      linkGaransi: !!links && vis(links) && !!links.querySelector('a[href="/garansi"]') && vis(links.querySelector('a[href="/garansi"]')),
      affiliate: !!links && vis(links.querySelector('a[href="/affiliate/login"]')),
      linksVisible: vis(links),
      oneRow: tops.length <= 1,
      startOverlapsLinks: !!(vis(links) && overlap(start, links)),
      startOverlapsActions: !!overlap(start, actions),
      linksOverlapActions: vis(links) ? lastRight > r(actions).left + 0.5 : false,
      actionsInside: r(actions).right <= nr.right + 0.5 && r(start).left >= nr.left - 0.5,
      cart: vis(document.querySelector('.iz-navcart')),
      cta: vis(document.querySelector('.iz-nav__cta')),
      navOverflow: Math.round(Math.max(0, nav.scrollWidth - nav.clientWidth)),
      // Only the logo: the cart badge, the animated CTA label, and the entry's touch area overflow their boxes by design.
      squeezed: [...document.querySelectorAll('.iz-brand')].filter(vis).filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className),
      wrapped: [...document.querySelectorAll('.iz-brand, .iz-navgaransi, .iz-nav__links > a, .iz-navdd__btn, .iz-nav__cta')].filter(vis).filter(el => {
        const tops = new Set();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim() || getComputedStyle(n.parentElement).position === 'absolute') continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const rect of rg.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top / 4));
        }
        const mids = [...el.children].filter(vis).map(k => { const b = k.getBoundingClientRect(); return b.top + b.height / 2; });
        return tops.size > 1 || (mids.length > 1 && Math.max(...mids) - Math.min(...mids) > 10);
      }).map(el => el.textContent.trim().slice(0, 20)),
    };
  });
}

async function entries(browser) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  await stubApis(ctx);
  const page = await ctx.newPage();
  for (const [label, p] of [['beranda', '/'], ['produk', '/produk'], ['detail', '/produk/tail-bag-uji-f031'], ['garansi', '/garansi']]) {
    for (const chip of [null, 'adventure']) {
      if (chip) await page.evaluate(c => { try { localStorage.setItem('inzta.motorCategory', c); } catch {} }, chip);
      else await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }).then(() => page.evaluate(() => { try { localStorage.removeItem('inzta.motorCategory'); } catch {} }));
      for (const w of NAV_WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await page.goto(BASE + p, { waitUntil: 'load', timeout: 180000 });
        await page.waitForTimeout(200);
        // The motor modifier is set after hydration, from the saved category.
        if (chip) await page.waitForSelector('.iz-nav.iz-nav--motor', { timeout: 30000 });
        const m = await navMetrics(page);
        const tag = `${label} ${w}px${chip ? ' (motor dipilih)' : ''}`;
        await check(`W7/1.6 navbar ${tag}: no horizontal scroll, one row, no label wraps, nothing overlaps, cart stays`, async () => {
          expect(m.noHScroll, 'horizontal scroll');
          if (!PREEXISTING_WRAP(w)) expect(m.wrapped.length === 0, `labels wrap: ${m.wrapped.join(', ')}`);
          if (!PREEXISTING_WRAP(w)) expect(m.squeezed.length === 0, `logo squeezed below its natural width: ${m.squeezed.join(', ')}`);
          expect(m.oneRow, 'links wrap');
          expect(!m.startOverlapsLinks && !m.startOverlapsActions && !m.linksOverlapActions, JSON.stringify(m));
          expect(m.actionsInside && m.navOverflow === 0, `outside capsule ${JSON.stringify(m)}`);
          expect(m.cart, 'cart icon missing');
          if (w >= 768) expect(m.cta, '"Chat admin" missing');
        });
        const want = expectedSlot(w, Boolean(chip));
        await check(`W7/1.1–1.2 D-W2 navbar ${tag}: entry after the logo ${want}; menu link only at 768-1023; Affiliate rule kept`, async () => {
          expect(m.slotMode === want, `entry ${m.slotMode}, expected ${want}`);
          expect(m.linkGaransi === (w >= 768 && w < 1024), `menu link visible=${m.linkGaransi} at ${w}`);
          if (w >= 1024) expect(m.slot, 'no Garansi entry on desktop');
          if (m.slot) {
            expect(m.slotName.startsWith('Garansi'), `accessible text "${m.slotName}"`);
            expect(m.slotHit >= 44, `touch area ${m.slotHit}px`);
          }
          expect(m.affiliate === (w >= 1024), `affiliate visible=${m.affiliate} at ${w}`);
          return `slot=${m.slot}`;
        });
        if (!chip && [320, 460, 768, 1024, 1440, 1600].includes(w)) await page.screenshot({ path: path.join(SHOTS, `nav-${label}-${w}.png`), clip: { x: 0, y: 0, width: w, height: 120 } });
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await check('W7/1.1 phone menu has Garansi next to Artikel, Tentang, Affiliate', async () => {
    await page.click('.iz-nav__menu');
    await page.waitForSelector('#iz-msheet');
    const labels = await page.$$eval('.iz-msheet__links a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
    expect(JSON.stringify(labels) === JSON.stringify([['Artikel', '/blog'], ['Tentang', '/tentang'], ['Garansi', '/garansi'], ['Affiliate', '/affiliate/login']]), JSON.stringify(labels));
    await page.screenshot({ path: path.join(SHOTS, 'menu-375.png') });
    await page.keyboard.press('Escape');
  });
  await check('W7/1.1 footer "Informasi" has Garansi and Kirim masukan', async () => {
    const links = await page.$$eval('.iz-footer a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
    expect(links.some(([t, h]) => t === 'Garansi' && h === '/garansi'), 'Garansi');
    expect(links.some(([t, h]) => t === 'Kirim masukan' && h === '/garansi#masukan'), 'Kirim masukan');
  });
  await check('W7/1.4 Cara pesan pill on the Beranda carries the buy box value and links to /garansi', async () => {
    const pill = await page.$eval('#cara-pesan a.iz-infopill', a => [a.textContent.trim(), a.getAttribute('href')]).catch(() => null);
    expect(pill && pill[0] === 'Garansi 6 bulan · Cara klaim' && pill[1] === '/garansi', JSON.stringify(pill));
  });
  for (const w of [375, 1440]) {
    await page.setViewportSize({ width: w, height: height(w) });
    await page.goto(BASE + '/produk/tail-bag-uji-f031', { waitUntil: 'load' });
    await check(`W7/1.4 product buy box ${w}px: "Garansi 6 bulan · Cara klaim" link to /garansi, 44 px target, no scroll`, async () => {
      const pill = await page.$eval('.iz-buybox__info a.iz-infopill', a => ({ t: a.textContent.trim(), h: a.getAttribute('href'), hh: a.getBoundingClientRect().height }));
      expect(pill.t === 'Garansi 6 bulan · Cara klaim' && pill.h === '/garansi', JSON.stringify(pill));
      expect(pill.hh >= 44, `height ${pill.hh}`);
      expect(await page.evaluate(() => !document.body.innerText.includes('Garansi: tanya admin')), 'old placeholder still shown');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal scroll');
    });
    await page.screenshot({ path: path.join(SHOTS, `produk-buybox-${w}.png`), fullPage: false });
  }
  await ctx.close();
}

async function garansiPage(browser) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: height(w) }, reducedMotion: 'reduce' });
    await stubApis(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + '/garansi', { waitUntil: 'load' });
    await check(`W8/2.1 /garansi ${w}px: heading, switch, three steps, claim form, feedback section, side card; no horizontal scroll`, async () => {
      const s = await page.evaluate(() => ({
        h1: document.querySelector('h1')?.textContent.trim(),
        switch: [...document.querySelectorAll('.iz-gr-switch a')].map(a => a.getAttribute('href')),
        steps: [...document.querySelectorAll('.iz-gr-steps li')].map(li => li.textContent.trim()),
        claim: !!document.querySelector('#klaim form'),
        feedback: !!document.querySelector('#masukan form'),
        side: !!document.querySelector('.iz-gr-side a[href^="https://wa.me/"]'),
        noScroll: document.documentElement.scrollWidth <= innerWidth,
      }));
      expect(s.h1 === 'Klaim Garansi', s.h1);
      expect(JSON.stringify(s.switch) === '["#klaim","#masukan"]', JSON.stringify(s.switch));
      expect(s.steps.length === 3 && s.steps[0].endsWith('Isi formulir') && s.steps[2].endsWith('Kami hubungi lewat WhatsApp'), JSON.stringify(s.steps));
      expect(s.claim && s.feedback && s.side, JSON.stringify(s));
      expect(s.noScroll, 'horizontal scroll');
    });
    await check(`W8/2.7 /garansi ${w}px: every control has a 44 px target and a label`, async () => {
      const bad = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.iz-gr input:not([type=hidden]):not(.iz-sr):not([tabindex="-1"]), .iz-gr select, .iz-gr textarea')) {
          const id = el.id;
          const labelled = (id && document.querySelector(`label[for="${id}"]`)) || el.closest('label');
          if (!labelled) out.push(`no label: ${el.outerHTML.slice(0, 80)}`);
        }
        const targets = document.querySelectorAll('.iz-gr button, .iz-gr .iz-gr-chip span, .iz-gr select, .iz-gr .iz-gr-input, .iz-gr .iz-gr-add, .iz-gr-switch a, .iz-gr .iz-btn');
        for (const t of targets) {
          const r = t.getBoundingClientRect();
          if (r.width && r.height < 44) out.push(`${t.className || t.tagName} ${Math.round(r.height)}px`);
        }
        return out;
      });
      expect(bad.length === 0, bad.join('; '));
    });
    await page.screenshot({ path: path.join(SHOTS, `garansi-${w}.png`), fullPage: true });
    await ctx.close();
  }
}

async function claimFlow(browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
  const seen = await stubApis(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '/garansi', { waitUntil: 'load' });
  await hydrated(page);
  await page.evaluate(() => { try { sessionStorage.clear(); } catch {} });

  await check('W8/2.4 empty submit: errors next to fields in plain Indonesian, focus on the first (Nama), no request', async () => {
    await page.click('#klaim button[type=submit]');
    await page.waitForSelector('#gr-name-err');
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(focus === 'gr-name', `focus on ${focus}`);
    const s = await page.evaluate(() => ({
      name: document.querySelector('#gr-name-err')?.textContent,
      described: document.querySelector('#gr-name').getAttribute('aria-describedby'),
      invalid: document.querySelector('#gr-name').getAttribute('aria-invalid'),
      photos: document.querySelector('#gr-photos-err')?.textContent,
      alert: document.querySelector('#klaim [role=alert]')?.textContent,
    }));
    expect(s.name === 'Isi nama lengkap Anda.', s.name);
    expect(s.described.includes('gr-name-err') && s.invalid === 'true', JSON.stringify(s));
    expect(s.photos === 'Unggah minimal 1 foto kerusakan.', s.photos);
    expect(s.alert === 'Ada isian yang perlu diperbaiki.', s.alert);
    expect(seen.claims.length === 0, 'request sent');
    await page.screenshot({ path: path.join(SHOTS, 'klaim-error-375.png'), fullPage: true });
  });

  await check('W8/2.3a HEIC refused before upload with the 2.3a message; picker accepts JPG/PNG/WebP only', async () => {
    const accept = await page.getAttribute('#gr-photos input[type=file]', 'accept');
    expect(accept === 'image/jpeg,image/png,image/webp', accept);
    await page.setInputFiles('#gr-photos input[type=file]', { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('heic-uji') });
    await page.waitForFunction(m => document.querySelector('#gr-photos-err')?.textContent === m, HEIC_MSG);
    expect(seen.signatures === 0 && seen.uploads === 0, 'HEIC reached the upload');
  });

  await check('W8/2.3 upload: per-photo progress, submit locked while uploading, then done; remove works', async () => {
    await page.setInputFiles('#gr-photos input[type=file]', [{ name: 'kerusakan-1.png', mimeType: 'image/png', buffer: PNG_1PX }, { name: 'kerusakan-2.png', mimeType: 'image/png', buffer: PNG_1PX }]);
    await page.waitForSelector('.iz-gr-photo[data-status=uploading] [role=progressbar]');
    expect(await page.isDisabled('#klaim button[type=submit]'), 'submit not locked during upload');
    await page.waitForFunction(() => document.querySelectorAll('.iz-gr-photo[data-status=done]').length === 2, null, { timeout: 30000 });
    expect(!(await page.isDisabled('#klaim button[type=submit]')), 'submit still locked');
    const live = await page.textContent('#gr-photos [aria-live=polite]');
    expect(/terunggah/.test(live), `live region: ${live}`);
    await page.click('button[aria-label="Hapus foto 2"]');
    expect((await page.$$('.iz-gr-photo')).length === 1, 'remove failed');
    expect(!(await page.$('#gr-photos-err')), 'HEIC error should clear after a good pick');
    expect(seen.signBodies.length === 2 && seen.signBodies.every(b => b.formToken === 'token-uji'), `signature requests carry the form token: ${JSON.stringify(seen.signBodies)}`);
  });

  await check('W8/2.2 filled form: request carries only allowed keys, photos from Cloudinary, raw number; 3.5a hint shown for an old date', async () => {
    await page.fill('#gr-name', 'Budi Contoh');
    await page.fill('#gr-whatsapp', '0812-3456-7890');
    await page.fill('#gr-location', 'Kota Contoh');
    await page.selectOption('#gr-product', 'tail-bag-uji-f031');
    await page.check('#gr-channel input[value=shopee]');
    await page.fill('#gr-purchaseDate', '2025-01-15');
    await page.waitForSelector('.iz-gr-note');
    await page.fill('#gr-orderRef', 'INV-0001');
    await page.check('#gr-usage input[value="6-12"]');
    await page.check('#gr-damage input[value=resleting]');
    await page.check('#gr-damage input[value=jahitan]');
    await page.fill('#gr-description', 'Resleting utama macet sejak minggu lalu dan jahitan samping mulai lepas.');
    await page.check('text=Saya punya video kerusakan');
    await page.check('#gr-consent');
    await page.click('#klaim button[type=submit]');
    await page.waitForSelector('#gr-success-title');
    const b = seen.claims[0];
    const allowed = ['name', 'whatsapp', 'location', 'product', 'productOther', 'channel', 'purchaseDate', 'orderRef', 'usage', 'damage', 'description', 'photos', 'videoViaWhatsApp', 'consent', 'formToken', 'trap'];
    expect(Object.keys(b).every(k => allowed.includes(k)), Object.keys(b).join(','));
    // Two uploads ran in parallel and one was removed; the kept one must carry its own Cloudinary answer.
    const n = b.photos.length === 1 && /^garansi-staging\/U{20}(\d)xyz$/.exec(b.photos[0].publicId);
    expect(n && b.photos[0].version === 1731300000 + Number(n[1]) && b.photos[0].width === 1600, JSON.stringify(b.photos));
    expect(!JSON.stringify(b.photos).includes('http'), 'URL in photos');
    expect(b.whatsapp === '0812-3456-7890' && b.formToken === 'token-uji' && b.trap === '' && b.videoViaWhatsApp === true && b.consent === true, JSON.stringify(b));
    expect(JSON.stringify(b.damage) === '["resleting","jahitan"]', JSON.stringify(b.damage));
  });

  await check('W8/2.5–2.6 success panel: ticket, copy button, advice, video via WhatsApp with the prefilled text, chat admin; focus on the heading', async () => {
    const s = await page.evaluate(() => ({
      focus: document.activeElement && document.activeElement.id,
      ticket: document.querySelector('.iz-gr-ticket strong')?.textContent,
      text: document.querySelector('.iz-gr-success').innerText,
      links: [...document.querySelectorAll('.iz-gr-success a')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
      copy: !!document.querySelector('.iz-gr-success button'),
    }));
    expect(s.focus === 'gr-success-title', `focus ${s.focus}`);
    expect(s.ticket === 'GRN-UJ2345', s.ticket);
    expect(s.text.includes('Simpan nomor tiket ini untuk menanyakan status ke admin.') && s.text.includes('Tim INZTA akan menghubungi Anda lewat WhatsApp.'), s.text);
    const video = s.links.find(([t]) => t === 'Kirim video lewat WhatsApp');
    expect(video && decodeURIComponent(video[1].split('text=')[1]) === 'Halo INZTA, saya kirim video untuk klaim garansi GRN-UJ2345.', JSON.stringify(video));
    expect(s.links.some(([t]) => t === 'Chat admin INZTA'), 'chat admin');
    expect(s.copy, 'copy button');
    expect(!/gratis|100%|dijamin/i.test(s.text), 'absolute promise in success text');
    await page.screenshot({ path: path.join(SHOTS, 'klaim-sukses-375.png'), fullPage: false });
  });

  await check('W8/2.4 draft: typed text survives a reload (sessionStorage), cleared after success', async () => {
    const draft = await page.evaluate(() => { try { return sessionStorage.getItem('inzta.garansi.draft'); } catch { return 'blocked'; } });
    expect(draft === null, `draft after success: ${draft}`);
    await page.goto(BASE + '/garansi', { waitUntil: 'load' });
    await hydrated(page);
    await page.fill('#gr-name', 'Draf Contoh');
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' });
    await hydrated(page);
    await page.waitForFunction(() => document.querySelector('#gr-name').value === 'Draf Contoh', null, { timeout: 10000 }).catch(() => {});
    expect((await page.inputValue('#gr-name')) === 'Draf Contoh', 'draft not restored');
    await page.evaluate(() => { try { sessionStorage.clear(); } catch {} });
  });

  await check('W8 no console errors on /garansi', async () => {
    const real = errs.filter(e => !/favicon|Failed to load resource|Download the React DevTools/i.test(e));
    expect(real.length === 0, real.join(' | ').slice(0, 300));
  });
  await ctx.close();
}

async function serverErrors(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await stubApis(ctx, { uploadDelay: 100, claimAnswer: () => ({ status: 400, json: { error: 'x', code: 'INVALID', fields: { whatsapp: 'Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.' } } }) });
  const page = await ctx.newPage();
  await page.goto(BASE + '/garansi', { waitUntil: 'load' });
  await hydrated(page);
  await check('W8/2.4 server field errors (400) appear at the field, focus moves there, input kept', async () => {
    await page.fill('#gr-name', 'Budi Contoh');
    await page.fill('#gr-whatsapp', '081234567890');
    await page.fill('#gr-location', 'Kota Contoh');
    await page.selectOption('#gr-product', 'lainnya');
    await page.fill('#gr-productOther', 'Tas lama (contoh)');
    await page.check('#gr-channel input[value=website]');
    await page.check('#gr-usage input[value=lt1]');
    await page.fill('#gr-description', 'Tali pengikat putus setelah dua minggu dipakai harian.');
    await page.setInputFiles('#gr-photos input[type=file]', { name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.waitForSelector('.iz-gr-photo[data-status=done]', { timeout: 30000 });
    await page.check('#gr-consent');
    await page.click('#klaim button[type=submit]');
    await page.waitForSelector('#gr-whatsapp-err');
    expect((await page.evaluate(() => document.activeElement.id)) === 'gr-whatsapp', 'focus');
    expect((await page.inputValue('#gr-description')).startsWith('Tali pengikat'), 'input lost');
  });
  await ctx.close();
}

async function feedbackFlow(browser) {
  for (const w of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: height(w) }, reducedMotion: 'reduce' });
    const seen = await stubApis(ctx);
    const page = await ctx.newPage();
    await page.goto(BASE + '/garansi', { waitUntil: 'load' });
    await hydrated(page, '#mk-message');
    await check(`W8b/10.1 ${w}px switch to "Kirim masukan" goes to #masukan and marks it current`, async () => {
      await page.click('.iz-gr-switch a[href="#masukan"]');
      await page.waitForFunction(() => location.hash === '#masukan');
      expect((await page.getAttribute('.iz-gr-switch a[href="#masukan"]', 'aria-current')) === 'true', 'aria-current');
      const top = await page.evaluate(() => document.querySelector('#masukan').getBoundingClientRect().top);
      expect(top < 200, `section top ${top}`);
    });
    await check(`W8b/10.2 ${w}px empty submit: kind, message, consent errors; focus on the kind chips`, async () => {
      await page.click('#masukan button[type=submit]');
      await page.waitForSelector('#mk-kind-err');
      expect((await page.evaluate(() => document.activeElement.id)) === 'mk-kind', 'focus');
      expect(await page.$('#mk-message-err') && await page.$('#mk-consent-err'), 'missing errors');
      expect(seen.feedback.length === 0, 'request sent');
    });
    await check(`W8b/10.4 ${w}px filled feedback: success with reference and contact line`, async () => {
      await page.check('#mk-kind input[value=saran]');
      await page.fill('#mk-message', 'Tolong tambah pilihan warna hijau army untuk tail bag.');
      await page.fill('#mk-whatsapp', '0812 1111 2222');
      await page.check('#mk-consent');
      await page.click('#masukan button[type=submit]');
      await page.waitForSelector('#mk-success-title');
      const t = await page.innerText('#masukan .iz-gr-success');
      expect(t.includes('Terima kasih, masukan Anda sudah kami terima.') && t.includes('MSK-UJ6789') && t.includes('Tim INZTA bisa menghubungi Anda lewat nomor ini.'), t);
      const b = seen.feedback[0];
      expect(Object.keys(b).every(k => ['kind', 'message', 'product', 'productOther', 'name', 'whatsapp', 'consent', 'formToken', 'trap'].includes(k)), Object.keys(b).join(','));
      await page.screenshot({ path: path.join(SHOTS, `masukan-sukses-${w}.png`), fullPage: false });
    });
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
  await stubApis(ctx);
  const page = await ctx.newPage();
  await check('W8b/10.1 /garansi#masukan opens at the feedback form (banner URL)', async () => {
    await page.goto(BASE + '/garansi#masukan', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const top = await page.evaluate(() => document.querySelector('#masukan').getBoundingClientRect().top);
    expect(top < 200 && top > -50, `top ${top}`);
  });
  await ctx.close();
}

async function seoAndPrivacy() {
  await check('W8/2.1 metadata: own title, description, canonical https://inzta.id/garansi', async () => {
    const html = await fetchText(BASE + '/garansi');
    expect(/<title>Klaim Garansi dan Kirim Masukan \| INZTA Moto<\/title>/.test(html), 'title');
    expect(html.includes('<link rel="canonical" href="https://inzta.id/garansi"/>'), 'canonical');
    expect(/<meta name="description" content="[^"]*Garansi 6 bulan/.test(html), 'description');
    expect(!/noindex/.test(html), 'noindex on /garansi');
    expect(html.includes('Klaim Garansi') && html.includes('Isi formulir'), 'not server-rendered');
  });
  await check('W8/2.1 sitemap lists /garansi', async () => {
    const xml = await fetchText(BASE + '/sitemap.xml');
    expect(xml.includes('/garansi</loc>'), 'missing');
  });
  await check('W9/8.1 privacy page has the warranty (#garansi) and feedback (#masukan) sections', async () => {
    const html = await fetchText(BASE + '/kebijakan-privasi');
    expect(html.includes('id="garansi"') && html.includes('id="masukan"'), 'sections missing');
    expect(/belum dihapus otomatis/.test(html), 'retention line');
  });
}

(async () => {
  let server = null;
  let fixtureFile = null;
  if (!args.includes('--no-server')) {
    fixtureFile = path.join(os.tmpdir(), `f031-fixture-${process.pid}.json`);
    fs.writeFileSync(fixtureFile, JSON.stringify(FIXTURE));
    const env = { ...process.env, NODE_ENV: 'development', F016_FIXTURE: fixtureFile, NEXT_TELEMETRY_DISABLED: '1' };
    for (const k of ['API_KEY', 'APP_ID', 'AUTH_DOMAIN', 'MESSAGING_SENDER_ID', 'PROJECT_ID', 'STORAGE_BUCKET'])
      env[`NEXT_PUBLIC_FIREBASE_${k}`] = env[`NEXT_PUBLIC_FIREBASE_${k}`] || (k === 'APP_ID' ? '1:1:web:1' : 'dummy');
    server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT)], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let log = '';
    server.stdout.on('data', d => { log += d; });
    server.stderr.on('data', d => { log += d; });
    const t0 = Date.now();
    while ((await get(`${BASE}/garansi`)) !== 200) {
      if (Date.now() - t0 > 300000 || server.exitCode !== null) { console.error(log.slice(-3000)); throw new Error('next dev did not start'); }
      await new Promise(r => setTimeout(r, 1000));
    }
    for (const p of ['/', '/produk', '/produk/tail-bag-uji-f031', '/kebijakan-privasi', '/sitemap.xml']) await get(BASE + p);
  }
  const browser = await chromium.launch();
  try {
    await seoAndPrivacy();
    await entries(browser);
    await garansiPage(browser);
    await claimFlow(browser);
    await serverErrors(browser);
    await feedbackFlow(browser);
  } finally {
    await browser.close();
    if (server) {
      try {
        if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
        else process.kill(-server.pid, 'SIGTERM');
      } catch { server.kill('SIGTERM'); }
    }
    if (fixtureFile) fs.rmSync(fixtureFile, { force: true });
  }
  const failed = results.filter(r => r[0] === 'FAIL');
  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
