// ═══════════════════════════════════════════════════════════════
// atlas_parts_tests.js — v0.9.1744.
//
// Brad, 2026-09-14, on the Maintenance card of his Atlas ET44 (30138671):
// "hit atlas parts diagram, and i get shop.atlasrr.com/t-partsdiagrams.aspx
// — its their index not the parts diagram for this engine."
//
// TWO FINDINGS.
//  1. The matcher read only the DESCRIPTION. Every Atlas row carries the
//     model in SUB TYPE ("GP35 Locomotive"; the description is the paint:
//     "Union Pacific (Yellow/Red/Gray)"), so it matched NONE of the 16,863
//     Atlas locomotives in the master. With Sub Type it matches 11,338.
//  2. The ET44 is not on Atlas's parts-diagrams page at all (read live
//     2026-09-14). Nothing to link to — so the no-match line must SAY that,
//     and name what Atlas does cover, instead of "find your model on
//     Atlas's list".
// Also fixed on the way: 66 HO sheets tagged as O in the harvested list
// (an O item could be handed an HO sheet; HO items never saw them), and the
// six FM Erie Built O sheets that the v1643 harvest missed.
//
// The real ATLAS_DOCS and the real matcher are lifted from maintenance.js.
// Run:  node tests/atlas_parts_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');
function grab(sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
const di = src.indexOf('var ATLAS_DOCS = ['), dj = src.indexOf('];', di);
const DOCS = eval(src.slice(di + 'var ATLAS_DOCS = '.length, dj + 1));
const lifted = new Function('ATLAS_DOCS',
  grab('function _atlasScale(eraKey)') + '\n' + grab('function _atlasMatchAll(item, eraKey)') + '\n'
  + grab('function _atlasMatch(item, eraKey)') + '\n' + grab('function _atlasFamilies(sc)')
  + '\nreturn { scale: _atlasScale, all: _atlasMatchAll, one: _atlasMatch, fam: _atlasFamilies };')(DOCS);
ok('the list and the four functions lift out of the source', DOCS.length > 200 && typeof lifted.all === 'function' && typeof lifted.fam === 'function', String(DOCS.length));

section("Brad's ET44 — honest about what Atlas has not published");
const et44 = { itemNum: '30138671', itemType: 'Diesel Locomotive', subType: 'ET44 Locomotive', description: 'Union Pacific (Yellow/Red/Gray)' };
ok('no match for an ET44 on O (Atlas has no such sheet)', lifted.one(et44, 'atlas') === null);
const famO = lifted.fam('O');
ok('the O families Atlas covers are named, and are locomotives only', famO.length >= 12 && famO.every(f => !/box car|hopper|tank|caboose|gondola|flat car|reefer|sleeper|dome/i.test(f)), famO.join(', '));
ok('…including the Erie Built added in v1744', famO.some(f => /FM Erie Built/.test(f)), famO.join(', '));
ok('…and no HO family leaks into the O list', !famO.some(f => /MP15DC|DASH 8|U30|SD-24|SD-26|AEM-7\/ALP-44 Loco$/.test(f)), famO.join(', '));
ok('the no-match line says Atlas has not published one, and names the list', /Atlas hasn\\'t published a parts diagram for this model/.test(src) && /list covers: ' \+ _esc\(_atlasFam\.join/.test(src));
ok('the old "find your model on Atlas\'s list" line is gone', !/find your model on Atlas/.test(src));

section('The Sub Type column is where the model lives');
const gp35 = { subType: 'GP35 Locomotive', description: 'Union Pacific (Yellow/Gray)' };
const hit = lifted.one(gp35, 'atlas');
ok('an Atlas O GP35 (model only in Sub Type) now lands on its own sheet', !!hit && /^O GP-35/.test(hit.t), hit && hit.t);
ok('…3-rail preferred', hit && hit.r === '3', hit && hit.r);
const all = lifted.all(gp35, 'atlas');
ok('…and the whole family comes back: body, chassis, trucks', all && all.length === 3 && /Body/.test(all[0].t) && all.some(e => /Chassis/.test(e.t)) && all.some(e => /Trucks/.test(e.t)), all && all.map(e => e.t).join(' | '));
ok('every sheet in the family is the same model and rail', all && all.every(e => e.m === all[0].m && e.r === all[0].r));
ok('description-only still works (old rows that named the model there)', !!lifted.one({ description: 'SD40 Diesel' }, 'atlas'));
const sd40 = lifted.one({ subType: 'SD40 Locomotive', description: 'BNSF' }, 'atlas');
ok('an SD40 → the O SD40 sheet', sd40 && /^O SD40/.test(sd40.t), sd40 && sd40.t);
const erie = lifted.one({ subType: 'FM Erie Built Locomotive (Powered)', description: 'Milwaukee Road' }, 'atlas');
ok('an FM Erie Built → the new O Erie Built sheet', erie && /^O FM Erie Built/.test(erie.t) && erie.r === '3', erie && erie.t);
ok('an N-scale item never gets an O sheet, and vice versa', (lifted.one(gp35, 'atlas_n') || {}).t !== (hit || {}).t && /^N /.test((lifted.one(gp35, 'atlas_n') || { t: 'N ' }).t));
ok('a non-Atlas era gets nothing', lifted.one(gp35, 'mpc') === null && lifted.one(gp35, null) === null);
ok('the matcher reads subType in its source (not just description)', /String\(\(item\.subType \|\| ''\) \+ ' ' \+ \(item\.description \|\| ''\)/.test(src));

section('The scale tags are honest');
ok('no sheet titled "HO …" is tagged O', DOCS.filter(e => e.s === 'O' && /^HO /.test(e.t)).length === 0);
ok('no sheet titled "O …" is tagged HO', DOCS.filter(e => e.s === 'HO' && /^O /.test(e.t)).length === 0);
ok('no sheet titled "N …" is tagged O or HO', DOCS.filter(e => (e.s === 'O' || e.s === 'HO') && /^N /.test(e.t)).length === 0);
const mp15 = lifted.one({ subType: 'MP15DC', description: 'Conrail' }, 'atlas_ho');
ok('an HO MP15DC (one of the 66 mis-tagged) now matches on HO', mp15 && /^HO MP15DC/.test(mp15.t), mp15 && mp15.t);
ok('…and an O MP15DC does NOT get the HO sheet', lifted.one({ subType: 'MP15DC', description: 'Conrail' }, 'atlas') === null);
ok('the six Erie Built sheets are present, 3 per rail', DOCS.filter(e => /eriebuilt/.test(e.m)).length === 6 && DOCS.filter(e => /eriebuilt/.test(e.m) && e.r === '3').length === 3);

section('The panel renders the family and the honest line');
ok('the family sheets render as quiet buttons under the main one', /_atlasAll\.slice\(1\)\.forEach/.test(src) && /_btnQuiet\(\)/.test(src));
ok('a link to Atlas\'s full list stays on the matched card too', /Their full list/.test(src));

// ── the measurement that found the bug, kept as a number ───────────
section('Against a real master pull, when one is on this machine');
const dump = '/tmp/claude-0/master/master_AL.json';
if (fs.existsSync(dump)) {
  const D = JSON.parse(fs.readFileSync(dump, 'utf8'));
  const norm = h => String(h).toLowerCase().replace(/[^a-z]/g, '');
  let total = 0, matched = 0;
  for (const [tab, era] of [['Atlas O', 'atlas'], ['Atlas HO', 'atlas_ho'], ['Atlas N', 'atlas_n']]) {
    const vals = D[tab]; const hdr = vals[0].map(norm);
    const ct = hdr.indexOf('itemtype'), cs = hdr.indexOf('subtype'), cd = hdr.indexOf('description');
    for (let n = 1; n < vals.length; n++) { const r = vals[n]; if (!/Locomotive/.test(r[ct] || '')) continue; total++; if (lifted.one({ subType: r[cs] || '', description: r[cd] || '' }, era)) matched++; }
  }
  ok('Atlas locomotives that now find a sheet: ' + matched + ' of ' + total + ' (was 0)', matched > 11000, String(matched));
} else {
  console.log('  SKIP  no master pull at ' + dump);
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
