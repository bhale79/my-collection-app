// ═══════════════════════════════════════════════════════════════
// nolionelstore_tests.js — 2026-11-16.
//
// Brad, 2026-11-16 (after reading Lionel's site terms, which forbid copying
// its content into a database without written permission):
//   15:05 CT "we are going to pull this down until we get permission"
//   15:09 CT "the parts yes, the rest leave as is, also stop the lionel crawls"
//   15:13 CT "yes" (build the app change)
//
// THE RULES THIS SUITE PROTECTS:
//   1. Lionel's own parts-store catalog ("Lionel Store Parts", era
//      lionelstore_parts) is OUT of the app: not in ERAS, REAL_ERA_IDS,
//      LOOKUP_ONLY_ERAS, ERA_TABS, ERA_SCALE, nor any app map — so no device
//      downloads it any more.
//   2. It IS in RETIRED_ERA_IDS, and every device deletes the copy it already
//      saved (_rrRetiredCatalogSweep, app-data.js): the saved rows and the
//      freshness stamp, on EVERY start (an old window may save them again),
//      never a catalog the app still reads.
//   3. The public record files (harvests/lionelstore-parts-*.json, served on
//      therailroster.com) hold only a one-line removed notice, no rows.
// Every scan here is first shown to catch a planted offender.
// To bring the catalog back when Lionel agrees, this suite is retired with it:
// PLAN_2026-11-16_LIONEL_STORE_PARTS_PULLDOWN.md "To put it back".
// Run:  node tests/nolionelstore_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const APPDIR = path.join(ROOT, 'app');
const read = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const GONE = 'lionelstore_parts';

// ── the REAL config.js, run (not regex-read) ──────────────────────────────
function runConfig(src) {
  const noop = () => {};
  const win = { addEventListener: noop, removeEventListener: noop, location: { href: '', hostname: 'test', search: '', pathname: '/' } };
  const ctx = {
    window: win, console: { log: noop, warn: noop, error: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: '' }, location: win.location,
    document: { addEventListener: noop, querySelector: () => null, getElementById: () => null, createElement: () => ({ style: {} }) },
    setTimeout: noop, clearTimeout: noop,
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__o = { ERAS, REAL_ERA_IDS, LOOKUP_ONLY_ERAS, RETIRED_ERA_IDS, ERA_TABS, ERA_SCALE };', ctx);
  return ctx.__o;
}
const cfgSrc = read('config.js');
let C = null;
try { C = runConfig(cfgSrc); } catch (e) { ok('config.js runs in a sandbox', false, e.message); }

section('1 · Lionel Store Parts is out of every catalog list');
if (C) {
  ok('not in ERAS', !(GONE in C.ERAS));
  ok('not in REAL_ERA_IDS (nothing downloads it)', C.REAL_ERA_IDS.indexOf(GONE) < 0);
  ok('not in LOOKUP_ONLY_ERAS', C.LOOKUP_ONLY_ERAS.indexOf(GONE) < 0);
  ok('not in ERA_TABS', !(GONE in C.ERA_TABS));
  ok('not in ERA_SCALE', !(GONE in C.ERA_SCALE));
  ok('no tab named "Lionel Store Parts" anywhere in ERA_TABS',
     !JSON.stringify(C.ERA_TABS).includes('Lionel Store Parts'));
  ok('the other parts catalogs are untouched',
     ['lionel_parts', 'mth_parts', 'traintender_parts', 'atlas_parts'].every(e => C.REAL_ERA_IDS.indexOf(e) >= 0 && C.LOOKUP_ONLY_ERAS.indexOf(e) >= 0 && C.ERAS[e]));
  // the run itself must be able to see the era: plant it back and look again
  const planted = cfgSrc.replace("'traintender_parts', 'atlas_parts', 'weaver'", "'traintender_parts', '" + GONE + "', 'atlas_parts', 'weaver'");
  let P = null; try { P = runConfig(planted); } catch (e) {}
  ok('…and that check catches it planted back into REAL_ERA_IDS', planted !== cfgSrc && P && P.REAL_ERA_IDS.indexOf(GONE) >= 0);
}

section('2 · RETIRED_ERA_IDS names it, and never a live catalog');
if (C) {
  ok('RETIRED_ERA_IDS holds lionelstore_parts', Array.isArray(C.RETIRED_ERA_IDS) && C.RETIRED_ERA_IDS.indexOf(GONE) >= 0);
  const clash = C.RETIRED_ERA_IDS.filter(e => C.REAL_ERA_IDS.indexOf(e) >= 0);
  ok('no retired id is also a catalog the app reads', clash.length === 0, clash.join(','));
  ok('…the clash check can fail', ['pw'].filter(e => C.REAL_ERA_IDS.indexOf(e) >= 0).length === 1);
}

section('3 · no app file still names the store catalog in its code');
{
  const codeOnly = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([;,{}()\]])[ \t]*\/\/.*$/gm, '$1');
  const BAD_ID = new RegExp('\\b' + GONE + '\\b', 'g');
  // ONE scan, run on the real files and on a planted file alike
  function scan(fileMap) {
    const hits = [];
    Object.keys(fileMap).forEach(f => {
      const c = codeOnly(fileMap[f]);
      const ids = (c.match(BAD_ID) || []).length;
      const tab = (c.match(/Lionel Store Parts/g) || []).length;
      // the ONE allowed mention: config.js's RETIRED_ERA_IDS list
      const allowed = f === 'config.js' && /const RETIRED_ERA_IDS = \[[^\]]*'lionelstore_parts'[^\]]*\];/.test(c) ? 1 : 0;
      if (ids - allowed > 0 || tab > 0) hits.push(f + ' (' + (ids - allowed) + ' id, ' + tab + ' tab)');
    });
    return hits;
  }
  const real = {};
  fs.readdirSync(APPDIR).filter(f => /\.(js|html)$/.test(f)).forEach(f => { real[f] = read(f); });
  const n = Object.keys(real).length;
  ok('the scan really read the app (' + n + ' files, config.js among them)', n > 50 && 'config.js' in real && 'app-data.js' in real, String(n));
  const hits = scan(real);
  ok('only RETIRED_ERA_IDS mentions it', hits.length === 0, hits.join('; '));
  const withPlant = Object.assign({}, real, { 'browse.js': real['browse.js'] + "\nconst _plant = { lionelstore_parts: 'modern' };\n" });
  ok('…and the same scan catches a planted map line in a real file', scan(withPlant).some(h => /^browse\.js/.test(h)));
  const withTab = Object.assign({}, real, { 'config.js': real['config.js'] + "\nconst _plant2 = { items: 'Lionel Store Parts' };\n" });
  ok('…and a planted tab name', scan(withTab).some(h => /^config\.js/.test(h)));
}

section('4 · every device deletes the copy it saved');
{
  const data = read('app-data.js');
  const sweepSrc = grab(data, '_rrRetiredCatalogSweep');
  ok('_rrRetiredCatalogSweep ships in app-data.js', !!sweepSrc);
  const shape = grab(data, '_rrCatalogShapeCheck') || '';
  ok('it runs first thing in _rrCatalogShapeCheck (both loaders, every start)',
     /^function _rrCatalogShapeCheck\(\) \{\s*_rrRetiredCatalogSweep\(\);/.test(shape));
  ok('…which both loaders call', /_rrCatalogShapeCheck\(\);/.test(data) && /_rrCatalogShapeCheck\(\)/.test(read('app.js')));
  function device(opts) {
    opts = opts || {};
    const ls = Object.assign({}, opts.ls || {});
    const removed = [];
    const ctx = {
      RETIRED_ERA_IDS: opts.retired || [GONE], REAL_ERA_IDS: opts.real || ['pw', 'lionel_parts'],
      localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
      console: { log() {} }, window: {},
    };
    if (!opts.noIdb) ctx.idbRemove = k => { removed.push(k); return Promise.resolve(); };
    vm.createContext(ctx);
    vm.runInContext(sweepSrc + '\n;this.__run = _rrRetiredCatalogSweep;', ctx);
    return { run: () => ctx.__run(), ls, removed };
  }
  if (sweepSrc) {
    let d = device({ ls: { ['lv_master_cache_ts_' + GONE]: '1794000000000', lv_master_cache_ts_pw: '1794000000000' } });
    const first = d.run();
    ok('the saved rows are deleted', d.removed.indexOf('lv_master_cache_' + GONE) >= 0, d.removed.join(','));
    ok('the freshness stamp is deleted', !(('lv_master_cache_ts_' + GONE) in d.ls));
    ok('a live catalog is left alone', d.ls.lv_master_cache_ts_pw === '1794000000000' && d.removed.length === 1);
    ok('it says what it removed', first.length === 1 && first[0] === GONE);
    d.ls['lv_master_cache_ts_' + GONE] = '1794000000001';   // an old window saved it again
    d.run();
    ok('the NEXT start deletes it again — never marked done', d.removed.length === 2 && !(('lv_master_cache_ts_' + GONE) in d.ls), String(d.removed.length));
    ok('…and nothing marks it done', !Object.keys(d.ls).some(k => /swept|retired/i.test(k)), Object.keys(d.ls).join(','));
    d = device({ retired: ['pw', GONE], real: ['pw'] });
    d.run();
    ok('an id that is ALSO a live catalog is never deleted (planted pw)', d.removed.indexOf('lv_master_cache_pw') < 0);
    d = device({ noIdb: true, ls: { ['lv_master_cache_ts_' + GONE]: '1' } });
    let threw = false; try { d.run(); } catch (e) { threw = true; }
    ok('storage not ready: no error, and the stamp still goes', !threw && !(('lv_master_cache_ts_' + GONE) in d.ls));
    // the sweep must be able to fail: plant a one-shot done-mark (the reviewed bug)…
    const oneShot = sweepSrc.replace("if (!e || live.indexOf(e) >= 0) return;",
      "if (!e || live.indexOf(e) >= 0) return; if (localStorage.getItem('lv_retired_swept_' + e) === '1') return; localStorage.setItem('lv_retired_swept_' + e, '1');");
    const ls2 = {}, rm2 = [];
    const ctx2 = { RETIRED_ERA_IDS: [GONE], REAL_ERA_IDS: [], localStorage: { getItem: k => (k in ls2 ? ls2[k] : null), setItem: (k, v) => { ls2[k] = v; }, removeItem: k => { delete ls2[k]; } }, console: { log() {} }, window: {}, idbRemove: k => rm2.push(k) };
    vm.createContext(ctx2); vm.runInContext(oneShot + '\n;_rrRetiredCatalogSweep(); _rrRetiredCatalogSweep();', ctx2);
    ok('…a planted one-shot sweep is caught (deletes only once)', oneShot !== sweepSrc && rm2.length === 1);
    // …and a copy that never calls idbRemove
    const broken = sweepSrc.replace("idbRemove('lv_master_cache_' + e);", 'void 0;');
    const ctx = { RETIRED_ERA_IDS: [GONE], REAL_ERA_IDS: [], localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, console: { log() {} }, window: {} };
    const rm = []; ctx.idbRemove = k => rm.push(k);
    vm.createContext(ctx); vm.runInContext(broken + '\n;_rrRetiredCatalogSweep();', ctx);
    ok('…and a sweep that never deletes is caught', broken !== sweepSrc && rm.length === 0);
  }
}

section('5 · the public record files hold no Lionel data');
// Our one shipping route can add or replace a file but not delete one, so each
// file stays with a one-line notice in place of the rows ([stated] Brad 15:24 CT
// "yes" to "go with the notice").
{
  const H = path.join(ROOT, 'harvests');
  const isStore = f => /^lionelstore-parts/i.test(f);
  // a notice file: small, valid JSON, says removed, carries no rows
  const isNotice = txt => {
    if (txt.length > 1000) return false;
    let d; try { d = JSON.parse(txt); } catch (e) { return false; }
    return !!d && !Array.isArray(d) && !!d.removed && !['rows', 'items', 'parts', 'data', 'header'].some(k => k in d);
  };
  const files = fs.readdirSync(H).filter(isStore);
  const bad = files.filter(f => !isNotice(fs.readFileSync(path.join(H, f), 'utf8')));
  ok('every harvests/lionelstore-parts* file is only a removed notice (' + files.length + ' files)', bad.length === 0, bad.join(','));
  ok('…the check catches a planted file that still holds rows',
     !isNotice(JSON.stringify({ tab: 'Lionel Store Parts', header: ['Item Number'], rows: [['6101155203']] })));
  ok('…and one that is the notice with rows added back',
     !isNotice(JSON.stringify({ removed: '2026-11-16', rows: [['6101155203']] })));
  ok('the Trainz-sourced Lionel Parts records stay', fs.existsSync(path.join(H, 'lionel-parts-1.json')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
