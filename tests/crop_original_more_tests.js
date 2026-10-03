#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ORIGINAL IS KEPT, part two — v0.9.1872
//   S · the SOURCE rules: one writer, protection first, every Drive-photo ✂
//       goes through the Drive-aware screen, capture carries the original,
//       the offline store carries it too — each with a planted offender;
//   W · the three entry points, run for real against the stand-in Drive:
//       the wizard thumbnail's ✂, the item page's edit, the Photo Inbox's crop.
// Part one (the rules themselves, A–H) is tests/crop_original_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  crop_original_more_tests needs playwright and it is not installed.'); process.exit(1); }
const L = require('./lib/crop-original-lib.js');
const APP = L.APP;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 2 : tol);
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PC = read('photo-crop.js'), DRV = read('drive.js'), PI = read('photo-inbox.js'), AC = read('app-collection.js');
const code = s => s.replace(/^\s*\/\/[^\n]*$/gm, '');   // comment LINES carry history, not behaviour (a URL's // must survive)

// A function's body, by brace matching from its header.
function fnBody(src, header) {
  const i = src.indexOf(header); if (i < 0) return '';
  const o = src.indexOf('{', i); let d = 0;
  for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(o, k + 1); } }
  return '';
}

// ── S · the rules, in the source ──────────────────────────────────────────
const RULES = {
  // a media PATCH that sends a picture lives in photo-crop.js and nowhere else
  onePhotoWriter: files => {
    const hits = [];
    Object.keys(files).forEach(name => {
      const s = code(files[name]); let i = -1;
      while ((i = s.indexOf('uploadType=media', i + 1)) > -1) {
        const around = s.slice(Math.max(0, i - 400), i + 400);
        if (/image\/jpe?g/.test(around)) hits.push(name);
      }
    });
    return hits.length === 1 && hits[0] === 'photo-crop.js' ? true : hits;
  },
  // the writer protects the original BEFORE the PATCH, and refuses without it
  protectFirst: pc => {
    const b = fnBody(pc, 'async function _cropReplaceDriveFile(fileId, blob, box)');
    const p = b.indexOf('_cropProtectOriginal(fileId)'), w = b.indexOf('uploadType=media');
    return p > -1 && w > -1 && p < w && /if \(!origRev\) \{[^\n]*return false; \}/.test(b);
  },
  // never a DELETE
  noDelete: pc => !/'DELETE'/.test(code(pc)),
  // crop-first hands the original along
  captureCarries: pc => /cropped\._rrOriginal = file; cropped\._rrCropBox = box \|\| null;/.test(code(pc)),
  // both creators upload the original and put the crop on top through the writer
  creatorsKeep: drv => {
    const c = code(drv);
    return /async function driveUploadFile\(file, name, folderId, extraMeta\) \{\s*\n\s*if \(file && file\._rrOriginal\) return _rrUploadKeepingOriginal\(file,/.test(c)
      && /async function driveUploadPhoto\(file, fileName, folderId\) \{\s*\n\s*if \(file && file\._rrOriginal\) return _rrUploadKeepingOriginal\(file,/.test(c)
      && /window\._cropApplyCaptured\(made\.id, file\)/.test(c);
  },
  // the offline store keeps the original and puts it back on the way out
  offlineCarries: pi => {
    const c = code(pi);
    return /orig: \(file && file\._rrOriginal\) \|\| null, box: \(file && file\._rrCropBox\) \|\| null/.test(c)
      && /driveUploadFile\(_stageReattach\(r, r\.blob\), r\.name, fid\)/.test(c)
      && /_stageReattach\(r, f\);[^\n]*\n\s*var link = await driveUploadItemPhoto\(f,/.test(c);
  },
  // every ✂ on a photo that lives in Drive opens the Drive-aware screen
  entryPoints: (pc, pi, ac) => {
    const inbox = fnBody(pi, 'window._pinCropPhoto = async function (fid)'), qc = fnBody(pi, 'window._qcRecrop = function (idx)');
    const detail = fnBody(ac, 'async function _detailPhotoEdit(fileId, fileName, folderLink, imgId)'), wiz = fnBody(pc, 'function _photoCropStart(file, stepId, viewKey, itemNum, srcUrl)');
    const ok = s => s && /_cropOpenDriveFile\(/.test(s) && !/_openCropper\(/.test(code(s));
    return ok(inbox) && ok(qc) && ok(detail) && ok(wiz) ? true : { inbox: ok(inbox), qc: ok(qc), detail: ok(detail), wiz: ok(wiz) };
  },
  // the crop screen hands the box back, and shows Restore only when it has one
  screen: pc => /onResult\(blob, _box\)/.test(pc) && /typeof opts\.restore === 'function'\s*\n?\s*\? '<button id="_rrCropRestore"/.test(pc) && /id="_rrCropWhole" style="display:' \+ \(opts\.box \? '' : 'none'\)/.test(pc),
  // whole pixels of the original and its width — not fractions
  boxIsPixels: pc => /function _rrBoxStr\(box\)[\s\S]{0,400}String\(Math\.round\(Number\(v\) \|\| 0\)\)/.test(pc) && /p\.length !== 6/.test(pc) && /box\.W > 0\) \? \(W2 \/ box\.W\) : 1/.test(pc),
  // the audience is older collectors: nothing here says "AI"
  noAI: pc => !/\bAI\b/.test(code(pc)),
};
const FILES = {}; fs.readdirSync(APP).filter(f => /\.js$/.test(f)).forEach(f => { FILES[f] = read(f); });

console.log('== S · the rules, in the source ==');
T('S1  exactly one function in the app sends picture bytes over an existing Drive file (photo-crop.js)', RULES.onePhotoWriter(FILES) === true, RULES.onePhotoWriter(FILES));
T('S2  …and it protects the original FIRST, refusing when it cannot', RULES.protectFirst(PC));
T('S3  nothing in photo-crop.js ever DELETEs', RULES.noDelete(PC));
T('S4  a photo cropped at capture carries its original and box', RULES.captureCarries(PC));
T('S5  both Drive creators upload the ORIGINAL and put the crop on top through the writer', RULES.creatorsKeep(DRV));
T('S6  the offline photo store carries the original and re-attaches it for both drains', RULES.offlineCarries(PI));
T('S7  the wizard ✂, the item page, the inbox and Quick Capture all open the Drive-aware screen', RULES.entryPoints(PC, PI, AC) === true, RULES.entryPoints(PC, PI, AC));
T('S8  the crop screen hands the box back; Restore and Whole photo are decided before the picture is measured', RULES.screen(PC));
T('S9  the stored box is whole pixels of the original plus its width', RULES.boxIsPixels(PC));
T('S10 no "AI" in the crop screen\'s words', RULES.noAI(PC));
T('S11 the hint tells the truth: "Showing the original photo · the box is your current crop"', /Showing the original photo/.test(PC) && /the box is your current crop/.test(PC) && /Restore original/.test(PC));

console.log('\n== S · planted offenders ==');
const OLD_INBOX_PATCH = "var resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fid + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'image/jpeg' }, body: blob });";
T('OFFENDER 1: the inbox\'s old private copy of the Drive write would be flagged', RULES.onePhotoWriter(Object.assign({}, FILES, { 'photo-inbox.js': PI + '\n' + OLD_INBOX_PATCH })) !== true);
const swapped = PC.replace("    var origRev = await _cropProtectOriginal(fileId);\n    if (!origRev) { console.warn('[crop] original not protected — refusing to overwrite', fileId); return false; }\n", "")
  .replace("    return r.ok;\n  } catch (e) { console.warn('[crop] replace by id', e); return false; }", "    var origRev = await _cropProtectOriginal(fileId);\n    return r.ok;\n  } catch (e) { console.warn('[crop] replace by id', e); return false; }");
T('OFFENDER 2: a writer that protects AFTER the write fails S2', swapped !== PC && RULES.protectFirst(swapped) === false);
T('OFFENDER 3: a DELETE in the writer fails S3', RULES.noDelete(PC.replace("if (r.ok) {", "if (r.ok) { await driveRequest('DELETE', '/files/' + fileId + '/revisions/r2');")) === false);
T('OFFENDER 4: crop-first without the original fails S4', RULES.captureCarries(PC.replace("cropped._rrOriginal = file; cropped._rrCropBox = box || null;", "")) === false);
T('OFFENDER 5: a creator that uploads the crop as the file fails S5', RULES.creatorsKeep(DRV.replace("if (file && file._rrOriginal) return _rrUploadKeepingOriginal(file, function (orig) { return driveUploadPhoto(orig, fileName, folderId); });   // v0.9.1872\n", "")) === false);
T('OFFENDER 6: an offline store that drops the original fails S6', RULES.offlineCarries(PI.replace("driveUploadFile(_stageReattach(r, r.blob), r.name, fid)", "driveUploadFile(r.blob, r.name, fid)")) === false);
T('OFFENDER 7: an inbox crop that opens the plain screen fails S7', RULES.entryPoints(PC, PI.replace("await window._cropOpenDriveFile(fid, {", "await window._openCropper(fid, {"), AC) !== true);
T('OFFENDER 8: a box kept as fractions fails S9', RULES.boxIsPixels(PC.replace("p.length !== 6", "p.length !== 5")) === false);

// ── W · the entry points, for real ────────────────────────────────────────
(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const D = L.makeDrive();
  let pg, errs, r, k;

  // W1 · the wizard thumbnail's ✂: the File in hand is the original → no download
  console.log('\n== W1 · the wizard thumbnail ✂ ==');
  ({ pg, errs } = await L.openApp(browser, D));
  // a photo the wizard uploaded as picked (no crop at capture), and its thumbnail zone
  const w1 = await pg.evaluate(async () => {
    const f = await __fileFrom(__photo(1600, 1200), 'IMG_7.jpg');
    window.__wizFile = f;
    const out = await driveUploadFile(f, 'Lionel 2343 ID9 RSV.jpg', 'folder1');
    window.wizard = window.wizard || {}; wizard.data = wizard.data || {};
    wizard.data._photoFileIds = { 'photosItem|RSV': out.id };
    wizard.data._photoUploadsInFlight = 0;
    const z = document.createElement('div'); z.className = 'photo-drop-zone'; z.setAttribute('data-view', 'RSV'); z.setAttribute('data-sid', 'photosItem');
    const im = document.createElement('img'); im.id = 'wiz-thumb'; im.src = URL.createObjectURL(f); z.appendChild(im); document.body.appendChild(z);
    return { id: out.id, sha: await __sha(f), size: f.size };
  });
  k = D.log.length;
  await pg.evaluate(() => { _photoCropStart(window.__wizFile, 'photosItem', 'RSV', '2343', document.getElementById('wiz-thumb').src); });
  const W1 = await pg.evaluate(() => __screen());
  T('W1a the screen opened on the photo in hand (1600x1200), nothing downloaded', W1.natural[0] === 1600 && !W1.restore && !D.since(k).some(s => /alt=media/.test(s)), { W1, log: D.since(k) });
  const srcBefore = await pg.evaluate(() => document.getElementById('wiz-thumb').src);
  await pg.evaluate(() => { __setBox({ x: 200, y: 100, width: 1000, height: 800 }, 0); __press('_rrCropApply'); });
  await pg.waitForFunction(() => window.__toasts.some(t => /Photo updated/.test(t)), null, { timeout: 8000 });
  const fw = D.files[w1.id];
  T('W1b Apply wrote the crop on the file the ids map named: version 1 protected, version 2 the crop, box stored', fw.revisions.length === 2 && fw.revisions[0].keepForever === true && L.sha(fw.revisions[0].bytes) === w1.sha && fw.appProperties.rrBox === '200,100,1000,800,0.0,1600', { revs: fw.revisions.map(x => [x.bytes.length, x.keepForever]), props: fw.appProperties });
  const srcAfter = await pg.evaluate(() => document.getElementById('wiz-thumb').src);
  T('W1c the thumbnail now shows the crop', srcAfter !== srcBefore, { srcBefore, srcAfter });
  k = D.log.length;
  await pg.evaluate(() => { _photoCropStart(window.__wizFile, 'photosItem', 'RSV', '2343', document.getElementById('wiz-thumb').src); });
  const W1b = await pg.evaluate(() => __screen());
  T('W1d ✂ again: the original with the crop drawn, from memory — still no download', W1b.natural[0] === 1600 && W1b.restore && /Showing the original/.test(W1b.hint) && near(W1b.data.x, 200) && near(W1b.data.width, 1000) && !D.since(k).some(s => /alt=media/.test(s)), { W1b, log: D.since(k) });
  await pg.evaluate(() => __press('_rrCropCancel'));
  T('W1e no page errors', errs.length === 0, errs);
  await pg.close();

  // W2 · the item page's edit, on a photo cropped elsewhere
  console.log('\n== W2 · the item page edit ==');
  ({ pg, errs } = await L.openApp(browser, D));
  await pg.evaluate(id => { const im = document.createElement('img'); im.id = 'idp-' + id; im.src = 'data:,'; document.body.appendChild(im); return _detailPhotoEdit(id, 'Lionel 2343 ID9 RSV.jpg', 'https://drive.google.com/drive/folders/folder1', 'idp-' + id); }, w1.id);
  const W2 = await pg.evaluate(() => __screen());
  T('W2a opens on the ORIGINAL fetched from Drive with the crop drawn, Restore offered', W2.natural[0] === 1600 && W2.restore && near(W2.data.x, 200) && near(W2.data.width, 1000) && /Showing the original/.test(W2.hint), W2);
  await pg.evaluate(() => __press('_rrCropRestore'));
  await pg.waitForFunction(() => window.__toasts.some(t => /Photo updated/.test(t)), null, { timeout: 8000 });
  T('W2b Restore original: the current version is the exact original, the box is gone, the page image was refreshed', L.sha(D.head(fw).bytes) === w1.sha && !('rrBox' in fw.appProperties) && (await pg.evaluate(id => document.getElementById('idp-' + id).src, w1.id)).startsWith('blob:'), { head: D.head(fw).bytes.length, props: fw.appProperties });
  T('W2c no page errors', errs.length === 0, errs);
  await pg.close();

  // W3 · the Photo Inbox crop, on a photo never cropped
  console.log('\n== W3 · the Photo Inbox crop ==');
  ({ pg, errs } = await L.openApp(browser, D));
  const fidI = D.create('INBOX 1 g1 IMG_3.jpg', 'image/jpeg', Buffer.from((await pg.evaluate(() => __photo(1200, 900).split(',')[1])), 'base64'));
  k = D.log.length;
  await pg.evaluate(id => window._pinCropPhoto(id), fidI);
  const W3 = await pg.evaluate(() => __screen());
  T('W3a the inbox crop opened the Drive-aware screen on the photo as it is (never cropped: no Restore)', W3.natural[0] === 1200 && !W3.restore && !/Showing the original/.test(W3.hint), W3);
  T('W3b …fetching the current bytes through the inbox\'s own downloader only after asking for versions', D.since(k)[0] === 'GET files/' + fidI + '/revisions' && D.since(k).some(s => s === 'GET files/' + fidI + '?alt=media'), D.since(k));
  await pg.evaluate(() => { __setBox({ x: 100, y: 100, width: 600, height: 400 }, 0); __press('_rrCropApply'); });
  await pg.waitForFunction(() => window.__toasts.some(t => /Cropped/.test(t)), null, { timeout: 8000 });
  const fi = D.files[fidI];
  T('W3c the crop landed through the ONE writer: protected first, then written, box stored, "Cropped ✓"', fi.revisions.length === 2 && fi.revisions[0].keepForever === true && fi.appProperties.rrBox === '100,100,600,400,0.0,1200' && (await pg.evaluate(() => window.__toasts)).some(t => /Cropped ✓/.test(t)), { revs: fi.revisions.map(x => [x.bytes.length, x.keepForever]), props: fi.appProperties, toasts: await pg.evaluate(() => window.__toasts) });
  T('W3d the inbox cleared the old read on the photo (rrNum null) as it always did', 'rrRt' in fi.appProperties && !('rrNum' in fi.appProperties), fi.appProperties);
  T('W3e nothing deleted anywhere in this file', D.deletes === 0);
  T('W3f no page errors', errs.length === 0, errs);
  await pg.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
