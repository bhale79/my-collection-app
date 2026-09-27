// ═══════════════════════════════════════════════════════════════
// signin_chrome_tests.js — v0.9.1811.
//
// Brad (release walk-through, 2026-09-27): on a phone the bottom menu bar
// showed on the invite-code and sign-in screens — covering the sign-in box,
// buttons that did nothing — and the "Install on this device?" card popped
// up over the sign-in screen and covered the Enter button.
//
// ONE signal says "the app is showing": #app.active (added by sign-in,
// removed by sign-out). The rule this suite pins: nothing that belongs to
// the signed-in app — the phone nav bar, the install offer, the iPhone
// home-screen hint — may appear until that class is on.
//
//   A · app.css: no rule shows .mobile-nav unless its selector is gated on
//       #app.active. (The bar lives OUTSIDE #app, so #app's own display:none
//       never hid it.)
//   B · index.html: the nav is the sibling right AFTER #app — the `~`
//       combinator in A is silent otherwise.
//   C · app-misc.js: each late-appearing card checks #app.active before it
//       is added to the page, and retries rather than giving up.
//   D · planted offenders — each puts the old habit back and the matching
//       check must go red.
// Run:  node tests/signin_chrome_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const CSS = APP('app.css'), HTML = APP('index.html'), MISC = APP('app-misc.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
// code only — a comment that quotes the old rule is history, not behaviour
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// ── A: every CSS rule that SHOWS .mobile-nav is gated ──────────────────
// Walk "selector { body }" pairs (media blocks are just an outer brace we
// skip). A rule counts when its selector names `.mobile-nav` itself (not
// `.mobile-nav-items` etc.) and its body sets display to anything but none.
function navShowRules(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');   // CSS only — no regex literals here
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(noComments))) {
    const sel = m[1].trim(), body = m[2];
    if (!/(^|[\s,>~+])\.mobile-nav(?![\w-])/.test(sel)) continue;
    const d = body.match(/display\s*:\s*([^;!]+)/);
    if (!d || /^none$/i.test(d[1].trim())) continue;
    out.push(sel);
  }
  return out;
}
function cssGated(css) {
  const rules = navShowRules(css);
  return { rules, ok: rules.length > 0 && rules.every(s => /#app\.active\s*~\s*\.mobile-nav/.test(s)) };
}

// ── B: the nav is the next element sibling after #app ───────────────────
function navFollowsApp(html) {
  const i = html.indexOf('<div id="app">');
  if (i < 0) return false;
  const re = /<div\b[^>]*>|<\/div>/g; re.lastIndex = i;
  let depth = 0, end = -1, m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = m.index + m[0].length; break; }
  }
  if (end < 0) return false;
  // between #app's close and the nav: whitespace and comments only, and the
  // nav must NOT sit inside #app (it would then be before `end`)
  const navAt = html.indexOf('<nav class="mobile-nav"');
  if (navAt < end) return false;
  return /^[\s]*(<!--[\s\S]*?-->[\s]*)*$/.test(html.slice(end, navAt));
}

// ── C: the late cards wait for #app.active ──────────────────────────────
function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1);
  }
  return '';
}
function cardWaits(src, name) {
  const b = code(fnBody(src, name));
  const gate = b.search(/getElementById\('app'\)[\s\S]{0,120}classList\.contains\('active'\)/);
  const add = b.search(/document\.body\.appendChild\(/);
  const retry = new RegExp('setTimeout\\(' + name + ',').test(b);
  return { found: !!b, gate: gate >= 0, before: gate >= 0 && add > gate, retry };
}

section('A · app.css shows .mobile-nav only under #app.active');
const A = cssGated(CSS);
ok('A1  at least one rule shows the phone nav', A.rules.length > 0, JSON.stringify(A.rules));
ok('A2  every such rule is gated on #app.active ~ .mobile-nav', A.ok, JSON.stringify(A.rules));

section('B · index.html — the nav is the sibling right after #app');
ok('B1  <nav class="mobile-nav"> follows </div> of #app (so ~ works)', navFollowsApp(HTML));

section('C · app-misc.js — late cards wait for #app.active, and keep waiting');
for (const fn of ['_pwaOfferInit', '_showIOSInstallHint']) {
  const c = cardWaits(MISC, fn);
  ok('C  ' + fn + ' exists', c.found);
  ok('C  ' + fn + ' checks #app .active', c.gate);
  ok('C  ' + fn + ' checks it BEFORE adding the card', c.before);
  ok('C  ' + fn + ' retries instead of giving up', c.retry);
}

section('D · planted offenders — each must turn a check red');
// D1: the old bare rule back in the phone media block
const o1 = CSS.replace('#app.active ~ .mobile-nav { display: block; }', '.mobile-nav { display: block; }');
ok('offender 1 changed the source', o1 !== CSS);
ok('OFFENDER 1: bare `.mobile-nav { display:block }` -> A2 red', !cssGated(o1).ok);
// D1b: a second, ungated rule added elsewhere (the gate survives, a new leak appears)
const o1b = CSS + '\n.mobile-nav { display: flex; }\n';
ok('OFFENDER 1b: an extra ungated flex rule anywhere -> A2 red', !cssGated(o1b).ok);
// D1c: a COMMENT quoting the old rule must NOT trip A2 (comments are history)
const o1c = CSS + '\n/* .mobile-nav { display: block; } */\n';
ok('OFFENDER 1c (negative): the old rule inside a comment stays green', cssGated(o1c).ok);
// D2: the nav moved INSIDE #app — `~` would then never match
const o2 = HTML.replace('<nav class="mobile-nav">', '<div></div>\n  <nav class="mobile-nav">');
ok('offender 2 changed the source', o2 !== HTML);
ok('OFFENDER 2: an element between #app and the nav -> B1 red', !navFollowsApp(o2));
// D3: the old #main-content wait back in _pwaOfferInit (code, not comment)
const o3 = MISC.replace(
  "    var appEl = document.getElementById('app');\n    if (!appEl || !appEl.classList.contains('active')) { setTimeout(_pwaOfferInit, 4000); return; }\n",
  "    if (!document.getElementById('main-content')) { setTimeout(_pwaOfferInit, 4000); return; }\n");
ok('offender 3 changed the source', o3 !== MISC);
ok('OFFENDER 3: _pwaOfferInit waiting for #main-content again -> C red', !cardWaits(o3, '_pwaOfferInit').gate);
// D4: the gate present but AFTER the card is added (too late to matter)
const body4 = fnBody(MISC, '_pwaOfferInit');
const gateLine = "    var appEl = document.getElementById('app');\n    if (!appEl || !appEl.classList.contains('active')) { setTimeout(_pwaOfferInit, 4000); return; }\n";
const o4body = body4.replace(gateLine, '').replace('    document.body.appendChild(b);\n', '    document.body.appendChild(b);\n' + gateLine);
const o4 = MISC.replace(body4, o4body);
ok('offender 4 changed the source', o4 !== MISC && o4body !== body4);
ok('OFFENDER 4: the check moved below appendChild -> "before" red', !cardWaits(o4, '_pwaOfferInit').before);
// D5: the iPhone hint gives up instead of retrying
const o5 = MISC.replace("{ setTimeout(_showIOSInstallHint, 4000); return; }", "{ return; }");
ok('offender 5 changed the source', o5 !== MISC);
ok('OFFENDER 5: _showIOSInstallHint returns without a retry -> C red', !cardWaits(o5, '_showIOSInstallHint').retry);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
