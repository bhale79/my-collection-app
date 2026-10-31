// ═══════════════════════════════════════════════════════════════════════════
// css_rules_kept_tests.js — 2026-10-30 (maintenance chat)
//
// [stated] Brad, 2026-10-30: "yes" to removing the two stray HTML tags from
// app.css and to a test that keeps them out.
//
// app.css began with an HTML "<style>" and had a "</style>" two-thirds of the
// way down (left from when the rules lived in index.html). A browser reading
// a .css file treats a stray tag as junk and THROWS AWAY THE RULE AFTER IT.
// Measured in Chromium on the live file: 872 rules kept, and the two thrown
// away were the global reset (never on, so it stays off on purpose) and the
// Insurance report's print block (back now).
//
// Nothing in a source scan can tell what a browser keeps. So this loads every
// stylesheet the app links, the way the app does (a <link>, as a .css file),
// in real Chromium, and checks:
//   A  the browser keeps EVERY top-level rule written in the file
//      (rules written = top-level blocks and @-statements, comments and strings
//       skipped; rules kept = document.styleSheets[n].cssRules.length)
//   B  no "<" outside a comment or a string (a stray tag of any kind), and no
//      closing style tag text even inside a comment (a pasting page stops there)
//   C  the Insurance report's print block is a live rule, and the dormant
//      reset is NOT a live rule (switching it on would move every screen)
//   D  planted offenders: "<style>" back on line 1, "</style>" back before the
//      print block, a junk line between two rules — each is caught by A
//
// Run:  node tests/css_rules_kept_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  css_rules_kept_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 600) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// the stylesheets index.html links from the app itself (not the CDN ones)
const IX = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const SHEETS = [...IX.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"?]+\.css)/g)].map(m => m[1]);

// rules WRITTEN at the top level: comments and strings skipped; each top-level
// {…} block is one rule, and so is a top-level @-statement ending in ";"
function written(src) {
  let n = 0, depth = 0, i = 0, stmt = '', stray = [];
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } i = j + 1; stmt += 'x'; continue; }
    if (c === '<') stray.push(src.slice(0, i).split('\n').length);
    if (c === '{') { depth++; }
    else if (c === '}') { depth--; if (depth === 0) { n++; stmt = ''; } }
    else if (c === ';' && depth === 0) { if (stmt.trim().charAt(0) === '@') n++; stmt = ''; }
    else if (depth === 0) stmt += c;
    i++;
  }
  return { n, stray };
}

async function kept(browser, files) {
  const pg = await browser.newPage();
  await pg.route('https://rr.test/**', r => {
    const u = new URL(r.request().url()).pathname.replace(/^\/app\//, '');
    if (files[u] !== undefined) return r.fulfill({ contentType: 'text/css', body: files[u] });
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head>' + Object.keys(files).map(f => '<link rel="stylesheet" href="./' + f + '">').join('') + '</head><body></body></html>' });
  });
  await pg.goto('https://rr.test/app/');
  await pg.waitForTimeout(300);
  const out = await pg.evaluate(() => [...document.styleSheets].map(s => ({
    href: s.href.split('/').pop(), count: s.cssRules.length,
    printIns: [...s.cssRules].some(r => r.media && /print/.test(r.media.mediaText) && /#ins-report-foot/.test(r.cssText)),
    reset: [...s.cssRules].some(r => /^\*, \*::before, \*::after \{[^}]*box-sizing: border-box/.test(r.cssText)),
  })));
  await pg.close();
  const by = {}; out.forEach(o => { by[o.href] = o; });
  return by;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const files = {}; SHEETS.forEach(f => { files[f] = fs.readFileSync(path.join(APP, f), 'utf8'); });
    ok('found the app\'s own stylesheets in index.html (app.css, tutorial.css, vault-styles.css)', SHEETS.indexOf('app.css') >= 0 && SHEETS.length >= 3, SHEETS);
    const k = await kept(browser, files);

    section('A · the browser keeps every rule written');
    SHEETS.forEach(f => {
      const w = written(files[f]);
      ok(f + ': ' + w.n + ' rules written, ' + (k[f] && k[f].count) + ' kept', k[f] && k[f].count === w.n, { written: w.n, kept: k[f] && k[f].count });
    });

    section('B · no stray tag');
    SHEETS.forEach(f => { const w = written(files[f]); ok(f + ': no "<" outside a comment or a string', w.stray.length === 0, w.stray.slice(0, 10)); });
    // not even in a comment: a page or test that pastes the file into a style
    // element stops reading at the closing tag's letters (it cut tests' CSS short)
    SHEETS.forEach(f => ok(f + ': no closing style tag text anywhere, comments included', !/<\/style/i.test(files[f])));

    section('C · the two rules the stray tags used to eat');
    ok('the Insurance report print block is a live rule (app.css)', k['app.css'] && k['app.css'].printIns === true);
    ok('the dormant reset is NOT a live rule — switching it on would move every screen', k['app.css'] && k['app.css'].reset === false);

    section('E · on paper (print) the Insurance report carries no app chrome');
    {
      const pg = await browser.newPage();
      await pg.route('https://rr.test/**', r => {
        const u = new URL(r.request().url()).pathname.replace(/^\/app\//, '');
        if (files[u] !== undefined) return r.fulfill({ contentType: 'text/css', body: files[u] });
        return r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="stylesheet" href="./app.css"></head><body><nav class="sidebar">menu</nav><div id="tut-help-widget">help</div><main class="main"><div id="page-reports" class="page active"><button id="b">Export</button><div id="ins-report-foot">foot</div></div></main></body></html>' });
      });
      await pg.goto('https://rr.test/app/');
      await pg.emulateMedia({ media: 'print' });
      const shown = await pg.evaluate(() => ['.sidebar', '#tut-help-widget', '#b', '#ins-report-foot'].map(q => getComputedStyle(document.querySelector(q)).display));
      await pg.emulateMedia({ media: 'screen' });
      const onScreen = await pg.evaluate(() => getComputedStyle(document.getElementById('tut-help-widget')).display);
      await pg.close();
      ok('printing hides the sidebar, the help button and the report\'s buttons, and keeps the report', shown[0] === 'none' && shown[1] === 'none' && shown[2] === 'none' && shown[3] !== 'none', shown);
      ok('…and on screen nothing is hidden by it', onScreen !== 'none', onScreen);
    }

    section('D · planted offenders');
    const css = files['app.css'];
    const p1 = Object.assign({}, files, { 'app.css': '<style>\n' + css });
    const k1 = await kept(browser, p1);
    ok('D1 PLANTED: "<style>" back on line 1 → a rule is dropped (A fails)', k1['app.css'].count < written(p1['app.css']).n && written(p1['app.css']).stray.length === 1, { kept: k1['app.css'].count, written: written(p1['app.css']).n });
    const at = css.indexOf('/* ── Insurance report print styles (Session 112) ── */');
    const p2 = Object.assign({}, files, { 'app.css': css.slice(0, at) + '</style>\n\n' + css.slice(at) });
    const k2 = await kept(browser, p2);
    ok('D2 PLANTED: "</style>" back before the print block → the print block is dropped again (A and C fail)', at > 0 && k2['app.css'].count < written(p2['app.css']).n && k2['app.css'].printIns === false);
    const p3 = Object.assign({}, files, { 'app.css': css.replace('.coll-actions-cell { white-space: nowrap !important; }', 'oops ) junk\n.coll-actions-cell { white-space: nowrap !important; }') });
    const k3 = await kept(browser, p3);
    ok('D3 PLANTED: a junk line between two rules (no "<" at all) → caught by the count alone', p3['app.css'] !== css && k3['app.css'].count < written(p3['app.css']).n);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
