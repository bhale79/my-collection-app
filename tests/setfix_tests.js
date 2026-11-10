#!/usr/bin/env node
// SETFIX — 2026-11-08 · the set walk (items 4 + the cancel): W1–W15 through the real app, and the source checks S1–S6 with their planted texts.
// Real Chromium through playwright, the REAL app. Everything — the scenarios,
// the checks, the planted offenders and the story — lives in ONE place,
// tests/lib/setfix_lib.js; the suite is split in six files only so each one
// finishes inside run-all's 180 s limit for a quick suite.
require('./lib/setfix_lib.js').runSection('walk', 'setfix_tests')
  .catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
