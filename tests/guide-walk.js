// ══ tests/guide-walk.js — walk every guide, every step, headless ══════════
//
// Brad, after a manual walk of ONE guide found eight defects in nine steps:
// "need to keep auditing the help menus unattended."
//
// The manual walk drove his real signed-in Chrome. That cannot run unattended:
// the extension drops, and a backgrounded tab freezes its timers and
// animations — which produced two findings that had to be withdrawn. This
// replaces it with something that runs anywhere, every time, and never sleeps.
//
// It boots the REAL app/index.html headless, fills `state` with synthetic
// data, calls the REAL page builders, then for every guide runs its `open()`
// and resolves every step's selector THE WAY THE TOUR ENGINE DOES — same
// query, same first-visible rule, same `wrap` climb. If a step points at
// nothing on the page it is supposed to be about, this says so by name.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · card placement and overlap — that is layout-check's job
//   · advance / await behaviour — that is guide-follow.js's job
//   · anything only true of real Google data
// It answers exactly one question: does every step point at something real?
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-walk needs playwright and it is not installed.');
  console.log('          Run `npm install` (it is a declared devDependency).');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Synthetic collection: enough shape for every page builder to render, and
// chosen to exercise the cases the guides talk about — an engine (grouping),
// a stock car (no grouping), a dashed relative, something for sale, something
// wanted, something sold.
const SEED = `
(function () {
  const mk = (n,t,road,desc,v,vd) => ({ itemNum:n, itemType:t, roadName:road, description:desc,
    variation:v, varDesc:vd, era:'Lionel Postwar', _era:'lionel_postwar', gauge:'O',
    yearProd:'1955', manufacturer:'Lionel', estValue:'120', refLink:'' });
  const M = [
    mk('3376','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','1','unpainted blue molded shell with white heat stamped lettering'),
    mk('3376','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','2','unpainted blue molded shell with yellow heat stamped lettering'),
    mk('3376-160','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','1','unpainted green molded shell with yellow heat stamped lettering'),
    mk('773','Steam Engine','New York Central','4-6-4 Steam Locomotive','1','with 773W tender'),
    mk('6464-275','Boxcar','State of Maine','Boxcar','1','blue red white'),
    mk('2333','Diesel','Santa Fe','F-3 AA Units','1','early screen')
  ];
  state.masterData = M;
  state.masterByItem = new Map();
  M.forEach(m => { const k = String(m.itemNum);
    if (!state.masterByItem.has(k)) state.masterByItem.set(k, []);
    state.masterByItem.get(k).push(m); });
  const P = {}; let id = 46001, row = 2;
  [['3376','1'],['773','1'],['6464-275','1'],['2333','1']].forEach(([n,v]) => {
    P[n+'|'+v+'|'+row] = { itemNum:n, variation:v, owned:true, inventoryId:String(id++), row:row++,
      condition:'8', priceItem:'45', userEstWorth:'120', datePurchased:'2026-08-06',
      photoItem:'', notes:'', era:'Lionel Postwar', location:'' };
  });
  state.personalData = P;
  state.forSaleData = { fs1: { itemNum:'6464-275', variation:'1', inventoryId:'46003', askingPrice:'50', dateListed:'2026-08-01', row:2 } };
  state.wantData    = { w1:  { itemNum:'2333', variation:'1', row:2, targetPrice:'300' } };
  state.upgradeData = { u1:  { itemNum:'773',  variation:'1', row:2, targetPrice:'900' } };
  state.soldData    = { s1:  { itemNum:'3376', variation:'2', row:2, salePrice:'60', dateSold:'2026-07-01' } };
  try { if (typeof buildPartnerMap === 'function') buildPartnerMap(); } catch (e) {}
  try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
})();
`;

// The tour engine's own resolution rule, reproduced exactly. If this and
// tutorial.js ever disagree, this audit is lying — so it is written to match
// resolve() line for line rather than approximating it.
const RESOLVE = `
window._walkResolve = function (step) {
  if (!step.selector) return { kind: 'narration' };
  var cands = document.querySelectorAll(step.selector), el = null;
  for (var c = 0; c < cands.length; c++) { if (cands[c].offsetParent !== null) { el = cands[c]; break; } }
  if (el && step.wrap) el = el.closest(step.wrap) || el;
  if (!el) return { kind: 'MISS', matched: cands.length };
  var b = el.getBoundingClientRect();
  return { kind: 'hit', tag: el.tagName, id: el.id || '',
           text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
           w: Math.round(b.width), h: Math.round(b.height) };
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-guidewalk-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    // Nothing may reach the network: no Google, no CDN. A guide audit that
    // depends on a live service is an audit that fails for the wrong reason.
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);

    const booted = await page.evaluate(() => ({
      guides: typeof GUIDES !== 'undefined' ? Object.keys(GUIDES).length : 0,
      engine: typeof _guidedTour
    }));
    ok('the real app boots headless with its guides loaded',
       booted.guides > 0 && booted.engine === 'function', JSON.stringify(booted));
    if (!booted.guides) throw new Error('no guides — nothing to walk');

    await page.evaluate(SEED);
    await page.evaluate(RESOLVE);
    await page.waitForTimeout(400);

    const seeded = await page.evaluate(() => ({
      owned: Object.keys(state.personalData || {}).length,
      master: (state.masterData || []).length,
      dash: !!document.querySelector('.dash-desktop-actions')
    }));
    ok('the synthetic collection renders through the real page builders',
       seeded.owned > 0 && seeded.master > 0 && seeded.dash, JSON.stringify(seeded));

    const guideIds = await page.evaluate(() => Object.keys(GUIDES));

    for (const gid of guideIds) {
      const res = await page.evaluate(async (gid) => {
        const g = GUIDES[gid];
        try { if (typeof g.open === 'function') g.open(); } catch (e) {}
        await new Promise(r => setTimeout(r, 450));
        const out = [];
        for (let i = 0; i < g.steps.length; i++) {
          const step = g.steps[i];
          let waited = 0;
          try { if (typeof step.before === 'function') waited = step.before() || 0; } catch (e) {}
          await new Promise(r => setTimeout(r, Math.min(waited || 0, 1200) + 120));
          const r = window._walkResolve(step);
          out.push({ n: i + 1, title: step.title || '(no title)', selector: step.selector || null,
                     optional: !!step.optional, awaits: typeof step.awaitUser === 'function', r });
        }
        // Leave nothing behind for the next guide.
        try { if (typeof _gtEnd === 'function') _gtEnd(); } catch (e) {}
        try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
        return out;
      }, gid);
      report.push({ guide: gid, steps: res });
      await page.waitForTimeout(200);
    }

    // ── the assertions ──
    const all = report.flatMap(g => g.steps.map(s => ({ guide: g.guide, ...s })));
    const misses = all.filter(s => s.r.kind === 'MISS');
    const hardMisses = misses.filter(s => !s.optional && !s.awaits);

    console.log('');
    console.log('  ── walked ' + report.length + ' guides, ' + all.length + ' steps ──');
    for (const g of report) {
      const m = g.steps.filter(s => s.r.kind === 'MISS');
      console.log('     ' + g.guide.padEnd(24) + g.steps.length + ' steps, ' +
                  (m.length ? m.length + ' miss(es)' : 'all resolved'));
    }
    if (misses.length) {
      console.log('');
      console.log('  ── every step that pointed at nothing ──');
      for (const s of misses)
        console.log('     [' + (s.optional ? 'optional' : s.awaits ? 'waits   ' : 'REQUIRED') + '] ' +
                    s.guide + ' #' + s.n + ' "' + s.title + '"  ' + s.selector);
    }
    console.log('');

    ok('every REQUIRED step points at something real on its own page',
       hardMisses.length === 0,
       hardMisses.map(s => s.guide + ' #' + s.n + ' ' + s.selector).join(' | '));

    // A spotlight has to be big enough to see and small enough to mean
    // something. Ringing an entire page container tells the user nothing.
    //
    // HONESTY NOTE: no guide currently trips either of these, so neither can
    // be drill-proven by breaking a guide — the biggest real spotlight is the
    // sidebar at 261x836 and the smallest is a 70x32 nav item, both a long way
    // from the thresholds. They were proven instead by lowering the numbers
    // until real steps tripped them, which shows the comparison and the
    // reporting work; the thresholds themselves are a judgement, not a
    // measurement. They exist to catch a future step that points at .main or
    // at a zero-height wrapper, which has happened before (v0.9.1358).
    const huge = all.filter(s => s.r.kind === 'hit' && s.r.w >= 1300 && s.r.h >= 700);
    ok('no step spotlights something the size of the whole page',
       huge.length === 0,
       huge.map(s => s.guide + ' #' + s.n + ' ' + s.selector + ' ' + s.r.w + 'x' + s.r.h).join(' | '));

    const tiny = all.filter(s => s.r.kind === 'hit' && (s.r.w < 8 || s.r.h < 8));
    ok('no step spotlights something too small to see',
       tiny.length === 0,
       tiny.map(s => s.guide + ' #' + s.n + ' ' + s.r.w + 'x' + s.r.h).join(' | '));

    ok('walking every guide raises no page errors',
       errs.length === 0, errs.slice(0, 4).join(' | '));

    fs.writeFileSync(path.join(dir, 'walk.json'), JSON.stringify(report, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
