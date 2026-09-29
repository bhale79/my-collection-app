// ═══════════════════════════════════════════════════════════════════════════
// want_partner_mth_tests.js — v0.9.1840 (roadmap 4.26)
//
// "Want List partner detection for MTH ABA sets (engine A → engine B → engine
// A). Currently only suggests Lionel tender pairings." — ROADMAP_brainstorm_
// session_120.md, Tier 4.26; [stated] Brad 2026-09-29: "do 4.26".
//
// MTH sells a cab-unit family under ONE base number with a suffix per piece,
// and its Unit / Powered-Dummy columns are blank on every MTH tab — the words
// are the only thing that say which piece a row is. Measured on the live MTH O
// tab 2026-09-29 (32,080 rows): 20-2050-0/-1/-2 "F-3 AA Diesel Set" + 20-2050-3
// "F-3 B-Unit"; 20-20943-1 "F-3 A Unit … w/Proto-Sound 3.0" + -3 "B-Unit
// (Non-Powered)" + -4 "(Non-Powered …)"; "EMD E6 A-B-A Diesel Engine Set"
// spelled with hyphens; 30 families of B units alone whose engine lives under
// another number.
//
// These tests run the REAL buildPartnerMap (app.js) on rows copied from that
// tab (plus a Lionel 2343 family, so nothing Lionel regresses), then the REAL
// _checkWantPartners (app-collection.js) through the REAL lookup helpers, and
// read what the pop-up offers. Section F plants five old shapes and each must
// go red.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
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
const appjs = APP('app.js'), coll = APP('app-collection.js'), wsave = APP('wizard-save.js');

// ── the rows, as the live tabs spell them ───────────────────────────────────
const MTH = (num, desc, type) => ({ _tab: 'MTH O', _era: 'mth_o', itemNum: num, description: desc, itemType: type || 'Diesel Locomotive', subType: '', unit: '', poweredDummy: '', roadName: desc.split(' O Scale')[0].indexOf(' ') > 0 && /O Scale/.test(desc) ? desc.split(' O Scale')[0] : '', manufacturer: 'MTH' });
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
const BY_NUM = {}; ROWS.forEach(r => { BY_NUM[r.itemNum] = r; });

// ── the real map + the real helpers, bound to one shared state ─────────────
const state = { masterData: ROWS, companionData: [], setData: [], personalData: {}, wantData: {}, personalSheetId: 'x' };
const HELPERS = ['normalizeItemNum', 'baseItemNum', 'rrMthUnitRole', 'buildPartnerMap', '_stripSuffix', '_getPartner', 'isTender', 'isLocomotive',
  'getMatchingTenders', 'getMatchingLocos', 'getBUnit', 'getAUnit', 'getADummyPartner', 'getAUnits', 'getSetPartner', 'getADummyUnit', 'foldWantEntries'];
function buildWorld(src) {
  const code = HELPERS.map(n => grab(src, n)).join('\n') + '\nreturn { ' + HELPERS.join(', ') + ' };';
  return new Function('state', 'console', 'window', code)(state, { log() {}, warn() {} }, {});
}
const W = buildWorld(appjs);
W.buildPartnerMap();
const map = state.partnerMap;

section('A · rrMthUnitRole reads the piece off the words');
const role = (d, t) => W.rrMthUnitRole(d, t || 'Diesel Locomotive');
ok('AA set, ABA set (both spellings), AB set', role('F-3 AA Diesel Set').role === 'aa-set' && role('F-3 ABA Diesel Set').role === 'aba-set' && role('EMD E6 A-B-A Diesel Engine Set', 'Set').role === 'aba-set' && role('F-3 AB Diesel Set').role === 'ab-set');
ok('B unit in every spelling — "B-Unit", "B Unit", "Powered B Unit"', role('F-3 B-Unit - 3 Rail Powered').role === 'b' && role('DL-110 Powered B Unit Diesel Engine').role === 'b' && role('F-7 B-Unit Diesel (Non-Powered)').role === 'b');
ok('a powered A unit, and a non-powered second A', role('F-3 A Unit Diesel Engine w/Proto-Sound 3.0').role === 'a' && role('F-3 A Unit (Non-Powered)').role === 'a-dummy' && !role('F-3 A Unit (Non-Powered)').inferred);
ok('a locomotive with no unit words is an INFERRED engine (or inferred dummy when non-powered)',
   role('DL-109 Diesel Engine w/Proto-Sound').role === 'a' && role('DL-109 Diesel Engine w/Proto-Sound').inferred && role('Diesel Engine (Non-Powered Hi-Rail').role === 'a-dummy' && role('Diesel Engine (Non-Powered Hi-Rail').inferred);
ok('a train set is nothing to pair; a boxcar is nothing at all', role('Freight Express F7 Train Set', 'Set').role === '' && role('40\' Box Car', 'Freight Car').role === '');

section('B · the map wires MTH families like Lionel ones');
const e = n => map[n] || {};
ok('the AA set (all three variants) gets the family\'s B unit, and NO second A (it already has both As)',
   e('20-2050-0').bUnit === '20-2050-3' && e('20-2050-1').bUnit === '20-2050-3' && e('20-2050-2').bUnit === '20-2050-3' && !e('20-2050-1').dummyA);
ok('…and the B unit pairs with ALL THREE variants (aUnit = the first, aUnits = every one)',
   e('20-2050-3').aUnit === '20-2050-0' && e('20-2050-3').aUnits.join() === '20-2050-0,20-2050-1,20-2050-2', JSON.stringify(e('20-2050-3')));
ok('the powered A gets its B unit AND its second A — the truncated "(Non-Powered" row counts because the family names a B unit outright',
   e('20-20943-1').bUnit === '20-20943-3' && e('20-20943-1').dummyA === '20-20943-4');
ok('…and the B unit and the second A both point back at the powered A', e('20-20943-3').aUnit === '20-20943-1' && e('20-20943-4').aUnit === '20-20943-1');
ok('an engine named only by its model pairs with its powered B unit (DL-109 ↔ DL-110)', e('20-2222-1').bUnit === '20-2222-3' && e('20-2222-3').aUnit === '20-2222-1');
ok('an ABA set is complete — nothing wired, and its spare B unit has no partner', !e('20-20341-1').bUnit && !e('20-20341-1').dummyA && !e('20-20341-3').aUnit);
ok('a hood unit and its dummy twin are NOT wired (no B unit in the family)', !e('20-20087-1').dummyA && !e('20-20087-3').aUnit);
ok('a train set is not an engine — its lone B unit stays unpaired', !e('20-20612-1').bUnit && !e('20-20612-3').aUnit);
ok('a B unit alone is left alone (its engine lives under another number)', !e('20-2101-3').aUnit);
ok('Lionel\'s +C convention no longer fires on MTH: the smoke-fluid 60-1051 has NO "B unit" 60-1051C (21 such false pairs measured live before v1840)',
   !e('60-1051').bUnit && !e('60-1051C').aUnit);
ok('an AB set gets the second A and NO B unit (it already has its B)', e('20-2160-1').dummyA === '20-2160-3' && !e('20-2160-1').bUnit && e('20-2160-3').aUnit === '20-2160-1');
ok('the rule spans MTH tabs (HO)', e('80-2001-1').bUnit === '80-2001-3' && e('80-2001-3').aUnit === '80-2001-1');
ok('MTH rows get NO isDiesel / configs — the wizard\'s AA/AB/ABA questions are unchanged by this release',
   ['20-2050-1', '20-20943-1', '20-2222-1', '20-2160-1'].every(n => !e(n).isDiesel && (e(n).configs || []).length === 0));
ok('Lionel is unchanged AND its second A is filed: 2343 → B 2343C, second A 2343T, configs AB + AA + ABA',
   e('2343').bUnit === '2343C' && e('2343').dummyA === '2343T' && e('2343').isDiesel && ['AA', 'AB', 'ABA'].every(c => e('2343').configs.indexOf(c) >= 0), JSON.stringify(e('2343')));
ok('…2343T and 2343C point back at 2343', e('2343T').aUnit === '2343' && e('2343C').aUnit === '2343');
ok('getADummyUnit (the wizard\'s) reads the map first: 2343 → 2343T, 20-20943-1 → 20-20943-4', W.getADummyUnit('2343') === '2343T' && W.getADummyUnit('20-20943-1') === '20-20943-4');
ok('getAUnits: one for Lionel, three for the MTH B unit, none for an engine', W.getAUnits('2343C').join() === '2343' && W.getAUnits('20-2050-3').length === 3 && W.getAUnits('2343').length === 0);

section('C · the want list folds the second A into its engine');
const folded = W.foldWantEntries([{ itemNum: '20-20943-1' }, { itemNum: '20-20943-3' }, { itemNum: '20-20943-4' }, { itemNum: '2343' }, { itemNum: '2343T' }, { itemNum: '2343C' }]);
ok('MTH: the engine keeps the row; its B unit and second A fold in', folded.length === 2 && (folded[0]._wantMates || []).join() === '20-20943-3,20-20943-4', JSON.stringify(folded.map(f => [f.itemNum, f._wantMates])));
ok('Lionel: 2343 absorbs 2343C and 2343T', (folded[1]._wantMates || []).slice().sort().join() === '2343C,2343T', JSON.stringify(folded[1]._wantMates));

// ── D · the REAL pop-up, through the REAL helpers ───────────────────────────
section('D · the Add-partner pop-up offers the whole set');
const built = [], appended = [], lookups = [];
const doc = { createElement() { return { style: {}, _h: '', set innerHTML(v) { this._h = v; built.push(v); }, get innerHTML() { return this._h; }, querySelector() { return { onclick: null }; }, remove() {} }; }, body: { appendChild() {} } };
function makeCheck(src, world) {
  const names = ['state', 'document', 'window', 'BackStack', 'console', 'normalizeItemNum', 'isLocomotive', 'isTender', 'getMatchingTenders', 'getMatchingLocos', 'getBUnit', 'getAUnit', 'getADummyPartner', 'getAUnits', 'findMaster', '_brandOfItem', '_getEraManufacturer', 'sheetsAppend', 'showToast', 'buildWantPage', 'buildDashboard', 'loadPersonalData', '_cachePersonalData'];
  const vals = [state, doc, { BackStack: { wire() {} } }, { wire() {} }, { warn() {}, log() {} }, world.normalizeItemNum, world.isLocomotive, world.isTender, world.getMatchingTenders, world.getMatchingLocos, world.getBUnit, world.getAUnit, world.getADummyPartner, world.getAUnits,
    (n, v, hint) => { lookups.push({ n, hint }); return BY_NUM[n] || null; }, (x) => (x && typeof x === 'object') ? (x.manufacturer || 'Lionel') : 'Lionel', () => 'Lionel', async () => 1, () => {}, () => {}, () => {}, async () => {}, () => {}];
  return new Function(...names, grab(src, '_checkWantPartners') + '\nreturn _checkWantPartners;')(...vals);
}
const check = makeCheck(coll, W);
function own(...nums) { state.personalData = {}; nums.forEach((n, i) => { state.personalData['inv' + i] = { owned: true, itemNum: n, variation: '' }; }); }
function want(...nums) { state.wantData = {}; nums.forEach(n => { state.wantData[n + '|'] = { itemNum: n }; }); }
function run(num, mfr) { built.length = 0; lookups.length = 0; check(num, '', 'Medium', '', '', mfr || 'MTH'); return built.length ? built[built.length - 1] : ''; }
function listed(html) { return (html.match(/font-weight:600;color:var\(--accent\)">([^<]+)</g) || []).map(m => m.replace(/.*">/, '').replace('<', '')); }
function labels(html) { return (html.match(/color:var\(--text-dim\)">([^<]+)</g) || []).map(m => m.replace(/.*">/, '').replace('<', '')); }

own(); want();
let html = run('20-20943-1');
ok('an MTH powered A: the pop-up offers its B unit AND its second A', listed(html).join() === '20-20943-3,20-20943-4', listed(html).join());
ok('…with the set wording', /do you also want the B unit and the second A unit\?/.test(html));
ok('…each labelled with the catalog\'s own words (road name dropped)', /B unit — F-3 B-Unit Diesel \(Non-Powered\)/.test(html) && /second A unit, non-powered — Diesel Engine \(Non-Powered Hi-Rail/.test(html), labels(html).join(' | '));
ok('…and every catalog lookup for the labels carried the want\'s maker as its hint', lookups.length >= 2 && lookups.every(l => l.hint && l.hint.manufacturer === 'MTH'), JSON.stringify(lookups.slice(0, 2)));
html = run('20-2050-1');
ok('an MTH AA set: offers the B unit only (the set already has both As)', listed(html).join() === '20-2050-3' && /do you also want the B unit\?/.test(html), listed(html).join());
html = run('20-2050-3');
ok('an MTH B unit: offers EVERY variant of the AA set it fits, each told apart by its words',
   listed(html).join() === '20-2050-0,20-2050-1,20-2050-2' && /3 Rail Horn/.test(html) && /With Proto-Sound/.test(html) && /2 Rail/.test(html), listed(html).join());
ok('…with the pick-one wording', /sold in more than one version — pick the one you want/.test(html));
html = run('20-20943-4');
ok('an MTH second A: offers its powered A', listed(html).join() === '20-20943-1' && /This is a B unit — do you also want the A unit\?|do you also want the A unit/.test(html), listed(html).join());
html = run('20-2222-3');
ok('the DL-110 powered B unit offers its DL-109', listed(html).join() === '20-2222-1');
ok('an ABA set: nothing to offer, no pop-up', run('20-20341-1') === '');
ok('a B unit alone: nothing to offer, no pop-up', run('20-2101-3') === '');
ok('a hood unit: no pop-up (never wired)', run('20-20087-1') === '');
html = run('20-2160-1');
ok('an AB set: offers the second A only', listed(html).join() === '20-2160-3' && /do you also want the second A unit\?/.test(html));
// the v1740 rule holds for MTH
own('20-20943-3'); want();
ok('v1740 rule: owning the B unit already → the engine gets no pop-up at all', run('20-20943-1') === '');
own('20-2050-2'); want();
ok('…owning ANY variant of the AA set → the B unit gets no pop-up', run('20-2050-3') === '');
own(); want('20-20943-3');
html = run('20-20943-1');
ok('a partner already on the Want List is left off, the other still offered', listed(html).join() === '20-20943-4');
// Lionel through the same code
own(); want();
html = run('2343', 'Lionel');
ok('Lionel 2343: offers the B unit 2343C AND the second A 2343T', listed(html).join() === '2343C,2343T', listed(html).join());
html = run('2343T', 'Lionel');
ok('Lionel 2343T (the second A): offers 2343', listed(html).join() === '2343');
own('2343-C'); want();
ok('Lionel: owning the B unit (app spelling) still silences the 2343 pop-up', run('2343', 'Lionel') === '');

section('E · wiring');
ok('the wizard hands the want\'s maker to the prompt', /_checkWantPartners\(itemNum, variation, _wPriority, _wPrice, _wNotes, _wMfr\)/.test(wsave));
ok('the partner row\'s brand comes from its own catalog row (found with the hint), the number-only lookup only as the fallback',
   /_brandOfItem\(_pRow \|\| c\.itemNum\)/.test(grab(coll, '_checkWantPartners')));
ok('the map\'s entries carry dummyA and aUnits', /dummyA:'', aUnits:\[\]/.test(grab(appjs, 'buildPartnerMap')));

// ── F · planted offenders ───────────────────────────────────────────────────
section('F · planted offenders — each old shape must go red');
function worldFrom(src) { const st = { masterData: ROWS, companionData: [], setData: [], personalData: {}, wantData: {}, personalSheetId: 'x' }; const code = HELPERS.map(n => grab(src, n)).join('\n') + '\nreturn { ' + HELPERS.join(', ') + ' };'; const w = new Function('state', 'console', 'window', code)(st, { log() {}, warn() {} }, {}); w.buildPartnerMap(); return { w, st }; }
{
  // 1. the role reader blind to every MTH row
  const o = appjs.replace("  const d = String(desc || '');\n  const np = /non-?powered|unpowered|dummy/i.test(d);", "  return { role: '', inferred: false };\n  const d = String(desc || '');\n  const np = /non-?powered|unpowered|dummy/i.test(d);");
  ok('offender 1 changed the source', o !== appjs);
  const { w } = worldFrom(o);
  ok('OFFENDER 1: no MTH roles → the MTH engine has no B unit (section B red), Lionel untouched', !w.getBUnit('20-20943-1') && w.getBUnit('2343') === '2343C');
}
{
  // 2. the ABA spelling without the hyphen form
  const o = appjs.replace("if (/\\bA-?B-?A\\b/i.test(d)) return { role: 'aba-set', inferred: false };", "if (/\\bABA\\b/i.test(d)) return { role: 'aba-set', inferred: false };");
  ok('offender 2 changed the source', o !== appjs);
  const { w } = worldFrom(o);
  ok('OFFENDER 2: "A-B-A" read as an AB set → the complete set\'s spare B unit gets a partner it must not have', w.getAUnit('20-20341-3') === '20-20341-1');
}
{
  // 3. the inferred-role guard removed
  const o = appjs.replace("    const live = members.filter(x => !x.inferred || explicitB);", "    const live = members;");
  ok('offender 3 changed the source', o !== appjs);
  const { w } = worldFrom(o);
  ok('OFFENDER 3: without the guard the hood unit\'s dummy twin is wired as a second A → section B red', w.getADummyPartner('20-20087-1') === '20-20087-3');
}
{
  // 4. the pop-up back to "B unit only" for an A unit
  const o = coll.replace("    if (dummyA && !state.wantData[dummyA + '|']) candidates.push({ itemNum: dummyA, label: dummyA + ' (second A unit, non-powered' + _w(dummyA) + ')' });\n", "");
  ok('offender 4 changed the source', o !== coll);
  const c4 = makeCheck(o, W); own(); want(); built.length = 0; c4('2343', '', 'Medium', '', '', 'Lionel');
  ok('OFFENDER 4: the second A dropped from the pop-up → the 2343 check goes red', listed(built[built.length - 1] || '').join() !== '2343C,2343T');
}
{
  // 5. a B unit offering one variant instead of every one
  const o = coll.replace("    partners = aUnits.slice();", "    partners = aUnits.slice(0, 1);");
  ok('offender 5 changed the source', o !== coll);
  const c5 = makeCheck(o, W); own(); want(); built.length = 0; c5('20-2050-3', '', 'Medium', '', '', 'MTH');
  ok('OFFENDER 5: one AA variant offered instead of three → the B-unit check goes red', listed(built[built.length - 1] || '').length !== 3);
}

{
  // 6. the Lionel +C convention let loose on every tab again
  const o = appjs.replace("    if (String(m._tab || '').toLowerCase().indexOf('lionel') !== 0) return;\n    const num = normalizeItemNum(m.itemNum);\n    const pdMatch", "    const num = normalizeItemNum(m.itemNum);\n    const pdMatch");
  ok('offender 6 changed the source', o !== appjs);
  const { w } = worldFrom(o);
  ok('OFFENDER 6: +C on every tab → the smoke fluid gets a "B unit" again → red', w.getBUnit('60-1051') === '60-1051C');
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
