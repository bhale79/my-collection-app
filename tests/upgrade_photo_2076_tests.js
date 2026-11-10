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
//   B  (since R7 listlayout, 2026-11-08 — the inline 📷 box was merged into
//      "📷 View Mine" in the ⋯ sheet, [stated] Brad "yes" to the plan: "View
//      Mine (with your photo inside it, so there's no separate 📷)") the real
//      app, a phone (cards) and a computer (table), in Chromium and, when it is
//      installed, WebKit: two copies of the 773 on the Upgrade list — each
//      entry shows ITS copy's condition, and its View Mine opens ITS copy (by
//      inventoryId), never the first copy of the number; nothing thrown.
//   P  planted (Chromium): the first-find copy (no inventoryId) turns B red.
//   (The old B1–B6 checks of the inline photo box retired with the box; the
//    folder-link and parentElement scans S1/S2 stay — they guard every file.)
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

// The scene: two owned copies of the 773 (cond 9 / cond 6) and a 3376 — all on
// the Upgrade list, each entry pointing at its copy by inventoryId, the B entry
// listed first so a first-find of the number would hand it copy A.
const SCENE = `
(function () {
  const own = (inv, n, cond, row) => ({ itemNum: n, variation: '1', owned: true, inventoryId: inv, row: row, condition: cond,
    priceItem: '45', userEstWorth: '120', datePurchased: '2026-08-06', photoItem: 'https://drive.google.com/drive/folders/F' + inv,
    notes: '', era: 'Lionel Postwar', location: '' });
  state.personalData = { '77301': own('77301', '773', '9', 2), '77302': own('77302', '773', '6', 3), '33761': own('33761', '3376', '7', 4) };
  const ug = (inv, n, row) => ({ itemNum: n, variation: '1', inventoryId: inv, row: row, priority: 'High', targetCondition: '9', maxPrice: '900', notes: '', manufacturer: 'Lionel' });
  state.upgradeData = { '77302': ug('77302', '773', 2), '77301': ug('77301', '773', 3), '33761': ug('33761', '3376', 4) };
  state.wantData = {};
  window.__opened = [];
  window.showItemDetailPage = function (idx, inv) { window.__opened.push(String(inv || '')); };
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
  const R = await pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    // each entry's own card / row, found by its ⋯ sheet key (the entry, never a position)
    const holder = (inv) => {
      const more = [...document.querySelectorAll('.rr-lc-more')].find(b => (b.getAttribute('onclick') || '').indexOf("'wu|Upgrade|" + inv + "'") >= 0);
      return more ? { more, box: more.closest('tr') || more.closest('#upgrade-cards > div') } : null;
    };
    const out = { inline: [...document.querySelectorAll('button')].filter(b => /_toggleUpgradePhoto\(/.test(b.getAttribute('onclick') || '')).length };
    for (const inv of ['77302', '77301']) {
      const h = holder(inv);
      if (!h) { out[inv] = { none: true }; continue; }
      out[inv] = { text: h.box ? h.box.textContent.replace(/\s+/g, ' ') : '' };
      h.more.click(); await wait(80);
      const vm = [...document.querySelectorAll('#rr-list-menu button')].find(b => /View Mine/.test(b.textContent));
      if (vm) { vm.click(); await wait(80); }
      out[inv].opened = window.__opened.slice(-1)[0] || null;
      out[inv].viewMine = !!vm;
    }
    return out;
  });
  R.errs = errs;
  await ctx.close();
  return R;
}

function judge(tag, R) {
  ok(tag + ' B0 no inline 📷 box any more — it lives in 📷 View Mine', R.inline === 0, R.inline);
  if (/phone/.test(tag)) ok(tag + " B3 each card shows its own copy's condition (Mine: 6 / Mine: 9)", /Mine: 6/.test(R['77302'].text || '') && /Mine: 9/.test(R['77301'].text || ''), JSON.stringify([R['77302'].text, R['77301'].text].map(t => (t || '').slice(0, 90))));
  ok(tag + ' B1 the 773 entry for copy 77302: 📷 View Mine opens THAT copy', R['77302'].viewMine && R['77302'].opened === '77302', JSON.stringify(R['77302']).slice(0, 160));
  ok(tag + ' B2 the 773 entry for copy 77301: 📷 View Mine opens THAT copy — two copies, two pages', R['77301'].viewMine && R['77301'].opened === '77301', JSON.stringify(R['77301']).slice(0, 160));
  ok(tag + ' B7 no page errors', !R.errs.length, R.errs.join(' | '));
}

(async () => {
  const exC = '/opt/pw-browsers/chromium';
  let chromium;
  try { chromium = await pw.chromium.launch(fs.existsSync(exC) ? { executablePath: exC } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  judge('[chromium phone]', await scene(chromium, 'chromium', 390));
  judge('[chromium computer]', await scene(chromium, 'chromium', 1280));

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
  const COPY = fnSource(PAGES, '_wuOwnedCopy');
  const P2 = await scene(chromium, 'chromium', 390, [plant(COPY, "  if (u.inventoryId) {", "  if (false) {", 'P2')]);
  ok('P2 the first copy of the number (no inventoryId) — B3 turns red', !(/Mine: 6/.test(P2['77302'].text || '') && /Mine: 9/.test(P2['77301'].text || '')), JSON.stringify([P2['77302'].text, P2['77301'].text].map(t => (t || '').slice(0, 80))));
  await chromium.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
