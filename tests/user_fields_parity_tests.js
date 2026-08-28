// ═══════════════════════════════════════════════════════════════
// user_fields_parity_tests.js — Session 86 late. Three of Brad's live
// reports, one release (v0.9.1585):
//  A "you have to hit edit on the my collection page before you can
//     see them. these should automatically show"
//  B custom columns from an import were invisible on every OTHER
//     device — their names/enables lived in one browser's storage
//  C "you say yes [instruction sheet] and it doesn't show yes when
//     saved… instruction sheets is not on the final review page"
//
// Run:  node tests/user_fields_parity_tests.js
// Proven to FAIL on v0.9.1584 before the build.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }
const browse = src('browse.js'), look = src('look-sync.js'), wiz = src('wizard.js'),
      wsave = src('wizard-save.js'), impui = src('import-ui.js'), prefs = src('prefs.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── A: new columns show WITHOUT opening the picker ───────────────
ok('A: an enabled user field auto-joins the visible columns (roster pattern)',
   /_collAutoNewCols/.test(browse) && /lv_coll_columns_seen_v1/.test(browse)
   && /rrEnabledUserFields === 'function' \? rrEnabledUserFields\(\) : \[\]/.test(browse.slice(browse.indexOf('_collAutoNewCols'))));
ok('A: …the offer is made ONCE — hiding it afterwards is remembered',
   /seen\.indexOf\(col\.col\) >= 0\) return/.test(browse));
ok('A: …both paths route through it (default layout AND a saved layout)',
   (browse.match(/return _collAutoNewCols\(/g) || []).length === 2);

// ── B: the setup travels between devices ─────────────────────────
ok('B: the sync file now carries the custom labels, enables, and layout',
   /lv_label_custom1/.test(look) && /lv_custom5_enabled/.test(look)
   && /lv_coll_columns_v1/.test(look) && /lv_coll_columns_seen_v1/.test(look)
   && /lv_locdetail_enabled/.test(look) && /lv_shipper_enabled/.test(look) && /lv_subcoll_enabled/.test(look));
ok('B: every importer write of a label stamps the sync clock',
   (impui.match(/rrLookTouch === 'function'\) rrLookTouch\(\)/g) || []).length >= 4);
ok('B: the prefs label editor stamps it too',
   /lv_label_' \+ key, v\); localStorage\.setItem\(f\.pref, 'true'\); \}\s*\n\s*if \(typeof rrLookTouch/.test(prefs));
ok('B: saving a column layout stamps it',
   /_COLL_COLS_PREF, JSON\.stringify\(list\)\); \} catch \(e\) \{\}\s*\n\s*if \(typeof rrLookTouch/.test(browse));

// ── C: instruction sheets tell the truth ─────────────────────────
ok('C: an EXISTING -IS row answers hasIS before any preference default',
   /_wantIS = String\(wizard\.data\.itemNum[\s\S]{0,400}wizard\.data\.hasIS = 'Yes'/.test(wiz)
   && wiz.indexOf('_isRow') > 0);
ok('C: …the derivation runs BEFORE the lv_def_hasIS fallback',
   wiz.indexOf('_wantIS = String(wizard.data.itemNum') < wiz.indexOf('wizard.data.hasIS = _defHasIS'));
ok('C: the -IS save is IDEMPOTENT — an item that owns its -IS row never mints a twin',
   /_isAlready = Object\.values\(state\.personalData[\s\S]{0,300}d\.hasIS === 'Yes' && tab === 'collection' && !_isAlready/.test(wsave));
ok('C: the final check always answers the IS question for a plain collection item',
   /final review page[\s\S]{0,500}wizard\.data\.hasIS = 'No'/.test(wiz));
ok('C: the internal derived flag never becomes a review row',
   /'_hasISExisting'\]\)/.test(wiz));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('USER-FIELDS PARITY TESTS FAILING'); process.exit(1); }
console.log('ALL USER-FIELDS PARITY TESTS GREEN (' + pass + ')');
