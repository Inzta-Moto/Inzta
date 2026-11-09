// F-023 browser tests (Playwright): affiliate login and dashboard. Starts `next dev` twice: once normally (login,
// dashboard states, interactions), once with the dev-only error switch (F016_FIXTURE + F016_STATE=error, see
// app/affiliate/(panel)/dashboard/page.tsx) for the error state. Logs in through the real form against the Firebase
// project in .env.local (inzta-dev); it only reads Firestore. Never point it at inzta.id.
//
// Credentials never live in this repo. Pass them as environment variables:
//   F023_EMAIL_BERISI / F023_PASS_BERISI            7 commissions, active voucher
//   F023_EMAIL_KOSONG / F023_PASS_KOSONG            0 commissions, active voucher
//   F023_EMAIL_KEDALUWARSA / F023_PASS_KEDALUWARSA  expired voucher
//   F023_EMAIL_TANPA / F023_PASS_TANPA              no voucher
// or with --accounts <file> pointing at the private markdown table (Email and Password columns, password in backticks).
//
// Usage: node tests/f023-browser.cjs --shots <dir> [--accounts <file>] [--port 3023] [--only main|error]
//        [--no-server] (use a dev server already running on --port; main phase only)
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
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const flag = (name) => args.includes(`--${name}`);
const ROOT = path.join(__dirname, '..');
const PORT = Number(opt('port') || 3023);
const BASE = `http://localhost:${PORT}`;
const SHOTS = opt('shots') || path.join(os.tmpdir(), 'f023-shots');
const ONLY = opt('only');
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [320, 360, 768, 1024, 1440];
const height = (w) => (w < 768 ? 844 : w < 1024 ? 1024 : 900);
// Inline links inside a sentence are exempt from the 44 px target rule (WCAG 2.5.8 inline exception).
const TARGET_EXCEPTIONS = ['.iz-aff-login__forgot a', '.iz-aff-login__join a', '.iz-aff-warn__link'];

function loadAccounts() {
  const keys = { berisi: 'BERISI', kosong: 'KOSONG', kedaluwarsa: 'KEDALUWARSA', tanpa: 'TANPA' };
  const out = {};
  for (const [k, env] of Object.entries(keys)) {
    if (process.env[`F023_EMAIL_${env}`] && process.env[`F023_PASS_${env}`]) out[k] = { email: process.env[`F023_EMAIL_${env}`], pass: process.env[`F023_PASS_${env}`] };
  }
  const file = opt('accounts');
  if (file) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const cells = line.split('|').map((c) => c.trim());
      const email = cells.find((c) => /^[^\s@`]+@[^\s@`]+$/.test(c));
      const pass = cells.map((c) => c.match(/^`([^`]+)`$/)).find((m) => m && cells.indexOf(m.input) > cells.indexOf(email));
      if (!email || !pass) continue;
      const k = email.includes('tanpa') ? 'tanpa' : email.includes('kedaluwarsa') ? 'kedaluwarsa' : email.includes('kosong') ? 'kosong' : email.includes('berisi') ? 'berisi' : null;
      if (k && !out[k]) out[k] = { email, pass: pass[1] };
    }
  }
  const missing = Object.keys(keys).filter((k) => !out[k]);
  if (missing.length) throw new Error(`missing test accounts: ${missing.join(', ')} (set F023_EMAIL_*/F023_PASS_* or --accounts)`);
  return out;
}

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
    record(false, name, e && e.message);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function get(url) {
  return new Promise((res) => {
    const r = http.get(url, (x) => { x.resume(); res(x.statusCode); });
    r.on('error', () => res(0));
    r.setTimeout(240000, () => { r.destroy(); res(0); });
  });
}

async function startServer(extraEnv) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  delete env.F016_FIXTURE;
  delete env.F016_STATE;
  delete env.NODE_ENV;
  Object.assign(env, extraEnv);
  const server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT)], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const t0 = Date.now();
  while ((await get(`${BASE}/affiliate/login`)) !== 200) {
    if (Date.now() - t0 > 300000 || server.exitCode !== null) {
      console.error(log.slice(-3000));
      throw new Error('next dev did not start');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return server;
}

function stopServer(server) {
  if (!server) return;
  // next dev forks workers; on Windows only taskkill /T takes the whole tree down.
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  } else {
    try { server.kill('SIGTERM'); } catch {}
  }
}

async function newContext(browser, width, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: height(width) }, deviceScaleFactor: 1, ...extra });
  await ctx.route(/googletagmanager|google-analytics|connect\.facebook/, (r) => r.abort());
  return ctx;
}

// Console errors and hydration warnings per page. The failed sign-in request of the wrong-password case and the
// forced dev error are expected, so they are filtered here and named in the check that causes them.
function trackConsole(page) {
  const errs = [];
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const text = m.text();
    if (/identitytoolkit|securetoken/.test(url)) return;
    if (/\[dev-fixture\]|F016_STATE=error/.test(text)) return;
    if (m.type() === 'error' || /hydrat|did not match/i.test(text)) errs.push(`${m.type()}: ${text.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => { if (!/\[dev-fixture\]/.test(e.message)) errs.push('pageerror: ' + e.message.slice(0, 200)); });
  return errs;
}

async function hydrated(page, selector) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps') || k.startsWith('__reactFiber'));
  }, selector, { timeout: 120000 });
}

// The dev overlay and build indicator are not part of the page.
async function stripDevUi(page) {
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()));
}

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
  await stripDevUi(page);
}

async function shot(page, name, { full = true } = {}) {
  await stripDevUi(page);
  // The password field must stay masked in every screenshot.
  const masked = await page.evaluate(() => [...document.querySelectorAll('#aff-login-password')].every((i) => i.type === 'password'));
  if (!masked) throw new Error(`${name}: password field is not masked`);
  // Park the pointer so a hover style on whatever ended up under it does not show in the capture.
  await page.mouse.move(1, 1);
  await page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });
}

/** Layout checks run on every captured state. */
async function layoutChecks(page, label) {
  const r = await page.evaluate((exceptions) => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') return false;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return false;
      // Skip anything inside a visually hidden wrapper or an inert part of the page.
      for (let p = el; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.display === 'none' || ps.visibility === 'hidden' || Number(ps.opacity) === 0) return false;
        if (p.classList && p.classList.contains('iz-aff-sr-only')) return false;
      }
      return true;
    };
    const px = (v) => (v && v.endsWith('px') ? parseFloat(v) : 0);
    const small = [];
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [tabindex]:not([tabindex="-1"])';
    const dialog = document.querySelector('dialog[open]');
    for (const el0 of document.querySelectorAll(sel)) {
      if (dialog && !dialog.contains(el0)) continue;
      if (exceptions.some((x) => el0.matches(x))) continue;
      // A visually hidden radio is operated through its label.
      let el = el0;
      if (el0.matches('input[type=radio], input[type=checkbox]') && el0.closest('label')) el = el0.closest('label');
      if (!visible(el)) continue;
      const b = el.getBoundingClientRect();
      // Hit areas extended by an absolutely positioned ::before with negative insets count (segments, Order ID copy).
      const pb = getComputedStyle(el, '::before');
      let w = b.width;
      let h = b.height;
      if (pb.content !== 'none' && pb.position === 'absolute') {
        w = Math.max(w, b.width - Math.min(0, px(pb.left)) - Math.min(0, px(pb.right)));
        h = Math.max(h, b.height - Math.min(0, px(pb.top)) - Math.min(0, px(pb.bottom)));
      }
      // A cell button inside a clickable table row: the row is the target.
      const row = el.closest('tr.iz-aff-table__row');
      if (row) h = Math.max(h, row.getBoundingClientRect().height);
      if (w < 43.5 || h < 43.5) small.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(w)}x${Math.round(h)}`);
    }
    return { sw: Math.max(doc.scrollWidth, document.body.scrollWidth), vw, h1: document.querySelectorAll('h1').length, small };
  }, TARGET_EXCEPTIONS);
  record(r.sw <= r.vw, `${label}: no horizontal scroll`, `scrollWidth ${r.sw}, innerWidth ${r.vw}`);
  record(r.h1 === 1, `${label}: one h1`, `${r.h1} h1`);
  record(r.small.length === 0, `${label}: visible targets >= 44x44`, r.small.slice(0, 6).join('; '));
}

function consoleCheck(errs, label) {
  record(errs.length === 0, `${label}: console without errors or hydration warnings`, errs.slice(0, 3).join(' | '));
  errs.length = 0;
}

async function fillLogin(page, email, pass) {
  // A submit before hydration would be a native GET with the password in the URL, so wait for React first.
  await hydrated(page, 'form.iz-aff-login__form');
  await page.fill('#aff-login-email', email);
  await page.fill('#aff-login-password', pass);
}

/** Logs in through the form and returns the storage state (session cookie + localStorage). */
async function login(browser, acc) {
  const ctx = await newContext(browser, 390);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/affiliate/login`);
  await fillLogin(page, acc.email, acc.pass);
  await page.click('form.iz-aff-login__form button[type=submit]');
  await page.waitForURL('**/affiliate/dashboard', { timeout: 120000 });
  await page.waitForSelector('h1.iz-aff-hero__title', { timeout: 120000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function openDashboard(browser, state, width, extra = {}) {
  const ctx = await newContext(browser, width, { storageState: state, ...extra });
  const page = await ctx.newPage();
  const errs = trackConsole(page);
  await page.goto(`${BASE}/affiliate/dashboard`);
  await page.waitForSelector('h1.iz-aff-hero__title', { timeout: 120000 });
  await hydrated(page, '.iz-aff-header__btn');
  await settle(page);
  return { ctx, page, errs };
}

const visibleRows = (page) => page.evaluate(() => [...document.querySelectorAll('.iz-aff-row, .iz-aff-table__row')].filter((e) => e.getBoundingClientRect().height > 0).length);

async function focusChecks(page, label, presses) {
  const bad = [];
  const seen = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      return { name: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`, ring, outline: `${s.outlineStyle} ${s.outlineWidth}` };
    });
    if (!f) continue;
    seen.push(f.name);
    if (!f.ring) bad.push(`${f.name} (${f.outline})`);
  }
  record(seen.length > 0 && bad.length === 0, `${label}: focus ring visible on ${seen.length} tabbed controls`, bad.join('; '));
}

async function loginScreens(browser) {
  for (const w of [...WIDTHS, 390]) {
    const ctx = await newContext(browser, w);
    const page = await ctx.newPage();
    const errs = trackConsole(page);
    await page.goto(`${BASE}/affiliate/login`);
    await hydrated(page, 'form.iz-aff-login__form');
    await settle(page);
    await shot(page, `login-normal-${w}`);
    await layoutChecks(page, `login normal ${w}`);
    consoleCheck(errs, `login normal ${w}`);
    if (w === 1440 || w === 390) await focusChecks(page, `login ${w}`, 6);
    await ctx.close();
  }
  for (const w of [390, 1440]) {
    const ctx = await newContext(browser, w);
    const page = await ctx.newPage();
    const errs = trackConsole(page);
    await page.goto(`${BASE}/affiliate/login`);
    // A made-up address on the reserved .test domain: a wrong password on a real test account would count toward
    // Firebase's lockout for that account.
    await fillLogin(page, 'salah-f023@inzta.test', 'bukan-password-uji');
    await page.click('form.iz-aff-login__form button[type=submit]');
    await page.waitForSelector('.iz-aff-login__error', { timeout: 60000 });
    await settle(page);
    await check(`login error ${w}: message focused, fields marked invalid`, async () => {
      const r = await page.evaluate(() => ({
        focus: document.activeElement && document.activeElement.id,
        invalid: document.querySelector('#aff-login-password').getAttribute('aria-invalid'),
        text: document.querySelector('.iz-aff-login__error').textContent,
      }));
      expect(r.focus === 'aff-login-error', `focus on ${r.focus}`);
      expect(r.invalid === 'true', 'aria-invalid');
      expect(/Email atau password salah/.test(r.text), r.text);
    });
    await shot(page, `login-error-${w}`);
    await layoutChecks(page, `login error ${w}`);
    consoleCheck(errs, `login error ${w}`);
    if (w === 390) {
      await check('login: eye button keeps its name and toggles aria-pressed, password masked again after', async () => {
        const eye = page.locator('.iz-aff-login__eye');
        expect((await eye.getAttribute('aria-label')) === 'Tampilkan password', 'label');
        expect((await eye.getAttribute('aria-pressed')) === 'false', 'pressed false');
        await eye.click();
        expect((await eye.getAttribute('aria-label')) === 'Tampilkan password', 'label after press');
        expect((await eye.getAttribute('aria-pressed')) === 'true', 'pressed true');
        await eye.click();
        expect((await page.locator('#aff-login-password').getAttribute('type')) === 'password', 'masked');
      });
    }
    await ctx.close();
  }
}

async function dashboardScreens(browser, states) {
  for (const [key, label] of [['berisi', 'berisi'], ['kosong', 'kosong']]) {
    for (const w of [...WIDTHS, 390]) {
      const { ctx, page, errs } = await openDashboard(browser, states[key], w);
      await shot(page, `dashboard-${label}-${w}`);
      await layoutChecks(page, `dashboard ${label} ${w}`);
      consoleCheck(errs, `dashboard ${label} ${w}`);
      if (key === 'berisi' && (w === 390 || w === 1440)) await focusChecks(page, `dashboard ${w}`, 10);
      await ctx.close();
    }
  }
  for (const [key, label] of [['kedaluwarsa', 'kedaluwarsa'], ['tanpa', 'tanpa-voucher']]) {
    for (const w of [390, 1440]) {
      const { ctx, page, errs } = await openDashboard(browser, states[key], w);
      await shot(page, `dashboard-${label}-${w}`);
      await layoutChecks(page, `dashboard ${label} ${w}`);
      consoleCheck(errs, `dashboard ${label} ${w}`);
      await ctx.close();
    }
  }
}

async function detailAndFilters(browser, state) {
  // Phone: list rows open a bottom sheet; Escape closes it and focus returns to the row.
  {
    const { ctx, page, errs } = await openDashboard(browser, state, 390);
    const row = page.locator('.iz-aff-row').first();
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.waitForSelector('dialog[open] .iz-aff-modal__panel');
    await page.waitForTimeout(900);
    await shot(page, 'detail-berisi-390', { full: false });
    await layoutChecks(page, 'detail sheet 390');
    await check('detail 390: Escape closes the sheet, focus back on the row', async () => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const back = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('iz-aff-row') && document.activeElement === document.querySelector('.iz-aff-row'));
      expect(back, 'focus is not on the first row');
    });

    const total = await visibleRows(page);
    await check('filter 390: search narrows the list, no match shows the reset', async () => {
      const title = (await page.locator('.iz-aff-row .iz-aff-row__title').first().textContent()).trim();
      await page.fill('.iz-aff-toolbar__input', title);
      await page.waitForTimeout(200);
      const n = await visibleRows(page);
      expect(n > 0 && n < total, `search "${title}": ${n} of ${total}`);
      await page.fill('.iz-aff-toolbar__input', 'zzz-tidak-ada');
      await page.waitForSelector('.iz-aff-nomatch');
      await page.click('.iz-aff-nomatch button');
      expect((await visibleRows(page)) === total, 'reset restores every row');
      return `${n} of ${total}`;
    });
    await check('filter 390: status segment changes the row count', async () => {
      await page.locator('.iz-aff-toolbar__seg [role=radio]').nth(2).click();
      await page.waitForTimeout(200);
      const n = await visibleRows(page);
      await page.locator('.iz-aff-toolbar__seg [role=radio]').nth(0).click();
      expect(n > 0 && n < total, `${n} of ${total}`);
      return `${n} of ${total}`;
    });
    await check('filter 390: sheet month choice changes the row count, Escape returns focus', async () => {
      const btn = page.locator('.iz-aff-toolbar__filter');
      await btn.click();
      await page.waitForSelector('dialog[open] .iz-aff-sheet');
      await page.waitForTimeout(900);
      await shot(page, 'filter-berisi-390', { full: false });
      await layoutChecks(page, 'filter sheet 390');
      await page.locator('dialog[open] .iz-aff-opt').nth(1).click();
      await page.locator('dialog[open] .iz-aff-btn--primary').click();
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const n = await visibleRows(page);
      expect(n > 0 && n < total, `month: ${n} of ${total}`);
      await btn.click();
      await page.waitForSelector('dialog[open] .iz-aff-sheet');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const back = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('iz-aff-toolbar__filter'));
      expect(back, 'focus not back on the filter button');
      return `${n} of ${total}`;
    });
    consoleCheck(errs, 'detail and filters 390');
    await ctx.close();
  }
  // Desktop: table rows open a dialog; toolbar on one row.
  {
    const { ctx, page, errs } = await openDashboard(browser, state, 1440);
    const open = page.locator('.iz-aff-table__open').first();
    await open.scrollIntoViewIfNeeded();
    await open.click();
    await page.waitForSelector('dialog[open] .iz-aff-modal__panel');
    await page.waitForTimeout(900);
    await shot(page, 'detail-berisi-1440', { full: false });
    await layoutChecks(page, 'detail dialog 1440');
    await check('detail 1440: Escape closes the dialog, focus back on the row button', async () => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      const back = await page.evaluate(() => document.activeElement === document.querySelector('.iz-aff-table__open'));
      expect(back, 'focus is not on the first row button');
    });
    const total = await visibleRows(page);
    await check('filter 1440: month menu and status segment change the row count', async () => {
      const values = await page.locator('.iz-aff-toolbar__select option').evaluateAll((o) => o.map((x) => x.value));
      await page.selectOption('.iz-aff-toolbar__select', values[1]);
      await page.waitForTimeout(200);
      const m = await visibleRows(page);
      await page.selectOption('.iz-aff-toolbar__select', 'all');
      await page.locator('.iz-aff-toolbar__seg [role=radio]').nth(1).click();
      await page.waitForTimeout(200);
      const s = await visibleRows(page);
      await page.locator('.iz-aff-toolbar__seg [role=radio]').nth(0).click();
      expect(m > 0 && m < total, `month ${m} of ${total}`);
      expect(s > 0 && s < total, `status ${s} of ${total}`);
      return `month ${m}, pending ${s}, of ${total}`;
    });
    await check('filter 1440: search narrows the table', async () => {
      const title = (await page.locator('.iz-aff-table__row .iz-aff-row__title').first().textContent()).trim();
      await page.fill('.iz-aff-toolbar__input', title);
      await page.waitForTimeout(200);
      const n = await visibleRows(page);
      await page.fill('.iz-aff-toolbar__input', '');
      expect(n > 0 && n < total, `${n} of ${total}`);
      return `${n} of ${total}`;
    });
    consoleCheck(errs, 'detail and filters 1440');
    await ctx.close();
  }
}

async function copyToastAndMotion(browser, state) {
  {
    const { ctx, page, errs } = await openDashboard(browser, state, 390, { permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await check('copy 390: "Salin link" writes https://inzta.id/?aff=<kode> and shows the toast', async () => {
      const code = (await page.locator('.iz-aff-ticket__code').textContent()).trim();
      await page.click('.iz-aff-ticket__actions .iz-aff-btn--primary');
      await page.waitForSelector('.iz-aff-toast__pill[data-open="true"]');
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip === `https://inzta.id/?aff=${code}`, `clipboard "${clip}"`);
      const toast = (await page.locator('.iz-aff-toast__pill').textContent()).trim();
      expect(toast === 'Link disalin', `toast "${toast}"`);
      await page.waitForTimeout(250);
      await shot(page, 'dashboard-salin-berhasil-390', { full: false });
    });
    consoleCheck(errs, 'copy 390');
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await openDashboard(browser, state, 390, { reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await check('reduced motion: shimmer, toast, and modal do not animate', async () => {
      const skel = await page.evaluate(() => {
        const s = document.createElement('span');
        s.className = 'iz-aff-skel';
        document.querySelector('.iz-aff').appendChild(s);
        const a = getComputedStyle(s, '::after');
        const r = { display: a.display, name: a.animationName };
        s.remove();
        return r;
      });
      expect(skel.display === 'none' || skel.name === 'none', `shimmer ${JSON.stringify(skel)}`);
      await page.click('.iz-aff-ticket__actions .iz-aff-btn--primary');
      const toast = await page.evaluate(() => {
        const s = getComputedStyle(document.querySelector('.iz-aff-toast__pill'));
        return { dur: s.transitionDuration, transform: s.transform };
      });
      expect(toast.dur.split(',').every((d) => parseFloat(d) === 0) && (toast.transform === 'none'), `toast ${JSON.stringify(toast)}`);
      await page.locator('.iz-aff-row').first().click();
      await page.waitForSelector('dialog[open] .iz-aff-modal__panel');
      const modal = await page.evaluate(() => ['.iz-aff-modal__panel', '.iz-aff-modal__scrim'].map((q) => getComputedStyle(document.querySelector(q)).animationName));
      expect(modal.every((n) => n === 'none'), `modal ${modal}`);
      await page.keyboard.press('Escape');
    });
    consoleCheck(errs, 'reduced motion 390');
    await ctx.close();
  }
}

async function loadingScreens(browser, state) {
  // loading.tsx streams first while page.tsx verifies the session and reads Firestore (real latency, typically about
  // a second against inzta-dev). The capture is taken while the skeleton is still in the DOM; retried if it was gone.
  for (const w of [390, 1440]) {
    let done = false;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      const ctx = await newContext(browser, w, { storageState: state });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/affiliate/dashboard`, { waitUntil: 'commit' });
      try {
        await page.waitForSelector('.iz-aff-ticket--skel', { timeout: 30000 });
        await stripDevUi(page);
        await page.screenshot({ path: path.join(SHOTS, `dashboard-memuat-${w}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
        done = (await page.locator('.iz-aff-ticket--skel').count()) > 0;
      } catch {
        done = false;
      }
      await ctx.close();
    }
    record(done, `loading ${w}: skeleton captured while page.tsx was still loading`);
  }
}

async function logoutCheck(browser, state) {
  const { ctx, page, errs } = await openDashboard(browser, state, 390);
  await check('logout: clears the three localStorage keys and lands on /affiliate/login', async () => {
    const before = await page.evaluate(() => ['inzta_affiliate', 'is_affiliate_logged_in', 'inzta_affiliate_own'].map((k) => localStorage.getItem(k)));
    expect(before[1] === 'true', `before: is_affiliate_logged_in=${before[1]}`);
    await page.click('.iz-aff-header__btn:not(.iz-aff-header__btn--plain)');
    await page.waitForURL('**/affiliate/login', { timeout: 60000 });
    const after = await page.evaluate(() => ['inzta_affiliate', 'is_affiliate_logged_in', 'inzta_affiliate_own'].map((k) => localStorage.getItem(k)));
    expect(after.every((v) => v === null), `after: ${JSON.stringify(after)}`);
    // The session cookie is gone too: the dashboard sends us back to the login page.
    await page.goto(`${BASE}/affiliate/dashboard`);
    expect(/\/affiliate\/login$/.test(new URL(page.url()).pathname), `dashboard after logout: ${page.url()}`);
  });
  consoleCheck(errs, 'logout');
  await ctx.close();
}

async function errorScreens(browser, state) {
  for (const w of [...WIDTHS, 390]) {
    const { ctx, page, errs } = await (async () => {
      const ctx = await newContext(browser, w, { storageState: state });
      const page = await ctx.newPage();
      const errs = trackConsole(page);
      await page.goto(`${BASE}/affiliate/dashboard`);
      await page.waitForSelector('.iz-aff-error', { timeout: 120000 });
      await settle(page);
      return { ctx, page, errs };
    })();
    await shot(page, `dashboard-error-${w}`);
    await layoutChecks(page, `dashboard error ${w}`);
    // The dev overlay reports the forced error itself; only other console errors count.
    consoleCheck(errs.filter((e) => !/forced error|dev-fixture|The above error occurred|error boundary/i.test(e)), `dashboard error ${w}`);
    if (w === 390) {
      await check('error 390: retry and chat actions, header still offers Keluar', async () => {
        expect((await page.locator('.iz-aff-error .iz-aff-btn--primary').count()) === 1, 'retry button');
        expect((await page.locator('.iz-aff-error a[href*="wa.me"], .iz-aff-error a[href*="whatsapp"]').count()) === 1, 'chat link');
        expect((await page.locator('.iz-aff-header__btn:not(.iz-aff-header__btn--plain)').count()) === 1, 'logout');
      });
    }
    await ctx.close();
  }
}

(async () => {
  const accounts = loadAccounts();
  const browser = await chromium.launch();
  let server = null;
  let fixture = null;
  try {
    if (ONLY !== 'error') {
      if (!flag('no-server')) server = await startServer({});
      await loginScreens(browser);
      const states = {};
      for (const k of Object.keys(accounts)) states[k] = await login(browser, accounts[k]);
      record(true, 'login through the form for all four accounts');
      await loadingScreens(browser, states.berisi);
      await dashboardScreens(browser, states);
      await detailAndFilters(browser, states.berisi);
      await copyToastAndMotion(browser, states.berisi);
      await logoutCheck(browser, states.kosong);
      stopServer(server);
      server = null;
    }
    if (ONLY !== 'main') {
      fixture = path.join(os.tmpdir(), `f023-fixture-${process.pid}.json`);
      fs.writeFileSync(fixture, JSON.stringify({ products: [], articles: [] }));
      server = await startServer({ F016_FIXTURE: fixture, F016_STATE: 'error' });
      const state = await login(browser, accounts.berisi);
      await errorScreens(browser, state);
    }
  } finally {
    await browser.close();
    stopServer(server);
    if (fixture) fs.rmSync(fixture, { force: true });
  }
  const failed = results.filter((r) => r[0] === 'FAIL');
  console.log('\nSummary');
  for (const f of failed) console.log(`FAIL  ${f[1]} :: ${f[2]}`);
  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
