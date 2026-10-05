#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ROW ID STEP 4 — v0.9.1882   (real Chromium, the REAL app, a stand-in Sheets)
//
// [stated] Brad: "yes" — CATALOG_ROW_ID_PLAN_2026-10-04, Step 4.
//
// A  the backfill: every saved item gets Master Row ID = the ID of the entry
//    the app shows today — ONE read, ONE write for the batch; a row whose
//    sheet cell no longer holds the item is skipped; items that have an ID,
//    manual items, placeholder rows: untouched; no header → nothing written;
//    PLANTED: the identity check cut out → the moved row is written
// B  "Change catalog entry" in the item's Edit: the cards list every entry
//    under the number (all makers); picking one and saving writes THAT row's
//    Row ID, key, type, maker and descriptions; Cancel forgets the pick;
//    PLANTED: the variation re-derivation left in → the pick is overridden
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  row_id_step4_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

function plantedInbox() {
  let s = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
  const re = /\n        if \(!ok\) \{ console\.warn\('\[RowId\] row ' \+ t\.p\.row \+ ' is not ' \+ wantNum \+ ' any more — skipped this pass'\); return; \}\n/;
  const out = s.replace(re, '\n');
  if (out === s) throw new Error('planted photo-inbox.js: the identity check moved; update this test');
  return out;
}
function plantedPanel() {
  const s = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  const out = s.replace('if (_varChanged && !_entry) {', 'if (_varChanged) {');
  if (out === s) throw new Error('planted app-collection.js: the guard moved; update this test');
  return out;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.inbox && bare.endsWith('/app/photo-inbox.js')) return r.fulfill({ body: planted.inbox, contentType: 'application/javascript' });
    if (planted && planted.panel && bare.endsWith('/app/app-collection.js')) return r.fulfill({ body: planted.panel, contentType: 'application/javascript' });
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
      if (m && method === 'GET') {   // rrRowStillIs: A{row}:{inv}{row}
        const r = decodeURIComponent(m[1]); const rowN = Number((/!A(\d+)/.exec(r) || [])[1]);
        const cells = []; cells[0] = sheetA[rowN] || ''; cells[F.inventoryId] = sheetInv[rowN] || '';
        return ok({ values: [cells] });
      }
      if (m && method === 'PUT') { window.__sheet.puts.push({ range: decodeURIComponent(m[1]), body: JSON.parse(opts.body) }); return ok({ updatedCells: 1 }); }
      return ok({});
    };
    window.showToast = function () {};
  });
  return { pg, errs };
}

async function backfill(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(async () => {
    await window._rrBackfillMasterRowIds();
    const w = window.__sheet.writes;
    const p = state.personalData;
    const r1 = { reads: window.__sheet.reads.length, writes: w.length, data: w.length ? w[0].data.map(d => d.range + '=' + d.values[0][0]).sort() : [], input: w.length ? w[0].valueInputOption : '',
      ids: { a: p.a.masterRowId || '', b: p.b.masterRowId || '', c: p.c.masterRowId || '', d: p.d.masterRowId || '', e: p.e.masterRowId || '', f: p.f.masterRowId || '', g: p.g.masterRowId || '' } };
    await window._rrBackfillMasterRowIds();   // a second pass: nothing left to write
    r1.secondWrites = window.__sheet.writes.length;
    return r1;
  });
  const noHeader = await pg.evaluate(async () => {
    Object.values(state.personalData).forEach(p => { if (p.inventoryId !== 'INV-D') delete p.masterRowId; });
    window.__sheet.header = 'Stock Photo Link'; window.__sheet.writes = [];
    await window._rrBackfillMasterRowIds();
    return { writes: window.__sheet.writes.length, a: state.personalData.a.masterRowId || '' };
  });
  await pg.close();
  return { out, noHeader, errs };
}

async function panel(browser, planted, pick) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(async (pick) => {
    const r = {};
    const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
    showItemPanel(idxMotor, 'a', 'edit');
    const ov = document.getElementById('item-panel-overlay');
    const rows = Array.from(ov.querySelectorAll('#item-panel-fields-container > div'));
    const entryRow = rows.find(d => /Catalog entry/.test(d.textContent));
    r.hasField = !!entryRow;
    r.shown = entryRow ? entryRow.querySelector('span').textContent : '';
    const btn = entryRow && Array.from(entryRow.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent));
    r.hasButton = !!btn;
    if (btn) btn.click();
    const cards = Array.from(ov.querySelectorAll('[data-rr-entry]'));
    r.cards = cards.map(c => c.getAttribute('data-rr-entry') + (/— current/.test(c.textContent) ? '*' : ''));
    r.cardText = cards.map(c => c.textContent.replace(/\s+/g, ' ').trim());
    r.cottLink = !!ov.querySelector('[data-rr-entry="MMMMMMMMMM"] a[href*="example.test"]');
    const target = cards.find(c => c.getAttribute('data-rr-entry') === pick);
    if (target) target.click();
    const after = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
    r.staged = after ? after.querySelector('span').textContent : '';
    r.stagedOnRecord = state.personalData.a._newEntry ? state.personalData.a._newEntry.rowId : '';
    const save = Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent));
    save.click();
    await new Promise(res => setTimeout(res, 600));
    const put = window.__sheet.puts[0];
    const F = PERSONAL_FIELD_INDEX;
    r.putRange = put ? put.range : '';
    const v = put ? put.body.values[0] : [];
    r.written = put ? { id: v[F.masterRowId], key: v[F.masterKey], type: v[F.itemType], road: v[F.roadName], desc: v[F.masterDescription], varDesc: v[F.variationDescription], era: v[F.era], mfr: v[F.manufacturer], num: v[F.itemNum], variation: v[F.variation] } : null;
    r.record = { id: state.personalData.a.masterRowId || '', key: state.personalData.a.masterKey || '', staged: !!state.personalData.a._newEntry };
    r.closed = !document.getElementById('item-panel-overlay');
    return r;
  }, pick);
  await pg.close();
  return { out, errs };
}

async function cancelCase(browser) {
  const { pg, errs } = await boot(browser, null);
  const out = await pg.evaluate(() => {
    const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
    showItemPanel(idxMotor, 'a', 'edit');
    const ov = document.getElementById('item-panel-overlay');
    const entryRow = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
    Array.from(entryRow.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent)).click();
    ov.querySelector('[data-rr-entry="BBBBBBBBBB"]').click();
    const stagedBefore = !!state.personalData.a._newEntry;
    Array.from(ov.querySelectorAll('button')).find(b => /^Cancel$/.test(b.textContent.trim())).click();
    return { stagedBefore, stagedAfter: !!state.personalData.a._newEntry, puts: window.__sheet.puts.length, closed: !document.getElementById('item-panel-overlay') };
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== A · the backfill: every saved item gets the ID of the entry the app shows today ==');
  const bf = await backfill(browser, null);
  const o = bf.out;
  T('A0 the page ran without a script error', bf.errs.length === 0, bf.errs);
  T('A1 ONE read (header + column A + the Inventory ID column) and ONE write for the whole batch', o.reads === 1 && o.writes === 1, { reads: o.reads, writes: o.writes });
  T('A2 the IDs written: a → the motor car (its key\'s first row), b → variation C, c → the row the app shows for the MOVED 6-49807 — three cells, RAW',
    JSON.stringify(o.data) === JSON.stringify(['My Collection!AY3=MMMMMMMMMM', 'My Collection!AY4=CCCCCCCCCC', 'My Collection!AY5=SSSSSSSSSS']) && o.input === 'RAW', o);
  T('A3 memory learns the IDs the moment the sheet does', o.ids.a === 'MMMMMMMMMM' && o.ids.b === 'CCCCCCCCCC' && o.ids.c === 'SSSSSSSSSS', o.ids);
  T('A4 an item that already has its ID, a manual item and a placeholder row are untouched', o.ids.d === 'DDDDDDDDDD' && o.ids.e === '' && o.ids.f === '', o.ids);
  T('A5 the row the sheet no longer holds (g: another item sits there now) is SKIPPED — nothing written to it', o.ids.g === '' && !o.data.some(d => /AY9=/.test(d)), o);
  T('A6 a second pass writes nothing (done is done)', o.secondWrites === 1, o.secondWrites);
  T('A7 without the "Master Row ID" header (the column not there yet) nothing is written', bf.noHeader.writes === 0 && bf.noHeader.a === '', bf.noHeader);
  const pbf = await backfill(browser, { inbox: plantedInbox() });
  T('A8 PLANTED: the identity check cut out → the moved row g IS written (A5 catches it)', pbf.out.data.some(d => /AY9=MMMMMMMMMM/.test(d)), pbf.out.data);

  console.log('\n== B · "Change catalog entry" in the item\'s Edit ==');
  const pn = await panel(browser, null, 'BBBBBBBBBB');
  const p = pn.out;
  T('B0 the page ran without a script error', pn.errs.length === 0, pn.errs);
  T('B1 every catalog item shows its Catalog entry — the row the app resolves today (the motor car)', p.hasField && /Motorized Unit/.test(p.shown) && /Lionel Pre-War/.test(p.shown), p.shown);
  T('B2 Edit offers "Change catalog entry"', p.hasButton);
  T('B3 the cards list EVERY entry under the number — the motor car (current), the O-gauge boxcar, the two variation-C products; the A unit is not among them',
    JSON.stringify(p.cards) === JSON.stringify(['MMMMMMMMMM*', 'BBBBBBBBBB', 'CCCCCCCCCC', 'C2C2C2C2C2']), p.cards);
  T('B4 a card shows the era, the variation, type · road · year, the full description and a see-it link', p.cardText.some(t => /Var C/.test(t) && /orange body/.test(t)) && p.cardText.some(t => /Lionel Lines/.test(t)) && p.cottLink, p.cardText);
  T('B5 picking the boxcar stages it (the field now names the boxcar; nothing written yet — and NOT on the live record: v0.9.1883 edits a copy)', /Boxcar/.test(p.staged) && p.stagedOnRecord === '', p.staged);
  T('B6 Save writes the full row with THAT entry\'s Row ID and key — identity-checked (one PUT to the item\'s own row)',
    p.written && p.written.id === 'BBBBBBBBBB' && p.written.key === 'prewar|800|' && /!A3:AY3$/.test(p.putRange), p);
  T('B7 ...and the entry\'s type, road, descriptions, era and maker ride along; the number keeps its text-guard quote, the variation is the entry\'s',
    p.written && p.written.type === 'Boxcar' && p.written.road === 'Lionel Lines' && p.written.desc === 'Box Car (O gauge)' && p.written.era === 'prewar' && p.written.mfr === 'Lionel' && p.written.num === "'800" && p.written.variation === '', p.written);
  T('B8 the record carries the new ID, the staged pick is gone, the panel closed', p.record.id === 'BBBBBBBBBB' && !p.record.staged && p.closed, p.record);
  const pv = await panel(browser, null, 'CCCCCCCCCC');
  T('B9 picking variation C: the item\'s variation becomes C and the variation description follows', pv.out.written && pv.out.written.id === 'CCCCCCCCCC' && pv.out.written.variation === 'C' && pv.out.written.varDesc === 'orange body', pv.out.written);
  const cc = await cancelCase(browser);
  T('B10 Cancel forgets a staged pick — nothing written, nothing on the live record before or after (v0.9.1883: the panel edits a copy)', !cc.out.stagedBefore && !cc.out.stagedAfter && cc.out.puts === 0 && cc.out.closed, cc.out);
  const p2 = await panel(browser, null, 'C2C2C2C2C2');
  T('B10b the SECOND product under 800 var C can be picked — its own Row ID is written, not the first C row\'s', p2.out.written && p2.out.written.id === 'C2C2C2C2C2' && p2.out.written.varDesc === 'brown body', p2.out.written);
  const pp = await panel(browser, { panel: plantedPanel() }, 'C2C2C2C2C2');
  T('B11 PLANTED: the variation re-derivation left in → the pick is overridden by the first row under 800 var C (B10b catches it)', pp.out.written && pp.out.written.id === 'CCCCCCCCCC', pp.out.written);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
