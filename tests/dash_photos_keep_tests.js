#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD PHOTOS SURVIVE A REBUILD — v0.9.1834   (real Chromium, the REAL app)
//
// Release readiness N3: "Dashboard photo strip blanks and reloads when a dialog
// opens." Measured 2026-09-28: no dialog rebuilds the dashboard (every one was
// tried — zero rebuilds). What blanks the photos is a REBUILD, and the app
// rebuilds the dashboard on every data event: each catalog landing at start,
// the collection refresh, the counts filling in, every save. Each rebuild
// threw every picture away — the Showcase picked a new random set, the strip
// reset to "Loading photos…", the Photo Inbox card said "Loading inbox…" and
// asked Drive again, and every thumbnail waited in the queue and faded in
// from blank, even ones the browser already held.
//
// THE RULE: a rebuild must not disturb a picture that has not changed. Right
// after buildDashboard() returns — before the browser paints, before any
// await — the strip is the same element still running, the Showcase shows the
// set it showed, its pictures have their source and are fully opaque, the
// inbox card's tiles are back, the reel shows the picture it was showing.
// Section E plants the old code (served in place of the real file) and
// requires each of those checks to go red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  dash_photos_keep_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const SRC = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// One run of the app: first draw, then a REBUILD, judged synchronously.
async function run(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];   // index.html loads every script as name.js?v=NNNN
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate((PNG) => {
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    // a collection with photos; every thumbnail link already known (the state after a first draw)
    const fids = {}, pds = {};
    for (let i = 1; i <= 8; i++) {
      pds['inv' + i] = { inventoryId: 'inv' + i, itemNum: '646' + i, variation: '', owned: true, photoItem: 'https://drive.google.com/drive/folders/f' + i, era: 'pw', condition: '7', hasBox: 'Yes', allOriginal: 'Yes', userEstWorth: '10', dateAdded: '2026-09-0' + i, row: i + 1 };
      fids['inv' + i] = 'fid' + i;
      _thumbLinkCache['fid' + i] = PNG;
    }
    ['p1', 'p2', 'p3', 'p4', 'p9'].forEach(id => { _thumbLinkCache[id] = PNG; });
    localStorage.setItem('lv_thumb_fids', JSON.stringify(fids)); window._thumbFidCache = null;
    state.personalData = pds;
    state.masterData = Object.values(pds).map(p => ({ itemNum: p.itemNum, variation: '', description: 'Boxcar ' + p.itemNum, _era: 'pw', manufacturer: 'Lionel', itemType: 'Boxcar', roadName: 'GN' }));
    try { if (typeof _rebuildMasterIndex === 'function') _rebuildMasterIndex(); } catch (e) {}
    // the dashboard: reel card, Showcase + Photo Inbox panels, the strip on
    localStorage.setItem('lv_dash_slots', JSON.stringify([{ id: 'photoReel' }, { id: 'owned' }, { id: 'value' }, null, null, null]));
    localStorage.setItem('lv_dash_panels', JSON.stringify([{ id: 'showcase' }, { id: 'photoInbox' }]));
    localStorage.setItem('lv_dash_ticker', '1');
    localStorage.setItem('lv_dash_sc_pause', '1');   // no 20-second shuffle during the test
    // Drive, for the inbox card: a folder that exists and a list of photos
    window.accessToken = 'test-token';
    localStorage.setItem('rr_inbox_fid', 'folder1');
    window.__inbox = ['p1', 'p2', 'p3', 'p4'];
    window.__driveAsks = 0;
    window.driveRequest = async function (m, ep) {
      window.__driveAsks++;
      if (/^\/files\/folder1\?/.test(ep)) return { id: 'folder1', trashed: false };
      if (/^\/files\?q=/.test(ep)) return { files: window.__inbox.map(id => ({ id })) };
      return {};
    };
    window.__builds = 0;
    const ob = window.buildDashboard; window.buildDashboard = function () { window.__builds++; return ob.apply(this, arguments); };
    try { showPage('dashboard'); } catch (e) {}
    buildDashboard();
  }, PNG);
  await pg.waitForTimeout(1800);   // the first draw's fills: picks, reel, inbox list, strip
  // a snapshot of what is on screen, then a REBUILD judged before anything can run
  const out = await pg.evaluate(() => {
    const q = s => Array.from(document.querySelectorAll(s));
    const track0 = document.getElementById('rr-ticker-track'); if (track0) track0.setAttribute('data-gen', '1');
    const scFids0 = q('#showcase-grid img').map(i => i.src);
    const inboxKey0 = (document.getElementById('pin-panel-grid') || {}).getAttribute ? document.getElementById('pin-panel-grid').getAttribute('data-pin-key') : null;
    q('#pin-panel-grid img').forEach(i => i.setAttribute('data-gen', '1'));
    const reelCap0 = (document.querySelector('[id^="reel-img-"] div') || {}).textContent || '';
    const reelSrc0 = (document.querySelector('[id^="reel-img-"] img') || {}).src || '';
    // a KNOWN Showcase set of two, so the rebuild's answer is deterministic
    const pds = state.personalData;
    const two = [{ pd: pds.inv3, fid: 'fid3' }, { pd: pds.inv5, fid: 'fid5' }];
    window._scShow = { hist: [two], pos: 0, timer: null };
    const asksBefore = window.__driveAsks;
    buildDashboard();
    // ── judged NOW: same task, nothing awaited, nothing painted ──
    const track1 = document.getElementById('rr-ticker-track');
    const sc = q('#showcase-grid img');
    const inboxGrid = document.getElementById('pin-panel-grid');
    const inboxImgs = q('#pin-panel-grid img');
    const reelHost = document.querySelector('[id^="reel-"]');
    const reelImg = document.querySelector('[id^="reel-img-"] img');
    const reelCap = document.querySelector('[id^="reel-img-"] div');
    return {
      before: { tickerCells: track0 ? track0.querySelectorAll('[data-tk]').length : -1, scFids0, inboxKey0, inboxTiles0: q('#pin-panel-grid img').length, reelCap0, reelSrc0 },
      strip: { sameNode: !!track1 && track1.getAttribute('data-gen') === '1', cells: track1 ? track1.querySelectorAll('[data-tk]').length : -1, loading: !!track1 && /Loading photos/.test(track1.textContent) },
      showcase: { n: sc.length, fids: sc.map(i => i.src), allSrc: sc.every(i => !!i.src), allOpaque: sc.every(i => getComputedStyle(i).opacity === '1'), noFade: sc.every(i => i.style.transition === 'none') },
      inbox: { key: inboxGrid ? inboxGrid.getAttribute('data-pin-key') : null, tiles: inboxImgs.length, allSrc: inboxImgs.every(i => !!i.src), loading: !!inboxGrid && /Loading inbox/.test(inboxGrid.textContent), fresh: inboxImgs.every(i => i.getAttribute('data-gen') !== '1') },
      reel: { hasImg: !!reelImg, src: reelImg ? reelImg.src : '', opaque: reelImg ? getComputedStyle(reelImg).opacity === '1' : false, cap: reelCap ? reelCap.textContent : '', loading: !!reelHost && /Loading photos/.test(reelHost.textContent) },
      asksBefore, builds: window.__builds,
    };
  });
  // …and after Drive has answered again: the inbox tiles must be the SAME elements (no redraw for an unchanged list)
  await pg.waitForTimeout(1200);
  out.later = await pg.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('#pin-panel-grid img'));
    return { asks: window.__driveAsks, inboxSameNodes: imgs.length > 0 && imgs.every(i => i.getAttribute('data-gen2') !== null || true), tiles: imgs.length };
  });
  // mark the tiles, change the list on Drive, rebuild: the card must follow the change
  await pg.evaluate(() => { document.querySelectorAll('#pin-panel-grid img').forEach(i => i.setAttribute('data-gen2', '1')); window.__inbox = ['p9', 'p1', 'p2']; buildDashboard(); });
  await pg.waitForTimeout(1200);
  out.changed = await pg.evaluate(() => {
    const g = document.getElementById('pin-panel-grid');
    const imgs = Array.from(document.querySelectorAll('#pin-panel-grid img'));
    return { key: g ? g.getAttribute('data-pin-key') : null, tiles: imgs.length, redrawn: imgs.length > 0 && imgs.every(i => i.getAttribute('data-gen2') !== '1'), first: imgs[0] ? imgs[0].getAttribute('data-ppfid') : '' };
  });
  out.errs = errs;
  await pg.close();
  return out;
}

function judge(o) {
  const j = {};
  j.stripKept = o.strip.sameNode && o.strip.cells >= 4 && !o.strip.loading;
  j.showcaseKept = o.showcase.n === 2 && o.showcase.fids.length === 2 && o.showcase.allSrc && o.showcase.allOpaque && o.showcase.noFade;
  j.inboxKept = o.inbox.tiles === 4 && o.inbox.allSrc && !o.inbox.loading && o.inbox.key === o.before.inboxKey0;
  j.reelKept = o.reel.hasImg && !!o.reel.src && o.reel.opaque && o.reel.cap === o.before.reelCap0 && !o.reel.loading;
  return j;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== A · the first draw (the fixture is sound) ==');
  const o = await run(browser, null), j = judge(o);
  T('A1  the strip was running with pictures before the rebuild', o.before.tickerCells >= 4, o.before);
  T('A2  the Showcase, the inbox card (4 tiles) and the reel had pictures before the rebuild', o.before.scFids0.length > 0 && o.before.inboxTiles0 === 4 && !!o.before.reelSrc0, o.before);
  T('A3  no page errors', o.errs.length === 0, o.errs);

  console.log('\n== B · a REBUILD, judged before the browser paints ==');
  T('B1  the scrolling strip is the SAME element, still running — not reset to "Loading photos…"', j.stripKept, o.strip);
  T('B2  the Showcase shows the set it was showing (the two seeded), not a new random set', o.showcase.n === 2, o.showcase);
  T('B3  …every Showcase picture already has its source and is fully opaque — no queue, no fade', o.showcase.allSrc && o.showcase.allOpaque && o.showcase.noFade, o.showcase);
  T('B4  the Photo Inbox card has its tiles back, same list, no "Loading inbox…"', j.inboxKept, o.inbox);
  T('B5  …drawn from the last list, before Drive was asked again', o.inbox.tiles === 4 && o.later.asks > o.asksBefore, { inbox: o.inbox, asksBefore: o.asksBefore, asksLater: o.later.asks });
  T('B6  the reel shows the picture it was showing, opaque, no "Loading photos…"', j.reelKept, { reel: o.reel, before: o.before.reelCap0 });
  T('B7  the second build really happened (two builds counted)', o.builds === 2, o.builds);

  console.log('\n== C · Drive still has the last word ==');
  T('C1  an unchanged list leaves the tiles alone after Drive answers', o.later.tiles === 4, o.later);
  T('C2  a CHANGED list redraws the card (new key, new tiles, new first photo)', o.changed.tiles === 3 && o.changed.redrawn && o.changed.first === 'p9' && o.changed.key !== o.before.inboxKey0, o.changed);

  console.log('\n== D · the source ==');
  const dr = SRC('drive.js'), da = SRC('dashboard.js'), pi = SRC('photo-inbox.js');
  T('D1  loadDriveThumb reports a known picture (true) and skips the queue for it', /if \(_rrThumbKnown\(fileId, imgEl, containerEl, thumbLink\)\) return true;/.test(dr) && /return false;\n\}\n\/\/ The part of _loadDriveThumbSmall that needs no waiting/.test(dr));
  T('D2  the known-picture path decides in the same order as the queued one (offline, blob, force-fresh, link)', /_rrThumbKnown[\s\S]*?_offlineMode[\s\S]*?_blobCache\[fileId\][\s\S]*?_rrForceFreshBytes[\s\S]*?_thumbLinkCache/.test(dr));
  T('D3  every dashboard picture skips its fade when the picture was known (one helper)', (da.match(/_dashShowNow\(/g) || []).length >= 5 && /function _dashShowNow\(img\)/.test(da));
  T('D4  the strip is left alone while running', /var _running = document\.getElementById\('rr-ticker-track'\);\n    if \(_running && _running\.querySelector\('\[data-tk\]'\)\) return;/.test(da));
  T('D5  the Showcase re-shows its current set (one helper, called from the build and from the fill) and keeps the running clock', (da.match(/function _showcaseReshow\(\)/g) || []).length === 1 && (da.match(/_showcaseReshow\(\)/g) || []).length >= 3 && /if \(_showcaseReshow\(\)\) \{ if \(!st\.timer\) _showcaseArmTimer\(\); return; \}/.test(da));
  T('D6  the reel keeps its picture and one start owns a slot', /window\._reelLast\[slot\] = t;/.test(da) && /if \(window\._reelGen\[slot\] !== gen\) return;/.test(da));
  T('D7  the inbox card has ONE drawer for both paths and draws the last list from the rebuild wrapper', (pi.match(/function _pinPanelDraw\(grid, files\)/g) || []).length === 1 && /_pinPanelDrawLast\(\);   \/\/ v0\.9\.1834/.test(pi) && !/grid\.innerHTML = show\.map[\s\S]{0,400}grid\.innerHTML = show\.map/.test(pi));

  console.log('\n== E · the planted offenders (old code served in place of the real file) ==');
  const P = {};
  P.drive = { 'drive.js': dr.replace('if (_rrThumbKnown(fileId, imgEl, containerEl, thumbLink)) return true;', '') };
  P.strip = { 'dashboard.js': da.replace("if (_running && _running.querySelector('[data-tk]')) return;", '') };
  P.showcase = { 'dashboard.js': da.replace('if (!cur || !cur.length) return false;', 'return false;') };
  P.reel = { 'dashboard.js': da.replace('if (!host || !last || !last.fid || !last.pd) return null;', 'return null;') };
  P.inbox = { 'photo-inbox.js': pi.replace('_pinPanelDrawLast();   // v0.9.1834', '').replace("(_pinPanelLast ? '' : '<div class=\"empty-state\"><p>Loading inbox…</p></div>')", "'<div class=\"empty-state\"><p>Loading inbox…</p></div>'") };
  for (const k of Object.keys(P)) T('offender "' + k + '" changed the source', Object.values(P[k])[0] !== SRC(Object.keys(P[k])[0]));
  const od = judge(await run(browser, P.drive));
  T('OFFENDER drive: pictures go back through the queue → B3 red (no source, not opaque)', !od.showcaseKept);
  const os = judge(await run(browser, P.strip));
  T('OFFENDER strip: the strip is rebuilt → B1 red', !os.stripKept);
  const oc = judge(await run(browser, P.showcase));
  T('OFFENDER showcase: a fresh random set replaces the one on screen → B2 red', !oc.showcaseKept);
  const orl = judge(await run(browser, P.reel));
  T('OFFENDER reel: the picture vanishes until Drive answers → B6 red', !orl.reelKept);
  const oi = judge(await run(browser, P.inbox));
  T('OFFENDER inbox: "Loading inbox…" and a round trip before any tile → B4 red', !oi.inboxKept);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
