// ═══════════════════════════════════════════════════════════════
// parts_consistency_tests.js — v0.9.1753.
//
// Brad (2026-09-15): "we need to make sure that the parts needed, the
// maintenance button, and the work bench and the parts bin all talk to
// each other, that there is no duplicates or issues. if i hit installed
// here, it should either take me to the task or ask me installed on what
// kind of thing" — and "i think the parts bin should be inside of the
// work bench screen" — and, on the 2338 preview: "says waiting on the
// part, i can't get rid of it".
//
// Rules pinned here:
//  A · ONE row builder (_partsRowBuild), ONE appender (_partsAppendRow — the
//      only sheetsAppend for the Parts Needed tab in the whole app) and ONE
//      duplicate check (_partsFindDup) behind every way a part is added:
//      the Parts Needed Add form, the Need-a-part popup, the bin's Use one.
//  B · the Parts Needed page reads the task link LIVE (column M → the
//      Maintenance Log), never a note; "For NNNN" opens the card on that task.
//  C · Installed on the Parts Needed page: on an open task → the card opens
//      on that task and the form names it; on the engine with no task → it
//      asks which job; no engine → the Edit form asks which one; after the
//      save it offers to mark the task complete.
//  D · Remove on every non-installed part line of the card, through the one
//      remover; a part whose task is gone or done is loose again (the card
//      and the detail-page preview agree); Remove blanks the whole row.
//  E · the Parts Bin is the Workbench's fourth tab; no separate page or
//      menu entry.
// Run:  node tests/parts_consistency_tests.js
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
const pages = fs.readFileSync(path.join(APP, 'app-pages.js'), 'utf8');
const maint = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
function grabFrom(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function grabObj(src, sig) {   // a `var X = { … };` literal
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}

section('A · the shared helpers, lifted from app-pages.js and run on a fixture');
const state = {
  maintLog: [
    { id: 'log-open', invId: '190', itemNum: '2338', type: 'chore', text: 'E-unit service', status: 'open', dateAdded: '2026-09-15', row: 11 },
    { id: 'log-done', invId: '190', itemNum: '2338', type: 'chore', text: 'Oil / lubricate', status: 'done', dateAdded: '2026-09-15', row: 10 },
  ],
  partsData: {
    p1: { id: 'p1', row: 6, taskId: 'log-gone', forInv: '190', forItem: '2338', description: 'Lionel 2329-6 Virginian Self Adhesive Decal', partNum: '', status: 'wanted' },
    p2: { id: 'p2', row: 7, taskId: 'log-open', forInv: '190', forItem: '2338', description: 'Lionel 259E-1 Light Blue E-Unit Drum', partNum: '259E-1', status: 'bought' },
    p3: { id: 'p3', row: 8, taskId: '', forInv: '', forItem: '2338', description: 'coupler', partNum: '', status: 'wanted' },
    p4: { id: 'p4', row: 9, taskId: '', forInv: '190', forItem: '2338', description: 'old brushes', partNum: '', status: 'installed' },
    p5: { id: 'p5', row: 3, taskId: '', forInv: '136', forItem: '84631', description: 'TRACTION TIRE / .625" ID', partNum: '', status: 'bought' },
  },
  personalData: { '190': { inventoryId: '190', itemNum: '2338', variation: '' } },
};
const helpers = new Function('state',
  grabObj(pages, 'var PARTS_COPY = {') + ';\n'
  + grabFrom(pages, 'function _partsNorm(') + '\n' + grabFrom(pages, 'function _partsRowBuild(') + '\n'
  + grabFrom(pages, 'function _partsFindDup(') + '\n' + grabFrom(pages, 'function _partsTaskLabel(') + '\n'
  + 'return { PARTS_COPY: PARTS_COPY, norm: _partsNorm, row: _partsRowBuild, dup: _partsFindDup, label: _partsTaskLabel };')(state);

const r = helpers.row({ id: 'part-1', description: 'lens', partNum: '2343-13', forItem: '2338', forInv: '190', notes: 'n', dateAdded: '2026-09-15', status: 'wanted', taskId: 'log-open' });
ok('the row has all 13 columns A–M', Array.isArray(r) && r.length === 13, r && r.length);
ok('identifier cells carry the apostrophe guard (id, part#, item, inventory id, date, task id)', r[0] === "'part-1" && r[2] === "'2343-13" && r[3] === "'2338" && r[4] === "'190" && r[7] === "'2026-09-15" && r[12] === "'log-open");
ok('text cells do not (description, notes, status)', r[1] === 'lens' && r[6] === 'n' && r[8] === 'wanted');
ok('status defaults to wanted, id is minted when missing', helpers.row({ description: 'x' })[8] === 'wanted' && /^'part-\d+$/.test(helpers.row({ description: 'x' })[0]));
ok('an already-guarded value is not double-guarded', helpers.row({ id: "'part-9" })[0] === "'part-9");

ok('normalisation ignores case, spaces and punctuation', helpers.norm(' 259E-1 ') === '259e1' && helpers.norm('E-Unit Drum') === 'eunitdrum');
let d = helpers.dup({ forInv: '190', forItem: '2338', partNum: '259e 1', description: '' });
ok('same unit + same part number (spelled differently) → the existing row', d && d.id === 'p2', d && d.id);
d = helpers.dup({ forInv: '190', forItem: '2338', partNum: '', description: 'lionel 2329-6 virginian self adhesive decal' });
ok('same unit + same description (case/spacing ignored) → the existing row', d && d.id === 'p1', d && d.id);
ok('an INSTALLED row is never a duplicate (it is history)', helpers.dup({ forInv: '190', forItem: '2338', description: 'old brushes' }) === null);
ok('another unit\'s part is not a duplicate', helpers.dup({ forInv: '190', forItem: '2338', description: 'TRACTION TIRE / .625" ID' }) === null);
ok('with an inventory id, a same-number row WITHOUT one is a different unit', helpers.dup({ forInv: '190', forItem: '2338', description: 'coupler' }) === null);
ok('with no inventory id, "this unit" = same number and no inventory id', helpers.dup({ forInv: '', forItem: '2338', description: 'Coupler' }) && helpers.dup({ forInv: '', forItem: '2338', description: 'Coupler' }).id === 'p3');
ok('nothing to compare → no duplicate', helpers.dup({ forInv: '190', forItem: '2338' }) === null);
ok('exceptId leaves the row being edited out of it', helpers.dup({ forInv: '190', forItem: '2338', partNum: '259E-1' }, 'p2') === null);

ok('task label: on an OPEN task', helpers.label(state.partsData.p2) === helpers.PARTS_COPY.onTask + 'E-unit service');
ok('task label: on a DONE task', helpers.label({ taskId: 'log-done' }) === helpers.PARTS_COPY.taskDone + 'Oil / lubricate');
ok('task label: task id that no longer exists → "its task was removed"', helpers.label(state.partsData.p1) === helpers.PARTS_COPY.taskGone);
ok('task label: no task → nothing', helpers.label(state.partsData.p3) === '');

section('A · one appender, one builder, one duplicate check — source pins');
const appendsPages = (pages.match(/sheetsAppend\([^;]*'Parts Needed!/g) || []).length;
const appendsMaint = (maint.match(/sheetsAppend\([^;]*'Parts Needed!/g) || []).length;
ok('exactly ONE sheetsAppend to the Parts Needed tab in the whole app (inside _partsAppendRow)', appendsPages === 1 && appendsMaint === 0 && /_partsAppendRow[\s\S]{0,300}sheetsAppend\(state\.personalSheetId, 'Parts Needed!A:M'/.test(grabFrom(pages, 'async function _partsAppendRow(')), appendsPages + '/' + appendsMaint);
const savePart = grabFrom(pages, 'async function savePart(');
ok('savePart adds a NEW part through _partsAppendRow and checks for a duplicate first', /_partsAppendRow\(\{/.test(savePart) && /_partsFindDup\(\{/.test(savePart) && /_partsChooser\(/.test(savePart));
ok('savePart keeps the edit path (A:H update) so lifecycle columns are never clobbered', /'Parts Needed!A' \+ existingRow \+ ':H' \+ existingRow/.test(savePart));
ok('a duplicate is only checked for NEW rows, and "Add it anyway" is honoured once', /if \(!\(existingRow > 0\) && !window\._partsAddAnyway\)/.test(savePart) && /window\._partsAddAnyway = false;/.test(savePart));
const popAdd = grabFrom(maint, 'window._maintPopAddWanted = async function (taskId)');
const popSave = grabFrom(maint, 'async function _maintPopSaveWanted(fields, taskId, retry)');   // v0.9.1756: the ONE save path behind the typed box and the catalog lane
const popCat = grabFrom(maint, 'window._maintPopWantCatalog = async function (era, partNum, variation, taskId)');
ok('the Need-a-part popup adds through _partsAppendRow and checks for a duplicate first (v0.9.1756: inside _maintPopSaveWanted, which the typed box AND the catalog lane call)', /_partsAppendRow\(fields\)/.test(popSave) && /_partsFindDup\(fields\)/.test(popSave) && /_maintPopSaveWanted\(fields, taskId/.test(popAdd) && /_maintPopSaveWanted\(fields, taskId/.test(popCat) && !/_partsAppendRow\(/.test(popAdd) && !/_partsAppendRow\(/.test(popCat));
ok('…a duplicate already on THIS job is refused with a toast; on another job it is offered "Attach it to this job"', /dupOnJob/.test(popSave) && /_maintPopAttach\(dup\.row, taskId\)/.test(popSave) && /dupAttach/.test(popSave));
const binUse = grabFrom(maint, 'window._maintBinUse = async function (binId, taskId)');
ok('the bin\'s Use one: a WANTED row for the same part and unit turns bought (no second row), else the one appender', /_partsFindDup\(fields\)/.test(binUse) && /markPartBought\(dup\.row\)/.test(binUse) && /_partsAppendRow\(fields\)/.test(binUse));
ok('…and puts the fulfilled row on the job when it was not already there', /_maintPartSetTask\(dup\.row, taskId\)/.test(binUse));
ok('no other place builds a Parts Needed row by hand (no 13-cell literal outside the builder)', !/\[_t\('part-' \+ Date\.now\(\)\)/.test(maint) && !/\[_t\('part-' \+ Date\.now\(\)\)/.test(pages));

section('B · the Parts Needed page reads the task link live and opens the card');
const render = grabFrom(pages, 'function _renderPartsList()');
ok('the row label comes from _partsTaskLabel (column M → the log), not from the note', /var taskLabel = _partsTaskLabel\(p\)/.test(render) && /taskLabel \? ' · <span/.test(render));
ok('the old boilerplate notes ("for Workbench task") are hidden — the live label replaces them', /PARTS_COPY\.boilerplate\.indexOf\(String\(p\.notes\)\.trim\(\)\) < 0/.test(render) && /noteShown \?/.test(render) && !/\(p\.notes \? '<div/.test(render));
ok('"For NNNN" is a link that opens the Maintenance card on the part\'s task when the copy is owned', /_partsOpenCard\(\\'' \+ esc\(p\.forInv\)/.test(render) && /esc\(p\.taskId\)/.test(render));
ok('the road name resolves through the OWNED row (era-aware), only by bare number when there is none', /findMaster\(_pdFor\.itemNum, _pdFor\.variation, _pdFor\)/.test(render));
ok('_partsOpenCard → _wbOpen(inv, num, taskId)', /window\._wbOpen\(inv, num, taskId \|\| ''\)/.test(grabFrom(pages, 'function _partsOpenCard(')));
const wbOpen = grabFrom(maint, 'window._wbOpen = function (invId, itemNum, focusTaskId)');
ok('_wbOpen takes the task to land on and scrolls/flashes it', wbOpen.length > 0 && /_wbFocusTask\(focusTaskId\)/.test(wbOpen) && /scrollIntoView/.test(grabFrom(maint, 'function _wbFocusTask(')));

section('C · Installed on the Parts Needed page: take me to the task, or ask');
const mpi = grabFrom(pages, 'function markPartInstalled(rowNum, opts)');
ok('markPartInstalled exists with the routing options and is exported once', mpi.length > 0 && (pages.match(/window\.markPartInstalled = markPartInstalled;/g) || []).length === 1);
ok('no engine on the part → the Edit form asks which one (no dead-end toast)', /showAddPartModal\(p\.id\)/.test(mpi) && /PARTS_COPY\.whichEngine/.test(mpi) && !/Linked item is not in your collection/.test(mpi));
ok('on an OPEN task → the card opens ON that task (unless already on the card) and the form names the task', /window\._wbOpen\(p\.forInv, p\.forItem, _task\.id\)/.test(mpi) && /if \(!opts\.onCard/.test(mpi) && /_partInstallForm\(rowNum, p, pd, _task\)/.test(mpi));
ok('on the engine with no open task → "Installed as part of which job?" lists its open tasks + "no job"', /PARTS_COPY\.whichJobTitle/.test(mpi) && /PARTS_COPY\.whichJobNone/.test(mpi) && /l\.status === 'open' && String\(l\.invId \|\| ''\) === String\(p\.forInv\)/.test(mpi));
ok('picking a job links the part through the ONE column-M writer, then continues', /window\._maintPartSetTask\(p\.row, t\.id\)/.test(mpi) && /jobPicked: true/.test(mpi));
const form = grabFrom(pages, 'function _partInstallForm(rowNum, p, pd, task)');
ok('one install form for both doors; it names the task when there is one', form.length > 0 && /task \? ', task <strong/.test(form) && /_savePartInstalled\(' \+ rowNum \+ '\)/.test(form));
const spi = grabFrom(pages, 'async function _savePartInstalled(rowNum)');
ok('after a successful install it offers to mark the task complete — through the existing _maintChoreDone', /PARTS_COPY\.markDone/.test(spi) && /window\._maintChoreDone\(_t2\.row, _t2\.id\)/.test(spi));
ok('the card\'s own Installed-it says "already on the card" so the card is not reopened on top of itself', /markPartInstalled\(rowNum, \{ onCard: true \}\)/.test(grabFrom(maint, 'window._maintPartInstalled = function (rowNum)')));
const chooser = grabFrom(pages, 'function _partsChooser(');
// v0.9.1790 RE-PIN. The rule is unchanged — an in-app overlay, device Back
// closes it, above every other modal, with a Cancel. What changed is HOW the
// BackStack wiring gets there: rrDismissGuard does it now, so wiring it by
// hand as well would be the double-wire the dismiss-guard suite fails on. A
// second assertion checks the hand-rolled call really is gone, because a
// re-pin that only relaxes is not a re-pin.
ok('the chooser is an in-app overlay wired to BackStack (device Back closes it), above every other modal', /rrDismissGuard\(ov\)/.test(chooser) && /z-index:10090/.test(chooser) && /PARTS_COPY\.cancel/.test(chooser));
ok('…wired in ONE place, not two', !/BackStack\.wire\(ov\)/.test(chooser));
ok('…and a tap outside no longer closes it (Brad: never close if you pick outside)',
   !/e\.target === ov\) ov\.remove/.test(chooser));

section('D · Remove on the card, loose rule, whole-row blank');
const card = grabFrom(maint, 'function _maintRenderTasks()');
ok('every non-installed part line carries Remove → _maintPartRemove', /_maintPartRemove\(' \+ p\.row/.test(card) && /var rm = st === 'installed' \? '' :/.test(card) && /\+ act \+ rm \+/.test(card));
ok('the loose rule: a part whose task is not OPEN (gone or done) is loose again', /if \(p\.taskId && _taskOpen\(p\.taskId\)\) return false;/.test(card) && /l\.status === 'open'/.test(grabFrom(maint, 'function _taskOpen(')));
const preview = grabFrom(maint, 'window._maintRenderPreview = function (idx, it, pd)');
ok('…which is exactly the preview\'s rule (linked = on an OPEN task), so card and preview agree', /l\.status === 'open'/.test(preview) && /if \(linked\[p\.id\] \|\| st === 'installed'\) return;/.test(preview));
const rmCard = grabFrom(maint, 'window._maintPartRemove = async function (rowNum)');
ok('the card\'s Remove asks first, then goes through removePart (the one remover) and redraws card, bench, badge, preview', /confirm\(/.test(rmCard) && /await removePart\(rowNum\)/.test(rmCard) && /_maintRenderTasks\(\); _wbBuild\(\); _wbBadge\(\)/.test(rmCard) && /_maintRenderPreview/.test(rmCard));
const rmPage = grabFrom(pages, 'async function removePart(rowNum)');
ok('removePart blanks the WHOLE row (13 cells, A–M) where the lifecycle columns exist', /\['', '', '', '', '', '', '', '', '', '', '', '', ''\]/.test(rmPage) && /\(_wide \? 'M' : 'H'\)/.test(rmPage));
ok('removePart returns true/false and drops the part from memory at once', /return true;/.test(rmPage) && /return false;/.test(rmPage) && /delete state\.partsData\[k\]/.test(rmPage));
ok('only removePart blanks a Parts Needed row', (pages.match(/rrRemoveRowConfirmed\(state\.personalSheetId, 'Parts Needed'/g) || []).length === 1 && !/rrRemoveRowConfirmed\(state\.personalSheetId, 'Parts Needed'/.test(maint));

section('E · the Parts Bin is the Workbench\'s fourth tab');
const wbTab = grabFrom(maint, 'window._wbTab = function (name)');
ok('_wbTab knows \'bin\' and loads the bin when it opens', /\(name === 'bin'\) \? 'bin'/.test(wbTab) && /if \(_wbTabName === 'bin'\) _loadBin\(\)\.then\(_binBuild\)/.test(wbTab));
const wbBuild = grabFrom(maint, 'function _wbBuild()');
ok('the Workbench shows four tabs — Bench, Toolbox, History, Parts Bin', /_wbTab\(\\'bench\\'\)/.test(wbBuild) && /_wbTab\(\\'toolbox\\'\)/.test(wbBuild) && /_wbTab\(\\'history\\'\)/.test(wbBuild) && /_wbTab\(\\'bin\\'\)/.test(wbBuild));
ok('the bin tab renders into #wb-bin and _binBuild targets it', /<div id="wb-bin"><\/div>/.test(wbBuild) && /document\.getElementById\('wb-bin'\)/.test(grabFrom(maint, 'function _binBuild()')));
ok('no separate Parts Bin page or menu entry is created any more', !/nav-partsbin-btn/.test(maint) && !/page-partsbin/.test(maint) && !/page-partsbin/.test(pages));
ok('"is the bin on screen?" is asked ONE way everywhere (_binVisible)', /window\._binVisible = function/.test(maint) && (pages.match(/_binVisible\(\)/g) || []).length === 2 && (maint.match(/_binVisible\(\)/g) || []).length === 1);
ok('the bin tab carries the tooltip the menu entry used to', /Need-a-part checks here first\./.test(wbBuild));

section('Page pins (the trio agrees with itself)');
const cfg = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const ver = (cfg.match(/APP_VERSION = 'v0\.9\.(\d+)'/) || [])[1];
const cache = (sw.match(/CACHE_NAME = 'mca-v(\d+)'/) || [])[1];
ok('config.js carries a version', !!ver, ver);
ok('sw.js CACHE_NAME is the app version + 10 (the house convention)', ver && cache && (+cache === +ver + 10), ver + ' / ' + cache);
ok('index.html: every ?v= reads the app version (79 of them) and nothing older', ver && (idx.match(new RegExp('\\?v=' + ver, 'g')) || []).length === 79 && (idx.match(/\?v=\d+/g) || []).every(function (s) { return s === '?v=' + ver; }));
ok('this release is v0.9.1753 or later', ver && +ver >= 1753, ver);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
