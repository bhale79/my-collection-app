// ══ tests/lib/version-trio.js — the trio, checked WITHOUT naming the version ══
//
// Written v0.9.1784. Three suites carried this block, each with the version
// number typed into an ESCAPED regex:
//
//     ok('APP_VERSION v0.9.1783', /const APP_VERSION = 'v0\.9\.1783';/.test(cfg));
//     ok('CACHE_NAME is the version + 10', /const CACHE_NAME = 'mca-v1793';/.test(sw));
//     ok('index.html stamps every asset at 1783 and none at 1782', ...79...);
//
// So EVERY release had to hand-edit three test files that have nothing to do
// with what changed — ten releases in a row, all three, every time. Worse, the
// escaped dots are easy to half-update: replacing the plain string "v0.9.1783"
// fixes the visible label and leaves the regex still testing the OLD number,
// and the suite then fails naming the NEW version. That cost time twice in one
// hour on v0.9.1769.
//
// The version is not a fact a test should know. It is a fact the APP states,
// once, in config.js. Everything else is DERIVED from it here:
//
//   CACHE_NAME  must be 'mca-v' + (N + 10)
//   index.html  every ?v= stamp must equal N — not "none at N-1", which only
//               ever caught the version immediately before and let a stamp
//               stranded at 1502 sail through
//   index.html  every local .js/.css it loads must CARRY a stamp, which the
//               old count of 79 could not check: an unstamped new script has
//               no ?v= at all, so it never showed up in that count
//
// A version bump now touches app/config.js, app/sw.js and app/index.html. No
// test file. And the checks got stronger, not weaker.
'use strict';
const fs = require('fs');
const path = require('path');

const APPDIR = path.join(__dirname, '..', '..', 'app');
const rd = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');

// Read the ONE declared version. Everything below is derived from it.
function trioFacts(src) {
  const cfg = (src && src.cfg) || rd('config.js');
  const sw  = (src && src.sw)  || rd('sw.js');
  const ix  = (src && src.ix)  || rd('index.html');

  const mV = /const APP_VERSION = '(v0\.9\.(\d+))';/.exec(cfg);
  const mC = /const CACHE_NAME = '(mca-v(\d+))';/.exec(sw);

  const stamps = ix.match(/\?v=(\d+)/g) || [];
  const distinct = Array.from(new Set(stamps.map(s => s.slice(3))));

  // every local .js / .css index.html pulls in, stamped or not
  const assets = [];
  const rx = /(?:src|href)="(?!https?:|\/\/)([^"?#]+\.(?:js|css))(\?v=(\d+))?"/g;
  let m;
  while ((m = rx.exec(ix))) assets.push({ file: m[1], stamped: !!m[2], at: m[3] || null });

  return {
    version: mV && mV[1],
    n: mV ? parseInt(mV[2], 10) : null,
    cacheName: mC && mC[1],
    cacheN: mC ? parseInt(mC[2], 10) : null,
    stampCount: stamps.length,
    distinctStamps: distinct,
    assets,
    unstamped: assets.filter(a => !a.stamped).map(a => a.file),
  };
}

// `ok` is the caller's own assert, so a failure reads in that suite's voice.
function checkTrio(ok, src) {
  const t = trioFacts(src);

  ok('config.js declares ONE version, and it is the only place it is typed',
     !!t.version, String(t.version));
  ok('sw.js CACHE_NAME is that version + 10 — derived, never typed here',
     t.cacheN === t.n + 10, t.cacheName + ' vs mca-v' + (t.n + 10));
  ok('index.html stamps every asset at the SAME version as config.js',
     t.distinctStamps.length === 1 && t.distinctStamps[0] === String(t.n),
     'stamps found: ' + t.distinctStamps.join(', '));
  ok('…and every local .js/.css it loads actually carries a stamp',
     t.unstamped.length === 0, t.unstamped.join(', '));
  ok('…on a real number of assets, so an emptied index.html cannot pass',
     t.stampCount >= 50, String(t.stampCount));

  return t;
}

module.exports = { trioFacts, checkTrio };
