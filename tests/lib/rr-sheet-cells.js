// tests/lib/rr-sheet-cells.js — the REAL rrSheetCell / rrSheetCells, lifted out of
// app/sheets.js, for a test that lifts sheetsUpdate / sheetsAppend on their own
// (v0.9.2044: both writers now run every cell through the one rule).
//     Object.assign(global, require('./lib/rr-sheet-cells.js'));   // new Function code
//     sandbox.rrSheetCells = require('./lib/rr-sheet-cells.js').rrSheetCells;   // a vm sandbox
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'sheets.js'), 'utf8');
function grab(sig) {
  const i = SRC.indexOf(sig); if (i < 0) throw new Error('rr-sheet-cells.js: app/sheets.js has no ' + sig);
  let d = 0, k = SRC.indexOf('{', i);
  for (; k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) break; } }
  return SRC.slice(i, k + 1);
}
const box = {};
vm.createContext(box);
vm.runInContext(grab('function rrSheetCell(') + '\n' + grab('function rrSheetCells(') + '\nthis.rrSheetCell = rrSheetCell; this.rrSheetCells = rrSheetCells;', box);
module.exports = { rrSheetCell: box.rrSheetCell, rrSheetCells: box.rrSheetCells };
