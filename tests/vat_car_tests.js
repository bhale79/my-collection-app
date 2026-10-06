#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// vat_car_tests.js — v0.9.1888: a vat car is its own type
//
// [stated] Brad (2026-10-06): "vat cars should be their own type".
//
// Before: the 17 master rows typed "Vat Car" showed the bare word — no bucket,
// no line in the Type filter, no dashboard count — and every word-reader in
// the app filed a vat car as a TANK car (type-groups.js's freight words,
// config.js's RR_TYPE_WORDS, import-core.js's rule 7 said "Freight Car").
// Measured on the live master 2026-10-06: 17 rows typed Vat Car, 34 Lionel
// Modern vat cars typed Tank Car on the sheet (Master Version 2.23), 8 K-Line
// vat cars typed Rolling Stock.
//
// A · the bucket list: 24 entries, Vat Car last (alphabetical by label),
//     the icon map and the dashboard's freight roll-up seat it.
// B · REAL master rows through the REAL getTypeBucket: typed "Vat Car" → Vat
//     Car (any case); K-Line "Rolling Stock" + the words → Vat Car; a row
//     the sheet still types Tank Car stays Tank Car (the row's own type
//     decides — 2.23 fixes the sheet, not the app); a real tank car stays a
//     tank car; Märklin's "VAT Logistics" container car is not a vat car.
// C · the other two word-readers (config.js RR_TYPE_WORDS for the Office's
//     description reader, import-core.js for the spreadsheet import) say
//     Vat Car, and still say Tank Car for a tank car.
// D · every consumer reads the ONE list — no file keeps its own copy of the
//     bucket vocabulary with Vat Car missing.
// E · PLANTED: the v1887 file (Vat Car removed from the list; the tank rule
//     swallowing "vat car" again; config's rule removed) must fail B / C.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const src = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const TG = src('type-groups.js'), CFG = src('config.js'), IMP = src('import-core.js'), DASH = src('dashboard.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function liftTG(s) { const w = {}; new Function('window', s)(w); return w; }
function liftCfgReader(s) {
  const a = s.indexOf('const RR_TYPE_WORDS'), b = s.indexOf('\n}\n', s.indexOf('function rrTypeFromDescription')) + 3;
  const k = {}; vm.runInNewContext(s.slice(a, b) + ';this.t = rrTypeFromDescription; this.words = RR_TYPE_WORDS;', k);
  return k;
}
function liftImp(s) { const sb = { window: {}, console }; sb.window.window = sb.window; vm.runInNewContext(s, sb); return sb.window.rrImpTypeFromText || sb.rrImpTypeFromText; }

// ── A · the list ─────────────────────────────────────────────────────────────
section('A · the bucket list');
const W = liftTG(TG);
T('A1 24 buckets; Vat Car is the 24th, label "Vat", last (alphabetical by label)',
  W.TYPE_BUCKETS.length === 24 && W.TYPE_BUCKETS[23].id === 'Vat Car' && W.TYPE_BUCKETS[23].label === 'Vat', W.TYPE_BUCKETS.slice(-2));
T('A2 labels are still in alphabetical order', (function () {
  const l = W.TYPE_BUCKETS.map(b => b.label.toLowerCase()); return l.every((x, i) => i === 0 || l[i - 1] < x);
})(), W.TYPE_BUCKETS.map(b => b.label));
T('A3 the icon map seats it with the rolling stock (freight icon)', W.BUCKET_TO_ICON['Vat'] === 'freight' && W.getBucketIcon({ itemType: 'Vat Car' }) === 'freight');
T('A4 the dashboard\'s freight roll-up counts it', /_FREIGHT_BUCKETS = \[[^\]]*'Vat Car'[^\]]*\]/.test(DASH));
T('A5 the label getter answers "Vat"', W.getTypeBucketLabel({ itemType: 'Vat Car', description: 'Pickles Vat Car' }) === 'Vat');

// ── B · real rows ────────────────────────────────────────────────────────────
section('B · real master rows through the real getTypeBucket');
const g = W.getTypeBucket;
// the 17 typed rows (every tab that has one), as parseMasterRow gives them
const TYPED = [
  { tab: 'Lionel PW - Items', itemNum: '6475', itemType: 'Vat Car', description: 'Pickles Vat Car', _era: 'pw' },
  { tab: 'Lionel MPC-Modern', itemNum: '2628390', itemType: 'Vat Car', description: 'Winnie the Pooh Honey Vat Car', _era: 'mpc' },
  { tab: 'Lionel MPC-Modern', itemNum: '6-19490', itemType: 'Vat Car', description: "Libby's Vat Car", _era: 'mpc' },
  { tab: 'Lionel MPC-Modern', itemNum: '6-26676', itemType: 'Vat Car', description: 'Heinz Vat Car', _era: 'mpc' },
  { tab: 'Lionel MPC-Modern', itemNum: '6-29412', itemType: 'Vat Car', description: 'Tabasco® Brand Vat Car', _era: 'mpc' },
  { tab: 'K-Line O', itemNum: 'K675203', itemType: 'Vat Car', description: "Hershey's 1998 Classic Holiday vat car", _era: 'kline_o' },
];
T('B1 every row typed "Vat Car" → Vat Car', TYPED.every(r => g(r) === 'Vat Car'), TYPED.map(r => r.itemNum + ':' + g(r)));
T('B2 the type word in any case ("vat car", "VAT CAR") → Vat Car',
  g({ itemType: 'vat car', description: 'Heinz' }) === 'Vat Car' && g({ itemType: 'VAT CAR', description: '' }) === 'Vat Car');
// K-Line's 8, typed Rolling Stock — the words decide
const KLINE = [
  { itemNum: 'K-90012', itemType: 'Rolling Stock', description: 'K-90012 O Gauge KCC Exclusive Keokuk Canning Company Vat Car', varDesc: 'no variation' },
  { itemNum: 'K675-7401', itemType: 'Rolling Stock', description: 'K675-7401 O Gauge Toy Fair Keokuk Vat Car', varDesc: 'no variation' },
  { itemNum: 'K675-8013', itemType: 'Rolling Stock', description: "K675-8013 Honest Abe's Log Cabin Vat Car 186165 LN/Box", varDesc: 'no variation' },
  { itemNum: 'K675401', itemType: 'Rolling Stock', description: "K675401 O Gauge Campbell's Soup Vat Car EX/Box", varDesc: 'no variation' },
  { itemNum: 'K675201', itemType: 'Rolling Stock', description: 'K675201 O Gauge Heinz Co. Vat Car EX/Box', varDesc: 'no variation' },
];
T('B3 K-Line "Rolling Stock" rows whose words say vat car → Vat Car (were Tank Car)', KLINE.every(r => g(r) === 'Vat Car'), KLINE.map(r => r.itemNum + ':' + g(r)));
T('B4 a sheet row still TYPED Tank Car stays Tank Car — the row\'s own type decides (2.23 fixes the sheet)',
  g({ itemNum: '9106', itemType: 'Tank Car', description: 'vat car', roadName: 'Miller' }) === 'Tank Car');
T('B5 a real tank car is still a tank car', g({ itemNum: '6415', itemType: 'Freight Car', description: 'Sunoco 3-Dome Tank Car' }) === 'Tank Car'
  && g({ itemNum: '10-8084', itemType: 'Rolling Stock', description: 'No. 2815 O Gauge Oil Car' }) === 'Tank Car'
  && g({ itemNum: '6465', itemType: 'Tank Car', description: 'Sunoco Two-Dome Tank Car' }) === 'Tank Car');
T('B6 Märklin\'s "VAT Logistics" container car is not a vat car', g({ itemNum: '47084', itemType: 'Freight Car', description: 'Sgns — VAT Logistics Container Car Set.' }) !== 'Vat Car');
T('B7 the Lionelville "Fish Food Vat Car" typed Aquarium Car keeps its own word (the type decides)',
  g({ itemNum: '6-26496', itemType: 'Aquarium Car', description: 'Lionelville Aquarium Co. Fish Food Vat Car' }) === 'Operating Freight');
T('B8 a Postwar box row stays Paper', g({ itemNum: '6475', itemType: 'Paper / Box / Misc', description: 'Pickles Vat Car (orange picture)' }) === 'Paper / Box / Misc');

// ── C · the other word-readers ───────────────────────────────────────────────
section('C · the Office\'s description reader (config.js) and the import reader (import-core.js)');
const cfg = liftCfgReader(CFG);
T('C1 RR_TYPE_WORDS: "Heinz Vat Car" → Vat Car; "vat car numbered 6475" → Vat Car',
  cfg.t('', 'Heinz Vat Car') === 'Vat Car' && cfg.t('', 'vat car numbered 6475') === 'Vat Car', [cfg.t('', 'Heinz Vat Car'), cfg.t('', 'vat car numbered 6475')]);
T('C2 RR_TYPE_WORDS: a tank car is still a Tank Car', cfg.t('', 'Sunoco 3-Dome Tank Car') === 'Tank Car' && cfg.t('', 'Gulf Single Dome Tanker') === 'Tank Car');
T('C3 RR_TYPE_WORDS: the Vat Car rule sits BEFORE the Tank Car rule', (function () {
  const i = cfg.words.findIndex(w => w[0] === 'Vat Car'), j = cfg.words.findIndex(w => w[0] === 'Tank Car'); return i >= 0 && j > i;
})());
T('C4 every id RR_TYPE_WORDS can return is in TYPE_BUCKETS (Vat Car included)', (function () {
  const ids = W.TYPE_BUCKETS.map(b => b.id).concat(['Steam Locomotive', 'Diesel Locomotive', 'Electric Locomotive']);
  return cfg.words.every(w => w[0] === 'LOCO' || ids.indexOf(w[0]) >= 0);
})());
const imp = liftImp(IMP);
T('C5 import reader: "Libby\'s Vat Car" → Vat Car; "Pittsburgh Paint vat car" → Vat Car', typeof imp === 'function' && imp("Libby's Vat Car") === 'Vat Car' && imp('Pittsburgh Paint vat car') === 'Vat Car',
  typeof imp === 'function' ? [imp("Libby's Vat Car"), imp('Pittsburgh Paint vat car')] : 'no reader');
T('C6 import reader: a tank car is still a Tank Car', typeof imp === 'function' && imp('Sunoco Tank Car') === 'Tank Car');
T('C7 the import\'s match-scoring bodies know "vat car"', /_RR_BODIES = \[[^\]]*'vat car'[^\]]*\]/.test(IMP));

// ── D · one list ─────────────────────────────────────────────────────────────
section('D · one list — no file keeps its own copy of the bucket vocabulary');
const FILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
T('D1 no app file hardcodes "Tank Car" in a bucket-id list without "Vat Car" beside it (the dashboard roll-up and type-groups are the only id lists)', (function () {
  const bad = [];
  for (const f of FILES) {
    const s = src(f);
    const re = /\[\s*'[A-Z][^\]]*'Tank Car'[^\]]*\]/g; let m;
    while ((m = re.exec(s)) !== null) {
      const t = m[0];
      if (/'Boxcar'/.test(t) && /'Hopper'/.test(t) && /'Operating Freight'/.test(t) && !/'Vat Car'/.test(t)) bad.push(f + ': ' + t.slice(0, 80));
    }
  }
  return bad.length === 0;
})());
T('D2 type-groups.js no longer lists "Vat Car" among the words shown bare', !/"Separate Sale", "Vat Car", "MOW Car"/.test(TG));

// ── E · planted ──────────────────────────────────────────────────────────────
section('E · planted: the v1887 reading must fail');
const UNDO_TG = [
  ['Vat Car removed from the bucket list', ",\n    { id: 'Vat Car',              label: 'Vat'          }", ''],
  ['the tank rule swallowing "vat car" again', "      if (/\\bvat car\\b/i.test(hay)) return 'Vat Car';\n", ''],
];
for (const [name, from, to] of UNDO_TG) {
  T('E0 the fix "' + name + '" is in type-groups.js exactly once', TG.split(from).length === 2);
  const w2 = liftTG(TG.split(from).join(to));
  const red = !(TYPED.every(r => w2.getTypeBucket(r) === 'Vat Car') && KLINE.every(r => w2.getTypeBucket(r) === 'Vat Car') && w2.TYPE_BUCKETS.length === 24);
  T('E  planted: ' + name + ' → section A/B goes red', red);
}
const UNDO_CFG = "  ['Vat Car', /\\bvat car\\b/i],";
T('E0 the config.js rule is in the file exactly once', CFG.split(UNDO_CFG).length === 2);
T('E  planted: config.js rule removed → "Heinz Vat Car" is no longer a Vat Car', liftCfgReader(CFG.split(UNDO_CFG).join('')).t('', 'Heinz Vat Car') !== 'Vat Car');
const OLD_TANK = "|oil car)\\b/i],", OLD_TANK_WAS = "|vat car|oil car)\\b/i],";
T('E0 the tank rule (vat car gone from it) is in config.js exactly once', CFG.split(OLD_TANK).length === 2);
T('E  planted: the v1887 config.js (rule removed, tank rule swallowing "vat car") → Tank Car again',
  liftCfgReader(CFG.split(UNDO_CFG).join('').split(OLD_TANK).join(OLD_TANK_WAS)).t('', 'Heinz Vat Car') === 'Tank Car');
const UNDO_IMP = "  [/\\bvat car\\b/i, 'Vat Car'],";
T('E0 the import-core.js rule is in the file exactly once', IMP.split(UNDO_IMP).length === 2);
T('E  planted: import rule removed → the vat car is no longer a Vat Car', (function () { const f = liftImp(IMP.split(UNDO_IMP).join('')); return typeof f === 'function' && f("Libby's Vat Car") !== 'Vat Car'; })());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
