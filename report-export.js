// ══════════════════════════════════════════════════════════════════
// report-export.js — PDF / Google Doc / print-with-photos for Reports
// Reuses: findMaster, _currencySymbol, driveGetFolderPhotos,
//         _fetchPhotoAsDataUrl, driveRequest, accessToken, state, INSURANCE_REPORT
// ══════════════════════════════════════════════════════════════════

// Owned items for the insurance/collection reports (same rule as reports.js).
function _repOwnedItems() {
  return Object.values(state.personalData).filter(function (pd) {
    if (!pd.owned) return false;
    var c = (pd.condition || '').toString().trim(), p = (pd.priceItem || '').toString().trim();
    var noC = !c || c === 'N/A', noP = !p || p === 'N/A';
    return !(pd.hasBox === 'Yes' && noC && noP);
  }).sort(function (a, b) {
    var ma = findMaster(a.itemNum, a.variation) || {}, mb = findMaster(b.itemNum, b.variation) || {};
    if ((ma.itemType || 'ZZZ') !== (mb.itemType || 'ZZZ')) return (ma.itemType || 'ZZZ').localeCompare(mb.itemType || 'ZZZ');
    return (a.itemNum || '').localeCompare(b.itemNum || '', undefined, { numeric: true });
  });
}

// Preload the first Drive photo (as a data URL) for each item, with a small
// concurrency limit + progress callback. Returns map keyed by inventoryId.
async function _repPreloadPhotos(items, onProgress) {
  var out = {};
  var withPhoto = items.filter(function (p) { return p.photoItem; });
  var done = 0, total = withPhoto.length, i = 0, CONC = 6;
  if (onProgress) onProgress(0, total);
  async function one(pd) {
    try {
      var photos = await driveGetFolderPhotos(pd.photoItem);
      if (photos && photos.length) {
        var url = await _fetchPhotoAsDataUrl(photos[0].id);
        if (url) out[pd.inventoryId || (pd.itemNum + '|' + (pd.variation || ''))] = url;
      }
    } catch (e) { /* skip */ }
    done++; if (onProgress) onProgress(done, total);
  }
  async function worker() { while (i < withPhoto.length) { var pd = withPhoto[i++]; await one(pd); } }
  var workers = []; for (var w = 0; w < CONC; w++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

function _repBtnBusy(label) {
  var ids = ['rep-pdf-btn', 'rep-gdoc-btn', 'rep-print-btn'];
  ids.forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = true; });
  var s = document.getElementById('rep-export-status');
  if (s) { s.style.display = ''; s.textContent = label || 'Working…'; }
}
function _repBtnDone(msg) {
  ['rep-pdf-btn', 'rep-gdoc-btn', 'rep-print-btn'].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = false; });
  var s = document.getElementById('rep-export-status');
  if (s) { if (msg) { s.textContent = msg; setTimeout(function () { s.style.display = 'none'; }, 4000); } else { s.style.display = 'none'; } }
}

// ── Download PDF (insurance = rich w/ photos; other types = table) ──
async function exportReportPDF() {
  var type = (document.getElementById('report-type') || {}).value || 'insurance';
  if (!(window.jspdf && window.jspdf.jsPDF)) { alert('PDF engine still loading — try again in a moment.'); return; }
  try {
    if (type === 'insurance') { await _insurancePDF(); }
    else { _tablePDF(type); }
  } catch (e) { console.error('[Report PDF]', e); alert('Could not build the PDF: ' + e.message); _repBtnDone(); }
}

async function _insurancePDF() {
  _repBtnBusy('Loading photos… 0');
  var items = _repOwnedItems();
  var photos = await _repPreloadPhotos(items, function (d, t) { _repBtnBusy('Loading photos… ' + d + '/' + t); });
  _repBtnBusy('Building PDF…');
  var CFG = (typeof INSURANCE_REPORT !== 'undefined') ? INSURANCE_REPORT : {};
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
  var M = 36, y = 0;
  var sym = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
  var owner = (state.user && state.user.name) ? state.user.name : '';
  var dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var totalWorth = 0; items.forEach(function (pd) { totalWorth += parseFloat(pd.userEstWorth || 0) || 0; });

  // Header band
  doc.setFillColor(26, 29, 58); doc.rect(0, 0, pageW, 54, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(240, 80, 8);
  doc.text(CFG.title || 'Model Train Collection — Insurance Documentation', M, 26);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(210, 210, 220);
  doc.text((CFG.subtitle || 'Prepared for scheduled-coverage submission'), M, 42);
  y = 72;
  doc.setTextColor(40, 40, 40); doc.setFontSize(10);
  doc.text('Owner: ' + (owner || '—') + '     Generated: ' + dateStr + '     Items: ' + items.length, M, y); y += 16;
  doc.setFont('helvetica', 'bold'); doc.text('Total Estimated Worth: ' + sym + Math.round(totalWorth).toLocaleString(), M, y); y += 6;
  doc.setDrawColor(200); doc.line(M, y, pageW - M, y); y += 16;

  // Column layout
  var cols = [
    { k: 'photo', w: 46 }, { k: 'num', w: 70 }, { k: 'desc', w: 176 },
    { k: 'var', w: 40 }, { k: 'cond', w: 42 }, { k: 'box', w: 40 }, { k: 'val', w: 66 }
  ];
  var labels = ['Photo', 'Item #', 'Description', 'Var #', 'Cond.', 'Box', 'Value'];
  function colX(i) { var x = M; for (var j = 0; j < i; j++) x += cols[j].w; return x; }
  function header() {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    doc.setFillColor(238, 238, 238); doc.rect(M, y, pageW - M * 2, 18, 'F');
    labels.forEach(function (lb, i) { doc.text(lb, colX(i) + 3, y + 12); });
    y += 18;
  }
  header();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  var ROWH = 40;
  items.forEach(function (pd) {
    if (y + ROWH > pageH - 70) { doc.addPage(); y = M; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20); }
    var m = findMaster(pd.itemNum, pd.variation) || {};
    var desc = m.roadName || m.description || m.itemType || '';
    var key = pd.inventoryId || (pd.itemNum + '|' + (pd.variation || ''));
    var img = photos[key];
    if (img) { try { doc.addImage(img, 'JPEG', colX(0) + 2, y + 2, 36, 36, '', 'FAST'); } catch (e) {} }
    doc.text(String(pd.itemNum || ''), colX(1) + 3, y + 16);
    doc.text(doc.splitTextToSize(desc, cols[2].w - 6), colX(2) + 3, y + 12);
    doc.text(String(pd.variation || '—'), colX(3) + 3, y + 16);
    doc.text(String(pd.condition || '—'), colX(4) + 3, y + 16);
    doc.text(String(pd.hasBox || '—'), colX(5) + 3, y + 16);
    var val = pd.userEstWorth ? sym + parseFloat(pd.userEstWorth).toLocaleString() : '—';
    doc.text(val, colX(6) + cols[6].w - 3, y + 16, { align: 'right' });
    doc.setDrawColor(225); doc.line(M, y + ROWH, pageW - M, y + ROWH);
    y += ROWH;
  });

  // Certification + signature
  if (y + 90 > pageH - 40) { doc.addPage(); y = M; }
  y += 18; doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text(doc.splitTextToSize(CFG.footerCertification || 'I certify that the items listed above represent my personal model train collection as of the date shown. Values are estimated for insurance purposes only and do not constitute a professional appraisal.', pageW - M * 2), M, y);
  y += 54; doc.setDrawColor(120);
  doc.line(M, y, M + 220, y); doc.line(pageW - M - 160, y, pageW - M, y);
  doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  doc.text('Owner signature', M, y + 12); doc.text('Date', pageW - M - 160, y + 12);

  doc.save('insurance-report-' + new Date().toISOString().slice(0, 10) + '.pdf');
  _repBtnDone('PDF downloaded');
}

// Generic table PDF (Full Collection / Want-Upgrade-Parts) from the rendered table.
function _tablePDF(type) {
  _repBtnBusy('Building PDF…');
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  var pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), M = 36, y = 40;
  var title = (type === 'collection') ? 'Full Collection' : 'Want / Upgrade / Parts';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(240, 80, 8);
  doc.text('THE RAIL ROSTER — ' + title, M, y); y += 8;
  doc.setDrawColor(200); doc.line(M, y, pageW - M, y); y += 16;
  var thead = document.getElementById('report-thead'), tbody = document.getElementById('report-tbody');
  var heads = [].slice.call(thead.querySelectorAll('th')).map(function (t) { return t.textContent.trim(); });
  var rows = [].slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
    return [].slice.call(tr.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); });
  });
  var n = heads.length || (rows[0] ? rows[0].length : 1);
  var colW = (pageW - M * 2) / n;
  function row(cells, bold) {
    if (y > pageH - 40) { doc.addPage(); y = 40; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5); doc.setTextColor(bold ? 60 : 20, bold ? 60 : 20, bold ? 60 : 20);
    cells.forEach(function (c, i) { var lines = doc.splitTextToSize(String(c || ''), colW - 6); doc.text(lines, M + i * colW + 2, y + 10); });
    y += 18;
  }
  if (heads.length) { doc.setFillColor(238, 238, 238); doc.rect(M, y - 4, pageW - M * 2, 18, 'F'); row(heads, true); }
  rows.forEach(function (r) { row(r, false); });
  doc.save((type === 'collection' ? 'full-collection' : 'want-upgrade-parts') + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
  _repBtnDone('PDF downloaded');
}

// ── Google Doc export (editable; sign / send / keep) ──
// Builds clean HTML and uploads it to Drive as a Google Doc (Drive converts
// HTML → editable Doc). Uses drive.file scope (the app owns the new file).
async function exportReportGoogleDoc() {
  var type = (document.getElementById('report-type') || {}).value || 'insurance';
  if (!accessToken) { alert('Please sign in first.'); return; }
  _repBtnBusy('Creating Google Doc…');
  try {
    var html = _reportToHTML(type);
    var title = (type === 'insurance') ? 'Insurance Report' : (type === 'collection' ? 'Full Collection' : 'Want-Upgrade-Parts Report');
    title += ' — ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    var boundary = '----rr' + Date.now();
    var meta = { name: title, mimeType: 'application/vnd.google-apps.document' };
    var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' +
      html + '\r\n--' + boundary + '--';
    var res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: body
    });
    var d = await res.json();
    if (d.error || !d.webViewLink) throw new Error((d.error && d.error.message) || 'create failed');
    _repBtnDone('Google Doc created');
    window.open(d.webViewLink, '_blank', 'noopener');
  } catch (e) { console.error('[Report GoogleDoc]', e); alert('Could not create the Google Doc: ' + e.message); _repBtnDone(); }
}

// Build clean (light-themed) HTML for the Doc from the current report.
function _reportToHTML(type) {
  var sym = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  if (type === 'insurance') {
    var items = _repOwnedItems();
    var owner = (state.user && state.user.name) ? state.user.name : '';
    var dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var totalWorth = 0; items.forEach(function (pd) { totalWorth += parseFloat(pd.userEstWorth || 0) || 0; });
    var rows = items.map(function (pd) {
      var m = findMaster(pd.itemNum, pd.variation) || {};
      var desc = m.roadName || m.description || m.itemType || '';
      var val = pd.userEstWorth ? sym + parseFloat(pd.userEstWorth).toLocaleString() : '—';
      return '<tr><td>' + esc(pd.itemNum) + '</td><td>' + esc(desc) + '</td><td>' + esc(pd.variation || '—') +
        '</td><td>' + esc(pd.condition || '—') + '</td><td>' + esc(pd.hasBox || '—') + '</td><td>' + esc(val) + '</td></tr>';
    }).join('');
    return '<html><body style="font-family:Arial,sans-serif;color:#111">' +
      '<h1 style="margin-bottom:2px">Model Train Collection — Insurance Documentation</h1>' +
      '<p style="color:#555;margin-top:0">Prepared for scheduled-coverage submission</p>' +
      '<p><b>Owner:</b> ' + esc(owner || '—') + ' &nbsp; <b>Generated:</b> ' + esc(dateStr) +
      ' &nbsp; <b>Items:</b> ' + items.length + ' &nbsp; <b>Total Estimated Worth:</b> ' + sym + Math.round(totalWorth).toLocaleString() + '</p>' +
      '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:11px">' +
      '<thead><tr style="background:#eee"><th>Item #</th><th>Description</th><th>Variation #</th><th>Condition</th><th>Box</th><th>Value</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<p style="font-size:11px;color:#444;margin-top:18px;font-style:italic">I certify that the items listed above represent my personal model train collection as of the date shown. Values are estimated for insurance purposes only and do not constitute a professional appraisal.</p>' +
      '<p style="margin-top:36px">_____________________________ &nbsp;&nbsp;&nbsp;&nbsp; _________________</p>' +
      '<p>Owner signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</p>' +
      '<p style="font-size:10px;color:#888">Note: item photos are included in the PDF version of this report.</p>' +
      '</body></html>';
  }
  // Generic: rebuild from the rendered table.
  var thead = document.getElementById('report-thead'), tbody = document.getElementById('report-tbody');
  var heads = [].slice.call(thead.querySelectorAll('th')).map(function (t) { return '<th>' + esc(t.textContent.trim()) + '</th>'; }).join('');
  var rws = [].slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
    return '<tr>' + [].slice.call(tr.querySelectorAll('td')).map(function (td) { return '<td>' + esc(td.textContent.trim()) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var title = (type === 'collection') ? 'Full Collection' : 'Want / Upgrade / Parts';
  return '<html><body style="font-family:Arial,sans-serif;color:#111"><h1>' + title + '</h1>' +
    '<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:11px">' +
    '<thead><tr style="background:#eee">' + heads + '</tr></thead><tbody>' + rws + '</tbody></table></body></html>';
}

// ── Print, but preload photos first so they appear in the printout ──
async function printReportWithPhotos() {
  var type = (document.getElementById('report-type') || {}).value || 'insurance';
  if (type === 'insurance') {
    _repBtnBusy('Loading photos for print… 0');
    try {
      var items = _repOwnedItems();
      await _repPreloadPhotos(items, function (d, t) { _repBtnBusy('Loading photos for print… ' + d + '/' + t); });
      // Force the on-screen insurance thumbnails to (re)load, then print.
      if (typeof buildReport === 'function') buildReport();
      await new Promise(function (r) { setTimeout(r, 1800); });
    } catch (e) { /* print anyway */ }
    _repBtnDone();
  }
  window.print();
}

if (typeof window !== 'undefined') {
  window.exportReportPDF = exportReportPDF;
  window.exportReportGoogleDoc = exportReportGoogleDoc;
  window.printReportWithPhotos = printReportWithPhotos;
}
