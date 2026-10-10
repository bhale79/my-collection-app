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
//   B  the "Do you own this item?" box has Research + eBay Sold Prices
//   C  Research opens the Research card for THAT catalog row
//   D  eBay Sold Prices opens the SAME link the Research card's button opens
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

  // ── B, C, D: the "Do you own this item?" box ──
  {
    const { pg, errs } = await openApp(browser, 1400);
    const b = await pg.evaluate(() => {
      browseRowClick({ target: document.body }, 1);              // 2343, not owned
      const box = document.getElementById('browse-add-prompt');
      const look = document.getElementById('browse-add-prompt-look');
      return { box: !!box, look: look ? Array.from(look.querySelectorAll('button')).map(x => x.textContent.trim()) : [] };
    });
    T('B1 the box opens for a row you do not own', b.box, true);
    T('B2 it has Research and eBay Sold Prices', b.look, ['🔍 Research', '💰 eBay Sold Prices']);
    // at Brad's large text nothing in the box sticks out past its edge (the ✕
    // was cut off before v0.9.1918 — the first row never wrapped)
    const sticks = await pg.evaluate(() => {
      document.documentElement.style.fontSize = '22px';
      const box = document.querySelector('#browse-add-prompt > div'); const br = box.getBoundingClientRect();
      return Array.from(box.querySelectorAll('button')).filter(x => x.getBoundingClientRect().right > br.right + 1).map(x => x.textContent.trim());
    });
    T('B3 at large text no button sticks out of the box', sticks, []);
    const corner = await pg.evaluate(() => {
      const box = document.querySelector('#browse-add-prompt > div'); const br = box.getBoundingClientRect();
      const x = Array.from(box.children).find(c => c.tagName === 'BUTTON' && c.textContent.trim() === '✕');
      if (!x) return 'no ✕';
      const xr = x.getBoundingClientRect();
      return (br.right - xr.right < 40 && xr.top - br.top < 40) ? 'top-right' : 'elsewhere';
    });
    T('B4 the ✕ sits in the box\'s top-right corner', corner, 'top-right');

    // D: the box's eBay link == the Research card's eBay link, same row
    await pg.click('#browse-add-prompt-look button:nth-child(2)');
    const fromBox = await pg.evaluate(() => window._opened.slice(-1)[0] || null);
    T('D1 eBay Sold Prices opened a sold-listings link', !!(fromBox && /LH_Sold=1/.test(fromBox.url) && /2343/.test(decodeURIComponent(fromBox.url))), true);
    T('D2 …named as an eBay sold search', fromBox && fromBox.what, 'eBay sold');

    // C: Research opens the card for THIS row
    await pg.click('#browse-add-prompt-look button:nth-child(1)');
    await pg.waitForTimeout(250);
    const c = await pg.evaluate(() => {
      const ov = document.getElementById('rs-overlay');
      return { card: !!ov, promptGone: !document.getElementById('browse-add-prompt'), num: ov ? (ov.textContent.match(/2343/) || [''])[0] : '' };
    });
    T('C1 Research opens the Research card', c.card, true);
    T('C2 …for 2343', c.num, '2343');
    T('C3 …and the question box closes', c.promptGone, true);
    await pg.click('#rs-ebay');
    const fromCard = await pg.evaluate(() => window._opened.slice(-1)[0] || null);
    T('D3 the box and the card open the SAME eBay link', fromBox && fromCard && fromBox.url === fromCard.url, true);
    T('page errors (box)', errs, []);
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
  // P3: the old first row (no wrap) at large text — the ✕ sticks out
  const p3 = COLL.replace("btnRow.style.cssText = 'display:flex;gap:0.75rem;flex-wrap:wrap';", "btnRow.style.cssText = 'display:flex;gap:0.75rem';")
                 .replace("  box.style.position = 'relative';\n  box.appendChild(cancelBtn);\n  box.appendChild(btnRow);", "  btnRow.appendChild(cancelBtn);\n  box.appendChild(btnRow);")
                 .replace("cancelBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;padding:0.35rem 0.6rem;line-height:1';", "cancelBtn.style.cssText = 'padding:0.6rem 0.9rem';");
  T('P3 planted source differs', p3 !== COLL, true);
  {
    const { pg } = await openApp(browser, 1400, { 'app-collection.js': p3 });
    const st = await pg.evaluate(() => { document.documentElement.style.fontSize = '22px'; browseRowClick({ target: document.body }, 1); const box = document.querySelector('#browse-add-prompt > div'); const br = box.getBoundingClientRect(); return Array.from(box.querySelectorAll('button')).filter(x => x.getBoundingClientRect().right > br.right + 1).length; });
    T('P3 planted: the unwrapped row is caught sticking out', st > 0, true);
    await pg.close();
  }
  // P2: the box without the two buttons
  const p2 = COLL.replace('  lookRow.appendChild(resBtn);\n  lookRow.appendChild(ebayBtn);\n  box.appendChild(lookRow);\n', '');
  T('P2 planted source differs', p2 !== COLL, true);
  {
    const { pg } = await openApp(browser, 1400, { 'app-collection.js': p2 });
    const n = await pg.evaluate(() => { browseRowClick({ target: document.body }, 1); const l = document.getElementById('browse-add-prompt-look'); return l ? l.querySelectorAll('button').length : 0; });
    T('P2 planted: a box without the buttons is caught', n, 0);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
