#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COMMAND IDs — THE ITEM PAGE (2026-10-31; real Chromium, the REAL app, a
// stand-in My Collection sheet that records every write)
//
// [stated] Brad 2026-10-31 15:51 CT (item 84631's page, a red box under the
// Description / Maintenance cards): "a clickable button on the item add and
// item detail page that when you click it you can add the code … that way its
// clean until you click it. then if you click on the item, it show large in
// the red box. lets keep it off of the my collection column list unless the
// user want to add it with add column" → 15:53 CT "yes".
//   A  a Modern engine, boxcar, caboose and accessory show ONLY the small
//      "＋ Add command ID" button — no boxes, no empty card
//   B  tap → three boxes in place (the catalog hint orders them and says so:
//      Lionel Legacy/CC → TMCC first; MTH Proto-Sound → DCS first; Bachmann →
//      no hint); save → the BIG numbers in the card; the sheet row holds them
//      in the three END columns and nothing else was written
//   L  where it sits: under Description + Maintenance on a computer (left
//      column, beside the photo); right under Description on a phone
//   C  tap the numbers → change → clear them all → the small button is back
//      and the sheet cells are blank
//   G  the Details grid, Edit fields and Update Info never draw the IDs as
//      plain boxes
//   E  none on a Postwar / Pre-war item, nor a Modern-numbered item whose era
//      was set to Postwar by hand; a Postwar copy that already HOLDS an ID
//      still shows its card
//   D  the duplicate warning: same system → "Your … is also set to … Both
//      will answer the remote." with Keep both / Change this one; another
//      system → silent; an engine vs an accessory → silent; the clash note
//      under the number
//   K  My Collection: neither column is shown until "+ Add a column" adds it
//      (it is offered, with its one-line help); then the saved value shows
//   S  search: "ID 12", "TMCC 12", "Legacy 12", "DCS 7", "DCC 3" find it; a
//      bare "12" does not
//   P  planted: each piece undone in a served copy turns its own check red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  command_ids_page_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const MASTER = [
  { itemNum: '6-84631', variation: '', itemType: 'Diesel Locomotive', control: 'Legacy/CC', description: 'GP9 Diesel Locomotive', roadName: 'Santa Fe', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '30-2140-1', variation: '', itemType: 'Steam Locomotive', description: '4-6-2 Pacific with Proto-Sound 2.0', roadName: 'Pennsylvania', yearProd: '2004', _era: 'mth', _tab: 'MTH O' },
  { itemNum: '51605', variation: '', itemType: 'Diesel Locomotive', description: 'GP7 Diesel', roadName: 'Chessie', yearProd: '2010', _era: 'bachmann_ho', _tab: 'Bachmann HO' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-17000', variation: '', itemType: 'Caboose', description: 'Caboose', roadName: 'Erie', yearProd: '1999', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-14111', variation: '', itemType: 'Accessory', description: 'Operating Gateman', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'F-3 A unit', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '262', variation: '', itemType: 'Steam Locomotive', description: '2-4-2 steam', yearProd: '1931', _era: 'prewar', _tab: 'Lionel Pre-War' },
  { itemNum: '6-84632', variation: '', itemType: 'Diesel Locomotive', control: 'Command Control', description: 'GP9 B unit', roadName: 'Santa Fe', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-14200', variation: '', itemType: 'Accessory', description: 'TMCC Operating Coal Loader', yearProd: '2005', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '2344', variation: '', itemType: 'Diesel Locomotive', description: 'F-3 A unit', roadName: 'New York Central', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items' },
];
const P = (n, inv, row, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: inv, row: row, manufacturer: 'Lionel', condition: '8' }, x || {});
const PD = {
  '101': P('6-84631', '101', 3), '102': P('30-2140-1', '102', 4, { manufacturer: 'MTH' }), '103': P('51605', '103', 5, { manufacturer: 'Bachmann' }),
  '104': P('6-29000', '104', 6), '105': P('6-17000', '105', 7), '106': P('6-14111', '106', 8),
  '107': P('2343', '107', 9), '108': P('262', '108', 10), '109': P('6-84631', '109', 11, { eraPeriod: 'postwar' }),
  '110': P('2344', '110', 12, { tmccId: '5', eraPeriod: '' }),
  '111': P('6-84632', '111', 13), '112': P('6-14200', '112', 14, { tmccId: '12' }),
};
const IDX = n => MASTER.findIndex(m => m.itemNum === n);

async function open(browser, o) {
  o = o || {};
  const ctx = await browser.newContext(o.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    for (const f of Object.keys(o.swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: o.swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(({ master, pd }) => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = master.slice();
    state.personalData = JSON.parse(JSON.stringify(pd));
    state.personalSheetId = 'SHEET';
    window.__toasts = []; window.showToast = function (m) { window.__toasts.push(String(m)); };
    window.__confirms = []; window.__answers = [];
    window.appConfirm = async function (msg, opts) { window.__confirms.push({ msg: String(msg), ok: opts && opts.ok, cancel: opts && opts.cancel }); return window.__answers.length ? window.__answers.shift() : true; };
    // the stand-in sheet: one row per record, every write recorded
    window.__sheet = {}; window.__writes = [];
    // (Google Sheets keeps a leading ' as "this is text" and never hands it back — so neither does this sheet)
    const cellOf = v => v == null ? '' : String(v).replace(/^'/, '');
    Object.values(state.personalData).forEach(p => { window.__sheet[p.row] = rrRecordRow(p).map(cellOf); });
    const toIdx = s => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    window.sheetsGet = async (id, rg) => { const m = /!A(\d+):/.exec(rg); return { values: [(window.__sheet[+m[1]] || []).slice()] }; };
    window.sheetsUpdate = async (id, rg, vals) => {
      window.__writes.push(rg);
      const m = /!([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(rg);
      const row = window.__sheet[+m[2]] = window.__sheet[+m[2]] || [];
      vals[0].forEach((v, i) => { row[toIdx(m[1]) + i] = cellOf(v); });
    };
    window.loadPersonalData = async () => {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, { master: MASTER, pd: PD });
  return { pg, ctx, errs };
}
// One page's Command ID spot, read back.
const spot = (pg, n, inv) => pg.evaluate(async ([idx, inv]) => {
  showItemDetailPage(idx, inv); await new Promise(r => setTimeout(r, 120));
  const c = document.getElementById('cmdid-card');
  return { exists: !!c, html: c ? c.innerHTML : '', text: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
           btn: !!(c && c.querySelector('#cmdid-add')), inputs: c ? c.querySelectorAll('input').length : -1, card: !!(c && c.querySelector('.rr-cmdid-card')) };
}, [IDX(n), inv]);

async function pageSuite(browser, swap) {
  const R = {};
  const { pg, ctx, errs } = await open(browser, { swap });
  // A
  R.a = {};
  for (const [n, inv] of [['6-84631', '101'], ['6-29000', '104'], ['6-17000', '105'], ['6-14111', '106']]) R.a[n] = await spot(pg, n, inv);
  // B — open, the hint, save
  R.b = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const order = () => Array.from(document.querySelectorAll('#cmdid-card input')).map(i => i.getAttribute('data-cmdid-key')).join(',');
    const hint = () => { const h = document.querySelector('#cmdid-card .rr-cmdid-hint'); return h ? h.textContent : ''; };
    for (const [idx, inv, k] of [[0, '101', 'lionel'], [1, '102', 'mth'], [2, '103', 'bach']]) {
      showItemDetailPage(idx, inv); await S(80);
      if (!document.getElementById('cmdid-add')) { out[k] = { order: 'NO BUTTON', html: (document.getElementById('cmdid-card') || {}).innerHTML }; continue; }
      document.getElementById('cmdid-add').click(); await S(60);
      out[k] = { order: order(), hint: hint(), save: !!document.getElementById('cmdid-save'), cancel: !!document.getElementById('cmdid-cancel') };
    }
    // save TMCC 12 + DCS 7 on the Lionel engine
    showItemDetailPage(0, '101'); await S(80);
    if (!document.getElementById('cmdid-add')) return Object.assign(out, { saveStep: 'NO BUTTON', html: (document.getElementById('cmdid-card') || {}).innerHTML, pd: state.personalData['101'] });
    document.getElementById('cmdid-add').click(); await S(40);
    const set = (k, v) => { const el = document.getElementById('cmdid-in-' + k); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('tmccId', '012'); set('dcsId', '7'); set('dccAddress', '');
    window.__writes.length = 0; window.__confirms.length = 0; window.__before3 = window.__sheet[3].slice();
    await rrCmdIdSave(); await S(60);
    const c = document.getElementById('cmdid-card');
    out.shown = c.textContent.replace(/\s+/g, ' ').trim();
    out.big = Array.from(c.querySelectorAll('.rr-cmdid-num')).map(x => { const s = x.querySelectorAll('span'); return s[0].textContent + ' ' + s[1].textContent + ' @' + getComputedStyle(s[1]).fontSize; });
    const F = PERSONAL_FIELD_INDEX, row = window.__sheet[3];
    out.cells = [row[F.tmccId], row[F.dcsId], row[F.dccAddress]];
    out.lastThree = PERSONAL_SCHEMA.slice(-3).map(s => s.field).join(',');
    out.writes = window.__writes.slice();
    out.letters = ['dcsId', 'tmccId', 'dccAddress'].map(personalColLetter);
    out.pd = [state.personalData['101'].tmccId, state.personalData['101'].dcsId];
    out.confirms = window.__confirms.length;
    out.otherCellsSame = JSON.stringify(row.filter((v, i) => !/^(tmccId|dcsId|dccAddress)$/.test(PERSONAL_SCHEMA[i].field))) === JSON.stringify(window.__before3.filter((v, i) => !/^(tmccId|dcsId|dccAddress)$/.test(PERSONAL_SCHEMA[i].field)));
    return out;
  });
  // L — where it sits (computer)
  R.l = await pg.evaluate(async () => {
    showItemDetailPage(0, '101'); await new Promise(r => setTimeout(r, 120));
    const c = document.getElementById('cmdid-card'), m = document.getElementById('maint-preview');
    const desc = Array.from(document.querySelectorAll('#cmdid-card ~ *, #maint-preview ~ *')).length >= 0 ? m.previousElementSibling : null;
    const aside = document.querySelector('.rr-detail-side');
    const rc = c.getBoundingClientRect(), rd = desc ? desc.getBoundingClientRect() : null, ra = aside ? aside.getBoundingClientRect() : null;
    return { prev: c.previousElementSibling && c.previousElementSibling.id, descHasText: !!(desc && /Description:/.test(desc.textContent)),
             below: rd ? rc.top >= rd.bottom - 1 : false, leftOfPhoto: ra ? rc.right <= ra.left + 1 : false, inMain: !!c.closest('.rr-detail-main'), h: rc.height };
  });
  // C — change, then clear them all
  R.c = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    showItemDetailPage(0, '101'); await S(80);
    document.getElementById('cmdid-show').click(); await S(40);
    const vals = Array.from(document.querySelectorAll('#cmdid-card input')).map(i => i.getAttribute('data-cmdid-key') + '=' + i.value).join(',');
    document.getElementById('cmdid-in-tmccId').value = '14'; await rrCmdIdSave(); await S(40);
    const changed = document.getElementById('cmdid-card').textContent.replace(/\s+/g, ' ');
    document.getElementById('cmdid-show').click(); await S(40);
    document.querySelectorAll('#cmdid-card input').forEach(i => { i.value = ''; });
    await rrCmdIdSave(); await S(60);
    const F = PERSONAL_FIELD_INDEX, row = window.__sheet[3];
    return { vals, changed, back: !!document.getElementById('cmdid-add'), card: !!document.querySelector('#cmdid-card .rr-cmdid-card'), cells: [row[F.tmccId], row[F.dcsId], row[F.dccAddress]].join('|'), toasts: window.__toasts.slice(-2) };
  });
  // G — never drawn as plain boxes
  R.g = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    state.personalData['101'].tmccId = '12'; state.personalData['101'].dcsId = '7'; state.personalData['101'].dccAddress = '3';
    showItemDetailPage(0, '101'); await S(100);
    const defs = (window._rrDetailFieldDefs || []).map(d => d.id).join(',');
    const pageText = document.getElementById('item-detail-content').textContent;
    let panel = '';
    try { showItemPanel(0, '101', 'edit'); await S(150); panel = (document.getElementById('item-panel') || document.body).textContent; } catch (e) { panel = 'ERR ' + e.message; }
    try { closeItemPanel && closeItemPanel(); } catch (e) {}
    const wiz = _wizUserFieldsHtml({});
    return { defs, gridLabel: /TMCC \/ Legacy ID|DCS ID|DCC Address/.test(pageText.replace(document.getElementById('cmdid-card').textContent, '')), panel: /TMCC \/ Legacy ID|DCS ID|DCC Address/.test(panel), wiz: /tmccId|dcsId|dccAddress/.test(wiz) };
  });
  // E — eras
  R.e = {};
  for (const [n, inv] of [['2343', '107'], ['262', '108'], ['6-84631', '109'], ['2344', '110']]) R.e[inv] = await spot(pg, n, inv);
  // D — the duplicate warning (the Lionel engine holds TMCC 12 / DCS 7 / DCC 3 from G)
  R.d = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const F = PERSONAL_FIELD_INDEX;
    try {
    showItemDetailPage(8, '111'); await S(80);
    document.getElementById('cmdid-add').click(); await S(40);
    document.getElementById('cmdid-in-tmccId').value = '12';
    window.__confirms.length = 0; window.__answers = [false];          // "Change this one"
    out.changeSaved = await rrCmdIdSave(); await S(40);
    out.msg = (window.__confirms[0] || {}).msg; out.ok = (window.__confirms[0] || {}).ok; out.cancel = (window.__confirms[0] || {}).cancel;
    out.stillOpen = !!document.getElementById('cmdid-in-tmccId');
    out.focus = document.activeElement && document.activeElement.id;
    out.notWritten = !(window.__sheet[13][F.tmccId]);
    window.__confirms.length = 0; window.__answers = [true];           // "Keep both"
    out.keepSaved = await rrCmdIdSave(); await S(60);
    out.written = window.__sheet[13][F.tmccId];
    out.note = (document.querySelector('#cmdid-card .rr-cmdid-clash') || {}).textContent || '';
    // another system: DCS 12 → silent
    document.getElementById('cmdid-show').click(); await S(30);
    document.getElementById('cmdid-in-dcsId').value = '12';
    window.__confirms.length = 0; window.__answers = [];
    await rrCmdIdSave(); await S(40);
    out.otherSystem = window.__confirms.length;
    // the same copy re-saved (unchanged TMCC 12, a new DCC) → silent about TMCC
    document.getElementById('cmdid-show').click(); await S(30);
    document.getElementById('cmdid-in-dccAddress').value = '44';
    window.__confirms.length = 0;
    await rrCmdIdSave(); await S(40);
    out.reSave = window.__confirms.length;
    // the accessory set to TMCC 12 (112) never warned the engines, and an accessory 12 vs engine 12 is silent
    showItemDetailPage(5, '106'); await S(60);
    document.getElementById('cmdid-add').click(); await S(30);
    document.getElementById('cmdid-in-tmccId').value = '7';
    window.__confirms.length = 0;
    await rrCmdIdSave(); await S(40);
    out.accVsEngine7 = window.__confirms.length;   // engine 101 is DCS 7, not TMCC 7; nothing on the track matters to an accessory anyway
    document.getElementById('cmdid-show').click(); await S(30);
    document.getElementById('cmdid-in-tmccId').value = '12';
    window.__confirms.length = 0; window.__answers = [true];
    await rrCmdIdSave(); await S(40);
    out.accVsAcc = window.__confirms.map(c => c.msg);
    } catch (e) { out.crash = String(e && e.stack || e).slice(0, 300); out.html = (document.getElementById('cmdid-card') || {}).innerHTML; out.toasts = window.__toasts.slice(-3); }
    return out;
  });
  // K — My Collection columns
  R.k = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    out.defaultVis = rrTableVisible('collection').join(',');
    const cols = rrTableCols('collection').filter(c => /^(tmccId|dcsId|dccAddress)$/.test(c.col));
    out.offered = cols.map(c => c.col + '=' + rrTableLabel('collection', c.col) + '|' + (rrTableHelp('collection', c.col) ? 'help' : 'NOHELP')).join(',');
    rrTableAddMenu('collection'); await S(30);
    out.menu = (document.getElementById('rr-addcol') || {}).textContent || '';
    const old = document.getElementById('rr-addcol'); if (old) old.remove();
    // drawn: My Collection, owned view
    showPage('browse'); state.filters.owned = true; state.filters.search = ''; _currentEra = 'all';
    renderBrowse(); await S(150);
    out.cellsBefore = document.querySelectorAll('#browse-tbody td[data-col="tmccId"]').length;
    rrTableAdd('collection', 'tmccId'); await S(60);
    renderBrowse(); await S(150);
    out.cellsAfter = Array.from(document.querySelectorAll('#browse-tbody td[data-col="tmccId"]')).map(td => td.textContent.trim()).filter(t => t && t !== '—').sort().join(',');
    out.switchOn = localStorage.getItem('undefined');
    out.stillNotAsked = rrEnabledUserFields().map(f => f.key).filter(k => /tmcc|dcs|dcc/i.test(k)).length;
    return out;
  });
  // S — search
  R.s = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const hit = async q => { state.filters.search = q; renderBrowse(); await S(60); return (state.filteredData || []).map(it => it.itemNum).sort().join(','); };
    const out = {};
    for (const q of ['ID 12', 'id 12', 'TMCC 12', 'Legacy 12', 'DCS 7', 'DCS 12', 'DCC 44', 'DCC 12', '12']) out[q] = await hit(q);
    state.filters.search = ''; renderBrowse();
    return out;
  });
  R.errs = errs.slice();
  await ctx.close();
  return R;
}

async function phoneSuite(browser) {
  const { pg, ctx, errs } = await open(browser, { phone: true });
  const r = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    showItemDetailPage(0, '101'); await S(150);
    const c = document.getElementById('cmdid-card');
    const out = { btn: !!(c && c.querySelector('#cmdid-add')), inputs: c ? c.querySelectorAll('input').length : -1 };
    const prev = c && c.previousElementSibling, next = c && c.nextElementSibling;
    out.prevIsDesc = !!(prev && /Description:/.test(prev.textContent));
    out.nextIsMaint = !!(next && next.id === 'maint-preview');
    const actions = document.querySelector('.rr-detail-actions');
    out.aboveButtons = !!(actions && c.getBoundingClientRect().bottom <= actions.getBoundingClientRect().top + 1);
    c.querySelector('#cmdid-add').click(); await S(50);
    out.inputsOpen = c.querySelectorAll('input').length;
    out.numericPad = Array.from(c.querySelectorAll('input')).every(i => i.getAttribute('inputmode') === 'numeric');
    const vw = document.documentElement.clientWidth;
    out.fits = Array.from(c.querySelectorAll('input, button')).every(el => el.getBoundingClientRect().right <= vw + 1);
    document.getElementById('cmdid-in-tmccId').value = '9'; await rrCmdIdSave(); await S(60);
    out.big = (c.querySelector('.rr-cmdid-num') || {}).textContent || '';
    out.noHScroll = document.documentElement.scrollWidth <= vw + 1;
    return out;
  });
  r.errs = errs.slice();
  await ctx.close();
  return r;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  const R = await pageSuite(browser);

  console.log('\n== A · clean until you tap ==');
  for (const n of Object.keys(R.a)) T('A ' + n + ' (Modern) shows ONLY the small "＋ Add command ID" button — no boxes, no empty card', R.a[n].btn && R.a[n].inputs === 0 && !R.a[n].card && /^＋ Add command ID$/.test(R.a[n].text), R.a[n]);

  console.log('\n== B · tap → boxes → big numbers ==');
  T('B1 tap → three boxes with Save and Cancel; Lionel "Legacy/CC" puts TMCC / Legacy first and says "Catalog: Legacy"', R.b.lionel.order === 'tmccId,dcsId,dccAddress' && R.b.lionel.hint === 'Catalog: Legacy' && R.b.lionel.save && R.b.lionel.cancel, R.b.lionel);
  T('B2 an MTH Proto-Sound engine opens with DCS first and says so', R.b.mth.order.split(',')[0] === 'dcsId' && /Catalog: Proto-Sound — DCS/.test(R.b.mth.hint), R.b.mth);
  T('B3 a Bachmann engine the catalog says nothing about: no hint, all three boxes', R.b.bach.hint === '' && R.b.bach.order.split(',').length === 3, R.b.bach);
  T('B4 saved → the numbers LARGE in the card: LEGACY / TMCC 12 and DCS 7 ("012" kept as 12)', R.b.big.length === 2 && /^LEGACY \/ TMCC 12 @/.test(R.b.big[0]) && /^DCS 7 @/.test(R.b.big[1]) && parseFloat(R.b.big[0].split('@')[1]) >= 36, R.b.big);
  T('B5 the sheet row carries them in the three END columns (Transferred From stays where it was)', R.b.lastThree === 'dcsId,tmccId,dccAddress' && R.b.cells.join('|') === '12|7|' && R.b.pd.join('|') === '12|7', R.b);
  T('B6 …written in one run of those columns only — no other cell touched', R.b.writes.length === 1 && new RegExp('!' + R.b.letters[0] + '3:' + R.b.letters[1] + '3$').test(R.b.writes[0]) && R.b.otherCellsSame, R.b.writes);
  T('B7 a first ID on a copy with no clash asks nothing', R.b.confirms === 0);

  console.log('\n== L · in the spot Brad marked ==');
  T('L1 computer: in the left column, under the Description card and the Maintenance slot, beside (left of) the photo', R.l.prev === 'maint-preview' && R.l.descHasText && R.l.below && R.l.leftOfPhoto && R.l.inMain, R.l);

  console.log('\n== C · change, clear ==');
  T('C1 tap the numbers → the boxes hold what is saved', /tmccId=12/.test(R.c.vals) && /dcsId=7/.test(R.c.vals), R.c.vals);
  T('C2 changed → the card shows the new number', /LEGACY \/ TMCC\s*14/.test(R.c.changed), R.c.changed);
  T('C3 cleared all → the small button is back and the sheet cells are blank', R.c.back && !R.c.card && R.c.cells === '||', R.c);

  console.log('\n== G · the card is the only way in ==');
  T('G1 the Details grid and Edit fields never list the IDs', !/uf_(tmccId|dcsId|dccAddress)/.test(R.g.defs) && !R.g.gridLabel, R.g);
  T('G2 Update Info has no plain ID boxes', !R.g.panel);
  T('G3 the Add steps\' plain fields never draw them', !R.g.wiz);

  console.log('\n== E · Modern only ==');
  T('E1 a Postwar item: nothing at all', R.e['107'].html === '', R.e['107']);
  T('E2 a Pre-war item: nothing at all', R.e['108'].html === '', R.e['108']);
  T('E3 a Modern-numbered item whose era was set to Postwar by hand: nothing', R.e['109'].html === '', R.e['109']);
  T('E4 a Postwar copy that already holds an ID still shows its card', R.e['110'].card && /LEGACY \/ TMCC\s*5/.test(R.e['110'].text), R.e['110']);

  console.log('\n== D · the duplicate warning ==');
  T('D1 same system, both on the track → "Your 6-84631 Santa Fe Diesel is also set to TMCC / Legacy 12. Both will answer the remote."', /^Your 6-84631 Santa Fe Diesel is also set to TMCC \/ Legacy 12\. Both will answer the remote\.$/.test(R.d.msg || '') && R.d.ok === 'Keep both' && R.d.cancel === 'Change this one', R.d);
  T('D2 "Change this one" → nothing saved, the boxes stay open on that box', R.d.changeSaved === false && R.d.stillOpen && R.d.focus === 'cmdid-in-tmccId' && R.d.notWritten, R.d);
  T('D3 "Keep both" → saved (it never blocks), and the card notes the clash under the number', R.d.keepSaved === true && R.d.written === '12' && /Also on your 6-84631 Santa Fe Diesel$/.test(R.d.note.trim()), R.d);
  T('D4 DCS 12 against a TMCC 12 → silent (another system)', R.d.otherSystem === 0, R.d);
  T('D5 the same copy re-saved → silent', R.d.reSave === 0, R.d);
  T('D6 an accessory is never warned about an engine; it IS warned about another accessory with its number', R.d.accVsEngine7 === 0 && R.d.accVsAcc.length === 1 && /6-14200/.test(R.d.accVsAcc[0]) && !/6-84631/.test(R.d.accVsAcc[0]), R.d);

  console.log('\n== K · My Collection columns ==');
  T('K1 none of the three is shown by default', !/tmccId|dcsId|dccAddress/.test(R.k.defaultVis), R.k.defaultVis);
  T('K2 "+ Add a column" offers each, with its own words and one-line help', R.k.offered === 'tmccId=TMCC / Legacy ID|help,dcsId=DCS ID|help,dccAddress=DCC Address|help' && /TMCC \/ Legacy ID/.test(R.k.menu) && /DCS ID/.test(R.k.menu) && /DCC Address/.test(R.k.menu), R.k);
  T('K3 added → the column shows the saved values (before: no such cells)', R.k.cellsBefore === 0 && R.k.cellsAfter === '12,12,12,12,5', R.k);
  T('K4 adding the column turns on no switch (the Add steps still never ask in a plain box)', R.k.stillNotAsked === 0);

  console.log('\n== S · search ==');
  T('S1 "ID 12" / "id 12" find every copy set to 12 on any system', R.s['ID 12'] === '6-14111,6-14200,6-84631,6-84632' && R.s['id 12'] === R.s['ID 12'], R.s);
  T('S2 "TMCC 12" and "Legacy 12" find the TMCC / Legacy 12s', R.s['TMCC 12'] === '6-14111,6-14200,6-84631,6-84632' && R.s['Legacy 12'] === R.s['TMCC 12'], R.s);
  T('S3 "DCS 7" finds the DCS 7; "DCS 12" the DCS 12; "DCC 44" the DCC 44; "DCC 12" nothing', R.s['DCS 7'] === '6-84631' && R.s['DCS 12'] === '6-84632' && R.s['DCC 44'] === '6-84632' && R.s['DCC 12'] === '', R.s);
  T('S4 a bare "12" does NOT match IDs (it is an item-number search)', !/6-84631|6-84632|6-14111|6-14200/.test(R.s['12']), R.s['12']);
  T('Z  no page errors', R.errs.length === 0, R.errs);

  console.log('\n== L2 · as an iPhone ==');
  const ph = await phoneSuite(browser);
  T('L2 phone: right under the Description card, above the buttons, before the Maintenance slot', ph.btn && ph.inputs === 0 && ph.prevIsDesc && ph.nextIsMaint && ph.aboveButtons, ph);
  T('L3 phone: tap → three number-pad boxes that fit the screen; save → the big number; no sideways scroll', ph.inputsOpen === 3 && ph.numericPad && ph.fits && /LEGACY \/ TMCC\s*9/.test(ph.big) && ph.noHScroll, ph);
  T('Z  no page errors on the phone', ph.errs.length === 0, ph.errs);

  console.log('\n== P · planted: each piece undone in a served copy ==');
  {
    const ac = read('app-collection.js');
    const noSlot = ac.replace("_descBlock + _maintSlot + _cmdSlot}", "_descBlock + _maintSlot}");
    const plantedA = noSlot !== ac ? await (async () => { const { pg, ctx } = await open(browser, { swap: { 'app-collection.js': noSlot } }); const r = await spot(pg, '6-29000', '104'); await ctx.close(); return r; })() : null;
    T('P1 the card slot taken off the item page → the Modern boxcar check (A) goes red', !!plantedA && !plantedA.btn, plantedA);
    const br = read('browse.js');
    const noSearch = br.replace("var _cmdQ = (typeof rrCmdIdQuery === 'function') ? rrCmdIdQuery(state.filters.search || '') : null;", 'var _cmdQ = null;');
    const plantedS = noSearch !== br ? await (async () => {
      const { pg, ctx } = await open(browser, { swap: { 'browse.js': noSearch } });
      const r = await pg.evaluate(async () => { state.personalData['101'].tmccId = '12'; showPage('browse'); state.filters.owned = true; _currentEra = 'all'; state.filters.search = 'ID 12'; renderBrowse(); await new Promise(r => setTimeout(r, 120)); return (state.filteredData || []).map(it => it.itemNum).join(','); });
      await ctx.close(); return r;
    })() : 'not planted';
    T('P2 the search hook taken out → "ID 12" finds nothing (S1 goes red)', plantedS !== 'not planted' && !/6-84631/.test(plantedS), plantedS);
    const tc = read('table-columns.js');
    const byDefault = tc.replace("spec.defaults = spec.defaults || spec.cols.map(function (c) { return c.col; });", "spec.defaults = (spec.defaults || spec.cols.map(function (c) { return c.col; })).concat(spec.id === 'collection' ? ['tmccId'] : []);");
    const plantedK = byDefault !== tc ? await (async () => { const { pg, ctx } = await open(browser, { swap: { 'table-columns.js': byDefault } }); const r = await pg.evaluate(() => rrTableVisible('collection').join(',')); await ctx.close(); return r; })() : '';
    T('P3 the IDs shown by default → K1 goes red', /tmccId/.test(plantedK), plantedK);
  }

  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s)');
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
