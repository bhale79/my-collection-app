#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// POP-UP SIZE BY WIDTH AND HEIGHT · ADD STEP 2 FITS A LAPTOP — v0.9.1969
// (real Chromium, REAL app.css + wizard.js)
//
// Brad, 2026-10-16, the Add screen's step 2 on his laptop (window 1536x737):
// "why is this screen so huge?" … "and why do we have to scroll it". The size
// step was picked by window WIDTH alone, so his short laptop window got the
// biggest step (1.5x) and step 2 ran 64px past it — 190px with every Yes
// answered. Told the plan: "yes".
//
//   Z1  the pop-up step follows width AND height: 1536x737 → 1.25,
//       1920x1080 → 1.5, 1280x720 → 1.1, a phone → 1
//   Z2  the review card / crop card step comes from the same table
//   S1  step 2 with EVERY Yes answered fits his laptop window — nothing to
//       scroll, Next on screen — and at 1280x720 and 1920x1080 too
//   S2  three columns of questions on a computer; the item name and its
//       "View on …" button share one line; a phone keeps one column
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  popup_size_1969_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const CSS = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 600))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROW = { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'RJ Corman EMD SD40T-2 Diesel "5361," CC', _era: 'mpc', _tab: 'Lionel MPC-Modern', refLink: 'https://www.lionel.com/products/84631' };

// o: { w, h, mobile, css }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/app.css') && o.css) return r.fulfill({ body: o.css, contentType: 'text/css' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  return { pg, ctx, errs };
}
const zooms = pg => pg.evaluate(() => {
  const mk = cls => { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); const z = getComputedStyle(d).zoom; d.remove(); return z; };
  return { modal: mk('modal'), card: mk('rr-card'), review: mk('rr-card pin-rv-card'), crop: mk('rr-card bi-crop-card') };
});
// the Add screen, step 2, for one item — with every Yes answered when allYes
const step2 = (pg, allYes) => pg.evaluate(async (args) => {
  const [row, allYes] = args;
  try { _aiUsageMarkSeen(); } catch (e) {}
  state.masterData = [row]; state.masterAllRows = [row]; state.personalData = {};
  document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  openWizard('collection'); await new Promise(r => setTimeout(r, 300));
  wizard.data.itemNum = row.itemNum; wizardNext(); await new Promise(r => setTimeout(r, 450));
  document.querySelectorAll('#ai-usage-card').forEach(e => e.remove());
  if (allYes) {
    for (const label of ['HAS BOX', 'INSTR. SHEET', 'MASTER BOX', 'ERROR ITEM']) {
      const sp = [...document.querySelectorAll('#wizard-body span')].find(s => s.textContent.trim().toUpperCase().indexOf(label) === 0);
      const yes = sp && [...sp.parentElement.querySelectorAll('button')].find(b => b.textContent.trim() === 'Yes');
      if (yes) { yes.click(); await new Promise(r => setTimeout(r, 200)); }
    }
  }
  await new Promise(r => setTimeout(r, 200));
  const bd = document.getElementById('wizard-body');
  const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; };
  const nx = [...document.querySelectorAll('#wizard-modal button')].find(b => /NEXT/i.test(b.textContent));
  const lab = t => { const s = [...document.querySelectorAll('#wizard-body span, #wizard-body div')].find(x => x.children.length === 0 && x.textContent.trim().toUpperCase().indexOf(t) === 0); return R(s); };
  const head = document.querySelector('.cd-col .cd-head');
  const link = head ? [...head.querySelectorAll('a')].find(a => /View on/.test(a.textContent)) : null;
  return {
    id: wizard.steps[wizard.step].id, over: bd.scrollHeight - bd.clientHeight, next: R(nx), vh: innerHeight,
    two: !!document.querySelector('.cd-col.cd-2up'),
    cond: lab('CONDITION'), orig: lab('ALL ORIGINAL'), box: lab('HAS BOX'), is: lab('INSTR. SHEET'),
    name: R(head && head.querySelector('.cd-head-text')), link: R(link),
    answered: { box: wizard.data.hasBox, is: wizard.data.hasIS, mb: wizard.data.hasMasterBox, err: wizard.data.isError },
  };
}, [ROW, !!allYes]);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== Z · the size step ==');
  const sizes = [[1536, 737, '1.25', '1.25'], [1920, 1080, '1.5', '1.25'], [1280, 720, '1.1', '1'], [1200, 800, '1.25', '1.1'], [1440, 900, '1.5', '1.25']];
  for (const [w, h, want, wantSm] of sizes) {
    r = await open(browser, { w, h });
    m = await zooms(r.pg);
    T('Z1 ' + w + 'x' + h + ': pop-ups at ' + want, m.modal === want && m.card === want, m);
    T('Z2 ' + w + 'x' + h + ': review card and crop card at ' + wantSm + ' (the same table)', m.review === wantSm && m.crop === wantSm, m);
    await r.ctx.close();
  }
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await zooms(r.pg);
  T('Z1 a phone: pop-ups at their own size', m.modal === '1' && m.card === '1', m);
  await r.ctx.close();

  console.log('== S · Add step 2 ==');
  for (const [w, h] of [[1536, 737], [1280, 720], [1920, 1080]]) {
    r = await open(browser, { w, h });
    m = await step2(r.pg, true);
    T('S1 ' + w + 'x' + h + ': step 2 with every Yes answered fits — nothing to scroll, Next on screen', m.id === 'conditionDetails' && m.over <= 0 && m.next && m.next.b <= m.vh
      && m.answered.box === 'Yes' && m.answered.is === 'Yes' && m.answered.mb === 'Yes' && m.answered.err === 'Yes', m);
    if (w === 1536) {
      T('S2 three columns: Condition, All Original and Has Box side by side, Instruction Sheet below', m.two && Math.abs(m.cond.t - m.orig.t) < 6 && Math.abs(m.orig.t - m.box.t) < 6 && m.is.t > m.cond.b && m.cond.r < m.orig.l && m.orig.r < m.box.l, m);
      T('S2 the item name and its "View on …" button share one line (button on the right)', m.name && m.link && m.link.t < m.name.b && m.link.l > m.name.r - 4, { name: m.name, link: m.link });
      T('page errors', r.errs.length === 0, r.errs);
    }
    await r.ctx.close();
  }
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await step2(r.pg, false);
  T('S2 a phone keeps one column', m.id === 'conditionDetails' && !m.two && m.is.t > m.cond.b && m.orig.t > m.cond.b, m);
  await r.ctx.close();

  console.log('== planted offenders ==');
  const widthOnly = planted(CSS, '@media (min-width: 1400px) and (min-height: 900px) { :root { --rr-pop-zoom: 1.5; } }', '@media (min-width: 1400px) { :root { --rr-pop-zoom: 1.5; } }   /* planted */', 'width only');
  r = await open(browser, { w: 1536, h: 737, css: widthOnly });
  m = await step2(r.pg, true);
  T('X-Z1 PLANTED: the step by width alone (1.5 on his laptop) → step 2 runs past the window (caught)', m.over > 0, m.over);
  await r.ctx.close();
  const twoCols = planted(CSS, '  .cd-col.cd-2up .cd-fields { grid-template-columns: 1fr 1fr 1fr; }', '', 'two columns');
  r = await open(browser, { w: 1536, h: 737, css: twoCols });
  m = await step2(r.pg, true);
  T('X-S1 PLANTED: two columns of questions → with every Yes answered it scrolls again (caught)', m.over > 0, m.over);
  await r.ctx.close();
  const noHead = planted(CSS, '  .cd-col.cd-2up .cd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }', '', 'no one-line head');
  r = await open(browser, { w: 1536, h: 737, css: noHead });
  m = await step2(r.pg, true);
  T('X-S2 PLANTED: the "View on …" button back on its own line → caught (it sits under the name, and the step scrolls)', !(m.link && m.link.t < m.name.b) && m.over > 0, { over: m.over, name: m.name, link: m.link });
  await r.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
