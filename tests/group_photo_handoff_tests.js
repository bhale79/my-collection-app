#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// GROUP PHOTO HANDOFF — v0.9.1560 (Session 83)
// Brad: "grouped items never got their photos." The Photo Inbox stages a
// note under the number READ off the photo (2344); the wizard saves the
// row under a SUFFIXED number (2344-P). rrPinSetPhotoSaved is the handoff
// — if its matcher can't bridge the two, it returns silently and the
// photos strand in the inbox forever. This file extracts the REAL
// rrPinSetPhotoSaved from app/photo-inbox.js and proves the bridge.
// Run from repo root:  node tests/group_photo_handoff_tests.js
// (exit 1 = regression). Set TARGET=path to test another copy.
// ═══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const target = process.env.TARGET || path.join(__dirname, '..', 'app', 'photo-inbox.js');
const src = fs.readFileSync(target, 'utf8');

function grabAssigned(name) {
  const sig = name + ' = function';
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(src.indexOf('function', i), k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

// ── stub world: the closure vars the function reads ─────────────────────
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const SETSTAGE_KEY = 'rr_inbox_setstage';
const PENDING_KEY = 'rr_inbox_pending';
const _pendList = v => (v == null ? [] : Array.isArray(v) ? v.filter(x => x != null) : [v]);
// the real helpers from app.js (kept byte-faithful to their definitions)
function normalizeItemNum(n) {
  const s = String(n == null ? '' : n).trim();
  return s.match(/^\d+\.0$/) ? s.slice(0, -2) : s;
}
function baseItemNum(n) { return normalizeItemNum(n).replace(/[-]?[PDTC]$/i, ''); }
const console2 = console;

let rrPinSetPhotoSaved;
eval('rrPinSetPhotoSaved = ' + grabAssigned('window.rrPinSetPhotoSaved'));

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console2.log('  ✓ ' + label); }
  else { fail++; console2.log('  ✗ FAIL: ' + label); }
}
function stageIs(obj) { store[SETSTAGE_KEY] = JSON.stringify(obj); delete store[PENDING_KEY]; }
function pend() { return JSON.parse(store[PENDING_KEY] || '{}'); }

// 1 — THE BUG: staged under the read number, saved with a -P suffix.
stageIs({ '2344': { files: ['f1'], src: 'test' } });
rrPinSetPhotoSaved('2344-P');
check('base tier: staged 2344 is armed when the row saves as 2344-P', !!pend()['2344-P']);

// 2 — dash tier: read had no dash, save does. Sibling must NOT be stolen.
stageIs({ '2343P': { files: ['fp'] }, '2343T': { files: ['ft'] } });
rrPinSetPhotoSaved('2343-P');
const p2 = pend();
check('dash tier: 2343-P takes the 2343P note', !!p2['2343-P'] && _pendList(p2['2343-P']).some(n => n.files && n.files[0] === 'fp'));
check('dash tier: the 2343T sibling note is untouched', !!JSON.parse(store[SETSTAGE_KEY])['2343T']);

// 3 — exact tier unchanged (regression guard for every single-item add).
stageIs({ '6464': { files: ['fx'] } });
rrPinSetPhotoSaved('6464');
check('exact tier: plain numbers still arm as before', !!pend()['6464']);

// 4 — no cross-steal: unrelated numbers never match.
stageIs({ '2344': { files: ['f1'] } });
rrPinSetPhotoSaved('9999');
check('no match: unrelated number arms nothing', Object.keys(pend()).length === 0);

// 5 — suffix precision inside one set: exact beats base.
stageIs({ '2344-P': { files: ['exact'] }, '2344': { files: ['base'] } });
rrPinSetPhotoSaved('2344-P');
const p5 = pend();
check('precision: an exact 2344-P key wins over the bare 2344 key', _pendList(p5['2344-P']).some(n => n.files && n.files[0] === 'exact'));

// ── v0.9.1562: UNIT-ROLE SPLIT (Brad: "it should automatically put them
// in the right order… and they should be in the right hand side view box") ──
const abaNote = () => ({ files: [
  { id: 'fA', name: 'a.jpg', role: 'aunit_p' },
  { id: 'fB', name: 'b.jpg', role: 'bunit' },
  { id: 'fD', name: 'd.jpg', role: 'aunit_d' },
  { id: 'fT', name: 't.jpg', role: 'together' },
], rsvFid: 'fT', ts: 1 });

// 6 — the powered A takes its own shot + the set shot; rest stay staged
stageIs({ '2356': abaNote() });
rrPinSetPhotoSaved('2356-P');
let p6 = pend(), s6 = JSON.parse(store[SETSTAGE_KEY]);
let n6 = _pendList(p6['2356-P'])[0] || {};
check('split: -P takes aunit_p + together only', (n6.files || []).map(f => f.id).sort().join() === 'fA,fT');
check('split: the unit shot is the Right Side View', n6.rsvFid === 'fA');
check('split: B and dummy photos stay staged for their members', s6['2356'] && s6['2356'].files.map(f => f.id).sort().join() === 'fB,fD');

// 7 — then the B unit takes its shot
rrPinSetPhotoSaved('2356C');
let n7 = _pendList(pend()['2356C'])[0] || {};
check('split: C takes the bunit shot, RSV = its own photo', (n7.files || []).length === 1 && n7.files[0].id === 'fB' && n7.rsvFid === 'fB');

// 8 — then the dummy A takes the last, and the note is gone
rrPinSetPhotoSaved('2356-T');
let n8 = _pendList(pend()['2356-T'])[0] || {};
check('split: -T takes the aunit_d shot', (n8.files || []).length === 1 && n8.files[0].id === 'fD');
check('split: fully claimed note leaves staging', !JSON.parse(store[SETSTAGE_KEY])['2356']);

// 9 — arm order does not matter: C first still gets only its own
stageIs({ '2356': abaNote() });
rrPinSetPhotoSaved('2356C');
let n9 = _pendList(pend()['2356C'])[0] || {};
check('split: arming C first takes only the bunit shot', (n9.files || []).length === 1 && n9.files[0].id === 'fB');

// 10 — a note WITHOUT unit roles behaves exactly as before (whole note)
stageIs({ '2344': { files: [{ id: 'x1', name: 'x.jpg', role: '' }, { id: 'x2', name: 'y.jpg', role: '' }], rsvFid: 'x1', ts: 1 } });
rrPinSetPhotoSaved('2344-P');
let n10 = _pendList(pend()['2344-P'])[0] || {};
check('no roles: whole note moves in one piece (old behavior)', (n10.files || []).length === 2);

// 11 — v0.9.1563: STACKED suffix (Brad's real 2356T-D, measured in his
// browser): the third unit of an ABA saves as 2356T-D; one-layer stripping
// left its photo staged forever.
stageIs({ '2356-P': { files: [{ id: 'fD', name: 'd.jpg', role: 'd' }], rsvFid: 'fD', ts: 1 } });
rrPinSetPhotoSaved('2356T-D');
let n11 = _pendList(pend()['2356T-D'])[0] || {};
check('stacked suffix: 2356T-D claims the d-role file from a 2356-P key', (n11.files || []).length === 1 && n11.files[0].id === 'fD');

// 12 — letter-only numbers are never shaved by the stacked-strip
stageIs({ 'LTC': { files: [{ id: 'fL', name: 'l.jpg', role: '' }], rsvFid: 'fL', ts: 1 } });
rrPinSetPhotoSaved('LT');
check('letter-only: LT does not steal the LTC note', Object.keys(pend()).length === 0);

console2.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
