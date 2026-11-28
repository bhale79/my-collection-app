#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// SCALE + "KEEP IT AS MY OWN ITEM" — scaleunlink, 2026-11-27   (real Chromium,
// the REAL app, a stand-in Sheets)
//
// PLAN_2026-11-27_SCALE_AND_UNLINK.md ([stated] Brad 16:02 CT "Yes" to the plan,
// 16:04 CT "Yes" to building it). Customer Paul Harris: "I overlooked entering the
// scale, i.e., HO. After an entry has been made … it does not seem possible to
// access the Scale field … if upon entry a Catalog item is attached to the record
// inadvertently, how do you disconnect it?"
//
// The world: copy 301 = Lionel 9001 tied to catalog row LIONLIONLI (var 1), with its
// box 302 (9001-BOX, group G1) and a For Sale listing; a hand-entered Athearn boxcar
// (copy 401, no scale) and a hand-entered HO caboose (copy 402); a hand-entered item
// with an old scale word not on today's list (copy 403).
//
// S  the Scale field: only on items not tied to the catalog, the Add screen's list,
//    saves ONLY that column, "not sure" clears it, an old word stays selectable,
//    the item then answers that scale
// K  "None of these — keep it as my own item": offered; picking it writes nothing;
//    the hand-entry fields appear, filled from the old entry, editable; Save writes
//    Era Manual, empties the catalog link + its two descriptions, writes the shown
//    values — and keeps the inventory id, number, condition, price, notes, pictures,
//    group, box, For Sale listing; the app's memory agrees; the copy is no longer
//    matched back to the catalog by its number
// U  picking a real entry after "keep it as my own" puts every field back
// R  a refused save leaves the sheet untouched and the choice still staged
// D  a double tap saves once
// P  planted offenders — each one turns a named check above red
// ═══════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  scale_unlink_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

function plant(file, from, to) {
  const s = fs.readFileSync(path.join(APP, file), 'utf8');
  if (s.split(from).length !== 2) throw new Error('planted ' + file + ': the anchor moved (' + from.slice(0, 60) + '); update this test');
  return { file: file, body: s.replace(from, to) };
}
const PLANTS = {
  // the Scale field shown on every item, catalog ones too
  scaleEverywhere: () => plant('app-collection.js', "type: 'select', when: _ownNow,\n      options: function () {", "type: 'select', when: function () { return true; },\n      options: function () {"),
  // "not sure" carried instead of written (a blank is never carried)
  // the Scale list not the Add screen's
  scaleOwnList: () => plant('app-collection.js', "((typeof RR_MANUAL_GAUGES !== 'undefined') ? RR_MANUAL_GAUGES : []).map(function (g) { return { v: g, t: g }; })", "['O', 'HO'].map(function (g) { return { v: g, t: g }; })"),
  // the link left in place
  keepLink: () => plant('app-collection.js', "if (_toOwn) { pd.era = 'Manual'; pd.masterKey = ''; pd.masterRowId = '';", "if (_toOwn) { pd.era = 'Manual';"),
  // the old catalog wording carried
  // the old entry's words not carried into the Description (a blank, quietly)
  noDescPrefill: () => plant('app-collection.js', "      if (_d) pd.description = _d;\n", ""),
  // picking a real entry no longer puts the fields back
  noUnstage: () => plant('app-collection.js', "            _panelUnstageOwn();   // scaleunlink: a real entry picked — not \"my own item\" any more\n", ""),
  // the choice saved the moment it is picked (no staging)
  saveAtPick: () => plant('app-collection.js', "own.onclick = function () { _panelStageOwn(); editingKey = null; renderFields(null); };",
    "own.onclick = function () { _panelStageOwn(); editingKey = null; renderFields(null); var _sb = Array.from(document.querySelectorAll('#item-panel-overlay button')).find(function (b) { return /Save All Changes/.test(b.textContent); }); if (_sb) _sb.click(); };"),
  // a new inventory id on the way off the catalog
  // the group dropped on the way off the catalog
  dropGroup: () => plant('app-collection.js', "if (_toOwn) { pd.era = 'Manual';", "if (_toOwn) { pd.groupId = ''; pd.era = 'Manual';"),
  // tapping the saved entry stages it as a fresh pick again (review finding 1)
  savedAsPick: () => plant('app-collection.js', "if (isSaved) { delete pd._newEntry; _stagedTyped = ''; }", "if (isCur) { delete pd._newEntry; _stagedTyped = ''; }"),
  // pieces offered the choice (review finding 3)
  pieceChoice: () => plant('app-collection.js', "if (_KO && !_pieceKO.test(String(_base.itemNum || '').trim())) {", "if (_KO) {"),
  // the box not carried along
  boxStays: () => plant('app-collection.js', "if ((_toOwn || pd.era === 'Manual') && typeof rrApplyOwnPieces === 'function') {", "if (false) {"),
  // pieces of a group holding another copy of the number changed anyway
  sharedIgnored: () => plant('app-collection.js', "    if (!pieceRe.test(bare(p.itemNum)) && up(p.itemNum) === num) out.shared = true;\n", ""),
  // a box left behind can never be brought along (only the first save carries pieces)
  noRetry: () => plant('app-collection.js', "if ((_toOwn || pd.era === 'Manual') && typeof rrApplyOwnPieces === 'function') {", "if (_toOwn && typeof rrApplyOwnPieces === 'function') {"),
  // a catalog copy that merely LOOKS unlinked carries its box off the catalog (review 2026-11-27)
  noEraGuard: () => plant('app-collection.js', "  if (String(copy.era || '') !== 'Manual' || bare(copy.masterKey) || bare(copy.masterRowId)) return out;\n", ""),
  // the save guard gone
  doubleTap: () => plant('app-collection.js', "saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;", "saveBtn.textContent = 'Saving…';"),
};

async function boot(browser, planted) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && bare.endsWith('/app/' + planted.file)) return r.fulfill({ body: planted.body, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    const MPC = 'Lionel MPC-Modern';
    const mk = (n, id, v, x) => Object.assign({ itemNum: n, variation: v, itemType: 'Boxcar', description: 'PRR 40-foot boxcar', varDesc: '', _era: 'mpc', _tab: MPC, rowId: id,
      yearProd: '2010', roadName: 'Pennsylvania', manufacturer: 'Lionel', gauge: 'O Gauge', refLink: '' }, x || {});
    state.masterData = [
      mk('9001', 'LIONLIONLI', '1', { varDesc: 'brown body' }),
      mk('9001', 'LION2LION2', '2', { varDesc: 'red body' }),
    ];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; try { accessToken = 'tok'; } catch (e) {}
    const DF = 'https://drive.google.com/drive/folders/';
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row }, x || {});
    state.personalData = {
      a: pd('9001', '301', 3, { era: 'mpc', manufacturer: 'Lionel', variation: '1', groupId: 'G1', masterRowId: 'LIONLIONLI', masterKey: 'mpc|9001|1',
        masterDescription: 'PRR 40-foot boxcar', variationDescription: 'brown body', itemType: 'Boxcar', roadName: 'Pennsylvania',
        condition: '8', priceItem: '45', notes: 'from the Allentown show', photoItem: DF + 'FOLD_A', hasBox: 'Yes', roadNumber: '65432', stockPhotoLink: 'https://example.invalid/stock-9001.jpg' }),
      b: pd('9001-BOX', '302', 4, { era: 'mpc', manufacturer: 'Lionel', groupId: 'G1', itemType: 'Box', boxCond: '7', matchedTo: '9001' }),
      m: pd('AT-1180', '401', 5, { era: 'Manual', manufacturer: 'Athearn', itemType: 'Boxcar', description: 'SP 40ft boxcar', condition: '9', notes: 'blue box' }),
      n: pd('WC-77', '402', 6, { era: 'Manual', manufacturer: 'Walthers', itemType: 'Caboose', description: 'wood caboose', gauge: 'HO', condition: '7' }),
      o: pd('OLD-5', '403', 7, { era: 'Manual', manufacturer: 'Dorfan', itemType: 'Passenger Car', description: 'tinplate coach', gauge: 'Wide Gauge' }),
    };
    state.soldData = {}; state.wantData = {}; state.upgradeData = {}; state.isData = {}; state.partsData = {};
    state.forSaleData = { '301': { row: 3, itemNum: '9001', variation: '1', condition: '8', askingPrice: '60', dateListed: '2026-11-20', notes: '', originalPrice: '45', estWorth: '', inventoryId: '301', manufacturer: 'Lionel' } };
    const T = window.__tabs = { 'My Collection': {}, 'For Sale': {} };
    Object.values(state.personalData).forEach(p => { T['My Collection'][p.row] = rrRecordRow(p); });
    Object.values(state.forSaleData).forEach(f => { T['For Sale'][f.row] = [f.itemNum, f.variation, f.condition, f.askingPrice, f.dateListed, f.notes, f.originalPrice, f.estWorth, f.inventoryId, f.manufacturer]; });
    window.__before = JSON.parse(JSON.stringify(T));
    window.__puts = [];
    const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const parse = r => {
      const m = /^'?(.+?)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/.exec(r);
      return m ? { tab: m[1], c0: colIdx(m[2]), row: Number(m[3]), c1: m[4] ? colIdx(m[4]) : colIdx(m[2]), column: !!(m[4] && !m[5]) } : null;
    };
    window.fetch = async function (url, opts) {
      const u = String(url); const method = (opts && opts.method) || 'GET';
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/:(append|batchGet|batchUpdate|clear)\b/.test(u)) return ok({});
      const m = /\/values\/([^?]+)(\?|$)/.exec(u);
      if (m && method === 'GET') {
        const p = parse(decodeURIComponent(m[1])); if (!p || !T[p.tab]) return ok({ values: [] });
        if (window.__refuseRow && p.tab === 'My Collection' && p.row === window.__refuseRow && !p.column && p.c1 > PERSONAL_FIELD_INDEX.inventoryId) {
          const c = (T[p.tab][p.row] || []).slice(); c[PERSONAL_FIELD_INDEX.inventoryId] = 'ZZZ';
          return ok({ values: [c.slice(p.c0, p.c1 + 1)] });
        }
        if (p.column) {
          const last = Math.max(p.row, ...Object.keys(T[p.tab]).map(Number)); const v = [];
          for (let i = p.row; i <= last; i++) v.push([(T[p.tab][i] || [])[p.c0] == null ? '' : (T[p.tab][i] || [])[p.c0]]);
          return ok({ values: v });
        }
        return ok({ values: [(T[p.tab][p.row] || []).slice(p.c0, p.c1 + 1)] });
      }
      if (m && method === 'PUT') {
        const r = decodeURIComponent(m[1]); const body = JSON.parse(opts.body); const p = parse(r);
        window.__puts.push({ range: r, values: body.values });
        if (p && T[p.tab]) { const cur = T[p.tab][p.row] = T[p.tab][p.row] || []; (body.values[0] || []).forEach((v, k) => { cur[p.c0 + k] = v; }); }
        return ok({ updatedCells: 1 });
      }
      return ok({});
    };
    window.driveRequest = async function () { return {}; };
    window.__toasts = [];
    window.showToast = function (m) { window.__toasts.push(String(m)); };
  });
  return { ctx, pg, errs };
}

// open Update Info on a copy (edit mode) and say which fields it shows
const OPEN = async (pg, key) => pg.evaluate((key) => {
  const p = state.personalData[key];
  const idx = p.era === 'Manual' ? -1 : state.masterData.findIndex(m => m.itemNum === p.itemNum);
  showItemPanel(idx, key, 'edit');
  const ov = document.getElementById('item-panel-overlay');
  return { open: !!ov, labels: Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).map(d => (d.firstChild || {}).textContent || '') };
}, key);
const ROW = (pg, label) => pg.evaluate((label) => {
  const ov = document.getElementById('item-panel-overlay');
  const r = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => ((d.firstChild || {}).textContent || '') === label);
  return r ? r.textContent.replace(/\s+/g, ' ').trim() : null;
}, label);
// open a field's editor; for a select say its choices; optionally choose one and tick ✓
const EDIT = (pg, label, choose) => pg.evaluate(([label, choose]) => {
  const ov = document.getElementById('item-panel-overlay');
  const find = () => Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => ((d.firstChild || {}).textContent || '') === label);
  const r = find(); if (!r) return { found: false };
  const pen = Array.from(r.querySelectorAll('button')).find(b => b.title === 'Edit'); if (!pen) return { found: true, pen: false };
  pen.click();
  const r2 = find(); const sel = r2.querySelector('select');
  const out = { found: true, pen: true, choices: sel ? Array.from(sel.options).map(o => o.value + '|' + o.textContent) : null, selected: sel ? sel.value : null };
  if (choose != null && sel) {
    sel.value = choose;
    Array.from(r2.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Done').click();
  }
  return out;
}, [label, choose]);
const OPEN_ENTRY = (pg) => pg.evaluate(() => {
  const ov = document.getElementById('item-panel-overlay');
  const er = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
  const btn = er && Array.from(er.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent));
  if (btn) btn.click();
  const own = ov.querySelector('[data-rr-keepown]');
  return { field: !!er, own: !!own, ownText: own ? own.textContent.replace(/\s+/g, ' ').trim() : '', cards: Array.from(ov.querySelectorAll('[data-rr-entry]')).map(c => c.getAttribute('data-rr-entry')) };
});
const CLICK_OWN = (pg) => pg.evaluate(() => { const c = document.querySelector('#item-panel-overlay [data-rr-keepown]'); if (c) c.click(); return { clicked: !!c, written: window.__puts.length }; });
const CLICK_ENTRY = (pg, id) => pg.evaluate((id) => { const c = document.querySelector('#item-panel-overlay [data-rr-entry="' + id + '"]'); if (c) c.click(); return !!c; }, id);
const SAVE = (pg, twice) => pg.evaluate(async (twice) => {
  const ov = document.getElementById('item-panel-overlay');
  const save = Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent));
  save.click(); if (twice) save.click();
  for (let i = 0; i < 60 && document.getElementById('item-panel-overlay') && !document.querySelector('#item-panel-overlay button:not([disabled])[class*="btn-primary"]'); i++) await new Promise(r => setTimeout(r, 100));
  for (let i = 0; i < 40 && document.getElementById('item-panel-overlay'); i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 500));
  return { closed: !document.getElementById('item-panel-overlay') };
}, !!twice);
const SHEET = (pg) => pg.evaluate(() => {
  const F = PERSONAL_FIELD_INDEX, T = window.__tabs, B = window.__before, bare = v => String(v == null ? '' : v).replace(/^'/, '');
  const row = (tab, n) => (T[tab][n] || []).map(bare);
  const changed = (tab, n) => { const a = (B[tab][n] || []).map(bare), b = row(tab, n); const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || '') !== (b[i] || '')) out.push(i); return out; };
  const names = {}; Object.keys(F).forEach(k => { names[F[k]] = k; });
  const ch = (tab, n) => changed(tab, n).map(i => names[i] || ('col' + i));
  const get = (n, f) => bare((T['My Collection'][n] || [])[F[f]]);
  return { get3: f => null, F, a: Object.fromEntries(Object.keys(F).map(f => [f, get(3, f)])),
    m: Object.fromEntries(Object.keys(F).map(f => [f, get(5, f)])), n: Object.fromEntries(Object.keys(F).map(f => [f, get(6, f)])),
    chA: ch('My Collection', 3), chB: ch('My Collection', 4), chM: ch('My Collection', 5), chN: ch('My Collection', 6), chO: ch('My Collection', 7),
    chFS: changed('For Sale', 3), puts: window.__puts.map(x => x.range), toasts: window.__toasts.slice() };
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const GAUGES = await (async () => { const { ctx, pg } = await boot(browser, null); const g = await pg.evaluate(() => RR_MANUAL_GAUGES.slice()); await ctx.close(); return g; })();

  console.log('\n== S · the Scale field ==');
  {
    const { ctx, pg, errs } = await boot(browser, null);
    const om = await OPEN(pg, 'm');
    T('S1 a hand-entered item\'s Update Info shows "Scale"', om.labels.indexOf('Scale') >= 0, om.labels);
    const e = await EDIT(pg, 'Scale', 'HO');
    T('S2 its choices are "— not sure —" then the Add screen\'s list (RR_MANUAL_GAUGES), in order',
      e.choices && e.choices[0] === '|— not sure —' && JSON.stringify(e.choices.slice(1).map(c => c.split('|')[0])) === JSON.stringify(GAUGES), e.choices);
    const shown = await ROW(pg, 'Scale');
    T('S3 after ✓ the line says HO and nothing is written yet', /HO/.test(shown || '') && (await pg.evaluate(() => window.__puts.length)) === 0, shown);
    const sv = await SAVE(pg);
    const s = await SHEET(pg);
    T('S4 Save writes HO into the item\'s Scale/Gauge column — and ONLY that column', sv.closed && s.m.gauge === 'HO' && JSON.stringify(s.chM) === JSON.stringify(['gauge']), { m: s.m.gauge, ch: s.chM });
    T('S5 no other row changed', s.chA.length === 0 && s.chB.length === 0 && s.chN.length === 0 && s.chO.length === 0, { a: s.chA, b: s.chB, n: s.chN, o: s.chO });
    const mem = await pg.evaluate(() => { const p = state.personalData.m; const it = { itemNum: p.itemNum, era: p.era, gauge: p.gauge || '', _personalOnly: true };
      return { g: p.gauge, ho: rrChipRowPasses(it, p, { scale: 'ho' }, '', { owned: true, allEra: true }), o: rrChipRowPasses(it, p, { scale: 'o' }, '', { owned: true, allEra: true }) }; });
    T('S6 the app\'s memory says HO, and My Collection\'s Scale filter now lists it under HO (not under O)', mem.g === 'HO' && mem.ho === true && mem.o === false, mem);
    T('S0 the page ran without a script error', errs.length === 0, errs);
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'n');
    const e = await EDIT(pg, 'Scale', '');
    T('S7 an item already set to HO opens with HO chosen', e.selected === 'HO', e);
    await SAVE(pg);
    const s = await SHEET(pg);
    T('S8 "— not sure —" CLEARS the scale (a blank is written, not carried)', s.n.gauge === '' && JSON.stringify(s.chN) === JSON.stringify(['gauge']), { g: s.n.gauge, ch: s.chN });
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'o');
    const e = await EDIT(pg, 'Scale', null);
    T('S9 an older scale word not on today\'s list ("Wide Gauge") stays chosen and selectable', e.selected === 'Wide Gauge' && e.choices.some(c => c === 'Wide Gauge|Wide Gauge'), e);
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser, null);
    const oa = await OPEN(pg, 'a');
    T('S10 a catalog item shows NO Scale field (its scale is its catalog entry\'s)', oa.labels.indexOf('Scale') < 0 && oa.labels.indexOf('Manufacturer') < 0, oa.labels);
    await ctx.close();
  }

  console.log('\n== K · "None of these — keep it as my own item" ==');
  {
    const { ctx, pg, errs } = await boot(browser, null);
    const oa = await OPEN(pg, 'a');
    const oe = await OPEN_ENTRY(pg);
    T('K1 Change catalog entry offers "None of these — keep it as my own item" after the entry cards',
      oe.field && oe.own && /None of these — keep it as my own item/.test(oe.ownText) && oe.cards.indexOf('LIONLIONLI') >= 0, oe);
    const ck = await CLICK_OWN(pg);
    const labels = await pg.evaluate(() => Array.from(document.querySelectorAll('#item-panel-overlay #item-panel-fields-container > div')).map(d => (d.firstChild || {}).textContent || ''));
    T('K2 picking it writes NOTHING (staged until Save)', ck.clicked && ck.written === 0, ck);
    const entryLine = await ROW(pg, 'Catalog entry');
    T('K3 the Catalog entry line now says "Your own item — not tied to the catalog"', /Your own item — not tied to the catalog/.test(entryLine || ''), entryLine);
    const vals = {};
    for (const l of ['Manufacturer', 'Type', 'Road Name', 'Description', 'Scale']) vals[l] = await ROW(pg, l);
    T('K4 the hand-entry fields appear, filled from the old entry: maker Lionel, type Boxcar, road Pennsylvania, its description, scale O',
      /Lionel/.test(vals.Manufacturer || '') && /Boxcar/.test(vals.Type || '') && /PRR 40-foot boxcar — brown body/.test(vals.Description || '') && /^Scale\s*O(?![\w-])/.test(vals.Scale || '') && /Pennsylvania/.test(vals['Road Name'] || ''), vals);
    T('K5 the catalog Variation line steps aside', labels.indexOf('Variation') < 0, labels);
    await EDIT(pg, 'Manufacturer', null);
    await pg.evaluate(() => { const i = document.getElementById('panel-inp-manufacturer'); i.value = 'Athearn'; Array.from(i.parentElement.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Done').click(); });
    await EDIT(pg, 'Scale', 'HO');
    const sv = await SAVE(pg);
    const s = await SHEET(pg);
    T('K6 Save closes the box and says "Saved as your own item"', sv.closed && s.toasts.some(t => /Saved as your own item/.test(t)), { sv, t: s.toasts });
    T('K7 the row: Era Manual; catalog link (Master Key, Master Row ID), both auto-descriptions, the catalog variation and its stock picture EMPTY',
      s.a.era === 'Manual' && s.a.masterKey === '' && s.a.masterRowId === '' && s.a.masterDescription === '' && s.a.variationDescription === ''
      && s.a.variation === '' && s.a.stockPhotoLink === '', s.a);
    T('K8 ...the shown values written: maker Athearn (as edited), type Boxcar, the description, scale HO',
      s.a.manufacturer === 'Athearn' && s.a.itemType === 'Boxcar' && s.a.description === 'PRR 40-foot boxcar — brown body' && s.a.gauge === 'HO', s.a);
    T('K9 ...and everything that is HIS stays: inventory id, number, condition, price, notes, pictures link, group, has-box, road number (and the road name he saw)',
      s.a.inventoryId === '301' && s.a.itemNum === '9001' && s.a.condition === '8' && s.a.priceItem === '45' && s.a.notes === 'from the Allentown show'
      && s.a.photoItem === 'https://drive.google.com/drive/folders/FOLD_A' && s.a.groupId === 'G1' && s.a.hasBox === 'Yes' && s.a.roadNumber === '65432' && s.a.roadName === 'Pennsylvania', s.a);
    const box = await pg.evaluate(() => { const F = PERSONAL_FIELD_INDEX, r = (window.__tabs['My Collection'][4] || []).map(v => String(v == null ? '' : v).replace(/^'/, '')); const o = {}; Object.keys(F).forEach(k => { o[k] = r[F[k]] || ''; }); return o; });
    T('K10 its BOX follows it ([stated] Brad 18:48 CT): hand-entered, the item\'s new maker (Athearn), no catalog link — and keeps its own number, type, condition, group, Matched To, inventory id',
      box.era === 'Manual' && box.manufacturer === 'Athearn' && box.masterKey === '' && box.masterRowId === '' && box.itemNum === '9001-BOX' && box.itemType === 'Box'
      && box.boxCond === '7' && box.groupId === 'G1' && box.matchedTo === '9001' && box.inventoryId === '302', box);
    T('K10b its For Sale listing changes ONLY its variation (to blank, agreeing with the item); no other row changed',
      JSON.stringify(s.chFS) === '[1]' && s.chM.length === 0 && s.chN.length === 0 && s.chO.length === 0, { fs: s.chFS, m: s.chM });
    const bmem = await pg.evaluate(() => ({ era: state.personalData.b.era, mfr: state.personalData.b.manufacturer }));
    T('K10c ...and the app\'s memory of the box agrees', bmem.era === 'Manual' && bmem.mfr === 'Athearn', bmem);
    const mem = await pg.evaluate(() => { const a = state.personalData.a; return { era: a.era, mk: a.masterKey, id: a.masterRowId, staged: '_toOwn' in a, unlinked: rrCopyIsUnlinked(a), inv: a.inventoryId, mfr: a.manufacturer }; });
    T('K11 the app\'s memory agrees (Manual, no link, nothing left staged) and the copy counts as not tied to the catalog',
      mem.era === 'Manual' && !mem.mk && !mem.id && !mem.staged && mem.unlinked === true && mem.inv === '301' && mem.mfr === 'Athearn', mem);
    const re = await OPEN(pg, 'a');
    T('K12 re-opened, it is a hand-entered item: Title / Name, Manufacturer, Type, Scale shown; no Catalog entry line',
      re.labels.indexOf('Title / Name') >= 0 && re.labels.indexOf('Manufacturer') >= 0 && re.labels.indexOf('Scale') >= 0 && re.labels.indexOf('Catalog entry') < 0, re.labels);
    T('K0 the page ran without a script error', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n== U · a real entry picked after "keep it as my own" puts everything back ==');
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await OPEN_ENTRY(pg);
    const okc = await CLICK_ENTRY(pg, 'LION2LION2');
    const st = await pg.evaluate(() => { const p = document.getElementById('item-panel-overlay'); return { labels: Array.from(p.querySelectorAll('#item-panel-fields-container > div')).map(d => (d.firstChild || {}).textContent || '') }; });
    T('U1 the hand-entry fields go away again (Manufacturer, Scale, Description hidden; Variation back)', okc && st.labels.indexOf('Manufacturer') < 0 && st.labels.indexOf('Scale') < 0 && st.labels.indexOf('Description') < 0 && st.labels.indexOf('Variation') >= 0, st);
    await SAVE(pg);
    const s = await SHEET(pg);
    T('U2 Save re-points it to Var 2 the normal way: still tied to the catalog, NO description or scale written from the abandoned choice',
      s.a.masterRowId === 'LION2LION2' && s.a.era === 'mpc' && s.a.description === '' && s.a.gauge === '', s.a);
    await ctx.close();
  }

  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await OPEN_ENTRY(pg);
    const okc = await CLICK_ENTRY(pg, 'LIONLIONLI');
    const line = await ROW(pg, 'Catalog entry');
    await SAVE(pg);
    const s = await SHEET(pg);
    T('U3 changing your mind back to the item\'s OWN entry cancels: still tied to it, road number kept, nothing written',
      okc && /Var 1/.test(line || '') && s.a.masterRowId === 'LIONLIONLI' && s.a.roadNumber === '65432' && s.a.era === 'mpc' && s.chA.filter(c => c !== 'priceComplete').length === 0 && !s.toasts.some(t => /now /.test(t)), { line, a: { id: s.a.masterRowId, rn: s.a.roadNumber }, ch: s.chA, t: s.toasts });
    await ctx.close();
  }

  console.log('\n== R · a refused save ==');
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await pg.evaluate(() => { window.__refuseRow = 3; window.appConfirm = async () => false; window.appAlert = async () => {}; });
    const sv = await SAVE(pg);
    const s = await SHEET(pg);
    const st = await pg.evaluate(() => ({ live: state.personalData.a.era, liveStaged: '_toOwn' in state.personalData.a, line: (Array.from(document.querySelectorAll('#item-panel-overlay #item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent)) || { textContent: '' }).textContent }));
    T('R1 the sheet row is untouched and the app\'s record is still the catalog item', s.chA.length === 0 && st.live === 'mpc' && !st.liveStaged, { ch: s.chA, st });
    T('R2 the box stays open with the choice still staged (Save again will do it)', !sv.closed && /Your own item/.test(st.line), { sv, st });
    await ctx.close();
  }

  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await pg.evaluate(() => { window.__refuseRow = 3; window.appConfirm = async () => false; window.appAlert = async () => {}; });
    await SAVE(pg);
    await pg.evaluate(() => { window.__refuseRow = 0; });
    const sv = await SAVE(pg);
    const s = await SHEET(pg);
    T('R3 after a refusal, Save again DOES it: Manual, link empty, his details kept', sv.closed && s.a.era === 'Manual' && s.a.masterRowId === '' && s.a.inventoryId === '301' && s.a.condition === '8', { sv, a: s.a });
    await ctx.close();
  }

  console.log('\n== B · the box when it cannot follow ==');
  {
    const { ctx, pg } = await boot(browser, null);
    await pg.evaluate(() => {   // a SECOND copy of 9001 in the same group: its pieces cannot be told apart
      const c = { owned: true, itemNum: '9001', variation: '1', inventoryId: '303', row: 8, era: 'mpc', manufacturer: 'Lionel', groupId: 'G1', masterRowId: 'LIONLIONLI', masterKey: 'mpc|9001|1', condition: '6' };
      state.personalData.c = c; window.__tabs['My Collection'][8] = rrRecordRow(c); window.__before['My Collection'][8] = rrRecordRow(c);
    });
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg);
    const s = await SHEET(pg);
    T('B1 a group holding another No. 9001: the item goes off the catalog, the box stays as it is, and the message says why',
      s.a.era === 'Manual' && s.chB.length === 0 && s.toasts.some(t => /holds another No\. 9001/.test(t)), { a: s.a.era, b: s.chB, t: s.toasts });
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await pg.evaluate(() => { window.__refuseRow = 4; window.appConfirm = async () => false; window.appAlert = async () => {}; });   // the BOX's write is refused
    await SAVE(pg);
    const s = await SHEET(pg);
    T('B2 the box\'s write refused: the item is saved, the box untouched, and the message names "its box" and says to save the item again',
      s.a.era === 'Manual' && s.chB.length === 0 && s.toasts.some(t => /still tied to the catalog: its box\. Open the item and save it again/.test(t)), { a: s.a.era, b: s.chB, t: s.toasts });
    await pg.evaluate(() => { window.__refuseRow = 0; window.__toasts = []; });
    await OPEN(pg, 'a');   // now a hand-entered item — as the message says: open it and save it again
    await SAVE(pg);
    const s2 = await SHEET(pg);
    const box = await pg.evaluate(() => { const F = PERSONAL_FIELD_INDEX, r = (window.__tabs['My Collection'][4] || []).map(v => String(v == null ? '' : v).replace(/^'/, '')); return { era: r[F.era], mfr: r[F.manufacturer], rowId: r[F.masterRowId] }; });
    T('B3 ...and saving the item again DOES bring the box along (hand-entered, the item\'s maker)', box.era === 'Manual' && box.mfr === 'Lionel' && !box.rowId && s2.a.era === 'Manual', { box, t: s2.toasts });
    await ctx.close();
  }

  {
    const { ctx, pg } = await boot(browser, null);
    const r = await pg.evaluate(() => {
      const a = state.personalData.a;
      const looksUnlinked = Object.assign({}, a, { masterKey: '', masterRowId: '' });   // a catalog copy the app could not place (era still mpc)
      return { catalogCopy: rrOwnPiecesPlan(a).pieces.length, looksUnlinked: rrOwnPiecesPlan(looksUnlinked).pieces.length,
               handEntered: rrOwnPiecesPlan(Object.assign({}, a, { era: 'Manual', masterKey: '', masterRowId: '' })).pieces.length };
    });
    T('B4 only a REALLY hand-entered item carries its box: a catalog copy, or one that merely looks unlinked (era still a catalog era), never does',
      r.catalogCopy === 0 && r.looksUnlinked === 0 && r.handEntered === 1, r);
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser, null);
    await pg.evaluate(() => { window.rrCopyIsUnlinked = function () { return true; }; });   // the panel takes the catalog copy for "not tied" (catalog not loaded)
    await OPEN(pg, 'a');
    await SAVE(pg);
    const s = await SHEET(pg);
    T('B5 an ordinary save of a catalog copy the panel took for unlinked leaves its box alone', s.chB.length === 0 && s.a.era === 'mpc', { b: s.chB, era: s.a.era });
    await ctx.close();
  }

  console.log('\n== PC · a piece follows its item ==');
  {
    const { ctx, pg } = await boot(browser, null);
    await OPEN(pg, 'b');
    const oe = await OPEN_ENTRY(pg);
    T('PC1 the box\'s Change catalog entry has NO "keep it as my own item" choice (a piece follows its item)', oe.field && !oe.own, oe);
    await ctx.close();
  }

  console.log('\n== D · a double tap saves once ==');
  const writesOf = async (planted, twice) => { const { ctx, pg } = await boot(browser, planted); try { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg, twice); return await pg.evaluate(() => window.__puts.filter(p => /^My Collection!/.test(p.range)).map(p => p.range).join(' ')); } finally { await ctx.close(); } };
  const ONE = await writesOf(null, false);
  {
    const two = await writesOf(null, true);
    T('D1 two taps on Save write exactly what one tap writes (the save runs once)', !!ONE && two === ONE, { one: ONE, two });
  }

  console.log('\n== P · planted offenders ==');
  const run = async (name, fn) => { const pl = PLANTS[name](); const { ctx, pg } = await boot(browser, pl); try { return await fn(pg); } finally { await ctx.close(); } };
  T('P1 a Scale field on catalog items too is caught (S10)', await run('scaleEverywhere', async pg => (await OPEN(pg, 'a')).labels.indexOf('Scale') >= 0));
  T('P2 a Scale list that is not the Add screen\'s is caught (S2)', await run('scaleOwnList', async pg => { await OPEN(pg, 'm'); const e = await EDIT(pg, 'Scale', null); return JSON.stringify(e.choices.slice(1).map(c => c.split('|')[0])) !== JSON.stringify(GAUGES); }));
  T('P3 the catalog link left in place is caught (K7)', await run('keepLink', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg); const s = await SHEET(pg); return s.a.masterRowId !== '' || s.a.masterKey !== ''; }));
  T('P4 the old entry\'s words NOT carried into the Description is caught (K4/K8)', await run('noDescPrefill', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg); return (await SHEET(pg)).a.description !== 'PRR 40-foot boxcar — brown body'; }));
  T('P5 fields NOT put back after a real entry is picked is caught (U2)', await run('noUnstage', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await OPEN_ENTRY(pg); await CLICK_ENTRY(pg, 'LION2LION2'); await SAVE(pg); const s = await SHEET(pg); return s.a.description !== '' || s.a.gauge !== ''; }));
  T('P6 saving the moment it is picked is caught (K2)', await run('saveAtPick', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); const c = await CLICK_OWN(pg); await new Promise(r => setTimeout(r, 1500)); return (await pg.evaluate(() => window.__puts.length)) > 0; }));
  T('P7 the group dropped on the way off the catalog is caught (K9)', await run('dropGroup', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg); return (await SHEET(pg)).a.groupId !== 'G1'; }));
  T('P9 tapping the saved entry re-staged as a pick (wipes the road number) is caught (U3)', await run('savedAsPick', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await OPEN_ENTRY(pg); await CLICK_ENTRY(pg, 'LIONLIONLI'); await SAVE(pg); const s = await SHEET(pg); return s.chA.filter(c => c !== 'priceComplete').length > 0 || s.a.roadNumber !== '65432'; }));
  T('P10 pieces offered "keep it as my own" is caught (PC1)', await run('pieceChoice', async pg => { await OPEN(pg, 'b'); return (await OPEN_ENTRY(pg)).own === true; }));
  T('P11 the box not carried along is caught (K10)', await run('boxStays', async pg => { await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg); return (await SHEET(pg)).chB.length === 0; }));
  T('P12 a shared group\'s pieces changed anyway is caught (B1)', await run('sharedIgnored', async pg => {
    await pg.evaluate(() => { const c = { owned: true, itemNum: '9001', variation: '1', inventoryId: '303', row: 8, era: 'mpc', manufacturer: 'Lionel', groupId: 'G1', masterRowId: 'LIONLIONLI' }; state.personalData.c = c; window.__tabs['My Collection'][8] = rrRecordRow(c); window.__before['My Collection'][8] = rrRecordRow(c); });
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg); await SAVE(pg); return (await SHEET(pg)).chB.length > 0; }));
  T('P13 a left-behind box that a later save cannot bring along is caught (B3)', await run('noRetry', async pg => {
    await OPEN(pg, 'a'); await OPEN_ENTRY(pg); await CLICK_OWN(pg);
    await pg.evaluate(() => { window.__refuseRow = 4; window.appConfirm = async () => false; window.appAlert = async () => {}; });
    await SAVE(pg); await pg.evaluate(() => { window.__refuseRow = 0; }); await OPEN(pg, 'a'); await SAVE(pg);
    return (await SHEET(pg)).chB.length === 0; }));
  T('P14 a catalog copy that merely looks unlinked carrying its box is caught (B4)', await run('noEraGuard', async pg => pg.evaluate(() => rrOwnPiecesPlan(Object.assign({}, state.personalData.a, { masterKey: '', masterRowId: '' })).pieces.length > 0)));
  T('P8 the save guard removed is caught (D1)', (await writesOf(PLANTS.doubleTap(), true)) !== ONE);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL SCALE/UNLINK TESTS GREEN') + '  scale_unlink_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  scale_unlink_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
