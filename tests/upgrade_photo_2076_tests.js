#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE 📷 ON THE WANT / UPGRADE PAGE SHOWS YOUR COPY'S PHOTO — v0.9.2076
// (found by the first iPhone-style pass, WebKit, 2026-10-30)
//
// The 📷 on an Upgrade entry put pd.photoItem — the item's Drive photo FOLDER
// link — into an <img src>. A folder link is never a picture: the box opened
// empty on every device, and on an iPhone its inline onerror threw ("null is
// not an object (evaluating 'this.parentElement.style')") once the list had
// redrawn. It also showed whichever owned copy of the number came first, and
// two copies of one number shared one box.
//   S  source: no <img> takes a photo-folder value as its picture, and no
//      inline onerror reaches for this.parentElement — each proven on planted
//      offenders.
//   B  the real app, a phone (cards) and a computer (table), in Chromium and,
//      when it is installed, WebKit (Safari's engine): two copies of the 773
//      on the Upgrade list, each 📷 shows ITS copy's picture (and its own
//      condition); a copy whose folder has no photo says so; closing and
//      re-opening does not ask Drive again; the list redrawing mid-lookup
//      throws nothing.
//   P  planted (Chromium): the old folder-link picture, the first-find copy,
//      and one shared box per number — each turns B red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const FILES = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/vendor|\.min\./.test(f));
const PAGES = read('app-pages.js');

// ── S ──
const FOLDERISH = /photoItem|photoLink|photoFolder|folderLink/;
function folderPictures(name, src) {
  const out = [];
  src.split('\n').forEach((ln, i) => {
    if (/^\s*\/\//.test(ln)) return;
    // <img ... src="${ ...photoItem... }"
    const re = /<img\b[^>]*?\bsrc\s*=\s*\\?["']?\$\{([^}]*)\}/g; let m;
    while ((m = re.exec(ln))) if (FOLDERISH.test(m[1])) out.push(name + ':' + (i + 1));
    // img.src = something.photoItem
    if (/\.src\s*=\s*[^;=]*\b(?:pd|p|item|row|it|x)\.(?:photoItem|photoLink)\b/.test(ln)) out.push(name + ':' + (i + 1));
  });
  return out;
}
let fp = []; for (const f of FILES) fp = fp.concat(folderPictures(f, read(f)));
ok('S1 no <img> takes a photo-FOLDER link as its picture', !fp.length, fp.join(' | '));
ok('S1-P1 the old Upgrade 📷 box — caught', folderPictures('p.js', '<div id="${photoId}"><img src="${pd && pd.photoItem ? pd.photoItem : \'\'}" style="max-width:100%"></div>').length === 1);
ok('S1-P2 img.src = pd.photoItem — caught', folderPictures('p.js', '    img.src = pd.photoItem;').length === 1);
ok('S1-G the real painter (loadDriveThumb by file id) — not caught', !folderPictures('g.js', "    if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, host, null, 'hi');").length);
function parentOnerror(name, src) {
  const out = [];
  src.split('\n').forEach((ln, i) => { if (/onerror\s*=\s*\\?["'][^"']*this\.parentElement/.test(ln)) out.push(name + ':' + (i + 1)); });
  return out;
}
let po = []; for (const f of FILES) po = po.concat(parentOnerror(f, read(f)));
ok('S2 no inline onerror reaches for this.parentElement (throws on an iPhone once the list redraws)', !po.length, po.join(' | '));
ok('S2-P the old desktop row — caught', parentOnerror('p.js', `<img src="x" onerror="this.parentElement.parentElement.style.display='none'">`).length === 1);

// ── B ──
let pw;
try { pw = require('playwright'); }
catch (e) { console.log('FAILED  —  upgrade_photo_2076_tests needs playwright for its browser half and it is not installed.'); process.exit(1); }

function fnSource(src, name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error('function ' + name + ' not found in app-pages.js — update the test');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i + 1, j + 2);
}

// The scene: two owned copies of the 773 (cond 9, folder A / cond 6, folder B)
// and a 3376 whose folder holds no photo — all three on the Upgrade list, each
// entry pointing at its copy by inventoryId. Drive is stood in for: the folder
// lookup is counted, and the two pictures are already in the app's own
// picture cache, so the REAL painter (loadDriveThumb) shows them.
const SCENE = `
(function () {
  const pic = (c) => { const k = document.createElement('canvas'); k.width = 4; k.height = 3; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 4, 3); return k.toDataURL('image/png'); };
  window.__PIC = { A: pic('#c0392b'), B: pic('#2471a3') };
  const own = (inv, n, cond, folder, row) => ({ itemNum: n, variation: '1', owned: true, inventoryId: inv, row: row, condition: cond,
    priceItem: '45', userEstWorth: '120', datePurchased: '2026-08-06', photoItem: 'https://drive.google.com/drive/folders/' + folder,
    notes: '', era: 'Lionel Postwar', location: '' });
  state.personalData = { '77301': own('77301', '773', '9', 'FOLDER_A', 2), '77302': own('77302', '773', '6', 'FOLDER_B', 3), '33761': own('33761', '3376', '7', 'FOLDER_EMPTY', 4) };
  const ug = (inv, n, row) => ({ itemNum: n, variation: '1', inventoryId: inv, row: row, priority: 'High', targetCondition: '9', maxPrice: '900', notes: '', manufacturer: 'Lionel' });
  // listed B first, so a first-find of the number would hand the B entry copy A
  state.upgradeData = { '77302': ug('77302', '773', 2), '77301': ug('77301', '773', 3), '33761': ug('33761', '3376', 4) };
  state.wantData = {};
  window.__drive = 0;
  window.__driveDelay = 40;
  window.driveGetFolderPhotos = function (link) {
    window.__drive++;
    return new Promise(function (res) { setTimeout(function () {
      res(/FOLDER_A/.test(link) ? [{ id: 'fidA' }] : /FOLDER_B/.test(link) ? [{ id: 'fidB' }] : []);
    }, window.__driveDelay); });
  };
  _blobCache.fidA = window.__PIC.A; _blobCache.fidB = window.__PIC.B;
  try { Object.keys(localStorage).forEach(function (k) { if (/^lv_thumb_fids/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
  window._thumbFidCache = null;
  showPage('upgrade', null); buildUpgradePage();
})();
`;

async function scene(browser, engine, width, plants) {
  const ctx = await browser.newContext(width < 600
    ? { viewport: { width, height: 844 }, isMobile: engine !== 'firefox', hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  await ctx.route('**', r => { const u = r.request().url(); return /^(file|data|about|blob):/.test(u) ? r.continue() : r.abort(); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2500);
  await pg.evaluate(SEED); await pg.waitForTimeout(300);
  for (const p of (plants || [])) await pg.addScriptTag({ content: p });
  await pg.evaluate(SCENE); await pg.waitForTimeout(300);
  const pre = width < 600 ? 'upgphoto-m-' : 'upgphoto-d-';
  const R = await pg.evaluate(async (pre) => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const box = (inv) => document.getElementById(pre + inv) || document.getElementById(pre + inv + '-row');
    const btn = (inv) => [...document.querySelectorAll('button')].find(b => (b.getAttribute('onclick') || '').indexOf("_toggleUpgradePhoto('" + pre + inv + "')") >= 0);
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const pic = (inv) => { const h = document.getElementById(pre + inv + '-pic'); const im = h && h.querySelector('img');
      return { img: !!im, ok: !!(im && im.complete && im.naturalWidth > 0), which: im ? (im.src === window.__PIC.A ? 'A' : im.src === window.__PIC.B ? 'B' : im.src.slice(0, 60)) : null,
        text: h ? h.textContent.trim().slice(0, 80) : null }; };
    const card = (inv) => { const b = btn(inv); const c = b && (b.closest('tr') || b.closest('div[onclick]')); return c ? c.textContent.replace(/\s+/g, ' ') : ''; };
    const out = { buttons: [...document.querySelectorAll('button')].filter(b => /_toggleUpgradePhoto\(/.test(b.getAttribute('onclick') || '')).length };
    const open = async (inv) => { const b = btn(inv); if (!b) return { noButton: true }; b.click(); await wait(400); return Object.assign({ shown: shown(box(inv)) }, pic(inv)); };
    out.B = await open('77302'); out.Bcard = card('77302');
    out.A = await open('77301'); out.Acard = card('77301');
    out.E = await open('33761');
    out.drive1 = window.__drive;
    // close and re-open B: no new Drive lookup, still B's picture
    (btn('77302') || { click() {} }).click(); await wait(80); out.Bclosed = !shown(box('77302'));
    (btn('77302') || { click() {} }).click(); await wait(300); out.Bagain = Object.assign({ shown: shown(box('77302')) }, pic('77302')); out.drive2 = window.__drive;
    // the list redraws while a lookup is under way
    window._thumbFidCache = {}; try { Object.keys(localStorage).forEach(k => { if (/^lv_thumb_fids/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    window.__driveDelay = 200;
    buildUpgradePage(); await wait(100);
    (btn('77301') || { click() {} }).click(); await wait(20); buildUpgradePage(); await wait(500);
    out.afterRedraw = { closed: !shown(box('77301')), pic: pic('77301') };
    return out;
  }, pre);
  R.errs = errs;
  await ctx.close();
  return R;
}

function judge(tag, R) {
  ok(tag + ' B0 three 📷 buttons (one per Upgrade entry with a photo folder)', R.buttons === 3, R.buttons);
  ok(tag + " B1 the 773 entry for copy 77302 shows THAT copy's photo", R.B.shown && R.B.ok && R.B.which === 'B', JSON.stringify(R.B));
  ok(tag + " B2 the 773 entry for copy 77301 shows THAT copy's photo — two copies, two boxes", R.A.shown && R.A.ok && R.A.which === 'A', JSON.stringify(R.A));
  if (/phone/.test(tag)) ok(tag + ' B3 each card shows its own copy\'s condition (Mine: 6 / Mine: 9)', /Mine: 6/.test(R.Bcard) && /Mine: 9/.test(R.Acard), JSON.stringify([R.Bcard.slice(0, 90), R.Acard.slice(0, 90)]));
  ok(tag + ' B4 a folder with no photo says so — no broken picture', R.E.shown && !R.E.img && /No photo found/.test(R.E.text || ''), JSON.stringify(R.E));
  ok(tag + ' B5 closes, re-opens with the same photo, no second Drive lookup', R.Bclosed && R.Bagain.shown && R.Bagain.which === 'B' && R.drive2 === R.drive1 && R.drive1 === 3, JSON.stringify({ c: R.Bclosed, again: R.Bagain, d1: R.drive1, d2: R.drive2 }));
  ok(tag + ' B6 the list redrawing mid-lookup: the new box starts closed, nothing thrown', R.afterRedraw.closed && !R.errs.length, JSON.stringify(R.afterRedraw));
  ok(tag + ' B7 no page errors', !R.errs.length, R.errs.join(' | '));
}

(async () => {
  const exC = '/opt/pw-browsers/chromium';
  let chromium;
  try { chromium = await pw.chromium.launch(fs.existsSync(exC) ? { executablePath: exC } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  judge('[chromium phone]', await scene(chromium, 'chromium', 390));
  judge('[chromium computer]', await scene(chromium, 'chromium', 1280));

  // WebKit (Safari's engine) — run when it is installed in this machine.
  let webkit = null;
  try { if (fs.existsSync(pw.webkit.executablePath())) webkit = await pw.webkit.launch(); } catch (e) { webkit = null; }
  if (webkit) {
    judge('[webkit phone]', await scene(webkit, 'webkit', 390));
    judge('[webkit computer]', await scene(webkit, 'webkit', 1280));
    await webkit.close();
  } else {
    console.log('NOTE  WebKit is not installed here — the Safari-engine half did not run (from the repo folder: npx --no-install playwright install webkit).');
  }

  // ── P — planted ──
  const PAINT = fnSource(PAGES, '_wuPaintPhoto'), COPY = fnSource(PAGES, '_wuOwnedCopy'), KEY = fnSource(PAGES, '_wuPhotoKey');
  const P1 = await scene(chromium, 'chromium', 390, [plant(PAINT, "if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, host, null, 'hi');", 'img.src = pd.photoItem;', 'P1')]);
  ok('P1 the old picture (the folder link in img.src) — B1 turns red', !(P1.B.ok && P1.B.which === 'B'), JSON.stringify(P1.B));
  const P2 = await scene(chromium, 'chromium', 390, [plant(COPY, "  if (u.inventoryId) {", "  if (false) {", 'P2')]);
  ok('P2 the first copy of the number (no inventoryId) — B1 / B3 turn red', P2.B.which !== 'B' || !/Mine: 6/.test(P2.Bcard), JSON.stringify([P2.B, P2.Bcard.slice(0, 80)]));
  const P3 = await scene(chromium, 'chromium', 390, [plant(KEY, 'String(_ugEntryKey(u))', "String(u.itemNum + '-' + (u.variation || ''))", 'P3')]);
  ok('P3 one box per NUMBER (the old id) — the two 773 entries collide, red', P3.buttons !== 3 || !(P3.B.which === 'B' && P3.A.which === 'A' && P3.A.shown && P3.B.shown), JSON.stringify([P3.B, P3.A]));
  await chromium.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
