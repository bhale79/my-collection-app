#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// "UPDATING…" ON THE PHOTO WHILE A CROP SAVES — v0.9.2043
// Brad: "when you save you go back to the item detail page, it looks the same,
// and maybe 5 seconds later it pops up correct … the user sees it and will
// think it didn't do it. we need a rotate arrow with the word 'updating' in the
// top right of the picture."
//
// Run for real in Chromium against the stand-in Drive (tests/lib/crop-original-lib.js),
// with the Drive upload HELD so the in-between moment can be looked at:
//   U1  the item page's ✂ → Apply: the crop screen is gone, the badge is up, top-right
//       of the photo, spinning arrow + "Updating…"; Drive answers → badge gone, new picture
//   U2  the page redraws mid-save → the badge is drawn again on the redrawn photo
//   U3  a save Drive refuses → badge gone, the "Could not save" message as before
//   U4  Restore original → the same badge, the same ending
//   U5  another photo in the same gallery never shows it
//   U6  the word lives once (config.js) and the arrow stops for reduced motion
// and each rule is planted broken to prove the test catches it.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_updating_badge_2043_tests needs playwright and it is not installed.'); process.exit(1); }
const L = require('./lib/crop-original-lib.js');
const APP = L.APP;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const CFG = read('config.js'), AC = read('app-collection.js'), CSS = read('app.css');
const FOLDER = 'https://drive.google.com/drive/folders/folder1';

// The page: a real item-page gallery on two Drive photos, and a hold on Drive uploads.
async function setup(browser, D, files) {
  const { pg, errs } = await L.openApp(browser, D, files ? { files } : undefined);
  const hold = { on: false, waiting: [] };
  hold.release = () => { hold.on = false; const w = hold.waiting.splice(0); w.forEach(r => r.fallback()); };
  await pg.route(/\/upload\/drive\/v3\/files\/[^/?]+\?uploadType=media/, r => {
    if (hold.on && r.request().method() === 'PATCH') hold.waiting.push(r); else r.fallback();
  });
  const ids = await pg.evaluate(async () => {
    const a = await driveUploadFile(await __fileFrom(__photo(1600, 1200), 'a.jpg'), 'Lionel 2338 ID190 RSV.jpg', 'folder1');
    const b = await driveUploadFile(await __fileFrom(__photo(1200, 900), 'b.jpg'), 'Lionel 2338 ID190 LSV.jpg', 'folder1');
    return [a.id, b.id];
  });
  await pg.evaluate(([a, b, folder]) => {
    window.__photos = [{ id: a, name: 'Lionel 2338 ID190 RSV.jpg', thumbnailLink: '', view: '#' },
                       { id: b, name: 'Lionel 2338 ID190 LSV.jpg', thumbnailLink: '', view: '#' }];
    const el = document.createElement('div'); el.id = 'gal-host'; el.style.width = '900px';
    document.body.appendChild(el);
    window.__draw = () => _buildPhotoGallery(document.getElementById('gal-host'), window.__photos.slice(), { folderLink: folder, stack: true });
    window.__draw();
    // what the badge looks like right now, and where it sits on the photo
    window.__badge = () => {
      const host = document.getElementById('gal-host');
      const b = host.querySelector('.rr-photo-updating');
      const hero = host.querySelector('img[id$="-hero"]');
      if (!b || !hero) return { found: false };
      const cs = getComputedStyle(b), br = b.getBoundingClientRect(), ir = hero.getBoundingClientRect();
      // the PICTURE's drawn rectangle inside the img box (object-fit: contain)
      const k = Math.min(ir.width / (hero.naturalWidth || 1), ir.height / (hero.naturalHeight || 1));
      const dw = (hero.naturalWidth || 0) * k, dh = (hero.naturalHeight || 0) * k;
      const hr = { top: ir.top + (ir.height - dh) / 2, right: ir.right - (ir.width - dw) / 2 };
      const arrow = b.querySelector('.rr-upd-arrow');
      return {
        found: true, shown: cs.display !== 'none' && br.width > 0,
        text: b.textContent.replace(/\s+/g, ' ').trim(),
        topRight: br.top - hr.top >= 0 && br.top - hr.top < 24 && hr.right - br.right >= 0 && hr.right - br.right < 24,
        spins: !!arrow && getComputedStyle(arrow).animationName === 'rr-upd-spin',
        heroSrc: hero.src.slice(0, 5),
      };
    };
    window.__cropOpen = () => !!document.getElementById('_rrCropImg');
  }, [ids[0], ids[1], FOLDER]);
  return { pg, errs, hold, ids };
}
async function heldOne(S) { for (let i = 0; i < 100 && S.hold.waiting.length < 1; i++) await S.pg.waitForTimeout(50); return S.hold.waiting.length; }
const pressCrop = pg => pg.evaluate(() => document.querySelector('#gal-host [title="Rotate / crop this photo"]').click());
const waitFor = (pg, fn, arg, ms) => pg.waitForFunction(fn, arg, { timeout: ms || 8000 }).then(() => true, () => false);

async function cropAndApply(pg) {
  await pressCrop(pg);
  await pg.evaluate(() => __screen());
  await pg.evaluate(() => { __setBox({ x: 200, y: 100, width: 1000, height: 800 }, 0); __press('_rrCropApply'); });
  return waitFor(pg, () => !__cropOpen() && __badge().shown);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── U1 · crop → Apply ─────────────────────────────────────────────────────
  console.log('\n== U1 · the item page ✂ → Apply ==');
  let D = L.makeDrive(), S = await setup(browser, D);
  T('U1a before any crop: no badge on the photo', !(await S.pg.evaluate(() => __badge())).shown, await S.pg.evaluate(() => __badge()));
  S.hold.on = true;
  const up = await cropAndApply(S.pg);
  await heldOne(S);
  let B = await S.pg.evaluate(() => __badge());
  T('U1b Apply: the crop screen is closed and "Updating…" is up while Drive has not answered', up && B.shown && /^↻ ?Updating…$/.test(B.text) && S.hold.waiting.length === 1, { up, B, held: S.hold.waiting.length });
  T('U1c it sits in the top-right corner of the photo', B.topRight, B);
  // a tall photo in a wide frame: drawn centred with bands either side — the badge goes on the PICTURE
  await S.pg.setViewportSize({ width: 1400, height: 500 });
  await S.pg.evaluate(() => { document.getElementById('gal-host').style.width = '1300px'; __draw(); });
  await S.pg.waitForTimeout(300);
  B = await S.pg.evaluate(() => __badge());
  const band = await S.pg.evaluate(() => { const h = document.querySelector('#gal-host img[id$="-hero"]'); const r = h.getBoundingClientRect(); return r.width - h.naturalWidth * Math.min(r.width / h.naturalWidth, r.height / h.naturalHeight); });
  T('U1c2 a photo drawn narrower than its frame: the badge is on the picture\'s corner, not out in the band', band > 100 && B.shown && B.topRight, { band, B });
  T('U1d the arrow spins', B.spins, B);
  T('U1e no "Photo updated" yet — nothing claimed before Drive answers', !(await S.pg.evaluate(() => window.__toasts)).some(t => /Photo updated/.test(t)));
  S.hold.release();
  const gone = await waitFor(S.pg, () => !__badge().shown && window.__toasts.some(t => /Photo updated/.test(t)));
  T('U1f Drive answers: the badge goes and "Photo updated" shows', gone, { B: await S.pg.evaluate(() => __badge()), toasts: await S.pg.evaluate(() => window.__toasts) });
  T('U1g the crop really landed (version 2 in Drive, the original kept)', D.files[S.ids[0]].revisions.length === 2 && D.files[S.ids[0]].revisions[0].keepForever === true);
  T('U1h nothing left marked as saving', !(await S.pg.evaluate(id => rrPhotoIsSaving(id), S.ids[0])));
  T('U1i no page errors', S.errs.length === 0, S.errs);
  await S.pg.close();

  // ── U2 · a redraw mid-save ────────────────────────────────────────────────
  console.log('\n== U2 · the page redraws while the save runs ==');
  D = L.makeDrive(); S = await setup(browser, D);
  S.hold.on = true;
  await cropAndApply(S.pg);
  await S.pg.evaluate(() => __draw());   // what rrFlushRepaints / a sync does to the page
  // 2026-10-30 ([stated] Brad "yes"): the redrawn photo has to load before the
  // badge sits on it — measured ~0.3 s here. The check read the page at once
  // and went red on live main with nothing wrong in the app; it now waits up
  // to 3 s for the badge (and still fails if it never comes back).
  await waitFor(S.pg, () => __badge().shown, null, 3000);
  B = await S.pg.evaluate(() => __badge());
  T('U2a the redrawn photo shows "Updating…" again', B.shown && /Updating…/.test(B.text), B);
  S.hold.release();
  T('U2b and it goes when Drive answers', await waitFor(S.pg, () => !__badge().shown && window.__toasts.some(t => /Photo updated/.test(t))));
  T('U2c after the save no badge is left anywhere on the page (v0.9.2049: badges exist only while a photo saves)', (await S.pg.evaluate(() => document.querySelectorAll('.rr-photo-updating').length)) === 0);
  T('U2d no page errors', S.errs.length === 0, S.errs);
  await S.pg.close();

  // ── U3 · Drive refuses ────────────────────────────────────────────────────
  console.log('\n== U3 · a save that fails ==');
  D = L.makeDrive(); S = await setup(browser, D);
  D.fail.protect = true;   // the writer refuses to overwrite an unprotected original
  await pressCrop(S.pg); await S.pg.evaluate(() => __screen());
  await S.pg.evaluate(() => { __setBox({ x: 200, y: 100, width: 1000, height: 800 }, 0); __press('_rrCropApply'); });
  const failed = await waitFor(S.pg, () => window.__toasts.some(t => /Could not save the edited photo/.test(t)));
  B = await S.pg.evaluate(() => __badge());
  T('U3a the badge is gone and the "Could not save" message shows — it can never spin forever', failed && !B.shown, { B, toasts: await S.pg.evaluate(() => window.__toasts) });
  T('U3b nothing left marked as saving', !(await S.pg.evaluate(id => rrPhotoIsSaving(id), S.ids[0])));
  await S.pg.close();

  // ── U4 · Restore original ────────────────────────────────────────────────
  console.log('\n== U4 · Restore original ==');
  D = L.makeDrive(); S = await setup(browser, D);
  await cropAndApply(S.pg);
  await waitFor(S.pg, () => !__badge().shown && window.__toasts.some(t => /Photo updated/.test(t)));
  await S.pg.evaluate(() => { window.__toasts = []; });
  S.hold.on = true;
  await pressCrop(S.pg);
  await S.pg.evaluate(() => __screen());
  await S.pg.evaluate(() => __press('_rrCropRestore'));
  const upR = await waitFor(S.pg, () => !__cropOpen() && __badge().shown);
  await heldOne(S);
  T('U4a Restore original: "Updating…" while Drive has not answered', upR && S.hold.waiting.length === 1 && (await S.pg.evaluate(() => __badge())).shown, { upR, held: S.hold.waiting.length, B: await S.pg.evaluate(() => __badge()) });
  S.hold.release();
  T('U4b and gone when it has', await waitFor(S.pg, () => !__badge().shown && window.__toasts.some(t => /Photo updated/.test(t))));
  T('U4c no page errors', S.errs.length === 0, S.errs);
  await S.pg.close();

  // ── U5 · only the photo being saved ───────────────────────────────────────
  console.log('\n== U5 · another photo ==');
  D = L.makeDrive(); S = await setup(browser, D);
  S.hold.on = true;
  await cropAndApply(S.pg);
  const other = await S.pg.evaluate(id => rrPhotoIsSaving(id), S.ids[1]);
  T('U5a the second photo is not marked as saving', other === false);
  T('U5a2 (the first photo, being saved, shows it)', (await S.pg.evaluate(() => __badge())).shown);
  await S.pg.evaluate(() => document.querySelector('#gal-host a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));   // the LSV shown large now
  T('U5b flipped to the second photo: no badge', !(await S.pg.evaluate(() => __badge())).shown, await S.pg.evaluate(() => __badge()));
  await S.pg.evaluate(() => document.querySelector('#gal-host a').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
  T('U5c flipped back to the first: the badge is there again', (await S.pg.evaluate(() => __badge())).shown);
  S.hold.release();
  await waitFor(S.pg, () => window.__toasts.some(t => /Photo updated/.test(t)));
  await S.pg.close();

  // ── U6 · one word, kind to reduced motion ────────────────────────────────
  console.log('\n== U6 · the source rules ==');
  const words = (AC + read('photo-crop.js')).match(/'Updating\\u2026'|'Updating…'/g) || [];
  T('U6a the word is defined once, in config.js (RR_PHOTO_UPDATING_LABEL)', /const RR_PHOTO_UPDATING_LABEL = 'Updating\\u2026';/.test(CFG), null);
  T('U6b the ONE painter (photo-crop.js) reads it from config, its own copy is only the guard for a missing config, and the gallery holds no copy', /RR_PHOTO_UPDATING_LABEL/.test(read('photo-crop.js')) && words.length <= 1 && !/Updating/.test(AC.replace(/\/\/[^\n]*/g, '')), words);
  T('U6c reduced motion stops the spin', /@media \(prefers-reduced-motion: reduce\) \{ \.rr-photo-updating \.rr-upd-arrow \{ animation: none; \} \}/.test(CSS));
  T('U6d the badge never takes a click meant for the photo', /\.rr-photo-updating \{[^}]*pointer-events: none;/.test(CSS));

  // ── Planted offenders: the test must catch each broken version ───────────
  console.log('\n== planted offenders ==');
  // P1 · the crop never marks the photo as saving → no badge
  let files = L.planted(T, 'photo-crop.js', "    _rrPhotoSavingMark(fileId, true);   // v0.9.2043: \"Updating…\" until Drive answers\n    var ok = false;", "    var ok = false;", 'P1 no mark on Apply');
  if (files) {
    D = L.makeDrive(); S = await setup(browser, D, files);
    S.hold.on = true;
    const p1 = await cropAndApply(S.pg);
    T('P1 a crop that never marks the photo: no badge during the save — U1b would fail', !p1, await S.pg.evaluate(() => __badge()));
    S.hold.release(); await S.pg.close();
  }
  // P2 · v0.9.2049: the gallery forgets to NAME its picture → the one painter cannot find it
  files = L.planted(T, 'app-collection.js', "    heroImg.setAttribute('data-rrfid', p.id || '');   // v0.9.2043/2049: names the photo for the \"Updating…\" painter\n", "", 'P2 picture not named');
  if (files) {
    D = L.makeDrive(); S = await setup(browser, D, files);
    S.hold.on = true;
    const p2 = await cropAndApply(S.pg);
    T('P2 a gallery that does not name its picture gets no badge — U1b would fail', !p2 && !(await S.pg.evaluate(() => __badge())).shown);
    S.hold.release(); await S.pg.close();
  }
  // P3 · the mark is never cleared → the arrow would spin forever
  files = L.planted(T, 'photo-crop.js', "      if (o.onDone) try { o.onDone(ok, blob, 'crop'); } catch (e) {}\n      _rrPhotoSavingMark(fileId, false);", "      if (o.onDone) try { o.onDone(ok, blob, 'crop'); } catch (e) {}", 'P3 never cleared');
  if (files) {
    D = L.makeDrive(); S = await setup(browser, D, files);
    await cropAndApply(S.pg);
    await waitFor(S.pg, () => window.__toasts.some(t => /Photo updated/.test(t)));
    await S.pg.waitForTimeout(300);
    T('P3 a mark never cleared leaves the arrow spinning — U1f would fail', (await S.pg.evaluate(() => __badge())).shown);
    await S.pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
