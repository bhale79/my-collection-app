#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// ITEM NUMBER CHANGE — itemnumfix, 2026-11-12   (real Chromium, the REAL app,
// a stand-in Sheets and a stand-in Drive)
//
// PLAN_2026-11-12_CHANGE_ITEM_NUMBER.md ([stated] Brad 10:52 CT "yes", 10:56 CT
// "yes and we need to emergency ship it"). Mike Caruso's Burlington SD80MAC
// ("9654") was saved as Lionel 38586 — Lionel's Norfolk Southern 7209,
// non-powered. The Description line is the catalog's, so the only way out was
// delete + re-add, losing his pictures and box. Update Info → Change catalog
// entry → "Wrong item number? Type the right one" now moves the copy.
//
// The world (Mike's exact case): copy 106 = 38586 with its box 107 (38586-BOX,
// group G1), a For Sale listing, an Upgrade entry, an instruction sheet of the
// group, a part FOR this copy, and its pictures in Photos › 38586 › 106. Beside
// it, a SECOND 38586 (copy 201) with its own box (202, group G2), listing, sheet
// and part — every one of those must stay exactly as it is.
//
// A  the move, at phone AND laptop sizes: the door, the cards, the words before
//    Save, then every row the sheet gets and every row it must NOT get, the
//    pictures' folder (moved, same ID) and the photo names, the app's memory,
//    the number index, the lookups
// B  a number the catalog does not have: "No catalog entry carries …", no card
// C  a piece (the box) has no door — it follows its item
// D  a double tap saves once
// E  already own a 38725: the words say so; nothing merges
// F  Cancel after a pick: nothing written
// G  a copy whose photo cell is blank keeps its pictures (its folder is found
//    under the OLD number first)
// P  planted offenders — each one turns a check above red
// ═════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  itemnum_change_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

// ── planted offenders: each replaces ONE line of the real code ───────────────
function plant(file, from, to) {
  const s = fs.readFileSync(path.join(APP, file), 'utf8');
  if (s.split(from).length !== 2) throw new Error('planted ' + file + ': the anchor moved (' + from.slice(0, 60) + '); update this test');
  return { file: file, body: s.replace(from, to) };
}
const PLANTS = {
  noPieces: () => plant('app-data.js', "      if (up(stem) !== up(from)) return;\n", "      return;\n"),
  newInv: () => plant('app-collection.js', '          pd.itemNum = _move.to;\n', '          pd.itemNum = _move.to; pd.inventoryId = \'NEW-\' + pd.inventoryId;\n'),
  saleLeft: () => plant('app-data.js', 'out.forSale = inv;', 'out.forSale = null;'),
  doubleTap: () => plant('app-collection.js', "saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;", "saveBtn.textContent = 'Saving…';"),
  fakeEntry: () => plant('app-collection.js', "const list = (typeof rrCatalogCandidates === 'function') ? rrCatalogCandidates(_numDoorTyped) : [];",
    "const list = (typeof rrCatalogCandidates === 'function') ? rrCatalogCandidates(_numDoorTyped) : []; if (!list.length) list.push({ itemNum: _numDoorTyped, rowId: 'FAKEFAKE00', _era: 'mpc' });"),
  merge: () => plant('app-data.js', "    var p = pd[k];\n    if (!p || !p.owned || isSelf(k, p) || !gid",
    "    var p = pd[k];\n    if (p && p.owned && !isSelf(k, p) && up(p.itemNum) === up(from)) { out.pieces.push({ key: k, from: bare(p.itemNum), to: to, shared: 0 }); return; }\n    if (!p || !p.owned || isSelf(k, p) || !gid"),
  ownList: () => plant('app-data.js', 'if (own.some(function (r) { return r === entry || (eid && bare(r && r.rowId) === eid); })) return out;', ''),
  dropStaged: () => plant('app-collection.js', "          pd.itemNum = _move.to;\n        }\n", "          pd.itemNum = _move.to;\n        }\n        delete pd._newEntry;\n"),
  sharedGroup: () => plant('app-data.js', "|| !gid || bare(p.groupId) !== gid || out.sharedGroup) return;", "|| !gid || bare(p.groupId) !== gid) return;"),
  noFolder: () => plant('app-collection.js', "  if (link && typeof rrRefileCopyFolder === 'function') {\n    try { await rrRefileCopyFolder(link, from, to,",
    "  if (false) {\n    try { await rrRefileCopyFolder(link, from, to,"),
};

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1400, height: 900 } },
};

async function boot(browser, size, planted) {
  const ctx = await browser.newContext(SIZES[size || 'laptop']);
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
    const mk = (n, id, road, desc, ctl, x) => Object.assign({ itemNum: n, variation: '', itemType: 'Diesel Locomotive', description: desc, _era: 'mpc', _tab: MPC, rowId: id,
      yearProd: '2012', roadName: road, control: ctl, manufacturer: 'Lionel', refLink: 'https://www.lionel.com/products/' + n + '/' }, x || {});
    state.masterData = [
      mk('38586', 'NSNSNSNSNS', 'Norfolk Southern', 'NS SD80MAC Diesel "7209," nonpowered', 'Traditional'),
      mk('38725', 'BU25BU25BU', 'Chicago, Burlington & Quincy', 'CB&Q SD80MAC Diesel "9654," CC', 'Command Control'),
      mk('38727', 'BU27BU27BU', 'Chicago, Burlington & Quincy', 'CB&Q SD80MAC Diesel "9660," nonpowered', 'Traditional'),
    ];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; try { accessToken = 'tok'; } catch (e) {}
    const DF = 'https://drive.google.com/drive/folders/';
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', era: 'mpc', manufacturer: 'Lionel', inventoryId: inv, row: row }, x || {});
    state.personalData = {
      a: pd('38586', '106', 3, { groupId: 'G1', masterRowId: 'NSNSNSNSNS', condition: '9', priceItem: '250', notes: 'from York', tmccId: '106', photoItem: DF + 'FOLD_A', hasBox: 'Yes' }),
      b: pd('38586-BOX', '107', 4, { groupId: 'G1', itemType: 'Box', boxCond: '8', photoBox: DF + 'FOLD_B', matchedTo: '38586' }),
      t: pd('6-82000', '108', 7, { groupId: 'G1', itemType: 'Tender', matchedTo: '38586' }),
      c: pd('38586', '201', 5, { groupId: 'G2', masterRowId: 'NSNSNSNSNS', condition: '6', photoItem: DF + 'FOLD_C' }),
      d: pd('38586-BOX', '202', 6, { groupId: 'G2', itemType: 'Box' }),
    };
    state.soldData = {}; state.wantData = {};
    state.forSaleData = {
      '106': { row: 3, itemNum: '38586', variation: '', condition: '9', askingPrice: '400', dateListed: '2026-11-01', notes: '', originalPrice: '250', estWorth: '', inventoryId: '106', manufacturer: 'Lionel' },
      '201': { row: 4, itemNum: '38586', variation: '', condition: '6', askingPrice: '300', dateListed: '2026-11-01', notes: '', originalPrice: '', estWorth: '', inventoryId: '201', manufacturer: 'Lionel' },
    };
    state.upgradeData = { '106': { row: 3, itemNum: '38586', variation: '', listType: 'Upgrade', priority: 'High', maxPrice: '500', targetCondition: '9', inventoryId: '106', notes: '', manufacturer: 'Lionel' } };
    state.isData = {
      s1: { _key: 's1', row: 3, sheetNum: '38586-IS', linkedItem: '38586', groupId: 'G1', inventoryId: '' },
      s2: { _key: 's2', row: 4, sheetNum: '38586-IS', linkedItem: '38586', groupId: 'G2', inventoryId: '' },
    };
    state.partsData = {
      p3: { row: 3, id: 'part-1', description: 'truck', forItem: '38586', forInv: '106', status: 'wanted' },
      p4: { row: 4, id: 'part-2', description: 'coupler', forItem: '38586', forInv: '201', status: 'wanted' },
    };
    // ── the stand-in Sheets: every tab's rows as the SHEET holds them ──
    const T = window.__tabs = { 'My Collection': {}, 'For Sale': {}, 'Want-Upgrade List': {}, 'Instruction Sheets': {}, 'Parts Needed': {} };
    Object.values(state.personalData).forEach(p => { T['My Collection'][p.row] = rrRecordRow(p); });
    Object.values(state.forSaleData).forEach(f => { T['For Sale'][f.row] = [f.itemNum, f.variation, f.condition, f.askingPrice, f.dateListed, f.notes, f.originalPrice, f.estWorth, f.inventoryId, f.manufacturer]; });
    Object.values(state.upgradeData).forEach(u => { T['Want-Upgrade List'][u.row] = [u.itemNum, u.variation, 'Upgrade', u.priority, u.maxPrice, u.targetCondition, u.inventoryId, u.notes, u.manufacturer]; });
    Object.values(state.isData).forEach(s => { T['Instruction Sheets'][s.row] = [s.sheetNum, s.linkedItem, '', '', '', '', '', s.groupId]; });
    Object.values(state.partsData).forEach(p => { T['Parts Needed'][p.row] = [p.id, p.description, '', p.forItem, p.forInv]; });
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
        // the safe save's whole-row re-read finds another item on the row (refused —
        // "the row no longer holds this item"); the find-by-id read before it still passes
        if (window.__refuseRow && p.tab === 'My Collection' && p.row === window.__refuseRow && !p.column && p.c1 > PERSONAL_FIELD_INDEX.inventoryId) {
          const c = (T[p.tab][p.row] || []).slice(); c[PERSONAL_FIELD_INDEX.inventoryId] = 'ZZZ';
          return ok({ values: [c.slice(p.c0, p.c1 + 1)] });
        }
        if (p.column) {   // a column read (find by id): every row from p.row down
          const last = Math.max(p.row, ...Object.keys(T[p.tab]).map(Number)); const v = [];
          for (let i = p.row; i <= last; i++) v.push([(T[p.tab][i] || [])[p.c0] == null ? '' : (T[p.tab][i] || [])[p.c0]]);
          return ok({ values: v });
        }
        const cells = (T[p.tab][p.row] || []).slice(p.c0, p.c1 + 1);
        return ok({ values: [cells] });
      }
      if (m && method === 'PUT') {
        const r = decodeURIComponent(m[1]); const body = JSON.parse(opts.body); const p = parse(r);
        window.__puts.push({ range: r, values: body.values });
        if (p && T[p.tab]) { const cur = T[p.tab][p.row] = T[p.tab][p.row] || []; (body.values[0] || []).forEach((v, k) => { cur[p.c0 + k] = v; }); }
        return ok({ updatedCells: 1 });
      }
      return ok({});
    };
    // ── the stand-in Drive: Photos › 38586 › 106 (and the box's, and copy 201's) ──
    const D = window.__drive = {
      NUM_38586: { id: 'NUM_38586', name: '38586', parents: ['ROOT'] },
      'NUM_38586-BOX': { id: 'NUM_38586-BOX', name: '38586-BOX', parents: ['ROOT'] },
      FOLD_A: { id: 'FOLD_A', name: '106', parents: ['NUM_38586'] },
      FOLD_B: { id: 'FOLD_B', name: '107', parents: ['NUM_38586-BOX'] },
      FOLD_C: { id: 'FOLD_C', name: '201', parents: ['NUM_38586'] },
      f1: { id: 'f1', name: 'LIONEL 38586 ID106 RSV.jpg', parents: ['FOLD_A'] },
      f2: { id: 'f2', name: '01· LIONEL 38586 ID106 FV.jpg', parents: ['FOLD_A'] },
      f3: { id: 'f3', name: 'notes 38586 list.jpg', parents: ['FOLD_A'] },
      g1: { id: 'g1', name: 'LIONEL 38586-BOX ID107 BOX FV.jpg', parents: ['FOLD_B'] },
      h1: { id: 'h1', name: 'LIONEL 38586 ID201 RSV.jpg', parents: ['FOLD_C'] },
    };
    window.__driveCalls = [];
    window.driveRequest = async function (method, p, body) {
      window.__driveCalls.push(method + ' ' + p + (body && body.name ? ' name=' + body.name : ''));
      const idm = /^\/files\/([^?/]+)/.exec(p);
      if (method === 'GET' && idm) { const f = D[idm[1]]; return f ? JSON.parse(JSON.stringify(f)) : null; }
      if (method === 'GET' && /^\/files\?q=/.test(p)) {
        const q = decodeURIComponent(p.slice(p.indexOf('q=') + 2).split('&')[0]);
        const par = (/'([^']+)' in parents/.exec(q) || [])[1]; const nm = (/name='([^']+)'/.exec(q) || [])[1];
        return { files: Object.values(D).filter(f => f.parents.indexOf(par) >= 0 && (!nm || f.name === nm)).map(f => ({ id: f.id, name: f.name })) };
      }
      if (method === 'PATCH' && idm) {
        const f = D[idm[1]]; if (!f) return null;
        const add = (/addParents=([^&]+)/.exec(p) || [])[1], rm = (/removeParents=([^&]+)/.exec(p) || [])[1];
        if (rm) f.parents = f.parents.filter(x => rm.split(',').indexOf(x) < 0);
        if (add) f.parents.push(add);
        if (body && body.name) f.name = body.name;
        return { id: f.id, parents: f.parents };
      }
      return {};
    };
    window.driveEnsureItemFolder = async function (num) {
      const id = 'NUM_' + num; if (!D[id]) D[id] = { id: id, name: String(num), parents: ['ROOT'] }; return id;
    };
    window.driveFindItemFolder = async function (num) { return D['NUM_' + num] ? 'https://drive.google.com/drive/folders/NUM_' + num : ''; };
    window.__toasts = [];
    window.showToast = function (m) { window.__toasts.push(String(m)); };
  });
  return { ctx, pg, errs };
}

// open Update Info on a copy, open the catalog-entry cards, and type a number
const OPEN = async (pg, key, typed) => pg.evaluate(async ([key, typed]) => {
  const p = state.personalData[key];
  const idx = state.masterData.findIndex(m => m.itemNum === p.itemNum);
  showItemPanel(idx, key, 'edit');
  const ov = document.getElementById('item-panel-overlay');
  const entryRow = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
  const btn = entryRow && Array.from(entryRow.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent));
  if (btn) btn.click();
  const r = { field: !!entryRow, door: !!ov.querySelector('[data-rr-numdoor]'), ask: (ov.querySelector('[data-rr-numdoor]') || { textContent: '' }).textContent };
  if (typed != null && r.door) {
    const inp = ov.querySelector('#panel-numdoor-inp'); inp.value = typed;
    ov.querySelector('#panel-numdoor-find').click();
    const found = ov.querySelector('#panel-numdoor-found');
    r.found = Array.from(found.querySelectorAll('[data-rr-entry]')).map(c => c.getAttribute('data-rr-entry'));
    r.foundText = found.textContent.replace(/\s+/g, ' ').trim();
  }
  return r;
}, [key, typed]);
const PICK = async (pg, rowId) => pg.evaluate((rowId) => {
  const ov = document.getElementById('item-panel-overlay');
  const card = ov.querySelector('#panel-numdoor-found [data-rr-entry="' + rowId + '"]');
  if (card) card.click();
  const after = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
  return { picked: !!card, words: after ? after.textContent.replace(/\s+/g, ' ').trim() : '', written: window.__puts.length };
}, rowId);
const SAVE = async (pg, twice) => pg.evaluate(async (twice) => {
  const ov = document.getElementById('item-panel-overlay');
  const save = Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent));
  save.click(); if (twice) save.click();
  for (let i = 0; i < 60 && document.getElementById('item-panel-overlay'); i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 600));
  return { closed: !document.getElementById('item-panel-overlay') };
}, !!twice);
// what the stand-in sheet and drive hold now
const READ = async (pg) => pg.evaluate(() => {
  const F = PERSONAL_FIELD_INDEX, T = window.__tabs, bare = v => String(v == null ? '' : v).replace(/^'/, '');
  const pr = n => { const c = T['My Collection'][n] || []; return { num: bare(c[F.itemNum]), inv: bare(c[F.inventoryId]), group: bare(c[F.groupId]), rowId: bare(c[F.masterRowId]),
    road: bare(c[F.roadName]), desc: bare(c[F.masterDescription]), mfr: bare(c[F.manufacturer]), era: bare(c[F.era]), cond: bare(c[F.condition]), price: bare(c[F.priceItem]),
    notes: bare(c[F.notes]), tmcc: bare(c[F.tmccId]), photo: bare(c[F.photoItem]), photoBox: bare(c[F.photoBox]), type: bare(c[F.itemType]), boxCond: bare(c[F.boxCond]), matched: bare(c[F.matchedTo]) }; };
  const D = window.__drive;
  const a = state.personalData.a;
  return {
    a: pr(3), b: pr(4), c: pr(5), d: pr(6), t: pr(7),
    fs106: (T['For Sale'][3] || []).map(bare), fs201: (T['For Sale'][4] || []).map(bare),
    up106: (T['Want-Upgrade List'][3] || []).map(bare),
    s1: (T['Instruction Sheets'][3] || []).map(bare), s2: (T['Instruction Sheets'][4] || []).map(bare),
    p3: (T['Parts Needed'][3] || []).map(bare), p4: (T['Parts Needed'][4] || []).map(bare),
    foldA: (D.FOLD_A || { parents: [] }).parents.join(','), foldB: (D.FOLD_B || { parents: [] }).parents.join(','), foldC: (D.FOLD_C || { parents: [] }).parents.join(','),
    names: ['f1', 'f2', 'f3', 'g1', 'h1'].map(k => (D[k] || {}).name || ''),
    mem: { num: a.itemNum, inv: a.inventoryId, rowId: a.masterRowId, road: a.roadName, bNum: state.personalData.b.itemNum, cNum: state.personalData.c.itemNum,
      fs: state.forSaleData['106'].itemNum, fs201: state.forSaleData['201'].itemNum, up: state.upgradeData['106'].itemNum, s1: state.isData.s1.linkedItem, s2: state.isData.s2.linkedItem,
      p3: state.partsData.p3.forItem, p4: state.partsData.p4.forItem },
    idxKey: findPDKey('38725', ''), idxBox: findPDKey('38725-BOX', ''),
    resolves: (findMaster(a.itemNum, a.variation || '', a) || {}).rowId || '',
    nsStill: (findMaster('38586', '', { era: 'mpc', manufacturer: 'Lionel' }) || {}).rowId || '',
    puts: window.__puts.map(x => x.range),
    toasts: window.__toasts.slice(),
  };
});

async function moveCase(browser, size, planted) {
  const { ctx, pg, errs } = await boot(browser, size, planted);
  const o = await OPEN(pg, 'a', '38725');
  const pk = await PICK(pg, 'BU25BU25BU');
  const sv = await SAVE(pg);
  const r = await READ(pg);
  await ctx.close();
  return { o, pk, sv, r, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const DF = 'https://drive.google.com/drive/folders/';

  for (const size of ['phone', 'laptop']) {
    console.log('\n== A · ' + size + ' · Mike\'s 38586 moves to 38725 ==');
    const A = await moveCase(browser, size, null);
    const { o, pk, sv, r } = A;
    T('A0 [' + size + '] the page ran without a script error', A.errs.length === 0, A.errs);
    T('A1 [' + size + '] Change catalog entry shows the door "Wrong item number? Type the right one"', o.field && o.door && /Wrong item number\? Type the right one/.test(o.ask), o);
    T('A2 [' + size + '] typing 38725 shows ONLY the catalog\'s 38725 entry (no 38727, no 38586)', JSON.stringify(o.found) === JSON.stringify(['BU25BU25BU']) && /Tap the right one/.test(o.foundText) && /No\. 38725/.test(o.foundText), o);
    T('A3 [' + size + '] after the pick the field says the change in words, before anything is written',
      pk.picked && /Change No\. 38586 \(Norfolk Southern Diesel Locomotive\) to No\. 38725/.test(pk.words) && /Chicago, Burlington & Quincy/.test(pk.words) && /pictures, box, notes and price stay/.test(pk.words) && pk.written === 0, pk);
    T('A4 [' + size + '] Save closes the box and says "now No. 38725"', sv.closed && r.toasts.some(t => /now No\. 38725/.test(t)) && !r.toasts.some(t => /still say/.test(t)), { sv, toasts: r.toasts });
    T('A5 [' + size + '] the copy\'s row: 38725, the Burlington Row ID, road and description, maker Lionel',
      r.a.num === '38725' && r.a.rowId === 'BU25BU25BU' && r.a.road === 'Chicago, Burlington & Quincy' && /CB&Q SD80MAC/.test(r.a.desc) && r.a.mfr === 'Lionel', r.a);
    T('A6 [' + size + '] ...and everything that is HIS stays: inventory id, group, condition, price, notes, Command ID, pictures link',
      r.a.inv === '106' && r.a.group === 'G1' && r.a.cond === '9' && r.a.price === '250' && r.a.notes === 'from York' && r.a.tmcc === '106' && r.a.photo === DF + 'FOLD_A', r.a);
    T('A7 [' + size + '] its box follows: 38725-BOX, same inventory id, group, type, box condition, pictures link — and it names 38725',
      r.b.num === '38725-BOX' && r.b.inv === '107' && r.b.group === 'G1' && r.b.type === 'Box' && r.b.boxCond === '8' && r.b.photoBox === DF + 'FOLD_B' && r.b.matched === '38725', r.b);
    T('A7b [' + size + '] the tender in its group now names 38725 (its own number unchanged)', r.t.num === '6-82000' && r.t.matched === '38725' && r.t.inv === '108', r.t);
    // (the app's own background passes may fill a photo link or a key on any row — what
    // matters is that the MOVE never touches the other copy's number, id, group or entry)
    T('A8 [' + size + '] the OTHER 38586 (copy 201) and ITS box are untouched: number, id, group, entry, condition',
      r.c.num === '38586' && r.c.inv === '201' && r.c.group === 'G2' && r.c.rowId === 'NSNSNSNSNS' && r.c.cond === '6'
      && r.d.num === '38586-BOX' && r.d.inv === '202' && r.d.group === 'G2' && !r.puts.some(x => /^My Collection!A(5|6)(:|$)/.test(x)), { c: r.c, d: r.d, puts: r.puts });
    T('A9 [' + size + '] its For Sale listing says 38725 (price kept); copy 201\'s listing still says 38586',
      r.fs106[0] === '38725' && r.fs106[3] === '400' && r.fs106[8] === '106' && r.fs201[0] === '38586', { fs106: r.fs106, fs201: r.fs201 });
    T('A10 [' + size + '] its Upgrade entry says 38725 (priority, target kept)', r.up106[0] === '38725' && r.up106[3] === 'High' && r.up106[4] === '500' && r.up106[6] === '106', r.up106);
    T('A11 [' + size + '] its group\'s instruction sheet: 38725-IS linked to 38725; the other group\'s sheet unchanged',
      r.s1[0] === '38725-IS' && r.s1[1] === '38725' && r.s2[0] === '38586-IS' && r.s2[1] === '38586', { s1: r.s1, s2: r.s2 });
    T('A12 [' + size + '] its part says 38725; copy 201\'s part still says 38586', r.p3[3] === '38725' && r.p4[3] === '38586', { p3: r.p3, p4: r.p4 });
    T('A13 [' + size + '] its pictures\' folder (106) moved into 38725 — the SAME folder; the box\'s into 38725-BOX; copy 201\'s stayed',
      r.foldA === 'NUM_38725' && r.foldB === 'NUM_38725-BOX' && r.foldC === 'NUM_38586', { a: r.foldA, b: r.foldB, c: r.foldC });
    T('A14 [' + size + '] its photo names follow the number (ordered ones too); a name without its id, and copy 201\'s, are untouched',
      JSON.stringify(r.names) === JSON.stringify(['LIONEL 38725 ID106 RSV.jpg', '01· LIONEL 38725 ID106 FV.jpg', 'notes 38586 list.jpg', 'LIONEL 38725-BOX ID107 BOX FV.jpg', 'LIONEL 38586 ID201 RSV.jpg']), r.names);
    T('A15 [' + size + '] the app\'s memory matches the sheet', r.mem.num === '38725' && r.mem.inv === '106' && r.mem.rowId === 'BU25BU25BU' && r.mem.bNum === '38725-BOX' && r.mem.cNum === '38586'
      && r.mem.fs === '38725' && r.mem.fs201 === '38586' && r.mem.up === '38725' && r.mem.s1 === '38725' && r.mem.s2 === '38586' && r.mem.p3 === '38725' && r.mem.p4 === '38586', r.mem);
    T('A16 [' + size + '] the number index sees it at once (38725 → this copy, 38725-BOX → its box)', r.idxKey === 'a' && r.idxBox === 'b', { k: r.idxKey, b: r.idxBox });
    T('A17 [' + size + '] lookups: the copy resolves to the Burlington row; Lionel 38586 still resolves to Norfolk Southern', r.resolves === 'BU25BU25BU' && r.nsStill === 'NSNSNSNSNS', { r: r.resolves, ns: r.nsStill });
  }

  console.log('\n== B · a number the catalog does not have ==');
  {
    const { ctx, pg, errs } = await boot(browser, 'laptop', null);
    const o = await OPEN(pg, 'a', '99999X');
    T('B1 "No catalog entry carries 99999X." and no card to pick', o.found.length === 0 && /No catalog entry carries 99999X\./.test(o.foundText), o);
    T('B2 nothing written', (await pg.evaluate(() => window.__puts.length)) === 0 && errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n== C · a piece has no door — it follows its item ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    const o = await OPEN(pg, 'b', null);
    T('C1 the box\'s Update Info has no "Wrong item number?" door', !o.door, o);
    await ctx.close();
  }

  console.log('\n== D · a double tap saves once ==');
  const dblCase = async (planted) => {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU'); await SAVE(pg, true);
    const r = await READ(pg); await ctx.close();
    return { copyA: r.puts.filter(x => /^My Collection!A3:/.test(x)).length, boxA: r.puts.filter(x => /^My Collection!A4:/.test(x)).length, sale: r.puts.filter(x => /^For Sale!/.test(x)).length };
  };
  const D1 = await dblCase(null);
  T('D1 two taps on Save: the copy, its box and its listing are each written ONCE', D1.copyA === 1 && D1.boxA === 1 && D1.sale === 1, D1);

  console.log('\n== E · already own a 38725 ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    await pg.evaluate(() => { state.personalData.e = { owned: true, itemNum: '38725', variation: '', era: 'mpc', manufacturer: 'Lionel', inventoryId: '301', row: 7 }; window.__tabs['My Collection'][7] = rrRecordRow(state.personalData.e); });
    await OPEN(pg, 'a', '38725');
    const pk = await PICK(pg, 'BU25BU25BU');
    T('E1 the words say "You already have 1 of No. 38725 — this becomes another copy."', /You already have 1 of No\. 38725 — this becomes another copy\./.test(pk.words), pk.words);
    await SAVE(pg);
    const r = await pg.evaluate(() => ({ a: state.personalData.a.itemNum, e: state.personalData.e.itemNum, eInv: state.personalData.e.inventoryId, n: Object.keys(state.personalData).length }));
    T('E2 nothing merges: two copies of 38725 now, each its own', r.a === '38725' && r.e === '38725' && r.eInv === '301' && r.n === 5, r);
    await ctx.close();
  }

  console.log('\n== F · Cancel after a pick ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU');
    const r = await pg.evaluate(() => {
      const ov = document.getElementById('item-panel-overlay');
      Array.from(ov.querySelectorAll('button')).find(b => /^Cancel$/.test(b.textContent.trim())).click();
      return { puts: window.__puts.length, num: state.personalData.a.itemNum, closed: !document.getElementById('item-panel-overlay'), drive: window.__driveCalls.filter(c => /^PATCH/.test(c)).length };
    });
    T('F1 Cancel: nothing written, nothing moved, the copy is still 38586', r.puts === 0 && r.drive === 0 && r.num === '38586' && r.closed, r);
    await ctx.close();
  }

  console.log('\n== G · a copy whose photo cell is blank keeps its pictures ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    await pg.evaluate(() => { const a = state.personalData.a; a.photoItem = ''; window.__tabs['My Collection'][3] = rrRecordRow(a); });
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU'); await SAVE(pg);
    const r = await READ(pg);
    T('G1 its own folder (38586 › 106) is found under the OLD number and written to the photo cell', r.a.photo === DF + 'FOLD_A', r.a.photo);
    T('G2 ...and moved into 38725 with it', r.foldA === 'NUM_38725' && r.names[0] === 'LIONEL 38725 ID106 RSV.jpg', { f: r.foldA, n: r.names });
    await ctx.close();
  }

  console.log('\n== H · an engine saved as 38727-T picks the 38727 row from its OWN list (review finding 1) ==');
  const hCase = async (planted) => {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await pg.evaluate(() => {
      // a second 38727 entry (variation 2), so the own list holds a card that is NOT the current one
      state.masterData.push(Object.assign({}, state.masterData.find(m => m.rowId === 'BU27BU27BU'), { rowId: 'BU27VAR002', variation: '2', description: 'CB&Q SD80MAC Diesel "9660," nonpowered, second run' }));
      _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
      state.personalData.h = { owned: true, itemNum: '38727-T', variation: '', era: 'mpc', manufacturer: 'Lionel', inventoryId: '401', row: 8, masterRowId: 'BU27BU27BU' };
      window.__tabs['My Collection'][8] = rrRecordRow(state.personalData.h);
    });
    const r = await pg.evaluate(async () => {
      showItemPanel(state.masterData.findIndex(m => m.rowId === 'BU27BU27BU'), 'h', 'edit');
      const ov = document.getElementById('item-panel-overlay');
      const entryRow = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent));
      Array.from(entryRow.querySelectorAll('button')).find(b => /Change catalog entry/.test(b.textContent)).click();
      const own = Array.from(ov.querySelectorAll('[data-rr-entry]')).filter(c => !c.closest('#panel-numdoor-found')).map(c => c.getAttribute('data-rr-entry'));
      const card = Array.from(ov.querySelectorAll('[data-rr-entry="BU27VAR002"]')).find(c => !c.closest('#panel-numdoor-found'));
      if (card) card.click();
      const words = Array.from(ov.querySelectorAll('#item-panel-fields-container > div')).find(d => /Catalog entry/.test(d.textContent)).textContent;
      Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
      for (let i = 0; i < 40 && document.getElementById('item-panel-overlay'); i++) await new Promise(r => setTimeout(r, 100));
      const c = window.__tabs['My Collection'][8] || [];
      return { own, words, num: String(c[PERSONAL_FIELD_INDEX.itemNum] || '').replace(/^'/, ''), rowId: String(c[PERSONAL_FIELD_INDEX.masterRowId] || ''), mem: state.personalData.h.itemNum };
    });
    await ctx.close(); return r;
  };
  const H = await hCase(null);
  T('H1 its own list holds both 38727 entries; picking the other one is an entry change — no "Change No." words', H.own.indexOf('BU27VAR002') >= 0 && !/Change No\./.test(H.words), H);
  T('H2 Save keeps 38727-T (the -T is never dropped) and records the picked entry', H.num === '38727-T' && H.mem === '38727-T' && H.rowId === 'BU27VAR002', H);

  console.log('\n== I · a refused save, tapped again, still moves everything (review finding 2) ==');
  const iCase = async (planted) => {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU');
    await pg.evaluate(() => { window.__refuseRow = 3; });
    const first = await pg.evaluate(async () => {
      const ov = document.getElementById('item-panel-overlay');
      Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
      for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); const b = Array.from(ov.querySelectorAll('button')).find(x => /Save All Changes/.test(x.textContent)); if (b && !b.disabled) break; }
      return { open: !!document.getElementById('item-panel-overlay'), puts: window.__puts.length };
    });
    await pg.evaluate(() => { window.__refuseRow = 0; });
    await SAVE(pg);
    const r = await READ(pg); await ctx.close();
    return { first, r };
  };
  const I = await iCase(null);
  T('I1 the first Save is refused: nothing written, the box stays open', I.first.open && I.first.puts === 0, I.first);
  T('I2 tapped again: the copy is 38725 AND its box, listing and folder followed', I.r.a.num === '38725' && I.r.b.num === '38725-BOX' && I.r.fs106[0] === '38725' && I.r.foldA === 'NUM_38725', { a: I.r.a.num, b: I.r.b.num, fs: I.r.fs106[0], f: I.r.foldA });

  console.log('\n== K · a group holding ANOTHER 38586 (review finding 3) ==');
  const kCase = async (planted) => {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await pg.evaluate(() => { state.personalData.z = { owned: true, itemNum: '38586', variation: '', era: 'mpc', manufacturer: 'Lionel', inventoryId: '109', groupId: 'G1', row: 9 }; window.__tabs['My Collection'][9] = rrRecordRow(state.personalData.z); });
    await OPEN(pg, 'a', '38725');
    const pk = await PICK(pg, 'BU25BU25BU');
    await SAVE(pg);
    const r = await READ(pg); await ctx.close();
    return { pk, r };
  };
  const K = await kCase(null);
  T('K1 the words say the group\'s boxes and sheets stay', /Its group holds another No\. 38586, so the group’s boxes and sheets stay as they are\./.test(K.pk.words), K.pk.words);
  T('K2 the copy moves; the group\'s box, sheet and tender stay as they are', K.r.a.num === '38725' && K.r.b.num === '38586-BOX' && K.r.s1[1] === '38586' && K.r.t.matched === '38586', { a: K.r.a.num, b: K.r.b.num, s1: K.r.s1, t: K.r.t.matched });

  console.log('\n== L · offline: a number change waits for the internet ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU');
    await pg.evaluate(() => { window._rrOfflineNow = function () { return true; }; });
    const r = await pg.evaluate(async () => {
      const ov = document.getElementById('item-panel-overlay');
      Array.from(ov.querySelectorAll('button')).find(b => /Save All Changes/.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 400));
      return { open: !!document.getElementById('item-panel-overlay'), puts: window.__puts.length, toast: window.__toasts.slice(-1)[0] || '', num: state.personalData.a.itemNum };
    });
    T('L1 offline: "Connect to the internet to change the item number", nothing written, still 38586', r.open && r.puts === 0 && /Connect to the internet/.test(r.toast) && r.num === '38586', r);
    await ctx.close();
  }

  console.log('\n== M · a box with a blank picture cell and a shared folder (review finding 4) ==');
  {
    const { ctx, pg } = await boot(browser, 'laptop', null);
    await pg.evaluate(() => { const b = state.personalData.b; b.photoBox = ''; window.__tabs['My Collection'][4] = rrRecordRow(b); delete window.__drive.FOLD_B; delete window.__drive.g1; });
    await OPEN(pg, 'a', '38725'); await PICK(pg, 'BU25BU25BU'); await SAVE(pg);
    const r = await READ(pg);
    T('M1 its box has no folder of its own and 38586-BOX is shared with copy 201\'s box — no other copy\'s folder is written onto it', r.b.num === '38725-BOX' && r.b.photoBox === '' && r.b.photo === '', r.b);
    await ctx.close();
  }

  console.log('\n== P · planted offenders (each must turn a check red) ==');
  {
    const P1 = await moveCase(browser, 'laptop', PLANTS.noPieces());
    T('P1 PLANTED: the pieces rule cut out → the box stays 38586-BOX (A7 catches it)', P1.r.b.num === '38586-BOX', P1.r.b);
    const P2 = await moveCase(browser, 'laptop', PLANTS.newInv());
    T('P2 PLANTED: a new inventory id → the save is refused or the id changes (A5 / A6 catch it)', P2.r.a.num !== '38725' || P2.r.a.inv !== '106', P2.r.a);
    const P3 = await moveCase(browser, 'laptop', PLANTS.saleLeft());
    T('P3 PLANTED: the For Sale listing left behind → A9 catches it', P3.r.fs106[0] === '38586', P3.r.fs106);
    const P4 = await dblCase(PLANTS.doubleTap());
    T('P4 PLANTED: the Save guard cut out → a double tap writes the copy twice (D1 catches it)', P4.copyA > 1, P4);
    {
      const { ctx, pg } = await boot(browser, 'laptop', PLANTS.fakeEntry());
      const o = await OPEN(pg, 'a', '99999X');
      T('P5 PLANTED: a number with no catalog row offered as a card → B1 catches it', o.found.length > 0, o);
      await ctx.close();
    }
    const P6 = await moveCase(browser, 'laptop', PLANTS.merge());
    T('P6 PLANTED: the other 38586 swept along by number → A8 catches it', P6.r.c.num !== '38586', P6.r.c);
    const P8 = await hCase(PLANTS.ownList());
    T('P8 PLANTED: the own-list rule cut out → 38727-T becomes 38727 (H2 catches it)', P8.num !== '38727-T', P8);
    const P9 = await iCase(PLANTS.dropStaged());
    T('P9 PLANTED: the pick dropped before the save lands → the retry leaves the box behind (I2 catches it)', P9.r.b.num === '38586-BOX', { b: P9.r.b.num, a: P9.r.a.num });
    const P10 = await kCase(PLANTS.sharedGroup());
    T('P10 PLANTED: the shared-group guard cut out → the group\'s box is renamed (K2 catches it)', P10.r.b.num !== '38586-BOX', P10.r.b.num);
    const P7 = await moveCase(browser, 'laptop', PLANTS.noFolder());
    T('P7 PLANTED: the pictures\' folder not moved → A13 catches it', P7.r.foldA === 'NUM_38586', P7.r.foldA);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
