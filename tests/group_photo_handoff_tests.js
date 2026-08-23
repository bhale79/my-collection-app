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

console2.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
