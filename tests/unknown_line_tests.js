#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// THE ADD BOX UNDER A CATALOG MATCH — unknownline   (real Chromium, the REAL app)
//
// Seen on the live app 2026-11-24: typing 1008201 (the Industrial Rail MOW handcar as the box
// prints it) listed the catalog's 1008201A — and right under it the box said "Not in our Master
// Catalog — the next steps ask who made it and what it is", with "Use 1008201 as typed, not in
// the catalog" ABOVE the catalog row. [stated] Brad 2026-11-24 20:24 CT "Yes" (the line only when
// there are no matches), 20:27 CT "Yes" (the catalog row first when it is the typed number plus
// one letter), 20:30 CT "Yes" (build). PLAN_2026-11-24_ADD_BOX_NOT_IN_CATALOG_LINE.md.
//   O  the order: a row that is the typed number plus ONE letter leads; "Use … as typed" follows
//      it; a row that only CONTAINS the digits stays below (the v0.9.2031 rule, Lars's 66238)
//   S  the line under the box: never under a listed catalog row; still there when no list is open
//   K  the arrow keys walk the rows in the order they are drawn
//   N  rrNumPlusLetter: one letter, by the same-number key, never a row that IS the number
//   P  planted offenders — each change undone in a served copy must turn its own check red
// Words come from the config file (RR_ADD_TYPED, RR_ADD_FILTERS) — never typed here.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  unknown_line_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.split(from).length !== 2) throw new Error('planted offender "' + label + '" no longer matches the source exactly once — update the test');
  return src.replace(from, to);
}

async function openApp(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 720 } });
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

// the catalog on screen: Atlas's handcar 1008201A (the box prints 1008201), a trolley in two road
// numbers (1008101A / B), an MTH row that only CONTAINS 1008201, Lars's 20-66238, Lionel's 2343-P
const ROWS = [
  { itemNum: '1008201A', itemType: 'Diesel Locomotive', subType: 'Powered Hand Car', description: 'Maintenance of Way 100', roadName: 'Maintenance of Way', _era: 'atlas', _tab: 'Atlas O' },
  { itemNum: '1008101A', itemType: 'Trolley', description: 'LA Transit Lines 1401', roadName: 'LA Transit Lines', _era: 'atlas', _tab: 'Atlas O' },
  { itemNum: '1008101B', itemType: 'Trolley', description: 'LA Transit Lines 1402', roadName: 'LA Transit Lines', _era: 'atlas', _tab: 'Atlas O' },
  { itemNum: '30-1008201', itemType: 'Boxcar', description: 'A boxcar whose number holds the digits', roadName: 'Erie', _era: 'mth_o', _tab: 'MTH O' },
  { itemNum: '20-66238', itemType: 'Passenger Set', description: 'Northern Pacific 2-Car Passenger Set', roadName: 'Northern Pacific', _era: 'mth_o', _tab: 'MTH O' },
  { itemNum: '2343-P', itemType: 'Diesel Locomotive', description: 'Santa Fe F3 A Unit, powered', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Motive Power' },
];

async function scenario(pg) {
  return pg.evaluate(async (ROWS) => {
    const R = {};
    state.masterData = ROWS.map(r => Object.assign({}, r)); state.personalData = {}; state.isData = {}; state.personalSheetId = 'S'; _currentEra = 'all';
    state.user = { name: 'Bob', email: 'bob@example.com' };
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.rrMaybeShowAddHelp = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    window.showToast = () => {};
    document.getElementById('app').classList.add('active');
    const sugg = () => document.getElementById('wiz-suggestions');
    // what is drawn, top to bottom, under the count bar: 'TYPED' or a row's number
    const drawn = () => Array.from(sugg().children).slice(1).map(c => c.hasAttribute('data-typed-num') ? 'TYPED' : ((c.querySelector('span') || {}).textContent || '?'));
    const idx = () => Array.from(sugg().querySelectorAll('[data-idx]')).map(r => r.dataset.idx + ':' + (r.querySelector('span') || {}).textContent);
    const type = async (v) => { const i = document.getElementById('wiz-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); updateItemSuggestions(v); await new Promise(r => setTimeout(r, 50)); };
    const fresh = async () => { await openWizard('collection'); wizard.data._era = 'all'; await new Promise(r => setTimeout(r, 120)); };
    const line = (v) => { wizard.data.itemNum = v; lookupItem(v); const m = document.getElementById('wiz-match');
      return { unknown: !!(m && m.querySelector('[data-unknown-line]')), text: m ? m.textContent.replace(/\s+/g, ' ').trim() : '?' }; };

    await fresh();
    // ── O: the order ──
    await type('1008201');
    R.o1 = drawn(); R.o1idx = idx(); R.o1count = sugg().children[0].textContent;
    R.s1 = line('1008201');
    R.s1noRow = (typeof _rrAddNoRowItem === 'function') ? _rrAddNoRowItem(wizard.data, true) : null;   // the number as typed is still not a catalog row
    await type('1008101');
    R.o2 = drawn();
    await type('66238');
    R.o3 = drawn();
    R.s2 = line('66238');
    await type('2343');
    R.o4 = drawn();
    await type('1008201a');
    R.o5 = drawn();
    R.s5 = line('1008201a');
    // ── S: nothing listed at all / no list open ──
    await type('7777');
    R.s3 = { nothing: !!sugg().querySelector('[data-nothing-found]'), line: line('7777') };
    await type('66238');
    const tr = sugg().querySelector('[data-typed-num]'); if (tr) tr.click();
    await new Promise(r => setTimeout(r, 400));
    _doCloseWizard();
    await fresh();
    sugg().style.display = 'none'; sugg().innerHTML = '';
    R.s4 = line('66238');
    R.words = String((window.RR_ADD_FILTERS || {}).unknownLine || '');
    // ── K: the arrow keys ──
    await type('1008201');
    const key = k => handleSuggestionKey({ key: k, preventDefault() {} });
    key('ArrowDown');
    const hot = Array.from(sugg().querySelectorAll('[data-idx]')).filter(r => /surface2/.test(r.style.background)).map(r => (r.querySelector('span') || {}).textContent);
    key('Enter');
    await new Promise(r => setTimeout(r, 300));
    R.k = { hot: hot, num: wizard.data.itemNum, matched: !!wizard.matchedItem && wizard.matchedItem.itemNum };
    _doCloseWizard();
    // ── N: the rule itself ──
    R.n = { a: rrNumPlusLetter('1008201A', '1008201'), dash: rrNumPlusLetter('2343-P', '2343'), plain: rrNumPlusLetter('2343P', '2343'), e: rrNumPlusLetter('238E', '238'),
      same: rrNumPlusLetter('1008201', '1008201'), sameLetter: rrNumPlusLetter('1008201A', '1008201a'), contains: rrNumPlusLetter('30-1008201', '1008201'), two: rrNumPlusLetter('1008201AB', '1008201'),
      digit: rrNumPlusLetter('6464-1', '6464'), tail: rrNumPlusLetter('20-66238', '66238'), empty: rrNumPlusLetter('', '1008201'), letterTyped: rrNumPlusLetter('K675402A', 'K675402') };
    return R;
  }, ROWS);
}

function judge(R, errs) {
  const J = {};
  const s = x => JSON.stringify(x);
  J['O1 typed 1008201: the catalog\'s 1008201A leads, "Use 1008201 as typed" follows, the row that only contains the digits is last'] = [s(R.o1) === s(['1008201A', 'TYPED', '30-1008201']), s(R.o1)];
  J['O2 the count bar still counts the catalog rows (2 matches)'] = [/^2 matches/.test(R.o1count), R.o1count];
  J['O3 two rows that are the number plus a letter (1008101A, 1008101B) both lead, in their own order'] = [s(R.o2) === s(['1008101A', '1008101B', 'TYPED']), s(R.o2)];
  J['O4 Lars\'s 66238: "Use 66238 as typed" still leads the row that only contains it (the v0.9.2031 rule)'] = [s(R.o3) === s(['TYPED', '20-66238']), s(R.o3)];
  J['O5 typed 2343: Lionel\'s 2343-P (a letter after a dash) leads, then the typed row'] = [s(R.o4) === s(['2343-P', 'TYPED']), s(R.o4)];
  J['O6 typed 1008201a IS the catalog\'s number: no typed row at all'] = [s(R.o5.filter(x => x !== '30-1008201')) === s(['1008201A']) && R.o5.indexOf('TYPED') < 0, s(R.o5)];
  J['S1 under a listed catalog row the box does NOT say "Not in our Master Catalog"'] = [R.s1.unknown === false && R.s1.text === '' && R.words.length > 20, s(R.s1)];
  J['S2 ...and the number as typed is still not a catalog row (kept as typed, the next steps still ask who made it)'] = [R.s1noRow === true, s(R.s1noRow)];
  J['S3 the same under a row that only contains the digits (one message: the list says it)'] = [R.s2.unknown === false && R.s2.text === '', s(R.s2)];
  J['S4 nothing fits at all: the list says "No … found" and the line stays empty, as before'] = [R.s3.nothing === true && R.s3.line.unknown === false && R.s3.line.text === '', s(R.s3)];
  J['S5 with no list open the line is there, in the config file\'s words'] = [R.s4.unknown === true && R.s4.text === R.words, s(R.s4)];
  J['K1 the rows are numbered in the order they are drawn, and Arrow Down + Enter takes the first one (1008201A)'] =
    [s(R.o1idx) === s(['0:1008201A', '1:30-1008201']) && s(R.k.hot) === s(['1008201A']) && R.k.matched === '1008201A', s([R.o1idx, R.k])];
  J['N1 rrNumPlusLetter: one letter after the number (dash or not); never the same number, a contains row, two letters or a digit ending'] =
    [R.n.a && R.n.dash && R.n.plain && R.n.e && R.n.letterTyped && !R.n.same && !R.n.sameLetter && !R.n.contains && !R.n.two && !R.n.digit && !R.n.tail && !R.n.empty, s(R.n)];
  J['E1 the page ran without a script error'] = [errs.length === 0, s(errs)];
  return J;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const WS = read('wizard-suggestions.js');

  console.log('== the real code ==');
  let real;
  {
    const { ctx, pg, errs } = await openApp(browser, null);
    real = judge(await scenario(pg), errs);
    Object.keys(real).forEach(n => ok(n, real[n][0], real[n][1]));
    await ctx.close();
  }

  // ── P · planted offenders: ONE app start each; the named check must go red (and is green on the real code) ──
  console.log('\n== P · planted offenders ==');
  const PLANTS = [
    ['the line shown under a listed catalog row (the bug, put back)', /^S1 /,
      () => plant(WS, " || !!_sgEl.querySelector('[data-idx]'));", ');', 'S1')],
    ['the line gone even when no list is open (unknownnum broken)', /^S5 /,
      () => plant(WS, 'var _sgNF = _sgShown && (', 'var _sgNF = true || (', 'S5')],
    ['the number-plus-a-letter row left below the typed row', /^O1 /,
      () => plant(WS, '      if (_ulA.length) {\n', '      if (false) {\n', 'O1')],
    ['a row that only CONTAINS the digits leads the typed row (the v0.9.2031 rule broken)', /^O4 /,
      () => plant(WS, "  return ka.length === kb.length + 1 && ka.indexOf(kb) === 0 && /\\d$/.test(kb) && /[A-Z]$/.test(ka);\n", '  return ka.indexOf(kb) >= 0;\n', 'O4')],
    ['the typed row dropped when a catalog row leads', /^O1 /,
      () => plant(WS, '    if (_typedRow && i === _ulLead - 1) { el.appendChild(_typedRow); _typedRow = null; }', '', 'O1b')],
    ['two letters taken as one (1008201AB for 1008201)', /^N1 /,
      () => plant(WS, 'ka.length === kb.length + 1 && ', 'ka.length > kb.length && ', 'N1')],
  ];
  let k = 0;
  for (const [label, re, make] of PLANTS) {
    k++;
    let J;
    try {
      const { ctx, pg, errs } = await openApp(browser, { 'wizard-suggestions.js': make() });
      J = judge(await scenario(pg), errs);
      await ctx.close();
    } catch (e) { ok('P' + k + ' planted: ' + label + ' — could be run', false, String(e && e.message)); continue; }
    const hit = Object.keys(J).filter(n => re.test(n));
    ok('P' + k + ' planted: ' + label + ' → ' + (hit[0] || '?').slice(0, 2) + ' goes red', hit.length === 1 && J[hit[0]][0] === false && real[hit[0]][0] === true, JSON.stringify(hit.map(n => [n.slice(0, 24), J[n][0], J[n][1]])));
  }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASSED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
