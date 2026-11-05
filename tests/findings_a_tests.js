#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// AUDIT FIXES A — the four-platform audit's small findings (2026-11-04 night,
// [stated] Brad 21:32 CT "start the next fix if there is one, then ship it,
// and repeat until we get to 5:30am central"). Real Chromium, the REAL app.
//
//   F4  a Yes/No question answers Escape even after another key was pressed
//       (the Escape listener was {once:true}: Tab or a letter used it up)
//   F8  the one-line text box (appPrompt — the Returned asking price, a
//       rename) closes on the device Back button as Cancel, and the page
//       underneath does NOT go back
//   F9  the Upgrade row's Remove BUTTON asks first (like the Want row's);
//       "Got It" still removes quietly (the person already decided)
//   F15 the Parts Needed page's Remove BUTTON asks first — the Workbench's
//       question, now in ONE place (removePartAsk)
//   F7  listing an item from its item page: the page then says "Remove from
//       For Sale", not "List for Sale" (it was never redrawn)
//   F5/F6/F11  List for Sale, Record Sale and Add Photos (opened part-way in
//       from an item page): device Back closes them, and their own Back on the
//       first screen closes them instead of showing the skipped item-number step
//   A1-A3 (independent review, 2026-11-05): device Back while List for Sale /
//       Record Sale is hidden behind "View Item Details" returns to it (never
//       closes it); the return button goes when the window closes; picking from
//       the collection INSIDE an open Add sets no floor; the listing repaint
//       fires only if the item page is still the page.
//   F12 Back from an item page opened from a list takes ONE press (it took
//       three: building the Add window registered two HIDDEN boxes — the photo
//       chooser and Photo ID — with the Back stack, and each swallowed a press).
//       Photo ID now registers when it opens, every time it opens.
// Each fix is planted back (text-replaced in the CURRENT source) and must
// turn its check red.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  findings_a_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

// Open the real app page; `swap` = { 'file.js': 'replacement source' } serves a planted copy.
async function open(browser, swap) {
  const pg = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.dismiss());
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = decodeURIComponent(u.split('?')[0]).split('/').pop();
    if (swap && swap[name] != null) return r.fulfill({ status: 200, contentType: 'application/javascript', body: swap[name] });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  return { pg, errs };
}

// A small world on the real page: one owned 2343 (INV-1), fake Google that records writes.
async function world(browser, swap) {
  const o = await open(browser, swap);
  await o.pg.evaluate(() => {
    const mk = (n, v, t, desc) => ({ itemNum: n, variation: v, itemType: t, description: desc, _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'R' + n + v, yearProd: '1950', roadName: 'Santa Fe', gauge: 'O', varDesc: '' });
    state.masterData = [mk('2343', '1', 'Diesel Locomotive', 'Santa Fe F3 A unit')];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    state.personalData = { 'INV-1': { owned: true, itemNum: '2343', variation: '1', era: 'pw', manufacturer: 'Lionel', inventoryId: 'INV-1', row: 3, condition: '7', priceItem: '200', userEstWorth: '350' } };
    state.soldData = {}; state.wantData = {}; state.forSaleData = {};
    state.upgradeData = { 'UG-1': { itemNum: '2343', variation: '1', inventoryId: 'UG-1', row: 5, priority: 'High' } };
    state.partsData = { 'P-1': { id: 'P-1', partNum: 'SU-1', description: 'smoke unit', row: 4, status: 'wanted' } };
    window.__writes = [];
    // only writes to the lists under test count (the app's own Dashboard refresh 15 s after start is not one of them)
    window.fetch = async (u, o) => { const m = (o && o.method) || 'GET'; if (m !== 'GET' && /Parts%20Needed|Parts Needed|Want-Upgrade|For%20Sale|For Sale/.test(String(u))) window.__writes.push(m + ' ' + String(u).slice(0, 90));
      return { ok: true, status: 200, json: async () => ({ updates: { updatedRange: "'For Sale'!A5:J5" }, values: [] }), text: async () => '{}' }; };
    window.rrVerifiedRowUpdate = async () => { window.__writes.push('verified'); return true; };
    window.rrRemoveRowConfirmed = async () => { window.__writes.push('removed'); return true; };
    document.getElementById('app').classList.add('active');
    // the app's own page-Back handling (started after sign-in in the real app)
    if (typeof _initBackButton === 'function') { try { _initBackButton(); } catch (e) {} }
  });
  return o;
}

// F9 / F15: the call a Remove button makes → is there a question, and does No keep it?
async function removeAsks(pg, call) {
  return pg.evaluate(async (call) => {
    window.__writes = []; window.__done = 'pending';
    Promise.resolve(eval(call)).then(v => { window.__done = v; });
    await new Promise(r => setTimeout(r, 80));
    const asked = !!document.getElementById('_ac-yes');
    if (asked) document.getElementById('_ac-no').click();
    await new Promise(r => setTimeout(r, 80));
    return { asked, writesAfterNo: window.__writes.length, ug: !!state.upgradeData['UG-1'], part: !!Object.values(state.partsData).find(p => p.id === 'P-1') };
  }, call);
}
// F7: list INV-1 from its item page, then read which button the page shows
async function listFromPage(pg) {
  return pg.evaluate(async () => {
    showPage('itemdetail'); showItemDetailPage(0, 'INV-1');
    const before = { list: !!document.getElementById('detail-list-sale'), rm: !!document.getElementById('detail-remove-forsale') };
    listForSaleFromCollection(0, 'INV-1');
    wizard.data.askingPrice = '99'; wizard.data.forSale_salePrice = '99';
    await saveWizardItem();
    await new Promise(r => setTimeout(r, 900));
    return { before, listed: !!state.forSaleData['INV-1'], list: !!document.getElementById('detail-list-sale'), rm: !!document.getElementById('detail-remove-forsale') };
  });
}
// F5/F6/F11: open a part-way-in window; the wizard's own Back, then device Back
async function partWayBack(pg, opener) {
  const own = await pg.evaluate((opener) => {
    eval(opener);
    const m = document.getElementById('wizard-modal');
    const opened = !!(m && m.classList.contains('open'));
    const at = wizard.steps[wizard.step].id;
    const moved = wizardBack();
    if (!moved) _doCloseWizard();
    return { opened, at, moved, stepAfter: (m && m.classList.contains('open')) ? wizard.steps[wizard.step].id : '(closed)', open: m.classList.contains('open') };
  }, opener);
  await pg.waitForTimeout(250);
  await pg.evaluate(() => { history.pushState({ page: 'under' }, '', location.href); });
  await pg.evaluate((opener) => { eval(opener); }, opener);
  await pg.waitForTimeout(120);
  await pg.goBack().catch(() => {});
  await pg.waitForTimeout(300);
  const dev = await pg.evaluate(() => ({ open: document.getElementById('wizard-modal').classList.contains('open'), stack: BackStack.size() }));
  return { own, dev };
}
// F12: list → item page → one device Back
async function backFromItem(pg) {
  await pg.evaluate(() => { _buildWizardModal(); showPage('dashboard'); });
  await pg.waitForTimeout(150);
  await pg.evaluate(() => showPage('browse')); await pg.waitForTimeout(150);
  const idle = await pg.evaluate(() => BackStack.size());
  await pg.evaluate(() => showItemDetailPage(0, 'INV-1')); await pg.waitForTimeout(250);
  await pg.goBack().catch(() => {}); await pg.waitForTimeout(400);
  return { idle, page: await pg.evaluate(() => [...document.querySelectorAll('.page.active')].map(p => p.id).join(',')) };
}
// Photo ID: open → device Back closes it; twice
async function photoIdBack(pg) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    await pg.evaluate(() => { history.pushState({ page: 'under' }, '', location.href); openIdentify('add'); });
    await pg.waitForTimeout(150);
    const open = await pg.evaluate(() => document.getElementById('identify-modal').classList.contains('open'));
    await pg.goBack().catch(() => {}); await pg.waitForTimeout(350);
    out.push({ open, after: await pg.evaluate(() => document.getElementById('identify-modal').classList.contains('open')), stack: await pg.evaluate(() => BackStack.size()) });
  }
  return out;
}
// Review A1: List for Sale → "View Item Details" (the window hides) → device Back
async function peekBack(pg) {
  await pg.evaluate(() => { history.pushState({ page: 'under' }, '', location.href); listForSaleFromCollection(0, 'INV-1'); });
  await pg.waitForTimeout(150);
  const at = await pg.evaluate(() => wizard.steps[wizard.step].id);
  await pg.evaluate(() => _wizPeekDetail()); await pg.waitForTimeout(300);
  const hidden = await pg.evaluate(() => !document.getElementById('wizard-modal').classList.contains('open') && !!document.getElementById('wiz-return-pill'));
  await pg.goBack().catch(() => {}); await pg.waitForTimeout(400);
  const back1 = await pg.evaluate(() => ({ open: document.getElementById('wizard-modal').classList.contains('open'), step: wizard.steps[wizard.step].id, price: wizard.data.askingPrice, pill: !!document.getElementById('wiz-return-pill') }));
  // peek again, then close the window some other way: the return button must go with it
  await pg.evaluate(() => { _wizPeekDetail(); }); await pg.waitForTimeout(200);
  await pg.evaluate(() => { _doCloseWizard(); }); await pg.waitForTimeout(200);
  const pillAfterClose = await pg.evaluate(() => !!document.getElementById('wiz-return-pill'));
  return { at, hidden, back1, pillAfterClose };
}
// Review A2: Add → For Sale already open → "Or pick from your collection" → the price step → Back goes back, not out
async function pickInsideAdd(pg) {
  return pg.evaluate(async () => {
    await openWizard('forsale'); await new Promise(r => setTimeout(r, 200));
    const before = wizard.steps[wizard.step].id;
    _selectCollItem('INV-1'); await new Promise(r => setTimeout(r, 150));
    const at = wizard.steps[wizard.step].id;
    const floor = wizard._floorStep;
    const moved = wizardBack();
    return { before, at, floor: floor === undefined ? 'none' : floor, moved, open: document.getElementById('wizard-modal').classList.contains('open'), now: wizard.steps[wizard.step].id };
  });
}
const OPENERS = [
  ['F5  List for Sale', "listForSaleFromCollection(0, 'INV-1')"],
  ['F5  Record Sale', "sellFromCollection(0, 'INV-1')"],
  ['F11 Add Photos', "openPhotoWizard('2343', '1', 'INV-1')"],
];

// F4: another key first, then Escape
async function escapeAfterKey(pg) {
  await pg.evaluate(() => { window.__ans = 'pending'; appConfirm('Remove it?').then(v => { window.__ans = v; }); });
  await pg.keyboard.press('Tab'); await pg.keyboard.press('a');
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(80);
  return { ans: await pg.evaluate(() => window.__ans), boxGone: (await pg.$('#_ac-yes')) === null };
}
// F8: device Back on the text box — answers null, box gone, the page stays where it was
async function backOnPrompt(pg) {
  await pg.evaluate(() => { history.pushState({ page: 'under' }, '', location.href); window.__pops = 0;
    window.addEventListener('popstate', () => { window.__pops++; }); });
  await pg.evaluate(() => { window.__ans = 'pending'; appPrompt('Asking price?', '25', { type: 'number', prefix: '$' }).then(v => { window.__ans = v; }); });
  await pg.waitForTimeout(80);
  const open = (await pg.$('#_ap-input')) !== null;
  await pg.goBack().catch(() => {});
  await pg.waitForTimeout(250);
  return { open, ans: await pg.evaluate(() => window.__ans), boxGone: (await pg.$('#_ap-input')) === null,
           stack: await pg.evaluate(() => (window.BackStack ? BackStack.size() : -1)) };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const WU = read('wizard-utils.js');

  // ── F4 ──
  {
    const { pg, errs } = await open(browser);
    const r = await escapeAfterKey(pg);
    T('F4  Tab and a letter, then Escape → the question answers "no" and closes', r.ans === false && r.boxGone, r);
    // and Escape after the question closed does nothing to the NEXT one
    await pg.evaluate(() => { window.__ans = 'pending'; appConfirm('First?').then(v => { window.__ans = v; }); });
    await pg.click('#_ac-yes');
    await pg.evaluate(() => { window.__ans2 = 'pending'; appConfirm('Second?').then(v => { window.__ans2 = v; }); });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(80);
    T('F4b a question answered with Yes leaves no Escape listener behind (the next one gets its own)',
      (await pg.evaluate(() => window.__ans)) === true && (await pg.evaluate(() => window.__ans2)) === false && (await pg.$('#_ac-yes')) === null);
    T('F4c no page errors', errs.length === 0, errs);
    await pg.close();
  }
  // ── F8 ──
  {
    const { pg, errs } = await open(browser);
    const r = await backOnPrompt(pg);
    T('F8  device Back closes the text box as Cancel (null)', r.open && r.ans === null && r.boxGone, r);
    T('F8b …and the Back stack is empty again (nothing left to swallow the next Back)', r.stack === 0, r);
    // OK still pops its own Back entry
    await pg.evaluate(() => { window.__ans = 'pending'; appPrompt('Name?', 'x').then(v => { window.__ans = v; }); });
    await pg.waitForTimeout(60); await pg.click('#_ap-ok'); await pg.waitForTimeout(250);
    T('F8c OK answers the value and leaves the Back stack empty',
      (await pg.evaluate(() => window.__ans)) === 'x' && (await pg.evaluate(() => BackStack.size())) === 0);
    T('F8d no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── F9 / F15 ──
  const AP = read('app-pages.js'), MT = read('maintenance.js'), AC = read('app-collection.js'), WS = read('wizard-save.js'), WZ = read('wizard.js');
  {
    const { pg, errs } = await world(browser);
    const u = await removeAsks(pg, "removeUpgradeItemAsk('UG-1')");
    T('F9  the Upgrade Remove asks first; No keeps the entry and writes nothing', u.asked && u.writesAfterNo === 0 && u.ug, u);
    T('F9b both Upgrade Remove buttons (cards and table) call the asking Remove',
      (AP.match(/onclick="event\.stopPropagation\(\);removeUpgradeItemAsk\('\$\{_ugEntryKey\(u\)\}'\)"/g) || []).length === 2 &&
      !/onclick="event\.stopPropagation\(\);removeUpgradeItem\(/.test(AP));
    T('F9c "Got It" still takes the entry off quietly (the person already decided)', /if \(upgradeEntry\) await removeUpgradeItem\(ugKey\);/.test(AP));
    const pq = await removeAsks(pg, "removePartAsk('P-1')");
    T('F15 the Parts Remove asks first; No keeps the part and writes nothing', pq.asked && pq.writesAfterNo === 0 && pq.part, pq);
    // the real Parts page button
    const btn = await pg.evaluate(() => { showPage('parts'); _renderPartsList(); const b = Array.from(document.querySelectorAll('#parts-list button')).find(x => /Remove/.test(x.textContent)); return b ? b.getAttribute('onclick') : ''; });
    T('F15b the Parts page Remove button calls the asking Remove', /^removePartAsk\('P-1'\)$/.test(btn), btn);
    T('F15c the Workbench card asks through the same one question (no second copy of it)', /await removePartAsk\(p\.id\)/.test(MT) && !/removeCard/.test(MT));
    T('F15d no page errors', errs.length === 0, errs);
    await pg.close();
  }
  // ── F7 ──
  {
    const { pg, errs } = await world(browser);
    const r = await listFromPage(pg);
    T('F7  after listing from the item page, it says "Remove from For Sale" (not "List for Sale")', r.before.list && r.listed && r.rm && !r.list, r);
    T('F7b no page errors', errs.length === 0, errs);
    await pg.close();
  }
  // ── F5 / F6 / F11 ──
  for (const [name, opener] of OPENERS) {
    const { pg, errs } = await world(browser);
    const r = await partWayBack(pg, opener);
    T(name + ': its own Back on the first screen closes it (never the skipped item-number step)', r.own.opened && r.own.moved === false && r.own.open === false, r.own);
    T(name + ': device Back closes it, and nothing is left on the Back stack', r.dev.open === false && r.dev.stack === 0, r.dev);
    T(name + ': no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── F12 + Photo ID ──
  {
    const { pg, errs } = await world(browser);
    const r = await backFromItem(pg);
    T('F12 nothing sits on the Back stack while nothing is open (after the Add window was built)', r.idle === 0, r);
    T('F12b one device Back from an item page returns to the list', r.page === 'page-browse', r);
    const id = await photoIdBack(pg);
    T('F12c Photo ID: device Back closes it — the first time AND the second', id.every(x => x.open && !x.after && x.stack === 0), id);
    T('F12d no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── Review A1 / A2 / A3 (2026-11-05) ──
  {
    const { pg, errs } = await world(browser);
    const r = await peekBack(pg);
    T('A1  List for Sale → View Item Details → device Back: back to the listing (same step, nothing lost), not closed', r.hidden && r.back1.open && r.back1.step === r.at && !r.back1.pill, r);
    T('A1b closing the window takes its "← Back to your listing" button with it', r.pillAfterClose === false, r);
    T('A1c no page errors', errs.length === 0, errs);
    await pg.close();
  }
  {
    const { pg, errs } = await world(browser);
    const r = await pickInsideAdd(pg);
    T('A2  picked from the collection inside an open Add → no floor, Back steps back (to the picker), the window stays', r.floor === 'none' && r.moved === true && r.open, r);
    T('A2b no page errors', errs.length === 0, errs);
    await pg.close();
  }
  T('A3  the listing repaint checks the item page is STILL the page when it fires', /setTimeout\(function \(\) \{\s*\n\s*var _dpNow = document\.getElementById\('page-itemdetail'\);\s*\n\s*if \(_dpNow && _dpNow\.classList\.contains\('active'\)\) rrDetailRepaint\(0\);/.test(WS));

  // ── PLANTED ──
  {
    const a = "    if (_pk && !_pk.classList.contains('open') && _pill) {";
    T('P-A1 anchor present (once)', WZ.split(a).length === 2);
    const { pg } = await world(browser, { 'wizard.js': WZ.replace(a, "    if (false) {") });
    const r = await peekBack(pg);
    T('P-A1 PLANTED Back while peeking closes the window → A1 would fail', !(r.back1.open && r.back1.step === r.at), r);
    await pg.close();
  }
  {
    const a = "  if (wasOpen) return;";
    T('P-A2 anchor present (once)', WZ.split(a).length === 2);
    const { pg } = await world(browser, { 'wizard.js': WZ.replace(a, '') });
    const r = await pickInsideAdd(pg);
    T('P-A2 PLANTED a floor inside an open Add → A2 would fail (Back closes it)', r.moved === false, r);
    await pg.close();
  }
  {
    const a1 = "bindOverlayClose(_pickerEl, function() { closePhotoPicker(); }, { noBack: true });";
    const a2 = "rrDismissGuard(_identEl, function () { closeIdentify(); }, { noBack: true });";
    T('P-F12 anchors present (once each)', WZ.split(a1).length === 2 && WZ.split(a2).length === 2);
    const { pg } = await world(browser, { 'wizard.js': WZ.replace(a1, a1.replace(', { noBack: true }', '')).replace(a2, a2.replace(', { noBack: true }', '')) });
    const r = await backFromItem(pg);
    T('P-F12 PLANTED hidden boxes wired at build → F12/F12b would fail', !(r.idle === 0 && r.page === 'page-browse'), r);
    await pg.close();
  }
  {
    const a = "  if (window.BackStack && !BackStack.has('identify-modal')) BackStack.push('identify-modal', closeIdentify);";
    const WP = read('wizard-photos.js');
    T('P-F12c anchor present (once)', WP.split(a).length === 2);
    const { pg } = await world(browser, { 'wizard-photos.js': WP.replace(a, '') });
    const id = await photoIdBack(pg);
    T('P-F12c PLANTED Photo ID without its own Back entry → F12c would fail', !id.every(x => x.open && !x.after && x.stack === 0), id);
    await pg.close();
  }
  {
    const bad = AP.replace(/removeUpgradeItemAsk\('\$\{_ugEntryKey\(u\)\}'\)/g, "removeUpgradeItem('${_ugEntryKey(u)}')");
    T('P-F9 PLANTED the old one-tap buttons → F9b would fail', bad !== AP && /onclick="event\.stopPropagation\(\);removeUpgradeItem\(/.test(bad));
  }
  {
    const a = "+ '<button onclick=\"removePartAsk(\\'' + rrJsArg(p.id)";
    T('P-F15 anchor present (once)', AP.split(a).length === 2);
    const { pg } = await world(browser, { 'app-pages.js': AP.replace(a, a.replace('removePartAsk(', 'removePart(')) });
    const btn = await pg.evaluate(() => { showPage('parts'); _renderPartsList(); const b = Array.from(document.querySelectorAll('#parts-list button')).find(x => /Remove/.test(x.textContent)); return b ? b.getAttribute('onclick') : ''; });
    T('P-F15 PLANTED the old one-tap Parts button → F15b would fail', !/^removePartAsk\(/.test(btn), btn);
    await pg.close();
  }
  {
    const a = "if (_dpNow && _dpNow.classList.contains('active')) rrDetailRepaint(0);";
    T('P-F7 anchor present (once)', WS.split(a).length === 2);
    const { pg } = await world(browser, { 'wizard-save.js': WS.replace(a, '') });
    const r = await listFromPage(pg);
    T('P-F7 PLANTED no repaint after listing → F7 would fail', !(r.rm && !r.list), r);
    await pg.close();
  }
  {
    const a = "  if (typeof rrWizardOpenedAt === 'function') rrWizardOpenedAt(_rrWasOpen);   // audit findings 5/6/11: Back closes here, device Back too\n";
    T('P-F5 anchor present (three openers)', AC.split(a).length === 4);
    const { pg } = await world(browser, { 'app-collection.js': AC.split(a).join('') });
    const r = await partWayBack(pg, OPENERS[0][1]);
    T('P-F5 PLANTED openers without the floor → Back walks into the skipped steps and device Back leaves it open', r.own.moved === true && r.dev.open === true, r);
    await pg.close();
  }

  // ── PLANTED (F4 / F8) ──
  {
    const a = "    document.addEventListener('keydown', keyHandler);\n  });\n}\nwindow.appConfirm = appConfirm;";
    T('P-F4 anchor present (once)', WU.split(a).length === 2);
    const { pg } = await open(browser, { 'wizard-utils.js': WU.replace(a, a.replace("keyHandler);", "keyHandler, { once: true });")) });
    const r = await escapeAfterKey(pg);
    T('P-F4 PLANTED {once:true} → F4 would fail', !(r.ans === false && r.boxGone), r);
    await pg.close();
  }
  {
    const a = "    if (window.BackStack) BackStack.push('app-prompt',";
    T('P-F8 anchor present (once)', WU.split(a).length === 2);
    const { pg } = await open(browser, { 'wizard-utils.js': WU.replace(a, '    if (false) BackStack.push(\'app-prompt\',') });
    const r = await backOnPrompt(pg);
    T('P-F8 PLANTED no Back entry for the text box → F8 would fail', !(r.ans === null && r.boxGone), r);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
