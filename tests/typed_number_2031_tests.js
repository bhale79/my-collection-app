#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A TYPED NUMBER THE CATALOG DOES NOT HOLD — v0.9.2031   (real Chromium, the REAL app)
//
// Lars (York, 2026-10-26): "I had a RMT 66238 … the list showed 20-". The
// catalog lacks the RMT 66238; MTH's 20-66238 CONTAINS those digits, so the
// Add list offered it and Next — finding that one "partial" — took it without
// asking. He also could not reach Save on his iPhone: the edit panel was
// sized with vh, which Safari measures with its toolbar hidden.
//   A  the Add list: no row IS the typed number → first row "Use 66238 as
//      typed, not in the catalog"; a row that only contains it says
//      "MTH · contains 66238"; a row that IS the number (dash or not) → no such row
//   B  Next never picks a contains-match by itself: one or many go to the
//      picker, whose first button keeps the number as typed, and the number
//      then stands through Next
//   C  rrNumSameAsTyped: the dash before a letter suffix is the only give
//   D  every code-built max-height in vh carries its dvh twin (67 of them —
//      a scan that READS the count, so a new vh-only one turns this red)
//   P  planted offenders — each change undone in a served copy of a file
//      must turn its own check red
// Words come from RR_ADD_TYPED (config.js) — never typed here.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  typed_number_2031_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}

async function openApp(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 720 } });   // the customer's phone
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
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}

// the catalog on the customer's screen: MTH's 20-66238 and 30-66238, no RMT 66238;
// Lionel's 238 / 238E and a 2343-P for the "it IS the number" cases
const ROWS = [
  { itemNum: '20-66238', itemType: 'Passenger Set', description: 'Northern Pacific 2-Car Passenger Set', roadName: 'Northern Pacific', _era: 'mth_o', _tab: 'MTH O' },
  { itemNum: '30-66238', itemType: 'Passenger Car', description: 'Northern Pacific Coach', roadName: 'Northern Pacific', _era: 'mth_o', _tab: 'MTH O' },
  { itemNum: 'RMT-66299-01', itemType: 'Hopper', description: 'Beep Hopper', roadName: 'Pennsylvania', _era: 'rmt', _tab: 'RMT O' },
  { itemNum: '238', itemType: 'Steam Locomotive', description: '2-4-2 Steam', roadName: 'Lionel Lines', _era: 'pw', _tab: 'Lionel PW - Motive Power' },
  { itemNum: '238E', itemType: 'Steam Locomotive', description: '2-4-2 Steam, E-unit', roadName: 'Lionel Lines', _era: 'pw', _tab: 'Lionel PW - Motive Power' },
  { itemNum: '2343-P', itemType: 'Diesel Locomotive', description: 'Santa Fe F3 A Unit, powered', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Motive Power' },
];

async function scenario(pg) {
  return pg.evaluate(async (ROWS) => {
    const R = {};
    const W = RR_ADD_TYPED;
    const words = (k, n, m) => String(W[k] || '').replace('{num}', n).replace('{maker}', m || '');
    state.masterData = ROWS.map(r => Object.assign({}, r)); state.personalData = {}; state.isData = {}; state.personalSheetId = 'S'; _currentEra = 'all';
    state.user = { name: 'Lars', email: 'lars@example.com' };
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.rrMaybeShowAddHelp = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
    document.getElementById('app').classList.add('active');
    const sugg = () => document.getElementById('wiz-suggestions');
    const typedRow = () => sugg().querySelector('[data-typed-num]');
    const rowOf = (n) => Array.from(sugg().querySelectorAll('[data-idx]')).find(r => (r.querySelector('span') || {}).textContent === n);
    const chipOf = (row) => ((row && row.querySelector('[data-contains-num]')) || {}).textContent || '';
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    const type = async (v) => { const i = document.getElementById('wiz-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); updateItemSuggestions(v); await new Promise(r => setTimeout(r, 50)); };
    const fresh = async () => { await openWizard('collection'); wizard.data._era = 'all'; await new Promise(r => setTimeout(r, 120)); };

    // ── A: the Add list ──
    await fresh();
    await type('66238');
    const tr = typedRow();
    R.aTyped = !!tr; R.aTypedWords = tr ? tr.firstChild.textContent : ''; R.aTypedSub = tr ? tr.lastChild.textContent : '';
    R.aTypedFirst = !!tr && sugg().children[1] === tr;   // right under the count bar
    R.aTypedNoIdx = !!tr && !tr.hasAttribute('data-idx');
    R.aChip20 = chipOf(rowOf('20-66238')); R.aChip30 = chipOf(rowOf('30-66238'));
    R.aRows = Array.from(sugg().querySelectorAll('[data-idx]')).length;
    R.aExpectTyped = words('useTyped', '66238'); R.aExpectSub = words('useTypedSub', '66238'); R.aExpectChip = words('contains', '66238', 'MTH');
    // typed with the maker's name in front: the number is still the number
    await type('mth 66238');
    R.aMakerTyped = !!typedRow() && typedRow().getAttribute('data-typed-num') === '66238';
    // a number the catalog HAS: no typed row; 238 and 238E plain, the MTH
    // rows that merely contain 238 say so
    await type('238');
    R.aExact = { typed: !!typedRow(), chips: sugg().querySelectorAll('[data-contains-num]').length, rows: sugg().querySelectorAll('[data-idx]').length,
      c238: chipOf(rowOf('238')), c238e: chipOf(rowOf('238E')), c20: chipOf(rowOf('20-66238')), first: ((sugg().querySelector('[data-idx] span') || {}).textContent) };
    // the dash form IS the number
    await type('2343-p');
    R.aDash = { typed: !!typedRow(), rows: sugg().querySelectorAll('[data-idx]').length };
    // words, not a number: never a typed row
    await type('northern');
    R.aWords = { typed: !!typedRow(), rows: sugg().querySelectorAll('[data-idx]').length };
    // tap the typed row: the number stands, nothing from the catalog behind it, and the steps move on past the picker
    await type('66238');
    if (typedRow()) typedRow().click();
    await new Promise(r => setTimeout(r, 400));
    R.aAfterTap = { num: wizard.data.itemNum, asIs: wizard.data._typedAsIs, matched: wizard.matchedItem, step: stepType(), partials: (wizard.data._partialMatches || []).length, hidden: !sugg() || sugg().style.display === 'none' };
    _doCloseWizard();

    // ── B: Next on a typed number that only contains-matches ──
    await fresh();
    await type('66238');
    wizard.data.itemNum = '66238';
    await wizardNext();
    await new Promise(r => setTimeout(r, 150));
    const pick = () => document.querySelector('#wizard-modal [data-typed-num]');
    const pickBtns = () => Array.from(document.querySelectorAll('#wizard-modal button')).filter(b => /^(20|30)-66238/.test(b.textContent.trim()));
    R.bStep = stepType(); R.bNum = wizard.data.itemNum; R.bPartials = (wizard.data._partialMatches || []).length; R.bMatched = wizard.matchedItem;
    R.bPickTyped = !!pick(); R.bPickTypedWords = pick() ? pick().firstChild.textContent : '';
    R.bPickFirst = !!pick() && pick().parentElement.firstElementChild === pick();
    R.bPickChips = pickBtns().map(b => ((b.querySelector('[data-contains-num]') || {}).textContent || ''));
    // the typed button: back to the number step, then Next walks past the picker
    pick().click();
    await new Promise(r => setTimeout(r, 150));
    R.bBack = { step: stepType(), num: wizard.data.itemNum, asIs: wizard.data._typedAsIs, partials: (wizard.data._partialMatches || []).length };
    await wizardNext();
    await new Promise(r => setTimeout(r, 150));
    R.bOn = { step: stepType(), num: wizard.data.itemNum, matched: wizard.matchedItem, partials: (wizard.data._partialMatches || []).length };
    _doCloseWizard();
    // ONE contains-match (the Lars case exactly): still the picker, never taken silently
    state.masterData = ROWS.filter(r => r.itemNum !== '30-66238').map(r => Object.assign({}, r));
    await fresh();
    await type('66238');
    wizard.data.itemNum = '66238';
    await wizardNext();
    await new Promise(r => setTimeout(r, 150));
    R.bOne = { step: stepType(), num: wizard.data.itemNum, partials: (wizard.data._partialMatches || []).length, typed: !!pick(), chips: pickBtns().map(b => ((b.querySelector('[data-contains-num]') || {}).textContent || '')) };
    // picking the catalog row from the picker still works as before
    if (pickBtns()[0]) pickBtns()[0].click();
    await new Promise(r => setTimeout(r, 150));
    R.bPickRow = { step: stepType(), num: wizard.data.itemNum, matched: !!wizard.matchedItem && wizard.matchedItem.itemNum };
    _doCloseWizard();
    // the number the catalog HAS: straight through, as always
    state.masterData = ROWS.map(r => Object.assign({}, r));
    await fresh();
    await type('238');
    wizard.data.itemNum = '238';
    await wizardNext();
    await new Promise(r => setTimeout(r, 150));
    R.bExact = { step: stepType(), num: wizard.data.itemNum, matched: !!wizard.matchedItem && wizard.matchedItem.itemNum, partials: (wizard.data._partialMatches || []).length };
    _doCloseWizard();

    // ── C: the same number? ──
    R.c = {
      same: rrNumSameAsTyped('66238', '66238'), dash: rrNumSameAsTyped('2343-P', '2343p'), dashBack: rrNumSameAsTyped('1076L', '1076-l'),
      tail: rrNumSameAsTyped('20-66238', '66238'), suffix: rrNumSameAsTyped('238E', '238'), empty: rrNumSameAsTyped('', '66238'),
      maker20: rrRowMakerWord(ROWS[0]), makerRmt: rrRowMakerWord(ROWS[2]), makerPw: rrRowMakerWord(ROWS[3]),
    };
    R.toasts = toasts;
    return R;
  }, ROWS);
}

// ── D: the dvh scan — reads the source, counts the pairs ──
function dvhScan(files) {
  const bad = [], pairs = [];
  const re = /max-height:\s*(?:(\d+)vh|calc\(([^)]*?)100vh([^)]*?)\))(?:\s*;\s*max-height:\s*(?:(\d+)dvh|calc\(([^)]*?)100dvh([^)]*?)\)))?/g;
  Object.keys(files).forEach(f => {
    const src = files[f];
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      const twin = m[1] != null ? (m[4] === m[1]) : (m[5] === m[2] && m[6] === m[3]);
      (twin ? pairs : bad).push(f + ':' + line);
    }
  });
  return { bad, pairs };
}
// the words, lifted from config.js (the one block), never typed here
const RR_ADD_TYPED = (() => {
  const m = read('config.js').match(/const RR_ADD_TYPED = \{[\s\S]*?\n\};/);
  if (!m) throw new Error('RR_ADD_TYPED no longer found in config.js — update the harness extract');
  return new Function(m[0] + '; return RR_ADD_TYPED;')();
})();
const words = (k, n, m) => String(RR_ADD_TYPED[k] || '').replace('{num}', n).replace('{maker}', m || '');
const APP_JS = {};
fs.readdirSync(APP).filter(f => /\.js$/.test(f)).forEach(f => { APP_JS[f] = read(f); });

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const WS = read('wizard-suggestions.js'), WZ = read('wizard.js');

  // ── the real thing ──
  {
    const { ctx, pg, errs } = await openApp(browser, null);
    const R = await scenario(pg);
    ok('A1 "66238": the first row offers the number as typed, not in the catalog', R.aTyped && R.aTypedFirst && R.aTypedWords === R.aExpectTyped && R.aTypedWords.indexOf('66238') >= 0, JSON.stringify([R.aTypedWords, R.aExpectTyped]));
    ok('A2 the typed row explains itself (RR_ADD_TYPED.useTypedSub)', R.aTypedSub === R.aExpectSub && R.aTypedSub.length > 10, R.aTypedSub);
    ok('A3 the typed row is not a catalog row (no data-idx)', R.aTypedNoIdx);
    ok('A4 20-66238 and 30-66238 each say "MTH · contains 66238"', R.aChip20 === R.aExpectChip && R.aChip30 === R.aExpectChip && /MTH/.test(R.aChip20) && /66238/.test(R.aChip20), JSON.stringify([R.aChip20, R.aChip30, R.aExpectChip]));
    ok('A5 both catalog rows are still listed', R.aRows === 2, R.aRows);
    ok('A6 "mth 66238": the typed row carries the number alone', R.aMakerTyped);
    ok('A7 "238" (the catalog has it): no typed row; 238 first; 238 and 238E plain; 20-66238 says "MTH · contains 238"',
      !R.aExact.typed && R.aExact.rows === 4 && R.aExact.chips === 2 && R.aExact.first === '238' && R.aExact.c238 === '' && R.aExact.c238e === '' && R.aExact.c20 === words('contains', '238', 'MTH'), JSON.stringify(R.aExact));
    ok('A8 "2343-p" IS the catalog\'s 2343-P: no typed row', !R.aDash.typed && R.aDash.rows === 1, JSON.stringify(R.aDash));
    ok('A9 words ("northern"): never a typed row', !R.aWords.typed && R.aWords.rows === 2, JSON.stringify(R.aWords));
    ok('A10 tapping the typed row: 66238 stands, no catalog row behind it, the list closes, the steps move on past the picker',
      R.aAfterTap.num === '66238' && R.aAfterTap.asIs === '66238' && R.aAfterTap.matched == null && R.aAfterTap.partials === 0 && R.aAfterTap.hidden
      && R.aAfterTap.step !== 'itemNumGrouping' && R.aAfterTap.step !== 'itemPicker', JSON.stringify(R.aAfterTap));
    ok('B1 Next on 66238 (two contains-matches): the picker, the number untouched', R.bStep === 'itemPicker' && R.bNum === '66238' && R.bPartials === 2 && R.bMatched == null, JSON.stringify([R.bStep, R.bNum, R.bPartials]));
    ok('B2 the picker\'s first button keeps the number as typed', R.bPickTyped && R.bPickFirst && R.bPickTypedWords === R.aExpectTyped, JSON.stringify([R.bPickTyped, R.bPickFirst, R.bPickTypedWords]));
    ok('B3 the picker\'s catalog buttons say "MTH · contains 66238"', R.bPickChips.length === 2 && R.bPickChips.every(c => c === R.aExpectChip), JSON.stringify(R.bPickChips));
    ok('B4 the typed button: back on the number step with 66238 standing', R.bBack.step === 'itemNumGrouping' && R.bBack.num === '66238' && R.bBack.asIs === '66238' && R.bBack.partials === 0, JSON.stringify(R.bBack));
    ok('B5 Next again walks past the picker, 66238 still the number, no catalog row', R.bOn.step !== 'itemNumGrouping' && R.bOn.step !== 'itemPicker' && R.bOn.num === '66238' && R.bOn.matched == null && R.bOn.partials === 0, JSON.stringify(R.bOn));
    ok('B6 ONE contains-match (Lars\'s exact case): still the picker — never taken silently', R.bOne.step === 'itemPicker' && R.bOne.num === '66238' && R.bOne.partials === 1 && R.bOne.typed && R.bOne.chips.length === 1 && R.bOne.chips[0] === R.aExpectChip, JSON.stringify(R.bOne));
    ok('B7 choosing the catalog row from the picker still works (20-66238 becomes the item)', R.bPickRow.step === 'itemNumGrouping' && R.bPickRow.num === '20-66238' && R.bPickRow.matched === '20-66238', JSON.stringify(R.bPickRow));
    ok('B8 a number the catalog HAS goes straight through as always', R.bExact.step !== 'itemNumGrouping' && R.bExact.step !== 'itemPicker' && R.bExact.num === '238' && R.bExact.matched === '238' && R.bExact.partials === 0, JSON.stringify(R.bExact));
    ok('C1 rrNumSameAsTyped: the dash before a letter suffix is the only give', R.c.same && R.c.dash && R.c.dashBack && !R.c.tail && !R.c.suffix && !R.c.empty, JSON.stringify(R.c));
    ok('C2 rrRowMakerWord: MTH / RMT / Lionel', R.c.maker20 === 'MTH' && R.c.makerRmt === 'RMT' && R.c.makerPw === 'Lionel', JSON.stringify(R.c));
    ok('C3 no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── D: the dvh scan ──
  {
    const d = dvhScan(APP_JS);
    ok('D1 every code-built max-height in vh carries its dvh twin (app/*.js)', d.bad.length === 0, d.bad.join(', '));
    ok('D2 the sweep is all there: 67 twins or more', d.pairs.length >= 67, String(d.pairs.length));
    ok('D3 the item edit panel (app-collection.js) is among them', d.pairs.some(p => p.indexOf('app-collection.js:') === 0) && /max-height:92vh;max-height:92dvh/.test(APP_JS['app-collection.js']));
    ok('D4 _typedAsIs and _partialNum never reach the sheet (wizard.js save skip list)', /'_partialMatches','_partialQuery','_partialNum','_typedAsIs',/.test(WZ));
    // planted: one twin taken away
    const p = dvhScan(Object.assign({}, APP_JS, { 'app-collection.js': APP_JS['app-collection.js'].replace('max-height:92vh;max-height:92dvh', 'max-height:92vh') }));
    ok('P1 PLANTED a vh-only max-height: D1 can fail', p.bad.length === 1 && /app-collection\.js/.test(p.bad[0]), JSON.stringify(p.bad));
    const p2 = dvhScan({ 'x.js': "a.style.cssText='max-height:calc(100vh - 2rem);overflow:auto'; b.style.cssText='max-height:calc(100vh - 2rem);max-height:calc(100dvh - 2rem)'; c.style.cssText='max-height:80vh;max-height:70dvh'" });
    ok('P2 PLANTED a calc(100vh) without its twin, and a twin with the wrong number: both caught', p2.bad.length === 2 && p2.pairs.length === 1, JSON.stringify(p2));
  }

  // ── P: planted offenders in the app itself ──
  {
    // the typed row gone from the list
    const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(WS, 'if (_typedNum) {\n    const tRow', 'if (false) {\n    const tRow', 'typed row') });
    const R = await scenario(pg).catch(e => ({ err: String(e) }));
    ok('P3 PLANTED no typed row in the list: A1 can fail', !R.err && !R.aTyped, R.err || '');
    await ctx.close();
  }
  {
    // the contains chip gone
    const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(WS, "if (_numQ && !rrNumSameAsTyped(c.num, _hlNum) && String(c.num || '').toLowerCase().indexOf(_hlNum) !== 0) {\n      const containsSpan", "if (false) {\n      const containsSpan", 'contains chip') });
    const R = await scenario(pg).catch(e => ({ err: String(e) }));
    ok('P4 PLANTED no contains chip: A4 can fail', !R.err && R.aChip20 === '' && R.aTyped, R.err || R.aChip20);
    await ctx.close();
  }
  {
    // the old Next: one contains-match taken silently
    const { ctx, pg } = await openApp(browser, { 'wizard.js': plant(WZ, '} else if (_partials.length >= 1) {',
      "} else if (_partials.length === 1) { wizard.data.itemNum = _partials[0].itemNum; wizard.data._partialMatches = []; wizard.matchedItem = _partials[0]; lookupItem(_partials[0].itemNum); } else if (_partials.length > 1) {", 'old auto-select') });
    const R = await scenario(pg).catch(e => ({ err: String(e) }));
    ok('P5 PLANTED the old silent pick: B6 can fail (66238 becomes 20-66238)', !R.err && R.bOne.num === '20-66238' && R.bOne.step !== 'itemPicker', R.err || JSON.stringify(R.bOne));
    await ctx.close();
  }
  {
    // the typed row no longer tells Next the number stands
    const { ctx, pg } = await openApp(browser, { 'wizard-suggestions.js': plant(WS, "wizard.data._typedAsIs = String(num).trim().toLowerCase();", "", 'typed flag') });
    const R = await scenario(pg).catch(e => ({ err: String(e) }));
    ok('P6 PLANTED the typed row without its flag: A10 can fail (Next lands in the picker again)', !R.err && R.aAfterTap.step === 'itemPicker', R.err || JSON.stringify(R.aAfterTap));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
