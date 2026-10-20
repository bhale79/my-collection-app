#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ONE PICTURE READER, RELEASE 2 — v0.9.1977
//
// Brad, 2026-10-17: "all readers, i mean all, should read the same way,
// barcode first because its fast, then switch to the other" → release 1
// (v0.9.1975: Photo ID on the Add screen) → "yes" to release 2: every other
// screen onto the same reader, the old copies deleted.
//
//   S1  THE ONE DOOR: a picture is read (barcode detector, ZXing, the label
//       reader, the closer look) only inside the one reader's own functions —
//       plus the three that read TEXT off a screenshot or a business card
//   S2  the old live-camera scanners are gone from the code
//   S3  every screen that opens the reader hands it that screen's filters:
//       Photo ID, the tender's Photo ID, Research, the Your Picture box,
//       Identify from photo
//   B1  the filters as one shape: Research's "pw" is the reader's "postwar";
//       a row fits when its catalog, period and scale agree
//   B2  the Your Picture box: 6556 inside Lionel O is the answer; 43725 (only a
//       Marklin HO row) is offered as outside the filters, never "sure"
//   B3  Identify from photo goes through the same door, with its filters
//   B4  Photo ID with a screen's own filters (Research's shape)
//   B5  the tender's Photo ID opens with the Add screen's filters
//   B6  Research hands over its filters, read at the moment of reading
//   B7  the Photo Inbox reader finds barcodes the way Photo ID does
//       (_biDetectCanvas — the one with ZXing, which iPhones need)
//   B8  the box-label rules (Lionel's "6-36814", MTH's "10-2210") now live in
//       the Photo Inbox reader too
//   X*  PLANTED: each undone, or a screen reading another way, is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium, acorn;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  one_reader_1977_tests needs playwright and it is not installed.'); process.exit(1); }
try { acorn = require('acorn'); }
catch (e) { console.log('FAILED  —  one_reader_1977_tests needs acorn and it is not installed.'); process.exit(1); }
const APPDIR = path.join(__dirname, '..', 'app');
const FILES = {};
fs.readdirSync(APPDIR).filter(f => f.endsWith('.js')).forEach(f => { FILES[f] = fs.readFileSync(path.join(APPDIR, f), 'utf8'); });
// The Photo Inbox is one feature in pieces (tests/lib/pin-source.js): it is scanned — and planted — as ONE 'photo-inbox.js'.
(function () { const m = require('./lib/pin-source').pinMerge(FILES); Object.keys(FILES).forEach(k => { if (!(k in m)) delete FILES[k]; }); Object.assign(FILES, m); })();
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

// ── the scanner: every picture-read call, and the function it sits in ───────
const PRIM = /BarcodeDetector\s*\(|readBarcodesFromImageData\s*\(|\.recognize\s*\(|rrFreeReadBlob\s*\(|_freeReadBlob\s*\(|_biReadPicture\s*\(/g;
// where each kind of read may happen — the one reader, and nothing else
const ALLOWED = {
  'BarcodeDetector(': ['barcode.js:_biDetectCanvas', 'barcode.js:_biCapture', 'photo-inbox.js:_barcodeCodes',
                       'barcode.js:window._decodeQrText'],   // a QR code on a business card (Contacts)
  'readBarcodesFromImageData(': ['barcode.js:_biDetectCanvas', 'barcode.js:_bcDetectView', 'barcode.js:window._decodeQrText'],
  '.recognize(': ['barcode.js:_biReadPicture', 'photo-inbox.js:_freeReadBlob',
                  // TEXT off a screenshot of a web page / a business card — not a picture of an item
                  'photo-inbox.js:_pinProcessShot', 'wizard-photos.js:_wireIdentifyModalV2', 'contacts.js:_ocrReadCard'],
  'rrFreeReadBlob(': ['barcode.js:_biReadPicture'],
  '_freeReadBlob(': ['photo-inbox.js:_freeReadBlob', 'photo-inbox.js:window.rrFreeReadBlob', 'photo-inbox.js:_freeReadOne',
                     'photo-inbox.js:window.rrIdentifyFree', 'photo-inbox.js:window._pinRescan'],
  '_biReadPicture(': ['barcode.js:_biReadPicture', 'barcode.js:_biPipelineCore', 'barcode.js:openBoxIdentify', 'barcode.js:rrReadPictureFile'],
};
function scanFile(f, src) {
  const out = { reads: [], calls: [], names: [] };
  let ast; const comments = [];
  try { ast = acorn.parse(src, { ecmaVersion: 2022, onComment: (b, t, s, e) => comments.push([s, e]) }); }
  catch (e) { out.parseError = e.message; return out; }
  const fnr = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'FunctionDeclaration') fnr.push([n.start, n.end, n.id.name]);
    if (n.type === 'VariableDeclarator' && n.init && /Function/.test(n.init.type)) fnr.push([n.init.start, n.init.end, n.id.name]);
    if (n.type === 'AssignmentExpression' && /Function/.test(n.right.type)) {
      const l = n.left; fnr.push([n.right.start, n.right.end, l.type === 'MemberExpression' ? (l.object.name || '?') + '.' + (l.property.name || l.property.value) : l.name]);
    }
    if (n.type === 'CallExpression') {
      const c = n.callee, nm = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' ? (c.property.name || '') : '');
      if (/^(openBoxIdentify|rrReadPictureFile|rrIdentifyFree)$/.test(nm)) out.calls.push({ name: nm, line: src.slice(0, n.start).split('\n').length, args: n.arguments.map(a => src.slice(a.start, a.end)) });
    }
    if (n.type === 'Identifier' && /^(openBarcodeScanner|openLabelScanner|_wizScanLabel)$/.test(n.name)) out.names.push(n.name);
    if (n.type === 'MemberExpression' && !n.computed && /^(openBarcodeScanner|openLabelScanner|_wizScanLabel)$/.test(n.property.name || '')) out.names.push(n.property.name);
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(w); else if (v && typeof v.type === 'string') w(v); }
  })(ast);
  let m; PRIM.lastIndex = 0;
  while ((m = PRIM.exec(src))) {
    const i = m.index;
    if (comments.some(([a, b]) => i >= a && i < b)) continue;
    const enc = fnr.filter(([a, b]) => i >= a && i < b).sort((x, y) => (x[1] - x[0]) - (y[1] - y[0])).find(x => !/^\?/.test(x[2]));
    out.reads.push({ kind: m[0].replace(/\s+/g, ''), where: f + ':' + (enc ? enc[2] : '(top)'), line: src.slice(0, i).split('\n').length });
  }
  return out;
}
function scanAll(files) {
  const r = { strays: [], names: [], calls: [], parse: [] };
  Object.keys(files).forEach(f => {
    const s = scanFile(f, files[f]);
    if (s.parseError) r.parse.push(f + ': ' + s.parseError);
    s.reads.forEach(x => { if ((ALLOWED[x.kind] || []).indexOf(x.where) < 0) r.strays.push(x.where + ' line ' + x.line + ' ' + x.kind); });
    s.names.forEach(n => r.names.push(f + ': ' + n));
    s.calls.forEach(c => r.calls.push(Object.assign({ file: f }, c)));
  });
  // S3 — every door is opened with the screen's filters
  r.unfiltered = r.calls.filter(c => {
    if (c.name === 'openBoxIdentify') return !(c.args.length >= 4 && /\b(addFilters|prefer|preferFrom)\s*:/.test(argText(files[c.file], c.args[3])));
    if (c.name === 'rrReadPictureFile') return !(c.args.length >= 2 && /\b(addFilters|prefer)\s*:/.test(c.args[1]));
    if (c.name === 'rrIdentifyFree') return !(c.args.length >= 2 && c.args[1] !== 'null' && c.args[1] !== 'undefined');
    return false;
  }).map(c => c.file + ':' + c.line + ' ' + c.name + '(' + c.args.join(', ').slice(0, 80) + ')');
  // the Your Picture box reads with the Add screen's filters
  r.picFirst = /window\.rrReadPictureFile\(f, \{[\s\S]{0,200}?addFilters: true/.test(files['wizard.js'] || '');
  // the closer look skips the barcode the one reader already looked for, and uses the shared detector
  r.inboxBc = /async function _barcodeCodes\(blob\) \{[\s\S]{0,400}?window\._biDetectCanvas\(cv\)/.test(files['photo-inbox.js'] || '')
    && /var bc = \(opt && opt\.barcodeDone\) \? null : await _readBarcode\(blob, prefer\);/.test(files['photo-inbox.js'] || '');
  return r;
}
// an argument passed by name (Photo ID's `_start`) is judged by what it was set to
function argText(src, a) {
  if (!/^[A-Za-z_$][\w$]*$/.test(a)) return a;
  const m = new RegExp('var ' + a.replace(/\$/g, '\\$') + ' = (\\{[^;]*\\});').exec(src || '');
  return m ? m[1] : a;
}
function withFile(f, src) { const o = Object.assign({}, FILES); o[f] = src; return o; }

(async () => {
  console.log('== S · the one door (source) ==');
  let s = scanAll(FILES);
  T('S0 every app file parses', s.parse.length === 0, s.parse);
  T('S1 every picture read happens inside the one reader (or reads text off a screenshot / card)', s.strays.length === 0, s.strays);
  T('S2 the old scanners are gone: no openBarcodeScanner, openLabelScanner or _wizScanLabel in the code', s.names.length === 0, s.names);
  T('S3 every screen opens the reader with its own filters', s.unfiltered.length === 0, s.unfiltered);
  const opened = s.calls.map(c => c.file + ':' + c.name).sort();
  T('S3 …and the doors are the ones expected: Photo ID, tender, Research, Your Picture, Identify from photo',
    ['photo-inbox.js:rrReadPictureFile', 'research.js:openBoxIdentify', 'wizard-handlers.js:openBoxIdentify', 'wizard-photos.js:openBoxIdentify',
     'wizard-photos.js:rrIdentifyFree', 'wizard.js:rrReadPictureFile'].every(k => opened.indexOf(k) >= 0), opened);
  T('S3 the Your Picture box reads with the Add screen\'s filters', s.picFirst);
  T('S4 the Photo Inbox reader finds barcodes with the shared detector, and not twice', s.inboxBc);

  console.log('== X · planted offenders (source) ==');
  let x;
  x = scanAll(withFile('wizard.js', FILES['wizard.js'] + '\nfunction _sneakyRead(b) { return new window.BarcodeDetector().detect(b); }\n'));
  T('X1 PLANTED: a screen with its own barcode read is caught', x.strays.some(v => /_sneakyRead/.test(v)), x.strays);
  x = scanAll(withFile('research.js', FILES['research.js'] + '\nasync function _sneakyOcr(c) { var T = await window._ensureTesseract(); return T.recognize(c, "eng", {}); }\n'));
  T('X2 PLANTED: a screen with its own label read is caught', x.strays.some(v => /_sneakyOcr/.test(v)), x.strays);
  x = scanAll(withFile('wizard-photos.js', FILES['wizard-photos.js'] + '\nfunction _oldWay() { window.openBarcodeScanner(function () {}, null, ""); }\n'));
  T('X3 PLANTED: the old scanner coming back is caught', x.names.some(v => /openBarcodeScanner/.test(v)), x.names);
  x = scanAll(withFile('wizard-handlers.js', planted(FILES['wizard-handlers.js'], '}, eraHint, { addFilters: true });', '}, eraHint);', 'tender filters')));
  T('X4 PLANTED: the tender\'s Photo ID without the filters is caught', x.unfiltered.some(v => /wizard-handlers/.test(v)), x.unfiltered);
  x = scanAll(withFile('research.js', planted(FILES['research.js'], "      { preferFrom:", "      { unused:", 'research filters')));
  T('X5 PLANTED: Research without its filters is caught', x.unfiltered.some(v => /research/.test(v)), x.unfiltered);
  x = scanAll(withFile('wizard-photos.js', planted(FILES['wizard-photos.js'], 'window.rrIdentifyFree(_identifyPhotoFile, _identifyReaderPrefer())', 'window.rrIdentifyFree(_identifyPhotoFile)', 'identify filters')));
  T('X6 PLANTED: Identify from photo without its filters is caught', x.unfiltered.some(v => /rrIdentifyFree/.test(v)), x.unfiltered);
  x = scanAll(withFile('wizard.js', planted(FILES['wizard.js'], '    addFilters: true,   // v0.9.1977: the same filters Photo ID beside it reads with\n', '', 'your picture filters')));
  T('X7 PLANTED: the Your Picture box without the filters is caught', x.unfiltered.some(v => /wizard\.js/.test(v)) && !x.picFirst, x.unfiltered);
  x = scanAll(withFile('photo-inbox.js', planted(FILES['photo-inbox.js'], 'return await window._biDetectCanvas(cv);', 'return [];', 'shared detector')));
  T('X8 PLANTED: the Photo Inbox barcode read off the shared detector is caught', !x.inboxBc);

  // ── B · the browser ──────────────────────────────────────────────────────
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const ROWS = [
    { itemNum: '6556', variation: '', _tab: 'Lionel PW - Items', _era: 'pw', manufacturer: 'Lionel', roadName: 'M-K-T', itemType: 'Stock Car', description: 'M-K-T Stock Car', yearProd: '1958' },
    { itemNum: '43725', variation: '', _tab: 'Marklin H0', _era: 'marklin_h0', manufacturer: 'Marklin', roadName: '', itemType: 'Passenger Car', description: 'Add-On Car for the ICE 4', yearProd: '2022' },
    { itemNum: '36814', variation: '', _tab: 'Lionel MPC-Modern', _era: 'mpc', manufacturer: 'Lionel', roadName: 'Rio Grande', itemType: 'Caboose', description: 'Animated Caboose', yearProd: '1998' },
    { itemNum: '10-2210', variation: '', _tab: 'MTH O', _era: 'mth_o', manufacturer: 'MTH', roadName: '', itemType: 'Diesel', description: 'Diesel Engine', yearProd: '2000' },
  ];
  async function boot(o) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 737 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', rt => {
      const u = rt.request().url(), base = u.split('?')[0];
      if (!u.startsWith('file://')) return rt.abort();
      if (o.src && o.src['photo-inbox.js'] && require('./lib/pin-source').pinFulfill(rt, u, o.src['photo-inbox.js'])) return;
      const f = Object.keys(o.src || {}).find(k => base.endsWith('/app/' + k));
      if (f) return rt.fulfill({ body: o.src[f], contentType: 'application/javascript' });
      return rt.continue();
    });
    await pg.goto('file://' + path.join(APPDIR, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    await pg.evaluate(([rows, o]) => {
      state.masterData = []; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
      state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
      window.__picker = 0; window.__pref = 'never called';
      window.Tesseract = { recognize: async () => ({ data: { text: '' } }),
        createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: { text: o.ocr || '' } }) }) };
      window._ensureTesseract = async () => window.Tesseract;
      if (o.realReader) { state.masterData = rows.slice(); _rebuildMasterIndex(); }   // the Photo Inbox reader asks the loaded catalog
      if (!o.realReader) window.rrFreeReadBlob = async (blob, dim, pref) => { window.__pref = pref; return { num: o.says, matched: true }; };
      try { _aiUsageMarkSeen(); } catch (e) {}
      wizard.data = wizard.data || {};
      Object.assign(wizard.data, { _searchFilterManufacturer: 'Lionel', _searchFilterScale: 'O', _searchFilterPeriod: '' });
    }, [ROWS, { says: o.says || '6556', realReader: !!o.realReader, ocr: o.ocr || '' }]);
    return { pg, ctx, errs };
  }
  // a red picture, then the read — the read is a function run in the page
  const blobRead = async (pg, fn, arg) => {
    await pg.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 400, 300);
      window.__blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    });
    const res = await pg.evaluate(fn, arg === undefined ? null : arg);
    return { res: JSON.parse(JSON.stringify(res || null)), pref: await pg.evaluate(() => window.__pref) };
  };
  const runPid = (pg, opts) => pg.evaluate(async (opts) => {
    if (opts.preferFrom) opts.prefer = window.rrReaderPreferFrom(opts.preferFrom);
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 400, 300);
    let res = null, done = false, pickerText = '';
    window._biPipelineOnCanvas(c, opts).then(v => { res = v; done = true; });
    for (let i = 0; i < 200 && !done; i++) {
      await new Promise(z => setTimeout(z, 100));
      const pk = document.getElementById('barcode-candidate-overlay');
      if (pk && !pk.__seen) {
        pk.__seen = true; window.__picker++; pickerText = pk.textContent.replace(/\s+/g, ' ');
        const first = pk.querySelector('.bc-cand[data-idx="0"]'); if (first) first.click();
      }
    }
    const o = document.getElementById('bi-overlay'); if (o) o.remove();
    return { item: res && res.itemNum, picker: window.__picker, pickerText, pref: window.__pref };
  }, opts);

  console.log('== B1 · the filters as one shape ==');
  let b = await boot({});
  let f = await b.pg.evaluate((rows) => {
    const p = window.rrReaderPreferFrom({ mfr: 'Lionel', period: 'pw', scale: '', type: '' });
    const o = window.rrReaderPreferFrom({ manufacturer: 'Lionel', scale: 'O' });
    const mpc = { itemNum: '6556', _era: 'mpc', yearProd: '1990' };
    return { p, o, fitsPw: window.rrRowFitsPrefer(rows[0], p), fitsMk: window.rrRowFitsPrefer(rows[1], p), fitsMpc: window.rrRowFitsPrefer(mpc, p),
             none: window.rrReaderPreferFrom({}), add: window._wizReaderPrefer() };
  }, ROWS);
  T('B1 Research\'s "pw" becomes the reader\'s "postwar"; Lionel\'s catalogs, never Marklin\'s', f.p && f.p.period === 'postwar' && f.p.eras.indexOf('pw') >= 0 && f.p.eras.indexOf('marklin_h0') < 0, f.p);
  T('B1 a Lionel postwar row fits Lionel + postwar; a Marklin row and a modern Lionel row do not', f.fitsPw === true && f.fitsMk === false && f.fitsMpc === false, f);
  T('B1 the Add screen\'s filters are the same shape, from the same builder (Lionel + O)', JSON.stringify(f.add) === JSON.stringify(f.o), { add: f.add, o: f.o });
  T('B1 nothing set → no preference', f.none === null, f.none);
  T('page errors', b.errs.length === 0, b.errs);
  await b.ctx.close();

  console.log('== B2 · the Your Picture box ==');
  b = await boot({ says: '6556' });
  let r = await blobRead(b.pg, () => window.rrReadPictureFile(window.__blob, { addFilters: true }));
  T('B2 the reader gets the Add screen\'s filters (Lionel, O)', r.pref && r.pref.manufacturer === 'Lionel' && r.pref.scale === 'O' && r.pref.eras.indexOf('pw') >= 0, r.pref);
  T('B2 6556 read, inside Lionel O → the answer', r.res && r.res.kind === 'sure' && r.res.item.row.itemNum === '6556', r.res);
  await b.ctx.close();
  b = await boot({ says: '43725' });
  r = await blobRead(b.pg, () => window.rrReadPictureFile(window.__blob, { addFilters: true }));
  T('B2 43725 read (only a Marklin HO row) → offered as outside the filters, never "sure"',
    r.res && r.res.kind === 'choices' && r.res.outside === true && r.res.items.some(i => i.row.itemNum === '43725'), r.res);
  let shown = await b.pg.evaluate(() => { const d = document.createElement('div'); d.id = 'wiz-picfirst-result'; document.body.appendChild(d);
    _wizPicFirstShow({ kind: 'choices', outside: true, items: [{ num: '43725', row: { itemNum: '43725', description: 'Add-On Car' } }] }); return d.textContent; });
  T('B2 …and the box says so', /outside it/.test(shown) && /43725/.test(shown), shown);
  r = await blobRead(b.pg, () => window.rrReadPictureFile(window.__blob, {}));
  T('B2 the same read with no filters (a neutral read) takes 43725 — the filters are what decide', r.res && r.res.kind === 'sure' && r.res.item.row.itemNum === '43725', r.res);
  await b.ctx.close();

  console.log('== B3 · Identify from photo ==');
  b = await boot({ says: '6556' });
  r = await blobRead(b.pg, () => window.rrIdentifyFree(window.__blob, window.rrReaderPreferFrom({ manufacturer: 'Lionel', scale: 'O' })));
  T('B3 it reads through the one door, with its filters, and answers 6556 with the maker', r.res && r.res.itemNum === '6556' && r.res.manufacturer === 'Lionel' && r.pref && r.pref.scale === 'O', r);
  await b.ctx.close();
  b = await boot({ says: '43725' });
  r = await blobRead(b.pg, () => window.rrIdentifyFree(window.__blob, window.rrReaderPreferFrom({ manufacturer: 'Lionel', scale: 'O' })));
  T('B3 43725 is outside Lionel O → no answer (the screen carries on to its next step)', r.res === null, r.res);
  await b.ctx.close();

  console.log('== B4 · Photo ID with a screen\'s own filters ==');
  b = await boot({ says: '43725' });
  let m = await runPid(b.pg, { noAi: true, preferFrom: { mfr: 'Lionel', period: 'pw' } });
  T('B4 the reader gets the screen\'s filters (Lionel, postwar)', m.pref && m.pref.manufacturer === 'Lionel' && m.pref.period === 'postwar', m.pref);
  T('B4 43725 → NOT "Found it": offered under "Outside your filter"', m.picker === 1 && /Outside your filter/.test(m.pickerText), m);
  await b.ctx.close();
  b = await boot({ says: '6556' });
  m = await runPid(b.pg, { noAi: true, preferFrom: { mfr: 'Lionel', period: 'pw' } });
  T('B4 6556 → straight to it, no list', m.item === '6556' && m.picker === 0, m);
  await b.ctx.close();

  console.log('== B5 · B6 · the tender and Research open with their filters ==');
  b = await boot({});
  f = await b.pg.evaluate(() => {
    const got = {};
    window.openBoxIdentify = function (a, c, era, start) { got.start = start; };
    _wizTenderPhotoId();
    const tender = got.start;
    localStorage.setItem('lv_rsq_mfr', 'Lionel'); localStorage.setItem('lv_rsq_era', 'pw'); localStorage.setItem('lv_rsq_scale', '');
    got.start = null; window.openResearch();
    const rs = got.start;
    const p1 = rs && rs.preferFrom && rs.preferFrom();
    localStorage.setItem('lv_rsq_mfr', 'Marklin');   // changed in its Filters panel after it opened
    const p2 = rs && rs.preferFrom && rs.preferFrom();
    window._researchActive = false;
    return { tender: tender && { addFilters: tender.addFilters }, p1, p2 };
  });
  T('B5 the tender\'s Photo ID opens with the Add screen\'s filters', f.tender && f.tender.addFilters === true, f.tender);
  T('B6 Research hands over its filters (Lionel, postwar)', f.p1 && f.p1.manufacturer === 'Lionel' && f.p1.period === 'postwar', f.p1);
  T('B6 …asked at the moment of reading: changed in its Filters panel, the new ones count', f.p2 && /m.rklin/i.test(f.p2.manufacturer), f.p2);
  T('page errors', b.errs.length === 0, b.errs);
  await b.ctx.close();

  console.log('== B7 · the Photo Inbox reader finds barcodes the way Photo ID does ==');
  b = await boot({ realReader: true });
  r = await blobRead(b.pg, async () => {
    window.__bd = 0; window._biDetectCanvas = async () => { window.__bd++; return [{ rawValue: '036000291452', format: 'upc_a' }]; };
    window._barcodeDebug.decodeBarcode = async () => ({ itemNum: '6556', masterItem: state.masterAllRows[0] });
    const r = await window.rrFreeReadBlob(window.__blob, 800, null); return { r, bd: window.__bd };
  });
  T('B7 the barcode is found by the shared detector and named by the catalog', r.res && r.res.bd === 1 && r.res.r && r.res.r.num === '6556' && r.res.r.matched === true, r.res);
  await b.ctx.close();

  console.log('== B8 · the box-label rules in the Photo Inbox reader ==');
  // Lionel prints "6-36814" on the box; the catalog files it as 36814. MTH
  // prints "10-2210". Without Photo ID's box-label rules this reader read both
  // and confirmed neither (measured: 36814 unconfirmed, "2210" unconfirmed).
  const readBox = (ocr, pref) => async () => { const b = await boot({ realReader: true, ocr });
    const r = await blobRead(b.pg, (pref) => { window._biDetectCanvas = async () => []; return window.rrFreeReadBlob(window.__blob, 800, pref ? window.rrReaderPreferFrom(pref) : null, { barcodeDone: true }); }, pref);
    await b.ctx.close(); return r.res; };
  r = await readBox('6-36814 LIONEL 7745 1998', null)();
  T('B8 a Lionel box\'s "6-36814", read with no filters → 36814, confirmed', r && r.num === '36814' && r.matched === true && r.dbg && r.dbg.boxLabel === '6-36814', r);
  r = await readBox('MTH RAILKING 10-2210 5000', null)();
  T('B8 an MTH box\'s "10-2210" → 10-2210, confirmed (not the bare 2210)', r && r.num === '10-2210' && r.matched === true, r);
  r = await readBox('6-36814 LIONEL 7745 1998', { manufacturer: 'MTH' })();
  T('B8 …but never outside the screen\'s filters (filtered to MTH, 36814 is not confirmed)', !(r && r.num === '36814' && r.matched === true), r);

  console.log('== X · planted offenders (browser) ==');
  const PI = FILES['photo-inbox.js'];
  b = await boot({ realReader: true, ocr: '6-36814 LIONEL 7745 1998', src: { 'photo-inbox.js': planted(PI, "typeof window._extractItemNumberCandidates === 'function' && typeof findMaster === 'function'", 'false', 'box-label rules') } });
  r = await blobRead(b.pg, () => { window._biDetectCanvas = async () => []; return window.rrFreeReadBlob(window.__blob, 800, null, { barcodeDone: true }); });
  T('X-B8 PLANTED: the box-label rules taken out → 6-36814 is not confirmed (caught)', !(r.res && r.res.matched === true), r.res);
  await b.ctx.close();
  const BC = FILES['barcode.js'];
  b = await boot({ says: '43725', src: { 'barcode.js': planted(BC, "var _fitI = items.filter(function (x) { return _biFits(x.row, _ro); });", "var _fitI = items;", 'your picture fit') } });
  r = await blobRead(b.pg, () => window.rrReadPictureFile(window.__blob, { addFilters: true }));
  T('X-B2 PLANTED: the Your Picture box ignoring the filters → 43725 is "sure" (caught)', r.res && r.res.kind === 'sure', r.res);
  await b.ctx.close();
  b = await boot({ says: '6556', src: { 'barcode.js': planted(BC, "var _frPref = _biPreferOf(opts);", "var _frPref = (opts && opts.addFilters && typeof window._wizReaderPrefer === 'function') ? window._wizReaderPrefer() : null;", 'release 1 hand-off') } });
  m = await runPid(b.pg, { noAi: true, preferFrom: { mfr: 'Lionel', period: 'pw' } });
  T('X-B4 PLANTED: the release 1 hand-off (Add screen only) → a screen\'s own filters never reach the reader (caught)', m.pref === null, m.pref);
  await b.ctx.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
