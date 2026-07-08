// ============================================================
//  ai-id.js — Tier 3: AI photo identification
//  The Rail Roster
//
//  Sends a DOWNSCALED photo of a box/label to the vault Apps
//  Script relay (backend v1.3), which holds the Gemini API key
//  in Script Properties — the key never ships to the client.
//  The relay answers with labeled lines ("Manufacturer SKU or
//  catalog number: …") in the exact format wizard-photos.js's
//  extractIdentifyMetadata() already parses — zero new parsing.
//
//  Called from:
//   - barcode.js  _bcAiRescue()          (scanner cascade tier 3)
//   - wizard-photos.js _identifySearchLens()  (AI-first, Lens fallback)
//
//  Depends on: vault.js (VAULT.ENDPOINT, vaultGetToken, vaultPost)
//  Load order: after vault.js. All use is at event time, so any
//  position in index.html works.
// ============================================================

const AI_ID = {
  // One-time "photo leaves your device" consent (approved design 2026-07-02)
  KEY_CONSENT: 'lv_ai_consent',
  // Longest photo edge sent to the relay — plenty for label text.
  MAX_DIM: 1024,
  JPEG_QUALITY: 0.85,
};

// ── One-time consent notice ─────────────────────────────────
// Everything before this feature runs on-device; AI photo ID sends
// the photo off-device. Ask once, remember forever ('yes').
// Resolves true (ok to send) / false (declined this time — ask again
// next time, same as the vault opt-in "Not now" behavior).
function aiConsentEnsure() {
  // v0.9.777 (Brad): the off-device photo-reading disclosure moved to the
  // onboarding privacy screen (onboarding-config.js COMMUNITY_OPTIN) — the
  // mid-scan pop-up read like an error to collectors, and "AI" wording is
  // gone from the whole app by design. This shim keeps every caller working.
  try { localStorage.setItem(AI_ID.KEY_CONSENT, 'yes'); } catch (e) {}
  return Promise.resolve(true);
}

// ── Image prep: anything → downscaled JPEG base64 ───────────
// Accepts a <canvas>, a <video> (grabs the current frame), or a
// File/Blob (the identify-by-photo modal). Returns { b64, mime }
// with the data: prefix stripped, or null on failure.
async function _aiToCanvas(src) {
  if (!src) return null;
  if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) return src;
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) {
    var vw = src.videoWidth | 0, vh = src.videoHeight | 0;
    if (!vw || !vh) return null;
    var vc = document.createElement('canvas');
    vc.width = vw; vc.height = vh;
    vc.getContext('2d').drawImage(src, 0, 0, vw, vh);
    return vc;
  }
  // File / Blob
  try {
    if (typeof createImageBitmap === 'function') {
      var bmp = await createImageBitmap(src);
      var bc = document.createElement('canvas');
      bc.width = bmp.width; bc.height = bmp.height;
      bc.getContext('2d').drawImage(bmp, 0, 0);
      try { bmp.close && bmp.close(); } catch (e) {}
      return bc;
    }
  } catch (e) { /* fall through to Image fallback */ }
  // Older Safari fallback
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(src);
    var img = new Image();
    img.onload = function () {
      var ic = document.createElement('canvas');
      ic.width = img.naturalWidth; ic.height = img.naturalHeight;
      ic.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(ic);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function aiPrepImage(src) {
  try {
    var canvas = await _aiToCanvas(src);
    if (!canvas || !canvas.width || !canvas.height) return null;
    var w = canvas.width, h = canvas.height;
    var scale = Math.min(1, AI_ID.MAX_DIM / Math.max(w, h));
    var out = canvas;
    if (scale < 1) {
      out = document.createElement('canvas');
      out.width = Math.round(w * scale);
      out.height = Math.round(h * scale);
      var ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
    }
    var dataUrl = out.toDataURL('image/jpeg', AI_ID.JPEG_QUALITY);
    var comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    return { b64: dataUrl.substring(comma + 1), mime: 'image/jpeg' };
  } catch (e) {
    console.warn('[AI-ID] image prep failed:', e && e.message);
    return null;
  }
}

// ── Main entry ──────────────────────────────────────────────
// aiIdentifyImage(source, hints)
//   source: canvas | video | File/Blob
//   hints:  { scale, type, mfrs: [] }  — woven into the AI prompt
// Resolves:
//   { ok:true,  text, remaining, cached }
//   { ok:false, reason: 'noconsent'|'quota'|'offline'|'error' }
async function aiIdentifyImage(source, hints) {
  try {
    if (typeof vaultGetToken !== 'function' || typeof vaultPost !== 'function') {
      return { ok: false, reason: 'error' };
    }
    var consent = await aiConsentEnsure();
    if (!consent) return { ok: false, reason: 'noconsent' };
    var img = await aiPrepImage(source);
    if (!img) return { ok: false, reason: 'error' };
    // v0.9.671: Gemini's free tier sheds load under traffic (relay answers
    // 503 "AI busy") — retry twice with backoff before giving up, and report
    // a distinct 'busy' reason so the UI can say what's actually happening.
    var res = null;
    for (var _try = 0; _try < 3; _try++) {
      if (_try) await new Promise(function (r) { setTimeout(r, _try * 2500); });
      res = await vaultPost({
        action: 'ai_identify',
        token: vaultGetToken(),
        image: img.b64,
        mime: img.mime,
        hints: hints || {},
      });
      if (res && res.status === 503) continue;   // overloaded — back off and retry
      break;
    }
    if (!res) return { ok: false, reason: 'offline' };          // network / relay down
    if (res.status === 429) return { ok: false, reason: 'quota' };
    if (res.status === 503) return { ok: false, reason: 'busy' };
    if (res.status !== 200 || !res.text) {
      console.warn('[AI-ID] relay said:', res.status, res.message);
      return { ok: false, reason: 'error' };
    }
    return { ok: true, text: String(res.text), remaining: res.remaining, cached: !!res.cached };
  } catch (e) {
    console.warn('[AI-ID] failed:', e && e.message);
    return { ok: false, reason: 'error' };
  }
}
