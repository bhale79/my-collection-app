#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SCAN TO SHELVE FOR PRO (part 1) — v0.9.2041                 (real Chromium)
//
// TRR Pro release 3 (BUILD_PLAN_2026-10-28_TRR_PRO.md; design agreed with
// Brad 2026-10-28, Step 2): "What's on this shelf"; Shelf check (scan a shelf
// + everything on it → missing / recorded elsewhere); the label size chosen
// once ("be generic and let the user pick their own" printer and labels) and
// the PDF made to that exact size; Track Storage Location switched on by
// Scan to Shelve itself.
//   W1  rrShelveItemsAt: a spot = that spot only; a place = everything in it;
//       spaces and capitals do not matter; only owned copies with a row
//   W2  scan a shelf with no item → "What's here (n)" → the list of THAT shelf
//   W3  ...and the button goes once an item is saved there
//   K1  Shelf check: an item before a shelf is refused; shelf → items ticked
//       off; an unknown sticker asks NOTHING; Done → missing (with "no
//       sticker paired"), recorded elsewhere (with where), found; NOTHING written
//   K2  Move here = the one location writer, once, even pressed twice
//   K3  another shelf in the middle of a check: told, the check stays on its shelf
//   K4  Storage Locations has a Shelf check button
//   L1  the label size: one reader, one writer; default = the 30-up sheet;
//       a custom size outside the limits is refused and nothing changes
//   L2  the PDF page is the label's exact size (roll 2×1, 4×6 portrait,
//       custom 6×4 landscape), one label a page; the QR sits inside the label
//   L3  the print screen shows the saved size, saves a change at once, hides
//       "labels already used" for a one-label size, refuses a bad custom size
//   M1  the Movement Log line: When, Inventory ID, Item Number, Item, From,
//       To, Who, How — numbers and the time kept as text
//   M2  the first move: sheet BACKED UP → tab made → headings → the line
//       appended; the second move: just the line
//   M3  no backup → no tab, no line — and the move itself still saved
//   M4  a failed read of the sheet is not "missing": no tab made
//   M5  no move (same shelf) → no line; undo and Move here say so in How
//   M6  offline: a sheet whose log is known queues its line; an unknown one
//       asks nothing and writes nothing
//   M7  the item page's Movement history: this copy's lines only, newest first
//   M8  scan: the log is only ever APPENDED to (no update past the heading
//       rows, no clear, no delete) and its name is registered once
//   X*  PLANTED: the check writes on scan (K1), Move here without its guard
//       (K2), the reader ignoring the setting (L2), no backup before the tab
//       (M2), an edit of a log line (M8)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  scan_shelve_pro_2041_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const JSPDF = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
if (!fs.existsSync(JSPDF)) { console.log('FAILED  —  scan_shelve_pro_2041_tests needs node_modules/jspdf (npm install).'); process.exit(1); }
const SHELVE = rd('scan-shelve.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.split(from).join(to);
}

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.errs = errs;
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[\d.]+\/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: fs.readFileSync(JSPDF, 'utf8'), contentType: 'application/javascript' });
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => {
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.personalSheetId = 'sheet-brad-1';
    state.masterData = [{ itemNum: '6464-1', roadName: 'Western Pacific', itemType: 'Boxcar', variation: '' },
                        { itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel', variation: '' },
                        { itemNum: '671', roadName: 'Pennsylvania', itemType: 'Steam', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    const mk = (inv, num, row, extra) => Object.assign({ inventoryId: inv, itemNum: num, variation: '', owned: true, condition: 8, row: row, location: '', locationDetail: '', stickerCode: '' }, extra || {});
    state.personalData = {
      '101': mk('101', '6464-1', 3, { location: 'Garage', locationDetail: 'Shelf 4', stickerCode: 'STK-101' }),
      '102': mk('102', '2343', 4, { location: ' garage ', locationDetail: 'shelf 4' }),                      // same shelf, other spelling, no sticker
      '103': mk('103', '2343', 5, { location: 'Basement', locationDetail: 'Tote 2' }),
      '104': mk('104', '671', 6, { location: 'Garage', locationDetail: 'Shelf 5' }),
      '105': mk('105', '671', 7, { location: 'Garage', locationDetail: 'Shelf 4', owned: false }),          // not owned (a want-list row)
    };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    _prefSet('lv_location_enabled', 'true');
    rrSaveLocations([{ name: 'Garage', type: 'Room', details: ['Shelf 4', 'Shelf 5'] }, { name: 'Basement', type: 'Room', details: ['Tote 2'] }]);
    window.__w = []; window.__toasts = []; window.__rects = []; window.__saved = null; window.__docs = [];
    window.rrRowStillIs = async function () { return true; };
    window.sheetsUpdate = async function (id, range, values) { window.__w.push({ range: range, v: values[0][0] }); await new Promise(z => setTimeout(z, 30)); return {}; };
    window._cachePersonalData = function () {};
    window.appConfirm = async function () { return true; };
    const _t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    window.__wait = ms => new Promise(z => setTimeout(z, ms));
    window.__col = f => personalColLetter(f);
    if (window.jspdf && window.jspdf.jsPDF) {
      const Real = window.jspdf.jsPDF;
      window.jspdf.jsPDF = function (o) {
        const d = new Real(o); const rect = d.rect.bind(d);
        d.rect = function (x, y, w, h, s) { window.__rects.push([d.getCurrentPageInfo().pageNumber, x, y, w, h]); return rect(x, y, w, h, s); };
        d.save = function (n) { window.__saved = { name: n, pages: d.getNumberOfPages() }; return d; };
        window.__docs.push(d);
        return d;
      };
    }
  });
  return pg;
}
const PLACE = c => 'RR1:P:' + encodeURIComponent(c[0]) + ':' + encodeURIComponent(c[1] || '');

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let pg = await boot(browser);

  console.log('== W · what is on this shelf ==');
  const w1 = await pg.evaluate(() => ({
    spot: rrShelveItemsAt({ loc: 'Garage', spot: 'Shelf 4' }).sort(),
    place: rrShelveItemsAt({ loc: 'GARAGE', spot: '' }).sort(),
    none: rrShelveItemsAt({ loc: 'Attic', spot: '' }),
    blank: rrShelveItemsAt({ loc: '', spot: '' }),
  }));
  T('W0 no script error', pg.errs.length === 0, pg.errs);
  T('W1 a spot = that spot only (spelling and spaces do not matter), owned copies only', JSON.stringify(w1.spot) === '["101","102"]', w1);
  T('W1b a place = everything in it, whatever spot', JSON.stringify(w1.place) === '["101","102","104"]', w1);
  T('W1c an empty place / no place → nothing', w1.none.length === 0 && w1.blank.length === 0, w1);
  const w2 = await pg.evaluate(async (code) => {
    rrShelveOpen(); await __wait(150);
    await rrShelveCode(code);
    const btn = document.getElementById('rr-shelve-herebtn');
    const r = { btn: btn && btn.textContent };
    btn.click(); await __wait(80);
    const list = document.getElementById('rr-shelve-ask');
    r.title = list && list.querySelector('#rr-shelve-herelist').textContent;
    r.lines = list ? list.textContent : '';
    list.querySelector('[data-sh-x]').click();
    await rrShelveCode('STK-101'); await __wait(80);         // item → saved on Shelf 4
    r.after = document.getElementById('rr-shelve-here').innerHTML;
    r.saved = document.getElementById('rr-shelve-status').textContent;
    rrShelveClose();
    return r;
  }, PLACE(['Garage', 'Shelf 4']));
  T('W2 a shelf scanned with no item → "What\'s here (2)"', w2.btn === 'What’s here (2)', w2);
  T('W2b ...lists THAT shelf: both copies, not Shelf 5, not the Basement', /On Garage › Shelf 4/.test(w2.title) && /#101/.test(w2.lines) && /#102/.test(w2.lines) && !/#104/.test(w2.lines) && !/#103/.test(w2.lines), w2);
  T('W3 ...and the button goes once an item is saved there', w2.after === '' && /✓/.test(w2.saved), w2);

  console.log('\n== K · shelf check ==');
  const tag = await pg.evaluate(() => rrStickerAppCodeItem(state.personalData['103']).split(':')[2]);
  const k1fn = p => p.evaluate(async (codes) => {
    __w.length = 0;
    rrShelveOpen({ kind: 'check' }); await __wait(150);
    const r = {};
    r.title = document.querySelector('#rr-shelve strong').textContent;
    await rrShelveCode('STK-101'); r.itemFirst = document.getElementById('rr-shelve-status').textContent;
    await rrShelveCode(codes.shelf4); r.afterShelf = document.getElementById('rr-shelve-status').textContent;
    r.doneShown = document.getElementById('rr-shelve-checkdone').style.display !== 'none';
    await rrShelveCode('STK-101');
    await rrShelveCode(codes.item103);
    await rrShelveCode('NEVER-SEEN-STICKER');
    r.asked = !!document.getElementById('rr-shelve-ask');
    await rrShelveCode(codes.shelf5); r.otherShelf = document.getElementById('rr-shelve-status').textContent;
    r.log = document.getElementById('rr-shelve-checklog').textContent;
    document.getElementById('rr-shelve-checkdone').click(); await __wait(120);
    const res = document.getElementById('rr-shelve-checkresult');
    r.head = res.textContent;
    r.missing = [...res.querySelectorAll('[data-sh-missing]')].map(e => e.getAttribute('data-sh-missing') + '|' + e.textContent);
    r.elsewhere = [...res.querySelectorAll('[data-sh-else]')].map(e => e.getAttribute('data-sh-else') + '|' + e.textContent);
    r.found = [...res.querySelectorAll('[data-sh-found]')].map(e => e.getAttribute('data-sh-found'));
    r.writes = __w.slice();
    // K2: Move here, pressed twice
    const mv = res.querySelector('[data-sh-movehere="103"]');
    if (mv) { mv.click(); mv.click(); await __wait(250); }
    r.moveWrites = __w.slice();
    r.moved = res.textContent;
    r.loc103 = state.personalData['103'].location + ' › ' + state.personalData['103'].locationDetail;
    document.getElementById('rr-shelve-ask').remove(); rrShelveClose();
    // put 103 back for the next run
    state.personalData['103'].location = 'Basement'; state.personalData['103'].locationDetail = 'Tote 2';
    return r;
  }, { shelf4: PLACE(['Garage', 'Shelf 4']), shelf5: PLACE(['Garage', 'Shelf 5']), item103: 'RR1:I:' + tag + ':103' });
  const k = await k1fn(pg);
  T('K1 the screen says Shelf check', k.title === 'Shelf check', k);
  T('K1b an item before a shelf → "Scan the shelf first", nothing ticked', /Scan the shelf first/.test(k.itemFirst), k);
  T('K1c the shelf → "Now scan every item on Garage › Shelf 4", Done shown', /Now scan every item on Garage › Shelf 4/.test(k.afterShelf) && k.doneShown, k);
  T('K1d an unknown sticker asks NOTHING (no "new sticker" question)', k.asked === false, k);
  T('K3 another shelf mid-check → told to finish first; the check stays on Shelf 4', /another shelf/.test(k.otherShelf) && /Garage › Shelf 4/.test(k.head), k);
  T('K1e result: recorded here but not scanned = 102, marked "no sticker paired"', k.missing.length === 1 && /^102\|/.test(k.missing[0]) && /no sticker paired/.test(k.missing[0]), k.missing);
  T('K1f result: scanned here but recorded elsewhere = 103 "recorded at Basement › Tote 2"', k.elsewhere.length === 1 && /^103\|/.test(k.elsewhere[0]) && /recorded at Basement › Tote 2/.test(k.elsewhere[0]), k.elsewhere);
  T('K1g result: found = 101', JSON.stringify(k.found) === '["101"]', k.found);
  T('K1h NOTHING was written during the check', k.writes.length === 0, k.writes);
  const locCol = await pg.evaluate(() => __col('location')), detCol = await pg.evaluate(() => __col('locationDetail'));
  const mw = k.moveWrites.map(w => w.range.replace(/\d+$/, '') + '=' + w.v);
  T('K2 Move here writes Location + Location Detail on 103\'s row ONCE (pressed twice)', k.moveWrites.length === 2 && mw[0] === 'My Collection!' + locCol + '=Garage' && mw[1] === 'My Collection!' + detCol + '=Shelf 4', mw);
  T('K2b ...says so, and the record now holds it', /now recorded here/.test(k.moved) && k.loc103 === 'Garage › Shelf 4', k);
  const k4 = await pg.evaluate(async () => {
    _openLocationsModal(); await __wait(200);
    const top = document.getElementById('rr-shelve-top');
    const btn = top && [...top.querySelectorAll('button')].find(b => b.textContent === 'Shelf check');
    const r = { has: !!btn };
    if (btn) { btn.click(); await __wait(150); r.opened = document.querySelector('#rr-shelve strong') && document.querySelector('#rr-shelve strong').textContent; rrShelveClose(); }
    document.getElementById('loc-setup-modal').remove();
    return r;
  });
  T('K4 Storage Locations has a Shelf check button that opens it', k4.has && k4.opened === 'Shelf check', k4);

  console.log('\n== L · the label size ==');
  const l1 = await pg.evaluate(() => {
    const r = {};
    r.def = rrShelveLabelTpl().id;
    r.setRoll = rrShelveSetLabelSize('roll2x1'); r.roll = rrShelveLabelTpl();
    r.setCustom = rrShelveSetLabelSize('custom', '3', '2'); r.custom = rrShelveLabelTpl();
    r.bad = rrShelveSetLabelSize('custom', '20', '1'); r.afterBad = rrShelveLabelTpl();
    r.unknown = rrShelveSetLabelSize('nope'); r.afterUnknown = rrShelveLabelTpl().id;
    r.saved = rrPrefRead(RR_SHELVE.sizeKey);
    rrShelveSetLabelSize('avery5160');
    return r;
  });
  T('L1 default = the 30-up sheet', l1.def === 'avery5160', l1);
  T('L1b roll 2×1 → one label a page, exactly 2×1', l1.setRoll && l1.roll.one && l1.roll.pageW === 2 && l1.roll.pageH === 1 && l1.roll.w === 2 && l1.roll.h === 1, l1.roll);
  T('L1c custom 3×2 saved and read back', l1.setCustom && l1.custom.id === 'custom' && l1.custom.pageW === 3 && l1.custom.pageH === 2, l1.custom);
  T('L1d custom 20×1 (outside the limits) refused — the 3×2 still stands', l1.bad === false && l1.afterBad.pageW === 3, l1);
  T('L1e an unknown size refused', l1.unknown === false && l1.afterUnknown === 'custom', l1);
  T('L1f ONE account setting holds it', /"id":"custom"/.test(l1.saved || ''), l1.saved);

  const pdfFor = (p, id, w, h) => p.evaluate(async (a) => {
    rrShelveSetLabelSize(a.id, a.w, a.h);
    window.__rects = []; window.__docs = [];
    const e = rrShelveLabelEntries('places', [{ loc: 'Garage', spot: 'Shelf 4' }, { loc: 'Garage', spot: 'Shelf 5' }, { loc: 'Basement', spot: 'Tote 2' }]);
    const made = await rrShelveLabelsPdf(e, 7);
    const d = made.doc, pages = [];
    for (let i = 1; i <= d.getNumberOfPages(); i++) { d.setPage(i); pages.push([+d.internal.pageSize.getWidth().toFixed(3), +d.internal.pageSize.getHeight().toFixed(3)]); }
    const t = made.tpl;
    const outside = window.__rects.filter(([pg, x, y, w, h]) => x < -1e-6 || y < -1e-6 || x + w > t.w + 1e-6 || y + h > t.h + 1e-6).length;
    rrShelveSetLabelSize('avery5160');
    return { pages, n: made.pages, rects: window.__rects.length, outside, stack: !!t.stack, qr: t.qr };
  }, { id, w, h });
  const roll = await pdfFor(pg, 'roll2x1');
  T('L2 roll 2×1: three labels → three pages, each exactly 2″ × 1″ ("already used" ignored)', roll.n === 3 && roll.pages.every(p => p[0] === 2 && p[1] === 1), roll);
  T('L2b ...every QR square inside the label', roll.rects > 0 && roll.outside === 0, roll);
  const ship = await pdfFor(pg, 'label4x6');
  T('L2c 4″ × 6″: portrait pages 4 wide, 6 tall; QR on top (stacked), inside the label', ship.pages.every(p => p[0] === 4 && p[1] === 6) && ship.stack && ship.outside === 0 && ship.qr > 1.5, ship);
  const wide = await pdfFor(pg, 'custom', '6', '4');
  T('L2d custom 6″ × 4″: landscape pages 6 wide, 4 tall; inside the label', wide.pages.every(p => p[0] === 6 && p[1] === 4) && wide.outside === 0, wide);
  const sheet = await pdfFor(pg, 'avery5160');
  T('L2e the 30-up sheet is unchanged: one US Letter page', sheet.n === 1 && sheet.pages[0][0] === 8.5 && sheet.pages[0][1] === 11, sheet);

  const l3 = await pg.evaluate(async () => {
    rrShelveSetLabelSize('roll2x1');
    rrShelvePrintOpen('places'); await __wait(150);
    const ov = document.getElementById('rr-shelve-print');
    const r = { shown: ov.querySelector('#rr-print-size').value, skipHidden: ov.querySelector('#rr-print-skipwrap').style.display === 'none', help: ov.querySelector('#rr-print-help').textContent };
    const sel = ov.querySelector('#rr-print-size');
    sel.value = 'avery5160'; sel.dispatchEvent(new Event('change')); await __wait(50);
    r.afterSheet = rrShelveLabelTpl().id; r.skipBack = ov.querySelector('#rr-print-skipwrap').style.display !== 'none';
    sel.value = 'custom'; sel.dispatchEvent(new Event('change')); await __wait(50);
    ov.querySelector('#rr-print-cw').value = '30'; ov.querySelector('#rr-print-ch').value = '1';
    window.__saved = null;
    ov.querySelector('#rr-print-go').click(); await __wait(600);
    r.badHelp = ov.querySelector('#rr-print-help').textContent; r.badFile = window.__saved; r.badKept = rrShelveLabelTpl().id;
    ov.querySelector('#rr-print-cw').value = '3'; ov.querySelector('#rr-print-ch').value = '2';
    ov.querySelector('#rr-print-go').click(); await __wait(900);
    r.goodFile = window.__saved; r.goodTpl = rrShelveLabelTpl();
    ov.remove(); rrShelveSetLabelSize('avery5160');
    return r;
  });
  T('L3 the print screen shows the saved size; "labels already used" hidden for a roll; roll help words', l3.shown === 'roll2x1' && l3.skipHidden && /One label per page, 2″ × 1″/.test(l3.help), l3);
  T('L3b a change is saved at once; the sheet brings "already used" back', l3.afterSheet === 'avery5160' && l3.skipBack, l3);
  T('L3c a custom 30″ wide → the limits are named, NO file, the setting unchanged', /from 1 to 8.5 inches/.test(l3.badHelp) && !l3.badFile && l3.badKept === 'avery5160', l3);
  T('L3d custom 3×2 → saved and the file made: 5 places ticked = 5 pages (one label each)', l3.goodFile && l3.goodFile.pages === 5 && l3.goodTpl.pageW === 3, l3);
  T('L0 no script error on the page', pg.errs.length === 0, pg.errs);

  console.log('\n== M · the Movement Log ==');
  const mlog = (p, o) => p.evaluate(async (o) => {
    window.__calls = [];
    accessToken = 'tok'; window.rrPassLapsed = function () { return false; };
    window._shMoveOk = {};                               // each case starts on a device that has not seen the tab this session
    window.backupCreateAuto = async function (r) { __calls.push('backup:' + r); if (o.backupFails) throw new Error('drive down'); return { id: 'b1' }; };
    window.sheetsAppend = async function (sid, range, values) { __calls.push('append:' + range + ':' + JSON.stringify(values[0])); return 9; };
    const realUpd = window.sheetsUpdate;
    window.sheetsUpdate = async function (sid, range, values) { if (/Movement Log/.test(range)) __calls.push('head:' + range + ':' + values[0][0]); return realUpd.apply(this, arguments); };
    window.fetch = async function (url, opts) {
      const u = String(url);
      // only calls made from scan-shelve.js count (the Workbench reads the same sheet list in the background)
      const mine = /scan-shelve\.js/.test(String(new Error().stack));
      if (/\?fields=sheets\.properties/.test(u)) { if (mine) __calls.push('meta'); return { ok: !o.metaFails, status: o.metaFails ? 500 : 200, json: async () => (o.metaFails ? { error: { code: 403 } } : { sheets: [{ properties: { title: 'My Collection' } }].concat(o.tabThere ? [{ properties: { title: 'Movement Log' } }] : []) }) }; }
      if (/:batchUpdate/.test(u)) { if (mine) __calls.push('addSheet:' + JSON.parse(opts.body).requests[0].addSheet.properties.title); return { ok: true, status: 200, json: async () => ({}) }; }
      return { json: async () => ({}) };
    };
    window._offlineMode = !!o.offline;
    if (o.known) localStorage.setItem(RR_MOVE_LOG.okKey, JSON.stringify([state.personalSheetId])); else localStorage.removeItem(RR_MOVE_LOG.okKey);
    __w.length = 0;
    const pd = state.personalData['104'];
    pd.location = 'Garage'; pd.locationDetail = 'Shelf 5';
    const r = {};
    r.ok = await rrShelveSaveLocation('104', o.to || { loc: 'Basement', spot: 'Tote 2' }, o.how);
    r.loc = pd.location + ' › ' + pd.locationDetail;
    if (o.twice) await rrShelveSaveLocation('104', { loc: 'Garage', spot: 'Shelf 4' }, 'scan');
    // the Workbench (owners) reads the same sheet list in the background: leave its calls out
    r.calls = []; __calls.forEach(c => { if (/^addSheet:/.test(c) && c !== 'addSheet:Movement Log') { if (r.calls[r.calls.length - 1] === 'meta') r.calls.pop(); return; } r.calls.push(c); });
    r.writes = __w.filter(w => /^My Collection!/.test(w.range));   // the Workbench writes its own tab in the background here
    window._offlineMode = false;
    return r;
  }, o);
  const m1 = await pg.evaluate(() => rrMoveLogRow(state.personalData['102'], { loc: 'Garage', spot: 'Shelf 4' }, { loc: '', spot: '' }, 'check', new Date(2026, 9, 29, 1, 5), 'brad@x.com'));
  T('M1 the line: When, Inventory ID, Item Number, Item, From, To, Who, How', m1.length === 8 && m1[0] === "'2026-10-29 01:05" && m1[1] === "'102" && m1[2] === "'2343" && /2343/.test(m1[3])
    && m1[4] === 'Garage › Shelf 4' && m1[5] === '(no location)' && m1[6] === 'brad@x.com' && m1[7] === 'Shelf check', m1);
  T('M1b the headings are the line\'s columns, in order', await pg.evaluate(() => JSON.stringify(RR_MOVE_LOG.headers)) === JSON.stringify(['When', 'Inventory ID', 'Item Number', 'Item', 'From', 'To', 'Who', 'How']));
  const m2 = await mlog(pg, { twice: true });
  const order = m2.calls.map(c => c.split(':')[0]);
  T('M2 the first move: meta read → BACKUP → tab made → headings → the line', JSON.stringify(order.slice(0, 5)) === JSON.stringify(['meta', 'backup', 'addSheet', 'head', 'append'])
    && m2.calls[1] === 'backup:before-movement-log' && m2.calls[2] === 'addSheet:Movement Log' && /^head:Movement Log!A1:H2:When$/.test(m2.calls[3]), m2.calls);
  T('M2b ...the line says from Garage › Shelf 5 to Basement › Tote 2, by Scan to Shelve', /Garage › Shelf 5","Basement › Tote 2","bhale@ipd-llc.com","Scan to Shelve"\]$/.test(m2.calls[4]), m2.calls[4]);
  T('M2c the second move: just its line (no second backup, no second tab)', order.slice(5).join(',') === 'append' && m2.calls.filter(c => /^backup/.test(c)).length === 1, m2.calls);
  const m3 = await mlog(pg, { backupFails: true });
  T('M3 no backup → no tab, no line', !m3.calls.some(c => /^addSheet|^append|^head/.test(c)), m3.calls);
  T('M3b ...and the move itself is still saved', m3.ok && m3.loc === 'Basement › Tote 2' && m3.writes.length === 2, m3);
  const m4 = await mlog(pg, { metaFails: true });
  T('M4 a failed read of the sheet → nothing made, no backup', JSON.stringify(m4.calls) === '["meta"]' && m4.ok, m4.calls);
  const m5a = await mlog(pg, { tabThere: true, to: { loc: 'garage', spot: 'SHELF 5' } });
  T('M5 the same shelf (any spelling) → no line', !m5a.calls.some(c => /^append/.test(c)), m5a.calls);
  const m5b = await mlog(pg, { tabThere: true, how: 'undo' });
  const m5c = await mlog(pg, { tabThere: true, how: 'check' });
  T('M5b a tab already there: no backup, no new tab; undo and Move here say so in How', !m5b.calls.some(c => /^backup|^addSheet/.test(c)) && /Scan to Shelve — undo"\]$/.test(m5b.calls.find(c => /^append/.test(c)) || '') && /"Shelf check"\]$/.test(m5c.calls.find(c => /^append/.test(c)) || ''), [m5b.calls, m5c.calls]);
  const m6a = await mlog(pg, { offline: true, known: true });
  const m6b = await mlog(pg, { offline: true, known: false });
  T('M6 offline, log known on this device → the line is queued (sheetsAppend), nothing asked of Google', m6a.calls.length === 1 && /^append/.test(m6a.calls[0]), m6a.calls);
  T('M6b offline, log not known → nothing asked, nothing written (the move still saved)', m6b.calls.length === 0 && m6b.ok, m6b);
  const m7 = await pg.evaluate(async () => {
    window.sheetsGet = async function (sid, range) {
      return { values: [["'2026-10-01 09:00", "'104", "'671", 'x', '(no location)', 'Garage › Shelf 5', 'a@x', 'Scan to Shelve'],
                        ["'2026-10-02 10:00", "'102", "'2343", 'x', 'Garage', 'Basement', 'a@x', 'Scan to Shelve'],
                        ["'2026-10-03 11:00", "'104", "'671", 'x', 'Garage › Shelf 5', 'Basement › Tote 2', 'b@x', 'Shelf check']] };
    };
    const d = await rrShelveHistory('104');
    const lines = [...d.querySelectorAll('[data-move-line]')].map(e => e.textContent);
    const title = d.querySelector('#rr-move-history').textContent; d.remove();
    const html = rrShelveItemLineHtml(state.personalData['104'], '104');
    return { lines, title, btn: /rrShelveHistory\('104'\)/.test(html) && /Movement history/.test(html) };
  });
  T('M7 Movement history: this copy\'s two lines only, newest first', m7.lines.length === 2 && /2026-10-03/.test(m7.lines[0]) && /Basement › Tote 2/.test(m7.lines[0]) && /2026-10-01/.test(m7.lines[1]), m7);
  T('M7b the item page line has the Movement history button', m7.btn, m7);
  const appendOnly = (srcs) => {
    const bad = [];
    Object.keys(srcs).forEach(f => srcs[f].split('\n').forEach((ln, i) => {
      if (/^\s*\/\//.test(ln)) return;
      const code = ln.replace(/\/\/.*$/, '');
      if (/['"]Movement Log/.test(code) && code.trim() !== "var _SH_MOVE_TAB = (typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Movement Log');") bad.push(f + ':' + (i + 1) + ' ' + ln.trim());
      if (!/_SH_MOVE_TAB/.test(code)) return;
      const ok = /^var _SH_MOVE_TAB = \(typeof rrFeatureTab/.test(code.trim())
        || /sheetsAppend\(sid, _SH_MOVE_TAB \+ '!A:H'/.test(code)
        || /sheetsUpdate\(sid, _SH_MOVE_TAB \+ '!A1:H2'/.test(code)
        || /sheetsGet\(state\.personalSheetId, _SH_MOVE_TAB \+ '!A3:H'\)/.test(code)
        || /title === _SH_MOVE_TAB/.test(code)
        || /addSheet: \{ properties: \{ title: _SH_MOVE_TAB/.test(code);
      if (!ok) bad.push(f + ':' + (i + 1) + ' ' + ln.trim());
    }));
    return bad;
  };
  const all = {}; fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { all[f] = rd(f); });
  const clean = appendOnly(all);
  T('M8 the Movement Log is only ever appended to; its name registered once', clean.length === 0, clean);
  const pl1 = appendOnly(Object.assign({}, all, { 'scan-shelve.js': all['scan-shelve.js'] + "\nasync function _x(r) { await sheetsUpdate(state.personalSheetId, _SH_MOVE_TAB + '!A' + r + ':H' + r, [['edited']]); }\n" }));
  const pl2 = appendOnly(Object.assign({}, all, { 'maintenance.js': all['maintenance.js'] + "\nfunction _y() { return sheetsClear(state.personalSheetId, 'Movement Log!A3:H'); }\n" }));
  T('X4 PLANTED: an edit of a log line is caught', pl1.length === 1, pl1);
  T('X5 PLANTED: a clear of the log (by its typed name, in another file) is caught', pl2.length === 1, pl2);
  T('M0 no script error', pg.errs.length === 0, pg.errs);
  await pg.close();
  pg = null;

  console.log('\n== X · planted offenders ==');
  {
    const p1 = await boot(browser, { 'scan-shelve.js': planted(SHELVE, "if (mode.kind === 'check') return _shCheckCode(f);", "if (mode.kind === 'check' && !f) return false; if (mode.kind === 'check' && f.kind === 'item' && _sh.checkPlace) { await rrShelveSaveLocation(f.key, _sh.checkPlace); return _shCheckCode(f); } if (mode.kind === 'check') return _shCheckCode(f);", 'check never writes') });
    const kp = await k1fn(p1);
    T('X1 PLANTED: the check writes as it scans → K1h catches it', kp.writes.length > 0, kp.writes);
    await p1.close();
    const p2 = await boot(browser, { 'scan-shelve.js': planted(SHELVE, "      if (b.disabled) return;\n      b.disabled = true;                                  // one press = one write\n", '', 'move guard') });
    const kp2 = await k1fn(p2);
    T('X2 PLANTED: Move here without its guard → two presses write twice (K2 catches it)', kp2.moveWrites.length > 2, kp2.moveWrites.length);
    await p2.close();
    const p3 = await boot(browser, { 'scan-shelve.js': planted(SHELVE, '  var o = _shSizeRaw() || {};', '  var o = {};', 'size reader') });
    const rp = await pdfFor(p3, 'roll2x1');
    T('X3 PLANTED: the reader ignores the setting → the roll prints on Letter pages (L2 catches it)', !rp.pages.every(p => p[0] === 2 && p[1] === 1), rp.pages);
    await p3.close();
    const p4 = await boot(browser, { 'scan-shelve.js': planted(SHELVE, '      await backupCreateAuto(RR_MOVE_LOG.backupReason);\n', '', 'backup first') });
    const mp = await mlog(p4, {});
    T('X6 PLANTED: no backup before the tab → M2 catches it (the tab is made with no backup)', mp.calls.some(c => /^addSheet/.test(c)) && !mp.calls.some(c => /^backup/.test(c)), mp.calls);
    await p4.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
