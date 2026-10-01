// ═══════════════════════════════════════════════════════════════
// maint_open_by_inventory_tests.js — v0.9.1849.
//
// [stated] Brad, 2026-10-01, Workbench screenshot with "Could not find this
// item." → it was "the southern 2356" → "so i am betting again we are not
// using inventory id again".
//
// WHY: the Workbench row found Brad's copy by its inventoryId (278, stored as
// 2356-P) and the Maintenance card then matched the CATALOG by that number
// spelled exactly — "2356-P". The catalog files it as 2356 (2356C / 2356T
// beside it, and a Williams 2356 on another tab), so nothing matched. Measured
// in Brad's app: 0 catalog rows are "2356-P"; 25 of his items carry a -P / -D;
// findMaster(copy's number, copy's variation, the copy) answers "2356 / 1 /
// Lionel PW - Items".
//
// THE RULES THIS SUITE PROTECTS:
//   1. When the card knows the owned copy (inventoryId), the catalog row comes
//      from findMaster — the ONE resolver — asked with the copy as the hint.
//   2. The copy is found by its inventoryId ALONE (never "and the number").
//   3. The 2356-P copy opens the Lionel Postwar 2356 variation 1 — not 2356C,
//      not 2356T, not Williams' 2356.
//   4. A card opened without an owned copy (the catalog page) still works.
// The REAL _maintResolveItem (maintenance.js) runs against the REAL findMaster
// and its helpers (app-data.js, app.js). Offenders include the v1848 code.
// Run:  node tests/maint_open_by_inventory_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const maint = APP('maintenance.js'), dat = APP('app-data.js'), appjs = APP('app.js');

// ── the catalog rows, as the live master files them (2026-10-01) ──────────
const PW = (num, extra) => Object.assign({ itemNum: num, variation: '1', _era: 'pw', _tab: 'Lionel PW - Items', roadName: 'Southern', description: 'F3 Diesel', itemType: 'Diesel Locomotive' }, extra || {});
const ROWS = [
  Object.assign(PW('2356'), {}), PW('2356C'), PW('2356T'),
  { itemNum: '2356', variation: '1', _era: 'williams_o', _tab: 'Williams O', roadName: 'Southern Railway (SOU)', description: 'O Gauge Southern AA Diesel Locomotives #2356/2356', itemType: 'Diesel Locomotive' },
  PW('2338', { variation: '2', roadName: 'Milwaukee Road', description: 'GP7 Diesel' }),
  // Atlas' 8359 FIRST, so a number-only first-find would land on it
  { itemNum: '8359', variation: '', _era: 'atlas_o', _tab: 'Atlas O', roadName: 'Western Maryland', itemType: 'Hopper' },
  { itemNum: '8359', variation: '', _era: 'mpc', _tab: 'Lionel MPC-Modern', roadName: 'Chessie System', itemType: 'Diesel Locomotive' },
];
// Brad's copies (state.personalData), keyed as the app keys them
const OWNED = {
  '278': { itemNum: '2356-P', variation: '1', inventoryId: '278', era: 'pw', manufacturer: 'Lionel', roadName: 'Southern' },
  '279': { itemNum: '2356C', variation: '1', inventoryId: '279', era: 'pw', manufacturer: 'Lionel' },
  '280': { itemNum: '2356T-D', variation: '1', inventoryId: '280', era: 'pw', manufacturer: 'Lionel' },
  '97':  { itemNum: '8359', variation: '', inventoryId: '97', era: 'mpc', manufacturer: 'Lionel' },
};

function world(maintSrc) {
  const byItem = new Map();
  ROWS.forEach(r => { const k = r.itemNum; if (!byItem.has(k)) byItem.set(k, []); byItem.get(k).push(r); });
  const state = { masterData: ROWS, masterByItem: byItem, masterByItemAll: byItem, personalData: OWNED };
  const ERA_TABS = { pw: { items: 'Lionel PW - Items' }, mpc: { items: 'Lionel MPC-Modern' }, atlas_o: { items: 'Atlas O' }, williams_o: { items: 'Williams O' } };
  const calls = [];
  const code = [
    grab(appjs, 'normalizeItemNum'), grab(appjs, 'baseItemNum'), grab(dat, '_mIsMotive'), grab(dat, '_mSuffix'), grab(dat, 'rrMasterByKey'),
    grab(dat, '_preferEraOf'), grab(dat, '_letterKinRows'), grab(dat, '_findMasterCore'), grab(dat, 'findMaster'),
    'var _lkCache = new WeakMap();',
    'var _realFindMaster = findMaster; findMaster = function (n, v, h) { calls.push([n, v, h]); return _realFindMaster(n, v, h); };',
    grab(maintSrc, '_maintResolveItem'),
    'return { resolve: _maintResolveItem, findMaster: _realFindMaster };',
  ].join('\n');
  const window = { state };
  const w = new Function('state', 'ERA_TABS', 'window', 'calls', 'console', code)(state, ERA_TABS, window, calls, { log() {}, warn() {} });
  w.calls = calls;
  return w;
}
const W = world(maint);
const tag = m => m ? [m.itemNum, m.variation, m._tab].join(' / ') : 'NOTHING';

section('A · the Workbench row for Brad\'s 2356 (inventoryId 278, stored as 2356-P)');
ok('the real findMaster answers the copy (the live measurement, reproduced)', tag(W.findMaster('2356-P', '1', OWNED['278'])) === '2356 / 1 / Lionel PW - Items', tag(W.findMaster('2356-P', '1', OWNED['278'])));
W.calls.length = 0;
let got = W.resolve(-1, '2356-P', '1', '278');
ok('opens the Lionel Postwar 2356, variation 1', tag(got) === '2356 / 1 / Lionel PW - Items', tag(got));
ok('…asked through findMaster with the COPY as the hint', W.calls.length === 1 && W.calls[0][2] === OWNED['278'] && W.calls[0][0] === '2356-P');
got = W.resolve(-1, '2356', '1', '278');
ok('the copy decides even when the caller passes a different spelling of the number', tag(got) === '2356 / 1 / Lionel PW - Items' && W.calls[W.calls.length - 1][0] === '2356-P');
got = W.resolve(-1, '2356C', '1', '279');
ok('the B unit (279) opens 2356C', tag(got) === '2356C / 1 / Lionel PW - Items', tag(got));
got = W.resolve(-1, '2356T-D', '1', '280');
ok('the dummy A (280, stored 2356T-D) opens 2356T', tag(got) === '2356T / 1 / Lionel PW - Items', tag(got));
got = W.resolve(-1, '8359', '', '97');
ok('the Chessie 8359 (97) opens Lionel MPC 8359 — not Atlas\' 8359', tag(got) === '8359 /  / Lionel MPC-Modern', tag(got));

section('B · a card opened without an owned copy still works');
W.calls.length = 0;
got = W.resolve(4, '2338', '2', '');
ok('the catalog page (row index + number, no inventoryId) opens its own row', tag(got) === '2338 / 2 / Lionel PW - Items' && W.calls.length === 0, tag(got));
got = W.resolve(-1, '2338', '2', '');
ok('…and by number + variation alone', tag(got) === '2338 / 2 / Lionel PW - Items', tag(got));

section('C · the rules in the source');
const res = grab(maint, '_maintResolveItem');
ok('the copy is found by inventoryId ALONE', /String\(p\.inventoryId \|\| ''\) === String\(invId\);\s*\n\s*\}\);\s*\n\s*owned =/.test(res));
ok('findMaster is asked with the copy as its third argument', /findMaster\([^;]*,\s*owned\)/.test(res));
ok('_maintOpenPanel resolves through _maintResolveItem (one place)', /var item = _maintResolveItem\(idx, itemNum, variation, invId\);/.test(maint)
   && (maint.match(/Could not find this item\./g) || []).length === 1);

section('D · planted offenders are caught');
let OLD = '';
try { OLD = execSync('git show c3df38f2:app/maintenance.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString(); } catch (e) {}
if (OLD) {
  // v1848 had the resolution inline in _maintOpenPanel: lift it as a function
  const a = OLD.indexOf("    var want = String(itemNum == null ? '' : itemNum).trim();", OLD.indexOf('window._maintOpenPanel = function'));
  const b = OLD.indexOf("    if (!item) { if (typeof showToast === 'function') showToast('Could not find this item.'", a);
  const oldFn = 'function _maintResolveItem(idx, itemNum, variation, invId) {\n' + OLD.slice(a, b) + '    return item || null;\n  }';
  const O = world(oldFn);
  ok('D1 v1848: Brad\'s 2356-P copy finds NOTHING — reproduced', O.resolve(-1, '2356-P', '1', '278') === null, tag(O.resolve(-1, '2356-P', '1', '278')));
}
{
  // D2 — the copy found by inventoryId AND number (the old guard): a caller
  // passing "2356" no longer finds the 2356-P copy
  const src = maint.replace("return p && String(p.inventoryId || '') === String(invId);\n        });\n        owned =", "return p && String(p.inventoryId || '') === String(invId) && String(p.itemNum || '').trim() === want;\n        });\n        owned =");
  const X = world(src);
  X.calls.length = 0; X.resolve(-1, '2356', '1', '278');
  ok('D2 matching the copy by id AND number is caught', src !== maint && X.calls.length === 0);
}
{
  // D3 — findMaster asked without the hint: the Atlas 8359 can win
  const src = maint.replace(/findMaster\(String\(owned\.itemNum \|\| want\), String\(owned\.variation \|\| wantVar\), owned\)/, 'findMaster(String(owned.itemNum || want), String(owned.variation || wantVar))');
  ok('D3 a hint-less findMaster is caught by the source rule', src !== maint && !/findMaster\([^;]*,\s*owned\)/.test(grab(src, '_maintResolveItem')));
  const X = world(src);
  ok('D3b …and it opens Atlas\' 8359 for the Chessie — the number-only first-find, reproduced', tag(X.resolve(-1, '8359', '', '97')) === '8359 /  / Atlas O', tag(X.resolve(-1, '8359', '', '97')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
