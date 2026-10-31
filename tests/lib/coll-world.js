// ═══════════════════════════════════════════════════════════════════════════
// coll-world.js — the stand-in Google world the TRR Pro browser suites run in:
// the REAL app in real Chromium, a stand-in Drive (files, folders, the trash)
// and stand-in Sheets (per sheet, per tab). Release 6's harness, shared from
// release 7A on (collections_archive_r7a_tests.js). Nothing here talks to Google.
//   boot(browser, opts)  opts: { off, onlyHome, sheetOutside: '7' }
//   openColl(pg, key)    load the list, open a collection with its items
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
async function boot(browser, opts) {
  // (copied from collections_move_2077_tests.js — release 6's stand-in world —
  // with a Drive trash added: folders + sheets as files, trashed / purged)
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
    // release 7A: the collection folders and the sheets inside them (a delete trashes the folder)
    add({ id: 'COLLS', name: 'Collections', parents: ['VAULT'], mime: 'folder' });
    add({ id: 'HOME', name: 'The Rail Roster', parents: ['VAULT'], mime: 'sheet' });
    [['7', 'Hale'], ['8', 'Smith'], ['9', 'Jones']].forEach(([n, nm]) => {
      add({ id: 'FP' + n, name: n + ' – ' + nm, parents: ['COLLS'], mime: 'folder' });
      add({ id: 'S' + n, name: 'The Rail Roster – ' + n + ' ' + nm, parents: [(o.sheetOutside === n ? 'VAULT' : 'FP' + n)], mime: 'sheet' });
      add({ id: 'SP' + n, name: 'Sold Photos', parents: ['FP' + n], mime: 'folder' });
    });
    window.__purged = {};
    window.__me = 'shop@example.test';
    // the client presses Accept in Drive: every file with a pending request for them becomes theirs, the business drops to writer
    window.__accept = function (email, only) {
      let k = 0;
      Object.values(window.__files).forEach(f => {
        const p = (f.perms || []).find(x => x.emailAddress === email && x.pendingOwner);
        if (!p || (only && k >= only)) return;
        f.perms = f.perms.filter(x => x !== p);
        f.perms.push({ id: 'permMe' + f.id, emailAddress: window.__me, role: 'writer' });
        f.owner = email; k++;
      });
      return k;
    };
    window.__isTrashed = function (f) { let x = f, i = 0; while (x && i++ < 20) { if (x.trashed) return true; x = window.__files[(x.parents || [])[0]]; } return false; };
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
          const hits = Object.values(window.__files).filter(f => !window.__isTrashed(f) && !window.__purged[f.id] && (!nm || f.name === nm) && (!parents.length || (f.parents || []).some(p => parents.includes(p)))
            && (!folderOnly || f.mime === 'folder') && (!imgOnly || f.mime === 'image'));
          return okR({ files: hits.map(f => ({ id: f.id, name: f.name, parents: f.parents, mimeType: f.mime === 'folder' ? 'application/vnd.google-apps.folder' : 'x/' + (f.mime || 'file'), appProperties: f.appProperties || undefined, createdTime: '2026-10-30T10:00:00Z' })) });
        }
        if (method === 'GET' && fm && /alt=media/.test(u)) {
          const f = window.__files[fm[1]]; window.__calls.push({ kind: 'listRead' });
          return f ? okR(JSON.parse(f.content || '{}')) : bad(404, {});
        }
        // release 7B: sharing — one permission list per file; the account signed in is window.__me
        const pm = /\/files\/([^/?]+)\/permissions(?:\/([^/?]+))?/.exec(u);
        if (pm) {
          const f = window.__files[pm[1]]; if (!f) return bad(404, { error: { code: 404 } });
          f.perms = f.perms || [];
          if (window.__permFail && window.__permFail(pm[1], method, u)) { window.__calls.push({ kind: 'permRefused', id: pm[1] }); return bad(403, { error: { code: 403, message: 'refused' } }); }
          if (method === 'POST') {
            const b = JSON.parse(opts.body || '{}');
            let p = f.perms.find(x => x.emailAddress === b.emailAddress);
            if (!p) { p = { id: 'perm' + (++n), emailAddress: b.emailAddress }; f.perms.push(p); }
            Object.assign(p, { role: b.role, pendingOwner: !!b.pendingOwner });
            window.__calls.push({ kind: 'permAsk', id: pm[1], email: b.emailAddress, notify: /sendNotificationEmail=true/.test(u), pending: !!b.pendingOwner });
            return okR({ id: p.id });
          }
          if (method === 'GET') return okR({ permissions: [{ id: 'owner', emailAddress: f.owner || window.__me, role: 'owner' }].concat(f.perms) });
          if (method === 'DELETE') { f.perms = f.perms.filter(x => x.id !== pm[2]); window.__calls.push({ kind: 'permDrop', id: pm[1], perm: pm[2] }); return { ok: true, status: 204, json: async () => ({}), text: async () => '' }; }
        }
        if (fm && window.__purged[fm[1]]) { window.__calls.push({ kind: 'gone', id: fm[1], method }); return bad(404, { error: { code: 404, message: 'File not found: ' + fm[1] } }); }
        if (method === 'GET' && fm) {
          const f = window.__files[fm[1]];
          if (f && f.gone) return bad(404, { error: { code: 404 } });
          return okR(f ? { id: f.id, name: f.name, parents: f.parents, mimeType: f.mime, trashed: window.__isTrashed(f), ownedByMe: !f.owner || f.owner === window.__me } : { id: fm[1], trashed: false, ownedByMe: true });
        }
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
          if (b.trashed !== undefined) { f.trashed = !!b.trashed; window.__calls.push({ kind: 'trash', id: f.id, to: !!b.trashed }); }
          if (b.appProperties) { f.appProperties = Object.assign({}, f.appProperties || {}, b.appProperties); Object.keys(f.appProperties).forEach(k => { if (f.appProperties[k] == null) delete f.appProperties[k]; }); }
          const ap = /addParents=([^&]+)/.exec(u), rp = /removeParents=([^&]+)/.exec(u);
          if (ap) f.parents = (f.parents || []).filter(p => !(rp && rp[1].split(',').includes(p))).concat([ap[1]]);
          window.__calls.push({ kind: 'drivePatch', id: f.id, name: b.name, move: ap ? ap[1] : '' });
          return okR({ id: f.id });
        }
        return okR({});
      }
      // Sheets — release 8: making a new spreadsheet (the export snapshot)
      if (method === 'POST' && /sheets\.googleapis\.com\/v4\/spreadsheets$/.test(u)) {
        const b = JSON.parse(opts.body || '{}'); const id = nid('SNAP');
        window.__S[id] = {}; ((b.sheets || [])).forEach(t => { window.__S[id][t.properties.title] = []; });
        add({ id, name: (b.properties || {}).title || '', parents: ['root'], mime: 'sheet' });
        window.__calls.push({ kind: 'sheetMade', id, title: (b.properties || {}).title });
        return okR({ spreadsheetId: id });
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
async function openColl(pg, key) {
  return pg.evaluate(async (k) => {
    await rrCollectionsLoad();
    const r = await rrSwitchCollection(k, { quietMs: 0, repaint: false });
    return { r, n: Object.keys(state.personalData).length, live: state.personalSheetId };
  }, key);
}
module.exports = { boot, openColl, APP };
