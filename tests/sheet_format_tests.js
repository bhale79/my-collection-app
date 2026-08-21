// ═══════════════════════════════════════════════════════════════
// sheet_format_tests.js — Session 82.
//
// Brad, looking at his own Google Sheet: "why is the text in the actual
// google sheet white?" Every data row was white text on a pale banded
// background — invisible on one band, barely legible on the other.
//
// CAUSE: the formatter styled row 1 and row 2 and then banded rows 3+, but
// gave the data body no text colour. Google Sheets copies the format of the
// row above when rows are appended, and the row above the first data row is
// the WHITE-on-navy header band. Every row inherited white from there.
//
// Run:  node tests/sheet_format_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'sheet-builder.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

ok('the palette names a body text colour', /ink:\s*\{ red: 0\.063/.test(src));

// The body rule: from row 3, no end row, text format only.
const rule = /\{ repeatCell: \{\s*range: \{ sheetId: sid, startRowIndex: 2 \},[\s\S]{0,400}?fields: 'userEnteredFormat\(backgroundColor,textFormat\)'/;
ok('the data body is given its own text colour', rule.test(src));
const m = rule.exec(src) || [''];
ok('...using the ink colour, not white', /foregroundColor: SB\.ink/.test(m[0]), m[0] ? 'ok' : 'rule missing');
ok('...not bold', /bold: false/.test(m[0]));
ok('...with NO end row, so unwritten rows are covered too',
   m[0].indexOf('endRowIndex') < 0, 'an end row would leave the next append inheriting white again');
ok('...and it touches only colour, never number formats',
   /fields: 'userEnteredFormat\(backgroundColor,textFormat\)'/.test(m[0]),
   'a wider mask would wipe currency and date formats');

// The header band must KEEP its white text — that part was never wrong.
ok('the column header band still has white text',
   /backgroundColor: SB\.navyMid,\s*textFormat: \{ bold: true, foregroundColor: SB\.white/.test(src));
// And the body rule has to come before banding is added, so the banded
// backgrounds are not clobbered by a later blanket format.
ok('the body colour is applied before the banding request',
   src.indexOf("fields: 'userEnteredFormat(backgroundColor,textFormat)'") < src.indexOf('addBanding'),
   'banding must be added AFTER the flat background, or the stripes get flattened');

// v0.9.1535: an existing sheet has to repair ITSELF. Brad: "what about the
// beta tester sheets — when will they get updated if they are already
// created?" Before this, only Sync-from-Sheet or a Preferences button ran the
// formatter, so a tester who pressed neither kept white text forever.
const data = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
const ver = /SHEET_FORMAT_VER = (\d+)/.exec(src);
ok('the format version was bumped', ver && parseInt(ver[1], 10) >= 22, ver ? ver[1] : 'not found');
ok('startup checks the sheet format', /applySheetFormatting\(state\.personalSheetId\)/.test(data));
ok('...on BOTH load paths (all-eras and single era)',
   (data.match(/startup format check/g) || []).length === 2,
   (data.match(/startup format check/g) || []).length + ' call sites');
ok('...in the background, never blocking the app',
   /setTimeout\(function \(\) \{\s*applySheetFormatting/.test(data));
ok('...and a failure is logged, not thrown at the user',
   /catch\(function \(e\) \{ console\.warn\('\[startup format check\]'/.test(data));

// v0.9.1535b: the banding stopped at row 1000, so an imported collection had
// TWO different backgrounds — pale to row 1000, the sheet's dark default
// below it. One text colour cannot serve both, which is why the first fix
// only worked at one end of Brad's sheet.
ok('the banding covers every row the tab actually has',
   /endRowIndex: Math\.max\(1000, tabRows\[tab\] \|\| 1000\)/.test(src));
ok('row counts are read from the sheet metadata', /tabRows\[s\.properties\.title\]/.test(src));
ok('the body sets a background as well as a text colour',
   /backgroundColor: SB\.white,\s*textFormat: \{ bold: false, foregroundColor: SB\.ink/.test(src));
ok('...and says so in the fields mask',
   /fields: 'userEnteredFormat\(backgroundColor,textFormat\)'/.test(src));

console.log('');
console.log(fail === 0 ? 'ALL SHEET-FORMAT TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
