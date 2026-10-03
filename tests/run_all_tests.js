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

// ── a crashed suite is readable from the board (2026-10-03) ───────────────
// crop_preview_tests died once under four-abreast load with no FAIL line; the
// board showed "Node.js v22.22.0" and nothing else. The runner now keeps the
// five lines before the verdict (stack frames dropped, repo root trimmed) for
// a red suite with no FAIL line. Proved here against a REAL copy of the runner
// driving planted suites in a scratch folder: a throw, an unhandled rejection,
// a hang (the copy's quick timeout is cut to 1.5 s), a FAIL, and a green.
section('run-all.js — a red suite with no FAIL line shows the lines before its verdict');
ok('the runner keeps a tail: the lines before the verdict, frames dropped',
   /const tail = lines\.slice\(0, -1\)\.filter\(l => !\/\^\\s\+at\\s\/\.test\(l\)\)\.slice\(-5\)/.test(runnerSrc) && /fails, tail, out \}\)/.test(runnerSrc), '');
ok('…printed only when the suite is red AND has no FAIL line (FAIL lines keep their place)',
   /if \(r\.fails\.length\) r\.fails\.forEach/.test(runnerSrc) && /else if \(r\.tail\.length\)/.test(runnerSrc) && /no FAIL line — the last lines before the verdict:/.test(runnerSrc), '');
const os = require('os');
function plantedBattery(mutateRunner) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-runall-'));
  const dir = path.join(tmp, 'tests');
  fs.mkdirSync(dir);
  let src = runnerSrc.replace('const TIMEOUT_MS = { quick: 180000, browser: 1800000 };', 'const TIMEOUT_MS = { quick: 1500, browser: 1800000 };');
  if (src === runnerSrc) throw new Error('TIMEOUT_MS anchor not found in run-all.js');
  if (mutateRunner) src = mutateRunner(src);
  fs.writeFileSync(path.join(dir, 'run-all.js'), src);
  fs.writeFileSync(path.join(dir, 'planted_crash_tests.js'),
    "for (let i = 1; i <= 7; i++) console.log('  PASS  progress pin ' + i);\nthrow new Error('planted crash: the thing that went wrong');\n");
  fs.writeFileSync(path.join(dir, 'planted_reject_tests.js'),
    "console.log('  PASS  starting');\nPromise.reject(new TypeError('planted rejection: browser has been closed'));\nsetTimeout(function () {}, 50);\n");
  fs.writeFileSync(path.join(dir, 'planted_hang_tests.js'),
    "console.log('  PASS  before the hang 1');\nconsole.log('  PASS  before the hang 2');\nconsole.log('  PASS  before the hang 3');\nsetInterval(function () {}, 1000);\n");
  fs.writeFileSync(path.join(dir, 'planted_fail_tests.js'),
    "console.log('  PASS  one');\nconsole.log('  FAIL  two  -> planted failure');\nconsole.log('\\n  1 passed, 1 failed');\nprocess.exit(1);\n");
  fs.writeFileSync(path.join(dir, 'planted_green_tests.js'),
    "console.log('  PASS  one');\nconsole.log('\\n  1 passed, 0 failed');\n");
  return { tmp, runner: path.join(dir, 'run-all.js') };
}
// Split a scoreboard into rows: { name: { row, under: [lines printed beneath it] } }.
function board(out) {
  const rows = {};
  let cur = null;
  out.split('\n').forEach(l => {
    const m = l.match(/^  (RED | ok ) (\S+\.js)/);
    if (m) { cur = m[2]; rows[cur] = { row: l, under: [] }; }
    else if (cur && /^        /.test(l)) rows[cur].under.push(l);
    else cur = null;
  });
  return rows;
}
let battery = null;
try {
  battery = plantedBattery(null);
  const run = spawnSync(process.execPath, [battery.runner, '--serial'], { encoding: 'utf8', timeout: 60000 });
  const b = board(run.stdout || '');
  const crash = b['planted_crash_tests.js'] || { row: '', under: [] };
  ok('the whole planted battery ran and exited red (5 suites, 1 green, 4 red)', run.status === 1 && /5 suites: 1 green, 4 red/.test(run.stdout || ''), ((run.stdout || '').trim().split('\n').slice(-2).join(' | ')).slice(0, 120));
  ok('a throw: the row is RED and its verdict is still Node\'s version line (that is all the board used to show)', /^  RED /.test(crash.row) && /Node\.js v\d/.test(crash.row), crash.row);
  ok('…and beneath it, the header and the Error line — the crash is readable from the board',
     crash.under.some(l => /no FAIL line — the last lines before the verdict:/.test(l)) && crash.under.some(l => /\| Error: planted crash: the thing that went wrong/.test(l)), crash.under.join(' / ').slice(0, 200));
  ok('…five lines at most, the last progress pin among them, no stack frames',
     crash.under.length === 6 && crash.under.some(l => /\|   PASS  progress pin 7/.test(l)) && !crash.under.some(l => /^\s+\|\s+at /.test(l)), String(crash.under.length));
  ok('…and the scratch root is trimmed off the path, so the line reads tests/<file>:<line>',
     crash.under.some(l => /\| tests\/planted_crash_tests\.js:2$/.test(l) || /\| tests\\planted_crash_tests\.js:2$/.test(l)) && !crash.under.some(l => l.includes(battery.tmp)), crash.under.join(' / ').slice(0, 200));
  const rej = b['planted_reject_tests.js'] || { row: '', under: [] };
  ok('an unhandled rejection: RED, and the TypeError line is on the board', /^  RED /.test(rej.row) && rej.under.some(l => /\| TypeError: planted rejection: browser has been closed/.test(l)), rej.under.join(' / ').slice(0, 200));
  const hang = b['planted_hang_tests.js'] || { row: '', under: [] };
  ok('a hang: killed at the (shortened) timeout, verdict says so', /^  RED /.test(hang.row) && /run-all: killed after 1\.5s/.test(hang.row), hang.row);
  ok('…and the three lines it printed before hanging are on the board — what it was doing when it died',
     hang.under.length === 4 && [1, 2, 3].every(n => hang.under.some(l => l.includes('|   PASS  before the hang ' + n))), hang.under.join(' / ').slice(0, 200));
  const failRow = b['planted_fail_tests.js'] || { row: '', under: [] };
  ok('a suite with FAIL lines keeps them, and gets NO tail (the FAIL lines are the diagnosis)',
     /^  RED /.test(failRow.row) && failRow.under.length === 1 && /FAIL  two  -> planted failure/.test(failRow.under[0]), failRow.under.join(' / ').slice(0, 200));
  const green = b['planted_green_tests.js'] || { row: '', under: [] };
  ok('a green suite shows nothing beneath its row', /^   ok  planted_green_tests\.js/.test(green.row) && green.under.length === 0, green.row + ' / ' + green.under.length);
} catch (e) {
  ok('planted battery ran', false, String(e && e.message || e));
} finally {
  if (battery) fs.rmSync(battery.tmp, { recursive: true, force: true });
}
// PLANTED: the runner WITHOUT the tail print → the Error line is gone from the board (the pins above can fail).
let planted = null;
try {
  planted = plantedBattery(src => {
    const cut = src.replace(/else if \(r\.tail\.length\) \{[\s\S]*?\n        \}\n/, '');
    if (cut === src) throw new Error('tail-print anchor not found in run-all.js');
    return cut;
  });
  const run = spawnSync(process.execPath, [planted.runner, '--serial', '--only', 'planted_crash'], { encoding: 'utf8', timeout: 60000 });
  const crash = board(run.stdout || '')['planted_crash_tests.js'] || { row: '', under: [] };
  ok('PLANTED: the old runner shows "Node.js v…" and nothing else for the same crash (caught)', /Node\.js v\d/.test(crash.row) && crash.under.length === 0, crash.under.join(' / ').slice(0, 120));
} catch (e) {
  ok('PLANTED: battery ran', false, String(e && e.message || e));
} finally {
  if (planted) fs.rmSync(planted.tmp, { recursive: true, force: true });
}

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
