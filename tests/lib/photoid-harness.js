// Shared harness for the three Photo ID suites of PLAN_2026-11-03_PHOTO_ID_IPHONE
// (photoid_turn_tests, photoid_closer_maker_tests, photoid_filter_ask_tests): Mike
// Caruso's MTH label picture, the real catalog numbers, the real app booted in
// Chromium, Photo ID's real stages run on the picture. Split in three so no
// Chromium suite runs past 180 s (the closer look alone takes ~80 s in the cloud).
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
const FIX = path.join(__dirname, '..', 'fixtures');
const PIC = path.join(FIX, 'mike_sd90mac_label.jpg');
const NUMS = JSON.parse(fs.readFileSync(path.join(FIX, 'photoid_catalog_numbers.json'), 'utf8'));
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
const BC = '0658081069753';   // the barcode on Mike's box (MTH)
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

const TAB = { pw: ['Lionel PW - Items', 'Lionel'], prewar: ['Lionel Pre-War', 'Lionel'], mth_o: ['MTH O', 'MTH'] };
const ROWS = [];
for (const era of Object.keys(TAB)) for (const n of NUMS[era]) ROWS.push({ itemNum: n, variation: '', description: n === '20-2471-3' ? 'SD90MAC Diesel Engine (Non-Powered)' : '', manufacturer: TAB[era][1], _era: era, _tab: TAB[era][0], itemType: '' });

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1536, height: 826 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    if (/cropper(\.min)?\.js$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_JS, contentType: 'application/javascript' });
    if (/cropper(\.min)?\.css$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_CSS, contentType: 'text/css' });
    if (u.startsWith('file://')) return r.continue();
    if (u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://tessdata.projectnaptha.com/')) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    state.masterData = rows.slice();
    try { _rebuildMasterIndex(); } catch (e) {}
    state.masterByItemAll = state.masterByItem; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.removeItem(RR_PHOTO_ID_CLOSER.recordKey); } catch (e) {}
  }, ROWS);
  return { pg, errs };
}
// Photo ID's real stages on Mike's picture (turn = 0 upright, 90 sideways)
const runOn = (pg, b64, o) => pg.evaluate(async ([b64, o]) => {
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  let c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  if (o.turn) {
    const r = document.createElement('canvas'); r.width = c.height; r.height = c.width;
    const x = r.getContext('2d'); x.translate(r.width / 2, r.height / 2); x.rotate(o.turn * Math.PI / 180); x.drawImage(c, -c.width / 2, -c.height / 2); c = r;
  }
  if (o.noTurns) RR_PHOTO_ID_CLOSER.turns = [];
  // A stand-in closer look that answers like the real reader: the numbers it
  // "read" (Mike's 105 · 283 · 193) are sorted inside / outside the preference
  // it was GIVEN by the real rule (rrRowFitsPrefer on each catalog row) — the
  // real reader takes ~80–130 s in the cloud, too slow for one suite's 180 s.
  if (o.closerAs) window.rrFreeReadBlob = async (blob, maxDim, prefer) => {
    window.__closerPrefer = prefer ? { manufacturer: prefer.manufacturer || '', eras: (prefer.eras || []).slice() } : null;
    const dbg = { inEra: [], offEra: [] };
    o.closerAs.forEach(n => {
      const row = (state.masterAllRows || []).find(r => String(r.itemNum) === n);
      if (!row) return;
      (prefer && !rrRowFitsPrefer(row, prefer) ? dbg.offEra : dbg.inEra).push(n + ':' + row._era);
    });
    return { num: '', matched: false, dbg };
  };
  if (o.stubCloser) window.rrFreeReadBlob = async () => ({ num: '', matched: false, dbg: { inEra: [], offEra: [] } });   // fast stand-in; the real closer look is photoid_closer_maker_tests
  const t0 = performance.now();
  window._biPipelineOnCanvas(c, { noAi: true, lockedBc: o.bc ? { rawValue: o.bc, format: 'ean_13' } : null, source: 'test' });
  let t = '', btns = [];
  for (let i = 0; i < 1600; i++) {
    await new Promise(r => setTimeout(r, 150));
    t = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
    btns = Array.from(document.querySelectorAll('#bi-actions button, #bi-actions [data-bi]')).map(b => (b.getAttribute('data-bi') || '') + '=' + (b.textContent || '').trim());
    if (/Lettering:/.test(t) && /Catalog:/.test(t) && !/Catalog: checking/.test(t)) break;
  }
  const ms = Math.round(performance.now() - t0);
  let rec = null; try { rec = JSON.parse(localStorage.getItem(RR_PHOTO_ID_CLOSER.recordKey) || '[]').slice(-1)[0] || null; } catch (e) {}
  const report = (typeof window.errReportPreview === 'function') ? window.errReportPreview() : '';
  const o2 = document.getElementById('bi-overlay'); if (o2) o2.remove();
  return { t, btns, rec, ms, report, closerPrefer: window.__closerPrefer === undefined ? 'not called' : window.__closerPrefer };
}, [b64, o]);
const LIONEL = new Set([].concat(NUMS.pw, NUMS.prewar));
// any Lionel catalog number shown as found / used / a choice button
function lionelShown(r) {
  const nums = [];
  (r.t.match(/found ([0-9A-Z\-, ]+)/) || ['', ''])[1].split(',').forEach(s => nums.push(s.trim()));
  (r.t.match(/Catalog: (?:✓ |using )([0-9A-Z\-]+)/) || ['', ''])[1] && nums.push((r.t.match(/Catalog: (?:✓ |using )([0-9A-Z\-]+)/) || [])[1]);
  r.btns.forEach(b => { const m = b.match(/^num:([^=]+)=/); if (m) nums.push(m[1]); });
  return nums.filter(n => n && LIONEL.has(n) && !/^20-/.test(n));
}

module.exports = { APP, FIX, PIC, NUMS, BC, read, ROWS, boot, runOn, LIONEL, lionelShown };
