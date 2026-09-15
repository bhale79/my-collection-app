// ═══════════════════════════════════════════════════════════════
// workbench_actions_tests.js — v0.9.1751.
//
// Brad (2026-09-15, Workbench screenshot): "need a add task button, and add
// parts button. need filters for waiting on parts, ready to perform, then
// probably would be good to have history of maintenance button that show
// things we have done in the past."
//
// Rules pinned here:
//  · the bench has + Add task / + Add part, three filter chips (All ·
//    Waiting on parts · Ready to work, remembered per device) and a third
//    tab, History;
//  · ONE save path per thing: the Workbench cards drive the SAME writers
//    the Maintenance card uses (_maintAddChore, _maintPartsPopup →
//    _maintPopAddWanted / _maintBinUse), pointed at the picked unit through
//    _target() — no second copy of the sheet-writing code;
//  · "waiting" = a linked part still on order; anything else is ready;
//  · History = everything not an open task, newest first;
//  · the item picker lists OWNED copies by inventoryId, boxes excluded.
// Run:  node tests/workbench_actions_tests.js
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
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function fnBody(sig) {
  // the body of `window.X = function (…) {…}` / `function X(…) {…}`
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0, start = src.indexOf('{', i);
  for (let k = start; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(start, k + 1); } }
  return '';
}

section('The bench rows and their "waiting" flag (_wbRows lifted)');
const MASTER = { '2343': { itemNum: '2343', roadName: 'Santa Fe' }, '84631': { itemNum: '84631', roadName: 'Union Pacific' }, '2338': { itemNum: '2338', roadName: 'Milwaukee Road' } };
const state = {
  maintLog: [
    { id: 'log-1', invId: 'i1', itemNum: '84631', type: 'chore', text: 'Replace traction tire', status: 'open', dateAdded: '2026-09-05' },
    { id: 'log-2', invId: 'i2', itemNum: '2338', type: 'chore', text: 'add decal', status: 'open', dateAdded: '2026-09-12' },
    { id: 'log-3', invId: 'i3', itemNum: '2343', type: 'chore', text: 'Oil / lubricate', status: 'open', dateAdded: '2026-09-01' },
    { id: 'log-4', invId: 'i3', itemNum: '2343', type: 'chore', text: 'E-unit service', status: 'done', dateAdded: '2026-08-01', dateDone: '2026-08-09', by: 'self', notes: 'new drum' },
    { id: 'log-5', invId: 'i1', itemNum: '84631', type: 'part-installed', text: 'Traction tire', partNum: '600-8632-050', status: 'done', dateAdded: '2026-09-14', dateDone: '2026-09-14' },
  ],
  partsData: {
    p1: { id: 'p1', taskId: 'log-1', forInv: 'i1', forItem: '84631', description: 'TRACTION TIRE', status: 'wanted', dateAdded: '2026-09-05' },
    p2: { id: 'p2', taskId: 'log-2', forInv: 'i2', forItem: '2338', description: '2329-6 decal', status: 'bought', dateAdded: '2026-09-12' },
    p3: { id: 'p3', forInv: 'i9', forItem: '671', description: 'smoke unit', status: 'wanted', dateAdded: '2026-09-10' },
  },
};
const rowsFn = new Function('state', grab('function _wbRows()') + '\nreturn _wbRows;')(state);
const rows = rowsFn();
const byNeed = {}; rows.forEach(r => { byNeed[r.itemNum + '|' + r.need] = r; });
ok('four rows: three open tasks + one loose part wanted', rows.length === 4, JSON.stringify(rows.map(r => r.itemNum + '|' + r.need)));
ok('a task whose linked part is still on order is WAITING', byNeed['84631|Replace traction tire'] && byNeed['84631|Replace traction tire'].waiting === true);
ok('a task whose part is on hand is READY', byNeed['2338|add decal'] && byNeed['2338|add decal'].waiting === false && /Parts on hand/.test(byNeed['2338|add decal'].part));
ok('a task with no part at all is READY', byNeed['2343|Oil / lubricate'] && byNeed['2343|Oil / lubricate'].waiting === false && byNeed['2343|Oil / lubricate'].part === '');
ok('a loose part wanted (no task) is its own WAITING row', byNeed['671|Part wanted'] && byNeed['671|Part wanted'].waiting === true);
ok('rows sort by item number, numerically', rows.map(r => r.itemNum).join(',') === '671,2338,2343,84631', rows.map(r => r.itemNum).join(','));

section('History (_wbHistory lifted)');
const histFn = new Function('state', grab('function _wbHistory()') + '\nreturn _wbHistory;')(state);
const hist = histFn();
ok('open tasks are NOT history; finished tasks and installed parts are', hist.length === 2 && hist.every(l => !(l.type === 'chore' && l.status === 'open')));
ok('newest first (by the date it was done)', hist[0].id === 'log-5' && hist[1].id === 'log-4');

section('The item picker (_wbOwned lifted)');
const pstate = { personalData: {
  a: { inventoryId: 'i1', itemNum: '84631', owned: true, variation: '' },
  b: { inventoryId: 'i2', itemNum: '2338', owned: true, variation: '2' },
  c: { inventoryId: 'i7', itemNum: '2343', owned: false, variation: '' },          // a want, not owned
  d: { inventoryId: '', itemNum: '671', owned: true },                            // no unit identity → not pickable
  e: { inventoryId: 'i8', itemNum: '6464-BOX', owned: true },                      // a box
} };
const ownedFn = new Function('state', 'findMaster', '_isBoxItemNum', grab('function _wbOwned()') + '\nreturn _wbOwned;')(
  pstate, (n) => MASTER[String(n)] || null, (n) => /BOX/.test(String(n)));
const owned = ownedFn();
ok('only OWNED copies with an inventoryId, boxes left out', owned.map(o => o.invId).join(',') === 'i2,i1', JSON.stringify(owned));
ok('each carries the road name for the list, and is keyed by the unit', owned[1].road === 'Union Pacific' && owned[0].variation === '2');

section('One save path — the Workbench cards drive the card\'s own writers');
const addChore = fnBody('window._maintAddChore = async function ()');
const popup = fnBody('window._maintPartsPopup = function (taskId, taskName)');
const addWanted = fnBody('window._maintPopAddWanted = async function (taskId)');
const binUse = fnBody('window._maintBinUse = async function (binId, taskId)');
const popSearch = fnBody('window._maintPopSearch = function ()');
ok('_target() = the Workbench pick when set, else the Maintenance card\'s item', /function _target\(\) \{\s*if \(_wbTarget && _wbTarget\.item\) return _wbTarget;\s*return \{ item: _panelItem, invId: String\(window\._maintPanelInvId \|\| ''\) \};/.test(src));
ok('_maintAddChore writes the task for _target(), not _panelItem', /var tg = _target\(\);/.test(addChore) && !/_panelItem/.test(addChore) && /_t\(tg\.invId \|\| ''\), _t\(String\(tg\.item\.itemNum \|\| ''\)\)/.test(addChore));
ok('…and closes the Workbench card when it came from there', /if \(_wbTarget\) _wbCloseCard\(\);/.test(addChore));
ok('_maintPartsPopup, _maintPopAddWanted, _maintBinUse and _maintPopSearch all go through _target()', [popup, addWanted, binUse, popSearch].every(b => /var tg = _target\(\);/.test(b) && !/_panelItem/.test(b)));
ok('a part added with no task is filed for the UNIT (blank task id, "from the Workbench")', /taskId \? 'for Workbench task' : 'from the Workbench'/.test(addWanted) && /taskId: taskId \|\| ''/.test(addWanted) && /_partsAppendRow\(fields\)/.test(addWanted)   /* v0.9.1753: the row goes through the one builder/appender */);
ok('the chore picker is ONE helper, used by the card and by the Workbench card', (src.match(/_choreFormHtml\('_maintAddChore\(\)'\)/g) || []).length === 2 && /function _choreFormHtml\(addJs\)/.test(src));
ok('opening the Maintenance card resets the Workbench target', /_panelItem = item;\s*\n\s*window\._maintPanelInvId = [^\n]*\n\s*_wbTarget = null;/.test(src));
ok('the Workbench pick is keyed by inventoryId and resolved through findMaster', /window\._wbPicked = function \(invId\) \{[\s\S]*?_wbOwned\(\)\.find\(function \(x\) \{ return x\.invId === String\(invId\); \}\)[\s\S]*?findMaster\(o\.itemNum, o\.variation\)/.test(src));
ok('a part for a unit with open tasks first asks which job (or none)', /Add a part — for which job\?/.test(src) && /_wbPartFor\(\\'\\'\)/.test(src));

section('The page: buttons, filter chips, History tab');
const build = fnBody('function _wbBuild()');
ok('+ Add task and + Add part buttons on the bench', /onclick="_wbAddTask\(\)"/.test(build) && /onclick="_wbAddPart\(\)"/.test(build));
ok('three filter chips: All · Waiting on parts · Ready to work', /WB_FILTERS = \[\['all', 'All'\], \['waiting', 'Waiting on parts'\], \['ready', 'Ready to work'\]\]/.test(src) && /_wbFilter\(\\'' \+ x\[0\] \+ '\\'\)/.test(build));
ok('the chip is remembered per device (pref), and unknown values fall back to All', /MAINT\.PREF_WB_FILTER = 'maint_wb_filter'/.test(src) && /_prefSet\(MAINT\.PREF_WB_FILTER, f\)/.test(src) && /return WB_FILTERS\.some\(function \(x\) \{ return x\[0\] === f; \}\) \? f : 'all';/.test(src));
ok('waiting filter keeps only waiting rows; ready keeps the rest', /f === 'waiting' \? rows\.filter\(function \(r\) \{ return r\.waiting; \}\) : f === 'ready' \? rows\.filter\(function \(r\) \{ return !r\.waiting; \}\) : rows/.test(build));
ok('History is the third tab, with its count', /_wbTab\(\\'history\\'\)[^<]*History' \+ \(hist\.length \? ' · ' \+ hist\.length : ''\)/.test(build) && /\(name === 'history'\) \? 'history'/.test(src));
ok('History rows open the entry in place — no stale per-item card', /window\._wbHistOpen = function \(logId\) \{ window\._wbHistoryCtx = null; window\._maintEditEntry\(logId\); \};/.test(src)
   && /var ctx = window\._wbHistoryCtx; if \(ctx\) window\._maintShowHistory\(ctx\.invId, ctx\.itemNum\);/.test(src));
ok('History has a search box', /id="wb-hist-q"/.test(build) && /oninput="_wbHistSearch\(this\.value\)"/.test(build));
ok('overlays wire through BackStack (device back closes them)', /BackStack\.wire\(document\.getElementById\('wb-card'\)\)/.test(src));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
