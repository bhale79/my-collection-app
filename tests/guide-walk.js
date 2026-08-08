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

const { SEED, RESOLVE, SHAPE } = require('./lib/guide-fixture');

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
    // Under RR_FIXTURE=empty, owning nothing IS the fixture — that is the whole
    // point of that shape. What must still be true in every shape is that the
    // reference catalogue loaded and the dashboard built; without those, the
    // walk below would be measuring a failed boot and calling it a clean run.
    ok('the synthetic collection renders through the real page builders',
       seeded.master > 0 && seeded.dash &&
       (SHAPE === 'empty' ? seeded.owned === 0 : seeded.owned > 0),
       JSON.stringify({ ...seeded, shape: SHAPE }));

    const guideIds = await page.evaluate(() => Object.keys(GUIDES));

    for (const gid of guideIds) {
      const res = await page.evaluate(async (gid) => {
        const g = GUIDES[gid];
        try { if (typeof g.open === 'function') g.open(); } catch (e) {}
        await new Promise(r => setTimeout(r, 450));

        // ── v0.9.1382: put the app where the guide expects to find the user ──
        // Three guides describe buttons that only exist on an item's own page,
        // and the guide's own `open()` deliberately stops at the LIST — the
        // step in between waits for the user to tap an item. Without standing
        // in for that tap, those steps read as "optional, absent" and the
        // audit verifies nothing about them.
        //
        // These are exactly the selectors that were SILENTLY DEAD for weeks
        // before v0.9.1367 (#detail-list-sale and #detail-record-sale matched
        // no button at all), so leaving them unchecked is leaving the hole
        // that produced the bug.
        const NEEDS_ITEM_PAGE = { 'list-for-sale': 1, 'mark-sold': 1, 'remove-item': 1 };
        if (NEEDS_ITEM_PAGE[gid]) {
          try {
            const pd = Object.values(state.personalData || {})[0];
            if (pd && typeof _openOwnedByInvId === 'function') _openOwnedByInvId(pd.inventoryId);
            await new Promise(r => setTimeout(r, 700));
          } catch (e) {}
        }
        const out = [];
        for (let i = 0; i < g.steps.length; i++) {
          const step = g.steps[i];
          let waited = 0;
          try { if (typeof step.before === 'function') waited = step.before() || 0; } catch (e) {}
          await new Promise(r => setTimeout(r, Math.min(waited || 0, 1200) + 120));

          // ── v0.9.1382: stand in for the user, step by step ──────────────
          // The add-item guide's later steps only exist once a number has been
          // typed and a match picked. Priming BEFORE the guide does not work:
          // step 2's own before() calls openWizard, which resets the wizard and
          // wipes anything typed ahead of it. So the priming happens HERE,
          // after each step's before() has had its turn.
          if (gid === 'add-item') {
            try {
              const inp = document.getElementById('wiz-input');
              if (i + 1 >= 3 && inp && !String(inp.value).trim()) {
                inp.focus();
                '3376'.split('').forEach(function (c) {
                  inp.value += c;
                  inp.dispatchEvent(new InputEvent('input', { bubbles: true, data: c, inputType: 'insertText' }));
                });
                await new Promise(r => setTimeout(r, 900));
              }
              // From step 6 on, the guide is talking about the VARIATION
              // screen, which only exists after a match is chosen.
              if (i + 1 >= 6) {
                const box = document.getElementById('wiz-suggestions');
                if (box && box.offsetParent !== null) {
                  const row = Array.from(box.querySelectorAll('div,button'))
                    .find(function (e) { return /^3376\b/.test((e.innerText || '').trim()); });
                  if (row) { row.click(); await new Promise(r => setTimeout(r, 900)); }
                }
              }
            } catch (e) {}
          }
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

    // The three selectors that were dead for weeks. They are optional steps —
    // the item page is not always open — so the miss list alone would never
    // report them coming loose again. With the page primed above they MUST
    // resolve, and this says so by name.
    // Scoped to a collection that HAS items. Under RR_FIXTURE=empty these three
    // buttons are correctly absent — there is no item page to put them on — and
    // demanding them there would be demanding the impossible. The step that
    // used to check they exist still checks it, on the shape where it means
    // something.
    const DEAD_ONCE = SHAPE === 'default'
      ? { 'list-for-sale': '#detail-list-sale',
          'mark-sold': '#detail-record-sale',
          'remove-item': '#detail-remove-item' }
      : {};
    const broken = [];
    for (const gid of Object.keys(DEAD_ONCE)) {
      const g = report.find(r => r.guide === gid);
      const step = g && g.steps.find(s => s.selector === DEAD_ONCE[gid]);
      if (!step) broken.push(gid + ': no step uses ' + DEAD_ONCE[gid]);
      else if (step.r.kind !== 'hit') broken.push(gid + ' ' + DEAD_ONCE[gid] + ' -> ' + step.r.kind);
    }
    ok('the three item-page buttons that were once dead all resolve again' +
       (SHAPE === 'default' ? '' : '  (skipped: fixture is ' + SHAPE + ')'),
       broken.length === 0, broken.join(' | '));

    // ── v0.9.1382: Brad's green giraffe car, checked forever ──────────────
    // The seeded catalogue holds a 3376 with two variations and a 3376-160
    // relative, which is his exact case. With the wizard primed to the
    // variation screen the "Also catalogued separately" block must be on
    // screen, must name the relative, and must describe it in the master's own
    // words — that last part is what made it useful rather than a bare number.
    const kin = await page.evaluate(async () => {
      try {
        if (typeof openWizard === 'function') openWizard('collection');
        await new Promise(r => setTimeout(r, 700));
        const inp = document.getElementById('wiz-input');
        if (!inp) return { err: 'no wizard input' };
        inp.focus();
        '3376'.split('').forEach(function (c) {
          inp.value += c;
          inp.dispatchEvent(new InputEvent('input', { bubbles: true, data: c, inputType: 'insertText' }));
        });
        await new Promise(r => setTimeout(r, 900));
        const box = document.getElementById('wiz-suggestions');
        const row = box && Array.from(box.querySelectorAll('div,button'))
          .find(function (e) { return /^3376\b/.test((e.innerText || '').trim()); });
        if (!row) return { err: 'no 3376 row offered' };
        row.click();
        await new Promise(r => setTimeout(r, 900));
        const note = document.getElementById('wiz-kin-note');
        return { present: !!note, text: note ? (note.innerText || '').replace(/\s+/g, ' ') : '' };
      } catch (e) { return { err: e.message.slice(0, 90) }; }
    });
    ok('the dashed-relative pointer appears on the variation screen',
       !!kin.present, kin.err || 'no #wiz-kin-note rendered');
    ok('…and it names the relative in the catalogue\'s own words',
       /3376-160/.test(kin.text || '') && /green/.test(kin.text || ''),
       (kin.text || '').slice(0, 120));

    fs.writeFileSync(path.join(dir, 'walk.json'), JSON.stringify(report, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
