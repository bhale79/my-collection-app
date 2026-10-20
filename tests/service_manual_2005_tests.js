// ═══════════════════════════════════════════════════════════════
// service_manual_2005_tests.js — v0.9.2005. THE SERVICE MANUAL CHECKLIST.
//
// [stated] Brad, 2026-10-20: "i meant making the service manuals collectible"
// → "tick the page checklist" → "yes their own tab" → no scans.
//
// The REAL app/service-manual.js runs in a Node sandbox with the Sheets /
// screen calls stood in (each stand-in named below), against the REAL
// RR_SERVICE_MANUAL / SERVICE_MANUAL_TAB sliced out of config.js. Asserted:
//   A  the master list is read BY HEADER NAME (columns in any order)
//   B  the collector's tab is read by Sheet ID, blank (removed) rows skipped
//   C  a ticked page's row: one cell per heading, date-like text kept as text
//   D  grouping + counts + search (an item number is a WHOLE number)
//   E  tick / double-tap / already ticked elsewhere / untick (asks first,
//      removes through rrRemoveRowConfirmed by Sheet ID) / a refused removal
//   F  the tab is registered as a feature tab; browse.js types no key of its own
//   G  wiring: the panel, the script, the offline copy, the photo folder
// Every rule is shown able to fail on a planted offender.
// Run:  node tests/service_manual_2005_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const CFG = rd('config.js'), SM = rd('service-manual.js'), BROWSE = rd('browse.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// the literal `const NAME = {...};` / `const NAME = '...';` out of config.js
function constSrc(src, name) {
  const i = src.indexOf('const ' + name + ' = ');
  if (i < 0) throw new Error('config.js has no ' + name);
  const j = src.indexOf(src[i + ('const ' + name + ' = ').length] === '{' ? '\n};' : ';', i);
  return src.slice(i, j + (src[i + ('const ' + name + ' = ').length] === '{' ? 3 : 1));
}

// A fresh sandbox: the real file + stand-ins. `mine` is the collector's tab
// from row 3 (an array of rows), `master` the master tab's values.
function sandbox(opts) {
  opts = opts || {};
  const log = [];
  const ctx = {
    console: { log() {}, warn() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    Date, JSON, Promise, RegExp, String, Object, Array, setTimeout, clearTimeout,
    registered: [],
    mine: opts.mine || [],
    master: opts.master || [],
    confirmAnswer: opts.confirm !== undefined ? opts.confirm : true,
    removeAnswer: opts.remove !== undefined ? opts.remove : true,
    state: { masterSheetId: 'MASTER', personalSheetId: opts.signedOut ? '' : 'MINE', filters: {} },
    accessToken: 'tok',
    log: log,
  };
  ctx.window = ctx;
  // rrFeatureTab — records what the file registers
  ctx.rrFeatureTab = function (n) { ctx.registered.push(n); return n; };
  // sheetsGet — the master list, or the collector's rows from row 3
  ctx.sheetsGet = async function (sid, range) {
    log.push('get ' + range);
    await null;
    if (sid === 'MASTER') return { values: ctx.master };
    return { values: ctx.mine.map(r => r.slice()) };
  };
  // fetch — the tab-exists check (the tab is there) and anything else
  ctx.fetch = async function (u) { log.push('fetch'); return { json: async () => ({ sheets: [{ properties: { title: 'Service Manual' } }] }) }; };
  ctx.sheetsUpdate = async function (sid, range) { log.push('update ' + range); return {}; };
  // sheetsAppend — slow on purpose, so a second tap lands while the first is in flight
  ctx.sheetsAppend = async function (sid, range, values) {
    log.push('append ' + range);
    await new Promise(r => setTimeout(r, 20));
    ctx.mine.push(values[0].map(v => String(v).replace(/^'/, '')));
    return 2 + ctx.mine.length;
  };
  // rrRemoveRowConfirmed — the real one archives then blanks; here: blank, or refuse
  ctx.rrRemoveRowConfirmed = async function (sid, tab, row, range, blanks, expect) {
    log.push('remove ' + tab + ' ' + range + ' ' + expect.num);
    if (!ctx.removeAnswer) return false;
    ctx.mine[row - 3] = [];
    return true;
  };
  ctx.rrVerifiedRowUpdate = async function () { log.push('verified'); return true; };
  ctx.appConfirm = async function () { log.push('confirm'); return ctx.confirmAnswer; };
  ctx.showToast = function (m) { log.push('toast ' + m); };
  vm.createContext(ctx);
  vm.runInContext(constSrc(CFG, 'SERVICE_MANUAL_TAB') + '\n' + constSrc(CFG, 'RR_SERVICE_MANUAL') + '\n' +
    'var CATALOG_REFRESH_MAX_AGE_DAYS = 7;\nwindow.RR_SERVICE_MANUAL = RR_SERVICE_MANUAL;\n' + SM, ctx, { filename: 'service-manual.js' });
  return ctx;
}

const HDR = ['Sheet ID', 'Category', 'Section', 'Page', 'Date printed', 'Page type', 'Front & back', 'Replaces', 'Covers items', 'Notes', 'Scan link'];
const MASTER = [HDR,
  ['SM-0204', 'Locomotives', 'LOC 646', 'PL', '10-59', 'Parts list', 'yes', '', '646, 2046', '', 'https://drive.google.com/x'],
  ['SM-0205', 'Locomotives', 'LOC 646', 'PL page 2', '10-59', 'Parts list', '', '', '646', '', ''],
  ['SM-0300', 'Locomotives', 'LOC 6464', 'PL', '1-60', 'Parts list', '', '', '6464', '', ''],
  ['SM-0900', 'ACCESSORIES', 'ACC 151', 'p1', '11-58', '', '', '', '151', '', ''],
  ['Category heading', '', '', '', '', '', '', '', '', '', ''],
  ['SM-0204', 'Locomotives', 'LOC 646', 'a repeat', '', '', '', '', '', '', ''],
];

(async function () {
  // ── A ──
  section('A · the master list, read by header name');
  {
    const c = sandbox();
    const pages = c.rrSmParseMaster(MASTER);
    ok('A1 four pages (a heading line and a repeated ID are not pages)', pages.length === 4, pages.map(p => p.id));
    ok('A2 fields land by heading', pages[0].sec === 'LOC 646' && pages[0].dt === '10-59' && pages[0].cov === '646, 2046' && pages[0].fb === 'yes', pages[0]);
    const shuffled = MASTER.map(r => [r[2], r[0], r[8], r[1], r[4], r[3]]);
    const p2 = c.rrSmParseMaster(shuffled);
    ok('A3 the same pages with the columns in another order', p2.length === 4 && p2[0].id === 'SM-0204' && p2[0].sec === 'LOC 646' && p2[0].cov === '646, 2046', p2[0]);
    ok('A4 the scan link is never carried (Brad: no scans)', !('u' in pages[0]) && JSON.stringify(pages).indexOf('drive.google') < 0);
    const planted = MASTER.map((r, i) => i === 0 ? r.map(h => h === 'Section' ? 'Sect' : h) : r);
    ok('A5 PLANTED: a tab without a Section heading shows nothing rather than guessing', c.rrSmParseMaster(planted).length === 0);
  }

  // ── B ──
  section('B · the collector\'s tab, by Sheet ID');
  {
    const c = sandbox();
    const owned = c.rrSmParseOwned([['SM-0204', 'Locomotives', 'LOC 646', 'PL', '10-59', 'Good', 'n', 'link', '646', '2026-10-20'], [], ['SM-0900', 'ACCESSORIES']], 3);
    ok('B1 two pages, the blank (removed) row skipped', Object.keys(owned).length === 2, Object.keys(owned));
    ok('B2 each page knows its sheet row (3 and 5)', owned['SM-0204'].row === 3 && owned['SM-0900'].row === 5, [owned['SM-0204'].row, owned['SM-0900'].row]);
    ok('B3 condition / notes / photo read back', owned['SM-0204'].cond === 'Good' && owned['SM-0204'].notes === 'n' && owned['SM-0204'].photo === 'link');
  }

  // ── C ──
  section('C · the row a ticked page writes');
  {
    const c = sandbox();
    const pages = c.rrSmParseMaster(MASTER);
    const row = c.rrSmRowFor(pages[0], '2026-10-20');
    ok('C1 one cell per heading (' + c.RR_SERVICE_MANUAL.MY_HEADERS.length + ')', row.length === c.RR_SERVICE_MANUAL.MY_HEADERS.length, row);
    ok('C2 the Sheet ID first — the page\'s identity', row[0] === 'SM-0204');
    ok('C3 "10-59", the page and the date added go in as TEXT (Sheets would turn them into dates)', row[4] === "'10-59" && row[3] === "'PL" && row[9] === "'2026-10-20", row);
    ok('C4 condition / notes / photo start empty', row[5] === '' && row[6] === '' && row[7] === '');
  }

  // ── D ──
  section('D · grouping, counts and search');
  {
    const c = sandbox();
    const pages = c.rrSmParseMaster(MASTER);
    const owned = { 'SM-0204': { id: 'SM-0204' } };
    const g = c.rrSmGroups(pages, owned, '', false);
    ok('D1 categories in the master\'s order', g.map(x => x.cat).join('|') === 'Locomotives|ACCESSORIES', g.map(x => x.cat));
    ok('D2 Locomotives: 1 of 3 owned; LOC 646: 1 of 2', g[0].owned === 1 && g[0].total === 3 && g[0].sections[0].owned === 1 && g[0].sections[0].total === 2);
    const mine = c.rrSmGroups(pages, owned, '', true);
    ok('D3 "Pages I own" shows only the ticked page', mine.length === 1 && mine[0].sections.length === 1 && mine[0].sections[0].pages.length === 1 && mine[0].sections[0].pages[0].id === 'SM-0204');
    ok('D4 …and its count is still of the whole section (1 of 2)', mine[0].sections[0].total === 2);
    const s646 = c.rrSmGroups(pages, owned, '646', false);
    const ids = [].concat.apply([], s646.map(x => [].concat.apply([], x.sections.map(s => s.pages.map(p => p.id)))));
    ok('D5 searching 646 finds the 646 pages, not 6464\'s', ids.join('|') === 'SM-0204|SM-0205', ids);
    // planted: the plain "contains" search this replaced
    const naive = pages.filter(p => (p.sec + ' ' + p.cov).toLowerCase().indexOf('646') >= 0).map(p => p.id);
    ok('D6 PLANTED: a plain "contains" search would have dragged 6464 in', naive.indexOf('SM-0300') >= 0);
    const word = c.rrSmGroups(pages, owned, 'acc 151', false);
    ok('D7 words search anywhere in the line', word.length === 1 && word[0].sections[0].pages[0].id === 'SM-0900');
  }

  // ── E ──
  section('E · ticking and unticking');
  {
    const c = sandbox({ master: MASTER });
    await c.rrSmLoadPages(); await c.rrSmLoadOwned(true);
    const r1 = await c.rrSmSetOwned('SM-0204', true);
    ok('E1 a tick writes one row and the page is owned', r1 === true && c.mine.length === 1 && c.mine[0][0] === 'SM-0204' && c.rrSmOwnedCount() === 1, c.log);
    const appendsBefore = c.log.filter(l => l.indexOf('append') === 0).length;
    const both = await Promise.all([c.rrSmSetOwned('SM-0205', true), c.rrSmSetOwned('SM-0205', true)]);
    const appends = c.log.filter(l => l.indexOf('append') === 0).length - appendsBefore;
    ok('E2 two taps at once write ONE row', appends === 1 && c.mine.filter(r => r[0] === 'SM-0205').length === 1, { both, appends });
    // ticked on another device already: the tab holds it, this session does not know
    const c2 = sandbox({ master: MASTER, mine: [['SM-0204', 'Locomotives']] });
    await c2.rrSmLoadPages();
    await c2.rrSmSetOwned('SM-0204', true);
    ok('E3 already on the tab (another device) — no second row', c2.mine.length === 1 && !c2.log.some(l => l.indexOf('append') === 0), c2.log);
    // untick, answer "Keep it"
    const c3 = sandbox({ master: MASTER, mine: [['SM-0204', 'Locomotives'], ['SM-0205', 'Locomotives']], confirm: false });
    await c3.rrSmLoadPages(); await c3.rrSmLoadOwned(true);
    const k = await c3.rrSmSetOwned('SM-0205', false);
    ok('E4 untick asks first — "Keep it" changes nothing', k === false && c3.log.indexOf('confirm') >= 0 && !c3.log.some(l => l.indexOf('remove') === 0) && c3.rrSmOwnedCount() === 2);
    c3.confirmAnswer = true;
    const r3 = await c3.rrSmSetOwned('SM-0205', false);
    const rm = c3.log.filter(l => l.indexOf('remove') === 0);
    ok('E5 "Remove" goes through rrRemoveRowConfirmed for ITS row, checked by Sheet ID', r3 === true && rm.length === 1 && rm[0] === 'remove Service Manual Service Manual!A4:J4 SM-0205', rm);
    ok('E6 …and the page is no longer owned', c3.rrSmOwnedCount() === 1);
    const c4 = sandbox({ master: MASTER, mine: [['SM-0204', 'Locomotives']], remove: false });
    await c4.rrSmLoadPages(); await c4.rrSmLoadOwned(true);
    const r4 = await c4.rrSmSetOwned('SM-0204', false);
    ok('E7 a refused removal leaves the page owned', r4 === false && c4.rrSmOwnedCount() === 1);
    const c5 = sandbox({ master: MASTER, signedOut: true });
    await c5.rrSmLoadPages();
    const r5 = await c5.rrSmSetOwned('SM-0204', true);
    ok('E8 signed out: nothing is written', r5 === false && !c5.log.some(l => l.indexOf('append') === 0));
  }

  // ── F ──
  section('F · the tab is a feature tab; one definition');
  {
    const c = sandbox();
    ok('F1 the file registers its tab (rrFeatureTab) — never a Show chip, never loaded as items', c.registered.indexOf('Service Manual') >= 0, c.registered);
    ok('F2 the registration has the form the feature-tab walk reads', /const SM_MY_TAB = \(typeof rrFeatureTab === 'function' \? rrFeatureTab : String\)\('Service Manual'\);/.test(SM));
    const browseKeys = /'serviceManual'|"serviceManual"|'browse-sm-panel'/.test(BROWSE.replace(/\/\/[^\n]*/g, ''));
    ok('F3 browse.js types no Service Manual key of its own (reads RR_SERVICE_MANUAL)', !browseKeys && (BROWSE.match(/RR_SERVICE_MANUAL\./g) || []).length >= 8);
    const planted = BROWSE + "\nvar x = { serviceManual: 'sm', k: 'serviceManual' };";
    ok('F4 PLANTED: a typed key in browse.js is caught', /'serviceManual'|"serviceManual"|'browse-sm-panel'/.test(planted.replace(/\/\/[^\n]*/g, '')));
    ok('F5 no scan link anywhere in the checklist file', !/scanlink|Scan link|backscan/i.test(SM));
  }

  // ── G ──
  section('G · wiring');
  {
    const idx = rd('index.html'), sw = rd('sw.js');
    const panelId = (CFG.match(/PANEL: '([^']+)'/) || [])[1];
    ok('G1 index.html has the panel config.js names, and its root', !!panelId && idx.indexOf('<div id="' + panelId + '" style="display:none"><div id="sm-root"></div></div>') >= 0, panelId);
    ok('G2 index.html loads service-manual.js after browse.js', idx.indexOf('./service-manual.js?v=') > idx.indexOf('./browse.js?v='));
    ok('G3 the offline copy includes it (sw.js)', /'\.\/service-manual\.js'/.test(sw));
    ok('G4 a page\'s photos go to Paper › Service Manual (SM- numbers)', /SM: 'Service Manual'/.test(CFG) && /'Service Manual': 'Service Manual'/.test(CFG));
    ok('G5 the My Collection chip opens the list (not a filter of the train list)', /key === RR_SERVICE_MANUAL\.BROWSE_TAB && typeof rrSmOpenMine === 'function'\) \{ rrSmOpenMine\(\); return; \}/.test(BROWSE));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
