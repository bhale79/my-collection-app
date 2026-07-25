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

function _openCropper(src, onResult, onCancel) {   // v0.9.787: onCancel = proceed without cropping
  if (typeof Cropper === 'undefined') { if (typeof showToast === 'function') showToast('Crop tool still loading — try again in a moment'); return; }
  var ov = document.createElement('div');
  // v0.9.786: TOP layer — the contact modal sits at 10040, and the cropper
  // opening BENEATH it looked like a dead button (it appeared after Save).
  // v0.9.883 (Brad): fully opaque backdrop — the old 0.88 let background
  // repaints (loading pill, dashboard rebuilds) flicker through mid-crop.
  ov.style.cssText = 'position:fixed;inset:0;z-index:100010;background:#000;display:flex;flex-direction:column';
  var btn = 'padding:0.55rem 1.1rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#eee';
  var btnA = 'padding:0.55rem 1.2rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;border:none;background:var(--accent);color:#fff';
  ov.innerHTML =
    '<div style="padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;color:#fff;gap:1rem;flex-wrap:wrap">' +
      '<strong style="font-size:1rem">Crop photo</strong>' +
      '<span style="font-size:0.78rem;opacity:0.75">Drag the box · pinch or scroll to zoom</span>' +
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
        '<img id="_rrCropImg" style="max-width:100%;max-height:100%;display:block;margin:0 auto">' +
      '</div>' +
    '</div>' +
    // v0.9.904 (Brad, item [3]): fine-rotation slider restored \u2014 same control
    // the box-scanner cropper uses (barcode.js). Any angle via the slider; the
    // \u21bb button steps 90\u00b0 and keeps the slider in sync.
    '<div style="padding:0.55rem 1rem 0;display:flex;align-items:center;gap:0.5rem">' +
      '<span style="color:#ccc;font-size:0.78rem;white-space:nowrap">Rotate</span>' +
      '<input id="_rrCropRot" type="range" min="-180" max="180" step="1" value="0" style="flex:1;accent-color:var(--accent,#e8401c)">' +
      '<span id="_rrCropRotV" style="color:#ccc;font-size:0.78rem;min-width:3.2em;text-align:right">0\u00b0</span>' +
    '</div>' +
    '<div style="padding:0.85rem 1rem;display:flex;gap:0.6rem;justify-content:flex-end">' +
      '<button id="_rrCropRotate" style="' + btn + ';margin-right:auto">\u21bb Rotate</button>' +
      '<button id="_rrCropCancel" style="' + btn + '">Cancel</button>' +
      '<button id="_rrCropApply" style="' + btnA + '">Apply crop</button>' +
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
  function _build() {
    if (_built || !document.body.contains(ov)) return;
    _built = true;
    _freezeStage();
    // v0.9.904 (Brad, item [3]): viewMode 0 (was 1) so a rotated photo isn't
    // clamped/zoomed to fill the frame — matches the box-scanner cropper, which
    // is what makes the fine-rotation slider behave.
    try {
      cropper = new Cropper(img, { viewMode: 0, autoCropArea: 1, background: false, movable: true, zoomable: true, responsive: !_phone, checkOrientation: true });
    } catch (e) { console.warn('[crop] init', e); }
  }
  // v0.9.1031: build ONCE, and only after the photo has actually decoded and
  // the overlay has been laid out — the old code raced the decode, so the
  // first thing you saw was a half-drawn cropper being redrawn.
  img.onload = function () {
    var go = function () { requestAnimationFrame(function () { requestAnimationFrame(_build); }); };
    try { if (img.decode) { img.decode().then(go, go); } else { go(); } } catch (eD) { go(); }
  };
  img.src = src;

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
  function _setRot(v) {
    v = Math.max(-180, Math.min(180, Math.round(v)));
    if (rotEl) rotEl.value = v;
    if (rotV) rotV.textContent = v + '°';
    try { if (cropper) cropper.rotateTo(v); } catch (eR) {}
  }
  if (rotEl) rotEl.addEventListener('input', function () { _setRot(parseFloat(rotEl.value) || 0); });
  ov.querySelector('#_rrCropRotate').onclick = function () {
    var nv = (parseFloat(rotEl && rotEl.value) || 0) + 90;
    if (nv > 180) nv -= 360;   // wrap so the 90° button keeps cycling
    _setRot(nv);
  };
  ov.querySelector('#_rrCropCancel').onclick = function () { done(); if (onCancel) try { onCancel(); } catch (e) {} };
  ov.querySelector('#_rrCropApply').onclick = function () {
    if (!cropper) { done(); if (onCancel) try { onCancel(); } catch (e) {} return; }
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

// Replace the bytes of an already-uploaded Drive photo in place (no duplicate).
async function _cropReplaceDrivePhoto(folderLink, fileName, blob) {
  try {
    if (typeof driveGetFolderPhotos !== 'function' || typeof accessToken === 'undefined' || !accessToken) return false;
    var photos = await driveGetFolderPhotos(folderLink);
    if (!photos || !photos.length) return false;
    var hit = photos.find(function (p) { return p.name === fileName; }) || photos[0];
    if (!hit) return false;
    var r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + hit.id + '?uploadType=media', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'image/jpeg' }, body: blob
    });
    return r.ok;
  } catch (e) { console.warn('[crop] replace', e); return false; }
}

// Entry point from the ✂ button on a photo thumbnail.
function _photoCropStart(file, stepId, viewKey, itemNum, srcUrl) {
  _openCropper(srcUrl, async function (blob) {
    try {
      if (typeof _awaitPhotoUploads === 'function') await _awaitPhotoUploads(10000); // ensure the original landed
      var ext = (String(file && file.name || '').split('.').pop() || 'jpg').toLowerCase();
      var fileName = itemNum + ' ' + viewKey + '.' + ext;
      var folderLink = (typeof wizard !== 'undefined' && wizard.data && wizard.data[stepId] && wizard.data[stepId][viewKey]) || '';
      var ok = folderLink ? await _cropReplaceDrivePhoto(folderLink, fileName, blob) : false;
      var zone = document.querySelector('.photo-drop-zone[data-view="' + viewKey + '"][data-sid="' + stepId + '"]');
      if (zone) { var im = zone.querySelector('img'); if (im) im.src = URL.createObjectURL(blob); }
      if (typeof showToast === 'function') showToast(ok ? 'Photo cropped' : 'Cropped — will save once the upload finishes', 1800);
    } catch (e) { console.warn('[crop] apply', e); if (typeof showToast === 'function') showToast('Crop failed: ' + e.message); }
  });
}
if (typeof window !== 'undefined') { window._photoCropStart = _photoCropStart; window._openCropper = _openCropper; }
