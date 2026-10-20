// ═══════════════════════════════════════════════════════════════
// photo_home_1995_tests.js — v0.9.1995. EVERY ITEM FOLDER GOES INSIDE A
// MAIN FOLDER.
//
// Brad, 2026-10-19, looking at "My Collection Photos": "why does the dwgs all
// have individual folders, those all should be under paper and then a sub
// folder dwgs" → "all items need to be in a main folder" → "yes" to
// Paper → Drawings and Other Items.
//
// His own Drive had 36 folders loose at the top: 18 drawings, boxes
// ("6-36814-BOX"), set numbers (1436, 1439), keepsakes (the lanterns), and a
// few made before era filing existed. The old rule was written down and
// tested: "an unknown era leaves the folder at the top level". This suite
// proves the new one:
//
//   A. `_rrPhotoHome` names a main folder for every kind of item and NEVER
//      answers "the top level" (real config.js + real drive.js in a vm).
//   B. `driveEnsureItemFolder` makes the folder inside that main folder,
//      against a stand-in Drive that keeps parents — nothing is ever created
//      directly under "My Collection Photos" except main folders.
//   C. The tidy-up (`driveTidyPhotoFolders`) moves every loose folder in,
//      keeps every folder id, leaves main + feature folders alone, refuses to
//      split an item's photos across two same-named folders, and is a no-op
//      the second time. A dry run touches nothing.
//   D. Nothing else in app/ makes a folder at the top of My Collection Photos
//      except the app's own feature folders (a source scan with planted
//      offenders).
//   P. Planted offenders: the OLD step 2 (top-level fallback), a decider
//      that answers "nowhere", and a tidy-up that does not check for a
//      same-named folder — each must turn this suite red.
//
// Run:  node tests/photo_home_1995_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { makeDrive, boot, DRV, ROOT } = require('./lib/photo-home-lib.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Brad's real kinds of row (numbers from his Drive, 2026-10-19).
const OWNED = {
  a: { itemNum: '2328', owned: true, era: 'pw', itemType: 'Diesel' },
  b: { itemNum: 'DWG-1957-386', owned: true, era: 'Manual', itemType: 'Paper', subType: 'Blueprint / Drawing' },
  c: { itemNum: '6-36814', owned: true, era: 'mpc', itemType: 'Boxcar' },
  d: { itemNum: 'I. C. RR Lantern', owned: true, era: 'Manual', itemType: 'Memorabilia' },
  e: { itemNum: 'CAT-1957-001', owned: true, era: 'Manual', itemType: 'Catalog', subType: 'Consumer' },
  f: { itemNum: 'PAP-1960-123', owned: true, era: 'Manual', itemType: 'Paper', subType: 'Something New — odd' },
  g: { itemNum: 'Lenny the Lion Swinging Lantern (LCCA Repro)', owned: true, era: 'Manual', itemType: 'Other' },
};
const SETS = [{ setNum: '1436' }, { setNum: '1439' }];
const CATALOG = { '2328': { _era: 'pw' }, '10-2210': { _era: 'mth_tinplate' } };

(async function () {
  // ═══════════════════════════════════════════════════════════
  section('A. Every kind of item has a main folder — never the top level');
  {
    const B = boot({ owned: OWNED, sets: SETS, catalog: CATALOG });
    const home = function (n) { return B.run('_rrPhotoHome(' + JSON.stringify(n) + ", '')"); };
    const P = function (n) { return home(n).path.join(' / '); };
    ok('A1 an owned postwar item goes to its era folder', P('2328') === 'Lionel Postwar' && home('2328').why === 'era', P('2328'));
    ok('A2 an owned drawing goes to Paper / Drawings (its paper type)', P('DWG-1957-386') === 'Paper / Drawings' && home('DWG-1957-386').why === 'owned', P('DWG-1957-386'));
    ok('A3 a drawing nobody owns any more still goes to Paper / Drawings (by its number)', P('DWG-290') === 'Paper / Drawings' && home('DWG-290').why === 'number', P('DWG-290'));
    ok('A4 a box folder files with the item it belongs to (6-36814-BOX)', P('6-36814-BOX') === 'Lionel MPC/Modern', P('6-36814-BOX'));
    ok('A5 a set number goes to the Sets tab\'s era (1436)', P('1436') === 'Lionel Postwar' && home('1436').why === 'set', P('1436'));
    ok('A6 owned memorabilia goes to Other Items', P('I. C. RR Lantern') === 'Other Items' && home('I. C. RR Lantern').why === 'owned', P('I. C. RR Lantern'));
    ok('A7 an owned catalog goes to Paper / Catalogs', P('CAT-1957-001') === 'Paper / Catalogs', P('CAT-1957-001'));
    ok('A8 a paper type the list does not know goes to Paper / Other Paper', P('PAP-1960-123') === 'Paper / Other Paper', P('PAP-1960-123'));
    ok('A9 older section numbers: 8157-PAP is paper, 8057-CON a catalog, 8259-MU Other Items',
       P('8157-PAP') === 'Paper / Other Paper' && P('8057-CON') === 'Paper / Catalogs' && P('8259-MU') === 'Other Items',
       [P('8157-PAP'), P('8057-CON'), P('8259-MU')].join(' | '));
    ok('A10 an owned manual train oddball with no section goes to Other Items', P('Lenny the Lion Swinging Lantern (LCCA Repro)') === 'Other Items');
    ok('A11 a catalog item nobody owns goes to the catalog\'s era', P('10-2210') === 'MTH Tinplate' && home('10-2210').why === 'era', P('10-2210'));
    const odd = ['unknown', '', '  ', "it's", '6-lionel jc', 'Lionel · Other · "Add Up Your 1966 Lionel Profits"', '58081'];
    const bad = odd.filter(function (n) { const h = home(n); return !Array.isArray(h.path) || !h.path.length || !h.path.every(Boolean); });
    ok('A12 every odd name still gets a main folder (Other Items when nothing places it)', bad.length === 0 &&
       home('unknown').why === 'fallback' && P('unknown') === 'Other Items', JSON.stringify(bad));
    ok('A13 rrPhotoHomeFor hands back a copy (a caller cannot change the rule)',
       B.run("(function(){ var a = rrPhotoHomeFor('DWG-1'); a.push('x'); return rrPhotoHomeFor('DWG-1').length; })()") === 2);
  }

  // ═══════════════════════════════════════════════════════════
  section('B. New folders are made inside their main folder');
  async function ensureCase(opts) {
    const B = boot(Object.assign({ owned: OWNED, sets: SETS, catalog: CATALOG }, opts || {}));
    const made = {};
    for (const n of ['9999', 'DWG-1957-386', 'DWG-290', '2328', '1436', 'I. C. RR Lantern']) {
      try { made[n] = await B.run('driveEnsureItemFolder(' + JSON.stringify(n) + ')'); }
      catch (e) { made[n] = 'THREW: ' + e.message; }
    }
    return { B: B, made: made };
  }
  {
    const { B, made } = await ensureCase();
    const top = B.D.childrenOf('PHOTOS').map(f => f.name).sort();
    const MAIN = ['Lionel Postwar', 'Other Items', 'Paper'];
    ok('B1 nothing but main folders is made at the top of My Collection Photos',
       top.every(n => MAIN.indexOf(n) !== -1), JSON.stringify(top));
    const parentName = function (id) {
      const f = B.D.files.find(x => x.id === id); if (!f) return '?';
      const p = B.D.files.find(x => x.id === f.parents[0]); return p ? p.name : f.parents[0];
    };
    ok('B2 an item nothing places goes inside Other Items', parentName(made['9999']) === 'Other Items', parentName(made['9999']));
    ok('B3 drawings go inside Paper / Drawings', parentName(made['DWG-1957-386']) === 'Drawings' && parentName(made['DWG-290']) === 'Drawings' &&
       parentName(B.D.byName('Drawings')[0] && B.D.byName('Drawings')[0].id) === 'Paper');
    ok('B4 the second drawing reuses Paper and Drawings — one of each', B.D.byName('Paper').length === 1 && B.D.byName('Drawings').length === 1,
       'Paper ' + B.D.byName('Paper').length + ', Drawings ' + B.D.byName('Drawings').length);
    ok('B5 an era item and a set go inside the era folder', parentName(made['2328']) === 'Lionel Postwar' && parentName(made['1436']) === 'Lionel Postwar');
    ok('B6 nothing threw', Object.keys(made).every(k => !/^THREW/.test(made[k])), JSON.stringify(made));
  }
  {
    // A folder already loose at the top is found, not duplicated (old folders keep working).
    const D = makeDrive();
    const loose = D.add('DWG-1957-386', 'PHOTOS');
    const B = boot({ drive: D, owned: OWNED });
    const id = await B.run("driveEnsureItemFolder('DWG-1957-386')");
    ok('B7 an existing loose folder is still used — no second copy', id === loose && D.byName('DWG-1957-386').length === 1);
  }
  {
    // Device A files a drawing; device B (its own cache) finds it inside Paper / Drawings.
    const D = makeDrive();
    const A = boot({ drive: D, owned: OWNED });
    const aId = await A.run("driveEnsureItemFolder('DWG-1957-386')");
    const B2 = boot({ drive: D, owned: {} });
    await B2.run('_driveEraFolders()');
    const bId = await B2.run("driveEnsureItemFolder('DWG-1957-386')");
    ok('B8 a second device finds a drawing inside Paper / Drawings — one folder', aId === bId && D.byName('DWG-1957-386').length === 1,
       'count ' + D.byName('DWG-1957-386').length);
    const found = await B2.run("driveFindItemFolder('DWG-1957-386')");
    ok('B9 the find-only lookup (photo thumbnails) looks inside Paper / Drawings too', /DWG|F\d/.test(String(found)) && String(found).indexOf(aId) !== -1, String(found));
  }

  // ═══════════════════════════════════════════════════════════
  section('C. The tidy-up moves every loose folder in');
  function brad() {
    const D = makeDrive();
    const eraPW = D.add('Lionel Postwar', 'PHOTOS');
    D.add('Lionel MPC/Modern', 'PHOTOS');
    const parts = D.add('Parts', 'PHOTOS');
    const manuals = D.add('Manuals', 'PHOTOS');
    const filed = D.add('2328', eraPW);                      // already filed
    const ids = {};
    ['DWG-1957-386', 'DWG-290', '6-36814-BOX', '1436', '1439', 'I. C. RR Lantern', 'unknown', '2328-dup']
      .forEach(n => { ids[n] = D.add(n === '2328-dup' ? '2328' : n, 'PHOTOS'); D.add(n + ' FV.jpg', ids[n], 'image/jpeg'); });
    // v0.9.1996: each loose folder holds a loose photo, so it is placed by its
    // NAME (folders holding inventory folders, and empty ones, are photo_home_1996's).
    return { D: D, eraPW: eraPW, parts: parts, manuals: manuals, filed: filed, ids: ids };
  }
  {
    const W = brad();
    const B = boot({ drive: W.D, owned: OWNED, sets: SETS, catalog: CATALOG });
    const before = W.D.writes();
    const dry = await B.run('driveTidyPhotoFolders({ dryRun: true })');
    ok('C1 a dry run touches nothing', W.D.writes() === before && dry.dryRun === true, 'writes ' + (W.D.writes() - before));
    const plan = {}; dry.plan.forEach(p => { plan[p.name] = (plan[p.name] ? plan[p.name] + ' + ' : '') + p.to; });
    ok('C2 the plan names a main folder for every loose folder', dry.planned === 8 &&
       plan['DWG-1957-386'] === 'Paper \u203a Drawings' && plan['6-36814-BOX'] === 'Lionel MPC/Modern' &&
       plan['1436'] === 'Lionel Postwar' && plan['I. C. RR Lantern'] === 'Other Items' && plan['unknown'] === 'Other Items',
       JSON.stringify(dry.plan));
    ok('C3 main and feature folders are never in the plan', !('Parts' in plan) && !('Manuals' in plan) && !('Lionel Postwar' in plan));

    const r = await B.run('driveTidyPhotoFolders({})');
    const top = W.D.childrenOf('PHOTOS').map(f => f.name).sort();
    const MAIN = ['Lionel MPC/Modern', 'Lionel Postwar', 'Manuals', 'Other Items', 'Paper', 'Parts'];
    ok('C4 afterwards only main and feature folders sit at the top', top.join('|') === MAIN.join('|') ||
       (top.length === MAIN.length + 1 && top.filter(n => n === '2328').length === 1), JSON.stringify(top));
    ok('C5 every moved folder kept its id (links in the sheet still work)',
       W.D.files.find(f => f.id === W.ids['DWG-290']).name === 'DWG-290' &&
       W.D.files.find(f => f.id === W.ids['DWG-290']).parents[0] === W.D.byName('Drawings')[0].id);
    ok('C6 Parts and Manuals did not move', W.D.files.find(f => f.id === W.parts).parents[0] === 'PHOTOS' &&
       W.D.files.find(f => f.id === W.manuals).parents[0] === 'PHOTOS');
    ok('C7 a loose 2328 is NOT moved beside the filed 2328 — photos never split', r.skipped.length === 1 &&
       r.skipped[0].name === '2328' && W.D.files.find(f => f.id === W.ids['2328-dup']).parents[0] === 'PHOTOS' &&
       W.D.childrenOf(W.eraPW).filter(f => f.name === '2328').length === 1, JSON.stringify(r.skipped));
    ok('C8 the result counts what it did', r.moved === 7 && r.failed.length === 0 && r.listComplete === true, JSON.stringify({ moved: r.moved, failed: r.failed }));
    const again = await B.run('driveTidyPhotoFolders({})');
    ok('C9 running it again moves nothing', again.moved === 0 && again.planned === 1, JSON.stringify({ moved: again.moved, planned: again.planned }));
  }

  // ═══════════════════════════════════════════════════════════
  section('D. Nothing else makes a folder at the top of My Collection Photos');
  function scanTop(files) {
    const bad = [];
    const feature = boot().run('RR_PHOTO_HOME.FEATURE');
    files.forEach(function (fd) {
      const re = /driveFindOrCreateFolder\(\s*([^,()]+?)\s*,\s*driveCache\.photosId\s*\)/g;
      let m;
      while ((m = re.exec(fd.src)) !== null) {
        const arg = m[1].trim();
        const lit = /^'([^']*)'$/.exec(arg) || /^"([^"]*)"$/.exec(arg);
        if (!lit || feature.indexOf(lit[1]) === -1) bad.push(fd.f + ': ' + m[0]);
      }
    });
    return bad;
  }
  const appFiles = fs.readdirSync(path.join(ROOT, 'app')).filter(f => /\.(js|html)$/.test(f))
    .map(f => ({ f: f, src: fs.readFileSync(path.join(ROOT, 'app', f), 'utf8') }));
  const live = scanTop(appFiles);
  ok('D1 every folder made straight under My Collection Photos is a named feature folder', live.length === 0, live.join(' ; '));
  ok('D2 PLANTED: an item folder made at the top is caught',
     scanTop([{ f: 'x.js', src: "await driveFindOrCreateFolder(itemNum, driveCache.photosId);" }]).length === 1);
  ok('D3 PLANTED: a feature-looking name not on the list is caught',
     scanTop([{ f: 'x.js', src: "await driveFindOrCreateFolder('Stuff', driveCache.photosId);" }]).length === 1);
  ok('D4 the scan does see the real feature folders (it is reading the files)',
     appFiles.some(fd => /driveFindOrCreateFolder\('Manuals', driveCache\.photosId\)/.test(fd.src)));

  // ═══════════════════════════════════════════════════════════
  section('P. Planted offenders turn this suite red');
  {
    // P1 — the OLD step 2: unknown era → top level.
    const NEW2 = "    const parentId = await _driveEnsureHomePath(rrPhotoHomeFor(key, eraHint));\n";
    ok('P1 setup: the new step 2 is in drive.js exactly once', DRV.split(NEW2).length === 2);
    const old = DRV.replace(NEW2, "    let parentId = driveCache.photosId;\n    try { const eraName = driveEraFolderNameFor(key, eraHint); if (eraName) parentId = await _driveEnsureHomePath([eraName]); } catch (e) {}\n");
    const B = boot({ driveSrc: old, owned: OWNED });
    await B.run("driveEnsureItemFolder('9999')");
    await B.run("driveEnsureItemFolder('DWG-290')");
    const loose = B.D.childrenOf('PHOTOS').map(f => f.name).filter(n => ['9999', 'DWG-290'].indexOf(n) !== -1);
    ok('P1 the old top-level fallback is caught by B1/B2 (folders land loose)', loose.length === 2, JSON.stringify(loose));
  }
  {
    // P2 — a decider that answers "nowhere".
    const FB = "  return { path: [H.OTHER], why: 'fallback' };\n";
    ok('P2 setup: the fallback line is in drive.js exactly once', DRV.split(FB).length === 2);
    const B = boot({ driveSrc: DRV.replace(FB, "  return { path: [], why: 'fallback' };\n"), owned: OWNED });
    let threw = '';
    try { await B.run("driveEnsureItemFolder('9999')"); } catch (e) { threw = e.message; }
    ok('P2 an empty answer is refused, never turned into a top-level folder', /main folder/.test(threw) &&
       B.D.childrenOf('PHOTOS').length === 0, threw || '(no throw)');
    ok('P2 …and A12 would have caught it', B.run("_rrPhotoHome('unknown','').path.length") === 0);
  }
  {
    // P3 — a tidy-up that does not check for a same-named folder.
    const CHK = "      if ((there.files || []).some(function (x) { return x.id !== p.id; })) {";
    ok('P3 setup: the same-name check is in drive.js exactly once', DRV.split(CHK).length === 2);
    const W = brad();
    const B = boot({ driveSrc: DRV.replace(CHK, '      if (false) {'), drive: W.D, owned: OWNED, sets: SETS, catalog: CATALOG });
    await B.run('driveTidyPhotoFolders({})');
    ok('P3 without the check the loose 2328 lands beside the filed one (C7 catches it)',
       W.D.childrenOf(W.eraPW).filter(f => f.name === '2328').length === 2);
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL  suite crashed: ' + (e && e.stack)); process.exit(1); });
