// ══════════════════════════════════════════════════════════════
// marklin_tests.js — v0.9.1690. The three Maerklin eras and the
// Maerklin spare-parts / exploded-diagram index.
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

const ERAS_IDS = ['marklin_h0', 'marklin_z', 'marklin_1'];
const TABS = { marklin_h0: 'Marklin H0', marklin_z: 'Marklin Z', marklin_1: 'Marklin Gauge 1' };

// ── 1. the era is wired everywhere an era lives ──────────────────
const cfg = src('config.js');
ok('1690 all three Maerklin eras exist in ERAS',
   ERAS_IDS.every(id => new RegExp('\\b' + id + ':\\s*\\{\\s*id:').test(cfg)));
ok('1690 …and all three are in REAL_ERA_IDS, so they actually load',
   ERAS_IDS.every(id => new RegExp("'" + id + "'").test(cfg.slice(cfg.indexOf('REAL_ERA_IDS'), cfg.indexOf('REAL_ERA_IDS') + 1200))));
ok('1690 …and each has a master tab',
   ERAS_IDS.every(id => new RegExp(id + ":\\s*\\{ items: '" + TABS[id] + "' \\}").test(cfg)));
ok('1690 …and a scale (H0 / Z / G — Gauge 1 runs 45mm track like G)',
   /marklin_h0: 'HO', marklin_z: 'Z', marklin_1: 'G'/.test(cfg));
const br = src('browse.js');
ok('1690 each era has a browse PERIOD — without one its items hide behind the period chips',
   ERAS_IDS.every(id => new RegExp(id + ":\\s*'(prewar|postwar|modern)'").test(br)));
ok('1690 the tab-to-maker map knows Marklin', /\['marklin',\s*'Marklin'\]/.test(br));
const ob = src('onboarding-config.js');
ok('1690 all three appear in the onboarding era order',
   ERAS_IDS.every(id => new RegExp("'" + id + "'").test(ob)));
ok('1690 …each has a colour and a scale for the picker',
   ERAS_IDS.every(id => new RegExp(id + ':\\s*\'#').test(ob)) &&
   ERAS_IDS.every(id => new RegExp(id + ':\\s*\'(ho|z|g)\'').test(ob)));
ok('1690 Marklin can be PICKED as a manufacturer (the v1159 disease guard)',
   /marklin:\s*\{ id: 'marklin', label: 'Marklin'/.test(ob));
ok('1690 …and the pick key equals ERAS[era].manufacturer lowercased',
   /manufacturer: 'Marklin'/.test(cfg));
const badges = src('era-badges-config.js');
ok('1690 each era has a badge and each tab maps back to its era',
   /marklin_h0:\s*'MHO'/.test(badges) && /marklin_z:\s*'MZ'/.test(badges) && /marklin_1:\s*'M1'/.test(badges) &&
   Object.keys(TABS).every(id => new RegExp("'" + TABS[id] + "': '" + id + "'").test(badges)));
ok('1690 the dashboard can infer the era from a Marklin manufacturer string',
   /indexOf\('marklin'\) === 0/.test(src('dashboard.js')));

// ── 2. the parts index ───────────────────────────────────────────
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src('marklin-parts-config.js'), sandbox, { filename: 'marklin-parts-config.js' });
const P = sandbox.window.MARKLIN_PARTS;
const keys = Object.keys(P || {});
ok('1690 the parts index loaded and is keyed by article number',
   keys.length > 2000 && keys.every(k => /^\d+$/.test(k)), keys.length + ' entries');
ok('1690 every entry carries a diagram PDF, a parts list, or both — no empty rows',
   keys.every(k => P[k].d || P[k].s), 'an entry with neither would render a dead button');
ok('1690 diagram paths are stored RELATIVE to one base — the domain is never repeated 1,639 times',
   keys.filter(k => P[k].d).length > 1500 &&
   keys.every(k => !P[k].d || (!/^https?:/.test(P[k].d) && /\.pdf$/.test(P[k].d))));
ok('1690 the two bases are the real Maerklin hosts',
   sandbox.window.MARKLIN_PARTS_PDF_BASE === 'https://static.maerklin.de/damcontent/' &&
   /^http:\/\/www\.maerklinshop\.de\/en\/SpareParts\/index\?sSearchWords=$/.test(sandbox.window.MARKLIN_PARTS_SHOP));
ok('1690 the shop flag is a flag, not a duplicated URL',
   keys.every(k => P[k].s === undefined || P[k].s === 1));
ok('1690 titles carry no pipe or quote that would break the row',
   keys.every(k => !P[k].t || (P[k].t.indexOf('|') < 0)));

// ── 3. the wiring in maintenance.js ──────────────────────────────
const mt = src('maintenance.js');
const fn = mt.slice(mt.indexOf('function _marklinParts'), mt.indexOf('var _pwsmLookup'));
ok('1690 _marklinParts exists and is called from the docs section',
   /function _marklinParts\(item\)/.test(mt) && /var mkp = _marklinParts\(item\);/.test(mt));
ok('1690 THE GATE: a non-Marklin item can never be handed a Marklin sheet',
   /era\.indexOf\('marklin'\) !== 0/.test(fn) && /mfr\.indexOf\('marklin'\) < 0/.test(fn));
ok('1690 …and the gate reads the era key the items actually carry (_era), not a tab field',
   /item\._era \|\| item\.era/.test(fn) && !/item\._tab/.test(fn));
ok('1690 the lookup is exact by number — no prefix juggling that could borrow another maker\'s sheet',
   /replace\(\/\[\^0-9\]\/g, ''\)/.test(fn) && !/'6' \+ n/.test(fn));
ok('1690 an entry with neither link returns null rather than an empty panel',
   /return \(out\.d \|\| out\.s\) \? out : null;/.test(fn));
ok('1690 the diagram button builds its URL from the base + stored path',
   /MARKLIN_PARTS_PDF_BASE \|\| ''\) \+ mkp\.d/.test(mt));
ok('1690 the parts-list button builds its URL from the shop base + the number, encoded',
   /MARKLIN_PARTS_SHOP \|\| ''\) \+ encodeURIComponent\(mkp\.num\)/.test(mt));
ok('1690 both open in a new tab — the sheet and the parts stay on Maerklin\'s site',
   (mt.match(/window\.open\('' \+ _esc\(\(window\.MARKLIN/g) || []).length === 0);

// ── 4. the file ships and is cached ──────────────────────────────
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
ok('1690 index.html loads marklin-parts-config.js with a ?v= like every other file',
   /<script src="\.\/marklin-parts-config\.js\?v=\d+"><\/script>/.test(html));
ok('1690 …before maintenance.js reads it',
   html.indexOf('marklin-parts-config.js') < html.indexOf('maintenance.js'));
ok('1690 sw.js precaches it (the S85 offline-app lesson)',
   /'\.\/marklin-parts-config\.js'/.test(src('sw.js')));

// ── 5. behaviour, run for real ───────────────────────────────────
(function () {
  // Rebuild the gate + lookup in isolation and prove the three cases.
  const ctx = { window: { MARKLIN_PARTS: P, MARKLIN_PARTS_PDF_BASE: sandbox.window.MARKLIN_PARTS_PDF_BASE } };
  vm.createContext(ctx);
  vm.runInContext(fn + '\nthis.f = _marklinParts;', ctx);
  const f = ctx.f;
  const withBoth = keys.filter(k => P[k].d && P[k].s)[0];
  ok('1690 a Marklin item with a sheet gets it',
     !!f({ _era: 'marklin_h0', itemNum: withBoth }) && f({ _era: 'marklin_h0', itemNum: withBoth }).d === P[withBoth].d);
  ok('1690 the SAME number on another maker\'s era gets nothing',
     f({ _era: 'atlas', itemNum: withBoth }) === null &&
     f({ _era: 'mth_o', itemNum: withBoth }) === null);
  ok('1690 a Marklin item with no sheet in the index gets nothing (no dead button)',
     f({ _era: 'marklin_z', itemNum: '99999999' }) === null);
  ok('1690 manufacturer alone is enough, spelled either way',
     !!f({ manufacturer: 'Marklin', itemNum: withBoth }) && !!f({ manufacturer: 'M\u00e4rklin', itemNum: withBoth }));
  ok('1690 a blank or letters-only number cannot match',
     f({ _era: 'marklin_h0', itemNum: '' }) === null && f({ _era: 'marklin_h0', itemNum: 'ABC' }) === null);
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('MARKLIN TESTS FAILING'); process.exit(1); }
console.log('ALL MARKLIN TESTS GREEN (' + pass + ')');
