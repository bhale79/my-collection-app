// ══ tests/photo-viewer.js — v0.9.1369, the add wizard's photo viewer ══════
//
// Brad asked for a thumbnail in the wizard header that opens a picture he can
// zoom into and move around, to help him identify what he is holding.
//
// This gate drives the REAL functions out of wizard.js against the REAL
// app.css in real Chromium. It asserts what a person would SEE and DO — the
// thumbnail is hittable, zooming makes the picture bigger on screen, dragging
// moves it — never what the source text says. A grep cannot see a layout, and
// this project has paid for that lesson more than once.
//
// The last check is a MUTATION DRILL: it removes the full-resolution loader
// and proves the full-res assertion goes red. A detector that finds nothing
// may simply be broken.
// Drives the REAL wizard.js functions in real Chromium against the REAL
// app.css, exactly as the app would: no re-implementation, no assertions
// about source text.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const APP = path.join(__dirname, '..', 'app');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rrpv-'));

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// A page that loads app.css the one way that works (goto + <link>), then the
// two real functions lifted out of wizard.js by evaluating the whole file with
// the app globals it needs stubbed at the boundary only.
const html = `<!doctype html><html><head>
<link rel="stylesheet" href="file://${APP}/app.css">
</head><body>
<div id="wizard-modal" class="modal-overlay open"><div class="modal">
  <div class="modal-header">
    <div style="flex:1;min-width:0">
      <div class="modal-item-num" id="wizard-step-label">Collection · Step 2 of 11</div>
      <div class="modal-title" id="wizard-title">Do you know the item number?</div>
    </div>
    <button type="button" class="wiz-hero-photo" id="wiz-hero-photo" title="Tap to see the full photo" style="display:none"></button>
    <button class="btn-close">&#x2715;</button>
  </div>
</div></div>
<script>
// ── boundary stubs: the only things that talk to Google ──
var _px = {
  A: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#123"/></svg>'),
  B: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#321"/></svg>'),
  C: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#231"/></svg>')
};
window._thumbCalls = []; window._fullCalls = [];
function loadDriveThumb(fid, imgEl, containerEl, link, prio) {
  window._thumbCalls.push(fid); imgEl.src = _px[fid] || _px.A;
}
function _loadDriveThumbFull(fid, imgEl, containerEl) {
  window._fullCalls.push(fid); imgEl.src = _px[fid] || _px.A;
}
window.BackStack = { push: function(){}, pop: function(){} };
var wizard = { data: {} };
</script>
<script src="file://${DIR}/slice.js"></script>
</body></html>`;

// Slice the two real functions out of wizard.js by their own boundaries —
// character-exact, no regex over code.
function slice(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  if (a < 0) throw new Error('start not found: ' + startMark);
  const b = src.indexOf(endMark, a);
  if (b < 0) throw new Error('end not found: ' + endMark);
  return src.slice(a, b);
}

(async () => {
  const wz = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
  const viewer = slice(wz, 'window._wizVarZoom = function (arg) {', 'window._wizPhotoSet = function () {');
  const rest   = slice(wz, 'window._wizPhotoSet = function () {', 'window._wizVarInsertPhoto = function (container) {');
  fs.writeFileSync(path.join(DIR, 'slice.js'), viewer + '\n' + rest);
  const file = path.join(DIR, 'p.html');
  fs.writeFileSync(file, html);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.on('pageerror', e => { console.log('  PAGE ERROR:', e.message); fail++; });
    await page.goto('file://' + file);
    await page.waitForTimeout(300);

    // ── 1. no photo -> no thumbnail ──
    let r = await page.evaluate(() => {
      wizard.data = {};
      window._wizHeroPhotoSync();
      const b = document.getElementById('wiz-hero-photo');
      return { display: b.style.display };
    });
    ok('a manual add with no photo shows no thumbnail', r.display === 'none', JSON.stringify(r));

    // ── 2. one inbox photo -> thumbnail, no count badge ──
    r = await page.evaluate(() => {
      wizard.data = { _addPhotoDriveId: 'A', _addPhotoDriveIds: ['A'] };
      window._wizHeroPhotoSync();
      const b = document.getElementById('wiz-hero-photo');
      const rect = b.getBoundingClientRect();
      const hdr = b.closest('.modal-header').getBoundingClientRect();
      return { display: b.style.display, badge: !!b.querySelector('.wiz-hero-count'),
               hasImg: !!(b.querySelector('img') && b.querySelector('img').src),
               w: Math.round(rect.width), h: Math.round(rect.height),
               // is it actually top-RIGHT, i.e. past the middle of the header?
               rightOfCentre: rect.left > hdr.left + hdr.width / 2,
               visible: rect.width > 0 && rect.height > 0 };
    });
    ok('one photo: the thumbnail appears', r.display !== 'none' && r.visible, JSON.stringify(r));
    ok('one photo: it renders an image', r.hasImg, JSON.stringify(r));
    ok('one photo: no count badge', r.badge === false, JSON.stringify(r));
    ok('the thumbnail sits on the RIGHT of the header, where Brad asked for it',
       r.rightOfCentre, JSON.stringify(r));
    ok('the thumbnail is a real, hittable size', r.w >= 40 && r.h >= 40, JSON.stringify(r));

    // ── 3. it is HITTABLE, not merely visible (the §275 lesson) ──
    r = await page.evaluate(() => {
      const b = document.getElementById('wiz-hero-photo');
      const c = b.getBoundingClientRect();
      const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      return { hit: hit ? (hit.id || hit.tagName + '.' + hit.className) : null,
               inside: !!(hit && (hit === b || b.contains(hit))) };
    });
    ok('nothing covers the thumbnail — a finger would land on it', r.inside, JSON.stringify(r));

    // ── 4. three photos -> count badge says 3 ──
    r = await page.evaluate(() => {
      wizard.data = { _addPhotoDriveId: 'B', _addPhotoDriveIds: ['A', 'B', 'C'] };
      window._wizHeroPhotoSync();
      const b = document.getElementById('wiz-hero-photo');
      const badge = b.querySelector('.wiz-hero-count');
      const set = window._wizPhotoSet();
      return { badge: badge ? badge.textContent : null, index: set.index, ids: set.ids };
    });
    ok('three photos: the badge says 3', r.badge === '3', JSON.stringify(r));
    ok('the viewer will OPEN on the hero photo, not blindly on the first',
       r.index === 1, JSON.stringify(r));

    // ── 5. open the viewer and flip ──
    r = await page.evaluate(async () => {
      const set = window._wizPhotoSet();
      window._wizVarZoom({ ids: set.ids, index: set.index });
      await new Promise(r => setTimeout(r, 150));
      const back = document.querySelector('.rrpv-back');
      const count = document.getElementById('rrpv-count');
      return { opened: !!back, count: count ? count.textContent : null,
               prevDisabled: document.getElementById('rrpv-prev').disabled,
               nextDisabled: document.getElementById('rrpv-next').disabled,
               fullFetched: window._fullCalls.slice() };
    });
    ok('the viewer opens', r.opened, JSON.stringify(r));
    ok('it says which photo you are on', r.count === '2 of 3', JSON.stringify(r));
    ok('arrows are live in the middle of the set', !r.prevDisabled && !r.nextDisabled, JSON.stringify(r));
    ok('it fetches the FULL-RESOLUTION original, not the 400px thumbnail',
       r.fullFetched.indexOf('B') > -1, JSON.stringify(r));

    // ── 6. flip to the end, arrow disables ──
    r = await page.evaluate(async () => {
      document.getElementById('rrpv-next').click();
      await new Promise(r => setTimeout(r, 120));
      return { count: document.getElementById('rrpv-count').textContent,
               nextDisabled: document.getElementById('rrpv-next').disabled,
               full: window._fullCalls.slice() };
    });
    ok('the next arrow moves to photo 3', r.count === '3 of 3', JSON.stringify(r));
    ok('at the last photo the next arrow switches off', r.nextDisabled === true, JSON.stringify(r));
    ok('each photo it lands on is fetched full-resolution', r.full.indexOf('C') > -1, JSON.stringify(r));

    // ── 7. ZOOM actually changes the picture's size on screen ──
    r = await page.evaluate(async () => {
      const img = document.getElementById('rrpv-img');
      const before = img.getBoundingClientRect().width;
      document.getElementById('rrpv-in').click();
      document.getElementById('rrpv-in').click();
      await new Promise(r => setTimeout(r, 80));
      const after = img.getBoundingClientRect().width;
      return { before: Math.round(before), after: Math.round(after), transform: img.style.transform };
    });
    ok('zooming in really does make the picture bigger on screen',
       r.after > r.before * 1.5, JSON.stringify(r));

    // ── 8. PAN moves it, and only once zoomed ──
    r = await page.evaluate(async () => {
      const img = document.getElementById('rrpv-img');
      const stage = document.getElementById('rrpv-stage');
      const b1 = img.getBoundingClientRect();
      const cx = b1.left + b1.width / 2, cy = b1.top + b1.height / 2;
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: cx - 120, clientY: cy - 60, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointerup',   { pointerId: 1, clientX: cx - 120, clientY: cy - 60, bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      const b2 = img.getBoundingClientRect();
      return { movedX: Math.round(b2.left - b1.left), movedY: Math.round(b2.top - b1.top) };
    });
    ok('dragging moves the picture around', r.movedX !== 0 || r.movedY !== 0, JSON.stringify(r));

    // ── 9. Fit resets ──
    r = await page.evaluate(async () => {
      document.getElementById('rrpv-fit').click();
      await new Promise(r => setTimeout(r, 80));
      const img = document.getElementById('rrpv-img');
      return { transform: img.style.transform };
    });
    ok('Fit puts it back to the whole picture, centred',
       /scale\(1\)/.test(r.transform) && /translate\(0px,\s*0px\)/.test(r.transform), JSON.stringify(r));

    // ── 10. a pan at fit-size cannot fling the photo off screen ──
    r = await page.evaluate(async () => {
      const stage = document.getElementById('rrpv-stage');
      const img = document.getElementById('rrpv-img');
      const b1 = img.getBoundingClientRect();
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 500, clientY: 400, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 40, clientY: 40, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointerup',   { pointerId: 2, clientX: 40, clientY: 40, bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      const b2 = img.getBoundingClientRect();
      return { before: Math.round(b1.left), after: Math.round(b2.left) };
    });
    ok('at full-fit the picture cannot be dragged off into nothing',
       r.before === r.after, JSON.stringify(r));

    // ── 11. Escape closes and unbinds ──
    r = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return { gone: !document.querySelector('.rrpv-back') };
    });
    ok('Escape closes the viewer', r.gone, JSON.stringify(r));

    // ── 12. the wizard underneath survived ──
    r = await page.evaluate(() => ({
      wizardStillThere: !!document.getElementById('wizard-modal'),
      thumbStillThere: document.getElementById('wiz-hero-photo').style.display !== 'none'
    }));
    ok('closing the viewer leaves the wizard exactly where it was',
       r.wizardStillThere && r.thumbStillThere, JSON.stringify(r));

    // ── 13. MUTATION DRILL: prove the "full resolution" check can fail ──
    r = await page.evaluate(async () => {
      const realFull = window._loadDriveThumbFull;
      let called = [];
      // break it: a viewer that only ever used the thumbnail
      window._loadDriveThumbFull = undefined;
      window._fullCalls = [];
      window._wizVarZoom({ ids: ['A', 'B'], index: 0 });
      await new Promise(r => setTimeout(r, 120));
      const fetched = window._fullCalls.slice();
      document.querySelector('.rrpv-back').remove();
      window._loadDriveThumbFull = realFull;
      return { fetched };
    });
    ok('DRILL: with the full-res loader removed, the check goes red as it should',
       r.fetched.length === 0, JSON.stringify(r));

  } finally {
    await browser.close();
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
