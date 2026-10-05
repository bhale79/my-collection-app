#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION FILTER TESTS — v0.9.1878   (real Chromium, the REAL app, no stubs)
//
// Brad, 2026-10-04, with the Type picker open on his desktop: "paper filter
// doesn't show paper items. audit all filters to make sure they do."
//
// The audit, measured on a stand-in collection with trains AND paper, catalogs
// and memorabilia, found five things, and this suite holds all five:
//   1. the Show row (Trains / Catalogs / Paper Items / All) was a gate in front
//      of every other filter and starts on Trains — so Type → Paper Items, the
//      Paper bucket, Catalogs (all) and a search for a paper item all came back
//      EMPTY while Trains was lit (the phone has no Show row, so it worked there);
//   2. the section options never carried a number even where they showed rows
//      (counted by bucket, filtered by section), and the Needs details number
//      counted the whole sheet;
//   3. the "── My Collection ──" divider was a clickable button that set a
//      nonsense Type;
//   4. every picker offered options with nothing behind them (Power, Science,
//      22 makers, every scale), each ending in "No items match your filters";
//   5. a row with no gauge showed under EVERY scale chip, and a row whose own
//      gauge disagreed with its catalog row showed under NONE.
//
// THE RULES NOW: the lit Show chip is DERIVED — the chip you chose, moved to
// where the Type you picked lives (rrCollShowSection); clear the pill and it
// is back; a chip that would hide the pill's rows clears the pill, a chip that
// can show them keeps it. A search takes the chip to All and clearing it puts
// it back. Every number beside an option is the rows picking it shows, and in
// My Collection no option is offered that would show nothing (Any/All and the
// current pick aside). Scale: own gauge first, else the catalog's, unknown
// only under Any Scale.
//
// Like picker_counts_tests, this never re-derives a count: it opens the real
// picker, reads every number, PICKS every option through the app, and reads
// the app's own "N items" line. Planted offenders at the end serve the old
// code as browse.js and prove each check can fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collection_filters_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const br = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { const ok = !!cond; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok || detail === undefined ? '' : '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)))); ok ? pass++ : fail++; }
function section(t) { console.log('\n── ' + t + ' ──'); }

// What the page does, in the page: builds the stand-in collection, then runs
// every scene and hands back plain data. `width` picks desktop or phone.
const SCENES = () => {
  const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern';
  const mk = (n, v, t, era, tab, yr, d) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: yr, description: d || (t + ' ' + n), roadName: '' });
  state.masterData = [
    mk('6457', '3', 'Caboose', 'pw', PW, '1949'), mk('6464', '1', 'Boxcar', 'pw', PW, '1953'),
    mk('2343', '1', 'Diesel', 'pw', PW, '1950'), mk('9700', '', 'Boxcar', 'mpc', MPC, '1972'),
    mk('1953', '1', 'Catalog', 'pw', PW, '1953', 'Consumer catalog 1953'),
    mk('310', '1', 'Billboard', 'pw', PW, '1950', 'Billboard set'),
    mk('3474', '1', 'Boxcar', 'pw', PW, '1952', 'Western Pacific boxcar'),
  ];
  _rebuildMasterIndex();
  let inv = 1;
  const pd = (n, v, era, mfr, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: String(inv++), row: inv + 1 }, x || {});
  state.personalData = {
    a: pd('6457', '3', 'pw', 'Lionel', { subCollection: 'Keepers' }), b: pd('6464', '1', 'pw', 'Lionel'), c: pd('2343', '1', 'pw', 'Lionel'),
    d: pd('9700', '', 'mpc', 'Lionel', { importBatch: 'imp-1' }),
    e: pd('1953', '1', 'pw', 'Lionel'),                                                                                     // a catalog, on its catalog row
    f: pd('DWG-1973-446', '', 'Manual', 'Lionel', { itemType: 'Paper', yearMade: '1973', description: '6636 Alaska Hopper Drawing' }),   // Brad's drawing
    g: pd('AD-1955', '', 'Manual', 'Lionel', { itemType: 'Paper', yearMade: '1955', description: 'Magazine ad' }),
    h: pd('SIGN-1', '', 'Manual', 'Lionel', { itemType: 'Memorabilia', yearMade: '1960', description: 'Dealer sign' }),
    i: pd('CAT-1957', '', 'Manual', 'Lionel', { itemType: 'Catalog', yearMade: '1957', description: 'Consumer catalog 1957' }),
    j: pd('BOX-6464', '', 'Manual', 'Lionel', { itemType: 'Box', yearMade: '1953', description: 'Empty box' }),             // a Box: the Paper bucket, the Trains section
    k: pd('310', '1', 'pw', 'Lionel'),
    l: pd('3474', '1', 'pw', 'Lionel', { gauge: 'N', subCollection: 'Keepers' }),                                            // own gauge N on an O catalog row
    m: pd('LANT-1', '', 'Manual', 'Lionel', { itemType: 'Lantern', yearMade: '1950', description: 'Brakeman lantern' }),      // a word of the owner's own
  };
  state.isData = { s1: { sheetNum: 'IS-6464', linkedItem: '6464', year: '1953', notes: '' } };
  state.soldData = {}; state.wantData = state.wantData || {}; state.mySetsData = {};
  _currentEra = 'all';
  var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-browse').classList.add('active');
  filterOwned();
  populateFilters();

  const draw = () => { window._rrBrowseSig = null; renderBrowse(); };
  const shownN = () => parseInt((document.getElementById('result-count').textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
  const rows = () => (state.filteredData || []).filter(r => !r._setFold).map(r => r.itemNum).sort().join(' ');
  const lit = () => [...document.querySelectorAll('#coll-jump-bar button')].filter(b => b.style.color === 'rgb(255, 255, 255)').map(b => b.textContent.trim()).join('|');
  const chips = () => [...document.querySelectorAll('#coll-jump-bar button')].map(b => b.textContent.trim()).join('|');
  const pill = () => ({ type: state.filters.type || '', sel: document.getElementById('filter-type').value, label: (() => { const h = document.getElementById('hierarchy-chips'); const p = h && [...h.querySelectorAll('span')].find(s => /Clear this filter/.test(s.innerHTML) && !/Maker|Scale|Era/.test(s.textContent)); return p ? p.querySelector('button').textContent.trim() : ''; })() });
  const reset = (sec) => {
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
    state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
    state.filters.search = ''; state.filters.imported = ''; state.filters.needsDetails = ''; state._collSecBeforeSearch = null;
    document.getElementById('filter-type').value = '';
    state._collSection = sec || 'trains'; state.currentPage = 1;
    draw();
  };
  const openPicker = (level) => { _openLevelPicker(level); const ov = document.getElementById('ph-picker-overlay'); return ov; };
  const pickerRows = (level) => {
    const ov = openPicker(level);
    const btns = [...ov.querySelectorAll('button')].filter(b => b.textContent.trim() !== 'Cancel');
    const out = { buttons: btns.map(b => b.textContent.replace(/\s*✓\s*$/, '').trim()), headings: [...ov.querySelectorAll('div')].filter(d => d.children.length === 0 && d.textContent.trim() && !/^Pick /.test(d.textContent)).map(d => d.textContent.trim()) };
    ov.remove();
    return out;
  };
  const pick = (level, idx) => { const ov = openPicker(level); [...ov.querySelectorAll('button')].filter(b => b.textContent.trim() !== 'Cancel')[idx].click(); const o2 = document.getElementById('ph-picker-overlay'); if (o2) o2.remove(); };
  // A: every option of every picker, under every chip — the number beside it
  // is what picking it shows; nothing is offered that shows nothing.
  const audit = [];
  const SECS = ['trains', 'paper', 'catalogs', 'other', 'all'];
  const LEVELS = ['type', 'manufacturer', 'scale', 'era', 'subCollection'];
  SECS.forEach(sec => LEVELS.forEach(level => {
    reset(sec);
    const pr = pickerRows(level);
    pr.buttons.forEach((lbl, idx) => {
      reset(sec);
      pick(level, idx);
      const m = lbl.match(/\((\d[\d,]*)\)$/);
      audit.push({ sec, level, label: lbl, said: m ? parseInt(m[1].replace(/,/g, ''), 10) : 0, got: shownN(), rows: rows(), lit: lit(), isAny: /^(Any |All )/.test(lbl) });
    });
    if (level === 'type') audit.push({ sec, level, headings: pr.headings, buttons: pr.buttons });
  }));
  // B: the Show row follows the Type
  const B = {};
  reset('trains'); B.start = { lit: lit(), rows: rows(), chips: chips() };
  _setHierarchyChoice('type', 'Paper Item'); B.paperPick = { lit: lit(), rows: rows(), pill: pill() };
  _phClearOne('type'); B.cleared = { lit: lit(), rows: rows(), pill: pill() };
  reset('paper'); _setHierarchyChoice('type', 'Boxcar'); B.boxcarFromPaper = { lit: lit(), rows: rows() };
  reset('all'); _setHierarchyChoice('type', 'Boxcar'); B.boxcarFromAll = { lit: lit(), rows: rows() };
  reset('trains'); _setHierarchyChoice('type', 'Paper'); B.bucketFromTrains = { lit: lit(), rows: rows(), pill: pill() };
  reset('trains'); _setHierarchyChoice('type', 'Boxcar'); _collSectionSet('paper'); B.chipHides = { lit: lit(), rows: rows(), pill: pill() };
  reset('trains'); _setHierarchyChoice('type', 'Boxcar'); _collSectionSet('trains'); B.chipKeeps = { lit: lit(), rows: rows(), pill: pill() };
  reset('trains'); _setHierarchyChoice('type', 'Boxcar'); _collSectionSet('all'); B.allKeeps = { lit: lit(), rows: rows(), pill: pill() };
  reset('trains'); _setHierarchyChoice('type', 'Instruction Sheet'); B.isPick = { lit: lit(), n: shownN() };
  // C: a search covers every section
  const C = {};
  reset('trains'); onPageSearch('alaska', 'browse'); draw(); C.typed = { lit: lit(), rows: rows(), sec: state._collSection };
  onPageSearch('', 'browse'); draw(); C.clearedBack = { lit: lit(), rows: rows(), sec: state._collSection };
  reset('trains'); onPageSearch('catalog', 'browse'); draw(); C.catSearch = { rows: rows() };
  _collSectionSet('catalogs'); C.narrowed = { lit: lit(), rows: rows() };
  onPageSearch('', 'browse'); draw(); C.stays = { lit: lit(), rows: rows(), sec: state._collSection };
  reset('trains');
  // D: scale
  const D = {};
  reset('all'); D.scales = pickerRows('scale').buttons;
  _setHierarchyChoice('scale', 'o'); D.o = rows();
  reset('all'); _setHierarchyChoice('scale', 'n'); D.n = rows();
  reset('all'); D.any = rows();
  // E: the More menu's two flags
  const E = {};
  const moreRows = () => { _phMoreMenu(null); const box = document.getElementById('ph-more-menu'); const out = [...box.querySelectorAll('button')].map(b => ({ text: b.textContent.replace(/\s+/g, ' ').trim(), disabled: b.disabled })); box.remove(); return out; };
  reset('trains'); E.trainsMenu = moreRows();
  _phToggleFlag('needsDetails'); E.needsOnTrains = shownN(); reset('trains');
  _phToggleFlag('imported'); E.importedOnTrains = shownN(); reset('trains');
  reset('paper'); E.paperMenu = moreRows(); reset('trains');
  return { audit, B, C, D, E, width: window.innerWidth };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  async function run(width, planted) {
    const pg = await browser.newPage({ viewport: { width, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://')) return r.abort();
      const clean = u.split('?')[0];
      const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
      if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    let out;
    try { out = await pg.evaluate(SCENES); } catch (e) { out = { crashed: String(e && e.message || e), audit: [], B: {}, C: {}, D: {}, E: {} }; }
    out.errs = errs;
    await pg.close();
    return out;
  }
  // The verdicts, as functions of a run — so the planted runs can ask the same questions.
  const V = {
    noErrors: o => o.errs.length === 0 && !o.crashed,
    everyNumberHonest: o => o.audit.filter(r => r.label !== undefined && r.said !== r.got),
    noDeadOptions: o => o.audit.filter(r => r.label !== undefined && !r.isAny && r.got === 0),
    dividerIsHeading: o => { const t = o.audit.filter(r => r.headings); return t.length > 0 && t.every(r => !r.buttons.some(b => /My Collection/.test(b)) && r.headings.some(h => /^My Collection$/.test(h))); },
    paperPickShows: o => o.B.paperPick && o.B.paperPick.rows === 'AD-1955 DWG-1973-446' && o.B.paperPick.lit === 'Paper Items',
    noGaugeOnlyUnderAny: o => o.D.o === '1953 2343 310 6457 6464 9700' && o.D.n === '3474',
    searchMovesChip: o => o.C.typed && o.C.typed.lit === 'All' && o.C.typed.rows === 'DWG-1973-446' && o.C.clearedBack.lit === 'Trains',
  };

  section('A · every option of every picker, under every Show chip (desktop)');
  const R = await run(1400, null);
  T('A1  the page ran without a script error', V.noErrors(R), R.errs.concat(R.crashed ? [R.crashed] : []));
  T('A2  the audit clicked every option under every chip (' + R.audit.filter(r => r.label !== undefined).length + ' picks)', R.audit.filter(r => r.label !== undefined).length > 60);
  const bad = V.everyNumberHonest(R);
  bad.slice(0, 10).forEach(r => console.log('      MISMATCH  Show=' + r.sec + ' ' + r.level + ' "' + r.label + '"  said ' + r.said + ', picking it showed ' + r.got + ' [' + r.rows + ']'));
  T('A3  EVERY number beside an option is the rows picking it shows — Paper Items and Catalogs (all) included', bad.length === 0);
  const dead = V.noDeadOptions(R);
  dead.slice(0, 10).forEach(r => console.log('      DEAD  Show=' + r.sec + ' ' + r.level + ' "' + r.label + '" showed nothing'));
  T('A4  no option offered in My Collection shows nothing (Any/All aside)', dead.length === 0);
  const tTrains = R.audit.find(r => r.sec === 'trains' && r.level === 'type' && r.buttons) || { buttons: [], headings: [] };
  T('A5  under Trains the Type list offers the paper, catalog and memorabilia options WITH numbers: ' + tTrains.buttons.join(' · '),
    tTrains.buttons.some(b => b === '📄 Paper Items (2)') && tTrains.buttons.some(b => b === '📒 Catalogs (all) (2)') && tTrains.buttons.some(b => b === '📦 Memorabilia (1)'), tTrains.buttons);
  T('A6  …the catalog bucket is called by its full name, "Paper / Box / Misc (5)" — paper, catalogs and the box', tTrains.buttons.some(b => b === 'Paper / Box / Misc (5)'), tTrains.buttons);
  T('A7  …and none of Power, Science, Service Tool, Track, Trolley, Intermodal (nothing owned)', !tTrains.buttons.some(b => /^(Power|Science|Service Tool|Track|Trolley|Intermodal)/.test(b)), tTrains.buttons);
  T('A8  the owner\'s own word "Lantern (1)" is still offered, under its heading', tTrains.buttons.some(b => b === 'Lantern (1)') && tTrains.headings.some(h => /Also in your collection/i.test(h)), tTrains);
  T('A9  "── My Collection ──" is a heading, not a button', V.dividerIsHeading(R), R.audit.filter(r => r.headings).map(r => r.headings));
  const makers = R.audit.filter(r => r.sec === 'trains' && r.level === 'manufacturer' && r.label !== undefined).map(r => r.label);
  T('A10 the Maker list under Trains is Any + Lionel — not 22 makers with nothing behind them', makers.join('|') === 'Any Manufacturer (8)|Lionel (8)', makers);
  const litByPick = R.audit.filter(r => r.sec === 'trains' && r.level === 'type' && r.label !== undefined).map(r => r.label.replace(/ \(\d+\)$/, '') + '→' + r.lit);
  T('A11 each Type pick lit the chip it lives in: ' + litByPick.join(', '),
    litByPick.includes('📄 Paper Items→Paper Items') && litByPick.includes('📒 Catalogs (all)→Catalogs') && litByPick.includes('📦 Memorabilia→Memorabilia') && litByPick.includes('Boxcar→Trains') && litByPick.includes('Paper / Box / Misc→All') && litByPick.includes('Lantern→Trains'), litByPick);

  section('B · the Show row follows the Type');
  T('B1  it starts on Trains with the trains (and the Box, and the lantern): ' + R.B.start.rows, R.B.start.lit === 'Trains' && R.B.start.rows === '2343 310 3474 6457 6464 9700 BOX-6464 LANT-1', R.B.start);
  T('B2  the chips: ' + R.B.start.chips, R.B.start.chips === 'Trains|Catalogs|Paper Items|Memorabilia|Instruction Sheets|All', R.B.start.chips);
  T('B3  THE FIX — Type → Paper Items from Trains shows the two paper items and lights Paper Items', V.paperPickShows(R), R.B.paperPick);
  T('B4  …the pill wears the option\'s words', R.B.paperPick.pill.label === '📄 Paper Items', R.B.paperPick.pill);
  T('B5  clear the pill: Trains is lit again with the trains', R.B.cleared.lit === 'Trains' && R.B.cleared.rows === R.B.start.rows && R.B.cleared.pill.type === '', R.B.cleared);
  T('B6  Boxcar picked from the Paper Items chip: Trains lights, the boxcars show', R.B.boxcarFromPaper.lit === 'Trains' && R.B.boxcarFromPaper.rows === '3474 6464 9700', R.B.boxcarFromPaper);
  T('B7  Boxcar picked from All: All stays lit (it hides nothing)', R.B.boxcarFromAll.lit === 'All' && R.B.boxcarFromAll.rows === '3474 6464 9700', R.B.boxcarFromAll);
  T('B8  the Paper / Box / Misc bucket from Trains: All lights, paper + catalogs + the box', R.B.bucketFromTrains.lit === 'All' && R.B.bucketFromTrains.rows === '1953 AD-1955 BOX-6464 CAT-1957 DWG-1973-446' && R.B.bucketFromTrains.pill.label === 'Paper / Box / Misc', R.B.bucketFromTrains);
  T('B9  a chip that would hide the pill\'s rows clears the pill (Paper Items over "Boxcar")', R.B.chipHides.pill.type === '' && R.B.chipHides.pill.sel === '' && R.B.chipHides.rows === 'AD-1955 DWG-1973-446' && R.B.chipHides.lit === 'Paper Items', R.B.chipHides);
  T('B10 a chip that can show them keeps it (Trains over "Boxcar")', R.B.chipKeeps.pill.type === 'Boxcar' && R.B.chipKeeps.rows === '3474 6464 9700' && R.B.chipKeeps.lit === 'Trains', R.B.chipKeeps);
  T('B11 …and so does All', R.B.allKeeps.pill.type === 'Boxcar' && R.B.allKeeps.rows === '3474 6464 9700' && R.B.allKeeps.lit === 'All', R.B.allKeeps);
  T('B12 Type → Instruction Sheet from Trains lights Instruction Sheets and shows the one sheet', R.B.isPick.lit === 'Instruction Sheets' && R.B.isPick.n === 1, R.B.isPick);

  section('C · a search covers every section');
  T('C1  typing "alaska" from Trains lights All and finds the drawing', V.searchMovesChip(R), R.C);
  T('C2  clearing the search puts Trains back, with the trains', R.C.clearedBack.lit === 'Trains' && R.C.clearedBack.rows === R.B.start.rows, R.C.clearedBack);
  T('C3  searching "catalog" finds both catalogs across sections', R.C.catSearch.rows === '1953 CAT-1957', R.C.catSearch);
  T('C4  a chip clicked during the search narrows it (Catalogs keeps both)', R.C.narrowed.lit === 'Catalogs' && R.C.narrowed.rows === '1953 CAT-1957', R.C.narrowed);
  T('C5  …and is where you stay when the search is cleared', R.C.stays.lit === 'Catalogs' && R.C.stays.sec === 'catalogs' && R.C.stays.rows === '1953 CAT-1957', R.C.stays);

  section('D · scale: own gauge first, else the catalog\'s, unknown only under Any');
  T('D1  the Scale list under All offers only Any (13 rows + the sheet), O and N: ' + R.D.scales.join(' · '), R.D.scales.join('|') === 'Any Scale (14)|O Gauge (6)|N Scale (1)', R.D.scales);
  T('D2  O Gauge: the six catalog-row trains — not the no-gauge rows, not the N-gauge 3474', R.D.o === '1953 2343 310 6457 6464 9700', R.D.o);
  T('D3  N Scale: exactly the 3474 whose own row says N (it used to show under neither chip)', R.D.n === '3474', R.D.n);
  T('D4  Any Scale: everything', R.D.any.split(' ').length === 13, R.D.any);

  section('E · the More menu\'s flags carry the number the list will show');
  const ndT = (R.E.trainsMenu.find(r => /^Needs details/.test(r.text)) || {});
  const imT = (R.E.trainsMenu.find(r => /^Imported only/.test(r.text)) || {});
  T('E1  under Trains, Needs details says ' + JSON.stringify(ndT.text) + ' and turning it on shows ' + R.E.needsOnTrains, ndT.text === 'Needs details ' + R.E.needsOnTrains && R.E.needsOnTrains === 6 && !ndT.disabled, R.E);
  T('E2  …Imported only says ' + JSON.stringify(imT.text) + ' and turning it on shows ' + R.E.importedOnTrains, imT.text === 'Imported only ' + R.E.importedOnTrains && R.E.importedOnTrains === 1 && !imT.disabled, R.E);
  const ndP = (R.E.paperMenu.find(r => /^Needs details/.test(r.text)) || {});
  const imP = (R.E.paperMenu.find(r => /^Imported only/.test(r.text)) || {});
  T('E3  under Paper Items both read 0 and are dimmed, not dead clicks', ndP.text === 'Needs details 0' && ndP.disabled === true && imP.text === 'Imported only 0' && imP.disabled === true, R.E.paperMenu);

  section('F · the phone (no Show row)');
  const P = await run(390, null);
  T('F1  the page ran without a script error', V.noErrors(P), P.errs.concat(P.crashed ? [P.crashed] : []));
  const pbad = V.everyNumberHonest(P), pdead = V.noDeadOptions(P);
  T('F2  every number honest, no dead options, on the phone too', pbad.length === 0 && pdead.length === 0, { pbad: pbad.slice(0, 5), pdead: pdead.slice(0, 5) });
  T('F3  Type → Paper Items shows the paper items on the phone', P.B.paperPick && P.B.paperPick.rows === 'AD-1955 DWG-1973-446', P.B.paperPick);
  T('F4  scale is strict on the phone as well', V.noGaugeOnlyUnderAny(P), P.D);

  section('P · planted offenders — the old code served as browse.js');
  const plant = async (name, from, to, verdict, what) => {
    const src = br.replace(from, to);
    T(name + '  the plant changed browse.js', src !== br);
    const O = await run(1400, { 'browse.js': src });
    T(name + '  …and ' + what + ' goes red on it (no page errors)', V.noErrors(O) && !verdict(O), O.errs.concat(O.crashed ? [O.crashed] : []));
  };
  await plant('P1', 'return _rrTypeHome(tv) || chosen;', 'return chosen;', V.paperPickShows, 'the Show row ignoring the Type (B3)');
  // The old count: a section option got whatever its BUCKET label counted (nothing, for "Paper Item") — today that is no number, so no option at all.
  await plant('P2', "EPHEMERA_TABS.forEach(function (t) { _coOut[t.single] = (_bySec[t.id] ? _foldSets(_bySec[t.id]).length : 0) + _isN(t.single, _secOf(t.single)); });", '',
    o => { const t = o.audit.find(r => r.sec === 'trains' && r.level === 'type' && r.buttons); return !!t && t.buttons.includes('📄 Paper Items (2)') && V.everyNumberHonest(o).length === 0; }, 'a section option counted by bucket (A3/A5)');
  await plant('P3', 'if (o.disabled) { options.push', 'if (false) { options.push', V.dividerIsHeading, 'the clickable divider (A9)');
  await plant('P4', 'return _pc[o.id] > 0;\n    });\n  }', 'return true;\n    });\n  }', o => V.noDeadOptions(o).length === 0, 'dead options offered (A4)');
  await plant('P5', "if (_rowScales.map(function (s) { return String(s).toLowerCase(); }).indexOf(_cNorm) < 0) return false;", "if (_rowScales.length && _rowScales.map(function (s) { return String(s).toLowerCase(); }).indexOf(_cNorm) < 0) return false;", V.noGaugeOnlyUnderAny, 'no-gauge rows under every scale (D2)');
  await plant('P6', "state._collSecBeforeSearch = state._collSection || 'trains'; state._collSection = 'all'; }", "state._collSecBeforeSearch = state._collSection || 'trains'; }", V.searchMovesChip, 'a search that stays behind the Trains gate (C1)');

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
