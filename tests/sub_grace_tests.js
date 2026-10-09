// ════════════════════════════════════════════════════════════════════════
// sub_grace_tests.js — v0.9.1904 (security review #4, Brad "yes" 2026-10-08)
//
// THE GRACE PERIOD. Before: no answer from the backend = the app ran free,
// forever (blocking one web address was enough). Now each account's LAST
// answer is kept on the device (by account fingerprint, never the email) and:
//   - inside RR_SUB_GRACE_DAYS the last answer stands (paying carry on, a
//     blocked account stays blocked);
//   - past it, the 'nocheck' screen ("couldn't check your subscription") —
//     never the "ended" lock screen, which would lie to a paying member;
//   - never answered on this device → the clock starts at the first miss;
//   - before launch (last answer: enforcement off), owners → unchanged.
// These run the REAL subCheck / _subApply / grace functions from vault.js and
// the REAL rrAccountFingerprint from app.js; section F runs the v0.9.1903
// vault.js and requires the 8-day outage to come out wrong (red).
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const APPDIR = path.join(__dirname, '..', 'app');
const VAULT = fs.readFileSync(path.join(APPDIR, 'vault.js'), 'utf8');
const APP = fs.readFileSync(path.join(APPDIR, 'app.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(APPDIR, 'config.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
function store() {
  const o = {};
  return { o, getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } };
}
const DAY = 864e5;
const T0 = Date.UTC(2026, 9, 20, 15, 0, 0);

// one device: the real functions in a sandbox; answers scripted per call
function device(src, opts) {
  opts = opts || {};
  const ls = store();
  const screens = [];
  const sb = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Object, String, Number, Array, Math, isFinite, encodeURIComponent,
    localStorage: ls, sessionStorage: store(),
    now: T0,
    answer: null,                                // what the backend says next (null = no answer)
    owner: false,
    state: { user: { email: opts.email || 'collector@example.com', name: 'C' }, personalSheetId: 'S1' },
    document: { getElementById: () => null },
    CustomEvent: function () {},
    showToast() {},
    setTimeout() {},
    RR_SUB_GRACE_DAYS: (opts.grace === undefined ? 7 : opts.grace),
  };
  sb.window = sb;
  sb.dispatchEvent = () => {};
  sb.Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(sb.now); } static now() { return sb.now; } };
  sb.rrIsRealOwner = () => sb.owner;
  sb.rrRecordingMode = () => false;
  sb.vaultPost = async () => sb.answer;
  sb._subScreen = (kind) => { screens.push(kind); sb.lastScreen = kind; };
  sb._subScreenClose = () => { sb.lastScreen = null; };
  sb._subTrialBar = () => {};
  sb._subTrialBarClosed = () => true;
  sb.rrFeaturesRemember = () => {};
  vm.createContext(sb);
  let code = grab(APP, 'function rrAccountFingerprint(email)') + '\n';
  code += 'var SUB_CHECKOUT_KEY = "rr_checkout_done"; var SUB_RETRY_MAX = 6, SUB_RETRY_MS = 4000; var _subRetries = 0;\n';
  code += 'function _subCheckoutPending() { return false; }\n';
  const a = src.indexOf('var SUB_OPEN_KEY'), b = src.indexOf('function rrSubGateStart');
  code += src.slice(a, b) + '\n';
  code += grab(src, 'function rrSubBlocks(r)') + '\n';
  code += grab(src, 'function _subApply(r)') + '\n';
  code += grab(src, 'async function subCheck()') + '\n';
  code += 'this.subCheck = subCheck;';
  vm.runInContext(code, sb);
  sb.screens = screens; sb.ls = ls;
  sb.check = async function (answer, atDay) { sb.answer = answer; sb.now = T0 + atDay * DAY; sb.lastScreen = null; await sb.subCheck(); return sb.lastScreen; };
  return sb;
}
const OK = (sub, extra) => Object.assign({ status: 200, sub, enforce: true, payLink: 'https://buy.stripe.com/x', renewLink: 'https://buy.stripe.com/y' }, extra || {});

(async function main() {
  section('A. the grace period itself');
  {
    const d = device(VAULT);
    ok('the grace length is ONE setting in config.js (7 days)', /const RR_SUB_GRACE_DAYS = 7;/.test(CONFIG));
    ok('a good answer (beta) shows nothing', (await d.check(OK('beta'), 0)) === null);
    const raw = d.ls.getItem('rr_sub_last_v1') || '';
    ok('the answer is remembered on the device', /"sub":"beta"/.test(raw), raw);
    ok('…under the account fingerprint, never the email', raw.indexOf('collector@example.com') < 0 && raw.indexOf('collector') < 0, raw);
    ok('backend silent on day 3 → still open (the last answer stands)', (await d.check(null, 3)) === null && d._readOnlyMode !== true);
    ok('…and the app knows it is going by a remembered answer', d._subState && d._subState.stale === true && d._subState.sub === 'beta', d._subState);
    ok('backend silent on day 8 → the no-check screen', (await d.check(null, 8)) === 'nocheck', d.screens);
    ok('…the app is read-only behind it', d._readOnlyMode === true);
    ok('…it is NEVER the "ended" lock screen', d.screens.indexOf('lock') < 0, d.screens);
    ok('the backend answers again on day 9 → the screen goes, the app opens', (await d.check(OK('beta'), 9)) === null && d._readOnlyMode === false);
    ok('…and the clock restarts: silent on day 15 → still open', (await d.check(null, 15)) === null);
    ok('…silent on day 17 → the no-check screen again', (await d.check(null, 17)) === 'nocheck');
  }
  {
    const d = device(VAULT);
    await d.check(OK('expired'), 0);
    ok('a lapsed account, backend silent on day 2 → stays locked (the last answer stands)', (await d.check(null, 2)) === 'lock', d.screens);
    const d2 = device(VAULT);
    await d2.check(OK('trial', { daysLeft: 15 }), 0);
    ok('a trial account, backend silent on day 5 → carries on', (await d2.check(null, 5)) === null && d2._readOnlyMode !== true);
  }

  section('B. never answered on this device');
  {
    const d = device(VAULT);
    ok('first look, no answer → open (the clock starts now)', (await d.check(null, 0)) === null);
    ok('…still no answer on day 6 → open', (await d.check(null, 6)) === null);
    ok('…still no answer on day 8 → the no-check screen', (await d.check(null, 8)) === 'nocheck');
  }

  section('C. unchanged: before launch, owners, a second account');
  {
    const d = device(VAULT);
    await d.check(OK('beta', { enforce: false }), 0);
    ok('before launch (enforcement off), silent for 30 days → nothing changes', (await d.check(null, 30)) === null && d._readOnlyMode !== true);
    const o = device(VAULT);
    o.owner = true;
    await o.check(null, 0);
    ok('an owner, silent for 30 days → nothing', (await o.check(null, 30)) === null);
    // a second account on the same device does not inherit the first's record
    const d3 = device(VAULT);
    await d3.check(OK('active'), 0);
    d3.state.user.email = 'someone.else@example.com';
    ok('a second account, first look with no answer → open, its own clock', (await d3.check(null, 20)) === null);
    const m = JSON.parse(d3.ls.getItem('rr_sub_last_v1'));
    ok('…two separate records on the device, the new one has no answer of its own', Object.keys(m).length === 2 && Object.values(m).filter(x => x.r && x.r.sub === 'active').length === 1 && Object.values(m).filter(x => !x.r && x.miss).length === 1, m);
    ok('…its own clock runs out on day 28', (await d3.check(null, 28)) === 'nocheck');
    d3.state.user.email = 'collector@example.com';
    ok('switching back: the first account, last answered day 0, silent on day 28 → no-check (its clock is its own)', (await d3.check(null, 28)) === 'nocheck');
  }

  section('D. the setting is honoured');
  {
    const d = device(VAULT, { grace: 2 });
    await d.check(OK('beta'), 0);
    ok('grace 2 days: silent on day 1 → open', (await d.check(null, 1)) === null);
    ok('grace 2 days: silent on day 3 → no-check', (await d.check(null, 3)) === 'nocheck');
  }

  section('E. the screen words');
  {
    const i = VAULT.indexOf("kind === 'nocheck'");
    const body = VAULT.slice(i, VAULT.indexOf("} else if (kind === 'opening')", i));
    ok('the no-check screen says "couldn\'t check", offers Check again, the sheet + photos', /couldn.{1,8}t check your subscription/.test(body) && /Check again/.test(body) && /yours/.test(body), body.slice(0, 200));
    ok('the no-check screen never says "ended"', !/ended/i.test(body));
    ok('"Your collection is still yours" has ONE copy (lock + no-check share it)', (VAULT.match(/Your collection is still yours<\/div>/g) || []).length === 1);
  }

  section('F. the guard can fail (v0.9.1903 vault.js)');
  let old = null;
  try { old = execSync('git show feb569c:app/vault.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) {}
  if (old) {
    const d = device(old);
    await d.check(OK('beta'), 0);
    const s8 = await d.check(null, 8);
    ok('v0.9.1903: silent for 8 days → NO screen (the gap this release closes)', s8 === null && d._readOnlyMode !== true, s8);
  } else {
    ok('old vault.js available from git (feb569c) — skipped in a shallow clone', true);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (sub_grace_tests)');
  process.exit(fail ? 1 : 0);
})();
