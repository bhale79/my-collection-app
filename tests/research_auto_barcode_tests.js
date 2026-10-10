#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH: A BARCODE THAT NAMES THE ITEM IS THE ANSWER — v0.9.1913
//                         (real Chromium, the REAL app, a fake phone camera)
//
// Brad, 2026-10-09: "if i use it to scan a box and it finds a barcode, it
// should go ahead and research it." His phone's timings (v0.9.1910/1911):
// the app's own work 0.1 s, the camera + crop screens 18-41 s, and on
// cellular a 199 KB Lens upload took 36 s.
//
//   A. Research + a barcode that names ONE exact catalog row → the result
//      card at once: no countdown, no crop screen, no confirm card, no photo
//      sent anywhere; the card says "Found from the barcode (…12345)"
//   B. several real rows → the pick list, then the card
//   C. NOT auto: a Lionel last-5 GUESS (fuzzy), a barcode not in the catalog,
//      and the Add flow (it saves — it keeps photo + crop + confirm)
//   D. each barcode is looked up once per camera screen
//   E. the timings: the look-up is APP time, taken out of the camera wait
//   L. Lens on cellular gets the smaller copy (RR_LENS.CELL_*); Wi-Fi the 1600
//   U. the decluttered screen (title + ✕, one picture row, the boxed Item #,
//      ONE Filters button + pop-up, no auto-capture switch), the Lens-only crop
//      screen, the filters as Lens words, the owner's timing line
//   S. source rules + P planted offenders
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  research_auto_barcode_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail === undefined ? null : detail)).slice(0, 600))); cond ? pass++ : fail++; }
function fnBody(src, header) {
  const s = strip(src), i = s.indexOf(header);
  if (i < 0) return '';
  let k = s.indexOf('{', i), depth = 0, j = k;
  for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (!depth) break; } }
  return s.slice(k, j + 1);
}
// the rule: a fuzzy guess or a not-in-catalog answer never goes straight to the card
function autoRuleSafe(src) {
  const b = fnBody(src, 'function _biAutoOk(r)');
  return /!r\.masterItem\._fuzzy/.test(b) && /!r\.notInMaster/.test(b) && /window\._researchActive && !autoTried\[bc\.rawValue\]/.test(strip(src));
}

const LIONEL = '023922' + '12345' + '6';   // Lionel prefix, last-5 = 12345
const ROW = (o) => Object.assign({ itemNum: '6-12345', description: 'Test boxcar', roadName: 'Test Road', manufacturer: 'Lionel', _era: 'modern', variation: '' }, o || {});

(async () => {
  const B = rd('barcode.js');
  console.log('\n== S · source rules ==');
  T('S1  auto only for a certain answer, only in Research, once per barcode', autoRuleSafe(B));
  T('S2  the camera does NOT send the photo anywhere on the auto path (no photo reader, no Lens)', !/_bcAiRescue|_identifyOpenWithPhoto|driveStage/.test(fnBody(B, 'function _biAutoOk(r)')) && !/cap\.autoResearch[\s\S]{0,1600}?(_bcAiRescue|_identifyOpenWithPhoto|_biPipeline)\(/.test(strip(fnBody(B, 'async function openBoxIdentify('))));
  console.log('\n== P · planted offenders ==');
  T('P1  letting a fuzzy guess through is caught', !autoRuleSafe(B.replace('!r.masterItem._fuzzy', 'true')));
  T('P2  auto in the Add flow too is caught', !autoRuleSafe(B.replace('window._researchActive && !autoTried[bc.rawValue]', '!autoTried[bc.rawValue]')));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(Object.assign(fs.existsSync(ex) ? { executablePath: ex } : {},
    { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }));
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  // the phone's barcode reader, stood in for: shows window.__bc while __bcOn
  await ctx.addInitScript(() => {
    window.__bcCalls = 0;
    window.BarcodeDetector = function () {};
    window.BarcodeDetector.prototype.detect = async function () { window.__bcCalls++; return window.__bcOn ? [{ rawValue: window.__bc, format: window.__bcFmt || 'upc_a' }] : []; };
    window.BarcodeDetector.getSupportedFormats = async function () { return ['upc_a', 'ean_13', 'code_128']; };
  });
  async function boot(rows) {
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg._errs = errs;
    await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    await pg.evaluate((rows) => {
      window.state = window.state || {};
      state.user = { email: 'stranger@example.com', name: 'Auto Test' };
      state.personalData = {};
      var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
      document.getElementById('app').classList.add('active');
      window.showToast = function () {};
      for (var i = 0; i < 4; i++) history.pushState({ t: i }, '', location.href);
      state.masterAllRows = rows;
      window.Tesseract = { recognize: async function () { window.__ocr = (window.__ocr || 0) + 1; return { data: { text: '' } }; } };
    }, rows);
    return pg;
  }
  const lastRec = (pg) => pg.evaluate(() => window._rrResearchLastTiming || null);
  async function scan(pg, code, opts) {
    opts = opts || {};
    await pg.evaluate(([code, add]) => {
      window.__bc = code; window.__bcOn = false;
      if (add) { window._researchActive = false; window.__added = null; openBoxIdentify(function (r) { window.__added = r; }, function () { window.__cancel = 1; }, null); }
      else openResearch();
    }, [code, !!opts.add]);
    await pg.waitForSelector('#bi-video', { timeout: 8000 });
    await pg.waitForFunction(() => { var v = document.getElementById('bi-video'); return v && v.videoWidth > 0; }, null, { timeout: 8000 });
    await pg.waitForTimeout(opts.aim || 600);                 // the person aiming
    await pg.evaluate(() => { window.__bcOn = true; });
  }

  console.log('\n== A · one exact row: the card at once ==');
  {
    const pg = await boot([ROW()]);
    await scan(pg, LIONEL);
    let card = false;
    try { await pg.waitForSelector('#rs-overlay', { timeout: 6000 }); card = true; } catch (e) {}
    const r = await pg.evaluate(() => ({
      card: (document.getElementById('rs-overlay') || {}).innerText || '',
      crop: !!document.querySelector('[data-bi="go"]'), confirm: !!document.querySelector('[data-a="use"]'),
      ocr: window.__ocr || 0,
    }));
    const rec = await lastRec(pg) || {};
    const names = (rec.steps || []).map(s => s[0]);
    T('A1  the research card opens by itself (no tap after the barcode reads)', card && /6-12345/.test(r.card), r.card.slice(0, 160));
    T('A2  no crop screen, no confirm card on the way', names.indexOf('you: crop screen') < 0 && names.indexOf('you: confirm card') < 0 && !r.crop && !r.confirm, names);
    T('A3  the label reader never ran (the barcode answered)', r.ocr === 0 && names.indexOf('label read') < 0, { ocr: r.ocr, names: names });
    T('A4  the card says it came from the barcode, with its last digits', /Found from the barcode \(…23456\)/.test(r.card), r.card.slice(0, 300));
    T('A5  recorded as a found research run with the barcode look-up as APP time', rec.mode === 'research' && rec.outcome === 'found' && names.indexOf('barcode look-up') >= 0, rec);
    const look = (rec.steps || []).find(s => s[0] === 'barcode look-up') || [0, 0], cam = (rec.steps || []).find(s => s[0] === 'you: camera screen') || [0, 0];
    T('E1  app + you = total; the look-up is not also counted as your time', Math.abs(rec.app + rec.you - rec.total) <= 2 && rec.you <= cam[1] + 2 && rec.app >= look[1] - 2, { rec: rec, look: look, cam: cam });
    T('A6  no page errors', pg._errs.length === 0, pg._errs);
    await pg.close();
  }

  console.log('\n== B · several real rows: the pick list, then the card ==');
  {
    const pg = await boot([ROW({ variation: '1', description: 'Test boxcar red' }), ROW({ variation: '2', description: 'Test boxcar blue' })]);
    await scan(pg, LIONEL);
    let picker = false;
    try { await pg.waitForSelector('#barcode-candidate-overlay', { timeout: 6000 }); picker = true; } catch (e) {}
    T('B1  two rows for the barcode → the pick list appears straight away', picker);
    const n = await pg.evaluate(() => { var o = document.getElementById('barcode-candidate-overlay'); return o ? o.querySelectorAll('[data-idx], .bc-cand, button').length : 0; });
    // pick the second (blue) row
    const clicked = await pg.evaluate(() => {
      var o = document.getElementById('barcode-candidate-overlay'); if (!o) return '';
      var el = Array.from(o.querySelectorAll('*')).find(e => /blue/i.test(e.textContent || '') && e.onclick || (/blue/i.test(e.textContent || '') && e.getAttribute && e.getAttribute('data-idx') !== null));
      if (!el) el = Array.from(o.querySelectorAll('[data-idx]'))[1];
      if (el) el.click();
      return el ? (el.textContent || '').slice(0, 60) : '';
    });
    let card = false;
    try { await pg.waitForSelector('#rs-overlay', { timeout: 6000 }); card = true; } catch (e) {}
    const txt = await pg.evaluate(() => (document.getElementById('rs-overlay') || {}).innerText || '');
    T('B2  picking a row opens its research card', card && /6-12345/.test(txt), { clicked: clicked, n: n, txt: txt.slice(0, 200) });
    const rec = await lastRec(pg) || {};
    T('B3  the pick is YOUR time; the run is found', rec.outcome === 'found' && (rec.steps || []).some(s => s[0] === 'you: pick the item'), rec);
    await pg.close();
  }

  console.log('\n== C · not auto ==');
  for (const c of [
    { name: 'C1  a Lionel last-5 GUESS (only a 7-digit row ends in 12345)', rows: [ROW({ itemNum: '2112345' })], code: LIONEL },
    { name: 'C2  a barcode not in the catalog', rows: [ROW({ itemNum: '6-99999' })], code: LIONEL },
    { name: 'C3  the Add flow, even with an exact row', rows: [ROW()], code: LIONEL, add: true },
  ]) {
    const pg = await boot(c.rows);
    await scan(pg, c.code, { add: c.add });
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => ({ card: !!document.getElementById('rs-overlay'), picker: !!document.getElementById('barcode-candidate-overlay'),
      cam: !!document.getElementById('bi-video'), banner: (document.getElementById('bi-lockbanner') || {}).style ? document.getElementById('bi-lockbanner').style.display : '' ,
      stat: (document.getElementById('bi-camstatus') || {}).textContent || '', added: !!window.__added }));
    T(c.name + ' → the camera stays for the picture, as before', !r.card && !r.picker && !r.added && r.cam, r);
    await pg.evaluate(() => { var b = document.querySelector('[data-bi="cancel"]'); if (b) b.click(); });
    await pg.waitForTimeout(300);
    if (c.name.indexOf('C2') === 0) {
      const rec = await lastRec(pg) || {};
      T('D1  …and that barcode was looked up ONCE in 2.5 s of holding it in view', (rec.steps || []).filter(s => s[0] === 'barcode look-up').length === 1, rec.steps);
    }
    await pg.close();
  }

  console.log('\n== U · the decluttered Research screen (v0.9.1913, Brad\'s list) ==');
  {
    const pg = await boot([ROW()]);
    await pg.evaluate(() => {
      localStorage.setItem('lv_rsq_mfr', 'Lionel'); localStorage.setItem('lv_rsq_era', 'pw');
      window.Cropper = function (img) { this.img = img; };
      window.Cropper.prototype.getCroppedCanvas = function () { var c = document.createElement('canvas'); c.width = 400; c.height = 300; return c; };
      window.Cropper.prototype.destroy = function () {}; window.Cropper.prototype.rotateTo = function () {};
      window.__quota = 0; window.rrAiQuotaRefresh = function () { window.__quota++; };
    });
    await scan(pg, '000000000000');                        // a camera screen; nothing to look up
    await pg.evaluate(() => { window.__bcOn = false; });
    await pg.click('[data-bi="snap"]');                    // a picture → the crop screen
    await pg.waitForSelector('#bi-cropimg', { timeout: 6000 });
    const crop = await pg.evaluate(() => ({ acts: Array.from(document.querySelectorAll('#bi-overlay [data-bi]')).map(b => b.getAttribute('data-bi')),
      lens: (document.querySelector('[data-bi="lens"]') || {}).textContent || '', quota: window.__quota, text: document.getElementById('bi-overlay').innerText }));
    T('U1  the crop screen in Research offers Google Lens, Retake, Cancel — no Photo ID, no Auto Read', JSON.stringify(crop.acts.sort()) === '["cancel","lens","retake"]' && /Google Lens/.test(crop.lens) && !/Photo ID|Auto Read/.test(crop.text), crop);
    T('U2  …and does not ask the backend how many photo reads are left', crop.quota === 0, crop.quota);
    await pg.click('[data-bi="cancel"]'); await pg.waitForTimeout(300);
    await pg.evaluate(() => openResearch());
    await pg.waitForFunction(() => { var v = document.getElementById('bi-video'); return v && v.videoWidth > 0; }, null, { timeout: 8000 });
    await pg.waitForTimeout(300);
    const u = await pg.evaluate(() => {
      var ov = document.getElementById('bi-overlay'), card = ov.querySelector('.rr-card');
      var acts = Array.from(ov.querySelectorAll('[data-bi]')).filter(b => !b.closest('#bi-filters-panel')).map(b => b.getAttribute('data-bi'));
      var q = document.getElementById('bi-quick'), box = document.getElementById('bi-itembox');
      return { title: (card.querySelector('.rr-card-title') || {}).textContent || '', close: !!document.getElementById('bi-close'),
        cancelBtns: Array.from(ov.querySelectorAll('[data-bi="cancel"]')).map(b => b.textContent.trim()),
        acts: acts, auto: !!document.getElementById('bi-autosnap'),
        inBox: !!(box && box.contains(q) && box.contains(ov.querySelector('[data-bi="quick"]')) && box.contains(document.getElementById('bi-quick-sug'))),
        label: box ? (box.querySelector('label') || {}).textContent : '',
        attrs: q ? [q.getAttribute('enterkeyhint'), q.getAttribute('autocorrect'), q.getAttribute('autocapitalize'), q.getAttribute('spellcheck')] : [],
        sum: (document.getElementById('bi-filters-sum') || {}).textContent || '',
        panel: getComputedStyle(document.getElementById('bi-filters-panel')).display,
        fits: card.getBoundingClientRect().height <= window.innerHeight, h: [Math.round(card.getBoundingClientRect().height), window.innerHeight] };
    });
    T('U3  title "Research an Item" with ✕ in the corner; no Cancel row', /Research an Item/.test(u.title) && u.close && JSON.stringify(u.cancelBtns) === '["✕"]', u);
    T('U4  one row: Capture · Gallery · Last photo (last photo right of Gallery)', u.acts.indexOf('snap') >= 0 && u.acts.indexOf('gallery') === u.acts.indexOf('snap') + 1 && u.acts.indexOf('last') === u.acts.indexOf('gallery') + 1, u.acts);
    T('U5  no auto-capture switch in Research', u.auto === false, u);
    T('U6  "Item #", the entry, Look up and the suggestions sit in ONE box', u.inBox && u.label === 'Item #', u);
    T('U7  the phone keyboard: Enter says Search; no auto-correct, auto-capitals or spell-check', JSON.stringify(u.attrs) === '["search","off","off","false"]', u.attrs);
    T('U8  ONE Filters button says what is on; the four boxes stay hidden until it is tapped', u.sum === 'Lionel · Postwar' && u.panel === 'none', u);
    T('U9  the whole screen fits a large phone without scrolling', u.fits, u.h);
    await pg.click('#bi-filters-btn');
    const f1 = await pg.evaluate(() => ({ panel: getComputedStyle(document.getElementById('bi-filters-panel')).display, back: !!(window.BackStack && BackStack.has('bi-filters')) }));
    await pg.selectOption('#bi-quick-scale', 'O');
    const f2 = await pg.evaluate(() => ({ sum: document.getElementById('bi-filters-sum').textContent, saved: localStorage.getItem('lv_rsq_scale') }));
    await pg.click('[data-bi="filters-clear"]');
    const f3 = await pg.evaluate(() => ({ sum: document.getElementById('bi-filters-sum').textContent, saved: ['mfr', 'era', 'scale', 'type'].map(k => localStorage.getItem('lv_rsq_' + k) || '') }));
    await pg.click('[data-bi="filters-done"]');
    const f4 = await pg.evaluate(() => ({ panel: getComputedStyle(document.getElementById('bi-filters-panel')).display, back: !!(window.BackStack && BackStack.has('bi-filters')), cam: !!document.getElementById('bi-video') }));
    T('U10 the Filters pop-up opens (and the phone\'s Back button can close it)', f1.panel === 'flex' && f1.back, f1);
    T('U11 a change shows on the button at once and is remembered', f2.sum === 'Lionel · Postwar · O scale' && f2.saved === 'O', f2);
    T('U12 Clear all clears all four', f3.sum === 'none' && f3.saved.join('') === '', f3);
    T('U13 Done closes the pop-up and leaves the camera screen as it was', f4.panel === 'none' && !f4.back && f4.cam, f4);
    await pg.click('#bi-close'); await pg.waitForTimeout(300);
    T('U14 ✕ closes the Research screen', await pg.evaluate(() => !document.getElementById('bi-overlay')));
    // the Add flow's screen keeps its own controls
    await scan(pg, '000000000000', { add: true });
    const a = await pg.evaluate(() => ({ cancel: Array.from(document.querySelectorAll('#bi-overlay [data-bi="cancel"]')).map(b => b.textContent.trim()), auto: !!document.getElementById('bi-autosnap'), item: !!document.getElementById('bi-itembox'), filt: !!document.getElementById('bi-filters-btn') }));
    T('U15 the Add flow keeps Cancel and its auto-capture switch, and has no Item # / Filters', JSON.stringify(a.cancel) === '["Cancel"]' && a.auto && !a.item && !a.filt, a);
    await pg.close();
  }
  {
    // the Research filters go to Google Lens as words ([stated] Brad: "yes")
    const pg = await boot([ROW()]);
    const r = await pg.evaluate(async () => {
      localStorage.setItem('lv_rsq_mfr', 'Lionel'); localStorage.setItem('lv_rsq_era', 'pw');
      localStorage.setItem('lv_rsq_scale', 'O'); localStorage.setItem('lv_rsq_type', 'Diesel Locomotive');
      accessToken = 'test-token';
      window._rrLensFolder = async function () { return 'folder-1'; };
      window.driveUploadFile = async function () { return { id: 'f1' }; };
      window.driveRequest = async function () { return {}; };
      window.__opened = []; window.open = function (u, t, f) { window.__opened.push(String(u)); return null; };
      var c = document.createElement('canvas'); c.width = 300; c.height = 200;
      var b = await new Promise(rs => c.toBlob(rs, 'image/jpeg', 0.8));
      _identifyPhotoFile = new File([b], 'x.jpg', { type: 'image/jpeg', lastModified: 9 });
      window._researchActive = true;
      await _identifyOpenLens();
      var u = window.__opened.pop() || '';
      var q = decodeURIComponent((u.split('&q=')[1] || '').split('&')[0]);
      // and with the filters cleared, Research sends no maker/era words
      ['mfr', 'era', 'scale', 'type'].forEach(k => localStorage.removeItem('lv_rsq_' + k));
      window.__lensMemo = 1;
      _identifyPhotoFile = new File([b], 'y.jpg', { type: 'image/jpeg', lastModified: 10 });
      await _identifyOpenLens();
      var u2 = window.__opened.pop() || '';
      var q2 = decodeURIComponent((u2.split('&q=')[1] || '').split('&')[0]);
      window._researchActive = false;
      return { q: q, q2: q2 };
    });
    T('U16 Research filters reach Google Lens as words (Lionel · postwar · O gauge · Diesel Locomotive)', /Lionel/.test(r.q) && /postwar/.test(r.q) && /O gauge/.test(r.q) && /Diesel Locomotive/.test(r.q), r.q);
    T('U17 …and with none set, no maker or era words are added', !/Lionel|postwar|gauge/i.test(r.q2), r.q2);
    await pg.close();
  }
  {
    // the owner sees the timing line on the card the barcode opens
    const pg = await boot([ROW()]);
    await pg.evaluate(() => { state.user.email = 'bhale@ipd-llc.com'; });
    await scan(pg, LIONEL);
    await pg.waitForSelector('#rs-overlay', { timeout: 6000 });
    const line = await pg.evaluate(() => (document.getElementById('rs-timing') || {}).textContent || '');
    T('U18 the owner\'s research card shows the timing line (barcode look-up as app time)', /App time \d+\.\d s/.test(line) && /waiting on you/.test(line), line);
    await pg.close();
  }

  console.log('\n== L · Lens on cellular gets the smaller copy ==');
  {
    const pg = await boot([ROW()]);
    const r = await pg.evaluate(async () => {
      accessToken = 'test-token';
      window._ups = [];
      window._rrLensFolder = async function () { return 'folder-1'; };
      window.driveUploadFile = async function (file) { window._ups.push(file); return { id: 'f' + window._ups.length }; };
      window.driveRequest = async function () { return {}; };
      async function photo(w, h, n) {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = c.getContext('2d'), img = g.createImageData(w, h);
        for (var i = 0; i < img.data.length; i += 4) { var v = (Math.random() * 255) | 0; img.data[i] = v; img.data[i + 1] = (v * 3) & 255; img.data[i + 2] = (v * 5) & 255; img.data[i + 3] = 255; }
        g.putImageData(img, 0, 0);
        var b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        return new File([b], n, { type: 'image/jpeg', lastModified: w * 7 + h });
      }
      async function dims(f) { var bm = await createImageBitmap(f); return [bm.width, bm.height]; }
      var out = {};
      Object.defineProperty(navigator, 'connection', { configurable: true, get: function () { return { type: 'cellular', effectiveType: '4g', saveData: false }; } });
      var steps = [];
      await driveStageLensPhoto(await photo(3000, 2000, 'a.jpg'), function (n) { steps.push(n); });
      out.cell = await dims(_ups[_ups.length - 1]); out.cellSteps = steps;
      var mid = await photo(700, 500, 'mid.jpg'); out.midSize = mid.size;
      await driveStageLensPhoto(mid); out.midShrunk = _ups[_ups.length - 1] !== mid;
      Object.defineProperty(navigator, 'connection', { configurable: true, get: function () { return { type: 'wifi', effectiveType: '4g', saveData: false }; } });
      await driveStageLensPhoto(await photo(3000, 2000, 'b.jpg'));
      out.wifi = await dims(_ups[_ups.length - 1]);
      Object.defineProperty(navigator, 'connection', { configurable: true, get: function () { return undefined; } });
      await driveStageLensPhoto(await photo(3000, 2001, 'c.jpg'));
      out.none = await dims(_ups[_ups.length - 1]);
      out.limits = [RR_LENS.CELL_MAX_SIDE, RR_LENS.PHOTO_MAX_SIDE, RR_LENS.CELL_SHRINK_OVER_BYTES];
      return out;
    });
    T('L1  on cellular a 3000x2000 shot goes at ' + r.limits[0] + ' px (RR_LENS.CELL_MAX_SIDE)', r.cell[0] === r.limits[0], r);
    T('L2  …and the step says so', r.cellSteps[0] === 'lens: shrink photo (cellular)', r.cellSteps);
    T('L3  on cellular a mid-size photo (' + Math.round(r.midSize / 1024) + ' KB) is shrunk too', r.midSize > r.limits[2] && r.midShrunk, r);
    T('L4  on Wi-Fi it is the ' + r.limits[1] + ' px copy, as v0.9.1911', r.wifi[0] === r.limits[1], r.wifi);
    T('L5  a phone that does not say (iPhone, desktop) gets the Wi-Fi copy', r.none[0] === r.limits[1], r.none);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
