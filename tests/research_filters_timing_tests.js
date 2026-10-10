#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH SCREEN — the filters fit, and every step is timed — v0.9.1910
//                                          (real Chromium, the REAL app)
//
// Brad, 2026-10-09: "the filters at the bottom on my mobile, the y on Any is
// cut off" — and "the speed of the research needs to be as fast as possible".
// Before anything is made faster it is measured on his phone, so this release
// adds step timers and fixes the filters.
//
//   F. every choice in every filter box fits its box — phone widths 320-412
//      (where selects are forced to 16px) and desktop. Measured by the browser
//      itself: a probe box holding just that choice is the width it needs.
//   S. source sweeps: every wait on the person inside the identify flow is
//      booked as YOUR time, every slow app step as APP time — a new picker or
//      reader added later without its timer fails here
//   R. a real run through the flow (photo → crop → Photo ID → confirm → the
//      research card): the record, the owner's line on the card, the steps
//      adding up, what a non-owner and recording mode get, the 25-run cap,
//      a cancelled run
//   P. planted offenders for F and S
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  research_filters_timing_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail === undefined ? null : detail)).slice(0, 600))); cond ? pass++ : fail++; }

// ── S rules: the body of a function, then every await of a named call in it ──
function fnBody(src, header) {
  const s = strip(src), i = s.indexOf(header);
  if (i < 0) return '';
  let k = s.indexOf('{', i), depth = 0, j = k;
  for (; j < s.length; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') { depth--; if (!depth) break; } }
  return s.slice(k, j + 1);
}
// "await X(" with X a timed call must read "await _rtWait('…', X(" / "await _rtTime('…', X("
function untimed(body, names) {
  const bad = [];
  names.forEach(function (n) {
    const re = new RegExp('await\\s+' + n.replace(/\./g, '\\.') + '\\(', 'g');
    let m; while ((m = re.exec(body))) bad.push(n + ' @' + m.index);
  });
  return bad;
}
const WAITS = ['_biCapture', '_biCrop', '_biNumPicker', 'showCandidatePicker', '_bcConfirmCard', '_biFailCard'];
const SLOW  = ['_bcAiRescue', '_ensureTesseract', 'T.recognize', '_biCanvasToFile'];
function flowTimed(src) {
  const core = fnBody(src, 'async function _biPipelineCore(');
  const open = fnBody(src, 'async function openBoxIdentify(');
  return { ok: !!core && !!open && !untimed(core + open, WAITS.concat(SLOW)).length, bad: untimed(core + open, WAITS.concat(SLOW)) };
}

(async () => {
  const B = rd('barcode.js');
  console.log('\n== S · every wait and every slow step in the flow is timed ==');
  const ft = flowTimed(B);
  T('S1  pipeline + openBoxIdentify: no untimed person-wait or slow step', ft.ok, ft.bad);
  T('S2  the pipeline wrapper books the remainder as "catalog & checks"', /_rtStep\('catalog & checks'/.test(fnBody(B, 'async function _biPipeline(')));
  T('S3  the run is closed BEFORE the card draws (found) and in a finally (every other exit)',
    /_rtEnd\('found'\);[^\n]*\n\s*if \(onScanned\) onScanned\(res\)/.test(strip(B)) && /finally \{\s*_rtEnd\('stopped'\)/.test(strip(B)));
  T('S4  research.js shows the line barcode.js builds (one owner of the wording)', /window\.rrResearchTimingLine\(\)/.test(rd('research.js')) && !/App time/.test(rd('research.js')));

  console.log('\n== P · planted offenders (S) ==');
  const plantedWait = B.replace("var cc = await _rtWait('confirm card', _bcConfirmCard(_biInfoFor(res, _aiOffer)));", 'var cc = await _bcConfirmCard(_biInfoFor(res, _aiOffer));');
  T('P1  an untimed confirm card is caught', plantedWait !== B && !flowTimed(plantedWait).ok);
  const plantedAi = B.replace("var aiR = await _rtTime('photo reader', _bcAiRescue(workCanvas, eraHint, out.why, out.bcMaker));", 'var aiR = await _bcAiRescue(workCanvas, eraHint, out.why, out.bcMaker);');
  T('P2  an untimed photo reader call is caught', plantedAi !== B && !flowTimed(plantedAi).ok);

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  async function boot(width, email) {
    const pg = await browser.newPage({ viewport: { width: width, height: 900 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg._errs = errs;
    await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    await pg.evaluate((em) => {
      window.state = window.state || {};
      state.user = { email: em, name: 'Timing Test' };
      state.personalData = {};
      var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
      document.getElementById('app').classList.add('active');
      window.showToast = function () {};
      // a fresh test tab has no history behind the app; the overlays' Back
      // handling (history.back) would walk off the page. A phone always has it.
      for (var i = 0; i < 4; i++) history.pushState({ t: i }, '', location.href);
    }, email || 'stranger@example.com');
    return pg;
  }

  // ── F. the filters fit ──────────────────────────────────────────────────
  // For each box: a probe <select> with the same style, holding ONE choice,
  // sized by the browser (width:auto) = the width that choice needs. Every
  // choice's need must be ≤ the box's real width.
  const measure = () => {
    const sels = Array.from(document.querySelectorAll('#bi-overlay select[id^="bi-quick-"]'));
    const card = document.querySelector('#bi-overlay .rr-card').getBoundingClientRect();
    return sels.map(function (s) {
      const cs = getComputedStyle(s), w = s.getBoundingClientRect();
      const need = Array.from(s.options).map(function (o) {
        const p = document.createElement('select');
        p.style.cssText = s.style.cssText; p.style.flex = 'none'; p.style.width = 'auto'; p.style.minWidth = '0'; p.style.maxWidth = 'none'; p.style.fontSize = cs.fontSize;
        const op = document.createElement('option'); op.textContent = o.textContent; p.appendChild(op);
        document.body.appendChild(p); const n = p.getBoundingClientRect().width; p.remove();
        return { text: o.textContent, need: n };
      });
      return { id: s.id, width: w.width, left: w.left, right: w.right, cardL: card.left, cardR: card.right,
               any: need[0], worst: need.reduce(function (a, b) { return b.need > a.need ? b : a; }) , n: need.length };
    });
  };
  async function filtersAt(width, plantOld) {
    const pg = await boot(width);
    const r = await pg.evaluate(([plant, measureSrc]) => {
      openResearch();
      if (plant) Array.from(document.querySelectorAll('#bi-overlay select[id^="bi-quick-"]')).forEach(function (s) { s.style.flex = '1'; s.style.minWidth = '0'; });   // the v1909 style
      return (new Function('return (' + measureSrc + ')()'))();
    }, [!!plantOld, measure.toString()]);
    await pg.close();
    return r;
  }
  console.log('\n== F · every choice in every filter box fits ==');
  for (const w of [320, 360, 390, 412, 1200]) {
    const r = await filtersAt(w);
    const four = r.length === 4 && r.every(x => x.n > 1);
    T('F' + w + 'a  four filter boxes, each with its choices', four, r.map(x => [x.id, x.n]));
    T('F' + w + 'b  "Any …" fits in every box (Brad\'s cut-off y)', r.every(x => x.any.need <= x.width + 0.5), r.map(x => [x.id, Math.round(x.width), x.any.text, Math.round(x.any.need)]));
    T('F' + w + 'c  EVERY choice fits (longest: ' + r.map(x => x.worst.text).join(', ') + ')', r.every(x => x.worst.need <= x.width + 0.5), r.map(x => [x.id, Math.round(x.width), x.worst.text, Math.round(x.worst.need)]));
    T('F' + w + 'd  no box runs past the card', r.every(x => x.left >= x.cardL - 0.5 && x.right <= x.cardR + 0.5), r.map(x => [x.id, Math.round(x.left), Math.round(x.right), Math.round(x.cardL), Math.round(x.cardR)]));
  }
  const old = await filtersAt(360, true);
  T('P3  the v0.9.1909 style (flex:1 + min-width:0) is caught at 360px', !old.every(x => x.any.need <= x.width + 0.5), old.map(x => [x.id, Math.round(x.width)]));

  // ── R. a real run ───────────────────────────────────────────────────────
  // Desktop upload path (no camera in the test): a picture → the crop screen →
  // Photo ID → the label reader (stood in for: answers "LIONEL 2133031" after
  // 300 ms) → the catalog (one row) → the confirm card → Use this → the card.
  async function run(pg, opts) {
    opts = opts || {};
    await pg.evaluate((o) => {
      window._openCropper = null;                          // full photo, no cropper
      // the crop library comes from a CDN the test blocks — a stand-in that
      // hands back the whole picture, so the crop SCREEN shows as on a phone
      window.Cropper = function (img) { this.img = img; };
      window.Cropper.prototype.getCroppedCanvas = function () { var c = document.createElement('canvas'); c.width = this.img.naturalWidth || 400; c.height = this.img.naturalHeight || 200; c.getContext('2d').drawImage(this.img, 0, 0); return c; };
      window.Cropper.prototype.destroy = function () {};
      window.Cropper.prototype.rotateTo = function () {};
      window.Tesseract = { recognize: function () { return new Promise(function (r) { setTimeout(function () { r({ data: { text: 'LIONEL\n2133031\nTEST HOPPER' } }); }, 300); }); } };
      state.masterAllRows = [{ itemNum: '2133031', description: 'Test hopper', roadName: 'Test Road', manufacturer: 'Lionel', _era: 'modern', variation: '' }];
      if (o.list) localStorage.setItem('rr_research_times_v1', JSON.stringify(o.list));
      openResearch();
    }, opts);
    const c = await pg.evaluateHandle(() => { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 200); g.fillStyle = '#000'; g.font = '40px serif'; g.fillText('2133031', 40, 110); return cv.toDataURL('image/png'); });
    const b64 = (await c.jsonValue()).split(',')[1];
    await pg.setInputFiles('#bi-file', { name: 'box.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    if (opts.cancelAtCrop) {
      await pg.waitForSelector('[data-bi="cancel"]', { timeout: 8000 });
      await pg.waitForTimeout(150);
      await pg.click('[data-bi="cancel"]');
      await pg.waitForTimeout(400);
      return;
    }
    await pg.waitForSelector('[data-bi="go"]', { timeout: 8000 });
    await pg.waitForTimeout(250);                          // a person deciding = YOUR time
    await pg.click('[data-bi="go"]');
    await pg.waitForSelector('[data-a="use"]', { timeout: 15000 });
    await pg.waitForTimeout(200);
    await pg.click('[data-a="use"]');
    await pg.waitForSelector('#rs-overlay', { timeout: 8000 });
  }
  console.log('\n== R · a real run, timed ==');
  {
    const pg = await boot(1200, 'bhale@ipd-llc.com');
    await run(pg);
    const r = await pg.evaluate(() => ({
      rec: window._rrResearchLastTiming,
      list: JSON.parse(localStorage.getItem('rr_research_times_v1') || '[]'),
      stamped: localStorage.getItem('rr_research_times_v1__at') !== null,
      line: (document.getElementById('rs-timing') || {}).textContent || '',
      card: (document.querySelector('#rs-overlay') || {}).textContent || '',
    }));
    const rec = r.rec || {}, steps = rec.steps || [];
    const names = steps.map(s => s[0]);
    const app = steps.filter(s => s[0].indexOf('you: ') !== 0).reduce((a, s) => a + s[1], 0);
    const you = steps.filter(s => s[0].indexOf('you: ') === 0).reduce((a, s) => a + s[1], 0);
    T('R1  the run reached the research card (item 2133031)', /2133031/.test(r.card), r.card.slice(0, 120));
    T('R2  one record: research, found', rec.mode === 'research' && rec.outcome === 'found', { mode: rec.mode, outcome: rec.outcome });
    T('R3  the app steps are there: barcode, label reader start, label read, catalog & checks, photo prep',
      ['barcode', 'label reader start', 'label read', 'catalog & checks', 'photo prep'].every(n => names.indexOf(n) >= 0), names);
    T('R4  the label read took about the 300 ms it did', (function () { const s = steps.find(x => x[0] === 'label read'); return s && s[1] >= 280 && s[1] < 1500; })(), steps);
    T('R5  YOUR time is booked apart: camera screen, crop screen, confirm card', ['you: camera screen', 'you: crop screen', 'you: confirm card'].every(n => names.indexOf(n) >= 0), names);
    T('R6  the crop screen wait (250 ms + a click) is YOUR time, not app time', (function () { const s = steps.find(x => x[0] === 'you: crop screen'); return s && s[1] >= 240; })(), steps);
    T('R7  app + you = total', Math.abs(rec.app + rec.you - rec.total) <= 2, rec);
    T('R8  the YOUR steps add up to "you"', Math.abs(you - rec.you) <= steps.length, { you: you, rec: rec.you });
    T('R9  the app steps add up to no more than the app time (nothing counted twice)', app <= rec.app + 5, { app: app, rec: rec.app });
    console.log('      card line: ' + r.line);
    T('R10 the owner sees one line on the card with the app time and the label read', /App time \d+\.\d s/.test(r.line) && /label read 0\.\d s/.test(r.line) && /waiting on you \d+\.\d s/.test(r.line), r.line);
    T('R11 saved: the last runs, through _prefSet for an owner (reaches the account)', r.list.length === 1 && r.stamped, { n: r.list.length, stamped: r.stamped });
    T('R12 no page errors', pg._errs.length === 0, pg._errs);
    await pg.close();
  }
  {
    const pg = await boot(1200, 'stranger@example.com');
    await run(pg);
    const r = await pg.evaluate(() => ({ line: !!document.getElementById('rs-timing'), n: JSON.parse(localStorage.getItem('rr_research_times_v1') || '[]').length, stamped: localStorage.getItem('rr_research_times_v1__at') !== null }));
    T('R13 a member who is not an owner sees NO timing line', r.line === false, r);
    T('R14 …the times stay on that device only (not pushed to the account)', r.n === 1 && !r.stamped, r);
    await pg.close();
  }
  {
    const pg = await boot(1200, 'bhale@ipd-llc.com');
    await pg.evaluate(() => { if (typeof rrSetRecordingMode === 'function') rrSetRecordingMode(true); else localStorage.setItem('rr_recording_mode', '1'); });
    await run(pg);
    const r = await pg.evaluate(() => ({ line: !!document.getElementById('rs-timing') }));
    T('R15 recording mode hides the line, even for the owner', r.line === false, r);
    await pg.close();
  }
  {
    const pg = await boot(1200, 'stranger@example.com');
    const thirty = Array.from({ length: 30 }, (x, i) => ({ at: 'old' + i, outcome: 'found' }));
    await run(pg, { list: thirty });
    const r = await pg.evaluate(() => JSON.parse(localStorage.getItem('rr_research_times_v1') || '[]'));
    T('R16 only the last 25 runs are kept, newest last', r.length === 25 && r[24].outcome === 'found' && r[0].at === 'old6', { n: r.length, first: r[0] && r[0].at });
    await pg.close();
  }
  {
    const pg = await boot(1200, 'stranger@example.com');
    await run(pg, { cancelAtCrop: true });
    const r = await pg.evaluate(() => window._rrResearchLastTiming || null);
    T('R17 a run cancelled at the crop screen is still recorded ("stopped")', r && r.outcome === 'stopped' && r.steps.some(s => s[0] === 'you: crop screen'), r);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
