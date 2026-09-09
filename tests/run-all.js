// ══ tests/run-all.js — every suite, one command, one scoreboard ═══════════
//
// Session 94. `npm test` used to be a hand-written chain of 15 suites — out
// of 57. The other 42 ran only when a session remembered them. That is how
// filter_bar_tests.js sat red for five days after a deliberate change
// (v0.9.1660) that nobody re-ran it against: the app was right, the pins were
// stale, and the red was invisible because nothing ran the file.
//
// This runner FINDS the suites instead of listing them, so a new test file
// joins the battery the moment it is saved, and a file that runs nowhere is
// reported as a fault rather than forgotten.
//
//   node tests/run-all.js              quick tier (default; what `npm test` runs)
//   node tests/run-all.js --browser    slow real-Chromium gates (guides, viewer, sw)
//   node tests/run-all.js --all        both tiers
//   node tests/run-all.js --only inbox run the suites whose file name contains "inbox"
//   node tests/run-all.js --list       show the tiers and stop
//   node tests/run-all.js --serial     one at a time (the quick tier runs 4 abreast;
//                                      the browser tier is always one at a time)
//
// Tiers (by file name — the only rule to remember):
//   quick    *_tests.js and *-tests.js, plus the named checks in QUICK_EXTRA
//   browser  guide-*.js, photo-viewer.js, sw-nav-cache.js — real Chromium,
//            minutes to an hour (guide-buttons and guide-chaos walk every
//            step of every guide four ways); run them when guides, the
//            wizard's photo viewer, or app/sw.js change
//   audits   button-audit / phone-audit / silent-audit / update-color-budget —
//            reports, never gates; run by hand, never by this runner
// Anything else in tests/ (except tests/lib/) is UNCLASSIFIED and turns the
// run red until it is given a home — a test that runs nowhere is the bug this
// file exists to prevent.
//
// A suite is green when it exits 0. Its last line of output is its verdict and
// is shown on the scoreboard; a verdict containing "N SKIPPED" is counted so a
// skipped section is visible, not silent (import_core_tests.js skips its 18
// fixture pins when Scott's workbook is not on the machine).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TESTS = __dirname;

const QUICK_EXTRA = ['syntax-check.js', 'color-count.js', 'no-drill-residue.js', 'lookup_canary.js',
                     'layout-check.js', 'help-hub.js', 'help-surfaces.js'];
const BROWSER = ['photo-viewer.js', 'sw-nav-cache.js'];           // plus guide-*.js
const AUDITS = ['button-audit.js', 'phone-audit.js', 'silent-audit.js', 'update-color-budget.js'];
// Browser suites walk every guide step with real waits; guide-buttons and
// guide-chaos alone run past ten minutes, so the browser tier is given half
// an hour each and is run ONE AT A TIME — four Chromiums abreast starve each
// other and turn timing waits into false reds (two were killed that way on
// the tier's first run).
const TIMEOUT_MS = { quick: 180000, browser: 1800000 };

function classify(name) {
  if (!/\.js$/.test(name)) return 'other';
  if (name === 'run-all.js') return 'self';
  if (AUDITS.includes(name)) return 'audit';
  if (/^guide-.*\.js$/.test(name) || BROWSER.includes(name)) return 'browser';
  if (/(_tests|-tests)\.js$/.test(name) || QUICK_EXTRA.includes(name)) return 'quick';
  return 'unclassified';
}

function discover() {
  const tiers = { quick: [], browser: [], audit: [], unclassified: [] };
  fs.readdirSync(TESTS).sort().forEach(name => {
    if (fs.statSync(path.join(TESTS, name)).isDirectory()) return;   // tests/lib/
    const t = classify(name);
    if (tiers[t]) tiers[t].push(name);
  });
  return tiers;
}

function runOne(name, tier) {
  return new Promise(resolve => {
    const started = Date.now();
    let out = '';
    const child = spawn(process.execPath, [path.join(TESTS, name)], { cwd: path.join(TESTS, '..'), env: process.env });
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); out += '\nrun-all: killed after ' + TIMEOUT_MS[tier] / 1000 + 's'; }, TIMEOUT_MS[tier]);
    child.on('close', code => {
      clearTimeout(timer);
      const lines = out.split('\n').map(l => l.replace(/\s+$/, '')).filter(Boolean);
      const verdict = lines.length ? lines[lines.length - 1] : '(no output)';
      const skipM = verdict.match(/(\d+) SKIPPED/);
      const fails = lines.filter(l => /^\s*FAIL\b/.test(l)).slice(0, 12);
      resolve({ name, tier, code, ms: Date.now() - started, verdict, skipped: skipM ? +skipM[1] : 0, fails, out });
    });
  });
}

async function runPool(items, width) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await runOne(items[i].name, items[i].tier);
      const r = results[i];
      const mark = r.code === 0 ? ' ok ' : 'RED ';
      const secs = (r.ms / 1000).toFixed(1).padStart(6) + 's';
      console.log('  ' + mark + ' ' + r.name.padEnd(34) + secs + '  ' + r.verdict.slice(0, 96));
      if (r.code !== 0) r.fails.forEach(f => console.log('        ' + f.slice(0, 110)));
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const want = { quick: !argv.includes('--browser') || argv.includes('--all'), browser: argv.includes('--browser') || argv.includes('--all') };
  const onlyAt = argv.indexOf('--only');
  const only = onlyAt >= 0 ? argv[onlyAt + 1] : '';
  const width = argv.includes('--serial') ? 1 : 4;
  const tiers = discover();

  if (argv.includes('--list')) {
    Object.keys(tiers).forEach(t => console.log(t + ' (' + tiers[t].length + '):\n  ' + (tiers[t].join('\n  ') || '(none)')));
    return process.exit(tiers.unclassified.length ? 1 : 0);
  }

  let items = [];
  if (want.quick) items = items.concat(tiers.quick.map(name => ({ name, tier: 'quick' })));
  if (want.browser) items = items.concat(tiers.browser.map(name => ({ name, tier: 'browser' })));
  if (only) items = items.filter(i => i.name.includes(only));

  console.log('run-all — ' + items.length + ' suite' + (items.length === 1 ? '' : 's') +
              ' (' + (want.quick ? 'quick' : '') + (want.quick && want.browser ? ' + ' : '') + (want.browser ? 'browser' : '') + (only ? ', only "' + only + '"' : '') +
              '), quick ' + width + ' at a time, browser one at a time\n');
  const t0 = Date.now();
  const quickItems = items.filter(i => i.tier === 'quick');
  const browserItems = items.filter(i => i.tier === 'browser');
  const results = (await runPool(quickItems, width)).concat(await runPool(browserItems, 1));
  const red = results.filter(r => r.code !== 0);
  const skips = results.filter(r => r.skipped > 0);
  const wall = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log(results.length + ' suite' + (results.length === 1 ? '' : 's') + ': ' + (results.length - red.length) + ' green, ' + red.length + ' red' +
              (skips.length ? ', ' + skips.length + ' with skipped pins' : '') + ' — ' + wall + 's wall');
  if (red.length) console.log('RED: ' + red.map(r => r.name).join(', '));
  skips.forEach(r => console.log('skipped in ' + r.name + ': ' + r.verdict.replace(/^.*?(\d+ SKIPPED)/, '$1').slice(0, 160)));
  if (!want.browser && tiers.browser.length && !only) {
    console.log('not run (browser tier — `node tests/run-all.js --browser`): ' + tiers.browser.join(', '));
  }
  if (tiers.audit.length) console.log('audits (reports, run by hand): ' + tiers.audit.join(', '));
  if (tiers.unclassified.length) {
    console.log('\nUNCLASSIFIED — these run NOWHERE. Name them *_tests.js / *-tests.js, or add them to QUICK_EXTRA, BROWSER or AUDITS in tests/run-all.js:');
    tiers.unclassified.forEach(n => console.log('  ' + n));
  }
  process.exit(red.length || tiers.unclassified.length ? 1 : 0);
}

module.exports = { classify, discover, QUICK_EXTRA, BROWSER, AUDITS };
if (require.main === module) main();
