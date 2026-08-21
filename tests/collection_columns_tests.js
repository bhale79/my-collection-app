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
// v0.9.1544 moved these onto the PINNED bar — the wrap's own bar is hidden,
// because it sits at the bottom of a 3,370-row table where nobody can reach it.
ok('the horizontal scrollbar is visible, not hairline',
   /#rr-hscroll::-webkit-scrollbar \{ height: 14px/.test(css));
ok('...and coloured so it can be found',
   /#rr-hscroll::-webkit-scrollbar-thumb \{ background: var\(--accent\)/.test(css));
ok('...including on Firefox', /#rr-hscroll \{[\s\S]{0,260}scrollbar-color: var\(--accent\)/.test(css));

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

// ── v0.9.1544: one vertical scrollbar, and a reachable sideways one ─────
const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
ok('the inner panel no longer scrolls vertically',
   !/browse-table-wrap"[^>]*max-height:calc\(100vh - 175px\);overflow-y:auto/.test(html),
   'two vertical scrollbars is what hid the sideways one');
ok('...in the stylesheet either', /browse-table-wrap \{ overflow-x: auto; overflow-y: visible; \}/.test(css));
ok('the wrap\u2019s own sideways bar is hidden', /browse-table-wrap \{ scrollbar-width: none; \}/.test(css));
ok('a pinned sideways bar exists instead', /#rr-hscroll \{[\s\S]{0,200}position: fixed; bottom: 0/.test(css));
ok('...and it is visible, not hairline', /#rr-hscroll::-webkit-scrollbar \{ height: 14px; \}/.test(css));
ok('the bar is a REAL scrollbar over a spacer, not a drawing',
   /bar\.firstChild\.style\.width = wrap\.scrollWidth/.test(js));
ok('it scrolls the table when dragged', /w\.scrollLeft = bar\.scrollLeft/.test(js));
ok('...and follows the table when scrolled the other way', /bar\.scrollLeft = wrap\.scrollLeft/.test(js));
ok('the two-way sync cannot loop', /if \(lock\) return; lock = true;/.test(js));
ok('it hides when nothing needs scrolling', /var need = wrap\.scrollWidth > wrap\.clientWidth \+ 4;/.test(js));
ok('it hides when the table is off screen', /r\.bottom < 40 \|\| r\.top > window\.innerHeight - 20/.test(js));
ok('it re-measures when the columns change', /setTimeout\(rrStickyHScroll, 30\)/.test(js));
ok('...and after the list re-renders', /setTimeout\(rrStickyHScroll, 40\)/.test(js));

console.log('');
console.log(fail === 0 ? 'ALL COLUMN TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
