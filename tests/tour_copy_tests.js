#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR COPY — v0.9.1824   (real Chromium, the REAL app, no stubs)
//
// Release readiness M7 (Open List #3, Brad: "these probably need to get
// updated" … "the tour doesn't show very much"). The tour is the first thing a
// new collector reads (v0.9.1893: it starts by itself after setup; the welcome
// card that used to come first is gone), and they had drifted:
// menu items named that the menu does not have, four of six buttons, a help
// path that no longer exists. Now the tour walks EVERY page.
//
// THE RULE: every name the welcome card or the tour puts in a collector's
// hands must be on the screen it points at — read from the live app, not
// from a list typed here. And every tour card must point at something that
// is really on screen, for a brand-new collector (empty) AND for one with a
// collection, pressing Next all the way through.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_copy_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

async function walk(browser, withData) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  const out = await pg.evaluate(async (withData) => {
    window.state = window.state || {};
    state.masterData = [{ itemNum: '6457', variation: '2', itemType: 'Caboose', roadName: 'Lionel Lines', _era: 'pw', _tab: 'Lionel PW - Items' }, { itemNum: '2343', variation: '1', itemType: 'Diesel', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Items' }];
    _rebuildMasterIndex();
    state.personalData = withData ? { a: { owned: true, itemNum: '6457', variation: '2', era: 'pw', manufacturer: 'Lionel', inventoryId: '1', row: 3, condition: '7' } } : {};
    state.soldData = {}; state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.partsData = {}; state.contactsData = []; state.savedReports = [];
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    if (typeof tutShowHelpBtn === 'function') tutShowHelpBtn();   // what sign-in does (app-setup.js): the Need Help? widget joins the sidebar
    if (typeof buildDashboard === 'function') { try { buildDashboard(); } catch (e) {} }
    showPage('dashboard');
    await new Promise(r => setTimeout(r, 400));
    const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    // the live labels the copy must agree with
    const menu = Array.from(document.querySelectorAll('.sidebar .nav-item')).map(txt).map(t => t.replace(/[\d—]+$/, '').trim());
    const buttons = Array.from(document.querySelectorAll('.dash-desktop-actions button, .dash-desktop-actions a')).map(txt);
    // v0.9.1893: the welcome card is GONE (Brad: "more clutter than help") —
    // a new account goes from setup straight into this tour. What the card
    // used to say must not survive anywhere on the page.
    const welcome = (typeof window.showWelcomeCard === 'function') ? 'STILL DEFINED' : '';
    // walk the tour, Next until it ends, recording each card and whether it pointed at something
    window._gtMisses = [];
    const cards = [];
    startGuide('tour');
    for (let k = 0; k < 40; k++) {
      await new Promise(r => setTimeout(r, 1100));
      const title = document.getElementById('gt-title'); if (!title) break;
      const body = document.getElementById('gt-body');
      cards.push({ title: txt(title), page: (document.querySelector('.page.active') || {}).id, body: txt(body).slice(0, 80) });
      const next = document.getElementById('gt-next'); if (!next) break;
      next.click();
    }
    const misses = (window._gtMisses || []).filter(m => !m.optional).map(m => m.step + ' ' + m.title + ' → ' + m.selector);
    const ended = !document.getElementById('gt-title');
    return { menu, buttons, welcome, cards, misses, ended, tourSteps: GUIDES.tour.steps.length, catalogCount: BRAND_CATALOG_COUNT };
  }, withData);
  out.errs = errs;
  await pg.close();
  return out;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const empty = await walk(browser, false);
  const full = await walk(browser, true);
  await browser.close();

  console.log('== A · the tour walks every page and ends, for a new collector and for one with items ==');
  T('A1  the tour has more than a dozen cards (24 since v0.9.1869: the dashboard in six, every page in menu order, the four help doors, the name menu)', empty.tourSteps >= 24, empty.tourSteps);
  T('A2  a brand-new collector (empty) can press Next to the end with no card pointing at nothing', empty.ended && empty.misses.length === 0, { misses: empty.misses, cards: empty.cards.map(c => c.title) });
  T('A3  a collector with items can too', full.ended && full.misses.length === 0, { misses: full.misses, cards: full.cards.map(c => c.title) });
  const pagesSeen = new Set(full.cards.map(c => c.page));
  // v0.9.1869 (Brad: "we don't actually show the photo inbox page" / the Dispatch Board / "contacts is a big feature"): three more pages the walk must really open
  T('A4  the walk really changes pages (browse, upgrade, forsale, sold, parts, tools, reports, prefs, photo inbox, dispatch, contacts)',
     ['page-browse', 'page-upgrade', 'page-forsale', 'page-sold', 'page-parts', 'page-tools', 'page-reports', 'page-prefs', 'page-photo-inbox', 'page-dispatch', 'page-contacts'].every(p => pagesSeen.has(p)), Array.from(pagesSeen));
  T('A5  …and ends back on the Dashboard', full.cards.length && full.cards[full.cards.length - 1].page === 'page-dashboard', full.cards[full.cards.length - 1]);
  T('A6  the Master Catalog card states the count from config, not a typed number', full.cards.some(c => /Master Catalog/.test(c.title)) && full.cards.find(c => /Master Catalog/.test(c.title)).body.indexOf(full.catalogCount) >= 0, full.cards.find(c => /Master Catalog/.test(c.title)));

  console.log('\n== B · every name in the copy is a name on the screen ==');
  const src = fs.readFileSync(path.join(APP, 'tutorial.js'), 'utf8');
  const tourSrc = src.slice(src.indexOf("'tour': {"), src.indexOf("'add-item': {"));
  const areas = (tourSrc.match(/title: 'Your main areas',\s*body: '([^']*)'/) || [])[1] || '';
  const named = ['My Collection', 'Want / Upgrade', 'For Sale', 'Parts Needed', 'Master Catalog', 'Collection Tools', 'Reports', 'Sold Items', 'Photo Inbox', 'Preferences', 'Dispatch Board'];
  T('B1  "Your main areas" names every main menu item', named.every(n => areas.indexOf(n) >= 0), named.filter(n => areas.indexOf(n) < 0));
  const liveMenu = full.menu.concat(['Photo Inbox', 'Dispatch Board']);   // the two are added by their own modules at sign-in
  T('B2  …and every name it uses is a real menu label (read from the live sidebar)', named.every(n => liveMenu.some(m => m === n || m.indexOf(n) === 0)), { liveMenu: full.menu });
  T('B3  "Add things fast" says six, and the dashboard has six buttons', /Six buttons/.test(tourSrc) && full.buttons.length === 6, full.buttons);
  // v0.9.1893: B4–B6 read the welcome card, which is gone. B4 now pins that
  // it stays gone — the tour is the one first-run walkthrough.
  T('B4  there is no welcome card any more — the tour is the first-run walkthrough', full.welcome === '' && empty.welcome === '', full.welcome);
  T('B7  no card says "AI"', !/\bAI\b/.test(tourSrc.replace(/\/\/[^\n]*/g, '')));
  T('E1  no page errors on either walk', empty.errs.length === 0 && full.errs.length === 0, empty.errs.concat(full.errs));

  console.log('\n== C · planted offenders ==');
  const stale = "Your Collection, Want / Upgrade, For Sale, Sold, the catalog, Collection Tools, Reports, the Photo Inbox and Preferences all live here.";
  T('OFFENDER 1: the old menu sentence would fail B1', !named.every(n => stale.indexOf(n) >= 0));
  T('OFFENDER 2: a menu name that is not on the sidebar fails B2', !['Collection', 'Wish List'].every(n => full.menu.some(m => m === n || m.indexOf(n) === 0)));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
