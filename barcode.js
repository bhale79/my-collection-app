// ══════════════════════════════════════════════════════════════
//  barcode.js — Phase 1 Barcode Scanner (Lionel Modern only)
//
//  Entry point: openBarcodeScanner(onScanned, onCancel, eraHint)
//    onScanned(result) — called on successful parse.
//      result = { itemNum, upc, manufacturer, rawBarcode, format }
//    onCancel()        — called if user closes without scanning
//    eraHint ('mpc'|'mod'|undefined) — used to hint which prefix we expect
//
//  Supports: UPC-A (12 digits), EAN-13 (13), Code 128, Code 39.
//  Phase 1 parses only Lionel prefix 023922 (UPC-A) +
//  Code 128 SKU formats like "10-XXXX" (MTH routing for Phase 2).
//
//  Requires: BarcodeDetector API (Chrome/Edge/Safari modern).
// ══════════════════════════════════════════════════════════════

// ── Session 139 (Tier 3.18) ── Era gating for the barcode scanner UI ──
// Returns true if the given era key supports barcode lookup. UPCs weren't
// standardized until ~1973-74, so all pre-1970 Lionel eras hide the button.
// Modern Lionel HO/S, all MTH, Atlas, and future K-Line/Menards SHOW it.
function eraSupportsBarcode(era) {
  if (!era) return false;
  var SHOW = ['mod','mpc','atlas',
              'mth_o','mth_ho','mth_s','mth_tinplate','mth_g',
              'mod_ho','mod_s','weaver','rmt','menards'];
  return SHOW.indexOf(String(era).toLowerCase()) >= 0;
}
window.eraSupportsBarcode = eraSupportsBarcode;

(function() {
  const EXPLAINER_ACK_KEY = 'lv_barcode_explainer_ack';

  // Manufacturer prefix → handler
  const UPC_PREFIXES = {
    '023922': { mfr: 'Lionel',  parse: parseLionelUPC },
    '040369': { mfr: 'K-Line',  parse: parseUnknown }, // Phase 2
    '658081': { mfr: 'MTH',     parse: parseUnknown }, // Phase 2 — needs lookup
    '783208': { mfr: 'Menards', parse: parseUnknown }, // Phase 2 — needs lookup
  };

  // ── Parse functions per manufacturer ──
  function parseLionelUPC(upc) {
    // 023922 XXXXX Y  →  item# last 5 digits = UPC positions 7..11 (0-indexed 6..10)
    const code5 = upc.substring(6, 11);
    // Lionel items can be stored as "6-XXXXX", "XXXXX", or 7-digit like "2XXXXXX"
    // Try common variants
    const candidates = [
      '6-' + code5,
      code5,
      // 7-digit modern items (rare): any 7-digit item# ending in code5
    ];
    return { itemNumCandidates: candidates, code5: code5 };
  }
  function parseUnknown(upc) {
    return { itemNumCandidates: [], code5: upc.substring(6, 11) };
  }

  // ── Look up item#(s) in master — returns ALL matches (Session 154) ──
  // A Lionel UPC only carries the last 5 digits, so reissues that share
  // those 5 digits (26200 / 1926200 / 2026200 …) all map to one scan.
  // Return every candidate so the caller can disambiguate with the user.
  // Session 167: cross-era lookup. First scan state.masterData (the era
  // currently loaded into memory). If no hit, scan every other era's IDB
  // cache filled by the Session 162 preloader. Each hit gets tagged with
  // its source era so the wizard can route the save correctly.
  function _matchInArray(arr, candidates) {
    if (!arr || !arr.length) return [];
    var out = [];
    var seen = {};
    function addAll(pred) {
      arr.forEach(function(m) {
        if (!pred(m)) return;
        var key = (m.itemNum || '') + '|' + (m.variation || '') + '|' + (m._tab || '');
        if (seen[key]) return;
        seen[key] = 1;
        out.push(m);
      });
    }
    candidates.forEach(function(cand) {
      addAll(function(m) {
        return m.itemNum === cand
          || m.itemNum === cand.replace(/^6-/, '')
          || m.itemNum === ('6-' + cand);
      });
    });
    if (candidates[0]) {
      var tail = candidates[0].replace(/^6-/, '').slice(-5);
      addAll(function(m) {
        var n = String(m.itemNum || '').replace(/\D+/g, '');
        return n.length >= 5 && n.slice(-5) === tail;
      });
    }
    return out;
  }
  async function findMasterItems(candidates) {
    if (!candidates || candidates.length === 0) return [];
    // Pass A — current era (in memory, fast)
    if (typeof state !== 'undefined' && state.masterData && state.masterData.length) {
      var current = _matchInArray(state.masterData, candidates);
      if (current.length) return current;
    }
    // Pass B — every other era's IDB cache (populated by Session 162 preloader)
    if (typeof REAL_ERA_IDS === 'undefined' || !Array.isArray(REAL_ERA_IDS)) return [];
    if (typeof idbGet !== 'function') return [];
    var curEra = (typeof _currentEra !== 'undefined') ? _currentEra : null;
    for (var i = 0; i < REAL_ERA_IDS.length; i++) {
      var era = REAL_ERA_IDS[i];
      if (era === curEra) continue;
      try {
        var cached = await idbGet('lv_master_cache_' + era);
        if (!cached || !cached.length) continue;
        var hits = _matchInArray(cached, candidates);
        if (hits.length) {
          // Tag every hit with its source era so the wizard adopts it.
          hits.forEach(function(h) { if (!h._era) h._era = era; });
          return hits;
        }
      } catch(e) {}
    }
    return [];
  }
  // Back-compat single-result helper (first match or null). Async now.
  async function findMasterItem(candidates) {
    var all = await findMasterItems(candidates);
    return all.length ? all[0] : null;
  }
  // Session 169: exact-only variant for OCR scans — same as findMasterItems
  // but without the fuzzy last-5 fallback that masks bad OCR extractions.
  async function _findMasterItemsExact(candidates) {
    if (!candidates || candidates.length === 0) return [];
    function _exactMatch(arr, cands) {
      if (!arr || !arr.length) return [];
      var out = [];
      var seen = {};
      cands.forEach(function(cand) {
        arr.forEach(function(m) {
          var match = m.itemNum === cand
            || m.itemNum === cand.replace(/^6-/, '')
            || m.itemNum === ('6-' + cand);
          if (!match) return;
          var key = (m.itemNum || '') + '|' + (m.variation || '') + '|' + (m._tab || '');
          if (seen[key]) return;
          seen[key] = 1;
          out.push(m);
        });
      });
      return out;
    }
    if (typeof state !== 'undefined' && state.masterData && state.masterData.length) {
      var current = _exactMatch(state.masterData, candidates);
      if (current.length) return current;
    }
    if (typeof REAL_ERA_IDS === 'undefined' || !Array.isArray(REAL_ERA_IDS)) return [];
    if (typeof idbGet !== 'function') return [];
    var curEra = (typeof _currentEra !== 'undefined') ? _currentEra : null;
    for (var i = 0; i < REAL_ERA_IDS.length; i++) {
      var era = REAL_ERA_IDS[i];
      if (era === curEra) continue;
      try {
        var cached = await idbGet('lv_master_cache_' + era);
        if (!cached || !cached.length) continue;
        var hits = _exactMatch(cached, candidates);
        if (hits.length) {
          hits.forEach(function(h) { if (!h._era) h._era = era; });
          return hits;
        }
      } catch(e) {}
    }
    return [];
  }
  // v0.9.640: EXACT matches aggregated across EVERY era (current + IDB caches),
  // so a postwar 6468-25 and a modern reissue can appear side by side.
  async function _findMasterItemsAllEras(candidates) {
    var out = [], seen = {};
    function addAll(arr, era) {
      if (!arr || !arr.length) return;
      candidates.forEach(function (cand) {
        arr.forEach(function (m) {
          var match = m.itemNum === cand || m.itemNum === cand.replace(/^6-/, '') || m.itemNum === ('6-' + cand);
          if (!match) return;
          var e = m._era || era;
          var key = (m.itemNum || '') + '|' + (m.variation || '') + '|' + (m._tab || '') + '|' + e;
          if (seen[key]) return;
          seen[key] = 1;
          if (!m._era) m._era = era;
          out.push(m);
        });
      });
    }
    var curEra = (typeof _currentEra !== 'undefined') ? _currentEra : '';
    if (typeof state !== 'undefined' && state.masterData) addAll(state.masterData, curEra);
    if (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS) && typeof idbGet === 'function') {
      for (var i = 0; i < REAL_ERA_IDS.length; i++) {
        var era = REAL_ERA_IDS[i];
        if (era === curEra) continue;
        try { addAll(await idbGet('lv_master_cache_' + era), era); } catch (e) {}
      }
    }
    return out;
  }
  // v0.9.640: modern reissues usually QUOTE the postwar number in their
  // description ('Postwar "6468" NH DD Boxcar'). For a postwar-format scan,
  // offer those rows too — clearly labeled, never auto-picked (a road number
  // can collide, e.g. a diesel cab numbered 6468).
  async function _findReissueByDesc(numRaw, excludeSeen) {
    var base = String(numRaw || '').toUpperCase();
    if (!/^\d{3,4}(-\d{1,4})?[A-Z]{0,2}$/.test(base)) return [];
    var pats = [base];
    if (base.indexOf('-') > 0) pats.push(base.split('-')[0]);
    var re;
    try { re = new RegExp('(^|[^0-9A-Z])(' + pats.join('|').replace(/-/g, '\\-') + ')([^0-9]|$)'); } catch (e) { return []; }
    var out = [], seen = excludeSeen || {};
    function scan(arr, era) {
      if (!arr) return;
      for (var i = 0; i < arr.length && out.length < 6; i++) {
        var m = arr[i];
        var d = String(m.description || '');
        if (!d || !re.test(d.toUpperCase())) continue;
        var e = m._era || era;
        var key = (m.itemNum || '') + '|' + (m.variation || '') + '|' + (m._tab || '') + '|' + e;
        if (seen[key]) continue;
        seen[key] = 1;
        if (!m._era) m._era = era;
        m._descMatch = true;
        out.push(m);
      }
    }
    var curEra = (typeof _currentEra !== 'undefined') ? _currentEra : '';
    if (typeof state !== 'undefined' && state.masterData) scan(state.masterData, curEra);
    if (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS) && typeof idbGet === 'function') {
      for (var i = 0; i < REAL_ERA_IDS.length && out.length < 6; i++) {
        var era = REAL_ERA_IDS[i];
        if (era === curEra) continue;
        try { scan(await idbGet('lv_master_cache_' + era), era); } catch (e) {}
      }
    }
    return out;
  }
  // Friendly era name for badges ('mpc' -> its ERAS label when available).
  function _eraLabel(e) {
    if (!e) return '';
    try { if (typeof ERAS !== 'undefined' && ERAS[e]) return ERAS[e].label || ERAS[e].name || String(e); } catch (err) {}
    return String(e);
  }
  // HTML-escape helper for picker rendering.
  function _bcEsc(s) {
    return String(s == null ? '' : s).replace(/[<>"'&]/g, function(c) {
      return {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c];
    });
  }
  // Build a "view this item" URL — reuse the app's smart helper if present,
  // else fall back to a Lionel.com search.
  function _bcViewUrl(m) {
    try {
      if (typeof _itemExternalLinkURL === 'function') {
        var u = _itemExternalLinkURL(m);
        if (u) return u;
      }
    } catch (e) {}
    var num = String((m && m.itemNum) || '').replace(/^6-/, '');
    return 'https://www.lionel.com/search?query=' + encodeURIComponent(num);
  }

  // ── Robust decode engine (barcode robustness update) ──────────────
  // Native BarcodeDetector works on Android/Chromium but is ABSENT on all
  // iOS/iPadOS browsers (WebKit). ZXing-WASM runs the proven ZXing decoder
  // in the browser as a fallback so iPhones can scan too. Loaded lazily
  // from jsDelivr only when the native API is missing.
  var _zxingMod = null, _zxingLoading = null;
  var _ZXING_ESM = 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.0/dist/es/reader/index.js';
  var _ZXING_WASM_BASE = 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.0/dist/reader/';
  function _loadZXing() {
    if (_zxingMod) return Promise.resolve(_zxingMod);
    if (_zxingLoading) return _zxingLoading;
    _zxingLoading = import(_ZXING_ESM).then(function (mod) {
      try { mod.setZXingModuleOverrides({ locateFile: function (path) { return (/\.wasm$/.test(path)) ? _ZXING_WASM_BASE + path : path; } }); } catch (e) {}
      _zxingMod = mod; return mod;
    });
    return _zxingLoading;
  }
  // ZXing format names ("EAN13") -> BarcodeDetector-style ("ean_13") so the
  // rest of decodeBarcode() sees one consistent vocabulary.
  function _zxFmtToStd(f) {
    var t = String(f || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    var m = { ean13: 'ean_13', upca: 'upc_a', upce: 'upc_e', ean8: 'ean_8', code128: 'code_128', code39: 'code_39' };
    return m[t] || t;
  }
  // Unified detect: returns [{rawValue, format}] from whichever engine is active.
  var _bcFrameCanvas = null, _bcFrameCtx = null;
  async function _bcDetect(video, nativeDetector) {
    if (nativeDetector) return await nativeDetector.detect(video);
    var mod = _zxingMod;
    if (!mod) return [];
    var vw = video.videoWidth | 0, vh = video.videoHeight | 0;
    if (!vw || !vh) return [];
    if (!_bcFrameCanvas) { _bcFrameCanvas = document.createElement('canvas'); _bcFrameCtx = _bcFrameCanvas.getContext('2d', { willReadFrequently: true }); }
    if (_bcFrameCanvas.width !== vw) _bcFrameCanvas.width = vw;
    if (_bcFrameCanvas.height !== vh) _bcFrameCanvas.height = vh;
    _bcFrameCtx.drawImage(video, 0, 0, vw, vh);
    var img = _bcFrameCtx.getImageData(0, 0, vw, vh);
    var res = await mod.readBarcodesFromImageData(img, { tryHarder: true, formats: ['EAN13', 'UPCA', 'EAN8', 'UPCE', 'Code128', 'Code39'], maxNumberOfSymbols: 1 });
    return (res || []).filter(function (r) { return r.text; }).map(function (r) { return { rawValue: r.text, format: _zxFmtToStd(r.format) }; });
  }

  // ── Double-verify: read the label on the SAME camera frame and cross-check ──
  // A Lionel UPC only carries 5 digits, so shared-barcode reissues (1931290 /
  // 2031290 …) are ambiguous. Reading the full number printed on the label lets
  // us confirm/auto-resolve. Captures the frame synchronously, then OCRs it.
  // Pre-process a captured frame for OCR: grayscale + contrast-stretch (+ upscale
  // small crops). Big help on low-contrast vintage/colored boxes — blue-on-orange
  // MPC boxes and postwar boxes — where raw Tesseract just sees mush.
  function _bcPreprocessForOCR(src) {
    try {
      var w = src.width | 0, h = src.height | 0;
      if (!w || !h) return src;
      var img = src.getContext('2d').getImageData(0, 0, w, h);
      var d = img.data, i, g, o, mn = 255, mx = 0, omn = 255, omx = 0;
      // v0.9.638: two candidate channels —
      //   gray = plain luminance (right for black-on-white modern labels)
      //   opp  = red-minus-blue opponent channel. Blue ink on an orange box has
      //          nearly the SAME luminance (gray turns it to mush), but red vs
      //          blue separates them hard. Keep whichever channel has more
      //          contrast, so normal boxes are unaffected.
      var gray = new Uint8ClampedArray(w * h);
      var opp  = new Uint8ClampedArray(w * h);
      for (i = 0; i < d.length; i += 4) {
        g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
        o = 128 + ((d[i] - d[i + 2]) >> 1);
        if (o < 0) o = 0; else if (o > 255) o = 255;
        gray[i >> 2] = g;
        opp[i >> 2] = o;
        if (g < mn) mn = g;
        if (g > mx) mx = g;
        if (o < omn) omn = o;
        if (o > omx) omx = o;
      }
      if ((omx - omn) > (mx - mn)) { gray = opp; mn = omn; mx = omx; }
      var range = (mx - mn) || 1;
      var scale = (w < 1000) ? 2 : 1;   // upscale only small crops; keep hi-res OCR fast
      var out = document.createElement('canvas');
      out.width = w * scale; out.height = h * scale;
      var octx = out.getContext('2d');
      var oimg = octx.createImageData(out.width, out.height);
      var od = oimg.data, x, y, sxp, syp, val, p;
      for (y = 0; y < out.height; y++) {
        syp = (y / scale) | 0;
        for (x = 0; x < out.width; x++) {
          sxp = (x / scale) | 0;
          val = ((gray[syp * w + sxp] - mn) * 255 / range) | 0;
          p = (y * out.width + x) * 4;
          od[p] = od[p + 1] = od[p + 2] = val; od[p + 3] = 255;
        }
      }
      octx.putImageData(oimg, 0, 0);
      return out;
    } catch (e) { return src; }
  }
  async function _bcLabelVerify(video) {
    var vw = video.videoWidth | 0, vh = video.videoHeight | 0;
    if (!vw || !vh) return { nums: [], text: '' };
    var full = document.createElement('canvas'); full.width = vw; full.height = vh;
    full.getContext('2d').drawImage(video, 0, 0, vw, vh);
    var sx = Math.floor(vw * 0.10), sy = Math.floor(vh * 0.06);
    var sw = vw - 2 * sx, sh = vh - 2 * sy;
    var crop = document.createElement('canvas'); crop.width = sw; crop.height = sh;
    crop.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    try {
      var Tesseract = await _ensureTesseract();
      var ocr = await Tesseract.recognize(_bcPreprocessForOCR(crop), 'eng', {});
      var text = (ocr && ocr.data && ocr.data.text) || '';
      var cands = (typeof _extractItemNumberCandidates === 'function') ? (_extractItemNumberCandidates(text) || []) : [];
      var nums = cands.map(function (c) { return String(c.raw || '').replace(/\D+/g, ''); }).filter(function (n) { return n.length >= 4; });
      (text.match(/\d{6,7}/g) || []).forEach(function (n) { if (nums.indexOf(n) < 0) nums.push(n); });
      return { nums: nums, text: text };
    } catch (e) { return { nums: [], text: '' }; }
  }
  // Which barcode candidate does the label confirm? Only a full (>=6-digit)
  // label number can disambiguate — a bare 5-digit read matches them all.
  // v0.9.638: full label-rescue on the current frame. Used when the barcode is a
  // dead end (unknown prefix / Phase-2 maker) — instead of giving up, OCR the
  // printed label and try to identify the item the same way the label scanner does.
  // Returns a result object for the confirm card, or null if nothing was read.
  async function _bcLabelRescue(video) {
    var vw = video.videoWidth | 0, vh = video.videoHeight | 0;
    if (!vw || !vh) return null;
    var full = document.createElement('canvas'); full.width = vw; full.height = vh;
    full.getContext('2d').drawImage(video, 0, 0, vw, vh);
    var sx = Math.floor(vw * 0.10), sy = Math.floor(vh * 0.06);
    var crop = document.createElement('canvas'); crop.width = vw - 2 * sx; crop.height = vh - 2 * sy;
    crop.getContext('2d').drawImage(full, sx, sy, crop.width, crop.height, 0, 0, crop.width, crop.height);
    try {
      var T = await _ensureTesseract();
      var ocr = await T.recognize(_bcPreprocessForOCR(crop), 'eng', {});
      var text = (ocr && ocr.data && ocr.data.text) || '';
      var cands = _extractItemNumberCandidates(text);
      if (!cands || !cands.length) return null;
      var best = cands[0];
      var raw = best.raw;
      var lookup = [raw];
      if (raw.indexOf('6-') === 0) lookup.push(raw.substring(2));
      else if (/^\d/.test(raw)) lookup.push('6-' + raw);
      var hits = await _findMasterItemsExact(lookup);
      if (hits.length) {
        var m = hits[0];
        return { handled: true, itemNum: m.itemNum, variation: m.variation || '', masterItem: m, manufacturer: best.mfr || 'Lionel', roadName: (m.roadName || ''), description: (m.description || ''), verifiedNote: '✓ Read from the printed label', verifiedBy: 'label', statusMessage: 'Found ' + m.itemNum + ' — ' + (m.description || '').substring(0, 40) };
      }
      var labelDesc = _bcDescriptionGuess(text, raw);
      if (labelDesc && !_bcLooksLikeWords(labelDesc)) labelDesc = '';   // v0.9.640
      return { handled: true, itemNum: raw, variation: '', notInMaster: true, manufacturer: best.mfr, labelDescription: labelDesc, description: labelDesc, statusMessage: 'Read ' + raw + ' off the label — not in our catalog, adding manually…' };
    } catch (e) { return null; }
  }
  // v0.9.655: Tier 3 — AI rescue. Sends the current frame/canvas to the AI
  // relay (ai-id.js → Apps Script v1.3 → Gemini) when barcode + local OCR
  // both dead-end. The relay answers in the same labeled format the Lens
  // paste flow uses, so extractIdentifyMetadata() (wizard-photos.js) does
  // ALL the parsing — no new parsing code here.
  // Returns a confirm-card result object, or null. reasonOut ({}) receives
  // the failure reason ('quota' | 'noconsent' | 'hedge' | 'nothing' | 'error').
  async function _bcAiRescue(source, eraHint, reasonOut) {
    reasonOut = reasonOut || {};
    if (typeof aiIdentifyImage !== 'function') { reasonOut.reason = 'error'; return null; }
    try {
      var hints = {};
      if (eraHint && typeof ERAS !== 'undefined' && ERAS[eraHint] && ERAS[eraHint].manufacturer) {
        hints.mfrs = [ERAS[eraHint].manufacturer];
      }
      var ai = await aiIdentifyImage(source, hints);
      if (!ai || !ai.ok) { reasonOut.reason = (ai && ai.reason) || 'error'; return null; }
      var text = (typeof _identifySanitize === 'function') ? _identifySanitize(ai.text) : String(ai.text || '');
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(text) : {};
      if (!meta.itemNum) {
        // v0.9.655 (Brad, 2026-07-03): postwar rescue. On postwar boxes the
        // catalog number IS the number on the box/cab, so the honest AI says
        // "no specific catalog number found" but still reports the cab. If
        // that number exists in the master AND the AI's manufacturer agrees
        // with the hit's era (keeps the Weaver-3460 protection: a Weaver box
        // must never auto-match a Lionel master row), offer it — the confirm
        // card gives the user the final say.
        if (meta.cabNum && meta.manufacturer) {
          var cabRaw = String(meta.cabNum);
          var cabLookup = [cabRaw];
          if (/^\d/.test(cabRaw)) cabLookup.push('6-' + cabRaw);
          var cabHits = await _findMasterItemsAllEras(cabLookup);
          var aiMfr = String(meta.manufacturer).toLowerCase();
          var cabOk = cabHits.filter(function (h) {
            var eraMfr = (typeof ERAS !== 'undefined' && h._era && ERAS[h._era]) ? String(ERAS[h._era].manufacturer || '').toLowerCase() : '';
            return eraMfr && eraMfr === aiMfr;
          });
          // If the AI also read a road name, prefer master rows that agree.
          if (cabOk.length && meta.roadName) {
            var mrn = String(meta.roadName).toLowerCase();
            var pref = cabOk.filter(function (h) {
              var rn = String(h.roadName || '').toLowerCase();
              return rn && (rn.indexOf(mrn) >= 0 || mrn.indexOf(rn) >= 0);
            });
            if (pref.length) cabOk = pref;
          }
          if (cabOk.length) {
            var cm = cabOk[0];
            return { handled: true, itemNum: cm.itemNum, variation: cm.variation || '', masterItem: cm, manufacturer: meta.manufacturer, roadName: (cm.roadName || ''), description: (cm.description || ''), eraTag: (typeof _eraLabel === 'function') ? _eraLabel(cm._era) : '', verifiedNote: '🤖 AI read the box number ' + cabRaw, verifiedBy: 'ai', statusMessage: 'AI found ' + cm.itemNum + ' — ' + (cm.description || '').substring(0, 40) };
          }
        }
        // v0.9.660: the AI read real details but no valid catalog number (e.g.
        // the MTH guard demoted a cab number). Offer a description-only manual
        // add instead of a dead end — confirm card + manual flow carry the rest.
        var _nmBits = [];
        if (meta.roadName) _nmBits.push(meta.roadName);
        if (meta.subType)  _nmBits.push(meta.subType);
        if (meta.cabNum)   _nmBits.push('#' + meta.cabNum);
        if (_nmBits.length) {
          return { handled: true, itemNum: '', noItemNum: true, variation: '', notInMaster: true, manufacturer: meta.manufacturer || '', labelDescription: _nmBits.join(' '), description: _nmBits.join(' '), aiMeta: meta, verifiedBy: 'ai', statusMessage: 'AI read the box — no catalog number visible, adding manually…' };
        }
        reasonOut.reason = meta._hedge ? 'hedge' : 'nothing';
        return null;
      }
      var raw = meta.itemNum;
      var lookup = [raw];
      if (raw.indexOf('6-') === 0) lookup.push(raw.substring(2));
      else if (/^\d/.test(raw)) lookup.push('6-' + raw);
      var hits = await _findMasterItemsAllEras(lookup);
      if (hits.length) {
        var m = hits[0];
        return { handled: true, itemNum: m.itemNum, variation: m.variation || '', masterItem: m, manufacturer: meta.manufacturer || 'Lionel', roadName: (m.roadName || ''), description: (m.description || ''), eraTag: (typeof _eraLabel === 'function') ? _eraLabel(m._era) : '', verifiedNote: '🤖 Identified by AI from the photo', verifiedBy: 'ai', statusMessage: 'AI found ' + m.itemNum + ' — ' + (m.description || '').substring(0, 40) };
      }
      var descBits = [];
      if (meta.roadName) descBits.push(meta.roadName);
      if (meta.subType)  descBits.push(meta.subType);
      if (meta.cabNum)   descBits.push('#' + meta.cabNum);
      var desc = descBits.join(' ').trim();
      return { handled: true, itemNum: raw, variation: '', notInMaster: true, manufacturer: meta.manufacturer || '', labelDescription: desc, description: desc, aiMeta: meta, verifiedBy: 'ai', statusMessage: 'AI read ' + raw + ' — not in our catalog, adding manually…' };
    } catch (e) { reasonOut.reason = 'error'; return null; }
  }
  function _bcPickByLabel(cands, ocrNums, code5) {
    if (!cands || !cands.length || !ocrNums || !ocrNums.length) return null;
    for (var i = 0; i < cands.length; i++) {
      var cn = String(cands[i].itemNum || '').replace(/\D+/g, '');
      if (!cn) continue;
      for (var j = 0; j < ocrNums.length; j++) {
        var on = ocrNums[j];
        if (!on || on.length < 6) continue;
        if (cn === on || (on.length >= cn.length && on.slice(-cn.length) === cn)) return cands[i];
      }
    }
    return null;
  }

  // ── Main entry ──
  async function openBarcodeScanner(onScanned, onCancel, eraHint) {
    // Support check — native engine (Android/Chromium) OR ZXing-WASM fallback (iOS/Safari).
    var _hasNativeBD = ('BarcodeDetector' in window);

    // First-time explainer
    if (!localStorage.getItem(EXPLAINER_ACK_KEY)) {
      const proceed = await showExplainer();
      if (!proceed) { if (onCancel) onCancel(); return; }
      localStorage.setItem(EXPLAINER_ACK_KEY, '1');
    }

    // Build scanner UI
    const overlay = document.createElement('div');
    overlay.id = 'barcode-scanner-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:1rem;align-items:center">
        <div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;text-align:center;position:relative;width:100%">📷 Scan Barcode / Label<button id="bc-help" type="button" style="position:absolute;right:0;top:-4px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer">?</button></div>
        <div style="position:relative;width:100%;aspect-ratio:4/3;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
          <video id="bc-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
          <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
            <div style="width:84%;height:52%;border:2px dashed rgba(255,255,255,0.6);border-radius:8px"></div>
          </div>
        </div>
        <div style="color:#9fb4c8;font-size:0.8rem;text-align:center;width:100%;line-height:1.35">Make sure the barcode and/or item number is completely in the picture.</div>
        <div id="bc-controls" style="display:flex;gap:0.6rem;width:100%;align-items:center;justify-content:center">
          <button id="bc-torch" type="button" style="display:none;padding:0.5rem 0.9rem;border-radius:10px;border:1px solid #444;background:#222;color:#eee;font-size:0.85rem;cursor:pointer">🔦 Light</button>
          <div id="bc-zoomwrap" style="display:none;flex:1;max-width:240px;align-items:center;gap:0.4rem">
            <span style="color:#aaa;font-size:0.78rem">Zoom</span>
            <input id="bc-zoom" type="range" style="flex:1;accent-color:#e04028">
          </div>
        </div>
        <div id="bc-status" style="color:#ccc;font-size:0.85rem;text-align:center;min-height:1.4em">Fit the barcode & item number fully in the frame</div>
        <button id="bc-tolabel" type="button" style="width:100%;padding:0.7rem;border-radius:10px;border:1px solid #3a6ea5;background:rgba(58,110,165,0.18);color:#cfe3ff;font-size:0.9rem;font-family:inherit;cursor:pointer">📸 Can't scan? Read the label instead</button>
        <div style="display:flex;gap:0.6rem;width:100%">
          <button id="bc-cancel" style="flex:1;padding:0.8rem;border-radius:10px;border:1px solid #444;background:#222;color:#eee;font-size:0.95rem;font-family:inherit;cursor:pointer">Cancel</button>
          <button id="bc-manual" style="flex:2;padding:0.8rem;border-radius:10px;border:none;background:#e04028;color:#fff;font-size:0.95rem;font-family:inherit;font-weight:600;cursor:pointer">Can't Read — Type Instead</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('#bc-video');
    const statusEl = overlay.querySelector('#bc-status');
    const cancelBtn = overlay.querySelector('#bc-cancel');
    const manualBtn = overlay.querySelector('#bc-manual');
    const helpBtn = overlay.querySelector('#bc-help'); if (helpBtn) helpBtn.onclick = () => _bcHelpPanel('barcode');
    const torchBtn = overlay.querySelector('#bc-torch');
    const zoomWrap = overlay.querySelector('#bc-zoomwrap');
    const zoomSlider = overlay.querySelector('#bc-zoom');
    const toLabelBtn = overlay.querySelector('#bc-tolabel');

    let stream = null;
    let stopScanning = false;

    const cleanup = () => {
      stopScanning = true;
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      overlay.remove();
    };

    cancelBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };
    manualBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };
    // Always-available handoff to the OCR label reader (barcode damaged / not in UPC db / no barcode).
    if (toLabelBtn) toLabelBtn.onclick = () => { cleanup(); openLabelScanner(onScanned, onCancel, eraHint); };

    // Request camera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        },
        audio: false,
      });
      video.srcObject = stream;
    } catch (e) {
      statusEl.textContent = 'Camera access denied or unavailable. Type the number instead.';
      statusEl.style.color = '#ff9580';
      return;
    }

    // Detection engine: native BarcodeDetector (Android/Chromium) or ZXing-WASM fallback (iOS/Safari).
    const nativeDetector = _hasNativeBD ? new window.BarcodeDetector({
      formats: ['upc_a', 'ean_13', 'code_128', 'code_39']
    }) : null;

    await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));

    // Tune the camera track: continuous focus, torch button, zoom slider (all capability-gated).
    try {
      const _bcTrack = stream.getVideoTracks()[0];
      const _caps = (_bcTrack && _bcTrack.getCapabilities) ? _bcTrack.getCapabilities() : {};
      if (_caps.focusMode && _caps.focusMode.indexOf('continuous') >= 0) {
        try { await _bcTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
      }
      if (torchBtn && _caps.torch) {
        torchBtn.style.display = '';
        let _torchOn = false;
        torchBtn.onclick = async () => { _torchOn = !_torchOn; try { await _bcTrack.applyConstraints({ advanced: [{ torch: _torchOn }] }); torchBtn.style.background = _torchOn ? '#e8a020' : '#222'; } catch (e) {} };
      }
      if (zoomWrap && zoomSlider && _caps.zoom) {
        zoomWrap.style.display = 'flex';
        zoomSlider.min = _caps.zoom.min; zoomSlider.max = _caps.zoom.max; zoomSlider.step = _caps.zoom.step || 0.1;
        try { zoomSlider.value = (_bcTrack.getSettings && _bcTrack.getSettings().zoom) || _caps.zoom.min; } catch (e) {}
        zoomSlider.oninput = async () => { try { await _bcTrack.applyConstraints({ advanced: [{ zoom: parseFloat(zoomSlider.value) }] }); } catch (e) {} };
      }
    } catch (e) {}

    // On the fallback engine (iOS), warm up ZXing-WASM before the loop.
    if (!nativeDetector) {
      statusEl.textContent = 'Loading scanner…';
      try { await _loadZXing(); } catch (e) { statusEl.textContent = 'Could not load the scanner — tap "Type Instead".'; statusEl.style.color = '#ff9580'; return; }
      statusEl.textContent = 'Fit the barcode & item number fully in the frame';
    }

    let _bcLastRaw = null, _bcConfirm = 0;
    // v0.9.638: sticky status — once we have something meaningful to say, hold it
    // on screen instead of letting the next frame overwrite it (the old behavior
    // made messages flash on/off too fast to read).
    let _bcStickyUntil = 0;
    const _bcRescueTried = {};
    const _setStatus = (msg, color, holdMs) => {
      if (Date.now() < _bcStickyUntil) return;
      statusEl.textContent = msg;
      statusEl.style.color = color || '#ccc';
      if (holdMs) _bcStickyUntil = Date.now() + holdMs;
    };
    (async function loop() {
      while (!stopScanning) {
        try {
          const barcodes = await _bcDetect(video, nativeDetector);
          if (barcodes && barcodes.length > 0) {
            const bc = barcodes[0];
            // Two-read consensus: require the same value on two frames before accepting.
            if (bc.rawValue === _bcLastRaw) { _bcConfirm++; } else { _bcLastRaw = bc.rawValue; _bcConfirm = 1; }
            if (_bcConfirm < 2) { _setStatus('Reading…', '#ffd27d'); await new Promise(r => setTimeout(r, 90)); continue; }
            const result = await decodeBarcode(bc, eraHint);
            if (result.handled && result.multipleMatches) {
              stopScanning = true;
              // Always double-verify: OCR the label on the SAME frame to auto-resolve the shared-barcode ambiguity.
              statusEl.textContent = 'Barcode matches ' + result.candidates.length + ' items — reading the label to confirm…';
              statusEl.style.color = '#ffd27d';
              const _lvP = _bcLabelVerify(video);   // captures the current frame synchronously
              cleanup();
              const _lv = await _lvP;
              const _autoMatch = _bcPickByLabel(result.candidates, _lv.nums, result.code5);
              // v0.9.641: label read a number the barcode candidates DON'T cover
              // (e.g. printed 2243101 vs coincidental Atlas/MTH tail matches) —
              // look it up and lead the picker with it.
              if (!_autoMatch && _lv.nums && _lv.nums.length) {
                for (const _ln of _lv.nums) {
                  if (!_ln || _ln.length < 6) continue;
                  const _lh = await _findMasterItemsExact([_ln, '6-' + _ln]);
                  if (_lh.length) {
                    _lh.forEach(function (h) { h._labelRead = true; });
                    result.candidates = _lh.concat(result.candidates);
                    break;
                  }
                }
              }
              if (_autoMatch) {
                const _cc = await _bcConfirmCard({ itemNum: _autoMatch.itemNum, manufacturer: 'Lionel', roadName: (_autoMatch.roadName || ''), description: (_autoMatch.description || ''), verifiedNote: '✓ Barcode + label agree' });
                if (_cc === 'use') { if (onScanned) onScanned({ handled: true, rawBarcode: result.rawBarcode, format: result.format, upc: result.upc, manufacturer: 'Lionel', itemNum: _autoMatch.itemNum, variation: _autoMatch.variation || '', masterItem: _autoMatch, verifiedBy: 'barcode+label', isSet: String(_autoMatch.itemType || '').toLowerCase() === 'set' }); return; }
                if (_cc === 'manual') { if (onCancel) onCancel(); return; }
                if (_cc === 'cancel') { if (onCancel) onCancel(); return; }
                openBarcodeScanner(onScanned, onCancel, eraHint); return;
              }
              // Label didn't resolve it — fall back to the manual picker.
              const chosen = await showCandidatePicker(result.candidates, result);
              if (chosen && chosen.__notInList) {
                // v0.9.638: user says the box is the classic-form number, not in the master yet.
                if (onScanned) onScanned({ handled: true, rawBarcode: result.rawBarcode, format: result.format, upc: result.upc, manufacturer: 'Lionel', itemNum: chosen.itemNum, variation: '', notInMaster: true, statusMessage: 'Adding ' + chosen.itemNum + ' manually…' });
                return;
              }
              if (chosen) {
                if (onScanned) onScanned({
                  handled: true,
                  rawBarcode: result.rawBarcode,
                  format: result.format,
                  upc: result.upc,
                  manufacturer: 'Lionel',
                  itemNum: chosen.itemNum,
                  variation: chosen.variation || '',
                  masterItem: chosen,
                  isSet: String(chosen.itemType || '').toLowerCase() === 'set',
                });
              } else {
                if (onCancel) onCancel();
              }
              return;
            }
            if (result.handled) {
              if (result.itemNum) {
                statusEl.textContent = result.statusMessage || 'Detected!';
                statusEl.style.color = result.error ? '#ff9580' : '#a6e87e';
                await new Promise(r => setTimeout(r, 300));
                stopScanning = true;
                // v0.9.640: a Lionel barcode with NO catalog match used to offer a
                // made-up "6-code5" — but on Vision-era boxes the UPC code isn't
                // the catalog number at all. Read the printed label first and
                // prefer what it says (a master hit or the raw printed number).
                let _res = result;
                if (result.notInMaster && result.upc && !_bcRescueTried['nm|' + bc.rawValue]) {
                  _bcRescueTried['nm|' + bc.rawValue] = 1;
                  _setStatus('Barcode has no catalog match — reading the printed label…', '#ffd27d', 30000);
                  const _rr2 = await _bcLabelRescue(video);
                  _bcStickyUntil = 0;
                  if (_rr2 && _rr2.itemNum) { _res = _rr2; _res.rawBarcode = result.rawBarcode; _res.format = result.format; _res.upc = result.upc; }
                }
                // Always double-verify: read the label in the background; warn only if it conflicts.
                const _bgVerify = (_res === result && result.masterItem && !result.notInMaster) ? _bcLabelVerify(video) : null;
                const _ci = { itemNum: _res.itemNum, manufacturer: _res.manufacturer, roadName: (_res.masterItem && _res.masterItem.roadName) || '', description: (_res.masterItem && _res.masterItem.description) || (_res.description || ''), notInMaster: _res.notInMaster, verifiedNote: _res.verifiedNote, verifyPromise: _bgVerify, expectNum: String(_res.itemNum || '').replace(/\D+/g, '') };
                const _bcChoice = await _bcConfirmCard(_ci);
                if (_bcChoice === 'use') { cleanup(); if (onScanned) onScanned(_res); return; }
                if (_bcChoice === 'uselabel') { cleanup(); if (onScanned && _ci._labelResult) onScanned(_ci._labelResult); return; }
                if (_bcChoice === 'manual') { cleanup(); if (onCancel) onCancel(); return; }
                if (_bcChoice === 'cancel') { cleanup(); if (onCancel) onCancel(); return; }
                // v0.9.655: 'Rescan' on a not-in-master card = tier-3 trigger.
                // The user just said the read is wrong — let the AI look at the
                // frame once before dropping them back into the scanner.
                if (_res.notInMaster && typeof _bcAiRescue === 'function' && !_bcRescueTried['ai|' + bc.rawValue]) {
                  _bcRescueTried['ai|' + bc.rawValue] = 1;
                  _setStatus('🤖 Taking a closer look with AI…', '#ffd27d', 45000);
                  const _aiR3 = await _bcAiRescue(video, eraHint, {});
                  _bcStickyUntil = 0;
                  if (_aiR3 && _aiR3.itemNum && _aiR3.itemNum !== _res.itemNum) {
                    const _aiC3 = await _bcConfirmCard(_aiR3);
                    if (_aiC3 === 'use') { cleanup(); if (onScanned) onScanned(_aiR3); return; }
                    if (_aiC3 === 'manual' || _aiC3 === 'cancel') { cleanup(); if (onCancel) onCancel(); return; }
                  }
                }
                cleanup(); openBarcodeScanner(onScanned, onCancel, eraHint); return;
              }
              // v0.9.638: dead-end barcode (unknown prefix / Phase-2 maker / bad
              // length) — the old code closed the scanner silently after a 300ms
              // flash. Instead: try ONE automatic label rescue (OCR the printed
              // item number on this same frame), and if that fails keep the
              // scanner open with a readable, held message.
              if ((result.unknownPrefix || result.phase2) && !_bcRescueTried[bc.rawValue]) {
                _bcRescueTried[bc.rawValue] = 1;
                _bcStickyUntil = 0;
                _setStatus('Barcode doesn\'t identify the item — reading the printed label instead…', '#ffd27d', 30000);
                const _rr = await _bcLabelRescue(video);
                _bcStickyUntil = 0;
                if (_rr && !stopScanning) {
                  stopScanning = true;
                  const _rc = await _bcConfirmCard(_rr);
                  if (_rc === 'use') { cleanup(); if (onScanned) onScanned(_rr); return; }
                  if (_rc === 'manual' || _rc === 'cancel') { cleanup(); if (onCancel) onCancel(); return; }
                  cleanup(); openBarcodeScanner(onScanned, onCancel, eraHint); return;
                }
                if (stopScanning) return;   // user hit Cancel / label button while OCR ran
                // v0.9.655: Tier 3 — barcode dead end AND label OCR failed.
                // Give the AI one look at the same frame before giving up.
                _setStatus('🤖 Taking a closer look with AI…', '#ffd27d', 45000);
                var _aiWhy = {};
                const _aiR = await _bcAiRescue(video, eraHint, _aiWhy);
                _bcStickyUntil = 0;
                if (_aiR && !stopScanning) {
                  stopScanning = true;
                  const _aiC = await _bcConfirmCard(_aiR);
                  if (_aiC === 'use') { cleanup(); if (onScanned) onScanned(_aiR); return; }
                  if (_aiC === 'manual' || _aiC === 'cancel') { cleanup(); if (onCancel) onCancel(); return; }
                  cleanup(); openBarcodeScanner(onScanned, onCancel, eraHint); return;
                }
                if (stopScanning) return;   // user bailed while the AI ran
                _setStatus(_aiWhy.reason === 'quota'
                  ? 'Daily AI photo limit reached — try 📸 "Read the label" up close, or type the number.'
                  : 'Couldn\'t read the label either — try 📸 "Read the label" up close, or type the number.', '#ff9580', 6000);
                await new Promise(r => setTimeout(r, 250));
                continue;
              }
              // Other no-item results: hold the message so it's readable, keep scanning.
              _setStatus(result.statusMessage || 'Barcode read, but no item found — try the label button.', '#ffd27d', 5000);
              await new Promise(r => setTimeout(r, 250));
              continue;
            } else {
              _setStatus(result.statusMessage || ('Unknown barcode: ' + bc.rawValue), '#ffd27d');
            }
          }
        } catch (e) { /* frame failed, continue */ }
        await new Promise(r => setTimeout(r, 120));
      }
    })();
  }

  // ── Decode & route ──
  // Session 167: async because findMasterItems now reads cross-era IDB caches.
  async function decodeBarcode(bc, eraHint) {
    const raw = (bc.rawValue || '').trim();
    const fmt = bc.format;

    // UPC-A: 12 digits
    if ((fmt === 'upc_a' || fmt === 'ean_13') && /^\d{12,13}$/.test(raw)) {
      // Normalize EAN-13 with leading 0 → UPC-A
      const upc12 = raw.length === 13 && raw.startsWith('0') ? raw.substring(1) : raw;
      if (upc12.length !== 12) {
        return { handled: true, error: 'bad_length', statusMessage: 'Non-standard barcode length.' };
      }
      const prefix = upc12.substring(0, 6);
      const info = UPC_PREFIXES[prefix];
      if (info && info.mfr === 'Lionel') {
        const parsed = info.parse(upc12);
        const matches = await findMasterItems(parsed.itemNumCandidates);
        if (matches.length === 1) {
          const master = matches[0];
          return {
            handled: true,
            rawBarcode: raw,
            format: fmt,
            upc: upc12,
            manufacturer: 'Lionel',
            itemNum: master.itemNum,
            variation: master.variation || '',
            masterItem: master,
            statusMessage: 'Found ' + master.itemNum + ' — ' + (master.description || '').substring(0, 40),
            isSet: String(master.itemType || '').toLowerCase() === 'set',
          };
        }
        if (matches.length > 1) {
          // Scanned 5 digits match several items — let the user pick.
          return {
            handled: true,
            rawBarcode: raw,
            format: fmt,
            upc: upc12,
            manufacturer: 'Lionel',
            multipleMatches: true,
            candidates: matches,
            code5: parsed.code5,
            statusMessage: matches.length + ' possible matches — pick the right one',
          };
        }
        // Lionel prefix but not in master — offer manual entry with item# pre-filled
        return {
          handled: true,
          rawBarcode: raw,
          format: fmt,
          upc: upc12,
          manufacturer: 'Lionel',
          itemNum: '6-' + parsed.code5,
          variation: '',
          notInMaster: true,
          statusMessage: 'Lionel item 6-' + parsed.code5 + ' not in our catalog. Adding manually…',
        };
      }
      if (info) {
        // Non-Lionel known manufacturer — Phase 2
        return {
          handled: true,
          rawBarcode: raw,
          format: fmt,
          upc: upc12,
          manufacturer: info.mfr,
          phase2: true,
          statusMessage: info.mfr + ' barcodes come in Phase 2. Type the item# manually.',
        };
      }
      // Unknown prefix entirely
      return {
        handled: true,
        rawBarcode: raw,
        format: fmt,
        upc: upc12,
        manufacturer: 'Unknown',
        unknownPrefix: true,
        statusMessage: 'Unknown barcode prefix ' + prefix + '. Type the item# manually.',
      };
    }

    // Code 128 / Code 39 — likely MTH SKU like "10-1035", "30-1056", "40-1035"
    if ((fmt === 'code_128' || fmt === 'code_39') && /^\d{2}-\d{3,5}(-\d+)?$/.test(raw)) {
      const master = await findMasterItem([raw]);
      if (master) {
        return {
          handled: true,
          rawBarcode: raw,
          format: fmt,
          upc: '',
          manufacturer: 'MTH',
          itemNum: master.itemNum,
          variation: master.variation || '',
          masterItem: master,
          statusMessage: 'Found ' + master.itemNum,
          isSet: String(master.itemType || '').toLowerCase() === 'set',
        };
      }
      return {
        handled: true,
        rawBarcode: raw,
        format: fmt,
        upc: '',
        manufacturer: 'MTH',
        itemNum: raw,
        notInMaster: true,
        statusMessage: 'MTH ' + raw + ' not in catalog. Adding manually…',
      };
    }

    // Unrecognized format / content — keep scanning
    return { handled: false, statusMessage: 'Barcode seen but not recognized — hold steady…' };
  }

  // ── Candidate picker (Session 154) — shown when a scanned 5-digit code
  //    matches multiple master items. Resolves to the chosen master row,
  //    or null if the user cancels. ──
  function showCandidatePicker(candidates, scanResult) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.id = 'barcode-candidate-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';
      var rowsHtml = candidates.map(function(m, idx) {
        var yr   = String(m.yearProd || m.yearMade || '');
        if (/^\d{4}-\d{2}-\d{2}/.test(yr)) yr = yr.slice(0, 4);   // Sheets datetime artifact
        var meta = [_eraLabel(m._era), yr, m.roadName || '', m.itemType || ''].filter(Boolean).map(_bcEsc).join(' &middot; ');
        var desc = _bcEsc(String(m.description || '').substring(0, 70));
        var url  = _bcViewUrl(m);
        return '<div class="bc-cand" data-idx="' + idx + '" '
          + 'style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.8rem;border-radius:10px;'
          + 'background:#222;border:1px solid #444;cursor:pointer;margin-bottom:0.5rem">'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-weight:700;color:#fff;font-size:0.95rem">' + _bcEsc(m.itemNum) + '</div>'
          +   (meta ? '<div style="font-size:0.8rem;color:#aaa;margin-top:0.1rem">' + meta + '</div>' : '')
          +   (desc ? '<div style="font-size:0.78rem;color:#888;margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + desc + '</div>' : '')
          +   (m._descMatch ? '<div style="font-size:0.72rem;color:#e8a020;margin-top:0.1rem">matched in the description — possible reissue</div>' : '')
          +   (m._labelRead ? '<div style="font-size:0.72rem;color:#a6e87e;margin-top:0.1rem">read from the printed label — most likely match</div>' : '')
          + '</div>'
          + '<a href="' + _bcEsc(url) + '" target="_blank" rel="noopener" class="bc-view" '
          +   'style="flex-shrink:0;padding:0.4rem 0.7rem;border-radius:8px;background:#333;border:1px solid #555;'
          +   'color:#9ecbff;font-size:0.78rem;text-decoration:none;white-space:nowrap">View &#8599;</a>'
          + '</div>';
      }).join('');
      // v0.9.638: "None of these" escape hatch. Older boxes (e.g. a 2012 6-30190)
      // share their 5 barcode digits with modern 7-digit reissues that ARE in the
      // master — while the older item itself may not be. Offer the classic-form
      // number so the user isn't forced into a wrong pick or a dead-end Cancel.
      var _noneNum = String((scanResult && scanResult.code5) || '');
      if (_noneNum && /^\d{4,6}$/.test(_noneNum)) _noneNum = '6-' + _noneNum;
      var noneHtml = _noneNum
        ? '<div id="bc-cand-none" style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.8rem;border-radius:10px;'
          + 'background:rgba(58,110,165,0.14);border:1px dashed #3a6ea5;cursor:pointer;margin-bottom:0.5rem">'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-weight:700;color:#cfe3ff;font-size:0.92rem">None of these — my box is ' + _bcEsc(_noneNum) + '</div>'
          +   '<div style="font-size:0.78rem;color:#9ecbff;margin-top:0.1rem">Not in the catalog yet — you\'ll fill in the details manually.</div>'
          + '</div></div>'
        : '';
      overlay.innerHTML = ''
        + '<div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:0.6rem">'
        +   '<div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;text-align:center">Which one did you scan?</div>'
        +   '<div style="color:#aaa;font-size:0.8rem;text-align:center">The barcode ends in <strong style="color:#ffd27d">' + _bcEsc((scanResult && scanResult.code5) || '') + '</strong> &mdash; these items all share those digits. Tap the right one, or use View to check a photo.</div>'
        +   ((scanResult && scanResult.cautionHtml) ? '<div style="color:#ffb27d;font-size:0.8rem;text-align:center">&#9888; ' + _bcEsc(scanResult.cautionHtml) + '</div>' : '')
        +   '<div style="overflow-y:auto;max-height:58vh;margin-top:0.3rem">' + rowsHtml + noneHtml + '</div>'
        +   '<button id="bc-cand-cancel" style="padding:0.8rem;border-radius:10px;border:1px solid #444;background:#222;color:#eee;font-size:0.95rem;font-family:inherit;cursor:pointer">Cancel</button>'
        + '</div>';
      document.body.appendChild(overlay);
      var _noneEl = overlay.querySelector('#bc-cand-none');
      if (_noneEl) _noneEl.addEventListener('click', function() {
        overlay.remove();
        resolve({ __notInList: true, itemNum: _noneNum });
      });
      overlay.querySelectorAll('.bc-cand').forEach(function(el) {
        el.addEventListener('click', function() {
          var idx = parseInt(el.getAttribute('data-idx'), 10);
          overlay.remove();
          resolve(candidates[idx] || null);
        });
      });
      // View links open in a new tab without selecting the row.
      overlay.querySelectorAll('.bc-view').forEach(function(a) {
        a.addEventListener('click', function(ev) { ev.stopPropagation(); });
      });
      overlay.querySelector('#bc-cand-cancel').addEventListener('click', function() {
        overlay.remove();
        resolve(null);
      });
    });
  }

  // ── First-time explainer ──
  function showExplainer() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
      overlay.innerHTML = `
        <div style="max-width:460px;background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:14px;padding:1.5rem;color:var(--text,#eee);font-family:var(--font-body,sans-serif)">
          <div style="font-size:1.1rem;font-weight:600;margin-bottom:0.8rem">📷 Camera access needed</div>
          <div style="font-size:0.9rem;line-height:1.5;color:var(--text-mid,#bbb);margin-bottom:1rem">
            We'll use your phone or laptop camera to read barcodes on modern boxes so you can add items without typing.
            <br><br>
            <strong style="color:var(--text,#eee)">Your camera stays on your device.</strong> Only the decoded barcode number is used — nothing is uploaded except the item lookup against the master catalog.
          </div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end">
            <button id="bc-exp-cancel" style="padding:0.6rem 1rem;border-radius:8px;border:1px solid var(--border,#444);background:transparent;color:var(--text-dim,#888);cursor:pointer">Cancel</button>
            <button id="bc-exp-ok" style="padding:0.6rem 1.2rem;border-radius:8px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;cursor:pointer">Enable Camera</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#bc-exp-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#bc-exp-ok').onclick   = () => { overlay.remove(); resolve(true);  };
    });
  }

  // Expose globally
  window.openBarcodeScanner = openBarcodeScanner;

  // ══════════════════════════════════════════════════════════════════
  // Session 168: OCR LABEL SCANNER
  //
  // Lazy-loads Tesseract.js from CDN on first use, opens the camera with
  // a simple "Capture" button, OCRs the full frame, extracts item-number
  // patterns, looks them up cross-era via findMasterItems, returns the
  // best match. No barcode required — works on any printed label.
  //
  // Public API: window.openLabelScanner(onFound, onCancel)
  //   onFound(result) — result has same shape as openBarcodeScanner:
  //     { handled, itemNum, variation, masterItem, statusMessage, ... }
  //   onCancel() — user dismissed the scanner without picking.
  // ══════════════════════════════════════════════════════════════════
  var _tesseractLoadingPromise = null;
  function _ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (_tesseractLoadingPromise) return _tesseractLoadingPromise;
    _tesseractLoadingPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.async = true;
      s.onload = function() { resolve(window.Tesseract); };
      s.onerror = function() { reject(new Error('Failed to load Tesseract.js')); };
      document.head.appendChild(s);
    });
    return _tesseractLoadingPromise;
  }

  // Session 169: tightened item-number patterns to require KNOWN
  // manufacturer prefixes. The previous version matched any \d{2}-\d{3,5}
  // group which caught dates, prices, page numbers, and fragments of UPCs.
  // Each pattern now requires a real prefix that maps to a real catalog.
  var ITEM_PATTERNS = [
    // RMT — always starts with the RMT marker
    { re: /\bRMT[\s\-]\d{3,5}(?:[\s\-]\d{1,4})?\b/g,         mfr: 'RMT' },
    // K-Line — covers K90002, K643401, K-7502, K-26002, K617-1055, K70-7507,
    //   K4650- 40001 (dash+space), K6434A (trailing letter), K-3810-09135 (two-dash).
    //   Trailing (?!...\d{2}[A-Za-z]) rejects proof-of-purchase codes like K3400-98DC.
    { re: /\bK(?:[\s\-]?\d{2,6})(?:[\s\-]+\d{3,6})*[A-Z]{0,2}\b(?![\s\-]*\d{2}[A-Za-z])/gi, mfr: 'K-Line' },
    // Lionel — starts with "6-" or "6 ", followed by 4-6 digits
    { re: /\b6[\s\-]\d{4,6}\b/g,                                  mfr: 'Lionel' },
    // MTH — known scale-line prefixes 10/20/30/40/50/60/70/80/90, then 4-5 digits, optional -N or trailing letter
    { re: /\b(?:1[01]|[2-9]0)[\s\-]\d{4,5}(?:-\d{1,3}|[A-Za-z])?\b/g, mfr: ''       },
    // Menards Gold Line — 275-XXXX or 279-XXXX (per Brad's samples)
    { re: /\b(?:275|279)[\s\-]\d{4}\b/g,                          mfr: 'Menards'},
    // Postwar/vintage bare "No. ####" (v0.9.638) — postwar Lionel boxes print
    // "SCENIC SET No. 920", "NO. 6464-425", "No. 2343W" with no "Item" wording.
    // Requires the period after No so plain English "no 4" never matches.
    // 2-5 digits + optional -suffix + optional trailing letters (2046W, 6464-425).
    { re: /\b[Nn][Oo]\.\s{0,2}([0-9]{2,5}(?:-[0-9]{1,4})?(?:[A-Z]{1,3})?)\b/g, mfr: '', cap: 1 },
    // Generic item-label fallback (Session 180; broadened 2026-07-01) — any box that
    // prints an explicit item label: Atlas "Item #0526-1", Lionel dealer "ITEM:611437",
    // "Item No. 123". Requires a #/:/No separator (so it never grabs "Item UPC").
    // Listed LAST so a specific-maker match above wins the de-dupe.
    { re: /\b(?:Item|ID)\s*(?:No\.?|#|:)\s*([0-9][0-9A-Za-z]*(?:-[0-9A-Za-z]+)*)\b/gi, mfr: '', cap: 1 },
  ];
  // Session 169: strip UPC-shaped digit runs before extracting candidates.
  // UPCs are 12 or 13 digits, often printed with single-digit spacing
  // ("0 23922 36814 0"). Their middle 5 digits often look like a valid
  // item number to a loose regex, so we blank them out.
  function _stripUPCs(text) {
    if (!text) return '';
    // 12-digit (UPC-A) with optional spaces between digits
    text = text.replace(/\b\d[\s]?\d{5}[\s]?\d{5}[\s]?\d\b/g, ' ');
    // 13-digit (EAN-13)
    text = text.replace(/\b\d[\s]?\d{6}[\s]?\d{5}[\s]?\d\b/g, ' ');
    // Plain 10+ consecutive digits (continuous strings)
    text = text.replace(/\d{10,}/g, ' ');
    return text;
  }
  function _extractItemNumberCandidates(text) {
    var clean = _stripUPCs(text || '');
    var out = [];
    var seen = {};
    ITEM_PATTERNS.forEach(function(p) {
      var m;
      // Reset lastIndex because the regex objects are reused.
      p.re.lastIndex = 0;
      while ((m = p.re.exec(clean)) !== null) {
        var raw0 = (p.cap && m[p.cap]) ? m[p.cap] : m[0];
        var hit = raw0.replace(/[\s\-]+/g, '-').toUpperCase();
        if (seen[hit]) continue;
        seen[hit] = 1;
        out.push({ raw: hit, mfr: p.mfr });
      }
    });
    // Anchored modern-Lionel bare 7-digit catalog number (e.g. 2133031, 2133032).
    // Gated on Lionel context (incl. VisionLine sub-brand) so cluttered dealer cartons don't
    // spawn stray candidates. (Brad decision 2026-07-01: "Anchored" approach.)
    if (/\bLEGACY\b|\bLIONEL\b|4LIONEL|lionel\.com|\bVISIONLINE\b|\bVISION\b/i.test(clean)) {
      var _l7, _re7 = /\b\d{7}\b/g;
      while ((_l7 = _re7.exec(clean)) !== null) {
        if (!seen[_l7[0]]) { seen[_l7[0]] = 1; out.push({ raw: _l7[0], mfr: 'Lionel' }); }
      }
    }
    // Weaver / Quality Craft G-series (G1088-S) + U-series (U2956SD) catalog #s.
    // Gated on Weaver context. Boxes list several variants (2-rail/3-rail/with-sound)
    // -> each becomes a candidate so the user picks the checked one. (Brad 2026-07-01.)
    if (/\bweaver\b|quality\s+craft/i.test(clean)) {
      var _wre = /\b(?:G\d{3,4}(?:-[A-Z]{1,3})?|U\d{4}[A-Z]{2})\b/g, _wm;
      while ((_wm = _wre.exec(clean)) !== null) {
        var _wh = _wm[0].toUpperCase();
        if (!seen[_wh]) { seen[_wh] = 1; out.push({ raw: _wh, mfr: 'Weaver' }); }
      }
    }
    // RMT / Ready Made Trains / American Railroad Legends (ex-Aristo-Craft) catalog #s.
    // Gated on RMT/ARL context. Leading catalog number is the item number; the
    // #road-number (#12453) stays in the description. Master convention (Brad
    // 2026-07-01): store with an "RMT-" prefix, DROP a trailing letter (96422A ->
    // RMT-96422), KEEP a -numeric suffix (92433-3 -> RMT-92433-3). Matches the 397
    // existing RMT-O rows so the catalog lookup lines up. No regex lookbehind
    // (older mobile Safari lacks it) - check the prior char in JS.
    if (/\bRMT\b|ready\s+made\s+trains|american\s+railroad\s+legends|\bBOPPER\b|\bBEEP\b|aristo/i.test(clean)) {
      var _rre = /\b(9\d{4})([A-Z])?((?:-\d{1,3})?)\b/g, _rm;
      while ((_rm = _rre.exec(clean)) !== null) {
        if (_rm.index > 0 && clean.charAt(_rm.index - 1) === '#') continue;   // road number
        var _rh = ('RMT-' + _rm[1] + _rm[3]).toUpperCase();
        if (!seen[_rh]) { seen[_rh] = 1; out.push({ raw: _rh, mfr: 'RMT' }); }
      }
    }
    // Williams Electric Trains / Williams by Bachmann catalog + stock numbers.
    // Gated strictly on Williams tokens — never bare "Electric Trains", because
    // MTH's full company name is "M.T.H. Electric Trains". (Brad 2026-07-01: capture
    // ONLY the true catalog/stock number.)
    if (/\bWILLIAMS\b|by\s+bachmann|williamstrains|\bW\s+ELECTRIC\s+TRAINS\b/i.test(clean)) {
      // STOCK # CAB120 / STOCK NO. 83212 / STOCK # #3212  (letter-prefixed or plain)
      var _wsr = /\bSTOCK\s*(?:#|NO\.?|NUMBER)\s*#?\s*([A-Z]{0,4}\d{2,6})\b/gi, _wsm;
      while ((_wsm = _wsr.exec(clean)) !== null) {
        var _wsh = _wsm[1].toUpperCase();
        if (!seen[_wsh]) { seen[_wsh] = 1; out.push({ raw: _wsh, mfr: 'Williams' }); }
      }
      // "NO. 5601" / "# 2612-D" — 3-4 digit catalog, optional -letter suffix.
      // The leading (CAB) capture lets us SKIP road numbers like "CAB # 2368".
      // 2-digit series numbers (WAL #60 / CLASSIC FREIGHT CAR NO.60) fail \\d{3,4}
      // on purpose — those stay in the description.
      var _wnr = /(\bCAB\b\s*)?(?:NO\.?|#)\s*(\d{3,4}(?:-[A-Z]{1,2})?)\b/gi, _wnm;
      while ((_wnm = _wnr.exec(clean)) !== null) {
        if (_wnm[1]) continue;            // CAB # #### -> road number, keep in description
        var _wnh = _wnm[2].toUpperCase();
        if (!seen[_wnh]) { seen[_wnh] = 1; out.push({ raw: _wnh, mfr: 'Williams' }); }
      }
    }
    if (out.some(function (c) { return !c.mfr; })) {
      var g = _mfrFromKeywords(clean);
      if (g) out.forEach(function (c) { if (!c.mfr) c.mfr = g; });
    }
    return out;
  }

  // Session 180: guess the maker from words printed on the box, for candidates
  // that came from the generic "Item #" catch (which carries no maker).
  function _mfrFromKeywords(t) {
    t = String(t || '');
    if (/\bATLAS\b/i.test(t)) return 'Atlas';
    if (/\bLIONEL\b/i.test(t)) return 'Lionel';
    if (/\bMTH\b|M\.?T\.?H\./i.test(t)) return 'MTH';
    if (/\bMENARDS\b/i.test(t)) return 'Menards';
    if (/\bK-?LINE\b/i.test(t)) return 'K-Line';
    if (/\bWILLIAMS\b/i.test(t)) return 'Williams';
    if (/\bWEAVER\b|quality\s+craft|bev-?bel/i.test(t)) return 'Weaver';
    if (/\bRMT\b|READY\s*MADE/i.test(t)) return 'RMT';
    return '';
  }

  async function openLabelScanner(onFound, onCancel, eraHint) {
    var Tesseract;
    var preflightMsg = 'Loading scanner (one-time)…';
    var loaderOverlay = _makeBusyOverlay(preflightMsg);
    try {
      Tesseract = await _ensureTesseract();
    } catch (e) {
      loaderOverlay.remove();
      showToast && showToast('Could not load OCR engine. Check your connection.', 4000, true);
      if (onCancel) onCancel();
      return;
    }
    loaderOverlay.remove();

    // Build camera UI — simpler than the barcode loop: one Capture button.
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        },
        audio: false
      });
    } catch (e) {
      showToast && showToast('Camera permission denied.', 4000, true);
      if (onCancel) onCancel();
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'label-scanner-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:1rem;gap:0.7rem;overflow-y:auto';
    overlay.innerHTML = ''
      + '<div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;position:relative;width:100%;max-width:520px;text-align:center">📷 Scan Item Label<button id="lbl-help" type="button" style="position:absolute;right:0;top:-4px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer">?</button></div>'
      + '<div style="position:relative;width:100%;max-width:520px">'
      + '  <video id="lbl-video" autoplay playsinline muted style="width:100%;max-height:46vh;object-fit:contain;border-radius:12px;background:#000"></video>'
      + '  <div style="position:absolute;inset:8% 12%;border:2px dashed rgba(255,255,255,0.6);border-radius:10px;pointer-events:none"></div>'
      + '</div>'
      + '<div id="lbl-controls" style="display:flex;gap:0.6rem;width:100%;max-width:520px;align-items:center;justify-content:center">'
      +   '<button id="lbl-torch" type="button" style="display:none;padding:0.5rem 0.9rem;border-radius:9px;border:1px solid #555;background:transparent;color:#ddd;font-size:0.85rem;cursor:pointer">🔦 Light</button>'
      +   '<div id="lbl-zoomwrap" style="display:none;flex:1;max-width:240px;align-items:center;gap:0.4rem">'
      +     '<span style="color:#aaa;font-size:0.78rem">Zoom</span>'
      +     '<input id="lbl-zoom" type="range" style="flex:1;accent-color:#e8401c">'
      +   '</div>'
      + '</div>'
      + '<div id="lbl-status" style="color:#ccc;font-size:0.85rem;text-align:center;min-height:1.4em">Aim at the item-number label — held right-side up — then tap Capture.</div>'
      + '<div style="display:flex;gap:0.6rem;width:100%;max-width:520px">'
      + '  <button id="lbl-cancel" style="flex:1;padding:0.75rem;border-radius:9px;border:1.5px solid #555;background:transparent;color:#ccc;font-family:var(--font-head,sans-serif);font-size:0.9rem;cursor:pointer">Cancel</button>'
      + '  <button id="lbl-capture" style="flex:2;padding:0.85rem;border-radius:9px;border:none;background:var(--accent,#e8401c);color:#fff;font-family:var(--font-head,sans-serif);font-size:1rem;font-weight:700;cursor:pointer">📸 Capture</button>'
      + '</div>';
    document.body.appendChild(overlay);
    var video = document.getElementById('lbl-video');
    video.srcObject = stream;
    await new Promise(function(r) { video.addEventListener('loadedmetadata', r, { once: true }); });

    // Camera tuning: continuous focus, torch button, zoom slider (capability-gated) — sharper OCR frames.
    try {
      var _lblTrack = stream.getVideoTracks()[0];
      var _lblCaps = (_lblTrack && _lblTrack.getCapabilities) ? _lblTrack.getCapabilities() : {};
      if (_lblCaps.focusMode && _lblCaps.focusMode.indexOf('continuous') >= 0) {
        try { await _lblTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
      }
      var _lblTorch = document.getElementById('lbl-torch');
      if (_lblTorch && _lblCaps.torch) {
        _lblTorch.style.display = '';
        var _lblTorchOn = false;
        _lblTorch.onclick = async function(){ _lblTorchOn = !_lblTorchOn; try { await _lblTrack.applyConstraints({ advanced: [{ torch: _lblTorchOn }] }); _lblTorch.style.background = _lblTorchOn ? '#e8a020' : 'transparent'; } catch (e) {} };
      }
      var _lblZoomWrap = document.getElementById('lbl-zoomwrap');
      var _lblZoom = document.getElementById('lbl-zoom');
      if (_lblZoomWrap && _lblZoom && _lblCaps.zoom) {
        _lblZoomWrap.style.display = 'flex';
        _lblZoom.min = _lblCaps.zoom.min; _lblZoom.max = _lblCaps.zoom.max; _lblZoom.step = _lblCaps.zoom.step || 0.1;
        try { _lblZoom.value = (_lblTrack.getSettings && _lblTrack.getSettings().zoom) || _lblCaps.zoom.min; } catch (e) {}
        _lblZoom.oninput = async function(){ try { await _lblTrack.applyConstraints({ advanced: [{ zoom: parseFloat(_lblZoom.value) }] }); } catch (e) {} };
      }
    } catch (e) {}

    function cleanup() {
      try { stream.getTracks().forEach(function(t){ t.stop(); }); } catch (e) {}
      if (overlay && overlay.isConnected) overlay.remove();
    }
    var statusEl = document.getElementById('lbl-status');
    document.getElementById('lbl-cancel').onclick = function() { cleanup(); if (onCancel) onCancel(); };
    var _lblHelp = document.getElementById('lbl-help'); if (_lblHelp) _lblHelp.onclick = function(){ _bcHelpPanel('label'); };
    document.getElementById('lbl-capture').onclick = async function() {
      var captureBtn = this;
      captureBtn.disabled = true;
      captureBtn.textContent = 'Reading…';
      statusEl.textContent = 'Reading text from the label — 3-5 seconds…';
      // Snapshot the current frame.
      var canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      try {
        // Crop to the dashed guide (center 76% x 84%) so background noise drops.
        var sx = Math.floor(canvas.width * 0.12);
        var sy = Math.floor(canvas.height * 0.08);
        var sw = canvas.width  - 2 * sx;
        var sh = canvas.height - 2 * sy;
        var crop = document.createElement('canvas');
        crop.width = sw; crop.height = sh;
        crop.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        var ocr = await Tesseract.recognize(_bcPreprocessForOCR(crop), 'eng', {
          // No logger to keep things quiet; default progress prints to console.
        });
        var text = (ocr && ocr.data && ocr.data.text) || '';
        var cands = _extractItemNumberCandidates(text);
        if (!cands.length && typeof _bcAiRescue === 'function') {
          // v0.9.655: Tier 3 — OCR found no item number at all. The AI gets
          // the captured frame before we fall back to description-only.
          statusEl.textContent = '🤖 Taking a closer look with AI…';
          var _aiWhyL = {};
          var _aiRL = await _bcAiRescue(crop, eraHint, _aiWhyL);
          if (_aiRL) {
            var _aiCL = await _bcConfirmCard(_aiRL);
            if (_aiCL === 'use') { cleanup(); if (onFound) onFound(_aiRL); return; }
            if (_aiCL === 'manual' || _aiCL === 'cancel') { cleanup(); if (onCancel) onCancel(); return; }
            captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.';
            return;
          }
          if (_aiWhyL.reason === 'quota') {
            statusEl.textContent = 'Daily AI photo limit reached — hold the label right-side up, fill the dashed box, then Capture again.';
            captureBtn.disabled = false;
            captureBtn.textContent = '📸 Try again';
            return;
          }
        }
        if (!cands.length) {
          // No catalog number on the box (common on Weaver/Quality Craft freight,
          // which print only a description + road number). Offer the guessed
          // description with a BLANK item number so the user can add/assign it.
          var _dOnly = _bcDescriptionGuess(text, null);
          if (_dOnly && !_bcLooksLikeWords(_dOnly)) _dOnly = '';   // v0.9.640: never offer letter-salad
          if (_dOnly && _dOnly.replace(/[^a-z0-9]/gi, '').length >= 5) {
            var _rd = { handled: true, itemNum: '', variation: '', notInMaster: true, noItemNum: true, manufacturer: _mfrFromKeywords(text) || '', labelDescription: _dOnly, description: _dOnly, statusMessage: 'No item number on the label — using the description' };
            var _cd = await _bcConfirmCard(_rd);
            if (_cd === 'use') { cleanup(); if (onFound) onFound(_rd); }
            else if (_cd === 'manual' || _cd === 'cancel') { cleanup(); if (onCancel) onCancel(); }
            else { captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.'; }
            return;
          }
          statusEl.textContent = 'No item number found — hold the label right-side up, fill the dashed box, add light, hold steady, then Capture again.';
          captureBtn.disabled = false;
          captureBtn.textContent = '📸 Try again';
          return;
        }
        // If the box lists several variant numbers (e.g. Weaver 2-rail / 3-rail /
        // with-sound), let the user pick which one is actually checked.
        var best;
        if (cands.length > 1) {
          var _picked = await _bcPickCandidate(cands);
          if (!_picked) { captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.'; return; }
          best = _picked;
        } else {
          best = cands[0];
        }
        var raw = best.raw;
        var labelDesc = _bcDescriptionGuess(text, raw);
        if (labelDesc && !_bcLooksLikeWords(labelDesc)) labelDesc = '';   // v0.9.640
        // Generate match-candidate variants: as-is, without 6- prefix, with 6- prefix.
        var lookupCands = [raw];
        if (raw.indexOf('6-') === 0) lookupCands.push(raw.substring(2));
        else if (/^\d/.test(raw))   lookupCands.push('6-' + raw);
        // Session 169: OCR mode uses EXACT match only (no fuzzy last-5 fallback)
        // because OCR misreads turn into false matches via fuzzy. Barcode flow
        // still uses fuzzy because UPCs map cleanly to Lionel item numbers.
        // v0.9.640: matches from EVERY era + modern reissues quoted in
        // descriptions, so the user can pick original vs remake.
        var hits = await _findMasterItemsAllEras(lookupCands);
        var _seenH = {};
        hits.forEach(function (h) { _seenH[(h.itemNum || '') + '|' + (h.variation || '') + '|' + (h._tab || '') + '|' + (h._era || '')] = 1; });
        var _reissues = await _findReissueByDesc(raw, _seenH);
        if (_reissues.length) hits = hits.concat(_reissues);
        var _eraMismatch = !!(eraHint && hits.length && hits.every(function (h) { return h._era && h._era !== eraHint; }));
        if (hits.length === 1) {
          var m = hits[0];
          var _r1 = { handled: true, itemNum: m.itemNum, variation: m.variation || '', masterItem: m, manufacturer: best.mfr, roadName: (m.roadName || ''), description: (m.description || ''), eraTag: _eraLabel(m._era), cautionNote: _eraMismatch ? ('This matches a ' + _eraLabel(m._era) + ' item, but you\'re adding in a different era. Reissue boxes reuse the original artwork — an embossed stamp near LIONEL or any barcode means it\'s a modern remake.') : '', statusMessage: 'Found ' + m.itemNum + ' — ' + (m.description || '').substring(0, 40) };
          var _c1 = await _bcConfirmCard(_r1);
          if (_c1 === 'use') { cleanup(); if (onFound) onFound(_r1); }
          else if (_c1 === 'manual' || _c1 === 'cancel') { cleanup(); if (onCancel) onCancel(); }
          else { captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.'; }
          return;
        }
        if (hits.length > 1) {
          // Show the candidate picker (reuse showCandidatePicker if available).
          cleanup();
          var chosen = (typeof showCandidatePicker === 'function')
            ? await showCandidatePicker(hits, { code5: raw, cautionHtml: _eraMismatch ? 'None of these matches the era you\'re adding in — if the box has a barcode or an embossed stamp near LIONEL, it\'s a modern remake.' : '' })
            : hits[0];
          if (chosen && chosen.__notInList) {
            if (onFound) onFound({ handled: true, itemNum: chosen.itemNum, variation: '', notInMaster: true, manufacturer: best.mfr, labelDescription: labelDesc, description: labelDesc, statusMessage: 'Adding ' + chosen.itemNum + ' manually…' });
            return;
          }
          if (chosen) {
            if (onFound) onFound({
              handled: true,
              itemNum: chosen.itemNum,
              variation: chosen.variation || '',
              masterItem: chosen,
              manufacturer: best.mfr,
              statusMessage: 'Found ' + chosen.itemNum,
            });
          } else if (onCancel) {
            onCancel();
          }
          return;
        }
        // No hit in master — offer raw candidate + label description for confirm.
        var _r0 = { handled: true, itemNum: raw, variation: '', notInMaster: true, manufacturer: best.mfr, labelDescription: labelDesc, description: labelDesc, statusMessage: 'Detected ' + raw + ' — not in our catalog, adding manually…' };
        var _c0 = await _bcConfirmCard(_r0);
        if (_c0 === 'use') { cleanup(); if (onFound) onFound(_r0); }
        else if (_c0 === 'manual' || _c0 === 'cancel') { cleanup(); if (onCancel) onCancel(); }
        else { captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.'; }
      } catch (e) {
        statusEl.textContent = 'Scan failed: ' + (e && e.message ? e.message : 'unknown error');
        captureBtn.disabled = false;
        captureBtn.textContent = '📸 Try again';
      }
    };
  }

  // ── Description guess from OCR label text (Session 180) ──
  // Pulls the meaningful words off the label (minus the item#, UPC digit-runs,
  // prices and noise) as an EDITABLE starting description for items not yet in
  // the catalog. Rough by design — always shown for confirmation, never trusted.
  // Boilerplate / brand / feature-list / legal lines — never the road-name or
  // car-type we want in a description. Whole line is skipped if it matches.
  var _BC_REJECT = /trademark|reproduced|under\s*licen|licensed|all\s*rights|patent|copyright|©|manufactured|made\s+(and|in)\b|litho|standards?\s+and\s+spec|gateway|corporation|model\s+railroad|accessories|\bfeatures?\b|for\s+ages|\bages?\s+\d|and\s+up\b|assembled|electric\s+trains|rail\s?king|www\.|https?:|\.com\b|set\s+contains|wheels?\s+and\s+axles|die-?cast|couplers?|\bcurves?\b|wheel\s+sets?|needlepoint|paint\s+schemes?|abs\s+bod|scale\s+dimension|(set|unit|car)\s+measures|fast-?angle|operates?\s+on|handrails|brake\s+wheels|proto-?sound|flywheel|transformers|electronic\s+(horn|reverse)|headlight|\bdcru\b|baked\s+enamel|stamped\s+steel|brass\s+trim|\bnickel\b|\bweighs\b|dimensions?:|each\s+car|sliding\s+car\s+door|mounting\s+pad|kadee|qty\s+per\s+case|proof\s+of\s+purchase|rolling\s+stock|master\s+(passenger|line|series|rolling)|premier\s+(locomotive|passenger|rolling)|founders?\s+series|motive\s+power|streamlighting|fully\s+furnished|furnished\s+interior|passenger\s+figures?|extruded\s+alum|legacy\s+(control|railsounds|and\s+bluetooth)|railsounds|electro-?\s?coupler|bluetooth|\blvc\b|minimum\s+curve|sprung\s+trucks|opening\s+doors|all\s+new\s+road|activate\s+sounds|lionel\s+vision\s+line|powerhouse|circuit\s+breaker|over-?current|throttle|whistle\s+steam|fan-?driven|watts?\s+of\s+ac|quality\s+craft|weaver\s+models|door\s+guides|boxcar\s+body|brake\s?wheel|1[\s\-]?800|metal\s+wheels|\baxles\b|layout\s+dimensions|track\s+requirements|pack\s+includes|\bincludes\s*:|\(\d+\s+sections?\)/i;

  // v0.9.640: does OCR output look like real words (vs letter-salad from a
  // failed read, e.g. off a computer screen)? Most letter-tokens must be
  // 3+ chars and contain a vowel.
  function _bcLooksLikeWords(s) {
    var toks = String(s || '').split(/\s+/).filter(Boolean);
    if (!toks.length) return false;
    var letter = toks.filter(function (t) { return /^[A-Za-z][A-Za-z'&.\-]*$/.test(t); });
    var wordy = letter.filter(function (t) { return t.length >= 3 && /[aeiouy]/i.test(t); });
    return letter.length >= 3 && wordy.length >= Math.ceil(letter.length * 0.6) && letter.length >= toks.length * 0.45;
  }
  function _bcDescGood(l) {
    if (!l) return false;
    if (_BC_REJECT.test(l)) return false;
    var _tl = l.trim().toLowerCase().replace(/[^a-z0-9& ]/g,'').replace(/\s+/g,' ').trim();
    if (/^(atlas|lionel|mth|k-?line|williams|weaver|rmt|menards|locomotive|locomotives|aluminum|heavyweights?|streamlighting|premier|classic|o gauge|o scale|expansion pack|proof of purchase|visionline)$/.test(_tl)) return false;
    if (l.trim().length <= 22 && /^[\[(]?\s*\d\s*[- ]?\s*rail\b[\s\w\/]*[\])]?$/i.test(l.trim())) return false;
    if (/^#\s*\d{1,6}$/.test(l.trim())) return true;   // bare road-number line (e.g. "#357") kept for the description
    var letters = (l.match(/[a-z]/gi) || []).length;
    var digits = (l.match(/\d/g) || []).length;
    return letters >= 4 && letters >= digits && !/^\$/.test(l) && l.length <= 60;
  }

  function _bcDescriptionGuess(text, itemNumRaw) {
    if (!text) return '';
    var t = _stripUPCs(String(text));
    var numRe = null;
    if (itemNumRaw) { try { numRe = new RegExp(String(itemNumRaw).replace(/[-\s]/g, '[-\\s]?'), 'gi'); } catch (e) {} }
    function clean(l) {
      if (numRe) { numRe.lastIndex = 0; l = l.replace(numRe, ' '); }
      return l.replace(/\bItem\s*(No\.?|#)?/gi, ' ')
              .replace(/for\s+ages\s+\d+\s+to\s+adult/gi, ' ')
              .replace(/for\s+ages\s+\d+\s*(and\s+up)?/gi, ' ')
              .replace(/for\s+\d+\s+years?\s+or\s+older/gi, ' ')
              .replace(/\bto\s+adult\b/gi, ' ')
              .replace(/\b[0-9]\s*-?\s*rail\b/gi, ' ')
              .replace(/qty\s+per\s+case.*$/gi, ' ')
              .replace(/www\.[^\s]+|https?:\/\/[^\s]+/gi, ' ')
              .replace(/\S*\/\S+/g, ' ')
              .replace(/\S+\.(webp|jpe?g|png|gif|html?|php|com|net|org)\b/gi, ' ')
              .replace(/1[\s\-]?800[\s\-][A-Z0-9\-]+/gi, ' ')
              .replace(/[™®]/g, '')
              .replace(/[|_~`^]+/g, ' ')
              .replace(/^[\s\-–—:]+/, '').replace(/\s+/g, ' ').trim();
    }
    var lines = t.split(/[\n\r]+/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); });

    // Find the line carrying the item number (or an "Item No/#" label).
    var itemIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if ((itemNumRaw && lines[i].toUpperCase().indexOf(String(itemNumRaw).toUpperCase()) >= 0) ||
          /\bItem\s*(No\.?|#)/i.test(lines[i])) { itemIdx = i; break; }
    }

    var chosen = [];
    function tryAdd(idx) {
      if (idx < 0 || idx >= lines.length) return false;
      var cl = clean(lines[idx]);
      if (_bcDescGood(cl)) { chosen.push({ idx: idx, txt: cl }); return true; }
      return false;
    }
    if (itemIdx >= 0) {
      tryAdd(itemIdx);                       // same line (Atlas / Lionel: number + desc together)
      var up = itemIdx - 1, mu = 0;          // description usually sits just ABOVE the item line
      while (up >= 0 && chosen.length < 4) { if (tryAdd(up)) mu = 0; else { mu++; if (mu >= 2) break; } up--; }
      var dn = itemIdx + 1, md = 0;          // subtitle sometimes sits just BELOW
      while (dn < lines.length && chosen.length < 4) { if (tryAdd(dn)) md = 0; else { md++; if (md >= 2) break; } dn++; }
    }
    if (!chosen.length) {
      // Fallback: longest good lines anywhere on the label.
      lines.forEach(function (l, idx) { var cl = clean(l); if (_bcDescGood(cl)) chosen.push({ idx: idx, txt: cl }); });
      chosen.sort(function (a, b) { return b.txt.length - a.txt.length; });
      chosen = chosen.slice(0, 3);
    }
    chosen.sort(function (a, b) { return a.idx - b.idx; });   // reading order
    var seen = {}, out = [];
    chosen.forEach(function (o) { var k = o.txt.toLowerCase().replace(/[^a-z0-9]/g, ''); if (k && !seen[k]) { seen[k] = 1; out.push(o.txt); } });
    return out.join(' - ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // ── Confirm-before-fill card (Session 180) ── resolves 'use' | 'rescan' | 'manual'
  // Variant picker (2026-07-01): when a label lists several item numbers (Weaver
  // 2-rail/3-rail/with-sound variants), show them all so the user taps the one that
  // is actually checked. Resolves to the chosen {raw,mfr} candidate, or null.
  function _bcPickCandidate(cands) {
    return new Promise(function (resolve) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:1rem';
      var rows = cands.map(function (c, i) {
        return '<button data-i="' + i + '" style="display:block;width:100%;text-align:left;margin-top:8px;padding:12px;border-radius:10px;border:1px solid var(--border,#444);background:#222;color:var(--text,#fff);font-family:var(--font-mono);font-size:1.05rem;font-weight:700;cursor:pointer">'
          + _bcEsc(c.raw) + (c.mfr ? ' <span style="font-size:0.72rem;color:var(--text-dim,#999);font-weight:400">' + _bcEsc(c.mfr) + '</span>' : '') + '</button>';
      }).join('');
      d.innerHTML = '<div style="width:100%;max-width:420px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:16px;padding:18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif)">'
        + '<div style="font-size:0.95rem;font-weight:600;margin-bottom:4px">Which one is checked on the box?</div>'
        + '<div style="font-size:0.78rem;color:var(--text-dim,#999);margin-bottom:6px">The label lists more than one number (2-rail / 3-rail / with sound). Tap the one that matches your item.</div>'
        + rows
        + '<button data-i="cancel" style="display:block;width:100%;margin-top:12px;padding:10px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);cursor:pointer">Cancel</button>'
        + '</div>';
      d.addEventListener('click', function (e) {
        var t = e.target; while (t && t !== d && !(t.getAttribute && t.getAttribute('data-i'))) t = t.parentNode;
        var v = t && t.getAttribute && t.getAttribute('data-i'); if (v === null || v === undefined) return;
        d.remove(); resolve(v === 'cancel' ? null : cands[parseInt(v, 10)] || null);
      });
      document.body.appendChild(d);
    });
  }

  function _bcConfirmCard(info) {
    return new Promise(function (resolve) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
      var num = _bcEsc(info.itemNum || ''), mfr = _bcEsc(info.manufacturer || ''), desc = _bcEsc(info.description || '');
      d.innerHTML = '<div style="width:100%;max-width:420px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:16px;padding:18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif)">'
        + '<div style="font-size:0.78rem;color:var(--accent2,#c9922a);font-weight:600;margin-bottom:8px">' + (info.noItemNum ? 'No item number on the label \u2014 add with this description?' : (info.notInMaster ? 'Detected \u2014 not in your catalog' : 'Found it \u2014 use this?')) + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;color:var(--accent,#e8401c)">' + num + (mfr ? ' <span style="font-size:0.72rem;color:var(--text-dim,#999);font-weight:400">' + mfr + '</span>' : '') + (info.eraTag ? ' <span style="font-size:0.72rem;color:#9ecbff;font-weight:400">' + _bcEsc(info.eraTag) + '</span>' : '') + '</div>'
        + (info.roadName ? '<div style="font-size:0.95rem;color:var(--text,#fff);font-weight:600;margin-top:5px">' + _bcEsc(info.roadName) + '</div>' : '')
        + (desc ? '<div style="font-size:0.9rem;color:var(--text-mid,#ccc);margin-top:6px;line-height:1.4">' + desc + '</div>' : '<div style="font-size:0.8rem;color:var(--text-dim,#999);margin-top:6px">No description read from the label.</div>')
        + (info.notInMaster && info.description ? '<div style="font-size:0.7rem;color:var(--text-dim,#999);margin-top:5px">read from the label \u2014 you can edit it in the next steps.</div>' : '')
        + (info.cautionNote ? '<div style="font-size:0.78rem;margin-top:8px;color:#ffb27d">&#9888; ' + _bcEsc(info.cautionNote) + '</div>' : '')
        + (info.verifiedNote ? '<div id="bc-verify-note" style="font-size:0.8rem;margin-top:8px;color:#a6e87e">' + _bcEsc(info.verifiedNote) + '</div>' : (info.verifyPromise ? '<div id="bc-verify-note" style="font-size:0.8rem;margin-top:8px;color:#9aa">🔎 Confirming with the label…</div>' : ''))
        + '<button data-a="use" style="display:block;width:100%;margin-top:14px;padding:12px;border-radius:10px;border:2px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--text,#fff);font-weight:600;font-size:0.95rem;cursor:pointer">Use this</button>'
        + '<div style="display:flex;gap:8px;margin-top:8px">'
        + '<button data-a="rescan" style="flex:1;padding:10px 4px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);font-size:0.82rem;cursor:pointer">Rescan</button>'
        + '<button data-a="manual" style="flex:1;padding:10px 4px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);font-size:0.82rem;cursor:pointer">Type it instead</button>'
        + '<button data-a="cancel" style="flex:1;padding:10px 4px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);font-size:0.82rem;cursor:pointer">Cancel</button>'
        + '</div></div>';
      d.addEventListener('click', function (e) { var _wy = (e.target && e.target.closest) ? e.target.closest('[data-why]') : null; if (_wy) { if (typeof _bcWhyLionelPanel === 'function') _bcWhyLionelPanel(); return; } var el = (e.target && e.target.closest) ? e.target.closest('[data-a]') : null; var a = el && el.getAttribute('data-a'); if (a) { d.remove(); resolve(a); } });
      document.body.appendChild(d);
      if (info.verifyPromise) {
        Promise.resolve(info.verifyPromise).then(function (lv) {
          var note = d.querySelector('#bc-verify-note');
          if (!note) return;
          var nums = (lv && lv.nums) || [];
          var exp = String(info.expectNum || '').replace(/\D+/g, '');
          if (exp && nums.indexOf(exp) >= 0) { note.textContent = '✓ Confirmed by the label'; note.style.color = '#a6e87e'; return; }
          var diff = nums.filter(function (n) { return n && n.length >= 6 && n !== exp; });
          if (diff.length) {
            var _lblNum = diff[0];
            note.innerHTML = '⚠ Barcode and label disagree — pick the right one. <a data-why="1" style="color:#9ecbff;text-decoration:underline;cursor:pointer">Why?</a>';
            note.style.color = '#ffb27d';
            // Look the label number up in the catalog so we can describe it, then
            // offer BOTH the barcode match and the label match as choices.
            Promise.resolve((typeof _findMasterItemsExact === 'function') ? _findMasterItemsExact([_lblNum, _lblNum.replace(/^6-/, ''), '6-' + _lblNum]) : []).then(function (hits) {
              if (!d.isConnected) return;
              var _lm = (hits && hits.length) ? hits[0] : null;
              info._labelResult = _lm
                ? { handled: true, itemNum: _lm.itemNum, variation: _lm.variation || '', masterItem: _lm, manufacturer: (_lm.mfr || info.manufacturer || ''), description: _lm.description || '', verifiedBy: 'label' }
                : { handled: true, itemNum: _lblNum, variation: '', notInMaster: true, manufacturer: (info.manufacturer || ''), description: '' };
              var _useBtn = d.querySelector('[data-a="use"]');
              if (_useBtn) _useBtn.innerHTML = 'Use ' + _bcEsc(info.itemNum || '') + (info.description ? ' <span style="font-size:0.78rem;color:#ffe;font-weight:400">' + _bcEsc(info.description) + '</span>' : '') + ' <span style="font-size:0.72rem;opacity:0.75">(barcode)</span>';
              var _lblDesc = _lm ? (_lm.description || _lm.roadName || '') : 'not in your catalog — read from the label';
              var _lblBtn = document.createElement('button');
              _lblBtn.setAttribute('data-a', 'uselabel');
              _lblBtn.style.cssText = 'display:block;width:100%;margin-top:8px;padding:12px;border-radius:10px;border:2px solid #3a8ee6;background:rgba(58,142,230,0.14);color:var(--text,#fff);font-weight:600;font-size:0.95rem;cursor:pointer';
              _lblBtn.innerHTML = 'Use ' + _bcEsc(_lblNum) + (_lblDesc ? ' <span style="font-size:0.78rem;color:#cfe3ff;font-weight:400">' + _bcEsc(_lblDesc) + '</span>' : '') + ' <span style="font-size:0.72rem;opacity:0.75">(label)</span>';
              if (_useBtn && _useBtn.parentNode) _useBtn.parentNode.insertBefore(_lblBtn, _useBtn.nextSibling);
            }).catch(function () {});
          }
          else { note.innerHTML = '✓ Using the barcode match — couldn\'t double-check the label.'; note.style.color = '#a6e87e'; }
        }).catch(function () {});
      }
    });
  }

  // Why can a Lionel barcode point to the wrong item? (shown from the conflict card)
  function _bcWhyLionelPanel() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="max-width:430px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:16px;padding:18px;color:var(--text-mid,#ddd);font-size:0.9rem;line-height:1.55;font-family:var(--font-body,sans-serif)">'
      + '<div style="font-size:1.05rem;font-weight:600;color:var(--text,#fff);margin-bottom:10px">Why the barcode &amp; label can disagree</div>'
      + '<p>On many modern Lionel boxes the <strong>barcode does not contain the item&rsquo;s catalog number.</strong> Lionel puts a short, separate code in the barcode, so a scan can land on a <em>different</em> item that just happens to share those digits.</p>'
      + '<p>The number <strong>printed on the label</strong> (the large catalog number) is the real one. That&rsquo;s why, when they don&rsquo;t match, we show you both and let you choose.</p>'
      + '<p style="color:var(--accent2,#c9922a)"><strong>Rule of thumb:</strong> pick the option that matches the big printed number on the box.</p>'
      + '<button data-close="1" style="display:block;width:100%;margin-top:12px;padding:11px;border-radius:10px;border:2px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--text,#fff);font-weight:600;cursor:pointer">Got it</button></div>';
    d.addEventListener('click', function (e) { if ((e.target.getAttribute && e.target.getAttribute('data-close')) || e.target === d) d.remove(); });
    document.body.appendChild(d);
  }

  // ── Help / info panel (Session 180) ──
  function _bcHelpPanel(kind) {
    var isLabel = kind === 'label';
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem';
    var body = isLabel
      ? '<p><strong style="color:var(--text,#fff)">What it does:</strong> reads the printed item number \u2014 and, when it can, the description \u2014 off your box/label using on-device text recognition.</p>'
        + '<p><strong style="color:var(--text,#fff)">Works for:</strong> Lionel (6-####), MTH (10/20/\u2026-####), K-Line, RMT, Menards Gold Line (275/279-####), plus Atlas and any box that prints “Item #…”. Other makers: type the number.</p>'
        + '<p><strong style="color:var(--text,#fff)">Tips:</strong> hold the label right-side up (OCR can’t read upside-down text), fill the dashed box, use good even light, avoid glare, hold steady, then tap Capture.</p>'
        + '<p>You will get a confirm screen \u2014 nothing is filled in until you say so.</p>'
      : '<p><strong style="color:var(--text,#fff)">What it does:</strong> reads the UPC barcode and, on the same shot, reads the printed item number off the label — then cross-checks the two so you get the right item. Your camera stays on your device.</p>'
        + '<p><strong style="color:var(--text,#fff)">Shared barcodes:</strong> some Lionel reissues share one barcode; the label reading tells them apart automatically, so you usually won’t have to pick.</p>'
        + '<p><strong style="color:var(--text,#fff)">No barcode?</strong> tap “Read the label instead” to identify the box by its printed item number.</p>'
        + '<p><strong style="color:var(--text,#fff)">Tips:</strong> fit the whole barcode AND the item number in the frame, hold the box right-side up and steady with good even light. You will confirm the result before anything fills.</p>';
    d.innerHTML = '<div style="max-width:420px;background:var(--surface,#1a1d3a);border-radius:16px;padding:18px;color:var(--text-mid,#ddd);font-size:0.88rem;line-height:1.5;font-family:var(--font-body,sans-serif)">'
      + '<div style="font-size:1.05rem;font-weight:600;color:var(--text,#fff);margin-bottom:10px">' + (isLabel ? 'Scan Label \u2014 help' : 'Scan Barcode / Label \u2014 help') + '</div>'
      + body
      + '<button data-close="1" style="display:block;width:100%;margin-top:12px;padding:11px;border-radius:10px;border:2px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--text,#fff);font-weight:600;cursor:pointer">Got it</button></div>';
    d.addEventListener('click', function (e) { if ((e.target.getAttribute && e.target.getAttribute('data-close')) || e.target === d) d.remove(); });
    document.body.appendChild(d);
  }

  function _makeBusyOverlay(msg) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99998;'
      + 'display:flex;align-items:center;justify-content:center;color:#fff;'
      + 'font-family:var(--font-head,sans-serif);font-size:0.95rem;text-align:center;padding:1rem';
    d.textContent = msg || 'Loading…';
    document.body.appendChild(d);
    return d;
  }

  window.openLabelScanner = openLabelScanner;
  window._extractItemNumberCandidates = _extractItemNumberCandidates;
  window._barcodeDebug = { decodeBarcode, findMasterItem, findMasterItems, showCandidatePicker, UPC_PREFIXES, _bcDescriptionGuess, _extractItemNumberCandidates };
})();
