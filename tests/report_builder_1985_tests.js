#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// BUILD A REPORT, REBUILT — v0.9.1985 (real Chromium, REAL reports.js,
// report-library.js, config.js, app.css)
//
// Brad, 2026-10-18: "lets clean up the build a report set up screen. may on
// the columns screen, two rows of columns maybe. also, we need to have the
// custom columns that a user can set up here too. filters, this is crazy, we
// need item types to somehow do like boxcars, then do the sub types … also we
// are missing eras like postwar, then things like cataglogs, drawings, mock
// ups etc." Told the plan (Release 1: Columns + Filters + saved reports that
// follow the account) — "yes".
//
//   C1  his laptop (1536x737): the columns are in labeled groups, two to a row
//   C2  a custom column he named ("Purchase Lot") is offered under his name in
//       "Your own fields"; Location Detail with Location; Maker / Era / Road
//       Name are columns now
//   C3  ticking columns: the report's order is the order they were ticked
//   F1  Section offers every section he OWNS — Trains, Catalogs, Mock-Ups,
//       Paper Items (an old-style paper tab), Instruction Sheets, Science Sets
//       — with the right counts
//   F2  Era: Pre-war / Postwar / Modern with counts; the year boxes take any
//       year (1931, 2010 — the old ones stopped at 1945–1969)
//   F3  Type offers only types he owns (not every Type word in the catalog)
//   F4  Sub-type appears once a Type is picked: Boxcar → "Operating Boxcar"
//   F5  every count is what picking it would give; the live "N items match"
//       follows every pick, at the top and in the footer
//   S1  a saved report goes through the settings door (stamped, so it follows
//       the account) and comes back on the next visit to Reports
//   S2  a fresh visit then a second save KEEPS the first report (the old code
//       started every visit with an empty list and wrote over them)
//   S3  two devices' reports are combined by id the first time they meet
//   R1  running it: a Catalogs-only report holds the catalog, with the custom
//       column under its own name; money totals use the currency sign
//   R2  a report saved by an older release (raw Type words) still runs the
//       same; opened, its pick shows as the Boxcar chip
//   M1  a phone: the groups stack, nothing runs off the side
//   P   PLANTED: the shipped v0.9.1984 reports.js (git 28176a85) has no groups,
//       no custom column and no Section chips — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  report_builder_1985_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let OLDREP = null;
try { OLDREP = cp.execSync('git show 28176a85:app/reports.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}

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

const R = `const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; };`;

const readColumns = (pg) => pg.evaluate(new Function(`return (async () => { ${R}
  const S = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById('rb-overlay')?.remove();
  openReportBuilder(null); await S(250);
  const groups = [...document.querySelectorAll('.rb-colgroup')].map(g => ({
    id: g.getAttribute('data-rb-group'), title: (g.querySelector('.rb-colgroup-title') || {}).textContent || '', box: R(g),
    cols: [...g.querySelectorAll('.rb-colpick')].map(l => ({ key: l.getAttribute('data-rb-col'), label: l.textContent.trim(), on: !!l.querySelector('input').checked })),
  }));
  const allLabels = [...document.querySelectorAll('#rb-body label')].map(l => l.textContent.trim());
  const body = document.getElementById('rb-body');
  return { groups, allLabels, side: body.scrollWidth - body.clientWidth, pageSide: document.documentElement.scrollWidth - innerWidth };
})()`));

const readFilters = (pg) => pg.evaluate(() => {
  const facets = {};
  document.querySelectorAll('[data-rb-facet]').forEach(f => {
    const id = f.getAttribute('data-rb-facet');
    facets[id] = [...f.querySelectorAll('[data-rb-facet-chip]')].map(c => ({ v: c.getAttribute('data-rb-val'), n: parseInt((c.querySelector('.rb-chip-n') || {}).textContent.replace(/,/g, ''), 10), on: c.classList.contains('selected') }));
    if (!facets[id].length) facets[id] = (f.textContent || '').trim();
  });
  return { facets, top: (document.getElementById('rb-match-top') || {}).textContent || '', foot: (document.getElementById('rb-match-foot') || {}).textContent || '' };
});
const chip = (pg, facet, v) => pg.evaluate(([facet, v]) => {
  const el = [...document.querySelectorAll('[data-rb-facet-chip="' + facet + '"]')].find(c => c.getAttribute('data-rb-val') === v);
  if (el) el.click(); return !!el;
}, [facet, v]);
const countOf = (list, v) => { const c = Array.isArray(list) ? list.find(x => x.v === v) : null; return c ? c.n : null; };

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── C1–C3 columns, his laptop ────────────────────────────────────────────
  let r = await open(browser, { w: 1536, h: 737 });
  let c = await readColumns(r.pg);
  const gid = c.groups.map(g => g.id);
  T('C1 the columns are in labeled groups (The item, Condition, Money, Where it is, Your own fields, Photos & notes)',
    ['item', 'cond', 'money', 'where', 'own', 'notes'].every(id => gid.includes(id)) && c.groups.every(g => g.title.trim() && g.cols.length), c.groups.map(g => g.id + ':' + g.title + ':' + g.cols.length));
  const g0 = c.groups[0], g1 = c.groups[1];
  T('C1 two to a row on his laptop (the first two groups side by side)', g0 && g1 && Math.abs(g0.box.t - g1.box.t) < 4 && g0.box.r <= g1.box.l, c.groups.map(g => g.box));
  T('C1 nothing runs off the side', c.side <= 0 && c.pageSide <= 0, { side: c.side, page: c.pageSide });
  const own = c.groups.find(g => g.id === 'own'), where = c.groups.find(g => g.id === 'where'), item = c.groups.find(g => g.id === 'item');
  T('C2 his named column "Purchase Lot" is offered under his name in "Your own fields"', own && own.cols.some(x => x.key === 'custom1' && x.label === 'Purchase Lot'), own && own.cols);
  T('C2 Location Detail sits with Location in "Where it is"', where && where.cols.some(x => x.key === 'location') && where.cols.some(x => x.key === 'locationDetail'), where && where.cols);
  T('C2 Maker, Era, Section and Road Name are columns now', item && ['manufacturer', 'eraPeriod', 'section', 'roadName'].every(k => item.cols.some(x => x.key === k)), item && item.cols.map(x => x.key));
  T('C2 an unnamed, switched-off spare column (Custom 2) is not offered', !c.groups.some(g => g.cols.some(x => x.key === 'custom2')), c.allLabels);
  const order = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const tick = k => { const b = document.querySelector('[data-rb-colbox="' + k + '"]'); b.click(); };
    tick('custom1'); await S(30); tick('manufacturer'); await S(30); tick('yearMade'); await S(30);   // yearMade was on: now off
    return { order: _rbEnabledOrder(), line: document.getElementById('rb-colorder').textContent };
  });
  T('C3 the report\'s order is the order the columns were ticked (Purchase Lot, then Maker, at the end; Year Made gone)',
    order.order.slice(-2).join() === 'custom1,manufacturer' && order.order.indexOf('yearMade') < 0 && /Purchase Lot/.test(order.line), order);

  // ── F1–F5 filters ────────────────────────────────────────────────────────
  await r.pg.evaluate(() => _rbShowTab('filters'));
  let f = await readFilters(r.pg);
  T('F1 Section: Trains 6, Catalogs 1, Mock-Ups 1, Paper Items 1, Instruction Sheets 1, Science Sets 1 (the loose box is not a row)',
    countOf(f.facets.section, 'Trains') === 6 && countOf(f.facets.section, 'Catalogs') === 1 && countOf(f.facets.section, 'Mock-Ups') === 1
    && countOf(f.facets.section, 'Paper Items') === 1 && countOf(f.facets.section, 'Instruction Sheets') === 1 && countOf(f.facets.section, 'Science Sets') === 1,
    f.facets.section);
  T('F2 Era: Pre-war, Postwar and Modern, with counts (259E pre-war; 2018 SD40T-2 modern)',
    countOf(f.facets.era, 'Pre-war') === 1 && countOf(f.facets.era, 'Modern') === 1 && countOf(f.facets.era, 'Postwar') >= 6, f.facets.era);
  const types = Array.isArray(f.facets.type) ? f.facets.type.map(x => x.v) : [];
  T('F3 Type offers only what he owns — Boxcar, Diesel, Steam … — never the catalog\'s Trolley or Vat Car',
    types.includes('Boxcar') && types.includes('Diesel Locomotive') && types.includes('Steam Locomotive') && !types.includes('Trolley') && !types.includes('Vat Car'), types);
  T('F4 Sub-type waits for a Type', typeof f.facets.sub === 'string' && /Pick a Type/.test(f.facets.sub), f.facets.sub);
  T('F5 with nothing picked: "All 11 of your items"', /^All 11 of your items$/.test(f.top) && f.foot === f.top, f);
  await chip(r.pg, 'type', 'Boxcar');
  f = await readFilters(r.pg);
  T('F4 Boxcar picked: its sub-types are offered — Operating Boxcar (the catalog\'s sub type) 1, Refrigerator Car (the catalog\'s Type word) 1; the plain boxcar has none',
    Array.isArray(f.facets.sub) && countOf(f.facets.sub, 'Operating Boxcar') === 1 && countOf(f.facets.sub, 'Refrigerator Car') === 1 && f.facets.sub.length === 2, f.facets.sub);
  T('F5 Boxcar picked: "3 of your 11 items match", top and footer', /^3 of your 11 items match$/.test(f.top) && f.foot === f.top, f);
  T('F5 the Section counts follow the Type pick (Trains 3), and Type keeps its own counts (Diesel still 2)',
    countOf(f.facets.section, 'Trains') === 3 && countOf(f.facets.type, 'Diesel Locomotive') === 2, { s: f.facets.section, t: f.facets.type });
  await chip(r.pg, 'sub', 'Operating Boxcar');
  f = await readFilters(r.pg);
  T('F5 Operating Boxcar picked: 1 match', /^1 of your 11 items match$/.test(f.top), f.top);
  await chip(r.pg, 'type', 'Boxcar');   // un-pick the type: the sub-type goes with it
  f = await readFilters(r.pg);
  T('F4 un-picking the Type lets the sub-type go too', !(await r.pg.evaluate(() => _rbState.filters.sub)) && /^All 11/.test(f.top), f.top);
  await chip(r.pg, 'type', 'Catalog');
  f = await readFilters(r.pg);
  T('F4 the other sections read the same way: Type Catalog → Sub-type Consumer', Array.isArray(f.facets.sub) && countOf(f.facets.sub, 'Consumer') === 1, f.facets.sub);
  T('F3 every section\'s kind is a Type (Catalog, Mock-Up, Paper Item, Instruction Sheet, Science Set)',
    ['Catalog', 'Mock-Up', 'Paper Item', 'Instruction Sheet', 'Science Set'].every(t => countOf(f.facets.type, t) === 1), f.facets.type);
  await chip(r.pg, 'type', 'Catalog');
  const yr = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const set = (k, v) => { const i = document.querySelector('[data-rb-range="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
    const ph = [document.querySelector('[data-rb-range="yearMin"]').placeholder, document.querySelector('[data-rb-range="yearMax"]').placeholder];
    set('yearMin', '1931'); set('yearMax', '1949'); await S(30);
    const a = document.getElementById('rb-match-top').textContent;
    set('yearMin', '2010'); set('yearMax', ''); await S(30);
    const b = document.getElementById('rb-match-top').textContent;
    set('yearMin', ''); await S(30);
    return { ph, a, b, max: document.querySelector('[data-rb-range="yearMax"]').getAttribute('max') };
  });
  T('F2 the year boxes take any year: 1931–1949 finds the 259E and the 1948 chemistry set (2); 2010 on finds the 2018 diesel (1)',
    /^2 of your 11/.test(yr.a) && /^1 of your 11/.test(yr.b) && !yr.max, yr);
  T('F2 the year boxes show the span he owns (1932 to 2018) as their hints', yr.ph[0] === '1932' && yr.ph[1] === '2018', yr.ph);

  // ── S1–S2 saving ─────────────────────────────────────────────────────────
  const s1 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    showPage('reports'); await S(150);
    _rbState.filters = {}; _rbToggleFacet('section', 'Catalogs');
    document.getElementById('rb-name').value = 'Catalogs only';
    _rbSave(); await S(200);
    const stored = JSON.parse(localStorage.getItem('lv_saved_reports') || '[]');
    return { stored: stored.map(x => x.name), stamped: localStorage.getItem('lv_saved_reports__at') > 0, overlay: !!document.getElementById('rb-overlay') };
  });
  T('S1 saved through the settings door: stored AND stamped (so it follows the account)', s1.stored.join() === 'Catalogs only' && s1.stamped && !s1.overlay, s1);
  const s2 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    state.savedReports = undefined;                 // a fresh start of the app
    renderReportLibrary(); await S(50);
    const listed = [...document.querySelectorAll('#report-library [id^="rep-preview-custom:"]')].length;
    state.savedReports = undefined;                 // and again, then a SECOND report saved straight away
    openReportBuilder(null); await S(150);
    document.getElementById('rb-name').value = 'Everything';
    _rbSave(); await S(200);
    return { listed, stored: JSON.parse(localStorage.getItem('lv_saved_reports') || '[]').map(x => x.name) };
  });
  T('S1 a fresh visit to Reports lists the saved report', s2.listed === 1, s2);
  T('S2 saving a second report after a fresh start KEEPS the first', s2.stored.join('|') === 'Catalogs only|Everything', s2.stored);

  // ── R1 running it ────────────────────────────────────────────────────────
  const r1 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const def = _rbReadSaved().find(x => x.name === 'Catalogs only');
    def.colEnabled.custom1 = true; def.colOrder.push('custom1');
    buildCustomReport(def); await S(50);
    const heads = [...document.querySelectorAll('#report-thead th')].map(t => t.textContent);
    const rows = [...document.querySelectorAll('#report-tbody tr')].map(t => [...t.cells].map(td => td.textContent));
    const all = _rbGetItems({ filters: {}, sort: [{ field: 'userEstWorth', dir: 'desc' }] }).map(x => x.pd.itemNum);
    return { heads, rows, all };
  });
  T('R1 a Catalogs-only report holds the 1955 catalog and nothing else', r1.rows.length === 2 && r1.rows[0][0] === 'CAT-1955' && /items$/.test(r1.rows[1][0]), r1.rows);
  T('R1 his own column is headed with his name ("Purchase Lot")', r1.heads.includes('Purchase Lot'), r1.heads);
  T('R1 a report with no filters holds every tab\'s rows (11), worth high → low (mock-up $900 first)', r1.all.length === 11 && r1.all[0] === 'MU-1', r1.all);

  // ── R2 an older saved report ─────────────────────────────────────────────
  const r2 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const old = { id: 'rpt_old', name: 'Old boxcars', colOrder: ['itemNum', 'description'], colEnabled: { itemNum: true, description: true }, filters: { itemType: ['Boxcar'] }, sort: [] };
    const ran = _rbGetItems(old).map(x => x.pd.itemNum);
    const list = _rbReadSaved(); list.push(old); _rbWriteSaved(list);
    openReportBuilder('rpt_old'); await S(150); _rbShowTab('filters'); await S(30);
    const on = [...document.querySelectorAll('[data-rb-facet-chip="type"].selected')].map(c => c.getAttribute('data-rb-val'));
    _rbCloseOverlay();
    return { ran, on };
  });
  T('R2 a report saved by an older release (Type word "Boxcar") still runs exactly as before (the two rows typed Boxcar; the reefer is typed Refrigerator Car)', r2.ran.join() === '3494-1,6464-1', r2.ran);
  T('R2 opened, its pick shows as the Boxcar chip', r2.on.join() === 'Boxcar', r2.on);

  // ── S3 two devices ───────────────────────────────────────────────────────
  const s3 = await r.pg.evaluate(() => {
    const a = JSON.stringify([{ id: 'a1', name: 'Account one' }, { id: 'x', name: 'Shared (account copy)' }]);
    const d = JSON.stringify([{ id: 'x', name: 'Shared (device copy)' }, { id: 'd1', name: 'Device one' }]);
    return { both: JSON.parse(window.RR_PREF_UNION.lv_saved_reports(a, d)).map(r => r.name), hasKey: typeof window.RR_PREF_UNION.lv_saved_locations === 'function' };
  });
  T('S3 two devices\' reports are combined by id the first time they meet (the account\'s copy of a shared one stands)',
    s3.both.join('|') === 'Account one|Shared (account copy)|Device one' && s3.hasKey, s3);
  T('page errors (laptop)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── M1 a phone ───────────────────────────────────────────────────────────
  r = await open(browser, { w: 390, h: 844, mobile: true });
  c = await readColumns(r.pg);
  T('M1 a phone: the groups stack (the second group under the first) and nothing runs off the side',
    c.groups.length >= 5 && c.groups[1].box.t >= c.groups[0].box.b - 1 && c.side <= 0 && c.pageSide <= 0, { boxes: c.groups.map(g => g.box), side: c.side, page: c.pageSide });
  await r.pg.evaluate(() => _rbShowTab('filters'));
  const mside = await r.pg.evaluate(() => { const b = document.getElementById('rb-body'); return b.scrollWidth - b.clientWidth; });
  T('M1 the Filters tab fits the phone\'s width', mside <= 0, mside);
  T('page errors (phone)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── P planted: the shipped v0.9.1984 reports.js ─────────────────────────
  if (!OLDREP) T('P0 the v0.9.1984 reports.js could be read from git (28176a85)', false, 'git show failed');
  else {
    r = await open(browser, { w: 1536, h: 737, rep: OLDREP });
    c = await readColumns(r.pg);
    T('P1 PLANTED: v0.9.1984 has no column groups', c.groups.length === 0, c.groups.length);
    T('P2 PLANTED: v0.9.1984 does not offer his "Purchase Lot" column', !c.allLabels.includes('Purchase Lot'), c.allLabels);
    await r.pg.evaluate(() => _rbShowTab('filters'));
    f = await readFilters(r.pg);
    T('P3 PLANTED: v0.9.1984 has no Section chips', !f.facets.section, Object.keys(f.facets));
    await r.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
