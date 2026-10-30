#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TWO DEVICES NEVER SAVE OVER EACH OTHER — v0.9.2039   (real Chromium, REAL app)
//
// Brad (TRR Pro brainstorm, 2026-10-28): "make sure that if two phones logged
// into the same account and adding or modifing items that they don't overwrite
// or not save over anything" -> "sounds good". Before this release an edit
// re-wrote the WHOLE row from the copy the phone opened, so phone A's save put
// back every column phone B had changed in the meantime.
// Now (rrPersonalSafeWrite, app.js): the save re-reads the row, writes ONLY the
// columns this save changed, and when both phones changed the SAME column it
// asks which one to keep (words: RR_SAFE_SAVE in config.js, one place).
//   P  the pure merge: unchanged columns never written; both-same is fine;
//      both-different is a question; a leading ' or spaces are not a change;
//      column runs join neighbours into one write
//   R  the REAL edit panel with a second phone: B's Notes survive A's
//      Condition edit; same-column → keep mine / keep theirs; the row now holds
//      another item → nothing written; offline → only the changed cell queued;
//      the question's text is escaped
//   S  scan: the words live in config.js only; PLANTED: the "not this save's
//      change" line disabled in a served app.js → R1 catches phone B's Notes lost
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  safe_save_2039_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const NOT_MINE = 'if (m === b) continue;';
function plantedApp() {
  const s = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
  const out = s.replace(NOT_MINE, 'if (false) continue;');
  if (out === s) throw new Error('planted app.js: the "not this save\'s change" line moved; update this test');
  return out;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.app && bare.endsWith('/app/app.js')) return r.fulfill({ body: planted.app, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  // the stand-in world: a small catalog with Row IDs, a collection, a Sheets that records
  await pg.evaluate(() => {
    const PRE = 'Lionel Pre-War', PW = 'Lionel PW - Items', MS = 'Lionel Modern S - Items';
    const mk = (n, v, t, desc, era, tab, id, yr, x) => Object.assign({ itemNum: n, variation: v, itemType: t, description: desc, _era: era, _tab: tab, rowId: id, yearProd: yr || '', roadName: '', gauge: 'O', varDesc: '' }, x || {});
    const motor = mk('800', '', 'Motorized Unit', 'Electric Box Car (2 7/8")', 'prewar', PRE, 'MMMMMMMMMM', '1904-1905', { refLink: 'https://example.test/800' });
    const box = mk('800', '', 'Boxcar', 'Box Car (O gauge)', 'prewar', PRE, 'BBBBBBBBBB', '1915-1926', { roadName: 'Lionel Lines' });
    const boxC = mk('800', 'C', 'Boxcar', 'Box Car, variation C', 'prewar', PRE, 'CCCCCCCCCC', '1915', { varDesc: 'orange body' });
    const boxC2 = mk('800', 'C', 'Boxcar', 'Box Car, variation C, later run', 'prewar', PRE, 'C2C2C2C2C2', '1927', { varDesc: 'brown body' });   // two products share 800 var C
    const alco = mk('2343', '1', 'Diesel Locomotive', 'Santa Fe F3 A unit', 'pw', PW, 'DDDDDDDDDD', '1950');
    const moved = mk('6-49807', '', 'Accessory', 'S gauge accessory', 'mod_s', MS, 'SSSSSSSSSS', '2020');
    state.masterData = [motor, box, boxC, boxC2, alco, moved];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    let row = 3;
    const pd = (n, v, era, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel', inventoryId: inv, row: row++, condition: '7' }, x || {});
    state.personalData = {
      a: pd('800', '', 'prewar', 'INV-A', { masterKey: 'prewar|800|' }),                 // key → the first 800 (the motor car)
      b: pd('800', 'C', 'prewar', 'INV-B', {}),                                           // no key: own match
      c: pd('6-49807', '', 'mod_s', 'INV-C', { masterKey: 'mpc|6-49807|' }),              // the key names a row that MOVED tabs
      d: pd('2343-P', '1', 'pw', 'INV-D', { masterRowId: 'DDDDDDDDDD' }),                  // already has its ID
      e: pd('SIGN-1', '', 'Manual', 'INV-E', { itemType: 'Accessory' }),                   // manual
      f: pd('800', '', 'prewar', 'INV-F', { masterKey: 'prewar|800|', row: 99999 }),       // a placeholder row
      g: pd('800', '', 'prewar', 'INV-G', { masterKey: 'prewar|800|' }),                   // the sheet row no longer holds it
    };
    state.soldData = {}; state.wantData = state.wantData || {}; state.forSaleData = {};
    // the stand-in Sheets: column A and the Inventory ID column as the SHEET has them
    const F = PERSONAL_FIELD_INDEX; const invCol = personalColLetter('inventoryId'), mriCol = personalColLetter('masterRowId');
    const sheetA = {}, sheetInv = {};
    Object.values(state.personalData).forEach(p => { if (p.row !== 99999) { sheetA[p.row] = p.itemNum; sheetInv[p.row] = p.inventoryId; } });
    sheetA[state.personalData.g.row] = '6464-1'; sheetInv[state.personalData.g.row] = 'INV-ZZ';   // g's row was taken by another item
    const last = Math.max(...Object.keys(sheetA).map(Number));
    window.__sheet = { header: 'Master Row ID', reads: [], writes: [], puts: [] };
    window.__rows = {};   // v0.9.2039: whole rows the stand-in sheet holds (row -> cells)
    const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    window.fetch = async function (url, opts) {
      const u = String(url); const method = (opts && opts.method) || 'GET';
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1]));
        window.__sheet.reads.push(ranges);
        return ok({ valueRanges: ranges.map(r => {
          if (r.endsWith('!' + mriCol + '2')) return { range: r, values: [[window.__sheet.header]] };
          if (/!A3:A$/.test(r)) { const v = []; for (let i = 3; i <= last; i++) v.push([sheetA[i] || '']); return { range: r, values: v }; }
          if (new RegExp('!' + invCol + '3:' + invCol + '$').test(r)) { const v = []; for (let i = 3; i <= last; i++) v.push([sheetInv[i] || '']); return { range: r, values: v }; }
          return { range: r, values: [] };
        }) });
      }
      if (/values:batchUpdate/.test(u) && method === 'POST') { window.__sheet.writes.push(JSON.parse(opts.body)); return ok({ totalUpdatedCells: 1 }); }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (m && method === 'GET') {   // rrRowStillIs: A{row}:{inv}{row}; the safe save: the whole row
        const r = decodeURIComponent(m[1]); const rowN = Number((/!A(\d+)/.exec(r) || [])[1]);
        if (window.__rows[rowN]) { const end = colIdx((/:([A-Z]+)\d+$/.exec(r) || [])[1] || 'A'); return ok({ values: [window.__rows[rowN].slice(0, end + 1)] }); }
        const cells = []; cells[0] = sheetA[rowN] || ''; cells[F.inventoryId] = sheetInv[rowN] || '';
        return ok({ values: [cells] });
      }
      if (m && method === 'PUT') {
        const r = decodeURIComponent(m[1]); const body = JSON.parse(opts.body);
        window.__sheet.puts.push({ range: r, body });
        const mm = /!([A-Z]+)(\d+)/.exec(r); const rowN = mm ? Number(mm[2]) : 0;
        if (window.__rows[rowN]) { const c0 = colIdx(mm[1]); (body.values[0] || []).forEach((v, k) => { window.__rows[rowN][c0 + k] = v; }); }
        return ok({ updatedCells: 1 });
      }
      return ok({});
    };
    window.showToast = function () {};
  });
  return { pg, errs };
}




const FILL = `
  const rec = state.personalData.a;
  PERSONAL_SCHEMA.forEach(s => { if (rec[s.field] === undefined || rec[s.field] === '') rec[s.field] = 'v-' + s.field; });
  Object.assign(rec, { itemNum: '800', variation: '', era: 'prewar', manufacturer: 'Lionel', inventoryId: 'INV-A',
    masterKey: 'prewar|800|', masterRowId: 'MMMMMMMMMM', quickEntry: false, condition: '7', boxCond: '6',
    hasBox: 'Yes', allOriginal: 'Yes', userEstWorth: '100', priceItem: '50', priceBox: '10', priceComplete: '60.00',
    dateAdded: '2026-01-02', datePurchased: '2026-01-03', eraPeriod: 'postwar', isError: 'No', yearMade: '1905',
    purchasedFrom: 'C-1700000000000', itemType: 'Motorized Unit' });
`;

async function pureRun(browser) {
  const { pg, errs } = await boot(browser, null);
  const out = await pg.evaluate(() => {
    const F = PERSONAL_FIELD_INDEX, N = PERSONAL_SCHEMA.length;
    const row = () => { const r = []; for (let i = 0; i < N; i++) r.push('x' + i); return r; };
    const base = row();
    const r = {};
    r.same = rrRowMerge(base, row(), row());
    const mine = row(); mine[F.condition] = '9';
    r.mineOnly = rrRowMerge(base, mine, row());
    const cur = row(); cur[F.notes] = 'phone B';
    r.theirsOnly = rrRowMerge(base, mine, cur);
    const curSame = row(); curSame[F.condition] = '9';
    r.bothSame = rrRowMerge(base, mine, curSame);
    const curDiff = row(); curDiff[F.condition] = '5';
    r.bothDiff = rrRowMerge(base, mine, curDiff);
    r.condIdx = F.condition;
    const quoted = row(); quoted[F.itemNum] = "'" + base[F.itemNum] + '  ';
    r.quoted = rrRowMerge(base, quoted, row());
    r.runs = JSON.stringify(rrColumnRuns([9, 4, 3, 5]));
    r.noRuns = JSON.stringify(rrColumnRuns([]));
    return r;
  });
  await pg.close();
  return { out, errs };
}

// The REAL panel. phoneB(rowCells, F) runs AFTER the panel opened and BEFORE
// Save — that is the second phone's save landing in between.
async function twoPhones(browser, o) {
  const { pg, errs } = await boot(browser, o.planted || null);
  const out = await pg.evaluate(new Function('o', FILL + `
    return (async () => {
      const F = PERSONAL_FIELD_INDEX;
      window.__rows[rec.row] = rrRecordRow(rec);
      window.__asks = [];
      window.appConfirm = async function (msg, opts) { window.__asks.push({ msg: msg, opts: opts }); return o.answer; };
      window.__moved = 0; window.rrRowMovedToast = function () { window.__moved++; };
      window.__queued = [];
      if (o.offline) {
        window._offlineMode = true;
        const real = window.sheetsUpdate;
        window.sheetsUpdate = async function (sid, range, values) { window.__queued.push({ range: range, values: values }); };
      }
      const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
      showItemPanel(idxMotor, 'a', 'edit');
      // ── phone B saves while phone A has the panel open ──
      const B = window.__rows[rec.row];
      if (o.bNotes != null) B[F.notes] = o.bNotes;
      if (o.bCond != null) B[F.condition] = o.bCond;
      if (o.bInv != null) B[F.inventoryId] = o.bInv;
      const getsBefore = window.__sheet.puts.length;
      const ov = document.getElementById('item-panel-overlay');
      const rowsOf = () => Array.from(ov.querySelectorAll('#item-panel-fields-container > div'));
      const condRow = () => rowsOf().find(d => /^Condition/.test(d.textContent.trim()));
      condRow().querySelector('button').click();
      const inp = document.getElementById('panel-inp-condition'); if (inp) inp.value = o.aCond || '9';
      Array.from(condRow().querySelectorAll('button')).find(b => b.textContent === '✓').click();
      Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
      await new Promise(res => setTimeout(res, 900));
      const row = window.__rows[rec.row];
      const puts = window.__sheet.puts.map(p => p.range).filter(r => new RegExp('![A-Z]+' + rec.row + '(:|$)').test(r));
      const cell = f => PERSONAL_TAB + '!' + personalColLetter(f) + rec.row + ':' + personalColLetter(f) + rec.row;
      const live = state.personalData.a;
      return {
        notes: row[F.notes], cond: row[F.condition], inv: row[F.inventoryId],
        puts: puts, condCell: cell('condition'),
        asks: window.__asks.map(a => ({ msg: a.msg, title: a.opts && a.opts.title, ok: a.opts && a.opts.ok, cancel: a.opts && a.opts.cancel })),
        moved: window.__moved, queued: window.__queued.map(q => q.range).filter(r => new RegExp('![A-Z]+' + rec.row + '(:|$)').test(r)),   // this item's row (other rows get background repairs in this world)
        liveNotes: live.notes, liveCond: live.condition,
        words: RR_SAFE_SAVE,
      };
    })();
  `), o);
  await pg.close();
  return { out, errs };
}

(async () => {
  console.log('== S · scan ==');
  const appSrc = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
  const cfgSrc = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  const fn = appSrc.slice(appSrc.indexOf('async function rrPersonalSafeWrite'), appSrc.indexOf('window.rrPersonalSafeWrite'));
  T('S1 the question\'s words are in config.js (RR_SAFE_SAVE)', /const RR_SAFE_SAVE = \{/.test(cfgSrc) && /Changed on another device/.test(cfgSrc));
  T('S2 ...and NOT typed again in app.js (one place)', !/Changed on another device|Keep mine|was changed on another device|\(blank\)/.test(appSrc));
  T('S3 the safe save never writes the whole row (no personalFullRowRange in a write)', !/sheetsUpdate[^;]*personalFullRowRange/.test(fn) && /personalFullRowRange/.test(fn));
  T('S4 the "not this save\'s change" line is there', appSrc.includes(NOT_MINE));
  T('S5 sheet text in the question is escaped (rrEsc)', /rrEsc\(v\.length/.test(fn) && /rrEsc\(c\.header\)/.test(fn));
  const callers = ['app-collection.js', 'wizard-save.js'].map(f => (fs.readFileSync(path.join(APP, f), 'utf8').match(/rrPersonalSafeWrite\(/g) || []).length);
  T('S6 the edit panel and both wizard re-saves go through it (1 + 2)', callers[0] >= 1 && callers[1] >= 2, callers);

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('\n== P · the merge ==');
  const p = await pureRun(browser); const a = p.out;
  T('P0 no script error', p.errs.length === 0, p.errs);
  T('P1 nothing changed → nothing written, nothing asked', a.same.write.length === 0 && a.same.conflicts.length === 0, a.same);
  T('P2 this phone changed Condition → Condition alone is written', JSON.stringify(a.mineOnly.write) === JSON.stringify([a.condIdx]) && a.mineOnly.conflicts.length === 0, a.mineOnly);
  T('P3 the other phone changed Notes → still only Condition written (Notes left as B saved it)', JSON.stringify(a.theirsOnly.write) === JSON.stringify([a.condIdx]) && a.theirsOnly.conflicts.length === 0, a.theirsOnly);
  T('P4 both phones made the SAME change → written, no question', JSON.stringify(a.bothSame.write) === JSON.stringify([a.condIdx]) && a.bothSame.conflicts.length === 0, a.bothSame);
  T('P5 both changed the same column DIFFERENTLY → a question, not a write', a.bothDiff.write.length === 0 && a.bothDiff.conflicts.length === 1 && a.bothDiff.conflicts[0].mine === '9' && a.bothDiff.conflicts[0].theirs === '5' && a.bothDiff.conflicts[0].field === 'condition', a.bothDiff);
  T('P6 a text-guard \' or trailing spaces are not a change', a.quoted.write.length === 0, a.quoted);
  T('P7 neighbouring columns join into one write; none → none', a.runs === '[[3,5],[9,9]]' && a.noRuns === '[]', a);

  console.log('\n== R · two phones, the REAL edit panel ==');
  const r1 = await twoPhones(browser, { bNotes: 'phone B wrote this' });
  T('R0 no script error', r1.errs.length === 0, r1.errs);
  T('R1 phone B\'s Notes SURVIVE phone A\'s Condition edit', r1.out.notes === 'phone B wrote this' && r1.out.cond === '9', r1.out);
  T('R1b ...as one write of the Condition cell, no question asked', r1.out.puts.length === 1 && r1.out.puts[0] === r1.out.condCell && r1.out.asks.length === 0, r1.out);
  T('R1c ...and phone A\'s screen now shows B\'s Notes too', r1.out.liveNotes === 'phone B wrote this' && r1.out.liveCond === '9', r1.out);

  const r2 = await twoPhones(browser, { bCond: '5', answer: true });
  T('R2 same column, different values → the person is ASKED', r2.out.asks.length === 1, r2.out.asks);
  const q = r2.out.asks[0] || {}; const W = r2.out.words || {};
  T('R2b ...in the words from config.js, naming the column and both values', q.title === W.title && /Condition/.test(q.msg) && q.msg.includes('“5”') && q.msg.includes('“9”') && q.ok === W.keepMine.replace('{mine}', '“9”') && q.cancel === W.keepTheirs.replace('{theirs}', '“5”'), q);
  T('R2c "Keep mine" → 9 is saved', r2.out.cond === '9' && r2.out.puts.length === 1, r2.out);
  const r3 = await twoPhones(browser, { bCond: '5', answer: false });
  T('R3 "Keep theirs" → 5 stays, nothing written', r3.out.cond === '5' && r3.out.puts.length === 0, r3.out);
  T('R3b ...and phone A\'s screen shows 5', r3.out.liveCond === '5', r3.out);

  const r4 = await twoPhones(browser, { bInv: 'INV-SOMEONE-ELSE', answer: true });
  T('R4 the row now holds ANOTHER item → nothing written', r4.out.puts.length === 0 && r4.out.inv === 'INV-SOMEONE-ELSE', r4.out);
  T('R4b ...and the person is told (row-moved notice)', r4.out.moved === 1, r4.out);

  const r5 = await twoPhones(browser, { offline: true });
  T('R5 offline → only the Condition cell is queued (no whole row waiting to overwrite later)', r5.out.queued.length === 1 && r5.out.queued[0] === r5.out.condCell, r5.out);

  const r6 = await twoPhones(browser, { bCond: '<b>5</b>', answer: false });
  const q6 = (r6.out.asks[0] || {});
  T('R6 a "<" from the sheet is escaped in the question', q6.msg && !q6.msg.includes('<b>') && q6.msg.includes('&lt;b&gt;'), q6);

  const rp = await twoPhones(browser, { planted: { app: plantedApp() }, bNotes: 'phone B wrote this', answer: true });
  T('S7 PLANTED: the "not this save\'s change" line disabled → phone B\'s Notes are LOST (R1 catches it)', rp.out.notes !== 'phone B wrote this', rp.out);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
