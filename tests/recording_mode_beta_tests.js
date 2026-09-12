// ═══════════════════════════════════════════════════════════════
// recording_mode_beta_tests.js — v0.9.1720.
//
// Brad records the help-menu screen captures on his own owner account, and
// recording mode already makes his copy behave like a stranger's. He asked
// for the beta badges to travel with it: "i need the record mode to remove
// Beta references so i can do screen shots."
//
// Three badges were hardcoded in three files. They now all render from
// rrBetaBadge() in config.js, so there is ONE switch. These pins keep it that
// way — a fourth badge pasted in by hand would not answer the switch, and
// would show up in a capture with nobody the wiser until Brad saw it.
//
// The sign-in gate is deliberately EXCLUDED (Brad's call, 2026-09-12): there
// the word is doing a real job rather than decorating. The pin below stops a
// later session "finishing the job" and quietly changing what a stranger is
// told at the front door.
//
// Run:  node tests/recording_mode_beta_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── the switch itself, lifted out and RUN ───────────────────────
section('rrBetaBadge');
const src = cfg.slice(cfg.indexOf('const RR_BETA_BADGE_STYLE'), cfg.indexOf('function rrBetaBadge') + cfg.slice(cfg.indexOf('function rrBetaBadge')).indexOf('\n}\n') + 3);
function badgeWith(recording) {
  const f = new Function('rrRecordingMode', src + '\nreturn rrBetaBadge;')(() => recording);
  return f;
}
const off = badgeWith(false), on = badgeWith(true);

ok('renders a badge when recording mode is OFF', /^<span [^>]*>BETA<\/span>$/.test(off()), off());
ok('renders NOTHING when recording mode is ON', on() === '', JSON.stringify(on()));
ok('…and nothing regardless of the attributes passed',
   on('class="imp-beta"') === '' && on('style="font-size:0.62rem"') === '');
ok('a caller\'s own attributes are kept verbatim, so each badge still looks itself',
   off('class="imp-beta"') === '<span class="imp-beta">BETA</span>', off('class="imp-beta"'));
ok('no attributes falls back to the shared style', off().indexOf('font-size:0.6rem') > 0);
ok('it is defensive about being called before config loads',
   /typeof rrRecordingMode === 'function'/.test(cfg.slice(cfg.indexOf('function rrBetaBadge'))));

// ── every badge goes through the switch ─────────────────────────
section('No badge bypasses the switch');
const FILES = ['dashboard.js', 'import-ui.js', 'prefs.js'];
FILES.forEach(f => {
  const s = rd(f);
  ok(f + ' asks rrBetaBadge for its badge', /rrBetaBadge\(/.test(s));
  // a literal >BETA< in the markup is a badge that would survive recording mode
  const raw = (s.match(/>\s*BETA\s*</g) || []).length;
  ok(f + ' has no hand-rolled BETA span left', raw === 0, raw ? raw + ' found' : '');
});

// ── the front door is left alone, on purpose ────────────────────
section('The sign-in gate still says Beta');
const auth = rd('app-auth.js');
ok('the gate banner is untouched', auth.indexOf('Beta Testing In Progress') > 0);
ok('the gate button is untouched', auth.indexOf('Enter Beta') > 0);
ok('the gate does NOT consult recording mode', !/rrRecordingMode|rrBetaBadge/.test(auth));
ok('config.js records WHY the gate is excluded, so nobody "finishes the job"',
   /gate is deliberately NOT included/i.test(cfg));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
