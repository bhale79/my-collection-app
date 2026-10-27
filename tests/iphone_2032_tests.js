#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE IPHONE RELEASE — v0.9.2032   (real Chromium, the REAL app, measured)
//
// Bob (York, 2026-10-26): "I have to alternate my phone from vertical to
// horizontal to get the information and then move to the next screen." The
// audit behind it (tests/phone-audit.js at 844×330, 2026-10-27): a sideways
// iPhone got the COMPUTER layout — the app decided phone-or-computer by width
// alone in 26 places. And three more things the audit measured: 10 filter
// fields under 16 px (iPhone Safari zooms the page when one is tapped), ten
// stylesheet pop-ups capped in vh (the toolbar hides their footer), eight tap
// targets under 40 px. Plus Mike (York): Google's "hasn't verified this app"
// page, met cold.
//   A  SIDEWAYS (844×330, touch): rrIsPhone, the phone layout, nothing clipped,
//      the Add box full-height with its chrome slimmed, Next + the fields in view
//   B  UPRIGHT (390×844): every field ≥ 16 px on every page; the eight tap
//      targets ≥ 40 px
//   C  COMPUTER (1280×800, mouse): untouched — sidebar, no bottom bar, not a phone
//   D  SCANS: one phone definition (RR_PHONE numbers in every phone media rule,
//      no stray width check in JS), no vh-only pop-up in the stylesheets, the
//      Google words typed once
//   E  Mike's notice: shown before Google's permission window, once per
//      account, "Not now" asks Google nothing, "Back to safety" gets the steps
//   P  planted offenders — each change undone in a served copy must turn its
//      own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  iphone_2032_tests needs playwright and it is not installed.'); process.exit(1); }
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

async function openApp(browser, vp, served) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.touch, hasTouch: !!vp.touch });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}

// the words and numbers the app declares — lifted, never typed here
const CFG = read('config.js');
const RR_PHONE = (() => { const m = CFG.match(/const RR_PHONE = (\{[^}]*\});/); if (!m) throw new Error('RR_PHONE not found in config.js'); return new Function('return ' + m[1])(); })();
const PHONE_Q = '(max-width: ' + RR_PHONE.maxWidth + 'px), (max-height: ' + RR_PHONE.shortHeight + 'px) and (pointer: coarse)';

// ── the layout questions, asked in the page ──
async function seed(pg) {
  await pg.evaluate(SEED);   // Playwright runs the string itself; the page's CSP forbids eval()
  await pg.evaluate(() => { document.getElementById('app').classList.add('active'); try { localStorage.setItem('lv_user', JSON.stringify(state.user || { email: 'x@example.com' })); } catch (e) {} });
}
async function layout(pg) {
  await seed(pg);
  return pg.evaluate(async () => {
    const R = {};
    window.rrMaybeShowAddHelp = () => {};
    const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), inView: r.top >= 0 && r.bottom <= innerHeight }; };
    R.phone = (typeof rrIsPhone === 'function') ? rrIsPhone() : 'missing';
    R.innerH = innerHeight; R.innerW = innerWidth;
    try { showPage('dashboard', null); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    R.sidebar = vis(document.querySelector('.sidebar'));
    R.nav = vis(document.querySelector('.mobile-nav'));
    // the dashboard's "Add to my collection" — clipped sideways before (content wider than its box)
    const addBtn = document.getElementById('dash-add-collection');
    R.addBtn = addBtn ? { clipped: addBtn.scrollWidth > addBtn.clientWidth + 1, text: addBtn.textContent.trim().slice(0, 30) } : null;
    R.docOverflow = document.documentElement.scrollWidth > innerWidth + 1;
    // the Add box
    try { await openWizard('collection'); wizard.data._era = 'all'; } catch (e) { R.wizErr = String(e); }
    await new Promise(r => setTimeout(r, 250));
    const modal = document.querySelector('#wizard-modal .modal');
    const nextBtn = () => Array.from(document.querySelectorAll('#wizard-modal button')).find(b => /next/i.test(b.textContent));
    R.step1 = { type: (wizard.steps[wizard.step] || {}).type, modal: box(modal), next: box(nextBtn()), input: box(document.getElementById('wiz-input')),
      progress: vis(document.getElementById('wizard-progress-wrap')), navZ: parseInt(getComputedStyle(document.querySelector('.mobile-nav')).zIndex || '0', 10), wizZ: parseInt(getComputedStyle(document.getElementById('wizard-modal')).zIndex || '0', 10) };
    state.masterData = [{ itemNum: '20-20169-3', itemType: 'Diesel Locomotive', description: 'CSX Dash-8 (Non-Powered)', roadName: 'CSX', _era: 'mth_o', _tab: 'MTH O' }].concat(state.masterData || []);
    try { if (typeof _rebuildMasterIndex === 'function') _rebuildMasterIndex(); } catch (e) {}
    wizard.data.itemNum = '20-20169-3'; try { await wizardNext(); } catch (e) { R.nextErr = String(e); }
    await new Promise(r => setTimeout(r, 250));
    const slider = document.querySelector('#wizard-modal input[type=range]');
    R.step2 = { type: (wizard.steps[wizard.step] || {}).type, next: box(nextBtn()), slider: box(slider), modal: box(modal) };
    try { _doCloseWizard(); } catch (e) {}
    return R;
  });
}

// ── every field on every page, and the named tap targets (upright) ──
const PAGES = [
  "showPage('dashboard', null)", "showPage('browse', null); filterOwned();", "showPage('browse', null); resetFilters(); renderBrowse();",
  "showPage('upgrade', null); buildUpgradePage();", "showPage('forsale', null); buildForSalePage();", "showPage('parts', null); buildPartsPage();",
  "showPage('sold', null);", "showPage('reports', null);", "showPage('tools', null);", "showPage('contacts', null);", "showPage('prefs', null); buildPrefsPage();",
  "window._pinGo(document.getElementById('nav-photo-inbox'));",
];
async function upright(pg) {
  await seed(pg);
  await pg.evaluate(() => {
    window.rrMaybeShowAddHelp = () => {}; const seen = new Set(); const R = window.__R = { small: [], fields: 0, taps: {} };
    const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
    window.__measureFields = (where) => {
      document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]):not([type=color]), select, textarea').forEach(e => {
        if (!vis(e) || seen.has(e)) return; seen.add(e); R.fields++;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        if (fs < 16) R.small.push({ where, id: e.id || e.className || e.tagName, fs });
      });
    };
    window.__measureTap = (key, sel) => { const el = Array.from(document.querySelectorAll(sel)).find(vis); if (el && !R.taps[key]) R.taps[key] = box(el); };
    window.__measure = (where) => {
      window.__measureFields(where);
      window.__measureTap('editDashboard', '#dash-edit-btn');
      window.__measureTap('sectionHeader', '[id^="dash-panel-header"]');
      window.__measureTap('noticeX', '.rr-notice-x');
      window.__measureTap('hideThis', '#pin-help-btn');
      window.__measureTap('reportBtn', '.rep-row-actions button');
    };
  });
  for (const open of PAGES) {
    try { await pg.evaluate(open); } catch (e) {}
    await pg.waitForTimeout(350);
    await pg.evaluate((where) => { window.__measure(where); }, open.slice(0, 24));
  }
  return pg.evaluate(async () => {
    const R = window.__R; const measureFields = window.__measureFields, measureTap = window.__measureTap;
    // the item page
    try { const pd = Object.values(state.personalData || {})[0]; if (pd && typeof _openOwnedByInvId === 'function') _openOwnedByInvId(pd.inventoryId); } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    measureFields('itemdetail');
    measureTap('backToCollection', '.rr-detail-back');
    measureTap('addPhotos', '.rr-detail-photos-btn');
    // the Add box
    try { await openWizard('collection'); } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
    measureFields('wizard');
    measureTap('wizClose', '#wizard-modal .btn-close');
    measureTap('wizCancel', '#wizard-modal .rr-wiz-cancel');
    try { _doCloseWizard(); } catch (e) {}
    // the Report a problem form's ×
    try { if (typeof errReportOpen === 'function') errReportOpen(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    measureTap('reportFormX', '.rr-notice-x[aria-label="Close"]');
    try { if (typeof errReportClose === 'function') errReportClose(); } catch (e) {}
    R.phone = rrIsPhone();
    return R;
  });
}

// ── Mike's notice ──
async function notice(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const W = RR_GPHOTOS_WAIT;
    document.getElementById('app').classList.add('active');
    state.user = { name: 'Mike', email: 'mike@example.com' }; try { localStorage.setItem('lv_user', JSON.stringify(state.user)); } catch (e) {}
    // file:// pages cannot pushState, so BackStack's history.back() would leave the page — the notice's Back wiring is not what is under test
    window.BackStack = null;
    try { localStorage.removeItem('lv_gphotos_granted'); localStorage.removeItem('lv_gphotos_granted__at'); } catch (e) {}
    window.accessToken = 'T'; try { localStorage.setItem('lv_token', 'T'); localStorage.setItem('lv_token_expiry', String(Date.now() + 3600000)); } catch (e) {}
    // the pass never carries the Photos permission; Google's window is a stand-in that RECORDS
    window._rrPassHasScope = () => false;
    const asks = [];
    window._rrRequestExtraScope = (scope, onDone) => { asks.push(scope); setTimeout(() => onDone(true), 10); };
    window.open = () => null;
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
    const overlay = () => Array.from(document.querySelectorAll('div')).find(d => d.textContent.indexOf(W.unverifiedTitle) >= 0 && getComputedStyle(d).position === 'fixed');
    const btn = (words) => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === words && b.getBoundingClientRect().width > 0);
    // E1: the notice first; "Not now" asks Google nothing
    let p = rrGPhotosPickSession({ onNeedTab: () => {} });
    await new Promise(r => setTimeout(r, 150));
    const ov = overlay();
    R.e1 = { shown: !!ov, hasBody: !!ov && ov.textContent.indexOf(W.unverified) >= 0, hasAdvanced: !!ov && /Advanced/.test(ov.textContent), go: !!btn(W.unverifiedGo), no: !!btn(W.unverifiedNo) };
    if (btn(W.unverifiedNo)) btn(W.unverifiedNo).click();
    const r1 = await p;
    R.e1.result = r1 && r1.error; R.e1.asks = asks.length; R.e1.flag = localStorage.getItem('lv_gphotos_granted');
    // E2: "Continue to Google" asks for the Photos permission; the grant is remembered for the account
    p = rrGPhotosPickSession({ onNeedTab: () => {} });
    await new Promise(r => setTimeout(r, 150));
    R.e2 = { shown: !!overlay() };
    if (btn(W.unverifiedGo)) btn(W.unverifiedGo).click();
    const r2 = await p;
    R.e2.asks = asks.slice(); R.e2.flag = localStorage.getItem('lv_gphotos_granted'); R.e2.result = r2 && r2.error; R.e2.status = r2 && r2.status;
    // E3: granted once → never the notice again
    p = rrGPhotosPickSession({ onNeedTab: () => {} });
    await new Promise(r => setTimeout(r, 150));
    R.e3 = { shown: !!overlay(), asks: asks.length };
    await p;
    // E4: "Back to safety" → the words with the steps, on both routes
    R.e4 = { words: rrGPhotosErrText({ error: 'scope' }), cfg: W.err_scope };
    const _real = window.rrGPhotosPickSession;
    window.rrGPhotosPickSession = async () => ({ error: 'scope' });
    try { window._pinRefresh = async () => {}; _pinGo(document.getElementById('nav-photo-inbox')); await new Promise(r => setTimeout(r, 200)); await window._pinGPhotos(); } catch (e) { R.e4.inboxErr = String(e); }
    await new Promise(r => setTimeout(r, 200));
    window.rrGPhotosPickSession = _real;
    R.e4.inboxToast = toasts.find(t => /Advanced/.test(t)) || toasts.slice(-1)[0] || '';
    return R;
  });
}

// ── D: scans ──
function cssVhOnly(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    const src = files[f];
    const re = /([a-z-]+):\s*([^;{}]*?\b\d+(?:\.\d+)?vh\b[^;{}]*?);/g; let m;
    while ((m = re.exec(src))) {
      const pre = src.slice(0, m.index); if (pre.lastIndexOf('/*') > pre.lastIndexOf('*/')) continue;
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + 200).replace(/^\s+/, '');
      if (after.indexOf(m[1] + ':') === 0 && after.split(';')[0].indexOf('dvh') >= 0) continue;
      bad.push(f + ':' + (pre.split('\n').length));
    }
  });
  return bad;
}
function phoneRules(css) {
  const all = css.match(/@media[^{]*max-width:\s*\d+px[^{]*\{/g) || [];
  const phone = all.filter(q => /max-width:\s*640px/.test(q));
  const wrong = phone.filter(q => q.indexOf(PHONE_Q) < 0);
  return { phone: phone.length, wrong };
}
function strayWidthChecks(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    if (f === 'config.js') return;
    const src = files[f].split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    if (/innerWidth\s*(<=|>|<|>=)\s*640\b/.test(src) || /max-width:\s*640px\)'\)/.test(src)) bad.push(f);
  });
  return bad;
}
function typedOnce(files, literal) {
  return Object.keys(files).filter(f => files[f].split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').indexOf(literal) >= 0);
}
const CSS_FILES = {}, JS_FILES = {};
fs.readdirSync(APP).forEach(f => { if (/\.css$/.test(f)) CSS_FILES[f] = read(f); if (/\.js$/.test(f) && !/^tests-/.test(f)) JS_FILES[f] = read(f); });

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const SIDE = { w: 844, h: 330, touch: true }, UP = { w: 390, h: 844, touch: true }, DESK = { w: 1280, h: 800, touch: false };
  const APPCSS = read('app.css'), DRIVE = read('drive.js');

  // ── A: sideways ──
  {
    const { ctx, pg, errs } = await openApp(browser, SIDE);
    const R = await layout(pg);
    ok('A1 sideways (844×330, touch) IS a phone — rrIsPhone()', R.phone === true, JSON.stringify(R.phone));
    ok('A2 the phone layout: no sidebar, the bottom bar', R.sidebar === false && R.nav === true, JSON.stringify([R.sidebar, R.nav]));
    ok('A3 the dashboard\'s Add button is not clipped; no sideways scrolling', R.addBtn && !R.addBtn.clipped && !R.docOverflow, JSON.stringify([R.addBtn, R.docOverflow]));
    ok('A4 the Add box fills the height, over the bottom bar, progress bar put away', R.step1.modal && R.step1.modal.h === R.innerH && R.step1.modal.top === 0 && R.step1.wizZ > R.step1.navZ && !R.step1.progress, JSON.stringify(R.step1));
    ok('A5 step 1: Next AND the number box in view with no scrolling', R.step1.next && R.step1.next.inView && R.step1.input && R.step1.input.inView, JSON.stringify([R.step1.next, R.step1.input]));
    ok('A6 step 2: the condition slider and Next in view', R.step2.type === 'conditionDetails' && R.step2.slider && R.step2.slider.inView && R.step2.next && R.step2.next.inView, JSON.stringify(R.step2));
    ok('A7 no page errors sideways', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ── B: upright ──
  {
    const { ctx, pg, errs } = await openApp(browser, UP);
    const R = await upright(pg);
    ok('B1 upright is a phone', R.phone === true);
    ok('B2 every field on every page is at least 16 px (no tap-to-zoom) — ' + R.fields + ' measured', R.fields >= 15 && R.small.length === 0, JSON.stringify(R.small.slice(0, 6)));
    const T = R.taps;
    const tall = (k) => T[k] && T[k].h >= 40;
    ok('B3 tap targets ≥ 40 px: Edit Dashboard, the section headers, × Hide this, Reports buttons', tall('editDashboard') && tall('sectionHeader') && tall('hideThis') && tall('reportBtn'), JSON.stringify(T));
    ok('B4 tap targets ≥ 40 px: Back to Collection, Add Photos, the notice ×, the report form ×', tall('backToCollection') && tall('addPhotos') && T.noticeX && T.noticeX.w >= 40 && T.noticeX.h >= 40 && T.reportFormX && T.reportFormX.w >= 40 && T.reportFormX.h >= 40, JSON.stringify(T));
    ok('B5 tap targets ≥ 40 px: the Add box\'s × and Cancel', T.wizClose && T.wizClose.w >= 40 && T.wizClose.h >= 40 && T.wizCancel && T.wizCancel.w >= 40 && T.wizCancel.h >= 40, JSON.stringify([T.wizClose, T.wizCancel]));
    ok('B6 no page errors upright', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ── C: computer ──
  {
    const { ctx, pg } = await openApp(browser, DESK);
    const R = await layout(pg);
    ok('C1 a computer (1280×800, mouse) is NOT a phone: sidebar, no bottom bar', R.phone === false && R.sidebar === true && R.nav === false, JSON.stringify([R.phone, R.sidebar, R.nav]));
    ok('C2 the computer\'s Add box is untouched (not full-height, progress bar shown)', R.step1.modal && R.step1.modal.h < R.innerH - 20 && R.step1.progress === true, JSON.stringify(R.step1));
    await ctx.close();
  }
  // ── D: scans ──
  {
    const pr = phoneRules(APPCSS);
    ok('D1 every phone rule in app.css carries the ONE definition (' + pr.phone + ' rules; numbers from RR_PHONE)', pr.phone >= 16 && pr.wrong.length === 0, pr.wrong.join(' | '));
    ok('D2 the "not a phone" rule is the exact opposite (wide AND tall, or wide AND a mouse)', /@media \(min-width: 641px\) and \(min-height: 501px\), \(min-width: 641px\) and \(pointer: fine\), \(min-width: 641px\) and \(pointer: none\)/.test(APPCSS));
    const stray = strayWidthChecks(JS_FILES);
    ok('D3 no stray phone-by-width check in app/*.js (every decision asks rrIsPhone)', stray.length === 0, stray.join(', '));
    const vh = cssVhOnly(CSS_FILES);
    ok('D4 no vh-only height in app/*.css (every one carries its dvh twin)', vh.length === 0, vh.join(', '));
    const once = typedOnce(JS_FILES, 'permission was not granted');
    ok('D5 the Google words are typed once (config.js)', once.length === 1 && once[0] === 'config.js' || (once.length === 2 && once.indexOf('migration-config.js') >= 0), once.join(', '));
    ok('D6 RR_PHONE is the live numbers: narrow ' + RR_PHONE.maxWidth + ', short ' + RR_PHONE.shortHeight, RR_PHONE.maxWidth > 300 && RR_PHONE.shortHeight > 300 && RR_PHONE.shortHeight < RR_PHONE.maxWidth);
  }
  // ── E: Mike's notice ──
  {
    const { ctx, pg, errs } = await openApp(browser, UP);
    const R = await notice(pg);
    ok('E1 the notice comes BEFORE Google\'s window, in the config words, naming Advanced; "Not now" asks Google nothing', R.e1.shown && R.e1.hasBody && R.e1.hasAdvanced && R.e1.go && R.e1.no && R.e1.result === 'cancelled' && R.e1.asks === 0 && !R.e1.flag, JSON.stringify(R.e1));
    ok('E2 "Continue to Google" asks for the Photos permission; the grant is remembered for the account', R.e2.shown && R.e2.asks.length === 1 && /photospicker/.test(R.e2.asks[0]) && R.e2.flag === '1', JSON.stringify(R.e2));
    ok('E3 once granted, the notice never shows again (Google goes straight on)', !R.e3.shown && R.e3.asks === 2, JSON.stringify(R.e3));
    ok('E4 "Back to safety" → the steps (Advanced …), the same words on the Add route and the inbox route', /Advanced/.test(R.e4.words) && R.e4.words === R.e4.cfg && R.e4.inboxToast === R.e4.cfg, JSON.stringify(R.e4));
    ok('E5 no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ── P: planted offenders ──
  {
    // P1: the old one-clause phone rules → sideways is a computer again
    const old = plant(APPCSS, PHONE_Q, '(max-width: 640px)', 'one-clause phone rules');
    const { ctx, pg } = await openApp(browser, SIDE, { 'app.css': old, 'config.js': plant(CFG, 'return window.innerHeight <= RR_PHONE.shortHeight', 'return false && window.innerHeight <= RR_PHONE.shortHeight', 'rrIsPhone short clause') });
    const R = await layout(pg);
    ok('P1 PLANTED width-only phone rules: sideways gets the sidebar again (A1/A2 can fail)', R.phone === false && R.sidebar === true, JSON.stringify([R.phone, R.sidebar]));
    await ctx.close();
  }
  {
    // P2: the compact Add box block gone
    const i = APPCSS.indexOf('  @media (max-height: 500px) {\n    #wizard-modal { z-index: 900;'); if (i < 0) throw new Error('compact block anchor moved — update the test');
    const j = APPCSS.indexOf('\n  }\n', i);
    const { ctx, pg } = await openApp(browser, SIDE, { 'app.css': APPCSS.slice(0, i) + APPCSS.slice(j + 5) });
    const R = await layout(pg);
    ok('P2 PLANTED no compact Add box: the box no longer fills the height (A4 can fail)', !(R.step1.modal && R.step1.modal.h === R.innerH && R.step1.wizZ > R.step1.navZ), JSON.stringify(R.step1.modal));
    await ctx.close();
  }
  {
    // P3: the 16 px field rule and one filter's size put back
    const old = plant(plant(APPCSS, 'input, select, textarea { font-size: 16px !important; }', '', '16px field rule'), '.filter-bar select { min-height: 44px; font-size: 1rem !important; }', '.filter-bar select { min-height: 44px; font-size: 0.9rem !important; }', 'filter select size');
    const { ctx, pg } = await openApp(browser, UP, { 'app.css': old });
    const R = await upright(pg);
    ok('P3 PLANTED small fields: B2 can fail', R.small.length > 0, String(R.small.length));
    await ctx.close();
  }
  {
    // P4: the tap-target block gone
    const i = APPCSS.indexOf('/* ══ v0.9.2032 — TAP TARGETS'); if (i < 0) throw new Error('tap block anchor moved — update the test');
    const { ctx, pg } = await openApp(browser, UP, { 'app.css': APPCSS.slice(0, i) });
    const R = await upright(pg);
    ok('P4 PLANTED no tap-target rule: B3/B4 can fail', !(R.taps.editDashboard && R.taps.editDashboard.h >= 40) && !(R.taps.noticeX && R.taps.noticeX.w >= 40), JSON.stringify([R.taps.editDashboard, R.taps.noticeX]));
    await ctx.close();
  }
  {
    // P5: the notice call gone from the Google Photos door
    const old = plant(DRIVE, "    var _go = await rrGPhotosUnverifiedNotice();\n    if (!_go) return { error: 'cancelled' };", '', 'notice call');
    const { ctx, pg } = await openApp(browser, UP, { 'drive.js': old });
    const R = await notice(pg).catch(e => ({ err: String(e) }));
    ok('P5 PLANTED no notice: E1 can fail (Google asked cold)', !R.err && R.e1 && !R.e1.shown && R.e1.asks === 1, R.err || JSON.stringify(R.e1));
    await ctx.close();
  }
  {
    // P6/P7: the scans on planted copies
    const vh = cssVhOnly({ 'x.css': '.a { max-height: 70vh; overflow: auto; } .b { max-height: 70vh; max-height: 70dvh; } /* 100vh in a comment */' });
    ok('P6 PLANTED a vh-only height: D4 can fail (and a comment is not an offender)', vh.length === 1, JSON.stringify(vh));
    const stray = strayWidthChecks({ 'x.js': "const isMobile = window.innerWidth <= 640;", 'y.js': "// const isMobile = window.innerWidth <= 640;\nvar a = rrIsPhone();", 'z.js': "var p = window.matchMedia('(max-width: 640px)').matches;" });
    ok('P7 PLANTED stray width checks: D3 can fail (a comment is not an offender)', stray.length === 2 && stray.indexOf('x.js') >= 0 && stray.indexOf('z.js') >= 0, JSON.stringify(stray));
    const pr = phoneRules(APPCSS.replace(PHONE_Q, '(max-width: 640px)'));
    ok('P8 PLANTED one phone rule written the old way: D1 can fail', pr.wrong.length === 1, JSON.stringify(pr.wrong));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
