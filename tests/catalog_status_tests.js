#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CATALOG STATUS — "Cancelled by MTH — never made" — v0.9.1873
//   (real Chromium, the REAL app; every screen is drawn by its own code)
//
// [stated] Brad, 2026-10-03: "yes but leave them in unless it causes an issue"
// → MTH's own Delivery Status was read off every MTH item page and written to
// the master as a new last column (Master Version 1.95). 774 items say
// Cancelled; 245 of them look exactly like an item MTH DID make under another
// number (20-2975-1, cancelled, vs 20-2251-1, the Union Pacific weed sprayer
// that was made) — a search shows both, and nothing said which never existed.
// → "yes" to a tag on every screen a catalog item is shown.
//
//   A  the ONE rule (rrCatalogStatus): every spelling MTH used, the maker, no tag
//      for anything else
//   B  the column is READ: a real MTH header (Delivery Status at Y; at AD on
//      the G and S tabs) through buildMasterColMap + parseMasterRow
//   C  every screen — the cancelled item wears the tag, its made twin does not:
//      Add (number list, Found line, variation step, variation cards, confirm
//      card), Browse (desktop catalog, phone card, My Collection), item page,
//      "Do you own this item?", View Details, the edit panel, the photo
//      reader's list + confirm card, the photo inbox's choices, the identify
//      chooser, the research card, the want list (phone + desktop), the
//      variation picker
//   D  the tag is readable: its ink against the panel it sits on, dark + light
//   E  the catalog-shape stamp now marks every saved catalog stale (it used to
//      wipe only pre-Session-116 keys — a bump changed nothing a device used)
//   F  source rules — the wording and the test live in one file; no "A1:AD"
//   P  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  catalog_status_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const LABEL = 'Cancelled by MTH — never made';
const CX = '20-2975-1', MX = '20-2251-1';

// Test-only doors into functions that live inside a file's private scope. Each
// is one line inserted at a unique anchor of the file as served; the app's own
// code is otherwise untouched. A missing anchor fails loudly.
function hooks(extra) {
  const H = {
    'research.js': ['function _showCard(res) {', 'window.__t_showCard = function (r) { return _showCard(r); };\n  function _showCard(res) {'],
    'barcode.js': ['function _bcConfirmCard(info) {', 'window.__t_bcConfirm = function (i) { return _bcConfirmCard(i); };\n  function _bcConfirmCard(info) {'],
    'photo-inbox.js': ['var _rvAiRec = null;', 'var _rvAiRec = null; window.__t_setRec = function (r) { _rvAiRec = r; };'],
    'variation-picker.js': ['function _vpCardHtml(id, common) {', 'window.__t_vpCard = function (r) { VP = VP || {}; VP.byId = { x: r }; return _vpCardHtml(\'x\', null); };\n  function _vpCardHtml(id, common) {'],
  };
  const out = {};
  Object.keys(H).forEach(f => {
    let src = (extra && extra[f]) || rd(f);
    if (src.indexOf(H[f][0]) < 0) throw new Error('hook anchor missing in ' + f + ': ' + H[f][0]);
    out[f] = src.replace(H[f][0], H[f][1]);
  });
  Object.keys(extra || {}).forEach(f => { if (!out[f]) out[f] = extra[f]; });
  return out;
}

async function open(browser, planted, viewport) {
  const pg = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const served = hooks(planted);
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(served).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: served[name], contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(([CX, MX]) => {
    localStorage.clear();
    const mk = (n, v, ds, x) => Object.assign({ itemNum: n, variation: v, itemType: 'Maintenance of Way', _era: 'mth_o', _tab: 'MTH O', yearProd: '2008',
      description: 'Weed Sprayer', roadName: 'Union Pacific', deliveryStatus: ds, refLink: 'https://mth.test/' + n }, x || {});
    state.masterData = [
      mk(CX, '', 'Cancelled'),                 // the cancelled one
      mk(MX, '', 'Delivered MAR. 2008'),       // its made twin
      mk('20-9999-1', '1', 'CANCELLED', { description: 'Two-variation test car' }),
      mk('20-9999-1', '2', 'CANCELLED', { description: 'Two-variation test car, red' }),
    ];
    _rebuildMasterIndex();
    state.personalData = {};
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [CX, MX]);
  return { pg, errs };
}
// The tag(s) inside an element: their text, in order.
const TAGS = `(el => el ? [...el.querySelectorAll('.rr-cat-status')].map(t => t.textContent) : null)`;

// ── C: every screen, in one page ──────────────────────────────────────────
async function screens(browser, planted) {
  const R = {};
  const { pg, errs } = await open(browser, planted);
  // C1 — Add: type the number; the list that drops down
  await pg.evaluate(() => openWizard('collection'));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { const i = document.getElementById('wiz-input'); i.value = '20-2'; i.dispatchEvent(new Event('input', { bubbles: true })); updateItemSuggestions('20-2'); });
  await pg.waitForTimeout(300);
  R.sugg = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const rows = [...document.querySelectorAll('#wiz-suggestions [role=button]')];
    const rowOf = n => rows.find(r => r.querySelector('span') && r.querySelector('span').textContent === n);
    return { cx: tags(rowOf(CX)), mx: tags(rowOf(MX)) };
  }, [CX, MX, TAGS]);
  // C2 — Add: the "✓ Found" line under the number box
  R.found = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    lookupItem(CX); const a = tags(document.getElementById('wiz-match'));
    lookupItem(MX); const b = tags(document.getElementById('wiz-match'));
    return { cx: a, mx: b };
  }, [CX, MX, TAGS]);
  // C3 — Add: the details step that describes the item (an MTH item has no
  // variations, so the wizard skips straight to it), and the variation cards
  // of a number that has variations
  R.variation = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const at = (n, id) => {
      wizard.data = {}; wizard.data.itemNum = n; wizard.matchedItem = state.masterData.find(m => m.itemNum === n);
      wizard.step = getSteps(wizard.tab).findIndex(s => s.id === id); renderWizardStep();
      return tags(document.getElementById('wizard-body'));
    };
    return { cx: at(CX, 'conditionDetails'), mx: at(MX, 'conditionDetails'), cards: at('20-9999-1', 'variation') };
  }, [CX, MX, TAGS]);
  // C4 — Add: the confirm card
  R.confirm = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const ci = wizard.steps.findIndex(s => s.type === 'confirm');
    const at = n => { wizard.data.itemNum = n; wizard.data.variation = ''; wizard.matchedItem = state.masterData.find(m => m.itemNum === n); wizard.step = ci; renderWizardStep(); return tags(document.getElementById('wizard-body')); };
    const out = { found: ci >= 0, cx: at(CX), mx: at(MX) };
    try { closeWizard(); } catch (e) { const m = document.getElementById('wizard-modal'); if (m) m.classList.remove('open'); }
    return out;
  }, [CX, MX, TAGS]);
  // C5 — Browse, desktop catalog rows
  R.browse = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    showPage('browse'); state.filters.owned = false; state.filters.search = '20-'; renderBrowse();
    const rows = [...document.querySelectorAll('#browse-tbody tr')];
    const rowOf = n => rows.find(r => (r.querySelector('.item-num') || {}).textContent === n);
    return { rows: rows.length, cx: tags(rowOf(CX)), mx: tags(rowOf(MX)) };
  }, [CX, MX, TAGS]);
  // C6 — the item page
  R.detail = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const at = n => { showItemDetailPage(state.masterData.findIndex(m => m.itemNum === n)); return tags(document.getElementById('item-detail-content')); };
    return { cx: at(CX), mx: at(MX) };
  }, [CX, MX, TAGS]);
  // C7 — "Do you own this item?" and its View Details
  R.prompt = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const ev = { target: document.body, stopPropagation() {}, preventDefault() {} };
    const at = n => {
      browseRowClick(ev, state.masterData.findIndex(m => m.itemNum === n));
      const p = document.getElementById('browse-add-prompt'); const t1 = tags(p);
      const vb = p ? [...p.querySelectorAll('button')].find(b => b.textContent === 'View Details') : null;
      let t2 = null, ds = null;
      if (vb) {
        vb.click();
        const boxes = [...document.querySelectorAll('div')].filter(d => d.style && d.style.maxWidth === '520px' && /Item #/.test(d.textContent));
        const box = boxes[boxes.length - 1];
        t2 = tags(box);
        const dsRow = box ? [...box.children].find(c => c.children.length >= 2 && c.children[0].textContent.trim() === 'Delivery Status') : null;
        ds = dsRow ? dsRow.children[1].textContent : null;
        if (box && box.parentNode) box.parentNode.remove();
      }
      if (p) p.remove();
      return { prompt: t1, details: t2, row: ds ? ds.trim() : ds };
    };
    return { cx: at(CX), mx: at(MX) };
  }, [CX, MX, TAGS]);
  // C8 — the photo reader's "which one is it?" list (always dark) and its confirm card
  R.reader = await pg.evaluate(async ([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const rows = [state.masterData[0], state.masterData[1]];
    window.showCandidatePicker(rows, {});
    await new Promise(r => setTimeout(r, 50));
    const ov = document.getElementById('barcode-candidate-overlay');
    const c0 = ov && ov.querySelector('.bc-cand[data-idx="0"]'), c1 = ov && ov.querySelector('.bc-cand[data-idx="1"]');
    const dark = !!(c0 && c0.querySelector('.rr-cat-status--dark'));
    const out = { cx: tags(c0), mx: tags(c1), dark };
    if (ov) ov.remove();
    const cardOf = async m => {
      const before = new Set(document.body.children);
      window.__t_bcConfirm({ itemNum: m.itemNum, masterItem: m, manufacturer: 'MTH', roadName: m.roadName, description: m.description });
      await new Promise(r => setTimeout(r, 30));
      const added = [...document.body.children].filter(e => !before.has(e));
      const t = added.map(e => tags(e)).flat(); added.forEach(e => e.remove()); return t;
    };
    out.cardCx = await cardOf(state.masterData[0]); out.cardMx = await cardOf(state.masterData[1]);
    return out;
  }, [CX, MX, TAGS]);
  // C9 — the photo inbox's "Could be one of these" choices
  R.inbox = await pg.evaluate(([CX, MX, TAGS]) => {
    window.__t_setRec({ num: CX, alts: [CX, MX] });
    const d = document.createElement('div'); d.innerHTML = window._pinAltChips();
    const ch = [...d.querySelectorAll('.pin-alt')];
    const of = n => { const c = ch.find(x => x.textContent.indexOf(n) >= 0); return c ? [...c.querySelectorAll('.rr-cat-status')].map(t => t.textContent) : null; };
    return { n: ch.length, cx: of(CX), mx: of(MX) };
  }, [CX, MX, TAGS]);
  // C10 — "Pick the matching item" (identify from the photo)
  R.chooser = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const before = new Set(document.body.children);
    try { _identifyShowMasterChooser([{ row: state.masterData[0], score: 9 }, { row: state.masterData[1], score: 8 }], {}, ''); } catch (e) { return 'threw ' + e.message; }
    const added = [...document.body.children].filter(e => !before.has(e));
    const btns = added.map(e => [...e.querySelectorAll('button[data-pick-num]')]).flat();
    const of = n => tags(btns.find(b => b.getAttribute('data-pick-num') === n));
    const out = { cx: of(CX), mx: of(MX) }; added.forEach(e => e.remove()); return out;
  }, [CX, MX, TAGS]);
  // C11 — the price research card
  R.research = await pg.evaluate(async ([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    const at = async m => { window.__t_showCard({ itemNum: m.itemNum, masterItem: m, manufacturer: 'MTH' }); await new Promise(r => setTimeout(r, 30)); const ov = document.getElementById('rs-overlay'); const t = tags(ov); if (ov) ov.remove(); return t; };
    return { cx: await at(state.masterData[0]), mx: await at(state.masterData[1]) };
  }, [CX, MX, TAGS]);
  // C12 — the variation picker's card
  R.vp = await pg.evaluate(([CX, MX]) => {
    const t = h => { const d = document.createElement('div'); d.innerHTML = h; return [...d.querySelectorAll('.rr-cat-status')].map(x => x.textContent); };
    return { cx: t(window.__t_vpCard(state.masterData[0])), mx: t(window.__t_vpCard(state.masterData[1])) };
  }, [CX, MX]);
  // C13 — the want list (desktop table) — both items wanted
  R.wantDesk = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    state.wantData = { a: { itemNum: CX, variation: '', priority: 'High', row: 2 }, b: { itemNum: MX, variation: '', priority: 'Low', row: 3 } };
    showPage('want'); buildUpgradePage();
    const rows = [...document.querySelectorAll('tr')].filter(r => r.textContent.indexOf('20-2') >= 0);
    const of = n => tags(rows.find(r => r.textContent.indexOf(n) >= 0));
    return { cx: of(CX), mx: of(MX) };
  }, [CX, MX, TAGS]);
  // C14 — My Collection (an owned copy of each) + the edit panel
  R.owned = await pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    state.personalData = {
      k1: { owned: true, itemNum: CX, variation: '', inventoryId: '901', row: 2, manufacturer: 'MTH', era: 'mth_o', condition: '8' },
      k2: { owned: true, itemNum: MX, variation: '', inventoryId: '902', row: 3, manufacturer: 'MTH', era: 'mth_o', condition: '8' },
    };
    showPage('browse'); state.filters.owned = true; renderBrowse();
    const rows = [...document.querySelectorAll('#browse-tbody tr')];
    const of = n => tags(rows.find(r => r.textContent.indexOf(n) >= 0));
    const out = { cx: of(CX), mx: of(MX) };
    const panelOf = (n, k) => {
      const before = new Set(document.body.children);
      try { showItemPanel(state.masterData.findIndex(m => m.itemNum === n), k, 'view'); } catch (e) { return 'threw ' + e.message; }
      const added = [...document.body.children].filter(e => !before.has(e));
      const t = added.map(e => tags(e)).flat(); added.forEach(e => e.remove()); return t;
    };
    out.panelCx = panelOf(CX, 'k1'); out.panelMx = panelOf(MX, 'k2');
    state.filters.owned = false;
    return out;
  }, [CX, MX, TAGS]);
  R.errs = errs.filter(e => !/Failed to fetch|NetworkError|net::/.test(e));
  await pg.close();

  // C15 — a phone: the Browse card and the want list's card
  const ph = await open(browser, planted, { width: 390, height: 844 });
  R.phone = await ph.pg.evaluate(([CX, MX, TAGS]) => {
    const tags = eval(TAGS);
    showPage('browse'); state.filters.owned = false; state.filters.search = '20-'; renderBrowse();
    const cards = [...document.querySelectorAll('.browse-card')];
    const of = n => tags(cards.find(c => (c.querySelector('.browse-card-num') || {}).textContent === n));
    const out = { cards: cards.length, cx: of(CX), mx: of(MX) };
    state.wantData = { a: { itemNum: CX, variation: '', priority: 'High', row: 2 }, b: { itemNum: MX, variation: '', priority: 'Low', row: 3 } };
    showPage('want'); buildUpgradePage();
    const wc = [...document.querySelectorAll('#upgrade-cards > *, [id$="-cards"] > *')].filter(c => c.textContent.indexOf('20-2') >= 0);
    out.wantCx = tags(wc.find(c => c.textContent.indexOf(CX) >= 0)); out.wantMx = tags(wc.find(c => c.textContent.indexOf(MX) >= 0));
    return out;
  }, [CX, MX, TAGS]);
  await ph.pg.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: the one rule ────────────────────────────────────────────────────
  {
    const { pg } = await open(browser);
    const a = await pg.evaluate(() => {
      const r = (ds, x) => rrCatalogStatus(Object.assign({ deliveryStatus: ds, _era: 'mth_o', _tab: 'MTH O' }, x || {}));
      const k = (ds, x) => { const s = r(ds, x); return s ? s.key : null; };
      return {
        spellings: ['Cancelled', 'CANCELLED', 'cancelled', 'Canceleld', '  Cancelled  '].map(s => k(s)),
        others: ['Delivered MAR. 2021', 'OCT 2026', 'JUL. 2016', '', 'Not cancelled', 'Delivered'].map(s => k(s)),
        label: r('Cancelled').label,
        tip: r('Cancelled').tip,
        byTab: (_currentEra = 'all', r('Cancelled', { _era: '', _tab: 'MTH HO' }).label),
        noMaker: r('Cancelled', { _era: '', _tab: 'Somebody Else' }).label,
        none: [rrCatalogStatus(null), rrCatalogStatus({}), rrCatalogStatusChip({ deliveryStatus: 'Delivered MAR. 2008' })],
        chip: rrCatalogStatusChip({ deliveryStatus: 'Cancelled', _era: 'mth_o' }),
        block: rrCatalogStatusChip({ deliveryStatus: 'Cancelled', _era: 'mth_o' }, { block: true }).indexOf('rr-cat-status-line') > 0,
        dark: rrCatalogStatusChip({ deliveryStatus: 'Cancelled', _era: 'mth_o' }, { onDark: true }).indexOf('rr-cat-status--dark') > 0,
        extra: CATALOG_DISPLAY.extraFields.some(f => f.key === 'deliveryStatus' && f.label === 'Delivery Status'),
      };
    });
    T('A1 every spelling MTH used means cancelled (Cancelled / CANCELLED / cancelled / its typo "Canceleld")', a.spellings, ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']);
    T('A2 a delivery date, an expected month, a blank — no tag; "Not cancelled" is not read as cancelled', a.others, [null, null, null, null, null, null]);
    T('A3 the words are the ones Brad approved, with the maker from the row\'s catalog', a.label, LABEL);
    T('A4 the hover line says what it means in plain words', a.tip, 'MTH announced this item, then cancelled it — it was never produced.');
    T('A5 a row with no era of its own takes the maker from its tab ("MTH HO")', a.byTab, LABEL);
    T('A6 no known maker → the plain wording, never "by undefined"', a.noMaker, 'Cancelled — never made');
    T('A7 nothing / an empty row / a delivered row → no status, no tag', a.none, [null, null, '']);
    T('A8 the tag: one class, its key and its hover line, the words escaped', a.chip,
      '<span class="rr-cat-status" data-cat-status="cancelled" title="MTH announced this item, then cancelled it — it was never produced.">' + LABEL + '</span>');
    T('A9 the block form and the always-dark form', [a.block, a.dark], [true, true]);
    T('A10 View Details lists MTH\'s own word as "Delivery Status" (CATALOG_DISPLAY.extraFields)', a.extra, true);
    await pg.close();
  }

  // ── B: the column is read ────────────────────────────────────────────────
  {
    const { pg } = await open(browser);
    const b = await pg.evaluate(() => {
      const O = ['Item Number','Item Type','Sub-Type','Unit','Powered/Dummy','Control','Road Name','Description','Gauge','Year Produced','Variation','Variation Description','Reference Link','Notes','Market Value','Source','COTT Code','Original Description','Category','Track Power','MSRP','UPC / Barcode','Stamped Markings','Parts Lists','Delivery Status'];
      const G = O.slice(0, 18).concat(['', '', '', 'x1', 'x2', 'x3', 'x4', 'x5', 'UPC / Barcode', 'Stamped Markings', 'Parts Lists', 'Delivery Status']);
      const row = (h, ds) => { const r = h.map(() => ''); r[0] = '20-2975-1'; r[6] = 'Union Pacific'; r[7] = 'Weed Sprayer'; r[h.indexOf('Delivery Status')] = ds; return r; };
      const pO = parseMasterRow(row(O, 'Cancelled'), 'MTH O', buildMasterColMap(O));
      const pG = parseMasterRow(row(G, 'Delivered MAR. 2008'), 'MTH G Scale', buildMasterColMap(G));
      return { oIdx: O.indexOf('Delivery Status'), gIdx: G.indexOf('Delivery Status'), o: pO.deliveryStatus, g: pG.deliveryStatus, desc: pO.description,
               width: MASTER_READ_LAST_COL, cache: CATALOG_CACHE_VER };
    });
    T('B1 on the O / HO / Tinplate tabs the column is Y (25th) and is read by its header', [b.oIdx, b.o, b.desc], [24, 'Cancelled', 'Weed Sprayer']);
    T('B2 on the G and S tabs it is AD (30th) and is read too', [b.gIdx, b.g], [29, 'Delivered MAR. 2008']);
    // AD is column 30; the read must reach past it so the NEXT column is not dropped
    const colNum = s => s.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
    T('B3 the app reads past AD — the next column added to the G / S tabs will arrive', colNum(b.width) > 30, true);
    T('B4 the catalog-shape stamp moved (saved catalogs predate the column)', b.cache !== '127', true);
    await pg.close();
  }

  // ── C: every screen ──────────────────────────────────────────────────────
  const R = await screens(browser);
  const ONE = [LABEL];
  T('C1 Add: the number list — the cancelled item is tagged, its made twin is not', R.sugg, { cx: ONE, mx: [] });
  T('C2 Add: the "Found" line under the number box', R.found, { cx: ONE, mx: [] });
  T('C3 Add: the details step that describes the item, and BOTH variation cards of a cancelled number', R.variation, { cx: ONE, mx: [], cards: [LABEL, LABEL] });
  T('C4 Add: the confirm card before saving', R.confirm, { found: true, cx: ONE, mx: [] });
  T('C5 Browse (desktop catalog rows)', [R.browse.rows >= 2, R.browse.cx, R.browse.mx], [true, ONE, []]);
  T('C6 the item page', R.detail, { cx: ONE, mx: [] });
  T('C7 "Do you own this item?", then View Details (tag + MTH\'s own word on the Delivery Status row)', R.prompt,
    { cx: { prompt: ONE, details: ONE, row: 'Cancelled' }, mx: { prompt: [], details: [], row: 'Delivered MAR. 2008' } });
  T('C8 the photo reader: its "which one is it?" list (the always-dark tag) and its "use this?" card', R.reader,
    { cx: ONE, mx: [], dark: true, cardCx: ONE, cardMx: [] });
  T('C9 the photo inbox: "Could be one of these" choices', R.inbox, { n: 2, cx: ONE, mx: [] });
  T('C10 identify from the photo: "Pick the matching item"', R.chooser, { cx: ONE, mx: [] });
  T('C11 the price research card', R.research, { cx: ONE, mx: [] });
  T('C12 the variation picker\'s card', R.vp, { cx: ONE, mx: [] });
  T('C13 the want list (desktop)', R.wantDesk, { cx: ONE, mx: [] });
  T('C14 My Collection (desktop) and the edit panel, for an owned copy', R.owned, { cx: ONE, mx: [], panelCx: ONE, panelMx: [] });
  T('C15 a phone: the Browse card and the want list card', R.phone, { cards: R.phone.cards, cx: ONE, mx: [], wantCx: ONE, wantMx: [] });
  T('C16 no page errors on any of those screens', R.errs, []);

  // ── D: readable on the panel it sits on ──────────────────────────────────
  // Measured where it really sits: the cream content area (Browse rows) and the
  // navy chrome (the Add wizard, the edit panel, the research card), on the
  // standard theme and the light theme — the ink the tag actually computes to,
  // against the first painted background behind it.
  {
    const out = {};
    for (const theme of ['dark', 'light']) {
      const { pg } = await open(browser);
      out[theme] = await pg.evaluate(async ([theme, CX]) => {
        document.documentElement.setAttribute('data-theme', theme);
        const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return getComputedStyle(document.body).backgroundColor; };
        const hex = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
        const measure = tag => { if (!tag) return null; const ink = hex(getComputedStyle(tag).color), bg = hex(bgOf(tag)); return { ink, bg, ratio: Math.round(rrContrast(ink, bg) * 100) / 100 }; };
        const r = {};
        showPage('browse'); state.filters.owned = false; state.filters.search = '20-'; renderBrowse();
        r.browse = measure(document.querySelector('#browse-tbody .rr-cat-status'));
        await openWizard('collection');
        wizard.data = { itemNum: CX }; wizard.matchedItem = state.masterData[0];
        wizard.step = getSteps(wizard.tab).findIndex(x => x.id === 'conditionDetails'); renderWizardStep();
        r.wizard = measure(document.querySelector('#wizard-body .rr-cat-status'));
        try { closeWizard(); } catch (e) {}
        window.__t_showCard({ itemNum: CX, masterItem: state.masterData[0], manufacturer: 'MTH' });
        await new Promise(res => setTimeout(res, 30));
        r.research = measure(document.querySelector('#rs-overlay .rr-cat-status'));
        const ov = document.getElementById('rs-overlay'); if (ov) ov.remove();
        r.min = (typeof RR_READABLE_MIN === 'number' ? RR_READABLE_MIN : 4.5);
        return r;
      }, [theme, CX]);
      await pg.close();
    }
    const okAll = o => !!o && ['browse', 'wizard', 'research'].every(k => o[k] && o[k].ratio >= o.min);
    T('D1 the tag reads on the standard theme — cream rows, the Add wizard, the research card (contrast ≥ the app\'s readable minimum)', okAll(out.dark), true);
    T('D2 … and on the light theme', okAll(out.light), true);
    console.log('      measured: ' + JSON.stringify(out));
  }

  // ── E: the catalog-shape stamp marks every saved catalog stale ───────────
  {
    const { pg } = await open(browser);
    const e = await pg.evaluate(() => {
      const ids = REAL_ERA_IDS;
      ids.forEach(i => localStorage.setItem('lv_master_cache_ts_' + i, '12345'));
      localStorage.setItem('lv_cache_ver', '127');
      localStorage.setItem('lv_master_cache', 'legacy');
      const first = _rrCatalogShapeCheck();
      const allZero = ids.every(i => localStorage.getItem('lv_master_cache_ts_' + i) === '0');
      const stamp = localStorage.getItem('lv_cache_ver'), legacy = localStorage.getItem('lv_master_cache');
      ids.forEach(i => localStorage.setItem('lv_master_cache_ts_' + i, '777'));
      const second = _rrCatalogShapeCheck();
      const untouched = ids.every(i => localStorage.getItem('lv_master_cache_ts_' + i) === '777');
      // the Master Version still marks them through the same door
      localStorage.setItem('lv_master_ver_seen', '1.94');
      const mv = _rrMasterVersionCheck('1.95');
      const mvZero = ids.every(i => localStorage.getItem('lv_master_cache_ts_' + i) === '0');
      return { first, allZero, stamp: stamp === CATALOG_CACHE_VER, legacy, second, untouched, mv, mvZero, seen: localStorage.getItem('lv_master_ver_seen') };
    });
    T('E1 a new catalog shape marks EVERY maker\'s saved catalog out of date (rows kept, stamps cleared)', [e.first, e.allZero, e.stamp, e.legacy], [true, true, true, null]);
    T('E2 the same shape on the next start changes nothing — no re-download every start', [e.second, e.untouched], [false, true]);
    T('E3 a new Master Version still marks them, through the same one door', [e.mv, e.mvZero, e.seen], [true, true, '1.95']);
    const src = rd('app.js');
    const i = src.indexOf('async function loadAllErasMode()'), j = src.indexOf('_rrCatalogsToRefresh(realEras', i);
    const k = src.indexOf('_rrCatalogShapeCheck()', i);
    T('E4 the all-makers loader runs the shape check BEFORE it decides what to refresh', i > 0 && k > i && k < j, true);
    await pg.close();
  }

  // ── F: source rules ──────────────────────────────────────────────────────
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
  const noComments = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const wordingOutside = (srcOf) => files.filter(f => f !== 'catalog-display-config.js' && /never made/i.test(noComments(srcOf(f))));
  const ruleOutside = (srcOf) => files.filter(f => f !== 'catalog-display-config.js' && /deliveryStatus[^\n]{0,80}cancel|cancel[^\n]{0,80}deliveryStatus/i.test(noComments(srcOf(f))));
  const adOutside = (srcOf) => files.filter(f => /!A1:AD\b|A1:AD['"`]/.test(noComments(srcOf(f))));
  T('F1 the words "never made" live in catalog-display-config.js only', wordingOutside(rd), []);
  T('F2 no screen decides "cancelled" from the field itself — they all ask rrCatalogStatus', ruleOutside(rd), []);
  T('F3 no master read types its own last column ("A1:AD") — MASTER_READ_LAST_COL', adOutside(rd), []);
  T('F4 the tag\'s look is defined once, in app.css', (rd('app.css').match(/^\.rr-cat-status\s*\{/gm) || []).length, 1);

  // ── P: planted offenders ─────────────────────────────────────────────────
  {
    const planted = f => (rd2 => g => g === f[0] ? f[1] : rd2(g))(rd);
    T('P1 a second copy of the wording in browse.js is caught', wordingOutside(planted(['browse.js', rd('browse.js') + "\nvar x = 'Cancelled by MTH — never made';"])), ['browse.js']);
    T('P2 a screen testing the field itself is caught', ruleOutside(planted(['app-pages.js', rd('app-pages.js') + "\nif (/cancel/i.test(m.deliveryStatus)) {}"])), ['app-pages.js']);
    T('P3 a typed "A1:AD" range is caught', adOutside(planted(['yardmaster.js', rd('yardmaster.js') + "\nvar r = \"'Marx O'!A1:AD\";"])), ['yardmaster.js']);

    // P4: the tag builder silenced → the screen checks go red
    const silenced = rd('catalog-display-config.js').replace('var st = rrCatalogStatus(row);', 'var st = null;');
    const R4 = await screens(browser, { 'catalog-display-config.js': silenced });
    T('P4 with the tag builder silenced, the screens show no tag (the C checks would fail)', [R4.sugg.cx, R4.detail.cx, R4.browse.cx, R4.reader.cx], [[], [], [], []]);

    // P5: the number list without the copied field → its check goes red (the copy is load-bearing)
    const noCopy = rd('wizard-suggestions.js').replace("deliveryStatus: m.deliveryStatus || '',", '');
    const R5 = await screens(browser, { 'wizard-suggestions.js': noCopy });
    T('P5 the number list drops the tag when its row copy leaves out deliveryStatus', R5.sugg.cx, []);

    // P6: the old shape check (legacy keys only) leaves every maker's catalog "fresh"
    const { pg } = await open(browser, { 'app-data.js': rd('app-data.js').replace("_rrMarkCatalogsStale('catalog shape '", "(function(){ return true; })('catalog shape '") });
    const p6 = await pg.evaluate(() => { REAL_ERA_IDS.forEach(i => localStorage.setItem('lv_master_cache_ts_' + i, '12345')); localStorage.setItem('lv_cache_ver', '127'); _rrCatalogShapeCheck(); return REAL_ERA_IDS.every(i => localStorage.getItem('lv_master_cache_ts_' + i) === '0'); });
    T('P6 the old stamp rule (wipe legacy keys only) leaves the saved catalogs "fresh" — E1 would fail', p6, false);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('FAILED'); process.exit(1); }
  console.log('ALL CATALOG STATUS TESTS GREEN (' + pass + ')');
  process.exit(0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
