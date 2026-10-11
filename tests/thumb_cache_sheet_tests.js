#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE REMEMBERED PHOTO LIST BELONGS TO ONE COLLECTION — v0.9.1921
//
// Brad's screenshot (booth demo, 2026-10-10): half the Dashboard photo strip
// read "⚠ 404". dashboard.js remembers each item's first-photo file id in
// localStorage, keyed by INVENTORY ID — and inventory IDs are only unique
// inside one collection sheet. His Chrome had held his own collection; signed
// in again as the demo account (whose items were copied from his, same
// inventory numbers) it showed HIS photos' file ids, which the demo account
// cannot open → 404, forever ("asked once per item ever").
//   A  the list is per collection sheet: sheet B never sees sheet A's ids; a
//      lookup on B lands in B's list and leaves A's alone; the old shared list
//      is dropped once a sheet is known. PLANTED: the old shared key → A's id
//      leaks into B (caught).
//   B  a file id Drive answers 404 / 403 for is forgotten (drive.js →
//      rrThumbForgetFid), so the next draw looks the photo up afresh; a 500
//      is NOT treated as gone. PLANTED: the forget line removed → stays.
//   C  rrThumbBust still writes the list it read.
// Runs the REAL functions, sliced out of app/dashboard.js and app/drive.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }

function fnSrc(src, name) {
  let i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  if (src.slice(i - 6, i) === 'async ') i -= 6;
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  throw new Error(name + ' unbalanced');
}
function world(dashSrc, driveSrc) {
  const store = {};
  const ctx = {
    console, JSON, Object, String, Promise,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    state: { personalSheetId: '' },
    accessToken: 'tok',
    navigator: { onLine: true },
    URL: { createObjectURL: () => 'blob:x' },
    _folderFiles: {},
    driveGetFolderPhotos: async (link) => (ctx._folderFiles[link] || []).map(id => ({ id })),
    rrPhotoFolderFor: async (pd) => pd.photoItem,
    fetchStatus: 200,
  };
  ctx.window = ctx;
  ctx.fetch = async () => ({ ok: ctx.fetchStatus === 200, status: ctx.fetchStatus, blob: async () => ({}) });
  vm.createContext(ctx);
  ['_thumbFidKey', '_thumbFids', 'rrThumbForgetFid', 'rrThumbBust', '_thumbFor'].forEach(n => {
    if (n === '_thumbFidKey' && dashSrc.indexOf('function _thumbFidKey(') < 0) return;   // the planted old version has none
    if (n === 'rrThumbForgetFid' && dashSrc.indexOf('function rrThumbForgetFid(') < 0) return;
    vm.runInContext(fnSrc(dashSrc, n) + '; window.' + n + ' = ' + n + ';', ctx);
  });
  vm.runInContext('var _blobCache = {};' + fnSrc(driveSrc, '_loadDriveThumbFull') + '; window._loadDriveThumbFull = _loadDriveThumbFull;', ctx);
  return { ctx, store };
}

(async () => {
  const dash = fs.readFileSync(path.join(APP, 'dashboard.js'), 'utf8');
  const drive = fs.readFileSync(path.join(APP, 'drive.js'), 'utf8');

  // ── A ────────────────────────────────────────────────────────────────────
  async function runA(dashSrc) {
    const { ctx, store } = world(dashSrc, drive);
    ctx.state.personalSheetId = 'SHEET-A';
    ctx._folderFiles['fold-A'] = ['fid-A'];
    ctx._folderFiles['fold-B'] = ['fid-B'];
    store['lv_thumb_fids'] = JSON.stringify({ '999': 'stale-shared' });       // a pre-v1921 shared list
    const a = await ctx._thumbFor({ inventoryId: '86', photoItem: 'fold-A' });
    // sign in as another account: a different collection sheet, same inventory number
    ctx.state.personalSheetId = 'SHEET-B';
    const seenOnB = ctx._thumbFids()['86'];
    const b = await ctx._thumbFor({ inventoryId: '86', photoItem: 'fold-B' });
    ctx.state.personalSheetId = 'SHEET-A';
    const backOnA = ctx._thumbFids()['86'];
    return { a, seenOnB, b, backOnA, keys: Object.keys(store).sort(), sharedGone: !('lv_thumb_fids' in store) };
  }
  let r = await runA(dash);
  T('A1 sheet A resolves and remembers its own photo', r.a === 'fid-A', r);
  T('A2 sheet B does NOT see sheet A\'s file id for the same inventory number', r.seenOnB === undefined, r);
  T('A3 sheet B looks it up and gets its own photo', r.b === 'fid-B', r);
  T('A4 sheet A\'s list is untouched by B\'s lookup', r.backOnA === 'fid-A', r);
  T('A5 each sheet keeps its own stored list', r.keys.includes('lv_thumb_fids:SHEET-A') && r.keys.includes('lv_thumb_fids:SHEET-B'), r.keys);
  T('A6 the old shared list is dropped once a sheet is known', r.sharedGone, r.keys);
  const planted = dash.replace(fnSrc(dash, '_thumbFids'), "function _thumbFids() {\n  if (!window._thumbFidCache) {\n    try { window._thumbFidCache = JSON.parse(localStorage.getItem('lv_thumb_fids') || '{}'); } catch (e) { window._thumbFidCache = {}; }\n  }\n  return window._thumbFidCache;\n}");
  if (planted === dash) throw new Error('could not plant the old _thumbFids');
  r = await runA(planted);
  T('A7 PLANTED: the old shared list leaks sheet A\'s id into sheet B', r.seenOnB === 'fid-A', r);

  // ── B ────────────────────────────────────────────────────────────────────
  async function runB(driveSrc, status) {
    const { ctx, store } = world(dash, driveSrc);
    ctx.state.personalSheetId = 'SHEET-B';
    store['lv_thumb_fids:SHEET-B'] = JSON.stringify({ '86': 'dead-fid', '87': 'dead-fid', '88': 'good' });
    ctx.fetchStatus = status;
    const el = { innerHTML: '' }, img = {};
    await ctx._loadDriveThumbFull('dead-fid', img, el);
    return { list: JSON.parse(store['lv_thumb_fids:SHEET-B']), shown: el.innerHTML };
  }
  r = await runB(drive, 404);
  T('B1 a 404 forgets every item pointing at that file id', r.list['86'] === undefined && r.list['87'] === undefined && r.list['88'] === 'good', r);
  T('B2 …and still shows the marker this once', /⚠ 404/.test(r.shown), r.shown);
  r = await runB(drive, 403);
  T('B3 a 403 (this account cannot see it) is forgotten too', r.list['86'] === undefined, r);
  r = await runB(drive, 500);
  T('B4 a 500 (Drive hiccup) is NOT treated as gone', r.list['86'] === 'dead-fid', r);
  const plantedDrive = drive.replace("if ((res.status === 404 || res.status === 403) && typeof window.rrThumbForgetFid === 'function') window.rrThumbForgetFid(fileId);", '');
  if (plantedDrive === drive) throw new Error('could not plant drive.js');
  r = await runB(plantedDrive, 404);
  T('B5 PLANTED: without the forget line the dead id stays', r.list['86'] === 'dead-fid', r);

  // ── C ────────────────────────────────────────────────────────────────────
  {
    const { ctx, store } = world(dash, drive);
    ctx.state.personalSheetId = 'SHEET-C';
    store['lv_thumb_fids:SHEET-C'] = JSON.stringify({ '1': 'a', '2': 'b' });
    ctx.rrThumbBust({ inventoryId: '1' });
    T('C1 rrThumbBust writes the same per-sheet list it read', JSON.stringify(JSON.parse(store['lv_thumb_fids:SHEET-C'])) === '{"2":"b"}', store);
  }

  console.log('\nthumb_cache_sheet_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
