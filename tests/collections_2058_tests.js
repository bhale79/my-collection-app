#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COLLECTIONS, THE FOUNDATION + PERMANENT SHELF IDs — v0.9.2058
// (TRR Pro release 4; real Chromium, the REAL app)
//
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Step 3,
// Section 1 + Section 4 "safety rules"); shelf IDs [stated] Brad "yes"
// 2026-10-29 20:06 CT (PLAN_2026-10-29_SHELF_IDS.md). Invisible release: a
// regular customer (only the HOME collection) sees no change.
//
//   G  guards on the source, each PROVED on a planted offender:
//      one writer of the open sheet; the stored copy only through its key
//      function; item photos only through the collection's folder; Contacts
//      only through the home sheet; collections.js loaded where it must be
//   H  home is exactly what it was (same keys, same folder, the plain number)
//   W  the WRONG-COLLECTION suite: two collections with the SAME item numbers —
//      nothing may cross: stored copy, a late read, a save in flight, the
//      outbox, photos, the full ID, the numbers handed out
//   N  numbering checked against the SHEET before and after a new row
//      (two phones, one number) — and a MOVED row keeps its number
//   S  permanent shelf IDs: printed with the ID, found by the ID after a
//      rename, retired never reused, old labels still work, an older app's
//      locations write cannot wipe them, two devices' maps are combined
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_2058_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { pinSource } = require('./lib/pin-source.js');   // the ONE way a test reads the Photo Inbox
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── G · the source guards ──────────────────────────────────────────────────
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}
// G1: who ASSIGNS the open sheet (state.personalSheetId = …)
function sheetWriters(files) {
  const out = [];
  files.forEach(([f, src]) => {
    // ANY object's .personalSheetId (state, an alias of it, window.state…) — and the bracket form
    stripComments(src).split('\n').forEach((l, i) => { if (/\.personalSheetId\s*=(?!=)/.test(l) || /\[['"]personalSheetId['"]\]\s*=(?!=)/.test(l)) out.push(f + ':' + (i + 1)); });
  });
  return out;
}
// G2: the stored copy named by hand
function rawCacheUses(files) {
  const out = [];
  files.forEach(([f, src]) => {
    stripComments(src).split('\n').forEach((l, i) => {
      const m = l.match(/localStorage\.(getItem|setItem|removeItem)\(\s*['"]lv_personal_cache(_ts|_ver)?['"]/);
      if (m) out.push(f + ':' + (i + 1));
    });
  });
  return out;
}
// G3: drive.js — the function bodies that may name driveCache.photosId directly
const PHOTO_ROOT_OK = ['driveKnownFolderIds', '_rrPhotoRoot', '_rrSoldPhotoRoot', 'driveSetupVault', 'driveEnsureSetup'];
function fnBodies(src) {
  const out = [];
  const re = /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex;
    while (i < src.length && depth) { const c = src[i]; if (c === '{') depth++; else if (c === '}') depth--; i++; }
    out.push({ name: m[1], body: src.slice(m.index, i) });
  }
  return out;
}
function photoRootStrays(src) {
  const clean = stripComments(src);
  return fnBodies(clean).filter(f => !PHOTO_ROOT_OK.includes(f.name) && /driveCache\.(photosId|soldPhotosId)\b/.test(f.body)
    && !fnBodies(f.body.slice(1)).some(inner => inner.name !== f.name && /driveCache\.(photosId|soldPhotosId)\b/.test(inner.body) && PHOTO_ROOT_OK.includes(inner.name)))
    .map(f => f.name);
}
function contactStrays(src) { return stripComments(src).split('\n').filter(l => /state\.personalSheetId/.test(l) && !/function _ctSheet|_ctSheet\(\)\s*\{|typeof state !== 'undefined' && state && state\.personalSheetId/.test(l)).length; }

function guards() {
  console.log('\n== G · the source guards ==');
  const files = fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(f => [f, read(f)]);
  const w = sheetWriters(files.filter(([f]) => f !== 'collections.js'));
  T('G1 nothing outside collections.js assigns the open sheet (state.personalSheetId)', w.length === 0, w);
  const own = sheetWriters([['collections.js', read('collections.js')]]);
  T('G1b …collections.js does (rrSetHomeSheet + rrSwitchCollection)', own.length >= 2, own);
  const planted1 = files.map(([f, s]) => f === 'app-data.js' ? [f, s.replace("rrSetHomeSheet(localStorage.getItem('lv_personal_id'), 'load');", "state.personalSheetId = localStorage.getItem('lv_personal_id');")] : [f, s]);
  T('G1c PLANTED: a direct assignment put back in app-data.js → caught', sheetWriters(planted1.filter(([f]) => f !== 'collections.js')).some(x => x.startsWith('app-data.js')));

  const c = rawCacheUses(files.filter(([f]) => f !== 'collections.js'));
  T('G2 the stored copy is never named by hand (always rrPersonalCacheKey)', c.length === 0, c);
  const planted2 = [['wizard-save.js', read('wizard-save.js') + "\nlocalStorage.removeItem('lv_personal_cache');\n"]];
  T('G2b PLANTED: a raw lv_personal_cache removal → caught', rawCacheUses(planted2).length === 1);

  const dr = read('drive.js');
  const strays = photoRootStrays(dr);
  T('G3 item photo paths in drive.js ask _rrPhotoRoot(), never the home folder directly', strays.length === 0, strays);
  const planted3 = dr.replace("const _root = _rrPhotoRoot();\n  if (!_root) return (_driveEraFolderCache = out);", "const _root = driveCache.photosId;\n  if (!_root) return (_driveEraFolderCache = out);");
  T('G3b PLANTED: the era-folder scan back on driveCache.photosId → caught', planted3 !== dr && photoRootStrays(planted3).includes('_driveEraFolders'), photoRootStrays(planted3));

  const ct = read('contacts.js');
  T('G4 Contacts read and write the HOME sheet only (_ctSheet)', contactStrays(ct) === 0 && /rrHomeSheet\(\)/.test(ct), contactStrays(ct));
  T('G4b PLANTED: a Contacts write on state.personalSheetId → caught', contactStrays(ct.replace("sheetsAppend(_ctSheet(),", "sheetsAppend(state.personalSheetId,")) === 1);

  const ix = read('index.html');
  const order = ['app.js', 'collections.js', 'write-outbox.js', 'sheets.js', 'drive.js', 'app-auth.js', 'app-data.js'].map(f => ix.indexOf('src="./' + f + '?'));
  T('G5 index.html loads collections.js right after app.js, before the writers and the loaders', order.every(x => x > 0) && order.every((x, i) => i === 0 || x > order[i - 1]), order);
  T('G5b the offline copy lists it (sw.js) and it is a CORE file', /'\.\/collections\.js'/.test(read('sw.js')) && JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core.includes('app/collections.js'));
  const sh = read('sheets.js');
  T('G6 every sheet write is counted (rrTrackWrites wraps update / append / clear / delete) and drive.js requests + uploads', ['sheetsUpdate', 'sheetsAppend', 'sheetsClear', 'sheetsDeleteRow'].every(n => new RegExp(n + ' = rrTrackWrites\\(' + n + '\\)').test(sh)) && /driveRequest = rrTrackWrites\(driveRequest\)/.test(dr) && /driveUploadFile = rrTrackWrites\(driveUploadFile\)/.test(dr));
  const pin = pinSource();
  T('G7 the offline photo pairing stamps its sheet and is only filed in that collection', /r\.sheetId = \(typeof state/.test(pin) && /kept for its own collection/.test(pin));
  T('G8 the reconnect duplicate check skips rows queued for another collection', /String\(entry\.args\.sheetId\) !== String\(state\.personalSheetId\)\) return false/.test(read('app-data.js')));
  T('G9 the RR_COLLECTIONS words carry no "AI"', !/\bAI\b/.test(JSON.stringify((read('config.js').match(/var RR_COLLECTIONS = \{[\s\S]*?\n\};/) || [''])[0])));
}

// ── the stand-in world: TWO sheets, the SAME inventory numbers ────────────
async function boot(browser) {
  const pg = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(); if (!u.startsWith('file://')) return r.abort(); return r.continue(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    window.accessToken = 'tok'; accessToken = 'tok';
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(String(m)); };
    const F = PERSONAL_FIELD_INDEX, N = PERSONAL_SCHEMA.length;
    const item = (num, inv, x) => { const r = new Array(N).fill(''); r[F.itemNum] = num; r[F.manufacturer] = 'Lionel'; r[F.inventoryId] = String(inv); r[F.condition] = '7'; Object.keys(x || {}).forEach(k => { r[F[k]] = x[k]; }); return r; };
    // HOME and B both have items 44 and 45 — DIFFERENT pieces wearing the same numbers.
    window.__S = {
      HOME: { 'My Collection': [item('2343', 44), item('6464-1', 45)], 'Sold': [], 'For Sale': [], 'Want-Upgrade List': [], 'Contacts': [['C-1', 'Dave (home contact)']] },
      SB:   { 'My Collection': [item('3356', 44), item('736', 45)], 'Sold': [], 'For Sale': [], 'Want-Upgrade List': [], 'Contacts': [['C-9', 'WRONG contact in B']] },
    };
    window.__calls = [];
    window.__delay = {};          // sid -> ms for My Collection reads (a slow read)
    window.__appendDelay = 0;
    window.__drive = { folders: [{ id: 'HOME-ROOT', name: 'My Collection Photos', parents: ['VAULT'] }, { id: 'PB', name: 'Photos', parents: ['B-FOLDER'] }], made: [] };
    const colIdx = L => { let n = 0; for (const ch of String(L)) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const tabOf = r => r.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
    const cols = r => { const m = /!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/.exec(r); return m ? { c0: colIdx(m[1]), r0: Number(m[2] || 3), c1: m[3] ? colIdx(m[3]) : colIdx(m[1]), r1: m[4] ? Number(m[4]) : null } : { c0: 0, r0: 3, c1: 60, r1: null }; };
    const slice = (sid, r) => {
      const t = (window.__S[sid] || {})[tabOf(r)]; if (!t) return null;
      const g = cols(r); const out = [];
      for (let i = g.r0 - 3; i < t.length && (g.r1 == null || i <= g.r1 - 3); i++) out.push((t[i] || []).slice(g.c0, g.c1 + 1));
      return out;
    };
    const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.fetch = async function (url, opts) {
      const u = decodeURIComponent(String(url)); const method = (opts && opts.method) || 'GET';
      if (u.includes('googleapis.com/drive/v3/files') || u.includes('googleapis.com/upload/drive')) {
        window.__calls.push({ drive: true, method, u });
        if (method === 'GET' && /files\?q=/.test(u)) {
          const nm = (/name='([^']+)'/.exec(u) || [])[1];
          const parents = [...u.matchAll(/'([^']+)' in parents/g)].map(m => m[1]);
          const hits = window.__drive.folders.filter(f => (!nm || f.name === nm) && (!parents.length || f.parents.some(p => parents.includes(p))));
          return ok({ files: hits });
        }
        if (method === 'POST') {
          const b = JSON.parse(opts.body || '{}'); const id = 'F' + (window.__drive.folders.length + 1);
          const f = { id, name: b.name, parents: b.parents || [] }; window.__drive.folders.push(f); window.__drive.made.push(f);
          return ok({ id });
        }
        return ok({ id: 'x', trashed: false });
      }
      const sm = /spreadsheets\/([^/?:]+)/.exec(u); const sid = sm ? sm[1] : '';
      if (/\?fields=sheets\.properties/.test(u)) {
        window.__calls.push({ sid, kind: 'tabs' });
        return ok({ sheets: Object.keys(window.__S[sid] || {}).map(t => ({ properties: { title: t } })) });
      }
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => m[1]);
        window.__calls.push({ sid, kind: 'batchGet', ranges });
        if (window.__narrow && ranges.some(r => /Instruction Sheets/.test(r))) return ok({ error: { code: 400, message: 'Range exceeds grid limits' } });
        return ok({ valueRanges: ranges.map(r => ({ range: r, values: slice(sid, r) || [] })) });
      }
      const am = /\/values\/([^?]+):append/.exec(u);
      if (am && method === 'POST') {
        if (window.__appendDelay) await sleep(window.__appendDelay);
        const t = tabOf(am[1]); const body = JSON.parse(opts.body);
        const tab = (window.__S[sid][t] = window.__S[sid][t] || []);
        if (window.__beforeAppend) { try { window.__beforeAppend(sid, t, tab); } catch (e) {} }
        const first = tab.length + 3;
        body.values.forEach(v => tab.push(v.slice()));
        window.__calls.push({ sid, kind: 'append', tab: t, row: first, values: body.values });
        return ok({ updates: { updatedRange: t + '!A' + first + ':ZZ' + (first + body.values.length - 1) } });
      }
      const vm = /\/values\/([^?]+)\?/.exec(u);
      if (vm && method === 'PUT') {
        const r = vm[1]; const body = JSON.parse(opts.body); const g = cols(r); const t = tabOf(r);
        const tab = (window.__S[sid][t] = window.__S[sid][t] || []);
        (body.values || []).forEach((row, k) => { const ri = g.r0 - 3 + k; tab[ri] = tab[ri] || []; row.forEach((v, j) => { tab[ri][g.c0 + j] = v; }); });
        window.__calls.push({ sid, kind: 'put', range: r, values: body.values });
        return ok({ updatedCells: 1 });
      }
      if (vm && method === 'GET') {
        const r = vm[1]; window.__calls.push({ sid, kind: 'get', range: r });
        if (tabOf(r) === 'My Collection' && window.__delay[sid]) await sleep(window.__delay[sid]);
        const v = slice(sid, r);
        return ok(v ? { range: r, values: v } : { error: { message: 'Unable to parse range: ' + r } });
      }
      return ok({});
    };
    // a signed-in home on sheet HOME, photos in HOME-ROOT
    driveCache.vaultId = 'VAULT'; driveCache.photosId = 'HOME-ROOT'; driveCache.soldPhotosId = 'HOME-SOLD'; driveCache._validated = true;
    rrSetHomeSheet('HOME', 'test');
    localStorage.setItem('lv_personal_id', 'HOME');
    window._offlineMode = false;
  });
  return { pg, errs };
}

async function homeRun(browser) {
  console.log('\n== H · home is exactly what it was ==');
  const { pg, errs } = await boot(browser);
  const h = await pg.evaluate(() => {
    const c = rrCurrentCollection();
    return { home: c.home, sid: c.sheetId, live: state.personalSheetId, cache: rrPersonalCacheKey(''), ts: rrPersonalCacheKey('ts'), ver: rrPersonalCacheKey('ver'),
      hwm: rrInvHwmKey(), full: rrFullId('45'), root: rrPhotoRootId(), sold: rrSoldPhotoRootId(), list: rrCollections().length, label: rrCollectionLabel(), remembered: rrRememberedCollectionKey() };
  });
  T('H0 no script error', errs.length === 0, errs);
  T('H1 the open collection is home, on the same sheet', h.home === true && h.sid === 'HOME' && h.live === 'HOME', h);
  T('H2 the stored copy keeps its old names (lv_personal_cache / _ts / _ver) and the watermark lv_inv_hwm', h.cache === 'lv_personal_cache' && h.ts === 'lv_personal_cache_ts' && h.ver === 'lv_personal_cache_ver' && h.hwm === 'lv_inv_hwm', h);
  T('H3 the plain item number (no collection number at home)', h.full === '45' && h.label === '', h);
  T('H4 photos: the same My Collection Photos folder; only one collection listed', h.root === 'HOME-ROOT' && h.sold === 'HOME-SOLD' && h.list === 1 && h.remembered === 'home', h);
  const s = await pg.evaluate(() => { rrSetHomeSheet('HOME2', 'test'); const a = state.personalSheetId; rrSetHomeSheet('HOME', 'test'); return { a, b: state.personalSheetId }; });
  T('H5 rrSetHomeSheet moves the live sheet while home is open', s.a === 'HOME2' && s.b === 'HOME', s);
  const bad = await pg.evaluate(() => {
    const out = [];
    const tryIt = c => { try { rrRegisterCollection(c); out.push('accepted'); } catch (e) { out.push('refused'); } };
    tryIt({ key: 'home', number: 1, sheetId: 'X' });
    tryIt({ key: 'b', number: 0, sheetId: 'X' });
    tryIt({ key: 'b', number: 7, sheetId: 'HOME' });
    tryIt({ key: 'b', number: 7, sheetId: 'SB' });
    tryIt({ key: 'c', number: 7, sheetId: 'SC' });
    tryIt({ key: 'c', number: 8, sheetId: 'SB' });
    return out;
  });
  T('H6 a collection must have its own key, number and sheet (home, 0, the home sheet, a taken number, a listed sheet → refused)', JSON.stringify(bad) === JSON.stringify(['refused', 'refused', 'refused', 'accepted', 'refused', 'refused']), bad);
  await pg.close();
}

async function wrongCollection(browser) {
  console.log('\n== W · two collections, the SAME item numbers — nothing may cross ==');
  const { pg, errs } = await boot(browser);
  const r = await pg.evaluate(async () => {
    const out = {};
    await loadPersonalData();
    await new Promise(r => setTimeout(r, 300));
    const nums = () => Object.values(state.personalData || {}).map(p => p.itemNum + '#' + p.inventoryId).sort().join(',');
    out.home1 = nums();
    out.contacts1 = (state.contactsData || []).map(c => c.name || c.id || JSON.stringify(c)).join('|');
    rrRegisterCollection({ key: 'b', number: 7, name: 'Hale', sheetId: 'SB', photoRootId: 'PB', soldPhotoRootId: 'PB-SOLD' });
    const sw = await rrSwitchCollection('b', { quietMs: 0, repaint: false });
    await new Promise(r => setTimeout(r, 300));
    out.sw = sw;
    out.live = state.personalSheetId;
    out.b1 = nums();
    out.contactsB = (state.contactsData || []).map(c => c.name || c.id || JSON.stringify(c)).join('|');
    out.contactReads = window.__calls.filter(c => c.kind === 'get' && /Contacts/.test(c.range)).map(c => c.sid);
    out.full = rrFullId('45'); out.label = rrCollectionLabel(); out.parse = rrParseFullId('7-45');
    out.cacheKeyB = rrPersonalCacheKey(''); out.hwmB = rrInvHwmKey();
    _cachePersonalData();
    // the label for B's item 45 says 7-45
    const k45 = Object.keys(state.personalData).find(k => state.personalData[k].inventoryId === '45');
    out.labelLines = (rrShelveLabelEntries('items', [k45])[0] || {}).lines;
    // numbers handed out in B use B's watermark; home's is untouched
    localStorage.setItem('lv_inv_hwm', '500');
    out.mintB = nextInventoryId();
    out.hwmHome = localStorage.getItem('lv_inv_hwm'); out.hwmBval = localStorage.getItem('lv_inv_hwm@b');
    // back home
    const back = await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    await new Promise(r => setTimeout(r, 300));
    out.back = back; out.home2 = nums(); out.live2 = state.personalSheetId;
    out.cacheHome = (localStorage.getItem('lv_personal_cache') || '');
    out.cacheB = (localStorage.getItem('lv_personal_cache@b') || '');
    out.mintHome = nextInventoryId();
    return out;
  });
  T('W0 no script error', errs.length === 0, errs);
  T('W1 home shows home\'s pieces', r.home1 === '2343#44,6464-1#45', r.home1);
  T('W2 switching to collection 7 opens ITS sheet and ITS pieces (3356/736 wear 44/45 there)', r.sw.ok && r.live === 'SB' && r.b1 === '3356#44,736#45', r);
  T('W3 Contacts stay the HOME collection\'s (read from HOME, never B)', r.contactReads.length > 0 && r.contactReads.every(s => s === 'HOME') && !/WRONG/.test(r.contactsB), r);
  T('W4 the full ID: 7-45 in collection 7; the label prints #7-45; "7 – Hale"', r.full === '7-45' && JSON.stringify(r.labelLines || []).includes('#7-45') && r.label === '7 \u2013 Hale' && r.parse.number === 7 && r.parse.invId === '45', r);
  T('W5 stored copy and watermark keys are per collection (…@b)', r.cacheKeyB === 'lv_personal_cache@b' && r.hwmB === 'lv_inv_hwm@b', r);
  T('W6 a number handed out in 7 moves 7\'s watermark, never home\'s', r.hwmHome === '500' && r.hwmBval === r.mintB && Number(r.mintB) < 500, r);
  T('W7 back home: home\'s pieces again, home\'s watermark (501)', r.back.ok && r.live2 === 'HOME' && r.home2 === '2343#44,6464-1#45' && r.mintHome === '501', r);
  T('W8 each stored copy holds only its own pieces', /6464-1/.test(r.cacheHome) && !/3356|"736"/.test(r.cacheHome) && /3356/.test(r.cacheB) && !/6464-1/.test(r.cacheB), { h: r.cacheHome.slice(0, 200), b: r.cacheB.slice(0, 200) });

  // a LATE answer: home's read is slow, the collection changes before it lands
  const late = await pg.evaluate(async () => {
    window.__delay.HOME = 900;
    const p = loadPersonalData();                       // cached copy restored, refresh goes out slowly
    window._pdColdRefreshed = false;
    const p2 = _loadPersonalFromSheets('HOME', true);   // the slow read of HOME
    await new Promise(r => setTimeout(r, 50));
    window.__appendDelay = 0;
    const sw = await rrSwitchCollection('b', { quietMs: 0, repaint: false, waitMs: 5000 });
    await p2; await p; await new Promise(r => setTimeout(r, 400));
    window.__delay.HOME = 0;
    return { sw, live: state.personalSheetId, nums: Object.values(state.personalData).map(p => p.itemNum).sort().join(','), cacheB: localStorage.getItem('lv_personal_cache@b') || '' };
  });
  T('W9 a slow read of home that answers AFTER the switch is dropped — collection 7 shows only its own pieces', late.live === 'SB' && late.nums === '3356,736' && !/6464-1/.test(late.cacheB), late);

  // a save in flight: the switch WAITS for it, and it lands on the sheet it started on
  const inflight = await pg.evaluate(async () => {
    const order = [];
    window.__appendDelay = 700;
    const F = PERSONAL_FIELD_INDEX, row = new Array(PERSONAL_SCHEMA.length).fill(''); row[F.itemNum] = '1666'; row[F.inventoryId] = '';
    const save = sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]).then(() => order.push('save done'));
    await new Promise(r => setTimeout(r, 30));
    const sw = rrSwitchCollection('home', { quietMs: 200, repaint: false, waitMs: 5000 }).then(x => { order.push('switch done'); return x; });
    const inFlightNow = rrWritesInFlight();
    const res = await sw; await save;
    window.__appendDelay = 0;
    const ap = window.__calls.filter(c => c.kind === 'append' && c.values && c.values[0] && c.values[0][F.itemNum] === '1666');
    return { order, res, inFlightNow, sid: ap.map(a => a.sid), live: state.personalSheetId };
  });
  T('W10 a switch asked for mid-save WAITS until the write is done', inflight.inFlightNow >= 1 && inflight.order.join('>') === 'save done>switch done' && inflight.res.ok, inflight);
  T('W10b …and the write landed on the sheet it started on (B), not the one opened after', JSON.stringify(inflight.sid) === '["SB"]' && inflight.live === 'HOME', inflight);
  const stuck = await pg.evaluate(async () => {
    window.__appendDelay = 1500;
    const F = PERSONAL_FIELD_INDEX, row = new Array(PERSONAL_SCHEMA.length).fill(''); row[F.itemNum] = '1667';
    const save = sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row]);
    await new Promise(r => setTimeout(r, 30));
    const res = await rrSwitchCollection('b', { quietMs: 100, repaint: false, waitMs: 300 });
    await save; window.__appendDelay = 0;
    return { res, live: state.personalSheetId, toast: (window.__toasts || []).slice(-1)[0], words: RR_COLLECTIONS.words.busy };
  });
  T('W11 a save that outlasts the wait → no switch, the person is told (words from config.js)', stuck.res.ok === false && stuck.res.why === 'busy' && stuck.live === 'HOME' && stuck.toast === stuck.words, stuck);

  // the OUTBOX: a row queued offline in 7 replays to 7's sheet — even though home has the same number at a real row
  const ob = await pg.evaluate(async () => {
    await rrSwitchCollection('b', { quietMs: 0, repaint: false });
    const F = PERSONAL_FIELD_INDEX, row = new Array(PERSONAL_SCHEMA.length).fill(''); row[F.itemNum] = '6017'; row[F.inventoryId] = '45'; row[F.manufacturer] = 'Lionel';
    window._offlineMode = true;
    await sheetsAppend('SB', PERSONAL_TAB + '!A:A', [row]);
    window._offlineMode = false;
    const queued = rrOutboxList().filter(e => e.kind === 'append').map(e => e.args.sheetId);
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    await new Promise(r => setTimeout(r, 300));
    // home's 6464-1 wears 45 at a real row — the old judge would have called B's queued 45 "a duplicate"
    await window._rrOfflineAppendDrain();
    await new Promise(r => setTimeout(r, 800));
    const sent = window.__calls.filter(c => c.kind === 'append' && c.values && c.values[0] && c.values[0][F.itemNum] === '6017');
    return { queued, sent: sent.map(s => s.sid + ':' + s.values[0][F.inventoryId]), left: rrOutboxList().length };
  });
  T('W12 a row queued offline in collection 7 carries 7\'s sheet', JSON.stringify(ob.queued) === '["SB"]', ob);
  T('W12b …replays to 7\'s sheet from home, unchanged (home\'s own 45 does not make it a "duplicate")', JSON.stringify(ob.sent) === '["SB:45"]', ob);

  // the stored copy is never overwritten by the EMPTY lists of a switch that has not loaded yet
  const keep = await pg.evaluate(async () => {
    const before = localStorage.getItem('lv_personal_cache@b') || '';
    await rrSwitchCollection('b', { quietMs: 0, repaint: false, load: false });
    const unloaded = Object.keys(state.personalData || {}).length;
    _cachePersonalData();                        // anything that saves the copy before the load lands
    const after = localStorage.getItem('lv_personal_cache@b') || '';
    await loadPersonalData(); await new Promise(r => setTimeout(r, 300));
    const loaded = Object.values(state.personalData).map(p => p.itemNum).sort().join(',');
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    return { kept: before.length > 50 && after === before, unloaded, loaded };
  });
  T('W15 a switch that has not loaded yet can never save its EMPTY lists over the collection\'s stored copy', keep.kept && keep.unloaded === 0 && keep.loaded === '3356,736', keep);

  await pg.close();
}

async function photosRun(browser) {
  console.log('\n== W · photos: each collection\'s own folder (fresh page) ==');
  const { pg, errs } = await boot(browser);
  // PHOTOS: each collection's own folder, and its own folder cache
  const ph = await pg.evaluate(async () => {
    // a FRESH page: the very first switch of the session is the one that must keep home's cache
    rrRegisterCollection({ key: 'b', number: 7, name: 'Hale', sheetId: 'SB', photoRootId: 'PB', soldPhotoRootId: 'PB-SOLD' });
    driveCache.itemFolders['2343'] = 'HOME-2343';          // home already knows its 2343 folder
    const homeMap = driveCache.itemFolders;
    await rrSwitchCollection('b', { quietMs: 0, repaint: false });
    const before = window.__drive.made.length;
    const fB = await driveEnsureItemFolder('2343', 'pw');
    const made = window.__drive.made.slice(before);
    const rootB = _rrPhotoRoot();
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    const fH = await driveEnsureItemFolder('2343', 'pw');
    const sameMap = driveCache.itemFolders === homeMap;
    // a collection with NO photo folder never files at the top of My Drive
    rrRegisterCollection({ key: 'nofolder', number: 9, name: 'No folder', sheetId: 'SN' });
    window.__S.SN = { 'My Collection': [] };
    await rrSwitchCollection('nofolder', { quietMs: 0, repaint: false, load: false });
    let refused = '';
    try { await driveEnsureItemFolder('999', 'pw'); } catch (e) { refused = e.message; }
    await rrSwitchCollection('home', { quietMs: 0, repaint: false, load: false });
    return { fB, fH, rootB, sameMap, made: made.map(f => f.name + '<' + f.parents.join(',')), refused };
  });
  T('W13 in collection 7, item 2343\'s photos go under 7\'s photo folder — not home\'s 2343 folder', ph.fB !== 'HOME-2343' && ph.rootB === 'PB' && ph.made.length >= 1 && ph.made.every(m => !/HOME-ROOT/.test(m)) && ph.made.some(m => /<PB$/.test(m) || /^2343</.test(m)), ph);
  T('W13b back home, home\'s 2343 folder is used again — home\'s own folder cache comes back (caches are per collection)', ph.fH === 'HOME-2343' && ph.sameMap === true, ph);
  T('W13c a collection with no photo folder refuses — never a folder at the top of My Drive', /Photos folder not ready/.test(ph.refused), ph);
  T('W14 no script error (photos)', errs.length === 0, errs);
  await pg.close();
}

async function numbering(browser) {
  console.log('\n== N · numbers checked against the SHEET (two phones, one number) ==');
  const { pg, errs } = await boot(browser);
  const n = await pg.evaluate(async () => {
    const out = {}; const F = PERSONAL_FIELD_INDEX;
    await loadPersonalData(); await new Promise(r => setTimeout(r, 300));
    const mk = (num, inv) => { const r = new Array(PERSONAL_SCHEMA.length).fill(''); r[F.itemNum] = num; r[F.inventoryId] = inv; r[F.manufacturer] = 'Lionel'; return r; };
    const myCol = () => window.__S.HOME['My Collection'].map(r => r[F.itemNum] + '#' + r[F.inventoryId]);
    // N1: this phone hands out 46 — but the other phone already put 46 on the sheet
    localStorage.setItem('lv_inv_hwm', '45');
    const id1 = nextInventoryId();
    window.__S.HOME['My Collection'].push(mk('2046', '46'));        // the other phone's row
    window.__toasts = [];
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('1666', id1)]);
    out.id1 = id1; out.rows1 = myCol(); out.now1 = rrInvIdNow(id1, 'HOME');
    // the screen follows: the sheet is read again and the piece shows its new number
    state.personalData['46'] = Object.assign({}, state.personalData['46'] || {}, { itemNum: '1666', inventoryId: '46', row: 6, owned: true });   // what the caller wrote locally
    await new Promise(r => setTimeout(r, 2000));
    out.screen1 = Object.values(state.personalData).filter(p => p.itemNum === '1666').map(p => p.inventoryId);
    // N2: clean before, but the other phone's row lands JUST BEFORE ours (an earlier row) → ours moves on
    await new Promise(r => setTimeout(r, 5200));                   // the burst read goes stale
    const id2 = nextInventoryId();
    window.__beforeAppend = function (sid, t, tab) { if (t === 'My Collection') { tab.push(mk('2055', id2)); window.__beforeAppend = null; } };
    window.__toasts = [];
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('2026', id2)]);
    out.id2 = id2; out.rows2 = myCol(); out.toast2 = window.__toasts.slice(-1)[0] || '';
    out.puts2 = window.__calls.filter(c => c.kind === 'put').map(c => c.range + '=' + JSON.stringify(c.values));
    // N3: the OTHER phone's view — its row is the later one; ours (earlier) never moves
    await new Promise(r => setTimeout(r, 5200));
    const id3 = nextInventoryId();
    const putsBefore = window.__calls.filter(c => c.kind === 'put').length;
    window.__afterAppendPush = true;
    const realFetch = window.fetch;
    let pushedLater = false;
    window.fetch = async function (u, o) {
      const res = await realFetch(u, o);
      if (!pushedLater && /:append/.test(decodeURIComponent(String(u)))) { pushedLater = true; window.__S.HOME['My Collection'].push(mk('8888', id3)); }
      return res;
    };
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('2333', id3)]);
    window.fetch = realFetch;
    out.id3 = id3; out.rows3 = myCol(); out.putsN3 = window.__calls.filter(c => c.kind === 'put').length - putsBefore;
    // N4: a MOVED row (a type switch, a returned sale) keeps its number — even though the sheet has it
    await new Promise(r => setTimeout(r, 5200));
    const readsBefore = window.__calls.filter(c => c.kind === 'batchGet').length;
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('2343', '44')]);
    out.rows4 = myCol(); out.reads4 = window.__calls.filter(c => c.kind === 'batchGet').length - readsBefore;
    // N5: offline → no reads, the row is queued exactly as it is
    const id5 = nextInventoryId();
    window._offlineMode = true;
    const rb = window.__calls.filter(c => c.kind === 'batchGet').length;
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('6017', id5)]);
    window._offlineMode = false;
    out.reads5 = window.__calls.filter(c => c.kind === 'batchGet').length - rb;
    out.q5 = rrOutboxList().filter(e => e.kind === 'append').map(e => e.args.values[0][F.inventoryId]).slice(-1)[0];
    out.id5 = id5;
    // N6: a burst of three saves shares its reads (n + 1, not 2n)
    await new Promise(r => setTimeout(r, 5200));
    const rb6 = window.__calls.filter(c => c.kind === 'batchGet').length;
    for (let i = 0; i < 3; i++) await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('B' + i, nextInventoryId())]);
    out.reads6 = window.__calls.filter(c => c.kind === 'batchGet').length - rb6;
    // (44 is the MOVED row of N4 on purpose; the other phone's 8888 in N3 is that phone's to move)
    out.dupes = (() => { const seen = {}, d = []; window.__S.HOME['My Collection'].forEach(r => { if (r[F.itemNum] === '8888') return; const v = r[F.inventoryId]; if (v && seen[v] && v !== '44') d.push(v); seen[v] = 1; }); return d; })();
    // N8: an OLD layout — one tab too narrow for its number column makes Google refuse the whole read;
    // My Collection's numbers are then read alone, and a clash there is still caught
    await new Promise(r => setTimeout(r, 5200));
    window.__S.HOME['Instruction Sheets'] = [];
    window.__narrow = true;
    const id8 = nextInventoryId();
    window.__S.HOME['My Collection'].push(mk('3666', id8));         // the other phone took it
    await sheetsAppend('HOME', PERSONAL_TAB + '!A:A', [mk('3667', id8)]);
    window.__narrow = false;
    out.id8 = id8; out.rows8 = myCol();
    return out;
  });
  T('N0 no script error', errs.length === 0, errs);
  T('N1 a number the other phone already used is NOT written again — the new row takes the next free number', n.id1 === '46' && n.rows1.includes('2046#46') && n.rows1.includes('1666#47') && !n.rows1.includes('1666#46') && n.now1 === '47', n);
  T('N1b …and the screen follows: the sheet is read again, the piece shows #47 (not the old #46)', JSON.stringify(n.screen1) === '["47"]', n.screen1);
  const lastId2 = String(Number(n.id2) + 1);
  T('N2 both phones wrote the same number at once → the NEWER row (ours, later) moves to the next free number', n.rows2.includes('2055#' + n.id2) && n.rows2.some(x => x.startsWith('2026#') && x !== '2026#' + n.id2) && n.puts2.length >= 1, n);
  T('N2b …and the person is told, in the words from config.js', /also used by another device/.test(n.toast2) && n.toast2.includes('#' + n.id2), n.toast2);
  T('N3 when OUR row is the earlier one, ours never moves (the other phone moves its own)', n.rows3.includes('2333#' + n.id3) && n.putsN3 === 0, n);
  T('N4 a MOVED row keeps its number (it was not handed out here) — not even checked', n.rows4.filter(x => x === '2343#44').length === 2 && n.reads4 === 0, n);
  T('N5 offline: no reads, the row is queued with its number as is', n.reads5 === 0 && n.q5 === n.id5, n);
  T('N6 three saves in a row share their reads (4 reads, not 6)', n.reads6 <= 4, n.reads6);
  T('N7 no number appears twice on the sheet after all of it', n.dupes.length === 0, n.dupes);
  T('N8 an old layout (a tab too narrow) still checks My Collection — the clash is caught', n.rows8.includes('3666#' + n.id8) && !n.rows8.includes('3667#' + n.id8) && n.rows8.some(x => x.startsWith('3667#')), n.rows8.slice(-3));
  await pg.close();
}

async function shelfIds(browser) {
  console.log('\n== S · permanent shelf IDs ==');
  const { pg, errs } = await boot(browser);
  const s = await pg.evaluate(() => {
    const out = {};
    localStorage.removeItem('lv_place_ids');
    const P = { loc: 'Garage', spot: 'Shelf 4' };
    out.code1 = rrStickerAppCodePlace(P);
    out.code2 = rrStickerAppCodePlace({ loc: 'garage', spot: 'shelf 4' });
    out.ids = rrPlaceIds();
    out.stamped = !!localStorage.getItem('lv_place_ids__at');
    out.find1 = rrStickerFind(out.code1);
    const id = (out.code1.split(':')[2]) || '';
    out.id = id;
    // rename: the label keeps working, with the NEW name
    out.renamed = rrPlaceIdRename({ loc: 'Garage', spot: 'Shelf 4' }, { loc: 'Garage', spot: 'Top shelf' });
    out.find2 = rrStickerFind(out.code1);
    // a whole location renamed
    rrStickerAppCodePlace({ loc: 'Garage', spot: '' });
    out.renLoc = rrPlaceIdRename({ loc: 'Garage' }, { loc: 'Barn' });
    out.find3 = rrStickerFind(out.code1);
    // a label printed on ANOTHER device whose ID has not synced here: by name
    out.foreign = rrStickerFind('RR2:P:zzzzzz:Basement:Tote%202');
    // an old RR1 label: by name, exactly as before
    out.rr1 = rrStickerFind('RR1:P:Attic:Box%201');
    // removed in Storage Locations → retired, never reused
    rrStickerForgetPlace('Barn', 'Top shelf');
    out.retired = rrPlaceIds()[id];
    out.findRetired = rrStickerFind(out.code1);
    out.code3 = rrStickerAppCodePlace({ loc: 'Barn', spot: 'Top shelf' });
    // an OLDER app rewriting the locations list leaves the IDs alone
    const before = localStorage.getItem('lv_place_ids');
    rrSaveLocations([{ name: 'Barn', type: '', details: ['Top shelf'] }]);
    out.idsKept = localStorage.getItem('lv_place_ids') === before;
    // a printed label is not a blank sticker
    out.printedRefused = rrStickerParseApp(out.code1) !== null;
    return out;
  });
  T('S0 no script error', errs.length === 0, errs);
  T('S1 a shelf label is printed WITH its permanent ID: RR2:P:<id>:Garage:Shelf 4', /^RR2:P:[a-z2-9]{6}:Garage:Shelf%204$/.test(s.code1), s.code1);
  T('S1b the same place (any capitals) keeps the same ID; the ID map is an account setting (stamped)', s.code2.split(':')[2] === s.id && Object.keys(s.ids).length === 1 && s.stamped, s);
  T('S2 scanning it finds Garage › Shelf 4', s.find1 && s.find1.kind === 'place' && s.find1.place.loc === 'Garage' && s.find1.place.spot === 'Shelf 4' && s.find1.placeId === s.id, s.find1);
  T('S3 after a RENAME the old label finds the place by its ID — with the new name', s.renamed === 1 && s.find2.place.spot === 'Top shelf' && s.find2.place.loc === 'Garage', s.find2);
  T('S3b a whole location renamed: its spots move with it', s.renLoc >= 2 && s.find3.place.loc === 'Barn' && s.find3.place.spot === 'Top shelf', s);
  T('S4 a label whose ID this device has not heard of still works by its printed name', s.foreign && s.foreign.place.loc === 'Basement' && s.foreign.place.spot === 'Tote 2', s.foreign);
  T('S5 old RR1 labels work exactly as before', s.rr1 && s.rr1.kind === 'place' && s.rr1.place.loc === 'Attic' && s.rr1.place.spot === 'Box 1', s.rr1);
  T('S6 a removed place\'s ID is RETIRED, kept, and never reused (a new label gets a new ID)', s.retired && s.retired.retired === true && s.code3.split(':')[2] !== s.id, s);
  T('S6b …its old label falls back to the name printed on it', s.findRetired && s.findRetired.place.loc === 'Garage' && s.findRetired.place.spot === 'Shelf 4', s.findRetired);
  T('S7 an older app rewriting the saved-locations list cannot touch the IDs (their own setting)', s.idsKept === true, s);

  const m = await pg.evaluate(() => {
    const A = JSON.stringify({ aaaaaa: { loc: 'Garage', spot: 'Shelf 4', at: 10 } });
    const D = JSON.stringify({ bbbbbb: { loc: 'Attic', spot: '', at: 20 }, aaaaaa: { loc: 'Garage', spot: 'Top shelf', at: 30 } });
    const AL = window.RR_PREF_ALWAYS_UNION;
    const run = always => rrPrefsMerge({ lv_place_ids: D }, { lv_place_ids: '30' }, { lv_place_ids: { v: A, t: 40 } }, 99, {}, {}, always);
    const r = run(AL);
    const merged = JSON.parse(r.apply.lv_place_ids || '{}');
    const pushed = r.push.lv_place_ids ? JSON.parse(r.push.lv_place_ids.v) : null;
    const planted = run({});   // PLANTED: the combine left out → newest-wins
    const plantedMerged = JSON.parse(planted.apply.lv_place_ids || D);
    const ret = JSON.parse(rrPlaceIdsUnion(JSON.stringify({ x: { loc: 'A', spot: '', at: 50 } }), JSON.stringify({ x: { loc: 'A', spot: '', at: 10, retired: true } })));
    const same = rrPrefsMerge({ lv_place_ids: rrPlaceIdsText(JSON.parse(A)) }, { lv_place_ids: '5' }, { lv_place_ids: { v: rrPlaceIdsText(JSON.parse(A)), t: 6 } }, 99, {}, {}, AL);
    return { merged, pushed, plantedKeys: Object.keys(plantedMerged), ret, same };
  });
  T('S8 two devices\' ID maps are COMBINED every time (both ids kept, the newer name wins) and the result pushed', m.merged.aaaaaa && m.merged.bbbbbb && m.merged.aaaaaa.spot === 'Top shelf' && m.pushed && m.pushed.aaaaaa && m.pushed.bbbbbb, m);
  T('S8b PLANTED: without the combine, newest-wins drops one device\'s ID', m.plantedKeys.length === 1, m.plantedKeys);
  T('S9 retired on either device = retired (an ID is never reused); equal maps → nothing written', m.ret.x.retired === true && Object.keys(m.same.push).length === 0 && !m.same.apply.lv_place_ids, m);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await homeRun(browser);
    await wrongCollection(browser);
    await photosRun(browser);
    await numbering(browser);
    await shelfIds(browser);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e.stack || e)); process.exit(1); });
