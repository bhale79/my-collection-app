// ═══════════════════════════════════════════════════════════════
// grading_help_tests.js — Session 82.
//
// Brad: "we need to have the tca grading scale in our help menu." The
// C-scale is the common language of the hobby — every ad and price guide
// assumes it — and the app never explained it anywhere.
//
// Run:  node tests/grading_help_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'help-guides.js'), 'utf8');
const core = require('../app/import-core.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

ok('the guide exists', /grading: \{/.test(src));
ok('...and is findable by name', /Condition grading — the C-scale collectors use/.test(src));
['C-10 Mint', 'C-9 Factory New', 'C-8 Like New', 'C-7 Excellent', 'C-6 Very Good',
 'C-5 Good', 'C-4 Fair', 'C-3 Poor', 'C-2 Restoration required'].forEach(function (g) {
  ok('covers ' + g, src.indexOf(g) > 0);
});
ok('C-1 is covered too', /C-1<\/b> Junk|C-1<\/b>|C-1 Junk/.test(src));

// Honesty about our own scale — the whole reason this guide matters.
ok('it admits our slider runs a notch kinder in the middle',
   /one notch kinder/.test(src),
   'a private scale that is ALMOST the standard is the dangerous kind');
ok('it tells a TCA grader what to do about that', /set the number to match the TCA grade/.test(src));
ok('it explains the P- grade on boxes', /P-6/.test(src) && /packaging/.test(src));
ok('it points importers at the conversion table', /conversion table/.test(src));

// Copyright: our words, credited — the same rule as the reference books.
ok('the wording is credited as ours, summarising theirs', /The wording above is ours, summarising theirs/.test(src));
ok('...and says so up front too', /not their wording/.test(src));

// The import must agree with what the guide claims about word-reading.
ok('the import really does read those words',
   core.rrImpGuessCondition('Excellent') !== '' && core.rrImpGuessCondition('Like New') !== '' &&
   core.rrImpGuessCondition('Fair') !== '');

console.log('');
console.log(fail === 0 ? 'ALL GRADING-HELP TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
