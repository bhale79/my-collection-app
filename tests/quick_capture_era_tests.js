// ═══════════════════════════════════════════════════════════════
// quick_capture_era_tests.js — v0.9.1724.
//
// Brad, 2026-09-12: "i did the photo inbox add with my phone and i tagge the
// photos, but it didn't tag the photos. I had to retag them in the inbox."
//
// He had tagged them. Add photos asks "What are you about to photograph?", he
// answered, and the bar read "Now shooting Lionel Postwar" — then Quick
// Capture stamped the VIEW on each shot and nothing else. _upload, the
// drop/camera-roll path, has always written { era, stat:'stamped' } beside its
// upload. Quick Capture never did, on ANY of its three routes: the live
// upload, the offline stage, and the rescue after a failed upload (the last
// two passed a literal '' where _stageOne takes an era).
//
// His 66 photos proved it from the other end: every one created 13:58–14:01,
// every one given era=pw at 18:13 — four hours later, by hand, in the inbox.
//
// The re-tagging was not the damage. The photos were READ while untagged, and
// an untagged read has no catalog to check against, so it checks all of them:
// one came back "81153 — CSX SD70MAC Diesel", marked HIGH confidence, a number
// that exists only in Lionel MPC-Modern, pieced out of the fragments
// 173/64273/1153/153. With the postwar tag in force the era gate rejects that
// row outright. There was simply no tag for it to use.
//
// These pins hold the era onto all three routes.
//
// Run:  node tests/quick_capture_era_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

// ── the real _qcUpload, lifted out and RUN ──────────────────────
const f0 = SRC.indexOf('async function _qcUpload(file, name, rec)');
const f1 = SRC.indexOf('function _qcAllLanded()');
const BODY = SRC.slice(f0, f1);

function mkUpload(opts) {
  opts = opts || {};
  const log = { stamps: [], staged: [], uploads: [] };
  const deps = {
    _pinOffline: () => !!opts.offline,
    _stageOne: async (file, name, era, view) => { log.staged.push({ name, era, view }); return 'stg1'; },
    _stageRenderStrip: async () => {},
    _qc: { pending: 0, failed: [], recent: [] },
    _qcRender: () => {},
    _qcToken: () => 'tok',
    _folder: async () => 'folder1',
    driveUploadFile: async () => {
      if (opts.uploadFails) throw new Error('network');
      log.uploads.push(1);
      return { id: 'drive1' };
    },
    _pinMetaSet: async (id, patch) => { log.stamps.push({ id, patch }); return true; },
    _qcAllLanded: () => {},
  };
  const names = Object.keys(deps);
  const fn = new Function(...names,
    'var _qcFlight = 0, _qcLanded = 0, _qcRescued = 0;\n' + BODY + '\nreturn _qcUpload;'
  )(...names.map(n => deps[n]));
  return { run: fn, log };
}

const REC = (era, view) => ({ view: view === undefined ? 'RSV' : view, era: era, group: 1 });

(async function () {

section('The live upload — the route Brad was on');
{
  const u = mkUpload();
  await u.run({}, 'INBOX 1 g1-1 p1.jpg', REC('pw'));
  const p = u.log.stamps[0] && u.log.stamps[0].patch;
  ok('the ERA is written onto the uploaded photo', !!(p && p.era === 'pw'), JSON.stringify(p));
  ok('the view still rides with it', !!(p && p.view === 'RSV'));
  ok("status says 'stamped', matching _upload's patch exactly", !!(p && p.stat === 'stamped'));
  ok('one write, not two — the era and view go together', u.log.stamps.length === 1);
}
{
  // stat is derived from era presence elsewhere in this file, so claiming it
  // without an era would list the photo under Tagged with nothing behind it.
  const u = mkUpload();
  await u.run({}, 'n.jpg', REC('', 'RSV'));
  const p = u.log.stamps[0] && u.log.stamps[0].patch;
  ok('no era chosen -> view only, and NO stamped status', !!(p && p.view === 'RSV' && !p.era && !p.stat), JSON.stringify(p));
}
{
  const u = mkUpload();
  await u.run({}, 'n.jpg', REC('pw', ''));
  const p = u.log.stamps[0] && u.log.stamps[0].patch;
  ok('era but no view -> the era still lands', !!(p && p.era === 'pw' && !p.view), JSON.stringify(p));
}
{
  const u = mkUpload();
  await u.run({}, 'n.jpg', REC('', ''));
  ok('nothing to say -> no write at all', u.log.stamps.length === 0);
}

section('The two routes that lose a photo if they forget');
{
  // Out of signal at a train show is exactly when Quick Capture gets used.
  const u = mkUpload({ offline: true });
  await u.run({}, 'INBOX 1 g1-1 p1.jpg', REC('pw'));
  ok('an OFFLINE shot stages with its era, not an empty string',
     u.log.staged.length === 1 && u.log.staged[0].era === 'pw', JSON.stringify(u.log.staged[0]));
  ok('…and its view', u.log.staged[0].view === 'RSV');
  ok('nothing was uploaded while offline', u.log.uploads.length === 0);
}
{
  const u = mkUpload({ uploadFails: true });
  await u.run({}, 'INBOX 1 g1-1 p1.jpg', REC('pw'));
  ok('a RESCUED shot (upload failed) keeps its era too',
     u.log.staged.length === 1 && u.log.staged[0].era === 'pw', JSON.stringify(u.log.staged[0]));
  ok('…and its view', u.log.staged[0].view === 'RSV');
}

section('The era reaches the record in the first place');
{
  // _qcShot builds the record. Source pins, because it is wired into the
  // capture sheet's DOM and counters and is not worth lifting out whole.
  const shot = SRC.slice(SRC.indexOf('function _qcShot(file)'), SRC.indexOf('async function _qcUpload'));
  ok('the shot record carries an era', /era: _eStamp/.test(shot));
  ok('it comes from the SAME source the bar displays', /_pinOneShot \|\| _pinHomeEra\(\)/.test(shot));
  ok('a one-shot era is SPENT by this shot and springs back',
     /if \(_pinOneShot\) \{ _pinOneShot = null;/.test(shot));
  ok('spending it redraws the bar, so the screen stops claiming it is armed',
     /_pinRenderBar\(\)/.test(shot));
}

section('No route left behind');
ok('NO _stageOne call passes an empty era any more',
   !/_stageOne\(file, name, '', /.test(SRC),
   (SRC.match(/_stageOne\(file, name, '', /g) || []).length + ' left');
ok('all three Quick Capture routes read rec.era',
   (SRC.match(/rec && rec\.era/g) || []).length === 2 && /if \(rec\.era\)/.test(SRC));
ok('the drop / camera-roll path is untouched — it was already right',
   /_pinMetaSet\(up\.id, \{ era: _thisEra, stat: 'stamped' \}\)/.test(SRC));
ok('_stageFiles still computes its own era for drops',
   /var thisEra = \(_pinOneShot && !spent\) \? _pinOneShot : _pinHomeEra\(\);/.test(SRC));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

})();
