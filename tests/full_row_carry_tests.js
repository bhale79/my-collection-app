#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// WHOLE-ROW SAVES KEEP EVERY COLUMN — v0.9.1919   (real Chromium, the REAL app)
//
// Found while scripting the booth video: "Update Info/Pictures → Save All
// Changes" rebuilt the item's row from a hand-kept list of 34 fields — the row
// has 51 — so every save BLANKED Purchased From, Your Grade, Your Description,
// Import Batch, Location Detail, Shipper, Sub-collection, Custom 1–5,
// Scale/Gauge, the Era override and the Stock Photo Link. The Quick Entry
// finish and the box re-save (wizard-save.js) had the same shape.
// The fix: ONE builder for a whole-row update, rrPersonalUpdateRow /
// rrCarryPersonalRow (app.js) — a field the save names is written, every other
// column is CARRIED from the record.
//   A  the builder: all 51 columns filled → an update naming one field keeps
//      the other 50; '' clears on purpose; undefined carries; a changed
//      variation drops only the old catalog row's columns
//   B  the REAL edit panel, every column filled, Save All Changes → nothing on
//      the sheet row went blank; an edit lands; PLANTED: the old builder line →
//      the dropped columns come back blank (B catches it)
//   C  finishing a Quick Entry starts from the saved Bought From (the wizard
//      WRITES that field, so a missing pre-fill erased it); PLANTED: line gone
//   D  scan: every whole-row write to My Collection in app/ goes through the
//      builder (or is a blanking); PLANTED: the old panel line and a bare
//      sheetsUpdate(personalFullRowRange…) are both caught
// The stand-in world is the one item_panel_copy_tests uses (lifted from there).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  full_row_carry_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

function plantedPanel() {
  const s = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  const out = s.replace('const newRow = rrPersonalUpdateRow(pd, {', 'const newRow = buildPersonalRow({');
  if (out === s) throw new Error('planted app-collection.js: the builder line moved; update this test');
  return out;
}
function plantedQE() {
  const s = fs.readFileSync(path.join(APP, 'wizard-quickentry.js'), 'utf8');
  const out = s.replace('if (pd.purchasedFrom) data.purchasedFrom = pd.purchasedFrom;', '');
  if (out === s) throw new Error('planted wizard-quickentry.js: the pre-fill line moved; update this test');
  return out;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.qe && bare.endsWith('/app/wizard-quickentry.js')) return r.fulfill({ body: planted.qe, contentType: 'application/javascript' });
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



// Every schema column filled with a value of its own, as the sheet read gives it (strings; quickEntry a boolean).
const FILL = `
  const rec = state.personalData.a;
  PERSONAL_SCHEMA.forEach(s => { if (rec[s.field] === undefined || rec[s.field] === '') rec[s.field] = 'v-' + s.field; });
  Object.assign(rec, { itemNum: '800', variation: '', era: 'prewar', manufacturer: 'Lionel', inventoryId: 'INV-A',
    masterKey: 'prewar|800|', masterRowId: 'MMMMMMMMMM', quickEntry: false, condition: '7', boxCond: '6',
    hasBox: 'Yes', allOriginal: 'Yes', userEstWorth: '100', priceItem: '50', priceBox: '10', priceComplete: '60.00',
    dateAdded: '2026-01-02', datePurchased: '2026-01-03', eraPeriod: 'postwar', isError: 'No', yearMade: '1905',
    purchasedFrom: 'C-1700000000000', itemType: 'Motorized Unit' });
`;

async function unitRun(browser) {
  const { pg, errs } = await boot(browser, null);
  const out = await pg.evaluate(new Function(FILL + `
    const F = PERSONAL_FIELD_INDEX, dateF = PERSONAL_SCHEMA.filter(c => /^date\\b/i.test(c.header)).map(c => c.field);
    const want = (f) => dateF.includes(f) ? rrDateForSheet(rec[f]) : (f === 'quickEntry' ? '' : rec[f]);
    const bare = v => String(v == null ? '' : v).replace(/^'/, '');
    const r = {};
    const one = rrPersonalUpdateRow(rec, { condition: '9' });
    r.len = one.length; r.schema = PERSONAL_SCHEMA.length;
    r.lost = PERSONAL_SCHEMA.filter(s => s.field !== 'condition' && bare(one[F[s.field]]) !== bare(want(s.field))).map(s => s.field + '=' + one[F[s.field]]);
    r.cond = one[F.condition];
    r.cleared = rrPersonalUpdateRow(rec, { notes: '' })[F.notes];
    r.undef = rrPersonalUpdateRow(rec, { notes: undefined })[F.notes];
    const qe = Object.assign({}, rec, { quickEntry: true });
    r.qeCarried = rrPersonalUpdateRow(qe, { condition: '8' })[F.quickEntry];
    r.qeCleared = rrCarryPersonalRow(qe, buildPersonalRow({ itemNum: '800', variation: '' }), ['itemNum', 'variation', 'quickEntry'])[F.quickEntry];
    const other = rrPersonalUpdateRow(rec, { variation: 'C' });
    r.otherBound = RR_ITEM_BOUND_FIELDS.filter(f => String(other[F[f]]) === String(rec[f])).map(f => f);
    r.otherKept = ['purchasedFrom', 'custom1', 'yourGrade', 'locationDetail', 'importBatch', 'notes'].filter(f => String(other[F[f]]) !== String(rec[f]));
    r.otherDesc = other[F.variationDescription];
    const carriedNum = rrCarryPersonalRow(Object.assign({}, rec, { matchedTo: '0401-1' }), buildPersonalRow({ condition: '5' }), ['condition']);
    r.guardCarried = carriedNum[F.itemNum] + '|' + carriedNum[F.matchedTo];
    r.nullRec = JSON.stringify(rrCarryPersonalRow(null, ['x'], [])) === '["x"]';
    return r;
  `));
  await pg.close();
  return { out, errs };
}

async function panelRun(browser, planted, edit) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(new Function('edit', FILL + `
    return (async () => {
      const idxMotor = state.masterData.findIndex(m => m.rowId === 'MMMMMMMMMM');
      const before = Object.assign({}, rec);
      showItemPanel(idxMotor, 'a', 'edit');
      const ov = document.getElementById('item-panel-overlay');
      const rowsOf = () => Array.from(ov.querySelectorAll('#item-panel-fields-container > div'));
      if (edit) {
        const condRow = () => rowsOf().find(d => /^Condition/.test(d.textContent.trim()));
        condRow().querySelector('button').click();
        const inp = document.getElementById('panel-inp-condition'); if (inp) inp.value = '9';
        Array.from(condRow().querySelectorAll('button')).find(b => b.textContent === '✓').click();
      }
      Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
      await new Promise(res => setTimeout(res, 700));
      const put = window.__sheet.puts[0]; const F = PERSONAL_FIELD_INDEX;
      if (!put) return { noPut: true };
      const row = put.body.values[0];
      const dateF = PERSONAL_SCHEMA.filter(c => /^date\\b/i.test(c.header)).map(c => c.field);
      const want = (f) => dateF.includes(f) ? rrDateForSheet(before[f]) : (f === 'quickEntry' ? '' : before[f]);
      const skip = edit ? ['condition'] : [];
      const bare = v => String(v == null ? '' : v).replace(/^'/, '');
      return {
        // blank = a column the record HAD a value in that came back empty
        blank: PERSONAL_SCHEMA.filter(s => !skip.includes(s.field) && bare(want(s.field)) !== '' && bare(row[F[s.field]]) === '').map(s => s.field),
        changed: PERSONAL_SCHEMA.filter(s => !skip.includes(s.field) && bare(row[F[s.field]]) !== bare(want(s.field))).map(s => s.field + ': ' + before[s.field] + ' -> ' + row[F[s.field]]),
        guard: { item: row[F.itemNum], matched: row[F.matchedTo] },
        cond: row[F.condition], width: row.length, live: { pf: state.personalData.a.purchasedFrom, c1: state.personalData.a.custom1 },
      };
    })();
  `), !!edit);
  await pg.close();
  return { out, errs };
}

async function qeRun(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(() => {
    const p = state.personalData.b; p.quickEntry = true; p.purchasedFrom = 'C-1711111111111'; p.notes = 'grabbed at York';
    let threw = '';
    try { completeQuickEntry(p.itemNum, p.variation, null, p.inventoryId); } catch (e) { threw = String(e && e.message || e); }
    const d = (typeof wizard !== 'undefined' && wizard && wizard.data) || {};
    return { pf: d.purchasedFrom || '', notes: d.notes || '', fill: !!d._fillItemMode, threw };
  });
  await pg.close();
  return { out, errs };
}

// ── D · the scan ────────────────────────────────────────────────────────────
// A whole-row write to My Collection is personalWriteRow(rec, VALUES) or
// sheetsUpdate(…, personalFullRowRange(…), [VALUES]). VALUES must be a blanking
// (personalBlankRow()), a call to the builder, or a name assigned from the
// builder earlier in the same file (within 200 lines).
function scanSource(name, src) {
  const bad = [];
  const lines = src.split('\n');
  const okExpr = (e, lineIdx) => {
    e = e.trim();
    if (/^personalBlankRow\(\)/.test(e) || /^rrCarryPersonalRow\(/.test(e) || /^rrPersonalUpdateRow\(/.test(e)) return true;
    const id = (/^([A-Za-z_$][\w$]*)$/.exec(e) || [])[1];
    if (!id) return false;
    const from = Math.max(0, lineIdx - 200);
    const back = lines.slice(from, lineIdx + 1).join('\n');
    return new RegExp('\\b' + id.replace(/\$/g, '\\$') + '\\s*=\\s*(rrPersonalUpdateRow|rrCarryPersonalRow)\\(').test(back);
  };
  lines.forEach((ln, i) => {
    if (/^\s*\/\//.test(ln) || /function personalWriteRow\b/.test(ln)) return;
    const joined = lines.slice(i, i + 3).join(' ');
    let m = /personalWriteRow\(\s*[^,]+,\s*([^)]*?(?:\(\))?)\s*\)/.exec(ln);
    if (m && !okExpr(m[1], i)) bad.push(name + ':' + (i + 1) + '  ' + ln.trim());
    if (/personalFullRowRange\(/.test(ln) && /sheetsUpdate(Row)?\(/.test(ln) && !/function /.test(ln)) {
      const v = /personalFullRowRange\([^)]*\)\s*,\s*\[\s*([\s\S]*?)\]\s*(?:,|\))/.exec(joined);
      if (!v || !okExpr(v[1].split('\n')[0], i)) bad.push(name + ':' + (i + 1) + '  ' + ln.trim());
    }
  });
  return bad;
}
function scanAll(overrides) {
  const bad = [];
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => {
    if (f === 'app.js') return;   // the definitions themselves (personalWriteRow's own body)
    const src = (overrides && overrides[f]) || fs.readFileSync(path.join(APP, f), 'utf8');
    bad.push(...scanSource(f, src));
  });
  return bad;
}

(async () => {
  console.log('== D · scan: every whole-row write goes through the builder ==');
  const clean = scanAll();
  T('D1 no whole-row write to My Collection skips the builder', clean.length === 0, clean);
  const pp = scanAll({ 'app-collection.js': plantedPanel() });
  T('D2 PLANTED: the old panel builder line is caught', pp.some(b => /app-collection\.js/.test(b)), pp);
  const ws = fs.readFileSync(path.join(APP, 'wizard-save.js'), 'utf8') + '\nasync function _planted(existing, row) {\n  await sheetsUpdate(state.personalSheetId, personalFullRowRange(existing.row), [row]);\n}\n';
  const pw = scanAll({ 'wizard-save.js': ws });
  T('D3 PLANTED: a bare sheetsUpdate(personalFullRowRange…, [row]) is caught', pw.some(b => /_planted|personalFullRowRange\(existing\.row\), \[row\]/.test(b)), pw);
  const cnt = ['app-collection.js', 'wizard-save.js'].map(f => (fs.readFileSync(path.join(APP, f), 'utf8').match(/rrPersonalUpdateRow\(|rrCarryPersonalRow\(/g) || []).length);
  T('D4 the three whole-row updates use it (1 in the panel, 2 in wizard-save)', cnt[0] >= 1 && cnt[1] >= 2, cnt);

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  console.log('\n== A · the builder ==');
  const u = await unitRun(browser); const a = u.out;
  T('A0 no script error', u.errs.length === 0, u.errs);
  T('A1 the row is as wide as the schema (' + a.schema + ' columns)', a.len === a.schema, a);
  T('A2 an update naming ONE field keeps every other column as the record had it', a.lost.length === 0, a.lost);
  T('A3 ...and writes the field it names', a.cond === '9', a.cond);
  T('A4 a field named with \'\' is cleared on purpose', a.cleared === '', a.cleared);
  T('A5 a field named with undefined is carried, not cleared', a.undef === 'v-notes', a.undef);
  T('A6 a Quick Entry flag is carried when not named, cleared when named', a.qeCarried === 'Yes' && a.qeCleared === '', a);
  T('A7 a changed variation does NOT carry the old catalog row\'s columns', a.otherBound.length === 0, a.otherBound);
  T('A8 ...but still carries the collector\'s own columns (Bought From, Custom 1, Your Grade …)', a.otherKept.length === 0, a.otherKept);
  T('A8b a CARRIED Item Number / Matched To keeps the TEXT guard', a.guardCarried === "'800|'0401-1", a.guardCarried);
  T('A9 no record → the row is returned as built', a.nullRec, a.nullRec);

  console.log('\n== B · the REAL edit panel, every column filled ==');
  const b1 = await panelRun(browser, null, false);
  T('B0 no script error', b1.errs.length === 0, b1.errs);
  T('B1 Save All Changes with no edit: no column on the sheet row went blank', !b1.out.noPut && b1.out.blank.length === 0, b1.out);
  T('B2 ...and every column is what the record held', !b1.out.noPut && b1.out.changed.length === 0, b1.out.changed);
  T('B2b ...with the TEXT guard on Item Number and Matched To (so "0401-1" is never read as a date)', !b1.out.noPut && /^'/.test(b1.out.guard.item) && /^'/.test(b1.out.guard.matched), b1.out.guard);
  const b2 = await panelRun(browser, null, true);
  T('B3 an edit (Condition → 9) lands, and nothing else changed', b2.out.cond === '9' && b2.out.changed.length === 0 && b2.out.blank.length === 0, b2.out);
  T('B4 ...and the live record still has Bought From and Custom 1', b2.out.live && b2.out.live.pf === 'C-1700000000000' && b2.out.live.c1 === 'v-custom1', b2.out.live);
  const bp = await panelRun(browser, { panel: plantedPanel() }, false);
  const dropped = ['purchasedFrom', 'yourGrade', 'yourDescription', 'importBatch', 'locationDetail', 'shipper', 'subCollection', 'custom1', 'custom5', 'gauge', 'eraPeriod', 'stockPhotoLink'];
  T('B5 PLANTED: the old builder line → the 12 collector columns come back blank (the bug, caught)', !bp.out.noPut && dropped.every(f => bp.out.blank.includes(f)), bp.out.blank);

  console.log('\n== C · finishing a Quick Entry ==');
  const c = await qeRun(browser, null);
  T('C1 the finish starts from the saved Bought From (and the notes)', c.out.pf === 'C-1711111111111' && c.out.notes === 'grabbed at York' && c.out.fill, c.out);
  const cp = await qeRun(browser, { qe: plantedQE() });
  T('C2 PLANTED: the pre-fill line gone → Bought From starts blank (the save would erase it)', cp.out.pf === '' && cp.out.fill, cp.out);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
