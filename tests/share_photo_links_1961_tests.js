#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SHARE — FULL-SIZE PHOTO LINKS — v0.9.1961   (real Chromium, REAL share.js + sell.js)
//
// Brad, 2026-10-15: "when you share pictures, the text or email you get you can
// not open the picture" — for "Share as images" and "Download as PDF". His
// screenshot: the cards arrive fine, but each is ONE flat picture, so the train
// photo on it is small and cropped and there is nothing to open. Offered a link
// per item or the photos attached — "lets do 1".
//
//   S1  the one setting ("Full-size photo links") is ON by default, 1 week
//   I1  Share as images: each item's photo is opened up (anyone with the link)
//       and its full-size link rides in the message, named by item number
//   I2  the message says how long the links work
//   I3  the copy-and-paste email route offers "Copy the photo links"
//   I4  with the setting off: no links, nothing opened up
//   I5  a photo that could NOT be opened up gets no link (no dead links)
//   P1  the PDF writes "See the full-size photo ›" under a linked photo, linked
//       to that photo — a picture alone gives no sign it can be tapped
//   P2  …and not when the photo was not opened up
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  share_photo_links_1961_tests needs playwright and it is not installed.'); process.exit(1); }
let JSPDF = '';
try { JSPDF = fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'), 'utf8'); }
catch (e) { console.log('FAILED  —  share_photo_links_1961_tests needs the jspdf package (node_modules) for the PDF checks.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
const SHARE = fs.readFileSync(path.join(APP, 'share.js'), 'utf8');
const SELL = fs.readFileSync(path.join(APP, 'sell.js'), 'utf8');
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const DOT = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// o: { share, sell, failOpen: [ids], linkOff }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: JSPDF, contentType: 'application/javascript' });
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/share.js') && o.share) return r.fulfill({ body: o.share, contentType: 'application/javascript' });
    if (base.endsWith('/app/sell.js') && o.sell) return r.fulfill({ body: o.sell, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(([dot, failOpen]) => {
    window.showToast = function () {};
    window.__calls = [];
    window.driveRequest = async function (m, p, b) {
      window.__calls.push([m, p, b]);
      if (m === 'POST' && /permissions/.test(p) && failOpen.some(id => p.indexOf(id) >= 0)) throw new Error('403 not allowed');
      return {};
    };
    window.driveGetFolderPhotos = async function (folder) { return folder === 'F1' ? [{ id: 'PHOTO1' }, { id: 'PHOTO1B' }] : [{ id: 'PHOTO2' }]; };
    window._fetchPhotoAsDataUrl = async function () { return dot; };
    const m1 = { itemNum: '6517', roadName: 'Lionel Lines', itemType: 'Caboose', description: 'Bay Window Caboose' };
    const m2 = { itemNum: '6556', roadName: 'Missouri-Kansas-Texas', itemType: 'Stock Car', description: 'Large Cattle Car' };
    _shareSource = 'forsale';
    _shareItems = {
      a: { itemNum: '6517', variation: '', master: m1, pd: { itemNum: '6517', photoItem: 'F1', condition: '7' }, fs: { askingPrice: '40', condition: '7' } },
      b: { itemNum: '6556', variation: '', master: m2, pd: { itemNum: '6556', photoItem: 'F2', condition: '7' }, fs: { askingPrice: '325', condition: '7' } },
    };
    window.findMaster = function () { return null; };
    openShareBuilder();
  }, [DOT, o.failOpen || []]);
  await pg.waitForTimeout(300);
  if (o.linkOff) await pg.evaluate(() => { const c = document.getElementById('sf-linkphotos'); c.checked = false; });
  return { pg, ctx, errs };
}
const cards = async pg => {
  await pg.evaluate(async () => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    await shareAsCards();
  });
  return pg.evaluate(() => ({
    text: window._rrShareText || '', links: window._rrShareLinks || '',
    copyBtn: !!document.getElementById('rr-copy-photo-links'),
    opened: window.__calls.filter(c => c[0] === 'POST' && /permissions/.test(c[1]) && c[2] && c[2].type === 'anyone').map(c => c[1].split('/')[2]),
  }));
};
// the PDF, as text, for one linked and one unlinked item
const pdf = pg => pg.evaluate(async (dot) => {
  const f = Object.assign(_getShareFields(), { photo: true });
  const items = [
    { itemNum: '6517', master: { roadName: 'Lionel Lines', itemType: 'Caboose' }, pd: { condition: '7' }, fs: { askingPrice: '40' }, _photoDataUrl: dot, _photoFileId: 'PHOTO1', _photoLinked: true },
    { itemNum: '6556', master: { roadName: 'M-K-T', itemType: 'Stock Car' }, pd: { condition: '7' }, fs: { askingPrice: '325' }, _photoDataUrl: dot, _photoFileId: 'PHOTO2', _photoLinked: false },
  ];
  const blob = await _buildPDF(items, f, '');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}, DOT);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== the setting ==');
  r = await open(browser, {});
  m = await r.pg.evaluate(() => ({ on: document.getElementById('sf-linkphotos').checked, row: getComputedStyle(document.getElementById('sf-linklife-row')).display, life: document.getElementById('sf-linklife').value,
    label: document.getElementById('sf-linkphotos').parentElement.textContent }));
  T('S0 no script error', r.errs.length === 0, r.errs);
  T('S1 "Full-size photo links" is ON by default, its 1-week choice showing', m.on && m.row !== 'none' && m.life === '604800000' && /Full-size photo links/.test(m.label), m);

  console.log('== Share as images ==');
  m = await cards(r.pg);
  T('I1 both items\' photos are opened up for anyone with the link', m.opened.includes('PHOTO1') && m.opened.includes('PHOTO2'), m.opened);
  T('I1 the message carries each full-size link, named by item number',
    /No\. 6517 Lionel Lines Caboose:\nhttps:\/\/drive\.google\.com\/file\/d\/PHOTO1\/view/.test(m.text)
    && /No\. 6556 Missouri-Kansas-Texas Stock Car:\nhttps:\/\/drive\.google\.com\/file\/d\/PHOTO2\/view/.test(m.text), m.text);
  T('I2 the message says how long the links work (1 week)', /links work for 1 week/.test(m.text), m.text.slice(0, 160));
  T('I3 the copy-and-paste route offers "Copy the photo links"', m.copyBtn, m.copyBtn);
  await r.ctx.close();
  r = await open(browser, { linkOff: true });
  m = await cards(r.pg);
  T('I4 with the setting off: no links, nothing opened up', !/drive\.google\.com/.test(m.text) && m.opened.length === 0 && !m.copyBtn, m);
  await r.ctx.close();
  r = await open(browser, { failOpen: ['PHOTO2'] });
  m = await cards(r.pg);
  T('I5 a photo that could not be opened up gets no link (the other still does)', !/PHOTO2/.test(m.text) && /PHOTO1/.test(m.text), m.text);
  await r.ctx.close();

  console.log('== the PDF ==');
  r = await open(browser, {});
  const p = await pdf(r.pg);
  const linkTxt = /See the full-size photo/.test(p);
  T('P1 a linked photo has "See the full-size photo ›" written under it, linked to the photo',
    linkTxt && (p.match(/drive\.google\.com\/file\/d\/PHOTO1\/view/g) || []).length >= 2, { words: linkTxt, n: (p.match(/PHOTO1\/view/g) || []).length });
  T('P2 …and the photo that was not opened up gets neither', !/PHOTO2\/view/.test(p) && (p.match(/See the full-size photo/g) || []).length === 1, (p.match(/See the full-size photo/g) || []).length);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { share: planted(SHARE, 'id="sf-linkphotos" checked onchange', 'id="sf-linkphotos" onchange', 'off by default') });
  m = await x.pg.evaluate(() => document.getElementById('sf-linkphotos').checked);
  T('X-S1 PLANTED: off by default → caught', m === false, m);
  await x.ctx.close();
  x = await open(browser, { sell: planted(SELL, "  return window._rrShareLinks ? (String(base || '') + '\\n\\n' + window._rrShareLinks) : String(base || '');", "  return String(base || '');   // planted", 'no links in message') });
  m = await cards(x.pg);
  T('X-I1 PLANTED: links left out of the message → caught', !/drive\.google\.com/.test(m.text), m.text);
  await x.ctx.close();
  x = await open(browser, { share: planted(SHARE, "  if (vals.photoLink) rows.push({ kind: 'link', h: 13 });", "", 'no written link') });
  m = await pdf(x.pg);
  T('X-P1 PLANTED: no written link in the PDF → caught', !/See the full-size photo/.test(m), '');
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
