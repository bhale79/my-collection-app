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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

})();
