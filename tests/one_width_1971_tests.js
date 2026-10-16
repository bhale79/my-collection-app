#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EVERY ADD STEP ONE WIDTH ON A COMPUTER — v0.9.1971
// (real Chromium, REAL wizard.js + app.css)
//
// Brad, 2026-10-16, Add steps 2 and 3 side by side on his laptop (1536x737):
// "the screens really need to be more consistant as you step through them.
// can we not set a width like the collection step 3 size". Step 3's own width
// squeezed step 1, step 2 and the photo step, so ONE width a little wider
// (WIZ_STEP_W) for every step — and step 3 and Ready-to-save, which still
// scrolled, in two columns. Told the plan: "yes".
//
//   W1  his laptop, 1280x720 and 1920x1080: every step of an add (item number,
//       condition with every Yes, purchase & value with storage location on,
//       photos, year made, ready to save) is the SAME box — same width, same
//       height — nothing to scroll, Next on screen
//   W2  engine + tender and A-B-A diesel condition steps: the same box too,
//       nothing cut off at the side
//   W3  step 3 in two columns: worth beside paid, bought-from beside the date,
//       Notes across both
//   W4  Ready to save: the review lines in two columns
//   W5  the photo step: the whole slot cross inside the box
//   W6  step 1: the number box keeps its room; Photo ID in the row says just
//       "Photo ID" (the full wording is its tooltip)
//   W7  a phone keeps its own sizes and one column
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  one_width_1971_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
const CSS = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROWS = [
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', roadName: 'Santa Fe', description: 'F3 A unit', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'RJ Corman EMD SD40T-2 Diesel "5361," CC', _era: 'mpc', _tab: 'Lionel MPC-Modern', refLink: 'https://www.lionel.com/products/84631' },
  { itemNum: '2046', variation: '', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: '4-6-4 Hudson steam locomotive', _era: 'pw', _tab: 'Lionel PW - Items' },
];
// o: { w, h, mobile, wiz, css }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/wizard.js') && o.wiz) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    if (base.endsWith('/app/app.css') && o.css) return r.fulfill({ body: o.css, contentType: 'text/css' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.setItem('rr_orient_tip_off', ''); localStorage.removeItem('rr_orient_tip_off'); } catch (e) {}
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = rows.slice(); state.personalData = {};
    _prefLocEnabled = true;   // Brad keeps Storage Location on — the longest step 3
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  return { pg, ctx, errs };
}

// Walk one add through every step; measure the box, the scroll and Next on each.
const walk = (pg, grouping) => pg.evaluate(async (args) => {
  const [grouping] = args;
  const S = ms => new Promise(r => setTimeout(r, ms));
  const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width), h: Math.round(q.height) }; };
  // the step's own scroll: the body, or any scroller inside it — EXCEPT the
  // item-number match list, which is allowed to scroll inside its own box
  const scroll = () => {
    const m = document.querySelector('#wizard-modal .modal'); let worst = 0, who = '';
    m.querySelectorAll('*').forEach(e => {
      if (e.id === 'wiz-suggestions') return;
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY) && e.clientHeight > 40) { const o = e.scrollHeight - e.clientHeight; if (o > worst) { worst = o; who = e.id || e.className; } }
    });
    const bd = document.getElementById('wizard-body');
    return { over: worst, who, side: bd.scrollWidth - bd.clientWidth, bodyOver: bd.scrollHeight - bd.clientHeight };
  };
  const meas = (id) => {
    const m = document.querySelector('#wizard-modal .modal');
    const nx = document.getElementById('wizard-next-btn');
    const out = { id, box: R(m), next: R(nx), vh: innerHeight, ...scroll() };
    if (id === 'purchaseValue') {
      const pv = document.querySelector('.wiz-pv');
      const lab = t => { const d = [...document.querySelectorAll('#wizard-body .wiz-pv > div')].find(x => (x.textContent || '').trim().toUpperCase().indexOf(t) === 0); return R(d); };
      out.pv = { two: !!(pv && pv.classList.contains('wiz-pv-2up')), worth: lab('EST. WORTH'), paid: lab('WHAT DID YOU PAY'), from: lab('BOUGHT FROM'), date: lab('DATE PURCHASED'), notes: lab('NOTES'), loc: !!document.querySelector('#wizard-body .wiz-pv [id*="loc"], #wizard-body .wiz-pv select[onchange*="ocation"]') };
    }
    if (id === 'confirm') {
      const rows = [...document.querySelectorAll('.wiz-cf-rows > div')];
      out.cf = { two: !!document.querySelector('.wiz-cf-rows.wiz-cf-2up'), n: rows.length, r0: R(rows[0]), r1: R(rows[1]) };
    }
    if (id === 'photosItem') {
      const main = document.querySelector('.wiz-ph-main') || document.getElementById('photo-grid');
      const zones = [...document.querySelectorAll('#photo-grid .photo-drop-zone')].map(R);
      out.ph = { main: R(main), body: R(document.getElementById('wizard-body')), zones, maxR: Math.max(...zones.map(z => z.r)) };
    }
    if (id === 'conditionDetails') out.cols = document.querySelectorAll('#wizard-body .cd-col').length;
    return out;
  };
  const res = [];
  // step 1 — a number typed, the match list showing
  openWizard('collection'); await S(400);
  const inp = document.getElementById('wiz-input');
  inp.focus(); inp.value = '2343'; inp.dispatchEvent(new Event('input', { bubbles: true })); await S(1200);
  const s1 = meas('itemNumGrouping');
  const pid = document.getElementById('wiz-photoid-block');
  s1.input = R(inp); s1.pid = R(pid);
  s1.pidText = pid ? pid.innerText.replace(/\s+/g, ' ').trim() : ''; s1.pidTitle = pid ? pid.title : '';
  s1.inRow = !!(pid && pid.classList.contains('wiz-photoid-inrow'));
  res.push(s1);
  try { closeWizard(); } catch (e) {} await S(200);
  // the rest — on the matched item, every Yes answered, a price, a seller, a place
  const row = grouping === 'engine_tender' ? state.masterData[2] : grouping ? state.masterData[0] : state.masterData[1];
  for (const id of (grouping ? ['conditionDetails', 'confirm'] : ['conditionDetails', 'purchaseValue', 'photosItem', 'yearMade', 'confirm'])) {
    openWizard('collection'); await S(300);
    wizard.data.itemNum = row.itemNum; wizard.matchedItem = row;
    Object.assign(wizard.data, { hasBox: 'Yes', hasIS: 'Yes', hasMasterBox: 'Yes', isError: 'Yes', allOriginal: 'Yes', condition: 8, boxCond: 7,
      priceItem: '450', userEstWorth: '600', datePurchased: '2026-10-16', location: 'Shelf A', yearMade: '2017', notes: 'Bought at the York show',
      errorDesc: 'Road number missing on one side', is_sheetNum: '84631-IS', is_condition: 8, masterBoxCond: 7 });
    if (grouping) {
      wizard.data._itemGrouping = grouping;
      if (grouping === 'engine_tender') Object.assign(wizard.data, { tenderMatch: '2046W', _tenderConfirmed: true, tenderHasBox: 'Yes', tenderIsError: 'Yes', tenderAllOriginal: 'Yes' });
      else Object.assign(wizard.data, { unit2HasBox: 'Yes', unit2IsError: 'Yes', unit2AllOriginal: 'Yes', unit3HasBox: 'Yes', unit3IsError: 'Yes', unit3AllOriginal: 'Yes' });
    }
    if (id === 'yearMade') delete wizard.data.yearMade;   // unanswered, so the step shows itself
    const i = wizard.steps.findIndex(s => s.id === id);
    if (i < 0) { res.push({ id, missing: true }); try { closeWizard(); } catch (e) {} await S(150); continue; }
    wizard.step = i; renderWizardStep(); await S(500);
    document.querySelectorAll('#ai-usage-card').forEach(e => e.remove());
    res.push(meas(id));
    try { closeWizard(); } catch (e) {} await S(200);

  }
  return res;
}, [grouping || '']);

const fits = s => s.over <= 0 && s.side <= 0 && s.next && s.next.b <= s.vh;
const sameBox = steps => steps.every(s => s.box && Math.abs(s.box.w - steps[0].box.w) <= 1 && Math.abs(s.box.h - steps[0].box.h) <= 1);
const brief = steps => steps.map(s => s.id + ' ' + (s.box ? s.box.w + 'x' + s.box.h : '?') + ' over ' + s.over + (s.who ? '[' + s.who + ']' : '') + ' side ' + s.side + ' nextB ' + (s.next && s.next.b));

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== W1 · every step one box ==');
  let laptop = null;
  for (const [w, h] of [[1536, 737], [1280, 720], [1920, 1080]]) {
    r = await open(browser, { w, h });
    m = await walk(r.pg);
    const missing = m.filter(s => s.missing).map(s => s.id);
    T('W1 ' + w + 'x' + h + ': all six steps are the same box (width and height)', !missing.length && sameBox(m), { missing, steps: brief(m) });
    T('W1 ' + w + 'x' + h + ': nothing to scroll on any step, Next on screen', m.every(fits), brief(m));
    if (w === 1536) { laptop = m; T('page errors (walk)', r.errs.length === 0, r.errs); }
    await r.ctx.close();
  }

  console.log('== W2 · sets ==');
  // A set's condition step was a tall stack per unit and scrolled before this
  // release too (measured on v1970: engine+tender 239px, A-B-A 223px). This
  // release gives it the same box; making it fit is its own job (told Brad).
  // So: the same box, nothing cut off at the side, Next on screen, and no
  // MORE to scroll than before.
  const BEFORE = { engine_tender: 239, aba: 223 };
  for (const g of ['engine_tender', 'aba']) {
    r = await open(browser, { w: 1536, h: 737 });
    const gm = await walk(r.pg, g);
    const cd = gm.find(s => s.id === 'conditionDetails'), gcf = gm.find(s => s.id === 'confirm');
    T('W2 his laptop, ' + g + ' condition step: the same box as every other step, ' + (g === 'aba' ? 3 : 2) + ' columns, nothing cut off, Next on screen',
      cd && laptop && Math.abs(cd.box.w - laptop[0].box.w) <= 1 && Math.abs(cd.box.h - laptop[0].box.h) <= 1 && cd.cols === (g === 'aba' ? 3 : 2) && cd.side <= 0 && cd.next.b <= cd.vh, { cd, want: laptop && laptop[0].box });
    T('W2 ' + g + ': no more to scroll than before (' + cd.over + 'px now, ' + BEFORE[g] + 'px on v1970 — +10 allowed for the narrower A-B-A)', cd.over <= BEFORE[g] + 10, cd.over);
    // the longest review there is: every unit's answers. The lines scroll inside
    // their own box; the step itself never scrolls and Save stays on screen.
    T('W4 ' + g + ' Ready to save (' + (gcf.cf && gcf.cf.n) + ' lines): the step itself never scrolls, Save on screen, the lines in two columns',
      gcf && gcf.cf.two && gcf.cf.n > 16 && gcf.side <= 0 && gcf.next.b <= gcf.vh && gcf.bodyOver <= 0, { over: gcf.over, bodyOver: gcf.bodyOver, who: gcf.who, n: gcf.cf.n });
    await r.ctx.close();
  }

  console.log('== W3–W6 · how each step fits the box (his laptop) ==');
  const pv = laptop.find(s => s.id === 'purchaseValue').pv;
  T('W3 step 3: two columns — worth beside paid, bought-from beside the date — with Storage Location on',
    pv.two && pv.loc && Math.abs(pv.worth.t - pv.paid.t) < 6 && pv.worth.r < pv.paid.l && Math.abs(pv.from.t - pv.date.t) < 6 && pv.from.r < pv.date.l, pv);
  T('W3 step 3: with Storage Location on, Notes takes the empty slot beside it (no half-empty row)', pv.notes && Math.abs(pv.notes.l - pv.paid.l) <= 1 && pv.notes.t > pv.date.b, { notes: pv.notes, paid: pv.paid, date: pv.date });
  const cf = laptop.find(s => s.id === 'confirm').cf;
  T('W4 Ready to save: the review lines in two columns, left to right', cf.two && cf.n >= 8 && Math.abs(cf.r0.t - cf.r1.t) < 4 && cf.r0.r < cf.r1.l, cf);
  const ph = laptop.find(s => s.id === 'photosItem').ph;
  T('W5 the photo step: all six slots inside the box (none past its edge)', ph.zones.length === 6 && ph.maxR <= ph.main.r + 1 && ph.maxR <= ph.body.r, ph);
  const s1 = laptop[0];
  T('W6 step 1: Photo ID ends the number row and says just "Photo ID"; its tooltip carries the full wording',
    s1.inRow && /^Photo ID$/i.test(s1.pidText) && /know the number/i.test(s1.pidTitle) && Math.abs(s1.pid.t - s1.input.t) <= 8, { text: s1.pidText, title: s1.pidTitle, pid: s1.pid, input: s1.input });
  T('W6 step 1: the number box keeps its room (wider than Photo ID)', s1.input.w > s1.pid.w && s1.input.w >= 200, { input: s1.input, pid: s1.pid });

  console.log('== W7 · a phone ==');
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await walk(r.pg);
  const mpv = m.find(s => s.id === 'purchaseValue'), mcf = m.find(s => s.id === 'confirm'), ms1 = m[0];
  T('W7 a phone: one column on step 3 and Ready to save; no shortened Photo ID in a number row', !mpv.pv.two && !mcf.cf.two && !ms1.inRow && !/^Photo ID$/i.test(ms1.pidText), { pv: mpv.pv.two, cf: mcf.cf.two, pid: ms1.pidText, inRow: ms1.inRow });
  T('W7 a phone: its own box size (narrower than the computer box)', mpv.box.w < 720, mpv.box);
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { w: 1536, h: 737, wiz: planted(WIZ, '    if (_wizOneWidth()) {\n      // v0.9.1971', '    if (false) {\n      // v0.9.1971', 'one width') });
  m = await walk(x.pg);
  T('X-W1 PLANTED: the one-width branch undone → the steps change size again (caught)', !sameBox(m), brief(m));
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, css: planted(CSS, '.wiz-pv-2up { display: grid;', '.wiz-pv-2up-off { display: grid;', 'pv two columns') });
  m = await walk(x.pg);
  T('X-W3 PLANTED: step 3 back to one column → it scrolls again (caught)', !fits(m.find(s => s.id === 'purchaseValue')), brief(m));
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, css: planted(CSS, '.wiz-cf-2up { display: grid !important;', '.wiz-cf-2up-off { display: grid !important;', 'cf two columns') });
  m = await walk(x.pg);
  const xcf = m.find(s => s.id === 'confirm');
  T('X-W4 PLANTED: Ready to save back to one column → the lines stack (and it scrolls) (caught)', !(Math.abs(xcf.cf.r0.t - xcf.cf.r1.t) < 4) && !fits(xcf), { cf: xcf.cf, over: xcf.over });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, css: planted(CSS, '.wiz-ph-wide #photo-grid .photo-drop-zone { min-height: 0 !important; min-width: 0; }', '', 'slots shrink') });
  m = await walk(x.pg);
  const xph = m.find(s => s.id === 'photosItem').ph;
  T('X-W5 PLANTED: the slots not allowed to shrink → Left Side runs past the box edge (caught)', xph.maxR > xph.main.r + 1, xph);
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, css: planted(CSS, '.wiz-photoid-inrow .wiz-pid-lead { display: none; }', '', 'long Photo ID') });
  m = await walk(x.pg);
  T('X-W6 PLANTED: Photo ID with its full wording in the row → the number box is squeezed (caught)', !(m[0].input.w > m[0].pid.w && m[0].input.w >= 200), { input: m[0].input, pid: m[0].pid });
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
