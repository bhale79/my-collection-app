// ═══════════════════════════════════════════════════════════════
// maint_lcca_phone_tests.js — v0.9.1846.
//
// Brad, 2026-10-01, Maintenance page on the phone: "when trying to go to the
// lcca parts diagrams, it opens the website but does not take you to the
// diagram. it does on the desktop." → asked: no address bar on the phone →
// "just remove the lcca button from the mobile app all together but keep it
// on the desktop".
//
// WHY: the LCCA route copies the diagram's link and opens lionelcollectors.org;
// the member then PASTES the link in the address bar (LCCA's member cookie only
// rides on a typed/pasted address — v1641). An installed app on a phone opens
// links in Chrome's small in-app window, which has no address bar, and Chrome
// will not hand an installed app's link to full Chrome (ExternalNavigationHandler
// treats an intent to itself as "navigate in place"). Nowhere to paste = a
// button that cannot work. So on a phone it is not drawn.
//
// THE RULES THIS SUITE PROTECTS:
//   1. Phone (window.IS_MOBILE_UA): no LCCA button, no LCCA note, no LCCA words.
//   2. Desktop: the LCCA button, its note box and its help line, unchanged.
//   3. v0.9.1850 ([stated] Brad: "the olsenstoy.com button, we just need to remove
//      it as it never works" → "both mobile and desktop"): no Olsen's link on EITHER.
//   4. Phone-ness is asked of window.IS_MOBILE_UA — the ONE flag (config.js) —
//      never a private user-agent test or a screen-width guess.
// Every rule is run on the REAL block lifted from maintenance.js, and each is
// proven able to fail on a planted offender (the v1845 code among them).
// Run:  node tests/maint_lcca_phone_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const maint = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');

// The manufacturer row for the LCCA route, lifted as text. Since v0.9.1857 it
// lives in _maintDiagramLinksHtml (ONE builder for the panel AND the Need-a-
// part popup), so the indentation is not pinned — the two markers are.
const START_RX = /if \(route === 'lcca'\) \{\n\s*\/\/ FUTURE SLOT/;
const END = "} else if (route === 'atlas' && _atlasHit) {";
function liftBlock(src) {
  const i = src.search(START_RX);
  if (i < 0) return '';
  const j = src.indexOf(END, i);
  if (j < 0) return '';
  return src.slice(i, j) + '}';
}
// Run a lifted block as the panel would, on a phone or a desktop.
function runBlock(block, isPhone, pwsmHit) {
  const win = { IS_MOBILE_UA: !!isPhone };
  const fn = new Function('window', 'route', 'item', 'routeLabel', '_pwsmHit', 'linkBtn',
    '_esc', 'rrJsArg', '_docsUrl', '_btnQuiet',
    'var h = "", noteId = "maint-lcca-note";\n' + block + '\nreturn h;');
  return fn(win, 'lcca', { itemNum: '2343' },
    pwsmHit ? 'Service Manual pages for 2343 (LCCA members)' : 'LCCA Postwar Service Manual archive (members)',
    pwsmHit ? 'loco_2343' : null, 'class="b"',
    s => String(s), s => String(s),
    () => 'https://www.lionelcollectors.org/docs/default-source/x/loco_2343.pdf?sfvrsn=1',
    () => 'class="q"');
}
function judge(html) {
  return {
    lccaBtn: /_maintLccaGo\(/.test(html),
    lccaNote: /id="maint-lcca-note"/.test(html),
    lccaWords: /LCCA/i.test(html),
    olsen: /olsenstoy|Olsen's service library/i.test(html),
  };
}

// ── A · the real block ─────────────────────────────────────────────────────
section('A · the real block from maintenance.js');
const real = liftBlock(maint);
ok('block lifted', real.length > 200, 'length ' + real.length);

[true, false].forEach(function (hit) {
  const tag = hit ? ' (item with a mapped manual)' : ' (no mapped manual)';
  const phone = judge(runBlock(real, true, hit));
  ok('phone: no LCCA button' + tag, !phone.lccaBtn);
  ok('phone: no LCCA note box' + tag, !phone.lccaNote);
  ok('phone: the word LCCA appears nowhere' + tag, !phone.lccaWords);
  ok('phone: no Olsen\'s button (v1850)' + tag, !phone.olsen);

  const desk = judge(runBlock(real, false, hit));
  ok('desktop: LCCA button kept' + tag, desk.lccaBtn);
  ok('desktop: LCCA note box kept' + tag, desk.lccaNote);
  ok('desktop: "Requires LCCA membership" kept' + tag, /Requires LCCA membership/.test(runBlock(real, false, hit)));
  ok('desktop: no Olsen\'s button (v1850)' + tag, !desk.olsen);
});

// ── B · phone-ness comes from the ONE flag ─────────────────────────────────
section('B · the block asks window.IS_MOBILE_UA, nothing else');
function usesOneFlag(block) {
  return /window\.IS_MOBILE_UA/.test(block)
    && !/navigator\.userAgent|innerWidth|maxTouchPoints|matchMedia|ontouchstart/.test(block);
}
ok('the real block uses window.IS_MOBILE_UA only', usesOneFlag(real));
ok('config.js still defines window.IS_MOBILE_UA',
   /window\.IS_MOBILE_UA\s*=/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8')));

// ── C · offenders: each rule must be able to fail ──────────────────────────
section('C · planted offenders are caught');
// C1 — the v1845 block: the button drawn on every device.
const v1845 = real
  .replace(/if \(!window\.IS_MOBILE_UA\) \{\n/, '{\n');
ok('(the guard is in the block, so the offender below differs from it)', v1845 !== real);
const o1 = judge(runBlock(v1845, true, true));
ok('C1 v1845 (button on every device) is caught on the phone', o1.lccaBtn && o1.lccaNote,
   'offender did not reproduce the old behaviour');
// C2 — the Olsen's button put back (v1849's line): caught on both devices
const o2src = real.slice(0, -1) + "h += '<div><button onclick=\"window.open(\\'https://www.olsenstoy.com/searchcd1.htm\\',\\'_blank\\')\">Olsen\\'s service library (free, no login) →</button></div>';\n}";
ok('C2 the Olsen\'s button put back is caught on phone AND desktop', o2src !== real && judge(runBlock(o2src, true, true)).olsen && judge(runBlock(o2src, false, true)).olsen);
// C3 — the guard inverted: the desktop loses the button.
const o3src = real.replace('if (!window.IS_MOBILE_UA) {', 'if (window.IS_MOBILE_UA) {');
ok('C3 inverted guard is caught on the desktop', o3src !== real && !judge(runBlock(o3src, false, true)).lccaBtn);
// C4 — a private screen-width guess instead of the one flag.
const o4src = real.replace('if (!window.IS_MOBILE_UA) {', 'if (!(window.innerWidth <= 640)) {');
ok('C4 a width guess instead of the flag is caught', o4src !== real && !usesOneFlag(o4src));
// C5 — a private user-agent test instead of the one flag.
const o5src = real.replace('if (!window.IS_MOBILE_UA) {', 'if (!/Android/i.test(navigator.userAgent)) {');
ok('C5 a private UA test instead of the flag is caught', o5src !== real && !usesOneFlag(o5src));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
