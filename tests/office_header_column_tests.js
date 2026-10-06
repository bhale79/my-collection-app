#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// office_header_column_tests.js — v0.9.1889: a new header column on a master
// tab widens the tab FIRST
//
// [stated] Brad: "yes" (2026-10-06) — open-list item 4. The Office adds
// "Image URL" (an approved crawl row with a photo link) and "UPC / Barcode"
// (a barcode commit) at the END of a master tab with a plain value write. A
// value write never widens a sheet; after Master Version 2.20 (Row ID in the
// last column) 27 master tabs are exactly as wide as their header row, so the
// write would be refused ("exceeds grid limits", 400) and the commit would
// stop half-way — the v1880 collection-sheet failure, on the master.
//
// A · rrEnsureGridColumns (app-setup.js): one metadata read; widens by exactly
//     the shortfall; nothing when wide enough; null for a tab not on the sheet;
//     throws on an HTTP failure. rrEnsurePersonalGrid now goes through it.
// B · _ymAddHeaderColumn (yardmaster.js) over a stand-in Sheets that refuses
//     writes past the grid: a FULL tab (grid = header width) gets widened by
//     one, the header lands, the header row is read back; a tab with spare
//     columns is not widened; a header row that comes back wrong throws.
// C · both call sites go through the helper; no other header write remains.
// D · PLANTED: the v1888 reading (the plain write, no widen) fails on a full
//     tab; the helper without its widen step fails the same way.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const src = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const SETUP = src('app-setup.js'), YM = src('yardmaster.js'), SHEETS = src('sheets.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
// lift one function out of a source file by its signature (brace-balanced)
function grab(text, sig) {
  const i = text.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0, started = false;
  for (let k = i; k < text.length; k++) {
    if (text[k] === '{') { d++; started = true; }
    else if (text[k] === '}') { d--; if (started && d === 0) return text.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}
const colL = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
const colN = L => L.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);

// ── a stand-in Google Sheets: several tabs, each `cols` wide with a header row;
//    value writes past a tab's grid are REFUSED like Google's.
function fakeSheets(tabs) {
  const S = { tabs: {}, log: [], metaReads: 0 };
  Object.keys(tabs).forEach((t, i) => { S.tabs[t] = { id: 100 + i, cols: tabs[t].cols, header: tabs[t].header.slice() }; });
  S.fetch = async function (url, opts) {
    const u = String(url); const method = (opts && opts.method) || 'GET';
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    const bad = (code, message) => ({ ok: false, status: code, json: async () => ({ error: { code, message, status: 'INVALID_ARGUMENT' } }), text: async () => message });
    if (/\?fields=sheets\.properties/.test(u)) { S.metaReads++; S.log.push('meta'); return ok({ sheets: Object.keys(S.tabs).map(t => ({ properties: { sheetId: S.tabs[t].id, title: t, gridProperties: { rowCount: 5000, columnCount: S.tabs[t].cols } } })) }); }
    if (/:batchUpdate$/.test(u) && method === 'POST') {
      const reqs = JSON.parse(opts.body).requests || [];
      reqs.forEach(r => { if (r.appendDimension) { const t = Object.keys(S.tabs).find(k => S.tabs[k].id === r.appendDimension.sheetId); S.log.push('append ' + t + ' ' + r.appendDimension.length); S.tabs[t].cols += r.appendDimension.length; } });
      return ok({ replies: [] });
    }
    const m = /\/values\/([^?]+)(\?|$)/.exec(u);
    if (m && method === 'GET') {
      const range = decodeURIComponent(m[1]); const t = /^'([^']+)'!/.exec(range)[1];
      S.log.push('read ' + range);
      return ok({ range, values: [S.tabs[t].header.slice()] });
    }
    if (m && method === 'PUT') {
      const range = decodeURIComponent(m[1]); const t = /^'?([^'!]+)'?!/.exec(range)[1]; const tab = S.tabs[t];
      const cell = /!([A-Z]+)(\d+)$/.exec(range); const col = colN(cell[1]); const vals = JSON.parse(opts.body).values || [[]];
      S.log.push('update ' + range);
      if (col > tab.cols) return bad(400, 'Range (' + range + ') exceeds grid limits. Max rows: 5000, max columns: ' + tab.cols);
      if (cell[2] === '1') { while (tab.header.length < col) tab.header.push(''); tab.header[col - 1] = vals[0][0]; }
      return ok({ updatedCells: 1 });
    }
    return bad(404, 'unknown ' + u);
  };
  return S;
}
// ── the lifted world: rrEnsureGridColumns (app-setup.js), sheetsUpdate (sheets.js, real),
//    _ymColLetter + _ymAddHeaderColumn (yardmaster.js, real) over the stand-in
function world(S, setupSrc, ymSrc) {
  setupSrc = setupSrc || SETUP; ymSrc = ymSrc || YM;
  const body = 'var accessToken = "tok"; var window = { _rrDataRev: 0 }; var state = {}; var _rrGridChecked = {};\n'
    + 'function _rrWriteFailed(k, a, e) { return e; } async function _withTokenRetry(f) { return f(); } function _encodeRange(r) { return encodeURIComponent(r); } const console = { log(m) { logs.push(String(m)); }, warn() {}, error() {} };\n'
    + grab(setupSrc, 'async function rrEnsureGridColumns(spreadsheetId, tabTitle, wantCols)') + '\n'
    + grab(SHEETS, 'function _rrOfflineNow()') + '\n' + grab(SHEETS, 'async function sheetsUpdate(spreadsheetId, range, values)') + '\n'
    + grab(ymSrc, 'function _ymColLetter(i)') + '\n' + grab(ymSrc, 'async function _ymAddHeaderColumn(MID, H, tab, heads, header)') + '\n'
    + 'return { rrEnsureGridColumns, _ymAddHeaderColumn, sheetsUpdate };';
  const logs = [];
  const W = new Function('fetch', 'logs', body)(S.fetch, logs);
  W.logs = logs; return W;
}
const H = { Authorization: 'Bearer tok' };
const HEADS = ['Item Number', 'Item Type', 'Road Name', 'Description', 'Row ID'];

(async () => {
  section('A · rrEnsureGridColumns — the one grid widener, for any tab');
  {
    let S = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS }, 'K-Line O': { cols: 9, header: HEADS } }); let W = world(S);
    const r1 = await W.rrEnsureGridColumns('MID', 'Lionel MPC-Modern', 6);
    T('A1 a tab one short is widened by exactly one; the result says so', r1 && r1.cols === 5 && r1.widened === 1 && S.tabs['Lionel MPC-Modern'].cols === 6 && S.log.join() === 'meta,append Lionel MPC-Modern 1', [r1, S.log]);
    const r2 = await W.rrEnsureGridColumns('MID', 'K-Line O', 6);
    T('A2 a tab with spare columns is left alone (widened 0, no batchUpdate)', r2 && r2.cols === 9 && r2.widened === 0 && !S.log.slice(2).some(l => /^append/.test(l)));
    S = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } }); W = world(S);
    const r3 = await W.rrEnsureGridColumns('MID', 'Lionel MPC-Modern', 9);
    T('A3 three short → widened by three, in ONE appendDimension', r3.widened === 4 && S.tabs['Lionel MPC-Modern'].cols === 9 && S.log.filter(l => /^append/.test(l)).join() === 'append Lionel MPC-Modern 4');
    T('A4 a tab not on the sheet → null, nothing written', (await W.rrEnsureGridColumns('MID', 'Nope', 3)) === null && !S.log.slice(2).some(l => /^append/.test(l)));
    const S5 = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } }); const f5 = S5.fetch; S5.fetch = async (u, o) => /\?fields=sheets\.properties/.test(String(u)) ? { ok: false, status: 500, json: async () => ({}) } : f5(u, o);
    let e5 = ''; try { await world(S5).rrEnsureGridColumns('MID', 'Lionel MPC-Modern', 6); } catch (e) { e5 = e.message; }
    T('A5 a failed size read THROWS (the caller must not write past the edge)', /could not read the sheet/.test(e5));
    T('A6 rrEnsurePersonalGrid goes through rrEnsureGridColumns (one widener, not two)', /await rrEnsureGridColumns\(sheetId, PERSONAL_TAB, want\)/.test(grab(SETUP, 'async function rrEnsurePersonalGrid(sheetId, force)')) && !/appendDimension/.test(grab(SETUP, 'async function rrEnsurePersonalGrid(sheetId, force)')));
    T('A7 the appendDimension REQUEST appears once in app-setup.js and nowhere in sheets.js / yardmaster.js (the single widener)', (SETUP.match(/\{ appendDimension: \{/g) || []).length === 1 && !/appendDimension:/.test(SHEETS) && !/appendDimension:/.test(YM));
  }

  section('B · _ymAddHeaderColumn — a FULL tab gets its new column');
  {
    // the 2.20 shape: grid exactly as wide as the header row (Row ID last)
    let S = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } }); let W = world(S);
    const heads = await W._ymAddHeaderColumn('MID', H, 'Lionel MPC-Modern', HEADS, 'Image URL');
    T('B1 full tab: widened by one, header written at F1, header row read back', S.tabs['Lionel MPC-Modern'].cols === 6 && S.tabs['Lionel MPC-Modern'].header[5] === 'Image URL' && heads.length === 6 && heads[5] === 'Image URL', { cols: S.tabs['Lionel MPC-Modern'].cols, heads });
    T('B2 the order: size read → widen → header write → header read-back', S.log.join('|') === "meta|append Lionel MPC-Modern 1|update 'Lionel MPC-Modern'!F1|read 'Lionel MPC-Modern'!1:1", S.log);
    T('B3 the console names the widening', W.logs.some(l => /widened by 1 for "Image URL"/.test(l)), W.logs);
    // a tab with spare columns (the Bachmann shape): no widen, header still lands
    S = fakeSheets({ 'K-Line O': { cols: 9, header: HEADS } }); W = world(S);
    const h2 = await W._ymAddHeaderColumn('MID', H, 'K-Line O', HEADS, 'UPC / Barcode');
    T('B4 spare columns: not widened, header lands at F1, read back', S.tabs['K-Line O'].cols === 9 && S.tabs['K-Line O'].header[5] === 'UPC / Barcode' && h2[5] === 'UPC / Barcode' && !S.log.some(l => /^append/.test(l)));
    // the 27th column: AA
    const wide = []; for (let i = 0; i < 26; i++) wide.push('H' + i);
    S = fakeSheets({ 'Atlas Z': { cols: 26, header: wide } }); W = world(S);
    const h3 = await W._ymAddHeaderColumn('MID', H, 'Atlas Z', wide, 'Image URL');
    T('B5 a 26-column tab: the new header lands at AA1 (the letter helper), widened to 27', S.log.some(l => l === "update 'Atlas Z'!AA1") && S.tabs['Atlas Z'].cols === 27 && h3.length === 27);
    // the header row comes back wrong → throws, before any row
    S = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } }); const f6 = S.fetch;
    S.fetch = async (u, o) => (/\/values\/.*!1:1/.test(decodeURIComponent(String(u))) && (!o || !o.method || o.method === 'GET')) ? { ok: true, status: 200, json: async () => ({ values: [HEADS.concat(['Image URL', 'stray'])] }) } : f6(u, o);
    let e6 = ''; try { await world(S)._ymAddHeaderColumn('MID', H, 'Lionel MPC-Modern', HEADS, 'Image URL'); } catch (e) { e6 = e.message; }
    T('B6 a header row that comes back wrong THROWS (nothing else is written)', /did not come back as written/.test(e6), e6);
    // a tab not on the sheet
    let e7 = ''; try { await world(fakeSheets({ 'K-Line O': { cols: 9, header: HEADS } }))._ymAddHeaderColumn('MID', H, 'Atlas Z', HEADS, 'Image URL'); } catch (e) { e7 = e.message; }
    T('B7 a tab not on the sheet THROWS before any write', /not on the master sheet/.test(e7), e7);
  }

  section('C · both call sites go through the helper');
  {
    T('C1 the Image URL add calls _ymAddHeaderColumn', /plan\[t4\]\.heads = await _ymAddHeaderColumn\(MID, H, t4, plan\[t4\]\.heads, 'Image URL'\)/.test(YM));
    T('C2 the UPC / Barcode add calls _ymAddHeaderColumn', /p\.heads = await _ymAddHeaderColumn\(MID, H, t4, p\.heads, 'UPC \/ Barcode'\)/.test(YM));
    const headerWrites = (YM.match(/sheetsUpdate\(MID, "'" \+ [a-z0-9]+ \+ "'!" \+ _ymColLetter\([^)]*\) \+ '1'/g) || []);
    T('C3 no other header-cell write remains in the Office (only the helper\'s)', headerWrites.length === 1, headerWrites);
    T('C4 the helper is exposed nowhere else — one definition', (YM.match(/async function _ymAddHeaderColumn/g) || []).length === 1);
  }

  section('D · planted: the v1888 reading fails on a full tab');
  {
    // the old plain write, no widen — exactly what shipped before
    const S = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } }); const W = world(S);
    let e1 = ''; try { await W.sheetsUpdate('MID', "'Lionel MPC-Modern'!F1", [['Image URL']]); } catch (e) { e1 = e.message; }
    T('D1 PLANTED: the plain header write on a full tab is refused by Sheets (what v1888 did)', /exceeds grid limits/.test(e1) && S.tabs['Lionel MPC-Modern'].cols === 5, e1);
    // the helper with its widen step cut out
    const from = "    var g = await rrEnsureGridColumns(MID, tab, idx + 1);\n    if (!g) throw new Error(tab + ' is not on the master sheet \\u2014 stopped before any write');\n";
    T('D2 the widen step is in yardmaster.js exactly once', YM.split(from).length === 2);
    const planted = YM.split(from).join("    var g = { widened: 0 };\n");
    const S2 = fakeSheets({ 'Lionel MPC-Modern': { cols: 5, header: HEADS } });
    let e2 = ''; try { await world(S2, SETUP, planted)._ymAddHeaderColumn('MID', H, 'Lionel MPC-Modern', HEADS, 'Image URL'); } catch (e) { e2 = e.message; }
    T('D3 PLANTED: the helper without its widen step fails on the full tab', /exceeds grid limits/.test(e2) && S2.tabs['Lionel MPC-Modern'].cols === 5, e2);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
