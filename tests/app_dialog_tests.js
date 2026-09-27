#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// APP DIALOG — v0.9.1819   (real Chromium, the REAL app, no stubs)
//
// Release readiness S2. native_dialog_tests.js proves the browser's own boxes
// are gone from the source; this proves the app's own two boxes — appConfirm
// and appPrompt (wizard-utils.js) — actually behave, in a real page:
// the answer comes back, the buttons say what the caller asked, Escape is
// "no", a "\n" is a line break, and no native dialog opens on the way.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  app_dialog_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [], natives = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => { natives.push(d.type() + ': ' + d.message()); d.dismiss(); });
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);

  // ── appConfirm ──
  await pg.evaluate(() => { window.__ans = 'pending'; appConfirm('Line one\nLine two', { title: 'A title', ok: 'Do it', cancel: 'Leave it', danger: true }).then(v => { window.__ans = v; }); });
  const box = await pg.evaluate(() => {
    const yes = document.getElementById('_ac-yes'), no = document.getElementById('_ac-no');
    const card = yes && yes.closest('div').parentElement;
    return { yes: yes && yes.textContent, no: no && no.textContent, html: card ? card.innerHTML : '', title: card ? card.firstElementChild.textContent : '' };
  });
  T('C1  the box is on the page with the caller\'s title and button words', box.title === 'A title' && box.yes === 'Do it' && box.no === 'Leave it', box);
  T('C2  a "\\n" in the message is a line break on screen', /Line one<br>Line two/.test(box.html), box.html.slice(0, 200));
  await pg.click('#_ac-yes');
  T('C3  Yes answers true and the box is gone', (await pg.evaluate(() => window.__ans)) === true && (await pg.$('#_ac-yes')) === null);
  await pg.evaluate(() => { window.__ans = 'pending'; appConfirm('Sure?').then(v => { window.__ans = v; }); });
  await pg.click('#_ac-no');
  T('C4  No answers false', (await pg.evaluate(() => window.__ans)) === false);
  await pg.evaluate(() => { window.__ans = 'pending'; appConfirm('Sure?').then(v => { window.__ans = v; }); });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(50);
  T('C5  Escape is "no", never "yes"', (await pg.evaluate(() => window.__ans)) === false && (await pg.$('#_ac-yes')) === null);

  // ── appPrompt ──
  await pg.evaluate(() => { window.__ans = 'pending'; appPrompt('Name it.', 'old name', { title: 'Rename', ok: 'Rename' }).then(v => { window.__ans = v; }); });
  await pg.waitForTimeout(80);
  const pr = await pg.evaluate(() => { const i = document.getElementById('_ap-input'); return { val: i && i.value, focused: document.activeElement === i, ok: document.getElementById('_ap-ok').textContent }; });
  T('P1  the text box opens with the current value, focused, and the caller\'s button word', pr.val === 'old name' && pr.focused && pr.ok === 'Rename', pr);
  await pg.fill('#_ap-input', 'new name');
  await pg.click('#_ap-ok');
  T('P2  OK returns what was typed', (await pg.evaluate(() => window.__ans)) === 'new name');
  await pg.evaluate(() => { window.__ans = 'pending'; appPrompt('Name it.', '').then(v => { window.__ans = v; }); });
  await pg.waitForTimeout(80);
  await pg.fill('#_ap-input', 'typed then enter');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(50);
  T('P3  Enter is OK', (await pg.evaluate(() => window.__ans)) === 'typed then enter');
  await pg.evaluate(() => { window.__ans = 'pending'; appPrompt('Name it.', 'x').then(v => { window.__ans = v; }); });
  await pg.waitForTimeout(80);
  await pg.click('#_ap-cancel');
  T('P4  Cancel returns null (so "!next" callers treat it as no change)', (await pg.evaluate(() => window.__ans)) === null);

  // ── two of the converted sites, called for real ──
  await pg.evaluate(() => { window._maintDocformClose(); });
  await pg.waitForTimeout(80);
  const s1 = await pg.evaluate(() => { const y = document.getElementById('_ac-yes'), n = document.getElementById('_ac-no'); return { yes: y && y.textContent, no: n && n.textContent }; });
  T('S1  the My Manuals form\'s X asks in the app\'s box (was the browser\'s confirm)', s1.yes === 'Close' && s1.no === 'Keep editing', s1);
  await pg.click('#_ac-no');
  await pg.evaluate(() => { window._rrPhotoBackToInbox('file1', 'engine <b>2343</b>.jpg', ''); });
  await pg.waitForTimeout(80);
  const s2 = await pg.evaluate(() => { const y = document.getElementById('_ac-yes'); const card = y && y.closest('div').parentElement; return { yes: y && y.textContent, html: card ? card.innerHTML : '' }; });
  T('S2  "Send back to the inbox" asks in the app\'s box, with the file name escaped (no markup injected)', s2.yes === 'Send back' && /engine &lt;b&gt;2343&lt;\/b&gt;/.test(s2.html) && !/<b>2343<\/b>/.test(s2.html), s2);
  await pg.click('#_ac-no');

  T('E1  no native browser dialog opened at any point', natives.length === 0, natives);
  T('E2  no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
