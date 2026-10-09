#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PERSONAL GRID TESTS — v0.9.1881
//
// The collection sheet is as wide as the schema, made true in ONE place.
// v0.9.1880 appended a 51st column to PERSONAL_SCHEMA; Brad's sheet had 50
// columns, the header repair (ensurePersonalHeaders) never widened a sheet,
// and every full-row save answered "exceeds grid limits" (400). A stand-in
// Sheets here behaves like Google on that point: a value write past the grid
// is refused, only appendDimension widens. Every function is the REAL one,
// lifted from app/ (never re-typed).
//   A  rrEnsurePersonalGrid: widens by exactly the shortfall, nothing when wide
//      enough, remembers per sheet, `force` re-reads
//   B  ensurePersonalHeaders: widens BEFORE the header row lands on a short
//      sheet; PLANTED: the repair without the widen is refused as before
//   C  sheetsUpdate / sheetsAppend: a My Collection write past the edge
//      widens and tries ONCE more; another sheet, another error, a second
//      failure — not healed; PLANTED: the heal cut out
//   D  the cached start runs the check once per schema width (source);
//      PLANTED: the call removed
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const src = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail)))); cond ? pass++ : fail++; }
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(text, head) {
  const i = text.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) {
    if (text[k] === '{') d++;
    else if (text[k] === '}') { d--; if (d === 0) return text.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
const SETUP = src('app-setup.js'), SHEETS = src('sheets.js'), APPJS = src('app.js'), DATA = src('app-data.js');
const HEADERS = (() => {
  const body = APPJS.slice(APPJS.indexOf('const PERSONAL_SCHEMA = ['), APPJS.indexOf('];', APPJS.indexOf('const PERSONAL_SCHEMA = [')) + 2);
  return new Function(body + '\nreturn PERSONAL_SCHEMA.map(s => s.header);')();
})();
const WANT = HEADERS.length;
const colL = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
const colN = L => L.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);

// ── a stand-in Google Sheets: one spreadsheet, a My Collection tab of `cols`
// columns, a header row; value writes past the grid are REFUSED like Google's.
function fakeSheets(cols, headerCells) {
  const S = { cols, header: headerCells.slice(), log: [], metaReads: 0, writes: [], appends: [] };
  S.fetch = async function (url, opts) {
    const u = String(url); const method = (opts && opts.method) || 'GET';
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    const bad = (code, message) => ({ ok: false, status: code, json: async () => ({ error: { code, message, status: 'INVALID_ARGUMENT' } }), text: async () => message });
    if (/\?fields=sheets\.properties/.test(u)) { S.metaReads++; S.log.push('meta'); return ok({ sheets: [{ properties: { sheetId: 77, title: 'My Collection', gridProperties: { rowCount: 1049, columnCount: S.cols } } }, { properties: { sheetId: 1, title: 'Sold', gridProperties: { rowCount: 1000, columnCount: 26 } } }] }); }
    if (/:batchUpdate$/.test(u) && method === 'POST') {
      const reqs = JSON.parse(opts.body).requests || [];
      reqs.forEach(r => { if (r.appendDimension) { S.log.push('append ' + r.appendDimension.length); S.cols += r.appendDimension.length; } });
      return ok({ replies: [] });
    }
    if (/values:batchGet/.test(u)) { S.log.push('batchGet'); const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1])); return ok({ valueRanges: ranges.map(r => ({ range: r, values: /My%20Collection!A2|My Collection!A2/.test(r) ? [S.header.slice(0, S.cols)] : /A1$/.test(r) ? [['My Collection']] : [[]] })) }); }
    const m = /\/values\/([^?]+)\?/.exec(u);
    if (m && method === 'PUT') {
      const range = decodeURIComponent(m[1]); const last = /:([A-Z]+)\d*$/.exec(range) || /!([A-Z]+)\d+$/.exec(range);
      const lastCol = last ? colN(last[1]) : 1; const vals = JSON.parse(opts.body).values || [[]]; const width = Math.max(...vals.map(v => v.length));
      S.log.push('update ' + range);
      if (lastCol > S.cols) return bad(400, 'Range (' + range + ') exceeds grid limits. Max rows: 1049, max columns: ' + S.cols);
      if (width > lastCol) return bad(400, 'Requested writing within range [' + range + '], but tried writing to column [' + colL(width) + ']');
      S.writes.push({ range, vals }); if (/A2:/.test(range) && /My Collection/.test(range)) S.header = vals[0].slice();
      return ok({ updatedCells: width });
    }
    if (m && /:append/.test(u)) {
      const vals = JSON.parse(opts.body).values || [[]]; const width = Math.max(...vals.map(v => v.length));
      S.log.push('append-values ' + width);
      if (width > S.cols) return bad(400, 'Requested writing within range [My Collection!A3:' + colL(S.cols) + '1049], but tried writing to column [' + colL(width) + ']');
      S.appends.push(vals); return ok({ updates: { updatedRange: "'My Collection'!A5:" + colL(width) + '5' } });
    }
    return bad(404, 'unknown ' + u);
  };
  return S;
}

// ── the lifted setup world: rrEnsurePersonalGrid + ensurePersonalHeaders over the stand-in
function setupWorld(S, setupSrc, sheetsSrc) {
  setupSrc = setupSrc || SETUP; sheetsSrc = sheetsSrc || SHEETS;
  const sheetsLifted = grab(sheetsSrc, 'function _rrOfflineNow()') + '\n' + grab(sheetsSrc, 'async function sheetsSetupUpdate(spreadsheetId, range, values)') + '\n' + grab(sheetsSrc, 'async function sheetsUpdate(spreadsheetId, range, values, opts)') + '\n' + grab(sheetsSrc, 'async function _rrGridHeal(');
  const batchGet = 'async function sheetsBatchGet(id, ranges) { const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + id + "/values:batchGet?" + ranges.map(x => "ranges=" + encodeURIComponent(x)).join("&")); return r.json(); }';
  const body = 'var _rrGridChecked = {}; var accessToken = "tok"; var window = { _rrDataRev: 0 }; var localStorage = { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } };\n'
    + 'const PERSONAL_TAB = "My Collection"; const PERSONAL_HEADERS = HEADERS; const SOLD_HEADERS = ["Sold A"]; const FOR_SALE_HEADERS = ["FS A"]; const WISHLIST_HEADERS = ["WU A"];\n'
    + 'function _rrWriteFailed(k, a, e) { return e; } async function _withTokenRetry(f) { return f(); } function _encodeRange(r) { return encodeURIComponent(r); } const console = { log() {}, warn(m) { warns.push(String(m)); }, error() {} };\n'
    + grab(setupSrc, 'function _pdColLetter(n)') + '\n' + grab(setupSrc, 'async function rrEnsureGridColumns(spreadsheetId, tabTitle, wantCols)') + '\n' + grab(setupSrc, 'async function rrEnsurePersonalGrid(sheetId, force)') + '\n' + grab(setupSrc, 'async function ensurePersonalHeaders(sheetId)') + '\n'   // v0.9.1889: the widening moved into rrEnsureGridColumns — lifted too
    + sheetsLifted + '\n' + batchGet + '\nreturn { rrEnsureGridColumns, rrEnsurePersonalGrid, ensurePersonalHeaders, sheetsUpdate, localStorage, state: null, setState(s) { state = s; } };';
  const warns = [];
  const W = new Function('fetch', 'HEADERS', 'warns', 'state', body)(S.fetch, HEADERS, warns, { personalSheetId: 'SID' });
  W.warns = warns; return W;
}

(async () => {
  section('A · rrEnsurePersonalGrid — the one place the sheet gets wider');
  {
    let S = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); let W = setupWorld(S);
    T('A1 a sheet one column short is widened by exactly one', await W.rrEnsurePersonalGrid('SID') === true && S.cols === WANT && S.log.filter(l => /^append/.test(l)).join() === 'append 1');
    const reads = S.metaReads; await W.rrEnsurePersonalGrid('SID');
    T('A2 a second call this session reads nothing (remembered per sheet)', S.metaReads === reads);
    await W.rrEnsurePersonalGrid('SID', true);
    T('A3 `force` reads the sheet again and appends nothing when it is wide enough', S.metaReads === reads + 1 && S.cols === WANT);
    S = fakeSheets(WANT + 9, HEADERS); W = setupWorld(S);
    T('A4 a sheet wider than the schema is left alone', await W.rrEnsurePersonalGrid('SID') === true && S.cols === WANT + 9 && !S.log.some(l => /^append/.test(l)));
    S = fakeSheets(WANT - 3, HEADERS.slice(0, WANT - 3)); W = setupWorld(S); await W.rrEnsurePersonalGrid('SID');
    T('A5 three short → three appended, in one request', S.cols === WANT && S.log.filter(l => /^append/.test(l)).join() === 'append 3');
    S = fakeSheets(WANT - 1, HEADERS); const f0 = S.fetch; S.fetch = async (u, o) => (/fields=sheets\.properties/.test(String(u)) ? { ok: false, status: 503, json: async () => ({}) } : f0(u, o)); W = setupWorld(S);
    let threw = ''; try { await W.rrEnsurePersonalGrid('SID'); } catch (e) { threw = e.message; }
    T('A6 a failed size read THROWS (the caller decides) and remembers nothing', /HTTP 503/.test(threw) && S.cols === WANT - 1);
  }

  section('B · ensurePersonalHeaders — the grid before the header row');
  {
    const S = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W = setupWorld(S);
    await W.ensurePersonalHeaders('SID');
    const i1 = S.log.indexOf('append 1'), i2 = S.log.findIndex(l => /^update .*My Collection!A2/.test(l));
    T('B1 Brad\'s shape (sheet 50 wide, schema 51): widened first, THEN the header row written and landed',
      i1 >= 0 && i2 > i1 && S.header.length === WANT && S.header[WANT - 1] === HEADERS[WANT - 1], S.log);
    T('B2 the device remembers the schema width it saw land', W.localStorage.getItem('lv_pd_schema_ok') === String(WANT));
    const S2 = fakeSheets(WANT, HEADERS); const W2 = setupWorld(S2); await W2.ensurePersonalHeaders('SID');
    T('B3 a sheet already right: no widen, no header write, memo still set', !S2.log.some(l => /^append|My Collection!A2/.test(l) && /append|update/.test(l) && !/batchGet/.test(l)) && W2.localStorage.getItem('lv_pd_schema_ok') === String(WANT), S2.log);
    // PLANTED: the repair as it stood before v0.9.1881 — no widen before the header row
    const planted = SETUP.replace('      await rrEnsurePersonalGrid(sheetId);\n      await sheetsSetupUpdate(sheetId, PERSONAL_TAB', '      await sheetsSetupUpdate(sheetId, PERSONAL_TAB');
    T('B4 (planted offender is a real edit)', planted !== SETUP);
    // ...with the OLD sheetsUpdate too (no write heal): the two layers are proven apart — the heal alone catches it in B6
    const oldSheets = SHEETS.replace("if (json.error && typeof _rrGridHeal === 'function' && await _rrGridHeal(spreadsheetId, range, json)) { res = await _go(); json = await res.json(); }\n    if (json.error) {\n      console.error('sheetsUpdate error:'", "if (json.error) {\n      console.error('sheetsUpdate error:'");
    const S3 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W3 = setupWorld(S3, planted, oldSheets); await W3.ensurePersonalHeaders('SID');
    T('B5 PLANTED: without the widen (and without the write heal) the header row is REFUSED — the v0.9.1880 start, caught', S3.header.length === WANT - 1 && S3.cols === WANT - 1 && W3.warns.some(w => /ensurePersonalHeaders failed/.test(w)), W3.warns);
    const S3b = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W3b = setupWorld(S3b, planted); await W3b.ensurePersonalHeaders('SID');
    T('B6 the write heal alone (second layer) still lands the header row on the planted repair', S3b.header.length === WANT && S3b.cols === WANT);
  }

  section('C · sheetsUpdate / sheetsAppend — a write past the edge heals once');
  {
    const S = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W = setupWorld(S);
    const row = HEADERS.map((h, i) => 'v' + i);
    const r = await W.sheetsUpdate('SID', "My Collection!A7:" + colL(WANT) + "7", [row]);
    T('C1 a full-row save on a short sheet: widened, retried, LANDED', r && r.updatedCells === WANT && S.cols === WANT && S.writes.length === 1 && S.log.filter(l => /^update/.test(l)).length === 2, S.log);
    T('C2 ...and the heal said so in the console', W.warns.some(w => /narrower than the schema/.test(w)));
    // another sheet: not ours to heal
    const S2 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W2 = setupWorld(S2); let e2 = '';
    try { await W2.sheetsUpdate('OTHER', "My Collection!A7:" + colL(WANT) + "7", [row]); } catch (e) { e2 = e.message; }
    T('C3 the same error on a DIFFERENT spreadsheet is not healed — thrown as before', /exceeds grid limits/.test(e2) && S2.cols === WANT - 1);
    // another tab on the personal sheet: not ours either
    const S3 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const W3 = setupWorld(S3); let e3 = '';
    try { await W3.sheetsUpdate('SID', "Sold!A7:" + colL(WANT) + "7", [row]); } catch (e) { e3 = e.message; }
    T('C4 a Sold-tab write past the edge is not healed (only My Collection\'s width is the schema\'s)', /exceeds grid limits/.test(e3) && S3.cols === WANT - 1);
    // a different error: untouched
    const S4 = fakeSheets(WANT, HEADERS); const f4 = S4.fetch; S4.fetch = async (u, o) => (/\/values\/.*\?/.test(String(u)) && o && o.method === 'PUT') ? { ok: false, status: 403, json: async () => ({ error: { code: 403, message: 'The caller does not have permission' } }) } : f4(u, o);
    const W4 = setupWorld(S4); let e4 = ''; try { await W4.sheetsUpdate('SID', 'My Collection!A7:B7', [['a', 'b']]); } catch (e) { e4 = e.message; }
    T('C5 a permission error is not a grid error — thrown, no widen', /permission/.test(e4) && S4.metaReads === 0);
    // the wall stays up: exactly one retry, then the honest throw
    const S5 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1)); const f5 = S5.fetch; S5.fetch = async (u, o) => (/:batchUpdate$/.test(String(u))) ? { ok: true, status: 200, json: async () => ({}) } : f5(u, o);   // widen "succeeds" but changes nothing
    const W5 = setupWorld(S5); let e5 = ''; try { await W5.sheetsUpdate('SID', "My Collection!A7:" + colL(WANT) + "7", [row]); } catch (e) { e5 = e.message; }
    T('C6 if the sheet is STILL short after the widen: one retry, then the error — never a loop', /exceeds grid limits/.test(e5) && S5.log.filter(l => /^update/.test(l)).length === 2);
    // append
    const S6 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1));
    const W6 = new Function('fetch', 'HEADERS', 'warns', 'state',
      'var _rrGridChecked = {}; var accessToken = "tok"; var window = {}; const PERSONAL_TAB = "My Collection"; const PERSONAL_HEADERS = HEADERS; function _rrWriteFailed(k, a, e) { return e; } async function _withTokenRetry(f) { return f(); } function _encodeRange(r) { return encodeURIComponent(r); } const console = { log() {}, warn(m) { warns.push(String(m)); }, error() {} };\n'
      + grab(SETUP, 'async function rrEnsureGridColumns(spreadsheetId, tabTitle, wantCols)') + '\n' + grab(SETUP, 'async function rrEnsurePersonalGrid(sheetId, force)') + '\n' + grab(SHEETS, 'function _rrOfflineNow()') + '\n' + grab(SHEETS, 'async function sheetsAppend(spreadsheetId, range, values)') + '\n' + grab(SHEETS, 'async function _rrGridHeal(') + '\nreturn { sheetsAppend };')(S6.fetch, HEADERS, [], { personalSheetId: 'SID' });
    const rowNo = await W6.sheetsAppend('SID', 'My Collection!A:A', [row]);
    T('C7 a new item (append) wider than the sheet: widened, retried, landed at a real row', rowNo === 5 && S6.cols === WANT && S6.appends.length === 1);
    // PLANTED: the heal cut out of sheetsUpdate
    const plantedSheets = SHEETS.replace("if (json.error && typeof _rrGridHeal === 'function' && await _rrGridHeal(spreadsheetId, range, json)) { res = await _go(); json = await res.json(); }\n    if (json.error) {\n      console.error('sheetsUpdate error:'", "if (json.error) {\n      console.error('sheetsUpdate error:'");
    T('C8 (planted offender is a real edit)', plantedSheets !== SHEETS);
    const S7 = fakeSheets(WANT - 1, HEADERS.slice(0, WANT - 1));
    const W7 = new Function('fetch', 'HEADERS', 'state', 'var _rrGridChecked = {}; var accessToken = "tok"; var window = {}; const PERSONAL_TAB = "My Collection"; const PERSONAL_HEADERS = HEADERS; function _rrWriteFailed(k, a, e) { return e; } async function _withTokenRetry(f) { return f(); } function _encodeRange(r) { return encodeURIComponent(r); } const console = { log() {}, warn() {}, error() {} };\n'
      + grab(SETUP, 'async function rrEnsureGridColumns(spreadsheetId, tabTitle, wantCols)') + '\n' + grab(SETUP, 'async function rrEnsurePersonalGrid(sheetId, force)') + '\n' + grab(plantedSheets, 'function _rrOfflineNow()') + '\n' + grab(plantedSheets, 'async function sheetsUpdate(spreadsheetId, range, values, opts)') + '\n' + grab(plantedSheets, 'async function _rrGridHeal(') + '\nreturn { sheetsUpdate };')(S7.fetch, HEADERS, { personalSheetId: 'SID' });
    let e7 = ''; try { await W7.sheetsUpdate('SID', "My Collection!A7:" + colL(WANT) + "7", [row]); } catch (e) { e7 = e.message; }
    T('C9 PLANTED: the old sheetsUpdate — the save FAILS on the short sheet (what v0.9.1880 did)', /exceeds grid limits/.test(e7) && S7.cols === WANT - 1);
  }

  section('D · the cached start runs the check (source)');
  {
    const cold = DATA.slice(DATA.indexOf('window._pdColdRefreshed = true;'), DATA.indexOf('_loadPersonalFromSheets(state.personalSheetId).then'));
    T('D1 the cold cached start calls ensurePersonalHeaders, gated on the remembered schema width', /ensurePersonalHeaders\(state\.personalSheetId\)/.test(cold) && /lv_pd_schema_ok/.test(cold) && /PERSONAL_HEADERS\.length/.test(cold));
    T('D2 ensurePersonalHeaders sets that memo only after the row is right', /lv_pd_schema_ok', String\(PERSONAL_HEADERS\.length\)/.test(grab(SETUP, 'async function ensurePersonalHeaders(sheetId)')));
    T('D3 initPersonalSheet widens through the ONE helper (no second appendDimension in app-setup.js)', (SETUP.match(/appendDimension: \{/g) || []).length === 1 && /await rrEnsurePersonalGrid\(sheetId, true\)/.test(grab(SETUP, 'async function initPersonalSheet(sheetId)')));
    const plantedData = DATA.replace('ensurePersonalHeaders(state.personalSheetId).catch(function () {});', '');
    const coldP = plantedData.slice(plantedData.indexOf('window._pdColdRefreshed = true;'), plantedData.indexOf('_loadPersonalFromSheets(state.personalSheetId).then'));
    T('D4 PLANTED: the call removed → D1 would fail', plantedData !== DATA && !/ensurePersonalHeaders\(state\.personalSheetId\)/.test(coldP));
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
