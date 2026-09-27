#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// WIZARD STEP COUNT — v0.9.1822   (real Chromium, the REAL wizard, no stubs)
//
// Release readiness S8. "Step 1 of 6" became "Step 2 of 8" after choosing
// engine + tender, and the bar slid backwards. The total is a live estimate:
// Has box? Instruction sheet? Error item? each add a step, so it can never be
// known up front ("hide it until the path is known" would hide it nearly
// always). Brad: yes to — the label says only "Step N"; the bar keeps a
// per-step high-water mark for the run so a grown total cannot slide it
// back; Back still moves it back; the last step is always full.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  wizard_step_count_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);

  const out = await pg.evaluate(async () => {
    window.state = window.state || {};
    state.masterData = [{ itemNum: '2343', variation: '1', itemType: 'Diesel', roadName: 'Santa Fe', _era: 'pw' }];
    state.personalData = {}; state.contactsData = []; state.savedReports = [];
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    openWizard('collection');
    await new Promise(r => setTimeout(r, 300));
    const read = () => ({ label: document.getElementById('wizard-step-label').textContent, pct: parseFloat(document.getElementById('wizard-progress').style.width) });
    const visIdx = () => wizard.steps.map((s, i) => i).filter(i => !(wizard.steps[i].skipIf && wizard.steps[i].skipIf(wizard.data)));
    const visible = () => visIdx().length;
    const r = {};
    r.t0 = read(); r.total0 = visible();
    // stand on the THIRD visible step, then make the path LONGER without moving
    wizard.step = visIdx()[2]; renderWizardStep(); r.t2 = read();
    Object.assign(wizard.data, { hasBox: 'Yes', hasIS: 'Yes', isError: 'Yes', hasMasterBox: 'Yes' });
    renderWizardStep(); r.t2grown = read(); r.totalGrown = visible();
    // Back to the second visible step: the bar moves back (that step's own high-water), never forward
    wizard.step = visIdx()[1]; renderWizardStep(); r.t1back = read();
    // the last step is always full
    wizard.step = wizard.steps.length - 1; renderWizardStep(); r.last = read();
    // a NEW run starts clean (the high-water is per run)
    closeWizard && typeof closeWizard === 'function' ? closeWizard() : null;
    openWizard('collection');
    await new Promise(r => setTimeout(r, 200));
    r.fresh = read();
    return r;
  });
  await browser.close();

  T('A1  the label says "Step 1" and never "of N"', /· Step 1$/.test(out.t0.label) && !/ of /.test(out.t0.label), out.t0);
  T('A2  on step 3 it says "Step 3"', /· Step 3$/.test(out.t2.label), out.t2);
  T('A3  the answers really grew the path (more visible steps than at the start)', out.totalGrown > out.total0, { before: out.total0, after: out.totalGrown });
  T('A4  …and the bar did NOT slide backwards when the total grew', out.t2grown.pct >= out.t2.pct && /· Step 3$/.test(out.t2grown.label), { before: out.t2, after: out.t2grown });
  T('A5  Back still moves the bar back', out.t1back.pct < out.t2grown.pct && /· Step 2$/.test(out.t1back.label), { back: out.t1back, was: out.t2grown });
  T('A6  the last step is full', out.last.pct === 100, out.last);
  T('A7  a fresh run starts from the beginning again', /· Step 1$/.test(out.fresh.label) && out.fresh.pct < 30, out.fresh);
  T('E1  no page errors', errs.length === 0, errs);

  // B · the source: the label line carries no total, and the offender is caught
  const src = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
  const labelLine = (src.match(/getElementById\('wizard-step-label'\)\.textContent =[^;]*;/) || [''])[0];
  T('B1  the label line has no " of " + total', labelLine.length > 0 && !/of ' \+ total/.test(labelLine), labelLine);
  T('B2  the bar reads a per-step high-water mark for the run', /_progAt\[step\] = Math\.max\(_progAt\[step\] \|\| 0/.test(src));
  T('OFFENDER 1: putting " of N" back on the label -> B1 red', /of ' \+ total/.test("_wizFlowTitle() + ' · Step ' + current + ' of ' + total;"));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
