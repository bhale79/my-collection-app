#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID — NARROW BEFORE ASKING, NO SLOW SECOND LOOK, CROP SIDE BY SIDE
// v0.9.1968   (real Chromium, REAL barcode.js + wizard.js + app.css)
//
// Brad, 2026-10-16, on Photo ID from the Add screen (Lionel + O set there):
//   "I get this huge picture that i then have to scroll down to see that i can
//    id it … do the picture to the left side with the buttons to the right like
//    we did the other."
//   "when you do the photo id, it read the bar code, so then it should just give
//    me the options, but it kept reading for like another 20 seconds. then i get
//    this screen with 3 options. why, i already told you it was lionel o so the
//    answer should be the first one"
// His barcode 0023922368140 (Lionel prefix, five digits 36814) offered Lionel's
// 6-36814 Rio Grande caboose, a Märklin HO 36814 and an LGB 36814. Told the
// plan: "yes".
//
//   N1  the barcode's own decode keeps the maker the barcode proves: 36814 on a
//       Lionel barcode is Lionel's caboose alone (Märklin/LGB rows exist)
//   N2  _biNarrow: by the proven maker; by the Add screen's scale; a filter
//       that would leave nothing is skipped (never an empty list)
//   P1  Photo ID on his barcode: straight to 6-36814 — no pick list, and the
//       slow closer look is NOT run (the quick lettering read still is)
//   P2  two LIONEL rows share the number (O and HO): from the Add screen with
//       Scale O, the O one is chosen; opened elsewhere, the list is offered
//   P3  a barcode found in the catalog's own barcode column: lettering skipped
//   C1  the crop screen on his laptop (1536x737): photo on the left, every
//       button on the right and on screen, nothing to scroll; a phone keeps
//       the stacked screen
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_id_narrow_1968_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app'), FIX = path.join(__dirname, 'fixtures');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
const BC = fs.readFileSync(path.join(APP, 'barcode.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROWS = [
  { itemNum: '6-36814', variation: '', _tab: 'Lionel MPC-Modern', _era: 'mpc', manufacturer: 'Lionel', roadName: 'Rio Grande', itemType: 'Caboose', description: 'Rio Grande Animated Caboose', yearProd: '2009' },
  { itemNum: '36814', variation: '', _tab: 'Marklin HO', _era: 'marklin_h0', manufacturer: 'Marklin', roadName: 'BR 100', itemType: 'Electric Locomotive', description: 'Köf II Small Diesel Locomotive', yearProd: '2017' },
  { itemNum: '36814', variation: '1', _tab: 'LGB G', _era: 'lgb', manufacturer: 'LGB', roadName: 'WW&FRY', itemType: 'Passenger Car', description: 'WW & F Ry Passenger Car', yearProd: '2017' },
];
const HO_TWIN = { itemNum: '36814', variation: '', _tab: 'Lionel HO', _era: 'mod_ho', manufacturer: 'Lionel', roadName: 'Test', itemType: 'Boxcar', description: 'An HO twin for the scale test' };

// o: { bc, rows, upcRow, mobile, w, h, bcSrc }
async function boot(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 1536, height: o.h || 737 },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  if (o.bc) await pg.addInitScript(raw => {
    window.BarcodeDetector = class { constructor() {} async detect() { return [{ rawValue: raw, format: 'ean_13' }]; } };
  }, o.bc);
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (/cropperjs\/1\.6\.1\/cropper\.min\.js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: CROPPER_JS });
    if (/cropperjs\/1\.6\.1\/cropper\.min\.css/.test(u)) return r.fulfill({ contentType: 'text/css', body: CROPPER_CSS });
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/barcode.js') && o.bcSrc) return r.fulfill({ body: o.bcSrc, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    state.masterData = []; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    window.__closer = 0; window.__tess = 0; window.__picker = 0;
    window.Tesseract = { recognize: async () => { window.__tess++; return { data: { text: '' } }; } };
    window._ensureTesseract = async () => window.Tesseract;
    window.rrFreeReadBlob = async () => { window.__closer++; await new Promise(r => setTimeout(r, 300)); return { num: '36814', matched: true }; };
    try { _aiUsageMarkSeen(); } catch (e) {}
  }, o.rows || ROWS);
  return { pg, ctx, errs };
}
// run Photo ID's real stages on a small canvas; returns the result + what ran
const runPid = (pg, opts) => pg.evaluate(async (opts) => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const g = c.getContext('2d'); g.fillStyle = '#e85'; g.fillRect(0, 0, 400, 300);
  // the real "Which one is yours?" list: counted, its rows noted, the first tapped
  let res = null, done = false;
  window._biPipelineOnCanvas(c, opts || { noAi: true }).then(v => { res = v; done = true; });
  for (let i = 0; i < 200 && !done; i++) {
    await new Promise(z => setTimeout(z, 100));
    const pk = document.getElementById('barcode-candidate-overlay');
    if (pk && !pk.__seen) {
      pk.__seen = true; window.__picker++;
      window.__pickerRows = [...pk.querySelectorAll('.bc-cand')].map(e => e.textContent.replace(/\s+/g, ' ').slice(0, 40));
      const first = pk.querySelector('.bc-cand[data-idx="0"]'); if (first) first.click();
    }
  }
  const stages = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
  const o = document.getElementById('bi-overlay'); if (o) o.remove();
  return { item: res && res.itemNum, tab: res && res.masterItem && res.masterItem._tab, stages, closer: window.__closer, tess: window.__tess, picker: window.__picker, rows: window.__pickerRows || [] };
}, opts);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m, x;

  console.log('== N · narrowing ==');
  r = await boot(browser, {});
  m = await r.pg.evaluate(async () => {
    const d = await window._bcDecodeForTest({ rawValue: '0023922368140', format: 'ean_13' }, '');
    return { item: d && d.itemNum, tab: d && d.masterItem && d.masterItem._tab, multi: !!(d && d.multipleMatches), n: d && d.candidates ? d.candidates.length : 0 };
  });
  T('N0 no script error', r.errs.length === 0, r.errs);
  T('N1 Lionel barcode 36814 → Lionel\'s 6-36814 alone (the Märklin and LGB 36814s are not offered)', m.item === '6-36814' && m.tab === 'Lionel MPC-Modern' && !m.multi, m);
  m = await r.pg.evaluate(rows => {
    const a = window._biNarrow(rows, { mfr: 'Lionel' }).map(h => h._tab);
    const none = window._biNarrow(rows, { mfr: 'Atlas' }).length;
    wizard.data = wizard.data || {}; wizard.data._searchFilterScale = 'O'; wizard.data._searchFilterManufacturer = '';
    const sc = window._biNarrow(rows.slice(1), { addFilters: true }).length;   // Märklin HO + LGB G, Scale O → nothing fits → both stay
    const sc2 = window._biNarrow(rows, { addFilters: true }).map(h => h._tab);
    return { a, none, sc, sc2 };
  }, ROWS);
  T('N2 by the proven maker: only the Lionel row is left', JSON.stringify(m.a) === '["Lionel MPC-Modern"]', m.a);
  T('N2 a filter that would leave nothing is skipped — the list is never emptied', m.none === 3 && m.sc === 2, m);
  T('N2 the Add screen\'s Scale O keeps the O row', JSON.stringify(m.sc2) === '["Lionel MPC-Modern"]', m.sc2);
  await r.ctx.close();

  console.log('== P · Photo ID on his barcode ==');
  r = await boot(browser, { bc: '0023922368140' });
  m = await runPid(r.pg);
  T('P1 straight to 6-36814 — no pick list', m.item === '6-36814' && m.picker === 0, m);
  T('P1 the quick lettering read still runs, the slow closer look does not', m.tess >= 1 && m.closer === 0 && !/reading closer/.test(m.stages), m);
  T('page errors (P1)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  r = await boot(browser, { bc: '0023922368140', rows: [ROWS[0], HO_TWIN] });
  await r.pg.evaluate(() => { wizard.data = wizard.data || {}; wizard.data._searchFilterScale = 'O'; wizard.data._searchFilterManufacturer = 'Lionel'; wizard.data._searchFilterPeriod = ''; });
  m = await runPid(r.pg, { noAi: true, addFilters: true });
  T('P2 two Lionel 36814s (O and HO): from the Add screen with Scale O, the O one is chosen, no list', m.item === '6-36814' && m.tab === 'Lionel MPC-Modern' && m.picker === 0, m);
  await r.pg.evaluate(() => { window.__picker = 0; window.__pickerRows = []; });
  m = await runPid(r.pg, { noAi: true });
  T('P2 …opened anywhere else, both are offered (the Add filters only count from the Add screen)', m.picker === 1 && m.rows.length === 2, m);
  await r.ctx.close();

  const upcRows = [Object.assign({}, ROWS[0], { upc: '023922368140' }), ROWS[1], ROWS[2]];
  r = await boot(browser, { bc: '0023922368140', rows: upcRows });
  m = await runPid(r.pg);
  T('P3 a barcode in the catalog\'s own barcode column: lettering not read at all', m.item === '6-36814' && m.tess === 0 && m.closer === 0 && /not needed — the barcode matched your catalog/.test(m.stages), m);
  await r.ctx.close();

  console.log('== C · the crop screen ==');
  const cropAt = async (o, src) => {
    const b = await boot(browser, Object.assign({ bcSrc: src }, o));
    await b.pg.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 2400; c.height = 1800;
      const g = c.getContext('2d'); g.fillStyle = '#d64'; g.fillRect(0, 0, 2400, 1800);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
      window.openBoxIdentify(() => {}, () => {}, '', { file: new File([blob], 'box.jpg', { type: 'image/jpeg' }) });
    });
    await b.pg.waitForTimeout(1500);
    const v = await b.pg.evaluate(() => {
      const R = e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
      const card = document.querySelector('#bi-overlay .rr-card');
      const wrap = document.getElementById('bi-cropwrap');
      const btns = [...document.querySelectorAll('#bi-overlay [data-bi]')].map(x => ({ a: x.getAttribute('data-bi'), ...R(x) }));
      return { vh: innerHeight, vw: innerWidth, wide: !!(card && card.classList.contains('bi-crop-card')), wrap: wrap ? R(wrap) : null,
        btns, scrolls: card ? card.scrollHeight > card.clientHeight + 2 : null, cropper: !!document.querySelector('#bi-overlay .cropper-container') };
    });
    await b.ctx.close();
    return v;
  };
  m = await cropAt({});
  const onScreen = v => v.btns.length >= 4 && v.btns.every(b => b.b <= v.vh && b.t >= 0 && b.r <= v.vw);
  T('C1 his laptop (1536x737): the photo is on the LEFT, every button to its right', m.wide && m.cropper && m.btns.every(b => b.l >= m.wrap.r), m);
  T('C1 …every button is on screen and nothing scrolls', onScreen(m) && m.scrolls === false, m);
  T('C1 …and the photo is big: most of the window\'s height', m.wrap && (m.wrap.b - m.wrap.t) > m.vh * 0.75, m.wrap);
  const ph = await cropAt({ mobile: true, w: 412, h: 860 });
  T('C1 a phone keeps the stacked screen (buttons under the photo)', !ph.wide && ph.btns.every(b => b.t >= ph.wrap.b), ph);

  console.log('== planted offenders ==');
  x = await boot(browser, { bcSrc: planted(BC, "    if (wantMfr && out.length > 1) {", "    if (false && wantMfr && out.length > 1) {   // planted", 'decode ignores maker') });
  m = await x.pg.evaluate(async () => { const d = await window._bcDecodeForTest({ rawValue: '0023922368140', format: 'ean_13' }, ''); return { multi: !!(d && d.multipleMatches), n: d && d.candidates ? d.candidates.length : 1 }; });
  T('X-N1 PLANTED: the exact pass ignores the barcode\'s maker → three makers offered again (caught)', m.multi && m.n === 3, m);
  await x.ctx.close();
  x = await boot(browser, { bc: '0023922368140', bcSrc: planted(BC, "!(rawCands || []).length && !_bcNamed && !(opts && opts.ignoreNums)", "!(rawCands || []).length && !(opts && opts.ignoreNums)", 'closer look always') });
  m = await runPid(x.pg);
  T('X-P1 PLANTED: the closer look runs after the barcode named items → caught (P1 would fail)', m.closer >= 1, m);
  await x.ctx.close();
  x = await boot(browser, { bc: '0023922368140', rows: [ROWS[0], HO_TWIN], bcSrc: planted(BC, "      if (typeof window._wizRowFitsFilters === 'function') steps.push(", "      if (false) steps.push(", 'no add filters') });
  await x.pg.evaluate(() => { wizard.data = wizard.data || {}; wizard.data._searchFilterScale = 'O'; wizard.data._searchFilterManufacturer = 'Lionel'; });
  m = await runPid(x.pg, { noAi: true, addFilters: true });
  T('X-P2 PLANTED: the Add screen\'s filters not used → the list is offered (caught)', m.picker === 1, m);
  await x.ctx.close();
  x = await boot(browser, { bc: '0023922368140', rows: upcRows, bcSrc: planted(BC, "    if (_bcNamed && bcResult.byCatalogUpc && bcResult.masterItem && !(opts && opts.ignoreNums)) {", "    if (false) {   // planted", 'exact barcode still reads') });
  m = await runPid(x.pg);
  T('X-P3 PLANTED: an exact catalog barcode still reads the lettering → caught', m.tess >= 1, m);
  await x.ctx.close();
  m = await cropAt({}, planted(BC, "      if (_wide) { try { d.firstElementChild.classList.add('bi-crop-card'); } catch (eW) {} }", "", 'stacked on a laptop'));
  T('X-C1 PLANTED: no side-by-side card → on his laptop a button is off screen or the card scrolls (caught)', !(onScreen(m) && m.scrolls === false && m.wide), { wide: m.wide, scrolls: m.scrolls });

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
