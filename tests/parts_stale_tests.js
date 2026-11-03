#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// parts_stale_tests.js — 2026-11-02 (maintenance chat; real Chromium, the REAL
// app, a stand-in Parts Needed tab that records every write)
//
// [stated] Brad: a screenshot of No. 84631's Maintenance card — a traction
// tire and three SMOKE FUNNELs, and the red "Your Parts list changed somewhere
// else — nothing was written. Refresh and try again." → "i removed them" →
// "same screen" → "yes" (build the fix).
//
// WHY it happened: the device copy of the lists (_cachePersonalData — what the
// app opens with) was never saved after a part changed, so the next open put
// the removed funnels back on the card; the background read that later found
// them gone never redrew an open card; and a read that started before a change
// could land after it and put the old list back.
//
//   A  Brad's case: remove the three funnels on the card → the card, the sheet
//      and the DEVICE COPY lose them; reopen the app (sheet not answering yet)
//      → they stay gone.
//   B  a card drawn from an old copy corrects itself when the background read
//      (the REAL _loadPersonalFromSheets) lands; the device copy follows.
//   C  a refused part write (Ordered it / Bought it / Remove on a part that is
//      no longer on the sheet) writes NOTHING, re-reads the list, redraws the
//      card without it, and says the list is up to date — no "Refresh".
//   D  a read that started BEFORE a change and lands after it does not put the
//      old list back (a part marked Ordered stays ordered; one added arrives).
//   E  the redraw never eats typing: a box being typed in waits until left.
//   F  every part change saves the device copy (Ordered, Bought, Move to a
//      task) — none of them leaves the next open showing an old state.
//   S  the source: the ONLY guarded writes to the Parts Needed tab are THE row
//      writer (rrPartsRowWrite) and removePart; the ONLY places that replace
//      the list are THE taker (rrPartsTake) and the open-time restore.
//   P  PLANTED, the fix taken back out piece by piece: Remove's device-copy
//      save → A red; the re-read on a refusal → C red; the change count → D
//      red; the redraw → B red; the typing wait → E red; the row writer's save
//      → F red; a rogue writer → S red.
//
// Run:  node tests/parts_stale_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  parts_stale_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { fnSrc } = require('./lib/main-photo');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── S · the source ──────────────────────────────────────────────────────────
// a guarded write to the Parts Needed tab, or a replacement of the list, outside its owner
function strays(files) {
  const out = [];
  Object.keys(files).forEach(f => {
    const src = files[f];
    const re = /(rrVerifiedRowUpdate|rrRemoveRowConfirmed|sheetsUpdate|sheetsUpdateRow)\s*\(\s*[^,]+,\s*(['"])Parts Needed\2|(rrVerifiedRowUpdate|sheetsUpdate)\s*\([^)]*['"]Parts Needed![A-Z]+['"]\s*\+\s*(?!.*I2:M2)|state\.partsData\s*=(?!=)/g;
    let m;
    while ((m = re.exec(src))) {
      const at = m.index;
      // which function holds it
      const head = src.slice(0, at);
      const fnm = (head.match(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{(?![\s\S]*\n(?:async )?function )/) || [])[1] || '';
      const lineTxt = src.slice(src.lastIndexOf('\n', at) + 1, src.indexOf('\n', at));
      if (/^\s*(\/\/|\*)/.test(lineTxt)) continue;   // a comment that tells the story
      const ok = (f === 'app-pages.js' && /^(rrPartsRowWrite|removePart|rrPartsTake|buildPartsPage)$/.test(fnm) && (fnm !== 'buildPartsPage' || /state\.partsData \|\| \{\}/.test(lineTxt)))
        || (f === 'app-data.js' && (/_pd\.partsData/.test(lineTxt) || /window\._parsePartsRows\(partsRes2\.values\)/.test(lineTxt)))
        || (f === 'reports.js' && /rrPartsTake/.test(lineTxt));
      if (!ok) out.push(f + ' · ' + (fnm || '?') + ' · ' + lineTxt.trim().slice(0, 140));
    }
  });
  return out;
}
console.log('\n== S · one writer, one taker ==');
const SRC = {};
fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { SRC[f] = read(f); });
const s1 = strays(SRC);
T('S1 the only guarded Parts Needed writes are rrPartsRowWrite + removePart; the only list replacements are rrPartsTake + the open-time restore', s1.length === 0, s1);
const rogue = Object.assign({}, SRC, { 'maintenance.js': SRC['maintenance.js'] + "\nasync function _rogue(p){ await rrVerifiedRowUpdate(state.personalSheetId, 'Parts Needed', p.row, 'Parts Needed!I' + p.row, [['x']], { num: p.id }, 'Parts list'); state.partsData = {}; }\n" });
T('S2 PLANTED: a rogue part writer + a rogue list replacement → caught by S1', strays(rogue).length === 2, strays(rogue));
const PAGES = SRC['app-pages.js'];
T('S3 the wording lives once (PARTS_COPY.staleFixed) and says nothing about refreshing', /staleFixed: '[^']*up to date now\.'/.test(PAGES) && !/staleFixed: '[^']*[Rr]efresh/.test(PAGES));
T('S4 the background read hands its rows to THE taker with the change count taken before it started', /const _partsGen0 = \(typeof rrPartsGen === 'function'\) \? rrPartsGen\(\) : null;\n  \/\/ Secondary tabs fire off/.test(SRC['app-data.js']) && /window\.rrPartsTake\(partsRes2\.values, \{ gen: _partsGen0, save: false \}\)/.test(SRC['app-data.js']));

// ── the world ───────────────────────────────────────────────────────────────
const PD = {
  '136': { itemNum: '84631', variation: '', owned: true, inventoryId: '136', row: 3, manufacturer: 'Lionel' },
  '140': { itemNum: '2343', variation: '', owned: true, inventoryId: '140', row: 4, manufacturer: 'Lionel' },
};
// Brad's Parts Needed tab as the screenshot showed it (row 3 = the first data row)
const part = (id, desc, inv, status, task) => [id, desc, '', inv === '136' ? '84631' : '2343', inv, '', '', '2026-11-01', status || '', status === 'bought' ? '2026-11-01' : '', '', '', task || ''];
const SHEET = {
  5: part('part-tire', 'TRACTION TIRE', '136', 'bought'),
  6: part('part-fun1', 'SMOKE FUNNEL', '136', 'bought'),
  7: part('part-fun2', 'SMOKE FUNNEL', '136', 'ordered'),
  8: part('part-fun3', 'SMOKE FUNNEL', '136', 'ordered'),
  9: part('part-brush', 'BRUSH', '140', ''),
};

async function open(browser, swap) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!/^(file|data|blob|about):/.test(u)) return r.abort();
    for (const f of Object.keys(swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  const boot = async (fresh) => {
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(700);
    await pg.evaluate(({ pd, sheet, fresh }) => {
      if (fresh) { try { localStorage.clear(); } catch (e) {} }
      state.user = { name: 'Brad', email: 'brad@example.test' };
      window.rrFeatureOn = function () { return true; };   // the Maintenance card is on for this user
      state.personalData = JSON.parse(JSON.stringify(pd));
      state.personalSheetId = 'SHEET';
      try { localStorage.setItem('lv_personal_id', 'SHEET'); } catch (e) {}
      // the app's own cache version mark (set by every normal load) — without it the copy is dropped as "old shape"
      try { localStorage.setItem(rrPersonalCacheKey('ver'), (typeof PERSONAL_CACHE_VER !== 'undefined' ? PERSONAL_CACHE_VER : 'wu1')); } catch (e) {}
      state.maintLog = [];   // the card draws its parts once the service history is in hand
      try { if (typeof rrMarkDataSheet === 'function') rrMarkDataSheet('SHEET'); } catch (e) {}
      window.accessToken = 'tok'; try { accessToken = 'tok'; } catch (e) {}
      window.__toasts = []; window.showToast = function (m) { window.__toasts.push(String(m)); };
      window.appConfirm = async function () { return true; };
      // ── the stand-in Parts Needed tab: { row: [13 cells] } ──
      if (fresh || !window.__sheet) window.__sheet = JSON.parse(JSON.stringify(sheet));
      window.__writes = []; window.__appends = [];
      window.__hold = null;          // a promise the Parts Needed list read waits on (D)
      window.__readsHang = false;    // the sheet does not answer (A4 — the app reopened, no answer yet)
      const L = c => { let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
      const parse = (range) => {
        const m = /^(.+)!([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/.exec(range);
        if (!m) return null;
        return { tab: m[1], c0: L(m[2]), r0: +m[3], c1: m[4] ? L(m[4]) : L(m[2]), r1: m[5] ? +m[5] : (m[4] ? 2000 : +m[3]) };
      };
      window.sheetsGet = async function (id, range) {
        if (window.__readsHang) return new Promise(() => {});
        const q = parse(range);
        if (!q || q.tab !== 'Parts Needed') return { values: [], range: range };
        const snap = JSON.parse(JSON.stringify(window.__sheet));   // what the sheet holds as the read STARTS
        if (window.__hold && q.r0 === 3 && q.c0 === 0) await window.__hold;
        const rows = [];
        const last = Math.min(q.r1, Math.max(2, ...Object.keys(snap).map(Number)));
        for (let r = q.r0; r <= last; r++) { const cells = snap[r] || []; rows.push(cells.slice(q.c0, q.c1 + 1).map(c => c == null ? '' : c)); }
        return { values: rows, range: range };
      };
      window.sheetsUpdate = async function (id, range, values) {
        const q = parse(range); window.__writes.push(range + ' ' + JSON.stringify(values));
        if (!q || q.tab !== 'Parts Needed') return {};
        const row = window.__sheet[q.r0] = (window.__sheet[q.r0] || new Array(13).fill(''));
        values[0].forEach((v, i) => { row[q.c0 + i] = String(v || '').replace(/^'/, ''); });
        if (row.every(c => c === '')) delete window.__sheet[q.r0];
        return {};
      };
      window.sheetsAppend = async function (id, range, rows) {
        window.__appends.push(range);
        if (/^Parts Needed/.test(range)) { const n = Math.max(2, ...Object.keys(window.__sheet).map(Number)) + 1; window.__sheet[n] = rows[0].map(c => String(c || '').replace(/^'/, '')); }
        return {};
      };
      window._ensurePartsTab = async function () { return true; };
      window._ensurePartsLifecycleCols = async function () { return true; };
      window.rrArchiveRowBeforeRemoval = async function () { return true; };   // the Deleted Rows copy is not what this file tests
      document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
      window.__card = () => { const el = document.getElementById('maint-parts'); return el ? el.innerText : null; };
      window.__copy = () => { try { const s = JSON.parse(localStorage.getItem(rrPersonalCacheKey('')) || 'null'); return s && s.partsData ? Object.values(s.partsData).map(p => p.id + ':' + p.status) : null; } catch (e) { return 'ERR ' + e.message; } };
      window.__mem = () => Object.values(state.partsData || {}).map(p => p.id + ':' + p.status);
      window.__openCard = async () => {
        window._wbOpen('136', '84631');
        for (let i = 0; i < 60 && !(document.getElementById('maint-parts') && /TIRE/.test(document.getElementById('maint-parts').innerText)); i++) await new Promise(r => setTimeout(r, 50));
        await new Promise(r => setTimeout(r, 100));
      };
      window.__wait = ms => new Promise(r => setTimeout(r, ms));
    }, { pd: PD, sheet: SHEET, fresh: !!fresh });
  };
  await boot(true);
  return { pg, ctx, errs, boot };
}
const funnels = s => (String(s || '').match(/SMOKE FUNNEL/g) || []).length;
const has = (arr, id) => (arr || []).some(x => String(x).indexOf(id + ':') === 0);

// ── A · Brad's case ─────────────────────────────────────────────────────────
async function caseA(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    _cachePersonalData();   // the app's normal load saved its copy (app-data.js does, after every load)
    await __openCard();
    const out = { before: __card() };
    for (const id of ['part-fun1', 'part-fun2', 'part-fun3']) { await window._maintPartRemove(id); await __wait(30); }
    out.after = __card(); out.mem = __mem(); out.copy = __copy();
    out.sheetRows = Object.keys(window.__sheet).map(k => k + ':' + window.__sheet[k][1]);
    return out;
  });
  // the app reopens on this device; the sheet has not answered yet
  await w.boot(false);
  r.reopen = await w.pg.evaluate(async () => {
    window.__readsHang = true;
    state.partsData = {};
    try { loadPersonalData(); } catch (e) { return 'ERR ' + e.message; }
    await __wait(300);
    return __mem();
  });
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

// ── B · a card drawn from an old copy corrects itself ───────────────────────
async function caseB(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    // the funnels are already gone from the sheet (taken off earlier); this screen still has them
    [6, 7, 8].forEach(n => { delete window.__sheet[n]; });
    await __openCard();
    const out = { before: __card() };
    try { await _loadPersonalFromSheets('SHEET'); } catch (e) { out.err = e.message; }
    for (let i = 0; i < 40 && /FUNNEL/.test(__card() || ''); i++) await __wait(50);
    await __wait(100);
    out.after = __card(); out.copy = __copy();
    return out;
  });
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

// ── C · a refused write re-reads and redraws ────────────────────────────────
async function caseC(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    await __openCard();
    // taken off on the sheet (another tab, or before this screen's copy was made) — the card still offers them
    delete window.__sheet[7]; delete window.__sheet[8]; delete window.__sheet[6];
    const out = {};
    await window.__restoreGhosts(); window.__writes.length = 0;
    await window._maintPartOrdered('part-fun3'); await __wait(50);
    out.ordered = { writes: window.__writes.slice(), toast: window.__toasts.slice(-1)[0], card: __card(), mem: __mem() };
    // a second stale screen: the funnels back in memory, then Bought it and Remove
    await window.__restoreGhosts(); window.__writes.length = 0;
    await window._maintPartBought('part-fun2'); await __wait(50);
    out.bought = { writes: window.__writes.slice(), toast: window.__toasts.slice(-1)[0], card: __card() };
    await window.__restoreGhosts(); window.__writes.length = 0;
    await window._maintPartRemove('part-fun1'); await __wait(50);
    out.removed = { writes: window.__writes.slice(), toast: window.__toasts.slice(-1)[0], card: __card(), copy: __copy() };
    return out;
  }).catch(e => ({ err: e.message }));
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

// ── D · an older read never puts the old list back ──────────────────────────
async function caseD(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    let release; window.__hold = new Promise(res => { release = res; });
    const reading = buildPartsPage();             // the read starts: the funnel is still on the sheet
    await __wait(30);
    await markPartOrdered('part-brush');          // marked ordered while the read is out (no read of its own follows)
    await _partsAppendRow({ id: 'part-new', description: 'E-UNIT', forItem: '84631', forInv: '136' });   // and one added
    window.__hold = null; release();
    await reading; await __wait(50);
    const out = { mem: __mem(), copy: __copy() };
    await buildPartsPage(); await __wait(50);   // the next read
    out.next = __mem();
    return out;
  });
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

// ── E · the redraw never eats typing ────────────────────────────────────────
async function caseE(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    await __openCard();
    const tasks = document.getElementById('maint-tasks');
    const box = document.createElement('textarea'); box.id = '__typing'; tasks.appendChild(box);
    box.focus(); box.value = 'cleaned the reverse unit';
    delete window.__sheet[6];
    const gen = rrPartsGen(); const res = await sheetsGet('SHEET', 'Parts Needed!A3:M');
    rrPartsTake(res.values, { gen: gen });
    await __wait(50);
    const out = { whileTyping: { box: !!document.getElementById('__typing'), value: (document.getElementById('__typing') || {}).value, funnels: (__card().match(/SMOKE FUNNEL/g) || []).length } };
    box.blur(); await __wait(80);
    out.afterLeaving = { box: !!document.getElementById('__typing'), funnels: (__card().match(/SMOKE FUNNEL/g) || []).length };
    // a drop-down (Move…) does not hold the card back
    const sel = document.createElement('select'); sel.id = '__sel'; tasks.appendChild(sel); sel.focus();
    delete window.__sheet[7];
    const g2 = rrPartsGen(); const r2 = await sheetsGet('SHEET', 'Parts Needed!A3:M'); rrPartsTake(r2.values, { gen: g2 }); await __wait(50);
    out.dropDown = (__card().match(/SMOKE FUNNEL/g) || []).length;
    return out;
  });
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

// ── F · every part change saves the device copy ─────────────────────────────
async function caseF(browser, swap) {
  const w = await open(browser, swap);
  const r = await w.pg.evaluate(async () => {
    await buildPartsPage(); await __wait(50);
    // make the device copy deliberately old, then each change must refresh it
    const stale = () => { try { localStorage.removeItem(rrPersonalCacheKey('')); } catch (e) {} };
    const out = {};
    stale(); await markPartOrdered('part-brush'); out.ordered = __copy();
    stale(); await markPartBought('part-brush'); out.bought = __copy();
    stale(); await window._maintPartSetTask('part-brush', 'task-9'); out.task = __copy();
    out.taskMem = (_partsFind('part-brush') || {}).taskId;
    return out;
  });
  r.errs = w.errs.slice(); await w.ctx.close();
  return r;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    // the "ghosts" helper C uses: the screen's old copy of the three funnels
    const ghosts = `window.__restoreGhosts = async function () { ${JSON.stringify([[6, 'part-fun1', 'bought'], [7, 'part-fun2', 'ordered'], [8, 'part-fun3', '']])}.forEach(function (g) { state.partsData['p' + g[0]] = { row: g[0], id: g[1], description: 'SMOKE FUNNEL', partNum: '', forItem: '84631', forInv: '136', photo: '', notes: '', dateAdded: '2026-11-01', status: g[2], dateBought: '', dateInstalled: '', pricePaid: '', taskId: '' }; }); if (typeof window._maintPartsRedraw === 'function') window._maintPartsRedraw(); else { try { _maintRenderTasks(); } catch (e) {} } await new Promise(function (r) { setTimeout(r, 30); }); };`;
    const withGhosts = (swap) => Object.assign({}, swap || {}, { 'wizard-utils.js': read('wizard-utils.js') + '\n' + ghosts + '\n' });

    console.log('\n== A · Brad\'s case: remove the three funnels on the card ==');
    const a = await caseA(browser);
    T('A0 the card showed the tire and three SMOKE FUNNELs', funnels(a.before) === 3 && /TRACTION TIRE/.test(a.before), a.before);
    T('A1 after Remove ×3 the card shows only the tire', funnels(a.after) === 0 && /TRACTION TIRE/.test(a.after), a.after);
    T('A2 the sheet rows are blank — the tire and the brush remain', a.sheetRows.join('|') === '5:TRACTION TIRE|9:BRUSH', a.sheetRows);
    T('A3 the DEVICE COPY (what the app opens with) has no funnels', Array.isArray(a.copy) && !has(a.copy, 'part-fun1') && !has(a.copy, 'part-fun2') && !has(a.copy, 'part-fun3') && has(a.copy, 'part-tire'), a.copy);
    T('A4 the app reopens before the sheet answers → the funnels stay gone', Array.isArray(a.reopen) && !a.reopen.some(x => /part-fun/.test(x)) && a.reopen.some(x => /part-tire/.test(x)), a.reopen);
    T('A5 no page errors', a.errs.length === 0, a.errs);

    console.log('\n== B · a card drawn from an old copy corrects itself ==');
    const b = await caseB(browser);
    T('B0 the card opened with the funnels (an old copy)', funnels(b.before) === 3, b.before);
    T('B1 the background read (the real _loadPersonalFromSheets) lands → the open card drops them', funnels(b.after) === 0 && /TRACTION TIRE/.test(b.after || ''), { after: b.after, err: b.err });
    T('B2 and the device copy follows', Array.isArray(b.copy) && !b.copy.some(x => /part-fun/.test(x)), b.copy);
    T('B3 no page errors', b.errs.length === 0, b.errs);

    console.log('\n== C · a refused part write re-reads and redraws ==');
    const c = await caseC(browser, withGhosts());
    const STALE = 'That part had already changed on your sheet — nothing was written. Your Parts list is up to date now.';
    T('C1 Ordered it on a part no longer on the sheet writes NOTHING', c.ordered && c.ordered.writes.length === 0, c.ordered || c);
    T('C2 … and says the list is up to date (no "Refresh and try again")', c.ordered && c.ordered.toast === STALE, c.ordered && c.ordered.toast);
    T('C3 … and the card no longer shows the funnels; the tire stays', c.ordered && funnels(c.ordered.card) === 0 && /TRACTION TIRE/.test(c.ordered.card), c.ordered && c.ordered.card);
    T('C4 Bought it on a stale part: nothing written, list re-read, card redrawn, same words', c.bought && c.bought.writes.length === 0 && c.bought.toast === STALE && funnels(c.bought.card) === 0, c.bought);
    T('C5 Remove on a stale part: nothing written, card redrawn, device copy current', c.removed && c.removed.writes.length === 0 && c.removed.toast === STALE && funnels(c.removed.card) === 0 && Array.isArray(c.removed.copy) && !c.removed.copy.some(x => /part-fun/.test(x)), c.removed);
    T('C6 no page errors', (c.errs || []).length === 0, c.errs);

    console.log('\n== D · an older read never puts the old list back ==');
    const d = await caseD(browser);
    T('D1 a part marked Ordered while an older read was out stays "ordered" (memory + device copy)', d.mem.indexOf('part-brush:ordered') >= 0 && Array.isArray(d.copy) && d.copy.indexOf('part-brush:ordered') >= 0, d);
    T('D2 the next read brings the part added meanwhile, and the brush is still "ordered"', has(d.next, 'part-new') && d.next.indexOf('part-brush:ordered') >= 0, d.next);

    console.log('\n== E · the redraw never eats typing ==');
    const e = await caseE(browser);
    T('E1 while typing in the card, the box and its words stay', e.whileTyping.box && e.whileTyping.value === 'cleaned the reverse unit', e.whileTyping);
    T('E2 leaving the box → the card redraws (the removed funnel gone)', e.afterLeaving.funnels === 2, e.afterLeaving);
    T('E3 a drop-down (Move…) does not hold the redraw back', e.dropDown === 1, e.dropDown);
    T('E4 no page errors', e.errs.length === 0, e.errs);

    console.log('\n== F · every part change saves the device copy ==');
    const f = await caseF(browser);
    T('F1 Ordered it → the device copy holds "ordered"', Array.isArray(f.ordered) && f.ordered.indexOf('part-brush:ordered') >= 0, f.ordered);
    T('F2 Bought it → the device copy holds "bought"', Array.isArray(f.bought) && f.bought.indexOf('part-brush:bought') >= 0, f.bought);
    T('F3 Move to a task → the device copy is saved, the part carries the task', Array.isArray(f.task) && f.taskMem === 'task-9', f);
    T('F4 no page errors', f.errs.length === 0, f.errs);

    // ── P · planted ─────────────────────────────────────────────────────────
    console.log('\n== P · planted: each check can fail ==');
    // the fix taken back out, piece by piece (the code as it was before 2026-11-02)
    // (Remove saves the copy itself AND its follow-up read saves it — both out, as before the fix)
    const noSave = PAGES.replace("  _partsSaved();   // 2026-11-02: and the device copy forgets it too", "  if (typeof _updatePartsBadge === 'function') _updatePartsBadge();   // (planted: the old line)")
      .replace("  if (o.save !== false) { try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {} }", "");
    const pa = await caseA(browser, { 'app-pages.js': noSave });
    T('P1 the device-copy saves taken out (Remove + the read after it) → A3/A4 red: the funnels come back on reopen', noSave !== PAGES && has(pa.copy, 'part-fun1') && Array.isArray(pa.reopen) && pa.reopen.some(x => /part-fun/.test(x)), { copy: pa.copy, reopen: pa.reopen });
    const noRecheck = PAGES.replace("    await _partsRecheck(p.id, !!opts.quiet);\n    return false;", "    return false;");
    const pc = await caseC(browser, withGhosts({ 'app-pages.js': noRecheck }));
    T('P2 the re-read taken out of a refused write → C red: "Refresh and try again", the funnels stay on the card', noRecheck !== PAGES && pc.ordered && pc.ordered.toast !== STALE && funnels(pc.ordered.card) > 0, pc.ordered || pc);
    const noSaved = PAGES.replace("  if (typeof apply === 'function') apply();\n  _partsSaved();", "  if (typeof apply === 'function') apply();");
    const pf = await caseF(browser, { 'app-pages.js': noSaved });
    T('P6 the device-copy save taken out of THE row writer → F red', noSaved !== PAGES && !(Array.isArray(pf.ordered) && pf.ordered.indexOf('part-brush:ordered') >= 0), pf.ordered);
    const noGen = PAGES.replace("  if (o.gen !== undefined && o.gen !== null && rrPartsGen() !== o.gen) {", "  if (false) {");
    const pd = await caseD(browser, { 'app-pages.js': noGen });
    T('P3 the change count taken out → D red: the older read turns the brush back to "need part"', noGen !== PAGES && pd.mem.indexOf('part-brush:wanted') >= 0, pd.mem);
    const noRedraw = PAGES.replace("  if (changed && o.redraw !== false) _partsRedrawOpen();", "");
    const pb = await caseB(browser, { 'app-pages.js': noRedraw });
    T('P4 the redraw taken out → B red: the open card keeps the funnels', noRedraw !== PAGES && funnels(pb.after) > 0, pb.after);
    const noWait = SRC['maintenance.js'].replace("if (tasksEl && typing && tasksEl.contains(ae)) {", "if (false) {");
    const pe = await caseE(browser, { 'maintenance.js': noWait });
    T('P5 the typing wait taken out → E red: the box is wiped mid-sentence', noWait !== SRC['maintenance.js'] && !pe.whileTyping.box, pe.whileTyping);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  parts_stale_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  parts_stale_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
