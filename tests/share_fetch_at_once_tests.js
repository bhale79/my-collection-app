#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SHARE CARDS — PHOTOS FETCHED SEVERAL AT ONCE — v0.9.1974  (real Chromium,
// the REAL share.js + sell.js + config.js in index.html)
//
// Brad: "on the sales list, can we pre make the share cards so that its faster
// to share" → the time is the Drive downloads, one item after another → "if its
// the download time, any way of doing that faster and leave the rest as is?" →
// (Drive's small copies cannot be drawn onto a card — lh3 refuses the page,
// measured 2026-08-28) → "yes" to fetching several at once.
//
//   F1  the downloads overlap: more than one in flight, never more than
//       RR_SHARE_PHOTOS_AT_ONCE (config.js)
//   F2  the cards still come out in LIST order, though the downloads finish
//       out of order
//   F3  every item gets its card, and the whole run is much faster than one
//       after another
//   F4  a failed download is an item with no photo — every card is still made
//   F5  the message still lists every item in list order (the v1967 words)
//   X1  PLANTED: the fetch window cut to one item → one in flight at most, slow
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  share_fetch_at_once_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 500))); cond ? pass++ : fail++; }
const SELL = fs.readFileSync(path.join(APP, 'sell.js'), 'utf8');
const DOT = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const N = 12;

async function run(browser, sellSrc) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/sell.js') && sellSrc) return r.fulfill({ body: sellSrc, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async ([dot, n]) => {
    window.showToast = function () {};
    window.driveRequest = async function () { return {}; };
    window.driveGetFolderPhotos = async function (folder) { return [{ id: 'P-' + folder }]; };
    let inFlight = 0, maxInFlight = 0; const finished = [];
    // item k's photo takes longer when k % 3 === 0, so downloads finish OUT of order
    window._fetchPhotoAsDataUrl = function (id) {
      const k = +id.split('F')[1];
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise(function (res, rej) {
        setTimeout(function () {
          inFlight--; finished.push(k);
          if (k === 3) rej(new Error('drive said no')); else res(dot);
        }, k % 3 === 0 ? 300 : 120);
      });
    };
    const m = { itemNum: 'X', roadName: 'Lionel Lines', itemType: 'Boxcar', description: 'Boxcar' };
    _shareSource = 'forsale';
    _shareItems = {};
    for (let k = 0; k < n; k++) _shareItems['i' + k] = { itemNum: String(6000 + k), variation: '', master: Object.assign({}, m, { itemNum: String(6000 + k) }),
      pd: { itemNum: String(6000 + k), photoItem: 'F' + k, condition: '8' }, fs: { askingPrice: String(10 + k), condition: '8' } };
    window.findMaster = function () { return null; };
    openShareBuilder();
    await new Promise(r => setTimeout(r, 200));
    const c = document.getElementById('sf-linkphotos'); if (c) c.checked = false;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    const t0 = performance.now();
    await shareAsCards();
    const ms = performance.now() - t0;
    return { ms, maxInFlight, finished, names: (window._rrShareFiles || []).map(f => f.name), text: window._rrShareText || '',
      cap: (typeof RR_SHARE_PHOTOS_AT_ONCE === 'number') ? RR_SHARE_PHOTOS_AT_ONCE : null };
  }, [DOT, N]);
  out.errs = errs;
  await ctx.close();
  return out;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const want = Array.from({ length: N }, (_, k) => 'item-' + (6000 + k) + '-1.png');
  const seqMs = Array.from({ length: N }, (_, k) => (k % 3 === 0 ? 300 : 120)).reduce((a, b) => a + b, 0);

  const r = await run(browser, null);
  T('F0 the setting is in config.js and is 6', r.cap === 6, r.cap);
  T('F1 the downloads overlap: ' + r.maxInFlight + ' in flight at most (more than 1, never over the setting)', r.maxInFlight > 1 && r.maxInFlight <= r.cap, r.maxInFlight);
  const outOfOrder = r.finished.some((k, i) => i > 0 && k < r.finished[i - 1]);
  T('F2 the downloads finished out of order, yet the cards are in list order', outOfOrder && JSON.stringify(r.names) === JSON.stringify(want), { finished: r.finished, names: r.names });
  T('F3 every item has its card, and the run took ' + Math.round(r.ms) + ' ms against ' + seqMs + ' ms one after another', r.names.length === N && r.ms < seqMs * 0.6, r.ms);
  T('F4 the failed download (item 6003) still has its card', r.names.indexOf('item-6003-1.png') >= 0);
  const pos = Array.from({ length: N }, (_, k) => r.text.indexOf('No. ' + (6000 + k)));
  T('F5 the message lists every item, in list order', pos.every(p => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), pos);
  T('F6 no page errors', r.errs.length === 0, r.errs);

  // the window cut back to one item = the old one-after-another behaviour
  const from = 'for (var j = i; j < i + RR_SHARE_PHOTOS_AT_ONCE; j++) _startPhotos(j);';
  if (SELL.indexOf(from) < 0) throw new Error('planted X: the line moved; update this test');
  const old = SELL.replace(from, 'for (var j = i; j < i + 1; j++) _startPhotos(j);');
  const o = await run(browser, old);
  T('X1 PLANTED a window of one: one download in flight at most (F1 can fail)', o.maxInFlight === 1, o.maxInFlight);
  T('X2 PLANTED …and it is slow (F3 can fail): ' + Math.round(o.ms) + ' ms', o.ms >= seqMs * 0.9, o.ms);

  await browser.close();
  console.log('\nshare_fetch_at_once_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
