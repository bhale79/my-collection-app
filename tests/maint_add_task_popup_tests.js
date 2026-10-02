// ═══════════════════════════════════════════════════════════════
// maint_add_task_popup_tests.js — v0.9.1858, v0.9.1859 (a part on another job cannot be ticked).
//
// [stated] Brad, 2026-10-01, item 2 of his Workbench list: "the tasks for this
// item box should just show the tasks to do, keep the add task button. when i
// hit add task, that should bring up a pop that shows the services i can do
// line with the custom add. also the add a part button should show up here as
// well. also, i should see the parts for this item i have again so that i can
// click on that part if its part of the service i want to do."
//
// THE RULES THIS SUITE PROTECTS:
//   1. The Maintenance card's "Tasks for this item" box holds the tasks and a
//      "+ Add task" button — no dropdown, no − button.
//   2. "+ Add task" opens a pop-up (_maintAddTaskPopup) whose body is
//      _choreFormHtml — the SAME body the Workbench's step 2 shows: the
//      services as tappable lines (custom ones with a ×), "Something else…"
//      with its name box + keep-it checkbox, the parts this item has (tick to
//      put on the task), "+ Add task" and "+ Add a part for it".
//   3. Tapping a line sets the hidden #maint-chore-pick (the contract
//      _maintAddChore reads); "Something else…" reveals the name box.
//   4. _maintAddChore: creates the task, then puts every ticked part on it
//      through _maintPartSetTask (the ONE column-M writer) with the NEW task's
//      id; with andPart it then opens Need a part FOR that task. Nothing
//      picked → a plain-words toast, no row.
// The REAL builder and the REAL _maintAddChore run; every rule can fail.
// Run:  node tests/maint_add_task_popup_tests.js
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
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + sig);
}

// ── the real pop-up body ───────────────────────────────────────────────────
function buildForm(src, parts) {
  const code = grabFrom(src, 'function _choreFormHtml(addJs)') + '\n' + grabFrom(src, 'function _choreLinesHtml()');
  return new Function('_allChores', '_esc', '_btnPrimary', '_btnQuiet', '_btn', 'rrJsArg', 'CHORES', 'SECT', '_target', '_maintPickerParts',
    code + '\nreturn _choreFormHtml("_maintAddChore()");')(
    () => ['Oil / lubricate', 'E-unit service', 'My one-off'],
    s => String(s), () => 'class="p"', () => 'class="q"', () => 'class="b"', s => String(s),
    ['Oil / lubricate', 'E-unit service'], 'sect',
    () => ({ item: { itemNum: '2338' }, invId: '190' }),
    () => parts || { onHand: [], wanted: [] });
}
const DRUM = { part: { row: 7, description: 'Lionel Light Blue E-Unit Drum', partNum: '259E-1', status: 'bought' }, onTask: '' };
const WIRE = { part: { row: 9, description: 'E-Unit Finger Wire', partNum: '100-44', status: 'wanted' }, onTask: 'Fix railing' };

section('A · the Tasks box: the tasks and the button, nothing else');
const tasksSec = maint.slice(maint.indexOf("sec('Tasks for this item',"), maint.indexOf("sec('Parts for this item',"));
ok('the box is "+ Add task" (opening the pop-up) + the task list', /_maintAddTaskPopup\(\)/.test(tasksSec) && /id="maint-tasks"/.test(tasksSec));
ok('…no dropdown, no − button, no picker inline', !/_choreFormHtml/.test(tasksSec) && !/maint-chore-pick/.test(tasksSec) && !/_maintDelChore/.test(tasksSec));
ok('the pop-up and the Workbench\'s step 2 show the SAME body (_choreFormHtml, twice, nowhere else)',
   (maint.match(/_choreFormHtml\('_maintAddChore\(\)'\)/g) || []).length === 2
   && /window\._maintAddTaskPopup = function \(\) \{[\s\S]{0,900}?_choreFormHtml\('_maintAddChore\(\)'\)/.test(maint));
ok('the old dropdown handler is gone', !/_maintChorePickChange/.test(maint));

section('B · the pop-up body, built');
const html = buildForm(maint, { onHand: [DRUM], wanted: [WIRE] });
ok('each service is a tappable line that chooses it', /data-chore="Oil \/ lubricate"[^>]*onclick="_maintChoreChoose\(this\)"/.test(html) && /data-chore="E-unit service"/.test(html));
ok('a custom service carries a × that takes it off the list; built-ins do not', /_maintDelChore\('My one-off'\)/.test(html) && !/_maintDelChore\('Oil/.test(html) && !/_maintDelChore\('E-unit/.test(html));
ok('"Something else…" is a line too, and its name box + keep-it checkbox are there, hidden until chosen',
   /data-chore="__custom"/.test(html) && /id="maint-chore-custom" style="display:none/.test(html) && /id="maint-chore-custom-in"/.test(html) && /id="maint-chore-custom-keep"/.test(html));
ok('the chosen service rides in the hidden #maint-chore-pick', /<input type="hidden" id="maint-chore-pick" value="">/.test(html));
ok('the parts this item has are listed — the drum (in the drawer) with a tick box',
   /name="maint-chore-part" value="7"/.test(html) && /Lionel Light Blue E-Unit Drum/.test(html) && /#259E-1/.test(html) && /in your drawer/.test(html));
// v0.9.1859 ([stated] Brad): "if a part is on another task already, don't let it be available to be checked."
ok('…the wire, already on Fix railing, is shown greyed with NO tick box and names its job',
   !/name="maint-chore-part" value="9"/.test(html) && /E-Unit Finger Wire/.test(html) && /already on: Fix railing/.test(html)
   && /<label style="[^"]*color:var\(--text-dim\)[^"]*"><span aria-hidden="true"[^>]*><\/span><span><b>E-Unit Finger Wire/.test(html));
ok('…and the help line says so', /A part already on another job stays there/.test(html));
ok('it says what ticking a part does', /Tick a part to put it on this task/.test(html));
ok('"+ Add task" and "+ Add a part for it" are both there, and the second passes true', /onclick="_maintAddChore\(\)" class="p">\+ Add task</.test(html) && /onclick="_maintAddChore\(true\)" class="b">\+ Add a part for it</.test(html));
ok('…and the help line says what the second one does', /saves the task, then opens Need a part for that job/.test(html));
const bare = buildForm(maint, { onHand: [], wanted: [] });
ok('an item with no parts shows no parts block (and still both buttons)', !/maint-chore-parts/.test(bare) && /\+ Add a part for it/.test(bare));

section('C · choosing a line');
{
  const choose = grabFrom(maint, 'window._maintChoreChoose = function (el)');
  const els = {}; const win = {};
  const lines = [{ c: 'Oil / lubricate' }, { c: '__custom' }].map(l => ({ _a: { 'data-chore': l.c }, getAttribute(n) { return this._a[n]; }, setAttribute(n, v) { this._a[n] = v; }, style: {} }));
  els['maint-chore-pick'] = { value: '' };
  els['maint-chore-list'] = { querySelectorAll: () => lines };
  let focused = false;
  els['maint-chore-custom'] = { style: { display: 'none' }, querySelector: () => ({ focus() { focused = true; } }) };
  const fn = new Function('window', 'document', choose + '\nreturn window._maintChoreChoose;')(win, { getElementById: id => els[id] || null });
  fn(lines[0]);
  ok('tapping "Oil / lubricate" sets the hidden pick and lights that line only', els['maint-chore-pick'].value === 'Oil / lubricate' && lines[0]._a['data-on'] === '1' && lines[1]._a['data-on'] === '0' && els['maint-chore-custom'].style.display === 'none');
  fn(lines[1]);
  ok('tapping "Something else…" reveals the name box and focuses it', els['maint-chore-pick'].value === '__custom' && els['maint-chore-custom'].style.display === '' && focused);
}

section('D · the real _maintAddChore: the task, then the ticked parts, then Need a part');
(async function main() {
  const addSrc = grabFrom(maint, 'window._maintAddChore = async function');
  async function run(opts) {
    const calls = { appended: 0, row: null, setTask: [], popup: null, toasts: [], popRemoved: 0 };
    const els = { 'maint-chore-pick': { value: opts.pick }, 'maint-chore-custom-in': { value: opts.typed || '' }, 'maint-chore-custom-keep': { checked: false } };
    if (opts.popOpen) els['maint-addtask-pop'] = { remove() { calls.popRemoved++; } };
    const win = { _maintPartsPopup: (id, name) => { calls.popup = { id, name }; } };
    const fn = new Function(
      'window', 'document', 'state', '_target', '_isOwner', '_favs', '_saveFavs',
      'MAINT', 'CHORES', 'LOG_TAB', '_ensureLogTab', 'sheetsAppend', '_loadLog', '_wbBadge',
      '_maintRenderTasks', 'showToast', '_wbTarget', '_wbCloseCard', '_wbBuild', '_maintPartSetTask',
      addSrc + '\nreturn window._maintAddChore;'
    )(
      win,
      { getElementById: id => els[id] || null, querySelectorAll: () => (opts.ticked || []).map(v => ({ value: String(v) })) },
      { personalSheetId: 'sheet1' },
      () => ({ item: { itemNum: '2338' }, invId: '190' }),
      () => true, () => [], () => {}, { PREF_CHORES: 'x' }, ['Oil / lubricate', 'E-unit service'], 'Maintenance Log',
      async () => true,
      async (sheetId, range, rows) => { calls.appended++; calls.row = rows && rows[0]; return true; },
      async () => {}, () => {}, () => {},
      (m) => calls.toasts.push(String(m)),
      null, () => {}, () => {},
      async (row, taskId) => { calls.setTask.push([row, taskId]); return true; }
    );
    await fn(!!opts.andPart);
    return calls;
  }
  {
    const r = await run({ pick: 'E-unit service', ticked: [7, 9], popOpen: true });
    const id = r.row && String(r.row[0]).replace(/^'/, '');
    ok('a service with two ticked parts: ONE task row, written open', r.appended === 1 && r.row[3] === 'chore' && r.row[4] === 'E-unit service' && r.row[9] === 'open');
    ok('…both parts go on it through _maintPartSetTask, with the NEW task\'s id', r.setTask.length === 2 && r.setTask[0][0] === 7 && r.setTask[1][0] === 9 && r.setTask.every(x => x[1] === id) && /^log-\d+$/.test(id), JSON.stringify(r.setTask) + ' id=' + id);
    ok('…the pop-up closes, the toast counts the parts, Need a part does NOT open', r.popRemoved === 1 && r.toasts.some(t => /2 parts on it/.test(t)) && r.popup === null);
  }
  {
    const r = await run({ pick: 'Oil / lubricate', ticked: [], andPart: true });
    const id = String(r.row[0]).replace(/^'/, '');
    ok('"+ Add a part for it": the task is created first…', r.appended === 1 && r.setTask.length === 0);
    ok('…then Need a part opens FOR that task, named after it', r.popup && r.popup.id === id && /No\. 2338 · Oil \/ lubricate/.test(r.popup.name), JSON.stringify(r.popup));
  }
  {
    const r = await run({ pick: '', ticked: [7] });
    ok('nothing picked: no row, no part moved, a plain-words toast', r.appended === 0 && r.setTask.length === 0 && r.toasts.some(t => /Pick what needs doing first/.test(t)));
  }
  {
    const r = await run({ pick: '__custom', typed: 'Swap the bulb' });
    ok('a typed service still works (the v1766 path)', r.appended === 1 && r.row[4] === 'Swap the bulb');
  }

  section('E · planted offenders are caught');
  ok('E1 the dropdown put back in the Tasks box is caught', /_choreFormHtml/.test(tasksSec.replace("'<button onclick=\"_maintAddTaskPopup()\" '", "_choreFormHtml('_maintAddChore()') + '<button '")));
  ok('E2 a part line without the tick box is caught', !/name="maint-chore-part" value="7"/.test(buildForm(maint.replace('name="maint-chore-part" value="', 'name="x" value="'), { onHand: [DRUM], wanted: [] })));
  ok('E3 the × put on a built-in is caught', (() => { const o = maint.replace("var custom = CHORES.indexOf(ch) < 0;", "var custom = true;"); return /_maintDelChore\('Oil/.test(buildForm(o, null)); })());
  {
    const o = maint.replace("await _maintPartSetTask(picked[pi], logId);", "await _maintPartSetTask(picked[pi], '');");
    const addO = grabFrom(o, 'window._maintAddChore = async function');
    ok('E4 the parts put on a BLANK task id (not the new task) is caught', /_maintPartSetTask\(picked\[pi\], ''\)/.test(addO) && !/_maintPartSetTask\(picked\[pi\], logId\)/.test(addO));
  }
  ok('E6 a tick box on a part that is on another job is caught', /name="maint-chore-part" value="9"/.test(buildForm(maint.replace("var taken = !!e.onTask;", "var taken = false;"), { onHand: [], wanted: [WIRE] })));
  ok('E5 "+ Add a part for it" wired to a plain add (no true) is caught', !/_maintAddChore\(true\)/.test(buildForm(maint.replace("addJs.replace(/\\(\\)$/, '(true)')", "addJs"), null)));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
