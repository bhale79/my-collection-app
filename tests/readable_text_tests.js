// ═══════════════════════════════════════════════════════════════
// readable_text_tests.js — v0.9.1852, v0.9.1853 (B2: colours chosen by code).
//
// [stated] Brad, 2026-10-01: "are there other readability issues in the app?"
// → every screen measured live in his Chrome → a side-by-side preview of five
// fixes → "yes" → "yes" (all five):
//   1. grey small print            (--text-dim #8a7e68 read 3.2–3.9)
//   2. blue links + the highlighted menu item (#2980b9 3.0–4.2)
//   3. orange / purple words       (Remove, For Sale, AA SET, upgrades 2.8–4.2)
//   4. pale gold words on cream    (--accent2 / --accent read 1.2–1.8)
//   5. MTH's red badge one shade deeper, white letters (#c0392b)
//
// THE RULES THIS SUITE PROTECTS:
//   A. WORD colours live in ONE place: the --t-* variables in app.css. :root
//      keeps the bright shade (the navy chrome and pop-ups), .main and the
//      light theme carry the deep shade (the cream), high contrast its own.
//      Every deep shade reads ≥ 5 on the page cream and ≥ 4.5 on the darkest.
//   B. No word in the app is written with the old bright literal or with
//      var(--accent) — they say var(--t-*) (print windows and the Appearance
//      preview replica are the only, named, exceptions).
//   C. The two button levers in app.css still catch every button the
//      replacement touched (their selectors list the var forms).
//   D. The skin's own colours (gold, purple, orange…) are darkened at run time
//      for the cream by rrSyncReadableText — same hue, ≥ 5 — and NOT on the
//      high-contrast black.
//   E. MTH's badge is #c0392b and its letters read ≥ 5.
// The REAL config.js helpers run; every rule is proven able to fail.
// Run:  node tests/readable_text_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const cfg = APP('config.js'), css = APP('app.css'), onb = APP('onboarding-config.js'), appear = APP('appearance.js');

// ── the real contrast helpers ─────────────────────────────────────────────
function room(rootVars, hostVars, theme) {
  const styleEl = { id: '', textContent: '' };
  const head = { appendChild(e) { styleEl.id = e.id; } };
  let made = false;
  const host = { _vars: hostVars };
  const doc = {
    readyState: 'complete', addEventListener() {}, head,
    body: host,
    documentElement: { _vars: rootVars, getAttribute: n => (n === 'data-theme' ? theme || null : null),
      style: { getPropertyValue: () => '', setProperty() {} } },
    querySelector: s => (s === '.main' ? host : null),
    getElementById: id => (made && id === 'rr-readable-text' ? styleEl : null),
    createElement: () => { made = true; return styleEl; },
  };
  const gcs = el => ({ getPropertyValue: n => ((el && el._vars) || {})[n] || '' });
  const a = cfg.indexOf('function rrLuminance('), b = cfg.indexOf('// ── v0.9.1791');
  const code = cfg.slice(a, b) + '\nreturn { rrLuminance, rrContrast, rrDarkenFor, rrSyncReadableText };';
  const w = new Function('window', 'document', 'getComputedStyle', 'MutationObserver', code)({}, doc, gcs, function () { return { observe() {} }; });
  w.styleEl = styleEl;
  return w;
}
const W = room({}, {});
const C = (a, b) => W.rrContrast(a, b);

// a CSS variable's value inside one scope of app.css
function block(src, re) { const m = src.match(re); return m ? m[0] : ''; }
function varIn(blk, name) {
  const v = blk.match(new RegExp('(?:^|[\\s;{])' + name.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+);'));
  return v ? v[1].trim() : null;
}
const ROOT = /:root\s*\{[\s\S]*?\n\s*\}/, MAIN = /\n\s*\.main\s*\{[\s\S]*?\n\s*\}/,
      LIGHT = /html\[data-theme="light"\]\s*\{[\s\S]*?\n\s*\}/,
      HC = /html\[data-theme="high-contrast"\]\s*\{[\s\S]*?\n\s*\}/,
      HCMAIN = /html\[data-theme="high-contrast"\]\s+\.main\s*\{[\s\S]*?\n\s*\}/;

const BRIGHT = { '--t-link': '#2980b9', '--t-info': '#3498db', '--t-red': '#f05008', '--t-danger': '#e74c3c',
  '--t-gold': '#d4a843', '--t-green': '#2ecc71', '--t-orange': '#e67e22', '--t-purple': '#8b5cf6',
  '--t-sea': '#16a085', '--t-teal': '#0891b2' };
const WORDS = Object.keys(BRIGHT);

// ── A · the palette ───────────────────────────────────────────────────────
function checkPalette(cssSrc, label) {
  const out = [];
  const root = block(cssSrc, ROOT), main = block(cssSrc, MAIN), light = block(cssSrc, LIGHT), hc = block(cssSrc, HC), hcm = block(cssSrc, HCMAIN);
  WORDS.forEach(n => {
    if (String(varIn(root, n) || '').toLowerCase() !== BRIGHT[n]) out.push(':root ' + n + ' is not the original ' + BRIGHT[n]);
    [['.main', main], ['light', light]].forEach(([sc, blk]) => {
      const v = varIn(blk, n), bg = varIn(blk, '--bg') || '#f8e8c0', dk = varIn(blk, '--surface3') || '#ede2cc';
      if (!v) { out.push(sc + ' has no ' + n); return; }
      if (!(C(v, bg) >= 5)) out.push(sc + ' ' + n + ' ' + v + ' reads ' + (C(v, bg) || 0).toFixed(2) + ' on ' + bg);
      if (!(C(v, dk) >= 4.5)) out.push(sc + ' ' + n + ' ' + v + ' reads ' + (C(v, dk) || 0).toFixed(2) + ' on ' + dk);
    });
    [['high contrast', hc], ['high contrast .main', hcm]].forEach(([sc, blk]) => {
      const v = varIn(blk, n);
      if (!v) { out.push(sc + ' has no ' + n); return; }
      if (!(C(v, '#000000') >= 7)) out.push(sc + ' ' + n + ' reads ' + (C(v, '#000000') || 0).toFixed(2) + ' on black');
    });
  });
  // the grey small print
  ['.main', 'light'].forEach(sc => {
    const blk = sc === '.main' ? main : light, v = varIn(blk, '--text-dim');
    if (!(C(v, '#ede2cc') >= 4.5 && C(v, '#f8e8c0') >= 5)) out.push(sc + ' --text-dim ' + v + ' too faint');
  });
  return out;
}
section('A · one palette of word colours, readable in every scope');
const palBad = checkPalette(css, 'real');
ok('every word colour: bright in :root, deep (≥ 5 / ≥ 4.5) on the cream, ≥ 7 on high-contrast black', palBad.length === 0, palBad.slice(0, 4).join(' | '));
ok('the highlighted menu item reads ≥ 4.5 on the navy sidebar', C(varIn(block(css, ROOT), '--t-nav'), '#132447') >= 4.5);
ok('…and on the light theme\'s cream sidebar', C(varIn(block(css, LIGHT), '--t-nav'), '#f8e8c0') >= 4.5);
ok('the menu item uses it', /\.nav-item\.active \{[^}]*color: var\(--t-nav\)/.test(css) && /\.mobile-nav-item\.active \{ color: var\(--t-nav\)/.test(css));
ok('the content area names its own text colour (v1854: inherited cream "•" were invisible)',
   /\.main \{ flex: 1; overflow-y: auto;[\s\S]{0,400}?color: var\(--text\); \}/.test(css));
ok('the dashboard section titles use the deep link blue', /#dash-panels-host \.section-title \{ --text-dim:var\(--t-link\)/.test(css));

// ── B · no old bright literal, no var(--accent), as a WORD colour ─────────
const OLD = /(^|[^-a-zA-Z])color:\s*(#(2980b9|3498db|f05008|e74c3c|d4a843|2ecc71|e67e22|8b5cf6|16a085|0891b2|d35400|a855f7)\b|var\(--accent\s*[,)])/i;
// Print / new-window HTML has no app.css — a var() there would not resolve.
// appearance.js's preview replica sets its OWN --accent, which --t-accent
// (declared at :root) cannot follow — it must keep var(--accent).
const EXEMPT = { 'share.js': 1, 'report-export.js': 1, 'report-library.js': 1, 'appearance.js': 2 };
function scanFiles(files) {
  const hits = [];
  files.forEach(([f, src]) => {
    const n = src.split('\n').filter(l => OLD.test(l)).length;
    const allowed = EXEMPT[f] || 0;
    if (n > allowed) hits.push(f + ' ×' + n);
  });
  return hits;
}
const jsFiles = fs.readdirSync(APPDIR).filter(f => /\.js$/.test(f)).map(f => [f, APP(f)]).concat([['index.html', APP('index.html')], ['app.css', css]]);
ok('scanned the app\'s files', jsFiles.length > 60, String(jsFiles.length));
const hits = scanFiles(jsFiles);
ok('no word anywhere still uses an old bright colour or var(--accent)', hits.length === 0, hits.join(', '));
ok('the preview replica still reads the live skin (var(--accent))', /\.rrap-logo i\{color:var\(--accent\)/.test(appear));

// B2 — the word colours CHOSEN BY CODE: 'color:' + (on ? 'var(--accent)' : …),
// color:${…}, el.style.color = …  (found live after the first ship: the
// Want List "High", the Yardmaster counts). The expression after the colour
// is read up to its end and must not hold an old bright value.
const OLDVAL = /(['"])(var\(--accent\)|#(?:2980b9|3498db|e74c3c|f05008|d4a843|2ecc71|e67e22|8b5cf6|16a085|0891b2|d35400|a855f7))\1/i;
function exprEnd(s, i) {
  let d = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"') q = c;
    else if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (!d) return j; d--; }
    else if (!d && ';\n,+'.includes(c)) return j;
  }
  return s.length;
}
function chosenHits(files) {
  const starts = [/(?<![-\w])color:(['"])\s*\+\s*/g, /(?<![-\w])color:\$\{/g, /\.style\.color\s*=\s*/g];
  const hits = [];
  files.forEach(([f, src]) => {
    if (EXEMPT[f]) return;
    starts.forEach(rx => { let m; rx.lastIndex = 0; while ((m = rx.exec(src))) {
      const seg = src.slice(m.index + m[0].length, exprEnd(src, m.index + m[0].length));
      if (OLDVAL.test(seg)) hits.push(f + ': ' + seg.slice(0, 50));
    } });
  });
  return hits;
}
const chosen = chosenHits(jsFiles.filter(([f]) => /\.js$/.test(f)).concat([['gmail-help.js', '']]));
ok('no word colour chosen by code is an old bright value or var(--accent)', chosen.length === 0, chosen.slice(0, 3).join(' | '));
ok('the active filter pill is the deep blue (white reads ≥ 4.5)', /var _FON = '#1f6391'/.test(APP('browse.js')) && C('#ffffff', '#1f6391') >= 4.5);

// ── C · the button levers still catch the buttons ─────────────────────────
section('C · the two button levers list the var forms');
function leversOk(src) {
  const need = ['t-link', 't-info', 't-accent', 't-green', 't-orange', 't-purple', 't-sea'];
  // the plain lever: the selector starts a line or follows ", " — never the
  // high-contrast twin's `"] .main button…`
  const miss = need.filter(v => !new RegExp('(^|\\n|, )\\.main button\\[style\\*="var\\(--' + v + '\\)"\\]').test(src));
  const hcMiss = need.filter(v => !src.includes('html[data-theme="high-contrast"] .main button[style*="var(--' + v + ')"]'));
  const danger = /button\[style\*="var\(--t-danger\)"\] \{\s*border-color:#8b8e94 !important; color:var\(--t-red\) !important;/.test(src);
  return { miss, hcMiss, danger };
}
const lv = leversOk(css);
ok('the action-button lever lists every var form', lv.miss.length === 0, lv.miss.join(' '));
ok('…and so does its high-contrast twin', lv.hcMiss.length === 0, lv.hcMiss.join(' '));
ok('the destructive lever matches var(--t-danger) and paints var(--t-red)', lv.danger);
ok('the lever paints the deep link blue', /color:var\(--t-link\) !important;/.test(css));

// ── D · the skin colours are darkened for the cream at run time ──────────
section('D · rrSyncReadableText darkens the skin for the cream');
const skins = {};
appear.replace(/'([^']+)':\s*(\{[^}]*'--accent':'#[0-9a-f]{6}'[^}]*\})/gi, (m, n, obj) => { skins[n] = JSON.parse(obj.replace(/'/g, '"')); return m; });
ok('read the built-in skins', Object.keys(skins).length >= 4, Object.keys(skins).join(', '));
const CREAM = { '--bg': '#f8e8c0', '--surface2': '#f5eeda', '--surface3': '#ede2cc' };
let worst = 99, worstAt = '';
Object.keys(skins).forEach(n => {
  const R = room(skins[n], CREAM, null);
  R.rrSyncReadableText();
  const rule = R.styleEl.textContent;
  const decl = {}; rule.replace(/(--[\w-]+):(#[0-9a-f]{6});/gi, (m, k, v) => { decl[k] = v; return m; });
  ['--accent2', '--accent3', '--forsale', '--want', '--green'].concat(['--t-accent']).forEach(k => {
    const src = k === '--t-accent' ? skins[n]['--accent'] : skins[n][k];
    if (!src) return;
    const v = decl[k], c = v ? C(v, '#ede2cc') : 0;
    if (c < worst) { worst = c; worstAt = n + ' ' + k + ' ' + v; }
  });
  if (n === 'Alaska') {
    ok('Alaska: the rule is written for .main', /^\.main\{/.test(rule), rule.slice(0, 60));
    ok('Alaska: the gold words (--t-accent) now read ≥ 5', decl['--t-accent'] && C(decl['--t-accent'], '#ede2cc') >= 5, decl['--t-accent']);
    ok('Alaska: the pale gold (--accent2) now reads ≥ 5 (was 1.5)', decl['--accent2'] && C(decl['--accent2'], '#ede2cc') >= 5, decl['--accent2']);
    ok('Alaska: the purple (--accent3, "AA SET") now reads ≥ 5 (was 2.8)', decl['--accent3'] && C(decl['--accent3'], '#ede2cc') >= 5, decl['--accent3']);
    ok('Alaska: the fill accent itself is NOT changed (the badges stay gold)', !('--accent' in decl));
  }
});
ok('every darkened skin colour, every skin, reads ≥ 5 on the darkest cream', worst >= 5, worst.toFixed(2) + ' at ' + worstAt);
{
  const R = room(skins.Alaska || {}, { '--bg': '#000000', '--surface2': '#000000', '--surface3': '#000000' }, 'high-contrast');
  R.rrSyncReadableText();
  ok('high contrast (black): nothing is darkened', R.styleEl.textContent === '', R.styleEl.textContent);
}
{
  const R = room(skins.Alaska || {}, CREAM, 'light');
  R.rrSyncReadableText();
  ok('light theme: the rule is written for the whole page (body)', /^body\{/.test(R.styleEl.textContent), R.styleEl.textContent.slice(0, 40));
}
ok('rrDarkenFor keeps the hue (Alaska gold stays a gold: R > G > B)', (() => {
  const v = W.rrDarkenFor('#f2b428', '#ede2cc', 5); const r = parseInt(v.substr(1, 2), 16), g = parseInt(v.substr(3, 2), 16), b = parseInt(v.substr(5, 2), 16);
  return r > g && g > b;
})());
ok('the sync is wired to the one door (the <html> observer and page load)', /new MutationObserver\(rrSyncInk\)/.test(cfg) && /function rrSyncInk\(\) \{ rrSyncInkOnAccent\(\); rrSyncReadableText\(\); \}/.test(cfg));

// ── E · MTH's badge ───────────────────────────────────────────────────────
section('E · MTH red');
const mthM = onb.match(/mth:\s*\{[^}]*color:\s*'(#[0-9a-f]{6})'/i), mthE = onb.match(/mth_o:\s*'(#[0-9a-f]{6})'/i);
ok('MTH maker badge is #c0392b', mthM && mthM[1].toLowerCase() === '#c0392b', mthM && mthM[1]);
ok('MTH era colour is #c0392b', mthE && mthE[1].toLowerCase() === '#c0392b', mthE && mthE[1]);
ok('white letters on it read ≥ 5', C('#ffffff', '#c0392b') >= 5, C('#ffffff', '#c0392b').toFixed(2));

// ── F · offenders: each rule must be able to fail ─────────────────────────
section('F · planted offenders are caught');
ok('F1 the old link blue put back in .main is caught',
   checkPalette(css.replace(/(\n\s*\.main\s*\{[\s\S]*?--t-link:\s*)#1f6391/, '$1#2980b9'), 'o').length > 0);
ok('F2 the old grey small print put back is caught',
   checkPalette(css.replace(/(\n\s*\.main\s*\{[\s\S]*?--text-dim:\s*)#6b5f4a/, '$1#8a7e68'), 'o').length > 0);
ok('F3 a deep shade leaking into :root (the navy chrome) is caught',
   checkPalette(css.replace(/(:root\s*\{[\s\S]*?--t-orange:\s*)#e67e22/, '$1#8a4805'), 'o').length > 0);
ok('F4 a new word written color:#2980b9 is caught',
   scanFiles([['browse.js', '<a style="color:#2980b9">x</a>']]).length === 1);
ok('F5 a new word written color:var(--accent) is caught',
   scanFiles([['sell.js', '<span style="font-weight:600;color:var(--accent)">x</span>']]).length === 1);
ok('F6 …but background-color / border-color are not words',
   scanFiles([['sell.js', '<i style="border-color:#2980b9;background-color:#e67e22"></i>']]).length === 0);
ok('F7 a lever selector removed is caught',
   leversOk(css.replace(', .main button[style*="var(--t-orange)"]', ', .main button[style*="var(--t-orangeX)"]')).miss.length > 0);
ok('F9 the Want List "High" put back as var(--accent) is caught',
   chosenHits([['dashboard.js', "'<span style=\"color:' + (hi ? 'var(--accent)' : 'var(--text-dim)') + '\">'"]]).length === 1);
ok('F10 a style.color set to the old link blue is caught',
   chosenHits([['detail-nav.js', "el.style.color = '#2980b9';"]]).length === 1);
ok('F11 …but a BORDER chosen by code is not a word',
   chosenHits([['wizard.js', "'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';color:var(--t-accent)'"]]).length === 0);
ok('F8 rrDarkenFor that gives the colour back unchanged would be caught',
   C('#e8cf8a', '#ede2cc') < 5);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
