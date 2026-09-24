// ═══════════════════════════════════════════════════════════════
// catalog_refresh_tests.js — v0.9.1801.
//
// Brad, 2026-09-24: changes to the master sheet must reach every device, not
// wait a day. Two holes, both proven on his own PC before the fix: the
// full-catalog lookup index NEVER re-fetched a catalog it had cached (three
// parts catalogs had no freshness stamp at all; Pre-War was 97 h old), and the
// Master Version tab was only displayed — in all-eras mode it was not even read.
//
// This suite RUNS the real functions lifted out of app-data.js against stubs:
//   A  _rrMasterVersionCheck — a new version clears every stamp, once
//   B  _buildAllErasLookupIndex — stale caches re-fetched and swapped in;
//      fresh ones, displayed ones and failed fetches handled right
//   C  a forced rebuild asked for mid-build is not lost
//   D  all-eras mode reads the Master Version
//   E  planted offenders — each turns its check red
// Run:  node tests/catalog_refresh_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const AD = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
function fakeLS(init) { const m = Object.assign({}, init || {}); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

function buildCheck(src) {
  const body = "var _MV_SEEN_KEY = 'lv_master_ver_seen';\n" + grab(src, 'function _rrMasterVersionCheck(v)') + '\nreturn _rrMasterVersionCheck;';
  // Returns (localStorage, eras, scheduler, version) => the function's own result.
  return (ls, eras, sched, v) => new Function('localStorage', 'REAL_ERA_IDS', '_scheduleLookupIndex', 'console', body)(ls, eras, sched, { log() {} })(v === undefined ? '1.76' : v);
}
function buildIndex(src) {
  const body = 'var _allIdxBuiltAt = 0, _allIdxBuilding = false, _allIdxComplete = false, _allIdxRerun = false;\n'
    + grab(src, 'async function _buildAllErasLookupIndex(force)') + '\nreturn _buildAllErasLookupIndex;';
  return (env) => new Function('state', 'REAL_ERA_IDS', 'idbGet', 'idbSet', 'localStorage', '_fetchMasterTabs', '_deduplicateMaster', '_scheduleLookupIndex', 'console',
    body)(env.state, env.eras, env.idbGet, env.idbSet, env.ls, env.fetch, x => x, env.sched || (() => {}), { log() {}, warn() {} });
}

section('A — a new Master Version marks every catalog out of date, once');
{
  const f = buildCheck(AD);
  const eras = ['pw', 'mth_o', 'mth_parts'];
  let sched = 0;
  const ls = fakeLS({ lv_master_cache_ts_pw: '111', lv_master_cache_ts_mth_o: '222', lv_master_cache_ts_mth_parts: '333' });
  const r1 = f(ls, eras, () => sched++);
  ok('a device that never recorded a version counts as changed (carries today\'s edits to devices in the field)', r1 === true);
  ok('every era\'s freshness stamp is cleared to 0', eras.every(e => ls.m['lv_master_cache_ts_' + e] === '0'));
  ok('the version is remembered', ls.m.lv_master_ver_seen === '1.76');
  ok('a forced lookup-index rebuild is scheduled', sched === 1);
  ls.m.lv_master_cache_ts_pw = '999';
  const r2 = f(ls, eras, () => sched++);
  ok('the SAME version again changes nothing — no re-download on every start', r2 === false && ls.m.lv_master_cache_ts_pw === '999' && sched === 1);
}

section('B — the lookup index re-fetches stale catalogs and swaps them in');
async function scenario(src) {
  const idb = {
    lv_master_cache_fresh: [{ itemNum: 'F1', _era: 'fresh' }],
    lv_master_cache_stale: [{ itemNum: 'OLD', _era: 'stale' }],
    lv_master_cache_shown: [{ itemNum: 'S1', _era: 'shown' }],
    lv_master_cache_broken: [{ itemNum: 'KEEP', _era: 'broken' }],
  };
  const ls = fakeLS({ lv_master_cache_ts_fresh: String(Date.now()), lv_master_cache_ts_stale: '0', lv_master_cache_ts_shown: '0', lv_master_cache_ts_broken: '0' });
  const fetched = [];
  const env = {
    state: { masterData: [{ itemNum: 'S1', _era: 'shown' }] },
    eras: ['fresh', 'stale', 'shown', 'missing', 'broken'],
    idbGet: async k => idb[k] || null,
    idbSet: (k, v) => { idb[k] = v; },
    ls,
    fetch: async e => { fetched.push(e); if (e === 'broken') { const a = []; a._failed = true; return a; } return [{ itemNum: e === 'stale' ? 'NEW' : 'M1' }]; },
  };
  await buildIndex(src)(env)(true);
  return { env, fetched, idb, ls };
}
async function main() {
  {
    // A-bis: a different version after the first
    const ls = fakeLS({ lv_master_ver_seen: '1.75', lv_master_cache_ts_pw: '5' });
    const f = buildCheck(AD);
    const r = f(ls, ['pw'], () => {});
    ok('1.75 → 1.76 is a change', r === true && ls.m.lv_master_cache_ts_pw === '0');
  }
  const { env, fetched, ls } = await scenario(AD);
  const nums = env.state.masterAllRows.map(r => r.itemNum).sort().join(',');
  ok('a stale cached catalog (no stamp) is fetched again', fetched.indexOf('stale') >= 0);
  ok('...and its fresh rows REPLACE the old ones (OLD gone, NEW present)', nums.indexOf('NEW') >= 0 && nums.indexOf('OLD') < 0, nums);
  ok('...and it gets a fresh stamp', +ls.m.lv_master_cache_ts_stale > 0);
  ok('a catalog never cached on this device is fetched (unchanged behaviour)', fetched.indexOf('missing') >= 0 && nums.indexOf('M1') >= 0);
  ok('a FRESH cached catalog is NOT fetched — no re-download without a reason', fetched.indexOf('fresh') < 0 && nums.indexOf('F1') >= 0);
  ok('a catalog on screen (its loader refreshes it) is NOT fetched twice', fetched.indexOf('shown') < 0);
  ok('a failed fetch keeps the cached rows — never a catalog replaced by nothing', nums.indexOf('KEEP') >= 0);
  ok('...and leaves it unstamped, so the next start tries again', ls.m.lv_master_cache_ts_broken === '0');
  ok('no row appears twice', env.state.masterAllRows.length === new Set(env.state.masterAllRows.map(r => r.itemNum + '|' + r._era)).size);

  section('C — a forced rebuild asked for mid-build is not lost');
  {
    let resolveFetch; const scheduled = [];
    const env2 = {
      state: { masterData: [] }, eras: ['x'],
      idbGet: async () => null, idbSet: () => {}, ls: fakeLS({}),
      fetch: () => new Promise(r => { resolveFetch = r; }),
      sched: (ms, force) => scheduled.push(force),
    };
    const build = buildIndex(AD)(env2);
    const p1 = build(true);
    await new Promise(r => setTimeout(r, 5));
    await build(true);   // arrives while the first is still fetching
    resolveFetch([{ itemNum: 'X1' }]);
    await p1;
    ok('the second request is re-run once the first finishes', scheduled.length === 1 && scheduled[0] === true, JSON.stringify(scheduled));
  }

  section('D — wiring');
  ok('_loadMasterVersion hands the version to _rrMasterVersionCheck', /state\.masterVersion = latest;\s*_rrMasterVersionCheck\(latest\.v\);/.test(AD));
  ok('all-eras mode now reads the Master Version (it never did)', /await loadAllErasMode\(\);\s*_loadMasterVersion\(\);/.test(AD));
  ok('single-era mode still reads it', /buildPartnerMap\(\);\s*_loadMasterVersion\(\);/.test(AD));

  section('E — planted offenders: each must turn red');
  async function offends(from, to, probe) { if (AD.indexOf(from) < 0) return 'anchor missing: ' + from.slice(0, 40); return await probe(AD.replace(from, to)); }
  let r;
  r = await offends("if (!(ts > 0) && !shown[era2]) stale.push(era2);", "", async src => { const s = await scenario(src); return s.fetched.indexOf('stale') < 0; });
  ok('OFFENDER: never re-fetch a cached catalog (the old behaviour) → stale not fetched', r === true, String(r));
  r = await offends("if (!(ts > 0) && !shown[era2])", "if (!(ts > 0))", async src => { const s = await scenario(src); return s.fetched.indexOf('shown') >= 0; });
  ok('OFFENDER: forget the on-screen guard → a displayed catalog is fetched twice', r === true, String(r));
  r = await offends("if (fresh && fresh.length && !fresh._failed)", "if (fresh)", async src => { const s = await scenario(src); return s.env.state.masterAllRows.every(x => x.itemNum !== 'KEEP'); });
  ok('OFFENDER: accept a failed read → the cached catalog is wiped', r === true, String(r));
  r = await offends("eras.forEach(function (e) { localStorage.setItem('lv_master_cache_ts_' + e, '0'); });", "", async src => { const ls = fakeLS({ lv_master_cache_ts_pw: '5' }); buildCheck(src)(ls, ['pw'], () => {}); return ls.m.lv_master_cache_ts_pw === '5'; });
  ok('OFFENDER: a new version that clears nothing → catalogs stay stale', r === true, String(r));
  r = await offends("if (seen === v) return false;", "", async src => { const ls = fakeLS({ lv_master_ver_seen: '1.76', lv_master_cache_ts_pw: '5' }); buildCheck(src)(ls, ['pw'], () => {}); return ls.m.lv_master_cache_ts_pw === '0'; });
  ok('OFFENDER: no same-version guard → every start re-downloads everything', r === true, String(r));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main();
