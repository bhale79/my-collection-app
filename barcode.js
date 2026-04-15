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

  // ── Look up item# in master ──
  function findMasterItem(candidates) {
    if (!candidates || candidates.length === 0) return null;
    if (typeof state === 'undefined' || !state.masterData) return null;
    for (const cand of candidates) {
      const match = state.masterData.find(m =>
        m.itemNum === cand ||
        m.itemNum === cand.replace(/^6-/, '') ||
        m.itemNum === ('6-' + cand)
      );
      if (match) return match;
    }
    // Fallback: any master row whose last 5 digits match
    if (candidates[0]) {
      const tail = candidates[0].replace(/^6-/, '').slice(-5);
      const fuzzy = state.masterData.find(m => {
        const n = String(m.itemNum || '').replace(/\D+/g, '');
        return n.length >= 5 && n.slice(-5) === tail;
      });
      if (fuzzy) return fuzzy;
    }
    return null;
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
        <div style="color:#fff;font-family:var(--font-head,sans-serif);font-size:1.1rem;text-align:center">📷 Scan the barcode</div>
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
            const result = decodeBarcode(bc, eraHint);
            if (result.handled) {
              statusEl.textContent = result.statusMessage || 'Detected!';
              statusEl.style.color = result.error ? '#ff9580' : '#a6e87e';
              await new Promise(r => setTimeout(r, 350));
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
  function decodeBarcode(bc, eraHint) {
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
        const master = findMasterItem(parsed.itemNumCandidates);
        if (master) {
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
      const master = findMasterItem([raw]);
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
  window._barcodeDebug = { decodeBarcode, findMasterItem, UPC_PREFIXES };
})();
