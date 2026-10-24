#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// INSTALL IS OFFERED ONCE — v0.9.2001   (real Chromium, the REAL app)
//
// Launch walk-through 2026-10-19, issue 2: "Install is offered twice" — setup
// step 3 ("Put it on this device") explains installing, then the separate
// "Install The Rail Roster on this device?" pop-up appeared on the dashboard,
// over the tour card and over the first Add step. On an iPhone a third, automatic
// "Add to Home Screen" banner joined in. And on a phone the pop-up squeezed to
// half the screen, its Cancel sticking out past the right edge.
// [stated] Brad "yes" to fixing it before the York show.
//
// THE RULES:
//   A  leaving setup step 3 IS the answer: "Not right now" quiets the pop-up
//      (lv_install_offer_ts = now), "Install now" ends it (-1) — written only by
//      rrInstallOfferAnswer (app-misc.js)
//   B  the pop-up waits its turn — never over setup, a tour card or an open box;
//      it shows once they are closed
//   C  on a phone the pop-up and both its buttons are fully on screen
//   D  no automatic iPhone banner (the pop-up's Install shows those steps)
// Each rule has a PLANTED old version served in place of the real file.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  install_offer_once_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');
const APP = H.APP;
const MISC = fs.readFileSync(path.join(APP, 'app-misc.js'), 'utf8');
const ONB = fs.readFileSync(path.join(APP, 'onboarding.js'), 'utf8');
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // comment lines out

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function plant(src, from, to, name) { if (src.indexOf(from) < 0) { T('PLANTED ' + name + ': anchor found', false, from.slice(0, 80)); return null; } return src.split(from).join(to); }

// Walk setup to screen 3 and leave it with the given button; return the stored answer.
async function setupAnswer(browser, how, files) {
  const { pg } = await H.openApp(browser, { w: 1280, h: 800, files });
  const out = await pg.evaluate(async (how) => {
    try { localStorage.removeItem('lv_install_offer_ts'); } catch (e) {}
    // v0.9.2021: the pop-up now shows only when the browser has offered an install
    window._pwaPrompt = window._pwaPrompt || { prompt() {}, userChoice: Promise.resolve({}) };
    showFeatureMap();
    await new Promise(r => setTimeout(r, 300));
    // screens 1 and 2 → screen 3 ("Put it on this device")
    onboardNext(); await new Promise(r => setTimeout(r, 150));
    onboardNext(); await new Promise(r => setTimeout(r, 150));
    const title = (document.getElementById('onboarding-map-panel') || {}).textContent || '';
    if (how === 'install') { window._pwaInstall = function () {}; onboardInstallNow(); }
    onboardNext();                                 // "Not right now" / "Continue →"
    await new Promise(r => setTimeout(r, 200));
    try { _gtEnd && _gtEnd(); } catch (e) {}
    const v = localStorage.getItem('lv_install_offer_ts');
    // the pop-up, asked right now with nothing in the way
    document.querySelectorAll('#gt-callout').forEach(n => n.remove());
    _pwaOfferInit();
    return { onInstallScreen: /Put it on this device/.test(title), v, popup: !!document.getElementById('pwa-install-offer') };
  }, how);
  await pg.close();
  return out;
}

// Fresh device: is the pop-up held back while something is open, and shown after?
async function waitsItsTurn(browser, files) {
  const { pg } = await H.openApp(browser, { w: 1280, h: 800, files });
  const r = await pg.evaluate(async () => {
    try { localStorage.removeItem('lv_install_offer_ts'); } catch (e) {}
    // v0.9.2021: the pop-up now shows only when the browser has offered an install
    window._pwaPrompt = window._pwaPrompt || { prompt() {}, userChoice: Promise.resolve({}) };
    const res = {};
    startGuide('tour');
    for (let k = 0; k < 30 && !document.getElementById('gt-callout'); k++) await new Promise(r => setTimeout(r, 100));
    _pwaOfferInit();
    res.overTour = !!document.getElementById('pwa-install-offer');
    document.getElementById('gt-cancel').click();
    await new Promise(r => setTimeout(r, 300));
    // a box open: the Add wizard's modal
    let wm = document.getElementById('wizard-modal');
    if (!wm) { wm = document.createElement('div'); wm.id = 'wizard-modal'; document.body.appendChild(wm); }
    wm.classList.add('open');
    _pwaOfferInit();
    res.overBox = !!document.getElementById('pwa-install-offer');
    wm.classList.remove('open');
    await new Promise(r => setTimeout(r, 4500));   // its own retry, nothing in the way now
    res.afterAllClosed = !!document.getElementById('pwa-install-offer');
    return res;
  });
  await pg.close();
  return r;
}

// On a phone: the pop-up and both buttons inside the screen.
async function phoneFit(browser, w, files) {
  const { pg } = await H.openApp(browser, { w, h: 800, files });
  const r = await pg.evaluate(() => {
    try { localStorage.removeItem('lv_install_offer_ts'); } catch (e) {}
    // v0.9.2021: the pop-up now shows only when the browser has offered an install
    window._pwaPrompt = window._pwaPrompt || { prompt() {}, userChoice: Promise.resolve({}) };
    _pwaOfferInit();
    const b = document.getElementById('pwa-install-offer'); if (!b) return null;
    const R = el => { const x = el.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.right)]; };
    return { vw: innerWidth, box: R(b), go: R(document.getElementById('pwa-offer-go')), no: R(document.getElementById('pwa-offer-no')) };
  });
  await pg.close();
  return r;
}
const inside = r => r && [r.box, r.go, r.no].every(x => x[0] >= 0 && x[1] <= r.vw) && r.no[1] <= r.box[1] && r.go[1] <= r.box[1];

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== A · setup step 3 is the answer ==');
  const later = await setupAnswer(browser, 'later');
  T('A1  setup reaches "Put it on this device"', later.onInstallScreen, later);
  T('A2  "Not right now" there records the answer (a time, so the pop-up sleeps)', later.v && Number(later.v) > Date.now() - 600000, later.v);
  T('A3  …and the dashboard pop-up then stays away', !later.popup, later);
  const inst = await setupAnswer(browser, 'install');
  T('A4  "Install now" there ends the offer for good (-1)', inst.v === '-1' && !inst.popup, inst);
  T('A5  only rrInstallOfferAnswer writes the answer (one place)', (MISC.match(/setItem\('lv_install_offer_ts'/g) || []).length === 1 && !/lv_install_offer_ts/.test(ONB), null);

  console.log('== B · the pop-up waits its turn ==');
  const turn = await waitsItsTurn(browser);
  T('B1  not over a tour card', !turn.overTour, turn);
  T('B2  not over an open box (the Add wizard)', !turn.overBox, turn);
  T('B3  shown once nothing is open (fresh device)', turn.afterAllClosed, turn);

  console.log('== C · fits on a phone ==');
  for (const w of [360, 390, 412]) {
    const f = await phoneFit(browser, w);
    T('C   ' + w + ' wide: the pop-up, Install and Cancel all on screen and inside the box', inside(f), f);
  }
  const desk = await phoneFit(browser, 1280);
  T('C   1280 wide: still a 420px box in the middle', desk && (desk.box[1] - desk.box[0]) === 420 && Math.abs((desk.box[0] + desk.box[1]) / 2 - 640) <= 2, desk);

  console.log('== D · no automatic iPhone banner ==');
  T('D1  nothing schedules _showIOSInstallHint on its own (only _pwaInstall calls it)', !/setTimeout\(\s*_showIOSInstallHint\s*,\s*\d/.test(code(MISC).replace(/setTimeout\(_showIOSInstallHint, 4000\)/g, '')), null);

  console.log('== PLANTED — the old behaviour must fail ==');
  const onbOld = plant(ONB, "      try { if (typeof window.rrInstallOfferAnswer === 'function') window.rrInstallOfferAnswer('later'); } catch (e) {}\n", '', 'setup answer');
  if (onbOld) { const r = await setupAnswer(browser, 'later', { 'onboarding.js': onbOld }); T('PLANTED setup without the answer → the pop-up asks again (A3 can fail)', r.popup, r); }
  const miscNoWait = plant(MISC, "    if (_pwaOfferBlocked()) { setTimeout(_pwaOfferInit, 4000); return; }   // v0.9.2001: wait its turn\n", '', 'wait');
  if (miscNoWait) { const r = await waitsItsTurn(browser, { 'app-misc.js': miscNoWait }); T('PLANTED no waiting → the pop-up lands on the tour (B1 can fail)', r.overTour, r); }
  const miscOldCss = plant(MISC, "left:0;right:0;margin:0 auto;z-index:9995;box-sizing:border-box;", "left:50%;transform:translateX(-50%);z-index:9995;", 'css');
  const miscOldCss2 = miscOldCss && plant(miscOldCss, "width:min(92vw,420px);", "max-width:min(92vw,420px);", 'css width');
  const miscOldCss3 = miscOldCss2 && plant(miscOldCss2, `'<div style="display:flex;gap:0.5rem;flex-wrap:wrap">'`, `'<div style="display:flex;gap:0.5rem;flex-shrink:0">'`, 'css row');
  if (miscOldCss3) { const r = await phoneFit(browser, 360, { 'app-misc.js': miscOldCss3 }); T('PLANTED the old centring → a button off the box on a 360 phone (C can fail)', !inside(r), r); }
  const miscIos = MISC + "\nsetTimeout(_showIOSInstallHint, 2500);\n";
  T('PLANTED the automatic iPhone banner back → D1 would fail', /setTimeout\(\s*_showIOSInstallHint\s*,\s*\d/.test(code(miscIos).replace(/setTimeout\(_showIOSInstallHint, 4000\)/g, '')), null);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL INSTALL OFFER ONCE TESTS GREEN') + ' (' + pass + ' passed, ' + fail + ' failed)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.message); process.exit(1); });
