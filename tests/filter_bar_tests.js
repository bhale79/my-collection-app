// ═══════════════════════════════════════════════════════════════
// filter_bar_tests.js — Session 82.
//
// Brad: "we need to update how the filters and search bar look and expand or
// compact on different screen sizes." The old bar gave six dropdowns, two
// checkboxes and a search box the same weight, and an OFF filter ("Any
// Manufacturer") looked exactly like an ON one ("Lionel").
//
// Run:  node tests/filter_bar_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'app', 'browse.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── search leads ───────────────────────────────────────────────
ok('search comes first in the row', html.indexOf('browse-search-wrap') < html.indexOf('id="hierarchy-chips"'));
ok('...and grows into the spare space', /browse-search-wrap"[^>]*flex:1 1 240px/.test(html));
ok('...with the placeholder INSIDE the box', /id="browse-search"[^>]*placeholder="Search item number/.test(html));
ok('...and its own clear button', /id="browse-search-clear"/.test(html) && /function _rrClearBrowseSearch/.test(js));
ok('the clear button only shows with text in the box',
   /e\.target\.value \? 'block' : 'none'/.test(js));

// ── on and off look different ──────────────────────────────────
ok('an active filter is a solid blue pill', /var _FON = '#2980b9'/.test(js));
ok('...blue, not the app accent (orange means for sale)', !/chipOn[\s\S]{0,200}var\(--accent\)/.test(js));
ok('...carrying its own clear', /_pillOn = function \(label, clearFn, openFn\)/.test(js));
ok('one pill’s × does not clear the others', /function _phClearOne/.test(js));
ok('an idle chip is quiet and outlined', /_pillIdle = function \(label, openFn\)/.test(js));
ok('idle chips drop the empty "Any"/"All" wording',
   /idle: 'Maker'/.test(js) && /idle: 'Scale'/.test(js) && /idle: 'Era'/.test(js));

// ── the quiet ones fold away, but never silently ───────────────
ok('there is a More menu', /function _phMoreMenu/.test(js));
ok('...carrying a count of what is on inside it', /moreOn \? ' <span style="background:' \+ _?FON/.test(js) || /moreOn \?/.test(js));
ok('Imported and Needs details moved into it', /Imported only/.test(js) && /Needs details/.test(js));
ok('...and their old loose checkboxes are gone',
   !/_impLbl\.appendChild/.test(js) && !/_ndLbl\.appendChild/.test(js));
ok('an active folded filter still shows as a pill',
   /state\.filters\.imported === 'imported'\) html \+= _pillOn\('Imported'/.test(js));

// ── clear-all only when it means something ─────────────────────
ok('Clear appears only when a filter is on',
   /if \(onCount\) \{[\s\S]{0,400}Clear<\/button>/.test(js));

// ── three widths ───────────────────────────────────────────────
ok('idle chips fold at medium width', /@media \(max-width: 1100px\)[\s\S]{0,160}\.ph-idle \{ display: none/.test(css));
ok('...replaced by one Filters button', /#ph-filters-btn \{ display: inline-flex/.test(css));
ok('...which offers the main filters too', /_phMoreMenu\(event, true\)/.test(js) && /if \(includeMain\)/.test(js));
ok('search takes the full row on a phone', /@media \(max-width: 620px\)[\s\S]{0,200}#browse-search-wrap \{ flex: 1 1 100%/.test(css));
ok('active pills are never hidden by a width rule',
   !/ph-pill-on[\s\S]{0,80}display: none/.test(css),
   'a filter you cannot see is a filter you cannot trust');

// v0.9.1546: clearing a chip must reuse the app's own pick path — that
// function owns the cascade (clearing a maker can invalidate scale and era)
// and the re-render. A second copy of those rules would drift.
ok('clearing a chip goes through _setHierarchyChoice',
   /_phClearOne[\s\S]{0,700}_setHierarchyChoice\('manufacturer', 'any'\)/.test(js));
ok('...and clears the user-maker filter with it', /state\.filters\.ownMaker = '';[\s\S]{0,120}_setHierarchyChoice\('manufacturer'/.test(js));
ok('...while plain flags stay plain', /which === 'imported'\) state\.filters\.imported = ''/.test(js));

console.log('');

// ── v0.9.1579 (Session 86): the personal-only copy carries gauge ──
// Brad's Menards O buildings showed under the G / One Gauge chip: the
// hand-copied personal-only item was blind to pd.gauge (strike three of
// the v1392 dates / v1425 yearMade disease), so the v1511 own-gauge rule
// never fired for manual rows. The field is pinned to the copy list now.
ok('the personal-only copy hands gauge to the filter (v1392/v1425 disease, strike three)',
   /gauge:\s*pd\.gauge\s*\|\|\s*''/.test(js));
ok('…placed on the same copied-subset object as the date fix',
   /dateAdded:\s*pd\.dateAdded[\s\S]{0,1600}gauge:\s*pd\.gauge/.test(js));


// ── v0.9.1581 (Session 86): Scott's "search wasn't loading" report ──
// Measured: 5.9s PER KEYSTROKE (141,854 findPD scans to find ~213 owned
// rows), 21s for a five-character search — a frozen minute on his Mac.
const appjs = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
ok('browse search DEBOUNCES the render — a keystroke burst costs one pass',
   /_rrBrowseSearchT/.test(appjs)
   && /clearTimeout\(window\._rrBrowseSearchT\)/.test(appjs)
   && /setTimeout\(function \(\) \{ renderBrowse\(\); \}, 250\)/.test(appjs));
ok('…but the STATE updates instantly, before the timer (no stale-query window)',
   /state\.filters\.search = q;[\s\S]{0,400}_rrBrowseSearchT/.test(appjs));
ok('the pd lookup fast-rejects rows no personal number can own (the 5.9s root cause)',
   /_pdNumsExact = new Set\(\)/.test(js)
   && /if \(!_pdNumsExact\.has\(_dn\)\)/.test(js));
ok('…and the adoption seats are consulted BEFORE rejecting (v1120/v1193 rules intact)',
   /_pdNumsExact\.has\(_dn\)[\s\S]{0,300}_bvAdopt\.get\(_dn\)/.test(js));


// ── v0.9.1582 (Session 86): act two of Scott's report ──
// The alias key scan ran PER ROW (3,905ms measured across the catalog)
// for an answer that depends only on the query.
ok('alias expansion is computed once per QUERY, memoized — never per row',
   /_aliasQCache = \{ q: null, terms: null \}/.test(js)
   && /function _aliasTermsFor\(query\)/.test(js)
   && /_aliasQCache\.q === query\) return _aliasQCache\.terms/.test(js));
ok('…and _aliasSearch itself no longer walks Object.keys per call',
   !/function _aliasSearch\(haystack, query\) \{[\s\S]{0,600}Object\.keys\(SEARCH_ALIASES\)/.test(js));
ok('…same word-boundary discipline: rows still test through _aliasTermHit',
   /function _aliasSearch\(haystack, query\) \{[\s\S]{0,400}_aliasTermHit\(haystack, terms\[i\]\)/.test(js));

console.log(fail === 0 ? 'ALL FILTER-BAR TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
