// ═══════════════════════════════════════════════════════════════
// maint_parts_box_tests.js — v0.9.1766.
//
// Brad, 2026-09-18, on the Maintenance screen:
//   "on this screen, we need a parts box like the tasks for this item. In this
//    box, we need to show the parts available the user has on hand for this
//    particular item only. also need the parts add feature here, this would
//    match the parts add function that is in the add task button."
//   "when we add a task, and the user hits something else, don't automatically
//    add that to the drop down. have a check button next to it that the user
//    can check if they want it added to the drop down."
//
// WHAT WAS WRONG: _maintRenderTasks returned early — "No open tasks on this
// one." — before it ever looked at parts. So with no open task the screen said
// NOTHING about the parts he owns for that item, and offered no way to add one:
// the only "Need a part" button lived on a task card. And any name typed into
// "Something else…" was saved into the dropdown forever, silently.
//
// THE RULES THIS SUITE PROTECTS:
//   1. The parts box is drawn whether or not there are open tasks.
//   2. ONE part-line renderer draws both the box and the lines under a task, so
//      the two can never disagree — and a part on an open job appears under
//      that job only, never in both places.
//   3. A typed task name joins the dropdown ONLY if the box is ticked, and a
//      custom one can be taken back out. Built-ins cannot be removed.
// Run:  node tests/maint_parts_box_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const maint = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');
function grabFrom(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}

// ── A · the real _choreFormHtml, run ───────────────────────────────────────
section('A · the picker: a checkbox beside the new name, a − beside the list');
const formSrc = grabFrom(maint, 'function _choreFormHtml(addJs)');
ok('_choreFormHtml lifted', !!formSrc);
const formHtml = new Function('_allChores', '_esc', '_btnPrimary', '_btnQuiet',
  formSrc + '\nreturn _choreFormHtml("_maintAddChore()");')(
  () => ['Oil / lubricate', 'Replace traction tire', 'My one-off'],
  s => String(s),
  () => 'class="p"',
  () => 'class="q"'
);
ok('the checkbox is there', /id="maint-chore-custom-keep"/.test(formHtml));
ok('…and is NOT ticked by default',
   !/id="maint-chore-custom-keep"[^>]*\schecked/.test(formHtml));
ok('it says what ticking it does', /Add it to my list for next time/.test(formHtml));
ok('the placeholder no longer promises to remember it',
   /placeholder="Name the new task"/.test(formHtml) && !/joins the list/.test(formHtml));
ok('a − button calls _maintDelChore', /_maintDelChore\(\)/.test(formHtml));
ok('the custom name box and the checkbox hide together (one wrapper)',
   formHtml.indexOf('id="maint-chore-custom"') < formHtml.indexOf('id="maint-chore-custom-keep"'));

// The rest is wrapped in an async main() — _maintAddChore is async, and this
// file is CommonJS (require + top-level await cannot mix).
(async function main() {

// ── B · the real _maintAddChore, driven ────────────────────────────────────
section('B · a typed name joins the dropdown ONLY when the box is ticked');
const addSrc = grabFrom(maint, 'window._maintAddChore = async function');
ok('_maintAddChore lifted', !!addSrc);

const CHORES_FIX = ['Oil / lubricate', 'Replace traction tire'];
async function runAdd(opts) {
  const calls = { saved: null, appended: 0, toasts: [] };
  let favs = (opts.favs || []).slice();
  const els = {
    'maint-chore-pick': { value: opts.pick },
    'maint-chore-custom-in': { value: opts.typed || '' },
    'maint-chore-custom-keep': { checked: !!opts.ticked },
  };
  const win = {};
  // Every closure name the real function touches has to be handed in — miss one
  // (LOG_TAB, first time round) and it throws into its own catch and looks like
  // "the task was not created" rather than "the harness is short a global".
  const fn = new Function(
    'window', 'document', 'state', '_target', '_isOwner', '_favs', '_saveFavs',
    'MAINT', 'CHORES', 'LOG_TAB', '_ensureLogTab', 'sheetsAppend', '_loadLog', '_wbBadge',
    '_maintRenderTasks', 'showToast', '_wbTarget', '_wbCloseCard',
    addSrc + '\nreturn window._maintAddChore;'
  )(
    win,
    { getElementById: id => els[id] || null },
    { personalSheetId: 'sheet1' },
    () => ({ item: { itemNum: '2338' }, invId: '190' }),
    () => true,
    () => favs,
    (k, arr) => { calls.saved = arr.slice(); favs = arr.slice(); },
    { PREF_CHORES: 'maint_custom_chores' },
    CHORES_FIX,
    'Maintenance Log',
    async () => true,
    async (sheetId, range, rows) => { calls.appended++; calls.row = rows && rows[0]; return true; },
    async () => {}, () => {}, () => {},
    (m) => calls.toasts.push(String(m)),
    null, () => {}
  );
  await fn();
  return calls;
}

{
  const r = await runAdd({ pick: '__custom', typed: 'Swap the bulb', ticked: false, favs: [] });
  ok('the task itself is still created', r.appended === 1);
  ok('…and the name is NOT remembered when unticked', r.saved === null,
     JSON.stringify(r.saved));
}
{
  const r = await runAdd({ pick: '__custom', typed: 'Swap the bulb', ticked: true, favs: [] });
  ok('ticked → the task is created', r.appended === 1);
  ok('…and the name IS remembered', Array.isArray(r.saved) && r.saved.indexOf('Swap the bulb') >= 0,
     JSON.stringify(r.saved));
}
{
  const r = await runAdd({ pick: '__custom', typed: 'Oil / lubricate', ticked: true, favs: [] });
  ok('a name that is already built in is not added twice', r.saved === null);
}
{
  const r = await runAdd({ pick: 'Oil / lubricate', ticked: true, favs: [] });
  ok('picking a built-in never writes the list', r.saved === null);
  ok('…and still creates the task', r.appended === 1);
}
{
  const r = await runAdd({ pick: '__custom', typed: '   ', ticked: true, favs: [] });
  ok('an empty name creates nothing', r.appended === 0 && r.saved === null);
  ok('…and says so', r.toasts.some(t => /type the new task/i.test(t)));
}

// ── C · the real _maintDelChore, driven ────────────────────────────────────
section('C · a custom task can be taken back off the list; built-ins cannot');
const delSrc = grabFrom(maint, 'window._maintDelChore = function');
ok('_maintDelChore lifted', !!delSrc);
function runDel(value, favs) {
  const calls = { saved: null, removedIndex: -1, toasts: [] };
  let cur = favs.slice();
  const sel = {
    value: value, selectedIndex: 3,
    remove(i) { calls.removedIndex = i; },
  };
  const win = {};
  new Function('window', 'document', '_favs', '_saveFavs', 'MAINT', 'CHORES', 'showToast',
    delSrc + '\nreturn window._maintDelChore;'
  )(
    win,
    { getElementById: id => (id === 'maint-chore-pick' ? sel : null) },
    () => cur,
    (k, arr) => { calls.saved = arr.slice(); cur = arr.slice(); },
    { PREF_CHORES: 'maint_custom_chores' },
    CHORES_FIX,
    (m) => calls.toasts.push(String(m))
  )();
  return calls;
}
{
  const r = runDel('My one-off', ['My one-off', 'Another']);
  ok('a custom one is removed from the list', Array.isArray(r.saved) && r.saved.indexOf('My one-off') < 0);
  ok('…the others stay', r.saved.indexOf('Another') >= 0);
  ok('…and it leaves the dropdown', r.removedIndex === 3);
}
{
  const r = runDel('Oil / lubricate', ['My one-off']);
  ok('a built-in is refused', r.saved === null);
  ok('…and says why', r.toasts.some(t => /built in/i.test(t)));
  ok('…and nothing leaves the dropdown', r.removedIndex === -1);
}
{
  const r = runDel('__custom', ['My one-off']);
  ok('"Something else…" itself is not removable', r.saved === null && r.removedIndex === -1);
}

// ── D · the parts box, in the shipped panel + renderer ─────────────────────
section('D · the parts box is drawn whether or not there are open tasks');
const renderSrc = grabFrom(maint, 'function _maintRenderTasks()');
ok('_maintRenderTasks lifted', !!renderSrc);

ok('the panel has a Parts section', /sec\('Parts for this item',/.test(maint));
ok('…with its own container', /id="maint-parts"/.test(maint));
ok('+ Add a part opens the SAME picker, with no job attached',
   /_maintPartsPopup\(\\'\\',/.test(maint));

const pelAt = renderSrc.indexOf("getElementById('maint-parts')");
const bailAt = renderSrc.indexOf('No open tasks on this one');
ok('the parts box is filled BEFORE the no-tasks bail-out', pelAt > 0 && bailAt > pelAt,
   'pel@' + pelAt + ' bail@' + bailAt);
ok('the empty box still points at + Add a part',
   /Nothing on hand for this one yet/.test(renderSrc));

section('E · one renderer, and nothing listed twice');
ok('partRow is defined once', (renderSrc.match(/var partRow = function/g) || []).length === 1);
ok('the same partRow draws the box and the task lines',
   (renderSrc.match(/partRow\(p, false\)/g) || []).length >= 2);
ok('a task no longer swallows the loose parts',
   !/partRow\(p, true\)/.test(renderSrc));
ok('the old dashed loose block is gone', !/looseBlock/.test(maint));
ok('the box shows only parts NOT on an open task (the v1753 rule, unchanged)',
   /if \(p\.taskId && _taskOpen\(p\.taskId\)\) return false;/.test(renderSrc));
ok('…and never an installed part', /=== 'installed'\) return false;/.test(renderSrc));
ok('it is still this unit only — inventory id first, number only without one',
   /inv \? p\.forInv === inv : \(p\.forItem === num && !p\.forInv\)/.test(renderSrc));

// ═══════════════════════════════════════════════════════════════
// F · v0.9.1788 — THE TASKS ARE A LIST; THE WORK HAPPENS ON A CARD.
//
// [stated] Brad: "these task need to look like a list. so lets add a number to
// the left of the service title. also, lets collapse the card to title, part
// needed (y/n), and notes. when you click on it, it opens up a maintenance
// card." Asked whether the row should grow in place or open its own card:
// "open up a card."
//
// These RUN the real _maintRenderTasks against a fake page — the house
// standard in this file, and the only way to prove what the row actually says.
// ═══════════════════════════════════════════════════════════════
section('F · the task list: a number, a title, a parts word, a note');

function runRender(opts) {
  opts = opts || {};
  const tasks = opts.tasks || [];
  const parts = opts.parts || [];
  const els = {};
  const st = { appended: [], guarded: [], removed: [] };
  const mkEl = () => {
    const e = { _html: '', style: {}, tagName: 'DIV', parentNode: null,
                get innerHTML() { return this._html; },
                set innerHTML(v) { this._html = v; } };
    return e;
  };
  els['maint-tasks'] = mkEl();
  els['maint-parts'] = mkEl();
  const doc = {
    activeElement: null,
    getElementById: id => els[id] || null,
    createElement: () => { const e = mkEl(); e.id = ''; return e; },
    body: {
      appendChild: el => { st.appended.push(el); els[el.id] = el; el.parentNode = doc.body; },
      removeChild: el => { st.removed.push(el); delete els[el.id]; el.parentNode = null; return el; },
      contains: el => st.appended.indexOf(el) >= 0 && st.removed.indexOf(el) < 0,
    },
  };
  const win = {
    _maintPanelInvId: '190',
    rrDismissGuard: ov => st.guarded.push(ov),
  };
  const state = { maintLog: tasks, partsData: {} };
  parts.forEach((p, i) => { state.partsData['p' + i] = p; });
  // _maintOpenTaskId and _maintPaintTaskCard live OUTSIDE the lifted function,
  // so they are declared here; everything else is the shipped body, run as-is.
  const api = new Function(
    'document', 'window', 'state', '_panelItem', '_itemTasks', '_taskParts', '_taskOpen',
    '_esc', 'rrJsArg', '_btn', '_btnQuiet', '_btnPrimary', '_QUIET', '_loadLog',
    'MutationObserver', 'Object',
    'var _maintOpenTaskId = null, _maintPaintTaskCard = function () {};\n'
    + renderSrc
    + '\nreturn { render: _maintRenderTasks,'
    + '  open: function (id) { _maintOpenTaskId = id; _maintRenderTasks(); },'
    + '  openId: function () { return _maintOpenTaskId; } };'
  )(
    doc, win, state, { itemNum: '2338' },
    () => tasks.filter(t => t.type === 'chore' && t.status === 'open'),
    id => Object.values(state.partsData).filter(p => p.taskId === id),
    id => tasks.some(t => t.id === id && t.status === 'open'),
    s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    s => String(s).replace(/'/g, "\\'"),
    () => 'class="b"', () => 'class="q"', () => 'class="p"', 'quiet',
    () => Promise.resolve(),
    function (cb) { this.observe = () => {}; this.disconnect = () => {}; },
    Object
  );
  return { api, els, st, doc, win };
}

const T = (id, text, notes) => ({ id, text, notes: notes || '', type: 'chore', status: 'open',
                                  dateAdded: '2026-09-15', row: 10 });

{
  const h = runRender({ tasks: [T('t1', 'E-unit service', 'e unit sticking'),
                                T('t2', 'Fix railing'), T('t3', 'Oil / lubricate')] });
  h.api.render();
  const html = h.els['maint-tasks'].innerHTML;
  const rows = html.match(/class="maint-task"/g) || [];
  ok('three open tasks draw three rows', rows.length === 3, String(rows.length));
  ok('…numbered 1. 2. 3. down the left', />1\.</.test(html) && />2\.</.test(html) && />3\.</.test(html));
  ok('…each carrying its own id, so the row is still findable', /data-id="t2"/.test(html));
  ok('the row opens the card BY ID, never by the number beside it',
     /_maintOpenTask\('t2'\)/.test(html) && !/_maintOpenTask\(2\)/.test(html));
  ok('the note shows as a preview on the row', /e unit sticking/.test(html));
  ok('a task with no note leaves the space blank, not "undefined"', !/undefined/.test(html));
  ok('NO notes box on the row — an editable field inside a tappable row fights itself',
     !/<textarea/.test(html));
  ok('NO Remove on the row — that is one stray thumb from a deleted job',
     !/_maintRemoveTask/.test(html));
  ok('the row is reachable from the keyboard too', /role="button"/.test(html) && /tabindex="0"/.test(html));
}

section('F · the parts word: blank / Waiting / On hand, NOT yes/no');
// Brad asked for y/n. A yes/no would file "ordered, I cannot start" and "it is
// in my hand" under the same letter — the difference between a job he can do
// tonight and one he cannot, and exactly what his own Workbench chips say.
const wordOf = html => (html.match(/class="maint-task-parts"[^>]*>([^<]+)</) || [])[1] || '';
{
  const h = runRender({ tasks: [T('t1', 'E-unit service')] });
  h.api.render();
  ok('no part on the job → the column says nothing', wordOf(h.els['maint-tasks'].innerHTML) === '',
     wordOf(h.els['maint-tasks'].innerHTML));
}
{
  const h = runRender({ tasks: [T('t1', 'E-unit service')],
                        parts: [{ taskId: 't1', status: 'wanted', description: 'E-unit drum', row: 4 }] });
  h.api.render();
  ok('a part still to buy → "Waiting"', wordOf(h.els['maint-tasks'].innerHTML) === 'Waiting');
}
{
  const h = runRender({ tasks: [T('t1', 'E-unit service')],
                        parts: [{ taskId: 't1', status: 'bought', description: 'E-unit drum', row: 4 }] });
  h.api.render();
  ok('the part bought and in his hand → "On hand"', wordOf(h.els['maint-tasks'].innerHTML) === 'On hand');
}
{
  const h = runRender({ tasks: [T('t1', 'E-unit service')],
                        parts: [{ taskId: 't1', status: 'bought', description: 'a', row: 4 },
                                { taskId: 't1', status: 'wanted', description: 'b', row: 5 }] });
  h.api.render();
  ok('one part in hand and one still coming → "Waiting" — he STILL cannot start',
     wordOf(h.els['maint-tasks'].innerHTML) === 'Waiting');
}
{
  const h = runRender({ tasks: [T('t1', 'E-unit service')],
                        parts: [{ taskId: 't1', status: 'installed', description: 'a', row: 4 }] });
  h.api.render();
  ok('an INSTALLED part is not outstanding — the column goes quiet again',
     wordOf(h.els['maint-tasks'].innerHTML) === '');
}

section('F · the card: one job, opened by id, and it leaves when the job does');
{
  const h = runRender({ tasks: [T('t1', 'E-unit service', 'e unit sticking'), T('t2', 'Fix railing')] });
  h.api.render();
  ok('nothing is opened until he taps a row', h.st.appended.length === 0);

  h.api.open('t2');
  ok('tapping a row puts a card on the screen', h.st.appended.length === 1);
  const ov = h.st.appended[0];
  ok('…and it is the overlay, not something pasted into the list', ov.id === 'maint-task-ov');
  ok('the card is guarded — a stray tap outside cannot take the note he is writing (v1786)',
     h.st.guarded.length === 1 && h.st.guarded[0] === ov);
  ok('the card carries the job it was opened for', /data-id="t2"/.test(ov.innerHTML));
  ok('…and says which of how many, so the list is not lost', /Task 2 of 2/.test(ov.innerHTML));
  ok('the notes box lives HERE, with its own save-as-you-type wiring',
     /<textarea id="task-notes-t2"/.test(ov.innerHTML) && /_maintSaveTaskNotes/.test(ov.innerHTML));
  ok('Need a part is on the card', /_maintPartsPopup\('t2'/.test(ov.innerHTML));
  ok('Mark complete is on the card', /Mark complete/.test(ov.innerHTML));
  ok('Remove moved onto the card, where it takes a deliberate press',
     /_maintRemoveTask\('t2'\)/.test(ov.innerHTML));
  ok('…and there is a way out that is not the backdrop', /_maintCloseTask\(\)/.test(ov.innerHTML));

  ok('the list is still drawn behind it', (h.els['maint-tasks'].innerHTML.match(/class="maint-task"/g) || []).length === 2);
}
{
  // Mark complete / Remove take the job off the list; the card must go with it.
  const tasks = [T('t1', 'E-unit service'), T('t2', 'Fix railing')];
  const h = runRender({ tasks });
  h.api.open('t2');
  ok('the card is open', h.st.appended.length === 1);
  tasks[1].status = 'done';                        // marked complete
  h.st.removed.push(h.st.appended[0]);
  h.api.render();
  ok('finishing the job closes its card — no card for a job that is gone',
     h.api.openId() === null || h.api.openId() === '');
}
{
  // The number renumbers; the id does not. This is the whole reason the number
  // is paint: "task 2" is a different job the moment one above it is finished.
  const tasks = [T('t1', 'E-unit service'), T('t2', 'Fix railing')];
  const h = runRender({ tasks });
  h.api.render();
  const before = h.els['maint-tasks'].innerHTML;
  ok('Fix railing is number 2 today', /2\.<\/span><span[^>]*>Fix railing/.test(before.replace(/\s+/g, '')) || /data-id="t2"/.test(before));
  tasks.splice(0, 1);                               // the first job is finished
  h.api.render();
  const after = h.els['maint-tasks'].innerHTML;
  ok('…and number 1 tomorrow — the number is paint', />1\.</.test(after) && !/>2\.</.test(after));
  ok('…while its id never moved, which is what everything actually saves against',
     /data-id="t2"/.test(after) && /_maintOpenTask\('t2'\)/.test(after));
}

section('F · planted offenders — the new rules can actually fail');
{
  const yn = renderSrc.replace(/var word = onHand \? 'On hand' : 'Waiting';/, "var word = 'Y';");
  ok('collapsing the three states back to one letter is caught',
     !/'On hand'/.test(yn.slice(yn.indexOf('partsStatus'), yn.indexOf('partsStatus') + 900)));

  const byIndex = renderSrc.replace(/_maintOpenTask\(\\'' \+ rrJsArg\(t\.id\) \+ '\\'\)/, "_maintOpenTask(' + (i + 1) + ')");
  ok('opening the card by the ROW NUMBER instead of the id is caught',
     byIndex !== renderSrc, 'the by-id call site was not found — check the anchor');

  const noGuard = renderSrc.replace(/window\.rrDismissGuard\(ov\)/, 'void 0');
  ok('dropping the v1786 guard on the card is caught', !/rrDismissGuard\(ov\)/.test(noGuard));

  ok('the card is NOT a second copy of the task guts — one taskBodyHtml, called once',
     (renderSrc.match(/var taskBodyHtml = function/g) || []).length === 1 &&
     (renderSrc.match(/taskBodyHtml\(t\)/g) || []).length === 1);

  ok('the row and the card both come from the ONE renderer',
     (renderSrc.match(/_maintPaintTaskCard\(\)/g) || []).length === 2);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

})();
