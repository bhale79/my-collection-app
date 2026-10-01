// ═══════════════════════════════════════════════════════════════
// mth_add_sets_tests.js — v0.9.1848.
//
// [stated] Brad, 2026-10-01: "lets do the mth add then" → plan → "yes".
// The Add screen's set question (AA / AB / ABA) only knew Lionel's numbering
// (parent#T = second A, parent#C = B unit), so an MTH cab unit got NO question.
// MTH numbers every piece of a family itself (20-20943-1 powered A, -3 B unit,
// -4 non-powered A) and sells some sets under ONE number ("F-3 AA Diesel Set").
// And the save turns a unit's power into Lionel's -P / -D — on an MTH number
// that writes "20-20943-1-P", a number that does not exist.
//
// THE RULES THIS SUITE PROTECTS:
//   1. An MTH engine is offered exactly the sets its family has, read from the
//      partner map (pass 4 — the same answers the want list uses): A unit →
//      A only / AA / AB / ABA; an AA set under one number → + B unit; an AB set
//      → + second A; an ABA set, a B unit, a hood unit → no question.
//   2. The chosen set names the map's real partners — never a guess.
//   3. MTH numbers are saved exactly as the catalog prints them: no -P / -D on
//      any of the units.
//   4. Lionel is unchanged: 2343 offers the same five buttons and saves the
//      same numbers (2343-P, 2343C, 2343T-D) as before.
// The REAL buildPartnerMap / getGroupingOptions / applyGrouping run on rows
// copied from the live MTH tabs; the save's numbering is the REAL _pdSuffix and
// _unit2PowerOf lifted from wizard-save.js. Offenders include the v1847 code.
// Run:  node tests/mth_add_sets_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
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
const appjs = APP('app.js'), wsave = APP('wizard-save.js');

// ── the rows, as the live tabs spell them ───────────────────────────────────
// the road name the way the MTH tabs spell it — with the entity ("Baltimore &amp; Ohio") while the description carries the plain "&"
const MTH = (num, desc, type) => ({ _tab: 'MTH O', _era: 'mth_o', itemNum: num, description: desc, itemType: type || 'Diesel Locomotive', subType: '', unit: '', poweredDummy: '', roadName: (desc.split(' O Scale')[0].indexOf(' ') > 0 && /O Scale/.test(desc) ? desc.split(' O Scale')[0] : '').replace(/&/g, '&amp;'), manufacturer: 'MTH' });
const PW = (num, unit, pd) => ({ _tab: 'Lionel PW - Items', _era: 'pw', itemNum: num, description: 'Santa Fe F-3 ' + (unit === 'B' ? 'B unit' : 'A unit'), itemType: 'Diesel Locomotive', subType: 'EMD F-3', unit, poweredDummy: pd, roadName: 'Santa Fe' });
const ROWS = [
  // an AA set in three variants + its B unit
  MTH('20-2050-0', 'Baltimore & Ohio O Scale Premier F-3 AA Diesel Set - 3 Rail Horn'),
  MTH('20-2050-1', 'Baltimore & Ohio O Scale Premier F-3 AA Diesel Set - With Proto-Sound'),
  MTH('20-2050-2', 'Baltimore & Ohio O Scale Premier F-3 AA Diesel Set - 2 Rail'),
  MTH('20-2050-3', 'Baltimore & Ohio O Scale Premier F-3 B-Unit - 3 Rail Powered'),
  // a powered A + B + a second A whose description was cut short in the sheet
  MTH('20-20943-1', 'Denver & Rio Grande O Scale Premier F-3 A Unit Diesel Engine w/Proto-Sound 3.0 (Hi-Rail Wheels)'),
  MTH('20-20943-3', 'Denver & Rio Grande O Scale Premier F-3 B-Unit Diesel (Non-Powered)'),
  MTH('20-20943-4', 'Diesel Engine (Non-Powered Hi-Rail'),
  // an engine named only by its model, with a powered B unit
  MTH('20-2222-1', 'Milwaukee Road O Scale Premier DL-109 Diesel Engine w/Proto-Sound'),
  MTH('20-2222-3', 'Milwaukee Road O Scale Premier DL-110 Powered B Unit Diesel Engine'),
  // an ABA set (hyphen spelling) with an extra B — the set is complete
  MTH('20-20341-1', 'EMD E6 A-B-A Diesel Engine Set', 'Set'),
  MTH('20-20341-3', 'Baltimore & Ohio O Scale Premier E-6 B-Unit (Non-Powered)'),
  // a hood unit and its dummy twin — NOT a cab-unit family
  MTH('20-20087-1', 'Santa Fe O Scale Premier SD70ACe Diesel Engine w/Proto-Sound 3.0'),
  MTH('20-20087-3', 'Santa Fe O Scale Premier SD70ACe Diesel Engine (Non-Powered)'),
  // a train set whose B unit was sold on its own
  MTH('20-20612-1', 'Freight Express F7 Train Set', 'Set'),
  MTH('20-20612-3', 'Chesapeake & Ohio F-7 B-Unit Diesel (Non-Powered)'),
  // a B unit alone — its engine lives under another number
  MTH('20-2101-3', 'Pennsylvania O Scale Premier F-3 B-Unit - 3 Rail Powered'),
  // an AB set + a second A
  MTH('20-2160-1', 'New York Central O Scale Premier F-3 AB Diesel Set - With Proto-Sound'),
  MTH('20-2160-3', 'New York Central O Scale Premier F-3 A Unit (Non-Powered)'),
  // the same convention on the HO tab
  Object.assign(MTH('80-2001-1', 'Santa Fe HO F-3 AA Diesel Set'), { _tab: 'MTH HO', _era: 'mth_ho' }),
  Object.assign(MTH('80-2001-3', 'Santa Fe HO F-3 B Unit'), { _tab: 'MTH HO', _era: 'mth_ho' }),
  // an MTH accessory whose variants happen to end in letters — NOT a Lionel A/B pair
  MTH('60-1051', 'ProtoSmoke Fluid - 12 Different Scents (36 Total)', 'Accessory'),
  MTH('60-1051C', 'Diesel ProtoSmoke Fluid', 'Diesel Locomotive'),
  // Lionel, the way the master files it
  PW('2343', 'A', 'P'), PW('2343T', 'A', 'D'), PW('2343C', 'B', 'C'),
];

// ── the real map + the real grouping, bound to one shared state ────────────
const HELPERS = ['normalizeItemNum', 'baseItemNum', 'rrMthUnitRole', 'buildPartnerMap', '_stripSuffix', '_getPartner',
  'getMatchingTenders', 'getBUnit', 'getAUnit', 'getADummyPartner', 'getSetPartner', 'getADummyUnit',
  'isF3AlcoUnit', 'getDieselConfigs', 'getGroupingOptions', 'applyGrouping'];
function buildWorld(src) {
  const names = HELPERS.slice();
  if (src.indexOf('function _mthGroupingOptions(') >= 0) names.push('_mthGroupingOptions');
  const st = { masterData: ROWS, companionData: [], setData: [], personalData: {}, wantData: {}, filters: {} };
  const code = names.map(n => grab(src, n)).join('\n') + '\nreturn { ' + names.join(', ') + ' };';
  const w = new Function('state', 'console', 'window', code)(st, { log() {}, warn() {} }, {});
  w.buildPartnerMap();
  return w;
}
const W = buildWorld(appjs);
const ids = (w, n) => w.getGroupingOptions(n).map(b => b.id).join(',');
const labels = (w, n) => w.getGroupingOptions(n).map(b => b.label).join(' | ');

// ── the save's numbering, lifted (wizard-save.js) ──────────────────────────
function saveNumbersFrom(saveSrc) {
  const a = saveSrc.indexOf('const _pdSuffix = (raw, power) => {');
  const b = saveSrc.indexOf('const itemNum = _pdSuffix(_rawItemNum, d.unitPower);');
  if (a < 0 || b < 0) throw new Error('save numbering not found');
  const defs = saveSrc.slice(a, b);
  const hasHelper = /_unit2PowerOf/.test(defs);
  return new Function('d', '_rawItemNum', defs + '\n'
    + 'var u2p = ' + (hasHelper ? '_unit2PowerOf(d)' : "(d.setType === 'AA' ? 'Dummy' : '')") + ';\n'
    + 'var out = [_pdSuffix(_rawItemNum, d.unitPower)];\n'
    + 'if (d.setMatch === "set-now" && d.unit2ItemNum) { out.push(_pdSuffix(String(d.unit2ItemNum).trim(), u2p));\n'
    + '  if (d.setType === "ABA") out.push(_pdSuffix(String(d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power)); }\n'
    + 'return out;');
}
const saveNums = saveNumbersFrom(wsave);
function addAs(w, num, grp, saver) {
  const d = {};
  w.applyGrouping(d, grp, num);
  return { d, nums: (saver || saveNums)(d, num) };
}

section('A · the set question an MTH engine gets');
ok('20-20943-1 (powered A with a B unit and a non-powered A): A only / AA / AB / ABA',
   ids(W, '20-20943-1') === 'single,aa,ab,aba' && labels(W, '20-20943-1') === 'A unit only | AA set | AB set | ABA set', labels(W, '20-20943-1'));
ok('20-2222-1 (engine named by its model, a B unit only): A only / AB — no AA, no ABA',
   ids(W, '20-2222-1') === 'single,ab', labels(W, '20-2222-1'));
ok('20-2050-1 (an AA set under one number): AA set only / AA set + B unit',
   ids(W, '20-2050-1') === 'single,ab' && labels(W, '20-2050-1') === 'AA set only | AA set + B unit', labels(W, '20-2050-1'));
ok('…every variant of that AA set gets the same question (-0 / -1 / -2)',
   ['20-2050-0', '20-2050-1', '20-2050-2'].every(n => ids(W, n) === 'single,ab'));
ok('20-2160-1 (an AB set under one number): AB set only / AB set + second A unit',
   ids(W, '20-2160-1') === 'single,aa' && labels(W, '20-2160-1') === 'AB set only | AB set + second A unit', labels(W, '20-2160-1'));
ok('the HO tab works the same (80-2001-1 AA set → + B unit)', ids(W, '80-2001-1') === 'single,ab');
ok('an ABA set under one number gets NO question (it is complete)', ids(W, '20-20341-1') === '');
ok('a B unit or a non-powered A on its own gets no question (same as Lionel)',
   ['20-2050-3', '20-20943-3', '20-20943-4', '20-2101-3', '20-2160-3'].every(n => ids(W, n) === ''));
ok('a hood unit and its dummy twin are not a cab-unit family — no question', ids(W, '20-20087-1') === '');
ok('MTH smoke fluid (60-1051) is not a diesel — no question', ids(W, '60-1051') === '');
ok('isDiesel / configs stay Lionel\'s — an MTH engine is NOT flagged (the want-list rule)',
   ['20-20943-1', '20-2050-1', '20-2160-1'].every(n => !W.isF3AlcoUnit(n) && W.getDieselConfigs(n).length === 0));

section('B · the chosen set names the real partners');
let r = addAs(W, '20-20943-1', 'aba');
ok('ABA on 20-20943-1 → B unit 20-20943-3, second A 20-20943-4', r.d.unit2ItemNum === '20-20943-3' && r.d.unit3ItemNum === '20-20943-4' && r.d.setType === 'ABA' && r.d.setMatch === 'set-now', JSON.stringify(r.d));
r = addAs(W, '20-20943-1', 'aa');
ok('AA on 20-20943-1 → second A 20-20943-4', r.d.unit2ItemNum === '20-20943-4' && r.d.setType === 'AA');
r = addAs(W, '20-20943-1', 'ab');
ok('AB on 20-20943-1 → B unit 20-20943-3', r.d.unit2ItemNum === '20-20943-3' && r.d.setType === 'AB');
r = addAs(W, '20-2050-1', 'ab');
ok('AA set + B unit on 20-2050-1 → 20-2050-3', r.d.unit2ItemNum === '20-2050-3');
r = addAs(W, '20-2160-1', 'aa');
ok('AB set + second A on 20-2160-1 → 20-2160-3', r.d.unit2ItemNum === '20-2160-3');
r = addAs(W, '20-20943-1', 'single');
ok('"A unit only" adds just the one unit', r.d._itemGrouping === 'single' && !r.d.setMatch && r.nums.join() === '20-20943-1');

section('C · MTH numbers are saved exactly as the catalog prints them');
ok('ABA saves 20-20943-1, 20-20943-3, 20-20943-4 — no -P / -D anywhere', addAs(W, '20-20943-1', 'aba').nums.join() === '20-20943-1,20-20943-3,20-20943-4', addAs(W, '20-20943-1', 'aba').nums.join());
ok('AA saves 20-20943-1 + 20-20943-4', addAs(W, '20-20943-1', 'aa').nums.join() === '20-20943-1,20-20943-4', addAs(W, '20-20943-1', 'aa').nums.join());
ok('AB saves 20-20943-1 + 20-20943-3', addAs(W, '20-20943-1', 'ab').nums.join() === '20-20943-1,20-20943-3');
ok('AB set + second A saves 20-2160-1 + 20-2160-3 (no -D)', addAs(W, '20-2160-1', 'aa').nums.join() === '20-2160-1,20-2160-3', addAs(W, '20-2160-1', 'aa').nums.join());
ok('AA set + B unit saves 20-2050-1 + 20-2050-3', addAs(W, '20-2050-1', 'ab').nums.join() === '20-2050-1,20-2050-3');
{
  const d = {}; W.applyGrouping(d, 'aa', '20-20943-1'); W.applyGrouping(d, 'ab', '20-20943-1');
  ok('changing your mind (AA → AB) leaves no "Dummy" on the B unit', d.unit2Power === '' && saveNums(d, '20-20943-1').join() === '20-20943-1,20-20943-3');
}

section('D · Lionel is unchanged');
ok('2343 still offers A Powered / A Dummy / AA / AB / ABA', ids(W, '2343') === 'a_powered,a_dummy,aa,ab,aba', ids(W, '2343'));
ok('2343 ABA saves 2343-P, 2343C, 2343T-D', addAs(W, '2343', 'aba').nums.join() === '2343-P,2343C,2343T-D', addAs(W, '2343', 'aba').nums.join());
ok('2343 AA saves 2343-P, 2343T-D', addAs(W, '2343', 'aa').nums.join() === '2343-P,2343T-D', addAs(W, '2343', 'aa').nums.join());
ok('2343 AB saves 2343-P, 2343C', addAs(W, '2343', 'ab').nums.join() === '2343-P,2343C');
ok('2343 A Powered / A Dummy save 2343-P / 2343-D', addAs(W, '2343', 'a_powered').nums.join() === '2343-P' && addAs(W, '2343', 'a_dummy').nums.join() === '2343-D');
let OLD_APP = '', OLD_SAVE = '';
try {
  OLD_APP = execSync('git show 3fadeea:app/app.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString();
  OLD_SAVE = execSync('git show 3fadeea:app/wizard-save.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).toString();
} catch (e) {}
if (OLD_APP && OLD_SAVE) {
  const O = buildWorld(OLD_APP), oldSave = saveNumbersFrom(OLD_SAVE);
  ok('every Lionel grouping saves the SAME numbers as v1847', ['a_powered', 'a_dummy', 'aa', 'ab', 'aba', 'single'].every(g =>
    addAs(W, '2343', g).nums.join() === addAs(O, '2343', g, oldSave).nums.join()) && ids(W, '2343') === ids(O, '2343'));
} else console.log('  (v1847 not in this checkout — the old-vs-new Lionel comparison is skipped)');

section('E · one door for the second unit\'s power');
ok('the save reads the second unit\'s power through _unit2PowerOf, in both places',
   (wsave.match(/_unit2PowerOf\(d\)/g) || []).length === 2 && !/setType === 'AA' \? 'Dummy'/.test(wsave.replace(/const _unit2PowerOf[^\n]*\n/, '')));
ok('applyGrouping states unit2Power / unit3Power on every choice', /data\.unit2Power = ''; data\.unit3Power = '';\s*\n/.test(grab(appjs, 'applyGrouping')));

section('F · planted offenders are caught');
if (OLD_APP) {
  const O = buildWorld(OLD_APP);
  ok('F1 v1847: an MTH A unit gets NO set question — reproduced', ids(O, '20-20943-1') === '' && ids(O, '20-2050-1') === '');
}
{
  // F2 — the MTH power wipe removed: the lead is saved as 20-20943-1-P
  const src = appjs.replace("if (_mp && _mp.mthRole) { data.unitPower = ''; data.unit2Power = ''; data.unit3Power = ''; }", '');
  const X = buildWorld(src);
  ok('F2 without the MTH power wipe the save writes a number that does not exist', src !== appjs && /-P/.test(addAs(X, '20-20943-1', 'aba').nums.join()), addAs(X, '20-20943-1', 'aba').nums.join());
}
if (OLD_SAVE) {
  // F3 — the old save rule: AB set + second A gets -D
  const n = addAs(W, '20-2160-1', 'aa', saveNumbersFrom(OLD_SAVE)).nums.join();
  ok('F3 v1847\'s save rule writes 20-2160-3-D — reproduced', n === '20-2160-1,20-2160-3-D', n);
}
{
  // F4 — a guessed partner (Lionel's +C) instead of the map's: caught
  const src = appjs.replace("if (b) out.push({ id: 'ab', label: 'AB set' });", "out.push({ id: 'ab', label: 'AB set' });");
  ok('F4 a guessed AB (no B unit in the family) is caught on an engine with only a second A', (function () {
    const rows2 = ROWS.concat([MTH('20-9999-1', 'Test Road O Scale Premier F-3 A Unit Diesel Engine'), MTH('20-9999-4', 'Test Road O Scale Premier F-3 A Unit (Non-Powered)')]);
    const st = { masterData: rows2, companionData: [], setData: [], personalData: {}, wantData: {}, filters: {} };
    const names = HELPERS.concat(['_mthGroupingOptions']);
    const mk = (s) => { const w = new Function('state', 'console', 'window', names.map(n => grab(s, n)).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(st, { log() {}, warn() {} }, {}); w.buildPartnerMap(); return w; };
    return ids(mk(appjs), '20-9999-1') === 'single,aa' && ids(mk(src), '20-9999-1') !== 'single,aa';
  })());
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
