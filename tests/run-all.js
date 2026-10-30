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
//   node tests/run-all.js --all --receipt ../ship_x.receipt.json
//                                      also write a TEST RECEIPT (2026-10-28, below)
//   node tests/run-all.js --serial     one at a time (the quick tier runs 4 abreast;
//                                      the browser tier is always one at a time)
//   node tests/run-all.js --fast       THE RELEASE GATE (2026-10-19): the quick tier
//                                      WITHOUT the suites that open a real browser
//                                      (~170 suites, about a minute). Add the
//                                      browser suites for the screen you touched:
//   node tests/run-all.js --fast --with report_builder,custom_columns
//                                      (--with takes name pieces, comma-separated)
//   The full run (no --fast) and the --browser tier run EVERY NIGHT as a
//   scheduled task — see rules_testing "the overnight run".
//
// Brad, 2026-10-19: "its still too slow, its really holding me up" → "yes" to:
// before a release only the fast tier + the new test + the touched screen's
// browser suites; everything else overnight, with a phone/email alert on red.
// A suite is "browser" for --fast when its own source loads a whole page —
// playwright (real Chromium) or jsdom (photo-inbox-tests' 3,900 pins, 80+ s) —
// read from the file, so there is no list to keep in step.
//
// Tiers (by file name — the only rule to remember):
//   quick    *_tests.js and *-tests.js, plus the named checks in QUICK_EXTRA
//   browser  guide-*.js, photo-viewer.js, sw-nav-cache.js — real Chromium,
//            minutes to an hour (guide-buttons and guide-chaos walk every
//            step of every guide four ways); run them when guides, the
//            wizard's photo viewer, or app/sw.js change
//   audits   button-audit / phone-audit / silent-audit / press-audit /
//            update-color-budget — reports, never gates; run by hand
// Anything else in tests/ (except tests/lib/) is UNCLASSIFIED and turns the
// run red until it is given a home — a test that runs nowhere is the bug this
// file exists to prevent.
//
// A suite is green when it exits 0. Its last line of output is its verdict and
// is shown on the scoreboard; a verdict containing "N SKIPPED" is counted so a
// skipped section is visible, not silent (import_core_tests.js skips its 18
// fixture pins when Scott's workbook is not on the machine).
//
// A red suite shows its FAIL lines under its row. A red suite with NO FAIL line
// — an uncaught throw, a timeout kill — used to show only its verdict, and a
// crash's verdict is "Node.js v22.22.0", which says nothing (2026-10-03:
// crop_preview_tests died once under four-abreast load and that was the whole
// record). Such a suite now shows the five lines before its verdict, stack
// frames dropped, so the crash reads from the scoreboard.
// TEST RECEIPT (2026-10-28, Brad: "set up rules ... ensure we test ... make
// sure we don't screw up anyones app" -> "okay"). --receipt <path> writes one
// JSON file: the sha256 of every file under app/ and tests/ AS IT WAS TESTED
// (taken before the first suite starts and checked again after the last one —
// a file that changed during the run voids the receipt), which tier ran, the
// reds, and the CORE list from tests/lib/core-files.json. ship.py
// (receipt_guard.py on Brad's PC) refuses to ship a staged app/ or tests/
// file whose bytes are not in a PASSING receipt, and refuses a release that
// touches a CORE file unless the receipt's tier is "full+browser"
// (node tests/run-all.js --all). Nothing untested, or changed after testing,
// can go out.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

const TESTS = __dirname;

const QUICK_EXTRA = ['syntax-check.js', 'color-count.js', 'no-drill-residue.js', 'lookup_canary.js',
                     'layout-check.js', 'help-hub.js', 'help-surfaces.js'];
const BROWSER = ['photo-viewer.js', 'sw-nav-cache.js'];           // plus guide-*.js
const AUDITS = ['button-audit.js', 'phone-audit.js', 'silent-audit.js', 'press-audit.js', 'update-color-budget.js'];
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

// Does a suite load a whole page (real Chromium or jsdom)? Read from the suite
// itself (2026-10-19).
function usesBrowser(name) {
  try { return /playwright|jsdom/.test(fs.readFileSync(path.join(TESTS, name), 'utf8')); } catch (e) { return false; }
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

// ── the receipt's fingerprints ───────────────────────────────────────────
const ROOT = path.join(TESTS, '..');
function coreList() {
  try { return JSON.parse(fs.readFileSync(path.join(TESTS, 'lib', 'core-files.json'), 'utf8')); }
  catch (e) { return { core: [], mutable: [] }; }
}
function fingerprint() {
  const skip = new Set(coreList().mutable || []);
  const out = {};
  function walk(rel) {
    fs.readdirSync(path.join(ROOT, rel)).sort().forEach(n => {
      if (n === 'node_modules' || n === '.git') return;
      const r = rel + '/' + n;
      const full = path.join(ROOT, r);
      if (fs.statSync(full).isDirectory()) return walk(r);
      if (skip.has(r)) return;
      out[r] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    });
  }
  walk('app');
  walk('tests');
  return out;
}
function receiptTier(o) {
  if (o.fast) return 'fast';
  if (o.only) return 'partial';
  if (o.quick && o.browser) return 'full+browser';
  if (o.quick) return 'full';
  return 'partial';
}
function writeReceipt(file, o) {
  let head = '';
  try { head = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) {}
  let version = '';
  try { const m = fs.readFileSync(path.join(ROOT, 'app', 'config.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/); version = m ? m[1] : ''; } catch (e) {}
  const changed = Object.keys(Object.assign({}, o.before, o.after)).filter(k => o.before[k] !== o.after[k]).sort();
  const cl = coreList();
  const receipt = {
    kind: 'rail-roster-test-receipt', format: 1,
    made: new Date().toISOString(), head, version,
    tier: receiptTier(o),
    passed: o.red.length === 0 && o.unclassified === 0 && changed.length === 0,
    suites: o.results.length, green: o.results.length - o.red.length,
    red: o.red.map(r => r.name), unclassified: o.unclassified,
    changed_during_run: changed,
    core_files: cl.core || [], mutable: cl.mutable || [],
    files: o.before
  };
  fs.writeFileSync(file, JSON.stringify(receipt, null, 1) + '\n');
  console.log('receipt: ' + file + ' — tier ' + receipt.tier + ', ' + (receipt.passed ? 'PASSED' : 'NOT passed') +
              (changed.length ? ' (files changed DURING the run: ' + changed.slice(0, 5).join(', ') + ')' : '') +
              ', ' + Object.keys(o.before).length + ' files fingerprinted');
  return receipt;
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
      // The five lines before the verdict, stack frames ("    at …") dropped and
      // the repo root trimmed off paths — shown for a red suite that has no FAIL
      // line, so a crash or a kill is readable from the board instead of
      // leaving "Node.js v22.22.0" behind.
      const root = path.join(TESTS, '..') + path.sep;
      const tail = lines.slice(0, -1).filter(l => !/^\s+at\s/.test(l)).slice(-5).map(l => l.split(root).join(''));
      resolve({ name, tier, code, ms: Date.now() - started, verdict, skipped: skipM ? +skipM[1] : 0, fails, tail, out });
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
      if (r.code !== 0) {
        if (r.fails.length) r.fails.forEach(f => console.log('        ' + f.slice(0, 110)));
        else if (r.tail.length) {
          console.log('        no FAIL line — the last lines before the verdict:');
          r.tail.forEach(l => console.log('        | ' + l.slice(0, 110)));
        }
      }
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
  // --fast: leave out the quick-tier suites that open a real browser, except
  // the ones --with names (the screen this release touched).
  const fast = argv.includes('--fast');
  const withAt = argv.indexOf('--with');
  const withs = withAt >= 0 ? String(argv[withAt + 1] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  let leftForNight = [];
  if (fast) {
    const keep = [];
    items.forEach(i => {
      if (i.tier === 'quick' && usesBrowser(i.name) && !withs.some(w => i.name.includes(w))) leftForNight.push(i.name);
      else keep.push(i);
    });
    items = keep;
  }

  console.log('run-all — ' + items.length + ' suite' + (items.length === 1 ? '' : 's') +
              ' (' + (want.quick ? (fast ? 'fast' : 'quick') : '') + (want.quick && want.browser ? ' + ' : '') + (want.browser ? 'browser' : '') + (only ? ', only "' + only + '"' : '') + (withs.length ? ', with ' + withs.join(',') : '') +
              '), quick ' + width + ' at a time, browser one at a time\n');
  const receiptAt = argv.indexOf('--receipt');
  const receiptFile = receiptAt >= 0 ? path.resolve(String(argv[receiptAt + 1] || '')) : '';
  const before = receiptFile ? fingerprint() : null;
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
  if (fast && leftForNight.length) console.log('left for the overnight run (whole-page suites, --fast): ' + leftForNight.length);
  if (!want.browser && tiers.browser.length && !only) {
    console.log('not run (browser tier — `node tests/run-all.js --browser`): ' + tiers.browser.join(', '));
  }
  if (tiers.audit.length) console.log('audits (reports, run by hand): ' + tiers.audit.join(', '));
  if (tiers.unclassified.length) {
    console.log('\nUNCLASSIFIED — these run NOWHERE. Name them *_tests.js / *-tests.js, or add them to QUICK_EXTRA, BROWSER or AUDITS in tests/run-all.js:');
    tiers.unclassified.forEach(n => console.log('  ' + n));
  }
  if (receiptFile) {
    writeReceipt(receiptFile, { before, after: fingerprint(), results, red, unclassified: tiers.unclassified.length,
                                fast, only, quick: want.quick, browser: want.browser });
  }
  process.exit(red.length || tiers.unclassified.length ? 1 : 0);
}

module.exports = { classify, discover, usesBrowser, QUICK_EXTRA, BROWSER, AUDITS, fingerprint, receiptTier, writeReceipt, coreList };
if (require.main === module) main();
