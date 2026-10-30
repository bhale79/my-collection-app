#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EVERY ROAD FROM THE PHOTO INBOX INTO THE ADD SCREEN — v0.9.2053
// (real Chromium, the REAL app, set up as an iPhone: 390×844, touch, Safari UA)
//
// Mike (mkcaruso, 2026-10-29, iPhone, MTH 20-20169-3 CSX Dash-8): "Photos get
// uploaded but I get message that the app hasn't finished saving them", and an
// Add screen that opened with the number blank. The audit
// (AUDIT_2026-10-29_MIKE_INBOX_ADD.md) walked 29 roads; this is that walk made
// permanent, with the eight fixes of PLAN_2026-10-30_MIKE_INBOX_FIXES.md
// ([stated] Brad "build it") and the ninth the build found.
//
//   G  the reader only GUESSED: Add asks "Add it as 20-20169-3?" — yes fills it
//      in, "It's something else" is the no-number road, Back is neither; the
//      card no longer says "no number"; the sales list asks too; no guess at
//      all = the no-number road as before
//   M  ONE maker-name rule: M.T.H. / Mike's Train House / RailKing / Premier
//      match the MTH row; Marx against an Atlas row still does NOT
//   K  MTH family numbers: 20-20169 and 2020169 offer 20-20169-1/-2/-3
//   (R, T, L, E, H, S: inbox_add_roads_more_2053_tests.js)
//   R  the iPhone restarted the app mid-add: no "spoken for" on the retry; a
//      live hold from another opening still warns; a real unfinished save warns
//   T  Item Type switched away and back keeps the number and the photo views
//   L  the catalog still loading: waits, then matches; gives up honestly
//   E  no "Scanning and photo ID" explainer over an inbox add (an ordinary
//      first add still gets it)
//   H  a HAND-MADE entry from the inbox files its inbox photos when it saves
//   S  what the audit found fine stays fine (closing releases, Back keeps the
//      number, a double tap holds once)
//   P  PLANTED: in inbox_add_roads_planted_2053_tests.js (same harness:
//      tests/lib/inbox-roads.js) — each fix undone turns its road red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const { chromium, boot, open, card, st, tapAdd, spokenFor, ROADS, read, plant, PIECES, shortWaitConfig } = require('./lib/inbox-roads');
const fs = require('fs');
if (!chromium) { console.log('FAILED  —  inbox_add_roads_2053_tests needs playwright and it is not installed.'); process.exit(1); }
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (d === undefined ? '' : (typeof d === 'string' ? d : JSON.stringify(d))))); c ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';   // the pre-installed browser (browser_launch_path_tests)
  const br = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== G · the reader only guessed ==');
    {
      const r = await ROADS.guessYes(br);
      ok('G1 the card box is empty (a guess is offered, not entered — v0.9.1068)', r.c.box === '', r.c);
      ok('G2 …and the card no longer says "No number picked up" under a headline showing the number', /isn.t sure of the number/.test(r.c.info) && !/No number picked up/.test(r.c.info), r.c.info);
      ok('G3 Add ASKS "Add it as 20-20169-3?" — the Add screen does not open yet', !!r.q.dialog && /Add it as 20-20169-3\?/.test(r.q.dialog) && !r.q.open, r.q);
      ok('G4 "Yes" opens the Add screen with the catalog row filled in (Mike\'s blank box is gone)', r.a.open && r.a.matched === '20-20169-3' && r.a.itemNum === '20-20169-3' && !r.a.noNumber, r.a);
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', guess: true });
      await card(b); await tapAdd(b, 400); await b.pg.click('#_ac-no'); await b.pg.waitForTimeout(900);
      const a = await st(b);
      ok('G5 "It\'s something else" is the no-number road, as before (Brad\'s blueprint way out)', a.open && a.noNumber && !a.itemNum, a);
      await b.ctx.close();
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', guess: true });
      await card(b); await tapAdd(b, 400); await b.pg.keyboard.press('Escape'); await b.pg.waitForTimeout(600);
      const a = await st(b);
      ok('G6 backing out of the question (Esc / Back) is NEITHER — no Add screen, the card stays', !a.open && a.cardOpen && !a.dialog, a);
      await b.ctx.close();
    }
    {
      const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', guess: true });
      await card(b); await b.pg.click('#pin-rv-sell'); await b.pg.waitForTimeout(400);
      const q = await st(b); if (q.dialog) { await b.pg.click('#_ac-yes'); await b.pg.waitForTimeout(900); }
      const a = await st(b);
      ok('G7 "Add to my sales list" asks the same question; yes = the item, set to list for sale', !!q.dialog && a.open && a.matched === '20-20169-3' && a.sale, { q: q.dialog, a });
      await b.ctx.close();
    }
    {
      const b = await boot(br, {});   // nothing read at all
      await card(b); await tapAdd(b);
      const a = await st(b);
      ok('G8 no guess at all: the no-number road with no question (unchanged)', a.open && a.noNumber && !a.dialog, a);
      await b.ctx.close();
    }

    console.log('\n== M · one maker-name rule ==');
    for (const mfr of ['M.T.H.', 'Mike\'s Train House', 'RailKing', 'Premier', 'MTH Electric Trains', 'MTH']) {
      const a = await ROADS.makerSpelled(br, mfr);
      ok('M  maker read as "' + mfr + '" → the MTH catalog row, not a hand-made "isn\'t in the catalog"', a.open && !a.manual && a.matched === '20-20169-3', a);
    }
    {
      const b = await boot(br, { num: '1303', mfr: 'Marx' });
      await card(b); await tapAdd(b); const a = await st(b);
      ok('M7 Marx photo, Atlas 1303 in the catalog: still a hand-made Marx entry (v0.9.941 kept)', a.open && a.manual && a.manualNum === '1303', a);
      await b.ctx.close();
    }

    console.log('\n== K · MTH family numbers ==');
    for (const num of ['20-20169', '2020169']) {
      const a = await ROADS.family(br, num);
      ok('K  "' + num + '" → the family is offered (20-20169-1/-2/-3), not a hand-made entry', a.open && !a.manual && /20-20169-1/.test(a.toast) && /20-20169-3|and \d+ more|20-20169-2/.test(a.toast), { manual: a.manual, toast: a.toast });
    }

  } finally { await br.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
