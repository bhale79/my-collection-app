#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MY COLLECTION'S COLUMNS DON'T WASTE THE SCREEN — v0.9.1993 (real Chromium,
// REAL browse.js + app.css)
//
// Brad, 2026-10-19, his list on the computer: "this is wasted space on the
// screen. can we tighten this up or is there a reason for this." Measured: the
// table sizes a column to its widest entry in the WHOLE list, so one "AMERICAN
// FLYER" badge made Mfr. 129 px and one "🔗 SET · 2 pieces" line made Item #
// 166 px for every row; and the floor meant for the columns a user adds
// (90 px) overrode the built-in ones (Var. "1" took 108 px). At 1536 px the
// table ran past the screen: Description squeezed to 121 px, a sideways bar,
// Remove cut off. Told the plan — "yes".
//
//   W1  his laptop (1536x737), a list holding a long maker and a grouped set:
//       the table fits — no sideways scroll, every Actions button on screen
//   W2  Description gets the room (≥ 200 px); Mfr. ≤ 110, Item # ≤ 130,
//       Var. ≤ 70
//   W3  nothing is hidden to do it: "AMERICAN FLYER" and "SET · 2 pieces"
//       are shown whole (wrapped), not cut
//   W4  a big screen (1920x1080): Description takes the spare width
//   P   PLANTED: the v0.9.1992 browse.js + app.css (git b6e5ab67) overflow
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collection_widths_1993_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const old = (f) => { try { return cp.execSync('git show b6e5ab67:app/' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };
const OLD = { 'browse.js': old('browse.js'), 'app.css': old('app.css') };

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const ROWS = [
  ['6427-60', 'Caboose', 'Virginian N5c Porthole Caboose', 'pw', 'Lionel'],
  ['6445', 'Boxcar', 'Fort Knox Gold Reserve Mint Car', 'pw', 'Lionel'],
  ['6464-275', 'Boxcar', 'State of Maine Boxcar', 'pw', 'Lionel'],
  ['2046', 'Steam Locomotive', '4-6-4 Hudson steam locomotive', 'pw', 'Lionel'],
  ['2046W', 'Tender', 'Whistle tender', 'pw', 'Lionel'],
  ['21088', 'Boxcar', 'Atlantic Coast Line boxcar', 'afg', 'American Flyer'],
];

async function measure(browser, W, H, swap) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    for (const f of Object.keys(swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: swap[f], contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const m = await pg.evaluate(async (rows) => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    try { localStorage.clear(); } catch (e) {}
    state.masterData = rows.map(r => ({ itemNum: r[0], variation: '1', itemType: r[1], roadName: '', description: r[2], yearProd: '1955', _era: r[3], _tab: r[3] === 'pw' ? 'Lionel PW - Items' : 'American Flyer' }));
    try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {};
    rows.forEach((r, i) => { state.personalData['I' + i] = { inventoryId: String(i + 1), itemNum: r[0], variation: '1', owned: true, condition: '7', userEstWorth: '50', dateAdded: '2026-10-10', era: r[3], manufacturer: r[4], groupId: (r[0].indexOf('2046') === 0 ? 'G1' : ''), photoItem: 'x' }; });
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    showPage('browse'); state.filters.owned = true; try { filterOwned(); } catch (e) {}
    await S(700); renderBrowse(); await S(700);
    const Wd = {};
    [...document.querySelectorAll('#page-browse .item-table thead th[data-col]')].forEach(t => { Wd[t.getAttribute('data-col')] = Math.round(t.getBoundingClientRect().width); });
    const t = document.querySelector('#page-browse .item-table'), wrap = document.querySelector('.browse-table-wrap');
    const btns = [...document.querySelectorAll('#page-browse td[data-col="actions"] button')].map(b => b.getBoundingClientRect());
    const badge = [...document.querySelectorAll('#page-browse .mfr-badge')].find(b => /AMERICAN/i.test(b.textContent));
    const setLbl = [...document.querySelectorAll('#page-browse td[data-col="num"] span')].find(s => /SET/.test(s.textContent) && /pieces/.test(s.textContent));
    const clipped = (el) => !el || el.scrollWidth > el.clientWidth + 1 || el.closest('td').scrollWidth > el.closest('td').clientWidth + 1;
    return { W: Wd, over: Math.round(t.getBoundingClientRect().width - wrap.clientWidth), btnRight: Math.max.apply(null, btns.map(r => r.right)), vw: innerWidth,
      badge: badge ? badge.textContent.trim() : null, badgeClipped: clipped(badge), setText: setLbl ? setLbl.textContent.trim() : null, setClipped: clipped(setLbl) };
  }, ROWS);
  await ctx.close();
  return { m, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r = await measure(browser, 1536, 737);
  let m = r.m;
  T('W1 his laptop: the table fits — no sideways scroll', m.over <= 0, m);
  T('W1 …every Actions button (Remove included) is on screen', m.btnRight <= m.vw, { right: m.btnRight, vw: m.vw });
  T('W2 Description gets the room (≥ 200 px)', m.W.desc >= 200, m.W);
  T('W2 Mfr. ≤ 110, Item # ≤ 130, Var. ≤ 70', m.W.mfr <= 110 && m.W.num <= 130 && m.W['var'] <= 70, m.W);
  T('W3 "AMERICAN FLYER" is shown whole (wrapped), not cut', /AMERICAN\s*FLYER/i.test(m.badge || '') && !m.badgeClipped, { badge: m.badge, clipped: m.badgeClipped });
  T('W3 "SET · 2 pieces" is shown whole (wrapped), not cut', /SET · 2 pieces/.test(m.setText || '') && !m.setClipped, { set: m.setText, clipped: m.setClipped });
  T('page errors (laptop)', r.errs.length === 0, r.errs);
  r = await measure(browser, 1920, 1080);
  T('W4 a big screen: no sideways scroll, Description takes the spare width (≥ 450 px)', r.m.over <= 0 && r.m.W.desc >= 450, r.m.W);
  if (!OLD['browse.js'] || !OLD['app.css']) T('P0 the v0.9.1992 files could be read from git (b6e5ab67)', false, 'git show failed');
  else {
    r = await measure(browser, 1536, 737, OLD);
    T('P1 PLANTED: v0.9.1992 runs past his laptop screen, Description squeezed', r.m.over > 0 && r.m.W.desc < 200, r.m);
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
