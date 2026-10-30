// ═══════════════════════════════════════════════════════════════════════════
// sm_viewer_2042_tests.js — v0.9.2042
//
// [stated] Brad, 2026-10-29, with a screenshot of the LOC 2328 service-manual
// viewer, its top boxed in red: "when you actually have a parts diagram open,
// be able to click outside of the box to close. sometimes its long and you
// have to go all the way down to close it. also, can we keep the top header
// (inside the red box) from scrolling so you always see the top?" → "yes".
// Agreed with it: outside-click closes READ-ONLY viewers only (this one); each
// sheet's own line ("Service notes · page 1 · 12-58" + "Open full scan") stays
// under the header while that sheet is on screen; the Parts diagrams pop-up
// beside Need-a-part is left exactly as it is.
//
// Real Chromium, the REAL viewer code lifted out of maintenance.js, the app's
// own app.css — positions are measured, not read from the source.
//   A  the header stays put while the sheets scroll (computer and phone)
//   B  the sheet on screen keeps its own line at the top of the sheets
//   C  a click on the dark area closes it; a click inside does not; a press
//      inside dragged out does not; it is still guarded (device Back)
//   D  the Parts diagrams pop-up is unchanged (its sheets' lines don't pin)
//   P  planted offenders — each check fails on the code it guards against
//
// Run:  node tests/sm_viewer_2042_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('FAILED  —  sm_viewer_2042_tests needs playwright and it is not installed.'); process.exit(1); }
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 400) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const MAINT = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
const CSS = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
function smBlock(src) { const a = src.indexOf('var _SM_CACHE_KEY'); const fn = grab(src, '_smSlotHtml'); return src.slice(a, src.indexOf(fn) + fn.length); }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }

const D = id => 'https://drive.google.com/file/d/' + id + '/view';
const HDR = ['Sheet ID', 'Section', 'Page', 'Date printed', 'Page type', 'Covers items', 'Scan link', 'Back scan link', 'Covers (closest similar)'];
const VALUES = [HDR,
  ['SM-0400', 'LOC 2328', 'page 3', '4-57', 'Parts diagram', '2328, 2338', D('b0'), '', ''],
  ['SM-0401', 'LOC 2328', 'page 3', '1-59', 'Parts diagram', '2328, 2338', D('b1'), '', ''],
  ['SM-0402', 'LOC 2328', 'page 2', '12-58', 'Parts diagram', '2328, 2338', D('b2'), '', ''],
  ['SM-0403', 'LOC 2328', 'PL', '10-59', 'Parts list', '2328, 2338', D('b3'), D('b3b'), ''],
];
// a tall scanned page, served for every Drive thumbnail (no network needed)
const SHEET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100"><rect width="850" height="1100" fill="#eee"/></svg>';
// app.css goes in as a style TAG's text, the way a <link> reads it: pasted
// into HTML, the literal "</style>" in one of its comments would end it there.
const PAGE = '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div style="height:3000px">the app</div></body></html>';

function harness(src) {
  return `(function () {
    var state = window.state = { masterSheetId: 'M', masterVersion: { v: '1' } };
    var SERVICE_MANUAL_TAB = 'Lionel PW - Service Manual', CATALOG_REFRESH_MAX_AGE_DAYS = 7, MASTER_SHEET_ID = 'M';
    var sheetsGet = function () { return Promise.resolve({ values: ${JSON.stringify(VALUES)} }); };
    var SECT = 'font-size:0.72rem;text-transform:uppercase;margin-bottom:0.6rem';
    function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function rrJsArg(v) { return _esc(String(v == null ? '' : v).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'")); }
    function _btn(c, size, extra) { return 'class="maint-btn" style="padding:0.5rem 0.8rem' + (extra ? ';' + extra : '') + '"'; }
    function _btnQuiet(size, extra) { return _btn('', size, extra); }
    function _btnSecondary() { return 'class="btn btn-secondary" id="sm-close-btn"'; }
    function _dgShowSection() { return false; }
    ${grab(MAINT, '_cardOpen')}
    ${grab(MAINT, '_cardHead')}
    ${grab(MAINT, '_cardFoot')}
    window.__guard = { n: 0 };
    window.rrDismissGuard = function (ov) { window.__guard.n++; ov.addEventListener('click', function (e) { if (e.target === ov) { e.stopPropagation(); e.preventDefault(); } }); };
    ${smBlock(src)}
    window.__smLoad = _smLoad;
  })();`;
}
async function open(browser, src, opts) {
  opts = opts || {};
  const page = await browser.newPage({ viewport: opts.phone ? { width: 400, height: 800 } : { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://drive.google.com/thumbnail**', r => r.fulfill({ contentType: 'image/svg+xml', body: SHEET_SVG }));
  await page.setContent(PAGE);
  await page.addStyleTag({ content: CSS });
  await page.addScriptTag({ content: harness(src) });
  await page.evaluate(() => window.__smLoad());
  await page.evaluate(() => window._smOpenViewer('2338', 'LOC 2328', 'd', ''));
  await page.waitForTimeout(250);
  page.__errs = errs;
  return page;
}
const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; }, sel);
// a press point inside the box that is NOT a picture (dragging a picture
// starts the browser's own image drag, which eats the click and would let a
// drag check pass for the wrong reason): the first sheet's caption text
const capPoint = page => page.evaluate(() => { const t = document.querySelector('#maint-sm-body .sm-page-cap > div'); const r = t.getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
async function dragOut(page) { const q = await capPoint(page); await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.move(8, 400, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(100); }
const has = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);
// scroll the way a person does: the wheel, over the middle of the sheets
async function wheel(page, dy) {
  const c = await box(page, '#maint-sm-viewer .rr-card');
  await page.mouse.move((c.l + c.r) / 2, Math.min(c.b - 40, c.t + 400));
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(350);
}
// the ✕ and its title, after a long scroll
async function headAfterScroll(page) {
  const before = await box(page, '#maint-sm-viewer .btn-close');
  await wheel(page, 2500);
  const after = await box(page, '#maint-sm-viewer .btn-close');
  const vh = page.viewportSize().height;
  return { before, after, visible: !!after && after.t >= 0 && after.b <= vh };
}
// the sheet line at the top of the scrolling sheets
async function capAtTop(page) {
  return page.evaluate(() => {
    const body = document.getElementById('maint-sm-body');
    if (!body) return null;
    const r = body.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + 30, r.top + 6);
    const cap = el && el.closest && el.closest('.sm-page-cap');
    return cap ? { text: cap.innerText.split('\n')[0], top: Math.round(cap.getBoundingClientRect().top), bodyTop: Math.round(r.top), scrolled: body.scrollTop } : { text: null, scrolled: body.scrollTop };
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    section('A · the header stays put while the sheets scroll');
    let p = await open(browser, MAINT);
    const h = await headAfterScroll(p);
    ok('a computer: after a long scroll the ✕ has not moved and is on screen', h.visible && h.before && Math.abs(h.after.t - h.before.t) <= 1, h);
    ok('…the title (number + section) is still on screen too', await p.evaluate(() => { const t = document.querySelector('#maint-sm-head .rr-card-title'); const r = t.getBoundingClientRect(); return /LOC 2328/.test(t.innerText) && r.top >= 0 && r.bottom <= innerHeight; }));
    ok('…and it was the SHEETS that scrolled', await p.evaluate(() => document.getElementById('maint-sm-body').scrollTop) > 1000);
    ok('the card fits the window — nothing to scroll the whole screen for', await p.evaluate(() => { const r = document.querySelector('#maint-sm-viewer .rr-card').getBoundingClientRect(); return r.bottom <= innerHeight + 1; }));
    ok('no errors on the page', p.__errs.length === 0, p.__errs);

    section('B · the sheet on screen keeps its own line at the top');
    const c1 = await capAtTop(p);
    ok('mid-way down, a sheet\'s line sits right under the header', c1 && c1.text && Math.abs(c1.top - c1.bodyTop) <= 2, c1);
    ok('…with its "Open full scan" button', await p.evaluate(() => { const r = document.getElementById('maint-sm-body').getBoundingClientRect(); const el = document.elementFromPoint(r.left + 30, r.top + 6); const cap = el && el.closest('.sm-page-cap'); return !!cap && /Open full scan/.test(cap.innerText); }));
    await wheel(p, 2500);
    const c2 = await capAtTop(p);
    ok('scrolled on to another sheet → THAT sheet\'s line takes the top', c2 && c2.text && c2.text !== c1.text && Math.abs(c2.top - c2.bodyTop) <= 2, [c1, c2]);
    await p.close();

    section('C · a click outside closes it — only a click outside');
    p = await open(browser, MAINT);
    ok('guarded once, so device Back still closes it', await p.evaluate(() => window.__guard.n) === 1);
    let c = await box(p, '#maint-sm-viewer .rr-card');
    await p.mouse.click((c.l + c.r) / 2, c.t + 120);
    ok('a click INSIDE the box leaves it open', await has(p, '#maint-sm-viewer'));
    await dragOut(p);
    ok('a press inside dragged out onto the dark area leaves it open', await has(p, '#maint-sm-viewer'));
    await p.mouse.click(8, 400);
    ok('a click on the dark area beside the box closes it', !(await has(p, '#maint-sm-viewer')));
    await p.close();
    p = await open(browser, MAINT, { phone: true });
    ok('a phone: the whole box fits the screen (no outer scroll to move the header)', await p.evaluate(() => { const r = document.querySelector('#maint-sm-viewer .rr-card').getBoundingClientRect(); const ov = document.getElementById('maint-sm-viewer'); return r.bottom <= innerHeight && ov.scrollHeight <= ov.clientHeight; }));
    const hp = await headAfterScroll(p);
    ok('a phone: the header stays put too', hp.visible && hp.before && Math.abs(hp.after.t - hp.before.t) <= 1, hp);
    c = await box(p, '#maint-sm-viewer .rr-card');
    await p.mouse.click((c.l + c.r) / 2, c.t + 150);
    ok('a phone: a tap on a sheet leaves it open', await has(p, '#maint-sm-viewer'));
    await p.mouse.click(400 - 6, 300);
    ok('a phone: a tap on the dark edge closes it', !(await has(p, '#maint-sm-viewer')));
    await p.close();

    section('D · the Parts diagrams pop-up is left as it was');
    const dg = grab(MAINT, '_dgShowSection');
    ok('its sheets are drawn without the pinned lines', /_smViewerBody\(\{ sec: secName, hits: hits \}\);/.test(dg));
    const dgBlock = MAINT.slice(MAINT.indexOf("var DG_ID = 'maint-diagrams-pop';"), MAINT.indexOf('window._maintPopSearch = function'));
    ok('…and it does not close on an outside click', dgBlock.length > 500 && !/_smOutsideCloses/.test(dgBlock));

    section('P · planted offenders');
    const oldLayout = plant(MAINT, "_cardOpen(900).replace('class=\"rr-card maint-card\"', 'class=\"rr-card rr-card-flex maint-card\" id=\"maint-sm-card\"').replace('margin-bottom:2rem', 'margin-bottom:0;max-height:calc(100dvh - 7.5rem)')", '_cardOpen(900)');
    p = await open(browser, oldLayout);
    const ho = await headAfterScroll(p);
    ok('P1 the old one-piece card → the ✕ scrolls away (A would fail)', !(ho.visible && Math.abs(ho.after.t - ho.before.t) <= 1), ho);
    await p.close();
    const noPin = plant(MAINT, '_smViewerBody({ sec: secName, hits: hits }, true)', '_smViewerBody({ sec: secName, hits: hits })');
    p = await open(browser, noPin);
    await wheel(p, 2500);
    const cn = await capAtTop(p);
    ok('P2 sheet lines not pinned → no sheet line at the top mid-scroll (B would fail)', !(cn && cn.text && Math.abs(cn.top - cn.bodyTop) <= 2), cn);
    await p.close();
    const noOutside = plant(MAINT, "    _smOutsideCloses(document.getElementById('maint-sm-viewer'));\n", '');
    p = await open(browser, noOutside);
    await p.mouse.click(8, 400);
    ok('P3 helper not wired → a click outside does nothing (C would fail)', await has(p, '#maint-sm-viewer'));
    await p.close();
    const anyClick = plant(MAINT, '      var both = downOnBackdrop && e.target === ov;', '      var both = e.target === ov;');
    p = await open(browser, anyClick);
    await dragOut(p);
    ok('P4 no check where the press started → a drag out of the sheets closes it (C would fail)', !(await has(p, '#maint-sm-viewer')));
    await p.close();
    const tall = plant(MAINT, "'margin-bottom:0;max-height:calc(100dvh - 7.5rem)')", "'margin-bottom:0')");
    p = await open(browser, tall, { phone: true });
    ok('P5 a phone card at the plain 92% height → it runs past the screen (the fit check would fail)', await p.evaluate(() => document.querySelector('#maint-sm-viewer .rr-card').getBoundingClientRect().bottom > innerHeight));
    await p.close();
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
