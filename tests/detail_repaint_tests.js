// ═══════════════════════════════════════════════════════════════
// detail_repaint_tests.js — v0.9.1765.
//
// Brad, 2026-09-18: "i cropped the picture, hit apply and now there is not
// picture" — and every field in Details was blank too, Inventory ID included.
//
// ROOT CAUSE: the item page remembered itself as a POSITION in
// state.masterData (window._lastDetailIdx — "row 58,303 of 165,088"), and nine
// places repainted the page from that remembered number after something
// changed. But the app refreshes one maker's catalog at a time in the
// background, and that refresh (app.js _applyPendingEras) drops the maker's
// rows and concats fresh ones onto the END — so every row at or after them
// changes position. The crop's repaint fired 250ms later against a position
// that now meant a different item: 84511, one Brad does not own. No photos, no
// Inventory ID, no condition. It looked exactly like destroyed data. Nothing
// was lost; the page had been pointed at a stranger.
//
// v0.9.1236 found this same trap for the BROWSE list and fixed it there. The
// detail page never got the same protection. This suite is that protection.
//
// THE RULES THIS SUITE PROTECTS:
//   1. The inventory id says WHICH COPY; the remembered catalog ROW OBJECT
//      says WHICH ITEM; the POSITION is worked out again at repaint time.
//   2. When the item cannot be resolved, the page is LEFT ALONE. Never draw
//      whatever happens to sit at the old position.
//   3. No repaint site may go back to passing a remembered position.
//
// These are not grep tests (rule 3 aside, which has to be). The REAL
// rrDetailRepaint is lifted out of app-collection.js and driven against a fake
// catalog that gets shuffled underneath it exactly the way the era refresh
// shuffles the real one.
// Run:  node tests/detail_repaint_tests.js
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

// ── lift the real function out of the shipped source ───────────────────────
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}

const collSrc = APP('app-collection.js');
const repaintSrc = grab(collSrc, 'rrDetailRepaint');

section('the function ships at all');
ok('rrDetailRepaint is defined in app-collection.js', !!repaintSrc);
ok('it is exported on window', /window\.rrDetailRepaint\s*=\s*rrDetailRepaint/.test(collSrc));
if (!repaintSrc) { console.log('\ncannot continue without the function'); process.exit(1); }

// Build it in its own scope with every global it touches handed in, so the
// REAL code runs against a catalog we control.
const makeRepaint = new Function(
  'window', 'state', '_masterIdxOf', '_openOwnedByInvId', 'showItemDetailPage',
  'findMaster', 'setTimeout', 'console',
  repaintSrc + '\nreturn rrDetailRepaint;'
);

// ── a fake world ───────────────────────────────────────────────────────────
// Two makers' blocks, the way the real catalog is laid out. Brad's item is in
// the first block; the refresh moves that block to the end.
function makeWorld() {
  const mk = (n, era) => ({ itemNum: n, variation: '', _era: era });
  const mine = mk('6-36814', 'mpc');            // the item the page is showing
  const rows = [
    mk('2343', 'pw'), mk('6464-500', 'pw'),
    mine, mk('84511', 'mpc'), mk('2032010', 'mpc'),
  ];
  const w = {
    window: { _lastDetailRow: mine, _lastDetailCopyInv: '147' },
    state: {
      masterData: rows,
      personalData: { 'pk1': { itemNum: '6-36814', variation: '', inventoryId: '147', owned: true } },
    },
    mine,
    drew: [],          // [idx, inv] from showItemDetailPage
    byId: [],          // invIds passed to _openOwnedByInvId
    timers: [],        // delays requested
  };
  w.idxMap = new Map(w.state.masterData.map((r, i) => [r, i]));
  w.repaint = makeRepaint(
    w.window, w.state,
    (m) => (w.idxMap.has(m) ? w.idxMap.get(m) : -1),
    (inv) => { w.byId.push(inv); },
    (idx, inv) => { w.drew.push([idx, inv]); },
    (num, vari) => w.state.masterData.find(r => r.itemNum === num && (r.variation || '') === (vari || '')) || null,
    (fn, ms) => { w.timers.push(ms); fn(); },
    { warn: () => {} }
  );
  return w;
}

// The background era refresh, faithfully: that maker's rows come OUT and the
// fresh ones go on the END (app.js _applyPendingEras), then the index map is
// rebuilt (_rebuildMasterIndex, which really is called right after).
function eraRefresh(w, era, replaceObjects) {
  const keep = w.state.masterData.filter(r => r._era !== era);
  const moved = w.state.masterData.filter(r => r._era === era)
    .map(r => (replaceObjects ? { itemNum: r.itemNum, variation: r.variation, _era: r._era } : r));
  w.state.masterData = keep.concat(moved);
  w.idxMap = new Map(w.state.masterData.map((r, i) => [r, i]));
}

section('the ordinary repaint');
{
  const w = makeWorld();
  const before = w.idxMap.get(w.mine);
  w.repaint(0);
  ok('draws exactly once', w.drew.length === 1, JSON.stringify(w.drew));
  ok('draws the item the page was on', w.drew[0] && w.state.masterData[w.drew[0][0]] === w.mine);
  ok('carries the copy id through', w.drew[0] && w.drew[0][1] === '147');
  ok('position matches (nothing moved yet)', w.drew[0] && w.drew[0][0] === before);
}

section('THE BUG: a background era refresh moves the block mid-repaint');
{
  const w = makeWorld();
  const oldIdx = w.idxMap.get(w.mine);
  eraRefresh(w, 'pw', false);                   // postwar refreshes; mpc block shifts
  const strangerAtOldSeat = w.state.masterData[oldIdx];
  ok('the old position now holds a DIFFERENT item (the 84511 case)',
     strangerAtOldSeat !== w.mine, 'fixture is not reproducing the bug');
  w.repaint(0);
  ok('still draws Brad\'s item', w.drew[0] && w.state.masterData[w.drew[0][0]] === w.mine);
  ok('does NOT draw the stranger at the old position',
     w.drew[0] && w.drew[0][0] !== oldIdx, 'drew the old seat: ' + JSON.stringify(w.drew));
  ok('the copy id is still carried', w.drew[0] && w.drew[0][1] === '147');
}

section('the refresh replaced the row objects themselves');
{
  const w = makeWorld();
  eraRefresh(w, 'mpc', true);                   // Brad's own maker refreshes: new objects
  ok('the remembered row is no longer in the catalog', !w.idxMap.has(w.mine));
  w.repaint(0);
  ok('falls back to resolving by INVENTORY ID', w.byId.length === 1 && w.byId[0] === '147',
     JSON.stringify(w.byId));
  ok('does not draw a position directly', w.drew.length === 0, JSON.stringify(w.drew));
}

section('rule 2 — when it cannot be sure, it does nothing');
{
  const w = makeWorld();
  w.state.personalData = {};                    // the copy was removed or sold elsewhere
  w.repaint(0);
  ok('draws nothing when the copy is gone', w.drew.length === 0 && w.byId.length === 0,
     JSON.stringify(w.drew) + JSON.stringify(w.byId));
}
{
  const w = makeWorld();
  w.window._lastDetailCopyInv = '';
  w.window._lastDetailRow = null;               // nothing remembered at all
  w.repaint(0);
  ok('draws nothing when nothing is remembered', w.drew.length === 0 && w.byId.length === 0);
}
{
  const w = makeWorld();
  w.window._lastDetailCopyInv = '';
  w.window._lastDetailRow = { itemNum: 'GONE-1', variation: '', _era: 'pw' };
  w.repaint(0);
  ok('draws nothing when the item has left the catalog', w.drew.length === 0);
}

section('a catalog-only page (an item you do not own)');
{
  const w = makeWorld();
  const other = w.state.masterData[3];          // 84511 — not owned
  w.window._lastDetailCopyInv = '';
  w.window._lastDetailRow = other;
  eraRefresh(w, 'pw', false);
  w.repaint(0);
  ok('repaints the remembered row at its new position',
     w.drew.length === 1 && w.state.masterData[w.drew[0][0]] === other);
  ok('passes no copy id', w.drew[0] && w.drew[0][1] === '');
}
{
  const w = makeWorld();
  const other = w.state.masterData[3];
  w.window._lastDetailCopyInv = '';
  w.window._lastDetailRow = other;
  eraRefresh(w, 'mpc', true);                   // its object is replaced
  w.repaint(0);
  ok('re-resolves a replaced row through findMaster',
     w.drew.length === 1 && w.state.masterData[w.drew[0][0]].itemNum === '84511');
}

section('the delay is honoured, not swallowed');
{
  const w = makeWorld();
  w.repaint(250);
  ok('a delayed repaint goes through setTimeout with its delay', w.timers[0] === 250);
  ok('and still draws', w.drew.length === 1);
}
{
  const w = makeWorld();
  w.repaint(0);
  ok('a zero delay runs straight away (no timer)', w.timers.length === 0);
}

section('the page pins the row it drew');
{
  ok('showItemDetailPage records _lastDetailRow',
     /window\._lastDetailRow\s*=\s*item\s*\|\|\s*null/.test(collSrc));
  ok('it is pinned next to the copy id, one writer',
     collSrc.indexOf('window._lastDetailRow = item || null')
       - collSrc.indexOf('window._lastDetailCopyInv = (pd && pd.inventoryId)') < 600);
}

section('rule 3 — no repaint may go back to a remembered position');
{
  // Full-line // comments are stripped so the helper's header — which quotes
  // the bad line on purpose, to document it — cannot trip the scan.
  //
  // ONLY line comments. Stripping /* */ with a regex was tried first and it
  // silently ate 229KB of photo-inbox.js and 113KB of app-collection.js: a
  // regex literal in each opens a /* that the non-greedy match closes hundreds
  // of lines later, taking real code with it. A scan can then report "all
  // clear" because the code it should have read was deleted. A test that can
  // pass for the wrong reason is worse than no test.
  const strip = s => s.replace(/^[ \t]*\/\/.*$/gm, '');
  const files = fs.readdirSync(APPDIR).filter(f => f.endsWith('.js'));
  const BAD = /showItemDetailPage\(\s*window\._lastDetailIdx/;

  // Prove the detector is not vacuous before trusting that it finds nothing.
  ok('the scan actually detects the bad pattern',
     BAD.test(strip("    foo();\n    showItemDetailPage(window._lastDetailIdx, x);\n")));
  ok('and the scan is not fooled by a commented example',
     !BAD.test(strip("    // showItemDetailPage(window._lastDetailIdx, x)\n")));

  const offenders = [];
  let mentions = 0;
  files.forEach(f => {
    const src = strip(APP(f));
    if (BAD.test(src)) offenders.push(f);
    mentions += (src.match(/rrDetailRepaint\s*\(/g) || []).length;
  });
  ok('no file repaints from window._lastDetailIdx', offenders.length === 0, offenders.join(', '));
  // Every mention with a paren is either the declaration or a call site.
  // Pinned exactly: a tenth repaint site should be a deliberate act, and it
  // arrives here to say so.
  ok('exactly the nine known repaint sites call the helper', mentions - 1 === 9,
     'found ' + (mentions - 1) + ' call sites');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
