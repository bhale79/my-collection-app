// ══════════════════════════════════════════════════════════════════
// report-library.js — Reports page = a library of report rows.
// Each row: name, description, last-generated date, Preview / Update /
// Export ▾ (PDF/Google Doc/CSV) / Print. Exports archive a dated copy to
// a Drive folder "Past reports". Built reports render into the preview modal.
// Depends on: buildReport, exportReportPDF, exportReportGoogleDoc,
//   exportReport (CSV), printReportWithPhotos, openReportBuilder, state.
// ══════════════════════════════════════════════════════════════════

var REPORT_DEFS = [
  { id: 'insurance',  name: 'Insurance Report',        desc: 'Everything you own with values + photos — formatted for an insurer.' },
  { id: 'collection', name: 'Full Collection',          desc: 'A complete inventory of every item you own.' },
  { id: 'wantupgrade',name: 'Want / Upgrade / Parts',   desc: 'Your want list, upgrade list, and parts needed (with a section selector).' },
  { id: 'contacts',   name: 'Contacts',                  desc: 'Your dealer & collector rolodex — names, phones, emails, specialties.' },
];

function _repMeta() { try { return JSON.parse(localStorage.getItem('lv_report_meta') || '{}'); } catch (e) { return {}; } }
function _repStamp(id) { var m = _repMeta(); m[id] = new Date().toISOString(); try { localStorage.setItem('lv_report_meta', JSON.stringify(m)); } catch (e) {} }
function _repFmtGen(iso) {
  if (!iso) return 'Not generated yet';
  var d = new Date(iso);
  return 'Last generated: ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function _repEsc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }

function renderReportLibrary() {
  var el = document.getElementById('report-library');
  if (!el) return;
  if (typeof _rbRefreshDropdown === 'function') _rbRefreshDropdown(); // keep hidden select's custom options in sync
  var meta = _repMeta();
  var defs = REPORT_DEFS.slice();
  (state.savedReports || []).forEach(function (r) { defs.push({ id: 'custom:' + r.id, name: r.name, desc: 'Custom report you built.', custom: r.id }); });

  var btn = 'padding:0.42rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer';
  var btnA = 'padding:0.42rem 0.85rem;border-radius:8px;border:1.5px solid var(--accent2);background:rgba(180,140,60,0.12);color:var(--accent2);font-family:var(--font-body);font-size:0.82rem;font-weight:700;cursor:pointer';

  el.innerHTML = defs.map(function (d) {
    var menu =
      '<div id="repmenu-' + _repEsc(d.id) + '" style="display:none;position:absolute;right:0;top:110%;z-index:50;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);overflow:hidden;min-width:140px">' +
        '<button onclick="_repExport(\'' + _repEsc(d.id) + '\',\'pdf\')" style="display:block;width:100%;text-align:left;padding:0.5rem 0.85rem;background:none;border:none;color:var(--text);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">PDF (with photos)</button>' +
        '<button onclick="_repExport(\'' + _repEsc(d.id) + '\',\'doc\')" style="display:block;width:100%;text-align:left;padding:0.5rem 0.85rem;background:none;border:none;color:var(--text);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">Google Doc</button>' +
        '<button onclick="_repExport(\'' + _repEsc(d.id) + '\',\'csv\')" style="display:block;width:100%;text-align:left;padding:0.5rem 0.85rem;background:none;border:none;color:var(--text);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">CSV (spreadsheet)</button>' +
      '</div>';
    return '<div style="display:flex;align-items:center;gap:1rem;padding:0.9rem 1.1rem;margin-bottom:0.6rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px">' +
        '<div style="font-weight:700;font-size:1rem;color:var(--text)">' + _repEsc(d.name) + '</div>' +
        '<div style="font-size:0.82rem;color:var(--text-dim);margin-top:1px">' + _repEsc(d.desc) + '</div>' +
        '<div style="font-size:0.73rem;color:var(--text-dim);margin-top:3px">' + _repFmtGen(meta[d.id]) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">' +
        '<button onclick="_repPreview(\'' + _repEsc(d.id) + '\')" style="' + btnA + '">Preview</button>' +
        '<button onclick="_repUpdate(\'' + _repEsc(d.id) + '\')" style="' + btn + '">Update</button>' +
        '<div style="position:relative"><button onclick="_repToggleMenu(event,\'' + _repEsc(d.id) + '\')" style="' + btn + '">Export &#9662;</button>' + menu + '</div>' +
        '<button onclick="_repPrintRow(\'' + _repEsc(d.id) + '\')" style="' + btn + '">Print</button>' +
        (d.custom ? '<button onclick="openReportBuilder(\'' + _repEsc(d.custom) + '\')" style="' + btn + '">Edit</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function _repSetType(id) { var s = document.getElementById('report-type'); if (s) { s.value = id; if (s.value !== id) { var o = document.createElement('option'); o.value = id; o.textContent = id; s.appendChild(o); s.value = id; } } }

function _repPreview(id) {
  _repSetType(id);
  try { buildReport(); } catch (e) { console.error(e); }
  var def = REPORT_DEFS.find(function (d) { return d.id === id; });
  var nm = def ? def.name : (id.indexOf('custom:') === 0 ? ((state.savedReports || []).find(function (r) { return 'custom:' + r.id === id; }) || {}).name : id);
  var t = document.getElementById('rep-prev-title'); if (t) t.textContent = nm || 'Report';
  var m = document.getElementById('report-preview-modal'); if (m) m.style.display = 'block';
  _repStamp(id); renderReportLibrary();
}
function _closeReportPreview() { var m = document.getElementById('report-preview-modal'); if (m) m.style.display = 'none'; }

function _repUpdate(id) {
  _repSetType(id);
  try { buildReport(); } catch (e) {}
  _repStamp(id); renderReportLibrary();
  if (typeof showToast === 'function') showToast('Report updated from your current collection', 2200);
}

function _repToggleMenu(ev, id) {
  ev.stopPropagation();
  var open = document.getElementById('repmenu-' + id);
  document.querySelectorAll('[id^="repmenu-"]').forEach(function (m) { if (m !== open) m.style.display = 'none'; });
  if (open) open.style.display = (open.style.display === 'none' || !open.style.display) ? 'block' : 'none';
}
document.addEventListener('click', function () { document.querySelectorAll('[id^="repmenu-"]').forEach(function (m) { m.style.display = 'none'; }); });

function _repExport(id, fmt) {
  document.querySelectorAll('[id^="repmenu-"]').forEach(function (m) { m.style.display = 'none'; });
  _repSetType(id);
  try { buildReport(); } catch (e) {}   // ensure the table is current (CSV scrape + photo preload use it)
  if (fmt === 'pdf') { exportReportPDF(); }
  else if (fmt === 'doc') { exportReportGoogleDoc(); }
  else if (fmt === 'csv') { exportReport(); }
  _repStamp(id); renderReportLibrary();
}

function _repPrintRow(id) {
  _repSetType(id);
  try { buildReport(); } catch (e) {}
  var m = document.getElementById('report-preview-modal'); if (m) m.style.display = 'block';
  var t = document.getElementById('rep-prev-title'); var def = REPORT_DEFS.find(function (d) { return d.id === id; });
  if (t) t.textContent = (def ? def.name : 'Report');
  _repStamp(id); renderReportLibrary();
  if (typeof printReportWithPhotos === 'function') printReportWithPhotos(); else window.print();
}

if (typeof window !== 'undefined') {
  window.renderReportLibrary = renderReportLibrary;
  window._repPreview = _repPreview;
  window._closeReportPreview = _closeReportPreview;
  window._repUpdate = _repUpdate;
  window._repToggleMenu = _repToggleMenu;
  window._repExport = _repExport;
  window._repPrintRow = _repPrintRow;
}
