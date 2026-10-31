#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EACH v0.9.2072 FIX UNDONE TURNS ITS OWN ROAD RED — real browser, as an iPhone
//
// The roads (tests/lib/inbox-door-roads.js) are walked again on served copies of
// the app with one fix taken out. Each must fail the way the bug looked before:
// the photos never reach the item, or stay "spoken for", or nothing is said.
// The roads on the real app are inbox_save_doors_roads_2072_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const { DOOR_ROADS: R, H } = require('./lib/inbox-door-roads');
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 600)))); c ? pass++ : fail++; }
const WS = H.read('wizard-save.js'), TOOLS = H.PIECES['photo-inbox-tools.js'];   // the Photo Inbox, read the ONE way (tests/lib/pin-source.js)

(async () => {
  if (!H.chromium) { console.log('FAIL  Playwright is not available — this suite cannot run'); process.exit(1); }
  const br = await H.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    {
      const ws = H.plant(WS, '    await _rrInboxPhotosFile(d, _inboxCat, itemNum);   // v0.9.2072: the row is saved — now the photos move\n', '', 'catalog files');
      const a = await R.catalog(br, 'ok', { 'wizard-save.js': ws });
      ok('P1 a Catalog save that never files: no photo reaches the catalog (C3 red) and the photos stay held (C6 red)',
         !a.rec.moves.length && Object.keys(a.stage).length === 1, { moves: a.rec.moves, stage: Object.keys(a.stage) });
    }
    {
      const block = WS.slice(WS.indexOf('    try {\n      if (d._pinStagedNum) {\n        if (typeof rrPinEnsureStaged === \'function\')\n          rrPinEnsureStaged(d._pinStagedNum, (d._addPhotoDriveIds'), WS.indexOf('    } catch (ePhIS) {}') + '    } catch (ePhIS) {}'.length);
      const ws = H.plant(WS, block, '', 'IS arm');
      const a = await R.instructionSheet(br, { 'wizard-save.js': ws });
      ok('P2 an Instruction Sheet that never arms: nothing armed, no photo filed (I2, I3 red)', !Object.keys(a.pend).length && !a.rec.moves.length, { pend: a.pend, moves: a.rec.moves });
    }
    {
      const ws = H.plant(WS, '  await _rrInboxPhotosFile(d, _inboxSc, itemNum);   // v0.9.2072: the row is saved — now the photos move\n', '', 'science files');
      const a = await R.scienceConstruction(br, 'Science Set', { 'wizard-save.js': ws });
      ok('P3 a Science Set save that never files: no photo moves (K red)', !a.rec.moves.length, a.rec.moves);
    }
    {
      const tools = H.plant(TOOLS, "      if (typeof window.rrPinDropStaged === 'function') window.rrPinDropStaged(k, ids);\n      try { _pinRefresh(); } catch (eR) {}", '      try { _pinRefresh(); } catch (eR) {}', 'drop');
      const a = await R.catalog(br, 'ok', { 'photo-inbox-tools.js': tools });
      ok('P4 a mover that keeps the hold: the photos move but stay "spoken for" (C6 red)', a.rec.moves.length === 2 && Object.keys(a.stage).length === 1, Object.keys(a.stage));
    }
    {
      const ws = H.plant(WS, '  if (left > 0 && typeof rrSaveNotice', '  if (false && typeof rrSaveNotice', 'say');
      const a = await R.catalog(br, 'offline', { 'wizard-save.js': ws });
      ok('P5 an offline save that says nothing: the message is gone (C12 red)', !/Photo Inbox/.test(a.toast), a.toast);
    }
    {
      // counted as moved before the move is known to have worked
      const tools = H.plant(TOOLS, "      try {\n        await driveMoveFileToFolder(file.id, rec.fromFid, rec.toFid);\n        moved++;", "      moved++;\n      try {\n        await driveMoveFileToFolder(file.id, rec.fromFid, rec.toFid);", 'count');
      const a = await R.catalog(br, 'partial', { 'photo-inbox-tools.js': tools });
      ok('P6 a mover that counts a move before it worked: the stayed photo is not said (C16 red)', !/could not be moved/.test(a.toast), a.toast);
    }
  } finally { await br.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite itself broke: ' + (e && e.stack || e)); process.exit(1); });
