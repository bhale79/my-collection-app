#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD STEP 2: SLIDERS ON THE LEFT, QUESTIONS ON THE RIGHT — v0.9.1972
// (real Chromium, REAL wizard.js + wizard-handlers.js + app.css)
//
// Brad, 2026-10-16, step 2 on his laptop: "put both sliders under each other,
// go to two columns with sliders on the left, questions on the right". Told
// the plan (the instruction sheet's condition slider goes left too; each
// question keeps its own box) — "go".
//
//   L1  his laptop, 1280x720, 1920x1080: step 2 with EVERY answer given (All
//       Original No, the rest Yes) — nothing to scroll, Next on screen
//   L2  two columns: Condition, Box Condition, Instruction Sheet Condition
//       stacked on the left; All Original, Has Box, Instr. Sheet, Master Box,
//       Error Item stacked on the right
//   L3  the answers still drive the screen: Has Box No hides Box Condition and
//       Yes shows it (and the Yes/No buttons light the right one); Instr. Sheet
//       No hides its slider and its sheet number box; Error Item Yes lights Yes
//       and shows the error box
//   L4  the sliders still save: Box Condition moved to 9 → saved 9, shows 9
//   L5  a phone and an engine + tender keep their own layouts
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  sliders_left_1972_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
const HND = fs.readFileSync(path.join(APP, 'wizard-handlers.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROWS = [
  { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'RJ Corman EMD SD40T-2 Diesel "5361," CC', _era: 'mpc', _tab: 'Lionel MPC-Modern', refLink: 'https://www.lionel.com/products/84631' },
  { itemNum: '2046', variation: '', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: '4-6-4 Hudson steam locomotive', _era: 'pw', _tab: 'Lionel PW - Items' },
];
// o: { w, h, mobile, wiz, hnd }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/wizard.js') && o.wiz) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    if (base.endsWith('/app/wizard-handlers.js') && o.hnd) return r.fulfill({ body: o.hnd, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = rows.slice(); state.personalData = {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  return { pg, ctx, errs };
}
// open step 2 for an item; answer every question by clicking (All Original No, the rest Yes)
const step2 = (pg, opts) => pg.evaluate(async (opts) => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const R = e => { if (!e || !e.offsetParent) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; };
  const row = state.masterData[opts.engineTender ? 1 : 0];
  openWizard('collection'); await S(300);
  if (opts.engineTender) {
    Object.assign(wizard.data, { itemNum: row.itemNum, _itemGrouping: 'engine_tender', tenderMatch: '2046W', _tenderConfirmed: true }); wizard.matchedItem = row;
    wizard.step = wizard.steps.findIndex(s => s.id === 'conditionDetails'); renderWizardStep(); await S(450);
  } else { wizard.data.itemNum = row.itemNum; wizardNext(); await S(450); }
  document.querySelectorAll('#ai-usage-card').forEach(e => e.remove());
  const q = label => [...document.querySelectorAll('#wizard-body span')].find(s => s.textContent.trim().toUpperCase().indexOf(label) === 0);
  const btn = (label, txt) => { const sp = q(label); return sp ? [...sp.parentElement.querySelectorAll('button')].find(b => b.textContent.trim() === txt) : null; };
  const lit = b => !!b && /232, 64, 28|231, 76, 60|e74c3c|accent/i.test(b.getAttribute('style') || '') && !/border:\s*1(\.5)?px solid var\(--border\)/.test(b.getAttribute('style') || '');
  if (opts.answer) {
    for (const [label, txt] of [['ALL ORIGINAL', 'No'], ['HAS BOX', 'Yes'], ['INSTR. SHEET', 'Yes'], ['MASTER BOX', 'Yes'], ['ERROR ITEM', 'Yes']]) {
      const b = btn(label, txt); if (b) { b.click(); await S(150); }
    }
  }
  const bd = document.getElementById('wizard-body');
  const nx = document.getElementById('wizard-next-btn');
  const slider = id => { const v = document.getElementById(id); return v ? R(v.closest('.cd-sl, [id^="cd-boxcond-"], #cd-is-cond-reveal') || v.parentElement.parentElement) : null; };
  const out = {
    over: bd.scrollHeight - bd.clientHeight, side: bd.scrollWidth - bd.clientWidth, next: R(nx), vh: innerHeight,
    split: !!document.querySelector('.cd-fields.cd-split'),
    left: R(document.querySelector('.cd-sliders')), right: R(document.querySelector('.cd-questions')),
    cond: slider('cd-cond-val-main'), box: slider('cd-boxcond-val-main'), isc: slider('cd-is-cond-val'),
    qs: ['ALL ORIGINAL', 'HAS BOX', 'INSTR. SHEET', 'MASTER BOX', 'ERROR ITEM'].map(l => { const s = q(l); return s ? R(s) : null; }),
    data: { orig: wizard.data.allOriginal, box: wizard.data.hasBox, is: wizard.data.hasIS, mb: wizard.data.hasMasterBox, err: wizard.data.isError },
    errYesLit: lit(btn('ERROR ITEM', 'Yes')), errNoLit: lit(btn('ERROR ITEM', 'No')),
    errBox: R(document.getElementById('cd-error-reveal-main')), sheetBox: R(document.getElementById('cd-is-reveal')),
  };
  if (opts.toggles) {
    btn('HAS BOX', 'No').click(); await S(150);
    out.boxAfterNo = R(document.getElementById('cd-boxcond-main')); out.boxNoLit = lit(btn('HAS BOX', 'No')); out.boxYesLitAfterNo = lit(btn('HAS BOX', 'Yes'));
    btn('HAS BOX', 'Yes').click(); await S(150);
    out.boxAfterYes = R(document.getElementById('cd-boxcond-main')); out.boxYesLit = lit(btn('HAS BOX', 'Yes'));
    btn('INSTR. SHEET', 'No').click(); await S(150);
    out.iscAfterNo = R(document.getElementById('cd-is-cond-reveal')); out.sheetAfterNo = R(document.getElementById('cd-is-reveal'));
    btn('INSTR. SHEET', 'Yes').click(); await S(150);
    out.iscAfterYes = R(document.getElementById('cd-is-cond-reveal'));
    const rng = document.querySelector('#cd-boxcond-main input[type="range"]');
    rng.value = '9'; rng.dispatchEvent(new Event('input', { bubbles: true })); await S(100);
    out.boxCondSaved = wizard.data.boxCond; out.boxCondShown = document.getElementById('cd-boxcond-val-main').textContent.trim();
  }
  return out;
}, opts);

const fits = m => m.over <= 0 && m.side <= 0 && m.next && m.next.b <= m.vh;
const twoCols = m => {
  if (!m.split || !m.left || !m.right || !m.cond || !m.box || !m.isc || m.qs.some(x => !x)) return false;
  const leftOk = [m.cond, m.box, m.isc].every(s => s.l >= m.left.l - 1 && s.r <= m.left.r + 1) && m.cond.b <= m.box.t + 2 && m.box.b <= m.isc.t + 2;
  const rightOk = m.qs.every(s => s.l >= m.right.l - 1) && m.qs.every((s, i) => i === 0 || s.t > m.qs[i - 1].t);
  return leftOk && rightOk && m.left.r < m.right.l;
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== L1 · every answer fits ==');
  for (const [w, h] of [[1536, 737], [1280, 720], [1920, 1080]]) {
    r = await open(browser, { w, h });
    m = await step2(r.pg, { answer: true });
    T('L1 ' + w + 'x' + h + ': every answer given (All Original No, the rest Yes) — nothing to scroll, Next on screen',
      fits(m) && m.data.orig === 'No' && m.data.box === 'Yes' && m.data.is === 'Yes' && m.data.mb === 'Yes' && m.data.err === 'Yes', { over: m.over, side: m.side, next: m.next, data: m.data });
    if (w === 1536) {
      T('L2 sliders stacked on the left (Condition, Box Condition, Instruction Sheet Condition), questions stacked on the right', twoCols(m), m);
      T('L3 Error Item Yes: Yes is lit (not No) and the error box shows', m.errYesLit && !m.errNoLit && !!m.errBox, { yes: m.errYesLit, no: m.errNoLit, box: m.errBox });
      T('page errors', r.errs.length === 0, r.errs);
    }
    await r.ctx.close();
  }

  console.log('== L3–L4 · the answers still drive the screen ==');
  r = await open(browser, { w: 1536, h: 737 });
  m = await step2(r.pg, { answer: true, toggles: true });
  T('L3 Has Box No hides Box Condition and lights No; Yes shows it again and lights Yes',
    !m.boxAfterNo && m.boxNoLit && !m.boxYesLitAfterNo && !!m.boxAfterYes && m.boxYesLit, { afterNo: m.boxAfterNo, noLit: m.boxNoLit, afterYes: m.boxAfterYes, yesLit: m.boxYesLit });
  T('L3 Instr. Sheet No hides its condition slider and its sheet number box; Yes brings the slider back',
    !m.iscAfterNo && !m.sheetAfterNo && !!m.iscAfterYes, { iscNo: m.iscAfterNo, sheetNo: m.sheetAfterNo, iscYes: m.iscAfterYes });
  T('L4 Box Condition moved to 9 → saved 9 and shows 9', m.boxCondSaved === 9 && m.boxCondShown === '9', { saved: m.boxCondSaved, shown: m.boxCondShown });
  await r.ctx.close();

  console.log('== L5 · other layouts unchanged ==');
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await step2(r.pg, { answer: false });
  T('L5 a phone keeps its one-column step 2 (no split)', !m.split && !!m.cond && m.qs[0] && m.qs[0].t > m.cond.b, { split: m.split, cond: m.cond, q0: m.qs[0] });
  await r.ctx.close();
  r = await open(browser, { w: 1536, h: 737 });
  m = await step2(r.pg, { engineTender: true });
  T('L5 an engine + tender keeps its unit columns (no split)', !m.split && !!m.cond, { split: m.split, cond: m.cond });
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { w: 1536, h: 737, wiz: planted(WIZ, "_cdWrap.querySelectorAll('.cd-col.cd-2up').forEach(function (c) { _cdSplitSliders(c); });", '', 'split call') });
  m = await step2(x.pg, { answer: true });
  T('X-L2 PLANTED: the split not run → no sliders-left / questions-right layout (caught)', !twoCols(m), { split: m.split });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, wiz: planted(WIZ, "    if (lbl && lbl.nextSibling) q.insertBefore(rev, lbl.nextSibling); else q.appendChild(rev);\n  });", '  });', 'boxes in row') });
  m = await step2(x.pg, { answer: true });
  T('X-L1 PLANTED: the revealed boxes back under their questions → every answer scrolls again (caught)', !fits(m), { over: m.over });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, hnd: planted(HND, "  if (_bxBtns.length) {", '  if (false) {', 'box buttons by neighbour') });
  m = await step2(x.pg, { answer: true, toggles: true });
  T('X-L3a PLANTED: Has Box buttons found by their neighbour again → the lit button no longer follows the click (caught)',
    !(m.boxNoLit && !m.boxYesLitAfterNo && m.boxYesLit), { noLit: m.boxNoLit, yesLitAfterNo: m.boxYesLitAfterNo, yesLit: m.boxYesLit });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, hnd: planted(HND, " || _errBtns[c];", ';', 'error buttons') });
  m = await step2(x.pg, { answer: true });
  T('X-L3b PLANTED: Error Item buttons not found → Yes stays unlit after the click (caught)', !(m.errYesLit && !m.errNoLit), { yes: m.errYesLit, no: m.errNoLit });
  await x.ctx.close();
  x = await open(browser, { w: 1536, h: 737, hnd: planted(HND, "  if (isCond) isCond.style.display = (val === 'Yes') ? 'block' : 'none';", '', 'IS slider toggle') });
  m = await step2(x.pg, { answer: true, toggles: true });
  // (the slider is built hidden when the sheet was not yet answered, so the
  // plant shows up as Yes NOT bringing it back)
  T('X-L3c PLANTED: the sheet slider not toggled → Instr. Sheet Yes no longer shows it (caught)', !(!m.iscAfterNo && m.iscAfterYes), { iscNo: m.iscAfterNo, iscYes: m.iscAfterYes });
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
