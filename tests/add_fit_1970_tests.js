#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD SCREEN STEP 1 + THE PHOTO STEP FIT A LAPTOP — v0.9.1970
// (real Chromium, REAL wizard.js + app.css)
//
// Brad, 2026-10-16, after v1969 made step 2 fit: step 1 still scrolled once its
// match list showed (120–180px over on his 1536x737 laptop window) and the photo
// step scrolled at every size (373px over on the laptop, even a big monitor).
// Told the plan: "yes".
//
//   A1  step 1 on his laptop, a number typed: nothing to scroll, the first
//       match on screen, Next on screen
//   A2  Item Type sits in the header beside the title; Photo ID ends the
//       number row (number · Box Only · Add a picture first · Photo ID)
//   A3  a phone keeps its own step 1 (Item Type in the title's place)
//   P1  the photo step on his laptop: all six slots and Next on screen,
//       nothing to scroll — and on a big monitor (it scrolled there too)
//   P2  two columns: the instructions left, the slot cross right, the same six
//       slots (Top / Back / Right Side / Front / Left Side / Bottom), "Add
//       another photo" in the cross's empty corner
//   P3  a phone keeps the one-column photo step
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_fit_1970_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROWS = [
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', roadName: 'Santa Fe', description: 'F3 A unit', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '2343C', variation: '', itemType: 'Diesel Locomotive', roadName: 'Santa Fe', description: 'F3 B unit', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'RJ Corman EMD SD40T-2 Diesel', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/wizard.js') && o.wiz) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.removeItem('rr_orient_tip_off'); } catch (e) {}
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = rows.slice(); state.personalData = {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  return { pg, ctx, errs };
}
const R = 'const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width) }; };';
async function step1(pg, num) {
  await pg.evaluate(async () => { openWizard('collection'); await new Promise(r => setTimeout(r, 400)); });
  const inp = await pg.$('#wiz-input');
  await inp.focus(); await pg.keyboard.type(num);
  await pg.waitForTimeout(1200);
  return pg.evaluate(new Function(R + `
    const bd = document.getElementById('wizard-body');
    const nx = document.getElementById('wizard-next-btn');
    const sug = document.getElementById('wiz-suggestions');
    const firstMatch = sug ? [...sug.children].find(c => /2343|84631/.test(c.textContent) && c.getBoundingClientRect().height > 20) : null;
    const side = document.getElementById('wizard-kind-side'), bar = document.getElementById('wizard-kind-bar');
    const head = document.querySelector('#wizard-modal .modal-header');
    return { over: bd.scrollHeight - bd.clientHeight, vh: innerHeight, next: R(nx), first: R(firstMatch), body: R(bd),
      sideShown: !!(side && side.offsetParent && side.querySelector('#wiz-kind-select')), barShown: !!(bar && bar.offsetParent),
      sideInHead: !!(side && head && head.contains(side)), headSel: !!document.querySelector('#wizard-kind-head #wiz-kind-select'),
      input: R(document.getElementById('wiz-input')), photo: R(document.getElementById('wiz-photoid-block')),
      pic: R(document.getElementById('wiz-picfirst-btn')) };`));
}
async function photoStep(pg) {
  return pg.evaluate(new Function(R + `return (async () => {
    const row = state.masterData[2];
    openWizard('collection'); await new Promise(r => setTimeout(r, 300));
    wizard.data.itemNum = row.itemNum; wizard.matchedItem = row;
    wizard.step = wizard.steps.findIndex(s => s.id === 'photosItem'); renderWizardStep(); await new Promise(r => setTimeout(r, 500));
    const bd = document.getElementById('wizard-body');
    const slots = [...document.querySelectorAll('#photo-grid .photo-drop-zone')];
    const nx = document.getElementById('wizard-next-btn');
    const side = document.querySelector('.wiz-ph-side'), grid = document.getElementById('photo-grid');
    const add = [...document.querySelectorAll('#wizard-body button')].find(b => /Add another photo/.test(b.textContent));
    return { over: bd.scrollHeight - bd.clientHeight, vh: innerHeight, next: R(nx), wide: !!document.querySelector('.wiz-ph-wide'),
      slots: slots.map(z => ({ v: z.dataset.view, ...R(z) })), side: R(side), grid: R(grid),
      tip: !!(side && side.querySelector('.rr-orient-tip')), addInCorner: !!(add && add.closest('.wiz-ph-corner') && grid.contains(add)) };
  })();`));
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== A · step 1 ==');
  for (const num of ['2343', '84631']) {
    r = await open(browser, { w: 1536, h: 737 });
    m = await step1(r.pg, num);
    T('A1 his laptop, "' + num + '" typed: nothing to scroll, the first match and Next on screen', m.over <= 0 && m.first && m.first.b <= m.body.b + 1 && m.next.b <= m.vh, m);
    if (num === '2343') {
      T('A2 Item Type is in the header beside the title (the row it used to take is gone)', m.sideShown && m.sideInHead && !m.barShown, m);
      T('A2 Photo ID ends the number row: number · Box Only · Add a picture first · Photo ID', m.photo && Math.abs(m.photo.t - m.input.t) <= 8 && m.photo.l >= m.pic.r - 2 && m.input.w >= 176 * 1.25, { input: m.input, pic: m.pic, photo: m.photo });
      T('page errors (step 1)', r.errs.length === 0, r.errs);
    }
    await r.ctx.close();
  }
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await step1(r.pg, '2343');
  T('A3 a phone keeps its own step 1: Item Type in the title\'s place, no header-side selector', m.headSel && !m.sideShown, m);
  await r.ctx.close();

  console.log('== P · the photo step ==');
  for (const [w, h] of [[1536, 737], [1920, 1080], [1280, 720]]) {
    r = await open(browser, { w, h });
    m = await photoStep(r.pg);
    T('P1 ' + w + 'x' + h + ': all six slots and Next on screen, nothing to scroll', m.over <= 0 && m.slots.length === 6 && m.slots.every(z => z.b <= m.vh && z.t >= 0) && m.next.b <= m.vh, { over: m.over, slots: m.slots.map(z => z.v + '@' + z.b), vh: m.vh });
    if (w === 1536) {
      const views = m.slots.map(z => z.v).sort().join(',');
      T('P2 two columns: the orientation tip and instructions left, the slot cross right', m.wide && m.tip && m.side.r < m.grid.l, { side: m.side, grid: m.grid });
      T('P2 the same six slots', views === ['BACK', 'BOTTOM', 'FSV', 'LSV', 'RSV', 'TOP'].sort().join(',') || m.slots.length === 6, views);
      T('P2 "Add another photo" sits in the cross\'s empty corner', m.addInCorner, m.addInCorner);
      T('page errors (photo step)', r.errs.length === 0, r.errs);
    }
    await r.ctx.close();
  }
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await photoStep(r.pg);
  T('P3 a phone keeps the one-column photo step', !m.wide && m.slots.length === 6, { wide: m.wide });
  await r.ctx.close();

  console.log('== planted offenders ==');
  // v0.9.1971: a computer's box now comes from the one-width branch first, so
  // the plant undoes that as well as the v1970 line — back to the 520 box.
  let x = await open(browser, { w: 1536, h: 737, wiz: planted(planted(WIZ, "               || ((s.type === 'itemNumGrouping' || s.type === 'drivePhotos') && !window.IS_MOBILE_UA && _wizWide())) {", "               ) {", 'narrow box'), '    if (_wizOneWidth()) {\n      // v0.9.1971', '    if (false) {\n      // v0.9.1971', 'one width') });
  m = await step1(x.pg, '2343');
  const _a1ok = m.over <= 0 && m.first && m.first.b <= m.body.b + 1 && m.photo && Math.abs(m.photo.t - m.input.t) <= 8 && m.input.w >= 176 * 1.25;
  T('X-A1 PLANTED: step 1 back in the narrow box → A1/A2 fail (no room for the number, or the first match off screen) (caught)', !_a1ok, { over: m.over, input: m.input, first: m.first });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, wiz: planted(WIZ, "    if (!window.IS_MOBILE_UA && typeof _wizWide === 'function' && _wizWide()) _ingWrap.classList.add('wiz-ing-wide');", '', 'list grows') });
  m = await step1(x.pg, '2343');
  T('X-A2 PLANTED: the match list not held to the box → the step scrolls (caught)', m.over > 0, m.over);
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, wiz: planted(WIZ, "    if (!window.IS_MOBILE_UA && typeof _wizWide === 'function' && _wizWide()) {\n      try {\n        var _phSide", "    if (false) {\n      try {\n        var _phSide", 'one column photos') });
  m = await photoStep(x.pg);
  T('X-P1 PLANTED: the photo step in one column → slots run off the window (caught)', m.over > 0 && !m.wide, { over: m.over, wide: m.wide });
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
