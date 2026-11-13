#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// BACKTRUTH, part 2 — what the independent review found (2026-11-11)
// Real Chromium AND the Safari engine, the REAL app at phone size.
//
//   H  the item under a pop-up changes ("Which copy?" → the other copy): the
//      page's own step is re-labelled, so Back later shows the copy LAST shown
//      (review F2); a pop-up registered twice has ONE history step
//   I  the exit hold on the Dashboard: the start of a swipe, a held Alt key
//      and the app's own el.click() do NOT lift it (F1, F4); it runs out by
//      itself (F5); a finished tap lifts it
//   J  Back restores every kind of item page — a catalog row with no copy, the
//      Want side, a set, a sale record — and passes over one whose record is
//      gone without losing track of what is on screen (F6)
//   K  pop-ups: no step + its own button; registered twice; opened on the
//      floor; a walk forward with nowhere to go is never asked for (F3); the
//      Add window closed on the page it was opened from (v0.9.1191)
//   W  the Safari engine runs the walks too
//      (not installed on this machine → 5 SKIPPED on the scoreboard, not a red)
//   P  PLANTED offenders P8–P13 — each must turn its check red
// ══════════════════════════════════════════════════════════════════════════
const L = require('./lib/backtruth-walks.js');
const { fs, path, APP, rd, webkit, launch, open, at, back, sleep, walkA, walkB, walkC, walkD, walkE, walkFG, walkH, walkI, walkJ, walkK, code, scanAdds, scanTrail, appFiles, popBody, appPopBody, plant } = L;
let pass = 0, fail = 0, skipped = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}
(async () => {
  const browser = await launch();
  try {
    const BS = rd('back-stack.js');
    // ── H ── (review 2026-11-11, F2) ─────────────────────────────────────
    const H = await walkH(browser);
    T('H1 "Which copy?" is ONE step above the item page (registered twice, one step)', [H.picker.back, H.picker.idx - H.item.idx, H.picker.stack], ['rr-copy-picker', 1, 1]);
    T('H2 the other copy picked: back on the item page\'s OWN step, showing that copy', [H.picked.idx - H.item.idx, H.picked.back, H.pickedInv, H.picked.stack], [0, '', '102', 0]);
    T('H3 list, then Back → the copy LAST shown, not the one the page opened with', H.back, ['itemdetail', '102', true]);
    T('H4 the same when the pop-up is closed by its own code and another item is drawn', H.back2, ['itemdetail', true]);
    T('no page errors (H)', H.errs, []);

    // ── I ── (review F1, F4, F5) ──────────────────────────────────────────
    const I = await walkI(browser);
    T('I1 on the floor after the toast', I.floor, ['base', 0]);
    T('I2 the start of a swipe (finger down, moved, taken over) does NOT lift the exit hold', I.swipe, ['base', 0]);
    T('I3 nor does a held Alt key (Alt+Left is a Back press)', I.alt, ['base', 0]);
    T('I4 the app\'s own el.click() does not lift it either, and is not counted as a touch at all', I.untrusted, ['base', 0, true]);
    T('I5 no second Back in time: the app steps back up by itself, and adds no step', I.timeout, ['dashboard', 1, 'dashboard', 0]);
    T('I6 …so a later Back asks again instead of leaving without a word', I.again, ['base', 2]);
    T('I7 a finished tap lifts the hold: one step up', I.tap, ['dashboard', 1]);
    T('no page errors (I)', I.errs, []);

    // ── J ────────────────────────────────────────────────────────────────
    const J = await walkJ(browser);
    T('J1 Back restores a catalog page with no copy (the row itself)', J.row, ['itemdetail', true]);
    T('J2 …the same row from the Want side, AS the Want page ("Wanted: 3356")', J.want, ['itemdetail', true]);
    T('J3 …a set page', J.set, ['itemdetail', true]);
    T('J4 …a sale record', J.sold, ['itemdetail', true]);
    T('J5 a step whose record is gone is passed over; "the item on screen" is not left pointing at it (F6)', J.gone, [true, true]);
    T('no page errors (J)', J.errs, []);

    // ── K ────────────────────────────────────────────────────────────────
    const K = await walkK(browser);
    T('K1 a pop-up with no step of its own, closed by its own button: the page keeps its step', K.own0, [0, 0, 'browse']);
    T('K2 a pop-up registered twice has ONE step, and closing it leaves none behind', K.twice, [1, 1, 0, 0, '']);
    T('K3 a pop-up opened on the floor, a tap, Back at once: it closes, and the app is not left on the floor (F3)', K.floorPop, ['base', 1, 0, true]);
    T('K5 a walk forward with nowhere to go is never asked for: the next Back is the person\'s, and closes the pop-up (F3)', K.blind, [1, 0]);
    T('K4 the Add window opened and closed on another page: still that page, on its own step (v0.9.1191)', K.wizFrom, ['prefs', 'prefs', 'prefs', 0, 0]);
    T('no page errors (K)', K.errs, []);

    // ── W — the Safari engine runs the same walks ─────────────────────────
    // LEDGER 2026-11-13 (nightly red on v0.9.2146): a machine WITHOUT the Safari
    // engine (the nightly's sandbox has Chromium only) used to fail W0, so the
    // suite could never be green there. Not installed → the five W walks are
    // counted as SKIPPED on the scoreboard (visible, not silent — the way
    // import_core_tests shows its fixture pins). Installed but will not start
    // is still a FAIL. tests/safari-walk.js (browser tier) stays the strict one.
    let wk = null, wkHere = false;
    try { wkHere = fs.existsSync(webkit.executablePath()); } catch (e) { wkHere = false; }
    if (!wkHere) { skipped = 5; console.log('NOTE  the Safari engine (WebKit) is not installed on this machine — W1–W5 did not run.'); }
    else { try { wk = await webkit.launch(); } catch (e) { T('W0 the Safari engine starts', String(e && e.message || e).split('\n')[0], 'started'); } }
    if (wk) {
      try {
        const WA = await walkA(wk);
        T('W1 (Safari engine) Back, Back, Back: list, Dashboard, the floor — one step each, none added', [WA.b1.active, WA.b1.idx - WA.item.idx, WA.b2.active, WA.b2.idx - WA.b1.idx, WA.b3.page, WA.errs.length], ['browse', -1, 'dashboard', -1, 'base', 0]);
        const WC = await walkC(wk);
        T('W2 (Safari engine) each item step shows its own item; the sold car is passed over', [WC.back1, WC.back3, WC.sold.onSoldCar, WC.errs.length], [['itemdetail', '6464-1'], ['itemdetail', '2343'], false, 0]);
        const WD = await walkD(wk);
        T('W3 (Safari engine) the Add window keeps its step on Back, then closes one step down', [WD.w1.open, WD.w1.idx - WD.w0.idx, WD.w2.open, WD.w2.idx - WD.w0.idx, WD.errs.length], [true, 0, false, -1, 0]);
        const WE = await walkE(wk);
        T('W4 (Safari engine) the exit: the floor, a tap steps up, the next Back asks again', [WE.b1.page, WE.touched.page, WE.touched.idx - WE.b1.idx, WE.b2.page, WE.toast2, WE.errs.length], ['base', 'dashboard', 1, 'base', 2, 0]);
        const WH = await walkH(wk);
        T('W5 (Safari engine) the copy picked last is the one Back shows', [WH.back, WH.back2, WH.errs.length], [['itemdetail', '102', true], ['itemdetail', true], 0]);
      } finally { await wk.close(); }
    }

    // ── P — planted offenders ────────────────────────────────────────────
    // P8 the start of a swipe lifting the exit hold (review F1)
    const anyTouch = plant(BS, "    if (!_floorHold || !e || !_TAP[e.type]) return;", "    if (!_floorHold || !e) return;", 'any touch lifts the hold');
    const P8 = await walkI(browser, { 'back-stack.js': anyTouch });
    T('P8 a swipe\'s first touch lifting the exit hold is caught (I2 red)', JSON.stringify(P8.swipe) === JSON.stringify(['base', 0]), false);
    // P9 the app's own click counted as a touch (review F4)
    const anyClick = plant(BS, "    if (e && e.isTrusted === false) return;", "", 'untrusted clicks count');
    const P9 = await walkI(browser, { 'back-stack.js': anyClick });
    T('P9 the app\'s own click counted as a touch is caught (I4 red)', JSON.stringify(P9.untrusted) === JSON.stringify(['base', 0, true]), false);
    // P10 no way off the floor by time (review F5)
    const noTimer = plant(BS, "    _exitTimer = setTimeout(_offFloorByTime, CFG.exitMs);\n", "", 'no exit timer');
    const P10 = await walkI(browser, { 'back-stack.js': noTimer });
    T('P10 an exit that never times out is caught (I5 red)', P10.timeout[0] === 'dashboard', false);
    // P11 the page's step not re-labelled when its item changed under a pop-up (review F2)
    const noOwe = plant(BS, "      if (samePage) { _pageOwed = newItem ? c : null; return; }", "      if (samePage) { return; }", 'no re-label under a pop-up');
    const P11 = await walkH(browser, { 'back-stack.js': noOwe });
    T('P11 the first copy coming back is caught (H3 red)', P11.back[1] === '102', false);
    // P12 a pop-up registered twice given two steps
    const twoSteps = plant(BS, "        _stack.push({ id: id, closeFn: closeFn, own: was.own });\n        _log('push', id, '(already open — its step is kept)');\n        return;", "        break;", 'two steps for one pop-up');
    const P12 = await walkK(browser, { 'back-stack.js': twoSteps });
    T('P12 two steps for one pop-up is caught (K2 red)', P12.twice[0] === 1 && P12.twice[2] === 0, false);
    // P13 a walk forward asked for with nowhere to go (review F3)
    const blindFwd = plant(BS, "    else { var room = _fwdRoom(); if (-n > room) n = -room; }", "", 'a blind walk forward');
    const P13 = await walkK(browser, { 'back-stack.js': blindFwd });
    T('P13 a walk forward onto nothing swallowing the next real Back is caught (K5 red)', P13.blind[0] === 1, false);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed' + (skipped ? '  —  ' + skipped + ' SKIPPED: the Safari engine (WebKit) is not installed on this machine (W1–W5)' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  backtruth_review_tests threw: ' + (e && e.stack || e)); process.exit(1); });
