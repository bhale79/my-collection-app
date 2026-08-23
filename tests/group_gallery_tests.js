// ═══════════════════════════════════════════════════════════════
// group_gallery_tests.js — Session 84. Group-page photo polish.
//
// Brad, S83, on the group detail page: the per-member PHOTOS galleries
// rendered the wide set shot as a cramped strip ("weird and compacted"),
// and the arrange-chips row confused ("what is going on here").
//
// The fix (S84, Brad picked option 3 — both chip fixes plus layout):
//   · the view-chip row appears ONLY while a photo is being dragged,
//     and leads with plain English saying what dropping does
//   · member columns share the full width (auto-fit, not auto-fill —
//     auto-fill keeps ghost tracks that pinned 3 units at ~300px each)
//   · each member gallery stacks its thumbnail rail BELOW the hero so
//     the 74px side rail stops stealing width from the photo
//
// Run:  node tests/group_gallery_tests.js
// Proven to FAIL on v0.9.1569 (commit fbe8468) before the fix.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const coll = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-collection.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── the chip row explains itself, exactly when it matters ──────
const chipFn = (function () {
  const at = coll.indexOf('function _rrViewChipRow');
  return at < 0 ? '' : coll.slice(at, at + 3000);
})();
ok('the chip row starts HIDDEN', /display *= *'none'/.test(chipFn));
ok('...and appears when a photo drag starts', /dragstart[\s\S]{0,200}display *= *'flex'/.test(chipFn));
ok('...and hides again when the drag ends', /dragend[\s\S]{0,200}display *= *'none'/.test(chipFn));
ok('it leads with plain English about what dropping does',
   /Drop the photo on a label/.test(chipFn));
ok('the listeners sit on the gallery container (drag events bubble), so BOTH surfaces get this from the one function',
   /parentElement/.test(chipFn));
ok('both consumers still use the one shared builder',
   (coll.match(/_rrViewChipRow\(function/g) || []).length === 2);

// ── the member grid shares the width instead of pinning columns ─
ok('member columns use auto-FIT (ghost tracks collapse; 3 units share the full row)',
   /_grpPhotoMembers\.map[\s\S]{0,80}/.test(coll)
   ? /repeat\(auto-fit,minmax\(300px,1fr\)\)/.test(coll)
   : false);
ok('the old auto-fill member grid is gone',
   !/auto-fill,minmax\(300px,1fr\)/.test(coll));
ok('the single-item thumbnail grids are untouched (120px auto-fill stays)',
   /auto-fill,minmax\(120px,1fr\)/.test(coll));

// ── member galleries stack the rail under the hero ─────────────
ok('per-member galleries pass stack:true (rail below, hero gets the full column)',
   /grp-photos-[\s\S]{0,600}arrange: true, stack: true/.test(coll)
   || /canRename: true, arrange: true, stack: true/.test(coll));

// ── the thumbnails say what dragging can do ────────────────────
ok('thumbnail tooltip names BOTH actions (reorder, and set the view label)',
   /drag onto another photo to reorder, or drag it up to the labels to set its view/.test(coll));

console.log('');
if (fail) { console.log(fail + ' FAILED, ' + pass + ' passed'); process.exit(1); }
console.log('ALL GROUP-GALLERY TESTS GREEN (' + pass + ')');
