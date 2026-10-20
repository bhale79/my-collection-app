// ═══════════════════════════════════════════════════════════════
// appearance_ring_2008_tests.js — v0.9.2008. APPEARANCE IS A FEATURE RING.
//
// [stated] Brad, 2026-10-20: "is there something in one of my sheets that
// tell me and lets me change things from beta to user?" → "do the appearance
// in the features tab" → "approve adding appearance to the features tab".
//
// Before: rrAppearanceOn() had its OWN beta rule (APPEARANCE_BETA_ONLY + this
// browser's beta code + _subState.sub === 'beta'), so the sheet could not move
// Appearance. Now it asks rrFeatureOn('appearance') — the Vault `features` tab
// row  appearance | B  — like Maintenance. The REAL app/config.js runs whole in
// a Node sandbox (localStorage + window stood in). Asserted:
//   A  new members (trial, paid, none) get no Appearance / logo cards
//   B  a beta tester gets it ONLY when the backend's list names it — the old
//      built-in beta rule is gone (sub 'beta' alone, or the browser's beta
//      code alone, is no longer enough)
//   C  owners always; recording mode never; APPEARANCE_ENABLED still forces on
//   D  one name, one reader: the dashboard's logo cards and the Preferences
//      row still ask rrAppearanceOn; nothing else reads the old flag
// Every rule is shown able to fail on a planted offender (the old function).
// Run:  node tests/appearance_ring_2008_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const CFG = rd('config.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// A fresh sandbox running the whole config.js. `src` lets a planted version run.
function box(src) {
  const store = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    navigator: { userAgent: 'node' }, location: { href: 'https://therailroster.com/app/', search: '', hostname: 'therailroster.com' },
    document: { addEventListener() {}, documentElement: { style: {} }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    addEventListener() {}, setTimeout, clearTimeout, Date, Math, JSON
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'config.js' });
  return ctx;
}
function who(ctx, email, sub, features, extra) {
  ctx.state = { user: email ? { email } : null };
  ctx._subState = sub === undefined ? undefined : { sub, features: features || [] };
  delete ctx._isBetaVerified;
  if (extra) extra(ctx);
  return ctx.rrAppearanceOn();
}

// The function as it stood in v0.9.2007 — the planted offender.
const OLD_FN = `function rrAppearanceOn() {
  if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return false;
  if (typeof APPEARANCE_ENABLED !== 'undefined' && APPEARANCE_ENABLED) return true;
  try {
    if (typeof _isBetaVerified === 'function' && _isBetaVerified()) return true;
    var _s = (typeof window !== 'undefined') && window._subState;
    if (_s && _s.sub === 'beta') return true;
  } catch (e) {}
  return false;
}`;
function planted() {
  const i = CFG.indexOf('function rrAppearanceOn()');
  const j = CFG.indexOf('\n}\n', i) + 3;
  return CFG.slice(0, i) + OLD_FN + '\n' + CFG.slice(j);
}

let c;
try { c = box(CFG); } catch (e) { ok('config.js runs in the sandbox', false, String(e)); }
if (c) {
  section('A  new members get no Appearance and no logo cards');
  ok('A1 3-week trial, nothing switched on → no',        who(c, 'new.member@gmail.com', 'trial', []) === false);
  ok('A2 paid member, nothing switched on → no',         who(c, 'paid.member@gmail.com', 'active', []) === false);
  ok('A3 never subscribed → no',                          who(c, 'stranger@gmail.com', 'none', []) === false);
  ok('A4 signed out, no backend answer → no (fails closed)', who(c, '', undefined) === false);
  ok('A5 a member whose list has OTHER features only → no', who(c, 'a@gmail.com', 'active', ['maintenance', 'auto_read']) === false);

  section('B  beta testers: the features tab decides, not a rule in the code');
  ok('B1 beta tester, list names appearance → yes',       who(c, 'beta.b@gmail.com', 'beta', ['appearance']) === true);
  ok('B2 beta tester, list does NOT name it → no (sheet moved it off)', who(c, 'beta.b@gmail.com', 'beta', []) === false);
  ok('B3 this browser\'s old beta code alone → no',        who(c, 'x@gmail.com', 'trial', [], k => { k._isBetaVerified = () => true; }) === false);
  ok('B4 sheet moved to everyone → a paid member gets it', who(c, 'paid.member@gmail.com', 'active', ['appearance']) === true);
  ok('B5 the feature name is ONE constant, "appearance"',  c.RR_APPEARANCE_FEATURE === 'appearance' && /rrFeatureOn\(RR_APPEARANCE_FEATURE\)/.test(CFG));
  // planted: the v0.9.2007 function says yes to B2 and B3 — these checks would catch it
  let p; try { p = box(planted()); } catch (e) { p = null; }
  ok('B6 PLANTED: the old built-in rule gives a beta tester Appearance the sheet took away (B2 catches it)',
     !!p && who(p, 'beta.b@gmail.com', 'beta', []) === true);
  ok('B7 PLANTED: the old rule lets a browser beta code turn it on (B3 catches it)',
     !!p && who(p, 'x@gmail.com', 'trial', [], k => { k._isBetaVerified = () => true; }) === true);
  ok('B8 PLANTED: the old rule ignores the sheet for everyone (B4 catches it)',
     !!p && who(p, 'paid.member@gmail.com', 'active', ['appearance']) === false);

  section('C  owners, recording mode, the master switch');
  ok('C1 owner bhale@ with no list → yes',                who(c, 'bhale@ipd-llc.com', 'beta', []) === true);
  ok('C2 owner support@ → yes',                            who(c, 'support@therailroster.com', 'active', []) === true);
  const RKEY = vm.runInContext('RR_RECORDING_MODE_KEY', c);
  c.localStorage.setItem(RKEY, '1');
  ok('C3 recording mode hides it even from an owner',      who(c, 'bhale@ipd-llc.com', 'beta', ['appearance']) === false);
  ok('C4 recording mode hides it from a ringed beta tester', who(c, 'beta.b@gmail.com', 'beta', ['appearance']) === false);
  c.localStorage.removeItem(RKEY);
  ok('C5 APPEARANCE_ENABLED stays false (the sheet decides)', /const APPEARANCE_ENABLED = false;/.test(CFG));
  const forced = (() => { try { return box(CFG.replace('const APPEARANCE_ENABLED = false;', 'const APPEARANCE_ENABLED = true;')); } catch (e) { return null; } })();
  ok('C6 …and flipped true it still forces it on for everyone', !!forced && who(forced, 'new.member@gmail.com', 'trial', []) === true);
}

section('D  one name, one reader');
const fnSrc = CFG.slice(CFG.indexOf('function rrAppearanceOn()'), CFG.indexOf('\n}\n', CFG.indexOf('function rrAppearanceOn()')));
ok('D1 rrAppearanceOn no longer carries its own beta rule', !/_isBetaVerified|_subState|sub === 'beta'/.test(fnSrc), fnSrc);
ok('D2 APPEARANCE_BETA_ONLY is gone from the code (only named in a history comment)',
   !/const APPEARANCE_BETA_ONLY|APPEARANCE_BETA_ONLY\s*[&|!)]/.test(CFG));
ok('D3 PLANTED: D1 sees the old rule', /_isBetaVerified|_subState/.test(OLD_FN));
const DASH = rd('dashboard.js'), PREFS = rd('prefs.js'), AP = rd('appearance.js');
ok('D4 the dashboard\'s card library still hides logo cards through rrAppearanceOn',
   /cat\.filter\(function\(c\) \{ return !c\.logoCard \|\| \(typeof rrAppearanceOn === 'function' && rrAppearanceOn\(\)\); \}\)/.test(DASH));
ok('D5 the Preferences row still asks rrAppearanceOn', /rrAppearanceOn === 'function' && rrAppearanceOn\(\)\) \?/.test(PREFS));
ok('D6 the editor still returns early through rrAppearanceOn', /if \(typeof rrAppearanceOn === 'function' && !rrAppearanceOn\(\)\) return;/.test(AP));
// nothing in the app asks the old beta rule for Appearance any other way
const offenders = fs.readdirSync(APP).filter(f => f.endsWith('.js')).filter(f => /APPEARANCE_BETA_ONLY/.test(rd(f).replace(/\/\/.*$/gm, '')));
ok('D7 no app file reads APPEARANCE_BETA_ONLY', offenders.length === 0, offenders);
ok('D8 PLANTED: D7 would see a file that still reads it', /APPEARANCE_BETA_ONLY/.test('if (APPEARANCE_BETA_ONLY) x();'.replace(/\/\/.*$/gm, '')));

console.log('\n' + (fail ? 'FAILED  —  ' + pass + ' passed, ' + fail + ' failed' : 'ALL APPEARANCE RING 2008 TESTS GREEN (' + pass + ')'));
process.exit(fail ? 1 : 0);
