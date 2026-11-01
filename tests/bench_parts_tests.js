#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// bench_parts_tests.js — 2026-10-31 (maintenance chat)
//
// [stated] Brad, on his Workbench screenshot (brainstorm → "your thoughts" →
// "yes"): "need to add the thumbnail picture to the right of the item #, item
// description needs a header, Needs is fine, Part #, Part status, Part
// Description, Date entered. Part status should say: Part on hand, part
// ordered, need part based on the status."
//
//   A  ONE word list: RR_PART_STATUS + rrPartStatus / rrPartWord /
//      rrPartStillNeeded (config.js). No app file compares a part's status
//      with 'wanted' itself, and the old words ("Parts on hand", "Waiting on
//      “…”") are gone from the code. Planted: each comes back → caught.
//   B  THE BENCH (real app, real Chromium): the seven headings in Brad's order;
//      one line per part (a three-part job takes three lines, its item / job /
//      date drawn once); Part # · Part Status · Part Description per line; the
//      thumbnail box beside the number; the description = My Collection's
//      (rrCollDescText) for the same row; an ORDERED part keeps its job under
//      "Waiting on parts"; on a phone each job is a card, no sideways scroll.
//   C  "Ordered it" (Parts Needed page + Maintenance card): writes ONLY the
//      Status cell of THAT part's row, verified by its id; a double tap writes
//      once; a part already bought is never pushed back; an ordered part stays
//      on the Parts Needed list and in its count, with "Bought it" still there.
//   D  the move left My Collection alone: rrCollDescText / rrFillRowThumbs are
//      what the list calls (planted: a list with its own copy → caught).
//
// Run:  node tests/bench_parts_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  bench_parts_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 700) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
// code only: comments blanked (strings kept)
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .split('\n').map(l => /^\s*\/\//.test(l) ? '' : l.replace(/\s{2,}\/\/ .*$/, '')).join('\n');
}

// ── A · one word list ────────────────────────────────────────────────────────
section('A · ONE list of part states and words');
const CFG = rd('config.js');
const APPJS = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'config.js');
// a status compared with 'wanted' directly ("is it still needed?" must ask rrPartStillNeeded)
const WANTED_CMP = /(status|\bst)\b[^;\n]{0,30}[!=]==\s*'wanted'|'wanted'\s*[!=]==\s*[^;\n]{0,30}status/;
const OLD_WORDS = /'Parts on hand|>Parts on hand<|Waiting on “|'Waiting on ' \+|>Waiting on</;
function offenders(files) {
  const out = [];
  Object.keys(files).forEach(f => code(files[f]).split('\n').forEach((l, i) => {
    if (WANTED_CMP.test(l)) out.push(f + ':' + (i + 1) + ' compares with wanted');
    if (OLD_WORDS.test(l)) out.push(f + ':' + (i + 1) + ' old words');
  }));
  return out;
}
const FILES = {}; APPJS.forEach(f => { FILES[f] = rd(f); });
ok('A1 config.js has the one list: Need part / Part ordered / Part on hand / Installed',
  /words: \{ wanted: 'Need part', ordered: 'Part ordered', bought: 'Part on hand', installed: 'Installed' \}/.test(CFG)
  && /function rrPartStatus\(p\)/.test(CFG) && /function rrPartWord\(p\)/.test(CFG) && /function rrPartStillNeeded\(p\)/.test(CFG));
const offs = offenders(FILES);
ok('A2 no app file compares a part status with \'wanted\' itself, and the old words are gone (' + APPJS.length + ' files)', offs.length === 0, offs);
const pl1 = Object.assign({}, FILES, { 'maintenance.js': FILES['maintenance.js'].replace('var waiting = function (parts) { return parts.some(rrPartStillNeeded); };', "var waiting = function (parts) { return parts.some(function (p) { return (p.status || 'wanted') === 'wanted'; }); };") });
ok('A3 PLANTED: the Bench\'s old "waiting = still wanted" test put back → caught by A2', pl1['maintenance.js'] !== FILES['maintenance.js'] && offenders(pl1).length === 1, offenders(pl1));
const pl2 = Object.assign({}, FILES, { 'app-pages.js': FILES['app-pages.js'] + "\nvar x = '<b>Parts on hand</b>';\n" });
ok('A4 PLANTED: a screen typing "Parts on hand" itself → caught by A2', offenders(pl2).some(o => /old words/.test(o)), offenders(pl2));
// the rule run in node, exactly as written in config.js
const sb = {}; new Function('window', CFG.slice(CFG.indexOf('const RR_PART_STATUS'), CFG.indexOf("if (typeof window !== 'undefined') { window.RR_PART_STATUS")) + '\nwindow.f = { rrPartStatus, rrPartWord, rrPartStillNeeded };')(sb);
const F = sb.f;
ok('A5 blank / unknown status reads as Need part (as the reader always treated it); a capital letter is the same state',
  F.rrPartStatus({}) === 'wanted' && F.rrPartStatus({ status: 'gone' }) === 'wanted' && F.rrPartStatus({ status: 'Ordered' }) === 'ordered' && F.rrPartWord({ status: 'bought' }) === 'Part on hand');
ok('A6 still needed = wanted or ordered, never bought or installed',
  F.rrPartStillNeeded({ status: 'wanted' }) && F.rrPartStillNeeded({ status: 'ordered' }) && !F.rrPartStillNeeded({ status: 'bought' }) && !F.rrPartStillNeeded({ status: 'installed' }));

// ── D · My Collection asks the shared description / photo code ───────────────
section('D · My Collection asks the same description and photo code');
const BROWSE = rd('browse.js');
const core = (() => { const i = BROWSE.indexOf('function _rrBrowseCore(_co) {'); let d = 0; for (let k = BROWSE.indexOf('{', i); k < BROWSE.length; k++) { if (BROWSE[k] === '{') d++; else if (BROWSE[k] === '}') { d--; if (!d) return BROWSE.slice(i, k + 1); } } return ''; })();
const listCopies = src => (src.match(/item\._personalOnly && item\.description\) \? item\.description/g) || []).length + (src.match(/img\.onload = function \(\) \{ img\.style\.opacity = 1; \};/g) || []).length;
ok('D1 the list calls rrCollDescText and rrFillRowThumbs, and keeps no copy of either', /const _descFull  = rrCollDescText\(item\);/.test(core) && /rrFillRowThumbs\(_collThumbJobs\);/.test(core) && listCopies(core) === 0);
ok('D2 PLANTED: the description rule pasted back into the list → caught', listCopies(core + "\nvar d = (item._personalOnly && item.description) ? item.description : '';") === 1);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(800);
    const setup = () => {
      const md = [
        { itemNum: '84631', variation: '', itemType: 'Diesel', _era: 'mpc', _tab: 'Lionel MPC - Items', yearProd: '2017', roadName: 'Union Pacific', description: 'SD40-2 Legacy', rowId: 'R1', gauge: 'O' },
        { itemNum: '2338', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1955', roadName: 'Milwaukee Road', description: 'GP-7', rowId: 'R2', gauge: 'O' },
        { itemNum: '2356', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1951', roadName: 'Southern', description: 'F-3 A unit', rowId: 'R3', gauge: 'O' },
        { itemNum: '8359', variation: '', itemType: 'Diesel', _era: 'mpc', _tab: 'Lionel MPC - Items', yearProd: '1973', roadName: 'Chessie System', description: 'GM 50th Anniversary GP-7', rowId: 'R4', gauge: 'O' },
      ];
      state.masterData = md; _rebuildMasterIndex();
      const P = (inv, n, x) => Object.assign({ owned: true, itemNum: n, variation: '', era: 'pw', manufacturer: 'Lionel', inventoryId: inv, row: Number(inv) }, x || {});
      state.personalData = { a: P('136', '84631', { era: 'mpc' }), b: P('190', '2338'), c: P('140', '2356'), d: P('150', '8359', { era: 'mpc' }) };
      state.maintLog = [
        { id: 't1', invId: '136', itemNum: '84631', type: 'chore', text: 'Replace traction tire', status: 'open', dateAdded: '2026-09-12' },
        { id: 't2', invId: '190', itemNum: '2338', type: 'chore', text: 'Fix railing', status: 'open', dateAdded: '2026-09-16' },
        { id: 't3', invId: '190', itemNum: '2338', type: 'chore', text: 'E-unit service', status: 'open', dateAdded: '2026-10-01' },
        { id: 't4', invId: '140', itemNum: '2356', type: 'chore', text: 'replace port holes', status: 'open', dateAdded: '2026-09-16' },
        { id: 't5', invId: '150', itemNum: '8359', type: 'chore', text: 'Change battery cover', status: 'open', dateAdded: '2026-09-16' },
      ];
      state.partsData = {
        p1: { id: 'part-1', row: 3, taskId: 't1', forInv: '136', forItem: '84631', partNum: '600-8632-050', description: 'TRACTION TIRE', status: 'bought' },
        p2: { id: 'part-2', row: 4, taskId: 't1', forInv: '136', forItem: '84631', partNum: '', description: 'SMOKE FUNNEL', status: 'ordered' },
        p3: { id: 'part-3', row: 5, taskId: 't1', forInv: '136', forItem: '84631', partNum: '', description: 'SMOKE UNIT', status: 'wanted' },
        p4: { id: 'part-4', row: 6, taskId: 't2', forInv: '190', forItem: '2338', partNum: 'GP7-HR', description: 'Left and Right Handrail Set (GP-7)', status: 'ordered' },
        p5: { id: 'part-5', row: 7, taskId: 't3', forInv: '190', forItem: '2338', partNum: '259E-1', description: 'Light Blue E-Unit Drum', status: 'bought' },
      };
      state.user = Object.assign({}, state.user || {}, { email: (window.RR_OWNER_EMAILS || [])[0] || 'bhale@ipd-llc.com' });
      var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
      document.getElementById('app').classList.add('active');
      // the page the app makes for an owner (maintenance.js _wbInjectUI); shown by hand so
      // no sheet read replaces the made-up tasks
      if (!document.getElementById('page-workbench')) { const pgEl = document.createElement('div'); pgEl.className = 'page'; pgEl.id = 'page-workbench'; document.getElementById('main-content').appendChild(pgEl); }
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-workbench').classList.add('active');
      try { _prefSet('maint_wb_filter', 'all'); } catch (e) {}
      window._wbBuild();
    };
    await pg.evaluate(setup);
    await pg.waitForTimeout(300);
    const read = () => {
      const t = document.getElementById('wb-bench');
      if (!t) return { noTable: true, cards: document.querySelectorAll('#page-workbench .wb-job').length };
      const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent);
      const jobs = [...t.querySelectorAll('tbody.wb-job')].map(tb => {
        const trs = [...tb.querySelectorAll('tr')];
        const first = trs[0].querySelectorAll('td');
        return {
          num: first[0].querySelector('b').textContent, thumb: !!first[0].querySelector('.rr-row-thumb'),
          desc: first[1].textContent, need: first[2].textContent, date: trs[0].lastElementChild.textContent,
          lines: trs.map(tr => { const c = [...tr.querySelectorAll('td')]; const k = c.length === 7 ? 3 : 0; return [c[k].textContent, c[k + 1].textContent, c[k + 2].textContent]; }),
          open: tb.getAttribute('onclick'),
        };
      });
      const chips = [...document.querySelectorAll('#page-workbench .eph-tab')].map(b => b.textContent);
      return { heads, jobs, chips, descWant: rrCollDescText(_rebuildMasterIndex && state.masterData[0]) };
    };
    const b = await pg.evaluate(read);

    section('B · the Bench, on a computer');
    ok('B1 the seven headings, in Brad\'s order', JSON.stringify(b.heads) === JSON.stringify(['Item #', 'Item Description', 'Needs', 'Part #', 'Part Status', 'Part Description', 'Date Entered']), b.heads || b);
    const j84 = (b.jobs || []).find(j => j.num === '84631');
    ok('B2 the three-part job takes three lines; item, job and date drawn once', j84 && j84.lines.length === 3 && j84.need === 'Replace traction tire', j84);
    ok('B3 each line: Part # · Part Status · Part Description, in the one word list',
      j84 && JSON.stringify(j84.lines) === JSON.stringify([['600-8632-050', '✓ Part on hand', 'TRACTION TIRE'], ['—', 'Part ordered', 'SMOKE FUNNEL'], ['—', 'Need part', 'SMOKE UNIT']]), j84 && j84.lines);
    ok('B4 the thumbnail box sits beside the item number (every owned job)', b.jobs.length === 5 && b.jobs.every(j => j.thumb), b.jobs.map(j => j.num + ':' + j.thumb));
    ok('B5 Item Description = My Collection\'s description for that row ("Union Pacific — SD40-2 Legacy")', j84 && j84.desc === 'Union Pacific — SD40-2 Legacy' && b.descWant === j84.desc, j84 && j84.desc);
    ok('B6 Date Entered is the job\'s date; a job with no part shows dashes', j84 && j84.date === '2026-09-12' && (b.jobs.find(j => j.num === '2356') || {}).lines[0].join('|') === '—|—|—', b.jobs.map(j => j.date));
    ok('B7 a click on a job opens THAT copy\'s card (by inventory number)', j84 && j84.open === "_wbOpen('136','84631')", j84 && j84.open);
    ok('B8 "Waiting on parts" counts the jobs with a part still needed — an ORDERED part counts (84631, 2338 railing) — "Ready to work" the rest',
      b.chips.some(c => /Waiting on parts · 2/.test(c)) && b.chips.some(c => /Ready to work · 3/.test(c)), b.chips);
    const w = await pg.evaluate(() => { _wbFilter('waiting'); const n = [...document.querySelectorAll('#wb-bench tbody.wb-job')].map(t => t.querySelector('b').textContent + ':' + t.querySelectorAll('tr').length); _wbFilter('all'); return n; });
    ok('B9 the Waiting filter shows those two jobs, every part line still there', JSON.stringify(w) === '["2338:1","84631:3"]', w);

    section('B · the Bench, on a phone');
    await pg.setViewportSize({ width: 390, height: 844 });
    const ph = await pg.evaluate(() => {
      window._wbBuild();
      const cards = [...document.querySelectorAll('#page-workbench .wb-job')];
      const c84 = cards.find(c => /84631/.test(c.textContent));
      return { table: !!document.getElementById('wb-bench'), cards: cards.length, parts: c84 ? [...c84.querySelectorAll('.wb-part')].map(p => p.textContent) : [],
        thumb: c84 ? !!c84.querySelector('.rr-row-thumb') : false, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    ok('B10 on a phone each job is a card (no seven-column table): five cards, the photo, one line per part', !ph.table && ph.cards === 5 && ph.thumb && ph.parts.length === 3 && /^✓ Part on hand #600-8632-050 — TRACTION TIRE$/.test(ph.parts[0]) && /^Part ordered — SMOKE FUNNEL$/.test(ph.parts[1]), ph);
    ok('B11 …and nothing runs off sideways', ph.sideways <= 1, ph.sideways);
    await pg.setViewportSize({ width: 1400, height: 900 });

    section('C · "Ordered it"');
    const c = await pg.evaluate(async () => {
      const writes = [];
      let release;
      const gate = new Promise(r => { release = r; });
      const real = window.rrVerifiedRowUpdate;
      window.rrVerifiedRowUpdate = async function (sheet, tab, row, range, vals, check) { writes.push({ tab, row, range, vals, check }); await gate; return true; };
      window._ensurePartsLifecycleCols = async () => {};
      const p = state.partsData.p3;   // SMOKE UNIT, wanted, row 5
      const one = markPartOrdered('part-3');
      const two = markPartOrdered('part-3');   // a second tap while the first is still saving
      release();
      const r1 = await one; await two;
      const afterFirst = { status: p.status, writes: writes.slice() };
      const boughtBefore = state.partsData.p1.status;
      const r3 = await markPartOrdered('part-1');   // already in hand
      window.rrVerifiedRowUpdate = real;
      return { r1, afterFirst, r3, p1: state.partsData.p1.status, boughtBefore, writesTotal: writes.length,
        open: _partsOpenList().map(x => x.id).sort() };
    });
    ok('C1 writes ONLY the Status cell of that part\'s row, checked by its id', c.afterFirst.writes.length === 1 && c.afterFirst.writes[0].range === 'Parts Needed!I5:I5' && JSON.stringify(c.afterFirst.writes[0].vals) === '[["ordered"]]' && c.afterFirst.writes[0].check.num === 'part-3', c.afterFirst.writes);
    ok('C2 a double tap writes once, and the part reads "ordered"', c.r1 === true && c.afterFirst.status === 'ordered' && c.writesTotal === 1, c);
    ok('C3 a part already in hand is never pushed back to ordered', c.r3 === false && c.p1 === 'bought', c);
    ok('C4 an ordered part stays on the Parts Needed list (and in its count)', c.open.includes('part-2') && c.open.includes('part-3') && c.open.includes('part-4'), c.open);
    const pp = await pg.evaluate(() => {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const pp0 = document.getElementById('page-parts'); if (pp0) pp0.classList.add('active');
      _renderPartsList();
      const rows = [...document.querySelectorAll('#parts-list > div, #parts-list .parts-row')];
      const html = document.getElementById('parts-list') ? document.getElementById('parts-list').innerHTML : '';
      const rowOf = word => { const all = [...document.querySelectorAll('#parts-list [onclick^="markPartBought"], #parts-list [onclick^="markPartOrdered"]')]; return all.length; };
      const pick = desc => { const el = [...document.querySelectorAll('#parts-list *')].filter(e => e.children.length === 0 && e.textContent.trim() === desc)[0]; let n = el; for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (n && n.querySelector('button')) break; } return n ? { text: n.textContent, ordered: !!n.querySelector('[onclick^="markPartOrdered"]'), bought: !!n.querySelector('[onclick^="markPartBought"]') } : null; };
      return { funnel: pick('SMOKE FUNNEL'), unit: pick('SMOKE UNIT'), tire: pick('TRACTION TIRE'), buttons: rowOf(), hasList: !!html };
    });
    ok('C5 Parts Needed page: an ordered part says PART ORDERED and keeps "Bought it" (no second "Ordered it")', pp.funnel && /Part ordered/i.test(pp.funnel.text) && pp.funnel.bought && !pp.funnel.ordered, pp.funnel);
    ok('C6 …a part in hand says PART ON HAND and shows neither "Ordered it" nor "Bought it"', pp.tire && !pp.tire.ordered && !pp.tire.bought && /Part on hand/i.test(pp.tire.text), pp.tire);
    const pp2 = await pg.evaluate(() => { state.partsData.p3.status = 'wanted'; _renderPartsList(); const el = [...document.querySelectorAll('#parts-list *')].filter(e => e.children.length === 0 && e.textContent.trim() === 'SMOKE UNIT')[0]; let n = el; for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (n && n.querySelector('button')) break; } return { text: n.textContent, ordered: !!n.querySelector('[onclick^="markPartOrdered"]'), bought: !!n.querySelector('[onclick^="markPartBought"]') }; });
    ok('C7 a part not yet ordered: NEED PART, with "Ordered it" and "Bought it"', /Need part/i.test(pp2.text) && pp2.ordered && pp2.bought, pp2);
    const card = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
    ok('C8 the Maintenance card\'s part line offers "Ordered it" (the page\'s ONE writer) while a part is still needed',
      /window\._maintPartOrdered = async function \(partId, btn\) \{\s*if \(typeof markPartOrdered !== 'function'\) return;\s*await markPartOrdered\(partId, btn\);/.test(card)
      && /rrPartStillNeeded\(p\) \? \(\(st === 'wanted' \? '<button onclick="_maintPartOrdered\(/.test(card));
    ok('G1 no page errors', errs.length === 0, errs);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
