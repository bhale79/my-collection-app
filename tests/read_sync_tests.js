// ════════════════════════════════════════════════════════════════════════
// read_sync_tests.js — v0.9.1771
//
// The read that follows the ACCOUNT, not the device.
//
// Brad, 2026-09-19: his phone read a Great Northern boxcar as 6427 and his
// desktop read the same photo as 6464-525, and neither ever gave way. The
// cause was not that reads were device-local — v0.9.1412 already rides them on
// the Drive file. It was that when BOTH sides held an answer and the answers
// differed, _pinSyncReadState always believed the device it was running on and
// pushed over Drive without comparing the two. Each load overwrote the other
// device's answer, so whichever screen was opened last looked right and the two
// could never converge.
//
// These tests run the REAL _pinSyncReadState, lifted out of photo-inbox.js and
// given stubs, rather than a retyped copy of it. Section E plants the OLD rule
// and requires the suite to go red, so a green run here means something.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// ── lift a function out of the real source by brace-matching ─────────────
function grab(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name + ' in photo-inbox.js');
  let depth = 0;
  const start = SRC.indexOf('{', i);
  for (let k = start; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces reading ' + name);
}

// Build a runnable copy of the sync with everything it reaches stubbed. The
// stubs are deliberately dumb: the point is to exercise the DECISION, not the
// storage.
function buildSync(opts) {
  opts = opts || {};
  const env = {
    ids: opts.ids || {},
    cropped: opts.cropped || {},
    pushed: [],
    savedIds: 0,
    savedCrop: 0
  };
  const preamble = `
    var READER_VER = '${opts.readerVer || '1107'}';
    var __env = __ENV__;
    function _ids() { return __env.ids; }
    function _idsSave(m) { __env.ids = m; __env.savedIds++; }
    function _cropped() { return __env.cropped; }
    function _croppedSave(m) { __env.cropped = m; __env.savedCrop++; }
    function _pinMetaOf(f) { return (f && f._meta) || {}; }
    function _pinMetaSet(id, patch) { __env.pushed.push({ id: id, patch: patch }); return Promise.resolve(true); }
  `;
  const body = preamble + grab('_rejStr') + '\n' + grab('_rejList') + '\n'
             + (opts.syncSource || grab('_pinSyncReadState'))
             + '\n return _pinSyncReadState;';
  const fn = new Function('__ENV__', body)(env);
  return { run: fn, env: env };
}

const file = (id, meta) => ({ id: id, _meta: meta || {} });
const READ = (o) => Object.assign({ rv: '1107', tried: 1, free: 1 }, o);

console.log('\n== A. The fight: two devices, two answers, one clock ==');
{
  // The phone re-scanned at t=200 and got 6427. Drive still carries the
  // desktop's 6464-525, decided at t=100. The phone's answer is newer.
  const a = buildSync({ ids: { f1: READ({ num: '6427', rt: 200 }) } });
  a.run([file('f1', { num: '6464-525', rt: '100', conf: 'hi' })]);
  ok('the newer LOCAL answer is pushed up',
     a.env.pushed.length === 1 && a.env.pushed[0].patch.num === '6427',
     JSON.stringify(a.env.pushed));
  ok('…and the local record is left alone', a.env.ids.f1.num === '6427');

  // Now the desktop loads. Its own record is the OLDER one; Drive is newer.
  // Under the old rule this device pushed 6464-525 straight back and the two
  // overwrote each other forever.
  const b = buildSync({ ids: { f1: READ({ num: '6464-525', rt: 100 }) } });
  b.run([file('f1', { num: '6427', rt: '200', conf: 'hi' })]);
  ok('the older device PULLS instead of pushing back',
     b.env.pushed.length === 0 && b.env.ids.f1.num === '6427',
     'pushed=' + JSON.stringify(b.env.pushed) + ' num=' + b.env.ids.f1.num);
  ok('…and takes Drive\'s clock with it, so it cannot re-win next load',
     String(b.env.ids.f1.rt) === '200', 'rt=' + b.env.ids.f1.rt);
}

console.log('\n== B. Converging, not ping-ponging ==');
{
  // Run both devices repeatedly against a shared Drive record and require
  // them to settle. This is the property the old code could never have.
  let drive = { num: '6464-525', rt: '100', conf: 'hi' };
  let phone = { f1: READ({ num: '6427', rt: 200 }) };
  let desk  = { f1: READ({ num: '6464-525', rt: 100 }) };
  for (let round = 0; round < 4; round++) {
    const p = buildSync({ ids: phone });
    p.run([file('f1', drive)]);
    p.env.pushed.forEach(x => { drive = Object.assign({}, drive, x.patch, { rt: String(x.patch.rt) }); });
    phone = p.env.ids;

    const d = buildSync({ ids: desk });
    d.run([file('f1', drive)]);
    d.env.pushed.forEach(x => { drive = Object.assign({}, drive, x.patch, { rt: String(x.patch.rt) }); });
    desk = d.env.ids;
  }
  ok('after four rounds both devices agree', phone.f1.num === desk.f1.num,
     'phone=' + phone.f1.num + ' desktop=' + desk.f1.num);
  ok('…and they agree with Drive', String(drive.num) === phone.f1.num,
     'drive=' + drive.num);
  ok('…on the answer that was decided LAST', phone.f1.num === '6427',
     'settled on ' + phone.f1.num);
}

console.log('\n== C. The rejections travel ==');
{
  // A photo Drive knows about, this device does not. Under v0.9.1412 the
  // seeded record arrived with an empty exclusion list, so the next re-scan
  // cheerfully re-offered the number the user had already ruled out.
  const a = buildSync({ ids: {} });
  a.run([file('f1', { num: '6440', rt: '100', rej: '6464-525,2300', conf: 'lo' })]);
  ok('a pulled read arrives WITH the numbers already ruled out',
     JSON.stringify(a.env.ids.f1.rejected) === JSON.stringify(['6464-525', '2300']),
     JSON.stringify(a.env.ids.f1.rejected));
  ok('…and keeps how sure the reader was', a.env.ids.f1.guess === 1);

  // Local rejections with nothing on Drive must go up.
  const b = buildSync({ ids: { f1: READ({ num: '6440', rt: 300, rejected: ['6464-525', '2300'] }) } });
  b.run([file('f1', { num: '6440', rt: '100' })]);
  ok('a rejection made here is pushed even when the NUMBER is unchanged',
     b.env.pushed.length === 1 && b.env.pushed[0].patch.rej === '6464-525,2300',
     JSON.stringify(b.env.pushed));

  // The Drive property caps at 100 characters. Entries must drop whole.
  const many = [];
  for (let i = 0; i < 40; i++) many.push('6464-' + (100 + i));
  const c = buildSync({ ids: { f1: READ({ num: '1', rt: 5, rejected: many }) } });
  c.run([file('f1', { num: '2', rt: '1' })]);
  const packed = c.env.pushed[0].patch.rej;
  ok('a long list is capped without cutting a number in half',
     packed.length <= 95 && packed.split(',').every(v => /^6464-\d{3}$/.test(v)),
     packed);
}

console.log('\n== D. A crop on one device is visible on the other ==');
{
  const a = buildSync({ ids: {}, cropped: {} });
  a.run([file('f1', { crop: '1758300000000' }), file('f2', {})]);
  ok('a photo cropped anywhere is marked for fresh bytes here',
     a.env.cropped.f1 === 1, JSON.stringify(a.env.cropped));
  ok('…and a photo nobody cropped is not', a.env.cropped.f2 === undefined);
  ok('…and the marker set is saved exactly once', a.env.savedCrop === 1,
     a.env.savedCrop + ' saves');

  const b = buildSync({ ids: {}, cropped: { f1: 1 } });
  b.run([file('f1', { crop: '1758300000000' })]);
  ok('…and an already-marked photo does not rewrite the set',
     b.env.savedCrop === 0, b.env.savedCrop + ' saves');
}

console.log('\n== E. THE OFFENDER: plant the old rule, require red ==');
{
  // Rebuild the sync with v0.9.1412's decision restored — the device always
  // wins — and require section A's key assertion to FAIL. If this passes, the
  // tests above are not actually testing the tiebreak.
  const old = grab('_pinSyncReadState')
    .replace(/if \(driveNum && driveRt > localRt\) \{/, 'if (false) {');
  const b = buildSync({
    ids: { f1: READ({ num: '6464-525', rt: 100 }) },
    syncSource: old
  });
  b.run([file('f1', { num: '6427', rt: '200', conf: 'hi' })]);
  const oldRuleFights = b.env.pushed.length === 1 && b.env.ids.f1.num === '6464-525';
  ok('with the old rule restored, the older device DOES push back (so this suite can fail)',
     oldRuleFights,
     'pushed=' + JSON.stringify(b.env.pushed) + ' num=' + b.env.ids.f1.num);
}

console.log('\n== F. Nothing that worked before is broken ==');
{
  // Drive knows, device does not — the original v0.9.1412 pull.
  const a = buildSync({ ids: {} });
  a.run([file('f1', { num: '6464-525', rt: '100', conf: 'hi' })]);
  ok('a read Drive knows and this device does not is still seeded',
     a.env.ids.f1.num === '6464-525' && a.env.ids.f1.rv === '1107');

  // Device read it, Drive has nothing — the original push.
  const b = buildSync({ ids: { f1: READ({ num: '6464-525', rt: 100 }) } });
  b.run([file('f1', {})]);
  ok('a read this device has and Drive does not is still stamped',
     b.env.pushed.length === 1 && b.env.pushed[0].patch.num === '6464-525');

  // Agreement must be silent — no write amplification on every load.
  const c = buildSync({ ids: { f1: READ({ num: '6464-525', rt: 100 }) } });
  c.run([file('f1', { num: '6464-525', rt: '100', conf: 'hi' })]);
  ok('when both sides already agree, nothing is written at all',
     c.env.pushed.length === 0 && c.env.savedIds === 0,
     'pushed=' + c.env.pushed.length + ' saves=' + c.env.savedIds);

  // A pre-1771 read carries no clock. It must not out-rank a real one.
  const d = buildSync({ ids: { f1: READ({ num: '6427', rt: 200 }) } });
  d.run([file('f1', { num: '6464-525' })]);
  ok('an unstamped Drive read never beats a stamped local one',
     d.env.pushed.length === 1 && d.env.pushed[0].patch.num === '6427');

  // A record from an older reader is not a current read.
  const e = buildSync({ ids: { f1: { num: '6427', rv: '900', rt: 999 } } });
  e.run([file('f1', { num: '6464-525', rt: '1', conf: 'hi' })]);
  ok('a read from a superseded reader version gives way to Drive',
     e.env.ids.f1.num === '6464-525');

  // No files, no crash.
  const f = buildSync({ ids: {} });
  f.run(null);
  ok('a null listing does not throw', true);
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
