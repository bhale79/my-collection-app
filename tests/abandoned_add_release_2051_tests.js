#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A CLOSED ADD LETS GO OF ITS PHOTOS — v0.9.2051
// Mike (mkcaruso), 2026-10-29: "I'm having no luck with this. Photos get uploaded
// but I get message that the app hasn't finished saving them." His screen:
// "Photos already spoken for — These photos are already attached to an add of
// 20-20169-3 that has not finished saving." Nothing was saving.
//
// Cause: filing from the Photo Inbox STAGES a note holding the photos for the
// Add screen; a save ARMS it (moves it to PENDING). Closing the Add screen
// without saving dropped the note only for a numberless add — a real number's
// note was kept on purpose, so the photos stayed "spoken for" for a WEEK and
// every retry warned. [stated] Brad: "fix it now".
//
//   A  closing without a save drops a real number's staged note — but only when
//      its photos are THIS add's photos; another note, a numberless note and an
//      armed (PENDING) note behave as before
//   B  holds already stuck (staged, older than 30 min, no Add screen open) are
//      released when the inbox sweeps — not after a week; never an armed note,
//      never while an Add screen is open, never a fresh one
//   C  Mike's sequence end to end: stage → close without saving → file again:
//      no "spoken for" warning; and a REAL unfinished save still warns
//   S  source: _doCloseWizard passes this add's photo ids; the review's warning
//      sweeps first; the 30 minutes live in ONE place
//   P  PLANTED: each undone is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const PIECES = require('./lib/pin-source').pinPieces();   // the Photo Inbox, read the ONE way
const TOOLS = PIECES['photo-inbox-tools.js'];
const GRID = PIECES['photo-inbox-grid.js'];
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (d || ''))); c ? pass++ : fail++; }

// A function's source by brace matching from its header.
function grab(src, header) {
  const i = src.indexOf(header); if (i < 0) throw new Error('not found: ' + header);
  const o = src.indexOf('{', i); let d = 0;
  for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + header);
}
function store(stage, pend) {
  const mem = { rr_inbox_setstage: JSON.stringify(stage || {}), rr_inbox_pending: JSON.stringify(pend || {}) };
  return { ls: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
           read: k => JSON.parse(mem[k] || '{}') };
}
const LIST = v => (Array.isArray(v) ? v : [v]);
const QUIET = { log() {}, warn() {} };
function buildDrop(src) {
  const body = grab(src || TOOLS, 'window.rrPinDropStaged = function');
  return new Function('SETSTAGE_KEY', 'NONUM_PREFIX', 'localStorage', '_pendList', 'console', 'window',
    body + ';\nreturn window.rrPinDropStaged;');
}
function buildSweep(src, wizOpen, nowMs) {
  const s = src || TOOLS;
  const abandonLine = (s.match(/var RR_STAGED_ABANDON_MS = [^;]+;/) || [''])[0];
  return new Function('SETSTAGE_KEY', 'PENDING_KEY', 'localStorage', '_pendList', '_rrNowMs', 'console', '_pinWizardOpen',
    abandonLine + '\n' + grab(s, 'function _pinSweepStaleClaims()') + '\nreturn _pinSweepStaleClaims;');
}
function noteMap(src) {
  return new Function('SETSTAGE_KEY', 'PENDING_KEY', 'localStorage', '_pendList',
    grab(src || GRID, 'function _pinNoteFileMap()') + '\nreturn _pinNoteFileMap;');
}
const MIN = 60000, NOW = 1800000000000;
const runDrop = (s, key, ids, src) => buildDrop(src)('rr_inbox_setstage', '__nonum__', s.ls, LIST, QUIET, {})(key, ids);
const runSweep = (s, open, src) => buildSweep(src)('rr_inbox_setstage', 'rr_inbox_pending', s.ls, LIST, () => NOW, QUIET, () => open)();
const mapOf = (s, src) => noteMap(src)('rr_inbox_setstage', 'rr_inbox_pending', s.ls, LIST)();

console.log('\n== A · closing the Add screen without a save ==');
{
  const s = store({ '20-20169-3': { ts: NOW - MIN, files: [{ id: 'm1' }, { id: 'm2' }] } });
  runDrop(s, '20-20169-3', ['m1', 'm2']);
  ok('A1 a real number\'s staged note goes when its photos are this add\'s photos (Mike\'s 20-20169-3)', !('20-20169-3' in s.read('rr_inbox_setstage')), JSON.stringify(s.read('rr_inbox_setstage')));
}
{
  const s = store({ '2343': { ts: NOW, files: [{ id: 'other' }] } });
  runDrop(s, '2343', ['m1']);
  ok('A2 …a note holding OTHER photos under the same number is left alone', '2343' in s.read('rr_inbox_setstage'));
  runDrop(s, '2343');
  ok('A3 …and with no photo ids at all, a real number\'s note is left alone (as before)', '2343' in s.read('rr_inbox_setstage'));
}
{
  const s = store({ '__nonum__1700000000000': { files: [{ id: 'a' }] } });
  runDrop(s, '__nonum__1700000000000');
  ok('A4 a numberless add\'s scratch note still goes (v0.9.1387, unchanged)', !('__nonum__1700000000000' in s.read('rr_inbox_setstage')));
}
{
  const s = store({}, { '6464-1': { ts: NOW - MIN, files: [{ id: 'm1' }] } });
  runDrop(s, '6464-1', ['m1']);
  ok('A5 an ARMED note (a saved item waiting to move its photos) is never touched by a close', '6464-1' in s.read('rr_inbox_pending'));
}

console.log('\n== B · holds already stuck ==');
{
  const s = store({ '20-20169-3': { ts: NOW - 45 * MIN, files: [{ id: 'm1' }] }, '726': { ts: NOW - 5 * MIN, files: [{ id: 'x' }] } },
                  { '6464-1': { ts: NOW - 45 * MIN, files: [{ id: 'p' }] } });
  runSweep(s, false);
  const st = s.read('rr_inbox_setstage');
  ok('B1 a staged hold 45 min old with no Add screen open is released at once (Mike\'s phone tonight)', !('20-20169-3' in st), JSON.stringify(st));
  ok('B2 …a staged hold 5 min old is kept (an add may still be finishing)', '726' in st, JSON.stringify(st));
  ok('B3 …an armed (saved) note of the same age is kept', '6464-1' in s.read('rr_inbox_pending'));
}
{
  const s = store({ '20-20169-3': { ts: NOW - 45 * MIN, files: [{ id: 'm1' }] } });
  runSweep(s, true);
  ok('B4 while an Add screen IS open, nothing extra is released', '20-20169-3' in s.read('rr_inbox_setstage'));
}
{
  const s = store({ '1': { ts: NOW - 8 * 24 * 60 * MIN, files: [{ id: 'old' }] } }, { '2': { ts: NOW - 8 * 24 * 60 * MIN, files: [{ id: 'old2' }] } });
  runSweep(s, true);
  ok('B5 the week-old retirement of BOTH stores still works (v0.9.1782, unchanged)', !('1' in s.read('rr_inbox_setstage')) && !('2' in s.read('rr_inbox_pending')));
}

console.log('\n== C · Mike\'s sequence ==');
{
  // File to my Collection → the inbox stages a note holding the two photos
  const s = store({ '20-20169-3': { ts: NOW, files: [{ id: 'm1' }, { id: 'm2' }] } });
  ok('C0 while the Add screen is open the photos are held (the inbox shows them taken)', mapOf(s).m1 === '20-20169-3');
  // …he closes the Add screen without saving (_doCloseWizard → rrPinDropStaged with this add's photo ids)
  runDrop(s, '20-20169-3', ['m1', 'm2']);
  ok('C1 closed without saving: the photos are free — no "Photos already spoken for" on the next try', !mapOf(s).m1 && !mapOf(s).m2, JSON.stringify(mapOf(s)));
}
{
  // a REAL unfinished save: the item saved offline, its photos wait to move
  const s = store({}, { '20-20169-3': { ts: NOW - 45 * MIN, files: [{ id: 'm1' }] } });
  runSweep(s, false);
  ok('C2 a REAL unfinished save (armed, waiting to move) still warns — the safety check keeps its job', mapOf(s).m1 === '20-20169-3');
}

console.log('\n== S · source ==');
const close = grab(WIZ, 'function _doCloseWizard()');
ok('S1 the Add screen hands rrPinDropStaged THIS add\'s photo ids on a close without a save',
   /!_wd\._saveComplete && _wd\._pinStagedNum/.test(close) && /rrPinDropStaged\(_wd\._pinStagedNum,[^\n]*\n[^\n]*_addPhotoDriveIds/.test(close));
const review = TOOLS.slice(TOOLS.indexOf('var _nm8 = _pinNoteFileMap();') - 400, TOOLS.indexOf('var _nm8 = _pinNoteFileMap();'));
ok('S2 the "spoken for" check releases abandoned holds before it looks', /_pinSweepStaleClaims\(\)/.test(review));
ok('S3 the 30 minutes live in ONE place (RR_STAGED_ABANDON_MS)', (TOOLS.match(/30 \* 60 \* 1000/g) || []).length === 1 && /var RR_STAGED_ABANDON_MS = 30 \* 60 \* 1000;/.test(TOOLS));

console.log('\n== P · planted ==');
const OLD_DROP = TOOLS.replace(/      if \(k\.indexOf\(NONUM_PREFIX\) !== 0\) \{\n[\s\S]*?        if \(!mine\) return;[^\n]*\n      \}\n/, '      if (k.indexOf(NONUM_PREFIX) !== 0) return;\n');
ok('P0 the planted old close-cleanup differs from the real one', OLD_DROP !== TOOLS);
{
  const s = store({ '20-20169-3': { ts: NOW, files: [{ id: 'm1' }] } });
  runDrop(s, '20-20169-3', ['m1'], OLD_DROP);
  ok('P1 the old rule (numberless only) keeps Mike\'s photos held — A1/C1 would fail', '20-20169-3' in s.read('rr_inbox_setstage'));
}
const NO_ABANDON = TOOLS.replace(/          if \(storeKey === SETSTAGE_KEY && !wizOpen[\s\S]*?            return;\n          \}\n/, '');
ok('P2a the planted sweep without the abandoned-hold rule differs', NO_ABANDON !== TOOLS);
{
  const s = store({ '20-20169-3': { ts: NOW - 45 * MIN, files: [{ id: 'm1' }] } });
  runSweep(s, false, NO_ABANDON);
  ok('P2 without the abandoned-hold rule a stuck hold waits a week — B1 would fail', '20-20169-3' in s.read('rr_inbox_setstage'));
}
const NO_SWEEP_FIRST = TOOLS.replace('      try { if (typeof _pinSweepStaleClaims === \'function\') _pinSweepStaleClaims(); } catch (eSw8) {}\n', '');
ok('P3 the review check without its sweep fails S2', NO_SWEEP_FIRST !== TOOLS
   && !/_pinSweepStaleClaims\(\)/.test(NO_SWEEP_FIRST.slice(NO_SWEEP_FIRST.indexOf('var _nm8 = _pinNoteFileMap();') - 400, NO_SWEEP_FIRST.indexOf('var _nm8 = _pinNoteFileMap();'))));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
