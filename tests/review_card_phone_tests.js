// ══ tests/review_card_phone_tests.js ═══════════════════════════════════════
//
// v0.9.1705 (Session 94). THE PHONE REVIEW CARD GETS ITS CURRENT PHOTO.
//
// Brad, on his phone, 2026-09-09: "when you open an items pictures, it says
// 1 of 2, you can crop the first one, you can not hit the arrow to advance to
// the next picture to crop it … I should be able to tap the pictures in the
// small boxes that have the view labels to select the picture i want to edit,
// and i would want the arrow to work then select it to edit it."
//
// ROOT CAUSE: the review card's "current photo" — #pin-rv-main, the element
// the ‹ › arrows, the "1 of 2" counter, the ✂, the read line and the number
// box all act on — existed only in the DESKTOP layout. The phone layout was a
// strip of thumbnails with no big picture, so on a phone _pinRvSetMain found
// nothing and returned. The arrow pressed against nothing, silently.
//
// THE RULES THESE PINS DEFEND:
//   1. The big picture is built in ONE place and BOTH layouts use it — a
//      second copy is how the phone lost it in the first place.
//   2. Tapping a photo — on the rail, or the picture in a filled view-slot
//      box — makes it the current photo. The label under a slot (and an empty
//      box) still opens the which-photo picker. Nothing was taken away.
//   3. On a phone the big picture is a sharp THUMBNAIL (1200px), never the
//      12MP original. The recorder's 1141ms frame was that decode.
//   4. The crop toast is a confirmation, not a lecture: "Cropped ✓". The
//      crop still clears the stale read and never reads on the spot.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const PI = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
function fnBody(sig) {
  const i = PI.indexOf(sig);
  if (i < 0) return '';
  let j = PI.indexOf('{', i), d = 0;
  for (let k = j; k < PI.length; k++) {
    if (PI[k] === '{') d++;
    else if (PI[k] === '}') { d--; if (d === 0) return PI.slice(i, k + 1); }
  }
  return '';
}

// ── 1. One big picture, both layouts ─────────────────────────────────────
section('RULE 1 — one big picture, both layouts');
const hero = fnBody('function _pinRvHeroHtml(fixedH, maxH)');
const rail = fnBody('function _pinRvRailHtml(sizePx)');
ok('the big picture has ONE builder', hero.length > 200, '');
ok('#pin-rv-main exists exactly once in the source — inside that builder',
   (PI.match(/id="pin-rv-main"/g) || []).length === 1 && /id="pin-rv-main"/.test(hero), String((PI.match(/id="pin-rv-main"/g) || []).length));
ok('the PHONE layout builds it (fixed height, so the card does not jump between portrait and landscape)',
   /var _stripHtml = _pinRvHeroHtml\('40vh', null\) \+ _pinRvRailHtml\(74\) \+ _pinRvViewsBarHtml\(\);/.test(PI), '');
ok('the DESKTOP layout builds it too (sized to the photo, as before)',
   /var _photoWide = _pinRvHeroHtml\(null, '52vh'\) \+ _pinRvRailHtml\(64\) \+ _pinRvViewsBarHtml\(\);/.test(PI), '');
ok('its ✂ and 🔍 act on whatever is showing (data-rvbig), not on a fixed photo',
   /_pinCropPhoto\(document\.getElementById\(\\'pin-rv-main\\'\)\.getAttribute\(\\'data-rvbig\\'\)\)/.test(hero)
   && /_pinZoomPhoto\(document\.getElementById\(\\'pin-rv-main\\'\)\.getAttribute\(\\'data-rvbig\\'\)\)/.test(hero), '');
ok('the unused desktop split panel is gone', !/var _panelHtml/.test(PI), '');
ok('the arrows still step the big picture (unchanged wiring)',
   /window\._pinRvSetMain\(fl\[j\]\.id\)/.test(PI) && /var img = document\.getElementById\('pin-rv-main'\);\s*\n\s*var fid = img && img\.getAttribute\('data-rvbig'\);/.test(PI), '');

// ── 2. Tap to select ─────────────────────────────────────────────────────
section('RULE 2 — tap a photo to make it current; the picker is still there');
ok('the rail has ONE builder, and a tap on a thumb selects it',
   rail.length > 200 && /onclick="_pinRvSetMain\(\\'' \+ fidT \+ '\\'\)"/.test(rail), '');
ok('the rail no longer crams ✂ and 🔍 onto every 74px tile — the big picture carries them',
   !/_pinCropPhoto/.test(rail) && !/_pinZoomPhoto/.test(rail), '');
ok('…and says "drag to reorder" only where a drag exists (desktop)',
   /var canDrag = !window\.IS_MOBILE_UA;/.test(rail) && /\(canDrag \? ' — drag to reorder' : ''\)/.test(rail), '');
ok('the rail still badges its first photo MAIN VIEW and shows each read number',
   /MAIN VIEW/.test(rail) && /_tNum \? '<div style="position:absolute/.test(rail), '');
const cell = fnBody('function _pinRvSlotCell(sl, f, roleKey)');
ok('a FILLED slot: the picture selects (and stops the tap reaching the picker)',
   /data-slotpic="' \+ f\.id \+ '" onclick="event\.stopPropagation\(\);_pinRvSetMain\(\\'' \+ f\.id \+ '\\'\)"/.test(cell), '');
ok('…while the cell itself (the label, an empty box) still opens the which-photo picker',
   /onclick="_pinRvSlotTap\(\\'' \+ sl\.key \+ '\\''/.test(cell), '');
ok('the current photo is outlined wherever its thumb is, and the outline follows the arrows',
   /function _pinRvMarkCurrent\(fid\)/.test(PI)
   && /img\.setAttribute\('data-rvbig', fid\);\s*\n\s*window\._pinRvLoadFull\(img, fid\);\s*\n\s*try \{ _pinRvMarkCurrent\(fid\); \}/.test(PI)
   && /try \{ _pinRvMarkCurrent\(_mainFid\); \}/.test(PI), '');

// ── 3. The phone never decodes the original for the big picture ──────────
section('RULE 3 — sharp thumbnail on a phone, never the 12MP original');
const load = fnBody('window._pinRvLoadFull = async function (img, fid)');
ok('the phone path asks Drive for a 1200px preview',
   /if \(window\.IS_MOBILE_UA\) \{/.test(load) && /replace\(\/=s\\d\+\(-c\)\?\$\/, '=s1200'\)/.test(load), '');
ok('…and RETURNS before the full-bytes fetch',
   load.indexOf('=s1200') < load.indexOf('await _pinBytes(fid)') && /=s1200'\);\s*\n\s*\} catch \(e\) \{[^\n]*\}\s*\n\s*return;/.test(load), '');
ok('…except a photo cropped this session, whose real bytes the thumb loader already serves',
   /if \(window\._rrForceFreshBytes && window\._rrForceFreshBytes\[fid\]\) return;/.test(load), '');
ok('the sharp preview only lands if that photo is STILL the current one (no late-arrival swap)',
   /sharp\.onload = function \(\) \{ if \(img\.getAttribute\('data-rvbig'\) === fid\) img\.src = sharp\.src; \};/.test(load), '');

// ── 4. The toast ─────────────────────────────────────────────────────────
section('RULE 4 — "Cropped ✓", and the crop still clears the read without reading');
const crop = fnBody('window._pinCropPhoto = async function (fid)');
ok('the confirmation is just that', /showToast\('Cropped \\u2713', 2000\);/.test(crop), '');
ok('the old wording is gone everywhere', !/read fresh when you hit Identify my items/.test(PI), '');
ok('the crop still clears the stale read…', /var mm = _ids\(\); if \(mm\[fid\]\) \{ delete mm\[fid\]; _idsSave\(mm\); \}/.test(crop), '');
ok('…and still does not read on the spot', !/aiIdentifyImage|_freeReadOne\(|_pinAutoRead\(/.test(crop), '');

// ── 5. Behaviour, executed ───────────────────────────────────────────────
section('Behaviour, executed');
(function () {
  // The two builders are inner functions of _pinReview; lift them with the
  // closure values they read.
  const stubs = {
    _mainFid: 'f1',
    _cornBtn: 'CORN',
    _railThumbs: ['f1', 'f2', 'f3'],
    _ids: () => ({ f2: { num: '2343', guess: false } }),
    rrEsc: s => String(s),
    window: { IS_MOBILE_UA: false },
  };
  function build(mobile, railThumbs) {
    const w = Object.assign({}, stubs, { window: { IS_MOBILE_UA: mobile }, _railThumbs: railThumbs || stubs._railThumbs });
    return new Function('_mainFid', '_cornBtn', '_railThumbs', '_ids', 'rrEsc', 'window',
      hero + '\n' + rail + '\nreturn { hero: _pinRvHeroHtml, rail: _pinRvRailHtml };')(
      w._mainFid, w._cornBtn, w._railThumbs, w._ids, w.rrEsc, w.window);
  }
  const d = build(false), m = build(true), one = build(true, ['f1']);
  const ph = m.hero('40vh', null), dh = d.hero(null, '52vh');
  ok('RUN: the phone hero is a fixed 40vh box with the photo fitted inside it',
     /height:40vh;/.test(ph) && /max-height:100%;/.test(ph) && !/max-height:40vh/.test(ph), '');
  ok('RUN: the desktop hero sizes to the photo up to 52vh, as before',
     /max-height:52vh;/.test(dh) && !/height:52vh;/.test(dh.replace(/max-height:52vh;/g, '')), '');
  ok('RUN: both carry #pin-rv-main pointed at the first photo, with ✂ and 🔍',
     [ph, dh].every(h => /id="pin-rv-main" data-rvbig="f1"/.test(h) && /✂/.test(h) && /🔍/.test(h)), '');
  const pr = m.rail(74), dr = d.rail(64);
  ok('RUN: three photos → three tiles, each a tap-to-select, none with a ✂',
     (pr.match(/data-dragfid=/g) || []).length === 3
     && (pr.match(/onclick="_pinRvSetMain\('f[123]'\)"/g) || []).length === 3
     && !/✂|🔍/.test(pr), '');
  ok('RUN: the first tile is MAIN VIEW and the read number rides its own tile',
     pr.indexOf('MAIN VIEW') > 0 && pr.indexOf('MAIN VIEW') < pr.indexOf('data-dragfid="f2"')
     && /data-dragfid="f2"[\s\S]*?2343/.test(pr), '');
  ok('RUN: a phone tile never promises a drag; a desktop tile does',
     !/drag to reorder/.test(pr) && /drag to reorder/.test(dr) && /width:74px;height:74px/.test(pr) && /width:64px;height:64px/.test(dr), '');
  ok('RUN: one photo → no rail (a lone thumb under the same big picture says nothing)', one.rail(74) === '', '');

  // The slot cell is a pure function of (slot, file, role).
  const slotFn = new Function(cell + '\nreturn _pinRvSlotCell;')();
  const filled = slotFn({ key: 'RSV', label: 'Right Side' }, { id: 'f9' }, '');
  const empty = slotFn({ key: 'BKV', label: 'Back' }, null, '');
  ok('RUN: a filled slot\'s picture selects the photo and stops the tap there',
     /data-slotpic="f9" onclick="event\.stopPropagation\(\);_pinRvSetMain\('f9'\)"/.test(filled)
     && /onclick="_pinRvSlotTap\('RSV'\)"/.test(filled), '');
  ok('RUN: …and its title says both things it can do',
     /Tap the picture to show it; tap the label to choose which photo is the Right Side/.test(filled), '');
  ok('RUN: an empty slot has no picture to select — the whole box opens the picker',
     !/data-slotpic/.test(empty) && /onclick="_pinRvSlotTap\('BKV'\)"/.test(empty) && />\+</.test(empty), '');

  // The current-photo outline, on a stub DOM.
  const mark = fnBody('function _pinRvMarkCurrent(fid)');
  const nodes = [
    { kind: 'dragfid', id: 'f1', style: {} }, { kind: 'dragfid', id: 'f2', style: {} }, { kind: 'slotpic', id: 'f9', style: {} },
  ];
  const doc = {
    getElementById: () => ({
      querySelectorAll: sel => nodes.filter(n => sel.indexOf(n.kind) >= 0).map(n => ({
        getAttribute: () => n.id, style: n.style,
      })),
    }),
  };
  const markFn = new Function('document', mark + '\nreturn _pinRvMarkCurrent;')(doc);
  markFn('f2');
  ok('RUN: marking f2 outlines f2 and clears the others', nodes[1].style.borderColor === 'var(--accent)' && nodes[0].style.borderColor === 'transparent' && nodes[2].style.outline === '', '');
  markFn('f9');
  ok('RUN: marking a slotted photo outlines its box and clears the rail', nodes[2].style.outline === '2px solid var(--accent)' && nodes[1].style.borderColor === 'transparent', '');

  // The loader, phone vs desktop.
  function runLoad(mobile) {
    const calls = { thumb: 0, bytes: 0, sharpSrc: '' };
    const img = { attrs: { 'data-rvbig': 'f1' }, getAttribute(k) { return this.attrs[k]; }, parentElement: {}, src: '' };
    const ctx = {
      window: { IS_MOBILE_UA: mobile, _rrForceFreshBytes: {} },
      _thumbLink: { f1: 'https://lh3.example/abc=s220' },
      loadDriveThumb: () => { calls.thumb++; },
      _qcToken: () => 'tok',
      _pinBytes: async () => { calls.bytes++; return new Blob(['x']); },
      URL: { createObjectURL: () => 'blob:1' },
      Image: function () { const self = this; setTimeout(() => { calls.sharpSrc = self.src; self.onload && self.onload(); }, 0); },
    };
    const fn = new Function('window', '_thumbLink', 'loadDriveThumb', '_qcToken', '_pinBytes', 'URL', 'Image',
      load.replace('window._pinRvLoadFull = ', 'return ') + ';')(
      ctx.window, ctx._thumbLink, ctx.loadDriveThumb, ctx._qcToken, ctx._pinBytes, ctx.URL, ctx.Image);
    return fn(img, 'f1').then(() => new Promise(r => setTimeout(r, 5))).then(() => ({ calls, img }));
  }
  Promise.all([runLoad(true), runLoad(false)]).then(([ph, dt]) => {
    ok('RUN: on a phone the big picture loads the thumb, then a 1200px preview — and NEVER the original bytes',
       ph.calls.thumb === 1 && ph.calls.bytes === 0 && /=s1200$/.test(ph.calls.sharpSrc) && ph.img.src === ph.calls.sharpSrc, JSON.stringify(ph.calls));
    ok('RUN: on a desktop it still fetches the original for the full-res view',
       dt.calls.thumb === 1 && dt.calls.bytes === 1 && dt.img.src === 'blob:1', JSON.stringify(dt.calls));
    console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
})();
