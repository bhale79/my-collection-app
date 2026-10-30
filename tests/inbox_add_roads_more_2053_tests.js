#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MIKE'S ROADS, PART 2 — v0.9.2053 (real Chromium as an iPhone)
// The second half of inbox_add_roads_2053_tests.js (same harness:
// tests/lib/inbox-roads.js), split so each suite stays well inside the runner's
// three-minute limit:
//   R  the iPhone restarted the app mid-add: no "spoken for" on the retry; a
//      live hold from another opening still warns; a real unfinished save warns
//   T  Item Type switched away and back keeps the number and the photo views
//   L  the catalog still loading: waits, then matches; gives up honestly
//   E  no "Scanning and photo ID" explainer over an inbox add
//   H  a HAND-MADE entry from the inbox files its inbox photos when it saves
//   S  what the audit found fine stays fine
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const { chromium, boot, open, card, st, tapAdd, spokenFor, ROADS, read, plant, PIECES, shortWaitConfig } = require('./lib/inbox-roads');
const fs = require('fs');
if (!chromium) { console.log('FAILED  —  inbox_add_roads_more_2053_tests needs playwright and it is not installed.'); process.exit(1); }
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (d === undefined ? '' : (typeof d === 'string' ? d : JSON.stringify(d))))); c ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';   // the pre-installed browser (browser_launch_path_tests)
  const br = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== R · the iPhone restarted the app mid-add ==');
    {
      const r = await ROADS.restart(br);
      ok('R1 the add held its photos before the restart', r.held.indexOf('20-20169-3') >= 0, r.held);
      ok('R2 after the restart, filing again: NO "Photos already spoken for"', !spokenFor(r.a) && r.a.open && r.a.matched === '20-20169-3', r.a);
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' });
      await b.pg.evaluate(() => localStorage.setItem('rr_inbox_setstage', JSON.stringify({ '20-20169-3': { ts: Date.now() - 60000, open: 'another-tab', beat: Date.now() - 20000,
        files: [{ id: 'm1' }, { id: 'm2' }], link: '', fromFid: '', toFid: '' } })));
      await card(b); await tapAdd(b, 500); const a = await st(b);
      ok('R3 an add still alive in ANOTHER tab (its mark fresh) keeps its hold — the warning stays', spokenFor(a), a);
      await b.ctx.close();
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' });
      await b.pg.evaluate(() => localStorage.setItem('rr_inbox_setstage', JSON.stringify({ '20-20169-3': { ts: Date.now() - 600000, open: 'old-opening', beat: Date.now() - 4 * 60000,
        files: [{ id: 'm1' }, { id: 'm2' }], link: '', fromFid: '', toFid: '' } })));
      await card(b); await tapAdd(b, 700); const a = await st(b);
      ok('R4 a hold from an opening whose mark went quiet (the app was killed with no warning) is let go', !spokenFor(a) && a.open, a);
      await b.ctx.close();
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' });
      await b.pg.evaluate(() => localStorage.setItem('rr_inbox_pending', JSON.stringify({ '20-20169-3': { ts: Date.now() - 60000, files: [{ id: 'm1' }, { id: 'm2' }], link: '', fromFid: '', toFid: '' } })));
      await card(b); await tapAdd(b, 500); const a = await st(b);
      ok('R5 a REAL unfinished save (armed, its photos not moved yet) still warns', spokenFor(a), a);
      await b.ctx.close();
    }

    console.log('\n== T · Item Type switched away and back ==');
    {
      const r = await ROADS.typeSwitch(br);
      ok('T1 to Manual: the number is in Manual\'s number', r.man.manual && r.man.manualNum === '20-20169-3', r.man);
      ok('T2 back to Cataloged: the number is in the box, not blank', r.a.itemNum === '20-20169-3' && r.a.box === '20-20169-3', r.a);
      ok('T3 …and which photo is which view rode along (there was one to keep)', r.man.viewsBefore && r.a.views, { before: r.man.viewsBefore, after: r.a.views });
    }

    console.log('\n== L · the catalog still loading ==');
    {
      const r = await ROADS.loading(br, true);
      ok('L1 no match yet and the catalog still loading: it says so and waits (no hand-made entry)', !r.during.manual && /Looking it up in the catalog/.test(r.during.toast), r.during);
      ok('L2 the catalog arrives: the row is matched as normal', r.a.open && r.a.matched === '20-20169-3' && !r.a.manual, r.a);
    }
    {
      const r = await ROADS.loading(br, false, { 'config.js': shortWaitConfig() });
      ok('L3 it never arrives: after the wait, a hand-made entry with the TRUE reason', r.a.manual && /didn.t finish loading/.test(r.a.toast) && !/isn't in the catalog/.test(r.a.toast), r.a);
    }

    console.log('\n== E · the first-add explainer ==');
    {
      const r = await ROADS.explainer(br);
      ok('E1 an add from the inbox: no "Scanning and photo ID" card over the filled-in Add screen', r.inbox.open && !r.inbox.help, r.inbox);
      ok('E2 …and it was not marked seen: his first ordinary Add still shows it', r.plain.help, r.plain);
    }

    console.log('\n== H · a hand-made entry from the inbox files its photos ==');
    {
      const r = await ROADS.handMade(br);
      ok('H0 an unknown maker against an MTH row is a hand-made entry (the road Mike could reach)', r.before.manual && r.before.manualNum === '20-20169-3', r.before);
      ok('H1 its save ARMS the inbox photos — they file into the item (was: held "not finished saving")',
         !r.a.saveErr && !r.a.stage['20-20169-3'] && !!r.a.pend['20-20169-3'] && JSON.stringify(r.a.pend['20-20169-3']).indexOf('m1') >= 0, { err: r.a.saveErr, stage: r.a.stage, pend: r.a.pend });
    }

    console.log('\n== S · what was fine stays fine ==');
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' });
      await card(b); await tapAdd(b);
      await b.pg.evaluate(() => { try { closeWizard(); } catch (e) {} }); await b.pg.waitForTimeout(250);
      if (await b.pg.$('#_ac-yes')) { await b.pg.click('#_ac-yes'); await b.pg.waitForTimeout(500); }
      const closed = await st(b);
      await card(b); await tapAdd(b, 600); const a = await st(b);
      ok('S1 Discard, then file again: no warning (v0.9.2051 holds)', !Object.keys(closed.stage).length && !spokenFor(a) && a.open, { closed: closed.stage, a });
      await b.ctx.close();
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' });
      await card(b); await b.pg.evaluate(() => { const x = document.getElementById('pin-rv-add'); x.click(); x.click(); }); await b.pg.waitForTimeout(900);
      const a = await st(b);
      await b.pg.evaluate(() => { wizardBack(); }); await b.pg.waitForTimeout(300);
      const back = await st(b);
      ok('S2 a double tap holds the photos once', Object.keys(a.stage).length === 1 && a.matched === '20-20169-3', a.stage);
      ok('S3 Back to the number step keeps the number', back.box === '20-20169-3', back);
      await b.ctx.close();
    }

  } finally { await br.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
