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

// ── SINGLE SOURCE OF TRUTH: the research question ───────────
// v0.9.917 (Brad): every "identify this by photo" Google/Lens search in the
// app builds its question HERE. Change the wording once, every button updates.
// (The relay's server-side ai_identify prompt mirrors this — if you change the
// fields below, update relay Code_v2.x .gs to match.)
//   opts.subject   — what the user said it is ("O Steam Engine"), default generic
//   opts.mfrPhrase — ", possibly made by Lionel or MTH" style hint, default ''
function rrIdentifyQuery(opts) {
  opts = opts || {};
  var subject = opts.subject || 'model railroad item';
  var mfrPhrase = opts.mfrPhrase || '';
  return 'Identify this ' + subject + mfrPhrase
    + ' — it may be a train, a box or box-end label, a building or accessory, OR a paper item '
    + '(catalog, poster, brochure, or instruction sheet). Provide each on its own line: '
    + 'Manufacturer; '
    + 'Manufacturer SKU or catalog number (the unique product code from the catalog, NOT a cab or road number painted on a model); '
    + 'Year manufactured or published; '
    + 'Scale or gauge (e.g. O, O-27, Standard Gauge, HO, S); '
    + 'Description (one line, include the product line or series name). '
    + 'If it is a locomotive or train car, also give: Road name (the railroad represented); '
    + 'Cab number printed on the model; Locomotive class or body style. '
    + 'If it is a building or accessory, also give: Structure type (what the building or accessory is). '
    + 'If it is a poster, catalog, instruction sheet, or other paper/advertising item, also give: '
    + 'Title; Form or part number printed on it; Belongs to item or set (which product it goes with); '
    + 'Original or reproduction. '
    + 'Cite sources like Trainz, train-station.com, lionelsupport.com, postwarlionel.com, or manufacturer catalogs.';
}
if (typeof window !== 'undefined') window.rrIdentifyQuery = rrIdentifyQuery;

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
    // v0.9.1015 (Brad): the user can switch metered photo ID reads off — the
    // free readers still run (they never reach this file); only the paid
    // read is skipped. ONE gate here covers every caller.
    if (rrAiOptedOut()) return { ok: false, reason: 'optout' };
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
    return { ok: true, text: String(res.text), remaining: rrNoteAiRemaining(res.remaining), cached: !!res.cached };
  } catch (e) {
    console.warn('[AI-ID] failed:', e && e.message);
    return { ok: false, reason: 'error' };
  }
}

// ── Remaining-reads meter (v0.9.1000, Brad) ─────────────────────────────
// The relay has always sent back how many photo IDs are left today; the
// app received it and threw it away. Reporting it here — the ONE choke
// point every identify path returns through — no UI call site has to know
// about it, and a limit people can see coming feels fair instead of like a
// trap.
//
// Deliberately NO denominator: the success response carries `remaining`
// but not `cap`, and premium devices are on 100/day rather than 20 (relay
// config `ai_premium_tokens`). "3 left" is true for everyone; "3 of 20"
// would be a lie to a premium user.
function rrNoteAiRemaining(remaining) {
  if (remaining === undefined || remaining === null) return remaining;
  var n = parseInt(remaining, 10);
  if (isNaN(n) || n < 0) return remaining;
  window._rrAiRemaining = n;
  // v0.9.1015 (Brad): persist so the crop screen can show the count before
  // the first read of the day's session. Stamped with the local date — a
  // stale (yesterday's) count is treated as unknown rather than shown wrong.
  try { localStorage.setItem('rr_ai_remaining', n + '|' + new Date().toDateString()); } catch (e) {}
  if (typeof showToast !== 'function') return remaining;
  if (n === 0) {
    showToast('That was today\'s last photo ID — the count resets overnight.', 5200, true);
  } else if (n <= 3) {
    showToast(n + ' photo ID' + (n === 1 ? '' : 's') + ' left today.', 4200, true);
  } else {
    showToast(n + ' photo IDs left today.', 2200);
  }
  return remaining;
}
if (typeof window !== 'undefined') { window.rrNoteAiRemaining = rrNoteAiRemaining; }

// ── Photo ID spending switch + remaining label (v0.9.1015, Brad) ────────
// The user can turn metered reads off entirely (crop-screen checkbox);
// preference is remembered per device. rrAiRemainingLabel() renders today's
// remaining count when we know it (persisted by rrNoteAiRemaining above),
// or '' when we don't — never a guess.
function rrAiOptedOut() {
  try { return localStorage.getItem('rr_ai_optout') === '1'; } catch (e) { return false; }
}
function rrAiSetOptOut(off) {
  try { localStorage.setItem('rr_ai_optout', off ? '1' : '0'); } catch (e) {}
}
function rrAiRemainingLabel() {
  try {
    var p = String(localStorage.getItem('rr_ai_remaining') || '').split('|');
    if (p.length === 2 && p[1] === new Date().toDateString()) {
      var n = parseInt(p[0], 10);
      if (!isNaN(n) && n >= 0) return n + ' photo ID read' + (n === 1 ? '' : 's') + ' left today';
    }
  } catch (e) {}
  return '';
}
if (typeof window !== 'undefined') {
  window.rrAiOptedOut = rrAiOptedOut;
  window.rrAiSetOptOut = rrAiSetOptOut;
  window.rrAiRemainingLabel = rrAiRemainingLabel;
}

// ── Identify v2 (v0.9.896) ──────────────────────────────────
// aiIdentifyImage2(sources, hints)
//   sources: ONE source or an ARRAY of sources (all photos of the SAME
//            item — different angles/box/label; capped at 4)
//   hints:   same as v1
// Talks to the relay's `ai_identify2` action (multi-photo + the
// verify-the-number rule from the AF Coaler lesson). Result shape is
// IDENTICAL to aiIdentifyImage. FALLBACK CONTRACT: on any v2-specific
// failure (relay too old, 400/500, network hiccup, still busy after
// retries) it silently retries through v1 with the first photo — so
// callers can never end up worse off than before v2 existed. It does
// NOT fall back on 'noconsent' or 'quota': consent is consent, and the
// daily cap is SHARED with v1, so a v1 retry would just burn a read.
async function aiIdentifyImage2(sources, hints) {
  var list = Array.isArray(sources) ? sources.slice(0, 4) : [sources];
  if (!list.length) return { ok: false, reason: 'error' };
  try {
    if (rrAiOptedOut()) return { ok: false, reason: 'optout' };   // v0.9.1015: user switched paid reads off
    if (typeof vaultGetToken !== 'function' || typeof vaultPost !== 'function') {
      return { ok: false, reason: 'error' };
    }
    var consent = await aiConsentEnsure();
    if (!consent) return { ok: false, reason: 'noconsent' };
    var images = [];
    for (var i = 0; i < list.length; i++) {
      var img = await aiPrepImage(list[i]);
      if (img) images.push({ data: img.b64, mime: img.mime });
    }
    if (!images.length) return { ok: false, reason: 'error' };
    var res = null;
    for (var _try = 0; _try < 3; _try++) {
      if (_try) await new Promise(function (r) { setTimeout(r, _try * 2500); });
      res = await vaultPost({
        action: 'ai_identify2',
        token: vaultGetToken(),
        images: images,
        hints: hints || {},
      });
      if (res && res.status === 503) continue;   // overloaded — back off and retry
      break;
    }
    if (res && res.status === 429) return { ok: false, reason: 'quota' };
    if (res && res.status === 200 && res.text) {
      return { ok: true, text: String(res.text), remaining: rrNoteAiRemaining(res.remaining), cached: !!res.cached, v2: true };
    }
    console.warn('[AI-ID] v2 answered ' + (res ? res.status : 'nothing') + ' — falling back to v1');
  } catch (e) {
    console.warn('[AI-ID] v2 threw — falling back to v1:', e && e.message);
  }
  // Silent fallback: v1 with the first photo.
  return aiIdentifyImage(list[0], hints);
}


// ── Identify v3 (v0.9.942) — photo double-check ─────────────
// aiVerifyPhoto(source, refUrl)
//   source: the collector's photo (canvas | File/Blob)
//   refUrl: the matched master row's Reference Link (a product/catalog page)
// The relay fetches the page, pulls its product photo, and asks the AI
// whether the two photos show the SAME product. No search grounding — one
// cheap read from the same shared daily pool.
// Resolves:
//   { ok:true, match:'yes'|'no'|'unsure', differences, refItem, refImg, remaining, cached }
//   { ok:false, reason:'noref'|'noconsent'|'quota'|'busy'|'offline'|'error' }
async function aiVerifyPhoto(source, refUrl) {
  try {
    if (typeof vaultGetToken !== 'function' || typeof vaultPost !== 'function') {
      return { ok: false, reason: 'error' };
    }
    if (!refUrl || !/^https?:\/\//i.test(String(refUrl))) return { ok: false, reason: 'noref' };
    var consent = await aiConsentEnsure();
    if (!consent) return { ok: false, reason: 'noconsent' };
    var img = await aiPrepImage(source);
    if (!img) return { ok: false, reason: 'error' };
    var res = null;
    for (var _try = 0; _try < 2; _try++) {
      if (_try) await new Promise(function (r) { setTimeout(r, 2500); });
      res = await vaultPost({
        action: 'ai_verify_photo',
        token: vaultGetToken(),
        image: img.b64,
        mime: img.mime,
        refUrl: String(refUrl),
      });
      if (res && res.status === 503) continue;   // overloaded — back off once
      break;
    }
    if (!res) return { ok: false, reason: 'offline' };
    if (res.status === 429) return { ok: false, reason: 'quota' };
    if (res.status === 503) return { ok: false, reason: 'busy' };
    if (res.status === 422) return { ok: false, reason: 'noref' };   // page had no usable photo
    if (res.status !== 200 || !res.text) {
      console.warn('[AI-ID] verify relay said:', res.status, res.message);
      return { ok: false, reason: (res.status === 400 ? 'noref' : 'error') };
    }
    var t = String(res.text);
    var mM = t.match(/^Match:\s*(yes|no|unsure)/mi);
    var dM = t.match(/^Differences:\s*(.+)$/mi);
    var rM = t.match(/^Reference item:\s*(.+)$/mi);
    return {
      ok: true,
      match: mM ? mM[1].toLowerCase() : 'unsure',
      differences: dM ? dM[1].trim().slice(0, 140) : '',
      refItem: rM ? rM[1].trim().slice(0, 120) : '',
      refImg: res.refImg || '',
      remaining: rrNoteAiRemaining(res.remaining),
      cached: !!res.cached,
    };
  } catch (e) {
    console.warn('[AI-ID] verify failed:', e && e.message);
    return { ok: false, reason: 'error' };
  }
}
