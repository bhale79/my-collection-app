// ═══════════════════════════════════════════════════════════════
// opener_identity_tests.js — v0.9.1767.
//
// The tail of the v0.9.1765 audit. Brad: "audit the app for anytime an item is
// being looked up or read or whatever and make sure its using inventory id so
// crap like this doesn't happen" — then, once the nine repaints were fixed,
// "harden the other 26 openers".
//
// WHAT THE AUDIT ACTUALLY FOUND. 27 places open an item page and every one of
// them names the item by POSITION in state.masterData. They are not equally
// exposed:
//
//   • 16 are LIVE CALLS — the position is worked out and used in the same
//     breath, so nothing can move in between. Safe.
//   • 11 BAKE the position into an onclick, where it waits in the page until
//     someone clicks. Of those:
//       – 6 (4 dashboard cards, 2 For Sale links) already ask by inventory id
//         and fall back to a position only for a row that has none;
//       – 3 (the browse cards, My Collection) are REPAINTED when the catalog
//         changes: the era swap reindexes and repaints in one step (v0.9.1251);
//       – 2 — the detail page's "Matched to" and "Grouped with" links — were
//         position-first while holding the inventory id right there, on a page
//         that nothing repaints when the catalog shifts underneath it.
//
// Those last two are what v0.9.1767 fixed, through ONE helper, `_rrOpenJs`.
//
// THE RULES THIS SUITE PROTECTS:
//   1. A link that opens an owned item asks by inventory id; a position is only
//      for a row that has none.
//   2. The detail page bakes no raw position into an opener.
//   3. The era swap keeps reindexing AND repainting in one step — the thing
//      that makes the browse list and My Collection safe. That guarantee was
//      held by a comment; it is held by a test now.
// Run:  node tests/opener_identity_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}

const coll = APP('app-collection.js');

// ── A · the real _rrOpenJs ─────────────────────────────────────────────────
section('A · the one helper that decides, run for real');
const src = grab(coll, '_rrOpenJs');
ok('_rrOpenJs ships', !!src);
ok('…and is exported', /window\._rrOpenJs\s*=\s*_rrOpenJs/.test(coll));
if (!src) { console.log('\ncannot continue'); process.exit(1); }
const openJs = new Function('rrJsArg', src + '\nreturn _rrOpenJs;')(
  s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
);

ok('an owned copy opens by INVENTORY ID', openJs(5914, '147') === "_openOwnedByInvId('147')",
   openJs(5914, '147'));
ok('…and the position is not mentioned at all', !/5914/.test(openJs(5914, '147')));
ok('a row with NO id still opens, by position', openJs(5914, '') === "showItemDetailPage(5914, '')",
   openJs(5914, ''));
ok('null and undefined count as no id',
   openJs(12, null) === "showItemDetailPage(12, '')" && openJs(12, undefined) === "showItemDetailPage(12, '')");
ok('whitespace is not an id', openJs(12, '   ') === "showItemDetailPage(12, '')");
ok('a personal-only (negative) position still works',
   openJs(-1000, '') === "showItemDetailPage(-1000, '')");
ok('an id is escaped for the JS string it lands in (the v1760 rule)',
   openJs(1, "O'Brien") === "_openOwnedByInvId('O\\'Brien')", openJs(1, "O'Brien"));

// ── B · the two detail-page links use it ───────────────────────────────────
section('B · the detail page bakes no raw position into a link');
ok('"Matched to" uses the helper', /onclick="' \+ _rrOpenJs\(_mtIdx, _mtInv\) \+ '"/.test(coll));
ok('"Grouped with" uses the helper', /onclick="' \+ _rrOpenJs\(_gIdx, _gInv\) \+ '"/.test(coll));
ok('no onclick in app-collection.js bakes showItemDetailPage any more',
   !/onclick="showItemDetailPage\(/.test(coll));
ok('the helper still HAS a position to fall back on (it was not thrown away)',
   /_rrOpenJs\(_mtIdx,/.test(coll) && /_rrOpenJs\(_gIdx,/.test(coll));

// ── C · the census of baked openers across the app ─────────────────────────
section('C · every remaining baked opener is id-first or repainted');
{
  const strip = s => s.replace(/^[ \t]*\/\/.*$/gm, '');   // line comments only — see detail_repaint_tests
  const BAKED = /onclick="[^"]*showItemDetailPage\(|["'`][^"'`]*showItemDetailPage\(['"]?\s*\+/;
  ok('the scan detects a planted baked opener',
     BAKED.test(`onclick="showItemDetailPage(12, '')"`));

  // The files that legitimately still bake one, and why.
  const allowed = {
    'dashboard.js':      'id-first ternary: _openOwnedByInvId when the row has an id',
    'app-pages.js':      'id-first ternary / My Collection, repainted by rrRepaintBrowse',
    'browse.js':         'browse cards, repainted by rrRepaintBrowse on every catalog change',
  };
  const offenders = fs.readdirSync(APPDIR).filter(f => f.endsWith('.js')).filter(f => {
    if (allowed[f]) return false;
    // app-collection.js is allowed exactly ONE — the fallback line inside
    // _rrOpenJs itself, which is the sanctioned builder. Cut the helper out
    // and the file must be clean; whitelisting the whole file instead would
    // have quietly re-permitted the two links this release just fixed.
    const s = (f === 'app-collection.js') ? strip(APP(f)).replace(src, '') : strip(APP(f));
    return BAKED.test(s);
  });
  ok('no OTHER file bakes an opener into markup, and app-collection.js only inside _rrOpenJs',
     offenders.length === 0, offenders.join(', '));
  ok('…and that one sanctioned builder really is in the helper',
     /return 'showItemDetailPage\(' \+ idx/.test(src));

  const dash = strip(APP('dashboard.js'));
  const bakedDash = (dash.match(/showItemDetailPage\(" \+ idx/g) || []).length;
  const idFirstDash = (dash.match(/inventoryId \? \("_openOwnedByInvId\('/g) || []).length;
  ok('every dashboard card that bakes a position is guarded by an id-first branch',
     idFirstDash >= bakedDash && bakedDash > 0, idFirstDash + ' id-first vs ' + bakedDash + ' baked');
}

// ── D · the guarantee that makes browse and My Collection safe ─────────────
section('D · the era swap reindexes AND repaints, in one step (v0.9.1251)');
{
  const app = APP('app.js');
  const swapAt = app.indexOf('state.masterData = (state.masterData || []).filter(function (m) { return !drop.has(m._era); }).concat(incoming);');
  ok('the era swap is where we think it is', swapAt > 0);
  const after = app.slice(swapAt, swapAt + 1600);
  const reindexAt = after.indexOf('_rebuildMasterIndex()');
  const repaintAt = after.indexOf('rrRepaintBrowse()');
  ok('it reindexes right after the swap', reindexAt > 0, String(reindexAt));
  ok('…and repaints the visible list', repaintAt > 0, String(repaintAt));
  ok('…in that order — reindex BEFORE repaint, or the repaint bakes stale positions',
     reindexAt > 0 && repaintAt > reindexAt, 'reindex@' + reindexAt + ' repaint@' + repaintAt);
  ok('the repaint covers the visible tab, not only the Items list',
     /rrRepaintBrowse/.test(APP('browse.js')));
}

section('E · nothing regressed from v0.9.1765');
ok('rrDetailRepaint is still the only repaint path',
   /function rrDetailRepaint\(/.test(coll)
   && !/showItemDetailPage\(\s*window\._lastDetailIdx/.test(coll.replace(/^[ \t]*\/\/.*$/gm, '')));
ok('the page still pins the row it drew', /window\._lastDetailRow = item \|\| null/.test(coll));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
