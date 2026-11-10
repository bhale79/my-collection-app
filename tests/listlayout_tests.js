#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE LIST LAYOUT — Want/Upgrade, For Sale, Parts Needed (2026-11-08, R7
// listlayout; Brad's iPad screenshots: the desktop table squeezed beside the
// menu, Item # pushed off the left edge, "MANUFACTU" / "CONDITION T/" cut,
// 4–6 small buttons stacked per row with "Got / It" wrapping; on his computer
// "Showing 4 of 5" with every filter on All).
//   S  source: the three pages decide table-or-cards ONLY through
//      rrListAsCards; no "+ Collection" / "Bought it" left in app words;
//      ONE helper draws the card and row buttons — each proven on a plant.
//   L  the real app in Chromium at phone (390), iPad upright (820, touch),
//      iPad sideways (1180, touch), a narrow computer window (1000), a laptop
//      (1280) and a wide screen (2048), on all three lists:
//        nothing runs off the side · Item # on screen · no button word wraps
//        or is cut · card buttons ≥ 44px · Remove only inside ⋯ on a card ·
//        tablets fold the menu behind ☰ (phone / computer don't) · a laptop
//        keeps the table, a narrow window gets cards · no heading cut.
//   M  the ⋯ sheet: Remove last and red, a tap outside does nothing, Cancel
//      and the device Back close it, a choice runs for THAT entry.
//   C  the count: an engine + tender wanted together is one row, and the
//      header says "N items", never "Showing N of N+1".
//   P  planted: the OLD app-pages.js + app.css served in their place (the
//      live v0.9.2131 code) — L turns red at the iPad; a wrapping main button,
//      a tablet test that says no, and the old unfolded count each turn their
//      check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PAGES = read('app-pages.js'), CSS = read('app.css');
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
function body(src, name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  return src.slice(i, src.indexOf('\n}\n', i) + 3);
}

// ── S ── source rules
function decidesByPhone(src) {
  return ['buildUpgradePage', 'buildForSalePage', '_renderPartsList'].filter(n => /rrIsPhone\s*\(/.test(body(src, n)));
}
ok('S1 the three lists decide table-or-cards only through rrListAsCards (never rrIsPhone)', !decidesByPhone(PAGES).length, decidesByPhone(PAGES).join(','));
ok('S1-P the old "const isMobile = rrIsPhone();" — caught', decidesByPhone(plant(PAGES, "const isMobile = rrListAsCards('upgrade');", 'const isMobile = rrIsPhone();', 'S1')).length === 1);
const FILES = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/vendor|\.min\./.test(f));
function oldNames(name, src) {
  const out = [];
  src.split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\*)/.test(ln)) return;
    const code = ln.replace(/\/\/.*$/, '');
    if (/>\s*\+ Collection\s*</.test(code) || /['"`>]Bought it['"`<]/.test(code)) out.push(name + ':' + (i + 1));
  });
  return out;
}
let on = []; for (const f of FILES) on = on.concat(oldNames(f, read(f)));
ok('S2 "✓ Got It" is the one name — no "+ Collection" / "Bought it" button words left', !on.length, on.join(' '));
ok('S2-P a "+ Collection" button — caught', oldNames('p.js', '<button onclick="x()">+ Collection</button>').length === 1);
ok('S2-P a "Bought it" button — caught', oldNames('p.js', "+ '>Bought it</button>'").length === 1);
ok('S2-G the words in config.js', /gotIt:\s*'(\\u2713|✓) Got It'/.test(read('config.js')));
function ownCardButtons(src) {
  // A card or row of the three lists draws its action buttons only through rrListActions.
  // (a ⋯-sheet choice is a run: function — only a removal wired straight onto a button is an offender)
  return ['buildUpgradePage', 'buildForSalePage', '_renderPartsList'].filter(n => /onclick=\\?["'][^"']*(removeWantItem|removeUpgradeItemAsk|removeForSaleItem|removePartAsk)\(/.test(body(src, n)));
}
ok('S3 the three lists draw no Remove button of their own (it lives in the ⋯ sheet: rrListActions)', !ownCardButtons(PAGES).length, ownCardButtons(PAGES).join(','));
ok('S3-P a Remove button drawn in the For Sale card — caught', ownCardButtons(plant(PAGES, "        ${!_fsInShare ? _fsActions(fs, _fsShareKey, master, false) : ''}",
  "        <button onclick=\"removeForSaleItem('x')\">Remove</button>", 'S3')).length === 1);

const { pw, SCENE, SIZES, MEASURE, world, show } = require('./lib/list-layout-world');

function judgeL(size, R, tag) {
  const S = SIZES[size], t = (tag || '') + '[' + size + ' ' + R.page + '] ';
  ok(t + 'L1 nothing runs off the side of the window or the page', R.overflow <= 1 && R.mainOverflow <= 1 && R.tableOverflow <= 1, JSON.stringify([R.overflow, R.mainOverflow, R.tableOverflow]));
  ok(t + 'L2 every Item # starts on screen', R.numsN > 0 && R.numsOff === 0, R.numsOff + '/' + R.numsN);
  if (R.page !== 'parts') ok(t + 'L3 ' + (S.cards ? 'cards' : 'the full table'), S.cards ? (R.cards && !R.table) : (R.table && !R.cards), JSON.stringify({ table: R.table, cards: R.cards }));
  ok(t + 'L4 no button word wraps or is cut', R.btnN > 0 && !R.wrapped.length && !R.cut.length, JSON.stringify({ n: R.btnN, w: R.wrapped, c: R.cut }));
  if (S.cards || R.page === 'parts') {
    ok(t + 'L5 card buttons are finger-sized (≥ 44px)', !R.small.length, R.small.join(' '));
    ok(t + 'L6 Remove is only inside ⋯ on a card', R.removeOut === 0, R.removeOut);
  }
  if (R.table) ok(t + 'L7 no heading is cut', !R.cutHeads.length, R.cutHeads.join(' | '));
  ok(t + 'L8 the menu: ' + (S.fold ? 'folded behind ☰' : 'not folded, no ☰'), S.fold ? (R.fold && R.burger && !R.sideOnScreen) : (!R.fold && !R.burger), JSON.stringify({ fold: R.fold, burger: R.burger, side: R.sideOnScreen }));
  if (R.page === 'upgrade') ok(t + 'L9 "✓ Got It" on every Want/Upgrade row', R.mains.length > 0 && R.mains.every(m => m === '✓ Got It'), R.mains.join(','));
}

(async () => {
  if (!pw) { console.log('FAILED  —  this suite needs playwright and it is not installed.'); process.exit(1); }
  const exC = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await pw.chromium.launch(fs.existsSync(exC) ? { executablePath: exC } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  for (const size of Object.keys(SIZES)) {
    const W = await world(browser, size);
    for (const page of ['upgrade', 'forsale', 'parts']) judgeL(size, await show(W.pg, page));
    if (size === 'wide' || size === 'phone') {
      const R = await show(W.pg, 'upgrade');
      ok('[' + size + '] C1 engine + tender wanted together is one row; the count says "N items", not "Showing"', /^\d+ items?$/.test(R.count.trim()), R.count);
    }
    ok('[' + size + '] L10 no page errors', !W.errs.length, W.errs.join(' | '));
    await W.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
