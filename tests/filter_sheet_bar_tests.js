#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE PHONE FILTERS SHEET ENDS ABOVE THE BOTTOM BAR — 2026-11-14 (filtersheet)
//
// Lars Brown, Report a problem, 2026-11-14 (iPhone, Safari, 402×812): "The
// filter pop-up view is mostly blocked while using iPhone." His screenshot:
// the Filters sheet's header and search box showed, and everything under
// them — the type chips, Clear, the Filters count, Show results — sat behind
// the bottom menu bar. Why: the sheet (browse.js _rrFilterSheetOpen) is
// parked inside .main for its light palette, and .main is a stacking layer
// (z 0) BELOW the bottom bar (z 800), so no z-index inside it can win. The
// pop-ups had the same trouble in v0.9.1036 and got the same answer: end
// ABOVE the bar's MEASURED cover (--rr-bottom-bar, back-stack.js).
//
//   B  the real app in Chromium at iPhone (34px home bar) and Android sizes:
//      My Collection → Filters — the panel's bottom is above the bar's top,
//      and the search box, the ×, every chip button and Show results are the
//      element really on top at their centre (tappable); a sheet with more in
//      it than fits is capped between the top bar and the bottom bar and
//      scrolls; sideways too; the computer is untouched (no sheet).
//   P  planted offenders: the two CSS lines removed → red; the panel back to
//      content-box → a full sheet's top leaves the screen → red; the bar made
//      40px taller → still green (measured, not guessed).
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  filter_sheet_bar_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const SIZES = [
  { n: 'iPhone 402x812 (34px home bar, Lars\'s size)', w: 402, h: 812, hb: 34, top: 47, ua: UA_IPHONE },
  { n: 'iPhone 390x844 (34px home bar)', w: 390, h: 844, hb: 34, top: 47, ua: UA_IPHONE },
  { n: 'Android 412x915', w: 412, h: 915, hb: 0, ua: UA_ANDROID },
];

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  async function boot(S, served) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, isMobile: !!S.ua, hasTouch: !!S.ua, userAgent: S.ua || undefined });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    const pg = await ctx.newPage();
    if (S.ua) {
      const cdp = await ctx.newCDPSession(pg);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: S.top || 0, bottom: S.hb || 0, left: 0, right: 0 } });
    }
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await ctx.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) return r.abort();
      const name = u.split('?')[0].split('/').pop();
      if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForTimeout(2200);
    await pg.evaluate(SEED); await pg.waitForTimeout(300);
    return { ctx, pg, errs };
  }

  // My Collection → the Filters button → measure the sheet against the bar
  async function sheet(pg) {
    await pg.evaluate(() => { try { showPage('browse', document.getElementById('mnav-collection')); filterOwned(); } catch (e) { window.__e = e.message; } });
    await pg.waitForTimeout(700);
    const btn = await pg.$('#rr-filter-btn');
    if (btn) { await btn.click(); await pg.waitForTimeout(500); }
    const r = await pg.evaluate(() => {
      const ov = document.getElementById('rr-filter-sheet'), p = document.getElementById('rr-filter-panel'), nav = document.querySelector('.mobile-nav');
      const navOn = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().top < innerHeight;
      const navTop = navOn ? Math.round(nav.getBoundingClientRect().top) : innerHeight;
      if (!ov || !p) return { e: window.__e || null, has: false, filterBtn: !!document.getElementById('rr-filter-btn'), rowInline: !!document.querySelector('#page-browse > #hierarchy-chip-row'), navOn: !!navOn };
      const pr = p.getBoundingClientRect();
      const onTop = x => { const q = x.getBoundingClientRect(); if (!q.width || !q.height) return null; const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { t: (x.textContent || '').trim().slice(0, 14) || x.getAttribute('aria-label') || x.id || x.tagName, ok: !!(t && (x === t || x.contains(t))), by: t ? (t.id || String(t.className).slice(0, 24) || t.tagName) : 'none', bottom: Math.round(q.bottom) }; };
      const parts = [];
      const search = document.getElementById('browse-search'); if (search) parts.push(onTop(search));
      Array.from(p.querySelectorAll('button')).forEach(b => { const o = onTop(b); if (o) parts.push(o); });
      const bar = document.documentElement.style.getPropertyValue('--rr-bottom-bar');
      const cover = navOn ? Math.round(innerHeight - nav.getBoundingClientRect().top) : 0;
      return { e: window.__e || null, has: true, panelBottom: Math.round(pr.bottom), panelTop: Math.round(pr.top), navTop, H: innerHeight, parts, bar, cover, navOn: !!navOn,
               showResults: parts.some(x => /Show results/.test(x.t)), chips: parts.filter(x => !/Show results|×|Close/.test(x.t)).length };
    });
    await pg.evaluate(() => { try { _rrFilterSheetClose(); } catch (e) {} });
    return r;
  }
  const good = r => r.has && !r.e && r.navOn && r.panelBottom <= r.navTop && r.panelBottom <= r.H && r.showResults && r.chips >= 2 && r.parts.length >= 4 && r.parts.every(x => x.ok);

  // a sheet with MORE in it than fits (review 2026-11-14): the panel caps at its height and scrolls — its top
  // stays on screen and the × stays tappable; the bottom still ends above the bar. (A content-box panel with
  // its own padding grew 32px past the cap and pushed the header under the app's top bar.)
  async function tall(pg) {
    await pg.evaluate(() => { try { showPage('browse', document.getElementById('mnav-collection')); filterOwned(); } catch (e) { window.__e = e.message; } });
    await pg.waitForTimeout(700);
    const btn = await pg.$('#rr-filter-btn');
    if (btn) { await btn.click(); await pg.waitForTimeout(400); }
    const r = await pg.evaluate(() => {
      const ob = document.getElementById('offline-banner'); if (ob) ob.style.display = 'none';   // the test runs offline; the banner is not part of the sheet
      const p = document.getElementById('rr-filter-panel'), row = document.getElementById('hierarchy-chip-row'), nav = document.querySelector('.mobile-nav');
      if (!p || !row) return { has: false, e: window.__e || null };
      const filler = document.createElement('div'); filler.id = 'rr-test-filler'; filler.style.cssText = 'height:900px;background:transparent'; row.appendChild(filler);
      const pr = p.getBoundingClientRect(); const navTop = Math.round(nav.getBoundingClientRect().top);
      const x = p.querySelector('button[aria-label="Close"]'); const q = x.getBoundingClientRect(); const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      const hd = document.querySelector('.header'); const headBottom = hd ? Math.round(hd.getBoundingClientRect().bottom) : 0;
      const out = { has: true, panelTop: Math.round(pr.top), headBottom, panelBottom: Math.round(pr.bottom), navTop, H: innerHeight, scrolls: p.scrollHeight > p.clientHeight + 2, closeOk: !!(t && (x === t || x.contains(t))), by: t ? (t.id || String(t.className).slice(0, 24) || t.tagName) : 'none' };
      filler.remove(); return out;
    });
    await pg.evaluate(() => { try { _rrFilterSheetClose(); } catch (e) {} });
    return r;
  }
  const tallOk = r => r.has && r.panelTop >= r.headBottom && r.scrolls && r.closeOk && r.panelBottom <= r.navTop;

  // ── B ──────────────────────────────────────────────────────────────────────
  for (const S of SIZES) {
    const b = await boot(S);
    const r = await sheet(b.pg);
    ok('B1 ' + S.n + ' — the Filters sheet ends above the bottom bar and every control in it can be tapped', good(r), JSON.stringify(r));
    ok('B2 ' + S.n + ' — --rr-bottom-bar is the bar\'s measured cover (' + r.cover + 'px)', r.navOn && r.bar === r.cover + 'px', 'bar=' + r.bar + ' cover=' + r.cover);
    const t = await tall(b.pg);
    ok('B2b ' + S.n + ' — a sheet with more in it than fits: capped, scrolls, its top and × on screen, bottom above the bar', tallOk(t), JSON.stringify(t));
    ok('B3 ' + S.n + ' — no page errors', !b.errs.length, [...new Set(b.errs)].slice(0, 3).join(' | '));
    await b.ctx.close();
  }
  {
    const S = { n: 'iPhone sideways 812x402 (34px home bar)', w: 812, h: 402, hb: 34, top: 0, ua: UA_IPHONE };
    const b = await boot(S);
    const r = await b.pg.evaluate(() => { try { showPage('browse', document.getElementById('mnav-collection')); filterOwned(); _rrFilterSheetOpen(); } catch (e) { return { e: e.message }; } return {}; });
    await b.pg.waitForTimeout(500);
    const t = await b.pg.evaluate(() => {
      const ob = document.getElementById('offline-banner'); if (ob) ob.style.display = 'none';
      const p = document.getElementById('rr-filter-panel'), nav = document.querySelector('.mobile-nav');
      if (!p) return { has: false };
      const pr = p.getBoundingClientRect(); const navOn = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().top < innerHeight;
      const x = p.querySelector('button[aria-label="Close"]'); const q = x.getBoundingClientRect(); const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      const hd = document.querySelector('.header'); const headBottom = hd ? Math.round(hd.getBoundingClientRect().bottom) : 0;
      return { has: true, panelTop: Math.round(pr.top), headBottom, panelBottom: Math.round(pr.bottom), navTop: navOn ? Math.round(nav.getBoundingClientRect().top) : innerHeight, H: innerHeight, closeOk: !!(el && (x === el || x.contains(el))), scrolls: p.scrollHeight > p.clientHeight + 2 };
    });
    ok('B2c ' + S.n + ' — opened sideways (by code; the button is a separate matter): the panel is capped above the bar, its top and × on screen', t.has && !r.e && t.panelTop >= t.headBottom && t.panelBottom <= t.navTop && t.closeOk, JSON.stringify(Object.assign(t, r)));
    await b.ctx.close();
  }
  {
    const b = await boot({ n: 'computer 1400x900', w: 1400, h: 900 });
    const r = await sheet(b.pg);
    ok('B4 computer — no Filters button, no sheet; the filter row stays inline', !r.has && !r.filterBtn && r.rowInline, JSON.stringify(r));
    await b.ctx.close();
  }

  // ── P ──────────────────────────────────────────────────────────────────────
  const CSS = read('app.css');
  {
    let css = plant(CSS, '  #rr-filter-sheet { padding-bottom: calc(var(--rr-bottom-bar) + 7px); }\n', '', 'P1 sheet room');
    css = plant(css, '  #rr-filter-sheet > #rr-filter-panel {\n    max-height: calc(100vh - var(--rr-bottom-bar) - var(--header-h) - env(safe-area-inset-top, 0px) - 30px);\n    max-height: calc(100dvh - var(--rr-bottom-bar) - var(--header-h) - env(safe-area-inset-top, 0px) - 30px);\n  }\n', '', 'P1 panel height');
    const b = await boot(SIZES[0], { 'app.css': css });
    const r = await sheet(b.pg);
    ok('P1 the two CSS lines removed → the sheet is behind the bar again on Lars\'s iPhone (B1 red)', r.has && !good(r) && r.panelBottom > r.navTop, JSON.stringify(r));
    await b.ctx.close();
  }
  {
    const css = plant(CSS, '#rr-filter-panel { box-sizing: border-box; max-height: 85vh; max-height: 85dvh; }', '#rr-filter-panel { max-height: 85vh; max-height: 85dvh; }', 'P3 content-box');
    const b = await boot(SIZES[0], { 'app.css': css });
    const t = await tall(b.pg);
    ok('P3 the panel back to content-box → a full sheet grows 32px past its cap, up under the top bar (B2b red)', t.has && !tallOk(t) && t.panelTop < t.headBottom, JSON.stringify(t));
    await b.ctx.close();
  }
  {
    const css = CSS + '\n@media (max-width: 640px) { .mobile-nav { height: 125px !important; } }\n';
    const b = await boot(SIZES[0], { 'app.css': css });
    const r = await sheet(b.pg);
    ok('P2 the bottom bar 40px taller → the sheet is STILL above it (measured, not guessed)', good(r) && parseInt(r.bar, 10) >= 140, JSON.stringify(r));
    await b.ctx.close();
  }

  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  filter_sheet_bar_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
