// ═══════════════════════════════════════════════════════════════
// catalog_refresh_gate_tests.js — v0.9.1818 (release readiness S3).
//
// MEASURED on Brad's desktop 2026-09-27: every start re-downloaded all 44
// maker catalogs from the sheet — 28 requests, ~12 s, seven reindex+repaint
// freezes between 8.5 s and 23 s — whether anything had changed or not.
// The app already knows when something changed: the Master Version row
// (v1801) zeroes every catalog's stamp.
//
// THE RULE (_rrCatalogsToRefresh, app.js — ONE function for both loops):
// a maker is refreshed when it did not come from the cache, when its stamp
// is zero, or when its stamp is older than CATALOG_REFRESH_MAX_AGE_DAYS
// (config.js). Otherwise the cached copy stands and nothing is downloaded.
// The version is read BEFORE the decision, so a changed sheet refreshes on
// the same start, not the next one.
//
// The real function is lifted and run against a fake localStorage.
// Section D plants each old habit back and the matching check must go red.
// Run:  node tests/catalog_refresh_gate_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const APPJS = APP('app.js'), CFG = APP('config.js'), DATA = APP('app-data.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
const DAYS = (() => { const m = CFG.match(/const CATALOG_REFRESH_MAX_AGE_DAYS = (\d+);/); return m ? Number(m[1]) : null; })();
function lift(src, store, days) {
  const ls = { getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null) };
  const body = 'var CATALOG_REFRESH_MAX_AGE_DAYS = ' + days + ';\n' + grab(src, '_rrCatalogsToRefresh') + '\nreturn _rrCatalogsToRefresh;';
  return new Function('localStorage', body)(ls);
}
const DAY = 86400000, NOW = 1_800_000_000_000;
const ERAS = ['pw', 'mpc', 'atlas', 'mth_o'];
const fresh = t => ({ 'lv_master_cache_ts_pw': String(t), 'lv_master_cache_ts_mpc': String(t), 'lv_master_cache_ts_atlas': String(t), 'lv_master_cache_ts_mth_o': String(t) });

section('A · the rule, on the real function');
ok('A0  CATALOG_REFRESH_MAX_AGE_DAYS is defined ONCE, in config.js, as a number', DAYS !== null && (APPJS.match(/(const|let|var)\s+CATALOG_REFRESH_MAX_AGE_DAYS/g) || []).length === 0, String(DAYS));
const f = lift(APPJS, fresh(NOW - DAY), DAYS);
ok('A1  everything cached and stamped yesterday → NOTHING to refresh (the normal start)', f(ERAS, new Set(ERAS), NOW).length === 0);
const f2 = lift(APPJS, Object.assign(fresh(NOW - DAY), { 'lv_master_cache_ts_mpc': '0' }), DAYS);
ok('A2  a zero stamp (Master Version changed / never fetched) → that maker, only', JSON.stringify(f2(ERAS, new Set(ERAS), NOW)) === '["mpc"]');
const f3 = lift(APPJS, {}, DAYS);
ok('A3  no stamps at all (version changed on every maker) → all of them', f3(ERAS, new Set(ERAS), NOW).length === ERAS.length);
ok('A4  a maker that did NOT come from the cache is refreshed even with a fresh stamp', JSON.stringify(f(ERAS, new Set(['pw', 'mpc', 'atlas']), NOW)) === '["mth_o"]');
const f5 = lift(APPJS, Object.assign(fresh(NOW - DAY), { 'lv_master_cache_ts_atlas': String(NOW - (DAYS + 1) * DAY) }), DAYS);
ok('A5  a stamp older than ' + DAYS + ' days → refreshed (the safety net)', JSON.stringify(f5(ERAS, new Set(ERAS), NOW)) === '["atlas"]');
const f6 = lift(APPJS, Object.assign(fresh(NOW - DAY), { 'lv_master_cache_ts_atlas': String(NOW - (DAYS - 1) * DAY) }), DAYS);
ok('A6  …but ' + (DAYS - 1) + ' days is still current', f6(ERAS, new Set(ERAS), NOW).length === 0);
ok('A7  a first-ever start (nothing hydrated) refreshes everything', f(ERAS, new Set(), NOW).length === ERAS.length);

section('B · wired in: version first, ONE decision for both loops, no second version read');
const bg = code(APPJS).slice(code(APPJS).indexOf('async function refreshAllErasInBackground'));
const iVer = bg.indexOf('await _loadMasterVersion()'), iDec = bg.indexOf('_rrCatalogsToRefresh(realEras, hydratedEras');
ok('B1  the Master Version is read (awaited) BEFORE the decision', iVer > 0 && iDec > iVer, JSON.stringify({ iVer, iDec }));
ok('B2  the parallel master loop takes its queue from refreshEras', /var _queue = refreshEras\.slice\(\)/.test(bg));
ok('B3  the sequential sets/catalogs/IS loop iterates refreshEras too', /for \(var i = 0; i < refreshEras\.length; i\+\+\)/.test(bg));
ok('B4  nothing in the background function walks realEras for a fetch any more', !/realEras\.slice\(\)|i < realEras\.length/.test(bg));
ok('B5  with nothing to refresh the function returns early, indicator cleared', /if \(!refreshEras\.length\) \{[\s\S]{0,400}refreshing = false[\s\S]{0,300}return;/.test(bg));
ok('B6  app-data.js no longer reads the version a second time after loadAllErasMode', !/await loadAllErasMode\(\);\s*\n\s*_loadMasterVersion\(\);/.test(code(DATA)));
ok('B7  hydratedEras is recorded during the cache hydrate', /hydratedEras\.add\(era\)/.test(code(APPJS)));

section('D · planted offenders — each must turn a check red');
const o1 = APPJS.replace('    if (!hydratedEras || !hydratedEras.has(e)) return true;\n', '');
ok('OFFENDER 1: forgetting the not-from-cache rule -> A4/A7 red', lift(o1, fresh(NOW - DAY), DAYS)(ERAS, new Set(['pw']), NOW).length !== 3);
const o2 = APPJS.replace("    return !ts || (now - ts) > maxAgeMs;", "    return !ts;");
ok('OFFENDER 2: dropping the age safety net -> A5 red', lift(o2, Object.assign(fresh(NOW - DAY), { 'lv_master_cache_ts_atlas': String(NOW - (DAYS + 1) * DAY) }), DAYS)(ERAS, new Set(ERAS), NOW).length === 0);
const o3 = APPJS.replace("    return !ts || (now - ts) > maxAgeMs;", "    return true;");
ok('OFFENDER 3: the old behaviour (refresh everything, always) -> A1 red', lift(o3, fresh(NOW - DAY), DAYS)(ERAS, new Set(ERAS), NOW).length === ERAS.length);
const o4 = APPJS.replace('      var _queue = refreshEras.slice();', '      var _queue = realEras.slice();');
ok('OFFENDER 4: the master loop back on realEras -> B2/B4 red', !/var _queue = refreshEras\.slice\(\)/.test(code(o4).slice(code(o4).indexOf('async function refreshAllErasInBackground'))));
const o5 = APPJS.replace("    try { if (typeof _loadMasterVersion === 'function') await _loadMasterVersion(); } catch (eMV) {}\n", '');
ok('OFFENDER 5: version no longer read before the decision -> B1 red', code(o5).slice(code(o5).indexOf('async function refreshAllErasInBackground')).indexOf('await _loadMasterVersion()') < 0);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
