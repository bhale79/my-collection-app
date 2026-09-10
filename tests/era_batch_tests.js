// ══ tests/era_batch_tests.js ═══════════════════════════════════════════════
//
// v0.9.1710 (Session 94). The holding pen that stops the catalog being
// reindexed once per maker.
//
// In all-makers mode the app fetches 43 catalogs four at a time. Every maker
// that landed used to swap its rows into state.masterData, reindex the WHOLE
// catalog, and repaint — on its own, immediately. Over Brad's 147,970-row
// catalog that step costs ~55-70ms of frozen screen, and it ran ~40 times per
// startup: the ~3s the deferred-render work (v0.9.1706) measured and left for
// later. Measured here, headless, on a synthetic 147,970-row catalog:
//
//     36 landings, one step each   36 steps   2,042ms
//     the same 36, batched by 3    12 steps     545ms
//     the same 36, batched by 4     9 steps     360ms
//
// What must NOT change is the v0.9.1236 invariant: the swap, the reindex and
// the repaint are ONE step. The rendered browse rows carry their masterData
// index in their onclick, and a landing maker moves every index at or after
// it — split those three and a click during the load opens a different item.
// Batching changes how OFTEN the step runs, never what it contains.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const src = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');

// ── the shape of it ───────────────────────────────────────────────────────
section('the pen exists, and one window is one step');
// Counted over CODE only — the name is also explained twice in the comments,
// which is the point of naming it.
const codeLines = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
ok('the batch window is a named constant, declared once and read once — no bare 500 in the pen',
   /var _ERA_APPLY_MS = 500;/.test(codeLines) && (codeLines.match(/_ERA_APPLY_MS/g) || []).length === 2,
   String((codeLines.match(/_ERA_APPLY_MS/g) || []).length) + ' code uses');
ok('a landed maker goes into the pen instead of being applied on the spot',
   /_eraPen\.set\(_era, deduped\);/.test(src), '');
ok('…and the timer is started by the FIRST maker of a window only (a trickle cannot starve a batch)',
   /if \(!_eraPenTimer\) _eraPenTimer = setTimeout\(_applyPendingEras, _ERA_APPLY_MS\);/.test(src), '');
const one = src.slice(src.indexOf('async function _refreshOneEra(_era)'), src.indexOf('async function _worker()'));
ok('_refreshOneEra no longer reindexes or repaints by itself — that is the whole fix',
   !/_rebuildMasterIndex/.test(one) && !/rrRepaintBrowse/.test(one) && !/renderBrowse/.test(one), '');
ok('…and still writes the per-maker cache and counts the maker as fetched',
   /idbSet\('lv_master_cache_' \+ _era, deduped\)/.test(one) && /state\.loading\.allEras\.loaded\+\+/.test(one), '');

section('the v0.9.1236 invariant — swap, reindex, repaint are one step');
const applyStart = src.indexOf('function _applyPendingEras() {');
const apply = src.slice(applyStart, src.indexOf('\n    }', src.indexOf('return drop.size;')) + 6);
ok('the batch function exists and is self-contained', applyStart > 0 && apply.length > 200 && /return drop\.size;/.test(apply), String(apply.length));
const iSwap = apply.indexOf('state.masterData = (state.masterData || [])');
const iIndex = apply.indexOf('_rebuildMasterIndex()');
const iPaint = apply.indexOf('rrRepaintBrowse()');
ok('swap → reindex → repaint, in that order, with nothing awaited between them',
   iSwap > 0 && iIndex > iSwap && iPaint > iIndex && !/await|setTimeout\(|requestAnimation/.test(apply.slice(iSwap, iPaint)), [iSwap, iIndex, iPaint].join(','));
ok('the reason is written down where the next reader will meet it', /v0\.9\.1236 \(identity audit\)/.test(apply), '');
ok('an empty pen does nothing at all (no reindex on a whim)', /if \(!_eraPen\.size\) return 0;/.test(apply), '');
ok('the pen is emptied BEFORE the work, so a landing during the batch is not lost',
   apply.indexOf('_eraPen = new Map();') < iSwap && /var pending = _eraPen; _eraPen = new Map\(\);/.test(apply), '');

section('nothing is left waiting on the timer when a round ends');
ok('the main round flushes the pen, and only reindexes bare if the pen was empty',
   /if \(!_applyPendingEras\(\)\) _rebuildMasterIndex\(\);\n      _phase6OK = true;/.test(src), '');
ok('the straggler-retry round does the same (the retries fill the same pen)',
   /if \(!_applyPendingEras\(\)\) _rebuildMasterIndex\(\);   \/\/ v0\.9\.1710/.test(src), '');
ok('the old per-landing reindex is gone from the whole all-eras block',
   (src.slice(src.indexOf('function refreshAllErasInBackground'), src.indexOf('for (var i = 0; i < realEras.length; i++)')).match(/_rebuildMasterIndex\(\)/g) || []).length === 3,
   String((src.slice(src.indexOf('function refreshAllErasInBackground'), src.indexOf('for (var i = 0; i < realEras.length; i++)')).match(/_rebuildMasterIndex\(\)/g) || []).length) + ' (want 3: inside the batch, and one fallback per round)');

// ── RUN the real function against a synthetic catalog ─────────────────────
section('behaviour — the real _applyPendingEras, driven with stubs');
const penBlock = src.slice(src.indexOf('var _ERA_APPLY_MS = 500;'), src.indexOf('\n    }', src.indexOf('return drop.size;')) + 6);
let harness = null, buildErr = '';
try {
  harness = new Function('state', 'window', '_rebuildMasterIndex', 'rrRepaintBrowse', 'renderBrowse', 'clearTimeout', 'setTimeout',
    '"use strict";' + penBlock +
    '\nreturn { apply: _applyPendingEras, put: function (e, rows) { _eraPen.set(e, rows); }, size: function () { return _eraPen.size; }, timer: function () { return _eraPenTimer; } };');
} catch (e) { buildErr = e.message; }
ok('the pen block runs on its own (no hidden dependency on the rest of app.js)', !!harness, buildErr);

if (harness) {
  const row = (era, n) => ({ itemNum: String(n), _era: era, roadName: era + '-' + n });
  const mk = () => {
    const st = { masterData: [] };
    ['a', 'b', 'c', 'd'].forEach(e => { for (let i = 0; i < 3; i++) st.masterData.push(row(e, i)); });
    const calls = { index: 0, repaint: 0 };
    const api = harness(st, {}, () => calls.index++, () => calls.repaint++, () => calls.repaint++, () => {}, () => 'T');
    return { st, calls, api };
  };

  // three makers land in one window
  let h = mk();
  h.api.put('b', [row('b', 90), row('b', 91)]);
  h.api.put('c', [row('c', 90)]);
  h.api.put('d', [row('d', 90), row('d', 91), row('d', 92)]);
  const applied = h.api.apply();
  ok('three pending makers are applied by ONE call', applied === 3, String(applied));
  ok('…costing exactly one reindex and one repaint (it was three of each)', h.calls.index === 1 && h.calls.repaint === 1, JSON.stringify(h.calls));
  ok('…their old rows are gone', !h.st.masterData.some(r => ['b', 'c', 'd'].includes(r._era) && r.itemNum !== '90' && r.itemNum !== '91' && r.itemNum !== '92'), '');
  ok('…their new rows are all there', h.st.masterData.filter(r => r._era === 'b').length === 2 && h.st.masterData.filter(r => r._era === 'c').length === 1 && h.st.masterData.filter(r => r._era === 'd').length === 3, '');
  ok('…the maker that did NOT land is untouched, and still first (its indexes did not move)',
     h.st.masterData.filter(r => r._era === 'a').length === 3 && h.st.masterData.slice(0, 3).every(r => r._era === 'a'), '');
  ok('…and the fresh rows sit at the END, which is what the reindex is for',
     h.st.masterData.slice(-6).every(r => ['b', 'c', 'd'].includes(r._era)), '');
  ok('the pen is empty afterwards', h.api.size() === 0, String(h.api.size()));

  // a second call with nothing pending must not touch anything
  const before = h.st.masterData.slice();
  const again = h.api.apply();
  ok('a second call with an empty pen returns 0 and reindexes nothing', again === 0 && h.calls.index === 1 && h.calls.repaint === 1, JSON.stringify({ again, calls: h.calls }));
  ok('…and leaves the catalog exactly as it was', h.st.masterData.length === before.length && h.st.masterData.every((r, i) => r === before[i]), '');

  // one maker alone still works (a lone straggler on a retry round)
  h = mk();
  h.api.put('a', [row('a', 90)]);
  ok('a single pending maker still applies, with one reindex', h.api.apply() === 1 && h.calls.index === 1 && h.st.masterData.filter(r => r._era === 'a').length === 1, JSON.stringify(h.calls));

  // 36 makers in one batch — the end-of-round flush, worst case
  h = mk();
  const many = [];
  for (let i = 0; i < 36; i++) { const e = 'm' + i; many.push(e); h.st.masterData.push(row(e, 1)); h.api.put(e, [row(e, 90), row(e, 91)]); }
  ok('36 makers can be applied in a single step (the end-of-round flush)',
     h.api.apply() === 36 && h.calls.index === 1 && h.st.masterData.filter(r => r.itemNum === '90').length === 36, JSON.stringify(h.calls));
  ok('…and every one of those makers has exactly its fresh rows',
     many.every(e => h.st.masterData.filter(r => r._era === e).length === 2), '');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
