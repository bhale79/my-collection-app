#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// NEW ACCOUNT GATE — v0.9.1900   (real Chromium, the REAL app)
//
// Brad's phone test, 2026-10-08, signing in with a never-subscribed account:
//   "the first thing it does after i enter my google account is it flashes the
//    dispatch board. then it show the welcome to the rail roster page, after a
//    bit, it flashes a red warning that my trial ended"
//
// Three faults behind that, each proven here against the real code:
//   A. the read-only lock (no subscription) also blocked the APP's own set-up
//      writes — a new sheet's headers, its formatting stamp and Dashboard tab,
//      the Master Key label — so the sheet was left unfinished and every
//      blocked write popped a toast. Set-up writes now go through
//      sheetsSetupUpdate, which the lock lets through; a member's own writes
//      are still refused.
//   B. that toast said "Your trial has ended" to someone who never had one.
//      The words now come from ONE place (RR_READONLY_TEXT) by account state,
//      and nothing is said while the welcome / lock screen is up.
//   C. the app (and the Dispatch Board) drew in the second or two before the
//      subscription answer arrived. An account this device cannot vouch for
//      now sees just the logo (v0.9.1903 — it said "Opening your collection…",
//      but a new member has none: Brad, "we should just show the logo then
//      switch to the welcome page") until the answer lands — fail-open,
//      never longer than SUB_COVER_MAX_MS — and the Dispatch Board waits for
//      the screen and for first-run setup.
// Section P plants an offender for every source rule.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  new_account_gate_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 400))); cond ? pass++ : fail++; }

// ── source rules (each also run against a planted offender in P) ──────────
const SETUP_FILES = ['app-setup.js', 'sheet-builder.js'];
function plainUpdatesIn(src) {                 // set-up code must use sheetsSetupUpdate
  return (strip(src).match(/(?<![\w.])sheetsUpdate\(/g) || []).length;
}
function trialEndedWords(src) {                // the old wording, anywhere in live code
  return /trial has ended/i.test(strip(src));
}
function openingWords(src) {                  // v0.9.1903: the cover is the logo only
  return /Opening your collection/i.test(strip(src));
}
function loadStartsGate(src) {                 // loadAllData starts the gate, no 600 ms delay
  const m = strip(src).match(/async function loadAllData\(\)\s*\{([\s\S]*?)\n\s*try \{\s*\n\s*loadUserDefinedTabs/);
  if (!m) return false;
  return /rrSubGateStart\(\)/.test(m[1]) && !/setTimeout\([\s\S]*subCheck[\s\S]*600\)/.test(m[1]);
}

(async () => {
  // ── source checks ────────────────────────────────────────────────────────
  console.log('\n== S · source rules ==');
  SETUP_FILES.forEach(f => T('S1  ' + f + ': every sheet write is a set-up write (sheetsSetupUpdate)', plainUpdatesIn(rd(f)) === 0, plainUpdatesIn(rd(f))));
  const appJs = fs.readdirSync(APP).filter(f => f.endsWith('.js'));
  const saysTrialEnded = appJs.filter(f => trialEndedWords(rd(f)));
  T('S2  no live code says "trial has ended"', saysTrialEnded.length === 0, saysTrialEnded);
  T('S3  loadAllData starts the subscription gate at once (no 600 ms wait)', loadStartsGate(rd('app-data.js')));
  T('S4  the Master Key label is a set-up write', /sheetsSetupUpdate\(state\.personalSheetId, PERSONAL_TAB \+ '!' \+ personalColLetter\('masterKey'\)/.test(rd('app-data.js')));
  T('S5  the remembered-open list is kept at sign-out', /'rr_sub_open_v1'/.test(rd('config.js').split('const SIGNOUT_KEEP_KEYS')[1] || ''));
  T('S6  the wording lives in ONE place (config.js RR_READONLY_TEXT)', /const RR_READONLY_TEXT\s*=\s*\{/.test(rd('config.js')));
  const saysOpening = appJs.filter(f => openingWords(rd(f)));
  T('S7  no live code says "Opening your collection" (a new member has none)', saysOpening.length === 0, saysOpening);

  // ── P · planted offenders: every rule above can fail ─────────────────────
  console.log('\n== P · planted offenders ==');
  T('P1  a plain sheetsUpdate in set-up code is caught', plainUpdatesIn(rd('app-setup.js') + "\nawait sheetsUpdate(sheetId, 'Sold!A1', [['x']]);") === 1);
  T('P1b  …but a comment mentioning it is not', plainUpdatesIn("// sheetsUpdate(x)\nsheetsSetupUpdate(a)") === 0);
  T('P2  the old "trial has ended" toast is caught', trialEndedWords("showToast('Your trial has ended — subscribe', 4000, true);"));
  const oldLoad = rd('app-data.js').replace(/try \{\s*\n\s*if \(typeof rrSubGateStart === 'function'\) rrSubGateStart\(\);\s*\n\s*else if \(typeof subCheck === 'function'\) subCheck\(\);\s*\n\s*\} catch \(e\) \{\}/,
    "setTimeout(function () { try { if (typeof subCheck === 'function') subCheck(); } catch (e) {} }, 600);");
  T('P4  the old "Opening your collection" words are caught', openingWords("h = '<h1>Opening your collection…</h1>';"));
  T('P3  the old 600 ms subscription check is caught', oldLoad !== rd('app-data.js') && !loadStartsGate(oldLoad));

  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 412, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);

  // a signed-in brand-new account; Sheets writes and toasts are recorded
  await pg.evaluate(() => {
    window.state = window.state || {};
    state.user = { email: 'new.collector@gmail.com', name: 'New Collector' };
    state.personalSheetId = 'SHEET1';
    accessToken = 'test-token';   // app-auth.js var — the Sheets helpers refuse to write without one
    localStorage.removeItem('rr_sub_open_v1');
    localStorage.removeItem('lv_onboarded');
    window._toasts = [];
    window.showToast = function (m, d, err) { window._toasts.push({ m: String(m), err: !!err }); };
    window._puts = [];
    window.fetch = function (url, opt) {
      url = String(url);
      if (/sheets\.googleapis\.com/.test(url) && opt && opt.method === 'PUT') {
        window._puts.push(decodeURIComponent(url.split('/values/')[1].split('?')[0]));
        return Promise.resolve(new Response('{"updatedCells":1}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.reject(new Error('offline in test'));
    };
    window._answer = null;     // what the stub relay answers
    window._relayDelay = 900;
    window.vaultPost = function (body) {
      if (body && body.action !== 'sub_check') return Promise.resolve({ status: 200 });
      return new Promise(function (res, rej) {
        setTimeout(function () { window._answer === 'fail' ? rej(new Error('relay down')) : (window._answer === 'never' ? 0 : res(window._answer)); }, window._relayDelay);
      });
    };
  });
  const screen = () => pg.evaluate(() => { const s = document.getElementById('sub-screen'); return s ? s.getAttribute('data-kind') : null; });
  const NONE = { status: 200, sub: 'none', enforce: true, payLink: 'https://buy.stripe.com/x' };

  // ── C · the phone sequence: sign in → (no flash) → welcome screen ──────
  console.log('\n== C · a never-subscribed account signs in ==');
  await pg.evaluate(a => { window._answer = a; window._subState = undefined; rrSubGateStart(); }, NONE);
  T('C1  before the answer: the app is covered', (await screen()) === 'opening');
  const cover = await pg.evaluate(() => {
    const s = document.getElementById('sub-screen');
    const img = s.querySelector('img');
    return { text: (s.innerText || '').replace(/\s+/g, ' ').trim(), img: img ? img.getAttribute('src') : null,
             buttons: s.querySelectorAll('button, a').length };
  });
  T('C1b  …by the logo only: the conductor and "The Rail Roster", no other words', cover.img === 'conductor.png' && /^the rail roster$/i.test(cover.text), cover);
  T('C1c  …and nothing to press', cover.buttons === 0, cover);
  // the Dispatch Board tries to pop while the cover is up
  await pg.evaluate(() => {
    window._dbItems = [{ id: 'T1', type: 'News', title: 'Test news', message: 'Hello', date: null, expires: null }];
    try { localStorage.removeItem('lv_dispatch_seen'); } catch (e) {}
    window._dbPopupShown = false;
    _dbMaybePopup();
  });
  T('C2  the Dispatch Board does NOT pop over the cover', !(await pg.evaluate(() => !!document.getElementById('db-popup'))));
  await pg.waitForTimeout(1300);
  T('C3  the answer arrives: the WELCOME screen replaces the cover', (await screen()) === 'welcome');
  T('C3b  …the app behind it is read-only', await pg.evaluate(() => window._readOnlyMode === true));

  // ── A · the app's own set-up writes go through behind the screen ────────
  console.log('\n== A · set-up writes while read-only ==');
  const a = await pg.evaluate(async () => {
    window._toasts = []; window._puts = [];
    let setupOk = false, userErr = '';
    try { await sheetsSetupUpdate('SHEET1', "'My Collection'!A1", [['My Collection']]); setupOk = true; } catch (e) { setupOk = String(e && e.message); }
    try { await sheetsUpdate('SHEET1', "'My Collection'!B5", [['typed by a person']]); } catch (e) { userErr = String(e && e.message); }
    return { setupOk, userErr, puts: window._puts.slice(), toasts: window._toasts.slice() };
  });
  T('A1  a set-up write (sheet titles/headers) goes through', a.setupOk === true && a.puts.length === 1 && /My Collection'!A1/.test(a.puts[0]), a);
  T('A2  a member\'s own edit is still refused while read-only', /readonly/.test(a.userErr), a);
  T('A3  …and NOTHING pops while the welcome screen is up (Brad\'s red warning)', a.toasts.length === 0, a.toasts);
  // the real set-up function a new sheet runs, end to end through the lock
  const a4 = await pg.evaluate(async () => {
    window._toasts = []; window._puts = [];
    const metaFetch = window.fetch;
    window.fetch = function (url, opt) {
      url = String(url);
      if (/spreadsheets\/SHEET1\?fields=sheets/.test(url)) return Promise.resolve(new Response(JSON.stringify({ sheets: [{ properties: { title: 'My Collection' } }] }), { status: 200 }));
      if (/:batchUpdate/.test(url)) return Promise.resolve(new Response('{}', { status: 200 }));
      if (/\/values\/[^?]*\?/.test(url) && !(opt && opt.method)) return Promise.resolve(new Response(JSON.stringify({ values: [] }), { status: 200 }));
      return metaFetch(url, opt);
    };
    let err = '';
    try { await ensurePersonalHeaders('SHEET1'); } catch (e) { err = String(e && e.message); }
    window.fetch = metaFetch;
    return { err, puts: window._puts.slice(), toasts: window._toasts.slice() };
  });
  T('A4  the real header repair (ensurePersonalHeaders) writes the missing tabs\' headers while read-only', a4.puts.some(p => /^Sold!/.test(p)) && a4.puts.some(p => /^For Sale!/.test(p)), a4);
  T('A4b  …with no toast', a4.toasts.length === 0, a4.toasts);

  // ── B · the words, by account state ──────────────────────────────────────
  console.log('\n== B · read-only wording ==');
  const b = await pg.evaluate(async () => {
    const out = {};
    document.getElementById('sub-screen').remove();          // as if a member somehow reached an edit
    window._toasts = [];
    try { await sheetsUpdate('SHEET1', 'A1', [['x']]); } catch (e) {}
    out.none = window._toasts.slice();
    window._subState = { status: 200, sub: 'expired', enforce: true };
    window._toasts = [];
    try { await sheetsAppend('SHEET1', 'A1', [['x']]); } catch (e) {}
    out.expired = window._toasts.slice();
    out.saveErr = (typeof rrSaveError === 'function') ? rrSaveError(new Error('readonly'), 'your item') : null;
    window._subState = { status: 200, sub: 'none', enforce: true };
    out.words = rrReadOnlyWords();
    return out;
  });
  T('B1  never subscribed: "Start your free trial…" (not "trial has ended")', b.none.length === 1 && /Start your free trial/.test(b.none[0].m) && !/ended/i.test(b.none[0].m), b.none);
  T('B2  lapsed: "Your subscription has ended — renew…"', b.expired.length === 1 && /subscription has ended/.test(b.expired[0].m) && /renew/.test(b.expired[0].m), b.expired);
  T('B3  the save-error wording reads the same place', b.saveErr === null || /subscription has ended/.test(b.saveErr), b.saveErr);
  T('B4  rrReadOnlyWords follows the answer', /Start your free trial/.test(b.words), b.words);

  // ── D · remembered per account on this device ────────────────────────────
  console.log('\n== D · an account this device knows is open ==');
  await pg.evaluate(() => { window._answer = { status: 200, sub: 'beta', enforce: true, features: [] }; window._subState = undefined; rrSubGateStart(); });
  T('D1  first sign-in on a device: covered while it asks', (await screen()) === 'opening');
  await pg.waitForTimeout(1300);
  T('D2  beta answer: cover gone, app open', (await screen()) === null && await pg.evaluate(() => window._readOnlyMode === false));
  T('D3  …and this device now remembers the account as open', await pg.evaluate(() => JSON.parse(localStorage.getItem('rr_sub_open_v1') || '[]').indexOf(rrAccountFingerprint('new.collector@gmail.com')) === 0));
  await pg.evaluate(() => { window._subState = undefined; rrSubGateStart(); });
  T('D4  next sign-in: NO cover, no wait for an open account', (await screen()) === null);
  await pg.waitForTimeout(1300);
  await pg.evaluate(a => { window._answer = a; window._subState = undefined; rrSubGateStart(); }, NONE);
  await pg.waitForTimeout(1300);
  T('D5  an answer that blocks takes the account OFF the open list', await pg.evaluate(() => JSON.parse(localStorage.getItem('rr_sub_open_v1') || '[]').indexOf(rrAccountFingerprint('new.collector@gmail.com')) === -1));
  await pg.evaluate(() => {
    _subScreenClose(); window._readOnlyMode = false;
    state.user = { email: 'someone.else@gmail.com', name: 'Other' };
    window._subState = undefined; window._answer = { status: 200, sub: 'active', enforce: true };
    rrSubGateStart();
  });
  T('D6  a DIFFERENT account on the same device is not vouched for by another\'s answer', (await screen()) === 'opening');
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { state.user = { email: 'new.collector@gmail.com', name: 'New Collector' }; });

  // ── E · fail-open ────────────────────────────────────────────────────────
  console.log('\n== E · fail-open: the cover can never strand anyone ==');
  await pg.evaluate(() => { localStorage.removeItem('rr_sub_open_v1'); window._answer = 'fail'; window._relayDelay = 300; window._subState = undefined; rrSubGateStart(); });
  T('E1  relay down: covered at first', (await screen()) === 'opening');
  await pg.waitForTimeout(700);
  T('E2  …and uncovered as soon as the check gives up', (await screen()) === null);
  await pg.evaluate(() => { window._answer = 'never'; window.SUB_COVER_MAX_MS = 600; window._subState = undefined; rrSubGateStart(); });
  T('E3  relay never answers: covered at first', (await screen()) === 'opening');
  await pg.waitForTimeout(1000);
  T('E4  …and uncovered after the time limit', (await screen()) === null);
  await pg.evaluate(() => { window.SUB_COVER_MAX_MS = 8000; window._offlineMode = true; window._subState = undefined; rrSubGateStart(); });
  T('E5  offline: no cover at all', (await screen()) === null);
  await pg.evaluate(() => { window._offlineMode = false; });
  await pg.evaluate(() => { const o = window.rrIsRealOwner; window.rrIsRealOwner = () => true; window._answer = 'never'; window._subState = undefined; rrSubGateStart(); window.rrIsRealOwner = o; });
  T('E6  an owner: no cover', (await screen()) === null);

  // ── G · the Dispatch Board waits for first-run setup ─────────────────────
  console.log('\n== G · Dispatch Board after first-run ==');
  const g = await pg.evaluate(() => {
    _subScreenClose();
    document.querySelectorAll('#db-popup').forEach(e => e.remove());
    localStorage.removeItem('lv_onboarded');
    window._dbPopupShown = false; _dbMaybePopup();
    const held = !document.getElementById('db-popup');
    rrMarkOnboardingSeen();
    window._dbPopupShown = false; _dbMaybePopup();
    const shown = !!document.getElementById('db-popup');
    document.querySelectorAll('#db-popup').forEach(e => e.remove());
    return { held, shown };
  });
  T('G1  setup not finished yet: the Dispatch Board waits', g.held, g);
  T('G2  setup finished: it shows', g.shown, g);

  T('Z  no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
