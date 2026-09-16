// ═══════════════════════════════════════════════════════════════
// yardmaster_tabs_tests.js — v0.9.1754.
//
// Brad (2026-09-15): the Office's Edit dropdown "has no Lionel PW - Boxes /
// Paper / Sets / Other / Catalogs and no Lionel MPC-Modern - Catalogs", so
// 1409W (a set) sat stranded as a READY row with nowhere to go.
//
// Rules pinned here:
//  · MASTER_TAB_SHAPES (config.js) is the ONE place that says which tab keys
//    the Office may file into and how a queue row lands on a Sets / Catalogs
//    tab; _ymMasterTabs (dropdown + commit targets), _ymTabShape, _ymNumberCol
//    and _ymMasterCell all read it — no second list anywhere;
//  · the tab list keeps every era's items tab FIRST, then that era's other
//    allowed tabs; companions / instruction sheets are never offered;
//  · items-layout tabs (Boxes, Paper, Other, Science, Construction, Service
//    Tools) use the standard header mapping unchanged;
//  · a Sets row: Set Number ← number, Set Name ← description, Year, Gauge,
//    Notes ← notes + the approval trail; every other Sets column stays blank;
//  · a Catalogs row: Catalog ID ← number, Title ← description, Type, Year,
//    Notes ← notes + trail; the 3-column MPC-Modern layout: Catalog Name ←
//    description, Description ← notes + trail;
//  · the commit's duplicate check reads each tab's OWN number column and
//    compares the field that fills it; a tab with none stops the commit
//    before any write; the Image URL column is only ever added to an
//    items-layout tab.
// Run:  node tests/yardmaster_tabs_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const ym = fs.readFileSync(path.join(APP, 'yardmaster.js'), 'utf8');
const cfg = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}

section('The config block (config.js) — the one place');
const shapesSrc = grab(cfg, 'const MASTER_TAB_SHAPES = {');
ok('MASTER_TAB_SHAPES exists in config.js', shapesSrc.length > 0);
const SHAPES = new Function(shapesSrc + '\nreturn MASTER_TAB_SHAPES;')();
ok('items-layout keys: items, boxes, paper, other, science, construction, serviceTools', JSON.stringify(SHAPES.itemShaped) === JSON.stringify(['items', 'boxes', 'paper', 'other', 'science', 'construction', 'serviceTools']), JSON.stringify(SHAPES.itemShaped));
ok('special shapes: sets and catalogs only (companions / instrSheets never)', Object.keys(SHAPES.special).sort().join(',') === 'catalogs,sets');
ok('sets: duplicate check on Set Number; number → Set Number, description → Set Name, notes carry the trail', SHAPES.special.sets.numberHeaders[0] === 'Set Number' && SHAPES.special.sets.map['Set Number'] === 'num' && SHAPES.special.sets.map['Set Name'] === 'desc' && SHAPES.special.sets.map['Notes'] === 'notesWithTrail');
ok('catalogs: Catalog ID first, Catalog Name as the 3-column fallback', JSON.stringify(SHAPES.special.catalogs.numberHeaders) === JSON.stringify(['Catalog ID', 'Catalog Name']) && SHAPES.special.catalogs.map['Title'] === 'desc' && SHAPES.special.catalogs.map['Catalog Name'] === 'desc');

section('The lifted functions on a fixture');
const FIX = {
  REAL_ERA_IDS: ['pw', 'mpc', 'marx'],
  ERA_TABS: {
    pw: { items: 'Lionel PW - Items', boxes: 'Lionel PW - Boxes', science: 'Lionel PW - Science', construction: 'Lionel PW - Construction', paper: 'Lionel PW - Paper', other: 'Lionel PW - Other', serviceTools: 'Lionel PW - Service Tools', catalogs: 'Lionel PW - Catalogs', companions: 'Lionel PW - Companions', sets: 'Lionel PW - Sets', instrSheets: 'Lionel PW - Instruction Sheets' },
    mpc: { items: 'Lionel MPC-Modern', catalogs: 'Lionel MPC-Modern - Catalogs' },
    marx: { items: 'Marx O' },
    ghost: { items: 'Not a real era' },
  },
};
const lifted = new Function('REAL_ERA_IDS', 'ERA_TABS', 'MASTER_TAB_SHAPES',
  grab(ym, 'function _ymMasterTabs()') + '\n' + grab(ym, 'function _ymTabShape(') + '\n' + grab(ym, 'function _ymNumberCol(') + '\n' + grab(ym, 'function _ymMasterCell(')
  + '\nreturn { tabs: _ymMasterTabs, shape: _ymTabShape, numCol: _ymNumberCol, cell: _ymMasterCell };')(FIX.REAL_ERA_IDS, FIX.ERA_TABS, SHAPES);

const tabs = lifted.tabs();
ok('the list: items tab first for each era, then that era\'s other allowed tabs',
  tabs.indexOf('Lionel PW - Items') === 0 && tabs.indexOf('Lionel MPC-Modern') > tabs.indexOf('Lionel PW - Catalogs') && tabs.indexOf('Marx O') === tabs.length - 1, JSON.stringify(tabs));
ok('Boxes / Paper / Other / Science / Construction / Service Tools / Sets / Catalogs are all offered',
  ['Lionel PW - Boxes', 'Lionel PW - Paper', 'Lionel PW - Other', 'Lionel PW - Science', 'Lionel PW - Construction', 'Lionel PW - Service Tools', 'Lionel PW - Sets', 'Lionel PW - Catalogs', 'Lionel MPC-Modern - Catalogs'].every(t => tabs.indexOf(t) >= 0));
ok('Companions and Instruction Sheets are never offered; an era not in REAL_ERA_IDS is not offered',
  tabs.indexOf('Lionel PW - Companions') < 0 && tabs.indexOf('Lionel PW - Instruction Sheets') < 0 && tabs.indexOf('Not a real era') < 0);
ok('no duplicates in the list', new Set(tabs).size === tabs.length);
ok('without the config the list falls back to items tabs only (older config.js)', JSON.stringify(new Function('REAL_ERA_IDS', 'ERA_TABS', grab(ym, 'function _ymMasterTabs()') + '\nreturn _ymMasterTabs();')(FIX.REAL_ERA_IDS, FIX.ERA_TABS)) === JSON.stringify(['Lionel PW - Items', 'Lionel MPC-Modern', 'Marx O']));

ok('shape: an items-layout tab is null (standard mapping)', lifted.shape('Lionel PW - Items') === null && lifted.shape('Lionel PW - Boxes') === null && lifted.shape('Marx O') === null);
ok('shape: the Sets tab and both Catalogs tabs resolve to their config', lifted.shape('Lionel PW - Sets') === SHAPES.special.sets && lifted.shape('Lionel PW - Catalogs') === SHAPES.special.catalogs && lifted.shape('Lionel MPC-Modern - Catalogs') === SHAPES.special.catalogs);

const SETS_HEADS = ['Set Number', 'Set Name', 'Year', 'Gauge', 'Retail Price', 'Steam Engine', 'Tender', 'Diesel Powered', 'Diesel B-Unit', 'Diesel A-Dummy', 'Car 1', 'Notes'];
const CAT_HEADS = ['Catalog ID', 'Year', 'Type', 'Title', 'Has Envelope/Mailer', 'Notes'];
const MPC_HEADS = ['Year', 'Catalog Name', 'Description'];
const ITEM_HEADS = ['Item Number', 'Item Type', 'Road Name', 'Description', 'Gauge', 'Year Produced', 'Source'];
let nc = lifted.numCol(ITEM_HEADS, null);
ok('number column: items layout → Item Number, field num', nc.idx === 0 && nc.field === 'num');
nc = lifted.numCol(SETS_HEADS, SHAPES.special.sets);
ok('number column: Sets → Set Number, field num', nc.idx === 0 && nc.field === 'num' && nc.header === 'Set Number');
nc = lifted.numCol(CAT_HEADS, SHAPES.special.catalogs);
ok('number column: PW Catalogs → Catalog ID, field num', nc.idx === 0 && nc.field === 'num');
nc = lifted.numCol(MPC_HEADS, SHAPES.special.catalogs);
ok('number column: MPC-Modern Catalogs (no Catalog ID) → Catalog Name, field desc', nc.idx === 1 && nc.field === 'desc');
nc = lifted.numCol(['Foo', 'Bar'], SHAPES.special.sets);
ok('number column: a tab with none of the expected headers → -1 (the commit stops)', nc.idx === -1);

const dd = { num: '1409W', desc: 'Lionel 1409W set — 1946', years: '1946', gauge: 'O27', type: 'Set', road: '', notes: 'submitted by a member', source: 'Community queue' };
const setRow = SETS_HEADS.map(h => lifted.cell(h, dd, '2026-09-15', SHAPES.special.sets));
ok('a Sets row: Set Number ← number, Set Name ← description, Year, Gauge', setRow[0] === '1409W' && setRow[1] === 'Lionel 1409W set — 1946' && setRow[2] === '1946' && setRow[3] === 'O27');
ok('…Notes = the notes + the approval trail (no Source column on that tab)', /^submitted by a member — Community queue — approved 2026-09-15 \(Yardmaster cockpit\)$/.test(setRow[11]), setRow[11]);
ok('…every other Sets column stays blank (engine, cars, price never guessed)', setRow.slice(4, 11).every(v => v === ''));
const catRow = CAT_HEADS.map(h => lifted.cell(h, { num: 'C1957', desc: '1957 Consumer Catalog', years: '1957', type: 'Consumer', notes: '', source: 'Community queue' }, '2026-09-15', SHAPES.special.catalogs));
ok('a PW Catalogs row: Catalog ID, Year, Type, Title filled; Notes = trail alone when there are no notes', catRow[0] === 'C1957' && catRow[1] === '1957' && catRow[2] === 'Consumer' && catRow[3] === '1957 Consumer Catalog' && catRow[4] === '' && catRow[5] === 'Community queue — approved 2026-09-15 (Yardmaster cockpit)');
const mpcRow = MPC_HEADS.map(h => lifted.cell(h, { num: '1985', desc: '1985 Traditional Catalog', years: '1985', notes: 'n', source: 'Community queue' }, '2026-09-15', SHAPES.special.catalogs));
ok('an MPC-Modern Catalogs row: Year, Catalog Name ← description, Description ← notes + trail', mpcRow[0] === '1985' && mpcRow[1] === '1985 Traditional Catalog' && /^n — Community queue — approved/.test(mpcRow[2]));
const itemRow = ITEM_HEADS.map(h => lifted.cell(h, dd, '2026-09-15', null));
ok('an items-layout row is unchanged: Item Number, Item Type, Road Name, Description, Gauge, Year Produced, Source trail', itemRow[0] === '1409W' && itemRow[1] === 'Set' && itemRow[3] === 'Lionel 1409W set — 1946' && itemRow[4] === 'O27' && itemRow[5] === '1946' && itemRow[6] === 'Community queue — approved 2026-09-15 (Yardmaster cockpit)');

section('Source pins — the dropdown, the commit, the maker label');
const commit = grab(ym, 'window._ymCommit = async function ()');
ok('the Edit dropdown still lists _ymMasterTabs() (one source of truth, no hard-coded options)', /_ymMasterTabs\(\)\.map/.test(ym) && !/<option value="Lionel PW - Sets"/.test(ym));
ok('the commit resolves each tab\'s shape and number column, and compares the field that fills it', /_ymTabShape\(t2\)/.test(commit) && /_ymNumberCol\(heads, shape2\)/.test(commit) && /existing\[String\(dd\[numCol\.field\] \|\| ''\)\.trim\(\)\]/.test(commit));
ok('a tab with no number column stops the commit before any write', /if \(numIdx < 0\) throw new Error\('could not find the ' \+ numCol\.header \+ ' column on ' \+ t2/.test(commit));
ok('the Image URL column is only ever added to an items-layout tab', /var _hasImg = !plan\[t4\]\.shape && /.test(commit));
ok('rows are written through _ymMasterCell with the tab\'s shape', /_ymMasterCell\(h, dd, today, plan\[t4\]\.shape\)/.test(commit));
ok('the maker of a row filed on any tab of an era resolves (not only its items tab)', /Object\.keys\(ERA_TABS\[id\]\)\.some\(function \(k\) \{ return ERA_TABS\[id\]\[k\] === dd\.tab; \}\)/.test(grab(ym, 'function _ymDeltaMaker(dd)')));
ok('the held rules are untouched: a blank number is still held, a tab outside the list is still held', /heldNoNum\.push\(dd\)/.test(commit) && /heldNoTab\.push\(dd\)/.test(commit) && /var validTabs = _ymMasterTabs\(\);/.test(commit));

section('Page pins (the trio agrees with itself)');
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const ver = (cfg.match(/APP_VERSION = 'v0\.9\.(\d+)'/) || [])[1];
const cache = (sw.match(/CACHE_NAME = 'mca-v(\d+)'/) || [])[1];
ok('sw.js CACHE_NAME is the app version + 10', ver && cache && +cache === +ver + 10, ver + ' / ' + cache);
ok('index.html: every ?v= reads the app version (79 of them) and nothing older', ver && (idx.match(new RegExp('\\?v=' + ver, 'g')) || []).length === 79 && (idx.match(/\?v=\d+/g) || []).every(s => s === '?v=' + ver));
ok('this release is v0.9.1754 or later', ver && +ver >= 1754, ver);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
