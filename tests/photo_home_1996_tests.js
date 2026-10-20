// ═══════════════════════════════════════════════════════════════
// photo_home_1996_tests.js — v0.9.1996. THE FOLDER RULE HAS TO BE RIGHT,
// NOT JUST TIDY.
//
// The first dry run of the tidy-up on Brad's own Drive (2026-10-19, v1995)
// moved nothing — and showed 14 of 36 answers were wrong or unsafe:
//   · his manual entries (10-2210 MTH, 30-9107 MTH, 279-4844 Menards,
//     RMT-92499-402) went to Other Items — the maker on the row was ignored;
//   · empty folders were guessed from the catalog by number alone
//     (1439 → Marx O, 1998 → S-Helper);
//   · "310-141" held the photos of his 84631 diesel, "58081" / "6-lionel jc"
//     / most of "unknown" held photos of items no longer in his collection,
//     and the rule judged them by the folder's NAME.
// Brad said "yes" to four changes. This suite proves each, against the REAL
// config.js + drive.js and a stand-in Drive (tests/lib/photo-home-lib.js):
//   M. a manual entry files under its own maker (catalog number AND maker);
//   G. a number nobody owns, listed under more than one era, is never filed
//      by catalog guess;
//   T. the tidy-up decides a folder by the inventory folders INSIDE it
//      (the inventory id is the identity); deleted-item photos and mixed
//      folders go to Other Items, labelled; empty folders are never moved,
//      only listed; a folder it could not read is left and reported;
//   P. planted offenders — each of the four rules taken out turns this red.
//
// Run:  node tests/photo_home_1996_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const { makeDrive, boot, DRV } = require('./lib/photo-home-lib.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Brad's real rows (inventory ids and numbers from his collection, 2026-10-19).
const OWNED = {
  m1: { inventoryId: '201', itemNum: '10-2210', owned: true, era: 'Manual', manufacturer: 'MTH', itemType: 'Trolley' },
  m2: { inventoryId: '202', itemNum: '30-9107', owned: true, era: 'Manual', manufacturer: 'MTH', itemType: 'Diesel' },
  m3: { inventoryId: '203', itemNum: '279-4844', owned: true, era: 'Manual', manufacturer: 'Menards', itemType: 'Accessory' },
  m4: { inventoryId: '204', itemNum: 'RMT-92499-402', owned: true, era: 'Manual', manufacturer: 'RMT', itemType: 'Boxcar' },
  m5: { inventoryId: '205', itemNum: 'ZZ-1', owned: true, era: 'Manual', manufacturer: 'Menards', itemType: 'Boxcar' },
  d1: { inventoryId: '136', itemNum: '84631', owned: true, era: 'mpc', itemType: 'Diesel Locomotive' },
  p1: { inventoryId: '26', itemNum: '6037', owned: true, era: 'pw', itemType: 'Caboose' },
  e1: { inventoryId: '133', itemNum: 'OTH-1966-133', owned: true, era: 'Manual', itemType: 'Other', manufacturer: 'Lionel' },
  e2: { inventoryId: '135', itemNum: 'PAP-1966-135', owned: true, era: 'Manual', itemType: 'Paper', subType: 'Dealer Paper' },
};
// The catalog, as rows the app holds (only number + era are read here).
const MASTER = [
  { itemNum: '10-2210', _era: 'mth_tinplate' },
  { itemNum: '30-9107', _era: 'mth_o' },
  { itemNum: '279-4844', _era: 'menards' },
  { itemNum: '1998', _era: 'shelper' }, { itemNum: '1998', _era: 'marx' }, { itemNum: '1998', _era: 'marx' },
  { itemNum: '58081', _era: 'marklin_1' },
  { itemNum: '1439', _era: 'marx' },
];
const CATALOG = { '1998': { _era: 'shelper' }, '58081': { _era: 'marklin_1' }, '1439': { _era: 'marx' } };

function bootB(opts) {
  const B = boot(Object.assign({ owned: OWNED, catalog: CATALOG }, opts || {}));
  B.ctx.state.masterData = MASTER;
  return B;
}

(async function () {
  // ═══════════════════════════════════════════════════════════
  section('M. A manual entry files under its own maker');
  {
    const B = bootB();
    const H = n => B.run('_rrPhotoHome(' + JSON.stringify(n) + ", '')");
    const P = n => H(n).path.join(' / ');
    ok('M1 10-2210 saved as MTH goes to MTH Tinplate (the catalog has it there)', P('10-2210') === 'MTH Tinplate' && H('10-2210').why === 'maker', P('10-2210'));
    ok('M2 30-9107 saved as MTH goes to MTH O', P('30-9107') === 'MTH O', P('30-9107'));
    ok('M3 279-4844 saved as Menards goes to Menards O', P('279-4844') === 'Menards O', P('279-4844'));
    ok('M4 RMT-92499-402 (not in the catalog) goes to RMT O — RMT has one folder', P('RMT-92499-402') === 'RMT O' && H('RMT-92499-402').why === 'maker', P('RMT-92499-402'));
    ok('M5 a Menards entry the catalog does not have is NOT guessed between Menards O and Menards HO', P('ZZ-1') === 'Other Items' && H('ZZ-1').why === 'fallback', P('ZZ-1'));
    ok('M6 an owned catalog item still goes by its own era (84631 → Lionel MPC/Modern)', P('84631') === 'Lionel MPC/Modern' && H('84631').why === 'era');
  }

  // ═══════════════════════════════════════════════════════════
  section('G. A number nobody owns is not filed by guess');
  {
    const B = bootB();
    const H = n => B.run('_rrPhotoHome(' + JSON.stringify(n) + ", '')");
    ok('G1 1998 (S-Helper AND Marx in the catalog) is not guessed — Other Items', H('1998').path.join('/') === 'Other Items' && H('1998').why === 'fallback', JSON.stringify(H('1998')));
    ok('G2 a number in exactly one catalog still goes there (58081 → Marklin Gauge 1)', H('58081').path[0] === 'Marklin Gauge 1');
    ok('G3 driveEraFolderNameFor says "unknown" for the two-era number', B.run("driveEraFolderNameFor('1998','')") === '');
  }

  // ═══════════════════════════════════════════════════════════
  section('T. The tidy-up decides by what is inside a folder');
  function world() {
    const D = makeDrive();
    D.add('Lionel MPC/Modern', 'PHOTOS');
    const f = {};
    const sub = (folder, inv, photos) => { const s = D.add(inv, folder); for (let i = 0; i < (photos || 1); i++) D.add(inv + '-' + i + '.jpg', s, 'image/jpeg'); return s; };
    f['310-141'] = D.add('310-141', 'PHOTOS'); sub(f['310-141'], '136');
    f['58081'] = D.add('58081', 'PHOTOS'); sub(f['58081'], '122');
    f['6-lionel jc'] = D.add('6-lionel jc', 'PHOTOS'); sub(f['6-lionel jc'], '154');
    f['unknown'] = D.add('unknown', 'PHOTOS'); sub(f['unknown'], '26'); sub(f['unknown'], '132'); D.add('unknown PAPER-FRONT.jpg', f['unknown'], 'image/jpeg');
    f['1966'] = D.add('Lionel · Other · "Add Up Your 1966 Lionel Profits"', 'PHOTOS'); sub(f['1966'], '133'); sub(f['1966'], '135');
    f['10-2210'] = D.add('10-2210', 'PHOTOS'); sub(f['10-2210'], '201');
    f['1436'] = D.add('1436', 'PHOTOS');
    f['1439'] = D.add('1439', 'PHOTOS');
    f['1998'] = D.add('1998', 'PHOTOS');
    f['DWG-290'] = D.add('DWG-290', 'PHOTOS'); D.add('DWG-290 FV.jpg', f['DWG-290'], 'image/jpeg');
    return { D: D, f: f };
  }
  {
    const W = world();
    const B = bootB({ drive: W.D });
    const dry = await B.run('driveTidyPhotoFolders({ dryRun: true })');
    const plan = {}; dry.plan.forEach(p => { plan[p.name.slice(0, 14)] = p.to + ' (' + p.why + ')'; });
    ok('T1 "310-141" holds his 84631\'s photos → Lionel MPC/Modern, by what is inside', plan['310-141'] === 'Lionel MPC/Modern (contents)', plan['310-141']);
    ok('T2 "58081" holds photos of an item no longer in the collection → Other Items (NOT Märklin)', plan['58081'] === 'Other Items (orphaned)', plan['58081']);
    ok('T3 "6-lionel jc" likewise → Other Items (orphaned)', plan['6-lionel jc'] === 'Other Items (orphaned)', plan['6-lionel jc']);
    ok('T4 "unknown" holds a postwar item AND a deleted one → Other Items (mixed)', plan['unknown'] === 'Other Items (mixed)', plan['unknown']);
    ok('T5 the 1966 folder holds two different items that live in different places → Other Items (mixed)', plan['Lionel · Other'] === 'Other Items (mixed)', plan['Lionel · Other']);
    ok('T6 a manual entry\'s folder follows its row\'s maker (10-2210 → MTH Tinplate)', plan['10-2210'] === 'MTH Tinplate (contents)', plan['10-2210']);
    ok('T7 a folder holding only a loose photo is still placed by its name (DWG-290)', plan['DWG-290'] === 'Paper › Drawings (number)', plan['DWG-290']);
    ok('T8 empty folders are listed, never planned (1436, 1439, 1998)',
       JSON.stringify(dry.empty.slice().sort()) === JSON.stringify(['1436', '1439', '1998']) && !('1439' in plan) && !('1998' in plan), JSON.stringify(dry.empty));

    const before = W.D.writes();
    ok('T9 the dry run wrote nothing', W.D.writes() === before);
    const r = await B.run('driveTidyPhotoFolders({})');
    const topNow = W.D.childrenOf('PHOTOS').map(x => x.name).sort();
    ok('T10 the real run leaves only main folders plus the three empty ones at the top',
       JSON.stringify(topNow) === JSON.stringify(['1436', '1439', '1998', 'Lionel MPC/Modern', 'MTH Tinplate', 'Other Items', 'Paper']), JSON.stringify(topNow));
    ok('T11 nothing failed, nothing skipped, the run is complete', r.failed.length === 0 && r.skipped.length === 0 && r.listComplete === true && r.moved === 7,
       JSON.stringify({ moved: r.moved, failed: r.failed, skipped: r.skipped }));
    const inside = id => W.D.files.find(x => x.id === id).parents[0];
    ok('T12 310-141 kept its id and now sits in Lionel MPC/Modern', inside(W.f['310-141']) === W.D.byName('Lionel MPC/Modern')[0].id);
  }
  {
    // A folder whose inside cannot be read is left where it is and named.
    const W = world();
    const B = bootB({ drive: W.D });
    const real = W.D.request;
    B.ctx.driveRequest = async function (m, url, body) {
      if (m === 'GET' && decodeURIComponent(url).indexOf("'" + W.f['58081'] + "' in parents") !== -1) throw new Error('Drive refused (403)');
      return real(m, url, body);
    };
    const r = await B.run('driveTidyPhotoFolders({})');
    ok('T13 a folder Drive will not show is left alone and reported', r.unread.length === 1 && r.unread[0] === '58081' &&
       W.D.files.find(x => x.id === W.f['58081']).parents[0] === 'PHOTOS', JSON.stringify(r.unread));
    ok('T14 …and the run says it was not complete (so the daily run tries again)', r.listComplete === false && /would not show/.test(r.warning || ''), String(r.warning));
  }

  // ═══════════════════════════════════════════════════════════
  section('P. Planted offenders turn this suite red');
  function planted(oldText, newText) {
    ok('setup: "' + oldText.slice(0, 50).trim() + '…" is in drive.js exactly once', DRV.split(oldText).length === 2);
    return DRV.replace(oldText, newText);
  }
  {
    const src = planted("  const mk = _rrPhotoMakerEra(pd.manufacturer, pd.itemNum);\n", "  const mk = '';\n");
    const B = bootB({ driveSrc: src });
    ok('P1 without the maker step 10-2210 falls to Other Items (M1 catches it)', B.run("_rrPhotoHome('10-2210','').path[0]") === 'Other Items');
  }
  {
    const src = planted("    if (Object.keys(eraSeen).length > 1) return '';\n", '');
    const B = bootB({ driveSrc: src });
    ok('P2 without the two-era check 1998 is guessed as S-Helper (G1 catches it)', B.run("_rrPhotoHome('1998','').path[0]") === 'S-Helper Service S');
  }
  {
    const src = planted('    if (subs.length) {\n', '    if (false) {\n');
    const W = world();
    const B = bootB({ driveSrc: src, drive: W.D });
    const dry = await B.run('driveTidyPhotoFolders({ dryRun: true })');
    const p = dry.plan.find(x => x.name === '58081');
    ok('P3 judged by name, "58081" goes to Märklin (T2 catches it)', p && p.to === 'Marklin Gauge 1', JSON.stringify(p));
  }
  {
    const src = planted('    if (!inside.length) { empty.push(f.name); continue; }\n', '');
    const W = world();
    const B = bootB({ driveSrc: src, drive: W.D });
    const dry = await B.run('driveTidyPhotoFolders({ dryRun: true })');
    ok('P4 without the empty-folder rule 1439 is planned (T8 catches it)', dry.plan.some(x => x.name === '1439'));
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL  suite crashed: ' + (e && e.stack)); process.exit(1); });
