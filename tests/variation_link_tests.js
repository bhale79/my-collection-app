#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AN ITEM SAVED WITH A VARIATION LINKS TO THAT VARIATION'S ROW — and never
// vanishes from the list   (2026-10-31, Lars report #26; real Chromium, REAL app)
//
// Lars's header said 54 items, his list drew 48. Six items saved WITH a
// variation (2613 B, 2614 B, 2615 B, 2955 B, 656 C, 1656 2) were linked (Master
// Row ID + Master Key) to the catalog row of a DIFFERENT variation: the Add
// screen wrote the row picked on step 1, the variation step changed only the
// variation. No catalog row would then draw them.
//   A  the ONE helper (rrRowForVariation / rrLinkForVariation, app-data.js)
//   B  every save road writes the variation's own row: the variation step,
//      a typed / photo-read variation (the save re-checks), an edit that changes
//      the variation, an edit that carries an old wrong link; a variation with
//      no own row, or two, keeps the picked row; never another catalog
//   C  the list: Lars's 54 — all drawn; drawn copies = the header's counter;
//      PLANTED the old browse.js → 6 not drawn; the net alone still draws all;
//      PLANTED a row-test drop → the drawn = counted check goes red
//   D  the repair: OFF = dry run (lists 6, writes nothing, the diary says so,
//      no price/note/location/photo in it); ON = one row at a time, re-read
//      first (a row edited elsewhere is NOT written), only Master Key + Master
//      Row ID cells written, a second load repairs 0; the list then shows the
//      six on their own rows
//   E  scan: every line in app/ that writes Master Key / Master Row ID is a
//      known door through the helper; PLANTED an unguarded door → red
//   F  the real road at iPhone size: Lars's shape, the list says 54
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
try { require('playwright'); }
catch (e) { console.log('FAILED  —  variation_link_tests needs playwright and it is not installed.'); process.exit(1); }
const { LARS_SIX, LARS_WORLD, OPEN_COLLECTION, bootApp, launch } = require('./lib/lars-world');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const BROWSE = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
function plant(src, from, to, what) {
  const out = src.replace(from, to);
  if (out === src) throw new Error('planted ' + what + ': the line moved; update this test');
  return out;
}
// the seat-by-row rule AND the net both gone = the browse.js Lars had
const OLD_BROWSE = plant(plant(BROWSE,
  'if (!_p && _bvSeatByRow) { var _seat = _bvSeatByRow.get(item); if (_seat) _p = _seat; }', '', 'seat'),
  '      _orphanPds.add(pd);\n', '', 'net');
const NET_ONLY = plant(BROWSE, 'if (!_p && _bvSeatByRow) { var _seat = _bvSeatByRow.get(item); if (_seat) _p = _seat; }', '', 'seat only');
const ROW_DROP = plant(BROWSE, '    let pd = _rrPdForRow(item);\n    pd = pd || (item._personalOnly ? item : null);',
  "    let pd = _rrPdForRow(item);\n    if (pd && pd.inventoryId === '7') return false;\n    pd = pd || (item._personalOnly ? item : null);", 'row drop');

// In the page: drawn copies (incl. folded) against the header's counter.
const DRAWN_CHECK = `(function () {
  const d = rrCollectionDrawn();
  if (!d) return { error: 'could not ask' };
  const seen = new Set(d.drawn); d.folded.forEach(f => seen.add(f.pd));
  const counted = _ownedNonBox(state);
  const left = counted.filter(p => !seen.has(p)).map(p => p.itemNum + ' ' + (p.variation || '') + ' #' + p.inventoryId);
  return { counted: counted.length, drawn: seen.size, left: left };
})()`;

(async () => {
  const browser = await launch();
  const six = JSON.stringify(LARS_SIX);

  // ── A + B: the helper and every save road ────────────────────────────────
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(function () {
      (${LARS_WORLD})({ six: ${six}, withExtras: true });
      const row = id => rrMasterByRowId(id);
      const F = PERSONAL_FIELD_INDEX;
      const out = {};
      out.a1 = (rrRowForVariation(row('6QEMFSBQZM'), '2613', 'B') || {}).rowId;
      out.a2 = (rrRowForVariation(row('6QEMFSBQZM'), '2613', '') || {}).rowId;
      out.a3 = (rrRowForVariation(row('P2620XXXXX'), '2620', 'Z') || {}).rowId;
      out.a4 = (rrRowForVariation(row('P0800XXXXX'), '800', 'C') || {}).rowId;
      out.a5 = (rrRowForVariation(row('SE69DF5XU3'), '1656', '2') || {}).rowId;
      out.a6 = (rrRowForVariation(row('V2613BBBBB'), '2613', '', true) || {}).rowId;   // the step: back to the plain card
      out.a7 = rrLinkForVariation('2613', 'B', 'prewar|2613|', '6QEMFSBQZM');
      out.a8 = rrLinkForVariation('3000', '', 'prewar|3000|', 'F3000XXXXX').changed;
      // B — the row builder every save goes through (a typed / photo-read variation: the link given is the step-1 row)
      const b1 = buildPersonalRow({ itemNum: '2613', variation: 'B', era: 'prewar', manufacturer: 'Lionel', masterKey: 'prewar|2613|', masterRowId: '6QEMFSBQZM' });
      out.b1 = [b1[F.masterKey], b1[F.masterRowId], b1[F.masterDescription]];
      // the Add screen's own save expression, as wizard-save.js writes it
      out.b2 = [rrMasterKeyOf(rrRowForVariation(row('UJP8SWRREE'), '2955', 'B')), rrMasterRowIdOf(rrRowForVariation(row('UJP8SWRREE'), '2955', 'B'))];
      // an edit that CHANGES the variation (blank → B)
      const plainRec = Object.assign({}, state.personalData.L114, { variation: '', masterKey: 'prewar|2613|', masterRowId: '6QEMFSBQZM' });
      // (the edit panel names the number, era and the link it holds — the worst case: the old plain link)
      const b3 = rrPersonalUpdateRow(plainRec, { itemNum: '2613', variation: 'B', era: 'prewar', masterKey: 'prewar|2613|', masterRowId: '6QEMFSBQZM' });
      out.b3 = [b3[F.masterKey], b3[F.masterRowId]];
      // an edit that does NOT name the variation carries the old wrong link — re-pointed, nothing else moves
      const rec = state.personalData.L139;
      const b4 = rrPersonalUpdateRow(rec, { condition: '8' });
      const before = rrRecordRow(rec);
      const moved = []; b4.forEach((v, i) => { if (String(v).replace(/^'/, '') !== String(before[i]).replace(/^'/, '') && i !== F.masterKey && i !== F.masterRowId && i !== F.condition) moved.push(PERSONAL_SCHEMA[i].field); });
      out.b4 = [b4[F.masterKey], b4[F.masterRowId], b4[F.condition], moved];
      // …and the safe save (v0.9.2039, only the changed columns) really SENDS the two link cells
      const plan = rrRowMerge(before, b4, before);
      out.b4w = [plan.write.indexOf(F.masterKey) >= 0, plan.write.indexOf(F.masterRowId) >= 0, before[F.masterKey]];
      const b5 = rrPersonalUpdateRow(state.personalData.X1, { condition: '8' });
      out.b5 = [b5[F.masterKey], b5[F.masterRowId]];
      const b6 = rrPersonalUpdateRow(state.personalData.X2, { condition: '8' });
      out.b6 = [b6[F.masterKey], b6[F.masterRowId]];
      const b7 = buildPersonalRow({ itemNum: '1656', variation: '2', era: 'pw', manufacturer: 'Lionel', masterKey: 'pw|1656|1', masterRowId: 'SE69DF5XU3' });
      out.b7 = [b7[F.masterKey], b7[F.masterRowId]];
      const b8 = buildPersonalRow({ itemNum: '2613', variation: 'B', era: 'Manual', manufacturer: 'Lionel', masterKey: 'prewar|2613|', masterRowId: '6QEMFSBQZM' });
      out.b8 = [b8[F.masterKey], b8[F.masterRowId]];
      // the variation step itself
      window.wizardNext = function () {};
      wizard.matchedItem = row('6QEMFSBQZM'); wizard.data = { itemNum: '2613' };
      wizardChooseVariation('B'); out.s1 = wizard.matchedItem && wizard.matchedItem.rowId;
      wizardChooseVariation(''); out.s2 = wizard.matchedItem && wizard.matchedItem.rowId;
      wizardChooseVariation('Q'); out.s3 = wizard.matchedItem && wizard.matchedItem.rowId;
      return out;
    })()`);
    console.log('== A · the one helper ==');
    T('A1  plain 2613 + variation B → the 2613 B row', r.a1 === 'V2613BBBBB', r.a1);
    T('A2  no variation → the picked row stays', r.a2 === '6QEMFSBQZM', r.a2);
    T('A3  a variation the catalog does not list → the picked row stays', r.a3 === 'P2620XXXXX', r.a3);
    T('A4  a variation listed TWICE in the catalog → the picked row stays (never a guess)', r.a4 === 'P0800XXXXX', r.a4);
    T('A5  Postwar 1656 var 1 + variation 2 → the 1656 var 2 row', r.a5 === 'V1656P2222', r.a5);
    T('A6  the variation step back to the plain card → the plain row', r.a6 === '6QEMFSBQZM', r.a6);
    T('A7  rrLinkForVariation re-links Lars 2613 B, key and Row ID together', r.a7.changed && r.a7.masterKey === 'prewar|2613|B' && r.a7.masterRowId === 'V2613BBBBB', r.a7);
    T('A8  a link that already fits is never "changed"', r.a8 === false, r.a8);
    console.log('\n== B · every save road ==');
    T('B1  the row builder (typed / photo-read variation): 2613 B writes 2613 B\'s key + Row ID, and its description', r.b1[0] === 'prewar|2613|B' && r.b1[1] === 'V2613BBBBB' && /var B/.test(r.b1[2]), r.b1);
    T('B2  the Add screen\'s save expression: 2955 B → its own row', r.b2[0] === 'prewar|2955|B' && r.b2[1] === 'V2955BBBBB', r.b2);
    T('B3  an edit that changes the variation to B → the B row', r.b3[0] === 'prewar|2613|B' && r.b3[1] === 'V2613BBBBB', r.b3);
    T('B4  an edit carrying an old wrong link → re-pointed; nothing else on the row moved', r.b4[0] === 'prewar|656|C' && r.b4[1] === 'V0656CCCCC' && r.b4[2] === '8' && r.b4[3].length === 0, r.b4);
    T('B4w …the record-as-stored row keeps the OLD link, so the safe save writes both link cells', r.b4w[0] && r.b4w[1] && r.b4w[2] === 'prewar|656|', r.b4w);
    T('B5  a variation with no own row keeps the picked row', r.b5[0] === 'prewar|2620|' && r.b5[1] === 'P2620XXXXX', r.b5);
    T('B6  an ambiguous variation keeps the picked row', r.b6[0] === 'prewar|800|' && r.b6[1] === 'P0800XXXXX', r.b6);
    T('B7  never another catalog: Postwar 1656 2 stays Postwar', r.b7[0] === 'pw|1656|2' && r.b7[1] === 'V1656P2222', r.b7);
    T('B8  a manual row is never re-linked', r.b8[0] === 'prewar|2613|' && r.b8[1] === '6QEMFSBQZM', r.b8);
    T('S1  the variation step: plain 2613, then B → the screen now holds the 2613 B row', r.s1 === 'V2613BBBBB', r.s1);
    T('S2  …then back to the plain card → the plain row again', r.s2 === '6QEMFSBQZM', r.s2);
    T('S3  …a variation with no row of its own → the row stays', r.s3 === '6QEMFSBQZM', r.s3);
    T('AB  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── C: the list ──────────────────────────────────────────────────────────
  const listRun = async (planted, era) => {
    const { pg, errs } = await bootApp(browser, planted ? { 'browse.js': planted } : null);
    const warns = []; pg.on('console', m => { if (/matched no catalog row/.test(m.text())) warns.push(m.text()); });
    const r = await pg.evaluate(`(function () {
      const w = (${LARS_WORLD})({ six: ${six} });
      const listed = (${OPEN_COLLECTION})({ era: ${JSON.stringify(era || 'all')} });
      const chk = ${DRAWN_CHECK};
      const showing = ((document.getElementById('page-browse') || {}).textContent || '').match(/of\\s+(\\d+)/);
      return { counted: w.counted, listed: listed, chk: chk, showing: showing && showing[1] };
    })()`);
    await pg.close();
    return Object.assign(r, { errs, warns });
  };
  console.log('\n== C · the list draws every owned copy ==');
  const c0 = await listRun(OLD_BROWSE);
  T('C0  PLANTED the old browse.js (Lars\'s app): counted 54, only 48 drawn, the six left over', c0.counted === 54 && c0.chk.drawn === 48 && c0.chk.left.length === 6, c0);
  const c1 = await listRun(null);
  T('C1  the fix: counted 54, the list holds 54 rows, drawn = counted, nothing left over', c1.counted === 54 && c1.listed === 54 && c1.chk.drawn === 54 && c1.chk.left.length === 0, c1);
  T('C2  the six sit on their catalog rows (the net was not needed)', c1.warns.length === 0, c1.warns);
  const c3 = await listRun(NET_ONLY);
  T('C3  the NET alone (seat rule planted out) still draws all 54 — and says so', c3.chk.drawn === 54 && c3.chk.left.length === 0 && c3.warns.length > 0, c3);
  const c4 = await listRun(ROW_DROP);
  T('C4  PLANTED a row-test change that drops an owned copy → the drawn = counted check goes red', c4.chk.left.length === 1 && /#7$/.test(c4.chk.left[0]), c4.chk);
  T('C5  no page errors', [c1, c3, c4].every(x => !x.errs.length), [c1.errs, c3.errs, c4.errs]);

  // ── D: the repair ────────────────────────────────────────────────────────
  {
    const { pg, errs } = await bootApp(browser);
    const r = await pg.evaluate(`(async function () {
      (${LARS_WORLD})({ six: ${six}, withExtras: true });
      localStorage.removeItem('rr_sync_log');
      // the stand-in sheet: every record's whole row, as the sheet holds it
      const rows = {}; Object.values(state.personalData).forEach(p => { rows[p.row] = rrRecordRow(p).map(v => String(v == null ? '' : v).replace(/^'/, '')); });   // Sheets shows "'2613" as 2613
      const before = JSON.parse(JSON.stringify(rows));
      const puts = [], reads = [];
      const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
      window.sheetsGet = sheetsGet = async function (sid, range) { reads.push(range); const m = /!A(\\d+)/.exec(range); return { values: [rows[Number(m && m[1])] || []] }; };
      window.sheetsUpdate = sheetsUpdate = async function (sid, range, values) {
        puts.push(range); const m = /!([A-Z]+)(\\d+)/.exec(range); const c0 = colIdx(m[1]);
        (values[0] || []).forEach((v, k) => { rows[Number(m[2])][c0 + k] = String(v).replace(/^'/, ''); }); return {};
      };
      const out = {};
      const F = PERSONAL_FIELD_INDEX;
      // D1 — OFF: the dry run
      out.switchOff = RR_VARLINK_REPAIR_ON === false;
      const dry = await rrVarLinkRepair();
      out.dry = { planned: dry && dry.planned, dryRun: dry && dry.dryRun, puts: puts.length, lines: dry && dry.lines };
      out.diary = localStorage.getItem('rr_sync_log') || '';
      out.again = await rrVarLinkRepair();   // once per session
      // D3 — ON. Lars's 656 was edited on another device since the load (variation now D)
      RR_VARLINK_REPAIR_ON = true;
      rows[state.personalData.L139.row][F.variation] = 'D';
      const res = await rrVarLinkRepair({ force: true });
      out.on = { planned: res.planned, repaired: res.repaired, skipped: res.skipped, puts: puts.slice() };
      out.keyCol = personalColLetter('masterKey'); out.idCol = personalColLetter('masterRowId');
      out.mem = ${six}.map(s => { const p = state.personalData['L' + s.inv]; return [s.num, p.masterKey, p.masterRowId]; });
      out.untouched = []; Object.keys(rows).forEach(rn => rows[rn].forEach((v, i) => {
        if (i === F.masterKey || i === F.masterRowId) return;
        if (Number(rn) === state.personalData.L139.row && i === F.variation) return;
        if (v !== before[rn][i]) out.untouched.push(rn + ':' + PERSONAL_SCHEMA[i].field);
      }));
      out.row656 = [rows[state.personalData.L139.row][F.masterKey], rows[state.personalData.L139.row][F.masterRowId]];
      out.diary2 = localStorage.getItem('rr_sync_log') || '';
      // D4 — a second load: the collection as the sheet now holds it
      const re = {}; Object.keys(rows).forEach(rn => { const rec = rrPersonalRecordFromRow(rows[rn], Number(rn)); re['k' + rn] = rec; });
      state.personalData = re;
      const second = await rrVarLinkRepair({ force: true });
      out.second = { planned: second.planned, repaired: second.repaired };
      // D5 — the list after the repair
      out.listed = (${OPEN_COLLECTION})({});
      out.dbg = state.filteredData.filter(it => /^(2613|656|1656)$/.test(it.itemNum)).map(it => [it.itemNum, it.variation, it.rowId, !!it._personalOnly]);
      out.onOwnRow = state.filteredData.filter(it => !it._personalOnly && ['V2613BBBBB', 'V2614BBBBB', 'V2615BBBBB', 'V2955BBBBB', 'V1656P2222'].indexOf(it.rowId) >= 0).length;
      out.chk = ${DRAWN_CHECK};
      return out;
    })()`);
    console.log('\n== D · the repair ==');
    T('D0  the switch ships OFF', r.switchOff);
    T('D1  OFF = dry run: lists Lars\'s six, writes nothing', r.dry.planned === 6 && r.dry.dryRun === true && r.dry.puts === 0, r.dry);
    T('D2  the dry run names each one, old link → new (2613 B → prewar|2613|B)', (r.dry.lines || []).some(l => /^2613 var B inv 114: prewar\|2613\| \[6QEMFSBQZM\] -> prewar\|2613\|B \[V2613BBBBB\]/.test(l)), r.dry.lines);
    T('D3  …and leaves the no-own-row and the ambiguous copies off the list', !(r.dry.lines || []).some(l => /^(2620|800) /.test(l)), r.dry.lines);
    T('D4  the sync diary carries the dry run', /varlink-dry/.test(r.diary) && /6 would re-link/.test(r.diary), r.diary.slice(0, 300));
    T('D5  PRIVACY: no price, value, note, location, photo link in the diary', !/SECRET|SHELF|125\.00|drive\.google|"200"/.test(r.diary + r.diary2), (r.diary + r.diary2).match(/SECRET|SHELF|125\.00|drive\.google/));
    T('D6  once per session (a second start is a no-op)', r.again === null, r.again);
    T('D7  ON: 5 re-linked, the 656 edited elsewhere is SKIPPED (re-read first)', r.on.planned === 6 && r.on.repaired === 5 && r.on.skipped === 1, r.on);
    T('D8  only the Master Key / Master Row ID cells were written', r.on.puts.length >= 5 && r.on.puts.every(p => new RegExp('!(' + r.keyCol + '|' + r.idCol + ')\\d+(:(' + r.keyCol + '|' + r.idCol + ')\\d+)?$').test(p)), r.on.puts);
    T('D9  nothing else on any row changed', r.untouched.length === 0, r.untouched);
    T('D10 the skipped 656 row was not written', r.row656[0] === 'prewar|656|' && r.row656[1] === 'P7X9HHPEUM', r.row656);
    T('D11 memory follows the sheet for the five', r.mem.filter(m => m[0] !== '656').every(m => /\|(B|2)$/.test(m[1]) && /^V/.test(m[2])), r.mem);
    T('D12 each repair is a diary line', (r.diary2.match(/varlink-fix/g) || []).length === 5 && /varlink-skip/.test(r.diary2), r.diary2.slice(-600));
    T('D13 a second load repairs 0', r.second.planned === 0 && r.second.repaired === 0, r.second);
    T('D14 the list after the repair: all 56 drawn, five of the six on their OWN variation rows', r.listed === 56 && r.chk.left.length === 0 && r.onOwnRow === 5, { listed: r.listed, chk: r.chk, onOwnRow: r.onOwnRow, dbg: r.dbg });
    T('D15 no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── E: the scan ──────────────────────────────────────────────────────────
  console.log('\n== E · every door that writes the link goes through the helper ==');
  // Each known door: file + a piece of its line + why it is safe. A NEW line that
  // writes masterKey / masterRowId turns this red until it is looked at.
  const DOORS = [
    ['app-collection.js', 'rrMasterRowIdOf(_entry)', 'Change catalog entry: the variation is SET from the picked entry, then rrPersonalUpdateRow'],
    ['app-collection.js', 'rrMasterKeyOf(_entry)', 'same'],
    ['app-collection.js', 'rrMasterKeyOf(_nm)', 'variation changed: findMaster WITH the variation, then rrPersonalUpdateRow (rrFixRowLink)'],
    ['app-collection.js', 'rrMasterRowIdOf(_nm)', 'same'],
    ['app-collection.js', "masterRowId: pd.masterRowId || ''", 'panel save → rrPersonalUpdateRow → buildPersonalRow + rrFixRowLink'],
    ['app-collection.js', "masterKey: pd.masterKey || ''", 'same'],
    ['app-data.js', 'var out = { masterKey: k, masterRowId: id', 'the helper itself'],
    ['app-data.js', 'out.masterKey = nk; out.masterRowId = nid', 'the helper itself'],
    ['app.js', 'masterKey: _lv.masterKey, masterRowId: _lv.masterRowId', 'buildPersonalRow, through the helper'],
    ['app.js', 'const _descPrefer =', 'a lookup hint, not a write'],
    ['app-data.js', 'out.push({ pd: p, from: { masterKey:', 'the repair plan: what the copy holds now'],
    ['app-data.js', 'to: { masterKey: L.masterKey, masterRowId: L.masterRowId } });', 'the repair plan: L is rrLinkForVariation'],
    ['app-data.js', 'rrPersonalUpdateRow(cur, { masterKey: L.masterKey, masterRowId: L.masterRowId })', 'the repair: L is rrLinkForVariation of the re-read row'],
    ['app-data.js', 'p.masterKey = bare(newRow[X.masterKey]); p.masterRowId = bare(newRow[X.masterRowId]);', 'the repair: memory learns what was written'],
    ['import-ui.js', 'fields.masterKey = rrMasterKeyOf(m)', 'import → buildPersonalRow (rrLinkForVariation + rrFixRowLink)'],
    ['import-ui.js', 'fields.masterRowId = rrMasterRowIdOf(m)', 'same'],
    ['photo-inbox-tools.js', 'p.masterKey = key;', 'the key backfill — m went through rrRowForVariation'],
    ['photo-inbox-tools.js', 't.p.masterRowId = t.id;', 'the Row ID backfill — m went through rrRowForVariation'],
    ['sell.js', 'var m = findMaster(num, vr, {', 'a lookup hint, not a write'],
    ['wizard-save.js', 'rrMasterKeyOf(rrRowForVariation(wizard.matchedItem, itemNum, variation))', 'the Add screen save'],
    ['wizard-save.js', 'rrMasterRowIdOf(rrRowForVariation(wizard.matchedItem, itemNum, variation))', 'the Add screen save'],
  ];
  const WRITE_RE = /master(Key|RowId)\s*(:|=(?!=))/;
  const scan = files => {
    const bad = [], used = new Set();
    Object.keys(files).forEach(f => { const L = files[f].split('\n'); L.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*\*/.test(line) || !WRITE_RE.test(code)) return;
      // a statement may run onto the next line (masterKey: (…) \n ? rrMasterKeyOf(…) : …) — read both
      const stmt = line + '\n' + (/[,;{]\s*(\/\/.*)?$/.test(line) ? '' : (L[i + 1] || ''));
      const k = DOORS.findIndex(d => d[0] === f && stmt.indexOf(d[1]) >= 0);
      if (k < 0) bad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 120)); else used.add(k);
    }); });
    return { bad, used };
  };
  const files = {};
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { files[f] = fs.readFileSync(path.join(APP, f), 'utf8'); });
  // the two backfill doors are safe only because m goes through the helper first
  const pit = files['photo-inbox-tools.js'];
  T('E0  both backfills put the catalog row through rrRowForVariation before writing', (pit.match(/m = rrRowForVariation\(m, p\.itemNum, p\.variation \|\| ''\)/g) || []).length === 2);
  const s0 = scan(files);
  T('E1  every line in app/ that writes Master Key / Master Row ID is a known door', s0.bad.length === 0, s0.bad);
  T('E2  the list of doors has no stale entry (each still matches a line)', s0.used.size === DOORS.length, DOORS.filter((d, k) => !s0.used.has(k)).map(d => d[0] + ' ' + d[1]));
  const planted = Object.assign({}, files, { 'sell.js': files['sell.js'] + '\nfunction _x(pd, m) { pd.masterRowId = rrMasterRowIdOf(m); }\n' });
  T('E3  PLANTED a new unguarded door → red', scan(planted).bad.length === 1, scan(planted).bad);
  const plantedSave = Object.assign({}, files, { 'wizard-save.js': files['wizard-save.js'].replace('rrMasterKeyOf(rrRowForVariation(wizard.matchedItem, itemNum, variation))', 'rrMasterKeyOf(wizard.matchedItem)') });
  const s4 = scan(plantedSave);
  T('E4  PLANTED the old Add-screen line (the step-1 row) → red', s4.bad.length === 1 && /wizard-save\.js/.test(s4.bad[0]), s4.bad);
  T('E5  both whole-row builders end in rrFixRowLink', /return rrFixRowLink\(row\);/.test(files['app.js']) && /\? rrFixRowLink\(out\) : out;/.test(files['app.js']));

  // ── F: the real road at iPhone size ──────────────────────────────────────
  {
    const { pg, errs } = await bootApp(browser, null, { width: 390, height: 844 });
    const r = await pg.evaluate(`(function () {
      (${LARS_WORLD})({ six: ${six} });
      const listed = (${OPEN_COLLECTION})({});
      const txt = (document.getElementById('page-browse') || {}).innerText || '';
      return { listed, txt: (txt.match(/[^\\n]*\\b54\\b[^\\n]*/g) || []).slice(0, 4), rows: document.querySelectorAll('#browse-tbody tr, #browse-cards .item-card, .coll-card').length };
    })()`);
    console.log('\n== F · the real road (iPhone size) ==');
    T('F1  Lars\'s shape: the list holds 54 after load', r.listed === 54, r);
    T('F2  the page says 54', r.txt.length > 0, r);
    T('F3  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
