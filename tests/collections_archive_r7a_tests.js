#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVE, UN-ARCHIVE, DELETE, RECENTLY DELETED — TRR Pro release 7A
// (real Chromium, the REAL app, a stand-in Drive + Sheets: tests/lib/coll-world.js)
//
// Plan PLAN_2026-10-31_TRR_PRO_R7.md; [stated] Brad 2026-10-31 07:26 CT "yes".
//   G  source guards, each PROVED on a planted offender
//   A  archiving: home never; only the open collection; unfinished moves
//      first; items still here → move / mark returned / archive anyway;
//      marked returned = hidden, never deleted, a log line, a backup first
//   R  read only at the ONE door: every sheet writer and every photo writer
//      refuses an archived collection's sheet/folder — each proved against
//      the same writer WITHOUT the door; home and other collections still
//      write; another device's stale view is refused too
//   U  un-archive: one call, writes work again
//   D  delete: archived only, never home, the name typed; the forwarding
//      list saved BEFORE the trash; the folder (sheet + photos) trashed; the
//      record kept; Recently deleted → Restore; restore after Google emptied
//      the trash says so; a sheet outside its folder is trashed too
//   L  labels: archived → "read only"; deleted → forwarded / returned /
//      "deleted on"; moved into a collection deleted since
//   I  the Photo Inbox never files into an archived collection
//   X  a regular customer: no list reads, nothing changes
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_archive_r7a_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1500))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
const SHEET_WRITERS = ['sheetsUpdate', 'sheetsAppend', 'sheetsClear', 'sheetsDeleteRow'];
function sheetDoorMissing(src) {
  const s = stripComments(src);
  const blk = (s.match(/if \(typeof rrWriteDoor === 'function'\) \{([\s\S]*?)\n\}/) || [])[1] || '';
  return SHEET_WRITERS.filter(w => !new RegExp('\\b' + w + ' = rrWriteDoor\\(' + w + '\\);').test(blk));
}
const PHOTO_WRITERS = ['driveUploadFile', 'driveUploadPhoto', 'driveMoveFileToFolder'];
function photoDoorMissing(src) {
  const s = stripComments(src);
  const blk = (s.match(/if \(typeof rrFolderDoor === 'function'\) \{([\s\S]*?)\n\}/) || [])[1] || '';
  const miss = PHOTO_WRITERS.filter(w => !new RegExp('\\b' + w + ' = rrFolderDoor\\(' + w + ', 2\\);').test(blk));
  const fn = (s.match(/async function _driveFindOrCreateFolderNow[\s\S]*?\n\}/) || [''])[0];
  const askAt = fn.indexOf('rrFolderWriteRefused(parentId)'), createAt = fn.indexOf("driveRequest('POST'");
  if (!(askAt > 0 && createAt > askAt)) miss.push('the new-folder create');
  return miss;
}
function permanentDeletes(src) { return /driveRequest\(\s*'DELETE'/.test(stripComments(src)) || /method:\s*'DELETE'/.test(stripComments(src)); }
function forwardBeforeTrash(src) {
  const s = stripComments(src);
  const fn = (s.match(/async function rrDeleteCollection[\s\S]*?\n  \}/) || [''])[0];
  const fwd = fn.indexOf('.forward = fwd'), trash = fn.indexOf('{ trashed: true }');
  return fwd > 0 && trash > fwd;
}
// A value put into an on-click must be QUOTED. rrJsArg only makes it safe —
// rrCollChoose(c7…) without quotes asks for a variable and the tap does nothing
// (found 2026-10-31 in the live Releases 5 + 6: the drop-down, Details, Finish, Move).
function unquotedArgs(files) {
  const out = [];
  files.forEach(([f, src]) => {
    const s = stripComments(src);
    const helperOk = !/function (jsArg|_arg)\(/.test(s) || /function (jsArg|_arg)\([a-z]+\) \{ return "'" \+/.test(s);
    if (!helperOk) out.push(f + ': helper');
    if (/onclick="[^"]*\(' \+ \(?(typeof rrJsArg|rrJsArg\()/.test(s) || /onclick="[^"]*[(\[,] ?' \+ esc\((rr)?[jJ]sArg\(/.test(s)) out.push(f + ': bare');
  });
  return out;
}
function guards() {
  console.log('\n== G · source guards ==');
  const colls = fs.readdirSync(APP).filter(f => /^collections.*\.js$/.test(f)).map(f => [f, read(f)]);
  T('G9 every collection value inside a button is QUOTED (one helper per file)', unquotedArgs(colls).length === 0 && colls.length >= 5, unquotedArgs(colls));
  T('G9b PLANTED: the live Release 5 line (a bare rrJsArg) → caught', unquotedArgs([['collections-ui.js', read('collections-ui.js') + `\nvar x = '<button onclick="rrCollChoose(' + (typeof rrJsArg === 'function' ? rrJsArg(key) : "'" + key + "'") + ')">';`]]).length === 1);
  T('G9c PLANTED: the live Release 6 helper (no quotes) → caught', unquotedArgs([['collections-move.js', read('collections-move.js').replace(/function jsArg\(s\) \{ return "'" \+/, 'function jsArg(s) { return (')]]).length === 1);
  const sh = read('sheets.js');
  T('G1 all four sheet writers pass the archive door (sheets.js, outermost)', sheetDoorMissing(sh).length === 0, sheetDoorMissing(sh));
  T('G1b PLANTED: one writer left off the door → caught', sheetDoorMissing(sh.replace('sheetsClear = rrWriteDoor(sheetsClear);', '')).join() === 'sheetsClear');
  T('G1c the door sits AFTER the write counting (outermost: a refused write is never counted or recorded for a retry)', sh.indexOf('sheetsUpdate = rrWriteDoor(') > sh.indexOf('sheetsUpdate = rrTrackWrites('));
  const dr = read('drive.js');
  T('G2 every photo writer passes the archive door, and a NEW folder asks before it is made', photoDoorMissing(dr).length === 0, photoDoorMissing(dr));
  T('G2b PLANTED: the upload left off the door → caught', photoDoorMissing(dr.replace('driveUploadFile = rrFolderDoor(driveUploadFile, 2);', '')).join() === 'driveUploadFile');
  T('G2c PLANTED: a folder made before the door is asked → caught', photoDoorMissing(dr.replace('const _shut = await rrFolderWriteRefused(parentId);', 'const _shut = null;')).includes('the new-folder create'));
  const ar = read('collections-archive.js');
  T('G3 delete never deletes anything for good — Drive trash only', !permanentDeletes(ar));
  T('G3b PLANTED: a DELETE request → caught', permanentDeletes(ar + "\ndriveRequest('DELETE', '/files/x');"));
  T('G4 the forwarding list is written BEFORE the folder goes to the trash', forwardBeforeTrash(ar));
  T('G4b PLANTED: trash first → caught', !forwardBeforeTrash(ar.replace(/(var fwd = await rrArchiveForwardList\(e\.sheetId\);)/, "await driveRequest('PATCH', '/files/x', { trashed: true });\n      $1")));
  const ix = read('index.html'), sw = read('sw.js');
  const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core;
  T('G5 collections-archive.js is loaded (after the move file), offline, CORE', ix.includes('src="./collections-archive.js?v=') && ix.indexOf('collections-archive.js') > ix.indexOf('collections-move.js') && sw.includes("'./collections-archive.js'") && core.includes('app/collections-archive.js'));
  const cfg = read('config.js');
  const block = (cfg.match(/var RR_COLL_ARCHIVE = \{[\s\S]*?\n\};/) || [''])[0];
  T('G6 every word in RR_COLL_ARCHIVE (config.js); none says "AI"; no typed toast in the new file', block.length > 0 && !/\bAI\b/.test(block) && !/toast\('[A-Z]/.test(stripComments(ar)) && !/showToast\('[A-Z]/.test(stripComments(ar)));
  T('G7 every action is one-tap (rrOnce): archive, mark returned, un-archive, delete, restore, finish', ['rr-coll-archive-go', 'rr-coll-arch-return', 'rr-coll-unarchive', 'rr-coll-delete-go', "rr-coll-restore-'", 'rr-coll-arch-finish'].every(k => ar.includes("rrOnce('" + k)));
  const checks = ((block.match(/checks: \[([^\]]*)\]/) || [])[1] || '').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  T('G8 each check in RR_COLL_ARCHIVE.checks has its checker (Release 10 adds one line + one checker)', checks.join() === 'moves,handover,invoices,unsold' && checks.every(k => new RegExp('\\n    ' + k + ': (async )?function').test(ar)), checks);
}

const WAIT = ms => new Promise(r => setTimeout(r, ms));
// A closed pop-up rewinds one history step (back-stack.js); give each its moment,
// and pad the history so a test page can never step back off the app.
async function steady(pg) {
  await pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    window.__rm = async (id) => { const d = document.getElementById(id); if (d) d.remove(); await new Promise(r => setTimeout(r, 250)); };
  });
}

// ── A · archiving ──────────────────────────────────────────────────────────
async function archiveRun(browser) {
  console.log('\n== A · archiving ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  const o = await openColl(pg, 'c7');
  T('A0 Hale opens with its 4 copies', o.r.ok && o.n === 4 && o.live === 'S7', o);
  const a = await pg.evaluate(async () => {
    const out = {};
    out.home = (await rrArchiveCollection('home')).why;
    out.notOpen = (await rrArchiveChecks('c8')).why;
    // an unfinished move INTO Hale (another device's) → must be finished first
    const L = JSON.parse(window.__files.LIST.content);
    L.moves = { mvX: { id: 'mvX', from: 'c8', to: 'c7', fromLabel: '8 – Smith', toLabel: '7 – Hale', step: 'marked', items: [] } };
    window.__files.LIST.content = JSON.stringify(L);
    const blocked = await rrArchiveCollection('c7', { anyway: true });
    out.blocked = blocked.why; out.blockedIds = (blocked.open || []).map(r => r.id + ':' + r.n);
    rrArchiveOpen('c7');
    for (let i = 0; i < 40 && !document.querySelector('#rr-arch-body [data-arch-check]'); i++) await new Promise(r => setTimeout(r, 50));
    const body = document.getElementById('rr-arch-body');
    out.dlgFinish = !!(body && body.querySelector('[onclick*="rrArchiveFinishMove"]'));
    out.dlgAnyway = !!(body && body.querySelector('[data-arch-anyway]'));
    await __rm('rr-coll-archive');
    delete L.moves; window.__files.LIST.content = JSON.stringify(L);
    // items still here → asked
    const ask = await rrArchiveCollection('c7');
    out.ask = ask.why; out.askIds = (ask.open || []).map(r => r.id + ':' + r.n);
    rrArchiveOpen('c7');
    for (let i = 0; i < 40 && !document.querySelector('#rr-arch-body [data-arch-anyway]'); i++) await new Promise(r => setTimeout(r, 50));
    out.three = ['data-arch-move', 'data-arch-return', 'data-arch-anyway'].every(x => !!document.querySelector('#rr-arch-body [' + x + ']'));
    out.statusAfterAsk = JSON.parse(window.__files.LIST.content).items.c7.status;
    await __rm('rr-coll-archive');
    return out;
  });
  T('A1 My Collection can never be archived', a.home === 'home', a);
  T('A2 only the OPEN collection is archived (from its own Details)', a.notOpen === 'open', a);
  T('A3 an unfinished move in or out of it (from another device) must be finished first — even "anyway" is refused; the screen shows Finish, not Archive anyway', a.blocked === 'open' && a.blockedIds.includes('moves:1') && a.dlgFinish && !a.dlgAnyway, a);
  T('A4 items still here → asked: Move them… / Mark returned to the client / Archive anyway; nothing changed yet', a.ask === 'ask' && a.askIds.join() === 'unsold:4' && a.three && a.statusAfterAsk === 'active', a);

  // Mark returned (two of the four)
  const m = await pg.evaluate(async () => {
    const F = PERSONAL_FIELD_INDEX, pd = state.personalData;
    const key = inv => Object.keys(pd).find(k => pd[k].inventoryId === inv);
    window.__calls = [];
    const r = await rrArchiveMarkReturned([key('47'), key('48')]);
    const S7 = window.__S.S7['My Collection'];
    const firstPut = window.__calls.findIndex(c => c.kind === 'put' && c.sid === 'S7');
    const backup = window.__calls.findIndex(c => c.kind === 'backup' && c.of === 'S7' && /before-return/.test(c.name));
    const out = {
      r, rows: S7.length, marks: S7.slice(2).map(x => [x[F.inventoryId], x[F.transferredTo] || '']),
      log: (window.__S.S7['Movement Log'] || []).slice(2).map(l => [String(l[1]), l[5], l[7]]),
      backupFirst: backup >= 0 && firstPut > backup,
      pd: Object.values(state.personalData).map(p => p.inventoryId).sort(), tr: Object.values(state.transferredData || {}).map(p => p.inventoryId).sort(),
    };
    // run again on a copy that is already marked on the sheet (as if this device had not heard)
    const back = state.transferredData[Object.keys(state.transferredData).find(k => state.transferredData[k].inventoryId === '47')];
    const k47 = Object.keys(state.transferredData).find(k => state.transferredData[k].inventoryId === '47');
    state.personalData[k47] = Object.assign({}, back, { owned: true, transferredTo: '' });
    window.__calls = [];
    out.again = await rrArchiveMarkReturned([k47]);
    out.againPuts = window.__calls.filter(c => c.kind === 'put' && c.sid === 'S7').length;
    out.againLog = (window.__S.S7['Movement Log'] || []).slice(2).length;
    out.againPd = !!state.personalData[k47];
    // read from the sheet again: the returned rows stay hidden
    await _loadPersonalFromSheets('S7', true);
    out.reload = Object.values(state.personalData).map(p => p.inventoryId).sort();
    return out;
  });
  const today = await pg.evaluate(() => rrToday());
  T('A5 Mark returned: the sheet is backed up ("before-return") BEFORE the first change', m.backupFirst, m);
  T('A6 the two rows say "Returned to client on <today>" — NOT deleted (still 4 rows); the other two untouched', m.r.ok && m.r.n === 2 && m.rows === 6 && m.marks[2][1] === 'Returned to client on ' + today && m.marks[3][1] === 'Returned to client on ' + today && m.marks[0][1] === '' && m.marks[1][1] === '', m);
  T('A7 one Movement Log line each ("Returned to client", to "Client")', m.log.length === 2 && m.log.every(l => l[1] === 'Client' && l[2] === 'Returned to client') && m.log.map(l => l[0]).sort().join() === '47,48', m.log);
  T('A8 they leave the lists at once, aside like a moved row', JSON.stringify(m.pd) === '["45","46"]' && JSON.stringify(m.tr) === '["47","48"]', m);
  T('A9 run again on a row already marked: nothing written twice (no change, no second log line) — it simply leaves the list', m.again.ok && m.againPuts === 0 && m.againLog === 2 && !m.againPd, m);
  T('A10 read from the sheet again: the returned rows stay hidden', JSON.stringify(m.reload) === '["45","46"]', m.reload);

  // Archive anyway
  const b = await pg.evaluate(async () => {
    window.__toasts = [];
    const r = await rrArchiveCollection('c7', { anyway: true });
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    rrCollHeaderPaint && (document.getElementById('main-content') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'main-content' })));
    rrCollHeaderPaint();
    const banner = document.getElementById('rr-coll-archived-banner');
    const planted = document.createElement('button'); planted.setAttribute('onclick', "startWizardFor('collection')"); planted.id = 'planted-add'; document.body.appendChild(planted);
    const hidden = getComputedStyle(planted).display === 'none';
    const add = rrAddAllowed('collection');
    rrCollMenuOpen();
    const sum = document.querySelector('[data-arch-list] summary');
    const archList = document.querySelector('[data-arch-list]');
    const menu = { sum: sum && sum.textContent, hale: archList && /7 – Hale/.test(archList.textContent), active: [...document.querySelectorAll('#rr-coll-list > button')].some(x => /7 – Hale/.test(x.textContent)) };
    await __rm('rr-coll-menu');
    rrArchiveHeadingSet('Past Auctions'); rrCollHeaderPaint();
    const banner2 = document.getElementById('rr-coll-archived-banner');
    rrCollMenuOpen(); const sum2 = document.querySelector('[data-arch-list] summary'); const sum2t = sum2 && sum2.textContent; await __rm('rr-coll-menu');
    rrArchiveHeadingSet('');
    rrCollDetailsOpen('c7');
    const det = document.getElementById('rr-coll-details');
    const detail = { save: !!det.querySelector('#rr-coll-d-save'), unarch: !!det.querySelector('[data-unarchive]'), del: !!det.querySelector('[data-del-open]'), disabled: det.querySelector('#rr-coll-d-name').disabled, words: det.textContent };
    await __rm('rr-coll-details');
    const upd = await rrUpdateCollection('c7', { notes: 'changed' });
    return { r, status: e.status, at: !!e.archivedAt, reg: rrCollectionByKey('c7') && rrCollectionByKey('c7').status, body: document.body.classList.contains('rr-coll-archived'),
      banner: banner && banner.textContent, banner2: banner2 && banner2.textContent, hidden, add, toasts: window.__toasts.slice(), menu, sum2t, detail, upd: upd.why,
      notes: JSON.parse(window.__files.LIST.content).items.c7.notes || '' };
  });
  T('A11 archived anyway: the list file says archived + when; it stays listed (it opens, read only)', b.r.ok && b.status === 'archived' && b.at && b.reg === 'archived', b);
  T('A12 the screen says so: "Archived – Hale is read only" with Un-archive', /Archived – Hale is read only/.test(b.banner || '') && /Un-archive/.test(b.banner || ''), b.banner);
  T('A13 the ways in to add are hidden (a planted Add button disappears) and the add door says why', b.body && b.hidden && b.add === false && b.toasts.some(t => /7 – Hale is archived — it is read only/.test(t)), b);
  T('A14 the drop-down: out of the active list, under the archived heading (folded)', /^Archived \(1\)$/.test(b.menu.sum || '') && b.menu.hale && !b.menu.active, b.menu);
  T('A15 the heading\'s name is ONE business setting ("Past Auctions" → the menu and the banner)', /^Past Auctions \(1\)$/.test(b.sum2t || '') && /Past Auctions – Hale is read only/.test(b.banner2 || ''), b);
  T('A16 its details card is read only — no Save; Un-archive + Delete there; a change is refused', !b.detail.save && b.detail.unarch && b.detail.del && b.detail.disabled && /Read only while archived/.test(b.detail.words) && b.upd === 'archived' && b.notes === '', b);

  // R · read only at the ONE door
  console.log('\n== R · read only, at the one door ==');
  await WAIT(3100);   // the read-only words are said at most once every 3 seconds
  const r = await pg.evaluate(async () => {
    const out = {};
    const tryIt = async (fn) => { try { await fn(); return 'wrote'; } catch (e) { return e && e.message; } };
    window.__calls = []; window.__toasts = [];
    const before = JSON.stringify(window.__S.S7);
    out.update = await tryIt(() => sheetsUpdate('S7', 'My Collection!A3', [['x']]));
    out.append = await tryIt(() => sheetsAppend('S7', 'My Collection!A:A', [['y']]));
    out.clear = await tryIt(() => sheetsClear('S7', 'For Sale!A3:J'));
    out.del = await tryIt(() => sheetsDeleteRow('S7', 'My Collection', 3, { itemNum: '2343', inventoryId: '45' }));
    out.verified = await rrVerifiedRowUpdate('S7', 'My Collection', 3, 'My Collection!B3', [['z']], { num: '2343', invId: '45' }, 'test').catch(e => e.message);
    out.trash = (await rrTrashRestore(5)).reason;
    out.unchanged = JSON.stringify(window.__S.S7) === before;
    out.writes = window.__calls.filter(c => (c.kind === 'put' || c.kind === 'append') && c.sid === 'S7').length;
    out.toasts = window.__toasts.filter(t => /archived — it is read only/.test(t)).length;
    // photos: into Hale's folders by every road
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    window.__calls = [];
    out.upKnown = await tryIt(() => driveUploadFile(blob, 'a.jpg', 'P7'));
    out.upDeep = await tryIt(() => driveUploadFile(blob, 'b.jpg', 'F45'));          // a folder this device never noted: Drive is asked
    out.upPhoto = await tryIt(() => driveUploadPhoto(blob, 'c.jpg', 'F46'));
    out.mkdir = await tryIt(() => driveFindOrCreateFolder('NEW', 'P7'));
    out.findOld = await tryIt(() => driveFindOrCreateFolder('Lionel Postwar', 'P7'));   // finding is only a read
    out.moveIn = await tryIt(() => driveMoveFileToFolder('IMG45', 'F45', 'SP7'));
    out.photoWrites = window.__calls.filter(c => c.kind === 'upload' || c.kind === 'folderMade' || (c.kind === 'drivePatch' && c.move)).length;
    // PLANTED proof: the same writers WITHOUT the door write — the refusals above are the door's
    window.__calls = [];
    out.innerSheet = await tryIt(() => sheetsUpdate._rrInner('S7', 'My Collection!ZZ1', [['probe']]));
    out.innerPhoto = await tryIt(() => driveUploadFile._rrInner(blob, 'probe.jpg', 'P7'));
    out.innerWrites = window.__calls.filter(c => (c.kind === 'put' && c.sid === 'S7') || c.kind === 'upload').length;
    // everything else still writes: home (Contacts live there), another collection, a set-up write
    out.home = await tryIt(() => sheetsUpdate('HOME', 'Contacts!A3', [['Bob']]));
    out.other = await tryIt(() => sheetsUpdate('S8', 'My Collection!ZZ3', [['ok']]));
    out.setup = await tryIt(() => sheetsSetupUpdate('S7', 'My Collection!A1', [['My Collection']]));
    out.homePhoto = await tryIt(() => driveUploadFile(blob, 'INBOX 9 g9 q.jpg', 'INBOXF'));
    // a move out of it, the shelf screen
    const k = Object.keys(state.personalData)[0];
    const plan = rrMovePlan([k], 'c8');
    out.move = (await rrMoveRun(plan)).why;
    out.moveBtn = rrMoveOn();
    rrShelveOpen({ kind: 'shelve' }); out.shelve = !!document.getElementById('rr-shelve'); rrShelveClose();
    rrShelveOpen({ kind: 'check' }); out.check = !!document.getElementById('rr-shelve'); rrShelveClose();
    return out;
  });
  const refused = ['update', 'append', 'clear', 'del', 'verified'].map(k => r[k]);
  T('R1 every sheet writer refuses Hale\'s sheet (update, append, clear, delete row, the guarded row update)', refused.slice(0, 4).every(x => x === 'archived') && r.verified !== true, r);
  T('R2 …the sheet is unchanged, no request reached it; the trash put-back is refused too', r.unchanged && r.writes === 0 && r.trash === 'archived', r);
  T('R3 the person is told once, in plain words, not once per write', r.toasts >= 1 && r.toasts <= 2, r.toasts);
  T('R4 every photo road into Hale\'s folders is refused: an upload (a noted folder, and one only Drive knows), the photo upload, a NEW folder, a move into Sold Photos', ['upKnown', 'upDeep', 'upPhoto', 'mkdir', 'moveIn'].every(k => r[k] === 'archived') && r.photoWrites === 0, r);
  T('R5 finding a folder that is already there is only a read — allowed', r.findOld === 'wrote', r);
  T('R6 PLANTED: the same writers WITHOUT the door do write — so every refusal above is the door\'s', r.innerSheet === 'wrote' && r.innerPhoto === 'wrote' && r.innerWrites === 2, r);
  T('R7 everything else still writes: home (Contacts), another collection, a set-up write, an inbox photo', ['home', 'other', 'setup', 'homePhoto'].every(k => r[k] === 'wrote'), r);
  T('R8 no move out of it (refused before its first step); no Move button; Scan to Shelve does not open — the shelf check (read only) does', r.move === 'archived' && r.moveBtn === false && !r.shelve && r.check, r);

  // I · the Photo Inbox
  const i = await pg.evaluate(async () => {
    const tagNow = rrInboxUploadTag();
    window.__files.IH = { id: 'IH', name: 'INBOX 10 g10 h.jpg', parents: ['INBOXF'], mime: 'image', appProperties: { rrColl: 'c7', rrV: '1' } };
    window._pinGo(); await new Promise(r => setTimeout(r, 300));
    await window._pinRefresh(); await new Promise(r => setTimeout(r, 300));
    window.__confirms = [];
    const p = window._pinReview('g10');
    await new Promise(r => setTimeout(r, 300));
    const box = document.getElementById('rr-pin-coll');
    const picks = box ? [...box.querySelectorAll('[data-pin-pick]')].map(b => b.getAttribute('data-pin-pick')) : [];
    const card = !!document.getElementById('pin-review-ov');
    if (box) box.querySelector('[data-pin-pick="c8"]').click();
    await p; await new Promise(r => setTimeout(r, 400));
    const live = state.personalSheetId;
    try { window._pinCloseReview(); } catch (e) { const o = document.getElementById('pin-review-ov'); if (o) o.remove(); }
    await rrSwitchCollection('c7', { quietMs: 0, repaint: false });
    return { tagNow, picks, card, live, tag: window.__files.IH.appProperties && window.__files.IH.appProperties.rrColl };
  });
  T('I1 while an archived collection is open, a new inbox photo is not tagged for it', i.tagNow === '', i);
  T('I2 a photo tagged for an archived collection asks which ACTIVE collection it is for — never opens into the archived one', !i.card && i.picks.length > 0 && !i.picks.includes('c7') && i.live === 'S8' && i.tag === 'c8', i);

  // stale view: another device archives, this one has not heard yet
  const s = await pg.evaluate(async () => {
    const un = await rrUnarchiveCollection('c7');
    const activeHere = !rrCollectionIsArchived('c7');
    const L = JSON.parse(window.__files.LIST.content); L.items.c7.status = 'archived'; L.items.c7.archivedAt = Date.now(); window.__files.LIST.content = JSON.stringify(L);
    const was = RR_COLL_ARCHIVE.doorFreshMs; RR_COLL_ARCHIVE.doorFreshMs = 0;   // this device's copy is "old"
    let res; try { await sheetsUpdate('S7', 'My Collection!A3', [['stale']]); res = 'wrote'; } catch (e) { res = e.message; }
    RR_COLL_ARCHIVE.doorFreshMs = was;
    return { un: un.ok, activeHere, res, nowHere: rrCollectionIsArchived('c7'), cell: (window.__S.S7['My Collection'][2] || [])[0] };
  });
  T('R9 another device archived it; this device still thought it active — the door reads the list fresh and refuses', s.un && s.activeHere && s.res === 'archived' && s.nowHere && s.cell !== 'stale', s);

  // U · un-archive
  console.log('\n== U · un-archive ==');
  const u = await pg.evaluate(async () => {
    const r = await rrUnarchiveCollection('c7');
    let w; try { await sheetsUpdate('S7', 'My Collection!ZZ4', [['again']]); w = 'wrote'; } catch (e) { w = e.message; }
    rrCollHeaderPaint();
    return { ok: r.ok, status: JSON.parse(window.__files.LIST.content).items.c7.status, w, body: document.body.classList.contains('rr-coll-archived'),
      shown: getComputedStyle(document.getElementById('planted-add')).display !== 'none', banner: !!document.getElementById('rr-coll-archived-banner'), add: rrAddAllowed('collection') };
  });
  T('U1 un-archive: one call → active; writes go through again; the buttons and the add door are back; no banner', u.ok && u.status === 'active' && u.w === 'wrote' && !u.body && u.shown && !u.banner && u.add === true, u);
  T('A17 no script error', errs.length === 0, errs);
  await pg.close();
}

// ── D · delete, restore · L · labels ───────────────────────────────────────
async function deleteRun(browser) {
  console.log('\n== D · delete, Recently deleted, restore ==');
  const { pg, errs } = await boot(browser);
  await pg.evaluate(() => {
    const F = PERSONAL_FIELD_INDEX;
    // Hale: 45 moved to Smith earlier, 46 returned to the client
    window.__S.S7['My Collection'][2][F.transferredTo] = 'To 8 – Smith as 8-46 on 2026-10-30 [m:mvA:45]';
    window.__S.S7['My Collection'][3][F.transferredTo] = 'Returned to client on 2026-10-29';
    // Smith: its No. 12 went to Hale as 7-49 (and Hale is deleted below)
    window.__S.S8['My Collection'][3][F.transferredTo] = 'To 7 – Hale as 7-49 on 2026-10-30 [m:mvB:12]';
    window.__files.BKF = { id: 'BKF', name: 'Backups', parents: ['VAULT'], mime: 'folder' };
    window.__files.BK1 = { id: 'BK1', name: 'auto-before-move S7', parents: ['BKF'], mime: 'sheet' };
  });
  await steady(pg);
  await openColl(pg, 'c7');
  const d = await pg.evaluate(async () => {
    const out = {};
    out.active = (await rrDeleteCollection('c7', 'Hale')).why;
    out.home = (await rrDeleteCollection('home', 'My Collection')).why;
    out.arch = (await rrArchiveCollection('c7', { anyway: true })).ok;
    localStorage.setItem(rrPersonalCacheKey('', rrCollectionByKey('c7')), '{"x":1}');
    localStorage.setItem(rrInvHwmKey(rrCollectionByKey('c7')), '48');
    window.__calls = [];
    out.wrong = (await rrDeleteCollection('c7', 'Hal')).why;
    out.wrongTrash = window.__calls.filter(c => c.kind === 'trash').length;
    // the confirm screen
    rrDeleteOpen('c7');
    for (let i = 0; i < 40 && !/2 items/.test((document.getElementById('rr-del-what') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 50));
    out.confirm = document.getElementById('rr-coll-delete').textContent;
    await __rm('rr-coll-delete');
    window.__calls = [];
    const r = await rrDeleteCollection('c7', '  hale ');
    out.ok = r.ok;
    const fwdWrite = window.__calls.findIndex(c => c.kind === 'listWrite');
    const trash = window.__calls.findIndex(c => c.kind === 'trash' && c.id === 'FP7');
    out.order = fwdWrite >= 0 && trash > fwdWrite;
    out.trashCalls = window.__calls.filter(c => c.kind === 'trash').map(c => c.id);
    out.sheetGone = window.__isTrashed(window.__files.S7) && window.__isTrashed(window.__files.IMG45);
    out.backupKept = !window.__isTrashed(window.__files.BK1);
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    out.entry = { status: e.status, at: !!e.deletedAt, number: e.number, fwd: e.forward };
    out.live = state.personalSheetId; out.reg = rrCollectionByKey('c7');
    out.cache = localStorage.getItem(rrPersonalCacheKey('', { key: 'c7', number: 7 })) || localStorage.getItem('lv_personal_cache@c7');
    out.hwm = localStorage.getItem('lv_inv_hwm@c7');
    rrCollMenuOpen();
    const dl = document.querySelector('[data-deleted-list]');
    out.menu = dl && dl.textContent; out.restoreBtn = !!document.querySelector('[data-restore="c7"]');
    await __rm('rr-coll-menu');
    out.recent = rrRecentlyDeleted().map(x => x.key); out.later = rrRecentlyDeleted(Date.now() + 31 * 86400000).length;
    return out;
  });
  T('D1 an ACTIVE collection cannot be deleted; My Collection never', d.active === 'notArchived' && d.home === 'home', d);
  T('D2 the wrong name → nothing deleted, nothing trashed', d.wrong === 'name' && d.wrongTrash === 0, d);
  T('D3 the confirm says what goes (its sheet with 2 items, all its photos) and what is kept', /its sheet \(2 items\) and all its photos/.test(d.confirm) && /never used again/.test(d.confirm) && /Type the collection’s name \(Hale\)/.test(d.confirm), d.confirm);
  T('D4 the right name (any case, stray spaces) deletes; it was open → home first', d.ok && d.live === 'HOME', d);
  T('D5 the FORWARDING list was saved before anything went to the trash: 45 → 8-46 (Smith), 46 returned on 2026-10-29', d.order && d.entry.fwd && d.entry.fwd['45'] && d.entry.fwd['45'].id === '8-46' && d.entry.fwd['45'].label === '8 – Smith' && d.entry.fwd['46'] && d.entry.fwd['46'].returned === '2026-10-29' && !d.entry.fwd['47'], d.entry);
  T('D6 ONE trash call: the folder — the sheet and the photos inside go with it; backups untouched', JSON.stringify(d.trashCalls) === '["FP7"]' && d.sheetGone && d.backupKept, d);
  T('D7 the record stays (deleted + when, number 7 kept for good); this device forgets it and its stored copies', d.entry.status === 'deleted' && d.entry.at && d.entry.number === 7 && d.reg === null && !d.cache && !d.hwm, d);
  T('D8 Recently deleted lists it with Restore — for 30 days', /Recently deleted \(1\)/.test(d.menu || '') && d.restoreBtn && d.recent.join() === 'c7' && d.later === 0, d);

  // L · labels of a deleted collection (home open)
  console.log('\n== L · labels ==');
  const l = await pg.evaluate(async () => {
    const t7 = _shSheetTagOf('S7'), t8 = _shSheetTagOf('S8');
    const f45 = rrStickerFind('RR1:I:' + t7 + ':45'), f46 = rrStickerFind('RR1:I:' + t7 + ':46'), f47 = rrStickerFind('RR1:I:' + t7 + ':47');
    rrShelveOpen({ kind: 'shelve' });
    await rrShelveCode('RR1:I:' + t7 + ':45');
    const ask = document.getElementById('rr-shelve-ask'); const askText = ask ? ask.textContent : ''; const open = !!(ask && ask.querySelector('[data-sh-open]')); if (ask) ask.remove();
    await rrShelveCode('RR1:I:' + t7 + ':47');
    const st47 = (document.getElementById('rr-shelve-status') || {}).textContent || '';
    await rrShelveCode('RR1:I:' + t7 + ':46');
    const st46 = (document.getElementById('rr-shelve-status') || {}).textContent || '';
    rrShelveClose();
    // in Smith: its No. 12 went to Hale, deleted since
    await rrSwitchCollection('c8', { quietMs: 0, repaint: false });
    const f12 = rrStickerFind('RR1:I:' + t8 + ':12');
    rrShelveOpen({ kind: 'check' });
    await rrShelveCode('RR1:I:' + t8 + ':12');
    const st12 = (document.getElementById('rr-shelve-status') || {}).textContent || '';
    rrShelveClose();
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    return { k45: f45 && f45.kind, d45: f45 && f45.dest && f45.dest.key, k46: f46 && f46.kind, k47: f47 && f47.kind, askText, open, st47, st46, k12: f12 && f12.kind, st12 };
  });
  const today = await pg.evaluate(() => rrToday());
  T('L1 an old label of an item moved out before the delete still forwards: "7-45 was moved to 8 – Smith as 8-46 before Hale was deleted." with Open it', l.k45 === 'moved' && l.d45 === 'c8' && /7-45 was moved to 8 – Smith as 8-46 before Hale was deleted\./.test(l.askText) && l.open, l);
  T('L2 an item still in it when it was deleted: "7-47 — Hale was deleted on <date>."', l.k47 === 'deletedColl' && l.st47.indexOf('7-47 — Hale was deleted on ' + today + '.') >= 0, l);
  T('L3 an item returned to the client: "7-46 was returned to the client on 2026-10-29."', l.k46 === 'deletedColl' && l.st46.indexOf('7-46 was returned to the client on 2026-10-29.') >= 0, l);
  T('L4 moved INTO a collection deleted since: "8-12 moved to 7 – Hale as 7-49 — that collection was deleted on <date>."', l.k12 === 'moved' && l.st12.indexOf('8-12 moved to 7 – Hale as 7-49 — that collection was deleted on ' + today + '.') >= 0, l);

  // Restore
  const r = await pg.evaluate(async () => {
    rrCollMenuOpen();
    const btn = document.querySelector('[data-restore="c7"]');
    const res = await rrRestoreGo('c7', btn);
    await __rm('rr-coll-menu');
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    const out = { ok: res && res.ok, status: e.status, trashed: window.__isTrashed(window.__files.S7), reg: rrCollectionByKey('c7') && rrCollectionByKey('c7').status, fwdKept: !!e.forward };
    // an archived collection's label, from home
    const t7 = _shSheetTagOf('S7');
    rrShelveOpen({ kind: 'shelve' });
    await rrShelveCode('RR1:I:' + t7 + ':47');
    const ask = document.getElementById('rr-shelve-ask');
    out.archText = ask ? ask.textContent : '';
    if (ask) { ask.querySelector('[data-sh-go]').click(); }
    for (let i = 0; i < 40 && state.personalSheetId !== 'S7'; i++) await new Promise(r => setTimeout(r, 100));
    out.openedLive = state.personalSheetId; out.shelveAfter = !!document.getElementById('rr-shelve');
    rrShelveClose();
    await rrSwitchCollection('home', { quietMs: 0, repaint: false });
    // delete again, and Google empties the trash before Restore
    await rrDeleteCollection('c7', 'Hale');
    window.__purged.FP7 = true;
    window.__toasts = [];
    rrCollMenuOpen();
    out.gone = await rrRestoreGo('c7', document.querySelector('[data-restore="c7"]'));
    await __rm('rr-coll-menu');
    out.goneToast = window.__toasts.slice(-1)[0] || '';
    out.goneStatus = JSON.parse(window.__files.LIST.content).items.c7.status;
    return out;
  });
  T('D9 Restore: out of the Drive trash, back as ARCHIVED (listed again); the forwarding list kept', r.ok && r.status === 'archived' && !r.trashed && r.reg === 'archived' && r.fwdKept, r);
  T('L5 an archived collection\'s label: "7-47 is in 7 – Hale, which is archived (read only)." → Open it (read only) opens Hale, not Scan to Shelve', /7-47 is in 7 – Hale, which is archived \(read only\)\./.test(r.archText) && /Open it \(read only\)/.test(r.archText) && r.openedLive === 'S7' && !r.shelveAfter, r);
  T('D10 after Google emptied the trash, Restore says so plainly; the record stays deleted', r.gone && r.gone.why === 'gone' && /already emptied it from the Drive trash — 7 – Hale cannot be restored/.test(r.goneToast) && r.goneStatus === 'deleted', r);
  T('D11 no script error', errs.length === 0, errs);
  await pg.close();

  // a sheet that ended up OUTSIDE its folder is trashed on its own too
  const b = await boot(browser, { sheetOutside: '7' });
  await steady(b.pg);
  await openColl(b.pg, 'c7');
  const o = await b.pg.evaluate(async () => {
    await rrArchiveCollection('c7', { anyway: true });
    window.__calls = [];
    const r = await rrDeleteCollection('c7', 'Hale');
    const trash = window.__calls.filter(c => c.kind === 'trash').map(c => c.id);
    await rrRestoreCollection('c7');
    return { ok: r.ok, trash, back: !window.__isTrashed(window.__files.S7) && !window.__isTrashed(window.__files.FP7) };
  });
  T('D12 a sheet outside its folder is put in the trash too — and comes back with Restore', o.ok && JSON.stringify(o.trash) === '["FP7","S7"]' && o.back, o);
  await b.pg.close();
}

// ── K · every button really works when TAPPED (not only when called) ──────
async function clickRun(browser) {
  console.log('\n== K · the buttons, tapped ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await pg.evaluate(async () => { await rrCollectionsLoad(); if (!document.getElementById('main-content')) document.body.appendChild(Object.assign(document.createElement('div'), { id: 'main-content' })); });
  const k = await pg.evaluate(async () => {
    const until = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 100 && !fn(); i++) await new Promise(r => setTimeout(r, 100)); return !!fn(); };
    const out = {};
    rrCollMenuOpen();
    const row = [...document.querySelectorAll('#rr-coll-list > button')].find(b => /7 – Hale/.test(b.textContent));
    row.click();
    out.switched = await until(() => state.personalSheetId === 'S7' && Object.keys(state.personalData || {}).length === 4);
    rrCollHeaderPaint();
    const det = [...document.querySelectorAll('#rr-coll-header button')].find(b => /Details/.test(b.textContent));
    det.click();
    out.details = await until(() => !!document.getElementById('rr-coll-details'), 2000);
    document.querySelector('#rr-coll-details [data-arch-open]').click();
    out.archiveScreen = await until(() => !!document.querySelector('#rr-arch-body [data-arch-anyway]'));
    document.querySelector('#rr-arch-body [data-arch-anyway]').click();
    out.archived = await until(() => JSON.parse(window.__files.LIST.content).items.c7.status === 'archived');
    await __rm('rr-coll-archive');
    rrCollHeaderPaint();
    document.querySelector('#rr-coll-archived-banner button').click();
    out.unarchived = await until(() => JSON.parse(window.__files.LIST.content).items.c7.status === 'active');
    const key = Object.keys(state.personalData)[0];
    const holder = document.createElement('div'); holder.innerHTML = rrMoveBtnHtml(state.personalData[key]); document.body.appendChild(holder);
    holder.querySelector('#detail-move-item').click();
    out.moveScreen = await until(() => !!document.getElementById('rr-move-box') || !!document.querySelector('input[name="rr-move-to"]'), 2000);
    return out;
  });
  T('K1 tapping a collection in the drop-down opens it', k.switched, k);
  T('K2 tapping Details opens the details card; Archive this collection… opens the archive screen; Archive anyway archives', k.details && k.archiveScreen && k.archived, k);
  T('K3 tapping Un-archive on the banner un-archives', k.unarchived, k);
  T('K4 tapping "Move to another collection…" on an item opens the move screen', k.moveScreen, k);
  T('K5 no script error (a bare value in a button is a "not defined" error here)', errs.length === 0, errs);
  await pg.close();
}

// ── X · a regular customer ─────────────────────────────────────────────────
async function offRun(browser) {
  console.log('\n== X · a regular customer ==');
  const { pg, errs } = await boot(browser, { off: true, onlyHome: true });
  await steady(pg);
  const x = await pg.evaluate(async () => {
    window.__calls = [];
    await sheetsUpdate('HOME', 'My Collection!ZZ3', [['a']]);
    await sheetsAppend('HOME', 'My Collection!A:A', [['1666']]);
    await driveUploadFile(new Blob(['x'], { type: 'image/jpeg' }), 'INBOX 1 g1 a.jpg', 'INBOXF');
    await driveFindOrCreateFolder('2343', 'HOME-ROOT');
    return { reads: window.__calls.filter(c => c.kind === 'listRead').length, writes: window.__calls.filter(c => c.kind === 'put' || c.kind === 'append' || c.kind === 'upload' || c.kind === 'folderMade').length, body: document.body.classList.contains('rr-coll-archived') };
  });
  T('X1 a regular customer: every write goes through as before; the collections list is never read', x.reads === 0 && x.writes >= 4 && !x.body, x);
  T('X2 no script error', errs.length === 0, errs);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await archiveRun(browser);
    await deleteRun(browser);
    await clickRun(browser);
    await offRun(browser);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
