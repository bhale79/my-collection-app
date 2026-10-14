#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ITEM IN MEMORY AFTER A SAVE IS THE ROW THE SAVE WROTE — v0.9.1941
//                                                     (real Chromium, the REAL app)
//
// Brad, 2026-10-14, recording the booth video: "i added 3 photos and they don't
// show up on recent additions nor in the detail sheet" — "when i hit reload, it
// appeared". The save wrote the photo-folder link to the sheet row, then rebuilt
// the item IN MEMORY from its own hand-kept list of 17 fields. The link was not
// on it (nor Box Photo, Master Row ID, Custom 1-5 …), so until the next load the
// item looked photoless: the detail page fell back to the item-number folder
// (empty — the photos sit in the copy's subfolder) and Recent Additions had no
// thumbnail. The app's own log showed it: "saveComplete 3309-50 row=116".
// The fix: ONE reader turns a My Collection row into a record —
// rrPersonalRecordFromRow (app-data.js) — used by the start-up load AND by every
// save (rrPersonalRecordFromWrittenRow, handed the row it wrote).
//   A  the reader: a fully filled row → the record a load reads; the save-side
//      reader gives the SAME record (the ' text guard Sheets strips is stripped)
//   B  the REAL save (finishing a Quick Entry, the path Brad's save took): the
//      new photo folder, the box photo, Custom 1 and the Master Row ID are on the
//      record in memory at once, on the same row; PLANTED: the old wizard-save.js
//      → the photo folder is missing from memory (Brad's bug, caught)
//   C  scan: the load and all 13 save sites go through the reader (rrSavedRecord:
//      the written row wins, the save's own words fill only a blank); no record is
//      put into state.personalData from a { … } literal; PLANTED: the old main insert
// The stand-in world is the one full_row_carry_tests uses (lifted from there).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  saved_record_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

// The planted offender: today's wizard-save.js with the two inserts put back to the
// hand-kept field lists they were before v0.9.1941 (kept here, so the test does
// not depend on git history).
function plantedSave() {
  const s = fs.readFileSync(path.join(APP, 'wizard-save.js'), 'utf8');
  const a = s.indexOf('      state.personalData[_optInvId] = rrSavedRecord(');
  const b = a < 0 ? -1 : s.indexOf('      });', a);
  if (a < 0 || b < 0) throw new Error('planted wizard-save.js: the main insert moved; update this test');
  const old = '      state.personalData[_optInvId] = {\n'
    + '        row: _mainApRow || 0, itemNum, variation,\n'
    + "        status: 'Owned', owned: true,\n"
    + "        condition: d.condition || '', allOriginal: d.allOriginal || '', priceItem: d.priceItem || '',\n"
    + "        priceBox: d.priceBox || '', priceComplete: d.priceComplete || '', hasBox: d.hasBox || 'No',\n"
    + "        boxCond: d.boxCond || '', notes: d.notes || '', datePurchased: d.datePurchased || '',\n"
    + "        purchasedFrom: d.purchasedFrom || '', inventoryId: _optInvId, groupId: groupId || '',\n"
    + "        location: d.location || '', ..._rrUserFieldValues(d),\n"
    + "        era: _resolveSaveEra(), manufacturer: _getEraManufacturer(),\n"
    + '      };\n';
  return s.slice(0, a) + old + s.slice(b + '      });'.length + 1);
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.ws && bare.endsWith('/app/wizard-save.js')) return r.fulfill({ body: planted.ws, contentType: 'application/javascript' });
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




const LINK = 'https://drive.google.com/drive/folders/PHOTOFOLDER443';
const BOXL = 'https://drive.google.com/drive/folders/BOXFOLDER';

async function readerRun(browser) {
  const { pg, errs } = await boot(browser, null);
  const out = await pg.evaluate(() => {
    const rec = Object.assign({}, state.personalData.a);
    PERSONAL_SCHEMA.forEach(s => { if (rec[s.field] === undefined || rec[s.field] === '') rec[s.field] = 'v-' + s.field; });
    Object.assign(rec, { itemNum: '800', variation: '', matchedTo: '0401-1', quickEntry: true, photoItem: 'https://drive.google.com/drive/folders/P1',
      photoBox: 'https://drive.google.com/drive/folders/B1', dateAdded: '2026-01-02', datePurchased: '2026-01-03' });
    const row = rrPersonalUpdateRow(rec, {});
    // what a load is handed: Sheets strips the leading ' text guard
    const cells = row.map(v => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v);
    const loaded = rrPersonalRecordFromRow(cells, 7);
    const saved = rrPersonalRecordFromWrittenRow(row, 7);
    const fields = PERSONAL_SCHEMA.map(s => s.field);
    return {
      guarded: row[PERSONAL_FIELD_INDEX.itemNum],
      diff: fields.filter(f => String(loaded[f]) !== String(saved[f])),
      lost: fields.filter(f => f !== 'quickEntry' && String(saved[f]) !== String(rec[f])).map(f => f + ': ' + rec[f] + ' -> ' + saved[f]),
      qe: saved.quickEntry, row: saved.row, owned: saved.owned && saved.status === 'Owned',
      width: fields.length,
    };
  });
  await pg.close();
  return { out, errs };
}

async function saveRun(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(async (args) => {
    const p = state.personalData.b; const rowBefore = p.row;
    p.quickEntry = true; p.photoBox = args.BOXL; p.custom1 = 'mine'; p.masterRowId = 'CCCCCCCCCC'; p.locationDetail = 'Under Train Table';
    let threw = '';
    try { completeQuickEntry(p.itemNum, p.variation, null, p.inventoryId); } catch (e) { threw = 'qe: ' + e.message; }
    wizard.data.photosItem = { RSV: args.LINK }; wizard.data.condition = '8';
    try { await saveWizardItem(); } catch (e) { threw += ' save: ' + e.message; }
    await new Promise(r => setTimeout(r, 400));
    const recs = Object.keys(state.personalData).filter(k => state.personalData[k].inventoryId === 'INV-B');
    const r = recs.length ? state.personalData[recs[0]] : {};
    const put = window.__sheet.puts.find(x => /!A\d+:/.test(x.range));
    return { threw, copies: recs.length, rowBefore, row: r.row, photo: r.photoItem || '', box: r.photoBox || '', c1: r.custom1 || '',
      mri: r.masterRowId || '', ld: r.locationDetail || '', cond: r.condition, qe: r.quickEntry,
      sheetPhoto: put ? put.body.values[0][PERSONAL_FIELD_INDEX.photoItem] : null,
      sheetBox: put ? put.body.values[0][PERSONAL_FIELD_INDEX.photoBox] : null };
  }, { LINK, BOXL });
  await pg.close();
  return { out, errs };
}

function scan(src) {
  const bad = [];
  // a record put into state.personalData straight from a { … } literal is a hand-kept field list
  src.split('\n').forEach((l, i) => {
    if (/^\s*\/\//.test(l)) return;
    if (/state\.personalData\[[^\]]+\]\s*=\s*\{/.test(l) || /\bpdObj\s*=\s*\{/.test(l)) bad.push('wizard-save.js:' + (i + 1) + ' hand-built record: ' + l.trim());
  });
  if (!/state\.personalData\[_optInvId\] = rrSavedRecord\(_mainWrittenRow \|\| row, _mainApRow \|\| 0,/.test(src)) bad.push('main insert does not build from the written row');
  if (!/state\.personalData\[_setOptId\] = rrSavedRecord\(_mainWrittenRow \|\| row,/.test(src)) bad.push('set-member insert does not build from the written row');
  return bad;
}

(async () => {
  console.log('== C · scan: one reader for the load and every save ==');
  const ws = fs.readFileSync(path.join(APP, 'wizard-save.js'), 'utf8');
  const ad = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
  const clean = scan(ws);
  T('C1 every record a save puts in memory is built from the row it wrote (no hand-built record in wizard-save.js)', clean.length === 0, clean);
  const calls = (ws.match(/rrSavedRecord\(/g) || []).length;
  T('C1b ...all 13 save sites go through rrSavedRecord (main, set member, set QE, box-only, 4 group boxes, IS, master box, standalone IS, paper, manual)', calls >= 13, calls);
  const loadBody = ad.slice(ad.indexOf('async function _loadPersonalFromSheets('), ad.indexOf('async function _loadPersonalFromSheets(') + 40000);
  T('C2 the start-up load turns rows into records through the same reader', /newPersonal\[key\] = rrPersonalRecordFromRow\(r, rowNum\);/.test(loadBody) && !/obj\[s\.field\] = \(r\[i\]/.test(loadBody), null);
  T('C3 the reader is defined ONCE', (ad.match(/^function rrPersonalRecordFromRow\(/gm) || []).length === 1
    && fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'app-data.js').every(f => !/function rrPersonalRecordFromRow\(/.test(fs.readFileSync(path.join(APP, f), 'utf8'))), null);
  const pl = plantedSave();
  const caught = scan(pl);
  T('C4 PLANTED: the old hand-built main insert is caught', caught.some(b => /main insert|hand-built/.test(b)), caught);

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  console.log('\n== A · the reader ==');
  const a = await readerRun(browser);
  T('A0 no script error', a.errs.length === 0, a.errs);
  T('A1 the writer puts the TEXT guard on Item Number (so the save side has something to strip)', /^'/.test(a.out.guarded), a.out.guarded);
  T('A2 the record a save builds = the record a load reads, all ' + a.out.width + ' columns', a.out.diff.length === 0, a.out.diff);
  T('A3 ...and every column is the value the record held (photo links included)', a.out.lost.length === 0, a.out.lost);
  T('A4 ...owned, on its row, Quick Entry read as a yes/no', a.out.owned && a.out.row === 7 && a.out.qe === true, a.out);

  console.log('\n== B · the REAL save (finishing a Quick Entry — the path Brad\'s 3309-50 save took) ==');
  const b = await saveRun(browser, null);
  T('B0 no script error, nothing thrown', b.errs.length === 0 && !b.out.threw, [b.errs, b.out.threw]);
  T('B1 the sheet row carries the new photo folder (it always did)', b.out.sheetPhoto === LINK, b.out.sheetPhoto);
  T('B2 the item IN MEMORY has the new photo folder at once — no reload', b.out.photo === LINK, b.out);
  T('B3 ...and the box photo, Custom 1, Location Detail and Master Row ID it already had', b.out.box === BOXL && b.out.c1 === 'mine' && b.out.ld === 'Under Train Table' && b.out.mri === 'CCCCCCCCCC', b.out);
  T('B4 ...one record, on the SAME row, with the edit (Condition 8) and the Quick Entry flag cleared', b.out.copies === 1 && b.out.row === b.out.rowBefore && b.out.cond === '8' && b.out.qe === false, b.out);
  const bp = await saveRun(browser, { ws: pl });
  T('B5 PLANTED: the old hand-built insert → the photo folder is missing from memory (Brad\'s bug, caught)', !bp.out.threw && bp.out.sheetPhoto === LINK && bp.out.photo === '', bp.out);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
