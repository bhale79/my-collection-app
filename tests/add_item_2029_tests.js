#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD ANOTHER ITEM — v0.9.2029   (real Chromium, the REAL app)
//
// [stated] Brad, 2026-10-25, on the "Add a piece to No. 205-P" box: 'need to
// add "add another item" to the box. This is so you can add a b unit or maybe
// an item to a set or something like that.'
//
// The box (app-collection.js rrAddPieceOpen) now ends with "Add Another Item"
// (words RR_ADD_PIECE.another, config.js). It opens the normal Add steps from
// the start; the item saved joins THIS copy's group — found by inventory ID
// (wizard-save.js _rrAddToGroupCopy / rrAddToGroupId → rrGroupIdForCopy).
//
// Proved through the app's own functions and buttons — only the Google
// Sheets / Drive writers are stood in for, and they RECORD what they were
// asked to write, so the checks read the row the app built:
//   A  the box lists Add Another Item last, also when no piece is missing;
//      never on a box's own page
//   B  its button opens the Add steps at the start (no number, no era / maker
//      carried) with the line "Adding to the 2343 AA Set" across the top
//   C  a B unit saved that way joins the AA set's group — copy 1's, not the
//      group of a second 2343-P the user also owns
//   D  back on the item page, the group strip shows the new piece
//   E  an item with no group yet: the line says "Joins the group with No.
//      6464-1"; the new item and the item share a NEW group, written onto the
//      item's own row too
//   F  the group heading is the same one the item page draws (rrGroupHeading)
//   P  planted offenders — each change undone in a served copy of a file must
//      turn its own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_item_2029_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const mk = (n, t, yr) => ({ itemNum: n, variation: '', itemType: t, _era: 'pw', _tab: 'Lionel PW - Items', yearProd: yr, description: t + ' ' + n, roadName: 'Santa Fe' });
    state.masterData = [ mk('2343-P', 'Diesel', '1950'), mk('2343-D', 'Diesel', '1950'), mk('2343C', 'Diesel', '1950'),   // [0] = the page drawn (the page matches the copy's number exactly)
                         mk('6464-1', 'Boxcar', '1953'), mk('6464-25', 'Boxcar', '1954') ];
    _rebuildMasterIndex();
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row, era: 'pw', manufacturer: 'Lionel', condition: '7' }, x);
    // The second 2343-P comes FIRST, so a by-number finder would pick it.
    state.personalData = {
      kP2: pd('2343-P', '35', 9,  { groupId: 'GRP-OTHER' }),
      kP:  pd('2343-P', '31', 5,  { groupId: 'GRP-AA' }),
      kD:  pd('2343-D', '32', 6,  { groupId: 'GRP-AA' }),
      kDb: pd('2343-D-BOX', '33', 7, { groupId: 'GRP-AA' }),
      kX:  pd('6464-1', '40', 12, { groupId: '' }),
      kF:  pd('2343', '41', 13, { groupId: 'GRP-F' }),
      kFb: pd('2343-BOX', '42', 14, { groupId: 'GRP-F' }),
      kFi: pd('2343-IS', '43', 15, { groupId: 'GRP-F' }),
      kFm: pd('2343-MBOX', '44', 16, { groupId: 'GRP-F' }),
    };
    state.isData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    const appended = [], updates = [], toasts = [];
    window.sheetsAppend = async (id, range, rows) => { appended.push(rows[0]); return 200 + appended.length; };
    window.rrVerifiedRowUpdate = async (id, tab, row, range, vals) => { updates.push({ row: row, range: range, v: vals[0][0] }); return true; };
    window.rrRowStillIs = async () => true;
    window.driveEnsureSetup = async () => {};
    window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n;
    window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window.loadPersonalData = async () => {};   // the background re-read would wipe the stand-in data
    window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const popKinds = () => { const ov = document.getElementById('rr-add-piece'); return ov ? Array.from(ov.querySelectorAll('[data-piece]')).map(b => b.getAttribute('data-piece')).join(',') : ''; };
    const closePop = () => { const ov = document.getElementById('rr-add-piece'); if (ov) ov.remove(); };
    const waitAim = async () => { for (let i = 0; i < 60 && !(window.wizard && wizard.data && wizard.data._addToGroupInv); i++) await new Promise(r => setTimeout(r, 50)); };
    const bannerText = () => { const b = document.getElementById('wizard-group-banner'); return b ? (b.lastElementChild || b).textContent.trim() : ''; };
    const stripText = () => { const pg = document.getElementById('page-itemdetail'); const t = pg ? pg.textContent : ''; const m = /🔗\s*([^·]+)·\s*(\d+) pieces/.exec(t); return m ? m[1].trim() + ' · ' + m[2] : ''; };

    // A — the box
    rrAddPieceOpen('31'); R.popAA = popKinds(); closePop();
    rrAddPieceOpen('41'); R.popFull = popKinds(); closePop();
    R.btnPiece = rrAddPieceBtnHtml(state.personalData.kDb);
    R.btnFull = rrAddPieceBtnHtml(state.personalData.kF);
    R.anotherLabel = (RR_ADD_PIECE.another || {}).label;

    // F — the item page heading (before), through the page itself
    try {
      showItemDetailPage(0, '31');
      R.stripBefore = stripText();
      const pgEl = document.getElementById('page-itemdetail');
      R.pageActive = !!(pgEl && /\bactive\b/.test(pgEl.className));
    } catch (e) { R.pageErr = String(e && e.message || e); }
    R.headingFn = rrGroupHeading([state.personalData.kP, state.personalData.kD], false);

    // B — the button in the box opens the Add steps, aimed at copy 1
    rrAddPieceOpen('31');
    const itemBtn = document.querySelector('#rr-add-piece [data-piece="item"]');
    R.itemBtnText = itemBtn ? itemBtn.textContent : '';
    if (itemBtn) itemBtn.click();
    await waitAim();
    R.bPopGone = !document.getElementById('rr-add-piece');
    R.bStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.bFirstStep = wizard.steps[0] && wizard.steps[0].id;
    R.bNum = wizard.data.itemNum || '';
    R.bCarried = [wizard.data._era, wizard.data._manufacturer, wizard.data._addPieceKey].filter(v => v !== undefined && v !== '').length;
    R.bBanner = bannerText();

    // C — save a B unit through the app's own save
    appended.length = 0; updates.length = 0;
    Object.assign(wizard.data, { itemNum: '2343C', variation: '', condition: 7, allOriginal: 'Yes', hasBox: 'No',
      _itemGrouping: 'single', tenderMatch: 'none', setMatch: '', priceItem: '', userEstWorth: '' });
    wizard.matchedItem = findMaster('2343C', '', { era: 'pw' }) || null;
    await saveWizardItem();
    const cRow = appended.find(r => /^2343-?C$/i.test(cell(r, 'itemNum'))) || appended[0] || [];
    R.cNum = cell(cRow, 'itemNum'); R.cGroup = cell(cRow, 'groupId');
    R.cOtherSize = Object.values(state.personalData).filter(p => p.groupId === 'GRP-OTHER').length;
    R.cAASize = Object.values(state.personalData).filter(p => p.owned && p.groupId === 'GRP-AA').length;

    // D — back on the item page
    await new Promise(r => setTimeout(r, 300));
    R.stripAfter = stripText();

    // E — an item with no group yet
    appended.length = 0; updates.length = 0;
    rrAddPieceOpen('40');
    const xBtn = document.querySelector('#rr-add-piece [data-piece="item"]');
    if (xBtn) xBtn.click();
    for (let i = 0; i < 60 && !(window.wizard && wizard.data && wizard.data._addToGroupInv === '40'); i++) await new Promise(r => setTimeout(r, 50));
    R.eBanner = bannerText();
    Object.assign(wizard.data, { itemNum: '6464-25', variation: '', condition: 8, allOriginal: 'Yes', hasBox: 'No',
      _itemGrouping: 'single', tenderMatch: 'none', setMatch: '', priceItem: '', userEstWorth: '' });
    wizard.matchedItem = findMaster('6464-25', '', { era: 'pw' }) || null;
    await saveWizardItem();
    const eRow = appended.find(r => cell(r, 'itemNum') === '6464-25') || [];
    R.eGroup = cell(eRow, 'groupId');
    R.eItemGroup = state.personalData.kX.groupId || '';
    const gCol = personalColLetter('groupId');
    R.eBackfill = updates.some(u => u.row === 12 && u.range.indexOf('!' + gCol + '12') >= 0 && u.v === R.eGroup);
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

  ok('A1 the box ends with Add Another Item (pieces first)', R.popAA === 'box,is,mbox,item' && R.anotherLabel === 'Add Another Item', R.popAA + ' ' + R.anotherLabel);
  ok('A2 a group with every piece still offers Add Another Item', R.popFull === 'item', R.popFull);
  ok('A3 a box’s own page gets no button', R.btnPiece === '', R.btnPiece.slice(0, 60));
  ok('A4 an item whose group has every piece keeps the button', R.btnFull.indexOf('Add a Piece to Group') >= 0, R.btnFull.slice(0, 60));
  ok('B1 the button reads Add Another Item and closes the box', /Add Another Item/.test(R.itemBtnText) && R.bPopGone, R.itemBtnText + ' ' + R.bPopGone);
  ok('B2 the Add steps open at the start, no number typed, nothing of the copy’s carried', R.bStep === R.bFirstStep && R.bNum === '' && R.bCarried === 0, [R.bStep, R.bFirstStep, R.bNum, R.bCarried].join(' '));
  ok('B3 the line across the top says where it is going', R.bBanner === 'Adding to the 2343 AA Set', R.bBanner);
  ok('C1 the B unit joins copy 1’s AA group', /^2343-?C$/i.test(R.cNum) && R.cGroup === 'GRP-AA', R.cNum + ' ' + R.cGroup);
  ok('C2 the other 2343-P’s group is untouched', R.cOtherSize === 1, String(R.cOtherSize));
  ok('C3 the group now holds four rows (A, dummy A, its box, the B unit)', R.cAASize === 4, String(R.cAASize));
  ok('D1 the item page was showing the AA set', R.pageActive && R.stripBefore === '2343 AA Set · 3', JSON.stringify([R.pageActive, R.stripBefore]));
  ok('D2 back on the item page the strip shows the new piece', /· 4$/.test(R.stripAfter), R.stripAfter);
  ok('E1 an item with no group: “Joins the group with No. 6464-1”', R.eBanner === 'Joins the group with No. 6464-1', R.eBanner);
  ok('E2 the new item and the item share one new group', /^GRP-/.test(R.eGroup) && R.eItemGroup === R.eGroup, R.eGroup + ' ' + R.eItemGroup);
  ok('E3 that group is written onto the item’s own row', R.eBackfill === true, String(R.eBackfill));
  ok('F1 one heading: the item page and rrGroupHeading agree', R.headingFn === '2343 AA Set' && R.stripBefore.indexOf(R.headingFn) === 0, R.headingFn + ' | ' + R.stripBefore);
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await pg.close();

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 50)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the save ignores the aim', plant('wizard-save.js', '    if (_atg) d._existingGroupId = _atg;', '    if (false) d._existingGroupId = _atg;'), r => r.cGroup === 'GRP-AA'],
    ['P2 the copy found by its number (first match) instead of its inventory ID', plant('wizard-save.js', "      if (p && p.owned && String(p.inventoryId || '') === inv) return p;", "      if (p && p.owned && String(p.itemNum || '') === String(d._addToGroupNum || '')) return p;"), r => r.cGroup === 'GRP-AA' && r.cOtherSize === 1],
    ['P3 an ungrouped item not given the new group', plant('wizard-save.js', '  d._addToGroupGid = rrGroupIdForCopy(copy, copy.itemNum);', "  d._addToGroupGid = copy.groupId || ('GRP-' + copy.itemNum + '-' + Date.now());"), r => r.eItemGroup === r.eGroup && r.eBackfill],
    ['P4 Add Another Item left out of the box', plant('app-collection.js', '  if (rrAddAnotherOk(pd)) missing = missing.concat([C.another]);', ''), r => r.popAA === 'box,is,mbox,item'],
    ['P5 no line across the top', plant('wizard.js', "  if (!words) return;\n  var e = function", "  return;\n  var e = function"), r => r.bBanner === 'Adding to the 2343 AA Set'],
    ['P7 the item page not repainted after the save', plant('wizard-save.js', "    if (tab === 'collection') _rrAddToGroupRepaint(d);   // v0.9.2029", ''), r => /· 4$/.test(r.stripAfter)],
    ['P6 the button hidden when no piece is missing (old rule)', plant('app-collection.js', '  if (!C || !pd || !(rrAddPieceMissing(pd).length || rrAddAnotherOk(pd))) return \'\';', '  if (!C || !pd || !rrAddPieceMissing(pd).length) return \'\';'), r => r.btnFull.indexOf('Add a Piece to Group') >= 0],
  ];
  for (const [name, served, check] of plants) {
    const o = await openApp(browser, served);
    let r = null;
    try { r = await scenario(o.pg); } catch (e) { r = null; }
    ok(name + ' — caught', !r || check(r) === false, r ? 'the check still passed' : '');
    await o.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  add_item_2029_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
