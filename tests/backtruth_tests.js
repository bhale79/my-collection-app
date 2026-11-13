#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// BACKTRUTH — 2026-11-11 (real Chromium, the REAL app at phone size)
//
// Hand-tests on Brad's Android phone, 2026-11-10/11:
//   T-2026-11-08-03 FAILED: set page → Back → My Sets → Back AGAIN closed the
//     app. Confirmed 2026-11-11 on an ordinary item page: Back, Back with no
//     tap between = the app closed; one touch between = fine.
//   T-2026-11-08-06 FAILED: after Record Sale, ONE Back landed on the sold
//     car's page, still "In Collection".
//
// Cause 1 — Chrome's "history manipulation intervention": a history step ADDED
// without a touch on the page marks every step of the app as skippable. The
// app added a step while answering every Back press. NO AUTOMATIC TEST CAN SEE
// THE CLOSE ITSELF (a scripted history.back() is not the real Back button —
// that is why every suite was green); what CAN be measured is the cause: after
// a Back press the app must not have added a step. Chromium's Navigation API
// gives the exact step the page is on (navigation.currentEntry.index).
// Cause 2 — the app kept its own visit list, holding an item page only as the
// word "itemdetail"; Back onto it showed whichever item was drawn last.
//
//   A  a Back press goes DOWN one step and adds none: item page → list →
//      Dashboard → the floor ("Press back again to exit")
//   B  My Sets: set page → Back → My Sets → Back → My Collection, no step added
//   C  each item-page step shows ITS item; a copy that left the collection
//      (sold / removed) is passed over — the T-2026-11-08-06 walk
//   D  a pop-up re-opened by its own Back handler (the Add window stepping
//      back) takes back the step it had: same step before and after
//   E  the Dashboard: Back = the toast, down on the floor; a touch = back up
//      one step, so the next Back asks again
//   F  a pop-up opened with no touch since a Back gets no step; Back closes it
//      and the page keeps its step
//   G  a reload inside a session: start-up adds nothing above the old steps
//   S  source: no history step is added anywhere in app/ but back-stack.js,
//      and none inside its Back handler; the visit list is gone
//   P  PLANTED offenders — each must turn its check red
// The independent review's findings (H–K, the Safari engine, P8–P13) are in
// tests/backtruth_review_tests.js; the walks both share are in tests/lib/.
// ══════════════════════════════════════════════════════════════════════════
const L = require('./lib/backtruth-walks.js');
const { fs, path, APP, rd, webkit, launch, open, at, back, sleep, walkA, walkB, walkC, walkD, walkE, walkFG, walkH, walkI, walkJ, walkK, code, scanAdds, scanTrail, appFiles, popBody, appPopBody, plant } = L;
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}
(async () => {
  const browser = await launch();
  try {
    const BS = rd('back-stack.js'), APPJS = rd('app.js'), WZ = rd('wizard.js');

    // ── A ────────────────────────────────────────────────────────────────
    const A = await walkA(browser);
    T('A1 the item page sits one step above the list', [A.item.active, A.item.idx - A.list.idx, A.item.page], ['itemdetail', 1, 'itemdetail']);
    T('A2 Back → the list, exactly one step down (no step added)', [A.b1.active, A.b1.idx - A.item.idx, A.b1.page], ['browse', -1, 'browse']);
    T('A3 Back again, no touch between → the Dashboard, one more step down', [A.b2.active, A.b2.idx - A.b1.idx, A.b2.page], ['dashboard', -1, 'dashboard']);
    T('A4 Back on the Dashboard → the floor, and "Press back again to exit"', [A.b3.active, A.b3.page, A.b3.d, A.toasts.filter(t => /back again to exit/i.test(t)).length], ['dashboard', 'base', 0, 1]);
    T('A5 the app knows no touch came since the Back', A.b2.noTouch, true);
    T('no page errors (A)', A.errs, []);

    // ── B ────────────────────────────────────────────────────────────────
    const B = await walkB(browser);
    T('B1 the set page is open from My Sets', [B.page.active, /1467W/.test(B.page.item)], ['itemdetail', true]);
    T('B2 Back → My Sets, on My Sets\' own old step (one down, its Back entry held again)', [B.b1.active, B.b1.sets, B.b1.idx - B.page.idx, B.b1.back, B.b1.stack], ['browse', true, -1, 'my-sets-list', 1]);
    T('B3 Back again → My Collection (T-2026-11-08-03), one more step down', [B.b2.active, B.b2.tab, B.b2.sets, B.b2.idx - B.b1.idx, B.b2.stack], ['browse', 'items', false, -1, 0]);
    T('no page errors (B)', B.errs, []);

    // ── C ────────────────────────────────────────────────────────────────
    const C = await walkC(browser);
    T('C1 Back → the last item page visited, showing ITS item', C.back1, ['itemdetail', '6464-1']);
    T('C2 Back → the list', C.back2, ['browse']);
    T('C3 Back → the EARLIER item page, showing its own item (not the one drawn last)', C.back3, ['itemdetail', '2343']);
    T('C4 after a sale ONE Back does not land on the sold car (T-2026-11-08-06)', [C.sold.from, C.sold.onSoldCar, C.sold.to !== 'itemdetail' || !C.sold.onSoldCar], ['browse', false, true]);
    T('no page errors (C)', C.errs, []);

    // ── D ────────────────────────────────────────────────────────────────
    const D = await walkD(browser);
    T('D1 the Add window is open with ONE step of its own', [D.w0.open, D.w0.stack >= 1, D.w0.back], [true, true, 'wizard']);
    T('D2 Back steps it back one step, still open, on the SAME history step', [D.w1.open, D.w0.step - D.w1.step >= 1, D.w1.idx - D.w0.idx, D.w1.back], [true, true, 0, 'wizard']);
    T('D3 Back again on its first step (no touch) closes it: exactly ONE step down, nothing held', [D.w1.step, D.w2.open, D.w2.idx - D.w0.idx, D.w2.stack, D.closed.active], [0, false, -1, 0, 'browse']);
    const D2 = await walkD(browser, null, true);
    T('D4 stepped back once, then closed the ordinary way: the page is on its own step, nothing left behind', [D2.w1.open, D2.closed.active, D2.closed.page, D2.closed.back, D2.closed.stack, D2.closed.idx - D2.w0.idx], [true, 'browse', 'browse', '', 0, -1]);
    T('no page errors (D)', D.errs.concat(D2.errs), []);

    // ── E ────────────────────────────────────────────────────────────────
    const E = await walkE(browser);
    T('E1 Back on the Dashboard: the toast, and down on the floor', [E.b1.active, E.b1.page, E.toast1], ['dashboard', 'base', 1]);
    T('E2 a touch instead of a second Back: one step up off the floor, labelled Dashboard', [E.touched.page, E.touched.idx - E.b1.idx, E.touched.active], ['dashboard', 1, 'dashboard']);
    T('E3 the next Back asks again (never leaves without a word)', [E.b2.page, E.toast2], ['base', 2]);
    T('no page errors (E)', E.errs, []);

    // ── F, G ─────────────────────────────────────────────────────────────
    const F = await walkFG(browser);
    T('F1 a pop-up opened with no touch since a Back adds no step', [F.sameStep, F.opened.stack], [true, 1]);
    T('F2 Back closes it and the list keeps its step', [F.afterBack.closed, F.afterBack.active, F.afterBack.stack, F.afterBack.idx - F.listIdx], [1, 'browse', 0, 0]);
    T('G1 start-up after a reload inside a session adds nothing above the old steps', F.seed, { sameIdx: true, sameLen: true, page: 'dashboard', d: 2, thisLoad: true });
    T('no page errors (F, G)', F.errs, []);

    // ── S ────────────────────────────────────────────────────────────────
    T('S1 a history step is ADDED in ONE file only (back-stack.js)', scanAdds(appFiles()).map(x => x.split(':')[0]), ['back-stack.js']);
    T('S2 back-stack.js\'s Back handler adds no step', [popBody(BS).length > 200, /pushState/.test(code(popBody(BS)))], [true, false]);
    T('S3 app.js\'s Back handler adds no step', [appPopBody(APPJS).length > 500, /pushState/.test(code(appPopBody(APPJS)))], [true, false]);
    T('S4 the visit list is gone (no second record of where the person has been)', scanTrail(appFiles()), []);
    T('S5 the three item-page openers name their item for the history step', [
      (code(rd('app-collection.js')).match(/rrNavItem\(\{ k: '(item|non)'/g) || []).length, (code(rd('app-pages.js')).match(/rrNavItem\(\{ k: 'sold'/g) || []).length], [2, 1]);
    T('S6 an item is restored by Inventory ID or the catalog row itself, never a position', [/_openOwnedByInvId\(inv\)/.test(APPJS), /findMaster\(r\.row\.itemNum, r\.row\.variation, r\.row\)/.test(APPJS)], [true, true]);

    // ── P — planted offenders ────────────────────────────────────────────
    // P1 a step added while answering a Back press (the old way)
    const addOnBack = plant(APPJS, 'if (shown) { _hops = 0; return; }', "if (shown) { _hops = 0; history.pushState({ rr: 1, appPage: dest, item: 0, d: 1 }, '', ''); return; }", 'a step added on Back');
    const P1 = await walkA(browser, { 'app.js': addOnBack });
    T('P1 a step added while answering Back is caught (A2 red)', P1.b1.idx - P1.item.idx === -1, false);
    T('P1b …and by the source guards (S1, S3)', [scanAdds(appFiles({ 'app.js': addOnBack })).map(x => x.split(':')[0]).join(), /pushState/.test(code(appPopBody(addOnBack)))], ['app.js,back-stack.js', true]);
    // P2 the item page shown as it was left (the old visit list's way)
    const asLeft = plant(APPJS, "    var r = _rrNavItems[st.item];\n    if (!r) return false;", "    var r = _rrNavItems[st.item];\n    if (r) { _rrGoBackTo('itemdetail'); return true; }\n    if (!r) return false;", 'the page as it was left');
    const P2 = await walkC(browser, { 'app.js': asLeft });
    T('P2 the sold car coming back is caught (C4 red)', P2.sold.onSoldCar, true);
    T('P2b …and an item step showing the item drawn last (C3 red)', JSON.stringify(P2.back3) === JSON.stringify(['itemdetail', '2343']), false);
    // P3 a re-opened pop-up that does not take its step back
    const noRearm = plant(BS, '      if (_fwdRoom() > 0) _queueFwd();\n      else if (_rearmed', '      if (false) _queueFwd();\n      else if (false && _rearmed', 'no walk forward');
    const P3 = await walkD(browser, { 'back-stack.js': noRearm });
    T('P3 the Add window losing its step is caught (D2 red)', P3.w1.idx - P3.w0.idx === 0, false);
    const P3f = await walkFG(browser, { 'back-stack.js': noRearm });
    T('P3b …and a step-less pop-up costing the page its step (F2 red)', P3f.afterBack.idx - P3f.listIdx === 0, false);
    // P4 no way back up off the floor
    const noHold = plant(BS, '    _floorHold = true;\n', '', 'no floor hold');
    const P4 = await walkE(browser, { 'back-stack.js': noHold });
    T('P4 a touch that leaves the app sitting on the floor is caught (E2 red)', P4.touched.page === 'dashboard' && P4.touched.idx - P4.b1.idx === 1, false);
    // P5 a pop-up given a step with no touch since a Back
    const stepAnyway = plant(BS, "    } else if (_noTouch && !(_ours(cur) && cur.appPage === 'base')) {", '    } else if (false) {', 'a step with no touch');
    const P5 = await walkFG(browser, { 'back-stack.js': stepAnyway });
    T('P5 a pop-up adding a step with no touch since a Back is caught (F1 red)', P5.sameStep, false);
    // P6 the Add window adding a step per step again
    const stepPush = plant(WZ, "  // 2026-11-11 (backtruth): no history step per wizard step any more.", "  history.pushState({ appPage: 'wizard', step: wizard.step }, '', '');\n  // 2026-11-11 (backtruth): no history step per wizard step any more.", 'a step per wizard step');
    T('P6 the Add window adding its own steps is caught (S1 red)', scanAdds(appFiles({ 'wizard.js': stepPush })).map(x => x.split(':')[0]).join(), 'back-stack.js,wizard.js');
    // P7 the visit list coming back
    T('P7 a visit list written again is caught (S4 red)', scanTrail(appFiles({ 'wizard.js': WZ + '\nwindow._rrPageTrail = [];\n' })), ['wizard.js']);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  backtruth_tests threw: ' + (e && e.stack || e)); process.exit(1); });
