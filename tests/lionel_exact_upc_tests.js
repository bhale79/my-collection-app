// ═══════════════════════════════════════════════════════════════
// lionel_exact_upc_tests.js — v0.9.1954.
//
// [stated] Brad, 2026-10-15: "yes" — on a Lionel box an exact barcode match
// in the catalog wins over the five-digit guess.
//
// Why: for a Lionel UPC (0 23922 XXXXX C) the scanner's "decode" is a GUESS —
// it takes the five digits XXXXX and looks for 6-XXXXX / XXXXX. A modern
// 7-digit item's barcode does not carry its number (2533502 is 0 23922 06597 1),
// so the guess can name an OLDER item that only shares five digits. Master
// Version 2.47 put the maker's own barcode for 1,978 modern Lionel items into
// Lionel MPC-Modern's "UPC / Barcode" column; an exact hit there now answers
// first — but only from LIONEL rows (the prefix proved the maker).
//
// These tests load the REAL barcode.js in a sandbox and run its real
// decodeBarcode. Proven able to fail: on the barcode.js before v0.9.1954, A1-A3,
// D1 and D2 fail (the guess wins, or the catalog is never asked first).
// Run:  node tests/lionel_exact_upc_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = process.env.RR_BARCODE_JS || path.join(__dirname, '..', 'app', 'barcode.js');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function load(rows) {
  const noop = () => {};
  const el = () => new Proxy({ style: {}, classList: { add: noop, remove: noop, contains: () => false } },
    { get: (t, k) => (k in t ? t[k] : noop) });
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, setTimeout, clearTimeout, Promise, navigator: {},
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    document: { createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: noop, body: el(), head: el() },
    state: { masterData: [], masterAllRows: rows },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx._barcodeDebug.decodeBarcode;
}
const R = (itemNum, tab, upc, description) => ({ itemNum, variation: '', _tab: tab, upc: upc || '', description: description || itemNum, itemType: 'Boxcar' });

const ROWS = [
  R('6-26510', 'Lionel MPC-Modern', '', 'older item that shares the five digits'),
  R('2026510', 'Lionel MPC-Modern', '023922265104', 'Halloween Smoking 57\' Mechanical Reefer'),
  R('6-18455', 'Lionel MPC-Modern', '', 'item found by the five-digit guess'),
  R('2229170', 'Lionel MPC-Modern', '023922291707', 'Bail Bonds Building'),
  R('2229170', 'Lionel MPC-Modern', '023922291707', 'Plug-Expand-Play Bail Bonds Building'),
  R('2026671', 'Lionel MPC-Modern', '023922266712', 'Polar Express flatcar #1'),
  R('2026672', 'Lionel MPC-Modern', '023922266712', 'Polar Express flatcar #2'),
  R('30-1234', 'MTH O', '023922555550', 'another maker row carrying a Lionel-prefixed barcode by mistake'),
  R('6-55555', 'Lionel MPC-Modern', '', 'what the guess finds for 55555'),
];
const scan = async (dec, raw) => dec({ rawValue: raw, format: raw.length === 13 ? 'ean_13' : 'upc_a' }, 'mpc');

(async function () {
  const dec = load(ROWS);

  section('A · an exact catalog barcode beats the five-digit guess');
  const a = await scan(dec, '023922265104');
  ok('A1 the box names 2026510, not 6-26510', a && a.itemNum === '2026510', JSON.stringify(a && { itemNum: a.itemNum, multi: a.multipleMatches }));
  ok('A2 the answer says it came from the catalog barcode', a && a.byCatalogUpc === true);
  const a13 = await scan(dec, '0023922265104');
  ok('A3 the EAN-13 form of the same box gives the same answer', a13 && a13.itemNum === '2026510');

  section('B · no catalog barcode → the five-digit guess still works');
  const b = await scan(dec, '023922184559');
  ok('B1 a barcode nobody carries falls back to the guess (6-18455)', b && b.itemNum === '6-18455' && !b.byCatalogUpc, JSON.stringify(b && b.itemNum));
  const bm = await scan(dec, '023922999998');
  ok('B2 nothing anywhere → manual entry pre-filled 6-99999', bm && bm.notInMaster === true && bm.itemNum === '6-99999', JSON.stringify(bm && bm.itemNum));

  section('C · only Lionel rows answer a Lionel box');
  const c = await scan(dec, '023922555550');
  ok('C1 an MTH row carrying the barcode is ignored; the guess (6-55555) answers', c && c.itemNum === '6-55555' && !c.byCatalogUpc, JSON.stringify(c && c.itemNum));

  section('D · the same barcode on more than one Lionel row');
  const d = await scan(dec, '023922291707');
  ok('D1 two rows of ONE item (same number) → that item, from the catalog barcode', d && d.itemNum === '2229170' && d.byCatalogUpc === true,
     JSON.stringify(d && { item: d.itemNum, by: d.byCatalogUpc }));
  const d2 = await scan(dec, '023922266712');
  ok('D2 two DIFFERENT items carry it → the picker offers both, never a silent pick', d2 && d2.multipleMatches === true && d2.byCatalogUpc === true && d2.candidates.length === 2,
     JSON.stringify(d2 && { multi: d2.multipleMatches, n: d2.candidates && d2.candidates.length }));

  section('E · the learned Barcode Map is still not consulted during a scan (v1465)');
  ok('E1 "Recording, not recalling" stands', /Recording, not recalling/.test(src));

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
