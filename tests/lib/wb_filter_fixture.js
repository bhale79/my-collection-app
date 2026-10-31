// ═══════════════════════════════════════════════════════════════════════════
// tests/lib/wb_filter_fixture.js — the made-up collection the Workbench filter
// test (workbench_filters_tests.js) loads into the REAL app, in real Chromium.
//
// Every shape that could make the Workbench and My Collection disagree about
// an item's maker, scale, era or type is here once:
//   two copies of one number · a variation the catalog lacks · a copy saved with NO variation (sits on one
//   row) · a copy carrying a Row ID · a -P copy with no catalog row of its own ·
//   an Atlas number that is also a Lionel Pre-War number · a copy with a blank
//   maker cell (the catalog's tab decides) · MTH sold as "Lionel Corporation"
//   (found under either maker) · a two-scale transformer ("Standard & O") ·
//   a Pre-War row with no year · typed-in (Manual) items: one with a maker the
//   catalog does not know, one with a gauge and a year · a paper item whose
//   "number" is a long title (Brad's "Add Up Your 1966 Lionel Profits").
//
// Exported as the SOURCE of one function, run inside the page.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
module.exports = function installFixture() {
  const md = [];
  const TAB = { pw: 'Lionel PW - Items', prewar: 'Lionel Pre-War - Items', mpc: 'Lionel MPC - Items', atlas: 'Atlas O - Items',
    atlas_ho: 'Atlas HO - Items', mth_o: 'MTH O - Items', af_gilbert: 'American Flyer - Items' };
  let rid = 1;
  const R = (era, n, v, t, yr, x) => { const r = Object.assign({ itemNum: n, variation: v, itemType: t, _era: era, _tab: TAB[era],
    yearProd: yr, description: t + ' ' + n, roadName: 'Road ' + n, rowId: 'RID-' + (rid++) }, x || {}); md.push(r); return r; };
  R('pw', '224', '', 'Steam Locomotive', '1945', { gauge: 'O' });
  R('pw', '6464-425', '1', 'Boxcar', '1956', { gauge: 'O' });
  R('pw', '6464-425', '2', 'Boxcar', '1957', { gauge: 'O' });
  R('pw', '6457', '', 'Caboose', '1950', { gauge: 'O' });
  R('pw', '1033', '', 'Transformer', '1948', { gauge: 'Standard & O' });
  R('pw', '6414', '', 'Flatcar', '1955', { gauge: 'O' });
  R('pw', '2343', '', 'Diesel', '1950', { gauge: 'O' });
  const rowIdRow = R('pw', '2046', '', 'Steam Locomotive', '1950', { gauge: 'O' });
  R('pw', '2046', '', 'Tender', '1952', { gauge: 'O', description: 'a second 2046 row' });
  R('pw', '"Add Up Your 1966 Lionel Profits" — Lionel Dealer Promo Abacus', '', 'Paper', '1966', { gauge: '' });
  R('prewar', '260E', '', 'Steam Locomotive', '1930', { gauge: 'Standard' });
  R('prewar', '800', '', 'Boxcar', '', { gauge: 'O' });
  R('prewar', '3300', '', 'Trolley', '1910', { gauge: '' });
  R('mpc', '8100', '', 'Steam Locomotive', '1971', { gauge: 'O' });
  R('atlas', '3300', '', 'Boxcar', '2005', { gauge: 'O' });
  R('atlas_ho', '20001234', '', 'Hopper', '2010', { gauge: 'HO' });
  R('mth_o', '30-1234-1', '', 'Diesel', '2001', { gauge: 'O', alsoSoldAs: 'Lionel Corporation' });
  R('af_gilbert', '21088', '', 'Steam Locomotive', '1950', { gauge: 'S' });
  for (let i = 0; i < 300; i++) R(i % 2 ? 'pw' : 'atlas', String(90000 + i), '', i % 3 ? 'Boxcar' : 'Caboose', '1955', { gauge: 'O' });   // not owned: must never appear
  state.masterData = md;
  _rebuildMasterIndex();
  let inv = 100;
  const P = (n, v, era, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel',
    inventoryId: String(inv++), row: inv, condition: '7' }, x || {});
  state.personalData = {
    a: P('224', '', 'pw'), b: P('224', '', 'pw'),                         // two copies
    c: P('6464-425', '', 'pw'),                                           // no variation: sits on one row
    d: P('6457', '', 'pw'),
    e: P('1033', '', 'pw'),
    f: P('6414', '', 'pw', { manufacturer: '' }),                         // blank maker cell
    g: P('2343-P', '', 'pw'),                                             // no catalog row of its own
    h: P('2046', '', 'pw', { masterRowId: rowIdRow.rowId }),              // a Row ID
    i: P('"Add Up Your 1966 Lionel Profits" — Lionel Dealer Promo Abacus', '', 'pw'),
    j: P('260E', '', 'prewar'), k: P('800', '', 'prewar'),
    l: P('8100', '', 'mpc'),
    m: P('3300', '', 'atlas', { manufacturer: 'Atlas' }),                 // also a Lionel Pre-War number
    n: P('20001234', '', 'atlas_ho', { manufacturer: 'Atlas' }),
    o: P('30-1234-1', '', 'mth_o', { manufacturer: 'MTH' }),              // also sold as Lionel
    p: P('21088', '', 'af_gilbert', { manufacturer: 'A.C. Gilbert' }),
    q: P('Ertl truck', '', 'Manual', { manufacturer: 'Ertl', itemType: 'Vehicle' }),
    r: P('MY-BLDG', '', 'Manual', { manufacturer: 'Menards', itemType: 'Building', gauge: 'O', yearMade: '2016' }),
    s: P('Pittman erect a wire dealer display', '', 'Manual', { manufacturer: 'Pittman', itemType: 'Accessory', yearMade: '1950' }),
    t: P('224', '9', 'pw', { gauge: '' }),                               // a variation the catalog does not have
  };
  state.soldData = {}; state.wantData = {};
  _currentEra = 'all';
  var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
  document.getElementById('app').classList.add('active');
  return Object.values(state.personalData).map(p => p.inventoryId);
};
