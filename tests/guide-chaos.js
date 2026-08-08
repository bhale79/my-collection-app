// ══ tests/guide-chaos.js — ANY COMBO A USER MIGHT TRY ═════════════════════
//
// Brad: "we should be able to do any combo a user might try and either cancel
// out, back up, or move forward."
//
// guide-drive walks each guide the sensible way. guide-buttons presses each
// button in a sensible order. Neither of them does what a real person does,
// which is press things in an order nobody designed for: Next, Next, Back,
// do the thing, Back, Cancel, sidebar, Next again. Every bug Brad has found in
// this system so far came from the app and the guide getting out of step, and
// getting out of step is exactly what a disorderly sequence causes.
//
// So this one presses at random and only checks that the rules hold, whatever
// it pressed:
//
//   1. NO PAGE ERRORS. Ever, for any sequence.
//   2. NO CARD DESCRIBING A SCREEN THAT IS GONE — asked with the engine's own
//      rule, `needs` predicate included, after letting the guide settle.
//   3. NEVER STUCK. If a card is up, at least one of Next, Back or Cancel must
//      do something. A guide you cannot leave is the worst outcome there is.
//   4. CANCEL ALWAYS HANDS THE APP BACK. No leftover click-blocker, and the
//      sidebar still navigates afterwards.
//
// REPRODUCIBLE ON PURPOSE. The randomness comes from a seeded generator and
// every failure prints its seed and the exact key sequence, so a bug found at
// 4am can be replayed at will:  CHAOS_SEED=12345 node tests/guide-chaos.js
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the WORDS are right — only whether the screen is real
//   · anything that needs live Google data
//   · it presses; it does not look. Coverage and placement live in guide-cover.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, DRIVER } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-chaos needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
const ROOT_SEED = parseInt(process.env.CHAOS_SEED || '20260808', 10);
const RUNS_PER_GUIDE = parseInt(process.env.CHAOS_RUNS || '3', 10);
const MOVES = parseInt(process.env.CHAOS_MOVES || '9', 10);

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
// A seeded generator, so a failure found once can be replayed for ever.
window._chaosRng = function (seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};
// The things a person can actually do while a guide is up.
window._chaosMoves = ['next', 'next', 'back', 'act', 'act', 'cancel', 'sidebar', 'closewiz'];
window._chaosDo = async function (move, gid) {
  if (move === 'next')   { var n = document.getElementById('gt-next');   if (n) n.click(); return; }
  if (move === 'back')   { var b = document.getElementById('gt-back');   if (b) b.click(); return; }
  if (move === 'cancel') { var c = document.getElementById('gt-cancel') || document.getElementById('gt-exit'); if (c) c.click(); return; }
  if (move === 'act')    { await window._drvAct(gid); return; }
  if (move === 'closewiz') { try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {} return; }
  if (move === 'sidebar') {
    // Navigating away underneath a running guide is a thing people do, and it
    // is the cheapest way to pull the ground out from under a card.
    var links = [];
    document.querySelectorAll('.sidebar [onclick], .nav-item').forEach(function (n) {
      if (n.offsetParent !== null) links.push(n);
    });
    if (links.length) links[Math.floor(window._chaosPick() * links.length)].click();
    return;
  }
};
// Is the guide STUCK? A card is on screen; do any of its three buttons do
// anything at all? Measured by trying them, not by reading their styles.
window._chaosStuck = async function () {
  var c0 = window._drvCard();
  if (!c0) return false;                       // no card, nothing to be stuck in
  var n = document.getElementById('gt-next');
  if (n) { n.click(); await new Promise(r => setTimeout(r, 900));
           if (!window._drvCard() || window._drvCard().step !== c0.step) return false; }
  var b = document.getElementById('gt-back');
  if (b) { b.click(); await new Promise(r => setTimeout(r, 900));
           if (!window._drvCard() || window._drvCard().step !== c0.step) return false; }
  var x = document.getElementById('gt-cancel') || document.getElementById('gt-exit');
  if (x) { x.click(); await new Promise(r => setTimeout(r, 700));
           if (!window._drvCard()) return false; }
  return true;                                  // three buttons, nothing moved
};
window._chaosRun = async function (gid, seed, moves) {
  var rnd = window._chaosRng(seed);
  window._chaosPick = rnd;
  await window._drvReset();
  startGuide(gid);
  await new Promise(r => setTimeout(r, 1500));
  var seq = [], trouble = null;
  for (var k = 0; k < moves; k++) {
    if (!window._drvCard()) break;                       // tour is over
    var mv = window._chaosMoves[Math.floor(rnd() * window._chaosMoves.length)];
    seq.push(mv);
    await window._chaosDo(mv, gid);
    // Let the guide react. Its watchdog needs two 500ms ticks in the worst
    // case, and a step with a before() hook holds its redraw up to 900ms on
    // top — anything shorter measures a screen mid-change and invents faults.
    await new Promise(r => setTimeout(r, 2200));
    var card = window._drvCard();
    if (!card) { if (mv !== 'cancel') seq.push('(tour ended)'); break; }
    var bad = window._drvStranded(gid);
    if (bad && !trouble) { trouble = { kind: 'stranded', after: mv, at: k, detail: bad }; break; }
  }
  // Whatever state the mess left behind, the user must still be able to leave.
  var stuck = await window._chaosStuck();
  if (stuck && !trouble) trouble = { kind: 'stuck', at: seq.length, detail: window._drvCard() };
  var torn = null;
  if (window._drvCard()) {
    var x = document.getElementById('gt-cancel') || document.getElementById('gt-exit');
    if (x) x.click();
    await new Promise(r => setTimeout(r, 700));
  }
  torn = window._btnTornDownChaos();
  await window._drvReset();
  return { gid: gid, seed: seed, seq: seq, trouble: trouble, torn: torn };
};
window._btnTornDownChaos = function () {
  var left = ['gt-blocker', 'gt-hole', 'gt-callout'].filter(function (id) {
    return !!document.getElementById(id);
  });
  var mid = document.elementFromPoint(Math.round(window.innerWidth / 2),
                                      Math.round(window.innerHeight / 2));
  var onTour = false;
  try { onTour = !!(mid && mid.closest && mid.closest('#gt-blocker, #gt-callout, #gt-hole, #gt-mascot')); }
  catch (e) {}
  return { left: left, onTour: onTour };
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-chaos-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const bad = [];
  let runs = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1844, height: 914 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(DRIVER);
    await page.evaluate(KIT);
    await page.evaluate(() => window._clearOverlays());
    await page.waitForTimeout(400);

    const guides = await page.evaluate(() => Object.keys(GUIDES));
    ok('the real app boots with its guides loaded', guides.length > 0, String(guides.length));

    console.log('');
    console.log('  ── seed ' + ROOT_SEED + ', ' + RUNS_PER_GUIDE + ' random sequences per guide, ' +
                MOVES + ' presses each ──');

    let s = ROOT_SEED;
    for (const gid of guides) {
      for (let r = 0; r < RUNS_PER_GUIDE; r++) {
        s = (s * 1103515245 + 12345) >>> 0;
        // ── RE-SEED BEFORE EVERY SEQUENCE ─────────────────────────────────
        // The first version of this ran all 33 sequences against one page and
        // reported twelve stale cards. Most were its own fault: a random `act`
        // on the want-list guide presses "+ Collection", and a later one can
        // carry that through far enough to consume the fixture's ONLY want
        // item. The next sequence then finds no row, and the harness calls a
        // guide broken for describing a screen whose data a previous test had
        // eaten. A focused probe of the simplest failing sequence — one press
        // of Next — could not reproduce it on a fresh page, which is what gave
        // it away. Every sequence now starts from the same collection.
        await page.evaluate(SEED);
        await page.waitForTimeout(250);
        const out = await page.evaluate(a => window._chaosRun(a.gid, a.seed, a.moves),
                                        { gid, seed: s, moves: MOVES });
        runs++;
        const leftBehind = out.torn && (out.torn.left.length > 0 || out.torn.onTour);
        if (out.trouble || leftBehind) bad.push({ ...out, leftBehind });
      }
    }

    console.log('  ── ' + runs + ' sequences run, ' + bad.length + ' in trouble ──');
    console.log('');
    for (const b of bad) {
      console.log('     ' + b.gid + '  seed ' + b.seed);
      console.log('       presses: ' + b.seq.join(' → '));
      if (b.trouble) console.log('       ' + b.trouble.kind + ' after "' + b.trouble.after +
                                 '" (press ' + (b.trouble.at + 1) + '): ' + JSON.stringify(b.trouble.detail));
      if (b.leftBehind) console.log('       left behind after Cancel: ' + JSON.stringify(b.torn));
      console.log('       replay: CHAOS_SEED=' + ROOT_SEED + ' node tests/guide-chaos.js');
      console.log('');
    }

    const stranded = bad.filter(b => b.trouble && b.trouble.kind === 'stranded');
    const stuck = bad.filter(b => b.trouble && b.trouble.kind === 'stuck');
    const dirty = bad.filter(b => b.leftBehind);

    ok('the sequences actually ran', runs >= guides.length, String(runs));
    ok('BRAD\'S ASK: no random sequence ever leaves you stuck in a guide',
       stuck.length === 0, stuck.slice(0, 4).map(b => b.gid + ' seed ' + b.seed).join(' | '));
    ok('…and no random sequence leaves a card describing a screen that is gone',
       stranded.length === 0, stranded.slice(0, 4).map(b => b.gid + ' seed ' + b.seed).join(' | '));
    ok('…and Cancel still hands the app back however you got there',
       dirty.length === 0, dirty.slice(0, 4).map(b => b.gid + ' seed ' + b.seed).join(' | '));
    ok('pressing things at random raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));

    fs.writeFileSync(path.join(dir, 'chaos.json'), JSON.stringify(bad, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
