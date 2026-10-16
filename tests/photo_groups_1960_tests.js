#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO INBOX GROUPS — v0.9.1960   (real Chromium, REAL photo-inbox.js)
//
// Brad, 2026-10-15 (told the plan: "yes"):
//   "if i group a set of pictures and 1 of them is id by the reader or by the
//    google lens, the group should keep that id"                         → G
//   "google search button should be named Google Photo ID"               → L1
//   "need a way to delete extra group pictures when you move the photos to
//    the orientation boxes like right side and have 1 or 2 left over"    → D
//   "if you want to google photo id or read a photo in a grouped set, the
//    highlighted one should be the one sent to google or gets read. if not
//    selected, use right side"                                          → L2, R
//   "when you are dragging photos to their respective locations, you get to
//    the last one, the screen flashes and the last one disappears"      → S
//
//   G1  a one-item group: the number typed on photo 3 (after Google) shows on
//       photos 1 and 2 too — number box and "From the photo", which says where
//   G2  a weaker read of a photo's own (a best guess) gives way to the group's
//       typed number
//   G3  a SET keeps one number per photo — nothing is borrowed
//   G5  the inbox tile and the "still to read" counts use the group's number
//   G4  stepping off a photo showing a borrowed number does not file it as that
//       photo's own typed number
//   L1  the button says "Google Photo ID"; "Google Search" is nowhere on the card
//       or the help page
//   L2  Google Photo ID sends the photo on screen (the one tapped) — and, with
//       nothing tapped, the Right Side photo the card opened on
//   R1  the card opens on the Right Side photo; Identify reads it first
//   X-R1b PLANTED: _pinReadFiles keeps shot order → Identify reads photo 1 (caught)
//   D1  a leftover photo in the strip has a ✕; it goes to the Drive trash after
//       the confirm, and the card stays open on the rest
//   D2  "Keep it" trashes nothing; photos in the boxes have no ✕
//   S1  with ONE photo left to sort, the strip still shows it (it vanished)
//   S2  dropping a photo in a box keeps the card on the photo you were on
//   S3  tapping a photo updates the "2 of 3" counter (only the arrows did)
//   X*  PLANTED: each of the above, undone in the code, is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_groups_1960_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }

const SRC = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
function hooked(s) {
  const cut = s.lastIndexOf('})();');
  return s.slice(0, cut) + '\n;window.__PG={set groups(v){_groups=v;}, get groups(){return _groups;}, readFid:function(g){return _pinReadFid(g);}};\n' + s.slice(cut);
}
function planted(from, to, what) {
  if (SRC.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return SRC.replace(from, to);
}

// o: { kind, views: {fid: 'RSV'}, ids: {fid: rec}, src }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 737 }, deviceScaleFactor: 1.25 });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([ids]) => {
    try {
      localStorage.setItem('rr_pin_help_seen', '1'); localStorage.setItem('rr_photoid_help_seen', '1');
      localStorage.setItem('rr_inbox_ids', JSON.stringify(ids || {}));
    } catch (e) {}
  }, [o.ids || {}]);
  const body = hooked(o.src || SRC);
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (u.split('?')[0].endsWith('/app/photo-inbox.js')) return r.fulfill({ body, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(([kind, views, confirmAns]) => {
    const pic = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#2a6'; g.fillRect(0, 0, w, h); return c.toDataURL('image/jpeg', 0.8); };
    const img = pic(900, 600);
    const mk = (n, t, desc) => ({ itemNum: n, variation: '', itemType: t, description: desc, _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'K' + n, yearProd: '1958', roadName: 'B&O', gauge: 'O', varDesc: '' });
    state.masterData = [mk('8357', 'Diesel', 'GP-20 diesel'), mk('2343', 'Diesel', 'F3 A unit'), mk('647', 'Accessory', 'something')];
    _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId; window._allIdxComplete = true;
    state.personalData = {}; window.showToast = function () {};
    window.loadDriveThumb = function (fid, el) { if (el && el.tagName === 'IMG') el.src = img; };
    window.__calls = []; window.__lens = [];
    window.driveRequest = async function (m, p, b) { window.__calls.push([m, p, b]); return {}; };
    window.appConfirm = async function () { return confirmAns; };
    window.driveStageLensCopy = async function (fid) { window.__lens.push(fid); return { id: 'stg', url: 'https://example.invalid/x.jpg', reused: true }; };
    window.open = function () { return { location: '', close() {} }; };
    window.accessToken = 'test-token';   // the Google Photo ID button needs a sign-in
    const ids = ['f0a', 'f01', 'f02'];
    window.__PG.groups = [{ key: 'g0', files: ids.map((id, i) => ({ id, name: 'INBOX 1 g7 p' + i + '.jpg', createdTime: '2026-10-15',
      _meta: Object.assign({ kind: kind || 'single' }, views[id] ? { view: views[id] } : {}) })) }];
    window._pinReview('g0');
  }, [o.kind, o.views || {}, o.confirm !== false]);
  await pg.waitForTimeout(900);
  return { pg, ctx, errs };
}
const look = pg => pg.evaluate(() => {
  const main = document.getElementById('pin-rv-main');
  const ai = document.getElementById('pin-rv-ailine');
  return {
    main: main && main.getAttribute('data-rvbig'), box: (document.getElementById('pin-rv-num') || {}).value,
    ai: ai ? ai.innerText : '', inherit: !!(ai && ai.querySelector('[data-rvinherit]')),
    rail: [...document.querySelectorAll('#pin-rv-photos [data-dragfid]')].map(d => d.getAttribute('data-dragfid')),
    x: [...document.querySelectorAll('[data-rvdiscard]')].map(d => d.getAttribute('data-rvdiscard')),
    slotX: document.querySelectorAll('[data-rvslot] [data-rvdiscard]').length,
    lens: (document.getElementById('pin-rv-lens') || {}).textContent, open: !!document.getElementById('pin-review-ov'),
    text: (document.getElementById('pin-review-ov') || document.body).innerText,
    ids: JSON.parse(localStorage.getItem('rr_inbox_ids') || '{}'), calls: window.__calls, lensSent: window.__lens,
  };
});
const setMain = (pg, fid) => pg.evaluate(f => window._pinRvSetMain(f), fid);
const TYPED = { num: '8357', userTyped: 1 };

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== G: a group of ONE item keeps its number ==');
  r = await open(browser, { ids: { f02: TYPED } });
  m = await look(r.pg);
  T('G0 no script error', r.errs.length === 0, r.errs);
  T('G1 the card opens with the number typed on photo 3 (8357) in the box', m.box === '8357', { box: m.box, main: m.main });
  await setMain(r.pg, 'f01'); m = await look(r.pg);
  T('G1 …photo 2 shows it too, and says it came from another photo', m.box === '8357' && /8357/.test(m.ai) && m.inherit, { box: m.box, ai: m.ai.slice(0, 200) });
  await setMain(r.pg, 'f02'); m = await look(r.pg);
  T('G1 …photo 3 (its own) shows it without the borrowed note', m.box === '8357' && !m.inherit, { box: m.box, inherit: m.inherit });
  await setMain(r.pg, 'f0a'); await setMain(r.pg, 'f01'); m = await look(r.pg);
  T('G4 stepping off a photo showing a borrowed number does not make it that photo\'s own', !m.ids.f0a && !m.ids.f01, { f0a: m.ids.f0a, f01: m.ids.f01 });
  await r.ctx.close();

  r = await open(browser, { ids: { f0a: { num: '647', guess: 1 }, f02: TYPED } });
  m = await look(r.pg);
  T('G2 photo 1\'s own best guess (647) gives way to the typed 8357', m.main === 'f0a' && m.box === '8357' && m.inherit, { main: m.main, box: m.box, ai: m.ai.slice(0, 160) });
  await r.ctx.close();

  r = await open(browser, { kind: 'set', ids: { f02: { num: '2343' } } });
  m = await look(r.pg);
  T('G3 a SET: photo 1 does not borrow photo 3\'s 2343', m.main === 'f0a' && m.box !== '2343' && !m.inherit, { box: m.box, inherit: m.inherit });
  await setMain(r.pg, 'f02'); m = await look(r.pg);
  T('G3 …and photo 3 still shows its own 2343', m.box === '2343', m.box);
  await r.ctx.close();

  // G5: the inbox TILE and the "still to read" counts ask the same question (source check, planted below)
  const tileOk = src => /var sug = _pinRecFor\(_pinReadFid\(g\)\)\.rec;/.test(src) && !/_ids\(\)\[_pinReadFid\(g\)\]/.test(src)
    && !/return !ids\[_pinReadFid\(g\)\]; \}\)/.test(src);
  T('G5 the inbox tile and the still-to-read counts use the group\'s number (any photo)', tileOk(SRC));
  T('G5 PLANTED: the old tile line is caught', !tileOk(SRC.replace('var sug = _pinRecFor(_pinReadFid(g)).rec;', 'var sug = _ids()[_pinReadFid(g)];')));
  T('G5 PLANTED: the old to-read count is caught', !tileOk(SRC.replace("return !_pinRecFor(_pinReadFid(g)).rec; }).length;", "return !ids[_pinReadFid(g)]; }).length;")));

  console.log('== L: Google Photo ID ==');
  r = await open(browser, {});
  m = await look(r.pg);
  const help = await r.pg.evaluate(() => typeof window.rrPhotoIdHelpHtml === 'function' ? window.rrPhotoIdHelpHtml() : '');
  T('L1 the button says "Google Photo ID"', m.lens === 'Google Photo ID', m.lens);
  T('L1 "Google Search" is nowhere on the card or the help page', !/Google Search/.test(m.text) && help.length > 200 && !/Google Search/.test(help) && /Google Photo ID/.test(help), (help.match(/.{30}Google Search.{30}/) || [])[0]);
  await setMain(r.pg, 'f01');
  await r.pg.evaluate(() => window._pinReviewLens()); await r.pg.waitForTimeout(300); m = await look(r.pg);
  T('L2 with photo 2 tapped, Google Photo ID sends photo 2 (it always sent photo 1)', m.lensSent[0] === 'f01', m.lensSent);
  await r.ctx.close();
  r = await open(browser, { views: { f02: 'RSV' } });
  await r.pg.evaluate(() => window._pinReviewLens()); await r.pg.waitForTimeout(300); m = await look(r.pg);
  T('L2 with nothing tapped, it sends the Right Side photo', m.lensSent[0] === 'f02', m.lensSent);

  console.log('== R: the Right Side photo when nothing is chosen ==');
  T('R1 the card opens on the Right Side photo (photo 3)', m.main === 'f02', m.main);
  const readFirst = await r.pg.evaluate(() => window.__PG.readFid(window.__PG.groups[0]));
  T('R1 Identify (the batch read) reads the Right Side photo first, not photo 1', readFirst === 'f02', readFirst);
  await r.ctx.close();

  console.log('== D: discard a leftover photo ==');
  r = await open(browser, { views: { f0a: 'RSV', f01: 'LSV' } });
  m = await look(r.pg);
  T('D1 the one leftover photo is in the strip with a ✕; boxed photos have none', JSON.stringify(m.rail) === '["f02"]' && JSON.stringify(m.x) === '["f02"]' && m.slotX === 0, { rail: m.rail, x: m.x, slotX: m.slotX });
  await r.pg.evaluate(() => document.querySelector('[data-rvdiscard="f02"]').click()); await r.pg.waitForTimeout(700); m = await look(r.pg);
  const trash = m.calls.filter(c => c[0] === 'PATCH' && /f02/.test(c[1]) && c[2] && c[2].trashed === true);
  T('D1 after the confirm it goes to the Drive trash', trash.length === 1, m.calls);
  T('D1 …and the card stays open on the other two, the leftover gone', m.open && m.rail.length === 0 && !/f02/.test(JSON.stringify(m.x)) && m.main !== 'f02', { open: m.open, rail: m.rail, main: m.main });
  await r.ctx.close();
  r = await open(browser, { views: { f0a: 'RSV', f01: 'LSV' }, confirm: false });
  await r.pg.evaluate(() => document.querySelector('[data-rvdiscard="f02"]').click()); await r.pg.waitForTimeout(500); m = await look(r.pg);
  T('D2 "Keep it" trashes nothing and the photo stays', !m.calls.some(c => c[2] && c[2].trashed) && JSON.stringify(m.rail) === '["f02"]', { calls: m.calls, rail: m.rail });
  await r.ctx.close();

  console.log('== S: sorting into the boxes ==');
  r = await open(browser, {});
  await r.pg.evaluate(() => window._pinRvAssignView('f0a', 'RSV')); await r.pg.waitForTimeout(600);
  await r.pg.evaluate(() => window._pinRvAssignView('f01', 'LSV')); await r.pg.waitForTimeout(600);
  m = await look(r.pg);
  T('S1 with ONE photo left to sort, the strip still shows it', JSON.stringify(m.rail) === '["f02"]', m.rail);
  await r.pg.evaluate(() => window._pinRvAssignView('f02', 'FV')); await r.pg.waitForTimeout(600); m = await look(r.pg);
  T('S1 …and with all three in boxes the strip is gone', m.rail.length === 0, m.rail);
  await r.ctx.close();
  r = await open(browser, {});
  await setMain(r.pg, 'f01');
  await r.pg.evaluate(() => window._pinRvAssignView('f02', 'RSV')); await r.pg.waitForTimeout(600); m = await look(r.pg);
  T('S2 dropping a photo in a box keeps the card on the photo you were on (photo 2)', m.main === 'f01', m.main);
  await setMain(r.pg, 'f02');
  const pos = await r.pg.evaluate(() => (document.getElementById('pin-rv-nav') || {}).innerText || '');
  T('S3 tapping photo 3 updates the counter to "3 of 3" (it stayed on the old number)', /3 of 3 in this group/.test(pos), pos);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { ids: { f02: TYPED }, src: planted("    if (!_pinIsOneItemGroup(g)) return { rec: own, from: '' };", "    return { rec: own, from: '' };   // planted", 'no borrowing') });
  await setMain(x.pg, 'f01'); m = await look(x.pg);
  T('X-G PLANTED: no borrowing → photo 2\'s box is empty again (G1 would fail)', m.box !== '8357', m.box);
  await x.ctx.close();
  x = await open(browser, { ids: { f02: TYPED }, src: planted("        if (_typed && _typed !== String(_shown)) {", "        if (_typed && _typed !== String(_prevRec.num || '')) {   // planted", 'old compare') });
  await setMain(x.pg, 'f0a'); await setMain(x.pg, 'f01'); m = await look(x.pg);
  T('X-G4 PLANTED: the old compare → the borrowed number is filed as photo 1\'s own (G4 would fail)', !!(m.ids.f0a && m.ids.f0a.userTyped), m.ids.f0a);
  await x.ctx.close();
  x = await open(browser, { src: planted("      var staged = await driveStageLensCopy(_pinOnScreenFid() || gs[0].files[0].id);", "      var staged = await driveStageLensCopy(gs[0].files[0].id);   // planted", 'first photo') });
  await setMain(x.pg, 'f01'); await x.pg.evaluate(() => window._pinReviewLens()); await x.pg.waitForTimeout(300); m = await look(x.pg);
  T('X-L2 PLANTED: always the first photo → photo 1 is sent instead (L2 would fail)', m.lensSent[0] === 'f0a', m.lensSent);
  await x.ctx.close();
  x = await open(browser, { views: { f02: 'RSV' }, src: planted("      if (lead && ((lead._meta || {}).view === 'RSV')) return lead.id;", "      return all[0];   // planted", 'no right side') });
  m = await look(x.pg);
  T('X-R1 PLANTED: the card ignores the Right Side → opens on photo 1 (R1 would fail)', m.main === 'f0a', m.main);
  await x.ctx.close();
  x = await open(browser, { views: { f02: 'RSV' }, src: planted("    if (!_PIN_MULTI_KIND[kind]) {\n      for (var i = 1; i < out.length; i++) {", "    if (false) {\n      for (var i = 1; i < out.length; i++) {", 'shot order') });
  m = await x.pg.evaluate(() => window.__PG.readFid(window.__PG.groups[0]));
  T('X-R1b PLANTED: shot order kept → Identify reads photo 1 (R1 would fail)', m === 'f0a', m);
  await x.ctx.close();
  x = await open(browser, { src: planted("    var _railThumbs = thumbs.length > 1 ? thumbs.filter(function (t) { return !_viewOfFid[t]; }) : [];", "    var _railThumbs = thumbs.filter(function (t) { return !_viewOfFid[t]; }); if (_railThumbs.length <= 1) _railThumbs = [];   // planted", 'old strip') });
  await x.pg.evaluate(() => window._pinRvAssignView('f0a', 'RSV')); await x.pg.waitForTimeout(600);
  await x.pg.evaluate(() => window._pinRvAssignView('f01', 'LSV')); await x.pg.waitForTimeout(600); m = await look(x.pg);
  T('X-S1 PLANTED: the old strip rule → the last photo vanishes (S1 would fail)', m.rail.length === 0, m.rail);
  await x.ctx.close();
  x = await open(browser, { src: planted("    try { _rvStayOn = _pinOnScreenFid(); } catch (eS) {}   // v0.9.1960: no jump back to the first photo\n", "", 'no stay') });
  await setMain(x.pg, 'f01'); await x.pg.evaluate(() => window._pinRvAssignView('f02', 'RSV')); await x.pg.waitForTimeout(600); m = await look(x.pg);
  T('X-S2 PLANTED: no stay-on → the card jumps away from photo 2 (S2 would fail)', m.main !== 'f01', m.main);
  await x.ctx.close();
  x = await open(browser, { src: planted("    _pinRvNavRefresh();   // v0.9.1960: the counter follows a tapped photo too\n", "", 'no counter') });
  await setMain(x.pg, 'f02'); m = await x.pg.evaluate(() => document.getElementById('pin-rv-nav').innerText);
  T('X-S3 PLANTED: no redraw on a tap → the counter stays "1 of 3" (S3 would fail)', !/3 of 3/.test(m), m);
  await x.ctx.close();
  x = await open(browser, { views: { f0a: 'RSV', f01: 'LSV' }, src: planted("            '<button data-rvdiscard=", "            '' + '<i data-gone=", 'no discard') });
  m = await look(x.pg);
  T('X-D1 PLANTED: no ✕ on the strip → caught (D1 would fail)', m.x.length === 0, m.x);
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
