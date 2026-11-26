#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// noroundhouse (2026-11-16) — the Roundhouse HO catalog is ON HOLD.
//
// [stated] Brad 2026-11-16 16:36 CT: "put it on hold for now" (after "well do we
// need to put the athern stuff on hold on our master catalog?"). Every row of the
// master tab "Roundhouse HO" was read from athearn.com; its terms allow copying
// only to place an order or for authorized retailers, anything else needs Horizon
// Hobby's written permission. Brad is asking. Until they answer:
//
//   1. the catalog is out of every list the app reads a catalog from
//   2. it IS in RETIRED_ERA_IDS, so every device deletes the copy it saved
//      (the sweep nolionelstore built — tests/nolionelstore_tests.js proves the sweep)
//   3. no app file still names the era or the tab in its code — two allowed
//      mentions: RETIRED_ERA_IDS, and the RHO badge (a piece a member already owns)
//   4. the maker WORD stays: "Roundhouse" is still a maker a member can save, it
//      just has no home catalog; Bluford Shops is untouched
//   5. real Chromium, the real app: a Roundhouse piece a member ALREADY added stays
//      in My Collection, is not re-homed onto another catalog's row, and nothing
//      throws; Roundhouse is not offered as a catalog
//   P  planted offenders — each check is shown going red
//
// NOT changed by this build: the master tab itself (977 rows, untouched) and the
// record file in harvests/. To put it back: DEPLOY_noroundhouse_READY.md.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app');
let pass = 0, fail = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c || x === undefined ? '' : '  -> ' + String(x).slice(0, 400))); c ? pass++ : fail++; }
function section(t) { console.log('\n== ' + t + ' =='); }
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
function plant(src, from, to, label) { if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches'); return src.replace(from, to); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const HELD = 'roundhouse_ho', TAB = 'Roundhouse HO';

// ── the REAL config files, run (not regex-read) ───────────────────────────
function world(files) {
  const noop = () => {};
  const win = { addEventListener: noop, removeEventListener: noop, location: { href: '', hostname: 'test', search: '', pathname: '/', origin: 'https://test' } };
  const ctx = { window: win, console: { log: noop, warn: noop, error: noop }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: 'test' }, location: win.location, document: undefined, setTimeout: noop, setInterval: noop, clearTimeout: noop, addEventListener: noop };
  vm.createContext(ctx);
  vm.runInContext(files['config.js'] + '\n;window.__cfg = { ERAS, REAL_ERA_IDS, LOOKUP_ONLY_ERAS, RETIRED_ERA_IDS, ERA_TABS, ERA_SCALE, _rrMakerHit };', ctx);
  vm.runInContext(files['onboarding-config.js'] + '\n;window.__wic = WHAT_I_COLLECT;', ctx);
  vm.runInContext(files['era-badges-config.js'] + '\n;window.__badges = ERA_BADGES;', ctx);
  const mapFn = grab(files['wizard-photos.js'], '_eraForMfr');
  const mapLine = (files['wizard-photos.js'].match(/^\s*var map = \{[^\n]*\};[^\n]*$/m) || [''])[0];
  let eraForMfr = null;
  if (mapFn && mapLine) { const c2 = {}; vm.createContext(c2); vm.runInContext(mapFn.replace('{', '{\n' + mapLine + '\n') + '\n;this.__f = _eraForMfr;', c2); eraForMfr = c2.__f; }
  return { CFG: win.__cfg, WIC: win.__wic, BADGES: win.__badges, eraForMfr, files };
}
const FILES = {}; ['config.js', 'onboarding-config.js', 'era-badges-config.js', 'browse.js', 'research.js', 'wizard-photos.js', 'app.js'].forEach(f => FILES[f] = read(f));

// every list a catalog sits on — ONE function, run on the real files and on planted ones
function listsNaming(W) {
  const { CFG, WIC, files } = W, on = [];
  if (HELD in CFG.ERAS) on.push('ERAS');
  if (CFG.REAL_ERA_IDS.indexOf(HELD) >= 0) on.push('REAL_ERA_IDS');
  if (CFG.LOOKUP_ONLY_ERAS.indexOf(HELD) >= 0) on.push('LOOKUP_ONLY_ERAS');
  if (HELD in CFG.ERA_TABS) on.push('ERA_TABS');
  if (JSON.stringify(CFG.ERA_TABS).includes('"' + TAB + '"')) on.push('ERA_TABS tab name');
  if (HELD in CFG.ERA_SCALE) on.push('ERA_SCALE');
  if (WIC.eraOrder.indexOf(HELD) >= 0) on.push('What I Collect era order');
  if (JSON.stringify(WIC).indexOf('"' + HELD + '":') >= 0) on.push('What I Collect scale/colour map');
  if (WIC.MANUFACTURERS && WIC.MANUFACTURERS.roundhouse) on.push('What I Collect maker choice');
  if (new RegExp('\\b' + HELD + ":\\s*'").test(files['browse.js'])) on.push('Master Catalog browse group');
  { const r = files['research.js'], i = r.indexOf('var ERA_GROUP'); if (new RegExp("'" + HELD + "'").test(r.slice(i, i + 1500))) on.push('research page group'); }
  if (W.eraForMfr && W.eraForMfr('roundhouse')) on.push('Photo ID maker → catalog (' + W.eraForMfr('roundhouse') + ')');
  return on;
}

let W = null;
try { W = world(FILES); } catch (e) { ok('the config files run in a sandbox', false, e && e.stack || e); }

section('1 · Roundhouse HO is out of every catalog list');
if (W) {
  const on = listsNaming(W);
  ok('on none of the 12 lists a catalog sits on', on.length === 0, on.join(', '));
  ok('Photo ID\'s maker map was really read (Bluford → bluford_n)', !!W.eraForMfr && W.eraForMfr('bluford') === 'bluford_n', W.eraForMfr && W.eraForMfr('bluford'));
}

section('2 · RETIRED_ERA_IDS names it, so every device drops its saved copy');
if (W) {
  const C = W.CFG;
  ok('RETIRED_ERA_IDS holds roundhouse_ho', Array.isArray(C.RETIRED_ERA_IDS) && C.RETIRED_ERA_IDS.indexOf(HELD) >= 0, JSON.stringify(C.RETIRED_ERA_IDS));
  ok('…and still holds lionelstore_parts (the first hold is not undone)', C.RETIRED_ERA_IDS.indexOf('lionelstore_parts') >= 0);
  const clash = C.RETIRED_ERA_IDS.filter(e => C.REAL_ERA_IDS.indexOf(e) >= 0);
  ok('no retired id is also a catalog the app reads', clash.length === 0, clash.join(','));
  // the REAL sweep, on a stand-in device that holds a Roundhouse copy
  const sweepSrc = grab(read('app-data.js'), '_rrRetiredCatalogSweep');
  ok('_rrRetiredCatalogSweep ships in app-data.js', !!sweepSrc);
  if (sweepSrc) {
    const device = (retired, real) => {
      const ls = { ['lv_master_cache_ts_' + HELD]: '1794000000000', lv_master_cache_ts_bluford_ho: '1794000000000' }, removed = [];
      const ctx = { RETIRED_ERA_IDS: retired, REAL_ERA_IDS: real, console: { log() {} }, window: {}, idbRemove: k => { removed.push(k); return Promise.resolve(); },
        localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } } };
      vm.createContext(ctx); vm.runInContext(sweepSrc + '\n;this.__r = _rrRetiredCatalogSweep();', ctx);
      return { ls, removed, said: ctx.__r };
    };
    const d = device(C.RETIRED_ERA_IDS, C.REAL_ERA_IDS);
    ok('the real lists: the saved Roundhouse rows are deleted', d.removed.indexOf('lv_master_cache_' + HELD) >= 0, d.removed.join(','));
    ok('…and its freshness stamp', !(('lv_master_cache_ts_' + HELD) in d.ls));
    ok('…Bluford Shops HO\'s copy is left alone', d.ls.lv_master_cache_ts_bluford_ho === '1794000000000' && d.removed.indexOf('lv_master_cache_bluford_ho') < 0);
    const p = device(C.RETIRED_ERA_IDS.filter(e => e !== HELD), C.REAL_ERA_IDS);
    ok('P1 PLANTED (roundhouse_ho left off RETIRED_ERA_IDS): the saved copy STAYS on the device', p.removed.indexOf('lv_master_cache_' + HELD) < 0 && (('lv_master_cache_ts_' + HELD) in p.ls));
  }
}

section('3 · no app file still names the era or the tab in its code');
{
  const codeOnly = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([;,{}()\]])[ \t]*\/\/.*$/gm, '$1');
  const BAD_ID = new RegExp('\\b' + HELD + '\\b', 'g'), BAD_TAB = new RegExp("['\"`]" + TAB + "['\"`]", 'g');
  function scan(fileMap) {
    const hits = [];
    Object.keys(fileMap).forEach(f => {
      const c = codeOnly(fileMap[f]);
      let ids = (c.match(BAD_ID) || []).length; const tab = (c.match(BAD_TAB) || []).length;
      if (f === 'config.js' && /const RETIRED_ERA_IDS = \[[^\]]*'roundhouse_ho'[^\]]*\];/.test(c)) ids -= 1;                // allowed: the retired list
      if (f === 'era-badges-config.js' && /^\s*roundhouse_ho:\s*'RHO',/m.test(c)) ids -= 1;                                // allowed: the badge on an owned piece
      if (ids > 0 || tab > 0) hits.push(f + ' (' + ids + ' id, ' + tab + ' tab)');
    });
    return hits;
  }
  const real = {};
  fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f)).forEach(f => { real[f] = read(f); });
  const n = Object.keys(real).length;
  ok('the scan really read the app (' + n + ' files, config.js among them)', n > 50 && 'config.js' in real && 'wizard-photos.js' in real, String(n));
  const hits = scan(real);
  ok('only RETIRED_ERA_IDS and the RHO badge mention it', hits.length === 0, hits.join('; '));
  ok('P2 PLANTED (a browse-group line back in browse.js): the scan catches it', scan(Object.assign({}, real, { 'browse.js': real['browse.js'] + "\nconst _plant = { roundhouse_ho: 'modern' };\n" })).some(h => /^browse\.js/.test(h)));
  ok('P3 PLANTED (the tab name back as a value): the scan catches it', scan(Object.assign({}, real, { 'config.js': real['config.js'] + "\nconst _plant2 = { items: 'Roundhouse HO' };\n" })).some(h => /^config\.js/.test(h)));
  ok('…and a comment that names the tab is not a hit (the hold is explained in config.js)', /Roundhouse HO/.test(real['config.js']) && scan({ 'config.js': real['config.js'] }).length === 0);
}

section('4 · the maker word stays; Bluford Shops is untouched');
if (W) {
  const hit = (s) => { const h = W.CFG._rrMakerHit(s); return h ? h[1] : ''; };
  ok('"Roundhouse" and "Athearn Roundhouse" still read as the maker Roundhouse', hit('Roundhouse') === 'roundhouse' && hit('Athearn Roundhouse') === 'roundhouse', [hit('Roundhouse'), hit('Athearn Roundhouse')].join());
  ok('the brand label "Roundhouse" stays (_BRAND_LABELS)', /roundhouse:'Roundhouse'/.test((FILES['app.js'].match(/var _BRAND_LABELS = \{[^\n]*\}/) || [''])[0]));
  ok('the RHO badge stays for a piece already owned', (W.BADGES.shortLabel || {})[HELD] === 'RHO');
  ok('Photo ID gives Roundhouse NO home catalog (the save decides, as for any maker without one)', W.eraForMfr('roundhouse') === '', W.eraForMfr('roundhouse'));
  const C = W.CFG;
  ok('Bluford Shops N and HO are still catalogs the app reads', ['bluford_n', 'bluford_ho'].every(e => C.ERAS[e] && C.REAL_ERA_IDS.indexOf(e) >= 0 && C.ERA_TABS[e] && C.ERA_SCALE[e]) && C.ERA_TABS.bluford_ho.items === 'Bluford Shops HO');
  ok('…and still a What I Collect maker', !!W.WIC.MANUFACTURERS['bluford shops'] && W.WIC.eraOrder.indexOf('bluford_n') >= 0 && W.WIC.eraOrder.indexOf('bluford_ho') >= 0);
}

section('P · planted (the lists)');
{
  const back = (file, from, to, label, want) => {
    let on = null; try { on = listsNaming(world(Object.assign({}, FILES, { [file]: plant(FILES[file], from, to, label) }))); } catch (e) { on = ['ERR ' + (e && e.message)]; }
    ok('PLANTED (' + label + '): section 1 goes red', on.some(x => want.test(x)), on.join(', '));
  };
  back('config.js', ", 'ahm_ho', 'ahm_n'];", ", 'ahm_ho', 'ahm_n', 'roundhouse_ho'];", 'P4 era back in REAL_ERA_IDS', /^REAL_ERA_IDS$/);
  back('config.js', "  bluford_ho:     { items: 'Bluford Shops HO' },", "  bluford_ho:     { items: 'Bluford Shops HO' },\n  roundhouse_ho:  { items: 'Roundhouse HO' },", 'P5 the tab back in ERA_TABS', /^ERA_TABS/);
  back('config.js', "bluford_n: 'N', bluford_ho: 'HO',", "bluford_n: 'N', bluford_ho: 'HO', roundhouse_ho: 'HO',", 'P6 era back in ERA_SCALE', /^ERA_SCALE$/);
  back('onboarding-config.js', "'blma_z', 'ahm_ho', 'ahm_n'],", "'blma_z', 'ahm_ho', 'ahm_n', 'roundhouse_ho'],", 'P7 era back in the What I Collect order', /era order/);
  back('onboarding-config.js', "    'bluford shops': { id: 'bluford shops'", "    roundhouse: { id: 'roundhouse', label: 'Roundhouse', default: false },\n    'bluford shops': { id: 'bluford shops'", 'P8 the maker choice back', /maker choice/);
  back('browse.js', "  bluford_ho:     'modern',", "  bluford_ho:     'modern',\n  roundhouse_ho:  'modern',", 'P9 the browse group back', /browse group/);
  back('research.js', "'blma_z', 'ahm_ho', 'ahm_n'] };", "'blma_z', 'ahm_ho', 'ahm_n', 'roundhouse_ho'] };", 'P10 the research group back', /research page/);
  back('wizard-photos.js', ", bluford: 'bluford_n' /*", ", bluford: 'bluford_n', roundhouse: 'roundhouse_ho' /*", 'P11 Photo ID sends Roundhouse to the held catalog', /Photo ID/);
}

// ═════ 5 · real Chromium, the real app ═════════════════════════════════════
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('FAILED  —  noroundhouse_tests needs playwright'); process.exit(1); }
const SCENE = () => {
  const out = {};
  const PW = 'Lionel PW - Items';
  // the catalog as a device holds it AFTER the hold: no Roundhouse rows. One Lionel
  // row that shares the digits 1166 stands in for "a row on another catalog".
  state.masterData = [
    { itemNum: '6464', variation: '1', itemType: 'Boxcar', _era: 'pw', _tab: PW, yearProd: '1953', description: 'Boxcar 6464', roadName: 'Western Pacific', rowId: 'PW6464AAAA' },
    { itemNum: '1166', variation: '', itemType: 'Boxcar', _era: 'pw', _tab: PW, yearProd: '1950', description: 'A Lionel 1166', roadName: '', rowId: 'PW1166AAAA' },
    { itemNum: '31020', variation: '', itemType: 'Caboose', _era: 'bluford_ho', _tab: 'Bluford Shops HO', yearProd: '', description: 'Short Body Bay Window Caboose', roadName: 'Union Pacific', gauge: 'HO', rowId: 'BL31020AAA' },
  ];
  _rebuildMasterIndex();
  state.companionData = []; state.setData = []; state.isData = {}; state.soldData = {}; state.wantData = state.wantData || {}; state.mySetsData = {};
  // what a member who added Roundhouse pieces before the hold has in their sheet
  state.personalData = {
    a: { owned: true, itemNum: '6464', variation: '1', era: 'pw', manufacturer: 'Lionel', inventoryId: '1', row: 2 },
    b: { owned: true, itemNum: 'RND1166', variation: '', era: 'roundhouse_ho', manufacturer: 'Roundhouse', itemType: 'Boxcar', description: "36' Old Time Wood Box", roadName: 'Chesapeake & Ohio', gauge: 'HO', masterRowId: 'RHPLAINBOX', inventoryId: '2', row: 3 },
    c: { owned: true, itemNum: 'RND-1166', variation: '', era: 'roundhouse_ho', manufacturer: 'Roundhouse', itemType: 'Hopper', description: "24' Ore Car with Load", roadName: 'Bessemer & Lake Erie', gauge: 'HO', inventoryId: '3', row: 4 },
  };
  state.personalSheetId = 'SHEET'; state.user = { name: 'Tester', email: 'tester@example.com' };
  _currentEra = 'all';
  var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-browse').classList.add('active');
  const T = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = { threw: String(e && e.message || e) }; } };
  // the one lookup every screen uses — the owned Roundhouse pieces must find NO row
  T('fmEra', () => { const m = findMaster('RND1166', '', { era: 'roundhouse_ho' }); return m ? m.rowId : ''; });
  T('fmBare', () => { const m = findMaster('RND1166'); return m ? m.rowId : ''; });
  T('fmDash', () => { const m = findMaster('RND-1166', '', { era: 'roundhouse_ho' }); return m ? m.rowId : ''; });
  T('eraOf', () => ({ held: _eraOf(state.personalData.b), lionel: _eraOf(state.personalData.a), unknown: _eraOf({ era: 'no_such_era', manufacturer: 'Somebody' }) }));
  T('pwOwned', () => Object.keys(state.personalData).filter(k => _eraOf(state.personalData[k]) === 'pw').length);
  T('list', () => {
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
    state._collSection = 'all'; state.currentPage = 1;
    filterOwned(); populateFilters(); window._rrBrowseSig = null; renderBrowse();
    return { nums: (state.filteredData || []).filter(r => !r._setFold).map(r => r.itemNum).sort(), text: (document.getElementById('page-browse').textContent || '').replace(/\s+/g, ' ').slice(0, 6000) };
  });
  T('dash', () => { buildDashboard(); return { ok: true }; });
  T('eras', () => ({ inERAS: 'roundhouse_ho' in ERAS, real: REAL_ERA_IDS.indexOf('roundhouse_ho') >= 0, enabled: (typeof _isEraEnabled === 'function') ? !!_isEraEnabled('roundhouse_ho') : null,
    retired: (window.RETIRED_ERA_IDS || []).slice(), swept: (typeof _rrRetiredCatalogSweep === 'function') ? _rrRetiredCatalogSweep() : null }));
  return out;
};
(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  async function run(planted) {
    const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', r => {
      const u = r.request().url(); if (!u.startsWith('file://')) return r.abort();
      const clean = u.split('?')[0], name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
      if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    let out; try { out = await pg.evaluate(SCENE); } catch (e) { out = { crashed: String(e && e.message || e) }; }
    out.errs = errs; await pg.close(); return out;
  }
  try {
    section('5 · the real app: a Roundhouse piece a member already owns');
    const R = await run(null);
    const J = (o) => String(JSON.stringify(o)).slice(0, 400);
    if (R.crashed) ok('the scene runs', false, R.crashed);
    else {
      ok('5a the app holds no Roundhouse catalog (not in ERAS, not read, not offered) and names it retired', R.eras && R.eras.inERAS === false && R.eras.real === false && !R.eras.enabled && R.eras.retired.indexOf('roundhouse_ho') >= 0 && (R.eras.swept || []).indexOf('roundhouse_ho') >= 0, J(R.eras));
      ok('5b findMaster, asked for the owned piece with its own era: no row, no error', R.fmEra === '' && R.fmDash === '', J([R.fmEra, R.fmDash]));
      ok('5c …and asked with the number alone: never the Lionel 1166 row', R.fmBare !== 'PW1166AAAA' && !(R.fmBare && R.fmBare.threw), J(R.fmBare));
      ok('5d My Collection still lists both owned Roundhouse pieces beside the Lionel one', R.list && R.list.nums && R.list.nums.join(' ') === '6464 RND-1166 RND1166', J(R.list && (R.list.nums || R.list)));
      ok('5e …with the member\'s own words for them (their saved description)', R.list && /Old Time Wood Box/.test(R.list.text || '') && /Ore Car/.test(R.list.text || ''), J(R.list && String(R.list.text).slice(0, 300)));
      ok('5f the dashboard draws', R.dash && R.dash.ok === true, J(R.dash));
      ok('5g the dashboard counts the held pieces under their OWN era, never as Postwar (1 Postwar piece owned, not 3)', R.eraOf && R.eraOf.held === 'roundhouse_ho' && R.eraOf.lionel === 'pw' && R.pwOwned === 1, J([R.eraOf, R.pwOwned]));
      ok('5i …and an era the app never heard of still falls back as before (only a RETIRED era is kept)', R.eraOf && R.eraOf.unknown === 'pw', J(R.eraOf));
      ok('5h no page errors', (R.errs || []).length === 0, (R.errs || []).join(' | '));
    }
    section('P · planted (the app)');
    {
      // the held catalog switched back on in config.js only — the app must then show it as a catalog again, so 5a can fail
      const cfg = read('config.js');
      const bad = plant(plant(cfg, ", 'ahm_ho', 'ahm_n'];", ", 'ahm_ho', 'ahm_n', 'roundhouse_ho'];", 'REAL_ERA_IDS'),
        "const RETIRED_ERA_IDS = ['lionelstore_parts', 'roundhouse_ho'];", "const RETIRED_ERA_IDS = ['lionelstore_parts'];", 'RETIRED_ERA_IDS');
      const R2 = await run({ 'config.js': bad });
      ok('P12 PLANTED (the catalog back in REAL_ERA_IDS and off the retired list): 5a goes red', !R2.crashed && R2.eras && (R2.eras.real === true || R2.eras.retired.indexOf('roundhouse_ho') < 0), R2.crashed || J(R2.eras));
      const dash = read('dashboard.js');
      const R3 = await run({ 'dashboard.js': plant(dash, "  if (e && typeof RETIRED_ERA_IDS !== 'undefined' && RETIRED_ERA_IDS.indexOf(e) >= 0) return e;\n", "", 'the held-era line') });
      ok('P13 PLANTED (the dashboard forgets held eras): 5g goes red — the two Roundhouse pieces count as Postwar', !R3.crashed && R3.eraOf && R3.eraOf.held === 'pw' && R3.pwOwned === 3, R3.crashed || J([R3.eraOf, R3.pwOwned]));
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
