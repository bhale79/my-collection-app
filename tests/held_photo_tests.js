#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A CANCELLED ADD'S PICTURE DOES NOT SHOW IN THE NEXT ADD — v0.9.1942
//                                                     (real Chromium, the REAL app)
//
// Brad, 2026-10-14, recording the booth video: "then i cancelled and tried again,
// and it still shows the picture. it shouldn't show anything as i haven't
// selected anything yet". Photo ID / Lens hold their picture in
// window._idLastPhotoFile for the add that asked for it; the header thumbnail
// (_wizPhotoSet) falls back to it until it is handed over. Nothing cleared it on
// Cancel, so the next add showed a picture nobody had picked.
// The fix: _rrClearHeldIdPhoto (wizard.js) — called when an add opens and when
// it closes.
//   H1-H2  within one add the held picture still shows (the hand-over works)
//   H3     Cancel → a new add → the header is EMPTY, the held picture gone
//   H4     a picture held by Research (outside any add) does not leak into the
//          next add either
//   H5     PLANTED: the clear made a no-op → the old picture shows again (caught)
// The stand-in world is the one full_row_carry_tests uses (lifted from there).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  held_photo_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
function plantedWizard() {
  const s = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
  const out = s.replace('  try { window._idLastPhotoFile = null; } catch (e) {}', '  /* planted: nothing cleared */');
  if (out === s) throw new Error('planted wizard.js: the clear line moved; update this test');
  return out;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.wz && bare.endsWith('/app/wizard.js')) return r.fulfill({ body: planted.wz, contentType: 'application/javascript' });
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




async function run(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(async () => {
    const pic = () => {   // is the header thumbnail showing a picture?
      const b = document.getElementById('wiz-hero-photo');
      return !!(b && b.style.display !== 'none' && b.querySelector('img'));
    };
    const mkFile = (name) => new File([new Uint8Array([255, 216, 255, 217])], name, { type: 'image/jpeg' });
    const r = {};
    await openWizard('collection');
    r.freshEmpty = !pic();
    // Photo ID inside this add closes and holds its picture (what closeIdentify does)
    window._idLastPhotoFile = mkFile('yellow-car.jpg');
    _wizHeroPhotoSync();
    r.heldShows = pic();
    // Cancel (nothing typed, so no "discard?" question)
    closeWizard();
    r.clearedOnClose = window._idLastPhotoFile === null;
    await openWizard('collection');
    _wizHeroPhotoSync();
    r.nextEmpty = !pic();
    closeWizard();
    // a picture held while the wizard was CLOSED (Research's Photo ID) does not ride into the next add
    window._idLastPhotoFile = mkFile('research.jpg');
    await openWizard('collection');
    _wizHeroPhotoSync();
    r.researchEmpty = !pic() && window._idLastPhotoFile === null;
    closeWizard();
    return r;
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  console.log('== the held Photo ID picture belongs to ONE add ==');
  const a = await run(browser, null);
  T('H0 no script error', a.errs.length === 0, a.errs);
  T('H1 a new add starts with no header picture', a.out.freshEmpty, a.out);
  T('H2 within the add, the held Photo ID picture shows (the hand-over still works)', a.out.heldShows, a.out);
  T('H3 Cancel clears it, and the next add\'s header is EMPTY (Brad\'s report)', a.out.clearedOnClose && a.out.nextEmpty, a.out);
  T('H4 a picture held outside any add (Research) does not leak into the next add', a.out.researchEmpty, a.out);
  const p = await run(browser, { wz: plantedWizard() });
  T('H5 PLANTED: the clear made a no-op → the cancelled add\'s picture shows in the next add (caught)', p.out.heldShows && !p.out.nextEmpty, p.out);
  const src = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
  T('H6 one clear, called from BOTH openWizard and the close', (src.match(/^function _rrClearHeldIdPhoto\(/gm) || []).length === 1
    && /_rrClearHeldIdPhoto\(\);\n  wizard = \{ step: 0, tab: tab,/.test(src)
    && /window\._rrPendingStagePair = null; \} catch \(e\) \{\}\n[\s\S]{0,200}_rrClearHeldIdPhoto\(\);/.test(src), null);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
