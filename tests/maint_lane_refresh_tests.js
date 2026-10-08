// ═══════════════════════════════════════════════════════════════
// maint_lane_refresh_tests.js — v0.9.1899.
//
// Two things found in the v0.9.1898 live check, both fixed on Brad's "yes":
//   1. The order row ("Not in the bin? Order one") moved ABOVE the typing box
//      in v1898, but the bin notes still said "order one below". They say
//      "above" now, and "below" is gone from the file.
//   2. Need-a-part opened before the parts catalogs finished loading drew an
//      empty catalog-parts list that stayed empty until the user typed. When
//      the full catalog is ready (_buildAllErasLookupIndex, app-data.js) the
//      lane redraws itself through window._maintCatalogLaneRefresh — keeping
//      the task the popup was opened for, and doing nothing when no popup is
//      open.
// Every rule is proven able to fail on a planted offender.
// Run:  node tests/maint_lane_refresh_tests.js
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
const maint = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
const data = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');

function grabFrom(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('could not find ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + head);
}

section('1 · the bin notes point UP to the order row');
const binNotes = s => (s.match(/order one (above|below)/g) || []);
ok('both bin notes say "order one above"', binNotes(maint).length === 2 && binNotes(maint).every(x => x === 'order one above'), binNotes(maint).join(', '));
ok('…and the order row really is above the typing box', (() => { const pop = grabFrom(maint, 'window._maintPartsPopup = function'); return pop.indexOf('Not in the bin? Order one') > 0 && pop.indexOf('Not in the bin? Order one') < pop.indexOf('id="maint-pop-part"'); })());
ok('P1 a note put back to "below" is caught', !binNotes(maint.replace('Nothing matching in your bin — order one above.', 'Nothing matching in your bin — order one below.')).every(x => x === 'order one above'));

section('2 · the lane redraws when the catalog is ready');
const build = grabFrom(data, 'async function _buildAllErasLookupIndex(');
function readyBlock(src) { const b = grabFrom(src, 'async function _buildAllErasLookupIndex('); return b.slice(b.indexOf('var map = assemble();'), b.indexOf("console.log('[lookup-index] full catalog ready")); }
ok('the full-catalog-ready step calls _maintCatalogLaneRefresh (with the dashboard and the browse list)', /window\._maintCatalogLaneRefresh\(\)/.test(readyBlock(data)) && /buildDashboard\(\)/.test(readyBlock(data)));
const refresh = grabFrom(maint, 'window._maintCatalogLaneRefresh = function');
function run(src, el) {
  const calls = [];
  const fn = new Function('document', '_maintCatalogLaneRender', 'var window = {};\n' + src + '\nreturn window._maintCatalogLaneRefresh;');
  fn({ getElementById: id => (id === 'maint-pop-catalog' ? el : null) }, t => calls.push(t))();
  return calls;
}
const lane = { getAttribute: a => (a === 'data-task' ? 'task-7' : null) };
ok('an open Need-a-part: the lane is redrawn for the task it was opened for', JSON.stringify(run(refresh, lane)) === '["task-7"]');
ok('no task (from the bench): redrawn with none', JSON.stringify(run(refresh, { getAttribute: () => null })) === '[""]');
ok('no Need-a-part open: nothing happens, nothing breaks', run(refresh, null).length === 0);
ok('P2 the call dropped from the ready step is caught', !/window\._maintCatalogLaneRefresh\(\)/.test(readyBlock(data.replace("    try { if (typeof window._maintCatalogLaneRefresh === 'function') window._maintCatalogLaneRefresh(); } catch (eML) {}\n", ''))));
ok('P3 a refresh that forgets the task is caught', JSON.stringify(run(refresh.replace("el.getAttribute('data-task') || ''", "''"), lane)) !== '["task-7"]');
ok('the whole build function was read (sanity)', build.length > 2000);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
