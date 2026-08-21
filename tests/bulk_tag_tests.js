// ═══════════════════════════════════════════════════════════════
// bulk_tag_tests.js — Session 82. Brad's design, built to his words.
//
//   "i would want to have an add column button. i set the column up to say
//    sub collection. so the next question is what is the sub collection, i
//    would say Mint Cars. when i hit next it brings up my collection page
//    where i can check items like the share button… i would probably type
//    mint in the search… i can then hit select all or tick the ones i want
//    to. then i hit apply, and it puts Mint Cars in those sub collection
//    column. then i can hit done or i can add another sub collection."
//
//   "apply writes immediately"
//   "let the user see if an item has a pre existing sub collection text"
//   "now location is a different beast, cause it can be 2 columns that need
//    to be seen together — location, and sub location. so storage room 2,
//    tote 1"
//   "we have a place in preferences to manage location so we need to modify
//    that as well"
//
// Run:  node tests/bulk_tag_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const P = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const tag = P('bulk-tag.js'), browse = P('browse.js'), prefs = P('prefs.js'),
      html = P('index.html'), sw = P('sw.js'), css = P('app.css');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── the flow, in his order ─────────────────────────────────────
ok('there is a way in from the list', /rrTagOpen\(\)" title="Put one value on many items/.test(browse));
ok('step 1 picks the column', /id="rr-tag-field"/.test(tag));
ok('step 2 asks what goes in it', /What is it\?/.test(tag));
ok('...and shows values already in use, with counts', /Already in use/.test(tag));
ok('step 3 goes to the collection with ticking on',
   /function rrTagNext[\s\S]{0,2000}showPage\('browse'\)[\s\S]{0,400}rrTagBar\(\)/.test(tag));
ok('ticking reuses the share gutter', /rrTagActive === 'function' && rrTagActive\(\)\) return true;/.test(browse));
ok('...without share mode’s ten-item cap', !/Maximum 10/.test(tag));
ok('a row click ticks it while tagging', /_inTagModeD\s*\?\s*"rrTagToggle/.test(browse));
ok('Select all takes what the search is showing', /function rrTagSelectAllShown/.test(tag));
ok('ticks survive a new search', /ticks are kept/.test(tag),
   'so a group can be built across several searches');
ok('Apply writes immediately', /async function rrTagApply/.test(tag) && /values:batchUpdate/.test(tag));
ok('...and you can go straight round again', /Add another|rrTagOpen/.test(tag) && /function rrTagDone/.test(tag));

// ── his two rules ──────────────────────────────────────────────
ok('an existing value is SHOWN on the row, not just counted',
   /data-tagcol="1"/.test(browse) && /td\[data-tagcol="1"\]/.test(css),
   'the column being filled is tinted while ticking');
ok('...and rows that already have one are left alone by default',
   /if \(cur && !replaceThem\) return;/.test(tag));
ok('...with the choice spelled out', /OK  = replace those too/.test(tag));
ok('every Apply is undoable', /function rrTagUndo\b/.test(tag) && /_rrTagSaveUndo/.test(tag));
ok('...reachable from Preferences', /rrTagUndoListHtml/.test(prefs));

// ── location is a pair ─────────────────────────────────────────
ok('Location carries its detail', /key: 'location', label: 'Location', pair: 'locationDetail'/.test(tag));
ok('Location Detail is not offered alone', !/\{ key: 'locationDetail', label: 'Location Detail' \}/.test(tag),
   'a tote with no room is not an address');
ok('both boxes appear for a paired field', /id="rr-tag-pair-wrap"/.test(tag));
ok('both columns are written together', /if \(col2\) \{\s*t\.prev2/.test(tag));
ok('both columns are shown while ticking', /if \(_rrTag\.pair\) want\.push\(_rrTag\.pair\)/.test(tag));
ok('undo puts BOTH back', /if \(col2\) data\.push\([\s\S]{0,120}r\.prev2/.test(tag));
ok('the detail list is scoped to the place typed above', /rrLocationDetails\(v1 \? v1\.value : ''\)/.test(tag));

// ── preferences ────────────────────────────────────────────────
ok('a saved location can claim items', /data-loc-fill/.test(prefs));
ok('...and so can a tote inside it', /data-locdet-fill/.test(prefs));
ok('...handing both values straight over', /rrTagOpen\('location', l\.name, det\)/.test(prefs));

// ── the module is removable, like photo-inbox ──────────────────
ok('registered in index.html', /bulk-tag\.js\?v=/.test(html));
ok('...and precached', /'\.\/bulk-tag\.js'/.test(sw));
ok('...and says how to remove it', /Self-contained; delete this line/.test(html));

// ── what it must never touch ───────────────────────────────────
ok('only your own words can be bulk-set',
   !/key: 'itemNum'/.test(tag) && !/key: 'condition'/.test(tag) && !/key: 'variation'/.test(tag),
   'those are facts about one item, not labels to paint across forty');
ok('writes go in batches, not one request per row', /i \+= 500/.test(tag));

console.log('');
console.log(fail === 0 ? 'ALL BULK-TAG TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
