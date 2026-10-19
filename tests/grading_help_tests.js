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

// ── v0.9.1551b: reachable from EVERY condition slider ──────────────────
// Brad: "on our add item menu, have a link to our condition help menu" —
// and then, when three of five renderers had it: "i do not see it".
const wiz = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
ok('there is ONE help link, written once', /function _wizCondHelp/.test(wiz));
const scaleLines = (wiz.match(/<span>Poor<\/span><span>Excellent/g) || []).length;
const withHelp = (wiz.match(/<span>Excellent' \+ _wizCondHelp\(\) \+ '<\/span>/g) || []).length;
ok('every condition scale line carries it', scaleLines > 0 && scaleLines === withHelp,
   withHelp + ' of ' + scaleLines + ' scale lines');
// Five renderers until v0.9.1708: the fifth was Quick-Entry Step 1, ~290 lines
// sitting after an unconditional `return` — nobody could reach its slider. The
// silent-control audit (B5) removed it, so four is every renderer a user can see.
ok('...covering all four reachable renderers', withHelp >= 4, withHelp);
ok('no renderer was patched twice', !/rrgOpen&&rrgOpen\('grading'\)/.test(wiz),
   'the one-off links from v1550 were removed when the shared one landed');
ok('clicking it cannot nudge the slider',
   /event\.preventDefault\(\);event\.stopPropagation\(\);if\(window\.rrgOpen\)/.test(wiz));
ok('it stays quiet if the guides module is deleted', /if\(window\.rrgOpen\)rrgOpen/.test(wiz),
   'help-guides.js is designed to be removable in one line');
const helpZ = /z-index:(\d+)/.exec(src.slice(src.indexOf('position:fixed;left:0;right:0;bottom:0')));
ok('the guide renders above the open wizard', helpZ && parseInt(helpZ[1], 10) >= 100000, helpZ ? helpZ[1] : '?');

// ── v0.9.1551: findable, not merely present ────────────────────────────
// v0.9.1987: the row is drawn by openHelpHub itself (tutorial.js), under
// Suggestions next to Photographing — Brad: "leave the other 2 under
// suggestions". It used to be slipped in afterwards by help-guides.js.
const tut = fs.readFileSync(path.join(__dirname, '..', 'app', 'tutorial.js'), 'utf8');
const hub = tut.slice(tut.indexOf('function openHelpHub('), tut.indexOf('window.openHelpHub = openHelpHub;'));
const sugg = hub.slice(hub.indexOf("hdr('Suggestions')"), hub.indexOf("hdr('More')"));
ok('grading has its own row in the Help Center, under Suggestions',
   sugg.length > 0 && /rrgOpen\('grading'\)/.test(sugg));
ok('...titled so it can be recognised', /Condition grading \(the C-scale\)/.test(sugg));
ok('...with a subtitle that says what is inside', /C-1 to C-10 explained/.test(sugg));
ok('...and it closes the hub before opening, like every other row',
   /row\(X \+ "if\(typeof rrgOpen==='function'\)rrgOpen\('grading'\);"/.test(sugg));
ok('...listed exactly once', (hub.match(/rrgOpen\('grading'\)/g) || []).length === 1);
ok('help-guides.js no longer reaches into the Help Center (no wrapper, no polling)',
   !/openHelpHub/.test(src.replace(/\/\/[^\n]*/g, '')) && !/setInterval/.test(src));
ok('the Step-by-step guides index is gone (Brad: "get rid of the step by step guides")',
   !/rrgIndex|Step-by-step guides/.test(src.replace(/\/\/[^\n]*/g, '')) && !/Step-by-step/.test(hub));
ok('...and grading is the only guide left in it',
   (src.match(/^    [a-zA-Z]+: \{$/gm) || []).join(',') === '    grading: {',
   (src.match(/^    [a-zA-Z]+: \{$/gm) || []).join(','));

console.log('');
console.log(fail === 0 ? 'ALL GRADING-HELP TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
