#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MIKE'S ROADS, EACH FIX UNDONE — v0.9.2053 (real Chromium as an iPhone)
// The planted half of inbox_add_roads_2053_tests.js: each fix is undone in a
// served copy of its app file and the road it fixed must go wrong again — proof
// that every check in the roads suite can fail. Harness: tests/lib/inbox-roads.js.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const { chromium, boot, open, card, st, tapAdd, spokenFor, ROADS, read, plant, PIECES, shortWaitConfig } = require('./lib/inbox-roads');
const fs = require('fs');
if (!chromium) { console.log('FAILED  —  inbox_add_roads_planted_2053_tests needs playwright and it is not installed.'); process.exit(1); }
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (d === undefined ? '' : (typeof d === 'string' ? d : JSON.stringify(d))))); c ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';   // the pre-installed browser (browser_launch_path_tests)
  const br = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== P · planted ==');
    const TOOLS = PIECES['photo-inbox-tools.js'], INBOX = PIECES['photo-inbox.js'];
    {
      const old = plant(TOOLS, "    if (num) return window._pinReviewAdd('new');\n", "    return num ? window._pinReviewAdd('new') : window._pinAddNoNumber();\n", 'router');
      const r = await ROADS.guessYes(br, { 'photo-inbox-tools.js': old });
      ok('P1 the old router (empty box = no-number road) brings Mike\'s blank box back — G3/G4 would fail', !r.q.dialog && r.q.open && r.q.noNumber, r.q);
    }
    {
      const old = plant(INBOX, '    return rrMakerSame(a, b);\n',
        "    a = String(a || '').toLowerCase().trim(); b = String(b || '').toLowerCase().trim();\n    if (!a || !b) return true;\n    var aw = a.split(/\\s+/)[0], bw = b.split(/\\s+/)[0];\n    return a.indexOf(bw) >= 0 || b.indexOf(aw) >= 0;\n", 'maker');
      const a = await ROADS.makerSpelled(br, 'M.T.H.', { 'photo-inbox.js': old });
      ok('P2 the inbox\'s old first-word maker check makes "M.T.H." a hand-made entry — M would fail', a.manual && !a.matched, a);
    }
    {
      const AJ = read('app.js');
      const old = plant(AJ, "        if (!hasExact && s.length > n.length && s.slice(0, n.length) === n) {", "        if (false && !hasExact && s.length > n.length && s.slice(0, n.length) === n) {", 'family');
      const a = await ROADS.family(br, '20-20169', { 'app.js': old });
      ok('P3 without the dashed-family rule "20-20169" is a hand-made entry — K would fail', a.manual, a);
    }
    {
      const old = plant(TOOLS, "          if (storeKey === SETSTAGE_KEY && rec.open && _openId && rec.open !== _openId", "          if (false && storeKey === SETSTAGE_KEY && rec.open && _openId && rec.open !== _openId", 'restart');
      const r = await ROADS.restart(br, { 'photo-inbox-tools.js': old });
      ok('P4 without the earlier-opening rule the restart retry says "spoken for" — R2 would fail', spokenFor(r.a), r.a);
    }
    {
      const WZ = read('wizard.js');
      const old = plant(WZ, "    if (_carryNum) wizard.data.itemNum = _carryNum;\n", '', 'type switch');
      const r = await ROADS.typeSwitch(br, { 'wizard.js': old });
      ok('P5 without the carried number the box comes back blank — T2 would fail', !r.a.itemNum, r.a);
    }
    {
      const WZ = read('wizard.js');
      const old = plant(WZ, "(typeof RR_INBOX_CARRY_KEYS !== 'undefined') ? RR_INBOX_CARRY_KEYS : ", 'false ? [] : ', 'carry list');
      const r = await ROADS.typeSwitch(br, { 'wizard.js': old });
      ok('P5b with the old four-key list the photo views are dropped — T3 would fail', r.man.viewsBefore && !r.a.views, { before: r.man.viewsBefore, after: r.a.views });
    }
    {
      const old = plant(TOOLS, '            } else if (!waited && !_mfrSuppressed && _pinCatalogStillLoading()) {', '            } else if (false) {', 'catalog wait');
      const r = await ROADS.loading(br, true, { 'photo-inbox-tools.js': old });
      ok('P6 without the wait a loading catalog makes a hand-made entry — L1/L2 would fail', r.during.manual, r.during);
    }
    {
      const MS = read('app-misc.js');
      const old = plant(MS, '      if (typeof wizard !== \'undefined\' && wizard && wizard.data && wizard.data._fromInbox) return;\n', '', 'explainer');
      const r = await ROADS.explainer(br, { 'app-misc.js': old });
      ok('P7 without the inbox check the explainer covers the inbox add — E1 would fail', r.inbox.help, r.inbox);
    }
    {
      const WS = read('wizard-save.js');
      const old = plant(WS, "      if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(displayId);\n", '', 'hand-made save');
      const r = await ROADS.handMade(br, { 'wizard-save.js': old });
      ok('P8 a hand-made save that does not arm leaves the photos held — H1 would fail', !r.a.pend['20-20169-3'], r.a.pend);
    }
  } finally { await br.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
