// ═══════════════════════════════════════════════════════════════
// report_format_tests.js — Session 82.
//
// Brad, looking at a 113-page PDF of Scott's collection: "we need to work on
// format so that we don't get a jumbled mess in some columns like
// description."
//
// It was not merely cramped. Every column got an equal share of the page —
// Description the same 72pt as "Box" — and the row height was a FIXED 18pt
// however many lines a cell wrapped to. Measured on his own rows: they
// needed 47-68pt. The extra lines were drawn over the next row.
//
// Run:  node tests/report_format_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const exp = fs.readFileSync(path.join(__dirname, '..', 'app', 'report-export.js'), 'utf8');
const rep = fs.readFileSync(path.join(__dirname, '..', 'app', 'reports.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── the overlap, which is the actual bug ───────────────────────
ok('a row is as tall as its tallest cell', /var h = lines \* LH \+ PAD;/.test(exp));
ok('...and the fixed 18pt row height is gone', !/y \+= 18;\s*\n\s*}\s*\n\s*if \(heads\.length\)/.test(exp));
ok('the page break uses the row’s REAL height', /if \(y \+ h > pageH - 30\)/.test(exp),
   'checking against a fixed height is what let rows run off the page');
ok('the header repeats on every page', /doc\.addPage\(\); y = 40; drawHeader\(\);/.test(exp));
ok('rows are separated by a rule', /doc\.line\(M, y - 3, pageW - M, y - 3\)/.test(exp),
   'so a two-line description cannot be read as two items');

// ── widths that match the content ──────────────────────────────
ok('columns are weighted, not equal', /var WEIGHT = \{ description: 4/.test(exp));
ok('...description gets the most', /description: 4/.test(exp) && /condition: 0\.8/.test(exp));
ok('an unknown column is sized by what is in it', /longest \/ 14/.test(exp));
ok('empty columns are dropped', /var keep = heads\.map\(function \(_, i\)/.test(exp));
ok('...and the reader is told they were', /left out of this report/.test(exp));
ok('a report where everything is empty still prints', /if \(keep\.indexOf\(true\) < 0\)/.test(exp),
   'dropping every column would produce a blank page');

// ── the stutter Brad spotted ───────────────────────────────────
global.window = {};
const i = rep.indexOf('function _repCleanDesc');
let d = 0, j = rep.indexOf('{', i);
for (let k = j; k < rep.length; k++) {
  if (rep[k] === '{') d++;
  else if (rep[k] === '}') { d--; if (!d) { eval(rep.slice(i, k + 1)); break; } }
}
const is = (desc, num, want) => ok('"' + desc.slice(0, 34) + '" → "' + want.slice(0, 30) + '"',
                                   _repCleanDesc(desc, num) === want, _repCleanDesc(desc, num));
is('6-22477 Lionel Tin Sign Replica 4pk', '6-22477', 'Lionel Tin Sign Replica 4pk');
is('22477 Lionel Tin Sign', '6-22477', 'Lionel Tin Sign');
is('6-24164 — Summer Vacation', '6-24164', 'Summer Vacation');
is('Summer Vacation', '6-24164', 'Summer Vacation');
// A number that BELONGS to the description is not a stutter.
is('6464-1970 uncataloged boxcar', '6-19212', '6464-1970 uncataloged boxcar');
// Never leave a cell empty by stripping the only thing in it.
is('6-24164', '6-24164', '6-24164');
ok('every report path uses it',
   (rep.match(/_repCleanDesc\(/g) || []).length >= 4,
   'the on-screen table, the report builder, and the CSV');

// ── v0.9.1553: Collection Value counts everything you own ──────────────
// Brad checked the dashboard against three other sources: sheet $377,658,
// imported data $379,438, his own PDF $379,436 — and the card said $345,008.
const dash = fs.readFileSync(path.join(__dirname, '..', 'app', 'dashboard.js'), 'utf8');
const valCard = dash.slice(dash.indexOf("id: 'value'"), dash.indexOf("id: 'catalog'"));
// Strip comments before asserting — the fix's own note quotes the old code,
// and matching a comment is not testing behaviour. (Caught this exact trap
// twice today.)
const code = t => t.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
ok('the value card no longer filters by collecting preferences',
   !/\.filter\(_pdEraEnabled\)/.test(code(valCard)),
   'an unticked maker was removing owned items from the total');
ok('...it still counts only what you OWN', /filter\(function\(pd\)\{return pd\.owned;\}\)/.test(valCard));
ok('the reason is recorded with the numbers that proved it', /345,008/.test(valCard));
// The owned card must not filter either, or the two disagree again.
const ownCard = dash.slice(dash.indexOf("id: 'owned'"), dash.indexOf("id: 'value'"));
ok('Items I Own does not filter by preferences either',
   !/_pdEraEnabled/.test(code(ownCard)),
   'the two cards have to answer the same question');
// Other cards may still narrow to what you collect — that is their job.
ok('cards that are ABOUT what you collect still narrow',
   /id: 'topRoads'[\s\S]{0,400}_pdEraEnabled/.test(dash),
   'Top Road Names is a view of the catalogue you follow, not a total of your worth');

console.log('');
console.log(fail === 0 ? 'ALL REPORT-FORMAT TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
