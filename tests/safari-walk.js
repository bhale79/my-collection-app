#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE SAFARI WALK — the real app at iPhone size in Safari's engine (WebKit)
// AND Chrome's (Chromium), screen by screen.  [stated] Brad 2026-10-31 "yes"
//
// Most customers are on iPhones, and every browser on an iPhone is Safari's
// engine. Every other suite runs in Chromium only, so a fault that exists only
// in Safari passes them all. The first such walk (2026-10-30) found one: the
// Want / Upgrade 📷 threw in WebKit once the list redrew (fixed v0.9.2081).
//
// Each screen opens from a FRESH load of the app (one screen can never leave
// something behind for the next), on the guide fixture, iPhone 13 size:
//   W1 its opener runs without an error
//   W2 it LANDS — the page or pop-up it names is really on screen (a screen
//      that no longer opens is a rotted test, and says so)
//   W3 no page error while it opens and settles
//   W4 nothing on it can be dragged sideways (the page, its box, a pop-up)
// in BOTH engines; every failure is labelled "Safari only" or "both".
//   P  planted (WebKit): a Safari-only error on one screen, a too-wide box,
//      a screen that no longer lands, an opener that throws — each red.
//
// Safari's engine is NOT kept between cloud sessions: when it is missing this
// suite fetches it with the SAME Playwright it runs on (~100 MB, about a
// minute). If it cannot be had, the suite FAILS — a skip is not a pass.
// Tier: browser (tests/run-all.js BROWSER) — nightly and --all, never --fast.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

let pw;
try { pw = require('playwright'); }
catch (e) { console.log('FAILED  —  safari-walk needs playwright and it is not installed.'); process.exit(1); }

// ── Safari's engine, from the Playwright this suite runs on ──
function haveWebkit() { try { return fs.existsSync(pw.webkit.executablePath()); } catch (e) { return false; } }
if (!haveWebkit()) {
  const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
  console.log('NOTE  Safari\'s engine is not on this machine — fetching it (' + cli + ' install webkit)…');
  try { cp.execFileSync(process.execPath, [cli, 'install', 'webkit'], { stdio: 'inherit', timeout: 300000 }); }
  catch (e) { console.log('NOTE  the fetch failed: ' + String(e.message).split('\n')[0]); }
}
if (!haveWebkit()) { console.log('FAILED  —  Safari\'s engine (WebKit) could not be had on this machine, so the walk did not run.'); process.exit(1); }

// ── The screens. open = how a tap gets there; lands = it is really on screen;
//    setup (optional) = state the screen needs, set before it opens. ──
const PAGE = (id) => `(function(){var a=document.querySelector('.page.active');return !!a&&a.id===${JSON.stringify(id)}})()`;
const SEEN = (sel) => `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;var cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0})()`;
const UPG_PHOTO_SETUP = `
  var P = state.personalData, k = Object.keys(P).find(function (x) { return P[x].inventoryId === '46002'; });
  P[k].photoItem = 'https://drive.google.com/drive/folders/WALK_FOLDER';
  state.upgradeData = { '46002': { itemNum: P[k].itemNum, variation: P[k].variation, inventoryId: '46002', row: 2, priority: 'High', targetCondition: '9', maxPrice: '900', notes: '', manufacturer: 'Lionel' } };
  var k2 = document.createElement('canvas'); k2.width = 4; k2.height = 3; k2.getContext('2d').fillRect(0, 0, 4, 3);
  _blobCache.walkfid = k2.toDataURL('image/png');
  window.driveGetFolderPhotos = function () { return new Promise(function (r) { setTimeout(function () { r([{ id: 'walkfid' }]); }, 60); }); };
`;
const VIEWS = [
  { v: 'dashboard', open: "showPage('dashboard', null)", lands: PAGE('page-dashboard') },
  { v: 'my collection', open: "showPage('browse', null); filterOwned();", lands: PAGE('page-browse') },
  { v: 'filter sheet', open: "showPage('browse', null); _rrFilterSheetOpen();", lands: SEEN('#rr-filter-sheet') },
  { v: 'want / upgrade', open: "showPage('upgrade', null); buildUpgradePage();", lands: PAGE('page-upgrade') },
  { v: 'want / upgrade 📷 (tap, then the list redraws)', setup: UPG_PHOTO_SETUP,
    open: "showPage('upgrade', null); buildUpgradePage(); var b=[].slice.call(document.querySelectorAll('button')).find(function(x){return /_toggleUpgradePhoto\\(/.test(x.getAttribute('onclick')||'')&&x.offsetParent});b.click(); setTimeout(buildUpgradePage, 20); setTimeout(function(){var b2=[].slice.call(document.querySelectorAll('button')).find(function(x){return /_toggleUpgradePhoto\\(/.test(x.getAttribute('onclick')||'')&&x.offsetParent});b2.click();}, 120);",
    lands: `(function(){var i=document.querySelector('#page-upgrade [id$="-pic"] img');return !!i&&i.complete&&i.naturalWidth>0})()` },
  { v: 'for sale', open: "showPage('forsale', null); buildForSalePage();", lands: PAGE('page-forsale') },
  { v: 'parts', open: "showPage('parts', null); buildPartsPage();", lands: PAGE('page-parts') },
  { v: 'sold', open: "showPage('sold', null); buildSoldPage();", lands: PAGE('page-sold') },
  { v: 'sets', open: "showPage('sets', null); buildSetsPage();", lands: PAGE('page-sets') },
  { v: 'contacts', open: "showPage('contacts', null); window._ctRenderList();", lands: PAGE('page-contacts') },
  { v: 'contact edit', open: "showPage('contacts', null); window._ctOpenEdit(2);", lands: SEEN('#ct-modal') },
  { v: 'reports', open: "showPage('reports', null);", lands: PAGE('page-reports') },
  { v: 'tools / workbench', open: "showPage('tools', null);", lands: PAGE('page-tools') },
  { v: 'preferences', open: "showPage('prefs', null); buildPrefsPage();", lands: PAGE('page-prefs') },
  { v: 'item page (stock car)', open: "_openOwnedByInvId('46001')", lands: PAGE('page-itemdetail') },
  { v: 'item page (engine + tender)', open: "_openOwnedByInvId('46002')", lands: PAGE('page-itemdetail') },
  { v: 'sold item page', open: "showSoldDetailPage('s1')", lands: PAGE('page-itemdetail') },
  { v: 'want item page', open: "_wantViewDetail('2333','1')", lands: PAGE('page-itemdetail') },
  { v: 'Add screen', open: "openWizard('collection')", lands: SEEN('#wizard-modal') },
  { v: 'photo inbox', open: "window._pinGo(document.getElementById('nav-photo-inbox'))", lands: PAGE('page-photo-inbox') },
  { v: 'help guide', open: "rrgOpen('grading')", lands: SEEN('#rrg-modal') },
  { v: 'terms', open: "rrTermsOpen()", lands: SEEN('#rr-terms') },
  { v: 'share builder', open: "showPage('browse', null); filterOwned(); startShareMode('collection');", lands: PAGE('page-browse') },
  { v: 'dashboard editor', open: "showPage('dashboard', null); openDashEditor();", lands: SEEN('#dash-editor') },
];
// Not walked (2026-10-31): Appearance (behind its own feature switch, off in the
// fixture) and the instruction-sheet / catalog pages (the fixture holds none).

// W4's measure: a box the page scrolls in — the window, the page box (.main),
// the page, and any pop-up pinned over at least a third of the screen — that
// can be dragged SIDEWAYS. A box that hides sideways overflow on purpose is
// left alone; a strip meant to scroll sideways lives INSIDE these boxes.
const SIDEWAYS = `(function(){var W=innerWidth,H=innerHeight,out=[];
  var boxes=[document.documentElement,document.body,document.querySelector('.main'),document.querySelector('.page.active')];
  document.querySelectorAll('body *').forEach(function(x){var cs=getComputedStyle(x);if(cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden')return;var r=x.getBoundingClientRect();if(r.width*r.height>=W*H*0.35)boxes.push(x);});
  boxes.forEach(function(b){if(!b)return;var cs=getComputedStyle(b);if(cs.overflowX==='hidden'||cs.overflowX==='clip')return;
    if(b.scrollWidth>b.clientWidth+2)out.push((b.id?'#'+b.id:b.tagName.toLowerCase()+(b.className?'.'+String(b.className).split(' ')[0]:''))+' '+b.scrollWidth+'px in '+b.clientWidth+'px');});
  return out})()`;

async function walk(browser, engine, views, plant) {
  const dev = Object.assign({}, pw.devices['iPhone 13']); delete dev.defaultBrowserType;
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  if (plant) await ctx.addInitScript(plant);
  await ctx.route('**', r => { const u = r.request().url(); return /^(file|data|about|blob):/.test(u) ? r.continue() : r.abort(); });
  const pg = await ctx.newPage();
  let errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const out = [];
  for (const V of views) {
    errs = [];
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForFunction(() => typeof buildApp === 'function' && typeof showPage === 'function', null, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(900);
    const bootErrs = errs.slice(); errs = [];
    await pg.evaluate(SEED); await pg.waitForTimeout(250);
    if (V.setup) await pg.evaluate(new Function(V.setup)).catch(e => errs.push('setup: ' + e.message));
    const threw = await pg.evaluate(new Function('try{' + V.open + ';return null}catch(e){return String(e&&e.message||e)}'));
    await pg.waitForTimeout(800);
    const r = await pg.evaluate(new Function('return {lands:' + V.lands + ',wide:' + SIDEWAYS + '}'));
    out.push({ v: V.v, threw, lands: !!r.lands, wide: r.wide.join('; '), errs: bootErrs.concat(errs) });
  }
  await ctx.close();
  return out;
}

function judge(W, C) {
  const tag = (i, bad) => bad(W[i]) && bad(C[i]) ? 'both' : bad(W[i]) ? 'Safari only' : 'Chrome only';
  W.forEach((w, i) => {
    const c = C[i], name = '"' + w.v + '"';
    const t1 = x => !!x.threw, t2 = x => !x.lands, t3 = x => x.errs.length > 0, t4 = x => !!x.wide;
    ok('W1 ' + name + ' opens without an error', !t1(w) && !t1(c), tag(i, t1) + ': ' + (w.threw || c.threw));
    ok('W2 ' + name + ' lands on screen', !t2(w) && !t2(c), tag(i, t2) + (t2(w) && t2(c) ? ' — this screen no longer opens the way the walk opens it: update the walk\'s list' : ''));
    ok('W3 ' + name + ' — no page error', !t3(w) && !t3(c), tag(i, t3) + ': ' + (w.errs.concat(c.errs)).join(' | '));
    ok('W4 ' + name + ' — nothing can be dragged sideways', !t4(w) && !t4(c), tag(i, t4) + ': ' + (w.wide || c.wide));
  });
}

(async () => {
  const exC = '/opt/pw-browsers/chromium';
  let webkit, chromium;
  try { webkit = await pw.webkit.launch(); }
  catch (e) { console.log('FAILED  —  Safari\'s engine would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  try { chromium = await pw.chromium.launch(fs.existsSync(exC) ? { executablePath: exC } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  const t0 = Date.now();
  const W = await walk(webkit, 'webkit', VIEWS);
  const C = await walk(chromium, 'chromium', VIEWS);
  ok('W0 the walk covered every screen in both engines (' + VIEWS.length + ')', W.length === VIEWS.length && C.length === VIEWS.length);
  judge(W, C);
  console.log('NOTE  walk took ' + Math.round((Date.now() - t0) / 1000) + 's');

  // ── P — planted, in Safari's engine ──
  const one = (name) => VIEWS.filter(x => x.v === name);
  // P1: a Safari-only error — navigator.userAgentData is Chrome's alone.
  const P1 = await walk(webkit, 'webkit', one('want / upgrade'), () => { window.addEventListener('load', () => { const o = window.buildUpgradePage; window.buildUpgradePage = function () { const r = o.apply(this, arguments); void navigator.userAgentData.brands.length; return r; }; }); });
  const P1c = await walk(chromium, 'chromium', one('want / upgrade'), () => { window.addEventListener('load', () => { const o = window.buildUpgradePage; window.buildUpgradePage = function () { const r = o.apply(this, arguments); void navigator.userAgentData.brands.length; return r; }; }); });
  ok('P1 a Safari-only error on one screen — W1/W3 red in Safari, Chrome untouched', (P1[0].threw || P1[0].errs.length) && !P1c[0].threw && !P1c[0].errs.length, JSON.stringify([P1[0], P1c[0]]));
  // P2: a box wider than the phone.
  const P2 = await walk(webkit, 'webkit', one('reports'), () => { window.addEventListener('load', () => { const o = window.showPage; window.showPage = function () { const r = o.apply(this, arguments); const d = document.createElement('div'); d.style.cssText = 'width:640px;height:4px'; (document.querySelector('.page.active') || document.body).appendChild(d); return r; }; }); });
  ok('P2 a box wider than the phone — W4 red', !!P2[0].wide, JSON.stringify(P2[0]));
  // P3: a screen that no longer lands (its opener does nothing).
  const P3 = await walk(webkit, 'webkit', [Object.assign({}, one('terms')[0], { open: 'void 0' })]);
  ok('P3 a screen that no longer opens — W2 red', !P3[0].lands, JSON.stringify(P3[0]));
  // P4: an opener that throws (a function renamed away).
  const P4 = await walk(webkit, 'webkit', [Object.assign({}, one('sold')[0], { open: "showPage('sold', null); buildSoldPageRenamed();" })]);
  ok('P4 an opener that throws — W1 red', !!P4[0].threw, JSON.stringify(P4[0]));

  await webkit.close(); await chromium.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
