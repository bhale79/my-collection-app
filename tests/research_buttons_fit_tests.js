#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH BUTTONS + PRICE-STEP FIT — v0.9.1918   (real Chromium, real app)
//
// Brad, 2026-10-10:
//  (1) screenshot of Want List · Step 4 "What do you expect to pay?": the
//      Research / eBay Sold Listings buttons ran past the right edge and a
//      sideways scrollbar appeared — "a screen that has issues with box sizes".
//  (2) "on the master catalog, the research button and ebay buttons should be
//      clickable here so you don't have to try to add it to research it" — the
//      "Do you own this item?" box.
//
// RULES held here, read off what the real app drew:
//   A  the price row never overflows: at Brad's large text, in a narrow window,
//      nothing sticks out and the buttons drop under the field
//   B  (v0.9.1948) a catalog row you do not own opens its DETAILS screen — the
//      "Do you own this item?" box is retired — with Google price check, On
//      eBay now and eBay sold beside the maker's link, and Add to Collection,
//      Add to My Want List and Close under them; nothing sticks out at large text
//   C  Close closes; Want hands over to the want list; a wanted item says so
//   D  the three links open the SAME links the Research card's buttons open
//   E  the Owned column's "—" is a Details button opening that screen
// Planted offenders (the old code served in place of the real file) must fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  research_buttons_fit_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
const COLL = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

async function openApp(browser, width, files) {
  const pg = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const PW = 'Lionel PW - Items';
    state.masterData = [
      { itemNum: '6343', variation: '', itemType: 'Flatcar', roadName: '', description: 'Barrel Ramp Car', yearProd: '1961-1962', _era: 'pw', _tab: PW },
      { itemNum: '2343', variation: '1', itemType: 'Diesel', roadName: 'Santa Fe', description: 'F3 A unit', yearProd: '1950', _era: 'pw', _tab: PW },
    ];
    _rebuildMasterIndex();
    state.personalData = {}; state.wantData = {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    window._opened = [];
    window.rrOpenExternal = function (url, what) { window._opened.push({ url: url, what: what }); };
  });
  return { pg, errs };
}

// The price step, drawn by the real wizard at Brad's text size.
const PRICE_STEP = async (pg) => pg.evaluate(async () => {
  document.documentElement.style.fontSize = '22px';            // Brad runs a large text size
  await openWizard('want');
  wizard.data.itemNum = '2343'; wizard.data.variation = '1';
  wizard.matchedItem = state.masterData[1];
  const i = wizard.steps.findIndex(s => s.id === 'expectedPrice');
  if (i < 0) return { err: 'no expectedPrice step' };
  wizard.step = i; renderWizardStep();
  await new Promise(r => setTimeout(r, 150));
  const row = document.getElementById('wiz-money-row') || (document.getElementById('wiz-input') || {}).parentElement;
  const btns = row ? Array.from(row.querySelectorAll('button')) : [];
  const rr = row.getBoundingClientRect();
  const sticks = btns.filter(b => b.getBoundingClientRect().right > rr.right + 1).map(b => b.textContent.trim());
  // the scrolling body of the wizard: no sideways scroll
  let el = row, sideways = false;
  while (el && el !== document.body) { if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') { sideways = true; break; } el = el.parentElement; }
  return { buttons: btns.map(b => b.textContent.trim()), sticks: sticks, rowOverflow: row.scrollWidth > row.clientWidth + 1, sideways: sideways };
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: the price step fits ──
  for (const w of [1400, 900, 390]) {
    const { pg, errs } = await openApp(browser, w);
    const r = await PRICE_STEP(pg);
    T('A' + w + ' the price step shows both buttons', r.buttons, ['🔍 Research', 'eBay Sold Listings']);
    T('A' + w + ' nothing sticks out past the price box', r.sticks, []);
    T('A' + w + ' the price row does not overflow', r.rowOverflow, false);
    T('A' + w + ' no sideways scroll in the wizard', r.sideways, false);
    T('A' + w + ' page errors', errs, []);
    await pg.close();
  }

  // ── B, C, D: the Master Catalog details screen (v0.9.1948 — the "Do you own
  // this item?" box is retired; Brad: "the detail page has all of that") ──
  {
    const { pg, errs } = await openApp(browser, 1400);
    const b = await pg.evaluate(() => {
      browseRowClick({ target: document.body }, 1);              // 2343, not owned
      const box = document.getElementById('rr-cat-details');
      const links = box ? Array.from(box.querySelectorAll('#rr-cat-details-links a')).map(a => a.getAttribute('data-link') + ':' + a.textContent.trim()) : [];
      const acts = box ? Array.from(box.querySelectorAll('[data-act]')).map(x => x.getAttribute('data-act')) : [];
      return { box: !!box, oldBox: !!document.getElementById('browse-add-prompt'), links, acts };
    });
    T('B1 a row you do not own opens its details straight away', b.box, true);
    T('B1b …and the "Do you own this item?" box is gone', b.oldBox, false);
    T('B2 beside the maker\'s link: Google price check, On eBay now, eBay sold', b.links.filter(x => !/^site:/.test(x)), ['google:Google price check', 'ebayNow:On eBay now', 'ebaySold:eBay sold']);
    T('B2b under them: Add to Collection, then Add to My Want List and Close', b.acts, ['add', 'want', 'close']);
    const sticks = await pg.evaluate(() => {
      document.documentElement.style.fontSize = '22px';
      const box = document.querySelector('#rr-cat-details > div'); const br = box.getBoundingClientRect();
      return Array.from(box.querySelectorAll('button, a')).filter(x => x.getBoundingClientRect().right > br.right + 1).map(x => x.textContent.trim());
    });
    T('B3 at large text nothing sticks out of the details screen', sticks, []);
    await pg.evaluate(() => { document.documentElement.style.fontSize = ''; });

    // D: each link opens what the Research card's button opens, for the same row
    const fromBox = {};
    for (const k of ['google', 'ebayNow', 'ebaySold']) {
      await pg.click('#rr-cat-details-links a[data-link="' + k + '"]');
      fromBox[k] = await pg.evaluate(() => window._opened.slice(-1)[0] || null);
    }
    T('D1 eBay sold opened a sold-listings search for 2343', !!(fromBox.ebaySold && /LH_Sold=1/.test(fromBox.ebaySold.url) && /2343/.test(decodeURIComponent(fromBox.ebaySold.url))), true);
    T('D2 …named the way the card names them', [fromBox.google && fromBox.google.what, fromBox.ebayNow && fromBox.ebayNow.what, fromBox.ebaySold && fromBox.ebaySold.what], ['Google price', 'eBay now', 'eBay sold']);
    // the card for the same row
    await pg.evaluate(() => { document.getElementById('rr-cat-details').remove(); window._researchLookupTyped(state.masterData[1].itemNum, { picked: state.masterData[1] }); });
    await pg.waitForTimeout(250);
    const fromCard = {};
    for (const [k, id] of [['google', 'rs-google'], ['ebayNow', 'rs-ebay-now'], ['ebaySold', 'rs-ebay']]) {
      await pg.click('#' + id);
      fromCard[k] = await pg.evaluate(() => window._opened.slice(-1)[0] || null);
    }
    T('D3 the details screen and the Research card open the SAME three links',
      ['google', 'ebayNow', 'ebaySold'].map(k => !!(fromBox[k] && fromCard[k] && fromBox[k].url === fromCard[k].url)), [true, true, true]);
    await pg.evaluate(() => { const o = document.getElementById('rs-overlay'); if (o) o.remove(); });

    // C: Close closes; Add to My Want List hands over to the want list; a wanted item says so
    const c = await pg.evaluate(() => {
      browseRowClick({ target: document.body }, 1);
      document.querySelector('#rr-cat-details [data-act="close"]').click();
      const closed = !document.getElementById('rr-cat-details');
      let wantIdx = null; const keep = window.addItemToWantList; window.addItemToWantList = function (i) { wantIdx = i; };
      browseRowClick({ target: document.body }, 1);
      document.querySelector('#rr-cat-details [data-act="want"]').click();
      window.addItemToWantList = keep;
      state.wantData['2343|1'] = { itemNum: '2343', variation: '1' };
      browseRowClick({ target: document.body }, 1);
      const wanted = !!document.querySelector('#rr-cat-details [data-act="wanted"]') && !document.querySelector('#rr-cat-details [data-act="want"]');
      document.getElementById('rr-cat-details').remove(); delete state.wantData['2343|1'];
      return { closed, wantIdx, wanted };
    });
    T('C1 Close closes the details screen', c.closed, true);
    T('C2 Add to My Want List opens the want list for this row', c.wantIdx, 1);
    T('C3 an item already on the want list says so instead of offering it twice', c.wanted, true);

    // E: the Owned column — a Details button where the "—" was, opening the same screen
    const e = await pg.evaluate(() => {
      const cell = _browseOwnedCell({ cls: 'no', text: '—' }, 1);
      const wantCell = _browseOwnedCell({ cls: 'want', text: '★ Want' }, 1);
      const host = document.createElement('table'); host.innerHTML = '<tr onclick="window.__rowClicked=1"><td>' + cell + '</td></tr>'; document.body.appendChild(host);
      window.__rowClicked = 0;
      host.querySelector('button[data-details]').click();
      const opened = !!document.getElementById('rr-cat-details');
      const r = { text: host.querySelector('button').textContent, opened, rowClick: window.__rowClicked, wantKeeps: /★ Want/.test(wantCell) && !/data-details/.test(wantCell) };
      host.remove(); const o = document.getElementById('rr-cat-details'); if (o) o.remove();
      return r;
    });
    T('E1 the Owned column\'s "—" is a Details button', e.text, 'Details');
    T('E2 …that opens the details screen (and not the row\'s own click)', [e.opened, e.rowClick], [true, 0]);
    T('E3 an Owned / Want badge stays a badge', e.wantKeeps, true);
    T('page errors (details)', errs, []);
    await pg.close();
  }

  // ── PLANTED offenders ──
  // P1: the old price row (no wrap, the field cannot shrink) at phone width
  const p1 = WIZ.replace('id="wiz-money-row" style="display:flex;flex-wrap:wrap;', 'id="wiz-money-row" style="display:flex;')
                .replace('style="flex:1 1 6rem;min-width:0;background:none;', 'style="flex:1;background:none;');
  T('P1 planted source differs', p1 !== WIZ, true);
  {
    const { pg } = await openApp(browser, 390, { 'wizard.js': p1 });
    const r = await PRICE_STEP(pg);
    T('P1 planted: the old row is caught overflowing', r.sticks.length > 0 || r.rowOverflow || r.sideways, true);
    await pg.close();
  }
  // P2: the details screen without its research links
  const p2 = COLL.replace('  if (links.children.length) box.appendChild(links);\n', '');
  T('P2 planted source differs', p2 !== COLL, true);
  {
    const { pg } = await openApp(browser, 1400, { 'app-collection.js': p2 });
    const n = await pg.evaluate(() => { browseRowClick({ target: document.body }, 1); return document.querySelectorAll('#rr-cat-details-links a').length; });
    T('P2 planted: a details screen without the links is caught', n, 0);
    await pg.close();
  }
  // P3: the old row click (the "Do you own this item?" box) — no details screen
  const p3 = COLL.replace('  rrCatalogDetailsPopup(idx);\n}', '  return;\n}');
  T('P3 planted source differs', p3 !== COLL, true);
  {
    const { pg } = await openApp(browser, 1400, { 'app-collection.js': p3 });
    const opened = await pg.evaluate(() => { browseRowClick({ target: document.body }, 1); return !!document.getElementById('rr-cat-details'); });
    T('P3 planted: a row click that does not open the details is caught', opened, false);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
