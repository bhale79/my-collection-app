#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// STRAIGHTEN (keystone) — v0.9.1876   (real Chromium, the REAL crop screen, the
// REAL Cropper 1.6.1, the REAL drive.js / photo-crop.js against the stand-in
// Drive of tests/lib/crop-original-lib.js)
//
// [stated] Brad, 2026-10-03: "how hard to fix keystoning?" → the plan → "ok".
//
// THE RULES, run for real, each with a PLANTED mistake that must fail:
//   M · the sums: the four-corner map lands the corners exactly; the shape of
//       the thing (width ÷ height) comes back from a photographed rectangle;
//   A · a KNOWN keystone — a 4:3 card photographed by a pinhole camera tilted
//       20° and turned 12°, rendered by the test from its own 3×3 projection
//       (no app code) — straightens back into the flat card: every cell the
//       right colour, every border straight, the shape within 3 % of 4:3;
//       the dots are dragged with the real mouse;
//   B · Undo straighten brings the photo back; the dots come back where they
//       were; Back changes nothing;
//   C · a turn applied first is baked in: the dots sit on the turned picture;
//   D · the dots ride the photo (rrQuad beside rrBox): ✂ on another device
//       replays them, Apply there is a crop (never a restore), Restore original
//       still puts the exact original back and clears both records;
//   E · on a phone the Straighten button fits the Zoom row and the dots stay
//       inside the picture area, clear of the controls.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  crop_straighten_tests needs playwright and it is not installed.'); process.exit(1); }
const L = require('./lib/crop-original-lib.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 2 : tol);
const planted = (file, from, to, label) => L.planted(T, file, from, to, label);

// ── the test's own camera: a flat 1200×900 card, a pinhole projection ───────
// M = K · [r1 r2 t] maps card (u, v, 1) → picture (x, y, 1). The inverse is
// the plain 3×3 cofactor inverse. None of this is app code.
const CAMERA = `(() => {
  window.__card = { W: 1200, H: 900 };
  window.__flat = function (u, v) {
    if (u < 0 || v < 0 || u >= 1200 || v >= 900) return null;
    if (u < 40 || v < 40 || u >= 1160 || v >= 860) return [220, 30, 30];
    const cu = Math.floor(u / 100), cv = Math.floor(v / 100);
    if ((u % 100) < 6 || (v % 100) < 6) return [0, 0, 0];
    return [[40, 80, 220], [40, 190, 60], [230, 200, 40]][(cu + cv) % 3];
  };
  const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  window.__camera = function (tiltDeg, yawDeg, rollDeg, f, cx, cy, Z) {
    const t = tiltDeg * Math.PI / 180, y = yawDeg * Math.PI / 180, r = rollDeg * Math.PI / 180;
    const Rz = [[Math.cos(r), -Math.sin(r), 0], [Math.sin(r), Math.cos(r), 0], [0, 0, 1]];
    const Rx = [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
    const Ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
    const R = mul(Ry, mul(Rx, Rz));
    // the card's own frame is centred: (u - 600, v - 450) in card units; depth Z
    const K = [[f, 0, cx], [0, f, cy], [0, 0, 1]];
    const Rt = [[R[0][0], R[0][1], -600 * R[0][0] - 450 * R[0][1] + 0], [R[1][0], R[1][1], -600 * R[1][0] - 450 * R[1][1] + 0], [R[2][0], R[2][1], -600 * R[2][0] - 450 * R[2][1] + Z]];
    return mul(K, Rt);
  };
  window.__inv3 = m => { const [a, b, c, d, e, f, g, h, i] = [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]]; };
  window.__apply = (m, x, y) => { const w = m[2][0] * x + m[2][1] * y + m[2][2]; return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w, (m[1][0] * x + m[1][1] * y + m[1][2]) / w]; };
  // the keystoned picture, 1600×1200, drawn by inverse mapping; its corners
  window.__keystone = function (tilt, yaw, roll) {
    const M = __camera(tilt, yaw, roll, 1400, 800, 600, 2600), Mi = __inv3(M);
    const corners = [[0, 0], [1200, 0], [1200, 900], [0, 900]].map(p => __apply(M, p[0], p[1]));
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
    const x = c.getContext('2d'); const im = x.createImageData(1600, 1200); const d = im.data;
    for (let yy = 0; yy < 1200; yy++) for (let xx = 0; xx < 1600; xx++) {
      const [u, v] = __apply(Mi, xx + 0.5, yy + 0.5);
      const col = __flat(u, v) || [120, 120, 120];
      const i = (yy * 1600 + xx) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    return { url: c.toDataURL('image/jpeg', 0.95), corners, M };
  };
  // read the straightened picture under Cropper and judge it against the flat card
  window.__judge = async function () {
    const img = document.getElementById('_rrCropImg');
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const at = (px, py) => { const i = (py * c.width + px) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    let ok = 0, bad = 0, worst = 0;
    for (let cv = 0; cv < 9; cv++) for (let cu = 0; cu < 12; cu++) {
      const u = cu * 100 + 55, v = cv * 100 + 55;
      const exp = __flat(u, v), got = at(Math.round(u / 1200 * c.width), Math.round(v / 900 * c.height));
      const diff = Math.max(Math.abs(got[0] - exp[0]), Math.abs(got[1] - exp[1]), Math.abs(got[2] - exp[2]));
      worst = Math.max(worst, diff); if (diff < 48) ok++; else bad++;   // JPEG noise at a cell edge reached 40 once on the live site; a wrong colour is 100+ away
    }
    const red = p => p[0] > 170 && p[1] < 90 && p[2] < 90;
    const border = { top: 0, bottom: 0, left: 0, right: 0, n: 0 };
    for (let k = 0.03; k < 0.97; k += 0.02) {
      border.n++;
      if (red(at(Math.round(k * c.width), Math.round(0.02 * c.height)))) border.top++;
      if (red(at(Math.round(k * c.width), Math.round(0.98 * c.height)))) border.bottom++;
      if (red(at(Math.round(0.02 * c.width), Math.round(k * c.height)))) border.left++;
      if (red(at(Math.round(0.98 * c.width), Math.round(k * c.height)))) border.right++;
    }
    return { w: c.width, h: c.height, ratio: c.width / c.height, cells: { ok, bad, worst }, border };
  };
  window.__dotCentres = () => [0, 1, 2, 3].map(i => { const e = document.getElementById('_rrStrDot' + i); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  window.__picRect = () => { const p = document.getElementById('_rrStrPic'); if (!p) return null; const b = p.getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height, pw: p.width, ph: p.height }; };
  window.__labels = () => ({ hint: document.getElementById('_rrCropHint').textContent, cancel: document.getElementById('_rrCropCancel').textContent, apply: document.getElementById('_rrCropApply').textContent, str: document.getElementById('_rrCropStraighten').textContent, layer: !!document.getElementById('_rrStrLayer'), cropperShown: (() => { const cc = document.querySelector('.cropper-container'); return !!cc && cc.style.display !== 'none'; })() });
  window.__settled = () => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { const img = document.getElementById('_rrCropImg'); if (img && img.cropper && img.cropper.ready && !document.getElementById('_rrStrWait') && !document.getElementById('_rrStrLayer')) return res(true); if (Date.now() - t0 > 20000) return rej(new Error('did not settle')); setTimeout(poll, 60); })(); });
})()`;

// drag each dot onto the picture point `pts[i]` (picture pixels → screen) with the real mouse
async function dragDots(pg, pts, srcW) {
  const pic = await pg.evaluate(() => __picRect());
  const k = pic.width / srcW;
  for (let i = 0; i < 4; i++) {
    const from = (await pg.evaluate(() => __dotCentres()))[i];
    const to = [pic.left + pts[i][0] * k, pic.top + pts[i][1] * k];
    await pg.mouse.move(from[0], from[1]); await pg.mouse.down(); await pg.mouse.move(to[0], to[1], { steps: 6 }); await pg.mouse.up();
  }
  return pic;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const D = L.makeDrive();
  let pg, errs, r;

  // ═══ M · the sums ═══════════════════════════════════════════════════════
  console.log('== M · the four-corner map and the shape of the thing ==');
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  const M = await pg.evaluate(() => {
    const out = {};
    const q = [[300, 150], [1500, 150], [1068, 747], [214, 747]];
    const H = _rrHomography([[0, 0], [1200, 0], [1200, 900], [0, 900]], q);
    out.landed = H && [[0, 0], [1200, 0], [1200, 900], [0, 900]].map((p, i) => { const m = _rrProject(H, p[0], p[1]); return Math.hypot(m[0] - q[i][0], m[1] - q[i][1]); });
    out.middle = H && _rrProject(H, 600, 450);
    out.degenerate = _rrHomography([[0, 0], [1, 0], [2, 0], [0, 1]], q);
    const mk = (t, y, rl) => { const Mx = __camera(t, y, rl, 1400, 800, 600, 2600); return [[0, 0], [1200, 0], [1200, 900], [0, 900]].map(p => __apply(Mx, p[0], p[1])); };
    out.aspectBoth = _rrQuadAspect(mk(20, 12, 3), 800, 600, 1600);
    out.aspectKeystone = _rrQuadAspect(mk(25, 0, 0), 800, 600, 1600);
    out.aspectFlat = _rrQuadAspect(mk(0, 0, 0), 800, 600, 1600);
    out.aspectSquare = _rrQuadAspect((() => { const Mx = __camera(20, 10, 0, 1400, 800, 600, 2600); return [[150, 0], [1050, 0], [1050, 900], [150, 900]].map(p => __apply(Mx, p[0], p[1])); })(), 800, 600, 1600);
    const sz = _rrQuadSize(mk(20, 12, 3), 2400, 800, 600);
    out.size = sz; out.sizeRatio = sz.w / sz.h;
    out.cap = _rrQuadSize([[0, 0], [5000, 0], [5000, 3000], [0, 3000]], 2400, 2500, 1500);
    return out;
  });
  T('M1  the map lands all four corners (under a thousandth of a pixel)', M.landed && M.landed.every(e => e < 1e-3), M.landed);
  T('M2  …and the middle of the card lands inside the quad', M.middle && M.middle[0] > 214 && M.middle[0] < 1500 && M.middle[1] > 150 && M.middle[1] < 747, M.middle);
  T('M3  three corners in a line: no map (null), never garbage', M.degenerate === null, M.degenerate);
  T('M4  a 4:3 card photographed tilted 20° and turned 12°: the shape comes back 4:3 within 1 %', near(M.aspectBoth, 4 / 3, 0.0134), M.aspectBoth);
  T('M5  a pure keystone (tilted 25°, nothing else) assumes a phone lens: within 5 %', near(M.aspectKeystone, 4 / 3, 0.067), M.aspectKeystone);
  T('M6  flat-on and a square card are read right too', near(M.aspectFlat, 4 / 3, 0.0134) && near(M.aspectSquare, 1, 0.01), { flat: M.aspectFlat, square: M.aspectSquare });
  T('M7  the straightened size keeps the long side measured and takes the short one from the shape', M.sizeRatio && near(M.sizeRatio, 4 / 3, 0.02) && M.size.w > 400, M.size);
  T('M8  …and never exceeds the crop cap on its long side', M.cap.w === 2400 && M.cap.h === 1440, M.cap);

  // ═══ A · a known keystone, straightened by hand ═══════════════════════════
  console.log('\n== A · a photographed card straightens back into the flat card (dots dragged with the mouse) ==');
  const A0 = await pg.evaluate(async () => {
    const k = __keystone(20, 12, 3);
    window.__k = k;
    const file = await __fileFrom(k.url, 'IMG_key.jpg');
    window.__p = new Promise(res => _cropFirst(file, f => res(f)));
    const scr = await __screen();
    return { natural: scr.natural, corners: k.corners };
  });
  T('A1  the crop screen opened on the photographed card (1600x1200)', A0.natural[0] === 1600 && A0.natural[1] === 1200, A0.natural);
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  const A1 = await pg.evaluate(() => Object.assign(__labels(), { dots: __dotCentres(), pic: __picRect() }));
  T('A2  Straighten: four dots over the picture, Cropper tucked away, the words change (Back / Straighten / "Drag the four dots…")',
    A1.layer && !A1.cropperShown && A1.dots.every(Boolean) && A1.cancel === 'Back' && A1.apply === 'Straighten' && /Drag the four dots/.test(A1.hint) && /Placing dots/.test(A1.str), A1);
  T('A3  the dots start inset from the picture (nowhere to drag a dot that sits on the picture\'s own corner)',
    A1.dots.every(d => d[0] > A1.pic.left + 5 && d[0] < A1.pic.left + A1.pic.width - 5 && d[1] > A1.pic.top + 5 && d[1] < A1.pic.top + A1.pic.height - 5), { dots: A1.dots, pic: A1.pic });
  const pic = await dragDots(pg, A0.corners, 1600);
  const A2 = await pg.evaluate(() => __dotCentres());
  const want = A0.corners.map(c => [pic.left + c[0] * pic.width / 1600, pic.top + c[1] * pic.width / 1600]);
  T('A4  the real mouse put every dot on its corner (within 2px on screen)', A2.every((d, i) => near(d[0], want[i][0]) && near(d[1], want[i][1])), { got: A2, want });
  await pg.evaluate(() => __press('_rrCropApply'));   // reads "Straighten"
  await pg.evaluate(() => __settled());
  const A3 = await pg.evaluate(async () => Object.assign(await __judge(), __labels(), { scr: await __screen() }));
  T('A5  the card came out flat: all 108 cells the right colour (worst channel error under 48)', A3.cells.ok === 108 && A3.cells.bad === 0, A3.cells);
  T('A6  …every border straight along its whole length', A3.border.top === A3.border.n && A3.border.bottom === A3.border.n && A3.border.left === A3.border.n && A3.border.right === A3.border.n, A3.border);
  T('A7  …in its true shape: 4:3 within 3 %, not the foreshortened trapezoid\'s average', near(A3.ratio, 4 / 3, 0.04), { w: A3.w, h: A3.h, ratio: A3.ratio });
  T('A8  back in the crop screen on the straightened picture: level reads 0.0°, the button says Undo straighten, the hint says so', A3.scr.rot === '0.0°' && A3.str === 'Undo straighten' && /Straightened/.test(A3.hint) && A3.cropperShown && !A3.layer && A3.cancel === 'Cancel' && A3.apply === 'Apply crop', A3);
  const warpPts = A0.corners;

  // ═══ B · undo, the dots' memory, Back ════════════════════════════════════
  console.log('\n== B · Undo straighten, the dots come back where they were, Back changes nothing ==');
  await pg.evaluate(() => __press('_rrCropStraighten'));   // Undo straighten
  await pg.evaluate(() => __settled());
  const B0 = await pg.evaluate(async () => Object.assign(__labels(), { scr: await __screen() }));
  T('B1  Undo straighten: the photographed card is back (1600x1200), the button says Straighten, the hint is the plain one', B0.scr.natural[0] === 1600 && B0.scr.natural[1] === 1200 && B0.str === 'Straighten' && /Drag the box/.test(B0.hint), B0);
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  const B1 = await pg.evaluate(() => ({ dots: __dotCentres(), pic: __picRect() }));
  const want2 = warpPts.map(c => [B1.pic.left + c[0] * B1.pic.width / 1600, B1.pic.top + c[1] * B1.pic.width / 1600]);
  T('B2  Straighten again: the dots are where they were left (within 2px)', B1.dots.every((d, i) => near(d[0], want2[i][0]) && near(d[1], want2[i][1])), { got: B1.dots, want: want2 });
  await pg.evaluate(() => __press('_rrCropCancel'));   // reads "Back"
  await pg.waitForTimeout(150);
  const B2 = await pg.evaluate(async () => Object.assign(__labels(), { scr: await __screen() }));
  T('B3  Back: the dots go away, Cropper is back on the same picture, the words are the crop screen\'s again', !B2.layer && B2.cropperShown && B2.scr.natural[0] === 1600 && B2.cancel === 'Cancel' && B2.apply === 'Apply crop' && B2.str === 'Straighten' && /Drag the box/.test(B2.hint), B2);
  T('B4  no page errors so far', errs.length === 0, errs);
  await pg.evaluate(() => __press('_rrCropCancel'));
  await pg.close();

  // ═══ C · a turn first ═════════════════════════════════════════════════════
  console.log('\n== C · a turn applied first is baked into the picture the dots sit on ==');
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  await pg.evaluate(async () => { const k = __keystone(20, 12, 3); const file = await __fileFrom(k.url, 'IMG_k2.jpg'); window.__p = new Promise(res => _cropFirst(file, f => res(f))); await __screen(); __press('_rrCropRotQtrR'); });
  await pg.waitForTimeout(200);
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  const C0 = await pg.evaluate(() => ({ pic: __picRect(), rot: document.getElementById('_rrCropRotV').textContent }));
  T('C1  turned 90° and then Straighten: the dots sit on the TURNED picture (1200 wide by 1600 tall)', C0.pic && C0.pic.pw / C0.pic.ph < 1 && near(C0.pic.pw / C0.pic.ph, 1200 / 1600, 0.02), C0);
  await pg.evaluate(() => __press('_rrCropApply'));
  await pg.evaluate(() => __settled());
  const C1 = await pg.evaluate(async () => Object.assign(__labels(), { scr: await __screen() }));
  T('C2  the straightened result is level (0.0°) — the turn is inside the picture now', C1.scr.rot === '0.0°' && C1.str === 'Undo straighten', C1);
  await pg.evaluate(() => __press('_rrCropStraighten'));   // undo
  await pg.evaluate(() => __settled());
  const C2 = await pg.evaluate(async () => ({ rot: document.getElementById('_rrCropRotV').textContent, scr: await __screen() }));
  T('C3  Undo puts the turn back as it was (90.0°) on the original picture', C2.rot === '90.0°' && C2.scr.natural[0] === 1600, C2);
  await pg.evaluate(() => __press('_rrCropCancel'));
  T('C4  no page errors', errs.length === 0, errs);
  await pg.close();

  // ═══ D · the dots ride the photo ══════════════════════════════════════════
  console.log('\n== D · the dots are recorded on the photo, replayed on ✂, and Restore still restores ==');
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  const D0 = await pg.evaluate(async () => { const k = __keystone(20, 12, 3); window.__k = k; const file = await __fileFrom(k.url, 'IMG_k3.jpg'); window.__orig = file; window.__p = new Promise(res => _cropFirst(file, f => res(f))); await __screen(); return { corners: k.corners, origSha: await __sha(file), origSize: file.size }; });
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  await dragDots(pg, D0.corners, 1600);
  await pg.evaluate(() => __press('_rrCropApply'));
  await pg.evaluate(() => __settled());
  const firstJudge = await pg.evaluate(() => __judge());
  await pg.evaluate(() => __press('_rrCropApply'));   // Apply crop
  const D1 = await pg.evaluate(async () => { const f = await window.__p; window.__cropped = f; return { box: f._rrCropBox, hasOrig: f._rrOriginal === window.__orig, sha: await __sha(f), dims: await __dims(f) }; });
  T('D1  Apply crop: the File carries the box AND the dots (rotation 0, the 1600x1200 picture, the four corners)',
    D1.hasOrig && D1.box && D1.box.quad && D1.box.quad.r === 0 && D1.box.quad.W === 1600 && D1.box.quad.H === 1200 && D1.box.quad.pts.every((p, i) => near(p[0], D0.corners[i][0], 4) && near(p[1], D0.corners[i][1], 4)) && D1.box.whole === false, D1.box);
  const up = await pg.evaluate(async () => (await driveUploadFile(window.__cropped, 'Lionel 2353 ID7 FV.jpg', 'folder1')).id);
  const fD = D.files[up];
  T('D2  uploaded: version 1 the original (protected), version 2 the straightened crop; rrBox AND rrQuad stored', fD && fD.revisions.length === 2 && fD.revisions[0].keepForever === true && L.sha(fD.revisions[0].bytes) === D0.origSha && /^0\.0\|1600\|1200\|(\d+,){7}\d+$/.test(fD.appProperties.rrQuad || '') && /^\d+,\d+,\d+,\d+,0\.0,\d+$/.test(fD.appProperties.rrBox || ''), fD && fD.appProperties);
  await pg.close();
  // another device
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  await pg.evaluate(id => __open(id), up);
  await pg.evaluate(() => __settled());
  const D2 = await pg.evaluate(async () => Object.assign(await __judge(), __labels(), { scr: await __screen() }));
  T('D3  ✂ elsewhere: the dots were replayed — the screen shows the straightened card again (flat, every cell right), Restore offered, Undo straighten available', D2.cells.ok === 108 && D2.restore !== false && D2.scr.restore && D2.str === 'Undo straighten' && /straightened photo/.test(D2.hint) && near(D2.ratio, firstJudge.ratio, 0.01), { cells: D2.cells, str: D2.str, hint: D2.hint, scr: D2.scr });
  await pg.evaluate(() => __press('_rrCropApply'));
  r = await pg.evaluate(() => __waitDone());
  const headDims = await pg.evaluate(() => __dims(window.__doneBlob));
  T('D4  Apply without touching anything is a CROP (never a restore): the same straightened picture is written again', r.ok && r.kind === 'crop' && headDims && near(headDims[0], firstJudge.w, 2) && near(headDims[1], firstJudge.h, 2) && fD.revisions.length === 3 && fD.appProperties.rrQuad, { r, headDims, first: [firstJudge.w, firstJudge.h], props: fD.appProperties });
  await pg.evaluate(id => __open(id), up);
  await pg.evaluate(() => __settled());
  await pg.evaluate(() => __press('_rrCropRestore'));
  r = await pg.evaluate(() => __waitDone());
  T('D5  Restore original: the exact original is back and BOTH records are cleared', r.ok && r.kind === 'restore' && L.sha(D.head(fD).bytes) === D0.origSha && !('rrBox' in fD.appProperties) && !('rrQuad' in fD.appProperties), { r, props: fD.appProperties });
  T('D6  nothing deleted, no page errors', D.deletes === 0 && errs.length === 0, { deletes: D.deletes, errs });
  await pg.close();

  // ═══ F · levelled AFTER straightening: the turn and the box come back too ═
  console.log('\n== F · a levelling step after the straighten, and a crop box, replay with the dots ==');
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  const F0 = await pg.evaluate(async () => { const k = __keystone(20, 12, 3); window.__k = k; const file = await __fileFrom(k.url, 'IMG_k5.jpg'); window.__p = new Promise(res => _cropFirst(file, f => res(f))); await __screen(); return k.corners; });
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  await dragDots(pg, F0, 1600);
  await pg.evaluate(() => __press('_rrCropApply'));
  await pg.evaluate(() => __settled());
  const F1 = await pg.evaluate(async () => { __press('_rrCropRotPlus'); __press('_rrCropRotPlus'); await new Promise(r => setTimeout(r, 150)); const c = document.getElementById('_rrCropImg').cropper; c.setData({ x: 120, y: 90, width: 600, height: 400 }); await new Promise(r => setTimeout(r, 100)); const d = c.getData(); return { rot: document.getElementById('_rrCropRotV').textContent, data: d }; });
  T('F1  after the straighten: two half-degree steps read 1.0°, the box set on the straightened picture', F1.rot === '1.0\u00b0' && near(F1.data.rotate, 1, 0.01) && near(F1.data.width, 600, 3), F1);
  await pg.evaluate(() => __press('_rrCropApply'));
  const F2 = await pg.evaluate(async () => { const f = await window.__p; window.__cropped = f; return { box: f._rrCropBox }; });
  T('F2  the record: the box carries its own turn (1.0) and the dots carry theirs (0)', F2.box && near(F2.box.r, 1, 0.01) && F2.box.quad && F2.box.quad.r === 0, F2.box);
  const upF = await pg.evaluate(async () => (await driveUploadFile(window.__cropped, 'Lionel 2353 ID8 FV.jpg', 'folder1')).id);
  await pg.close();
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(CAMERA);
  await pg.evaluate(id => __open(id), upF);
  await pg.evaluate(() => __settled());
  await pg.waitForTimeout(200);
  const F3 = await pg.evaluate(async () => Object.assign({ rot: document.getElementById('_rrCropRotV').textContent }, { scr: await __screen() }));
  // (compared with what the first screen REPORTED after setting it — Cropper keeps
  // the box inside its container, so a box that asks to overhang is moved up a
  // few pixels there and then; the replay must land where the first one did)
  T('F3  ✂ elsewhere replays the dots, then the levelling (1.0°), then the box where it was', F3.rot === '1.0\u00b0' && near(F3.scr.data.rotate, 1, 0.01) && near(F3.scr.data.x, F1.data.x, 3) && near(F3.scr.data.y, F1.data.y, 3) && near(F3.scr.data.width, F1.data.width, 3) && near(F3.scr.data.height, F1.data.height, 3), { got: F3.scr.data, first: F1.data });
  T('F4  no page errors', errs.length === 0, errs);
  await pg.evaluate(() => __press('_rrCropCancel'));
  await pg.close();

  // ═══ E · a phone ══════════════════════════════════════════════════════════
  console.log('\n== E · a phone: the button fits the Zoom row, the dots stay inside the picture area ==');
  ({ pg, errs } = await L.openApp(browser, D, { w: 390, h: 844 }));
  await pg.evaluate(CAMERA);
  await pg.evaluate(async () => { const k = __keystone(20, 12, 3); const file = await __fileFrom(k.url, 'IMG_k4.jpg'); window.__p = new Promise(res => _cropFirst(file, f => res(f))); await __screen(); });
  const E0 = await pg.evaluate(() => {
    const R = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const row = document.getElementById('_rrCropRowZoom'), btn = document.getElementById('_rrCropStraighten');
    return { row: R(row), btn: R(btn), rowScroll: row.scrollWidth, rowClient: row.clientWidth, zoomIn: R(document.getElementById('_rrCropZoomIn')), vw: innerWidth };
  });
  T('E1  the Straighten button sits in the Zoom row, on the same line as − and +, inside the screen (no wrap, no scroll)', near(E0.btn.top, E0.zoomIn.top, 2) && E0.btn.right <= E0.vw && E0.rowScroll <= E0.rowClient + 1, E0);
  await pg.evaluate(() => __press('_rrCropStraighten'));
  await pg.waitForTimeout(250);
  const E1 = await pg.evaluate(() => {
    const R = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
    const stage = R(document.getElementById('_rrCropStage')), level = R(document.getElementById('_rrCropRowLevel')), apply = R(document.getElementById('_rrCropApply'));
    return { stage, level, apply, dots: __dotCentres(), pic: __picRect(), vh: innerHeight };
  });
  T('E2  every dot (34px target) is wholly inside the picture area, above the controls', E1.dots.every(d => d[0] - 17 >= E1.stage.left && d[0] + 17 <= E1.stage.right && d[1] - 17 >= E1.stage.top && d[1] + 17 <= E1.stage.bottom) && E1.stage.bottom <= E1.level.top + 1 && E1.apply.bottom <= E1.vh, E1);
  await pg.screenshot({ path: path.join(__dirname, '..', '_crop_straighten_phone.png') }).catch(() => {});
  try { fs.unlinkSync(path.join(__dirname, '..', '_crop_straighten_phone.png')); } catch (e) {}
  await pg.evaluate(() => __press('_rrCropApply'));
  await pg.evaluate(() => __settled());
  const E2 = await pg.evaluate(async () => Object.assign(await __judge(), { scr: await __screen() }));
  T('E3  …and the phone straightens too (default dots, a flat result, level 0.0°)', E2.w > 64 && E2.scr.rot === '0.0°', E2.scr);
  T('E4  no page errors', errs.length === 0, errs);
  await pg.evaluate(() => __press('_rrCropCancel'));
  await pg.close();

  // ═══ PLANTED ══════════════════════════════════════════════════════════════
  console.log('\n== PLANTED · each rule can fail ==');
  async function straightenKnown(files) {
    const Dp = L.makeDrive();
    const o = await L.openApp(browser, Dp, { files });
    const pg2 = o.pg;
    await pg2.evaluate(CAMERA);
    const k0 = await pg2.evaluate(async () => { const k = __keystone(20, 12, 3); const file = await __fileFrom(k.url, 'IMG_p.jpg'); window.__orig = file; window.__p = new Promise(res => _cropFirst(file, f => res(f))); await __screen(); return k.corners; });
    await pg2.evaluate(() => __press('_rrCropStraighten'));
    await pg2.waitForTimeout(250);
    await dragDots(pg2, k0, 1600);
    await pg2.evaluate(() => __press('_rrCropApply'));
    await pg2.evaluate(() => __settled());
    return { pg: pg2, Dp, judge: await pg2.evaluate(() => __judge()) };
  }
  // P1: a map without the perspective term — an affine stretch, not a straightening
  const p1 = planted('photo-crop.js', "        var den = H[6] * X + H[7] * Y + H[8];\n", "        var den = 1;\n", 'warp without perspective');
  if (p1) { const o = await straightenKnown(p1); await o.pg.close(); T('PLANTED P1: a warp with no perspective term does not give the flat card back (caught by A5/A6)', o.judge.cells.bad > 10 || o.judge.border.top < o.judge.border.n, o.judge); }
  // P2: Apply crop that forgets the dots
  const p2 = planted('photo-crop.js', "    if (_box && _str.applied) { _box.quad = _str.applied; _box.whole = false; }", "    if (_box && _str.applied) { _box.whole = false; }", 'record without the dots');
  if (p2) {
    const o = await straightenKnown(p2);
    await o.pg.evaluate(() => __press('_rrCropApply'));
    const b = await o.pg.evaluate(async () => { const f = await window.__p; window.__cropped = f; const id = (await driveUploadFile(f, 'x.jpg', 'folder1')).id; return { quad: f._rrCropBox && f._rrCropBox.quad, id }; });
    await o.pg.close();
    T('PLANTED P2: a record without the dots stores no rrQuad (caught by D1/D2)', !b.quad && !o.Dp.files[b.id].appProperties.rrQuad, o.Dp.files[b.id].appProperties);
  }
  // P3: a straightened result treated as "the original, whole" → Apply would RESTORE
  const p3 = planted('photo-crop.js', "    if (_box && _str.applied) { _box.quad = _str.applied; _box.whole = false; }", "    if (_box && _str.applied) { _box.quad = _str.applied; }", 'straightened counts as whole');
  if (p3) {
    const o = await straightenKnown(p3);
    await o.pg.evaluate(() => __press('_rrCropApply'));
    const id = await o.pg.evaluate(async () => { const f = await window.__p; return (await driveUploadFile(f, 'x.jpg', 'folder1')).id; });
    await o.pg.close();
    const o2 = await L.openApp(browser, o.Dp, { files: p3 });
    await o2.pg.evaluate(CAMERA);
    await o2.pg.evaluate(i => __open(i), id);
    await o2.pg.evaluate(() => __settled());
    await o2.pg.evaluate(() => __press('_rrCropApply'));
    const rr = await o2.pg.evaluate(() => __waitDone());
    await o2.pg.close();
    T('PLANTED P3: with "whole" left standing, Apply on the replayed straightened photo RESTORES the original instead of cropping (caught by D4)', rr.kind === 'restore', rr);
  }
  // P4: the record read back without the dots — ✂ shows the plain original, no replay
  const p4 = planted('photo-crop.js', "  if (box && quad) box.quad = quad;\n", "", 'dots not read back');
  if (p4) {
    const o = await straightenKnown(p4);
    await o.pg.evaluate(() => __press('_rrCropApply'));
    const id = await o.pg.evaluate(async () => { const f = await window.__p; return (await driveUploadFile(f, 'x.jpg', 'folder1')).id; });
    await o.pg.close();
    const o2 = await L.openApp(browser, o.Dp, { files: p4 });
    await o2.pg.evaluate(CAMERA);
    await o2.pg.evaluate(i => __open(i), id);
    const s2 = await o2.pg.evaluate(async () => Object.assign(__labels(), { scr: await __screen() }));
    await o2.pg.close();
    T('PLANTED P4: dots never read back → ✂ opens on the plain original with the Straighten button idle (caught by D3)', s2.scr.natural[0] === 1600 && s2.str === 'Straighten', s2);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
