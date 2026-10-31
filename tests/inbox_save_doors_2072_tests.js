#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EVERY SAVE DOOR TAKES THE PHOTO INBOX'S PHOTOS — v0.9.2072 (fast tier; the
// real-browser walk is inbox_save_doors_roads_2072_tests.js)
//
// PLAN_2026-10-30_INBOX_PAPER_SAVES.md. An add that starts in the Photo Inbox
// holds its photos until the save. Three saves never took them: a paper
// Catalog, a paper Instruction Sheet, and a Science / Construction Set match.
//
//   D  THE RULE. Every function in the app that saves a row AND ends the add
//      (closes the Add screen, or marks the add saved) is found by reading the
//      source — never typed into this test. Each one must arm the hold
//      (rrPinSetPhotoSaved), file the photos itself (_rrInboxPhotosFile), or be
//      a NAMED exception whose reason is checked against the source too.
//   U  THE ONE MOVER (photo-inbox-tools.js): rrPinFileHoldNow and
//      _pinMoveNoteFiles, run on their own with a pretend Drive — all moved,
//      some failed, offline, no folder, nothing held, a broken mover.
//   W  THE SAVE'S SIDE (wizard-save.js): the folder is asked for only when
//      there is something to file and a connection; what stayed is SAID.
//   S  SOURCE ORDER: the photos move only AFTER the row is saved.
//   P  PLANTED: each undone is caught.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PIN = require('./lib/pin-source');
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (typeof d === 'string' ? d : JSON.stringify(d)))); c ? pass++ : fail++; }
function grab(src, header) {
  const i = src.indexOf(header); if (i < 0) throw new Error('not found: ' + header);
  const o = src.indexOf('{', i); let d = 0;
  for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + header);
}
function plant(src, from, to, label) { if (src.indexOf(from) < 0) throw new Error('planted "' + label + '" no longer matches — update the test'); return src.split(from).join(to); }

// Every app file, the Photo Inbox read the ONE way (as one entry).
function appFiles(over) {
  const raw = {};
  fs.readdirSync(APP).filter(f => /\.js$/.test(f)).forEach(f => { raw[f] = read(f); });
  const merged = PIN.pinMerge(raw, '');
  return Object.assign(merged, over || {});
}

// ── D · the rule ───────────────────────────────────────────────────────────
const WRITES = /\b(?:sheetsAppend|sheetsUpdate|sheetsUpdateRow|rrVerifiedRowUpdate)\(/;
const ENDS = /\b(?:_doCloseWizard|closeWizard)\(|_saveComplete\s*=\s*true/;
const TAKES = /\brrPinSetPhotoSaved\(|\b_rrInboxPhotosFile\(/;
function functionsOf(src) {
  const out = [], re = /^[ \t]*(?:async[ \t]+)?function[ \t]+([\w$]+)[ \t]*\(/mg; let m;
  while ((m = re.exec(src))) {
    const o = src.indexOf('{', m.index); let d = 0, end = -1;
    for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { end = k; break; } } }
    if (end > 0) out.push({ name: m[1], body: src.slice(m.index, end + 1) });
  }
  return out;
}
function saveDoors(files) {
  const doors = [];
  Object.keys(files).forEach(f => functionsOf(files[f]).forEach(fn => {
    if (WRITES.test(fn.body) && ENDS.test(fn.body)) doors.push({ file: f, name: fn.name, takes: TAKES.test(fn.body), body: fn.body });
  }));
  return doors;
}
// The named exceptions. Each reason is CHECKED — if the source stops agreeing,
// the exception stops counting and the door must take the photos.
const callersOutside = (files, fnName, home) => Object.keys(files).filter(f => f !== home && f !== 'health-check.js'
  && new RegExp('\\b' + fnName + '\\(').test(files[f].replace(new RegExp('function\\s+' + fnName + '\\(', 'g'), '')));
const EXCEPTIONS = {
  quickEntryAdd: {
    why: 'Quick Entry was taken out in v0.9.1116 — nothing outside its own file opens it, and its only button is inside its own screen',
    holds: (F) => callersOutside(F, 'quickEntryAdd', 'wizard-quickentry.js').length === 0
               && callersOutside(F, '_showQuickEntryMultiUI', 'wizard-quickentry.js').length === 0,
  },
  _quickEntrySaveSet: {
    why: 'the set Quick Entry went with it — the only road in needs _setPhotoThenSave, and nothing in the app sets it',
    holds: (F) => !Object.keys(F).some(f => /_setPhotoThenSave\s*(?:=(?!=)|:)/.test(F[f])),
  },
  saveSet: {
    why: 'the set’s own record — each piece saved before it through saveWizardItem, which arms that piece’s photos',
    holds: (F) => {
      const ss = functionsOf(F['wizard-save.js']).find(f => f.name === 'saveSet');
      const wi = functionsOf(F['wizard-save.js']).find(f => f.name === 'saveWizardItem');
      return !!ss && !!wi && !/PERSONAL_TAB\s*\+\s*'!A/.test(ss.body) && /rrPinSetPhotoSaved\(/.test(wi.body);
    },
  },
  savePhotoOnlyUpdate: {
    why: 'adds photos to an item you already own — opened only from that item’s own page, never from the Photo Inbox',
    holds: (F) => {
      const setters = Object.keys(F).filter(f => /_photoOnly\s*:\s*true|_photoOnly\s*=\s*true/.test(F[f]));
      return setters.length === 1 && setters[0] === 'app-collection.js' && !/_photoOnly/.test(F['photo-inbox.js']);
    },
  },
};
function ruleBreaks(files) {
  const doors = saveDoors(files), bad = [];
  doors.forEach(d => {
    if (d.takes) return;
    const ex = EXCEPTIONS[d.name];
    if (!ex) bad.push(d.file + ' ' + d.name + ': saves and ends the add, but never takes the inbox photos');
    else if (!ex.holds(files)) bad.push(d.file + ' ' + d.name + ': its exception no longer holds (' + ex.why + ')');
  });
  Object.keys(EXCEPTIONS).forEach(n => { if (!doors.some(d => d.name === n)) bad.push(n + ': named as an exception but no longer a save door — take it off the list'); });
  return { doors, bad };
}
console.log('\n== D · every save door takes the inbox photos ==');
const FILES = appFiles();
{
  const r = ruleBreaks(FILES);
  r.doors.forEach(d => console.log('      door: ' + d.file + ' ' + d.name + (d.takes ? '  — takes the photos' : '  — exception: ' + EXCEPTIONS[d.name].why)));
  ok('D1 the save doors are found by reading the app (at least the ten known today)', r.doors.length >= 10, r.doors.map(d => d.name));
  ok('D2 every save door arms the hold, files the photos itself, or is a checked exception', r.bad.length === 0, r.bad);
  const need = ['saveInstructionSheet', '_saveCatalogFromPaper', '_saveScienceConstructionItem', 'saveWizardItem', 'saveEphemeraItem', '_saveManualEntry'];
  ok('D3 the six that take photos today are all found AS takers', need.every(n => r.doors.some(d => d.name === n && d.takes)), need.filter(n => !r.doors.some(d => d.name === n && d.takes)));
  ok('D4 each exception gives its reason in words', Object.keys(EXCEPTIONS).every(n => EXCEPTIONS[n].why.length > 30));
}

// ── U · the one mover ──────────────────────────────────────────────────────
console.log('\n== U · the one mover (rrPinFileHoldNow + _pinMoveNoteFiles) ==');
const TOOLS = PIN.pinPieces()['photo-inbox-tools.js'];
const TS = 1793400000000;
function holdBox(tools, opts, stageObj) {
  const ls = { rr_inbox_setstage: JSON.stringify(stageObj || {}) };
  const rec = { moves: [], renames: [], ensured: [], dropped: [], refreshed: 0 };
  const sb = {
    window: {}, SETSTAGE_KEY: 'rr_inbox_setstage', console: { log() {}, warn() {} },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    _pendList: v => (Array.isArray(v) ? v : (v ? [v] : [])),
    _pinOffline: () => !!opts.offline,
    _folder: async () => { if (opts.folderThrows) throw new Error('no inbox'); return 'INBOXFID'; },
    _pinRefresh: () => { rec.refreshed++; },
    driveMoveFileToFolder: async (id, f, t) => { if ((opts.fail || []).indexOf(id) >= 0) throw new Error('gone'); rec.moves.push([id, f, t]); },
    driveRequest: async (m, u, b) => { rec.renames.push([u, b && b.name]); return {}; },
  };
  sb.window.rrPinEnsureStaged = (k, ids) => { rec.ensured.push([k, ids]); };
  sb.window.rrPinDropStaged = (k, ids) => {
    rec.dropped.push([k, ids]);
    const st = JSON.parse(ls.rr_inbox_setstage || '{}'); delete st[k]; ls.rr_inbox_setstage = JSON.stringify(st);
  };
  vm.createContext(sb);
  vm.runInContext(grab(tools, 'async function _pinMoveNoteFiles(rec, num)') + '\n' + grab(tools, 'window.rrPinFileHoldNow = async function') + ';', sb);
  return { run: (...a) => sb.window.rrPinFileHoldNow(...a), rec, stage: () => JSON.parse(ls.rr_inbox_setstage || '{}') };
}
const NOTE = () => ({ link: '', fromFid: 'INBOXFID', toFid: '', ts: TS, rsvFid: 'm1',
  files: [{ id: 'm1', name: 'IMG_4001.jpg', role: '' }, { id: 'm2', name: 'IMG_4002.PNG', role: 'together' }] });
(async () => {
  {
    const h = holdBox(TOOLS, {}, { '20-20169-3': NOTE(), '773': { ts: TS, files: [{ id: 'x9' }] } });
    const r = await h.run('20-20169-3', ['m1', 'm2'], 'CATFID', '8055-CON');
    ok('U1 all moved: the count says so', r.total === 2 && r.moved === 2 && r.failed === 0 && r.offline === false, r);
    ok('U2 every photo goes from the inbox into the item’s folder', JSON.stringify(h.rec.moves) === JSON.stringify([['m1', 'INBOXFID', 'CATFID'], ['m2', 'INBOXFID', 'CATFID']]), h.rec.moves);
    ok('U3 named the way every filed inbox photo is: "<number> RSV|SET|ADD <time>.<ext>"',
       JSON.stringify(h.rec.renames) === JSON.stringify([['/files/m1', '8055-CON RSV ' + (TS + 1) + '.jpg'], ['/files/m2', '8055-CON SET ' + (TS + 2) + '.png']]), h.rec.renames);
    ok('U4 the hold is let go, and only this add’s', !('20-20169-3' in h.stage()) && ('773' in h.stage()), h.stage());
    ok('U5 the safety net is asked first (a lost hold is written again before filing)', h.rec.ensured.length === 1 && h.rec.ensured[0][0] === '20-20169-3');
    ok('U6 the inbox is re-drawn', h.rec.refreshed === 1);
  }
  {
    const h = holdBox(TOOLS, { fail: ['m2'] }, { k: NOTE() });
    const r = await h.run('k', ['m1', 'm2'], 'CATFID', 'N');
    ok('U7 one fails: 1 moved, 1 failed, and the failed one is not renamed', r.moved === 1 && r.failed === 1 && h.rec.renames.length === 1 && h.rec.renames[0][0] === '/files/m1', { r, ren: h.rec.renames });
    ok('U8 ...and the hold is still let go (the failed photo is free in the inbox)', !('k' in h.stage()));
  }
  {
    const h = holdBox(TOOLS, { offline: true }, { k: NOTE() });
    const r = await h.run('k', ['m1', 'm2'], '', 'N');
    ok('U9 offline: nothing moves, all counted as stayed, and it says offline', r.total === 2 && r.moved === 0 && r.failed === 2 && r.offline === true && !h.rec.moves.length, r);
    ok('U10 ...and the hold is let go — nothing left "spoken for"', !('k' in h.stage()));
  }
  {
    const h = holdBox(TOOLS, {}, { k: NOTE() });
    const r = await h.run('k', ['m1', 'm2'], '', 'N');
    ok('U11 online but no folder (Drive refused it): nothing moves, NOT called offline', r.failed === 2 && r.offline === false && !h.rec.moves.length && !('k' in h.stage()), r);
  }
  {
    const h = holdBox(TOOLS, {}, { other: { ts: TS, files: [{ id: 'x9' }] } });
    const r = await h.run('k', ['m1'], 'CATFID', 'N');
    ok('U12 nothing held for these photos: nothing moves, nothing else is touched', r.total === 0 && !h.rec.moves.length && ('other' in h.stage()) && !h.rec.dropped.length, r);
    const r2 = await h.run('', ['m1'], 'CATFID', 'N'), r3 = await h.run('k', [], 'CATFID', 'N');
    ok('U13 no key or no photos: nothing at all happens', r2.total === 0 && r3.total === 0 && h.rec.ensured.length === 1);
  }
  {
    const n = NOTE(); delete n.fromFid;
    const h = holdBox(TOOLS, {}, { k: n });
    await h.run('k', ['m1', 'm2'], 'CATFID', 'N');
    ok('U14 a hold written without the inbox folder finds it', h.rec.moves.length === 2 && h.rec.moves[0][1] === 'INBOXFID', h.rec.moves);
  }
  {
    const n = NOTE(); delete n.fromFid;
    const h = holdBox(TOOLS, { folderThrows: true }, { k: n });
    const r = await h.run('k', ['m1', 'm2'], 'CATFID', 'N');
    ok('U15 a mover that breaks part-way: counted as stayed, hold still let go, never thrown at the save', r.failed === 2 && r.moved === 0 && !('k' in h.stage()), r);
  }
  {
    const h = holdBox(TOOLS, {}, { k: NOTE() });
    await h.run('k', ['m1', 'm2'], 'CATFID', '');
    ok('U16 no number given: the hold’s own number names the files', /^\/files\/m1$/.test(h.rec.renames[0][0]) && /^k RSV /.test(h.rec.renames[0][1]), h.rec.renames);
  }
  {
    const fp = grab(TOOLS, 'async function _flushPending()');
    ok('U17 the background mover uses the ONE mover — no second move loop of its own', /await _pinMoveNoteFiles\(rec, num\);/.test(fp) && !/driveMoveFileToFolder\(/.test(fp));
  }

  // ── W · the save's side ──────────────────────────────────────────────────
  console.log('\n== W · the save’s side (wizard-save.js) ==');
  const WS = read('wizard-save.js'), CFG = read('config.js');
  const WORDS = (() => { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(grab(CFG, 'const RR_INBOX_PHOTOS_STAYED = {') + ';this.W = RR_INBOX_PHOTOS_STAYED;', sb); return sb.W; })();
  function saveBox(ws, opts) {
    const rec = { folderAsked: 0, filed: [], said: [] };
    const sb = {
      window: { _offlineMode: !!opts.offline }, navigator: { onLine: true }, console: { warn() {} },
      RR_INBOX_PHOTOS_STAYED: WORDS,
      driveFolderLink: id => 'https://drive.google.com/drive/folders/' + id,
      rrPinFileHoldNow: async (k, ids, fid, num) => { rec.filed.push([k, ids, fid, num]); return opts.result; },
      rrSaveNotice: t => rec.said.push(t),
    };
    if (opts.noMover) delete sb.rrPinFileHoldNow;
    vm.createContext(sb);
    vm.runInContext(grab(ws, 'function _rrInboxHoldIds(d)') + '\n' + grab(ws, 'async function _rrInboxPhotosPrep(d, folderFn)') + '\n' + grab(ws, 'async function _rrInboxPhotosFile(d, prep, num)')
      + '\nthis.prep = _rrInboxPhotosPrep; this.file = _rrInboxPhotosFile;', sb);
    const folderFn = async () => { rec.folderAsked++; if (opts.folderThrows) throw new Error('drive'); return 'CATFID'; };
    return { sb, rec, prep: d => sb.prep(d, folderFn), file: (d, p, n) => sb.file(d, p, n) };
  }
  const D = { _pinStagedNum: '20-20169-3', _addPhotoDriveIds: ['m1', 'm2'], _addPhotoDriveId: 'm1' };
  {
    const b = saveBox(WS, {});
    const p = await b.prep({});
    ok('W1 an add that did not start in the inbox: no folder asked for, nothing to file', p === null && b.rec.folderAsked === 0);
    const p1 = await b.prep({ _pinStagedNum: 'X', _addPhotoDriveId: 'm7' });
    ok('W2 one held photo is enough (the older single-photo hand-over)', p1 && p1.ids.length === 1 && p1.ids[0] === 'm7');
  }
  {
    const b = saveBox(WS, { result: { total: 2, moved: 2, failed: 0, offline: false } });
    const p = await b.prep(D);
    ok('W3 online: the item’s folder is asked for once, and its link is ready for the row', b.rec.folderAsked === 1 && p.fid === 'CATFID' && p.link === 'https://drive.google.com/drive/folders/CATFID', p);
    await b.file(D, p, '8055-CON');
    ok('W4 the photos go under the number the item saved as, from this add’s hold', JSON.stringify(b.rec.filed[0]) === JSON.stringify(['20-20169-3', ['m1', 'm2'], 'CATFID', '8055-CON']), b.rec.filed);
    ok('W5 all moved: nothing extra is said', b.rec.said.length === 0, b.rec.said);
  }
  {
    const b = saveBox(WS, { offline: true, result: { total: 2, moved: 0, failed: 2, offline: true } });
    const p = await b.prep(D);
    ok('W6 offline: the folder is never asked for', b.rec.folderAsked === 0 && p.fid === '' && p.link === '');
    await b.file(D, p, 'N');
    ok('W7 offline: it SAYS the photos stayed in the inbox and nothing was lost', b.rec.said.length === 1 && /^Its 2 photos from the Photo Inbox stayed in the inbox — you’re offline\. Nothing was lost\.$/.test(b.rec.said[0]), b.rec.said);
  }
  {
    const b = saveBox(WS, { result: { total: 1, moved: 0, failed: 1, offline: true } });
    await b.file(D, { ids: ['m1'], fid: '' }, 'N');
    ok('W8 one photo, offline: said in the singular', b.rec.said[0] === WORDS.offlineOne, b.rec.said);
  }
  {
    const b = saveBox(WS, { result: { total: 3, moved: 1, failed: 2, offline: false } });
    await b.file(D, { ids: ['a', 'b', 'c'], fid: 'F' }, 'N');
    ok('W9 part failed: says how many stayed', b.rec.said[0] === '2 photos from the Photo Inbox could not be moved and stayed in the inbox. Nothing was lost.', b.rec.said);
    const b2 = saveBox(WS, { result: { total: 2, moved: 1, failed: 1, offline: false } });
    await b2.file(D, { ids: ['a', 'b'], fid: 'F' }, 'N');
    ok('W10 one failed: said in the singular', b2.rec.said[0] === WORDS.failedOne, b2.rec.said);
  }
  {
    const b = saveBox(WS, { folderThrows: true, result: { total: 2, moved: 0, failed: 2, offline: false } });
    const p = await b.prep(D);
    ok('W11 Drive refuses the folder: the save goes on (no throw), with no folder', p && p.fid === '' && p.link === '');
    await b.file(D, p, 'N');
    ok('W12 ...and that is said as "could not be moved", not "offline"', b.rec.said[0] === WORDS.failedMany.split('{n}').join('2'), b.rec.said);
  }
  {
    const b = saveBox(WS, { noMover: true });
    ok('W13 a page without the Photo Inbox: nothing is attempted', (await b.prep(D)) === null && b.rec.folderAsked === 0);
  }
  ok('W14 the words are in config.js once, and no word "AI" in them', Object.keys(WORDS).length === 4 && !/\bAI\b/.test(JSON.stringify(WORDS))
     && !/from the Photo Inbox (?:stayed|could not be moved)/.test(WS) && !/from the Photo Inbox (?:stayed|could not be moved)/.test(TOOLS));
  ok('W15 the notice rides the "saved" message (rrSaveNotice in write-outbox.js carries it like rrSaveMissed)',
     /function rrSaveNotice\(text\) \{[\s\S]*?_rrCarryPush\(text\);/.test(read('write-outbox.js')) && /window\.rrSaveNotice = rrSaveNotice;/.test(read('write-outbox.js')));

  // ── S · source order ─────────────────────────────────────────────────────
  console.log('\n== S · the photos move only after the row is saved ==');
  const order = (body, a, b) => body.indexOf(a) >= 0 && body.indexOf(b) >= 0 && body.indexOf(a) < body.indexOf(b);
  const CAT = grab(WS, 'async function _saveCatalogFromPaper()');
  ok('S1 Catalog: folder made BEFORE the row (its link goes on the row) …', order(CAT, '_rrInboxPhotosPrep(d,', "const row = ["));
  ok('S2 … photos moved AFTER the row is saved', order(CAT, "sheetsAppend(state.personalSheetId, 'Catalogs!A:J'", '_rrInboxPhotosFile(d, _inboxCat, itemNum)'));
  ok('S3 Catalog: the row keeps its own photo link when it has one', /if \(!photoFolderLink && _inboxCat && _inboxCat\.link\) photoFolderLink = _inboxCat\.link;/.test(CAT));
  ok('S4 Catalog: the folder is the same per-number folder its Add-screen photos use', /_rrInboxPhotosPrep\(d, async function \(\) \{ await driveEnsureSetup\(\); return driveEnsureItemFolder\(itemNum\); \}\)/.test(CAT)
     && /const catFolderId = await driveEnsureItemFolder\(itemNum\);/.test(CAT));
  ok('S5 Catalog: a real save is marked saved before the close (the close must not treat it as abandoned)', order(CAT, 'd._saveComplete = true;', '_doCloseWizard();'));
  const SC = grab(WS, 'async function _saveScienceConstructionItem(sheetTabName, stateKey)');
  ok('S6 Science/Construction: folder before the row, photos after it', order(SC, '_rrInboxPhotosPrep(d,', 'const row = [') && order(SC, "sheetsAppend(state.personalSheetId, sheetTabName + '!A:O'", '_rrInboxPhotosFile(d, _inboxSc, itemNum)'));
  ok('S7 Science/Construction: the same folder name its Add-screen photos use', (SC.match(/itemNum \+ ' ' \+ \(description \|\| sheetTabName\)\.substring\(0, 40\)/g) || []).length === 2);
  const IS = grab(WS, 'async function saveInstructionSheet()');
  ok('S8 Instruction Sheet: checks, re-keys and arms the hold under the sheet’s own number, after the row', order(IS, '_stampSaved(state.personalData[isStandaloneInvId]);', 'rrPinEnsureStaged(d._pinStagedNum')
     && order(IS, 'rrPinEnsureStaged(d._pinStagedNum', 'rrPinRekeyStaged(d._pinStagedNum, _isItemNum)') && order(IS, 'rrPinRekeyStaged(d._pinStagedNum, _isItemNum)', 'rrPinSetPhotoSaved(_isItemNum)')
     && order(IS, 'rrPinSetPhotoSaved(_isItemNum)', 'closeWizard();'));

  // ── P · planted ──────────────────────────────────────────────────────────
  console.log('\n== P · planted ==');
  {
    const F = appFiles({ 'wizard-save.js': plant(WS, "    await _rrInboxPhotosFile(d, _inboxCat, itemNum);   // v0.9.2072: the row is saved — now the photos move\n", '', 'catalog file') });
    const r = ruleBreaks(F);
    ok('P1 a Catalog save that forgets the photos turns the rule red', r.bad.some(b => /_saveCatalogFromPaper/.test(b)), r.bad);
  }
  {
    const F = appFiles({ 'wizard-save.js': WS + "\nasync function saveBrandNewThing() { await sheetsAppend(state.personalSheetId, 'Posters!A:A', [[1]]); _doCloseWizard(); }\n" });
    const r = ruleBreaks(F);
    ok('P2 a NEW save door added later that forgets the photos turns it red', r.bad.some(b => /saveBrandNewThing/.test(b)), r.bad);
  }
  {
    const F = appFiles({ 'wizard-save.js': WS + "\nasync function saveMarkedOnly() { await sheetsUpdate(state.personalSheetId, 'X!A1', [[1]]); wizard.data._saveComplete = true; }\n" });
    ok('P3 a door that only MARKS the add saved (no close) is still a door', ruleBreaks(F).bad.some(b => /saveMarkedOnly/.test(b)));
  }
  {
    const pi = FILES['photo-inbox.js'] + "\n;window.__x = function () { quickEntryAdd(); };\n";
    ok('P4 something that opens Quick Entry again ends its exception', ruleBreaks(appFiles({ 'photo-inbox.js': pi })).bad.some(b => /quickEntryAdd: its exception/.test(b)));
  }
  {
    const wz = read('wizard.js') + "\n;function _x() { wizard.data._setPhotoThenSave = true; }\n";
    ok('P5 something that sets _setPhotoThenSave again ends the set Quick Entry exception', ruleBreaks(appFiles({ 'wizard.js': wz })).bad.some(b => /_quickEntrySaveSet: its exception/.test(b)));
  }
  {
    const pi = FILES['photo-inbox.js'] + "\n;window.__y = function () { wizard.data._photoOnly = true; };\n";
    ok('P6 the Photo Inbox opening a photo-only update ends that exception', ruleBreaks(appFiles({ 'photo-inbox.js': pi })).bad.some(b => /savePhotoOnlyUpdate: its exception/.test(b)));
  }
  {
    const wi = grab(WS, 'async function saveWizardItem(');
    const ws = plant(WS, wi, wi.split('rrPinSetPhotoSaved(').join('rrPinSetPhotoSavedGONE('), 'piece arm');
    ok('P7 saveWizardItem without its arm ends the set exception too', ruleBreaks(appFiles({ 'wizard-save.js': ws })).bad.some(b => /saveSet: its exception|saveWizardItem/.test(b)));
  }
  {
    const ws = WS.replace(/async function savePhotoOnlyUpdate\(\)/, 'async function savePhotoOnlyUpdateGone()');
    ok('P8 an exception that is no longer a door must come off the list', ruleBreaks(appFiles({ 'wizard-save.js': ws })).bad.some(b => /savePhotoOnlyUpdate: named as an exception/.test(b)));
  }
  {
    const old = plant(TOOLS, "      if (typeof window.rrPinDropStaged === 'function') window.rrPinDropStaged(k, ids);\n      try { _pinRefresh(); } catch (eR) {}", "      try { _pinRefresh(); } catch (eR) {}", 'drop');
    const h = holdBox(old, {}, { k: NOTE() }); await h.run('k', ['m1', 'm2'], 'CATFID', 'N');
    ok('P9 a mover that keeps the hold fails U4 (the photos stay "spoken for")', 'k' in h.stage());
  }
  {
    const old = plant(TOOLS, '        out.offline = _pinOffline(); out.failed = files.length;', '        out.failed = 0;', 'offline count');
    const h = holdBox(old, { offline: true }, { k: NOTE() }); const r = await h.run('k', ['m1', 'm2'], '', 'N');
    ok('P10 an offline count of zero fails U9 (nothing would be said)', !(r.failed === 2 && r.offline === true));
  }
  {
    const old = plant(TOOLS, "        var _vTag = (rec.rsvFid && file.id === rec.rsvFid) ? ' RSV '", "        var _vTag = false ? ' RSV '", 'rsv');
    const h = holdBox(old, {}, { k: NOTE() }); await h.run('k', ['m1', 'm2'], 'CATFID', 'N');
    ok('P11 a mover that forgets the Right Side View fails U3', !/ RSV /.test(h.rec.renames[0][1]));
  }
  {
    const ws = plant(WS, '  if (left > 0 && typeof rrSaveNotice', '  if (false && typeof rrSaveNotice', 'say');
    const b = saveBox(ws, { offline: true, result: { total: 2, moved: 0, failed: 2, offline: true } });
    await b.file(D, { ids: ['m1', 'm2'], fid: '' }, 'N');
    ok('P12 a save that does not say what stayed fails W7', b.rec.said.length === 0);
  }
  {
    const ws = plant(WS, "  if (!offline) { try { fid = await folderFn(); }", "  { try { fid = await folderFn(); }", 'offline folder');
    const b = saveBox(ws, { offline: true }); await b.prep(D);
    ok('P13 a save that asks Drive for a folder while offline fails W6', b.rec.folderAsked === 1);
  }
  {
    const fp = plant(TOOLS, '          await _pinMoveNoteFiles(rec, num);   // v0.9.2072: the ONE mover (also used by rrPinFileHoldNow)',
      '          for (var fi = 0; fi < rec.files.length; fi++) { await driveMoveFileToFolder(rec.files[fi].id, rec.fromFid, rec.toFid); }', 'loop');
    const b = grab(fp, 'async function _flushPending()');
    ok('P14 a second move loop back in the background mover fails U17', !( /await _pinMoveNoteFiles\(rec, num\);/.test(b) && !/driveMoveFileToFolder\(/.test(b)));
  }
  {
    const ws = plant(WS, "    await _rrInboxPhotosFile(d, _inboxCat, itemNum);   // v0.9.2072: the row is saved — now the photos move\n", '', 'cat after');
    const ws2 = ws.replace("  const _inboxCat = await _rrInboxPhotosPrep(", "  await _rrInboxPhotosFile(d, _inboxCat, itemNum);\n  const _inboxCat = await _rrInboxPhotosPrep(");
    const c = grab(ws2, 'async function _saveCatalogFromPaper()');
    ok('P15 photos moved BEFORE the row is saved fails S2', !order(c, "sheetsAppend(state.personalSheetId, 'Catalogs!A:J'", '_rrInboxPhotosFile(d, _inboxCat, itemNum)'));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite itself broke: ' + (e && e.stack || e)); process.exit(1); });
