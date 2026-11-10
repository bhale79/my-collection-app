#!/usr/bin/env node
// SETFIX — 2026-11-08 · the set walk’s planted offenders, first half (P1–P8 and the old code itself, P1/P1b).
// Real Chromium through playwright, the REAL app. Everything — the scenarios,
// the checks, the planted offenders and the story — lives in ONE place,
// tests/lib/setfix_lib.js; the suite is split in six files only so each one
// finishes inside run-all's 180 s limit for a quick suite.
require('./lib/setfix_lib.js').runSection('walkplants_a', 'setfix_walk_plants_a_tests')
  .catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
