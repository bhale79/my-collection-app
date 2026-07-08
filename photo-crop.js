// ══════════════════════════════════════════════════════════════════
// photo-crop.js — optional, frictionless crop for wizard photos.
// A ✂ icon sits on each photo thumbnail. Tapping it opens a crop overlay
// (Cropper.js). Apply replaces the uploaded Drive photo's bytes IN PLACE
// (PATCH …?uploadType=media — no duplicate file). Doing nothing keeps the
// full photo, with zero extra clicks.
// ══════════════════════════════════════════════════════════════════

function _openCropper(src, onResult) {
  if (typeof Cropper === 'undefined') { if (typeof showToast === 'function') showToast('Crop tool still loading — try again in a moment'); return; }
  var ov = document.createElement('div');
  // v0.9.786: TOP layer — the contact modal sits at 10040, and the cropper
  // opening BENEATH it looked like a dead button (it appeared after Save).
  ov.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.88);display:flex;flex-direction:column';
  var btn = 'padding:0.55rem 1.1rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;border:1px solid #555;background:#2a2a2a;color:#eee';
  var btnA = 'padding:0.55rem 1.2rem;border-radius:8px;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;border:none;background:#e8401c;color:#fff';
  ov.innerHTML =
    '<div style="padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;color:#fff;gap:1rem;flex-wrap:wrap">' +
      '<strong style="font-size:1rem">Crop photo</strong>' +
      '<span style="font-size:0.78rem;opacity:0.75">Drag the box · pinch or scroll to zoom</span>' +
    '</div>' +
    '<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 1rem;overflow:hidden"><img id="_rrCropImg" style="max-width:100%;max-height:100%;display:block"></div>' +
    '<div style="padding:0.85rem 1rem;display:flex;gap:0.6rem;justify-content:flex-end">' +
      '<button id="_rrCropCancel" style="' + btn + '">Cancel</button>' +
      '<button id="_rrCropApply" style="' + btnA + '">Apply crop</button>' +
    '</div>';
  document.body.appendChild(ov);
  var img = ov.querySelector('#_rrCropImg');
  var cropper = null;
  img.onload = function () { try { cropper = new Cropper(img, { viewMode: 1, autoCropArea: 1, background: false, movable: true, zoomable: true, responsive: true, checkOrientation: true }); } catch (e) { console.warn('[crop] init', e); } };
  img.src = src;
  function done() { try { if (cropper) cropper.destroy(); } catch (e) {} ov.remove(); }
  ov.querySelector('#_rrCropCancel').onclick = done;
  ov.querySelector('#_rrCropApply').onclick = function () {
    if (!cropper) { done(); return; }
    var canvas = cropper.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400, imageSmoothingQuality: 'high' });
    if (!canvas) { done(); return; }
    canvas.toBlob(function (blob) { done(); if (blob) onResult(blob); }, 'image/jpeg', 0.9);
  };
}

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
