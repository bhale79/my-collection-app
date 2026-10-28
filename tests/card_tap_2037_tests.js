#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A DASHBOARD CARD OPENS ITS ITEMS — v0.9.2037            (real Chromium)
//
// Lars (2026-10-28, Report a problem, on the Total Sets / Cabooses / Engines
// cards): "would be cool if these windows were also a link to view the
// specific items" → [stated] Brad: "both" (the Total cards AND the Collection
// by Type lines) → "go".
//
// THE RULE: the number on a card is the number of rows in the list it opens.
// One list of groups (config.js RR_COLL_GROUPS); the card counts by it
// (_ownedGroupOf, dashboard.js), the list filters by the same function under a
// group chip (browse.js _copyPasses), and the chip un-folds groups so every
// counted piece is a row.
//
//   A  every Total card and every Collection by Type line carries the tap
//   B  the stand-in collection (one of every kind, an ABA, an engine+tender,
//      a manual item, a paper item, a box, a want): tap each card → the row
//      count equals the card's number; the chip shows; the list is My Collection
//   C  the chip's × clears it, and leaving to the Master Catalog clears it
//   D  the lists live in config.js ONLY (a scan of app/ for a second copy)
//   P  PLANTED: each old habit put back must go red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  card_tap_2037_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const SRC = f => fs.readFileSync(path.join(APP, f), 'utf8');
const DASH = SRC('dashboard.js'), BROWSE = SRC('browse.js'), CONFIG = SRC('config.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

const GROUPS = ['Engines', 'Tenders', 'Freight', 'Passenger', 'Cabooses', 'Accessories', 'Sets', 'Other'];
const CARDS = { engines: 'Engines', cabooses: 'Cabooses', freight: 'Freight', passenger: 'Passenger', accessories: 'Accessories', sets: 'Sets' };

async function run(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async (GROUPS) => {
    const wait = ms => new Promise(z => setTimeout(z, ms));
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern', PRE = 'Lionel Pre-War';
    const mk = (n, v, t, era, tab, desc) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: '', description: desc || (t + ' ' + n), roadName: 'Lionel Lines' });
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.masterData = [
      mk('2046', '1', 'Steam Locomotive', 'pw', PW, '4-6-4 Hudson'),
      mk('2046W', '1', 'Tender', 'pw', PW, 'Whistle Tender'),
      mk('2343', '1', 'Diesel Locomotive', 'pw', PW, 'F3 A unit'),
      mk('2343T', '1', 'Diesel Locomotive', 'pw', PW, 'F3 dummy A'),
      mk('2343C', '1', 'Diesel Locomotive', 'pw', PW, 'F3 B unit'),
      mk('6464-1', '1', 'Boxcar', 'pw', PW, 'Western Pacific'),
      mk('6462', '1', 'Gondola', 'pw', PW, 'Gondola'),
      mk('2421', '1', 'Passenger Car', 'pw', PW, 'Maplewood Pullman'),
      mk('6357', '1', 'Caboose', 'pw', PW, 'SP-type caboose'),
      mk('6017', '1', 'Caboose', 'pw', PW, 'SP-type caboose'),
      mk('115', '1', 'Accessory', 'pw', PW, 'Passenger Station'),
      mk('6-21787', '', 'Passenger Set', 'mpc', MPC, 'Blue Comet set'),
      mk('6-31705', '', 'Passenger Set', 'mpc', MPC, '50th Anniversary set'),
      mk('600', '', 'Passenger Car', 'prewar', PRE, 'Pullman Car'),
    ];
    try { _rebuildMasterIndex(); } catch (e) {}
    let inv = 100;
    const pd = (n, v, era, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel', inventoryId: String(inv++), row: inv, condition: 8 }, x || {});
    state.personalData = {
      a: pd('2046', '1', 'pw', { groupId: 'GRP-2046-1' }),              // steam engine …
      b: pd('2046W', '1', 'pw', { groupId: 'GRP-2046-1' }),             // … and its tender (a Tender, not an engine)
      c: pd('2343-P', '1', 'pw', { groupId: 'GRP-2343-1' }),            // ABA: powered A …
      d: pd('2343-T', '1', 'pw', { groupId: 'GRP-2343-1' }),            // … dummy A …
      e: pd('2343-C', '1', 'pw', { groupId: 'GRP-2343-1' }),            // … B unit — three engines (v1567: 3 items count as 3)
      f: pd('6464-1', '1', 'pw'),                                       // boxcar
      g: pd('6464-1', '1', 'pw'),                                       // a SECOND copy of the same boxcar — two rows, two counts
      h: pd('6462', '1', 'pw'),                                         // gondola
      i: pd('2421', '1', 'pw'),                                         // passenger car
      j: pd('600', '', 'prewar'),                                       // pre-war Pullman — the SAME item number is a diesel on another tab
      k: pd('6357', '1', 'pw'),                                         // caboose
      l: pd('6017', '1', 'pw'),                                         // caboose
      m: pd('115', '1', 'pw'),                                          // station
      n: pd('6-21787', '', 'mpc'),                                      // Lars's Blue Comet set
      o: pd('6-31705', '', 'mpc'),                                      // the 50th Anniversary set
      p: pd('SIGN-7', '', 'Manual', { itemType: 'Accessory' }),         // manual accessory, off-catalog
      q: pd('PAPER-1', '', 'Manual', { itemType: 'Paper' }),            // a paper item → Other
      r: pd('MYSTERY-1', '', 'Manual', { itemType: '' }),               // no type at all → Other
      s: pd('6464-1-BOX', '1', 'pw', { hasBox: 'Yes', groupId: 'GRP-6464-1' }),   // a box: never counted, never a row
      t: pd('6462', '1', 'pw', { owned: false }),                       // a WANT: never counted
    };
    state.forSaleData = {}; state.upgradeData = {}; state.wantData = {}; state.soldData = {}; state.isData = {}; state.ephemeraData = {};
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    const r = { errs: [] };
    const card = id => CARD_CATALOG.find(c => c.id === id);
    const num = id => Number(String(card(id).compute(state).value).replace(/,/g, ''));
    // A — the taps are there
    r.cardTaps = {}; Object.keys({ engines: 1, cabooses: 1, freight: 1, passenger: 1, accessories: 1, sets: 1 }).forEach(id => { r.cardTaps[id] = String(card(id).onclick || ''); });
    const byType = card('collectionByType').compute(state).html || '';
    r.lineTaps = {}; byType.replace(/onclick="([^"]*)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/g, (_, oc, k) => { r.lineTaps[k] = oc; });
    r.lines = {}; byType.replace(/<span[^>]*>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g, (_, k, v) => { r.lines[k] = Number(v); });
    r.cardNums = {}; Object.keys(r.cardTaps).forEach(id => { r.cardNums[id] = num(id); });
    // B — tap each group, count the rows
    const rows = () => Array.from(document.querySelectorAll('#browse-tbody tr')).filter(tr => tr.querySelectorAll('td').length > 1 && !/No items|SAMPLE/.test(tr.textContent)).length;
    const chip = () => { const c = Array.from(document.querySelectorAll('#ph-chips button, .ph-chips button, [id^="ph-"] button')).map(b => b.textContent.trim()); return c; };
    const chipText = () => (document.getElementById('ph-chip-host') || document.querySelector('.ph-chip-host') || document.body).textContent;
    r.taps = {};
    for (const g of GROUPS) {
      window._fromDash = true; rrCollGroupOpen(g); await wait(350);
      r.taps[g] = { rows: rows(), group: state.filters.group, owned: !!state.filters.owned, page: ((document.querySelector('.page.active') || {}).id || ''),
                    count: (document.getElementById('result-count') || {}).textContent || '', back: !!document.getElementById('page-back-dash'),
                    title: ((document.querySelector('#page-browse > .page-title > span') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
                    chip: !!Array.from(document.querySelectorAll('#page-browse button')).find(b => b.textContent.trim() === g),
                    // [stated] Brad: the group sits IN the Type pill — no idle "Type ▾" beside it, and only one pill wears the word
                    typeIdle: !!Array.from(document.querySelectorAll('#hierarchy-chips button')).find(b => /^Type\s*▾/.test(b.textContent.trim())),
                    pills: Array.from(document.querySelectorAll('#hierarchy-chips button')).filter(b => b.textContent.trim() === g).length,
                    nums: Array.from(document.querySelectorAll('#browse-tbody tr')).map(tr => (tr.textContent || '').replace(/\s+/g, ' ').slice(0, 40)) };
    }
    r.lineNums = r.lines;
    // C — the × clears it; the Master Catalog clears it
    rrCollGroupOpen('Engines'); await wait(300);
    _phClearOne('group'); await wait(300);
    r.cleared = { group: state.filters.group, rows: rows(), owned: !!state.filters.owned, title: ((document.querySelector('#page-browse > .page-title > span') || {}).textContent || '').replace(/\s+/g, ' ').trim() };
    rrCollGroupOpen('Engines'); await wait(300);
    const mc = document.querySelector('.nav-item[onclick*="resetFilters"]'); if (mc) mc.click(); await wait(300);
    r.catalog = { group: state.filters.group, owned: !!state.filters.owned };
    rrCollGroupOpen('Nonsense'); await wait(100);
    r.bogus = { group: state.filters.group };
    // E — the Type pill IS the group's pill: a pick from the Type list replaces it,
    // and the list's numbers are counted without the group (a pick replaces it)
    rrCollGroupOpen('Engines'); await wait(300);
    const cnt = (typeof _phChipCounts === 'function') ? _phChipCounts('type', []) : null;
    r.typeCounts = cnt ? { all: cnt[''], steam: cnt['Steam'], boxcar: cnt['Boxcar'], set: cnt['Set'] } : null;
    _phClearOne('group'); await wait(300);
    const cnt0 = (typeof _phChipCounts === 'function') ? _phChipCounts('type', []) : null;
    r.typeCounts0 = cnt0 ? { all: cnt0[''], steam: cnt0['Steam'], boxcar: cnt0['Boxcar'], set: cnt0['Set'] } : null;
    rrCollGroupOpen('Engines'); await wait(300);
    _setHierarchyChoice('type', 'Steam'); await wait(300);
    r.typePick = { group: state.filters.group, type: state.filters.type, rows: rows(),
                   pill: !!Array.from(document.querySelectorAll('#hierarchy-chips button')).find(b => b.textContent.trim() === 'Steam'),
                   enginesPill: !!Array.from(document.querySelectorAll('#hierarchy-chips button')).find(b => b.textContent.trim() === 'Engines') };
    rrCollGroupOpen('Engines'); await wait(300);
    _setHierarchyChoice('type', ''); await wait(300);
    r.typeAll = { group: state.filters.group, type: state.filters.type, rows: rows() };
    return r;
  }, GROUPS);
  await pg.close();
  return Object.assign(out, { errs });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const r = await run(browser);
  console.log('== A · the taps ==');
  T('A1 the six Total cards carry the tap (rrCollGroupOpen with their group)', Object.keys(CARDS).every(id => r.cardTaps[id] === "rrCollGroupOpen('" + CARDS[id] + "')"), r.cardTaps);
  T('A2 every Collection by Type line carries the tap for its own group', Object.keys(r.lines).length >= 7 && Object.keys(r.lines).every(k => (r.lineTaps[k] || '').indexOf("rrCollGroupOpen('" + k + "')") >= 0 && /_fromDash=true/.test(r.lineTaps[k])), { lines: r.lines, taps: r.lineTaps });
  T('A3 Sets is a line of its own on Collection by Type (Lars\'s two sets), not Other', r.lines.Sets === 2 && r.lines.Other === 2, r.lines);
  console.log('== B · the card\'s number is the row count ==');
  const want = { Engines: 4, Tenders: 1, Freight: 3, Passenger: 2, Cabooses: 2, Accessories: 2, Sets: 2, Other: 2 };
  T('B0 the stand-in collection counts as planned (4 engines incl. the ABA, 3 freight incl. the second copy, 2 Other)', JSON.stringify(r.lines) === JSON.stringify(want), { got: r.lines, want });
  for (const g of GROUPS) {
    const t = r.taps[g] || {};
    const n = (g === 'Engines') ? r.cardNums.engines : (g === 'Cabooses') ? r.cardNums.cabooses : (g === 'Freight') ? r.cardNums.freight : (g === 'Passenger') ? r.cardNums.passenger : (g === 'Accessories') ? r.cardNums.accessories : (g === 'Sets') ? r.cardNums.sets : r.lines[g];
    T('B ' + g + ': the card says ' + n + ', the list draws ' + t.rows + ' rows, the Type pill reads "' + g + '", "N items" agrees, the title says "' + g + ' · ' + n + ' of"', t.rows === n && t.chip && t.pills === 1 && !t.typeIdle && t.group === g && t.owned && /browse/.test(t.page) && t.count === n + ' items' && t.title.indexOf(g + ' \u00b7 ' + n + ' of ') >= 0, t);
  }
  T('B9 the list opened from a card gets its Back to Dashboard bar', GROUPS.every(g => r.taps[g].back), GROUPS.map(g => r.taps[g].back));
  console.log('== C · clearing ==');
  T('C1 the chip\'s × clears the group and the whole collection is back (the title too)', r.cleared.group === '' && r.cleared.owned && r.cleared.rows > 10 && r.cleared.title.indexOf(' of ') < 0, r.cleared);
  T('C2 leaving for the Master Catalog clears it', r.catalog.group === '' && !r.catalog.owned, r.catalog);
  T('C3 a name that is not a group does nothing', r.bogus.group === '' || r.bogus.group === undefined, r.bogus);
  console.log('== E · the Type pill wears the group ==');
  T('E1 under Engines the Type list shows the SAME numbers as with no group (a pick replaces the group): ' + JSON.stringify(r.typeCounts), !!r.typeCounts && !!r.typeCounts0 && JSON.stringify(r.typeCounts) === JSON.stringify(r.typeCounts0) && r.typeCounts.boxcar === 2 && r.typeCounts.set === 2, { under: r.typeCounts, none: r.typeCounts0 });
  T('E2 picking Steam from the Type list replaces Engines: the pill reads Steam, the group is gone, 1 row', r.typePick.group === '' && r.typePick.type === 'Steam' && r.typePick.pill && !r.typePick.enginesPill && r.typePick.rows === 1, r.typePick);
  T('E3 picking All Types clears the group too and the whole collection is back', r.typeAll.group === '' && r.typeAll.type === '' && r.typeAll.rows > 10, r.typeAll);
  T('page errors', r.errs.length === 0, r.errs);
  console.log('== D · one list ==');
  // a GROUP list: the four engine kinds alone, the freight run, or a one-bucket group
  const typed = /\[\s*'Steam Locomotive'\s*,\s*'Diesel Locomotive'\s*,\s*'Electric Locomotive'\s*,\s*'Motorized Unit'\s*\]|'Boxcar'\s*,\s*'Hopper'\s*,\s*'Tank Car'|\['Caboose'\]|\['Set'\]/;
  const files = fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'config.js');
  const off = files.filter(f => typed.test(code(SRC(f))));
  T('D1 no app file but config.js types a group\'s bucket list (' + files.length + ' scanned)', off.length === 0, off);
  T('D2 config.js has the one list, Engines read from the one engine list', /const RR_COLL_GROUPS = \[/.test(CONFIG) && /\['Engines',\s*Object\.keys\(RR_GROUP_ENGINE_BUCKETS\)\]/.test(CONFIG));
  T('D3 the dashboard\'s group decider is config\'s rrCollGroupOf, and the list asks _ownedGroupOf', /return rrCollGroupOf\(_ownedBucketOf\(pd\)\);/.test(code(DASH)) && /_ownedGroupOf\(pd\) !== state\.filters\.group/.test(code(BROWSE)));
  T('D4 ONE fold rule: _foldSets asks _grpFoldActive, and a group chip un-folds', /function _foldSets\(_list\) \{\s*\n\s*if \(!_grpFoldActive\(\)\) return _list;/.test(BROWSE) && /&& !state\.filters\.group\);/.test(BROWSE));
  T('D5 the scan catches a typed copy (and not a commented-out one)', typed.test(code("var _CABOOSE_BUCKETS = ['Caboose'];")) && typed.test(code("var x = ['Boxcar', 'Hopper', 'Tank Car'];")) && typed.test(code("var e = ['Steam Locomotive','Diesel Locomotive','Electric Locomotive','Motorized Unit'];")) && !typed.test(code("// var _CABOOSE_BUCKETS = ['Caboose'];")));

  console.log('== P · planted (each must go red) ==');
  // P1: the list's row test no longer asks the group → every tap draws the whole collection
  const P1 = await run(browser, { 'browse.js': planted(BROWSE, "if (state.filters.group && typeof _ownedGroupOf === 'function' && _ownedGroupOf(pd) !== state.filters.group) return false;", '', 'row test') });
  T('P1 the row test without the group question → B red (Engines draws every row)', P1.taps.Engines.rows !== r.cardNums.engines, P1.taps.Engines);
  // P2: the fold stays on under the chip → the ABA's three engines draw as one row
  const P2 = await run(browser, { 'browse.js': planted(BROWSE, "&& !(state._collSort && state._collSort.col) && !state.filters.group);", "&& !(state._collSort && state._collSort.col));", 'fold') });
  T('P2 the fold left on under the chip → B Engines red (the ABA folds to one row)', P2.taps.Engines.rows !== r.cardNums.engines, P2.taps.Engines);
  // P3: a card counts by its own typed list that disagrees with the one list
  const P3 = await run(browser, { 'dashboard.js': planted(DASH, "var count = _ownedGroupCount(state, 'Freight');", "var count = _ownedTypeCount(state, ['Boxcar', 'Hopper', 'Tank Car']);", 'card list') });
  T('P3 a Total card counting by its own typed list → B Freight red', P3.taps.Freight.rows !== P3.cardNums.freight, { rows: P3.taps.Freight.rows, card: P3.cardNums.freight });
  // P4: the tap taken off the Collection by Type lines
  const P4 = await run(browser, { 'dashboard.js': planted(DASH, "onclick=\"event.stopPropagation();window._fromDash=true;' + _dashGroupTap(e[0]) + '\"", '', 'line tap') });
  T('P4 the lines without their tap → A2 red', !Object.keys(P4.lines).every(k => (P4.lineTaps[k] || '').indexOf('rrCollGroupOpen') >= 0), P4.lineTaps);
  // P5: Sets back on the Other line (the old six-group list)
  const P5 = await run(browser, { 'config.js': planted(CONFIG, "  ['Sets',        ['Set']]\n", '', 'sets group') });
  T('P5 Sets dropped from the one list → A3 red (the sets sink into Other)', !(P5.lines.Sets === 2 && P5.lines.Other === 2), P5.lines);
  // P6: the title counts the group its own way (the piece count) instead of the card's counter
  const P6 = await run(browser, { 'browse.js': planted(BROWSE, "_ownedGroupCount(state, state.filters.group).toLocaleString() + ' of '", "_pieceCount.toLocaleString() + ' of '", 'title counter') });
  T('P6 the title with its own counter → B red (Engines title says the whole piece count)', P6.taps.Engines.title.indexOf('Engines \u00b7 ' + P6.cardNums.engines + ' of ') < 0, P6.taps.Engines.title);
  // P7: a Type pick that leaves the group in place → Steam AND Engines both on, the pill lies
  const P7 = await run(browser, { 'browse.js': planted(BROWSE, "        state.filters.group = '';   // v0.9.2037: a Type pick (All Types too) replaces a dashboard card's group — the pill wears one or the other\n", '', 'type pick') });
  T('P7 a Type pick leaving the group on → E2 red', !(P7.typePick.group === '' && P7.typePick.type === 'Steam'), P7.typePick);
  // P8: the group drawn as its own chip again (beside an idle Type ▾)
  const P8 = await run(browser, { 'browse.js': planted(BROWSE, "    else if (_phOwned && state.filters.group) { onCount++; html += _pillOn(state.filters.group, \"_phClearOne('group')\", \"_openLevelPicker('type')\"); }\n", '', 'type pill') });
  T('P8 the group not worn by the Type pill → B red (an idle Type ▾ beside it, no pill)', !(P8.taps.Engines.pills === 1 && !P8.taps.Engines.typeIdle), P8.taps.Engines);
  // P9: the Type list counted WITH the group still on → its numbers shrink to the group
  const P9 = await run(browser, { 'browse.js': planted(BROWSE, "req.clearF = { group: '' }; ", '', 'picker counts') });
  T('P9 the Type list counted under the group → E1 red (Boxcar 0 under Engines)', !(JSON.stringify(P9.typeCounts) === JSON.stringify(P9.typeCounts0)), P9.typeCounts);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
