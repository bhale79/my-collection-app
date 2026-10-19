#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RECORDING MODE — MY SUBSCRIPTION SHOWS A PAYING MEMBER — v0.9.1991
//                                                         (real Chromium)
//
// [stated] Brad, 2026-10-19, Preferences → My Subscription while recording:
// "for recording mode, under my subscription, we should show what a regular
// user would see here if they signed up today." Then: "don't mention the trial
// date, just when it would end for someone that lets say signed up 3 months
// ago." Brad: "yes".
//
// So with recording mode on, the line reads "Renews <date> — $75/year plus
// tax." where <date> is one year after a sign-up RR_RECORDING_MEMBER_MONTHS
// (config.js, ONE value) ago. No "Beta", no "trial".
//
//   R1  Brad's account (owner + beta tester), recording on → the Preferences
//       row reads "Renews <today + 9 months> — $75/year plus tax."
//   R2  …even before the backend has answered (no _subState yet)
//   R3  the Manage button shows when there is a manage link; none without one
//   D*  the date: signed up 3 months ago, renews a year later; a 31st the
//       target month lacks falls back to its last day; year rollover
//   O*  recording OFF → his real Beta tester line; a real trial unchanged
//   S*  the months and the price live in config.js only, never typed in prefs.js
//   X*  PLANTED: the recording branch removed → the Beta line shows (caught);
//       a too-simple date (setMonth overflow) → the 31st case (caught)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  recording_sub_line_1991_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PREFS = read('prefs.js'), CONFIG = read('config.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// the test's own arithmetic, written separately from the app's
function expectRenews(now, back) {
  const total = now.getFullYear() * 12 + now.getMonth() + 12 - back;
  const y = Math.floor(total / 12), m = total % 12;
  const d = Math.min(now.getDate(), new Date(y, m + 1, 0).getDate());
  return { iso: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), words: MONTHS[m] + ' ' + d + ', ' + y };
}

async function boot(browser, recording, sub, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.addInitScript(rec => { try { localStorage.setItem('rr_recording_mode', rec ? '1' : '0'); } catch (e) {} }, recording);
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async sub => {
    state.user = { email: 'support@therailroster.com', name: 'The Rail Roster' };
    window._subState = sub;
    state.masterData = []; try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {};
    const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    const ap = document.getElementById('app'); if (ap) ap.classList.add('active');
    showPage('prefs'); await new Promise(z => setTimeout(z, 600));
    window.dispatchEvent(new Event('rr:substate')); await new Promise(z => setTimeout(z, 100));
    const row = document.getElementById('pref-sub-row');
    const a = row && row.querySelector('a.pref-btn');
    return {
      shown: !!row && row.style.display !== 'none' && row.offsetParent !== null,
      text: row ? row.textContent.replace(/\s+/g, ' ').trim() : '',
      manage: a ? a.getAttribute('href') : '',
      months: typeof RR_RECORDING_MEMBER_MONTHS !== 'undefined' ? RR_RECORDING_MEMBER_MONTHS : null,
      price: typeof RR_PRICE_TEXT !== 'undefined' ? RR_PRICE_TEXT : null,
      dates: typeof rrRecordingRenewsIso === 'function' ? [
        rrRecordingRenewsIso(new Date(2026, 9, 19)),   // Oct 19 2026 → Jul 19 2027
        rrRecordingRenewsIso(new Date(2026, 4, 31)),   // May 31 2026 → Feb 28 2027 (no Feb 31)
        rrRecordingRenewsIso(new Date(2027, 10, 30)),  // Nov 30 2027 → Aug 30 2028
        rrRecordingRenewsIso(new Date(2027, 2, 31)),   // Mar 31 2027 → Dec 31 2027 (same year)
        rrRecordingRenewsIso(new Date(2027, 4, 31)),   // May 31 2027 → Feb 29 2028 (leap year)
      ] : null,
    };
  }, sub);
  await pg.close();
  return Object.assign(out, { errs });
}

const BETA = { sub: 'beta', freeUntil: '2027-01-01', features: [], portalLink: 'https://billing.stripe.com/p/login/test123' };
const BETA_NOLINK = { sub: 'beta', freeUntil: '2027-01-01', features: [] };
const TRIAL = { sub: 'trial', trialEnds: '2026-11-09', portalLink: 'https://billing.stripe.com/p/login/test123' };

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const exp = expectRenews(new Date(), 3);

  console.log('== R · recording mode shows a paying member ==');
  let r = await boot(browser, true, BETA);
  const want = 'Renews ' + exp.words + ' — $75/year plus tax.';
  T('R1 Brad (owner + beta), recording on → "' + want + '"', r.shown && r.text.indexOf(want) >= 0, r.text);
  T('R1 …no "Beta" and no "trial" anywhere on the line', !/beta|trial/i.test(r.text), r.text);
  T('R3 a manage link → the Manage button shows, with his email filled in', /^https:\/\/billing\.stripe\.com\/p\/login\/test123\?prefilled_email=support%40therailroster\.com$/.test(r.manage), r.manage);
  T('page errors', r.errs.length === 0, r.errs);
  const dates = r.dates, months = r.months, price = r.price;
  r = await boot(browser, true, null);
  T('R2 before the backend answers (no answer yet) → the member line still shows', r.shown && r.text.indexOf(want) >= 0, r);
  T('R3 no manage link → no Manage button (nothing that goes nowhere)', !r.manage, r.manage);
  r = await boot(browser, true, BETA_NOLINK);
  T('R3 beta answer without a link → member line, no button', r.text.indexOf(want) >= 0 && !r.manage, r);

  console.log('== D · the date ==');
  T('D1 the months setting is Brad\'s 3', months === 3, months);
  T('D2 Oct 19 2026 → Jul 19 2027 (signed up Jul 19 2026, a year later)', dates && dates[0] === '2027-07-19', dates);
  T('D3 May 31 2026 → Feb 28 2027 (no Feb 31)', dates && dates[1] === '2027-02-28', dates);
  T('D4 Nov 30 2027 → Aug 30 2028 (year rolls over)', dates && dates[2] === '2028-08-30', dates);
  T('D5 Mar 31 2027 → Dec 31 2027', dates && dates[3] === '2027-12-31', dates);
  T('D6 May 31 2027 → Feb 29 2028 (leap year)', dates && dates[4] === '2028-02-29', dates);
  T('D7 the price on the line is RR_PRICE_TEXT', price === '$75/year plus tax' && want.indexOf(price) >= 0, price);

  console.log('== O · recording off: the real line ==');
  r = await boot(browser, false, BETA);
  T('O1 recording off → his real "Beta tester — free until January 1, 2027"', /Beta tester — free until January 1, 2027/.test(r.text) && !/Renews/.test(r.text), r.text);
  T('O1 …and no Manage button for a beta tester', !r.manage, r.manage);
  r = await boot(browser, false, TRIAL);
  T('O2 a real trial member → "Free trial — ends November 9, 2026. Then $75/year plus tax."', r.text.indexOf('Free trial — ends November 9, 2026. Then $75/year plus tax.') >= 0, r.text);
  r = await boot(browser, false, null);
  T('O3 recording off, no answer yet → the row stays hidden, as before', !r.shown, r);

  console.log('== S · one place ==');
  const cfgDefs = (CONFIG.match(/const RR_RECORDING_MEMBER_MONTHS\s*=/g) || []).length;
  T('S1 RR_RECORDING_MEMBER_MONTHS is defined once, in config.js', cfgDefs === 1, cfgDefs);
  const subFn = PREFS.slice(PREFS.indexOf('function _prefsSubRowHtml()'), PREFS.indexOf('window._prefsSubRowHtml = _prefsSubRowHtml'));
  const s2ok = src => src.length > 200 && !/\$75|\b(3|9)\s*\*|setMonth|getMonth|864e5/.test(src);
  T('S2 prefs.js types no months, no price and no date arithmetic in the subscription line', s2ok(subFn), subFn.length);

  console.log('== X · planted ==');
  const NOREC = planted(PREFS, "    if (rec) s = { sub: 'active'", "    if (false) s = { sub: 'active'", 'recording branch');
  r = await boot(browser, true, BETA, { 'prefs.js': NOREC });
  T('X-R1 PLANTED: the recording branch removed → Brad\'s Beta line shows while recording (caught)', /Beta tester/.test(r.text) && r.text.indexOf(want) < 0, r.text);
  const NAIVE = planted(CONFIG, '  var last = new Date(y, m + 1, 0).getDate();\n  if (d > last) d = last;\n', '  var _n = new Date(y, m, d); y = _n.getFullYear(); m = _n.getMonth(); d = _n.getDate();\n', 'day clamp');
  r = await boot(browser, true, BETA, { 'config.js': NAIVE });
  T('X-D3 PLANTED: no day fallback → May 31 runs into March (caught)', r.dates && r.dates[1] !== '2027-02-28', r.dates);
  // the planted S2 offender: a typed price inside the line
  const TYPED = subFn.replace("var price = (typeof RR_PRICE_TEXT !== 'undefined') ? RR_PRICE_TEXT : '';", "var price = '$75/year plus tax';");
  T('X-S2 PLANTED: the price typed into prefs.js → the S2 check fails on it (caught)', TYPED !== subFn && !s2ok(TYPED), TYPED === subFn);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
