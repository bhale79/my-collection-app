// ═══════════════════════════════════════════════════════════════
// wizard_preview_tests.js — Session 84. The wizard PREVIEW catches up
// with what the SAVE has done right since v0.9.1562.
//
// Brad's three S83 complaints, measured this session:
//   1. "photo lands in the TOP slot, not Right Side" — slots render
//      top-first, and an UNSTAMPED photo was dealt to whichever empty
//      slot drew first. The save files each unit's own shot as its
//      Right Side View; the preview now reserves the first unstamped
//      photo for the empty RSV slot.
//   2. Per-unit steps previewed wrong — the preview's role router only
//      spoke p/b/d/together, but the inbox ALSO stamps the set
//      vocabulary (aunit_p / bunit / aunit_d / pair_*). The v1562 save
//      translates both; the preview treated them as unroled and dealt
//      them all into the first unit's step.
//   3. "Add photos of the 2378" — the title now names the UNIT.
//
// Run:  node tests/wizard_preview_tests.js
// Proven to FAIL on v0.9.1571 (commit f482ae9) before the fix.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const wiz = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
const steps = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-steps.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── 1. the role router speaks BOTH vocabularies (like the save) ─
const routerAt = wiz.indexOf('function _stepForRole');
const router = routerAt < 0 ? '' : wiz.slice(routerAt, routerAt + 1500);
ok('the preview role router exists', routerAt > 0);
ok("aunit_p routes to the powered unit's step (save has since v1562)",
   /case 'aunit_p'[\s\S]{0,120}photosItem/.test(router) || /'aunit_p'[^\n]*photosItem/.test(router));
ok("bunit routes to unit 2's step", /'bunit'[\s\S]{0,120}photosUnit2Item/.test(router));
ok("aunit_d routes to the dummy's step (unit 3 on an ABA)",
   /'aunit_d'[\s\S]{0,160}photosUnit3Item/.test(router));
ok('pair_* shots route to the together step',
   /pair_/.test(router) && /photosTogether/.test(router));
ok('the short vocabulary still works (p / b / d / together untouched)',
   /case 'p':/.test(router) && /case 'b':/.test(router) && /case 'd':/.test(router)
   && /case 'together':/.test(router));

// ── 2. the unstamped photo goes to Right Side, not Top ─────────
ok('an RSV reservation pre-pass exists before the slots are dealt',
   /reserv/i.test(wiz) && /_inboxSeen\[s\.id \+ '\|RSV'\]/.test(wiz));
ok('...only when the step actually draws an RSV slot',
   /views\.some\(function \(v\) \{ return v\.key === 'RSV'; \}\)/.test(wiz));
ok('...and only for UNSTAMPED photos — a view stamp still claims its own slot',
   (function () {
     var at = wiz.indexOf("_inboxSeen[s.id + '|RSV']");
     if (at < 0) return false;
     var back = wiz.slice(Math.max(0, at - 1200), at + 600);
     return /_inboxViews\[/.test(back) && /continue/.test(back);
   })());
ok('...respecting roles (never steals another unit\'s photo)',
   (function () {
     var at = wiz.indexOf("_inboxSeen[s.id + '|RSV']");
     if (at < 0) return false;
     var back = wiz.slice(Math.max(0, at - 1200), at + 600);
     return /_roleFitsStep/.test(back);
   })());

// ── 3. the step titles name the unit ───────────────────────────
ok('the lead photo step names the powered unit on a diesel group',
   /photosItem'[\s\S]{0,220}powered A unit/.test(steps));
ok("unit 2's title carries its role beside the number",
   /photosUnit2Item'[\s\S]{0,220}unit2ItemNum \+ ' — ' \+ _unit2Role\(d\)/.test(steps));
ok('on an AA the second unit is called the dummy A unit, not a B unit',
   /_itemGrouping === 'aa'[\s\S]{0,120}dummy A unit/.test(steps) ||
   /'aa'\s*\?\s*'dummy A unit'/.test(steps));
ok("unit 3's title says dummy A unit",
   /photosUnit3Item'[\s\S]{0,260}dummy A unit/.test(steps));

console.log('');
if (fail) { console.log(fail + ' FAILED, ' + pass + ' passed'); process.exit(1); }
console.log('ALL WIZARD-PREVIEW TESTS GREEN (' + pass + ')');
