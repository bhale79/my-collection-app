// ═══════════════════════════════════════════════════════════════
// atlas_parts_tests.js — v0.9.1744, rewritten v0.9.1802.
//
// v0.9.1744 (Brad, on his Atlas ET44: "its their index not the parts diagram
// for this engine"): the matcher read only the DESCRIPTION, while every Atlas
// row carries the model in SUB TYPE. The ET44 itself is not on Atlas's page,
// so the no-match line must say so.
//
// v0.9.1802 (Brad, 2026-09-26: Atlas parts on the Maintenance page "the same
// way as MTH"): the diagram list and the matcher moved to
// app/atlas-diagrams-config.js, which BOTH the "Parts diagram" buttons and
// the parts lookup (_partsForItem) read — so the parts listed can never
// disagree with the diagrams shown. Measured on the real master the old
// matcher gave 373 HO "PS-2 Hopper" rows the S-2 LOCOMOTIVE sheet, every
// 40' PS-1 box car the 50' PS-1 sheet, every 2-rail O engine its 3-rail
// sheets, and 13 sheets had no scale ('?') so nothing could reach them.
// The parts themselves are the real rows written to the "Atlas Parts" tab
// on 2026-09-26: harvests/atlas-parts-2026-09-26.json.
//
// Run:  node tests/atlas_parts_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const cfgSrc = rd('atlas-diagrams-config.js');
const src = rd('maintenance.js');
const ad = rd('app-data.js');
const ix = rd('index.html');
const sw = rd('sw.js');
const conf = rd('config.js');

// Load the config file the way the browser does: into a fresh window.
function load(code) {
  const win = {};
  vm.runInNewContext(code, { window: win });
  return win;
}
const W = load(cfgSrc);
const DOCS = W.ATLAS_DOCS;
const lifted = {
  scale: W.atlasScale,
  all: W.atlasDiagramsFor,
  one: (it, era) => { const a = W.atlasDiagramsFor(it, era); return a ? a[0] : null; },
  fam: W.atlasFamilies,
};
const titles = a => (a || []).map(e => e.t).join(' | ');
ok('the config loads and exposes the list and the matcher', Array.isArray(DOCS) && DOCS.length === 275 && typeof lifted.all === 'function' && typeof lifted.fam === 'function', String(DOCS && DOCS.length));

section('One list, one matcher — Maintenance and the parts lookup read the same thing');
ok('maintenance.js no longer carries its own copy of the list', !/var ATLAS_DOCS = \[/.test(src) && !/\{s:'O',m:'gp35'/.test(src));
ok('maintenance.js asks the config for the match', /window\.atlasDiagramsFor\(item, eraKey\)/.test(src) && /window\.atlasFamilies\(sc\)/.test(src));
const iCfg = ix.indexOf('./atlas-diagrams-config.js?v='), iMaint = ix.indexOf('./maintenance.js?v=');
ok('index.html loads the config BEFORE maintenance.js', iCfg > 0 && iMaint > iCfg);
ok('the service worker pre-caches it (offline Maintenance keeps its buttons)', /'\.\/atlas-diagrams-config\.js'/.test(sw));
ok('the parts lookup registers through a maker-free hook', /ITEM_PARTS_LIST_SOURCES/.test(ad) && !/atlas/i.test((ad.match(/function _partsForItem[\s\S]*?\n}\n/) || [''])[0]));
ok('the config registers Atlas on that hook', Array.isArray(W.ITEM_PARTS_LIST_SOURCES) && W.ITEM_PARTS_LIST_SOURCES.indexOf(W.atlasItemPartsLists) >= 0);
ok('the Maintenance picker hands the item itself to the lookup', /_partsForItem\(num, tg\.item && tg\.item\._era, tg\.item\)/.test(src));

section("Brad's ET44 — honest about what Atlas has not published");
const et44 = { itemNum: '30138671', itemType: 'Diesel Locomotive', subType: 'ET44 Locomotive', description: 'Union Pacific (Yellow/Red/Gray)' };
ok('no match for an ET44 on O (Atlas has no such sheet)', lifted.one(et44, 'atlas') === null);
const famO = lifted.fam('O');
ok('the O families Atlas covers are named, and are locomotives only', famO.length >= 12 && famO.every(f => !/box car|hopper|tank|caboose|gondola|flat car|reefer|sleeper|dome/i.test(f)), famO.join(', '));
ok('…including the Erie Built', famO.some(f => /FM Erie Built/.test(f)), famO.join(', '));
ok('…and no HO family leaks into the O list', !famO.some(f => /MP15DC|DASH 8|U30|SD-24|SD-26|AEM-7\/ALP-44 Loco$/.test(f)), famO.join(', '));
ok('the no-match line says Atlas has not published one, and names the list', /Atlas hasn\\'t published a parts diagram for this model/.test(src) && /list covers: ' \+ _esc\(_atlasFam\.join/.test(src));

section('Locomotives — the model key');
const gp35 = { subType: 'GP35 Locomotive', description: 'Union Pacific (Yellow/Gray)' };
const hit = lifted.one(gp35, 'atlas');
ok('an Atlas O GP35 (model only in Sub Type) lands on its own sheet', !!hit && /^O GP-35/.test(hit.t), hit && hit.t);
const all = lifted.all(gp35, 'atlas');
ok('the whole family comes back: body, chassis, trucks', all && all.length === 3 && /Body/.test(all[0].t) && all.some(e => /Chassis/.test(e.t)) && all.some(e => /Trucks/.test(e.t)), titles(all));
ok('description-only still works (old rows that named the model there)', !!lifted.one({ description: 'SD40 Diesel' }, 'atlas'));
ok('an FM Erie Built → the O Erie Built sheet', /^O FM Erie Built/.test((lifted.one({ subType: 'FM Erie Built Locomotive (Powered)' }, 'atlas') || {}).t || ''));
ok('an N-scale item never gets an O sheet', /^N /.test((lifted.one(gp35, 'atlas_n') || { t: 'N ' }).t));
ok('a non-Atlas era gets nothing', lifted.one(gp35, 'mpc') === null && lifted.one(gp35, null) === null);
const sd50 = lifted.all({ subType: 'SD-50, SD-60, SD-60M' }, 'atlas_n');
ok('a Sub Type naming three models gets all three families (was: only SD60M)', sd50 && ['SD-50', 'SD-60 Loco', 'SD60M'].every(w => titles(sd50).indexOf(w) >= 0), titles(sd50));
const gp402 = lifted.all({ subType: 'GP40-2' }, 'atlas_ho');
ok('GP40-2 → the GP40-2 sheets, not the GP-40 ones (the longer key wins)', gp402 && gp402.every(e => /GP40-2/.test(e.t)) && !gp402.some(e => /GP40-2W/.test(e.t)), titles(gp402));
ok('an N GP40-2W keeps the N GP-40-2 sheet it had', /N GP-40-2 Loco/.test(titles(lifted.all({ subType: 'GP40-2W' }, 'atlas_n'))));

section('The false matches the old matcher made (each was on the real master)');
ok('HO "PS-2 Hopper" (373 rows) no longer gets the S-2 LOCOMOTIVE sheet', lifted.all({ subType: 'PS-2 Hopper', itemType: 'Hopper' }, 'atlas_ho') === null);
ok('HO "RS-2" style partial words: "UNION PACIFIC D.S. 1325" is not an S-1', !/S-1/.test(titles(lifted.all({ subType: 'H15-44 & H16-44', description: 'UNION PACIFIC D.S. 1325' }, 'atlas_ho'))));
ok('O "40\' PS-1 Box Car w. 6\' Door" no longer gets the 50\' PS-1 sheets', lifted.all({ subType: "40' PS-1 Box Car w. 6' Door" }, 'atlas') === null);
ok('O "AAR 70 Ton 3-Bay Open Hopper" no longer gets the cylindrical-hopper sheet', lifted.all({ subType: 'AAR 70 Ton 3-Bay Open Hopper' }, 'atlas') === null);
ok('O "F-7 … A-Unit" no longer gets the C630 sheets', lifted.all({ subType: 'F-7 Phase 1 Early A-Unit Locomotive', description: 'Santa Fe #630' }, 'atlas') === null);

section('Freight cars — the exact Sub Type');
ok('N "40\' Wood Reefer" (263 rows, never matched before) → its sheet', /N 40' Wood Reefer/.test(titles(lifted.all({ subType: "40' Wood Reefer" }, 'atlas_n'))));
ok('N "60\' Auto Parts Box Car" → both door versions', lifted.all({ subType: "60' Auto Parts Box Car" }, 'atlas_n').length === 2);
ok('O Trainman® 40\' Plug Door → the TM plug-door sheet', /O TM 40' Plug Door/.test(titles(lifted.all({ subType: "Trainman® 40' Plug Door Box Car" }, 'atlas'))));
// v0.9.1803 (Brad said yes 2026-09-26): eight sheets reached no item. Each
// match below was proved on the live master: the items' Reference Link is the
// SAME Atlas archive page as the car the sheet is for (the plain O 40'/52'6"
// rows are noted "Trainman Line" and share the Trainman® rows' page). 799 rows.
const T = (st, era, tp) => titles(lifted.all({ subType: st, trackPower: tp }, era));
ok('O plain "40\' Plug Door Box Car" (Trainman Line, 68 rows) → the TM plug-door sheet, own rail', T("40' Plug Door Box Car", 'atlas', '2-Rail') === "O TM 40' Plug Door Box Car (2-Rail)" && T("40' Plug Door Box Car", 'atlas', '3-Rail') === "O TM 40' Plug Door Box Car (3-Rail)");
ok('O plain "40\' Sliding Door Box Car" (92 rows) → the TM sliding-door sheet', T("40' Sliding Door Box Car", 'atlas', '3-Rail') === "O TM 40' Sliding Door Box Car (3-Rail)");
ok('O "40ft Stock Car" (48 rows) → the TM stock-car sheet', T('40ft Stock Car', 'atlas', '2-Rail') === "O TM 40' Stock Car (2-Rail)");
ok('O "52’6” Gondola" (curly quotes, as in the sheet; 82 rows) → the TM gondola sheet', T('52’6” Gondola', 'atlas', '3-Rail') === "O TM 52' Gondola (3-Rail)");
ok('O "60\' Single Door Box Car" (auto-parts page, 48 rows) → the single-door auto-parts sheet only', T("60' Single Door Box Car", 'atlas', '3-Rail') === "O 60' Auto Parts Box Car Single Door");
ok('O "60\' Double Door Box Car" (74 rows) → the double-door auto-parts sheet only', T("60' Double Door Box Car", 'atlas', '2-Rail') === "O 60' Auto Parts Box Car Double Door");
ok('O "40\' Wood Refrigerator Car" (238 rows) → the O 40\' Wood Reefer sheet, own rail', T("40' Wood Refrigerator Car", 'atlas', '2-Rail') === "O 40' Wood Reefer (2-Rail)" && T("40' Wood Refrigerator Car", 'atlas', '3-Rail') === "O 40' Wood Reefer (3-Rail)");
ok('N "45\' Pines Trailers" (149 rows) → the N 45\' Pines Trailer sheet', T("45' Pines Trailers", 'atlas_n') === "N 45' Pines Trailer");
ok('…the neighbours stay unmatched: O 36\' and Re-Built wood reefers, O 60\' Baggage Car, N 50\' Double Door', [["36' Wood Refrigerator Cars", 'atlas'], ["40' Re-Built Wood Refrigerator Car", 'atlas'], ["60' Baggage Car", 'atlas'], ["50' Double Door Box Car", 'atlas_n']].every(([st, era]) => lifted.all({ subType: st }, era) === null));
ok('a freight car is never matched by a model key (the words are lengths and tons)', DOCS.every(e => !e.st || !e.m));
ok('no freight-car sheet is reachable by a bare length key like "40" or "50"', DOCS.every(e => !/^(\d{1,3})(\|\d{1,3})*$/.test(e.m)));

section('O scale — the item\'s own rail');
ok('a 2-Rail GP35 gets the 2-rail sheets (was: 3-rail for every O engine)', lifted.all({ subType: 'GP-35 Locomotive', trackPower: '2-Rail DC' }, 'atlas').every(e => e.r === '2'));
ok('a 3-Rail TMCC GP35 gets the 3-rail sheets', lifted.all({ subType: 'GP-35 Locomotive', trackPower: '3-Rail TMCC' }, 'atlas').every(e => e.r === '3'));
ok('no rail said → 3-rail, as before', lifted.all({ subType: 'GP-35 Locomotive' }, 'atlas').every(e => e.r === '3'));
ok('a 2-Rail Gold car gets 2-rail sheets too', lifted.all({ subType: '3-Bay Cylindrical Hopper', trackPower: '2-Rail Gold' }, 'atlas').every(e => e.r === '2'));

section('The list itself');
ok('every sheet has a real scale (13 were filed as "?" and unreachable)', DOCS.every(e => /^(O|HO|N|Z)$/.test(e.s)), DOCS.filter(e => !/^(O|HO|N|Z)$/.test(e.s)).map(e => e.t).join('; '));
ok('no sheet titled "HO …" is tagged O, and so on', DOCS.every(e => e.t.indexOf(e.s + ' ') === 0));
ok('no address carries an HTML-escaped ampersand (the two SD-24 & SD-35 truck sheets were dead links)', DOCS.every(e => e.u.indexOf('&amp;') < 0) && DOCS.filter(e => /SD24%20%26%20SD35/.test(e.u)).length === 2);
ok('every address is unique — it is the key the parts are filed under', new Set(DOCS.map(e => e.u)).size === DOCS.length);
ok('no year is used as a model key (a "#2017" road number is not a GP-38)', DOCS.every(e => !e.m.split('|').some(k => /^(19|20)\d\d$/.test(k))));

section('The parts — real rows from the Atlas Parts tab (2026-09-26)');
const H = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'harvests', 'atlas-parts-2026-09-26.json'), 'utf8'));
const hdr = H.header, C = n => hdr.indexOf(n);
ok('the tab layout: MTH Parts\' 27 columns + "Check Note" at the end', hdr.length === 28 && hdr[26] === 'Parts Lists' && hdr[27] === 'Check Note');
ok('3,546 rows, O and HO', H.rows.length === 3546 && H.rows.every(r => r[8] === 'O' || r[8] === 'HO'));
const U = new Set(DOCS.map(e => e.u));
ok('every "Parts Lists" entry is a diagram address the matcher knows', H.rows.every(r => r[C('Parts Lists')].split('; ').every(p => U.has(p))));
ok('no part number with an unreadable digit was written', H.rows.every(r => r[0].indexOf('?') < 0));
ok('one row per number + name within a scale (Variation keeps doubles apart)', new Set(H.rows.map(r => r[8] + '|' + r[0] + '|' + r[10])).size === H.rows.length);
ok('every Check Note ends "confirm with Atlas when ordering."', H.rows.every(r => !r[27] || /confirm with Atlas when ordering\.$/.test(r[27])));
const rowsObj = H.rows.map(r => ({ itemNum: r[0], itemType: r[1], description: r[7], variation: r[10], refLink: r[12], partsLists: r[26], checkNote: r[27], _era: 'atlas_parts', _tab: 'Atlas Parts' }));

function grabIn(s, sig) { const i = s.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = s.indexOf('{', i); k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); } } return ''; }
const idxVars = (ad.match(/var _fitsIdx = null, _fitsIdxRows = null, _fitsIdxLen = -1;/) || [''])[0];
const ERAS_MFR = { atlas_parts: { manufacturer: 'Atlas' }, atlas: { manufacturer: 'Atlas' }, atlas_ho: { manufacturer: 'Atlas' }, atlas_n: { manufacturer: 'Atlas' }, pw: { manufacturer: 'Lionel' }, lionel_parts: { manufacturer: 'Lionel' } };
function build(srcAd, win) {
  const body = idxVars + '\n' + grabIn(srcAd, 'function _partsFitsIndex()') + '\n' + grabIn(srcAd, 'function _partsMakerOf(era)') + '\n' + grabIn(srcAd, 'function _partsForItem(itemNum, forEra, item)') + '\nreturn _partsForItem;';
  return rows => new Function('state', 'baseItemNum', 'ERAS', 'window', body)({ masterAllRows: rows, masterData: [] }, k => k, ERAS_MFR, win);
}
const pfi = build(ad, W)(rowsObj);
const gp35item = { itemNum: '1162-2', subType: 'GP-35 Locomotive', trackPower: '3-Rail', _era: 'atlas' };
const got = pfi(gp35item.itemNum, 'atlas', gp35item);
const want3 = new Set(lifted.all(gp35item, 'atlas').map(e => e.u));
const expect = rowsObj.filter(r => r.partsLists.split('; ').some(p => want3.has(p)));
ok('an O GP-35 (3-rail) is offered every part printed on its three 3-rail sheets: ' + got.length, got.length > 100 && got.length === expect.length, got.length + ' vs ' + expect.length);
ok('…and not one part from a 2-rail-only sheet', got.every(r => r.partsLists.split('; ').some(p => want3.has(p))));
const two = pfi('2133-2', 'atlas', { itemNum: '2133-2', subType: 'GP-35 Locomotive', trackPower: '2-Rail DC' });
ok('the same model in 2-rail gets the 2-rail parts', two.length > 100 && two.map(r => r.itemNum).join() !== got.map(r => r.itemNum).join());
const noted = got.filter(r => r.checkNote);
ok('doubtful parts carry their note through to the item (' + noted.length + ' on the GP-35)', noted.length > 0 && noted.every(r => /confirm with Atlas/.test(r.checkNote)));
ok('a number printed with two names comes back as BOTH rows (no silent dedupe)', (() => { const by = {}; rowsObj.forEach(r => { const k = r.itemNum; by[k] = (by[k] || 0) + 1; }); return Object.keys(by).some(k => by[k] > 1); })());
ok('an HO PS-2 Hopper gets no parts at all', pfi('1234', 'atlas_ho', { itemNum: '1234', subType: 'PS-2 Hopper', _era: 'atlas_ho' }).length === 0);
ok('a LIONEL item never gets Atlas parts (maker guard)', pfi('1162-2', 'pw', { itemNum: '1162-2', subType: 'GP-35 Locomotive' }).length === 0);
ok('with no item handed in, nothing changes for callers that only pass a number', pfi('1162-2', 'atlas').length === 0);

section('The note is shown under the part');
ok('the popup lane and the drawer line both draw the Check Note', /_checkNoteHtml\(r\.checkNote\)/.test(src) && /_checkNoteHtml\(f\.checkNote\)/.test(src));
const cn = new Function(grabIn(src, 'function _checkNoteHtml(note)') + '\nreturn _checkNoteHtml;').call(null);
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cnF = new Function('_esc', grabIn(src, 'function _checkNoteHtml(note)') + '\nreturn _checkNoteHtml;')(_esc);
ok('an empty note draws nothing', cnF('') === '' && cnF(null) === '' && cnF('   ') === '');
ok('a note is drawn escaped, as written', /confirm with Atlas/.test(cnF('A & B <x> - confirm with Atlas when ordering.')) && cnF('<b>').indexOf('<b>') < 0);
ok('MASTER_COL_SPEC reads "Check Note" by name', /\['checkNote',\s*null,\s*\['checknote'\]\]/.test(ad));
ok('Variation numbers on Atlas parts are not shown (they only keep two names apart)', /partsVarIsIndex: true/.test(conf) && /!era\.partsVarIsIndex/.test(src));

section('The era is wired like the other parts catalogs');
ok('ERAS: atlas_parts, maker Atlas, its link is Atlas\'s own diagram', /atlas_parts:\s*\{\s*id:\s*'atlas_parts',\s*label:\s*'Atlas Parts'[^}]*manufacturer:\s*'Atlas'[^}]*partsOfficial:\s*true/.test(conf));
ok('LOOKUP-ONLY, REAL_ERA_IDS, blank scale, tab "Atlas Parts"', /LOOKUP_ONLY_ERAS = \[[^\]]*'atlas_parts'/.test(conf) && /REAL_ERA_IDS\s*=\s*\[[^\]]*'atlas_parts'/.test(conf) && /atlas_parts:\s*'',/.test(conf) && /atlas_parts:\s*\{\s*items:\s*'Atlas Parts'\s*\}/.test(conf));
const br = rd('browse.js'), ob = rd('onboarding-config.js');
ok('browse period, eraScale and eraColors stay complete', /atlas_parts:\s*'modern'/.test(br) && /atlas_parts:\s*'o'/.test(ob) && /eraColors\.atlas_parts = WHAT_I_COLLECT\.eraColors\.atlas;/.test(ob));

section('Planted offenders — each must turn a check red');
function offCfg(from, to) { if (cfgSrc.indexOf(from) < 0) return null; return load(cfgSrc.replace(from, to)); }
const o1 = offCfg('if (starts[p] && ends[p + k.length])', 'if (true)');
ok('OFFENDER: drop the word-edge rule → PS-2 Hopper gets the S-2 loco again', !!o1 && o1.atlasDiagramsFor({ subType: 'PS-2 Hopper' }, 'atlas_ho') !== null);
const o2 = offCfg("var want = /2[\\s-]*rail/i.test(tp) ? '2' : '3';", "var want = '3';");
ok('OFFENDER: ignore the item\'s rail → a 2-rail GP35 gets 3-rail sheets', !!o2 && o2.atlasDiagramsFor({ subType: 'GP-35 Locomotive', trackPower: '2-Rail DC' }, 'atlas').some(e => e.r === '3'));
const o3 = offCfg('var inside = occ.some(', 'var inside = false && occ.some(');
ok('OFFENDER: drop the longer-key rule → GP40-2 also gets GP-40 sheets', !!o3 && /GP-40 \(2017\)|GP-40 High Hood/.test(titles(o3.atlasDiagramsFor({ subType: 'GP40-2' }, 'atlas_ho'))));
const o4 = offCfg('if (!hits.length) {', 'if (true) {');
ok('OFFENDER: let freight cars fall through to keys too → nothing changes (st entries carry no keys)', !!o4 && titles(o4.atlasDiagramsFor({ subType: "40' Wood Reefer" }, 'atlas_n')) === titles(lifted.all({ subType: "40' Wood Reefer" }, 'atlas_n')));
const adOff = ad.replace('window.ITEM_PARTS_LIST_SOURCES.forEach(', '[].forEach(');
ok('OFFENDER: skip the item hook in _partsForItem → the GP-35 gets no Atlas parts', adOff !== ad && build(adOff, W)(rowsObj)('1162-2', 'atlas', gp35item).length === 0);

// ── against a full master pull, when one is on this machine ─────────
section('Against a real master pull, when one is on this machine');
const dump = '/tmp/claude-0/master/master_AL.json';
if (fs.existsSync(dump)) {
  const D = JSON.parse(fs.readFileSync(dump, 'utf8'));
  const norm = h => String(h).toLowerCase().replace(/[^a-z]/g, '');
  let total = 0, matched = 0;
  for (const [tab, era] of [['Atlas O', 'atlas'], ['Atlas HO', 'atlas_ho'], ['Atlas N', 'atlas_n']]) {
    const vals = D[tab]; const h2 = vals[0].map(norm);
    const ct = h2.indexOf('itemtype'), cs = h2.indexOf('subtype'), cd = h2.indexOf('description');
    for (let n = 1; n < vals.length; n++) { const r = vals[n]; if (!/Locomotive/.test(r[ct] || '')) continue; total++; if (lifted.one({ subType: r[cs] || '', description: r[cd] || '' }, era)) matched++; }
  }
  ok('Atlas locomotives that find a sheet: ' + matched + ' of ' + total, matched > 11000, String(matched));
} else {
  console.log('  SKIP  no master pull at ' + dump);
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
