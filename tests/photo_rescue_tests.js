#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// PHOTO RESCUE PLANNER — v0.9.1561 (Session 83)
// The one-time repair for photos stranded by the pre-1560 grouped-save
// bug. This extracts the REAL _rrRescuePlan from app/photo-inbox.js and
// proves the planner: scope (grouped only), tiered matching, role
// narrowing, and that nothing ambiguous is ever marked auto.
// Run from repo root:  node tests/photo_rescue_tests.js  (exit 1 = bad)
// ═══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const target = process.env.TARGET || path.join(__dirname, '..', 'app', 'photo-inbox.js');
const src = fs.readFileSync(target, 'utf8');

function grabFrom(sig, isFn) {
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('missing ' + sig);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(isFn ? src.indexOf('function', i) : i, k + 1); }
  }
  throw new Error('unbalanced ' + sig);
}
// the real helpers (byte-faithful to app.js)
function normalizeItemNum(n) { const s = String(n == null ? '' : n).trim(); return s.match(/^\d+\.0$/) ? s.slice(0, -2) : s; }
function baseItemNum(n) { return normalizeItemNum(n).replace(/[-]?[PDTC]$/i, ''); }
function _pinIsPairRole(role) { return String(role || '').indexOf('pair_') === 0; }
const window = {};

let _rescueTier, _RESCUE_ROLE_SUFFIX;
eval('_rescueTier = ' + grabFrom('function _rescueTier', true));
eval(src.substring(src.indexOf('var _RESCUE_ROLE_SUFFIX'), src.indexOf(';', src.indexOf('var _RESCUE_ROLE_SUFFIX')) + 1).replace(/^var /, '_RESCUE_ROLE_SUFFIX = '));
eval('window._rrRescuePlan = ' + grabFrom('window._rrRescuePlan = function', true));

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log('  ✗ FAIL: ' + label); } };
const F = (id, num, extra) => Object.assign({ id, name: id + '.jpg', meta: Object.assign({ num, grp: 'G1', kind: 'aa', role: '', stat: 'read' }, extra || {}) }, {});
const P = (key, itemNum, extra) => [key, Object.assign({ owned: true, itemNum, row: 5, inventoryId: key.replace(/\D/g, '') || '1', photoItem: '', variation: '1' }, extra || {})];

// 1 — the classic strand: read 2344, own 2344-P with no photo → auto
let plan = window._rrRescuePlan([F('a', '2344')], Object.fromEntries([P('k10', '2344-P')]));
check('base tier finds 2344-P for a photo read as 2344', plan.units.length === 1 && plan.units[0].target === 'k10');
check('single no-photo candidate is AUTO', plan.units[0].auto === true);

// 2 — role narrows between -P and -T
plan = window._rrRescuePlan([F('a', '2344', { role: 'p' })], Object.fromEntries([P('k10', '2344-P'), P('k11', '2344-T')]));
check('role p narrows to the -P row', plan.units[0].candidates.length === 1 && plan.units[0].target === 'k10');

// 3 — no role, two rows → REVIEW, never auto
plan = window._rrRescuePlan([F('a', '2344')], Object.fromEntries([P('k10', '2344-P'), P('k11', '2344-T')]));
check('two candidates without a role stay for review', plan.units[0].auto === false && plan.units[0].candidates.length === 2);

// 4 — single ungrouped photos are OUT of scope
plan = window._rrRescuePlan([{ id: 'x', name: 'x.jpg', meta: { num: '6464', grp: '', kind: 'single', role: '', stat: 'read' } }], Object.fromEntries([P('k1', '6464')]));
check('a kind=single photo with no group is not touched', plan.units.length === 0);

// 5 — already-filed photos are skipped
plan = window._rrRescuePlan([F('a', '2344', { stat: 'filed' })], Object.fromEntries([P('k10', '2344-P')]));
check('stat=filed photos are excluded', plan.units.length === 0);

// 6 — placeholder rows (99999) are never candidates
plan = window._rrRescuePlan([F('a', '2344')], Object.fromEntries([P('k10', '2344-P', { row: 99999 })]));
check('row 99999 is never a candidate; photos counted as skipped', plan.units.length === 0 && plan.skipped === 1);

// 7 — exact tier beats base tier
plan = window._rrRescuePlan([F('a', '2344')], Object.fromEntries([P('k1', '2344', { photoItem: 'https://drive.google.com/drive/folders/abc' }), P('k2', '2344-P')]));
check('exact 2344 outranks base-tier 2344-P', plan.units[0].candidates.length === 1 && plan.units[0].target === 'k1');
check('an exact match that already has photos is NOT auto', plan.units[0].auto === false);

// 8 — a no-number "together" shot joins its group only when unambiguous
plan = window._rrRescuePlan(
  [F('a', '2343'), F('b', '', { role: 'together' })],
  Object.fromEntries([P('k1', '2343-P')]));
check('no-number together shot joins a one-number group', plan.units.length === 1 && plan.units[0].files.length === 2);
plan = window._rrRescuePlan(
  [F('a', '2343'), F('b', '6464'), F('c', '', { role: 'together' })],
  Object.fromEntries([P('k1', '2343-P'), P('k2', '6464')]));
check('no-number shot stays OUT of a two-number group', plan.units.reduce((s, u) => s + u.files.length, 0) === 2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
