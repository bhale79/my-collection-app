#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// FIRST RUN — v0.9.1893   (real Chromium, the REAL app)
//
// Brad, 2026-10-08, after walking the app on his phone as a brand-new account:
//   "I don't think we need … all the welcome to the rail roster scrolling
//    pages. I think we need the app to open up and start the tour … same thing
//    with the scanning and photo id. I think the first time they go to add an
//    item we need a pop up to explain scanning and photo id. I think the
//    community page should be first, then the what do you collect. on the
//    collect page, we should have scale at the top … if we do this, we don't
//    need the skip tour option at the top either … remove the values and
//    rarity mentions."
// And from the same phone test: the setup ran ON TOP of the "Start your
// 3-week free trial" screen, and the trial date read 2026-10-29.
//
// What this proves, by driving the real screens:
//   A. setup waits while the welcome / lock screen is up, starts when the
//      answer says the app is open, and goes ahead anyway if no answer comes
//   B. step 1 is the community page — no Skip, no Back, no values or rarity
//   C. step 2 has scale buttons that tick every maker's line in that scale
//   D. device Back steps back, never skips; finishing starts the guided tour
//   E. the first Add an Item shows the scanning / photo ID card once per account
//   F. no welcome card anywhere; the Help row reopens the scanning card
//   G. money dates in words; the Preferences opt-in reads the same words
// Section P plants an offender for every source rule.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  first_run_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\/[^\n]*/g, '');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 400))); cond ? pass++ : fail++; }

(async () => {
  // the cloud workspace keeps its browser here; elsewhere Playwright finds its own
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);

  // a signed-in brand-new account, app shell up, nothing onboarded
  await pg.evaluate(() => {
    window.state = window.state || {};
    state.user = { email: 'new.collector@gmail.com', name: 'New Collector' };
    state.masterData = []; if (typeof _rebuildMasterIndex === 'function') _rebuildMasterIndex();
    state.personalData = {}; state.soldData = {}; state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.partsData = {}; state.contactsData = []; state.savedReports = [];
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    var gate = document.getElementById('beta-gate'); if (gate) gate.style.display = 'none';
    document.getElementById('app').classList.add('active');
    try { buildDashboard(); } catch (e) {}
    showPage('dashboard');
    localStorage.removeItem('lv_onboarded');
    localStorage.removeItem('lv_ai_usage_seen');
    window._pwaIsInstalled = function () { return false; };   // the install step is offered
  });

  const ov = () => pg.evaluate(() => {
    const o = document.getElementById('onboarding-map-overlay');
    return o ? (o.innerText || '').replace(/\s+/g, ' ') : null;
  });

  // ── A. waits for the subscription answer ────────────────────────────────
  console.log('\n== A · setup waits for the trial screen ==');
  await pg.evaluate(() => {
    window._subState = { status: 200, sub: 'none', enforce: true, payLink: 'https://buy.stripe.com/x' };
    showOnboarding();
  });
  await pg.waitForTimeout(600);
  T('A1  never subscribed, enforcement on: NO setup over the trial screen', (await ov()) === null);
  await pg.evaluate(() => {
    window._subState = { status: 200, sub: 'trial', enforce: true, trialEnds: '2026-10-29' };
    window.dispatchEvent(new CustomEvent('rr:substate', { detail: window._subState }));
  });
  await pg.waitForTimeout(500);
  const s1 = await ov();
  T('A2  …and the moment the answer says the app is open (trial), setup starts', !!s1 && /Help the catalog grow/.test(s1), s1);

  // ── B. step 1 = community ───────────────────────────────────────────────
  console.log('\n== B · step 1 is the community page ==');
  T('B1  "Step 1 of 3" (install offered) and titled "Help the catalog grow"', /STEP 1 OF 3/i.test(s1) && /Help the catalog grow/.test(s1), s1 && s1.slice(0, 120));
  T('B2  no "Skip tour" anywhere', !/Skip tour/i.test(s1));
  T('B3  no Back on the first screen', !/←\s*Back/.test(s1));
  T('B4  no promise of market values or rarity scores', !/rarity|market value|unlock/i.test(s1), s1);
  T('B5  the two answers are there', /Not right now/.test(s1) && /Yes, I'll contribute/.test(s1));
  T('B6  the privacy facts stay (anonymous, what gets submitted)', /submitted anonymously/.test(s1) && /What gets submitted/i.test(s1));

  // ── C. step 2 = collect, with scale buttons ─────────────────────────────
  console.log('\n== C · what do you collect, scale buttons on top ==');
  await pg.evaluate(() => onboardOptInNo());
  await pg.waitForTimeout(300);
  const s2 = await pg.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('#onboarding-scale-chips button[data-scale]')).map(b => b.getAttribute('data-scale'));
    const save = document.getElementById('onboarding-era-save');
    const firstChip = document.getElementById('onboarding-scale-chips');
    const firstRow = document.getElementById('onboarding-era-rows');
    return { text: (document.getElementById('onboarding-map-overlay').innerText || '').replace(/\s+/g, ' '), chips, saveOff: save && save.disabled,
             chipsAbove: !!(firstChip && firstRow && (firstChip.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING)) };
  });
  T('C1  "Step 2 of 3 — What do you collect?"', /STEP 2 OF 3/i.test(s2.text) && /What do you collect\?/.test(s2.text), s2.text.slice(0, 120));
  T('C2  scale buttons O, S, Standard, HO, N, Z, G, On30, HOn30', JSON.stringify(s2.chips) === JSON.stringify(['O', 'S', 'Standard', 'HO', 'N', 'Z', 'G', 'On30', 'HOn30']), s2.chips);
  T('C3  …above the maker list', s2.chipsAbove);
  T('C4  Save stays off until something is picked', s2.saveOff === true);
  const pick = (id) => pg.evaluate((id) => {
    onboardScaleToggle(id);
    const on = Array.from(document.querySelectorAll('#onboarding-era-rows input[data-era]')).filter(b => b.checked).map(b => b.getAttribute('data-era'));
    const chip = document.querySelector('#onboarding-scale-chips button[data-scale="' + id + '"]');
    return { on, pressed: chip && chip.getAttribute('aria-pressed'), saveOff: document.getElementById('onboarding-era-save').disabled };
  }, id);
  const o1 = await pick('O');
  const wantO = ['prewar', 'pw', 'mpc', 'atlas', 'mth_o', 'mth_tinplate', 'weaver', 'rmt', 'menards', 'thirdrail', 'kline', 'williams', 'marx', 'other_o', 'bachmann_o'];
  T('C5  tapping O ticks every maker\'s O line (Pre-War and MTH Tinplate too — both O and Standard)', wantO.every(k => o1.on.indexOf(k) >= 0), wantO.filter(k => o1.on.indexOf(k) < 0));
  T('C6  …and nothing that is not O (no HO, no On30)', o1.on.every(k => wantO.indexOf(k) >= 0), o1.on.filter(k => wantO.indexOf(k) < 0));
  T('C7  …the O button shows as on, and Save comes on', o1.pressed === 'true' && o1.saveOff === false, o1);
  const stdLit = await pg.evaluate(() => document.querySelector('#onboarding-scale-chips button[data-scale="Standard"]').getAttribute('aria-pressed'));
  T('C7b …and ONLY O lights — not Standard, though Pre-War and Tinplate are both', stdLit === 'false', stdLit);
  const both = await pg.evaluate(() => {
    onboardScaleToggle('Standard'); onboardScaleToggle('O');   // Standard on, then O off
    return Array.from(document.querySelectorAll('#onboarding-era-rows input[data-era]')).filter(b => b.checked).map(b => b.getAttribute('data-era'));
  });
  T('C7c with Standard also on, turning O off keeps the lines Standard still wants', JSON.stringify(both.sort()) === JSON.stringify(['mth_tinplate', 'prewar']), both);
  await pg.evaluate(() => { onboardScaleToggle('Standard'); onboardScaleToggle('O'); });   // back to: O on only
  const o2 = await pick('O');
  T('C8  tapping O again unticks them all', o2.on.length === 0 && o2.pressed === 'false', o2);
  const h1 = await pick('HO');
  const hoPart = await pg.evaluate(() => {
    const b = document.querySelector('#onboarding-era-rows input[data-era="kato_ho"]'); b.checked = false; onboardEraSync();
    return document.querySelector('#onboarding-scale-chips button[data-scale="HO"]').getAttribute('aria-pressed');
  });
  T('C9  HO ticks the HO lines; untick one by hand and the HO button is no longer "on"', h1.on.indexOf('mod_ho') >= 0 && h1.on.indexOf('atlas_ho') >= 0 && h1.on.indexOf('pw') < 0 && hoPart === 'false', { on: h1.on, hoPart });

  // ── D. device Back, save, finish → tour ─────────────────────────────────
  console.log('\n== D · Back steps back; finishing starts the tour ==');
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(500);
  const back1 = await ov();
  T('D1  device Back on step 2 goes to step 1 (it does not skip setup)', !!back1 && /STEP 1 OF 3/i.test(back1), back1 && back1.slice(0, 80));
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(500);
  const back2 = await ov();
  T('D2  device Back on step 1 stays on step 1', !!back2 && /STEP 1 OF 3/i.test(back2), back2 && back2.slice(0, 80));
  await pg.evaluate(() => onboardOptInYes());
  await pg.waitForTimeout(300);
  await pick('O');
  await pg.evaluate(() => document.getElementById('onboarding-era-save').click());
  await pg.waitForTimeout(300);
  const s3 = await ov();
  const saved = await pg.evaluate(() => { try { return JSON.parse(_prefGet('lv_collect_eras', '[]')); } catch (e) { return null; } });
  T('D3  Save keeps exactly what was ticked', Array.isArray(saved) && saved.indexOf('pw') >= 0 && saved.indexOf('atlas') >= 0 && saved.indexOf('mod_ho') < 0, saved);
  T('D4  step 3 of 3 is the install offer', !!s3 && /STEP 3 OF 3/i.test(s3) && /Put it on this device/.test(s3), s3 && s3.slice(0, 80));
  await pg.evaluate(() => { const row = document.getElementById('onboard-install-actions'); row.querySelector('button').click(); });
  await pg.waitForTimeout(2200);
  const fin = await pg.evaluate(() => ({
    overlay: !!document.getElementById('onboarding-map-overlay'),
    done: rrOnboardingSeenByCurrentAccount(),
    tour: !!document.getElementById('gt-callout'),
    tourTitle: ((document.getElementById('gt-title') || {}).textContent || ''),
    page: ((document.querySelector('.page.active') || {}).id || '')
  }));
  T('D5  finishing closes setup and remembers it for this account', !fin.overlay && fin.done === true, fin);
  T('D6  …and the guided tour starts by itself on the dashboard', fin.tour && /dashboard/.test(fin.page), fin);
  await pg.evaluate(() => { try { _gtEnd(); } catch (e) {} const c = document.getElementById('gt-callout'); if (c) c.remove(); });

  // fail-open: no answer at all → setup still starts
  await pg.evaluate(() => {
    state.user = { email: 'offline.person@gmail.com', name: 'Off Line' };
    window._subState = null;
    showOnboarding();
  });
  await pg.waitForTimeout(1000);
  const early = await ov();
  await pg.waitForTimeout(7800);
  const late = await ov();
  T('A3  no answer ever comes (offline): setup waits, then goes ahead anyway after 8 s', early === null && !!late && /STEP 1/i.test(late), { early: !!early, late: !!late });
  await pg.evaluate(() => { const o = document.getElementById('onboarding-map-overlay'); if (o) o.remove(); });

  // ── E. first Add an Item → the scanning / photo ID card, once per account ─
  console.log('\n== E · first Add an Item ==');
  const card = () => pg.evaluate(() => { const c = document.getElementById('rr-ai-usage-card'); return c ? (c.innerText || '').replace(/\s+/g, ' ') : null; });
  await pg.evaluate(() => { state.user = { email: 'adder@gmail.com', name: 'Adder' }; localStorage.removeItem('lv_ai_usage_seen'); rrMaybeShowAddHelp(); });
  await pg.waitForTimeout(600);
  const c1 = await card();
  T('E1  the first Add an Item shows "Scanning and photo ID"', !!c1 && /Scanning and photo ID/.test(c1) && /a daily allowance/.test(c1), c1);
  T('E2  …its footer points at the Help row that exists', !!c1 && /Help \(in the side menu\) → Scanning and photo ID/.test(c1), c1);
  await pg.evaluate(() => document.getElementById('rr-ai-usage-go').click());
  await pg.evaluate(() => rrMaybeShowAddHelp());
  await pg.waitForTimeout(600);
  T('E3  …once: the second Add an Item does not show it', (await card()) === null);
  await pg.evaluate(() => { state.user = { email: 'someone.else@gmail.com', name: 'Else' }; rrMaybeShowAddHelp(); });
  await pg.waitForTimeout(600);
  T('E4  a different account on the same browser still gets it once', (await card()) !== null);
  await pg.evaluate(() => { const c = document.getElementById('rr-ai-usage-card'); if (c) c.remove();
    state.user = { email: 'walker@gmail.com', name: 'W' };
    const g = document.createElement('div'); g.id = 'gt-callout'; document.body.appendChild(g); rrMaybeShowAddHelp(); });
  await pg.waitForTimeout(600);
  T('E5  it stays out of the way of a running guided walkthrough', (await card()) === null);
  await pg.evaluate(() => { const g = document.getElementById('gt-callout'); if (g) g.remove(); });
  T('E6  openWizard is what calls it', /rrMaybeShowAddHelp\(\)/.test(strip(rd('wizard.js'))));
  const e9 = await pg.evaluate(async () => {
    state.user = { email: 'guide.starter@gmail.com', name: 'G' };
    showAiUsageCard(false);
    const before = !!document.getElementById('rr-ai-usage-card');
    startGuide('add-item'); await new Promise(r => setTimeout(r, 900));
    const after = !!document.getElementById('rr-ai-usage-card');
    const seen = localStorage.getItem('lv_ai_usage_seen') === rrAccountFingerprint('guide.starter@gmail.com');
    try { _gtEnd(); } catch (e) {}
    try { if (typeof closeWizard === 'function') closeWizard(); } catch (e) {}
    return { before, after, seen };
  });
  T('E9  a guide the person starts moves the card aside UNREAD (it comes back next add)', e9.before && !e9.after && !e9.seen, e9);
  T('E7  the per-account flag survives sign-out (on the keep list)', /'lv_ai_usage_seen',/.test(rd('config.js').slice(rd('config.js').indexOf('const SIGNOUT_KEEP_KEYS'), rd('config.js').indexOf('const SIGNOUT_KEEP_PREFIXES'))));

  // ── F. no welcome card; Help row ────────────────────────────────────────
  console.log('\n== F · no welcome card ==');
  const f = await pg.evaluate(async () => {
    const defined = typeof window.showWelcomeCard === 'function';
    openHelpHub(); await new Promise(r => setTimeout(r, 400));
    const hub = (document.getElementById('help-hub-modal') || {}).innerText || '';
    const m = document.getElementById('help-hub-modal'); if (m) m.remove();
    return { defined, hasRow: /Scanning and photo ID/.test(hub), oldRow: /Show the welcome card again/.test(hub), welcomeOnPage: !!document.getElementById('rr-welcome-card') };
  });
  T('F1  showWelcomeCard no longer exists and nothing put the card on screen', !f.defined && !f.welcomeOnPage, f);
  T('F2  Help has "Scanning and photo ID", not "Show the welcome card again"', f.hasRow && !f.oldRow, f);

  // ── G. dates in words; Preferences opt-in reads the same words ──────────
  console.log('\n== G · money dates and the opt-in words ==');
  const g = await pg.evaluate(async () => {
    const long = _formatDateLong('2026-10-29');
    state.user = { email: 'trial.date@gmail.com', name: 'T' };
    _subApply({ status: 200, sub: 'none', enforce: true, payLink: 'https://buy.stripe.com/x', renewLink: 'https://buy.stripe.com/y' });
    const scr = (document.getElementById('sub-screen') || {}).innerText || '';
    const z = document.getElementById('sub-screen') ? getComputedStyle(document.getElementById('sub-screen')).zIndex : '';
    _subApply({ status: 200, sub: 'beta', enforce: true });
    vaultShowOptInModal(true); await new Promise(r => setTimeout(r, 200));
    const modal = Array.from(document.querySelectorAll('body > div')).map(d => d.innerText || '').filter(t => /What gets submitted/i.test(t)).join(' ');
    document.querySelectorAll('body > div').forEach(d => { if (/What gets submitted/i.test(d.innerText || '')) d.remove(); });
    const row = document.createElement('div'); vaultRenderPrefsRow(row);
    return { long, scr: scr.replace(/\s+/g, ' '), z, modal: modal.replace(/\s+/g, ' '), row: row.innerText.replace(/\s+/g, ' ') };
  });
  T('G1  _formatDateLong("2026-10-29") is "October 29, 2026"', g.long === 'October 29, 2026', g.long);
  T('G2  the trial screen says the charge date in words, not 2026-10-29', /not charged until [A-Z][a-z]+ \d{1,2}, \d{4}/.test(g.scr) && !/\d{4}-\d{2}-\d{2}/.test(g.scr), g.scr.slice(0, 200));
  T('G3  the trial screen sits above everything (z 99999)', g.z === '99999', g.z);
  T('G4  Preferences "Learn more" window uses the same words — no values, no rarity', /Help the catalog grow/.test(g.modal) && !/rarity|market value|unlock/i.test(g.modal), g.modal.slice(0, 300));
  T('G5  Preferences row: "Share anonymously", no values, no rarity', /Share anonymously/.test(g.row) && !/rarity|market value|unlock/i.test(g.row), g.row);

  T('E8  no page errors anywhere in the walk', errs.length === 0, errs);
  await browser.close();

  // ── P. source rules, each with a planted offender ───────────────────────
  console.log('\n== P · source rules + planted offenders ==');
  const ob = strip(rd('onboarding.js')), cfg = rd('onboarding-config.js'), vlt = rd('vault.js');
  const hasSkip = s => /onboardSkipTour|skipTourLabel|Skip tour/.test(s);
  T('P1  onboarding.js has no Skip tour', !hasSkip(ob));
  T('P1x PLANTED: a Skip tour button is caught', hasSkip("'<button onclick=\"onboardSkipTour()\">Skip tour</button>'"));
  const promises = s => /rarity|market values|Market Values/i.test(s);
  const optBlock = cfg.slice(cfg.indexOf('const COMMUNITY_OPTIN'), cfg.indexOf('};', cfg.indexOf('const COMMUNITY_OPTIN')));
  T('P2  the opt-in words promise no values or rarity', !promises(optBlock.replace(/\/\/[^\n]*/g, '')));
  T('P2x PLANTED: a rarity promise is caught', promises("paragraphs: ['real market values and rarity scores']"));
  const ownCopy = s => /Crowd-Sourced Market Values|unlock crowd-sourced/.test(s);
  T('P3  vault.js carries no second copy of the opt-in words', !ownCopy(vlt));
  T('P3x PLANTED: a second copy is caught', ownCopy("'Contribute your collection data anonymously to unlock crowd-sourced market values'"));
  const welcomeBack = s => /function showWelcomeCard\(|showWelcomeCard\(/.test(s);
  T('P4  no code defines or calls the welcome card', !['app-misc.js', 'app.js', 'tutorial.js', 'app-setup.js', 'onboarding.js'].some(fn => welcomeBack(strip(rd(fn)))));
  T('P4x PLANTED: a call to it is caught', welcomeBack('if (typeof showWelcomeCard === "function") showWelcomeCard(false);'));
  const dbHold = strip(rd('dispatch-board.js'));
  T('P5  the Dispatch Board popup waits for the tour, the scanning card and the trial screen', /gt-callout/.test(dbHold) && /rr-ai-usage-card/.test(dbHold) && /sub-screen/.test(dbHold));
  const order = s => s.indexOf('SCREEN_COMMUNITY = 1') >= 0 && s.indexOf('SCREEN_COLLECT = 2') >= 0;
  T('P6  community is screen 1, collect screen 2', order(ob));
  T('P6x PLANTED: the old order is caught', !order('var SCREEN_COLLECT = 1, SCREEN_COMMUNITY = 2;'));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
