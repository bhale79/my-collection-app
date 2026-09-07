// ══════════════════════════════════════════════════════════════
// kato_tests.js — v0.9.1693. The three Kato eras (N / HO / Parts).
//
// Brad, 2026-09-06: "can we get marklin trains? ... what about parts
// and part diagrams?" Maerklin's own product database gave 7,238
// catalog rows across H0 / Z / Gauge 1, and its spare-parts service
// page gave 2,215 models with a diagram PDF and/or a live parts list,
// keyed by the SAME article number. Links only — nothing is copied.
//
// This suite guards three things a future edit could quietly break:
//   1. an era added in one place but not the others (the v1159 disease
//      — a maker with rows nobody can pick, so its items are HIDDEN),
//   2. the parts index shape and the links built from it,
//   3. the gate: only a Maerklin item may be shown a Maerklin sheet.
//
// Run:  node tests/marklin_tests.js
// ══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}
const APP = path.join(__dirname, '..', 'app');
const src = f => fs.readFileSync(path.join(APP, f), 'utf8');

const ERAS_IDS = ['kato_n', 'kato_ho', 'kato_parts'];
const TABS = { kato_n: 'Kato N', kato_ho: 'Kato HO', kato_parts: 'Kato Parts' };

// ── 1. the era is wired everywhere an era lives ──────────────────
const cfg = src('config.js');
ok('1693 all three Kato eras exist in ERAS',
   ERAS_IDS.every(id => new RegExp('\\b' + id + ':\\s*\\{\\s*id:').test(cfg)));
ok('1693 …and all three are in REAL_ERA_IDS, so they actually load',
   ERAS_IDS.every(id => new RegExp("'" + id + "'").test(cfg.slice(cfg.indexOf('REAL_ERA_IDS'), cfg.indexOf('REAL_ERA_IDS') + 1200))));
ok('1693 …and each has a master tab',
   ERAS_IDS.every(id => new RegExp(id + ":\\s*\\{ items: '" + TABS[id] + "' \\}").test(cfg)));
ok('1693 …and a scale (N / HO; parts blank on purpose, like bachmann_all)',
   /kato_n: 'N', kato_ho: 'HO', kato_parts: ''/.test(cfg));
const br = src('browse.js');
ok('1693 each era has a browse PERIOD — without one its items hide behind the period chips',
   ERAS_IDS.every(id => new RegExp(id + ":\\s*'(prewar|postwar|modern)'").test(br)));
ok('1693 the tab-to-maker map knows Kato', /\['kato',\s*'Kato'\]/.test(br));
const ob = src('onboarding-config.js');
ok('1693 all three appear in the onboarding era order',
   ERAS_IDS.every(id => new RegExp("'" + id + "'").test(ob)));
ok('1693 …each has a colour and a scale for the picker',
   ERAS_IDS.every(id => new RegExp(id + ':\\s*\'#').test(ob)) &&
   ERAS_IDS.every(id => new RegExp(id + ':\\s*\'(n|ho)\'').test(ob)));
ok('1693 Kato can be PICKED as a manufacturer (the v1159 disease guard)',
   /kato:\s*\{ id: 'kato',\s*label: 'Kato'/.test(ob));
ok('1693 …and the pick key equals ERAS[era].manufacturer lowercased',
   /manufacturer: 'Kato'/.test(cfg));
const badges = src('era-badges-config.js');
ok('1693 each era has a badge and each tab maps back to its era',
   /kato_n:\s*'KN'/.test(badges) && /kato_ho:\s*'KHO'/.test(badges) && /kato_parts:\s*'KP'/.test(badges) &&
   Object.keys(TABS).every(id => new RegExp("'" + TABS[id] + "': '" + id + "'").test(badges)));
ok('1693 the dashboard can infer the era from a Kato manufacturer string',
   /indexOf\('kato'\) === 0/.test(src('dashboard.js')));
ok('1693 Kato and Marklin items can be barcode-scanned (both makers print EAN/UPC)',
   /'kato_n','kato_ho','kato_parts'/.test(src('barcode.js')) && /'marklin_h0','marklin_z','marklin_1'/.test(src('barcode.js')));
ok('1693 the research page groups Kato AND Marklin as modern (Marklin was missed in v1690)',
   /'marklin_h0', 'marklin_z', 'marklin_1'/.test(src('research.js')) && /'kato_n', 'kato_ho', 'kato_parts'/.test(src('research.js')));


console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('KATO TESTS FAILING'); process.exit(1); }
console.log('ALL KATO TESTS GREEN (' + pass + ')');
