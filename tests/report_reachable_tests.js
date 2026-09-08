// ══ tests/report_reachable_tests.js ════════════════════════════════════════
//
// v0.9.1701–1702 (Session 93). Brad, mid-bug-hunt: "where is report a problem
// on the phone" — then "yes i do want it at the end of the scroll bar".
//
// THE BUG, which was never a code bug: below 640px app.css hides .sidebar
// outright and there is no hamburger, so the sidebar's "Report a problem"
// does not exist on a phone. The only route was the account menu, which
// v0.9.1414 had ALREADY had to move above Sign Out because Brad could not
// find it — and he could not find it again. Meanwhile Preferences offered a
// row called "Send Feedback" that opened a bare mailto carrying a version
// string and nothing else. Two doors marked "tell us what went wrong", and
// the findable one was the useless one.
//
// The rule these pins defend: on a phone, the reporter that carries the
// DIAGNOSTICS must be reachable without hunting, and no door marked feedback
// may quietly lead somewhere worse.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const er = rd('error-report.js');
const pf = rd('prefs.js');
const css = rd('app.css');

// ── the fact that caused it, pinned so nobody "fixes" the sidebar instead ──
ok('the sidebar really is hidden on a phone (this is why the sidebar entry is not enough)',
   /@media \(max-width: 640px\)[\s\S]{0,4000}?\.sidebar \{ display: none; \}/.test(css), '');

// ── three doors, all reaching the real reporter ───────────────────────────
ok('door 1 — the sidebar item still exists for desktop',
   /id = 'nav-errreport-btn'/.test(er) && /errReportOpen\(\)/.test(er), '');
ok('door 2 — the account menu entry still sits ABOVE Sign Out',
   /menu\.insertBefore\(mbtn, signOut\)/.test(er), '');
ok('door 3 — Preferences opens the REAL reporter, not a mailto',
   /<strong>Report a problem<\/strong>/.test(pf)
   && /errReportOpen\(\);\}else\{location\.href='\$\{_rrFeedbackMailto\(\)\}';\}/.test(pf), '');
ok('…with the bare mailto kept only as the fallback if the reporter failed to load',
   /if\(typeof errReportOpen==='function'\)/.test(pf), '');
ok('…and the old "Send Feedback → mailto" row is gone from Preferences',
   !/<strong>Send Feedback<\/strong>/.test(pf), '');

// ── door 4 — the mobile bar, at the END, per Brad ─────────────────────────
ok('door 4 — a Report entry is injected into the mobile bottom bar',
   /querySelector\('\.mobile-nav-items'\)/.test(er) && /id = 'mnav-errreport'/.test(er), '');
ok('…at the END of the bar, so it displaces no daily destination',
   /mnav\.appendChild\(nb\)/.test(er), '');
ok('…built only once, however many times the injector runs',
   /!document\.getElementById\('mnav-errreport'\)/.test(er), '');
ok('…and it opens the modal WITHOUT stealing the active page highlight',
   /nb\.onclick = function \(\) \{ errReportOpen\(\); \};/.test(er)
   && !/showPage\([^)]*mnav-errreport/.test(er), '');
ok('…and it re-syncs the ">" hint, which is computed from the bar’s width',
   /mnav\.dispatchEvent\(new Event\('scroll'\)\)/.test(er), '');
ok('…by nudging the bar’s OWN handler, not a window resize half the app listens to',
   !/dispatchEvent\(new Event\('resize'\)\)/.test(er), '');
ok('…and it carries a label, not a bare icon',
   /<span>Report<\/span>/.test(er), '');

// ── the injector must survive being called before the shell exists ────────
ok('every injection is guarded, so a half-built shell returns false and is retried',
   /if \(!sidebar\) return false;/.test(er) && /return true;\s*\n\s*\} catch \(e\) \{ return false; \}/.test(er), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
