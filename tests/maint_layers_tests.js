// ═══════════════════════════════════════════════════════════════
// maint_layers_tests.js — v0.9.1855.
//
// [stated] Brad, 2026-10-01, Workbench → Maintenance → a task card → "Need a
// part": "it brought up the need a part page but it was behind the service
// page." The task card was drawn at z-index 100020; the Need-a-part popup at
// 9650 — under it — and the duplicate-part chooser the popup can open at
// 10090, also under it.
//
// THE RULE THIS SUITE PROTECTS — the Workbench's stacking order, lowest first:
//   wb-card (the Maintenance card)      9600
//   maint-task-ov (a task's card)       100020
//   maint-addtask-pop (Add a task)      > the task card   (v0.9.1858)
//   maint-parts-pop (Need a part)       > the Add-task pop-up ("+ Add a part for it" opens it on top)
//   _parts-chooser (which job? / dup)   > the popup
//   appConfirm / appPrompt              > everything above (wizard-utils.js)
// Each layer is read off the REAL source; each rule is proven able to fail.
// Run:  node tests/maint_layers_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const maint = APP('maintenance.js'), pages = APP('app-pages.js'), utils = APP('wizard-utils.js');

// the z-index an overlay is created with: the FIRST z-index after its id
function zOf(src, idMarker) {
  const i = src.indexOf(idMarker);
  if (i < 0) return null;
  const m = src.slice(i, i + 600).match(/z-index:\s*(\d+)/);
  return m ? +m[1] : null;
}
function layers(m, p, u) {
  return {
    card: zOf(m, "id=\"wb-card\""),
    task: zOf(m, "ov.id = 'maint-task-ov'"),
    addtask: zOf(m, 'id="maint-addtask-pop"'),
    pop: zOf(m, 'id="maint-parts-pop"'),
    chooser: zOf(p, "ov.id = '_parts-chooser'"),
    confirm: zOf(u, "function appConfirm"),
    prompt: zOf(u, "function appPrompt"),
  };
}
function judge(L) {
  const bad = [];
  if (!(L.card != null && L.task != null && L.addtask != null && L.pop != null && L.chooser != null && L.confirm != null && L.prompt != null)) bad.push('a layer could not be read: ' + JSON.stringify(L));
  else {
    if (!(L.task > L.card)) bad.push('task card not above the Maintenance card');
    if (!(L.addtask > L.task)) bad.push('Add-task popup not above the task card (' + L.addtask + ' vs ' + L.task + ')');
    if (!(L.pop > L.addtask)) bad.push('Need-a-part popup not above the Add-task popup (' + L.pop + ' vs ' + L.addtask + ')');
    if (!(L.pop > L.task)) bad.push('Need-a-part popup not above the task card (' + L.pop + ' vs ' + L.task + ')');
    if (!(L.chooser > L.pop)) bad.push('the chooser not above the popup (' + L.chooser + ' vs ' + L.pop + ')');
    if (!(L.confirm > L.chooser && L.prompt > L.chooser)) bad.push('appConfirm/appPrompt not above the chooser');
  }
  return bad;
}

section('A · the real stacking order');
const L = layers(maint, pages, utils);
ok('every layer read off the source', Object.values(L).every(v => v != null), JSON.stringify(L));
const bad = judge(L);
ok('Maintenance card < task card < Add-task popup < Need-a-part popup < chooser < appConfirm/appPrompt', bad.length === 0, bad.join('; '));
ok('the task card still opens the popup with the task\'s id (the "Need a part" button)', /_maintPartsPopup\(\\'' \+ rrJsArg\(t\.id\)/.test(maint));

section('B · planted offenders are caught');
ok('B1 the v1854 popup (9650, under the task card) is caught',
   judge(layers(maint.replace('id="maint-parts-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100030', 'id="maint-parts-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9650'), pages, utils)).length > 0);
ok('B2 the v1854 chooser (10090) is caught',
   (() => { const o = pages.replace(/(ov\.id = '_parts-chooser';[\s\S]{0,400}?z-index:)100035/, '$110090'); return o !== pages && judge(layers(maint, o, utils)).length > 0; })());
ok('B3 a task card raised above the popup is caught',
   judge(layers(maint.replace("ov.id = 'maint-task-ov';\n          ov.style.cssText = 'position:fixed;inset:0;z-index:100020", "ov.id = 'maint-task-ov';\n          ov.style.cssText = 'position:fixed;inset:0;z-index:100040"), pages, utils)).length > 0);
ok('B5 an Add-task popup drawn above Need-a-part (the part pop-up it opens would hide) is caught',
   judge(layers(maint.replace('id="maint-addtask-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100025', 'id="maint-addtask-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100031'), pages, utils)).length > 0);
ok('B4 a layer that cannot be read is a failure, not a pass',
   judge(layers(maint.replace('id="maint-parts-pop"', 'id="maint-parts-popX"'), pages, utils)).length > 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
