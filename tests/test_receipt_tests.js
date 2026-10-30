// tests/test_receipt_tests.js — the TEST RECEIPT that run-all writes and
// ship.py checks (2026-10-28, Release 0 of BUILD_PLAN_2026-10-28_TRR_PRO.md).
//
// Brad: "set up rules ... ensure we test ... make sure we don't screw up
// anyones app" -> "okay". The receipt is what makes "nothing untested ships"
// a check instead of a promise: it holds the sha256 of every app/ and tests/
// file AS TESTED. These checks prove it can say NO — a red, a file changed
// during the run, and a fast-tier run are each caught (planted offenders).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RA = require('./run-all.js');

let P = 0, F = 0;
function ok(name, cond) { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); cond ? P++ : F++; }

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-receipt-'));

// 1. the core list is ONE readable file, every name in it exists, the trio is not in it
const cl = RA.coreList();
ok('core-files.json reads and lists files', Array.isArray(cl.core) && cl.core.length >= 5);
ok('every core file exists in app/', cl.core.every(f => fs.existsSync(path.join(ROOT, f))));
ok('the version trio is NOT core (every release bumps it)', !cl.core.some(f => /app\/(config\.js|sw\.js|index\.html)$/.test(f)));
ok('the colour budget is listed as mutable (color-count rewrites it)', (cl.mutable || []).includes('tests/color-budget.json'));

// 2. fingerprints: app/ and tests/, mutable left out, nothing from node_modules
const fp = RA.fingerprint();
const keys = Object.keys(fp);
ok('fingerprints cover app/ and tests/', keys.some(k => k.startsWith('app/')) && keys.some(k => k.startsWith('tests/')));
ok('a fingerprint is a 64-hex sha256', /^[0-9a-f]{64}$/.test(fp['app/config.js'] || ''));
ok('the mutable colour budget is left out', !('tests/color-budget.json' in fp));
ok('nothing from node_modules', !keys.some(k => k.includes('node_modules')));

// 3. tiers
ok('--fast is tier "fast"', RA.receiptTier({ fast: true, quick: true }) === 'fast');
ok('--only is tier "partial"', RA.receiptTier({ only: 'x', quick: true }) === 'partial');
ok('the quick tier alone is "full"', RA.receiptTier({ quick: true }) === 'full');
ok('--all is "full+browser"', RA.receiptTier({ quick: true, browser: true }) === 'full+browser');
ok('the browser tier alone is "partial"', RA.receiptTier({ browser: true }) === 'partial');

// 4. writeReceipt — passes only when green AND nothing changed during the run
const quiet = console.log; console.log = () => {};
const good = RA.writeReceipt(path.join(tmp, 'good.json'), { before: fp, after: fp, results: [{ name: 'a' }], red: [], unclassified: 0, quick: true, browser: true });
const planted1 = RA.writeReceipt(path.join(tmp, 'red.json'), { before: fp, after: fp, results: [{ name: 'a' }], red: [{ name: 'a' }], unclassified: 0, quick: true, browser: true });
const after2 = Object.assign({}, fp, { 'app/config.js': '0'.repeat(64) });
const planted2 = RA.writeReceipt(path.join(tmp, 'changed.json'), { before: fp, after: after2, results: [{ name: 'a' }], red: [], unclassified: 0, quick: true, browser: true });
const planted3 = RA.writeReceipt(path.join(tmp, 'uncl.json'), { before: fp, after: fp, results: [{ name: 'a' }], red: [], unclassified: 1, quick: true });
console.log = quiet;
ok('a green run with nothing changed PASSES', good.passed === true && good.tier === 'full+browser');
ok('PLANTED: a red suite voids the receipt', planted1.passed === false && planted1.red[0] === 'a');
ok('PLANTED: a file changed during the run voids the receipt, and is named', planted2.passed === false && planted2.changed_during_run.includes('app/config.js'));
ok('PLANTED: an unclassified test file voids the receipt', planted3.passed === false);
const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, 'good.json'), 'utf8'));
ok('the receipt on disk carries kind, version, head, the core list and every fingerprint',
   onDisk.kind === 'rail-roster-test-receipt' && /^v0\.9\.\d+$/.test(onDisk.version) &&
   Array.isArray(onDisk.core_files) && onDisk.core_files.length === cl.core.length &&
   Object.keys(onDisk.files).length === keys.length);

// 5. the real runner writes it end to end (one tiny suite)
const out = path.join(tmp, 'real.json');
const r = spawnSync(process.execPath, [path.join(__dirname, 'run-all.js'), '--only', 'lookup_canary', '--receipt', out], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
ok('run-all --receipt exits 0 on a green suite', r.status === 0);
let real = null; try { real = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) {}
ok('run-all --receipt writes a receipt that passed, tier partial', !!real && real.passed === true && real.tier === 'partial' && real.suites === 1);
ok('run-all prints where the receipt went', /receipt: .*real\.json/.test(r.stdout || ''));

console.log('\n' + (F ? 'FAILED' : 'ALL PASS') + '  —  ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
