// ═══════════════════════════════════════════════════════════════════════════
// back_stack_double_pop_tests.js — v0.9.1936. Two overlays closing at once.
//
// back-stack.js answers every self-made history.back() by ignoring the
// popstate it causes. It kept that as ONE true/false flag. When two overlays
// closed in the same instant — the "Add a picture" chooser stepping aside for
// the Google Photos waiting panel, and the panel coming straight down again —
// both pops set the same flag, the first popstate cleared it, and the SECOND
// popstate was taken for the user pressing Back: it closed whatever sat below.
// pic_first_tests G2 caught it (the picture box vanished). It is a count now.
//
// Real Chromium (jsdom never fires popstate for history.back()).
//   1  push A, B, C; pop C and B in the same instant -> A stays open
//   2  a real Back press afterwards still closes A (nothing swallowed)
//   3  PLANTED: the old true/false flag closes A in step 1
//
// Run:  node tests/back_stack_double_pop_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  back_stack_double_pop_tests needs playwright and it is not installed.'); process.exit(1); }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'back-stack.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

async function run(browser, src) {
  const pg = await browser.newPage();
  await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
  await pg.goto('https://rr.test/app/');
  const first = await pg.evaluate(async () => {
    window.__closedA = 0;
    BackStack.push('A', () => { window.__closedA++; });
    BackStack.push('B', () => {});
    BackStack.push('C', () => {});
    BackStack.pop('C'); BackStack.pop('B');            // two overlays gone in the same instant
    await new Promise(r => setTimeout(r, 500));
    return { closedA: window.__closedA, size: BackStack.size() };
  });
  let second = null;
  if (first.closedA === 0) {
    second = await pg.evaluate(async () => {
      history.back();                                   // the user really presses Back
      await new Promise(r => setTimeout(r, 500));
      return { closedA: window.__closedA, size: BackStack.size() };
    });
  }
  await pg.close();
  return { first, second };
}

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const now = await run(browser, SRC);
    T('1 two overlays closing in the same instant leave the one below open', now.first.closedA === 0 && now.first.size === 1, now.first);
    T('2 a real Back press afterwards still closes it — nothing was swallowed', !!now.second && now.second.closedA === 1 && now.second.size === 0, now.second);
    const old = SRC.replace(/var _ignorePops = 0;[^\n]*/, 'var _ignorePops = false;')
      .replace('if (_ignorePops > 0) {\n      _ignorePops--;', 'if (_ignorePops) {\n      _ignorePops = false;')
      .replace('_ignorePops++;', '_ignorePops = true;');
    if (old === SRC) T('3 PLANTED: could plant the old flag', false);
    else {
      const was = await run(browser, old);
      T('3 PLANTED: the old true/false flag closes the overlay below (1 would fail)', was.first.closedA === 1, was.first);
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('BACK-STACK DOUBLE-POP TESTS FAILING'); process.exit(1); }
  console.log('ALL BACK-STACK DOUBLE-POP TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.message)); process.exit(1); });
