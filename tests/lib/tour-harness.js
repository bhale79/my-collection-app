// ══ tests/lib/tour-harness.js — the real app in real Chromium, the tour walked ══
//
// v0.9.1869. Shared by tests/tour_layout_tests.js (where the card stands, the
// second ring, what each card opens) and tests/tour_count_tests.js (the step
// counter on three screens, and the pixel read that proves the tab is LIT).
// One harness so the two suites cannot drift apart on how the app is stood up.
//
//   openApp(browser, { w, h, withData, tutorial, files })
//       a page with the real app loaded from file://, the auth screen stood
//       down, a tiny catalogue + (optionally) one owned item injected, the
//       Dashboard built. `tutorial` serves THAT source in place of app/tutorial.js
//       — how a PLANTED offender (the engine with one rule cut out) is run.
//       `files` ({ 'config.js': source, … }, v0.9.1871) does the same for any
//       other app file — a planted offender anywhere in the app.
//   walkTour(pg, stopAtTitle, fast)
//       starts the tour and presses Next to the end (or to the named card),
//       returning one SNAP per card. A measured walk waits for each card to
//       stop moving before reading it; a `fast` walk only waits for the next
//       card to exist — for walks that just need to REACH a card.
//   pixelAt(pg, x, y)  one rendered pixel (pngjs) — the only honest way to
//       measure a backdrop filter.
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
let PNG = null; try { PNG = require('pngjs').PNG; } catch (e) {}

async function openApp(browser, opts) {
  const pg = await browser.newPage({ viewport: { width: opts.w, height: opts.h } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const tutUrl = 'file://' + path.join(APP, 'tutorial.js');
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    // index.html loads every script as name.js?v=NNNN — match on the path alone
    if (opts.tutorial && u.split('?')[0] === tutUrl) return r.fulfill({ body: opts.tutorial, contentType: 'application/javascript' });
    if (opts.files) {
      const name = u.split('?')[0].slice(('file://' + APP + '/').length);
      if (Object.prototype.hasOwnProperty.call(opts.files, name)) return r.fulfill({ body: opts.files[name], contentType: /\.css$/.test(name) ? 'text/css' : 'application/javascript' });
    }
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(async (withData) => {
    window.state = window.state || {};
    state.masterData = [{ itemNum: '6457', variation: '2', itemType: 'Caboose', roadName: 'Lionel Lines', _era: 'pw', _tab: 'Lionel PW - Items' }, { itemNum: '2343', variation: '1', itemType: 'Diesel', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Items' }];
    _rebuildMasterIndex();
    state.personalData = withData ? { a: { owned: true, itemNum: '6457', variation: '2', era: 'pw', manufacturer: 'Lionel', inventoryId: '1', row: 3, condition: '7' } } : {};
    state.soldData = {}; state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.partsData = {}; state.contactsData = []; state.savedReports = [];
    state.user = { name: 'Test User', email: 'test@example.com' };
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    if (typeof tutShowHelpBtn === 'function') tutShowHelpBtn();   // what sign-in does: the Need Help? widget joins the sidebar
    if (typeof buildDashboard === 'function') { try { buildDashboard(); } catch (e) {} }
    showPage('dashboard');
    await new Promise(r => setTimeout(r, 400));
  }, !!opts.withData);
  return { pg, errs };
}

// One card as it stands: geometry, mode, type, what is open around it.
const SNAP = `(() => {
  const R = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const txt = el => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
  const co = document.getElementById('gt-callout'); if (!co) return null;
  const hole = document.getElementById('gt-hole'), hole2 = document.getElementById('gt-hole2');
  const shown = txt(document.getElementById('gt-title'));
  const step = (window.GUIDES && GUIDES.tour.steps.find(s => (typeof s.title === 'function' ? s.title() : s.title) === shown)) || null;
  let tabEl = null;
  try { if (step && step.tab) tabEl = Array.from(document.querySelectorAll(step.tab)).find(e => e.offsetParent !== null) || null; } catch (e) {}
  const menu = document.getElementById('account-menu');
  const hub = document.getElementById('help-hub-modal');
  return {
    title: shown, stepLabel: txt(document.getElementById('gt-step')), page: (document.querySelector('.page.active') || {}).id || '',
    mode: co.dataset.gtMode || '', card: R(co), hole: (hole && hole.style.opacity !== '0') ? R(hole) : null, hole2: (hole2 && hole2.style.opacity !== '0') ? R(hole2) : null,
    tabRect: R(tabEl), body: txt(document.getElementById('gt-body')),
    bodyPx: parseFloat(getComputedStyle(document.getElementById('gt-body')).fontSize), titlePx: parseFloat(getComputedStyle(document.getElementById('gt-title')).fontSize),
    open: { hub: !!hub, hubZ: hub ? parseInt(getComputedStyle(hub).zIndex, 10) : null, menu: !!(menu && menu.style.display !== 'none'),
            contact: !!(document.getElementById('contact-modal') && document.getElementById('contact-modal').style.display !== 'none'), err: !!document.getElementById('err-report-modal') },
    vw: window.innerWidth, vh: window.innerHeight
  };
})()`;

// Wait for the NEXT card, not a fixed time: a dashboard card arrives at once, a
// page card after its `before` wait. Polls the step label until it changes (or
// the tour ends). A measured walk then waits for the card to stop moving: the
// engine places a card at once and again as the page settles (150, 450, 900ms)
// and whenever the card changes size, so the reading is taken only when two
// looks 250ms apart agree.
async function nextCard(pg, prevLabel, fast) {
  const t0 = Date.now();
  const starting = (prevLabel === '__none__');   // startGuide draws its first card ~320ms later
  while (Date.now() - t0 < 4000) {
    const now = await pg.evaluate(() => { const s = document.getElementById('gt-step'); return s ? s.textContent : null; });
    if (starting ? now !== null : (now === null || now !== prevLabel)) break;
    await pg.waitForTimeout(80);
  }
  if (fast) { await pg.waitForTimeout(60); return; }
  await pg.waitForTimeout(500);
  let last = null;
  for (let k = 0; k < 8; k++) {
    const pos = await pg.evaluate(() => { const c = document.getElementById('gt-callout'); return c ? [c.style.left, c.style.top, c.offsetWidth, c.offsetHeight].join('|') : null; });
    if (pos === null || pos === last) break;
    last = pos;
    await pg.waitForTimeout(250);
  }
}
async function walkTour(pg, stopAtTitle, fast) {
  const cards = [];
  await pg.evaluate(() => { window._gtMisses = []; startGuide('tour'); });
  await nextCard(pg, '__none__', fast);
  for (let k = 0; k < 40; k++) {
    const snap = await pg.evaluate(SNAP);
    if (!snap) break;
    cards.push(snap);
    if (stopAtTitle && snap.title === stopAtTitle) return cards;
    const more = await pg.evaluate(() => { const n = document.getElementById('gt-next'); if (!n) return false; n.click(); return true; });
    if (!more) break;
    await nextCard(pg, snap.stepLabel, fast);
  }
  return cards;
}

// One rendered pixel of the live screen.
async function pixelAt(pg, x, y) {
  if (!PNG) return null;
  const buf = await pg.screenshot({ clip: { x: Math.max(0, x - 1), y: Math.max(0, y - 1), width: 3, height: 3 } });
  const png = PNG.sync.read(buf);
  const i = (1 * png.width + 1) * 4;
  const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
  return { r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

// rects are [left, top, width, height]
const overlaps = (a, b, tol) => !(a[0] + a[2] <= b[0] + tol || a[0] >= b[0] + b[2] - tol || a[1] + a[3] <= b[1] + tol || a[1] >= b[1] + b[3] - tol);
function gapBetween(a, b) {   // 0 when touching/overlapping; else the smallest edge-to-edge distance
  const dx = Math.max(0, Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2])));
  const dy = Math.max(0, Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3])));
  return Math.max(dx, dy);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const TUT = fs.readFileSync(path.join(APP, 'tutorial.js'), 'utf8');
// The engine with one rule cut out — null (and a FAIL line from the caller) when the anchor is gone.
function plantedSource(from, to) { return TUT.indexOf(from) < 0 ? null : TUT.split(from).join(to); }

module.exports = { APP, PNG, openApp, walkTour, pixelAt, overlaps, gapBetween, near, plantedSource, TUT };
