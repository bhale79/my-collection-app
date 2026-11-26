#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SIX MAKERS, THE OLDER TWO — the tabs "BLMA N", "BLMA HO", "BLMA Z", "AHM HO"
// and "AHM N" become visible to the app (blmaahm, 2026-11-25).
// [stated] Brad 2026-11-25 08:35 CT "you build it" → 08:40 CT "yes and ship it".
// Melissa's makers; PLAN_2026-11-15_SIX_MAKERS.md. The tabs were written
// 2026-11-16 from Trainz listings only (MASTER_EDIT_2026-11-16_BLMA_AHM_TABS.md,
// Master Version 2.99); until this change the app never read them.
//
//   A  config, evaluated for real: every list a catalog must be on (the sixtabs /
//      rosstab list) carries all five, with the tabs' exact names
//   B  the maker words: "BLMA", "BLMA Models", "AHM", "A.H.M.", "Associated Hobby
//      Manufacturers" — whole words only ("Ahmed", "American Heritage Models" are
//      not AHM); search words; BLMA's barcodes are looked up, AHM's tabs have none;
//      Photo ID gives NO home tab for either (both makers span scales — the
//      Bachmann pattern; a Bluford-style one-tab hint would file an HO car as N)
//   C  real Chromium, the REAL app: a BLMA number is tagged BLMA · HO; the maker
//      filter / a typed maker word shows only that maker when another maker
//      shares the number; findMaster with the era asked keeps the two apart
//   P  planted offenders — each turns its own check red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (x || ''))); c ? pass++ : fail++; }
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
function plant(src, from, to, label) { if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches — update the test'); return src.replace(from, to); }
const J = (o) => String(JSON.stringify(o)).slice(0, 400);
const NEW = [
  { id: 'blma_n',  tab: 'BLMA N',  mfr: 'BLMA', scale: 'N',  wic: 'n',  upc: true },
  { id: 'blma_ho', tab: 'BLMA HO', mfr: 'BLMA', scale: 'HO', wic: 'ho', upc: true },
  { id: 'blma_z',  tab: 'BLMA Z',  mfr: 'BLMA', scale: 'Z',  wic: 'z',  upc: true },
  { id: 'ahm_ho',  tab: 'AHM HO',  mfr: 'AHM',  scale: 'HO', wic: 'ho', upc: false },
  { id: 'ahm_n',   tab: 'AHM N',   mfr: 'AHM',  scale: 'N',  wic: 'n',  upc: false },
];
function world(files) {
  const ctx = { window: {}, console, localStorage: undefined, navigator: { userAgent: 'test' }, location: { hostname: 'test', search: '', origin: 'https://test' }, document: undefined,
    setTimeout() {}, setInterval() {}, addEventListener() {} };
  ctx.window.addEventListener = function () {};
  vm.createContext(ctx);
  vm.runInContext(files['config.js'] + '\n;window.__cfg = { ERAS, REAL_ERA_IDS, ERA_SCALE, ERA_TABS, RR_MAKER_WORDS, RR_MAKER_ALIASES, RETIRED_ERA_IDS, LOOKUP_ONLY_ERAS, _rrMakerHit };', ctx);
  vm.runInContext(files['onboarding-config.js'] + '\n;window.__wic = WHAT_I_COLLECT;', ctx);
  vm.runInContext(files['era-badges-config.js'] + '\n;window.__badges = ERA_BADGES;', ctx);
  // barcode.js: only its first function (the rest needs a page)
  const bc = files['barcode.js'], s = bc.indexOf('function eraSupportsBarcode'), e = bc.indexOf('window.eraSupportsBarcode');
  vm.runInContext(bc.slice(s, e) + '\n;window.__bc = eraSupportsBarcode;', ctx);
  // wizard-photos.js: Photo ID's maker → home tab map
  const wp = files['wizard-photos.js'], ws = wp.indexOf('function _eraForMfr('), we = wp.indexOf('\n}\n', ws) + 3;
  vm.runInContext(wp.slice(ws, we) + '\n;window.__eraForMfr = _eraForMfr;', ctx);
  return { CFG: ctx.window.__cfg, WIC: ctx.window.__wic, BADGES: ctx.window.__badges, BC: ctx.window.__bc, EFM: ctx.window.__eraForMfr, files };
}
const FILES = {}; ['config.js', 'onboarding-config.js', 'era-badges-config.js', 'browse.js', 'research.js', 'item-search-filters-config.js', 'app.js', 'wizard-photos.js', 'wizard-suggestions.js', 'barcode.js'].forEach(f => FILES[f] = read(f));
function checksA(W) {
  const r = [];
  const { CFG, WIC, BADGES, BC, files } = W;
  const badges = BADGES.shortLabel || {};
  NEW.forEach(e => {
    const d = CFG.ERAS[e.id] || {};
    r.push(['A ' + e.id + ': ERAS, label = prefix = the tab name "' + e.tab + '", maker ' + e.mfr, d.label === e.tab && d.prefix === e.tab && d.manufacturer === e.mfr, J(d)]);
    r.push(['A ' + e.id + ': REAL_ERA_IDS (or the index never fetches the tab)', CFG.REAL_ERA_IDS.indexOf(e.id) >= 0]);
    r.push(['A ' + e.id + ': not retired, not lookup-only (a catalog the member browses)', CFG.RETIRED_ERA_IDS.indexOf(e.id) < 0 && CFG.LOOKUP_ONLY_ERAS.indexOf(e.id) < 0]);
    r.push(['A ' + e.id + ': ERA_SCALE ' + e.scale, CFG.ERA_SCALE[e.id] === e.scale, CFG.ERA_SCALE[e.id]]);
    r.push(['A ' + e.id + ': ERA_TABS items = the tab name', (CFG.ERA_TABS[e.id] || {}).items === e.tab, J(CFG.ERA_TABS[e.id])]);
    r.push(['A ' + e.id + ': a badge of its own (no other era uses it)', !!badges[e.id] && Object.keys(badges).filter(k => badges[k] === badges[e.id]).length === 1, J(badges[e.id])]);
    r.push(['A ' + e.id + ': What I Collect — in the era order, under scale "' + e.wic + '", with a colour', WIC.eraOrder.indexOf(e.id) >= 0 && JSON.stringify(WIC).indexOf('"' + e.id + '":"' + e.wic + '"') >= 0 && !!WIC.eraColors[e.id]]);
    r.push(['A ' + e.id + ': the maker choice key = its maker lowercased (an allow-list — a mismatch HIDES the tab)', !!(WIC.MANUFACTURERS || {})[e.mfr.toLowerCase()]]);
    r.push(['A ' + e.id + ': Master Catalog browse group (modern)', new RegExp('\\b' + e.id + ":\\s*'modern'").test(files['browse.js'])]);
    { const bl = (files['app.js'].match(/var _BRAND_LABELS = \{[^\n]*\}/) || [''])[0];
      r.push(['A ' + e.id + ': the brand label "' + e.mfr + '" (_BRAND_LABELS)', new RegExp("\\b" + e.mfr.toLowerCase() + ":'" + e.mfr + "'").test(bl), bl.slice(-160)]); }
    { const rs = files['research.js'], i = rs.indexOf('var ERA_GROUP');
      r.push(['A ' + e.id + ': the research page group', new RegExp("'" + e.id + "'").test(rs.slice(i, i + 1800))]); }
    r.push(['A ' + e.id + ': barcode lookup ' + (e.upc ? 'ON (the rows carry UPCs)' : 'OFF (the rows carry none)'), BC(e.id) === e.upc, String(BC(e.id))]);
  });
  return r;
}
console.log('\n== A · config, for real ==');
checksA(world(FILES)).forEach(c => ok(c[0], c[1], c[2]));

console.log('\n== B · the maker words ==');
function checksB(W) {
  const hit = (s) => { const h = W.CFG._rrMakerHit(s); return h ? h[1] : ''; };
  const sf = W.files['item-search-filters-config.js'], ws = W.files['wizard-suggestions.js'];
  return [
    ['B1 "BLMA", "BLMA Models", "BLMA Models 16 N Modern EMD Cab Sunshades" are BLMA', hit('BLMA') === 'blma' && hit('BLMA Models') === 'blma' && hit('BLMA Models 16 N Modern EMD Cab Sunshades (Pack of 4)') === 'blma', [hit('BLMA'), hit('BLMA Models')].join('|')],
    ['B2 "AHM", "A.H.M. 2520 HO Three Way Switch", "Associated Hobby Manufacturers" are AHM', hit('AHM') === 'ahm' && hit('A.H.M. 2520 HO Three Way Switch w Controllers and Wires') === 'ahm' && hit('Associated Hobby Manufacturers') === 'ahm', [hit('AHM'), hit('A.H.M. 2520 HO Three Way Switch'), hit('Associated Hobby Manufacturers')].join('|')],
    ['B3 not AHM: "Ahmed\'s Diner", "American Heritage Models", "Brahms"; not BLMA: "BLMAX"', hit("Ahmed's Diner") !== 'ahm' && hit('American Heritage Models') !== 'ahm' && hit('Brahms') !== 'ahm' && hit('BLMAX') !== 'blma', [hit("Ahmed's Diner"), hit('American Heritage Models'), hit('Brahms'), hit('BLMAX')].join('|')],
    ['B4 the spellings on a submission settle on the maker ("blma models" → blma, "a.h.m." / "associated hobby manufacturers" → ahm)', W.CFG.RR_MAKER_ALIASES['blma models'] === 'blma' && W.CFG.RR_MAKER_ALIASES['a.h.m.'] === 'ahm' && W.CFG.RR_MAKER_ALIASES['associated hobby manufacturers'] === 'ahm'],
    ['B5 "blma" and "ahm" are search maker words ("4000 blma" finds BLMA\'s 4000)', /'blma'/.test(sf) && /'ahm'/.test(sf)],
    ['B6 typed in the Add box, "blma" / "ahm" filter to that maker', /\bblma:'BLMA'/.test(ws) && /\bahm:'AHM'/.test(ws)],
    ['B7 Photo ID gives no home tab for BLMA or AHM (each spans scales — the Bachmann pattern)', W.EFM('blma') === '' && W.EFM('BLMA') === '' && W.EFM('ahm') === '' && W.EFM('AHM') === '' && W.EFM('atlas') === 'atlas', [W.EFM('blma'), W.EFM('ahm'), W.EFM('atlas')].join('|')],
  ];
}
checksB(world(FILES)).forEach(c => ok(c[0], c[1], c[2]));

console.log('\n== P · planted (config) ==');
{
  const redA = (files, re) => checksA(world(files)).some(c => !c[1] && re.test(c[0]));
  const redB = (files, re) => checksB(world(files)).some(c => !c[1] && re.test(c[0]));
  const F = (file, from, to, label) => Object.assign({}, FILES, { [file]: plant(FILES[file], from, to, label) });
  ok('P1 PLANTED (AHM N left off REAL_ERA_IDS): A goes red', redA(F('config.js', ", 'ahm_ho', 'ahm_n'];", ", 'ahm_ho'];", 'REAL_ERA_IDS'), /ahm_n: REAL_ERA_IDS/));
  ok('P2 PLANTED (the maker choice keyed "blma models"): A goes red', redA(F('onboarding-config.js', "    blma: { id: 'blma'", "    'blma models': { id: 'blma'", 'maker key'), /blma_n: the maker choice/));
  ok('P3 PLANTED (a tab name that is not the sheet\'s): A goes red', redA(F('config.js', "  blma_ho:        { items: 'BLMA HO' },", "  blma_ho:        { items: 'BLMA H0' },", 'tab name'), /blma_ho: ERA_TABS/));
  ok('P4 PLANTED (BLMA Z left off ERA_SCALE): A goes red', redA(F('config.js', "blma_z: 'Z', ", "", 'ERA_SCALE'), /blma_z: ERA_SCALE/));
  ok('P5 PLANTED (AHM HO\'s maker written "A.H.M."): A goes red', redA(F('config.js', "prefix: 'AHM HO',               manufacturer: 'AHM' }", "prefix: 'AHM HO',               manufacturer: 'A.H.M.' }", 'ERAS maker'), /ahm_ho: ERAS/));
  ok('P6 PLANTED (AHM N given Bluford\'s badge): A goes red', redA(F('era-badges-config.js', "    ahm_n:          'AHMN',", "    ahm_n:          'BLN',", 'badge'), /ahm_n: a badge/));
  ok('P7 PLANTED (no "AHM" brand label): A goes red', redA(F('app.js', ", ahm:'AHM' }", " }", 'brand label'), /ahm_ho: the brand label/));
  ok('P8 PLANTED (BLMA N left out of the browse groups): A goes red', redA(F('browse.js', "  blma_n:         'modern',", "", 'browse group'), /blma_n: Master Catalog browse/));
  ok('P9 PLANTED (AHM N left out of the What I Collect era order): A goes red', redA(F('onboarding-config.js', "'ahm_ho', 'ahm_n'],", "'ahm_ho'],", 'era order'), /ahm_n: What I Collect/));
  ok('P10 PLANTED (BLMA HO left off the barcode list): A goes red', redA(F('barcode.js', "'blma_n','blma_ho','blma_z'];", "'blma_n','blma_z'];", 'barcode list'), /blma_ho: barcode lookup/));
  ok('P11 PLANTED (AHM HO put on the barcode list): A goes red', redA(F('barcode.js', "'blma_n','blma_ho','blma_z'];", "'blma_n','blma_ho','blma_z','ahm_ho'];", 'barcode list'), /ahm_ho: barcode lookup/));
  ok('P12 PLANTED (the AHM maker word without word edges — "Ahmed" reads as AHM): B goes red', redB(F('config.js', "[/\\bahm\\b|", "[/ahm|", 'maker word'), /^B3/));
  ok('P13 PLANTED (Photo ID sends every BLMA read to the N tab): B goes red', redB(F('wizard-photos.js', "gargraves: 'gargraves', 'gar graves': 'gargraves',", "gargraves: 'gargraves', 'gar graves': 'gargraves', blma: 'blma_n',", 'Photo ID map'), /^B7/));
  ok('P14 PLANTED (AHM N left out of the research groups): A goes red', redA(F('research.js', "'ahm_ho', 'ahm_n'] };", "'ahm_ho'] };", 'research'), /ahm_n: the research page/));
}

// ═════ C · real Chromium, the real app ═════════════════════════════════════
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('FAILED  —  blmaahm_tests needs playwright'); process.exit(1); }
const GAUGE = { blma_n: 'N', blma_ho: 'HO', blma_z: 'Z', ahm_ho: 'HO', ahm_n: 'N', atlas_n: 'N', atlas: 'O' };
const L = (tab, era, num, type, desc, extra) => Object.assign({ _tab: tab, _era: era, itemNum: num, itemType: type, description: desc, subType: '', unit: '', poweredDummy: '', roadName: '',
  variation: '', varDesc: '', yearProd: '', gauge: GAUGE[era] || '', rowId: (era + num).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }, extra || {});
const ROWS = [
  // real rows from the five tabs (read 2026-11-25)
  L('BLMA HO', 'blma_ho', '4000', 'Accessory', 'Target Signal Heads 3', { subType: 'Signals & Crossing Gates', rowId: 'YGYFHTA459' }),
  L('BLMA N', 'blma_n', '1000', 'Accessory', 'Signal Heads non-operatng', { subType: 'Signals & Crossing Gates', rowId: 'J8PR2RJZDK' }),
  L('BLMA Z', 'blma_z', '8000', 'Accessory', 'Target Style Signal Heads', { rowId: '36NEFPMRBY' }),
  L('AHM HO', 'ahm_ho', '11010', 'Accessory', 'Operating Freight Carrier & Crates', { rowId: '8KX7V5NRHV' }),
  L('AHM N', 'ahm_n', '21001', 'Accessory', 'Operating Dual Crossing Gates', { rowId: 'CEVRFHYCKX' }),
  // stand-ins: another maker using the same number — the number alone must never decide
  L('Atlas N', 'atlas_n', '1000', 'Accessory', 'An Atlas N stand-in sharing BLMA\'s number', { rowId: 'ATLASN1000' }),
  L('Atlas O', 'atlas', '11010', 'Boxcar', 'An Atlas O stand-in sharing AHM\'s number', { roadName: 'Erie', rowId: 'ATLASO1101' }),
];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
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
    return { rows, held: wizard.matchedItem ? wizard.matchedItem.rowId : '' };
  }, [num, mfr || '']);
  const fm = await pg.evaluate(() => { const g = (n, era) => { const m = findMaster(n, '', era ? { era } : undefined); return m ? m.rowId : ''; };
    return { blmaN: g('1000', 'blma_n'), atlasN: g('1000', 'atlas_n'), ahmHo: g('11010', 'ahm_ho'), atlasO: g('11010', 'atlas') }; });
  return { fm, ho: await step('4000'), z: await step('8000'), ahmN: await step('21001'), mfrBlma: await step('1000', 'BLMA'), mfrAhm: await step('11010', 'AHM'), typed: await step('1000 blma') };
}
(async () => {
  const ex = '/opt/pw-browsers/chromium'; const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== C · the real app ==');
    const { ctx, pg, errs } = await openApp(browser, null);
    const R = await road(pg).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('C1 4000 → one row, tagged BLMA · HO', R.ho.rows.length >= 1 && /^4000\s*BLMA\s*·\s*HO/i.test(R.ho.rows[0]), J(R.ho.rows));
      ok('C2 8000 → tagged BLMA · Z; 21001 → tagged AHM · N', /^8000\s*BLMA\s*·\s*Z/i.test(R.z.rows[0] || '') && /^21001\s*AHM\s*·\s*N/i.test(R.ahmN.rows[0] || ''), J([R.z.rows, R.ahmN.rows]));
      ok('C3 maker filter "BLMA", typing 1000 (Atlas N uses 1000 too) → only the BLMA row', R.mfrBlma.rows.length >= 1 && R.mfrBlma.rows.every(t => /BLMA/i.test(t)), J(R.mfrBlma.rows));
      ok('C4 maker filter "AHM", typing 11010 (Atlas O uses 11010 too) → only the AHM row', R.mfrAhm.rows.length >= 1 && R.mfrAhm.rows.every(t => /^11010\s*AHM\s*·/i.test(t)), J(R.mfrAhm.rows));
      ok('C5 typed "1000 blma" → only the BLMA row', R.typed.rows.length >= 1 && R.typed.rows.every(t => /BLMA/i.test(t)), J(R.typed.rows));
      ok('C6 findMaster with the era asked: 1000 → BLMA N or Atlas N, 11010 → AHM HO or Atlas O, never crossed', R.fm.blmaN === 'J8PR2RJZDK' && R.fm.atlasN === 'ATLASN1000' && R.fm.ahmHo === '8KX7V5NRHV' && R.fm.atlasO === 'ATLASO1101', J(R.fm));
      ok('C7 no page errors', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
    console.log('\n== P · planted (the app) ==');
    {
      // AHM N filed under Postwar in the browse groups: its tag then says AHM · POSTWAR, not its scale — C2 must go red
      const bad = plant(read('browse.js'), "  ahm_n:          'modern',", "  ahm_n:          'postwar',", 'browse group');
      const o = await openApp(browser, { 'browse.js': bad });
      const R2 = await road(o.pg).catch(e => ({ err: String(e) }));
      ok('P15 PLANTED (AHM N filed under Postwar): C2 goes red', !R2.err && !/^21001\s*AHM\s*·\s*N/i.test(R2.ahmN.rows[0] || ''), R2.err || J(R2.ahmN.rows));
      await o.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
