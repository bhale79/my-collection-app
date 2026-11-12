#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ERA TWINS + THE "C" PARTNER RULE — 2026-11-11 (eratwins)
//
// Hand-test T-2026-11-05-05 notes (WAITING.md 2026-11-08, item (b)); checked
// live in Brad's Chrome 2026-11-11 (v0.9.2141); [stated] Brad "yes" to both fixes:
//   1. With no filters, typing 022 never offered the PRE-WAR 022 switches.
//      Not the Micro-Trains rows: the Add list folded the Pre-War 022 into the
//      Postwar 022 (same number, type Track, blank road, same maker) and showed
//      ONE row tagged Postwar. 73 numbers on the live master folded this way.
//      Now two eras' rows never merge (wizard-suggestions.js, the duplicate key).
//   2. Typing 022 asked "A Powered / A Dummy / AB set". buildPartnerMap (app.js)
//      paired ANY Lionel number with ANY row named number+"C" — 022C is the
//      Super O switch controller. 30 of the 47 pairs that rule made were wrong.
//      Now both numbers must have a Lionel row that IS a diesel engine.
//
//   A  node: the REAL buildPartnerMap + getGroupingOptions on rows as the live
//      sheet has them — 022 / 16 / 550 / 19200 / SW lose the question; 2343,
//      217 and 2240 keep theirs
//   B  real Chromium, the REAL app at iPhone size: 022 lists the Postwar AND the
//      Pre-War switch, asks no set question; tapping the Pre-War row holds it;
//      2343 still asks; 1130 lists Postwar and MPC
//      review (fresh agent, 2026-11-11): the parts lists stay one row per part;
//      a word-less Pre-War row is not dropped as a "bare" twin; the maker key
//      and the Lionel-tabs-only line are each proven alone; the page uses
//      getTypeBucket (6666C typed "Locomotive")
//   P  planted offenders — each turns its own check red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const J = (o) => JSON.stringify(o).slice(0, 500);

// ── the rows, as the live sheet has them (read 2026-11-11 in Brad's app) ────
const L = (tab, era, num, type, desc, extra) => Object.assign({ _tab: tab, _era: era, itemNum: num, itemType: type, description: desc,
  subType: '', unit: '', poweredDummy: '', roadName: '', variation: '', yearProd: '', gauge: 'O', rowId: era.toUpperCase() + num }, extra || {});
const PW = (num, type, desc, extra) => L('Lionel PW - Items', 'pw', num, type, desc, extra);
const ROWS = [
  PW('022', 'Track', 'Remote Control O Gauge Switch', { yearProd: '1945' }),
  L('Lionel Pre-War', 'prewar', '022', 'Track', 'Remote Control Switches, pair (O)', { yearProd: '1938' }),
  PW('022C', 'Accessory', '1 Controller White Box for Super O'),
  PW('16', 'Operating Freight', 'Ballast Dump Car'), PW('16C', 'Transformer', 'Transformer, 35 watts'),
  PW('550', 'Accessory', 'Miniature Figures'), PW('550C', 'Track', '3" Diameter Curved Track (O)'),
  L('Lionel MPC', 'mpc', '19200', 'Boxcar', 'Tidewater Southern Boxcar'), L('Lionel MPC', 'mpc', '19200C', 'Freight Car', 'Santa Fe 40\' Boxcar'),
  PW('SW', 'Transformer', 'Switch transformer'), PW('SWC', 'Accessory', 'Stationary Wrecking Crane'),
  // the real ones
  PW('2343', 'Diesel Locomotive', 'Santa Fe F-3 A unit', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'P', roadName: 'Santa Fe' }),
  PW('2343T', 'Diesel Locomotive', 'Santa Fe F-3 A unit', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'D', roadName: 'Santa Fe' }),
  PW('2343C', 'Diesel Locomotive', 'Santa Fe F-3 B unit', { subType: 'EMD F-3', unit: 'B', poweredDummy: 'C', roadName: 'Santa Fe' }),
  PW('217', 'Diesel Locomotive', 'Boston & Maine Alco AB', { subType: 'Alco FA', unit: 'A', poweredDummy: 'P' }),
  PW('217C', 'Diesel Locomotive', 'Boston & Maine Alco B unit', { subType: 'Alco FA', unit: 'B' }),
  PW('2240', 'Diesel Locomotive', 'Wabash F-3 A unit', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'P' }),
  PW('2240C', 'Diesel Locomotive', 'Wabash F-3 B unit', { subType: 'EMD F-3', unit: 'B' }),
  // made up, one half each — a diesel whose C is not one, and the other way round
  PW('7777', 'Diesel Locomotive', 'Test F-3 A unit', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'P' }),
  PW('7777C', 'Accessory', 'Test controller'),
  PW('8888', 'Accessory', 'Test water tower'),
  PW('8888C', 'Diesel Locomotive', 'Test F-3 B unit', { subType: 'EMD F-3', unit: 'B' }),
  // a B unit the sheet types only "Locomotive" (the live 22022C is spelled so) —
  // the ONE type rule (getTypeBucket, the page) reads its Alco sub-type as a diesel
  PW('6666', 'Diesel Locomotive', 'Test Alco A unit', { subType: 'Alco FA', unit: 'A', poweredDummy: 'P' }),
  PW('6666C', 'Locomotive', 'Test Alco B unit', { subType: 'Alco FA', unit: 'B' }),
  // P / T / C is Lionel's: an Atlas F-3 with a T row is no Lionel AA pair
  L('Atlas O', 'atlas', '3000', 'Diesel Locomotive', 'Atlas F-3 A unit', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'P', manufacturer: 'Atlas' }),
  L('Atlas O', 'atlas', '3000T', 'Diesel Locomotive', 'Atlas F-3 dummy A', { subType: 'EMD F-3', unit: 'A', poweredDummy: 'D', manufacturer: 'Atlas' }),
  // another era's twin, and a different maker's number that starts with 022
  PW('1130', 'Boxcar', 'Boxcar'), L('Lionel MPC', 'mpc', '1130', 'Boxcar', 'Boxcar'),
  // a Pre-War row with no words at all beside a Postwar row that has them
  PW('1121', 'Track', 'Remote Control Switches (027)'), L('Lionel Pre-War', 'prewar', '1121', 'Track', ''),
  // one part on two stores' parts lists — ONE row
  L('Lionel Parts', 'lionel_parts', '2343-13', 'Part', 'Motor brush', { manufacturer: 'Lionel', rowId: 'LP2343-13' }),
  L('Train Tender Parts', 'traintender_parts', '2343-13', 'Part', 'Motor brush', { manufacturer: 'Lionel', rowId: 'TT2343-13' }),
  // two makers on ONE tab (Other O Brands) — two rows
  L('Other O', 'other_o', '4321', 'Accessory', 'Signal tower', { manufacturer: 'Ives', rowId: 'OO4321I' }),
  L('Other O', 'other_o', '4321', 'Accessory', 'Signal tower', { manufacturer: 'Dorfan', rowId: 'OO4321D' }),
  L('Micro-Trains N', 'microtrains_n', '022 00 000', 'Boxcar', '40\' Standard Box Car', { manufacturer: 'Micro-Trains', gauge: 'N' }),
];

// ═════ A · node: the real map, the real question ═══════════════════════════
const HELPERS = ['normalizeItemNum', 'baseItemNum', 'rrMthUnitRole', 'buildPartnerMap', '_stripSuffix', '_getPartner', 'getMatchingTenders',
  'isF3AlcoUnit', 'getDieselConfigs', 'getBUnit', 'getAUnit', 'getSetPartner', '_mthGroupingOptions', 'getGroupingOptions'];
function world(src) {
  const state = { masterData: ROWS.map(r => Object.assign({}, r)), companionData: [], setData: [], filters: {} };
  const W = new Function('state', 'console', 'window', HELPERS.map(n => grab(src, n)).join('\n') + '\nreturn { ' + HELPERS.join(', ') + ' };')(state, { log() {}, warn() {} }, {});
  W.buildPartnerMap();
  W.ask = (n, t) => W.getGroupingOptions(n, t).map(b => b.id).join(',');
  return W;
}
const appjs = read('app.js');
{
  console.log('\n== A · the real buildPartnerMap + getGroupingOptions ==');
  const W = world(appjs);
  ok('A1 022 (a track switch) asks NO set question, and has no "B unit"', W.ask('022', 'Track') === '' && !W.getBUnit('022') && !W.getAUnit('022C'), J([W.ask('022', 'Track'), W.getBUnit('022')]));
  ok('A2 16 / 550 / 19200 / SW — none of them gets a "B unit" any more', ['16', '550', '19200', 'SW'].every(n => !W.getBUnit(n) && W.ask(n) === ''), J(['16', '550', '19200', 'SW'].map(n => W.getBUnit(n))));
  ok('A3 a diesel whose C is not a diesel (7777 / 7777C), and the other way round (8888 / 8888C) — no pair', !W.getBUnit('7777') && !W.getBUnit('8888'), J([W.getBUnit('7777'), W.getBUnit('8888')]));
  ok('A4 2343 keeps everything: B unit 2343C, AA / AB / ABA', W.getBUnit('2343') === '2343C' && W.getAUnit('2343C') === '2343' && W.ask('2343', 'Diesel Locomotive') === 'a_powered,a_dummy,aa,ab,aba', W.ask('2343', 'Diesel Locomotive'));
  ok('A5 217 (Alco FA) and 2240 (F-3, no second A) keep AB', W.getBUnit('217') === '217C' && /(^|,)ab(,|$)/.test(W.ask('217')) && W.getBUnit('2240') === '2240C' && W.ask('2240') === 'a_powered,a_dummy,ab', J([W.ask('217'), W.ask('2240')]));
  ok('A6 an Atlas F-3 with a T row is not taken for a Lionel AA pair (P / T / C is Lionel\'s)', !(W.getBUnit('3000')) && W.ask('3000') === '', W.ask('3000'));

  if (!process.env.ERATWINS_ON_OLD_CODE) {   // (set it to run this file on the code before the fix: A and B must go red)
  console.log('\n== A · planted ==');
  const both = plant(appjs, 'if (_masterNumSet.has(bNum) && _lionelDieselNums.has(num) && _lionelDieselNums.has(bNum)) {', 'if (_masterNumSet.has(bNum)) {', 'both halves');
  ok('PA1 PLANTED (the +C rule as it was): 022 asks "A Powered / A Dummy / AB set" again — proof A1 can fail', world(both).ask('022', 'Track') !== '', world(both).ask('022', 'Track'));
  const aOnly = plant(appjs, '_lionelDieselNums.has(num) && _lionelDieselNums.has(bNum)', '_lionelDieselNums.has(bNum)', 'A half');
  ok('PA2 PLANTED (only the C number checked): 8888 (an accessory) gets 8888C as its "B unit" — proof A3 can fail', world(aOnly).getBUnit('8888') === '8888C', world(aOnly).getBUnit('8888'));
  const cOnly = plant(appjs, '_lionelDieselNums.has(num) && _lionelDieselNums.has(bNum)', '_lionelDieselNums.has(num)', 'C half');
  ok('PA3 PLANTED (only the engine checked): 7777 gets its controller 7777C as a "B unit" — proof A3 can fail', world(cOnly).getBUnit('7777') === '7777C', world(cOnly).getBUnit('7777'));
  const noTab = plant(appjs, "    if (String(m._tab || '').toLowerCase().indexOf('lionel') !== 0) return;\n    const num = normalizeItemNum(m.itemNum);\n    const pdMatch", "    const num = normalizeItemNum(m.itemNum);\n    const pdMatch", 'Lionel tabs only');
  ok('PA4 PLANTED (the Lionel-tabs-only line taken out, alone): the Atlas 3000 asks "AA set" — proof A6 can fail', /(^|,)aa(,|$)/.test(world(noTab).ask('3000')), world(noTab).ask('3000'));
  }
}

// ═════ B · real Chromium, the real app ═════════════════════════════════════
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  eratwins_tests needs playwright and it is not installed.'); process.exit(1); }
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

async function openApp(browser, served) {
  const ctx = await browser.newContext(PHONE);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}
const SETS = [{ setNum: '1467W', setName: 'Erie Freight', year: '1952', gauge: 'O27', price: '', items: ['2032', '6656'], alts: [], notes: '' }];

async function road(pg) {
  await pg.evaluate(([ROWS, SETS]) => {
    state.masterData = ROWS.map(r => Object.assign({}, r)); _rebuildMasterIndex();
    state.companionData = []; state.setData = SETS.map(s => JSON.parse(JSON.stringify(s)));
    buildPartnerMap();
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {}; window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [ROWS, SETS]);
  const R = {};
  const step = async (num) => pg.evaluate(async (num) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    try { localStorage.removeItem('lv_add_mfr'); localStorage.removeItem('lv_add_era'); localStorage.removeItem('lv_add_scale'); } catch (e) {}
    if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
    await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
    for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
    const i = document.getElementById('wiz-input'); i.value = num;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(800);
  }, num);
  const look = () => pg.evaluate(() => {
    const s = document.getElementById('wiz-suggestions');
    const rows = s ? Array.from(s.querySelectorAll('[data-idx]')) : [];
    const g = document.getElementById('wiz-grouping-btns');
    return {
      rows: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
      grouping: g && g.style.display !== 'none' ? Array.from(g.querySelectorAll('button')).map(b => b.textContent.trim()) : [],
      matched: wizard.matchedItem ? wizard.matchedItem.rowId : '',
    };
  });
  await step('022'); R.b022 = await look();
  // tap the Pre-War row, the way a finger does
  await pg.evaluate(async () => {
    const rows = Array.from(document.querySelectorAll('#wiz-suggestions [data-idx]'));
    const pre = rows.find(r => /^022\b|^022[A-Z ]/i.test(r.textContent.trim()) && /pre-?war/i.test(r.textContent));
    if (pre) pre.click();
    await new Promise(r => setTimeout(r, 700));
  });
  R.tap = await look();
  await step('2343'); R.b2343 = await look();
  await step('1130'); R.b1130 = await look();
  await step('6666'); R.b6666 = await look();
  await step('1121'); R.b1121 = await look();
  await step('2343-13'); R.bpart = await look();
  await step('4321'); R.b4321 = await look();
  return R;
}
const lionel022 = (rows) => rows.filter(t => /^022\s*LIONEL/i.test(t));

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== B · the real app ==');
    {
      const { ctx, pg, errs } = await openApp(browser, null);
      const R = await road(pg).catch(e => ({ err: String(e && e.stack || e) }));
      if (R.err) ok('the road runs', false, R.err);
      else {
        const l = lionel022(R.b022.rows);
        ok('B1 type 022, no filters → TWO Lionel 022 rows, the Postwar switch and the Pre-War switches', l.length === 2 && l.some(t => /POSTWAR/i.test(t)) && l.some(t => /PRE-?WAR/i.test(t)), J(R.b022.rows));
        ok('B2 … both at the top of the list, above the Micro-Trains 022 00 000', /^022\s*LIONEL/i.test(R.b022.rows[0] || '') && /^022\s*LIONEL/i.test(R.b022.rows[1] || ''), J(R.b022.rows.slice(0, 3)));
        ok('B3 … and NO "How are you entering this item?" question on a track switch', R.b022.grouping.length === 0, J(R.b022.grouping));
        ok('B4 tap the Pre-War row → the add holds the Pre-War 022; still no set question', R.tap.matched === 'PREWAR022' && R.tap.grouping.length === 0, J(R.tap));
        ok('B5 2343 (Santa Fe F-3) still asks: A Powered · A Dummy · AA set · AB set · ABA set', R.b2343.grouping.join('|') === 'A Powered|A Dummy|AA set|AB set|ABA set', J(R.b2343.grouping));
        ok('B6 1130 → the Postwar AND the MPC boxcar, one row each', R.b1130.rows.filter(t => /^1130\s*LIONEL/i.test(t)).length === 2, J(R.b1130.rows));
        ok('B8 6666C, typed only "Locomotive" with an Alco sub-type, still counts as 6666\'s B unit — the page asks AB', R.b6666.grouping.indexOf('AB set') >= 0, J(R.b6666.grouping));
        ok('B9 1121 → the Postwar switch AND the Pre-War one, though the Pre-War row has no words', R.b1121.rows.filter(t => /^1121\s*LIONEL/i.test(t)).length === 2, J(R.b1121.rows));
        ok('B10 2343-13 on two stores\' parts lists → still ONE row', R.bpart.rows.filter(t => /^2343-13/i.test(t)).length === 1, J(R.bpart.rows));
        ok('B11 4321 by two makers on one tab → two rows (the maker still counts on its own)', R.b4321.rows.filter(t => /^4321/i.test(t)).length === 2, J(R.b4321.rows));
        ok('B7 no page errors', errs.length === 0, errs.join(' | '));
      }
      await ctx.close();
    }

    if (process.env.ERATWINS_ON_OLD_CODE) return;
    console.log('\n== P · planted in served copies ==');
    const sug = read('wizard-suggestions.js');
    {
      const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(sug, "      _dedupeKey += '|' + _sgEraOfRow(m);\n", '', 'era in the key') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P1 PLANTED (no era in the duplicate key): ONE Lionel 022 row again, the Pre-War one hidden — proof B1 can fail', !R.err && lionel022(R.b022.rows).length === 1, R.err || J(R.b022.rows));
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, { 'app.js': plant(appjs, 'if (_masterNumSet.has(bNum) && _lionelDieselNums.has(num) && _lionelDieselNums.has(bNum)) {', 'if (_masterNumSet.has(bNum)) {', 'diesel guard') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P2 PLANTED (the +C rule as it was): 022 asks "A Powered / A Dummy / AB set" again — proof B3 can fail', !R.err && R.b022.grouping.indexOf('AB set') >= 0, R.err || J(R.b022.grouping));
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, { 'app.js': plant(appjs, "if (typeof getTypeBucket === 'function') return getTypeBucket(m) === 'Diesel Locomotive';\n", '', 'the type rule') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P3 PLANTED (the page reads only the Item Type word, not the ONE type rule): 6666 loses its AB question — proof B8 can fail', !R.err && R.b6666.grouping.indexOf('AB set') < 0, R.err || J(R.b6666.grouping));
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(sug, "  return parts.indexOf(e) >= 0 ? 'parts' : e;", '  return e;', 'parts as one') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P4 PLANTED (each parts list its own era): 2343-13 shows twice — proof B10 can fail', !R.err && R.bpart.rows.filter(t => /^2343-13/i.test(t)).length === 2, R.err || J(R.bpart.rows));
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(sug, "    var _infoKey = function (c) { return c.num + '|' + _sgEraOfRow(c); };", "    var _infoKey = function (c) { return c.num; };", 'bare rows per era') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P5 PLANTED (a bare row dropped by number alone): the word-less Pre-War 1121 disappears — proof B9 can fail', !R.err && R.b1121.rows.filter(t => /^1121\s*LIONEL/i.test(t)).length === 1, R.err || J(R.b1121.rows));
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(sug, "      _dedupeKey += '|' + _sgMakerOfRow(m);\n", '', 'maker in the key') });
      const R = await road(pg).catch(e => ({ err: String(e) }));
      ok('P6 PLANTED (no maker in the key, the era still there): 4321 shows ONE row — proof B11 can fail (rosstab X2 now takes both out)', !R.err && R.b4321.rows.filter(t => /^4321/i.test(t)).length === 1, R.err || J(R.b4321.rows));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
