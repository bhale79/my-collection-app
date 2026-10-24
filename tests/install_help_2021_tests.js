#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// INSTALL HELP — v0.9.2021   (part 1 plain node, part 2 real Chromium + the REAL app)
//
// [stated] Brad 2026-10-23, on his computer: the pop-up asked him to install an
// app that was ALREADY installed, and Install then showed phone words ("… Add
// to Home screen"). And: "it also showed up on a users phone eailer and it
// wouldn't install on their iphone, it was a new user."
//
// THE RULES:
//   A  rrInstallHelpKind picks the right steps for the browser in use:
//      iPhone Safari / iPhone Chrome / other iPhone browser / an app's built-in
//      browser (Facebook, Instagram, Google app, a preview with no "Safari/") /
//      iPad that calls itself a Mac / Android / a computer
//   B  the pop-up shows only when the browser has offered an install, or on an
//      iPhone/iPad (which never get an offer) — a computer with no offer: none
//   C  Install with nothing to hand over opens the steps card, worded for that
//      browser — never the old phone-words toast — and the card STAYS until
//      closed (the old iPhone strip vanished after 12 s)
//   D  setup step 3 uses the same words (one place: RR_INSTALL_HELP)
// Each rule has a PLANTED old version that must fail.
// Run:  node tests/install_help_2021_tests.js
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const CFG = fs.readFileSync(path.join(APPDIR, 'config.js'), 'utf8');
const MISC = fs.readFileSync(path.join(APPDIR, 'app-misc.js'), 'utf8');
const ONB = fs.readFileSync(path.join(APPDIR, 'onboarding.js'), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function plant(src, from, to, name) { if (src.indexOf(from) < 0) { T('PLANTED ' + name + ': anchor found', false, from.slice(0, 80)); return null; } return src.split(from).join(to); }

// ── A · lift the words + the picker out of config.js and ask it ──────────────
function lift(src) {
  const a = src.indexOf('const RR_INSTALL_HELP = {');
  const b = src.indexOf('window.rrInstallHelpKind = rrInstallHelpKind; }', a);
  if (a < 0 || b < 0) return null;
  const body = src.slice(a, b) + '}';
  return new Function('navigator', body.replace(/if \(typeof window !== 'undefined'\) \{[^\n]*$/, '') + '\nreturn { H: RR_INSTALL_HELP, kind: rrInstallHelpKind };')(undefined);
}
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.0.2592.56 Mobile/15E148 Safari/605.1.15',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.109;FBBV/612345678]',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91',
  googleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/322.0.648915268 Mobile/15E148 Safari/604.1',
  webview: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};
console.log('== A · the right steps for the browser in use ==');
const L = lift(CFG);
T('A0  the words and the picker can be lifted out of config.js', !!L);
if (L) {
  const cases = [
    ['iPhone Safari', UA.iphoneSafari, '', 0, 'ios-safari'],
    ['iPhone Chrome', UA.iphoneChrome, '', 0, 'ios-chrome'],
    ['iPhone Firefox', UA.iphoneFirefox, '', 0, 'ios-other'],
    ['iPhone Edge', UA.iphoneEdge, '', 0, 'ios-other'],
    ['Facebook on an iPhone', UA.facebook, '', 0, 'ios-inapp'],
    ['Instagram on an iPhone', UA.instagram, '', 0, 'ios-inapp'],
    ['the Google app on an iPhone', UA.googleApp, '', 0, 'ios-inapp'],
    ['a preview inside another app (no "Safari/")', UA.webview, '', 0, 'ios-inapp'],
    ['an iPad that calls itself a Mac', UA.ipadAsMac, 'MacIntel', 5, 'ios-safari'],
    ['an Android phone', UA.android, 'Linux armv8l', 5, 'android'],
    ['a Windows computer', UA.windows, 'Win32', 0, 'desktop'],
    ['a real Mac (no touchscreen)', UA.macSafari, 'MacIntel', 0, 'desktop'],
  ];
  for (const [n, ua, pf, tp, want] of cases) { const got = L.kind(ua, pf, tp); T('A   ' + n + ' → ' + want, got === want, got); }
  const kinds = ['ios-safari', 'ios-chrome', 'ios-other', 'ios-inapp', 'android', 'desktop'];
  T('A   every kind has a title, a lead and at least one step', kinds.every(k => L.H[k] && L.H[k].title && L.H[k].lead && (L.H[k].steps || []).length), Object.keys(L.H));
  T('A   the in-app card tells them to open Safari first', /Open in Safari/.test(L.H['ios-inapp'].title + L.H['ios-inapp'].steps.join(' ')));
  T('A   the computer card says it is probably already installed — not phone words', /already installed/.test(L.H.desktop.lead) && !/Home [Ss]creen/.test(JSON.stringify(L.H.desktop)));
  T('A   no "AI" wording anywhere in the cards', !/\bAI\b/.test(JSON.stringify(L.H)));
  // PLANTED: forget the in-app list → the Google app (which says "Safari/") gets the Safari steps that cannot work there
  const oldPick = plant(CFG, "    if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Snapchat|Pinterest|MicroMessenger|Line\\/|GSA\\/|; wv\\)/i.test(ua)) return 'ios-inapp';\n", '', 'in-app');
  const LP = oldPick && lift(oldPick);
  T('PLANTED no in-app check → the Google app gets the Safari steps (A can fail)', LP && LP.kind(UA.googleApp, '', 0) !== 'ios-inapp', LP && LP.kind(UA.googleApp, '', 0));
  const oldIpad = plant(CFG, " || (platform === 'MacIntel' && touchPoints > 1)", '', 'ipad');
  const LI = oldIpad && lift(oldIpad);
  T('PLANTED no iPad-as-Mac check → an iPad gets computer steps (A can fail)', LI && LI.kind(UA.ipadAsMac, 'MacIntel', 5) === 'desktop', LI && LI.kind(UA.ipadAsMac, 'MacIntel', 5));
}

// ── B, C, D · the real app in real Chromium ──────────────────────────────────
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  install_help_2021_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');

// Pretend to be an iPhone/iPad (or not) for the code that reads navigator.
const BE_APPLE = `Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });`;

async function popup(browser, { offer, apple, files }) {
  const { pg } = await H.openApp(browser, { w: 1280, h: 800, files });
  const r = await pg.evaluate(({ offer, apple, BE_APPLE }) => {
    try { localStorage.removeItem('lv_install_offer_ts'); } catch (e) {}
    if (apple) (new Function(BE_APPLE))();
    window._pwaPrompt = offer ? { prompt() {}, userChoice: Promise.resolve({}) } : null;
    document.querySelectorAll('#pwa-install-offer,#gt-callout').forEach(n => n.remove());
    _pwaOfferInit();
    return !!document.getElementById('pwa-install-offer');
  }, { offer, apple, BE_APPLE });
  await pg.close();
  return r;
}

async function installCard(browser, { apple, ua, files, wait }) {
  const { pg } = await H.openApp(browser, { w: 390, h: 800, files });
  const r = await pg.evaluate(async ({ apple, ua, BE_APPLE, wait }) => {
    if (apple) (new Function(BE_APPLE))();
    if (ua) Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
    window._pwaPrompt = null;
    let toast = '';
    const realToast = window.showToast;
    window.showToast = function (m) { toast += String(m) + ' | '; };
    _pwaInstall();
    const c = document.getElementById('ios-install-hint');
    const out = { card: !!c, kind: c && c.dataset.kind, text: c ? c.textContent : '', toast };
    if (wait) { await new Promise(r => setTimeout(r, wait)); out.stillThere = !!document.getElementById('ios-install-hint'); }
    const ok = c && c.querySelector('[data-ih="ok"]');
    if (ok) { ok.click(); out.closed = !document.getElementById('ios-install-hint'); }
    window.showToast = realToast;
    return out;
  }, { apple, ua, BE_APPLE, wait: wait || 0 });
  await pg.close();
  return r;
}

async function setupScreen(browser, { ua, apple }) {
  const { pg } = await H.openApp(browser, { w: 390, h: 800 });
  const t = await pg.evaluate(async ({ ua, apple, BE_APPLE }) => {
    if (apple) (new Function(BE_APPLE))();
    if (ua) Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
    window._pwaPrompt = null;
    showFeatureMap();
    await new Promise(r => setTimeout(r, 300));
    onboardNext(); await new Promise(r => setTimeout(r, 150));
    onboardNext(); await new Promise(r => setTimeout(r, 150));
    return (document.getElementById('onboarding-map-panel') || {}).textContent || '';
  }, { ua, apple, BE_APPLE });
  await pg.close();
  return t;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== B · the pop-up only when an install can really happen ==');
  T('B1  a computer whose browser offered nothing (already installed): no pop-up', !(await popup(browser, { offer: false, apple: false })));
  T('B2  a computer whose browser offered an install: the pop-up', await popup(browser, { offer: true, apple: false }));
  T('B3  an iPhone/iPad (never offered): the pop-up', await popup(browser, { offer: false, apple: true }));
  const oldGate = plant(MISC, "    if (!window._pwaPrompt && !_isAppleTouch()) return;\n", '', 'gate');
  if (oldGate) T('PLANTED no offer check → the pop-up asks an installed computer again (B1 can fail)', await popup(browser, { offer: false, apple: false, files: { 'app-misc.js': oldGate } }));

  console.log('== C · Install with nothing to hand over → the steps card ==');
  const desk = await installCard(browser, { apple: false, ua: UA.windows });
  T('C1  a computer: the card, computer steps', desk.card && desk.kind === 'desktop' && /already installed/.test(desk.text), desk);
  T('C2  …and no phone-words toast', !/Home screen/i.test(desk.toast), desk.toast);
  T('C3  …and "Got it" closes it', desk.closed === true, desk);
  const fb = await installCard(browser, { apple: true, ua: UA.facebook });
  T('C4  Facebook on an iPhone: "Open this page in Safari first"', fb.card && fb.kind === 'ios-inapp' && /Open in Safari/.test(fb.text), fb);
  const sf = await installCard(browser, { apple: true, ua: UA.iphoneSafari, wait: 13500 });
  T('C5  iPhone Safari: Share → Add to Home Screen steps', sf.card && sf.kind === 'ios-safari' && /Add to Home Screen/.test(sf.text), sf);
  T('C6  …still on screen after 13 s (the old strip left at 12 s)', sf.stillThere === true, sf);
  const oldToast = plant(MISC, "  _pwaInstallHelpCard();\n}\n// ── v0.9.1416", "  if (typeof showToast === 'function') showToast(\"Your browser didn't offer an install here — in Chrome use the \\u22ee menu \\u2192 Add to Home screen\", 5000);\n}\n// ── v0.9.1416", 'toast');
  if (oldToast) { const r = await installCard(browser, { apple: false, ua: UA.windows, files: { 'app-misc.js': oldToast } }); T('PLANTED the old toast back → no card, phone words (C1/C2 can fail)', !r.card && /Home screen/.test(r.toast), r); }
  const oldTimer = plant(MISC, "    card.querySelector('[data-ih=\"ok\"]').onclick = close;\n", "    card.querySelector('[data-ih=\"ok\"]').onclick = close;\n    setTimeout(function () { card.remove(); }, 12000);\n", 'timer');
  if (oldTimer) { const r = await installCard(browser, { apple: true, ua: UA.iphoneSafari, wait: 13500, files: { 'app-misc.js': oldTimer } }); T('PLANTED a 12 s timer back → the card is gone at 13 s (C6 can fail)', r.card && r.stillThere === false, r); }

  console.log('== D · setup step 3 uses the same words ==');
  const sDesk = await setupScreen(browser, { ua: UA.windows });
  T('D1  a computer: setup shows the computer words', /already installed/.test(sDesk), sDesk.slice(0, 200));
  const sFb = await setupScreen(browser, { ua: UA.facebook, apple: true });
  T('D2  Facebook on an iPhone: setup says open in Safari first', /Open in Safari/.test(sFb), sFb.slice(0, 200));
  T('D3  onboarding.js reads RR_INSTALL_HELP (no second copy of the steps)', /RR_INSTALL_HELP/.test(ONB) && /rrInstallHelpKind\(/.test(ONB) && !/Add to Home Screen/.test(ONB.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')), null);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL INSTALL HELP TESTS GREEN') + ' (' + pass + ' passed, ' + fail + ' failed)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.message); process.exit(1); });
