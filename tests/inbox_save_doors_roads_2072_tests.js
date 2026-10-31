#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO INBOX → ADD → EVERY KIND OF SAVE, AS AN iPHONE — v0.9.2072
//
// PLAN_2026-10-30_INBOX_PAPER_SAVES.md. Mike's two photos (m1 = Right Side View,
// m2) wait in the Photo Inbox; Add; then the add is saved as each kind of item.
// A pretend Drive records every move and rename, a pretend Sheets every row.
// The rule test (every save door, read from the source) is
// inbox_save_doors_2072_tests.js; each fix undone is inbox_save_doors_planted_2072_tests.js.
//
//   C  Paper Item → Catalog: the photos move into the catalog's own folder, the
//      row points there, the hold is let go, nothing is "spoken for" after;
//      offline and a part-failed move SAY what stayed in the inbox
//   I  Paper Item → Instruction Sheet: armed under the sheet's number and filed
//      into its own folder, exactly as a train is
//   K  a catalog match that is a Science Set, and one that is a Construction Set
//   R  the roads that already worked, walked again: a train, a paper item
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const { DOOR_ROADS: R, H } = require('./lib/inbox-door-roads');
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 600)))); c ? pass++ : fail++; }
const ids = (moves) => moves.map(m => m[0]).join(',');
const into = (moves, fid) => moves.length && moves.every(m => m[1] === 'INBOXFID' && m[2] === fid);

(async () => {
  if (!H.chromium) { console.log('FAIL  Playwright is not available — this suite cannot run'); process.exit(1); }
  const br = await H.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    console.log('\n== C · Paper Item → Catalog ==');
    {
      const a = await R.catalog(br, 'ok');
      ok('C1 the add held its two inbox photos before the save', a.held.length === 1 && a.held[0] === '20-20169-3', a.held);
      ok('C2 the catalog saved to the Catalogs tab', a.rec.rows.length === 1 && a.rec.rows[0][0] === 'Catalogs!A:J' && !a.saveErr, a.rec.rows);
      const num = a.rec.rows[0][1][0];
      ok('C3 both photos moved from the inbox into that catalog’s own folder', ids(a.rec.moves) === 'm1,m2' && into(a.rec.moves, 'ITEMFID-' + num), a.rec.moves);
      ok('C4 named under the catalog’s number, the first as its Right Side View', a.rec.renames.length === 2 && a.rec.renames[0][1].indexOf(num + ' RSV ') === 0 && a.rec.renames[1][1].indexOf(num + ' ADD ') === 0, a.rec.renames);
      ok('C5 the row points at the folder', a.rec.rows[0][1][9] === 'https://drive.google.com/drive/folders/ITEMFID-' + num, a.rec.rows[0][1][9]);
      ok('C6 the hold is let go, nothing armed or left behind', !Object.keys(a.stage).length && !Object.keys(a.pend).length, { stage: a.stage, pend: a.pend });
      ok('C7 the Add screen closed with the plain "saved" message — nothing extra said', !a.open && /Catalog saved!/.test(a.toast) && !/Photo Inbox/.test(a.toast) && !a.carry, a.toast);
      ok('C8 the same photos looked at again: no "spoken for"', a.again && !H.spokenFor(a.again) && a.again.open, a.again && a.again.dialog);
      ok('C9 no page errors', !a.errs.length, a.errs);
    }
    {
      const a = await R.catalog(br, 'offline');
      ok('C10 offline: the catalog still saves', a.rec.rows.length === 1 && a.rec.rows[0][0] === 'Catalogs!A:J' && !a.open, a.rec.rows);
      ok('C11 offline: no photo moves, no folder link on the row', !a.rec.moves.length && a.rec.rows[0][1][9] === '', a.rec.rows[0][1][9]);
      ok('C12 offline: it SAYS both photos stayed in the inbox and nothing was lost', /its 2 photos from the Photo Inbox stayed in the inbox — you’re offline\. Nothing was lost\./.test(a.toast), a.toast);
      ok('C13 offline: the hold is let go — nothing "spoken for"', !Object.keys(a.stage).length && !Object.keys(a.pend).length, a.stage);
      ok('C14 no page errors', !a.errs.length, a.errs);
    }
    {
      const a = await R.catalog(br, 'partial');
      ok('C15 one photo will not move: the other still goes with the catalog', ids(a.rec.moves) === 'm1' && a.rec.renames.length === 1, a.rec);
      ok('C16 ...and it SAYS one stayed in the inbox', /1 photo from the Photo Inbox could not be moved and stayed in the inbox\. Nothing was lost\./.test(a.toast), a.toast);
      ok('C17 ...and the hold is let go', !Object.keys(a.stage).length && !Object.keys(a.pend).length, a.stage);
    }

    console.log('\n== I · Paper Item → Instruction Sheet ==');
    {
      const a = await R.instructionSheet(br);
      ok('I1 the sheet saved to the Collection as 2343-IS', a.rec.rows.length === 1 && a.rec.rows[0][0] === 'My Collection!A:A' && /2343-IS/.test(a.rec.rows[0][1][0]) && !a.saveErr, a.rec.rows);
      ok('I2 its photos were armed under the sheet’s own number (not the inbox’s guess)', Object.keys(a.pend).join() === '2343-IS' && !Object.keys(a.stage).length, { pend: Object.keys(a.pend), stage: Object.keys(a.stage) });
      ok('I3 both photos filed into the sheet’s own folder, the first as its Right Side View', ids(a.rec.moves) === 'm1,m2' && a.rec.folders.some(f => f[1] === 'ITEMFID-2343-IS')
         && a.rec.renames[0][1].indexOf('2343-IS RSV ') === 0, a.rec);
      ok('I4 no page errors', !a.errs.length, a.errs);
    }

    console.log('\n== K · Science Set and Construction Set matches ==');
    for (const kind of ['Science Set', 'Construction Set']) {
      const a = await R.scienceConstruction(br, kind);
      const tab = kind === 'Science Set' ? 'Science Sets!A:O' : 'Construction Sets!A:O';
      const fid = 'FOLDER-' + (a.num + ' ' + a.desc).replace(/\s+/g, '_');
      ok('K  ' + kind + ': the add held its photos, then saved to its own tab', Object.keys(a.before.stage).join() === a.num && a.rec.rows.length === 1 && a.rec.rows[0][0] === tab && !a.saveErr, a.rec.rows);
      ok('K  ' + kind + ': both photos moved into its own folder, named under its number', ids(a.rec.moves) === 'm1,m2' && into(a.rec.moves, fid)
         && a.rec.renames[0][1].indexOf(a.num + ' RSV ') === 0, a.rec);
      ok('K  ' + kind + ': the row points at that folder', a.rec.rows[0][1][10] === 'https://drive.google.com/drive/folders/' + fid, a.rec.rows[0][1][10]);
      ok('K  ' + kind + ': hold let go, Add screen closed, no page errors', !Object.keys(a.stage).length && !Object.keys(a.pend).length && !a.open && !a.errs.length, { stage: a.stage, errs: a.errs });
    }

    console.log('\n== R · the roads that already worked ==');
    {
      const a = await R.train(br);
      ok('R1 a train: saved, armed under its number, both photos filed into its folder', a.rec.rows[0][0] === 'My Collection!A:A' && Object.keys(a.pend).join() === '20-20169-3'
         && ids(a.rec.moves) === 'm1,m2' && a.rec.folders.some(f => f[1] === 'ITEMFID-20-20169-3') && !a.errs.length, a.rec);
    }
    {
      const a = await R.paperOther(br);
      const num = String(a.rec.rows[0] && a.rec.rows[0][1][0] || '').replace(/^'/, '');
      ok('R2 a paper item ("Other"): saved, armed under its number, both photos filed', a.rec.rows[0][0] === 'My Collection!A:A' && Object.keys(a.pend).join() === num
         && ids(a.rec.moves) === 'm1,m2' && !a.errs.length, a.rec);
    }
  } finally { await br.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite itself broke: ' + (e && e.stack || e)); process.exit(1); });
