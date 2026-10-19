#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// BUILD A REPORT: PREVIEW & SORT — v0.9.1986 (real Chromium, REAL reports.js,
// report-library.js, app.css)
//
// Brad, 2026-10-18: "sort, i just don't understand this page, need more
// thoughts here too, also, a preview page may help alot. maybe that is where
// sort shows up". Told the plan (release 2: the real report on a Preview step,
// click a heading to sort, Shift-click for "then by", drag headings to move,
// Save / Print / PDF there) — "yes".
//
//   V1  the tabs are Columns, Filters, Preview & Sort — no Sort tab
//   V2  the preview IS the report: the same rows, in the same order, as the
//       saved report will hold (the first 25 shown, the count says how many in all)
//   V3  click Est. Worth: "Sorted by Est. Worth Low → High", ▲ on the heading
//   V4  click it again: High → Low, ▼
//   V5  Shift-click Type: "then Type A → Z"; the headings carry 1 and 2
//   V6  × takes a part off the line
//   V7  "+ then by…" adds one (the phone's way, no Shift key)
//   V8  a blank sorts LAST both ways (Amount Paid: the catalog and mock-up have none)
//   V9  Item # sorts in the catalog's own number order (rrCatalogNumberKey)
//   D1  drag Item # by its ⋮⋮ (a real mouse) to after Description: the column moves
//   D2  a press on ⋮⋮ that doesn't move is not a drag and not a sort
//   S1  Print and PDF show only on Preview & Sort; Save keeps the order and
//       the sort; the saved report is the preview, row for row
//   S2  Print saves, then prints the report under its own name (it said "Report")
//   M1  a phone: the table scrolls inside its own box, the step never sideways
//   P   PLANTED: the shipped v0.9.1985 reports.js (git 7c7f0dfe) has a Sort
//       tab and no preview — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  report_preview_1986_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let OLDREP = null;
try { OLDREP = cp.execSync('git show 7c7f0dfe:app/reports.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

// The catalog. Trolley and Vat Car are catalog types he owns none of.
const MASTER = [
  { itemNum: '3494-1', variation: '', itemType: 'Boxcar', subType: 'Operating Boxcar', description: 'NYC Pacemaker operating boxcar', yearProd: '1955', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '6464-1', variation: '', itemType: 'Boxcar', description: 'Western Pacific boxcar', yearProd: '1953', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '6672', variation: '', itemType: 'Refrigerator Car', description: 'Santa Fe refrigerator car', yearProd: '1954', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3 A unit', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '259E', variation: '', itemType: 'Steam Locomotive', description: '2-4-2 steam locomotive', yearProd: '1932', _era: 'prewar', _tab: 'Lionel Pre-War' },
  { itemNum: '6-84631', variation: '', itemType: 'Diesel Locomotive', description: 'RJ Corman SD40T-2 diesel', yearProd: '2018', _era: 'mod', _tab: 'Lionel MPC-Modern' },
  { itemNum: '60', variation: '', itemType: 'Trolley', description: 'Trolley', yearProd: '1955', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '6475', variation: '', itemType: 'Vat Car', description: 'Pickle vat car', yearProd: '1960', _era: 'pw', _tab: 'Lionel PW - Items' },
];
const PD = {
  'INV-1': { inventoryId: 'INV-1', itemNum: '3494-1', variation: '', owned: true, condition: '8', priceItem: '120', userEstWorth: '200', hasBox: 'Yes', manufacturer: 'Lionel', custom1: 'Lot 7', location: 'Basement', locationDetail: 'Tote 3' },
  'INV-2': { inventoryId: 'INV-2', itemNum: '6464-1', variation: '', owned: true, condition: '7', priceItem: '60', userEstWorth: '90', hasBox: 'No', manufacturer: 'Lionel', custom1: 'Lot 7' },
  'INV-9': { inventoryId: 'INV-9', itemNum: '6672', variation: '', owned: true, condition: '7', priceItem: '35', userEstWorth: '50', hasBox: 'No', manufacturer: 'Lionel' },
  'INV-3': { inventoryId: 'INV-3', itemNum: '2343', variation: '', owned: true, condition: '6', priceItem: '300', userEstWorth: '450', hasBox: 'No', manufacturer: 'Lionel' },
  'INV-4': { inventoryId: 'INV-4', itemNum: '259E', variation: '', owned: true, condition: '5', priceItem: '150', userEstWorth: '175', hasBox: 'No', manufacturer: 'Lionel' },
  'INV-5': { inventoryId: 'INV-5', itemNum: '6-84631', variation: '', owned: true, condition: '9', priceItem: '400', userEstWorth: '420', hasBox: 'Yes', manufacturer: 'Lionel' },
  'INV-6': { inventoryId: 'INV-6', itemNum: 'CAT-1955', itemType: 'Catalog', description: '1955 Consumer Catalog', yearMade: '1955', owned: true, condition: '8', userEstWorth: '40', manufacturer: 'Lionel', subType: 'Consumer' },
  'INV-7': { inventoryId: 'INV-7', itemNum: 'MU-1', itemType: 'Mock-Up', description: 'Engineering mock-up, boxcar body', owned: true, condition: '7', userEstWorth: '900', manufacturer: 'Lionel' },
  // a loose box with no condition and no price — part of its item, never a row
  'INV-8': { inventoryId: 'INV-8', itemNum: '6464-1', variation: '', owned: true, hasBox: 'Yes', condition: '', priceItem: '' },
};
const OWN_TABS = {
  ephemera: { paper: { 3: { row: 3, itemNum: '8157-PAP', title: 'Dealer display poster', description: '', year: '1957', manufacturer: 'Lionel', condition: '6', estValue: '75', paperType: 'Poster' } } },
  is: { 3: { _key: 3, row: 3, sheetNum: '2343-10', linkedItem: '2343', year: '1950', condition: '7', estValue: '12' } },
  science: { 3: { row: 3, itemNum: '3101', description: 'Chemistry set', year: '1948', condition: '6', estValue: '60' } },
};

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/reports.js') && o.rep) return r.fulfill({ body: o.rep, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(({ master, pd, own }) => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = master.slice();
    state.personalData = JSON.parse(JSON.stringify(pd));
    state.ephemeraData = JSON.parse(JSON.stringify(own.ephemera));
    state.isData = JSON.parse(JSON.stringify(own.is));
    state.scienceData = JSON.parse(JSON.stringify(own.science));
    state.constructionData = {};
    state.savedReports = undefined;
    // his own column, named, and Location Detail switched on — through the one door
    _prefSet('lv_label_custom1', 'Purchase Lot'); _prefSet('lv_custom1_enabled', 'true');
    _prefSet('lv_location_enabled', 'true'); _prefSet('lv_locdetail_enabled', 'true');
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, { master: MASTER, pd: PD, own: OWN_TABS });
  return { pg, ctx, errs };
}

const pv = (pg) => pg.evaluate(() => {
  const ths = [...document.querySelectorAll('.rb-pv-table thead th')];
  return {
    heads: ths.map(t => t.getAttribute('data-rb-pvcol')),
    labels: ths.map(t => (t.querySelector('.rb-pv-lbl') || {}).textContent || ''),
    rows: [...document.querySelectorAll('.rb-pv-table tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim())),
    line: ((document.getElementById('rb-sortline') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    more: ((document.querySelector('.rb-pv-more') || {}).textContent || '').trim(),
    sort: JSON.parse(JSON.stringify(_rbState.sort || [])),
  };
});
const clickHead = (pg, key, shift) => pg.evaluate(([key, shift]) => {
  const th = document.querySelector('[data-rb-pvcol="' + key + '"] .rb-pv-lbl');
  th.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: !!shift }));
}, [key, shift]);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r = await open(browser, { w: 1536, h: 737 });
  const tabs = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    showPage('reports'); await S(100);
    openReportBuilder(null); await S(200);
    // the columns for this run: Item #, Description, Type, Amount Paid, Est. Worth
    _rbState.colEnabled = { itemNum: true, description: true, itemType: true, priceItem: true, userEstWorth: true };
    _rbState.colOrder = ['itemNum', 'description', 'itemType', 'priceItem', 'userEstWorth'];
    _rbState.sort = [];
    return [...document.querySelectorAll('.rb-tab')].map(t => t.textContent.trim());
  });
  T('V1 the tabs are Columns, Filters, Preview & Sort — no Sort tab', tabs.join('|') === 'Columns|Filters|Preview & Sort', tabs);
  const btn0 = await r.pg.evaluate(() => [document.getElementById('rb-print-btn').offsetParent !== null, document.getElementById('rb-pdf-btn').offsetParent !== null]);
  T('S1 Print and PDF are hidden on Columns', btn0.join() === 'false,false', btn0);
  await r.pg.evaluate(() => _rbShowTab('preview'));
  let p = await pv(r.pg);
  const btn1 = await r.pg.evaluate(() => [document.getElementById('rb-print-btn').offsetParent !== null, document.getElementById('rb-pdf-btn').offsetParent !== null]);
  T('S1 …and shown on Preview & Sort', btn1.join() === 'true,true', btn1);
  T('V2 the preview draws the report\'s columns in its order', p.heads.join() === 'itemNum,description,itemType,priceItem,userEstWorth', p.heads);
  T('V2 all 11 rows, and it says so; not sorted yet', p.rows.length === 11 && /All 11 items shown/.test(p.more) && /^Not sorted/.test(p.line), { n: p.rows.length, more: p.more, line: p.line });

  await clickHead(r.pg, 'userEstWorth');
  p = await pv(r.pg);
  const worth = p.rows.map(x => parseFloat(x[4].replace(/[^0-9.]/g, '')));
  T('V3 click Est. Worth: "Sorted by Est. Worth Low → High", ▲, cheapest first', /^Sorted by Est\. Worth Low → High/.test(p.line) && /Est\. Worth ▲/.test(p.labels[4]) && worth.every((v, i) => !i || worth[i - 1] <= v), { line: p.line, worth, lab: p.labels[4] });
  await clickHead(r.pg, 'userEstWorth');
  p = await pv(r.pg);
  const worth2 = p.rows.map(x => parseFloat(x[4].replace(/[^0-9.]/g, '')));
  T('V4 click again: High → Low, ▼, the $900 mock-up first', /^Sorted by Est\. Worth High → Low/.test(p.line) && /▼/.test(p.labels[4]) && worth2[0] === 900 && worth2.every((v, i) => !i || worth2[i - 1] >= v), { line: p.line, worth2 });

  await clickHead(r.pg, 'itemType', true);
  p = await pv(r.pg);
  T('V5 Shift-click Type: "… then Type A → Z", and the headings carry their places (1, 2)',
    /Est\. Worth High → Low.*then Type A → Z/.test(p.line) && p.sort.length === 2 && /1$/.test(p.labels[4].replace(/\s/g, '')) && /2$/.test(p.labels[2].replace(/\s/g, '')), { line: p.line, labels: p.labels });
  await clickHead(r.pg, 'itemType', true);
  p = await pv(r.pg);
  T('V5 Shift-click it again flips only the "then by" (Z → A)', /Est\. Worth High → Low.*then Type Z → A/.test(p.line), p.line);
  await r.pg.evaluate(() => document.querySelector('[data-rb-sortx="0"]').click());
  p = await pv(r.pg);
  T('V6 × takes Est. Worth off; Type leads now', p.sort.length === 1 && p.sort[0].field === 'itemType' && /^Sorted by Type Z → A/.test(p.line), { line: p.line, sort: p.sort });
  await r.pg.evaluate(() => { const s = document.querySelector('[data-rb-addsort]'); s.value = 'itemNum'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  p = await pv(r.pg);
  T('V7 "+ then by…" adds Item # after Type', p.sort.map(s => s.field).join() === 'itemType,itemNum' && /then Item # A → Z/.test(p.line), { line: p.line });

  await clickHead(r.pg, 'priceItem');
  p = await pv(r.pg);
  const paidA = p.rows.map(x => x[3]);
  await clickHead(r.pg, 'priceItem');
  p = await pv(r.pg);
  const paidD = p.rows.map(x => x[3]);
  const blanksLast = (list) => { const i = list.findIndex(v => v === '—'); return i < 0 || list.slice(i).every(v => v === '—'); };
  T('V8 a blank Amount Paid sorts LAST both ways (Low → High and High → Low)', blanksLast(paidA) && blanksLast(paidD) && paidA.includes('—') && paidA[0] !== '—' && paidD[0] !== '—', { paidA, paidD });

  await clickHead(r.pg, 'itemNum');
  p = await pv(r.pg);
  const nums = p.rows.map(x => x[0]);
  const want = await r.pg.evaluate((nums) => nums.slice().sort((a, b) => rrCompareCatalogKeys(rrCatalogNumberKey(a), rrCatalogNumberKey(b))), nums);
  T('V9 Item # sorts in the catalog\'s own number order', nums.join() === want.join(), { nums, want });

  // ── D1 drag with a real mouse ────────────────────────────────────────────
  const g = await r.pg.evaluate(() => {
    const q = (k) => { const e = document.querySelector('[data-rb-pvcol="' + k + '"]'); const b = e.getBoundingClientRect(); return { x: b.left, r: b.right, y: b.top + b.height / 2 }; };
    const grip = document.querySelector('[data-rb-grip="itemNum"]').getBoundingClientRect();
    return { gx: grip.left + grip.width / 2, gy: grip.top + grip.height / 2, desc: q('description') };
  });
  await r.pg.mouse.move(g.gx, g.gy); await r.pg.mouse.down();
  await r.pg.mouse.move(g.gx + 40, g.gy, { steps: 4 });
  await r.pg.mouse.move(g.desc.r - 8, g.desc.y, { steps: 8 });
  await r.pg.mouse.up(); await r.pg.waitForTimeout(80);
  p = await pv(r.pg);
  T('D1 dragging Item # by its ⋮⋮ to the right half of Description puts it after Description', p.heads.slice(0, 2).join() === 'description,itemNum', p.heads);
  const sortBefore = JSON.stringify(p.sort);
  const g2 = await r.pg.evaluate(() => { const b = document.querySelector('[data-rb-grip="itemType"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await r.pg.mouse.click(g2.x, g2.y); await r.pg.waitForTimeout(60);
  p = await pv(r.pg);
  T('D2 a press on ⋮⋮ that does not move changes nothing (no move, no sort)', p.heads.join() === 'description,itemNum,itemType,priceItem,userEstWorth' && JSON.stringify(p.sort) === sortBefore, { heads: p.heads, sort: p.sort });

  // ── S1 save keeps the order and the sort; the saved report = the preview ─
  const s1 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const pvRows = [...document.querySelectorAll('.rb-pv-table tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim()).join('|'));
    document.getElementById('rb-name').value = 'Preview check';
    _rbSave(); await S(150);
    const def = _rbReadSaved().find(x => x.name === 'Preview check');
    buildCustomReport(def); await S(30);
    const heads = [...document.querySelectorAll('#report-thead th')].map(t => t.textContent);
    const rows = [...document.querySelectorAll('#report-tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim()).join('|'));
    return { sort: def.sort, heads, pvRows, rows: rows.slice(0, pvRows.length) };
  });
  T('S1 saved with its sort (Item # A → Z) and its column order (Description first)', s1.sort.length === 1 && s1.sort[0].field === 'itemNum' && s1.heads[0] === 'Description' && s1.heads[1] === 'Item #', { sort: s1.sort, heads: s1.heads });
  T('S1 the saved report is the preview, row for row', s1.rows.join('\n') === s1.pvRows.join('\n'), { pv: s1.pvRows, saved: s1.rows });

  // ── S2 Print from the preview ────────────────────────────────────────────
  const s2 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    let printed = null;
    window.printReportWithPhotos = function () { printed = (document.getElementById('rep-prev-title') || {}).textContent; };
    openReportBuilder(_rbReadSaved().find(x => x.name === 'Preview check').id); await S(150);
    _rbShowTab('preview'); await S(30);
    document.getElementById('rb-print-btn').click(); await S(200);
    return { printed, overlay: !!document.getElementById('rb-overlay') };
  });
  T('S2 Print saves, closes the builder and prints the report under its own name', s2.printed === 'Preview check' && !s2.overlay, s2);
  T('page errors (laptop)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── M1 a phone ───────────────────────────────────────────────────────────
  r = await open(browser, { w: 390, h: 844, mobile: true });
  const m1 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 30; i++) state.personalData['X' + i] = { inventoryId: 'X' + i, itemNum: 'M-' + i, itemType: 'Mock-Up', description: 'Extra ' + i, owned: true, condition: '5', userEstWorth: String(i) };
    openReportBuilder(null); await S(150);
    ['manufacturer', 'eraPeriod', 'roadName', 'location', 'custom1'].forEach(k => _rbToggleCol(k, true));
    _rbShowTab('preview'); await S(50);
    const b = document.getElementById('rb-body'), w = document.querySelector('.rb-pv-wrap');
    return { body: b.scrollWidth - b.clientWidth, wrapScroll: w.scrollWidth - w.clientWidth, page: document.documentElement.scrollWidth - innerWidth,
      rows: document.querySelectorAll('.rb-pv-table tbody tr').length, more: document.querySelector('.rb-pv-more').textContent };
  });
  T('V2 a long report: the first 25 rows, and "Showing the first 25 of 41 items"', m1.rows === 25 && /Showing the first 25 of 41 items/.test(m1.more), { rows: m1.rows, more: m1.more });
  T('M1 a phone: the wide table scrolls inside its own box; the step and the page never sideways', m1.wrapScroll > 0 && m1.body <= 0 && m1.page <= 0, m1);
  T('page errors (phone)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── P planted ────────────────────────────────────────────────────────────
  if (!OLDREP) T('P0 the v0.9.1985 reports.js could be read from git (7c7f0dfe)', false, 'git show failed');
  else {
    r = await open(browser, { w: 1536, h: 737, rep: OLDREP });
    const old = await r.pg.evaluate(async () => {
      const S = ms => new Promise(r => setTimeout(r, ms));
      openReportBuilder(null); await S(150);
      return { tabs: [...document.querySelectorAll('.rb-tab')].map(t => t.textContent.trim()), preview: typeof _rbPreviewHTML === 'function' };
    });
    T('P1 PLANTED: v0.9.1985 still has a Sort tab and no preview', old.tabs.includes('Sort') && !old.preview, old);
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
