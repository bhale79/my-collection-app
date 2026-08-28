// ═══════════════════════════════════════════════════════════════
// onboarding_gate_tests.js — Session 86. The era-picker Save gate.
//
// Brad, live repro: "you select several and then cant move forward.
// its grayed out. you can select all and move forward." The v1415
// blank-start gate (Save disabled until ≥1 era chosen) was only
// re-synced by the BULK buttons and the screen-open call — the
// individual checkboxes never called onboardEraSync, so hand-picking
// eras left Save disabled for exactly the careful users.
//
// Run:  node tests/onboarding_gate_tests.js
// Proven to FAIL on v0.9.1583 before the fix.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const ob = fs.readFileSync(path.join(__dirname, '..', 'app', 'onboarding.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

ok('THE BUG: every era checkbox re-syncs the gate when toggled BY HAND',
   /data-era="' \+ _escape\(eraKey\)[\s\S]{0,700}onchange="onboardEraSync\(\)"/.test(ob));
ok('the gate itself still exists (Save disabled at zero chosen, v1415)',
   /save\.disabled = off/.test(ob) && /n === 0/.test(ob));
ok('…with the honest tooltip naming the way out',
   /Pick at least one, or use Skip/.test(ob));
ok('the bulk buttons still sync (Select all / Clear all)',
   /onboardEraSelectAll[\s\S]{0,200}onboardEraSync\(\)/.test(ob));
ok('the screen-open sync still runs (detached-DOM timing respected)',
   /setTimeout\(function \(\) \{ try \{ onboardEraSync\(\); \}/.test(ob));
ok('the chosen-count label still reports live',
   /onboarding-era-count/.test(ob) && /of ' \+ boxes\.length \+ ' chosen/.test(ob));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('ONBOARDING-GATE TESTS FAILING'); process.exit(1); }
console.log('ALL ONBOARDING-GATE TESTS GREEN (' + pass + ')');
