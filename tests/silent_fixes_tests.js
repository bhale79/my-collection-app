// ══ tests/silent_fixes_tests.js ════════════════════════════════════════════
//
// v0.9.1708 (Session 94). What the first silent-control audit fixed, pinned.
//
// The audit (tests/silent-audit.js; written up in
// SILENT_CONTROL_AUDIT_2026-09-09.md) hunts controls that do nothing without
// saying so — the class the review card's › arrow belonged to. Its first run
// found ONE live bug and six dead remnants. Both kinds get pins: the bug so
// it stays fixed, the remnants so nobody resurrects a function whose target
// no longer exists ("it was in git history, it must have been useful").
//
//   A1  Item detail page, grouped sets: the per-unit boxes said "Show this
//       unit's photo above" and did NOTHING on a phone — the "photo above"
//       (#grp-side-photo) is only built at 1000px and wider. The code's own
//       comment admitted it. Now a tap on a narrow screen jumps to that
//       unit's own gallery on the same page, and the box's title says so.
//   B1  buildEphemeraPage / switchEphTab — the old Ephemera page; nothing
//       opened it (openEphemeraDetail, the live detail modal, stays).
//   B2  _applyEraVisibility — hid options in the era dropdown that was
//       removed (browse.js records the removal). Seven callers, all no-ops.
//   B3  buildQuickEntryList — filled #qe-list-container, which nothing builds.
//   B4  updateFilterBadge / clearBrowseFilters / toggleBrowseFilterPanel —
//       the old filter popup and its badge, replaced by the chips.
//   B5  Quick-Entry Step 1 (_qe1*) — ~290 lines after an unconditional
//       `return;` in renderWizardStep's entryMode branch. Unreachable.
//   B6  _runHealthCheck — its Preferences button was removed long ago.
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
const ALL = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => ({ f, s: rd(f) }));
const everywhere = re => ALL.filter(x => re.test(x.s)).map(x => x.f);

// ── A1 ───────────────────────────────────────────────────────────────────
section('A1 — a grouped set\'s unit boxes work on every screen');
const col = rd('app-collection.js');
const swap = col.slice(col.indexOf('window._grpHeroSwap = async function (gi)'), col.indexOf('// Async: group side photo'));
ok('the "quietly does nothing" comment is gone — the behaviour it excused is gone',
   !/quietly does nothing/.test(col), '');
ok('a unit with no photos is told so BEFORE the hero is looked for (same answer on every screen)',
   swap.indexOf("showToast('No photos for that unit yet')") < swap.indexOf("getElementById('grp-side-photo')"), '');
ok('with no side hero, the tap finds that unit\'s own gallery by its index among the photo members',
   /var _mi = _grpPhotoMembers\.indexOf\(p\);/.test(swap) && /getElementById\('grp-photos-' \+ _mi\)/.test(swap), '');
ok('…scrolls to it, and highlights it so the jump is seen (ring colour from the theme, not a literal — color-count budget)',
   /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/.test(swap) && /boxShadow = '0 0 0 3px var\(--accent3\)'/.test(swap), '');
ok('…and says so if even the gallery is missing — never a silent return',
   (swap.match(/showToast\('No photos for that unit yet'\)/g) || []).length >= 2 && !/if \(!target\) return;/.test(swap), '');
ok('the box\'s title tells the truth for the screen it is on',
   /\(window\.innerWidth \|\| 0\) >= 1000 \? 'Show this unit\\'s photo above' : 'Jump to this unit\\'s photos'/.test(col), '');
ok('the gallery ids the jump relies on are still built with that index',
   /id="grp-photos-' \+ gi \+ '"/.test(col), '');

// ── B1–B6 ────────────────────────────────────────────────────────────────
section('B — the dead remnants stay dead');
const gone = {
  'buildEphemeraPage': /\bfunction buildEphemeraPage\b|\bbuildEphemeraPage\(/,
  'switchEphTab': /\bfunction switchEphTab\b|\bswitchEphTab\(/,
  '_applyEraVisibility': /_applyEraVisibility\(/,
  'buildQuickEntryList': /buildQuickEntryList\(/,
  'updateFilterBadge': /updateFilterBadge\(/,
  'clearBrowseFilters': /clearBrowseFilters\(/,
  'toggleBrowseFilterPanel': /toggleBrowseFilterPanel\(/,
  '_qe1RenderGrouping': /_qe1RenderGrouping\(/,
  '_qe1SelectGrouping': /_qe1SelectGrouping/,
  '_qe1OpenPhotoModal': /_qe1OpenPhotoModal/,
  '_runHealthCheck': /_runHealthCheck\(/,
  '_ephCurrentTab': /_ephCurrentTab\b/,
};
Object.keys(gone).forEach(function (name) {
  const where = everywhere(gone[name]);
  ok('B: ' + name + ' is defined nowhere and called from nowhere', where.length === 0, where.join(', '));
});
ok('B1 kept the LIVE half: openEphemeraDetail still exists and the catalog rows still open it',
   /function openEphemeraDetail\(/.test(rd('app-pages.js')) && /openEphemeraDetail\(/.test(rd('browse.js')), '');
ok('B5: the entryMode branch still auto-advances and then STOPS — nothing after its return',
   /wizard\.data\.entryMode = 'full';[\s\S]{0,400}?renderWizardStep\(\);\s*\n\s*return;\s*\n\s*\/\/ v0\.9\.1708 \(silent-control audit B5\)/.test(rd('wizard.js')), '');
ok('B5: index.html never referenced any of it either',
   !/qe1-|_qe1|buildQuickEntryList|clearBrowseFilters|toggleBrowseFilterPanel|switchEphTab/.test(fs.readFileSync(path.join(APP, 'index.html'), 'utf8')), '');
// The targets these functions looked for must not quietly come back either —
// a resurrected #qe-list-container with no builder is the same trap.
['ephemera-content', 'era-select', 'qe-list-container', 'browse-filter-badge', 'browse-filter-btn', 'browse-filter-panel', 'health-check-output', 'qe1-grouping', 'qe1-sliders']
  .forEach(function (id) {
    ok('B: no code fetches #' + id + ' any more', everywhere(new RegExp("getElementById\\(['\"]" + id + "['\"]\\)")).length === 0, '');
  });

// ── The audit itself ─────────────────────────────────────────────────────
section('The audit is part of the repo now');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
ok('acorn is a devDependency (the scanner tokenizes for real; the fallback desyncs on nested templates)',
   !!(pkg.devDependencies && pkg.devDependencies.acorn), '');
ok('npm run test:silent runs the audit; test:silentfix runs these pins and is part of npm test',
   pkg.scripts['test:silent'] === 'node tests/silent-audit.js' && pkg.scripts['test:silentfix'] === 'node tests/silent_fixes_tests.js' && /test:silentfix/.test(pkg.scripts.test), '');
const auditSrc = fs.existsSync(path.join(__dirname, 'silent-audit.js')) ? fs.readFileSync(path.join(__dirname, 'silent-audit.js'), 'utf8') : '';
ok('the audit file exists and only ever exits 0 (an audit, not a gate)',
   auditSrc.length > 0 && /process\.exit\(0\)/.test(auditSrc) && !/process\.exit\((?!0\))/.test(auditSrc), '');
ok('…and parses as a plain script (no top-level return — tests/syntax-check.js reads every file that way)',
   auditSrc.length > 0 && /if \(require\.main === module\) main\(\);/.test(auditSrc) && !/^if \(require\.main !== module\) return;/m.test(auditSrc), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
