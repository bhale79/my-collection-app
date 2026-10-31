#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// workbench_filters_tests.js — 2026-10-31 (maintenance chat)
//
// [stated] Brad, on the Workbench's "+ Add task — for which item?" step:
// "need filters here for manufacter, scale, era, type" → "yes" to the plan:
// four filters, the SAME rules as My Collection (no second copy), only choices
// he owns, each with its number, remembered on the device, a Clear link — and
// the two things in his screenshot: the list pushed sideways, and the first
// row ("Add Up Your 1966 Lionel Profits", a long title used as the number)
// squeezed into a tall blank sliver.
//
//   A  ONE rule: My Collection's list and the Workbench both ask
//      rrChipRowPasses / rrCopyMakerIs (browse.js); the Workbench re-derives
//      nothing; the list holds no copy of its own. Planted: a copied rule.
//   B  THE SAME ANSWER (real app, real Chromium, the fixture in
//      tests/lib/wb_filter_fixture.js): for every choice the Workbench offers,
//      and for combinations of them, the copies it lists are EXACTLY the copies
//      My Collection draws with the same filters — and each choice's number is
//      what picking it lists. Planted: filing a copy under its own record
//      instead of its row → the comparison catches the difference.
//   C  the choices: "Any …" first with the total, only what he owns, nothing
//      at 0, the makers the catalog does not know (Ertl) offered too
//   D  search + filters together, "Showing N of M", Clear, remembered after
//      closing, a remembered choice that matches nothing still offers the way back
//   E  the layout at phone and computer width: no sideways scroll, the long
//      title wraps in its own column. Planted: the old one-line number → caught.
//   F  picking under a filter still opens THAT copy (by inventoryId)
//
// Run:  node tests/workbench_filters_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  workbench_filters_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIXTURE = require('./lib/wb_filter_fixture.js').toString();
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 700) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── A · one rule (source) ────────────────────────────────────────────────────
const BROWSE = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
const MAINT = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
function block(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
// the helpers that decide maker / scale / era / type — only rrChipRowPasses may call them for a filter
const RULE_CALLS = /\b(_itemEraPeriod|_scalesOfGauge|_scalesOfItem|_manufacturerOfItem|rrRowAlsoSoldBy|getTypeBucketLabel)\s*\(/;
function workbenchRederives(src) {
  // the Workbench's picker code: from the picker state to _wbPicked
  const a = src.indexOf("var _wbPickQ = '';"), b = src.indexOf('window._wbPicked = function (invId)');
  if (a < 0 || b < 0) return 'picker code not found';
  // getTypeBucketLabel may NAME the Type choices (it never decides a match)
  const body = src.slice(a, b).replace(/getTypeBucketLabel\(o\.row\)/g, '');
  const m = body.match(RULE_CALLS);
  return m ? m[0] : '';
}
section('A · ONE rule for the four filters');
{
  const core = block(BROWSE, 'function _rrBrowseCore(_co) {');
  const rule = block(BROWSE, 'function rrChipRowPasses(item, pd, ch, type, mode) {');
  ok('A1 browse.js has the one rule (rrChipRowPasses) and the copy-maker rule (rrCopyMakerIs)', rule.length > 500 && /function rrCopyMakerIs\(pd, maker\)/.test(BROWSE));
  ok('A2 My Collection\'s row test asks it — owned view and all-eras mode passed in, not read inside',
    /if \(!rrChipRowPasses\(item, pd, _stp3b, type, \{ owned: !!state\.filters\.owned, allEra: _currentEra === 'all' \}\)\) return false;/.test(core)
    && !/state\.filters|_currentEra/.test(rule));
  ok('A3 …and the list holds no copy of its own (no scale / era / also-sold-as test left in _rrBrowseCore)',
    core.length > 1000 && !/_scalesOfGauge\(|rrRowAlsoSoldBy\(|_itemEraPeriod\(/.test(core));
  ok('A4 the list\'s "Also in your collection" maker filter asks rrCopyMakerIs', /if \(state\.filters\.ownMaker && !rrCopyMakerIs\(pd, state\.filters\.ownMaker\)\) return false;/.test(core));
  ok('A5 the list builds a typed-in copy\'s row with the shared builder (rrPersonalOnlyRow)', /\.map\(rrPersonalOnlyRow\);/.test(core) && /function rrPersonalOnlyRow\(pd\) \{/.test(BROWSE));
  ok('A6 the Workbench asks the same three (rrChipRowPasses, rrCopyMakerIs, rrPersonalOnlyRow)',
    /rrChipRowPasses\(o\.row, o\.pd, ch, ty, \{ owned: true, allEra: true \}\)/.test(MAINT) && /rrCopyMakerIs\(o\.pd, mf\.slice\(4\)\)/.test(MAINT) && /return rrPersonalOnlyRow\(pd\);/.test(MAINT));
  ok('A7 …and re-derives NOTHING itself (no maker / scale / era helper called in the picker)', workbenchRederives(MAINT) === '', workbenchRederives(MAINT));
  const planted = MAINT.replace("  function _wbSearchHit(o, q) {", "  function _wbEraOk(o, e) { return _itemEraPeriod(o.row) === e; }\n  function _wbSearchHit(o, q) {");
  ok('A8 PLANTED: an era test pasted into the Workbench → caught by A7', planted !== MAINT && workbenchRederives(planted) === '_itemEraPeriod(', workbenchRederives(planted));
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });   // one device: pages share its storage
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(800);
    await pg.evaluate((src) => {
      localStorage.removeItem('lv_wb_pick_filters');
      (0, eval)('(' + src + ')')();
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-browse').classList.add('active');
      // ── the two readers, exposed to the test ──
      const ids = it => {
        if (it._personalOnly) return [String(it.inventoryId)];
        if (it._copyPd) return [String(it._copyPd.inventoryId)];
        return Object.values(state.personalData).filter(p => p.owned && p.itemNum === _displayItemNum(it)).map(p => String(p.inventoryId));
      };
      window.__mc = (f) => {   // what My Collection draws with these filters
        const mf = f.manufacturer || 'any', own = mf.indexOf('own:') === 0;
        localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: own ? 'any' : mf, scale: f.scale || 'any', era: f.era || 'any', section: 'items' }));
        state.filters.ownMaker = own ? mf.slice(4) : '';
        state.filters.type = f.type || '';
        state._collSection = 'all';
        window._rrBrowseSig = null; renderBrowse();
        const s = new Set(); (state.filteredData || []).forEach(it => ids(it).forEach(x => s.add(x)));
        return [...s].sort();
      };
      window.__wbOpenCalls = [];
      window._wbOpen = (inv, num, focus, purpose) => window.__wbOpenCalls.push([inv, num, purpose]);
      window.__wb = () => {      // what the Workbench lists, and its choices
        const lines = [...document.querySelectorAll('#wb-pick-list [onclick^="_wbPicked("]')].map(el => el.getAttribute('onclick').match(/_wbPicked\('([^']*)'\)/)[1]).sort();
        const opts = {};
        ['manufacturer', 'scale', 'era', 'type'].forEach(l => {
          opts[l] = [...document.querySelectorAll('#wb-f-' + l + ' option')].map(o => ({ id: o.value, text: o.textContent, n: +(o.textContent.match(/\((\d+)\)$/) || [0, -1])[1], sel: o.selected }));
        });
        const sh = document.getElementById('wb-pick-showing');
        return { lines, opts, showing: sh ? sh.textContent : '', clear: !!(sh && /Clear filters/.test(sh.textContent)), msg: (document.getElementById('wb-pick-list') || {}).textContent || '' };
      };
      window.__set = (f) => { ['manufacturer', 'scale', 'era', 'type'].forEach(l => _wbPickFilter(l, f[l] || (l === 'type' ? '' : 'any'))); return window.__wb(); };
      filterOwned();
    }, FIXTURE);
    const ALL = await pg.evaluate(() => window.__mc({}));
    await pg.evaluate(() => _wbAddTask());
    const first = await pg.evaluate(() => window.__wb());

    section('B · the Workbench lists exactly what My Collection shows');
    ok('B0 with no filter: every owned copy, both screens (20)', first.lines.length === 20 && JSON.stringify(first.lines) === JSON.stringify(ALL), { wb: first.lines, mc: ALL });
    const combos = [];
    ['manufacturer', 'scale', 'era', 'type'].forEach(l => first.opts[l].forEach(o => { const f = {}; f[l] = o.id; combos.push(f); }));
    first.opts.manufacturer.forEach(m => first.opts.era.forEach(e => combos.push({ manufacturer: m.id, era: e.id })));
    first.opts.scale.forEach(s => first.opts.era.forEach(e => combos.push({ scale: s.id, era: e.id })));
    first.opts.manufacturer.forEach(m => first.opts.type.forEach(t => combos.push({ manufacturer: m.id, type: t.id })));
    first.opts.manufacturer.forEach(m => first.opts.scale.forEach(s => combos.push({ manufacturer: m.id, scale: s.id, era: 'postwar' })));
    const bad = [], badN = [];
    for (const f of combos) {
      const r = await pg.evaluate((f) => ({ wb: window.__set(f), mc: window.__mc(f) }), f);
      if (JSON.stringify(r.wb.lines) !== JSON.stringify(r.mc)) bad.push({ f, wb: r.wb.lines, mc: r.mc });
      // every choice's number = what picking it lists (asked of the screen just drawn)
      ['manufacturer', 'scale', 'era', 'type'].forEach(l => { const s = r.wb.opts[l].find(o => o.sel); if (!s || s.n !== r.wb.lines.length) badN.push({ f, l, sel: s, listed: r.wb.lines.length }); });
    }
    ok('B1 ' + combos.length + ' filter combinations: the Workbench and My Collection list the very same copies', combos.length > 100 && bad.length === 0, bad.slice(0, 3));
    ok('B2 …and the number beside each picked choice is what it lists', badN.length === 0, badN.slice(0, 3));
    const spot = await pg.evaluate(() => ({
      atlas: window.__set({ manufacturer: 'atlas' }).lines, lionel: window.__set({ manufacturer: 'lionel' }).lines,
      s: window.__set({ scale: 's' }).lines, std: window.__set({ scale: 'standard' }).lines, prewar: window.__set({ era: 'prewar' }).lines,
      ertl: window.__set({ manufacturer: 'own:Ertl' }).lines, menO: window.__set({ manufacturer: 'menards', scale: 'o', era: 'modern' }).lines }));
    ok('B3 spot checks: Atlas = the Atlas 3300 + the HO hopper (not the Lionel Pre-War 3300)', JSON.stringify(spot.atlas) === '["112","113"]', spot.atlas);
    ok('B4 …Lionel includes the MTH sold as "Lionel Corporation" (114) and the copy with a blank maker cell (105)', spot.lionel.includes('114') && spot.lionel.includes('105') && !spot.lionel.includes('112'), spot.lionel);
    ok('B5 …S = the American Flyer; Standard = the 260E and the "Standard & O" transformer', JSON.stringify(spot.s) === '["115"]' && JSON.stringify(spot.std) === '["104","109"]', spot);
    ok('B6 …Pre-War = 260E and the year-less 800; Ertl (a maker the catalog does not know) = the truck', JSON.stringify(spot.prewar) === '["109","110"]' && JSON.stringify(spot.ertl) === '["116"]', spot);
    ok('B7 …a typed-in Menards O building made 2016 is under Menards · O · Modern', JSON.stringify(spot.menO) === '["117"]', spot.menO);
    // PLANTED: the likeliest real mistake — asking the rule about the copy's own
    // record instead of the row My Collection files it under
    const planted = await pg.evaluate(() => {
      const diffs = [];
      const owned = Object.values(state.personalData).filter(p => p.owned);
      ['lionel', 'atlas', 'mth', 'menards'].forEach(m => ['any', 'o', 'ho', 's', 'standard'].forEach(s => ['any', 'prewar', 'postwar', 'modern'].forEach(e => {
        const viaPd = owned.filter(p => rrChipRowPasses(p, p, { manufacturer: m, scale: s, era: e }, '', { owned: true, allEra: true })).map(p => String(p.inventoryId)).sort();
        const mc = window.__mc({ manufacturer: m, scale: s, era: e });
        if (JSON.stringify(viaPd) !== JSON.stringify(mc)) diffs.push(m + '/' + s + '/' + e);
      })));
      return diffs;
    });
    ok('B8 PLANTED: filing each copy under its own record instead of its row → the comparison finds differences (so B1 can fail)', planted.length > 0, planted.length);

    section('C · the choices');
    const o0 = await pg.evaluate(() => window.__set({}).opts);
    ok('C1 each list starts with "Any …" and the total (20)', ['manufacturer', 'scale', 'era', 'type'].every(l => /^Any /.test(o0[l][0].text) && o0[l][0].n === 20), ['manufacturer', 'scale', 'era', 'type'].map(l => o0[l][0]));
    ok('C2 nothing offered at 0', ['manufacturer', 'scale', 'era', 'type'].every(l => o0[l].every(o => o.n > 0)), o0);
    const mk = o0.manufacturer.map(o => o.id);
    ok('C3 makers: only ones he owns — Lionel, Atlas, MTH, Menards, A.C. Gilbert, + Ertl and Pittman (not in the catalog\'s list); no Weaver, no LGB',
      ['lionel', 'atlas', 'mth', 'menards', 'a.c. gilbert', 'own:Ertl', 'own:Pittman'].every(x => mk.includes(x)) && !mk.includes('weaver') && !mk.includes('lgb') && !mk.includes('own:Lionel') && !mk.includes('own:Menards'), mk);
    ok('C4 scales: O, HO, S, Standard — and no N, Z, G', ['o', 'ho', 's', 'standard'].every(x => o0.scale.some(o => o.id === x)) && !o0.scale.some(o => ['n', 'z', 'g'].includes(o.id)), o0.scale);
    ok('C5 eras: Pre-War, Postwar, Modern, each named for a collector', o0.era.length === 4 && o0.era.slice(1).every(o => !/^(prewar|postwar|modern) \(/.test(o.text)), o0.era.map(o => o.text));
    ok('C6 types: the same names My Collection uses (Steam, Boxcar, Paper…)', ['Steam', 'Boxcar', 'Paper', 'Diesel'].every(t => o0.type.some(o => o.id === t)), o0.type.map(o => o.id));
    const narrowed = await pg.evaluate(() => window.__set({ era: 'prewar' }).opts.manufacturer.map(o => o.id + ':' + o.n));
    ok('C7 a filter narrows the OTHER lists too (Pre-War picked → only Lionel offered, with 2)', JSON.stringify(narrowed) === '["any:2","lionel:2"]', narrowed);

    section('D · search, Showing, Clear, remembered');
    const d1 = await pg.evaluate(() => { window.__set({ manufacturer: 'lionel' }); _wbPickSearch('steam'); return window.__wb(); });
    ok('D1 search and a filter together (Lionel + "steam" → 224 ×3, 2046, 260E, 8100)', JSON.stringify(d1.lines) === '["100","101","107","109","111","119"]', d1.lines);
    ok('D2 "Showing 6 of 20" and a Clear filters link', /Showing 6 of 20/.test(d1.showing) && d1.clear, d1.showing);
    const d3 = await pg.evaluate(() => { _wbPickSearch(''); _wbPickClear(); return window.__wb(); });
    ok('D3 Clear filters → all four back to Any, all 20 listed, the link gone', d3.lines.length === 20 && !d3.clear && ['manufacturer', 'scale', 'era', 'type'].every(l => d3.opts[l][0].sel), d3.showing);
    const d4 = await pg.evaluate(() => { window.__set({ manufacturer: 'atlas', scale: 'ho' }); _wbCloseCard(); _wbAddPart(); const w = window.__wb(); return { w, ls: localStorage.getItem('lv_wb_pick_filters'), title: document.querySelector('#wb-card .rr-card-title').textContent }; });
    ok('D4 closed and reopened (+ Add part this time): the filters are remembered on this device', JSON.stringify(d4.w.lines) === '["113"]' && /"manufacturer":"atlas"/.test(d4.ls) && /Add a part/.test(d4.title), d4);
    const d5 = await pg.evaluate(() => { localStorage.setItem('lv_wb_pick_filters', JSON.stringify({ manufacturer: 'lionel', scale: 'ho', era: 'any', type: '' })); _wbCloseCard(); });
    void d5;
    // a fresh page load reads the remembered choice (Lionel · HO matches nothing here)
    const pg2 = await ctx.newPage();   // same browser profile: the same device's storage
    await pg2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pg2.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg2.waitForTimeout(800);
    const d6 = await pg2.evaluate((src) => {
      (0, eval)('(' + src + ')')();
      _wbAddTask();
      const sel = l => { const s = document.getElementById('wb-f-' + l); return s ? s.options[s.selectedIndex].textContent : ''; };
      return { lines: document.querySelectorAll('#wb-pick-list [onclick^="_wbPicked("]').length, msg: document.getElementById('wb-pick-list').textContent, scale: sel('scale'), mf: sel('manufacturer'), clear: /Clear filters/.test(document.getElementById('wb-pick-showing').textContent) };
    }, FIXTURE);
    await pg2.close();
    ok('D5 after a reload the remembered Lionel · HO is still picked, shown with (0), and says so', d6.lines === 0 && /HO.*\(0\)/.test(d6.scale) && /Lionel/.test(d6.mf) && /matches those filters/.test(d6.msg), d6);
    ok('D6 …and the way back is right there (Clear filters)', d6.clear === true, d6);

    section('E · layout: no sideways scroll, the long title wraps in its own column');
    const measure = async (w, plantOld) => {
      await pg.setViewportSize({ width: w, height: 860 });
      return pg.evaluate((plantOld) => {
        _wbPickClear();
        if (plantOld) document.querySelectorAll('#wb-pick-list .wb-pick-num').forEach(b => { b.setAttribute('style', 'white-space:nowrap'); });
        const list = document.getElementById('wb-pick-list');
        const longRow = [...list.querySelectorAll('[onclick^="_wbPicked("]')].find(el => /Add Up Your 1966/.test(el.textContent));
        const card = document.querySelector('#wb-card > div');
        const span = longRow && longRow.querySelector(':scope > span');
        const grid = document.getElementById('wb-pick-filters').getBoundingClientRect();
        return { sw: list.scrollWidth, cw: list.clientWidth, rowH: longRow ? longRow.getBoundingClientRect().height : -1,
          spanShare: span ? span.getBoundingClientRect().width / longRow.getBoundingClientRect().width : 0,
          cardRight: card.getBoundingClientRect().right, vw: window.innerWidth, gridRight: grid.right };
      }, !!plantOld);
    };
    for (const w of [390, 1400]) {
      const m = await measure(w);
      ok('E1 ' + w + ' px: the list does not scroll sideways', m.sw <= m.cw + 1, m);
      ok('E2 ' + w + ' px: the "1966 Lionel Profits" row keeps a real description column (≥ 45% of the row) and stays short', m.spanShare >= 0.45 && m.rowH > 0 && m.rowH < 140, m);
      ok('E3 ' + w + ' px: the card and the four filters fit the window', m.cardRight <= m.vw + 0.5 && m.gridRight <= m.vw + 0.5, m);
    }
    const old = await measure(390, true);
    ok('E4 PLANTED: the old one-line number put back → the list scrolls sideways again (E1 would fail)', old.sw > old.cw + 1, old);
    await pg.setViewportSize({ width: 1400, height: 900 });

    section('F · picking under a filter opens THAT copy');
    const f1 = await pg.evaluate(() => {
      _wbAddTask();
      window.__set({ manufacturer: 'atlas', scale: 'o' });
      const el = document.querySelector('#wb-pick-list [onclick^="_wbPicked("]');
      el.click();
      return { calls: window.__wbOpenCalls.slice(), cardGone: !document.getElementById('wb-card') };
    });
    ok('F1 Atlas · O → the one line is the Atlas 3300 (inventory 112); picking it opens 112 for the task', JSON.stringify(f1.calls) === '[["112","3300","task"]]' && f1.cardGone, f1);

    section('G · no page errors');
    ok('G1 no page errors', errs.length === 0, errs);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
