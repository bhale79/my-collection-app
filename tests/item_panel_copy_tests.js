#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ITEM PANEL — EDITS LIVE ON A COPY UNTIL SAVE — v0.9.1883   (real Chromium, the REAL app)
//
// [stated] Brad: "yes" — the item's Edit screen kept a change you made even
// after Cancel (it edited the live record in place as you typed; v0.9.1882
// fixed that for the entry pick alone). Now the panel edits a COPY:
//   A  change a text field, change the variation, pick another catalog entry,
//      then Cancel / ✕ → the live record is untouched; reopening shows the
//      saved values; nothing was written
//   B  Save → the edits land on the SAME live object (the drawn rows and the
//      owned-by-inventory maps hold it), and on the sheet
//   PLANTED: the old in-place line → Cancel leaves the change behind (A catches it)
// The stand-in world is the one row_id_step4_tests uses (lifted from there).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  item_panel_copy_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

function plantedPanel() {
  const s = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  const out = s.replace("  const _live = state.personalData[pdKey] || {};\n  const pd = Object.assign({}, _live);", "  const _live = state.personalData[pdKey] || {};\n  const pd = _live;");
  if (out === s) throw new Error('planted app-collection.js: the copy line moved; update this test');
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


async function cancelRun(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(() => {
    const r = {}; const live = state.personalData.a; live.notes = 'original note';
    const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
    showItemPanel(idxMotor, 'a', 'edit');
    let ov = document.getElementById('item-panel-overlay');
    const rowsOf = () => Array.from(ov.querySelectorAll('#item-panel-fields-container > div'));
    // 1. a text field: Notes → ✏️ → type → ✓
    const notesRow = () => rowsOf().find(d => /^Notes/.test(d.textContent.trim()));   // re-found after every render (the panel redraws its rows)
    notesRow().querySelector('button').click();
    const inp = document.getElementById('panel-inp-notes'); inp.value = 'typed then cancelled';
    Array.from(notesRow().querySelectorAll('button')).find(b => b.textContent === '✓').click();
    // 2. the variation: cards → pick C
    const varRow = rowsOf().find(d => /^Variation/.test(d.textContent.trim()));
    if (varRow) { varRow.querySelector('button').click(); const cC = Array.from(ov.querySelectorAll('#item-panel-fields-container div')).find(d => /^Var C/.test(d.textContent.trim()) && d.style.cursor === 'pointer'); if (cC) cC.click(); }
    // 3. the catalog entry: pick the boxcar
    const entryRow = rowsOf().find(d => /Catalog entry/.test(d.textContent));
    Array.from(entryRow.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent)).click();
    ov.querySelector('[data-rr-entry="BBBBBBBBBB"]').click();
    r.stagedShown = rowsOf().filter(d => /Catalog entry|^Notes/.test(d.textContent.trim())).map(d => d.querySelector('span').textContent);
    r.liveDuring = { notes: live.notes, variation: live.variation, id: live.masterRowId || '', staged: !!live._newEntry };
    Array.from(ov.querySelectorAll('button')).find(b => /^Cancel$/.test(b.textContent.trim())).click();
    r.liveAfterCancel = { notes: live.notes, variation: live.variation, id: live.masterRowId || '', staged: !!live._newEntry, same: state.personalData.a === live };
    // reopen: the saved values
    showItemPanel(idxMotor, 'a', 'view'); ov = document.getElementById('item-panel-overlay');
    r.reopened = rowsOf().filter(d => /Catalog entry|^Notes/.test(d.textContent.trim())).map(d => d.querySelector('span').textContent);
    ov.querySelector('#item-panel-close-btn').click();
    r.writes = window.__sheet.puts.length + window.__sheet.writes.length;
    return r;
  });
  await pg.close();
  return { out, errs };
}

async function saveRun(browser) {
  const { pg, errs } = await boot(browser, null);
  const out = await pg.evaluate(async () => {
    const live = state.personalData.a; const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
    showItemPanel(idxMotor, 'a', 'edit');
    const ov = document.getElementById('item-panel-overlay');
    const rowsOf = () => Array.from(ov.querySelectorAll('#item-panel-fields-container > div'));
    const notesRow = () => rowsOf().find(d => /^Notes/.test(d.textContent.trim()));
    notesRow().querySelector('button').click();
    document.getElementById('panel-inp-notes').value = 'kept on save';
    Array.from(notesRow().querySelectorAll('button')).find(b => b.textContent === '✓').click();
    Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
    await new Promise(res => setTimeout(res, 600));
    const put = window.__sheet.puts[0]; const F = PERSONAL_FIELD_INDEX;
    return { same: state.personalData.a === live, notes: live.notes, onSheet: put ? put.body.values[0][F.notes] : null, closed: !document.getElementById('item-panel-overlay') };
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  console.log('== A · Cancel forgets everything ==');
  const c = await cancelRun(browser, null); const o = c.out;
  T('A0 the page ran without a script error', c.errs.length === 0, c.errs);
  T('A1 while editing, the panel shows the staged values (the boxcar entry, the typed note)', o.stagedShown.some(s => /typed then cancelled/.test(s)) && o.stagedShown.some(s => /Boxcar/.test(s)), o.stagedShown);
  T('A2 ...and the LIVE record is untouched while the panel is open', o.liveDuring.notes === 'original note' && o.liveDuring.variation === '' && o.liveDuring.id === '' && !o.liveDuring.staged, o.liveDuring);
  T('A3 after Cancel the live record is still untouched — same object, nothing staged', o.liveAfterCancel.notes === 'original note' && o.liveAfterCancel.variation === '' && o.liveAfterCancel.id === '' && !o.liveAfterCancel.staged && o.liveAfterCancel.same, o.liveAfterCancel);
  T('A4 reopening shows the saved values, not the cancelled ones', o.reopened.some(s => s === 'original note') && o.reopened.some(s => /Motorized Unit/.test(s)), o.reopened);
  T('A5 nothing was written to the sheet', o.writes === 0, o.writes);
  const p = await cancelRun(browser, { panel: plantedPanel() });
  T('A6 PLANTED: the old in-place panel → Cancel leaves the typed note (and the staged pick) on the live record', p.out.liveAfterCancel.notes === 'typed then cancelled' && p.out.liveAfterCancel.staged, p.out.liveAfterCancel);
  console.log('\n== B · Save lands on the SAME live object ==');
  const s = await saveRun(browser);
  T('B0 no script error', s.errs.length === 0, s.errs);
  T('B1 the note is on the live record — the same object the maps and rows hold — and on the sheet, and the panel closed', s.out.same && s.out.notes === 'kept on save' && s.out.onSheet === 'kept on save' && s.out.closed, s.out);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
