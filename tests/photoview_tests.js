#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// PHOTOVIEW — a photo tap opens the picture INSIDE the app (2026-11-11)
// Real Chromium, the REAL app at phone size (the walks' loader in tests/lib/).
//
// Hand-test T-2026-11-08-04 (hintbox) failed on Brad's Android phone: tapping
// an item's photo opened "Select an account" with the TEST account first.
// It was never the app's sign-in: every photo was a link to drive.google.com,
// Android hands such a link to the Google Drive APP, and that app asks which
// of the phone's accounts to open it with.
//
//   V  the viewer: a REAL tap on each of the five kinds of photo on screen —
//      the item page's big picture, a strip thumbnail, a set/paper page's
//      photo, a sale record's photo, a part's thumbnail — opens the viewer; no
//      new tab, no navigation, nothing handed to drive.google.com
//   B  it is a pop-up like any other: ONE history step; the phone's Back
//      closes it; its Close button closes it and leaves no step behind; a tap
//      beside the picture does nothing
//   G  Google Drive is still one tap away: its own button, the photo's own id
//   D  the sign-in diary: whenever the APP opens Google's window it says so and
//      names the code that asked
//   S  source guards: no photo on screen is a Drive link; the viewer's words
//      live in config.js
//   P  PLANTED offenders — each must turn its check red
// ══════════════════════════════════════════════════════════════════════════
const L = require('./lib/backtruth-walks.js');
const { fs, path, APP, rd, launch, open, at, sleep, code, plant } = L;

let pass = 0, fail = 0;
function T(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)); }
}

const PHOTOS = [
  { id: 'PH0TO-one_1', name: '01· 6464-1 RSV.jpg', thumbnailLink: '', view: 'https://drive.google.com/file/d/PH0TO-one_1/view' },
  { id: 'PH0TO-two_2', name: "02· Bob's \"best\" shot.jpg", thumbnailLink: '', view: 'https://drive.google.com/file/d/PH0TO-two_2/view' },
];
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// What the viewer looks like right now, and whether anything left the app.
const VIEW = () => {
  const ov = document.getElementById('rr-photo-view');
  if (!ov) return { open: false, n: document.querySelectorAll('#rr-photo-view').length };
  const d = ov.querySelector('.rr-photo-view-drive'), x = ov.querySelector('.rr-photo-view-close'), i = ov.querySelector('.rr-photo-view-img');
  return {
    open: true, n: document.querySelectorAll('#rr-photo-view').length,
    name: (ov.querySelector('.rr-photo-view-name') || {}).textContent || '',
    drive: d ? [d.getAttribute('href'), d.target, d.rel, d.textContent] : null,
    close: x ? x.textContent : '',
    img: !!i, top: (function () { const r = ov.getBoundingClientRect(); const e = document.elementFromPoint(r.width / 2, r.height / 2); return !!(e && ov.contains(e)); })(),
  };
};

async function walk(browser, planted) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { pg, errs } = await open(ctx, planted);
  const R = { pops: 0, navs: [] };
  ctx.on('page', () => { R.pops++; });                                    // a new tab = the old behaviour
  pg.on('framenavigated', f => { if (f === pg.mainFrame()) R.navs.push(f.url()); });
  await ctx.route(/drive\.google\.com/, r => { R.navs.push('DRIVE ' + r.request().url()); r.abort(); });
  await pg.evaluate(({ PHOTOS, PIXEL }) => {
    window.__photos = PHOTOS;
    window.driveGetFolderPhotos = async function () { return JSON.parse(JSON.stringify(window.__photos)); };
    window.loadDriveThumb = function (id, img) { if (img) img.src = PIXEL; return true; };
    window.__full = [];
    window._loadDriveThumbFull = async function (id, img) { window.__full.push(id); img.src = PIXEL; };
    window._lines = [];
    window.rrSyncLog = function (kind, m) { window._lines.push(kind + ': ' + m); };
  }, { PHOTOS, PIXEL });
  const navs0 = () => R.navs.filter(u => !/^file:/.test(u) || /#/.test(u));
  const tapAndRead = async (sel) => {
    const a0 = await at(pg);
    await pg.click(sel); await sleep(pg, 350);
    const v = await pg.evaluate(VIEW); const a1 = await at(pg);
    const full = await pg.evaluate(() => window.__full.slice(-1)[0] || '');
    if (v.open) { await pg.click('#rr-photo-view .rr-photo-view-close'); await sleep(pg, 450); }
    const a2 = await at(pg);
    return { v, up: a1.idx - a0.idx, back: a1.back, stack: a1.stack, full, after: [(await pg.evaluate(VIEW)).open, a2.idx - a0.idx, a2.stack, a2.back], hash: await pg.evaluate(() => location.hash) };
  };

  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 400);

  // 1 — the item page's big picture, and 2 — a thumbnail in the strip under it
  await pg.evaluate(() => {
    const host = document.createElement('div'); host.id = 'pv-gal'; host.style.cssText = 'margin:8px';
    const strip = document.createElement('div'); strip.id = 'pv-strip'; strip.style.cssText = 'margin:8px';
    const page = document.querySelector('.page.active'); page.insertBefore(strip, page.firstChild); page.insertBefore(host, page.firstChild);
    _buildPhotoGallery(host, JSON.parse(JSON.stringify(window.__photos)), { folderLink: 'https://drive.google.com/drive/folders/F1', canRename: false });
    return window._rrDetailGallery(strip, 'https://drive.google.com/drive/folders/F1');
  });
  await sleep(pg, 300);
  await pg.evaluate(() => window.scrollTo(0, 0));
  R.heroAttrs = await pg.evaluate(() => { const a = document.querySelector('#pv-gal a[data-rrphoto]'); return a ? [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('data-rrphoto')] : null; });
  R.hero = await tapAndRead('#pv-gal a img');
  R.stripCount = await pg.evaluate(() => document.querySelectorAll('#pv-strip a[data-rrphoto]').length);
  R.strip = await tapAndRead('#pv-strip a[data-rrphoto="PH0TO-two_2"] img');

  // B — Back closes it; a tap beside the picture does nothing
  const b0 = await at(pg);
  await pg.click('#pv-gal a img'); await sleep(pg, 350);
  await pg.mouse.click(8, 500); await sleep(pg, 250);                     // beside the picture
  R.beside = (await pg.evaluate(VIEW)).open;
  await pg.evaluate(() => history.back()); await sleep(pg, 450);
  const b1 = await at(pg);
  R.byBack = [(await pg.evaluate(VIEW)).open, b1.idx - b0.idx, b1.stack, b1.active];
  // opened twice in a row = ONE viewer
  await pg.mouse.click(200, 700); await sleep(pg, 100);
  await pg.evaluate(() => { rrPhotoView('PH0TO-one_1', 'a.jpg'); rrPhotoView('PH0TO-two_2', 'b.jpg'); }); await sleep(pg, 350);
  const tw = await at(pg);
  R.twice = [(await pg.evaluate(VIEW)).n, tw.stack];
  for (let k = 0; k < 3 && (await pg.evaluate(VIEW)).open; k++) { await pg.locator('#rr-photo-view .rr-photo-view-close').last().click(); await sleep(pg, 450); }
  R.twiceClosed = [(await pg.evaluate(VIEW)).open, (await at(pg)).stack];

  // 3 — a set / paper page's photo grid
  await pg.evaluate(() => {
    const el = document.createElement('div'); el.id = 'pv-html';
    el.innerHTML = '<a ' + rrPhotoLinkAttrs('PH0TO-two_2', window.__photos[1].name) + ' style="display:block;width:120px;height:120px"><img style="width:120px;height:120px"></a>';
    const page = document.querySelector('.page.active'); page.insertBefore(el, page.firstChild); window.scrollTo(0, 0);
  });
  R.html = await tapAndRead('#pv-html a');

  // 4 — a sale record's photos (the real page)
  await pg.evaluate(() => { state.soldData['S1'].photoItem = 'https://drive.google.com/drive/folders/F2'; showSoldDetailPage('S1'); });
  await sleep(pg, 500);
  R.soldAnchors = await pg.evaluate(() => Array.from(document.querySelectorAll('#sold-detail-photos a')).map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('data-rrphoto')]));
  await pg.evaluate(() => { const a = document.querySelector('#sold-detail-photos a'); if (a) a.scrollIntoView({ block: 'center' }); });
  R.sold = await tapAndRead('#sold-detail-photos a[data-rrphoto="PH0TO-one_1"]');

  // nothing left the app in all of that
  R.left = [R.pops, navs0()];
  R.errs = errs;

  // D — the diary: the app opening Google's window says who asked
  R.diary = await pg.evaluate(() => {
    window._lines.length = 0;
    const asked = [];
    const door = _rrWrapTokenClient({ requestAccessToken: function (o) { asked.push(o); }, callback: null });
    function askFromThePhotoTest() { door.requestAccessToken({ prompt: 'consent' }); }
    askFromThePhotoTest();
    const line = window._lines.filter(l => /opening Google/.test(l))[0] || '';
    return { asked: asked.length, auth: /^auth: /.test(line), who: /asked by askFromThePhotoTest /.test(line), where: /\([\w.-]+\.js:\d+\)|\(\w+:\d+\)|askFromThePhotoTest/.test(line), prompt: /prompt "consent"/.test(line), line };
  });
  await ctx.close();
  return R;
}

// ── S — source ──────────────────────────────────────────────────────────────
// A photo on screen that is a link to Google Drive: an href taken from a
// photo's ".view" link, or built from "/file/d/…/view", outside the viewer's
// own "Open in Google Drive" button.
function scanPhotoLinks(files) {
  const bad = [];
  Object.keys(files).filter(f => /\.js$/.test(f) && !/^tests-/.test(f)).forEach(f => {
    code(files[f]).split('\n').forEach((ln, i) => {
      if (/href[^\n]{0,40}\b\w+\.view\b(?!\.)/.test(ln) || /\.href\s*=\s*\w+\.view\b(?!\.)/.test(ln)) bad.push(f + ':' + (i + 1));
      if (/<a href="'\s*\+\s*rrEsc\(p\.photo\)/.test(ln)) bad.push(f + ':' + (i + 1));
    });
  });
  return bad.sort();
}
function appFiles(over) {
  const o = {};
  fs.readdirSync(APP).filter(f => /\.js$/.test(f)).forEach(f => { o[f] = rd(f); });
  Object.keys(over || {}).forEach(f => { o[f] = over[f]; });
  return o;
}

(async () => {
  const browser = await launch();
  try {
    const AC = rd('app-collection.js'), AU = rd('app-auth.js'), CF = rd('config.js');
    const W = await walk(browser);
    const DRV = id => ['https://drive.google.com/file/d/' + id + '/view', '_blank', 'noopener', 'Open in Google Drive ↗'];

    // ── V ────────────────────────────────────────────────────────────────
    T('V1 the big picture is not a link anywhere: href "#", no target, it names its photo', W.heroAttrs, ['#', null, 'PH0TO-one_1']);
    T('V2 a tap on the big picture opens the viewer, on top, with the picture and its name', [W.hero.v.open, W.hero.v.top, W.hero.v.img, W.hero.v.name], [true, true, true, '6464-1 RSV']);
    T('V3 …and asks for the FULL picture of that photo', W.hero.full, 'PH0TO-one_1');
    T('V4 a thumbnail in the strip opens ITS photo (a name with quotes arrives whole)', [W.stripCount, W.strip.v.open, W.strip.v.name, W.strip.full], [2, true, 'Bob\'s "best" shot', 'PH0TO-two_2']);
    T('V5 a set / paper page\'s photo (a link written as text) opens the viewer', [W.html.v.open, W.html.v.name, W.html.full], [true, 'Bob\'s "best" shot', 'PH0TO-two_2']);
    T('V6 a sale record\'s photos are not links either', W.soldAnchors, [['#', null, 'PH0TO-one_1'], ['#', null, 'PH0TO-two_2']]);
    T('V7 …and a tap opens the viewer', [W.sold.v.open, W.sold.v.name, W.sold.full], [true, '6464-1 RSV', 'PH0TO-one_1']);
    T('V8 in all of that: no new tab, no page left, nothing handed to drive.google.com, the address unchanged', [W.left, W.hero.hash, W.sold.hash], [[0, []], '', '']);
    T('no page errors', W.errs, []);

    // ── B ────────────────────────────────────────────────────────────────
    T('B1 the viewer is ONE history step, held by the back stack', [W.hero.up, W.hero.back, W.hero.stack], [1, 'rr-photo-view', 1]);
    T('B2 its Close button closes it and leaves no step behind', [W.hero.after.slice(0, 3), W.strip.after.slice(0, 3), W.sold.after.slice(0, 3)], [[false, 0, 0], [false, 0, 0], [false, 0, 0]]);
    T('B3 a tap beside the picture does nothing', W.beside, true);
    T('B4 the phone\'s Back closes it: the page underneath, on its own step', W.byBack, [false, 0, 0, 'itemdetail']);
    T('B5 opened twice in a row = one viewer, one step; closed, none', [W.twice, W.twiceClosed], [[1, 1], [false, 0]]);

    // ── G ────────────────────────────────────────────────────────────────
    T('G1 Google Drive is one tap away, as its own button, for THAT photo', [W.hero.v.drive, W.strip.v.drive], [DRV('PH0TO-one_1'), DRV('PH0TO-two_2')]);
    T('G2 the Close button says Close', W.hero.v.close, '✕ Close');

    // ── D ────────────────────────────────────────────────────────────────
    T('D1 the app opening Google\'s window writes a diary line naming who asked and how', [W.diary.asked, W.diary.auth, W.diary.who, W.diary.prompt], [1, true, true, true]);

    // ── S ────────────────────────────────────────────────────────────────
    T('S1 no photo on screen is a link to Google Drive', scanPhotoLinks(appFiles()), []);
    T('S2 the only "/file/d/…/view" link app-collection.js builds for the screen is the viewer\'s own button', (code(AC).match(/drive\.google\.com\/file\/d\//g) || []).length, 1);
    T('S3 the viewer\'s words are in config.js, and they say nothing of "AI"', [/const RR_PHOTO_VIEW = \{/.test(CF), /close: 'Close'/.test(CF), /drive: 'Open in Google Drive'/.test(CF), /\bAI\b/.test((CF.match(/const RR_PHOTO_VIEW = \{[\s\S]*?\};/) || [''])[0])], [true, true, true, false]);
    T('S4 the viewer registers with the back stack through the ONE overlay helper', /function rrPhotoView\([\s\S]*?rrDismissGuard\(ov, close\)/.test(code(AC)), true);
    T('S5 both places the app opens Google\'s window write the diary line first', (code(AU).match(/_rrAuthWindowNote\(opts[^\n]*\n\s*(?:try \{ )?real\.requestAccessToken\(opts\)/g) || []).length, 2);

    // ── P — planted offenders ────────────────────────────────────────────
    // P1 the big picture a Drive link again
    const heroBack = plant(AC, "    rrPhotoLinkWire(heroLink, p.id, p.name || '');", "    heroLink.href = p.view || '#'; heroLink.target = '_blank';", 'the big picture a Drive link');
    T('P1 the big picture linking to Google Drive again is caught (S1 red)', scanPhotoLinks(appFiles({ 'app-collection.js': heroBack })).length > 0, true);
    const P1 = await walk(browser, { 'app-collection.js': heroBack });
    T('P1b …and by the tap itself (V1/V2 red: a link, a new tab or a Drive request, no viewer)', [JSON.stringify(P1.heroAttrs) === JSON.stringify(['#', null, 'PH0TO-one_1']), P1.hero && P1.hero.v.open === true && P1.left[0] === 0 && P1.left[1].length === 0], [false, false]);
    const AP = rd('app-pages.js');
    // P2 a sale record's photos as Drive links
    const soldBack = plant(AP, "        return '<a ' + rrPhotoLinkAttrs(p.id, p.name) + ' style=\"display:block;border-radius:8px;overflow:hidden;background:var(--surface2);aspect-ratio:1;position:relative\">'   // photoview", "        return '<a href=\"' + p.view + '\" target=\"_blank\" rel=\"noopener\" style=\"display:block\">'", 'sale photos as Drive links');
    T('P2 a sale record\'s photos linking to Google Drive is caught (S1 red)', scanPhotoLinks(appFiles({ 'app-pages.js': soldBack })).length > 0, true);
    // P3 the viewer not registered with Back
    const noBack = plant(AC, "  if (typeof window.rrDismissGuard === 'function') window.rrDismissGuard(ov, close);\n  try { x.focus", "  try { x.focus", 'no back-stack entry');
    const P3 = await walk(browser, { 'app-collection.js': noBack });
    T('P3 a viewer the phone\'s Back cannot close is caught (B1 red)', [P3.hero.up, P3.hero.stack], [0, 0]);
    // P4 the diary line gone
    const noNote = plant(AU, "      _rrAuthWindowNote(opts, _who);\n", "", 'no diary line');
    const P4 = await walk(browser, { 'app-auth.js': noNote });
    T('P4 Google\'s window opened without a diary line is caught (D1 red)', [P4.diary.asked, P4.diary.who], [1, false]);
    T('P4b …and by the source guard (S5 red)', (code(noNote).match(/_rrAuthWindowNote\(opts[^\n]*\n\s*(?:try \{ )?real\.requestAccessToken\(opts\)/g) || []).length, 1);
    // P5 a second viewer left open
    const twoViewers = plant(AC, "  var old = document.getElementById('rr-photo-view'); if (old) old.remove();\n", "", 'two viewers');
    const P5 = await walk(browser, { 'app-collection.js': twoViewers });
    T('P5 two viewers open at once is caught (B5 red)', P5.twice[0] === 1, false);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  photoview_tests threw: ' + (e && e.stack || e)); process.exit(1); });
