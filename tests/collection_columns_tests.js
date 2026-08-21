// ═══════════════════════════════════════════════════════════════
// collection_columns_tests.js — Session 82.
//
// Brad: "i check location and location detail, and neither column showed up."
// They did show up — underneath the Actions column. Every width in the
// collection table was written as nth-child(1..7), from when the table always
// had exactly seven columns. The column picker made that count variable, so
// the moment a column was added, "column 7" was no longer Actions: the real
// Actions cell lost its width and the text overlapped.
//
// Run:  node tests/collection_columns_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'app', 'browse.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── the bug itself ──────────────────────────────────────────────
ok('no width in the collection table is keyed to a column POSITION',
   !/item-table\.collection-view (th|td):nth-child/.test(css),
   'nth-child widths are what broke when the column count became variable');
ok('widths follow the column id instead', /collection-view th\[data-col="num"\]/.test(css));
ok('Actions keeps a real width of its own', /th\[data-col="actions"\][\s\S]{0,120}min-width: 250px/.test(css));
ok('an added column can never be squeezed to nothing',
   /th\[data-col\],[\s\S]{0,120}min-width: 90px/.test(css));
ok('the table may be wider than the panel now', /collection-view \{ table-layout: auto/.test(css));
// (Other pages still use nth-child legitimately — they have fixed columns.
// This only asserts it for the collection table, which does not.)
ok('the phone rule also stopped counting columns',
   !/collection-view (th|td):nth-child\(7\)/.test(css) &&
   /@media \(max-width: 760px\)[\s\S]{0,220}collection-view th\[data-col="actions"\]/.test(css));

// ── every cell carries its id, or the widths hit nothing ───────
['mfr', 'num', 'var', 'type', 'photo', 'desc', 'worth', 'added', 'actions'].forEach(function (id) {
  ok('the ' + id + ' cell is tagged with its column', js.indexOf('data-col="' + id + '"') > 0);
});
ok('user-chosen columns are tagged too', /_cells\[xc\.col\] = '<td data-col="' \+ xc\.col/.test(js));

// ── the scrollbar Brad asked to be able to see ─────────────────
ok('the horizontal scrollbar is visible, not hairline',
   /browse-table-wrap::-webkit-scrollbar \{ height: 14px/.test(css));
ok('...and coloured so it can be found', /browse-table-wrap::-webkit-scrollbar-thumb \{\s*background: var\(--accent\)/.test(css));
ok('...including on Firefox', /browse-table-wrap \{ scrollbar-color:/.test(css));

// ── edit mode on the header itself ─────────────────────────────
ok('the header has an edit mode', /function _collColEdit/.test(js));
ok('a heading can be removed from the header', /function _collDropCol/.test(js));
ok('headings can be dragged to reorder', /function _collWireHeaderDrag/.test(js));
ok('...and dropping one saves the new order', /_collSetOrder\(order\);/.test(js));
ok('there is an Add menu for columns not on the table', /function _collAddColMenu/.test(js));
ok('...listing only what is missing', /vis\.indexOf\(c\.col\) < 0 && _COLL_LOCKED\.indexOf\(c\.col\) < 0/.test(js));
ok('Maker and Item # cannot be dragged or removed',
   /th\.coll-th-edit:not\(\.locked\)/.test(js) && /locked \? 'false' : 'true'/.test(js));
ok('the old Columns button now opens the same edit mode', /_collColEdit\(!state\._collColEdit\)/.test(js));

console.log('');
console.log(fail === 0 ? 'ALL COLUMN TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
