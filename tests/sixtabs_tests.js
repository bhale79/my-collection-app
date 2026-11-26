#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SIX MAKERS, FIRST TWO — the tabs "Bluford Shops N", "Bluford Shops HO" and
// "Roundhouse HO" become visible to the app (sixtabs, 2026-11-15).
// [stated] Brad 2026-11-15 12:29 CT: "we need to add these to the master list with
// their own tabs, so can you plan that and build that when done. just don't ship it
// till i say so". Melissa's makers; PLAN_2026-11-15_SIX_MAKERS.md.
//
//   A  config, evaluated for real: every list a catalog must be on (the rosstab /
//      Phase C list) carries all three, with the tabs' exact names
//   B  the maker words: "Bluford" is Bluford Shops; "Roundhouse" is the maker only as
//      the whole field, "Athearn Roundhouse" or "Roundhouse HO / RND" — never Atlas's
//      roundhouse kit or a building
//   C  real Chromium, the REAL app: Athearn uses RND-1166 and RND1166 for two
//      DIFFERENT cars — each number finds its own car; a Bluford number is tagged
//      BLUFORD SHOPS · N; the maker filter shows only that maker
//   P  planted offenders — each turns its own check red
//
// noroundhouse (2026-11-16, [stated] Brad 16:36 CT "put it on hold for now"): the
// Roundhouse HO catalog is ON HOLD until Horizon Hobby gives written permission
// (tests/noroundhouse_tests.js proves it is out). So A now covers the two Bluford
// tabs only; B still proves the maker WORD "Roundhouse" (a member's own piece keeps its
// maker); C keeps Athearn's two real numbers, RND-1166 and RND1166, as the canary for
// "a dash is part of the number" on stand-in rows of a catalog the app still reads.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (x || ''))); c ? pass++ : fail++; }
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
function plant(src, from, to, label) { if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches'); return src.replace(from, to); }
const J = (o) => String(JSON.stringify(o)).slice(0, 400);
const NEW = [
  { id: 'bluford_n', tab: 'Bluford Shops N', mfr: 'Bluford Shops', scale: 'N', wic: 'n' },
  { id: 'bluford_ho', tab: 'Bluford Shops HO', mfr: 'Bluford Shops', scale: 'HO', wic: 'ho' },
];
function world(files) {
  const ctx = { window: {}, console, localStorage: undefined, navigator: { userAgent: 'test' }, location: { hostname: 'test', search: '', origin: 'https://test' }, document: undefined,
    setTimeout() {}, setInterval() {}, addEventListener() {} };
  ctx.window.addEventListener = function () {};
  vm.createContext(ctx);
  vm.runInContext(files['config.js'] + '\n;window.__cfg = { ERAS, REAL_ERA_IDS, ERA_SCALE, ERA_TABS, RR_MAKER_WORDS, _rrMakerHit };', ctx);
  vm.runInContext(files['onboarding-config.js'] + '\n;window.__wic = WHAT_I_COLLECT;', ctx);
  vm.runInContext(files['era-badges-config.js'] + '\n;window.__badges = ERA_BADGES;', ctx);
  return { CFG: ctx.window.__cfg, WIC: ctx.window.__wic, BADGES: ctx.window.__badges, files };
}
const FILES = {}; ['config.js', 'onboarding-config.js', 'era-badges-config.js', 'browse.js', 'research.js', 'item-search-filters-config.js', 'app.js', 'wizard-photos.js', 'wizard-suggestions.js'].forEach(f => FILES[f] = read(f));
function checksA(W) {
  const r = [];
  const { CFG, WIC, BADGES, files } = W;
  NEW.forEach(e => {
    const d = CFG.ERAS[e.id] || {};
    r.push(['A ' + e.id + ': ERAS, label = prefix = the tab name "' + e.tab + '", maker ' + e.mfr, d.label === e.tab && d.prefix === e.tab && d.manufacturer === e.mfr, J(d)]);
    r.push(['A ' + e.id + ': REAL_ERA_IDS (or the index never fetches the tab)', CFG.REAL_ERA_IDS.indexOf(e.id) >= 0]);
    r.push(['A ' + e.id + ': ERA_SCALE ' + e.scale, CFG.ERA_SCALE[e.id] === e.scale, CFG.ERA_SCALE[e.id]]);
    r.push(['A ' + e.id + ': ERA_TABS items = the tab name', (CFG.ERA_TABS[e.id] || {}).items === e.tab, J(CFG.ERA_TABS[e.id])]);
    r.push(['A ' + e.id + ': a badge (ERA_BADGES.shortLabel)', !!(BADGES.shortLabel || {})[e.id], J(BADGES.shortLabel && BADGES.shortLabel[e.id])]);
    r.push(['A ' + e.id + ': What I Collect — in the era order, under scale "' + e.wic + '", with a colour', WIC.eraOrder.indexOf(e.id) >= 0 && JSON.stringify(WIC).indexOf('"' + e.id + '":"' + e.wic + '"') >= 0 && !!WIC.eraColors[e.id]]);
    r.push(['A ' + e.id + ': the maker choice key = its maker lowercased (an allow-list — a mismatch HIDES the tab)', !!WIC.MANUFACTURERS[e.mfr.toLowerCase()]]);
    r.push(['A ' + e.id + ': Master Catalog browse group (modern)', new RegExp('\\b' + e.id + ":\\s*'modern'").test(files['browse.js'])]);
    { const bl = (files['app.js'].match(/var _BRAND_LABELS = \{[^\n]*\}/) || [''])[0];
      r.push(['A ' + e.id + ': the brand label "' + e.mfr + '" (_BRAND_LABELS)', bl.indexOf(":'" + e.mfr + "'") >= 0 && new RegExp("(?:'" + e.mfr.toLowerCase() + "'|\\b" + e.mfr.toLowerCase() + "):'" + e.mfr + "'").test(bl), bl.slice(-160)]); }
    r.push(['A ' + e.id + ': the research page group', new RegExp("'" + e.id + "'").test(files['research.js'].slice(files['research.js'].indexOf('var ERA_GROUP'), files['research.js'].indexOf('var ERA_GROUP') + 1500))]);
  });
  return r;
}
console.log('\n== A · config, for real ==');
checksA(world(FILES)).forEach(c => ok(c[0], c[1], c[2]));

console.log('\n== B · the maker words ==');
{
  const W = world(FILES), hit = (s) => { const h = W.CFG._rrMakerHit(s); return h ? h[1] : ''; };
  ok('B1 "Bluford Shops" and "Bluford" are Bluford Shops', hit('Bluford Shops') === 'bluford shops' && hit('bluford') === 'bluford shops', hit('Bluford Shops'));
  ok('B2 "Roundhouse" as the whole maker field, "Athearn Roundhouse", "Roundhouse HO 40\' Box" are Roundhouse', hit('Roundhouse') === 'roundhouse' && hit('Athearn Roundhouse') === 'roundhouse' && hit("Roundhouse HO 40' High Cube Box") === 'roundhouse', [hit('Roundhouse'), hit('Athearn Roundhouse')].join());
  ok('B3 "Atlas N 2843 3-Stall Roundhouse Kit" is Atlas, never Roundhouse; "engine roundhouse building" names no maker', hit('Atlas N 2843 3-Stall Roundhouse Kit') === 'atlas' && hit('engine roundhouse building') === '', [hit('Atlas N 2843 3-Stall Roundhouse Kit'), hit('engine roundhouse building')].join('|'));
  ok('B5 not Roundhouse: "Frank\'s Roundhouse HO…", "Walthers Cornerstone Roundhouse HO Scale Kit"; Roundhouse: "MDC Roundhouse HO…", "Roundhouse RND1166" (no dash)',
    hit("Frank's Roundhouse HO Scale Car") !== 'roundhouse' && hit('Walthers Cornerstone Roundhouse HO Scale Kit') !== 'roundhouse' && hit('MDC Roundhouse HO 50ft Box') === 'roundhouse' && hit('Roundhouse RND1166') === 'roundhouse',
    [hit("Frank's Roundhouse HO Scale Car"), hit('Walthers Cornerstone Roundhouse HO Scale Kit'), hit('MDC Roundhouse HO 50ft Box'), hit('Roundhouse RND1166')].join('|'));
  ok('B4 "bluford" is a search maker word (so "60011 bluford" finds the number); "roundhouse" is not (a building)', /'bluford'/.test(FILES['item-search-filters-config.js']) && !/'roundhouse'/.test(FILES['item-search-filters-config.js']));
}

console.log('\n== P · planted (config) ==');
{
  const p1 = Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], ", 'bluford_n', 'bluford_ho', 'blma_n',", ", 'bluford_n', 'blma_n',", 'REAL_ERA_IDS') });
  ok('P1 PLANTED (Bluford Shops HO left off REAL_ERA_IDS): A goes red', checksA(world(p1)).some(c => !c[1] && /bluford_ho: REAL_ERA_IDS/.test(c[0])));
  const p2 = Object.assign({}, FILES, { 'onboarding-config.js': plant(FILES['onboarding-config.js'], "    'bluford shops': { id: 'bluford shops'", "    'bluford-shops': { id: 'bluford shops'", 'maker key') });
  ok('P2 PLANTED (the maker choice keyed "bluford-shops"): A goes red', checksA(world(p2)).some(c => !c[1] && /bluford_n: the maker choice/.test(c[0])));
  const p3 = Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], "  bluford_ho:     { items: 'Bluford Shops HO' },", "  bluford_ho:     { items: 'Bluford HO' },", 'tab name') });
  ok('P3 PLANTED (a tab name that is not the sheet\'s): A goes red', checksA(world(p3)).some(c => !c[1] && /bluford_ho: ERA_TABS/.test(c[0])));
  const p4 = Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], "|^\\s*(?:mdc\\s+)?roundhouse\\s+(?:ho\\b|rnd)/i, 'roundhouse'", "|\\broundhouse\\b/i, 'roundhouse'", 'maker word') });
  const W4 = world(p4), h4 = W4.CFG._rrMakerHit('engine roundhouse building');
  ok('P4 PLANTED ("roundhouse" anywhere = the maker): B3 would go red', !!h4 && h4[1] === 'roundhouse', J(h4));
  const p4b = Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], "|^\\s*(?:mdc\\s+)?roundhouse\\s+(?:ho\\b|rnd)/i, 'roundhouse'", "|\\broundhouse\\s+(?:ho|rnd)\\b/i, 'roundhouse'", 'maker word, unanchored') });
  const h4b = world(p4b).CFG._rrMakerHit("Frank's Roundhouse HO Scale Car");
  ok('P4b PLANTED (the old unanchored "Roundhouse HO"): Frank\'s Roundhouse reads as Roundhouse — B5 would go red', !!h4b && h4b[1] === 'roundhouse', J(h4b));
  const redA = (files, re) => checksA(world(files)).some(c => !c[1] && re.test(c[0]));
  ok('P6 PLANTED (Bluford Shops HO left off ERA_SCALE): A goes red', redA(Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], "bluford_n: 'N', bluford_ho: 'HO',", "bluford_n: 'N',", 'ERA_SCALE') }), /bluford_ho: ERA_SCALE/));
  ok('P7 PLANTED (Bluford HO\'s maker written "Bluford"): A goes red', redA(Object.assign({}, FILES, { 'config.js': plant(FILES['config.js'], "prefix: 'Bluford Shops HO',     manufacturer: 'Bluford Shops' }", "prefix: 'Bluford Shops HO',     manufacturer: 'Bluford' }", 'ERAS maker') }), /bluford_ho: ERAS/));
  ok('P8 PLANTED (no Bluford HO badge): A goes red', redA(Object.assign({}, FILES, { 'era-badges-config.js': plant(FILES['era-badges-config.js'], "    bluford_ho:     'BLHO',", "", 'badge') }), /bluford_ho: a badge/));
  ok('P9 PLANTED (no "Bluford Shops" brand label): A goes red', redA(Object.assign({}, FILES, { 'app.js': plant(FILES['app.js'], "'bluford shops':'Bluford Shops', bluford:'Bluford Shops', ", "", 'brand label') }), /bluford_n: the brand label/));
  ok('P10 PLANTED (Bluford Shops HO left out of the browse groups): A goes red', redA(Object.assign({}, FILES, { 'browse.js': plant(FILES['browse.js'], "  bluford_ho:     'modern',", "", 'browse group') }), /bluford_ho: Master Catalog browse/));
  ok('P11 PLANTED (Bluford N left out of the What I Collect era order): A goes red', redA(Object.assign({}, FILES, { 'onboarding-config.js': plant(FILES['onboarding-config.js'], "                'bluford_n', 'bluford_ho',", "                'bluford_ho',", 'era order') }), /bluford_n: What I Collect/));
}

// ═════ C · real Chromium, the real app ═════════════════════════════════════
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('FAILED  —  sixtabs_tests needs playwright'); process.exit(1); }
const L = (tab, era, num, type, desc, extra) => Object.assign({ _tab: tab, _era: era, itemNum: num, itemType: type, description: desc, subType: '', unit: '', poweredDummy: '', roadName: '',
  variation: '', varDesc: '', yearProd: '', gauge: era === 'bluford_n' ? 'N' : 'HO', rowId: (era + num).toUpperCase().replace(/[^A-Z0-9]/g, '') }, extra || {});
const ROWS = [
  // Athearn's own pages, read 2026-11-15: two different cars. noroundhouse (2026-11-16):
  // the Roundhouse catalog is on hold, so these stand on a catalog the app still reads —
  // the rule under test is "RND-1166 is not RND1166", whichever tab holds the pair.
  L('Bluford Shops HO', 'bluford_ho', 'RND-1166', 'Hopper', "24' Ore Car with Load, 8-pack", { roadName: 'Bessemer & Lake Erie', varDesc: '#20621 / #20655 / #20674 / #20717 / #20732 / #20743 / #20801 / #20823', rowId: 'RHDASHORE1' }),
  L('Bluford Shops HO', 'bluford_ho', 'RND1166', 'Boxcar', "36' Old Time Wood Box", { roadName: 'Chesapeake & Ohio', varDesc: '#6355', rowId: 'RHPLAINBOX' }),
  L('Bluford Shops HO', 'bluford_ho', 'RND1051', 'Boxcar', "40' High Cube Outside Braced Box", { roadName: 'AZER', varDesc: '#77013' }),
  L('Bluford Shops N', 'bluford_n', '60011', 'Hopper', "USRA 30'6\" 2-Bay Hopper", { roadName: 'Baltimore & Ohio', subType: "USRA 30'6\" 2-Bay Hopper" }),
  L('Bluford Shops N', 'bluford_n', '60012', 'Hopper', "USRA 30'6\" 2-Bay Hopper, 2-pack", { roadName: 'Baltimore & Ohio' }),
  L('Bluford Shops HO', 'bluford_ho', '31020', 'Caboose', 'Short Body Bay Window Caboose (Version 1)', { roadName: 'Union Pacific', varDesc: 'yellow; #13737' }),
  L('Atlas O', 'atlas', '6001', 'Boxcar', 'An Atlas car', { roadName: 'Erie', gauge: 'O' }),
];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function openApp(browser, served) {
  const ctx = await browser.newContext(PHONE); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => { const u = r.request().url(); if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop(); if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' }); return r.continue(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}
async function road(pg) {
  await pg.evaluate((ROWS) => {
    state.masterData = ROWS.map(r => Object.assign({}, r)); _rebuildMasterIndex(); state.companionData = []; state.setData = [{ setNum: '9999', items: [] }];
    if (typeof buildPartnerMap === 'function') buildPartnerMap();
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all'; state.user = { name: 'Tester', email: 'tester@example.com' };
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {}; window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  const step = (num, mfr) => pg.evaluate(async ([num, mfr]) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    try { localStorage.removeItem('lv_add_mfr'); localStorage.removeItem('lv_add_era'); localStorage.removeItem('lv_add_scale'); if (mfr) localStorage.setItem('lv_add_mfr', mfr); } catch (e) {}
    if (typeof _doCloseWizard === 'function' && wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
    await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
    for (let k = 0; k < 4 && (wizard.steps[wizard.step] || {}).type !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
    const i = document.getElementById('wiz-input'); i.value = num; i.dispatchEvent(new Event('input', { bubbles: true })); await sleep(800);
    const rows = Array.from(document.querySelectorAll('#wiz-suggestions [data-idx]')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
    const found = (document.getElementById('wiz-match') || {}).textContent || '';
    return { rows, found: found.replace(/\s+/g, ' ').trim(), held: wizard.matchedItem ? wizard.matchedItem.rowId : '' };
  }, [num, mfr || '']);
  const fm = await pg.evaluate(() => { const g = (n) => { const m = findMaster(n); return m ? m.rowId : ''; }; return { dash: g('RND-1166'), plain: g('RND1166'), digits: g('1166') }; });
  return { fm, dash: await step('RND-1166'), plain: await step('RND1166'), digits: await step('1166'), blu: await step('60011'), bluMfr: await step('60', 'Bluford Shops') };
}
(async () => {
  const ex = '/opt/pw-browsers/chromium'; const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== C · the real app ==');
    const { ctx, pg, errs } = await openApp(browser, null);
    const R = await road(pg).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('C1 RND-1166 → the ore car first, and the add holds THE ORE CAR (not RND1166)', /^RND-1166/.test(R.dash.rows[0] || '') && R.dash.held === 'RHDASHORE1', J(R.dash));
      ok('C2 RND1166 → the old-time wood boxcar first, and the add holds THE BOXCAR', /^RND1166/.test(R.plain.rows[0] || '') && R.plain.held === 'RHPLAINBOX', J(R.plain));
      ok('C3 the two cars never become one row', R.dash.rows.filter(t => /^RND-?1166/.test(t)).length + R.plain.rows.filter(t => /^RND-?1166/.test(t)).length >= 2, J([R.dash.rows, R.plain.rows]));
      ok('C4 60011 → one row, tagged BLUFORD SHOPS · N', R.blu.rows.length >= 1 && /^60011\s*BLUFORD SHOPS\s*·\s*N/i.test(R.blu.rows[0]), J(R.blu.rows));
      ok('C5 maker filter "Bluford Shops", typing 60 → only Bluford rows', R.bluMfr.rows.length >= 2 && R.bluMfr.rows.every(t => /BLUFORD SHOPS/i.test(t)), J(R.bluMfr.rows));
      ok('C7 findMaster (the one lookup every screen uses): RND-1166 → the ore car, RND1166 → the boxcar, a bare 1166 → neither', R.fm.dash === 'RHDASHORE1' && R.fm.plain === 'RHPLAINBOX' && R.fm.digits !== 'RHDASHORE1' && R.fm.digits !== 'RHPLAINBOX', J(R.fm));
      ok('C8 typing just 1166 holds neither car on its own (the member picks)', R.digits.held !== 'RHDASHORE1' && R.digits.held !== 'RHPLAINBOX', J(R.digits));
      ok('C6 no page errors', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
    console.log('\n== P · planted (the app) ==');
    {
      const sug = read('wizard-suggestions.js');
      // (planted at the function's first line, so it holds whichever way the body is written — officedash moved it onto rrNumKey)
      const bad = plant(sug, "function rrNumSameAsTyped(rowNum, typed) {", "function rrNumSameAsTyped(rowNum, typed) { var _d = function (v) { return String(v || '').trim().toLowerCase().replace(/-/g, ''); }; if (_d(rowNum) && _d(rowNum) === _d(typed)) return true;", 'dash-blind number match');
      const o = await openApp(browser, { 'wizard-suggestions.js': bad });
      const R2 = await road(o.pg).catch(e => ({ err: String(e) }));
      ok('P5 PLANTED (a number match that ignores every dash): C1 or C2 goes red — RND-1166 and RND1166 become one car', !R2.err && (R2.dash.held !== 'RHDASHORE1' || R2.plain.held !== 'RHPLAINBOX'), R2.err || J([R2.dash.held, R2.plain.held]));
      await o.ctx.close();
    }
    {
      // findMaster's own key, made dash-blind: C7 must go red
      const ad = read('app-data.js');
      const o = await openApp(browser, { 'app-data.js': ad.replace(/function findMaster\(itemNum, variation, prefer\) \{/, "function findMaster(itemNum, variation, prefer) { if (/^RND/i.test(String(itemNum))) { var _b = String(itemNum).replace(/-/g, ''); var _h = (state.masterData || []).filter(function (m) { return String(m.itemNum).replace(/-/g, '') === _b; }); if (_h.length) return _h[0]; }") });
      if (!/if \(\/\^RND\/i/.test(o.pg ? (await o.pg.evaluate(() => String(findMaster))) : '')) ok('P12 the planted findMaster loaded', false);
      const R3 = await road(o.pg).catch(e => ({ err: String(e) }));
      ok('P12 PLANTED (findMaster ignores the dash): C7 goes red', !R3.err && (R3.fm.dash !== 'RHDASHORE1' || R3.fm.plain !== 'RHPLAINBOX'), R3.err || J(R3.fm));
      await o.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
