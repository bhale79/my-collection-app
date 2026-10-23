#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SETUP AND THE SCANNING CARD ARE REMEMBERED PER ACCOUNT — v0.9.2015
//                                                         (real Chromium)
//
// [stated] Brad, 2026-10-23: "everytime i sign off and log back on it treats
// me as i am new and ask me to sign up for community and all the new user pop
// ups reset" → "yes". The finished-setup marker held ONE account per device;
// his Chrome held the support@ demo account, so signing in as himself ran the
// whole setup again — and finishing it pushed support@ out. Now: a LIST of
// accounts per device + the answer in the account's own settings (follows him
// to the phone and the booth laptop); setup waits for those settings.
//
//   S1  the same account signs out and back in → straight to the dashboard
//   S2  Brad → support@ → Brad → support@: nobody is asked twice (THE BUG)
//   S3  the value his devices hold today (one bare fingerprint) still counts
//   S4  an account that finished on another device: a new device waits for its
//       settings, they say "done" → no setup, and this device learns it
//   S5  a brand-new account: settings arrive empty → the full setup
//   S6  settings never arrive (offline) → setup after RR_SETUP_PREFS_WAIT_MS
//   S7  a device that knew, an account that did not → the account is taught
//   S8  a friend on Brad's device still gets setup; the old '1' is nobody;
//       the list never grows past RR_ACCOUNT_LIST_MAX
//   C*  the scanning card: once per account, switching never brings it back
//   X*  PLANTED: the one-slot marker (S2 caught); setup without the wait (S4)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  setup_per_account_2015_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 500))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const BRAD = 'bhale@ipd-llc.com', DEMO = 'support@therailroster.com', FRIEND = 'friend.of.brad@gmail.com';

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.errs = errs;
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => {
    state.masterData = []; try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {}; state.soldData = {}; state.wantData = {};
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    window._pwaIsInstalled = function () { return true; };
    // helpers for the walk: one person signs in / finishes / signs out
    window.__signIn = function (email, prefs) {
      state.user = { email: email, name: 'X' };
      window._subState = { status: 200, sub: 'beta', enforce: false };
      Object.keys(prefs || {}).forEach(k => { localStorage.setItem(k, prefs[k]); localStorage.setItem(k + '__at', String(Date.now())); });
    };
    window.__signOut = function () { const o = document.getElementById('onboarding-map-overlay'); if (o) o.remove(); rrClearAccountStorage(); state.user = null; window._subState = null; };
    window.__setupShows = async function (wait) {
      const o0 = document.getElementById('onboarding-map-overlay'); if (o0) o0.remove();
      showOnboarding(); window.dispatchEvent(new CustomEvent('rr:substate', { detail: window._subState }));
      await new Promise(z => setTimeout(z, wait || 700));
      const on = !!document.getElementById('onboarding-map-overlay');
      const o = document.getElementById('onboarding-map-overlay'); if (o) o.remove();
      return on;
    };
    // what the account's settings file holds, per account (a stand-in for the Drive file)
    window.__accountFiles = {};
    window.__saveAccount = function (email) { const f = {}; ['lv_setup_done', 'lv_scan_card_seen'].forEach(k => { const v = localStorage.getItem(k); if (v !== null) f[k] = v; }); window.__accountFiles[email] = f; };
  });
  return pg;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== S · setup ==');
  let pg = await boot(browser);
  const s1 = await pg.evaluate(async ([BRAD]) => {
    window._rrPrefsSyncDone = true;
    __signIn(BRAD); rrMarkOnboardingSeen(); __saveAccount(BRAD);
    __signOut(); __signIn(BRAD, __accountFiles[BRAD]);
    return { seen: rrOnboardingSeenByCurrentAccount(), shows: await __setupShows() };
  }, [BRAD]);
  T('S1 the same account signs out and back in → no setup', s1.seen && !s1.shows, s1);

  const s2 = await pg.evaluate(async ([BRAD, DEMO]) => {
    window._rrPrefsSyncDone = true;
    __signOut(); __signIn(DEMO); const demoFirst = await __setupShows(); rrMarkOnboardingSeen(); __saveAccount(DEMO);
    const rounds = [];
    for (const who of [BRAD, DEMO, BRAD, DEMO]) { __signOut(); __signIn(who, __accountFiles[who]); rounds.push({ who: who.split('@')[0], shows: await __setupShows() }); }
    // and the same with NO account settings at all (the device list alone answers)
    const bare = [];
    for (const who of [BRAD, DEMO, BRAD]) { __signOut(); __signIn(who); bare.push(await __setupShows()); }
    return { demoFirst, rounds, bare, list: rrAccountListRead('lv_onboarded').length };
  }, [BRAD, DEMO]);
  T('S2 support@ (new to this device) gets setup once', s2.demoFirst === true, s2);
  T('S2 Brad → support@ → Brad → support@: nobody is asked twice (THE BUG)', s2.rounds.every(r => !r.shows), s2.rounds);
  T('S2 …even before either account\'s settings arrive (the device list answers)', s2.bare.every(x => !x), s2.bare);
  T('S2 the device remembers both accounts', s2.list === 2, s2.list);

  const s3 = await pg.evaluate(async ([BRAD]) => {
    window._rrPrefsSyncDone = true;
    __signOut(); localStorage.setItem('lv_onboarded', rrAccountFingerprint(BRAD));   // what his devices hold today
    __signIn(BRAD); return { seen: rrOnboardingSeenByCurrentAccount(), shows: await __setupShows() };
  }, [BRAD]);
  T('S3 the single fingerprint his devices hold today still counts', s3.seen && !s3.shows, s3);
  T('page errors', pg.errs.length === 0, pg.errs);
  await pg.close();

  pg = await boot(browser);
  const s4 = await pg.evaluate(async ([BRAD]) => {
    localStorage.removeItem('lv_onboarded');
    window._rrPrefsSyncDone = false;                 // a new device: the settings are still on their way
    __signIn(BRAD);
    const p = __setupShows(1500);
    setTimeout(() => { localStorage.setItem('lv_setup_done', '1'); localStorage.setItem('lv_setup_done__at', '5'); window._rrPrefsSyncDone = true; }, 400);
    const shows = await p;
    return { shows, learned: rrAccountListHas('lv_onboarded', rrAccountFingerprint(BRAD)) };
  }, [BRAD]);
  T('S4 finished on another device: the new device waits, the settings say done → no setup', !s4.shows, s4);
  T('S4 …and this device now remembers the account itself', s4.learned, s4);

  const s5 = await pg.evaluate(async () => {
    __signOut(); window._rrPrefsSyncDone = false;
    __signIn('brand.new.collector@gmail.com');
    const p = __setupShows(1500);
    setTimeout(() => { window._rrPrefsSyncDone = true; }, 400);   // settings arrive: nothing in them
    return await p;
  });
  T('S5 a brand-new account → the full setup', s5 === true, s5);

  const s6 = await pg.evaluate(async () => {
    __signOut(); window._rrPrefsSyncDone = false;
    __signIn('offline.person@gmail.com');
    const o = document.getElementById('onboarding-map-overlay'); if (o) o.remove();
    showOnboarding(); window.dispatchEvent(new CustomEvent('rr:substate', { detail: window._subState }));
    await new Promise(z => setTimeout(z, 1500)); const early = !!document.getElementById('onboarding-map-overlay');
    await new Promise(z => setTimeout(z, RR_SETUP_PREFS_WAIT_MS)); const late = !!document.getElementById('onboarding-map-overlay');
    const o2 = document.getElementById('onboarding-map-overlay'); if (o2) o2.remove();
    return { early, late, waitMs: RR_SETUP_PREFS_WAIT_MS };
  });
  T('S6 settings never arrive (offline): it waits, then shows setup', !s6.early && s6.late, s6);

  const s7 = await pg.evaluate(async ([BRAD]) => {
    __signOut(); window._rrPrefsSyncDone = true;
    localStorage.setItem('lv_onboarded', JSON.stringify([rrAccountFingerprint(BRAD)]));
    __signIn(BRAD); localStorage.removeItem('lv_setup_done');
    const seen = rrOnboardingSeenByCurrentAccount();
    return { seen, taught: localStorage.getItem('lv_setup_done'), stamped: !!localStorage.getItem('lv_setup_done__at') };
  }, [BRAD]);
  T('S7 the device knew, the account did not → the account is taught (travels to his other devices)', s7.seen && s7.taught === '1' && s7.stamped, s7);

  const s8 = await pg.evaluate(async ([BRAD, FRIEND]) => {
    __signOut(); window._rrPrefsSyncDone = true;
    __signIn(BRAD); rrMarkOnboardingSeen(); __signOut();
    __signIn(FRIEND); const friendShows = await __setupShows();
    __signOut(); localStorage.setItem('lv_onboarded', '1'); __signIn(BRAD); const oldOne = rrOnboardingSeenByCurrentAccount();
    for (let i = 0; i < 30; i++) rrAccountListAdd('lv_onboarded', 'fp' + i);
    return { friendShows, oldOne, len: rrAccountListRead('lv_onboarded').length, max: RR_ACCOUNT_LIST_MAX, newest: rrAccountListRead('lv_onboarded').slice(-1)[0] };
  }, [BRAD, FRIEND]);
  T('S8 a friend on Brad\'s device still gets setup', s8.friendShows === true, s8);
  T('S8 the old device-wide "1" is nobody', s8.oldOne === false, s8);
  T('S8 the list stops at RR_ACCOUNT_LIST_MAX, keeping the newest', s8.len === s8.max && s8.newest === 'fp29', s8);
  T('page errors', pg.errs.length === 0, pg.errs);
  await pg.close();

  console.log('== C · the scanning card ==');
  pg = await boot(browser);
  const c = await pg.evaluate(async ([BRAD, DEMO]) => {
    const card = () => !!document.getElementById('rr-ai-usage-card');
    const clear = () => { const x = document.getElementById('rr-ai-usage-card'); if (x) x.remove(); };
    const tryAdd = async () => { clear(); rrMaybeShowAddHelp(); await new Promise(z => setTimeout(z, 700)); const on = card(); if (on) { _aiUsageMarkSeen(); clear(); } return on; };
    localStorage.removeItem('lv_ai_usage_seen');
    const out = [];
    for (const who of [BRAD, DEMO, BRAD, DEMO]) { __signOut(); __signIn(who, __accountFiles[who]); out.push(await tryAdd()); __saveAccount(who); }
    __signOut(); localStorage.removeItem('lv_ai_usage_seen'); __signIn(BRAD, __accountFiles[BRAD]);
    const newDevice = await tryAdd();
    return { out, newDevice };
  }, [BRAD, DEMO]);
  T('C1 Brad, then support@: each sees the card once', c.out[0] === true && c.out[1] === true, c.out);
  T('C2 switching back and forth never brings it back', c.out[2] === false && c.out[3] === false, c.out);
  T('C3 a new device: the account\'s settings say "seen" → no card', c.newDevice === false, c);
  T('page errors', pg.errs.length === 0, pg.errs);
  await pg.close();

  console.log('== X · planted ==');
  const APPJS = rd('app.js');
  const ONESLOT = planted(APPJS, "    rrAccountListAdd(RR_ONBOARDED_KEY, fp);\n    if (fp && typeof _prefSet === 'function') _prefSet(RR_SETUP_DONE_PREF, '1');",
    "    localStorage.setItem(RR_ONBOARDED_KEY, fp || '1');", 'one slot');
  pg = await boot(browser, { 'app.js': ONESLOT });
  const x1 = await pg.evaluate(async ([BRAD, DEMO]) => {
    window._rrPrefsSyncDone = true;
    const r = [];
    for (const who of [BRAD, DEMO, BRAD]) { __signOut(); __signIn(who); const s = await __setupShows(); r.push(s); rrMarkOnboardingSeen(); }
    return r;
  }, [BRAD, DEMO]);
  T('X-S2 PLANTED: the one-slot marker → Brad is asked again after support@ (caught)', x1[2] === true, x1);
  await pg.close();
  const SETUP = rd('app-setup.js');
  const NOWAIT = planted(SETUP, '      prefsArrived.then(function () {\n        if (!rrOnboardingSeenByCurrentAccount()', '      Promise.resolve().then(function () {\n        if (!rrOnboardingSeenByCurrentAccount()', 'prefs wait');
  pg = await boot(browser, { 'app-setup.js': NOWAIT });
  const x4 = await pg.evaluate(async ([BRAD]) => {
    localStorage.removeItem('lv_onboarded'); window._rrPrefsSyncDone = false; __signIn(BRAD);
    const p = __setupShows(1500);
    setTimeout(() => { localStorage.setItem('lv_setup_done', '1'); window._rrPrefsSyncDone = true; }, 400);
    return await p;
  }, [BRAD]);
  T('X-S4 PLANTED: setup without waiting for the settings → shown on a new device (caught)', x4 === true, x4);
  await pg.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
