#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SCAN TO SHELVE · PRINTED LABELS (Release 2) — v0.9.2023     (real Chromium)
//
// [stated] Brad, 2026-10-23: "so we can have the ability to generate and print
// qr codes for locations and item inventory ids or be able to use premade qr
// stickers correct?" → "do release 2". The app prints its own QR labels on
// Avery 5160 sheets (a PDF from jsPDF; the QR maker is self-hosted in
// app/vendor) and reads them back with no pairing step: each code says what
// it is. The jsPDF CDN file is served here from node_modules (same 2.5.1).
//
//   F1  the codes: item RR1:I:<collection tag>:<inventory #>, place
//       RR1:P:<place>:<spot>; they read back exactly (spaces, colons, ›)
//   F2  an item label finds THAT copy by inventory number — nothing written
//   F3  a label printed for ANOTHER collection: "belongs to another
//       collection", nothing changes
//   F4  an item label whose copy is gone: "No item #999", nothing changes
//   S1  scan an item label, then a shelf label → Location + Location Detail
//       written for that row; no "new sticker" question; no Sticker Code
//       written; no shelf sticker saved
//   S2  a printed place that is not in the saved list still sets the location
//   R1  pairing a blank-sticker spot refuses a printed label (scanner + the
//       writers themselves) — nothing written
//   L1  the sheet layout: 30 a page, columns 2-3/4" apart, rows 1" apart, all
//       inside US Letter; "already used" skips that many on the first sheet
//   P1  Storage Locations → Print shelf labels: every place and spot, ticked;
//       Make → "Rail Roster labels.pdf", one page, names printed
//   P2  Print item labels: none ticked; search → Tick all shown; 29 used →
//       two pages
//   P3  the item page line has "Print label" for THAT copy (ticked on open)
//   P4  the QR drawn on the sheet is exactly the code's QR, quiet zone kept
//   P5  nothing ticked → a message, no file; ✕ closes
//   O1  owners only: anyone else gets no print screen
//   V1  the QR maker is self-hosted (works offline at a show) and precached
//   X*  PLANTED: no collection check (F3), no printed-label refusal (R1),
//       skip ignored (P2), quiet zone dropped (P4)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  scan_shelve_labels_2023_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const JSPDF = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
if (!fs.existsSync(JSPDF)) { console.log('FAILED  —  scan_shelve_labels_2023_tests needs node_modules/jspdf (npm install).'); process.exit(1); }
const SHELVE = rd('scan-shelve.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.split(from).join(to);
}

async function boot(browser, email, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.errs = errs;
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[\d.]+\/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: fs.readFileSync(JSPDF, 'utf8'), contentType: 'application/javascript' });
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(email => {
    state.user = { email: email, name: 'Brad' };
    state.personalSheetId = 'sheet-brad-1';
    state.masterData = [{ itemNum: '6464-1', roadName: 'Western Pacific', itemType: 'Boxcar', variation: '' },
                        { itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    const mk = (inv, num, row, extra) => Object.assign({ inventoryId: inv, itemNum: num, variation: '', owned: true, condition: 8, row: row, location: '', locationDetail: '', stickerCode: '' }, extra || {});
    state.personalData = { '101': mk('101', '6464-1', 3), '102': mk('102', '2343', 4), '103': mk('103', '2343', 5, { location: 'Basement', locationDetail: 'Tote 2' }) };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    _prefSet('lv_location_enabled', 'true');
    rrSaveLocations([{ name: 'Garage', type: 'Room', details: ['Shelf 4', 'Shelf 5'] }, { name: 'Basement', type: 'Room', details: ['Tote 2'] }]);
    window.__w = []; window.__toasts = []; window.__rects = []; window.__saved = null;
    window.rrRowStillIs = async function () { return true; };
    window.sheetsUpdate = async function (id, range, values) { window.__w.push({ range: range, v: values[0][0] }); return {}; };
    window._cachePersonalData = function () {};
    window.appConfirm = async function () { return true; };
    const _t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    window.__col = f => personalColLetter(f);
    window.__wait = ms => new Promise(z => setTimeout(z, ms));
    // the real jsPDF, with its file save caught and every filled square noted
    if (window.jspdf && window.jspdf.jsPDF) {
      const Real = window.jspdf.jsPDF;
      window.jspdf.jsPDF = function (o) {
        const d = new Real(o); const rect = d.rect.bind(d);
        d.rect = function (x, y, w, h, s) { window.__rects.push([x, y, w, h]); return rect(x, y, w, h, s); };
        d.save = function (n) { window.__saved = { name: n, pages: d.getNumberOfPages(), out: d.output() }; return d; };
        return d;
      };
    }
  }, email);
  return pg;
}

const F3 = async pg => pg.evaluate(async () => {
  const code = rrStickerAppCodeItem(state.personalData['101']);
  state.personalSheetId = 'someone-elses-sheet';
  const found = rrStickerFind(code);
  rrShelveOpen(); await __wait(150); __w.length = 0;
  await rrShelveCode(code);
  const r = { found: found && found.kind, status: document.getElementById('rr-shelve-status').textContent, writes: __w.slice(),
              item: document.getElementById('rr-shelve-item').textContent };
  rrShelveClose(); state.personalSheetId = 'sheet-brad-1';
  return r;
});
const R1 = async pg => pg.evaluate(async () => {
  __w.length = 0; window.__toasts = [];
  const code = rrStickerAppCodeItem(state.personalData['101']);
  rrShelveOpen({ kind: 'pairItem', key: '102', label: '2343' }); await __wait(150);
  const ok = await rrShelveCode(code);
  const status = (document.getElementById('rr-shelve-status') || {}).textContent || '';
  rrShelveClose();
  const direct = await rrStickerSetItem('102', code);
  const directPlace = await rrStickerSetPlace(rrStickerAppCodePlace({ loc: 'Garage', spot: 'Shelf 4' }), { loc: 'Garage', spot: 'Shelf 5' });
  return { ok, status, direct, directPlace, sticker: state.personalData['102'].stickerCode, writes: __w.slice(), places: Object.keys(rrStickerPlaces()) };
});
const P2 = async pg => pg.evaluate(async () => {
  window.__saved = null;
  rrShelvePrintOpen('items'); await __wait(150);
  const ov = document.getElementById('rr-shelve-print');
  const start = ov.querySelector('#rr-print-count').textContent;
  const q = ov.querySelector('#rr-print-q'); q.value = '2343'; q.dispatchEvent(new Event('input')); await __wait(80);
  const rows = [...ov.querySelectorAll('#rr-print-list label')].map(l => l.textContent);
  ov.querySelector('#rr-print-all').click(); await __wait(80);
  const count = ov.querySelector('#rr-print-count').textContent;
  ov.querySelector('#rr-print-skip').value = '29';
  ov.querySelector('#rr-print-go').click(); await __wait(1200);
  const s = window.__saved; ov.remove();
  return { start, rows, count, pages: s && s.pages, has2343: !!(s && s.out.indexOf('(2343)') >= 0), hasInv: !!(s && s.out.indexOf('#102') >= 0 && s.out.indexOf('#103') >= 0) };
});
const P4 = async pg => pg.evaluate(async () => {
  window.__rects = [];
  const e = rrShelveLabelEntries('places', [{ loc: 'Garage', spot: 'Shelf 4' }]);
  await rrShelveLabelsPdf(e, 0);
  const tpl = RR_SHELVE.label, qx = tpl.left + tpl.pad, qy = tpl.top + (tpl.h - tpl.qr) / 2;
  const qr = qrcode(0, RR_SHELVE.qrLevel); qr.addData(e[0].code); qr.make();
  const n = qr.getModuleCount(), cell = tpl.qr / (n + 4);
  const want = new Set(), got = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) want.add(r + ',' + c);
  let outside = 0;
  window.__rects.forEach(([x, y, w, h]) => {
    const r = Math.round((y - qy) / cell - 2), c0 = Math.round((x - qx) / cell - 2), len = Math.round(w / cell);
    if (r < 0 || c0 < 0 || r >= n || c0 + len > n) outside++;
    for (let c = c0; c < c0 + len; c++) got.add(r + ',' + c);
  });
  const same = want.size === got.size && [...want].every(k => got.has(k));
  return { code: e[0].code, n, same, want: want.size, got: got.size, outside, rects: window.__rects.length };
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let pg = await boot(browser, 'bhale@ipd-llc.com');

  console.log('== F · the codes say what they are ==');
  const f1 = await pg.evaluate(() => {
    const item = rrStickerAppCodeItem(state.personalData['101']);
    const place = rrStickerAppCodePlace({ loc: 'Garage', spot: 'Shelf 4' });
    const odd = rrStickerAppCodePlace({ loc: 'Train Room: East', spot: 'Case › 2' });
    return { item, place, pi: rrStickerParseApp(item), pp: rrStickerParseApp(place), po: rrStickerParseApp(odd), plain: rrStickerParseApp('PACK-0001') };
  });
  T('F1 item code is RR1:I:<6-letter collection tag>:101', /^RR1:I:[0-9a-z]{6}:101$/.test(f1.item) && f1.pi && f1.pi.kind === 'item' && f1.pi.inv === '101', f1);
  T('F1 place code reads back exactly — even a colon and › in the names', f1.pp && f1.pp.loc === 'Garage' && f1.pp.spot === 'Shelf 4' && f1.po && f1.po.loc === 'Train Room: East' && f1.po.spot === 'Case › 2', f1);
  T('F1 a pack sticker is not mistaken for a printed label', f1.plain === null, f1.plain);

  const f2 = await pg.evaluate(() => { __w.length = 0; const f = rrStickerFind(rrStickerAppCodeItem(state.personalData['103'])); return { kind: f && f.kind, key: f && f.key, writes: __w.length }; });
  T('F2 an item label finds THAT copy (103, not the other 2343) — nothing written', f2.kind === 'item' && f2.key === '103' && f2.writes === 0, f2);

  const f3 = await F3(pg);
  T('F3 a label from ANOTHER collection: "belongs to another collection", nothing changes', f3.found === 'foreign' && /another collection/.test(f3.status) && f3.writes.length === 0 && !/6464/.test(f3.item), f3);

  const f4 = await pg.evaluate(async () => {
    const code = rrStickerAppCodeItem(state.personalData['101']).replace(/:101$/, ':999');
    rrShelveOpen(); await __wait(150); __w.length = 0;
    await rrShelveCode(code);
    const r = { status: document.getElementById('rr-shelve-status').textContent, writes: __w.slice(), ask: !!document.getElementById('rr-shelve-ask') };
    rrShelveClose(); return r;
  });
  T('F4 an item label whose copy is gone: "No item #999", nothing changes, no question', /No item #999/.test(f4.status) && f4.writes.length === 0 && !f4.ask, f4);

  console.log('== S · scanning printed labels ==');
  const s1 = await pg.evaluate(async () => {
    rrShelveOpen(); await __wait(150); __w.length = 0;
    const before = JSON.stringify(rrStickerPlaces());
    await rrShelveCode(rrStickerAppCodeItem(state.personalData['101']));
    const mid = { ask: !!document.getElementById('rr-shelve-ask'), status: document.getElementById('rr-shelve-status').textContent };
    await rrShelveCode(rrStickerAppCodePlace({ loc: 'Garage', spot: 'Shelf 5' })); await __wait(100);
    const r = { mid, ask: !!document.getElementById('rr-shelve-ask'), writes: __w.slice(), cols: { loc: __col('location'), det: __col('locationDetail'), st: __col('stickerCode') },
                loc: state.personalData['101'].location, det: state.personalData['101'].locationDetail, sticker: state.personalData['101'].stickerCode,
                placesSame: JSON.stringify(rrStickerPlaces()) === before, status: document.getElementById('rr-shelve-status').textContent };
    __w.length = 0;
    await rrShelveCode(rrStickerAppCodeItem(state.personalData['102']));
    await rrShelveCode(rrStickerAppCodePlace({ loc: 'Attic', spot: 'Bin 9' })); await __wait(100);
    r.s2 = { loc: state.personalData['102'].location, det: state.personalData['102'].locationDetail, ask: !!document.getElementById('rr-shelve-ask') };
    rrShelveClose(); return r;
  });
  T('S1 item label → no "new sticker" question, straight to "now scan its shelf"', !s1.mid.ask && /shelf/i.test(s1.mid.status), s1.mid);
  T('S1 …shelf label → Garage / Shelf 5 written to row 3', s1.loc === 'Garage' && s1.det === 'Shelf 5' && s1.writes.some(w => w.range === 'My Collection!' + s1.cols.loc + '3' && w.v === 'Garage') && s1.writes.some(w => w.range === 'My Collection!' + s1.cols.det + '3' && w.v === 'Shelf 5'), s1);
  T('S1 …and no pairing: no Sticker Code written, no shelf sticker saved', s1.sticker === '' && !s1.writes.some(w => w.range.indexOf('!' + s1.cols.st) >= 0) && s1.placesSame && !s1.ask, s1);
  T('S2 a printed place not in the saved list (Attic / Bin 9) still sets the location', s1.s2.loc === 'Attic' && s1.s2.det === 'Bin 9' && !s1.s2.ask, s1.s2);

  console.log('== R · printed labels are never paired ==');
  const r1 = await R1(pg);
  T('R1 pairing a blank sticker refuses a printed label — scanner says so', r1.ok === false && /printed label/.test(r1.status), r1);
  T('R1 …the writers refuse it too; nothing written, no shelf sticker saved', r1.direct === false && r1.directPlace === false && r1.sticker === '' && r1.writes.length === 0 && r1.places.length === 0, r1);

  console.log('== L · the sheet layout (Avery 5160) ==');
  const l1 = await pg.evaluate(() => {
    const a = rrShelveLabelSlots(31, 0), b = rrShelveLabelSlots(25, 5), c = rrShelveLabelSlots(2, 99), t = RR_SHELVE.label;
    const inside = a.every(s => s.x >= 0 && s.y >= 0 && s.x + t.w <= t.pageW + 1e-9 && s.y + t.h <= t.pageH + 1e-9);
    return { a0: a[0], a2: a[2], a3: a[3], a29: a[29], a30: a[30], b0: b[0], b24: b[24], c, inside };
  });
  const near = (v, w) => Math.abs(v - w) < 1e-9;
  T('L1 first label at 3/16" in, 1/2" down; third column 5-11/16"; second row 1-1/2"', near(l1.a0.x, 0.1875) && near(l1.a0.y, 0.5) && near(l1.a2.x, 5.6875) && near(l1.a3.y, 1.5) && l1.a0.page === 0, l1);
  T('L1 30 a page: label 30 is the bottom-right, label 31 starts page 2', l1.a29.page === 0 && near(l1.a29.y, 9.5) && near(l1.a29.x, 5.6875) && l1.a30.page === 1 && near(l1.a30.x, 0.1875) && near(l1.a30.y, 0.5), l1);
  T('L1 every label sits inside US Letter', l1.inside, l1);
  T('L1 "5 already used" starts at the 6th spot; 25 then just fill page 1', l1.b0.page === 0 && near(l1.b0.x, 5.6875) && near(l1.b0.y, 1.5) && l1.b24.page === 0 && near(l1.b24.y, 9.5), l1);
  T('L1 an impossible "already used" (99) is held to 29, never a blank page', l1.c[0].page === 0 && l1.c[1].page === 1, l1.c);

  console.log('== P · the print screen ==');
  const p1 = await pg.evaluate(async () => {
    window.__saved = null; window.__toasts = [];
    _openLocationsModal(); await __wait(200);
    const btn = document.querySelector('#rr-shelve-top button[onclick*="rrShelvePrintOpen(\'places\')"]');
    const itemsBtn = !!document.querySelector('#rr-shelve-top button[onclick*="rrShelvePrintOpen(\'items\')"]');
    if (!btn) return { btn: false };
    btn.click(); await __wait(150);
    const ov = document.getElementById('rr-shelve-print');
    const rows = [...ov.querySelectorAll('#rr-print-list label')].map(l => ({ t: l.textContent, on: l.querySelector('input').checked }));
    const count = ov.querySelector('#rr-print-count').textContent;
    const x = !!ov.querySelector('#rr-print-x');
    ov.querySelector('#rr-print-go').click(); await __wait(1200);
    const s = window.__saved;
    const r = { btn: true, itemsBtn, rows, count, x, name: s && s.name, pages: s && s.pages, garage: !!(s && s.out.indexOf('(Garage)') >= 0), shelf: !!(s && s.out.indexOf('(Shelf 4)') >= 0), toasts: window.__toasts.slice() };
    ov.remove(); const m = document.getElementById('loc-setup-modal'); if (m) m.remove();
    return r;
  });
  T('P1 Storage Locations has "Print shelf labels" and "Print item labels"', p1.btn && p1.itemsBtn, p1);
  T('P1 every place and spot is listed, all ticked (5)', p1.rows && p1.rows.length === 5 && p1.rows.every(r => r.on) && /5 ticked/.test(p1.count) && p1.rows.some(r => /Garage › Shelf 4/.test(r.t)), p1.rows);
  T('P1 Make → "Rail Roster labels.pdf", one page, the names printed on it', p1.name === 'Rail Roster labels.pdf' && p1.pages === 1 && p1.garage && p1.shelf, p1);
  T('P1 …"✓ 5 labels ready — print at 100%"', p1.toasts.some(t => /5 labels ready/.test(t) && /100%/.test(t)), p1.toasts);

  const p2 = await P2(pg);
  T('P2 item labels start with none ticked', /^0 ticked/.test(p2.start), p2);
  T('P2 search 2343 → both copies listed; Tick all shown → 2 ticked', p2.rows.length === 2 && p2.rows.every(t => /2343/.test(t)) && /2 ticked/.test(p2.count), p2);
  T('P2 29 already used → the 2nd label goes on a 2nd page; number and #inventory printed', p2.pages === 2 && p2.has2343 && p2.hasInv, p2);

  const p3 = await pg.evaluate(async () => {
    const html = rrShelveItemLineHtml(state.personalData['101'], '101');
    const has = html.indexOf("rrShelvePrintOpen('items',['101'])") >= 0 && /Print label/.test(html);
    rrShelvePrintOpen('items', ['101']); await __wait(120);
    const ov = document.getElementById('rr-shelve-print');
    const r = { has, count: ov.querySelector('#rr-print-count').textContent, ticked: !!ov.querySelector('[data-pr="101"]:checked') };
    ov.remove(); return r;
  });
  T('P3 the item page line has "Print label" for THAT copy, ticked when it opens', p3.has && /^1 ticked/.test(p3.count) && p3.ticked, p3);

  const p4 = await P4(pg);
  T('P4 the QR on the sheet is exactly the code\'s QR, inside its box with the quiet zone', p4.same && p4.outside === 0 && p4.rects > 0, p4);

  const p5 = await pg.evaluate(async () => {
    window.__saved = null; window.__toasts = [];
    rrShelvePrintOpen('items'); await __wait(120);
    const ov = document.getElementById('rr-shelve-print');
    ov.querySelector('#rr-print-go').click(); await __wait(300);
    const r = { saved: window.__saved, toasts: window.__toasts.slice() };
    ov.querySelector('#rr-print-x').click(); await __wait(50);
    r.closed = !document.getElementById('rr-shelve-print');
    return r;
  });
  T('P5 nothing ticked → "Tick at least one", no file; ✕ closes', !p5.saved && p5.toasts.length > 0 && p5.closed, p5);
  T('page errors (owner)', pg.errs.length === 0, pg.errs);
  await pg.close();

  console.log('== O · owners only ==');
  pg = await boot(browser, 'someone@example.com');
  const o1 = await pg.evaluate(async () => { rrShelvePrintOpen('places'); rrShelvePrintOpen('items', ['101']); await __wait(100);
    return { open: !!document.getElementById('rr-shelve-print'), line: rrShelveItemLineHtml(state.personalData['101'], '101') }; });
  T('O1 anyone else: no print screen, no Print label on the item page', !o1.open && !/Print label/.test(o1.line), o1);
  await pg.close();

  console.log('== V · works offline ==');
  {
    const cfg = rd('config.js'), sw = rd('sw.js');
    const lib = (cfg.match(/qrLib:\s*'([^']+)'/) || [])[1] || '';
    const file = path.join(APP, lib.replace(/^\.\//, ''));
    const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    T('V1 the QR maker is a file in the app (not a web link), MIT notice kept', /^\.\/vendor\//.test(lib) && /Kazuhiko Arase/.test(src) && /MIT/.test(src), lib);
    T('V1 …and the offline cache holds it', sw.indexOf("'" + lib + "'") >= 0, lib);
  }

  console.log('== X · planted ==');
  // v2077: the check now also recognises another collection's label — planting "no check" turns the whole test off
  const NOTAG = planted(SHELVE, "    if (app.tag !== _shSheetTag()) {\n", "    if (false) {\n", 'collection check');
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': NOTAG });
  const x3 = await F3(pg);
  T('X-F3 PLANTED: no collection check → another collection\'s label is taken (caught)', x3.found === 'item', x3);
  await pg.close();

  let NOREF = planted(SHELVE, "    if ((mode.kind === 'pairItem' || mode.kind === 'pairPlace') && rrStickerParseApp(c)) { _shStatus(_shW('printedLabel')); return false; }\n", '', 'pair guard');
  NOREF = planted(NOREF, "  if (rrStickerParseApp(c)) { if (typeof showToast === 'function') showToast(_shW('printedLabel'), 4000, true); return false; }\n", '', 'writer guards');
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': NOREF });
  const xr = await R1(pg);
  T('X-R1 PLANTED: no printed-label refusal → it gets paired (caught)', xr.direct === true || xr.ok === true || xr.sticker !== '', xr);
  await pg.close();

  const NOSKIP = planted(SHELVE, '    var n = i + skip, page', '    var n = i, page', 'skip');
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': NOSKIP });
  const xs = await P2(pg);
  T('X-P2 PLANTED: "already used" ignored → one page (caught)', xs.pages === 1, xs);
  await pg.close();

  const NOQZ = planted(SHELVE, 'doc.rect(x + (c0 + 2) * cell, y + (r + 2) * cell', 'doc.rect(x + c0 * cell, y + r * cell', 'quiet zone');
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': NOQZ });
  const xq = await P4(pg);
  T('X-P4 PLANTED: quiet zone dropped → the drawn QR does not match its place (caught)', !xq.same || xq.outside > 0, xq);
  await pg.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
