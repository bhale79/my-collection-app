#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE WORKBENCH DATA-SAFETY RELEASE — v0.9.2038
//
// [stated] Brad, 2026-10-28: "let go through them and make sure they are iron
// clad" (the Workbench, Toolbox, My Manuals, Need-a-part, Parts Bin) → "go
// ahead" on fixing all of it, every fix with a test that runs the REAL code
// and fails on the old code. This file is release 1 of 2 — the thirteen ways
// the check found to lose, duplicate or misreport data (WORKBENCH_AUDIT_
// 2026-10-28.md, group A).
//
// Every section lifts the REAL functions out of app/maintenance.js,
// app/app-pages.js, app/sheets.js, app/reports.js and app/service-manual.js
// and runs them in a Node sandbox against a pretend sheet. Only the Google
// calls and the screen are stand-ins. Each rule is then proved able to fail:
// the OLD code (or the fix taken back out) is planted and must turn it red.
//
//   A1  a double tap saves ONCE (Add task, Want it, bin Use one / − +)
//   A2  "Installed" honours a refused write — nothing deleted, nothing logged
//   A3  the bin counts down only AFTER the part is recorded
//   A4  part buttons carry the part's ID; the row is looked up at write time
//   A5  typed text starting with - + = goes up as text, not a formula
//   A6  an open task's date edit is written
//   A7  editing a part keeps its Date Added
//   A8  removing a task from Service history unlinks its parts first
//   A9  the Want/Upgrade report reads all 13 columns through the one parser
//   A10 a failed read is "could not read", never "nothing"; sign-in retried
//   A11 a part that did not attach, a history line that did not save — said
//   A12 the service manual checklist: a failed read is not "owned none"
//   A13 a failed doc save does not upload the file again on the retry
//   — release 2, folded in (Brad: "lets build the next release before you
//     ship it. want to minimize updates") —
//   B14 a Trainz diagram by maker + era + number (no Lionel sheet for a Marx,
//       a Gilbert Flyer, a prewar 617; postwar 44 is the Launcher; 6822 ≠ MPC)
//   B15 a postwar sub-number (3562-25) finds its base's diagram
//   B16 a prewar item never gets a POSTWAR LCCA section
//   B17 LCCA finds powered units however spelled (2343-P, 2343, 204P → 204A)
//   B18 the panel falls back to the OWNED copy, never the last item viewed
//   B19 a row with no inventory ID asks which copy (two 54s: Lionel, Marx)
//   C20 the Add-task pop-up offers loose parts to tick
//   C21 Back closes the Maintenance panel and Need a part
//   C22 "Parts diagrams" pressed again stays on the Back list (+ back-stack.js)
//   C23 the diagrams pop-up comes back on screen after a resize / rotation
//   C24 the item page's buttons survive an apostrophe (rrJsArg)
//   C25 a Toolbox topic with an apostrophe filters to itself
//   C26 an installed part is not counted as needed (badge, card, report, page)
//   C27 the Workbench page asks the gate every time it is shown
//   C28 a document saved with no name is named after its file
//   N   the nightly's red: no "free" in the Office's variation message
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const MAINT = read('maintenance.js'), PAGES = read('app-pages.js'), SHEETS = read('sheets.js'),
      REPORTS = read('reports.js'), SM = read('service-manual.js'), YM = read('yardmaster.js'), CFG = read('config.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
// a function (or `window.x = function`) by its first line, braces balanced
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { let e = k + 1; if (src[e] === ';') e++; return src.slice(i, e); } } }
  throw new Error('unbalanced: ' + sig);
}
function line(src, start) { const i = src.indexOf(start); if (i < 0) throw new Error('not found: ' + start); return src.slice(i, src.indexOf('\n', i)); }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 0));

// ── the sandbox: real functions + a pretend sheet ─────────────────────────
// sheet: { 'Parts Needed': {row: [cells]}, 'Maintenance Log': …, 'Parts Bin': …, 'My Collection': … }
function sandbox(o) {
  o = o || {};
  const log = [];
  const c = {
    console: { log() {}, warn() {}, error() {} }, Promise, Date, JSON, Object, Array, String, Number, Math, RegExp, Error, setTimeout, clearTimeout,
    log, toasts: [], accessToken: 'tok',
    state: Object.assign({ personalSheetId: 'MINE', partsData: {}, maintLog: [], partsBin: [], personalData: {}, myManuals: null }, o.state || {}),
    PERSONAL_TAB: 'My Collection', LOG_TAB: 'Maintenance Log', BIN_TAB: 'Parts Bin', DOCS_TAB: 'My Manuals',
    LB: 'lb', SECT: 'sect', MAINT: { PREF_CHORES: 'x' }, CHORES: ['Oil / lubricate', 'E-unit service'],
    _busy: {}, _readFailed: { docs: false, log: false, bin: false }, _wbTarget: null, _previewArgs: null,
    refuse: o.refuse || {},          // { 'Parts Needed': true } → rrRowStillIs says the row moved
    slow: o.slow || 0,
  };
  c.window = c;
  c.document = { getElementById: () => null };
  c.showToast = (m) => { c.toasts.push(String(m)); };
  c.appConfirm = async () => true;
  c.rrEsc = s => String(s == null ? '' : s);
  c.rrJsArg = s => String(s == null ? '' : s).replace(/'/g, "\\'");
  c.rrSaveError = (e) => 'save error: ' + (e && e.message);
  c.personalColLetter = (f) => ({ notes: 'N', allOriginal: 'O' })[f] || 'Z';
  c._target = () => ({ item: { itemNum: '2338' }, invId: '190' });
  c._isOwner = () => true; c._maintIsOwner = () => true;
  c._favs = () => []; c._saveFavs = () => {};
  ['_wbBadge', '_maintRenderTasks', '_wbBuild', '_wbCloseCard', '_renderPartsList', '_binBuild', '_updatePartsBadge', 'renderBrowse', 'buildDashboard', '_cachePersonalData', '_maintRenderMyDocs', '_tbRefresh'].forEach(n => { c[n] = () => { log.push(n); }; });
  c._binVisible = () => false;
  c._ensureLogTab = async () => true; c._ensureBinTab = async () => true; c._ensureDocsTab = async () => true;
  c._ensurePartsTab = async () => true; c._ensurePartsLifecycleCols = async () => true; c._ensureLogNotesCol = async () => true;
  c._loadLog = async () => true; c._loadBin = async () => true;
  c.buildPartsPage = async () => { log.push('buildPartsPage'); };
  // the guarded writers: the REAL contract (false = refused, told the user) on a pretend sheet
  c.rrVerifiedRowUpdate = async (sid, tab, row, range, values, expect, what) => {
    log.push('verified ' + range + ' ' + JSON.stringify(values));
    if (c.slow) await tick(c.slow);
    if (c.refuse[tab] || c.refuse[range]) { c.toasts.push('Your ' + (what || tab) + ' changed somewhere else — nothing was written. Refresh and try again.'); return false; }
    return true;
  };
  c.rrRemoveRowConfirmed = async (sid, tab, row, range) => { log.push('remove ' + range); return !c.refuse['remove ' + tab]; };
  c.sheetsAppend = async (sid, range, rows) => {
    log.push('append ' + range + ' ' + JSON.stringify(rows));
    if (c.slow) await tick(c.slow);
    if (c.failAppend && c.failAppend.test(range)) throw new Error('offline');
    return 7;
  };
  c.sheetsUpdate = async (sid, range, values) => { log.push('update ' + range + ' ' + JSON.stringify(values)); return {}; };
  c.sheetsGet = async (sid, range) => { log.push('get ' + range); if (c.failGet) throw new Error(c.failGet); return { values: c.getValues || [] }; };
  vm.createContext(c);
  return c;
}
function load(c, code) { vm.runInContext(code, c); return c; }
const RRSHEETTEXT = grab(SHEETS, 'function rrSheetText(v)');
const PARTSFIND = grab(PAGES, 'function _partsFind(partId)');
const ONCE = grab(MAINT, 'async function _once(key, fn)');

(async function main() {

  // ═══ A1 · a double tap saves once ═══════════════════════════════════════
  section('A1 · a double tap saves ONCE');
  {
    const run = async (src) => {
      const c = sandbox({ slow: 15 });
      c.document = { getElementById: id => ({ 'maint-chore-pick': { value: 'E-unit service' } })[id] || null, querySelectorAll: () => [] };
      load(c, RRSHEETTEXT + '\n' + grab(src, 'window._maintAddChore = async function (andPart)') + '\n' + grab(src, 'async function _maintAddChoreRun(andPart)'));
      await Promise.all([c._maintAddChore(), c._maintAddChore()]);
      return c.log.filter(l => /^append Maintenance Log/.test(l)).length;
    };
    ok('two taps on "+ Add task" while the first saves → ONE task row', (await run(MAINT)) === 1);
    ok('PLANTED: the guard taken out → two rows (the check can fail)', (await run(plant(MAINT, 'if (_busy.addChore) return false;', ''))) === 2);
  }
  {
    const run = async (src) => {
      const c = sandbox({ slow: 15 });
      c.document = { getElementById: () => null };
      c._partsFindDup = () => null; c._partsChooser = () => {};
      c._partsAppendRow = async (f) => { c.log.push('appendPart'); await tick(15); };
      load(c, grab(src, 'async function _maintPopSaveWanted(fields, taskId, retry)'));
      const f = { description: 'drum', forInv: '190', forItem: '2338', taskId: 'log-1' };
      await Promise.all([c._maintPopSaveWanted(f, 'log-1'), c._maintPopSaveWanted(f, 'log-1')]);
      return c.log.filter(l => l === 'appendPart').length;
    };
    ok('two taps on "+ Want it" / "+ Add to Parts Wanted" → ONE wanted row', (await run(MAINT)) === 1);
    ok('PLANTED: the guard taken out → two rows', (await run(plant(MAINT, 'if (_busy.saveWanted) return false;', ''))) === 2);
  }
  const BINUSE = (src) => ONCE + '\n' + grab(src, "window._maintBinUse = function (binId, taskId)") + '\n' + grab(src, 'async function _binCountDown(b)') + '\n'
    + line(src, 'var BIN_COUNT_MISSED = ') + '\n' + grab(src, 'async function _maintBinUseRun(binId, taskId)');
  const binState = () => ({ partsBin: [{ id: 'bin-1', row: 4, qty: 3, desc: 'e-unit', partNum: '', where: 'York' }], partsData: {} });
  {
    const run = async (src) => {
      const c = sandbox({ slow: 15, state: binState() });
      c.document = { getElementById: () => null };
      c._partsFindDup = () => null;
      c._partsAppendRow = async () => { c.log.push('appendPart'); await tick(15); };
      c._maintPartSetTask = async () => true;
      load(c, BINUSE(src));
      await Promise.all([c._maintBinUse('bin-1', 'log-1'), c._maintBinUse('bin-1', 'log-1')]);
      return { parts: c.log.filter(l => l === 'appendPart').length, counts: c.log.filter(l => /Parts Bin!D4/.test(l)).length, qty: c.state.partsBin[0].qty };
    };
    const r = await run(MAINT);
    ok('two taps on the bin\'s "Use one" → ONE part recorded, ONE taken out (3 → 2)', r.parts === 1 && r.counts === 1 && r.qty === 2, r);
    const p = await run(plant(MAINT, "return _once('bin:' + binId, function () { return _maintBinUseRun(binId, taskId); });", 'return _maintBinUseRun(binId, taskId);'));
    ok('PLANTED: the guard taken out → two parts recorded', p.parts === 2, p);
  }
  {
    const run = async (src) => {
      const c = sandbox({ slow: 15, state: binState() });
      load(c, ONCE + '\n' + grab(src, 'window._maintBinQty = function (id, delta)'));
      await Promise.all([c._maintBinQty('bin-1', -1), c._maintBinQty('bin-1', -1)]);
      return c.log.filter(l => /Parts Bin!D4/.test(l));
    };
    const r = await run(MAINT);
    ok('two taps on − while the first saves → one write, and it writes 2 (not two writes of 2)', r.length === 1 && /\[\["2"\]\]/.test(r[0]), r);
    const p = await run(plant(MAINT, "return _once('bin:' + id, async function () {", "return (function (k, fn) { return fn(); })('bin:' + id, async function () {"));
    ok('PLANTED: the guard taken out → two writes', p.length === 2, p);
  }

  // ═══ A2 · Installed honours a refused write ═══════════════════════════
  section('A2 · "Installed" honours a refused write');
  const installRun = async (src, opts) => {
    const pd = { row: 12, itemNum: '2338', inventoryId: '190', notes: opts.notes || 'bought at York', allOriginal: 'Yes' };
    const c = sandbox({ refuse: opts.refuse || {}, state: {
      partsData: { p7: { id: 'part-7', row: 7, description: 'drum', partNum: '259E-1', forInv: '190', forItem: '2338', status: 'bought', taskId: '' } },
      personalData: { '190': pd }, maintLog: [] } });
    c._maintIsOwner = () => !!opts.owner;
    const els = { '_inst-desc': { value: 'drum' }, '_inst-part': { value: '259E-1' }, '_inst-price': { value: '' }, '_inst-vendor': { value: '' }, '_inst-date': { value: '2026-10-28' }, '_inst-orig': { value: 'No' } };
    c.document = { getElementById: id => els[id] || null };
    c.removePart = async (id) => { c.log.push('removePart ' + id); return true; };
    c._maintLogPartInstalled = async () => { c.log.push('logInstalled'); return opts.logOk !== false; };
    c.PARTS_COPY = { markDone: '%s' };
    load(c, RRSHEETTEXT + '\n' + PARTSFIND + '\n' + grab(src, 'async function _savePartInstalled(partId)'));
    await c._savePartInstalled('part-7');
    return { c, pd, notesWrites: c.log.filter(l => /My Collection!N12/.test(l)).length };
  };
  {
    const r = await installRun(PAGES, { owner: false, refuse: { 'My Collection': true } });
    ok('not the owner, the item\'s row refused → the part is NOT taken off the list', !r.c.log.some(l => /^removePart/.test(l)), r.c.log);
    ok('…the item\'s notes in memory are unchanged and no "✓ Installed" is shown', r.pd.notes === 'bought at York' && !r.c.toasts.some(t => /✓ Installed/.test(t)), r.c.toasts);
    const p = await installRun(plant(PAGES, "[[rrSheetText(newNotes)]], _who, 'collection'))) return;", "[[rrSheetText(newNotes)]], _who, 'collection'))) {}"), { owner: false, refuse: { 'My Collection': true } });
    ok('PLANTED: the refusal ignored (the old code) → the part IS deleted', p.c.log.some(l => /^removePart/.test(l)), p.c.log);
  }
  {
    const r = await installRun(PAGES, { owner: true, refuse: { 'Parts Needed': true } });
    ok('the owner, Parts Needed refused → no "Installed" line in the service history, no ✓ toast', !r.c.log.includes('logInstalled') && !r.c.toasts.some(t => /✓ Installed/.test(t)), r.c.log);
    ok('…the part stays "bought" and the toast says what to check', r.c.state.partsData.p7.status === 'bought' && r.c.toasts.some(t => /Parts list did not update/.test(t)), r.c.toasts);
    const p = await installRun(plant(PAGES, "'Parts Needed!I' + rowNum + ':L' + rowNum, [['installed', p.dateBought || '', date, price || '']], { num: p.id }, 'Parts list'))) {", "'Parts Needed!I' + rowNum + ':L' + rowNum, [['installed', p.dateBought || '', date, price || '']], { num: p.id }, 'Parts list')) && false) {"), { owner: true, refuse: { 'Parts Needed': true } });
    ok('PLANTED: the refusal ignored → the history line IS written', p.c.log.includes('logInstalled'), p.c.log);
  }
  {
    const line1 = '2026-10-28 — Installed drum (part# 259E-1)';
    const r = await installRun(PAGES, { owner: true, notes: 'bought at York\n' + line1 });
    ok('a retry after a refusal does not write the same notes line twice', r.notesWrites === 0 && r.pd.notes.split(line1).length === 2, r.c.log);
    const r2 = await installRun(PAGES, { owner: true, logOk: false });
    ok('a history line that did not save is SAID (A11), not only logged to the console', r2.c.toasts.some(t => /service-history line did not save/.test(t)), r2.c.toasts);
  }

  // ═══ A3 · the bin counts down only after the part is recorded ════════
  section('A3 · the Parts Bin counts down only AFTER the part is recorded');
  {
    const run = async (src) => {
      const c = sandbox({ state: binState() });
      c.document = { getElementById: () => null };
      c._partsFindDup = () => null;
      c._partsAppendRow = async () => { throw new Error('offline'); };
      load(c, BINUSE(src));
      await c._maintBinUse('bin-1', 'log-1');
      return { qty: c.state.partsBin[0].qty, counted: c.log.some(l => /Parts Bin!D4/.test(l)) };
    };
    const r = await run(MAINT);
    ok('"Use one" whose record fails → the bin is NOT touched (still 3)', r.qty === 3 && !r.counted, r);
    const old = plant(MAINT, "    try {\n      var today = new Date().toISOString().split('T')[0];\n      var fields = { description: b.desc,", "    try {\n      await _binCountDown(b);\n      var today = new Date().toISOString().split('T')[0];\n      var fields = { description: b.desc,");
    const p = await run(old);
    ok('PLANTED: the count-down first (the old order) → the bin is one short', p.qty === 2, p);
  }
  {
    const run = async (src, bought) => {
      const c = sandbox({ state: Object.assign(binState(), { partsData: { p9: { id: 'part-9', row: 9, forItem: '84631', status: 'wanted' } } }) });
      c.markPartBought = async () => { c.log.push('bought'); return bought; };
      load(c, ONCE + '\n' + PARTSFIND + '\n' + grab(src, 'window._maintBinUseFor = function (binId, partId)') + '\n' + grab(src, 'async function _binCountDown(b)') + '\n'
        + line(src, 'var BIN_COUNT_MISSED = ') + '\n' + grab(src, 'async function _maintBinUseForRun(binId, partId)'));
      await c._maintBinUseFor('bin-1', 'part-9');
      return c.state.partsBin[0].qty;
    };
    ok('"Use it for 84631" whose stamp is refused → the bin is NOT touched', (await run(MAINT, false)) === 3);
    ok('…and when it lands, one comes out (3 → 2)', (await run(MAINT, true)) === 2);
    const p = await run(plant(MAINT, "if (typeof markPartBought !== 'function' || !(await markPartBought(p.id))) return;", "await markPartBought(p.id);"), false);
    ok('PLANTED: the stamp\'s answer ignored → the bin counts down anyway', p === 2, p);
  }

  // ═══ A4 · part buttons carry the id ═══════════════════════════════════
  section('A4 · part buttons carry the part\'s ID; the row is read at write time');
  {
    // the list was drawn with the drum at row 7; a reload since moved it to row 8 and put the WIRE at row 7
    const run = async (src, arg) => {
      const c = sandbox({ state: { partsData: { p7: { id: 'part-wire', row: 7, status: 'wanted' }, p8: { id: 'part-drum', row: 8, status: 'wanted' } } } });
      load(c, PARTSFIND + '\n' + grab(src, 'async function markPartBought(partId)'));
      await c.markPartBought(arg);
      return c.log.filter(l => /^verified/.test(l));
    };
    const r = await run(PAGES, 'part-drum');
    ok('"Bought it" on the drum (by id) after the rows moved → writes row 8, the drum', r.length === 1 && /Parts Needed!I8:J8/.test(r[0]), r);
    const old = plant(PAGES, 'var p = _partsFind(partId);\n  if (!p) { if (typeof showToast', "var p = Object.values(state.partsData || {}).find(function (x) { return x.row === partId; });\n  if (!p) { if (typeof showToast");
    const p = await run(old, 7);
    ok('PLANTED: found by the remembered row (the old button) → it writes row 7, the WIRE', p.length === 1 && /Parts Needed!I7:J7/.test(p[0]), p);
  }
  {
    const run = async (src) => {
      const c = sandbox({ state: { partsData: { p7: { id: 'part-wire', row: 7, taskId: '' }, p8: { id: 'part-drum', row: 8, taskId: '' } } } });
      load(c, PARTSFIND + '\n' + grab(src, 'async function _maintPartSetTask(partId, taskId)'));
      await c._maintPartSetTask('part-drum', 'log-1');
      return { w: c.log.filter(l => /^verified/.test(l)), drum: c.state.partsData.p8.taskId };
    };
    const r = await run(MAINT);
    ok('putting the drum on a task (Attach / Move / a tick box) writes the drum\'s row M8', r.w.length === 1 && /Parts Needed!M8/.test(r.w[0]) && r.drum === 'log-1', r);
  }
  // every button that names a part: the id, never p.row / f.part.row / dup.row
  const PART_FNS = 'markPartBought|markPartInstalled|removePart|_savePartInstalled|_maintPartSetTask|_maintPartMove|_maintPopAttach|_maintBinUseFor|_maintPartBought|_maintPartInstalled|_maintPartRemove|savePart';
  const rowArg = new RegExp('\\b(?:' + PART_FNS + ')\\([^;\\n]*?\\b(?:p|dup|f\\.part|existing|_dup|parts\\[i\\])\\.row\\b');
  const scanRows = (srcs) => Object.keys(srcs).filter(f => rowArg.test(srcs[f]));
  ok('no part button or call in app-pages.js / maintenance.js passes a sheet row', scanRows({ 'app-pages.js': PAGES, 'maintenance.js': MAINT }).length === 0, scanRows({ 'app-pages.js': PAGES, 'maintenance.js': MAINT }));
  ok('…the tick boxes in Add task carry the id', /name="maint-chore-part" value="' \+ _esc\(String\(p\.id\)\)/.test(MAINT));
  ok('PLANTED: the old "Bought it" button (p.row) is caught', scanRows({ x: PAGES.replace("markPartBought(\\'' + rrJsArg(p.id) + '\\')", "markPartBought(' + p.row + ')") }).length === 1);
  ok('PLANTED: the old bin "Use it for" (f.part.row) is caught', scanRows({ x: MAINT.replace("_maintBinUseFor(\\'' + rrJsArg(b.id) + '\\',\\'' + rrJsArg(f.part.id) + '\\')", "_maintBinUseFor(\\'' + rrJsArg(b.id) + '\\',' + f.part.row + ')") }).length === 1);

  // ═══ A5 · typed text stays text ═══════════════════════════════════════
  section('A5 · typed text starting with - + = goes up as text');
  {
    const c = sandbox(); load(c, RRSHEETTEXT);
    ok('rrSheetText: "-replaced brushes" → "\'-replaced brushes" (Sheets keeps the words)', c.rrSheetText('-replaced brushes') === "'-replaced brushes");
    ok('…"=see notes", "+2 shims", plain words: all behind one apostrophe; "\'Tis" keeps its own', c.rrSheetText('=see notes') === "'=see notes" && c.rrSheetText('+2 shims') === "'+2 shims" && c.rrSheetText('oil') === "'oil" && c.rrSheetText("'Tis") === "''Tis");
    ok('…an empty box stays empty (no lone apostrophe)', c.rrSheetText('') === '' && c.rrSheetText(null) === '');
  }
  {
    const c = sandbox(); load(c, RRSHEETTEXT + '\n' + grab(PAGES, 'function _partsRowBuild(f)'));
    const r = c._partsRowBuild({ id: 'part-1', description: '-E-unit drum', notes: '=ask Bob' });
    ok('a part\'s description and notes (the one row builder) go up as text', r[1] === "'-E-unit drum" && r[6] === "'=ask Bob", r);
    const p = sandbox(); load(p, RRSHEETTEXT + '\n' + grab(plant(PAGES, "rrSheetText(f.description || '')", "String(f.description || '')"), 'function _partsRowBuild(f)'));
    ok('PLANTED: the old builder → "-E-unit drum" written bare (a formula)', p._partsRowBuild({ description: '-E-unit drum' })[1] === '-E-unit drum');
  }
  {
    const run = async (src) => {
      const c = sandbox({ state: { maintLog: [{ id: 'log-1', row: 5, notes: '' }] } });
      c.document = { getElementById: id => id === 'task-notes-log-1' ? { value: '-cleaned the brushes' } : null };
      c._notesTimers = {};
      load(c, RRSHEETTEXT + '\nvar _notesTimers = {};\n' + grab(src, 'window._maintSaveTaskNotes = async function (rowNum, logId, quiet)'));
      await c._maintSaveTaskNotes(5, 'log-1', true);
      return c.log.filter(l => /Maintenance Log!K5/.test(l))[0] || '';
    };
    ok('a task note "-cleaned the brushes" is written as text', /"'-cleaned the brushes"/.test(await run(MAINT)));
    ok('PLANTED: the old write → bare', /"-cleaned the brushes"/.test(await run(plant(MAINT, '[[rrSheetText(txt)]]', '[[txt]]'))));
  }
  ok('every typed field in the bin, the doc form, the Toolbox edit, the history edit, the service manual goes through rrSheetText',
     /rrSheetText\(desc\), String\(qty\), rrSheetText\(g\('binf-where'\)\)/.test(MAINT) && /rrSheetText\(title\), type, url, rrSheetText\(covers\), rrSheetText\(topics\)/.test(MAINT)
     && /\[\[rrSheetText\(title\), type, url, rrSheetText\(covers\), rrSheetText\(topics\), rrSheetText\(notes\)\]\]/.test(MAINT)
     && /\[\[rrSheetText\(text\), _t\(part\), rrSheetText\(by\)/.test(MAINT) && /\[\[rrSheetText\(cond\), rrSheetText\(notes\)\]\]/.test(SM)
     && /rrSheetText\(desc \|\| 'part installed'\)/.test(MAINT) && /'chore', rrSheetText\(chore\)/.test(MAINT));

  // ═══ A6 + A5 · the history edit ═══════════════════════════════════════
  section('A6 · an OPEN task\'s date edit is written (and the text goes up as text)');
  const editRun = async (src, entry, typed) => {
    const c = sandbox({ state: { maintLog: [entry] } });
    const els = {};
    const mk = (id, v) => { els[id] = { value: v }; };
    mk('ent-text', typed.text); mk('ent-date', typed.date); mk('ent-by', typed.by || 'self'); mk('ent-notes', typed.notes || '');
    const btn = { disabled: false, textContent: 'Save' }; els['ent-save'] = btn;
    c.document = { getElementById: id => els[id] || null, body: { insertAdjacentHTML() {} } };
    c.BackStack = null;
    ['_cardOpen', '_cardHead', '_cardFoot', '_btnSecondary', '_btnCancel', '_btnSave'].forEach(n => { c[n] = () => ''; });
    c._esc = s => String(s == null ? '' : s);
    load(c, RRSHEETTEXT + '\n' + grab(src, 'window._maintEditEntry = function (logId)'));
    c._maintEditEntry(entry.id);
    await btn.onclick.call(btn);
    return { w: c.log.filter(l => /^verified Maintenance Log!E/.test(l))[0] || '', l: c.state.maintLog[0] };
  };
  {
    const open = { id: 'log-1', row: 6, type: 'chore', status: 'open', text: 'E-unit service', dateAdded: '2026-10-01', dateDone: '', by: 'self', notes: '' };
    const r = await editRun(MAINT, Object.assign({}, open), { text: 'E-unit service', date: '2026-10-20' });
    ok('an open task moved to 2026-10-20 → Date Added (H) is written as 2026-10-20', /"'2026-10-20",""/.test(r.w) && r.l.dateAdded === '2026-10-20', r.w);
    const p = await editRun(plant(MAINT, 'var dateAdded = isOpen ? (date || l.dateAdded) : (l.dateAdded || date);', 'var dateAdded = l.dateAdded || date;'), Object.assign({}, open), { text: 'E-unit service', date: '2026-10-20' });
    ok('PLANTED: the old line (writes the OLD date back) is caught', /"'2026-10-01",""/.test(p.w), p.w);
    const done = { id: 'log-2', row: 7, type: 'chore', status: 'done', text: 'Oil', dateAdded: '2026-09-01', dateDone: '2026-09-02', by: 'self', notes: '' };
    const d = await editRun(MAINT, done, { text: 'Oil', date: '2026-09-05' });
    ok('a finished entry: its Date Done moves, its Date Added stays', /"'2026-09-01","'2026-09-05"/.test(d.w), d.w);
    const t = await editRun(MAINT, Object.assign({}, open), { text: '-replaced brushes', date: '2026-10-01', by: '+Bob', notes: '=see box' });
    ok('A5: the history edit writes text, serviced-by and notes as text', /"'-replaced brushes"/.test(t.w) && /"'\+Bob"/.test(t.w) && /"'=see box"/.test(t.w), t.w);
  }

  // ═══ A7 · editing a part keeps its Date Added ══════════════════════════
  section('A7 · editing a part keeps its Date Added');
  {
    const run = async (src) => {
      const c = sandbox({ state: { partsData: { p7: { id: 'part-7', row: 7, description: 'drum', dateAdded: '2026-09-01', photo: '' } } } });
      const els = { '_part-desc': { value: 'drum, blue' }, '_part-num': { value: '259E-1' }, '_part-notes': { value: '' }, '_part-for': { value: '', selectedIndex: -1, options: [] } };
      c.document = { getElementById: id => els[id] || null };
      c._partsSplitTyped = () => ({ partNum: '', description: '' });
      c._partsFindDup = () => null; c._partsAppendRow = async () => { c.log.push('appendPart'); };
      load(c, RRSHEETTEXT + '\n' + PARTSFIND + '\n' + grab(src, 'async function savePart(existingId)'));
      await c.savePart('part-7');
      return c.log.filter(l => /Parts Needed!A7:H7/.test(l))[0] || '';
    };
    const w = await run(PAGES);
    ok('an edit writes the part\'s own Date Added back (2026-09-01), not today', /"'2026-09-01"\]\]$/.test(w), w);
    const p = await run(plant(PAGES, "_t(ex.dateAdded || new Date().toISOString().split('T')[0])];", "_t(new Date().toISOString().split('T')[0])];"));
    ok('PLANTED: the old row (today\'s date) is caught', !/"'2026-09-01"/.test(p) && /Parts Needed!A7:H7/.test(p), p);
    const c2 = sandbox({ state: { partsData: {} } });
    c2.document = { getElementById: id => ({ '_part-desc': { value: 'x' } })[id] || null };
    c2._partsSplitTyped = () => ({}); c2._partsFindDup = () => null; c2._partsAppendRow = async () => { c2.log.push('appendPart'); };
    load(c2, RRSHEETTEXT + '\n' + PARTSFIND + '\n' + grab(PAGES, 'async function savePart(existingId)'));
    await c2.savePart('part-gone');
    ok('editing a part that is no longer on the list adds NOTHING (it used to fall through to a new part)', !c2.log.includes('appendPart') && c2.toasts.some(t => /no longer on your list/.test(t)), c2.log);
  }

  // ═══ A8 · removing a task from the history unlinks its parts ═════════
  section('A8 · removing an open task from Service history unlinks its parts first');
  {
    const run = async (src) => {
      const c = sandbox({ state: { maintLog: [{ id: 'log-1', row: 6, type: 'chore', status: 'open', text: 'E-unit', dateAdded: '2026-10-01' }],
        partsData: { p7: { id: 'part-7', row: 7, taskId: 'log-1', status: 'wanted' } } } });
      c._taskParts = (id) => Object.values(c.state.partsData).filter(p => p.taskId === id);
      c._maintPartSetTask = async (id, t) => { c.log.push('unlink ' + id + ' "' + t + '"'); c.state.partsData.p7.taskId = t; return true; };
      c._removeLogRow = async () => { c.log.push('removeRow'); return true; };
      load(c, grab(src, 'async function _unlinkTaskParts(logId)') + '\n' + grab(src, 'window._maintRemoveEntry = async function (logId)'));
      await c._maintRemoveEntry('log-1');
      return c.log.filter(l => /^unlink|^removeRow/.test(l));
    };
    const r = await run(MAINT);
    ok('the part is unlinked, THEN the row goes', r.join('|') === 'unlink part-7 ""|removeRow', r);
    const p = await run(plant(MAINT, "      if (!(await _unlinkTaskParts(logId))) return;\n      await _removeLogRow(l);", "      await _removeLogRow(l);"));
    ok('PLANTED: the old Remove (no unlink) → the part keeps pointing at a deleted task', p.join('|') === 'removeRow', p);
  }

  // ═══ A9 · the report reads every column through the one parser ═══════
  section('A9 · the Want/Upgrade report reads A–M through the one parser');
  const wup = REPORTS.slice(REPORTS.indexOf('if (!_wupPartsLoading) {'), REPORTS.indexOf('_wupPartsLoading=false;'));
  const a9 = (src) => /sheetsGet\(state\.personalSheetId,'Parts Needed!A3:M'\); state\.partsData=_parsePartsRows\(res\.values\);/.test(src) && !/'Parts Needed!A3:H'/.test(src);
  ok('it reads Parts Needed!A3:M and parses with _parsePartsRows (status + task kept)', a9(wup));
  ok('PLANTED: the old A3:H hand parser is caught', !a9(REPORTS.replace("'Parts Needed!A3:M'); state.partsData=_parsePartsRows(res.values);", "'Parts Needed!A3:H'); const parts={}; state.partsData=parts;")));
  {
    const c = sandbox(); load(c, 'var window = this;\n' + grab(PAGES, 'function _parsePartsRows(values)'));
    const parts = c._parsePartsRows([['part-1', 'drum', '', '', '', '', '', '2026-10-01', 'installed', '', '2026-10-20', '', 'log-1']]);
    ok('…and that parser keeps "installed" and the task (so nothing flips back to "Bought it")', parts.p3.status === 'installed' && parts.p3.taskId === 'log-1', parts);
  }

  // ═══ A10 · a failed read is "could not read" ═════════════════════════
  section('A10 · a failed read is "could not read", never "nothing"');
  {
    const run = async (src) => {
      const c = sandbox();
      c.failGet = 'Sheets API error 503';
      load(c, grab(src, 'async function _loadMyDocs()'));
      const r = await c._loadMyDocs();
      return { r, docs: c.state.myManuals, failed: c._readFailed.docs };
    };
    const r = await run(MAINT);
    ok('My Manuals read fails → false, the library stays unloaded (null), marked failed', r.r === false && r.docs === null && r.failed === true, r);
    const p = await run(plant(MAINT, "var res = await sheetsGet(state.personalSheetId, DOCS_TAB + '!A2:H');", "var res = await sheetsGet(state.personalSheetId, DOCS_TAB + '!A2:H').catch(function () { return { values: [] }; });"));
    ok('PLANTED: the old .catch → an EMPTY library (the "Nothing saved" lie)', Array.isArray(p.docs) && p.docs.length === 0, p);
  }
  {
    const c = sandbox(); c._readFailed.docs = true;
    const box = { innerHTML: '' };
    c.document = { getElementById: id => id === 'wb-toolbox' ? box : null };
    c._btnQuiet = () => ''; c._btn = () => '';
    load(c, grab(MAINT, 'function _readFailHtml(what, retryJs)') + '\n' + grab(MAINT, 'function _tbRender()'));
    c._tbRender();
    ok('the Toolbox then says it could not read it, with Try again — not "Loading your Toolbox…" for ever', /Could not read your Toolbox/.test(box.innerHTML) && /_maintDocsRetry\(\)/.test(box.innerHTML) && !/Loading your Toolbox/.test(box.innerHTML), box.innerHTML);
  }
  {
    const run = async (src) => {
      const c = sandbox({ state: { partsData: { p7: { id: 'part-7', row: 7, description: 'drum' } } } });
      c.failGet = 'offline';
      c.document = { getElementById: id => id === 'parts-list' ? { innerHTML: '' } : null };
      c._parsePartsRows = () => ({});
      load(c, grab(src, 'async function buildPartsPage()'));
      await c.buildPartsPage();
      return Object.keys(c.state.partsData).length;
    };
    ok('the Parts page whose read fails keeps the parts already loaded (and says so)', (await run(PAGES)) === 1);
    ok('PLANTED: the old .catch → the list emptied', (await run(plant(PAGES, "var res = await sheetsGet(state.personalSheetId, 'Parts Needed!A3:M');\n    state.partsData", "var res = await sheetsGet(state.personalSheetId, 'Parts Needed!A3:M').catch(function () { return { values: [] }; });\n    state.partsData"))) === 0);
  }
  {
    // the "is the tab there?" checks: every one goes through _withTokenRetry
    const raw = /await \(await fetch\('https:\/\/sheets\.googleapis\.com|await fetch\('https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/' \+ (state\.personalSheetId|sid) \+ ':batchUpdate'/;
    const ensures = [grab(MAINT, 'async function _ensureDocsTab()'), grab(MAINT, 'async function _ensureLogTab()'), grab(MAINT, 'async function _ensureBinTab()'), grab(PAGES, 'async function _ensurePartsTab()'), grab(SM, 'async function _smEnsureTab()')];
    ok('My Manuals, Maintenance Log, Parts Bin, Parts Needed, Service Manual tab checks: no raw fetch, all through _withTokenRetry', ensures.every(f => !raw.test(f) && (f.match(/_withTokenRetry\(/g) || []).length === 2), ensures.map(f => raw.test(f)));
    ok('PLANTED: the old raw fetch is caught', raw.test("var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',"));
    ok('a new Parts Needed tab gets its 13 headings in A2:M2 (A2:L2 was refused by Google — one column short)', /'Parts Needed!A2:M2'/.test(ensures[3]) && !/'Parts Needed!A2:L2'/.test(ensures[3]));
  }
  {
    // the bin's For Sale list: a failed read used to ask again, and again, for ever
    const c = sandbox({ state: { partsBin: null } });
    let reads = 0;
    c._loadBin = async () => { reads++; return false; };
    c._fsPartsHost = () => ({ innerHTML: '' });
    load(c, grab(MAINT, 'window._maintRenderFsParts = function ()'));
    c._maintRenderFsParts(); await tick(5);
    ok('Parts for sale: a failed bin read stops after ONE try (it looped)', reads === 1, reads);
  }

  // ═══ A11 · a part that did not attach is said ═════════════════════════
  section('A11 · failures are said, not reported as success');
  {
    const run = async (src) => {
      const c = sandbox();
      c.document = { getElementById: id => ({ 'maint-chore-pick': { value: 'E-unit service' } })[id] || null,
                     querySelectorAll: () => [{ value: 'part-1' }, { value: 'part-2' }] };
      c._maintPartSetTask = async (id) => id === 'part-1';   // the second one is refused
      load(c, RRSHEETTEXT + '\n' + grab(src, 'window._maintAddChore = async function (andPart)') + '\n' + grab(src, 'async function _maintAddChoreRun(andPart)'));
      await c._maintAddChore();
      return c.toasts.join(' | ');
    };
    const t = await run(MAINT);
    ok('two parts ticked, one refused → the toast says 1 of the 2 did not go on it', /1 of the 2 ticked parts did not go on it/.test(t) && !/2 parts on it/.test(t), t);
  }
  {
    const run = async (src) => {
      const c = sandbox(); c.failAppend = /Maintenance Log/;
      load(c, RRSHEETTEXT + '\n' + grab(src, 'window._maintLogPartInstalled = async function (invId, itemNum, desc, partNum, by)'));
      return c._maintLogPartInstalled('190', '2338', 'drum', '259E-1', 'self');
    };
    ok('the Installed history line that fails answers false (the caller tells the user)', (await run(MAINT)) === false);
    ok('…and true when it lands', await (async () => { const c = sandbox(); load(c, RRSHEETTEXT + '\n' + grab(MAINT, 'window._maintLogPartInstalled = async function (invId, itemNum, desc, partNum, by)')); return (await c._maintLogPartInstalled('190', '2338', 'drum', '', 'self')) === true; })());
  }

  // ═══ A12 · the service manual checklist ═══════════════════════════════
  section('A12 · the service manual checklist: a failed read is not "owned none"');
  const smBox = (src, getImpl) => {
    const c = sandbox();
    c.rrFeatureTab = n => n; c.sheetsGet = getImpl;
    c._withTokenRetry = async fn => fn();
    c.fetch = async () => ({ json: async () => ({ sheets: [{ properties: { title: 'Service Manual' } }, { properties: { title: 'My Service Manual' } }] }) });
    const constSrc = (name) => { const i = CFG.indexOf('var ' + name + ' = '); const j = CFG.indexOf(';\n', CFG.indexOf(name === 'RR_SERVICE_MANUAL' ? '};' : ';', i)); return CFG.slice(i, j + 2); };
    load(c, constSrc('SERVICE_MANUAL_TAB') + '\n' + constSrc('RR_SERVICE_MANUAL') + '\nvar CATALOG_REFRESH_MAX_AGE_DAYS = 7;\n' + src);
    return c;
  };
  {
    const c = smBox(SM, async () => { throw new Error('Sheets API error 503: backend'); });
    const r = await c.rrSmLoadOwned(true);
    ok('a read that fails → null (unknown), the checklist NOT drawn as owned-none', r === null && c.rrSmOwnedCount() === 0 && vm.runInContext('_smOwned', c) === null);
    const t = smBox(SM, async () => { throw new Error('Sheets API error 400: Unable to parse range: Service Manual!A3:J'); });
    const r2 = await t.rrSmLoadOwned(true);
    ok('a sheet with no checklist tab yet → {} (nothing ticked yet — the honest empty)', r2 && Object.keys(r2).length === 0);
    const p = smBox(plant(SM, "    _smOwnedFailed = true;\n    return null;", "    _smOwnedFailed = true;\n    if (!_smOwned) _smOwned = {};\n    return _smOwned;"), async () => { throw new Error('503'); });
    const r3 = await p.rrSmLoadOwned(true);
    ok('PLANTED: the old catch ({} on any failure) is caught', r3 && Object.keys(r3).length === 0);
  }
  {
    // online, the fresh read before a tick fails → nothing is written
    const c = smBox(SM, async () => { throw new Error('503'); });
    c.appConfirm = async () => true;
    vm.runInContext("_smPages = [{ id: 'SM-0204', cat: 'Locomotives', sec: 'LOC 646', pg: 'PL' }]; _smOwned = {};", c);
    const r = await c.rrSmSetOwned('SM-0204', true);
    ok('ticking a page while the read fails → nothing appended, the user told', r === false && !c.log.some(l => /^append/.test(l)) && c.toasts.some(t => /Could not read your pages/.test(t)), c.log);
  }

  // ═══ A13 · a failed doc save does not upload twice ════════════════════
  section('A13 · a failed doc save does not upload the file again on the retry');
  {
    const run = async (src) => {
      const c = sandbox();
      const els = { 'docf-title': { value: 'Vulcan pages', focus() {} }, 'docf-covers': { value: '2338' }, 'docf-topics': { value: '' } };
      const btn = { disabled: false, textContent: 'Save' }; els['docf-save'] = btn;
      c.document = { getElementById: id => els[id] || null, body: { insertAdjacentHTML() {} } };
      c._panelItem = { itemNum: '2338' };
      ['_cardOpen', '_cardHead', '_cardFoot', '_btnCancel', '_btnSave'].forEach(n => { c[n] = () => ''; });
      c._esc = s => String(s == null ? '' : s); c._suggestCovers = () => '2338';
      c.rrDismissGuard = () => {};
      let uploads = 0;
      c.driveEnsureSetup = async () => {}; c.driveFindOrCreateFolder = async () => 'F'; c.driveCache = { photosId: 'P' };
      c.driveUploadPhoto = async () => { uploads++; return { id: 'file' + uploads }; };
      let tries = 0;
      c.sheetsAppend = async (sid, range, rows) => { tries++; c.log.push('append ' + JSON.stringify(rows)); if (tries === 1) throw new Error('offline'); return 3; };
      load(c, RRSHEETTEXT + '\n' + grab(src, 'function _docForm(type, fixedUrl, pendingFile, presetTopic, opts)'));
      c._docForm('document', null, { name: 'vulcan.pdf' }, '', {});
      await btn.onclick.call(btn);   // fails at the sheet
      await btn.onclick.call(btn);   // the retry
      return { uploads, last: c.log.filter(l => /^append/.test(l)).pop() || '' };
    };
    const r = await run(MAINT);
    ok('save fails at the sheet, Save again → the file went to Drive ONCE, and the retry uses that link', r.uploads === 1 && /file\/d\/file1\/view/.test(r.last), r);
    const p = await run(plant(MAINT, 'if (pendingFile && _uploadedUrl) url = _uploadedUrl;\n        else if (pendingFile) {', 'if (pendingFile) {'));
    ok('PLANTED: the old save → uploaded twice (an orphan copy in Drive)', p.uploads === 2, p);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RELEASE 2 (folded into v0.9.2038 — Brad: "lets build the next release
  //  before you ship it. want to minimize updates"): group B, wrong diagram /
  //  manual / item, and group C, buttons, Back and screens.
  // ════════════════════════════════════════════════════════════════════════
  const TZCFG = read('trainz-diagrams-config.js');
  const tzRun = (src) => {
    const c = sandbox();
    load(c, TZCFG + '\nvar _tzLookup = null;\n' + grab(src, 'function _tzFamily(e)') + '\n' + grab(src, 'function _tzItemFamily(eraKey)') + '\n' + grab(src, 'function _tzDiagram(item, eraKey)'));
    return (num, era) => { const e = c._tzDiagram({ itemNum: num }, era); return e ? e.t : null; };
  };
  section('B14 · a Trainz diagram is matched by maker + era + number');
  {
    const tz = tzRun(MAINT);
    ok('Gilbert American Flyer 350 / 356 / 342 → no Lionel diagram', tz('350', 'af_gilbert') === null && tz('356', 'af_gilbert') === null && tz('342', 'af_gilbert') === null);
    ok('Marx 1666 / 400 → no Lionel diagram', tz('1666', 'marx') === null && tz('400', 'marx') === null);
    ok('prewar 617 → the PREWAR 617/618/619 cars, not the postwar NW-2', /Prewar 617/.test(tz('617', 'prewar') || '') && /NW-2/.test(tz('617', 'pw') || ''), [tz('617', 'prewar'), tz('617', 'pw')]);
    ok('prewar 211 → not the postwar Alco', !/Alco/i.test(tz('211', 'prewar') || ''), tz('211', 'prewar'));
    ok('postwar 44 → the Launcher, not the "44 Ton" Switcher', /Launcher/.test(tz('44', 'pw') || ''), tz('44', 'pw'));
    ok('postwar 6822 → never the MPC 6-6822', !/MPC/.test(tz('6822', 'pw') || ''), tz('6822', 'pw'));
    ok('…while the postwar GP-7 2338, a modern 6-18860 and Lionel\'s American Flyer 6-48114 still find theirs', /2338/.test(tz('2338', 'pw') || '') && !!tz('6-48114', 'mod_s') && /American Flyer/.test(tz('6-48114', 'mod_s')));
    const old = plant(plant(MAINT, "    if (!fam) return null;\n    if (!_tzLookup) {", "    if (!fam) fam = 'postwar';\n    if (!_tzLookup) {"),
      'var map = _tzLookup[fam];', 'var map = Object.assign({}, _tzLookup.af, _tzLookup.modern, _tzLookup.prewar, _tzLookup.postwar);');
    const p = tzRun(old);
    ok('PLANTED: number-only (the old matcher) → Gilbert 350 gets a Lionel diagram', p('350', 'af_gilbert') !== null, p('350', 'af_gilbert'));
  }
  section('B15 · a postwar sub-number finds its base diagram');
  {
    const tz = tzRun(MAINT);
    ok('3562-25, 6436-110, 3376-160 → their base\'s diagram', /3562/.test(tz('3562-25', 'pw') || '') && /6436/.test(tz('6436-110', 'pw') || '') && /3376/.test(tz('3376-160', 'pw') || ''), [tz('3562-25', 'pw'), tz('6436-110', 'pw'), tz('3376-160', 'pw')]);
    const p = tzRun(plant(MAINT, "      tries.push(raw.replace(/-\\d+$/, '').replace(/[^A-Z0-9]/g, ''));   // 3562-25 -> 3562", ''));
    ok('PLANTED: without the base step → 3562-25 finds nothing', p('3562-25', 'pw') === null);
  }
  const pwsmRun = (src) => {
    const c = sandbox();
    c._itemEraKey = (it) => it._era;
    c._lionelBoxNum = n => n;
    load(c, grab(src, 'var PWSM_FILES = {') + '\n' + line(src, 'var PWSM_BASE = ') + '\n' + line(src, 'var PWSM_HOME = ') + '\n' + grab(src, 'var PWSM_TOK = {') + '\nvar _pwsmLookup = null;\n'
      + grab(src, 'function _pwsmFile(num)') + '\n' + grab(src, 'function _docsUrl(route, item)'));
    return c;
  };
  section('B16 · a prewar item never gets a POSTWAR LCCA section');
  {
    const c = pwsmRun(MAINT);
    const pre = c._docsUrl('lcca', { itemNum: '211', _era: 'prewar' }), post = c._docsUrl('lcca', { itemNum: '211', _era: 'pw' });
    ok('prewar 211 → the archive home (no section); postwar 211 → its own section PDF', !/\.pdf/.test(pre) && /loc_211\.pdf/.test(post), [pre, post]);
    ok('the panel and the Covers suggestion ask the era too (postwar only)', /\(route === 'lcca' && String\(eraKey \|\| ''\)\.toLowerCase\(\) === 'pw'\) \? _pwsmFile/.test(MAINT) && /\(String\(_sEra \|\| ''\)\.toLowerCase\(\) === 'pw'\) \? _pwsmFile/.test(MAINT));
    const p = pwsmRun(plant(MAINT, "var pf = (String(_uEra || '').toLowerCase() === 'pw') ? _pwsmFile(num) : null;", 'var pf = _pwsmFile(num);'));
    ok('PLANTED: the old link → prewar 211 opens the postwar section', /\.pdf/.test(p._docsUrl('lcca', { itemNum: '211', _era: 'prewar' })));
  }
  section('B17 · LCCA finds powered units however they are spelled');
  {
    const c = pwsmRun(MAINT);
    const f = n => c._pwsmFile(n);
    ok('"2343-P" (the app\'s spelling) and a bare 2343 → the 2343P section', f('2343-P') === 'loc_2343p' && f('2343') === 'loc_2343p', [f('2343-P'), f('2343')]);
    ok('2353 / 2356 rows → 2353P\'s section', f('2353') === 'loc_2353p' && f('2356') === 'loc_2353p');
    ok('the Alcos: catalog 204P / 208P / 2031P → LCCA\'s 204A / 208A / 2031A sections', f('204P') === 'loc_200p' && f('208P') === 'loc_200p' && f('2031P') === 'loc_2023p' && f('2033P') === 'loc_2023p');
    ok('…and nothing that worked before changed: 2343C, 2046W, 6142-75', f('2343C') === 'loc_2343c' && !!f('2046W'));
    const p = pwsmRun(plant(MAINT, ".replace(/^X/, '').replace(/-([A-Z]+)$/, '$1');", ".replace(/^X/, '');"));
    ok('PLANTED: the old spelling rule → "2343-P" finds nothing', p._pwsmFile('2343-P') === null);
  }
  section('B18 · the panel never falls back to another item');
  {
    const run = (src) => {
      const c = sandbox({ state: { masterData: [], personalData: { k1: { inventoryId: '278', itemNum: '2356-P', variation: '' }, k2: { inventoryId: '9', itemNum: '6464-1' } } } });
      c.findMaster = () => null; c._itemEraKey = () => 'pw';
      c._lastDetailPdKey = 'k2';
      load(c, grab(src, 'function _maintResolveItem(idx, itemNum, variation, invId)'));
      return c._maintResolveItem(-1, '2356-P', '', '278');
    };
    const r = run(MAINT);
    ok('catalog not loaded → the OWNED copy (inventory 278), not the last item viewed', r && r.inventoryId === '278', r);
    const p = run(plant(MAINT, '    if (!item && owned) item = owned;\n', ''));
    ok('PLANTED: without it → nothing (and the old line handed back the last item viewed)', !p || p.inventoryId !== '278');
    ok('the last-viewed copy is used only when it IS this item', /_last && String\(_last\.itemNum \|\| ''\)\.trim\(\) === want/.test(MAINT));
  }
  section('B19 · a row with no inventory ID asks which copy');
  {
    const run = (src, pdata) => {
      const c = sandbox({ state: { personalData: pdata } });
      let opened = null, chooser = null;
      c._maintOpenPanel = (idx, num, v, inv) => { opened = { num, inv }; };
      c._maintShowGrp = () => {};
      c._partsChooser = (t, sub, opts) => { chooser = opts; };
      c.findMaster = () => null; c._itemEraKey = (p) => p._e; c.ERAS = { pw: { label: 'Lionel Postwar' }, marx: { label: 'Marx' } };
      c._esc = s => String(s == null ? '' : s);
      load(c, grab(src, 'window._wbOpen = function (invId, itemNum, focusTaskId)'));
      c._wbOpen('', '54', '');
      return { opened, chooser };
    };
    const two = { a: { inventoryId: '11', itemNum: '54', owned: true, _e: 'pw' }, b: { inventoryId: '12', itemNum: '54', owned: true, _e: 'marx' } };
    const r = run(MAINT, two);
    ok('two copies of No. 54 (Lionel, Marx) → "Which 54?" with both, no card opened by number', r.opened === null && r.chooser && r.chooser.length === 2 && /Marx/.test(r.chooser[1].label), r);
    const one = run(MAINT, { a: two.a });
    ok('one copy → its card, by its inventory ID', one.opened && one.opened.inv === '11', one);
    const p = run(plant(MAINT, 'if (!invId && !pd && itemNum && state.personalData) {', 'if (false) {'), two);
    ok('PLANTED: the old open → the card opened by number alone', p.opened && p.opened.inv === '', p);
  }
  section('C20 · the Add-task pop-up offers loose parts to tick');
  {
    const run = (src) => {
      const c = sandbox({ state: { partsData: { a: { id: 'part-a', forInv: '190', taskId: '', status: 'bought' }, b: { id: 'part-b', forInv: '190', taskId: 'log-done', status: 'wanted' }, d: { id: 'part-d', forInv: '190', taskId: 'log-open', status: 'wanted' } },
        maintLog: [{ id: 'log-done', type: 'chore', status: 'done', text: 'old job' }, { id: 'log-open', type: 'chore', status: 'open', text: 'Fix railing' }] } });
      load(c, grab(src, 'function _taskOpen(taskId)') + '\n' + grab(src, 'function _maintPickerParts(tg, taskId)'));
      return c._maintPickerParts({ item: { itemNum: '2338' }, invId: '190' }, '');
    };
    const pk = run(MAINT);
    const ids = pk.onHand.concat(pk.wanted).map(e => e.part.id + (e.onTask ? '@' + e.onTask : ''));
    ok('a new task is offered the loose drum, the part on a FINISHED job (loose again), and the part on an open job (greyed, named)', ids.indexOf('part-a') >= 0 && ids.indexOf('part-b') >= 0 && ids.indexOf('part-d@Fix railing') >= 0, ids);
    const p = run(plant(MAINT, "(taskId && (p.taskId || '') === String(taskId))", "(p.taskId || '') === String(taskId || '')"));
    ok('PLANTED: the old skip → the loose drum is never offered', !p.onHand.concat(p.wanted).some(e => e.part.id === 'part-a'));
  }
  section('C21 · the device Back button closes the Maintenance panel and Need a part');
  {
    const pins = (src) => /rrDismissGuard\(document\.getElementById\('maint-overlay'\), window\._maintClosePanel\)/.test(src) && /rrDismissGuard\(document\.getElementById\('maint-parts-pop'\)/.test(src);
    ok('both are wired through rrDismissGuard (the panel through its own close)', pins(MAINT));
    ok('PLANTED: the panel\'s line taken out is caught', !pins(MAINT.replace("window.rrDismissGuard(document.getElementById('maint-overlay'), window._maintClosePanel)", 'void 0')));
  }
  section('C22 · "Parts diagrams" pressed again keeps the pop-up on the Back list');
  {
    const run = (src) => {
      const c = sandbox();
      let made = 0, listed = 0;
      const els = { 'maint-parts-pop': {} };
      c.document = { getElementById: id => els[id] || null, createElement: () => { made++; const el = { style: {}, set id(v) { els[v] = el; } }; return el; }, body: { appendChild() {} } };
      c._maintDiagramsList = () => { listed++; };
      c._maintDiagramsClose = () => {};
      c._dgSideBySide = () => false; c._cardOpen = () => ''; c._cardHead = () => ''; c._esc = s => String(s); c._dgListHtml = () => '';
      c._dgDraggable = () => {}; c._dgShiftPop = () => {}; c.rrDismissGuard = () => {};
      c.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; }; c._dgObs = null;
      load(c, line(src, "var DG_ID = ") + '\n' + grab(src, 'window._maintDiagramsOpen = function ()'));
      els['maint-diagrams-pop'] = { open: true };     // it is already open
      c._maintDiagramsOpen();
      return { made, listed };
    };
    const r = run(MAINT);
    ok('pressed while open → back to its list; nothing closed and rebuilt', r.made === 0 && r.listed === 1, r);
    const p = run(plant(MAINT, "    if (document.getElementById(DG_ID)) { window._maintDiagramsList(); return; }\n", ''));
    ok('PLANTED: the old press → closed and rebuilt', p.made === 1, p);
    ok('…and back-stack.js pops only its own entry (tests/back_stack_reopen_2038_tests.js proves it in Chromium)', /if \(!byBack && mine && _stack\.indexOf\(mine\) >= 0\) pop\(id\);/.test(read('back-stack.js')));
  }
  section('C23 · the diagrams pop-up comes back on screen when the window changes size');
  {
    const run = (src) => {
      const c = sandbox();
      const handlers = {}, winH = {};
      const el = { style: { transform: '' } };
      c.innerWidth = 1600; c.innerHeight = 900; c.IS_MOBILE_UA = false;
      c.addEventListener = (t, f) => { winH[t] = f; }; c.removeEventListener = () => {};
      c.document = { body: { contains: () => true } };
      const handle = { addEventListener: (t, f) => { handlers[t] = f; }, setPointerCapture() {} };
      load(c, 'var DG_SIDE_MIN_W = 900;\n' + grab(src, 'function _dgSideBySide()') + '\n' + grab(src, 'function _dgDraggable(el, handle)'));
      c._dgDraggable(el, handle);
      handlers.pointerdown({ button: 0, clientX: 0, clientY: 0, target: {}, pointerId: 1, preventDefault() {} });
      handlers.pointermove({ clientX: 640, clientY: 700 });          // dragged far right and down
      c.innerWidth = 1000; c.innerHeight = 600;                     // the window gets smaller
      if (winH.resize) winH.resize();
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform) || [];
      return { dx: +m[1], dy: +m[2] };
    };
    const r = run(MAINT);
    ok('after a smaller window, the pop-up is pulled back inside it (≤ 40% across, ≤ 80% down)', r.dx <= 400 && r.dy <= 480, r);
    const p = run(plant(MAINT, "    window.addEventListener('resize', onResize);\n", ''));
    ok('PLANTED: no resize step → it stays where it was, off the new edge', p.dx > 400 || p.dy > 480, p);
  }
  section('C24 · the item page\'s buttons survive an apostrophe');
  {
    const COLL = read('app-collection.js');
    const bad = (src) => (src.match(/onclick="[^"]*replace\(\/'\/g,"&apos;"\)/g) || []).length;
    ok('no onclick on the item page escapes by hand (&apos; decodes back to a quote and breaks the call)', bad(COLL) === 0, bad(COLL));
    ok('the Maintenance and Break Up Group buttons pass the variation through rrJsArg', /_maintOpenPanel\(\$\{idx\},'\$\{rrJsArg\(it\.itemNum\)\}','\$\{rrJsArg\(it\.variation\|\|''\)\}'/.test(COLL) && /_breakUpGroupFromDetail\(\$\{idx\},'\$\{rrJsArg\(it\.itemNum\)\}','\$\{rrJsArg\(it\.variation\|\|''\)\}'/.test(COLL));
    ok('PLANTED: the old hand escape is caught', bad(COLL.replace("'${rrJsArg(it.variation||'')}','${rrJsArg(pd && pd.inventoryId ? pd.inventoryId : '')}')\" data-ctip=\"Owner", "'${(it.variation||'').replace(/'/g,\"&apos;\")}','${rrJsArg(pd && pd.inventoryId ? pd.inventoryId : '')}')\" data-ctip=\"Owner")) === 1);
  }
  section('C25 · a Toolbox topic with an apostrophe filters to itself');
  {
    const APPJS = read('app.js');
    const run = (src) => {
      const c = sandbox({ state: { myManuals: [{ id: 'doc-1', title: 'x', type: 'link', url: 'u', covers: '', topics: "Bob's tips", notes: '', date: '' }] } });
      const box = { innerHTML: '' };
      c.document = { getElementById: id => id === 'tb-list' ? box : null };
      c._tbState = { q: '', topic: '', type: '', item: '' };
      c._btn = () => '';
      load(c, grab(APPJS, 'function rrEsc(v)') + '\n' + grab(APPJS, 'function rrJsArg(v)') + '\nvar _esc = rrEsc;\nvar _tbState = { q: "", topic: "", type: "", item: "" };\n'
        + grab(src, 'function _tbNorm(v)') + '\n' + grab(src, 'function _tbSplit(v)') + '\n' + grab(src, 'function _tbMatches(d)') + '\n' + grab(src, 'function _tbList()'));
      c._tbList();
      const m = /<span onclick="(_tbTopic\([^"]*\))"/.exec(box.innerHTML);
      if (!m) return null;
      const js = m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      let got = null; try { new Function('_tbTopic', js)(t => { got = t; }); } catch (e) { got = 'THREW ' + e.message; }
      return got;
    };
    ok('the chip calls _tbTopic with "Bob\'s tips" exactly', run(MAINT) === "Bob's tips", run(MAINT));
    const p = run(plant(MAINT, "'<span onclick=\"_tbTopic(\\'' + rrJsArg(t) + '\\')\" title", "'<span onclick=\"_tbTopic(\\'' + rrJsArg(t.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\")) + '\\')\" title"));
    ok('PLANTED: the old double escape → the wrong topic (it filtered to nothing)', p !== "Bob's tips", p);
  }
  section('C26 · an installed part is not counted as needed');
  {
    const parts = { a: { id: 'a', status: 'wanted' }, b: { id: 'b', status: 'installed' }, c: { id: 'c', status: 'bought' } };
    const run = (src) => {
      const c = sandbox({ state: { partsData: parts } });
      const badge = { textContent: '' };
      c.document = { getElementById: id => id === 'nav-parts' ? badge : null };
      load(c, grab(src, 'function _partsIsOpen(p)') + '\n' + grab(src, 'function _partsOpenList()') + '\n' + grab(src, 'function _updatePartsBadge()'));
      c._updatePartsBadge();
      return badge.textContent;
    };
    ok('the nav badge counts 2 (wanted + bought), not 3', String(run(PAGES)) === '2', run(PAGES));
    ok('PLANTED: the old badge counts the installed one', String(run(plant(PAGES, 'var n = _partsOpenList().length;', 'var n = Object.keys(state.partsData || {}).length;'))) === '3');
    const DASH = read('dashboard.js');
    ok('the dashboard\'s Parts Wanted card and the Want/Upgrade report read the same open list', /var rows = \(typeof _partsOpenList === 'function'\) \? _partsOpenList\(\)/.test(DASH) && /const pp=\(typeof _partsOpenList==='function'\) \? _partsOpenList\(\)/.test(REPORTS));
    ok('the Parts page hides installed history for everyone unless the owner asks for it (recording mode too)', /if \(!\(_lc && window\._partsShowInstalled\)\) parts = parts\.filter\(_partsIsOpen\);/.test(PAGES));
  }
  section('C27 · the Workbench page asks the gate every time');
  {
    const run = (src, owner) => {
      const c = sandbox();
      let pages = [], loaded = 0, built = 0;
      c.rrRegisterPage = (n, f) => { pages.push(f); };
      c._isOwner = () => owner;
      c._loadLog = async () => { loaded++; return true; };
      c._wbBuild = () => { built++; }; c._wbBadge = () => {};
      c._loadMyDocs = async () => true;
      c.showPage = (n) => { c.log.push('showPage ' + n); };
      load(c, grab(src, "window.rrRegisterPage('workbench', function ()") + ');');
      pages[0]();
      return new Promise(r => setTimeout(() => r({ loaded, built, log: c.log }), 5));
    };
    const r = await run(MAINT, false);
    ok('switched off / recording mode → no Workbench data read, sent to the Dashboard', r.loaded === 0 && r.log.indexOf('showPage dashboard') >= 0, r);
    const on = await run(MAINT, true);
    ok('…and on, it builds as before', on.loaded === 1 && on.log.indexOf('showPage dashboard') < 0, on);
    const p = await run(plant(MAINT, "    if (!_isOwner()) { _wbBuild(); setTimeout(function () { if (typeof showPage === 'function') showPage('dashboard', null); }, 0); return; }\n", ''), false);
    ok('PLANTED: the old page → it reads and draws the bench past the gate', p.loaded === 1, p);
    ok('_wbBuild itself draws nothing but "switched off" past the gate', /if \(!_isOwner\(\)\) \{   \/\/ v0\.9\.2038 \(C27\)/.test(grab(MAINT, 'function _wbBuild()')));
  }
  section('C28 · a document saved with no name is named after its file');
  {
    const run = async (src) => {
      const c = sandbox();
      const els = { 'docf-title': { value: '', focus() {} }, 'docf-covers': { value: '2338' }, 'docf-topics': { value: '' } };
      const btn = { disabled: false, textContent: 'Save' }; els['docf-save'] = btn;
      c.document = { getElementById: id => els[id] || null, body: { insertAdjacentHTML() {} } };
      c._panelItem = { itemNum: '2338' };
      ['_cardOpen', '_cardHead', '_cardFoot', '_btnCancel', '_btnSave'].forEach(n => { c[n] = () => ''; });
      c._esc = s => String(s == null ? '' : s); c._suggestCovers = () => '2338'; c.rrDismissGuard = () => {};
      c.driveEnsureSetup = async () => {}; c.driveFindOrCreateFolder = async () => 'F'; c.driveCache = { photosId: 'P' };
      c.driveUploadPhoto = async () => ({ id: 'f1' });
      load(c, RRSHEETTEXT + '\n' + grab(src, 'function _docForm(type, fixedUrl, pendingFile, presetTopic, opts)'));
      c._docForm('document', null, { name: 'Vulcan 2338 service.pdf' }, '', {});
      await btn.onclick.call(btn);
      const a = c.log.filter(l => /^append/.test(l))[0] || '';
      return (JSON.parse(a.slice(a.indexOf('[['))) || [[]])[0][1];
    };
    ok('no name typed → the title is the file\'s name, "Vulcan 2338 service"', (await run(MAINT)) === "'Vulcan 2338 service", await run(MAINT));
    const p = await run(plant(MAINT, "type === 'document' ? (_fileName || 'Saved document') : url", 'url'));
    ok('PLANTED: the old fallback → an empty title', p === '' || p === "''", p);
  }

  // ═══ N · the nightly's red ═════════════════════════════════════════════
  section('N · the Office\'s new-variation message says "open", not "free"');
  ok('"(the next open variation given)" — no "free" in what a person reads', /next open variation given/.test(YM) && !/next free variation given/.test(YM));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite threw: ' + (e && e.stack || e)); process.exit(1); });
