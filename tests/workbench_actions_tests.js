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
//  · ONE save path per thing: v0.9.2042 — + Add task / + Add part ask
//    "which item?", open THAT copy's Maintenance card and press the card's
//    own buttons (the same pop-ups, the same writers) — no second door;
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
const ownedFn = new Function('state', 'findMaster', '_isBoxItemNum', grab('function _wbRowOf(pd)') + '\n' + grab('function _wbOwned()') + '\nreturn _wbOwned;')(   // 2026-10-31: + the row each copy is filed under
  pstate, (n) => MASTER[String(n)] || null, (n) => /BOX/.test(String(n)));
const owned = ownedFn();
ok('only OWNED copies with an inventoryId, boxes left out', owned.map(o => o.invId).join(',') === 'i2,i1', JSON.stringify(owned));
ok('each carries the road name for the list, and is keyed by the unit', owned[1].road === 'Union Pacific' && owned[0].variation === '2');

section('One save path — the Workbench cards drive the card\'s own writers');
const addChore = fnBody('async function _maintAddChoreRun(andPart)');   // v0.9.1858: andPart = "+ Add a part for it"; v0.9.2038: the work behind the guarded button
const popup = fnBody('window._maintPartsPopup = function (taskId, taskName)');
const addWanted = fnBody('window._maintPopAddWanted = async function (taskId)');
const binUse = fnBody('async function _maintBinUseRun(binId, taskId)');   // v0.9.2038: the work behind the guarded button
const popSearch = fnBody('window._maintPopSearch = function ()');
// v0.9.2042 ([stated] Brad: "the work bench add a task and add a part should look
// just like the maintenance buttons versions … ask that first then switch to the
// item page maintenance deal" → "yes"): ONE target — the card's item. The
// Workbench's second door (_wbTarget, its step-2 card, "for which job?") is gone.
ok('_target() = the Maintenance card\'s item, and nothing else', /function _target\(\) \{\s*return \{ item: _panelItem, invId: String\(window\._maintPanelInvId \|\| ''\) \};\s*\}/.test(src));
ok('…the Workbench\'s private target is gone from the code', !/_wbTarget\s*(=|&&|\)|\.)/.test(src) && !/_wbPartFor/.test(src) && !/Add a part — for which job\?/.test(src));
ok('_maintAddChore writes the task for _target(), not _panelItem', /var tg = _target\(\);/.test(addChore) && !/_panelItem/.test(addChore) && /_t\(tg\.invId \|\| ''\), _t\(String\(tg\.item\.itemNum \|\| ''\)\)/.test(addChore));
ok('…and redraws the bench after the save (the bench may be the page underneath)', /_maintRenderTasks\(\)/.test(addChore) && /_wbBuild\(\)/.test(src.slice(src.indexOf('async function _maintAddChoreRun(andPart)'), src.indexOf('async function _maintAddChoreRun(andPart)') + 6000)));
ok('_maintPartsPopup, _maintPopAddWanted, _maintBinUse and _maintPopSearch all go through _target()', [popup, addWanted, binUse, popSearch].every(b => /var tg = _target\(\);/.test(b) && !/_panelItem/.test(b)));
ok('a part added with no task is filed for the UNIT (blank task id, "from the Workbench")', /taskId \? 'for Workbench task' : 'from the Workbench'/.test(addWanted) && /taskId: taskId \|\| ''/.test(addWanted) && /_maintPopSaveWanted\(fields, taskId/.test(addWanted) && /_partsAppendRow\(fields\)/.test(fnBody('async function _maintPopSaveWanted(fields, taskId, retry)'))   /* v0.9.1753: the row goes through the one builder/appender; v0.9.1756: via the popup's ONE save path */);
ok('the chore picker is ONE helper, built ONCE — in the card\'s own Add-a-task pop-up', (src.match(/_choreFormHtml\('_maintAddChore\(\)'\)/g) || []).length === 1 && /function _choreFormHtml\(addJs\)/.test(src));
ok('the Workbench pick is keyed by inventoryId and opens THAT copy\'s card (_wbOpen by inventoryId)', /window\._wbPicked = function \(invId\) \{[\s\S]*?_wbOwned\(\)\.find\(function \(x\) \{ return x\.invId === String\(invId\); \}\)[\s\S]*?window\._wbOpen\(o\.invId, o\.itemNum, '', purpose\);/.test(src));

section('v0.9.2042 — + Add task / + Add part open the card\'s OWN pop-ups (run)');
function flow(code, pickedInv, purpose, panelInvOverride) {
  const calls = [];
  const env = { state: { personalData: { a: { owned: true, itemNum: '2338', variation: '', inventoryId: 'i2' }, b: { owned: true, itemNum: '84631', variation: '', inventoryId: 'i1' } }, maintLog: [] },
    findMaster: (n) => MASTER[String(n)] || null, _isBoxItemNum: () => false, _partsChooser: null, _esc: s => String(s),
    setTimeout: (f) => f(), document: { getElementById: (id) => (id === 'maint-overlay' ? {} : null) } };
  env.window = { _maintShowGrp: (g) => calls.push('grp:' + g) };
  env.window._maintOpenPanel = (idx, num, v, inv) => { calls.push('open:' + num + '@' + inv); env._panel.item = { itemNum: num }; env.window._maintPanelInvId = panelInvOverride || inv; };
  env.window._maintAddTaskPopup = () => calls.push('addTask:' + env.window._maintPanelInvId);
  env.window._maintPartsPopup = (t, name) => calls.push('needPart:' + JSON.stringify(t) + ':' + name);
  env._panel = { item: null };
  const body = 'var _wbPurpose = ' + JSON.stringify(purpose) + ', _wbPickQ = "", _wbPickAll = null;\n'
    + grab('function _wbRowOf(pd)') + '\n' + grab('function _wbOwned()') + '\n' + code + '\nreturn window;';   // 2026-10-31: _wbOwned files each copy's row (the filters)
  const names = Object.keys(env);
  const w = new Function(...names, body).apply({}, names.map(n => env[n]));
  w._wbPicked(pickedInv);
  return calls;
}
const FLOW = grab('function _wbThenAdd(purpose, invId)').replace(/_panelItem/g, '_panel.item') + '\n'
  + 'window._wbPicked = ' + grab('window._wbPicked = function (invId)').replace('window._wbPicked = ', '').replace(/^function \(invId\)/, 'function (invId)') + ';\n'
  + 'window._wbOpen = ' + grab('window._wbOpen = function (invId, itemNum, focusTaskId, thenAdd)').replace('window._wbOpen = ', '') + ';';
const T1 = flow(FLOW, 'i1', 'task');
ok('+ Add task → pick No. 84631 → ITS card opens on "Work on it", then the card\'s own Add-a-task pop-up', T1.join(' ') === 'open:84631@i1 grp:work addTask:i1', T1.join(' '));
const T2 = flow(FLOW, 'i2', 'part');
ok('+ Add part → pick No. 2338 → its card, then the card\'s own Need-a-part (no job, named like the card\'s button)', T2.join(' ') === 'open:2338@i2 grp:work needPart:"":No. 2338', T2.join(' '));
const T3 = flow(FLOW, 'i1', 'task', 'i2');
ok('PLANTED: the card that opened is another copy → no pop-up is pressed on it', T3.indexOf('addTask:i2') < 0 && T3.indexOf('addTask:i1') < 0, T3.join(' '));
const noCheck = FLOW.replace("    if (String(window._maintPanelInvId || '') !== String(invId || '')) return;\n", '');
ok('PLANTED: …and without the copy check it WOULD press it on the wrong item (the check is load-bearing)', noCheck !== FLOW && flow(noCheck, 'i1', 'task', 'i2').indexOf('addTask:i2') >= 0);
const noThen = FLOW.replace('      if (thenAdd) _wbThenAdd(thenAdd, _openInv);', '');
ok('PLANTED: the step-2 press left out → the card opens but no pop-up (the first check would fail)', noThen !== FLOW && flow(noThen, 'i1', 'task').join(' ') === 'open:84631@i1 grp:work');

section('The page: buttons, filter chips, History tab');
const build = fnBody('function _wbBuild()');
ok('+ Add task and + Add part buttons on the bench', /onclick="_wbAddTask\(\)"/.test(build) && /onclick="_wbAddPart\(\)"/.test(build));
ok('three filter chips: All · Waiting on parts · Ready to work', /WB_FILTERS = \[\['all', 'All'\], \['waiting', 'Waiting on parts'\], \['ready', 'Ready to work'\]\]/.test(src) && /_wbFilter\(\\'' \+ x\[0\] \+ '\\'\)/.test(build));
ok('the chip is remembered per device (pref), and unknown values fall back to All', /MAINT\.PREF_WB_FILTER = 'maint_wb_filter'/.test(src) && /_prefSet\(MAINT\.PREF_WB_FILTER, f\)/.test(src) && /return WB_FILTERS\.some\(function \(x\) \{ return x\[0\] === f; \}\) \? f : 'all';/.test(src));
ok('waiting filter keeps only waiting rows; ready keeps the rest', /f === 'waiting' \? rows\.filter\(function \(r\) \{ return r\.waiting; \}\) : f === 'ready' \? rows\.filter\(function \(r\) \{ return !r\.waiting; \}\) : rows/.test(build));
ok('History is the third tab, with its count', /_wbTab\(\\'history\\'\)[^<]*History' \+ \(hist\.length \? ' · ' \+ hist\.length : ''\)/.test(build) && /\(name === 'history'\) \? 'history'/.test(src));
// v0.9.1789 RE-PIN. The first half is unchanged. The second asserted the
// EXACT old line `if (ctx) window._maintShowHistory(...)`; the history overlay
// now wires BackStack, which closes it by removing the element WITHOUT
// clearing _wbHistoryCtx — so a removal could pop the history back open after
// the user had left it. The guard asks the screen instead of a stale note.
// Superseded and replaced, not deleted: the rule is still "no stale per-item
// card", only the test for staleness got stronger.
ok('History rows open the entry in place — no stale per-item card', /window\._wbHistOpen = function \(logId\) \{ window\._wbHistoryCtx = null; window\._maintEditEntry\(logId\); \};/.test(src)
   && /if \(ctx && document\.getElementById\('wb-history'\)\) window\._maintShowHistory\(ctx\.invId, ctx\.itemNum\);/.test(src));
ok('…and it asks the SCREEN, not a note that the device Back button never clears',
   !/if \(ctx\) window\._maintShowHistory/.test(src));
ok('History has a search box', /id="wb-hist-q"/.test(build) && /oninput="_wbHistSearch\(this\.value\)"/.test(build));
// v0.9.1789: wb-card goes through rrDismissGuard now, which wires BackStack
// itself — so the device Back button still closes it (the rule this pinned),
// and a stray tap on the backdrop no longer does. Wiring it BOTH ways would be
// the double-wire the dismiss-guard suite fails on.
ok('overlays wire through BackStack (device back closes them)',
   /rrDismissGuard\(document\.getElementById\('wb-card'\)\)/.test(src)
   && !/BackStack\.wire\(document\.getElementById\('wb-card'\)\)/.test(src));
ok('…and the Workbench card no longer closes on a backdrop click (Brad, v1786)',
   !/id="wb-card"[^>]*onclick=/.test(src));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
