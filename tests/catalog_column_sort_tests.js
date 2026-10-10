#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CATALOG COLUMN SORT TESTS — v0.9.1916   (real Chromium, the REAL app)
//
// Brad, 2026-10-10: "the master catalog columns should be able to sort by mfr,
// item, type, road name, year, owned ..... okay, all headers need to be
// sortable except description." Then "yes" to the plan: click = ascending,
// again = descending, third = the normal catalog order; the WHOLE filtered
// list sorts (not one page); Item # in catalog-number order; Year and MSRP as
// numbers; Owned puts what you own first; blanks LAST either way; every
// Master Catalog table (the item layouts + the section tables).
//
// Everything here is done through the app's own headers (real clicks) and
// read off the rows the app drew. Planted offenders must turn it red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  catalog_column_sort_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const BROWSE = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

async function openApp(browser, browseSrc) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (browseSrc && u.split('?')[0].endsWith('/browse.js')) return r.fulfill({ body: browseSrc, contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern';
    const mk = (n, v, t, road, yr, era, tab, x) => Object.assign({ itemNum: n, variation: v, itemType: t, roadName: road, yearProd: yr, _era: era, _tab: tab, description: 'desc ' + n }, x || {});
    state.masterData = [
      mk('1008', '', 'Accessory', 'Lionel Lines', '1957', 'pw', PW),
      mk('4', '', 'Trolley', 'Union Pacific', '', 'pw', PW),          // blank year
      mk('004', '', 'Track', '', '1937', 'pw', PW),                   // blank road
      mk('6343', '', 'Flatcar', 'Lionel', '1961-1962', 'pw', PW),
      mk('2343', '1', 'Diesel', 'Santa Fe', '1950', 'pw', PW),
      mk('8359', '', 'Diesel', 'Chessie System', '1973', 'mpc', MPC),
      mk('6464-1', '1', 'Boxcar', 'Western Pacific', '1953', 'pw', PW),
    ];
    _rebuildMasterIndex();
    state.personalData = { a: { owned: true, itemNum: '6343', variation: '', era: 'pw', manufacturer: 'Lionel', inventoryId: '1', row: 2 } };
    state.wantData = { '2343|1': { itemNum: '2343', variation: '1' } };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    state.filters.owned = false; state.filters.search = '';
    state._browseSort = null;
    // the Master Catalog shows rows once a filter is set ("Please select a filter…")
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'lionel', scale: 'any', era: 'any', section: 'items' }));
    renderBrowseTab('items');
    _refreshBrowseHeaders();
    window._rrBrowseSig = null; renderBrowse();
  });
  return { pg, errs };
}
// The item numbers in the order the table shows them (current page).
const NUMS = () => Array.from(document.querySelectorAll('#browse-tbody tr')).map(tr => {
  const n = tr.querySelector('.item-num'); return n ? n.textContent.replace(/[*⚡]/g, '').trim() : '';
}).filter(Boolean);
const clickHead = async (pg, label) => {
  const th = await pg.$$('#browse-items-panel .item-table thead th');
  for (const h of th) { const t = (await h.textContent()).replace(/[▲▼]/g, '').trim(); if (t === label) { await h.click(); await pg.waitForTimeout(60); return true; } }
  return false;
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let { pg, errs } = await openApp(browser);

  // ── A: which headers sort ──
  const heads = await pg.evaluate(() => Array.from(document.querySelectorAll('#browse-items-panel .item-table thead th')).map(th => ({ l: th.textContent.trim(), s: !!th.dataset.sort })));
  T('A1 every heading but the two descriptions sorts', heads.filter(h => h.s).map(h => h.l), ['Mfr.', 'Item #', 'Type', 'Road / Name', 'Var.', 'Year', 'Owned']);
  T('A2 Descr. and Var. Descr. do not', heads.filter(h => !h.s).map(h => h.l), ['Descr.', 'Var. Descr.']);
  const base = await pg.evaluate(NUMS);
  T('A3 before any click: the catalog order (004, 4, 1008 …)', base, ['004', '4', '1008', '2343', '6343', '6464-1', '8359']);

  // ── B: Year — numbers, blanks last both ways, third click restores ──
  await clickHead(pg, 'Year');
  T('B1 Year ▲ oldest first, the blank year LAST', await pg.evaluate(NUMS), ['004', '2343', '6464-1', '1008', '6343', '8359', '4']);
  T('B2 the heading shows ▲', await pg.evaluate(() => document.querySelector('th[data-sort="year"]').textContent.includes('▲')), true);
  await clickHead(pg, 'Year');
  T('B3 Year ▼ newest first, the blank year STILL last', await pg.evaluate(NUMS), ['8359', '6343', '1008', '6464-1', '2343', '004', '4']);
  await clickHead(pg, 'Year');
  T('B4 third click: back to the catalog order', await pg.evaluate(NUMS), base);
  T('B5 …and no arrow', await pg.evaluate(() => /[▲▼]/.test(document.querySelector('#browse-items-panel .item-table thead tr').textContent)), false);

  // ── C: Item # in catalog-number order; Road / Name natural, blank last ──
  await clickHead(pg, 'Item #'); await clickHead(pg, 'Item #');
  T('C1 Item # ▼ is the catalog order reversed', await pg.evaluate(NUMS), base.slice().reverse());
  await clickHead(pg, 'Road / Name');
  T('C2 Road / Name ▲ A→Z, the blank road last', await pg.evaluate(NUMS), ['8359', '6343', '1008', '2343', '4', '6464-1', '004']);

  // ── D: Owned first; Want next; nothing last ──
  await clickHead(pg, 'Owned');
  const owned = await pg.evaluate(NUMS);
  T('D1 Owned ▲: the owned 6343 first, the wanted 2343 next', owned.slice(0, 2), ['6343', '2343']);
  // the row's own badge still comes from the per-render resolver (a near-miss
  // while building: _rrPdForRow is a closure, not a global — calling it from
  // outside gave every row "—")
  const badge = await pg.evaluate(() => { const tr = Array.from(document.querySelectorAll('#browse-tbody tr')).find(r => /6343/.test(r.textContent)); return tr ? tr.querySelector('.owned-badge').textContent.trim() : ''; });
  T('D2 the owned row still SAYS Owned', badge, '✓ Owned');

  // ── E: the WHOLE list sorts, not one page ──
  const paged = await pg.evaluate(() => { state.pageSize = 3; state._browseSort = null; state.currentPage = 1; _refreshBrowseHeaders(); window._rrBrowseSig = null; renderBrowse(); return 1; });
  await clickHead(pg, 'Year'); await clickHead(pg, 'Year');
  T('E1 page 1 of 3 holds the three NEWEST of all seven', await pg.evaluate(NUMS), ['8359', '6343', '1008']);
  await pg.evaluate(() => { state.pageSize = 50; state._browseSort = null; _refreshBrowseHeaders(); window._rrBrowseSig = null; renderBrowse(); });

  // ── F: a search does not undo a clicked order ──
  await pg.evaluate(() => { state.filters.search = '4'; window._rrBrowseSig = null; renderBrowse(); });
  const searched = await pg.evaluate(NUMS);
  await clickHead(pg, 'Year');
  const searchedYear = await pg.evaluate(NUMS);
  T('F1 with a search on, Year ▲ still orders by year (blank last)', searchedYear[searchedYear.length - 1], '4');
  T('F2 (the search found more than one row)', searched.length > 1, true);
  await pg.evaluate(() => { state.filters.search = ''; state._browseSort = null; _refreshBrowseHeaders(); window._rrBrowseSig = null; renderBrowse(); });

  // ── G: the Atlas layout: MSRP sorts as money, not as words ──
  const money = await pg.evaluate(() => {
    const ks = ['$129.95', '$99.95', '', '$1,049.00'].map(v => rrSortKey('money', v));
    return rrSortList(['$129.95', '$99.95', '', '$1,049.00'], v => rrSortKey('money', v), 'money', 'asc');
  });
  T('G1 MSRP ▲: 99.95, 129.95, 1,049.00, blank last', money, ['$99.95', '$129.95', '$1,049.00', '']);
  const atlasHead = await pg.evaluate(() => { const old = _currentEra; _currentEra = 'atlas'; const h = _browseHeadHtml(_browseHeadShape()); _currentEra = old; const d = document.createElement('tr'); d.innerHTML = h; return Array.from(d.children).filter(th => th.dataset.sort).map(th => th.textContent.trim()); });
  T('G2 the Atlas layout sorts all but Description', atlasHead, ['Mfr.', 'Item #', 'Type', 'Sub Type', 'Track/Power', 'MSRP', 'Year', 'Owned']);
  const mthHead = await pg.evaluate(() => { const old = _currentEra; _currentEra = 'mth_o'; const h = _browseHeadHtml(_browseHeadShape()); _currentEra = old; const d = document.createElement('tr'); d.innerHTML = h; return Array.from(d.children).filter(th => th.dataset.sort).map(th => th.textContent.trim()); });
  T('G3 the MTH layout sorts all but Descr.', mthHead, ['Mfr.', 'Item #', 'Type', 'Road / Name', 'Category', 'Track/Power', 'Year', 'Owned']);

  // ── H: a section table (Science) sorts on the page and keeps it on redraw ──
  const sec = await pg.evaluate(() => {
    const tab = SHEET_TABS.science;
    state.masterData = state.masterData.concat([
      { itemNum: 'A-301', variation: '', itemType: 'Science', description: 'Chemistry', yearProd: '1949', _era: 'pw', _tab: tab },
      { itemNum: 'A-120', variation: '', itemType: 'Science', description: 'Atomic', yearProd: '', _era: 'pw', _tab: tab },
      { itemNum: 'A-999', variation: '', itemType: 'Science', description: 'Biology', yearProd: '1941', _era: 'pw', _tab: tab },
    ]);
    _rebuildMasterIndex();
    renderBrowseTab('science');
    const read = () => Array.from(document.querySelectorAll('#science-tbody tr')).map(tr => tr.cells[0].textContent.trim());
    return { before: read() };
  });
  const clickSec = async (label) => {
    const th = await pg.$$('#browse-science-panel thead th');
    for (const h of th) { const t = (await h.textContent()).replace(/[▲▼]/g, '').trim(); if (t === label) { await h.click(); await pg.waitForTimeout(60); return; } }
  };
  await clickSec('Year');
  const secYear = await pg.evaluate(() => Array.from(document.querySelectorAll('#science-tbody tr')).map(tr => tr.cells[0].textContent.trim()));
  T('H1 Science: Year ▲ — 1941, 1949, the blank year last', secYear, ['A-999', 'A-301', 'A-120']);
  const kept = await pg.evaluate(() => { renderMasterSubTab('science'); return Array.from(document.querySelectorAll('#science-tbody tr')).map(tr => tr.cells[0].textContent.trim()); });
  T('H2 …a redraw (typing in its search box) keeps the order', kept, secYear);
  await clickSec('Description');
  const descClick = await pg.evaluate(() => Array.from(document.querySelectorAll('#science-tbody tr')).map(tr => tr.cells[0].textContent.trim()));
  T('H3 Description does not sort', descClick, secYear);
  await clickSec('Year'); await clickSec('Year');
  const back = await pg.evaluate(() => Array.from(document.querySelectorAll('#science-tbody tr')).map(tr => tr.cells[0].textContent.trim()));
  T('H4 third click: the drawn order again', back, sec.before);
  T('page errors', errs, []);
  await pg.close();

  // ── PLANTED offenders, served as browse.js ──
  // P1: blanks NOT kept last (the plain comparator) — Year ▼ puts the blank first
  const p1 = BROWSE.replace("if (an || bn) return (an && bn) ? a.i - b.i : (an ? 1 : -1);", "if (an || bn) { if (an && bn) return a.i - b.i; return dir === 'desc' ? (an ? -1 : 1) : (an ? 1 : -1); }");
  T('P1 planted source differs', p1 !== BROWSE, true);
  ({ pg } = await openApp(browser, p1));
  await clickHead(pg, 'Year'); await clickHead(pg, 'Year');
  T('P1 planted: blank-first on ▼ is caught', (await pg.evaluate(NUMS))[0], '4');
  await pg.close();
  // P2: the sort applied to the PAGE only (what a DOM sort of the big table would do)
  const p2 = BROWSE.replace("if (_bs && _bsKind) {", "if (false && _bs && _bsKind) {");
  T('P2 planted source differs', p2 !== BROWSE, true);
  ({ pg } = await openApp(browser, p2));
  await clickHead(pg, 'Year');
  T('P2 planted: a header that does not reorder the list is caught', JSON.stringify(await pg.evaluate(NUMS)) !== JSON.stringify(['004', '2343', '6464-1', '1008', '6343', '8359', '4']), true);
  await pg.close();
  // P3: description made sortable again
  const p3 = BROWSE.replace("{ k: 'p5', l: 'Descr.', st: 'width:60%' }", "{ k: 'p5', l: 'Descr.', kind: 'text', st: 'width:60%' }");
  T('P3 planted source differs', p3 !== BROWSE, true);
  ({ pg } = await openApp(browser, p3));
  const h3 = await pg.evaluate(() => Array.from(document.querySelectorAll('#browse-items-panel .item-table thead th')).filter(th => th.dataset.sort).map(th => th.textContent.trim()));
  T('P3 planted: a sortable Descr. is caught', h3.includes('Descr.'), true);
  await pg.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
