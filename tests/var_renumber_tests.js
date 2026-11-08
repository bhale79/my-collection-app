#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE COTT RENUMBER CATCH-UP   (2026-11-07; real Chromium, the REAL app)
//
// [stated] Brad 2026-11-07: "It's a variation 1. The Nabisco is a different
// item altogether" → "we line up with the cott website when it comes to
// variations" → "Yes" to the plan. On Lionel PW - Items the Nabisco promo
// sheet held Variation 1 of 2338, 2331, 601, 621 and 627, pushing the real
// engines to 2, 3 …  Master Version 2.86 numbers the engines 1, 2 … in COTT's
// order and puts the Nabisco sheet LAST. A collection saved under the old
// numbers is brought along ONCE per sheet (rrVarRenumberCatchUp, app-data.js;
// the table is RR_VAR_RENUMBER, config.js).
//   A  the table = the real master rows (fixture), COTT order, Nabisco last
//   B  catalog NOT renumbered yet → nothing; read-only / offline → nothing;
//      PLANTED no live check → moves on the old catalog
//   C  renumbered, the plan from a FRESH read (memory empty on purpose):
//      copies by Row ID; a pre-Row-ID Postwar copy by number (gets its Row ID);
//      For Sale / Upgrade rows tied by Inventory ID; Want / Sold rows are NOT
//      moved — listed; another maker untouched; only the variation / link cells
//      written; the diary carries no price / note / photo
//   D  a second session and another device move NOTHING; PLANTED a moved
//      pre-Row-ID copy left without its Row ID → 2331 var 3 → 2 → 1 (caught);
//      belt and braces: with the plan's "still old" check cut, the write's own
//      re-check moves nothing twice
//   E  a pass cut off between the link and the variation write: the next pass
//      finishes it (variation written LAST)
//   F  a tab the sheet does not have is empty, not a stop
//   G  the back-fills never link these numbers; PLANTED the hold removed → a
//      pre-Row-ID 2331 var 3 gets the WRONG engine (PCYWQ6FMHU)
//   H  an OLD-catalog device saving a moved copy does not flip it back to the
//      Nabisco row (rrLinkForVariation); an edit saved on the NEW catalog before
//      the catch-up gives a pre-Row-ID copy no link from the new numbers
//      (buildPersonalRow); PLANTED → each one goes wrong
//   I  the load order (scan, planted) and one table
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
try { require('playwright'); }
catch (e) { console.log('FAILED  —  var_renumber_tests needs playwright and it is not installed.'); process.exit(1); }
const { bootApp, launch } = require('./lib/lars-world');
const APP = path.join(__dirname, '..', 'app');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'var_renumber_2026-11-07.json'), 'utf8'));
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
function plant(src, from, to, what) {
  const out = src.replace(from, to);
  if (out === src) throw new Error('planted ' + what + ': the line moved; update this test');
  return out;
}
const DATA = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
// the Photo Inbox pieces are read through the one reader (pin_source_tests R1)
const PIN = require('./lib/pin-source').pinPieces();
const TOOLS = PIN['photo-inbox-tools.js'];
const IDENT = PIN['photo-inbox-identify.js'];
if (!TOOLS || !IDENT) { console.log('FAILED  —  the Photo Inbox pieces moved (photo-inbox-tools.js / photo-inbox-identify.js)'); process.exit(1); }
const CONFIG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');

// ── The world: the five numbers as the catalog shows them (`renumbered` picks
// old or new numbers), a stand-in Google sheet per tab, a stand-in mark store.
const WORLD = function (o) {
  const FIX = o.fix, NEW = !!o.renumbered;
  const PW = 'Lionel PW - Items';
  const md = FIX.rows.map(r => ({ itemNum: r.itemNum, variation: NEW ? r.newVar : r.oldVar, itemType: r.itemType, subType: r.subType,
    description: r.description, roadName: r.roadName, varDesc: r.varDetails, _era: 'pw', _tab: PW, rowId: r.rowId, yearProd: '1955', gauge: 'O Gauge' }));
  md.push({ itemNum: '2338', variation: '', itemType: 'Diesel Locomotive', description: 'MTH lookalike', _era: 'mth', _tab: 'MTH O', rowId: 'MTHX2338XX', roadName: '', varDesc: '' });
  state.masterData = md;
  _rebuildMasterIndex();
  state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
  try { window._allIdxComplete = true; _allIdxComplete = true; } catch (e) {}
  let row = 3;
  const pd = (n, v, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: inv, row: row++,
    condition: '7', priceItem: '125.00', userEstWorth: '200', notes: 'SECRET-NOTE-' + inv, location: 'SHELF-' + inv,
    photoItem: 'https://drive.google.com/drive/folders/SECRET' + inv, itemType: 'Diesel Locomotive' }, x || {});
  state.personalData = {
    brad: pd('2338', '1', '50', { masterRowId: 'YSGYWFPFA4', masterKey: 'pw|2338|1' }),                 // re-pointed by hand already
    gp:   pd('2338', '3', '51', { masterRowId: '7S6DAP48PX', masterKey: 'pw|2338|3' }),                 // DE0097, old 3 → 2
    sw:   pd('601',  '2', '52', { masterRowId: 'UG2Z78UH4M', masterKey: 'pw|601|2' }),                  // old 2 → 1, listed for sale + upgrade
    old:  pd('2331', '3', '53', { masterRowId: '', masterKey: 'pw|2331|3' }),                           // saved before Row IDs: old 3 → 2
    mth:  pd('2338', '2', '54', { era: 'mth', manufacturer: 'MTH', masterRowId: '', masterKey: 'mth|2338|' }),   // another maker's 2338
    nab:  pd('627',  '1', '55', { masterRowId: '54DG2T2DR5', masterKey: 'pw|627|1', itemType: 'Promotional' }),  // a real Nabisco sheet: 1 → 2
    late: pd('2338', '1', '56', { masterRowId: '', masterKey: '', dateAdded: '2026-11-09' }),         // no link, added AFTER the change: the NEW var 1 (the GP-7)
  };
  state.forSaleData = { '52': { row: 3, itemNum: '601', variation: '2', condition: '7', askingPrice: '300', inventoryId: '52', manufacturer: 'Lionel', notes: 'SECRET-SALE' } };
  state.upgradeData = { '52': { row: 3, itemNum: '601', variation: '2', listType: 'Upgrade', priority: 'High', maxPrice: '400', targetCondition: '9', inventoryId: '52', manufacturer: 'Lionel', notes: 'SECRET-UPG' } };
  state.wantData = {
    '2338|2': { row: 4, itemNum: '2338', variation: '2', listType: 'Want', priority: 'High', expectedPrice: '500', manufacturer: 'Lionel', notes: 'SECRET-W1' },
    '2338|3': { row: 5, itemNum: '2338', variation: '3', listType: 'Want', priority: 'Low', expectedPrice: '300', manufacturer: 'Lionel', notes: 'SECRET-W2' },
    '2338|7': { row: 6, itemNum: '2338', variation: '7', listType: 'Want', priority: 'Low', expectedPrice: '1', manufacturer: 'Lionel', notes: '' },   // no such old number
    '2331|2': { row: 7, itemNum: '2331', variation: '2', listType: 'Want', priority: 'Low', expectedPrice: '1', manufacturer: 'MTH', notes: '' },      // another maker
    '621|2':  { row: 8, itemNum: '621',  variation: '2', listType: 'Want', priority: 'Low', expectedPrice: '1', manufacturer: '', notes: '' },         // no maker: S-Helper uses 621 too
  };
  state.soldData = { 'sold-3': { row: 3, key: 'sold-3', itemNum: '627', variation: '2', copy: '1', salePrice: '250', dateSold: '2026-10-01', inventoryId: '40', manufacturer: 'Lionel', notes: 'SECRET-SOLD' } };
  state.isData = {}; state.mySetsData = {};
  state.personalSheetId = 'SID'; try { window.accessToken = 'tok'; accessToken = 'tok'; } catch (e) {}
  // the stand-in sheet, per tab, whole rows as Google holds them
  const S = { [PERSONAL_TAB]: {}, 'For Sale': {}, 'Want-Upgrade List': {}, 'Sold': {} };
  Object.values(state.personalData).forEach(p => { S[PERSONAL_TAB][p.row] = rrRecordRow(p).map(v => String(v == null ? '' : v).replace(/^'/, '')); });
  Object.values(state.forSaleData).forEach(e => { S['For Sale'][e.row] = [e.itemNum, e.variation, e.condition, e.askingPrice, '', e.notes, '', '', e.inventoryId, e.manufacturer]; });
  Object.values(state.upgradeData).forEach(e => { S['Want-Upgrade List'][e.row] = [e.itemNum, e.variation, 'Upgrade', e.priority, e.maxPrice, e.targetCondition, e.inventoryId, e.notes, e.manufacturer]; });
  Object.values(state.wantData).forEach(e => { S['Want-Upgrade List'][e.row] = [e.itemNum, e.variation, 'Want', e.priority, e.expectedPrice, '', '', e.notes, e.manufacturer]; });
  Object.values(state.soldData).forEach(e => { const r = new Array(SOLD_HEADERS.length).fill(''); r[0] = e.itemNum; r[1] = e.variation; r[5] = e.salePrice; r[7] = e.notes; r[8] = e.inventoryId; r[9] = e.manufacturer; S['Sold'][e.row] = r; });
  const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const parse = range => { const m = /^(.*)!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/.exec(range); return m && { tab: m[1], c0: colIdx(m[2]), r0: Number(m[3]), c1: m[4] ? colIdx(m[4]) : colIdx(m[2]), r1: m[5] ? Number(m[5]) : (m[4] ? 0 : Number(m[3])) }; };
  const W = window.__rn = { S: S, puts: [], failOn: null };
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
  Object.keys(localStorage).filter(k => /^rr_var_renumber_done/.test(k)).forEach(k => localStorage.removeItem(k));
  Object.keys(_rrRnTried).forEach(k => delete _rrRnTried[k]);
  if (o.emptyMemory) { state.personalData = {}; state.wantData = {}; state.forSaleData = {}; state.upgradeData = {}; state.soldData = {}; }
  localStorage.removeItem('rr_sync_log');
  return true;
};
// A new session on the same sheet: memory re-read from the stand-in sheet,
// the once-per-session flag cleared (`device: 'other'` also forgets the
// device's own "done" note — a second device).
const RELOAD = (device) => `(function () {
  const S = window.__rn.S;
  const re = {}; Object.keys(S[PERSONAL_TAB]).forEach(rn => { const rec = rrPersonalRecordFromRow(S[PERSONAL_TAB][rn], Number(rn)); rec.owned = true; re['k' + rn] = rec; });
  state.personalData = re;
  const w = {}; Object.keys(S['Want-Upgrade List']).forEach(rn => { const r = S['Want-Upgrade List'][rn]; if (r[2] === 'Want') w[r[0] + '|' + r[1] + '|' + rn] = { row: Number(rn), itemNum: r[0], variation: r[1], listType: 'Want', manufacturer: r[8] }; });
  state.wantData = w;
  Object.keys(_rrRnTried).forEach(k => delete _rrRnTried[k]);
  ${device === 'other' ? "Object.keys(localStorage).filter(k => /^rr_var_renumber_done/.test(k)).forEach(k => localStorage.removeItem(k));" : ''}
  return true;
})()`;
const SNAP = `(function () {
  const S = window.__rn.S, F = PERSONAL_FIELD_INDEX, P = S[PERSONAL_TAB];
  const by = inv => Object.values(P).find(r => r[F.inventoryId] === inv) || [];
  const c = inv => [by(inv)[F.variation], by(inv)[F.masterKey], by(inv)[F.masterRowId]];
  return { brad: c('50'), gp: c('51'), sw: c('52'), old: c('53'), mth: c('54'), nab: c('55'), late: c('56'),
    fs: S['For Sale'][3][1], upg: S['Want-Upgrade List'][3][1],
    want: [4, 5, 6, 7, 8].map(r => S['Want-Upgrade List'][r][1]), sold: S['Sold'][3][1],
    puts: window.__rn.puts.slice(),
    done: Object.keys(localStorage).filter(k => /^rr_var_renumber_done/.test(k)).length,
    diary: localStorage.getItem('rr_sync_log') || '' };
})()`;
const START = { want: '2,3,7,2,2', sold: '2' };

(async () => {
  const browser = await launch();
  const fix = JSON.stringify(FIX);
  const world = (o) => `(${WORLD})(Object.assign({ fix: ${fix} }, ${JSON.stringify(o)}))`;

  // ── A: the table ─────────────────────────────────────────────────────────
  console.log('== A · the table is the real master, renumbered to COTT\'s order ==');
  {
    const { pg, errs } = await bootApp(browser);
    const t = await pg.evaluate(() => RR_VAR_RENUMBER);
    await pg.close();
    const ids = Object.keys(t.rows);
    T('A1  17 rows, one per Row ID, the same 17 the master holds (fixture read from Lionel PW - Items)', ids.length === 17 && FIX.rows.length === 17 && FIX.rows.every(r => t.rows[r.rowId] && t.rows[r.rowId][0] === r.itemNum && t.rows[r.rowId][1] === r.oldVar && t.rows[r.rowId][2] === r.newVar), ids.length);
    const nums = {}; FIX.rows.forEach(r => { (nums[r.itemNum] = nums[r.itemNum] || []).push(r); });
    const okNum = Object.keys(nums).every(n => {
      const rs = nums[n].slice().sort((a, b) => a.newVar - b.newVar);
      const eng = rs.filter(r => r.itemType !== 'Promotional'), nab = rs.filter(r => r.itemType === 'Promotional');
      return nab.length === 1 && rs.map(r => r.newVar).join() === rs.map((r, i) => String(i + 1)).join() && nab[0].newVar === String(rs.length)
        && eng.every((r, i) => r.newVar === String(i + 1) && Number(r.oldVar) === i + 2) && nab[0].oldVar === '1';
    });
    T('A2  each of 2338, 2331, 601, 621, 627: engines 1, 2 … in the old order (COTT\'s), the Nabisco sheet LAST', Object.keys(nums).length === 5 && okNum, Object.keys(nums));
    const cott = FIX.rows.filter(r => r.cottCode).map(r => [r.itemNum, r.cottCode, r.newVar]);
    T('A3  where COTT gives a code, the codes run up with the new numbers (2338: DE0097 → 2, DE0098 → 3, DE0099 → 4)', ['2338', '2331', '601', '621'].every(n => { const c = cott.filter(x => x[0] === n).sort((a, b) => a[2] - b[2]).map(x => x[1]); return c.join() === c.slice().sort().join(); }), cott);
    T('A4  no page errors', errs.length === 0, errs);
  }

  // ── B: not now ───────────────────────────────────────────────────────────
  console.log('\n== B · not renumbered yet, read-only or offline → nothing ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ renumbered: false })};
      const live = rrVarRenumberLive(); const res = await rrVarRenumberCatchUp();
      const s = ${SNAP}; return { live, res, puts: s.puts.length }; })()`);
    T('B1  live = false while the loaded catalog still shows the old numbers', r.live === false, r);
    T('B2  the catch-up does nothing: no write', r.res === null && r.puts === 0, r);
    const r2 = await pg.evaluate(`(async function () { ${world({ renumbered: true })};
      window._readOnlyMode = true; const ro = await rrVarRenumberCatchUp(); window._readOnlyMode = false;
      window._offlineMode = true; const off = await rrVarRenumberCatchUp(); window._offlineMode = false;
      const s = ${SNAP}; return { ro, off, puts: s.puts.length }; })()`);
    T('B3  read-only (no subscription) → nothing', r2.ro === null && r2.puts === 0, r2);
    T('B4  offline → nothing', r2.off === null && r2.puts === 0, r2);
    T('B5  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOLIVE = plant(DATA, '  if (!rrVarRenumberLive()) return null;\n  _rrRnTried[sid] = true;', '  _rrRnTried[sid] = true;', 'live check');
    const b = await bootApp(browser, { 'app-data.js': NOLIVE });
    const r3 = await b.pg.evaluate(`(async function () { ${world({ renumbered: false })}; await rrVarRenumberCatchUp(); return ${SNAP}; })()`);
    T('PLANTED B: the catch-up without its live check moves copies on the OLD catalog (caught)', r3.puts.length > 0, r3.puts);
    await b.pg.close();
  }

  // ── C + D: renumbered ───────────────────────────────────────────────────
  console.log('\n== C · renumbered → only rows that say which catalog row they are, from a fresh read ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ renumbered: true, emptyMemory: true })};
      const S = window.__rn.S, before = JSON.parse(JSON.stringify(S));
      const live = rrVarRenumberLive();
      const res = await rrVarRenumberCatchUp();
      const s1 = ${SNAP};
      const changed = [];
      Object.keys(S).forEach(tab => Object.keys(S[tab]).forEach(rn => (S[tab][rn] || []).forEach((v, i) => {
        const was = (before[tab][rn] || [])[i];
        if (String(v) === String(was == null ? '' : was)) return;
        changed.push(tab === PERSONAL_TAB ? 'P' + rn + ':' + PERSONAL_SCHEMA[i].field : tab + rn + ':' + i);
      })));
      const again = await rrVarRenumberCatchUp();   // same session
      ${RELOAD('same')};
      const p0 = window.__rn.puts.length;
      const res2 = await rrVarRenumberCatchUp();    // next start, same device
      ${RELOAD('other')};
      const res3 = await rrVarRenumberCatchUp();    // another device
      return { live, res, s1, changed, again, res2, res3, puts2: window.__rn.puts.length - p0 };
    })()`);
    const s = r.s1;
    T('C1  live = true once the loaded catalog shows every new number', r.live === true, r.live);
    T('C2  BY ROW ID: 2338 DE0097 copy 3 → 2, its link follows (pw|2338|2, same Row ID)', s.gp[0] === '2' && s.gp[1] === 'pw|2338|2' && s.gp[2] === '7S6DAP48PX', s.gp);
    T('C3  BY ROW ID: 601 copy 2 → 1, and its For Sale row and Upgrade row follow it (2 → 1)', s.sw[0] === '1' && s.sw[1] === 'pw|601|1' && s.fs === '1' && s.upg === '1', [s.sw, s.fs, s.upg]);
    T('C4  a real Nabisco sheet owned as 627 var 1 → 2 (the sheet went last)', s.nab[0] === '2' && s.nab[1] === 'pw|627|2' && s.nab[2] === '54DG2T2DR5', s.nab);
    T('C5  Brad\'s 2338 (already Var 1 on the orange-band GP-7) is NOT touched', s.brad.join() === '1,pw|2338|1,YSGYWFPFA4', s.brad);
    T('C6  a Postwar 2331 saved before Row IDs (key pw|2331|3) → 2, and gets its Row ID (9G9JMW43RG)', s.old[0] === '2' && s.old[1] === 'pw|2331|2' && s.old[2] === '9G9JMW43RG', s.old);
    T('C7  another maker\'s 2338 (MTH, var 2) is NOT touched', s.mth.join() === '2,mth|2338|,', s.mth);
    T('C7b a Postwar 2338 with no link added AFTER the change day (the new Var 1, the GP-7) is NOT moved to the Nabisco number — named as stuck', s.late.join() === '1,,' && r.res.stuck.some(x => /2338 var 1 \(added after the change\)/.test(x)), [s.late, r.res.stuck]);
    T('C8  Want and Sold rows are NOT moved (no catalog link says which numbering they are in)', s.want.join() === START.want && s.sold === START.sold, [s.want, s.sold]);
    T('C9  …they are LISTED instead: Want 2338 var 2, 2338 var 3, the no-maker 621 var 2, Sold 627 var 2 (not the MTH row, not var 7)', r.res.listed.length === 4 && r.res.listed.join('|').indexOf('2331') < 0 && /renumber-listed[^}]*W row 4 2338 var 2/.test(s.diary), [r.res.listed, s.diary.slice(0, 300)]);
    T('C10 the plan came from the SHEET (memory was empty on purpose): 6 rows moved', r.res.fixed === 6 && r.res.state === 'done', r.res);
    T('C11 only Variation / Master Key / Master Row ID cells (and list column B) changed — nothing else on any row', r.changed.every(c => /:(variation|masterKey|masterRowId)$/.test(c) || /^(For Sale|Want-Upgrade List)\d+:1$/.test(c)) && r.changed.length === 11, r.changed);
    T('C12 each copy: the link written FIRST, the variation LAST (2338 row 4: Master Key AK4 before Variation G4)', s.puts.indexOf('My Collection!AK4:AK4') >= 0 && s.puts.indexOf('My Collection!G4:G4') > s.puts.indexOf('My Collection!AK4:AK4'), s.puts);
    T('C13 a diary line per change; PRIVACY: no price, note, location or photo link in it', (s.diary.match(/renumber-fix/g) || []).length === 6 && !/SECRET|SHELF|125\.00|drive\.google|"200"|"300"|"500"/.test(s.diary), s.diary.slice(0, 500));
    T('C14 once per session (a second start is a no-op)', r.again === null, r.again);
    console.log('\n== D · a second session, a second device → nothing moves again ==');
    T('D1  the next start on this device: not even asked (the device remembers)', r.res2 === null, r.res2);
    T('D2  another device: reads, finds nothing at an old number, writes nothing', r.res3 && r.res3.state === 'done' && r.res3.fixed === 0 && r.puts2 === 0, { res3: r.res3, puts2: r.puts2 });
    T('C15 no page errors', errs.length === 0, errs);
    await pg.close();
    // PLANTED: a moved pre-Row-ID copy left without its Row ID → the next pass reads its NEW number as an old one
    const NOID = plant(DATA, "rrPersonalUpdateRow(cur, { variation: e.v, masterKey: target ? rrMasterKeyOf(target) : '', masterRowId: e.id })",
      "rrPersonalUpdateRow(cur, { variation: e.v, masterKey: target ? rrMasterKeyOf(target) : '', masterRowId: cur.masterRowId || '' })", 'Row ID on the move');
    const b = await bootApp(browser, { 'app-data.js': NOID });
    const r2 = await b.pg.evaluate(`(async function () { ${world({ renumbered: true })};
      await rrVarRenumberCatchUp(); ${RELOAD('other')}; await rrVarRenumberCatchUp(); return ${SNAP}; })()`);
    T('PLANTED D: a moved pre-Row-ID copy left without its Row ID is moved AGAIN — 2331 var 3 → 2 → 1 (caught)', r2.old[0] === '1', r2.old);
    await b.pg.close();
    const NOPLANCHECK = plant(DATA, "      if (_rrRnSame(p.variation, t.old)) plan.push({ t: 'P', r: k + 3, n: n, i: inv, o: t.old, v: t.nu, id: rid });",
      "      plan.push({ t: 'P', r: k + 3, n: n, i: inv, o: t.old, v: t.nu, id: rid });", 'plan check');
    const c = await bootApp(browser, { 'app-data.js': NOPLANCHECK });
    const r3 = await c.pg.evaluate(`(async function () { ${world({ renumbered: true })};
      await rrVarRenumberCatchUp(); ${RELOAD('other')}; const p0 = window.__rn.puts.length; const res = await rrVarRenumberCatchUp();
      return { s: ${SNAP}, res, puts: window.__rn.puts.length - p0 }; })()`);
    T('D3  belt and braces: with the plan\'s "still old" check cut, the write\'s own re-check moves nothing twice', r3.s.gp[0] === '2' && r3.s.brad[0] === '1' && r3.puts === 0, [r3.s.gp, r3.s.brad, r3.res, r3.puts]);
    await c.pg.close();
  }

  // ── E: cut off half way ──────────────────────────────────────────────────
  console.log('\n== E · a pass cut off between the link and the variation → the next pass finishes it ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ renumbered: true })};
      const row = state.personalData.gp.row;
      window.__rn.failOn = new RegExp('My Collection!G' + row + ':G' + row + '$');   // the variation write fails
      const res1 = await rrVarRenumberCatchUp(); const s1 = ${SNAP};
      ${RELOAD('same')};
      const res2 = await rrVarRenumberCatchUp(); const s2 = ${SNAP};
      return { res1, gp1: s1.gp, done1: s1.done, res2, gp2: s2.gp }; })()`);
    T('E1  cut off: the copy is still at its OLD number (its link already written), the pass is pending — the device does not mark it done', r.res1.state === 'pending' && r.gp1[0] === '3' && r.gp1[1] === 'pw|2338|2' && r.done1 === 0, [r.res1, r.gp1]);
    T('E2  the next start finishes it: 2 with its link', r.res2.state === 'done' && r.gp2.join() === '2,pw|2338|2,7S6DAP48PX', [r.res2, r.gp2]);
    T('E3  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── F: a tab the sheet does not have ─────────────────────────────────────
  console.log('\n== F · a tab the sheet does not have is empty, not a stop ==');
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ renumbered: true })};
      delete window.__rn.S['Sold'];
      const res = await rrVarRenumberCatchUp(); return { res, s: ${SNAP.replace("sold: S['Sold'][3][1]", "sold: ''")} }; })()`);
    T('F1  no Sold tab: the pass still runs and finishes', r.res.state === 'done' && r.res.fixed === 6, r.res);
    T('F2  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── G: the back-fills ────────────────────────────────────────────────────
  console.log('\n== G · the back-fills never link these numbers ==');
  const backfillRun = `(async function () {
    // the pass has not run (e.g. this start was offline); the Row ID back-fill would fill the blank cell
    window.sheetsBatchGet = sheetsBatchGet = async function (sid, ranges) {
      const S = window.__rn.S[PERSONAL_TAB], F = PERSONAL_FIELD_INDEX, rows = Object.keys(S).map(Number).sort((a, b) => a - b);
      const col = i => rows.map(rn => [S[rn][i] || '']);
      return { valueRanges: [{ values: [['Master Row ID']] }, { values: col(0) }, { values: col(F.inventoryId) }] };
    };
    window._withTokenRetry = _withTokenRetry = async function (fn) { return { ok: true, json: async () => ({}) }; };
    await window._rrBackfillMasterRowIds();
    return { rid: state.personalData.old.masterRowId || '', mth: state.personalData.mth.masterRowId || '' };
  })()`;
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () { ${world({ renumbered: true })}; return ${backfillRun}; })()`);
    T('G1  the Row ID back-fill does NOT give the old-numbered Postwar 2331 (no Row ID yet) a link', r.rid === '', r);
    T('G2  …while another maker\'s 2338 still gets its own (the hold is only for this catalog)', r.mth === 'MTHX2338XX', r);
    T('G3  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOHOLD = plant(TOOLS, "      if (typeof window.rrVarRenumberHolds === 'function' && window.rrVarRenumberHolds(p)) return;   // 2026-11-07: one of the five COTT-renumbered numbers — only the catch-up links these (rrVarRenumberHolds)\n", '', 'Row ID back-fill hold');
    const b = await bootApp(browser, { 'photo-inbox-tools.js': NOHOLD });
    const r2 = await b.pg.evaluate(`(async function () { ${world({ renumbered: true })}; return ${backfillRun}; })()`);
    T('PLANTED G: without the hold the back-fill links the old-numbered 2331 var 3 to the NEW var 3 — a different engine, PCYWQ6FMHU (caught)', r2.rid === 'PCYWQ6FMHU', r2.rid);
    await b.pg.close();
  }

  // ── H: an old-catalog device saving a moved copy ─────────────────────────
  console.log('\n== H · an old-catalog device never flips a moved copy back to the Nabisco row ==');
  const saveOld = `(function () {
    const F = PERSONAL_FIELD_INDEX, p = state.personalData.old;   // 2331 var 3, key pw|2331|3, no Row ID — the catch-up has not run
    // exactly as the edit panel's Save All Changes names them (app-collection.js: masterKey / masterRowId: pd.… || '')
    const row = rrPersonalUpdateRow(p, { itemNum: p.itemNum, variation: p.variation, condition: '8', era: p.era || '', manufacturer: p.manufacturer || '', masterRowId: p.masterRowId || '', masterKey: p.masterKey || '' });
    return { rid: row[F.masterRowId] || '', key: row[F.masterKey] || '', v: row[F.variation] };
  })()`;
  const flip = `(function () {
    const L = rrLinkForVariation('2338', '1', 'pw|2338|1', 'YSGYWFPFA4');   // moved (new numbering) — on the OLD catalog YSGY says 2
    const M = rrLinkForVariation('2338', '3', 'pw|2338|3', '7S6DAP48PX');   // agrees on the old catalog
    return { L: [L.changed, L.masterRowId], M: M.changed };
  })()`;
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(function () { ${world({ renumbered: false })}; return ${flip}; })()`);
    T('H1  a save of the moved 2338 (Var 1 + the GP-7\'s Row ID) on the old catalog keeps its link', r.L[0] === false && r.L[1] === 'YSGYWFPFA4', r);
    const r4 = await pg.evaluate(`(function () { ${world({ renumbered: true })}; return ${saveOld}; })()`);
    T('H2  an edit saved on the NEW catalog before the catch-up runs: the pre-Row-ID 2331 var 3 gets NO link from the new numbers (key kept, Row ID blank)', r4.rid === '' && r4.key === 'pw|2331|3' && r4.v === '3', r4);
    T('H3  no page errors', errs.length === 0, errs);
    await pg.close();
    const NOGUARD = plant(DATA, "  if ((byId && _rrRnTouches(rrMasterRowIdOf(byId))) || (byKey && _rrRnTouches(rrMasterRowIdOf(byKey)))) { out.row = base; return out; }\n", '', 'link guard');
    const b = await bootApp(browser, { 'app-data.js': NOGUARD });
    const r2 = await b.pg.evaluate(`(function () { ${world({ renumbered: false })}; return ${flip}; })()`);
    T('PLANTED H: without the guard the save flips it to the Nabisco row 984VYR3KRQ (caught)', r2.L[0] === true && r2.L[1] === '984VYR3KRQ', r2);
    await b.pg.close();
    const APPJS = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
    const NOSAVEHOLD = plant(APPJS, "if (_mri !== undefined && !_rnHold && (fields.masterRowId", "if (_mri !== undefined && (fields.masterRowId", 'save hold');
    const c = await bootApp(browser, { 'app.js': NOSAVEHOLD });
    const r5 = await c.pg.evaluate(`(function () { ${world({ renumbered: true })}; return ${saveOld}; })()`);
    T('PLANTED H2: without the save\'s hold the edit links the old 2331 var 3 to the NEW var 3 — PCYWQ6FMHU, a different engine (caught)', r5.rid === 'PCYWQ6FMHU', r5);
    await c.pg.close();
  }

  // ── I: load order + one table ────────────────────────────────────────────
  console.log('\n== I · the load order, and one table ==');
  const order = src => { const a = src.indexOf('window.rrVarRenumberCatchUp()'), k = src.indexOf('_backfillMasterKeys();'), i = src.indexOf('_backfillMasterRowIds();'); return a > 0 && k > 0 && i > 0 && a < k && a < i; };
  T('I1  the catch-up is called BEFORE both back-fills on every dashboard build', order(IDENT));
  const moved = plant(IDENT, "          if (typeof window.rrVarRenumberCatchUp === 'function') window.rrVarRenumberCatchUp();   // 2026-11-07: the COTT renumber catch-up — BEFORE the back-fills (they ask rrVarRenumberHolds)\n", '', 'call').replace('_backfillMasterRowIds();', "_backfillMasterRowIds(); window.rrVarRenumberCatchUp();");
  T('PLANTED I1: the call moved after the back-fills (caught)', !order(moved));
  T('I2  both back-fills ask rrVarRenumberHolds', (TOOLS.match(/window\.rrVarRenumberHolds\(p\)\) (continue|return);/g) || []).length === 2);
  const tableRefs = {};
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { const n = (fs.readFileSync(path.join(APP, f), 'utf8').match(/RR_VAR_RENUMBER\b/g) || []).length; if (n) tableRefs[f] = n; });
  T('I3  the table is defined ONCE (config.js) and read only by app-data.js', /const RR_VAR_RENUMBER = \{/.test(CONFIG) && Object.keys(tableRefs).sort().join() === 'app-data.js,config.js', tableRefs);
  T('I4  no Row ID of the table is typed anywhere else in app/', (() => {
    const ids = FIX.rows.map(r => r.rowId); const hits = [];
    fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'config.js').forEach(f => { const s = fs.readFileSync(path.join(APP, f), 'utf8'); ids.forEach(id => { if (s.indexOf(id) >= 0) hits.push(f + ':' + id); }); });
    return hits.length === 0;
  })());

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
