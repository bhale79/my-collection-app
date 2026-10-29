// ═══════════════════════════════════════════════════════════════════════════
// back_stack_reopen_2038_tests.js — v0.9.2038 (Workbench check 2026-10-28, C22)
//
// An overlay re-opened under the SAME id — remove the old element, append a
// new one, wire it — is how most of the app's pop-ups redraw themselves
// (Parts diagrams, the Maintenance panel, the Workbench card). The OLD
// element's watcher fired after the new one was on the Back list and popped
// it BY ID: the device Back button then no longer closed the pop-up on screen
// and moved the page underneath instead. A watcher pops only its own entry now.
//
// Real Chromium (jsdom never fires popstate for history.back()).
//   1  wire #X, re-open #X in the same instant → ONE entry on the Back list
//   2  a real Back press closes the NEW #X
//   3  closing an overlay normally (✕) still takes its entry off the list
//   4  PLANTED: the old pop-by-id watcher loses the new entry (1 would fail)
//
// Run:  node tests/back_stack_reopen_2038_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  back_stack_reopen_2038_tests needs playwright and it is not installed.'); process.exit(1); }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'back-stack.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

async function run(browser, src) {
  const pg = await browser.newPage();
  await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
  await pg.goto('https://rr.test/app/');
  const out = await pg.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const open = () => { const old = document.getElementById('X'); if (old) old.remove(); const el = document.createElement('div'); el.id = 'X'; document.body.appendChild(el); BackStack.wire(el); return el; };
    open();
    await wait(300);
    const second = open();                         // pressed again: the old one goes, a new one comes
    await wait(500);
    const sizeAfterReopen = BackStack.size();
    history.back();                                // the user presses Back
    await wait(500);
    const closedByBack = !document.body.contains(second);
    // 3 — a normal close
    const y = document.createElement('div'); y.id = 'Y'; document.body.appendChild(y); BackStack.wire(y);
    await wait(300);
    const before = BackStack.size();
    y.remove();
    await wait(500);
    return { sizeAfterReopen, closedByBack, before, afterClose: BackStack.size() };
  });
  await pg.close();
  return out;
}

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const now = await run(browser, SRC);
    T('1 re-opened under the same id → ONE entry on the Back list', now.sizeAfterReopen === 1, now);
    T('2 a real Back press closes the pop-up on screen', now.closedByBack === true, now);
    T('3 a normal close still takes its entry off the list', now.before === 1 && now.afterClose === 0, now);
    const old = SRC.replace('if (!byBack && mine && _stack.indexOf(mine) >= 0) pop(id);', 'if (!byBack) pop(id);');
    if (old === SRC) T('4 PLANTED: could plant the old watcher', false);
    else {
      const was = await run(browser, old);
      T('4 PLANTED: the old pop-by-id watcher loses the new entry (1 would fail)', was.sizeAfterReopen === 0 && was.closedByBack === false, was);
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('BACK-STACK RE-OPEN TESTS FAILING'); process.exit(1); }
  console.log('ALL BACK-STACK RE-OPEN TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.message)); process.exit(1); });
