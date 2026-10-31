#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MOVING ITEMS, LABELS THAT FOLLOW, THE PHOTO INBOX TAG — v0.9.2077
// (TRR Pro release 6; real Chromium, the REAL app, a stand-in Drive + Sheets)
//
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md Sections 1,
// 4, 5); plan PLAN_2026-10-30_TRR_PRO_R6.md; [stated] Brad 2026-10-30 22:03 CT
// "yes but with a confirmation pop up" (the inbox switch), 22:05 CT "yes".
//   G  source guards, each PROVED on a planted offender
//   M  a move: the group goes together, new numbers in the new collection,
//      the old rows marked (never deleted), photos MOVED (same Drive ID) and
//      renamed, a Movement Log line on each side, a backup first, the record
//      cleared; the other copy with the same item number never touched
//   S  For Sale: the listing goes along; For Sale off there → asked first
//   W  the WRONG-collection case: both collections hold the SAME inventory
//      numbers — nothing crosses
//   X  a failure planted at EVERY step → Finish completes it, nothing doubled
//   L  labels: another collection's label → "switch?"; a moved copy's label →
//      where it went (Open it / Print a new label); unknown → refused
//   I  the Photo Inbox: tagged at the one upload door (offline too), badge,
//      filter, bulk retag, the switch-first pop-up, no tag → asks, one
//      collection only → never asks
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_move_2077_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1200))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
const TRANSFER_READERS = ['app-data.js', 'collections-move.js', 'scan-shelve.js', 'app.js'];
function transferReaders(files) {
  return files.filter(([f, s]) => /\.transferredTo\b|transferredTo\s*\]|'transferredTo'/.test(stripComments(s)) && !TRANSFER_READERS.includes(f)).map(([f]) => f);
}
function inboxUploadsElsewhere(files) {
  // a Photo Inbox piece that uploads to Drive itself instead of through driveUploadFile
  return files.filter(([f, s]) => /^photo-inbox/.test(f) && /upload\/drive\/v3\/files/.test(stripComments(s))).map(([f]) => f);
}
function moveDeletesRows(src) {
  const s = stripComments(src);
  return /sheetsDeleteRow\s*\(/.test(s) || /rrRemoveRowConfirmed\([^)]*PERSONAL_TAB/.test(s) || /rrRemoveRowConfirmed\([^)]*'My Collection'/.test(s);
}
function guards() {
  console.log('\n== G · source guards ==');
  const all = fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(f => [f, read(f)]);
  const tr = transferReaders(all);
  T('G1 "Transferred To" is decided in ONE place — THE row reader (plus the mover that writes it and the label that forwards)', tr.length === 0, tr);
  T('G1b PLANTED: browse.js reading pd.transferredTo → caught', transferReaders([['browse.js', read('browse.js') + '\nif (pd.transferredTo) {}']]).length === 1);
  const data = read('app-data.js');
  T('G1c the reader keeps a moved row OUT of personalData (aside in transferredData)', /if \(String\(_rec\.transferredTo \|\| ''\)\.trim\(\)\) \{[^}]*newTransferred\[key\] = _rec; return; \}/.test(data) && /state\.transferredData = newTransferred;/.test(data));
  const up = inboxUploadsElsewhere(all);
  T('G2 every Photo Inbox upload goes through driveUploadFile — the ONE door that stamps the collection', up.length === 0, up);
  T('G2b PLANTED: an inbox piece posting to Drive itself → caught', inboxUploadsElsewhere([['photo-inbox-grid.js', 'fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")']]).length === 1);
  const drive = read('drive.js');
  T('G2c driveUploadFile stamps an INBOX photo with the open collection (unless it brings its own)', /if \(\/\^INBOX \/\.test\(String\(name \|\| ''\)\) && typeof rrInboxUploadTag === 'function'\)/.test(drive) && /if \(!_ap\.rrColl\)/.test(drive));
  const mv = read('collections-move.js');
  T('G3 a move never deletes or blanks a My Collection row (the old row is MARKED)', !moveDeletesRows(mv));
  T('G3b PLANTED: a move that deletes the old row → caught', moveDeletesRows(mv + "\nsheetsDeleteRow(m.fromSheet, PERSONAL_TAB, 5);"));
  const cfg = read('config.js');
  const steps = (cfg.match(/steps: \[([^\]]*)\]/) || [])[1] || '';
  const order = steps.split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  T('G4 the engine has a step for each step in RR_COLL_MOVE.steps, in that order', order.join(',') === 'start,added,checked,photos,marked,logged' && order.every(k => new RegExp('\\n    ' + k + ': async function').test(mv)), order);
  const ix = read('index.html');
  const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core;
  const sw = read('sw.js');
  const lastInboxPiece = ix.indexOf('./photo-inbox-' + 'offline.js');   // (index.html's script order — the inbox pieces themselves are read through pin-source)
  T('G5 collections-move.js + collections-inbox.js are loaded, offline, CORE; the inbox one AFTER every inbox piece', ['collections-move.js', 'collections-inbox.js'].every(f => ix.includes('src="./' + f + '?v=') && sw.includes("'./" + f + "'") && core.includes('app/' + f)) && lastInboxPiece > 0 && ix.indexOf('collections-inbox.js') > lastInboxPiece);
  const words = stripComments(mv) + stripComments(read('collections-inbox.js'));
  T('G6 every word in RR_COLL_MOVE (config.js); none says "AI"; no typed toast', !/toast\('[A-Z]/.test(words) && !/showToast\('[A-Z]/.test(words) && !/\bAI\b/.test((cfg.match(/var RR_COLL_MOVE = \{[\s\S]*?\n\};/) || [''])[0]));
  T('G7 Move and Finish are one-tap (rrOnce)', (mv.match(/rrOnce\('rr-coll-move'/g) || []).length >= 2);
  T('G8 a move HOLDS switching for its whole length', /rrHoldSwitch\(true\)/.test(mv) && /rrHoldSwitch\(false\)/.test(mv) && /if \(_holds > 0\) return false;/.test(read('collections.js')));
}

// ── the stand-in world ─────────────────────────────────────────────────────
async function boot(browser, opts) {
  opts = opts || {};
  const pg = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(); if (!u.startsWith('file://')) return r.abort(); return r.continue(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate((o) => {
    window.accessToken = 'tok'; accessToken = 'tok';
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(String(m)); };
    window.__confirms = [];
    window.appConfirm = async function (msg) { window.__confirms.push(String(msg)); return window.__confirmAnswer !== false; };
    state.user = { name: 'Biz', email: 'shop@example.test' };
    window._subState = { sub: true, features: o.off ? [] : ['collections', 'scan_shelve'] };
    const F = PERSONAL_FIELD_INDEX, N = PERSONAL_SCHEMA.length;
    const item = (num, inv, x) => { const r = new Array(N).fill(''); r[F.itemNum] = num; r[F.manufacturer] = 'Lionel'; r[F.inventoryId] = String(inv); r[F.era] = 'pw'; Object.keys(x || {}).forEach(k => { r[F[k]] = x[k]; }); return r; };
    window.__item = item;
    const hdr = (t) => [[t], PERSONAL_HEADERS.slice()];
    // Sheets: rows from row 1 (two header rows), per sheet, per tab
    window.__S = {
      HOME: { 'My Collection': hdr('My Collection').concat([item('1666', 3)]), 'For Sale': [['For Sale'], []], 'Sold': [['Sold'], []], 'Want-Upgrade List': [['W'], []], 'Contacts': [['C'], ['h']] },
      S7: { 'My Collection': hdr('My Collection').concat([
              item('2343', 45, { groupId: 'GRP-2343-1', photoItem: 'https://drive.google.com/drive/folders/F45', location: 'Garage', stickerCode: 'RR1:I:old:45' }),
              item('2343-BOX', 46, { groupId: 'GRP-2343-1', photoItem: 'https://drive.google.com/drive/folders/F46' }),
              item('6464-1', 47),
              item('6464-1', 48),
            ]),
            'For Sale': [['For Sale'], ['h'], ['6464-1', '1', '7', '25', '2026-10-01', '', '', '', '47', 'Lionel']],
            'Sold': [['Sold'], []], 'Want-Upgrade List': [['W'], []] },
      S8: { 'My Collection': hdr('My Collection').concat([item('2343', 45), item('3656', 12)]), 'For Sale': [['For Sale'], ['h']], 'Sold': [['Sold'], []], 'Want-Upgrade List': [['W'], []] },
      S9: { 'My Collection': hdr('My Collection').concat([item('9999', 2)]), 'For Sale': [['For Sale'], ['h']], 'Sold': [['Sold'], []], 'Want-Upgrade List': [['W'], []] },
    };
    window.__files = {};
    window.__calls = [];
    window.__fail = [];   // [{ re, method, times }] — a planted failure
    let n = 0; const nid = p => p + (++n);
    const add = f => { window.__files[f.id] = f; return f; };
    add({ id: 'VAULT', name: 'The Rail Roster', parents: ['root'], mime: 'folder' });
    add({ id: 'HOME-ROOT', name: 'My Collection Photos', parents: ['VAULT'], mime: 'folder' });
    ['P7', 'P8', 'P9'].forEach(p => add({ id: p, name: 'Photos', parents: ['F' + p], mime: 'folder' }));
    add({ id: 'P7-PW', name: 'Lionel Postwar', parents: ['P7'], mime: 'folder' });
    add({ id: 'P7-2343', name: '2343', parents: ['P7-PW'], mime: 'folder' });
    add({ id: 'F45', name: '45', parents: ['P7-2343'], mime: 'folder' });
    add({ id: 'IMG45', name: 'Lionel 2343 ID45 RSV.jpg', parents: ['F45'], mime: 'image' });
    add({ id: 'F46', name: '46', parents: ['P7-2343'], mime: 'folder' });
    add({ id: 'INBOXF', name: 'Photo Inbox', parents: ['VAULT'], mime: 'folder' });
    const list = { v: 1, next: 10, items: {
      c7: { key: 'c7', number: 7, name: 'Hale', status: 'active', sheetId: 'S7', photoRootId: 'P7', soldPhotoRootId: 'SP7', folderId: 'FP7', lists: { want: false, parts: false, forSale: true, sold: true }, createdAt: 1, lastOpenedAt: 3 },
      c8: { key: 'c8', number: 8, name: 'Smith', status: 'active', sheetId: 'S8', photoRootId: 'P8', soldPhotoRootId: 'SP8', folderId: 'FP8', lists: { forSale: true, sold: true }, createdAt: 2, lastOpenedAt: 2 },
      c9: { key: 'c9', number: 9, name: 'Jones', status: 'active', sheetId: 'S9', photoRootId: 'P9', soldPhotoRootId: 'SP9', folderId: 'FP9', lists: { want: false, parts: false, forSale: false, sold: false }, createdAt: 3, lastOpenedAt: 1 },
    } };
    if (!o.onlyHome) add({ id: 'LIST', name: 'rail-roster-collections.json', parents: ['VAULT'], mime: 'json', content: JSON.stringify(list) });
    const okR = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    const bad = (s, b) => ({ ok: false, status: s, json: async () => b, text: async () => JSON.stringify(b) });
    // A1 ranges
    const colIdx = L => { let x = 0; for (const ch of L) x = x * 26 + (ch.charCodeAt(0) - 64); return x - 1; };
    const parse = rg => {
      const i = rg.lastIndexOf('!'); const tab = rg.slice(0, i).replace(/^'|'$/g, '').replace(/''/g, "'"); const a = rg.slice(i + 1);
      const m = /^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(a);
      return { tab, c0: colIdx(m[1]), r0: m[2] ? +m[2] : 1, c1: m[3] ? colIdx(m[3]) : colIdx(m[1]), r1: m[4] ? +m[4] : (m[3] ? Infinity : (m[2] ? +m[2] : Infinity)) };
    };
    const getVals = (sid, rg) => {
      const p = parse(rg); const t = (window.__S[sid] || {})[p.tab];
      if (!t) return null;
      const out = [];
      for (let r = p.r0; r <= Math.min(p.r1, t.length); r++) {
        const row = (t[r - 1] || []).slice(p.c0, p.c1 + 1);
        while (row.length && (row[row.length - 1] === '' || row[row.length - 1] == null)) row.pop();
        out.push(row);
      }
      while (out.length && !out[out.length - 1].length) out.pop();
      return out;
    };
    const putVals = (sid, rg, vals) => {
      const p = parse(rg); const t = (window.__S[sid] = window.__S[sid] || {})[p.tab] || (window.__S[sid][p.tab] = []);
      vals.forEach((row, i) => { const r = p.r0 - 1 + i; t[r] = t[r] || []; row.forEach((v, j) => { t[r][p.c0 + j] = v; }); });
    };
    const failNow = (u, method) => {
      for (const f of window.__fail) if (f.times > 0 && f.re.test(u) && (!f.method || f.method === method)) { f.times--; return true; }
      return false;
    };
    window.fetch = async function (url, opts) {
      const u = decodeURIComponent(String(url)); const method = (opts && opts.method) || 'GET';
      if (failNow(u, method)) { window.__calls.push({ kind: 'planted', u, method }); throw new TypeError('Failed to fetch'); }
      if (u.includes('googleapis.com/upload/drive/v3/files')) {
        const m = /files\/([^?]+)\?uploadType=media/.exec(u);
        if (m && method === 'PATCH') {
          const f = window.__files[m[1]]; if (!f) return bad(404, {});
          let body = opts.body; if (body && typeof body.text === 'function') body = await body.text();
          f.content = String(body); window.__calls.push({ kind: 'listWrite' });
          return okR({ id: f.id });
        }
        if (/uploadType=multipart/.test(u) && method === 'POST') {
          const meta = JSON.parse(await opts.body.get('metadata').text());
          const content = await opts.body.get('file').text();
          const f = add({ id: nid('FILE'), name: meta.name, parents: meta.parents || [], content, mime: /^INBOX/.test(meta.name) ? 'image' : 'json', appProperties: meta.appProperties || null });
          window.__calls.push({ kind: 'upload', name: meta.name, ap: meta.appProperties || null });
          return okR({ id: f.id, name: f.name });
        }
        return okR({});
      }
      if (u.includes('googleapis.com/drive/v3/files')) {
        const fm = /\/files\/([^?/]+)(\?|\/|$)/.exec(u);
        if (method === 'POST' && /\/files\/[^/?]+\/copy/.test(u)) {
          const b = JSON.parse(opts.body || '{}'); const f = add({ id: nid('BACKUP'), name: b.name, parents: b.parents || [], mime: 'sheet' });
          window.__calls.push({ kind: 'backup', of: fm[1], name: b.name });
          return okR({ id: f.id, name: f.name });
        }
        if (method === 'GET' && /files\?q=/.test(u)) {
          const nm = (/name='([^']+)'/.exec(u) || [])[1];
          const parents = [...u.matchAll(/'([^']+)' in parents/g)].map(m => m[1]);
          const folderOnly = /mimeType='application\/vnd.google-apps.folder'/.test(u);
          const imgOnly = /mimeType contains 'image\/'/.test(u);
          const hits = Object.values(window.__files).filter(f => !f.trashed && (!nm || f.name === nm) && (!parents.length || (f.parents || []).some(p => parents.includes(p)))
            && (!folderOnly || f.mime === 'folder') && (!imgOnly || f.mime === 'image'));
          return okR({ files: hits.map(f => ({ id: f.id, name: f.name, parents: f.parents, appProperties: f.appProperties || undefined, createdTime: '2026-10-30T10:00:00Z' })) });
        }
        if (method === 'GET' && fm && /alt=media/.test(u)) {
          const f = window.__files[fm[1]]; window.__calls.push({ kind: 'listRead' });
          return f ? okR(JSON.parse(f.content || '{}')) : bad(404, {});
        }
        if (method === 'GET' && fm) { const f = window.__files[fm[1]]; return okR(f ? { id: f.id, name: f.name, parents: f.parents, mimeType: f.mime, trashed: !!f.trashed } : { id: fm[1], trashed: false }); }
        if (method === 'POST' && /\/files(\?|$)/.test(u)) {
          const b = JSON.parse(opts.body || '{}');
          const f = add({ id: nid('FOLDER'), name: b.name, parents: b.parents || [], mime: b.mimeType && /folder/.test(b.mimeType) ? 'folder' : 'file' });
          window.__calls.push({ kind: 'folderMade', name: b.name, parent: (b.parents || [])[0] });
          return okR({ id: f.id });
        }
        if (method === 'PATCH' && fm) {
          const f = window.__files[fm[1]] || add({ id: fm[1], name: '', parents: [] });
          const b = opts.body ? JSON.parse(opts.body) : {};
          if (b.name) f.name = b.name;
          if (b.appProperties) { f.appProperties = Object.assign({}, f.appProperties || {}, b.appProperties); Object.keys(f.appProperties).forEach(k => { if (f.appProperties[k] == null) delete f.appProperties[k]; }); }
          const ap = /addParents=([^&]+)/.exec(u), rp = /removeParents=([^&]+)/.exec(u);
          if (ap) f.parents = (f.parents || []).filter(p => !(rp && rp[1].split(',').includes(p))).concat([ap[1]]);
          window.__calls.push({ kind: 'drivePatch', id: f.id, name: b.name, move: ap ? ap[1] : '' });
          return okR({ id: f.id });
        }
        return okR({});
      }
      // Sheets
      const sm = /spreadsheets\/([^/?:]+)/.exec(u); const sid = sm ? sm[1] : '';
      if (/\?fields=sheets\.properties/.test(u)) return okR({ sheets: Object.keys(window.__S[sid] || {}).map((t, i) => ({ properties: { title: t, sheetId: i, gridProperties: { columnCount: 200, rowCount: 1000 } } })) });
      if (/:batchUpdate/.test(u) && method === 'POST') {
        const b = JSON.parse(opts.body || '{}');
        (b.requests || []).forEach(r => { if (r.addSheet) { window.__S[sid] = window.__S[sid] || {}; window.__S[sid][r.addSheet.properties.title] = []; window.__calls.push({ kind: 'addTab', sid, title: r.addSheet.properties.title }); } });
        return okR({ replies: [] });
      }
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => m[1]);
        window.__calls.push({ kind: 'batchGet', sid, ranges });
        return okR({ valueRanges: ranges.map(r => ({ range: r, values: getVals(sid, r) || [] })) });
      }
      const am = /\/values\/([^?]+):append/.exec(u);
      if (am && method === 'POST') {
        const p = parse(am[1]); const t = (window.__S[sid] = window.__S[sid] || {})[p.tab] || (window.__S[sid][p.tab] = []);
        while (t.length < 2) t.push([]);
        const b = JSON.parse(opts.body || '{}'); const first = t.length + 1;
        (b.values || []).forEach(r => t.push(r.map(v => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v)));
        window.__calls.push({ kind: 'append', sid, tab: p.tab, n: (b.values || []).length });
        return okR({ updates: { updatedRange: "'" + p.tab + "'!A" + first + ':Z' + (first + (b.values || []).length - 1) } });
      }
      if (/\/values\/[^?]+:clear/.test(u)) return okR({});
      const vm = /\/values\/([^?]+)/.exec(u);
      if (vm && method === 'PUT') {
        const b = JSON.parse(opts.body || '{}');
        putVals(sid, vm[1], (b.values || []).map(r => r.map(v => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v)));
        window.__calls.push({ kind: 'put', sid, range: vm[1] });
        return okR({ updatedCells: 1 });
      }
      if (vm && method === 'GET') {
        const v = getVals(sid, vm[1]);
        if (!v) return okR({ error: { message: 'Unable to parse range: ' + vm[1] } });
        return okR({ range: vm[1], values: v });
      }
      return okR({});
    };
    driveCache.vaultId = 'VAULT'; driveCache.photosId = 'HOME-ROOT'; driveCache.soldPhotosId = 'HOME-SOLD'; driveCache._validated = true;
    try { localStorage.setItem('rr_inbox_fid', 'INBOXF'); } catch (e) {}
    rrSetHomeSheet('HOME', 'test'); localStorage.setItem('lv_personal_id', 'HOME');
    window._offlineMode = false;
  }, opts);
  return { pg, errs };
}
// open Hale (S7) with its items loaded
async function openHale(pg) {
  return pg.evaluate(async () => {
    await rrCollectionsLoad();
    const r = await rrSwitchCollection('c7', { quietMs: 0, repaint: false });
    return { r, n: Object.keys(state.personalData).length, live: state.personalSheetId };
  });
}

async function moveRun(browser) {
  console.log('\n== M · a move (Hale → Smith) ==');
  const { pg, errs } = await boot(browser);
  const o = await openHale(pg);
  T('M0 Hale opens with its 4 copies', o.r.ok && o.n === 4 && o.live === 'S7', o);
  const m = await pg.evaluate(async () => {
    const key45 = Object.keys(state.personalData).find(k => state.personalData[k].inventoryId === '45');
    const btn = rrMoveBtnHtml(state.personalData[key45]);
    const gathered = rrMoveGather([key45]).map(k => state.personalData[k].inventoryId);
    window.__toasts = [];
    rrMoveOpen([key45]);
    const box = document.getElementById('rr-move-box');
    const boxText = box ? box.textContent : '';
    document.querySelector('input[name="rr-move-to"][value="c8"]').checked = true;
    const go = document.getElementById('rr-move-go');
    const p1 = rrMoveGo(go), p2 = rrMoveGo(go);   // a double tap
    const r = await p1; await p2;
    const S7 = window.__S.S7['My Collection'], S8 = window.__S.S8['My Collection'];
    const F = PERSONAL_FIELD_INDEX;
    const list = JSON.parse(window.__files.LIST.content);
    return {
      btn: /detail-move-item/.test(btn), gathered, boxText, ok: r && r.ok,
      s7rows: S7.length, s7: S7.slice(2).map(x => [x[F.itemNum], x[F.inventoryId], x[F.transferredTo] || '']),
      s8: S8.slice(2).map(x => [x[F.itemNum], x[F.inventoryId], x[F.transferredFrom] || '', x[F.location] || '', x[F.stickerCode] || '', x[F.groupId] || '']),
      pdLeft: Object.values(state.personalData).map(p => p.inventoryId).sort(),
      moved: Object.values(state.transferredData || {}).map(p => p.inventoryId).sort(),
      folder45: window.__files.F45 && { name: window.__files.F45.name, parent: window.__files.F45.parents },
      folder46: window.__files.F46 && { name: window.__files.F46.name, parent: window.__files.F46.parents },
      img: window.__files.IMG45.name, imgParent: window.__files.IMG45.parents,
      log7: (window.__S.S7['Movement Log'] || []).slice(2), log8: (window.__S.S8['Movement Log'] || []).slice(2),
      backups: window.__calls.filter(c => c.kind === 'backup').map(c => c.of + ':' + c.name),
      backupBeforeAdd: (function () { const i = window.__calls.findIndex(c => c.kind === 'backup' && c.of === 'S7' && /before-move/.test(c.name)); const j = window.__calls.findIndex(c => c.kind === 'append' && c.sid === 'S8'); return i >= 0 && j > i; })(),
      appends8: window.__calls.filter(c => c.kind === 'append' && c.sid === 'S8' && c.tab === 'My Collection').length,
      moves: Object.keys(list.moves || {}).length, toast: window.__toasts.slice(-1)[0] || '',
      parentPath: (function () { const f = window.__files.F45; const p1 = window.__files[f.parents[0]]; const p2 = p1 && window.__files[p1.parents[0]]; return [p1 && p1.name, p2 && p2.name, p2 && p2.parents[0]]; })(),
    };
  });
  T('M1 the item page has "Move to another collection…"', m.btn, m);
  T('M2 the whole group goes together (2343 and its box)', JSON.stringify(m.gathered.sort()) === '["45","46"]' && /2 pieces go together/.test(m.boxText), m);
  T('M3 a double tap moves ONCE: two rows added to Smith, in one append', m.ok && m.appends8 === 1 && m.s8.length === 4, m);
  T('M4 W · Smith already has its own No. 45 — the moved copies get NEW numbers above Smith\'s highest (46, 47); Smith\'s 45 untouched', m.s8[0][1] === '45' && m.s8[0][2] === '' && m.s8[2][1] === '46' && m.s8[3][1] === '47', m.s8);
  T('M5 the new rows say where they came from (with the move\'s tag), keep their place + group, the old app-printed sticker code cleared', /^From 7 – Hale as 7-45 on \d{4}-\d{2}-\d{2} \[m:mv[a-z0-9]+:45\]$/.test(m.s8[2][2]) && m.s8[2][3] === 'Garage' && m.s8[2][4] === '' && m.s8[2][5] === 'GRP-2343-1', m.s8);
  T('M6 the old rows are NOT deleted — still 6 rows on Hale\'s sheet — they say where they went; 6464 No. 47 and 48 untouched', m.s7rows === 6 && /^To 8 – Smith as 8-46 on \d{4}-\d{2}-\d{2} \[m:mv[a-z0-9]+:45\]$/.test(m.s7[0][2]) && /as 8-47 on/.test(m.s7[1][2]) && m.s7[2][2] === '' && m.s7[3][2] === '', m.s7);
  T('M7 they leave every list here at once (aside, so an old label can forward)', JSON.stringify(m.pdLeft) === '["47","48"]' && JSON.stringify(m.moved) === '["45","46"]', m);
  T('M8 the photo folders MOVED (same Drive ID) into Smith\'s Photos › Lionel Postwar › 2343, renamed to the new number; the photo inside renamed too', m.folder45.name === '46' && m.folder46.name === '47' && m.parentPath[0] === '2343' && m.parentPath[1] === 'Lionel Postwar' && m.parentPath[2] === 'P8' && m.img === 'Lionel 2343 ID46 RSV.jpg' && m.imgParent[0] === 'F45', m);
  T('M9 one Movement Log line on EACH side per copy', m.log7.length === 2 && m.log8.length === 2 && /7 – Hale \(7-45\)/.test(m.log7[0][4]) && /8 – Smith \(8-46\)/.test(m.log7[0][5]) && String(m.log8[0][1]) === '46', { log7: m.log7, log8: m.log8 });
  T('M10 Hale\'s sheet was backed up ("before-move") BEFORE anything was added anywhere', m.backupBeforeAdd, m.backups);
  T('M11 the move record is cleared; the person told the new numbers', m.moves === 0 && /Moved 2 to 8 – Smith \(now 8-46, 8-47\)/.test(m.toast), m);
  T('M12 no script error', errs.length === 0, errs);

  // reload Hale from the sheet: the moved rows stay hidden
  const re = await pg.evaluate(async () => {
    await _loadPersonalFromSheets('S7', true);
    const hist = await rrMoveLogFor({ inventoryId: '45' });
    return { pd: Object.values(state.personalData).map(p => p.inventoryId).sort(), tr: Object.keys(state.transferredData).length, how: hist[0] && hist[0].how };
  });
  T('M13 read from the sheet again: the moved rows stay out of Hale\'s lists; the history line reads without the move\'s tag', JSON.stringify(re.pd) === '["47","48"]' && re.tr === 2 && re.how === 'Moved between collections', re);

  // L · labels
  console.log('\n== L · labels that follow the item ==');
  const l = await pg.evaluate(async () => {
    const tagS7 = _shSheetTagOf('S7'), tagS8 = _shSheetTagOf('S8');
    const moved = rrStickerFind('RR1:I:' + tagS7 + ':45');
    const other = rrStickerFind('RR1:I:' + tagS8 + ':12');
    const unknown = rrStickerFind('RR1:I:zzzzzz:12');
    const missing = rrStickerFind('RR1:I:' + tagS7 + ':99');
    // in Scan to Shelve: a moved copy's label
    rrShelveOpen({ kind: 'shelve' });
    await rrShelveCode('RR1:I:' + tagS7 + ':45');
    const ask = document.getElementById('rr-shelve-ask');
    const askText = ask ? ask.textContent : '';
    const hasOpen = !!(ask && ask.querySelector('[data-sh-open]')), hasPrint = !!(ask && ask.querySelector('[data-sh-print]'));
    if (ask) ask.remove();
    // another collection's label → "switch?" → Switch → Smith open, the label read there
    await rrShelveCode('RR1:I:' + tagS8 + ':12');
    const ask2 = document.getElementById('rr-shelve-ask');
    const ask2Text = ask2 ? ask2.textContent : '';
    ask2.querySelector('[data-sh-go]').click();
    for (let i = 0; i < 60 && !(state.personalSheetId === 'S8' && document.getElementById('rr-shelve-item') && /3656/.test(document.getElementById('rr-shelve-item').textContent)); i++) await new Promise(r => setTimeout(r, 250));
    const item = document.getElementById('rr-shelve-item');
    const out = { moved: moved && moved.kind, movedTo: moved && moved.dest && moved.dest.key, movedInv: moved && moved.newInv, other: other && other.kind, otherKey: other && other.coll && other.coll.key,
      unknown: unknown && unknown.kind, missing: missing && missing.kind, askText, hasOpen, hasPrint, ask2Text,
      live: state.personalSheetId, shelveOpen: !!document.getElementById('rr-shelve'), item: item && item.textContent };
    rrShelveClose();
    return out;
  });
  T('L1 a moved copy\'s OLD label knows where it went (8 – Smith, No. 46)', l.moved === 'moved' && l.movedTo === 'c8' && l.movedInv === '46', l);
  T('L2 Scan to Shelve says "7-45 moved to 8 – Smith as 8-46." with Open it + Print a new label', /7-45 moved to 8 – Smith as 8-46\./.test(l.askText) && l.hasOpen && l.hasPrint, l);
  T('L3 another collection\'s label: "This is 8-12 in 8 – Smith. Switch to Smith?" → Switch → Smith open, the label read there', l.other === 'otherColl' && l.otherKey === 'c8' && /This is 8-12 in 8 – Smith\. Switch to Smith\?/.test(l.ask2Text) && l.live === 'S8' && l.shelveOpen && /3656/.test(l.item || ''), l);
  T('L4 a label from no known collection is refused; a number not here (and not moved) says so', l.unknown === 'foreign' && l.missing === 'missing', l);
  await pg.close();
}

async function saleRun(browser) {
  console.log('\n== S · For Sale ==');
  const { pg, errs } = await boot(browser);
  await openHale(pg);
  const s = await pg.evaluate(async () => {
    const k47 = Object.keys(state.personalData).find(k => state.personalData[k].inventoryId === '47');
    const m = rrMovePlan([k47], 'c8');
    const r = await rrMoveRun(m);
    const fs7 = JSON.parse(JSON.stringify(window.__S.S7['For Sale'].slice(2))), fs8 = JSON.parse(JSON.stringify(window.__S.S8['For Sale'].slice(2)));
    // Jones keeps no For Sale list: asked first
    await rrSwitchCollection('c8', { quietMs: 0, repaint: false });
    const kNew = Object.keys(state.personalData).find(k => state.personalData[k].itemNum === '6464-1');
    window.__confirms = []; window.__confirmAnswer = false;
    rrMoveOpen([kNew]);
    document.querySelector('input[name="rr-move-to"][value="c9"]').checked = true;
    const no = await rrMoveGo(document.getElementById('rr-move-go'));
    const askedNo = window.__confirms.slice();
    const s9a = window.__S.S9['My Collection'].length;
    window.__confirmAnswer = true;
    rrMoveOpen([kNew]);
    document.querySelector('input[name="rr-move-to"][value="c9"]').checked = true;
    const yes = await rrMoveGo(document.getElementById('rr-move-go'));
    return { ok: r.ok, fs7, fs8, no: no && no.ok, askedNo, s9a, yes: yes && yes.ok, fs8after: window.__S.S8['For Sale'].slice(2), fs9: (window.__S.S9['For Sale'] || []).slice(2), s9: window.__S.S9['My Collection'].length };
  });
  T('S1 the listing goes along: off Hale\'s For Sale list (the row kept in the trash tab, as every removal), on Smith\'s with the new number', s.ok && s.fs7.every(r => !r.some(v => v)) && s.fs8.length === 1 && String(s.fs8[0][8]) === '46' && s.fs8[0][3] === '25', s);
  T('S2 Jones has For Sale switched off → asked first; "no" moves nothing', s.no === false && /Jones has For Sale switched off/.test(s.askedNo[0] || '') && s.s9a === 3, s);
  T('S3 "yes" → moved, and taken off Smith\'s For Sale list, not put on Jones\'s', s.yes && s.s9 === 4 && s.fs8after.every(r => !r.some(v => v)) && s.fs9.length === 0, s);
  T('S4 no script error', errs.length === 0, errs);
  await pg.close();
}

// X · a failure planted at every step → Finish completes it, nothing doubled
async function failRun(browser) {
  console.log('\n== X · a failure part way, at every step ==');
  const cases = [
    { name: 'adding the rows', re: /S8\/values\/My Collection!A3:[A-Z]+:append/, method: 'POST', step: 'start' },
    // S8 batch reads before it: the header check, the numbers, the "already there?" look, the append's own number
    // check (collections.js) — the 5th is the read-back
    { name: 'the read-back', re: /S8\/values:batchGet/, method: 'GET', step: 'added', skip: 4 },
    { name: 'moving the photos', re: /drive\/v3\/files\/F45\?addParents/, method: 'PATCH', step: 'checked' },
    { name: 'marking the old rows', re: /S7\/values\/My Collection![A-Z]+\d+\?/, method: 'PUT', step: 'photos' },
    { name: 'marking the SECOND old row (the first already marked)', re: /S7\/values\/My Collection![A-Z]+\d+\?/, method: 'PUT', step: 'photos', skip: 1 },
    { name: 'the Movement Log', re: /S8\/values\/Movement Log!A3:A:append/, method: 'POST', step: 'marked' },
    // the rows landed, then the device could not write ANYTHING down (it died): the file still says "start"
    { name: 'writing the step down (after the rows landed)', re: /upload\/drive\/v3\/files\/LIST\?uploadType=media/, method: 'PATCH', step: 'start', skip: 1, times: 2 },
  ];
  for (const c of cases) {
    const { pg, errs } = await boot(browser);
    await openHale(pg);
    const r = await pg.evaluate(async (c) => {
      const k45 = Object.keys(state.personalData).find(k => state.personalData[k].inventoryId === '45');
      const m = rrMovePlan([k45], 'c8');
      // a planted failure: skip the first `skip` matching calls, then fail once
      let seen = 0;
      const re = new RegExp(c.re.src);
      window.__fail.push({ re: { test: (u) => re.test(u) && (++seen > (c.skip || 0)) }, method: c.method, times: c.times || 1 });
      window.__toasts = [];
      const first = await rrMoveRun(m);
      // Finish runs from what the collections list file SAYS (another device, or this one
      // after a restart), never from what this device happens to remember
      await rrCollectionsFileRead();
      const list1 = JSON.parse(window.__files.LIST.content);
      const waiting = Object.values(list1.moves || {});
      const menuHtml = rrMoveUnfinishedHtml();
      const fin = await rrMoveFinish(waiting[0] && waiting[0].id);
      const list2 = JSON.parse(window.__files.LIST.content);
      const F = PERSONAL_FIELD_INDEX;
      const S8 = window.__S.S8['My Collection'].slice(2), S7 = window.__S.S7['My Collection'].slice(2);
      return { first: first.ok, step: waiting[0] && waiting[0].step, menu: /Unfinished moves \(1\)/.test(menuHtml) && /Finish/.test(menuHtml), fin: fin && fin.ok,
        left: Object.keys(list2.moves || {}).length, s8: S8.length, s8tags: S8.filter(x => x[F.transferredFrom]).length,
        s7marked: S7.filter(x => x[F.transferredTo]).length, log7: (window.__S.S7['Movement Log'] || []).slice(2).length, log8: (window.__S.S8['Movement Log'] || []).slice(2).length,
        f45: window.__files.F45.name, f45p: window.__files.F45.parents.length, planted: window.__calls.filter(x => x.kind === 'planted').length };
    }, { re: { src: c.re.source }, method: c.method, skip: c.skip || 0, times: c.times || 1 });
    T('X ' + c.name + ': it stops and waits under Unfinished moves (at "' + c.step + '"); Finish completes it — 2 rows, never 4; 2 marked; 2 log lines a side; the photo folder moved once', errs.length === 0 && r.planted === (c.times || 1) && r.first === false && r.step === c.step && r.menu && r.fin && r.left === 0 && r.s8 === 4 && r.s8tags === 2 && r.s7marked === 2 && r.log7 === 2 && r.log8 === 2 && r.f45 === '46' && r.f45p === 1, { r, errs });
    await pg.close();
  }
}

async function inboxRun(browser) {
  console.log('\n== I · the Photo Inbox tag ==');
  const { pg, errs } = await boot(browser);
  await openHale(pg);
  const u = await pg.evaluate(async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await driveUploadFile(blob, 'INBOX 1 g1 a.jpg', 'INBOXF');
    await driveUploadFile(blob, 'INBOX 2 g2 b.jpg', 'INBOXF', { appProperties: { rrColl: 'c8' } });   // staged offline in Smith
    await driveUploadFile(blob, 'Lionel 2343 ID45 RSV.jpg', 'F45');                                 // not an inbox photo
    const ups = window.__calls.filter(c => c.kind === 'upload');
    const rec = await (async () => { try { return (typeof rrInboxUploadTag === 'function') ? rrInboxUploadTag() : null; } catch (e) { return 'ERR'; } })();
    return { a: ups[0].ap, b: ups[1].ap, c: ups[2].ap, tagNow: rec };
  });
  T('I1 an inbox photo is stamped with the open collection (Hale); one staged offline keeps its own (Smith); an item photo is not stamped', u.a && u.a.rrColl === 'c7' && u.b && u.b.rrColl === 'c8' && !u.c && u.tagNow === 'c7', u);
  const off = require('./lib/pin-source').pinSource();   // the Photo Inbox, read the one way tests read it
  T('I2 a photo staged offline remembers the collection it was TAKEN in, and brings it up', /coll: \(typeof rrInboxUploadTag === 'function'\) \? \(rrInboxUploadTag\(\) \|\| ''\) : ''/.test(off) && /r\.coll \? \{ appProperties: \{ rrColl: r\.coll \} \} : undefined/.test(off));
  // the inbox page: badge, filter, retag, the gate
  const g = await pg.evaluate(async () => {
    // three photos: one for Hale, one for Smith, one with no tag
    const add = (id, name, coll) => { window.__files[id] = { id, name, parents: ['INBOXF'], mime: 'image', appProperties: coll ? { rrColl: coll, rrV: '1' } : null }; };
    Object.keys(window.__files).filter(k => (window.__files[k].parents || []).includes('INBOXF')).forEach(k => delete window.__files[k]);
    add('IH', 'INBOX 10 g10 h.jpg', 'c7'); add('IS', 'INBOX 11 g11 s.jpg', 'c8'); add('IN', 'INBOX 12 g12 n.jpg', '');
    window._pinGo();
    await new Promise(r => setTimeout(r, 300));
    await window._pinRefresh();
    await new Promise(r => setTimeout(r, 300));
    // drawn again and read at once: the stand-in Drive has no thumbnails, and a tile whose
    // thumbnail fails is redrawn as "⚠ err" a moment later (the real inbox's own behaviour)
    window._pinFns._render();
    const badges = [...document.querySelectorAll('[data-pin-coll]')].map(e => e.textContent);
    const filterOpts = [...document.querySelectorAll('#pin-filter-select option')].map(o => o.value + '=' + o.textContent);
    window._pinSetFilter('coll', 'c8');
    const shown = window._pinVisibleGroups().map(x => x.key);
    window._pinClearFilters();
    // same collection → the card opens at once, nothing asked
    window.__confirms = [];
    window._pinReview('g10');
    const sameOpen = !!document.getElementById('pin-review-ov'); const sameAsked = window.__confirms.length;
    try { window._pinCloseReview(); } catch (e) { const o = document.getElementById('pin-review-ov'); if (o) o.remove(); }
    // Smith's photo while Hale is open → the pop-up; "Cancel" → nothing
    window.__confirmAnswer = false;
    await window._pinReview('g11');
    const noAsk = window.__confirms.slice(-1)[0] || ''; const noOpen = !!document.getElementById('pin-review-ov'); const noLive = state.personalSheetId;
    // "Switch to Smith" → switched, the card opens, on the inbox page
    window.__confirmAnswer = true;
    await window._pinReview('g11');
    await new Promise(r => setTimeout(r, 300));
    const yesLive = state.personalSheetId, yesOpen = !!document.getElementById('pin-review-ov'), page = window._rrLastPage;
    try { window._pinCloseReview(); } catch (e) { const o = document.getElementById('pin-review-ov'); if (o) o.remove(); }
    // a photo with NO tag → "Which collection is this photo for?" → Jones
    const p = window._pinReview('g12');
    await new Promise(r => setTimeout(r, 200));
    const pickBox = document.getElementById('rr-pin-coll');
    const pickText = pickBox ? pickBox.textContent : '';
    pickBox.querySelector('[data-pin-pick="c9"]').click();
    await p; await new Promise(r => setTimeout(r, 300));
    const stamped = window.__files.IN.appProperties && window.__files.IN.appProperties.rrColl;
    const liveAfterPick = state.personalSheetId;
    try { window._pinCloseReview(); } catch (e) { const o = document.getElementById('pin-review-ov'); if (o) o.remove(); }
    // bulk retag: select Hale's + Smith's photos → Collection… → Smith
    window._pinShared._sel = { g10: true, g11: true }; window._pinShared._selectMode = true;
    const rp = rrInboxRetagOpen();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#rr-pin-coll [data-pin-pick="c8"]').click();
    const nRet = await rp;
    return { badges, filterOpts, shown, sameOpen, sameAsked, noAsk, noOpen, noLive, yesLive, yesOpen, page, pickText, stamped, liveAfterPick,
      nRet, ih: window.__files.IH.appProperties.rrColl, is: window.__files.IS.appProperties.rrColl, toast: window.__toasts.slice(-1)[0] || '' };
  });
  T('I3 each card wears its collection; "No collection" for an untagged one', g.badges.includes('7 – Hale') && g.badges.includes('8 – Smith') && g.badges.includes('No collection'), g.badges);
  T('I4 the filter offers each collection, and filtering shows only that one\'s photos', g.filterOpts.some(o => /^coll\|c8=8 – Smith \(1\)/.test(o)) && g.filterOpts.some(o => /^coll\|-=No collection/.test(o)) && JSON.stringify(g.shown) === '["g11"]', g);
  T('I5 a photo for the OPEN collection opens straight away — nothing asked', g.sameOpen && g.sameAsked === 0, g);
  T('I6 a photo for another collection: "This photo is for 8 – Smith. Switch to Smith to add it?" — Cancel changes nothing', /This photo is for 8 – Smith\. Switch to Smith to add it\?/.test(g.noAsk) && !g.noOpen && g.noLive === 'S7', g);
  T('I7 …Switch to Smith → Smith open, the inbox page, the card open', g.yesLive === 'S8' && g.yesOpen && g.page === 'photo-inbox', g);
  T('I8 a photo with no tag asks "Which collection is this photo for?" — never a guess — and keeps the answer', /Which collection is this photo for\?/.test(g.pickText) && g.stamped === 'c9' && g.liveAfterPick === 'S9', g);
  T('I9 select → Collection… puts the ticked photos in a collection', g.nRet === 2 && g.ih === 'c8' && g.is === 'c8' && /2 photos are now in 8 – Smith/.test(g.toast), g);
  T('I10 no script error', errs.length === 0, errs);
  await pg.close();

  // only the home collection: nothing stamped as a choice, nothing asked
  const b = await boot(browser, { onlyHome: true });
  const h = await b.pg.evaluate(async () => {
    await rrCollectionsLoad();
    window.__files.IX = { id: 'IX', name: 'INBOX 20 g20 x.jpg', parents: ['INBOXF'], mime: 'image', appProperties: null };
    window._pinGo(); await new Promise(r => setTimeout(r, 300));
    await window._pinRefresh(); await new Promise(r => setTimeout(r, 300));
    window.__confirms = [];
    window._pinReview('g20');
    return { open: !!document.getElementById('pin-review-ov'), asked: window.__confirms.length, picker: !!document.getElementById('rr-pin-coll'), badges: document.querySelectorAll('[data-pin-coll]').length, on: rrInboxCollOn(), btn: rrMoveOn() };
  });
  T('I11 with only the home collection: no badge, no question, no Move button — the inbox works exactly as before', h.open && h.asked === 0 && !h.picker && h.badges === 0 && h.on === false && h.btn === false, h);
  await b.pg.close();

  // switched off (a regular customer): nothing stamped
  const c = await boot(browser, { off: true });
  const f = await c.pg.evaluate(async () => {
    await driveUploadFile(new Blob(['x'], { type: 'image/jpeg' }), 'INBOX 1 g1 a.jpg', 'INBOXF');
    const k = Object.keys(state.personalData || {})[0];
    return { ap: window.__calls.filter(x => x.kind === 'upload')[0].ap, btn: rrMoveBtnHtml(state.personalData[k] || {}) };
  });
  T('I12 switched off (a regular customer): no collection stamped on inbox photos, no Move button', !f.ap && f.btn === '', f);
  await c.pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await moveRun(browser);
    await saleRun(browser);
    await failRun(browser);
    await inboxRun(browser);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
