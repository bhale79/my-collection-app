#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RECORDING MODE SHOWS WHAT A NEW MEMBER SEES — v0.9.1957   (real Chromium)
//
// [stated] Brad, 2026-10-15: "in the recording mode, do not show the logo cards
// in the dashboard editor" — and, asked how far to go: "recording mode should
// only show what a new user would be seeing".
//
// A new member has no Appearance (it is a beta feature), so no logo cards, no
// colours of their own and no logo marks. Brad's own account is an owner AND a
// beta tester, so all of it showed while he recorded.
//
//   E  the dashboard editor offers no logo cards in recording mode; with
//      recording mode off (same account) it does. PLANTED: the veto removed.
//   D  a logo card already placed on the dashboard is not drawn in recording
//      mode; it is with recording mode off.
//   A  the Appearance editor does not open in recording mode.
//   C  the colours made in Appearance (the 'custom' look) are not applied in
//      recording mode; they are with it off — and nothing saved is changed.
//   B  the owner's logo marks (the watermark) are not shown in recording mode;
//      they are with it off — and the saved marks are untouched.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  recording_new_user_1957_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }

// a 2×2 PNG as a logo mark
const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJgYEBAA8CAQEhHqDEAAAAAElFTkSuQmCC';

async function boot(browser, recording, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  // what Brad's browser holds BEFORE the app starts: his look, his marks, a
  // logo card on the dashboard, and the recording switch
  await pg.addInitScript(([rec, dot]) => {
    try {
      localStorage.setItem('rr_recording_mode', rec ? '1' : '0');
      localStorage.setItem('lv_theme', 'custom');
      localStorage.setItem('lv_skin_custom', JSON.stringify({ accent: '#123456' }));
      localStorage.setItem('rr_skin_brand', JSON.stringify({ watermark: { data: dot, kind: 'png', sw: 1 } }));
      localStorage.setItem('rr_logo_cards', JSON.stringify([{ id: 'lc1', name: 'Brad logo', img: dot, top: 'BRAD', bottom: '' }]));
      localStorage.setItem('lv_dash_slots', JSON.stringify([{ id: 'logoSmall', card: 'lc1' }, { id: 'catalog' }]));
    } catch (e) {}
  }, [recording, DOT]);
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => {
    // Brad: an owner and a beta tester
    state.user = { email: 'support@therailroster.com', name: 'The Rail Roster' };
    window._subState = { sub: 'beta', features: [] };
    state.masterData = []; try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {};
    try { applyTheme(); } catch (e) {}
    try { applyBranding(); } catch (e) {}
    const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    const ap = document.getElementById('app'); if (ap) ap.classList.add('active');
  });
  await pg.waitForTimeout(300);
  return { pg, errs };
}
const look = pg => pg.evaluate(async () => {
  const out = {};
  out.appearanceOn = rrAppearanceOn();
  // the dashboard editor's card list
  try { openDashEditor(); } catch (e) { out.edErr = String(e); }
  await new Promise(r => setTimeout(r, 300));
  out.editorText = document.body.innerText;
  out.editorLogo = /My logo/.test(out.editorText);
  try { _dashEdClose(); } catch (e) {}
  // the dashboard itself
  try { buildDashboard(); } catch (e) { out.dashErr = String(e); }
  await new Promise(r => setTimeout(r, 300));
  const g = document.getElementById('stats-grid');
  out.dashCards = g ? [...g.querySelectorAll('.stat-card')].map(c => (c.querySelector('.stat-label') || c).textContent.trim().slice(0, 30)) : [];
  out.dashLogo = !!(g && g.querySelector('[onclick*="_rrlcOpen"]'));
  // the colours and the marks
  out.accentInline = document.documentElement.style.getPropertyValue('--accent');
  out.watermark = !!document.getElementById('rr-logo-bg');
  // Appearance editor
  try { openAppearance(); } catch (e) {}
  await new Promise(r => setTimeout(r, 300));
  out.appearanceEditor = !!document.getElementById('rrap') || !!document.getElementById('rrap-mini');
  ['rrap', 'rrap-mini'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); });
  // nothing saved moved
  out.saved = { theme: localStorage.getItem('lv_theme'), skin: localStorage.getItem('lv_skin_custom'), brand: !!localStorage.getItem('rr_skin_brand'), cards: !!localStorage.getItem('rr_logo_cards') };
  return out;
});

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const off = await boot(browser, false);
    const o = await look(off.pg);
    const on = await boot(browser, true);
    const r = await look(on.pg);
    T('(set-up) with recording mode OFF, Brad\'s account has Appearance (owner + beta)', o.appearanceOn === true, o.appearanceOn);
    T('E recording mode: the dashboard editor offers no logo cards', r.appearanceOn === false && !r.editorLogo && /Edit|Dashboard|Save/i.test(r.editorText), { on: r.appearanceOn, logo: r.editorLogo, err: r.edErr });
    T('E …with it off, the same account sees them ("My logo")', o.editorLogo, { err: o.edErr });
    T('D a logo card already on the dashboard is not drawn in recording mode', !r.dashLogo, r.dashCards);
    T('D …and is drawn with it off', o.dashLogo, o.dashCards);
    T('A the Appearance editor does not open in recording mode', !r.appearanceEditor);
    T('C the colours made in Appearance are not applied in recording mode', !r.accentInline, r.accentInline);
    T('C …and are with it off (#123456)', /#123456/i.test(o.accentInline), o.accentInline);
    T('B the owner\'s logo watermark is not shown in recording mode', !r.watermark);
    T('B …and is with it off', o.watermark);
    T('C/B nothing saved is changed by recording mode (look, colours, marks, logo cards)', r.saved.theme === 'custom' && /123456/.test(r.saved.skin || '') && r.saved.brand && r.saved.cards, r.saved);
    T('page errors', off.errs.length === 0 && on.errs.length === 0, off.errs.concat(on.errs));
    await off.pg.close(); await on.pg.close();

    // PLANTED: the Appearance veto removed → the editor offers logo cards again in recording mode
    const cfg = read('config.js');
    // v0.9.2008: rrAppearanceOn asks the features ring (rrFeatureOn, which has its own
    // veto), so "the veto removed" = drop rrAppearanceOn's veto AND ask the owner list directly.
    const old = cfg.replace("  if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return false;\n  if (typeof APPEARANCE_ENABLED", "  if (typeof APPEARANCE_ENABLED")
                   .replace("typeof rrFeatureOn === 'function' && rrFeatureOn(RR_APPEARANCE_FEATURE)", "rrIsRealOwner()");
    if (old === cfg) T('E PLANTED: could plant the old Appearance switch', false);
    else {
      const p = await boot(browser, true, { 'config.js': old });
      const pr = await look(p.pg);
      T('E PLANTED: without the veto, recording mode offers logo cards again (E would fail)', pr.editorLogo === true, pr.appearanceOn);
      await p.pg.close();
    }
    const dash = read('dashboard.js');
    const oldD = dash.replace("        if (card.logoCard && typeof rrRecordingMode === 'function' && rrRecordingMode()) return '';\n", '');
    if (oldD === dash) T('D PLANTED: could plant the old dashboard', false);
    else {
      const p = await boot(browser, true, { 'dashboard.js': oldD });
      const pr = await look(p.pg);
      T('D PLANTED: without the skip, recording mode draws the logo card (D would fail)', pr.dashLogo === true, pr.dashCards);
      await p.pg.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('RECORDING NEW USER 1957 TESTS FAILING'); process.exit(1); }
  console.log('ALL RECORDING NEW USER 1957 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
