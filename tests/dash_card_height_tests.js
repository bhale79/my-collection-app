// ═══════════════════════════════════════════════════════════════
// dash_card_height_tests.js — v0.9.1808.
//
// Brad: "shouldn't have to scroll down to see the bottom here. so recent
// additions card needs to be trimmed down a bit, and the photo inbox should be
// the same size. All large cards should be the same size."
// On a computer the large dashboard cards share ONE height (--dash-panel-h,
// what is left of the window, never below --dash-panel-min-h); whatever would
// be cut off is hidden whole. Phones keep natural height.
// Section D plants the old habits back; each must turn a check red.
// Run:  node tests/dash_card_height_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const CSS = APP('app.css'), DASH = APP('dashboard.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const block = css => { const i = css.indexOf('/* ── v0.9.1808'); return i < 0 ? '' : css.slice(i); };
const fitFn = js => { const i = js.indexOf('// ── v0.9.1808 (Brad'); return i < 0 ? '' : js.slice(i); };

function checks(css, js) {
  const b = block(css), f = fitFn(js);
  return {
    oneHeight: /@media \(min-width: 701px\)[\s\S]*#dash-panels-host \.panel \{[^}]*height: var\(--dash-panel-h, auto\)/.test(b),
    borderBox: /#dash-panels-host \.panel \{[^}]*box-sizing: border-box/.test(b),
    stretch:   /#dash-panels-host \{ align-items: stretch !important; \}/.test(b),
    noScroll:  /#dash-panels-host \.panel \{[^}]*overflow: hidden/.test(b) && /\[id\^="dash-panel-body-"\] \{[^}]*overflow: hidden/.test(b),
    hideWhole: /\.rr-dash-overflow \{ display: none !important; \}/.test(b),
    minH:      /--dash-panel-min-h:\s*\d+px/.test(b),
    measures:  /window\.innerHeight - top/.test(f) && /setProperty\('--dash-panel-h'/.test(f),
    phones:    /window\.innerWidth <= 700/.test(f),
    hidesCut:  /r\.bottom > limit|getBoundingClientRect\(\)\.bottom > limit/.test(f) && /classList\.add\(HIDE\)/.test(f),
    gridSafe:  /a child that IS or HOLDS a photo grid is never hidden itself/.test(f),
    refits:    /new MutationObserver/.test(f) && /new ResizeObserver/.test(f) && /addEventListener\('resize', soon\)/.test(f),
    called:    /window\._dashFitPanels\(\); \} catch \(eF\) \{\}   \/\/ v0\.9\.1808/.test(js),
  };
}

section('A · app.css — one height for every large card');
let R = checks(CSS, DASH);
ok('on a computer every large card is height var(--dash-panel-h)', R.oneHeight);
ok('the height includes the padding (border-box) so the card ends where measured', R.borderBox);
ok('the row stretches the cards to one height', R.stretch);
ok('a card never grows a scroll bar or spills — overflow hidden', R.noScroll);
ok('what does not fit is hidden whole', R.hideWhole);
ok('a floor height exists for short windows', R.minH);

section('B · dashboard.js — measure and trim');
ok('the height is what is left of the window below the cards', R.measures);
ok('phones keep natural height', R.phones);
ok('a row/tile that would be cut off is hidden', R.hidesCut);
ok('a photo GRID is never hidden as a whole — only its tiles', R.gridSafe);
ok('re-fits when a card fills in, when the strip above grows, on resize', R.refits);
ok('called after the cards are drawn', R.called);

section('D · planted offenders — each must turn a check red');
const o1 = CSS.replace('height: var(--dash-panel-h, auto);', 'max-height: none;');
ok('offender 1 changed the source', o1 !== CSS);
ok('OFFENDER 1: cards back to natural height -> oneHeight red', !checks(o1, DASH).oneHeight);
const o2 = DASH.replace("if (window.innerWidth <= 700 || !host.offsetParent)", "if (!host.offsetParent)");
ok('offender 2 changed the source', o2 !== DASH);
ok('OFFENDER 2: phones forced to the fixed height -> phones red', !checks(CSS, o2).phones);
const o3 = CSS.replace('#dash-panels-host .panel { box-sizing: border-box; height', '#dash-panels-host .panel { height');
ok('offender 3 changed the source', o3 !== CSS);
ok('OFFENDER 3: padding outside the height (cards run 40 px past the window) -> borderBox red', !checks(o3, DASH).borderBox);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
