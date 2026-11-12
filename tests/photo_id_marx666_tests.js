#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID WITH THE MARX FILTER ON BRAD'S 666 — photoid666 (2026-11-12)
// (real Chromium, the REAL app, the REAL reader; real Tesseract.js in R)
//
// [stated] Brad 2026-11-12 "yes" to PLAN_2026-11-12_PHOTO_ID_MARX_666.md, after
// hand-test T-2026-11-11-03 FAILED: Add → Manufacturer Marx → Photo ID on his
// 666 → ~4½ minutes, then ONE row "mx-25 Motor Chassis … Fits 666/1666" under
// "Outside your filter", headed "matches several catalog entries". 666 never
// offered. Reproduced with the reader's own code: the cab window's edge reads
// as a 1 → "1666"; Marx 1666 has no year, so it counted as "modern" and failed
// Era = Postwar; the quote rescue then turned 1666 into the part that fits it.
//
//   A  A part that "fits" an item is never the item (the quote index skips
//      Part rows): 1666 never comes back as mx-25.
//   L  "1" + an item number, both items inside the filters → asked, never
//      chosen: Photo ID offers 1666 AND 666 with the leading-1 words.
//   B  A blank year in a catalog the period map does not place (Marx O,
//      Other O) is UNKNOWN, and unknown fits any Era filter. Lionel and MTH
//      rows answer exactly as before.
//   C  One row is never "several": "has one catalog entry", "matches 3".
//   D  The closer look shows each pass ("pass 2 of 5") and the read record
//      keeps each pass's time (the real reader on the real picture, R). The
//      planned "stop when two passes agree" was dropped after measuring: on
//      this picture only the last (stamp) pass reads 666, and the review found
//      it could end a read on a background number before the stamp pass.
//   E  The read record: kept on a finished read, kept on a Stop during the
//      closer look, with the closer look's time.
//   PLANTED: each rule taken out turns its checks red.
//
// Fixtures: tests/fixtures/marx666_rows_2026-11-12.json (the whole Marx O tab,
// Lionel PW 666/1666 + 300 rows, 20 undated MTH O rows — the master, read
// 2026-11-12) and tests/fixtures/marx666_cab.jpg (Brad's 666 picture, the
// photo area of the testing chat's screenshot T-11-03_no_filter_found_it_666).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_id_marx666_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIX = path.join(__dirname, 'fixtures');
const DATA = JSON.parse(fs.readFileSync(path.join(FIX, 'marx666_rows_2026-11-12.json'), 'utf8'));
const PIC = fs.readFileSync(path.join(FIX, 'marx666_cab.jpg')).toString('base64');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
// the Photo Inbox (the reader is one of its pieces) is read and served ONLY through pin-source
const { pinSource, pinHook, pinFulfill } = require('./lib/pin-source');
let pass = 0, fail = 0;
const quiet = { on: false, red: 0 };
function T(n, cond, detail) {
  if (quiet.on) { if (!cond) quiet.red++; return; }
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600)));
  cond ? pass++ : fail++;
}
function planted(src, from, to, what) {
  if (src.split(from).length !== 2) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
// the reader with its inner answers reachable (a test door at the end of its piece; the file itself is unchanged)
const EXPOSE = 'window.__nft = _numberFromText; window.__quote = _pinQuoteMatch;';

async function boot(browser, o) {
  o = o || {};
  const files = Object.assign({}, o.files || {});
  const PIN = pinHook(files.__pin || pinSource(), EXPOSE, 'photo-inbox-reader.js');
  delete files.__pin;
  const pg = await browser.newPage({ viewport: { width: 1536, height: 826 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (pinFulfill(r, u, PIN)) return;
    for (const f of Object.keys(files)) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    if (/cropper(\.min)?\.js$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_JS, contentType: 'application/javascript' });
    if (/cropper(\.min)?\.css$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_CSS, contentType: 'text/css' });
    if (u.startsWith('file://')) return r.continue();
    if (o.ocr && (u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://tessdata.projectnaptha.com/'))) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate((tabs) => {
    let all = [];
    tabs.forEach(t => { const cm = buildMasterColMap(t.rows[0]); t.rows.slice(1).forEach(r => { if (!r[0]) return; const m = parseMasterRow(r, t.tab, cm); m._era = t.era; all.push(m); }); });
    all = _deduplicateMaster(all);
    state.masterData = all.slice();
    try { _rebuildMasterIndex(); } catch (e) {}
    state.masterByItemAll = state.masterByItem; state.masterAllRows = all.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.removeItem('rr_photoid_reads'); } catch (e) {}
  }, DATA.tabs);
  await pg.evaluate(() => { startWizardFor('collection'); });
  await pg.waitForTimeout(700);
  if (o.marx !== false) await pg.evaluate(() => { wizard.data._searchFilterManufacturer = 'Marx'; wizard.data._searchFilterPeriod = 'postwar'; });
  return { pg, errs };
}
// Photo ID on a canvas of the picture; answers when a choice is asked or the
// read ends. o.pick: a number chip to tap when the number question comes up.
const runPid = (pg, o) => pg.evaluate(async ({ b64, o }) => {
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const seen = { pass: [] };
  const p = window._biPipelineOnCanvas(c, { noAi: true, addFilters: true });
  let res = null; p.then(r => { res = r || {}; });
  for (let i = 0; i < (o.loops || 1600); i++) {
    await new Promise(r => setTimeout(r, 100));
    const st = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
    const pm = /pass (\d) of (\d)/.exec(st); if (pm && seen.pass.indexOf(pm[0]) < 0) seen.pass.push(pm[0]);
    if (o.stopAt && new RegExp(o.stopAt).test(st)) { const b = document.getElementById('bi-stop-btn'); if (b) b.click(); o.stopAt = null; }
    const act = document.getElementById('bi-actions');
    const chips = act ? Array.from(act.querySelectorAll('[data-bi^="num:"]')).map(b => b.getAttribute('data-bi').slice(4)) : [];
    if (chips.length && !seen.chips) {
      seen.chips = chips; seen.ask = (act.textContent || '').replace(/\s+/g, ' ').slice(0, 260); seen.stage = st;
      if (o.pick) { const b = act.querySelector('[data-bi="num:' + o.pick + '"]'); if (b) b.click(); }
      else return { seen, st };
    }
    const cand = document.getElementById('bc-cand-cancel');
    if (cand && !seen.cand) { seen.cand = (cand.parentElement.textContent || '').replace(/\s+/g, ' ').slice(0, 400); seen.stage = st; return { seen, st }; }
    if (/Which item is it|Which one is yours/.test(document.body.innerText) && !seen.cand) { seen.cand = document.body.innerText.slice(0, 300); return { seen, st }; }
    if (res) return { seen, st, res: { itemNum: res.itemNum, chosen: !!res._chosen, oneThing: res._oneThing || '', cancel: !!res.__biCancel } };
  }
  return { seen, timedOut: true, st: ((document.getElementById('bi-stages') || {}).textContent || '') };
}, { b64: PIC, o: o || {} });
const recs = pg => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('rr_photoid_reads') || '[]'); } catch (e) { return []; } });
const closeOverlay = pg => pg.evaluate(() => { ['bi-overlay', 'bc-cand-overlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }); document.querySelectorAll('[id^="bc-cand"]').forEach(e => { try { e.closest('div[style*="position:fixed"]').remove(); } catch (x) {} }); });
// a fast stand-in reader (the real one runs in R)
const fastReader = (pg, says, matched) => pg.evaluate(({ says, matched }) => {
  window.Tesseract = { recognize: async () => ({ data: { text: '', words: [] } }) };
  window.rrFreeReadBlob = async (blob, dim, pref, opt) => { if (opt && opt.onPass) opt.onPass(1, 5); return { num: says, matched: matched !== false, passMs: [5] }; };
}, { says, matched });

// ── the checks, one function so the planted copies run the very same ones ──
async function suite(browser, files, tag, only) {
  const on = k => !only || only.indexOf(k) >= 0;
  // A — the quote rescue never answers with a part
  if (on('A')) {
    const { pg, errs } = await boot(browser, { files });
    const a = await pg.evaluate(() => {
      const p = window._wizReaderPrefer();
      const q = window.__quote('1666', p);
      const n = window.__nft('1666', p);
      const n6 = window.__nft('666', p);
      return { q: q && q.row && q.row.itemNum, n: n && n.num, nm: n && n.matched, n6: n6 && n6.num, pref: p };
    });
    T('A (set-up) the Add screen filter is Marx + Postwar', a.pref && a.pref.manufacturer === 'Marx' && a.pref.period === 'postwar', a.pref);
    T('A the quote rescue never answers 1666 with the part mx-25 ("Fits 666/1666")', a.q !== 'mx-25', a);
    T('A the reader never answers 1666 with mx-25', a.n !== 'mx-25', a);
    T('A …it reads 1666 as the Marx 1666 itself (an item inside the filter now), not a part', a.n === '1666', a);
    T('A 666 still reads 666', a.n6 === '666', a);
    T(tag + ' A page errors', errs.length === 0, errs);
    await pg.close();
  }
  // B — an undated Marx row is of unknown period, and fits Era = Postwar
  if (on('B')) {
    const { pg, errs } = await boot(browser, { files });
    const b = await pg.evaluate(() => {
      const rows = n => (state.masterByItem.get(n) || []);
      const marx1666 = rows('1666').filter(r => r._era === 'marx');
      const wind = rows('666').filter(r => r._era === 'marx' && String(r.variation) === '4');
      const p = window._wizReaderPrefer();
      const f = { mfr: 'Marx', period: 'postwar', type: '', scale: '' };
      const mth = state.masterData.filter(r => r._era === 'mth_o');
      const pw = state.masterData.filter(r => r._era === 'pw');
      const pwSame = pw.every(r => _wizPeriodOfRow(r) === (_itemEraPeriod(r) || ''));
      return {
        n1666: marx1666.length, per1666: marx1666.map(_wizPeriodOfRow), fit1666: marx1666.every(r => rrRowFitsPrefer(r, p)),
        add1666: marx1666.every(r => _wizRowFitsFilters(r, f)), windPer: wind.map(_wizPeriodOfRow), windAdd: wind.every(r => _wizRowFitsFilters(r, f)),
        dated666: rows('666').filter(r => r._era === 'marx' && r.yearProd).map(_wizPeriodOfRow),
        mthN: mth.length, mthPer: Array.from(new Set(mth.map(_wizPeriodOfRow))),
        pwN: pw.length, pwSame,
      };
    });
    T('B (set-up) the fixture has the four undated Marx 1666 rows and the windup 666', b.n1666 === 4 && b.windPer.length === 1, b);
    T('B an undated Marx row is of UNKNOWN period (not "modern")', b.per1666.every(x => x === '') && b.windPer[0] === '', b);
    T('B …and fits the reader\'s Marx + Postwar preference', b.fit1666, b);
    T('B …and the Add list\'s Marx + Postwar filter (1666 and the windup 666)', b.add1666 && b.windAdd, b);
    T('B a DATED Marx row keeps its own period (666 of 1955 = postwar)', b.dated666.length === 3 && b.dated666.every(x => x === 'postwar'), b);
    T('B an undated MTH O row is still modern (20 rows)', b.mthN === 20 && b.mthPer.length === 1 && b.mthPer[0] === 'modern', b);
    T('B every Lionel Postwar row answers as before — its year, else its tab (' + b.pwN + ' rows)', b.pwN > 300 && b.pwSame, b);
    T(tag + ' B page errors', errs.length === 0, errs);
    await pg.close();
  }
  // L — "1666" read: both are Marx items, so Photo ID asks
  if (on('L')) {
    const { pg, errs } = await boot(browser, { files });
    await fastReader(pg, '1666', true);
    const l = await runPid(pg, { loops: 300 });
    T('L a read of 1666 asks: 1666 or 666 are offered', l.seen && l.seen.chips && l.seen.chips.indexOf('1666') >= 0 && l.seen.chips.indexOf('666') >= 0, l);
    T('L …with the leading-1 words', l.seen && /a mark beside a number can read as a 1/.test(l.seen.ask || ''), l.seen);
    T('L …and the part mx-25 is named nowhere on the screen', l.seen && !/mx-25/i.test(JSON.stringify(l.seen)), l.seen);
    await closeOverlay(pg);
    const twins = await pg.evaluate(async () => {
      const p = window._wizReaderPrefer();
      const t1 = await window._biLeadOneTwins([{ raw: '1666' }], p, {});
      // a 1 + number whose tail is no Marx item: nothing to ask
      // a Marx ITEM 1xxx whose tail is no Marx item: nothing to ask
      const marxItems = state.masterData.filter(r => r._era === 'marx' && rrRowKind(r) === 'item' && rrRowFitsPrefer(r, p));
      const nums = new Set(state.masterData.filter(r => r._era === 'marx').map(r => String(r.itemNum)));
      const lone = (marxItems.map(r => String(r.itemNum)).filter(n => /^1\d{3}$/.test(n) && !nums.has(n.slice(1))))[0] || '';
      const t2 = lone ? await window._biLeadOneTwins([{ raw: lone }], p, {}) : null;
      const t3 = await window._biLeadOneTwins([{ raw: '1666' }], null, {});   // no filter, no barcode: nothing asked
      const t4 = await window._biLeadOneTwins([{ raw: '1666' }], { era: '', eras: [], manufacturer: '', scale: '', period: '', type: 'Steam Locomotive', _fromFilter: true }, {});   // Type alone narrows nothing
      const t5 = await window._biLeadOneTwins([{ raw: '1666' }], null, { bcMaker: 'Marx' });   // the barcode's maker is enough
      return { t1: t1.map(x => x.raw), from: t1[0] && t1[0].from, lone, t2: t2 && t2.map(x => x.raw), t3: t3.length, t4: t4.length, t5: t5.map(x => x.raw) };
    });
    T('L the twin rule offers 666 beside 1666 (and says it came from 1666)', twins.t1.length === 1 && twins.t1[0] === '666' && twins.from === '1666', twins);
    T('L with no filter and no barcode, nothing is asked', twins.t3 === 0, twins);
    T('L a Type-only filter narrows nothing — nothing is asked', twins.t4 === 0, twins);
    T('L the barcode\'s maker alone is enough to ask (1666 → 666)', twins.t5.length === 1 && twins.t5[0] === '666', twins);
    T('L …and nothing beside a 1-number whose tail is no Marx item (' + twins.lone + ')', twins.lone && twins.t2 && twins.t2.length === 0, twins);
    T(tag + ' L page errors', errs.length === 0, errs);
    await pg.close();
  }
  // L2 — tapping 666 goes on to 666 (no "Found it" after a choice)
  if (on('L')) {
    const { pg } = await boot(browser, { files });
    await fastReader(pg, '1666', true);
    const l2 = await runPid(pg, { pick: '666', loops: 400 });
    T('L tapping 666 → the answer is the 666, chosen (straight on to its variations)', l2.res && l2.res.itemNum === '666' && l2.res.chosen === true, l2);
    await pg.close();
  }
  // C — one row is never "several"
  if (on('C')) {
    const { pg, errs } = await boot(browser, { files });
    const c = await pg.evaluate(async () => {
      const one = (state.masterByItem.get('mx-25') || []).slice(0, 1);
      const three = (state.masterByItem.get('1666') || []).filter(r => r._era === 'marx').slice(0, 3);
      const words = async (cands, num) => {
        const p = window.showCandidatePicker(cands, { itemNum: num });
        await new Promise(r => setTimeout(r, 300));
        const btn = document.getElementById('bc-cand-cancel');
        const t = btn ? (btn.parentElement.textContent || '').replace(/\s+/g, ' ') : '';
        if (btn) btn.click();
        await p;
        return t;
      };
      return { one: await words(one, 'mx-25'), three: await words(three, '1666'), n1: one.length, n3: three.length };
    });
    T('C one row says "has one catalog entry", never "several"', c.n1 === 1 && /has one catalog entry/.test(c.one) && !/several/.test(c.one), c);
    T('C three rows say "matches 3 catalog entries"', c.n3 === 3 && /matches 3 catalog entries/.test(c.three), c);
    T(tag + ' C page errors', errs.length === 0, errs);
    await pg.close();
  }
  // E — a Stop during the closer look still leaves its record
  if (on('E')) {
    const { pg, errs } = await boot(browser, { files });
    await pg.evaluate(() => {
      window.Tesseract = { recognize: async () => ({ data: { text: '', words: [] } }) };
      window.rrFreeReadBlob = (blob, dim, pref, opt) => new Promise(res => { if (opt && opt.onPass) opt.onPass(2, 5); setTimeout(() => res({ num: '', matched: false, passMs: [] }), 2500); });
    });
    const e = await runPid(pg, { stopAt: 'pass 2 of 5', loops: 120 });
    const r = await recs(pg);
    T('E the closer line shows the pass it is on ("pass 2 of 5")', e.seen.pass.indexOf('pass 2 of 5') >= 0, e.seen);
    T('E a Stop during the closer look leaves a read record ("stopped", at pass 2 of 5)', r.length === 1 && r[0].got === 'stopped' && r[0].closerPass === '2/5', r);
    T(tag + ' E page errors', errs.length === 0, errs);
    await pg.close();
  }
}

// R — the real reader on the real picture (not planted: it is slow)
async function realRead(browser) {
  const { pg, errs } = await boot(browser, { ocr: true });
  const t0 = Date.now();
  const r = await runPid(pg, { loops: 2400 });
  const secs = Math.round((Date.now() - t0) / 1000);
  const rec = (await recs(pg))[0] || {};
  const done = r.res || {};
  T('R the real read of Brad\'s 666 picture with Marx + Postwar lands on the 666 (or asks 1666 / 666), never mx-25',
    (done.itemNum === '666') || (r.seen && r.seen.chips && r.seen.chips.indexOf('666') >= 0), { r, rec });
  T('R …never offers the part mx-25', !/mx-25/.test(JSON.stringify(r)), r);
  T('R the closer line counted its passes', r.seen && r.seen.pass.length >= 1, r.seen);
  T('R the read record keeps each pass\'s time', rec.passMs && rec.passMs.split(',').length >= 1, rec);
  T('R the read record says how long the closer look took', rec.closerMs > 0, rec);
  T('R it took ' + secs + ' s (under 180 s in the cloud)', secs < 180, secs);
  T('R page errors', errs.length === 0, errs);
  await pg.close();
}

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    await suite(browser, {}, '');
    await realRead(browser);
    // ── planted offenders: each must turn a check above red ──
    const RD = pinSource(), WZ = read('wizard.js'), BC = read('barcode.js');
    const plants = [
      ['the quote rescue may answer with a part', 'A', { __pin: planted(RD, "          if (rrRowKind(row) === 'part') return;\n", '', 'part') }],
      ['an undated Marx row back to "modern"', 'B', { 'wizard.js': planted(WZ, "  return _wizPeriodOfYear(String(m.yearProd || ''));\n}", "  if (e2) return 'modern';\n  return _wizPeriodOfYear(String(m.yearProd || ''));\n}", 'modern') }],
      ['the leading-1 question taken out', 'L', { 'barcode.js': planted(BC, "        if (_lo.length) { rawCands", "        if (false) { rawCands", 'leadone') }],
      ['one row called "several"', 'C', { 'barcode.js': planted(BC, "(candidates || []).length === 1 ? RR_PHOTO_ID_CHOICE.oneEntry", "false ? RR_PHOTO_ID_CHOICE.oneEntry", 'oneword') }],
      ['a stop during the closer look leaves no record', 'E', { 'barcode.js': planted(BC, "_recDone('stopped'); return { cancel: true }; }   // photoid666", "return { cancel: true }; }   // photoid666", 'stoprec') }],
      ['the pass is not shown', 'E', { 'barcode.js': planted(BC, "          st('ocr', '<span class=\"bi-spin\">⟳</span>', RR_PHOTO_ID_CLOSER.readingPass", "          if (0) st('ocr', '<span class=\"bi-spin\">⟳</span>', RR_PHOTO_ID_CLOSER.readingPass", 'passline') }],
    ];
    for (const [what, sec, files] of plants) {
      quiet.on = true; quiet.red = 0;
      try { await suite(browser, files, 'PLANT', sec); } catch (e) { quiet.red++; }
      quiet.on = false;
      T('PLANTED: ' + what + ' → ' + quiet.red + ' check(s) red (caught)', quiet.red > 0, quiet.red);
    }
  } catch (e) {
    T('crashed', false, String(e && e.stack || e).slice(0, 500));
  } finally {
    await browser.close();
  }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  photo_id_marx666_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
