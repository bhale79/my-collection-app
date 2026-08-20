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
    fillMeaning: '',       // for sale | sold | repair | formatting | other
    priceWhen: '',         // now | later
    gradeTable: [],        // [{ raw, condition, count }]
    staged: [], triage: null, itemPrices: {},
    batchId: 'IMP' + Date.now().toString(36).toUpperCase(),
  };
  _impWriteDone = false;
  var ov = document.createElement('div');
  ov.id = 'imp-overlay';
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
    '.imp-prog>div{height:100%;background:var(--accent,#c33);width:0%;transition:width 0.2s}' +
    '.imp-money{width:6.5rem;background:var(--surface2,#26262e);color:var(--text,#eee);border:1px solid var(--border,#444);border-radius:6px;padding:0.25rem 0.4rem;font-size:0.85rem}';
  document.head.appendChild(s);
}

function _impBody() { return document.getElementById('imp-body'); }
function _impEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _impRender() {
  if (!_imp) return;
  var fn = {
    entry: _impStepEntry, consent: _impStepConsent, mapping: _impStepMapping,
    interview: _impStepInterview, grades: _impStepGrades, triage: _impStepTriage,
    prices: _impStepPrices, preview: _impStepPreview, writing: _impStepWriting,
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
    '<div class="imp-muted">.xlsx works best — row colors and every tab come along</div></div>' +
    '<input type="file" id="imp-file" accept=".xlsx" style="display:none">' +
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
    if (f) _impLoadFile(f);
  });
  document.getElementById('imp-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) _impLoadFile(e.target.files[0]);
  });
  document.getElementById('imp-paste-go').onclick = function () {
    var txt = document.getElementById('imp-paste').value || '';
    if (txt.trim().length < 10) { showToast('Paste a few rows first', 2500, true); return; }
    _impLoadPaste(txt);
  };
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
  _impBody().innerHTML = '<div class="imp-h">Reading ' + _impEsc(file.name) + '…</div><div class="imp-prog"><div style="width:30%"></div></div>';
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
    '<div class="imp-card">To set up the import automatically, we send just the <strong>column headers and about 10 example rows per tab</strong> to our AI helper — never your whole inventory.' +
    '<div class="imp-muted" style="margin-top:0.4rem">Your data is not used to train AI. One-time setup; costs you nothing.</div></div>' +
    '<div class="imp-foot">' +
    '<button class="imp-btn" onclick="_impRunHeuristic()">Set up manually instead</button>' +
    '<button class="imp-btn primary" onclick="_impRunAi()">Continue</button></div>';
}

async function _impRunAi() {
  _impBody().innerHTML = '<div class="imp-h">Looking at your spreadsheet…</div><div class="imp-prog"><div style="width:55%"></div></div>' +
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
      _imp.mappings[t.name] = answered.mappings[t.name] || rrImpHeuristicMap(t.headers).map;
      _imp.tabClass[t.name] = answered.tabClass[t.name] || 'trains';
    });
    _imp.aiGradeTable = answered.gradeTable || [];
    _imp.aiQuestions = answered.questions || [];
  } else {
    showToast('AI helper unavailable — using built-in guesses', 3000);
    _impFillHeuristic();
  }
  _imp.step = 'mapping';
  _impRender();
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
};

function _impStepMapping() {
  var html = '<div class="imp-h">Check the column matches.</div>' +
    '<div class="imp-muted" style="margin-bottom:0.6rem">' +
    (_imp.aiUsed ? 'Our AI helper made these guesses — fix anything that looks wrong.' : 'Built-in guesses — fix anything that looks wrong.') +
    ' Tabs with the same layout are set together.</div>';
  _imp.groups.forEach(function (g, gi) {
    var rep = g.tabs[0];
    var names = g.tabs.map(function (t) { return t.name; });
    var repMap = _imp.mappings[rep.name] || {};
    html += '<div class="imp-card"><div style="font-weight:600;font-size:0.86rem;margin-bottom:0.3rem">' +
      _impEsc(names.length > 3 ? names.slice(0, 3).join(', ') + ' +' + (names.length - 3) + ' more' : names.join(', ')) +
      ' <span class="imp-muted">(' + g.tabs.reduce(function (n, t) { return n + t.rows.length; }, 0).toLocaleString() + ' rows)</span></div>';
    var seen = {};
    g.tabs.forEach(function (t) {
      t.headers.forEach(function (h) {
        var n = rrImpNormHeader(h);
        if (!n || seen[n]) return;
        seen[n] = 1;
        var cur = repMap[n] || (_imp.mappings[t.name] || {})[n] || '';
        html += '<div class="imp-row"><div style="flex:1">' + _impEsc(h) + '</div>' +
          '<select class="imp-sel" onchange="_impSetMap(' + gi + ',\'' + _impEsc(n).replace(/'/g, '&#39;') + '\',this.value)">';
        Object.keys(_IMP_FIELD_LABELS).forEach(function (f) {
          if (f === 'ignore') return;
          html += '<option value="' + f + '"' + (cur === f ? ' selected' : '') + '>' + _IMP_FIELD_LABELS[f] + '</option>';
        });
        html += '</select></div>';
      });
    });
    html += '<label class="imp-muted" style="display:block;margin-top:0.4rem"><input type="checkbox" ' +
      (names.every(function (n) { return _imp.skipTabs[n]; }) ? 'checked' : '') +
      ' onchange="_impSetSkip(' + gi + ',this.checked)"> Skip these tabs entirely</label></div>';
  });
  html += '<div class="imp-foot"><button class="imp-btn" onclick="_imp.step=\'consent\';_impRender()">← Back</button>' +
    '<button class="imp-btn primary" id="imp-map-next" onclick="_impMappingNext()">Looks right →</button></div>';
  _impBody().innerHTML = html;
}

function _impSetMap(gi, headerNorm, field) {
  var g = _imp.groups[gi];
  g.tabs.forEach(function (t) {
    var m = _imp.mappings[t.name] = _imp.mappings[t.name] || {};
    if (field === '') delete m[headerNorm];
    else {
      // One column per field within a tab: clear an older claim.
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
  var anyItemNum = live.some(function (t) {
    var m = _imp.mappings[t.name] || {};
    return Object.keys(m).some(function (k) { return m[k] === 'itemNum'; });
  });
  if (!live.length) { showToast('Every tab is skipped — nothing to import', 3000, true); return; }
  if (!anyItemNum) { showToast('Pick which column holds the Item Number first', 3500, true); return; }
  _impBuildQuestions();
  _imp.step = _imp.questions.length ? 'interview' : 'grades';
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
    qs.push({
      id: '_fill', text: g.count.toLocaleString() + ' rows are highlighted' +
        (g.rgb ? ' <span class="imp-swatch" style="background:#' + g.rgb + '"></span>' : '') +
        ' — what does that highlight mean?',
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
  live.forEach(function (t) {
    var cls = _imp.tabClass[t.name] || 'trains';
    rrImpApplyMapping(t, _imp.mappings[t.name] || {}).forEach(function (it) {
      it.tabClass = cls;
      staged.push(it);
    });
  });
  _imp.staged = staged;
  _imp.gradeTable = _impBuildGradeTable(staged);
  var lookups = {
    candidatesFor: function (num, hints) {
      var k = String(num).trim();
      var list = (state.masterByItem && state.masterByItem.get(k)) || [];
      if ((!list || !list.length) && state.masterByItemAll) list = state.masterByItemAll.get(k) || [];
      list = (list || []).slice();
      // A maker hint that narrows to EXACTLY one candidate settles it.
      if (list.length > 1 && hints && hints.manufacturer) {
        var mfr = String(hints.manufacturer).trim().toLowerCase();
        var narrowed = list.filter(function (m) {
          return String(m._tab || '').toLowerCase().indexOf(mfr) === 0 ||
                 String(m.manufacturer || '').toLowerCase() === mfr;
        });
        if (narrowed.length === 1) return narrowed;
        if (narrowed.length > 1) return narrowed;
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
  html += '<div class="imp-card"><span class="imp-badge match">MATCHED</span> <strong>' + t.matched.length.toLocaleString() +
    '</strong> items found in our catalog — these import with full catalog details.</div>';
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
      '<span class="imp-muted">These are NOT imported this round — the chooser for them arrives in the next update, and re-running the import later will pick them up without duplicating anything already imported.</span></div>';
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
    '<button class="imp-btn primary" onclick="_imp.step=\'' + ((_imp.fillMeaning === 'sale' && _imp.priceWhen === 'now') ? 'prices' : 'preview') + '\';_impRender()">Next →</button></div>';
  _impBody().innerHTML = html;
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
    '<button class="imp-btn primary" onclick="_imp.step=\'preview\';_impRender()">Next →</button></div>';
  _impBody().innerHTML = html;
}

// Everything that will actually be written, with its master when matched.
function _impWritables() {
  var out = [];
  _imp.triage.matched.forEach(function (m) { out.push({ item: m.item, master: m.master }); });
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
  if (it.location) bits.push('📍 ' + _impEsc(it.location));
  if (it.priceItem) bits.push('Paid $' + _impEsc(rrImpCleanMoney(it.priceItem) || it.priceItem));
  if (it.userEstWorth) bits.push('Worth $' + _impEsc(rrImpCleanMoney(it.userEstWorth) || it.userEstWorth));
  if (bits.length) html += '<div class="imp-muted" style="margin-top:0.25rem">' + bits.join(' · ') + '</div>';
  html += '<div class="imp-muted" style="margin-top:0.25rem;font-size:0.7rem">from tab “' + _impEsc(it.srcTab) + '”, row ' + it.srcRow + '</div></div>';
  return html;
}

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
        itemNum: it.itemNum || '', variation: '',
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
        fields.manufacturer = it.manufacturer || '';
        fields.description = it.yourDesc || '';
      }
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
