#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// WHILE A POP-UP IS OPEN, THE WINDOW HOLDS STILL — v0.9.2070
// (known-problems sweep, release 7, type A4)
//
// The app's pages scroll inside their own box (.main), so when a list in a
// pop-up reached its end the pull carried on to the WINDOW: on an iPhone the
// whole screen bounced, and in Safari a pull down at a list's top reloaded the
// app (a half-filled Add, gone). Measured: 157 scroll boxes in app/, ONE (the
// barcode crop screen) held the window, and only for itself. [stated] Brad
// 2026-10-30 "yes" — the crop screen's rule for every pop-up; the pages keep
// their pull-down reload, as he chose in v0.9.1468.
//
// ONE decider: back-stack.js `_popOpen()` (window.rrPopOpen) puts
// html.rr-pop-open on while anything pinned covers ≥ RR_POP.minArea of the
// window and can be touched; app.css turns that into overscroll-behavior:none
// on <html>/<body>.
//   S  source: nothing else writes the window's overscroll (the crop screen's
//      own copy is gone), the class is set in one place, the rule is in
//      app.css once — each proven on planted offenders.
//   B  the real app, phone with touch: at rest the window keeps its normal
//      pull; a walk over pop-ups mounted on <body>, in .main (the filter
//      sheet), shown by a class (.modal-overlay.open) and by style (contact
//      edit), pinned deep inside the page — for EVERY screen, "a big pinned
//      thing is on screen" ⇔ "the window holds still", and closing lets go.
//      Small pinned things (the bottom bar, a toast) never hold it.
//   P  old code served: no watcher, no style rule, sheets in .main not looked
//      at — each turns its own check red.
// Note: the bounce and Safari's pull-down reload exist only on a real
// iPhone; Chromium has neither, so B proves the window's setting, and the
// setting is what Safari obeys (iOS 16+).
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };

// ── S — the source ──
const JS = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/vendor|\.min\./.test(f));
const ROOT_WRITE = /(documentElement|document\.body|\bbody)\s*\.style\s*\.\s*overscroll|(documentElement|document\.body)\.style\.setProperty\(\s*['"]overscroll/;
function rootWrites(name, src) {
  const out = [];
  src.split('\n').forEach((ln, i) => { if (!/^\s*\/\//.test(ln) && ROOT_WRITE.test(ln)) out.push(name + ':' + (i + 1)); });
  return out;
}
let rw = []; for (const f of JS) rw = rw.concat(rootWrites(f, read(f)));
ok('S1 no app file writes the window\'s overscroll by hand (one owner: html.rr-pop-open + app.css)', !rw.length, rw.join(' | '));
ok('S1-P1 the crop screen\'s old lines — caught', rootWrites('p.js', "      document.body.style.overscrollBehaviorY = 'contain';\n      document.documentElement.style.overscrollBehaviorY = 'contain';").length === 2);
ok('S1-P2 a setProperty spelling — caught', rootWrites('p.js', "document.documentElement.style.setProperty('overscroll-behavior', 'none');").length === 1);
ok('S1-G a pop-up\'s OWN box may hold its scroll (d.style.overscrollBehavior) — not counted', !rootWrites('g.js', "      d.style.overscrollBehavior = 'contain';").length);
const setters = JS.filter(f => /rr-pop-open/.test(read(f)));
ok('S2 the class is named in one app file, back-stack.js, and nothing else toggles it', setters.length === 1 && setters[0] === 'back-stack.js', setters.join(','));
const css = read('app.css');
const RULE = 'html.rr-pop-open, html.rr-pop-open body { overscroll-behavior: none; }';
ok('S3 app.css holds the window still while a pop-up is open — once', css.split(RULE).length === 2);
ok('S4 the crop screen keeps its own box held (its pinch / drag never moves the window under it)', /d\.style\.overscrollBehavior = 'contain';/.test(read('barcode.js')));

// ── B — the real app ──
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  window_still_2070_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }
const { SEED } = require('./lib/guide-fixture');

async function boot(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2200);
  const before = await pg.evaluate(() => [document.documentElement.classList.contains('rr-pop-open'), getComputedStyle(document.documentElement).overscrollBehaviorY]);
  await pg.evaluate(SEED); await pg.waitForTimeout(400);
  return { ctx, pg, errs, before };
}
// the test's OWN idea of "a pop-up is on screen" — every element in the page, not the app's candidate list
const BIG = `(() => [...document.querySelectorAll('body *')].filter(e => {
  const c = getComputedStyle(e);
  if (c.position !== 'fixed' || c.display === 'none' || c.visibility === 'hidden' || c.pointerEvents === 'none') return false;
  const r = e.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const w = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
  return w * h / (W * H) >= 0.35;
}).map(e => (e.id || String(e.className).slice(0, 24)) + ' on ' + (e.parentElement === document.body ? 'body' : (e.parentElement.id || e.parentElement.className))))()`;
const STATE = () => ({ held: document.documentElement.classList.contains('rr-pop-open'), html: getComputedStyle(document.documentElement).overscrollBehaviorY, body: getComputedStyle(document.body).overscrollBehaviorY });
const VIEWS = [
  ['dashboard (a page)', "showPage('dashboard', null)"],
  ['My Collection (a page)', "showPage('browse', null); filterOwned();"],
  ['filter sheet — mounted in .main', "showPage('browse', null); if (window._rrFilterSheetOpen) _rrFilterSheetOpen();", "if (window._rrFilterSheetClose) _rrFilterSheetClose();"],
  ['contact edit — shown by its style', "showPage('contacts', null); window._ctOpenEdit && window._ctOpenEdit(2);", "var m = document.getElementById('ct-modal'); if (m) m.style.display = 'none';"],
  ['Add screen — a .modal-overlay shown by its class', "openWizard('collection'); setTimeout(function () { var u = document.getElementById('rr-ai-usage-card'); if (u) u.remove(); }, 650);", "closeWizard()"],
  ['help guide', "rrgOpen('grading')", "document.querySelectorAll('[id^=rrg]').forEach(function (e) { e.remove(); })"],
  ['Terms', "rrTermsOpen()", "var t = document.getElementById('rr-terms'); if (t) t.remove();"],
  ['Help hub', "if (window.openHelpHub) openHelpHub()", "var t = document.getElementById('help-hub-modal'); if (t) t.remove();"],
  ['report builder', "showPage('reports', null); if (window.openReportBuilder) openReportBuilder(null)", "if (window._rbCloseOverlay) _rbCloseOverlay();"],
  ['dashboard editor', "showPage('dashboard', null); if (window.openDashEditor) openDashEditor()", "if (window._dashEdClose) _dashEdClose();"],
  ['a pop-up pinned deep inside the page (its own style)', "var h = document.createElement('div'); h.id = 'deep-host'; (document.querySelector('.app-body') || document.getElementById('app') || document.body).appendChild(h); h.innerHTML = '<div id=\"deep-pop\" style=\"position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999\"><div style=\"background:#fff;margin:20vh 1rem;height:40vh;overflow-y:auto\"><div style=\"height:900px\">list</div></div></div>';", "var h = document.getElementById('deep-host'); if (h) h.remove();"],
  ['a toast and the bottom bar (small pinned things)', "if (window.showToast) showToast('Testing the window rule', 4000);"],
];
async function walk(pg) {
  const rows = [];
  for (const [name, open, close] of VIEWS) {
    await pg.evaluate(new Function('try{' + open + '}catch(e){window.__e=e.message}'));
    await pg.waitForTimeout(950);
    const big = await pg.evaluate(BIG), st = await pg.evaluate(STATE);
    if (close) await pg.evaluate(new Function('try{' + close + '}catch(e){}'));
    await pg.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(o => { if (o.id !== 'wizard-modal') o.remove(); }); });
    await pg.waitForTimeout(500);
    const after = await pg.evaluate(STATE), bigAfter = await pg.evaluate(BIG);
    rows.push({ name, big, st, after, bigAfter });
  }
  return rows;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  const o = await boot(browser, null);
  ok('B0 before sign-in, nothing on screen holds the window (the pull-down reload works)', o.before[0] === false && o.before[1] === 'auto', JSON.stringify(o.before));
  const rest = await o.pg.evaluate(STATE);
  ok('B1 the pages at rest keep the window\'s normal pull (Brad\'s v0.9.1468 choice)', !rest.held && rest.html === 'auto' && rest.body === 'auto', JSON.stringify(rest));
  const rows = await walk(o.pg);
  let shown = 0;
  for (const r of rows) {
    const isPop = r.big.length > 0; if (isPop) shown++;
    ok('B ' + r.name + ' — ' + (isPop ? 'a pop-up is up, the window holds still' : 'no pop-up, the window keeps its pull'),
      isPop ? (r.st.held && r.st.html === 'none' && r.st.body === 'none') : (!r.st.held && r.st.html === 'auto'), JSON.stringify(r.big) + ' ' + JSON.stringify(r.st));
    if (isPop) ok('B ' + r.name + ' — closed, the window lets go', !r.bigAfter.length && !r.after.held && r.after.html === 'auto', JSON.stringify(r.bigAfter) + ' ' + JSON.stringify(r.after));
  }
  const need = ['filter sheet — mounted in .main', 'contact edit — shown by its style', 'Add screen — a .modal-overlay shown by its class', 'a pop-up pinned deep inside the page (its own style)', 'help guide', 'Terms'];
  ok('B2 the walk really opened every kind of pop-up (' + shown + ' screens with one up)', need.every(n => (rows.find(r => r.name === n) || { big: [] }).big.length > 0) && shown >= 7, need.filter(n => !(rows.find(r => r.name === n) || { big: [] }).big.length).join(', '));
  const toast = rows.find(r => /toast/.test(r.name));
  ok('B3 a toast and the bottom bar never hold the window', toast && !toast.st.held, JSON.stringify(toast && toast.st));
  ok('B4 rrPopOpen() (the one decider) agrees with the window\'s setting', await o.pg.evaluate(() => typeof window.rrPopOpen === 'function' && window.rrPopOpen() === document.documentElement.classList.contains('rr-pop-open')));
  const appErrs = o.errs.filter(e => !/fonts|Failed to fetch|net::|ERR_/i.test(e));
  ok('B5 no page errors', !appErrs.length, [...new Set(appErrs)].slice(0, 3).join(' | '));
  await o.ctx.close();

  // ── P — old code served ──
  const bs = read('back-stack.js');
  const PL = [
    ['P1 no watcher (back-stack.js)', { 'back-stack.js': plant(bs, "  if (document.body) _popWatch(); else document.addEventListener('DOMContentLoaded', _popWatch);", '', 'P1') }, 'help guide'],
    ['P2 no style rule (app.css)', { 'app.css': plant(css, RULE, '', 'P2') }, 'Terms'],
    ['P3 neither the page box nor a pop-up\'s own style looked at (back-stack.js) — the filter sheet is missed', { 'back-stack.js': plant(plant(bs, "    if (m) out = out.concat([].slice.call(m.children));\n", '', 'P3a'), `  var POP_SEL = '.modal-overlay, [style*="position:fixed"], [style*="position: fixed"]';`, `  var POP_SEL = '.modal-overlay';`, 'P3b') }, 'filter sheet — mounted in .main'],
    ['P4 a pop-up\'s own style not looked at (back-stack.js)', { 'back-stack.js': plant(bs, `  var POP_SEL = '.modal-overlay, [style*="position:fixed"], [style*="position: fixed"]';`, `  var POP_SEL = '.modal-overlay';`, 'P4') }, 'a pop-up pinned deep inside the page (its own style)'],
    ['P5 a pop-up closed by removing the box it sits in is not noticed (back-stack.js)', { 'back-stack.js': plant(bs, "  function _popIn(n) { return _popLike(n) || !!(n && n.nodeType === 1 && n.querySelector && n.querySelector(POP_SEL)); }", "  function _popIn(n) { return _popLike(n); }", 'P5') }, 'a pop-up pinned deep inside the page (its own style)', true],
  ];
  for (const [label, served, view, afterClose] of PL) {
    let held = null;
    try {
      const p = await boot(browser, served);
      const v = VIEWS.find(x => x[0] === view);
      await p.pg.evaluate(new Function('try{' + v[1] + '}catch(e){}'));
      await p.pg.waitForTimeout(950);
      const big = await p.pg.evaluate(BIG), st = await p.pg.evaluate(STATE);
      held = big.length > 0 && st.held && st.html === 'none';
      if (!big.length) held = 'no pop-up opened';
      if (afterClose) {   // P5: the check is that CLOSING lets go
        if (v[2]) await p.pg.evaluate(new Function('try{' + v[2] + '}catch(e){}'));
        await p.pg.waitForTimeout(120);   // two frames: the new code lets go at once; the old waits for some unrelated change
        const a = await p.pg.evaluate(STATE);
        held = big.length ? !a.held : 'no pop-up opened';
      }
      await p.ctx.close();
    } catch (e) { held = 'error: ' + e.message; }
    ok(label + ' — caught on "' + view + '"', held === false, String(held));
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
