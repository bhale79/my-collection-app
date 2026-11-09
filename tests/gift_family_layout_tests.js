#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE FAMILY GIFT PAGE'S LAYOUT, IN A REAL BROWSER — 2026-11-08 (giftfixes4)
//
// Found while checking giftfixes3 in real Chromium: on an item with NO picture
// the "Undo" button sat in the middle of the box, not at the far right where
// giftfixes ([stated] Brad 2026-11-07 "many people will double tap it") put it
// so a second tap on "I bought this" can't undo it. The words beside the
// picture only took the width they needed. [stated] Brad 2026-11-08 20:14 CT
// "fix it". Now the words fill the rest of the box (.item > .body flex:1).
//
//   L  gift/index.html in Chromium (a stand-in backend: gift_get, gift_marks),
//      at a phone (390 px) and a computer (1280 px), after the bottom button:
//      on items WITH and WITHOUT a picture, Undo's right edge sits at the box's
//      right edge; a very long name — even one unbroken run of letters — wraps
//      inside its box, and so do a long title and a long store name (body
//      overflow-wrap:anywhere); no sideways scroll.
//   P  planted offenders — each turns its own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  gift_family_layout_tests needs playwright: ' + e.message); process.exit(1); }
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'gift', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra || '').slice(0, 600))); cond ? pass++ : fail++; }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the page — update the test');
  return src.split(from).join(to);
}
// a 1x1 picture, served by the stand-in (the page only draws https pictures)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const LONG = 'Lionel 2343 Santa Fe F3 AA Diesel Locomotive with its original box, the instruction sheet and the second motor — ' + 'W'.repeat(60);   // one unbroken run, like a pasted code
const LIST = { title: 'Gift ideas — from Brad ' + 'T'.repeat(50), who: 'Brad', footer: 'Made with The Rail Roster.', items: [
  { key: 'pic|', name: 'Lionel 2245C Texas Special B-unit', price: '$700', image: 'https://cdn.shopify.com/pic.png', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/c' }] },
  { key: 'nopic|', name: 'Lionel 2343 Santa Fe F3', price: '$350', image: '', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/a' }] },
  { key: 'long|', name: LONG, price: '$90', image: '', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/b' }] },
  { key: 'store|', name: 'Lionel 6017 caboose', price: '$40', image: '', links: [{ store: 'S'.repeat(70), url: 'https://www.example.com/x' }] },
  { key: 'open|', name: 'Lionel 6464-1 Western Pacific boxcar', price: '$60', image: '', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/d' }] } ] };
const BOUGHT = ['pic|', 'nopic|', 'long|'];

async function look(browser, html, width) {
  const p = await browser.newPage({ viewport: { width: width, height: 900 } });
  await p.route('https://therailroster.com/gift/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.route('https://cdn.shopify.com/**', r => r.fulfill({ contentType: 'image/png', body: PNG }));
  await p.route('https://script.google.com/**', r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    const out = b.action === 'gift_get' ? { status: 200, list: LIST } : b.action === 'gift_marks' ? { status: 200, keys: BOUGHT } : { status: 200 };
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(out) });
  });
  const R = {};
  try {
    await p.goto('https://therailroster.com/gift/?l=' + 'a'.repeat(32));
    await p.waitForSelector('[data-reveal]', { timeout: 15000 });
    await p.click('[data-reveal]');
    await p.waitForSelector('[data-undo="nopic|"]', { timeout: 15000 });
    await p.waitForFunction(() => { const i = document.querySelector('[data-item="pic|"] img'); return !i || i.complete; });
    Object.assign(R, await p.evaluate(() => {
      const gap = key => {
        const box = document.querySelector('[data-item="' + key + '"]'), u = box && box.querySelector('[data-undo]');
        if (!box || !u) return null;
        const cs = getComputedStyle(box), inner = box.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
        return Math.round(inner - u.getBoundingClientRect().right);
      };
      const longBox = document.querySelector('[data-item="long|"]'), longName = longBox && longBox.querySelector('.name');
      const buy = document.querySelector('[data-buy="open|"]');
      return {
        gapPic: gap('pic|'), gapNoPic: gap('nopic|'), gapLong: gap('long|'),
        longInside: !!longName && longName.getBoundingClientRect().right <= longBox.getBoundingClientRect().right + 0.5 && longName.getBoundingClientRect().height > 30,
        sideways: document.documentElement.scrollWidth > innerWidth,
        buyLeft: !!buy && Math.round(buy.getBoundingClientRect().left - buy.parentNode.getBoundingClientRect().left)
      };
    }));
  } catch (e) { R.error = e.message; }
  await p.close();
  return R;
}
const atRight = g => typeof g === 'number' && g >= 0 && g <= 2;

(async function main() {
  const ex = '/opt/pw-browsers/chromium';   // the same launch as the other real-browser suites (lib/lars-world.js)
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    for (const width of [390, 1280]) {
      console.log('\n== L. ' + width + ' px ==');
      const R = await look(browser, PAGE, width);
      ok(width + ' px: the page drew (no error)', !R.error, R.error);
      ok(width + ' px: an item WITH a picture — Undo at the far right of its box', atRight(R.gapPic), R.gapPic);
      ok(width + ' px: an item with NO picture — Undo at the far right of its box (the 2026-11-08 find)', atRight(R.gapNoPic), R.gapNoPic);
      ok(width + ' px: a very long name — Undo still at the far right', atRight(R.gapLong), R.gapLong);
      ok(width + ' px: the very long name wraps inside its box', R.longInside === true);
      ok(width + ' px: nothing scrolls sideways', R.sideways === false);
      ok(width + ' px: "I bought this" stays at the left, where it was', R.buyLeft === 0, R.buyLeft);
    }
    console.log('\n== P. Planted offenders ==');
    const noFill = plant(PAGE, '  .item > .body { flex:1; }\n', '', 'the words not filling the box');
    const R1 = await look(browser, noFill, 390);
    ok('PLANT the words not filling the box (as it was live) — the no-picture Undo check catches it', !R1.error && !atRight(R1.gapNoPic), JSON.stringify(R1));
    const noClass = plant(PAGE, "var body = el('div', 'body');", "var body = el('div');", 'the words drawn without their class');
    const R2 = await look(browser, noClass, 390);
    ok('PLANT the words drawn without their class — caught', !R2.error && !atRight(R2.gapNoPic), JSON.stringify(R2));
    const noBreak = plant(PAGE, " serif; overflow-wrap:anywhere; }", " serif; }", 'long unbroken words not allowed to break');
    const R4 = await look(browser, noBreak, 390);
    ok('PLANT long unbroken words (name, title, store) not allowed to break — caught', !R4.error && (R4.sideways === true || R4.longInside === false), JSON.stringify(R4));
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILURES' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
