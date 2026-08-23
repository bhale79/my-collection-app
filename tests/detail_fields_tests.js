// ═══════════════════════════════════════════════════════════════
// detail_fields_tests.js — Session 84. The Details card gets a field picker.
//
// Brad (S84, with his Wings of Texaco page open): "need to be able to edit
// the detail sheet and be able to add the different columns or take them
// away, since now we have custom columns."
//
// His decision (S84): a ticked field with nothing in it shows a DASH —
// gaps should be visible, not vanish.
//
// Pattern: the v1517 list column picker (tick to show, drag ☰ to reorder,
// Reset to default, per-user localStorage), reused for the detail card.
//
// Run:  node tests/detail_fields_tests.js
// Proven to FAIL on v0.9.1570 (commit f8418fe) before the fix.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const coll = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-collection.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── every field has a STABLE id (rule 4: never positional, never a label) ──
const detailsAt = coll.indexOf('let details = [');
const detailsBlock = detailsAt < 0 ? '' : coll.slice(detailsAt, detailsAt + 6000);
ok('the details array exists where it always was', detailsAt > 0);
const idCount = (detailsBlock.match(/\{ id: '/g) || []).length;
ok('every built-in field carries a stable id (18+ of them)', idCount >= 18, idCount);
ok('condition, worth and location have the expected ids',
   /id: 'condition'/.test(detailsBlock) && /id: 'estWorth'/.test(detailsBlock) && /id: 'location'/.test(detailsBlock));
ok('custom user fields get ids from their KEY, not their (renameable) label',
   /id: 'uf_' \+ f\.key/.test(detailsBlock));

// ── the saved choice drives the card ───────────────────────────
ok('the choice is stored per user under its own key',
   /lv_detail_fields_v1/.test(coll));
ok('a saved choice controls WHICH fields show and in what ORDER',
   /_rrDetailFieldCfg/.test(coll) && /_dfCfg\.filter/.test(coll));
ok("a chosen field with nothing in it shows a dash — Brad's call, gaps stay visible",
   /d\.val \|\| '<span style="color:var\(--text-dim\)">(—|\\u2014)<\/span>'/.test(coll));
ok('NO saved choice = exactly the old behavior (blanks hidden)',
   /details = details\.filter\(d => d\.val\);/.test(coll));
ok('want-mode details are untouched (its own filter stays)',
   /\.filter\(function\(d\)\{ return d\.val; \}\);/.test(coll));

// ── the way in, and the picker itself ──────────────────────────
ok('the Details card header carries the way in',
   /Edit fields/.test(coll) && /_rrDetailFieldsPicker/.test(coll));
ok('...but not in want mode', /_wantMode \? ''/.test(coll) || /!_wantMode \?/.test(coll));
ok('the picker mirrors the column picker: drag ☰ to reorder',
   /_rrDetailFieldsPicker[\s\S]{0,3000}(\\u2630|☰)/.test(coll));
ok('...tick to show', /_rrDetailFieldsPicker[\s\S]{0,3000}type=.?checkbox/.test(coll)
   || /_rrDetailFieldsPicker[\s\S]{0,3000}checkbox/.test(coll));
ok('...and Reset to default brings back the old card',
   /_rrDetailFieldsReset[\s\S]{0,300}removeItem\('lv_detail_fields_v1'\)/.test(coll));
ok('saving reopens the page so the change is seen immediately',
   /_rrDetailReopen/.test(coll) && /_rrDetailFieldsApply[\s\S]{0,600}_rrDetailReopen/.test(coll));
ok('the picker reads the field list the page just built (custom names included, ONE source)',
   /_rrDetailFieldDefs/.test(coll));

console.log('');
if (fail) { console.log(fail + ' FAILED, ' + pass + ' passed'); process.exit(1); }
console.log('ALL DETAIL-FIELDS TESTS GREEN (' + pass + ')');
