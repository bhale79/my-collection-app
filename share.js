// ═══════════════════════════════════════════════════════════════
// SHARE — Select items from Collection, Want List, or For Sale
// and generate a PDF or Drive link to share via email/text.
// Loaded after app.js. Depends on state, sheetsGet, driveRequest.
// ═══════════════════════════════════════════════════════════════

// ── Share state ──────────────────────────────────────────────────
var _shareMode   = false;
var _shareSource = ''; // 'collection' | 'want' | 'forsale'
var _shareItems  = {}; // key -> item data
var _shareDataMap = {}; // key -> item data (populated by page renderers)

// ── Enter / Exit selection mode ──────────────────────────────────
function startShareMode(source) {
  _shareMode   = true;
  _shareSource = source;
  _shareItems  = {};
  _renderShareBar();

  // Rebuild the current page so checkboxes appear
  if (source === 'collection') { renderBrowse(); }
  else if (source === 'want')  { buildWantPage(); }
  else if (source === 'forsale') { buildForSalePage(); }
}

function cancelShareMode() {
  var prevSource = _shareSource;
  _shareMode   = false;
  _shareSource = '';
  _shareItems  = {};
  window._shareDataMap = {};
  var bar = document.getElementById('share-bottom-bar');
  if (bar) bar.remove();

  // Rebuild whichever page is currently active
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var pid = activePage.id;
  if (pid === 'page-browse')       renderBrowse();
  else if (pid === 'page-want')    buildWantPage();
  else if (pid === 'page-forsale') buildForSalePage();
}

// ── Toggle item selection ─────────────────────────────────────────
function toggleShareItem(key) {
  var itemData = window._shareDataMap && window._shareDataMap[key];
  if (!itemData) return;
  if (_shareItems[key]) {
    delete _shareItems[key];
  } else {
    if (Object.keys(_shareItems).length >= 10) {
      showToast('Maximum 10 items at a time', 2500, true);
      var cb = document.getElementById('share-cb-' + key);
      if (cb) cb.checked = false;
      return;
    }
    _shareItems[key] = itemData;
  }
  _renderShareBar();
  var card = document.getElementById('share-card-' + key);
  if (card) {
    card.style.outline = _shareItems[key] ? '2px solid #3a9e68' : 'none';
    card.style.background = _shareItems[key] ? 'rgba(58,158,104,0.08)' : '';
  }
  // Sync checkbox state
  var cb2 = document.getElementById('share-cb-' + key);
  if (cb2) cb2.checked = !!_shareItems[key];
}

// ── Floating bottom bar ───────────────────────────────────────────
function _renderShareBar() {
  var existing = document.getElementById('share-bottom-bar');
  if (existing) existing.remove();

  var count = Object.keys(_shareItems).length;
  var bar = document.createElement('div');
  bar.id = 'share-bottom-bar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:900;background:var(--surface2);border-top:1px solid var(--border);padding:0.75rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;box-shadow:0 -4px 16px rgba(0,0,0,0.3)';

  bar.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a9e68" stroke-width="2"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
      '<span style="font-family:var(--font-body);font-size:0.9rem;color:var(--text)">' +
        '<strong style="color:#3a9e68">' + count + '</strong> item' + (count !== 1 ? 's' : '') + ' selected' +
        '<span style="color:var(--text-dim);font-size:0.78rem;margin-left:0.5rem">(max 10)</span>' +
      '</span>' +
    '</div>' +
    '<div style="display:flex;gap:0.5rem">' +
      '<button onclick="cancelShareMode()" style="padding:0.45rem 0.9rem;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">Cancel</button>' +
      '<button onclick="openShareBuilder()" ' + (count === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;' : 'style="') + 'padding:0.45rem 1rem;border-radius:7px;border:1.5px solid #3a9e68;background:rgba(58,158,104,0.15);color:#3a9e68;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.4rem">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        'Share' +
      '</button>' +
    '</div>';

  document.body.appendChild(bar);
}

// ── Check if share mode is active (called by page builders) ──────
function isShareMode(source) {
  return _shareMode && _shareSource === source;
}

// ── Share Builder Modal ───────────────────────────────────────────
function openShareBuilder() {
  var count = Object.keys(_shareItems).length;
  if (count === 0) return;

  // Remove existing modal
  var ex = document.getElementById('share-builder-modal');
  if (ex) ex.remove();

  var modal = document.createElement('div');
  modal.id = 'share-builder-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem';

  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;width:100%;max-width:440px;max-height:90vh;overflow-y:auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">' +
        '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--text)">Share ' + count + ' Item' + (count !== 1 ? 's' : '') + '</div>' +
        '<button onclick="document.getElementById(\'share-builder-modal\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>' +
      '</div>' +

      // Field picker
      '<div style="margin-bottom:1.25rem">' +
        '<div style="font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.6rem">Include in share</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
          _shareFieldCheck('sf-photo',   'Photo') +
          _shareFieldCheck('sf-itemnum', 'Item Number', true) +
          _shareFieldCheck('sf-vardesc', 'Variation Description', true) +
          _shareFieldCheck('sf-cond',    'Condition', true) +
          _shareFieldCheck('sf-box',     'Has Box', true) +
          _shareFieldCheck('sf-price',   'Asking / Est. Value', true) +
          _shareFieldCheck('sf-notes',   'Notes') +
        '</div>' +
      '</div>' +

      // Message
      '<div style="margin-bottom:1.25rem">' +
        '<div style="font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.5rem">Add a message (optional)</div>' +
        '<textarea id="share-message" placeholder="e.g. Here are the items I mentioned…" rows="3" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;resize:vertical;box-sizing:border-box"></textarea>' +
      '</div>' +

      // Action buttons
      '<div id="share-builder-actions" style="display:flex;flex-direction:column;gap:0.5rem">' +
        '<button onclick="_doShare(\'pdf\')" style="padding:0.65rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
          'Download PDF' +
        '</button>' +
        '<button onclick="_doShare(\'drive\')" style="padding:0.65rem;border-radius:9px;border:1.5px solid #0891b2;background:rgba(8,145,178,0.1);color:#0891b2;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
          'Share via Link (Email / Text)' +
        '</button>' +
      '</div>' +

      '<div id="share-progress" style="display:none;margin-top:1rem;text-align:center;font-size:0.85rem;color:var(--text-dim)"></div>' +
    '</div>';

  document.body.appendChild(modal);
}

function _shareFieldCheck(id, label, checked) {
  return '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.6rem;background:var(--surface2);border-radius:7px;cursor:pointer;font-size:0.83rem;color:var(--text)">' +
    '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' style="accent-color:var(--accent);width:1rem;height:1rem">' +
    label +
    '</label>';
}

function _getShareFields() {
  return {
    photo:   document.getElementById('sf-photo')   ? document.getElementById('sf-photo').checked   : false,
    itemnum: document.getElementById('sf-itemnum') ? document.getElementById('sf-itemnum').checked : true,
    vardesc: document.getElementById('sf-vardesc') ? document.getElementById('sf-vardesc').checked : true,
    cond:    document.getElementById('sf-cond')    ? document.getElementById('sf-cond').checked    : true,
    box:     document.getElementById('sf-box')     ? document.getElementById('sf-box').checked     : true,
    price:   document.getElementById('sf-price')   ? document.getElementById('sf-price').checked   : true,
    notes:   document.getElementById('sf-notes')   ? document.getElementById('sf-notes').checked   : false,
  };
}

// ── Main share action ─────────────────────────────────────────────
async function _doShare(mode) {
  var fields  = _getShareFields();
  var message = (document.getElementById('share-message') || {}).value || '';
  var items   = Object.values(_shareItems);

  var prog = document.getElementById('share-progress');
  var acts = document.getElementById('share-builder-actions');
  if (prog) { prog.style.display = 'block'; prog.textContent = 'Building your share sheet…'; }
  if (acts) acts.style.display = 'none';

  try {
    // Fetch photos if needed
    if (fields.photo) {
      if (prog) prog.textContent = 'Fetching photos (this may take a moment)…';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.pd && it.pd.photoItem) {
          try {
            var photos = await driveGetFolderPhotos(it.pd.photoItem);
            if (photos && photos.length > 0) {
              it._photoDataUrl = await _fetchPhotoAsDataUrl(photos[0].id);
            }
          } catch(e) { /* photo failed — skip gracefully */ }
        }
        if (prog) prog.textContent = 'Fetching photos… (' + (i+1) + '/' + items.length + ')';
      }
    }

    if (prog) prog.textContent = 'Generating PDF…';
    var pdfBlob = await _buildPDF(items, fields, message);

    if (mode === 'pdf') {
      // Direct download
      var url = URL.createObjectURL(pdfBlob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'collection-share-' + new Date().toISOString().slice(0,10) + '.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('PDF downloaded', 2500);
      document.getElementById('share-builder-modal').remove();
      cancelShareMode();

    } else {
      // Upload to Drive and share link
      if (prog) prog.textContent = 'Uploading to your Google Drive…';
      var link = await _uploadShareToDrive(pdfBlob);
      if (prog) prog.textContent = 'Opening share sheet…';

      var shareData = {
        title: 'Boxcar Files Share',
        text: message || 'Check out these items from my collection.',
        url: link,
      };

      if (navigator.share) {
        await navigator.share(shareData);
        showToast('Shared!', 2000);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText((message ? message + '\n\n' : '') + link);
        showToast('Link copied to clipboard', 3000);
      }
      document.getElementById('share-builder-modal').remove();
      cancelShareMode();
    }

  } catch(err) {
    console.error('Share error:', err);
    if (prog) prog.textContent = 'Something went wrong — please try again.';
    if (acts) acts.style.display = 'flex';
  }
}

// ── Fetch a Drive photo as a base64 data URL ──────────────────────
async function _fetchPhotoAsDataUrl(fileId) {
  var token = state && state.token;
  if (!token) return null;
  var res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  var blob = await res.blob();
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { resolve(null); };
    reader.readAsDataURL(blob);
  });
}

// ── Build PDF using jsPDF ─────────────────────────────────────────
async function _buildPDF(items, fields, message) {
  // jsPDF is loaded from CDN in index.html
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var pageW = doc.internal.pageSize.getWidth();
  var margin = 36;
  var contentW = pageW - margin * 2;
  var y = margin;

  // ── Header ──
  doc.setFillColor(15, 18, 32); // --bg color
  doc.rect(0, 0, pageW, 56, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(240, 80, 8); // --accent
  doc.text('THE BOXCAR FILES', margin, 36);
  doc.setFontSize(9);
  doc.setTextColor(200, 184, 138); // --text-mid
  doc.text('Share Sheet  ·  ' + new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), margin, 50);

  y = 72;

  // ── Message ──
  if (message && message.trim()) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(248, 232, 192);
    var msgLines = doc.splitTextToSize(message.trim(), contentW);
    doc.text(msgLines, margin, y);
    y += msgLines.length * 14 + 12;
  }

  // ── Items ──
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var master = it.master || {};
    var pd     = it.pd     || {};
    var want   = it.want   || {};
    var fs     = it.fs     || {};

    // Gather field values
    var itemNum = it.itemNum || '';
    var varNum  = it.variation || '';
    var varDesc = master.varDesc || '';
    var roadName = master.roadName || pd.roadName || '';
    var itemType = master.itemType || pd.itemType || '';
    var condition = pd.condition || fs.condition || '';
    var hasBox  = pd.hasBox || '';
    var price   = fs.askingPrice ? ('$' + parseFloat(fs.askingPrice).toLocaleString()) : (pd.userEstWorth ? 'Est. $' + parseFloat(pd.userEstWorth).toLocaleString() : (want.maxPrice ? 'Max $' + parseFloat(want.maxPrice).toLocaleString() : ''));
    var notes   = pd.notes || fs.notes || want.notes || '';

    // Estimate card height
    var cardH = 20; // top padding
    if (roadName) cardH += 16;
    if (fields.vardesc && varDesc) cardH += 14;
    if (fields.cond && condition)  cardH += 14;
    if (fields.box && hasBox)      cardH += 14;
    if (fields.price && price)     cardH += 14;
    if (fields.notes && notes)     cardH += doc.splitTextToSize(notes, contentW - (fields.photo ? 100 : 0) - 16).length * 12 + 4;
    cardH += 16; // bottom padding
    if (fields.photo) cardH = Math.max(cardH, 100);

    // Page break check
    if (y + cardH > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    // Card background
    doc.setFillColor(22, 28, 52); // --surface
    doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'F');
    doc.setDrawColor(42, 53, 96); // --border
    doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'S');

    var textX = margin + 12;
    var textW = contentW - 24;

    // Photo
    if (fields.photo && it._photoDataUrl) {
      try {
        var imgW = 80, imgH = 80;
        var imgX = margin + contentW - imgW - 12;
        var imgY = y + (cardH - imgH) / 2;
        doc.addImage(it._photoDataUrl, 'JPEG', imgX, imgY, imgW, imgH, '', 'FAST');
        textW = contentW - imgW - 28;
      } catch(e) { /* image failed, skip */ }
    }

    var cy = y + 14;

    // Item number + road name header
    if (fields.itemnum) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(240, 80, 8);
      var numText = 'No. ' + itemNum + (varNum ? '  ·  Var. ' + varNum : '');
      doc.text(numText, textX, cy);
      cy += 16;
    }

    if (roadName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(248, 232, 192);
      doc.text(roadName + (itemType ? '  ·  ' + itemType : ''), textX, cy);
      cy += 14;
    }

    // Detail fields
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 184, 138);

    if (fields.vardesc && varDesc) {
      doc.text('Variation: ' + varDesc, textX, cy);
      cy += 13;
    }
    if (fields.cond && condition) {
      doc.text('Condition: ' + condition + '/10', textX, cy);
      cy += 13;
    }
    if (fields.box && hasBox) {
      doc.text('Has Box: ' + hasBox, textX, cy);
      cy += 13;
    }
    if (fields.price && price) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(212, 168, 67);
      doc.text(price, textX, cy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 184, 138);
      cy += 13;
    }
    if (fields.notes && notes) {
      var noteLines = doc.splitTextToSize('Notes: ' + notes, textW);
      doc.text(noteLines, textX, cy);
      cy += noteLines.length * 11;
    }

    y += cardH + 10;
  }

  // Footer
  var pageCount = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(106, 94, 72);
    doc.text('Page ' + p + ' of ' + pageCount, pageW / 2, doc.internal.pageSize.getHeight() - 18, { align: 'center' });
  }

  return doc.output('blob');
}

// ── Upload PDF to Drive and return shareable link ─────────────────
async function _uploadShareToDrive(pdfBlob) {
  // Get token from localStorage — accessToken in app.js is not accessible from share.js
  var token = localStorage.getItem('lv_token');
  if (!token) throw new Error('Not signed in — please sign in and try again');

  // Ensure vault folder exists
  await driveEnsureSetup();
  var folderId = (driveCache && driveCache.vaultId) ? driveCache.vaultId : 'root';

  var fileName = 'Collection Share ' + new Date().toLocaleDateString('en-US', {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'-') + '.pdf';

  // Step 1: Create file metadata
  var metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: fileName, mimeType: 'application/pdf', parents: [folderId] }),
  });
  if (!metaRes.ok) throw new Error('Drive create failed: ' + metaRes.status);
  var metaData = await metaRes.json();
  var fileId = metaData.id;

  // Step 2: Upload PDF content
  var uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' },
    body: pdfBlob,
  });
  if (!uploadRes.ok) throw new Error('Drive upload failed: ' + uploadRes.status);

  // Step 3: Make publicly viewable (anyone with link)
  await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return 'https://drive.google.com/file/d/' + fileId + '/view';
}
