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
// v0.9.1896: the old "FUTURE SLOT" comment is now our service-manual scans
// (service_manual_links_tests.js) — the start marker is that comment.
const START_RX = /if \(route === 'lcca'\) \{\n\s*\/\/ v0\.9\.1896: Brad's scans of Lionel's own service manual/;
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
    '_esc', 'rrJsArg', '_docsUrl', '_btnQuiet', 'eraKey', '_smSlotHtml', 'where',
    'var h = "", noteId = "maint-lcca-note", tzHtml = "";\n' + block + '\nreturn h;');   // 2026-11-01: the block now places the Trainz buttons (tzHtml) after our scans — none here
  return fn(win, 'lcca', { itemNum: '2343' },
    pwsmHit ? 'Service Manual pages for 2343 (LCCA members)' : 'LCCA Postwar Service Manual archive (members)',
    pwsmHit ? 'loco_2343' : null, 'class="b"',
    s => String(s), s => String(s),
    () => 'https://www.lionelcollectors.org/docs/default-source/x/loco_2343.pdf?sfvrsn=1',
    () => 'class="q"', 'pw', () => '', '');   // our scans stubbed empty — this suite judges the LCCA row
}
function judge(html) {
  return {
    lccaBtn: /_maintLccaGo\(/.test(html),
    lccaNote: /id="maint-lcca-note"/.test(html),
    lccaWords: /LCCA/i.test(html),
    olsen: /olsenstoy|Olsen's service library/i.test(html),
  };
}

// ── 2026-11-07 ([stated] Brad: "Remove the LCCA 'Service Manual pages' button
// completely (my decision 2026-11-07)"). The phone rule above (v1846) is
// superseded: the button is gone on EVERY device. Rule 1 holds for the desktop
// now too; rule 2 is retired; rule 3 (no Olsen's) stays. The planted offender
// is the v0.9.2117 block itself, read from git.
// ── A · the real block ─────────────────────────────────────────────────────
section('A · the real block from maintenance.js — no LCCA button anywhere');
const real = liftBlock(maint);
ok('block lifted', real.length > 200, 'length ' + real.length);

[true, false].forEach(function (hit) {
  const tag = hit ? ' (item with a mapped manual)' : ' (no mapped manual)';
  [['phone', true], ['desktop', false]].forEach(function ([dev, isPhone]) {
    const html = runBlock(real, isPhone, hit), j = judge(html);
    ok(dev + ': no LCCA button' + tag, !j.lccaBtn);
    ok(dev + ': no LCCA note box' + tag, !j.lccaNote);
    ok(dev + ': the word LCCA appears nowhere' + tag, !j.lccaWords);
    ok(dev + ': no Olsen\'s button (v1850)' + tag, !j.olsen);
  });
});

// ── B · nothing device-specific is left in the block ───────────────────────
section('B · the block no longer branches on the device');
ok('no IS_MOBILE_UA branch left in the LCCA route (it drew only the LCCA button)', !/IS_MOBILE_UA/.test(real.replace(/\/\/[^\n]*/g, '')));
ok('config.js still defines window.IS_MOBILE_UA (other screens use it)',
   /window\.IS_MOBILE_UA\s*=/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8')));

// ── C · offenders: each rule must be able to fail ──────────────────────────
section('C · planted offenders are caught');
let old = '';
try { old = require('child_process').execSync('git show fb3beb1c:app/maintenance.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
const oldBlock = old ? liftBlock(old) : '';
ok('C1 the v0.9.2117 block (LCCA button on the desktop) is caught', !!oldBlock && judge(runBlock(oldBlock, false, true)).lccaBtn && judge(runBlock(oldBlock, false, true)).lccaWords,
   old ? 'offender did not reproduce the old behaviour' : 'git history needed (full clone)');
const o2src = real.slice(0, -1) + "h += '<div><button onclick=\"window.open(\\'https://www.olsenstoy.com/searchcd1.htm\\',\\'_blank\\')\">Olsen\\'s service library (free, no login) →</button></div>';\n}";
ok('C2 the Olsen\'s button put back is caught on phone AND desktop', o2src !== real && judge(runBlock(o2src, true, true)).olsen && judge(runBlock(o2src, false, true)).olsen);
const o3src = real.slice(0, -1) + "h += '<button onclick=\"_maintLccaGo(1)\">LCCA</button>';\n}";
ok('C3 an LCCA button planted back is caught', judge(runBlock(o3src, false, true)).lccaBtn);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
