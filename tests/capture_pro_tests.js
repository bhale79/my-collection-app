#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TRR Pro — CAPTURE (sticker → photos → shelf; items NOT IDENTIFIED YET)
// (real Chromium, the REAL app, a stand-in Drive + Sheets: tests/lib/coll-world.js)
//
// Plan PLAN_2026-11-09_PRO_CAPTURE.md; [stated] Brad 2026-11-09 12:41 CT the
// flow, 12:46 CT "Show up in the collection", 12:49 CT "Yes".
//   G  source guards, each PROVED on a planted offender
//   R  rrToIdentify — THE rule
//   L  how it looks: My Collection row (desktop + phone), its card, its name,
//      All Collections, the item page hands it to its card
//   C  the Capture loop, TAPPED: used / shelf / printed stickers refused,
//      Next needs a photo, photos carry the sticker, the shelf scan fills in,
//      Finished saves ONE row + a Movement Log line, Back, Same shelf, a reused
//      sticker refused, the loop goes back for the next item
//   O  offline: items wait on the phone in order, their stickers stay taken,
//      back online they go in oldest first; a staged photo brings its sticker up
//   I  Identify: an add aimed at the row FILLS it (same number, sticker,
//      shelf, date; no new row); the Inbox's add finds the row by the photos'
//      sticker stamp
//   B  Print blank labels: unique codes, never an app label, a PDF made
//   A  an archived collection: no Capture, no button
//   X  a regular customer: no button
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  capture_pro_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const JSPDF = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
if (!fs.existsSync(JSPDF)) { console.log('FAILED  —  capture_pro_tests needs node_modules/jspdf (npm install).'); process.exit(1); }
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1200))); cond ? pass++ : fail++; }
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n'); }
const W = ms => new Promise(r => setTimeout(r, ms));

// ── G · source guards ──────────────────────────────────────────────────────
// G1 My Collection asks THE rule (rrToIdentify) for a captured row before drawing it.
function browseAsks(src) { return /if \(_capRec && rrToIdentify\(_capRec\)\) return rrCaptureRowHtml\(_capRec, isMobile\);/.test(strip(src)); }
// G2 capture.js writes a My Collection row in ONE place (rrCaptureWrite).
function captureAppends(src) { return (strip(src).match(/sheetsAppend\(/g) || []).length; }
// G3 no screen in capture.js tests a blank item number itself — it asks rrToIdentify.
function ownBlankTest(src) { return /itemNum\s*\)\s*\.trim\(\)|!\s*\w+\.itemNum\b|itemNum\s*===\s*''/.test(strip(src)); }
// G4 every value put in an on-click is QUOTED (the 7A lesson: rrJsArg makes it safe, not quoted).
function bareArg(src) { return /onclick="[^"]*\(' \+ (rrJsArg|inv)\b/.test(strip(src)); }
function guards() {
  console.log('\n== G · source guards ==');
  const br = read('browse.js'), cap = read('capture.js');
  T('G1 My Collection asks rrToIdentify before drawing a captured row', browseAsks(br));
  T('G1b PLANTED: the branch drawing on its own blank-number test → caught', !browseAsks(br.replace('if (_capRec && rrToIdentify(_capRec)) return', 'if (_capRec && !_capRec.itemNum) return')));
  T('G2 capture.js appends a My Collection row in exactly ONE place', captureAppends(cap) === 1, captureAppends(cap));
  T('G2b PLANTED: a second append → caught', captureAppends(cap + '\nasync function x() { await sheetsAppend(a, b, [c]); }') === 2);
  T('G3 capture.js never tests a blank item number itself', !ownBlankTest(cap));
  T('G3b PLANTED: a screen testing !rec.itemNum → caught', ownBlankTest(cap + '\nfunction y(rec) { if (!rec.itemNum) return 1; }'));
  T('G4 every value in an on-click is quoted', !bareArg(cap));
  T('G4b PLANTED: a bare inventory number in an on-click → caught', bareArg(cap + "\nvar z = '<b onclick=\"rrCaptureCardOpen(' + inv + ')\">';"));
  const ad = read('app-data.js');
  T('G5 rrToIdentify is defined ONCE, beside the row rules (app-data.js)', (ad.match(/function rrToIdentify\(/g) || []).length === 1 &&
    fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'app-data.js').every(f => !/function rrToIdentify\(/.test(read(f))));
  const ix = read('index.html');
  T('G6 index.html loads capture.js once, after the invoices', (ix.match(/capture\.js\?v=/g) || []).length === 1 && ix.indexOf('capture.js?v=') > ix.indexOf('collections-invoice.js?v='));
  T('G7 the offline cache holds capture.js', /'\.\/capture\.js'/.test(read('sw.js')));
  const cf = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8'));
  T('G8 capture.js is a core file', JSON.stringify(cf).indexOf('app/capture.js') >= 0);
}

async function world(browser, opts) {
  const b = await boot({ newPage: () => browser.newPage({ viewport: { width: 1200, height: 900 } }) }, opts);
  await b.pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    localStorage.setItem('lv_location_enabled', 'true');
    localStorage.setItem('lv_sticker_places', JSON.stringify({ 'SHELF-W1': { loc: 'Warehouse', spot: 'Shelf 1' }, 'SHELF-W2': { loc: 'Warehouse', spot: 'Shelf 2' } }));
    localStorage.removeItem('rr_capture_queue_v1');
  });
  return b;
}
const PLANT = () => {
  const F = PERSONAL_FIELD_INDEX, N = PERSONAL_SCHEMA.length;
  const r = new Array(N).fill(''); r[F.inventoryId] = '60'; r[F.stickerCode] = 'RRB-PLANTED001'; r[F.location] = 'Warehouse'; r[F.locationDetail] = 'Shelf 1'; r[F.dateAdded] = '2026-11-09';
  window.__S.S7['My Collection'].push(r);
};

// ── R + L ──────────────────────────────────────────────────────────────────
async function lookRun(browser) {
  console.log('\n== R · the rule ==');
  const { pg, errs } = await world(browser);
  await pg.evaluate(PLANT);
  await openColl(pg, 'c7');
  const r = await pg.evaluate(() => ({
    blank: rrToIdentify({ itemNum: '', inventoryId: '9', owned: true }),
    spaces: rrToIdentify({ itemNum: '  ', inventoryId: '9' }),
    num: rrToIdentify({ itemNum: '2343', inventoryId: '9' }),
    noInv: rrToIdentify({ itemNum: '', inventoryId: '' }),
    notOwned: rrToIdentify({ itemNum: '', inventoryId: '9', owned: false }),
    moved: rrToIdentify({ itemNum: '', inventoryId: '9', transferredTo: 'To 8 – Smith as 8-50' }),
    nul: rrToIdentify(null),
    loaded: !!state.personalData['60'] && rrToIdentify(state.personalData['60']),
  }));
  T('R1 no item number + an inventory number = not identified yet', r.blank && r.spaces && r.loaded, r);
  T('R2 a number, no inventory number, not owned, moved out, nothing → never', !r.num && !r.noInv && !r.notOwned && !r.moved && !r.nul, r);

  console.log('\n== L · how it looks ==');
  const l = await pg.evaluate(async () => {
    const o = {};
    showPage('browse'); filterOwned(); await new Promise(z => setTimeout(z, 900));
    const row = document.querySelector('[data-capture-inv="60"]');
    o.row = row ? row.textContent.replace(/\s+/g, ' ').trim() : null;
    o.rowIsTr = row && row.tagName === 'TR';
    o.noUpgrade = row ? !/Upgrade|For Sale|Sold/.test(row.textContent) : null;
    o.phone = rrCaptureRowHtml(state.personalData['60'], true);
    o.name = rrShelveItemName(state.personalData['60']);
    o.navOwned = (document.getElementById('nav-owned') || {}).textContent;
    row.click(); await new Promise(z => setTimeout(z, 200));
    const card = document.getElementById('rr-capture-card');
    o.card = card ? card.textContent.replace(/\s+/g, ' ') : null;
    if (card) card.querySelector('[data-capture-x]').click();
    showItemDetailPage(-1, '60'); await new Promise(z => setTimeout(z, 200));
    o.detailToCard = !!document.getElementById('rr-capture-card');
    const c2 = document.getElementById('rr-capture-card'); if (c2) c2.remove();
    const all = await rrAllRead({ fresh: true }).catch(() => null);
    const x = all && all.rows.find(y => String(y.rec.inventoryId) === '60' && y.coll.key === 'c7');
    o.all = x ? 'row' : null;
    return o;
  });
  T('L1 My Collection draws its own row: Not identified yet · #7-60 · its shelf · Identify', /Not identified yet/.test(l.row || '') && /#7-60/.test(l.row) && /Warehouse › Shelf 1/.test(l.row) && /Identify/.test(l.row) && l.rowIsTr, l);
  T('L2 …with no For Sale / Sold / Upgrade (nothing to sell or upgrade yet)', l.noUpgrade === true, l);
  T('L3 the phone card says the same and opens the card', /browse-card/.test(l.phone) && /Not identified yet/.test(l.phone) && /rrCaptureCardOpen\('60'\)/.test(l.phone), l.phone);
  T('L4 its name everywhere a name is shown (labels, Scan to Shelve, All Collections)', l.name === 'Not identified yet · #7-60', l.name);
  T('L5 its card: the sticker, the shelf, the date, Identify and Remove', /RRB-PLANTED001/.test(l.card || '') && /Warehouse › Shelf 1/.test(l.card) && /2026-11-09/.test(l.card) && /Identify/.test(l.card) && /Remove/.test(l.card), l.card);
  T('L6 the item page hands a captured copy to its card', l.detailToCard, l);
  T('L7 All Collections lists it', l.all === 'row', l);
  T('L8 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── C · the loop ───────────────────────────────────────────────────────────
async function loopRun(browser) {
  console.log('\n== C · the Capture loop ==');
  const { pg, errs } = await world(browser);
  await openColl(pg, 'c7');
  const st = () => pg.evaluate(() => { const c = _rrCaptureState(); return c && { step: c.step, sticker: c.sticker, shots: c.shots, place: c.place, msg: c.msg, last: c.last }; });
  const shot = () => pg.evaluate(async () => _rrCaptureShot(new File([new Uint8Array([255, 216, 255, 224])], 'p.jpg', { type: 'image/jpeg' })));
  const tap = sel => pg.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);
  T('C0 the screen opens on the sticker step, naming the collection', await pg.evaluate(() => rrCaptureOpen() && /Adding to 7 – Hale/.test(document.getElementById('rr-capture').textContent) && _rrCaptureState().step === 'sticker'));
  const typed = async (code) => pg.evaluate(c => { const i = document.querySelector('[data-cap-type]'); i.value = c; document.querySelector('[data-cap-go]').click(); }, code);
  await typed('RR1:I:old:45'); await W(150);
  const c1 = await st();
  await typed('SHELF-W1'); await W(150);
  const c2 = await st();
  T('C1 a printed item label is refused (a sticker must be blank)', c1.step === 'sticker' && /already names an item/.test(c1.msg), c1);
  T('C2 a shelf sticker is refused on the sticker step', c2.step === 'sticker' && /shelf sticker/.test(c2.msg), c2);
  await typed('RRB-LOOP000001'); await W(150);
  const c3 = await st();
  T('C3 a blank sticker → the photos step', c3.step === 'photos' && c3.sticker === 'RRB-LOOP000001', c3);
  await tap('[data-cap-next]'); await W(100);
  const c4 = await st();
  T('C4 Next with no photo is refused', c4.step === 'photos' && /at least one photo/.test(c4.msg), c4);
  await shot(); await shot(); await W(300);
  const up = await pg.evaluate(() => Object.values(window.__files).filter(f => /^INBOX /.test(f.name)).map(f => f.appProperties || {}));
  T('C5 every photo goes to the Photo Inbox carrying the sticker (and the collection)', up.length === 2 && up.every(a => a.rrCap === 'RRB-LOOP000001' && a.rrColl === 'c7'), up);
  T('C5b …and the warning clears once a photo is taken', (await st()).msg === '');
  await tap('[data-cap-back]'); await W(100);
  const back1 = await st();
  T('C6 Back from the photos step goes back to the sticker', back1.step === 'sticker' && back1.sticker === '', back1);
  await typed('RRB-LOOP000001'); await shot(); await tap('[data-cap-next]'); await W(100);
  await typed('RRB-OTHER00001'); await W(150);
  const c7 = await st();
  T('C7 a sticker that is not a shelf is refused on the shelf step', c7.step === 'shelf' && !c7.place && /(item sticker|new)/i.test(c7.msg), c7);
  await typed('SHELF-W1'); await W(150);
  const c8 = await st();
  const rowsBefore = await pg.evaluate(() => window.__S.S7['My Collection'].length);
  T('C8 the shelf scan FILLS IN the shelf — nothing is saved until Finished', c8.step === 'shelf' && c8.place && c8.place.spot === 'Shelf 1' && rowsBefore === 6, { c8, rowsBefore });
  await tap('[data-cap-finish]'); await W(700);
  const c9 = await pg.evaluate(() => {
    const F = PERSONAL_FIELD_INDEX, rows = window.__S.S7['My Collection'], last = rows[rows.length - 1];
    const log = (window.__S.S7['Movement Log'] || []).slice(-1)[0] || [];
    return { n: rows.length, num: last[F.itemNum], inv: last[F.inventoryId], sticker: last[F.stickerCode], loc: last[F.location], spot: last[F.locationDetail], date: last[F.dateAdded],
             log: log.join('|'), live: !!state.personalData[last[F.inventoryId]] && rrToIdentify(state.personalData[last[F.inventoryId]]), st: _rrCaptureState() && _rrCaptureState().step, last: _rrCaptureState() && _rrCaptureState().last };
  });
  T('C9 Finished adds ONE row: an inventory number, the sticker, the shelf, today — no item number', c9.n === 7 && c9.num === '' && c9.inv === '49' && c9.sticker === 'RRB-LOOP000001' && c9.loc === 'Warehouse' && c9.spot === 'Shelf 1' && /^\d{4}-\d\d-\d\d$/.test(c9.date) && c9.live, c9);
  T('C10 …one Movement Log line (Captured, to its shelf)', /49\|\|Not identified yet · #7-49\|\(no location\)\|Warehouse › Shelf 1\|.*\|Captured$/.test(c9.log), c9.log);
  T('C11 …and the loop is back on the sticker step, saying what it did', c9.st === 'sticker' && /#7-49 → Warehouse › Shelf 1/.test(c9.last || ''), c9);
  await typed('RRB-LOOP000001'); await W(150);
  T('C12 the same sticker again is refused (it is on #7-49 now)', /already on Not identified yet · #7-49/.test((await st()).msg));
  await typed('RRB-LOOP000002'); await shot(); await tap('[data-cap-next]'); await W(150);
  T('C13 Same shelf as last time is offered on the next item', await pg.evaluate(() => /Warehouse › Shelf 1/.test((document.querySelector('[data-cap-same]') || {}).textContent || '')));
  await tap('[data-cap-same]'); await W(100);
  // stability rule 4: two taps on Finished, one row
  await pg.evaluate(() => { const b = document.querySelector('[data-cap-finish]'); b.click(); b.click(); });
  await W(700);
  const c14 = await pg.evaluate(() => Object.values(state.personalData).filter(p => p.stickerCode === 'RRB-LOOP000002').map(p => [p.inventoryId, p.location, p.locationDetail]));
  T('C14 Same shelf + a double tap on Finished → ONE row, #50, on the same shelf', c14.length === 1 && c14[0][0] === '50' && c14[0][2] === 'Shelf 1', c14);
  T('C15 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── O · offline ────────────────────────────────────────────────────────────
async function offlineRun(browser) {
  console.log('\n== O · no signal ==');
  const { pg, errs } = await world(browser);
  await openColl(pg, 'c7');
  await pg.evaluate(() => { window.__off = true; window._rrOfflineNow = function () { return !!window.__off; }; rrCaptureOpen(); });
  const one = code => pg.evaluate(async c => {
    await rrCaptureCode(c); await _rrCaptureShot(new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' }));
    document.querySelector('[data-cap-next]').click(); await rrCaptureCode('SHELF-W2');
    document.querySelector('[data-cap-finish]').click(); await new Promise(r => setTimeout(r, 400));
  }, code);
  await one('RRB-OFF0000001'); await one('RRB-OFF0000002');
  const o = await pg.evaluate(async () => ({
    queue: JSON.parse(localStorage.getItem(RR_CAPTURE.queueKey) || '[]').map(x => x.sticker),
    rows: window.__S.S7['My Collection'].length,
    line: (document.querySelector('[data-cap-queue]') || {}).textContent || '',
    dup: (await rrCaptureCode('RRB-OFF0000001'), _rrCaptureState().msg),
    uploads: Object.values(window.__files).filter(f => /^INBOX /.test(f.name)).length,
  }));
  T('O1 offline, Finished keeps the item on the phone — nothing written yet', o.queue.join() === 'RRB-OFF0000001,RRB-OFF0000002' && o.rows === 6 && o.uploads === 0, o);
  T('O2 the screen says how many are waiting', /2 waiting to be added/.test(o.line), o.line);
  T('O3 a waiting item\'s sticker stays taken', /waiting to be added/.test(o.dup), o.dup);
  await pg.evaluate(() => { window.__off = false; });
  const o2 = await pg.evaluate(async () => {
    const n = await rrCaptureDrain();
    try { await window._pinFns._stageDrain(); } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
    return { n, left: JSON.parse(localStorage.getItem(RR_CAPTURE.queueKey) || '[]').length,
      rows: Object.values(state.personalData).filter(p => /^RRB-OFF/.test(p.stickerCode || '')).map(p => p.inventoryId + ':' + p.stickerCode).sort(),
      ups: Object.values(window.__files).filter(f => /^INBOX /.test(f.name)).map(f => (f.appProperties || {}).rrCap).sort() };
  });
  T('O4 back online they go in, oldest first (#49 then #50), and leave the phone', o2.n === 2 && o2.left === 0 && o2.rows.join() === '49:RRB-OFF0000001,50:RRB-OFF0000002', o2);
  T('O5 a photo staged offline goes up carrying its sticker', o2.ups.join() === 'RRB-OFF0000001,RRB-OFF0000002', o2.ups);
  T('O6 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── I · Identify ───────────────────────────────────────────────────────────
async function identifyRun(browser) {
  console.log('\n== I · Identify ==');
  const { pg, errs } = await world(browser);
  await openColl(pg, 'c7');
  const i = await pg.evaluate(async () => {
    const o = {};
    const r = await rrCaptureWrite({ sticker: 'RRB-IDENT00001', place: { loc: 'Warehouse', spot: 'Shelf 2' } });
    o.inv = r.inv; o.row = r.rec.row;
    // the Inbox's add, with the item's photos: found by their sticker stamp
    window._pinShared._groups = [{ key: 'gX', files: [{ id: 'PH1', name: 'INBOX 1 g1-1 p1.jpg', appProperties: { rrCap: 'RRB-IDENT00001' } }] }];
    const probe = {}; o.aimed = rrCaptureFillFor(probe, ['PH1']);
    o.flags = [probe._fillItemMode, probe._fillTargetKey, probe._existingInventoryId, probe.location, probe.locationDetail];
    o.unrelated = rrCaptureFillFor({}, ['NOPE']);
    // the wizard's save, aimed at the row
    const before = window.__S.S7['My Collection'].length;
    openWizard('collection');
    for (let k = 0; k < 60 && !(wizard && wizard.data && wizard.steps); k++) await new Promise(z => setTimeout(z, 50));
    rrCaptureAim(wizard.data, state.personalData[r.inv]);
    Object.assign(wizard.data, { itemNum: '3656', itemCategory: 'lionel', condition: '7', priceItem: '40' });
    await saveWizardItem();
    await new Promise(z => setTimeout(z, 800));
    const F = PERSONAL_FIELD_INDEX, row = window.__S.S7['My Collection'][r.rec.row - 1];
    o.rows = [before, window.__S.S7['My Collection'].length];
    o.sheet = [row[F.itemNum], row[F.inventoryId], row[F.stickerCode], row[F.location], row[F.locationDetail], row[F.condition], row[F.dateAdded]];
    o.live = state.personalData[r.inv] && [state.personalData[r.inv].itemNum, rrToIdentify(state.personalData[r.inv])];
    o.copies = Object.values(state.personalData).filter(p => p.inventoryId === r.inv).length;
    return o;
  });
  T('I1 the Inbox add finds the captured row by its photos\' sticker stamp', i.aimed === i.inv && i.flags.join() === 'true,' + i.inv + ',' + i.inv + ',Warehouse,Shelf 2', i);
  T('I2 photos with no sticker stamp aim at nothing', i.unrelated === '', i.unrelated);
  T('I3 the add FILLS the same row — no new row', i.rows[0] === i.rows[1], i.rows);
  T('I4 …same inventory number, sticker, shelf and date; the item number and condition filled in', i.sheet[0] === '3656' && i.sheet[1] === i.inv && i.sheet[2] === 'RRB-IDENT00001' && i.sheet[3] === 'Warehouse' && i.sheet[4] === 'Shelf 2' && i.sheet[5] === '7' && /^\d{4}-\d\d-\d\d$/.test(i.sheet[6]), i.sheet);
  T('I5 …and it is no longer "not identified yet" — one copy', i.live && i.live[0] === '3656' && i.live[1] === false && i.copies === 1, i);
  T('I6 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── B · blank labels ───────────────────────────────────────────────────────
async function blankRun(browser) {
  console.log('\n== B · Print blank labels ==');
  const { pg, errs } = await world(browser);
  await openColl(pg, 'c7');
  await pg.addScriptTag({ path: JSPDF });
  const b = await pg.evaluate(async () => {
    const o = {};
    const codes = rrCaptureBlankCodes(300);
    o.n = codes.length; o.unique = new Set(codes).size;
    o.shape = codes.every(c => /^RRB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(c));
    o.notApp = codes.every(c => !rrStickerParseApp(c));
    o.free = codes.every(c => rrCaptureStickerProblem(c) === '');
    o.jspdf = !!(window.jspdf && window.jspdf.jsPDF);
    rrCaptureBlankOpen();
    const box = document.getElementById('rr-capture-blank');
    box.querySelector('[data-blank-n]').value = '0'; box.querySelector('[data-blank-go]').click();
    o.bad = box.querySelector('[data-blank-msg]').textContent;
    box.querySelector('[data-blank-n]').value = '30'; box.querySelector('[data-blank-go]').click();
    for (let k = 0; k < 60 && document.getElementById('rr-capture-blank'); k++) await new Promise(z => setTimeout(z, 100));
    o.toast = (window.__toasts || []).slice(-1)[0] || '';
    return o;
  });
  T('B1 300 codes, all different, RRB- + 10 letters with no 0/O or 1/I', b.n === 300 && b.unique === 300 && b.shape, b);
  T('B2 never read as one of the app\'s own printed labels, and all free', b.notApp && b.free, b);
  T('B3 a count out of range makes no file and says why', /from 1 to 300/.test(b.bad), b.bad);
  T('B4 the label sheet is made (PDF)', b.jspdf && /30 blank labels ready/.test(b.toast), b);
  T('B5 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── A + X ──────────────────────────────────────────────────────────────────
async function doorRun(browser) {
  console.log('\n== A · archived  /  X · a regular customer ==');
  let { pg, errs } = await world(browser);
  await openColl(pg, 'c7');
  const a = await pg.evaluate(async () => {
    const o = {};
    _pinGo(); await new Promise(z => setTimeout(z, 300));
    o.btnActive = rrCaptureButtonSync() && document.getElementById('pin-capture-btn').style.display !== 'none' && document.getElementById('pin-capture-btn').textContent === 'Capture items';
    await rrArchiveCollection('c7', { anyway: true });
    o.archived = rrCollectionIsArchived('c7');
    o.open = rrCaptureOpen();
    o.btn = rrCaptureButtonSync();
    o.write = (await rrCaptureWrite({ sticker: 'RRB-ARCH000001', place: { loc: 'Warehouse', spot: '' } })).why;
    return o;
  });
  T('A0 Pro on, an active collection: the Photo Inbox shows Capture items', a.btnActive, a);
  T('A1 an archived collection: Capture does not open, no button, nothing written', a.archived && a.open === false && a.btn === false && a.write === 'archived', a);
  T('A2 no page errors', errs.length === 0, errs);
  await pg.close();
  ({ pg, errs } = await world(browser, { off: true }));
  const x = await pg.evaluate(async () => { _pinGo(); await new Promise(z => setTimeout(z, 300)); return rrCaptureButtonSync() === false && document.getElementById('pin-capture-btn').style.display === 'none'; });
  T('X1 a regular customer (Pro off): no Capture items button', x);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await lookRun(browser);
    await loopRun(browser);
    await offlineRun(browser);
    await identifyRun(browser);
    await blankRun(browser);
    await doorRun(browser);
  } catch (e) { T('the run itself', false, e && e.stack); }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  capture_pro_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
