// ═══════════════════════════════════════════════════════════════
// phase_c_wiring_tests.js — Session 85. Phase C: the nine catalog tabs
// imported in Session 84 (4,759 rows, verified row-for-row) become
// visible to the app.
//
// Brad's decisions (S85): On30/HOn30 are their OWN scale options
// ("a different thing to shop for"); Bachmann All Scales is mixed
// (null scale, like Pre-War); new eras default ON via the v1159
// baseline mechanism; the stale barcode/research era lists get the
// S84-era makers (K-Line, Williams, Other O) at the same time.
//
// Run:  node tests/phase_c_wiring_tests.js
// Proven to FAIL on v0.9.1573 (commit 281c8e6) before the wiring.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }

// ── Evaluate config.js + onboarding-config.js + era-badges-config.js
//    for real (not regex) so the assertions read the same structures
//    the app does. window={} so the publish lines run.
const ctx = { window: {}, console: console, localStorage: undefined, navigator: { userAgent: 'test' }, location: { hostname: 'test', search: '', origin: 'https://test' }, document: undefined };
ctx.window.addEventListener = function () {};
ctx.addEventListener = function () {};
ctx.setTimeout = function () {}; ctx.setInterval = function () {};
vm.createContext(ctx);
vm.runInContext(src('config.js') + '\n;window.__cfg = { ERAS, REAL_ERA_IDS, ERA_SCALE, ERA_TABS, ERA_SCALES_MULTI };', ctx);
vm.runInContext(src('onboarding-config.js') + '\n;window.__wic = WHAT_I_COLLECT;', ctx);
vm.runInContext(src('era-badges-config.js') + '\n;window.__badges = ERA_BADGES;', ctx);
const CFG = ctx.window.__cfg, WIC = ctx.window.__wic, BADGES = ctx.window.__badges;

// The nine, with the EXACT master-sheet tab names (verified against the
// live sheet 2026-08-24 via gviz read — counts matched Session 84).
const NINE = [
  { id: 'aristocraft',    tab: 'Aristo-Craft G',      mfr: 'Aristo-Craft', scale: 'g',     wic: 'g' },
  { id: 'accucraft',      tab: 'Accucraft G',         mfr: 'Accucraft',    scale: 'g',     wic: 'g' },
  { id: 'bachmann_ho',    tab: 'Bachmann HO',         mfr: 'Bachmann',     scale: 'HO',    wic: 'ho' },
  { id: 'bachmann_n',     tab: 'Bachmann N',          mfr: 'Bachmann',     scale: 'N',     wic: 'n' },
  { id: 'bachmann_g',     tab: 'Bachmann Large G',    mfr: 'Bachmann',     scale: 'g',     wic: 'g' },
  { id: 'bachmann_o',     tab: 'Bachmann O',          mfr: 'Bachmann',     scale: 'O',     wic: 'o' },
  { id: 'bachmann_on30',  tab: 'Bachmann On30',       mfr: 'Bachmann',     scale: 'On30',  wic: 'on30' },
  { id: 'bachmann_hon30', tab: 'Bachmann HOn30',      mfr: 'Bachmann',     scale: 'HOn30', wic: 'hon30' },
  { id: 'bachmann_all',   tab: 'Bachmann All Scales', mfr: 'Bachmann',     scale: '',      wic: null },
];

// ── config.js: the four tables that make an era exist ──────────
NINE.forEach(function (e) {
  const d = CFG.ERAS[e.id];
  ok('ERAS has ' + e.id, !!d);
  if (!d) return;
  ok('  …manufacturer is ' + e.mfr, d.manufacturer === e.mfr, d.manufacturer);
  ok('  …label matches its tab name', d.label === e.tab, d.label);
  ok('  …REAL_ERA_IDS lists it (or the index build never fetches it)',
     CFG.REAL_ERA_IDS.indexOf(e.id) >= 0);
  ok('  …ERA_TABS points at the EXACT sheet tab',
     CFG.ERA_TABS[e.id] && CFG.ERA_TABS[e.id].items === e.tab,
     CFG.ERA_TABS[e.id] && CFG.ERA_TABS[e.id].items);
  ok('  …ERA_SCALE entry present and as decided',
     (e.id in CFG.ERA_SCALE) && CFG.ERA_SCALE[e.id] === e.scale,
     JSON.stringify(CFG.ERA_SCALE[e.id]));
});

// ── WHAT_I_COLLECT: prefs, scales, manufacturers ───────────────
ok('SCALES gained on30 as its OWN option (Brad: different thing to shop for)',
   !!WIC.SCALES.on30);
ok('SCALES gained hon30 as its OWN option', !!WIC.SCALES.hon30);
NINE.forEach(function (e) {
  ok('ERA_TO_SCALE has ' + e.id + ' = ' + JSON.stringify(e.wic),
     (e.id in WIC.ERA_TO_SCALE) && WIC.ERA_TO_SCALE[e.id] === e.wic,
     JSON.stringify(WIC.ERA_TO_SCALE[e.id]));
  ok('  …eraOrder places it', WIC.eraOrder.indexOf(e.id) >= 0);
  ok('  …eraColors gives its card a color', !!WIC.eraColors[e.id]);
});
ok('bachmann_all is explicitly null (mixed), not merely absent',
   ('bachmann_all' in WIC.ERA_TO_SCALE) && WIC.ERA_TO_SCALE.bachmann_all === null);
// The v1159 trap: every scale an era claims must be a real SCALES option.
const badScale = Object.keys(WIC.ERA_TO_SCALE)
  .filter(k => WIC.ERA_TO_SCALE[k] && !WIC.SCALES[WIC.ERA_TO_SCALE[k]]);
ok('every claimed scale is a selectable option (v1159 trap)', badScale.length === 0,
   badScale.join(','));
// Manufacturer keys MUST equal ERAS[era].manufacturer.toLowerCase().
['aristo-craft', 'accucraft', 'bachmann'].forEach(function (m) {
  ok('MANUFACTURERS has "' + m + '"', !!WIC.MANUFACTURERS[m]);
});
ok('MANUFACTURERS keys line up with ERAS manufacturers (the k-line lesson)',
   NINE.every(e => !!WIC.MANUFACTURERS[String(CFG.ERAS[e.id] && CFG.ERAS[e.id].manufacturer || '').toLowerCase()]));
// PREF_BASELINE is history — the new makers/scales must NOT be in it.
ok('PREF_BASELINE untouched: no new makers added to the snapshot',
   ['aristo-craft', 'accucraft', 'bachmann'].every(m => WIC.PREF_BASELINE.manufacturers.indexOf(m) < 0));
ok('PREF_BASELINE untouched: no new scales added to the snapshot',
   ['on30', 'hon30'].every(s => WIC.PREF_BASELINE.scales.indexOf(s) < 0));

// ── chip vocabulary: a picked on30/hon30 chip must translate ───
const cfgSrc = src('config.js');
ok('_RR_CHIP_SCALE_LABEL knows on30/hon30',
   /on30:\s*'On30'/.test(cfgSrc) && /hon30:\s*'HOn30'/.test(cfgSrc));

// ── badges ─────────────────────────────────────────────────────
NINE.forEach(function (e) {
  ok('badge shortLabel for ' + e.id, !!BADGES.shortLabel[e.id], BADGES.shortLabel[e.id]);
});

// ── barcode gate: modern makers with UPCs show the scan button ─
// (Also closes the pre-existing gap: kline/williams/other_o were never
// added when those eras arrived. Marx stays out — it wound down as UPCs
// arrived. Brad approved fixing all of this in S85.)
const bcSrc = src('barcode.js');
const showM = bcSrc.match(/var SHOW = \[[\s\S]*?\];/);
const showList = showM ? showM[0] : '';
['aristocraft', 'accucraft', 'bachmann_ho', 'bachmann_n', 'bachmann_g', 'bachmann_o',
 'bachmann_on30', 'bachmann_hon30', 'bachmann_all', 'kline', 'williams', 'other_o']
  .forEach(function (e) {
    ok('eraSupportsBarcode lists ' + e, showList.indexOf("'" + e + "'") >= 0);
  });
ok('marx stays OUT of the barcode list (pre-UPC maker)', showList.indexOf("'marx'") < 0);

// ── research era groups: "modern" finds the new makers ─────────
const rsSrc = src('research.js');
const egM = rsSrc.match(/var ERA_GROUP = \{[\s\S]*?\};/);
const egStr = egM ? egM[0] : '';
['aristocraft', 'accucraft', 'bachmann_ho', 'bachmann_n', 'bachmann_g', 'bachmann_o',
 'bachmann_on30', 'bachmann_hon30', 'bachmann_all', 'kline', 'williams', 'other_o', 'marx']
  .forEach(function (e) {
    ok('research ERA_GROUP reaches ' + e, egStr.indexOf("'" + e + "'") >= 0);
  });

// ── wizard maker→era map: unambiguous makers get a home era ────
const wpSrc = src('wizard-photos.js');
ok("_eraForMfr maps 'aristo-craft' → aristocraft",
   /'aristo-craft':\s*'aristocraft'/.test(wpSrc));
ok("_eraForMfr maps 'accucraft' → accucraft",
   /accucraft:\s*'accucraft'|'accucraft':\s*'accucraft'/.test(wpSrc));
ok("_eraForMfr leaves bachmann AMBIGUOUS (five eras, like Lionel)",
   /bachmann:\s*''/.test(wpSrc));


// ── Session 86: the Menards per-scale split ──────────────────────
// Brad: "there is a menards o gauge tab so everything on that tab is
// o gauge. we do need to add a menards ho tab." Proven failing on the
// v0.9.1578 tree before the wiring.
(function () {
  const C = ctx.window.__cfg;
  ok('menards_ho exists in ERAS with the Menards manufacturer',
     !!(C.ERAS.menards_ho && C.ERAS.menards_ho.manufacturer === 'Menards'));
  ok('…its label is Menards HO', C.ERAS.menards_ho && C.ERAS.menards_ho.label === 'Menards HO');
  ok('…REAL_ERA_IDS lists it', C.REAL_ERA_IDS.indexOf('menards_ho') >= 0);
  ok('…ERA_SCALE says HO', C.ERA_SCALE.menards_ho === 'HO');
  ok('…ERA_TABS names the EXACT live tab', C.ERA_TABS.menards_ho && C.ERA_TABS.menards_ho.items === 'Menards HO');
  ok('menards is NO LONGER multi-scale — the tab is pure O now',
     !(C.ERA_SCALES_MULTI && C.ERA_SCALES_MULTI.menards));
  const ob = ctx.window.__wic;
  ok('onboarding ERA_TO_SCALE maps menards_ho to ho', ob.ERA_TO_SCALE.menards_ho === 'ho');
  ok('…eraOrder places it beside menards', ob.eraOrder.indexOf('menards_ho') === ob.eraOrder.indexOf('menards') + 1);
  ok('…it has its own era color', /^#[0-9a-f]{6}$/i.test(ob.eraColors.menards_ho || ''));
  const eb = ctx.window.__badges;
  ok('badge short label exists (MENARDS_HO uppercased is noise)',
     !!eb.shortLabel.menards_ho && eb.shortLabel.menards_ho.length <= 4);
  const bc = src('barcode.js');
  ok('barcode era list carries menards_ho', /'menards_ho'/.test(bc));
  const rs = src('research.js');
  ok('research modern group carries menards_ho', /'menards_ho'/.test(rs));
  const br = src('browse.js');
  ok('period map knows menards_ho is modern', /menards_ho:\s*'modern'/.test(br));
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('PHASE-C WIRING TESTS FAILING'); process.exit(1); }
console.log('ALL PHASE-C WIRING TESTS GREEN (' + pass + ')');
