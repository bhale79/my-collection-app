// ══ tests/page_stale_tests.js ══════════════════════════════════════════════
//
// v0.9.1706 (Session 94). A PAGE NOBODY IS LOOKING AT IS NOT REBUILT.
//
// MEASURED 2026-09-09, Brad's desktop, 43 makers on, 147,970 catalog rows,
// Dashboard on screen, one startup data load (the stopwatch harness is in
// SESSION_94_SUMMARY.md):
//
//   Master Catalog page   41 rebuilds in 24s, hidden for all 41
//                         36 via rrRepaintBrowse (one per maker as it landed)
//                         39 full rebuilds, avg 300ms, worst 473ms → 12.5s frozen
//   filter dropdowns       3 rebuilds, 261–461ms each, hidden
//   Dashboard              4 rebuilds, 77ms in all — visible, needs nothing
//
// v0.9.1703 stopped this behind the crop overlay. This stops it everywhere:
// a builder whose page is off screen marks the page STALE and returns;
// showPage() — the one function that reveals a page — rebuilds it once.
//
// THE RULES THESE PINS DEFEND:
//   1. Off screen → no work. Not less work: none.
//   2. Stale is never dropped. Whichever door reveals the page — sidebar,
//      phone bar, dashboard card, device back, deep link — it is rebuilt
//      BEFORE the user can see old data, and the FULL builder runs (a stale
//      Sets sub-tab must not survive because only the Items list was asked).
//   3. One reveal, one rebuild per builder — never one per held call.
//   4. The overlay rule (v1703) still works exactly as before, and the two
//      rules compose: hidden AND under an overlay is simply stale.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), br = rd('browse.js'), app = rd('app.js');

// ── 1. Source pins ───────────────────────────────────────────────────────
section('The mechanism, in one place');
ok('the registry lives in config.js beside the overlay hold — one mechanism, not two',
   /var RR_DEFERRABLE = \{/.test(cfg) && cfg.indexOf('var RR_DEFERRABLE') > cfg.indexOf('var _rrHeldRepaints = {};')
   && cfg.indexOf('var RR_DEFERRABLE') < cfg.indexOf('function rrFlushRepaints()'), '');
ok('it names the three hidden builders the stopwatch caught',
   /'filters':\s*\{ pages: \['page-browse', 'page-collection'\], build: 'populateFilters' \}/.test(cfg)
   && /'browse':\s*\{ pages: \['page-browse'\],\s*build: 'rrRepaintBrowse' \}/.test(cfg)
   && /'browse-repaint':\s*\{ pages: \['page-browse', 'page-collection'\], build: 'rrRepaintBrowse' \}/.test(cfg), '');
ok("'filters' is listed FIRST, so dropdowns are refilled before the repaint whose chips read them",
   cfg.indexOf("'filters':") < cfg.indexOf("'browse':") && cfg.indexOf("'browse':") < cfg.indexOf("'browse-repaint':"), '');
ok('the page rule is checked BEFORE the overlay rule (hidden + overlay = stale, not held-by-name)',
   /function rrHoldRepaint\(name, fn\) \{\s*\n\s*try \{\s*\n\s*var d = RR_DEFERRABLE\[name\];\s*\n\s*if \(d && !rrPageOnScreen\(d\.pages\)\) \{ _rrStale\[name\] = true; return true; \}\s*\n\s*if \(!rrOverlayUp\(\)\) return false;/.test(cfg), '');
ok('rrPageShown clears the stale marks FIRST, then runs each distinct builder once, isolated',
   /delete _rrStale\[names\[i\]\];\s*\n\s*if \(todo\.indexOf\(d\.build\) < 0\) todo\.push\(d\.build\);/.test(cfg)
   && /try \{ var f = window\[todo\[j\]\]; if \(typeof f === 'function'\) f\(\); \}\s*\n\s*catch \(e\)/.test(cfg), '');
ok('with no DOM at all, nothing is ever held on a guess',
   /if \(typeof document === 'undefined' \|\| !document\.querySelector\) return true;/.test(cfg)
   && /if \(!active\) return true;/.test(cfg), '');
ok('the measurement is written where the next reader will find it',
   /41 TIMES in 24 seconds/.test(cfg) && /12\.5 SECONDS/.test(cfg) && /77ms/.test(cfg), '');
ok('the new pieces are exported alongside the old ones',
   /window\.rrPageOnScreen  = rrPageOnScreen;/.test(cfg) && /window\.rrPageShown     = rrPageShown;/.test(cfg), '');

section('The builders that stand down');
ok('rrRepaintBrowse asks first — before it even looks at which page is active',
   /function rrRepaintBrowse\(\) \{[\s\S]{0,900}?rrHoldRepaint\('browse-repaint', rrRepaintBrowse\)\) return;\s*\n\s*var active = '';/.test(br), '');
ok('populateFilters asks first',
   /function populateFilters\(\) \{[\s\S]{0,700}?rrHoldRepaint\('filters', populateFilters\)\) return;/.test(br), '');
ok('renderBrowse still asks, under the same name as v1703, BEFORE its signature cache',
   /function renderBrowse\(\) \{[\s\S]{0,900}?rrHoldRepaint\('browse', renderBrowse\)\) return;/.test(br)
   && br.indexOf("rrHoldRepaint('browse'") < br.indexOf('_rrBrowseSig'), '');
ok('buildDashboard is NOT in the registry — 77ms for four visible builds needs no net',
   !/'dashboard':\s*\{/.test(cfg), '');

section('The one door');
ok('showPage calls rrPageShown right after the page becomes active…',
   /document\.getElementById\('page-' \+ name\)\.classList\.add\('active'\);[\s\S]{0,700}?rrPageShown\('page-' \+ name\)/.test(app), '');
ok('…and BEFORE any of its own builder calls, so no path can show old data first',
   app.indexOf("rrPageShown('page-' + name)") < app.indexOf("if (name === 'browse') renderBrowse();"), '');
ok('showPage is the ONLY place a .page is activated (the audit that makes rule 2 provable)',
   (app.match(/\.classList\.add\('active'\)/g) || []).filter(function () { return true; }).length >= 1
   && (app.match(/page-' \+ name\)\.classList\.add\('active'\)/g) || []).length === 1
   && !/getElementById\('page-[a-z-]+'\)\.classList\.add\('active'\)/.test(app + br + rd('app-pages.js') + rd('app-collection.js') + rd('photo-inbox.js') + rd('wizard.js') + rd('back-stack.js') + rd('detail-nav.js')), '');
ok('the device back button goes through showPage', /function _rrGoBackTo\(name\) \{[\s\S]{0,300}?showPage\(name, mnav \|\| null\);/.test(app), '');
ok('the boot splash watchdog does not complain about a page nobody can see',
   /if \(typeof rrPageOnScreen === 'function' && !rrPageOnScreen\(\['page-browse'\]\)\) return;/.test(app), '');

// ── 2. Behaviour, executed with a stub document ──────────────────────────
section('Behaviour, executed');
function rig(activePageId) {
  const src = cfg.slice(cfg.indexOf('var _rrHeldRepaints = {};'), cfg.indexOf('window.rrFlushRepaints = rrFlushRepaints;') + 'window.rrFlushRepaints = rrFlushRepaints;'.length) + '}catch(e){}';
  const st = { active: activePageId, calls: [] };
  const window = { _rrCropOpen: false };
  const document = { querySelector: function (sel) { return sel === '.page.active' && st.active ? { id: st.active } : null; } };
  const console_ = { warn: function () {} };
  new Function('window', 'document', 'console', src)(window, document, console_);
  // the builders, as the app would define them — each asks the hold first
  window.populateFilters = function () { if (window.rrHoldRepaint('filters', window.populateFilters)) return 'held'; st.calls.push('filters'); };
  window.renderBrowse = function () { if (window.rrHoldRepaint('browse', window.renderBrowse)) return 'held'; st.calls.push('render'); };
  window.rrRepaintBrowse = function () { if (window.rrHoldRepaint('browse-repaint', window.rrRepaintBrowse)) return 'held'; st.calls.push('repaint'); };
  window.buildDashboard = function () { st.calls.push('dash'); };   // not deferrable
  st.window = window;
  st.show = function (id) { st.active = id; return window.rrPageShown(id); };
  return st;
}
// RULE 1 — the measured boot, replayed
{
  const s = rig('page-dashboard');
  for (let i = 0; i < 36; i++) s.window.rrRepaintBrowse();
  for (let i = 0; i < 5; i++) s.window.renderBrowse();
  for (let i = 0; i < 3; i++) s.window.populateFilters();
  for (let i = 0; i < 4; i++) s.window.buildDashboard();
  ok('RUN: the measured boot — 36 repaints + 5 renders + 3 filter fills on a hidden page do NO work',
     s.calls.filter(c => c !== 'dash').length === 0, s.calls.join(','));
  ok('RUN: …while the visible Dashboard builds all four times, untouched', s.calls.filter(c => c === 'dash').length === 4, '');
  // RULE 2 + 3 — one reveal, one rebuild per builder, filters first
  const ran = s.show('page-browse');
  ok('RUN: opening the catalog rebuilds it ONCE — filters first, then the full repaint',
     s.calls.filter(c => c !== 'dash').join(',') === 'filters,repaint' && ran.join(',') === 'populateFilters,rrRepaintBrowse', s.calls.join(','));
  ok('RUN: opening it again does nothing', s.show('page-browse').length === 0 && s.calls.filter(c => c !== 'dash').length === 2, '');
  // showPage's own renderBrowse() afterwards is not held (page visible)
  s.window.renderBrowse();
  ok('RUN: with the page on screen, a render runs (the signature cache, not the hold, makes it cheap)',
     s.calls[s.calls.length - 1] === 'render', '');
}
// RULE 2 — the full builder runs, not the narrow one that was asked for
{
  const s = rig('page-dashboard');
  s.window.renderBrowse();                                   // only the Items list was asked for…
  const ran = s.show('page-browse');
  ok('RUN: a stale Items-list request is satisfied by the FULL browse repaint (no stale Sets tab)',
     ran.join(',') === 'rrRepaintBrowse' && s.calls.join(',') === 'repaint', s.calls.join(','));
}
// My Collection
{
  const s = rig('page-dashboard');
  s.window.renderBrowse(); s.window.rrRepaintBrowse(); s.window.populateFilters();
  const ran = s.show('page-collection');
  ok('RUN: opening My Collection refills the filters and repaints (its chip bar reads the dropdowns)…',
     ran.join(',') === 'populateFilters,rrRepaintBrowse', ran.join(','));
  const again = s.show('page-browse');
  ok('RUN: …but the catalog Items list stays stale until the CATALOG page is opened, then rebuilds',
     again.join(',') === 'rrRepaintBrowse', again.join(','));
}
// Other pages never trigger anything
{
  const s = rig('page-dashboard');
  s.window.rrRepaintBrowse();
  ok('RUN: revealing an unrelated page (item detail, photo inbox, prefs) rebuilds nothing and drops nothing',
     s.show('page-itemdetail').length === 0 && s.show('page-photo-inbox').length === 0 && s.calls.length === 0
     && s.show('page-browse').join(',') === 'rrRepaintBrowse', '');
}
// RULE 4 — the overlay rule still works, and composes
{
  const s = rig('page-browse');
  s.window._rrCropOpen = true;
  for (let i = 0; i < 27; i++) s.window.renderBrowse();
  ok('RUN (v1703 kept): 27 renders behind an overlay on a VISIBLE page do no work', s.calls.length === 0, '');
  s.window._rrCropOpen = false;
  s.window.rrFlushRepaints();
  ok('RUN (v1703 kept): closing the overlay runs the render exactly once', s.calls.join(',') === 'render', s.calls.join(','));
  const h = rig('page-photo-inbox');
  h.window._rrCropOpen = true;
  for (let i = 0; i < 27; i++) h.window.rrRepaintBrowse();
  h.window._rrCropOpen = false;
  h.window.rrFlushRepaints();
  ok('RUN: hidden AND behind an overlay (Brad\'s crop) — the overlay flush runs NOTHING for a hidden page…',
     h.calls.length === 0, h.calls.join(','));
  ok('RUN: …and the page is rebuilt once when it is next shown', h.show('page-browse').join(',') === 'rrRepaintBrowse' && h.calls.join(',') === 'repaint', '');
}
// Isolation
{
  const s = rig('page-dashboard');
  s.window.populateFilters(); s.window.rrRepaintBrowse();
  s.window.populateFilters = function () { throw new Error('boom'); };
  const ran = s.show('page-browse');
  ok('RUN: a builder that throws on reveal does not cost the others theirs',
     ran.join(',') === 'populateFilters,rrRepaintBrowse' && s.calls.join(',') === 'repaint', s.calls.join(','));
}
// No DOM
{
  const src = cfg.slice(cfg.indexOf('var _rrHeldRepaints = {};'), cfg.indexOf('window.rrFlushRepaints = rrFlushRepaints;') + 'window.rrFlushRepaints = rrFlushRepaints;'.length) + '}catch(e){}';
  const window = {};
  new Function('window', src)(window);   // no `document` in scope at all
  ok('RUN: with no document (the v1703 test rig, a worker) the page rule never holds',
     window.rrHoldRepaint('browse', function () {}) === false && window.rrPageOnScreen(['page-browse']) === true, '');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
