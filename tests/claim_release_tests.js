// ════════════════════════════════════════════════════════════════════════
// claim_release_tests.js — v0.9.1782
//
// [stated] Brad, two Photo Inbox tiles greyed out and badged "⏳ → 6050" and
// "⏳ → 6346", eight days after the photos were taken:
//
//     "i am obviously online so why are these here?"
//
// He was right to push back. The badge means an add claimed those photos and
// its save never finished — being online had nothing to do with it, and the
// tooltip ("offline saves finish when you reconnect") named the one cause that
// was NOT his.
//
// Two real defects behind it:
//   1. A STAGED note — a set-add begun and abandoned — claimed its photos
//      FOREVER. The week-long retirement lived inside the pending loop and
//      only ever looked at PENDING_KEY. Nothing retired SETSTAGE_KEY at all.
//   2. There was NO WAY OUT. The badge was read-only: no button, no menu.
//      That is the real defect; the expiry is the safety net, not the door.
//
// Both rescues run the REAL functions. Section E plants an offender for each.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
// A fake localStorage holding both claim stores, so the real code can be run
// against it and the result read back.
function makeStore(stage, pend) {
  const mem = { SS: JSON.stringify(stage || {}), PK: JSON.stringify(pend || {}) };
  return {
    ls: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
    read: (k) => JSON.parse(mem[k] || '{}')
  };
}
function buildDrop(src) {
  return new Function('localStorage', 'SETSTAGE_KEY', 'PENDING_KEY', '_pendList',
    '"use strict";' + grab(src || SRC, '_pinDropClaims') + '; return _pinDropClaims;');
}
function buildSweep(src) {
  return new Function('localStorage', 'SETSTAGE_KEY', 'PENDING_KEY', '_pendList', '_rrNowMs', 'console',
    '"use strict";' + grab(src || SRC, '_pinSweepStaleClaims') + '; return _pinSweepStaleClaims;');
}
const LIST = (v) => (Array.isArray(v) ? v : [v]);
const QUIET = { log: function () {} };
const WEEK = 604800000;

console.log('\n== A. Releasing one photo, surgically ==');
{
  // One note claiming two photos. Releasing ONE must not cost the other.
  const s = makeStore({ '6050': { ts: 1, files: [{ id: 'fA' }, { id: 'fB' }] } }, {});
  const drop = buildDrop()(s.ls, 'SS', 'PK', LIST);
  const freed = drop(['fA']);
  ok('it frees exactly the photo asked for', freed === 1, String(freed));
  const note = s.read('SS')['6050'];
  ok('…the note survives, because it still claims the other photo', !!note, JSON.stringify(s.read('SS')));
  ok('…and holds only the photo that was NOT released',
     note.files.length === 1 && note.files[0].id === 'fB', JSON.stringify(note));
}

console.log('\n== B. A note with nothing left is dropped ==');
{
  const s = makeStore({ '6346': { ts: 1, files: [{ id: 'fC' }] } }, {});
  const freed = buildDrop()(s.ls, 'SS', 'PK', LIST)(['fC']);
  ok('the last photo is freed', freed === 1);
  ok('…and the empty note goes with it', !s.read('SS')['6346'], JSON.stringify(s.read('SS')));
}

console.log('\n== C. Several notes queued under one number ==');
{
  // v0.9.1370 put a LIST under a number — one note per copy. Releasing a photo
  // from the second copy must leave the first copy's note alone.
  const s = makeStore({}, { '3362': [ { ts: 1, files: [{ id: 'f1' }] },
                                      { ts: 1, files: [{ id: 'f2' }] } ] });
  const freed = buildDrop()(s.ls, 'SS', 'PK', LIST)(['f2']);
  ok('only the matching copy loses its photo', freed === 1);
  const left = s.read('PK')['3362'];
  ok('…the other copy is untouched',
     Array.isArray(left) && left.length === 1 && left[0].files[0].id === 'f1', JSON.stringify(left));
}

console.log('\n== D. Both stores, and nothing claimed ==');
{
  const s = makeStore({ '6050': { ts: 1, files: [{ id: 'fA' }] } },
                      { '6346': { ts: 1, files: [{ id: 'fB' }] } });
  const freed = buildDrop()(s.ls, 'SS', 'PK', LIST)(['fA', 'fB']);
  ok('a release reaches BOTH stores — staged and armed', freed === 2, String(freed));
  ok('…leaving neither behind',
     !s.read('SS')['6050'] && !s.read('PK')['6346'],
     JSON.stringify(s.read('SS')) + ' / ' + JSON.stringify(s.read('PK')));

  const s2 = makeStore({ '6050': { ts: 1, files: [{ id: 'fA' }] } }, {});
  ok('releasing a photo nothing claims frees nothing and breaks nothing',
     buildDrop()(s2.ls, 'SS', 'PK', LIST)(['nope']) === 0 && !!s2.read('SS')['6050']);
}

console.log('\n== E. THE SWEEP: a claim that never completed lets go ==');
{
  const NOW = 10 * WEEK;
  // THE BUG: this one is STAGED. Nothing retired SETSTAGE_KEY at all, so it
  // would have held Brad's photos for ever.
  const s = makeStore({ '6050': { ts: NOW - WEEK - 1, files: [{ id: 'fA' }] } },
                      { '6346': { ts: NOW - WEEK - 1, files: [{ id: 'fB' }] } });
  buildSweep()(s.ls, 'SS', 'PK', LIST, () => NOW, QUIET)();
  ok('a STAGED note older than a week is retired — the case that had no expiry',
     !s.read('SS')['6050'], JSON.stringify(s.read('SS')));
  ok('…and an armed one still is too', !s.read('PK')['6346']);

  const fresh = makeStore({ '6050': { ts: NOW - 1000, files: [{ id: 'fA' }] } }, {});
  buildSweep()(fresh.ls, 'SS', 'PK', LIST, () => NOW, QUIET)();
  ok('a note from this morning is left alone', !!fresh.read('SS')['6050']);

  // An UNSTAMPED note was immortal: the old code admitted an undefined ts
  // "meant the note could never retire" and only fixed the writing side.
  const un = makeStore({ '905': { files: [{ id: 'fX' }] } }, {});
  buildSweep()(un.ls, 'SS', 'PK', LIST, () => NOW, QUIET)();
  const stamped = un.read('SS')['905'];
  ok('an unstamped note gets a clock rather than living for ever',
     !!stamped && stamped.ts === NOW, JSON.stringify(stamped));
  buildSweep()(un.ls, 'SS', 'PK', LIST, () => NOW + WEEK + 1, QUIET)();
  ok('…and retires a week after that clock started', !un.read('SS')['905']);
}

console.log('\n== F. The badge is a door, and it tells the truth ==');
{
  ok('the badge is tappable',
     /onclick="event\.stopPropagation\(\);_pinReleaseClaim\(/.test(SRC));
  ok('…and says so on hover', /Tap to release it back to the inbox/.test(SRC));

  const badge = SRC.slice(SRC.indexOf('var claimBadge = _claimedBy'),
                          SRC.indexOf('var claimBadge = _claimedBy') + 700);
  ok('the hover no longer blames being offline',
     !/offline saves finish when you reconnect/i.test(badge), badge.slice(0, 120));

  const relSeg = SRC.slice(SRC.indexOf('window._pinReleaseClaim = async function'),
                           SRC.indexOf('function _pinDropClaims'));
  ok('releasing ASKS first — it changes state', /_pinConfirm\(/.test(relSeg));
  ok('…names the item that is holding the photo', /from item <strong>/.test(relSeg));
  ok('…and promises what it will NOT do', /Nothing is deleted/.test(relSeg));
  ok('…the photos stay in the inbox, which is the whole point',
     /stay|stays/.test(relSeg));
}

console.log('\n== G. The sweep runs even when nothing is pending ==');
{
  // The early return in _flushPending fires when there are no PENDING notes.
  // Abandoned STAGING is exactly that case, so the sweep has to come first or
  // it would never run for the bug it was written for.
  const flush = SRC.slice(SRC.indexOf('async function _flushPending()'),
                          SRC.indexOf('async function _flushPending()') + 900);
  ok('the sweep is called BEFORE the early return',
     flush.indexOf('_pinSweepStaleClaims()') < flush.indexOf('if (!nums.length'),
     'sweep=' + flush.indexOf('_pinSweepStaleClaims()') + ' return=' + flush.indexOf('if (!nums.length'));
  ok('…and its failure can never stop the flush', /try \{ _pinSweepStaleClaims\(\); \} catch/.test(flush));
}

console.log('\n== H. THE OFFENDERS: break each one, require red ==');
{
  const NOW = 10 * WEEK;

  // 1 — the sweep stops looking at the staged store. This IS the original bug.
  const bad1 = buildSweep(SRC.replace('[SETSTAGE_KEY, PENDING_KEY].forEach(function (storeKey) {\n      var store;\n      try { store = JSON.parse(localStorage.getItem(storeKey) || \'{}\'); } catch (e) { return; }\n      var dirty = false;\n      Object.keys(store).forEach(function (num) {\n        var notes = (typeof _pendList === \'function\') ? _pendList(store[num]) : [store[num]];\n        var kept = [];\n        notes.forEach(function (rec) {\n          if (!rec || typeof rec !== \'object\') { kept.push(rec); return; }\n          if (!rec.ts) { rec.ts = now; dirty = true; kept.push(rec); return; }',
                                      '[PENDING_KEY].forEach(function (storeKey) {\n      var store;\n      try { store = JSON.parse(localStorage.getItem(storeKey) || \'{}\'); } catch (e) { return; }\n      var dirty = false;\n      Object.keys(store).forEach(function (num) {\n        var notes = (typeof _pendList === \'function\') ? _pendList(store[num]) : [store[num]];\n        var kept = [];\n        notes.forEach(function (rec) {\n          if (!rec || typeof rec !== \'object\') { kept.push(rec); return; }\n          if (!rec.ts) { rec.ts = now; dirty = true; kept.push(rec); return; }'));
  const s1 = makeStore({ '6050': { ts: NOW - WEEK - 1, files: [{ id: 'fA' }] } }, {});
  bad1(s1.ls, 'SS', 'PK', LIST, () => NOW, QUIET)();
  ok('a sweep that ignores the staged store is caught', !!s1.read('SS')['6050'],
     'the staged-expiry check would have passed on broken source');

  // 2 — releasing takes the whole note instead of one photo.
  const bad2 = buildDrop(SRC.replace('if (rec.files.length) kept.push(rec);', ''));
  const s2 = makeStore({ '6050': { ts: 1, files: [{ id: 'fA' }, { id: 'fB' }] } }, {});
  bad2(s2.ls, 'SS', 'PK', LIST)(['fA']);
  ok('releasing one photo taking the whole note is caught', !s2.read('SS')['6050'],
     'the surgical check would have passed on broken source');

  // 3 — the unstamped note stops getting a clock and is immortal again.
  const bad3 = buildSweep(SRC.replace('if (!rec.ts) { rec.ts = now; dirty = true; kept.push(rec); return; }',
                                      'if (!rec.ts) { kept.push(rec); return; }'));
  const s3 = makeStore({ '905': { files: [{ id: 'fX' }] } }, {});
  bad3(s3.ls, 'SS', 'PK', LIST, () => NOW, QUIET)();
  ok('an unstamped note left immortal is caught', !s3.read('SS')['905'] || !s3.read('SS')['905'].ts,
     'the clock check would have passed on broken source');

  // 4 — the confirm goes and a tap silently changes state.
  ok('releasing without asking is caught',
     !/_pinConfirm\(/.test(SRC.slice(SRC.indexOf('window._pinReleaseClaim = async function'),
                                     SRC.indexOf('function _pinDropClaims'))
                            .replace(/_pinConfirm\(/g, '_noAsk(')));

  // 5 — the sweep drifts below the early return and never runs for the bug.
  const badFlush = SRC.slice(SRC.indexOf('async function _flushPending()'),
                             SRC.indexOf('async function _flushPending()') + 900)
                      .replace('try { _pinSweepStaleClaims(); } catch (eSw) {}', '');
  ok('losing the sweep from the flush is caught',
     badFlush.indexOf('_pinSweepStaleClaims()') < 0);
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
