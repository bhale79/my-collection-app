// ── v0.9.1418 — the Photo Inbox busy flag ─────────────────────────────────
//
// Cooper, on a desktop, v0.9.1415: "selecting items to tag, tried to apply
// said tag, nothing happened. I clicked apply button, nothing happened."
// His breadcrumbs show eight clicks on "Apply to 20" over 36 seconds and not
// one word back from the app.
//
// _pinApplyTags had three early exits. Two showed a toast; the third — the
// busy guard — was a bare `return`. The button label "Apply to 20" is only
// built when photos are ticked AND an era is chosen, which is exactly what
// the two talking exits check, so the silent one is the only one he could
// have hit.
//
// The behavioural half of this (the stuck detector, the flag's memory) runs
// for real in a stub browser. The structural half — "no guard anywhere in
// this file is silent" — is asserted against the source, because the point
// is coverage of every guard, including ones added next year.

const fs   = require('fs');
const path = require('path');

const APP = n => path.join(__dirname, '..', 'app', n);
const INBOX = fs.readFileSync(APP('photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function drilled(name, fixed, broken) {
  ok(name, fixed);
  ok('  ↳ pre-fix code fails this (drill)', !broken,
     broken ? 'the old code passed too — this assertion has no teeth' : '');
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ══ 1. No guard in this file is allowed to be silent ═══════════════════════
section('Every busy guard says something');

// Find every `if (... _busy ...)` guard and read the block it runs.
function guards(src) {
  const out = [];
  const re = /^[ \t]*if \([^)]*\b_busy\b[^)]*\)\s*(\{[^\n]*\}|[^\n]*)$/gm;
  let m;
  while ((m = re.exec(src))) {
    // The local `var _busy = _pinBtnBusy(...)` shadow is a FUNCTION, not the
    // shared flag — its call sites are not guards and must not be counted.
    if (/var _busy =/.test(m[0])) continue;
    // A guard is an early EXIT. `if (msg && _busy) _busyProgressAt = ...` in
    // _status reads like one to a regex and is not one — it is the heartbeat.
    // Requiring a `return` is what separates the two.
    if (!/\breturn\b/.test(m[1])) continue;
    out.push({ line: src.slice(0, m.index).split('\n').length, body: m[1] });
  }
  return out;
}
// A guard "speaks" if it bounces, toasts, or paints a status before leaving.
const speaks = b => /_pinBusyBounce\(\)|showToast\(|_status\(/.test(b);

const found = guards(INBOX);
ok('the guard scanner found the guards at all', found.length >= 8, found.length + ' found');
const silent = found.filter(g => !speaks(g.body));
ok('NO busy guard returns silently',
   silent.length === 0,
   silent.map(g => 'line ' + g.line + ': ' + g.body.trim()).join(' | '));

// Drill the scanner against the shape that shipped, or "0 silent" is vacuous.
const preFix = [
  '  window._pinApplyTags = async function () {',
  '    if (_busy) return;',
  '    var ids = [];',
  '  };',
  '  window._pinAddNoNumber = function () {',
  '    if (!gs.length || _busy) return;',
  '  };',
].join('\n');
const preSilent = guards(preFix).filter(g => !speaks(g.body));
drilled('the scanner recognises a silent guard when it sees one',
        preSilent.length === 2, preSilent.length === 0);

// The reported button, by name.
const applyFn = INBOX.slice(INBOX.indexOf('window._pinApplyTags = async function'),
                            INBOX.indexOf('window._pinApplyTags = async function') + 900);
drilled("COOPER'S BUG: Apply tells you why it did nothing",
        /if \(_busy\) \{ _pinBusyBounce\(\); return; \}/.test(applyFn),
        /if \(_busy\) return;\n/.test(applyFn));

// ══ 2. One owner for the flag ══════════════════════════════════════════════
section('The flag has a single writer and a memory');

ok('nothing assigns the shared flag directly any more',
   !/(?<!var )_busy = (true|false);/.test(INBOX),
   (INBOX.match(/_busy = (true|false);/g) || []).join(' | '));
ok('the declaration is still a plain flag', /^  var _busy = false;$/m.test(INBOX));
ok('every raise names its job for the collector to read',
   (INBOX.match(/_setBusy\(true, '[^']+'\)/g) || []).length >= 6,
   (INBOX.match(/_setBusy\(true[^)]*\)/g) || []).join(' | '));
ok('the local _pinBtnBusy shadow was left alone',
   /var _busy = _pinBtnBusy\(/.test(INBOX));
ok('_status is the progress heartbeat',
   /if \(msg && _busy\) _busyProgressAt = Date\.now\(\);/.test(INBOX));
ok('...stamped before the missing-element return, so a rebuilt page does not read as stalled',
   INBOX.indexOf('if (msg && _busy) _busyProgressAt') <
   INBOX.indexOf('if (!el) return;', INBOX.indexOf('function _status(msg, stopFn)')));

// ══ 3. The stuck detector, run for real ════════════════════════════════════
section('Wedged vs merely slow');

// Lift the flag machinery out and run it on a clock we control.
const { api, ctx } = (() => {
  const src = INBOX.slice(INBOX.indexOf('  var _busySince = 0;'),
                          INBOX.indexOf('  function _pinStuckStatus()'));
  const sandbox = { now: 1000000 };
  const api = new Function('ctx', `
    var _busy = false;
    var window = {}, location = { reload: function () {} };
    var Date = { now: function () { return ctx.now; } };
    ${src}
    return {
      setBusy: function (o, w) { _setBusy(o, w); },
      stuck: function () { return _busyStuck(); },
      progress: function () { if (_busy) _busyProgressAt = Date.now(); },
      what: function () { return _busyWhat; },
      busy: function () { return _busy; },
      threshold: _STUCK_MS,
    };
  `)(sandbox);
  return { api, ctx: sandbox };
})();

ok('an idle inbox is never "stuck"', !api.stuck());
api.setBusy(true, 'Tagging photos');
ok('a job that just started is not stuck', !api.stuck());
ok('...and the job is named', api.what() === 'Tagging photos');

ctx.now += 60000;                      // one minute in, no progress
ok('a job one minute in is slow, not stuck', !api.stuck());

ctx.now += 61000;                      // just past two minutes
ok('a job with no progress for over two minutes IS stuck', api.stuck());

// A long job that keeps reporting must never be called stuck — this is the
// assertion that stops the detector from firing on a big, healthy import.
api.setBusy(true, 'Adding photos');
for (let i = 0; i < 40; i++) { ctx.now += 90000; api.progress(); }
ok('a long job that keeps reporting progress is never called stuck',
   !api.stuck(), 'ran ' + (40 * 90 / 60) + ' minutes of healthy work');
ctx.now += 130000;                     // it finally stalls
ok('...but it IS called stuck once it stops reporting', api.stuck());

api.setBusy(false);
ok('clearing the flag clears the stuck state', !api.stuck() && !api.busy());
ok('...and forgets the job name', api.what() === '');
ok('the threshold is two minutes', api.threshold === 120000);

// ══ 4. The way out is a reload, not a flag reset ═══════════════════════════
section('The escape hatch');

const stuckPainter = INBOX.slice(INBOX.indexOf('function _pinStuckStatus()'),
                                 INBOX.indexOf('function _pinStuckStatus()') + 1400);
ok('the stuck line offers a restart button', /_pinRestartApp\(\)/.test(stuckPainter));
ok('...and says the photos are safe', /Drive/.test(stuckPainter));
ok('...and names the job that wedged', /_busyWhat/.test(stuckPainter));
ok('restart reloads rather than clearing the flag under a live job',
   /_pinRestartApp = function \(\) \{ location\.reload\(\); \};/.test(INBOX));
ok('nothing anywhere force-clears the flag behind the collector\'s back',
   !/_busy = false;?\s*\/\/ *force|forceUnstick|_pinForceUnstick/.test(INBOX));

const bounce = INBOX.slice(INBOX.indexOf('function _pinBusyBounce()'),
                           INBOX.indexOf('function _pinBusyBounce()') + 900);
ok('the bounce checks WEDGED before it checks waiting',
   bounce.indexOf('_pinStuckStatus()') < bounce.indexOf('_pinGPStatus()') &&
   bounce.indexOf('_pinStuckStatus()') > -1);
ok('the ordinary busy message names the job instead of "the last batch"',
   /_busyWhat \? \('Still working: '/.test(bounce));

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
