// ═══════════════════════════════════════════════════════════════
// dispatch_seen_tests.js — v0.9.1815 (release readiness S1).
//
// Brad: "it should never come up fresh again." The Dispatch Board's "seen"
// list lived in one browser, so the phone — or any fresh sign-in — popped
// every announcement up again. Now:
//   • a read is the UNION of this device's list and the account's list
//     (lv_dispatch_seen_acct, written through _prefSet so the v1779 settings
//     sync carries it) — no device forgets what it showed, a merge can
//     never un-read;
//   • the board waits for the first settings pull (window._rrPrefsSyncDone,
//     set by rrPrefsSync in drive.js on every exit) before deciding on the
//     popup, capped at DISPATCH_CFG.syncWaitTries polls.
//
// The three real functions are lifted out of dispatch-board.js and run
// against a fake localStorage and a _prefSet spy — two "devices" are two
// stores. Section E plants each old habit back and the matching check
// must go red.
// Run:  node tests/dispatch_seen_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const DB = APP('dispatch-board.js'), DRIVE = APP('drive.js'), APPJS = APP('app.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// Lift the real functions: DISPATCH_CFG (the object literal) + the three
// functions, built in their own scope with a fake store and a _prefSet spy.
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function cfgOf(src) {
  const i = src.indexOf('var DISPATCH_CFG = {');
  const j = src.indexOf('};', i);
  return src.slice(i, j + 2);
}
function device(src, store) {
  const prefSets = [];
  const ls = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const body = cfgOf(src) + '\n' + grab(src, '_dbListAt') + '\n' + grab(src, '_dbSeen') + '\n' + grab(src, '_dbMarkSeen')
    + '\nreturn { seen: _dbSeen, mark: _dbMarkSeen, cfg: DISPATCH_CFG };';
  const api = new Function('localStorage', '_prefSet', body)(ls, (k, v) => { prefSets.push([k, v]); store[k] = String(v); });
  return { api, store, prefSets };
}
const SEEN = 'lv_dispatch_seen', ACCT = 'lv_dispatch_seen_acct';

function run(src) {
  const r = {};
  // A — device A reads A001: its own list AND the account list are written
  const A = device(src, {});
  A.api.mark(['A001']);
  r.a_local = JSON.parse(A.store[SEEN] || '[]');
  r.a_acct = JSON.parse(A.store[ACCT] || '[]');
  r.a_viaPrefSet = A.prefSets.some(([k]) => k === ACCT);
  // B — a fresh device: nothing local, the account list has arrived via sync
  const B = device(src, { [ACCT]: JSON.stringify(['A001', 'A002']) });
  r.b_seen = B.api.seen();
  B.api.mark(['R900']);
  r.b_acct_after = JSON.parse(B.store[ACCT] || '[]');
  // C — a device with its own older marks meets a different account list: union, nothing lost
  const C = device(src, { [SEEN]: JSON.stringify(['X1']), [ACCT]: JSON.stringify(['A001']) });
  r.c_seen = C.api.seen();
  return r;
}
const has = (arr, x) => Array.isArray(arr) && arr.indexOf(x) >= 0;

section('A · a device that shows an announcement writes it to the account too');
const R = run(DB);
ok('A1  this device\'s own list has it', has(R.a_local, 'A001'), JSON.stringify(R.a_local));
ok('A2  the account list has it', has(R.a_acct, 'A001'), JSON.stringify(R.a_acct));
ok('A3  …written through _prefSet (the settings sync), not a raw write', R.a_viaPrefSet);
ok('A4  _prefSet really exists in app.js — the typeof guard is not hiding a dead call', /^function _prefSet\(key, val\)/m.test(APPJS));

section('B · a fresh device reads the account list — nothing pops up again');
ok('B1  seen = the account\'s two ids, with nothing local', has(R.b_seen, 'A001') && has(R.b_seen, 'A002'), JSON.stringify(R.b_seen));
ok('B2  marking a third keeps the first two (union, never a replace)', ['A001', 'A002', 'R900'].every(x => has(R.b_acct_after, x)), JSON.stringify(R.b_acct_after));

section('C · a device\'s own marks are never lost to the account\'s');
ok('C1  seen = local ∪ account', has(R.c_seen, 'X1') && has(R.c_seen, 'A001'), JSON.stringify(R.c_seen));

section('D · the popup waits for the first settings pull');
const boot = code(DB).slice(code(DB).indexOf('function _dbBoot()'));
ok('D1  the boot gate reads window._rrPrefsSyncDone', /_rrPrefsSyncDone === true/.test(boot));
ok('D2  …with a cap, so a failed pull delays the board rather than silencing it', /tries > DISPATCH_CFG\.syncWaitTries/.test(boot));
const sync = code(DRIVE).slice(code(DRIVE).indexOf('window.rrPrefsSync = async function'));
const syncFn = sync.slice(0, sync.indexOf('\n};') + 3);
ok('D3  drive.js sets the flag in a finally — every exit, success or failure', /finally\s*\{[\s\S]*?_rrPrefsSyncDone = true/.test(syncFn));

section('E · planted offenders — each must turn a check red');
const o1 = DB.replace("  _dbListAt(DISPATCH_CFG.seenSyncKey).forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });\n", '');
ok('offender 1 changed the source', o1 !== DB);
const R1 = run(o1);
ok('OFFENDER 1: reading only the local list -> B1 and C1 red', !has(R1.b_seen, 'A001') && !has(R1.c_seen, 'A001'));
const o2 = DB.replace("    if (typeof _prefSet === 'function') _prefSet(DISPATCH_CFG.seenSyncKey, json);\n", '');
ok('offender 2 changed the source', o2 !== DB);
ok('OFFENDER 2: no account write -> A2/A3 red', !run(o2).a_viaPrefSet);
const o3 = DB.replace("    var seen = _dbSeen();\n    ids.forEach", "    var seen = [];\n    ids.forEach");
ok('offender 3 changed the source', o3 !== DB);
ok('OFFENDER 3: marking replaces instead of unions -> B2 red', !has(run(o3).b_acct_after, 'A001'));
const o4 = DB.replace("    if (dataReady && prefsSettled) {", "    if (dataReady) {");
ok('offender 4 changed the source', o4 !== DB);
ok('OFFENDER 4: the popup no longer waits -> D1 style check red', !/if \(dataReady && prefsSettled\)/.test(code(o4)));
const o5 = DRIVE.replace("    window._rrPrefsSyncDone = true;\n", '');
ok('offender 5 changed the source', o5 !== DRIVE);
ok('OFFENDER 5: drive.js never sets the flag -> D3 red', !/finally\s*\{[\s\S]*?_rrPrefsSyncDone = true/.test(code(o5).slice(code(o5).indexOf('window.rrPrefsSync = async function'))));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
