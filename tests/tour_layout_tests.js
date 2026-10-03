#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR LAYOUT — v0.9.1869   (real Chromium, the REAL app, no stubs)
//
// Brad walked all eighteen tour cards with screenshots (2026-10-03) and gave
// 23 findings. Most were the same fault: the card "should be twice this size",
// "should be under the highlighted section", "should be next to the panel",
// "should be in the middle" — and every one of those cards had been pushed
// into a corner by a placement rule written for the Add-item guide, where the
// user must PRESS things while the card is up. On a tour card nothing behind
// the card is pressable (the click blocker is up), so dodging buttons only
// dragged the card away from the thing it was about.
//
// THE RULES THIS FILE HOLDS (the counter and the lit-tab pixel read are in
// tests/tour_count_tests.js; both run on tests/lib/tour-harness.js):
//   · a card that only TELLS you something is a READING card: twice the width,
//     reading type, sits against its ring, never dodges; openers and closers
//     sit dead centre;
//   · a card that WAITS for you (the Add-item guide) is a WORKING card and is
//     exactly what it was — compact, parked in a corner, dodging controls;
//   · every page card rings the page's own TAB in the menu, on the right item;
//   · the cards that show the Photo Inbox, the Dispatch Board, Contacts, the
//     Contact box, the Help Center, the Report box and the name menu really
//     open them, and whatever a card opened is closed on the next card and on
//     Cancel.
// Each rule has a PLANTED version of the old behaviour, served in place of the
// real tutorial.js, to prove the pin can fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_layout_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');
const { openApp, walkTour, overlaps, gapBetween, near } = H;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function planted(name, from, to) {
  const src = H.plantedSource(from, to);
  if (!src) T('PLANTED ' + name + ': the anchor to cut is in tutorial.js', false, from.slice(0, 80));
  return src;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ═══ A · READING CARDS on Brad's own window size, with a collection ═══════
  console.log('== A · a tour card is a reading card: big, against its ring, never in a corner (1844x914, with items) ==');
  let { pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true });
  const full = await walkTour(pg);
  const fullErrs = errs.slice();
  const ended = await pg.evaluate(() => !document.getElementById('gt-callout'));
  await pg.close();
  T('A1  the tour runs to the end and closes', ended && full.length >= 20, { n: full.length, last: full[full.length - 1] && full[full.length - 1].title });
  T('A2  every card is a reading card (no tour step waits for the user)', full.every(c => c.mode === 'reading'), full.filter(c => c.mode !== 'reading').map(c => c.title));
  const bigEnough = c => c.card[2] >= 560 || (c.hole && c.hole[3] > c.vh * 0.5 && c.card[2] >= 440);   // beside a ring taller than half the window the card takes the width that fits, never under 440 here
  T('A3  every card is the big size — at least 560px wide (was 330); beside a box taller than half the window it takes the width that fits, at least 440', full.every(bigEnough), full.filter(c => !bigEnough(c)).map(c => [c.title, c.card, c.hole]));
  T('A4  …set in reading type: 16px words, 18px title', full.every(c => near(c.bodyPx, 16, 0.6) && near(c.titlePx, 18.4, 0.8)), full.slice(0, 3).map(c => [c.bodyPx, c.titlePx]));
  const ringed = full.filter(c => c.hole);
  T('A5  no ringed card sits on its ring', ringed.every(c => !overlaps(c.card, c.hole, 2)), ringed.filter(c => overlaps(c.card, c.hole, 2)).map(c => [c.title, c.card, c.hole]));
  T('A6  every ringed card is AGAINST its ring (gap of 24px or less), not off in a corner', ringed.every(c => gapBetween(c.card, c.hole) <= 24), ringed.filter(c => gapBetween(c.card, c.hole) > 24).map(c => [c.title, gapBetween(c.card, c.hole)]));
  const first = full[0], last = full[full.length - 1];
  const centred = c => c && !c.hole && near(c.card[0] + c.card[2] / 2, c.vw / 2, 40) && near(c.card[1] + c.card[3] / 2, c.vh / 2, 60);
  T('A7  the opener "Let\'s go through your dashboard" is card 1 and sits in the middle of the screen', first && /go through your dashboard/i.test(first.title) && centred(first), first && [first.title, first.card]);
  T('A8  "That\'s the tour" is the last card and sits in the middle too', last && /That.s the tour/.test(last.title) && centred(last), last && [last.title, last.card]);
  const areas = full[1];
  T('A9  "Your main areas" is card 2, rings the menu, and the card stands beside it (to its right, level with its top)',
    areas && areas.title === 'Your main areas' && areas.hole && areas.card[0] >= areas.hole[0] + areas.hole[2] - 2 && areas.card[0] <= areas.hole[0] + areas.hole[2] + 40 && near(areas.card[1], areas.hole[1], 40), areas && [areas.title, areas.card, areas.hole]);
  const coll = full.find(c => c.title === 'My Collection');
  T('A10 the My Collection card sits UNDER the ringed search bar, left-aligned with it', coll && coll.hole && coll.card[1] >= coll.hole[1] + coll.hole[3] - 2 && coll.card[1] <= coll.hole[1] + coll.hole[3] + 30 && near(coll.card[0], coll.hole[0], 40), coll && [coll.card, coll.hole]);
  const tools = full.find(c => c.title === 'Collection Tools');
  T('A11 the Collection Tools ring covers the whole tools area, both rows (taller than 400px)', tools && tools.hole && tools.hole[3] >= 400, tools && tools.hole);

  // ═══ B · THE SECOND RING on the page's tab ═══════════════════════════════
  console.log('\n== B · every page card rings its own tab in the menu (that the tab is LIT is measured in tour_count_tests) ==');
  const pageCards = full.filter(c => c.tabRect);
  T('B1  the page cards name a tab and the tab is on screen (at least 14 of them)', pageCards.length >= 14, pageCards.length);
  T('B2  each of those shows the second ring, and it sits on that tab', pageCards.every(c => c.hole2 && overlaps(c.hole2, c.tabRect, 0) && near(c.hole2[0], c.tabRect[0], 10) && near(c.hole2[1], c.tabRect[1], 10)), pageCards.filter(c => !(c.hole2 && overlaps(c.hole2, c.tabRect, 0))).map(c => [c.title, c.hole2, c.tabRect]));
  ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true }));
  const rightTab = await pg.evaluate(() => {   // measured from the live menu: each of those steps' tab selector resolves to the item whose label is the card's title
    const steps = GUIDES.tour.steps; const txt = el => el.textContent.replace(/[\d—]+$/, '').replace(/\s+/g, ' ').trim();
    return ['My Collection', 'Want / Upgrade', 'For Sale', 'Parts Needed', 'Master Catalog', 'Collection Tools', 'Reports', 'Sold Items', 'Preferences'].map(t => {
      const s = steps.find(x => x.title === t || x.title === 'The ' + t); if (!s || !s.tab) return [t, 'no tab'];
      const el = Array.from(document.querySelectorAll(s.tab)).find(e => e.offsetParent !== null); return [t, el ? txt(el) : 'not on screen'];
    });
  });
  await pg.close();
  T('B3  the second ring sits on the RIGHT tab: each page card\'s tab is the menu item carrying that page\'s name', rightTab.every(([t, label]) => label.indexOf(t) === 0), rightTab);
  T('B4  the opener and the closer show no second ring, and "Your main areas" (which rings the whole menu) shows none either', !first.hole2 && !last.hole2 && !areas.hole2, [first.hole2, last.hole2, areas.hole2]);

  // ═══ C · THE CARDS THAT OPEN REAL THINGS ═════════════════════════════════
  console.log('\n== C · the Photo Inbox, Dispatch Board, Contacts, Contact, Help Center, Report box and name menu really open — and close again ==');
  const byTitle = t => full.find(c => c.title === t);
  T('C1  The Photo Inbox card is ON the Photo Inbox page, ringing the photo area', byTitle('The Photo Inbox') && byTitle('The Photo Inbox').page === 'page-photo-inbox' && !!byTitle('The Photo Inbox').hole, byTitle('The Photo Inbox'));
  T('C2  The Dispatch Board card is ON the Dispatch Board, ringing the board', byTitle('The Dispatch Board') && byTitle('The Dispatch Board').page === 'page-dispatch' && !!byTitle('The Dispatch Board').hole, byTitle('The Dispatch Board'));
  T('C3  the Contacts card is ON the Contacts page', byTitle('Contacts') && byTitle('Contacts').page === 'page-contacts' && !!byTitle('Contacts').hole, byTitle('Contacts'));
  T('C4  the Contact card has the Contact box open and ringed', byTitle('Contact') && byTitle('Contact').open.contact && !!byTitle('Contact').hole, byTitle('Contact'));
  T('C5  the Need Help? card has the real Help Center open, ringed, and sitting UNDER the tour\'s layers (z below 99990)', byTitle('Need Help?') && byTitle('Need Help?').open.hub && byTitle('Need Help?').open.hubZ < 99990 && !!byTitle('Need Help?').hole, byTitle('Need Help?'));
  T('C6  the Report a problem card has the Report box open and ringed', byTitle('Report a problem') && byTitle('Report a problem').open.err && !!byTitle('Report a problem').hole, byTitle('Report a problem'));
  const nm = byTitle('Under your name');
  T('C7  the name-menu card has the menu open and ringed, and lists what is really in it — Dispatch Board, Contacts, Preferences, Help, Report a problem, Sign Out — and never Yardmaster',
    nm && nm.open.menu && !!nm.hole && ['Dispatch Board', 'Contacts', 'Preferences', 'Help', 'Report a problem', 'Sign Out'].every(s => nm.body.indexOf(s) >= 0) && !/yardmaster/i.test(nm.body), nm && nm.body);
  const openAt = c => c ? Object.keys(c.open).filter(k => k !== 'hubZ' && c.open[k]) : null;
  const afterEach = ['Contact', 'Need Help?', 'Report a problem', 'Under your name'].map(t => { const k = full.findIndex(c => c.title === t); return k >= 0 ? [t, openAt(full[k + 1])] : [t, 'missing']; });
  T('C8  each of those is closed again on the very next card (only the next card\'s own thing may be open)',
    afterEach.every(([t, o]) => Array.isArray(o) && o.length <= 1 && !(t === 'Under your name' && o.indexOf('menu') >= 0) && !(t === 'Contact' && o.indexOf('contact') >= 0) && !(t === 'Need Help?' && o.indexOf('hub') >= 0) && !(t === 'Report a problem' && o.indexOf('err') >= 0)), afterEach);
  T('C9  the large-panel card names the panel that is really there and says Edit Dashboard changes it; no card still claims a header tap switches the list',
    byTitle('The large panels') && /This one happens to be/.test(byTitle('The large panels').body) && /Recent Additions/.test(byTitle('The large panels').body) && /Edit Dashboard/.test(byTitle('The large panels').body) && !full.some(c => /switch it to a different list/.test(c.body)), byTitle('The large panels') && byTitle('The large panels').body);
  // Cancel in the middle of the Help card: the Help Center goes with the tour
  ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true }));
  await walkTour(pg, 'Need Help?', true);
  const afterCancel = await pg.evaluate(async () => { document.getElementById('gt-cancel').click(); await new Promise(r => setTimeout(r, 300)); return { hub: !!document.getElementById('help-hub-modal'), callout: !!document.getElementById('gt-callout') }; });
  await pg.close();
  T('C10 Cancel on the Need Help? card closes the Help Center along with the tour', !afterCancel.hub && !afterCancel.callout, afterCancel);
  ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true }));
  await walkTour(pg, 'Under your name', true);
  const afterCancel2 = await pg.evaluate(async () => { document.getElementById('gt-cancel').click(); await new Promise(r => setTimeout(r, 300)); return { menu: document.getElementById('account-menu').style.display !== 'none', callout: !!document.getElementById('gt-callout') }; });
  await pg.close();
  T('C11 Cancel on the name-menu card closes the menu along with the tour', !afterCancel2.menu && !afterCancel2.callout, afterCancel2);
  // PLANTED: an engine that does not call the guide's close — Cancel leaves the Help Center open
  const srcC = planted('C', "if (_g && typeof _g.close === 'function') _g.close();", '');
  if (srcC) {
    ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true, tutorial: srcC }));
    await walkTour(pg, 'Need Help?', true);
    const leftOpen = await pg.evaluate(async () => { document.getElementById('gt-cancel').click(); await new Promise(r => setTimeout(r, 300)); return !!document.getElementById('help-hub-modal'); });
    await pg.close();
    T('PLANTED C: an engine that skips the guide\'s close leaves the Help Center open after Cancel (caught)', leftOpen === true, leftOpen);
  }

  // ═══ D · PLANTED: the old placement, and a WORKING card unchanged ════════
  console.log('\n== D · the placement rule can fail, and the Add-item guide\'s working card is untouched ==');
  // The old engine dodged every control on every card: with the dodge put back for reading cards, a tour card leaves its ring
  const srcD = planted('D', 'if (!_gtBig()) {\n      var d = _gtDodge(left, top, cw, ch, r, m);', 'if (true) {\n      var d = _gtDodge(left, top, cw, ch, r, m);');
  if (srcD) {
    ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true, tutorial: srcD }));
    const old = await walkTour(pg, 'My Collection');   // "Your main areas" is the card Brad photographed in the far corner
    await pg.close();
    const oldRinged = old.filter(c => c.hole);
    T('PLANTED D: with control-dodging back on, a tour card ends up more than 24px from its ring (caught)', oldRinged.some(c => gapBetween(c.card, c.hole) > 24), oldRinged.map(c => [c.title, gapBetween(c.card, c.hole)]));
  }
  // The Add-item guide's first card WAITS for the user: still compact, still parked in a corner
  ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true }));
  const working = await pg.evaluate(async () => {
    startGuide('add-item');
    await new Promise(r => setTimeout(r, 1400));
    const co = document.getElementById('gt-callout'); if (!co) return null;
    const b = co.getBoundingClientRect();
    return { mode: co.dataset.gtMode, corner: co.dataset.gtCorner || '', w: Math.round(b.width), bodyPx: parseFloat(getComputedStyle(document.getElementById('gt-body')).fontSize), title: document.getElementById('gt-title').textContent };
  });
  await pg.evaluate(() => { try { _gtEnd(); } catch (e) {} });
  await pg.close();
  T('D1  the Add-item guide\'s "Start here" card (it waits for you) is a WORKING card: compact width (under 360px), compact type, parked in a corner — exactly as before', working && working.mode === 'working' && working.w <= 360 && near(working.bodyPx, 13.44, 0.6) && /bottom|top|dodged/.test(working.corner), working);

  console.log('\n== E · source and errors ==');
  T('E1  the two boxes the tour rings that had no box of their own exist: #tools-all (tools.js) and #db-board (dispatch-board.js)',
    /id="tools-all"/.test(fs.readFileSync(path.join(H.APP, 'tools.js'), 'utf8')) && /id="db-board"/.test(fs.readFileSync(path.join(H.APP, 'dispatch-board.js'), 'utf8')), '');
  T('E2  no page errors on the walk', fullErrs.length === 0, fullErrs);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
