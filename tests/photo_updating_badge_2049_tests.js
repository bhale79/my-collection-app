#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// "UPDATING…" EVERYWHERE A CROPPED PHOTO SHOWS — v0.9.2049
// [stated] Brad 2026-10-29, after v0.9.2043 put the badge on the item page:
// "yes" to the same badge on the Add-wizard thumbnails and the Photo Inbox crop.
//
// One painter (photo-crop.js _rrBusyPaint) draws the badge on ANY picture that
// names its Drive photo by an attribute in RR_PHOTO_ID_ATTRS; screens only mark
// their pictures. Run for real in Chromium against the stand-in Drive, with the
// Drive upload HELD so the in-between moment can be looked at:
//   W1  the Add wizard's thumbnail ✂ → Apply: the thumbnail shows the badge until
//       Drive answers, then the new picture, no badge
//   I1  a Photo Inbox tile (data-fid, ~120 px): the arrow alone (word on hover),
//       on the picture's corner
//   I2  the review card's big picture (data-rvbig) inside a 1.5x pop-up card: the
//       badge sits on the picture's top-right corner, word showing
//   I3  every picture of that photo at once (tile + big picture)
//   R1  a screen redrawn mid-save gets its badge back on its own
//   E1  after the save: no badge anywhere, and nothing still watching
//   S*  source: Quick Capture's strip and the wizard thumbnail name their photo;
//       the inbox's attributes are all in the painter's list
//   P*  PLANTED: each undone is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_updating_badge_2049_tests needs playwright and it is not installed.'); process.exit(1); }
const L = require('./lib/crop-original-lib.js');
const APP = L.APP;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 600))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

async function setup(browser, D, files) {
  const { pg, errs } = await L.openApp(browser, D, files ? { files } : undefined);
  const hold = { on: false, waiting: [] };
  hold.release = () => { hold.on = false; hold.waiting.splice(0).forEach(r => r.fallback()); };
  await pg.route(/\/upload\/drive\/v3\/files\/[^/?]+\?uploadType=media/, r => {
    if (hold.on && r.request().method() === 'PATCH') hold.waiting.push(r); else r.fallback();
  });
  await pg.evaluate(() => {
    // where the badge for a picture is, and whether it sits on the picture's top-right corner
    window.__badgeOn = (img) => {
      if (!img) return { found: false };
      const b = img.__rrBusy;
      if (!b || !b.isConnected) return { found: false };
      const cs = getComputedStyle(b), br = b.getBoundingClientRect(), ir = img.getBoundingClientRect();
      let offX = 0, offY = 0;
      const fit = getComputedStyle(img).objectFit;
      if ((fit === 'contain' || fit === 'scale-down') && img.naturalWidth) {
        const k = Math.min(ir.width / img.naturalWidth, ir.height / img.naturalHeight);
        offX = (ir.width - img.naturalWidth * k) / 2; offY = (ir.height - img.naturalHeight * k) / 2;
      }
      const top = ir.top + offY, right = ir.right - offX;
      return { found: true, shown: cs.display !== 'none' && br.width > 0,
        word: getComputedStyle(b.querySelector('.rr-upd-word')).display !== 'none', title: b.title,
        corner: br.top - top >= 0 && br.top - top < 30 && right - br.right >= 0 && right - br.right < 30,
        box: [Math.round(br.left), Math.round(br.top), Math.round(br.right)], pic: [Math.round(top), Math.round(right)] };
    };
    window.__count = () => document.querySelectorAll('.rr-photo-updating').length;
  });
  return { pg, errs, hold };
}
async function heldOne(S) { for (let i = 0; i < 100 && S.hold.waiting.length < 1; i++) await S.pg.waitForTimeout(50); return S.hold.waiting.length; }
const until = (pg, fn, arg, ms) => pg.waitForFunction(fn, arg, { timeout: ms || 8000 }).then(() => true, () => false);

// A Drive photo, an inbox tile showing it and the review card's big picture in a
// zoomed pop-up card — the inbox's own markup attributes (data-fid / data-rvbig).
async function inboxScene(pg) {
  return pg.evaluate(async () => {
    const f = await __fileFrom(__photo(1600, 900), 'IMG_9.jpg');
    const out = await driveUploadFile(f, 'inbox photo.jpg', 'folder1');
    const url = URL.createObjectURL(f);
    const tile = document.createElement('div');
    tile.id = 'tile'; tile.style.cssText = 'position:relative;width:120px;height:90px;overflow:hidden;margin:20px';
    tile.innerHTML = '<img data-fid="' + out.id + '" src="' + url + '" style="width:100%;height:100%;object-fit:cover;display:block">';
    document.body.appendChild(tile);
    const card = document.createElement('div');
    card.className = 'rr-card'; card.id = 'rvcard';
    card.style.cssText = 'position:fixed;left:200px;top:40px;width:600px;height:420px;zoom:1.5;background:#222;padding:10px';
    card.innerHTML = '<div style="position:relative;width:100%;height:380px;background:#000"><img data-rvbig="' + out.id + '" src="' + url + '" style="width:100%;height:100%;object-fit:contain;display:block"></div>';
    document.body.appendChild(card);
    await new Promise(r => setTimeout(r, 200));
    return out.id;
  });
}
async function inboxCrop(pg, id) {
  await pg.evaluate(id => { window.__open(id); }, id);
  await pg.evaluate(() => __screen());
  await pg.evaluate(() => { __setBox({ x: 200, y: 100, width: 1000, height: 600 }, 0); __press('_rrCropApply'); });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let D, S, m;

  // ── W1 · the Add wizard's thumbnail ──────────────────────────────────────
  console.log('\n== W1 · the Add wizard thumbnail ==');
  D = L.makeDrive(); S = await setup(browser, D);
  await S.pg.evaluate(async () => {
    const f = await __fileFrom(__photo(1600, 1200), 'IMG_7.jpg');
    window.__wizFile = f;
    const out = await driveUploadFile(f, 'Lionel 2343 ID9 RSV.jpg', 'folder1');
    window.wizard = window.wizard || {}; wizard.data = wizard.data || {};
    wizard.data._photoFileIds = { 'photosItem|RSV': out.id };
    wizard.data._photoUploadsInFlight = 0;
    const z = document.createElement('div'); z.className = 'photo-drop-zone'; z.setAttribute('data-view', 'RSV'); z.setAttribute('data-sid', 'photosItem');
    z.style.cssText = 'position:relative;width:220px;height:160px;margin:30px';
    const im = document.createElement('img'); im.id = 'wiz-thumb'; im.src = URL.createObjectURL(f); im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    z.appendChild(im); document.body.appendChild(z);
  });
  S.hold.on = true;
  await S.pg.evaluate(() => { _photoCropStart(window.__wizFile, 'photosItem', 'RSV', '2343', document.getElementById('wiz-thumb').src); });
  await S.pg.evaluate(() => __screen());
  const srcBefore = await S.pg.evaluate(() => document.getElementById('wiz-thumb').src);
  await S.pg.evaluate(() => { __setBox({ x: 200, y: 100, width: 1000, height: 800 }, 0); __press('_rrCropApply'); });
  await heldOne(S);
  const up = await until(S.pg, () => { const b = __badgeOn(document.getElementById('wiz-thumb')); return b.shown; });
  m = await S.pg.evaluate(() => __badgeOn(document.getElementById('wiz-thumb')));
  T('W1a Apply: the wizard thumbnail shows "Updating…" on its top-right corner while Drive has not answered', up && m.shown && m.corner && m.word && S.hold.waiting.length === 1, { m, held: S.hold.waiting.length });
  S.hold.release();
  const done = await until(S.pg, () => window.__toasts.some(t => /Photo updated/.test(t)) && !__count());
  const srcAfter = await S.pg.evaluate(() => document.getElementById('wiz-thumb').src);
  T('W1b Drive answers: the badge goes, "Photo updated", the thumbnail shows the crop', done && srcAfter !== srcBefore, { done, srcBefore: srcBefore.slice(0, 30), srcAfter: srcAfter.slice(0, 30) });
  T('W1c no page errors', S.errs.length === 0, S.errs);
  await S.pg.close();

  // ── I · the Photo Inbox pictures ─────────────────────────────────────────
  console.log('\n== I · the Photo Inbox ==');
  D = L.makeDrive(); S = await setup(browser, D);
  let fid = await inboxScene(S.pg);
  S.hold.on = true;
  await inboxCrop(S.pg, fid);
  await heldOne(S);
  await until(S.pg, () => __count() >= 2);
  const tile = await S.pg.evaluate(() => __badgeOn(document.querySelector('#tile img')));
  const big = await S.pg.evaluate(() => __badgeOn(document.querySelector('#rvcard img')));
  T('I1 an inbox tile (120 px): the arrow alone on its corner, the word on hover', tile.shown && tile.corner && !tile.word && /Updating/.test(tile.title), tile);
  T('I2 the review card\'s big picture inside a 1.5x pop-up: arrow + word on the PICTURE\'s top-right corner (not the band)', big.shown && big.corner && big.word, big);
  T('I3 every picture of that photo shows it at once (tile + big picture = 2 badges)', (await S.pg.evaluate(() => __count())) === 2);

  // R1 · the tile is redrawn mid-save (the inbox grid re-renders often)
  await S.pg.evaluate(id => {
    const t = document.getElementById('tile'); const src = t.querySelector('img').src;
    t.innerHTML = '<img data-fid="' + id + '" src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block">';
  }, fid);
  const back = await until(S.pg, () => __badgeOn(document.querySelector('#tile img')).shown, null, 2000);
  T('R1 a tile redrawn mid-save gets its badge back on its own (within a moment)', back);
  T('R1b …and the badge of the picture that left the page went with it (still 2 in all)', (await S.pg.evaluate(() => __count())) === 2);

  S.hold.release();
  await until(S.pg, () => window.__done && window.__done.ok);
  await S.pg.waitForTimeout(700);
  T('E1 after the save: no badge anywhere, the photo no longer marked as saving', (await S.pg.evaluate(id => __count() === 0 && !rrPhotoIsSaving(id), fid)));
  T('E1b page errors', S.errs.length === 0, S.errs);
  await S.pg.close();

  // ── S · the source ───────────────────────────────────────────────────────
  console.log('\n== S · source ==');
  // the Photo Inbox is read ONLY through tests/lib/pin-source.js (pin_source_tests R1)
  const PC = read('photo-crop.js'), PIN = require('./lib/pin-source').pinSource(), QC = PIN, GRID = PIN, REV = PIN;
  const attrs = (PC.match(/var RR_PHOTO_ID_ATTRS = \[([^\]]*)\]/) || [])[1] || '';
  T('S1 the inbox\'s photo attributes (data-fid, data-rvfid, data-rvbig, data-ppfid) and data-rrfid are all in the painter\'s ONE list',
    ['data-rrfid', 'data-fid', 'data-rvfid', 'data-rvbig', 'data-ppfid'].every(a => attrs.indexOf("'" + a + "'") >= 0)
    && /data-fid="/.test(GRID) && /data-rvbig="/.test(REV) && /data-rvfid="/.test(REV), attrs);
  T('S2 Quick Capture\'s strip names its uploaded photo (data-rrfid)', /data-rrfid="' \+ rrEsc\(r\.driveId\)/.test(QC));
  T('S3 the wizard thumbnail is named before the crop opens (_photoCropStart)', /_zt\.setAttribute\('data-rrfid', fileId\)/.test(PC));
  T('S4 no screen draws a badge of its own — only photo-crop.js makes .rr-photo-updating',
    fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'photo-crop.js').every(f => read(f).indexOf("'rr-photo-updating'") < 0));

  // ── P · planted ──────────────────────────────────────────────────────────
  console.log('\n== P · planted ==');
  let files = L.planted(T, 'photo-crop.js', "var RR_PHOTO_ID_ATTRS = ['data-rrfid', 'data-fid', 'data-rvfid', 'data-rvbig', 'data-ppfid'];",
    "var RR_PHOTO_ID_ATTRS = ['data-rrfid', 'data-rvfid', 'data-rvbig', 'data-ppfid'];", 'P1 data-fid left out');
  if (files) {
    D = L.makeDrive(); S = await setup(browser, D, files);
    fid = await inboxScene(S.pg); S.hold.on = true; await inboxCrop(S.pg, fid); await heldOne(S); await S.pg.waitForTimeout(700);
    T('P1 data-fid left out of the list: the inbox tile gets no badge — I1 would fail', !(await S.pg.evaluate(() => __badgeOn(document.querySelector('#tile img')).shown)));
    S.hold.release(); await S.pg.close();
  }
  files = L.planted(T, 'photo-crop.js', "        if (_zt) _zt.setAttribute('data-rrfid', fileId);\n", '', 'P2 wizard thumbnail not named');
  T('P2 the wizard thumbnail not named: S3 fails on the planted source', files && !/_zt\.setAttribute\('data-rrfid', fileId\)/.test(files['photo-crop.js']));
  files = L.planted(T, 'photo-crop.js', "  if (ids.length && !_rrBusyTimer) _rrBusyTimer = setInterval(_rrBusyPaint, RR_BUSY_TICK_MS);\n", '', 'P3 no tick');
  if (files) {
    D = L.makeDrive(); S = await setup(browser, D, files);
    fid = await inboxScene(S.pg); S.hold.on = true; await inboxCrop(S.pg, fid); await heldOne(S);
    await until(S.pg, () => __count() >= 2);
    await S.pg.evaluate(id => { const t = document.getElementById('tile'); const src = t.querySelector('img').src;
      t.innerHTML = '<img data-fid="' + id + '" src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block">'; }, fid);
    await S.pg.waitForTimeout(1200);
    T('P3 no looking-again while a save runs: a redrawn tile stays without its badge — R1 would fail', !(await S.pg.evaluate(() => __badgeOn(document.querySelector('#tile img')).shown)));
    S.hold.release(); await S.pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
