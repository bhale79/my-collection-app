#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// "NOT SURE" OF THE VARIATION NEVER BECOMES VARIATION 1 — 2026-11-08 notsure
// (real Chromium, the REAL app)
//
// PLAN_2026-11-07_TESTING_FIXES item 2, from the testing chat's hand-tests
// T-2026-11-04-05 and T-2026-11-05-01 on Brad's computer:
//   · in a catalog set walk (2124W) "No specific variation / not sure" for each
//     2625 Pullman saved the Variation blank, but the catalog link pointed at
//     variation 1 (Master Key "pw|2625|1"), so the item page said "Var. 1" with
//     variation 1's description and the remove box said "Remove No. 2625 (Var. 1)";
//   · Add → 6017-200 said "multiple variations exist — select on next step",
//     the next step was Condition & Details, and it saved as Var. 1.
//
//   Decided 2026-11-08 by the coordinator after an independent review: DISPLAY-ONLY.
//   The saved link stays exactly what the save made (the row the add held); every
//   place that SHOWS or WRITES BACK a copy's variation uses the copy's own.
//   W  the set walk (real wizard): "not sure" for each 2625 saves Variation blank,
//      no variation description, and the link the walk held (unchanged by this
//      release); a named variation still links its own row
//   D  the list rows, the item page, the "Copy n of m" chip and its picker, the
//      Update Info box and both remove boxes show NO "Var. 1" and no variation 1
//      description; Update Info's Save keeps the Variation blank and the stored
//      link as it was — for ONE copy and for TWO "not sure" copies of one number
//      beside its box row (exactly two rows, none on the box row) — phone AND
//      computer; D0 the copies with no catalog row of their own
//   S  the share card PDF, the report builder's Variation Description column and
//      the For Sale list sheet name no Var 1 for a "not sure" copy
//   F  the Add screen's "Found" line promises the variation step only when the
//      step will ask (6017-200: one variation → no promise, no step; 2625:
//      three → the promise AND the step)
//   P  PLANTED offenders — each turns its check red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  notsure_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700)));
  cond ? pass++ : fail++;
}
function plant(src, from, to, what) {
  const out = src.split(from).join(to);
  if (out === src) throw new Error('planted ' + what + ': the line moved; update this test');
  return out;
}

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1400, height: 900 };
const PW = 'Lionel PW - Items';
const mk = (n, v, t, road, desc, vd, id, x) => Object.assign({ itemNum: n, variation: v, itemType: t, roadName: road, description: desc, varDesc: vd,
  _era: 'pw', _tab: PW, rowId: id, yearProd: '1946-1950', gauge: 'O', manufacturer: 'Lionel' }, x || {});
const ROWS = [
  mk('2332', '', 'Electric Locomotive', 'Pennsylvania', 'GG1 Electric', '', 'E2332XXXXX'),
  mk('2625', '1', 'Passenger Car', 'Irvington', 'Heavyweight Pullman', 'VARONE-DESC brown, Irvington nameplates', 'P2625V1XXX'),
  mk('2625', '2', 'Passenger Car', 'Madison', 'Heavyweight Pullman', 'VARTWO-DESC brown, Madison nameplates', 'P2625V2XXX'),
  mk('2625', '3', 'Passenger Car', 'Manhattan', 'Heavyweight Pullman', 'VARTHREE-DESC brown, Manhattan nameplates', 'P2625V3XXX'),
  // the 2625's BOX: on 772 postwar numbers the box is the only blank-variation row
  mk('2625', '', 'Paper / Box / Misc', '', 'Pullman box', '', 'B2625BOXXX', { _tab: 'Lionel PW - Boxes' }),
  mk('6017-200', '1', 'Caboose', 'United States Navy', 'SP-type Caboose', 'CABOOSEONE-DESC blue, white lettering', 'C6017V1XXX'),
  // a number with a real PLAIN row beside its variations (same catalog tab)
  mk('2999', '', 'Boxcar', 'Lionel Lines', 'Boxcar', '', 'P2999PLAIN'),
  mk('2999', '1', 'Boxcar', 'Lionel Lines', 'Boxcar', 'BOX-ONE', 'P2999V1XXX'),
  mk('2999', '2', 'Boxcar', 'Lionel Lines', 'Boxcar', 'BOX-TWO', 'P2999V2XXX'),
  // a powered unit is drawn from its BASE number's row (2343-P → 2343)
  mk('2343', '1', 'Diesel Locomotive', 'Santa Fe', 'F3 A unit', 'F3ONE-DESC silver and red', 'D2343V1XXX'),
  mk('2343', '2', 'Diesel Locomotive', 'Santa Fe', 'F3 A unit', 'F3TWO-DESC screened nose', 'D2343V2XXX'),
];
const SETS = [{ setNum: '2124W', setName: 'Four-Car Passenger Set', year: '1947', gauge: 'O', items: ['2332', '2625', '2625', '2625'], alts: [], _era: 'pw' }];

async function open(browser, viewport, served) {
  const ctx = await browser.newContext({ viewport });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(([rows, sets]) => {
    try { localStorage.clear(); } catch (e) {}
    state.masterData = rows.map(r => Object.assign({}, r));
    state.setData = sets.map(s => Object.assign({}, s));
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalData = {}; state.mySetsData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.soldData = {}; state.wantData = {}; state.forSaleData = {}; state.upgradeData = {};
    state.user = { name: 'Brad', email: 'brad@example.com' };
    window.accessToken = 'tok'; try { accessToken = 'tok'; } catch (e) {}
    window.__appended = []; window.__updates = []; window.__confirms = []; window.__keyWrites = []; window.__batch = [];
    window.sheetsAppend = async (id, range, rows) => { window.__appended.push([range, rows[0]]); return 200 + window.__appended.length; };
    window.sheetsUpdate = async (id, range, rows) => { window.__updates.push([range, rows[0]]); return {}; };
    window.rrVerifiedRowUpdate = async (sid, tab, row, range, vals) => { window.__keyWrites.push([range, vals && vals[0] && vals[0][0]]); return true; };
    window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
    window.driveEnsureSetup = async () => {}; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
    window.appConfirm = async (msg) => { window.__confirms.push(String(msg)); return false; };   // every remove question is read, and answered Cancel
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [ROWS, SETS]);
  return { ctx, pg, errs };
}

// ── D0: the lanes with no catalog row of their own ─────────────────────────
async function laneRun(browser, served) {
  const { ctx, pg, errs } = await open(browser, DESK, served);
  const R = await pg.evaluate(async () => {
    const R = {};
    R.po0 = rrPersonalOnlyRow({ itemNum: '2625', variation: '', era: 'pw', owned: true, inventoryId: 'Q' }).varDesc;
    R.po2 = rrPersonalOnlyRow({ itemNum: '2625', variation: '2', era: 'pw', owned: true, inventoryId: 'Q2' }).varDesc.slice(0, 11);
    state.personalData = { S: { itemNum: '2343-P', variation: '', era: 'pw', manufacturer: 'Lionel', owned: true, inventoryId: 'S', row: 9 } };
    window._poKeys = ['S'];
    showItemDetailPage(-1000, 'S'); await new Promise(r => setTimeout(r, 200));
    const det = document.getElementById('item-detail-content');
    R.suffixPage = det ? det.textContent.replace(/\s+/g, ' ') : '';
    return R;
  });
  await ctx.close();
  return Object.assign(R, { errs });
}

// ── W: the set walk, through the real wizard ───────────────────────────────
async function walkRun(browser, served) {
  const { ctx, pg, errs } = await open(browser, DESK, served);
  const R = await pg.evaluate(async () => {
    const R = { pieces: [] };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const cur = () => wizard.steps[wizard.step] || {};
    await openWizard('collection'); await sleep(150);
    _wizSetKind('set'); await sleep(200);
    wizard.data.set_knowsNum = 'Yes'; await wizardNext(); await sleep(120);
    wizard.data.set_num = '2124W'; await wizardNext(); await sleep(150);
    window._confirmSetMatch('2124W'); await sleep(250);
    const w = document.getElementById('se-worth'); if (w) w.value = '200';
    const fb = document.getElementById('se-full-btn'); if (fb) fb.click(); await sleep(400);
    for (let i = 0; i < 4; i++) {
      const piece = { num: wizard.data.itemNum };
      const vi = wizard.steps.findIndex(s => s.id === 'variation');
      piece.asks = vi >= 0 && !(wizard.steps[vi].skipIf && wizard.steps[vi].skipIf(wizard.data));
      if (piece.asks) {
        wizard.step = vi; renderWizardStep(); await sleep(150);
        const ns = document.getElementById('wiz-var-nospec');
        piece.button = ns ? ns.textContent.trim() : '';
        // the 2nd 2625 is the control: the collector names variation 2
        if (i === 2) { wizardChooseVariation('2'); } else if (ns) ns.click();
        await sleep(400);
      }
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '' });
      try { await saveWizardItem(); } catch (e) { piece.err = e.message; }
      await sleep(350);
      R.pieces.push(piece);
    }
    for (let k = 0; k < 6 && cur().type !== 'confirm'; k++) { if (cur().id === 'set_hasBox') wizard.data.set_hasBox = 'No'; await wizardNext(); await sleep(150); }
    await wizardNext(); await sleep(400);
    R.saved = window.__appended.filter(a => !/My Sets/.test(a[0])).map(a => [cell(a[1], 'itemNum'), cell(a[1], 'variation'), cell(a[1], 'masterKey'), cell(a[1], 'masterRowId'), cell(a[1], 'variationDescription').slice(0, 9)].join('|'));
    return R;
  });
  await ctx.close();
  return Object.assign(R, { errs });
}

// ── D: what the collector sees — the list rows, the item page, the "Copy n of m" chip and its
// picker, Update Info, the remove boxes. `copies` are the copies as they sit in the sheet
// (the link the save made — the row the add held — is kept as it is). One copy: the 2625 row
// draws it (the v0.9.1120 rule). Two "not sure" copies: Brad's 2124W walk saved three.
async function seeRun(browser, viewport, copies, served) {
  const { ctx, pg, errs } = await open(browser, viewport, served);
  const R = await pg.evaluate(async (copies) => {
    const R = { per: [] };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    state.personalData = {};
    copies.forEach((c, i) => { state.personalData[c.inventoryId] = Object.assign({ owned: true, itemType: 'Passenger Car', manufacturer: 'Lionel', condition: '7', row: 5 + i }, c); });
    showPage('browse'); state.filters.owned = true; state.filters.search = ''; state._browseTab = 'items';
    renderBrowse(); await sleep(250);
    const phone = rrIsPhone();
    R.phone = phone;
    // every drawn row / card that opens a 2625 page, with the page it opens
    const opens = [...document.querySelectorAll('[onclick*="showItemDetailPage("]')].filter(e => /2625/.test(e.textContent))
      .filter(e => !e.parentElement || !e.parentElement.closest('[onclick*="showItemDetailPage("]'));
    R.drawn = opens.map(e => {
      const m = /showItemDetailPage\((-?\d+),\s*'([^']*)'/.exec(e.getAttribute('onclick')) || [];
      return { idx: Number(m[1]), inv: m[2] || '', txt: e.textContent.replace(/\s+/g, ' ').slice(0, 200),
        row: (state.masterData[Number(m[1])] || {}).rowId || 'personal-only' };
    });
    if (phone) {
      R.cardNums = opens.map(e => ((e.querySelector('.browse-card-num') || {}).textContent || '').replace(/\s+/g, ' ').trim());
    } else {
      const tr = opens[0];
      const vc = tr ? tr.querySelector('td[data-col="var"]') : null;
      R.varCell = vc ? vc.textContent.trim() : null;
      const num = tr ? tr.querySelector('td[data-col="num"]') : null;
      R.numCell = num ? num.textContent.replace(/\s+/g, ' ').trim() : '';
      // the row's own Remove button (it hands over the CATALOG row's variation)
      const rm = tr ? [...tr.querySelectorAll('button')].find(b => /^Remove$/.test(b.textContent.trim())) : null;
      R.listRemove = !!rm;
      if (rm) { window.__confirms.length = 0; rm.click(); await sleep(150); R.listRemoveQ = window.__confirms.join(' || '); }
    }
    let wrote = null;
    window.rrPersonalSafeWrite = async (pd, newRow) => { wrote = newRow; return true; };
    window._healPdRow = async () => {}; window.rrDetailRepaint = () => {}; window._openOwnedByInvId = () => {};
    for (const d of R.drawn) {
      const o = { inv: d.inv };
      const live = state.personalData[d.inv];
      showItemDetailPage(d.idx, d.inv); await sleep(250);
      const det = document.getElementById('item-detail-content');
      o.page = det ? det.textContent.replace(/\s+/g, ' ') : '';
      const chip = (o.page.match(/Copy \d+ of \d+/) || [''])[0];
      o.chip = chip;
      if (chip) {
        rrShowCopyPicker(d.idx); await sleep(120);
        const pk = document.getElementById('rr-copy-picker');
        o.pickerCopies = pk ? pk.querySelectorAll('[onclick*="rrPickCopy("]').length : 0;
        if (pk) pk.remove();
      } else o.pickerCopies = -1;
      const btn = document.getElementById('detail-remove-item');
      window.__confirms.length = 0;
      if (btn) { btn.click(); await sleep(200); }
      o.pageRemoveQ = window.__confirms.join(' || ');
      // Update Info — the header, every row of the box, and what Save All Changes writes
      wrote = null;
      showItemPanel(d.idx, d.inv, 'edit'); await sleep(150);
      const ov = document.getElementById('item-panel-overlay');
      o.panelHead = ov ? (ov.querySelector('div') || ov).textContent.replace(/\s+/g, ' ').slice(0, 160) : '';
      o.panelAll = ov ? ov.textContent.replace(/\s+/g, ' ') : '';
      const save = ov ? [...ov.querySelectorAll('button')].find(b => /Save All Changes/.test(b.textContent)) : null;
      if (save) { save.click(); await sleep(500); }
      const ov2 = document.getElementById('item-panel-overlay'); if (ov2) ov2.remove();
      o.panelWroteVar = wrote ? String(wrote[PERSONAL_FIELD_INDEX.variation]) : 'no write';
      o.panelWroteKey = wrote ? String(wrote[PERSONAL_FIELD_INDEX.masterKey]) + ' [' + String(wrote[PERSONAL_FIELD_INDEX.masterRowId]) + ']' : 'no write';
      o.liveVar = live ? String(live.variation == null ? '' : live.variation) : 'gone';
      R.per.push(o);
    }
    return R;
  }, copies);
  await ctx.close();
  return Object.assign(R, { errs });
}

// ── S: the three things Brad sends or keeps — the share card PDF, the report builder's
// variation-description column, the For Sale list sheet ─────────────────────
async function sendRun(browser, served) {
  const { ctx, pg, errs } = await open(browser, DESK, served);
  const R = await pg.evaluate(async () => {
    const R = {};
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const V1 = state.masterData.find(m => m.rowId === 'P2625V1XXX'), V2 = state.masterData.find(m => m.rowId === 'P2625V2XXX');
    const mk = (inv, v, key, id) => ({ itemNum: '2625', variation: v, era: 'pw', manufacturer: 'Lionel', owned: true, inventoryId: inv, row: 5,
      masterKey: key, masterRowId: id, condition: '7', hasBox: 'No', itemType: 'Passenger Car' });
    state.personalData = { '601': mk('601', '', 'pw|2625|1', 'P2625V1XXX'), '602': mk('602', '2', 'pw|2625|2', 'P2625V2XXX') };
    // (1) the share card PDF — through the item page's own road (shareSingleItem), every field on
    const texts = [];
    const Fake = function () {
      const self = new Proxy({}, { get(t, k) {
        if (k === 'internal') return { pageSize: { getWidth: () => 612, getHeight: () => 792 }, getNumberOfPages: () => 1 };
        if (k === 'text') return (x) => { texts.push(Array.isArray(x) ? x.join(' ') : String(x)); return self; };
        if (k === 'splitTextToSize') return (x) => String(x).split('\n');
        if (k === 'getTextWidth') return (x) => String(x).length * 5;
        if (k === 'getNumberOfPages') return () => 1;
        if (k === 'output') return () => new Blob(['x']);
        if (k === 'then') return undefined;
        return () => self;
      } });
      return self;
    };
    window.jspdf = { jsPDF: Fake };
    window.openShareBuilder = () => {};
    const card = async (inv) => {
      texts.length = 0;
      const idx = state.masterData.indexOf(inv === '601' ? V1 : V2);
      shareSingleItem(idx, inv);
      const items = Object.values(_shareItems || {});
      try { await _buildPDF(items, { itemnum: true, vardesc: true, cond: true, box: true, price: true, notes: true }, ''); } catch (e) { texts.push('ERR ' + e.message); }
      return texts.join(' | ');
    };
    R.share1 = await card('601');
    R.share2 = await card('602');
    // (2) the report builder's Variation Description cell
    R.rep1 = _rbCellVal('varDesc', state.personalData['601'], V1, {});
    R.rep2 = String(_rbCellVal('varDesc', state.personalData['602'], V2, {})).slice(0, 11);
    // (3) the For Sale list sheet
    let rows = null;
    window._sellEnsureSheet = async () => 'SID'; window.sheetsClear = async () => {}; window.sheetsUpdate = async (id, range, r) => { rows = r; return {}; };
    state.forSaleData = { '601': { itemNum: '2625', variation: '', inventoryId: '601', askingPrice: '50', condition: '7' },
                          '602': { itemNum: '2625', variation: '2', inventoryId: '602', askingPrice: '60', condition: '7' } };
    try { await _sellSync(); } catch (e) { R.sellErr = e.message; }
    const line = inv => ((rows || []).find(r => r[0] === '2625' && String(r[5]).indexOf(inv === '601' ? '50' : '60') >= 0) || []).join(' | ');
    R.sell1 = line('601'); R.sell2 = line('602');
    return R;
  });
  await ctx.close();
  return Object.assign(R, { errs });
}

// ── F: the "Found" line under the number box, and the step it promises ─────
async function foundRun(browser, served) {
  const { ctx, pg, errs } = await open(browser, DESK, served);
  const R = await pg.evaluate(async () => {
    const R = {};
    await openWizard('collection');
    const one = (num) => {
      wizard.tab = 'collection'; wizard.data = { itemNum: num };
      let el = document.getElementById('wiz-match');
      if (!el) { el = document.createElement('div'); el.id = 'wiz-match'; document.body.appendChild(el); }
      el.innerHTML = '';
      lookupItem(num);
      wizard.data.itemNum = (wizard.matchedItem && wizard.matchedItem.itemNum) || num;
      const st = getSteps('collection').find(s => s.id === 'variation');
      const asks = !!st && !(st.skipIf && st.skipIf(wizard.data));
      return { promise: /multiple variations exist/.test(el.textContent), asks, found: /Found/.test(el.textContent) };
    };
    R.c6017 = one('6017-200');
    R.c2625 = one('2625');
    return R;
  });
  await ctx.close();
  return Object.assign(R, { errs });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    // ── W ──
    console.log('== W · the 2124W set walk, "not sure" for the 2625s ==');
    const w = await walkRun(browser);
    const nsPieces = w.pieces.filter(p => p.num === '2625');
    T('W0 the walk asked "Which variation is it?" for each 2625 and offered "No specific variation / not sure"',
      nsPieces.length === 3 && nsPieces.every(p => p.asks && /not sure/.test(p.button)), w.pieces);
    T('W1 four pieces saved: the 2332, and three 2625s', w.saved.length === 4 && w.saved.filter(s => s.startsWith('2625|')).length === 3, w.saved);
    const ns = w.saved.filter(s => s.startsWith('2625||'));
    T('W2 each "not sure" 2625 saves its Variation blank and no variation description', ns.length === 2 && ns.every(s => /\|$/.test(s)), w.saved);
    T('W3 …and keeps the link the walk held, as before this release (the 2625 item row — display-only fix)',
      ns.every(s => s === '2625||pw|2625|1|P2625V1XXX|'), w.saved);
    T('W4 the 2625 named variation 2 links variation 2\'s own row and description', w.saved.indexOf('2625|2|pw|2625|2|P2625V2XXX|VARTWO-DE') >= 0, w.saved);
    T('W5 no page errors', w.errs.length === 0, w.errs);

    // ── D ── the copies as the walk saves them (the held row's link is kept)
    const C = (inv, x) => Object.assign({ itemNum: '2625', variation: '', era: 'pw', inventoryId: inv, masterKey: 'pw|2625|1', masterRowId: 'P2625V1XXX' }, x || {});
    const ONE = [C('502')];
    const TWO = [C('601'), C('602')];
    const dChecks = (tag, d, n) => {
      T(tag + ' exactly ' + n + ' 2625 row(s) drawn, each on the 2625 item row — none on the box row',
        d.drawn.length === n && d.drawn.every(x => x.row === 'P2625V1XXX' && !/Pullman box|Paper|Box \/ Misc/.test(x.txt)), d.drawn);
      T(tag + ' each copy drawn once', new Set(d.drawn.map(x => x.inv)).size === n, d.drawn.map(x => x.inv));
      if (d.phone) T(tag + ' the phone card(s) read "2625" — no "1" beside it', d.cardNums.length === n && d.cardNums.every(c => c === '2625'), d.cardNums);
      else {
        T(tag + ' the row\'s number cell shows no variation', !/\b1\b/.test(d.numCell.replace(/2625/g, '')), d.numCell);
        if (d.varCell !== null) T(tag + ' the Var column reads "—"', d.varCell === '—', d.varCell);
        T(tag + ' the row\'s Remove asks "Remove No. 2625 …" — no "(Var. 1)"', d.listRemove && /Remove No\. 2625\b/.test(d.listRemoveQ) && !/Var\./.test(d.listRemoveQ), d.listRemoveQ);
      }
      d.per.forEach((o, k) => {
        const t = tag + ' copy ' + (k + 1) + ':';
        T(t + ' the item page shows no "Var. 1"', /2625/.test(o.page) && !/Var\. ?1(?!\d)/.test(o.page), o.page.slice(0, 300));
        T(t + ' the item page shows no variation 1 description', !/VARONE-DESC/.test(o.page) && !/Variation Description/.test(o.page), o.page.slice(0, 400));
        if (n > 1) T(t + ' the "Copy n of ' + n + '" chip and its picker agree (' + n + ' copies in both)', /Copy \d of /.test(o.chip) && o.chip.endsWith('of ' + n) && o.pickerCopies === n, [o.chip, o.pickerCopies]);
        else T(t + ' one copy: no "Copy n of m" chip', o.chip === '', o.chip);
        T(t + ' the item page\'s Remove asks with no "(Var. 1)"', /Remove No\. 2625/.test(o.pageRemoveQ) && !/Var\./.test(o.pageRemoveQ), o.pageRemoveQ);
        T(t + ' Update Info\'s header shows no "Var. 1"', /No\. 2625/.test(o.panelHead) && !/Var\. ?1(?!\d)/.test(o.panelHead), o.panelHead);
        T(t + ' nothing in the Update Info box says "Var 1" (its Variation and Catalog entry rows too)', /Catalog entry/.test(o.panelAll) && !/Var\.? ?1(?!\d)/.test(o.panelAll), o.panelAll.slice(0, 600));
        T(t + ' Save All Changes keeps the Variation blank (it wrote "1" before)', o.panelWroteVar === '' && o.liveVar === '', [o.panelWroteVar, o.liveVar]);
        T(t + ' Save All Changes carries the stored link exactly as it was (nothing re-pointed)', o.panelWroteKey === 'pw|2625|1 [P2625V1XXX]', o.panelWroteKey);
      });
      T(tag + ' no page errors', d.errs.length === 0, d.errs);
    };
    for (const [vn, vp] of [['computer', DESK], ['phone', PHONE]]) {
      console.log('\n== D · one "not sure" copy (' + vn + ') ==');
      dChecks('D1 [' + vn + ']', await seeRun(browser, vp, ONE), 1);
      console.log('\n== D · TWO "not sure" copies of one number, with its box row (' + vn + ') ==');
      dChecks('D2 [' + vn + ']', await seeRun(browser, vp, TWO), 2);
    }
    console.log('\n== D0 · the lanes with no catalog row of their own ==');
    const r = await laneRun(browser);
    T('D0 My Collection\'s own row for a "not sure" copy carries no variation description', r.po0 === '', r.po0);
    T('D0 …a copy that names variation 2 carries variation 2\'s', r.po2 === 'VARTWO-DESC', r.po2);
    T('D0 the page of a "not sure" 2343-P (drawn from the 2343 rows) shows no Var 1 description', /2343-P/.test(r.suffixPage) && !/F3ONE-DESC/.test(r.suffixPage), r.suffixPage.slice(0, 300));
    T('D0 no page errors', r.errs.length === 0, r.errs);

    // ── S ──
    console.log('\n== S · the share card, the report builder, the For Sale list sheet ==');
    const sd = await sendRun(browser);
    T('S1 the share card PDF of a "not sure" 2625 prints no "Var. 1" and no Var 1 description', /2625/.test(sd.share1) && !/Var\. ?1(?!\d)/.test(sd.share1) && !/VARONE-DESC/.test(sd.share1) && !/ERR/.test(sd.share1), sd.share1.slice(0, 400));
    T('S1 …a 2625 that names variation 2 still prints "Var. 2" and its description', /Var\. 2/.test(sd.share2) && /VARTWO-DESC/.test(sd.share2) && !/ERR/.test(sd.share2), sd.share2.slice(0, 400));
    T('S2 the report builder\'s Variation Description is blank for the "not sure" 2625', sd.rep1 === '', sd.rep1);
    T('S2 …and variation 2\'s words for the one that names it', sd.rep2 === 'VARTWO-DESC', sd.rep2);
    T('S3 the For Sale list sheet\'s description has no Var 1 words for the "not sure" 2625', /2625/.test(sd.sell1) && !/VARONE-DESC/.test(sd.sell1), sd.sell1 || sd.sellErr);
    T('S3 …and variation 2\'s words for the one that names it', /VARTWO-DESC/.test(sd.sell2), sd.sell2 || sd.sellErr);
    T('S4 no page errors', sd.errs.length === 0, sd.errs);

    // ── F ──
    console.log('\n== F · the "Found" line under the number box ==');
    const f = await foundRun(browser);
    T('F1 6017-200 (one variation): no "select on next step" promise', f.c6017.found && !f.c6017.promise, f.c6017);
    T('F2 6017-200: and no variation step — the promise and the step agree', !f.c6017.asks && f.c6017.promise === f.c6017.asks, f.c6017);
    T('F3 2625 (three variations): the promise shows AND the step asks', f.c2625.promise && f.c2625.asks, f.c2625);
    T('F4 no page errors', f.errs.length === 0, f.errs);

    // ── P: planted offenders ──
    console.log('\n== P · planted offenders ==');
    const AC = rd('app-collection.js'), BR = rd('browse.js'), SUG = rd('wizard-suggestions.js');
    const hasVar1 = t => /Var\.? ?1(?!\d)/.test(t);
    // P1 the item page draws the catalog row as it is
    const p1 = plant(AC, '? rrCopyRowView(item, pd) : item) : {', '? item : item) : {', 'P1');
    const d1 = await seeRun(browser, DESK, ONE, { 'app-collection.js': p1 });
    T('P1 PLANTED the item page without rrCopyRowView → "Var. 1" and the Var 1 description come back', d1.per[0] && hasVar1(d1.per[0].page) && /VARONE-DESC/.test(d1.per[0].page), d1.per[0] && d1.per[0].page.slice(0, 300));
    // P2 the remove box takes the caller's variation
    const p2 = plant(AC, "var _rmVar = thisPd ? String(thisPd.variation == null ? '' : thisPd.variation).trim() : String(variation == null ? '' : variation);",
      "var _rmVar = String(variation == null ? '' : variation);", 'P2');
    const d2 = await seeRun(browser, DESK, ONE, { 'app-collection.js': p2 });
    T('P2 PLANTED the remove box naming the caller\'s variation → the list Remove says "(Var. 1)"', /\(Var\. 1\)/.test(d2.listRemoveQ), d2.listRemoveQ);
    // P3 the four owned-copy panels take the drawn row
    const p3 = plant(AC, "(typeof rrCopyRowView === 'function' ? rrCopyRowView(state.masterData[idx], pd) : state.masterData[idx])", 'state.masterData[idx]', 'P3');
    const d3 = await seeRun(browser, DESK, ONE, { 'app-collection.js': p3 });
    T('P3 PLANTED Update Info on the drawn row → its header says "Var. 1" and Save writes variation 1', d3.per[0] && hasVar1(d3.per[0].panelHead) && d3.per[0].panelWroteVar === '1', d3.per[0] && [d3.per[0].panelHead, d3.per[0].panelWroteVar]);
    // P4 Update Info's "Catalog entry" line names the drawn row's variation
    const p4 = plant(AC, "return (r && !pd._newEntry && typeof rrCopyRowView === 'function') ? rrCopyRowView(r, pd) : r;", 'return r;', 'P4');
    const d4 = await seeRun(browser, DESK, ONE, { 'app-collection.js': p4 });
    T('P4 PLANTED the Catalog entry line without the copy\'s view → it says "Var 1" again', d4.per[0] && /Catalog entry[^]*Var 1(?!\d)/.test(d4.per[0].panelAll), d4.per[0] && d4.per[0].panelAll.slice(0, 400));
    // P5 the copy picker counts the drawn row's variation
    const p5 = plant(AC, "  if (item && _pinned && typeof rrCopyRowView === 'function') item = rrCopyRowView(item, _pinned);\n", '', 'P5');
    const d5 = await seeRun(browser, DESK, TWO, { 'app-collection.js': p5 });
    T('P5 PLANTED the copy picker without the copy\'s view → the chip says 2 copies, the picker shows none', d5.per[0] && /of 2$/.test(d5.per[0].chip) && d5.per[0].pickerCopies !== 2, d5.per[0] && [d5.per[0].chip, d5.per[0].pickerCopies]);
    // P6 the list row shows the catalog row's variation
    const p6 = plant(BR, '? rrCopyRowView(item, pd) : item;', '? item : item;', 'P6');
    const d6 = await seeRun(browser, PHONE, ONE, { 'browse.js': p6 });
    T('P6 PLANTED My Collection without the copy\'s variation → the phone card reads "2625 1"', d6.cardNums[0] === '2625 1', d6.cardNums);
    // P7 the box row keeps a copy: the two releases that free it (Row ID, stored key) cut out
    const p7 = plant(plant(BR, 'if (_p && _p.masterRowId && item.rowId && typeof rrMasterByRowId === \'function\') {', 'if (false) {', 'P7a'),
      "if (_p && _p.masterKey && typeof rrMasterKeyOf === 'function') {", 'if (false) {', 'P7b');
    const d7 = await seeRun(browser, DESK, TWO, { 'browse.js': p7 });
    T('P7 PLANTED the box row keeping a copy → D2\'s "exactly 2 rows, none on the box row" goes red',
      !(d7.drawn.length === 2 && d7.drawn.every(x => x.row === 'P2625V1XXX')), d7.drawn);
    // P8 / P9 the two lanes with no row of their own, without the copy's view
    const p8 = plant(BR, "varDesc: _refItem ? ((typeof rrCopyRowView === 'function') ? rrCopyRowView(_refItem, pd).varDesc : _refItem.varDesc) : '',", "varDesc: _refItem ? _refItem.varDesc : '',", 'P8');
    const r8 = await laneRun(browser, { 'browse.js': p8 });
    T('P8 PLANTED My Collection\'s own row taking the first row\'s words → D0 goes red', /VARONE-DESC/.test(r8.po0), r8.po0);
    const p9 = plant(AC, "varDesc: _baseItem ? ((typeof rrCopyRowView === 'function') ? rrCopyRowView(_baseItem, pd).varDesc : _baseItem.varDesc) : '',", "varDesc: _baseItem ? _baseItem.varDesc : '',", 'P9');
    const r9 = await laneRun(browser, { 'app-collection.js': p9 });
    T('P9 PLANTED the 2343-P page taking its base row\'s words → D0 goes red', /F3ONE-DESC/.test(r9.suffixPage), r9.suffixPage.slice(0, 300));
    // P10 the Found line's old promise
    const p10 = plant(SUG, "((typeof _wizAsksVariation === 'function') ? _wizAsksVariation(match.itemNum) : !!match.variation)", 'match.variation', 'P10');
    const f10 = await foundRun(browser, { 'wizard-suggestions.js': p10 });
    T('P10 PLANTED the old "Found" line → F1 goes red (6017-200 promises a step that never comes)', f10.c6017.promise && !f10.c6017.asks, f10.c6017);
    // P11–P13 the share card, the report builder and the For Sale sheet read the drawn row
    const SH = rd('share.js'), RP = rd('reports.js'), SL = rd('sell.js');
    const p11 = plant(SH, '    if (_ownCopy) master = rrCopyRowView(master, pd) || master;\n', '', 'P11a');
    const p11b = plant(p11, "var varNum  = _ownCopy ? String(pd.variation == null ? '' : pd.variation).trim() : (it.variation || '');", "var varNum  = it.variation || '';", 'P11b');
    const s11 = await sendRun(browser, { 'share.js': p11b });
    T('P11 PLANTED the share card reading the drawn row → it prints "Var. 1" and Var 1\'s description', /Var\. ?1(?!\d)/.test(s11.share1) && /VARONE-DESC/.test(s11.share1), s11.share1.slice(0, 300));
    const p12 = plant(RP, "      var _mv = (pd && pd.itemNum && typeof rrCopyRowView === 'function') ? rrCopyRowView(master, pd) : master;\n", '      var _mv = master;\n', 'P12');
    const s12 = await sendRun(browser, { 'reports.js': p12 });
    T('P12 PLANTED the report builder reading the drawn row → Var 1\'s words in the column', /VARONE-DESC/.test(s12.rep1), s12.rep1);
    const p13 = plant(SL, "var _mv = (typeof rrCopyRowView === 'function') ? rrCopyRowView(m, { itemNum: num, variation: vr }) : m;", 'var _mv = m;', 'P13');
    const s13 = await sendRun(browser, { 'sell.js': p13 });
    T('P13 PLANTED the For Sale sheet reading the drawn row → Var 1\'s words in the description', /VARONE-DESC/.test(s13.sell1), s13.sell1);
  } catch (e) {
    T('crashed', false, String(e && e.stack || e));
  }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  notsure_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
