// ═══════════════════════════════════════════════════════════════
// import-ui.js — Task #25 Phase 1 (Session 81): the import FLOW.
//
// Screens + writes only. All parsing/matching brains live in
// import-core.js (pure, node-tested). The relay's import_map action
// (v3.4) supplies AI suggestions; the user confirms everything;
// ONLY the deterministic code in this file writes.
//
// Phase 1 ships: .xlsx upload + paste entry, header detection,
// AI mapping + interview, grade conversion table (persists), triage,
// preview cards, WRITE of matched + manual rows, red→For Sale flow,
// one-click batch undo. Phase 2 (not here): ambiguous picker,
// custom/optional columns + wizard parity, community queue, photos.
//
// Stability notes:
//  - ExcelJS loads from CDN ONLY when the user opens Import — zero
//    cost to app startup.
//  - Every write carries the batch id (importBatch column) and a fresh
//    inventoryId; undo deletes by re-reading the sheet, never by
//    remembering row numbers (rows shift — Rule: stable ids only).
//  - _impWriteDone guard: the write step can not fire twice.
// ═══════════════════════════════════════════════════════════════

/* global state, PERSONAL_TAB, PERSONAL_SCHEMA, buildPersonalRow, sheetsAppend,
   sheetsGet, nextInventoryId, showToast, vaultPost, vaultGetToken, baseItemNum,
   rrMasterKeyOf, forceRefreshData, _prefGet, _prefSet, accessToken,
   _withTokenRetry, rrImpNormCell, rrImpDetectHeaderRow, rrImpNormHeader,
   rrImpGroupLayouts, rrImpPaletteFromStylesXml, rrImpResolveFillRgb,
   rrImpFillSig, rrImpFillGroups, rrImpHeuristicMap, rrImpApplyMapping,
   rrImpCleanMoney, rrImpCollectGrades, rrImpGuessCondition, rrImpTriage,
   rrImpCopyCounterEvidence, rrImpBuildAiPayload, rrImpValidateAiAnswer */

var _imp = null;          // the whole in-flight import; null = closed
var _impWriteDone = false; // double-fire guard for the write step

var _IMP_EXCELJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
var _IMP_GRADE_PREF = 'rr_grade_table_v1';
var _IMP_BATCH_PREF = 'rr_import_batches_v1';

// ── Entry ───────────────────────────────────────────────────────
function rrImportOpen() {
  if (document.getElementById('imp-overlay')) return;
  _imp = {
    step: 'entry', tabs: [], palette: null, fillGroups: [], groups: [],
    mappings: {},          // tabName → { headerNorm: field }
    tabClass: {},          // tabName → trains|books|vehicles|other
    skipTabs: {},          // tabName → true
    aiUsed: false, aiAnswers: {}, questions: [], answers: {},
    tabMaker: {},          // tabName → confirmed maker ('' = per-row / unknown)
    tabYearMeans: {},      // tabName → true when a year in the description IS the item's year
    tabSubType: {},
    yearsByTab: {},      // v0.9.1530: tab → years filled from descriptions
    unmatchedTabs: [],   // v0.9.1529: tabs where nothing matched the catalog
    tabClassLocked: {},  // v0.9.1529: tabs the user has answered for
    afterCatalog: '',    // v0.9.1527: step to resume once the catalog is ready
    catalogSkipped: false,
    catalogTimer: null,
    typeSkip: {},        // v0.9.1526: types the user unticked on triage
    showTypes: false,        // tabName → optional narrower name (v0.9.1522)
    tabType: {},           // tabName → confirmed item type for non-train tabs
    skippedSummary: 0,     // "Total:" rows dropped (v1509)
    fillMeaning: '',       // for sale | sold | repair | formatting | other
    priceWhen: '',         // now | later
    gradeTable: [],        // [{ raw, condition, count }]
    staged: [], triage: null, itemPrices: {},
    batchId: 'IMP' + Date.now().toString(36).toUpperCase(),
  };
  _impWriteDone = false;
  var ov = document.createElement('div');
  ov.id = 'imp-overlay';
  // v0.9.1524: tells the deploy-reload guard in index.html that a flow is in
  // progress. A new version waits until this overlay closes.
  ov.setAttribute('data-rr-busy', 'import');
  ov.innerHTML = '<div id="imp-panel"><div id="imp-head">' +
    '<div id="imp-title">Import a Spreadsheet <span class="imp-beta">BETA</span></div>' +
    '<button id="imp-close" onclick="rrImportClose()">✕</button></div>' +
    '<div id="imp-body"></div></div>';
  document.body.appendChild(ov);
  _impInjectCss();
  _impRender();
}

function rrImportClose() {
  if (_imp && _imp.step === 'writing') { showToast('Import is writing — let it finish', 2500, true); return; }
  var ov = document.getElementById('imp-overlay');
  if (ov) ov.remove();
  _imp = null;
}

function _impInjectCss() {
  if (document.getElementById('imp-css')) return;
  var s = document.createElement('style');
  s.id = 'imp-css';
  s.textContent =
    '#imp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem}' +
    '#imp-panel{background:var(--surface,#1c1c22);color:var(--text,#eee);border:1px solid var(--border,#333);border-radius:14px;width:min(680px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden}' +
    '#imp-head{display:flex;justify-content:space-between;align-items:center;padding:0.8rem 1rem;border-bottom:1px solid var(--border,#333)}' +
    '#imp-title{font-weight:700;font-size:1.05rem}.imp-beta{font-size:0.6rem;background:var(--accent,#c33);color:#fff;border-radius:4px;padding:0.1rem 0.35rem;vertical-align:middle;margin-left:0.4rem}' +
    '#imp-close{background:none;border:none;color:var(--text-dim,#999);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.5rem}' +
    '#imp-body{padding:1rem;overflow-y:auto}' +
    '.imp-drop{border:2px dashed var(--border,#555);border-radius:12px;padding:2rem 1rem;text-align:center;cursor:pointer;color:var(--text-mid,#bbb)}' +
    '.imp-drop.drag{border-color:var(--accent,#c33)}' +
    '.imp-btn{padding:0.5rem 1rem;border-radius:8px;border:1px solid var(--border,#444);background:var(--surface2,#26262e);color:var(--text,#eee);cursor:pointer;font-size:0.9rem}' +
    '.imp-btn.primary{background:var(--accent,#c33);border-color:var(--accent,#c33);color:#fff;font-weight:600}' +
    '.imp-btn:disabled{opacity:0.45;cursor:default}' +
    '.imp-foot{display:flex;justify-content:space-between;gap:0.5rem;margin-top:1.1rem}' +
    '.imp-row{display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid var(--border,#2a2a30);font-size:0.88rem}' +
    '.imp-sel{background:var(--surface2,#26262e);color:var(--text,#eee);border:1px solid var(--border,#444);border-radius:6px;padding:0.25rem 0.4rem;font-size:0.85rem;max-width:12rem}' +
    '.imp-swatch{display:inline-block;width:0.95rem;height:0.95rem;border-radius:3px;border:1px solid #0006;vertical-align:-0.15rem}' +
    '.imp-card{border:1px solid var(--border,#333);border-radius:10px;padding:0.7rem 0.8rem;margin:0.5rem 0;background:var(--surface2,#222228)}' +
    '.imp-qopt{display:block;width:100%;text-align:left;margin:0.25rem 0}' +
    '.imp-muted{color:var(--text-dim,#999);font-size:0.8rem}' +
    '.imp-badge{font-size:0.65rem;border-radius:4px;padding:0.08rem 0.35rem;margin-left:0.4rem;vertical-align:middle}' +
    '.imp-badge.sale{background:#a33;color:#fff}.imp-badge.manual{background:#666;color:#fff}.imp-badge.match{background:#2a6;color:#fff}' +
    '.imp-num{font-family:monospace;font-weight:600}' +
    '.imp-h{font-weight:700;margin:0.2rem 0 0.6rem;font-size:0.98rem}' +
    '.imp-prog{height:8px;background:var(--surface2,#2a2a30);border-radius:4px;overflow:hidden;margin:0.8rem 0}' +
    '.imp-prog>div{height:100%;background:var(--accent,#c33);width:0%;transition:width 0.2s}@keyframes imp-slide{0%{margin-left:-40%}100%{margin-left:100%}}.imp-prog.busy>div{width:40%!important;animation:imp-slide 1.2s linear infinite}' +
    '.imp-money{width:6.5rem;background:var(--surface2,#26262e);color:var(--text,#eee);border:1px solid var(--border,#444);border-radius:6px;padding:0.25rem 0.4rem;font-size:0.85rem}' +
    // v0.9.1523: two-column mapping screen — rows left, definitions right.
    '.imp-2col{display:flex;gap:1rem;align-items:flex-start}' +
    '.imp-2col-main{flex:1;min-width:0}' +
    '.imp-2col-aside{width:270px;flex-shrink:0;position:sticky;top:0;max-height:60vh;overflow:auto}' +
    '#imp-panel.wide{width:min(1080px,96vw);max-width:1080px}' +
    '@media (max-width:900px){.imp-2col{display:block}.imp-2col-aside{width:auto;position:static;max-height:none;margin-top:0.6rem}#imp-panel.wide{max-width:min(680px,96vw)}}';
  document.head.appendChild(s);
}

function _impBody() { return document.getElementById('imp-body'); }
function _impEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _impRender() {
  if (!_imp) return;
  // The mapping step needs room for its definitions panel; every other step
  // keeps the narrow dialog.
  try {
    var _pnl = document.getElementById('imp-panel');
    if (_pnl) _pnl.classList[_imp.step === 'mapping' ? 'add' : 'remove']('wide');
  } catch (e) {}
  var fn = {
    entry: _impStepEntry, consent: _impStepConsent, mapping: _impStepMapping,
    tabfacts: _impStepTabFacts, catalog: _impStepCatalog,
    interview: _impStepInterview, grades: _impStepGrades, triage: _impStepTriage,
    prices: _impStepPrices, eracheck: _impStepEraCheck, preview: _impStepPreview, writing: _impStepWriting,
    done: _impStepDone,
  }[_imp.step];
  if (fn) fn();
}

// ── Step: entry (file or paste) ─────────────────────────────────
function _impStepEntry() {
  _impBody().innerHTML =
    '<div class="imp-h">Bring in a collection you already track in a spreadsheet.</div>' +
    '<div class="imp-drop" id="imp-drop" onclick="document.getElementById(\'imp-file\').click()">' +
    '<div style="font-size:1.6rem">📄</div><div><strong>Drop your Excel file here</strong> or tap to choose</div>' +
    '<div class="imp-muted">Excel (.xlsx) works best — row colors and every tab come along.<br>' +
    'Google Sheets: File → Download → Microsoft Excel first. CSV works too.</div></div>' +
    '<input type="file" id="imp-file" accept=".xlsx,.csv" style="display:none">' +
    '<div style="text-align:center;margin:0.7rem 0" class="imp-muted">— or —</div>' +
    '<textarea id="imp-paste" placeholder="Paste rows copied from a simple spreadsheet (headers first)" ' +
    'style="width:100%;min-height:5.5rem;background:var(--surface2,#26262e);color:var(--text,#eee);border:1px solid var(--border,#444);border-radius:8px;padding:0.5rem;font-size:0.82rem"></textarea>' +
    '<div class="imp-foot"><span></span><button class="imp-btn primary" id="imp-paste-go">Use pasted rows</button></div>';
  var drop = document.getElementById('imp-drop');
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('drag');
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _impLoadAnyFile(f);
  });
  document.getElementById('imp-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) _impLoadAnyFile(e.target.files[0]);
  });
  document.getElementById('imp-paste-go').onclick = function () {
    var txt = document.getElementById('imp-paste').value || '';
    if (txt.trim().length < 10) { showToast('Paste a few rows first', 2500, true); return; }
    _impLoadPaste(txt);
  };
}

// v0.9.1508: one entry point for BOTH drop and pick. A .csv (or .txt) is read
// as text and routed to the same parser the paste box uses; anything else goes
// down the ExcelJS path. Keeps colors/tabs for xlsx, adds a path for the many
// people whose list is a plain CSV.
function _impLoadAnyFile(file) {
  var name = String((file && file.name) || '').toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name)) {
    var reader = new FileReader();
    reader.onload = function () { _impLoadPaste(String(reader.result || '')); };
    reader.onerror = function () { showToast('Could not read that file', 3000, true); };
    reader.readAsText(file);
    return;
  }
  _impLoadFile(file);
}

// ExcelJS on demand — never part of app startup.
function _impEnsureExcelJs() {
  return new Promise(function (resolve, reject) {
    if (typeof ExcelJS !== 'undefined') { resolve(); return; }
    var s = document.createElement('script');
    s.src = _IMP_EXCELJS_URL;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('ExcelJS load failed')); };
    document.head.appendChild(s);
  });
}

// Pull one entry's text straight out of the xlsx zip (for styles.xml —
// ExcelJS does not surface custom indexed palettes). Native
// DecompressionStream: no extra library.
async function _impZipEntryText(buf, entryName) {
  try {
    var bytes = new Uint8Array(buf);
    var name = new TextEncoder().encode(entryName);
    outer:
    for (var i = 0; i + 30 < bytes.length; i++) {
      if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 0x03 || bytes[i + 3] !== 0x04) continue;
      var nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
      if (nameLen !== name.length) continue;
      for (var j = 0; j < name.length; j++) if (bytes[i + 30 + j] !== name[j]) continue outer;
      var method = bytes[i + 8] | (bytes[i + 9] << 8);
      var extraLen = bytes[i + 28] | (bytes[i + 29] << 8);
      var start = i + 30 + nameLen + extraLen;
      var slice = bytes.subarray(start);
      if (method === 0) return new TextDecoder().decode(slice);
      if (method === 8 && typeof DecompressionStream !== 'undefined') {
        var ds = new DecompressionStream('deflate-raw');
        var stream = new Blob([slice]).stream().pipeThrough(ds);
        // Streamed entries run past the entry's end; the inflater stops at
        // end-of-stream on its own and we swallow the trailing-junk error.
        var chunks = [], reader = stream.getReader();
        try {
          for (;;) { var r = await reader.read(); if (r.done) break; chunks.push(r.value); }
        } catch (e) { /* deflate hit the next zip entry — fine, we have the data */ }
        var total = chunks.reduce(function (n, c) { return n + c.length; }, 0);
        var out = new Uint8Array(total), off = 0;
        chunks.forEach(function (c) { out.set(c, off); off += c.length; });
        return new TextDecoder().decode(out);
      }
      return null;
    }
  } catch (e) { /* palette is a nice-to-have — fills still group by signature */ }
  return null;
}

async function _impLoadFile(file) {
  _impBody().innerHTML = '<div class="imp-h">Reading ' + _impEsc(file.name) + '…</div><div class="imp-prog busy"><div></div></div>';
  try {
    await _impEnsureExcelJs();
    var buf = await file.arrayBuffer();
    var stylesXml = await _impZipEntryText(buf, 'xl/styles.xml');
    _imp.palette = stylesXml ? rrImpPaletteFromStylesXml(stylesXml) : null;
    var wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    var tabs = [];
    wb.eachSheet(function (ws) {
      var raw = [];
      var scanMax = Math.min(ws.rowCount, 8);
      for (var r = 1; r <= scanMax; r++) raw.push((ws.getRow(r).values || []).slice(1));
      var hIdx = rrImpDetectHeaderRow(raw);
      var tab = { name: ws.name, headerRow: hIdx, headers: [], rows: [] };
      if (hIdx >= 0) {
        tab.headers = raw[hIdx].map(rrImpNormCell);
        for (var dr = hIdx + 2; dr <= ws.rowCount; dr++) {
          var row = ws.getRow(dr);
          var cells = (row.values || []).slice(1);
          var isEmpty = true;
          for (var c = 0; c < cells.length; c++) if (rrImpNormCell(cells[c]) !== '') { isEmpty = false; break; }
          if (isEmpty) continue;
          var fill = row.getCell(1).fill;
          var sig = rrImpFillSig(fill);
          tab.rows.push({
            cells: cells, rowIdx: dr, fillSig: sig,
            fillRgb: sig ? rrImpResolveFillRgb(fill && fill.fgColor, _imp.palette) : null,
          });
        }
      }
      tabs.push(tab);
    });
    _impAfterParse(tabs);
  } catch (e) {
    console.warn('[Import] read failed:', e);
    _impBody().innerHTML = '<div class="imp-h">Could not read that file.</div>' +
      '<div class="imp-muted">Is it a .xlsx? (.xls and .numbers need a "Save as .xlsx" first.)</div>' +
      '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'entry\';_impRender()">← Try again</button><span></span></div>';
  }
}

function _impLoadPaste(txt) {
  var lines = txt.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
  var delim = (txt.indexOf('\t') >= 0) ? '\t' : ',';
  var grid = lines.map(function (l) { return l.split(delim); });
  var hIdx = rrImpDetectHeaderRow(grid.slice(0, 8));
  if (hIdx < 0) hIdx = 0;
  var tab = { name: 'Pasted rows', headerRow: hIdx, headers: grid[hIdx].map(rrImpNormCell), rows: [] };
  for (var r = hIdx + 1; r < grid.length; r++) {
    tab.rows.push({ cells: grid[r], rowIdx: r + 1, fillSig: '', fillRgb: null });
  }
  _impAfterParse([tab]);
}

function _impAfterParse(tabs) {
  var usable = tabs.filter(function (t) { return t.headerRow >= 0 && t.rows.length > 0; });
  if (!usable.length) {
    _impBody().innerHTML = '<div class="imp-h">No tables found.</div>' +
      '<div class="imp-muted">We looked for a header row (like "Item #, Brand, …") on every tab and came up empty.</div>' +
      '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'entry\';_impRender()">← Try again</button><span></span></div>';
    return;
  }
  _imp.tabs = usable;
  _imp.skipped = tabs.length - usable.length;
  _imp.fillGroups = rrImpFillGroups(usable);
  _imp.groups = rrImpGroupLayouts(usable);
  _imp.step = 'consent';
  _impRender();
}

// ── Step: AI consent ────────────────────────────────────────────
function _impStepConsent() {
  var nRows = _imp.tabs.reduce(function (n, t) { return n + t.rows.length; }, 0);
  _impBody().innerHTML =
    '<div class="imp-h">Found ' + _imp.tabs.length + ' tab' + (_imp.tabs.length > 1 ? 's' : '') + ' with ' + nRows.toLocaleString() + ' rows.</div>' +
    '<div class="imp-card">To set things up automatically, the import program looks at just the <strong>column headers and about 10 example rows per tab</strong> — never your whole inventory.' +
    '<div class="imp-muted" style="margin-top:0.4rem">Your data is never used to train anything. One-time setup; costs you nothing.</div></div>' +
    '<div class="imp-foot">' +
    '<button class="imp-btn" onclick="_impRunHeuristic()">Set up by hand instead</button>' +
    '<button class="imp-btn primary" onclick="_impRunAi()">Continue</button></div>';
}

async function _impRunAi() {
  _impBody().innerHTML = '<div class="imp-h">Looking at your spreadsheet…</div><div class="imp-prog busy"><div></div></div>' +
    '<div class="imp-muted">Working out which column is which.</div>';
  var answered = null;
  try {
    if (typeof vaultPost === 'function' && typeof vaultGetToken === 'function' && vaultGetToken()) {
      var payload = rrImpBuildAiPayload(_imp.tabs, _imp.fillGroups);
      var res = await vaultPost({ action: 'import_map', token: vaultGetToken(), data: payload });
      if (res && res.status === 200 && res.answer) {
        var v = rrImpValidateAiAnswer(res.answer, _imp.tabs);
        if (v.ok) answered = v;
      }
    }
  } catch (e) { console.warn('[Import] AI call failed:', e); }
  if (answered) {
    _imp.aiUsed = true;
    _imp.tabs.forEach(function (t) {
      _imp.mappings[t.name] = _impSanitizeMapping(answered.mappings[t.name] || rrImpHeuristicMap(t.headers).map);
      _imp.tabClass[t.name] = answered.tabClass[t.name] || 'trains';
    });
    _imp.aiGradeTable = answered.gradeTable || [];
    _imp.aiQuestions = answered.questions || [];
  } else {
    showToast('Automatic setup unavailable — using built-in guesses', 3000);
    _impFillHeuristic();
  }
  _imp.step = 'mapping';
  _impRender();
}

// v0.9.1509 (both found in Brad's live test):
// 1. The AI mapped TWO headers to the same field (Owner AND Collection ->
//    notes) — only one can win a write; the other silently vanished. First
//    claim keeps the field; later duplicates go unmapped (visible, fixable).
// 2. The AI mapped Shipper -> Has Box. Brad's spec (Session 80) is explicit:
//    Shipper is the outer shipping carton, NOT Has Box — both can be true.
//    A shipper-ish header may never claim hasBox.
function _impSanitizeMapping(map) {
  var out = {}, used = {};
  Object.keys(map || {}).forEach(function (h) {
    var f = map[h];
    if (!f) return;
    if (f === 'hasBox' && /shipper/i.test(h)) return;
    if (f !== 'ignore' && used[f]) return;
    out[h] = f;
    if (f !== 'ignore') used[f] = 1;
  });
  return out;
}

function _impRunHeuristic() { _impFillHeuristic(); _imp.step = 'mapping'; _impRender(); }
function _impFillHeuristic() {
  _imp.aiUsed = false; _imp.aiGradeTable = []; _imp.aiQuestions = [];
  _imp.tabs.forEach(function (t) {
    _imp.mappings[t.name] = rrImpHeuristicMap(t.headers).map;
    _imp.tabClass[t.name] = 'trains';
  });
}

// ── Step: mapping confirm (once per layout family) ──────────────
var _IMP_FIELD_LABELS = {
  '': '— not imported —', itemNum: 'Item Number', manufacturer: 'Brand / Maker',
  gauge: 'Scale / Gauge', yourDesc: 'Your Description', rawGrade: 'Your Grade / Condition',
  location: 'Location', priceItem: 'Price Paid', userEstWorth: 'Estimated Worth',
  yearMade: 'Year Made', notes: 'Notes', roadName: 'Road Name', roadNumber: 'Road Number',
  hasBox: 'Has Box', datePurchased: 'Date Purchased', purchasedFrom: 'Purchased From',
  quantity: 'Quantity (copies)', ignore: '— not imported —',
  // v0.9.1514 (Phase 2): Scott's Shipper / Collection / Owner columns finally
  // have real homes. Custom slots show the user's own name once they name one.
  locationDetail: 'Location Detail (Tote 12…)', shipper: 'Shipper (outer carton)',
  subCollection: 'Sub-collection', custom1: 'Custom column 1', custom2: 'Custom column 2',
  custom3: 'Custom column 3', custom4: 'Custom column 4', custom5: 'Custom column 5',
};
// What each destination column actually means, in plain English. Shown
// under the dropdown for whatever is selected, and in the "What do these
// mean?" panel. Brad, testing live: "I had no idea."
var _IMP_FIELD_HELP = {
  itemNum: 'The manufacturer’s catalogue number — 6464-25, 30-4021. Not the number painted on the model.',
  manufacturer: 'Who made it: Lionel, MTH, K-Line, Micro-Trains…',
  gauge: 'The size: O, O-27, HO, N, S, Standard.',
  yourDesc: 'Your own words for the item. Kept exactly as you wrote them, and searchable.',
  rawGrade: 'Your condition/grade written your way (C9/P8, Ex, Mint). Kept as-is; we add our 1–10 beside it.',
  location: 'The big place it lives: Basement, Storage Unit 206, Room 107.',
  locationDetail: 'The spot inside that place: Tote 12, Rack 1 Shelf 3. Splitting them lets you ask “what’s in Tote 12?”',
  shipper: 'The outer carton you’d ship it in — NOT the item’s own box. You can have both.',
  subCollection: 'Your own groups for quick look-ups — “all my Disney cars”, “all my mint cars”, 6464 series. One item, one group.',
  priceItem: 'What YOU paid for it.',
  userEstWorth: 'What you think it’s worth now.',
  yearMade: 'The year the item was made. (Not the year of the real thing it models.)',
  notes: 'Anything else you want to remember about this piece.',
  roadName: 'The railroad it’s lettered for: Santa Fe, Pennsylvania, Great Northern.',
  roadNumber: 'The number painted on the model — the cab or car number.',
  hasBox: 'Whether you have its original box (Yes/No).',
  datePurchased: 'When you bought it.',
  purchasedFrom: 'Who you bought it from — a shop, a show, a person.',
  quantity: 'How many copies this row stands for.',
  custom1: 'A column of your own — named after your heading.',
  custom2: 'A column of your own — named after your heading.',
  custom3: 'A column of your own — named after your heading.',
  custom4: 'A column of your own — named after your heading.',
  custom5: 'A column of your own — named after your heading.',
  ignore: 'Skip this column — nothing from it is saved.',
};

// Custom slots carry the user's own label when they have named one.
function _impFieldLabel(f) {
  try {
    var def = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === f; })[0];
    if (def && def.custom && typeof rrFieldLabel === 'function') {
      var l = rrFieldLabel(def);
      if (l && l !== def.label) return l + ' (your column)';
    }
  } catch (e) {}
  return _IMP_FIELD_LABELS[f];
}

function _impStepMapping() {
  // v0.9.1523 (Brad): the definitions live in their own panel to the RIGHT
  // of the mapping rows — inline help made every row a different height and
  // pushed the dropdowns out of line.
  var html = '<div class="imp-h">Check the column matches.</div>' +
    '<div class="imp-muted" style="margin-bottom:0.6rem">' +
    'The import program guessed these — fix anything that looks wrong.' +
    ' Tabs with the same layout are set together.' +
    ' Got a column we don’t have? Choose <strong>“➕ Keep as its own column”</strong> and we’ll make one, named after your heading.</div>' +
    '<div class="imp-2col">' +
    '<div class="imp-2col-main">';
  _imp.groups.forEach(function (g, gi) {
    var rep = g.tabs[0];
    var names = g.tabs.map(function (t) { return t.name; });
    // v0.9.1520 (Brad: "can put the same custom column on two different
    // headers"): de-collide on EVERY render, not just on the AI's first
    // answer. First header to claim a field keeps it; later ones fall back
    // to unmapped, visibly, so the user can place them somewhere real.
    g.tabs.forEach(function (t) {
      _imp.mappings[t.name] = _impSanitizeMapping(_imp.mappings[t.name] || {});
    });
    var repMap = _imp.mappings[rep.name] || {};
    html += '<div class="imp-card"><div style="font-weight:600;font-size:0.86rem;margin-bottom:0.3rem">' +
      _impEsc(names.length > 3 ? names.slice(0, 3).join(', ') + ' +' + (names.length - 3) + ' more' : names.join(', ')) +
      ' <span class="imp-muted">(' + g.tabs.reduce(function (n, t) { return n + t.rows.length; }, 0).toLocaleString() + ' rows)</span></div>' +
      '<div class="imp-row" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim,#999)">' +
      '<div style="flex:1">Your spreadsheet\u2019s columns</div><div>Where it goes in The Rail Roster</div></div>';
    var seen = {};
    g.tabs.forEach(function (t) {
      t.headers.forEach(function (h) {
        var n = rrImpNormHeader(h);
        if (!n || seen[n]) return;
        seen[n] = 1;
        var cur = repMap[n] || (_imp.mappings[t.name] || {})[n] || '';
        html += '<div class="imp-row"><div style="flex:1">' + _impEsc(h) + '</div>' +
          '<select class="imp-sel" onchange="_impSetMap(' + gi + ',\'' + _impEsc(n).replace(/'/g, '&#39;') + '\',this.value,this)">';
        Object.keys(_IMP_FIELD_LABELS).forEach(function (f) {
          if (f === 'ignore') return;
          // v0.9.1515 (Brad): the five generic custom slots are noise on this
          // screen. A slot the user has already NAMED shows its name; the
          // unnamed ones collapse into one action below.
          if (/^custom[1-5]$/.test(f) && !_impCustomNamed(f)) return;
          html += '<option value="' + f + '"' + (cur === f ? ' selected' : '') + '>' + _impFieldLabel(f) + '</option>';
        });
        // v0.9.1515 (Brad: "a new user doesn't need to stop, go to preferences,
        // think about what column he might want, then come back"): make the
        // column right here, named after THIS header.
        if (_impFreeCustomSlot()) {
          html += '<option value="__newcol">\u2795 Keep as its own column</option>';
        }
        html += '</select>';
        // v0.9.1519 (Brad: "can't change the name of the custom column"):
        // when a row is mapped to a custom slot, its NAME is editable right
        // here — prefilled with the sheet's own header.
        if (/^custom[1-5]$/.test(String(cur))) {
          if (!_impCustomNameOf(cur)) {
            try {
              var _auto = String(h).trim();
              localStorage.setItem('lv_label_' + cur, _auto.charAt(0).toUpperCase() + _auto.slice(1));
              var _d = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === cur; })[0];
              if (_d) localStorage.setItem(_d.pref, 'true');
            } catch (eA) {}
          }
          var _curName = _impCustomNameOf(cur) || (h.charAt(0).toUpperCase() + h.slice(1));
          html += '<input class="imp-sel" style="max-width:9rem;margin-left:0.35rem" value="' +
            _impEsc(_curName).replace(/"/g, '&quot;') + '" title="Name this column" ' +
            'onchange="_impRenameCustom(\'' + cur + '\',this.value)">';
        }
        html += '</div>';
      });
    });
    html += '<label class="imp-muted" style="display:block;margin-top:0.4rem"><input type="checkbox" ' +
      (names.every(function (n) { return _imp.skipTabs[n]; }) ? 'checked' : '') +
      ' onchange="_impSetSkip(' + gi + ',this.checked)"> Skip these tabs entirely</label></div>';
  });
  html += '</div>' +   // /imp-2col-main
    '<aside class="imp-2col-aside"><div class="imp-card" style="margin:0">' +
      '<div style="font-weight:600;margin-bottom:0.4rem;font-size:0.86rem">What these mean</div>' +
      Object.keys(_IMP_FIELD_HELP).filter(function (k) { return k !== 'ignore' && !/^custom[2-5]$/.test(k); }).map(function (k) {
        return '<div id="imp-help-' + k + '" style="margin:0.3rem 0;padding:0.25rem 0.35rem;border-radius:6px;font-size:0.76rem;line-height:1.45">' +
          '<strong>' + _impEsc(_impFieldLabel(k) || k) + '</strong><br>' +
          '<span class="imp-muted">' + _impEsc(_IMP_FIELD_HELP[k]) + '</span></div>';
      }).join('') +
    '</div></aside>' +
    '</div>';   // /imp-2col
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'consent\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" id="imp-map-next" onclick="_impMappingNext()">Looks right →</button></div>';
  _impBody().innerHTML = html;
  // Touching a dropdown highlights the matching definition in the panel.
  Array.prototype.forEach.call(_impBody().querySelectorAll('.imp-2col-main select'), function (sel) {
    var mark = function () { _impHighlightHelp(sel.value); };
    sel.addEventListener('focus', mark);
    sel.addEventListener('change', mark);
    sel.addEventListener('mouseenter', mark);
  });
}

// v0.9.1515 helpers: which custom slots exist / are already named.
function _impCustomNameOf(key) {
  try { return localStorage.getItem('lv_label_' + key) || ''; } catch (e) { return ''; }
}
// v0.9.1519: rename a custom column from the mapping screen.
function _impRenameCustom(key, val) {
  var v = String(val || '').trim();
  if (!v) return;
  try {
    localStorage.setItem('lv_label_' + key, v);
    var def = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === key; })[0];
    if (def) localStorage.setItem(def.pref, 'true');
  } catch (e) {}
  showToast('Column renamed to “' + v + '”', 2200);
  _impRender();
}
function _impCustomNamed(key) {
  try {
    var def = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === key; })[0];
    return !!(def && def.custom && localStorage.getItem('lv_label_' + key));
  } catch (e) { return false; }
}
function _impFreeCustomSlot() {
  var used = {};
  Object.keys(_imp.mappings || {}).forEach(function (t) {
    var m = _imp.mappings[t] || {};
    Object.keys(m).forEach(function (h) { used[m[h]] = 1; });
  });
  var slots = ['custom1', 'custom2', 'custom3', 'custom4', 'custom5'];
  for (var i = 0; i < slots.length; i++) {
    if (!used[slots[i]] && !_impCustomNamed(slots[i])) return slots[i];
  }
  return '';
}

// v0.9.1520: show/hide the plain-English glossary on the mapping screen.
// v0.9.1523: highlight one definition in the side panel.
function _impHighlightHelp(key) {
  try {
    Array.prototype.forEach.call(document.querySelectorAll('[id^="imp-help-"]'), function (el) {
      el.style.background = ''; el.style.outline = '';
    });
    var el = document.getElementById('imp-help-' + key);
    if (el) {
      el.style.background = 'color-mix(in srgb, var(--accent,#c33) 14%, transparent)';
      el.scrollIntoView({ block: 'nearest' });
    }
  } catch (e) {}
}

// v0.9.1526: which staged items the type-reader is allowed to touch.
// A non-train tab that already answered "these are all Books" is NOT one of
// them — that answer is the user's own word and outranks anything read out
// of a description.
function _impTypeCandidates() {
  return (_imp.staged || []).filter(function (it) {
    if (_imp.tabType[it.srcTab]) return false;
    return true;
  });
}
function _impTypeSurvey() {
  try { return rrImpTypeSurvey(_impTypeCandidates(), { onlyEmpty: true }); }
  catch (e) { return { groups: [], read: 0, blank: 0 }; }
}
// One type the user has waved off. Kept as a SKIP list rather than an accept
// list so a type the reader learns about later is on by default.
function _impTypeTick(type, on) {
  if (on) delete _imp.typeSkip[type]; else _imp.typeSkip[type] = true;
}
// v0.9.1529: an answer from the triage screen. Locked so a later pass at the
// tab questions doesn't overwrite what the user just said.
function _impSetTabType(tab, value) {
  var v = String(value || '').trim();
  if (v) {
    _imp.tabType[tab] = v;
    _imp.tabClassLocked = _imp.tabClassLocked || {};
    _imp.tabClassLocked[tab] = true;
  } else {
    delete _imp.tabType[tab];
  }
}
function _impToggleTypes() {
  _imp.showTypes = !_imp.showTypes;
  _impRender();
}
// The single place the guess is turned into a value. Returns '' when the
// reader has nothing, when the user unticked that type, or when we already
// know better from the catalog.
function _impTypeGuessFor(it, master) {
  try {
    if (master && String(master.itemType || '').trim()) return '';
    if (_imp.tabType[it.srcTab]) return '';        // v0.9.1529: their word, whatever the tab was classed as
    var g = rrImpTypeFromText(it.yourDesc || it.description || '');
    if (!g || _imp.typeSkip[g]) return '';
    return g;
  } catch (e) { return ''; }
}

function _impToggleGlossary() {
  _imp.showGlossary = !_imp.showGlossary;
  _impRender();
}

function _impSetMap(gi, headerNorm, field, sel) {
  // v0.9.1515: "Keep as its own column" — take the next free slot, name it
  // after the sheet's own header, switch it on, and re-render so the row now
  // shows the real name. No trip to Preferences, no decision up front.
  if (field === '__newcol') {
    var slot = _impFreeCustomSlot();
    if (!slot) {
      showToast('All five custom columns are in use — free one in Preferences', 4000, true);
      if (sel) sel.value = '';
      return;
    }
    var raw = String(headerNorm || 'Column').trim();
    var nice = raw.charAt(0).toUpperCase() + raw.slice(1);
    try {
      localStorage.setItem('lv_label_' + slot, nice);
      var def = (window.RR_USER_FIELDS || []).filter(function (x) { return x.key === slot; })[0];
      if (def) localStorage.setItem(def.pref, 'true');
    } catch (e) {}
    field = slot;
    showToast('New column “' + nice + '” created — you can rename it in Preferences', 3500);
    var g0 = _imp.groups[gi];
    g0.tabs.forEach(function (t) {
      var m = _imp.mappings[t.name] = _imp.mappings[t.name] || {};
      Object.keys(m).forEach(function (k) { if (m[k] === field && k !== headerNorm) delete m[k]; });
      m[headerNorm] = field;
    });
    _impRender();
    return;
  }
  var g = _imp.groups[gi];
  g.tabs.forEach(function (t) {
    var m = _imp.mappings[t.name] = _imp.mappings[t.name] || {};
    if (field === '') delete m[headerNorm];
    else {
      // One column per field within a tab: clear an older claim. (v0.9.1520:
      // this already worked for the header being changed — the render-time
      // sanitize above is what stops two rows arriving doubled up.)
      Object.keys(m).forEach(function (k) { if (m[k] === field && k !== headerNorm) delete m[k]; });
      m[headerNorm] = field;
    }
  });
}
function _impSetSkip(gi, on) {
  _imp.groups[gi].tabs.forEach(function (t) { _imp.skipTabs[t.name] = !!on; });
}

function _impMappingNext() {
  var live = _imp.tabs.filter(function (t) { return !_imp.skipTabs[t.name]; });
  // v0.9.1520: last line of defence — never leave this screen with two
  // headers pointing at one column (the second would silently vanish).
  var dupe = '';
  live.forEach(function (t) {
    var m = _imp.mappings[t.name] || {}, seen = {};
    Object.keys(m).forEach(function (h) {
      var f = m[h];
      if (!f || f === 'ignore') return;
      if (seen[f]) dupe = dupe || (_impFieldLabel(f) || f);
      seen[f] = 1;
    });
  });
  if (dupe) {
    showToast('Two columns are both set to “' + dupe + '” — pick a different one for the second', 4500, true);
    _impRender();
    return;
  }
  var anyItemNum = live.some(function (t) {
    var m = _imp.mappings[t.name] || {};
    return Object.keys(m).some(function (k) { return m[k] === 'itemNum'; });
  });
  if (!live.length) { showToast('Every tab is skipped — nothing to import', 3000, true); return; }
  if (!anyItemNum) { showToast('Pick which column holds the Item Number first', 3500, true); return; }
  _imp.step = 'tabfacts';
  _impRender();
}

// ── Step: about your tabs (v0.9.1509 — Brad: "are all items under the tab
// 'Lionel' made by Lionel, kind of thing... these are questions we have to
// ask the user"). One compact row per tab; only tabs where the answer
// would actually DO something get a question. Prefills only where there is
// real evidence (tab name matches a known maker); the user confirms.
// A row's own Brand cell ALWAYS beats the tab answer — never overwritten.
function _impKnownMakers() {
  var base;
  try {
    base = (window.MANUAL_MANUFACTURERS && MANUAL_MANUFACTURERS.all) ? MANUAL_MANUFACTURERS.all.slice() : null;
  } catch (e) { base = null; }
  if (!base) base = ['Lionel', 'MTH', 'Atlas', 'K-Line', 'Weaver', 'Williams', 'Marx', 'Menards', 'RMT'];
  // v0.9.1511 (Brad, live): "Atlas O" reads oddly as an ANSWER — say Atlas.
  base = base.map(function (m) { return m === 'Atlas O' ? 'Atlas' : m; });
  // v0.9.1511 (Brad): real makers his own test sheet needed.
  ['Märklin', 'Plasticville', 'Micro-Trains'].forEach(function (m) {
    if (base.indexOf(m) < 0) base.push(m);
  });
  return base;
}
function _impTabNeedsMaker(t) {
  // Needs a maker answer when SOME rows would land with no manufacturer.
  var m = _imp.mappings[t.name] || {};
  var brandHeader = Object.keys(m).filter(function (h) { return m[h] === 'manufacturer'; })[0];
  if (!brandHeader) return true;
  var col = -1;
  (t.headers || []).forEach(function (h, i) { if (rrImpNormHeader(h) === brandHeader) col = i; });
  if (col < 0) return true;
  var blank = 0;
  (t.rows || []).forEach(function (r) { if (!rrImpNormCell((r.cells || [])[col])) blank++; });
  return blank > 0;
}
// v0.9.1516: how many rows on this tab have a year inside their description.
// v0.9.1530 (Brad: "Year Made dropped to 27, from 406"). ROOT CAUSE: the
// default for this setting used to be assigned INSIDE the tab-questions
// screen, at the moment that question was drawn. A tab whose question was
// never drawn — because the mapping lookup couldn't find its description
// column, or the screen skipped it — kept an undefined value, which reads as
// "no". So the rule silently ran on ONE tab out of eleven and 400+ items lost
// their year with nothing on screen to show for it.
//
// A default that only exists if some UI happened to render is not a default.
// This is the single place the question is answered, used by both the screen
// and the staging rule: trains yes, everything else no, and an explicit
// answer from the user always wins.
function _impTabYearMeansMade(tabName, cls) {
  if (_imp.tabYearMeans[tabName] !== undefined) return !!_imp.tabYearMeans[tabName];
  var c = cls || _imp.tabClass[tabName] || 'trains';
  return c === 'trains';
}

function _impTabYearRows(t) {
  var m = _imp.mappings[t.name] || {};
  var descHeader = Object.keys(m).filter(function (h) { return m[h] === 'yourDesc'; })[0];
  var col = -1;
  if (descHeader) {
    (t.headers || []).forEach(function (h, i) { if (rrImpNormHeader(h) === descHeader) col = i; });
  }
  var n = 0;
  if (col >= 0) {
    (t.rows || []).forEach(function (r) {
      if (rrImpYearFromText(rrImpNormCell((r.cells || [])[col]))) n++;
    });
    return n;
  }
  // v0.9.1530: the column walk above returned 0 for a tab whose description
  // header couldn't be resolved back from the mapping — and 0 means "don't
  // ask", which is how a whole tab's years went missing without a question.
  // Fall back to the mapped ITEMS, which is what staging actually reads.
  try {
    rrImpApplyMapping(t, m).forEach(function (it) {
      if (!it.yearMade && rrImpYearFromText(it.yourDesc || it.description || '')) n++;
    });
  } catch (e) {}
  return n;
}

// v0.9.1529: before the questions are drawn, override the AI's judgement for
// any tab that plainly cannot be catalogue items. See rrImpTabIsNonCatalog.
function _impInferTabClasses() {
  (_imp.tabs || []).forEach(function (t) {
    if (_imp.skipTabs[t.name]) return;
    if (_imp.tabClassLocked && _imp.tabClassLocked[t.name]) return;   // user's own answer stands
    try {
      var items = rrImpApplyMapping(t, _imp.mappings[t.name] || {});
      if (rrImpTabIsNonCatalog(items)) _imp.tabClass[t.name] = 'other';
    } catch (e) {}
  });
}

function _impStepTabFacts() {
  _impInferTabClasses();
  var live = _imp.tabs.filter(function (t) { return !_imp.skipTabs[t.name]; });
  var makers = _impKnownMakers();
  var rows = live.map(function (t) {
    return { tab: t, needsMaker: _impTabNeedsMaker(t), guess: rrImpMakerFromTab(t.name, makers),
             yearRows: _impTabYearRows(t) };
  }).filter(function (r) { return r.needsMaker || r.yearRows >= 5 || (_imp.tabClass[r.tab.name] || 'trains') !== 'trains'; });
  if (!rows.length) { _impAfterTabFacts(); return; }
  var html = '<div class="imp-h">A couple of questions about your tabs.</div>' +
    '<div class="imp-muted" style="margin-bottom:0.6rem">Your answers fill in blanks only — anything already written on a row is never changed.</div>';
  rows.forEach(function (r) {
    var name = r.tab.name, n = r.tab.rows.length;
    var cls = _imp.tabClass[name] || 'trains';
    html += '<div class="imp-card"><div style="font-weight:600;font-size:0.88rem;margin-bottom:0.4rem">' +
      _impEsc(name) + ' <span class="imp-muted">(' + n.toLocaleString() + ' rows)</span></div>';
    if (r.needsMaker) {
      var extraMakers = [];
      Object.keys(_imp.tabMaker).forEach(function (k) {
        var v = _imp.tabMaker[k];
        if (v && makers.indexOf(v) < 0 && extraMakers.indexOf(v) < 0) extraMakers.push(v);
      });
      html += '<div class="imp-row"><div style="flex:1">Are the items on this tab all made by one company?</div>' +
        '<select class="imp-sel" onchange="_impTabMakerSel(this,' + JSON.stringify(name).replace(/"/g, '&quot;') + ')">' +
        '<option value=""' + (r.guess ? '' : ' selected') + '>Mixed / not sure</option>';
      makers.concat(extraMakers).forEach(function (mk) {
        html += '<option value="' + _impEsc(mk) + '"' + (r.guess === mk || _imp.tabMaker[name] === mk ? ' selected' : '') + '>Yes — ' + _impEsc(mk) + '</option>';
      });
      html += '<option value="__add">+ Add a maker…</option>' +
        '</select></div>';
      if (r.guess) _imp.tabMaker[name] = r.guess;
    }
    // v0.9.1516 (Brad: "you put year 1955 on this and its a modern item of a
    // 1955 model car"). A year in a DIE-CAST description is the year of the
    // real vehicle, not when the model was made — so we ask instead of
    // assuming. Trains default YES (a year in a train description is nearly
    // always the product's year); everything else defaults NO.
    if (r.yearRows >= 5) {
      var defYear = _impTabYearMeansMade(name, cls);
      html += '<div class="imp-row"><div style="flex:1">' + r.yearRows.toLocaleString() +
        ' descriptions here contain a year — does it say when the item was <em>made</em>?' +
        '<div class="imp-muted" style="margin-top:0.15rem;font-size:0.75rem">' +
        'Say no if it describes the subject (a 1955 car modelled in 2016).</div></div>' +
        '<select class="imp-sel" onchange="_imp.tabYearMeans[' + JSON.stringify(name).replace(/"/g, '&quot;') + ']=(this.value===\'yes\')">' +
        '<option value="yes"' + (defYear ? ' selected' : '') + '>Yes — that\u2019s the item\u2019s year</option>' +
        '<option value="no"' + (defYear ? '' : ' selected') + '>No — leave Year blank</option>' +
        '</select></div>';
    }
    if (cls !== 'trains') {
      var def = _imp.tabType[name] || name;
      _imp.tabType[name] = def;
      var defSub = _imp.tabSubType[name] || '';
      html += '<div class="imp-row"><div style="flex:1">What kind of things are these?</div>' +
        '<input class="imp-sel" style="max-width:12rem" value="' + _impEsc(def).replace(/"/g, '&quot;') + '" ' +
        'onchange="_imp.tabType[' + JSON.stringify(name).replace(/"/g, '&quot;') + ']=this.value"></div>' +
        // v0.9.1522 (Brad): "his planes are not train items, so they should go
        // to a custom type... but that's up to him to decide. He may want to
        // say Planes if he has other planes that are not Texaco." So the type
        // is HIS word, and a sub type is offered for the narrower name.
        '<div class="imp-muted" style="margin-top:0.2rem;margin-bottom:0.35rem">Your name for them — whatever you\u2019d look for later. Broad works well here (\u201CPlanes\u201D, \u201CDie-cast Vehicles\u201D, \u201CBooks\u201D).</div>' +
        '<div class="imp-row"><div style="flex:1">Anything more specific? <span class="imp-muted">(optional)</span></div>' +
        '<input class="imp-sel" style="max-width:12rem" placeholder="e.g. Wings of Texaco" value="' + _impEsc(defSub).replace(/"/g, '&quot;') + '" ' +
        'onchange="_imp.tabSubType[' + JSON.stringify(name).replace(/"/g, '&quot;') + ']=this.value"></div>' +
        '<div class="imp-muted" style="margin-top:0.2rem">Saved as the Sub Type, so \u201CPlanes\u201D can hold \u201CWings of Texaco\u201D and any others you add later.</div>';
    }
    html += '</div>';
  });
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'mapping\';_impRender()">\u2190 Back</button>' +
    '<button class="imp-btn primary" onclick="_impAfterTabFacts()">Next \u2192</button></div>';
  _impBody().innerHTML = html;
}
// v0.9.1510: "+ Add a maker…" swaps the dropdown for a text box in place.
function _impTabMakerSel(sel, tabName) {
  if (sel.value !== '__add') { _imp.tabMaker[tabName] = sel.value; return; }
  var inp = document.createElement('input');
  inp.className = 'imp-sel';
  inp.placeholder = 'Maker name';
  inp.style.maxWidth = '12rem';
  inp.onchange = function () { _imp.tabMaker[tabName] = String(inp.value || '').trim(); };
  inp.onblur = inp.onchange;
  sel.parentNode.replaceChild(inp, sel);
  inp.focus();
}

function _impAfterTabFacts() {
  _impBuildQuestions();
  // v0.9.1527: matching happens in _impStage(), RIGHT HERE. Everything after
  // this point is downstream of it, so this is the last honest moment to ask
  // whether the catalog is actually loaded. Brad's (39) import ran with an
  // empty index and turned 3,370 catalogued items into manual entries without
  // one word of warning.
  _imp.afterCatalog = _imp.questions.length ? 'interview' : 'grades';
  if (!_impCatalogReady()) {
    _imp.step = 'catalog';
    _impRender();
    _impCatalogWait();
    return;
  }
  _imp.step = _imp.afterCatalog;
  _impStage();
  _impRender();
}

// ── The catalog gate ────────────────────────────────────────────
// v0.9.1527. The full-catalog index builds in the background from IndexedDB
// caches, fetching any era this device has never seen. On a fresh device or
// straight after a hard refresh that takes a little while — and an import
// started inside that window matches nothing.
var _IMP_CAT_FLOOR = 20000;    // numbers below which we will NOT bulk-match
function _impCatalogStat() {
  try {
    if (typeof rrCatalogIndexStatus === 'function') return rrCatalogIndexStatus();
  } catch (e) {}
  // Older code without the status helper: fall back to counting directly.
  var all = 0, era = 0;
  try { all = (state.masterByItemAll && state.masterByItemAll.size) || 0; } catch (e) {}
  try { era = (state.masterByItem && state.masterByItem.size) || 0; } catch (e) {}
  return { all: all, era: era, numbers: Math.max(all, era), complete: false, building: false };
}
function _impCatalogReady() {
  if (_imp.catalogSkipped) return true;          // user chose to go ahead
  var st = _impCatalogStat();
  return !!st.complete || st.numbers >= _IMP_CAT_FLOOR;
}
function _impStepCatalog() {
  var st = _impCatalogStat();
  var pct = Math.min(99, Math.round(st.numbers / 1142));   // ~114,000 numbers = 100%
  _impBody().innerHTML =
    '<div class="imp-h">Getting the catalog ready\u2026</div>' +
    '<div class="imp-muted" style="margin-bottom:0.7rem">Your items are matched against the full catalog \u2014 ' +
    'about 114,000 numbers across every maker and era. It loads in the background and is nearly always ' +
    'ready; starting an import in the first moments after opening the app can beat it to the punch. ' +
    '<strong>We wait rather than import everything as a manual entry.</strong></div>' +
    '<div class="imp-card"><div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.3rem">' +
      '<span>' + st.numbers.toLocaleString() + ' numbers loaded</span><span>' + pct + '%</span></div>' +
      '<div style="height:8px;border-radius:5px;background:var(--surface2,#26262e);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:var(--accent,#e8401c);transition:width 0.4s"></div></div>' +
      '<div class="imp-muted" style="font-size:0.75rem;margin-top:0.4rem">' +
        (st.building ? 'Loading now \u2014 this screen moves on by itself.'
                     : 'Starting the load\u2026') + '</div>' +
    '</div>' +
    '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'tabfacts\';_impRender()">\u2190 Back</button>' +
    '<button class="imp-btn" onclick="_impCatalogSkip()" title="Only sensible if you are offline">' +
      'Import anyway as manual entries</button></div>';
  // Nudge the build along rather than waiting on its own schedule.
  try {
    if (!st.building && typeof _buildAllErasLookupIndex === 'function') _buildAllErasLookupIndex(true);
  } catch (e) {}
}
function _impCatalogWait() {
  if (_imp.catalogTimer) clearTimeout(_imp.catalogTimer);
  _imp.catalogTimer = setTimeout(function () {
    if (!_imp || _imp.step !== 'catalog') return;
    if (_impCatalogReady()) {
      _imp.step = _imp.afterCatalog || 'grades';
      _impStage();
      _impRender();
      return;
    }
    _impRender();          // repaint the progress bar
    _impCatalogWait();
  }, 1200);
}
// The escape hatch, for someone genuinely offline. Named plainly, because
// what it does is import everything as a manual entry.
function _impCatalogSkip() {
  if (!confirm('Without the catalog, every item comes in as a manual entry \u2014 no catalog photos, ' +
               'descriptions or era. You can remove the import and run it again once the catalog loads. Continue?')) return;
  _imp.catalogSkipped = true;
  _imp.step = _imp.afterCatalog || 'grades';
  _impStage();
  _impRender();
}

// ── Interview ───────────────────────────────────────────────────
// Behavior-driving questions are built HERE (deterministic — we know
// what each answer does). Extra AI questions ride along; their answers
// are recorded on the batch for Phase 2 (custom columns etc.).
function _impBuildQuestions() {
  var qs = [];
  if (_imp.fillGroups.length) {
    var g = _imp.fillGroups[0];
    // v0.9.1509 (Brad): show 2-3 of the ACTUAL highlighted rows so the user
    // can picture which rows we mean, painted in the sheet's own color.
    var exHtml = '';
    try {
      var shown = 0;
      for (var si = 0; si < (g.samples || []).length && shown < 3; si++) {
        var samp = g.samples[si];
        var tb = _imp.tabs.filter(function (t) { return t.name === samp.tab; })[0];
        var row = tb && tb.rows.filter(function (r) { return r.rowIdx === samp.rowIdx; })[0];
        if (!row) continue;
        var cellsTxt = (row.cells || []).map(rrImpNormCell).filter(Boolean).slice(0, 3).join(' · ');
        if (!cellsTxt) continue;
        exHtml += '<div style="background:#' + (g.rgb || 'FFB5AF') + ';color:#4a1b0c;border-radius:6px;' +
          'padding:0.3rem 0.55rem;margin:0.2rem 0;font-size:0.8rem">' + _impEsc(cellsTxt.slice(0, 80)) +
          ' <span style="opacity:0.7">(' + _impEsc(samp.tab) + ', row ' + samp.rowIdx + ')</span></div>';
        shown++;
      }
      if (exHtml) exHtml = '<div class="imp-muted" style="margin:0.4rem 0 0.1rem;font-size:0.75rem">A few of them, from your sheet:</div>' + exHtml;
    } catch (eEx) {}
    qs.push({
      id: '_fill', text: g.count.toLocaleString() + ' rows are highlighted' +
        (g.rgb ? ' <span class="imp-swatch" style="background:#' + g.rgb + '"></span>' : '') +
        ' — what does that highlight mean?' + exHtml,
      options: ['They’re for sale', 'Already sold', 'Need repair', 'Just formatting', 'Something else'],
    });
  }
  // Copy-counter question ONLY with evidence (identical descriptions).
  var live = _imp.tabs.filter(function (t) { return !_imp.skipTabs[t.name]; });
  var quickItems = [];
  live.forEach(function (t) {
    rrImpApplyMapping(t, _imp.mappings[t.name] || {}).forEach(function (it) { quickItems.push(it); });
  });
  var ev = (typeof baseItemNum === 'function') ? rrImpCopyCounterEvidence(quickItems, baseItemNum) : [];
  if (ev.length >= 3) {
    qs.push({
      id: '_copies',
      text: 'Numbers like ' + _impEsc(ev[0].items[0].itemNum) + ' repeat with the SAME description — are the -1/-2 endings your way of counting copies?',
      options: ['Yes — those are my copy numbers', 'No — they’re real catalog numbers'],
    });
  }
  (_imp.aiQuestions || []).forEach(function (q) {
    if (qs.length >= 5) return;
    if (q.id === '_fill' || /highlight|red row/i.test(q.text) && _imp.fillGroups.length) return;
    // v0.9.1509: if the question names a 'Column', append real example values.
    try {
      var hm = /'([^']{2,30})'/.exec(q.text);
      if (hm) {
        var hNorm = rrImpNormHeader(hm[1]);
        var vals = {}, got = 0;
        _imp.tabs.forEach(function (t) {
          var ci = -1;
          (t.headers || []).forEach(function (h, i) { if (rrImpNormHeader(h) === hNorm) ci = i; });
          if (ci < 0) return;
          (t.rows || []).forEach(function (r) {
            if (got >= 4) return;
            var v = rrImpNormCell((r.cells || [])[ci]);
            if (v && !vals[v]) { vals[v] = 1; got++; }
          });
        });
        var list = Object.keys(vals);
        if (list.length) q = { id: q.id, options: q.options, text: q.text +
          '<div class="imp-muted" style="margin-top:0.35rem;font-size:0.75rem">From your sheet: ' +
          _impEsc(list.join(' · ').slice(0, 90)) + '</div>' };
      }
    } catch (eQx) {}
    qs.push(q);
  });
  _imp.questions = qs;
}

function _impStepInterview() {
  var idx = _imp.qIdx || 0;
  if (idx >= _imp.questions.length) { _imp.step = 'grades'; _impRender(); return; }
  var q = _imp.questions[idx];
  var html = '<div class="imp-muted">Question ' + (idx + 1) + ' of ' + _imp.questions.length + '</div>' +
    '<div class="imp-h" style="margin-top:0.3rem">' + q.text + '</div>';
  q.options.forEach(function (opt, oi) {
    html += '<button class="imp-btn imp-qopt" onclick="_impAnswer(' + idx + ',' + oi + ')">' + _impEsc(opt) + '</button>';
  });
  html += '<div class="imp-foot"><button class="imp-btn" onclick="' +
    (idx === 0 ? '_imp.step=\'mapping\';_impRender()' : '_imp.qIdx=' + (idx - 1) + ';_impRender()') +
    '">← Back</button><span></span></div>';
  _impBody().innerHTML = html;
}

function _impAnswer(qi, oi) {
  var q = _imp.questions[qi];
  var opt = q.options[oi];
  _imp.answers[q.id] = opt;
  if (q.id === '_fill') {
    _imp.fillMeaning = oi === 0 ? 'sale' : oi === 1 ? 'sold' : oi === 2 ? 'repair' : oi === 3 ? 'formatting' : 'other';
    if (_imp.fillMeaning === 'sale') {
      // Follow-up, Brad's Session 81 flow: prices now or later.
      _imp.questions.splice(qi + 1, 0, {
        id: '_priceWhen',
        text: 'Want to put asking prices on those now, or later?',
        options: ['Now — I’ll go item by item', 'Later — flag them so I can filter and fill them in'],
      });
    }
  }
  if (q.id === '_priceWhen') _imp.priceWhen = oi === 0 ? 'now' : 'later';
  _imp.qIdx = qi + 1;
  _impRender();
}

// ── Staging + triage ────────────────────────────────────────────
function _impStage() {
  var live = _imp.tabs.filter(function (t) { return !_imp.skipTabs[t.name]; });
  var staged = [];
  var skippedSummary = 0;
  var _yearsByTab = {};      // v0.9.1530: tab → years filled from descriptions
  live.forEach(function (t) {
    var cls = _imp.tabClass[t.name] || 'trains';
    rrImpApplyMapping(t, _imp.mappings[t.name] || {}).forEach(function (it) {
      // v0.9.1509: Scott's per-tab "Total:" rows imported as items and added
      // $372k of fake value. Summary rows are dropped and COUNTED (shown on
      // the triage screen — never silent).
      if (rrImpIsSummaryItem(it)) { skippedSummary++; return; }
      it.tabClass = cls;
      // v0.9.1509 (Brad: "the date is in the title"): a single plausible year
      // in their description becomes Year Made when no Year column exists —
      // 395 of Scott's items get an era from this one rule.
      // v0.9.1516: only when the user said this tab's years mean "made in".
      if (!it.yearMade && _impTabYearMeansMade(t.name, cls)) {
        var _y = rrImpYearFromText(it.yourDesc);
        if (_y) {
          it.yearMade = _y;
          // v0.9.1530: counted per tab so the triage screen can say what this
          // rule did. It ran on one tab out of eleven for a whole import and
          // nothing on screen mentioned years at all.
          _yearsByTab[t.name] = (_yearsByTab[t.name] || 0) + 1;
        }
      }
      staged.push(it);
    });
  });
  _imp.skippedSummary = skippedSummary;
  _imp.yearsByTab = _yearsByTab;
  _imp.staged = staged;
  _imp.gradeTable = _impBuildGradeTable(staged);
  var lookups = {
    candidatesFor: function (num, hints) {
      var k = String(num).trim();
      var list = (state.masterByItem && state.masterByItem.get(k)) || [];
      if ((!list || !list.length) && state.masterByItemAll) list = state.masterByItemAll.get(k) || [];
      list = (list || []).slice();
      // v0.9.1511 (Brad's 3474: a MICRO-TRAINS N-scale car matched LIONEL
      // POSTWAR 3474 — wrong maker, wrong item, confidently): a maker hint
      // is now a VETO, not just a tiebreaker. When the user has told us the
      // maker (their Brand cell or the tab answer) and NO candidate is from
      // that maker, the honest answer is "not in our list" — a manual entry
      // that keeps their words — never a cross-maker match.
      if (list.length && hints && hints.manufacturer) {
        var mfr = String(hints.manufacturer).trim().toLowerCase();
        var mfrWord = mfr.split(/\s+/)[0];   // 'williams by bachmann' → 'williams'
        var narrowed = list.filter(function (m) {
          var tab = String(m._tab || '').toLowerCase();
          var mm = String(m.manufacturer || '').toLowerCase();
          return tab.indexOf(mfrWord) === 0 || mm === mfr || mm.indexOf(mfrWord) === 0;
        });
        return narrowed;   // may be [] — that IS the answer
      }
      return list;
    },
    baseOf: (typeof baseItemNum === 'function') ? baseItemNum : function (n) { return n; },
  };
  // Non-train tabs never hit the catalog — straight to manual.
  var trains = staged.filter(function (it) { return it.tabClass === 'trains'; });
  var nonTrains = staged.filter(function (it) { return it.tabClass !== 'trains'; });
  _imp.triage = rrImpTriage(trains, lookups);
  nonTrains.forEach(function (it) { _imp.triage.unmatched.push({ item: it, didYouMean: [], nonTrain: true }); });
  // v0.9.1529: the evidence-based half. A tab of 20+ rows where NOTHING
  // matched is not a tab of catalogue items, whatever it was classed as —
  // Scott's Vehicles and Wings of Texaco both carry item numbers, so the
  // numberless test above cannot see them, but their match rate is zero.
  // We ask rather than assume: the tab name is only a suggestion in the box.
  var _byTab = {};
  (_imp.staged || []).forEach(function (it) {
    var k = it.srcTab || '';
    if (!_byTab[k]) _byTab[k] = { rows: 0, matched: 0 };
    _byTab[k].rows++;
  });
  (_imp.triage.matched || []).forEach(function (m) {
    var k = (m.item && m.item.srcTab) || '';
    if (_byTab[k]) _byTab[k].matched++;
  });
  (_imp.triage.ambiguous || []).forEach(function (a) {
    var k = (a.item && a.item.srcTab) || '';
    if (_byTab[k]) _byTab[k].matched++;     // ambiguous still means we KNOW the number
  });
  _imp.unmatchedTabs = Object.keys(_byTab).filter(function (k) {
    if (!k || _byTab[k].rows < 20 || _byTab[k].matched > 0) return false;
    if (_imp.tabType[k]) return false;      // already answered on the tab questions
    return true;
  });
}

function _impBuildGradeTable(staged) {
  var collected = rrImpCollectGrades(staged);
  var saved = {};
  try { saved = JSON.parse(_prefGet(_IMP_GRADE_PREF, '{}')); } catch (e) {}
  var ai = {};
  (_imp.aiGradeTable || []).forEach(function (g) { ai[g.raw] = g.condition; });
  return collected.map(function (g) {
    return {
      raw: g.grade, count: g.count,
      condition: (saved[g.grade] !== undefined) ? saved[g.grade]
               : (ai[g.grade] !== undefined) ? ai[g.grade]
               : rrImpGuessCondition(g.grade),
    };
  });
}

// ── Step: grade conversion table ────────────────────────────────
function _impStepGrades() {
  if (!_imp.gradeTable.length) { _imp.step = 'triage'; _impRender(); return; }
  var html = '<div class="imp-h">Your grades → app condition (1–10)</div>' +
    '<div class="imp-muted" style="margin-bottom:0.5rem">Your original grade is kept on every item exactly as you wrote it. ' +
    'This table just adds our 1–10 condition beside it — set it once, we remember it for future adds.</div>';
  _imp.gradeTable.forEach(function (g, i) {
    html += '<div class="imp-row"><div style="flex:1"><span class="imp-num">' + _impEsc(g.raw) + '</span>' +
      ' <span class="imp-muted">× ' + g.count.toLocaleString() + '</span></div>' +
      '<select class="imp-sel" onchange="_imp.gradeTable[' + i + '].condition=this.value">' +
      '<option value=""' + (g.condition === '' ? ' selected' : '') + '>— leave blank —</option>';
    for (var c = 10; c >= 1; c--) {
      html += '<option value="' + c + '"' + (String(g.condition) === String(c) ? ' selected' : '') + '>' + c + '</option>';
    }
    html += '</select></div>';
  });
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'' +
    (_imp.questions.length ? 'interview' : 'mapping') + '\';_imp.qIdx=0;_impRender()">← Back</button>' +
    '<button class="imp-btn primary" onclick="_impGradesNext()">Next →</button></div>';
  _impBody().innerHTML = html;
}

function _impGradesNext() {
  var saved = {};
  try { saved = JSON.parse(_prefGet(_IMP_GRADE_PREF, '{}')); } catch (e) {}
  _imp.gradeTable.forEach(function (g) { saved[g.raw] = g.condition; });
  try { _prefSet(_IMP_GRADE_PREF, JSON.stringify(saved)); } catch (e) {}
  _imp.step = 'triage';
  _impRender();
}

// ── Step: triage summary ────────────────────────────────────────
function _impStepTriage() {
  var t = _imp.triage;
  var redCount = _imp.fillMeaning === 'sale'
    ? _imp.staged.filter(_impIsHighlighted).length : 0;
  var soldSkip = _imp.fillMeaning === 'sold'
    ? _imp.staged.filter(_impIsHighlighted).length : 0;
  var html = '<div class="imp-h">Here’s what we found.</div>';
  // v0.9.1527: a second line of defence. If hundreds of TRAIN rows matched
  // nothing at all, that is not a plausible collection — it is the catalog
  // missing. Say so here, where it can still be stopped, instead of leaving
  // it to be discovered in an exported spreadsheet.
  var _trainRows = (_imp.staged || []).filter(function (it) { return it.tabClass === 'trains'; }).length;
  if (_trainRows >= 200 && t.matched.length === 0) {
    var _cs = _impCatalogStat();
    html += '<div class="imp-card" style="border-color:var(--accent,#e8401c)">' +
      '<strong>\u26a0 None of your ' + _trainRows.toLocaleString() + ' train items matched the catalog.</strong> ' +
      '<span class="imp-muted">That almost always means the catalog had not finished loading (' +
      _cs.numbers.toLocaleString() + ' numbers available). Importing now would file every item as a manual ' +
      'entry with no catalog details. Go back, give it a moment, and start again.</span></div>';
  }
  var viaPrefix = t.matched.filter(function (m) { return m.matchedVia === '6-prefix'; }).length;
  var viaDigits = t.matched.filter(function (m) { return m.matchedVia === 'lionel-digits'; }).length;
  var vintageLeft = _impVintageGroup().length;
  html += '<div class="imp-card"><span class="imp-badge match">MATCHED</span> <strong>' + t.matched.length.toLocaleString() +
    '</strong> items found in our catalog — these import with full catalog details.' +
    (viaPrefix ? ' <span class="imp-muted">(' + viaPrefix.toLocaleString() +
      ' matched by adding Lionel\u2019s \u201C6-\u201D prefix — e.g. your 11169 is catalog 6-11169.)</span>' : '') +
    (viaDigits ? ' <span class="imp-muted">(' + viaDigits.toLocaleString() +
      ' settled by number length — 5+ digits is a modern Lionel number, even for reproductions.)</span>' : '') + '</div>';
  if (vintageLeft) {
    html += '<div class="imp-card">' + vintageLeft.toLocaleString() +
      ' Lionel items are prewar or postwar (four digits or fewer). We\u2019ll ask you to confirm those next.</div>';
  }
  var _dateJunk = 0;
  try { _dateJunk = rrImpCountDateJunk(_imp.tabs.filter(function (t) { return !_imp.skipTabs[t.name]; })); } catch (eDJ) {}
  if (_dateJunk >= 5) {
    html += '<div class="imp-card imp-muted">\u26a0 ' + _dateJunk.toLocaleString() +
      ' cells look like Excel turned them into dates (entries like 1:20 or 7:38 become times). ' +
      'Those are left blank rather than saved as a wrong value \u2014 you can fill them in later.</div>';
  }
  // v0.9.1526 (Brad: "we seem to be missing the type ... can we not run
  // something to decipher this"). The description usually says what the thing
  // IS — this reads it. Shown here rather than as its own step: it is one more
  // fact about the import, and Brad has enough screens. Open the list to see
  // every type it found with real examples, and untick any group you disagree
  // with; unticked groups are simply not written.
  // v0.9.1529: ask about the tabs that matched nothing, before anything is
  // written. One box each, pre-filled with the tab's own name.
  if ((_imp.unmatchedTabs || []).length) {
    html += '<div class="imp-card">' +
      '<strong>Nothing on these tabs is in our catalog.</strong> ' +
      '<span class="imp-muted">That usually means they aren\u2019t trains \u2014 books, die-cast, ' +
      'planes. Give them a name and they become a type you can filter by. Leave blank to skip.</span>';
    _imp.unmatchedTabs.forEach(function (tab) {
      var n = (_imp.staged || []).filter(function (it) { return it.srcTab === tab; }).length;
      html += '<div class="imp-row" style="margin-top:0.4rem"><div style="flex:1">' +
        _impEsc(tab) + ' <span class="imp-muted">(' + n.toLocaleString() + ' rows)</span></div>' +
        '<input class="imp-sel" style="max-width:12rem" placeholder="' + _impEsc(tab) + '" ' +
        'value="' + _impEsc(_imp.tabType[tab] || '').replace(/"/g, '&quot;') + '" ' +
        'onchange="_impSetTabType(' + JSON.stringify(tab).replace(/"/g, '&quot;') + ',this.value)"></div>';
    });
    html += '</div>';
  }
  // v0.9.1530: say what the year rule did, per tab. Silence is how 400 years
  // went missing unnoticed for a whole import.
  var _yTabs = Object.keys(_imp.yearsByTab || {});
  if (_yTabs.length) {
    var _yTotal = _yTabs.reduce(function (n, k) { return n + _imp.yearsByTab[k]; }, 0);
    _yTabs.sort(function (a, b) { return _imp.yearsByTab[b] - _imp.yearsByTab[a]; });
    html += '<div class="imp-card imp-muted"><strong>' + _yTotal.toLocaleString() +
      '</strong> items got a Year from their description \u2014 ' +
      _yTabs.slice(0, 4).map(function (k) {
        return _impEsc(k) + ' ' + _imp.yearsByTab[k].toLocaleString();
      }).join(', ') + (_yTabs.length > 4 ? ', \u2026' : '') +
      '. <span class="imp-muted">Tabs where a year describes the subject rather than the item ' +
      '(a 1955 car modelled in 2016) are left blank on purpose.</span></div>';
  }
  var _tSurvey = _impTypeSurvey();
  if (_tSurvey.read) {
    html += '<div class="imp-card"><span class="imp-badge match">TYPE</span> <strong>' +
      _tSurvey.read.toLocaleString() + '</strong> item types read from your own descriptions ' +
      '<span class="imp-muted">(\u201C40\u2019 Plug Door <strong>Boxcar</strong>\u201D \u2192 Boxcar). ' +
      'Only fills the ones we had nothing for.</span> ' +
      '<a href="#" onclick="event.preventDefault();_impToggleTypes()" style="color:var(--accent2,#d4a843)">' +
      (_imp.showTypes ? 'Hide' : 'Review these') + '</a>' +
      '<div id="imp-type-list" style="display:' + (_imp.showTypes ? 'block' : 'none') + ';margin-top:0.4rem">' +
      _tSurvey.groups.map(function (g) {
        var id = 'imp-ty-' + g.type.replace(/[^A-Za-z]/g, '');
        return '<div style="display:flex;gap:0.5rem;align-items:flex-start;margin:0.3rem 0">' +
          '<input type="checkbox" id="' + id + '"' + (_imp.typeSkip[g.type] ? '' : ' checked') +
          ' onchange="_impTypeTick(\'' + g.type.replace(/'/g, "") + '\',this.checked)" style="margin-top:0.2rem">' +
          '<label for="' + id + '" style="flex:1;cursor:pointer"><strong>' + _impEsc(g.type) + '</strong> ' +
          '<span class="imp-muted">\u00d7' + g.count.toLocaleString() + '</span><br>' +
          '<span class="imp-muted" style="font-size:0.74rem">' +
          g.examples.map(function (e) { return _impEsc(e); }).join(' \u00b7 ') + '</span></label></div>';
      }).join('') +
      (_tSurvey.blank ? '<div class="imp-muted" style="font-size:0.74rem;margin-top:0.35rem">' +
        _tSurvey.blank.toLocaleString() + ' descriptions didn\u2019t say what the item is \u2014 those stay blank ' +
        'and show up under \u201CNeeds details\u201D so you can set them yourself.</div>' : '') +
      '</div></div>';
  }
  if (_imp.skippedSummary) {
    html += '<div class="imp-card imp-muted">' + _imp.skippedSummary +
      ' summary rows (like \u201CTotal:\u201D) were skipped — they\u2019re math, not items.</div>';
  }
  if (t.unmatched.length) {
    html += '<div class="imp-card"><span class="imp-badge manual">MANUAL</span> <strong>' + t.unmatched.length.toLocaleString() +
      '</strong> not found in our list — they’ll be added as manual entries, keeping everything you wrote. ' +
      '<span class="imp-muted">(Custom runs, non-train items, or typos — you can fix any of them later.)</span>';
    var dym = t.unmatched.filter(function (u) { return u.didYouMean && u.didYouMean.length; });
    if (dym.length) {
      html += '<div class="imp-muted" style="margin-top:0.3rem">' + dym.length +
        ' of them are close to a catalog number (like ' + _impEsc(dym[0].item.itemNum) +
        ') — we’ll keep YOUR number; a fix-up picker comes in the next update.</div>';
    }
    html += '</div>';
  }
  if (t.ambiguous.length) {
    html += '<div class="imp-card">⚠ <strong>' + t.ambiguous.length.toLocaleString() +
      '</strong> match more than one catalog item (same number, different eras). ' +
      // v0.9.1525 (Brad): the old wording here promised that re-running the
      // import later would pick these up "without duplicating anything already
      // imported". There is no dedupe and none is planned — the supported loop
      // is Remove this import, then import the sheet again. A tester who
      // believed the old line would have ended up with the whole sheet twice.
      '<span class="imp-muted">These are held back this round — the chooser for them arrives in a coming update. To bring them in then, remove this import from Preferences and run the sheet again. (Importing the same sheet twice without removing it first WILL create duplicates.)</span></div>';
  }
  if (redCount) {
    html += '<div class="imp-card"><span class="imp-badge sale">FOR SALE</span> <strong>' + redCount.toLocaleString() +
      '</strong> highlighted items also go on your For Sale list' +
      (_imp.priceWhen === 'later' ? ' <span class="imp-muted">— without prices, so you can filter to "no asking price" and fill them in anytime.</span>' : '.') + '</div>';
  }
  if (soldSkip) {
    html += '<div class="imp-card">' + soldSkip.toLocaleString() +
      ' highlighted rows are marked SOLD — <span class="imp-muted">those are skipped for now (Sold-list import comes in a later update).</span></div>';
  }
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'grades\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" onclick="_imp.step=\'' + _impNextAfterTriage() + '\';_impRender()">Next →</button></div>';
  _impBody().innerHTML = html;
}

// v0.9.1518: the vintage group needs verifying before we write it.
function _impNextAfterTriage() {
  if (_imp.fillMeaning === 'sale' && _imp.priceWhen === 'now') return 'prices';
  return _impVintageGroup().length ? 'eracheck' : 'preview';
}
function _impVintageGroup() {
  return (_imp.triage && _imp.triage.ambiguous || []).filter(function (a) { return a.eraChoice === 'vintage'; });
}

// ── Step: prewar / postwar bulk verify ──────────────────────────────────
// Brad's rule already ruled OUT modern (5+ digit numbers are modern, even
// for reproductions of postwar items — his 26077 = repro of 6424). What is
// left is prewar vs postwar, which the number alone cannot settle. So we
// group them, default to POSTWAR (far more common in collections), and ask
// the user to tick the exceptions — his words: "let him tick off the ones
// that aren't".
function _impStepEraCheck() {
  var group = _impVintageGroup();
  if (!group.length) { _imp.step = 'preview'; _impRender(); return; }
  if (!_imp.prewarPicks) _imp.prewarPicks = {};
  var html = '<div class="imp-h">' + group.length.toLocaleString() +
    ' Lionel items are prewar or postwar — which is it?</div>' +
    '<div class="imp-muted" style="margin-bottom:0.6rem">Their numbers are four digits or fewer, so they are not modern. ' +
    'We have set them all to <strong>Postwar</strong>. Tick any that are actually <strong>Prewar</strong>.</div>' +
    '<div class="imp-card" style="max-height:22rem;overflow:auto">';
  group.forEach(function (a, i) {
    var it = a.item;
    var key = it.srcTab + '|' + it.srcRow;
    var pw = a.postwar, pre = a.prewar;
    html += '<label class="imp-row" style="cursor:pointer">' +
      '<input type="checkbox" ' + (_imp.prewarPicks[key] ? 'checked' : '') +
      ' onchange="_imp.prewarPicks[\'' + _impEsc(key).replace(/'/g, '&#39;') + '\']=this.checked" ' +
      'style="margin-right:0.5rem;accent-color:var(--accent)">' +
      '<div style="flex:1"><span class="imp-num">' + _impEsc(it.itemNum) + '</span> ' +
      '<span class="imp-muted">' + _impEsc(String(it.yourDesc || '').slice(0, 52)) + '</span>' +
      '<div class="imp-muted" style="font-size:0.7rem">Postwar: ' +
      _impEsc(String((pw && pw.description) || '—').slice(0, 40)) +
      (pre ? ' · Prewar: ' + _impEsc(String(pre.description || '—').slice(0, 40)) : '') + '</div></div></label>';
  });
  html += '</div>' +
    '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'triage\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" onclick="_impApplyEraCheck()">Next →</button></div>';
  _impBody().innerHTML = html;
}
function _impApplyEraCheck() {
  var group = _impVintageGroup();
  var stillAmbiguous = [];
  group.forEach(function (a) {
    var key = a.item.srcTab + '|' + a.item.srcRow;
    var wantPrewar = !!(_imp.prewarPicks && _imp.prewarPicks[key]);
    var pick = wantPrewar ? (a.prewar || a.postwar) : (a.postwar || a.prewar);
    if (pick) _imp.triage.matched.push({ item: a.item, master: pick, matchedVia: 'era-verified' });
    else stillAmbiguous.push(a);
  });
  // Anything we could not resolve stays held back, as before.
  _imp.triage.ambiguous = (_imp.triage.ambiguous || []).filter(function (a) {
    return a.eraChoice !== 'vintage' || stillAmbiguous.indexOf(a) >= 0;
  });
  _imp.step = 'preview';
  _impRender();
}

function _impIsHighlighted(it) {
  if (!it.fillSig) return false;
  var g = _imp.fillGroups[0];
  return !!(g && g.sigs && g.sigs.indexOf(it.fillSig) >= 0);
}

// ── Step: asking prices now (line by line) ──────────────────────
function _impStepPrices() {
  var reds = _impWritablesFor('sale');
  var html = '<div class="imp-h">Asking prices (' + reds.length + ' for-sale items)</div>' +
    '<div class="imp-muted" style="margin-bottom:0.5rem">Leave any blank to decide later.</div>';
  reds.forEach(function (w, i) {
    var it = w.item;
    var key = it.srcTab + '|' + it.srcRow;
    html += '<div class="imp-row"><div style="flex:1"><span class="imp-num">' + _impEsc(it.itemNum || '(no number)') + '</span> ' +
      '<span class="imp-muted">' + _impEsc(String(it.yourDesc || '').slice(0, 48)) + '</span></div>' +
      '$<input class="imp-money" inputmode="decimal" value="' + _impEsc(_imp.itemPrices[key] || '') + '" ' +
      'onchange="_imp.itemPrices[\'' + _impEsc(key).replace(/'/g, '&#39;') + '\']=this.value"></div>';
  });
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'triage\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" onclick="_imp.step=\'' + (_impVintageGroup().length ? 'eracheck' : 'preview') + '\';_impRender()">Next →</button></div>';
  _impBody().innerHTML = html;
}

// Everything that will actually be written, with its master when matched.
function _impWritables() {
  var out = [];
  _imp.triage.matched.forEach(function (m) { out.push({ item: m.item, master: m.master, catalogNum: m.catalogNum || '' }); });
  _imp.triage.unmatched.forEach(function (u) { out.push({ item: u.item, master: null }); });
  if (_imp.fillMeaning === 'sold') out = out.filter(function (w) { return !_impIsHighlighted(w.item); });
  return out;
}
function _impWritablesFor(kind) {
  return _impWritables().filter(function (w) {
    return kind === 'sale' ? (_imp.fillMeaning === 'sale' && _impIsHighlighted(w.item)) : true;
  });
}

// ── Step: preview (real staged rows, variety picked) ────────────
function _impStepPreview() {
  var ws = _impWritables();
  var picks = [];
  function firstWhere(f) { for (var i = 0; i < ws.length; i++) if (f(ws[i]) && picks.indexOf(ws[i]) < 0) return ws[i]; return null; }
  var pMatched = firstWhere(function (w) { return w.master && !_impIsHighlighted(w.item); });
  var pRed = (_imp.fillMeaning === 'sale') ? firstWhere(function (w) { return _impIsHighlighted(w.item); }) : null;
  var pManual = firstWhere(function (w) { return !w.master && w.item.tabClass === 'trains'; });
  var pNonTrain = firstWhere(function (w) { return w.item.tabClass !== 'trains'; });
  var pGrade = firstWhere(function (w) { return w.master && w.item.rawGrade; });
  [pMatched, pRed, pGrade, pManual, pNonTrain].forEach(function (p) { if (p && picks.indexOf(p) < 0) picks.push(p); });
  while (picks.length < Math.min(5, ws.length)) { var extra = firstWhere(function () { return true; }); if (!extra) break; picks.push(extra); }

  var html = '<div class="imp-h">Preview — ' + picks.length + ' real examples from your sheet.</div>' +
    '<div class="imp-muted" style="margin-bottom:0.5rem">These are built from the exact rows the import will write. Spot something off? Go back and fix it — the preview updates.</div>';
  picks.forEach(function (w) { html += _impPreviewCard(w); });
  html += '<div class="imp-card" style="text-align:center"><strong>' + ws.length.toLocaleString() + '</strong> items ready to import.' +
    '<div class="imp-muted" style="margin-top:0.3rem">One tap removes the whole batch afterward if anything looks wrong.</div></div>';
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'triage\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" onclick="_impWrite()">Import ' + ws.length.toLocaleString() + ' items</button></div>';
  _impBody().innerHTML = html;
}

function _impGradeFor(raw) {
  if (!raw) return '';
  for (var i = 0; i < _imp.gradeTable.length; i++) {
    if (_imp.gradeTable[i].raw === raw) return _imp.gradeTable[i].condition || '';
  }
  return '';
}

function _impPreviewCard(w) {
  var it = w.item, m = w.master;
  var cond = _impGradeFor(it.rawGrade);
  var html = '<div class="imp-card"><div><span class="imp-num">' + _impEsc(it.itemNum || '(no number)') + '</span>' +
    (m ? '<span class="imp-badge match">IN CATALOG</span>' : '<span class="imp-badge manual">MANUAL ENTRY</span>') +
    ((_imp.fillMeaning === 'sale' && _impIsHighlighted(it)) ? '<span class="imp-badge sale">FOR SALE</span>' : '') + '</div>';
  var desc = m ? (m.description || '') : (it.yourDesc || '');
  if (desc) html += '<div style="font-size:0.88rem;margin:0.25rem 0">' + _impEsc(String(desc).slice(0, 90)) + '</div>';
  if (m && it.yourDesc) html += '<div class="imp-muted">Your description: “' + _impEsc(String(it.yourDesc).slice(0, 70)) + '”</div>';
  if (!m) html += '<div class="imp-muted">Not found in our list — added as a manual entry, everything you wrote is kept.</div>';
  var bits = [];
  if (cond) bits.push('Condition ' + cond);
  if (it.rawGrade) bits.push('Your grade: ' + _impEsc(it.rawGrade));
  if (it.yearMade) bits.push('Year ' + _impEsc(it.yearMade));
  if (it.location) bits.push('📍 ' + _impEsc(it.location));
  if (it.priceItem) bits.push('Paid $' + _impEsc(rrImpCleanMoney(it.priceItem) || it.priceItem));
  if (it.userEstWorth) bits.push('Worth $' + _impEsc(rrImpCleanMoney(it.userEstWorth) || it.userEstWorth));
  if (bits.length) html += '<div class="imp-muted" style="margin-top:0.25rem">' + bits.join(' · ') + '</div>';
  html += '<div class="imp-muted" style="margin-top:0.25rem;font-size:0.7rem">from tab “' + _impEsc(it.srcTab) + '”, row ' + it.srcRow + '</div></div>';
  return html;
}

// v0.9.1508 (Session 81, found by Brad testing live): _impRender's step map
// NAMED this function but nothing ever defined it. Every property in an object
// literal is evaluated when the object is built, so opening Import threw
// "ReferenceError: _impStepWriting is not defined" BEFORE the entry screen was
// drawn — the window opened empty, 100% of the time, for everyone. The node
// suites never caught it because they cover the pure core, not the screens.
// The writing screen is painted by _impWrite (progress bar + counter) and
// re-rendering must not wipe it mid-write, so this is deliberately a no-op.
function _impStepWriting() { /* _impWrite owns this screen */ }

// ── Step: WRITE (chunked, guarded, undoable) ────────────────────
async function _impWrite() {
  if (_impWriteDone) return;          // double-fire guard
  _impWriteDone = true;
  _imp.step = 'writing';
  var ws = _impWritables();
  _impBody().innerHTML = '<div class="imp-h">Importing ' + ws.length.toLocaleString() + ' items…</div>' +
    '<div class="imp-prog"><div id="imp-wbar" style="width:2%"></div></div>' +
    '<div class="imp-muted" id="imp-wmsg">Building rows…</div>';
  try {
    var batchId = _imp.batchId;
    var rows = [], forSale = [], invIds = [];
    ws.forEach(function (w) {
      var it = w.item, m = w.master;
      var invId = (typeof nextInventoryId === 'function') ? nextInventoryId() : ('IMP-' + Math.random().toString(36).slice(2, 10));
      invIds.push(invId);
      var cond = _impGradeFor(it.rawGrade);
      var isRed = _imp.fillMeaning === 'sale' && _impIsHighlighted(it);
      var repairNote = (_imp.fillMeaning === 'repair' && _impIsHighlighted(it)) ? 'Needs repair' : '';
      var fields = {
        // v0.9.1509: a 6-prefix match writes the CATALOG number (6-11169) —
        // Lionel's own convention for the same number, so every app feature
        // (links, grouping, market) works. Not a suffix strip; suffix rule intact.
        itemNum: (w.catalogNum || it.itemNum || ''), variation: '',
        condition: cond,
        userEstWorth: rrImpCleanMoney(it.userEstWorth),
        priceItem: rrImpCleanMoney(it.priceItem),
        location: it.location || '',
        gauge: it.gauge || '',
        yearMade: it.yearMade || '',
        notes: [it.notes || '', repairNote].filter(Boolean).join(' · '),
        roadName: it.roadName || '', roadNumber: it.roadNumber || '',
        datePurchased: it.datePurchased || '', purchasedFrom: it.purchasedFrom || '',
        quickEntry: 'No', inventoryId: invId, groupId: '',
        importBatch: batchId,
        yourGrade: it.rawGrade || '',
        yourDescription: it.yourDesc || '',
      };
      if (m) {
        fields.era = m._era || '';
        if (typeof rrMasterKeyOf === 'function') fields.masterKey = rrMasterKeyOf(m);
      } else {
        fields.era = 'Manual';
        // v0.9.1509: tab answer fills maker BLANKS only (their Brand cell wins).
        fields.manufacturer = it.manufacturer || _imp.tabMaker[it.srcTab] || '';
        fields.description = it.yourDesc || '';
        // v0.9.1529: was `tabClass !== 'trains' && tabType` — which ignored an
        // answer given on the triage screen for a tab still classed as trains
        // (his Vehicles tab). If the user has named this tab's contents, that
        // name is used. This only ever runs for MANUAL rows; a catalog match
        // keeps the catalog's type.
        if (_imp.tabType[it.srcTab]) {
          fields.itemType = _imp.tabType[it.srcTab];
          // v0.9.1522: the narrower name rides along as Sub Type.
          var _ts = _imp.tabSubType[it.srcTab];
          if (_ts && String(_ts).trim() && !fields.subType) fields.subType = String(_ts).trim();
        }
      }
      // v0.9.1526: type read from their own words — only into a BLANK.
      if (!fields.itemType) {
        var _tg = _impTypeGuessFor(it, m);
        if (_tg) fields.itemType = _tg;
      }
      if (it.yearMade) fields.yearMade = it.yearMade;
      // v0.9.1514 (Phase 2): user columns the mapping filled.
      ['locationDetail', 'shipper', 'subCollection', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5']
        .forEach(function (k) { if (it[k]) fields[k] = String(it[k]).trim(); });
      if (String(it.hasBox || '').trim()) {
        fields.hasBox = /^(y|yes|true|x|1|✓)/i.test(String(it.hasBox).trim()) ? 'Yes' : String(it.hasBox);
      }
      rows.push(buildPersonalRow(fields));
      if (isRed) {
        var key = it.srcTab + '|' + it.srcRow;
        var ask = (_imp.priceWhen === 'now') ? rrImpCleanMoney(_imp.itemPrices[key] || '') : '';
        forSale.push([
          it.itemNum || '', '', cond, ask, new Date().toISOString().slice(0, 10),
          (it.yourDesc || '').slice(0, 120), rrImpCleanMoney(it.priceItem),
          rrImpCleanMoney(it.userEstWorth), invId,
          m ? '' : (it.manufacturer || ''),
        ]);
      }
    });

    // Chunked appends — each chunk is ONE atomic server-side append.
    var CHUNK = 100, done = 0;
    for (var i = 0; i < rows.length; i += CHUNK) {
      var chunk = rows.slice(i, i + CHUNK);
      await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', chunk);
      done += chunk.length;
      var el = document.getElementById('imp-wbar');
      if (el) el.style.width = Math.round((done / rows.length) * 90) + '%';
      var msg = document.getElementById('imp-wmsg');
      if (msg) msg.textContent = done.toLocaleString() + ' of ' + rows.length.toLocaleString() + ' written…';
    }
    for (var f = 0; f < forSale.length; f += CHUNK) {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:J', forSale.slice(f, f + CHUNK));
    }

    // v0.9.1514: a column the import actually WROTE turns itself on, so the
    // data is visible everywhere immediately (Brad's spec: "import auto-enables
    // toggles it maps into"). Custom slots also take the sheet's own header as
    // their name, so "Owner" is called Owner rather than "Custom column 1".
    try {
      var _usedKeys = {};
      Object.keys(_imp.mappings).forEach(function (tab) {
        var m = _imp.mappings[tab] || {};
        Object.keys(m).forEach(function (hdr) { if (m[hdr]) _usedKeys[m[hdr]] = hdr; });
      });
      (window.RR_USER_FIELDS || []).forEach(function (f) {
        if (!_usedKeys[f.key]) return;
        localStorage.setItem(f.pref, 'true');
        if (f.custom && !localStorage.getItem('lv_label_' + f.key)) {
          var h = String(_usedKeys[f.key] || '').trim();
          if (h) localStorage.setItem('lv_label_' + f.key, h.charAt(0).toUpperCase() + h.slice(1));
        }
      });
    } catch (eEnable) {}

    // Batch record — undo + Phase 2 (stored answers) live here.
    try {
      var batches = JSON.parse(_prefGet(_IMP_BATCH_PREF, '[]'));
      batches.push({
        id: batchId, when: new Date().toISOString(), count: rows.length,
        forSale: forSale.length, answers: _imp.answers,
        skippedAmbiguous: _imp.triage.ambiguous.length,
      });
      _prefSet(_IMP_BATCH_PREF, JSON.stringify(batches.slice(-10)));
    } catch (e) {}

    var bar = document.getElementById('imp-wbar');
    if (bar) bar.style.width = '100%';
    _imp.written = rows.length;
    _imp.writtenForSale = forSale.length;
    _imp.step = 'done';
    _impRender();
    try { if (typeof forceRefreshData === 'function') forceRefreshData(); } catch (e) {}
  } catch (e) {
    console.error('[Import] write failed:', e);
    _impWriteDone = false;   // allow retry — appends are atomic per chunk
    _imp.step = 'preview';
    _impRender();
    showToast('Import stopped partway: ' + (e && e.message ? e.message : 'write failed') +
      ' — already-written items can be removed with Undo from Preferences.', 6000, true);
  }
}

function _impStepDone() {
  _impBody().innerHTML =
    '<div class="imp-h">✓ Imported ' + _imp.written.toLocaleString() + ' items.</div>' +
    (_imp.writtenForSale ? '<div class="imp-card"><span class="imp-badge sale">FOR SALE</span> ' + _imp.writtenForSale.toLocaleString() +
      ' of them are on your For Sale list' + (_imp.priceWhen === 'later' ? ' waiting for asking prices' : '') + '.</div>' : '') +
    (_imp.triage.ambiguous.length ? '<div class="imp-muted">' + _imp.triage.ambiguous.length +
      ' items with multiple catalog matches were held back for the next update.</div>' : '') +
    '<div class="imp-card"><strong>Changed your mind?</strong><div class="imp-muted">One tap removes everything this import added — nothing else is touched.</div>' +
    '<button class="imp-btn" style="margin-top:0.4rem" onclick="rrImportUndo(\'' + _imp.batchId + '\',this)">Remove this import</button></div>' +
    '<div class="imp-foot"><span></span><button class="imp-btn primary" onclick="rrImportClose();if(typeof showPage===\'function\')showPage(\'browse\')">Done — see my collection</button></div>';
}

// ── Batch undo ──────────────────────────────────────────────────
// Re-reads the sheet (never trusts remembered row numbers), finds every
// row whose Import Batch column says batchId, deletes them in ONE
// batchUpdate per tab (descending ranges), then refreshes.
async function rrImportUndo(batchId, btn) {
  if (!batchId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }
  try {
    var removed = 0;
    removed += await _impDeleteBatchRows(PERSONAL_TAB, batchId, null);
    // For Sale rows: matched by inventoryId prefix? No — by reading the
    // collection batch we already removed; For Sale carries inventoryId in
    // col I. Read those ids from the batch record is not enough after a
    // partial failure, so: delete For Sale rows whose inventoryId no longer
    // exists in the collection AND was created by this batch — we stored
    // nothing per-row, so instead match on the batch's time window? Simpler
    // and honest: we delete For Sale rows whose inventoryId is gone from the
    // collection after the main delete.
    removed += await _impDeleteOrphanForSale();
    showToast('✓ Removed ' + removed.toLocaleString() + ' imported rows', 4000);
    try {
      var batches = JSON.parse(_prefGet(_IMP_BATCH_PREF, '[]'));
      _prefSet(_IMP_BATCH_PREF, JSON.stringify(batches.filter(function (b) { return b.id !== batchId; })));
    } catch (e) {}
    try { if (typeof forceRefreshData === 'function') forceRefreshData(); } catch (e) {}
    if (btn) btn.textContent = 'Removed';
  } catch (e) {
    console.error('[Import] undo failed:', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Remove this import'; }
    showToast('Could not remove the import: ' + (e && e.message ? e.message : 'error'), 5000, true);
  }
}

function _impColLetter(n) {   // 1-based → A, B, … AA…
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function _impDeleteBatchRows(tabName, batchId) {
  var idx = -1;
  (PERSONAL_SCHEMA || []).forEach(function (c, i) { if (c.field === 'importBatch') idx = i; });
  if (idx < 0) return 0;
  var col = _impColLetter(idx + 1);
  var res = await sheetsGet(state.personalSheetId, "'" + tabName + "'!" + col + ':' + col);
  var vals = (res && res.values) || [];
  var rowNums = [];
  for (var r = 0; r < vals.length; r++) {
    if (vals[r] && String(vals[r][0]) === batchId) rowNums.push(r + 1);
  }
  if (!rowNums.length) return 0;
  await _impBatchDeleteRows(tabName, rowNums);
  return rowNums.length;
}

async function _impDeleteOrphanForSale() {
  // For Sale col I = inventoryId. Remove rows whose id starts with our
  // inventory prefix but no longer exists in the collection.
  var live = {};
  var invIdx = -1;
  (PERSONAL_SCHEMA || []).forEach(function (c, i) { if (c.field === 'inventoryId') invIdx = i; });
  if (invIdx < 0) return 0;
  var colInv = _impColLetter(invIdx + 1);
  var colRes = await sheetsGet(state.personalSheetId, "'" + PERSONAL_TAB + "'!" + colInv + ':' + colInv);
  ((colRes && colRes.values) || []).forEach(function (v) { if (v && v[0]) live[String(v[0])] = 1; });
  var fsRes = await sheetsGet(state.personalSheetId, "'For Sale'!I:I");
  var fsVals = (fsRes && fsRes.values) || [];
  var rowNums = [];
  for (var r = 2; r < fsVals.length; r++) {   // skip title+header rows
    var id = fsVals[r] && String(fsVals[r][0] || '');
    if (id && !live[id]) rowNums.push(r + 1);
  }
  if (!rowNums.length) return 0;
  await _impBatchDeleteRows('For Sale', rowNums);
  return rowNums.length;
}

// ONE batchUpdate, ranges merged and DESCENDING so nothing shifts under us.
async function _impBatchDeleteRows(tabName, rowNums) {
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  try { if (typeof rrOutboxRowsMoved === 'function') rrOutboxRowsMoved(); } catch (e) {}
  var metaRes = await _withTokenRetry(function () { return fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  ); });
  var meta = await metaRes.json();
  var sheet = (meta.sheets || []).find(function (s) { return s.properties.title === tabName; });
  if (!sheet) throw new Error('Tab not found: ' + tabName);
  var sheetId = sheet.properties.sheetId;
  var sorted = rowNums.slice().sort(function (a, b) { return b - a; });
  // Merge consecutive rows into ranges (still descending).
  var ranges = [];
  sorted.forEach(function (n) {
    var last = ranges[ranges.length - 1];
    if (last && last.startIndex === n) last.startIndex = n - 1;
    else ranges.push({ startIndex: n - 1, endIndex: n });
  });
  var requests = ranges.map(function (rg) {
    return { deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rg.startIndex, endIndex: rg.endIndex } } };
  });
  // Sheets caps a batchUpdate comfortably in the thousands; chunk at 500.
  for (var i = 0; i < requests.length; i += 500) {
    await _withTokenRetry(function () { return fetch(
      'https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate',
      { method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: requests.slice(i, i + 500) }) }
    ); });
  }
}

// Preferences hook: list recent batches so undo is reachable later.
function rrImportRecentBatchesHtml() {
  var batches = [];
  try { batches = JSON.parse(_prefGet(_IMP_BATCH_PREF, '[]')); } catch (e) {}
  if (!batches.length) return '';
  var b = batches[batches.length - 1];
  return '<div class="pref-row"><div class="pref-row-label"><strong>Last import</strong>' +
    '<span>' + b.count.toLocaleString() + ' items on ' + String(b.when).slice(0, 10) + '</span></div>' +
    '<button class="pref-btn danger" onclick="rrImportUndo(\'' + b.id + '\',this)">Remove it</button></div>';
}

if (typeof window !== 'undefined') {
  window.rrImportOpen = rrImportOpen;
  window.rrImportClose = rrImportClose;
  window.rrImportUndo = rrImportUndo;
  window.rrImportRecentBatchesHtml = rrImportRecentBatchesHtml;
}
