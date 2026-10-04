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
    // v0.9.1876: the grip blue is ONE variable — the straighten dots and their
    // outline wear it too (no second literal; the colour ratchet holds at 12).
    stl.textContent = ':root{--rr-grip:#39f;--rr-dim:rgba(0,0,0,0.55)}'
      + '.cropper-point{width:16px!important;height:16px!important;opacity:0.9!important;background-color:var(--rr-grip)}'
      + '.cropper-point.point-e{right:-8px;margin-top:-8px}'
      + '.cropper-point.point-n{top:-8px;margin-left:-8px}'
      + '.cropper-point.point-w{left:-8px;margin-top:-8px}'
      + '.cropper-point.point-s{bottom:-8px;margin-left:-8px}'
      + '.cropper-point.point-ne{top:-8px;right:-8px}'
      + '.cropper-point.point-nw{top:-8px;left:-8px}'
      + '.cropper-point.point-sw{bottom:-8px;left:-8px}'
      + '.cropper-point.point-se{bottom:-8px;right:-8px;width:16px!important;height:16px!important}'
      // v0.9.1773 (Brad: "the crop box blue grips are too close to the edge and
      // is super hard to get sometimes with your fingers"). v0.9.790 already
      // went 5px -> 16px and that is as large as the square can be before it
      // starts hiding the picture underneath it. So grow the TARGET instead of
      // the square: an invisible 34px pad centred on each grip, which roughly
      // quadruples the area your finger has to hit while nothing looks any
      // different. 34 and not the usual 44 on purpose — the crop box floor is
      // 64px, so 44 would make opposite corners' targets overlap and you would
      // grab the wrong one.
      + '.cropper-point:after{content:"";position:absolute;left:50%;top:50%;'
      +   'width:34px;height:34px;transform:translate(-50%,-50%)}'
      // v0.9.1876: the straighten dots — an 18px dot inside a 34px target.
      + '.rr-str-dot{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center}'
      + '.rr-str-dot span{width:18px;height:18px;border-radius:50%;background:var(--rr-grip);border:2px solid #fff;display:block}'
      + '.rr-str-poly{fill:var(--rr-grip);fill-opacity:0.12;stroke:var(--rr-grip);stroke-width:2}';
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

// ══ v0.9.1827 — THE CROP SCREEN WORKS ON A SCREEN-SIZED COPY ══════════════
// Brad, 2026-09-27, the THIRD flash report ("the crazy flashing again … the
// picture itself") — and this time the recorder's diary came off his phone
// (v1826) and says what it is:
//   0 viewport events, 9 changes behind the overlay, page height moved 0x
//   593 frames in 13.4s (44.2/sec), 1 over 100ms, 0 over 250ms, worst 170ms
//   busiest INSIDE: div.cropper-crop-box x48, img x44, div.cropper-canvas x9
//   photo 3000x4000 12.0MP
// The page beneath was innocent (v1703 already holds it still). The main
// thread never stalled. Everything that moved was Cropper redrawing a
// TWELVE-MEGAPIXEL picture on every nudge — rotate, zoom, a grip dragged —
// and Android Chrome blanks a picture that big while it re-rasters it. That
// blank is the flash. The recorder's own note (retired in v1830) guessed this.
//
// So the picture Cropper is handed is at most _RR_CROP_MAX on its long side.
// NOTHING IS LOST: getCroppedCanvas({ maxWidth, maxHeight }) has always drawn
// the photo into a source canvas capped at that same size BEFORE cutting the
// crop from it (Cropper 1.6.1, getSourceCanvas) — the saved crop never used
// more of the photo than this. One number, both places (the v1784 rule).
// The copy is made only when the browser applies EXIF rotation itself
// (_rrOrientProbe): a drawn copy has no EXIF to read, so an old browser keeps
// the original and Cropper's own checkOrientation, exactly as before.
var _RR_CROP_MAX = 2400;
var _RR_DECODE_WAIT_MS = 2500;   // v0.9.1828: the longest a crop waits on the photo decoding — see `decoded` in _openCropper

// img is the decoded photo. cb(url) with a blob URL of the smaller copy, or
// cb(null) when the photo already fits (or anything goes wrong — the original
// is then used as it always was; a crop must never fail over its preview).
function _rrCropPreview(img, max, cb) {
  try {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || (w <= max && h <= max)) { cb(null); return; }
    var s = max / Math.max(w, h);
    var c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (eQ) {}
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(function (blob) {
      try { cb(blob ? URL.createObjectURL(blob) : null); } catch (eU) { cb(null); }
    }, 'image/jpeg', 0.92);
  } catch (e) { cb(null); }
}
if (typeof window !== 'undefined') { window._rrCropPreview = _rrCropPreview; }

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

// v0.9.1774 — the same question _rrLoadBox answers, asked BEFORE the cropper
// exists. "Whole photo" used to be revealed in Cropper's ready callback, which
// runs AFTER _freezeStage has measured and pinned the picture area — so on the
// remembered-crop path the header grew by a button's height a moment too late
// and the picture kept a height that had just stopped being correct. The img is
// already loaded and decoded by the time _build runs, so its own naturalWidth /
// naturalHeight answer the orientation test without Cropper.
//
// If this ever disagrees with _rrLoadBox (EXIF handling differs), the cost is a
// reserved-but-unused button row or a header that still grows — and the clamp
// above makes both harmless. That is the point of the clamp.
function _rrSavedBoxFits(img) {
  try {
    var raw = localStorage.getItem(_RR_BOX_KEY);
    if (!raw) return false;
    var box = JSON.parse(raw);
    if (!box || !box.w || !box.h) return false;
    if (Date.now() - (box.t || 0) > _RR_BOX_MAX_AGE) return false;
    if (!img || !img.naturalWidth) return false;
    return (img.naturalWidth >= img.naturalHeight) === !!box.land;
  } catch (e) { return false; }
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

// ══ THE CROP FLASH RECORDER — RETIRED in v0.9.1830 (the Session 94 rule) ═══
// v0.9.1700–1701 put a recorder in this screen instead of guessing a sixth
// time, and v0.9.1826 made its diary ride the account file so a phone's diary
// could be read from the desktop. It named the flash three times over:
//   v1 (v1700): 0 viewport events, page height moved 0x — the URL bar never
//       moved; the v1031 theory was dead.
//   v2 (v1701): 27 Master Catalog rebuilds behind an opaque overlay during a
//       boot data load, 26 long frames — v1703's rrHoldRepaint.
//   v3 (v1826): 0 changes that mattered behind, 0 stalled frames, and INSIDE
//       the overlay Cropper redrawing a 3000×4000 (12 MP) picture 48+44 times
//       — v1827's screen-sized copy (_rrCropPreview, above).
// [stated] Brad, 2026-09-28: "yes it works." So the recorder, its restamp
// helper, error-report's diary line and the diary key itself are gone (the
// key is on drive.js's PREFS_RETIRED list, so it leaves the account file too);
// tests/crop_flash_recorder_tests.js now proves they STAY gone. If the flash
// ever comes back, the diary above is the shape to rebuild — measure first.

// ══ v0.9.1872 — THE ORIGINAL IS KEPT ═══════════════════════════════════════
// [stated] Brad, 2026-10-03: "i would like to be able to crop a picture and be
// able to undo or reset back to original, even be able to go back later and
// reset back to original. sometimes i crop too close and i can't fix it." —
// and, on re-cropping: "the new crop pic would replace the old crop pic".
//
// HOW. Drive keeps every replaced version of a file for 30 days and then
// throws it away — unless that version is marked keepForever. So the ONE
// writer (_cropReplaceDriveFile, below) marks the FIRST version of the file —
// the original, as uploaded — keepForever BEFORE it overwrites anything, and
// REFUSES the crop if it cannot. The crop goes on top as the current version,
// which is what every thumbnail, gallery, report and share shows, exactly as
// before. A re-crop replaces that crop; Drive purges the superseded crop by
// itself in 30 days, so nothing here ever calls DELETE. One file per photo, as
// always — the original lives in that file's own version history.
//
// The crop box is stored ON the photo (appProperties rrBox: x,y,w,h in the
// original's pixels, the rotation, and the original's width) so that the next ✂ on
// a cropped photo can show the ORIGINAL with the current crop drawn on it —
// widen the box, Apply, done — and "Restore original" (or Whole photo + Apply)
// puts the original's exact bytes back, not a re-encoded copy.
//
// Photos cropped at the moment they are taken (_cropFirst) never used to
// upload the original at all. Now the cropped File carries its original
// (_rrOriginal) and its box (_rrCropBox); drive.js's two creators upload the
// ORIGINAL as the file and apply the crop on top through the same ONE writer.
//
// A photo cropped before this shipped still has its original in Drive only if
// the crop is less than 30 days old. Older ones are gone; the screen simply
// behaves as it did.
var _RR_BOX_PROP = 'rrBox';

// What Apply records: the crop as Cropper reports it — whole natural pixels of
// the loaded picture, in the rotated frame (Cropper 1.6.1 getData/setData agree
// on that frame) — together with that picture's natural width, so the same box
// lands exactly on the same picture and scales onto its screen-sized copy
// (_rrCropPreview: same aspect, one scale). Whole pixels on purpose: a box kept
// as fractions came back a pixel short (799 of 800) after the round trip.
// `whole` is true when nothing was cropped or turned.
function _rrCropBoxOf(cropper) {
  try {
    var d = cropper.getData(true), im = cropper.getImageData();
    var W = im && im.naturalWidth, H = im && im.naturalHeight;
    if (!d || !W || !H) return null;
    var r = d.rotate || 0;
    while (r > 180) r -= 360;
    while (r <= -180) r += 360;
    r = Math.round(r * 10) / 10;
    var box = { x: d.x, y: d.y, w: d.width, h: d.height, r: r, W: W };
    box.whole = r === 0 && d.x <= 1 && d.y <= 1 && d.width >= W - 2 && d.height >= H - 2;
    return box;
  } catch (e) { return null; }
}
// "x,y,w,h,r,W" — under 124 bytes, the appProperties limit, by a long way.
function _rrBoxStr(box) {
  return [box.x, box.y, box.w, box.h].map(function (v) { return String(Math.round(Number(v) || 0)); }).join(',') + ',' + (Number(box.r) || 0).toFixed(1) + ',' + String(Math.round(Number(box.W) || 0));
}
function _rrBoxParse(s) {
  var p = String(s || '').split(',').map(parseFloat);
  if (p.length !== 6 || p.some(function (v) { return isNaN(v); }) || p[2] <= 0 || p[3] <= 0 || p[5] <= 0) return null;
  return { x: p[0], y: p[1], w: p[2], h: p[3], r: p[4], W: p[5] };
}
// Draw a stored box on the picture now in the cropper (rotation is set by the
// caller through the screen's own controls first, so the readout agrees). The
// picture may be the original or its screen-sized copy: one scale, by width.
function _rrBoxApply(cropper, box) {
  try {
    var im = cropper.getImageData(), W2 = im && im.naturalWidth;
    if (!W2 || !box) return false;
    var k = (box.W > 0) ? (W2 / box.W) : 1;
    cropper.setData({ x: box.x * k, y: box.y * k, width: box.w * k, height: box.h * k });
    return true;
  } catch (e) { return false; }
}
if (typeof window !== 'undefined') { window._rrCropBoxOf = _rrCropBoxOf; window._rrBoxStr = _rrBoxStr; window._rrBoxParse = _rrBoxParse; }

// ══ v0.9.1876 — STRAIGHTEN (keystone) ═══════════════════════════════════════
// [stated] Brad, 2026-10-03: "how hard to fix keystoning?" → the plan → "ok".
// A box photographed from an angle comes out as a trapezoid. The collector
// drags four dots onto its corners and that four-sided patch is redrawn as a
// true rectangle, straight-on, inside the crop screen; level, zoom and the crop
// box then work on the straightened picture as usual.
//
// HOW. The map from a flat rectangle to a photographed one is a plane
// projection (a homography): eight numbers, fixed by the four corner pairs.
// _rrHomography solves them; _rrWarpQuad traces every output pixel back into
// the photo and reads it with bilinear weights — pure JS, no add-on, in row
// chunks with a yield between them so a phone keeps painting. The output size
// comes from the dots (top/bottom averaged for width, left/right for height),
// capped at _RR_CROP_MAX like every crop. A turn already applied (90° or a
// levelling step) is baked into the picture the dots sit on
// (_rrRotatedCanvas), in exactly Cropper's frame — the rotated bounding box —
// so the crop box's corners are the dots' natural starting place.
//
// RECORD. The dots ride the photo beside the crop box (appProperties rrQuad =
// "r|W|H|x1,y1,…,x4,y4": the turn, the size of the picture the dots were set
// on, the four corners in its pixels) so ✂ on a straightened photo puts the
// dots back where they were (scaled by one number when the picture that comes
// back is the original rather than its screen-sized copy) and shows the
// straightened result with the crop box drawn. A straightened result is never
// "the original, whole": Apply on it is a crop, never a restore.
//
// LIMITS, told to Brad: the far side of a keystoned shot is stretched, so its
// lettering comes out softer; nothing is invented. Four dots, one plane: a
// box with a crushed or hidden corner needs a best guess.

// The 3×3 projective map taking the four `from` points onto the four `to`
// points (same corner order). Gaussian elimination with partial pivoting on
// the 8×8 system; h[8] is 1. null when the four points cannot be mapped (three
// in a line, two the same).
function _rrHomography(from, to) {
  var A = [], b = [], i, k, r;
  for (i = 0; i < 4; i++) {
    var x = from[i][0], y = from[i][1], X = to[i][0], Y = to[i][1];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  for (var c = 0; c < 8; c++) {
    var p = c;
    for (r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    if (p !== c) { var tA = A[p]; A[p] = A[c]; A[c] = tA; var tb = b[p]; b[p] = b[c]; b[c] = tb; }
    for (r = c + 1; r < 8; r++) {
      var f = A[r][c] / A[c][c];
      if (!f) continue;
      for (k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  var h = new Array(9);
  for (i = 7; i >= 0; i--) {
    var s = b[i];
    for (k = i + 1; k < 8; k++) s -= A[i][k] * h[k];
    h[i] = s / A[i][i];
  }
  h[8] = 1;
  return h;
}
function _rrProject(h, x, y) {
  var w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}
// What shape was the thing REALLY? The photographed quad of a flat rectangle
// also says how wide it is for its height, if the camera is assumed to look
// through the picture's centre (Zhang & He, "Whiteboard scanning", 2004 — the
// same sums every scanning app does). The sums also yield the camera's focal
// length — but only when BOTH pairs of edges converge; a pure keystone (one
// pair parallel) leaves it undefined and, numerically, garbage. So the focal
// length is used only when it is one a phone could have (half to twice the
// picture's width); otherwise a phone's usual lens is assumed (0.75 × width —
// a 26–28 mm equivalent), which is within a few percent for tilts up to 30°
// where plain edge-averaging is off by 15–50 %. Returns width ÷ height, or
// null when the answer is outside anything a box photo can mean. Corners are
// [tl, tr, br, bl] in picture pixels; cx, cy the picture's centre; W its width.
function _rrQuadAspect(q, cx, cy, W) {
  try {
    var m1 = [q[0][0] - cx, q[0][1] - cy, 1], m2 = [q[1][0] - cx, q[1][1] - cy, 1], m3 = [q[3][0] - cx, q[3][1] - cy, 1], m4 = [q[2][0] - cx, q[2][1] - cy, 1];
    var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
    var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    var k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
    var k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
    var n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
    var n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
    var f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
    var fa = 0.75 * (W > 0 ? W : (2 * Math.max(Math.abs(cx), 1)));
    if (!(f2 > 0) || !isFinite(f2) || Math.sqrt(f2) < 0.5 * fa / 0.75 || Math.sqrt(f2) > 2 * fa / 0.75) f2 = fa * fa;   // not a lens a phone has: assume one
    var ratio = Math.sqrt((n2[0] * n2[0] + n2[1] * n2[1] + f2 * n2[2] * n2[2]) / (n3[0] * n3[0] + n3[1] * n3[1] + f2 * n3[2] * n3[2]));
    if (!isFinite(ratio) || ratio < 0.2 || ratio > 5) return null;
    return ratio;
  } catch (e) { return null; }
}
// The straightened size for a quad [tl, tr, br, bl]: the edges averaged for a
// first size, then — when the picture says what shape the thing really was —
// the shorter side re-derived from the longer one and that shape, so a box face
// comes out in its true proportions instead of foreshortened. The long side is
// capped at `cap`, never under 64 (the crop box floor). cx, cy: the centre of
// the picture the corners were placed on.
function _rrQuadSize(q, cap, cx, cy) {
  var d = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  var w = (d(q[0], q[1]) + d(q[3], q[2])) / 2, h = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  var ratio = (cx != null && cy != null) ? _rrQuadAspect(q, cx, cy, cx * 2) : null;
  if (ratio && w > 0 && h > 0) {
    var measured = w / h;
    // trust it within reason: the averaged shape is never off by more than half
    if (ratio / measured > 0.5 && ratio / measured < 2) { if (w >= h) h = w / ratio; else w = h * ratio; }
  }
  var s = Math.min(1, cap / Math.max(w, h, 1));
  return { w: Math.max(64, Math.round(w * s)), h: Math.max(64, Math.round(h * s)) };
}
// Redraw the quad `q` of the canvas `src` as a w×h rectangle. cb(canvas), or
// cb(null) when the corners cannot be mapped. Rows in chunks of 96 with a
// setTimeout between — a 2400-pixel picture takes well under a second on a
// phone and the "Straightening…" notice stays painted.
function _rrWarpQuad(src, q, w, h, cb) {
  var H = _rrHomography([[0, 0], [w, 0], [w, h], [0, h]], q);   // output → source
  if (!H) { cb(null); return; }
  var sw = src.width, sh = src.height;
  var sd = src.getContext('2d').getImageData(0, 0, sw, sh).data;
  var out = document.createElement('canvas'); out.width = w; out.height = h;
  var octx = out.getContext('2d'), od = octx.createImageData(w, h), o = od.data;
  var y = 0;
  function chunk() {
    var yEnd = Math.min(h, y + 96);
    for (; y < yEnd; y++) {
      var Y = y + 0.5;
      for (var x = 0; x < w; x++) {
        var X = x + 0.5;
        var den = H[6] * X + H[7] * Y + H[8];
        var u = (H[0] * X + H[1] * Y + H[2]) / den - 0.5, v = (H[3] * X + H[4] * Y + H[5]) / den - 0.5;
        var oi = (y * w + x) * 4;
        if (u < -1 || v < -1 || u > sw || v > sh) { o[oi] = 0; o[oi + 1] = 0; o[oi + 2] = 0; o[oi + 3] = 255; continue; }   // past the photo's edge: black
        var x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, x1 = x0 + 1, y1 = y0 + 1;
        if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 < 0) x1 = 0; if (y1 < 0) y1 = 0;
        if (x0 >= sw) x0 = sw - 1; if (y0 >= sh) y0 = sh - 1; if (x1 >= sw) x1 = sw - 1; if (y1 >= sh) y1 = sh - 1;
        var i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
        var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        o[oi]     = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
        o[oi + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
        o[oi + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
        o[oi + 3] = 255;
      }
    }
    if (y < h) { setTimeout(chunk, 0); return; }
    octx.putImageData(od, 0, 0);
    cb(out);
  }
  chunk();
}
// The picture turned by `deg` (clockwise, Cropper's and the canvas's shared
// convention) into a canvas the size of its rotated bounding box — the frame
// Cropper's getData / setData speak in for a turned picture.
function _rrRotatedCanvas(img, deg) {
  try {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    var rad = (Number(deg) || 0) * Math.PI / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    var cw = Math.max(1, Math.round(w * c + h * s)), ch = Math.max(1, Math.round(w * s + h * c));
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    var ctx = cv.getContext('2d');
    ctx.translate(cw / 2, ch / 2); ctx.rotate(rad); ctx.drawImage(img, -w / 2, -h / 2);
    return cv;
  } catch (e) { return null; }
}
// "r|W|H|x1,y1,x2,y2,x3,y3,x4,y4" — whole pixels, under the appProperties limit.
var _RR_QUAD_PROP = 'rrQuad';
function _rrQuadStr(q) {
  return [(Math.round((Number(q.r) || 0) * 10) / 10).toFixed(1), Math.round(q.W), Math.round(q.H)].join('|') + '|' +
    q.pts.map(function (p) { return Math.round(p[0]) + ',' + Math.round(p[1]); }).join(',');
}
function _rrQuadParse(s) {
  var parts = String(s || '').split('|');
  if (parts.length !== 4) return null;
  var r = parseFloat(parts[0]), W = parseFloat(parts[1]), H = parseFloat(parts[2]);
  var n = parts[3].split(',').map(parseFloat);
  if (n.length !== 8 || n.some(function (v) { return isNaN(v); }) || isNaN(r) || !(W > 0) || !(H > 0)) return null;
  var pts = []; for (var i = 0; i < 8; i += 2) pts.push([n[i], n[i + 1]]);
  return { r: r, W: W, H: H, pts: pts };
}
if (typeof window !== 'undefined') {
  window._rrHomography = _rrHomography; window._rrProject = _rrProject; window._rrQuadSize = _rrQuadSize; window._rrQuadAspect = _rrQuadAspect;
  window._rrWarpQuad = _rrWarpQuad; window._rrRotatedCanvas = _rrRotatedCanvas; window._rrQuadStr = _rrQuadStr; window._rrQuadParse = _rrQuadParse;
}

function _openCropper(src, onResult, onCancel, opts) {   // v0.9.787: onCancel = proceed without cropping
  // v0.9.1052: opts lets a caller reword the screen — the crop-before-a-paid-read
  // flow needs its Cancel to read "Use whole photo", because there it is a real
  // choice with a cost, not an escape hatch.
  // v0.9.1872: opts.original (the screen is showing a cropped photo's ORIGINAL),
  // opts.box (that photo's current crop, drawn as the starting box) and
  // opts.restore (a function → the "Restore original" button). onResult gets a
  // second argument, the box the crop was taken from (_rrCropBoxOf).
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
  // v0.9.1736 (Brad): the step buttons share ONE style, built from btn above so
  // this row introduces no colour of its own. The two hand-written copies the
  // old −/+ buttons carried are gone with the slider.
  var stepBtn = btn + ';padding:0.45rem 0.6rem;min-width:46px;min-height:40px;font-size:0.86rem;line-height:1;white-space:nowrap';
  var waitCss = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:0.85rem';   // v0.9.1876: one notice style (Loading photo… / Straightening…)
  ov.innerHTML =
    '<div style="flex:0 0 auto;padding:0.75rem 1rem;display:flex;justify-content:space-between;align-items:center;color:#fff;gap:1rem;flex-wrap:wrap">' +
      '<strong style="font-size:1rem">' + (opts.title || 'Crop photo') + '</strong>' +
      // v0.9.1872: when the screen shows a cropped photo's ORIGINAL it says so,
      // and the box drawn on it is the crop as it stands.
      '<span id="_rrCropHint" style="font-size:0.78rem;opacity:0.75">' + (opts.hint || (opts.original ? (opts.box ? 'Showing the original photo · the box is your current crop' : 'Showing the original photo') : 'Drag the box · zoom with the buttons')) + '</span>' +
      // v0.9.1872: both buttons are decided BEFORE the picture area is measured
      // (_freezeStage) — the v0.9.1774 rule: a button revealed late grows the
      // header under a picture that was already pinned.
      '<button id="_rrCropWhole" style="' + btn + ';display:' + (opts.box ? '' : 'none') + ';padding:0.4rem 0.7rem;min-height:38px;font-size:0.78rem">Whole photo</button>' +
      (typeof opts.restore === 'function'
        ? '<button id="_rrCropRestore" title="Put the original photo back, exactly as it was taken" style="' + btn + ';padding:0.4rem 0.7rem;min-height:38px;font-size:0.78rem">\u21a9 Restore original</button>'
        : '') +
    '</div>' +
    // v0.9.1031 (Brad): the crop box used to sit 16px too far RIGHT, so both
    // right-hand grab squares fell off a phone screen. Cropper measures its
    // container from the OUTSIDE (offsetWidth includes padding) but is then
    // laid out INSIDE the padding — so 1rem of padding here pushed the whole
    // crop box 1rem off the right edge. The padding now lives on a wrapper
    // and the stage itself is a plain relative box, so Cropper measures the
    // real area it gets to draw in.
    // ══ v0.9.1774 — THE PICTURE MAY NEVER DRAW OVER THE CONTROLS ═════════
    // Brad, 2026-09-19, after v0.9.1773 did NOT fix it: "the screen covers the
    // rotate buttons completely, it doesn't cover the zoom button."
    //
    // That sentence is the diagnosis. If the picture area were simply too tall
    // the rows below would be PUSHED DOWN and Cancel/Apply would be off the
    // bottom of the screen. They are not — every row is exactly where it
    // belongs and the picture is hanging OVER the first of them.
    //
    // `overflow:hidden` was on the STAGE, which is frozen to a pixel height by
    // _freezeStage. It was never on this WRAPPER. So when the frozen height is
    // bigger than the space the wrapper actually has, the wrapper keeps its own
    // correct size (the rows below never move) and the stage spills out of it,
    // over the Level row — one row's worth, which stops before Zoom.
    //
    // Clamping here is the part that matters more than any measurement, and
    // v0.9.1773 should have had it: with max-height the stage cannot be frozen
    // larger than its space in the first place, and overflow:hidden means even
    // a future mis-measure degrades to a slightly clipped picture instead of
    // controls the user cannot reach. A fix that only works when the
    // measurement is right is not much of a fix.
    '<div style="flex:1;min-height:0;padding:0 12px 4px;display:flex;overflow:hidden">' +
      '<div id="_rrCropStage" style="flex:1;min-height:0;max-height:100%;position:relative;overflow:hidden">' +
        // v0.9.1032: the raw <img> stays INVISIBLE until Cropper has taken it
        // over. It used to paint at full size first and then get swapped for
        // Cropper's own rendering — one of the blinks Brad was seeing.
        '<img id="_rrCropImg" style="max-width:100%;max-height:100%;display:block;margin:0 auto;visibility:hidden">' +
        '<div id="_rrCropWait" style="' + waitCss + '">Loading photo…</div>' +
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
    // ══ v0.9.1736 (Brad) — BUTTONS UNDER THE PICTURE, NO SLIDER ════════════
    // "need the crop angle to adjust by .5 angle not 1. also can we -90, -.5,
    // +.5, +90 arrows directly under the picture, don't need the scroll bar.
    // also need a + / - zoom button."
    //
    // The slider is gone. v0.9.1049 already narrowed it from 360° to ±15°
    // because a thumb-width moved it thirty degrees; the honest end of that
    // road is that levelling a photo is a STEPPING job, not a dragging one.
    // Every control here now moves a known amount, so the result is repeatable
    // and nothing can fling.
    // \u2550\u2550 v0.9.1777 \u2192 v0.9.1778 (Brad): TWO SEALED ROWS, NO WRAPPING \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    // v1777 stopped the labels spilling out of their buttons, and then the row
    // simply ran out of width and WRAPPED \u2014 stranding "\u21bb 90\u00b0" on a second line
    // next to the word "Zoom", so the second line read as a mixed row rather
    // than a group. [stated] Brad: "always 2 clean rows".
    //
    // The wrapping is GONE rather than tuned. It is the thing that keeps
    // breaking: `flex-wrap:wrap` on one long row hands the break point to
    // whatever width the device happens to report, and Brad's S25 Ultra
    // reports a NARROW one because Samsung's Display size setting scales
    // everything up \u2014 a physically large screen behaving like a small one.
    //
    // Two rows, each a SEALED group (`flex-wrap:nowrap`): levelling, then
    // zoom. A member can never be orphaned into the other group's row,
    // whatever width the screen claims to be.
    //
    // Labels tightened to buy headroom: "\u21ba 90\u00b0" \u2192 "\u21ba90\u00b0", "\u2212 0.5\u00b0" \u2192 "\u22120.5\u00b0".
    // The word "Level" is gone \u2014 the buttons already say 90\u00b0 and 0.5\u00b0, and
    // nothing else on that row could be mistaken for rotation. "Zoom" STAYS,
    // because a bare \u2212 and + really is ambiguous. That takes row one from
    // roughly 850 points on Brad's phone to roughly 700, against ~860
    // available: about 20% headroom instead of a sliver.
    //
    // `overflow-x:auto` is the CLAMP, and it is there for the same reason as
    // the wrapper clip in v0.9.1774: if a row ever does exceed the screen on
    // some device nobody anticipated, it SCROLLS \u2014 the controls stay
    // reachable. The worst case must be inconvenient, never invisible.
    '<div style="flex:0 0 auto;padding:0.55rem 1rem 0">' +
      // Row 1 \u2014 levelling. Sealed.
      '<div id="_rrCropRowLevel" style="display:flex;align-items:center;gap:0.35rem;flex-wrap:nowrap;justify-content:center;overflow-x:auto">' +
        '<button id="_rrCropRotQtrL" class="rr-tap-wide" title="Turn 90 degrees left" style="' + stepBtn + '">\u21ba90\u00b0</button>' +
        '<button id="_rrCropRotMinus" class="rr-tap-wide" title="Half a degree left" style="' + stepBtn + '">\u22120.5\u00b0</button>' +
        '<span id="_rrCropRotV" style="color:#ccc;font-size:0.82rem;min-width:4.2em;text-align:center;font-variant-numeric:tabular-nums">0.0\u00b0</span>' +
        '<button id="_rrCropRotPlus" class="rr-tap-wide" title="Half a degree right" style="' + stepBtn + '">+0.5\u00b0</button>' +
        '<button id="_rrCropRotQtrR" class="rr-tap-wide" title="Turn 90 degrees right" style="' + stepBtn + '">\u21bb90\u00b0</button>' +
      '</div>' +
      // Row 2 \u2014 zoom. Sealed. Keeps its word; a bare \u2212 and + says nothing.
      '<div id="_rrCropRowZoom" style="display:flex;align-items:center;gap:0.35rem;flex-wrap:nowrap;justify-content:center;overflow-x:auto;margin-top:0.35rem">' +
        '<span style="color:#ccc;font-size:0.78rem;white-space:nowrap">Zoom</span>' +
        '<button id="_rrCropZoomOut" class="rr-tap" title="Zoom out" style="' + stepBtn + '">\u2212</button>' +
        '<button id="_rrCropZoomIn" class="rr-tap" title="Zoom in" style="' + stepBtn + '">+</button>' +
        // v0.9.1876: the keystone fix. Sealed in this row with Zoom; ~95px, which
        // the narrowest phone Brad has still fits beside "Zoom − +".
        '<button id="_rrCropStraighten" class="rr-tap-wide" title="Fix a photo taken at an angle: drag four dots onto the corners of the box" style="' + stepBtn + ';min-width:0;padding:0.45rem 0.75rem;margin-left:0.35rem">Straighten</button>' +
      '</div>' +
    '</div>' +
    '<div style="flex:0 0 auto;padding:0.85rem 1rem;display:flex;gap:0.6rem;justify-content:flex-end">' +
      // v0.9.1737 (Brad: "remove that rotate button"): gone. v1736 put ↺ 90°
      // and ↻ 90° directly under the picture, which does the same job in both
      // directions and next to the fine steps, so this one was a second way to
      // do a thing that already has a better one. Two controls for one action
      // is how they drift apart.
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
  // ══ v0.9.1773 — MEASURE THE SCREEN YOU CAN SEE ═══════════════════════════
  // Brad, 2026-09-19: "the picture on the crop page is too big and covers the
  // rotate and zoom buttons. one time the crop box captured those buttons."
  //
  // Both halves are this. The overlay is position:fixed;inset:0, which sizes it
  // to the LAYOUT viewport — and on a phone that is taller than what you can
  // actually see, because the browser's own toolbar is drawn over the bottom of
  // it. _freezeStage then measures the picture area inside that too-tall box and
  // PINS it at that height (correctly — the pinning is v0.9.1031's fix for the
  // flashing, and it stays). So the picture was frozen to a height that does not
  // fit on screen, the buttons below it were pushed under the browser chrome,
  // and a crop box dragged to the bottom of the picture area reached over them.
  //
  // visualViewport reports the part you can SEE. Size the overlay to that first
  // and the measurement below is honest. Set ONCE here, and again on a real
  // rotation via _onOrient — deliberately NOT on every viewport event, because
  // reacting to the toolbar sliding is the exact churn v0.9.1031 removed.
  function _fitOverlayToVisible() {
    if (!_phone) return;
    try {
      var vv = window.visualViewport;
      if (!vv || !vv.height) return;
      ov.style.top = Math.max(0, Math.round(vv.offsetTop || 0)) + 'px';
      ov.style.bottom = 'auto';
      ov.style.height = Math.round(vv.height) + 'px';
    } catch (e) { /* no visualViewport — inset:0 stands, exactly as before */ }
  }

  function _freezeStage() {
    if (!_phone) return;
    _fitOverlayToVisible();
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
    // v0.9.1774: reveal "Whole photo" BEFORE measuring, not after. See
    // _rrSavedBoxFits. The ready callback still sets both, harmlessly.
    try {
      // v0.9.1872: a photo's OWN box (opts.box) or its original on screen
      // (opts.original) means the batch box of v0.9.1049 does not apply.
      if (!opts.box && !opts.original && _rrSavedBoxFits(img)) {
        var _rbEarly = ov.querySelector('#_rrCropWhole');
        if (_rbEarly) _rbEarly.style.display = '';
        var _hEarly = ov.querySelector('#_rrCropHint');
        if (_hEarly) _hEarly.textContent = 'Starting from your last crop';
      }
    } catch (eRB) {}
    _freezeStage();
    _autoOrients = autoOriented;
    // v0.9.904 (Brad, item [3]): viewMode 0 (was 1) so a rotated photo isn't
    // clamped/zoomed to fill the frame — matches the box-scanner cropper, which
    // is what makes the fine-rotation slider behave.
    // v0.9.1876: the options are built by _cropperOpts, ONE set, because the
    // straighten step rebuilds Cropper on the redrawn picture with the same.
    try {
      cropper = new Cropper(img, _cropperOpts(function () {
          try { _seedRot(); } catch (eS) {}
          // v0.9.1872: this photo's own crop, drawn on its original. The
          // rotation goes through the screen's own controls so the degree
          // readout agrees with the picture; then the box, in that frame.
          // v0.9.1876: a straightened photo replays its dots first (_strReplay).
          if (opts.box) {
            try {
              if (opts.box.quad) { _strReplay(opts.box); return; }
              var _r = Number(opts.box.r) || 0;
              _quarters = ((Math.round(_r / 90) % 4) + 4) % 4;
              _fine = Math.round((_r - (Math.round(_r / 90) * 90)) * 2) / 2;
              if (_fine > 15 || _fine < -15) { _fine = 0; }
              _applyRot();
              _rrBoxApply(cropper, opts.box);
            } catch (eB2) {}
            return;
          }
          if (opts.original) return;   // the original, whole — no batch box on top of it
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
      }));
    } catch (e) {
      console.warn('[crop] init', e);
      img.style.visibility = '';   // show the plain photo rather than nothing
    }
    var w = ov.querySelector('#_rrCropWait');
    if (w) w.remove();
  }
  var _autoOrients = true;
  // The one Cropper option set (v0.9.1876: shared by the first build and the
  // straighten rebuilds). Comments for each choice stayed in _build's history:
  // zoomOnTouch false (v1774), responsive only off phones (v1031),
  // checkOrientation only for a browser that does not apply EXIF itself
  // (v1032), a 64px floor under the box (v1773), viewMode 0 (v904).
  function _cropperOpts(onReady) {
    return {
      viewMode: 0, autoCropArea: 1, background: false, movable: true, zoomable: true,
      zoomOnTouch: false,
      responsive: !_phone, checkOrientation: !_autoOrients,
      minCropBoxWidth: 64, minCropBoxHeight: 64,
      ready: onReady,
    };
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
  var _previewUrl = null;   // v0.9.1827: the screen-sized copy Cropper works on; revoked in done()
  _rrOrientProbe(function (autoOrients) {
    if (!document.body.contains(ov)) return;
    var go = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { _build(autoOrients); }); }); };
    // v0.9.1828: NEVER wait on decode() without a cap. THE HONEST STORY: this
    // was shipped for a "hang" seen in a HIDDEN Chrome tab — a background tab
    // fires no requestAnimationFrame and never settles decode(), so nothing
    // that needs a frame runs there; on a visible page the same 12 MP photo
    // built in 246 ms. The cap stays because it is right on its own terms:
    // Cropper draws the picture whether or not decode() ever answers, so a
    // decode that really stalls (a starved tab, a browser bug) costs at most a
    // blank first paint, never the whole screen.
    var decoded = function (fn) {
      var done = false, once = function () { if (done) return; done = true; fn(); };
      try { if (img.decode) { img.decode().then(once, once); } else { once(); return; } } catch (eD) { once(); return; }
      setTimeout(once, _RR_DECODE_WAIT_MS);
    };
    img.onload = function () {
      decoded(function () {
        // v0.9.1827: the first load is the photo itself. When it is bigger
        // than the crop can ever use, a screen-sized copy is loaded in its
        // place and Cropper is built on THAT — the second load lands here
        // again with _previewUrl set. An old browser that needs Cropper's own
        // EXIF handling (autoOrients false) builds on the original, as before.
        if (_previewUrl || !autoOrients) { go(); return; }
        _rrCropPreview(img, _RR_CROP_MAX, function (url) {
          if (!document.body.contains(ov)) { try { if (url) URL.revokeObjectURL(url); } catch (eR) {} return; }
          if (!url) { go(); return; }
          _previewUrl = url;
          img.src = url;
        });
      });
    };
    // A copy that will not load (it cannot happen — it is our own JPEG — but a
    // crop must never hang on its preview): fall back to the original.
    img.onerror = function () {
      if (!_previewUrl) return;
      try { URL.revokeObjectURL(_previewUrl); } catch (eR) {}
      _previewUrl = null;
      img.onerror = null;
      img.onload = function () { decoded(go); };
      img.src = src;
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
    // v0.9.1703: the screen is ours again — let the rebuilds we held back
    // happen now, once each. _rrCropOpen is cleared FIRST, above, or they
    // would simply defer themselves again.
    try { if (typeof rrFlushRepaints === 'function') rrFlushRepaints(); } catch (eR) {}
    if (_rotT) { clearTimeout(_rotT); _rotT = null; }
    try { window.removeEventListener('orientationchange', _onOrient); } catch (e) {}
    try { if (cropper) cropper.destroy(); } catch (e) {}
    try { if (_previewUrl) { URL.revokeObjectURL(_previewUrl); _previewUrl = null; } } catch (e) {}   // v0.9.1827
    try { if (_str && _str.warpUrl) { URL.revokeObjectURL(_str.warpUrl); _str.warpUrl = null; } } catch (e) {}   // v0.9.1876
    ov.remove();
    if (window.BackStack) BackStack.pop('_rr-cropper');
  }
  // v0.9.808 (TODO-012): device Back = Cancel (keep the full photo).
  // v0.9.1876: while the four dots are up, Back only puts them away (and
  // stays armed for the next press); the screen itself closes on the one after.
  function _onDeviceBack() {
    if (_str && _str.on) { _strExit(); if (window.BackStack) BackStack.push('_rr-cropper', _onDeviceBack); return; }
    done(); if (onCancel) try { onCancel(); } catch (e) {}
  }
  if (window.BackStack) BackStack.push('_rr-cropper', _onDeviceBack);
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
    // v0.9.1736: one decimal always, so 0.5 steps read as 0.5 / 1.0 / 1.5
    // instead of flicking between "1" and "1.5" and looking like a glitch.
    if (rotV) rotV.textContent = (Math.round(total * 10) / 10).toFixed(1) + '°';
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
      if (rotV) rotV.textContent = (Math.round(actual * 10) / 10).toFixed(1) + '°';
    } catch (e) {}
  }
  if (rotEl) rotEl.addEventListener('input', function () { _setFine(parseFloat(rotEl.value) || 0); });
  // v0.9.1736 (Brad): half a degree per press, not a whole one. A whole degree
  // is visibly past level on a car photographed straight on — he was having to
  // choose between one degree too little and one too much.
  var _minusBtn = ov.querySelector('#_rrCropRotMinus'), _plusBtn = ov.querySelector('#_rrCropRotPlus');
  if (_minusBtn) _minusBtn.onclick = function () { _setFine(_fine - 0.5); };
  if (_plusBtn) _plusBtn.onclick = function () { _setFine(_fine + 0.5); };
  // The quarter-turns, both directions, beside the fine steps. _quarters is
  // kept 0..3 so the existing total/seed arithmetic is untouched.
  function _turn(n) { _quarters = (((_quarters + n) % 4) + 4) % 4; _applyRot(); }
  var _qL = ov.querySelector('#_rrCropRotQtrL'), _qR = ov.querySelector('#_rrCropRotQtrR');
  if (_qL) _qL.onclick = function () { _turn(-1); };
  if (_qR) _qR.onclick = function () { _turn(1); };
  // v0.9.1736: zoom by button as well as by pinch/scroll. Cropper's own zoom
  // is relative, so each press is the same nudge wherever you already are.
  var _zOut = ov.querySelector('#_rrCropZoomOut'), _zIn = ov.querySelector('#_rrCropZoomIn');
  if (_zOut) _zOut.onclick = function () { try { if (cropper) cropper.zoom(-0.15); } catch (eZ) {} };
  if (_zIn) _zIn.onclick = function () { try { if (cropper) cropper.zoom(0.15); } catch (eZ) {} };
  // v0.9.1737: the footer Rotate button is gone; _turn is reached from the two
  // 90° buttons in the row above.
  var _wholeBtn = ov.querySelector('#_rrCropWhole');
  var _restoreBtn = ov.querySelector('#_rrCropRestore');
  // ══ v0.9.1876 — STRAIGHTEN: the dots, the warp, undo, replay ══════════════
  // (see the helpers above _openCropper for the map itself)
  var _str = { on: false, layer: null, src: null, rot: 0, pts: null, k: 1, ox: 0, oy: 0,
               applied: null, prevSrc: null, prevRot: 0, warpUrl: null, lastPts: null, lastW: 0, lastH: 0,
               busy: false, hintBefore: null, onApplied: null };
  var _strBtn = ov.querySelector('#_rrCropStraighten');
  var _cancelBtn = ov.querySelector('#_rrCropCancel'), _applyBtn = ov.querySelector('#_rrCropApply');
  var _rowLevel = ov.querySelector('#_rrCropRowLevel');
  function _totalRot() { var t = (_quarters * 90) + _fine; while (t > 180) t -= 360; while (t <= -180) t += 360; return t; }
  function _setRotParts(deg) {
    _quarters = ((Math.round(deg / 90) % 4) + 4) % 4;
    _fine = Math.round((deg - (Math.round(deg / 90) * 90)) * 2) / 2;
    if (_fine > 15 || _fine < -15) _fine = 0;
  }
  var _cropperOptsBase = null;   // set by _build: the one option set, reused when the picture is swapped
  // What the controls say and do in each state: placing dots / straightened / plain.
  function _strSetControls(dots) {
    var dim = function (el) { if (!el) return; el.style.opacity = dots ? '0.35' : ''; el.style.pointerEvents = dots ? 'none' : ''; };
    [_rowLevel, _zOut, _zIn, _wholeBtn, _restoreBtn].forEach(dim);
    if (_cancelBtn) _cancelBtn.textContent = dots ? 'Back' : (opts.cancelLabel || 'Cancel');
    if (_applyBtn) _applyBtn.textContent = dots ? 'Straighten' : (opts.applyLabel || 'Apply crop');
    if (_strBtn) { _strBtn.textContent = dots ? 'Placing dots…' : (_str.applied ? 'Undo straighten' : 'Straighten'); _strBtn.style.opacity = dots ? '0.6' : ''; }
    var h = ov.querySelector('#_rrCropHint');
    if (!h) return;
    if (dots) h.textContent = 'Drag the four dots onto the corners of the box';
    else if (_str.applied) h.textContent = (opts.original ? 'Showing your straightened photo' : 'Straightened') + ' · the box is your crop';   // one line on a phone; the button says the rest
    else if (_str.hintBefore != null) h.textContent = _str.hintBefore;
  }
  // Enter: the picture as it stands (turn baked in) under four dots.
  function _strEnter() {
    if (!cropper || _str.on || _str.busy || _str.applied) return;
    var deg = _totalRot();
    var srcC = _rrRotatedCanvas(img, deg);
    if (!srcC) return;
    _str.src = srcC; _str.rot = deg;
    // Starting corners: the dots as last placed on this very picture, else the
    // crop box (a box that is the whole picture gives an inset square instead —
    // dots on the picture's own corners have nowhere to be dragged from).
    var pts = null;
    if (_str.lastPts && _str.lastW === srcC.width && _str.lastH === srcC.height) pts = _str.lastPts.map(function (p) { return p.slice(); });
    if (!pts) {
      try {
        var d = cropper.getData();
        if (d && d.width > 0 && d.height > 0 && (d.width < srcC.width * 0.95 || d.height < srcC.height * 0.95)) pts = [[d.x, d.y], [d.x + d.width, d.y], [d.x + d.width, d.y + d.height], [d.x, d.y + d.height]];
      } catch (e) {}
    }
    if (!pts) { var W0 = srcC.width, H0 = srcC.height; pts = [[W0 * 0.1, H0 * 0.1], [W0 * 0.9, H0 * 0.1], [W0 * 0.9, H0 * 0.9], [W0 * 0.1, H0 * 0.9]]; }
    _str.pts = pts.map(function (p) { return [Math.max(0, Math.min(srcC.width, p[0])), Math.max(0, Math.min(srcC.height, p[1]))]; });
    _str.hintBefore = (ov.querySelector('#_rrCropHint') || {}).textContent;
    var cc = ov.querySelector('.cropper-container'); if (cc) cc.style.display = 'none';
    var layer = document.createElement('div'); layer.id = '_rrStrLayer';
    layer.style.cssText = 'position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none';
    // The picture sits 20px in from the stage's edges so a dot on the
    // picture's very corner is still whole and grabbable (the stage clips).
    var sw = stage.clientWidth, sh = stage.clientHeight, pad = 20;
    var k = Math.min(Math.max(1, sw - pad * 2) / srcC.width, Math.max(1, sh - pad * 2) / srcC.height);
    var dw = Math.max(1, Math.round(srcC.width * k)), dh = Math.max(1, Math.round(srcC.height * k));
    var ox = Math.round((sw - dw) / 2), oy = Math.round((sh - dh) / 2);
    _str.k = k; _str.ox = ox; _str.oy = oy;
    var pic = document.createElement('canvas'); pic.id = '_rrStrPic'; pic.width = dw; pic.height = dh;
    pic.style.cssText = 'position:absolute;left:' + ox + 'px;top:' + oy + 'px;width:' + dw + 'px;height:' + dh + 'px';
    try { pic.getContext('2d').drawImage(srcC, 0, 0, dw, dh); } catch (eP) {}
    layer.appendChild(pic);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = '_rrStrShape';
    svg.setAttribute('width', String(sw)); svg.setAttribute('height', String(sh));
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); poly.id = '_rrStrPoly';
    poly.setAttribute('class', 'rr-str-poly');
    svg.appendChild(poly); layer.appendChild(svg);
    for (var i = 0; i < 4; i++) {
      // a 34px target around an 18px dot — the v1773 grip lesson, by the numbers
      var dot = document.createElement('div'); dot.id = '_rrStrDot' + i; dot.setAttribute('data-dot', String(i)); dot.className = 'rr-str-dot';
      dot.innerHTML = '<span></span>';
      dot.addEventListener('pointerdown', _strDown);
      layer.appendChild(dot);
    }
    stage.appendChild(layer);
    _str.layer = layer; _str.on = true;
    _strDraw();
    _strSetControls(true);
  }
  function _strDraw() {
    if (!_str.on || !_str.layer) return;
    var k = _str.k, ox = _str.ox, oy = _str.oy;
    var scr = _str.pts.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
    var poly = _str.layer.querySelector('#_rrStrPoly');
    if (poly) poly.setAttribute('points', scr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    for (var i = 0; i < 4; i++) { var dot = _str.layer.querySelector('#_rrStrDot' + i); if (dot) { dot.style.left = scr[i][0] + 'px'; dot.style.top = scr[i][1] + 'px'; } }
  }
  var _strDrag = null;
  function _strDown(e) {
    if (!_str.on) return;
    var i = parseInt(e.currentTarget.getAttribute('data-dot'), 10);
    _strDrag = { i: i };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (eC) {}
    e.currentTarget.addEventListener('pointermove', _strMove);
    e.currentTarget.addEventListener('pointerup', _strUp);
    e.currentTarget.addEventListener('pointercancel', _strUp);
    e.preventDefault();
  }
  function _strMove(e) {
    if (!_strDrag || !_str.on) return;
    var r = _str.layer.getBoundingClientRect();
    var x = (e.clientX - r.left - _str.ox) / _str.k, y = (e.clientY - r.top - _str.oy) / _str.k;
    x = Math.max(0, Math.min(_str.src.width, x)); y = Math.max(0, Math.min(_str.src.height, y));
    _str.pts[_strDrag.i] = [x, y];
    _strDraw();
  }
  function _strUp(e) {
    var t = e.currentTarget;
    t.removeEventListener('pointermove', _strMove); t.removeEventListener('pointerup', _strUp); t.removeEventListener('pointercancel', _strUp);
    _strDrag = null;
  }
  // Back: the dots go away, nothing changed; they come back where they were.
  function _strExit() {
    if (!_str.on) return;
    _str.lastPts = _str.pts.map(function (p) { return p.slice(); }); _str.lastW = _str.src.width; _str.lastH = _str.src.height;
    if (_str.layer) { try { _str.layer.remove(); } catch (e) {} _str.layer = null; }
    var cc = ov.querySelector('.cropper-container'); if (cc) cc.style.display = '';
    _str.on = false;
    _strSetControls(false);
  }
  // Swap the picture under Cropper (destroy, load, rebuild) and set the turn.
  function _strSwap(url, rotAfter, then) {
    try { if (cropper) { cropper.destroy(); } } catch (e) {}
    cropper = null;
    img.style.visibility = 'hidden';
    img.onload = function () {
      img.onload = null;
      try {
        cropper = new Cropper(img, _cropperOpts(function () {
          _setRotParts(rotAfter); _applyRot();
          if (then) then();
        }));
      } catch (e) { console.warn('[crop] rebuild', e); img.style.visibility = ''; if (then) then(); }
    };
    img.src = url;
  }
  // Straighten: warp the quad, put the result under Cropper, remember the dots.
  function _strApply() {
    if (!_str.on || _str.busy) return;
    var pts = _str.pts.map(function (p) { return p.slice(); });
    var size = _rrQuadSize(pts, _RR_CROP_MAX, _str.src.width / 2, _str.src.height / 2);
    if (!_rrHomography([[0, 0], [size.w, 0], [size.w, size.h], [0, size.h]], pts)) {
      if (typeof showToast === 'function') showToast('Move the dots so they make a four-sided shape', 3000, true);
      return;
    }
    _str.busy = true;
    var wait = document.createElement('div'); wait.id = '_rrStrWait';
    wait.style.cssText = waitCss + ';background:var(--rr-dim);z-index:3';
    wait.textContent = 'Straightening…';
    stage.appendChild(wait);
    var srcC = _str.src, rot = _str.rot;
    var finish = function () { _str.busy = false; try { wait.remove(); } catch (e) {} };
    setTimeout(function () {
      _rrWarpQuad(srcC, pts, size.w, size.h, function (out) {
        if (!out || !document.body.contains(ov)) { finish(); return; }
        out.toBlob(function (blob) {
          if (!blob || !document.body.contains(ov)) { finish(); return; }
          var url = URL.createObjectURL(blob);
          var prevSrc = img.src;
          _strExit();
          _strSwap(url, 0, function () {
            if (!_str.applied) { _str.prevSrc = prevSrc; _str.prevRot = rot; }
            if (_str.warpUrl) { try { URL.revokeObjectURL(_str.warpUrl); } catch (e) {} }
            _str.warpUrl = url;
            _str.applied = { r: rot, W: srcC.width, H: srcC.height, pts: pts };
            finish();
            _strSetControls(false);
            if (typeof _str.onApplied === 'function') { var f = _str.onApplied; _str.onApplied = null; try { f(); } catch (e) {} }
          });
        }, 'image/jpeg', 0.92);
      });
    }, 30);
  }
  // Undo straighten: the picture from before, its turn as it was; the dots are kept.
  function _strUndo() {
    if (!_str.applied || _str.busy || _str.on) return;
    _str.busy = true;
    var back = _str.prevSrc, rot = _str.prevRot;
    _strSwap(back, rot, function () {
      _str.applied = null; _str.busy = false;
      if (_str.warpUrl) { try { URL.revokeObjectURL(_str.warpUrl); } catch (e) {} _str.warpUrl = null; }
      _strSetControls(false);
    });
  }
  // ✂ on a straightened photo: the dots back where they were (one scale — the
  // picture may be the original or its copy), the warp applied, then the box.
  function _strReplay(box) {
    var q = box.quad;
    _setRotParts(Number(q.r) || 0); _applyRot();
    _strEnter();
    if (!_str.on) { try { _rrBoxApply(cropper, box); } catch (e) {} return; }
    var k = _str.src.width / q.W;
    _str.pts = q.pts.map(function (p) { return [Math.max(0, Math.min(_str.src.width, p[0] * k)), Math.max(0, Math.min(_str.src.height, p[1] * k))]; });
    _strDraw();
    // after the warp: any levelling done on the straightened picture (the box's own turn), then the box
    _str.onApplied = function () { try { _setRotParts(Number(box.r) || 0); _applyRot(); _rrBoxApply(cropper, box); } catch (e) {} };
    _strApply();
  }
  if (_strBtn) _strBtn.onclick = function () { if (_str.on || _str.busy) return; if (_str.applied) _strUndo(); else _strEnter(); };
  if (_wholeBtn) _wholeBtn.onclick = function () {
    try {
      localStorage.removeItem(_RR_BOX_KEY);
      if (cropper) { cropper.reset(); _quarters = 0; _fine = 0; _applyRot(); }   // v0.9.1872: the stored box came with a rotation; "whole" means level too
      var _h = ov.querySelector('#_rrCropHint');
      if (_h) _h.textContent = _str.applied ? 'Straightened \u00b7 the whole straightened photo' : (opts.original ? 'Showing the original photo \u00b7 Apply keeps it whole' : 'Drag the box \u00b7 zoom with the buttons');
      _wholeBtn.style.display = 'none';
    } catch (e) {}
  };
  // v0.9.1872: one tap puts the original back. The caller owns the bytes and
  // the write; this screen only closes and hands over.
  if (_restoreBtn) _restoreBtn.onclick = function () {
    done();
    try { opts.restore(); } catch (e) { console.warn('[crop] restore', e); }
  };
  ov.querySelector('#_rrCropCancel').onclick = function () { if (_str.on) { _strExit(); return; } done(); if (onCancel) try { onCancel(); } catch (e) {} };   // v0.9.1876: in dot mode this is Back
  ov.querySelector('#_rrCropApply').onclick = function () {
    if (_str.on) { _strApply(); return; }        // v0.9.1876: in dot mode this is Straighten
    if (_str.busy) return;
    if (!cropper) { done(); if (onCancel) try { onCancel(); } catch (e) {} return; }
    try { _rrSaveBox(cropper); } catch (eS) {}   // v0.9.1049: offer this box on the next photo
    var _box = _rrCropBoxOf(cropper);            // v0.9.1872: the box this crop is taken from, for the photo's record
    if (_box && _str.applied) { _box.quad = _str.applied; _box.whole = false; }   // v0.9.1876: the dots ride along; a straightened result is never "the original, whole"
    var canvas = cropper.getCroppedCanvas({ maxWidth: _RR_CROP_MAX, maxHeight: _RR_CROP_MAX, imageSmoothingQuality: 'high' });   // v0.9.1827: the ONE cap, shared with the preview
    if (!canvas) { done(); if (onCancel) try { onCancel(); } catch (e) {} return; }
    canvas.toBlob(function (blob) { done(); if (blob) onResult(blob, _box); }, 'image/jpeg', 0.9);
  };
}

// v0.9.825 (TODO-008): shared crop-first hop. Opens the cropper on a freshly
// picked file; onDone receives the CROPPED file (Apply) or the ORIGINAL file
// (Cancel, or cropper unavailable). Every photo-pick spot funnels through
// this one helper so the flow stays identical app-wide.
function _cropFirst(file, onDone) {
  if (!file || typeof _openCropper !== 'function') { onDone(file); return; }
  var url = URL.createObjectURL(file);
  _openCropper(url, function (blob, box) {
    try { URL.revokeObjectURL(url); } catch (e) {}
    try {
      var cropped = new File([blob], String(file.name || 'photo').replace(/\.[^.]+$/, '') + '_crop.jpg', { type: 'image/jpeg' });
      // v0.9.1872: the cropped File carries its ORIGINAL and the box it was cut
      // from. drive.js's creators upload the original as the file and put the
      // crop on top through the ONE writer, so the original is never lost.
      // JPEG originals only: the crop is a JPEG, and a file whose first version
      // is one kind of picture and second another is a file nothing can trust.
      if (_rrCropKeepsOriginal(file)) { cropped._rrOriginal = file; cropped._rrCropBox = box || null; }
      onDone(cropped);
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

// ── v0.9.1872: a photo's versions in Drive ─────────────────────────────────
// Three calls, all on the file's own revisions (Drive API v3, drive.file scope
// covers files the app made). Oldest first: Drive lists them that way and the
// sort makes it a promise, not a habit.
async function _cropRevisions(fileId) {
  var out = await driveRequest('GET', '/files/' + fileId + '/revisions?pageSize=200&fields=revisions(id,modifiedTime,keepForever,size,mimeType)');
  var revs = (out && out.revisions) || [];
  revs.sort(function (a, b) { return String(a.modifiedTime || '').localeCompare(String(b.modifiedTime || '')); });
  return revs;
}
// Mark the FIRST version — the original — keepForever. Returns its revision
// id, or null when that could not be done (no list, a refused update). A
// throw is a null too: the writer below treats null as "do not overwrite".
async function _cropProtectOriginal(fileId) {
  try {
    var revs = await _cropRevisions(fileId);
    // A file made a moment ago (a crop at capture) may list no versions for
    // an instant. One short second look, then the honest answer.
    if (!revs.length) { await new Promise(function (res) { setTimeout(res, 800); }); revs = await _cropRevisions(fileId); }
    if (!revs.length || !revs[0].id) return null;
    if (!revs[0].keepForever) {
      var upd = await driveRequest('PATCH', '/files/' + fileId + '/revisions/' + revs[0].id + '?fields=id,keepForever', { keepForever: true });
      if (!upd || upd.keepForever !== true) return null;   // Drive answers with the revision as saved
    }
    return revs[0].id;
  } catch (e) { console.warn('[crop] could not protect the original of', fileId, e && e.message); return null; }
}
// The original's bytes, when the photo has been cropped at least once (two or
// more versions). { state: 'single' } means the current bytes ARE the original;
// 'got' carries the blob (and the stored box, when there is one); 'failed'
// means Drive could not be asked — the caller crops what it has, as before.
async function _cropOriginalFetch(fileId) {
  try {
    var revs = await _cropRevisions(fileId);
    if (revs.length < 2) return { state: 'single' };
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/revisions/' + revs[0].id + '?alt=media', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var blob = await r.blob();
    if (!blob || !blob.size) throw new Error('empty');
    var box = null;
    try { box = await _cropBoxRead(fileId); } catch (eB) {}
    return { state: 'got', blob: blob, revId: revs[0].id, box: box };
  } catch (e) { console.warn('[crop] original not fetched for', fileId, e && e.message); return { state: 'failed' }; }
}
// The crop box, kept on the photo itself (appProperties) so every device sees
// the same one. null clears it. Never fatal — a missing box only means the next
// re-crop starts from the whole original.
async function _cropBoxSave(fileId, box) {
  var props = {}; props[_RR_BOX_PROP] = box ? _rrBoxStr(box) : null;
  props[_RR_QUAD_PROP] = (box && box.quad) ? _rrQuadStr(box.quad) : null;   // v0.9.1876: the straighten dots, or cleared
  await driveRequest('PATCH', '/files/' + fileId + '?fields=id', { appProperties: props });
}
async function _cropBoxRead(fileId) {
  var meta = await driveRequest('GET', '/files/' + fileId + '?fields=appProperties');
  var ap = (meta && meta.appProperties) || {};
  var box = _rrBoxParse(ap[_RR_BOX_PROP]);
  var quad = _rrQuadParse(ap[_RR_QUAD_PROP]);   // v0.9.1876
  if (box && quad) box.quad = quad;
  return box;
}
// This session's memory of originals already in hand — a photo taken a minute
// ago, or one whose original was just fetched — so the next ✂ on it needs no
// download. A few at a time: these are whole phone photos.
var _rrOrigMem = {}, _rrOrigMemOrder = [], _RR_ORIG_MEM_MAX = 6;
function _cropRemember(fileId, blob, box) {
  if (!fileId || !blob) return;
  if (!_rrOrigMem[fileId]) { _rrOrigMemOrder.push(fileId); }
  _rrOrigMem[fileId] = { blob: blob, box: box || null };
  while (_rrOrigMemOrder.length > _RR_ORIG_MEM_MAX) { delete _rrOrigMem[_rrOrigMemOrder.shift()]; }
}

// The ONE writer. Everything below resolves an id and calls this.
// v0.9.1872: the original is protected FIRST, and a crop that cannot protect it
// is refused — losing a crop is an annoyance, losing the original is not
// recoverable (the same sentence v0.9.1238 wrote about the wrong photo). `box`
// is the crop these bytes were cut from (stored on the photo), or null/absent
// to clear it — a restore, or a crop whose frame is not the original's.
async function _cropReplaceDriveFile(fileId, blob, box) {
  try {
    if (!fileId || typeof accessToken === 'undefined' || !accessToken) return false;
    var origRev = await _cropProtectOriginal(fileId);
    if (!origRev) { console.warn('[crop] original not protected — refusing to overwrite', fileId); return false; }
    var r = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': (blob && blob.type) || 'image/jpeg' }, body: blob
    });
    // v0.9.1631: the bytes changed — heal every cache in one motion, so no
    // renderer anywhere can keep showing the pre-crop picture.
    if (r.ok) {
      try { if (window.rrPhotoBytesChanged) window.rrPhotoBytesChanged(fileId, blob); } catch (eB) {}
      try { await _cropBoxSave(fileId, (box && typeof box === 'object') ? box : null); } catch (eX) { console.warn('[crop] box not saved', eX && eX.message); }
    }
    return r.ok;
  } catch (e) { console.warn('[crop] replace by id', e); return false; }
}

// Put the original back — its exact bytes, not a re-encoded copy. The writer
// protects the original revision first (it already is) and the original bytes
// become the current version; the old protected copy is then released, so Drive
// tidies the duplicate away in 30 days while the current version — the same
// bytes — stays for good. The box is cleared: nothing is cropped any more.
async function _cropRestoreOriginal(fileId, originalBlob) {
  var ok = await _cropReplaceDriveFile(fileId, originalBlob, null);
  if (!ok) return false;
  try {
    var revs = await _cropRevisions(fileId);
    if (revs.length > 1 && revs[0].keepForever) await driveRequest('PATCH', '/files/' + fileId + '/revisions/' + revs[0].id, { keepForever: false });
  } catch (e) { /* a duplicate kept a little longer costs storage, not a photo */ }
  _cropRemember(fileId, originalBlob, null);
  return true;
}

// A photo cropped at capture, now in Drive as its original: the crop goes on top.
// drive.js's creators call this right after the file exists. A failure leaves
// the photo in Drive uncropped — which is also the truth the toast tells.
async function _cropApplyCaptured(fileId, croppedFile) {
  var box = (croppedFile && croppedFile._rrCropBox) || null;
  var ok = await _cropReplaceDriveFile(fileId, croppedFile, box);
  if (ok) _cropRemember(fileId, croppedFile._rrOriginal, box);
  else if (typeof showToast === 'function') showToast('Could not save the crop — the photo is saved uncropped. You can crop it again any time.', 4500, true);
  return ok;
}
// Which picked files carry their original: JPEGs. (See _cropFirst.)
function _rrCropKeepsOriginal(file) {
  return !!(file && /^image\/jpe?g$/i.test(String(file.type || '')));
}

// ══ Open the crop screen on a photo that lives in Drive ═════════════════════
// Every ✂ on an uploaded photo comes through here. If the photo has an earlier
// version, the screen shows THAT — the original — with the current crop drawn
// on it, and offers Restore original; Apply replaces the current crop. A photo
// never cropped shows as it is (its current bytes ARE the original). When Drive
// cannot be asked, the screen shows the current bytes, exactly as before, and
// the box is cleared on Apply because a crop of a crop is not in the original's
// frame.
//   o.src       the current picture: a URL, or a function returning a Promise
//               of one (fetched only when needed — the inbox has its own
//               careful downloader); without it the current bytes are fetched
//   o.mem       { original: Blob|File, box, single } — an original already in
//               hand (the wizard still holds the File it uploaded)
//   o.onDone(ok, blob, kind)   after the write (ok false = refused/failed); the
//               blob is what Drive now holds; kind is 'crop' or 'restore'
//   o.onCancel  the screen was closed without writing
//   o.opts      wording for _openCropper
async function _cropOpenDriveFile(fileId, o) {
  o = o || {};
  if (!fileId) { if (o.onCancel) try { o.onCancel(); } catch (e0) {} return; }
  var orig = null, state = 'single';
  if (_rrOrigMem[fileId]) { orig = _rrOrigMem[fileId]; state = 'got'; }
  else if (o.mem && o.mem.original) { orig = { blob: o.mem.original, box: o.mem.box || null }; state = o.mem.single ? 'single' : 'got'; }
  else {
    var slow = setTimeout(function () { try { if (typeof showToast === 'function') showToast('Loading the original photo…', 2500); } catch (e) {} }, 700);
    var f = await _cropOriginalFetch(fileId);
    clearTimeout(slow);
    state = f.state;
    if (f.state === 'got') orig = { blob: f.blob, box: f.box || null };
  }
  var showingOriginal = state === 'got' && !!orig;
  var madeUrl = null, src = null;
  try {
    if (orig) { madeUrl = URL.createObjectURL(orig.blob); src = madeUrl; }
    else if (typeof o.src === 'function') { src = await o.src(); }
    else if (o.src) { src = o.src; }
    else {
      var rh = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + accessToken } });
      if (!rh.ok) throw new Error('HTTP ' + rh.status);
      madeUrl = URL.createObjectURL(await rh.blob()); src = madeUrl;
    }
  } catch (e) {
    console.warn('[crop] could not open', fileId, e && e.message);
    if (typeof showToast === 'function' && !(e && e.rrSaid)) showToast('Could not open the photo — try again', 3500, true);   // rrSaid: the caller's src() already explained
    if (o.onCancel) try { o.onCancel(); } catch (e1) {}
    return;
  }
  if (!src) { if (o.onCancel) try { o.onCancel(); } catch (e2) {} return; }
  var cleanup = function () { if (madeUrl) { try { URL.revokeObjectURL(madeUrl); } catch (e) {} madeUrl = null; } };
  var restore = async function () {
    cleanup();
    var okR = await _cropRestoreOriginal(fileId, orig.blob);
    if (o.onDone) try { o.onDone(okR, orig.blob, 'restore'); } catch (e) {}
  };
  _openCropper(src, async function (blob, box) {
    cleanup();
    if (showingOriginal && box && box.whole) { await restore(); return; }   // whole + level = the original itself, exact bytes
    var keepBox = (showingOriginal || state === 'single') ? box : null;    // a crop of a crop is not in the original's frame
    var ok = await _cropReplaceDriveFile(fileId, blob, keepBox);
    if (ok && (orig || state === 'single')) _cropRemember(fileId, orig ? orig.blob : null, keepBox);
    if (o.onDone) try { o.onDone(ok, blob, 'crop'); } catch (e) {}
  }, function () {
    cleanup();
    if (o.onCancel) try { o.onCancel(); } catch (e) {}
  }, Object.assign({}, o.opts || {}, {
    original: showingOriginal,
    box: showingOriginal ? (orig.box || null) : null,
    restore: showingOriginal ? restore : null,
  }));
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
// The name → id half, for photos uploaded before ids were recorded: sure, or
// nothing (v0.9.1238). Returns the file id or ''.
async function _cropResolveId(folderLink, fileName) {
  try {
    if (!folderLink || typeof driveGetFolderPhotos !== 'function' || typeof accessToken === 'undefined' || !accessToken) return '';
    var photos = await driveGetFolderPhotos(folderLink);
    var hit = _cropPickByName(photos, fileName);
    if (!hit) { console.warn('[crop] no unambiguous match for', fileName, '- refusing to overwrite'); return ''; }
    return hit.id || '';
  } catch (e) { console.warn('[crop] resolve', e); return ''; }
}

// Entry point from the ✂ button on a wizard photo thumbnail.
// v0.9.1872: the id is resolved FIRST (ids map, else the one name builder and an
// unambiguous match — v0.9.1238's two rules), then the Drive-aware screen opens:
// on the original with the current crop drawn when the photo was cropped
// already, on the photo itself when not. The wizard still holds the very File
// it uploaded, so no download is needed for a photo from this session.
function _photoCropStart(file, stepId, viewKey, itemNum, srcUrl) {
  (async function () {
    try {
      if (typeof _awaitPhotoUploads === 'function') await _awaitPhotoUploads(10000); // ensure the original landed
      var ext = (String(file && file.name || '').split('.').pop() || 'jpg').toLowerCase();
      var wd = (typeof wizard !== 'undefined' && wizard.data) || {};
      // v0.9.1238: the id of the file this thumbnail actually uploaded,
      // recorded by wizard-photos.js at upload time. This is the whole fix —
      // everything else here is the fallback for a photo that predates it.
      var fileId = (wd._photoFileIds || {})[stepId + '|' + viewKey] || '';
      var folderLink = (wd[stepId] && wd[stepId][viewKey]) || '';
      if (!fileId && folderLink) {
        // No id: name-match, and only if it is unambiguous. The name is built
        // by the ONE builder that names uploads, not guessed at.
        var fileName = ((typeof window !== 'undefined' && typeof window._photoFileName === 'function')
          ? window._photoFileName(itemNum, viewKey, wd._invIdForPhotos, wd._fileLabelForPhotos)
          : (itemNum + ' ' + viewKey)) + '.' + ext;
        fileId = await _cropResolveId(folderLink, fileName);
      }
      if (!fileId) {
        if (typeof showToast === 'function') showToast('Could not find this photo in Drive yet — try the crop again in a moment', 4000, true);
        return;
      }
      // The File in hand: cropped at capture (it carries its original and box),
      // or the photo exactly as uploaded (then it IS the original).
      var mem = (file && file._rrOriginal) ? { original: file._rrOriginal, box: file._rrCropBox || null }
              : (file ? { original: file, box: null, single: true } : null);
      await _cropOpenDriveFile(fileId, {
        src: srcUrl, mem: mem,
        onDone: function (ok, blob) {
          var zone = document.querySelector('.photo-drop-zone[data-view="' + viewKey + '"][data-sid="' + stepId + '"]');
          if (zone && ok) { var im = zone.querySelector('img'); if (im && blob) im.src = URL.createObjectURL(blob); }
          // v0.9.1238: "will save once the upload finishes" was never true — there
          // was no retry. Say what actually happened.
          if (typeof showToast === 'function') {
            showToast(ok ? 'Photo updated'
                         : 'Could not save the crop — the photo in Drive is unchanged. Try again.', 4500, !ok);
          }
        },
      });
    } catch (e) { console.warn('[crop] apply', e); if (typeof showToast === 'function') showToast(rrSaveError(e, 'the crop'), 5000, true); }
  })();
}
if (typeof window !== 'undefined') {
  window._photoCropStart = _photoCropStart;
  window._openCropper = _openCropper;
  window._cropReplaceDriveFile = _cropReplaceDriveFile;
  window._cropPickByName = _cropPickByName;
  // v0.9.1872
  window._cropOpenDriveFile = _cropOpenDriveFile;
  window._cropRestoreOriginal = _cropRestoreOriginal;
  window._cropApplyCaptured = _cropApplyCaptured;
  window._cropProtectOriginal = _cropProtectOriginal;
  window._cropOriginalFetch = _cropOriginalFetch;
  window._cropResolveId = _cropResolveId;
  window._cropRemember = _cropRemember;
  window._rrCropKeepsOriginal = _rrCropKeepsOriginal;
}
