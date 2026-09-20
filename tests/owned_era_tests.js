#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// OWNED-ERA TESTS — v0.9.1795
//
// Brad: "what is going on? my collection seems off. the 520 box engine is a
// knuckle coupler, i own 223 items, but look at the numbers in my collection.
// era progress doesn't show lionel postwar at all."
//
// His sheet was right (520-P · Motorized Unit · Box Cab Electric · era pw ·
// key pw|520|1). The period half of What I Collect was Modern-only, so:
//   • Items I Own said 223 and listed 29; Era Progress had no Postwar row.
//   • The Postwar catalog was not in Layer 1; American Flyer S (Gilbert) was,
//     and Gilbert's 520 IS a "Knuckle Coupler Kit". findMaster returned the
//     first LAYER that answered at all.
//
// A PREFERENCE NARROWS THE SHELF. IT DOES NOT DISOWN A TRAIN, AND IT DOES NOT
// CHANGE WHAT A TRAIN IS.
//
// Everything under test is LIFTED from app/ — never imitated (v0.9.1794).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
function grabConst(src, name) {               // brace-matched, never "first ;"
  const i = src.indexOf('const ' + name + ' = {');
  if (i < 0) throw new Error('missing const ' + name);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1) + ';'; }
  }
  throw new Error('unbalanced ' + name);
}

const dat = read('app-data.js'), app = read('app.js'), cfg = read('config.js'), dash = read('dashboard.js'), sb = read('sheet-builder.js');

let pass = 0, fail = 0;
function T(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

// ── the real rows, as the master has them today ────────────────────────────
const PWTAB = 'Lionel PW - Items', AFTAB = 'American Flyer S - Gilbert';
const pw520  = { itemNum: '520', variation: '1', itemType: 'Motorized Unit', description: 'Box Cab Electric', _era: 'pw', _tab: PWTAB };
const pw520b = { itemNum: '520', variation: '2', itemType: 'Motorized Unit', description: 'Box Cab Electric', _era: 'pw', _tab: PWTAB };
const af520  = { itemNum: '520', variation: '1', itemType: 'Accessory', description: 'Knuckle Coupler Kit', _era: 'af_gilbert', _tab: AFTAB };
const af520t = { itemNum: '520', variation: '1', itemType: 'Tank Car', description: 'Sunoco Tank Car', _era: 'af_gilbert', _tab: AFTAB };
const mpc8359 = { itemNum: '8359', variation: '', itemType: 'Diesel', description: 'Chessie GP-7', _era: 'mpc', _tab: 'Lionel MPC-Modern' };

function world(layer1, layer2) {
  const mk = rows => { const m = new Map(); rows.forEach(r => { const b = m.get(r.itemNum) || []; b.push(r); m.set(r.itemNum, b); }); return m; };
  return { masterByItem: mk(layer1), masterByItemAll: layer2 ? mk(layer2) : null };
}

function build(findMasterSrc) {
  const window = {};
  const _lkCache = new WeakMap();
  var state = {};
  const getTypeBucket = () => '';
  eval(grabConst(cfg, 'ERA_TABS').replace(/^const /, 'var '));   // a const inside eval dies with the eval
  const ERA_SCALE = {};
  eval(grab(app, 'normalizeItemNum'));
  eval(grab(app, 'baseItemNum'));
  eval(grab(dat, '_mIsMotive'));
  eval(grab(dat, '_mSuffix'));
  eval(grab(dat, '_letterKinRows'));
  eval(grab(dat, '_findMasterCore'));
  eval(grab(dat, 'rrMasterByKey'));
  eval(grab(dat, '_preferEraOf'));
  eval(findMasterSrc);
  return { fm: (w, n, v, p) => { state = w; return findMaster(n, v, p); } };
}
T('harness: the real ERA_TABS names the Postwar items tab', /pw:\s*\{\s*items:\s*'Lionel PW - Items'/.test(grabConst(cfg, 'ERA_TABS')), true);
const REAL = grab(dat, 'findMaster');
const live = build(REAL);

// Brad's row, exactly as his sheet has it.
const BRAD = { itemNum: '520-P', variation: '1', era: 'pw', manufacturer: 'Lionel', itemType: 'Motorized Unit', masterKey: 'pw|520|1' };
const NOKEY = { itemNum: '520-P', variation: '1', era: 'pw', manufacturer: 'Lionel' };

// ── 1. THE BUG ITSELF: Postwar unticked → only Gilbert in Layer 1 ──────────
const MODERN_ONLY = world([af520, af520t, mpc8359], [af520, af520t, mpc8359, pw520, pw520b]);
T('520-P, Postwar unticked -> Box Cab Electric', (live.fm(MODERN_ONLY, '520-P', '1', BRAD) || {}).description, 'Box Cab Electric');
T('520-P, Postwar unticked -> the Postwar tab', (live.fm(MODERN_ONLY, '520-P', '1', BRAD) || {})._tab, PWTAB);
T('…and without a stored key, the era column alone is enough', (live.fm(MODERN_ONLY, '520-P', '1', NOKEY) || {}).description, 'Box Cab Electric');
T('…variation 2 gets variation 2', (live.fm(MODERN_ONLY, '520-P', '2', Object.assign({}, NOKEY, { variation: '2' })) || {}).variation, '2');

// ── 2. the stored key now answers for a -P row (it never did) ──────────────
const KEYONLY = world([pw520b, pw520], null);   // var 2 first: only the key can pick var 1
T('stored key pw|520|1 answers for 520-P', (live.fm(KEYONLY, '520-P', '', BRAD) || {}).variation, '1');
T('a FOREIGN key is still refused', (live.fm(KEYONLY, '6464', '', { masterKey: 'pw|520|1' }) || null), null);

// ── 3. nothing else moves ──────────────────────────────────────────────────
T('an owner of the GILBERT 520 still gets the Gilbert row',
  (live.fm(MODERN_ONLY, '520', '1', { era: 'af_gilbert', manufacturer: 'American Flyer' }) || {})._tab, AFTAB);
T('no hint at all -> Layer 1 answers, as before', (live.fm(MODERN_ONLY, '520', '1', null) || {})._tab, AFTAB);
T("era 'Manual' names no catalog -> still null", live.fm(MODERN_ONLY, '520', '1', { era: 'Manual' }), null);
T('a label in the era column names no catalog -> Layer 1, as before',
  (live.fm(MODERN_ONLY, '520', '1', { era: 'Postwar' }) || {})._tab, AFTAB);
T('Layer 2 not built yet -> Layer 1 answer rather than nothing',
  (live.fm(world([af520], null), '520-P', '1', NOKEY) || {})._tab, AFTAB);
T('named catalog in NEITHER layer -> Layer 1 answer stands',
  (live.fm(world([af520], [af520, mpc8359]), '520-P', '1', NOKEY) || {})._tab, AFTAB);
T('right catalog already in Layer 1 -> Layer 2 never consulted',
  (live.fm(world([pw520, af520], [af520]), '520-P', '1', NOKEY) || {})._tab, PWTAB);
T('Layer 1 total miss -> Layer 2 answers, as before (v0.9.971)',
  (live.fm(world([], [mpc8359]), '8359', '', null) || {}).description, 'Chessie GP-7');

// ── 4. PROVE THIS SUITE CAN FAIL: put the old tail back ────────────────────
const tailAt = REAL.indexOf('var _want = _preferEraOf(prefer);');
T('surgery target found exactly once', REAL.split('var _want = _preferEraOf(prefer);').length - 1, 1);
const OLD = REAL.slice(0, tailAt) +
  'var _r = _findMasterCore(state.masterByItem, itemNum, variation, prefer);\n  if (_r) return _r;\n' +
  '  if (state.masterByItemAll) _r = _findMasterCore(state.masterByItemAll, itemNum, variation, prefer);\n  return _r || null;\n}';
const old = build(OLD);
T('PLANTED: the old first-layer-wins tail gives the Knuckle Coupler Kit',
  (old.fm(MODERN_ONLY, '520-P', '1', NOKEY) || {}).description, 'Knuckle Coupler Kit');

// ── 5. THE CARDS: an owned era shows, ticked or not ────────────────────────
let _enabled = {};
const _isEraEnabled = ek => !!_enabled[ek];
eval(grab(dash, '_eraShownOnCards'));
_enabled = { mpc: 1, af_gilbert: 1 };          // Brad's state: Modern only
T('Postwar unticked, 190 owned -> SHOWN', _eraShownOnCards('pw', 190), true);
T('Pre-War unticked, 2 owned -> SHOWN', _eraShownOnCards('prewar', 2), true);
T('Postwar unticked, none owned -> hidden (the preference still works)', _eraShownOnCards('pw', 0), false);
T('ticked era, none owned -> shown (Era Progress lists 0 / N)', _eraShownOnCards('mpc', 0), true);
T("'all' is never a bucket", _eraShownOnCards('all', 5), false);

// One question, ONE place: the four loops must all ask the helper, and none
// may go back to asking _isEraEnabled directly. Proven able to fail below.
function directAsks(src) {
  return (src.match(/Object\.keys\(ERAS\)\.forEach\(function\s*\(ek\)\s*\{[^]*?\n\s*\}\);/g) || [])
    .filter(loop => /!_isEraEnabled\(ek\)/.test(loop)).length;
}
T('dashboard.js: both card loops use _eraShownOnCards', (dash.match(/if \(!_eraShownOnCards\(ek, /g) || []).length, 2);
T('sheet-builder.js: both sheet loops use _eraShownOnCards', (sb.match(/if \(!_eraShownOnCards\(ek, /g) || []).length, 2);
T('dashboard.js: no era loop asks the preference directly', directAsks(dash), 0);
T('sheet-builder.js: no era loop asks the preference directly', directAsks(sb), 0);
const planted = dash.replace('if (!_eraShownOnCards(ek, byEra[ek] || 0)) return;',
  "if (typeof _isEraEnabled === 'function' && !_isEraEnabled(ek)) return;");
T('PLANTED: the old direct ask is caught', directAsks(planted) > 0, true);

// An unticked-but-owned era needs a denominator: _eraMasterRows falls back to
// the full index.
{
  const ERA_MASTER_TABS = {};
  let state = { masterData: [mpc8359], masterAllRows: [mpc8359, pw520, pw520b] };
  const _currentEra = 'all';
  eval(grab(dash, '_eraMasterRows'));
  T('era total for an unloaded era comes from the full index', _eraMasterRows('pw'), 2);
  T('era total for a loaded era is unchanged', _eraMasterRows('mpc'), 1);
}

console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
process.exit(fail ? 1 : 0);
