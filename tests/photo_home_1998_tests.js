// ═══════════════════════════════════════════════════════════════
// photo_home_1998_tests.js — v0.9.1998. THE TIDY-UP RUNS ON ITS OWN.
//
// Brad's own Drive was tidied by hand on 2026-10-20 after he approved the
// move list (32 moved, 0 failed). He then said "yes" to switching the
// tidy-up on for everyone (RR_PHOTO_HOME.AUTO_TIDY). This proves the
// automatic run (drive.js rrPhotoTidySoon) against the REAL config.js +
// drive.js and the stand-in Drive:
//   A1 the switch is on in config.js;
//   A2 one start schedules ONE run, TIDY_FIRST_DELAY_MS after start;
//   A3 the run moves loose folders and records the day per collection;
//   A4 a run inside TIDY_EVERY_HOURS of the last one does nothing;
//   A5 with no collection open or no Google pass it does nothing;
//   P  planted: switch off → no timer; no throttle → a second run moves.
// Run:  node tests/photo_home_1998_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const { makeDrive, boot, CFG } = require('./lib/photo-home-lib.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// A start with a captured timer: returns the sandbox and the scheduled jobs.
function start(opts) {
  opts = opts || {};
  const D = makeDrive();
  const loose = D.add('DWG-290', 'PHOTOS'); D.add('DWG-290 FV.jpg', loose, 'image/jpeg');
  const B = boot({ drive: D, owned: {}, driveSrc: opts.driveSrc });
  if (opts.cfgOff) B.run('RR_PHOTO_HOME.AUTO_TIDY = false');
  const jobs = [];
  B.ctx.setTimeout = function (fn, ms) { jobs.push({ fn: fn, ms: ms }); return jobs.length; };
  B.ctx.state.personalSheetId = opts.noSheet ? '' : 'SHEET-1';
  if (opts.noToken) B.ctx.accessToken = '';
  return { B: B, D: D, jobs: jobs, loose: loose };
}

(async function () {
  console.log('\n== A. The automatic tidy-up ==');
  ok('A1 the switch is on in config.js', /\n  AUTO_TIDY: true,/.test(CFG));
  {
    const S = start();
    S.B.run('rrPhotoTidySoon()'); S.B.run('rrPhotoTidySoon()');
    const delay = S.B.run('RR_PHOTO_HOME.TIDY_FIRST_DELAY_MS');
    ok('A2 one start schedules ONE run, after the start-up delay', S.jobs.length === 1 && S.jobs[0].ms === delay && delay >= 60000,
       JSON.stringify(S.jobs.map(j => j.ms)));
    await S.jobs[0].fn();
    const at = S.D.files.find(f => f.id === S.loose).parents[0];
    const stamp = S.B.ctx.localStorage.getItem('lv_photo_tidy_at:SHEET-1');
    ok('A3 the run moves the loose folder into its main folder and records the day', at !== 'PHOTOS' && Number(stamp) > 0, 'parent ' + at + ', stamp ' + stamp);
  }
  {
    const S = start();
    S.B.ctx.localStorage.setItem('lv_photo_tidy_at:SHEET-1', String(Date.now() - 3600000));   // an hour ago
    S.B.run('rrPhotoTidySoon()');
    await S.jobs[0].fn();
    ok('A4 a run within a day of the last one does nothing', S.D.files.find(f => f.id === S.loose).parents[0] === 'PHOTOS' && S.D.writes() === 0);
  }
  {
    const S1 = start({ noSheet: true }); S1.B.run('rrPhotoTidySoon()'); await S1.jobs[0].fn();
    const S2 = start({ noToken: true }); S2.B.run('rrPhotoTidySoon()'); await S2.jobs[0].fn();
    ok('A5 with no collection open, or no Google pass, it does nothing', S1.D.writes() === 0 && S2.D.writes() === 0);
  }

  console.log('\n== P. Planted offenders ==');
  {
    const S = start({ cfgOff: true });
    S.B.run('rrPhotoTidySoon()');
    ok('P1 with the switch off no run is scheduled (A2 would catch a switch left off)', S.jobs.length === 0);
  }
  {
    const { DRV } = require('./lib/photo-home-lib.js');
    const T = '        if (Date.now() - last < RR_PHOTO_HOME.TIDY_EVERY_HOURS * 3600000) return;\n';
    ok('P2 setup: the once-a-day check is in drive.js exactly once', DRV.split(T).length === 2);
    const S = start({ driveSrc: DRV.replace(T, '') });
    S.B.ctx.localStorage.setItem('lv_photo_tidy_at:SHEET-1', String(Date.now() - 3600000));
    S.B.run('rrPhotoTidySoon()');
    await S.jobs[0].fn();
    ok('P2 without the once-a-day check it runs again within the hour (A4 catches it)', S.D.files.find(f => f.id === S.loose).parents[0] !== 'PHOTOS');
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL  suite crashed: ' + (e && e.stack)); process.exit(1); });
