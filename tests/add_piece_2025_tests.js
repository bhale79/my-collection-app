#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD A PIECE TO GROUP — v0.9.2025   (real Chromium, the REAL app)
//
// Brad, 2026-10-25: a customer deleted his engine's box out of its group and
// could not find any way to put it back. The item page now has "Add a Piece to
// Group" (app-collection.js rrAddPieceOpen / rrAddPieceStart; words
// RR_ADD_PIECE, config.js). It offers only the pieces the copy's group is
// missing, and opens the app's own Box Only / Instruction Sheet flows aimed at
// THAT copy (wizard-save.js _rrAddPieceTarget, rrGroupIdForCopy).
//
// What is proved, through the app's own functions and buttons — only the
// Google Sheets / Drive writers are stood in for, and they RECORD what they
// were asked to write, so the assertions read the row the app built:
//   A  the list of missing pieces, per copy (box only when THIS piece has none)
//   B  the button: on an item missing pieces, never on a piece's own page,
//      never when nothing is missing; drawn on the real item page
//   C  the popup: guarded (a backdrop click does nothing), one button per
//      missing piece
//   D  Box for copy 2 of two copies of one MTH engine: joins copy 2's group
//      (not copy 1's), saved as MTH with the copy's era, and the photo picked
//      on the box screen is uploaded (it used to be held and dropped)
//   E  Master Carton: the Box Only screens, -MBOX ending, type Master Carton,
//      no box-type step
//   F  Instruction Sheet for copy 2: copy 2's group (the old finder took the
//      FIRST row with the number); for an ungrouped item, the new group is
//      written onto the item too (it used to land on the sheet only)
//   G  the aim is dropped when the number is changed on the way, and when
//      Box Only is switched off
//   P  planted offenders — each change undone in a served copy of the file
//      must turn its own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_piece_2025_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

// The scenario runs inside the page and returns plain facts.
async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const MTH = Object.keys(ERAS).find(k => ERAS[k].manufacturer === 'MTH' && !ERAS[k].partsOfficial) || 'mth_o';
    const mk = (n, t, era, tab, yr) => ({ itemNum: n, variation: '', itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: '' });
    state.masterData = [ mk('30-1234-1', 'Steam', MTH, ERAS[MTH].prefix || 'MTH O', '2001'), mk('2343', 'Diesel', 'pw', 'Lionel PW - Items', '1950') ];
    _rebuildMasterIndex();
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row }, x);
    state.personalData = {
      kA:  pd('30-1234-1', '11', 5, { era: MTH, manufacturer: 'MTH', groupId: 'GRP-A', condition: '8' }),       // copy 1 — has its box
      kAb: pd('30-1234-1-BOX', '13', 7, { era: MTH, manufacturer: 'MTH', groupId: 'GRP-A' }),
      kB:  pd('30-1234-1', '12', 6, { era: MTH, manufacturer: 'MTH', groupId: 'GRP-B', condition: '7' }),       // copy 2 — box deleted
      kBt: pd('30-1234-1T', '16', 10, { era: MTH, manufacturer: 'MTH', groupId: 'GRP-B' }),
      kC:  pd('2343', '14', 8, { era: 'pw', manufacturer: 'Lionel', groupId: '' }),                            // ungrouped Lionel
      kCb: pd('2343-BOX', '15', 9, { era: 'pw', manufacturer: 'Lionel', groupId: '' }),                         // a piece's own page
      kF:  pd('2343', '17', 11, { era: 'pw', manufacturer: 'Lionel', groupId: 'GRP-F' }),                       // a full group
      kFb: pd('2343-BOX', '18', 12, { era: 'pw', manufacturer: 'Lionel', groupId: 'GRP-F' }),
      kFi: pd('2343-IS', '19', 13, { era: 'pw', manufacturer: 'Lionel', groupId: 'GRP-F' }),
      kFm: pd('2343-MBOX', '20', 14, { era: 'pw', manufacturer: 'Lionel', groupId: 'GRP-F' }),
    };
    state.isData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    // Stand-ins for the Google writers — they record, nothing leaves the page.
    const appended = [], updates = [], folders = [], uploads = [], toasts = [];
    window.sheetsAppend = async (id, range, rows) => { appended.push(rows[0]); return 200 + appended.length; };
    window.rrVerifiedRowUpdate = async (id, tab, row, range, vals) => { updates.push({ row: row, range: range, v: vals[0][0] }); return true; };
    window.rrRowStillIs = async () => true;
    window.driveEnsureSetup = async () => {};
    window.driveEnsureItemFolder = async (n) => { folders.push(n); return 'FOLDER-' + n; };
    window.driveUploadPhoto = async (f, name) => { uploads.push(name); return {}; };
    window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const kinds = (k) => rrAddPieceMissing(k).map(p => p.kind).join(',');
    const keyOf = (inv) => Object.keys(state.personalData).find(k => String(state.personalData[k].inventoryId) === inv);

    // A — missing pieces
    R.missB = kinds('kB'); R.missA = kinds('kA'); R.missCb = kinds('kCb'); R.missF = kinds('kF'); R.missC = kinds('kC');
    // B — the button
    R.btnB = rrAddPieceBtnHtml(state.personalData.kB);
    R.btnCb = rrAddPieceBtnHtml(state.personalData.kCb);
    R.btnF = rrAddPieceBtnHtml(state.personalData.kF);
    try {
      showItemDetailPage(0, '12');
      R.pageBtn = !!document.querySelector('#page-itemdetail #detail-add-piece');
      R.pageBtnLabel = (document.querySelector('#detail-add-piece') || {}).textContent || '';
      showItemDetailPage(1, '17');
      R.pageBtnFull = !!document.querySelector('#page-itemdetail #detail-add-piece');
    } catch (e) { R.pageErr = String(e && e.message || e); }
    // C — the popup
    rrAddPieceOpen('12');
    const ov = document.getElementById('rr-add-piece');
    R.popGuarded = !!(ov && ov._rrGuarded);
    R.popPieces = ov ? Array.from(ov.querySelectorAll('[data-piece]')).map(b => b.getAttribute('data-piece')).join(',') : '';
    if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    R.popAfterBackdrop = !!document.getElementById('rr-add-piece');
    const boxBtn = ov && ov.querySelector('[data-piece="box"]');

    // D — Box for copy 2, through the popup's own button
    appended.length = 0; updates.length = 0; folders.length = 0; uploads.length = 0;
    if (boxBtn) boxBtn.click();
    for (let i = 0; i < 40 && !(window.wizard && wizard.data && wizard.data._addPieceKey); i++) await new Promise(r => setTimeout(r, 50));
    R.dStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.dChoices = Object.keys(wizard.data._groupingLinkChoices || {}).join(',');
    R.dEra = wizard.data._era; R.dMfr = wizard.data._manufacturer;
    R.dGroupQ = !!document.getElementById('bcd-grp-yes');
    wizard.data.boxCond = 8;
    wizard.data._boxPhotoFile = new File(['x'], 'shot.jpg', { type: 'image/jpeg' });
    await saveWizardItem();
    const dRow = appended[0] || [];
    R.dNum = cell(dRow, 'itemNum'); R.dGroup = cell(dRow, 'groupId');
    R.dRowMfr = cell(dRow, 'manufacturer'); R.dRowEra = cell(dRow, 'era');
    R.dPhoto = cell(dRow, 'photoBox'); R.dUploads = uploads.join('|');
    R.dGroupAOnly = Object.values(state.personalData).filter(p => p.groupId === 'GRP-A').length;

    // E — Master Carton for copy 2
    appended.length = 0;
    await rrAddPieceStart('12', 'mbox');
    R.eStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.eTitle = (document.getElementById('wizard-modal') || document.body).textContent.indexOf(RR_ADD_PIECE.mbox.cond) >= 0;
    const bv = wizard.steps.find(s => s.id === 'boxVariation');
    R.eSkipsBoxType = !!(bv && bv.skipIf && bv.skipIf(wizard.data));
    wizard.data.boxCond = 6;
    await saveWizardItem();
    const eRow = appended[0] || [];
    R.eNum = cell(eRow, 'itemNum'); R.eGroup = cell(eRow, 'groupId'); R.eType = cell(eRow, 'itemType');
    R.eMem = (Object.values(state.personalData).find(p => p.itemNum === '30-1234-1-MBOX') || {}).itemType || '';

    // F1 — Instruction Sheet for copy 2 (two copies share the number)
    appended.length = 0;
    await rrAddPieceStart('12', 'is');
    R.fStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    wizard.data.is_condition = 7;
    await saveInstructionSheet();
    const fRow = appended[0] || [];
    R.fNum = cell(fRow, 'itemNum'); R.fGroup = cell(fRow, 'groupId'); R.fMfr = cell(fRow, 'manufacturer');
    // F2 — Instruction Sheet for the UNGROUPED Lionel 2343
    appended.length = 0; updates.length = 0;
    await rrAddPieceStart('14', 'is');
    wizard.data.is_condition = 7;
    await saveInstructionSheet();
    const f2Row = appended[0] || [];
    R.f2Group = cell(f2Row, 'groupId');
    R.f2ItemGroup = state.personalData.kC.groupId || '';
    R.f2Backfill = updates.some(u => u.row === 8 && u.v === R.f2Group && R.f2Group !== '');

    // G1 — the number is changed on the way: the aim is dropped
    appended.length = 0;
    await rrAddPieceStart('12', 'box');
    wizard.data.itemNum = '2343'; wizard.data.boxCond = 5;
    await saveWizardItem();
    const gRow = appended[0] || [];
    R.gNum = cell(gRow, 'itemNum'); R.gGroup = cell(gRow, 'groupId'); R.gMfr = cell(gRow, 'manufacturer');
    // G2 — Box Only switched off
    await rrAddPieceStart('12', 'box');
    toggleBoxOnly();
    R.g2 = [wizard.data._addPieceKey, wizard.data._era, wizard.data._manufacturer, wizard.data._boxKind].filter(v => v !== undefined).length;
    try { _doCloseWizard(); } catch (e) {}
    R.toasts = toasts.slice(-3);
    return R;
  });
}

async function openApp(browser, served) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  return { pg, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const { pg, errs } = await openApp(browser);
  const R = await scenario(pg);
  if (R.pageErr) console.log('note: detail page threw: ' + R.pageErr);

  ok('A1 copy 2 (box deleted) is offered Box, Instruction Sheet, Master Carton', R.missB === 'box,is,mbox', R.missB);
  ok('A2 copy 1 (has its box) is not offered a box', R.missA === 'is,mbox', R.missA);
  ok('A3 a box’s own page is offered nothing', R.missCb === '', R.missCb);
  ok('A4 a group with all three pieces is offered nothing', R.missF === '', R.missF);
  ok('A5 an ungrouped item is offered all three', R.missC === 'box,is,mbox', R.missC);
  ok('B1 the button names itself from RR_ADD_PIECE and opens this copy by inventory ID',
     R.btnB.indexOf('Add a Piece to Group') >= 0 && R.btnB.indexOf("rrAddPieceOpen('12')") >= 0, R.btnB.slice(0, 120));
  ok('B2 no button on a piece’s own page, none when nothing is missing', R.btnCb === '' && R.btnF === '', R.btnCb + '|' + R.btnF);
  ok('B3 the real item page draws the button for copy 2', R.pageBtn === true && /Add a Piece to Group/.test(R.pageBtnLabel), JSON.stringify([R.pageBtn, R.pageBtnLabel, R.pageErr]));
  ok('B4 the real item page draws no button for a full group', R.pageBtnFull === false, String(R.pageBtnFull));
  ok('C1 the popup is guarded and lists one button per missing piece', R.popGuarded && R.popPieces === 'box,is,mbox', R.popGuarded + ' ' + R.popPieces);
  ok('C2 a backdrop click does not close it', R.popAfterBackdrop === true, String(R.popAfterBackdrop));
  ok('D1 Box opens on the box condition screen with the group question', R.dStep === 'boxCondDetails' && R.dGroupQ, R.dStep + ' ' + R.dGroupQ);
  ok('D2 the link is aimed at copy 2 only', R.dChoices === 'kB', R.dChoices);
  ok('D3 the copy’s era and maker ride along', /^mth/.test(R.dEra || '') && R.dMfr === 'MTH', R.dEra + ' ' + R.dMfr);
  ok('D4 the box row joins copy 2’s group, not copy 1’s', R.dNum === '30-1234-1-BOX' && R.dGroup === 'GRP-B' && R.dGroupAOnly === 2, [R.dNum, R.dGroup, R.dGroupAOnly].join(' '));
  ok('D5 the box row is saved as MTH with the copy’s era', R.dRowMfr === 'MTH' && /^mth/.test(R.dRowEra), R.dRowMfr + ' ' + R.dRowEra);
  ok('D6 the photo picked on the box screen is uploaded and linked', R.dUploads === '30-1234-1-BOX BOX-FV.jpg' && R.dPhoto.indexOf('FOLDER-30-1234-1-BOX') >= 0, R.dUploads + ' ' + R.dPhoto);
  ok('E1 Master Carton uses the box screens, in its own words', R.eStep === 'boxCondDetails' && R.eTitle, R.eStep + ' ' + R.eTitle);
  ok('E2 Master Carton skips the box-type step', R.eSkipsBoxType === true, String(R.eSkipsBoxType));
  ok('E3 the row is -MBOX, type Master Carton, in copy 2’s group', R.eNum === '30-1234-1-MBOX' && R.eType === 'Master Carton' && R.eGroup === 'GRP-B' && R.eMem === 'Master Carton', [R.eNum, R.eType, R.eGroup, R.eMem].join(' '));
  ok('F1 Instruction Sheet opens on the sheet finder', R.fStep === 'is_pick', R.fStep);
  ok('F2 the sheet joins copy 2’s group (two copies share the number) and carries its maker', R.fNum === '30-1234-1-IS' && R.fGroup === 'GRP-B' && R.fMfr === 'MTH', [R.fNum, R.fGroup, R.fMfr].join(' '));
  ok('F3 an ungrouped item gets the sheet’s new group too, written to its row', /^GRP-/.test(R.f2Group) && R.f2ItemGroup === R.f2Group && R.f2Backfill, [R.f2Group, R.f2ItemGroup, R.f2Backfill].join(' '));
  ok('G1 a number changed on the way drops the aim (no copy-2 group, no MTH)', R.gNum === '2343-BOX' && R.gGroup !== 'GRP-B' && R.gMfr !== 'MTH', [R.gNum, R.gGroup, R.gMfr].join(' '));
  ok('G2 switching Box Only off drops the aim and the copy’s era / maker', R.g2 === 0, String(R.g2));
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await pg.close();

  // ── P — planted offenders: undo one change in a served copy, its check goes red ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 50)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    // v0.9.2026: the row builder now also gives a piece its item's maker (a second
    // layer), so the old box-save maker only shows when BOTH layers are undone.
    ['P1 maker from the era again (old box save + old row builder)', Object.assign(plant('wizard-save.js', 'manufacturer: _resolveSaveMfr(),', 'manufacturer: _getEraManufacturer(),'), plant('app.js', "if (!_mb && typeof _brandOfItem === 'function' && _pieceOf) {", 'if (false) {')), r => r.dRowMfr === 'MTH'],
    ['P2 the box photo held and dropped (old box save)', plant('wizard-save.js', "if (!_boPhotoLink && d._boxPhotoFile) {", "if (false) {"), r => r.dUploads === '30-1234-1-BOX BOX-FV.jpg'],
    ['P3 the sheet finds the first row with the number (old IS save)', plant('wizard-save.js', 'const found = _isAim ? _isAim.pd : _findCollectionItemByNum(linkedItem);', 'const found = _findCollectionItemByNum(linkedItem);'), r => r.fGroup === 'GRP-B'],
    ['P4 a new group not written onto the item (old IS save)', plant('wizard-save.js', '    if (found) resolvedGroupId = rrGroupIdForCopy(found, linkedItem);', "    if (found) resolvedGroupId = found.groupId || ('GRP-' + linkedItem + '-' + Date.now());"), r => r.f2ItemGroup === r.f2Group && r.f2Backfill],
    ['P5 the master carton saved as a box', plant('wizard-save.js', "const _isMbox = d._boxKind === 'mbox';", 'const _isMbox = false;'), r => r.eNum === '30-1234-1-MBOX'],
    ['P6 missing pieces read without the group (offers copy 1 a box)', plant('app-collection.js', '    if (pc.kind === \'box\')  return nums.indexOf(up + \'-BOX\') < 0;', '    if (pc.kind === \'box\')  return true;'), r => r.missA === 'is,mbox'],
    ['P7 the aim kept when the number changes', plant('wizard-save.js', "  delete d._addPieceKey; delete d._manufacturer; delete d._era;\n  d._groupingLinkChoices = {};\n  return null;", '  return null;'), r => r.gGroup !== 'GRP-B'],   // v0.9.2026: judged by the group (the builder now fixes the maker on its own)
  ];
  for (const [name, served, check] of plants) {
    const o = await openApp(browser, served);
    let r = null;
    try { r = await scenario(o.pg); } catch (e) { r = null; }
    ok(name + ' — caught', !r || check(r) === false, r ? 'the check still passed' : '');
    await o.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  add_piece_2025_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
