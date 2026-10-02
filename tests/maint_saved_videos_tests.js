// ═══════════════════════════════════════════════════════════════
// maint_saved_videos_tests.js — v0.9.1859.
//
// [stated] Brad, 2026-10-02, the Maintenance card's Repair Videos box: "when
// we save a youtube video, we should show the list of videos here as well.
// it should be underneath the part/repair/search buttons."
//
// THE RULES THIS SUITE PROTECTS:
//   1. The Repair Videos box carries "Saved videos for this item" (#maint-videos)
//      BELOW the part / action / Search / Save-a-video row.
//   2. ONE reader of My Manuals — _maintRenderMyDocs — fills it with this
//      item's saved videos only (type 'video', covering this item), each a
//      link; "No videos saved for this one yet." when there are none. The
//      docs list keeps showing every type.
//   3. Opening "Work on it" draws it (the renderer runs for the work group),
//      and a save redraws it (the docs save already calls the renderer).
// The REAL renderer runs; every rule can fail.
// Run:  node tests/maint_saved_videos_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const maint = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');
function grabFrom(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + sig);
}
const MAN = [
  { id: 'd1', title: 'E-unit teardown', type: 'video', url: 'https://youtu.be/abc', covers: '2338, 2328', topics: 'e-unit' },
  { id: 'd2', title: 'GP-7 diagram', type: 'link', url: 'https://x/diag', covers: '2338', topics: '' },
  { id: 'd3', title: 'Whistle fix', type: 'video', url: 'https://youtu.be/zzz', covers: '2343', topics: 'whistle' },
];
function run(src, els, manuals, item) {
  const code = grabFrom(src, 'function _maintRenderMyDocs()') + '\n' + grabFrom(src, 'function _docCovers(item)');
  new Function('document', 'state', '_panelItem', '_esc', '_loadMyDocs', code + '\n_maintRenderMyDocs();')(
    { getElementById: id => els[id] || null }, { myManuals: manuals }, item, s => String(s), () => Promise.resolve());
}

section('A · the box');
const vidSec = maint.slice(maint.indexOf("sec('Repair Videos (YouTube)'"), maint.indexOf("// v0.9.1670 (Brad): standalone Find-a-Part section REMOVED"));
ok('"Saved videos for this item" sits in the Repair Videos box, BELOW the part / Search / Save-a-video row',
   /Saved videos for this item/.test(vidSec) && /id="maint-videos"/.test(vidSec)
   && vidSec.indexOf('id="maint-yt-part"') < vidSec.indexOf('_maintSearchYt()') && vidSec.indexOf('_maintSaveVideo()') < vidSec.indexOf('id="maint-videos"'));
ok('"Work on it" draws it (the renderer runs for the work group, beside the tasks)', /if \(g === 'work'\) \{ _maintRenderTasks\(\); _maintRenderMyDocs\(\); \}/.test(maint));
ok('a saved doc redraws it (the save calls the one renderer)', /state\.myManuals = null;\s*\n\s*var f = document\.getElementById\('maint-docform'\); if \(f\) f\.remove\(\);\s*\n\s*_maintRenderMyDocs\(\);/.test(maint));

section('B · the real renderer, run');
{
  const els = { 'maint-videos': { innerHTML: '' }, 'maint-mydocs': { innerHTML: '' } };
  run(maint, els, MAN, { itemNum: '2338' });
  ok('2338: its one video is listed, as a link, with its topic', /youtu\.be\/abc/.test(els['maint-videos'].innerHTML) && /E-unit teardown/.test(els['maint-videos'].innerHTML) && /\[e-unit\]/.test(els['maint-videos'].innerHTML));
  ok('…not the diagram link (a link, not a video), not the 2343 video', !/GP-7 diagram/.test(els['maint-videos'].innerHTML) && !/Whistle fix/.test(els['maint-videos'].innerHTML));
  ok('…while the docs list still shows every type for the item', /E-unit teardown/.test(els['maint-mydocs'].innerHTML) && /GP-7 diagram/.test(els['maint-mydocs'].innerHTML) && !/Whistle fix/.test(els['maint-mydocs'].innerHTML));
}
{
  const els = { 'maint-videos': { innerHTML: '' }, 'maint-mydocs': { innerHTML: '' } };
  run(maint, els, MAN, { itemNum: '675' });
  ok('an item with no video says so', /No videos saved for this one yet/.test(els['maint-videos'].innerHTML));
}
{
  const els = { 'maint-videos': { innerHTML: '' } };   // the work group: no docs list on screen
  run(maint, els, MAN, { itemNum: '2338' });
  ok('with only the videos list on screen (Work on it), it is still filled', /E-unit teardown/.test(els['maint-videos'].innerHTML));
}

section('C · planted offenders are caught');
ok('C1 the list put ABOVE the search row is caught', (() => { const o = vidSec.replace('id="maint-videos"', '').replace('_favRow(MAINT.PREF_CHANNELS', "'<div id=\"maint-videos\"></div>' + _favRow(MAINT.PREF_CHANNELS"); return !(o.indexOf('_maintSaveVideo()') < o.indexOf('id="maint-videos"')); })());
ok('C2 a renderer that lists every doc type as a video is caught', (() => { const o = maint.replace("return String(d.type || '') === 'video';", "return true;"); const els = { 'maint-videos': { innerHTML: '' } }; run(o, els, MAN, { itemNum: '2338' }); return /GP-7 diagram/.test(els['maint-videos'].innerHTML); })());
ok('C3 the work group no longer drawing it is caught', !/if \(g === 'work'\) \{ _maintRenderTasks\(\); _maintRenderMyDocs\(\); \}/.test(maint.replace("if (g === 'work') { _maintRenderTasks(); _maintRenderMyDocs(); }", "if (g === 'work') _maintRenderTasks();")));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
