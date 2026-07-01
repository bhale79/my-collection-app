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
              'mod_ho','mod_s'];
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

  // ── Main entry ──
  async function openBarcodeScanner(onScanned, onCancel, eraHint) {
    // Support check
    if (!('BarcodeDetector' in window)) {
      showToast && showToast('Your browser does not support barcode scanning. Try Chrome or Edge.', 4000, true);
      if (onCancel) onCancel();
      return;
    }

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
        <div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;text-align:center;position:relative;width:100%">📷 Scan the barcode<button id="bc-help" type="button" style="position:absolute;right:0;top:-4px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer">?</button></div>
        <div style="position:relative;width:100%;aspect-ratio:4/3;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
          <video id="bc-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
          <div style="position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center">
            <div style="width:80%;height:25%;border:2px dashed rgba(255,255,255,0.6);border-radius:8px"></div>
          </div>
        </div>
        <div id="bc-status" style="color:#ccc;font-size:0.85rem;text-align:center;min-height:1.4em">Point camera at the barcode…</div>
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

    let stream = null;
    let stopScanning = false;

    const cleanup = () => {
      stopScanning = true;
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      overlay.remove();
    };

    cancelBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };
    manualBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };

    // Request camera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      video.srcObject = stream;
    } catch (e) {
      statusEl.textContent = 'Camera access denied or unavailable. Type the number instead.';
      statusEl.style.color = '#ff9580';
      return;
    }

    // Start detection loop
    const detector = new window.BarcodeDetector({
      formats: ['upc_a', 'ean_13', 'code_128', 'code_39']
    });

    await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));

    (async function loop() {
      while (!stopScanning) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const bc = barcodes[0];
            const result = await decodeBarcode(bc, eraHint);
            if (result.handled && result.multipleMatches) {
              // Ambiguous scan — stop the camera and show the candidate picker.
              statusEl.textContent = result.statusMessage;
              statusEl.style.color = '#ffd27d';
              cleanup();
              const chosen = await showCandidatePicker(result.candidates, result);
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
              statusEl.textContent = result.statusMessage || 'Detected!';
              statusEl.style.color = result.error ? '#ff9580' : '#a6e87e';
              await new Promise(r => setTimeout(r, 300));
              if (result.itemNum) {
                stopScanning = true;
                const _bcChoice = await _bcConfirmCard({ itemNum: result.itemNum, manufacturer: result.manufacturer, description: (result.masterItem && result.masterItem.description) || '', notInMaster: result.notInMaster });
                if (_bcChoice === 'use') { cleanup(); if (onScanned) onScanned(result); return; }
                if (_bcChoice === 'manual') { cleanup(); if (onCancel) onCancel(); return; }
                cleanup(); openBarcodeScanner(onScanned, onCancel, eraHint); return;
              }
              cleanup();
              if (onScanned) onScanned(result);
              return;
            } else {
              statusEl.textContent = result.statusMessage || ('Unknown barcode: ' + bc.rawValue);
              statusEl.style.color = '#ffd27d';
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
        var yr   = m.yearProd || m.yearMade || '';
        var meta = [yr, m.roadName || '', m.itemType || ''].filter(Boolean).map(_bcEsc).join(' &middot; ');
        var desc = _bcEsc(String(m.description || '').substring(0, 70));
        var url  = _bcViewUrl(m);
        return '<div class="bc-cand" data-idx="' + idx + '" '
          + 'style="display:flex;align-items:center;gap:0.6rem;padding:0.7rem 0.8rem;border-radius:10px;'
          + 'background:#222;border:1px solid #444;cursor:pointer;margin-bottom:0.5rem">'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-weight:700;color:#fff;font-size:0.95rem">' + _bcEsc(m.itemNum) + '</div>'
          +   (meta ? '<div style="font-size:0.8rem;color:#aaa;margin-top:0.1rem">' + meta + '</div>' : '')
          +   (desc ? '<div style="font-size:0.78rem;color:#888;margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + desc + '</div>' : '')
          + '</div>'
          + '<a href="' + _bcEsc(url) + '" target="_blank" rel="noopener" class="bc-view" '
          +   'style="flex-shrink:0;padding:0.4rem 0.7rem;border-radius:8px;background:#333;border:1px solid #555;'
          +   'color:#9ecbff;font-size:0.78rem;text-decoration:none;white-space:nowrap">View &#8599;</a>'
          + '</div>';
      }).join('');
      overlay.innerHTML = ''
        + '<div style="width:100%;max-width:520px;display:flex;flex-direction:column;gap:0.6rem">'
        +   '<div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;text-align:center">Which one did you scan?</div>'
        +   '<div style="color:#aaa;font-size:0.8rem;text-align:center">The barcode ends in <strong style="color:#ffd27d">' + _bcEsc((scanResult && scanResult.code5) || '') + '</strong> &mdash; these items all share those digits. Tap the right one, or use View to check a photo.</div>'
        +   '<div style="overflow-y:auto;max-height:58vh;margin-top:0.3rem">' + rowsHtml + '</div>'
        +   '<button id="bc-cand-cancel" style="padding:0.8rem;border-radius:10px;border:1px solid #444;background:#222;color:#eee;font-size:0.95rem;font-family:inherit;cursor:pointer">Cancel</button>'
        + '</div>';
      document.body.appendChild(overlay);
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
    { re: /\b\d{2}[\s\-]\d{4,5}(?:-\d{1,3}|[A-Za-z])?\b/g, mfr: ''       },
    // Menards Gold Line — 275-XXXX or 279-XXXX (per Brad's samples)
    { re: /\b(?:275|279)[\s\-]\d{4}\b/g,                          mfr: 'Menards'},
    // Generic item-label fallback (Session 180; broadened 2026-07-01) — any box that
    // prints an explicit item label: Atlas "Item #0526-1", Lionel dealer "ITEM:611437",
    // "Item No. 123". Requires a #/:/No separator (so it never grabs "Item UPC").
    // Listed LAST so a specific-maker match above wins the de-dupe.
    { re: /\bItem\s*(?:No\.?|#|:)\s*([0-9][0-9A-Za-z]*(?:-[0-9A-Za-z]+)*)\b/gi, mfr: '', cap: 1 },
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
    if (/\bWEAVER\b/i.test(t)) return 'Weaver';
    if (/\bRMT\b|READY\s*MADE/i.test(t)) return 'RMT';
    return '';
  }

  async function openLabelScanner(onFound, onCancel) {
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
        video: { facingMode: 'environment' }, audio: false
      });
    } catch (e) {
      showToast && showToast('Camera permission denied.', 4000, true);
      if (onCancel) onCancel();
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'label-scanner-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;gap:0.85rem';
    overlay.innerHTML = ''
      + '<div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;position:relative;width:100%;max-width:520px;text-align:center">📷 Scan Item Label<button id="lbl-help" type="button" style="position:absolute;right:0;top:-4px;background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer">?</button></div>'
      + '<div style="position:relative;width:100%;max-width:520px">'
      + '  <video id="lbl-video" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000"></video>'
      + '  <div style="position:absolute;inset:8% 12%;border:2px dashed rgba(255,255,255,0.6);border-radius:10px;pointer-events:none"></div>'
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
        var ocr = await Tesseract.recognize(crop, 'eng', {
          // No logger to keep things quiet; default progress prints to console.
        });
        var text = (ocr && ocr.data && ocr.data.text) || '';
        var cands = _extractItemNumberCandidates(text);
        if (!cands.length) {
          statusEl.textContent = 'No item number found — hold the label right-side up, fill the dashed box, add light, hold steady, then Capture again.';
          captureBtn.disabled = false;
          captureBtn.textContent = '📸 Try again';
          return;
        }
        // Resolve the first candidate against master data (cross-era).
        var best = cands[0];
        var raw = best.raw;
        var labelDesc = _bcDescriptionGuess(text, raw);
        // Generate match-candidate variants: as-is, without 6- prefix, with 6- prefix.
        var lookupCands = [raw];
        if (raw.indexOf('6-') === 0) lookupCands.push(raw.substring(2));
        else if (/^\d/.test(raw))   lookupCands.push('6-' + raw);
        // Session 169: OCR mode uses EXACT match only (no fuzzy last-5 fallback)
        // because OCR misreads turn into false matches via fuzzy. Barcode flow
        // still uses fuzzy because UPCs map cleanly to Lionel item numbers.
        var hits = await _findMasterItemsExact(lookupCands);
        if (hits.length === 1) {
          var m = hits[0];
          var _r1 = { handled: true, itemNum: m.itemNum, variation: m.variation || '', masterItem: m, manufacturer: best.mfr, description: (m.description || ''), statusMessage: 'Found ' + m.itemNum + ' — ' + (m.description || '').substring(0, 40) };
          var _c1 = await _bcConfirmCard(_r1);
          if (_c1 === 'use') { cleanup(); if (onFound) onFound(_r1); }
          else if (_c1 === 'manual') { cleanup(); if (onCancel) onCancel(); }
          else { captureBtn.disabled = false; captureBtn.textContent = '📸 Capture'; statusEl.textContent = 'Aim at the item-number label — held right-side up — then tap Capture.'; }
          return;
        }
        if (hits.length > 1) {
          // Show the candidate picker (reuse showCandidatePicker if available).
          cleanup();
          var chosen = (typeof showCandidatePicker === 'function')
            ? await showCandidatePicker(hits, { code5: raw })
            : hits[0];
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
        else if (_c0 === 'manual') { cleanup(); if (onCancel) onCancel(); }
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
  var _BC_REJECT = /trademark|reproduced|under\s*licen|licensed|all\s*rights|patent|copyright|©|manufactured|made\s+(and|in)\b|litho|standards?\s+and\s+spec|gateway|corporation|model\s+railroad|accessories|\bfeatures?\b|for\s+ages|\bages?\s+\d|and\s+up\b|assembled|electric\s+trains|rail\s?king|www\.|https?:|\.com\b|set\s+contains|wheels?\s+and\s+axles|die-?cast|couplers?|\bcurves?\b|wheel\s+sets?|needlepoint|paint\s+schemes?|abs\s+bod|scale\s+dimension|(set|unit|car)\s+measures|fast-?angle|operates?\s+on|handrails|brake\s+wheels|proto-?sound|flywheel|transformers|electronic\s+(horn|reverse)|headlight|\bdcru\b|baked\s+enamel|stamped\s+steel|brass\s+trim|\bnickel\b|\bweighs\b|dimensions?:|each\s+car|sliding\s+car\s+door|mounting\s+pad|kadee|qty\s+per\s+case|proof\s+of\s+purchase|rolling\s+stock|master\s+(passenger|line|series|rolling)|premier\s+(locomotive|passenger|rolling)|founders?\s+series|motive\s+power|streamlighting|fully\s+furnished|furnished\s+interior|passenger\s+figures?|extruded\s+alum|legacy\s+(control|railsounds|and\s+bluetooth)|railsounds|freight\s?sounds|electro-?\s?coupler|bluetooth|\blvc\b|minimum\s+curve|sprung\s+trucks|opening\s+doors|all\s+new\s+road|activate\s+sounds|lionel\s+vision\s+line|powerhouse|circuit\s+breaker|over-?current|throttle|whistle\s+steam|fan-?driven|watts?\s+of\s+ac/i;

  function _bcDescGood(l) {
    if (!l) return false;
    if (_BC_REJECT.test(l)) return false;
    var _tl = l.trim().toLowerCase().replace(/[^a-z0-9& ]/g,'').replace(/\s+/g,' ').trim();
    if (/^(atlas|lionel|mth|k-?line|williams|weaver|rmt|menards|locomotive|locomotives|aluminum|heavyweights?|streamlighting|premier|classic|o gauge|o scale|expansion pack|proof of purchase|visionline)$/.test(_tl)) return false;
    if (l.trim().length <= 22 && /^[\[(]?\s*\d\s*[- ]?\s*rail\b[\s\w\/]*[\])]?$/i.test(l.trim())) return false;
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
              .replace(/qty\s+per\s+case.*$/gi, ' ')
              .replace(/www\.[^\s]+|https?:\/\/[^\s]+/gi, ' ')
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
  function _bcConfirmCard(info) {
    return new Promise(function (resolve) {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
      var num = _bcEsc(info.itemNum || ''), mfr = _bcEsc(info.manufacturer || ''), desc = _bcEsc(info.description || '');
      d.innerHTML = '<div style="width:100%;max-width:420px;background:var(--surface,#1a1d3a);border:1px solid var(--border,#333);border-radius:16px;padding:18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif)">'
        + '<div style="font-size:0.78rem;color:var(--accent2,#c9922a);font-weight:600;margin-bottom:8px">' + (info.notInMaster ? 'Detected \u2014 not in your catalog' : 'Found it \u2014 use this?') + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;color:var(--accent,#e8401c)">' + num + (mfr ? ' <span style="font-size:0.72rem;color:var(--text-dim,#999);font-weight:400">' + mfr + '</span>' : '') + '</div>'
        + (desc ? '<div style="font-size:0.9rem;color:var(--text-mid,#ccc);margin-top:6px;line-height:1.4">' + desc + '</div>' : '<div style="font-size:0.8rem;color:var(--text-dim,#999);margin-top:6px">No description read from the label.</div>')
        + (info.notInMaster && info.description ? '<div style="font-size:0.7rem;color:var(--text-dim,#999);margin-top:5px">read from the label \u2014 you can edit it in the next steps.</div>' : '')
        + '<button data-a="use" style="display:block;width:100%;margin-top:14px;padding:12px;border-radius:10px;border:2px solid var(--accent,#e8401c);background:rgba(232,64,28,0.12);color:var(--text,#fff);font-weight:600;font-size:0.95rem;cursor:pointer">Use this</button>'
        + '<div style="display:flex;gap:8px;margin-top:8px">'
        + '<button data-a="rescan" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);cursor:pointer">Rescan</button>'
        + '<button data-a="manual" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border,#444);background:none;color:var(--text-mid,#ccc);cursor:pointer">Type it instead</button>'
        + '</div></div>';
      d.addEventListener('click', function (e) { var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a'); if (a) { d.remove(); resolve(a); } });
      document.body.appendChild(d);
    });
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
      : '<p><strong style="color:var(--text,#fff)">What it does:</strong> reads the UPC / SKU barcode and looks the item up in your catalog. Your camera stays on your device.</p>'
        + '<p><strong style="color:var(--text,#fff)">Works for:</strong> Lionel UPCs and MTH SKU barcodes (10-####). Other makers: type the number for now.</p>'
        + '<p><strong style="color:var(--text,#fff)">Tips:</strong> center the barcode in the dashed box, hold steady, good light. You will confirm the result before it fills.</p>';
    d.innerHTML = '<div style="max-width:420px;background:var(--surface,#1a1d3a);border-radius:16px;padding:18px;color:var(--text-mid,#ddd);font-size:0.88rem;line-height:1.5;font-family:var(--font-body,sans-serif)">'
      + '<div style="font-size:1.05rem;font-weight:600;color:var(--text,#fff);margin-bottom:10px">' + (isLabel ? 'Scan Label \u2014 help' : 'Scan Barcode \u2014 help') + '</div>'
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
