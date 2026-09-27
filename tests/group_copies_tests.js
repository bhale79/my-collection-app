#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GROUP COPIES — v0.9.1820   (real Chromium, the REAL app, no stubs)
//
// Release readiness S7 / Open List #11 (found v0.9.1799). Brad owns two of
// one item and puts ONE copy in a Group ("Cabooses I run"). The row test
// (_rowPasses) asked "does this catalog row's owned copy carry the Group?"
// against ONE copy — whichever findPD returned — and _expandCopies then drew
// EVERY copy of the row. Two wrongs: the Group showed both copies, and if
// the copy findPD picked was the one NOT in the Group, the row vanished from
// the Group altogether.
//
// THE RULE: a per-copy filter (Group, Sub Type, My maker, Quick Entry,
// Imported, Needs details, Boxed) is answered by EACH COPY. A row is in the
// list when ANY of its copies passes; only the copies that pass are drawn;
// the picker's number is what picking it shows. With no per-copy filter
// nothing changes: every copy is drawn as before.
//
// This drives the real My Collection list on a synthetic catalog with every
// copy shape, reads what is drawn, and asks the picker's own counter.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  group_copies_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);

  const out = await pg.evaluate(() => {
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t, yr) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: yr, description: t + ' ' + n, roadName: 'Road ' + n });
    const md = [];
    for (let i = 0; i < 2000; i++) md.push(mk(String(10000 + i), i % 3 ? '1' : '', i % 2 ? 'Boxcar' : 'Caboose', '1950'));
    md.push(mk('6457', '2', 'Caboose', '1950'), mk('2444', '', 'Pullman', '1954'), mk('6464-425', '1', 'Boxcar', '1956'), mk('3472', '', 'Milk Car', '1949'));
    state.masterData = md;
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1, condition: '7' }, x || {});
    state.personalData = {
      // two 6457s: the FIRST (lower inventoryId, what findPD returns) is NOT in the group; the second is
      a: pd('6457', '2'),
      b: pd('6457', '2', { subCollection: 'Cabooses I run', subType: 'Runner' }),
      // a single copy in the group
      c: pd('2444', '', { subCollection: 'Cabooses I run' }),
      // three 6464-425s: one in the group, one Quick Entry, one imported
      d: pd('6464-425', '1', { subCollection: 'Cabooses I run', quickEntry: true }),
      e: pd('6464-425', '1', { importBatch: 'imp1' }),
      f: pd('6464-425', '1', { manufacturer: 'Lionel', hasBox: 'Yes' }),
      // two 3472s, neither in the group
      g: pd('3472', ''), h: pd('3472', ''),
      // a personal-only manual item in the group
      i: pd('Ertl truck', '', { era: 'Manual', manufacturer: 'Ertl', itemType: 'Vehicle', subCollection: 'Cabooses I run' }),
    };
    state.soldData = {}; state.wantData = state.wantData || {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
    state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
    filterOwned();
    // the copy a drawn row stands for: the named copy, the manual item itself, or — a
    // single-copy row — the one owned record with that number
    const key = it => {
      if (it._personalOnly) return 'P:' + it.itemNum + '#' + it.inventoryId;
      if (it._copyPd) return it.itemNum + '#' + it._copyPd.inventoryId;
      const own = Object.values(state.personalData).filter(p => p.owned && p.itemNum === it.itemNum);
      return it.itemNum + '#' + (own.length === 1 ? own[0].inventoryId : '?');
    };
    const draw = (f) => {
      state.filters.subCollection = f.subCollection || ''; state.filters.subType = f.subType || '';
      state.filters.quickEntry = f.quickEntry || ''; state.filters.imported = f.imported || '';
      state.filters.ownMaker = f.ownMaker || ''; state.filters.needsDetails = f.needsDetails || '';
      state.filters.boxed = !!f.boxed;
      window._rrBrowseSig = null; renderBrowse();
      return (state.filteredData || []).map(key).sort();
    };
    const r = {};
    r.none = draw({});
    r.group = draw({ subCollection: 'Cabooses I run' });
    r.subType = draw({ subType: 'Runner' });
    r.quick = draw({ quickEntry: 'quick' });
    r.imported = draw({ imported: 'imported' });
    r.boxed = draw({ boxed: true });
    draw({});
    // the picker's own number for the Group
    const opts = [{ id: '', label: 'All Groups' }, { id: 'Cabooses I run', label: 'Cabooses I run' }];
    const counts = _phChipCounts('subCollection', opts);
    r.pickerGroup = counts && counts['Cabooses I run'];
    r.pickerAll = counts && counts[''];
    return r;
  });
  await browser.close();

  console.log('== A · no per-copy filter: every copy is drawn, as before ==');
  T('A1  two 6457s, three 6464-425s, two 3472s, one 2444, one manual = 9 rows', out.none.length === 9, out.none);
  T('A2  both 6457 copies are there', out.none.filter(k => k.startsWith('6457#')).length === 2, out.none);

  console.log('\n== B · a Group shows only the copies that are IN it ==');
  T('B1  the Group draws exactly the 4 copies in it (6457 b, 2444 c, 6464-425 d, the manual item)', out.group.length === 4 && out.group.includes('6457#2') && out.group.includes('2444#3') && out.group.includes('6464-425#4') && out.group.some(k => k.startsWith('P:Ertl')), out.group);
  T('B2  the 6457 copy NOT in the group is not drawn', !out.group.includes('6457#1'), out.group);
  T('B3  the row is not lost when the copy findPD returns is the one OUTSIDE the group (6457 a is first; b is in)', out.group.some(k => k.startsWith('6457#')), out.group);
  T('B4  the two 3472s (neither in the group) are gone', !out.group.some(k => k.startsWith('3472#')), out.group);
  T('B5  the picker\'s number for the Group is what picking it shows (4)', out.pickerGroup === 4, { picker: out.pickerGroup, drawn: out.group.length });
  T('B6  "All Groups" is the full list (9)', out.pickerAll === 9, out.pickerAll);

  console.log('\n== C · every per-copy filter answers copy by copy ==');
  T('C1  Sub Type "Runner" → the one 6457 copy that carries it', JSON.stringify(out.subType) === JSON.stringify(['6457#2']), out.subType);
  T('C2  Quick Entry → the one 6464-425 copy saved that way', JSON.stringify(out.quick) === JSON.stringify(['6464-425#4']), out.quick);
  T('C3  Imported → the one 6464-425 copy an import wrote', JSON.stringify(out.imported) === JSON.stringify(['6464-425#5']), out.imported);
  T('C4  Boxed → the one 6464-425 copy with a box', JSON.stringify(out.boxed) === JSON.stringify(['6464-425#6']), out.boxed);
  T('E1  no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
