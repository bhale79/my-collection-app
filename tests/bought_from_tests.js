#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// BOUGHT FROM — one box, three places (boughtfrom, 2026-11-13)
// [stated] Brad 20:12 CT "Yes". A collector entering N scale cars by hand:
// the manual Purchase & Value step had no Bought From, and Update Info had
// none for ANY item, so it could never be added afterwards.
// Real Chromium, the REAL app.
//
//   A  the catalog Purchase & Value step: the box is there and is, character
//      for character, the box the step drew before this change
//   B  the manual Purchase & Value step: the box is there, after Price Paid
//      and before Storage Location; every other line is as it was; a pick
//      lands on the entry; the session's last seller comes back chosen
//   C  a manual entry SAVES its seller (the row the save writes)
//   D  Update Info: a Bought From line on a catalog item AND a manual one;
//      the pencil opens the same list; a pick shows the person, and Save
//      writes the Contact ID; "not tracked" clears it; a seller the contact
//      list does not hold is kept; "Add someone new…" opens the contact form
//      and the new person comes back chosen; a contact list that arrives
//      late fills the open box; a seller brought in by Import shows as its
//      own words; "Add someone new…" can never be saved as a seller
//   G  THE GUARD: every purchase field in RR_BOUGHT_FROM.money is offered by
//      all three places — so one of them can never fall behind again
//   P  PLANTED offenders — each must turn its check red
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  bought_from_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const TYPES = { js: 'application/javascript', css: 'text/css', html: 'text/html' };
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}
function plant(src, from, to, what) {
  if (src.indexOf(from) < 0) { console.log('FAIL  PLANT could not be made (' + what + ') — the line it changes is gone'); fail++; return null; }
  return src.replace(from, to);
}

const CONTACTS = [
  { id: 'C-2', name: 'Walker, Dean', business: 'Hilltop Hobbies' },
  { id: 'C-1', name: 'Graham, Nathan', business: '' },
];

async function open(browser, planted, opts) {
  const pg = await browser.newPage({ viewport: (opts && opts.view) || { width: 1100, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];                       // the stamp is stripped, or every plant passes vacuously
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: TYPES[name.split('.').pop()] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof showItemPanel === 'function' && typeof renderWizardStep === 'function' && typeof window.rrBoughtFromWire === 'function' && typeof window._ctLabel === 'function', null, { timeout: 30000 });   // review: the app, not a fixed wait
  await pg.waitForTimeout(150);
  await pg.evaluate((contacts) => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    state.masterData = [
      { itemNum: '6464-1', variation: '', itemType: 'Boxcar', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Boxcar', roadName: 'Western Pacific' },
    ];
    _rebuildMasterIndex();
    state.personalData = {
      '101': { itemNum: '6464-1', variation: '', owned: true, status: 'Owned', inventoryId: '101', row: 5, era: 'pw', condition: '7' },
      '102': { itemNum: 'N-BOX-1', variation: '', owned: true, status: 'Owned', inventoryId: '102', row: 6, era: 'Manual', manufacturer: 'Atlas', itemType: 'Boxcar', description: 'N scale 40ft boxcar', gauge: 'N' },
      '103': { itemNum: '6464-1', variation: '', owned: true, status: 'Owned', inventoryId: '103', row: 7, era: 'pw', purchasedFrom: 'C-2' },
      '104': { itemNum: '6464-1', variation: '', owned: true, status: 'Owned', inventoryId: '104', row: 8, era: 'pw', purchasedFrom: 'C-GONE' },
      '105': { itemNum: '6464-1', variation: '', owned: true, status: 'Owned', inventoryId: '105', row: 9, era: 'pw', purchasedFrom: 'eBay' },
      '106': { itemNum: '6464-1', variation: '', owned: true, status: 'Owned', inventoryId: '106', row: 10, era: 'pw', purchasedFrom: 'C-1700000000009' },
    };
    state.contactsData = contacts;
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {}; state.mySetsData = {};
    state.personalSheetId = 'SHEET';
    window.appConfirm = async () => true;
    window.buildDashboard = () => {};
    window._toasts = [];
    window.showToast = function (m) { window._toasts.push(String(m)); };
    window._ctLoadContacts = async function () { window._loads = (window._loads || 0) + 1; return state.contactsData; };
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, (opts && opts.contacts) || CONTACTS);
  return { pg, errs };
}

// ── the two Add steps ──────────────────────────────────────────────────────
// What a step offers: which wizard.data fields its boxes write, in order, and
// the words above each box.
const STEP = `(() => {
  const body = document.getElementById('wizard-body');
  const fields = [];
  body.querySelectorAll('input,select,textarea').forEach(el => {
    const h = (el.getAttribute('oninput') || '') + ' ' + (el.getAttribute('onchange') || '');
    const m = /wizard\\.data\\.([A-Za-z_]+)\\s*=/.exec(h);
    if (m) fields.push(m[1]);
    else if (el.id === 'pv-seller' && /_pvSellerPick\\(this\\)/.test(h)) fields.push('purchasedFrom');
  });
  const sel = document.getElementById('pv-seller');
  return {
    fields,
    labels: Array.from(body.querySelectorAll('label')).map(l => (l.childNodes[0] && l.childNodes[0].textContent || '').trim()),
    box: sel ? sel.parentElement.outerHTML : '',
    opts: sel ? Array.from(sel.options).map(o => o.value) : [],
    chosen: sel ? sel.value : null,
    data: wizard.data.purchasedFrom || '',
  };
})()`;

async function catalogStep(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const i = await pg.evaluate(() => {
    _buildWizardModal();
    const steps = getSteps('collection');
    const i = steps.findIndex(s => s.type === 'purchaseValue');
    wizard = { step: i, tab: 'collection', steps: steps, matchedItem: state.masterData[0],
      data: { tab: 'collection', itemNum: '6464-1', variation: '', condition: 7, hasBox: 'No' } };
    document.getElementById('wizard-modal').classList.add('open');
    renderWizardStep();
    return i;
  });
  const r = Object.assign({ i }, await pg.evaluate(STEP));
  r.errs = errs; await pg.close(); return r;
}

async function manualStep(browser, planted, opts) {
  const { pg, errs } = await open(browser, planted, opts);
  const i = await pg.evaluate(async (a) => {
    if (a.last) sessionStorage.setItem('lv_last_seller', a.last);
    if (a.late) { state.contactsData = []; window._ctLoadContacts = async function () { state.contactsData = a.late; return a.late; }; }
    _prefLocEnabled = true;
    _buildWizardModal();
    wizard = { step: 0, tab: 'collection', steps: [], data: { tab: 'collection', itemCategory: 'manual', manualGauge: 'N', manualDesc: 'N scale 40ft boxcar' } };
    wizard.steps = getSteps('collection');
    const i = wizard.steps.findIndex(s => s.type === 'manualPurchaseValue');
    wizard.step = i;
    document.getElementById('wizard-modal').classList.add('open');
    renderWizardStep();
    await new Promise(r => setTimeout(r, 60));
    return i;
  }, { last: opts && opts.last, late: opts && opts.late });
  const first = await pg.evaluate(STEP);
  const more = await pg.evaluate((a) => {
    const sel = document.getElementById('pv-seller');
    let picked = '', after = '';
    if (sel && !a.last && !a.late) {
      sel.value = 'C-1'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      picked = wizard.data.purchasedFrom || '';
      // going away and coming back: the pick is still chosen
      renderWizardStep();
      after = (document.getElementById('pv-seller') || {}).value || '';
    }
    return { picked, after };
  }, { last: opts && opts.last, late: opts && opts.late });
  const r = Object.assign({ i }, more, first);
  r.errs = errs; await pg.close(); return r;
}

// ── C: a manual entry's save ───────────────────────────────────────────────
async function manualSave(browser) {
  const { pg, errs } = await open(browser);
  const r = await pg.evaluate(async () => {
    const rows = [];
    window.sheetsAppend = async function (id, range, vals) { rows.push(vals[0]); return 99; };
    window._cachePersonalData = function () {};
    wizard = { step: 0, tab: 'collection', steps: [], data: {
      tab: 'collection', itemCategory: 'manual', _manualEntry: true, manualManufacturer: 'Atlas', manualGauge: 'N',
      manualItemNum: 'N-501', manualItemType: 'Boxcar', manualDesc: 'N scale 40ft boxcar', manualCondition: 8,
      manualHasBox: 'No', userEstWorth: '25', priceItem: '18', datePurchased: '2026-11-01', purchasedFrom: 'C-1' } };
    let threw = '';
    try { await _saveManualEntry(); } catch (e) { threw = String(e && e.message || e); }
    const row = rows[0] || [];
    const rec = Object.values(state.personalData).find(p => p && p.itemNum === 'N-501') || {};
    return { n: rows.length, cell: row[PERSONAL_FIELD_INDEX.purchasedFrom], rec: rec.purchasedFrom || '', threw: rows.length ? '' : threw };
  });
  r.errs = errs; await pg.close(); return r;
}

// ── D: Update Info ─────────────────────────────────────────────────────────
// Opens Update Info on a copy, finds the Bought From line, and reports it.
const LINE = `(() => {
  const rows = Array.from(document.querySelectorAll('#item-panel-overlay div')).filter(d => d.children.length === 2 && d.firstElementChild && d.firstElementChild.textContent === RR_BOUGHT_FROM.label);
  const row = rows[0];
  if (!row) return { there: false };
  const sel = row.querySelector('select');
  return { there: true, shown: sel ? '' : (row.children[1].querySelector('span') || {}).textContent || '',
    opts: sel ? Array.from(sel.options).map(o => o.value) : [], words: sel ? Array.from(sel.options).map(o => o.textContent) : [], value: sel ? sel.value : null };
})()`;
const pencil = `(() => {
  const row = Array.from(document.querySelectorAll('#item-panel-overlay div')).find(d => d.children.length === 2 && d.firstElementChild && d.firstElementChild.textContent === RR_BOUGHT_FROM.label);
  const b = row && Array.from(row.querySelectorAll('button')).find(x => x.title === 'Edit'); if (b) b.click(); return !!b;
})()`;
const tick = `(() => { const b = document.querySelector('#item-panel-overlay button[aria-label="Done"]'); if (b) b.click(); return !!b; })()`;

async function panel(browser, planted, key, act, opts) {
  const { pg, errs } = await open(browser, planted, opts);
  const R = {};
  await pg.evaluate((a) => {
    window._writes = [];
    window._healPdRow = async function () {};
    window._cachePersonalData = function () {};
    window.rrPersonalSafeWrite = async function (pd, newRow, base, o) { window._writes.push(newRow.slice()); if (o && o.out) o.out.row = newRow; return true; };
    if (a.late) { state.contactsData = []; window._ctLoadContacts = function () { return new Promise(res => { window._arrive = function () { state.contactsData = a.late; res(a.late); }; }); }; }
    const idx = state.masterData.findIndex(m => m.itemNum === state.personalData[a.key].itemNum);
    showItemPanel(idx, a.key, 'edit');
  }, { key, late: opts && opts.late });
  await pg.waitForTimeout(150);
  R.line = await pg.evaluate(LINE);
  if (act === 'look') { R.errs = errs; await pg.close(); return R; }
  R.pencil = await pg.evaluate(pencil);
  await pg.waitForTimeout(80);
  R.box = await pg.evaluate(LINE);
  if (act === 'late') {
    await pg.evaluate(() => window._arrive());
    await pg.waitForTimeout(120);
    R.filled = await pg.evaluate(LINE);
    R.errs = errs; await pg.close(); return R;
  }
  if (act === 'new') {
    // "Add someone new…" — the contact form opens; saving it hands the new id back
    R.asked = await pg.evaluate(() => {
      window._opened = 0;
      window._ctOpenEdit = function () { window._opened++; };
      const sel = document.querySelector('#item-panel-overlay select');
      sel.value = PV_SELLER_NEW; sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { opened: window._opened, boxNow: sel.value };
    });
    R.came = await pg.evaluate(() => {
      state.contactsData = state.contactsData.concat([{ id: 'C-9', name: 'Ortiz, Sam', business: '' }]);
      const cb = window._ctAfterSave; window._ctAfterSave = null; if (cb) cb('C-9');
      const sel = document.querySelector('#item-panel-overlay select');
      return { value: sel.value, has: Array.from(sel.options).some(o => o.value === 'C-9'), last: sel.options[sel.options.length - 1].value };
    });
  } else if (act !== 'keep') {
    await pg.evaluate((v) => { const sel = document.querySelector('#item-panel-overlay select'); sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }, act);
  }
  R.tick = await pg.evaluate(tick);
  await pg.waitForTimeout(80);
  R.after = await pg.evaluate(LINE);
  R.saved = await pg.evaluate(async (key) => {
    const b = Array.from(document.querySelectorAll('#item-panel-overlay button')).find(x => /Save All Changes/.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    const w = window._writes[0];
    return { n: window._writes.length, cell: w ? w[PERSONAL_FIELD_INDEX.purchasedFrom] : null, rec: state.personalData[key].purchasedFrom || '', open: !!document.getElementById('item-panel-overlay') };
  }, key);
  R.errs = errs; await pg.close(); return R;
}

// ── G: which purchase fields Update Info can edit ──────────────────────────
async function panelKeys(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const keys = await pg.evaluate(async () => {
    showItemPanel(0, '101', 'edit');
    await new Promise(r => setTimeout(r, 120));
    const out = [];
    const n = Array.from(document.querySelectorAll('#item-panel-overlay button')).filter(x => x.title === 'Edit').length;
    for (let i = 0; i < n; i++) {
      const b = Array.from(document.querySelectorAll('#item-panel-overlay button')).filter(x => x.title === 'Edit')[i];
      if (!b) break;
      b.click();
      const inp = document.querySelector('#item-panel-overlay [id^="panel-inp-"]');
      if (inp) out.push(inp.id.replace('panel-inp-', ''));
      const c = document.querySelector('#item-panel-overlay button[aria-label="Cancel"]'); if (c) c.click();
    }
    return out;
  });
  await pg.close(); return { keys, errs };
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const WZ = rd('wizard.js'), AC = rd('app-collection.js');
    const MONEY = eval('(' + /money:\s*(\[[^\]]*\])/.exec(rd('config.js'))[1] + ')');
    const ALL = ['', 'C-2', 'C-1', '__rr_new_contact__'];   // the contact list's own order (contacts.js _ctSortKey)

    // ── A ────────────────────────────────────────────────────────────────
    const A = await catalogStep(browser);
    T('A1 the catalog step has the Bought From box', [A.i >= 0, A.opts], [true, ALL]);
    // the box as the catalog step drew it BEFORE this change (v0.9.2147, the
    // release this was built on) — kept here word for word
    const BEFORE = '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Bought From (optional)</div>'
      + '<select id="pv-seller" onchange="window._pvSellerPick(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">'
      + '<option value="">— Not tracked —</option><option value="C-2">Walker, Dean — Hilltop Hobbies</option><option value="C-1">Graham, Nathan</option><option value="__rr_new_contact__">＋ Add someone new…</option></select></div>';
    T('A2 …and it is the SAME box as before, character for character', A.box.replace(' tabindex="0"', ''), BEFORE);   // (a11y.js adds the tab stop once it is on the page)
    T('A3 the catalog step offers every purchase field', MONEY.filter(k => A.fields.indexOf(k) < 0), []);
    T('no page errors (A)', A.errs, []);

    // ── B ────────────────────────────────────────────────────────────────
    const B = await manualStep(browser);
    T('B1 the manual step has the Bought From box, the same list', [B.i >= 0, B.opts], [true, ALL]);
    T('B2 it sits after Price Paid and before Storage Location; every other line is as it was',
      B.labels, ['Est. Worth', 'Date Purchased', 'Price Paid', 'Bought From (optional)', 'Storage Location']);
    T('B3 a pick lands on the entry, and is still chosen when the step is drawn again', [B.picked, B.after], ['C-1', 'C-1']);
    T('B4 nothing is chosen for you on a first entry', [B.chosen, B.data], ['', '']);
    const B5 = await manualStep(browser, null, { last: 'C-2' });
    T('B5 the seller picked last this session comes back chosen (ten cars from one shop = one tap)', [B5.chosen, B5.data], ['C-2', 'C-2']);
    const B6 = await manualStep(browser, null, { late: CONTACTS });
    T('B6 a contact list not read yet is read, and fills the box in place', B6.opts, ALL);
    T('no page errors (B)', B.errs.concat(B5.errs, B6.errs), []);

    // ── C ────────────────────────────────────────────────────────────────
    const C = await manualSave(browser);
    T('C1 a manual entry saves its seller: on the row written, and on the record', [C.n, C.cell, C.rec, C.threw], [1, 'C-1', 'C-1', '']);

    // ── D ────────────────────────────────────────────────────────────────
    const D1 = await panel(browser, null, '101', 'C-1');
    T('D1 Update Info on a catalog item has a Bought From line, empty', [D1.line.there, D1.line.shown], [true, '—']);
    T('D2 the pencil opens the same list', [D1.pencil, D1.box.opts], [true, ALL]);
    T('D3 a pick shows the PERSON on the line, not the code', [D1.tick, D1.after.shown], [true, 'Graham, Nathan']);
    T('D4 Save All Changes writes the Contact ID, and the record holds it', D1.saved, { n: 1, cell: 'C-1', rec: 'C-1', open: false });
    const D5 = await panel(browser, null, '102', 'C-2');
    T('D5 the same on a MANUAL entry', [D5.line.there, D5.after.shown, D5.saved.cell, D5.saved.rec], [true, 'Walker, Dean — Hilltop Hobbies', 'C-2', 'C-2']);
    const D6 = await panel(browser, null, '103', '');
    T('D6 a saved seller shows by name; "not tracked" clears it', [D6.line.shown, D6.box.value, D6.after.shown, D6.saved.cell, D6.saved.rec], ['Walker, Dean — Hilltop Hobbies', 'C-2', '—', '', '']);
    const D7 = await panel(browser, null, '104', 'keep');
    T('D7 a seller the contact list does not hold keeps its own line: open the box, press the tick — nothing is lost',
      [D7.box.opts, D7.box.value, D7.saved.rec, D7.saved.n ? D7.saved.cell : 'no write'], [['', 'C-GONE', 'C-2', 'C-1', '__rr_new_contact__'], 'C-GONE', 'C-GONE', 'C-GONE']);
    const D8 = await panel(browser, null, '101', 'new');
    T('D8 "Add someone new…" opens the contact form, and the box never holds that choice', D8.asked, { opened: 1, boxNow: '' });
    T('D9 the new person comes back chosen, with "Add someone new…" still last; Save writes them', [D8.came, D8.saved.cell], [{ value: 'C-9', has: true, last: '__rr_new_contact__' }, 'C-9']);
    const D10 = await panel(browser, null, '103', 'late', { late: CONTACTS });
    T('D10 a contact list that arrives late fills the open box, the saved seller still chosen', [D10.box.opts, D10.filled.opts, D10.filled.value], [['', 'C-2', '__rr_new_contact__'], ALL, 'C-2']);
    const D11 = await panel(browser, null, '105', 'keep');
    T('D11 a seller brought in by Import (words, not a contact) shows as those words, and is kept', [D11.line.shown, D11.box.words[1], D11.saved.rec], ['eBay', 'eBay', 'eBay']);
    const D12 = await panel(browser, null, '106', 'look');
    T('D12 a real Contact ID the list does not hold reads "a saved contact", never the code', D12.line.shown, 'a saved contact');
    T('no page errors (D)', [].concat(D1.errs, D5.errs, D6.errs, D7.errs, D8.errs, D10.errs, D11.errs, D12.errs), []);

    // ── G — the guard ─────────────────────────────────────────────────────
    const G = await panelKeys(browser);
    T('G1 the purchase fields are the four the app has', MONEY, ['userEstWorth', 'priceItem', 'purchasedFrom', 'datePurchased']);
    T('G2 the manual step offers every one of them', MONEY.filter(k => B.fields.indexOf(k) < 0), []);
    T('G3 Update Info can edit every one of them', MONEY.filter(k => G.keys.indexOf(k) < 0), []);

    // ── P — planted offenders ─────────────────────────────────────────────
    const noManual = plant(WZ, "        window.rrBoughtFromStepHtml(d, 'manual') +\n", "", 'the manual step without the box');
    if (noManual) { const P1 = await manualStep(browser, { 'wizard.js': noManual }); T('P1 a manual step without the box is caught (B1 and the guard G2 red)', [P1.opts.length, MONEY.filter(k => P1.fields.indexOf(k) < 0)], [0, ['purchasedFrom']]); }
    const noLine = plant(AC, "    ...((typeof window.rrBoughtFromChoices === 'function' && typeof RR_BOUGHT_FROM !== 'undefined') ? [{", "    ...(false ? [{", 'Update Info without the line');
    if (noLine) {
      const P2 = await panel(browser, { 'app-collection.js': noLine }, '101', 'look'); const P2k = await panelKeys(browser, { 'app-collection.js': noLine });
      T('P2 Update Info without the line is caught (D1 and the guard G3 red)', [P2.line.there, MONEY.filter(k => P2k.keys.indexOf(k) < 0)], [false, ['purchasedFrom']]);
    }
    const noKeep = plant(WZ, "  if (cur && !list.some(function (o) { return o.v === cur; })) {", "  if (false) {", 'no line for a seller the list does not hold');
    if (noKeep) { const P3 = await panel(browser, { 'wizard.js': noKeep }, '104', 'keep'); T('P3 a seller silently blanked by opening the box is caught (D7 red: the write goes out with the seller gone)', [P3.box.opts.indexOf('C-GONE'), P3.saved.n, P3.saved.cell, P3.saved.rec], [-1, 1, '', '']); }
    const noWire = plant(AC, "        if (typeof f.wire === 'function') f.wire(inp);", "", 'the box not wired');
    if (noWire) { const P4 = await panel(browser, { 'app-collection.js': noWire }, '101', 'new'); T('P4 a box that is not wired is caught (D8 red: the contact form never opens, the box is left on that choice)', P4.asked, { opened: 0, boxNow: '__rr_new_contact__' });
      T('P4b …and even then the second lock keeps it out of the sheet', [P4.saved.cell === '__rr_new_contact__', P4.saved.rec === '__rr_new_contact__'], [false, false]); }
    const code = plant(AC, "          f.val = (typeof f.words === 'function') ? f.words(inp.value)", "          f.val = (false) ? f.words(inp.value)", 'the code on the line');
    if (code) { const P5 = await panel(browser, { 'app-collection.js': code }, '101', 'C-1'); T('P5 the contact CODE shown on the line is caught (D3 red)', P5.after.shown, 'C-1'); }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  bought_from_tests threw: ' + (e && e.stack || e)); process.exit(1); });
