#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COMMAND IDs — the rules (2026-10-31; [stated] Brad, PLAN 2026-10-31
// "Command IDs: Lionel TMCC / Legacy, MTH DCS and DCC" → approved).
//
// Node only (no browser): the REAL config.js, type-groups.js, command-ids.js
// and browse.js's _itemEraPeriod run in a sandbox; the real
// ensurePersonalHeaders (app-setup.js) runs against a stand-in sheet.
//   C  the columns: the three headings are the LAST three; every column that
//      was on main keeps its letter (read from main's own list — never a typed
//      count); an old sheet opened on the new version gets exactly three
//      headings added and no cell moved
//   N  a number is a whole number of up to 5 digits; "07" = "7"
//   E  offered on every MODERN item (era decided by _itemEraPeriod), never on
//      Pre-war / Postwar — unless the copy already holds an ID
//   H  the catalog hint: Proto-Sound → DCS first; Legacy/CC → TMCC first;
//      Atlas "3-Rail TMCC" → TMCC; Bachmann with nothing said → no hint
//   S  search: "ID 12", "DCS 12", "TMCC 12", "Legacy 12", "DCC 12"; a bare
//      "12" is never an ID search
//   D  the duplicate warning: same system → warned; another system → silent;
//      the same copy → silent; an engine and an accessory → silent (a Lionel
//      base numbers them apart); two accessories → warned; matched by the
//      copy's inventory ID, never its item number
//   W  the Add save writes the IDs only when the button was used on an item
//      that offers it
//   G  source guards — each PROVED on a planted offender
// Every planted offender in this file turns its own check red (P lines).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── the sandbox: the real files, optionally planted ────────────────────────
function slice(src, start, endMark) {
  const a = src.indexOf(start); if (a < 0) throw new Error('not found: ' + start);
  const b = src.indexOf(endMark, a); if (b < 0) throw new Error('end not found: ' + endMark);
  return src.slice(a, b);
}
function world(over) {
  over = over || {};
  const src = f => (over[f] != null ? over[f] : read(f));
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: { _s: {}, getItem(k) { return this._s[k] == null ? null : this._s[k]; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
    navigator: { userAgent: '' }, location: { hostname: '', href: '' },
    document: { addEventListener() {}, getElementById() { return null }, querySelector() { return null }, querySelectorAll() { return [] },
      createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, documentElement: { style: {}, classList: { add() {}, remove() {} } }, head: { appendChild() {} } },
    setTimeout, clearTimeout, setInterval() {}, addEventListener() {},
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src('config.js'), ctx, { filename: 'config.js' });
  vm.runInContext(src('type-groups.js'), ctx, { filename: 'type-groups.js' });
  // THE era decider, exactly as browse.js has it
  const br = src('browse.js');
  vm.runInContext(slice(br, 'var _ERA_KEY_TO_PERIOD', '\nif (typeof window !== \'undefined\') window._itemEraPeriod'), ctx, { filename: 'browse.js(_itemEraPeriod)' });
  vm.runInContext(src('command-ids.js'), ctx, { filename: 'command-ids.js' });
  vm.runInContext('var state = { personalData: {} }; function findMaster(n) { return (window.__M || {})[n] || null; }', ctx);
  return ctx;
}
const M = {
  // the catalog rows the copies below are (measured shapes, 2026-10-31)
  '30-2140-1':  { itemNum: '30-2140-1', itemType: 'Steam Locomotive', description: 'Proto-Sound 2.0 4-6-2 Pacific', _era: 'mth', yearProd: '2004', roadName: 'Pennsylvania' },
  '6-84631':    { itemNum: '6-84631', itemType: 'Diesel Locomotive', control: 'Legacy/CC', description: 'GP9 Diesel', _era: 'mpc', yearProd: '2019', roadName: 'Santa Fe' },
  '6-11111':    { itemNum: '6-11111', itemType: 'Diesel Locomotive', control: 'LionChief', description: 'RS-3', _era: 'mpc', yearProd: '2015' },
  'ATL-1':      { itemNum: 'ATL-1', itemType: 'Diesel Locomotive', trackPower: '3-Rail TMCC', description: 'SD-35', _era: 'atlas', yearProd: '2003' },
  'BAC-1':      { itemNum: 'BAC-1', itemType: 'Diesel Locomotive', description: 'GP7 Diesel', _era: 'bachmann_ho', yearProd: '2010' },
  'MTHHO-1':    { itemNum: 'MTHHO-1', itemType: 'Steam Locomotive', description: 'Big Boy with Proto-Sound 3.0 and DCC', yearProd: '2012', _era: 'mth_ho' },
  '6-17000':    { itemNum: '6-17000', itemType: 'Caboose', description: 'Caboose', _era: 'mpc', yearProd: '1999' },
  '6-29000':    { itemNum: '6-29000', itemType: 'Boxcar', description: 'Boxcar', _era: 'mpc', yearProd: '2001' },
  '6-14111':    { itemNum: '6-14111', itemType: 'Accessory', description: 'TMCC Accessory Controller', _era: 'mpc', yearProd: '2001' },
  '6-12345':    { itemNum: '6-12345', itemType: 'Accessory', description: 'Operating Gateman', _era: 'mpc', yearProd: '1997' },
  '2343':       { itemNum: '2343', itemType: 'Diesel Locomotive', description: 'F-3 A unit', _era: 'pw', yearProd: '1950', roadName: 'Santa Fe' },
  '262':        { itemNum: '262', itemType: 'Steam Locomotive', description: '2-4-2', _era: 'prewar', yearProd: '1931' },
};
function logic(w) {
  w.__M = M;
  const pd = (n, inv, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: String(inv) }, x || {});
  const R = {};
  // N
  R.norm = ['12', '07', ' 3 ', '0', '12a', '123456', '99999', '12.0', ''].map(v => { const n = w.rrCmdIdNorm(v, { digits: 5 }); return n.ok ? n.v : 'BAD'; }).join('|');
  // E
  const off = (n, x) => w.rrCmdIdOffered(pd(n, 1, x), M[n]);
  R.modernEngine = off('6-84631'); R.modernCar = off('6-29000'); R.modernCaboose = off('6-17000'); R.modernAcc = off('6-12345');
  R.lionChief = off('6-11111'); R.bachmann = off('BAC-1');
  R.postwar = off('2343'); R.prewar = off('262');
  R.modernSetPostwar = off('6-84631', { eraPeriod: 'postwar' });
  R.postwarWithId = off('2343', { tmccId: '5' });
  // H
  const hint = n => { const h = w.rrCmdIdHint(M[n]); return h.order[0] + '|' + h.says.join(','); };
  R.hMTH = hint('30-2140-1'); R.hLegacy = hint('6-84631'); R.hAtlas = hint('ATL-1'); R.hBach = hint('BAC-1'); R.hLC = hint('6-11111'); R.hMTHHO = hint('MTHHO-1');
  // S
  const q = s => { const x = w.rrCmdIdQuery(s); return x ? x.keys.join('+') + '=' + x.num : null; };
  R.q = ['ID 12', 'id 012', 'DCS 12', 'TMCC 12', 'Legacy 12', 'DCC 12', 'dcs:7', '12', 'GP 12', 'ID'].map(q);
  const sp = pd('6-84631', 9, { tmccId: '12', dcsId: '7' });
  R.match = [w.rrCmdIdMatches(sp, w.rrCmdIdQuery('ID 12')), w.rrCmdIdMatches(sp, w.rrCmdIdQuery('TMCC 12')), w.rrCmdIdMatches(sp, w.rrCmdIdQuery('DCS 12')), w.rrCmdIdMatches(sp, w.rrCmdIdQuery('DCS 7'))];
  // D
  const eng = pd('6-84631', 101, { tmccId: '12', dcsId: '7' });
  const eng2 = pd('6-84631', 102);                       // a SECOND copy of the same engine
  const acc = pd('6-14111', 103, { tmccId: '12' });       // an accessory set to 12
  const acc2 = pd('6-12345', 104);
  const car = pd('6-29000', 105, { tmccId: '30' });
  w.state.personalData = { a: eng, b: eng2, c: acc, d: acc2, e: car };
  const cl = (p, vals) => w.rrCmdIdClashes(p, M[p.itemNum], vals).map(c => c.key + ':' + c.num + ':' + c.other.inventoryId).join(',');
  R.dSame = cl(eng2, { tmccId: '12' });                  // same system, same group → the first copy
  R.dOther = cl(eng2, { dcsId: '12', dccAddress: '12' }); // DCS 12 / DCC 12: other systems → silent
  R.dSelf = cl(eng, { tmccId: '12', dcsId: '7' });        // the same copy re-saved → silent
  R.dAcc = cl(acc2, { tmccId: '12' });                   // accessory vs the engine 12 → silent; vs the accessory 12 → warned
  R.dCar = cl(eng2, { tmccId: '30' });                   // an engine and a car are both on the track → warned
  R.dByCopy = cl(pd('6-84631', 101), { tmccId: '12' });  // the SAME inventory ID (another record of the same row) → silent
  // W
  w.wizard = { data: {}, matchedItem: M['6-84631'] };
  R.wSaved = JSON.stringify(w.rrCmdIdSaveValues({ tmccId: '012', dcsId: '' }));
  R.wNone = JSON.stringify(w.rrCmdIdSaveValues({}));
  w.wizard.matchedItem = M['2343'];
  R.wPostwar = JSON.stringify(w.rrCmdIdSaveValues({ _era: 'pw', tmccId: '12' }));
  w.wizard.matchedItem = M['6-84631'];
  R.wOverride = JSON.stringify(w.rrCmdIdSaveValues({ eraPeriod: 'postwar', tmccId: '12' }));
  // the field lists the plain boxes read
  R.forItem = w.rrUserFieldsForItem({ tmccId: '12', dcsId: '7', dccAddress: '3' }).map(f => f.key).join(',');
  R.enabled = w.rrEnabledUserFields().map(f => f.key).join(',');
  R.fields = w.rrCmdIdFields().map(f => f.key + '/' + f.sys).join(',');
  R.report = JSON.stringify(w.rrCmdIdReportDef());
  return R;
}
function judge(R, tag) {
  const p = tag ? 'P ' + tag + ' — ' : '';
  return {
    N: R.norm === '12|7|3|0|BAD|BAD|99999|12|',
    E1: R.modernEngine && R.modernCar && R.modernCaboose && R.modernAcc,
    E2: R.lionChief && R.bachmann,
    E3: !R.postwar && !R.prewar && !R.modernSetPostwar,
    E4: R.postwarWithId,
    H: R.hMTH === 'dcsId|Proto-Sound \u2014 DCS' && R.hLegacy === 'tmccId|Legacy' && R.hAtlas === 'tmccId|TMCC' && /^tmccId\|$/.test(R.hBach) && /^tmccId\|$/.test(R.hLC) && /^dcsId\|Proto-Sound — DCS,DCC$/.test(R.hMTHHO),
    S1: JSON.stringify(R.q.slice(0, 7)) === JSON.stringify(['tmccId+dcsId+dccAddress=12', 'tmccId+dcsId+dccAddress=12', 'dcsId=12', 'tmccId=12', 'tmccId=12', 'dccAddress=12', 'dcsId=7']),
    S2: R.q[7] === null && R.q[8] === null && R.q[9] === null,
    S3: JSON.stringify(R.match) === '[true,true,false,true]',
    D1: R.dSame === 'tmccId:12:101',
    D2: R.dOther === '',
    D3: R.dSelf === '' && R.dByCopy === '',
    D4: R.dAcc === 'tmccId:12:103',
    D5: R.dCar === 'tmccId:30:105',
    W: R.wSaved === '{"tmccId":"12"}' && R.wNone === '{}' && R.wPostwar === '{}' && R.wOverride === '{}',
    B: R.forItem.split(',').every(k => !/^(tmccId|dcsId|dccAddress)$/.test(k)) && R.enabled.split(',').every(k => !/^(tmccId|dcsId|dccAddress)$/.test(k)),
    F: R.fields === 'tmccId/tmcc,dcsId/dcs,dccAddress/dcc',
    RPT: /"filters":\{"hasCmdId":"Yes"\}/.test(R.report) && /"sort":\[\{"field":"tmccId","dir":"asc"\},\{"field":"dcsId","dir":"asc"\},\{"field":"dccAddress","dir":"asc"\}\]/.test(R.report) && /"location":true/.test(R.report),
  };
}

// ═══ C · the columns ═══════════════════════════════════════════════════════
function schemaOf(appSrc) {
  const body = slice(appSrc, 'const PERSONAL_SCHEMA = [', '\n];');
  return [...body.matchAll(/\{ field: '(\w+)',\s+header: '([^']+)' \}/g)].map(m => ({ field: m[1], header: m[2] }));
}
function colsKeepLetters(oldS, newS) {
  // every column main had is at the SAME index; the new ones come after it
  return oldS.every((c, i) => newS[i] && newS[i].field === c.field && newS[i].header === c.header) && newS.length > oldS.length;
}
console.log('\n== C · the columns ==');
const NOW = schemaOf(read('app.js'));
let MAIN = null;
try { MAIN = schemaOf(cp.execSync('git show origin/main:app/app.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}
if (!MAIN || NOW.slice(-3).map(c => c.field).join(',') !== 'dcsId,tmccId,dccAddress') {
  // after the release main itself carries the columns: compare with the schema without them
}
const BEFORE = (MAIN && MAIN.some(c => c.field === 'dcsId')) ? MAIN.filter(c => !/^(dcsId|tmccId|dccAddress)$/.test(c.field)) : MAIN;
T('C1 the three headings are the LAST three on the sheet: DCS ID, TMCC / Legacy ID, DCC Address',
  NOW.slice(-3).map(c => c.header).join('|') === 'DCS ID|TMCC / Legacy ID|DCC Address' && NOW.slice(-3).map(c => c.field).join(',') === 'dcsId,tmccId,dccAddress', NOW.slice(-4));
T('C2 every column main had keeps its letter (main\'s own list, read from git — no typed count)', !!BEFORE && colsKeepLetters(BEFORE, NOW) && NOW.length === BEFORE.length + 3, { before: BEFORE && BEFORE.length, now: NOW.length });
{
  const planted = NOW.slice(); planted.splice(5, 0, { field: 'dcsId', header: 'DCS ID' }); planted.pop();
  T('C2 PLANTED: a column inserted in the middle → caught', !colsKeepLetters(BEFORE || [], planted));
}

// C3 — the real ensurePersonalHeaders on a stand-in OLD sheet
async function headerRepair(oldHeaders, newHeaders) {
  const fnSrc = slice(read('app-setup.js'), 'async function ensurePersonalHeaders(sheetId) {', '\nasync function ensureEphemeraSheets');
  const L = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
  const toIdx = s => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  // the stand-in sheet: row 1 title, row 2 headers, rows 3+ data — every old column filled
  const grid = [['My Collection'], oldHeaders.slice()];
  for (let r = 0; r < 4; r++) grid.push(oldHeaders.map((h, i) => 'r' + r + 'c' + i));
  const before = JSON.parse(JSON.stringify(grid));
  const writes = [];
  const ctx = {
    console: { log() {}, warn() {} }, localStorage: { setItem() {}, getItem() { return null; } }, accessToken: 'tok',
    PERSONAL_TAB: 'My Collection', PERSONAL_HEADERS: newHeaders,
    SOLD_HEADERS: ['a'], FOR_SALE_HEADERS: ['a'], WISHLIST_HEADERS: ['a'], soldEndCol: () => 'A',
    _pdColLetter: L,
    fetch: async () => ({ json: async () => ({ sheets: ['My Collection', 'Sold', 'For Sale', 'Want-Upgrade List'].map(t => ({ properties: { title: t } })) }) }),
    sheetsBatchGet: async (id, ranges) => ({ valueRanges: ranges.map(rg => {
      const m = /!([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(rg);
      if (!m) return { values: [] };
      const row = grid[Number(m[2]) - 1] || [];
      const a = toIdx(m[1]), b = m[3] ? toIdx(m[3]) : a;
      return { values: [row.slice(a, b + 1)] };
    }) }),
    sheetsSetupUpdate: async (id, rg, values) => {
      writes.push(rg);
      const m = /^My Collection!([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(rg);
      if (!m) return;
      const r = Number(m[2]) - 1, a = toIdx(m[1]);
      grid[r] = grid[r] || [];
      values[0].forEach((v, i) => { grid[r][a + i] = v; });
    },
    rrEnsurePersonalGrid: async () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.ensurePersonalHeaders = ensurePersonalHeaders;', ctx);
  await ctx.ensurePersonalHeaders('SHEET');
  return { before, after: grid, writes };
}

// ═══ G · source guards ════════════════════════════════════════════════════
function eraOwnRule(src) {
  // the era decision is _itemEraPeriod's — a year rule of its own is the offender
  const s = stripComments(src);
  return /\b19[4-7]\d\b/.test(s) || /yearProd\s*\)\s*\.match|parseInt\([^)]*year/i.test(s) || /'(postwar|prewar)'/.test(s);
}
function numberLists(src) {
  // a hint (or any rule here) read from a typed list of item numbers
  return /\[\s*'[0-9][0-9A-Za-z-]*'\s*,\s*'[0-9][0-9A-Za-z-]*'/.test(stripComments(src)) || /\/\^?\(?\d{3,}\|\d{3,}/.test(stripComments(src));
}
function secondFieldList(files) {
  // the three fields are defined ONCE (config.js RR_USER_FIELDS); any other file
  // that types one of their definitions — a key/label pair — is a second copy
  return files.filter(([f, s]) => f !== 'config.js' && /key:\s*'(tmccId|dcsId|dccAddress)'|'TMCC \/ Legacy ID'|'DCC Address'|'DCS ID'/.test(stripComments(s).replace(/\{ field: '(dcsId|tmccId|dccAddress)',\s+header: '[^']+' \}/g, ''))).map(([f]) => f);
}
function defaultsName(src) { return /_COLL_COLS\s*=\s*\[[^\]]*(tmccId|dcsId|dccAddress)/.test(src); }

(async () => {
  console.log('\n== C3 · an old sheet opened on the new version ==');
  const oldH = (BEFORE || NOW.slice(0, -3)).map(c => c.header), newH = NOW.map(c => c.header);
  const hr = await headerRepair(oldH, newH);
  const hdr = hr.after[1];
  T('C3 the header check (ensurePersonalHeaders) writes the three new headings at the end', hdr.slice(-3).join('|') === 'DCS ID|TMCC / Legacy ID|DCC Address' && hdr.length === oldH.length + 3, hdr.slice(-5));
  T('C3 …and exactly three: every old heading is where it was', oldH.every((h, i) => hdr[i] === h));
  T('C3 …and no data cell moved or changed (before/after compare)', JSON.stringify(hr.after.slice(2)) === JSON.stringify(hr.before.slice(2)) && hr.writes.filter(w => /^My Collection!/.test(w)).every(w => /!A2:[A-Z]+2$|!A1$/.test(w)), hr.writes);
  const hr2 = await headerRepair(newH, newH);
  T('C3 a sheet already on the new layout is left alone (no header write)', hr2.writes.filter(w => /^My Collection!A2:/.test(w)).length === 0, hr2.writes);

  console.log('\n== N E H S D W · the rules, in the real files ==');
  const R = logic(world());
  const J = judge(R);
  T('N  a whole number of up to 5 digits; "07" = "7"; "12a" and "123456" refused', J.N, R.norm);
  T('E1 offered on a Modern engine, car, caboose and accessory', J.E1, R);
  T('E2 …even ones the catalog calls LionChief, or says nothing about (an owner may have upgraded it)', J.E2);
  T('E3 never on a Postwar or Pre-war item, nor a Modern-numbered item whose era was set to Postwar by hand', J.E3, [R.postwar, R.prewar, R.modernSetPostwar]);
  T('E4 a Postwar copy that already holds an ID still shows it (a value is never hidden)', J.E4);
  T('H  hint: Proto-Sound → DCS first; Legacy/CC → TMCC first; Atlas 3-Rail TMCC → TMCC; Bachmann / LionChief → none; MTH HO → DCS + DCC', J.H, [R.hMTH, R.hLegacy, R.hAtlas, R.hBach, R.hLC, R.hMTHHO]);
  T('S1 "ID 12" (any system), "DCS 12", "TMCC 12", "Legacy 12", "DCC 12", "id 012", "dcs:7"', J.S1, R.q);
  T('S2 a bare "12" is NOT an ID search (nor "GP 12", nor "ID" alone)', J.S2, R.q.slice(7));
  T('S3 the copy set to TMCC 12 / DCS 7 is found by ID 12, TMCC 12, DCS 7 — not by DCS 12', J.S3, R.match);
  T('D1 same number, same system, both engines → warned (a SECOND copy of the same engine counts)', J.D1, R.dSame);
  T('D2 DCS 12 / DCC 12 against a TMCC 12 → silent (other systems)', J.D2, R.dOther);
  T('D3 the same copy re-saved → silent (matched by inventory ID)', J.D3, [R.dSelf, R.dByCopy]);
  T('D4 an accessory 12 is warned about the other accessory 12 — never the engine 12', J.D4, R.dAcc);
  T('D5 an engine and a car are both on the track → warned', J.D5, R.dCar);
  T('W  the Add save writes the IDs ("012" → "12") only when the button was used on an item that offers it', J.W, [R.wSaved, R.wNone, R.wPostwar, R.wOverride]);
  T('B  the plain-box lists (Details grid, Update Info, Add steps) never carry the IDs', J.B, [R.forItem, R.enabled]);
  T('F  the three fields come from ONE list (RR_USER_FIELDS), one per system', J.F, R.fields);
  T('R  the Command ID report: the "has a Command ID" filter, sorted by system then number, with where it is kept', J.RPT, R.report);

  console.log('\n== G · source guards ==');
  const cmd = read('command-ids.js'), cfg = read('config.js');
  T('G1 command-ids.js has no era rule of its own (asks _itemEraPeriod)', !eraOwnRule(cmd) && /_itemEraPeriod\(/.test(cmd));
  T('G1 PLANTED: a year rule of its own → caught', eraOwnRule(cmd + '\nfunction x(m){ return parseInt(m.yearProd, 10) >= 1970; }'));
  const hintBlock = slice(cfg, 'hintRules: [', '\n  ],');
  T('G2 the hint is read from the row\'s own words — no typed list of item numbers', !numberLists(hintBlock) && !numberLists(cmd));
  T('G2 PLANTED: a hint from a list of numbers → caught', numberLists(hintBlock + "\n var dcsNums = ['30-2140-1', '30-1170-1'];"));
  const all = fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(f => [f, read(f)]);
  T('G3 one definition of the three fields (config.js) — no second copy of the field list', secondFieldList(all).length === 0, secondFieldList(all));
  T('G3 PLANTED: reports.js typing its own "TMCC / Legacy ID" → caught', secondFieldList([['reports.js', "const X = [{ key: 'tmccId', label: 'TMCC / Legacy ID' }];"]]).length === 1);
  const br = read('browse.js');
  T('G4 the columns are not shown by default (not in My Collection\'s default list)', !defaultsName(br) && /RR_ROW_EXTRA_COLS\.push/.test(read('table-columns.js')));
  T('G4 PLANTED: the IDs in the default column list → caught', defaultsName(br.replace('var _COLL_COLS = [', "var _COLL_COLS = [ { col: 'tmccId' },")));
  T('G5 no word "AI" in anything the Command IDs say', !/\bAI\b/.test(JSON.stringify(slice(cfg, 'window.RR_CMDID = {', '\n};'))));
  const ix = read('index.html'), sw = read('sw.js');
  T('G6 command-ids.js is loaded (after app-collection.js) and kept for offline use', ix.indexOf('src="./command-ids.js?v=') > ix.indexOf('src="./app-collection.js?v=') && sw.includes("'./command-ids.js'"));
  T('G7 the Add save puts the IDs on the item\'s own row only (3 places: the main row, the hand-made row and its record) — not on boxes, tenders or set mates',
    (read('wizard-save.js').match(/rrCmdIdSaveValues\(d\)/g) || []).length === 3);

  console.log('\n== P · planted offenders, run through the real rules ==');
  const plant = (file, from, to) => { const s = read(file); if (s.indexOf(from) < 0) throw new Error('plant anchor gone in ' + file + ': ' + from.slice(0, 60)); return { [file]: s.replace(from, to) }; };
  const runP = (tag, over, key) => { let J2; try { J2 = judge(logic(world(over)), tag); } catch (e) { J2 = { [key]: false }; } T('P ' + tag + ' → ' + key + ' turns red', J2[key] === false); };
  runP('the button on a Postwar item (offered on every era)', plant('command-ids.js', "return rrCmdIdPeriod(pd, master) === 'modern';", 'return true;'), 'E3');
  runP('the button missing on a Modern car or accessory (engines only)', plant('command-ids.js', "return rrCmdIdPeriod(pd, master) === 'modern';", "return rrCmdIdPeriod(pd, master) === 'modern' && /Locomotive/.test(getTypeBucket(master || pd));"), 'E1');
  runP('a warning between an engine and an accessory (group check gone)', plant('command-ids.js', 'if (rrCmdIdOnTrack(p, pm) !== mine) return;', ''), 'D4');
  runP('a warning across systems (any value matches)', plant('command-ids.js', 'return pv[key] && pv[key] === vals[key];', 'return Object.keys(pv).some(function (k) { return pv[k] === vals[key]; });'), 'D2');
  runP('the same copy warned about itself (inventory ID check gone)', plant('command-ids.js', "if (myId && String(p.inventoryId || '').trim() === myId) return;", ''), 'D3');
  runP('a bare "12" matching', plant('command-ids.js', "var m = String(q || '').trim().match(/^([a-z]+)\\s*[:#]?\\s*(\\d{1,6})$/i);", "var m = String(q || '').trim().match(/^([a-z]*)\\s*[:#]?\\s*(\\d{1,6})$/i); if (m && !m[1]) m[1] = 'id';"), 'S2');
  runP('the IDs drawn as plain boxes in the Details grid (ownCard rule gone)', plant('config.js', '    if (f.ownCard) return false;   // 2026-10-31: drawn by its own card', '    // gone'), 'B');
  runP('the hint ignoring the catalog\'s Control column', plant('config.js', "{ from: 'control',    re: /legacy/i,", "{ from: 'nothing',    re: /legacy/i,"), 'H');
  runP('the report without its "has a Command ID" filter', plant('command-ids.js', "filters: { hasCmdId: 'Yes' },", 'filters: {},'), 'RPT');

  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
