#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// NOW IN THE CATALOG — catalognow, 2026-11-24   (real Chromium, the REAL app,
// a stand-in Sheets)
//
// PLAN_2026-11-24_HAND_TYPED_NOW_IN_CATALOG.md. Customer Bob's idea; [stated]
// Brad 11:30 CT "a collection button that checks their list for manual entries,
// see if its cataloged now, show each line item and what would update. then it
// would leave what they input in its notes" / 11:31 "once they okay it, it
// would then update their list".
//
// The world: nine copies.
//   h1  K6349, typed by hand, K-Line            -> ONE catalog row fits
//   h2  30-7001, by hand, MTH                   -> TWO variations fit (a pick)
//   h3  6464, by hand, Atlas                    -> Atlas's 6464, NEVER Lionel's
//   h4  6464, by hand, NO maker                 -> not checked; counted
//   h5  9999, by hand, Lionel, in a group       -> left out
//   h6  1000, by hand, Lionel                   -> only a Sets-tab row: left out
//   h7  7777, by hand, K-Line                   -> the catalog lacks it: silent
//   l1  K6349, a catalog entry already          -> not listed
//   h8  K6349-BOX, by hand, K-Line              -> a piece: left out
//
// A  the section, the scan, the screen (phone AND laptop): which lines, nothing
//    ticked, a pick line cannot be ticked before the pick, nothing written
// B  the update: every cell the catalog decides, every cell that is the
//    member's, the notes ADDED TO, only that copy's row written
// C  "Put it back": the row exactly as it was
// D  the pick: a named variation, and "Not sure of the variation" (blank)
// E  a double press writes once
// F  one line refused: it says so and is left alone; the other still lands
// G  a 320 px phone: nothing runs off the side
// H  a copy whose Inventory ID is not the one on the line is not written
// P  planted offenders — each one turns a check above red
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  catalog_now_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

// ── planted offenders: each replaces ONE line of the real code ───────────────
function plant(file, from, to) {
  const s = fs.readFileSync(path.join(APP, file), 'utf8');
  if (s.split(from).length !== 2) throw new Error('planted ' + file + ': the anchor moved (' + from.slice(0, 60) + '); update this test');
  return { file: file, body: s.replace(from, to) };
}
const PLANTS = {
  numberOnly: () => plant('tools.js', '    return !!rm && rrMakerSame(rm, mk);\n', '    return true;\n'),
  tickedDefault: () => plant('tools.js', "(one ? '' : ' disabled') + ' style=\"width:1.15rem", "' checked' + ' style=\"width:1.15rem"),
  notesReplaced: () => plant('tools.js', "  return old ? old + ' | ' + line : line;\n", '  return line;\n'),
  doubleRun: () => plant('tools.js', '  if (window._cnwBusy) return;\n', ''),
  groupOffered: () => plant('tools.js', "  if (String(pd.groupId || '').trim() || String(pd.setId || '').trim()) return 'group';\n", ''),
  varDefault: () => plant('tools.js', "  if (notSure) { f.variation = ''; f.variationDescription = ''; }\n", ''),
  noMakerQuiet: () => plant('tools.js', "    if (why === 'no-maker') { noMaker++; return; }\n", "    if (why === 'no-maker') { return; }\n"),
  invIgnored: () => plant('tools.js', "  if (!live || String(live.inventoryId || '') !== String(inv || '')) return { ok: false, why: C.gone };\n  var fits", "  if (!live) return { ok: false, why: C.gone };\n  var fits"),
  setsOffered: () => plant('tools.js', "    if (/\\bSets$/i.test(String(r._tab || '').trim())) return false;   // a Sets tab row is a set, not an item\n", ''),
  noCount: () => plant('tools.js', "  if (!n) return { n: 0, button: String(C.button || ''), beside: '', note: String(C.note || '') };\n", "  if (n >= 0) return { n: 0, button: String(C.button || ''), beside: '', note: String(C.note || '') };\n"),
  onButton: () => plant('tools.js', "  return { n: n, button: String(C.button || ''), beside: line, note: line };\n", "  return { n: n, button: line, beside: '', note: line };\n"),
  everyone: () => plant('config.js', "  if (w !== 'owners') return false;\n", "  if (w === 'owners') return true;\n"),
  writeUngated: () => plant('tools.js', "  if (typeof rrCatalogNowOn !== 'function' || !rrCatalogNowOn()) return { ok: false, why: '' };   // not switched on for this person: nothing is written\n", ''),
  linkedListed: () => plant('tools.js', "  if (typeof rrCopyIsUnlinked !== 'function' || !rrCopyIsUnlinked(pd)) return 'linked';\n", ''),
};

const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  small: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1400, height: 900 } },
};

async function boot(browser, size, planted, member) {
  const ctx = await browser.newContext(SIZES[size || 'laptop']);
  if (member) await ctx.addInitScript(() => { window.__asMember = true; });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && bare.endsWith('/app/' + planted.file)) return r.fulfill({ body: planted.body, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    const mk = (n, id, era, tab, maker, x) => Object.assign({ itemNum: n, variation: '', itemType: 'Boxcar', description: '', _era: era, _tab: tab, rowId: id,
      yearProd: '', roadName: '', manufacturer: maker }, x || {});
    state.masterData = [
      mk('K6349', 'KL63490001', 'kline', 'K-Line O', 'K-Line', { itemType: 'Tank Car', roadName: 'Rock Island', description: 'Route Rock Single Dome Tank Car', variation: '1', yearProd: '1992' }),
      mk('30-7001', 'MT70010001', 'mth_o', 'MTH O', 'MTH', { itemType: 'Boxcar', roadName: 'Pennsylvania', description: 'PRR Boxcar', variation: '1', varDesc: 'tuscan' }),
      mk('30-7001', 'MT70010002', 'mth_o', 'MTH O', 'MTH', { itemType: 'Boxcar', roadName: 'Pennsylvania', description: 'PRR Boxcar', variation: '2', varDesc: 'green' }),
      mk('6464', 'AT64640001', 'atlas', 'Atlas O', 'Atlas', { roadName: 'Western Pacific', description: 'Atlas 40ft Boxcar' }),
      mk('6464', 'PW64640001', 'pw', 'Lionel PW - Items', 'Lionel', { roadName: 'Great Northern', description: 'Lionel 6464 Boxcar' }),
      mk('1000', 'ST10000001', 'pw', 'Lionel PW - Sets', 'Lionel', { itemType: 'Set', description: 'Outfit 1000' }),
      mk('9999', 'MP99990001', 'mpc', 'Lionel MPC-Modern', 'Lionel', { description: 'A modern car' }),
    ];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.user = { email: window.__asMember ? 'member@example.com' : RR_OWNER_EMAILS[0] };   // an owner unless the case says a member
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; try { accessToken = 'tok'; } catch (e) {}
    const DF = 'https://drive.google.com/drive/folders/';
    const pd = (n, inv, row, maker, x) => Object.assign({ owned: true, itemNum: n, variation: '', era: 'Manual', manufacturer: maker, inventoryId: inv, row: row }, x || {});
    state.personalData = {
      h1: pd('K6349', '301', 3, 'K-Line', { description: 'Route Rock tank car', customName: 'my tank', notes: 'from Bob', condition: '8', priceItem: '55', dateAdded: '2026-11-20',
        photoItem: DF + 'FOLD_H1', itemType: 'Tank Car', hasBox: 'Yes', location: 'Shelf 2', userEstWorth: '70' }),
      h2: pd('30-7001', '302', 4, 'MTH', { description: 'my PRR boxcar', condition: '7' }),
      h3: pd('6464', '303', 5, 'Atlas', { description: 'WP boxcar', condition: '9' }),
      h4: pd('6464', '304', 6, '', { description: 'some boxcar' }),
      h5: pd('9999', '305', 7, 'Lionel', { groupId: 'G9', description: 'in a group' }),
      h6: pd('1000', '306', 8, 'Lionel', { description: 'an outfit' }),
      h7: pd('7777', '307', 9, 'K-Line', { description: 'not in the catalog' }),
      l1: Object.assign(pd('K6349', '308', 10, 'K-Line', {}), { era: 'kline', masterRowId: 'KL63490001', variation: '1' }),
      h8: pd('K6349-BOX', '309', 11, 'K-Line', { itemType: 'Box' }),
    };
    state.soldData = {}; state.wantData = {}; state.forSaleData = {}; state.upgradeData = {}; state.isData = {}; state.partsData = {};
    const T = window.__tabs = { 'My Collection': {} };
    Object.values(state.personalData).forEach(p => { T['My Collection'][p.row] = rrRecordRow(p); });
    window.__before = JSON.parse(JSON.stringify(T['My Collection']));
    window.__puts = [];
    const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const parse = r => {
      const m = /^'?(.+?)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/.exec(r);
      return m ? { tab: m[1], c0: colIdx(m[2]), row: Number(m[3]), c1: m[4] ? colIdx(m[4]) : colIdx(m[2]), column: !!(m[4] && !m[5]) } : null;
    };
    window.fetch = async function (url, opts) {
      const u = String(url); const method = (opts && opts.method) || 'GET';
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/:(append|batchGet|batchUpdate|clear)\b/.test(u)) return ok({});
      const m = /\/values\/([^?]+)(\?|$)/.exec(u);
      if (m && method === 'GET') {
        const p = parse(decodeURIComponent(m[1])); if (!p || !T[p.tab]) return ok({ values: [] });
        // the safe save's whole-row re-read finds another item on the row (refused)
        if (window.__refuseRow && p.tab === 'My Collection' && p.row === window.__refuseRow && !p.column && p.c1 > PERSONAL_FIELD_INDEX.inventoryId) {
          const c = (T[p.tab][p.row] || []).slice(); c[PERSONAL_FIELD_INDEX.inventoryId] = 'ZZZ';
          return ok({ values: [c.slice(p.c0, p.c1 + 1)] });
        }
        if (p.column) {
          const last = Math.max(p.row, ...Object.keys(T[p.tab]).map(Number)); const v = [];
          for (let i = p.row; i <= last; i++) v.push([(T[p.tab][i] || [])[p.c0] == null ? '' : (T[p.tab][i] || [])[p.c0]]);
          return ok({ values: v });
        }
        return ok({ values: [(T[p.tab][p.row] || []).slice(p.c0, p.c1 + 1)] });
      }
      if (m && method === 'PUT') {
        const r = decodeURIComponent(m[1]); const body = JSON.parse(opts.body); const p = parse(r);
        window.__puts.push({ range: r, values: body.values });
        if (p && T[p.tab]) { const cur = T[p.tab][p.row] = T[p.tab][p.row] || []; (body.values[0] || []).forEach((v, k) => { cur[p.c0 + k] = v; }); }
        return ok({ updatedCells: 1 });
      }
      return ok({});
    };
    window.driveRequest = async function () { return {}; };
    window.driveFindItemFolder = async function () { return ''; };
    window.__toasts = [];
    window.showToast = function (m) { window.__toasts.push(String(m)); };
  });
  return { ctx, pg, errs };
}

// open Collection Tools, open the section, press the button
const OPEN = async (pg) => pg.evaluate(async () => {
  buildToolsPage();
  const page = document.getElementById('page-tools');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); page.classList.add('active');
  const body = document.getElementById('catalognow-body');
  const head = Array.from(page.querySelectorAll('div')).find(d => /_toolsToggleSection\('catalognow'\)/.test(d.getAttribute('onclick') || ''));
  const folded = body ? body.style.display === 'none' : null;
  if (head) head.click();
  const btn = document.getElementById('catalog-now-run');
  const r = { section: !!body, head: head ? head.textContent.replace(/\s+/g, ' ').trim() : '', folded: folded, open: body ? body.style.display !== 'none' : false,
    button: btn ? btn.textContent : '', beside: (document.getElementById('catalog-now-count') || { textContent: '' }).textContent,
    besideNext: !!(btn && btn.nextElementSibling && btn.nextElementSibling.id === 'catalog-now-count'), card: body ? body.textContent.replace(/\s+/g, ' ').trim() : '' };
  if (btn) btn.click();
  await new Promise(x => setTimeout(x, 200));
  return r;
});
const LOOK = async (pg) => pg.evaluate(() => {
  const out = document.getElementById('catalog-now-results');
  const rows = Array.from(out.querySelectorAll('.cnw-row'));
  return {
    keys: rows.map(r => r.getAttribute('data-key')),
    ticked: rows.map((r, i) => !!(document.getElementById('cnw-tick-' + i) || {}).checked),
    disabled: rows.map((r, i) => !!(document.getElementById('cnw-tick-' + i) || {}).disabled),
    options: rows.map((r, i) => { const s = document.getElementById('cnw-pick-' + i); return s ? Array.from(s.options).map(o => o.textContent) : null; }),
    text: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    all: out.textContent.replace(/\s+/g, ' ').trim(),
    nomaker: (document.getElementById('cnw-nomaker') || { textContent: '' }).textContent,
    puts: window.__puts.length,
    wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rowsWide: rows.map(r => r.scrollWidth - r.clientWidth),
  };
});
// tick lines by key (and pick first, for a line with choices), then press Update
const GO = async (pg, picks, presses) => pg.evaluate(async ([picks, presses]) => {
  const list = window._cnwList || [];
  Object.keys(picks).forEach(key => {
    const i = list.findIndex(e => e.key === key); if (i < 0) return;
    const sel = document.getElementById('cnw-pick-' + i);
    if (sel && picks[key] !== true) { sel.value = picks[key]; sel.dispatchEvent(new Event('change')); }
    const t = document.getElementById('cnw-tick-' + i); if (t && !t.disabled) t.checked = true;
  });
  const btn = document.getElementById('cnw-go');
  const runs = []; for (let k = 0; k < (presses || 1); k++) runs.push(rrCatalogNowApply(btn));
  await Promise.all(runs);
  await new Promise(x => setTimeout(x, 300));
  return { msgs: list.map((e, i) => (document.getElementById('cnw-msg-' + i) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim()),
    sum: (document.getElementById('cnw-sum') || { textContent: '' }).textContent };
}, [picks, presses || 1]);
const READ = async (pg) => pg.evaluate(() => {
  const F = PERSONAL_FIELD_INDEX, T = window.__tabs, bare = v => String(v == null ? '' : v).replace(/^'/, '');
  const pr = n => { const c = T['My Collection'][n] || []; return { num: bare(c[F.itemNum]), inv: bare(c[F.inventoryId]), rowId: bare(c[F.masterRowId]), era: bare(c[F.era]),
    road: bare(c[F.roadName]), mdesc: bare(c[F.masterDescription]), mfr: bare(c[F.manufacturer]), type: bare(c[F.itemType]), vr: bare(c[F.variation]), vdesc: bare(c[F.variationDescription]),
    desc: bare(c[F.description]), name: bare(c[F.customName]), notes: bare(c[F.notes]), cond: bare(c[F.condition]), price: bare(c[F.priceItem]), photo: bare(c[F.photoItem]),
    box: bare(c[F.hasBox]), loc: bare(c[F.location]), worth: bare(c[F.userEstWorth]), added: bare(c[F.dateAdded]) }; };
  const same = n => JSON.stringify((T['My Collection'][n] || []).map(bare)) === JSON.stringify((window.__before[n] || []).map(bare));
  const h1 = state.personalData.h1;
  return { h1: pr(3), h2: pr(4), h3: pr(5), same: { 3: same(3), 4: same(4), 5: same(5), 6: same(6), 7: same(7), 8: same(8), 9: same(9), 10: same(10), 11: same(11) },
    putRows: window.__puts.map(x => (/!([A-Z]+)(\d+)/.exec(x.range) || [])[2]), puts: window.__puts.length,
    mem: { rowId: h1.masterRowId, era: h1.era, notes: h1.notes, desc: h1.description, inv: h1.inventoryId, num: h1.itemNum },
    button: (document.getElementById('catalog-now-count') || { textContent: '' }).textContent,
    unlinked: rrCopyIsUnlinked(h1), rescan: rrCatalogNowList().list.map(e => e.key), toasts: window.__toasts.slice() };
});
const UNDO = async (pg, key) => pg.evaluate(async (key) => {
  const i = (window._cnwList || []).findIndex(e => e.key === key);
  const b = Array.from((document.getElementById('cnw-msg-' + i) || document.createElement('div')).querySelectorAll('button')).find(x => /Put it back/.test(x.textContent));
  if (!b) return { button: false };
  await rrCatalogNowUndo(i, b);
  await new Promise(x => setTimeout(x, 300));
  return { button: true, msg: document.getElementById('cnw-msg-' + i).textContent.replace(/\s+/g, ' ').trim() };
}, key);

const NOTE = 'from Bob | Entered by hand 2026-11-20 as: K6349 my tank Route Rock tank car Tank Car (K-Line)';

// every check as one list of named answers, so a planted run can be compared
// `only` (a planted run): the ONE group of checks the planted line must turn red — the same checks, read the same
// way; the groups it cannot touch are not booted again (15 runs × 12 app starts was 6 minutes, past run-all's cap).
async function runAll(browser, planted, only) {
  const R = {};
  const want = g => !only || only === g;
  // A — the screen
  if (want('A')) for (const size of (only ? ['laptop'] : ['phone', 'laptop'])) {
    const { ctx, pg, errs } = await boot(browser, size, planted);
    const o = await OPEN(pg); const l = await LOOK(pg);
    R['A0 [' + size + '] the page ran without a script error'] = [errs.length === 0, errs];
    R['A1 [' + size + '] Collection Tools has the section "Now in the catalog", folded, and one tap opens it'] = [o.section && /Now in the catalog/i.test(o.head) && o.folded === true && o.open, o];
    R['A1b [' + size + '] NEXT TO the button (not on it), and by the folded heading: "3 of your hand-typed items are in the catalog now"'] =
      [o.button === 'Check my hand-typed items' && o.besideNext && o.beside === '3 of your hand-typed items are in the catalog now' && /3 of your hand-typed items are in the catalog now/.test(o.head), { b: o.button, s: o.beside, n: o.besideNext, h: o.head }];
    R['A2 [' + size + '] the scan lists exactly the three hand-typed items the catalog has (K6349, 30-7001, 6464 Atlas)'] = [JSON.stringify(l.keys.slice().sort()) === JSON.stringify(['h1', 'h2', 'h3']), l.keys];
    R['A3 [' + size + '] nothing is ticked to start'] = [l.ticked.length === 3 && l.ticked.every(x => !x), l.ticked];
    const i2 = l.keys.indexOf('h2'), i3 = l.keys.indexOf('h3'), i1 = l.keys.indexOf('h1');
    R['A4 [' + size + '] the line with two variations cannot be ticked before a pick, and offers both + "Not sure of the variation"'] =
      [i2 >= 0 && l.disabled[i2] === true && l.options[i2] && l.options[i2].length === 4 && /Choose/.test(l.options[i2][0]) && /Var 1/.test(l.options[i2][1]) && /Var 2/.test(l.options[i2][2]) && /Not sure of the variation/.test(l.options[i2][3]), { d: l.disabled, o: l.options }];
    R['A5 [' + size + '] the Atlas 6464 is offered Atlas\'s row only — never Lionel\'s 6464'] =
      [i3 >= 0 && l.options[i3] === null && /Atlas O/.test(l.text[i3]) && /Western Pacific/.test(l.text[i3]) && !/Great Northern|Lionel Postwar/.test(l.text[i3]), l.text[i3]];
    R['A6 [' + size + '] each line shows what was typed beside the catalog\'s entry'] =
      [i1 >= 0 && /What you typed/i.test(l.text[i1]) && /Route Rock tank car/.test(l.text[i1]) && /The catalog.s entry/i.test(l.text[i1]) && /Route Rock Single Dome Tank Car/.test(l.text[i1]) && /Rock Island/.test(l.text[i1]), l.text[i1]];
    R['A7 [' + size + '] the screen says what stays, what is left out, and that 1 item has no maker'] =
      [/Stays exactly as it is: condition, price, worth, photos, box, dates, location and your notes/.test(l.all) && /added to the item.s notes/.test(l.all) && /Not checked here: sets, pieces saved in a group, and items with no maker/.test(l.all) && /^1 hand-typed item has no maker/.test(l.nomaker), { all: l.all.slice(-300), nm: l.nomaker }];
    R['A8 [' + size + '] looking writes nothing'] = [l.puts === 0, l.puts];
    await ctx.close();
  }
  // B + C — the update and "Put it back"
  if (want('B')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await OPEN(pg);
    const g = await GO(pg, { h1: true }); const r = await READ(pg);
    R['B1 the update lands and the line says so, with "Put it back"'] = [/Updated . now a catalog entry/.test(g.msgs.join(' ')) && /Put it back/.test(g.msgs.join(' ')) && /^1 updated\.$/.test(g.sum), g];
    R['B2 the catalog\'s cells: Row ID, catalog, road, description, maker, type, variation'] =
      [r.h1.rowId === 'KL63490001' && r.h1.era === 'kline' && r.h1.road === 'Rock Island' && r.h1.mdesc === 'Route Rock Single Dome Tank Car' && r.h1.mfr === 'K-Line' && r.h1.type === 'Tank Car' && r.h1.vr === '1', r.h1];
    R['B3 what is the member\'s stays: number, Inventory ID, condition, price, worth, photos, box, location, date added'] =
      [r.h1.num === 'K6349' && r.h1.inv === '301' && r.h1.cond === '8' && r.h1.price === '55' && r.h1.worth === '70' && /FOLD_H1$/.test(r.h1.photo) && r.h1.box === 'Yes' && r.h1.loc === 'Shelf 2' && r.h1.added === '2026-11-20', r.h1];
    R['B4 the notes are ADDED TO — the old note first, then one line with what was typed'] = [r.h1.notes === NOTE, r.h1.notes];
    R['B5 the typed description and name leave their cells (they are in the notes now)'] = [r.h1.desc === '' && r.h1.name === '', { d: r.h1.desc, n: r.h1.name }];
    R['B6 only that copy\'s row is written — every other row is exactly as it was'] =
      [r.puts > 0 && r.putRows.every(x => x === '3') && [4, 5, 6, 7, 8, 9, 10, 11].every(n => r.same[n]), { rows: r.putRows, same: r.same }];
    R['B8 after the update the line beside the button counts what is left: 2'] = [r.button === '2 of your hand-typed items are in the catalog now', r.button];
    R['B7 the app\'s memory agrees, the copy is a catalog entry now, and a new scan no longer lists it'] =
      [r.mem.rowId === 'KL63490001' && r.mem.era === 'kline' && r.mem.notes === NOTE && r.mem.inv === '301' && r.mem.num === 'K6349' && r.unlinked === false && r.rescan.indexOf('h1') < 0, { mem: r.mem, un: r.unlinked, re: r.rescan }];
    const u = await UNDO(pg, 'h1'); const r2 = await READ(pg);
    R['C1 "Put it back" puts the row back exactly as it was typed'] = [u.button && /Put back/.test(u.msg || '') && r2.same[3] === true && r2.unlinked === true && r2.mem.notes === 'from Bob' && r2.mem.desc === 'Route Rock tank car', { u, same: r2.same[3], mem: r2.mem }];
    R['C2 ...and it is found again by a new scan, and the line beside the button says 3 again'] = [r2.rescan.indexOf('h1') >= 0 && r2.button === '3 of your hand-typed items are in the catalog now', { re: r2.rescan, b: r2.button }];
    await ctx.close();
  }
  // D — the pick
  if (want('D')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await OPEN(pg);
    await GO(pg, { h2: 'notsure' }); const r = await READ(pg);
    R['D1 "Not sure of the variation": tied to the item, the variation left BLANK — never a silent 1'] = [r.h2.rowId === 'MT70010001' && r.h2.vr === '' && r.h2.vdesc === '' && r.h2.era === 'mth_o', r.h2];
    await ctx.close();
    const b2 = await boot(browser, 'laptop', planted);
    await OPEN(b2.pg);
    await GO(b2.pg, { h2: '1' }); const r3 = await READ(b2.pg);
    R['D2 a named variation: that row, its variation and its words'] = [r3.h2.rowId === 'MT70010002' && r3.h2.vr === '2' && r3.h2.vdesc === 'green', r3.h2];
    await b2.ctx.close();
  }
  // E — a double press
  if (want('E')) {
    const one = await boot(browser, 'laptop', planted);
    await OPEN(one.pg); await GO(one.pg, { h1: true }, 1); const a = await READ(one.pg); await one.ctx.close();
    const two = await boot(browser, 'laptop', planted);
    await OPEN(two.pg); await GO(two.pg, { h1: true }, 2); const b = await READ(two.pg); await two.ctx.close();
    R['E1 pressing Update twice writes once (the same writes as one press)'] = [a.puts > 0 && b.puts === a.puts && b.h1.notes === NOTE, { one: a.puts, two: b.puts, notes: b.h1.notes }];
  }
  // F — one line refused
  if (want('F')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    await OPEN(pg);
    await pg.evaluate(() => { window.__refuseRow = 3; });
    const g = await GO(pg, { h1: true, h3: true }); const r = await READ(pg);
    R['F1 a refused line says so and is left as it was; the other line still lands'] =
      [r.same[3] === true && r.h3.rowId === 'AT64640001' && /Not updated/.test(g.msgs.join(' ')) && /1 updated, 1 left as they were\./.test(g.sum), { g, same3: r.same[3], h3: r.h3 }];
    await ctx.close();
  }
  // G — a 320 px phone
  if (want('G')) {
    const { ctx, pg } = await boot(browser, 'small', planted);
    await OPEN(pg); const l = await LOOK(pg);
    R['G1 at 320 px nothing runs off the side — the page and every line fit'] = [l.keys.length === 3 && l.wide <= 1 && l.rowsWide.every(w => w <= 1), { wide: l.wide, rows: l.rowsWide }];
    await ctx.close();
  }
  // I — the button's plain words, and one item
  if (want('I')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    const w = await pg.evaluate(() => {
      ['h2', 'h3'].forEach(k => { delete state.personalData[k]; });
      const one = rrCatalogNowButtonWords().beside;
      delete state.personalData.h1;
      buildToolsPage();
      return { one: one, none: document.getElementById('catalog-now-count').textContent, btn: document.getElementById('catalog-now-run').textContent };
    });
    R['I1 one item reads "1 of your hand-typed items is in the catalog now"; with none the line is blank and the button is unchanged'] =
      [w.one === '1 of your hand-typed items is in the catalog now' && w.none === '' && w.btn === 'Check my hand-typed items', w];
    await ctx.close();
  }
  // J — who sees it: every member since 2026-11-25 ([stated] Brad; the switch RR_CATALOG_NOW.who = 'all').
  // The switch itself still works: set back to 'owners' or 'off' in the page, a member sees nothing and
  // nothing can be written for them.
  if (want('J')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted, true);
    const m = await pg.evaluate(async () => {
      const shipped = RR_CATALOG_NOW.who;
      buildToolsPage();
      const all = { on: rrCatalogNowOn(), section: !!document.getElementById('catalognow-body'), button: !!document.getElementById('catalog-now-run') };
      const look = async (who) => {
        RR_CATALOG_NOW.who = who; window.__puts.length = 0;
        buildToolsPage();
        const res = await rrCatalogNowUpdateOne('h1', '301', state.masterData[0], false);
        return { on: rrCatalogNowOn(), section: !!document.getElementById('catalognow-body'), button: !!document.getElementById('catalog-now-run'),
          text: /Now in the catalog/i.test(document.getElementById('page-tools').textContent), wrote: res.ok, puts: window.__puts.length };
      };
      const owners = await look('owners'), off = await look('off');
      RR_CATALOG_NOW.who = shipped;
      return { shipped, all, owners, off };
    });
    const shut = x => x.on === false && !x.section && !x.button && !x.text && x.wrote === false && x.puts === 0;
    R['J0 the switch says all: a MEMBER sees the section and the button'] = [m.shipped === 'all' && m.all.on === true && m.all.section && m.all.button, m];
    R['J1 the switch set back to owners (or off): a member sees no section, no button, no words — and nothing can be written for them'] = [shut(m.owners) && shut(m.off), m];
    await ctx.close();
    const rec = await boot(browser, 'laptop', planted);
    const o = await rec.pg.evaluate(() => {
      const shipped = RR_CATALOG_NOW.who;
      const a = rrCatalogNowOn();
      RR_CATALOG_NOW.who = 'owners';
      const own = rrCatalogNowOn();
      rrSetRecordingMode(true); buildToolsPage();
      const b = { on: rrCatalogNowOn(), section: !!document.getElementById('catalognow-body') };
      rrSetRecordingMode(false);
      RR_CATALOG_NOW.who = shipped;
      return { owner: a, own: own, rec: b };
    });
    R['J2 an owner sees it; with the switch on owners, recording mode hides it like every owner-only tool'] = [o.owner === true && o.own === true && o.rec.on === false && o.rec.section === false, o];
    await rec.ctx.close();
  }
  // H — identity
  if (want('H')) {
    const { ctx, pg } = await boot(browser, 'laptop', planted);
    const h = await pg.evaluate(async () => {
      const entry = state.masterData[0];
      const res = await rrCatalogNowUpdateOne('h1', 'WRONG-ID', entry, false);
      return { ok: res.ok, puts: window.__puts.length };
    });
    R['H1 a copy whose Inventory ID is not the one on the line is not written'] = [h.ok === false && h.puts === 0, h];
    await ctx.close();
  }
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  console.log('== the real code ==');
  const real = await runAll(browser, null);
  Object.keys(real).forEach(n => T(n, real[n][0], real[n][1]));

  // ── P · planted offenders: each must turn its check red ──
  console.log('\n== P · planted offenders ==');
  const CATCH = {
    numberOnly: /A5 \[laptop\]/, tickedDefault: /A3 \[laptop\]/, notesReplaced: /^B4 /, doubleRun: /^E1 /, groupOffered: /A2 \[laptop\]/,
    varDefault: /^D1 /, noMakerQuiet: /A7 \[laptop\]/, invIgnored: /^H1 /, setsOffered: /A2 \[laptop\]/, linkedListed: /A2 \[laptop\]/, noCount: /A1b \[laptop\]/, onButton: /A1b \[laptop\]/, everyone: /^J1 /, writeUngated: /^J1 /,
  };
  // the group each planted line's check lives in (the first letter of its check's name)
  const GROUP = name => CATCH[name].source.replace(/^\^/, '').charAt(0);
  T('P0 every planted line names a check and a group', Object.keys(PLANTS).every(n => CATCH[n] && /^[ABDEHJ]$/.test(GROUP(n))) && Object.keys(CATCH).every(n => PLANTS[n]), Object.keys(PLANTS).map(n => [n, CATCH[n] && GROUP(n)]));
  let k = 0;
  for (const name of Object.keys(PLANTS)) {
    k++;
    let res;
    try { res = await runAll(browser, PLANTS[name](), GROUP(name)); } catch (e) { T('P' + k + ' planted "' + name + '" could be run', false, String(e && e.message)); continue; }
    const hit = Object.keys(res).filter(n => CATCH[name].test(n));
    // the same planted line on the real code is GREEN (so a red here is the planted line, nothing else)
    const green = Object.keys(real).filter(n => CATCH[name].test(n));
    T('P' + k + ' planted "' + name + '" turns its check red (' + (hit[0] || '?').slice(0, 60) + ')', hit.length > 0 && hit.every(n => res[n][0] === false) && green.length === hit.length && green.every(n => real[n][0] === true), hit.map(n => [n.slice(0, 30), res[n][0]]));
  }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASSED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
