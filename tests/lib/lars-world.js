// ══ tests/lib/lars-world.js — Lars's collection shape (report #26), a stand-in ══
//
// "The Rail Roster - Lars's Collection", tab My Collection, 2026-10-31: the
// header said 54 items, the list drew 48. The six missing were all on the sheet,
// each saved WITH a variation but linked (Master Row ID + Master Key) to the
// catalog row of a DIFFERENT variation:
//
//   2613 Pullman     (inv 114)  var B  → Pre-War row 2542, blank   prewar|2613|
//   2614 Observation (inv 115)  var B  → row 2547, blank            prewar|2614|
//   2615 Baggage     (inv 116)  var B  → row 2552, blank            prewar|2615|
//   2955 Sunoco tank (inv 135)  var B  → row 2746, blank            prewar|2955|
//   656  Cattle car  (inv 139)  var C  → row 1637, blank            prewar|656|
//   1656 0-4-0       (inv 138)  var 2  → PW row 364, var "1"        pw|1656|1
//
// Their saved Row IDs are the real ones from his sheet. The rows of their OWN
// variations carry stand-in IDs (V-…). The other 48 owned items are fillers
// whose link agrees with their variation (blank on blank, A on A) — as every
// item of his that DID show. Plus two shapes the repair must leave alone:
// a variation the catalog does not list (2620 var Z) and one listed twice in
// the same catalog (800 var C, two products). Those two are NOT in the 54 —
// `withExtras` adds them (then the collection holds 56).
//
// Used inside page.evaluate: this file exports the SOURCE of a function that
// is run in the page (`(${LARS_WORLD})(opts)`), so the stand-in is built by
// the real app's own index builder (_rebuildMasterIndex).
'use strict';

const LARS_SIX = [
  { inv: '114', num: '2613', v: 'B', era: 'prewar', savedId: '6QEMFSBQZM', savedKey: 'prewar|2613|', ownId: 'V2613BBBBB' },
  { inv: '115', num: '2614', v: 'B', era: 'prewar', savedId: 'KANCSBWPF7', savedKey: 'prewar|2614|', ownId: 'V2614BBBBB' },
  { inv: '116', num: '2615', v: 'B', era: 'prewar', savedId: 'FAFB7TUF97', savedKey: 'prewar|2615|', ownId: 'V2615BBBBB' },
  { inv: '135', num: '2955', v: 'B', era: 'prewar', savedId: 'UJP8SWRREE', savedKey: 'prewar|2955|', ownId: 'V2955BBBBB' },
  { inv: '139', num: '656',  v: 'C', era: 'prewar', savedId: 'P7X9HHPEUM', savedKey: 'prewar|656|',  ownId: 'V0656CCCCC' },
  { inv: '138', num: '1656', v: '2', era: 'pw',     savedId: 'SE69DF5XU3', savedKey: 'pw|1656|1',    ownId: 'V1656P2222' },
];

// Runs IN THE PAGE. opts: { withExtras, ownRows (default true: the catalog lists
// each variation's own row) }. Returns { six: [inventoryId…], counted }.
const LARS_WORLD = function (opts) {
  opts = opts || {};
  const SIX = opts.six;
  const PRE = 'Lionel Pre-War', PW = 'Lionel PW - Items';
  const mk = (n, v, t, desc, era, tab, id, x) => Object.assign({ itemNum: n, variation: v, itemType: t, description: desc, _era: era, _tab: tab, rowId: id, yearProd: era === 'pw' ? '1950' : '1930', roadName: '', gauge: 'O', varDesc: '' }, x || {});
  const md = [];
  const baseDesc = { '2613': 'Pullman', '2614': 'Observation', '2615': 'Baggage', '2955': 'Sunoco Tank Car', '656': 'Cattle Car', '1656': '0-4-0 Switcher' };
  SIX.forEach(s => {
    const tab = s.era === 'pw' ? PW : PRE;
    const plainV = s.num === '1656' ? '1' : '';
    md.push(mk(s.num, plainV, s.num === '1656' ? 'Steam Locomotive' : 'Passenger Car', baseDesc[s.num], s.era, tab, s.savedId));
    if (opts.ownRows !== false) md.push(mk(s.num, s.v, s.num === '1656' ? 'Steam Locomotive' : 'Passenger Car', baseDesc[s.num] + ' (var ' + s.v + ')', s.era, tab, s.ownId));
  });
  // a Postwar 2613 B exists too — another catalog; the Pre-War copy must never move there
  md.push(mk('2613', 'B', 'Passenger Car', 'Postwar lookalike', 'pw', PW, 'PWX2613BBB'));
  // 48 fillers: 40 blank on blank, 8 "A" on their own "A" row
  for (let i = 0; i < 48; i++) {
    const n = String(3000 + i), v = i < 40 ? '' : 'A';
    md.push(mk(n, '', 'Boxcar', 'Filler ' + n, 'prewar', PRE, 'F' + n + 'XXXXX'));
    if (v) md.push(mk(n, 'A', 'Boxcar', 'Filler ' + n + ' A', 'prewar', PRE, 'F' + n + 'AAAAA'));
  }
  // the two shapes the repair must leave alone
  md.push(mk('2620', '', 'Passenger Car', 'Observation', 'prewar', PRE, 'P2620XXXXX'));                 // no "Z" row anywhere
  md.push(mk('800', '', 'Boxcar', 'Box Car', 'prewar', PRE, 'P0800XXXXX'));
  md.push(mk('800', 'C', 'Boxcar', 'Box Car C (1915)', 'prewar', PRE, 'P0800C1915'));
  md.push(mk('800', 'C', 'Boxcar', 'Box Car C (1927)', 'prewar', PRE, 'P0800C1927'));                  // C twice: ambiguous
  state.masterData = md;
  _rebuildMasterIndex();
  state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
  try { window._allIdxComplete = true; _allIdxComplete = true; } catch (e) {}
  let row = 3;
  const pd = (n, v, era, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel', inventoryId: inv, row: row++, condition: '7', priceItem: '125.00', userEstWorth: '200', notes: 'SECRET-NOTE-' + inv, location: 'SHELF-' + inv, photoItem: 'https://drive.google.com/drive/folders/SECRET' + inv }, x || {});
  state.personalData = {};
  for (let i = 0; i < 48; i++) {
    const n = String(3000 + i), v = i < 40 ? '' : 'A';
    const id = 'F' + n + (v ? 'AAAAA' : 'XXXXX');
    state.personalData['F' + i] = pd(n, v, 'prewar', String(1 + i), { masterRowId: id, masterKey: 'prewar|' + n + '|' + v });
  }
  SIX.forEach(s => { state.personalData['L' + s.inv] = pd(s.num, s.v, s.era, s.inv, { masterRowId: s.savedId, masterKey: s.savedKey }); });
  if (opts.withExtras) {
    state.personalData.X1 = pd('2620', 'Z', 'prewar', '901', { masterRowId: 'P2620XXXXX', masterKey: 'prewar|2620|' });
    state.personalData.X2 = pd('800', 'C', 'prewar', '902', { masterRowId: 'P0800XXXXX', masterKey: 'prewar|800|' });
  }
  state.soldData = {}; state.wantData = state.wantData || {}; state.forSaleData = {}; state.isData = {}; state.mySetsData = {};
  state.personalSheetId = 'SID'; try { window.accessToken = 'tok'; accessToken = 'tok'; } catch (e) {}
  return { six: SIX.map(s => s.inv), counted: _ownedNonBox(state).length };
};

// Puts the page on My Collection, every filter clear (as Lars's own list).
const OPEN_COLLECTION = function (opts) {
  opts = opts || {};
  _currentEra = opts.era || 'all';
  const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-browse').classList.add('active');
  localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
  state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = ''; state.filters.search = '';
  window.__rrBvByNum = null; window.__rrMasterNums = null; window._rrBrowseSig = null;
  filterOwned();
  window._rrBrowseSig = null; renderBrowse();
  return (state.filteredData || []).length;
};

// Boots the REAL app (file://, nothing from the network), optionally serving a
// planted copy of one app file: planted = { 'browse.js': text }.
async function bootApp(browser, planted, viewport) {
  const path = require('path');
  const APP = path.join(__dirname, '..', '..', 'app');
  const pg = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    for (const f of Object.keys(planted || {})) if (bare.endsWith('/app/' + f)) return r.fulfill({ body: planted[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return { pg, errs };
}
async function launch() {
  const fs = require('fs');
  const { chromium } = require('playwright');
  const ex = '/opt/pw-browsers/chromium';
  return chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
}

module.exports = { LARS_SIX, LARS_WORLD: LARS_WORLD.toString(), OPEN_COLLECTION: OPEN_COLLECTION.toString(), bootApp, launch };
