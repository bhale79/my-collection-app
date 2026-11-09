#!/usr/bin/env node
// STALEPAGE — 2026-11-08 · B5–B8 (background lookups, other collections, refused Removes), C1–C4 (the other boxes) and the source checks S1–S8.
// Real Chromium through playwright, the REAL app. Everything — the scenarios,
// the checks, the planted offenders and the story — lives in ONE place,
// tests/lib/stalepage_lib.js; the suite is split in four files (2026-11-09,
// stalesplit) only so each one finishes well inside run-all's 180 s limit for
// a quick suite. Run:  node tests/run-all.js --only stalepage
'use strict';
require('./lib/stalepage_lib.js').runSection('more', 'stalepage_more_tests')
  .catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
