// ══ tests/guarded_noop_tests.js ════════════════════════════════════════════
//
// v0.9.1710 (Session 94). The guarded-no-op class, and the two blocks of it
// that were removed.
//
// Sweep 1 hunted `if (!el) return` — a control that gives up quietly. Sweep 2
// (finding D) met its quieter twin: `var b = getElementById('id'); if (b)
// b.style.display = …`. Nothing returns and nothing is said; when that id
// exists nowhere, the line simply never runs. Invisible, harmless, and a trap
// for the next reader, who assumes it does something.
//
//   D1  The old browse TAB STRIP (#btab-items, #btab-sets, #btab-catalogs …).
//       The strip was removed long ago; ~40 lines across two functions still
//       showed, hid, relabelled and underlined its buttons — on every era
//       switch and every browse render. The live halves (the panel switch,
//       the era header refresh) stayed and are pinned here.
//   D2  The legacy tutorial OVERLAY and CONDUCTOR PANEL (#tut-overlay,
//       #tut-panel, #tut-skip, #tut-next). Appended to every page load and
//       hidden by .tut-hidden, which nothing ever removed; the guided tour
//       has drawn its own card (#gt-*) since v0.9.1204 and tutNext() had
//       already been emptied to a comment. ~25 lines of JS + ~168 of CSS.
//
// The scanner learned the class too, so the next block of it is found rather
// than met: tests/silent-audit.js gained guardedNoopsIn().
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
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const ALL = fs.readdirSync(APP).filter(f => /\.(js|css|html)$/.test(f));
// Comments explain what was removed; they are not code.
const codeOf = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

section('D1 — the browse tab strip is gone, its live neighbours are not');
const brw = rd('browse.js');
ok('no code anywhere still looks up a btab- button',
   ALL.filter(f => /getElementById\(\s*['"]btab-|['"]btab-[\w-]*['"]\s*[,:\]]|id\^="btab-/.test(rd(f))).length === 0,
   ALL.filter(f => /btab-/.test(codeOf(rd(f)))).join(', '));
ok('…and the report builder\'s own tabs (#rbtab-*) were NOT caught in the sweep — they are live',
   /id="rbtab-columns"/.test(rd('reports.js')) && /getElementById\('rbtab-'\+t\)/.test(rd('reports.js').replace(/\s/g, '')), '');
ok('renderBrowseTab still switches the PANELS, which is what actually changes the tab',
   /const panels = \{ items:'browse-items-panel'/.test(brw) && /el\.style\.display = key === state\._browseTab \? '' : 'none'/.test(brw), '');
ok('…and those panel ids are real (index.html builds all ten)',
   (rd('index.html').match(/id="browse-[a-z]+-panel"/g) || []).length === 10, String((rd('index.html').match(/id="browse-[a-z]+-panel"/g) || []).length));
ok('the misleading name went with the dead code: no code defines or calls _updateBrowseTabsForEra (the comment that explains its removal is not code)',
   !/_updateBrowseTabsForEra/.test(codeOf(brw)), '');
ok('…replaced by what it actually did, under a name that says so, still called once from renderBrowse',
   /function _refreshBrowseHeadersForEra\(\)/.test(brw) && (brw.match(/_refreshBrowseHeadersForEra\(\)/g) || []).length === 2, '');
ok('…and it still refreshes the era headers (Atlas and Lionel layouts differ)',
   /_refreshBrowseHeadersForEra\(\) \{[\s\S]{0,300}_refreshBrowseHeaders\(\);/.test(brw) && /function _refreshBrowseHeaders\(\)/.test(brw), '');

section('D2 — the legacy tutorial panel is gone, the Help widget is not');
const tut = rd('tutorial.js'), tcss = rd('tutorial.css');
ok('nothing builds #tut-overlay or #tut-panel any more', !/id = 'tut-overlay'|id = 'tut-panel'/.test(tut), '');
ok('…nor its bubble, counter, Skip tour or Next → buttons',
   !/tut-bubble|tut-counter|tut-skip|tut-next|tut-click-hint|tut-conductor'/.test(codeOf(tut)), '');
ok('the empty tutNext() stub is gone (its only caller was that panel)', !/function tutNext/.test(tut), '');
ok('…but tutEnd stays: it is the public name for "close the tour" and still ends the real one',
   /function tutEnd\(\)\s*\{ if \(typeof _gtEnd === 'function'\) _gtEnd\(\); \}/.test(tut) && /window\.tutEnd = tutEnd/.test(tut), '');
ok('the sidebar Help widget is still built, with its conductor and label',
   /widget\.id = 'tut-help-widget'/.test(tut) && /tut-help-conductor/.test(tut) && /tut-help-label/.test(tut), '');
ok('…and _buildTutorialUI still guards on the widget, so it cannot build twice',
   /function _buildTutorialUI\(\) \{\s*\n\s*if \(document\.getElementById\('tut-help-widget'\)\) return;/.test(tut), '');
ok('the guided tour that replaced it is untouched (#gt-callout, #gt-blocker, #gt-hole)',
   /gt-blocker/.test(tut) && /gt-callout/.test(tut) && /function _gtEnd\(\)/.test(tut), '');

section('D2 — and the styles for a screen that cannot appear went too');
ok('tutorial.css no longer styles the overlay, the panel or its bubble',
   !/#tut-overlay|#tut-panel|#tut-bubble|\.tut-hidden|\.tut-spotlight|\.tut-bubble-|\.tut-btn-/.test(codeOf(tcss)), '');
ok('…and it kept the Help widget and the guided tour card',
   /#tut-help-widget \{/.test(tcss) && /#gt-callout/.test(tcss), '');
ok('the file lost roughly the 168 lines that block occupied', tcss.split('\n').length < 200, String(tcss.split('\n').length) + ' lines');
ok('the print stylesheet stopped hiding an element that can no longer exist',
   !/#tut-overlay/.test(rd('app.css')) && /#gmail-help-overlay, #onboarding-map-overlay/.test(rd('app.css')), '');

section('the scanner learned the class');
const audit = require('./silent-audit.js');
ok('guardedNoopsIn is exported', typeof audit.guardedNoopsIn === 'function', '');
const sample = { name: 'f', file: 'x.js', line: 1, body:
  "function f(){\n" +
  "  var a = document.getElementById('gone-one');\n" +
  "  if (a) a.style.display = 'none';\n" +          // the class: no return, never runs
  "  var b = document.getElementById('gone-two');\n" +
  "  if (!b) return;\n" +                            // a bail-out — the OTHER class
  "  var c = document.getElementById('real-one');\n" +
  "  if (c) { c.textContent = 'hi'; }\n" +           // fair guard: caller decides if it is born
  "}" };
const found = audit.guardedNoopsIn(sample);
ok('…it finds `if (el) el.…` with no return', found.some(g => g.id === 'gone-one'), JSON.stringify(found.map(g => g.id)));
ok('…it does NOT re-report a bail-out (`if (!el) return`) — that is the other class',
   !found.some(g => g.id === 'gone-two'), JSON.stringify(found.map(g => g.id)));
ok('…it reports every candidate and leaves "is it born?" to the caller', found.some(g => g.id === 'real-one'), JSON.stringify(found.map(g => g.id)));
ok('…and it carries the line and the code, so a finding can be read without opening the file',
   found.every(g => typeof g.line === 'number' && g.snippet.length > 5), JSON.stringify(found[0] || {}));
const src = fs.readFileSync(path.join(__dirname, 'silent-audit.js'), 'utf8');
ok('an id beginning with an underscore now counts as BORN (_part-modal and friends read as never-created before)',
   /\[A-Za-z_\]\[\\w-\]\*/.test(src) && !/\[A-Za-z\]\[\\w-\]\*/.test(src), '');
const births = audit.collectBirths(audit.readApp(), audit.collectFunctions(audit.readApp()));
ok('…proved on the real app: #_part-modal is born in app-pages.js', (births.get('_part-modal') || []).length > 0,
   JSON.stringify((births.get('_part-modal') || []).map(b => b.where)));
ok('…and the removed ids are born nowhere, which is why their guards were no-ops',
   ['btab-items', 'btab-catalogs', 'tut-panel', 'tut-overlay'].every(id => !(births.get(id) || []).length), '');
ok('the audit still only ever exits 0 — a report, not a gate',
   /process\.exit\(0\)/.test(src) && !/process\.exit\((?!0\))/.test(src), '');

// ══ v0.9.1711 (Session 95) — SWEEP 2, finding D, the rest of the list ═════
//
// After D1/D2 the scanner reported 50 more guarded no-ops. Hand-checked, one
// by one: 42 were real (an id born nowhere), 8 were the scanner's blind spots
// (an id passed to a helper that builds the element — mkDrop('wiz-search-mfr'…)
// — and an id born from a template prefix — id="ptog-${id}"). Both blind
// spots are now births (collectBirths + bornAnywhere) and are pinned below,
// on the real app, so the false positives cannot return.
//
// What went, with the dead code each line belonged to:
//   D3  _buildWantPageLegacy — the pre-1348 Want page renderer, ~195 lines
//       "kept for reference", unreachable, writing to six ids born nowhere.
//   D4  The road-name searchable combobox (_roadCombo*, #road-combo-list,
//       #filter-road-input, #road-combo-clear) and, in populateFilters, the
//       pass that normalised and counted every road name in the catalog to
//       feed it — on every fill. Behaviour kept exactly: resetFilters calls
//       applyFilters() where _roadComboClear() only ever reached that call,
//       and state.filters.road = '' where the dead combobox left it at ''.
//   D5  filterOwned's 50ms timer (stray-pill removal + an unreachable QE
//       checkbox builder after a bare return) and removeQEFilter's two
//       element removals; the #filter-road / #filter-quick-inline lookups
//       and their mobile CSS.
//   D6  One-liners: #identify-btn ×3, #collection-icon-legend ×2,
//       #cols-btn-collection, #browse-count, #browse-pagination (browse.js);
//       #modal-set-badge / #modal-matched-badge (app-collection.js);
//       #nav-sets-count and the two empty-page hints gated on #sold-page /
//       #forsale-page — the pages are #page-sold / #page-forsale, so the hints
//       never showed (app-pages.js); #nav-sheet-link, #pref-location-toggle ×3
//       (app.js, prefs.js); #nav-total (dashboard.js); #qe1-tender-label,
//       #year-range-warning (wizard.js); #pv-mb-reveal (wizard-handlers.js);
//       #wiz-title (wizard-quickentry.js); #wizard-step-title (wizard-save.js);
//       #pin-rv-shot's else-branch and _batchBtnSync (photo-inbox.js).
//
// Left alone, on purpose (not this class): the hint helper itself
// (maybeShowContextualHint / resetContextualHints — a Preferences action
// still calls the reset); wizard-quickentry.js as a whole (quickEntryAdd has
// no caller outside its own file — a separate decision for Brad).

section('D3–D6 — every id from the sweep is looked up nowhere, and born nowhere');
const SWEPT = ['browse-count', 'browse-pagination', 'collection-icon-legend', 'cols-btn-collection',
  'filter-quick-inline', 'filter-road', 'filter-road-input', 'forsale-page', 'identify-btn', 'imp-only-toggle',
  'modal-matched-badge', 'modal-set-badge', 'nav-sets-count', 'nav-sheet-link', 'nav-total', 'nd-only-toggle',
  'pref-location-toggle', 'pv-mb-reveal', 'qc-batch-btn', 'qe-only-toggle', 'qe1-tender-label', 'road-combo-clear',
  'road-combo-list', 'sold-page', 'want-cards', 'want-era-filter', 'want-priority-filter', 'want-sort',
  'want-table', 'want-type-filter', 'wiz-title', 'wizard-step-title', 'year-range-warning'];
const JS = ALL.filter(f => /\.js$/.test(f));
const lookedUp = id => JS.filter(f => new RegExp("getElementById\\(\\s*['\"]" + id + "['\"]").test(codeOf(rd(f))));
SWEPT.forEach(id => ok('#' + id + ' is looked up nowhere', lookedUp(id).length === 0, lookedUp(id).join(', ')));
ok('…and none of them is born anywhere (so nothing that read them could ever have run)',
   SWEPT.every(id => !audit.bornAnywhere(births, id)), SWEPT.filter(id => audit.bornAnywhere(births, id)).join(', '));
ok('the live twins were NOT caught: #pin-identify-btn (inbox) and #nav-sheet-link-p (Preferences) still exist',
   /id="pin-identify-btn"/.test(rd('photo-inbox.js')) && /id="nav-sheet-link-p"/.test(rd('prefs.js')), '');

section('D3 — the legacy Want renderer is gone; the merged page carries its rules');
const pages = rd('app-pages.js');
ok('no code defines or calls _buildWantPageLegacy', !/_buildWantPageLegacy/.test(codeOf(pages)), '');
ok('buildWantPage is still the one-line forward to buildUpgradePage',
   /function buildWantPage\(\) \{\s*\n\s*if \(typeof buildUpgradePage === 'function'\) buildUpgradePage\(\);\s*\n\}/.test(pages), '');
ok('…and the merged page still has the period rule the legacy page carried (hide only on a KNOWN mismatch)',
   /if \(_uPeriod && _uPeriod !== _ue\) return false;/.test(pages), '');
ok('the mobile CSS for the want-* filters went with them; the Upgrade filter kept its rule',
   !/#want-priority-filter/.test(rd('app.css')) && /#upgrade-priority-filter \{/.test(rd('app.css')), '');

section('D4 — the road combobox is gone and populateFilters no longer counts every road');
// (the two lines that replaced combobox calls carry a trailing "was …" comment — strip those too)
const brwCode = codeOf(brw).replace(/\/\/[^\n]*/g, '');
ok('no code defines or calls any _roadCombo* function', !/_roadCombo/.test(brwCode), '');
ok('…nor sets window._allRoads or _roadComboValue', !/_allRoads|_roadComboValue/.test(brwCode), '');
ok('populateFilters no longer walks the catalog to normalise road names',
   !/_normRoadKey|_roadGroupsTmp|_roadDeduped|_rawRoadCounts/.test(codeOf(brw)), '');
ok('resetFilters ends the way it always effectively did: filter-type cleared, then applyFilters()',
   /document\.getElementById\('filter-type'\)\.value = '';\s*\n\s*applyFilters\(\);/.test(brw), '');
ok('applyFilters sets state.filters.road to the value the dead combobox always left it at',
   /state\.filters\.road = '';/.test(brw.slice(brw.indexOf('function applyFilters'), brw.indexOf('function applyFilters') + 800)), '');
ok('the combobox CSS went too (.road-combo*, .road-opt)', !/\.road-combo|\.road-opt/.test(codeOf(rd('app.css'))), '');
ok('road filtering itself is untouched: the browse filter still honours state.filters.road',
   /if \(road && item\.roadName/.test(brw), '');

section('D5 — filterOwned has no timer left and removeQEFilter only resets state');
ok('filterOwned no longer schedules a setTimeout', !/setTimeout/.test(brw.slice(brw.indexOf('function filterOwned'), brw.indexOf('function removeQEFilter'))), '');
ok('…and the unreachable QE checkbox builder went with it', !/QE only|qe-only-toggle/.test(codeOf(brw)), '');
ok('removeQEFilter still resets all six filter keys',
   /function removeQEFilter\(\) \{[\s\S]{0,400}quickEntry = '';[\s\S]{0,60}imported = '';[\s\S]{0,60}needsDetails = '';[\s\S]{0,60}ownMaker = '';[\s\S]{0,60}subCollection = '';[\s\S]{0,60}subType = '';/.test(brw), '');
ok('the mobile CSS that hid #filter-road / #filter-quick-inline is gone', !/#filter-road|#filter-quick-inline/.test(rd('app.css')), '');

section('D6 — the live neighbours of each one-liner are intact');
const col = rd('app-collection.js');
ok('openItem still fills the modal subtitle and the mi-* cells around where the badges were',
   /getElementById\('modal-subtitle'\)\.textContent/.test(col) && /getElementById\('mi-type'\)\.textContent/.test(col), '');
ok('_selectTender still re-renders Step 3 on a tender change (the branch that survived)',
   /if \(_step3Active\) \{\s*\n\s*\/\/ Session 159[^\n]*\n\s*renderWizardStep\(\);/.test(rd('wizard.js')), '');
ok('…and its one caller is still drawn on Condition & Details', (rd('wizard.js').match(/_showTenderPicker\(\)/g) || []).length === 1, '');
ok('wizardAdvance still guards on a disabled Next and then advances',
   /async function wizardAdvance\(\) \{\s*\n\s*const _nextBtn[^\n]*\n\s*if \(_nextBtn && _nextBtn\.disabled\) return;\s*\n\s*await _wizardNextCore\(\);/.test(rd('wizard.js')), '');
ok('_pvToggleMasterBox still records the choice and restyles the Yes/No buttons',
   /function _pvToggleMasterBox\(val\) \{\s*\n\s*wizard\.data\.hasMasterBox = val;\s*\n\s*document\.querySelectorAll/.test(rd('wizard-handlers.js')), '');
ok('the screenshot reader still releases its busy state in finally', /finally \{\s*\n\s*if \(typeof _shotBusy === 'function'\) _shotBusy\(\);/.test(rd('photo-inbox.js')), '');
ok('the dashboard still zeroes the nav badges that exist (nav-owned first)', /\[\['nav-owned', 0\], \['nav-wishlist-count', 0\],/.test(rd('dashboard.js')), '');
ok('_dismissDisclaimer still syncs the REAL Preferences toggle (#ptog-disclaimer is born as ptog-${id})',
   /getElementById\('ptog-disclaimer'\)/.test(pages) && /id="ptog-\$\{id\}"/.test(rd('prefs.js')), '');
ok('the hint helper stays (a Preferences action still resets hints)',
   /function maybeShowContextualHint\(/.test(rd('app-misc.js')) && /resetContextualHints\(\)/.test(rd('tutorial.js')), '');

section('the scanner learned its two blind spots');
ok('bornAnywhere is exported', typeof audit.bornAnywhere === 'function', '');
ok('a PREFIX birth: id="ptog-${id}" makes ptog-disclaimer born', audit.bornAnywhere(births, 'ptog-disclaimer') && !(births.get('ptog-disclaimer') || []).length, '');
ok('…but a prefix never claims an id that merely starts the same way with nothing after it',
   births.prefixes && [...births.prefixes].every(p => !audit.bornAnywhere(births, p) || (births.get(p) || []).length > 0), '');
ok('a HELPER birth: mkDrop(\'wiz-search-mfr\', …) makes wiz-search-mfr born, via mkDrop',
   (births.get('wiz-search-mfr') || []).some(b => b.helper && b.fn === 'mkDrop'), JSON.stringify(births.get('wiz-search-mfr') || []));
ok('…all five wizard search dropdowns are born that way', ['wiz-search-mfr', 'wiz-search-era', 'wiz-search-road', 'wiz-search-scale', 'wiz-search-type'].every(id => audit.bornAnywhere(births, id)), '');
ok('…and the helper rule is not a blanket "any string argument": nav-total is passed nowhere and stays unborn', !audit.bornAnywhere(births, 'nav-total'), '');
ok('collectFunctions now keeps each function\'s parameter list, which the helper rule needs',
   typeof audit.collectFunctions(audit.readApp()).get('mkDrop').params === 'string', '');
ok('on the real app the sweep is complete: the scanner reports 0 guarded no-ops', (function () {
  let n = 0;
  audit.collectFunctions(audit.readApp()).forEach(fn => audit.guardedNoopsIn(fn).forEach(g => { if (!audit.bornAnywhere(births, g.id)) n++; }));
  return n === 0;
})(), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
