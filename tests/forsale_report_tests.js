#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// forsale_report_tests.js — 2026-11-07 (maintenance chat; real Chromium, the
// REAL app, a stand-in collection)
//
// [stated] Brad 2026-10-24 "yes on the sale report" ("add For Sale as a choice
// on the Reports page, so Want, For Sale and Parts all print from one place")
// → 2026-11-07 "its own" (its own row, not inside Want / Upgrade / Parts) →
// "yes". PLAN_2026-11-07_FORSALE_REPORT.md.
//
//   L  the Reports page lists "For Sale List" right after Want / Upgrade /
//      Parts, with Preview / Edit like every report.
//   C  its count = the For Sale page's own count ("N listed"): every listing
//      once, nothing else — a grouped companion (the box) folds into its lead,
//      a sale being recorded right now is off, an older listing with no
//      inventory ID still shows.
//   V  the values: asking price, listed date, the sale's own notes, est. worth;
//      the totals row adds the asking prices; sorted by item number.
//   K  two copies of one number — only the listed one; Lionel and Atlas with
//      the same number each get their OWN catalog description.
//   E  the CSV and the print page carry the rows, named "For Sale List".
//   B  Edit opens the builder on it with "Listed for sale: Yes"; the filter and
//      the three columns work on any report (No → only copies with no listing;
//      a plain report never grows the listing-only rows).
//   S  the source: ONE answer to "which ready-made report" (rrReadyReportDef),
//      the For Sale page and the report share ONE list (rrForSaleListed).
//   P  PLANTED: the number alone decides the catalog row → K red; the filter
//      taken out → C red; the listing-only rows taken out → C red; the page
//      back on its own copy of the list → S red.
//
// Run:  node tests/forsale_report_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  forsale_report_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── S · the source ──────────────────────────────────────────────────────────
console.log('\n== S · one answer each ==');
const REP = read('reports.js'), LIB = read('report-library.js'), PAGES = read('app-pages.js'), CFG = read('config.js');
const readyStrays = (rep, lib) => {
  const out = [];
  if (/type === 'cmdids'/.test(rep)) out.push('reports.js asks for cmdids by name');
  if (/rrCmdIdReportDef\(\)/.test(lib)) out.push('report-library.js calls rrCmdIdReportDef directly');
  if ((rep.match(/rrReadyReportDef\(type\)/g) || []).length !== 2) out.push('buildReport + exportReport do not both ask rrReadyReportDef');
  return out;
};
T('S1 ONE answer to "which ready-made report": buildReport, exportReport and Edit all ask rrReadyReportDef', readyStrays(REP, LIB).length === 0 && /rrReadyReportDef\(\\'' \+ _repEsc\(d\.id\)/.test(LIB), readyStrays(REP, LIB));
T('S2 PLANTED: the old cmdids-by-name line back → caught', readyStrays(REP + "\nif (type === 'cmdids' && x) {}", LIB).length === 1);
const pageList = (src) => {
  const i = src.indexOf('function buildForSalePage()');
  const body = src.slice(i, src.indexOf('// Summary stats', i));
  return /let fsEntries = rrForSaleListed\(\)\.filter\(/.test(body) && !/Object\.values\(state\.forSaleData\)/.test(body) && !/_saleBusy/.test(body) && !/_fsIsGroupedCompanion/.test(body);
};
T('S3 the For Sale page and the report count from ONE list (rrForSaleListed)', pageList(PAGES));
const plantedPage = PAGES.replace('let fsEntries = rrForSaleListed().filter(fs => {', 'let fsEntries = Object.values(state.forSaleData).filter(fs => {\n    if (fs && fs._saleBusy) return false;');
T('S4 PLANTED: the page back on its own copy of the list → caught by S3', plantedPage !== PAGES && !pageList(plantedPage));
T('S5 the words live once, in config.js (RR_FORSALE_REPORT)', /window\.RR_FORSALE_REPORT = \{/.test(CFG) && !/'For Sale List'/.test(LIB) && !/Everything you have listed for sale/.test(REP + LIB));

// ── the world ───────────────────────────────────────────────────────────────
const MASTER = [
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', roadName: 'Santa Fe', description: 'Santa Fe F3 A Unit', yearProd: '1950', _era: 'pw', _tab: 'PW - Items' },
  { itemNum: '8552', variation: '', itemType: 'Diesel Locomotive', roadName: 'Southern', description: 'Lionel Southern Alco PA', yearProd: '1975', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '8552', variation: '', itemType: 'Diesel Locomotive', roadName: 'Conrail', description: 'Atlas Conrail SD35', yearProd: '2004', _era: 'atlas', _tab: 'Atlas O', manufacturer: 'Atlas' },
  { itemNum: '2046', variation: '', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: 'Lionel Lines 4-6-4 Hudson', yearProd: '1950', _era: 'pw', _tab: 'PW - Items' },
  { itemNum: '2026', variation: '', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: 'Lionel Lines 2-6-2 Prairie', yearProd: '1948', _era: 'pw', _tab: 'PW - Items' },
  { itemNum: '6464-1', variation: '', itemType: 'Boxcar', roadName: 'Western Pacific', description: 'Western Pacific Boxcar', yearProd: '1953', _era: 'pw', _tab: 'PW - Items' },
];
const cp = (num, inv, x) => Object.assign({ itemNum: num, variation: '', owned: true, inventoryId: String(inv), row: inv, manufacturer: 'Lionel', era: 'pw', condition: '7', userEstWorth: '' }, x || {});
const PD = {
  '301': cp('2343', 301, { condition: '8', userEstWorth: '500' }),
  '302': cp('2343', 302, { condition: '6' }),
  '303': cp('8552', 303, { manufacturer: 'Atlas', era: 'atlas', userEstWorth: '150' }),
  '304': cp('6464-1', 304),
  '306': cp('2046', 306, { groupId: 'GRP-2046-1700000000', userEstWorth: '350' }),
  '307': cp('2046-BOX', 307, { groupId: 'GRP-2046-1700000000', itemType: 'Box', condition: '6' }),
};
const sale = (num, inv, price, listed, notes, x) => Object.assign({ itemNum: num, variation: '', condition: '', askingPrice: price, dateListed: listed, notes: notes || '', originalPrice: '', estWorth: '', inventoryId: inv ? String(inv) : '', manufacturer: 'Lionel' }, x || {});
const FS = {
  '301': sale('2343', 301, '450', '2026-10-01', 'with original box'),
  '303': sale('8552', 303, '120', '2026-10-05', '', { manufacturer: 'Atlas' }),
  '306': sale('2046', 306, '300', '', 'Hudson + box, together'),
  '307': sale('2046-BOX', 307, '40', '', ''),                                   // the box: folds into its lead
  'legacy-row-9': sale('2026', 0, '95', '2026-09-20', 'older listing', { estWorth: '110' }),   // no inventory ID
  'busy': sale('6464-1', 304, '35', '', '', { _saleBusy: true }),               // being sold right now
};

async function open(browser, swap) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: false });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!/^(file|data|blob|about):/.test(u)) return r.abort();
    for (const f of Object.keys(swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(({ master, pd, fsd }) => {
    try { localStorage.clear(); } catch (e) {}
    state.user = { name: 'Brad', email: 'brad@example.test' };
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = JSON.parse(JSON.stringify(pd));
    state.forSaleData = JSON.parse(JSON.stringify(fsd));
    state.personalSheetId = 'SHEET';
    window.__toasts = []; window.showToast = function (m) { window.__toasts.push(String(m)); };
    window.__csv = null; window._repKeepCsv = function (blob, name) { window.__csvName = name; blob.text().then(t => { window.__csv = t; }); };
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    window.__table = () => ({
      head: Array.from(document.querySelectorAll('#report-thead th')).map(t => t.textContent.trim()),
      rows: Array.from(document.querySelectorAll('#report-tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim())),
    });
    window.__wait = ms => new Promise(r => setTimeout(r, ms));
  }, { master: MASTER, pd: PD, fsd: FS });
  return { pg, ctx, errs };
}

// the walk: the Reports page → For Sale List → preview, CSV, print page, Edit
const walk = (pg) => pg.evaluate(async () => {
  const out = {};
  showPage('forsale'); await __wait(60);
  try { buildForSalePage(); } catch (e) { out.pageErr = e.message; }
  out.pageCount = (document.getElementById('forsale-stat-count') || {}).textContent || '';
  showPage('reports'); await __wait(60);
  if (typeof renderReportLibrary === 'function') renderReportLibrary();
  const lib = document.getElementById('report-library');
  out.libText = lib ? lib.textContent : '';
  out.order = REPORT_DEFS.map(d => d.id).join(',');
  out.hasEdit = !!document.getElementById('rep-edit-forsale');
  _repPreview('forsale'); await __wait(120);
  out.table = __table();
  out.title = (typeof _repTitleOf === 'function') ? _repTitleOf('forsale') : '';
  out.slug = (typeof _repSlugOf === 'function') ? _repSlugOf('forsale') : '';
  try { out.print = _repPrintHtml(); } catch (e) { out.print = 'ERR ' + e.message; }
  try { exportReport(); } catch (e) { out.csvErr = e.message; }
  for (let i = 0; i < 20 && window.__csv == null; i++) await __wait(30);
  out.csv = window.__csv; out.csvName = window.__csvName;
  // Edit → the builder, on this report
  const edit = document.getElementById('rep-edit-forsale');
  try { if (typeof _repClosePreview === 'function') _repClosePreview(); } catch (e) {}
  if (edit) edit.click(); await __wait(150);
  const ov = document.getElementById('rb-overlay');
  out.editOpened = !!ov;
  if (ov) {
    _rbShowTab('filters'); await __wait(60);
    out.filt = Array.from(ov.querySelectorAll('[data-rb-yn="forSale"].selected')).map(x => x.getAttribute('data-rb-val')).join(',');
    out.match = (document.getElementById('rb-match-top') || {}).textContent || '';
    _rbCloseOverlay();
  }
  // the filter and columns on ANY report: "Listed for sale: No", and a plain report
  const no = { id: null, name: 'x', colOrder: ['itemNum', 'askingPrice'], colEnabled: { itemNum: true, askingPrice: true }, filters: { forSale: 'No' }, sort: [{ field: 'itemNum', dir: 'asc' }] };
  out.noRows = _rbGetItems(no).map(r => r.pd.inventoryId || r.pd.itemNum);
  const plain = { id: null, name: 'y', colOrder: ['itemNum', 'askingPrice'], colEnabled: { itemNum: true, askingPrice: true }, filters: {}, sort: [{ field: 'itemNum', dir: 'asc' }] };
  out.plainRows = _rbGetItems(plain).map(r => (r.pd.inventoryId || '-') + ':' + _rbCellVal('askingPrice', r.pd, r.master, r));
  return out;
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const w = await open(browser);
    const r = await walk(w.pg);
    const rows = r.table.rows.filter(x => !/items$/.test(x[0] || ''));   // the data rows (not the totals row)
    const tot = r.table.rows.find(x => /items$/.test(x[0] || '')) || [];
    const H = r.table.head;
    const col = name => H.indexOf(name);

    console.log('\n== L · the Reports page ==');
    T('L1 the Reports page lists "For Sale List" with its description', /For Sale List/.test(r.libText) && /Everything you have listed for sale/.test(r.libText), r.libText.slice(0, 400));
    T('L2 it sits right after Want / Upgrade / Parts', /wantupgrade,forsale/.test(r.order), r.order);
    T('L3 it has an Edit button like the Command ID report', r.hasEdit);

    console.log('\n== C · it counts what the For Sale page counts ==');
    T('C1 the For Sale page says 4 listed (2343, Atlas 8552, 2046 + its box as one, the older 2026)', r.pageCount === '4', r.pageCount);
    T('C2 the report has the same 4 rows, each once', rows.length === 4 && rows.map(x => x[0]).sort().join(',') === '2026,2046,2343,8552', rows);
    T('C3 the box (sold with its Hudson) folds into the lead — not a row of its own', !rows.some(x => /2046-BOX/.test(x[0])), rows.map(x => x[0]));
    T('C4 the sale being recorded right now is off; the 6464-1 that is not listed is off', !rows.some(x => x[0] === '6464-1'), rows.map(x => x[0]));
    T('C5 the older listing with no inventory ID still shows (2026, its own price and notes)', rows.some(x => x[0] === '2026' && x[col('Asking Price')] === '$95' && x[col('Sale Notes')] === 'older listing'), rows);

    console.log('\n== V · the values ==');
    T('V1 columns: Item #, Description, Maker, Road Name, Variation #, Condition, Asking Price, Est. Worth, Listed, Sale Notes', H.join('|') === 'Item #|Description|Maker|Road Name|Variation #|Condition|Asking Price|Est. Worth|Listed|Sale Notes', H);
    const r2343 = rows.find(x => x[0] === '2343') || [];
    T('V2 the 2343: $450 asking, $500 est. worth, listed 2026-10-01, "with original box", condition 8 (the listed copy)', r2343[col('Asking Price')] === '$450' && r2343[col('Est. Worth')] === '$500' && r2343[col('Listed')] === '2026-10-01' && r2343[col('Sale Notes')] === 'with original box' && r2343[col('Condition')] === '8', r2343);
    T('V3 the totals row: 4 items, $965 asking (450 + 120 + 300 + 95)', /^4 items$/.test(tot[0] || '') && tot[col('Asking Price')] === '$965', tot);
    T('V4 sorted by item number', rows.map(x => x[0]).join(',') === '2026,2046,2343,8552', rows.map(x => x[0]));

    console.log('\n== K · the right copy, the right catalog row ==');
    T('K1 two 2343s — only the listed one (condition 8), never the one that is not for sale (condition 6)', rows.filter(x => x[0] === '2343').length === 1 && r2343[col('Condition')] === '8', rows);
    const r8552 = rows.find(x => x[0] === '8552') || [];
    T('K2 the Atlas 8552 gets the ATLAS description, never Lionel\'s 8552', /Conrail/.test(r8552[col('Description')] || '') && !/Southern/.test(r8552.join('|')) && r8552[col('Maker')] === 'Atlas', r8552);

    console.log('\n== E · export and print ==');
    T('E1 the print page carries the rows under the title "For Sale List"', /For Sale List/.test(r.print) && /Hudson \+ box, together/.test(r.print) && /\$965/.test(r.print), String(r.print).slice(0, 300));
    T('E2 the CSV has the four rows and the asking prices', !!r.csv && (r.csv.trim().split('\n').length === 5) && /"450"/.test(r.csv) && /"95"/.test(r.csv) && /Asking Price/.test(r.csv), r.csv);
    T('E3 the files are named for the report ("for-sale-list…")', r.slug === 'for-sale-list' && /^for-sale-list/.test(r.csvName || ''), { slug: r.slug, csv: r.csvName });

    console.log('\n== B · the builder ==');
    T('B1 Edit opens the builder on it, with "Listed for sale: Yes" — 4 match', r.editOpened && r.filt === 'Yes' && /\b4\b/.test(r.match), { opened: r.editOpened, filt: r.filt, match: r.match });
    T('B2 "Listed for sale: No" on any report → only the copy with no listing at all (the second 2343) — not the 6464-1 being sold right now, not the box sold with its Hudson', r.noRows.sort().join(',') === '302', r.noRows);
    T('B3 a plain report never grows the listing-only row, and shows the asking price where there is one', !r.plainRows.some(x => /^-:/.test(x)) && r.plainRows.includes('301:450') && r.plainRows.includes('302:'), r.plainRows);
    T('B4 no page errors', w.errs.length === 0, w.errs);
    await w.ctx.close();

    // ── P · planted ─────────────────────────────────────────────────────────
    console.log('\n== P · planted: each check can fail ==');
    const numOnly = PAGES.replace("  return findMaster(fs.itemNum, fs.variation, pd || fs) || {};\n}\n// 2026-11-07 (fsreport", "  return findMaster(fs.itemNum, fs.variation) || {};\n}\n// 2026-11-07 (fsreport");
    const repNumOnly = REP.replace("const master = (typeof findMaster === 'function' ? findMaster(pd.itemNum, pd.variation, pd) : null) || {};", "const master = (typeof findMaster === 'function' ? findMaster(pd.itemNum) : null) || {};");
    { const p = await open(browser, { 'app-pages.js': numOnly, 'reports.js': repNumOnly }); const pr = await walk(p.pg); const pr8552 = pr.table.rows.find(x => x[0] === '8552') || [];
      T('P1 the number alone decides the catalog row → K2 red (the Atlas gets Lionel\'s description)', repNumOnly !== REP && /Southern/.test(pr8552.join('|')), pr8552); await p.ctx.close(); }
    const noFilter = REP.replace("if (f.forSale==='Yes' && !row.fsListed) return false;", "");
    { const p = await open(browser, { 'reports.js': noFilter }); const pr = await walk(p.pg); const n = pr.table.rows.filter(x => !/items$/.test(x[0] || '')).length;
      T('P2 the filter taken out → C2 red (every item shows)', noFilter !== REP && n !== 4, n); await p.ctx.close(); }
    const noOnly = REP.replace("  listed.forEach(fs => {\n    if (carried.has(fs)) return;", "  [].forEach(fs => {\n    if (carried.has(fs)) return;");
    { const p = await open(browser, { 'reports.js': noOnly }); const pr = await walk(p.pg); const nums = pr.table.rows.map(x => x[0]);
      T('P3 the listing-only rows taken out → C5 red (the older 2026 listing is missing)', noOnly !== REP && !nums.includes('2026'), nums); await p.ctx.close(); }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  forsale_report_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  forsale_report_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
