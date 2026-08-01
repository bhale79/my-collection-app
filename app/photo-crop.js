// ══════════════════════════════════════════════════════════════════
// photo-crop.js — optional, frictionless crop for wizard photos.
// A ✂ icon sits on each photo thumbnail. Tapping it opens a crop overlay
// (Cropper.js). Apply replaces the uploaded Drive photo's bytes IN PLACE
// (PATCH …?uploadType=media — no duplicate file). Doing nothing keeps the
// full photo, with zero extra clicks.
// ══════════════════════════════════════════════════════════════════

// v0.9.790 (Brad): Cropper's stock grab squares are 5px — brutal to hit.
// Inject once: 16px handles, repositioned so they stay centered on the lines.
(function () {
  try {
    if (document.getElementById('rr-crop-css')) return;
    var stl = document.createElement('style');
    stl.id = 'rr-crop-css';
    stl.textContent = '.cropper-point{width:16px!important;height:16px!important;opacity:0.9!important;background-color:#39f}'
      + '.cropper-point.point-e{right:-8px;margin-top:-8px}'
      + '.cropper-point.point-n{top:-8px;margin-left:-8px}'
      + '.cropper-point.point-w{left:-8px;margin-top:-8px}'
      + '.cropper-point.point-s{bottom:-8px;margin-left:-8px}'
      + '.cropper-point.point-ne{top:-8px;right:-8px}'
      + '.cropper-point.point-nw{top:-8px;left:-8px}'
      + '.cropper-point.point-sw{bottom:-8px;left:-8px}'
      + '.cropper-point.point-se{bottom:-8px;right:-8px;width:16px!important;height:16px!important}';
    document.head.appendChild(stl);
  } catch (e) {}
})();

// v0.9.1032: does THIS browser rotate a photo by its EXIF tag on its own?
// The probe is a 2×1 pixel JPEG tagged "rotate 90". A browser that honours the
// tag reports it as 1 wide by 2 tall. Every current browser does; the answer is
// worked out once, in the background, long before anyone opens the crop screen.
var _rrOrientAuto = null;      // true / false once known, null while unknown
var _rrOrientWaiting = [];
(function _rrRunOrientProbe() {
  var PROBE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8iviD/wAj9rn/AGGLn/0a1FFFf7pcCf8AJD5X/wBg1D/01E+Q4z/5LDMf+v8AW/8ATkj/2Q==';
  var settle = function (v) {
    if (_rrOrientAuto !== null) return;
    _rrOrientAuto = !!v;
    var q = _rrOrientWaiting; _rrOrientWaiting = [];
    q.forEach(function (fn) { try { fn(_rrOrientAuto); } catch (e) {} });
  };
  try {
    var im = new Image();
    im.onload = function () { settle(im.naturalHeight > im.naturalWidth); };
    im.onerror = function () { settle(false); };
    im.src = PROBE;
    setTimeout(function () { settle(false); }, 4000);   // never leave a crop waiting
  } catch (e) { settle(false); }
})();
function _rrOrientProbe(cb) {
  if (_rrOrientAuto !== null) { cb(_rrOrientAuto); return; }
  _rrOrientWaiting.push(cb);
}

// ── v0.9.1049: remember the last crop box across a batch ───────────────────
// Brad photographs a wall: a hundred shots, the item sitting in roughly the
// same part of every frame. Starting each crop from the whole picture means
// dragging the same rectangle a hundred times. The last box is remembered as
// PROPORTIONS of the photo, so it survives different pixel sizes, and is
// offered as the starting rectangle for the next one — a nudge instead of a
// fresh drag. It only applies to photos of the same orientation (a portrait
// box on a landscape photo would be nonsense), it expires after 6 hours so it
// never ambushes a session next week, and "Whole photo" resets it.
var _RR_BOX_KEY = 'rr_last_crop_box';
var _RR_BOX_MAX_AGE = 6 * 60 * 60 * 1000;

function _rrSaveBox(cropper) {
  try {
    var d = cropper.getData(true), im = cropper.getImageData();
    if (!d || !im || !im.naturalWidth || !im.naturalHeight) return;
    var box = {
      x: d.x / im.naturalWidth, y: d.y / im.naturalHeight,
      w: d.width / im.naturalWidth, h: d.height / im.naturalHeight,
      land: im.naturalWidth >= im.naturalHeight,
      t: Date.now(),
    };
    // A box that is basically the whole frame is not worth remembering.
    if (box.w > 0.97 && box.h > 0.97) { localStorage.removeItem(_RR_BOX_KEY); return; }
    if (box.w <= 0.02 || box.h <= 0.02) return;
    localStorage.setItem(_RR_BOX_KEY, JSON.stringify(box));
  } catch (e) {}
}

function _rrLoadBox(cropper) {
  try {
    var raw = localStorage.getItem(_RR_BOX_KEY);
    if (!raw) return null;
    var box = JSON.parse(raw);
    if (!box || !box.w || !box.h) return null;
    if (Date.now() - (box.t || 0) > _RR_BOX_MAX_AGE) { localStorage.removeItem(_RR_BOX_KEY); return null; }
    var im = cropper.getImageData();
    if (!im || !im.naturalWidth) return null;
    if ((im.naturalWidth >= im.naturalHeight) !== !!box.land) return null;   // different orientation
    return {
      x: Math.round(box.x * im.naturalWidth), y: Math.round(box.y * im.naturalHeight),
      width: Math.round(box.w * im.naturalWidth), height: Math.round(box.h * im.naturalHeight),
    };
  } catch (e) { return null; }
}

function _openCropper(src, onResult, onCancel, opts) {   // v0.9.787: onCancel = proceed without cropping
  // v0.9.1052: opts lets a caller reword the screen — the crop-before-a-paid-read
  // flow needs its Cancel to read "Use whole photo", because there it is a real
  // choice with a cost, not an escape hatch.
  opts = opts || {};
  if (typeof Cropper === 'undefined') { if (typeof showToast === 'function') showToast('Crop tool still loading — try again in a moment'); return; }
  var ov = document.createElement('div');
  // v0.9.786: TOP layer — the contact modal sits at 10040, and the cropper
  // opening BENEATH it looked like a dead button (it appeared after Save).
  // v0.9.883 (Brad): fully opaque backdrop — the old 0.88 let background
  // repaints (loading pill, dashboard rebuilds) flicker through mid-crop.
  ov.style.cssText = 'position:fixed;inset:0;z-index:100010;background:#000;display:flex;flex-direction:column';
  var btn = 'padding:0.55rem 1.1rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#eee';
  var btnA = 'padding:0.55rem 1.2rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;border:none;background:var(--accent);color:var(--on-accent)';
  ov.innerHTML =
    '<div style="padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;color:#fff;gap:1rem;flex-wrap:wrap">' +
      '<strong style="font-size:1rem">' + (opts.title || 'Crop photo') + '</strong>' +
      '<span id="_rrCropHint" style="font-size:0.78rem;opacity:0.75">' + (opts.hint || 'Drag the box · pinch or scroll to zoom') + '</span>' +
      '<button id="_rrCropWhole" style="display:none;padding:0.4rem 0.7rem;min-height:38px;border-radius:8px;border:1px solid #555;background:#2a2a2a;color:#eee;font-size:0.78rem;cursor:pointer">Whole photo</button>' +
    '</div>' +
    // v0.9.1031 (Brad): the crop box used to sit 16px too far RIGHT, so both
    // right-hand grab squares fell off a phone screen. Cropper measures its
    // container from the OUTSIDE (offsetWidth includes padding) but is then
    // laid out INSIDE the padding — so 1rem of padding here pushed the whole
    // crop box 1rem off the right edge. The padding now lives on a wrapper
    // and the stage itself is a plain relative box, so Cropper measures the
    // real area it gets to draw in.
    '<div style="flex:1;min-height:0;padding:0 12px 4px;display:flex">' +
      '<div id="_rrCropStage" style="flex:1;min-height:0;position:relative;overflow:hidden">' +
        // v0.9.1032: the raw <img> stays INVISIBLE until Cropper has taken it
        // over. It used to paint at full size first and then get swapped for
        // Cropper's own rendering — one of the blinks Brad was seeing.
        '<img id="_rrCropImg" style="max-width:100%;max-height:100%;display:block;margin:0 auto;visibility:hidden">' +
        '<div id="_rrCropWait" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:0.85rem">Loading photo…</div>' +
      '</div>' +
    '</div>' +
    // v0.9.904 (Brad, item [3]): fine-rotation slider restored \u2014 same control
    // the box-scanner cropper uses (barcode.js). Any angle via the slider; the
    // \u21bb button steps 90\u00b0 and keeps the slider in sync.
    // v0.9.1049 (Brad: "the mouse tends to fling it too far back and forth").
    // The slider used to cover 360 degrees across a phone-width control —
    // about 1.2 degrees per pixel, so the smallest touch you can make moved it
    // more than a degree and a thumb-width moved it thirty. It was never
    // controllable. It is now a LEVELLING control: plus or minus 15 degrees,
    // a tenth of a degree per pixel. The ↻ button still does the 90s, and the
    // − / + buttons step a single degree for honing in.
    '<div style="padding:0.55rem 1rem 0;display:flex;align-items:center;gap:0.4rem">' +
      '<span style="color:#ccc;font-size:0.78rem;white-space:nowrap">Level</span>' +
      '<button id="_rrCropRotMinus" class="rr-tap" title="1 degree left" style="min-width:38px;min-height:38px;border-radius:8px;border:1px solid #555;background:#2a2a2a;color:#eee;font-size:1.05rem;line-height:1;cursor:pointer">\u2212</button>' +
      '<input id="_rrCropRot" type="range" min="-15" max="15" step="0.5" value="0" style="flex:1;accent-color:var(--accent,#e8401c)">' +
      '<button id="_rrCropRotPlus" class="rr-tap" title="1 degree right" style="min-width:38px;min-height:38px;border-radius:8px;border:1px solid #555;background:#2a2a2a;color:#eee;font-size:1.05rem;line-height:1;cursor:pointer">+</button>' +
      '<span id="_rrCropRotV" style="color:#ccc;font-size:0.78rem;min-width:3.4em;text-align:right">0\u00b0</span>' +
    '</div>' +
    '<div style="padding:0.85rem 1rem;display:flex;gap:0.6rem;justify-content:flex-end">' +
      '<button id="_rrCropRotate" style="' + btn + ';margin-right:auto">\u21bb Rotate</button>' +
      '<button id="_rrCropCancel" style="' + btn + '">' + (opts.cancelLabel || 'Cancel') + '</button>' +
      '<button id="_rrCropApply" style="' + btnA + '">' + (opts.applyLabel || 'Apply crop') + '</button>' +
    '</div>';
  document.body.appendChild(ov);
  var img = ov.querySelector('#_rrCropImg');
  var stage = ov.querySelector('#_rrCropStage');
  var cropper = null;
  // v0.9.1031 (Brad: "the screen flashes a lot for 5 to 10 seconds"). Phones
  // only. Chain: the camera hands the photo back → Android slides its URL bar
  // in and out → every one of those fires a viewport resize → the wizard's
  // keyboard guard resizes the modal (nudging the page height, which moves the
  // URL bar again) AND Cropper's `responsive` option tears the cropper down
  // and redraws it from scratch. That redraw IS the flash. Three brakes:
  //   1. _rrCropOpen parks the wizard keyboard guard while we're open.
  //   2. The stage is frozen at its measured pixel size the moment we build,
  //      so a moving toolbar can no longer change the area Cropper sits in.
  //   3. responsive:false on phones — a real rotation still re-fits (below),
  //      toolbar twitches no longer do anything.
  var _phone = false;
  try {
    _phone = (typeof IS_MOBILE_UA !== 'undefined' && IS_MOBILE_UA)
      || (window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
  } catch (eP) {}
  window._rrCropOpen = true;

  // PHONES ONLY. On desktop the stage stays fluid so Cropper's `responsive`
  // option can still re-fit when the window is actually resized.
  function _freezeStage() {
    if (!_phone) return;
    try {
      var r = stage.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        stage.style.flex = '0 0 auto';
        stage.style.width = Math.round(r.width) + 'px';
        stage.style.height = Math.round(r.height) + 'px';
      }
    } catch (e) {}
  }

  var _built = false;
  function _build(autoOriented) {
    if (_built || !document.body.contains(ov)) return;
    _built = true;
    _freezeStage();
    // v0.9.904 (Brad, item [3]): viewMode 0 (was 1) so a rotated photo isn't
    // clamped/zoomed to fill the frame — matches the box-scanner cropper, which
    // is what makes the fine-rotation slider behave.
    try {
      cropper = new Cropper(img, {
        viewMode: 0, autoCropArea: 1, background: false, movable: true, zoomable: true,
        responsive: !_phone, checkOrientation: !autoOriented,
        // v0.9.1049: seeding the rotation and restoring the remembered box BOTH
        // need the cropper to be ready — setData and getImageData do nothing
        // before that, which is why doing it straight after the constructor
        // silently had no effect.
        ready: function () {
          try { _seedRot(); } catch (eS) {}
          try {
            var _lastBox = _rrLoadBox(cropper);
            if (_lastBox) {
              cropper.setData(_lastBox);
              var _hint = ov.querySelector('#_rrCropHint');
              if (_hint) _hint.textContent = 'Starting from your last crop';
              var _rb = ov.querySelector('#_rrCropWhole');
              if (_rb) _rb.style.display = '';
            }
          } catch (eB) {}
        },
      });
    } catch (e) {
      console.warn('[crop] init', e);
      img.style.visibility = '';   // show the plain photo rather than nothing
    }
    var w = ov.querySelector('#_rrCropWait');
    if (w) w.remove();
  }
  // v0.9.1031: build ONCE, and only after the photo has actually decoded and
  // the overlay has been laid out — the old code raced the decode, so the
  // first thing you saw was a half-drawn cropper being redrawn.
  // v0.9.1032 (Brad: "the photo blinks or redraws, only right when it opens").
  // Cropper's checkOrientation reads the file's EXIF rotation tag, and when it
  // finds one — every photo straight off a phone camera has one — it converts
  // the WHOLE file to a base64 data URL and loads the photo a SECOND time.
  // Draw, blank, redraw: that is the blink, and it is why this never happened
  // on the computer, where photos have usually lost their EXIF already.
  // Every current browser applies EXIF rotation to an <img> by itself, so all
  // that work buys nothing. _rrOrientProbe() checks whether THIS browser does
  // (below) and, if it does, we switch checkOrientation off and the photo
  // loads exactly once. An old browser that needs the help still gets it.
  _rrOrientProbe(function (autoOrients) {
    if (!document.body.contains(ov)) return;
    img.onload = function () {
      var go = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { _build(autoOrients); }); }); };
      try { if (img.decode) { img.decode().then(go, go); } else { go(); } } catch (eD) { go(); }
    };
    img.src = src;
  });

  // A genuine rotation still re-fits (debounced); toolbar resizes do not.
  var _rotT = null;
  function _onOrient() {
    if (_rotT) clearTimeout(_rotT);
    _rotT = setTimeout(function () {
      if (!cropper) return;
      try {
        stage.style.flex = ''; stage.style.width = ''; stage.style.height = '';
        _freezeStage();
        cropper.resize();
      } catch (e) {}
    }, 350);
  }
  window.addEventListener('orientationchange', _onOrient);

  function done() {
    window._rrCropOpen = false;
    if (_rotT) { clearTimeout(_rotT); _rotT = null; }
    try { window.removeEventListener('orientationchange', _onOrient); } catch (e) {}
    try { if (cropper) cropper.destroy(); } catch (e) {}
    ov.remove();
    if (window.BackStack) BackStack.pop('_rr-cropper');
  }
  // v0.9.808 (TODO-012): device Back = Cancel (keep the full photo).
  if (window.BackStack) BackStack.push('_rr-cropper', function () { done(); if (onCancel) try { onCancel(); } catch (e) {} });
  // v0.9.904 (Brad, item [3]): fine-rotation slider (any angle) + the ↻ button
  // for quick 90° flips, kept in sync with the slider.
  var rotEl = ov.querySelector('#_rrCropRot'), rotV = ov.querySelector('#_rrCropRotV');
  // v0.9.1049: rotation is a quarter-turn count plus a small levelling offset,
  // instead of one 360-degree number. Keeping them apart is what lets the
  // slider be fine without losing the ability to turn a photo on its side.
  var _quarters = 0;     // 0..3, from the ↻ button
  var _fine = 0;         // -15..+15, from the slider and the − / + buttons
  function _applyRot() {
    var total = ((_quarters * 90) + _fine);
    while (total > 180) total -= 360;
    while (total < -180) total += 360;
    if (rotV) rotV.textContent = (Math.round(total * 10) / 10) + '°';
    try { if (cropper) cropper.rotateTo(total); } catch (eR) {}
  }
  function _setFine(v) {
    _fine = Math.max(-15, Math.min(15, Math.round(v * 2) / 2));
    if (rotEl) rotEl.value = _fine;
    _applyRot();
  }
  // v0.9.1049 (Brad: "the rotate button and the picture are 90 degrees apart").
  // Cropper's internal rotation is UNDEFINED until something sets it, while the
  // slider sat at 0 assuming that was true — so the first touch wrote 0 over
  // whatever the photo was actually showing and it snapped. Seed from reality
  // once the cropper exists, and never send a rotation the user did not ask for.
  function _seedRot() {
    try {
      var d = cropper && cropper.getImageData ? cropper.getImageData() : null;
      var actual = (d && typeof d.rotate === 'number') ? d.rotate : 0;
      _quarters = Math.round(actual / 90) % 4;
      _fine = actual - (_quarters * 90);
      if (_fine > 15 || _fine < -15) _fine = 0;
      if (rotEl) rotEl.value = _fine;
      if (rotV) rotV.textContent = (Math.round(actual * 10) / 10) + '°';
    } catch (e) {}
  }
  if (rotEl) rotEl.addEventListener('input', function () { _setFine(parseFloat(rotEl.value) || 0); });
  var _minusBtn = ov.querySelector('#_rrCropRotMinus'), _plusBtn = ov.querySelector('#_rrCropRotPlus');
  if (_minusBtn) _minusBtn.onclick = function () { _setFine(_fine - 1); };
  if (_plusBtn) _plusBtn.onclick = function () { _setFine(_fine + 1); };
  ov.querySelector('#_rrCropRotate').onclick = function () {
    _quarters = (_quarters + 1) % 4;
    _applyRot();
  };
  var _wholeBtn = ov.querySelector('#_rrCropWhole');
  if (_wholeBtn) _wholeBtn.onclick = function () {
    try {
      localStorage.removeItem(_RR_BOX_KEY);
      if (cropper) cropper.reset();
      var _h = ov.querySelector('#_rrCropHint');
      if (_h) _h.textContent = 'Drag the box \u00b7 pinch or scroll to zoom';
      _wholeBtn.style.display = 'none';
    } catch (e) {}
  };
  ov.querySelector('#_rrCropCancel').onclick = function () { done(); if (onCancel) try { onCancel(); } catch (e) {} };
  ov.querySelector('#_rrCropApply').onclick = function () {
    if (!cropper) { done(); if (onCancel) try { onCancel(); } catch (e) {} return; }
    try { _rrSaveBox(cropper); } catch (eS) {}   // v0.9.1049: offer this box on the next photo
    var canvas = cropper.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400, imageSmoothingQuality: 'high' });
    if (!canvas) { done(); if (onCancel) try { onCancel(); } catch (e) {} return; }
    canvas.toBlob(function (blob) { done(); if (blob) onResult(blob); }, 'image/jpeg', 0.9);
  };
}

// v0.9.825 (TODO-008): shared crop-first hop. Opens the cropper on a freshly
// picked file; onDone receives the CROPPED file (Apply) or the ORIGINAL file
// (Cancel, or cropper unavailable). Every photo-pick spot funnels through
// this one helper so the flow stays identical app-wide.
function _cropFirst(file, onDone) {
  if (!file || typeof _openCropper !== 'function') { onDone(file); return; }
  var url = URL.createObjectURL(file);
  _openCropper(url, function (blob) {
    try { URL.revokeObjectURL(url); } catch (e) {}
    try {
      onDone(new File([blob], String(file.name || 'photo').replace(/\.[^.]+$/, '') + '_crop.jpg', { type: 'image/jpeg' }));
    } catch (e) { onDone(file); }
  }, function () {
    try { URL.revokeObjectURL(url); } catch (e) {}
    onDone(file);
  });
}
if (typeof window !== 'undefined') window._cropFirst = _cropFirst;

// ── Replacing the bytes of a photo already in Drive (v0.9.1238) ─────────
//
// THE BUG THIS FIXES, because it must never come back:
//
//   var hit = photos.find(p => p.name === fileName) || photos[0];
//
// The name being searched for was rebuilt by hand as `itemNum + ' ' + viewKey`
// — "2025 RSV.jpg". Uploads are named by _photoFileName as
// "Lionel 2025 ID116 RSV.jpg": a maker in front, an ID## in the middle. For any
// item in the collection those two strings CANNOT match, so find() always
// missed and the `|| photos[0]` handed back whatever Drive happened to list
// first. Cropping the right-side view overwrote the top view. Permanently.
//
// Two rules now, and the second matters more than the first:
//   1. A file id is the only thing that identifies a file. Where the caller
//      knows it — and the detail page always did, it was just throwing it
//      away — we PATCH that id and nothing else.
//   2. When we do not know the id, we must be SURE or do nothing. A name that
//      matches exactly one photo is sure. Anything else refuses. Losing a crop
//      is an annoyance; overwriting the wrong photo is not recoverable.
//
// There is no fallback to "the first one". There never should have been.

// The ONE writer. Everything below resolves an id and calls this.
async function _cropReplaceDriveFile(fileId, blob) {
  try {
    if (!fileId || typeof accessToken === 'undefined' || !accessToken) return false;
    var r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'image/jpeg' }, body: blob
    });
    return r.ok;
  } catch (e) { console.warn('[crop] replace by id', e); return false; }
}

// Resolve a photo by name — EXACTLY one match, or nothing. Exported so the
// tests can prove the "nothing" half without a network.
function _cropPickByName(photos, fileName) {
  if (!photos || !photos.length || !fileName) return null;
  var exact = photos.filter(function (p) { return p && p.name === fileName; });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;          // two files, same name: unsure
  // The caller may have guessed the name. Fall back to the part that is not
  // guessed — the view tag at the end — and accept it only if it is unique.
  var view = String(fileName).replace(/\.[^.]+$/, '').split(' ').pop();
  if (!view) return null;
  var tail = photos.filter(function (p) {
    return p && String(p.name).replace(/\.[^.]+$/, '').split(' ').pop() === view;
  });
  return tail.length === 1 ? tail[0] : null;
}

async function _cropReplaceDrivePhoto(folderLink, fileName, blob) {
  try {
    if (typeof driveGetFolderPhotos !== 'function' || typeof accessToken === 'undefined' || !accessToken) return false;
    var photos = await driveGetFolderPhotos(folderLink);
    var hit = _cropPickByName(photos, fileName);
    if (!hit) { console.warn('[crop] no unambiguous match for', fileName, '- refusing to overwrite'); return false; }
    return await _cropReplaceDriveFile(hit.id, blob);
  } catch (e) { console.warn('[crop] replace', e); return false; }
}

// Entry point from the ✂ button on a photo thumbnail.
function _photoCropStart(file, stepId, viewKey, itemNum, srcUrl) {
  _openCropper(srcUrl, async function (blob) {
    try {
      if (typeof _awaitPhotoUploads === 'function') await _awaitPhotoUploads(10000); // ensure the original landed
      var ext = (String(file && file.name || '').split('.').pop() || 'jpg').toLowerCase();
      var wd = (typeof wizard !== 'undefined' && wizard.data) || {};
      // v0.9.1238: the id of the file this thumbnail actually uploaded,
      // recorded by wizard-photos.js at upload time. This is the whole fix —
      // everything else here is the fallback for a photo that predates it.
      var fileId = (wd._photoFileIds || {})[stepId + '|' + viewKey] || '';
      var folderLink = (wd[stepId] && wd[stepId][viewKey]) || '';
      var ok = false;
      if (fileId) {
        ok = await _cropReplaceDriveFile(fileId, blob);
      } else if (folderLink) {
        // No id: name-match, and only if it is unambiguous. The name is built
        // by the ONE builder that names uploads, not guessed at.
        var fileName = ((typeof window !== 'undefined' && typeof window._photoFileName === 'function')
          ? window._photoFileName(itemNum, viewKey, wd._invIdForPhotos, wd._fileLabelForPhotos)
          : (itemNum + ' ' + viewKey)) + '.' + ext;
        ok = await _cropReplaceDrivePhoto(folderLink, fileName, blob);
      }
      var zone = document.querySelector('.photo-drop-zone[data-view="' + viewKey + '"][data-sid="' + stepId + '"]');
      if (zone) { var im = zone.querySelector('img'); if (im) im.src = URL.createObjectURL(blob); }
      // v0.9.1238: "will save once the upload finishes" was never true — there
      // was no retry. Say what actually happened.
      if (typeof showToast === 'function') {
        showToast(ok ? 'Photo cropped'
                     : 'Could not save the crop — the photo on screen is cropped, the one in Drive is not', 4500, !ok);
      }
    } catch (e) { console.warn('[crop] apply', e); if (typeof showToast === 'function') showToast('Crop failed: ' + e.message); }
  });
}
if (typeof window !== 'undefined') {
  window._photoCropStart = _photoCropStart;
  window._openCropper = _openCropper;
  window._cropReplaceDriveFile = _cropReplaceDriveFile;
  window._cropPickByName = _cropPickByName;
}
