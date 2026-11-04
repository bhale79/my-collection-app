#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PUT ITEMS YOU ALREADY OWN INTO A SET — 2026-11-03   (real Chromium, the REAL app)
// PLAN_2026-11-03_GROUP_EXISTING.md. Lars Brown: "Is it possible to group items
// after already entered or do I need to start over?" Until this build a Group
// ID was written only while a piece was being ADDED. Now:
//   wizard-save.js  rrLinkOwnedToGroup — THE one stamp (identity-checked,
//                   whole group or nothing, refuses another set's member)
//                   launchSetItemWizard asks "use the one I have" per piece
//   app-collection  rrOwnedPickerOpen / rrOwnedPickerRows — the owned-item picker
//                   "A Piece I Already Own" in Add a Piece to Group
//                   rrSetPiecesCardHtml / rrSetAddOwnedOpen — the set page's Pieces
//                   rrSetOwnedCandidates / rrSetOwnedPieceAsk — the set walk's question
//   wizard.js       "My Own Set — not in our catalogs" on the Add list (_wizOpenOwnSet)
//   config.js       RR_LINK_OWNED, RR_ADD_PIECE.owned — every word
//
// What is proved, through the app's own functions and buttons — only the Google
// writers are stood in for, and they RECORD what they were asked to write:
//   A  the picker's rows: every copy on its own, piece rows and the page's own
//      copy never offered, another set's member shown greyed with the reason
//   B  the popup: "A Piece I Already Own" after Add Another Item; opens the
//      picker; guarded; search narrows; a greyed row cannot be picked
//   C  the stamp from the item page: an ungrouped copy mints its group, the
//      picked engine brings its box AND instruction sheet, every row checked
//      before the first write, state follows, the page repaints
//   D  refusals: another set's member; a row not on the sheet yet; already in
//      the group; a second call while one writes; one changed row = nothing written
//   E  the set page: the Pieces card lists the set's items (tappable), its
//      button opens the picker aimed at the set, a pick joins the set, and a set
//      saved before Group IDs gets one written to its own row first
//   F  the set walk: an owned piece is asked about once — "use the one I have"
//      stamps it and moves on; two copies are each offered; "add another copy"
//      walks the Add steps; another set's member is not offered
//   G  "My Own Set" on the Add list: lands on the pieces box with the own-set
//      path chosen, no Lionel guesses, continues to the own-set step; the
//      typed number and maker ride in
//   H  the own set's name / number / year / maker ride from piece to piece
//      through the walk (v0.9.2105 lost them; v0.9.2106's _setCarry fixed it —
//      pinned here because the walk's new question sits right beside it)
//   P  planted offenders — each change undone in a served copy of the file
//      must turn its own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  group_existing_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const MTH = Object.keys(ERAS).find(k => ERAS[k].manufacturer === 'MTH' && !ERAS[k].partsOfficial) || 'mth_o';
    const mk = (n, t, era, tab, yr, road) => ({ itemNum: n, variation: '', itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: road || '' });
    state.masterData = [
      mk('2343', 'Diesel', 'pw', 'Lionel PW - Items', '1950', 'Santa Fe'),
      mk('6464', 'Boxcar', 'pw', 'Lionel PW - Items', '1953'),
      mk('6357', 'Caboose', 'pw', 'Lionel PW - Items', '1948'),
      mk('2046', 'Steam', 'pw', 'Lionel PW - Items', '1950'),
      mk('6457', 'Caboose', 'pw', 'Lionel PW - Items', '1949'),
      mk('6465', 'Tank Car', 'pw', 'Lionel PW - Items', '1948'),
      mk('30-1234-1', 'Steam', MTH, ERAS[MTH].prefix || 'MTH O', '2001'),
    ];
    _rebuildMasterIndex();
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row, era: 'pw', manufacturer: 'Lionel' }, x);
    function seed() {
      state.personalData = {
        kE:   pd('2343', '21', 5, { groupId: 'GRP-E', condition: '8' }),          // engine with its box + sheet
        kEb:  pd('2343-BOX', '22', 6, { groupId: 'GRP-E' }),
        kC1:  pd('6464', '23', 7, { groupId: '', condition: '7' }),               // two copies of one car
        kC2:  pd('6464', '24', 8, { groupId: '', condition: '6' }),
        kS:   pd('6357', '25', 9, { groupId: 'SET-2190W-1', condition: '9' }),    // in another set
        kT:   pd('2046', '26', 10, { groupId: 'GRP-T', condition: '5' }),         // alone in a group
        kNew: pd('6457', '27', 99999, { groupId: '' }),                           // not on the sheet yet
        kP:   pd('6465', '28', 11, { groupId: 'OWN-PE-1', condition: '7' }),      // already in the own set
      };
      state.isData = { i1: { sheetNum: '2343-IS', linkedItem: '2343', groupId: 'GRP-E', row: 4, inventoryId: 'I1', owned: true } };
      state.mySetsData = {
        S1: { row: 3, setNum: '2190W', setName: 'Santa Fe Freight', year: '1953', groupId: 'SET-2190W-1', setId: 'SET-2190W', inventoryId: 'S1' },
        S2: { row: 4, setNum: 'PE-1', setName: 'Polar Express', year: '2004', groupId: 'OWN-PE-1', setId: 'OWN-SET', inventoryId: 'S2' },
        S3: { row: 5, setNum: '1467W', setName: 'Old Set', year: '1952', groupId: '', setId: 'SET-1467W', inventoryId: 'S3' },
      };
    }
    seed();
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    // Stand-ins for the Google writers — they record, nothing leaves the page.
    const updates = [], stills = [], toasts = [], appended = [];
    let stillFalseRow = null, slowMs = 0, seq = 0;
    window.rrRowStillIs = async (id, tab, row) => { stills.push({ tab: tab, row: row, seq: ++seq }); return row !== stillFalseRow; };
    window.rrVerifiedRowUpdate = async (id, tab, row, range, vals, expect) => {
      if (slowMs) await new Promise(r => setTimeout(r, slowMs));
      const still = await window.rrRowStillIs(id, tab, row, expect && expect.num, expect && expect.invId);
      if (!still) return false;
      updates.push({ tab: tab, row: row, range: range, v: vals[0][0], seq: ++seq }); return true;
    };
    window.sheetsAppend = async (id, range, rows) => { appended.push(rows[0]); return 200 + appended.length; };
    window.driveEnsureSetup = async () => {};
    window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n;
    window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    window._cachePersonalData = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const last = () => toasts[toasts.length - 1] || '';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // ── A — the picker's rows ──
    const rowsA = rrOwnedPickerRows({ excludeKey: 'kC1', excludeGroup: '' });
    R.aKeys = rowsA.map(r => r.key).join(',');
    R.aDisabled = rowsA.filter(r => r.disabled).map(r => r.key).join(',');
    R.aNoteS = (rowsA.find(r => r.key === 'kS') || {}).note || '';
    R.aNoteE = (rowsA.find(r => r.key === 'kE') || {}).note || '';
    R.aCondC2 = (rowsA.find(r => r.key === 'kC2') || {}).cond || '';
    R.aSubE = (rowsA.find(r => r.key === 'kE') || {}).sub || '';
    const rowsA2 = rrOwnedPickerRows({ excludeKey: '', excludeGroup: 'OWN-PE-1' });
    R.a2HasP = rowsA2.some(r => r.key === 'kP');
    R.a2HasC1 = rowsA2.some(r => r.key === 'kC1');

    // ── B — the popup and the picker ──
    rrAddPieceOpen('23');
    const ov = document.getElementById('rr-add-piece');
    R.bKinds = ov ? Array.from(ov.querySelectorAll('[data-piece]')).map(b => b.getAttribute('data-piece')).join(',') : '';
    const ownedBtn = ov && ov.querySelector('[data-piece="owned"]');
    R.bOwnedLabel = ownedBtn ? ownedBtn.textContent : '';
    if (ownedBtn) ownedBtn.click();
    await sleep(50);
    const pk = document.getElementById('rr-owned-picker');
    R.bPickerOpen = !!pk; R.bPopGone = !document.getElementById('rr-add-piece');
    R.bGuarded = !!(pk && pk._rrGuarded);
    R.bRows = pk ? Array.from(pk.querySelectorAll('button[data-pick]')).map(b => b.getAttribute('data-pick')).join(',') : '';
    R.bDisabledS = !!(pk && pk.querySelector('button[data-pick="kS"]') && pk.querySelector('button[data-pick="kS"]').disabled);
    if (pk) pk.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    R.bAfterBackdrop = !!document.getElementById('rr-owned-picker');
    const q = pk && pk.querySelector('#rr-owned-picker-q');
    if (q) { q.value = '2046'; q.dispatchEvent(new Event('input')); }
    R.bNarrowed = pk ? Array.from(pk.querySelectorAll('button[data-pick]')).map(b => b.getAttribute('data-pick')).join(',') : '';
    if (q) { q.value = 'zzz'; q.dispatchEvent(new Event('input')); }
    R.bNoMatch = pk ? pk.querySelector('#rr-owned-picker-list').textContent.trim() : '';
    if (q) { q.value = ''; q.dispatchEvent(new Event('input')); }
    updates.length = 0;
    const sBtn = pk && pk.querySelector('button[data-pick="kS"]');
    if (sBtn) sBtn.click();
    await sleep(50);
    R.bDisabledPickDidNothing = updates.length === 0 && !!document.getElementById('rr-owned-picker');

    // ── C — pick the engine from the car's page: car mints its group; engine, box, sheet join ──
    updates.length = 0; stills.length = 0;
    let repainted = '';
    window.rrDetailRepaint = (ms, inv) => { repainted = String(inv); };
    const eBtn = pk && pk.querySelector('button[data-pick="kE"]');
    if (eBtn) eBtn.click();
    for (let i = 0; i < 60 && !repainted; i++) await sleep(50);
    R.cPickerClosed = !document.getElementById('rr-owned-picker');
    const gidC = state.personalData.kC1.groupId || '';
    R.cMinted = /^GRP-6464-\d+$/.test(gidC);
    // rrGroupIdForCopy backfills the car's inventory ID and group on its own (not awaited), so compare as a set
    R.cRows = updates.map(u => u.tab + ':' + u.row + '=' + (u.v === gidC ? 'GID' : u.v)).sort().join('|');
    R.cStateE = state.personalData.kE.groupId === gidC && state.personalData.kEb.groupId === gidC;
    R.cStateIS = state.isData.i1.groupId === gidC;
    R.cRepainted = repainted;
    R.cToast = last();
    // the box's row (6) is checked BEFORE the engine's row (5) is written — the whole group first
    const firstCheck6 = (stills.find(s => s.tab === PERSONAL_TAB && s.row === 6) || {}).seq || 0;
    const firstWrite5 = (updates.find(u => u.tab === PERSONAL_TAB && u.row === 5) || {}).seq || 0;
    R.cChecksBeforeWrite = firstCheck6 > 0 && firstWrite5 > 0 && firstCheck6 < firstWrite5;

    // ── D — refusals ──
    seed();
    updates.length = 0;
    const d1 = await rrLinkOwnedToGroup('kS', 'GRP-T', { target: 'this group' });
    R.d1 = (d1 && d1.reason) + '|' + updates.length + '|' + last();
    const d2 = await rrLinkOwnedToGroup('kNew', 'GRP-T', { target: 'this group' });
    R.d2 = (d2 && d2.reason) + '|' + updates.length + '|' + last();
    const d3 = await rrLinkOwnedToGroup('kT', 'GRP-T', { target: 'this group' });
    R.d3 = (d3 && d3.ok && d3.already) + '|' + updates.length + '|' + last();
    const d0 = await rrLinkOwnedToGroup('nope', 'GRP-T', {});
    R.d0 = (d0 && d0.reason) + '|' + updates.length;
    // busy: two at once
    slowMs = 120;
    const pA = rrLinkOwnedToGroup('kC1', 'GRP-T', { target: 'this group' });
    await sleep(10);
    const pB = rrLinkOwnedToGroup('kC2', 'GRP-T', { target: 'this group' });
    const [rA, rB] = await Promise.all([pA, pB]);
    slowMs = 0;
    R.d4 = (rA && rA.ok) + '|' + (rB && rB.reason) + '|' + updates.map(u => u.row).join(',');
    // one changed row = nothing written (the engine's box moved under it)
    seed(); updates.length = 0; stillFalseRow = 6;
    const d5 = await rrLinkOwnedToGroup('kE', 'GRP-T', { target: 'this group' });
    stillFalseRow = null;
    R.d5 = (d5 && d5.reason) + '|' + updates.length + '|' + (state.personalData.kE.groupId);

    // ── E — the set page ──
    seed(); updates.length = 0;
    showNonItemDetailPage('sets', 'S2');
    await sleep(50);
    const card = document.getElementById('set-pieces-card');
    R.eCard = !!card;
    R.ePieces = card ? Array.from(card.querySelectorAll('button[data-piece-inv]')).map(b => b.getAttribute('data-piece-inv')).join(',') : '';
    R.eHead = card ? (card.querySelector('div') || {}).textContent : '';
    const addBtn = document.getElementById('set-add-owned');
    R.eBtn = addBtn ? addBtn.textContent : '';
    let opened = '';
    window._openOwnedByInvId = (inv) => { opened = String(inv); };
    const pieceBtn = card && card.querySelector('button[data-piece-inv="28"]');
    if (pieceBtn) pieceBtn.click();
    R.eTapOpens = opened;
    if (addBtn) addBtn.click();
    await sleep(50);
    const pk2 = document.getElementById('rr-owned-picker');
    R.ePicker = pk2 ? Array.from(pk2.querySelectorAll('button[data-pick]')).map(b => b.getAttribute('data-pick')).join(',') : '';
    R.ePickerSub = pk2 ? pk2.textContent.indexOf('this set') >= 0 : false;
    const c2Btn = pk2 && pk2.querySelector('button[data-pick="kC2"]');
    if (c2Btn) c2Btn.click();
    for (let i = 0; i < 60 && !updates.length; i++) await sleep(50);
    await sleep(100);
    R.e2Rows = updates.map(u => u.tab + ':' + u.row + '=' + u.v).join('|');
    const card2 = document.getElementById('set-pieces-card');
    R.e2Pieces = card2 ? Array.from(card2.querySelectorAll('button[data-piece-inv]')).map(b => b.getAttribute('data-piece-inv')).join(',') : '';
    // a set saved before Group IDs
    updates.length = 0;
    showNonItemDetailPage('sets', 'S3');
    await sleep(50);
    R.e3Empty = (document.getElementById('set-pieces-card') || {}).textContent || '';
    document.getElementById('set-add-owned').click();
    await sleep(50);
    const pk3 = document.getElementById('rr-owned-picker');
    const tBtn = pk3 && pk3.querySelector('button[data-pick="kT"]');
    if (tBtn) tBtn.click();
    for (let i = 0; i < 60 && updates.length < 2; i++) await sleep(50);
    const gid3 = state.mySetsData.S3.groupId || '';
    R.e3Minted = /^SET-1467W-\d+$/.test(gid3);
    R.e3Rows = updates.map(u => u.tab + ':' + u.row + '=' + (u.v === gid3 ? 'GID' : u.v)).join('|');
    R.e3Range = (updates[0] || {}).range || '';
    R.e3State = state.personalData.kT.groupId === gid3;

    // ── F — the set walk ──
    seed(); updates.length = 0;
    const setData = () => ({
      tab: 'set', _resolvedSet: { setNum: '2190W', setName: 'Santa Fe Freight', year: '1953', items: ['2343', '6464', '6357'], alts: [] },
      _setFinalItems: ['2343', '6464', '6357'], _setGroupId: 'SET-2190W-NEW', _setItemIndex: 0, _setItemsSaved: [],
      _setEntryMode: 'full', entryMode: 'full', _setCondition: 7, _setWorth: '100',
    });
    _buildWizardModal();
    wizard = { step: 0, tab: 'set', data: setData(), steps: getSteps('set'), matchedItem: null };
    launchSetItemWizard();
    await sleep(50);
    const ask1 = document.getElementById('rr-set-owned-ask');
    R.f1Ask = !!ask1;
    R.f1Title = ask1 ? (ask1.querySelector('div > div') || {}).textContent : '';
    R.f1Uses = ask1 ? Array.from(ask1.querySelectorAll('button[data-use]')).map(b => b.getAttribute('data-use')).join(',') : '';
    R.f1Guarded = !!(ask1 && ask1._rrGuarded);
    const use1 = ask1 && ask1.querySelector('button[data-use="kE"]');
    if (use1) use1.click();
    for (let i = 0; i < 80 && !document.getElementById('rr-set-owned-ask'); i++) await sleep(50);
    await sleep(60);
    R.f1Rows = updates.map(u => u.tab + ':' + u.row + '=' + u.v).join('|');
    R.f1Saved = (wizard.data._setItemsSaved || []).join(',');
    R.f1Idx = wizard.data._setItemIndex;
    R.f1Used = (wizard.data._setUsedOwned || []).join(',');
    const ask2 = document.getElementById('rr-set-owned-ask');
    R.f2Ask = !!ask2;
    R.f2Uses = ask2 ? Array.from(ask2.querySelectorAll('button[data-use]')).map(b => b.getAttribute('data-use')).join(',') : '';
    R.f2Which = ask2 ? ask2.textContent.indexOf('(1 of 2)') >= 0 && ask2.textContent.indexOf('(2 of 2)') >= 0 : false;
    const add2 = ask2 && ask2.querySelector('button[data-add]');
    if (add2) add2.click();
    await sleep(100);
    R.f2Tab = wizard.tab; R.f2Num = wizard.data.itemNum; R.f2Step = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.f2Asked = JSON.stringify(wizard.data._setOwnedAsked || {});
    R.f2Group = wizard.data._setGroupId;
    R.f2AskGone = !document.getElementById('rr-set-owned-ask');
    // asked once: launching the same slot again does not ask
    launchSetItemWizard();
    await sleep(50);
    R.f2AgainNoAsk = !document.getElementById('rr-set-owned-ask') && wizard.data.itemNum === '6464';
    // another set's member is never a candidate; a copy used by this walk is not offered twice
    R.f3Cands = rrSetOwnedCandidates('6357', wizard.data).join(',') + '|' + rrSetOwnedCandidates('2343', wizard.data).join(',');
    try { _doCloseWizard(); } catch (e) {}

    // ── G — "My Own Set" on the Add list ──
    seed();
    await openWizard('collection');
    R.gKindOption = !!document.querySelector('#wiz-kind-select option[value="ownset"]');
    R.gKindLabel = (document.querySelector('#wiz-kind-select option[value="ownset"]') || {}).textContent || '';
    wizard.data.itemNum = '30-1234-1';
    wizard.data._searchFilterManufacturer = 'MTH';
    _wizSetKind('ownset');
    for (let i = 0; i < 40 && !(wizard.tab === 'set' && wizard.data._ownSet); i++) await sleep(50);
    await sleep(60);
    R.gTab = wizard.tab; R.gOwn = !!wizard.data._ownSet;
    R.gStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.gKind = _wizCurrentKind();
    R.gTitle = (document.getElementById('wiz-title') || document.querySelector('#wizard-modal h2') || {}).textContent || document.getElementById('wizard-modal').textContent.slice(0, 400);
    R.gEntered = (wizard.data._enteredNums || []).join(',');
    R.gMaker = wizard.data._ownSetMaker;
    R.gOwnBtn = !!document.getElementById('set-own-continue');
    R.gNoLink = document.getElementById('wizard-modal').textContent.indexOf('My set isn’t listed') < 0 || !!document.getElementById('set-own-continue');
    R.gLinkCount = Array.from(document.querySelectorAll('#wizard-modal button')).filter(b => /My set isn.t listed/.test(b.textContent) && b.id !== 'set-own-continue').length;
    R.gSugg = (wizard.data._suggestions_cache || []).length;
    document.getElementById('set-id-input').value = '6464';
    window._setAddEntered();
    await sleep(30);
    R.gEntered2 = (wizard.data._enteredNums || []).join(',');
    document.getElementById('set-own-continue').click();
    await sleep(80);
    R.gNextStep = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
    R.gFinal = (wizard.data._setFinalItems || []).join(',');
    try { _doCloseWizard(); } catch (e) {}

    // ── H — the own set's name rides through the walk (v0.9.2105 lost it) ──
    seed();
    _buildWizardModal();
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: {
      tab: 'set', _ownSet: true, _ownSetName: 'Polar Express', _ownSetNum: 'PE-9', _ownSetYear: '2004', _ownSetMaker: 'Lionel',
      _searchFilterManufacturer: 'Lionel', _setFinalItems: ['6464'], _setGroupId: 'OWN-PE-9', _setItemIndex: 0, _setItemsSaved: [],
      _setEntryMode: 'full', entryMode: 'full', _setCondition: 7, _setWorth: '50',
    } };
    launchSetItemWizard();
    await sleep(50);
    const askH = document.getElementById('rr-set-owned-ask');
    if (askH) askH.querySelector('button[data-add]').click();
    await sleep(80);
    R.hName = wizard.data._ownSetName; R.hNum = wizard.data._ownSetNum; R.hYear = wizard.data._ownSetYear;
    R.hMaker = wizard.data._ownSetMaker; R.hFilter = wizard.data.manualManufacturer; R.hOwn = !!wizard.data._ownSet;
    R.hTab = wizard.tab;
    try { _doCloseWizard(); } catch (e) {}
    // a catalog set does not pick up the own-set maker carry
    _buildWizardModal();
    wizard = { step: 0, tab: 'set', steps: getSteps('set'), matchedItem: null, data: Object.assign(setData(), { _setFinalItems: ['6357'], _ownSetMaker: 'MTH' }) };
    launchSetItemWizard();
    await sleep(60);
    R.h2Filter = wizard.data.manualManufacturer;
    try { _doCloseWizard(); } catch (e) {}

    R.toasts = toasts.slice(-4);
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

  ok('A1 every copy is its own row, in number order; the page’s copy and the box row are never offered', R.aKeys === 'kT,kE,kS,kNew,kC2,kP', R.aKeys);
  ok('A2 a member of another set (catalog or own) is greyed, with the set named', R.aDisabled === 'kS,kP' && /Set 2190W/.test(R.aNoteS), R.aDisabled + ' ' + R.aNoteS);
  ok('A3 an engine with its box says what comes along', /2 pieces/.test(R.aNoteE), R.aNoteE);
  ok('A4 a copy shows its condition and its catalog words', /6\/10/.test(R.aCondC2) && /Santa Fe/.test(R.aSubE), R.aCondC2 + ' ' + R.aSubE);
  ok('A5 aimed at a set, its own pieces are left out', R.a2HasP === false && R.a2HasC1 === true, R.a2HasP + ' ' + R.a2HasC1);
  ok('B1 "A Piece I Already Own" sits after Add Another Item', R.bKinds === 'box,is,mbox,item,owned' && /A Piece I Already Own/.test(R.bOwnedLabel), R.bKinds);
  ok('B2 it opens the picker (the popup closes), guarded', R.bPickerOpen && R.bPopGone && R.bGuarded && R.bAfterBackdrop, [R.bPickerOpen, R.bPopGone, R.bGuarded, R.bAfterBackdrop].join(' '));
  ok('B3 the picker lists the rows; the set’s member is greyed', R.bRows === 'kT,kE,kS,kNew,kC2,kP' && R.bDisabledS, R.bRows + ' ' + R.bDisabledS);
  ok('B4 the search narrows; nothing matching says so', R.bNarrowed === 'kT' && /Nothing matches/.test(R.bNoMatch), R.bNarrowed + ' ' + R.bNoMatch);
  ok('B5 a greyed row cannot be picked', R.bDisabledPickDidNothing === true, String(R.bDisabledPickDidNothing));
  ok('C1 the car mints its own group (GRP-6464-…)', R.cMinted && R.cPickerClosed, R.cMinted + ' ' + R.cPickerClosed);
  ok('C2 the engine, its box AND its instruction sheet are written with that group — the car’s own row too',
     R.cRows === 'Instruction Sheets:4=GID|My Collection:5=GID|My Collection:6=GID|My Collection:7=23|My Collection:7=GID', R.cRows);
  ok('C3 every row of the group is checked before the first of them is written', R.cChecksBeforeWrite === true, String(R.cChecksBeforeWrite));
  ok('C4 state follows the sheet, the page repaints by inventory ID, the toast counts the extras', R.cStateE && R.cStateIS && R.cRepainted === '23' && /and 2 more/.test(R.cToast), [R.cStateE, R.cStateIS, R.cRepainted, R.cToast].join(' '));
  ok('D1 another set’s member is refused, by name, nothing written', /^inSet\|0\|/.test(R.d1) && /Set 2190W/.test(R.d1), R.d1);
  ok('D2 a row not on the sheet yet is refused', /^noRow\|0\|/.test(R.d2) && /refresh/.test(R.d2), R.d2);
  ok('D3 already in the group: nothing written, said so', /^true\|0\|/.test(R.d3) && /already/.test(R.d3), R.d3);
  ok('D4 a copy that is gone is refused; a second call while one writes is refused (busy)', R.d0 === 'gone|0' && /^true\|busy\|7$/.test(R.d4), R.d0 + ' ' + R.d4);
  ok('D5 one changed row in the group = nothing written at all', R.d5 === 'refused|0|GRP-E', R.d5);
  ok('E1 the set page has a Pieces card listing the set’s items, and the button', R.eCard && R.ePieces === '28' && /Pieces/.test(R.eHead) && /Add a Piece I Already Own/.test(R.eBtn), [R.eCard, R.ePieces, R.eBtn].join(' '));
  ok('E2 a piece opens by inventory ID', R.eTapOpens === '28', R.eTapOpens);
  ok('E3 the button opens the picker aimed at the set, without the set’s own pieces', R.ePicker === 'kT,kE,kS,kNew,kC1,kC2' && R.ePickerSub, R.ePicker + ' ' + R.ePickerSub);
  ok('E4 a pick joins the set and the card redraws with it', R.e2Rows === 'My Collection:8=OWN-PE-1' && R.e2Pieces === '24,28', R.e2Rows + ' ' + R.e2Pieces);
  ok('E5 a set saved before Group IDs gets one written to its own row first (My Sets, column G), then the pick',
     R.e3Minted && /^My Sets:5=GID\|My Collection:10=GID$/.test(R.e3Rows) && R.e3Range === 'My Sets!G5:G5' && R.e3State && /No pieces/.test(R.e3Empty), [R.e3Minted, R.e3Rows, R.e3Range, R.e3State].join(' '));
  ok('F1 the walk asks about the owned engine first, guarded', R.f1Ask && /already have a 2343/.test(R.f1Title) && R.f1Uses === 'kE' && R.f1Guarded, [R.f1Ask, R.f1Title, R.f1Uses].join(' '));
  ok('F2 "use the one I have" stamps engine + box + sheet with the set’s group and moves to the next piece',
     R.f1Rows === 'My Collection:5=SET-2190W-NEW|My Collection:6=SET-2190W-NEW|Instruction Sheets:4=SET-2190W-NEW' && R.f1Saved === '2343' && R.f1Idx === 1 && R.f1Used === 'kE', [R.f1Rows, R.f1Saved, R.f1Idx, R.f1Used].join(' '));
  ok('F3 two copies of the next piece are each offered', R.f2Ask && R.f2Uses === 'kC1,kC2' && R.f2Which, [R.f2Ask, R.f2Uses, R.f2Which].join(' '));
  ok('F4 "add another copy" walks the Add steps for that piece, aimed at the set', R.f2Tab === 'collection' && R.f2Num === '6464' && R.f2Group === 'SET-2190W-NEW' && R.f2AskGone && R.f2Asked === '{"0":true,"1":true}', [R.f2Tab, R.f2Num, R.f2Step, R.f2Asked].join(' '));
  ok('F5 asked once per slot', R.f2AgainNoAsk === true, String(R.f2AgainNoAsk));
  ok('F6 another set’s member is never offered; a copy already used is not offered twice', R.f3Cands === '|', R.f3Cands);
  ok('G1 "My Own Set — not in our catalogs" is on the Add list', R.gKindOption && /My Own Set/.test(R.gKindLabel), R.gKindLabel);
  ok('G2 it opens the set flow on the pieces box with the own-set path chosen', R.gTab === 'set' && R.gOwn && R.gStep === 'set_components' && R.gKind === 'ownset', [R.gTab, R.gOwn, R.gStep, R.gKind].join(' '));
  ok('G3 the pieces box: its own title, the continue button, no search link, no Lionel guesses', /Your set/.test(R.gTitle) && R.gOwnBtn && R.gLinkCount === 0 && R.gSugg === 0, [R.gTitle.slice(0, 60), R.gOwnBtn, R.gLinkCount, R.gSugg].join(' | '));
  ok('G4 the typed number and the maker ride in', R.gEntered === '30-1234-1' && R.gMaker === 'MTH', R.gEntered + ' ' + R.gMaker);
  ok('G5 a piece typed in the box is kept; continue lands on the own-set step with the pieces', R.gEntered2 === '30-1234-1,6464' && R.gNextStep === 'set_ownInfo' && R.gFinal === '30-1234-1,6464', [R.gEntered2, R.gNextStep, R.gFinal].join(' '));
  ok('H1 the own set’s name, number, year and maker ride from piece to piece (v0.9.2106 _setCarry)', R.hTab === 'collection' && R.hName === 'Polar Express' && R.hNum === 'PE-9' && R.hYear === '2004' && R.hMaker === 'Lionel' && R.hFilter === 'Lionel' && R.hOwn, [R.hTab, R.hName, R.hNum, R.hYear, R.hMaker, R.hFilter, R.hOwn].join(' '));
  ok('H2 a catalog set does not pick up the own-set maker', R.h2Filter === undefined, String(R.h2Filter));
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await pg.close();

  // ── P — planted offenders: undo one change in a served copy, its check goes red ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 another set’s member moved out quietly', plant('wizard-save.js', "  if (cur && /^(SET|OWN)-/i.test(cur)) {\n    _rrLinkSay('inSet'", "  if (false) {\n    _rrLinkSay('inSet'"), r => /^inSet\|0\|/.test(r.d1)],
    ['P2 the copy moved without its box and sheet', plant('wizard-save.js', "    Object.keys(all).forEach(function (k) { var m = all[k]; if (m && m.owned && String(m.groupId || '') === cur) members.push(k); });", '    members.push(copyKey);'), r => r.cRows === 'Instruction Sheets:4=GID|My Collection:5=GID|My Collection:6=GID|My Collection:7=23|My Collection:7=GID'],
    ['P3 rows written before the whole group is checked', plant('wizard-save.js', "    if (sid && typeof rrRowStillIs === 'function') {\n      for (var c = 0;", "    if (false) {\n      for (var c = 0;"), r => r.d5 === 'refused|0|GRP-E' && r.cChecksBeforeWrite === true],
    ['P4 piece rows offered in the picker', plant('app-collection.js', "    if (!num || P.pieceRe.test(num)) return;", '    if (!num) return;'), r => r.aKeys === 'kT,kE,kS,kNew,kC2,kP'],
    ['P5 the set walk never asks', plant('wizard-save.js', "    if (!_asked[idx]) {\n      const _cands = rrSetOwnedCandidates(itemNum, d);", "    if (false) {\n      const _cands = rrSetOwnedCandidates(itemNum, d);"), r => r.f1Ask === true],
    ['P6 the own set’s name dropped between pieces (v0.9.2105)', plant('wizard-save.js', "    ..._setCarry,\n", ''), r => r.hName === 'Polar Express'],
    ['P7 "My Own Set" opens the set flow without the own-set path', plant('wizard.js', "    wizard.data._ownSet = true;\n    wizard.data.set_knowsNum = 'No';", "    wizard.data.set_knowsNum = 'No';"), r => r.gOwn === true && r.gKind === 'ownset'],
    ['P8 the set page without its Pieces card', plant('app-collection.js', "  if (type === 'sets' && typeof rrSetPiecesCardHtml === 'function') html += rrSetPiecesCardHtml(entry, key);", ''), r => r.eCard === true],
    ['P9 the set’s own pieces offered again on its page', plant('app-collection.js', "    if (exGid && gid === exGid) return;", ''), r => r.a2HasP === false],
  ];
  for (const [name, served, check] of plants) {
    const o = await openApp(browser, served);
    let r = null;
    try { r = await scenario(o.pg); } catch (e) { r = null; }
    ok(name + ' — caught', !r || check(r) === false, r ? 'the check still passed' : '');
    await o.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  group_existing_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
