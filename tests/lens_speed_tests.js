#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE LENS + OUTSIDE PAGES — faster hand-off — v0.9.1911
//                                          (real Chromium, the REAL app)
//
// Brad, 2026-10-10, on his phone: Google Lens took ~35 s — "sending your
// photo" ~10 s, then the Photo ID screen ~15 s, then a white screen ~10 s —
// and Google Price Check sat on a white screen ~30 s. Causes found:
//   • the photo went to Drive at FULL size (up to 2200 px, JPEG 0.9), and
//     Lens fetches it back by link — every byte crossed twice;
//   • the "Sending" screen closed itself after a fixed 15 s, mid-upload;
//   • outside pages opened still tied to the app (no 'noopener').
//
//   L. Lens gets a small copy (RR_LENS in config.js): big photo → ≤1600 px,
//      smaller bytes; a small photo goes as is; a photo that cannot be
//      decoded goes as is (never lost); a re-search reuses the upload; each
//      step is timed. Thumbnails use the SAME shrinker at 400 px.
//   C. the "Sending" screen stays for the whole upload and goes once Google
//      opens; its safety limit is RR_LENS.COVER_MAX_MS, not a fixed 15 s.
//   X. Google / eBay / Lens open with 'noopener' through rrOpenExternal, and
//      the time until the phone actually left the app is recorded.
//   S. source sweeps + P planted offenders.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  lens_speed_tests needs playwright and it is not installed.'); process.exit(1); }
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
// every window.open( in this text carries 'noopener' as its third argument
function opensDetached(txt) {
  const bad = [], re = /window\.open\(/g; let m;
  while ((m = re.exec(txt))) {
    let k = m.index + 12, depth = 1;
    while (depth && k < txt.length) { if (txt[k] === '(') depth++; else if (txt[k] === ')') depth--; k++; }
    const call = txt.slice(m.index, k);
    if (!/,\s*'_blank',\s*'noopener'\)$/.test(call)) bad.push(call.slice(0, 80));
  }
  return bad;
}
function lensCoverOk(wp) {
  const b = fnBody(wp, 'async function _identifyOpenLens(');
  return !!b && !/setTimeout\(_lwKill,\s*15000\)/.test(b) && /setTimeout\(_lwKill,\s*\(typeof RR_LENS !== 'undefined' && RR_LENS\.COVER_MAX_MS\)/.test(b);
}
function oneShrinker(drive) { return (strip(drive).match(/createImageBitmap\(/g) || []).length === 1 && /function _rrThumbShrink\(bigBlob\) \{ return _rrShrinkImage\(bigBlob, 400, 0\.8\); \}/.test(drive); }

(async () => {
  const R = rd('research.js'), W = rd('wizard-photos.js'), D = rd('drive.js'), B = rd('barcode.js'), C = rd('config.js');
  console.log('\n== S · source rules ==');
  T('S1  research.js: every outside page opens through rrOpenExternal (no bare window.open)', !/window\.open\(/.test(strip(R)) && (strip(R).match(/window\.rrOpenExternal\(/g) || []).length === 4);
  const lensFns = fnBody(W, 'async function _identifyOpenLens(') + fnBody(W, 'function openGoogleLens(');
  T('S2  the Lens hand-off opens through rrOpenExternal; its fallbacks carry noopener', /window\.rrOpenExternal\(url, 'Google Lens'\)/.test(lensFns) && opensDetached(lensFns).length === 0, opensDetached(lensFns));
  T('S3  rrOpenExternal itself opens with noopener', opensDetached(fnBody(B, 'window.rrOpenExternal = function')).length === 0 && /window\.open\(url, '_blank', 'noopener'\)/.test(B));
  T('S4  the Sending screen\'s limit is RR_LENS.COVER_MAX_MS — the fixed 15 s is gone', lensCoverOk(W));
  T('S5  ONE shrinker in drive.js (thumbnails delegate to it)', oneShrinker(D));
  T('S6  the Lens numbers live in config.js (RR_LENS) and nowhere else', /const RR_LENS = \{ PHOTO_MAX_SIDE: 1600/.test(C) && !/PHOTO_MAX_SIDE:\s*\d/.test(strip(W)) && (strip(D).match(/PHOTO_MAX_SIDE:\s*1600/g) || []).length === 1);

  console.log('\n== P · planted offenders ==');
  T('P1  a bare window.open in research.js is caught', /window\.open\(/.test(strip(R + "\nfunction x(){ window.open('https://x', '_blank'); }")));
  T('P2  a Lens open without noopener is caught', opensDetached("window.open(url, '_blank');").length === 1);
  T('P3  the fixed 15 s cover back is caught', !lensCoverOk(W.replace(/setTimeout\(_lwKill, \(typeof RR_LENS[^\n]*\n/, 'setTimeout(_lwKill, 15000);\n')));
  T('P4  a second shrinker in drive.js is caught', !oneShrinker(D + '\nasync function x(b){ return createImageBitmap(b); }'));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    window.state = window.state || {};
    state.user = { email: 'stranger@example.com', name: 'Lens Test' };
    state.personalData = {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    window.showToast = function () {};
    for (var i = 0; i < 4; i++) history.pushState({ t: i }, '', location.href);
    accessToken = 'test-token';
    // Drive stand-ins: the upload records what it was handed
    window._ups = []; window._perms = [];
    window._rrLensFolder = async function () { return 'folder-1'; };
    window.driveUploadFile = async function (file, name) { window._ups.push({ file: file, name: name, size: file.size, type: file.type }); await new Promise(r => setTimeout(r, window._upDelay || 0)); return { id: 'f' + window._ups.length }; };
    window.driveRequest = async function (m, p) { window._perms.push(p); return {}; };
    window._opened = [];
    window.open = function (u, t, f) { window._opened.push([String(u).slice(0, 80), t, f]); return null; };
    // a noisy 3000x2000 photo — big as a phone shot
    window._bigPhoto = async function (w, h, name) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d'), img = g.createImageData(w, h);
      for (var i = 0; i < img.data.length; i += 4) { var v = (Math.random() * 255) | 0; img.data[i] = v; img.data[i + 1] = (v * 7) & 255; img.data[i + 2] = (v * 13) & 255; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      var b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      return new File([b], name || 'box.jpg', { type: 'image/jpeg', lastModified: 1700000000000 + w });
    };
    window._dims = async function (blob) { var bm = await createImageBitmap(blob); return [bm.width, bm.height]; };
  });

  console.log('\n== L · Lens gets a small copy ==');
  const l1 = await pg.evaluate(async () => {
    var f = await _bigPhoto(3000, 2000), steps = [];
    var s = await driveStageLensPhoto(f, function (n, ms) { steps.push([n, ms]); });
    var up = _ups[_ups.length - 1];
    return { orig: f.size, sent: up.size, type: up.type, dims: await _dims(up.file), steps: steps.map(x => x[0]), url: s.url, perm: _perms.length };
  });
  T('L1  a 3000x2000 photo goes to Lens at 1600 px on its long side', l1.dims[0] === 1600 && l1.dims[1] <= 1067 && l1.dims[1] >= 1066, l1.dims);
  T('L2  …as a JPEG, far fewer bytes (' + Math.round(l1.orig / 1024) + ' KB → ' + Math.round(l1.sent / 1024) + ' KB)', l1.type === 'image/jpeg' && l1.sent < l1.orig * 0.5, l1);
  T('L3  every step is timed: shrink, folder, upload (with its size), share link', JSON.stringify(l1.steps.map(s => s.replace(/\d+ KB/, 'N KB'))) === '["lens: shrink photo","lens: find folder","lens: upload N KB","lens: share link"]', l1.steps);
  T('L4  the copy is still made readable by link (Lens must fetch it)', l1.perm >= 1 && /^https:/.test(l1.url || ''), l1);
  const l5 = await pg.evaluate(async () => {
    var f = await _bigPhoto(3000, 2000); var n0 = _ups.length;
    await driveStageLensPhoto(f); var again = await driveStageLensPhoto(f);
    return { uploads: _ups.length - n0, reused: !!again.reused };
  });
  T('L5  searching the same photo again inside ten minutes re-uses the upload', l5.uploads === 1 && l5.reused, l5);
  const l6 = await pg.evaluate(async () => {
    var f = await _bigPhoto(500, 300, 'small.jpg'); var n0 = _ups.length;
    await driveStageLensPhoto(f);
    var up = _ups[_ups.length - 1];
    return { same: up.file === f, small: f.size, n: _ups.length - n0, limit: RR_LENS.SHRINK_OVER_BYTES };
  });
  T('L6  a photo already small (' + Math.round(l6.small / 1024) + ' KB) goes exactly as it is', l6.same && l6.n === 1 && l6.small < l6.limit, l6);
  const l7 = await pg.evaluate(async () => {
    var junk = new File([new Uint8Array(600000).fill(7)], 'broken.jpg', { type: 'image/jpeg', lastModified: 5 });
    await driveStageLensPhoto(junk);
    var up = _ups[_ups.length - 1];
    return { same: up.file === junk };
  });
  T('L7  a photo that cannot be decoded is sent as it is (never lost to the shrink)', l7.same, l7);
  const l8 = await pg.evaluate(async () => { var f = await _bigPhoto(1200, 900); var t = await _rrThumbShrink(f); return await _dims(t); });
  T('L8  thumbnails still shrink to 400 px through the same shrinker', l8[0] === 400 && l8[1] === 300, l8);

  console.log('\n== C · the Sending screen stays until Google opens ==');
  const c1 = await pg.evaluate(async () => {
    var f = await _bigPhoto(2400, 1600, 'cover.jpg');
    _identifyPhotoFile = f;
    window._upDelay = 1500;
    var limits = [], realST = window.setTimeout;
    window.setTimeout = function (fn, ms) { if (fn && /_lwKill|id-lens-wait/.test(String(fn)) || ms >= 15000) limits.push(ms); return realST.apply(window, arguments); };
    var n0 = _opened.length;
    var p = _identifyOpenLens();
    await new Promise(r => realST(r, 900));
    var during = !!document.getElementById('id-lens-wait');
    await p;
    window.setTimeout = realST;
    var openedNow = _opened.length - n0, rightAfter = !!document.getElementById('id-lens-wait');
    await new Promise(r => realST(r, 2800));
    window._upDelay = 0;
    var list = JSON.parse(localStorage.getItem('rr_research_times_v1') || '[]');
    var lens = list.filter(x => x.mode === 'lens').pop();
    return { during: during, openedNow: openedNow, open: _opened[_opened.length - 1], rightAfter: rightAfter, after: !!document.getElementById('id-lens-wait'), limits: limits, lens: lens };
  });
  T('C1  the Sending screen is up while the photo uploads', c1.during, c1);
  T('C2  its safety limit is RR_LENS.COVER_MAX_MS (90 s), not 15 s', c1.limits.indexOf(90000) >= 0 && c1.limits.indexOf(15000) < 0, c1.limits);
  T('C3  Google Lens is opened once, on its own (noopener), with the photo link and the hint', c1.openedNow === 1 && /^https:\/\/lens\.google\.com\/uploadbyurl\?url=/.test(c1.open[0]) && c1.open[1] === '_blank' && c1.open[2] === 'noopener', c1.open);
  T('C4  …and the Sending screen goes once Google is opening', c1.after === false, c1);
  T('C5  the Lens hand-off is recorded: its steps and the tap-to-Google total', c1.lens && c1.lens.outcome === 'opened' && c1.lens.steps.some(s => /lens: upload/.test(s[0])) && c1.lens.total >= 1400, c1.lens);

  console.log('\n== X · outside pages open on their own, timed ==');
  const x1 = await pg.evaluate(async () => {
    var n0 = _opened.length;
    window.rrOpenExternal('https://www.google.com/search?q=lionel+6464', 'Google price');
    await new Promise(r => setTimeout(r, 300));
    Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    var list = JSON.parse(localStorage.getItem('rr_research_times_v1') || '[]');
    var rec = list.filter(x => x.mode === 'link').pop();
    return { open: _opened[_opened.length - 1], n: _opened.length - n0, rec: rec };
  });
  T('X1  rrOpenExternal opens a new page with noopener', x1.n === 1 && x1.open[1] === '_blank' && x1.open[2] === 'noopener', x1.open);
  T('X2  …and records how long until the app was left', x1.rec && x1.rec.outcome === 'Google price' && x1.rec.steps[0][0] === 'Google price: until the app was left' && x1.rec.steps[0][1] >= 250, x1.rec);
  const x3 = await pg.evaluate(async () => {
    // the research card's buttons: one catalog row, typed lookup → the card
    state.masterAllRows = [{ itemNum: '2133031', description: 'Test hopper', roadName: 'Test Road', manufacturer: 'Lionel', _era: 'modern', variation: '' }];
    openResearch();
    await new Promise(r => setTimeout(r, 500));
    var q = document.getElementById('bi-quick'); q.value = '2133031'; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('[data-bi="quick"]').click();
    for (var i = 0; i < 30 && !document.getElementById('rs-google'); i++) await new Promise(r => setTimeout(r, 200));
    var n0 = _opened.length;
    ['rs-google', 'rs-ebay-now', 'rs-ebay'].forEach(function (id) { var b = document.getElementById(id); if (b) b.click(); });
    return { card: !!document.getElementById('rs-google'), opened: _opened.slice(n0) };
  });
  T('X3  the research card\'s Google / eBay Now / eBay Sold all open on their own (noopener)', x3.card && x3.opened.length === 3 && x3.opened.every(o => o[1] === '_blank' && o[2] === 'noopener'), x3);
  T('X4  …to the same places as before (google.com search, ebay.com)', x3.opened.length === 3 && /^https:\/\/www\.google\.com\/search\?q=/.test(x3.opened[0][0]) && /ebay\.com/.test(x3.opened[1][0]) && /ebay\.com/.test(x3.opened[2][0]), x3.opened.map(o => o[0]));
  T('X5  no page errors', errs.length === 0, errs);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
