#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO BUTTONS ABOVE THE PICTURE — v0.9.1976  (real Chromium, the REAL
// _buildPhotoGallery in app-collection.js, phone and computer widths)
//
// Brad (phone screenshot, item page, MTH 20-2428-1): "the crop, trash and undo
// buttons take up most of the screen, we need to have this above the picture
// not on the picture" → "yes". They were 26 px squares placed on the photo's
// corner; on a phone .rr-tap made them 44 px and they piled up over it.
//
//   A1  three buttons with words: To Inbox · Delete · Crop
//   A2  on a phone and on a computer, no button overlaps the picture —
//       every button's bottom is above the picture's top
//   A3  on a phone each button is at least 44 px tall (the tap promise)
//   A4  the buttons act on the photo SHOWN LARGE — Crop on photo 1, then
//       after tapping thumbnail 2, Delete and To Inbox on photo 2
//   X1  PLANTED: the v0.9.1974 gallery (buttons on the picture) → overlap
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_tools_above_1976_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 500))); cond ? pass++ : fail++; }

const COLL = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
// the old gallery, rebuilt from this file: the three buttons back on the photo's corner
function plantOld(src) {
  const a = src.indexOf('  var photoTools = document.createElement(\'div\');');
  const b = src.indexOf('  heroWrap.appendChild(heroLink);\n', a);
  if (a < 0 || b < 0) throw new Error('planted X1: the block moved; update this test');
  const old = [
    "  var editBtn = document.createElement('button'); editBtn.textContent = '\\u2702'; editBtn.className = 'rr-tap'; editBtn.title = 'Rotate / crop this photo';",
    "  editBtn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:2;width:26px;height:26px';",
    "  var delBtn = document.createElement('button'); delBtn.textContent = 'D'; delBtn.className = 'rr-tap'; delBtn.title = 'Delete this photo';",
    "  delBtn.style.cssText = 'position:absolute;top:4px;right:34px;z-index:2;width:26px;height:26px';",
    "  var inboxBtn = document.createElement('button'); inboxBtn.textContent = 'I'; inboxBtn.className = 'rr-tap'; inboxBtn.title = 'Send this photo back to the Photo Inbox';",
    "  inboxBtn.style.cssText = 'position:absolute;top:4px;right:64px;z-index:2;width:26px;height:26px';",
    "  heroWrap.appendChild(heroLink); heroWrap.appendChild(editBtn); heroWrap.appendChild(delBtn); heroWrap.appendChild(inboxBtn);\n",
  ].join('\n');
  return src.slice(0, a) + old + src.slice(b + '  heroWrap.appendChild(heroLink);\n'.length);
}

async function run(browser, width, collSrc) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/app-collection.js') && collSrc) return r.fulfill({ body: collSrc, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  const out = await pg.evaluate(async () => {
    // a wide train-shaped picture, like Brad's (1200 x 300)
    const c = document.createElement('canvas'); c.width = 1200; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#334'; g.fillRect(0, 0, 1200, 300);
    const pic = c.toDataURL('image/png');
    window.loadDriveThumb = function (id, img) { img.src = pic; return true; };
    window.__calls = [];
    window._detailPhotoEdit = function (id) { window.__calls.push(['crop', id]); };
    window._deleteCollectionPhoto = function (id) { window.__calls.push(['delete', id]); };
    window._rrPhotoBackToInbox = function (id) { window.__calls.push(['inbox', id]); };
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const stage = document.createElement('div');
    stage.id = 'stage'; stage.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:16px;background:#fff;z-index:99999';
    document.body.appendChild(stage);
    _buildPhotoGallery(stage, [
      { id: 'PHOTO1', name: 'MTH 20-2428-1 ID418 RSV.jpg' },
      { id: 'PHOTO2', name: 'MTH 20-2428-1 ID418 LSV.jpg' },
    ], { folderLink: 'https://drive.google.com/drive/folders/F' });
    await new Promise(r => setTimeout(r, 400));
    const hero = stage.querySelector('img[id$="-hero"]');
    const hr = hero.getBoundingClientRect();
    const btns = Array.from(stage.querySelectorAll('button')).filter(b => /crop|Delete|Inbox/i.test(b.title));
    const boxes = btns.map(b => { const r = b.getBoundingClientRect(); return { title: b.title, text: b.textContent.trim(), top: r.top, bottom: r.bottom, h: r.height, left: r.left, right: r.right }; });
    const byTitle = t => btns.find(b => new RegExp(t, 'i').test(b.title));
    byTitle('crop').click();
    const thumbs = Array.from(stage.querySelectorAll('div[title]')).filter(d => /LSV/.test(d.title));
    if (thumbs[0]) thumbs[0].click();
    byTitle('Delete').click();
    byTitle('Inbox').click();
    return { hero: { top: hr.top, bottom: hr.bottom, h: hr.height }, boxes, calls: window.__calls };
  });
  out.errs = errs;
  await ctx.close();
  return out;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const phone = await run(browser, 390, null);
  const desk = await run(browser, 1300, null);

  const words = phone.boxes.map(b => b.text);
  T('A1 three buttons with their words: To Inbox · Delete · Crop', phone.boxes.length === 3
    && /To Inbox/.test(words[0]) && /Delete/.test(words[1]) && /Crop/.test(words[2]), words);
  const clear = r => r.boxes.length === 3 && r.hero.h > 20 && r.boxes.every(b => b.bottom <= r.hero.top + 0.5);
  T('A2 phone: no button sits on the picture (all above it)', clear(phone), { hero: phone.hero, boxes: phone.boxes });
  T('A2 computer: no button sits on the picture (all above it)', clear(desk), { hero: desk.hero, boxes: desk.boxes });
  T('A3 phone: each button is at least 44 px tall', phone.boxes.every(b => b.h >= 43.5), phone.boxes.map(b => b.h));
  T('A4 the buttons act on the photo shown large (Crop → 1, then Delete + To Inbox → 2)',
    JSON.stringify(phone.calls) === JSON.stringify([['crop', 'PHOTO1'], ['delete', 'PHOTO2'], ['inbox', 'PHOTO2']]), phone.calls);
  T('A5 no page errors', phone.errs.length === 0 && desk.errs.length === 0, phone.errs.concat(desk.errs));

  const old = await run(browser, 390, plantOld(COLL));
  T('X1 PLANTED the old gallery: the buttons sit ON the picture (A2 can fail)', old.boxes.length === 3 && !clear(old), { hero: old.hero, boxes: old.boxes });

  await browser.close();
  console.log('\nphoto_tools_above_1976_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
