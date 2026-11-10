#!/usr/bin/env node
// SETFIX — 2026-11-08 · removing a set: planted offenders P9–P16.
// Real Chromium through playwright, the REAL app. Everything — the scenarios,
// the checks, the planted offenders and the story — lives in ONE place,
// tests/lib/setfix_lib.js; the suite is split in six files only so each one
// finishes inside run-all's 180 s limit for a quick suite.
require('./lib/setfix_lib.js').runSection('removeplants_a', 'setfix_remove_plants_a_tests')
  .catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
