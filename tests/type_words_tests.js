#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// type_words_tests.js — v0.9.1844: the words the master-list audit found
//
// The first master-list audit (2026-09-30, MASTER_AUDIT_2026-09-30.md) counted
// 7,224 rows whose type the bucketer could not file, 4,525 rows whose gauge the
// reader could not read, and 7,157 rows dated outside their era's span. Three
// app-side fixes, each measured on the live master before and after (27,605 →
// 12,869 flags): the real getTypeBucket on the real words (A), the real
// _scalesOfGauge on the real spellings (B), the era spans as decided (C), and
// planted offenders for each (D). [stated] Brad: "yes" to the plan.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const SRC = f => fs.readFileSync(path.join(APP, f), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
function bucketer(src) { const w = {}; new Function('window', src)(w); return w; }
function gaugeReader(src) { return new Function(grab(src, '_scalesOfGauge') + '; return _scalesOfGauge;')(); }

const tg = SRC('type-groups.js'), app = SRC('app.js'), cfg = SRC('config.js');
const W = bucketer(tg);
const L = (t, d) => W.getTypeBucketLabel({ itemType: t, description: d || '' });
const G = gaugeReader(app);

// ── A ────────────────────────────────────────────────────────────────────
section('A · the type words, through the real bucketer');
T('A1  the same word in another case files the same — "Rolling stock", "diesel", "electric"',
  L('Rolling stock', "40' boxcar") === 'Boxcar' && L('diesel', 'GP-9') === 'Diesel' && L('electric', 'GG-1') === 'Electric');
T('A2  Lionel\'s HO rows: "HO Boxcar" → Boxcar, "HO - Tower" → Accessory, "HO Caboose - Work Caboose" → Caboose, "HO Ore Car" → Hopper',
  L('HO Boxcar') === 'Boxcar' && L('HO - Tower') === 'Accessory' && L('HO Caboose - Work Caboose') === 'Caboose' && L('HO Ore Car') === 'Hopper' && L('HO Accessory') === 'Accessory');
T('A3  …and "Hopper" is not mistaken for an HO prefix', L('Hopper') === 'Hopper' && L('Hopper - 2 Bay Hopper') === 'Hopper');
T('A4  "HO Locomotive": the description decides steam or diesel', L('HO Locomotive', 'GP-38 diesel') === 'Diesel' && L('HO Locomotive', '4-6-2 Pacific steam') === 'Steam');
T('A5  MTH\'s "Diesel/Electric Locomotive": Electric when the words say so, Diesel otherwise',
  L('Diesel/Electric Locomotive', 'GG-1 Electric') === 'Electric' && L('Diesel/Electric Locomotive', 'F-3 A Unit') === 'Diesel' && L('Diesel/Electric Locomotive', 'Dash-8 Diesel Engine') === 'Diesel');
T('A6  "Switcher": the words decide', L('Switcher', 'SW-1 diesel switcher') === 'Diesel' && L('Switcher', '0-4-0 steam switcher') === 'Steam');
T('A7  "Live steam" is Steam; "Diesel Superbass" and "F3 Unit" are Diesel', L('Live steam', 'K-27') === 'Steam' && L('Diesel Superbass') === 'Diesel' && L('F3 Unit') === 'Diesel');
T('A8  sets: Car Set, Train Set, Diesel ABA Set, R-T-R/Speciality Set', ['Car Set', 'Train Set', 'Diesel ABA Set', 'R-T-R/Speciality Set', 'HO Freight Set'].every(t => L(t) === 'Set'));
T('A9  motorized: Powered Rail Car, Speeder, Handcar, Gang Car, Budd Car', ['Powered Rail Car', 'Speeder', 'Handcar', 'Hand Car', 'Gang Car', 'Budd Car', 'Jet-Powered Rail Car'].every(t => L(t) === 'Motorized'));
T('A10 hoppers: Covered Hopper, Ore Car, Taconite Car (and the HO ones)', ['Covered Hopper', 'Ore Car', 'Taconite Car', 'HO Taconite Car'].every(t => L(t) === 'Hopper'));
T('A11 intermodal: TOFC Flatcar, Stack Car, Well Car, Intermodal Car', ['TOFC Flatcar', 'Stack Car', 'Well Car', 'Intermodal Car'].every(t => L(t) === 'Intermodal'));
T('A12 passenger: Streamliner, Heavyweight (both spellings), Vista Dome, Combine, Diner, Sleeper, Mail, Express',
  ['Streamliner Car', 'Heavyweight Car', 'Heaveyweight Car', 'Full Vista Dome Car', 'Combination Car', 'Combine Car', 'Dining Car', 'Sleeping Car', 'Mail Car', 'Express Car', 'HO Coach Car'].every(t => L(t) === 'Passenger'));
T('A13 operating: Aquarium, Missile, Cannon, Helicopter, Generator, Welding, TV, Sound, Exhibit',
  ['Aquarium Car', 'Missile Car', 'Cannon Car', 'Helicopter Car', 'Generator Car', 'Welding Car', 'TV Car', 'Sound Car', 'Exhibit Car', 'HO Aquarium Car'].every(t => L(t) === 'Operating'));
T('A14 accessories: Bridge, Water Tower, Tower, Platform, Tunnel, Signal, Catenary, Vehicles, Trucks, Diorama',
  ['Bridge', 'Water Tower', 'Tower', 'Platform', 'Tunnel', 'Signal', 'Catenary', 'Vehicles', 'Trucks', 'Diorama', 'HO Building', 'HO Figures'].every(t => L(t) === 'Accessory'));
T('A15 track: Switch, Crossover, Lock-On, Bumpers, Mega Track, SuperStreets (both spellings)', ['Switch', 'Crossover', 'Lock-On', 'Bumpers', 'Mega Track', 'SuperStreets', 'Superstreets', 'HO Track'].every(t => L(t) === 'Track'));
T('A16 power: Controller, Control, Command Control', ['Controller', 'Control', 'Command Control'].every(t => L(t) === 'Power'));
T('A17 paper: Packet, Manual, Record, Sales Material, Ephemera, Instruction Sheet, Certificate, Book', ['Packet', 'Manual', 'Record', 'Sales Material', 'Ephemera', 'Instruction Sheet', 'Certificate', 'Book', 'Note Cards', 'Misc Lionel'].every(t => L(t) === 'Paper'));
// v0.9.1877: "Auto Rack" left this list ([stated] Brad: filed with Intermodal like "Auto Carrier" — A22 below).
// v0.9.1888: "Vat Car" left it too ([stated] Brad: "vat cars should be their own type" — a bucket, label "Vat"; tests/vat_car_tests.js).
T('A18 LEFT AS THEIR OWN WORD on purpose: Part, Premiums, T-Shirt, Separate Sale, MOW Car',
  ['Part', 'Premiums', 'T-Shirt', 'Separate Sale', 'MOW Car'].every(t => L(t) === t));
T('A18b Vat Car is a bucket now, label "Vat" (v0.9.1888)', L('Vat Car') === 'Vat');
T('A19 what worked before still works: packs, the dash form, the catalog\'s own words, the by-words loco kind',
  L('Boxcar 2-Pack') === 'Boxcar' && L('Flatcar - PS-4 Flatcar') === 'Flatcar' && L('Reefer') === 'Boxcar' && L('Steam Locomotive', 'Hudson') === 'Steam' && L('Steam Locomotive', 'GP-9 diesel') === 'Diesel' && L('Freight Car', 'gondola with canisters') === 'Gondola');
T('A20 a user\'s own word is still the user\'s', W.getTypeBucket({ itemType: 'Wings of Texaco', _personalOnly: true }) === 'Wings of Texaco');

// ── B ────────────────────────────────────────────────────────────────────
section('B · the gauge spellings, through the real reader');
const g1 = (w, want) => JSON.stringify(G(w)) === JSON.stringify(want);
T('B1  "HO 1:87" is HO; "N 1:160" and Kato\'s "9" are N', g1('HO 1:87', ['ho']) && g1('N 1:160', ['n']) && g1('9', ['n']));
T('B2  "Standard O", "Super O Gauge", "027 Gauge" are O', g1('Standard O', ['o']) && g1('Super O Gauge', ['o']) && g1('027 Gauge', ['o']));
T('B3  "Std Gauge" is Standard', g1('Std Gauge', ['standard']));
T('B4  "Gauge 1", every "1:xx / 45 mm" (the adjustable ones too), "Large – Runs on 45mm Track", "G scale 1:29 (AML)" are G',
  ['Gauge 1', '1:20.3 / 45 mm', '1:32 / 45 mm', '1:29 / 45 mm', '1:19 / 45 mm', '1:24 / 45 mm', '1:13.7 / 45 mm', '1:19 / 45 or 32 mm', '1:19 / 45/32 mm', '1:19 / 45 (32) mm Adjustable', 'Large – Runs on 45mm Track', 'G scale 1:29 (AML)'].every(w => g1(w, ['g'])));
T('B5  Bachmann\'s HOn30 sentence is HOn30', g1('Narrow Gauge HO Scale that runs on N Gauge (9mm) Track', ['hon30']));
T('B6  LEFT UNKNOWN on purpose: 3¼", Toy, Multi-Scale, Suitable For Any Scale, N/HO', ['3¼"', 'Toy', 'Multi-Scale', 'Suitable For Any Scale', 'N/HO'].every(w => G(w).length === 0));
T('B7  the spellings that always worked still do', g1('O Gauge', ['o']) && g1('Standard', ['standard']) && g1('HO', ['ho']) && g1('S Gauge', ['s']) && g1('G', ['g']) && g1('N', ['n']) && g1('Z', ['z']) && g1('Standard & O', ['standard', 'o']) && g1('2-7/8', ['standard']) && g1('OO', ['standard']) && g1('', []));

// ── C ────────────────────────────────────────────────────────────────────
section('C · the era spans');
const ERAS = new Function(cfg.slice(cfg.indexOf('const ERAS = {'), cfg.indexOf('\n};', cfg.indexOf('const ERAS = {')) + 3) + '; return ERAS;')();
// The five spans are DECISIONS (measured on the tab 2026-09-30: MTH O 1995–2026,
// MTH Tinplate 1993–2026, MTH G 2001–2026, K-Line 1997–2021, Marx 1927–2004),
// so the numbers are the thing pinned and this comment says so.
T('C1  MTH O 1995-Today (was 2000-2020; 1,574 rows 1995–99, 1,934 rows 2025–26)', ERAS.mth_o.years === '1995-Today');
T('C2  MTH Tinplate 1993-Today, MTH G 2001-Today', ERAS.mth_tinplate.years === '1993-Today' && ERAS.mth_g.years === '2001-Today');
T('C3  K-Line O 1975-2021, Marx O 1927-2004', ERAS.kline.years === '1975-2021' && ERAS.marx.years === '1927-2004');
T('C4  every era\'s years string has one of the four shapes: All / All Eras / YYYY-YYYY / YYYY-Today',
  Object.keys(ERAS).every(k => /^(All|All Eras|\d{4}-\d{4}|\d{4}-Today)$/.test(String(ERAS[k].years || ''))), Object.keys(ERAS).filter(k => !/^(All|All Eras|\d{4}-\d{4}|\d{4}-Today)$/.test(String(ERAS[k].years || ''))));
T('C5  …and no span runs backwards', Object.keys(ERAS).every(k => { const m = /^(\d{4})-(\d{4})$/.exec(ERAS[k].years || ''); return !m || +m[2] >= +m[1]; }));

// ── D ────────────────────────────────────────────────────────────────────
section('D · planted offenders');
const tgNoCanon = tg.replace("var it = _rrTypeWordCanon((item.itemType || '').trim());", "var it = (item.itemType || '').trim();");
T('D1  offender "skip the canon step" changed the source', tgNoCanon !== tg);
const W1 = bucketer(tgNoCanon);
T('D1  …and A1 / A2 / A5 go red on it', W1.getTypeBucketLabel({ itemType: 'Rolling stock', description: 'boxcar' }) !== 'Boxcar' && W1.getTypeBucketLabel({ itemType: 'HO Boxcar' }) !== 'Boxcar' && W1.getTypeBucketLabel({ itemType: 'Diesel/Electric Locomotive', description: 'F-3 A Unit' }) !== 'Diesel');
const tgNoHO = tg.replace("t = t.replace(/^HO\\s*-?\\s+(?=\\S)/, '');", "");
T('D2  offender "keep the HO prefix" changed the source', tgNoHO !== tg);
T('D2  …and A2 goes red on it while A3 (Hopper) still passes', bucketer(tgNoHO).getTypeBucketLabel({ itemType: 'HO Boxcar' }) !== 'Boxcar' && bucketer(tgNoHO).getTypeBucketLabel({ itemType: 'Hopper' }) === 'Hopper');
const tgNoSyn = tg.replace("'car set': 'Set', 'train set': 'Set',", '');
T('D3  offender "drop two synonyms" changed the source', tgNoSyn !== tg);
T('D3  …and A8 goes red on it', bucketer(tgNoSyn).getTypeBucketLabel({ itemType: 'Car Set' }) !== 'Set');
// v0.9.1875 ([stated] Brad: electric unit sets are treated like the diesel sets): "Diesel Set" and "Electric Set" — the
// words the master writes for a set of locomotive units — are both filed under Set, and the word is known (no type-unknown).
T('A21 "Diesel Set" and "Electric Set" are filed under Set (Master Versions 2.01 / 2.03)', L('Diesel Set', 'F-3 A-A') === 'Set' && L('Electric Set', 'EF-3 A-B-A Electric') === 'Set' && L('Electric Set', 'Double Electric Locomotive Set') === 'Set');
const tgNoESet = tg.replace(" || it === 'Electric Set') return 'Set';", ") return 'Set';").replace("'Diesel Set', 'Electric Set', 'Track',", "'Diesel Set', 'Track',");
T('D6  offender "the app before v1875" changed the source', tgNoESet !== tg);
T('D6  …and A21 goes red on it', bucketer(tgNoESet).getTypeBucketLabel({ itemType: 'Electric Set', description: 'EF-3 A-B-A Electric' }) !== 'Set');
// v0.9.1877 ([stated] Brad: "yes" — teach the app that "Auto Rack" means Intermodal, like "Auto Carrier"): Atlas's own
// word for its auto carriers, on 310 master rows (Atlas HO 172 / N 79 / Z 18, MTH O 41), was the one freight word the
// bucketer could not file — the rows sat in no group and the audit counted them type-unknown. The sheet keeps the word.
T('A22 "Auto Rack" is filed under Intermodal, like "Auto Carrier" (any case, any description)', L('Auto Rack', 'Bi-Level Auto Rack') === 'Intermodal' && L('Auto Rack') === 'Intermodal' && L('auto rack', 'Tri-Level Enclosed Auto Rack') === 'Intermodal' && L('Auto Carrier') === 'Intermodal');
T('A22 …and a word that merely contains it is not swept in ("Auto Rack Load" stays its own word)', L('Auto Rack Load') === 'Auto Rack Load');
const tgNoRack = tg.replace("'auto carrier': 'Intermodal', 'auto rack': 'Intermodal',", "'auto carrier': 'Intermodal',");
T('D7  offender "the app before v1877" changed the source', tgNoRack !== tg);
T('D7  …and A22 goes red on it', bucketer(tgNoRack).getTypeBucketLabel({ itemType: 'Auto Rack', description: 'Bi-Level Auto Rack' }) !== 'Intermodal');
const appOld = app.replace("if (g === 'standard o' || g === 'super o' || g === 'super o gauge' || g === '027 gauge' || g === 'o27 gauge' || g === 'o-27 gauge') return ['o'];", '');
T('D4  offender "the gauge reader before v1844" changed the source', appOld !== app);
T('D4  …and B2 goes red on it', gaugeReader(appOld)('Standard O').length === 0);
const cfgOld = cfg.replace("years: '1995-Today', prefix: 'MTH O'", "years: '2000-2020', prefix: 'MTH O'");
T('D5  offender "the old MTH O span" changed the source', cfgOld !== cfg);
T('D5  …and C1 goes red on it', new Function(cfgOld.slice(cfgOld.indexOf('const ERAS = {'), cfgOld.indexOf('\n};', cfgOld.indexOf('const ERAS = {')) + 3) + '; return ERAS;')().mth_o.years !== '1995-Today');

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
