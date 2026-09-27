#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CROP PREVIEW — v0.9.1827   (real Chromium, the REAL crop screen, the REAL
// Cropper 1.6.1 — served from tests/fixtures, never from the network)
//
// Release readiness S9, check 2. Brad, 2026-09-27, the THIRD flash report:
// "the crazy flashing again … it even stops flashing after 5 or 10 seconds,
// and then flashes some more but not as fast" — "the picture itself". The
// recorder's diary came off his phone (v1826) and named it: nothing behind
// the overlay, no stalled frames, Cropper redrawing a 3000×4000 (12 MP)
// picture on every nudge. Android blanks a picture that big while it
// re-rasters it. That blank is the flash.
//
// THE RULE: the crop screen works on a screen-sized copy — at most
// _RR_CROP_MAX (2400) on the long side — and NOTHING is lost, because
// getCroppedCanvas({ maxWidth, maxHeight }) always drew the photo into a
// source canvas capped at that same size before cutting. Section C proves
// that with the real Cropper on the real 12 MP photo: the crop that comes out
// of the new path is the crop the old path made. Section E plants the
// offender (no copy) and the pin goes red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  crop_preview_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIX = path.join(__dirname, 'fixtures');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));

async function open(browser, width) {
  const pg = await browser.newPage({ viewport: { width, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    if (/cropperjs\/1\.6\.1\/cropper\.min\.js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: CROPPER_JS });
    if (/cropperjs\/1\.6\.1\/cropper\.min\.css/.test(u)) return r.fulfill({ contentType: 'text/css', body: CROPPER_CSS });
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  // the in-page toolkit every section uses
  await pg.evaluate(() => {
    // a "photo": four flat colour quadrants and a white diagonal band, so a
    // sample at any relative position says which part of the picture it is
    window.__photo = function (w, h, q) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      [['#d02020', 0, 0], ['#20b020', w / 2, 0], ['#2040d0', 0, h / 2], ['#e0c020', w / 2, h / 2]].forEach(([col, px, py]) => { x.fillStyle = col; x.fillRect(px, py, w / 2, h / 2); });
      x.strokeStyle = '#fff'; x.lineWidth = Math.round(w / 40); x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.stroke();
      return c.toDataURL('image/jpeg', q || 0.92);
    };
    window.__load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    window.__pixels = async function (blobOrCanvas, step, fitW, fitH) {
      let src = blobOrCanvas;
      if (!(src instanceof HTMLCanvasElement)) src = await createImageBitmap(src);
      const c = document.createElement('canvas'); c.width = fitW || src.width; c.height = fitH || src.height;
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      c.__natural = [src.width, src.height];
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const out = [];
      for (let i = 0; i < d.length; i += 4 * (step || 97)) out.push(d[i], d[i + 1], d[i + 2]);
      return { w: c.__natural[0], h: c.__natural[1], px: out };
    };
    window.__sample = function (canvas, fx, fy) {
      const d = canvas.getContext('2d').getImageData(Math.round(canvas.width * fx), Math.round(canvas.height * fy), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    // open the real crop screen and wait until Cropper has built
    window.__openCrop = function (src) {
      return new Promise(resolve => {
        const out = { result: null, cancelled: false };
        _openCropper(src, blob => { out.result = blob; out.done = true; }, () => { out.cancelled = true; out.done = true; }, {});
        const t0 = Date.now();
        (function poll() {
          const img = document.getElementById('_rrCropImg');
          const built = img && img.cropper && img.cropper.ready && !document.getElementById('_rrCropWait');
          if (built || Date.now() - t0 > 15000) return resolve(out);
          setTimeout(poll, 50);
        })();
      });
    };
    window.__cropperInfo = function () {
      const img = document.getElementById('_rrCropImg');
      const d = img && img.cropper ? img.cropper.getImageData() : null;
      return { src: img ? img.src.slice(0, 5) : null, natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null, cropperNatural: d ? d.naturalWidth + 'x' + d.naturalHeight : null, built: !!(img && img.cropper && img.cropper.ready) };
    };
  });
  return { pg, errs };
}
const meanDiff = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return n ? s / n : 999; };

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A · the copy itself (lifted, run for real on canvases) ──────────────
  console.log('== A · _rrCropPreview: a screen-sized copy, only when the photo is bigger than the crop can use ==');
  {
    const { pg, errs } = await open(browser, 1200);
    const a = await pg.evaluate(async () => {
      const r = {};
      const mk = (w, h) => __load(__photo(w, h));
      const prev = (im, max) => new Promise(res => _rrCropPreview(im, max, res));
      const big = await mk(3000, 4000);
      const url = await prev(big, _RR_CROP_MAX);
      r.bigUrl = url ? url.slice(0, 5) : url;
      if (url) {
        const p = await __load(url);
        r.big = p.naturalWidth + 'x' + p.naturalHeight;
        const c = document.createElement('canvas'); c.width = p.naturalWidth; c.height = p.naturalHeight; c.getContext('2d').drawImage(p, 0, 0);
        r.quadrants = [[0.15, 0.35], [0.75, 0.25], [0.25, 0.75], [0.85, 0.65]].map(([fx, fy]) => __sample(c, fx, fy));   // off the white diagonal
        URL.revokeObjectURL(url);
      }
      r.small = await prev(await mk(1200, 900), _RR_CROP_MAX);
      r.exact = await prev(await mk(2400, 1800), _RR_CROP_MAX);
      const u3 = await prev(await mk(4032, 3024), _RR_CROP_MAX);
      if (u3) { const p3 = await __load(u3); r.land = p3.naturalWidth + 'x' + p3.naturalHeight; URL.revokeObjectURL(u3); }
      r.max = _RR_CROP_MAX;
      return r;
    });
    T('A1  a 3000×4000 photo becomes an 1800×2400 copy (a quarter of the pixels), handed back as a blob URL', a.big === '1800x2400' && a.bigUrl === 'blob:', a);
    const near = (c, want) => c && Math.abs(c[0] - want[0]) < 24 && Math.abs(c[1] - want[1]) < 24 && Math.abs(c[2] - want[2]) < 24;
    T('A2  …and it is the same picture: red / green / blue / yellow quadrants where they were', a.quadrants && near(a.quadrants[0], [208, 32, 32]) && near(a.quadrants[1], [32, 176, 32]) && near(a.quadrants[2], [32, 64, 208]) && near(a.quadrants[3], [224, 192, 32]), a.quadrants);
    T('A3  a 1200×900 photo needs no copy (null → the original is used)', a.small === null, a.small);
    T('A4  a photo exactly at the cap needs no copy either', a.exact === null, a.exact);
    T('A5  a 4032×3024 (a phone\'s usual 12 MP, landscape) becomes 2400×1800', a.land === '2400x1800', a.land);
    T('A6  the cap is 2400 — the number the saved crop was always cut at', a.max === 2400, a.max);
    T('A7  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── B · the real crop screen hands Cropper the copy ─────────────────────
  console.log('\n== B · the real crop screen on a 12 MP photo: Cropper is handed the copy ==');
  let bInfo;
  {
    const { pg, errs } = await open(browser, 1200);
    const b = await pg.evaluate(async () => {
      const src = __photo(3000, 4000);
      const o = await __openCrop(src);
      const info = __cropperInfo();
      const blobSrc = document.getElementById('_rrCropImg').src;
      document.getElementById('_rrCropCancel').click();
      await new Promise(r => setTimeout(r, 100));
      let alive = 'unknown';
      try { await fetch(blobSrc); alive = 'alive'; } catch (e) { alive = 'revoked'; }
      return { info, cancelled: o.cancelled, gone: !document.getElementById('_rrCropImg'), alive };
    });
    bInfo = b;
    T('B1  Cropper built', b.info.built, b.info);
    T('B2  …on the 1800×2400 copy, not the 3000×4000 photo', b.info.cropperNatural === '1800x2400' && b.info.natural === '1800x2400', b.info);
    T('B3  …loaded from a blob URL of our own making', b.info.src === 'blob:', b.info);
    T('B4  Cancel closes the screen and hands back the original file (nothing cropped)', b.cancelled && b.gone, b);
    T('B5  …and the copy is released (its blob URL no longer resolves)', b.alive === 'revoked', b.alive);
    T('B6  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── C · nothing is lost: the crop that comes out is the crop the old path made ──
  console.log('\n== C · the saved crop is the same picture the old path saved (real Cropper on the real 12 MP photo) ==');
  {
    const { pg, errs } = await open(browser, 1200);
    const c = await pg.evaluate(async () => {
      const src = __photo(3000, 4000);
      // THE OLD PATH: Cropper straight on the 12 MP photo, same options, same
      // crop, same getCroppedCanvas call — what every crop used to be cut from.
      const ref = async (data, rot) => {
        // a SQUARE box, big enough that the picture turned 90° still fits: viewMode 0
        // clamps the crop box to the container, and a box that clamps in one
        // instance and not the other is a different crop, not a different path.
        const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:900px;visibility:hidden';
        const im = document.createElement('img'); box.appendChild(im); document.body.appendChild(box);
        await new Promise(r => { im.onload = r; im.src = src; });
        const cr = await new Promise(res => { const k = new Cropper(im, { viewMode: 0, autoCropArea: 1, background: false, checkOrientation: false, responsive: false, ready: () => res(k) }); });
        if (rot) cr.rotateTo(rot);
        if (data) cr.setData(data);
        const cv = cr.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400, imageSmoothingQuality: 'high' });
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
        cr.destroy(); box.remove();
        return blob;
      };
      // THE NEW PATH: the real screen. The crop box is set in the copy's own
      // pixels; the old path gets the same box in the photo's pixels (×5/3).
      const run = async (dataPreview, rot) => {
        localStorage.removeItem('rr_last_crop_box');   // each run starts from the whole photo, like the reference
        const o = await __openCrop(src);
        const cr = document.getElementById('_rrCropImg').cropper;
        if (rot) cr.rotateTo(rot);
        if (dataPreview) cr.setData(dataPreview);
        document.getElementById('_rrCropApply').click();
        const t0 = Date.now();
        while (!o.done && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 50));
        return o.result || null;
      };
      // Both outputs are read at ONE common size — an eighth of the smaller of
      // the two — so a picture is compared with a picture whatever size each
      // path wrote it at, and the two or three pixels of crop-box rounding
      // between two Cropper instances of different display sizes (a CSS pixel
      // is a few photo pixels in either instance) cannot
      // masquerade as a different picture along the sharp edges.
      const pair = async (neuBlob, oldBlob) => {
        if (!neuBlob || !oldBlob) return { neu: null, old: null };
        const a = await createImageBitmap(neuBlob), b = await createImageBitmap(oldBlob);
        const w = Math.round(Math.min(a.width, b.width) / 8), h = Math.round(Math.min(a.height, b.height) / 8);
        return { neu: await __pixels(neuBlob, 7, w, h), old: await __pixels(oldBlob, 7, w, h) };
      };
      const out = {};
      out.whole = await pair(await run(null, 0), await ref(null, 0));
      const k = 3000 / 1800;
      out.tight = await pair(await run({ x: 300, y: 500, width: 900, height: 1200 }, 0), await ref({ x: 300 * k, y: 500 * k, width: 900 * k, height: 1200 * k }, 0));
      out.turned = await pair(await run({ x: 200, y: 150, width: 1400, height: 1000 }, 90), await ref({ x: 200 * k, y: 150 * k, width: 1400 * k, height: 1000 * k }, 90));
      out.level = await pair(await run(null, 3.5), await ref(null, 3.5));
      return out;
    });
    const same = (pair, label, wantSize) => {
      const ok = pair.neu && pair.old && pair.neu.w === wantSize[0] && pair.neu.h === wantSize[1];
      const diff = pair.neu && pair.old ? meanDiff(pair.neu.px, pair.old.px) : 999;
      T(label + ' — ' + (pair.neu && pair.neu.w + '×' + pair.neu.h) + ', the same picture as the old path (mean pixel difference ' + diff.toFixed(1) + ' of 255)', ok && diff < 10, { neu: pair.neu && [pair.neu.w, pair.neu.h], old: pair.old && [pair.old.w, pair.old.h], diff });
    };
    same(c.whole, 'C1  the whole photo', [1800, 2400]);
    same(c.tight, 'C2  a tight crop (a third of the frame)', [900, 1200]);
    same(c.turned, 'C3  turned 90° with a crop box', [1400, 1000]);
    same(c.level, 'C4  levelled 3.5°', [1800, 2400]);
    // Cropper 1.6.1 quirk, documented here so nobody "fixes" it back: when it
    // has to shrink the photo to the cap before cutting (ratio !== 1), it then
    // blows the crop UP to the source size — a tight crop of a 12 MP photo came
    // out 1800×2400 from 900×1200 real pixels. Fed the copy (ratio === 1) the
    // crop keeps its real size: the same picture, no invented pixels, a file
    // a quarter the size.
    T('C5  the old path inflated the tight crop to 1800×2400 (from 900×1200 real pixels); the copy keeps it honest at 900×1200', c.tight.old && c.tight.old.w === 1800 && c.tight.old.h === 2400 && c.tight.neu && c.tight.neu.w === 900, { old: c.tight.old && [c.tight.old.w, c.tight.old.h], neu: c.tight.neu && [c.tight.neu.w, c.tight.neu.h] });
    T('C6  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── D · a phone: the recorder's diary says what Cropper was handed ──────
  console.log('\n== D · on a phone the diary reports the copy, so the next phone check can be read from the desktop ==');
  {
    const { pg, errs } = await open(browser, 400);
    const d = await pg.evaluate(async () => {
      localStorage.removeItem('rr_crop_flash'); localStorage.removeItem('rr_crop_flash__at');
      const src = __photo(3000, 4000);
      const o = await __openCrop(src);
      const info = __cropperInfo();
      document.getElementById('_rrCropCancel').click();
      await new Promise(r => setTimeout(r, 100));
      let diary = null; try { diary = JSON.parse(localStorage.getItem('rr_crop_flash')); } catch (e) {}
      return { info, diary, stamped: localStorage.getItem('rr_crop_flash__at') };
    });
    T('D1  the phone-width screen builds on the copy too', d.info.cropperNatural === '1800x2400', d.info);
    T('D2  the diary\'s photo line names the copy Cropper got (1800x2400), not the 12 MP original', d.diary && /photo 1800x2400/.test(d.diary.frames), d.diary && d.diary.frames);
    T('D3  …and its lines show both loads: the photo, then the copy', d.diary && d.diary.lines.some(l => /photo decoded  3000x4000/.test(l)) && d.diary.lines.some(l => /photo decoded  1800x2400/.test(l)), d.diary && d.diary.lines);
    T('D4  …stamped for the account (v1826), so Brad\'s desktop can read it', d.stamped && d.stamped !== '0', d.stamped);
    T('D5  no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── E · an old browser, and the planted offender ────────────────────────
  console.log('\n== E · an old browser keeps the original (Cropper reads the EXIF itself); the offender ==');
  {
    const { pg, errs } = await open(browser, 1200);
    const e = await pg.evaluate(async () => {
      const src = __photo(3000, 4000);
      _rrOrientAuto = false;                       // "this browser does not honour EXIF on its own"
      const o1 = await __openCrop(src); const oldB = __cropperInfo(); document.getElementById('_rrCropCancel').click();
      await new Promise(r => setTimeout(r, 100));
      _rrOrientAuto = true;
      // OFFENDER: the copy step gone — what the screen did before v1827
      const real = window._rrCropPreview;
      window._rrCropPreview = function (img, max, cb) { cb(null); };
      const o2 = await __openCrop(src); const off = __cropperInfo(); document.getElementById('_rrCropCancel').click();
      window._rrCropPreview = real;
      await new Promise(r => setTimeout(r, 100));
      return { oldB, off };
    });
    T('E1  a browser that cannot orient a photo itself gets the original (Cropper\'s checkOrientation still needs the file)', e.oldB.cropperNatural === '3000x4000' && e.oldB.src === 'data:', e.oldB);
    T('OFFENDER 1: without the copy Cropper is handed all 12 MP → B2 red', e.off.cropperNatural === '3000x4000', e.off);
    T('E2  no page errors', errs.length === 0, errs);
    await pg.close();
  }
  await browser.close();

  // ── F · the source: one cap, two readers ────────────────────────────────
  console.log('\n== F · one number ==');
  const pc = fs.readFileSync(path.join(APP, 'photo-crop.js'), 'utf8');
  const codeLines = pc.split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\/\/.*$/, ''));
  const bare2400 = codeLines.filter(l => /\b2400\b/.test(l) && !/var _RR_CROP_MAX = 2400;/.test(l));
  T('F1  the crop cap is written ONCE (_RR_CROP_MAX); getCroppedCanvas and the copy both read it', bare2400.length === 0 && /getCroppedCanvas\(\{ maxWidth: _RR_CROP_MAX, maxHeight: _RR_CROP_MAX/.test(pc) && /_rrCropPreview\(img, _RR_CROP_MAX,/.test(pc), bare2400);
  T('F2  the copy is released when the screen closes', /if \(_previewUrl\) \{ URL\.revokeObjectURL\(_previewUrl\); _previewUrl = null; \}/.test(pc));
  T('OFFENDER 2: a second "2400" typed into the code → F1 red', codeLines.concat(["  var canvas = cropper.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400 });"]).filter(l => /\b2400\b/.test(l) && !/var _RR_CROP_MAX = 2400;/.test(l)).length === 1);

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
