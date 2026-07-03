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
  if (localStorage.getItem(AI_ID.KEY_CONSENT) === 'yes') return Promise.resolve(true);
  return new Promise(function (resolve) {
    var existing = document.getElementById('ai-consent-modal');
    if (existing) existing.remove();
    var d = document.createElement('div');
    d.id = 'ai-consent-modal';
    d.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="width:100%;max-width:420px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:16px;padding:20px;color:var(--text,#eee);font-family:var(--font-body,sans-serif)">'
      + '<div style="font-size:1.02rem;font-weight:700;margin-bottom:10px">🤖 Get an AI opinion?</div>'
      + '<div style="font-size:0.86rem;line-height:1.6;color:var(--text-mid,#ccc);margin-bottom:14px">'
      + 'This box is a tough read, so the app can send <strong style="color:var(--text,#eee)">just this photo</strong> to an AI service to identify it. '
      + 'Until now everything happened on your device — this step sends the photo off-device for analysis. '
      + 'No name, email, or collection data goes with it.</div>'
      + '<div style="font-size:0.8rem;line-height:1.5;color:var(--text-dim,#999);margin-bottom:16px">Limited to a small number of AI looks per day. You won’t be asked again.</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button data-a="yes" style="flex:2;padding:11px;border-radius:10px;border:none;background:var(--accent,#e8401c);color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer">OK — use AI</button>'
      + '<button data-a="no" style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);font-size:0.86rem;cursor:pointer">Not now</button>'
      + '</div></div>';
    d.addEventListener('click', function (e) {
      var el = (e.target && e.target.closest) ? e.target.closest('[data-a]') : null;
      if (!el) return;
      var a = el.getAttribute('data-a');
      d.remove();
      if (a === 'yes') { localStorage.setItem(AI_ID.KEY_CONSENT, 'yes'); resolve(true); }
      else resolve(false);
    });
    document.body.appendChild(d);
  });
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
    var res = await vaultPost({
      action: 'ai_identify',
      token: vaultGetToken(),
      image: img.b64,
      mime: img.mime,
      hints: hints || {},
    });
    if (!res) return { ok: false, reason: 'offline' };          // network / relay down
    if (res.status === 429) return { ok: false, reason: 'quota' };
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
