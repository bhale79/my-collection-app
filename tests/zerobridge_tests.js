#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// zerobridge_tests.js — 2026-11-08/09, PLAN_2026-11-08_LIONEL_STANDARD_MODERN,
// Brad's Q7 and Q8.
//
// [stated] Brad 20:17 CT "yes": a saved Lionel book copy whose MTH train comes
// as a -0 / -1 pair lands on the -0 (Traditional) row; the collector can switch
// with Change catalog entry. Same for the 55 "Greenberg Book" copies on MTH
// Tinplate (Q8). The master will delete 440 reference-book copies (FINAL_RECORD
// Write 2). The keeper of each is named, by Row ID, in ONE table
// (RR_BOOK_COPY_REDIRECT, config.js): FINAL_RECORD's own re-point (422 rows);
// for the 18 Q6 "unsure" rows (no re-point) MTH's row of the SAME number — the
// app saves by the number on the box — where one exists (17; 11-1006 has none).
// findMaster (app-data.js) reads it through rrBookCopyRedirect; _rrRowIdFits and
// the Master Key check accept the table's own pairs (_rrBookCopyPairFits) so a
// back-filled link keeps the keeper. ONE rule decides "the deleted row's own
// item" for both (_rrBcEntryFits).
//
//   W  ALL 440 Write-2 rows, the REAL findMaster (tests/lib/findmaster-real.js)
//      on a stand-in of the REAL master (tests/fixtures/zerobridge_2026-11-09.json:
//      every row, any tab, of every number those copies can reach, Write 1
//      applied) with the 440 removed: each lands on its keeper however the
//      member's catalogs are loaded; every copy opens on its own row while it exists
//   T  the table = the record's re-points + the same-number rows, each with its reason
//   L  the loading window: no wait for the whole catalog — the keeper as soon as it loads
//   B  the back-fills: Row ID / Master Key written from the keeper, looked up again
//   V  the variation: the redirect and the back-filled pair answer alike
//   S  only a saved link, under its own number, the row gone, the keeper there
//   P  PLANTED offenders — each check above turns red on a copy without its rule
//
// Expectations come from FINAL_RECORD (the re-points) and the master export
// (the same-number rows, read by the fixture builder) — never from the table.
// Run:  node tests/zerobridge_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { buildFindMaster } = require('./lib/findmaster-real');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got).slice(0, 600) + ', wanted ' + JSON.stringify(want).slice(0, 300)));
  ok ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }

const SRC = { dat: rd('app-data.js'), cfg: rd('config.js') };
// The app's own ERAS / ERA_TABS / the table — config.js run for real
function cfgWorld(cfg) {
  const ctx = { console };
  ctx.window = ctx; ctx.addEventListener = () => {};
  ctx.navigator = { userAgent: '', platform: '' };
  ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  ctx.document = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; },
    createElement() { return { style: {} }; }, documentElement: { style: {} } };
  vm.createContext(ctx);
  try { vm.runInContext(cfg, ctx, { filename: 'config.js' }); } catch (e) { /* the tail wires DOM events — the tables are in */ }
  return ctx;
}
const W0 = cfgWorld(SRC.cfg);
const ERAS = vm.runInContext('ERAS', W0), ERA_TABS = vm.runInContext('ERA_TABS', W0);
const tableOf = cfg => vm.runInContext('RR_BOOK_COPY_REDIRECT', cfgWorld(cfg));
const TABLE = tableOf(SRC.cfg);

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'zerobridge_2026-11-09.json'), 'utf8'));
const ROWS0 = FX.rows.map(a => { const o = {}; FX.keys.forEach((k, i) => { o[k] = a[i]; }); return o; });
// the rest of each catalog (Lionel MPC-Modern keeps 21,590 other rows): one row each
const FILL = ['mpc', 'mth_o', 'mth_tinplate'].map(e => ({ itemNum: 'FILL-' + e, variation: '', _era: e, _tab: ERA_TABS[e].items, itemType: 'Boxcar', alsoSoldAs: '', yearProd: '2000', rowId: 'FILL' + e.toUpperCase().replace(/_/g, '') }));
const ROWS = ROWS0.concat(FILL);
const DEAD = new Set(FX.dead);
const ALIVE = ROWS.filter(r => !DEAD.has(r.rowId));
const BYID = new Map(ROWS.map(r => [r.rowId, r]));
const MTH_ERAS = ['mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g'];
const REC = FX.cases.filter(c => c.expectBy === 'record');                 // FINAL_RECORD's re-point
const SAME = FX.cases.filter(c => c.expectBy === 'same number on MTH');    // Q6 unsure: MTH's row of its number
const NONE = FX.cases.filter(c => !c.expect);                              // Q6 unsure with no MTH row of its number
const KEPT = REC.concat(SAME);                                             // every copy the table redirects
const OTHERNUM = KEPT.filter(c => BYID.get(c.expect).itemNum !== c.num);   // the -0 / -1 ones C2 cannot reach

// the saved copy as the app holds it (o.noId: Master Key only; o.noLink: neither; o.v: its variation)
function savedCopy(c, o) {
  const own = BYID.get(c.rowId) || {};
  const v0 = String(own.variation || '');
  const pd = { itemNum: c.num, variation: (o && o.v != null) ? o.v : v0, era: c.era, manufacturer: c.maker, masterKey: c.era + '|' + c.num + '|' + v0, masterRowId: c.rowId };
  if (o && (o.noId || o.noLink)) delete pd.masterRowId;
  if (o && o.noLink) delete pd.masterKey;
  return pd;
}
const fmOf = (layer1, layer2, extra) => buildFindMaster(Object.assign({ layer1, layer2, eras: ERAS, eraTabs: ERA_TABS }, extra || {}));
const idOf = r => (r ? r.rowId : null);
const tag = (c, got, want) => c.num + '@' + c.era + ' -> ' + (got ? got._tab + ' ' + got.itemNum + ' ' + got.rowId : 'nothing') + ' (wanted ' + want + ')';
function sweep(fm, cases, o) {
  const bad = [];
  cases.forEach(c => {
    const pd = (o && o.pd) ? o.pd(c) : savedCopy(c, o);
    const got = fm.findMaster((o && o.num) ? o.num(c) : c.num, pd.variation, pd);
    const want = (o && o.want) ? o.want(c) : c.expect;
    if (idOf(got) !== want) bad.push(tag(c, got, want));
  });
  return bad;
}
// "not redirected": the copy does NOT land on its keeper
function notKeeper(fm, cases, o) {
  const bad = [];
  cases.forEach(c => {
    const pd = (o && o.pd) ? o.pd(c) : savedCopy(c, o);
    const got = fm.findMaster((o && o.num) ? o.num(c) : c.num, pd.variation, pd);
    if (idOf(got) === c.expect) bad.push(tag(c, got, 'not ' + c.expect));
  });
  return bad;
}
function sweepOwn(extra) {
  // the member collects only the line the copy names (a Lionel-only collector)
  const bad = [];
  ['mpc', 'mth_o', 'mth_tinplate'].forEach(era => {
    bad.push(...sweep(fmOf(ALIVE.filter(r => r._era === era), ALIVE, extra), FX.cases.filter(c => c.era === era)));
  });
  return bad;
}
const ALL = (extra) => fmOf(ALIVE, ALIVE, extra);
const MTHONLY = ALIVE.filter(r => MTH_ERAS.indexOf(r._era) >= 0);

section('W — all 440 Write-2 copies, the real findMaster, the real master');
T('W0 the fixture: 440 copies (374 Lionel MPC-Modern, 11 MTH O doubles, 55 MTH Tinplate Greenberg)',
  [FX.cases.length, FX.cases.filter(c => c.era === 'mpc').length, FX.cases.filter(c => c.era === 'mth_o').length, FX.cases.filter(c => c.era === 'mth_tinplate').length], [440, 374, 11, 55]);
T('W0 422 re-points (FINAL_RECORD); the 18 Q6 "unsure": 17 with an MTH row of their number, 1 without', [REC.length, SAME.length, NONE.length], [422, 17, 1]);
const RECOTHER = OTHERNUM.filter(c => c.expectBy === 'record');
const n0 = RECOTHER.filter(c => BYID.get(c.expect).itemNum === c.num + '-0').length, n1 = RECOTHER.filter(c => BYID.get(c.expect).itemNum === c.num + '-1').length;
T('W0 the record\'s keepers with ANOTHER number are all its "-0" or "-1" (' + RECOTHER.length + ': ' + n0 + ' to -0, ' + n1 + ' to -1); with the unsure, ' + OTHERNUM.length + ' copies C2 cannot reach',
  [n0 + n1, RECOTHER.length, OTHERNUM.length], [RECOTHER.length, 120, 132]);
T('W1 all catalogs loaded: every copy lands on its keeper (11-1006: nothing)', sweep(ALL(), FX.cases), []);
T('W2 only the line the copy names loaded (a Lionel-only collector): the same', sweepOwn(), []);
T('W3 only MTH O loaded (it loads first): the same', sweep(fmOf(ALIVE.filter(r => r._era === 'mth_o'), ALIVE), FX.cases), []);
T('W4 only MTH Tinplate loaded: the same', sweep(fmOf(ALIVE.filter(r => r._era === 'mth_tinplate'), ALIVE), FX.cases), []);
T('W5 nothing loaded, the whole-catalog layer only: the same', sweep(fmOf([], ALIVE), FX.cases), []);
T('W6 BEFORE the deletes (the 440 still there): every copy opens on its OWN row', sweep(fmOf(ROWS, ROWS), FX.cases, { want: c => c.rowId }), []);
T('W7 …a copy with a Master Key and no Row ID too', sweep(fmOf(ROWS, ROWS), FX.cases, { noId: true, want: c => c.rowId }), []);
T('W8 every keeper is MTH\'s row (all 439)', KEPT.filter(c => MTH_ERAS.indexOf(BYID.get(c.expect)._era) < 0).length, 0);
T('W9 the 17 unsure land on MTH\'s row of their OWN number (the -0 of a pair, else the -1)',
  SAME.filter(c => { const n = BYID.get(c.expect).itemNum; return !(n === c.num || n === c.num + '-0' || n === c.num + '-1'); }).map(c => c.num), []);
T('W10 11-1006 (no MTH row of its number) lands nowhere', NONE.map(c => c.num + ':' + idOf(ALL().findMaster(c.num, '', savedCopy(c)))), ['11-1006:null']);

section('T — the table: the record\'s re-points + the same-number rows, each with its reason');
// T2's comparison, as a function so a planted table can be put through it
function t2(TR) {
  return KEPT.filter(c => { const e = TR[c.rowId], own = BYID.get(c.rowId), k = BYID.get(c.expect);
    return !(e && e[0] === c.era && e[1] === c.num && e[2] === String(own.variation || '') && e[3] === c.expect && e[4] === k.itemNum); }).map(c => c.num);
}
function t4(cfg) {
  const lines = cfg.split('\n');
  return SAME.filter(c => !lines.some(l => l.indexOf("'" + c.rowId + "':") >= 0 && l.indexOf('// same number on MTH (box number)') >= 0)).map(c => c.num);
}
const TR = TABLE.rows;
T('T1 439 rows: 422 re-points + 17 same-number rows', Object.keys(TR).length, 439);
T('T2 each row: the deleted row\'s era, number, variation; the keeper\'s Row ID and number — as the record / the master say', t2(TR), []);
T('T3 11-1006 is not in the table', NONE.filter(c => TR[c.rowId]).length, 0);
T('T4 each same-number row says why ("same number on MTH (box number)") on its line', t4(SRC.cfg), []);

section('L — the loading window: no wait for the whole catalog');
T('L1 only the MTH catalogs loaded so far, the whole catalog not read: every copy is on its keeper already',
  sweep(fmOf(MTHONLY, null, { indexComplete: false }), FX.cases), []);
T('L2 …nothing flickers to another train meanwhile (11-6040, 11-70086, 11-70087 among them)',
  ['11-6040', '11-70086', '11-70087'].map(n => { const c = FX.cases.find(x => x.num === n && x.era === 'mpc'); return n + '->' + (ALL({ indexComplete: false }).findMaster(n, '', savedCopy(c)) || {}).itemNum; }),
  ['11-6040->11-6040-0', '11-70086->11-70086', '11-70087->11-70087']);
T('L3 the deleted row loaded (before the master\'s delete), the catalog still loading: the copy\'s own row',
  sweep(fmOf(ROWS, null, { indexComplete: false }), FX.cases, { noId: true, want: c => c.rowId }), []);

section('B — the back-fills keep the copy on its keeper (Row ID and Master Key written, looked up again)');
// what _backfillMasterRowIds / _backfillMasterKeys write: findMaster, then the
// variation link rule (rrRowForVariation), then the row's Row ID / Master Key
function backfill(fm, pd) {
  let m = fm.findMaster(pd.itemNum, pd.variation, pd);
  if (m && fm.rowForVariation) m = fm.rowForVariation(m, pd.itemNum, pd.variation);
  return m ? { id: fm.rowIdOf(m), key: fm.keyOf(m) } : null;
}
function roundTrip(extra) {
  const fm = ALL(extra), bad = { id: [], key: [], both: [] };
  KEPT.forEach(c => {
    const pd = savedCopy(c), w = backfill(fm, pd);
    if (!w || w.id !== c.expect) { bad.id.push(c.num + ' wrote ' + (w && w.id)); return; }
    const a = fm.findMaster(c.num, pd.variation, Object.assign({}, pd, { masterRowId: w.id }));
    if (idOf(a) !== c.expect) bad.id.push(tag(c, a, c.expect));
    const pk = savedCopy(c, { noId: true }), wk = backfill(fm, pk);
    const b = fm.findMaster(c.num, pk.variation, Object.assign({}, pk, { masterKey: wk && wk.key }));
    if (idOf(b) !== c.expect) bad.key.push(tag(c, b, c.expect));
    const d = fm.findMaster(c.num, pd.variation, Object.assign({}, pd, { masterRowId: w.id, masterKey: w.key }));
    if (idOf(d) !== c.expect) bad.both.push(tag(c, d, c.expect));
  });
  return bad;
}
const RT = roundTrip();
T('B1 Row ID back-filled from the keeper -> the same keeper, all 439', RT.id, []);
T('B2 Master Key back-filled from the keeper (no Row ID) -> the same keeper, all 439', RT.key, []);
T('B3 both written -> the same keeper, all 439', RT.both, []);
{
  const fm = ALL();
  T('B4 the Row ID check (_rrRowIdFits — My Collection\'s joins ask it too) accepts each keeper for its copy',
    KEPT.filter(c => !fm.rowIdFits(BYID.get(c.expect), c.num, '')).length, 0);
  const c = OTHERNUM[0];
  T('B5 …but not for another variation, another number, or another keeper',
    [fm.rowIdFits(BYID.get(c.expect), c.num, 'ZZ'), fm.rowIdFits(BYID.get(c.expect), c.num + '9', ''), fm.rowIdFits(BYID.get(OTHERNUM[1].expect), c.num, '')], [false, false, false]);
}
// the keeper renumbered since the table (11-1005-0 -> 11-1005-0X): never a different row, by either door
function stale(dat) {
  const c = OTHERNUM[0], k = BYID.get(c.expect);
  const moved = ALIVE.map(r => (r === k ? Object.assign({}, r, { itemNum: r.itemNum + 'X' }) : r));
  const fm = fmOf(moved, moved, { dat });
  const viaTable = fm.findMaster(c.num, '', savedCopy(c));
  const viaBackfill = fm.findMaster(c.num, '', Object.assign(savedCopy(c), { masterRowId: k.rowId }));
  return [viaTable ? viaTable.itemNum : null, viaBackfill ? viaBackfill.itemNum : null];
}
T('B6 the keeper no longer under its number: not redirected, and a back-filled Row ID no longer holds', stale(), [null, null]);

section('V — the variation: the redirect and the back-filled pair answer alike (one rule)');
// for each copy and each variation it might carry: is it redirected (by its old
// link) exactly when the back-filled keeper link would still hold?
function agree(dat) {
  const fm = ALL({ dat }), bad = [];
  KEPT.forEach(c => {
    const e = TR[c.rowId];
    ['', e[2], '2', 'ZZ'].forEach(v => {
      const red = idOf(fm.findMaster(c.num, v, savedCopy(c, { v }))) === c.expect;
      const redK = idOf(fm.findMaster(c.num, v, savedCopy(c, { v, noId: true }))) === c.expect;
      const holds = idOf(fm.findMaster(c.num, v, Object.assign(savedCopy(c, { v }), { masterRowId: c.expect }))) === c.expect;
      if (red !== holds || redK !== holds) bad.push(c.num + ' var "' + v + '": redirect ' + red + '/' + redK + ', back-filled ' + holds);
    });
  });
  return bad;
}
T('V1 for every copy and variation ("", its own, "2", "ZZ"): redirected exactly when the back-filled link holds', agree(), []);
{
  const c = KEPT.find(x => x.num === '11-1005' && x.era === 'mpc');
  T('V2 a Master-Key-only copy "mpc|11-1005|" that names variation 2 is NOT redirected (and would not hold after a back-fill)',
    idOf(ALL().findMaster('11-1005', '2', savedCopy(c, { v: '2', noId: true }))), null);
  const a = KEPT.find(x => x.num === '11-70098' && x.era === 'mpc' && x.expectBy === 'record');
  T('V3 the real 11-70098 variation A copy lands on its keeper and stays there', [
    idOf(ALL().findMaster('11-70098', 'A', savedCopy(a))),
    idOf(ALL().findMaster('11-70098', 'A', Object.assign(savedCopy(a), { masterRowId: a.expect })))], [a.expect, a.expect]);
}

section('S — only a saved copy of a deleted row, under its own number');
const otherNumSilent = (fm, o) => notKeeper(fm, OTHERNUM, o);
T('S1 no Row ID, no Master Key (not a saved copy): not redirected', otherNumSilent(ALL(), { noLink: true }), []);
T('S2 a Master Key alone (no Row ID) IS redirected, all 439', sweep(ALL(), KEPT, { noId: true }), []);
T('S3 looked up under ANOTHER number (an edit): not redirected', otherNumSilent(ALL(), { num: c => c.num + '-9' }), []);
T('S4 a Row ID that names no row and is not in the table, with a deleted row\'s key: not redirected',
  otherNumSilent(ALL(), { pd: c => Object.assign(savedCopy(c), { masterRowId: 'NOTAROWXYZ' }) }), []);

section('P — PLANTED offenders');
function plant(file, from, to, label) {
  const o = SRC[file], p = o.split(from).join(to);
  T('P plant applied: ' + label, p !== o, true);
  return p;
}
const red = (label, bad, min) => T(label + ' (' + bad.length + ' caught)', bad.length >= (min || 1), true);
const p1 = plant('dat', '    if (_bcK) return _bcK;\n', '', 'findMaster never asks the table');
red('P1 caught: the copies whose keeper has another number find nothing (W1)', sweep(ALL({ dat: p1 }), FX.cases), OTHERNUM.length);
red('P1 caught: …a Lionel-only collector\'s too (W2)', sweepOwn({ dat: p1 }), OTHERNUM.length);
const p2 = plant('dat', '    if (rrMasterByRowId(id)) return null;                                    // the row is still there\n', '', 'the row\'s presence not checked');
red('P2 caught: before the deletes a key-only copy is sent to the keeper (W7)', sweep(fmOf(ROWS, ROWS, { dat: p2 }), FX.cases, { noId: true, want: c => c.rowId }), 400);
const p3 = plant('dat', "  if (!_rrBcEntryFits(e, itemNum, variation)) return null;                 // only the deleted row's own item\n",
  "  if (String(itemNum == null ? '' : itemNum).trim() !== e[1]) return null;\n", 'the redirect ignores the variation');
red('P3 caught: the redirect and the back-filled pair disagree on a variation (V1)', agree(p3), OTHERNUM.length);
T('P3 caught: the variation-2 key-only copy is redirected (V2)', idOf(ALL({ dat: p3 }).findMaster('11-1005', '2', savedCopy(KEPT.find(x => x.num === '11-1005' && x.era === 'mpc'), { v: '2', noId: true }))) !== null, true);
const p4 = plant('dat', "  if (!_rrBcEntryFits(e, itemNum, variation)) return null;                 // only the deleted row's own item\n", '', 'any number looked up');
red('P4 caught: an edit to another number still lands on the keeper (S3)', otherNumSilent(ALL({ dat: p4 }), { num: c => c.num + '-9' }), OTHERNUM.length);
const p5 = plant('dat', "    if (!k || String(k.itemNum == null ? '' : k.itemNum).trim() !== e[4]) return null;   // the keeper must be there, under its number\n", "    if (!k) return null;\n", 'the redirect does not check the keeper\'s number');
T('P5 caught: the renumbered keeper is still taken by the table (B6)', stale(p5)[0], BYID.get(OTHERNUM[0].expect).itemNum + 'X');
const p6 = plant('dat', "    if (rn !== e[4]) return false;                                           // the keeper still under its number\n", '', 'the back-filled pair does not check the keeper\'s number');
T('P6 caught: a back-filled Row ID holds on the renumbered keeper (B6)', stale(p6)[1], BYID.get(OTHERNUM[0].expect).itemNum + 'X');
const p7 = plant('dat', "    return (typeof _rrBookCopyPairFits === 'function') && _rrBookCopyPairFits(row, _in, variation);\n", '    return false;\n', '_rrRowIdFits refuses the table\'s pairs');
red('P7 caught: a back-filled Row ID strands the copy (B1)', roundTrip({ dat: p7 }).id, OTHERNUM.length);
const p8 = plant('dat', "\n          || (typeof _rrBookCopyPairFits === 'function' && _rrBookCopyPairFits(_byKey, _in, variation))) return _byKey;", '\n          ) return _byKey;', 'the Master Key check refuses the table\'s pairs');
red('P8 caught: a back-filled Master Key strands the copy (B2)', roundTrip({ dat: p8 }).key, OTHERNUM.length);
const p9 = plant('dat', "    id = I.byKey.get(String(prefer.masterKey || '').trim()) || '';           // no Row ID: its Master Key\n", "    id = '';\n", 'a Master Key alone never redirects');
red('P9 caught: a key-only copy finds nothing (S2)', sweep(ALL({ dat: p9 }), KEPT, { noId: true }), OTHERNUM.length);
const p10 = plant('dat', '    if (id) return null;                                                     // its Row ID names another row: not ours\n', '', 'a foreign Row ID ignored');
red('P10 caught: a Row ID naming nothing, with a deleted key, is redirected (S4)', otherNumSilent(ALL({ dat: p10 }), { pd: c => Object.assign(savedCopy(c), { masterRowId: 'NOTAROWXYZ' }) }), OTHERNUM.length);
const p11 = plant('dat', "  return !v || (typeof rrSameVar === 'function' ? rrSameVar(v, e[2]) : v.toUpperCase() === String(e[2]).toUpperCase());\n", '  return true;\n', 'the one rule ignores the variation');
{ const fm = ALL({ dat: p11 }), c = OTHERNUM[0]; T('P11 caught: another variation fits the keeper (B5)', fm.rowIdFits(BYID.get(c.expect), c.num, 'ZZ'), true); }
const p12 = plant('cfg', "const RR_BOOK_COPY_REDIRECT = {\n  id: 'stdmodern-write2-2026-11-08',\n  rows: {\n", "const RR_BOOK_COPY_REDIRECT = {\n  id: 'stdmodern-write2-2026-11-08',\n  rows: {\n  }, _gone: {\n", 'the table emptied in config.js');
red('P12 caught: with no table the copies find nothing (W1)', sweep(ALL({ cfg: p12 }), FX.cases), OTHERNUM.length);
const p13 = plant('cfg', "    'MRBYH6C8FF': ['mpc', '11-1005', '', 'CU89458CGD', '11-1005-0'],", "    'MRBYH6C8FF': ['mpc', '11-1005', '', 'N4KMFHZKYP', '11-1005-1'],", 'one keeper changed to the -1');
T('P13 caught: T2 sees the table disagree with the record', t2(tableOf(p13).rows), ['11-1005']);
const p14 = plant('cfg', "['mpc', '11-6022', '', 'F2JCSQRH9R', '11-6022-0'],   // same number on MTH (box number)", "['mpc', '11-6022', '', 'F2JCSQRH9R', '11-6022-0'],", 'one same-number row\'s reason taken out');
T('P14 caught: T4 sees the row with no reason', t4(p14), ['11-6022']);
// the flicker: a redirect that waits for the whole catalog
const p15 = plant('dat', "    if (rrMasterByRowId(id)) return null;                                    // the row is still there\n",
  "    if (typeof rrCatalogIndexStatus === 'function' && !rrCatalogIndexStatus().complete) return null;\n    if (rrMasterByRowId(id)) return null;                                    // the row is still there\n", 'the redirect waits for the whole catalog');
red('P15 caught: during loading the copies find nothing / another train (L1)', sweep(fmOf(MTHONLY, null, { dat: p15, indexComplete: false }), FX.cases), OTHERNUM.length);
// the redirect's module state, as app-data.js declares it (tests/lib/findmaster-real.js uses the app's own line)
const p16 = plant('dat', '\nvar _rrBcIdx = null;\n', '\n', 'app-data.js loses the redirect\'s state declaration');
{ let threw = '';
  try { ALL({ dat: p16 }).findMaster('11-1005', '', savedCopy(KEPT.find(x => x.num === '11-1005' && x.era === 'mpc'))); } catch (e) { threw = e.name; }
  T('P16 caught: the lookup throws (as it would in the app)', threw, 'ReferenceError'); }

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  zerobridge_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
