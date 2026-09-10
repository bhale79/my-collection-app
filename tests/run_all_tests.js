// ══ tests/run_all_tests.js ═════════════════════════════════════════════════
//
// v0.9.1709 (Session 94). Pins for the two "always red" suites and for the
// runner that stops suites going red unnoticed.
//
// The story: filter_bar_tests.js was 2/35 red and import_core_tests.js 1/260
// red on every fresh clone, for days. Neither was an app bug.
//   - filter_bar: v0.9.1660 changed the search box ON PURPOSE (fixed ~30rem
//     box, clear × inside it) and the two pins still described the old look.
//   - import_core: its last section runs against Scott's real workbook, which
//     is rightly not in the repo — and a missing workbook FAILED the run.
// Both were invisible because `npm test` ran 15 suites of 57. tests/run-all.js
// now finds every suite by name; these pins keep all three fixes honest.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const runner = require('./run-all.js');

// ── the runner ────────────────────────────────────────────────────────────
section('run-all.js finds every suite instead of listing them');
const tiers = runner.discover();
ok('nothing in tests/ is unclassified (a test that runs nowhere is the bug)', tiers.unclassified.length === 0, tiers.unclassified.join(', '));
ok('the quick tier is the whole battery, not a hand-picked 15', tiers.quick.length >= 50, String(tiers.quick.length));
ok('…and includes the 3,929-pin photo-inbox suite, syntax-check, colours and the layout measurer',
   ['photo-inbox-tests.js', 'syntax-check.js', 'color-count.js', 'layout-check.js', 'silent_fixes_tests.js', 'filter_bar_tests.js', 'import_core_tests.js']
     .every(n => tiers.quick.includes(n)), '');
ok('the browser tier holds the slow real-Chromium gates (every guide-*.js, the photo viewer, the sw check)',
   tiers.browser.filter(n => /^guide-/.test(n)).length >= 10 && tiers.browser.includes('photo-viewer.js') && tiers.browser.includes('sw-nav-cache.js'), tiers.browser.join(', '));
ok('the audits are reports, never gates — the runner knows them by name and does not run them',
   ['button-audit.js', 'phone-audit.js', 'silent-audit.js', 'press-audit.js', 'update-color-budget.js'].every(n => tiers.audit.includes(n)) &&
   !tiers.quick.some(n => /audit/.test(n)) && !tiers.browser.some(n => /audit/.test(n)), '');
ok('classification is by file name: *_tests.js / *-tests.js → quick, guide-*.js → browser, a stray name → unclassified',
   runner.classify('anything_tests.js') === 'quick' && runner.classify('anything-tests.js') === 'quick' &&
   runner.classify('guide-new.js') === 'browser' && runner.classify('stray.js') === 'unclassified' &&
   runner.classify('run-all.js') === 'self' && runner.classify('notes.md') === 'other', '');
ok('tests/lib/ is skipped (helpers, not suites)', fs.existsSync(path.join(__dirname, 'lib')) && !tiers.quick.some(n => n === 'lib'), '');
const runnerSrc = rd('tests/run-all.js');
ok('a suite is green when it exits 0, red otherwise — no parsing of pass counts', /r\.code === 0 \? ' ok ' : 'RED '/.test(runnerSrc), '');
ok('a "N SKIPPED" verdict is surfaced, not swallowed', /\(\\d\+\) SKIPPED/.test(runnerSrc) && /skipped in ' \+ r\.name/.test(runnerSrc), '');
ok('an unclassified file turns the run red', /process\.exit\(red\.length \|\| tiers\.unclassified\.length \? 1 : 0\)/.test(runnerSrc), '');
ok('a hung suite is killed, not waited on forever', /child\.kill\('SIGKILL'\)/.test(runnerSrc) && /TIMEOUT_MS = \{ quick: \d+, browser: \d+ \}/.test(runnerSrc), '');
ok('the browser tier runs one Chromium at a time (four abreast starved each other into false reds) with half an hour each',
   /runPool\(browserItems, 1\)/.test(runnerSrc) && /browser: 1800000/.test(runnerSrc), '');
ok('the runner is importable without running (this file imports it)', /if \(require\.main === module\) main\(\);/.test(runnerSrc), '');

section('npm test is the runner');
const pkg = JSON.parse(rd('package.json'));
ok('`npm test` runs tests/run-all.js — not a hand-written chain that forgets suites', pkg.scripts.test === 'node tests/run-all.js', pkg.scripts.test);
ok('`npm run test:browser` and `test:all` exist for the slow tier', pkg.scripts['test:browser'] === 'node tests/run-all.js --browser' && pkg.scripts['test:all'] === 'node tests/run-all.js --all', '');
ok('exceljs is a devDependency (the import fixture pins read a real .xlsx)', !!(pkg.devDependencies && pkg.devDependencies.exceljs), '');
ok('acorn is still there for the silent audit', !!(pkg.devDependencies && pkg.devDependencies.acorn), '');

// ── import_core: skip, loudly, when the fixture is not here ──────────────
section('import_core_tests.js — a missing fixture is a loud SKIP, never a silent pass or a permanent red');
const imp = rd('tests/import_core_tests.js');
ok('the fixture path can come from argv[2], RR_IMPORT_FIXTURE, or the repo root',
   /process\.argv\[2\] \|\| process\.env\.RR_IMPORT_FIXTURE \|\| path\.join\(__dirname, '\.\.', 'Scott_Inventory_TEST_FIXTURE\.xlsx'\)/.test(imp), '');
ok('the suite says where the fixture lives (Brad\'s PC), so the next session can find it',
   /FIXTURE_HOME = 'C:\\\\Users\\\\Brad\\\\Documents\\\\TheRailRoster\\\\TheRailRoster\\\\Scott_Inventory_TEST_FIXTURE\.xlsx'/.test(imp), '');
ok('a missing fixture prints SKIP with the count and the home, and does not count as a failure',
   /skipped = FIXTURE_PINS;/.test(imp) && /console\.log\('SKIP  ' \+ FIXTURE_PINS \+ ' fixture pins/.test(imp) && !/ok\('FIXTURE PRESENT/.test(imp), '');
const sectionSrc = imp.slice(imp.indexOf('async function fixtureTests()'));
const fixturePinsInSource = (sectionSrc.match(/^\s*ok\('fixture/mg) || []).length;
const declared = +(imp.match(/const FIXTURE_PINS = (\d+);/) || [])[1];
ok('FIXTURE_PINS matches the pins actually in the section (' + fixturePinsInSource + ')', declared === fixturePinsInSource, declared + ' declared');
ok('…and the suite checks that itself whenever the fixture runs', /ran === FIXTURE_PINS/.test(imp), '');
ok('the exit code still follows failures only', /process\.exit\(fail === 0 \? 0 : 1\);/.test(imp), '');
ok('a thrown fixture section is a FAIL, not a hang', /fixture section threw/.test(imp), '');
// Prove it by running the suite with the fixture deliberately absent.
const noFixture = spawnSync(process.execPath, [path.join(__dirname, 'import_core_tests.js'), path.join(__dirname, 'definitely-not-here.xlsx')], { encoding: 'utf8' });
const lastLine = (noFixture.stdout || '').trim().split('\n').pop() || '';
ok('run without the fixture: exit 0, verdict says "18 SKIPPED" and names the home', noFixture.status === 0 && /18 SKIPPED/.test(lastLine) && /Scott_Inventory_TEST_FIXTURE\.xlsx/.test(lastLine), lastLine.slice(0, 100));
ok('…and still ran every unit pin (259)', /GREEN \(259\)/.test(lastLine), lastLine.slice(0, 60));

// ── filter_bar: the pins describe the v1660 search box, not the v1546 one ─
section('filter_bar_tests.js — pins re-argued to the v1660 search box');
const fb = rd('tests/filter_bar_tests.js');
const idx = rd('app/index.html');
ok('the stale "grows into the spare space" pin is gone', !/grows into the spare space/.test(fb), '');
ok('the wrap is pinned as a fixed ~30rem box that can shrink (what index.html actually says)',
   /flex:0 1 30rem;min-width:220px;max-width:100%/.test(fb) && /id="browse-search-wrap"[^>]*flex:0 1 30rem;min-width:220px;max-width:100%/.test(idx), '');
ok('the clear × is pinned as inline-flex (inside the box), not block (below it)',
   /'inline-flex' : 'none'/.test(fb) && /e\.target\.value \? 'inline-flex' : 'none'/.test(rd('app/browse.js')), '');
ok('each re-argued pin says why (v1660) so nobody "fixes" it back', (fb.match(/v0\.9\.1660|v1660/g) || []).length >= 3, '');
const fbRun = spawnSync(process.execPath, [path.join(__dirname, 'filter_bar_tests.js')], { encoding: 'utf8' });
ok('filter_bar_tests.js is green', fbRun.status === 0, ((fbRun.stdout || '').trim().split('\n').pop() || '').slice(0, 80));

section('README tells the next session');
const readme = rd('tests/README.md');
ok('the README opens with how to run everything', /^# The test battery\n\n## Run everything/.test(readme), '');
ok('…and where the import fixture lives', /Scott_Inventory_TEST_FIXTURE\.xlsx/.test(readme) && /RR_IMPORT_FIXTURE/.test(readme), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
