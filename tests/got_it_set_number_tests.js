// ═══════════════════════════════════════════════════════════════════════════
// got_it_set_number_tests.js — 2026-11-27 (gotitp, PLAN_2026-11-26_GOT_IT_DOUBLE_P.md)
//
// [stated] Brad 2026-11-26 20:59 CT "Yes" (write the plan) → 2026-11-27 09:21 CT "go".
//
// What was wrong (live v0.9.2169, hand-test T-2026-11-26-02 FAILED): Got It on
// a Want-list AA set (2343) saved the powered unit as "2343-P-P". The Want row
// keeps the lead as "2343-P"; Got It handed that number to the Add screen
// unchanged, and the save puts -P on a set's lead itself — so it went on twice.
// The Upgrade list's Got It handed its number over the same way.
//
// THE RULES THIS SUITE PROTECTS:
//   1. Got It on a SET (AA / AB / ABA), from the Want list or the Upgrade list,
//      starts the Add screen from the bare number (2343) — where a normal add
//      starts — so it saves exactly what a normal add saves (2343-P, 2343C,
//      2343T-D).
//   2. A single piece, an engine + tender, and a number whose last P is not a
//      power mark (RK-2005LP) are handed over untouched.
//   3. The save's ONE suffix rule never adds -P to a number that already ends
//      in -P, nor -D to one ending in -D.
//   4. The Want row's own key (2343-P|) is kept, so the right row comes off.
// Everything runs the REAL code lifted out of app-pages.js and wizard-save.js.
// Section P plants the old shapes back, one at a time; each must go red.
//
// Run: node tests/got_it_set_number_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
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
const SRC = { pages: APP('app-pages.js'), save: APP('wizard-save.js'), app: APP('app.js') };

// ── the catalog rows (as the Postwar tab files the 2343 family) ─────────────
const PW = (num, unit, pd) => ({ _tab: 'Lionel PW - Items', _era: 'pw', itemNum: num, description: 'F3 Diesel', itemType: 'Diesel Locomotive', unit, poweredDummy: pd, roadName: 'Santa Fe' });
const ROWS = [PW('2343', 'A', 'P'), PW('2343T', 'A', 'D'), PW('2343C', 'B', 'C'), PW('2046', '', ''), PW('6520', '', '')];

// The real normalizers from app.js.
const NORM = new Function(grab(SRC.app, 'normalizeItemNum') + '\n' + grab(SRC.app, 'baseItemNum') + '\nreturn { normalizeItemNum, baseItemNum };')();

// ── the save's numbering: the REAL _pdSuffix + _unit2PowerOf from wizard-save.js ──
function saveNumbers(saveSrc) {
  const a = saveSrc.indexOf('const _pdSuffix = (raw, power) => {');
  const b = saveSrc.indexOf('const itemNum = _pdSuffix(_rawItemNum, d.unitPower);');
  if (a < 0 || b < 0 || b < a) throw new Error('could not find the save numbering');
  const block = saveSrc.slice(a, b);
  const fn = new Function('d', '_normalizeEnteredItemNum',
    'const _rawItemNum = _normalizeEnteredItemNum(d.itemNum || d.set_num || "");\n' + block
    + 'var u2p = _unit2PowerOf(d);\n'
    + 'var out = [_pdSuffix(_rawItemNum, d.unitPower)];\n'
    + 'if (d.setMatch === "set-now" && d.unit2ItemNum) { out.push(_pdSuffix(String(d.unit2ItemNum).trim(), u2p));\n'
    + '  if (d.setType === "ABA") out.push(_pdSuffix(String(d.unit3ItemNum || _rawItemNum).trim(), d.unit3Power)); }\n'
    + 'return { nums: out, pd: _pdSuffix };');
  const norm = grab(saveSrc, '_normalizeEnteredItemNum');
  const normFn = new Function(norm + '\nreturn _normalizeEnteredItemNum;')();
  return d => fn(d, normFn);
}

// ── the shared partner finder + seeding from app-pages.js ───────────────────
function shared(pagesSrc) {
  const state = { masterData: ROWS, companionData: [{ engineNum: '2046', companionNum: '2046W', companionType: 'Tender' }] };
  const names = ['_wcNorm', '_wcPartnersOf', '_wcSeedGrouping'];
  const code = names.map(n => grab(pagesSrc, n)).join('\n') + '\nreturn { _wcNorm, _wcPartnersOf, _wcSeedGrouping };';
  return new Function('state', 'normalizeItemNum', 'baseItemNum', 'genSetId', code)(state, NORM.normalizeItemNum, NORM.baseItemNum, n => 'set-' + n);
}

// ── Got It itself: the REAL moveWantToCollection / upgradeGotIt on a stub page ──
function gotIt(pagesSrc, door, wantData, upgradeData, key, mates) {
  const H = shared(pagesSrc);
  const state = { masterData: ROWS, companionData: [], wantData: wantData || {}, upgradeData: upgradeData || {} };
  const wizard = { data: {}, steps: [], step: 0 };
  const fnName = door === 'want' ? 'moveWantToCollection' : 'upgradeGotIt';
  const run = new Function('state', 'wizard', 'openWizard', 'setTimeout', 'findMaster', '_partsOwnedRow', 'getSteps', 'renderWizardStep', 'showToast', 'eraForTab',
    '_wcNorm', '_wcPartnersOf', '_wcSeedGrouping', 'normalizeItemNum', 'baseItemNum',
    grab(pagesSrc, fnName) + '\nreturn ' + fnName + ';')(
    state, wizard, () => {}, f => f(), () => ROWS[0], () => null, () => [{ id: 'conditionDetails' }], () => {}, () => {}, () => 'pw',
    H._wcNorm, H._wcPartnersOf, H._wcSeedGrouping, NORM.normalizeItemNum, NORM.baseItemNum);
  if (door === 'want') run(key.split('|')[0], key.split('|')[1] || ''); else run(key, mates || '');
  return wizard.data;
}

function checks(srcs) {
  const r = {};
  const SAVE = saveNumbers(srcs.save);
  const H = shared(srcs.pages);

  // 1 · the seeding: a set's lead starts bare
  let d = { itemNum: '2343-P' }; H._wcSeedGrouping(d, '2343-P', '', '', '2343T');
  r.aaBare = d.itemNum === '2343' && d._itemGrouping === 'aa' && d.unit2ItemNum === '2343T';
  r.aaSaves = SAVE(d).nums.join() === '2343-P,2343T-D';
  d = { itemNum: '2343-P' }; H._wcSeedGrouping(d, '2343-P', '', '2343C', '');
  r.abSaves = d.itemNum === '2343' && SAVE(d).nums.join() === '2343-P,2343C';
  d = { itemNum: '2343-P' }; H._wcSeedGrouping(d, '2343-P', '', '2343C', '2343T');
  r.abaSaves = d.itemNum === '2343' && SAVE(d).nums.join() === '2343-P,2343C,2343T-D';
  // the same numbers a normal add of 2343 saves (pinned in mth_add_sets_tests)
  r.sameAsNormal = SAVE({ itemNum: '2343', unitPower: 'Powered', setMatch: 'set-now', setType: 'ABA', unit2ItemNum: '2343C', unit2Power: '', unit3ItemNum: '2343T', unit3Power: 'Dummy' }).nums.join() === '2343-P,2343C,2343T-D';
  // a catalog-form lead (2343P) starts bare too
  d = { itemNum: '2343P' }; H._wcSeedGrouping(d, '2343P', '', '', '2343T');
  r.catalogForm = d.itemNum === '2343' && SAVE(d).nums.join() === '2343-P,2343T-D';

  // 2 · untouched: single piece, engine + tender, an MTH number
  d = { itemNum: '2343-P' }; H._wcSeedGrouping(d, '2343-P', '', '', '');
  r.single = d.itemNum === '2343-P' && d._itemGrouping === 'single' && SAVE(d).nums.join() === '2343-P';
  d = { itemNum: '2046' }; H._wcSeedGrouping(d, '2046', '2046W', '', '');
  r.engineTender = d.itemNum === '2046' && d._itemGrouping === 'engine_tender' && d.tenderMatch === '2046W';
  const lead = n => { const x = { itemNum: n }; H._wcSeedGrouping(x, n, '', '', 'PARTNER'); return x.itemNum; };
  r.mthKept = lead('RK-2005LP') === 'RK-2005LP' && lead('30-2005-1') === '30-2005-1'
    && lead('2343-P') === '2343' && lead('2343-p') === '2343' && lead('2343P') === '2343' && lead(' 2343-P ') === '2343' && lead('6520') === '6520';

  // 3 · the save rule never doubles
  const pd = SAVE({ itemNum: 'x' }).pd;
  r.noDoubleP = pd('2343-P', 'Powered') === '2343-P' && pd('2343-p', 'Powered') === '2343-p';
  r.noDoubleD = pd('2343T-D', 'Dummy') === '2343T-D';
  r.catalogSpelling = pd('2343P', 'Powered') === '2343-P' && pd('2343p', 'Powered') === '2343-P' && pd('RK-2005LP', 'Powered') === 'RK-2005LP-P' && pd('2343T', 'Dummy') === '2343T-D';
  r.stillAdds = pd('2343', 'Powered') === '2343-P' && pd('2343T', 'Dummy') === '2343T-D' && pd('2343C', 'Powered') === '2343C' && pd('2343', '') === '2343';

  // 4 · Got It from the Want list (the real opener): bare lead, the want keys kept
  const want = { '2343-P|': { itemNum: '2343-P', variation: '', row: 11 }, '2343T|': { itemNum: '2343T', variation: '', row: 12 } };
  d = gotIt(srcs.pages, 'want', want, null, '2343-P|');
  r.wantDoor = d.itemNum === '2343' && d._fromWantKey === '2343-P|' && d._itemGrouping === 'aa'
    && (d._fromWantMateKeys || []).map(m => m.key).join() === '2343T|' && SAVE(d).nums.join() === '2343-P,2343T-D';
  // a single want piece (no partner on the list) keeps its number
  d = gotIt(srcs.pages, 'want', { '2343-P|': { itemNum: '2343-P', variation: '', row: 11 } }, null, '2343-P|');
  r.wantSingle = d.itemNum === '2343-P' && d._fromWantKey === '2343-P|' && SAVE(d).nums.join() === '2343-P';

  // 5 · Got It from the Upgrade list (the real opener): bare lead, its key kept
  const ug = { INV76: { itemNum: '2343-P', variation: '', row: 21, inventoryId: 'INV76' }, INV77: { itemNum: '2343T', variation: '', row: 22, inventoryId: 'INV77' } };
  d = gotIt(srcs.pages, 'upgrade', null, ug, 'INV76', 'INV77');
  r.upgradeDoor = d.itemNum === '2343' && d._fromUpgradeKey === 'INV76' && d._itemGrouping === 'aa' && SAVE(d).nums.join() === '2343-P,2343T-D';
  d = gotIt(srcs.pages, 'upgrade', null, { INV76: ug.INV76 }, 'INV76', '');
  r.upgradeSingle = d.itemNum === '2343-P' && SAVE(d).nums.join() === '2343-P';
  return r;
}

section('A · a set from Got It starts from the bare number and saves what a normal add saves');
const A = checks(SRC);
ok('AA: the seeding hands over 2343, not 2343-P', A.aaBare);
ok('AA: saves 2343-P + 2343T-D (never 2343-P-P)', A.aaSaves);
ok('AB: saves 2343-P + 2343C', A.abSaves);
ok('ABA: saves 2343-P + 2343C + 2343T-D', A.abaSaves);
ok('a normal add of 2343 ABA saves the same three numbers', A.sameAsNormal);
ok('a lead written the catalog way (2343P) starts bare too', A.catalogForm);

section('B · what is handed over untouched');
ok('a single piece keeps 2343-P and saves 2343-P', A.single);
ok('an engine + tender keeps its number (no power mark involved)', A.engineTender);
ok('only a P right after a digit is a power mark (RK-2005LP, 30-2005-1 kept)', A.mthKept);

section('C · the save rule never doubles a mark');
ok('-P is not added to a number already ending in -P', A.noDoubleP);
ok('-D is not added to a number already ending in -D', A.noDoubleD);
ok('a powered unit written the catalog way (2343P) saves as 2343-P, never 2343P-P (only a P right after a digit)', A.catalogSpelling);
ok('the marks are still added where they belong (2343 → 2343-P, 2343T → 2343T-D, 2343C, no power → as is)', A.stillAdds);

section('D · the two Got It doors, end to end');
ok('Want list: AA set → 2343 handed over, want keys 2343-P| + 2343T| kept, saves 2343-P + 2343T-D', A.wantDoor);
ok('Want list: a single 2343-P saves 2343-P', A.wantSingle);
ok('Upgrade list: AA set → 2343 handed over, its key kept, saves 2343-P + 2343T-D', A.upgradeDoor);
ok('Upgrade list: a single 2343-P saves 2343-P', A.upgradeSingle);

// ── P · planted offenders: each old shape must turn something red ───────────
section('P · planted offenders');
function planted(name, mutate, mustFail) {
  const srcs = mutate({ pages: SRC.pages, save: SRC.save });
  let r;
  try { r = checks(srcs); } catch (e) { r = null; }
  const caught = !!r && mustFail.some(k => !r[k]);   // a planted shape must run and go red, not just throw
  ok('planted: ' + name + ' → caught', caught, r ? JSON.stringify(mustFail.map(k => k + '=' + r[k])) : 'threw');
}
const OLD_SUFFIX = "const _pdSuffix = (raw, power) => {\n    if (!power || raw.endsWith('C')) return raw;\n    return raw + (power === 'Powered' ? '-P' : '-D');\n  };";
const curSuffix = SRC.save.slice(SRC.save.indexOf('const _pdSuffix = (raw, power) => {'), SRC.save.indexOf('};', SRC.save.indexOf('const _pdSuffix = (raw, power) => {')) + 2);
planted('the old save rule (adds -P to 2343-P)', s => ({ pages: s.pages, save: s.save.replace(curSuffix, OLD_SUFFIX) }), ['noDoubleP', 'noDoubleD']);
planted('a save rule that only knows the dashed -P (2343P → 2343P-P)', s => ({ pages: s.pages, save: s.save.replace("if (power === 'Powered' && /\\dP$/i.test(raw)) return raw.slice(0, -1) + '-P';", '') }), ['catalogSpelling']);
const seedStart = SRC.pages.indexOf('  if (!_wcTender && (_wcBunit || _wcDummy)) {');
const seedEnd = SRC.pages.indexOf('  }\n', seedStart) + 4;
planted('the old hand-off (the set lead keeps 2343-P)', s => ({ pages: s.pages.slice(0, seedStart) + s.pages.slice(seedEnd), save: s.save }), ['aaBare', 'abSaves', 'wantDoor', 'upgradeDoor']);
planted('both old (the live v0.9.2169 shape: 2343-P-P)', s => ({ pages: s.pages.slice(0, seedStart) + s.pages.slice(seedEnd), save: s.save.replace(curSuffix, OLD_SUFFIX) }), ['aaSaves', 'wantDoor']);
planted('a bare-lead rule that eats any last P (RK-2005LP → RK-2005L)', s => ({ pages: s.pages.replace("replace(/(\\d)-?P$/i, '$1')", "replace(/-?P$/i, '')"), save: s.save }), ['mthKept']);
planted('an Upgrade Got It that skips the shared seeding', s => ({ pages: s.pages.replace(
  "_wcSeedGrouping(wizard.data, itemNum, _ugIn(_ugP.tender), _ugIn(_ugP.bunit), _ugIn(_ugP.dummy));",
  "wizard.data._itemGrouping = 'aa'; wizard.data.unitPower = 'Powered'; wizard.data.setMatch = 'set-now'; wizard.data.setType = 'AA'; wizard.data.unit2ItemNum = _ugIn(_ugP.dummy); wizard.data.unit2Power = 'Dummy';"), save: s.save }), ['upgradeDoor']);
planted('a hand-off that also drops the want key\'s mark (the wrong row would come off)', s => ({ pages: s.pages.replace("wizard.data._fromWantKey = `${itemNum}|${variation}`;", "wizard.data._fromWantKey = `${String(itemNum).replace(/-P$/, '')}|${variation}`;"), save: s.save }), ['wantDoor']);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
