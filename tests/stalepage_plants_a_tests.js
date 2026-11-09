#!/usr/bin/env node
// STALEPAGE — 2026-11-08 · the planted offenders, first half (P1–P13).
// Real Chromium through playwright, the REAL app. Everything — the scenarios,
// the checks, the planted offenders and the story — lives in ONE place,
// tests/lib/stalepage_lib.js; the suite is split in four files (2026-11-09,
// stalesplit) only so each one finishes well inside run-all's 180 s limit for
// a quick suite. Run:  node tests/run-all.js --only stalepage
'use strict';
require('./lib/stalepage_lib.js').runSection('plants_a', 'stalepage_plants_a_tests')
  .catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
