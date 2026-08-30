// ══ tests/offline_show_mode_tests.js ═══════════════════════════════════════
//
// v0.9.1599 (Session 87, "show mode"): Brad — "i want to be able to add
// pictures and add things to my master list while in airplane mode and with
// no wifi... wifi issues are common at train shows." An offline BOOT was
// view-only since v826 — a rule written before the write-outbox and photo
// staging existed. These pins hold the new shape: offline writes are
// RECORDED (never refused, never lost), the doors are open, and the one
// deliberate refusal that remains (the For Sale sheet rebuild) stays.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

// ── sheets.js: offline update/append RECORD before they throw ──
const sh = rd('sheets.js');
const upd = sh.slice(sh.indexOf('async function sheetsUpdate'), sh.indexOf('async function sheetsAppend'));
const app = sh.slice(sh.indexOf('async function sheetsAppend'), sh.indexOf('async function sheetsClear'));
ok('an offline-boot UPDATE is recorded to the outbox, not refused',
   /_rrOfflineNow\(\)\) \{[\s\S]{0,700}?throw _rrWriteFailed\('update'/.test(upd), '');
ok('an offline-boot APPEND is recorded to the outbox, not refused',
   /_rrOfflineNow\(\)\) \{[\s\S]{0,900}?_rrWriteFailed\('append'/.test(app), '');
ok('…and RETURNS row-unknown so a multi-row save queues every row (v1600)',
   /_rrWriteFailed\('append'[\s\S]{0,120}?return 0;/.test(app), '');
ok('…and neither keeps the old bare refusal throw',
   !/needs a connection", 3500, true\);\s*throw new Error\('offline'\)/.test(upd + app), '');
ok('…while the toast says SAVED ON THIS DEVICE, not refused',
   /saved on this device/i.test(upd) && /saved on this device/i.test(app), '');

// ── v0.9.1604: BOTH flavours of offline reach the doors ──
ok('there is ONE offline test, and it covers airplane-mid-session too',
   /function _rrOfflineNow\(\)/.test(sh)
   && /window\._offlineMode \|\| \(typeof navigator !== 'undefined' && navigator\.onLine === false\)/.test(sh), '');
ok('…and all three write doors use it — none checks the boot flag alone',
   (sh.match(/if \(_rrOfflineNow\(\)\) \{/g) || []).length === 3
   && !/if \(window\._offlineMode\) \{/.test(sh), '');

// ── sheetsClear keeps its deliberate refusal, with the reason on the spot ──
const clr = sh.slice(sh.indexOf('async function sheetsClear'), sh.indexOf('async function sheetsClear') + 1400);
ok('the For Sale rebuild still refuses offline — deliberately',
   /throw new Error\('offline'\)/.test(clr) && /deliberately NOT recorded/i.test(clr), '');

// ── the wizard door is open offline ──
const wz = rd('wizard.js');
const ow = wz.slice(wz.indexOf('async function openWizard'), wz.indexOf('async function openWizard') + 1600);
ok('openWizard no longer refuses an offline boot',
   !/adding items needs a connection/.test(ow), '');
ok('…it says items save on the device instead',
   /items save on this device/i.test(ow), '');

// ── want-list doors open ──
ok('the Want List guards are lifted (both files)',
   !/adding to your Want List needs a connection/.test(rd('app-collection.js')) &&
   !/adding to your Want List needs a connection/.test(rd('app-pages.js')), '');

// ── the drain is wired: checker + post-load call sites + reconnect nudge ──
const ad = rd('app-data.js');
ok('the duplicate guard exists and reads inventoryId from the schema',
   /window\._rrOfflineAppendDrain = function/.test(ad) && /f\.field === 'inventoryId'/.test(ad), '');
ok('…and is called after BOTH data-load branches',
   (ad.match(/_rrOfflineAppendDrain === 'function'\) setTimeout\(window\._rrOfflineAppendDrain, 2500\)/g) || []).length === 2, '');
ok('…and nudged from the reconnect listener',
   /window\._rrOfflineAppendDrain === 'function'\) window\._rrOfflineAppendDrain\(\)/.test(rd('write-outbox.js')), '');

// ── the wizard photo step points at the staging path ──
const wp = rd('wizard-photos.js');
ok('the offline photo message points at Batch Add (which stages)',
   /Batch Add: those photos wait on this device/.test(wp) && /photos can\\u2019t upload right now/.test(wp), '');

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
