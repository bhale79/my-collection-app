#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// lookup_index_once_tests.js — v0.9.1890: the whole-catalog lookup index is
// built ONCE per change
//
// [stated] Brad: "yes" (2026-10-06) — open-list item 7.
//
// A version-change start schedules two builds of the lookup index: a FORCED
// one 8 s after the Master Version check (_rrMarkCatalogsStale) and a plain
// one 6 s after loadAllErasMode returns. When the plain one fired first the
// forced request arrived mid-build, set the rerun flag, and the whole
// assembly ran again for nothing (v1884 measured 6 s + 8 s). A race: today's
// rebuilt start built once, v1884's twice.
//
// The rule (ONE place, _buildAllErasLookupIndex): a forced request carries the
// moment the change happened (`dirtyAt`, stamped by _scheduleLookupIndex); a
// build that started at or after it has seen the change — no rerun while it
// runs, no second build after. A change after a build started still reruns.
//
// A · the real builder + the real scheduler over a stand-in world with a
//     controllable clock and timer queue: the version-change start in BOTH
//     orders (plain first, forced first) → exactly one build.
// B · a change that lands AFTER a build started still forces a rebuild; a
//     direct forced call (no dirtyAt — the import) always builds; a plain
//     request within ten minutes of a build is still skipped; a plain request
//     during a build never sets a rerun.
// C · PLANTED: the v1889 builder + scheduler (no dirtyAt) builds TWICE in the
//     plain-first order.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const AD = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(text, sig) {
  const i = text.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0, started = false;
  for (let k = i; k < text.length; k++) {
    if (text[k] === '{') { d++; started = true; }
    else if (text[k] === '}') { d--; if (started && d === 0) return text.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}

// ── a stand-in world: a clock we advance by hand, a timer queue, an IDB with
//    one cached era per REAL_ERA_IDS, a fetch that counts, a build log ────────
function world(src, buildSig, schedSig) {
  const W = { now: 1000, timers: [], builds: [], fetches: [], logs: [] };
  const ls = { m: { lv_master_cache_ts_pw: '0' }, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } };
  const rows = { pw: [{ itemNum: '6464', rowId: 'A1', _era: 'pw' }], mpc: [{ itemNum: '9700', rowId: 'B1', _era: 'mpc' }] };
  const state = { masterData: [], masterByItemAll: null, masterAllRows: null };
  const Date_ = { now: () => W.now };
  const setTimeout_ = (fn, ms) => { W.timers.push({ at: W.now + (ms || 0), fn }); return W.timers.length; };
  const body = 'var _allIdxBuiltAt = 0, _allIdxBuilding = false, _allIdxComplete = false, _allIdxRerun = false, _allIdxStartedAt = 0;\n'
    + 'function _rrIndexByRowId(rows) { var m = new Map(); rows.forEach(function (r) { if (r && r.rowId) m.set(r.rowId, r); }); return m; }\n'
    + grab(src, buildSig) + '\n' + grab(src, schedSig) + '\n'
    + 'return { build: _buildAllErasLookupIndex, schedule: _scheduleLookupIndex, flags: function () { return { building: _allIdxBuilding, rerun: _allIdxRerun, builtAt: _allIdxBuiltAt, startedAt: _allIdxStartedAt }; } };';
  // every build "takes" 5 s of the clock: idbGet advances it so a second request can arrive mid-build
  const idbGet = async (k) => { W.now += 2500; return rows[k.replace('lv_master_cache_', '')] || null; };
  const idbSet = async () => {};
  const fetch = async (era) => { W.fetches.push(era); return rows[era] || []; };
  const consoleX = { log(m) { W.logs.push(String(m)); if (/full catalog ready/.test(String(m))) W.builds.push(W.now); }, warn(m) { W.logs.push('warn ' + m); } };
  const api = new Function('state', 'REAL_ERA_IDS', 'idbGet', 'idbSet', 'localStorage', '_fetchMasterTabs', '_deduplicateMaster', 'console', 'Date', 'setTimeout',
    body)(state, ['pw', 'mpc'], idbGet, idbSet, ls, fetch, x => x, consoleX, Date_, setTimeout_);
  // run the timer queue in time order, awaiting each build; `until` caps the clock
  W.run = async function (until) {
    for (;;) {
      W.timers.sort((a, b) => a.at - b.at);
      const t = W.timers.find(x => !x.done && x.at <= until); if (!t) break;
      t.done = true; if (W.now < t.at) W.now = t.at;
      await t.fn(); await new Promise(r => setImmediate(r));
    }
  };
  W.api = api; W.state = state; W.ls = ls; return W;
}
const NEW_BUILD = 'async function _buildAllErasLookupIndex(force, dirtyAt)', NEW_SCHED = 'function _scheduleLookupIndex(delayMs, force)';

(async () => {
  section('A · the version-change start builds ONCE, in either order');
  {
    // plain first: the boot's plain build at +6 s, the forced one (scheduled at the version check, t=0) at +8 s
    let W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(8000, true);      // _rrMarkCatalogsStale: forced, dirtyAt = now
    W.now += 500;                    // loadAllErasMode returns half a second later
    W.api.schedule(6000, false);     // the boot's plain build
    await W.run(W.now + 60000);
    T('A1 plain-first order: exactly ONE build (was two — the forced request arrived mid-build and reran)', W.builds.length === 1, { builds: W.builds, logs: W.logs });
    T('A2 … and the forced request was reported as already satisfied', W.logs.some(l => /already rebuilt since that change/.test(l)) || !W.flags, W.logs);
    T('A3 … the index holds both eras after the single build', W.state.masterByItemAll && W.state.masterByItemAll.size === 2);
    // forced first: a slow hydrate — the plain build is scheduled 3 s after the mark, so the forced fires first
    W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(8000, true);
    W.now += 3000;
    W.api.schedule(6000, false);
    await W.run(W.now + 60000);
    T('A4 forced-first order: exactly ONE build, the plain request skipped (as before)', W.builds.length === 1, W.builds);
    T('A5 no rerun flag left behind in either order', !W.api.flags().rerun && !W.api.flags().building);
  }

  section('B · nothing is missed');
  {
    // a change that lands AFTER a build started still reruns
    let W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(1, false);
    const p = W.run(W.now + 1);                    // the plain build starts now (and takes 5 s of clock)
    await new Promise(r => setImmediate(r));
    W.api.schedule(1, true);                       // a change lands mid-build: dirtyAt > startedAt
    await p; await W.run(W.now + 60000);
    T('B1 a change that lands AFTER a build started → rerun → two builds (the first could not have seen it)', W.builds.length === 2, W.builds);
    // a direct forced call with no dirtyAt (the spreadsheet import) always builds
    W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(1, true); await W.run(W.now + 60000);
    await W.api.build(true);
    T('B2 a direct forced call (no dirtyAt — the import) builds again, as before', W.builds.length === 2, W.builds);
    // a plain request within ten minutes of a build is skipped
    W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(1, true); await W.run(W.now + 60000);
    W.api.schedule(1, false); await W.run(W.now + 60000);
    T('B3 a plain request within ten minutes of a build is still skipped', W.builds.length === 1, W.builds);
    // a plain request during a build never sets a rerun
    W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(1, true);
    const p2 = W.run(W.now + 1); await new Promise(r => setImmediate(r));
    W.api.schedule(1, false); await p2; await W.run(W.now + 60000);
    T('B4 a plain request during a build never reruns', W.builds.length === 1, W.builds);
    // a forced request whose change is OLDER than the running build is satisfied by it
    W = world(AD, NEW_BUILD, NEW_SCHED);
    W.api.schedule(1, true);                       // dirtyAt = t0
    W.now += 100;
    W.api.schedule(1, true);                       // a second forced request a moment later, before any build
    await W.run(W.now + 60000);
    T('B5 two forced requests before any build → one build (the second change is older than the build that ran)', W.builds.length === 1, W.builds);
  }

  section('C · planted: the v1889 reading builds twice');
  {
    // the old builder: no dirtyAt — any forced request during a build reruns; the old scheduler passes no stamp
    const oldBuild = grab(AD, NEW_BUILD)
      .replace('async function _buildAllErasLookupIndex(force, dirtyAt)', 'async function _buildAllErasLookupIndex(force)')
      .replace(/  var _seen = [^\n]*\n  if \(_allIdxBuilding\) \{ if \(force && !_seen\) _allIdxRerun = true; return; \}\n/, '  if (_allIdxBuilding) { if (force) _allIdxRerun = true; return; }\n')
      .replace(/  if \(force && _seen && _allIdxBuiltAt\) \{[^\n]*\n/, '');
    const oldSched = grab(AD, NEW_SCHED).replace(/  var dirtyAt = [^\n]*\n/, '').replace('_buildAllErasLookupIndex(force, dirtyAt)', '_buildAllErasLookupIndex(force)');
    T('C0 the planted edits are real edits', oldBuild !== grab(AD, NEW_BUILD) && oldSched !== grab(AD, NEW_SCHED) && !/dirtyAt/.test(oldBuild) && !/dirtyAt/.test(oldSched));
    const planted = AD.replace(grab(AD, NEW_BUILD), oldBuild).replace(grab(AD, NEW_SCHED), oldSched);
    const W = world(planted, 'async function _buildAllErasLookupIndex(force)', NEW_SCHED);
    W.api.schedule(8000, true); W.now += 500; W.api.schedule(6000, false);
    await W.run(W.now + 60000);
    T('C1 PLANTED: the old code builds TWICE in the plain-first order (what v1884 measured)', W.builds.length === 2, W.builds);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
