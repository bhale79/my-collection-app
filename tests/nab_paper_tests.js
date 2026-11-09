#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE NABISCO SHEETS GO TO THE PAPER TAB   (2026-11-08; real Chromium, the REAL app)
//
// [stated] Brad 2026-11-08: "yes" (look into the ten Items-tab copies) → "yes"
// (write the plan, PLAN_2026-11-08_NABISCO_PAPER_ONLY.md) → "yes" (build it).
// All 12 Nabisco Train-O-Rama sheets are on Lionel PW - Paper (TO520 … TO2360);
// ten were also on Lionel PW - Items as the engine number's last variation.
// Those ten are removed from the master; a collection that saved one is brought
// to the Paper row ONCE per sheet (rrNabPaperCatchUp, app-data.js; the table is
// RR_NAB_TO_PAPER, config.js).
//   A  the table = the real master rows (fixture): ten Items rows → their Paper rows
//   B  catalog still has the Items rows → nothing; read-only / offline → nothing;
//      PLANTED no live check → moves on the old catalog
//   C  Items rows gone → from a FRESH read (memory empty): copies by Row ID (at
//      the sheet's variation, now or before the renumber); a pre-Row-ID Postwar
//      copy at the sheet's position (before / after the renumber day); For Sale /
//      Upgrade rows tied by Inventory ID; engines, another maker, a late GP-7
//      untouched; a sheet's link on another variation LISTED, not moved; Want /
//      Sold listed, not moved; each copy ONE write; only catalog cells change;
//      the diary carries no price / note / photo; memory follows
//   D  a second session and another device move NOTHING; PLANTED the move keeps
//      the old number → it would be moved again (caught by the number check)
//   E  a write that fails → pending, nothing half-written, the next start finishes
//   F  the renumber pass and this pass in either order → the same sheet
//   G  the back-fills and a save never link a sheet's copy (rrVarRenumberHolds,
//      now with the variation); PLANTED each one removed → an ENGINE link
//   H  "Change catalog entry" and this pass share ONE rule (rrCopyFieldsFromEntry)
//   I  the load order (scan, planted) and one table
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
try { require('playwright'); }
catch (e) { console.log('FAILED  —  nab_paper_tests needs playwright and it is not installed.'); process.exit(1); }
const { bootApp, launch } = require('./lib/lars-world');
const APP = path.join(__dirname, '..', 'app');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'nab_paper_2026-11-08.json'), 'utf8'));
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
function plant(src, from, to, what) {
  const out = src.replace(from, to);
  if (out === src) throw new Error('planted ' + what + ': the line moved; update this test');
  return out;
}
const DATA = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
const APPJS = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
const COLL = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
const PIN = require('./lib/pin-source').pinPieces();
const TOOLS = PIN['photo-inbox-tools.js'];
const IDENT = PIN['photo-inbox-identify.js'];
if (!TOOLS || !IDENT) { console.log('FAILED  —  the Photo Inbox pieces moved (photo-inbox-tools.js / photo-inbox-identify.js)'); process.exit(1); }

// ── The world: the ten numbers as the master holds them after 2.89, the Paper
// tab's twelve sheets, `gone` = the ten Items rows removed (Part B done).
const WORLD = function (o) {
  const FIX = o.fix, GONE = !!o.gone;
  const md = FIX.items.filter(r => !(GONE && r.itemType === 'Promotional')).map(r => Object.assign({}, r, { _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O Gauge' }))
    .concat(FIX.paper.map(r => Object.assign({}, r, { _era: 'pw', _tab: 'Lionel PW - Paper' })));
  md.push({ itemNum: '2338', variation: '', itemType: 'Diesel Locomotive', description: 'MTH lookalike', _era: 'mth', _tab: 'MTH O', rowId: 'MTHX2338XX', roadName: '', varDesc: '' });
  state.masterData = md;
  _rebuildMasterIndex();
  state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
  try { window._allIdxComplete = true; _allIdxComplete = true; } catch (e) {}
  let row = 3;
  const pd = (n, v, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: inv, row: row++,
    condition: '7', priceItem: '125.00', userEstWorth: '200', notes: 'SECRET-NOTE-' + inv, location: 'SHELF-' + inv, dateAdded: '2026-10-01',
    photoItem: 'https://drive.google.com/drive/folders/SECRET' + inv, itemType: 'Promotional', masterDescription: 'old words', roadName: '' }, x || {});
  state.personalData = {
    nab627:  pd('627',  '2', '60', { masterRowId: '54DG2T2DR5', masterKey: 'pw|627|2' }),                   // the renumber already moved it: 627 var 2
    nab2338: pd('2338', '1', '61', { masterRowId: '984VYR3KRQ', masterKey: 'pw|2338|1' }),                  // the renumber never ran: still the OLD var 1
    old2331: pd('2331', '1', '62', { masterRowId: '', masterKey: 'pw|2331|1' }),                           // no Row ID, added BEFORE the renumber day: var 1 = the sheet
    new520:  pd('520',  '3', '63', { masterRowId: '', masterKey: '', dateAdded: '2026-11-09' }),           // no link, after the day: 520 var 3 = the sheet
    gp7:     pd('2338', '1', '64', { masterRowId: 'YSGYWFPFA4', masterKey: 'pw|2338|1', itemType: 'Diesel Locomotive' }),   // Brad's GP-7
    late:    pd('2338', '1', '65', { masterRowId: '', masterKey: '', dateAdded: '2026-11-09', itemType: 'Diesel Locomotive' }),  // after the day: var 1 = the GP-7
    eng520:  pd('520',  '1', '66', { masterRowId: '', masterKey: 'pw|520|1', itemType: 'Diesel Locomotive' }),   // an engine, before the day
    mth:     pd('2338', '5', '67', { era: 'mth', manufacturer: 'MTH', masterRowId: '', masterKey: 'mth|2338|', itemType: 'Diesel Locomotive' }),
    odd621:  pd('621',  '2', '68', { masterRowId: 'FVCT3MAQM8', masterKey: 'pw|621|2' }),                  // a sheet's link on an ENGINE's variation — not certain
    late601: pd('601',  '1', '69', { masterRowId: 'DK4P3M8PXF', masterKey: 'pw|601|1', dateAdded: '2026-11-09' }),   // the sheet's OLD var 1, but added AFTER the day — not certain
    blank1615: pd('1615', '', '70', { masterRowId: 'UCVKF2TGHK', masterKey: '', dateAdded: '' }),        // the sheet's Row ID, no variation, no Date Added
    gpBlank: pd('2338', '', '71', { masterRowId: '984VYR3KRQ', masterKey: '', itemType: 'Diesel Locomotive' }),   // a GP-7 an old app tied to the sheet (it WAS Var 1) — no variation
    eng627:  pd('627',  '2', '72', { masterRowId: '54DG2T2DR5', masterKey: 'pw|627|1', itemType: 'Diesel Locomotive' }),  // before the day, at the sheet's NEW number, but the renumber never wrote it (key says 1)
  };
  state.forSaleData = { '60': { row: 3, itemNum: '627', variation: '2', condition: '7', askingPrice: '30', inventoryId: '60', manufacturer: 'Lionel', notes: 'SECRET-SALE' } };
  state.upgradeData = { '62': { row: 3, itemNum: '2331', variation: '1', listType: 'Upgrade', priority: 'High', maxPrice: '40', targetCondition: '9', inventoryId: '62', manufacturer: 'Lionel', notes: 'SECRET-UPG' } };
  state.wantData = {
    a: { row: 4, itemNum: '2338', variation: '5', listType: 'Want', priority: 'High', expectedPrice: '50', manufacturer: 'Lionel', notes: 'SECRET-W1' },   // the sheet's number now
    b: { row: 5, itemNum: '2338', variation: '2', listType: 'Want', priority: 'Low', expectedPrice: '300', manufacturer: 'Lionel', notes: '' },           // an engine
    c: { row: 6, itemNum: '736',  variation: '10', listType: 'Want', priority: 'Low', expectedPrice: '9', manufacturer: 'MTH', notes: '' },              // another maker
  };
  state.soldData = { 'sold-3': { row: 3, key: 'sold-3', itemNum: '520', variation: '3', copy: '1', salePrice: '25', dateSold: '2026-10-01', inventoryId: '40', manufacturer: 'Lionel', notes: 'SECRET-SOLD' } };
  state.isData = {}; state.mySetsData = {};
  state.personalSheetId = 'SID'; try { window.accessToken = 'tok'; accessToken = 'tok'; } catch (e) {}
  const S = { [PERSONAL_TAB]: {}, 'For Sale': {}, 'Want-Upgrade List': {}, 'Sold': {} };
  Object.values(state.personalData).forEach(p => { S[PERSONAL_TAB][p.row] = rrRecordRow(p).map(v => String(v == null ? '' : v).replace(/^'/, '')); });
  Object.values(state.forSaleData).forEach(e => { S['For Sale'][e.row] = [e.itemNum, e.variation, e.condition, e.askingPrice, '', e.notes, '', '', e.inventoryId, e.manufacturer]; });
  Object.values(state.upgradeData).forEach(e => { S['Want-Upgrade List'][e.row] = [e.itemNum, e.variation, 'Upgrade', e.priority, e.maxPrice, e.targetCondition, e.inventoryId, e.notes, e.manufacturer]; });
  Object.values(state.wantData).forEach(e => { S['Want-Upgrade List'][e.row] = [e.itemNum, e.variation, 'Want', e.priority, e.expectedPrice, '', '', e.notes, e.manufacturer]; });
  Object.values(state.soldData).forEach(e => { const r = new Array(SOLD_HEADERS.length).fill(''); r[0] = e.itemNum; r[1] = e.variation; r[5] = e.salePrice; r[7] = e.notes; r[8] = e.inventoryId; r[9] = e.manufacturer; S['Sold'][e.row] = r; });
  const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const parse = range => { const m = /^(.*)!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/.exec(range); return m && { tab: m[1], c0: colIdx(m[2]), r0: Number(m[3]), c1: m[4] ? colIdx(m[4]) : colIdx(m[2]), r1: m[5] ? Number(m[5]) : (m[4] ? 0 : Number(m[3])) }; };
  const W = window.__np = { S: S, puts: [], failOn: null };
  const read = range => { const p = parse(range); const tab = S[p.tab];
    if (!tab) throw new Error('Sheets API error 400: Unable to parse range: ' + range);
    const last = p.r1 || Math.max(p.r0 - 1, ...Object.keys(tab).map(Number));
    const out = []; for (let r = p.r0; r <= last; r++) out.push((tab[r] || []).slice(p.c0, p.c1 + 1)); return out; };
  window.sheetsGet = sheetsGet = async function (sid, range) { return { values: read(range) }; };
  window.sheetsUpdate = sheetsUpdate = async function (sid, range, values) {
    if (W.failOn && W.failOn.test(range)) { W.failOn = null; throw new Error('network dropped'); }
    W.puts.push(range); const p = parse(range); const tab = S[p.tab];
    (values || []).forEach((rv, i) => { const r = tab[p.r0 + i] = tab[p.r0 + i] || []; rv.forEach((v, k) => { r[p.c0 + k] = String(v).replace(/^'/, ''); }); });
    return {};
  };
  Object.keys(localStorage).filter(k => /^rr_(nab_paper|var_renumber)_done/.test(k)).forEach(k => localStorage.removeItem(k));
  Object.keys(_rrNpTried).forEach(k => delete _rrNpTried[k]);
  Object.keys(_rrRnTried).forEach(k => delete _rrRnTried[k]);
  if (o.emptyMemory) { state.personalData = {}; state.wantData = {}; state.forSaleData = {}; state.upgradeData = {}; state.soldData = {}; }
  localStorage.removeItem('rr_sync_log');
  return true;
};
const RELOAD = (device) => `(function () {
  const S = window.__np.S;
  const re = {}; Object.keys(S[PERSONAL_TAB]).forEach(rn => { const rec = rrPersonalRecordFromRow(S[PERSONAL_TAB][rn], Number(rn)); rec.owned = true; re['k' + rn] = rec; });
  state.personalData = re;
  Object.keys(_rrNpTried).forEach(k => delete _rrNpTried[k]);
  Object.keys(_rrRnTried).forEach(k => delete _rrRnTried[k]);
  ${device === 'other' ? "Object.keys(localStorage).filter(k => /^rr_(nab_paper|var_renumber)_done/.test(k)).forEach(k => localStorage.removeItem(k));" : ''}
  return true;
})()`;
const SNAP = `(function () {
  const S = window.__np.S, F = PERSONAL_FIELD_INDEX, P = S[PERSONAL_TAB];
  const by = inv => Object.values(P).find(r => r[F.inventoryId] === inv) || [];
  const c = inv => { const r = by(inv); return [r[F.itemNum], r[F.variation], r[F.itemType], r[F.masterKey], r[F.masterRowId], r[F.masterDescription]]; };
  const out = {}; ['60','61','62','63','64','65','66','67','68','69','70','71','72'].forEach(i => { out[i] = c(i); });
  out.date70 = by('70')[F.dateAdded];
  out.fs = (S['For Sale'][3] || []).slice(0, 2); out.upg = (S['Want-Upgrade List'][3] || []).slice(0, 2);
  out.want = [4, 5, 6].map(r => S['Want-Upgrade List'][r].slice(0, 2).join('/')); out.sold = S['Sold'][3].slice(0, 2).join('/');
  out.puts = window.__np.puts.slice();
  out.done = Object.keys(localStorage).filter(k => /^rr_nab_paper_done/.test(k)).length;
  out.diary = localStorage.getItem('rr_sync_log') || '';
  return out;
})()`;
const PAPER = id => FIX.paper.find(p => p.rowId === id);

(async () => {
  const browser = await launch();
  const fix = JSON.stringify(FIX);
  const world = (o) => `(${WORLD})(Object.assign({ fix: ${fix} }, ${JSON.stringify(o)}))`;

  // ── A: the table ─────────────────────────────────────────────────────────
  console.log('== A · the table is the real master: ten Items rows → their Paper rows ==');
  {
    const { pg, errs } = await bootApp(browser);
    const t = await pg.evaluate(() => ({ np: RR_NAB_TO_PAPER, rn: RR_VAR_RENUMBER }));
    await pg.close();
    const ids = Object.keys(t.np.rows), promos = FIX.items.filter(r => r.itemType === 'Promotional');
    T('A1  ten rows, exactly the ten Promotional (Nabisco) rows the Items tab holds, each at its number and variation', ids.length === 10 && promos.length === 10
      && promos.every(r => t.np.rows[r.rowId] && t.np.rows[r.rowId][0] === r.itemNum && t.np.rows[r.rowId][1] === r.variation && r.subType === 'Nabisco Promo'), ids.length);
    T('A2  each points at the Paper tab\'s own row for that sheet: TO + the number, its Row ID', ids.every(id => { const e = t.np.rows[id], p = PAPER(e[4]); return p && p.itemNum === e[3] && e[3] === 'TO' + e[0]; }), ids.map(id => t.np.rows[id].slice(3)));
    T('A3  "before the renumber": the five renumbered numbers held the sheet at Var 1 (RR_VAR_RENUMBER\'s old numbers), the other five where they are now',
      ids.every(id => { const e = t.np.rows[id], rn = t.rn.rows[id]; return rn ? (e[2] === rn[1] && e[1] === rn[2] && e[2] === '1') : e[2] === e[1]; }), ids.map(id => t.np.rows[id]));
    T('A4  the Paper tab holds all twelve sheets; the two with no Items copy (2243, 2350) are not in the table', FIX.paper.length === 12 && !ids.some(id => /^(2243|2350)$/.test(t.np.rows[id][0])), FIX.paper.map(p => p.itemNum));
    T('A5  no page errors', errs.length === 0, errs);
  }

  // ── B: not now ───────────────────────────────────────────────────────────
  console.log('\n== B · the Items rows still in the catalog, read-only or offline → nothing ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ gone: false })};
      const live = rrNabPaperLive(); const res = await rrNabPaperCatchUp(); return { live, res, puts: window.__np.puts.length }; })()`);
    T('B1  live = false while the loaded catalog still has the Items rows', r.live === false, r);
    T('B2  nothing written', r.res === null && r.puts === 0, r);
    const r2 = await pg.evaluate(`(async function () { ${world({ gone: true })};
      window._readOnlyMode = true; const ro = await rrNabPaperCatchUp(); window._readOnlyMode = false;
      window._offlineMode = true; const off = await rrNabPaperCatchUp(); window._offlineMode = false;
      return { ro, off, puts: window.__np.puts.length }; })()`);
    T('B3  read-only → nothing', r2.ro === null && r2.puts === 0, r2);
    T('B4  offline → nothing', r2.off === null && r2.puts === 0, r2);
    const r3 = await pg.evaluate(`(async function () { ${world({ gone: true })};
      state.masterData = state.masterData.filter(m => m._tab !== 'Lionel PW - Paper'); _rebuildMasterIndex();
      state.masterByItemAll = state.masterByItem; state.masterByRowIdAll = state.masterByRowId;
      return rrNabPaperLive(); })()`);
    T('B5  live = false when the Paper rows are not in this catalog', r3 === false, r3);
    T('B6  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOLIVE = plant(DATA, '  if (!rrNabPaperLive()) return null;\n  _rrNpTried[sid] = true;', '  _rrNpTried[sid] = true;', 'live check');
    const b = await bootApp(browser, { 'app-data.js': NOLIVE });
    const r4 = await b.pg.evaluate(`(async function () { ${world({ gone: false })}; await rrNabPaperCatchUp(); return window.__np.puts.length; })()`);
    T('PLANTED B: without its live check the pass moves copies while the Items rows are still their real entries (caught)', r4 > 0, r4);
    await b.pg.close();
  }

  // ── C + D: the Items rows are gone ───────────────────────────────────────
  console.log('\n== C · the Items rows gone → only copies that say for certain they are the sheet, from a fresh read ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ gone: true, emptyMemory: true })};
      const S = window.__np.S, before = JSON.parse(JSON.stringify(S));
      const live = rrNabPaperLive();
      const res = await rrNabPaperCatchUp();
      const s1 = ${SNAP};
      const sec = ephSectionOfType(s1['60'][2]);
      const changed = [];
      Object.keys(S).forEach(tab => Object.keys(S[tab]).forEach(rn => (S[tab][rn] || []).forEach((v, i) => {
        const was = (before[tab][rn] || [])[i];
        if (String(v) === String(was == null ? '' : was)) return;
        changed.push(tab === PERSONAL_TAB ? 'P' + rn + ':' + PERSONAL_SCHEMA[i].field : tab + rn + ':' + i);
      })));
      const again = await rrNabPaperCatchUp();
      ${RELOAD('same')};
      const p0 = window.__np.puts.length;
      const res2 = await rrNabPaperCatchUp();
      ${RELOAD('other')};
      const res3 = await rrNabPaperCatchUp();
      return { live, res, s1, sec, changed, again, res2, res3, puts2: window.__np.puts.length - p0 };
    })()`);
    const s = r.s1, P = id => PAPER(id);
    const isPaper = (c, to, pid) => c[0] === to && c[1] === '1' && c[2] === 'Paper' && c[3] === 'pw|' + to + '|1' && c[4] === pid && c[5] === P(pid).description;
    T('C1  live = true once the Items rows are gone and the Paper rows are here', r.live === true, r.live);
    T('C2  BY ROW ID (moved by the renumber, 627 var 2) → TO627: Type "Paper" (the Paper Items section, as the plan says), its key, its Row ID, its words', isPaper(s['60'], 'TO627', '7DHFWP7UNK'), s['60']);
    T('C2b the Type written puts it in the Paper Items section', r.sec === 'paper', r.sec);
    T('C3  BY ROW ID still at the OLD var 1 (the renumber never ran on this sheet) → TO2338', isPaper(s['61'], 'TO2338', 'FU5GD3AXK9'), s['61']);
    T('C4  NO Row ID, added before the renumber day, 2331 var 1 (the sheet then) → TO2331', isPaper(s['62'], 'TO2331', 'B8HD8RXQYJ'), s['62']);
    T('C5  NO link at all, added after the day, 520 var 3 (the sheet) → TO520', isPaper(s['63'], 'TO520', 'PVNX8WEWNZ'), s['63']);
    T('C6  Brad\'s GP-7 (2338 var 1, its own Row ID) — NOT touched', s['64'].slice(0, 2).join() === '2338,1' && s['64'][4] === 'YSGYWFPFA4', s['64']);
    T('C7  a 2338 var 1 with no link added AFTER the day (the GP-7 in the new numbers) — NOT touched', s['65'].slice(0, 2).join() === '2338,1' && s['65'][4] === '', s['65']);
    T('C8  an engine 520 var 1 — NOT touched; another maker\'s 2338 var 5 (MTH) — NOT touched', s['66'].slice(0, 2).join() === '520,1' && s['67'].slice(0, 2).join() === '2338,5', [s['66'], s['67']]);
    T('C9  a sheet\'s Row ID on an engine\'s variation (621 var 2) — NOT moved, LISTED', s['68'].slice(0, 2).join() === '621,2' && r.res.stuck.some(x => /621 var 2 \(a Nabisco link on another variation\)/.test(x)), [s['68'], r.res.stuck]);
    T('C9b the sheet\'s Row ID at its OLD var 1 but added AFTER the renumber day (601) — NOT moved, LISTED', s['69'].slice(0, 2).join() === '601,1' && r.res.stuck.some(x => /601 var 1 \(a Nabisco link/.test(x)), [s['69'], r.res.stuck]);
    T('C9c the sheet\'s Row ID with NO variation (1615) — moved: the Row ID is certain', isPaper(s['70'], 'TO1615', '9C2B4KBUW2'), s['70']);
    T('C9d …and its blank Date Added stays blank (never stamped with today)', s.date70 === '', s.date70);
    T('C9e a 2338 with NO variation tied to the sheet\'s Row ID (the sheet WAS Var 1 — an old app put GP-7s there) — NOT moved, LISTED', s['71'].slice(0, 2).join() === '2338,' && s['71'][4] === '984VYR3KRQ' && r.res.stuck.some(x => /2338 var  \(a Nabisco link/.test(x)), [s['71'], r.res.stuck]);
    T('C9f a 627 var 2 from before the day with the sheet\'s Row ID but a key the renumber never wrote (pw|627|1) — NOT moved, LISTED', s['72'].slice(0, 2).join() === '627,2' && r.res.stuck.some(x => /627 var 2 \(a Nabisco link/.test(x)), [s['72'], r.res.stuck]);
    T('C10 the For Sale row tied to the 627 copy and the Upgrade row tied to the 2331 copy follow it (TO…/1)', s.fs.join() === 'TO627,1' && s.upg.join() === 'TO2331,1', [s.fs, s.upg]);
    T('C11 Want and Sold rows are NOT moved', s.want.join() === '2338/5,2338/2,736/10' && s.sold === '520/3', [s.want, s.sold]);
    T('C12 …LISTED instead: Want 2338 var 5 and Sold 520 var 3 (not the engine Want, not the MTH Want)', r.res.listed.length === 2 && /W row 4 2338 var 5/.test(r.res.listed.join()) && /S row 3 520 var 3/.test(r.res.listed.join()), r.res.listed);
    T('C13 from the SHEET (memory empty on purpose): 7 rows moved (5 copies + 2 list rows)', r.res.fixed === 7 && r.res.state === 'done', r.res);
    const P_OK = /:(itemNum|variation|itemType|masterDescription|variationDescription|masterKey|masterRowId|manufacturer|roadName|roadNumber|era)$/;
    T('C14 only catalog cells changed (number, variation, type, the two descriptions, key, Row ID…) and list columns A–B — never a price, note, photo, place, date, condition or ID', r.changed.every(c => P_OK.test(c) || /^(For Sale|Want-Upgrade List)3:[01]$/.test(c)) && !r.changed.some(c => /:(notes|priceItem|userEstWorth|photoItem|location|dateAdded|condition|inventoryId)$/.test(c)), r.changed);
    const pPuts = s.puts.filter(p => /^My Collection!/.test(p));
    const F = await pg.evaluate(() => PERSONAL_FIELD_INDEX), colOf = L => { let n = 0; for (const ch of L) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    const user = ['notes', 'priceItem', 'userEstWorth', 'photoItem', 'location', 'dateAdded', 'condition', 'inventoryId'].map(f => F[f]);
    const spans = pPuts.map(p => { const m = /!([A-Z]+)\d+:([A-Z]+)\d+$/.exec(p); return [colOf(m[1]), colOf(m[2])]; });
    T('C15 only the changed cells are written — no write range covers a price, note, photo, place, date, condition or ID cell', spans.every(sp => !user.some(c => c >= sp[0] && c <= sp[1])), pPuts);
    const r61 = pPuts.filter(p => /\D3$|\D4$/.test(p) && /!(A|[A-Z]+)4:/.test(p));
    const order61 = pPuts.filter(p => /\d+:[A-Z]+4$/.test(p));
    T('C15b each copy: the link FIRST, the item number LAST (row 4: the Row ID / key run before the run holding column A)', order61.length >= 2 && /!A4:/.test(order61[order61.length - 1]) && order61.findIndex(p => { const m = /!([A-Z]+)4:([A-Z]+)4$/.exec(p); return m && colOf(m[1]) <= F.masterRowId && colOf(m[2]) >= F.masterKey; }) === 0, order61);
    T('C16 a diary line per move; PRIVACY: no price, note, place or photo link in it', (s.diary.match(/nabpaper-fix/g) || []).length === 7 && !/SECRET|SHELF|125\.00|drive\.google|"200"/.test(s.diary), s.diary.slice(0, 600));
    T('C17 once per session', r.again === null, r.again);
    console.log('\n== D · a second session, a second device → nothing moves again ==');
    T('D1  the next start on this device: not even asked', r.res2 === null, r.res2);
    T('D2  another device: reads, finds nothing, writes nothing', r.res3 && r.res3.state === 'done' && r.res3.fixed === 0 && r.puts2 === 0, { res3: r.res3, puts2: r.puts2 });
    T('C18 no page errors', errs.length === 0, errs);
    // memory follows
    const m = await pg.evaluate(`(async function () { ${world({ gone: true })}; await rrNabPaperCatchUp();
      const p = Object.values(state.personalData).find(x => x.inventoryId === '61'); return [p.itemNum, p.variation, p.masterRowId, p.itemType, state.forSaleData['60'].itemNum]; })()`);
    T('C19b …and its Type reads Paper', m[3] === 'Paper', m);
    T('C19 memory follows the sheet: the copy reads TO2338 / 1 / its Paper Row ID; the For Sale entry TO627', m[0] === 'TO2338' && m[1] === '1' && m[2] === 'FU5GD3AXK9' && m[4] === 'TO627', m);
    await pg.close();
    // PLANTED: the move forgets the number → the copy keeps 2338 and is moved again next time
    const KEEPNUM = plant(DATA, "Object.assign({ itemNum: e.to, dateAdded: cur.dateAdded || '' },", "Object.assign({ dateAdded: cur.dateAdded || '' },", 'number on the move');
    const b = await bootApp(browser, { 'app-data.js': KEEPNUM });
    const r2 = await b.pg.evaluate(`(async function () { ${world({ gone: true })}; await rrNabPaperCatchUp(); return ${SNAP}; })()`);
    T('PLANTED D: a move that keeps the engine\'s number leaves "2338" pointing at the Paper row — caught by C3\'s check', r2['61'][0] === '2338', r2['61']);
    await b.pg.close();
  }

  {
    const LOOSE = plant(DATA, "        : (!_rrRnBare(p.variation) || _rrRnSame(p.variation, e[1]));", "        : (!_rrRnBare(p.variation) || _rrRnSame(p.variation, e[1]));\n      if (!_rrRnBare(p.variation)) vOk = true;", 'blank rule');
    const b = await bootApp(browser, { 'app-data.js': LOOSE });
    const r = await b.pg.evaluate(`(async function () { ${world({ gone: true })}; await rrNabPaperCatchUp(); return ${SNAP}; })()`);
    T('PLANTED C9e: taking a blank variation as certain for 2338 turns the GP-7 into TO2338 (caught)', r['71'][0] === 'TO2338', r['71']);
    await b.pg.close();
  }

  // ── E: a write that fails ────────────────────────────────────────────────
  console.log('\n== E · a write that fails → pending, nothing half written, the next start finishes ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ gone: true })};
      const row = state.personalData.nab2338.row;
      window.__np.failOn = new RegExp('My Collection!A' + row + ':');
      const res1 = await rrNabPaperCatchUp(); const s1 = ${SNAP};
      ${RELOAD('same')};
      const res2 = await rrNabPaperCatchUp(); const s2 = ${SNAP};
      return { res1, c1: s1['61'], done1: s1.done, res2, c2: s2['61'] }; })()`);
    T('E1  the item-number write failed: the copy still reads 2338 (its link already the Paper row\'s), the pass is pending, not marked done', r.res1.state === 'pending' && r.c1[0] === '2338' && r.c1[4] === 'FU5GD3AXK9' && r.done1 === 0, [r.res1, r.c1]);
    T('E2  the next start finishes it: TO2338', r.res2.state === 'done' && r.c2[0] === 'TO2338' && r.c2[4] === 'FU5GD3AXK9', [r.res2, r.c2]);
    // a For Sale row whose write is refused AFTER its copy moved: never stranded
    const r2 = await pg.evaluate(`(async function () { ${world({ gone: true })};
      window.__np.failOn = /^For Sale!A3:B3$/;
      const res1 = await rrNabPaperCatchUp(); const s1 = ${SNAP};
      ${RELOAD('same')};
      const res2 = await rrNabPaperCatchUp(); const s2 = ${SNAP};
      return { res1, fs1: s1.fs, c1: s1['60'], done1: s1.done, res2, fs2: s2.fs }; })()`);
    T('E4  the copy moved but its For Sale write failed: pending, not marked done', r2.res1.state === 'pending' && r2.c1[0] === 'TO627' && r2.fs1.join() === '627,2' && r2.done1 === 0, r2);
    T('E5  the next start still finds that For Sale row through its moved copy (TO627 + its Paper Row ID) and moves it', r2.res2.state === 'done' && r2.fs2.join() === 'TO627,1', r2);
    // cut off between the link and the item number: the next pass finishes the copy
    const r3 = await pg.evaluate(`(async function () { ${world({ gone: true })};
      const row = state.personalData.nab627.row;
      window.__np.failOn = new RegExp('My Collection!A' + row + ':');
      const res1 = await rrNabPaperCatchUp(); const s1 = ${SNAP};
      ${RELOAD('same')};
      const res2 = await rrNabPaperCatchUp(); const s2 = ${SNAP};
      return { res1, c1: s1['60'], fs1: s1.fs, res2, c2: s2['60'], fs2: s2.fs }; })()`);
    T('E6  cut off before the item number: the copy carries its Paper link under the old number; its For Sale row waits', r3.res1.state === 'pending' && r3.c1[0] === '627' && r3.c1[4] === '7DHFWP7UNK' && r3.fs1.join() === '627,2', r3);
    T('E7  the next start finishes both: TO627, and the For Sale row', r3.res2.state === 'done' && r3.c2[0] === 'TO627' && r3.fs2.join() === 'TO627,1', r3);
    T('E3  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOFIN = plant(DATA, "      if (n !== bp.e[0]) return;\n      hit = bp; fin = true;", "      return;", 'half-way finish');
    const b = await bootApp(browser, { 'app-data.js': NOFIN });
    const r4 = await b.pg.evaluate(`(async function () { ${world({ gone: true })};
      window.__np.failOn = new RegExp('My Collection!A' + state.personalData.nab627.row + ':');
      await rrNabPaperCatchUp(); ${RELOAD('same')}; await rrNabPaperCatchUp(); return ${SNAP}; })()`);
    T('PLANTED E: without the half-way case a cut-off copy is stranded under 627 (caught)', r4['60'][0] === '627', r4['60']);
    await b.pg.close();
  }

  // ── F: the two passes, either order ──────────────────────────────────────
  console.log('\n== F · the renumber pass and this pass, in either order → the same sheet ==');
  {
    const { pg, errs } = await bootApp(browser);
    const run = order => `(async function () { ${world({ gone: true })};
      ${order === 'np-first' ? 'await rrNabPaperCatchUp(); await rrVarRenumberCatchUp();' : 'await rrVarRenumberCatchUp(); await rrNabPaperCatchUp();'}
      return JSON.stringify(window.__np.S); })()`;
    const a = await pg.evaluate(run('np-first')), b2 = await pg.evaluate(run('rn-first'));
    T('F1  same final sheet either way', a === b2, [a.length, b2.length]);
    const r = await pg.evaluate(`(async function () { ${world({ gone: true })}; const rn = await rrVarRenumberCatchUp(); return { rn, s: ${SNAP} }; })()`);
    T('F2  the renumber pass alone never touches a sheet\'s copy (2338 var 1 with the sheet\'s Row ID stays for this pass)', r.s['61'].slice(0, 2).join() === '2338,1' && r.s['61'][4] === '984VYR3KRQ', r.s['61']);
    T('F3  …and its ready-check no longer needs the Items rows (they are gone here)', await pg.evaluate(`(function () { ${world({ gone: true })}; return rrVarRenumberLive(); })()`) === true);
    T('F4  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── G: the back-fills and a save ─────────────────────────────────────────
  console.log('\n== G · the back-fills and a save never link a sheet\'s copy ==');
  const backfillRun = `(async function () {
    window.sheetsBatchGet = sheetsBatchGet = async function (sid, ranges) {
      const S = window.__np.S[PERSONAL_TAB], F = PERSONAL_FIELD_INDEX, rows = Object.keys(S).map(Number).sort((a, b) => a - b);
      const col = i => rows.map(rn => [S[rn][i] || '']);
      return { valueRanges: [{ values: [['Master Row ID']] }, { values: col(0) }, { values: col(F.inventoryId) }] };
    };
    window._withTokenRetry = _withTokenRetry = async function (fn) { return { ok: true, json: async () => ({}) }; };
    await window._rrBackfillMasterRowIds();
    return state.personalData.new520.masterRowId || '';
  })()`;
  const saveRun = `(function () {
    const F = PERSONAL_FIELD_INDEX, p = state.personalData.new520;   // 520 var 3, no link — the pass has not run yet
    const row = rrPersonalUpdateRow(p, { itemNum: p.itemNum, variation: p.variation, condition: '8', era: p.era || '', manufacturer: p.manufacturer || '', masterRowId: p.masterRowId || '', masterKey: p.masterKey || '' });
    return { rid: row[F.masterRowId] || '', key: row[F.masterKey] || '' };
  })()`;
  {
    const { pg, errs } = await bootApp(browser);
    const g1 = await pg.evaluate(`(async function () { ${world({ gone: true })}; return ${backfillRun}; })()`);
    T('G1  the Row ID back-fill gives the no-link 520 var 3 (a sheet) NO link', g1 === '', g1);
    const g2 = await pg.evaluate(`(function () { ${world({ gone: true })}; return ${saveRun}; })()`);
    T('G2  an edit saved before the pass runs gives it NO link either', g2.rid === '' && g2.key === '', g2);
    const g3 = await pg.evaluate(`(function () { ${world({ gone: true })}; return [rrVarRenumberHolds({ itemNum: '520', variation: '1', era: 'pw' }), rrVarRenumberHolds({ itemNum: '520', variation: '3', era: 'pw' }), rrVarRenumberHolds({ itemNum: '520', variation: '3', era: 'mth', masterKey: 'mth|520|' })]; })()`);
    T('G3  the hold is narrow: an engine 520 var 1 is NOT held; 520 var 3 is; another catalog\'s 520 is not', g3.join() === 'false,true,false', g3);
    T('G4  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOHOLD = plant(DATA, "  if (!p || !(_rrRnOldOf(p.itemNum) || _rrNpAt(p.itemNum, p.variation, false) || _rrNpAt(p.itemNum, p.variation, true))) return false;",
      "  if (!p || !_rrRnOldOf(p.itemNum)) return false;", 'the sheet hold');
    const b = await bootApp(browser, { 'app-data.js': NOHOLD });
    const g5 = await b.pg.evaluate(`(function () { ${world({ gone: true })}; return ${saveRun}; })()`);
    T('PLANTED G: without the sheet hold a save ties the 520 var 3 sheet to an ENGINE row (caught)', g5.rid !== '' && !/^(PZH69CU3WJ|PVNX8WEWNZ)$/.test(g5.rid), g5);
    await b.pg.close();
    const NOVAR = plant(APPJS, "rrVarRenumberHolds({ itemNum: inum, variation: vari, masterKey:", "rrVarRenumberHolds({ itemNum: inum, masterKey:", 'variation on the save hold');
    const c = await bootApp(browser, { 'app.js': NOVAR });
    const g6 = await c.pg.evaluate(`(function () { ${world({ gone: true })}; return ${saveRun}; })()`);
    T('PLANTED G2: the save asking without the variation ties it to an ENGINE row (caught)', g6.rid !== '', g6);
    await c.pg.close();
  }

  // ── H: one rule for an entry's fields ────────────────────────────────────
  console.log('\n== H · "Change catalog entry" and this pass share ONE rule ==');
  {
    const uses = f => (fs.readFileSync(path.join(APP, f), 'utf8').match(/rrCopyFieldsFromEntry\(/g) || []).length;
    T('H1  defined once (app-data.js) and used by the edit panel and the pass', /function rrCopyFieldsFromEntry\(entry, copy\)/.test(DATA) && uses('app-collection.js') === 1 && uses('app-data.js') === 2, { coll: uses('app-collection.js'), data: uses('app-data.js') });
    T('H2  the edit panel no longer sets an entry\'s fields by hand', !/pd\.masterRowId = \(typeof rrMasterRowIdOf === 'function'\) \? rrMasterRowIdOf\(_entry\)/.test(COLL));
    const { pg, errs } = await bootApp(browser);
    const h = await pg.evaluate(`(function () { ${world({ gone: true })};
      const e = rrMasterByRowId('FU5GD3AXK9'), copy = { era: 'Postwar', manufacturer: 'Lionel', itemType: 'Promotional' };
      const a = rrCopyFieldsFromEntry(e, copy);
      const noType = rrCopyFieldsFromEntry(Object.assign({}, e, { itemType: '' }), copy);
      return { a, noType: ('itemType' in noType) }; })()`);
    T('H3  the fields: the entry\'s key, Row ID, era, variation, both descriptions, maker, type', h.a.masterRowId === 'FU5GD3AXK9' && h.a.masterKey === 'pw|TO2338|1' && h.a.era === 'pw' && h.a.variation === '1' && h.a.itemType === PAPER('FU5GD3AXK9').itemType && h.a.manufacturer === 'Lionel', h.a);
    T('H4  an entry with no type never blanks the copy\'s type', h.noType === false, h);
    T('H5  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── I: load order + one table ────────────────────────────────────────────
  console.log('\n== I · the load order, and one table ==');
  const order = src => { const a = src.indexOf('window.rrNabPaperCatchUp()'), k = src.indexOf('_backfillMasterKeys();'), i = src.indexOf('_backfillMasterRowIds();'); return a > 0 && k > 0 && i > 0 && a < k && a < i; };
  T('I1  the pass is called BEFORE both back-fills on every dashboard build', order(IDENT));
  const moved = plant(IDENT, "          if (typeof window.rrNabPaperCatchUp === 'function') window.rrNabPaperCatchUp();   // 2026-11-08: the Nabisco sheets to the Paper tab — BEFORE the back-fills too\n", '', 'call').replace('_backfillMasterRowIds();', '_backfillMasterRowIds(); window.rrNabPaperCatchUp();');
  T('PLANTED I1: the call moved after the back-fills (caught)', !order(moved));
  const refs = {};
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { const n = (fs.readFileSync(path.join(APP, f), 'utf8').match(/RR_NAB_TO_PAPER\b/g) || []).length; if (n) refs[f] = n; });
  T('I2  the table is defined ONCE (config.js) and read only by app-data.js', /const RR_NAB_TO_PAPER = \{/.test(CONFIG) && Object.keys(refs).sort().join() === 'app-data.js,config.js', refs);
  T('I3  no Paper Row ID of the table is typed anywhere else in app/', (() => {
    const hits = []; FIX.paper.forEach(p => fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'config.js').forEach(f => { if (fs.readFileSync(path.join(APP, f), 'utf8').indexOf(p.rowId) >= 0) hits.push(f + ':' + p.rowId); }));
    return hits.length === 0;
  })());

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
