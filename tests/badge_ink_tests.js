// ═══════════════════════════════════════════════════════════════
// badge_ink_tests.js — v0.9.1851.
//
// [stated] Brad, 2026-10-01, My Collection screenshot with the LIONEL / PW
// badges, the Workbench count and the Est. Worth column circled: "This yellow
// is hard to see for older people. what color do you suggest…" → three options
// shown → "lets do a" (keep every badge's color, darken the words; prices in a
// deep money green).
//
// Measured on his live app (Alaska skin): white letters on the gold accent
// #f2b428 read at 1.85:1 and the gold prices at 2.2:1 — the standard is 4.5.
//
// THE RULES THIS SUITE PROTECTS:
//   1. ONE rule picks badge letters: rrInkOn(fill) → var(--ink-dark) or
//      var(--ink-light), whichever reads better on that fill (config.js).
//   2. A fill of var(--accent) answers var(--ink-on-accent), which
//      rrSyncInkOnAccent keeps current for whatever skin is on.
//   3. The maker badge, the era badge, the other-era chip, the nav count badges
//      and the Dispatch badge all ask that rule — no white hard-coded on a
//      colored fill in them.
//   4. Prices in the lists use var(--worth) — defined in every scope the rows
//      can sit on, and readable (≥ 4.5) on the content area's rows.
// The REAL helpers and badge builder run; every rule is proven able to fail on
// a planted offender, the v1850 code among them.
// Run:  node tests/badge_ink_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = APP('config.js'), css = APP('app.css'), browse = APP('browse.js'), era = APP('era-badges.js'),
      disp = APP('dispatch-board.js'), coll = APP('app-collection.js'), appear = APP('appearance.js'), onb = APP('onboarding-config.js');

// a CSS variable's value inside one scope of app.css
function cssVarIn(scopeRe, name) {
  const m = css.match(scopeRe);
  if (!m) return null;
  const v = m[0].match(new RegExp(name.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+);'));
  return v ? v[1].trim() : null;
}
const ROOT = /:root\s*\{[\s\S]*?\n\s*\}/, MAIN = /\n\s*\.main\s*\{[\s\S]*?\n\s*\}/,
      LIGHT = /html\[data-theme="light"\]\s*\{[\s\S]*?\n\s*\}/, HC = /html\[data-theme="high-contrast"\]\s*\{[\s\S]*?\n\s*\}/,
      HCMAIN = /html\[data-theme="high-contrast"\]\s+\.main\s*\{[\s\S]*?\n\s*\}/;
const INK_DARK = cssVarIn(ROOT, '--ink-dark'), INK_LIGHT = cssVarIn(ROOT, '--ink-light');

// ── the real helpers, in a small page whose CSS variables we control ───────
function room(vars) {
  const styleProps = {};
  const doc = { readyState: 'complete', addEventListener() {},
    documentElement: { style: { getPropertyValue: n => styleProps[n] || '', setProperty: (n, v) => { styleProps[n] = v; } } } };
  const gcs = () => ({ getPropertyValue: n => (n in styleProps && !/^var\(/.test(styleProps[n]) ? styleProps[n] : (vars[n] || '')) });
  const a = cfg.indexOf('function rrLuminance('), b = cfg.indexOf('// ── v0.9.1791');
  const code = cfg.slice(a, b) + '\nreturn { rrLuminance, rrContrast, rrInkOn, rrSyncInkOnAccent };';
  const w = new Function('window', 'document', 'getComputedStyle', 'MutationObserver', code)({}, doc, gcs, function () { return { observe() {} }; });
  w.styleProps = styleProps;
  return w;
}
const VARS = { '--ink-dark': INK_DARK, '--ink-light': INK_LIGHT, '--accent': '#f2b428' };
const W = room(VARS);

section('A · the measurement, and the two letter colors');
ok('app.css defines --ink-dark and --ink-light in :root', !!INK_DARK && !!INK_LIGHT, INK_DARK + ' / ' + INK_LIGHT);
ok('white on Brad\'s gold (#f2b428) reads 1.85 — the complaint, reproduced', Math.abs(W.rrContrast('#ffffff', '#f2b428') - 1.85) < 0.02);
ok('the dark letter color on that gold reads ≥ 8', W.rrContrast(INK_DARK, '#f2b428') >= 8, W.rrContrast(INK_DARK, '#f2b428').toFixed(2));
ok('rgb() and #abc forms are read too', Math.abs(W.rrContrast('rgb(255, 255, 255)', '#fff') - 1) < 1e-9);

section('B · rrInkOn picks whichever reads better');
ok('gold fill → dark letters', W.rrInkOn('#f2b428') === 'var(--ink-dark)');
ok('Atlas blue #2980b9 → white letters (white reads better there)', W.rrInkOn('#2980b9') === 'var(--ink-light)');
ok('a var(--accent) fill → var(--ink-on-accent)', W.rrInkOn('var(--accent)') === 'var(--ink-on-accent)' && W.rrInkOn('var(--accent, #e04028)') === 'var(--ink-on-accent)');
ok('another var() fill is resolved first', W.rrInkOn('var(--nope, #fdcb6e)') === 'var(--ink-dark)');
ok('a fill it cannot read → white (what the badges always had)', W.rrInkOn('linear-gradient(red, blue)') === 'var(--ink-light)');

section('C · --ink-on-accent follows the skin');
for (const [name, acc, want] of [['Alaska gold', '#f2b428', 'var(--ink-dark)'], ['a deep navy accent', '#1f3a6e', 'var(--ink-light)']]) {
  const R = room(Object.assign({}, VARS, { '--accent': acc }));
  R.rrSyncInkOnAccent();
  ok(name + ' → ' + want, R.styleProps['--ink-on-accent'] === want, R.styleProps['--ink-on-accent']);
}
ok('the sync watches <html> style + data-theme (the one door a skin or theme change passes)',
   /new MutationObserver\(rrSyncInkOnAccent\)\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['style', 'data-theme'/.test(cfg));

section('D · every built-in skin and every badge color gets the better letters');
const skins = {};
appear.replace(/'([^']+)':\s*\{[^}]*'--accent':'(#[0-9a-f]{6})'/gi, (m, n, a) => { skins[n] = a; return m; });
ok('read the four built-in skins', Object.keys(skins).length >= 4, Object.keys(skins).join(', '));
Object.keys(skins).forEach(n => {
  const a = skins[n], pick = W.rrInkOn(a) === 'var(--ink-dark)' ? INK_DARK : INK_LIGHT;
  ok('skin ' + n + ' (' + a + '): letters read ≥ white did', W.rrContrast(pick, a) >= W.rrContrast('#ffffff', a) - 1e-9, W.rrContrast(pick, a).toFixed(2));
});
['Alaska', 'Santa Fe', 'Pennsy Tuscan'].forEach(n => {
  const a = skins[n]; if (!a) return;
  const pick = W.rrInkOn(a) === 'var(--ink-dark)' ? INK_DARK : INK_LIGHT;
  ok('gold skin ' + n + ' now reads ≥ 4.5', W.rrContrast(pick, a) >= 4.5, W.rrContrast(pick, a).toFixed(2));
});
const badgeColors = [];
onb.replace(/:\s*'(#[0-9a-f]{6})'/gi, (m, c) => { badgeColors.push(c); return m; });
ok('read the maker / era badge colors', badgeColors.length > 20, String(badgeColors.length));
const worse = badgeColors.filter(c => {
  const pick = W.rrInkOn(c) === 'var(--ink-dark)' ? INK_DARK : INK_LIGHT;
  return W.rrContrast(pick, c) < W.rrContrast('#ffffff', c) - 1e-9;
});
ok('no badge color reads worse than with white', worse.length === 0, worse.join(' '));

section('E · the badge builders ask the rule');
const mfr = grab(browse, '_mfrBadge');
ok('maker badge letters come from rrInkOn(fill)', /color:' \+ rrInkOn\(col\)/.test(mfr) && !/;color:#fff;/.test(mfr));
{
  // run the REAL _mfrBadge: Lionel (var(--accent)) and MTH (#e74c3c)
  const run = (m) => new Function('window', '_manufacturerOfItem', 'rrInkOn', grab(browse, '_mfrBadge') + '\nreturn _mfrBadge({});')(
    { WHAT_I_COLLECT: { MANUFACTURERS: { lionel: { label: 'Lionel', color: 'var(--accent)' }, mth: { label: 'MTH', color: '#e74c3c' } } } }, () => m, W.rrInkOn);
  ok('Lionel badge → var(--ink-on-accent)', /color:var\(--ink-on-accent\)/.test(run('lionel')), run('lionel'));
  ok('MTH badge → the better of the two inks', /color:var\(--ink-(dark|light)\)/.test(run('mth')));
}
const eraFn = grab(era, 'eraBadgeHTML');
ok('era badge letters come from rrInkOn(accent)', /color:' \+ _escape\(rrInkOn\(accent\)\)/.test(eraFn) && !/;color:#fff;/.test(eraFn));
ok('the other-era chip asks rrInkOn', /color:' \+ rrInkOn\(accent\) \+ ';background:' \+ accent/.test(browse));
ok('.nav-badge letters = var(--ink-on-accent)', /\.nav-badge \{[^}]*color: var\(--ink-on-accent\)/.test(css));
ok('the Dispatch badge = var(--ink-on-accent)', /id="nav-dispatch-badge" style="display:none;background:var\(--accent\);color:var\(--ink-on-accent\)"/.test(disp));

section('F · prices');
ok('the collection list\'s Est. Worth cells use var(--worth)', (browse.match(/data-col="worth" style="[^"]*color:var\(--worth\)/g) || []).length === 2
   && !/data-col="worth" style="[^"]*color:var\(--gold\)/.test(browse));
ok('the report table\'s worth uses var(--worth)', /_hasWorth \? '<td style="[^"]*color:var\(--worth\)/.test(coll));
const W_MAIN = cssVarIn(MAIN, '--worth'), SURF = cssVarIn(MAIN, '--surface');
ok('--worth is defined for the content area, light theme, high contrast and :root',
   !!W_MAIN && !!cssVarIn(LIGHT, '--worth') && !!cssVarIn(HCMAIN, '--worth') && !!cssVarIn(HC, '--worth') && !!cssVarIn(ROOT, '--worth'));
ok('a price reads ≥ 4.5 on the content area\'s rows (was 2.2 in gold)', W.rrContrast(W_MAIN, SURF) >= 4.5, W.rrContrast(W_MAIN, SURF).toFixed(2));
ok('high contrast: price on black ≥ 7', W.rrContrast(cssVarIn(HCMAIN, '--worth'), '#000000') >= 7);

section('G · planted offenders are caught');
const v1850mfr = mfr.replace("color:' + rrInkOn(col) + ';'", "color:#fff;'");
ok('G1 v1850\'s maker badge (white on any fill) is caught', v1850mfr !== mfr && !/color:' \+ rrInkOn\(col\)/.test(v1850mfr));
{
  const R = room(VARS);
  const always = new Function('return function () { return "var(--ink-light)"; }')();
  const pick = always('#f2b428') === 'var(--ink-dark)' ? INK_DARK : INK_LIGHT;
  ok('G2 a rule that always answers white fails the Alaska ≥ 4.5 check', R.rrContrast(pick, '#f2b428') < 4.5);
}
const goldWorth = browse.replace('color:var(--worth);white-space:nowrap;text-align:center">${_estWorth}', 'color:var(--gold);white-space:nowrap;text-align:center">${_estWorth}');
ok('G3 a worth cell back in gold is caught', goldWorth !== browse && /data-col="worth" style="[^"]*color:var\(--gold\)/.test(goldWorth));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
