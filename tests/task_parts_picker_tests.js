// ═══════════════════════════════════════════════════════════════
// task_parts_picker_tests.js — v0.9.1752.
//
// Brad (2026-09-15, Maintenance card screenshot): "when i go to add the
// task, it should take me to a page that says need part, where i can look
// at the parts i have or add a part to my part want list... right now i
// can't select the part i need. i see it, i can say i bought it or
// installed it" — and: "then i don't have a way to delete a task i did in
// error or added twice by accident".
//
// Rules pinned here:
//  · the Need-a-part pop-up is a PICKER first: parts already bought for
//    this unit ("Use it for this job"), parts already wanted for this unit
//    — loose or on another task — ("Attach to this job"), then the bin,
//    then the old type-it lane;
//  · a part already on THIS job is not offered again; parts for OTHER
//    units are never offered; installed parts are never offered;
//  · "for this unit" = by inventoryId when the card has one, else by item
//    number with no inventoryId (the task card's own loose rule);
//  · ONE column-M writer (_maintPartSetTask) behind Attach, Use, Move and
//    Remove-task; ONE log-row remover (_removeLogRow) behind the history's
//    Remove and the task card's Remove;
//  · removing an open task unlinks its parts first — a part never
//    disappears with a mis-added task — and writes nothing to the history;
//  · every part line on a task card carries Move (except installed ones).
// Run:  node tests/task_parts_picker_tests.js
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

section('The picker (_maintPickerParts lifted): what can be picked for a job');
const state = {
  maintLog: [
    { id: 'log-A', invId: 'i2', itemNum: '2338', type: 'chore', text: 'add decal', status: 'open', dateAdded: '2026-09-12' },
    { id: 'log-B', invId: 'i2', itemNum: '2338', type: 'chore', text: 'E-unit service', status: 'open', dateAdded: '2026-09-15' },
    { id: 'log-C', invId: 'i9', itemNum: '671', type: 'chore', text: 'Oil / lubricate', status: 'open', dateAdded: '2026-09-01' },
  ],
  partsData: {
    p1: { id: 'p1', row: 3, taskId: 'log-A', forInv: 'i2', forItem: '2338', description: 'Virginian decal', status: 'wanted' },
    p2: { id: 'p2', row: 4, taskId: 'log-A', forInv: 'i2', forItem: '2338', description: 'Light Blue E-Unit Drum', partNum: '259E-1', status: 'bought' },
    p3: { id: 'p3', row: 5, taskId: '', forInv: 'i2', forItem: '2338', description: 'headlight lens', status: 'wanted' },
    p4: { id: 'p4', row: 6, taskId: '', forInv: 'i2', forItem: '2338', description: 'old brushes', status: 'installed' },
    p5: { id: 'p5', row: 7, taskId: '', forInv: 'i9', forItem: '671', description: 'smoke unit', status: 'wanted' },
    p6: { id: 'p6', row: 8, taskId: '', forInv: '', forItem: '2338', description: 'coupler (no inv id)', status: 'wanted' },
  },
  partsBin: [
    { id: 'b1', partNum: '2343-13', desc: 'horn relay', qty: 2 },
    { id: 'b2', partNum: '', desc: 'used up', qty: 0 },
  ],
};
const pickFn = new Function('state', grab('function _maintPickerParts(') + '\nreturn _maintPickerParts;')(state);
const tgInv = { item: { itemNum: '2338' }, invId: 'i2' };

let pk = pickFn(tgInv, 'log-B');   // opening Need a part on "E-unit service"
ok('the drum bought for this unit but sitting on "add decal" is offered as ON HAND', pk.onHand.length === 1 && pk.onHand[0].part.id === 'p2', JSON.stringify(pk.onHand.map(e => e.part.id)));
ok('…and says which task it is on now', pk.onHand[0].onTask === 'add decal');
ok('wanted parts for this unit: the decal (on add decal) and the loose lens — nothing else', pk.wanted.map(e => e.part.id).sort().join(',') === 'p1,p3', pk.wanted.map(e => e.part.id).join(','));
ok('a loose part says it is not on a task', pk.wanted.find(e => e.part.id === 'p3').onTask === '');
ok('the installed part is never offered', !pk.onHand.concat(pk.wanted).some(e => e.part.id === 'p4'));
ok('another unit\'s part (671 smoke unit) is never offered', !pk.onHand.concat(pk.wanted).some(e => e.part.id === 'p5'));
ok('with an inventoryId on the card, a same-number row WITHOUT one is not this unit', !pk.onHand.concat(pk.wanted).some(e => e.part.id === 'p6'));
ok('the bin lists only rows with stock', pk.bin.length === 1 && pk.bin[0].id === 'b1');

pk = pickFn(tgInv, 'log-A');   // opening it on "add decal": its own two parts must not be offered back
ok('parts already on THIS job are not offered again', pk.onHand.length === 0 && pk.wanted.length === 1 && pk.wanted[0].part.id === 'p3', JSON.stringify(pk));

pk = pickFn({ item: { itemNum: '2338' }, invId: '' }, 'log-B');   // no inventoryId on the card (older rows)
ok('with no inventoryId, "this unit" = same number and no inventoryId — the coupler, only', pk.wanted.length === 1 && pk.wanted[0].part.id === 'p6', JSON.stringify(pk.wanted.map(e => e.part.id)));

section('The pop-up: picker first, type-it lane second (markup pins)');
const popup = grab('window._maintPartsPopup = function (taskId, taskName)');
ok('the pop-up renders the picker right under its head', popup.indexOf('_maintPickerHtml(tg, taskId)') > 0 && popup.indexOf('_maintPickerHtml(tg, taskId)') < popup.indexOf('Find the part'));
ok('the bin is checked as soon as the pop-up opens (no typing needed)', /window\._maintBinCheck\(taskId\);/.test(popup));
const pickerHtml = grab('function _maintPickerHtml(');
ok('nothing to attach to when the bench opened it with no job (taskId empty) → no picker', /if \(!taskId\) return '';/.test(pickerHtml));
ok('on-hand lane says "Use it for this job"; wanted lane says "Attach to this job"', /Use it for this job/.test(pickerHtml) && /Attach to this job/.test(pickerHtml));
ok('both lanes attach through _maintPopAttach (one writer)', (pickerHtml.match(/_maintPopAttach\(/g) || []).length === 1 && /window\._maintPopAttach = async function \(partRow, taskId\)/.test(src));
const binCheck = grab('window._maintBinCheck = function (taskId)');
ok('an empty search shows the bin\'s loose spares (capped at 8) instead of "type first"', /all\.slice\(0, 8\)/.test(binCheck) && !/Type what you need above/.test(binCheck));

section('ONE column-M writer, ONE log-row remover');
const setTask = grab('async function _maintPartSetTask(partRow, taskId)');
ok('_maintPartSetTask writes ONLY column M of Parts Needed, verified', /'Parts Needed!M' \+ partRow/.test(setTask) && /rrVerifiedRowUpdate\(/.test(setTask) && !/sheetsAppend/.test(setTask));
ok('…and keeps the in-memory row in step, then redraws card, bench, badge', /p\.taskId = String\(taskId \|\| ''\)/.test(setTask) && /_maintRenderTasks\(\); _wbBuild\(\); _wbBadge\(\)/.test(setTask));
const attach = grab('window._maintPopAttach = async function (partRow, taskId)');
const move = grab('window._maintPartMove = async function (partRow, taskId, sel)');
const rmTask = grab('window._maintRemoveTask = async function (logId)');
ok('Attach, Move and Remove-task all go through _maintPartSetTask', [attach, move, rmTask].every(f => /_maintPartSetTask\(/.test(f)));
ok('no other place writes Parts Needed column M', (src.match(/Parts Needed!M/g) || []).length === 1);
const rmEntry = grab('window._maintRemoveEntry = async function (logId)');
ok('history Remove and task-card Remove share _removeLogRow', /_removeLogRow\(l\)/.test(rmEntry) && /_removeLogRow\(l\)/.test(rmTask));
ok('only _removeLogRow calls the row remover for the log tab', (src.match(/rrRemoveRowConfirmed\(state\.personalSheetId, LOG_TAB/g) || []).length === 1);

section('Removing an open task (_maintRemoveTask)');
ok('it unlinks every linked part BEFORE removing the row (a part never vanishes with the task)', rmTask.indexOf('_maintPartSetTask(parts[i].row, \'\')') > 0 && rmTask.indexOf('_maintPartSetTask(parts[i].row, \'\')') < rmTask.indexOf('_removeLogRow(l)'));
ok('an unlink that fails stops the removal', /if \(!\(await _maintPartSetTask\(parts\[i\]\.row, ''\)\)\) return;/.test(rmTask));
ok('it asks first, and says the parts stay on the list', /confirm\(msg\)/.test(rmTask) && /stay/.test(rmTask) && /Parts Needed list/.test(rmTask));
ok('it says nothing goes into the history (an open task was never done)', /nothing goes into the history/.test(rmTask));

section('The task card markup (_maintRenderTasks)');
const card = grab('function _maintRenderTasks()');
ok('every open task carries a Remove button wired to _maintRemoveTask (v1760: through rrJsArg, so an apostrophe cannot break the handler)', /_maintRemoveTask\(\\'' \+ rrJsArg\(t\.id\)/.test(card));
ok('Mark complete is still the only way INTO the history', /_maintChoreDone\(/.test(card) && !/_maintChoreDone\(/.test(rmTask));
const moveSel = grab('var moveSel = function (p, onTask)');
ok('a part line gets a Move select listing the OTHER open tasks + "off this task"', /tasks\.filter\(function \(t\) \{ return t\.id !== \(p\.taskId \|\| ''\); \}\)/.test(moveSel) && /off this task \(keep for the item\)/.test(moveSel));
ok('a loose part (no task) with no other tasks gets no Move select', /if \(!others\.length && !p\.taskId\) return '';/.test(moveSel));
ok('installed parts get no Move select', /\(st === 'installed' \? '' : moveSel\(p\)\)/.test(card));
ok('Move writes through _maintPartMove → _maintPartSetTask', /_maintPartMove\(' \+ p\.row/.test(moveSel));

section('Page pins');
// v0.9.1753: these read the version from config.js instead of hard-coding it,
// so the suite stays green across bumps and still catches a half-bumped trio.
const _cfg = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
const _ver = (_cfg.match(/APP_VERSION = 'v0\.9\.(\d+)'/) || [])[1];
ok('config.js is v0.9.1752 or later', _ver && +_ver >= 1752, _ver);
const _cache = (fs.readFileSync(path.join(__dirname, '..', 'app', 'sw.js'), 'utf8').match(/CACHE_NAME = 'mca-v(\d+)'/) || [])[1];
ok('sw.js CACHE_NAME is the app version + 10', _ver && _cache && +_cache === +_ver + 10, _ver + ' / ' + _cache);
const idx = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
ok('index.html: every ?v= reads the app version (79 of them)', _ver && (idx.match(new RegExp('\\?v=' + _ver, 'g')) || []).length === 79 && (idx.match(/\?v=\d+/g) || []).every(function (s) { return s === '?v=' + _ver; }), (idx.match(/\?v=\d+/g) || []).length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
