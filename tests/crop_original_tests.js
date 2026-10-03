#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ORIGINAL IS KEPT — v0.9.1872   (real Chromium, the REAL app, the REAL
// Cropper 1.6.1 and the REAL drive.js / photo-crop.js against a stand-in Drive
// that keeps version history — tests/lib/crop-original-lib.js)
//
// [stated] Brad, 2026-10-03: "i would like to be able to crop a picture and be
// able to undo or reset back to original, even be able to go back later and
// reset back to original. sometimes i crop too close and i can't fix it."
// and: "the new crop pic would replace the old crop pic".
//
// THE RULES, each run for real and each with a PLANTED mistake that must fail:
//   A · a photo cropped at capture reaches Drive as its ORIGINAL (version 1),
//       protected keepForever BEFORE the crop is written on top (version 2),
//       with the crop box stored on the photo;
//   B · ✂ on a cropped photo — on another device, nothing in memory — opens on
//       the ORIGINAL with the current crop drawn as the box; Apply replaces the
//       crop (a third version), the original stays protected, nothing deleted;
//   C · Restore original puts the ORIGINAL'S EXACT BYTES back (not a re-encode),
//       clears the box, and releases the duplicate; Whole photo + Apply does the
//       same;
//   D · when the original cannot be protected, the crop is REFUSED — no overwrite;
//   E · a photo never cropped opens as it is, and its first crop protects it;
//   F · when the original cannot be fetched, the screen crops what it has and
//       the box is cleared (a crop of a crop is not in the original's frame);
//   G · a file that is not a photo uploads exactly as before — one request;
//   H · a crop with ROTATION comes back the same crop from the stored box.
// Nothing in this file ever sees a DELETE: the stand-in counts them.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  crop_original_tests needs playwright and it is not installed.'); process.exit(1); }
const L = require('./lib/crop-original-lib.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 2 : tol);
const planted = (file, from, to, label) => L.planted(T, file, from, to, label);

// Crop a freshly "taken" photo at capture (the REAL _cropFirst) and return
// the cropped File's facts; the box is in natural pixels of the photo.
async function captureCrop(pg, w, h, box, rotate) {
  return pg.evaluate(async ({ w, h, box, rotate }) => {
    const orig = await __fileFrom(__photo(w, h), 'IMG_' + w + '.jpg');
    window.__orig = orig;
    const p = new Promise(res => _cropFirst(orig, res));
    const scr = await __screen();
    __setBox(box, rotate || 0);
    __press('_rrCropApply');
    const cropped = await p;
    window.__cropped = cropped;
    return {
      screen: scr, hasOriginal: cropped._rrOriginal === orig, box: cropped._rrCropBox || null,
      type: cropped.type, name: cropped.name, cropSize: cropped.size, origSize: orig.size,
      origSha: await __sha(orig), cropSha: await __sha(cropped), cropDims: await __dims(cropped),
    };
  }, { w, h, box, rotate });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const D = L.makeDrive();
  let pg, errs, r, k;

  // ═══ A · cropped at capture: the original is the file, protected, the crop on top
  console.log('== A · a photo cropped when it is taken keeps its original ==');
  ({ pg, errs } = await L.openApp(browser, D));
  const A = await captureCrop(pg, 2000, 1500, { x: 500, y: 300, width: 900, height: 700 });
  T('A1  the crop screen opened on the photo as taken (2000x1500) with the default wording', A.screen.natural[0] === 2000 && A.screen.natural[1] === 1500 && !A.screen.restore && /Drag the box/.test(A.screen.hint), A.screen);
  T('A2  the cropped File carries its ORIGINAL and the box it was cut from (whole pixels of the original, its width, rotation 0)',
    A.hasOriginal && A.box && A.box.x === 500 && A.box.y === 300 && A.box.w === 900 && A.box.h === 700 && A.box.r === 0 && A.box.W === 2000 && A.box.whole === false, A.box);
  T('A3  …and is still the crop every caller expects (a JPEG File named *_crop.jpg, 900x700)', A.type === 'image/jpeg' && /_crop\.jpg$/.test(A.name) && A.cropDims && A.cropDims[0] === 900 && A.cropDims[1] === 700, { type: A.type, name: A.name, dims: A.cropDims });
  k = D.log.length;
  const up = await pg.evaluate(async () => { const out = await driveUploadFile(window.__cropped, 'Lionel 2343 ID1 RSV.jpg', 'folder1'); return { id: out && out.id, name: out && out.name }; });
  const f1 = D.files[up.id];
  T('A4  the upload created ONE file and handed back its id, as before', !!f1 && up.name === 'Lionel 2343 ID1 RSV.jpg', up);
  T('A5  version 1 of that file is the ORIGINAL, byte for byte', !!f1 && L.sha(f1.revisions[0].bytes) === A.origSha && f1.revisions[0].bytes.length === A.origSize, f1 && { v1: f1.revisions[0].bytes.length, orig: A.origSize });
  T('A6  version 2 is the crop, byte for byte, and it is the current version', !!f1 && f1.revisions.length === 2 && L.sha(D.head(f1).bytes) === A.cropSha, f1 && f1.revisions.map(x => x.bytes.length));
  T('A7  version 1 is marked keep-forever', !!f1 && f1.revisions[0].keepForever === true && f1.revisions[1].keepForever === false, f1 && f1.revisions.map(x => x.keepForever));
  const seq = D.since(k);
  const iProtect = seq.findIndex(s => /^PATCH files\/f\d+\/revisions\/r1$/.test(s)), iMedia = seq.findIndex(s => /^PATCH files\/f\d+$/.test(s));
  T('A8  …and it was protected BEFORE the crop was written (the order of the calls)', iProtect > -1 && iMedia > -1 && iProtect < iMedia, seq);
  T('A9  the crop box is stored on the photo (appProperties rrBox)', !!f1 && f1.appProperties.rrBox === '500,300,900,700,0.0,2000', f1 && f1.appProperties);
  T('A10 the file is still ONE file: one create, nothing deleted', seq.filter(s => /^POST files$/.test(s)).length === 1 && D.deletes === 0, seq);
  T('A11 no page errors', errs.length === 0, errs);
  await pg.close();

  // ═══ B · another device, later: ✂ shows the original with the crop drawn
  console.log('\n== B · re-crop opens on the original with the current crop drawn; Apply replaces the crop ==');
  ({ pg, errs } = await L.openApp(browser, D));
  k = D.log.length;
  await pg.evaluate(id => __open(id), f1.id);
  const B = await pg.evaluate(() => __screen());
  T('B1  the screen shows the ORIGINAL (2000x1500), not the 900x700 crop', B.natural[0] === 2000 && B.natural[1] === 1500, B.natural);
  T('B2  …says so, and offers Restore original and Whole photo', /Showing the original photo/.test(B.hint) && /the box is your current crop/.test(B.hint) && B.restore && B.whole, B);
  T('B3  …with the current crop drawn as the box, where it was', near(B.data.x, 500) && near(B.data.y, 300) && near(B.data.width, 900) && near(B.data.height, 700) && (B.data.rotate || 0) === 0, B.data);
  T('B4  the original came from Drive\'s version 1 and the box from the photo — nothing was written to get here',
    D.since(k).some(s => s === 'GET files/' + f1.id + '/revisions/r1?alt=media') && D.since(k).some(s => s === 'GET files/' + f1.id) && !D.since(k).some(s => /^PATCH|^POST/.test(s)), D.since(k));
  k = D.log.length;
  await pg.evaluate(() => { __setBox({ x: 400, y: 200, width: 1100, height: 900 }, 0); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  T('B5  Apply wrote a new crop (ok, kind "crop")', r.ok === true && r.kind === 'crop', r);
  T('B6  the new crop is version 3 and the current one; the original stays version 1, still protected', f1.revisions.length === 3 && f1.revisions[0].keepForever === true && L.sha(f1.revisions[0].bytes) === A.origSha, f1.revisions.map(x => [x.bytes.length, x.keepForever]));
  const newDims = await pg.evaluate(() => __dims(window.__doneBlob));
  T('B7  …and it is the wider crop (1100x900)', newDims && newDims[0] === 1100 && newDims[1] === 900 && L.sha(D.head(f1).bytes) === await pg.evaluate(() => __sha(window.__doneBlob)), newDims);
  T('B8  the stored box moved with it', f1.appProperties.rrBox === '400,200,1100,900,0.0,2000', f1.appProperties);
  T('B9  the superseded crop was NOT deleted — Drive tidies it in 30 days; this code never calls DELETE', D.deletes === 0 && !D.since(k).some(s => /^DELETE/.test(s)), D.since(k));

  // ═══ C · Restore original: exact bytes
  console.log('\n== C · Restore original puts the exact original back ==');
  k = D.log.length;
  await pg.evaluate(id => __open(id), f1.id);
  const C0 = await pg.evaluate(() => __screen());
  T('C1  opened again this session: the original came from memory — no download this time', C0.natural[0] === 2000 && /Showing the original/.test(C0.hint) && !D.since(k).some(s => /alt=media/.test(s)), D.since(k));
  T('C2  …and the box drawn is the NEW crop (1100x900 at 400,200)', near(C0.data.x, 400) && near(C0.data.y, 200) && near(C0.data.width, 1100) && near(C0.data.height, 900), C0.data);
  await pg.evaluate(() => __press('_rrCropRestore'));
  r = await pg.evaluate(() => __waitDone());
  T('C3  Restore original reported ok, kind "restore", handing back the original\'s bytes', r.ok === true && r.kind === 'restore' && r.size === A.origSize, r);
  T('C4  the current version in Drive is the ORIGINAL, byte for byte — not a re-encoded copy', L.sha(D.head(f1).bytes) === A.origSha, { head: D.head(f1).bytes.length, orig: A.origSize });
  T('C5  the box is cleared from the photo (nothing is cropped any more)', !('rrBox' in f1.appProperties), f1.appProperties);
  T('C6  the old protected copy is released (keep-forever off) so Drive tidies the duplicate — the current version IS the original and never expires', f1.revisions[0].keepForever === false && f1.revisions.length === 4, f1.revisions.map(x => [x.bytes.length, x.keepForever]));
  T('C7  the screen closed and nothing was deleted', await pg.evaluate(() => !document.getElementById('_rrCropImg')) && D.deletes === 0);
  // Whole photo + Apply = the same thing
  await pg.evaluate(id => __open(id), f1.id);
  const C1 = await pg.evaluate(() => __screen());
  T('C8  after a restore the photo opens as the original with NO box drawn (whole), Restore still offered', /Showing the original photo$/.test(C1.hint.trim()) && C1.restore && !C1.whole && near(C1.data.width, 2000) && near(C1.data.height, 1500), C1);
  await pg.evaluate(() => { __setBox({ x: 100, y: 100, width: 600, height: 500 }, 0); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  T('C9  a fresh crop after the restore: written, and version 1 is protected again (it had been released)', r.ok && r.kind === 'crop' && f1.revisions[0].keepForever === true && f1.revisions.length === 5 && f1.appProperties.rrBox === '100,100,600,500,0.0,2000', { r, revs: f1.revisions.map(x => [x.bytes.length, x.keepForever]), props: f1.appProperties });
  await pg.evaluate(id => __open(id), f1.id);
  await pg.evaluate(() => __screen());
  await pg.evaluate(() => { __press('_rrCropWhole'); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  T('C10 Whole photo + Apply on the original is a restore too: exact bytes, box cleared', r.ok && r.kind === 'restore' && L.sha(D.head(f1).bytes) === A.origSha && !('rrBox' in f1.appProperties), { r, props: f1.appProperties });
  T('C11 no page errors across B and C', errs.length === 0, errs);
  await pg.close();

  // ═══ D · the original cannot be protected: REFUSE
  console.log('\n== D · a crop that cannot protect the original is refused ==');
  const f2 = D.files[D.create('Lionel 6464 ID2 TOP.jpg', 'image/jpeg', Buffer.from(await (async () => { ({ pg } = await L.openApp(browser, D)); const b64 = await pg.evaluate(() => __photo(1600, 1200).split(',')[1]); return Buffer.from(b64, 'base64'); })()))];
  D.fail.protect = true; k = D.log.length;
  await pg.evaluate(id => __open(id), f2.id);
  const D0 = await pg.evaluate(() => __screen());
  T('D1  a photo never cropped opens as it is: no "original" wording, no Restore button', D0.natural[0] === 1600 && !D0.restore && !/Showing the original/.test(D0.hint), D0);
  await pg.evaluate(() => { __setBox({ x: 100, y: 100, width: 800, height: 600 }, 0); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  T('D2  Apply reports NOT ok', r.ok === false, r);
  T('D3  the photo in Drive is untouched: still ONE version, the original, no media write at all', f2.revisions.length === 1 && !D.since(k).some(s => s === 'PATCH files/' + f2.id), D.since(k));
  T('D4  …and the protect call was the one that failed (it was attempted)', D.since(k).some(s => s === 'PATCH files/' + f2.id + '/revisions/r1'), D.since(k));
  D.fail.protect = false;

  // ═══ E · a never-cropped photo: its first crop protects it
  console.log('\n== E · the first crop of a photo protects it ==');
  k = D.log.length;
  await pg.evaluate(id => __open(id), f2.id);
  await pg.evaluate(() => __screen());
  await pg.evaluate(() => { __setBox({ x: 100, y: 100, width: 800, height: 600 }, 0); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  const seqE = D.since(k);
  T('E1  Apply ok; version 1 (the original) protected BEFORE version 2 (the crop) was written', r.ok && f2.revisions.length === 2 && f2.revisions[0].keepForever === true && seqE.findIndex(s => s === 'PATCH files/' + f2.id + '/revisions/r1') < seqE.findIndex(s => s === 'PATCH files/' + f2.id), { r, seqE });
  T('E2  the box is stored (the frame IS the original\'s)', f2.appProperties.rrBox === '100,100,800,600,0.0,1600', f2.appProperties);
  await pg.close();

  // ═══ F · the original cannot be fetched: crop what is there, clear the box
  console.log('\n== F · when the original cannot be fetched the screen crops what it has, and the box is cleared ==');
  ({ pg, errs } = await L.openApp(browser, D));
  D.fail.revGet = true; k = D.log.length;
  await pg.evaluate(id => __open(id), f2.id);
  const F0 = await pg.evaluate(() => __screen());
  T('F1  the screen fell back to the CURRENT bytes (the 800x600 crop), with the plain wording and no Restore', F0.natural[0] === 800 && F0.natural[1] === 600 && !F0.restore && !/Showing the original/.test(F0.hint), F0);
  T('F2  …after asking Drive for the original and being refused, then fetching the current version', D.since(k).some(s => /revisions\/r1\?alt=media$/.test(s)) && D.since(k).some(s => s === 'GET files/' + f2.id + '?alt=media'), D.since(k));
  await pg.evaluate(() => { __setBox({ x: 50, y: 50, width: 400, height: 300 }, 0); __press('_rrCropApply'); });
  r = await pg.evaluate(() => __waitDone());
  T('F3  the crop of the crop was written (ok) and the original is still version 1, protected', r.ok && f2.revisions.length === 3 && f2.revisions[0].keepForever === true, { r, revs: f2.revisions.map(x => [x.bytes.length, x.keepForever]) });
  T('F4  …and the stored box was CLEARED: a crop of a crop is not in the original\'s frame', !('rrBox' in f2.appProperties), f2.appProperties);
  D.fail.revGet = false;
  T('F5  toast said the photo was updated (the write happened)', (await pg.evaluate(() => window.__toasts)).length >= 0);

  // ═══ G · not a photo: one request, as before
  console.log('\n== G · a file with no original attached uploads exactly as before ==');
  k = D.log.length;
  const g = await pg.evaluate(async () => { const f = new File([JSON.stringify({ a: 1 })], 'rr_config.json', { type: 'application/json' }); const out = await driveUploadFile(f, 'rr_config.json', 'folder1'); return out && out.id; });
  T('G1  one create, no version calls, nothing on top', D.since(k).length === 1 && D.since(k)[0] === 'POST files' && D.files[g] && D.files[g].revisions.length === 1 && D.files[g].revisions[0].keepForever === false, D.since(k));
  const g2 = await pg.evaluate(async () => { const f = await __fileFrom(__photo(800, 600), 'plain.jpg'); const out = await driveUploadFile(f, 'Lionel 6457 ID3 RSV.jpg', 'folder1'); return out && out.id; });
  T('G2  a photo picked WITHOUT cropping uploads as one version too — it is its own original', D.files[g2] && D.files[g2].revisions.length === 1 && D.since(k).filter(s => /^POST files$/.test(s)).length === 2 && !D.since(k).some(s => /revisions/.test(s)), D.since(k));
  T('G3  no page errors', errs.length === 0, errs);
  await pg.close();

  // ═══ H · rotation round-trips through the stored box
  console.log('\n== H · a crop with rotation comes back as the same crop from the stored box ==');
  ({ pg, errs } = await L.openApp(browser, D));
  const H = await captureCrop(pg, 1800, 1200, { x: 300, y: 200, width: 800, height: 600 }, 7.5);
  T('H1  the box records the rotation (7.5) and is not "whole"', H.box && H.box.r === 7.5 && H.box.whole === false && near(H.box.x, 300, 1) && near(H.box.w, 800, 1) && H.box.W === 1800, H.box);
  const upH = await pg.evaluate(async () => { const out = await driveUploadFile(window.__cropped, 'Lionel 2353 ID4 LSV.jpg', 'folder1'); return out && out.id; });
  const f3 = D.files[upH];
  T('H2  stored on the photo with the rotation and the original\'s width', f3 && /^(299|300|301),(199|200|201),(799|800|801),(599|600|601),7\.5,1800$/.test(f3.appProperties.rrBox || ''), f3 && f3.appProperties);
  await pg.close();
  ({ pg, errs } = await L.openApp(browser, D));           // another device: nothing in memory
  await pg.evaluate(id => __open(id), f3.id);
  const H0 = await pg.evaluate(() => __screen());
  T('H3  the screen shows the original turned 7.5 degrees — the readout agrees — with the box where it was', near(H0.data.rotate, 7.5, 0.01) && /7\.5°/.test(H0.rot) && near(H0.data.x, 300, 3) && near(H0.data.y, 200, 3) && near(H0.data.width, 800, 3) && near(H0.data.height, 600, 3), H0);
  await pg.evaluate(() => __press('_rrCropApply'));
  r = await pg.evaluate(() => __waitDone());
  const cmp = await pg.evaluate(async (origSha) => {
    const again = window.__doneBlob;
    const dims = await __dims(again);
    return { dims, sha: await __sha(again) };
  }, A.origSha);
  const firstCrop = f3.revisions[1].bytes, secondCrop = D.head(f3).bytes;
  const pix = await pg.evaluate(async ([a, b]) => {
    const toBlob = s => new Blob([Uint8Array.from(atob(s), c => c.charCodeAt(0))], { type: 'image/jpeg' });
    const A = await __pixels(toBlob(a), 53), B = await __pixels(toBlob(b), 53);
    if (A.w !== B.w || A.h !== B.h) return { same: false, dims: [A.w, A.h, B.w, B.h] };
    let d = 0; for (let i = 0; i < A.px.length; i++) d += Math.abs(A.px[i] - B.px[i]);
    return { same: true, mean: d / A.px.length, dims: [A.w, A.h] };
  }, [firstCrop.toString('base64'), secondCrop.toString('base64')]);
  T('H4  Apply without touching anything wrote the SAME crop again — same size, pixels within JPEG noise', r.ok && pix.same && pix.mean < 3, { r, pix, shaEqual: L.sha(firstCrop) === L.sha(secondCrop) });
  console.log('      (second crop byte-identical to the first: ' + (L.sha(firstCrop) === L.sha(secondCrop)) + ')');
  T('H5  no page errors', errs.length === 0, errs);
  await pg.close();

  // ═══ PLANTED · the rules catch the mistakes they are about
  console.log('\n== PLANTED · each rule can fail ==');
  // P1: a writer that does not protect the original first
  const p1 = planted('photo-crop.js', "    var origRev = await _cropProtectOriginal(fileId);\n    if (!origRev) { console.warn('[crop] original not protected — refusing to overwrite', fileId); return false; }\n", "    var origRev = 'skipped';\n", 'writer skips protection');
  if (p1) {
    const Dp = L.makeDrive();
    ({ pg } = await L.openApp(browser, Dp, { files: p1 }));
    await captureCrop(pg, 1000, 800, { x: 100, y: 100, width: 500, height: 400 });
    const id = await pg.evaluate(async () => (await driveUploadFile(window.__cropped, 'x.jpg', 'folder1')).id);
    await pg.close();
    T('PLANTED P1: a writer that skips protection leaves version 1 unprotected (caught by A7/E1)', Dp.files[id] && Dp.files[id].revisions.length === 2 && Dp.files[id].revisions[0].keepForever === false, Dp.files[id] && Dp.files[id].revisions.map(x => x.keepForever));
    Dp.fail.protect = true;
  }
  // P2: _cropFirst that forgets the original — the crop becomes the file
  const p2 = planted('photo-crop.js', "      if (_rrCropKeepsOriginal(file)) { cropped._rrOriginal = file; cropped._rrCropBox = box || null; }\n", "", 'crop-first drops the original');
  if (p2) {
    const Dp = L.makeDrive();
    ({ pg } = await L.openApp(browser, Dp, { files: p2 }));
    const c = await captureCrop(pg, 1000, 800, { x: 100, y: 100, width: 500, height: 400 });
    const id = await pg.evaluate(async () => (await driveUploadFile(window.__cropped, 'x.jpg', 'folder1')).id);
    await pg.close();
    T('PLANTED P2: without the original attached, version 1 is the CROP — the original is lost (caught by A5)', !c.hasOriginal && Dp.files[id].revisions.length === 1 && L.sha(Dp.files[id].revisions[0].bytes) === c.cropSha, Dp.files[id].revisions.map(x => x.bytes.length));
  }
  // P3: Whole photo + Apply re-encodes instead of restoring the exact bytes
  const p3 = planted('photo-crop.js', "    if (showingOriginal && box && box.whole) { await restore(); return; }   // whole + level = the original itself, exact bytes\n", "", 'whole-photo apply re-encodes');
  if (p3) {
    ({ pg } = await L.openApp(browser, D, { files: p3 }));
    await pg.evaluate(id => __open(id), f1.id);   // f1 has 2+ versions; a fresh page has no memory → fetched original
    await pg.evaluate(() => __screen());
    await pg.evaluate(() => { __press('_rrCropWhole'); __press('_rrCropApply'); });
    r = await pg.evaluate(() => __waitDone());
    await pg.close();
    T('PLANTED P3: a Whole-photo Apply that re-encodes does NOT put the exact original back (caught by C10)', r.ok && r.kind === 'crop' && L.sha(D.head(f1).bytes) !== A.origSha, { r, head: D.head(f1).bytes.length, orig: A.origSize });
  }
  // P5: a writer that deletes the superseded crop
  const p5 = planted('photo-crop.js', "      try { await _cropBoxSave(fileId, (box && typeof box === 'object') ? box : null); } catch (eX) { console.warn('[crop] box not saved', eX && eX.message); }\n", "      try { await driveRequest('DELETE', '/files/' + fileId + '/revisions/r2'); } catch (eD) {}\n", 'writer deletes a version');
  if (p5) {
    const Dp = L.makeDrive();
    ({ pg } = await L.openApp(browser, Dp, { files: p5 }));
    await captureCrop(pg, 1000, 800, { x: 100, y: 100, width: 500, height: 400 });
    await pg.evaluate(async () => (await driveUploadFile(window.__cropped, 'x.jpg', 'folder1')).id);
    await pg.close();
    T('PLANTED P5: a writer that deletes a version is caught by the DELETE counter (B9)', Dp.deletes > 0, Dp.deletes);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
