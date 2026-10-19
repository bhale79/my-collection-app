#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUTO READ IS A BETA FEATURE — v0.9.1927
//
// Brad (2026-10-11): "move the autoread button to beta testers only and then
// update everywhere its mentioned as an option… im not talking about the
// barcode scanner, just the autoread".
// ONE question decides it: rrAutoReadOn() (ai-id.js) → rrFeatureOn('auto_read')
// → the Vault `features` row. Owners always have it; beta testers have it when
// the row says B; everyone else does not.
//
// Boots the REAL app (app/index.html from disk, real Chromium) both ways:
//   R1  without it every paid read is refused before any request is sent
//   R2  the refusal reads as "the free reader could not tell" (caller's words)
//   R3  the first-run card: no allowance without it, the allowance with it
//   R4  the Photo ID help page: only the free buttons without it
//   R5  the tour (the one guide since v0.9.1987): no paid read without it
//   R6  Preferences: the daily-reads switch only with it
//   R7  the scanner's crop screen: the Auto Read button only with it
// Source scans, each proving it can fail on a planted offender:
//   S1  aiSpendBlocked asks rrAutoReadOn first
//   S2  every Photo Inbox paid-read door starts with the _pinAr() guard
//   S3  every guide step that talks about a paid read is marked autoRead
//   S4  every scanner screen asks _bcArOn() before its close look
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  auto_read_beta_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const AI = read('ai-id.js'), PIN = read('photo-inbox.js'), TUT = read('tutorial.js'), BC = read('barcode.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── source scans ───────────────────────────────────────────────────────────
function s1(src) {
  // the first real statement of the function (comment lines skipped)
  const i = src.indexOf('function aiSpendBlocked() {');
  if (i < 0) return false;
  const first = src.slice(i).split('\n').slice(1).find(l => l.trim() && !/^\s*\/\//.test(l));
  return /^\s*if \(!rrAutoReadOn\(\)\) return \{ ok: false, reason: 'notbeta' \};/.test(first || '');
}
const PIN_DOORS = ['_pinIdentifyAll', '_pinIdentifySelected', '_pinReviewIdentify', '_pinVerifyReident'];
function s2(src) {
  const bad = [];
  PIN_DOORS.forEach(d => {
    const i = src.indexOf('window.' + d + ' = async function () {');
    if (i < 0) { bad.push(d + ' missing'); return; }
    const head = src.slice(i, i + 260);
    if (!/\n\s*(if \(_busy\)[^\n]*\n\s*)?if \(!_pinAr\(\)\) return;/.test(head)) bad.push(d);
  });
  // the paid markup itself
  if (!/\(!_pinAr\(\) \? '' :\s*\n\s*'<button id="pin-rv-idtoken"/.test(src)) bad.push('pin-rv-idtoken markup');
  if (!/ib\.style\.display = \(_selectMode && n && _pinAr\(\)\)/.test(src)) bad.push('pin-idsel-btn');
  if (!/if \(!_pinAr\(\)\) return;\s*\/\/ v0\.9\.1927: the double-check/.test(src)) bad.push('double-check');
  return bad;
}
const PAID_WORDS = /photo ID|Read this photo|Read these|paid read|#pin-idall-btn|#pin-rv-idtoken|#pin-idsel-btn/;
function s3(src) {
  // every step object literal inside GUIDES: "{ ... title: ..., body: ... }"
  const g0 = src.indexOf('const GUIDES = {'), g1 = src.indexOf('if (typeof window !== \'undefined\') window.GUIDES = GUIDES;');
  if (g0 < 0 || g1 < g0) return ['GUIDES block not found'];
  const body = src.slice(g0, g1);
  const bad = [];
  let seen = 0;
  const re = /\{\s*((?:autoRead: true, )?)(?:before:[\s\S]*?)?(selector:[^\n]*?)?title: '((?:[^'\\]|\\.)*)'[\s\S]*?body: '((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(body))) {
    const text = (m[2] || '') + ' ' + m[3] + ' ' + m[4];
    seen++;
    if (PAID_WORDS.test(text) && !m[1]) bad.push(m[3]);
  }
  // v0.9.1987: the tour is the only guide now (14 cards with plain-text bodies).
  if (seen < 12) bad.push('only ' + seen + ' steps scanned');
  return bad;
}
function s4(src) {
  const bad = [];
  const re = /_bcAiRescue\((video|crop|workCanvas), /g; let m;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 1400), m.index);
    if (!/_bcArOn\(\)/.test(before)) bad.push(src.slice(0, m.index).split('\n').length);
  }
  if (!/async function _bcAiRescue[^\n]*\n[^\n]*\n\s*if \(!_bcArOn\(\)\) \{ reasonOut\.reason = 'notbeta'; return null; \}/.test(src)) bad.push('_bcAiRescue door');
  return bad;
}

T('S1 aiSpendBlocked asks rrAutoReadOn first', s1(AI));
T('S1 PLANTED: without that line it is caught', !s1(AI.replace("  if (!rrAutoReadOn()) return { ok: false, reason: 'notbeta' };\n", '')));
T('S2 every Photo Inbox paid door is guarded', s2(PIN).length === 0, s2(PIN));
{
  const planted = PIN.replace("    if (!_pinAr()) return;   // v0.9.1927: paid read — beta feature\n    var gs = _rvGroups;", '    var gs = _rvGroups;');
  T('S2 PLANTED: an unguarded "Read this photo" is caught', planted !== PIN && s2(planted).indexOf('_pinReviewIdentify') >= 0, s2(planted));
}
const s3now = s3(TUT);
T('S3 every guide step about a paid read is marked autoRead', s3now.length === 0, s3now);
{
  // v0.9.1987: the Photo Inbox guide that held the real paid steps is gone
  // (the tour is the only guide), so plant a paid step into the tour.
  const at = TUT.indexOf("      { title: 'Let’s go through your dashboard',");
  const planted = at < 0 ? TUT : TUT.slice(0, at) + "      { title: 'Same read, three doors', body: 'Press <strong>Read this photo</strong> to spend one photo ID.' },\n" + TUT.slice(at);
  T('S3 PLANTED: an unmarked paid step is caught', planted !== TUT && s3(planted).indexOf('Same read, three doors') >= 0, s3(planted));
}
T('S4 every scanner close look asks _bcArOn() first', s4(BC).length === 0, s4(BC));
{
  // v0.9.1977: the old label scanner that held the first planted line is gone (one reader) — plant in Photo ID's own
  const planted = BC.replace("      if (_bcArOn()) {   // v0.9.1927: the close look is Auto Read — beta feature\n        st('ai', '<span class=\"bi-spin\">⟳</span>', 'Close look: getting the details…');",
    "      if (true) {\n        st('ai', '<span class=\"bi-spin\">⟳</span>', 'Close look: getting the details…');");
  T('S4 PLANTED: an unguarded close look is caught', planted !== BC && s4(planted).length === 1, s4(planted));
}

// ── the real app, both ways ────────────────────────────────────────────────
async function boot(browser, on) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const relay = [];
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('https://script.google.com/')) { relay.push(r.request().postData() || ''); return r.fulfill({ status: 200, body: '{"status":200}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); }
    if (!u.startsWith('file://')) return r.abort();
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(on => {
    // v0.9.1949: Auto Read is switched off for everyone (config.js
    // RR_AUTO_READ_ON). This suite tests the feature itself, so it switches
    // it on in its page and lets the ring decide, as the app would.
    window.RR_AUTO_READ_ON = true;
    const orig = window.rrFeatureOn;
    window.rrFeatureOn = n => (n === 'auto_read') ? on : orig(n);
    try { localStorage.setItem('rr_ai_optout', '0'); } catch (e) {}
  }, on);
  return { pg, relay };
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    for (const on of [false, true]) {
      const who = on ? 'WITH Auto Read' : 'WITHOUT Auto Read';
      const { pg, relay } = await boot(browser, on);
      const r = await pg.evaluate(async () => {
        const out = {};
        out.on = rrAutoReadOn();
        out.blocked = aiSpendBlocked();
        const blob = new Blob(['x'], { type: 'image/jpeg' });
        try { out.read2 = await aiIdentifyImage2([blob], {}); } catch (e) { out.read2 = 'threw ' + e.message; }
        try { out.verify = await aiVerifyPhoto(blob, 'https://example.com/x'); } catch (e) { out.verify = 'threw ' + e.message; }
        out.msg = rrReadFailMessage('notbeta', 'CALLER WORDS');
        showAiUsageCard(true);
        const card = document.getElementById('rr-ai-usage-card');
        out.card = card ? card.textContent : '';
        if (card) card.remove();
        out.help = (document.createElement('div').innerHTML = rrPhotoIdHelpHtml(), (() => { const d = document.createElement('div'); d.innerHTML = rrPhotoIdHelpHtml(); return d.textContent; })());
        // v0.9.1987: the Photo Inbox guide is gone; the tour is the one guide left.
        out.steps = _gtStepsFor(GUIDES.tour).map(s => s.title); out.allSteps = GUIDES.tour.steps.length;
        try { buildPrefsPage(); } catch (e) { out.prefsErr = e.message; }
        await new Promise(r => setTimeout(r, 300));
        out.prefSwitch = !!document.getElementById('pref-ai-opt');
        out.prefPage = !!document.getElementById('pref-collect-row');
        return out;
      });
      const reads = relay.filter(b => /identify|verify|ai_/i.test(b));
      if (!on) {
        T('R1 ' + who + ': aiSpendBlocked says notbeta', r.blocked && r.blocked.reason === 'notbeta', r.blocked);
        T('R1 ' + who + ': a paid read is refused, nothing sent', r.read2 && r.read2.ok === false && r.read2.reason === 'notbeta' && reads.length === 0, { read2: r.read2, reads });
        T('R1 ' + who + ': the catalog double-check is refused too', r.verify && r.verify.ok === false && r.verify.reason === 'notbeta', r.verify);
        T('R2 the refusal reads in the caller\'s own words', r.msg === 'CALLER WORDS', r.msg);
        // v0.9.1956 (Brad: "get rid of the free terminology as that had to do with the autoreader")
        T('R3 ' + who + ': the first-run card says how the app reads — no "free", no allowance', /How the app reads barcodes, labels and photos/.test(r.card) && !/\bfree\b/i.test(r.card) && !/allowance|Need more/i.test(r.card), r.card.slice(0, 400));
        T('R4 ' + who + ': the help page offers only free buttons', !/(?<!Google )photo ID|Read this photo|Preferences › Photo ID/i.test(r.help) && /Google Photo ID/.test(r.help), (r.help.match(/.{40}((?<!Google )photo ID|Read this photo).{40}/i) || [])[0]);   // v0.9.1960: Google's button is "Google Photo ID" (Brad) — free, not a paid photo ID
        T('R5 ' + who + ': the tour names no paid read', r.steps.length > 10 && !r.steps.some(t => /(?<!Google )photo ID|three doors|paid/i.test(t)), r.steps);   // v0.9.1960: "Google Photo ID" is Google's free search
        T('R6 ' + who + ': Preferences has no daily-reads switch', r.prefPage && !r.prefSwitch, r);
      } else {
        T('R1 ' + who + ': aiSpendBlocked lets the read through', r.on === true && r.blocked === null, r.blocked);
        T('R3 ' + who + ': the first-run card explains the daily allowance', /daily allowance/.test(r.card), r.card.slice(0, 300));
        T('R4 ' + who + ': the help page includes Read this photo', /Read this photo/.test(r.help) && /About photo IDs/.test(r.help), '');
        T('R5 ' + who + ': the tour shows every one of its cards', r.steps.length === r.allSteps, r.steps);
        T('R6 ' + who + ': Preferences has the daily-reads switch', r.prefSwitch, r);
      }
      // R7: the scanner's crop screen, opened on a real picture
      const sc = await pg.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 400; c.height = 300;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 300);
        let opened = false;
        try {
          window.Cropper = function () { this.destroy = function () {}; this.rotateTo = function () {}; };   // the CDN is not reachable here
          window._barcodeDebug._biCrop(c, null); opened = true;
        } catch (e) { return { err: e.message }; }
        await new Promise(r => setTimeout(r, 1500));
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => b.textContent.trim());
        return { opened, btns, text: document.body.innerText.slice(0, 20000) };
      });
      if (sc.opened) {
        const hasAuto = sc.btns.some(t => /^Auto Read/.test(t));
        T('R7 ' + who + ': the crop screen ' + (on ? 'has' : 'has no') + ' Auto Read button', on ? hasAuto : !hasAuto, sc.btns);
      } else {
        T('R7 the crop screen could be opened for the check', false, sc);
      }
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\nauto_read_beta_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
