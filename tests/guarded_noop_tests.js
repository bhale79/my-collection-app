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

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
