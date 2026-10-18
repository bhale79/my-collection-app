#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// "A BOX FOR THIS ITEM IS ALREADY IN YOUR COLLECTION" — ONLY A LOOSE BOX
// v0.9.1984
//
// Brad, 2026-10-18, Add step 1 for 3376 (Bronx Zoo car): "why does it think i
// have a box for this item?" His collection: 3376 Var 1 (has box) + 3376-BOX,
// grouped together, + 3376-160 (no box). The box exists but already belongs to
// his first 3376. Step 1 asked its own question — any owned 3376-BOX at all —
// while the save asks findGroupingCandidates (wizard.js), which skips a box
// already in a group. The screen promised a box the save would never link.
// Brad: "yes".
//
//   L1  his exact case: 3376-BOX grouped with 3376 → no box message, no tick box
//   L2  a loose 3376-BOX (no group) → the message and the tick box show
//   L3  a box sold / not owned → no message
//   L4  step 1 and the save agree: the message shows exactly when the save
//       would offer the box
//   X*  PLANTED: the old "any 3376-BOX" question is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  loose_box_1984_tests needs playwright and it is not installed.'); process.exit(1); }
const APPDIR = path.join(__dirname, '..', 'app');
const WS = fs.readFileSync(path.join(APPDIR, 'wizard-suggestions.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 500))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const MASTER = [{ itemNum: '3376', variation: '1', _era: 'pw', _tab: 'Lionel PW - Items', manufacturer: 'Lionel', roadName: 'Bronx Zoo', itemType: 'Stock', description: 'Operating Bronx Zoo Car', yearProd: '1962' }];
const BRAD = {   // his three rows, as the app holds them
  '445': { itemNum: '3376-160', variation: '', owned: true, inventoryId: '445', groupId: '', hasBox: 'No' },
  '447': { itemNum: '3376', variation: '1', owned: true, inventoryId: '447', groupId: 'GRP-3376-1792330598184', hasBox: 'Yes', boxCond: '5' },
  '448': { itemNum: '3376-BOX', variation: '', owned: true, inventoryId: '448', groupId: 'GRP-3376-1792330598184', hasBox: 'Yes', boxCond: '5' },
};
const LOOSE = { '448': { itemNum: '3376-BOX', variation: '', owned: true, inventoryId: '448', groupId: '', boxCond: '6' } };
const NOT_OWNED = { '448': { itemNum: '3376-BOX', variation: '', owned: false, inventoryId: '448', groupId: '', boxCond: '6' } };

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const step1 = async (pd, src) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', rt => {
      const u = rt.request().url();
      if (!u.startsWith('file://')) return rt.abort();
      if (src && u.split('?')[0].endsWith('/app/wizard-suggestions.js')) return rt.fulfill({ body: src, contentType: 'application/javascript' });
      return rt.continue();
    });
    await pg.goto('file://' + path.join(APPDIR, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(([master, pd]) => {
      state.masterData = master.slice(); state.personalData = JSON.parse(JSON.stringify(pd));
      wizard.tab = 'collection'; wizard.data = { itemNum: '3376' };
      const el = document.createElement('div'); el.id = 'wiz-match'; document.body.appendChild(el);
      lookupItem('3376');
      const saveWould = findGroupingCandidates({ itemNum: '3376' }).some(c => c.type === 'box');
      return { text: el.textContent.replace(/\s+/g, ' '), tick: !!el.querySelector('#wiz-group-box'), saveWould };
    }, [MASTER, pd]);
    await ctx.close();
    return Object.assign(r, { errs, msg: /box for this item is already in your collection/i.test(r.text) });
  };

  let r = await step1(BRAD);
  T('L1 Brad\'s 3376: the box is grouped with his first 3376 → no "box already in your collection", no tick box', !r.msg && !r.tick, r);
  T('L1 …and the catalog line still shows (Found: Bronx Zoo)', /Found:/.test(r.text) && /Bronx Zoo/.test(r.text), r.text);
  T('page errors', r.errs.length === 0, r.errs);
  const brad = r;
  r = await step1(LOOSE);
  T('L2 a loose 3376-BOX → the message and the tick box show', r.msg && r.tick, r);
  const loose = r;
  r = await step1(NOT_OWNED);
  T('L3 a 3376-BOX no longer owned → no message', !r.msg && !r.tick, r);
  T('L4 step 1 and the save agree in all three cases', [brad, loose, r].every(x => x.msg === x.saveWould), [brad, loose, r].map(x => [x.msg, x.saveWould]));

  console.log('== X · planted ==');
  const OLD = planted(WS, ".some(c => c.type === 'box');",
    ".some(c => c.type === 'box') || Object.keys(state.personalData).some(k => state.personalData[k].itemNum === trimmed + '-BOX' && state.personalData[k].owned);",
    'old question');
  r = await step1(BRAD, OLD);
  T('X-L1 PLANTED: the old "any owned 3376-BOX" question → the grouped box is offered again (caught)', r.msg && !r.saveWould, r);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
