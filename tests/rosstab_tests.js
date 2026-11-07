#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// ROSS CUSTOM SWITCHES — the app reads the tab (rosstab, 2026-11-05)
// [stated] Brad 17:57 CT pasted the issue ("The app never reads the 'Ross
// Custom Switches' tab in the master catalog") → 17:59 CT "yes" to
// PLAN_2026-11-05_ROSS_TAB → then "Yes, one row per maker" to the Add list question.
//
// The tab (215 rows, imported 2026-11-03) sat in the master, but no catalog
// list named it, so nothing loaded it: Lars's RB2024 track-cleaning car could
// not be found anywhere, and the master audit never read it either.
//
//   W  the wiring — config.js and onboarding-config.js RUN for real: Ross in
//      ERAS / REAL_ERA_IDS / ERA_TABS (the tab's exact name) / ERA_SCALE, the
//      maker words, What I Collect (order, scale, maker key, colour by
//      reference); browse period, research group, Photo ID's maker map, the
//      saved maker's spelling. Each checked again on a PLANTED copy and must fail.
//   A  the master audit walks the tab: 215 rows, header right, 0 flags
//   L  the REAL findMaster on the REAL tab (fixture read from the live master):
//      every one of the 215 rows answers to itself; RB2024 by maker; 0100/100
//      and 0120/120 stay apart; Lionel's 902 and 120 stay Lionel's
//   D  the Add list's one-row-per-maker rule (_sgMakerOfRow): Ross and Lionel
//      never merge; Lionel postwar and modern still do
//   G  GarGraves ([stated] Brad "Yes, add GarGraves too" — the catalog chat wrote
//      its tab, 521 rows, the same evening): the same wiring, audit and lookups;
//      its scale is the row's own (it sells O, S, G, HO, N, OO, Standard)
// The real app in Chromium is rosstab_road_tests.js.
// Run:  node tests/rosstab_tests.js
// ═════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra === undefined ? '' : extra).slice(0, 400))); cond ? pass++ : fail++; }
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const CFG = read('config.js'), OB = read('onboarding-config.js'), BR = read('browse.js'), RS = read('research.js');
const WP = read('wizard-photos.js'), AJ = read('app.js'), DAT = read('app-data.js'), SUG = read('wizard-suggestions.js');
const WZ = read('wizard.js');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rosstab_tabs_2026-11-05.json'), 'utf8'));
const TAB = FX.ross.tab;   // "Ross Custom Switches" — as the live master names it

// ── W: run the two config files for real ─────────────────────────────────
function world(cfgSrc, obSrc) {
  const doc = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, head: { appendChild() {} }, body: { appendChild() {} },
    documentElement: { style: { setProperty() {} } } };
  const sb = { console: { log() {}, warn() {}, error() {} }, navigator: { userAgent: 'node' }, addEventListener() {}, removeEventListener() {},
    setTimeout, clearTimeout, document: doc, location: { href: '', hostname: 'x', search: '' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(cfgSrc + '\n;this.__E = { ERAS, REAL_ERA_IDS, ERA_TABS, ERA_SCALE, ERA_SCALES_MULTI, LOOKUP_ONLY_ERAS, rrMakerKey, rrMakerName, rrMakerSame };', sb);
  vm.runInContext(obSrc + '\n;this.__W = WHAT_I_COLLECT;', sb);
  return { E: sb.__E, W: sb.__W };
}
// Every wiring check, as ONE list, so each can be run on a planted copy too.
const CHECKS = {
  eras:   ({ E }) => !!E.ERAS.ross && E.ERAS.ross.manufacturer === 'Ross Custom Switches' && E.ERAS.ross.label === TAB && E.ERAS.ross.prefix === TAB && E.ERAS.ross.years === 'All',
  real:   ({ E }) => E.REAL_ERA_IDS.indexOf('ross') >= 0 && E.LOOKUP_ONLY_ERAS.indexOf('ross') < 0,
  tab:    ({ E }) => !!E.ERA_TABS.ross && E.ERA_TABS.ross.items === TAB,
  scale:  ({ E, W }) => E.ERA_SCALE.ross === 'O' && W.ERA_TO_SCALE.ross === 'o',
  makers: ({ E }) => E.rrMakerKey('Ross') === 'ross custom switches' && E.rrMakerKey('Ross Custom Switches') === 'ross custom switches'
                     && E.rrMakerKey('ross switches') === 'ross custom switches' && E.rrMakerName('ROSS') === 'Ross Custom Switches'
                     && E.rrMakerKey('Betsy Ross flag car') === '' && E.rrMakerSame('Ross', 'Lionel') === false && E.rrMakerSame('Ross', 'Ross Custom Switches') === true,
  mfrKey: ({ E, W }) => !!W.MANUFACTURERS[E.ERAS.ross.manufacturer.toLowerCase()],
  order:  ({ W }) => W.eraOrder.indexOf('ross') >= 0,
  colour: ({ W }) => !!W.eraColors.ross && W.eraColors.ross === W.eraColors.weaver,
};
const real = world(CFG, OB);
ok('W1  ERAS.ross: maker "Ross Custom Switches", label and prefix = the tab\'s name, years All (Ross gives none)', CHECKS.eras(real), JSON.stringify(real.E.ERAS.ross));
ok('W2  REAL_ERA_IDS loads it (and it is NOT a lookup-only catalog)', CHECKS.real(real));
ok('W3  ERA_TABS points at the master tab by its EXACT name, "' + TAB + '"', CHECKS.tab(real), JSON.stringify(real.E.ERA_TABS.ross));
ok('W4  O gauge: ERA_SCALE "O", What I Collect scale "o"', CHECKS.scale(real));
ok('W5  the one maker rule: "Ross", "Ross Custom Switches", "Ross Switches" are one maker; a road named Ross is not; Ross ≠ Lionel', CHECKS.makers(real));
ok('W6  What I Collect: its maker key IS ERAS.ross.manufacturer lowercased (an allow-list — a mismatch hides the tab)', CHECKS.mfrKey(real));
ok('W7  What I Collect: placed in eraOrder', CHECKS.order(real));
const noLiteral = src => !/\n\s*(ross|gargraves):\s*'#/.test(src);
ok('W8  colour by REFERENCE (Weaver\'s), no new literal for the colour ratchet — and a planted literal is caught',
   CHECKS.colour(real) && noLiteral(OB) && !noLiteral(plant(OB, '    bachmann_all:   \'#4e342e\',   // darkest — the catch-all\n', '    bachmann_all:   \'#4e342e\',   // darkest — the catch-all\n    ross:           \'#123456\',\n', 'colour literal')));
// the planted copies — each check must FAIL when its own wiring is taken out
const P = {
  real:   world(plant(CFG, "'bachmann_all', 'ross', 'gargraves'];", "'bachmann_all', 'gargraves'];", 'REAL_ERA_IDS'), OB),
  tab:    world(plant(CFG, "ross:           { items: 'Ross Custom Switches' }", "ross:           { items: 'Ross Custom Switch' }", 'ERA_TABS'), OB),
  eras:   world(plant(CFG, "manufacturer: 'Ross Custom Switches' },", "manufacturer: 'Ross' },", 'ERAS'), OB),
  makers: world(plant(CFG, "|\\bross\\s+custom\\b|", "|\\bross\\b|", 'maker words'), OB),
  mfrKey: world(CFG, plant(OB, "'ross custom switches': { id: 'ross custom switches'", "'ross': { id: 'ross'", 'MANUFACTURERS')),
  order:  world(CFG, plant(OB, "                'ross', 'gargraves'],", "                'gargraves'],", 'eraOrder')),
  colour: world(CFG, plant(OB, 'WHAT_I_COLLECT.eraColors.ross = WHAT_I_COLLECT.eraColors.weaver;', '', 'eraColors')),
};
ok('W9  PLANTED: each check fails on a copy with its own Ross wiring removed (REAL_ERA_IDS, ERA_TABS, ERAS, maker words, maker key, order, colour)',
   Object.keys(P).every(k => !CHECKS[k](P[k])), Object.keys(P).filter(k => CHECKS[k](P[k])).join(', '));
ok('W10 PLANTED: a maker renamed in ERAS alone ("Ross") fails BOTH the eras check and the maker-key check — What I Collect\'s key no longer matches, which is what would hide the tab',
   !CHECKS.eras(P.eras) && !CHECKS.mfrKey(P.eras));

// the other places a new maker has to be named (scans, each with its plant)
const scans = [
  ['W11 browse.js files it as a modern era (else year-less rows hide behind the period chips)', BR, /\n\s*ross:\s*'modern'/, ["  ross:           'modern',", '']],
  ['W12 the research page searches it (modern group)', RS, /modern:\s*\[[^\]]*'ross'/, ["    'ross', 'gargraves'] };", "    'gargraves'] };"]],
  ['W13 Photo ID: a read that says "Ross" or "Ross Custom Switches" points at the Ross catalog', WP, /'ross custom switches':\s*'ross',\s*ross:\s*'ross'/, ["'ross custom switches': 'ross', ross: 'ross', ", '']],
  ['W14b the era badge: ROSS and GAR (short, like every other maker\'s)', read('era-badges-config.js'), /ross:\s*'ROSS',[^\n]*\n\s*gargraves:\s*'GAR'/, ["    gargraves:      'GAR',", '    ']],
  ['W16 typing "gargraves" in the Add box is a maker FILTER, not a description word', SUG, /'k-line':'K-Line', gargraves:'GarGraves' \};/, ["'k-line':'K-Line', gargraves:'GarGraves' };", "'k-line':'K-Line' };"]],
  ['W16b "ross" is a maker only beside a number or in its own words ("ross custom", "ross switches") — never alone in a word search (Betsy Ross)', SUG, /const _rossAsMaker = \(_rossBesideNum \|\| _rossPhrase\)/, ["const _rossAsMaker = (_rossBesideNum || _rossPhrase) &&", "const _rossAsMaker = true ||"]],
  ['W16c "ross" is NOT a stop word (so "betsy ross" keeps the word); "gargraves" is', read('item-search-filters-config.js'), /\n\s*'gargraves',\s*\/\//, ["    'gargraves',   //", "    'ross', 'gargraves',   //"]],
  ['W17 the Add screen\'s Scale filter asks a mixed catalog\'s ROW gauge (GarGraves 101 under O), as the Master Catalog does', WZ, /_blankOnPurpose[\s\S]{0,200}_scalesOfGauge\(m\.gauge(, m\._era)?\)/, ["_scalesOfGauge(m.gauge, m._era).indexOf(String(f.scale).toLowerCase()) < 0) return false;", "true) return false;"]],   // gargauge: + the era
  ['W14 the saved maker is spelled "Ross Custom Switches" (not the fallback\'s "Ross custom switches")', AJ, /'ross custom switches':'Ross Custom Switches'/, [", 'ross custom switches':'Ross Custom Switches', ", ', ']],
];
scans.forEach(([name, src, re, [from, to]]) => {
  const planted = plant(src, from, to, name);
  ok(name + ' — and FAILS on a planted copy without it', re.test(src) && !re.test(planted));
});
{
  const sb = {}; vm.createContext(sb);
  vm.runInContext(grab(AJ, 'var _BRAND_LABELS') .replace(/^var _BRAND_LABELS/, 'var _BRAND_LABELS') + ';' + grab(AJ, 'function _brandLabel(') + ';this.__b=_brandLabel;', sb);
  ok('W15 the real _brandLabel: "ross custom switches" → "Ross Custom Switches"', sb.__b('ross custom switches') === 'Ross Custom Switches', sb.__b('ross custom switches'));
}

// ── A: the master audit walks the tab ────────────────────────────────────
{
  const M = require(path.join(__dirname, '..', 'tools', 'master-audit', 'audit.js'));
  const A = M.loadApp();
  const t = M.auditTabs(A).filter(x => x.tab === TAB);
  ok('A1  the audit\'s tab list includes "' + TAB + '" (it reads the same lists)', t.length === 1 && t[0].era === 'ross' && t[0].key === 'items', JSON.stringify(t));
  const r = t.length ? M.checkTab(A, t[0], FX.ross.values) : { rowsChecked: 0, flags: [{}], headerOk: false };
  ok('A2  the audit reads all 215 rows, the header maps, and the tab is clean (0 flags)', r.rowsChecked === 215 && r.headerOk && r.flags.length === 0, JSON.stringify({ n: r.rowsChecked, h: r.headerOk, f: r.flags.slice(0, 3) }));
  const A2 = M.loadApp(); A2.REAL_ERA_IDS = A2.REAL_ERA_IDS.filter(e => e !== 'ross');
  ok('A3  PLANTED: without ross in the list, the audit never sees the tab (the bug as it was)', M.auditTabs(A2).filter(x => x.tab === TAB).length === 0);
}

// ── L: the REAL findMaster on the REAL tab ───────────────────────────────
function rowsOf(block, era) {
  const v = block.values, h = v[0];
  const at = name => h.indexOf(name);
  return v.slice(1).map(r => ({ itemNum: r[at('Item Number')], itemType: r[at('Item Type')], description: r[at('Description')],
    manufacturer: at('Manufacturer') >= 0 ? r[at('Manufacturer')] : '', rowId: r[at('Row ID')], variation: '', _era: era, _tab: block.tab }));
}
const ROSS = rowsOf(FX.ross, 'ross'), PW = rowsOf(FX.pw, 'pw');
function lookupWorld() {
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    grab(AJ, 'function rrNumZeroKey('), grab(AJ, 'function rrNumZeroTwin('),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    'var state = { masterByItem: new Map(), masterByItemAll: null, masterByRowId: new Map(), masterByRowIdAll: null };',
    'var ERA_TABS = {}; var _lkCache = new WeakMap(); var _zkCache = new WeakMap();',
    grab(DAT, 'function _mIsMotive('), grab(DAT, 'function _mSuffix('),
    grab(DAT, 'function _letterKinRows('), grab(DAT, 'function _zeroKinRows('),
    grab(DAT, 'function _findMasterCore('), grab(DAT, 'function _preferEraOf('),
    grab(DAT, 'function rrMasterByKey('), grab(DAT, 'function rrMasterByRowId('), grab(DAT, 'function _rrRowIdFits('),
    grab(DAT, 'function findMaster('),
    require('./lib/row-kind').rowKindSource(), grab(DAT, 'function _rrRealRowsOf('),   // 2026-11-07 (onerow): the row-kind rule + era cleaner
    'this.__index = function (rows, allRows) {',
    '  var mk = function (rs) { var m = new Map(); rs.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };',
    '  state.masterByItem = mk(rows); state.masterByItemAll = allRows ? mk(allRows) : null;',
    '  state.masterByRowId = new Map(); rows.concat(allRows || []).forEach(function (r) { if (r.rowId) state.masterByRowId.set(r.rowId, r); });',
    '  ERA_TABS = { pw: { items: "Lionel PW - Items" }, ross: { items: "Ross Custom Switches" } };',
    '};',
  ].join('\n;\n'), sb);
  return sb;
}
{
  ok('L0  the fixture is the whole live tab: 215 Ross rows, every one with a Row ID; the two Lionel rows Ross shares numbers with',
     ROSS.length === 215 && ROSS.every(r => /^[A-Z0-9]{10}$/.test(r.rowId)) && PW.length === 2, ROSS.length + '/' + PW.length);
  const L = lookupWorld();
  L.__index(PW.concat(ROSS));                     // Lionel first in load order — the worst case for Ross
  const wrong = ROSS.filter(r => { const h = L.findMaster(r.itemNum, '', { era: 'ross' }); return !h || h.rowId !== r.rowId; });
  ok('L1  every one of the 215 Ross rows answers to ITSELF when the copy names the Ross catalog', wrong.length === 0, wrong.slice(0, 5).map(r => r.itemNum).join(', '));
  const rb = L.findMaster('RB2024', '', { manufacturer: 'Ross Custom Switches' });
  ok('L2  RB2024 (Lars\'s track-cleaning car) is found — by its maker', !!rb && rb._tab === TAB && /TRACK CLEANING/.test(rb.description), rb && rb.description);
  const fm = (n, p) => (L.findMaster(n, '', p) || {});
  ok('L3  0100 and 100 are two Ross products and stay two (exact always wins)', fm('0100', { era: 'ross' }).itemNum === '0100' && fm('100', { era: 'ross' }).itemNum === '100'
     && fm('0100', { era: 'ross' }).rowId !== fm('100', { era: 'ross' }).rowId);
  ok('L4  0120 and 120 likewise', fm('0120', { era: 'ross' }).itemNum === '0120' && fm('120', { era: 'ross' }).itemNum === '120');
  ok('L5  902: a Lionel copy gets Lionel\'s Elevated Trestle, a Ross copy gets Ross\'s Mating Pins', fm('902', { era: 'pw' })._era === 'pw' && /Trestle/.test(fm('902', { era: 'pw' }).description)
     && fm('902', { era: 'ross' })._era === 'ross' && fm('902', { manufacturer: 'Ross Custom Switches' })._era === 'ross' && fm('902', { manufacturer: 'Lionel' })._era === 'pw');
  ok('L6  120: Lionel\'s Super-O crossing stays Lionel\'s; Ross\'s 120 stays Ross\'s', fm('120', { era: 'pw' })._era === 'pw' && fm('120', { era: 'ross' })._era === 'ross');
  // a collector who doesn't collect Ross: Lionel loaded, the full catalog behind it
  const L2 = lookupWorld(); L2.__index(PW, PW.concat(ROSS));
  ok('L7  a bare 902 or 120 never quietly turns into Ross for a collector whose catalog has Lionel\'s', (L2.findMaster('902', '', null) || {})._era === 'pw' && (L2.findMaster('120', '', null) || {})._era === 'pw');
  ok('L8  …but a Ross-only number still resolves from the full catalog (RB2024)', (L2.findMaster('RB2024', '', null) || {})._era === 'ross');
}

// ── D: the Add list — one row per maker ──────────────────────────────────
{
  ok('D1  the Add list\'s duplicate key carries the row\'s maker, from the ONE row-maker rule (rrRowMakerWord)', /_dedupeKey \+= '\|' \+ _sgMakerOfRow\(m\);/.test(SUG) && /function _sgMakerOfRow[\s\S]{0,200}rrRowMakerWord\(m\)/.test(SUG));
  const planted = plant(SUG, "      _dedupeKey += '|' + _sgMakerOfRow(m);\n", '', 'dedupe maker');
  ok('D2  PLANTED: without it the key is the old one (number, road, type)', !/_sgMakerOfRow\(m\)/.test(planted.slice(planted.indexOf('var _dedupeKey'), planted.indexOf('var _dedupeKey') + 400)));
  // D3+ (the real rrRowMakerWord deciding Lionel postwar = modern, Ross ≠ Lionel ≠ GarGraves) run in the real app: rosstab_road_tests A6.
}

// ── G: GarGraves, the same way ────────────────────────────────────────────
{
  const GT = FX.gargraves.tab;   // "GarGraves"
  const GCHK = {
    eras:   ({ E }) => !!E.ERAS.gargraves && E.ERAS.gargraves.manufacturer === 'GarGraves' && E.ERAS.gargraves.label === GT && E.ERAS.gargraves.prefix === GT,
    real:   ({ E }) => E.REAL_ERA_IDS.indexOf('gargraves') >= 0 && E.LOOKUP_ONLY_ERAS.indexOf('gargraves') < 0,
    tab:    ({ E }) => !!E.ERA_TABS.gargraves && E.ERA_TABS.gargraves.items === GT,
    scale:  ({ E, W }) => E.ERA_SCALE.gargraves === '' && W.ERA_TO_SCALE.gargraves === null
                          && ['O', 'S', 'G', 'HO', 'N', 'Standard'].every(x => (E.ERA_SCALES_MULTI.gargraves || []).indexOf(x) >= 0),
    makers: ({ E }) => ['GarGraves', 'Gar Graves', 'gar-graves', 'GarGraves Trackage'].every(x => E.rrMakerKey(x) === 'gargraves') && E.rrMakerName('gargraves') === 'GarGraves'
                       && E.rrMakerSame('GarGraves', 'Ross Custom Switches') === false && E.rrMakerSame('GarGraves', 'Lionel') === false,
    mfrKey: ({ E, W }) => !!W.MANUFACTURERS[E.ERAS.gargraves.manufacturer.toLowerCase()],
    order:  ({ W }) => W.eraOrder.indexOf('gargraves') >= 0,
    colour: ({ W }) => !!W.eraColors.gargraves && W.eraColors.gargraves === W.eraColors.menards,
  };
  ok('G1  ERAS.gargraves: maker "GarGraves", label and prefix = the tab\'s name', GCHK.eras(real), JSON.stringify(real.E.ERAS.gargraves));
  ok('G2  REAL_ERA_IDS loads it; ERA_TABS names the tab exactly, "' + GT + '"', GCHK.real(real) && GCHK.tab(real));
  ok('G3  its scale is the ROW\'s (ERA_SCALE blank, What I Collect null), and its What I Collect line sits under all six scales it sells, O, S, G, HO, N, Standard ([stated] Brad "Under all six scales")', GCHK.scale(real), JSON.stringify(real.E.ERA_SCALES_MULTI.gargraves));
  ok('G4  the one maker rule: GarGraves / Gar Graves / gar-graves / GarGraves Trackage are one maker, not Ross, not Lionel', GCHK.makers(real));
  ok('G5  What I Collect: maker key = ERAS manufacturer lowercased; placed in eraOrder; colour by reference', GCHK.mfrKey(real) && GCHK.order(real) && GCHK.colour(real) && !/gargraves:\s*'#/.test(OB));
  const GP = {
    real:   world(plant(CFG, "'ross', 'gargraves'];", "'ross'];", 'REAL_ERA_IDS gargraves'), OB),
    tab:    world(plant(CFG, "gargraves:      { items: 'GarGraves' }", "gargraves:      { items: 'Gargraves' }", 'ERA_TABS gargraves'), OB),
    scale:  world(plant(CFG, "  gargraves: ['O', 'S', 'G', 'HO', 'N', 'Standard'] };", "  };", 'ERA_SCALES_MULTI'), OB),
    makers: world(plant(CFG, "[/\\bgar[\\s\\-]?graves\\b/i, 'gargraves', 'GarGraves']", "[/\\bgar-graves\\b/i, 'gargraves', 'GarGraves']", 'maker words gargraves'), OB),
    mfrKey: world(CFG, plant(OB, "gargraves: { id: 'gargraves', label: 'GarGraves'", "'gar graves': { id: 'gar graves', label: 'GarGraves'", 'MANUFACTURERS gargraves')),
  };
  ok('G6  PLANTED: each check fails on a copy with its GarGraves wiring removed or misspelled', Object.keys(GP).every(k => !GCHK[k](GP[k])), Object.keys(GP).filter(k => GCHK[k](GP[k])).join(', '));
  [['G7a browse files GarGraves as modern', BR, /\n\s*gargraves:\s*'modern'/, ["  gargraves:      'modern',", '']],
   ['G7b the research page searches it', RS, /'ross', 'gargraves'\] \};/, ["    'ross', 'gargraves'] };", "    'ross'] };"]],
   ['G7c Photo ID\'s maker map points GarGraves at its catalog', WP, /gargraves:\s*'gargraves',\s*'gar graves':\s*'gargraves'/, ["gargraves: 'gargraves', 'gar graves': 'gargraves' ", ""]],
   ['G7d the saved maker is spelled "GarGraves"', AJ, /gargraves:'GarGraves'/, [", gargraves:'GarGraves' };", ' };']],
  ].forEach(([name, src, re, [from, to]]) => ok(name + ' — and FAILS on a planted copy without it', re.test(src) && !re.test(plant(src, from, to, name))));
  const M = require(path.join(__dirname, '..', 'tools', 'master-audit', 'audit.js'));
  const A = M.loadApp();
  const t = M.auditTabs(A).filter(x => x.tab === GT);
  const r = t.length ? M.checkTab(A, t[0], FX.gargraves.values) : { rowsChecked: 0, flags: [], headerOk: false };
  // gargauge (2026-11-06): the reader now knows "G & S" and "G & O" (tests/gargauge_tests.js),
  // so the two flags this check used to expect are gone — the tab is clean.
  ok('G8  the audit walks the tab: all 521 rows, header right, 0 flags (the two-gauge spellings read since gargauge)',
     t.length === 1 && r.rowsChecked === 521 && r.headerOk && r.flags.length === 0, JSON.stringify(r.flags.map(f => f.value)));
  const GG = rowsOf(FX.gargraves, 'gargraves');
  // the sandbox's ERA_TABS knows pw and ross; add gargraves the way config.js names it
  const Lg = lookupWorld();
  require('vm').runInContext('this.__index0 = this.__index; this.__index = function (a, b) { this.__index0(a, b); ERA_TABS.gargraves = { items: "GarGraves" }; };', Lg);
  Lg.__index(PW.concat(ROSS, GG));
  const wrong = GG.filter(x => { const h = Lg.findMaster(x.itemNum, '', { era: 'gargraves' }); return !h || h.rowId !== x.rowId; });
  ok('G9  every one of the 521 GarGraves rows answers to ITSELF when the copy names GarGraves', GG.length === 521 && wrong.length === 0, wrong.slice(0, 5).map(x => x.itemNum).join(', '));
  const f101 = p => (Lg.findMaster('101', '', p) || {});
  ok('G10 101 is both a Ross and a GarGraves product — each copy gets its own maker\'s', f101({ era: 'gargraves' })._era === 'gargraves' && f101({ era: 'ross' })._era === 'ross'
     && f101({ manufacturer: 'GarGraves' })._era === 'gargraves' && f101({ manufacturer: 'Ross Custom Switches' })._era === 'ross');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
