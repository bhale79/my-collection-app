// ══ tests/recording_mode_tests.js ══════════════════════════════════════════
//
// v0.9.1697 (Session 93, "recording mode"): Brad — "i need this dashboard to
// look like a normal users dashboard without the maintenance and yardmaster
// stuff" — he records the help-menu screen captures on his OWN account, which
// is an owner account. Recording mode makes his copy behave like a stranger's.
//
// NOT to be confused with tests/offline_show_mode_tests.js, which is about
// working offline AT TRAIN SHOWS (Session 87). Different feature entirely;
// the name here was changed to "recording" precisely so the two never blur.
//
// These pins hold the shape:
//   · ONE owner list, in config.js — not a copy in every file that needs it
//   · every gated FEATURE consults recording mode
//   · the Preferences SWITCH does NOT — it is the way back out
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

const cfg   = rd('config.js');
const ym    = rd('yardmaster.js');
const maint = rd('maintenance.js');
const prefs = rd('prefs.js');

// ── config.js is the single source of truth ────────────────────────────────
ok('config.js declares the owner list',
   /const RR_OWNER_EMAILS = \[/.test(cfg), '');
ok('…holding both owner addresses',
   /RR_OWNER_EMAILS = \[[^\]]*bhale@ipd-llc\.com[^\]]*support@therailroster\.com[^\]]*\]/.test(cfg), '');
ok('config.js exposes the three helpers on window',
   /window\.rrRecordingMode\s*=/.test(cfg)
   && /window\.rrSetRecordingMode\s*=/.test(cfg)
   && /window\.rrIsRealOwner\s*=/.test(cfg), '');
ok('recording mode is read from localStorage and defaults OFF',
   /function rrRecordingMode\(\)\s*\{[\s\S]{0,200}?getItem\(RR_RECORDING_MODE_KEY\) === '1'/.test(cfg)
   && /catch \(e\) \{ return false; \}/.test(cfg), '');
ok('a thrown localStorage (private mode, blocked cookies) is not an owner grant',
   /function rrRecordingMode\(\)[\s\S]{0,240}?catch \(e\) \{ return false; \}/.test(cfg), '');

// ── the two gated files no longer carry their own primary list ─────────────
[['yardmaster.js', ym], ['maintenance.js', maint]].forEach(function (pair) {
  const nm = pair[0], src = pair[1];
  ok(nm + ' reads the central list, with a fallback only',
     /OWNER_EMAILS: \(typeof RR_OWNER_EMAILS !== 'undefined' && RR_OWNER_EMAILS\)/.test(src), '');
  ok(nm + ' still has a hardcoded seatbelt so a late config.js cannot lock Brad out',
     /\|\|\s*\['bhale@ipd-llc\.com', 'support@therailroster\.com'\]/.test(src), '');
  ok(nm + ' _isOwner() consults recording mode BEFORE the email test',
     new RegExp("function _isOwner\\(\\)[\\s\\S]{0,700}?rrRecordingMode\\(\\)\\) return false;[\\s\\S]{0,300}?OWNER_EMAILS\\.indexOf").test(src), '');
});

// ── stock photos ride the maintenance gate, so they follow for free ────────
ok('stock-photos.js still gates on window._maintIsOwner (so it follows)',
   /_maintIsOwner/.test(rd('stock-photos.js')), '');
ok('maintenance.js still publishes _maintIsOwner',
   /window\._maintIsOwner = _isOwner;/.test(maint), '');

// ── the escape hatch: the switch must NOT be recording-mode-aware ──────────
ok('the Preferences section is gated on rrIsRealOwner, not _isOwner',
   /function _prefsOwnerToolsHtml\(\)[\s\S]{0,300}?rrIsRealOwner\(\)/.test(prefs), '');
const _realOwnerBody = (function () {
  const i = cfg.indexOf('function rrIsRealOwner()');
  return i < 0 ? '' : cfg.slice(i, cfg.indexOf('\n}', i) + 2);
})();
ok('…and rrIsRealOwner NEVER consults recording mode (or the off switch vanishes)',
   _realOwnerBody.length > 40 && !/rrRecordingMode/.test(_realOwnerBody), _realOwnerBody.slice(0, 80));
ok('a non-owner gets an empty string — no mystery switch in anyone else’s app',
   /if \(typeof rrIsRealOwner !== 'function' \|\| !rrIsRealOwner\(\)\) return '';/.test(prefs), '');
ok('the section is rendered into the Preferences page',
   /\$\{_prefsOwnerToolsHtml\(\)\}/.test(prefs), '');
ok('flipping the switch reloads (the nav items self-inject at boot)',
   /function _prefsToggleRecordingMode[\s\S]{0,500}?location\.reload\(\)/.test(prefs), '');
ok('…and it writes the setting before reloading',
   /function _prefsToggleRecordingMode[\s\S]{0,200}?rrSetRecordingMode\(!!on\)/.test(prefs), '');

// ── the name collision this feature was renamed to avoid ──────────────────
ok('nothing here calls itself "show mode" (that name belongs to the offline/train-show work)',
   !/show[ _-]?mode/i.test(cfg + ym + maint + prefs), '');

// ── behaviour, actually executed ──────────────────────────────────────────
(function () {
  const store = {};
  global.localStorage = {
    getItem(k) { return store[k] === undefined ? null : store[k]; },
    setItem(k, v) { store[k] = String(v); }
  };
  global.window = {};
  const sandbox = {};
  // pull just the four functions out of config.js without running the rest
  const slice = cfg.slice(cfg.indexOf('const RR_OWNER_EMAILS'), cfg.indexOf('} catch (e) {}', cfg.indexOf('window.RR_OWNER_EMAILS')) + 14);
  eval(slice);

  global.window.state = { user: { email: 'bhale@ipd-llc.com' } };
  ok('RUN: owner is recognised', window.rrIsRealOwner() === true);
  ok('RUN: recording mode defaults OFF', window.rrRecordingMode() === false);
  window.rrSetRecordingMode(true);
  ok('RUN: it turns ON', window.rrRecordingMode() === true);
  ok('RUN: the owner is STILL a real owner while it is on (the way back out)',
     window.rrIsRealOwner() === true);
  global.window.state = { user: { email: 'SUPPORT@THERAILROSTER.COM' } };
  ok('RUN: the email match is case-insensitive', window.rrIsRealOwner() === true);
  global.window.state = { user: { email: 'someone@else.com' } };
  ok('RUN: a stranger is never an owner', window.rrIsRealOwner() === false);
  global.window.state = null;
  ok('RUN: signed out is never an owner', window.rrIsRealOwner() === false);
  window.rrSetRecordingMode(false);
  ok('RUN: it turns OFF again', window.rrRecordingMode() === false);
})();

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
