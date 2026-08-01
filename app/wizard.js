// Session 118 Phase E1: display-only helper that returns the short bucket label for a master item
// (Steam, Diesel, Boxcar, etc.) when type-groups.js is loaded; otherwise falls back to raw itemType.
// Used in suggestion cards, photo headers, and detail panels — does NOT change matching/save logic.
function _typeLabel(m){ return (typeof getTypeBucketLabel === 'function') ? getTypeBucketLabel(m) : ((m && m.itemType) || ''); }

// Bug 10 (Session 154): compose "Road Name — Description" for banners and
// item cards so users see the road (e.g. "Norfolk Southern — 50' Dbl. Door
// Plugged Box Car"). Skips the prefix when the road is already inside the
// description, and falls back to whichever piece is present.
function _composeRoadDesc(m) {
  if (!m) return '';
  var rd = String(m.roadName || '').trim();
  var ds = String(m.description || _typeLabel(m) || '').trim();
  if (rd && ds && ds.toLowerCase().indexOf(rd.toLowerCase()) === -1) return rd + ' \u2014 ' + ds;
  return ds || rd;
}

// Picker state — declared at top so available to all onclick handlers
// ── _pickerStepId / _pickerViewKey state moved to wizard-photos.js (Session 110, Chunk 4) ──

// v0.9.1241 (Brad): a step's example must be an example of what the step is
// asking for. "Title of this Dealer Display Poster" was showing
// "e.g. 1957 Advance Catalog" — a different kind of paper entirely — because
// the title followed the chosen paper type and the placeholder was a fixed
// string written for catalogs. A placeholder may now be a function of the
// answers so far, exactly like a title.
function _wizPlaceholder(s) {
  if (!s) return '';
  var p = s.placeholder;
  try { if (typeof p === 'function') p = p((typeof wizard !== 'undefined' && wizard.data) || {}); }
  catch (e) { return ''; }
  return String(p == null ? '' : p).replace(/"/g, '&quot;');
}
window._wizPlaceholder = _wizPlaceholder;

// ── Facts the catalog already knows (v0.9.1237) ────────────────────────
// These used to be whole steps of their own — see the note where they were
// removed in wizard-steps.js. They are shown beside the item's description on
// Condition & Details instead: same information, no extra tap.
//
// A table rather than two if-statements, so the next era that carries a fact
// worth showing is one line here and nothing else.
var _CD_ERA_FACTS = [
  { era: 'atlas',   field: 'trackPower', label: 'Track / Power' },
  { prefix: 'mth_', field: 'category',   label: 'Product line'  }
];
function _cdEraFacts(master, era) {
  era = String(era || '');
  if (!master) return [];
  return _CD_ERA_FACTS.filter(function (f) {
    if (f.era && era !== f.era) return false;
    if (f.prefix && era.indexOf(f.prefix) !== 0) return false;
    return !!String(master[f.field] || '').trim();
  }).map(function (f) {
    return { label: f.label, value: String(master[f.field]).trim() };
  });
}
window._cdEraFacts = _cdEraFacts;

// ── How big is the wizard box? ONE answer. ──────────────────────────────
// v0.9.1232 (Brad): "the add step needs to be as wide as it can on the desktop
// to minimize scrolling down."
//
// The box was pinned to 520 × 580 by two inline styles in renderWizardStep —
// the same box on a phone and on a 27-inch monitor. On a 1080p desktop that is
// roughly a quarter of the width and half the height, and everything past
// 580px scrolled inside it.
//
// It was pinned in TWO places, which is the part worth remembering: the phone
// keyboard guard (_kbApply) also wrote 580 as its "keyboard is down again"
// height. visualViewport fires on DESKTOP window resizes too, so any desktop
// height set in renderWizardStep would have been quietly stamped back to 580
// the first time Brad resized his window. One fact, two readers, disagreeing —
// the same shape as every bug of 07-30/31. Both now ask this.
//
// The box stays a FIXED size per step rather than hugging its content: that is
// deliberate and predates this change. A box that resizes as you page through
// makes the Next button move under the cursor.
function _wizBoxHeight() {
  var vv = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 800;
  // Phone keyboard up, or any genuinely short viewport: take what is left and
  // keep the footer on screen. This case is why the guard exists — unchanged.
  if (vv < 596) return Math.max(300, Math.round(vv - 16));
  // Desktop: use the screen instead of ignoring it. The cap keeps a very tall
  // monitor from stretching a six-field step down an entire wall.
  if (_wizWide()) return Math.min(Math.round(vv * 0.9), 900);
  return 580;   // phones and small tablets — exactly as before
}
window._wizBoxHeight = _wizBoxHeight;

// v0.9.1233: "wide enough to spread out on" is asked in four places now — the
// box height, the modal width, the Condition & Details columns and the
// variation description. It is ONE fact, so it gets one number and one reader.
var WIZ_WIDE_AT = 900;
function _wizWide() { return (window.innerWidth || 0) >= WIZ_WIDE_AT; }
window._wizWide = _wizWide;

// v0.9.1233 (Brad, screenshot of Step 2 of 8): a variation description is one
// attribute per line — "silver rubber stamped numbers", "black stack", "with
// water scoop" — and in a 520px box that turns a two-inch list into a ribbon a
// mile long, using about a third of each line.
//
// The reference book writes these in SECTIONS: a preamble, then ENGINE, then
// TENDER. Brad's call was to keep those whole rather than let the text flow
// freely into columns, so a heading can never sit at the foot of one column
// with its own list starting the next.
//
// A heading is a line in capitals with no lower-case in it. "1952" is not one
// (no letters); "(with RR on the side of the cab under 726)" is not one.
function _wizVarSections(txt) {
  var lines = String(txt == null ? '' : txt).split(/\r?\n/);
  var isHead = function (l) {
    var t = l.trim();
    if (!t || t.length > 32) return false;
    if (!/[A-Z]/.test(t)) return false;
    return !/[a-z]/.test(t);
  };
  var secs = [], cur = null;
  lines.forEach(function (l) {
    if (isHead(l)) { cur = { head: l.trim(), lines: [] }; secs.push(cur); return; }
    if (!cur) { cur = { head: '', lines: [] }; secs.push(cur); }
    cur.lines.push(l);
  });
  // Drop sections that ended up with nothing but blank lines under them.
  return secs.filter(function (sc) {
    return sc.head || sc.lines.join('').trim();
  });
}
window._wizVarSections = _wizVarSections;

// ── ADD ITEM WIZARD ─────────────────────────────────────────────

// Session 159: variation-aware tender helpers — must live at global scope
// so they're available on Step 3 regardless of whether QE Step 1 ever rendered.
window.getTenderCandidates = function(engineNum, pickedVarNum) {
  var out = [];
  var seen = new Set();
  var data = (window.state && state.masterData) || [];
  var engineVars = data.filter(function(m) {
    return String(m.itemNum||'').trim() === String(engineNum||'').trim();
  });
  function tenderForCode(code) {
    if (!code) return null;
    for (var i = 0; i < data.length; i++) {
      var m = data[i];
      var c = String(m.cottCode || m.COTTCode || m['COTT Code'] || '').trim();
      var t = String(m.itemType || m['Item Type'] || '').toLowerCase();
      if (c === code && t.indexOf('tender') !== -1) return m;
    }
    return null;
  }
  engineVars.forEach(function(v) {
    var code = String(v.cottCode || v.COTTCode || v['COTT Code'] || '').trim();
    var slashIdx = code.indexOf('/');
    if (slashIdx < 0) return;
    var prefix = code.match(/^([A-Z]+)/);
    if (!prefix) return;
    var tenderCode = prefix[1] + code.slice(slashIdx + 1);
    var t = tenderForCode(tenderCode);
    if (t) {
      var key = String(t.itemNum).trim();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          itemNum: t.itemNum,
          year: t.yearProduced || t['Year Produced'] || '',
          varNum: t.varNum || t['Variation #'] || 1,
          variationSpecific: String(v.varNum || v['Variation #'] || 1) === String(pickedVarNum || ''),
        });
      }
    }
  });
  out.sort(function(a, b) {
    if (a.variationSpecific && !b.variationSpecific) return -1;
    if (!a.variationSpecific && b.variationSpecific) return 1;
    return String(a.itemNum).localeCompare(String(b.itemNum));
  });
  return out;
};

window._pickTender = function(tNum) {
  var known = (typeof getMatchingTenders === 'function')
    ? getMatchingTenders((wizard.data.itemNum||'').trim()) : [];
  wizard.data.tenderMatch = tNum;
  wizard.data.tenderIsNonOriginal = (tNum && tNum !== 'Unknown') && !known.includes(tNum);
  wizard.data._tenderConfirmed = true;
  var modal = document.getElementById('tender-picker-modal');
  if (modal) modal.remove();
  if (typeof renderWizardStep === 'function') renderWizardStep();
};

let wizard = {
  step: 0,
  tab: null,       // 'collection' | 'sold' | 'want'
  data: {},
  steps: [],
  matchedItem: null,
};

// Step definitions per tab
// ── getSteps() (moved to wizard-steps.js — Session 110, Round 1 Chunk 8) ──


// ── v0.9.1034 (Brad's Lionel/Atlas 6-8359, second time round) ─────────────
// Cross-catalog numbers collide: Lionel MPC 6-8359 (Chessie GP-7) and Atlas O
// 6-8359 (Western Maryland hopper) are both real. Several lookups in the
// wizard used to take whichever row came FIRST in the master list, which is
// Atlas — so a Lionel item identified correctly by photo got re-decided into
// an Atlas one a moment later. This is the one place that says what we know
// about the maker and era, and every one of those lookups now asks it.
// Order of confidence: the era the wizard is actually working in, then the
// Manufacturer/Era dropdowns on the search bar, then the maker the identify
// answer stated.
function _wizMasterPrefer() {
  var d = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data : null;
  if (!d) return null;
  var era = String(d._era || '').trim();
  if (era === 'all') era = '';
  var mfr = String(d._searchFilterManufacturer || '').trim();
  if (!mfr && d._identifyMeta && d._identifyMeta.manufacturer) mfr = String(d._identifyMeta.manufacturer).trim();
  if (!mfr && era && typeof _manufacturerOfEra === 'function') {
    try { mfr = _manufacturerOfEra(era) || ''; } catch (e) {}
  }
  // v0.9.1034b (Brad: "in this case, it says 1973"). The identify answer's YEAR
  // is the strongest hint available when no era has been picked — 1973 rules
  // out every pre-war and postwar catalog on its own, whoever made the thing.
  var year = '';
  [(d._identifyMeta && d._identifyMeta.year), d._identifyYear, d.yearProd, d.manualYear].some(function (v) {
    var m = String(v || '').match(/\d{4}/);
    if (m) { year = m[0]; return true; }
    return false;
  });
  if (!mfr && !era && !year) return null;
  return { manufacturer: mfr, era: era, year: year };
}

// Which of the three collecting periods a 4-digit year falls in. Same
// boundaries the suggestion list and the era filters already use.
function _wizPeriodOfYear(year) {
  var y = parseInt(String(year || '').slice(0, 4), 10);
  if (!y) return '';
  if (y <= 1942) return 'prewar';
  if (y <= 1969) return 'postwar';
  return 'modern';
}

// The period a master row belongs to — by its era tag first, by its printed
// production year otherwise.
function _wizPeriodOfRow(m) {
  if (!m) return '';
  try {
    if (typeof _itemEraPeriod === 'function') {
      var p = _itemEraPeriod(m);
      if (p) return p;
    }
  } catch (e) {}
  var e2 = String(m._era || '');
  if (e2 === 'prewar') return 'prewar';
  if (e2 === 'pw' || e2 === 'pw_ho') return 'postwar';
  if (e2) return 'modern';
  return _wizPeriodOfYear(String(m.yearProd || ''));
}
if (typeof window !== 'undefined') window._wizMasterPrefer = _wizMasterPrefer;

// The wizard's own pick between rows that share an item number. Returns the
// best row, or null when the number isn't in the catalog at all.
// `rows` may be omitted — it scans state.masterData when so.
function _wizPickMasterRow(numLC, rows) {
  try {
    var list = rows || (state.masterData || []).filter(function (i) {
      return String(i.itemNum || '').toLowerCase() === numLC;
    });
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    var pref = _wizMasterPrefer();
    if (!pref) return list[0];
    var eraKey = String(pref.era || '');
    var mfrLC = String(pref.manufacturer || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    var year = String(pref.year || '');
    var yearPeriod = _wizPeriodOfYear(year);
    var best = null, bestScore = -1;
    list.forEach(function (m) {
      var sc = 0;
      if (eraKey && String(m._era || '') === eraKey) sc += 8;
      // Year: an exact hit on the catalog's printed year is near-proof; the
      // period it lands in is a good sanity check on its own.
      if (year && String(m.yearProd || '').indexOf(year) !== -1) sc += 6;
      else if (yearPeriod && _wizPeriodOfRow(m) === yearPeriod) sc += 3;
      if (mfrLC) {
        var rowMfr = '';
        try { rowMfr = String((typeof _manufacturerOfEra === 'function' && _manufacturerOfEra(m._era)) || '').toLowerCase().replace(/[^a-z0-9]/g, ''); } catch (e) {}
        if (rowMfr && rowMfr === mfrLC) sc += 4;
        else if (String(m._tab || '').toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(mfrLC) === 0) sc += 4;
      }
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return best || list[0];
  } catch (e) { return (rows && rows[0]) || null; }
}
if (typeof window !== 'undefined') window._wizPickMasterRow = _wizPickMasterRow;

// v0.9.1033: put a focused field just under the top of the wizard's scroll
// area, leaving room for its little label. Silent no-op off the wizard.
// v0.9.1038: one handler for both identify buttons (body block on desktop,
// footer button on phones) so they can never drift apart.
function _wizIdentifyFromFooter() {
  if (typeof _wizScanBarcode === 'function') _wizScanBarcode();
  else if (typeof openIdentify === 'function') openIdentify('wizard');
}
if (typeof window !== 'undefined') window._wizIdentifyFromFooter = _wizIdentifyFromFooter;

// Show the footer's Photo ID button only where it belongs: phones, on the
// item-number step, when the user is actually entering a number by hand.
function _wizSyncIdPhotoBtn(step) {
  var btn = document.getElementById('wizard-idphoto-btn');
  if (!btn) return;
  var show = false;
  try {
    show = !!window.IS_MOBILE_UA
      && !!step && (step.id === 'itemNum' || step.type === 'itemNumGrouping')
      && wizard.tab !== 'sold'
      && !(wizard.data && wizard.data._fillItemMode && wizard.matchedItem && (wizard.data.itemNum || '').trim());
  } catch (e) { show = false; }
  btn.style.display = show ? 'inline-flex' : 'none';
}

function _wizScrollFieldIntoView(el) {
  try {
    var body = document.getElementById('wizard-body');
    if (!body || !el || !body.contains(el)) return;
    var b = body.getBoundingClientRect(), r = el.getBoundingClientRect();
    var delta = (r.top - b.top) - 28;
    if (Math.abs(delta) < 4) return;
    body.scrollTop = Math.max(0, body.scrollTop + delta);
  } catch (e) {}
}
if (typeof window !== 'undefined') window._wizScrollFieldIntoView = _wizScrollFieldIntoView;

// ── v0.9.1033 (Brad): full-screen item number field on phones ──────────────
// Tapping the item number box hands the whole screen to that one field: the
// box pinned at the top where the keyboard can never reach it, and the list of
// matching items filling everything between it and the keyboard.
// The real <input> and the real suggestion list are MOVED here and moved back
// on close — never copied. Same box, same code, same event handlers; it just
// changes address for a minute. (Same trick as the Filters sheet on My
// Collection — a second copy is what drifts out of sync three sessions later.)
var _wizFocusHome = null;      // where the borrowed nodes came from
var _wizFocusBusy = false;     // guards the blur that a DOM move causes

function _wizFieldFocusOpen(inp) {
  if (_wizFocusHome || !inp) return;
  if (document.getElementById('wiz-focus-panel')) return;
  var sug = document.getElementById('wiz-suggestions');
  var titleEl = document.getElementById('wizard-title');
  var title = (titleEl && titleEl.textContent) || 'Item Number';

  var p = document.createElement('div');
  p.id = 'wiz-focus-panel';
  // Below the crop overlay (100010), above the wizard modal.
  p.style.cssText = 'position:fixed;top:0;left:0;right:0;height:100vh;height:100svh;z-index:100005;'
    + 'background:var(--surface,#141d2b);display:flex;flex-direction:column';
  p.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;border-bottom:1px solid var(--border)">' +
      '<div style="flex:1;min-width:0;font-family:var(--font-head);font-size:0.95rem;font-weight:700;color:var(--text);' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + '</div>' +
      '<button id="wiz-focus-done" style="padding:0.5rem 1.1rem;min-height:40px;border-radius:8px;border:none;' +
        'background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.9rem;font-weight:700">Done</button>' +
    '</div>' +
    '<div id="wiz-focus-field" style="padding:0.7rem 0.9rem 0.5rem"></div>' +
    '<div id="wiz-focus-list" style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 0.9rem 0.9rem"></div>';
  document.body.appendChild(p);

  _wizFocusHome = {
    inp: inp, inpParent: inp.parentNode, inpNext: inp.nextSibling,
    sug: sug, sugParent: sug && sug.parentNode, sugNext: sug && sug.nextSibling,
    sugMaxH: sug ? sug.style.maxHeight : '', sugBorder: sug ? sug.style.border : ''
  };

  _wizFocusBusy = true;
  p.querySelector('#wiz-focus-field').appendChild(inp);
  if (sug) {
    p.querySelector('#wiz-focus-list').appendChild(sug);
    sug.style.maxHeight = 'none';       // fill the panel instead of a 340px box
    sug.style.border = 'none';
  }
  // Moving a node in the DOM blurs it — put the cursor back and keep typing.
  try { inp.focus(); var _v = inp.value; inp.value = ''; inp.value = _v; } catch (e) {}
  setTimeout(function () { _wizFocusBusy = false; }, 60);

  // Size the panel to the part of the screen the keyboard ISN'T covering, so
  // the results list ends exactly where the keyboard starts — you can see how
  // many matches there are and scroll them without fighting the keyboard.
  _wizFocusFit();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _wizFocusFit);
    window.visualViewport.addEventListener('scroll', _wizFocusFit);
  }

  p.querySelector('#wiz-focus-done').onclick = function () { _wizFieldFocusClose(); };
  // A tap in the list is a pick — hand the wizard back so the user sees the
  // number land and whatever follow-up the pick opened.
  p.querySelector('#wiz-focus-list').addEventListener('click', function () {
    setTimeout(_wizFieldFocusClose, 260);
  });
  inp.addEventListener('keydown', _wizFocusKey);
  if (window.BackStack) BackStack.push('_wiz-focus', function () { _wizFieldFocusClose(true); });
}

function _wizFocusFit() {
  var p = document.getElementById('wiz-focus-panel');
  if (!p) return;
  try {
    var vv = window.visualViewport;
    if (!vv) return;
    p.style.height = Math.max(220, Math.round(vv.height)) + 'px';
    p.style.top = Math.max(0, Math.round(vv.offsetTop || 0)) + 'px';
  } catch (e) {}
}

function _wizFocusKey(e) {
  if (e && e.key === 'Enter') setTimeout(function () { _wizFieldFocusClose(); }, 160);
}

function _wizFieldFocusClose(fromBack) {
  var h = _wizFocusHome;
  if (!h) return;
  _wizFocusHome = null;
  _wizFocusBusy = true;
  try { h.inp.removeEventListener('keydown', _wizFocusKey); } catch (e) {}
  try { h.inp.blur(); } catch (e) {}
  // Back to the exact spot each node came from.
  try {
    if (h.inpParent) h.inpParent.insertBefore(h.inp, h.inpNext || null);
    if (h.sug && h.sugParent) {
      h.sug.style.maxHeight = h.sugMaxH;
      h.sug.style.border = h.sugBorder;
      h.sugParent.insertBefore(h.sug, h.sugNext || null);
    }
  } catch (e) { console.warn('[wiz focus] restore', e); }
  if (window.visualViewport) {
    try { window.visualViewport.removeEventListener('resize', _wizFocusFit); } catch (e) {}
    try { window.visualViewport.removeEventListener('scroll', _wizFocusFit); } catch (e) {}
  }
  var p = document.getElementById('wiz-focus-panel');
  if (p) p.remove();
  if (!fromBack && window.BackStack) { try { BackStack.pop('_wiz-focus'); } catch (e) {} }
  setTimeout(function () { _wizFocusBusy = false; }, 60);
}
if (typeof window !== 'undefined') {
  window._wizFieldFocusOpen = _wizFieldFocusOpen;
  window._wizFieldFocusClose = _wizFieldFocusClose;
}

function _buildWizardModal() {
  if (document.getElementById('wizard-modal')) return;
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'wizard-modal';
  overlay.onclick = function(e) { if (e.target === overlay) closeWizardOnOverlay(e); };
  overlay.innerHTML =
    '<div class="modal" style="max-width:520px;height:580px;display:flex;flex-direction:column;overflow:hidden">' +
      '<div class="modal-header">' +
        // v0.9.1039 (Brad): on phones the ITEM TYPE selector takes the title's
        // place on the item-number step — the step number above it still says
        // where you are, and the field right below is plainly the item number,
        // so the word "Item Number" was paying for a whole row of screen.
        '<div style="flex:1;min-width:0">' +
          '<div class="modal-item-num" id="wizard-step-label"></div>' +
          '<div class="modal-title" id="wizard-title"></div>' +
          '<div id="wizard-kind-head" style="display:none;margin-top:0.15rem"></div>' +
        '</div>' +
        '<button class="btn-close" onclick="closeWizard()">&#x2715;</button>' +
      '</div>' +
      // v0.9.1033: id so the keyboard-open compact mode can hide the whole
      // progress strip, not just the bar inside it.
      '<div id="wizard-progress-wrap" style="padding:0 1.5rem;padding-top:0.75rem">' +
        '<div style="background:var(--border);border-radius:4px;height:4px">' +
          '<div id="wizard-progress" style="height:100%;border-radius:4px;background:var(--accent);transition:width 0.3s ease;width:0%"></div>' +
        '</div>' +
      '</div>' +
      // Session 115: persistent "Adding No. 55 — Motorized Unit" banner
      // shown on every step once an item number is known. Populated by
      // _renderAddingBanner() in renderWizardStep.
      '<div id="wizard-adding-banner" style="padding:0 1.5rem"></div>' +
      // v0.9.993 (Brad): ITEM TYPE selector — the first question of the add
      // flow. Cream + blue + bold so it stands out from the filters below.
      // Synced by _syncWizKindBar(); remembers last-used (lv_add_kind).
      '<div id="wizard-kind-bar" style="padding:0 1.5rem;display:none"></div>' +
      '<div class="modal-body" id="wizard-body" style="flex:1;overflow-y:auto;min-height:0"></div>' +
      '<div class="modal-footer">' +
        // v0.9.1038 (Brad): on phones the identify-by-photo button moves down
        // here, left of the X and Next, so the big dashed block stops eating a
        // row of the form. Shown only on the item-number step (renderWizardStep).
        '<button class="btn btn-secondary" id="wizard-idphoto-btn" onclick="_wizIdentifyFromFooter()" ' +
          'style="display:none;margin-right:auto;border-color:#2980b9;color:#2980b9;background:rgba(41,128,185,0.10);' +
          'align-items:center;gap:0.35rem;min-width:0" aria-label="Identify by photo">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0">' +
          '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Photo ID</span>' +
        '</button>' +
        '<button class="btn btn-secondary" id="wizard-back-btn" onclick="if(!wizardBack())_doCloseWizard();" style="display:none" aria-label="Back">' +
          '&#x2190;<span class="wiz-lbl-full"> Back</span>' +
        '</button>' +
        // v0.9.1029 (Brad): on phones Back and Cancel shrink to their symbols
        // so "Done with Photos" stays READABLE rather than truncating to an
        // ambiguous "Done".
        '<button class="btn btn-secondary" onclick="closeWizard()" aria-label="Cancel">' +
          '<span class="wiz-lbl-full">Cancel</span><span class="wiz-lbl-short">&#x2715;</span>' +
        '</button>' +
        '<button class="btn btn-secondary" id="wizard-skip-photos-btn" onclick="wizardSkipAllPhotos()" style="display:none">' +
          '&#x2713; Done with Photos &#x2192;' +
        '</button>' +
        '<button class="btn btn-primary" id="wizard-next-btn" onclick="wizardNext()">Next &#x2192;</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  // v0.9.662 — phone-keyboard guard (Brad: keyboard buried the Next button).
  // The modal is a fixed 580px box; when the on-screen keyboard shrinks the
  // visual viewport below that, cap the box height so the footer stays
  // visible, and auto-scroll the focused field into view.
  if (window.visualViewport && !window._wizKbGuard) {
    window._wizKbGuard = true;
    var _kbApply = function () {
      // v0.9.1031 (Brad): stand down while the crop screen is open. On Android
      // the URL bar sliding in and out fires this repeatedly, and resizing the
      // modal underneath nudged the page height — which moved the URL bar
      // again. That loop is what made the crop screen flash for seconds.
      if (window._rrCropOpen) return;
      var m = document.getElementById('wizard-modal');
      var box = m && m.querySelector('.modal');
      if (!box) return;
      var vh = window.visualViewport.height;
      box.style.height = _wizBoxHeight() + 'px';
      // v0.9.1033 (Brad: "when the keyboard pops up, you can hardly see what
      // you're typing"). The box shrinks to what's left of the screen, but the
      // two-line header, the progress strip and the Adding banner keep their
      // full size — so the field you're typing in gets squeezed off the bottom.
      // While the keyboard is up, that chrome stands down (see .wiz-kb in
      // app.css) and hands its space to the field. Everything comes back the
      // moment the keyboard closes.
      try {
        var kbUp = (window.innerHeight - vh) > 120;
        box.classList.toggle('wiz-kb', !!kbUp);
      } catch (eK) {}
    };
    window.visualViewport.addEventListener('resize', _kbApply);
    window.visualViewport.addEventListener('scroll', _kbApply);
    document.addEventListener('focusin', function (e) {
      var body = document.getElementById('wizard-body');
      if (!body || !body.contains(e.target)) return;
      // v0.9.1033: was scrollIntoView({block:'center'}) — centring can't work
      // for a field near the END of the list (there is nothing below it to
      // scroll up), which is exactly where the item number field sits, so it
      // stayed jammed against the bottom edge. Put the field just under the
      // top of the scroll area instead, and do it twice: once now and once
      // after the keyboard has finished sliding up and changed the height.
      _wizScrollFieldIntoView(e.target);
      setTimeout(function () { _wizScrollFieldIntoView(e.target); }, 320);
      setTimeout(function () { _wizScrollFieldIntoView(e.target); }, 700);
    });
  }


  // Build photo source picker sheet if not already present
  if (!document.getElementById('photo-picker-sheet')) {
    var _pickerEl = document.createElement('div');
    _pickerEl.id = 'photo-picker-sheet';
    _pickerEl.innerHTML = "<div id=\"photo-picker-inner\"><div style=\"text-align:center;font-family:var(--font-head);font-size:0.8rem;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:0.25rem\">Add Photo</div><button id=\"picker-btn-cam\" class=\"picker-btn\" style=\"display:none\"><span class=\"picker-icon\">\ud83d\udcf7</span><span id=\"picker-cam-label\">Take Photo</span></button><button id=\"picker-btn-lib\" class=\"picker-btn\"><span class=\"picker-icon\">\ud83d\uddbc\ufe0f</span><span id=\"picker-lib-label\">Choose from Library</span></button><button class=\"picker-btn\" style=\"border-color:var(--text-dim);color:var(--text-dim)\" onclick=\"closePhotoPicker()\"><span class=\"picker-icon\">\u2715</span><span>Cancel</span></button></div>";
    // Wire up camera button (creates hidden input on click)
    var _camBtn = _pickerEl.querySelector('#picker-btn-cam');
    if (_camBtn) _camBtn.addEventListener('click', function() {
      var inp = document.getElementById('picker-input-cam');
      if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file'; inp.id = 'picker-input-cam';
        inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
        inp.style.display = 'none';
        inp.addEventListener('change', function() { pickerHandleFile(inp, true); });
        document.body.appendChild(inp);
      }
      inp.value = ''; inp.click();
    });
    // Wire up library button
    var _libBtn = _pickerEl.querySelector('#picker-btn-lib');
    if (_libBtn) _libBtn.addEventListener('click', function() {
      var inp = document.getElementById('picker-input-lib');
      if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file'; inp.id = 'picker-input-lib';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        inp.addEventListener('change', function() { pickerHandleFile(inp, false); });
        document.body.appendChild(inp);
      }
      inp.value = ''; inp.click();
    });
    // Close on backdrop click
    bindOverlayClose(_pickerEl, function() { closePhotoPicker(); });
    document.body.appendChild(_pickerEl);
  }

  // Build identify modal v2 if not already present.
  // Photo drop / file picker + scale + type + multi-mfr hints + Drive-staged Lens search.
  if (!document.getElementById('identify-modal')) {
    var _identEl = document.createElement('div');
    _identEl.id = 'identify-modal';
    var _isMobileIm = !!window.IS_MOBILE_UA;   // v0.9.699: width/touch offered the WEBCAM on desktops
    var _photoButtons = _isMobileIm
      ? '<button type="button" id="id-take-photo" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid var(--accent);background:rgba(232,64,28,0.08);color:var(--accent);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">\ud83d\udcf7 Take Photo</button>'
        + '<button type="button" id="id-pick-photo" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid var(--accent2);background:rgba(201,146,42,0.08);color:var(--accent2);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">\ud83d\uddbc\ufe0f From Gallery</button>'
      : '<button type="button" id="id-pick-photo" style="flex:1;padding:0.7rem;border-radius:9px;border:1.5px dashed var(--accent2);background:rgba(201,146,42,0.06);color:var(--accent2);font-family:var(--font-body);font-weight:600;font-size:0.9rem;cursor:pointer">\ud83d\udcc1 Upload Photo</button>';
    var _mfrChips = ['Lionel','MTH','Atlas','K-Line','Weaver','Williams','RMT','Menards','Marx','Not sure'].map(function(m) {
      return '<label class="id-mfr-chip" data-mfr="' + m + '" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.35rem 0.7rem;border-radius:14px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid);font-size:0.78rem;cursor:pointer;user-select:none">'
        + '<input type="checkbox" data-mfr-cb="' + m + '" style="margin:0;cursor:pointer">'
        + '<span>' + m + '</span></label>';
    }).join(' ');
    _identEl.innerHTML =
      '<div id="identify-panel">'
      +   '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">'
      +     '<div style="font-family:var(--font-head);font-size:1.05rem;color:var(--text);letter-spacing:0.04em">Identify by Photo</div>'
      +     '<button onclick="closeIdentify()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;line-height:1">\u2715</button>'
      +   '</div>'
      +   '<div id="id-photo-area" style="margin-bottom:0.85rem">'
      +     '<div id="id-photo-preview" style="display:none;position:relative;border-radius:10px;overflow:hidden;border:1.5px solid var(--accent2);background:#000;text-align:center;margin-bottom:0.4rem">'
      +       '<img id="id-photo-img" style="max-width:100%;max-height:180px;display:block;margin:0 auto">'
      +       '<button id="id-photo-clear" type="button" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.7);border:1px solid var(--border);color:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:0.9rem">\u2715</button>'
      +     '</div>'
      +     '<div id="id-photo-buttons" style="display:flex;gap:0.4rem">' + _photoButtons + '</div>'
      +     '<input type="file" id="id-file-camera" accept="image/*" capture="environment" style="display:none">'
      +     '<input type="file" id="id-file-gallery" accept="image/*" style="display:none">'
      +   '</div>'
      +   '<div id="id-hints-row" style="display:flex;gap:0.4rem;margin-bottom:0.6rem">'
      +     '<div style="flex:1">'
      +       '<label style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;font-weight:600;display:block;margin-bottom:0.2rem">Scale</label>'
      +       '<select id="id-scale" style="width:100%;padding:0.5rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-size:0.85rem">'
      +         '<option value="">(any)</option>'
      +         '<option value="O gauge">O Gauge</option>'
      +         '<option value="S gauge">S Gauge</option>'
      +         '<option value="HO scale">HO</option>'
      +         '<option value="G scale">G Scale</option>'
      +         '<option value="Standard gauge">Standard Gauge</option>'
      +         '<option value="OO scale">OO</option>'
      +       '</select>'
      +     '</div>'
      +     '<div style="flex:1">'
      +       '<label style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;font-weight:600;display:block;margin-bottom:0.2rem">Type</label>'
      +       '<select id="id-type" style="width:100%;padding:0.5rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-size:0.85rem">'
      +         '<option value="">(any)</option>'
      +         '<option value="engine">Engine</option>'
      +         '<option value="boxcar">Boxcar</option>'
      +         '<option value="caboose">Caboose</option>'
      +         '<option value="passenger car">Passenger Car</option>'
      +         '<option value="flatcar">Flatcar</option>'
      +         '<option value="hopper">Hopper</option>'
      +         '<option value="tank car">Tank Car</option>'
      +         '<option value="gondola">Gondola</option>'
      +         '<option value="accessory">Accessory</option>'
      +         '<option value="building">Building / Structure</option>'
      +         '<option value="paper or advertising item">Paper / Advertising</option>'
      +         '<option value="set">Set</option>'
      +       '</select>'
      +     '</div>'
      +   '</div>'
      +   '<div id="id-mfr-block" style="margin-bottom:0.75rem">'
      +     '<label style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;font-weight:600;display:block;margin-bottom:0.3rem">Manufacturer (pick any that might apply)</label>'
      +     '<div id="id-mfr-chips" style="display:flex;flex-wrap:wrap;gap:0.3rem">' + _mfrChips + '</div>'
      +   '</div>'
      +   '<button id="id-search-btn" type="button" disabled style="width:100%;padding:0.75rem;border-radius:9px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text-dim);font-family:var(--font-head);font-size:0.95rem;letter-spacing:0.05em;cursor:not-allowed;margin-bottom:0.5rem">\ud83d\udd0d Identify from the photo</button>'
      +   '<button id="id-lens-btn" type="button" disabled style="width:100%;padding:0.6rem;border-radius:9px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-head);font-size:0.9rem;letter-spacing:0.04em;cursor:not-allowed;opacity:0.55;margin-bottom:0.5rem">\ud83d\udd0d Search Google Lens \u2197</button>'
      +   '<button id="id-paste-btn" type="button" style="width:100%;padding:0.6rem;border-radius:9px;background:rgba(58,110,165,0.15);border:1.5px solid #3a6ea5;color:#cfe3ff;font-family:var(--font-head);font-size:0.9rem;letter-spacing:0.04em;cursor:pointer;margin-bottom:0.5rem">\ud83d\udccb Paste Lens Result</button>'
      +   '<button id="id-shot-btn" type="button" style="width:100%;padding:0.6rem;border-radius:9px;background:rgba(46,204,113,0.12);border:1.5px solid #2ecc71;color:#c9f5dc;font-family:var(--font-head);font-size:0.9rem;letter-spacing:0.04em;cursor:pointer;margin-bottom:0.5rem">\ud83d\udcf8 Read a Screenshot of the Results</button>'
      +   '<input type="file" id="id-shot-file" accept="image/*" multiple style="display:none">'
      // v0.9.1013 (Brad): tip matches the device — phones screenshot, computers
      // copy the answer and it auto-pastes on return.
      +   '<div id="id-shot-tip" style="font-size:0.72rem;color:var(--text-dim);margin:-0.2rem 0 0.5rem;text-align:center">' + (window.IS_MOBILE_UA
            ? 'Tip: your phone\'s <b>scroll capture</b> ("Capture more") grabs the whole answer in one tall screenshot — or pick several screenshots at once.'
            : 'Tip: if you copied the answer on the Google tab (<b>Ctrl+C</b>), switching back here pastes it automatically — these buttons are the backups.') + '</div>'
      +   '<details id="id-help-block" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:0.4rem 0.65rem;font-size:0.75rem;color:var(--text-mid);margin-bottom:0.5rem">'
      +     '<summary style="cursor:pointer;color:var(--text);font-weight:600;font-size:0.78rem;list-style:none">How does this work? \u25b8</summary>'
      +     '<ol style="margin:0.5rem 0 0.15rem 1.1rem;padding:0;line-height:1.5">'
      +       '<li><strong>\ud83d\udd0d Identify from the photo</strong> answers right here in the app (fastest). Prefer Google? <strong>\ud83d\udd0d Search Google Lens</strong> opens a new tab</li>'
      +       '<li>On the Google page, <strong>select the answer text at the very top</strong> (the boxed summary Google shows first)</li>'
      +       '<li>Copy it (<kbd>Ctrl</kbd>+<kbd>C</kbd>)</li>'
      +       '<li>OR just <strong>screenshot the answer</strong> (use scroll capture for long answers)</li>'
      +       '<li>Come back to this app (app switcher / Back button) \u2014 tap <strong>\ud83d\udcf8 Read a Screenshot</strong> and pick it, or <strong>\ud83d\udccb Paste Lens Result</strong> if you copied text</li>'
      +     '</ol>'
      +     '<div style="margin-top:0.4rem;font-size:0.72rem;color:var(--text-dim)">Tip: if Google can\'t identify a real item number, you can type one below.</div>'
      +   '</details>'
      +   '<div id="id-manual-divider" style="font-size:0.7rem;color:var(--text-dim);text-align:center;margin:0.5rem 0 0.4rem">\u2014 or paste the item # you found \u2014</div>'
      +   '<div id="id-manual-row" style="display:flex;gap:0.4rem;align-items:stretch">'
      +     '<textarea id="identify-manual-input" rows="2" placeholder="e.g. 736 or paste Lens response (Enter=submit)" onkeydown="if(event.key===\'Enter\' && !event.shiftKey){event.preventDefault();useIdentifiedItem();}" style="flex:1;padding:0.5rem 0.65rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.9rem;box-sizing:border-box;resize:vertical;min-height:2.4rem;line-height:1.3"></textarea>'
      +     '<button onclick="useIdentifiedItem()" style="padding:0 0.9rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--gold);color:var(--gold);font-family:var(--font-head);font-size:0.85rem;letter-spacing:0.03em;cursor:pointer;white-space:nowrap">Enter \u2192</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(_identEl);
    // Wire interactive bits AFTER DOM insert (handlers live in wizard-photos.js).
    if (typeof _wireIdentifyModalV2 === 'function') _wireIdentifyModalV2();
  }
}

// ── Session 140 (Tier 3.19) ── Wizard manufacturer helper ──
// Returns the lowercase manufacturer for the current wizard context, derived
// from wizard.data._era via _manufacturerOfEra (defined in app.js Session 137).
// Used to gate Lionel-specific steps explicitly rather than via implicit
// data-presence checks (skipIf when no companions tab match, etc.).
function _wizardMfr() {
  try {
    if (typeof wizard === 'undefined' || !wizard.data) return '';
    // v0.9.765 (BUG-001): identify the brand from the ITEM being added FIRST.
    // The era fallback returns '' in the All Collection view, which made every
    // Lionel-only gate fail (tender photo steps skipped, box-variation hidden).
    var m = wizard.matchedItem || wizard.data.matchedItem || null;
    if (!m && wizard.data.itemNum && typeof findMaster === 'function') {
      m = findMaster(wizard.data.itemNum, wizard.data.variation);
    }
    if (m && typeof _manufacturerOfItem === 'function') {
      var mk = _manufacturerOfItem(m);
      if (mk) return String(mk).toLowerCase();
    }
    var era = wizard.data._era || (typeof _currentEra !== 'undefined' ? _currentEra : '');
    if (typeof _manufacturerOfEra === 'function') {
      return (_manufacturerOfEra(era) || '').toLowerCase();
    }
  } catch(e) {}
  return '';
}

// v0.9.743: price-step Research — opens the same Google AI-Overview price
// search as the Research card, for the item currently in the wizard.
window._wizResearchPrice = function () {
  try {
    var d = (typeof wizard !== 'undefined' && wizard.data) || {};
    // v0.9.839 (BUG-004, Brad's 10-2210): resolve the item the same way the
    // ADDING banner does — manual entries store manualItemNum/manualDesc,
    // and the match can live in wizard.matchedItem OR d.matchedItem.
    var num = (d.itemNum || d.manualItemNum || d.set_num || d.is_linkedItem || '').toString().trim();
    var m = (typeof wizard !== 'undefined' && wizard.matchedItem) || d.matchedItem || {};
    if (m && m.itemNum && num && String(m.itemNum).trim() !== num) m = {};
    if ((!m || !m.itemNum) && num && typeof findMaster === 'function') m = findMaster(num) || {};
    var mfr = m.manufacturer || d.manualManufacturer || ((typeof _brandOfItem === 'function') ? (_brandOfItem(num) || '') : '');
    var road = m.roadName || d.manualRoadName || d.suggestedRoadName || '';
    var desc = m.description || d.manualDesc || '';
    var url = (typeof window._googlePriceUrl === 'function')
      ? window._googlePriceUrl(num, mfr, road, desc)
      : 'https://www.google.com/search?q=' + encodeURIComponent([mfr, num, road, desc].filter(Boolean).join(' ') + ' sold prices value');
    window.open(url, '_blank');
  } catch (e) { console.warn('[research price]', e); }
};

// ── Research the SET you are adding (v0.9.1234) ────────────────────────
// Brad: "add to list for later, need a research button for the set add".
//
// Every other flow has a Research button beside its value field; the set flow
// never got one. It also needs a different question asked. The price buttons
// research an ITEM — "what did one of these sell for". Standing over a box of
// trains, the question is "what IS this", and there are two ways to ask it:
//
//   • With a set number, search the number: "Lionel 1467W set …".
//   • WITHOUT one, search the pieces. The item numbers already entered on the
//     identify step are the only description of the set that exists, and
//     searching them together is exactly how a collector identifies an
//     unnumbered box. This is the case the price buttons cannot cover.
//
// One button, on the identify step, because both paths through the set flow
// (knows the number / does not) converge there.
window._wizResearchSet = function () {
  try {
    var d = (typeof wizard !== 'undefined' && wizard.data) || {};
    var rs = d._resolvedSet || null;
    var num = String((rs && rs.setNum) || d.set_num || '').trim();
    var q;
    if (num) {
      q = ['Lionel', num, 'set', String((rs && rs.setName) || '').trim(),
           String((rs && rs.year) || '').trim()]
          .filter(Boolean).join(' ') + ' sold prices value';
    } else {
      var nums = (d._enteredNums || []).slice(0, 6).filter(Boolean);
      if (!nums.length && d.set_loco) nums = [String(d.set_loco).trim()];
      if (!nums.length) {
        if (typeof showToast === 'function') {
          showToast('Add the set number, or an item number or two, and I can look it up', 3500);
        }
        return;
      }
      q = 'Lionel postwar set ' + nums.join(' ');
    }
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
  } catch (e) { console.warn('[research set]', e); }
};

// What the button says depends on what it is about to search — a button that
// reads "Research this set" when no set has been named yet is a small lie.
window._wizResearchSetLabel = function () {
  var d = (typeof wizard !== 'undefined' && wizard.data) || {};
  var rs = d._resolvedSet || null;
  var num = String((rs && rs.setNum) || d.set_num || '').trim();
  if (num) return '\uD83D\uDD0D Research set ' + num;
  var n = ((d._enteredNums || []).filter(Boolean)).length;
  if (!n && d.set_loco) n = 1;
  if (!n) return '';
  return '\uD83D\uDD0D Look up what set these ' + (n === 1 ? 'number is from' : 'numbers are from');
};

// v0.9.748 (Brad): "i want our detail page and photo page" — no imitation
// modal. Hide (don't close) the wizard, open the REAL item detail page via
// _openOwnedByInvId (full header, descriptions, details card, photo grids),
// and float a return pill that drops the user back on the pricing step.
window._wizPeekDetail = function () {
  try {
    var k = wizard.data._collectionPdKey || wizard.data.selectedForSaleKey || wizard.data.selectedSoldKey;
    var pd = k ? state.personalData[k] : null;
    if (!pd) return;
    var modal = document.getElementById('wizard-modal');
    if (modal) modal.classList.remove('open');          // hide only — the sale stays in progress
    document.body.style.overflow = '';
    var old = document.getElementById('wiz-return-pill');
    if (old) old.remove();
    var pill = document.createElement('button');
    pill.id = 'wiz-return-pill';
    pill.innerHTML = '\u2190 Back to your ' + (wizard.tab === 'sold' ? 'sale' : 'listing');
    pill.style.cssText = 'position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);z-index:8000;padding:0.7rem 1.3rem;border-radius:999px;border:none;background:var(--accent,#e8401c);color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,0.45);font-family:var(--font-body)';
    pill.onclick = function () {
      pill.remove();
      var m = document.getElementById('wizard-modal');
      if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
    };
    document.body.appendChild(pill);
    if (typeof _openOwnedByInvId === 'function' && pd.inventoryId) _openOwnedByInvId(pd.inventoryId);
    else if (typeof goToMyCollection === 'function') goToMyCollection();
  } catch (e) { console.warn('[peek]', e); }
};

// v0.9.751 (Brad): sold flow picks from the For Sale list OR the collection.
window._soldPickSrcSet = function (src) {
  if (typeof wizard !== 'undefined' && wizard.data) { wizard.data._soldPickSrc = src; renderWizardStep(); }
};

// ── v0.9.993 (Brad): ITEM TYPE dropdown — "what are you adding?" ─────────
// Replaces the "Adding something else?" chip row. Shown at the start of the
// add flow; picking a kind rebuilds the wizard for that flow. Remembers the
// last-used kind across sessions (localStorage lv_add_kind).
// v0.9.1036 (Brad): plain text, no picture icons — they carried no meaning
// and the phone's own dropdown blew them up to the size of the words.
const _WIZ_KINDS = [
  { id: 'cataloged', label: 'Cataloged Item' },
  { id: 'set',       label: 'Lionel Postwar Set' },   // v0.9.994 (Brad): only era with set-composition data
  { id: 'paper',     label: 'Paper Item' },
  { id: 'catalogs',  label: 'Catalog' },
  { id: 'mockups',   label: 'Mock-Up' },
  { id: 'other',     label: 'Other' },
  { id: 'manual',    label: 'Manual — item not in our catalogs' },
];
function _wizCurrentKind() {
  try {
    if (wizard.data && wizard.data._manualEntry) return 'manual';
    if (wizard.tab === 'set') return 'set';
    if (['paper', 'catalogs', 'mockups', 'other'].indexOf(wizard.tab) >= 0) return wizard.tab;
  } catch (e) {}
  return 'cataloged';
}
function _wizSetKind(kind) {
  try { localStorage.setItem('lv_add_kind', kind); } catch (e) {}
  if (kind === _wizCurrentKind()) return;
  // Fresh restart of the add flow in the chosen kind (only offered on the
  // first screen, so nothing typed is lost).
  const _rp = (wizard.data && wizard.data._returnPage) || undefined;
  wizard = { step: 0, tab: 'collection', data: { tab: 'collection', _returnPage: _rp, itemCategory: 'lionel' }, steps: getSteps('collection'), matchedItem: null };
  if (kind === 'cataloged') { renderWizardStep(); return; }
  wizardChooseCategory(kind);
}
// v0.9.1039: ONE definition of the Item Type selector. The header (phones)
// and the in-form bar (desktop) both render this — they cannot drift apart.
function _wizKindSelectHtml(cur, compact) {
  return '<select id="wiz-kind-select" onchange="_wizSetKind(this.value)" style="' +
    'width:100%;padding:' + (compact ? '0.4rem 0.55rem' : '0.6rem 0.75rem') + ';border-radius:8px;border:2px solid #2980b9;' +
    'background:#f7f0dc;color:#2980b9;font-family:var(--font-head);font-weight:700;' +
    'font-size:' + (compact ? '0.9rem' : '0.92rem') + ';cursor:pointer;box-sizing:border-box">' +
    _WIZ_KINDS.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === cur ? ' selected' : '') + '>' + k.label + '</option>';
    }).join('') +
    '</select>';
}

function _syncWizKindBar(s) {
  const bar = document.getElementById('wizard-kind-bar');
  if (!bar) return;
  let show = false;
  try {
    const d = wizard.data || {};
    if (d._manualEntry) {
      show = !!(s && s.id === 'manualManufacturer');
    } else if (wizard.tab === 'collection') {
      show = !!(s && s.id === 'itemNumGrouping' && d.itemCategory === 'lionel' && !d._fillItemMode && !d.boxOnly);
    } else if (['set', 'paper', 'catalogs', 'mockups', 'other'].indexOf(wizard.tab) >= 0) {
      show = wizard.step === 0;
    }
  } catch (e) { show = false; }
  const head = document.getElementById('wizard-kind-head');
  const title = document.getElementById('wizard-title');
  if (!show) {
    bar.style.display = 'none'; bar.innerHTML = '';
    if (head) { head.style.display = 'none'; head.innerHTML = ''; }
    if (title) title.style.display = '';
    return;
  }
  const cur = _wizCurrentKind();
  // v0.9.1039 (Brad): phones put it in the header, in place of the title.
  if (window.IS_MOBILE_UA && head) {
    head.style.display = '';
    head.innerHTML = _wizKindSelectHtml(cur, true);
    if (title) title.style.display = 'none';
    bar.style.display = 'none'; bar.innerHTML = '';
    return;
  }
  if (title) title.style.display = '';
  if (head) { head.style.display = 'none'; head.innerHTML = ''; }
  bar.style.display = '';
  bar.innerHTML =
    '<div style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;font-weight:600;margin:0.6rem 0 0.25rem">Item Type</div>' +
    _wizKindSelectHtml(cur, false);
}
if (typeof window !== 'undefined') { window._wizSetKind = _wizSetKind; }

async function openWizard(tab) {
  // v0.9.826 (TODO-003): offline is view-only — say so up front instead of
  // failing at save time.
  if (window._offlineMode) {
    if (typeof showToast === 'function') showToast("You're offline — you can browse your collection, but adding items needs a connection", 4000, true);
    return;
  }
  // v0.9.840 (Phase C): lapsed = view-only; the bottom banner has the button.
  if (window._readOnlyMode) {
    if (typeof showToast === 'function') showToast('Your trial has ended — subscribe to keep adding items (button below)', 4000, true);
    return;
  }
  // Session 154: Want lookups span the whole catalog — load every era first
  // (instant if cached) so search isn't capped to the current era.
  if (tab === 'want' && typeof _currentEra !== 'undefined' && _currentEra !== 'all'
      && typeof loadAllErasMode === 'function') {
    try { await loadAllErasMode(); } catch(e) { console.warn('[want all-eras load]', e); }
  }
  _buildWizardModal();
  // Start wizard pre-set to a specific tab, skipping the tab picker step
  const _activePg = document.querySelector('.page.active');
  // v0.9.905 (Brad, item [7]): prefer the single-source last-page memory so
  // Cancel returns the user to where they actually were, never a stray
  // Dashboard default.
  const _returnPage = window._rrLastPage || (_activePg ? _activePg.id.replace('page-', '') : 'dashboard');
  wizard = { step: 0, tab: tab, data: { tab: tab, _returnPage: _returnPage }, steps: getSteps(tab), matchedItem: null };
  // Phase 2 streamline (Session post-216): for collection adds, default
  // itemCategory to 'lionel' so the category-picker step auto-skips. The
  // user can still switch to Set/Paper/Mock-Up/Other/Manual via the chip
  // row on the Item Number step.
  if (tab === 'collection') {
    wizard.data.itemCategory = 'lionel';
    wizard.steps = getSteps(tab);
    // Session 157: pre-warm the all-eras fallback dataset so that if the
    // user searches for an item outside the current era, the widened search
    // is instant. Non-blocking; never changes the current view/era.
    if (typeof _currentEra !== 'undefined' && _currentEra !== 'all'
        && typeof _getAllErasMasterForSearch === 'function') {
      _getAllErasMasterForSearch().catch(function(){});
    }
  }
  // Session 154: Want skips the category/era picker and lands on the catalog
  // search, scoped to All Collection so any item is findable.
  if (tab === 'want') {
    wizard.data.itemCategory = 'lionel';
    wizard.data._era = 'all';
    wizard.steps = getSteps(tab);
  }
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Register with BackStack so device back cleanly steps through wizard
  // steps (and closes on step 1). Replaces the old in-line pushState
  // because BackStack handles history entry pushing itself.
  if (window.BackStack) window.BackStack.push('wizard', _wizardBackHandler);
  // Skip old-style 'choice' tab picker — but NOT itemCategory (we want that shown)
  if (wizard.steps[0] && wizard.steps[0].type === 'choice') {
    wizard.step = 1;
  }
  // Pre-set lionel category if opening collection directly
  if (tab === 'collection' && !wizard.data.itemCategory) {
    // Don't pre-set — let user choose category first
  }
  renderWizardStep();
  // v0.9.993 (Brad): the ITEM TYPE selector remembers last-used. If the last
  // add was a Paper Item, the wizard reopens on the Paper flow. Deferred a
  // tick and guarded so flows that pre-fill an item (add-from-browse, box
  // only, quick-entry completion) are never hijacked.
  if (tab === 'collection') {
    setTimeout(function() {
      try {
        let _lk = '';
        try { _lk = localStorage.getItem('lv_add_kind') || ''; } catch (e) {}
        if (!_lk || _lk === 'cataloged') return;
        if (!_WIZ_KINDS.some(function(k) { return k.id === _lk; })) return;
        const d = wizard.data || {};
        if (wizard.tab !== 'collection' || d._manualEntry || d._fillItemMode || d.boxOnly || d.itemNum || d._updatePdKey || wizard.step > 0) return;
        wizardChooseCategory(_lk);
      } catch (e) {}
    }, 0);
  }
}

function closeWizard() {
  try { if (typeof _wizFieldFocusClose === 'function') _wizFieldFocusClose(); } catch (eF) {}
  // If in set mode with saved items, confirm before canceling
  const _savedItems = wizard && wizard.data && wizard.data._setItemsSaved;
  const _groupId = wizard && wizard.data && wizard.data._setGroupId;
  if (_savedItems && _savedItems.length > 0 && _groupId) {
    _confirmSetCancel();
    return;
  }
  // Bugfix 2026-04-14: confirm before discarding entered data.
  // Was silently closing the wizard (losing item#, condition, prices, photos, etc.)
  // Only prompt if the user has actually committed to an item (has item#) or
  // entered meaningful values (condition, pricePaid, userEstWorth, notes, photos).
  // Followup 2026-04-14: skip the prompt when the wizard is closing AFTER a
  // successful save (d._saveComplete is set by save handlers) — prompt was
  // firing on save-close, making the user think the item was discarded
  // when it had actually been saved.
  var d = (wizard && wizard.data) || {};
  if (d._saveComplete) { _doCloseWizard(); return; }
  var _hasData = !!(
    d.itemNum || d.variation || d.condition || d.pricePaid || d.priceItem ||
    d.userEstWorth || d.notes || d.salePrice || d.askingPrice ||
    (d._drivePhotos && d._drivePhotos.length > 0) || d.manualItemNum
  );
  if (_hasData) {
    if (typeof appConfirm === 'function') {
      appConfirm('Cancel and discard the info you\'ve entered? This cannot be undone.',
        { danger: true, ok: 'Discard', cancel: 'Keep editing', title: 'Discard this item?' })
        .then(function (ok) { if (ok) _doCloseWizard(); });
      return;
    }
    if (!confirm('Cancel and discard the info you\'ve entered? This cannot be undone.')) {
      return; // user chose to continue editing
    }
  }
  _doCloseWizard();
}

function _doCloseWizard() {
  try { if (typeof _wizFieldFocusClose === 'function') _wizFieldFocusClose(); } catch (eF) {}
  // v0.9.697: single-chokepoint cache snapshot (Brad's "says it saves but it
  // doesn't"): many save paths updated the sheet + in-memory state but never
  // refreshed the 2-hour personal-data cache, so the next app load REVERTED
  // to pre-save data. Every wizard flow closes through here.
  try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (eC) {}
  const returnTo = (wizard && wizard.data && wizard.data._returnPage) || window._rrLastPage;
  document.getElementById('wizard-modal').classList.remove('open');
  document.body.style.overflow = '';
  // Rewind the BackStack entry we pushed on openWizard. If BackStack itself
  // triggered this close (device back on step 1), the entry is already gone
  // and pop() is a no-op; safe either way.
  if (window.BackStack) window.BackStack.pop('wizard');
  // v0.9.1191 (Brad: "when you cancel and hit disreguard, it takes you to
  // dashboard, not back to the photo inbox"). v0.9.1062 already made the
  // inbox state its return page outright, and it does — traced live, this
  // showPage() lands on 'photo-inbox' every time. Then the history rewind
  // above delivers its popstate a beat LATER, app.js reads it as the user
  // pressing Back, walks the visit trail, and hauls the user off to the
  // Dashboard. Two correct behaviours, one stealing the other's result:
  //
  //   showPage('photo-inbox')  <- _doCloseWizard        (right)
  //   showPage('dashboard')    <- _rrGoBackTo, popstate (steals it)
  //
  // So the return is CLAIMED here: app.js honours this stamp for one
  // popstate and re-pushes instead of navigating. Timestamped, single-use,
  // so a real Back press a moment later still works normally.
  if (returnTo) {
    window._rrWizardReturn = { page: returnTo, at: Date.now() };
    showPage(returnTo);
  }
}

// ── v0.9.1122 (Brad's 1562W) ───────────────────────────────────────────────
// A set can legitimately contain the SAME item number twice. The catalog's
// own row for 1562W reads "Car 1 = 2442, Car 2 = 2442" with the note "Two
// 2442 Clifton Vista Domes" — two real cars, one number. The walkthrough list
// used to be built by running every number through a Map keyed on the
// normalized number, which silently collapsed that pair into ONE car: saving
// the first 2442 jumped straight to the next number, and the second car could
// never be entered.
//
// The CATALOG decides how many of each piece a set contains, so its list is
// taken verbatim, repeats and all. Alternates and hand-typed additions are
// appended only when that number isn't already accounted for — which is what
// the old dedupe was actually there to do.
function _rrBuildSetItems(rs, enteredNums) {
  var nums = enteredNums || [];
  if (!rs) return nums.slice();
  var sameNum = function (a, b) {
    return normalizeItemNum(a) === normalizeItemNum(b) || baseItemNum(a) === baseItemNum(b);
  };
  var out   = (rs.items || []).slice();                 // repeats are real — keep them
  var known = [].concat(rs.items || [], rs.alts || []);
  var extra = [];
  (rs.alts || []).forEach(function (a) {                // alts only if the user entered one
    if (nums.some(function (e) { return sameNum(e, a); })) extra.push(a);
  });
  nums.forEach(function (n) {                           // hand-typed add-ons the set doesn't list
    if (!known.some(function (k) { return sameNum(k, n); })) extra.push(n);
  });
  extra.forEach(function (x) {
    if (!out.some(function (o) { return normalizeItemNum(o) === normalizeItemNum(x); })) out.push(x);
  });
  return out;
}
if (typeof window !== 'undefined') window._rrBuildSetItems = _rrBuildSetItems;

// v0.9.1122: ONE place that removes every collection row belonging to a set
// group — used by the mid-entry cancel dialog AND by the abandoned-set notice
// in My Collection, so both paths delete identically. Returns the count.
async function rrRemoveSetGroup(groupId) {
  if (!groupId) return 0;
  var keys = Object.keys(state.personalData).filter(function (k) {
    var pd = state.personalData[k];
    return pd && pd.groupId === groupId;
  });
  // Descending row order so earlier deletes don't shift later row numbers.
  keys.sort(function (a, b) { return (state.personalData[b].row || 0) - (state.personalData[a].row || 0); });
  var removed = 0;
  for (const key of keys) {
    try {
      const pd = state.personalData[key];
      if (pd && pd.row) {
        await sheetsDeleteRow(state.personalSheetId, PERSONAL_TAB, pd.row);
        // v0.9.1236 (identity audit): a sheet row number is a POSITION, and
        // deleting a row moves every row beneath it up by one. Every other
        // delete path in the app calls this; this one never did, so cancelling
        // a set left every later item's remembered row one too high. Nothing
        // looked wrong — until the next edit, which then wrote to the row
        // BELOW the item being edited and overwrote a different item.
        if (typeof _adjustRowsAfterDelete === 'function') {
          _adjustRowsAfterDelete(state.personalData, pd.row);
          if (state.forSaleData) _adjustRowsAfterDelete(state.forSaleData, pd.row);
        }
      }
      delete state.personalData[key];
      removed++;
    } catch (e) { console.warn('[setGroup] delete failed:', e); }
  }
  try {
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_personal_cache_ts');
  } catch (e) {}
  return removed;
}
if (typeof window !== 'undefined') window.rrRemoveSetGroup = rrRemoveSetGroup;

// Called by BackStack when the user hits the device back button with the
// wizard open. Step > 0 → walk back one step (respects skipIf / set-mode
// filtering via wizardBack()). Step 0 → close silently.
//
// Step 0 deliberately skips the discard-confirm dialog in closeWizard()
// because on the first step the only "data" present is typically a raw
// search query (e.g. "nashville") the user typed into the item-lookup
// box — oninput sets wizard.data.itemNum while typing. That's not a
// commitment worth prompting over. Once the user has picked a specific
// item and stepped forward, closeWizard's guard still applies via the
// toolbar Cancel button.
function _wizardBackHandler() {
  // BackStack has already popped our entry when it dispatched us.
  if (!wizard || wizard.step <= 0) {
    _doCloseWizard();
  } else {
    // wizardBack() now returns false when no earlier visible step exists
    // (e.g. user on step 1, step 0 was itemCategory and is now skipIf→true
    // because they've picked a category). In that case, "back" should
    // close the wizard cleanly — silently, matching the step-0 close
    // path above — not loop back onto the same step.
    var moved = wizardBack();
    if (!moved) { _doCloseWizard(); return; }
  }
  // If the wizard is still open (user stepped back), re-push so the next
  // device-back press still routes here.
  var wizModal = document.getElementById('wizard-modal');
  if (wizModal && wizModal.classList.contains('open')) {
    if (window.BackStack) window.BackStack.push('wizard', _wizardBackHandler);
  }
}

async function _confirmSetCancel() {
  const saved = wizard.data._setItemsSaved || [];
  const groupId = wizard.data._setGroupId || '';

  // Build confirm overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  const box = document.createElement('div');
  box.className = 'rr-card'; box.style.cssText += ';border-color:var(--accent);text-align:center';
  box.innerHTML = '<div style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent);margin-bottom:0.75rem">Cancel Set Entry?</div>'
    + '<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-bottom:1.25rem">Are you sure? All ' + saved.length + ' item' + (saved.length !== 1 ? 's' : '') + ' you\'ve already entered for this set will be deleted.</div>'
    + '<div style="display:flex;gap:0.5rem;justify-content:center">'
    + '<button id="set-cancel-back" style="padding:0.55rem 1.1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Go Back</button>'
    + '<button id="set-cancel-confirm" style="padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Yes, Delete All</button>'
    + '</div>';
  overlay.appendChild(box);
  bindOverlayClose(overlay, function() { overlay.remove(); });
  document.body.appendChild(overlay);

  document.getElementById('set-cancel-back').onclick = function() { overlay.remove(); };
  document.getElementById('set-cancel-confirm').onclick = async function() {
    const btn = document.getElementById('set-cancel-confirm');
    btn.disabled = true;
    btn.textContent = 'Deleting\u2026';

    // v0.9.1122: shared with the abandoned-set notice in My Collection.
    const _nRemoved = await rrRemoveSetGroup(groupId);
    overlay.remove();
    showToast('Set entry canceled \u2014 ' + _nRemoved + ' item' + (_nRemoved !== 1 ? 's' : '') + ' removed');
    _doCloseWizard();
    buildDashboard();
    renderBrowse();
  };
}

// ── Quick Entry flow (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

function closeWizardOnOverlay(e) {
  // Intentionally disabled — clicking outside the wizard does nothing.
  // Use the Cancel button to exit.
}

// ── Wizard Consolidation Helpers ──

// ── Step interaction handlers (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

// Session 115: Type + Road filter helpers. The itemNumGrouping renderer
// (collection tab) has inline code that builds these dropdowns — and
// now the want-tab itemNum step reuses the same UI via these helpers
// so users can narrow their search in both flows. Event wiring reads
// wizard.data._searchFilterType / _searchFilterRoad which
// updateItemSuggestions already honors; no search-side changes needed.
//
// Returns a DOM element (container) with the filter dropdowns, or null
// when filters shouldn't render (tab not in applyToTabs, insufficient
// distinct values, or getMasterDistinct unavailable).
// Sticky Add-screen filters: remember Manufacturer + Era across adds (Brad).
function _clearAddFilters() {
  if (typeof wizard !== 'undefined' && wizard.data) { wizard.data._searchFilterManufacturer = ''; wizard.data._searchFilterPeriod = ''; wizard.data._searchFilterType = ''; }
  try { localStorage.removeItem('lv_add_mfr'); localStorage.removeItem('lv_add_era'); } catch (e) {}
  ['wiz-search-mfr', 'wiz-search-era', 'wiz-search-type'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var i = document.getElementById('wiz-input');
  if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
}
if (typeof window !== 'undefined') window._clearAddFilters = _clearAddFilters;

function _buildItemSearchFiltersDOM() {
  var cfg = window.ITEM_SEARCH_FILTERS || {};
  var ui  = cfg.ui || {};
  var sz  = cfg.sizing || {};
  var applies = (cfg.applyToTabs || []).indexOf(wizard.tab) !== -1;
  if (!applies) return null;
  if (typeof getMasterDistinct !== 'function') return null;
  // Sticky filters: on a fresh add (wizard.data rebuilt), seed Manufacturer + Era
  // from the user's last choice so they persist until cleared.
  if (wizard.tab === 'collection' || wizard.tab === 'want') {   // v0.9.715: want too (Brad)
    if (wizard.data._searchFilterManufacturer === undefined) { try { wizard.data._searchFilterManufacturer = localStorage.getItem('lv_add_mfr') || ''; } catch (e) { wizard.data._searchFilterManufacturer = ''; } }
    if (wizard.data._searchFilterPeriod === undefined) { try { wizard.data._searchFilterPeriod = localStorage.getItem('lv_add_era') || ''; } catch (e) { wizard.data._searchFilterPeriod = ''; } }
  }

  // Session 119: 22 clean tier-1 buckets (Steam, Diesel, Boxcar...) instead of 40 raw itemType synonyms.
  var types = ((typeof _bucketsInCurrentEra === 'function') ? _bucketsInCurrentEra() : (window.TYPE_BUCKETS || []).map(function(b){ return b.label; }));
  var roads = getMasterDistinct('roadName');
  // Session 154: Manufacturer + Scale options from the era config. Shown only
  // in All-Collection mode (the want flow) where multiple makers/scales mix.
  var _allMode = (wizard.data && wizard.data._era === 'all');
  var mfrs = (function(){ var seen={}, out=[]; if (typeof ERAS!=='undefined') Object.keys(ERAS).forEach(function(k){ var m=ERAS[k]&&ERAS[k].manufacturer; if(m&&!seen[m]){seen[m]=1;out.push(m);} }); return out.sort(); })();
  var scales = (function(){ var seen={}, out=[]; if (typeof ERA_SCALE!=='undefined') Object.keys(ERA_SCALE).forEach(function(k){ var v=ERA_SCALE[k]; if(v&&!seen[v]){seen[v]=1;out.push(v);} }); return out.sort(); })();
  var minCount = cfg.showOnlyIfAtLeast || 2;
  var showType = types.length >= minCount;
  var showRoad = roads.length >= minCount;
  var _showAdvanced = _allMode || wizard.tab === 'collection';
  var showMfr = _showAdvanced && mfrs.length >= minCount;
  var showScale = _showAdvanced && scales.length >= minCount;
  // Session 176: the collection (add) tab always shows the filter bar because the
  // Era dropdown is a fixed list, so don't bail even if type/road/mfr/scale are thin.
  if (wizard.tab !== 'collection' && wizard.tab !== 'want' && !showType && !showRoad && !showMfr && !showScale) return null;   // v0.9.715: want always shows the bar too

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var container = document.createElement('div');
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:' + (sz.gapPx || 8) + 'px;margin-bottom:0.5rem;flex-wrap:wrap';

  function mkDrop(fieldId, label, values, currentVal) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-width:130px';
    var opts = '<option value="">' + esc(ui.anyLabel || '(any)') + '</option>' +
      values.map(function(v) {
        var sel = v === currentVal ? ' selected' : '';
        return '<option value="' + esc(v) + '"' + sel + '>' + esc(v) + '</option>';
      }).join('');
    wrap.innerHTML =
      '<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.2rem;' +
        'letter-spacing:0.06em;text-transform:uppercase;font-weight:600">' + esc(label) + '</div>' +
      '<select id="' + fieldId + '" style="' +
        'width:100%;padding:0.5rem 0.65rem;font-size:' + (sz.fontPx || 14) + 'px;' +
        'background:var(--surface2);color:var(--text);border:1px solid var(--border);' +
        'border-radius:8px;min-height:' + (sz.minHeightPx || 44) + 'px' +
      '">' + opts + '</select>';
    return wrap;
  }

  // mkDrop variant for value/label pairs (used by the Era dropdown).
  function mkDropPairs(fieldId, label, pairs, currentVal) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-width:130px';
    var opts = '<option value="">' + esc(ui.anyLabel || 'All') + '</option>' +
      pairs.map(function(p) {
        var sel = p.value === currentVal ? ' selected' : '';
        return '<option value="' + esc(p.value) + '"' + sel + '>' + esc(p.label) + '</option>';
      }).join('');
    wrap.innerHTML =
      '<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.2rem;' +
        'letter-spacing:0.06em;text-transform:uppercase;font-weight:600">' + esc(label) + '</div>' +
      '<select id="' + fieldId + '" style="' +
        'width:100%;padding:0.5rem 0.65rem;font-size:' + (sz.fontPx || 14) + 'px;' +
        'background:var(--surface2);color:var(--text);border:1px solid var(--border);' +
        'border-radius:8px;min-height:' + (sz.minHeightPx || 44) + 'px' +
      '">' + opts + '</select>';
    return wrap;
  }
  var _eraPairs = [
    { value: 'prewar',  label: 'Pre-War' },
    { value: 'postwar', label: 'Postwar' },
    { value: 'modern',  label: 'Modern' },
  ];

  if (wizard.tab === 'collection' || wizard.tab === 'want') {
    // Session 176: the add screen shows exactly Manufacturer / Era / Type, each
    // defaulting to "All". Road/Scale are intentionally omitted to keep it simple.
    // v0.9.715 (Brad): the WANT flow gets the same bar + Scale — picking from
    // the master list needs manufacturer / era / type / scale narrowing.
    if (mfrs.length) bar.appendChild(mkDrop('wiz-search-mfr', 'Manufacturer', mfrs, wizard.data._searchFilterManufacturer || ''));
    bar.appendChild(mkDropPairs('wiz-search-era', 'Era', _eraPairs, wizard.data._searchFilterPeriod || ''));
    if (showType) bar.appendChild(mkDrop('wiz-search-type', ui.typeLabel || 'Type', types, wizard.data._searchFilterType || ''));
    if (wizard.tab === 'want' && scales.length) bar.appendChild(mkDrop('wiz-search-scale', 'Scale', scales, wizard.data._searchFilterScale || ''));
    // Clear-filters button (Manufacturer + Era are remembered between adds).
    var _clrWrap = document.createElement('div');
    _clrWrap.style.cssText = 'display:flex;align-items:flex-end';
    _clrWrap.innerHTML = '<button type="button" onclick="_clearAddFilters()" style="padding:0.5rem 0.8rem;font-size:13px;background:var(--surface2);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;min-height:' + (sz.minHeightPx || 44) + 'px;cursor:pointer;white-space:nowrap">Clear filters</button>';
    bar.appendChild(_clrWrap);
  } else {
    if (showType) bar.appendChild(mkDrop('wiz-search-type', ui.typeLabel || 'Type',       types, wizard.data._searchFilterType || ''));
    if (showRoad) bar.appendChild(mkDrop('wiz-search-road', ui.roadLabel || 'Road name',  roads, wizard.data._searchFilterRoad || ''));
    if (showMfr)   bar.appendChild(mkDrop('wiz-search-mfr',   'Manufacturer', mfrs,   wizard.data._searchFilterManufacturer || ''));
    if (showScale) bar.appendChild(mkDrop('wiz-search-scale', 'Scale',        scales, wizard.data._searchFilterScale || ''));
  }
  container.appendChild(bar);

  if (ui.hint) {
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.72rem;color:var(--text-dim);margin-bottom:0.55rem;font-style:italic';
    hint.textContent = ui.hint;
    container.appendChild(hint);
  }
  return container;
}

// Wires change events on the #wiz-search-type / #wiz-search-road selects
// currently in the DOM. Cross-filters (picking Type narrows Road list and
// vice-versa), updates the suggestion list, and attaches RoadTypeahead so
// users can type instead of scroll through 1,300+ roads.
function _wireItemSearchFilters() {
  var cfg = window.ITEM_SEARCH_FILTERS || {};
  var ui  = cfg.ui || {};
  var anyLabel = ui.anyLabel || '(any)';
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function refreshDropdown(selId, fieldName, otherFieldName, otherValue, currentVal, stateKey) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    // Session 119: bucket-aware. Type dropdown always shows 22 clean tier-1 buckets (no narrowing).
    // Road predicate uses bucket label when filtering by Type, so picking "Steam" matches both
    // Steam Engine and Steam Locomotive items in the master sheet.
    var values;
    if (fieldName === 'itemType') {
      values = ((typeof _bucketsInCurrentEra === 'function') ? _bucketsInCurrentEra() : (window.TYPE_BUCKETS || []).map(function(b){ return b.label; }));
    } else {
      var predicate = otherValue
        ? (otherFieldName === 'itemType'
            ? function(m) { return m && (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(m) : String(m.itemType || '').trim()) === otherValue; }
            : function(m) { return (m && String(m[otherFieldName] || '').trim() === otherValue); })
        : null;
      values = (typeof getMasterDistinct === 'function') ? getMasterDistinct(fieldName, predicate) : [];
    }
    var opts = '<option value="">' + esc(anyLabel) + '</option>';
    var stillValid = false;
    values.forEach(function(v) {
      var selFlag = v === currentVal;
      if (selFlag) stillValid = true;
      opts += '<option value="' + esc(v) + '"' + (selFlag ? ' selected' : '') + '>' + esc(v) + '</option>';
    });
    sel.innerHTML = opts;
    if (currentVal && !stillValid) {
      sel.value = '';
      if (stateKey && wizard && wizard.data) wizard.data[stateKey] = '';
    }
    if (window.RoadTypeahead && typeof RoadTypeahead.refresh === 'function') {
      RoadTypeahead.refresh(sel);
    }
  }
  var typeSel = document.getElementById('wiz-search-type');
  if (typeSel) {
    typeSel.addEventListener('change', function() {
      wizard.data._searchFilterType = this.value || '';
      refreshDropdown('wiz-search-road', 'roadName', 'itemType', wizard.data._searchFilterType, wizard.data._searchFilterRoad || '', '_searchFilterRoad');
      var i = document.getElementById('wiz-input');
      if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
    });
  }
  var roadSel = document.getElementById('wiz-search-road');
  if (roadSel) {
    roadSel.addEventListener('change', function() {
      wizard.data._searchFilterRoad = this.value || '';
      refreshDropdown('wiz-search-type', 'itemType', 'roadName', wizard.data._searchFilterRoad, wizard.data._searchFilterType || '', '_searchFilterType');
      var i = document.getElementById('wiz-input');
      if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
    });
  }
  var mfrSel = document.getElementById('wiz-search-mfr');
  if (mfrSel) {
    mfrSel.addEventListener('change', function() {
      wizard.data._searchFilterManufacturer = this.value || '';
      try { localStorage.setItem('lv_add_mfr', this.value || ''); } catch (e) {}
      // Session 176: non-Lionel makers (Atlas/MTH/Weaver/RMT/...) are all Modern —
      // auto-set the Era filter to Modern when one is chosen.
      var _mv = String(this.value || '').toLowerCase();
      var _eraSel2 = document.getElementById('wiz-search-era');
      if (_mv && _mv !== 'lionel') {
        wizard.data._searchFilterPeriod = 'modern';
        if (_eraSel2) _eraSel2.value = 'modern';
        try { localStorage.setItem('lv_add_era', 'modern'); } catch (e) {}
      }
      var i = document.getElementById('wiz-input');
      if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
    });
  }
  var eraSel = document.getElementById('wiz-search-era');
  if (eraSel) {
    eraSel.addEventListener('change', function() {
      wizard.data._searchFilterPeriod = this.value || '';
      try { localStorage.setItem('lv_add_era', this.value || ''); } catch (e) {}
      var i = document.getElementById('wiz-input');
      if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
    });
  }
  var scaleSel = document.getElementById('wiz-search-scale');
  if (scaleSel) {
    scaleSel.addEventListener('change', function() {
      wizard.data._searchFilterScale = this.value || '';
      var i = document.getElementById('wiz-input');
      if (typeof updateItemSuggestions === 'function') updateItemSuggestions(i ? i.value : '');
    });
  }
  if (window.RoadTypeahead && typeof RoadTypeahead.attach === 'function') {
    if (typeSel) RoadTypeahead.attach(typeSel);
    if (roadSel) RoadTypeahead.attach(roadSel);
  }
}

// Session 115: grouping-choice helpers called by inline onchange on the
// Confirm-step checkboxes / radios. Kept on window so the inline
// handlers can find them regardless of load order.
window._grpToggleOne = function(invKey, checked) {
  if (typeof wizard === 'undefined' || !wizard || !wizard.data) return;
  if (!wizard.data._groupingLinkChoices) wizard.data._groupingLinkChoices = {};
  wizard.data._groupingLinkChoices[invKey] = !!checked;
};
window._grpPickRadio = function(type, selectedInvKey) {
  if (typeof wizard === 'undefined' || !wizard || !wizard.data) return;
  if (!wizard.data._groupingLinkChoices) wizard.data._groupingLinkChoices = {};
  // Turn off every candidate of this type, then turn on the one picked.
  // Works for the "None" case (selectedInvKey === '') which leaves all
  // of this type off.
  var cands = (typeof findGroupingCandidates === 'function')
    ? findGroupingCandidates(wizard.data) : [];
  cands.forEach(function(c) {
    if (c.type !== type) return;
    wizard.data._groupingLinkChoices[c.invKey] = (c.invKey === selectedInvKey);
  });
};

// Session 115: unified grouping-candidate detector. Given the current
// wizard data, returns owned personal-data rows that could naturally
// group with the thing being added. Sets are deliberately excluded —
// the Set Builder function handles outfit-set linking.
//
// Stage 1 (this commit): item ↔ box bidirectional.
// Later stages will extend this to engine↔tender, A↔B/powered↔dummy,
// and item↔instruction-sheet. Adding a stage is a matter of pushing
// more entries into `out`; downstream (Confirm step + save) already
// iterates `findGroupingCandidates()` generically.
//
// Each candidate:
//   { type:'box'|'item', itemNum, invKey, pd, label, flagKey }
// flagKey is the wizard.data field that toggles whether to link:
//   '_groupWithExistingBox' for the item→box direction (truthy = link)
//   'boxGroupSuggest'        for the box→item direction ('Yes' = link)
function findGroupingCandidates(d) {
  if (!d) return [];
  if (typeof state === 'undefined' || !state || !state.personalData) return [];
  var num = (d.itemNum || '').toString().trim();
  if (!num) return [];
  var isAddingBox = !!d.boxOnly;
  var out = [];

  // Build target sets — the item numbers we'd group with, keyed by type.
  // Box ↔ item uses suffix matching; tender / engine / partner use the
  // partner map (app.js — getMatchingTenders, getMatchingLocos,
  // getSetPartner). Gracefully no-op when those helpers aren't loaded.
  var boxTargets     = new Set();
  var itemTargets    = new Set();
  var tenderTargets  = new Set();
  var engineTargets  = new Set();
  var partnerTargets = new Set();

  if (isAddingBox) {
    itemTargets.add(num);
  } else {
    boxTargets.add(num + '-BOX');
    // Stage 2: Engine ↔ Tender
    if (typeof getMatchingTenders === 'function') {
      try { getMatchingTenders(num).forEach(function(t) { tenderTargets.add(String(t).trim()); }); } catch(e) {}
    }
    if (typeof getMatchingLocos === 'function') {
      try { getMatchingLocos(num).forEach(function(e) { engineTargets.add(String(e).trim()); }); } catch(e) {}
    }
    // Stage 3: A-unit ↔ B-unit
    if (typeof getSetPartner === 'function') {
      try {
        var partner = getSetPartner(num);
        if (partner) partnerTargets.add(String(partner).trim());
      } catch(e) {}
    }
  }

  var keys = Object.keys(state.personalData);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var pd = state.personalData[k];
    if (!pd || !pd.owned) continue;
    // Already in a shared group? Skip — we don't re-link what's linked.
    if (pd.groupId) continue;
    var pdNum = String(pd.itemNum || '').trim();
    if (!pdNum) continue;

    if (isAddingBox) {
      // Adding a box → look for the matching plain item
      if (itemTargets.has(pdNum) && pdNum.indexOf('-BOX') < 0) {
        out.push({
          type: 'item',
          itemNum: pdNum,
          invKey: k,
          pd: pd,
          label: 'Item No. ' + pdNum + (pd.condition ? ' (condition ' + pd.condition + ')' : ''),
          flagKey: 'boxGroupSuggest',
        });
      }
    } else {
      if (boxTargets.has(pdNum)) {
        out.push({
          type: 'box',
          itemNum: pdNum,
          invKey: k,
          pd: pd,
          label: 'Box for No. ' + num + (pd.boxCond ? ' (box condition ' + pd.boxCond + ')' : ''),
          flagKey: '_groupWithExistingBox',
        });
      } else if (tenderTargets.has(pdNum)) {
        out.push({
          type: 'tender',
          itemNum: pdNum,
          invKey: k,
          pd: pd,
          label: 'Tender No. ' + pdNum + (pd.condition ? ' (condition ' + pd.condition + ')' : ''),
          flagKey: '_groupWithExistingTender',
        });
      } else if (engineTargets.has(pdNum)) {
        out.push({
          type: 'engine',
          itemNum: pdNum,
          invKey: k,
          pd: pd,
          label: 'Engine No. ' + pdNum + (pd.condition ? ' (condition ' + pd.condition + ')' : ''),
          flagKey: '_groupWithExistingEngine',
        });
      } else if (partnerTargets.has(pdNum)) {
        // Label disambiguates which side is the partner: if the one
        // the user owns ends in "C", call it the B-unit; otherwise
        // "paired unit" covers the generic A-unit case.
        var partnerLabel = pdNum.toUpperCase().endsWith('C')
          ? 'B-unit No. '
          : 'Paired unit No. ';
        out.push({
          type: 'partner',
          itemNum: pdNum,
          invKey: k,
          pd: pd,
          label: partnerLabel + pdNum + (pd.condition ? ' (condition ' + pd.condition + ')' : ''),
          flagKey: '_groupWithExistingPartner',
        });
      }
    }
  }

  // Stage 4: Item ↔ Instruction Sheet. Only surfaces when adding a
  // regular item (not a box) — the reverse direction (adding an IS
  // while owning the item) is already handled inside the IS wizard
  // flow (is_groupChoice step) and lives on a separate Google Sheet
  // tab, so nothing to do here for that direction.
  if (!isAddingBox && state.isData && typeof state.isData === 'object') {
    var isKeys = Object.keys(state.isData);
    for (var j = 0; j < isKeys.length; j++) {
      var isKey = isKeys[j];
      var isEntry = state.isData[isKey];
      if (!isEntry) continue;
      if (isEntry.groupId) continue;
      var linked = String(isEntry.linkedItem || '').trim();
      if (linked !== num) continue;
      out.push({
        type: 'is',
        itemNum: isEntry.sheetNum || ('IS-' + isKey),
        invKey: 'is_' + isKey,
        pd: isEntry,
        label: 'Instruction sheet ' + (isEntry.sheetNum || '#' + isKey)
          + (isEntry.condition ? ' (condition ' + isEntry.condition + ')' : ''),
        flagKey: '_groupWithExistingIS',
      });
    }
  }

  return out;
}

// Session 115: persistent "Adding No. X — Description" banner shown at
// the top of every wizard step once we know what's being added. Nothing
// renders until the user has picked / typed an item number (or, for the
// Set flow, a set number). Colour + label adapt to box-only and to the
// want/for-sale/sold tabs so the user always sees the correct context.
// v0.9.1143 — the flow tag shown as the wizard's top line, so every step
// reminds the user which list they are feeding.
// v0.9.1144 (Brad): the first cut used full sentences ("Add Item to Your Sale
// List"), which stacked a second sentence on top of the question-style step
// titles — "now it seems redundant or too wordy". The step titles carry the
// friendly voice ("What is the item number?"); this line is a compact tag that
// answers only "which list?" and fits one phone line.
function _wizFlowTitle() {
  switch (wizard && wizard.tab) {
    case 'collection': return 'Collection';
    case 'want':       return 'Want List';
    case 'forsale':    return 'Sale List';
    case 'sold':       return 'Sold';
    case 'catalogs':   return 'Catalogs';
    case 'paper':      return 'Paper Items';
    case 'mockups':    return 'Mock-Ups';
    case 'other':      return 'Other Items';
    default:           return 'Add an Item';
  }
}

function _renderAddingBanner() {
  var el = document.getElementById('wizard-adding-banner');
  if (!el) return;
  if (typeof wizard === 'undefined' || !wizard) { el.innerHTML = ''; return; }
  var d = wizard.data || {};

  // Resolve the "what" being added. CRITICAL: in manual-entry mode we use
  // manualItemNum ONLY and skip master lookup — the wizard's regular
  // itemNum field might still hold a stale value typed earlier (e.g. a year
  // the user accidentally entered), and findMaster on that stale value
  // would surface an unrelated catalog row (this is how the banner ended
  // up reading "ADDING No. 2024 — Chesapeake & Ohio 'a' Unit" when the
  // user pasted a Lens response with year 2024).
  var _inManual = (d._manualEntry === true) || (d.itemCategory === 'manual');
  var num;
  if (_inManual) {
    num = (d.manualItemNum || '').toString().trim();
  } else {
    num = (d.itemNum || d.manualItemNum || d.set_num || d.is_linkedItem || '').toString().trim();
    if (!num && d._resolvedSet && d._resolvedSet.setNum) num = d._resolvedSet.setNum;
  }
  if (!num) { el.innerHTML = ''; return; }

  // Resolve the description. In manual mode, prefer the user-typed manualDesc
  // and skip findMaster (which would surface unrelated catalog rows because
  // the manualItemNum isn't a master entry). In cataloged mode, master
  // lookup gives the rich description.
  var desc = '';
  if (_inManual) {
    desc = d.manualDesc || '';
  } else {
    var match = null;
    if (wizard.matchedItem && String(wizard.matchedItem.itemNum || '').trim() === num) {
      match = wizard.matchedItem;
    } else if (typeof findMaster === 'function') {
      // v0.9.982: disambiguate colliding item numbers. When editing an existing
      // copy we know its stable identity (via _updatePdKey → the inventoryId-keyed
      // owned row); pass that owned row so findMaster resolves to the right
      // era/scale (e.g. postwar No. 115 vs standard-gauge No. 115). For new adds,
      // fall back to the item's era/variation hints.
      var _ownRow = (d._updatePdKey && typeof state !== 'undefined' && state.personalData)
        ? state.personalData[d._updatePdKey] : null;
      var _pref = _ownRow || (d._era ? { era: d._era, manufacturer: d.manufacturer || '' } : null);
      match = findMaster(num, d.variation, _pref);
    }
    if (match) {
      desc = _composeRoadDesc(match);
    } else if (d.manualDesc) {
      desc = d.manualDesc;
    } else if (d._resolvedSet && d._resolvedSet.setName) {
      desc = d._resolvedSet.setName;
    }
  }
  // Fallback: when no master match yet (common for items found via Lens that
  // aren't in our master tabs), build a description from the Identify-modal
  // hints (scale + type + manufacturer list) so the banner still tells the
  // user what they're working on. Example: "O gauge engine (possibly Weaver
  // or Williams)".
  if (!desc) {
    var _hintScale = (d._identifyScaleHint || '').toString().trim();
    var _hintType  = (d._identifyTypeHint  || '').toString().trim();
    var _hintMfrs  = Array.isArray(d._identifyMfrHints) ? d._identifyMfrHints.slice() : [];
    var _hintParts = [];
    if (_hintScale) _hintParts.push(_hintScale);
    if (_hintType)  _hintParts.push(_hintType);
    var _hintHead = _hintParts.join(' ');
    if (_hintHead && _hintMfrs.length) {
      desc = _hintHead + ' (possibly ' + _hintMfrs.join(' or ') + ')';
    } else if (_hintHead) {
      desc = _hintHead;
    } else if (_hintMfrs.length) {
      desc = 'possibly ' + _hintMfrs.join(' or ');
    }
  }

  // Flow-aware prefix: box-only, paper/set/mock, tab context (want/forsale/sold)
  var isBox  = !!d.boxOnly;
  var isSet  = !!(d._setMode || (d.itemCategory === 'set'));
  var tab    = wizard.tab || 'collection';
  var verb;
  if (tab === 'want')         verb = 'Adding to Want List';
  else if (tab === 'forsale') verb = 'Adding to For Sale';
  else if (tab === 'sold')    verb = 'Recording Sale of';
  else                        verb = 'Adding';
  var prefix = isBox ? (verb + ' a box for')
             : isSet ? (verb + ' a set:')
             : verb;
  var accentColor = isBox ? 'var(--accent2)' : 'var(--accent)';
  var icon        = isBox ? '\u{1F4E6}' : (isSet ? '\u{1F381}' : '\u{1F682}');

  // Escape user-visible strings — descriptions can contain ampersands etc.
  function _e(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Bug 10b (Session 154): external catalog link (MTH/Lionel/Atlas) shown
  // inline after the description. Reuses browse.js helper; only renders when
  // a master match exists (manual-entry items have no catalog page).
  var _bannerExt = '';
  if (typeof match !== 'undefined' && match && typeof window._itemExternalLinkHTML === 'function') {
    _bannerExt = window._itemExternalLinkHTML(match) || '';
  }
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;margin-top:0.55rem;'
      + 'background:var(--surface2);border-radius:6px;'
      + 'border-left:3px solid ' + accentColor + ';'
      + 'font-size:0.8rem;color:var(--text-mid);overflow:hidden">'
    +   '<span style="flex-shrink:0;font-size:0.95rem;line-height:1">' + icon + '</span>'
    +   '<span style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:var(--text-dim);flex-shrink:0;white-space:nowrap">' + _e(prefix) + '</span>'
    +   '<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent2);font-size:0.88rem;flex-shrink:0;white-space:nowrap">No.&nbsp;' + _e(num) + '</span>'
    +   (desc
          ? '<span style="color:var(--text-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1">&mdash; ' + _e(desc) + '</span>'
          : '<span style="flex:1"></span>')
    +   (_bannerExt ? '<span style="flex-shrink:0">' + _bannerExt + '</span>' : '')
    + '</div>';
}

// ── Bought from: adding someone who is not on the list yet (v0.9.1228) ──
// Brad: "the bought from dropdown box needs a add manual button as well. This
// would then open up the add contacts page."
//
// It is the other half of the standing rule that the app never suggests
// vendors: if we will not offer sellers, adding one by hand has to be easy at
// the moment we ask. The contact form is a pop-up at a higher layer than the
// wizard, so it opens ON TOP — nothing navigates away and half-typed purchase
// details are never at risk.
var PV_SELLER_NEW = '__rr_new_contact__';

// The list is drawn twice — once into the step's HTML string, once into the
// live DOM after a contact is added. So the ENTRIES and their order come from
// one place and the two renderers are thin. Otherwise "add someone new" ends
// up missing from whichever one somebody forgot.
window._pvSellerEntries = function (selectedId) {
  var out = [{ v: '', label: '— Not tracked —' }];
  (state.contactsData || []).slice().sort(function (a, b) {
    return (window._ctLastNameKey
      ? window._ctLastNameKey(a.name).localeCompare(window._ctLastNameKey(b.name))
      : (a.name || '').localeCompare(b.name || ''));
  }).forEach(function (ct) {
    out.push({
      v: ct.id,
      label: (ct.name || ct.business || ct.id) + (ct.business && ct.name ? ' — ' + ct.business : ''),
      on: ct.id === selectedId
    });
  });
  out.push({ v: PV_SELLER_NEW, label: '\uFF0B Add someone new…' });
  return out;
};
window._pvSellerFill = function (sel, selectedId) {
  if (!sel) return;
  sel.innerHTML = '';
  window._pvSellerEntries(selectedId).forEach(function (e) {
    var o = document.createElement('option');
    o.value = e.v; o.textContent = e.label;
    if (e.on) o.selected = true;
    sel.appendChild(o);
  });
  if (selectedId) sel.value = selectedId;
};

window._pvSellerPick = function (sel) {
  if (!sel) return;
  if (sel.value !== PV_SELLER_NEW) {
    wizard.data.purchasedFrom = sel.value;
    try { sessionStorage.setItem('lv_last_seller', sel.value); } catch (e) {}
    return;
  }
  // Put the box straight back to what it was, so abandoning the new contact
  // leaves the dropdown reading "Add someone new…" to nobody.
  sel.value = wizard.data.purchasedFrom || '';
  if (typeof window._ctOpenEdit !== 'function') {
    if (typeof showToast === 'function') showToast('Contacts are still loading — try again in a moment', 3000, true);
    return;
  }
  window._ctAfterSave = function (id) {
    var s2 = document.getElementById('pv-seller');
    if (!s2) return;
    window._pvSellerFill(s2, id);
    wizard.data.purchasedFrom = id;
    try { sessionStorage.setItem('lv_last_seller', id); } catch (e) {}
  };
  window._ctOpenEdit();
};

// ── The tender picker (hoisted, v0.9.1227) ──────────────────────────────
// Brad: "i had a different tender than the one suggested, i hit other tender,
// and got this error."
//
// These two lived INSIDE the `entryMode` branch of renderWizardStep(), so
// they only came into existence if that particular screen happened to render.
// The button that calls them is drawn on the Condition & Details step. Reach
// that step by any path that skipped entryMode -- which is what adding an
// engine with a tender does -- and the button pointed at a global that had
// never been created. The error banner was a ReferenceError.
//
// Same shape as every other bug this week: one thing defined somewhere that
// does not govern where it is used. The fix is to move it, not to guard the
// call site -- a guard would have made the button silently do nothing, which
// is worse than an error.
//
// They depend on nothing from that branch: only wizard, state,
// getMatchingTenders, isTender and renderWizardStep, all module-level.
// Tender picker popup
window._showTenderPicker = function() {
  var existing = document.getElementById('tender-picker-modal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'tender-picker-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = '<div class="rr-card">'
    + '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.1rem">Select Your Tender</div>'
    + '<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.85rem">Type a tender number to search, or pick from the list below.</div>'
    + '<input id="tender-picker-input" type="search" autocomplete="off" placeholder="e.g. 2046W, 6026T…" style="width:100%;box-sizing:border-box;padding:0.65rem 0.85rem;border-radius:9px;border:1.5px solid var(--accent);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.92rem;outline:none;margin-bottom:0.5rem">'
    + '<div id="tender-picker-results" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem"></div>'
    + '<button onclick="document.getElementById(\'tender-picker-modal\').remove()" style="margin-top:0.85rem;width:100%;padding:0.55rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
    + '</div>';
  document.body.appendChild(overlay);
  var inp = document.getElementById('tender-picker-input');
  var res = document.getElementById('tender-picker-results');
  function _renderResults(q) {
    var known = getMatchingTenders((wizard.data.itemNum||'').trim());
    var all = state.masterData
      .filter(function(m) { return isTender(m.itemNum); })
      .reduce(function(acc, m) {
        if (!acc.find(function(x){ return x.itemNum === m.itemNum; })) acc.push(m);
        return acc;
      }, []);
    var filtered = all.filter(function(m) {
      if (!q) return known.includes(m.itemNum);
      return m.itemNum.toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q);
    }).slice(0, 8);
    res.innerHTML = filtered.map(function(m) {
      var isKnown = known.includes(m.itemNum);
      return '<button onclick="_selectTender(\'' + m.itemNum + '\')" style="width:100%;text-align:left;padding:0.55rem 0.75rem;border-radius:8px;border:1px solid ' + (isKnown ? 'rgba(139,92,246,0.35)' : 'var(--border)') + ';background:' + (isKnown ? 'rgba(139,92,246,0.08)' : 'var(--surface2)') + ';cursor:pointer;font-family:var(--font-body)">'
        + '<span style="font-family:var(--font-mono);font-weight:700;color:' + (isKnown ? '#8b5cf6' : 'var(--accent2)') + ';font-size:0.88rem">' + m.itemNum + '</span>'
        + (isKnown ? '<span style="margin-left:0.4rem;font-size:0.65rem;color:#8b5cf6;font-family:var(--font-head);letter-spacing:0.06em;text-transform:uppercase">known match</span>' : '')
        + (m.description ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.1rem">' + m.description + '</div>' : '')
        + '</button>';
    }).join('');
    if (!filtered.length) res.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">No tenders found</div>';
  }
  inp.addEventListener('input', function() { _renderResults(this.value.trim().toLowerCase()); });
  _renderResults('');
  setTimeout(function(){ inp.focus(); }, 80);
};
window._selectTender = function(tNum) {
  var known = getMatchingTenders((wizard.data.itemNum||'').trim());
  wizard.data.tenderMatch = tNum;
  wizard.data.tenderIsNonOriginal = !known.includes(tNum);
  wizard.data._qeMultiResolved = false;
  // Session 159: if invoked from Step 3 (no qe1 label), confirm + re-render
  var _step3Active = wizard.steps && wizard.steps[wizard.step] &&
                     wizard.steps[wizard.step].type === 'conditionDetails';
  if (_step3Active) wizard.data._tenderConfirmed = true;
  var modal = document.getElementById('tender-picker-modal');
  if (modal) modal.remove();
  // Update tender label in DOM without full re-render
  var lbl = document.getElementById('qe1-tender-label');
  if (lbl) {
    var nonOrig = wizard.data.tenderIsNonOriginal;
    lbl.innerHTML = 'TENDER <span style="font-family:var(--font-mono);font-weight:700;color:' + (nonOrig ? '#f39c12' : '#8b5cf6') + '">' + tNum + (nonOrig ? ' &#x26A0;' : '') + '</span>'
      + '<button type="button" onclick="_showTenderPicker()" style="margin-left:0.4rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.65rem;font-family:var(--font-body);cursor:pointer;white-space:nowrap">Not yours?</button>';
  } else if (_step3Active) {
    // Session 159: re-render Step 3 to reflect the new tender choice
    renderWizardStep();
  }
};

function renderWizardStep() {
  // v0.9.1033: the step is about to be re-rendered, so hand back any field the
  // full-screen focus panel borrowed before its old home is thrown away.
  try { if (typeof _wizFieldFocusClose === 'function') _wizFieldFocusClose(); } catch (eF) {}
  // Always restore Next button (entryMode step hides it)
  const _nb = document.getElementById('wizard-next-btn');
  if (_nb) _nb.style.display = '';

  const steps = wizard.tab ? getSteps(wizard.tab) : getSteps(null);
  wizard.steps = steps;
  // Guided walkthrough: when the coach is on screen, let it explain this step.
  if (typeof document !== 'undefined' && document.getElementById('wiz-coach') && typeof _coachOnRender === 'function') setTimeout(_coachOnRender, 60);

  // Skip steps based on skipIf — and also auto-skip any drivePhotos step
  // when the user has pressed "Skip All Photos" (sets wizard.data._skipAllPhotos)
  let step = wizard.step;
  while (step < steps.length - 1 && (
    (steps[step].skipIf && steps[step].skipIf(wizard.data)) ||
    (wizard.data._skipAllPhotos && steps[step].type === 'drivePhotos')
  )) {
    step++;
    wizard.step = step;
  }

  const s = steps[step];
  // v0.9.993 (Brad): keep the ITEM TYPE selector in sync on every render.
  try { _syncWizKindBar(s); } catch (eKind) {}
  try { _wizSyncIdPhotoBtn(s); } catch (eIdp) {}   // v0.9.1038
  // Count only visible steps — skip both skipIf and set-mode fast-forwarded steps
  const _setSkipIds = wizard.data._setMode ? new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode']) : null;
  const _isVisible = (st) => {
    if (st.skipIf && st.skipIf(wizard.data)) return false;
    if (_setSkipIds && _setSkipIds.has(st.id)) return false;
    return true;
  };
  const total = steps.filter(_isVisible).length;
  const current = steps.slice(0, step).filter(_isVisible).length + 1;
  const pct = Math.round((current / total) * 100);

  // Declare nextBtn first — used in theme block below
  const nextBtn = document.getElementById('wizard-next-btn');

  // Apply color theme based on tab
  const wizModal = document.querySelector('#wizard-modal .modal');
  if (wizModal) {
    wizModal.classList.remove('wiz-collection','wiz-want','wiz-sold');
    if (wizard.tab === 'collection') wizModal.classList.add('wiz-collection');
    else if (wizard.tab === 'want')   wizModal.classList.add('wiz-want');
    else if (wizard.tab === 'forsale') wizModal.classList.add('wiz-forsale');
    else if (wizard.tab === 'sold')   wizModal.classList.add('wiz-sold');

    // Dynamic width: widen for multi-column conditionDetails, reset otherwise
    const _grp = wizard.data._itemGrouping || '';
    const _isMultiCol = s.type === 'conditionDetails' && ['engine_tender','aa','ab','aba'].includes(_grp);
    if (_isMultiCol) {
      const _numCols = _grp === 'aba' ? 3 : 2;
      const _wideW = Math.min(window.innerWidth - 32, 280 * _numCols + 40);
      wizModal.style.maxWidth = _wideW + 'px';
      wizModal.style.height = _wizBoxHeight() + 'px';
    } else if ((s.type === 'conditionDetails' || s.type === 'variation') && _wizWide()) {
      // v0.9.1232 (Brad): a SINGLE item got the 520px box while an engine and
      // tender got a wide one — the widening was written for multi-unit adds
      // and single items were never given it. They have the longest stack of
      // fields of anything in the wizard, so they needed it most.
      wizModal.style.maxWidth = Math.min(window.innerWidth - 32, WIZ_WIDE_AT) + 'px';
      wizModal.style.height = _wizBoxHeight() + 'px';
    } else {
      wizModal.style.maxWidth = '520px';
      wizModal.style.height = _wizBoxHeight() + 'px';
    }
  }
  const progBar = document.getElementById('wizard-progress');
  if (progBar) {
    const _ephColors = {catalogs:'#e67e22',paper:'#3498db',mockups:'#9b59b6',other:'#2ecc71'};
    if (wizard.tab === 'collection') progBar.style.background = 'var(--accent)';
    else if (wizard.tab === 'want')  progBar.style.background = '#2980b9';
    else if (wizard.tab === 'forsale') progBar.style.background = '#e67e22';
    else if (wizard.tab === 'sold')  progBar.style.background = '#2ecc71';
    else if (_ephColors[wizard.tab]) progBar.style.background = _ephColors[wizard.tab];
    else                             progBar.style.background = 'var(--accent)';
  }
  if (nextBtn) {
    if (wizard.tab === 'want')       { nextBtn.style.background='#2980b9'; nextBtn.style.borderColor='#2980b9'; nextBtn.style.color='#fff'; }
    else if (wizard.tab === 'forsale') { nextBtn.style.background='#e67e22'; nextBtn.style.borderColor='#e67e22'; nextBtn.style.color='#fff'; }
    else if (wizard.tab === 'sold')  { nextBtn.style.background='#2ecc71'; nextBtn.style.borderColor='#2ecc71'; nextBtn.style.color='#081a0e'; }
    else                             { nextBtn.style.background=''; nextBtn.style.borderColor=''; nextBtn.style.color=''; }
  }

  // v0.9.1143 (Brad): "the top line should remind the user what they are
  // doing. So we need a title." The big title says WHERE you are (Item
  // Number, Condition…); this top line now says WHAT you're doing, in his
  // words — and unlike the step name it stays put through all six steps.
  document.getElementById('wizard-step-label').textContent =
    _wizFlowTitle() + ' · Step ' + current + ' of ' + total;
  _renderAddingBanner();
  const _titleText = typeof s.title === 'function' ? s.title(wizard.data) : s.title;
  const _titleEl = document.getElementById('wizard-title');
  if (wizard.data._setMode && wizard.data._setFinalItems) {
    const _idx   = wizard.data._setItemIndex || 0;
    const _total = wizard.data._setFinalItems.length;
    const _cur   = wizard.data.itemNum || wizard.data._setFinalItems[_idx] || '';
    const _master = findMaster(_cur);
    const _type  = _typeLabel(_master);
    _titleEl.innerHTML =
      `<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:0.5rem 0.75rem;margin-bottom:0.35rem">` +
        `<span style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#e67e22;white-space:nowrap">🎁 Set — Item ${_idx + 1} of ${_total}</span>` +
        `<span style="font-size:0.95rem;font-weight:800;color:var(--text);font-family:var(--font-mono)">${_cur}</span>` +
        (_type ? `<span style="font-size:0.72rem;font-weight:600;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.06em">${_type}</span>` : '') +
        `<span style="font-size:0.88rem;color:var(--text-mid)">— ${_titleText}</span>` +
      `</div>`;
  } else {
    _titleEl.textContent = _titleText;
  }
  document.getElementById('wizard-progress').style.width = pct + '%';
  document.getElementById('wizard-back-btn').style.display = current > 1 ? 'inline-flex' : 'none';
  // Phase 1 streamline: Skip-All-Photos button visible only on drivePhotos steps
  const _skipPhotosBtn = document.getElementById('wizard-skip-photos-btn');
  if (_skipPhotosBtn) _skipPhotosBtn.style.display = (s.type === 'drivePhotos') ? 'inline-flex' : 'none';
  const autoAdvanceTypes = new Set(['choice','choice2','choice3','choiceSearch','pickRow','pickSoldItem','pickForSaleItem']); // 'variation' removed — Next needed when item has no variations
  // New consolidated types always use Next button
  // setMatch and setUnit2Num need Next button (user may interact multiple times)
  if (s.type === 'confirm') {
    nextBtn.textContent = '✓ Save';
    nextBtn.style.display = 'inline-flex';
  } else if (autoAdvanceTypes.has(s.type)) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.style.display = 'inline-flex';
  }

  const body = document.getElementById('wizard-body');

  if (s.type === 'manualManufacturer') {
    const _cfg = window.MANUAL_MANUFACTURERS || { common: ['Lionel'], all: ['Lionel'] };
    const _common = _cfg.common || [];
    const _all = _cfg.all || [];
    const cur = wizard.data.manualManufacturer || '';
    const _esc = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    body.innerHTML =
      '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.45rem">Tap a common maker, or search/type any other below.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">' +
        _common.map(function(m){
          var sel = (cur === m);
          return '<button onclick="wizard.data.manualManufacturer=' + JSON.stringify(m).replace(/"/g,'&quot;') + ';renderWizardStep()" style="' +
            'padding:0.6rem 0.8rem;border-radius:9px;border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';' +
            'background:' + (sel ? 'var(--accent)22' : 'var(--surface2)') + ';color:var(--text);cursor:pointer;' +
            'font-family:var(--font-body);font-size:0.9rem;font-weight:600;text-align:left">' + _esc(m) + '</button>';
        }).join('') +
      '</div>' +
      '<div style="margin-top:0.7rem">' +
        '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">Search all makers or type your own</label>' +
        '<input type="text" id="manual-mfr-input" list="manual-mfr-list" autocomplete="off" value="' + _esc(cur) + '" placeholder="Start typing — e.g. Dorfan, Sunset, Menards" oninput="wizard.data.manualManufacturer=this.value.trim()" style="width:100%;padding:0.6rem 0.75rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">' +
        '<datalist id="manual-mfr-list">' + _all.map(function(m){ return '<option value="' + _esc(m) + '">'; }).join('') + '</datalist>' +
      '</div>';

  } else if (s.type === 'manualItemType') {
    const _cfg = window.MANUAL_ITEM_TYPES || { common: ['Steam Engine'], all: ['Steam Engine'] };
    const _common = _cfg.common || [];
    const _all = _cfg.all || [];
    const cur = wizard.data.manualItemType || '';
    const _emoji = {'Steam Engine':'🚂','Diesel Engine':'🚄','Electric Engine':'⚡','Freight Car':'🚃','Passenger Car':'🚋','Caboose':'🔴','Accessory':'🏗️','Track':'🛤️','Transformer':'🔌','Rolling Stock':'📦','Paper':'📄','Other':'❓'};
    const _esc = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    body.innerHTML =
      '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.45rem">Tap a common type, or search/type any other below.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">' +
        _common.map(function(t){
          var sel = (cur === t);
          return '<button onclick="wizard.data.manualItemType=' + JSON.stringify(t).replace(/"/g,'&quot;') + ';renderWizardStep()" style="' +
            'display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.7rem;border-radius:8px;border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';' +
            'background:' + (sel ? 'var(--accent)22' : 'var(--surface2)') + ';color:var(--text);cursor:pointer;' +
            'font-family:var(--font-body);font-size:0.84rem;font-weight:600;text-align:left">' +
            (_emoji[t] ? '<span style="font-size:1.05rem">' + _emoji[t] + '</span>' : '') + _esc(t) + '</button>';
        }).join('') +
      '</div>' +
      '<div style="margin-top:0.7rem">' +
        '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">Search all types or type your own</label>' +
        '<input type="text" id="manual-type-input" list="manual-type-list" autocomplete="off" value="' + _esc(cur) + '" placeholder="Start typing — e.g. Hopper, Crane, Stock Car" oninput="wizard.data.manualItemType=this.value.trim()" style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box">' +
        '<datalist id="manual-type-list">' + _all.map(function(t){ return '<option value="' + _esc(t) + '">'; }).join('') + '</datalist>' +
      '</div>';

  } else if (s.type === 'manualDescribe') {
    const d = wizard.data;
    const _esc = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    const _inStyle = 'width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.9rem;box-sizing:border-box;outline:none';
    const _lblStyle = 'font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem';
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:0.7rem;padding-top:0.25rem">' +
        '<div><label style="' + _lblStyle + '">Road name (optional)</label>' +
          '<input type="text" id="manual-roadname" value="' + _esc(d.manualRoadName) + '" placeholder="e.g. B&amp;O / Baltimore and Ohio" oninput="wizard.data.manualRoadName=this.value" style="' + _inStyle + '"></div>' +
        '<div><label style="' + _lblStyle + '">Road number / cab # (optional)</label>' +
          '<input type="text" id="manual-roadnum" value="' + _esc(d.manualRoadNumber) + '" placeholder="e.g. 606" oninput="wizard.data.manualRoadNumber=this.value" style="' + _inStyle + '"></div>' +
          '<div><label style="font-size:0.82rem;color:var(--text-mid);display:block;margin:0.55rem 0 0.25rem">Scale / Gauge</label>' +
          '<select id="manual-gauge" onchange="wizard.data.manualGauge=this.value" style="' + _inStyle + '">' +
            ['','O','O-27','Standard','S','HO','G','No. 1'].map(function(g){ return '<option value="' + g + '"' + ((d.manualGauge||'') === g ? ' selected' : '') + '>' + (g || '— not sure —') + '</option>'; }).join('') +
          '</select></div>' +
        '<div><label style="' + _lblStyle + '">Description (optional)</label>' +
          '<textarea id="manual-desc" rows="2" placeholder="e.g. black USRA switcher, illuminated cab" oninput="wizard.data.manualDesc=this.value" style="' + _inStyle + ';resize:vertical">' + rrEsc(d.manualDesc) + '</textarea></div>' +
        '<div><label style="' + _lblStyle + '">Give it your own name (optional)</label>' +
          '<input type="text" id="manual-customname" value="' + _esc(d.manualCustomName) + '" placeholder="Leave blank to auto-name it" oninput="wizard.data.manualCustomName=this.value" style="' + _inStyle + '"></div>' +
        '<div style="font-size:0.72rem;color:var(--text-dim);font-style:italic">Leave the name blank and we will build one from the maker, road, type and number.</div>' +
      '</div>';

  } else if (s.type === 'manualPurchaseValue') {
    const d = wizard.data;
    body.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:0.75rem;padding-top:0.25rem">' +
        // v0.9.968 (Brad): Est. Worth is the first/top question, matching the
        // other Add steps, then Date Purchased and Price Paid below it.
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Est. Worth <a href="javascript:_wizResearchPrice()" style="float:right;color:#2ecc71;font-weight:700;text-decoration:none;font-size:0.78rem">\uD83D\uDD0D Research</a></label>' +
          '<input type="number" step="0.01" value="' + (d.userEstWorth || '') + '"' +
            ' oninput="wizard.data.userEstWorth=this.value" placeholder="$0.00"' +
            ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.88rem;box-sizing:border-box">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Date Purchased</label>' +
          '<div style="position:relative;display:flex;align-items:center">' +
          '<input type="date" id="manual-date" value="' + (d.datePurchased || '') + '"' +
            ' onchange="wizard.data.datePurchased=this.value"' +
            ' style="width:100%;padding:0.55rem 2.5rem 0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.88rem;box-sizing:border-box;color-scheme:dark">' +
          '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;manual-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Price Paid</label>' +
          '<input type="number" step="0.01" value="' + (d.priceItem || '') + '"' +
            ' oninput="wizard.data.priceItem=this.value" placeholder="$0.00"' +
            ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-mono);font-size:0.88rem;box-sizing:border-box">' +
        '</div>' +
        ((typeof _prefLocEnabled !== 'undefined' && _prefLocEnabled) ?
        '<div>' +
          '<label style="font-size:0.82rem;color:var(--text-mid);display:block;margin-bottom:0.25rem">Storage Location</label>' +
          '<input type="text" value="' + (d.location || '').replace(/"/g, '&quot;') + '"' +
            ' oninput="wizard.data.location=this.value" placeholder="e.g. Shelf 3, Tote 12"' +
            ' style="width:100%;padding:0.55rem 0.7rem;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.88rem;box-sizing:border-box">' +
        '</div>' : '') +
      '</div>';

  } else if (s.type === 'choice') {
    // First step - choose tab
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.75rem;padding-top:0.5rem">
        ${[['collection','✓ My Collection','Add a train you own','var(--green)'],
           ['sold','$ Sold','Record a sold item','#9b59b6'],
           ['want','★ Want List','Add to your wish list','var(--accent2)'],
           ['catalogs','📒 Catalogs','Catalogs & publications','#e67e22'],
           ['paper','📄 Paper Items','Ads, flyers, box inserts, articles','#3498db'],
           ['mockups','🔩 Mock-Ups','Pre-production prototypes','#9b59b6'],
           ['other','📦 Other Items','Accessories, displays & more','#2ecc71'],
          ].map(([val,label,desc,color]) => `
          <button onclick="wizardChooseTab('${val}')" style="
            display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
            border-radius:10px;border:2px solid ${wizard.tab===val ? color : 'var(--border)'};
            background:${wizard.tab===val ? color+'22' : 'var(--surface2)'};
            color:var(--text);cursor:pointer;text-align:left;font-family:var(--font-body);
            transition:all 0.15s;width:100%
          ">
            <div style="font-size:1.5rem;width:36px;text-align:center">${label.split(' ')[0]}</div>
            <div>
              <div style="font-weight:600;font-size:0.95rem">${label.split(' ').slice(1).join(' ')}</div>
              <div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.15rem">${desc}</div>
            </div>
          </button>`).join('')}

      </div>`;

  } else if (s.type === 'variation') {
    // Look up all variations for the entered item number, SCOPED to the
    // itemType (and roadName) the user picked on the search step.
    // Without this scope, item 773 mixes Accessory's fish-plate-set
    // variations into a list meant to show Steam Engine tender pairings.
    const itemNum = wizard.data.itemNum || '';
    const _varType = (wizard.matchedItem && wizard.matchedItem.itemType)
      || wizard.data._suggestedItemType
      || '';
    const _varRoad = (wizard.matchedItem && wizard.matchedItem.roadName)
      || wizard.data._suggestedRoadName
      || '';
    const _allVars = state.masterData.filter(i => {
      if (i.itemNum !== itemNum) return false;
      if (!i.variation) return false;
      if (_varType && String(i.itemType || '').trim() !== String(_varType).trim()) return false;
      if (_varRoad && String(i.roadName || '').trim() !== String(_varRoad).trim()) return false;
      return true;
    });
    // Deduplicate by variation number (safety net against doubled data)
    const _seenVars = new Set();
    const variations = _allVars.filter(v => {
      if (_seenVars.has(v.variation)) return false;
      _seenVars.add(v.variation);
      return true;
    });
    const val = wizard.data.variation || '';
    if (variations.length === 0) {
      // No variations in master - fall back to text input
      body.innerHTML = `
        <div style="padding-top:0.75rem">
          <input type="text" id="wiz-input" value="${val}" placeholder="Leave blank if no variation"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none"
            oninput="wizard.data.variation=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
          ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
        ${(() => {
          const singleItem = findMaster(itemNum);
          if (!singleItem || !singleItem.refLink) return '';
          // Verbose label (e.g. "View on Atlas ↗") resolves per URL from
          // item-search-filters-config.js — previously hardcoded to COTT.
          const _label = (typeof window.resolveRefLabel === 'function')
            ? window.resolveRefLabel(singleItem.refLink, { verbose: true })
            : 'View reference \u2197';
          return '<a href="' + ((typeof window.cottAnchorUrl==='function') ? window.cottAnchorUrl(singleItem.refLink, itemNum) : singleItem.refLink) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.75rem;font-size:0.82rem;color:var(--accent2);text-decoration:none;padding:0.4rem 0.75rem;border:1px solid rgba(201,146,42,0.3);border-radius:6px;background:rgba(201,146,42,0.08);min-height:34px;box-sizing:border-box">' + _label + '</a>';
        })()}

        </div>`;
      if (!window.IS_MOBILE_UA) setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);
    } else {
      // Show variation cards with COTT link per variation.
      // #1: highlight how each variation differs from the first one.
      const _vEsc = (x) => String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const _vBaseNum = variations.length ? variations[0].variation : null;
      const _vBaseSet = new Set();
      if (variations.length) { String(variations[0].varDesc || variations[0].description || '').toLowerCase().split(/\s+/).forEach((w) => { const c = w.replace(/[^a-z0-9]/g,''); if (c) _vBaseSet.add(c); }); }
      const _vHl = (desc) => String(desc || '').split(/(\s+)/).map((tok) => { if (/^\s+$/.test(tok)) return tok; const c = tok.toLowerCase().replace(/[^a-z0-9]/g,''); const e = _vEsc(tok); return (c && !_vBaseSet.has(c)) ? '<span style="color:var(--accent);font-weight:700;background:rgba(232,64,28,0.14);border-radius:3px;padding:0 2px">' + e + '</span>' : e; }).join('');
      // v0.9.1233 (Brad): the description, laid out in the sections the
      // reference book wrote it in. One column as before on a narrow screen;
      // side by side when the modal has the room. The preamble (the lines
      // before the first heading) always spans the full width — it is what
      // identifies the variation, not part of either list.
      const _vSecHtml = (sc, hl) => {
        const txt = sc.lines.join('\n').replace(/^\n+|\n+$/g, '');
        return '<div class="var-sec' + (sc.head ? '' : ' var-lead') + '">'
          + (sc.head ? '<div class="var-sec-h">' + _vEsc(sc.head) + '</div>' : '')
          + '<div class="var-sec-b">' + (hl ? _vHl(txt) : _vEsc(txt)) + '</div>'
          + '</div>';
      };
      const _v2up = _wizWide();
      const _vDescHtml = (v) => {
        const raw = v.varDesc || v.description || 'No description available';
        const hl = !!(v.variation && v.variation !== _vBaseNum);
        const secs = (typeof _wizVarSections === 'function') ? _wizVarSections(raw) : [];
        // Only worth splitting when the book actually gave it headings.
        const headed = secs.filter(sc => sc.head).length;
        if (!_v2up || headed < 2) {
          return '<span class="var-desc-plain">' + (hl ? _vHl(raw) : _vEsc(raw)) + '</span>';
        }
        return '<div class="var-desc">' + secs.map(sc => _vSecHtml(sc, hl)).join('') + '</div>';
      };

      let _vpCanHelp=false;
      try { window._vpRows = variations; window._vpItemNum = itemNum; window._vpItemType = _varType || (variations[0]&&variations[0].itemType) || ''; _vpCanHelp = (typeof _vpGenerate==='function') && _vpGenerate(variations).length>0; } catch(e){}
      body.innerHTML = `
        <div style="padding-top:0.5rem">
          ${variations.length > 1 ? '<div style="font-size:0.74rem;color:var(--text-dim);margin-bottom:0.5rem;padding:0 0.1rem">Highlighted words show how each variation differs from the <strong>first</strong> one.</div>' : ''}
          <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
            ${_vpCanHelp ? `<button type="button" onclick="openVariationPicker()" style="flex:1;min-width:0;padding:0.45rem 0.6rem;border-radius:9px;border:2px solid var(--accent);background:rgba(232,64,28,0.10);color:var(--text);font-family:var(--font-body);font-size:0.8rem;font-weight:600;line-height:1.15;cursor:pointer">Help me pick my variation</button>` : ''}
            <button type="button" onclick="wizardChooseVariation('')" style="flex:1;min-width:0;padding:0.45rem 0.6rem;border-radius:9px;border:2px solid ${val==='' ? 'var(--accent)' : 'var(--border)'};background:${val==='' ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};color:var(--text);font-family:var(--font-body);font-size:0.8rem;line-height:1.15;cursor:pointer">No specific variation / not sure</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.5rem" id="var-cards">
            ${variations.map(v => {
              const isSelected = val===v.variation;
              // Short label resolves per URL (Atlas ↗ / COTT ↗ / View ↗) —
              // previously hardcoded to "COTT ↗" for every row including
              // Atlas items. See item-search-filters-config.js.
              const _refShort = v.refLink
                ? ((typeof window.resolveRefLabel === 'function')
                    ? window.resolveRefLabel(v.refLink)
                    : 'View \u2197')
                : '';
              // v0.9.1189 (Brad: "the view button doesn't work here, it
              // advances to the next page"). This link used to live INSIDE the
              // card's <button> — interactive content nested in interactive
              // content, which the HTML spec disallows and every engine
              // resolves its own way. On Brad's Chrome the button claimed the
              // whole card's hit area, so a click on View never reached the
              // anchor: the stopPropagation guard never ran, nothing opened,
              // and the card did what a card does — picked the variation and
              // auto-advanced. Both halves of his report, one cause.
              //
              // Diagnosis note for whoever is here next: a PROGRAMMATIC
              // a.click() cannot see this bug. It dispatches straight at the
              // anchor and skips hit-testing — the very step that was failing.
              // It "passed" in two browsers while the real thing was broken.
              // Test this by COORDINATE (see §157).
              //
              // The card is a <div role="button"> now, so the anchor is a
              // normal, hit-testable link. Keyboard parity is explicit:
              // tabindex + Enter/Space, which <button> gave for free.
              const cottLink = v.refLink ? `<a href="${(typeof window.cottAnchorUrl==='function') ? window.cottAnchorUrl(v.refLink, itemNum) : v.refLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--accent2);text-decoration:none;padding:0.42rem 0.7rem;border:1px solid rgba(201,146,42,0.45);border-radius:6px;background:rgba(201,146,42,0.12);flex-shrink:0;white-space:nowrap;font-weight:600;position:relative;z-index:1;min-height:34px;box-sizing:border-box">${_refShort}</a>` : '';
              return `
              <div role="button" tabindex="0" onclick="wizardChooseVariation('${v.variation}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();wizardChooseVariation('${v.variation}')}" style="
                display:flex;flex-direction:column;gap:0.4rem;padding:0.85rem 1rem;
                border-radius:10px;text-align:left;width:100%;cursor:pointer;
                font-family:var(--font-body);transition:all 0.15s;box-sizing:border-box;
                border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
                background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
                color:var(--text);
              ">
                <div style="display:flex;align-items:center;gap:0.6rem;width:100%">
                  <span style="
                    font-family:var(--font-mono);font-size:1rem;font-weight:600;
                    color:${isSelected ? 'var(--accent)' : 'var(--accent2)'};
                    min-width:2rem;
                  ">${v.variation || '—'}</span>
                  ${v.cottCode ? '<span title="COTT photo code" style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.35rem;flex-shrink:0">' + _vEsc(v.cottCode) + '</span>' : ''}
                  <span style="flex:1;min-width:0"></span>
                  ${cottLink}
                </div>
                ${_vDescHtml(v)}
              </div>`;
            }).join('')}
          </div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Selecting a variation will auto-advance</div>
        </div>`;
    }

    // v0.9.907 (Brad, item [1a]): preview the photo you're adding at the top
    // (right side on a wide desktop), tap to zoom.
    try { if (window._wizVarInsertPhoto) window._wizVarInsertPhoto(body); } catch (e) { console.warn('[variation photo]', e); }

  } else if (s.type === 'text') {
    let val = wizard.data[s.id] || '';
    // Bug 3 (Session 154): when Identify-by-Photo routed user to Manual Entry
    // and hedged the SKU (or the user picked Manual after extract), pre-fill
    // manualItemNum from the extracted SKU on the meta blob — user
    // shouldn't have to retype what we already parsed.
    if (s.id === 'manualItemNum' && !val && wizard.data._identifyMeta && wizard.data._identifyMeta.itemNum) {
      val = String(wizard.data._identifyMeta.itemNum);
      wizard.data.manualItemNum = val;
    }
    const showBoxOnly = s.id === 'itemNum' && wizard.tab === 'collection';
    const boxOnlyChecked = wizard.data.boxOnly || false;
    const _showCollPicker = s.id === 'itemNum' && (wizard.tab === 'forsale' || wizard.tab === 'sold');
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <input type="text" id="wiz-input" value="${val}" placeholder="${_wizPlaceholder(s)}"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
          padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none"
          autocomplete="off"
          oninput="wizard.data['${s.id}']=this.value; if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='itemNum') debouncedItemSuggestions(this.value); if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='set_num') updateSetSuggestions(this.value); if(this.id==='wiz-input' && wizard.steps[wizard.step].id==='eph_itemNumRef') updateMockupRefSuggestions(this.value); ${_showCollPicker ? '_filterCollPicker(this.value)' : ''}"
          onkeydown="handleSuggestionKey(event)">
        <div id="wiz-suggestions" style="display:none;flex-direction:column;gap:1px;margin-top:4px;max-height:340px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:4px;-webkit-overflow-scrolling:touch"></div>
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
        <div id="wiz-match" style="margin-top:0.75rem"></div>
        ${s.id === 'itemNum' && wizard.tab !== 'sold' ? `
        <button onclick="_wizScanBarcode()" style="
          width:100%;margin-top:0.6rem;padding:0.65rem 1rem;
          border-radius:8px;border:1.5px dashed #2980b9;
          background:rgba(41,128,185,0.08);color:#2980b9;
          font-family:var(--font-head);font-size:0.78rem;font-weight:600;
          letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:0.5rem;
          transition:all 0.15s
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Don't know the number? Identify by photo
        </button>` : ''}
        ${showBoxOnly ? `
        <label onclick="toggleBoxOnly()" style="
          display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;margin-top:0.75rem;
          border-radius:10px;border:2px solid ${boxOnlyChecked ? 'var(--accent2)' : 'var(--border)'};
          background:${boxOnlyChecked ? 'rgba(201,146,42,0.1)' : 'var(--surface2)'};
          cursor:pointer;transition:all 0.15s;
        ">
          <div style="
            width:20px;height:20px;border-radius:5px;flex-shrink:0;
            border:2px solid ${boxOnlyChecked ? 'var(--accent2)' : 'var(--border)'};
            background:${boxOnlyChecked ? 'var(--accent2)' : 'transparent'};
            display:flex;align-items:center;justify-content:center;
            font-size:0.75rem;color:white;font-weight:700;transition:all 0.15s;
          ">${boxOnlyChecked ? '✓' : ''}</div>
          <div>
            <div style="font-weight:600;font-size:0.9rem;color:var(--text)">Adding box info only</div>
            <div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">I bought a separate box for this item</div>
          </div>
        </label>` : ''}
        ${_showCollPicker ? `
        <div style="margin-top:0.85rem">
          <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);font-weight:600;margin-bottom:0.4rem">${wizard.tab === 'sold' ? 'What did you sell?' : 'Or pick from your collection'}</div>
          ${wizard.tab === 'sold' ? (function () {
            const _src = wizard.data._soldPickSrc || (Object.keys(state.forSaleData || {}).length ? 'fs' : 'coll');
            const _chip = (id, lbl, on) => '<button type="button" onclick="_soldPickSrcSet(\'' + id + '\')" style="flex:1;padding:0.5rem;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:var(--font-body);border:1.5px solid ' + (on ? '#2ecc71;background:rgba(46,204,113,0.15);color:#2ecc71' : 'var(--border);background:var(--surface2);color:var(--text-mid)') + '">' + lbl + '</button>';
            return '<div style="display:flex;gap:0.4rem;margin-bottom:0.45rem">' + _chip('fs', '\uD83C\uDFF7 From For Sale List', _src === 'fs') + _chip('coll', '\uD83D\uDCE6 From My Collection', _src === 'coll') + '</div>';
          })() : ''}
          ${typeof _wpSellFilterRow === 'function' ? _wpSellFilterRow() : ''}
          <div id="wiz-coll-picker" style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);-webkit-overflow-scrolling:touch"></div>
        </div>` : ''}
      </div>`;
    setTimeout(() => {
      const inp = document.getElementById('wiz-input');
      // Session 115: on the want-tab itemNum step, insert the Type +
      // Road filter bar above the input so users can narrow the
      // suggestion list the same way the collection tab already does.
      // Safe no-op on other tabs (helper returns null).
      if (s.id === 'itemNum' && (wizard.tab === 'want' || wizard.tab === 'collection') && inp && inp.parentElement) {
        try {
          var _filters = _buildItemSearchFiltersDOM();
          if (_filters) {
            // Parent is the <div style="flex:1">; insert filter bar
            // above the input so it reads top-to-bottom naturally.
            inp.parentElement.insertBefore(_filters, inp);
            _wireItemSearchFilters();
          }
        } catch(e) { console.warn('[want filters]', e); }
      }
      if (inp) {
        // v0.9.667 (Brad): on phones the auto-focused keyboard buried the
        // "Identify by Photo" button — only auto-focus on non-touch devices.
        if (!window.IS_MOBILE_UA) inp.focus();
        if (s.id === 'itemNum') {
          inp.addEventListener('input', debounceItemLookup);
          if (inp.value) updateItemSuggestions(inp.value);
          // v0.9.1033 (Brad): on phones this field hands the whole screen over
          // while you type, so the keyboard can't bury it. Not on the For Sale
          // / Sold tabs — those steps show a collection picker below the field
          // that would be left behind.
          if (window.IS_MOBILE_UA && !_showCollPicker) {
            inp.addEventListener('focus', function () {
              if (_wizFocusBusy) return;
              _wizFieldFocusOpen(inp);
            });
          }
        }
      }
      if (_showCollPicker) _filterCollPicker('');
    }, 50);


  } else if (s.type === 'setEntryMode') {
    // ── SET ENTRY MODE — condition slider + est worth + set box + QE/Full buttons ──
    const _seD = wizard.data;
    const _seSet = _seD._resolvedSet;
    const _seItems = _seD._setFinalItems || (_seSet ? _seSet.items : []);
    const _seCondVal = _seD._setCondition || 7;

    body.innerHTML = '';
    const wrap = document.createElement('div');
    // Session 115: tighter gap (0.65rem -> 0.45rem) so the whole set-
    // entry-mode screen fits without scrolling on a 580px-tall modal.
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.45rem;padding-top:0.15rem';

    // ── Set info banner (tightened) ──
    const banner = document.createElement('div');
    banner.style.cssText = 'background:var(--surface2);border:1px solid var(--accent2);border-radius:8px;padding:0.4rem 0.75rem';
    const setLabel = _seSet ? _seSet.setNum + (_seSet.setName ? ' — ' + _seSet.setName : '') : 'Set';
    banner.innerHTML = '<div style="font-family:var(--font-mono);font-weight:700;color:var(--accent2);font-size:0.88rem;line-height:1.2">' + setLabel + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">' + _seItems.length + ' items · ' + (_seSet && _seSet.year ? _seSet.year : '') + ' · ' + (_seSet && _seSet.gauge ? _seSet.gauge : '') + '</div>';
    wrap.appendChild(banner);

    // ── Condition slider (tightened) ──
    const condWrap = document.createElement('div');
    condWrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">'
      + '<span style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Overall Condition</span>'
      + '<span id="se-cond-val" style="font-family:var(--font-mono);font-size:1.05rem;color:var(--accent);font-weight:700">' + _seCondVal + '</span></div>'
      + '<input type="range" id="se-cond-slider" min="1" max="10" value="' + _seCondVal + '" style="width:100%;accent-color:var(--accent);margin:0">'
      + '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim);margin-top:-2px"><span>Poor</span><span>Excellent</span></div>';
    wrap.appendChild(condWrap);

    // ── Three-column row: Est Worth | Set Box checkbox | QE Photo ──
    const threeRow = document.createElement('div');
    threeRow.style.cssText = 'display:flex;gap:0.4rem;align-items:stretch';
    // Est Worth
    const worthCol = document.createElement('div');
    worthCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px';
    worthCol.innerHTML = '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Est. Worth</div>'
      + '<div style="display:flex;align-items:center;gap:0.4rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;flex:1">'
      + '<span style="color:var(--text-dim);font-size:0.85rem">$</span>'
      + '<input type="number" id="se-worth" placeholder="0.00" min="0" step="0.01" value="' + (_seD._setWorth || '') + '"'
      + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.9rem;min-width:0">'
      + '</div>';
    // Set Box checkbox
    const boxCol = document.createElement('div');
    boxCol.style.cssText = 'flex:0.8;display:flex;flex-direction:column;gap:3px';
    const _seBoxChecked = _seD._setHasBoxChecked || false;
    boxCol.innerHTML = '<div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Set Box</div>'
      + '<label style="display:flex;align-items:center;justify-content:center;gap:0.4rem;background:var(--bg);border:1px solid ' + (_seBoxChecked ? 'var(--accent2)' : 'var(--border)') + ';border-radius:8px;padding:0.45rem 0.5rem;flex:1;cursor:pointer">'
      + '<input type="checkbox" id="se-setbox" ' + (_seBoxChecked ? 'checked' : '') + ' style="accent-color:var(--accent2);width:18px;height:18px;cursor:pointer">'
      + '<span style="font-size:0.82rem;color:' + (_seBoxChecked ? 'var(--accent2)' : 'var(--text-mid)') + '">📦</span></label>';
    threeRow.appendChild(worthCol);
    threeRow.appendChild(boxCol);
    // v0.9.1116 (Brad: "quick entry was deleted months ago. how is this
    // still a thing") — the QE Photo button left with the rest of Quick Entry.
    wrap.appendChild(threeRow);

    // Session 115: side-by-side [Full Entry] [Save Quick Entry] row —
    // replaces the vertically-stacked big-QE-button + divider + Full-
    // button layout that pushed Full Entry below the fold on most
    // screens. Now both options are visible without scrolling, and a
    // small helper line above the buttons tells the user what
    // Quick Entry does differently.
    // v0.9.1116: Quick Entry is gone from sets too — one path, walked
    // properly. The condition, worth and set-box above still prefill the walk.
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;align-items:stretch;margin-top:0.25rem';
    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.id = 'se-full-btn';
    fullBtn.style.cssText = 'flex:1;padding:0.75rem 0.5rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem';
    fullBtn.innerHTML = '\u{1F4CB} Add each item \u2192';
    btnRow.appendChild(fullBtn);
    wrap.appendChild(btnRow);

    body.appendChild(wrap);

    // Hide the wizard Next button — our buttons handle navigation
    if (nextBtn) nextBtn.style.display = 'none';

    // ── Wire up slider ──
    setTimeout(() => {
      const slider = document.getElementById('se-cond-slider');
      const valEl = document.getElementById('se-cond-val');
      if (slider) slider.oninput = () => { valEl.textContent = slider.value; wizard.data._setCondition = parseInt(slider.value); };

      const boxCB = document.getElementById('se-setbox');
      if (boxCB) boxCB.onchange = () => {
        wizard.data._setHasBoxChecked = boxCB.checked;
        wizard.data.set_hasBox = boxCB.checked ? 'Yes' : 'No';
        // Re-style the label
        const lbl = boxCB.closest('label');
        if (lbl) lbl.style.borderColor = boxCB.checked ? 'var(--accent2)' : 'var(--border)';
      };

      // (QE Photo and Quick Entry handlers removed in v0.9.1116 — the set
      // flow has one path now.)
      // Full Entry
      if (fullBtn) fullBtn.onclick = () => {
        const condSlider = document.getElementById('se-cond-slider');
        const worthInp = document.getElementById('se-worth');
        const worth = worthInp ? worthInp.value : '';

        // Require Est. Worth
        if (!worth || parseFloat(worth) <= 0) {
          if (worthInp) { worthInp.style.outline = '2px solid var(--accent)'; worthInp.focus(); }
          showToast('Please enter an Est. Worth before continuing', 3000);
          return;
        }
        if (worthInp) worthInp.style.outline = '';

        wizard.data._setCondition = condSlider ? parseInt(condSlider.value) : 7;
        wizard.data._setWorth = worth;
        wizard.data._setEntryMode = 'full';
        wizard.data.entryMode = 'full';

        // Lock in set box choice from checkbox
        const boxCB = document.getElementById('se-setbox');
        wizard.data._setHasBoxChecked = boxCB ? boxCB.checked : false;
        wizard.data.set_hasBox = (boxCB && boxCB.checked) ? 'Yes' : 'No';

        // Manually advance past this step
        wizard.step++;
        while (wizard.step < wizard.steps.length - 1 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
          wizard.step++;
        }
        renderWizardStep();
      };
    }, 50);

  } else if (s.type === 'setWalkItems') {
    // Immediately launch the per-item wizard — no separate UI for this step
    launchSetItemWizard();
    return;

    } else if (s.type === 'entryMode') {
    // Auto-select full entry (QE renderer needs rebuild — code was lost in a prior session)
    wizard.data.entryMode = 'full';
    wizard.step++;
    while (wizard.step < wizard.steps.length - 1 && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
      wizard.step++;
    }
    renderWizardStep();
    return;

    // ── QE Step 1 placeholder — full rebuild needed ──
    var _qe1D = wizard.data;
    var _qe1ItemNum = (_qe1D.itemNum || '').trim();
    var _qe1BoxOnly = _qe1D.boxOnly || false;
    var _qe1Icons = {
      engine:    './img/icon_engine.png',
      tender:    './img/icon_tender.png',
      a_powered: './img/icon_a_powered.jpg',
      a_dummy:   './img/icon_a_dummy.png',
      b_unit:    './img/icon_b_unit.png',
      freight:   './img/icon_freight.png',
    };
    body.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

    // ── Inner helpers (closures over _qe1Icons, wizard.data, etc.) ──

    // Find AA dummy + AB B-unit partners from role tags (+T/+C) and the companion
    // table (B Unit / A Dummy types). Single source of truth for diesel set grouping.
    // (_qe1Partners removed — dead after Decision Map #1/#2; use getBUnit / getADummyUnit)

    // Grouping data mutation without auto-advance
    function _selectGroupingData(gid) {
      wizard.data._itemGrouping = gid;
      var n = (wizard.data.itemNum || '').trim();
      // Grouping -> data fields — SINGLE SOURCE OF TRUTH (Decision Map #2, applyGrouping in app.js).
      if (typeof applyGrouping === 'function') applyGrouping(wizard.data, gid, n);
    }



    // Render grouping buttons (no auto-advance)
    function _qe1RenderGrouping() {
      var cont = document.getElementById('qe1-grouping');
      if (!cont) return;
      var num = (wizard.data.itemNum || '').trim();
      if (!num) { cont.style.display = 'none'; return; }
      // Grouping options — SINGLE SOURCE OF TRUTH (Decision Map #1, getGroupingOptions in app.js).
      var btns = (typeof getGroupingOptions === 'function') ? getGroupingOptions(num, (wizard.matchedItem && wizard.matchedItem.itemType) || wizard.data._suggestedItemType || undefined) : [];
      if (!btns.length) { cont.style.display = 'none'; return; }
      cont.style.display = 'block';
      var cur = wizard.data._itemGrouping || '';
      var _hasSteamBtn = btns.some(function(b){ return b.id === 'engine'; });
      var _hasDieselBtn = btns.some(function(b){ return b.id === 'a_powered' || b.id === 'aa' || b.id === 'ab' || b.id === 'aba'; });
      var html = (_hasSteamBtn && _hasDieselBtn)
        ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.4rem;line-height:1.4">This number belongs to both a <strong>steam locomotive</strong> and an <strong>Alco diesel</strong> — pick what you have.</div>'
        : '';
      html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem">';
      btns.forEach(function(b) {
        var sel = cur === b.id;
        html += '<button type="button" onclick="_qe1SelectGrouping(\'' + b.id + '\')" style="padding:0.38rem 0.7rem;border-radius:8px;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:var(--font-body);'
          + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
          + 'color:' + (sel ? 'var(--accent)' : 'var(--text-mid)') + '">' + b.label + '</button>';
      });
      html += '</div>';
      cont.innerHTML = html;
    }

    // Render condition sliders
    function _qe1RenderSliders() {
      var cont = document.getElementById('qe1-sliders');
      if (!cont) return;
      var grp = wizard.data._itemGrouping || 'single';
      var defCond = parseInt(localStorage.getItem('lv_default_cond') || '7');

      // _slHtml: same as _sl but label is raw HTML (not escaped)
      function _slHtml(slId, iconKey, labelHtml, accent, imgStyle) {
        var cur = wizard.data[slId] || defCond;
        var imgExtra = imgStyle ? ';' + imgStyle : '';
        return '<div style="margin-bottom:0.4rem">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
          + '<div style="display:flex;align-items:center;gap:5px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">'
          + '<img src="' + _qe1Icons[iconKey] + '" style="height:17px;width:auto;flex-shrink:0' + imgExtra + '" onerror="this.style.opacity=\'0.3\'">'
          + labelHtml + '</div>'
          + '<span id="qe1v-' + slId + '" style="font-size:0.82rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
          + '</div>'
          + '<input type="range" id="' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
          + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'qe1v-' + slId + '\');if(v)v.textContent=this.value">'
          + '</div>';
      }
      function _sl(slId, iconKey, label, accent, imgStyle) {
        var cur = wizard.data[slId] || defCond;
        var imgExtra = imgStyle ? ';' + imgStyle : '';
        return '<div style="margin-bottom:0.4rem">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'
          + '<div style="display:flex;align-items:center;gap:5px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">'
          + '<img src="' + _qe1Icons[iconKey] + '" style="height:17px;width:auto;flex-shrink:0' + imgExtra + '" onerror="this.style.opacity=\'0.3\'">'
          + label + '</div>'
          + '<span id="qe1v-' + slId + '" style="font-size:0.82rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
          + '</div>'
          + '<input type="range" id="' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
          + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'qe1v-' + slId + '\');if(v)v.textContent=this.value">'
          + '</div>';
      }

      var html = '';
      if (grp === 'engine_tender') {
        html += _sl('qe1-slider-lead', 'engine', 'Engine', '#d4a843', '');
        var _tNum = wizard.data.tenderMatch || '';
        var _tNonOrig = wizard.data.tenderIsNonOriginal;
        var _tLabelInner = 'TENDER' + (_tNum ? ' <span style="font-family:var(--font-mono);font-weight:700;color:' + (_tNonOrig ? '#f39c12' : '#8b5cf6') + '">' + _tNum + (_tNonOrig ? ' &#x26A0;' : '') + '</span>' : '')
          + '<button type="button" onclick="_showTenderPicker()" style="margin-left:0.4rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.65rem;font-family:var(--font-body);cursor:pointer;white-space:nowrap">Not yours?</button>';
        var _tLabelHtml = '<span id="qe1-tender-label" style="display:flex;align-items:center;gap:0">' + _tLabelInner + '</span>';
        html += _slHtml('qe1-slider-tender', 'tender', _tLabelHtml, '#8b5cf6', '');
      } else if (grp === 'aa') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'a_dummy', 'A Dummy', '#6a5e48', 'opacity:0.65');
      } else if (grp === 'ab') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'b_unit', 'B Unit', '#8b5cf6', '');
      } else if (grp === 'aba') {
        html += _sl('qe1-slider-lead', 'a_powered', 'A Powered', '#d4a843', '');
        html += _sl('qe1-slider-u2', 'b_unit', 'B Unit', '#8b5cf6', '');
        html += _sl('qe1-slider-u3', 'a_dummy', 'A Dummy', '#6a5e48', 'opacity:0.65');
      } else if (grp === 'a_powered') {
        html += _sl('qe1-slider-lead', 'a_powered', 'Condition', '#d4a843', '');
      } else if (grp === 'a_dummy') {
        html += _sl('qe1-slider-lead', 'a_dummy', 'Condition', '#6a5e48', 'opacity:0.65');
      } else {
        // Session 119: bucket-driven icon selection (single source of truth in
        // type-groups.js). Replaces a 3-line substring heuristic that gave
        // cabooses + one-word "Boxcar" rows the engine icon by accident.
        var iconKey = (typeof getBucketIcon === 'function')
          ? getBucketIcon(wizard.matchedItem || {})
          : 'engine';
        var _slLabel = wizard.data.boxOnly ? 'Box Condition' : 'Condition';
        html += _sl('qe1-slider-lead', iconKey, _slLabel, '#d4a843', '');
      }
      html += '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-dim);margin-top:-0.15rem"><span>Poor</span><span>Excellent</span></div>';
      cont.innerHTML = html;
    }

    // Render photo action button
    function _qe1RenderPhotoBtn() {
      var inner = document.getElementById('qe1-photo-btn-inner');
      if (!inner) return;
      var grp = wizard.data._itemGrouping || 'single';
      var multi = grp === 'engine_tender' || grp === 'aa' || grp === 'ab' || grp === 'aba';
      var btnStyle = 'width:100%;min-height:38px;padding:0.42rem;border-radius:8px;border:1.5px dashed var(--border);background:rgba(212,168,67,0.07);color:var(--gold);font-family:var(--font-body);font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem';
      var camIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      inner.innerHTML = '<button type="button" id="qe1-photo-trigger" style="' + btnStyle + '">' + camIcon + ' Quick entry photo only' + '</button>';
      var btn = document.getElementById('qe1-photo-trigger');
      if (!multi) {
        var fi = document.getElementById('qe1-file-engine');
        btn.addEventListener('click', function(e) { e.stopPropagation(); if (fi) fi.click(); });
        if (fi) fi.addEventListener('change', function() {
          if (fi.files && fi.files[0]) {
            wizard.data._qePhotoFile = fi.files[0];
            btn.innerHTML = camIcon + ' \u2713 ' + fi.files[0].name.slice(0, 16).replace(/[&<>"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]; });
            btn.style.color = '#2ecc71'; btn.style.borderColor = '#2ecc71';
          }
        });
      } else {
        btn.addEventListener('click', function() { _qe1OpenPhotoModal(); });
      }
    }

    // Photo modal for multi-unit groupings
    function _qe1OpenPhotoModal() {
      var grp = wizard.data._itemGrouping || 'single';
      var num = (wizard.data.itemNum || '').trim();
      var units = [];
      if (grp === 'engine_tender') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'engine', label: 'Engine', desc: num },
                 { key: 'tender', fileId: 'qe1-file-tender', iconKey: 'tender', label: 'Tender', desc: wizard.data.tenderMatch || '' }];
      } else if (grp === 'aa') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'a_dummy',   label: 'A Dummy',   desc: num + '-D' }];
      } else if (grp === 'ab') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'b_unit',    label: 'B Unit',    desc: wizard.data.unit2ItemNum || '' }];
      } else if (grp === 'aba') {
        units = [{ key: 'engine', fileId: 'qe1-file-engine', iconKey: 'a_powered', label: 'A Powered', desc: num + '-P' },
                 { key: 'u2',     fileId: 'qe1-file-u2',     iconKey: 'b_unit',    label: 'B Unit',    desc: wizard.data.unit2ItemNum || '' },
                 { key: 'u3',     fileId: 'qe1-file-u3',     iconKey: 'a_dummy',   label: 'A Dummy',   desc: num + '-D' }];
      }
      if (!units.length) return;
      var overlay = document.createElement('div');
      overlay.id = 'qe1-photo-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-end';
      var sheet = document.createElement('div');
      sheet.style.cssText = 'width:100%;background:var(--surface);border-radius:16px 16px 0 0;padding:1.2rem;max-height:75vh;overflow-y:auto;-webkit-overflow-scrolling:touch';
      var drag = document.createElement('div');
      drag.style.cssText = 'width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 1rem';
      sheet.appendChild(drag);
      var titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:0.92rem;font-weight:700;color:var(--text);margin-bottom:3px';
      titleEl.textContent = 'Add photos';
      sheet.appendChild(titleEl);
      var subEl = document.createElement('div');
      subEl.style.cssText = 'font-size:0.73rem;color:var(--text-dim);margin-bottom:0.8rem';
      subEl.textContent = 'Right side photo for each unit';
      sheet.appendChild(subEl);
      units.forEach(function(u) {
        var card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:0.7rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.7rem;margin-bottom:0.45rem';
        var iconEl = document.createElement('img');
        iconEl.src = _qe1Icons[u.iconKey];
        iconEl.style.cssText = 'height:30px;width:auto;flex-shrink:0' + (u.iconKey === 'a_dummy' ? ';opacity:0.65' : '');
        iconEl.onerror = function() { this.style.opacity = '0.3'; };
        card.appendChild(iconEl);
        var infoEl = document.createElement('div');
        infoEl.style.flex = '1';
        infoEl.innerHTML = '<div style="font-size:0.8rem;font-weight:600;color:var(--text)">' + u.label + '</div>'
          + '<div style="font-size:0.7rem;color:var(--text-dim)">' + u.desc + '</div>';
        card.appendChild(infoEl);
        var slot = document.createElement('button');
        slot.type = 'button';
        slot.id = 'qe1-slot-' + u.key;
        slot.style.cssText = 'width:54px;height:54px;background:var(--bg);border:1.5px dashed var(--border);border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;flex-shrink:0';
        slot.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span style="font-size:0.6rem;color:var(--text-dim)">Photo</span>';
        var fi = document.getElementById(u.fileId);
        (function(slot, fi, u) {
          slot.addEventListener('click', function() { if (fi) fi.click(); });
          if (fi) fi.addEventListener('change', function() {
            if (!fi.files || !fi.files[0]) return;
            var f = fi.files[0];
            if (u.key === 'engine') wizard.data._qePhotoFile = f;
            else if (u.key === 'tender') wizard.data._qePhotoFileTender = f;
            else if (u.key === 'u2') wizard.data._qePhotoFileU2 = f;
            else if (u.key === 'u3') wizard.data._qePhotoFileU3 = f;
            slot.style.borderColor = '#2ecc71';
            slot.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:0.6rem;color:#2ecc71">\u2713</span>';
          });
        })(slot, fi, u);
        card.appendChild(slot);
        sheet.appendChild(card);
      });
      var doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.style.cssText = 'width:100%;padding:0.65rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer;margin-top:0.3rem';
      doneBtn.textContent = 'Done \u2192';
      doneBtn.onclick = function() { document.body.removeChild(overlay); };
      sheet.appendChild(doneBtn);
      overlay.appendChild(sheet);
      bindOverlayClose(overlay, function() { document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    }

    // Expose globals needed by onclick strings and selectSuggestion
    window._qe1SelectGrouping = function(gid) {
      _selectGroupingData(gid);
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    };
    // _qe1ToggleBoxOnly removed (box only now set on itemNumGrouping screen)
    window._qe1OnInput = function(val) {
      var num = val.trim();
      var inp = document.getElementById('wiz-input');
      var md = document.getElementById('qe1-match');
      var m = num ? state.masterData.find(function(x) { return x.itemNum === num; }) : null;
      if (inp) inp.style.borderColor = m ? 'var(--accent2)' : 'var(--border)';
      if (m) {
        wizard.matchedItem = m;
        if (md) {
          var desc = m.roadName ? m.roadName + ' ' + _typeLabel(m) : (_typeLabel(m) || m.description || '');
          md.textContent = '\u2713 ' + desc + (m.yearFrom ? ' \xb7 ' + m.yearFrom : '');
        }
      } else {
        if (md) md.textContent = '';
      }
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    };

    // ── Initial render ──
    setTimeout(function() {
      var inp = document.getElementById('wiz-input');
      if (inp) {
        inp.addEventListener('input', debounceItemLookup);
        if (inp.value) {
          // Do NOT call updateItemSuggestions here — item already matched from
          // itemNumGrouping screen; showing the dropdown again forces a second tap.
          // Hide suggestions in case they leaked through from previous screen.
          var sug = document.getElementById('wiz-suggestions');
          if (sug) { sug.style.display = 'none'; sug.innerHTML = ''; }
          window._qe1OnInput(inp.value);
        }
        if (!window.IS_MOBILE_UA) inp.focus();
      }
      _qe1RenderGrouping();
      _qe1RenderSliders();
      _qe1RenderPhotoBtn();
    }, 50);

    var nb = document.getElementById('wizard-next-btn');
    if (nb) nb.style.display = 'none';

  } else if (s.type === 'boxCondDetails') {
    // ── BOX: Condition + group-with-item (combined) ──
    var _bcd = wizard.data;
    var _bcdNum = (_bcd.itemNum || '').trim();
    var _bcdMatch = _bcdNum ? Object.values(state.personalData).find(function(pd) { return pd.itemNum === _bcdNum && pd.owned; }) : null;
    var _bcdGrp = _bcd._itemGrouping || 'single';
    var _bcdDefCond = parseInt(localStorage.getItem('lv_default_cond') || '7');

    function _bcdSlider(slId, label, accent) {
      var cur = _bcd[slId] !== undefined ? _bcd[slId] : _bcdDefCond;
      return '<div style="margin-bottom:0.7rem">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
        + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim)">' + label + '</div>'
        + '<span id="bcdv-' + slId + '" style="font-size:0.85rem;font-weight:700;color:' + accent + '">' + cur + '</span>'
        + '</div>'
        + '<input type="range" id="bcd-' + slId + '" min="1" max="10" value="' + cur + '" style="width:100%;accent-color:' + accent + '"'
        + ' oninput="wizard.data[\'' + slId + '\']=parseInt(this.value);var v=document.getElementById(\'bcdv-' + slId + '\');if(v)v.textContent=this.value">'
        + '</div>';
    }

    var _bcdHtml = '<div style="padding-top:0.35rem">';

    if (_bcdGrp === 'engine_tender') {
      _bcdHtml += _bcdSlider('boxCond', 'Engine Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('tenderBoxCond', 'Tender Box Condition', '#8b5cf6');
    } else if (_bcdGrp === 'aa') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'A Dummy Box Condition', '#6a5e48');
    } else if (_bcdGrp === 'ab') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'B Unit Box Condition', '#8b5cf6');
    } else if (_bcdGrp === 'aba') {
      _bcdHtml += _bcdSlider('boxCond', 'A Powered Box Condition', '#d4a843');
      _bcdHtml += _bcdSlider('unit2BoxCond', 'B Unit Box Condition', '#8b5cf6');
      _bcdHtml += _bcdSlider('unit3BoxCond', 'A Dummy Box Condition', '#6a5e48');
    } else {
      _bcdHtml += _bcdSlider('boxCond', 'Box Condition', '#d4a843');
    }
    _bcdHtml += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);margin-top:-0.35rem;margin-bottom:0.75rem"><span>Poor</span><span>Excellent</span></div>';

    if (_bcdMatch) {
      var _bcdGrouped = _bcd.boxGroupSuggest === 'Yes';
      _bcdHtml += '<div style="margin-bottom:0.75rem">'
        + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.35rem">Group with item in collection?</div>'
        + '<div style="display:flex;gap:0.4rem">'
        + '<button type="button" id="bcd-grp-yes" onclick="_bcdSetGroup(&apos;Yes&apos;)" style="flex:1;padding:0.5rem;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font-body);border:2px solid ' + (_bcdGrouped ? 'var(--accent2)' : 'var(--border)') + ';background:' + (_bcdGrouped ? 'rgba(201,146,42,0.12)' : 'var(--surface2)') + ';color:' + (_bcdGrouped ? 'var(--accent2)' : 'var(--text-mid)') + '">Yes \u2014 link it</button>'
        + '<button type="button" id="bcd-grp-no" onclick="_bcdSetGroup(&apos;No&apos;)" style="flex:1;padding:0.5rem;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;font-family:var(--font-body);border:2px solid var(--border);background:var(--surface2);color:var(--text-mid)">No</button>'
        + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.3rem">Links this box to your ' + _bcdNum + ' with a shared Group ID.</div>'
        + '</div>';
    }

    _bcdHtml += '<div style="margin-bottom:0.5rem">'
      + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);margin-bottom:0.35rem">Box photo (optional)</div>'
      + '<button type="button" id="bcd-photo-btn" style="width:100%;padding:0.55rem;border-radius:9px;border:1.5px dashed var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
      + '<span id="bcd-photo-label">Add box photo</span>'
      + '</button>'
      + '<input type="file" id="bcd-photo-file" accept="image/*" capture="environment" style="display:none">'
      + '</div>';

    _bcdHtml += '</div>';
    body.innerHTML = _bcdHtml;

    setTimeout(function() {
      var photoBtn = document.getElementById('bcd-photo-btn');
      var photoFile = document.getElementById('bcd-photo-file');
      if (photoBtn && photoFile) {
        photoBtn.addEventListener('click', function() { photoFile.click(); });
        photoFile.addEventListener('change', function() {
          if (photoFile.files && photoFile.files[0]) {
            // v0.9.825 (TODO-008): crop-first, same flow as every photo pick.
            var _bcdApply = function (f) {
              wizard.data._boxPhotoFile = f;
              var lbl = document.getElementById('bcd-photo-label');
              if (lbl) lbl.textContent = '\u2713 ' + String(f.name || '').slice(0, 22);
              if (photoBtn) { photoBtn.style.borderColor = '#2ecc71'; photoBtn.style.color = '#2ecc71'; }
            };
            if (window._cropFirst) window._cropFirst(photoFile.files[0], _bcdApply);
            else _bcdApply(photoFile.files[0]);
          }
        });
      }
    }, 50);

    window._bcdSetGroup = function(val) {
      wizard.data.boxGroupSuggest = val;
      var yesBtn = document.getElementById('bcd-grp-yes');
      var noBtn  = document.getElementById('bcd-grp-no');
      if (yesBtn) {
        yesBtn.style.borderColor = val === 'Yes' ? 'var(--accent2)' : 'var(--border)';
        yesBtn.style.background  = val === 'Yes' ? 'rgba(201,146,42,0.12)' : 'var(--surface2)';
        yesBtn.style.color       = val === 'Yes' ? 'var(--accent2)' : 'var(--text-mid)';
      }
      if (noBtn) {
        noBtn.style.borderColor = val === 'No' ? 'var(--accent)' : 'var(--border)';
        noBtn.style.background  = val === 'No' ? 'rgba(232,64,28,0.1)' : 'var(--surface2)';
        noBtn.style.color       = val === 'No' ? 'var(--accent)' : 'var(--text-mid)';
      }
    };

  } else if (s.type === 'boxPurchaseValue') {
    // ── BOX: Price + Worth + Date + Notes + Location (combined) ──
    var _bpv = wizard.data;
    var _bpvLocList = [];
    (typeof _getSavedLocations === 'function' ? _getSavedLocations() : []).forEach(function(l) {
      if (l && l.name && !_bpvLocList.includes(l.name)) _bpvLocList.push(l.name);
    });
    Object.values(state.personalData).forEach(function(pd) {
      if (pd.location && pd.location.trim() && !_bpvLocList.includes(pd.location.trim())) _bpvLocList.push(pd.location.trim());
    });

    var _bpvHtml = '<div style="padding-top:0.25rem;max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch">';

    // v0.9.1242 (Brad): Est. Worth is asked BEFORE what you paid, on every
    // screen that asks both. What a thing is worth is the answer he wants
    // recorded; what he paid is history. Five screens asked these two
    // questions and three of them asked them the other way round.
    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Estimated Worth (for insurance) <a href="javascript:_wizResearchPrice()" style="float:right;color:#2ecc71;font-weight:700;text-decoration:none;text-transform:none;letter-spacing:0">\uD83D\uDD0D Research</a></div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">'
      + '<span style="color:var(--text-dim);font-size:1.1rem">$</span>'
      + '<input type="number" id="bpv-worth" value="' + (_bpv.userEstWorth || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.userEstWorth=this.value">'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">What did you pay? ($)</div>'
      + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">'
      + '<span style="color:var(--text-dim);font-size:1.1rem">$</span>'
      + '<input type="number" id="bpv-price" value="' + (_bpv.priceBox || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.priceBox=this.value">'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Date Purchased</div>'
      + '<div style="position:relative;display:flex;align-items:center">'
      + '<input type="date" id="bpvDate" value="' + (_bpv.purchaseDate || '') + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box;color-scheme:dark" oninput="wizard.data.purchaseDate=this.value">'
      + '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;bpvDate&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
      + '</div></div>';

    _bpvHtml += '<div style="margin-bottom:0.75rem">'
      + '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Notes (optional)</div>'
      + '<textarea id="bpv-notes" placeholder="e.g. Missing one flap, faded graphics" style="width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + rrEsc(_bpv.notes) + '</textarea></div>';

    if (_prefLocEnabled) {
      _bpvHtml += '<div style="margin-bottom:0.75rem">' + _wizLocationFieldHtml(_bpv.location || '') + '</div>';
    }

    _bpvHtml += '</div>';
    body.innerHTML = _bpvHtml;
    setTimeout(function() { var i = document.getElementById('bpv-price'); if (i) i.focus(); }, 50);

  } else if (s.type === 'slider') {
    const val = wizard.data[s.id] || parseInt(localStorage.getItem('lv_default_cond') || '7');
    body.innerHTML = `
      <div style="padding-top:1rem">
        <div style="display:flex;align-items:center;gap:1rem">
          <div style="font-family:var(--font-head);font-size:3rem;color:var(--accent2);width:3rem" id="wiz-slider-val">${val}</div>
          <input type="range" min="${s.min}" max="${s.max}" value="${val}" id="wiz-slider" style="flex:1;accent-color:var(--accent)"
            oninput="wizard.data['${s.id}']=parseInt(this.value);document.getElementById('wiz-slider-val').textContent=this.value">
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-dim);margin-top:0.25rem">
          <span>1–3<br>Fair/Poor</span><span style="text-align:center">4–5<br>Good</span><span style="text-align:center">6–7<br>Very Good</span><span style="text-align:right">8–10<br>Exc/Mint</span>
        </div>
        <div id="wiz-cond-desc" style="margin-top:0.6rem;padding:0.5rem 0.75rem;border-radius:8px;background:var(--surface2);font-size:0.82rem;color:var(--text-mid);text-align:center;min-height:2rem"></div>

      </div>`;
    setTimeout(initCondDesc, 60);

  } else if (s.type === 'boxVariationPicker') {
    // ── Box variation picker: shows known box types from master data ──
    var _bvItemNum = (wizard.data.itemNum || '').trim();
    var _bvVars = typeof getBoxVariations === 'function' ? getBoxVariations(_bvItemNum) : [];
    var _bvVal = wizard.data.boxVariation || '';
    var _bvCards = _bvVars.map(function(bv) {
      var isSelected = _bvVal === (bv.variation || bv.itemNum);
      var descText = bv.description || '';
      // Strip trailing year codes for display
      var dispDesc = descText.replace(/,\s*\d{1,3}\s*$/, '').trim();
      return '<button onclick="wizardChooseBoxVariation(\'' + (bv.variation || bv.itemNum).replace(/'/g, "\\'") + '\', \'' + dispDesc.replace(/'/g, "\\'") + '\')" style="'
        + 'display:flex;flex-direction:column;gap:0.3rem;padding:0.85rem 1rem;'
        + 'border-radius:10px;text-align:left;width:100%;cursor:pointer;'
        + 'font-family:var(--font-body);transition:all 0.15s;'
        + 'border:2px solid ' + (isSelected ? '#8B4513' : 'var(--border)') + ';'
        + 'background:' + (isSelected ? 'rgba(139,69,19,0.12)' : 'var(--surface2)') + ';'
        + 'color:var(--text);'
        + '">'
        + '<div style="display:flex;align-items:center;gap:0.6rem;width:100%">'
        + '<span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:' + (isSelected ? '#8B4513' : 'var(--accent2)') + ';min-width:2rem">'
        + (bv.variation || '—') + '</span>'
        + '<span style="font-size:0.88rem;flex:1">' + dispDesc + '</span>'
        + '</div>'
        + '</button>';
    });
    // Add "Other / Not Listed" option
    var _bvOtherSel = _bvVal === '_other';
    _bvCards.push('<button onclick="wizardChooseBoxVariation(\'_other\', \'Not listed\')" style="'
      + 'display:flex;align-items:center;gap:0.6rem;padding:0.85rem 1rem;'
      + 'border-radius:10px;text-align:left;width:100%;cursor:pointer;'
      + 'font-family:var(--font-body);transition:all 0.15s;'
      + 'border:2px solid ' + (_bvOtherSel ? '#8B4513' : 'var(--border)') + ';'
      + 'background:' + (_bvOtherSel ? 'rgba(139,69,19,0.12)' : 'var(--surface2)') + ';'
      + 'color:var(--text);'
      + '">'
      + '<span style="font-family:var(--font-mono);font-size:1rem;font-weight:600;color:var(--text-dim);min-width:2rem">?</span>'
      + '<span style="font-size:0.88rem;color:var(--text-mid)">Other / Not Listed</span>'
      + '</button>');

    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.75rem">'
      + 'We found ' + _bvVars.length + ' known box type' + (_bvVars.length > 1 ? 's' : '') + ' for No. ' + _bvItemNum + ':</div>'
      + '<div style="display:flex;flex-direction:column;gap:0.5rem">' + _bvCards.join('') + '</div>'
      + '</div>';

  } else if (s.type === 'choice2' || s.type === 'choice3') {
    const val = wizard.data[s.id] || '';
    const _choices = typeof s.choices === 'function' ? s.choices(wizard.data) : (s.choices || []);
    const _manyChoices = _choices.length > 4;
    body.innerHTML = `
      <div style="${_manyChoices
        ? 'display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;padding-top:0.75rem'
        : 'display:flex;gap:0.75rem;flex-wrap:wrap;padding-top:0.75rem'}">
        ${_choices.map(c => `
          <button onclick="wizardChoose('${s.id}','${c}')" style="
            padding:${_manyChoices ? '0.7rem 0.5rem' : '0.85rem'};border-radius:10px;
            border:2px solid ${val===c ? 'var(--accent)' : 'var(--border)'};
            background:${val===c ? 'rgba(232,64,28,0.15)' : 'var(--surface2)'};
            color:${val===c ? 'var(--accent)' : 'var(--text-mid)'};
            font-family:var(--font-body);font-size:${_manyChoices ? '0.82rem' : '0.95rem'};font-weight:500;cursor:pointer;transition:all 0.15s;text-align:center;
            ${_manyChoices ? '' : 'flex:1;min-width:80px;'}
          ">${c}</button>`).join('')}
      </div>`;

  } else if (s.type === 'choiceSearch') {
    // Searchable choice list — type to filter, click to select
    const csVal     = wizard.data[s.id] || '';
    const csId      = 'cs-input-' + s.id;
    const csChoices = typeof s.choices === 'function' ? s.choices(wizard.data) : (s.choices || []);
    body.innerHTML = `
      <div style="padding-top:0.5rem">
        <div style="position:relative;margin-bottom:0.6rem">
          <input id="${csId}" type="text" placeholder="Type to search…"
            autocomplete="off" autocorrect="off" spellcheck="false"
            value="${csVal}"
            style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);
                   border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);
                   font-family:var(--font-body);font-size:0.9rem;outline:none"
            oninput="wizardFilterChoices('${s.id}','${csId}')">
          <span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);
                       color:var(--text-dim);font-size:0.9rem;pointer-events:none">🔍</span>
        </div>
        <div id="cs-list-${s.id}" style="display:flex;flex-direction:column;gap:0.35rem;max-height:300px;overflow-y:auto">
          ${csChoices.map(c => `
            <button onclick="wizardChoose('${s.id}','${c}')" data-choice="${c.toLowerCase()}" style="
              padding:0.6rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;
              border:2px solid ${csVal===c ? 'var(--accent)' : 'var(--border)'};
              background:${csVal===c ? 'rgba(232,64,28,0.15)' : 'var(--surface2)'};
              color:${csVal===c ? 'var(--accent)' : 'var(--text-mid)'};
              font-family:var(--font-body);font-size:0.85rem;font-weight:500;
              transition:all 0.15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
            >${c}</button>`).join('')}
        </div>
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
      </div>`;
    setTimeout(() => { const i = document.getElementById(csId); if(i) i.focus(); }, 80);

  } else if (s.type === 'catalogPicker') {
    const cpVal  = wizard.data[s.id] || null;
    const cpSub  = wizard.data.eph_paperSubType || '';
    const cpType = wizard.data.eph_paperType || '';
    // Sub-type filter map (for Catalog sub-types)
    const subTypeMap = {
      'Consumer Postwar':  ['Consumer'],
      'Consumer Pre-war':  ['Consumer (Pre-war)'],
      'Advance/Dealer':    ['Advance','Pre-Advance'],
      'Display':           ['Display Catalog'],
      'Accessory':         ['Consumer'],
      'HO':                ['Consumer'],
      'Science/Other':     ['Consumer'],
      // Magazine sub-types
      'Lionel Magazine':              ['Lionel Magazine'],
      'Model Builder / Model Engineer':['Model Builder Magazine'],
      // Dealer Paper sub-types
      'Price List':           ['Dealer Price List'],
      'Parts List':           ['Dealer Parts List'],
      'Service Paper':        ['Dealer Service Paper'],
      'Service Station Listing':['Service Station Listing'],
      'Dealer Flyer':         ['Dealer Flyer'],
    };
    // Top-level type filter (when no sub-type, or for non-Catalog types)
    const topTypeMap = {
      'Operating Manual':     ['Operating Manual'],
      'Dealer Promo Kit':     ['Dealer Promo Kit'],
      'Dealer Display Poster':['Dealer Display Poster'],
      'Reference Book':       ['Reference Book'],
      'Promotional Item':     ['Promotional'],
      'Magazine':             ['Lionel Magazine','Model Builder Magazine'],
      'Dealer Paper':         ['Dealer Price List','Dealer Parts List','Dealer Service Paper','Service Station Listing','Dealer Flyer'],
    };
    let allowedTypes = [];
    if (cpSub && subTypeMap[cpSub]) {
      allowedTypes = subTypeMap[cpSub];
    } else if (cpType && topTypeMap[cpType]) {
      allowedTypes = topTypeMap[cpType];
    }
    const allItems = (state.catalogRefData || []).filter(function(it) {
      if (!allowedTypes.length) return true;
      return allowedTypes.some(function(t) { return (it.type||'').includes(t); });
    });
    window._cpAllItems = allItems;
    const pickedTitle = cpVal ? cpVal.title : '';
    let listHTML = '';
    if (allItems.length === 0) {
      listHTML = '<div style="color:var(--text-dim);font-size:0.82rem;padding:0.5rem">Nothing in the catalog yet — hit Next to manually enter your item.</div>';
    } else {
      allItems.slice(0, 80).forEach(function(it, idx) {
        const picked = cpVal && cpVal.id === it.id;
        const label = it.title + (it.year && !it.title.includes(it.year) ? ' (' + it.year + ')' : '');
        const searchAttr = (it.title + ' ' + it.year + ' ' + it.type).toLowerCase().replace(/"/g, '');
        const descLine = it.description
          ? '<div style="font-size:0.72rem;color:var(--text-dim);font-weight:400;margin-top:0.15rem">'
              + String(it.description).replace(/</g, '&lt;') + '</div>'
          : '';
        listHTML += '<button onclick="wizardPickCatalog(' + idx + ')" data-search="' + searchAttr + '" style="'
          + 'padding:0.5rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;width:100%;'
          + 'border:2px solid ' + (picked ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (picked ? 'rgba(232,64,28,0.15)' : 'var(--surface2)') + ';'
          + 'color:' + (picked ? 'var(--accent)' : 'var(--text-mid)') + ';'
          + 'font-family:var(--font-body);font-size:0.82rem;font-weight:500;transition:all 0.15s;margin-bottom:0.3rem">'
          + label + descLine + '</button>';
      });
    }
    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="position:relative;margin-bottom:0.6rem">'
      + '<input id="cp-input" type="text" placeholder="Type year or keyword..." autocomplete="off" autocorrect="off" spellcheck="false" value="' + pickedTitle.replace(/"/g, '&quot;') + '" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizardFilterCatalog()">'
      + '<span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--text-dim);font-size:0.9rem;pointer-events:none">&#128269;</span>'
      + '</div>'
      + '<div id="cp-list" style="display:flex;flex-direction:column;max-height:280px;overflow-y:auto">'
      + listHTML
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">If it is not listed, hit Next to manually enter your item.</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('cp-input'); if(i) i.focus(); }, 80);

  } else if (s.type === 'isPicker') {
    // Searchable IS picker — filters master IS list by linked item number
    const ipVal    = wizard.data[s.id] || null;
    const itemNum  = (wizard.data.is_linkedItem || '').trim();
    // Filter master IS data by item number (exact + suffix variants like 671a, 671b)
    const allIS = (state.isRefData || []).filter(function(it) {
      if (!itemNum) return true;
      const base = it.itemNumber || '';
      return base === itemNum || base.startsWith(itemNum);
    });
    window._ipAllItems = allIS;
    const pickedDesc = ipVal ? ipVal.description : '';
    let listHTML = '';
    if (allIS.length === 0) {
      listHTML = '<div style="color:var(--text-dim);font-size:0.82rem;padding:0.5rem">'
        + (itemNum ? 'No known sheets for No. ' + itemNum + ' — press Next to enter manually' : 'Enter item # first')
        + '</div>';
    } else {
      allIS.forEach(function(it, idx) {
        const picked = ipVal && ipVal.id === it.id;
        const label  = it.description + (it.variations ? ' (' + it.variations + ')' : '');
        const search = (it.description + ' ' + it.itemNumber + ' ' + (it.variations||'')).toLowerCase().replace(/"/g,'');
        listHTML += '<button onclick="wizardPickIS(' + idx + ')" data-search="' + search + '" style="'
          + 'padding:0.5rem 0.75rem;border-radius:8px;text-align:left;cursor:pointer;width:100%;'
          + 'border:2px solid ' + (picked ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (picked ? 'rgba(232,64,28,0.15)' : 'var(--surface2)') + ';'
          + 'color:' + (picked ? 'var(--accent)' : 'var(--text-mid)') + ';'
          + 'font-family:var(--font-body);font-size:0.82rem;font-weight:500;transition:all 0.15s;margin-bottom:0.3rem">'
          + label + '</button>';
      });
    }
    body.innerHTML = '<div style="padding-top:0.5rem">'
      + '<div style="position:relative;margin-bottom:0.6rem">'
      + '<input id="ip-input" type="text" placeholder="Search by description..." autocomplete="off" spellcheck="false" value="' + pickedDesc.replace(/"/g,'&quot;') + '" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem 0.55rem 2rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizardFilterIS()">'
      + '<span style="position:absolute;left:0.6rem;top:50%;transform:translateY(-50%);color:var(--text-dim);pointer-events:none">&#128269;</span>'
      + '</div>'
      + '<div id="ip-list" style="display:flex;flex-direction:column;max-height:280px;overflow-y:auto">' + listHTML + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('ip-input'); if(i) i.focus(); }, 80);

  } else if (s.type === 'isDetails') {
    // Consolidated sheet # / form code / year / notes on one card
    const sn = wizard.data.is_sheetNum  || '';
    const fc = wizard.data.is_formCode  || '';
    const yr = wizard.data.is_year      || '';
    const nt = wizard.data.is_notes     || '';
    body.innerHTML = '<div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.85rem">'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Sheet Number <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-sn" value="' + sn.replace(/"/g,'&quot;') + '" placeholder="e.g. 924-6, 726-13" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_sheetNum=this.value">'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Form Code <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-fc" value="' + fc.replace(/"/g,'&quot;') + '" placeholder="e.g. 671-58\u20148-55\u2014TT" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_formCode=this.value">'
      +   '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Bottom of sheet next to "Printed in U.S.A."</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Year Printed <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<input type="text" id="isd-yr" value="' + yr.replace(/"/g,'&quot;') + '" placeholder="e.g. 1957, 1955-08" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none" oninput="wizard.data.is_year=this.value">'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Notes <span style="color:var(--text-dim);font-weight:400;font-style:italic">(optional)</span></div>'
      +   '<textarea id="isd-nt" rows="2" placeholder="e.g. Early printing, double-sided, staple holes" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:none" oninput="wizard.data.is_notes=this.value">' + rrEsc(nt) + '</textarea>'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">All fields optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('isd-sn'); if(i) i.focus(); }, 50);

  } else if (s.type === 'paperExtras') {
    const pp  = wizard.data.eph_pricePaid  || '';
    const ev  = wizard.data.eph_estValue    || '';
    const da  = wizard.data.eph_dateAcquired|| '';
    const nt  = wizard.data.eph_notes       || '';
    body.innerHTML = '<div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.9rem">'
      // v0.9.1242 (Brad): Est. Worth is asked BEFORE what you paid, on every
      // screen that asks both. What a thing is worth is the answer he wants
      // recorded; what he paid is history. Five screens asked these two
      // questions and three of them asked them the other way round.
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Est. Worth ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="pe-val" value="' + ev + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.eph_estValue=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">What Did You Pay? ($)</div>'
      +   '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.9rem">'
      +     '<span style="color:var(--text-dim)">$</span>'
      +     '<input type="number" id="pe-paid" value="' + pp + '" placeholder="0.00" min="0" step="0.01"'
      +     ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem"'
      +     ' oninput="wizard.data.eph_pricePaid=this.value">'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Date Acquired</div>'
      +   '<div style="position:relative;display:flex;align-items:center">'
      +   '<input type="date" id="pe-date" value="' + da + '"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;color-scheme:dark"'
      +   ' oninput="wizard.data.eph_dateAcquired=this.value">'
      +   '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;pe-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
      +   '</div>'
      + '</div>'
      + '<div>'
      +   '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.35rem">Notes</div>'
      +   '<textarea id="pe-notes" rows="3" placeholder="e.g. Still in original mailing envelope"'
      +   ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:none"'
      +   ' oninput="wizard.data.eph_notes=this.value">' + rrEsc(nt) + '</textarea>'
      + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">All fields optional — press Next to skip</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('pe-val'); if(i) i.focus(); }, 50);

  } else if (s.type === 'pricePaid') {
    const itemVal = wizard.data.priceItem || '';
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.4rem">What did you pay for the item? ($)</div>
        <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem">
          <span style="color:var(--text-dim);font-size:1.2rem">$</span>
          <input type="number" id="wiz-price-item" value="${itemVal}" placeholder="0.00" min="0" step="0.01"
            style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1.1rem"
            oninput="wizard.data.priceItem=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
        </div>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-price-item'); if(i) i.focus(); }, 50);

  } else if (s.type === 'money') {
    const val = wizard.data[s.id] || '';
    const moneyNote = s.note ? s.note(wizard.data) : '';
    const moneyNoteHtml = moneyNote ? '<div style="font-size:0.82rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.12);border:1px solid rgba(201,146,42,0.4);border-radius:6px;line-height:1.4">' + moneyNote + '</div>' : '';

    // Build price context for askingPrice step (from collection data)
    let _priceCtxHtml = '';
    if ((s.id === 'askingPrice' && wizard.tab === 'forsale') || (s.id === 'salePrice' && wizard.tab === 'sold')) {
      const _pdKey = wizard.data._collectionPdKey || wizard.data.selectedForSaleKey || wizard.data.selectedSoldKey;
      const _pd = _pdKey && _pdKey !== '__new__' ? (state.personalData[_pdKey] || {}) : {};
      const _pricePaid = wizard.data.originalPrice || wizard.data.priceItem || _pd.priceItem || '';
      const _estWorth = wizard.data.estWorth || _pd.userEstWorth || '';
      // v0.9.746 (Brad): "add the detail page button above the est worth box" —
      // peek at the item (photos link, condition, LOCATION for the tote hunt)
      // without losing your place in the wizard.
      if (_pdKey && _pdKey !== '__new__' && state.personalData[_pdKey]) {
        _priceCtxHtml += '<button type="button" onclick="_wizPeekDetail()" style="width:100%;margin-bottom:0.6rem;padding:0.55rem;border-radius:8px;border:1.5px dashed var(--accent2,#c9922a);background:rgba(201,146,42,0.08);color:var(--accent2,#c9922a);font-weight:600;font-size:0.8rem;cursor:pointer;font-family:var(--font-body)">\uD83D\uDCC4 View Item Details</button>';
      }
      if (_pricePaid || _estWorth) {
        _priceCtxHtml += '<div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap">';   // v0.9.747: += — the '=' here CLOBBERED the peek button
        if (_pricePaid) {
          _priceCtxHtml += '<div style="flex:1;min-width:120px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.8rem">'
            + '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.2rem">Price Paid</div>'
            + '<div style="font-family:var(--font-head);font-size:1.15rem;color:var(--accent)">$' + parseFloat(_pricePaid).toLocaleString() + '</div>'
            + '</div>';
        }
        if (_estWorth) {
          _priceCtxHtml += '<div style="flex:1;min-width:120px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.8rem">'
            + '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.2rem">Est. Worth</div>'
            + '<div style="font-family:var(--font-head);font-size:1.15rem;color:var(--accent2)">$' + parseFloat(_estWorth).toLocaleString() + '</div>'
            + '</div>';
        }
        _priceCtxHtml += '</div>';
      }
    }

    // v0.9.743 (Brad): "research price" at the far right of the expect-to-pay
    // box — full circle: check the market right where you commit to a number.
    // Also on the For-Sale asking price (same question, seller's side).
    const _rpShow = (s.id === 'expectedPrice' || s.id === 'askingPrice')
      && (wizard.data.itemNum || (wizard.matchedItem || {}).itemNum);
    const _rpBtn = _rpShow
      ? `<button type="button" onclick="_wizResearchPrice()" style="flex-shrink:0;padding:0.5rem 0.8rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:var(--font-body)">🔍 Research</button>`
      : '';
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        ${_priceCtxHtml}
        <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem">
          <span style="color:var(--text-dim);font-size:1.2rem">$</span>
          <input type="number" id="wiz-input" value="${val}" placeholder="${s.placeholder || '0.00'}" min="0" step="0.01"
            style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1.1rem"
            oninput="wizard.data['${s.id}']=this.value"
            onkeydown="if(event.key==='Enter')wizardNext()">
          ${_rpBtn}
        </div>
        ${moneyNoteHtml}
        ${s.optional ? '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>' : ''}
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);

  // S153: yearMade renderer — re-added (was removed S120 as dead code).
  // Fires only when master.yearProd is missing. Captures either a precise
  // year via text input, or an era pick (Pre-war / Postwar / Modern) which
  // saves a representative year so the chip-filter classifier works.
  } else if (s.type === 'yearMade') {
    var _ymVal = wizard.data[s.id] || '';
    var _ymYear = new Date().getFullYear();
    body.innerHTML = ''
      + '<div style="padding-top:0.5rem">'
      +   '<div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.7rem;line-height:1.45">'
      +     'We don\'t have a year for this item in the catalog. Enter the year if you know it, or pick an era below.'
      +   '</div>'
      +   '<input type="number" id="wiz-input" value="' + _ymVal + '" placeholder="e.g. 1957" '
      +     'min="1900" max="' + _ymYear + '" '
      +     'style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;'
      +     'padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none" '
      +     'oninput="wizard.data[\'' + s.id + '\']=this.value" '
      +     'onkeydown="if(event.key===\'Enter\')wizardNext()">'
      +   '<div style="margin-top:1.1rem;font-size:0.78rem;font-weight:700;letter-spacing:0.04em;'
      +     'text-transform:uppercase;color:var(--text-dim);margin-bottom:0.5rem">Or pick an era:</div>'
      +   '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">'
      +     '<button type="button" onclick="wizard.data[\'' + s.id + '\']=\'1930\';wizardNext()" '
      +       'style="padding:0.55rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;font-weight:600">'
      +     'Pre-war (before 1944)</button>'
      +     '<button type="button" onclick="wizard.data[\'' + s.id + '\']=\'1955\';wizardNext()" '
      +       'style="padding:0.55rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;font-weight:600">'
      +     'Postwar (1945\u20131969)</button>'
      +     '<button type="button" onclick="wizard.data[\'' + s.id + '\']=\'1990\';wizardNext()" '
      +       'style="padding:0.55rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;font-weight:600">'
      +     'Modern (1970\u2013today)</button>'
      +   '</div>'
      + '</div>';
    setTimeout(function() { var i = document.getElementById('wiz-input'); if (i) i.focus(); }, 50);
  } else if (s.type === 'postwarYear') {
    var _pwCurr = wizard.data[s.id] || '';
    var _pwWrap = document.createElement('div');
    _pwWrap.style.cssText = 'padding-top:0.5rem';
    var _pwHint = document.createElement('div');
    _pwHint.style.cssText = 'font-size:0.78rem;font-weight:600;color:#2980b9;margin-bottom:0.6rem';
    _pwHint.textContent = 'Tap the year:';
    _pwWrap.appendChild(_pwHint);
    var _pwGrid = document.createElement('div');
    _pwGrid.id = 'postwar-year-grid';
    _pwGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem';
    for (var _y = 1945; _y <= 1969; _y++) {
      (function(yr) {
        var _btn = document.createElement('button');
        var _sel = String(yr) === String(_pwCurr);
        _btn.style.cssText = 'padding:0.45rem 0.7rem;border-radius:8px;font-family:var(--font-mono);font-size:0.88rem;font-weight:600;cursor:pointer;transition:all 0.15s;'
          + (_sel ? 'border:2px solid var(--accent);background:rgba(232,64,28,0.15);color:var(--accent)'
                  : 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)');
        _btn.textContent = yr;
        _btn.onclick = function() {
          wizard.data[s.id] = String(yr);
          document.querySelectorAll('#postwar-year-grid button').forEach(function(b) {
            var isSel = b.textContent === String(yr);
            b.style.border = isSel ? '2px solid var(--accent)' : '1.5px solid var(--border)';
            b.style.background = isSel ? 'rgba(232,64,28,0.15)' : 'var(--surface2)';
            b.style.color = isSel ? 'var(--accent)' : 'var(--text-mid)';
          });
          setTimeout(function() { wizardNext(); }, 120);
        };
        _pwGrid.appendChild(_btn);
      })(_y);
    }
    _pwWrap.appendChild(_pwGrid);
    body.innerHTML = '';
    body.appendChild(_pwWrap);
    // Hide Next — year buttons auto-advance
    var _pwNb = document.getElementById('wizard-next-btn');
    if (_pwNb) _pwNb.style.display = 'none';

  } else if (s.type === 'date') {
    // v0.9.749 (Brad): "Date listed" defaults to TODAY (user can change it) —
    // same for recording a sale date. Stamp wizard.data too so Next keeps it.
    if (!wizard.data[s.id] && (s.id === 'dateListed' || s.id === 'dateSold')) {
      try { wizard.data[s.id] = new Date().toLocaleDateString('en-CA'); } catch (e) {}
    }
    const val = wizard.data[s.id] || '';
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="position:relative;display:flex;align-items:center">
          <input type="date" id="wiz-input" value="${val}"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 3rem 0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none;
            color-scheme:dark;"
            oninput="wizard.data['${s.id}']=this.value">
          <button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById('wiz-input').showPicker();" title="Open calendar"
            style="position:absolute;right:0.5rem;cursor:pointer;font-size:1.15rem;color:var(--accent2);background:none;border:none;padding:0.4rem;line-height:1;touch-action:manipulation">📅</button>
        </div>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;

  } else if (s.type === 'setMatch') {
    const itemNum = (wizard.data.itemNum || '').trim();
    const partner = getSetPartner(itemNum);
    const unitType = itemNum.endsWith('C') ? 'B unit' : 'A unit';
    const current = wizard.data.setMatch || '';

    // Check if user already owns a unit from this set
    const baseNum = itemNum.endsWith('C') ? itemNum.slice(0,-1) : itemNum;
    const ownedPartner = Object.values(state.personalData).find(pd =>
      pd.itemNum === baseNum || pd.itemNum === baseNum + 'C'
    );

    const smContainer = document.createElement('div');
    smContainer.style.cssText = 'padding-top:0.5rem';

    const intro = document.createElement('div');
    intro.style.cssText = 'font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem';
    intro.textContent = 'This is a ' + unitType + ' that can be part of a multi-unit diesel set' + (partner ? ' (partner: ' + partner + ')' : '') + '.';
    smContainer.appendChild(intro);

    const opts = [
      { val: 'set-now',   icon: '🚂🚂', label: 'Adding as a set now',        desc: 'Walk through all units together' },
      { val: 'link',      icon: '🔗',   label: 'Link to unit already owned', desc: ownedPartner ? 'Found: ' + ownedPartner.itemNum + ' in your collection' : 'Assign same Set ID as existing unit', disabled: !ownedPartner },
      { val: 'standalone',icon: '🚂',   label: 'Standalone / no set',        desc: 'Save this unit by itself' },
    ];

    opts.forEach(function(opt) {
      const btn = document.createElement('button');
      const sel = current === opt.val;
      btn.style.cssText = 'text-align:left;padding:0.85rem 1rem;border-radius:10px;cursor:pointer;width:100%;margin-bottom:0.5rem;'
        + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
        + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
        + 'color:' + (opt.disabled ? 'var(--text-dim)' : 'var(--text)') + ';font-family:var(--font-body)';
      btn.disabled = opt.disabled;
      btn.onclick = function() {
        wizard.data.setMatch = opt.val;
        if (opt.val === 'set-now') {
          wizard.data._setId = genSetId(baseNum);
          wizard.data.unit2ItemNum = partner || baseNum + 'C';
          wizard.data.unit3ItemNum = wizard.data.itemNum; // ABA: third unit = same A number
        }
        if (opt.val === 'link' && ownedPartner) {
          wizard.data._setId = ownedPartner.setId || genSetId(baseNum);
        }
        renderWizardStep();
      };
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;align-items:center;gap:0.75rem';
      const iconEl = document.createElement('span');
      iconEl.style.cssText = 'font-size:1.3rem';
      iconEl.textContent = opt.icon;
      const labelEl = document.createElement('div');
      labelEl.innerHTML = '<div style="font-weight:600;color:' + (sel?'var(--accent)':'inherit') + '">' + opt.label + '</div>'
        + '<div style="font-size:0.78rem;color:var(--text-dim)">' + opt.desc + '</div>';
      top.appendChild(iconEl);
      top.appendChild(labelEl);
      btn.appendChild(top);
      smContainer.appendChild(btn);
    });

    // Set type selector (AA/AB/ABA) — only show when 'set-now' selected
    if (current === 'set-now') {
      const typeDiv = document.createElement('div');
      typeDiv.style.cssText = 'margin-top:0.75rem;padding:0.75rem;background:var(--bg);border-radius:8px;border:1px solid var(--border)';
      typeDiv.innerHTML = '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem">What type of set?</div>';
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:0.5rem';
      ['AA','AB','ABA'].forEach(function(t) {
        const tb = document.createElement('button');
        const tsel = wizard.data.setType === t;
        tb.style.cssText = 'flex:1;padding:0.5rem;border-radius:7px;font-weight:600;cursor:pointer;font-family:var(--font-head);'
          + 'border:2px solid ' + (tsel?'var(--accent2)':'var(--border)') + ';'
          + 'background:' + (tsel?'rgba(201,146,42,0.15)':'var(--surface2)') + ';'
          + 'color:' + (tsel?'var(--accent2)':'var(--text-mid)');
        tb.textContent = t;
        tb.onclick = function() { wizard.data.setType = t; renderWizardStep(); };
        btnRow.appendChild(tb);
      });
      typeDiv.appendChild(btnRow);
      smContainer.appendChild(typeDiv);
    }

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem';
    hint.textContent = 'Optional — press Next to skip';
    smContainer.appendChild(hint);

    body.innerHTML = '';
    body.appendChild(smContainer);

  } else if (s.type === 'setUnit2Num') {
    // Pre-filled unit number — let user confirm or change
    const isUnit3 = !!s.unit3;
    const field = isUnit3 ? 'unit3ItemNum' : 'unit2ItemNum';
    const curr = wizard.data[field] || '';
    const label = isUnit3
      ? 'Third unit item number (second A unit — edit if needed)'
      : 'Second unit item number (pre-filled from partner — edit if needed)';
    body.innerHTML = '<div style="padding-top:0.75rem">'
      + '<div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:0.5rem">' + label + '</div>'
      + '<input type="text" id="wiz-unit-num" value="' + curr + '" autocomplete="off" '
      + 'style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none" '
      + 'oninput="wizard.data[\'' + field + '\']=this.value; updateUnitNumSuggestions(this.value,\'' + field + '\')" '
      + 'onkeydown="handleUnitNumKey(event)">'
      + '<div id="wiz-unit-suggestions" style="display:none;flex-direction:column;gap:2px;margin-top:4px;max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:4px"></div>'
      + '</div>';
    setTimeout(function() {
      const i = document.getElementById('wiz-unit-num');
      if (i) { i.focus(); if (i.value) updateUnitNumSuggestions(i.value, field); }
    }, 50);

  } else if (s.type === 'divider') {
    const sub = s.subtitle ? s.subtitle(wizard.data) : '';
    body.innerHTML = '<div style="padding-top:1rem;text-align:center">'
      + '<div style="font-size:3rem;margin-bottom:0.75rem">🚃</div>'
      + '<div style="font-size:0.95rem;color:var(--text-dim);line-height:1.6;max-width:340px;margin:0 auto">' + sub + '</div>'
      + '</div>';

  } else if (s.type === 'tenderMatch') {
    const tmItemNum = (wizard.data.itemNum || '').trim();
    const tmTenders = getMatchingTenders(tmItemNum);
    const tmLocos   = getMatchingLocos(tmItemNum);
    const tmIsTend  = tmLocos.length > 0;
    const tmCandidates = tmIsTend ? tmLocos : tmTenders;
    const tmRole    = tmIsTend ? 'locomotive' : 'tender';
    const tmCurrent = wizard.data.tenderMatch || '';
    const tmIntro   = tmIsTend
      ? ('This tender (' + tmItemNum + ') pairs with the following locomotive(s):')
      : ('This steam engine (' + tmItemNum + ') pairs with the following tender(s):');

    const tmContainer = document.createElement('div');
    tmContainer.style.cssText = 'padding-top:0.5rem';

    const tmIntroEl = document.createElement('div');
    tmIntroEl.style.cssText = 'font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem';
    tmIntroEl.textContent = tmIntro;
    tmContainer.appendChild(tmIntroEl);

    tmCandidates.forEach(function(num) {
      const masterItem = findMaster(num);
      const desc = masterItem ? (masterItem.roadName || masterItem.description || _typeLabel(masterItem) || '') : '';
      const owned = Object.values(state.personalData).find(function(pd) { return pd.itemNum === num; });
      const sel = tmCurrent === num;

      const btn = document.createElement('button');
      btn.style.cssText = 'text-align:left;padding:0.85rem 1rem;border-radius:10px;cursor:pointer;width:100%;margin-bottom:0.5rem;'
        + 'border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
        + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--surface2)') + ';'
        + 'color:var(--text);font-family:var(--font-body)';
      btn.onclick = function() { wizard.data.tenderMatch = num; renderWizardStep(); };

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';

      const numSpan = document.createElement('span');
      numSpan.style.cssText = 'font-family:var(--font-head);font-size:1.2rem;color:' + (sel ? 'var(--accent)' : 'var(--text)');
      numSpan.textContent = (tmIsTend ? '🚂 ' : '🚃 ') + num;
      topRow.appendChild(numSpan);

      if (owned) {
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:0.7rem;color:var(--accent2);border:1px solid var(--accent2);padding:0.15rem 0.5rem;border-radius:4px';
        badge.textContent = '✓ In Collection';
        topRow.appendChild(badge);
      }
      btn.appendChild(topRow);

      if (desc) {
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem';
        descEl.textContent = desc;
        btn.appendChild(descEl);
      }
      tmContainer.appendChild(btn);
    });

    const noneBtn = document.createElement('button');
    noneBtn.style.cssText = 'text-align:left;padding:0.75rem 1rem;border-radius:10px;cursor:pointer;width:100%;'
      + 'border:2px solid var(--border);background:' + (tmCurrent === 'none' ? 'var(--surface2)' : 'transparent') + ';'
      + 'color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem';
    noneBtn.textContent = 'No matching ' + tmRole + ' / not applicable';
    noneBtn.onclick = function() { wizard.data.tenderMatch = 'none'; renderWizardStep(); };
    tmContainer.appendChild(noneBtn);

    const tmHint = document.createElement('div');
    tmHint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem';
    tmHint.textContent = 'Optional — press Next to skip';
    tmContainer.appendChild(tmHint);

    body.innerHTML = '';
    body.appendChild(tmContainer);

  } else if (s.type === 'setComponents') {
    // ── Phase management ──────────────────────────────────────────
    // _setPhase: 'identify' | 'detail'
    // _setDetailIdx: index into the final item list for detail walkthrough
    if (!wizard.data._setPhase) wizard.data._setPhase = 'identify';
    const phase = wizard.data._setPhase;

    const _setLoco      = (wizard.data.set_loco || '').trim().toUpperCase();
    const _enteredNums  = wizard.data._enteredNums || (_setLoco ? [_setLoco] : []);
    if (!wizard.data._enteredNums) wizard.data._enteredNums = _enteredNums;

    const _resolvedSet  = wizard.data._resolvedSet || null;
    const _dismissed    = wizard.data._dismissedSets || [];
    const _compData     = wizard.data.set_componentData || {};
    if (!wizard.data.set_componentData) wizard.data.set_componentData = {};

    body.innerHTML = '';

    // ── PHASE 1: IDENTIFY ─────────────────────────────────────────
    if (phase === 'identify') {

      // Resolved set banner
      if (_resolvedSet) {
        const hdr = document.createElement('div');
        hdr.style.cssText = 'background:rgba(46,204,113,0.1);border:1.5px solid #2ecc71;border-radius:10px;padding:0.7rem 1rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between';
        hdr.innerHTML = `<div>
          <div style="font-size:0.68rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2ecc71">Set Identified ✓</div>
          <div style="font-size:0.92rem;color:var(--text);font-weight:600">${_resolvedSet.setNum}${_resolvedSet.setName ? ' — ' + _resolvedSet.setName : ''}</div>
          <div style="font-size:0.75rem;color:var(--text-dim)">${_resolvedSet.year||''} ${_resolvedSet.gauge||''} · ${_resolvedSet.items.length} components</div>
        </div>
        <button onclick="wizard.data._resolvedSet=null;wizard.data.set_num='';renderWizardStep()" style="border:none;background:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem" title="Clear">✕</button>`;
        body.appendChild(hdr);
      }

      // Items entered so far
      if (_enteredNums.length) {
        const listHdr = document.createElement('div');
        listHdr.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.4rem';
        listHdr.textContent = 'Items entered:';
        body.appendChild(listHdr);
        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.75rem';
        _enteredNums.forEach(n => {
          const chip = document.createElement('div');
          chip.style.cssText = 'display:flex;align-items:center;gap:0.3rem;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:0.25rem 0.6rem 0.25rem 0.75rem';
          chip.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--accent);font-weight:600">${n}</span>
            <button onclick="window._setRemoveEntered('${n}')" style="border:none;background:none;color:var(--text-dim);cursor:pointer;font-size:0.9rem;line-height:1;padding:0">×</button>`;
          listWrap.appendChild(chip);
        });
        body.appendChild(listWrap);
      }

      // Add item input
      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.75rem';
      addRow.innerHTML = `
        <input id="set-id-input" type="text" placeholder="Enter item # (e.g. 736, 6357, 1033)" autocomplete="off"
          style="flex:1;padding:0.65rem 0.9rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.92rem;text-transform:uppercase"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window._setAddEntered();}">
        <button onclick="window._setAddEntered()" style="padding:0.65rem 1rem;border-radius:9px;border:none;background:#1e3a5f;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">Add</button>`;
      body.appendChild(addRow);

      // v0.9.1234 (Brad): "need a research button for the set add". Hidden
      // until there is something to search — a button that opens an empty
      // search is worse than no button.
      const _resLabel = (typeof window._wizResearchSetLabel === 'function')
        ? window._wizResearchSetLabel() : '';
      if (_resLabel) {
        const resRow = document.createElement('div');
        resRow.style.cssText = 'margin-bottom:0.75rem';
        resRow.innerHTML = '<button type="button" onclick="window._wizResearchSet()" '
          + 'style="width:100%;padding:0.55rem 0.9rem;border-radius:9px;border:1.5px solid var(--green);'
          + 'background:rgba(46,204,113,0.12);color:var(--green);font-family:var(--font-body);'
          + 'font-weight:700;font-size:0.85rem;cursor:pointer">' + _resLabel + '</button>';
        body.appendChild(resRow);
      }

      // Suggestions
      const _allEntered = _enteredNums;
      const _suggestions = _allEntered.length >= 1
        ? suggestSets(_allEntered).filter(sg => !_dismissed.includes(sg.setNum))
        : [];
      wizard.data._suggestions_cache = _suggestions; // for inline button onclick refs

      if (!_resolvedSet && _suggestions.length) {
        const sugHdr = document.createElement('div');
        sugHdr.style.cssText = 'font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e67e22;margin-bottom:0.4rem';
        sugHdr.textContent = _suggestions.length === 1 ? '🎁 Possible set match:' : '🎁 Possible set matches:';
        body.appendChild(sugHdr);
        _suggestions.slice(0, 4).forEach((sg, i) => {
          const card = document.createElement('div');
          card.style.cssText = `background:${i===0?'rgba(230,126,34,0.1)':'var(--surface2)'};border:${i===0?'1.5px solid #e67e22':'1px solid var(--border)'};border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.4rem;cursor:pointer`;
          // sg is the exact scored variant row — resolve it directly, no disambiguation needed
          card.onclick = () => {
            wizard.data._resolvedSet = sg;
            wizard.data.set_num = sg.setNum;
            window._resolveSetAndAdvance();
          };
          card.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:0.5rem">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                  <span style="font-family:var(--font-mono);font-size:0.9rem;font-weight:700;color:${i===0?'#e67e22':'var(--accent)'}">${sg.setNum}</span>
                  ${sg.setName ? `<span style="font-size:0.8rem;color:var(--text-mid)">${sg.setName}</span>` : ''}
                  ${sg.year ? `<span style="font-size:0.72rem;color:var(--text-dim)">${sg.year}</span>` : ''}
                </div>
                <div style="margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.25rem">
                  ${sg.items.map(n => {
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n) || baseItemNum(e) === baseItemNum(n));
                    return `<span style="font-family:var(--font-mono);font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${isEntered?'#2ecc71':'var(--border)'};background:${isEntered?'rgba(46,204,113,0.15)':'var(--surface)'};color:${isEntered?'#2ecc71':'var(--text-dim)'};font-weight:${isEntered?'700':'400'}">${n}</span>`;
                  }).join('')}
                  ${sg.alts.length ? sg.alts.map(n => {
                    const isEntered = _enteredNums.some(e => normalizeItemNum(e) === normalizeItemNum(n) || baseItemNum(e) === baseItemNum(n));
                    return `<span style="font-family:var(--font-mono);font-size:0.72rem;padding:1px 6px;border-radius:4px;border:1px solid ${isEntered?'#e67e22':'var(--border)'};background:${isEntered?'rgba(230,126,34,0.12)':'var(--surface)'};color:${isEntered?'#e67e22':'var(--text-dim)'};font-style:italic" title="Alternate">${n}</span>`;
                  }).join('') : ''}
                </div>
              </div>
              <button onclick="event.stopPropagation();wizard.data._resolvedSet=wizard.data._suggestions_cache?.[${i}];wizard.data.set_num='${sg.setNum}';renderWizardStep();" style="flex-shrink:0;padding:0.35rem 0.75rem;border-radius:8px;border:1.5px solid ${i===0?'#e67e22':'var(--border)'};background:${i===0?'#e67e2222':'var(--surface)'};color:${i===0?'#e67e22':'var(--text-dim)'};font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap">This is mine</button>
            </div>`;
          body.appendChild(card);
        });
        // Dismiss link
        if (_suggestions.length) {
          const noMatch = document.createElement('div');
          noMatch.style.cssText = 'text-align:center;margin-top:0.25rem';
          noMatch.innerHTML = `<button onclick="window._dismissAllSugg()" style="border:none;background:none;color:var(--text-dim);font-size:0.78rem;cursor:pointer;text-decoration:underline">None of these match</button>`;
          body.appendChild(noMatch);
        }
      }

      // Auto-advance helper: build final items and advance when set is resolved
      window._resolveSetAndAdvance = () => {
        // v0.9.1122: repeats in the catalog's own list are real cars.
        const _finalItems = _rrBuildSetItems(wizard.data._resolvedSet, wizard.data._enteredNums || []);
        wizard.data._setFinalItems = _finalItems;
        wizard.data._setItemIndex = 0;
        wizard.data._setGroupId = 'SET-' + ((wizard.data._resolvedSet && wizard.data._resolvedSet.setNum) || 'UNK') + '-' + Date.now();
        wizard.data._setItemsSaved = [];
        wizardAdvance();
      };

      // Continue button — shown once set identified OR user has ≥1 item and no suggestions
      const canContinue = _resolvedSet || (_enteredNums.length >= 1);
      if (canContinue) {
        const contBtn = document.createElement('button');
        contBtn.style.cssText = 'width:100%;margin-top:0.75rem;padding:0.85rem;border-radius:10px;border:none;background:' + (_resolvedSet ? '#1e3a5f' : 'var(--surface2)') + ';color:' + (_resolvedSet ? 'white' : 'var(--text-mid)') + ';font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer';
        contBtn.textContent = _resolvedSet
          ? `Continue — add details for ${_resolvedSet.items.length} items →`
          : `Continue without set ID — add ${_enteredNums.length} item${_enteredNums.length!==1?'s':''}  →`;
        contBtn.onclick = () => {
          // Build final item list from resolved set + manually entered items.
          // v0.9.1122: same shared builder — a set that lists a number twice
          // (1562W's two 2442 Vista Domes) walks it twice.
          const _finalItems = _rrBuildSetItems(_resolvedSet, _enteredNums);
          wizard.data._setFinalItems = _finalItems;
          wizard.data._setItemIndex = 0;
          wizard.data._setGroupId = 'SET-' + ((_resolvedSet && _resolvedSet.setNum) || 'UNK') + '-' + Date.now();
          wizard.data._setItemsSaved = [];
          // Advance past setComponents to set_entryMode
          wizardAdvance();
        };
        body.appendChild(contBtn);
      }

      // Wire up identify-phase callbacks
      window._setAddEntered = () => {
        const inp = document.getElementById('set-id-input');
        const val = (inp ? inp.value : '').trim().toUpperCase().replace(/\s+/g,'');
        if (!val) return;
        if (!wizard.data._enteredNums) wizard.data._enteredNums = [];
        if (!wizard.data._enteredNums.includes(val)) wizard.data._enteredNums.push(val);
        renderWizardStep();
      };
      window._setRemoveEntered = (n) => {
        wizard.data._enteredNums = (wizard.data._enteredNums||[]).filter(x => x !== n);
        renderWizardStep();
      };
      window._confirmSetMatch = (setNum, variantIdx) => {
        const allVariants = state.setData.filter(s => s.setNum === setNum);
        if (!allVariants.length) return;

        // If a specific variant was passed or only one exists, resolve directly
        if (variantIdx !== undefined) {
          const v = allVariants[variantIdx];
          wizard.data._resolvedSet = v;
          wizard.data.set_num = v.setNum;
          window._resolveSetAndAdvance();
          return;
        }
        if (allVariants.length === 1) {
          wizard.data._resolvedSet = allVariants[0];
          wizard.data.set_num = allVariants[0].setNum;
          window._resolveSetAndAdvance();
          return;
        }

        // Multiple variants — show disambiguation overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0';
        const sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--surface);border-radius:16px 16px 0 0;padding:1.25rem;width:100%;max-width:520px;max-height:80vh;overflow-y:auto';
        sheet.innerHTML = `<div style="font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-dim);text-align:center;margin-bottom:0.75rem">Set ${setNum} — Which version?</div>`;

        const _entered = wizard.data._enteredNums || [];
        allVariants.forEach((v, vi) => {
          const btn = document.createElement('button');
          btn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:0.3rem;width:100%;padding:0.75rem 0.9rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);margin-bottom:0.4rem;cursor:pointer;text-align:left;font-family:var(--font-body)';
          btn.onmouseenter = () => btn.style.border = '1px solid #e67e22';
          btn.onmouseleave = () => btn.style.border = '1px solid var(--border)';

          const chips = v.items.map(n => {
            const matched = _entered.some(e => normalizeItemNum(e) === normalizeItemNum(n));
            return `<span style="font-family:var(--font-mono);font-size:0.7rem;padding:1px 6px;border-radius:4px;border:1px solid ${matched?'#2ecc71':'var(--border)'};background:${matched?'rgba(46,204,113,0.15)':'var(--surface)'};color:${matched?'#2ecc71':'var(--text-dim)'};font-weight:${matched?'700':'400'}">${n}</span>`;
          }).join('');
          const altChips = v.alts.length ? v.alts.map(n => {
            const matched = _entered.some(e => normalizeItemNum(e) === normalizeItemNum(n));
            return `<span style="font-family:var(--font-mono);font-size:0.7rem;padding:1px 6px;border-radius:4px;border:1px solid ${matched?'#e67e22':'rgba(230,126,34,0.3)'};background:${matched?'rgba(230,126,34,0.12)':'var(--surface)'};color:${matched?'#e67e22':'var(--text-dim)'};font-style:italic">${n}</span>`;
          }).join('') : '';

          btn.innerHTML = `
            <div style="font-size:0.78rem;color:var(--text-dim)">${v.year || 'Year unknown'}${v.gauge ? ' · ' + v.gauge : ''}${v.price ? ' · ' + v.price : ''}</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.2rem">${chips}${altChips}</div>`;
          btn.onclick = () => { overlay.remove(); window._confirmSetMatch(setNum, vi); };
          sheet.appendChild(btn);
        });

        const cancel = document.createElement('button');
        cancel.style.cssText = 'width:100%;padding:0.65rem;border-radius:10px;border:none;background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;margin-top:0.25rem';
        cancel.textContent = 'Cancel';
        cancel.onclick = () => overlay.remove();
        sheet.appendChild(cancel);
        overlay.appendChild(sheet);
        bindOverlayClose(overlay, function() { overlay.remove(); });
        document.body.appendChild(overlay);
      };
      window._dismissAllSugg = () => {
        const sug = suggestSets(wizard.data._enteredNums||[]).filter(sg => !(wizard.data._dismissedSets||[]).includes(sg.setNum));
        if (!wizard.data._dismissedSets) wizard.data._dismissedSets = [];
        sug.forEach(sg => wizard.data._dismissedSets.push(sg.setNum));
        renderWizardStep();
      };

    // ── PHASE 2: DETAIL ───────────────────────────────────────────
    } else {
      const _resolvedSet2 = wizard.data._resolvedSet;
      // Build final item list: set items (deduped) + manually entered not in set
      const _setItems = _resolvedSet2
        ? [...new Map(_resolvedSet2.items.map(x=>[normalizeItemNum(x),x])).values()]
        : [];
      const _setAlts  = _resolvedSet2 ? _resolvedSet2.alts : [];
      const _allKnown = [..._setItems, ..._setAlts];
      const _manuals  = (wizard.data._enteredNums||[]).filter(n => !_allKnown.some(k => normalizeItemNum(k)===normalizeItemNum(n)));
      const _allItems = [..._setItems, ..._setAlts.filter(a => {
        // Only include alt if user entered it or has it
        const n = normalizeItemNum(a);
        return (wizard.data._enteredNums||[]).some(e=>normalizeItemNum(e)===n) || (_compData[a]||{}).have === true;
      }), ..._manuals];

      const idx  = wizard.data._setDetailIdx || 0;
      const item = _allItems[idx];
      const total = _allItems.length;

      if (!item) {
        // All done — show summary
        const owned = _allItems.filter(n => (_compData[n]||{}).have === true);
        const sumDiv = document.createElement('div');
        sumDiv.style.cssText = 'text-align:center;padding:1rem 0';
        sumDiv.innerHTML = `<div style="font-size:2rem;margin-bottom:0.5rem">✅</div>
          <div style="font-size:1rem;font-weight:700;color:var(--text)">All ${total} items reviewed</div>
          <div style="font-size:0.85rem;color:var(--text-mid);margin-top:0.25rem">${owned.length} item${owned.length!==1?'s':''} will be saved to your collection</div>
          <button onclick="wizard.data._setDetailIdx=${total-1};renderWizardStep()" style="margin-top:0.75rem;padding:0.5rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-size:0.82rem;cursor:pointer">← Back</button>`;
        body.appendChild(sumDiv);
      } else {
        const comp   = _compData[item] || {};
        const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(item));
        const isAlt  = _setAlts.some(a => normalizeItemNum(a) === normalizeItemNum(item));
        const isManual = _manuals.some(n => normalizeItemNum(n) === normalizeItemNum(item));
        const preOwned = (wizard.data._enteredNums||[]).some(n => normalizeItemNum(n) === normalizeItemNum(item));

        // Progress
        const prog = document.createElement('div');
        prog.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem';
        prog.innerHTML = `<div style="flex:1;height:4px;background:var(--surface2);border-radius:2px">
          <div style="height:4px;background:var(--accent);border-radius:2px;width:${Math.round((idx/total)*100)}%;transition:width 0.3s"></div>
        </div>
        <span style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap">${idx+1} of ${total}</span>`;
        body.appendChild(prog);

        // Item header
        const itemHdr = document.createElement('div');
        itemHdr.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.75rem 1rem;margin-bottom:0.75rem';
        itemHdr.innerHTML = `
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span style="font-family:var(--font-mono);font-size:1.05rem;font-weight:700;color:var(--accent)">${item}</span>
            ${isAlt ? '<span style="font-size:0.62rem;background:#e67e2222;color:#e67e22;border-radius:4px;padding:1px 6px;font-weight:700">ALTERNATE</span>' : ''}
            ${isManual ? '<span style="font-size:0.62rem;background:rgba(52,152,219,0.15);color:#3498db;border-radius:4px;padding:1px 6px;font-weight:700">ADDED BY YOU</span>' : ''}
          </div>
          ${master ? `<div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.2rem">${[master.roadName, master.description].filter(Boolean).join(' · ')}</div>` : ''}
          ${master && master.itemType ? `<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.1rem">${_typeLabel(master)}${master.yearProd?' · '+master.yearProd:''}</div>` : ''}`;
        body.appendChild(itemHdr);

        // Have / No
        const haveRow = document.createElement('div');
        haveRow.style.cssText = 'display:flex;gap:0.6rem;margin-bottom:0.75rem';
        haveRow.innerHTML = `
          <button onclick="window._detailHave('${item}',true)" style="flex:1;padding:0.85rem;border-radius:10px;border:2px solid ${comp.have===true?'#2ecc71':'var(--border)'};background:${comp.have===true?'rgba(46,204,113,0.18)':'var(--surface2)'};color:${comp.have===true?'#2ecc71':'var(--text-mid)'};font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer">✓ I have it</button>
          <button onclick="window._detailHave('${item}',false)" style="flex:1;padding:0.85rem;border-radius:10px;border:2px solid ${comp.have===false?'var(--accent)':'var(--border)'};background:${comp.have===false?'rgba(232,64,28,0.12)':'var(--surface2)'};color:${comp.have===false?'var(--accent)':'var(--text-mid)'};font-family:var(--font-body);font-size:0.92rem;font-weight:600;cursor:pointer">✗ Don't have it</button>`;
        body.appendChild(haveRow);

        // Detail fields (if have)
        if (comp.have === true) {
          // Condition
          const condDiv = document.createElement('div');
          condDiv.style.cssText = 'margin-bottom:0.65rem';
          condDiv.innerHTML = `<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:0.4rem">Condition</div>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
              ${[...Array(10)].map((_,i)=>`<button onclick="window._detailCond('${item}',${i+1})" style="flex:1;min-width:28px;height:36px;border-radius:7px;border:1.5px solid ${(comp.condition||0)===i+1?'var(--accent)':'var(--border)'};background:${(comp.condition||0)===i+1?'rgba(232,64,28,0.2)':'var(--surface2)'};font-size:0.82rem;cursor:pointer;color:${(comp.condition||0)===i+1?'var(--accent)':'var(--text-mid)'};font-weight:${(comp.condition||0)===i+1?'700':'400'}">${i+1}</button>`).join('')}
            </div>`;
          body.appendChild(condDiv);

          // Has box
          const boxRow = document.createElement('div');
          boxRow.style.cssText = 'margin-bottom:0.65rem';
          boxRow.innerHTML = `<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:0.4rem">Original Box?</div>
            <div style="display:flex;gap:0.6rem">
              <button onclick="window._detailBox('${item}',true)" style="flex:1;padding:0.65rem;border-radius:10px;border:1.5px solid ${comp.hasBox===true?'#3498db':'var(--border)'};background:${comp.hasBox===true?'rgba(52,152,219,0.15)':'var(--surface2)'};color:${comp.hasBox===true?'#3498db':'var(--text-mid)'};font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">📦 Yes</button>
              <button onclick="window._detailBox('${item}',false)" style="flex:1;padding:0.65rem;border-radius:10px;border:1.5px solid ${comp.hasBox===false?'var(--border)':'var(--border)'};background:${comp.hasBox===false?'rgba(232,64,28,0.08)':'var(--surface2)'};color:${comp.hasBox===false?'var(--accent)':'var(--text-mid)'};font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">No box</button>
            </div>
            ${comp.hasBox===true ? `<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem">
              <span style="font-size:0.75rem;color:var(--text-dim)">Box condition:</span>
              <div style="display:flex;gap:0.25rem">
                ${[...Array(10)].map((_,i)=>`<button onclick="window._detailBoxCond('${item}',${i+1})" style="width:26px;height:26px;border-radius:5px;border:1.5px solid ${(comp.boxCond||0)===i+1?'#3498db':'var(--border)'};background:${(comp.boxCond||0)===i+1?'rgba(52,152,219,0.2)':'var(--surface2)'};font-size:0.7rem;cursor:pointer;color:${(comp.boxCond||0)===i+1?'#3498db':'var(--text-dim)'}">${i+1}</button>`).join('')}
              </div>
            </div>` : ''}`;
          body.appendChild(boxRow);
        }

        // Prev / Next
        const navRow = document.createElement('div');
        navRow.style.cssText = 'display:flex;gap:0.6rem;margin-top:0.5rem';
        if (idx > 0) {
          const prevBtn = document.createElement('button');
          prevBtn.style.cssText = 'padding:0.7rem 1.1rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer';
          prevBtn.textContent = '← Back';
          prevBtn.onclick = () => { wizard.data._setDetailIdx = idx - 1; renderWizardStep(); };
          navRow.appendChild(prevBtn);
        }
        if (comp.have !== undefined) {
          const nextBtn = document.createElement('button');
          nextBtn.style.cssText = 'flex:1;padding:0.7rem;border-radius:9px;border:none;background:#1e3a5f;color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer';
          nextBtn.textContent = idx < total - 1 ? 'Next →' : 'All done ✓';
          nextBtn.onclick = () => { wizard.data._setDetailIdx = idx + 1; renderWizardStep(); };
          navRow.appendChild(nextBtn);
        }
        body.appendChild(navRow);
      }

      // Detail callbacks
      window._detailHave = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, have: val };
        renderWizardStep();
      };
      window._detailCond = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, condition: val };
        renderWizardStep();
      };
      window._detailBox = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, hasBox: val };
        renderWizardStep();
      };
      window._detailBoxCond = (item, val) => {
        if (!wizard.data.set_componentData) wizard.data.set_componentData = {};
        const ex = wizard.data.set_componentData[item] || {};
        wizard.data.set_componentData[item] = { ...ex, boxCond: val };
      };
    }

  } else if (s.type === 'drivePhotos') {
    // Check item type for custom views (Science/Construction/Catalog/Paper/IS)
    let views = s.views;
    if (!views) {
      const _phMaster = wizard.matchedItem || findMaster((wizard.data.itemNum||''));
      const _phType = (_phMaster && _phMaster.itemType) ? _phMaster.itemType : '';
      if (['Science Set','Construction Set'].includes(_phType) && s.label === 'Item') {
        views = [
          { key: 'CASE-FRONT', label: 'Front of Case', abbr: 'Front' },
          { key: 'CASE-BACK',  label: 'Back of Case',  abbr: 'Back'  },
          { key: 'CASE-INSIDE',label: 'Inside of Set',  abbr: 'Inside' },
        ];
      } else if (_phType === 'Catalog' && s.label === 'Item') {
        views = [
          { key: 'COVER',  label: 'Front Cover', abbr: 'Front' },
          { key: 'BACK',   label: 'Back Cover',  abbr: 'Back'  },
        ];
      } else if (_phType === 'Instruction Sheet' && s.label === 'Item') {
        views = [
          { key: 'IS-FRONT', label: 'Front of Sheet', abbr: 'Front' },
          { key: 'IS-BACK',  label: 'Back of Sheet',  abbr: 'Back'  },
        ];
      } else if ((_phType.toLowerCase().includes('paper')) && s.label === 'Item') {
        views = [
          { key: 'PAPER-FRONT', label: 'Front of Page', abbr: 'Front' },
          { key: 'PAPER-BACK',  label: 'Back of Page',  abbr: 'Back'  },
        ];
      } else {
        views = s.label === 'Box' ? BOX_VIEWS : s.label === 'Error' ? ERROR_VIEWS : ITEM_VIEWS;
      }
    }
    const stored = wizard.data[s.id] || {};

    // Color-coded photo banner (always clear body first for clean render)
    body.innerHTML = '';
    if (s.photoBanner) {
      const _bannerColor = s.photoBanner.color || '#2980b9';
      const _bannerLabel = typeof s.photoBanner.label === 'function' ? s.photoBanner.label(wizard.data) : (s.photoBanner.label || '');
      const _bannerDiv = document.createElement('div');
      _bannerDiv.style.cssText = 'background:' + _bannerColor + ';color:#fff;padding:0.7rem 1rem;border-radius:10px;margin-bottom:0.6rem;font-family:var(--font-head);font-size:0.9rem;font-weight:700;letter-spacing:0.04em;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.3)';
      _bannerDiv.textContent = _bannerLabel;
      body.appendChild(_bannerDiv);
    }

    // Build a photo slot element (used for both fixed and extra slots)
    function makePhotoSlot(viewKey, label, abbr, stepId) {
      const url = stored[viewKey] || '';
      const hasPic = !!url;
      // v0.9.935 (Brad): adding from the Photo Inbox auto-loads that photo into
      // the Right Side View slot (catalog flow), and — v0.9.968 — into the
      // manual flow's Item slot (PHOTO-1). It files into the item folder on save
      // via _flushPending regardless; this is the in-wizard preview. Click still
      // replaces it with a fresh upload if wanted.
      const inboxFid = (!hasPic && (viewKey === 'RSV' || (stepId === 'manualPhotos' && viewKey === 'PHOTO-1')) && wizard && wizard.data && wizard.data._addPhotoDriveId) ? wizard.data._addPhotoDriveId : '';

      const div = document.createElement('div');
      div.className = 'photo-drop-zone';
      div.dataset.view = viewKey;
      div.dataset.sid = stepId;
      div.style.cssText = 'border:2px dashed ' + ((hasPic || inboxFid) ? 'var(--accent2)' : 'var(--border)') + ';'
        + 'border-radius:8px;aspect-ratio:1;min-height:58px;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden;'
        + 'background:' + ((hasPic || inboxFid) ? 'rgba(201,146,42,0.08)' : 'var(--surface2)');
      div.ondragover = function(e) { e.preventDefault(); div.style.borderColor = 'var(--accent)'; };
      div.ondragleave = function() { div.style.borderColor = hasPic ? 'var(--accent2)' : 'var(--border)'; };
      div.ondrop = function(e) { handlePhotoDrop(e, stepId, viewKey); };
      div.onclick = function() { showPhotoSourcePicker(stepId, viewKey); };

      if (hasPic) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.82';
        img.onerror = function() { this.style.display = 'none'; };
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.25)';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);'
          + 'font-size:0.68rem;color:#fff;padding:2px 3px;text-align:center;'
          + 'font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase';
        lbl.textContent = abbr + ' \u2713';
        div.appendChild(img);
        div.appendChild(overlay);
        div.appendChild(lbl);
      } else if (inboxFid) {
        const img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.82';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.25)';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);'
          + 'font-size:0.68rem;color:#fff;padding:2px 3px;text-align:center;'
          + 'font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase';
        lbl.textContent = abbr + ' \u2713 from inbox';
        div.appendChild(img);
        div.appendChild(overlay);
        div.appendChild(lbl);
        try { if (typeof loadDriveThumb === 'function') loadDriveThumb(inboxFid, img, div, null, 'hi'); } catch (e) {}
      } else {
        const inner = document.createElement('div');
        inner.style.cssText = 'font-size:0.72rem;color:var(--text-dim);text-align:center;padding:0.25rem;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%';
        // RSV gets the engine icon as a placeholder
        const isRSV = (viewKey === 'RSV' || viewKey === 'BOX-RSV');
        if (isRSV) {
          inner.innerHTML = '<img src="' + _RSV_PLACEHOLDER_PNG + '" style="width:72%;max-width:80px;height:auto;opacity:0.35;margin-bottom:2px">'
            + '<div style="font-weight:600;color:var(--text-mid);font-size:0.72rem;line-height:1.2">' + abbr + '</div>';
        } else {
          inner.innerHTML = '<div style="font-size:1rem;margin-bottom:0.1rem;opacity:0.4">&#128247;</div>'
            + '<div style="font-weight:600;color:var(--text-mid);font-size:0.72rem;line-height:1.2">' + abbr + '</div>';
        }
        div.appendChild(inner);
      }

      const prog = document.createElement('div');
      prog.id = 'prog-' + stepId + '-' + viewKey;
      prog.style.cssText = 'display:none;position:absolute;inset:0;background:rgba(0,0,0,0.72);'
        + 'align-items:center;justify-content:center';
      prog.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';
      div.appendChild(prog);

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:contents';
      wrapper.appendChild(div);
      return wrapper;
    }

    // Count existing extra slots stored in wizard data
    const _existingExtras = Object.keys(stored).filter(k => k.startsWith('EXTRA-'));
    const _extraCount = { val: _existingExtras.length };

    // Show orientation reminder for item/locomotive photo steps only
    const _isItemPhotoStep = (s.label === 'Item' || s.label === 'IS' === false) &&
      !['Box','Error','IS','Catalog'].includes(s.label);

    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding-top:0.25rem';

    // Friendly orientation note for item photos.
    // v0.9.1028 (Brad): tightened for phones — the labels sit UNDER the
    // picture instead of squeezing it between two columns — and it can be
    // dismissed for good once the habit sticks ("Got it — don't show again").
    var _orientHidden = false;
    try { _orientHidden = localStorage.getItem('rr_orient_tip_off') === '1'; } catch (eOT) {}
    if (_isItemPhotoStep && !_orientHidden) {
      const orientNote = document.createElement('div');
      orientNote.className = 'rr-orient-tip';
      orientNote.style.cssText = 'background:rgba(41,128,185,0.06);border:1px solid rgba(41,128,185,0.25);border-radius:10px;padding:0.6rem 0.7rem;margin-bottom:0.6rem;text-align:center';
      orientNote.innerHTML = `
        <div style="font-size:0.72rem;font-weight:600;color:#2980b9;margin-bottom:0.45rem;letter-spacing:0.03em">📐 Orientation tip — photograph the <b>right side</b></div>
        <img loading="lazy" src="${_RSV_PLACEHOLDER_PNG}" style="width:150px;max-width:70%;height:auto;display:block;margin:0 auto 0.35rem;border-radius:6px;opacity:0.9">
        <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);flex-wrap:wrap">
          <span>← Rear</span><span style="color:#2980b9;font-weight:700;font-family:var(--font-body)">Right Side View</span><span>Front →</span>
        </div>
        <label style="display:flex;align-items:center;justify-content:center;gap:0.4rem;margin-top:0.5rem;font-size:0.72rem;color:var(--text-mid);cursor:pointer;user-select:none">
          <input type="checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:#2980b9"
                 onchange="try{localStorage.setItem('rr_orient_tip_off', this.checked?'1':'0');}catch(e){}; if(this.checked){var n=this.closest('.rr-orient-tip'); if(n) n.remove();}">
          Got it — don't show this again
        </label>`;
      wrap.appendChild(orientNote);
    }

    const introDiv = document.createElement('div');
    introDiv.style.cssText = 'font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem';
    introDiv.textContent = 'Drag & drop or click each slot to upload. Photos save to Google Drive automatically.';
    wrap.appendChild(introDiv);

    // Condition slider (when embedded in photo step, e.g. IS flow)
    if (s.conditionSlider) {
      const _csKey = s.conditionSlider.key;
      const _csLabel = s.conditionSlider.label || 'Condition';
      const _csVal = wizard.data[_csKey] || 7;
      const csDiv = document.createElement('div');
      csDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.75rem 0.85rem;margin-bottom:0.75rem';
      csDiv.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">'
        + '<span style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">' + _csLabel + '</span>'
        + '<span id="cs-val" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--accent);font-weight:700">' + _csVal + '</span></div>'
        + '<input type="range" min="1" max="10" value="' + _csVal + '" style="width:100%;accent-color:var(--accent)"'
        + ' oninput="wizard.data[\'' + _csKey + '\']=parseInt(this.value);document.getElementById(\'cs-val\').textContent=this.value">'
        + '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div>';
      wrap.appendChild(csDiv);
    }

    // v0.9.1242 (Brad): Est. Worth is asked BEFORE what you paid, on every
    // screen that asks both. What a thing is worth is the answer he wants
    // recorded; what he paid is history. Five screens asked these two
    // questions and three of them asked them the other way round.
    // Money field (when embedded in photo step, e.g. IS flow)
    if (s.moneyField) {
      const _mfKey = s.moneyField.key;
      const _mfLabel = s.moneyField.label || 'Est. Worth ($)';
      const _mfVal = wizard.data[_mfKey] || '';
      const mfDiv = document.createElement('div');
      mfDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.75rem';
      mfDiv.innerHTML = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.35rem">' + _mfLabel + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _mfVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data[\'' + _mfKey + '\']=this.value"></div>';
      wrap.appendChild(mfDiv);
    }

    // Price paid field (when embedded in photo step, e.g. IS flow)
    if (s.pricePaidField) {
      const _ppKey = s.pricePaidField.key;
      const _ppLabel = s.pricePaidField.label || 'What Did You Pay? ($)';
      const _ppVal = wizard.data[_ppKey] || '';
      const ppDiv = document.createElement('div');
      ppDiv.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.75rem';
      ppDiv.innerHTML = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.35rem">' + _ppLabel + '</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _ppVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data[\'' + _ppKey + '\']=this.value"></div>';
      wrap.appendChild(ppDiv);
    }

    if (s.note && s.note(wizard.data)) {
      const noteDiv = document.createElement('div');
      noteDiv.style.cssText = 'font-size:0.8rem;color:var(--accent2);margin-bottom:0.75rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px';
      noteDiv.textContent = s.note(wizard.data);
      wrap.appendChild(noteDiv);
    }

    const grid = document.createElement('div');
    grid.id = 'photo-grid';

    // Check if views use orthographic layout (have ortho property)
    const isOrtho = views.length > 0 && views[0].ortho;

    if (isOrtho) {
      // Orthographic projection: 4-col grid
      // Row 1: _ TOP _ _
      // Row 2: LEFT FRONT RIGHT BACK
      // Row 3: _ BOTTOM _ _
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;align-items:center';

      const orthoMap = {};
      views.forEach(v => { orthoMap[v.ortho] = v; });

      // Row 1: empty, TOP, empty, empty
      const makeEmpty = () => {
        const d = document.createElement('div');
        d.style.cssText = 'min-height:64px';
        return d;
      };
      grid.appendChild(makeEmpty());
      if (orthoMap.top)    grid.appendChild(makePhotoSlot(orthoMap.top.key,    orthoMap.top.label,    orthoMap.top.abbr,    s.id));
      grid.appendChild(makeEmpty());
      grid.appendChild(makeEmpty());

      // Row 2: BACK, RIGHT, FRONT, LEFT (RSV in primary/front spot)
      ['back','right','front','left'].forEach(pos => {
        if (orthoMap[pos]) grid.appendChild(makePhotoSlot(orthoMap[pos].key, orthoMap[pos].label, orthoMap[pos].abbr, s.id));
        else grid.appendChild(makeEmpty());
      });

      // Row 3: empty, BOTTOM, empty, empty
      grid.appendChild(makeEmpty());
      if (orthoMap.bottom) grid.appendChild(makePhotoSlot(orthoMap.bottom.key, orthoMap.bottom.label, orthoMap.bottom.abbr, s.id));
      grid.appendChild(makeEmpty());
      grid.appendChild(makeEmpty());

    } else {
      // Non-orthographic views (error, IS, catalog) — simple 2-col grid
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem';
      views.forEach(v => grid.appendChild(makePhotoSlot(v.key, v.label, v.abbr, s.id)));
    }

    // Re-render any previously added extra slots
    _existingExtras.sort().forEach(k => {
      const n = k.replace('EXTRA-','');
      grid.appendChild(makePhotoSlot(k, 'Extra Photo ' + n, 'EXTRA-' + n, s.id));
    });

    wrap.appendChild(grid);

    // "Add another photo" button
    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'margin-top:0.6rem;display:flex;align-items:center;gap:0.4rem;padding:0.45rem 0.9rem;border-radius:8px;border:1.5px dashed var(--border);background:none;color:var(--text-dim);cursor:pointer;font-family:var(--font-body);font-size:0.82rem;width:100%;justify-content:center;transition:all 0.15s';
    addBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add another photo';
    addBtn.onmouseover = () => { addBtn.style.borderColor = 'var(--accent)'; addBtn.style.color = 'var(--accent)'; };
    addBtn.onmouseout  = () => { addBtn.style.borderColor = 'var(--border)'; addBtn.style.color = 'var(--text-dim)'; };
    addBtn.onclick = () => {
      // Ask for a label first so the photo is meaningfully named
      const _extraPrompt = document.createElement('div');
      _extraPrompt.style.cssText = 'margin-top:0.5rem;display:flex;gap:0.4rem;align-items:center';
      _extraPrompt.innerHTML = `
        <input id="extra-photo-title" type="text" maxlength="40"
          placeholder='e.g. "Torn page", "Scratch", "Detail"'
          style="flex:1;padding:0.4rem 0.65rem;border-radius:7px;border:1.5px solid var(--accent);
          background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.82rem;outline:none">
        <button id="extra-photo-go" style="padding:0.4rem 0.8rem;border-radius:7px;border:none;
          background:#1e3a5f;color:white;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;
          white-space:nowrap">Add Photo</button>
        <button id="extra-photo-cancel" style="padding:0.4rem 0.6rem;border-radius:7px;border:1px solid var(--border);
          background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">✕</button>`;

      // Replace button with inline form
      addBtn.style.display = 'none';
      addBtn.parentNode.insertBefore(_extraPrompt, addBtn.nextSibling);

      const titleInp = document.getElementById('extra-photo-title');
      const goBtn    = document.getElementById('extra-photo-go');
      const cancelBtn = document.getElementById('extra-photo-cancel');

      titleInp.focus();

      const doAdd = () => {
        const title = titleInp.value.trim() || ('Extra ' + (_extraCount.val + 1));
        _extraCount.val++;
        // Build file-safe key: EXTRA-N-title (spaces→underscore, strip special chars)
        const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/ +/g,'_').substring(0, 30);
        const key = 'EXTRA-' + _extraCount.val + (safeTitle ? '-' + safeTitle : '');
        _extraPrompt.remove();
        addBtn.style.display = '';
        grid.appendChild(makePhotoSlot(key, title, title, s.id));
        // Immediately open the photo source picker (camera/upload) after adding the slot
        setTimeout(() => {
          showPhotoSourcePicker(s.id, key);
        }, 100);
      };

      goBtn.onclick = doAdd;
      cancelBtn.onclick = () => { _extraPrompt.remove(); addBtn.style.display = ''; };
      titleInp.onkeydown = e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') cancelBtn.onclick(); };
    };
    wrap.appendChild(addBtn);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.4rem';
    hint.textContent = 'Optional — press Next to skip any views';
    wrap.appendChild(hint);

    body.appendChild(wrap);

    // ── Photos this item ALREADY has (v0.9.1029, Brad) ──────────────────
    // Editing an item that already has a Right Side View used to show empty
    // slots, as if nothing had ever been photographed. The existing Drive
    // folder link rides on the step data (quick-entry edit sets it); load it,
    // match each photo to its slot by the VIEW tag in the filename (our
    // naming standard puts the view LAST), and show it in place. Tapping a
    // filled slot still opens the picker, so replacing a photo is one tap.
    (function () {
      var _exLink = stored && stored.existing;
      if (!_exLink || typeof driveGetFolderPhotos !== 'function') return;
      driveGetFolderPhotos(_exLink).then(function (photos) {
        if (!photos || !photos.length) return;
        photos.forEach(function (p) {
          var stem = String(p.name || '').replace(/\.[^.]+$/, '').trim().toUpperCase();
          if (!stem) return;
          var tag = stem.split(/\s+/).pop();               // view tag is last
          var zone = body.querySelector('.photo-drop-zone[data-view="' + tag + '"][data-sid="' + s.id + '"]');
          if (!zone || zone.dataset.hasShot === '1') return;
          zone.dataset.hasShot = '1';
          zone.style.borderColor = 'var(--accent2)';
          zone.style.background = 'rgba(201,146,42,0.08)';
          var img = document.createElement('img');
          img.loading = 'lazy';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.85';
          zone.insertBefore(img, zone.firstChild);
          var tagEl = document.createElement('div');
          tagEl.textContent = 'On file — tap to replace';
          tagEl.style.cssText = 'position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.62);color:#fff;font-size:0.55rem;padding:2px 3px;text-align:center;line-height:1.15';
          zone.appendChild(tagEl);
          try { if (typeof loadDriveThumb === 'function') loadDriveThumb(p.id, img, zone, p.thumbnailLink || null, 'lo'); } catch (e) {}
        });
      }).catch(function (e) { console.warn('[wizard existing photos]', e); });
    })();

    // v0.9.811 (TODO-011): the identify flow captured a photo of the ITEM —
    // drop it into the Item slot automatically (manual flow PHOTO-1, or the
    // first view of the item photos step). Same pattern as the box shot below.
    if (wizard.data._idItemPhotoFile) {
      var _idTargetView = (s.id === 'manualPhotos') ? 'PHOTO-1' : ((s.id === 'photosItem' && views && views.length) ? views[0].key : null);
      if (_idTargetView && typeof uploadWizardPhoto === 'function') {
        var _idF = wizard.data._idItemPhotoFile;
        delete wizard.data._idItemPhotoFile;
        setTimeout(function () {
          try {
            var _idUp = uploadWizardPhoto(_idF, s.id, _idTargetView);
            if (_idUp && _idUp.catch) _idUp.catch(function (eU2) { showToast && showToast('Photo attach failed: ' + (eU2 && eU2.message || 'upload error') + ' — add it manually below', 4500, true); });
            showToast && showToast('\u{1F4F7} The photo you identified it from was added as the Item photo', 3200);
          } catch (eIP) { showToast && showToast('Photo attach failed — add it manually below', 4000, true); }
        }, 400);
      }
    }

    // v0.9.665: the identify flow captured a box/label photo — drop it into the
    // Box slot automatically (manual flow PHOTO-2, or the first Box view).
    if (wizard.data._biBoxPhotoFile) {
      var _biTargetView = (s.id === 'manualPhotos') ? 'PHOTO-2' : ((s.label === 'Box' && views && views.length) ? views[0].key : null);
      if (_biTargetView && typeof uploadWizardPhoto === 'function') {
        var _biF = wizard.data._biBoxPhotoFile;
        delete wizard.data._biBoxPhotoFile;
        setTimeout(function () {
          try {
            var _biUp = uploadWizardPhoto(_biF, s.id, _biTargetView);
            if (_biUp && _biUp.catch) _biUp.catch(function (eU) { showToast && showToast('Box photo attach failed: ' + (eU && eU.message || 'upload error') + ' — add it manually below', 4500, true); });
            showToast && showToast('📦 Your label shot was added as the Box photo', 3000);
          } catch (eBP) { showToast && showToast('Box photo attach failed — add it manually below', 4000, true); }
        }, 400);
      }
    }

  } else if (s.type === 'textarea') {
    const val = wizard.data[s.id] || '';
    // Use step-specific placeholder or fall back to a helpful default for notes
    const _notesPlaceholder = s.id === 'notes'
      ? 'e.g. Purchased at train show, minor rust on trucks, runs well'
      : (s.placeholder || '');
    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <textarea id="wiz-input" placeholder="Optional notes…"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
          padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;
          outline:none;resize:vertical;min-height:100px"
          oninput="wizard.data['${s.id}']=this.value">${rrEsc(val)}</textarea>
        ${s.note && s.note(wizard.data) ? `<div style="font-size:0.8rem;color:var(--accent2);margin-top:0.6rem;padding:0.5rem 0.75rem;background:rgba(201,146,42,0.1);border-radius:6px">${s.note(wizard.data)}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">Optional — press Next to skip</div>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-input'); if(i) i.focus(); }, 50);

  } else if (s.type === 'location') {
    const val = wizard.data[s.id] || '';
    // Gather unique locations from existing personal data for autocomplete
    const _allLocs = {};
    Object.values(state.personalData).forEach(pd => {
      if (pd.location && pd.location.trim()) {
        const loc = pd.location.trim();
        _allLocs[loc] = (_allLocs[loc] || 0) + 1;
      }
    });
    // Sort by frequency (most used first), then alphabetically
    const _locList = Object.entries(_allLocs)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(e => e[0]);
    const _savedLocs = (typeof _getSavedLocations === 'function') ? _getSavedLocations() : [];

    body.innerHTML = `
      <div style="padding-top:0.75rem">
        <div style="position:relative">
          <input type="text" id="wiz-loc-input" value="${val.replace(/"/g, '&quot;')}"
            placeholder="${s.placeholder || 'e.g. Shelf 3, Tote 12'}"
            autocomplete="off"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:0.95rem;
            outline:none;box-sizing:border-box"
            oninput="wizard.data['${s.id}']=this.value; _filterLocSuggestions(this.value);">
          <div id="wiz-loc-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;
            background:var(--surface2);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;
            max-height:180px;overflow-y:auto;z-index:10"></div>
        </div>
        ${_savedLocs.length > 0 ? `
          <div style="margin-top:0.6rem">
            <div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.35rem">Your locations</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.35rem">
              ${_savedLocs.map(loc => `
                <button type="button" class="loc-chip" onclick="document.getElementById('wiz-loc-input').value='${(loc.name||'').replace(/'/g, "\\'")}'; wizard.data['${s.id}']='${(loc.name||'').replace(/'/g, "\\'")}'; _highlightLocChip(this);"
                  style="padding:0.35rem 0.7rem;border-radius:16px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.82rem;cursor:pointer;font-family:var(--font-body)${val === loc.name ? ';background:var(--accent);color:var(--on-accent);border-color:var(--accent)' : ''}">${loc.name}${loc.type ? ` <span style="font-size:0.68rem;color:var(--text-dim)">${loc.type}</span>` : ''}</button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${(_savedLocs.length === 0 && _locList.length > 0) ? `
          <div style="margin-top:0.6rem">
            <div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.35rem">Recent locations</div>
            <div id="wiz-loc-chips" style="display:flex;flex-wrap:wrap;gap:0.35rem">
              ${_locList.slice(0, 12).map(loc => `
                <button type="button" class="loc-chip" onclick="document.getElementById('wiz-loc-input').value='${loc.replace(/'/g, "\\'")}'; wizard.data['${s.id}']='${loc.replace(/'/g, "\\'")}'; _highlightLocChip(this);"
                  style="padding:0.35rem 0.7rem;border-radius:16px;border:1px solid var(--border);
                  background:var(--surface2);color:var(--text);font-size:0.82rem;cursor:pointer;
                  font-family:var(--font-body);transition:all 0.15s ease${val === loc ? ';background:var(--accent);color:var(--on-accent);border-color:var(--accent)' : ''}">${loc} <span style="font-size:0.7rem;color:var(--text-dim);margin-left:0.15rem">(${_allLocs[loc]})</span></button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.6rem">Optional — press Next to skip</div>
        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;padding:0.6rem 0.75rem;
          background:var(--surface2);border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:0.82rem;color:var(--text-mid)">
          <input type="checkbox" id="wiz-loc-toggle" ${_prefLocEnabled ? 'checked' : ''}
            onchange="_prefLocEnabled = this.checked; localStorage.setItem('lv_location_enabled', this.checked ? 'true' : 'false')"
            style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer">
          Ask for storage location on future items
        </label>
      </div>`;
    setTimeout(() => { const i = document.getElementById('wiz-loc-input'); if(i) i.focus(); }, 50);

  } else if (s.type === 'pickSoldItem') {
    const itemNum = (wizard.data.itemNum || '').trim();
    // Bugfix 2026-04-14: dedupe — was showing same item twice when the
    // collection row AND a companion (box/for-sale) row both matched.
    // v0.9.920: dedupe by PHYSICAL COPY (inventoryId), not itemNum|variation —
    // the old rule also hid genuine second copies, so you couldn't pick which
    // copy to sell. Phantom companion rows share the parent's inventoryId (Bug
    // 14) so they still collapse; rows without an inventoryId keep the old
    // itemNum|variation behavior (no regression on legacy data).
    const _seenSold = new Set();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      // v0.9.923: shared matcher — agrees with save-time findPD (normalized + -P/-D)
      if (!(pd.owned && pdItemNumMatches(pd, itemNum))) return false;
      // Skip box-only rows (their itemNum ends in -BOX) — they're not sellable as main item
      if (String(pd.itemNum || '').endsWith('-BOX')) return false;
      const dk = pd.inventoryId || (pd.itemNum + '|' + (pd.variation || ''));
      if (_seenSold.has(dk)) return false;
      _seenSold.add(dk);
      return true;
    });
      const selected = wizard.data.selectedSoldKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.length === 0 ? '<div style="color:var(--text-dim);font-size:0.85rem">No owned items found for this number.</div>' : ''}
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const isSelected = selected === k;
          return `<button onclick="wizardPickSoldItem('${k}')" style="
            display:flex;align-items:flex-start;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
            background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem;font-weight:600">
                ${pd.itemNum}${pd.variation ? ' — Var ' + pd.variation : ''}
              </div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.3rem;display:flex;gap:1rem;flex-wrap:wrap">
                ${pd.inventoryId ? `<span style="font-family:var(--font-mono);color:var(--text-dim)">Inv #${pd.inventoryId}</span>` : ''}
                ${pd.condition ? `<span>Condition: <strong style="color:var(--text)">${pd.condition}</strong></span>` : ''}
                ${pd.hasBox === 'Yes' ? `<span style="color:var(--green)">✓ Has box</span>` : ''}
                ${pd.priceItem ? `<span>Paid: <strong style="color:var(--text)">$${parseFloat(pd.priceItem).toLocaleString()}</strong></span>` : ''}
                ${pd.allOriginal === 'Yes' ? `<span style="color:var(--accent2)">All original</span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent);font-size:1.1rem;align-self:center">✓</span>' : ''}
          </button>`;
        }).join('')}
        <button onclick="wizardPickSoldItem('__new__')" style="
          padding:0.75rem 1rem;border-radius:10px;text-align:left;width:100%;cursor:pointer;
          font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s;
          border:2px solid ${selected==='__new__' ? 'var(--border)' : 'var(--border)'};
          background:var(--surface2);color:var(--text-dim);
        ">Not in my collection — enter details manually</button>
      </div>`;

  } else if (s.type === 'pickForSaleItem') {
    const itemNum = (wizard.data.itemNum || '').trim();
    // Bugfix 2026-04-14: dedupe — same fix as pickSoldItem.
    // v0.9.920: per-copy dedupe by inventoryId (see pickSoldItem note above).
    const _seenFs = new Set();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      // v0.9.923: shared matcher — agrees with save-time findPD (normalized + -P/-D)
      if (!(pd.owned && pdItemNumMatches(pd, itemNum))) return false;
      if (String(pd.itemNum || '').endsWith('-BOX')) return false;
      const dk = pd.inventoryId || (pd.itemNum + '|' + (pd.variation || ''));
      if (_seenFs.has(dk)) return false;
      _seenFs.add(dk);
      return true;
    });
    const selected = wizard.data.selectedForSaleKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.length === 0 ? '<div style="color:var(--text-dim);font-size:0.85rem">No owned items found for this number.</div>' : ''}
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const isSelected = selected === k;
          return `<button onclick="wizardPickForSaleItem('${k}')" style="
            display:flex;align-items:flex-start;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? '#e67e22' : 'var(--border)'};
            background:${isSelected ? 'rgba(230,126,34,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem;font-weight:600">
                ${pd.itemNum}${pd.variation ? ' — Var ' + pd.variation : ''}
              </div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.3rem;display:flex;gap:1rem;flex-wrap:wrap">
                ${pd.inventoryId ? `<span style="font-family:var(--font-mono);color:var(--text-dim)">Inv #${pd.inventoryId}</span>` : ''}
                ${pd.condition ? `<span>Condition: <strong style="color:var(--text)">${pd.condition}</strong></span>` : ''}
                ${pd.hasBox === 'Yes' ? `<span style="color:var(--green)">✓ Has box</span>` : ''}
                ${pd.priceItem ? `<span>Paid: <strong style="color:var(--text)">$${parseFloat(pd.priceItem).toLocaleString()}</strong></span>` : ''}
                ${pd.userEstWorth ? `<span>Est. Worth: <strong style="color:var(--text)">$${parseFloat(pd.userEstWorth).toLocaleString()}</strong></span>` : ''}
              </div>
            </div>
            ${isSelected ? '<span style="color:#e67e22;font-size:1.1rem;align-self:center">✓</span>' : ''}
          </button>`;
        }).join('')}
        <button onclick="wizardPickForSaleItem('__new__')" style="
          padding:0.75rem 1rem;border-radius:10px;text-align:left;width:100%;cursor:pointer;
          font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s;
          border:2px solid var(--border);
          background:var(--surface2);color:var(--text-dim);
        ">Not in my collection — enter details manually</button>
      </div>`;

  } else if (s.type === 'pickRow') {
    const itemNum = (wizard.data.itemNum || '').trim();
    const matchKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      // v0.9.924: shared matcher — consistent with the sold/for-sale pickers
      // (normalized + -P/-D bridging); raw === missed '210' vs stored '210-P'.
      return pdItemNumMatches(pd, itemNum);
    });
    const selected = wizard.data.selectedRowKey || '';
    body.innerHTML = `
      <div style="padding-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem">
        ${matchKeys.map(k => {
          const pd = state.personalData[k];
          const hasBoxAlready = pd.hasBox === 'Yes';
          const isSelected = selected === k;
          return `<button onclick="wizardPickRow('${k}')" style="
            display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;
            border-radius:10px;text-align:left;width:100%;cursor:pointer;
            font-family:var(--font-body);transition:all 0.15s;
            border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
            background:${isSelected ? 'rgba(232,64,28,0.12)' : 'var(--surface2)'};
          ">
            <div style="flex:1">
              <div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.85rem">${pd.itemNum} ${pd.variation ? '— Var ' + pd.variation : ''}</div>
              <div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.2rem">
                Condition: ${pd.condition || '—'} · 
                ${hasBoxAlready
                  ? '<span style="color:var(--accent2)">Already has a box — will add new row</span>'
                  : '<span style="color:var(--green)">No box yet — will update this row</span>'}
              </div>
            </div>
            ${isSelected ? '<span style="color:var(--accent);font-size:1rem">✓</span>' : ''}
          </button>`;
        }).join('')}
      </div>`;

  } else if (s.type === 'itemNumGrouping') {
    // ── SCREEN 1: Item Number + Grouping Buttons ──
    const _ingVal = wizard.data.itemNum || '';
    const _ingGrouping = wizard.data._itemGrouping || '';
    const _ingBoxOnly = wizard.data.boxOnly || false;
    const _ingPreFilled = !!wizard.data._fillItemMode && !!wizard.matchedItem && !!_ingVal;
    
    const _ingWrap = document.createElement('div');
    _ingWrap.style.cssText = 'padding-top:0.5rem';
    
    if (_ingPreFilled) {
      // Item already known from Browse — show compact header + grouping buttons only
      const _mi = wizard.matchedItem;
      const _hdr = document.createElement('div');
      _hdr.style.cssText = 'background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;padding:0.85rem 1rem;margin-bottom:0.75rem';
      _hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);letter-spacing:0.03em;font-weight:700">No. ' + _ingVal + '</div>'
        + '<div style="font-size:0.82rem;color:var(--text-mid);margin-top:0.15rem">' + (_mi.roadName || _typeLabel(_mi) || '') + ((_mi.roadName || _typeLabel(_mi)) && _mi.description ? ' — ' : '') + (_mi.description || '') + '</div>';
      _ingWrap.appendChild(_hdr);
      
      const _prompt = document.createElement('div');
      _prompt.style.cssText = 'font-size:0.85rem;color:var(--text);font-weight:600;margin-bottom:0.5rem';
      _prompt.textContent = 'How are you adding this item?';
      _ingWrap.appendChild(_prompt);
    } else {
      // ── Type + Road filter dropdowns (above the search input) ──
      // All config-driven per item-search-filters-config.js. Only rendered
      // for tabs in applyToTabs (collection / want), only if distinct
      // values in current era master data meet showOnlyIfAtLeast threshold.
      const _isfCfg = window.ITEM_SEARCH_FILTERS || {};
      const _isfUi  = _isfCfg.ui || {};
      const _isfSz  = _isfCfg.sizing || {};
      // Phase 2b streamline: Type/Road filter dropdowns disabled — they
      // don't help when adding (user has item in hand, knows the number).
      // The setTimeout wiring below silently no-ops when dropdowns aren't rendered.
      const _isfApply = false;
      // Small local escape — wizard.js does not ship a global one.
      function _esc(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }
      if (_isfApply && typeof getMasterDistinct === 'function') {
        // Session 119: 22 clean tier-1 buckets (matches browse Phase C).
        var _isfTypes = ((typeof _bucketsInCurrentEra === 'function') ? _bucketsInCurrentEra() : (window.TYPE_BUCKETS || []).map(function(b){ return b.label; }));
        var _isfRoads = getMasterDistinct('roadName');
        var _isfMin = _isfCfg.showOnlyIfAtLeast || 2;
        var _isfShowType = _isfTypes.length >= _isfMin;
        var _isfShowRoad = _isfRoads.length >= _isfMin;
        if (_isfShowType || _isfShowRoad) {
          var _isfFilterBar = document.createElement('div');
          _isfFilterBar.style.cssText =
            'display:flex;gap:' + (_isfSz.gapPx || 8) + 'px;margin-bottom:0.5rem;flex-wrap:wrap';
          var _mkDrop = function(fieldId, label, values, currentVal) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'flex:1;min-width:130px';
            var opts = '<option value="">' + _esc(_isfUi.anyLabel || '(any)') + '</option>' +
              values.map(function(v) {
                var sel = v === currentVal ? ' selected' : '';
                return '<option value="' + _esc(v) + '"' + sel + '>' + _esc(v) + '</option>';
              }).join('');
            wrap.innerHTML =
              '<div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:0.2rem;' +
                'letter-spacing:0.06em;text-transform:uppercase;font-weight:600">' + _esc(label) + '</div>' +
              '<select id="' + fieldId + '" style="' +
                'width:100%;padding:0.5rem 0.65rem;font-size:' + (_isfSz.fontPx || 14) + 'px;' +
                'background:var(--surface2);color:var(--text);border:1px solid var(--border);' +
                'border-radius:8px;min-height:' + (_isfSz.minHeightPx || 44) + 'px' +
              '">' + opts + '</select>';
            return wrap;
          };
          if (_isfShowType) {
            _isfFilterBar.appendChild(_mkDrop(
              'wiz-search-type', _isfUi.typeLabel || 'Type',
              _isfTypes, wizard.data._searchFilterType || ''));
          }
          if (_isfShowRoad) {
            _isfFilterBar.appendChild(_mkDrop(
              'wiz-search-road', _isfUi.roadLabel || 'Road name',
              _isfRoads, wizard.data._searchFilterRoad || ''));
          }
          _ingWrap.appendChild(_isfFilterBar);
          if (_isfUi.hint) {
            var _isfHint = document.createElement('div');
            _isfHint.style.cssText = 'font-size:0.72rem;color:var(--text-dim);margin-bottom:0.55rem;font-style:italic';
            _isfHint.textContent = _isfUi.hint;
            _ingWrap.appendChild(_isfHint);
          }
        }
      }

      // Normal entry — show item number input + inline "Box Only" checkbox
      // (Session 115: checkbox moved here so it lives next to the input
      // instead of as a separate card below the Found banner. Checking it
      // BEFORE picking a suggestion routes to the box-only flow; leaving
      // it unchecked lets the suggestion tap auto-advance as before.)
      const _ingInputRow = document.createElement('div');
      _ingInputRow.style.cssText = 'display:flex;gap:0.5rem;align-items:flex-start';
      _ingInputRow.innerHTML = `
        <div style="flex:1;min-width:0">
          <input type="text" id="wiz-input" value="${_ingVal}" placeholder="e.g. 726, 2046, 6464-1"
            autocomplete="off"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;
            padding:0.75rem 1rem;color:var(--text);font-family:var(--font-body);font-size:1rem;outline:none;box-sizing:border-box"
            oninput="wizard.data.itemNum=this.value; debouncedItemSuggestions(this.value); _updateGroupingButtons();"
            onkeydown="handleSuggestionKey(event)">
        </div>
        <label onclick="toggleBoxOnly()" data-box-only-checkbox="1" style="
          display:flex;align-items:center;gap:0.45rem;flex-shrink:0;
          padding:0.75rem 0.7rem;border-radius:8px;cursor:pointer;transition:all 0.15s;
          border:2px solid ${_ingBoxOnly ? 'var(--accent2)' : 'var(--border)'};
          background:${_ingBoxOnly ? 'rgba(201,146,42,0.1)' : 'var(--surface2)'};
        ">
          <div style="
            width:18px;height:18px;border-radius:4px;flex-shrink:0;
            border:2px solid ${_ingBoxOnly ? 'var(--accent2)' : 'var(--border)'};
            background:${_ingBoxOnly ? 'var(--accent2)' : 'transparent'};
            display:flex;align-items:center;justify-content:center;
            font-size:0.7rem;color:white;font-weight:700;
          ">${_ingBoxOnly ? '&#10003;' : ''}</div>
          <span style="font-size:0.82rem;font-weight:600;white-space:nowrap;color:${_ingBoxOnly ? 'var(--accent2)' : 'var(--text-mid)'}">Box Only</span>
        </label>`;
      // Session 176: Manufacturer / Era / Type filter bar above the search box.
      // v0.9.716 (Brad): the WANT flow uses this same itemNumGrouping screen
      // (Session 161+) — v715 patched the old text-step path that want no
      // longer renders. Gate widened so want gets the bar (+Scale) here.
      if ((wizard.tab === 'collection' || wizard.tab === 'want') && typeof _buildItemSearchFiltersDOM === 'function') {
        try { var _ingFilters = _buildItemSearchFiltersDOM(); if (_ingFilters) _ingWrap.appendChild(_ingFilters); } catch(e) { console.warn('[add filters]', e); }
      }
      _ingWrap.appendChild(_ingInputRow);

      // v0.9.1037 (Brad: "the picker is cut off on the right side"). The
      // suggestion list used to live INSIDE the input's column, which shares
      // the row with the Box Only checkbox — so on a phone it only got about
      // 58% of the width and every row was clipped mid-word, taking the
      // "View on ..." link with it. It is a full-width row of its own now,
      // below the input, the same as on every other step.
      const _ingSug = document.createElement('div');
      _ingSug.id = 'wiz-suggestions';
      _ingSug.style.cssText = 'display:none;flex-direction:column;gap:1px;margin-top:4px;width:100%;max-height:340px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:4px;-webkit-overflow-scrolling:touch';
      _ingWrap.appendChild(_ingSug);

      // Match display
      const _ingMatchDiv = document.createElement('div');
      _ingMatchDiv.id = 'wiz-match';
      _ingMatchDiv.style.cssText = 'margin-top:0.5rem';
      _ingWrap.appendChild(_ingMatchDiv);
    }
    
    // Grouping buttons container (populated dynamically)
    const _ingGroupDiv = document.createElement('div');
    _ingGroupDiv.id = 'wiz-grouping-btns';
    _ingGroupDiv.style.cssText = 'margin-top:0.75rem;display:none';
    _ingWrap.appendChild(_ingGroupDiv);
    
    // Identify by photo button (only when entering manually).
    // v0.9.1038 (Brad): on phones it lives in the footer instead — see
    // #wizard-idphoto-btn — so this full-width block is desktop-only there.
    if (!_ingPreFilled && !window.IS_MOBILE_UA) {
      const _ingPhotoBtn = document.createElement('button');
      _ingPhotoBtn.onclick = function() { if (typeof _wizScanBarcode === 'function') _wizScanBarcode(); else openIdentify('wizard'); };
      _ingPhotoBtn.style.cssText = 'width:100%;margin-top:0.6rem;padding:0.65rem 1rem;border-radius:8px;border:1.5px dashed #2980b9;background:rgba(41,128,185,0.08);color:#2980b9;font-family:var(--font-head);font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.15s';
      _ingPhotoBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 0 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Don\x27t know the number? Identify by photo';
      _ingWrap.appendChild(_ingPhotoBtn);

      // v0.9.674 (Brad): ONE identify button — the yellow wording with the blue
      // styling, pointing at the unified Identify-from-Photo flow (which offers
      // gallery pick on desktop and Lens/AI fallbacks). Old second button +
      // desktop note removed.
      // v0.9.993 (Brad): the "Adding something else?" chip row is retired —
      // the ITEM TYPE dropdown at the top of the modal (wizard-kind-bar,
      // synced in renderWizardStep) is now the one place to switch flows.
    }
    
    body.innerHTML = '';
    body.appendChild(_ingWrap);
    
    setTimeout(function() {
      if (!_ingPreFilled) {
        var inp = document.getElementById('wiz-input');
        if (inp) {
          // v0.9.669 (Brad): no auto-keyboard on phones — it buried the
          // Identify-by-Photo button. Wiring stays; only the focus is gated.
          if (!window.IS_MOBILE_UA) inp.focus();
          inp.addEventListener('input', debounceItemLookup);
          if (inp.value) { updateItemSuggestions(inp.value); }
        }
        // Wire Type + Road filter dropdowns. Each change:
        //   1. Persists its choice on wizard.data
        //   2. Repopulates the OTHER dropdown so only values that exist in
        //      combination with the current selection appear (e.g. pick
        //      Type=Caboose → Road list narrows to roads that have cabooses).
        //   3. If the other dropdown's previously-selected value is no
        //      longer available, it's silently cleared (state too).
        //   4. Refreshes the suggestion list.
        //
        // Helper below is defined once and reused for both directions.
        // NOTE: _isfUi and the _esc helper from the render block live in
        // a DIFFERENT scope than this setTimeout callback. Read config
        // directly from window.ITEM_SEARCH_FILTERS and use a local _esc.
        // Session 176: wire the Manufacturer / Era / Type filter dropdowns via
        // the shared helper (handles Era + auto-Modern). Replaces the old
        // inline Type/Road-only wiring so the new dropdowns work + no double-bind.
        if (typeof _wireItemSearchFilters === 'function') _wireItemSearchFilters();
      } else {
        // Override title for pre-filled items
        var _tEl = document.getElementById('wizard-title');
        if (_tEl) _tEl.textContent = 'Add to Collection';
      }
      _updateGroupingButtons();
    }, 50);

  } else if (s.type === 'itemPicker') {
    // ── SCREEN 1b: Partial match picker ──
    const _matches = wizard.data._partialMatches || [];
    const _query = wizard.data._partialQuery || '';
    const _wrap = document.createElement('div');
    _wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;padding-top:0.25rem';

    const _info = document.createElement('div');
    _info.style.cssText = 'font-size:0.82rem;color:var(--text-dim);margin-bottom:0.4rem';
    _info.textContent = _matches.length + ' item' + (_matches.length !== 1 ? 's' : '') + ' matching "' + _query + '" — tap to select';
    _wrap.appendChild(_info);

    const _list = document.createElement('div');
    _list.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

    _matches.forEach(function(m) {
      const desc = m.description || m.roadName || '';
      const road = m.roadName || '';
      const sub = (road && desc && road !== desc) ? road + ' — ' + desc : (desc || road);
      const btn = document.createElement('button');
      btn.style.cssText = 'text-align:left;width:100%;padding:0.7rem 0.9rem;border:2px solid var(--border);background:var(--surface2);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;flex-direction:column;gap:0.15rem;transition:all 0.12s';
      btn.innerHTML = '<div style="font-family:var(--font-mono);font-weight:700;font-size:0.95rem;color:var(--accent2)">' + m.itemNum + '</div>'
        + (sub ? '<div style="font-size:0.78rem;color:var(--text-dim);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sub + '</div>' : '');
      btn.onclick = function() {
        wizard.data.itemNum = m.itemNum;
        wizard.data._partialMatches = [];
        wizard.matchedItem = m;
        // Go back to itemNumGrouping with the selected number filled in
        wizard.step = wizard.step - 1;
        renderWizardStep();
      };
      _list.appendChild(btn);
    });
    _wrap.appendChild(_list);
    body.innerHTML = '';
    body.appendChild(_wrap);

  } else if (s.type === 'conditionDetails') {
    // ── SCREEN 3: Multi-column Condition & Details ──
    const _cdGrouping = wizard.data._itemGrouping || 'single';
    const _cdItemNum = (wizard.data.itemNum || '').trim();

    // Detect item type for field hiding
    // _cdIsSimplified = Science/Construction: hide IS, Master Box, Error (keep All Original, Has Box)
    // _cdIsPaperLike = Catalog/Paper/IS/Other/Service: hide ALL toggles (All Original, Has Box, IS, Master Box, Error)
    // v0.9.1034: preference-aware fallback — a bare findMaster() here took
    // the first row for the number, which is how the Atlas hopper turned up
    // on a Lionel item.
    const _cdMaster = wizard.matchedItem || findMaster(_cdItemNum, '', _wizMasterPrefer()) || findMaster(_cdItemNum);
    const _cdItemType = (_cdMaster && _cdMaster.itemType) ? _cdMaster.itemType : '';
    const _cdMasterTab = (_cdMaster && _cdMaster._tab) ? _cdMaster._tab : '';
    const _cdIsSimplified = ['Science Set','Construction Set'].includes(_cdItemType);
    const _cdIsPaperLike = ['Catalog','Instruction Sheet'].includes(_cdItemType)
      || [SHEET_TABS.paper, SHEET_TABS.other, SHEET_TABS.serviceTools].includes(_cdMasterTab)
      || _cdItemType.toLowerCase().includes('paper') || _cdItemType.toLowerCase().includes('catalog');
    const _cdHideToggles = _cdIsSimplified || _cdIsPaperLike;

    // Pre-populate defaults from preferences (only if not already set)
    // Skip defaults for fields that will be hidden to prevent them leaking to confirm screen
    const _defAllOrig  = _prefGet('lv_def_allOriginal', 'Yes');
    const _defHasBox   = _prefGet('lv_def_hasBox',      'No');
    const _defHasIS    = _prefGet('lv_def_hasIS',       'No');
    const _defIsError  = _prefGet('lv_def_isError',     'No');
    const _defMasterBox = _prefGet('lv_def_masterBox',  'No');
    // In set mode, only pre-populate main item (no tender/unit2/unit3)
    // For regular items, only pre-populate prefixes that match the grouping
    // Item subjects (prefixes) — single source of truth (Decision Map #3, getItemSubjects in app.js).
    let _allPrefixes = (typeof getItemSubjects === 'function')
      ? getItemSubjects(wizard.data).map(function (s) { return s.prefix; })
      : [''];
    if (!_cdIsPaperLike) {
      _allPrefixes.forEach(function(p) {
        const origKey  = p ? p + 'AllOriginal' : 'allOriginal';
        const boxKey   = p ? p + 'HasBox'      : 'hasBox';
        const errKey   = p ? p + 'IsError'     : 'isError';
        if (!_cdIsSimplified) {
          if (!wizard.data[origKey]) wizard.data[origKey] = _defAllOrig;
          if (!wizard.data[boxKey])  wizard.data[boxKey]  = _defHasBox;
        } else {
          // Simplified (Science/Construction): keep allOriginal + hasBox, skip error
          if (!wizard.data[origKey]) wizard.data[origKey] = _defAllOrig;
          if (!wizard.data[boxKey])  wizard.data[boxKey]  = _defHasBox;
        }
        if (!wizard.data._setMode && !_cdHideToggles && !wizard.data[errKey]) wizard.data[errKey] = _defIsError;
      });
      if (!_cdHideToggles && !wizard.data.hasIS) wizard.data.hasIS = _defHasIS;
      if (!_cdHideToggles && !wizard.data._setMode && !wizard.data.hasMasterBox) wizard.data.hasMasterBox = _defMasterBox;
    }

    // Determine columns
    // Bugfix 2026-04-14: include the master description on each column so users
    // can visually verify the item after a barcode scan (where they only see the #).
    const _cdMainDesc = _composeRoadDesc(_cdMaster);
    const _cdCols = [];
    if (_cdGrouping === 'engine_tender') {
      const _tenders = getMatchingTenders(_cdItemNum);
      const _tenderNum = wizard.data.tenderMatch || (_tenders.length > 0 ? _tenders[0] : '');
      _cdCols.push({ id: 'main', label: '\u{1F682} No. ' + _cdItemNum, prefix: '', isEngine: true, description: _cdMainDesc });
      // Session 159: tender column shows picker UI until user confirms.
      const _tConf = !!wizard.data._tenderConfirmed;
      const _tCandidates = window.getTenderCandidates ?
        window.getTenderCandidates(_cdItemNum, wizard.data.variation) : [];
      _cdCols.push({
        id: 'tender', prefix: 'tender', isTender: true,
        label: _tConf
          ? ('\u{1F4E6} Tender: ' + (wizard.data.tenderMatch === 'Unknown' ? 'Unknown' : _tenderNum))
          : '\u{1F4E6} Tender',
        pickerMode: !_tConf,
        candidates: _tCandidates,
      });
    } else if (_cdGrouping === 'aa') {
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit2', sublabel: 'Dummy' });
    } else if (_cdGrouping === 'ab') {
      const _bUnit = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit, prefix: 'unit2' });
    } else if (_cdGrouping === 'aba') {
      const _bUnit2 = getSetPartner(_cdItemNum) || (_cdItemNum + 'C');
      _cdCols.push({ id: 'main', label: '\u{1F535} A Unit: ' + _cdItemNum + '-P', prefix: '', sublabel: 'Powered', description: _cdMainDesc });
      _cdCols.push({ id: 'unit2', label: '\u{1F535} B Unit: ' + _bUnit2, prefix: 'unit2' });
      _cdCols.push({ id: 'unit3', label: '\u{1F535} A Unit: ' + _cdItemNum + '-D', prefix: 'unit3', sublabel: 'Dummy' });
    } else {
      // Single item
      _cdCols.push({ id: 'main', label: 'No. ' + _cdItemNum, prefix: '', description: _cdMainDesc });
    }
    
    const _colCount = _cdCols.length;
    // v0.9.1232: one item, wide screen -> its fields run in two columns instead
    // of one tall stack. Multi-unit adds already use the width for their units
    // and must not also split each unit in half.
    const _cd2up = _colCount === 1 && _wizWide();
    const _isMobile = window.innerWidth < 600;
    
    function _buildCondCol(col) {
      const p = col.prefix;
      const condKey = p ? p + 'Condition' : 'condition';
      const origKey = p ? p + 'AllOriginal' : 'allOriginal';
      const modKey = p ? p + 'NotOriginalDesc' : 'notOriginalDesc';
      const boxKey = p ? p + 'HasBox' : 'hasBox';
      const boxCondKey = p ? p + 'BoxCond' : 'boxCond';
      
      const condVal = wizard.data[condKey] || 7;
      const origVal = wizard.data[origKey] || '';
      const modVal = wizard.data[modKey] || '';
      const boxVal = wizard.data[boxKey] || '';
      const boxCondVal = wizard.data[boxCondKey] || 7;

      // Compact button builder: tiny inline Yes/No or Yes/No/Unk
      const _smallBtn = (dataKey, val, choices, toggleFn) => {
        let h = '<div style="display:flex;gap:2px;flex-shrink:0">';
        choices.forEach(c => {
          const sel = val === c;
          const isErr = c === 'Yes' && dataKey.includes('Error');
          const selColor = isErr ? '#e74c3c' : 'var(--accent)';
          const selBg = isErr ? 'rgba(231,76,60,0.15)' : 'rgba(232,64,28,0.12)';
          const label = c === 'Unknown' ? 'Unk' : c;
          h += '<button onclick="' + toggleFn(c) + '" style="padding:0.2rem 0.35rem;border-radius:4px;font-size:0.65rem;cursor:pointer;border:1px solid ' + (sel ? selColor : 'var(--border)') + ';background:' + (sel ? selBg : 'var(--bg)') + ';color:' + (sel ? selColor : 'var(--text-mid)') + ';font-family:var(--font-body);line-height:1">' + label + '</button>';
        });
        h += '</div>';
        return h;
      };
      // Inline row: label left, buttons right, forced single line
      const _inlineRow = (label, buttons, mb) => {
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.3rem;margin-bottom:' + (mb || '0.35rem') + ';flex-wrap:nowrap">'
          + '<span style="font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;white-space:nowrap;flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis">' + label + '</span>'
          + buttons + '</div>';
      };
      
      let html = '<div class="cd-col' + (_cd2up ? ' cd-2up' : '') + '" style="flex:1;min-width:' + (_isMobile ? '100%' : '200px') + ';background:var(--surface2);border-radius:10px;padding:0.75rem;border:1px solid var(--border)">';
      var _cdExtLink = '';
      if (col.id === 'main' && _cdMaster && typeof window._itemExternalLinkURL === 'function') {
        var _cdU = window._itemExternalLinkURL(_cdMaster);
        if (_cdU) {
          var _cdLbl = (typeof window._externalSiteLabel === 'function') ? window._externalSiteLabel(_cdU) : 'External';
          // v0.9.1190: measured live at 89x15 with zero padding \u2014 the whole
          // clickable box was the height of the lettering, so Brad's clicks
          // landed on dead space beside it and nothing opened. Same wording,
          // now a real target (~34px tall). Palette vars only: the colour
          // ratchet does not move.
          _cdExtLink = '<div style="margin-bottom:0.35rem"><a href="' + _cdU + '" target="_blank" rel="noopener" '
            + 'style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem;color:var(--accent2);'
            + 'text-decoration:none;padding:0.45rem 0.7rem;border:1px solid var(--border);border-radius:6px;'
            + 'background:var(--bg);min-height:34px;box-sizing:border-box">View on ' + _cdLbl + ' \u2197</a></div>';
        }
      }
      html += '<div style="font-weight:700;font-size:0.82rem;color:var(--accent2);padding-bottom:0.2rem">' + col.label + (col.sublabel ? ' <span style=\"font-weight:400;color:var(--text-dim);font-size:0.75rem\">(' + col.sublabel + ')</span>' : '') + '</div>'
        + (col.description ? '<div style="font-size:0.78rem;color:var(--text-mid);font-style:italic;margin-bottom:0.35rem;line-height:1.35">' + String(col.description).replace(/</g,'&lt;') + '</div>' : '')
        // v0.9.1237: what used to be the Atlas "Track configuration" and MTH
        // "MTH product line" steps. Catalog facts, so they sit with the
        // description — above the questions, never among them.
        + (col.id === 'main' ? _cdEraFacts(_cdMaster, wizard.data._era).map(function (f) {
            return '<div style="display:flex;gap:0.4rem;align-items:baseline;margin-bottom:0.2rem">'
              + '<span style="font-size:0.62rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap">' + rrEsc(f.label) + '</span>'
              + '<span style="font-size:0.8rem;color:var(--accent2);font-weight:600">' + rrEsc(f.value) + '</span>'
              + '</div>';
          }).join('') : '')
        + _cdExtLink
        + '<div style="margin-bottom:0.5rem;padding-bottom:0.4rem;border-bottom:1px solid var(--border)"></div>'
        // v0.9.1232: everything below is a grid cell. One column as before;
        // two side by side when .cd-2up is on. Each block is wrapped so a
        // question can never be parted from the field it reveals.
        + '<div class="cd-fields">';

      // Session 159: tender picker mode. Show radio candidates instead of
      // condition fields until the user confirms which tender they have.
      if (col.pickerMode && col.isTender) {
        html += '<div style="font-size:0.78rem;color:var(--text-mid);margin-bottom:0.5rem;font-style:italic">Which tender came with it?</div>';
        var _selTender = wizard.data._tenderConfirmed ? (wizard.data.tenderMatch || '') : '';
        var _cands = col.candidates || [];
        if (_cands.length === 0) {
          // No documented pairings - fall back to known tenders for this engine
          var _kt = getMatchingTenders((wizard.data.itemNum||'').trim());
          _cands = _kt.map(function(n) { return { itemNum: n, year: '', varNum: 1, variationSpecific: false }; });
        }
        var _rad = function(val, label, sub) {
          var sel = _selTender === val;
          return '<button type="button" onclick="_pickTender(\''+ val + '\')" '
            + 'style="display:flex;align-items:center;gap:0.6rem;width:100%;padding:0.55rem 0.75rem;margin-bottom:0.35rem;'
            + 'border-radius:8px;border:1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
            + 'background:' + (sel ? 'rgba(232,64,28,0.12)' : 'var(--bg)') + ';'
            + 'color:var(--text);cursor:pointer;text-align:left;font-family:var(--font-body)">'
            + '<span style="width:14px;height:14px;border-radius:50%;border:2px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
            + 'background:' + (sel ? 'var(--accent)' : 'transparent') + ';flex-shrink:0"></span>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-weight:600;font-size:0.85rem">' + label + '</div>'
            + (sub ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem">' + sub + '</div>' : '')
            + '</div></button>';
        };
        _cands.forEach(function(c) {
          var sub = c.variationSpecific
            ? 'Paired with this variation' + (c.year ? ' (' + c.year + ')' : '')
            : 'Also documented with this engine' + (c.year ? ' (' + c.year + ')' : '');
          html += _rad(c.itemNum, c.itemNum, sub);
        });
        // "Other tender" - opens the existing search modal
        html += '<button type="button" onclick="_showTenderPicker()" '
          + 'style="display:flex;align-items:center;gap:0.6rem;width:100%;padding:0.55rem 0.75rem;margin-bottom:0.35rem;'
          + 'border-radius:8px;border:1.5px dashed var(--border);background:var(--bg);color:var(--text-dim);'
          + 'cursor:pointer;text-align:left;font-family:var(--font-body);font-size:0.82rem">'
          + '<span style="font-size:1rem">\u{1F50D}</span>'
          + '<span>Other tender - search by number</span></button>';
        // "Don't know" - saves as Unknown
        html += _rad('Unknown', "Don't know", 'Save with tender unknown');
        html += '<div style="font-size:0.7rem;color:var(--text-dim);font-style:italic;margin-top:0.5rem;text-align:center">Need to remove the tender? Go Back and pick Engine only.</div>';
        html += '</div></div>';   // v0.9.1232: .cd-fields, then .cd-col
        return html;
      }

      // Condition — Session 176: ALWAYS render the slider so it stays adjustable.
      // (It used to collapse to a read-only badge once condition had any value,
      // which made it un-editable whenever a default/prior value was present.)
      html += '<div style="margin-bottom:0.5rem"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">'
        + '<span style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em">Condition</span>'
        + '<span id="cd-cond-val-' + col.id + '" style="font-family:var(--font-mono);font-size:0.95rem;color:var(--accent);font-weight:700">' + condVal + '</span></div>'
        + '<input type="range" min="1" max="10" value="' + condVal + '" style="width:100%;accent-color:var(--accent)"'
        + ' oninput="wizard.data[\'' + condKey + '\']=parseInt(this.value);document.getElementById(\'cd-cond-val-' + col.id + '\').textContent=this.value">'
        + '<div style="display:flex;justify-content:space-between;font-size:0.55rem;color:var(--text-dim)"><span>Poor</span><span>Excellent</span></div></div>';

      // All Original — inline row
      if (!_cdIsPaperLike) {
        html += '<div class="cd-blk">';
        html += _inlineRow('All Original?', _smallBtn(origKey, origVal, ['Yes','No','Unknown'],
          (c) => "wizard.data[\'" + origKey + "\']=\'" + c + "\';_cdToggleOrig(\'" + col.id + "\',\'" + origKey + "\',\'" + c + "\')"));
        // Modifications textarea (hidden unless allOriginal=No)
        html += '<div id="cd-mod-' + col.id + '" style="margin-bottom:0.4rem;display:' + (origVal === 'No' ? 'block' : 'none') + '">';
        html += '<textarea placeholder="What has been changed?" style="width:100%;min-height:40px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + modKey + '\']=this.value">' + rrEsc(modVal) + '</textarea></div>';
        html += '</div>';

        // Has Box — inline row
        html += '<div class="cd-blk">';
        html += _inlineRow('Has Box?', _smallBtn(boxKey, boxVal, ['Yes','No'],
          (c) => "wizard.data[\'" + boxKey + "\']=\'" + c + "\';_cdToggleBox(\'" + col.id + "\',\'" + c + "\')"));
        // Box condition slider (inline reveal)
        html += '<div id="cd-boxcond-' + col.id + '" style="margin-bottom:0.4rem;display:' + (boxVal === 'Yes' ? 'block' : 'none') + ';padding:0.4rem;background:var(--bg);border-radius:5px;border:1px solid var(--border)">';
        html += '<div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:0.65rem;color:var(--text-dim)">Box Cond:</span><span id="cd-boxcond-val-' + col.id + '" style="font-family:var(--font-head);font-size:0.95rem;color:var(--accent2);width:1.2rem;text-align:center">' + boxCondVal + '</span>';
        html += '<input type="range" min="1" max="10" value="' + boxCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data[\'' + boxCondKey + '\']=parseInt(this.value);document.getElementById(\'cd-boxcond-val-' + col.id + '\').textContent=this.value"></div>';
        html += '</div>';
        html += '</div>';
      } // end All Original + Has Box block
      
      // Instruction Sheet — only on main column, hidden for simplified types
      if (col.id === 'main' && !_cdHideToggles) {
        const isVal = wizard.data.hasIS || '';
        const isSheetVal = wizard.data.is_sheetNum || '';
        const isCondVal = wizard.data.is_condition || 7;
        html += '<div class="cd-blk">';
        html += _inlineRow('Instr. Sheet?', _smallBtn('hasIS', isVal, ['Yes','No'],
          (c) => "wizard.data.hasIS=\'" + c + "\';_cdToggleIS(\'" + c + "\')"));
        // IS inline reveal
        html += '<div id="cd-is-reveal" style="margin-bottom:0.4rem;display:' + (isVal === 'Yes' ? 'block' : 'none') + ';padding:0.4rem;background:var(--bg);border-radius:5px;border:1px solid var(--border)">';
        html += '<input type="text" placeholder="Sheet # (e.g. 924-6)" value="' + isSheetVal.replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:0.3rem;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:0.3rem 0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.78rem;outline:none;box-sizing:border-box" oninput="wizard.data.is_sheetNum=this.value">';
        html += '<div style="display:flex;align-items:center;gap:0.3rem"><span style="font-size:0.65rem;color:var(--text-dim)">Cond:</span><span id="cd-is-cond-val" style="font-family:var(--font-head);font-size:0.9rem;color:var(--accent2)">' + isCondVal + '</span>';
        html += '<input type="range" min="1" max="10" value="' + isCondVal + '" style="flex:1;accent-color:var(--accent)" oninput="wizard.data.is_condition=parseInt(this.value);document.getElementById(\'cd-is-cond-val\').textContent=this.value"></div>';
        html += '</div>';
        html += '</div>';

        // Master Box — main column only, hidden in set mode
        if (!wizard.data._setMode) {
          const mbVal2 = wizard.data.hasMasterBox || '';
          html += _inlineRow('Master Box?', _smallBtn('hasMasterBox', mbVal2, ['Yes','No'],
            (c) => "wizard.data.hasMasterBox=\'" + c + "\';_pvToggleMasterBox(\'" + c + "\')"));
        }
      }
      
      // Error item toggle — hidden in set mode and for simplified types
      if (!wizard.data._setMode && !_cdHideToggles) {
        const errKey = p ? p + 'IsError' : 'isError';
        const errDescKey = p ? p + 'ErrorDesc' : 'errorDesc';
        const errVal = wizard.data[errKey] || '';
        const errDescVal = wizard.data[errDescKey] || '';
        html += '<div class="cd-blk">';
        html += _inlineRow('Error Item?', _smallBtn(errKey, errVal, ['Yes','No'],
          (c) => "wizard.data[\'" + errKey + "\']=\'" + c + "\';_cdToggleError(\'" + col.id + "\',\'" + c + "\')"));
        html += '<div id="cd-error-reveal-' + col.id + '" style="margin-bottom:0.4rem;display:' + (errVal === 'Yes' ? 'block' : 'none') + '">';
        html += '<textarea placeholder="Describe the error…" style="width:100%;min-height:38px;background:var(--bg);border:1px solid #e74c3c44;border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data[\'' + errDescKey + '\']=this.value">' + rrEsc(errDescVal) + '</textarea></div>';
        html += '</div>';
      }
      
      // Notes field — shown in set mode only
      if (wizard.data._setMode && col.id === 'main') {
        const _setNoteVal = wizard.data.notes || '';
        html += '<div style="margin-top:0.3rem"><div style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">Notes</div>';
        html += '<textarea placeholder="e.g. minor rust, runs well" style="width:100%;min-height:45px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:0.4rem;color:var(--text);font-family:var(--font-body);font-size:0.75rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + rrEsc(_setNoteVal) + '</textarea></div>';
      }

      html += '</div>';   // v0.9.1232: .cd-fields
      html += '</div>';   // .cd-col
      return html;
    }
    
    // Build the multi-column layout
    const _cdWrap = document.createElement('div');
    _cdWrap.style.cssText = 'padding-top:0.25rem';
    
    let _cdHtml = '<div style="display:flex;gap:0.5rem;' + (_isMobile ? 'flex-direction:column' : '') + '">';
    _cdCols.forEach(function(col) {
      _cdHtml += _buildCondCol(col);
    });
    _cdHtml += '</div>';

    // For simplified types: embed value, date, notes fields (combines steps 4+5)
    if (_cdHideToggles) {
      const _scPaid = wizard.data.priceItem    || '';
      const _scVal  = wizard.data.userEstWorth || '';
      const _scDate = wizard.data.dateAcquired|| '';
      const _scNote = wizard.data.notes       || '';
      _cdHtml += '<div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.7rem">';
      _cdHtml += '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.1rem">Purchase & Value</div>';
      // v0.9.1242 (Brad): Est. Worth is asked BEFORE what you paid, on every
      // screen that asks both. What a thing is worth is the answer he wants
      // recorded; what he paid is history. Five screens asked these two
      // questions and three of them asked them the other way round.
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Est. Worth ($) <a href="javascript:_wizResearchPrice()" style="float:right;color:#2ecc71;font-weight:700;text-decoration:none;text-transform:none;letter-spacing:0">\uD83D\uDD0D Research</a></div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _scVal + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data.userEstWorth=this.value"></div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">What Did You Pay? ($)</div>'
        + '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem">'
        + '<span style="color:var(--text-dim)">$</span>'
        + '<input type="number" value="' + _scPaid + '" placeholder="0.00" min="0" step="0.01"'
        + ' style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:0.95rem"'
        + ' oninput="wizard.data.priceItem=this.value"></div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Date Acquired</div>'
        + '<div style="position:relative;display:flex;align-items:center">'
        + '<input type="date" id="cd-sc-date" value="' + _scDate + '"'
        + ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 2.5rem 0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;color-scheme:dark"'
        + ' oninput="wizard.data.dateAcquired=this.value">'
        + '<button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;cd-sc-date&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">\uD83D\uDCC5</button>'
        + '</div></div>';
      _cdHtml += '<div><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.25rem">Notes</div>'
        + '<textarea rows="2" placeholder="e.g. Complete set, all pieces present"'
        + ' style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;resize:none"'
        + ' oninput="wizard.data.notes=this.value">' + rrEsc(_scNote) + '</textarea></div>';
      _cdHtml += '</div>';
    }

    // ── Wishlist cleanup banner (Session 161+) ──
    // If the item being added matches a Want or Upgrade entry by itemNum+variation,
    // surface a checkbox so the user can opt to remove it from the wishlist on save.
    // Skipped when _fromWantList/_fromUpgradeList are set (those trigger auto-cleanup).
    (function _cdInjectWishlistBanner() {
      if (wizard.data._fromWantList || wizard.data._fromUpgradeList) {
        wizard.data._cleanupWishlistMatches = null;
        return;
      }
      var _itemNum = (wizard.data.itemNum || '').toString().trim();
      var _var = (wizard.data.variation || '').toString().trim();
      if (!_itemNum) {
        wizard.data._cleanupWishlistMatches = null;
        return;
      }
      var matches = [];
      Object.keys(state.wantData || {}).forEach(function(k) {
        var w = state.wantData[k];
        if (!w) return;
        if (String(w.itemNum||'').trim() === _itemNum
            && String(w.variation||'').trim() === _var) {
          matches.push({ key: k, row: w.row, listType: 'Want',
            label: w.itemNum + (w.variation ? ' var ' + w.variation : '') });
        }
      });
      Object.keys(state.upgradeData || {}).forEach(function(k) {
        var u = state.upgradeData[k];
        if (!u) return;
        if (String(u.itemNum||'').trim() === _itemNum
            && String(u.variation||'').trim() === _var) {
          matches.push({ key: k, row: u.row, listType: 'Upgrade',
            label: u.itemNum + (u.variation ? ' var ' + u.variation : '') });
        }
      });
      // Preserve any prior unchecked decisions from this wizard run.
      var prior = wizard.data._cleanupWishlistMatches || [];
      matches.forEach(function(m) {
        var prev = prior.find(function(p) { return p && p.row === m.row && p.listType === m.listType; });
        if (prev) m.unchecked = !!prev.unchecked;
      });
      wizard.data._cleanupWishlistMatches = matches;
      if (matches.length === 0) return;
      var typeColor = function(t) { return t === 'Want' ? '#3b82f6' : '#8b5cf6'; };
      var typeBg = function(t) { return t === 'Want' ? 'rgba(59,130,246,0.10)' : 'rgba(139,92,246,0.10)'; };
      // Render a slim banner above the conditionDetails body.
      var banner = '<div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:8px;padding:0.65rem 0.9rem;margin:0 0 0.85rem 0;font-family:var(--font-body)">'
        + '<div style="font-size:0.78rem;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem">On your wishlist</div>'
        + matches.map(function(m, i) {
            return '<label style="display:flex;align-items:center;gap:0.6rem;padding:0.3rem 0;cursor:pointer">'
              + '<input type="checkbox" data-wlmatch="' + i + '" ' + (m.unchecked ? '' : 'checked') + ' '
              + 'onchange="if(wizard.data._cleanupWishlistMatches&&wizard.data._cleanupWishlistMatches[' + i + ']){wizard.data._cleanupWishlistMatches[' + i + '].unchecked=!this.checked;}" '
              + 'style="width:16px;height:16px;cursor:pointer">'
              + '<span style="flex:1;font-size:0.85rem;color:var(--text)">Remove from <span style="font-weight:700;color:' + typeColor(m.listType) + ';background:' + typeBg(m.listType) + ';padding:0.05rem 0.45rem;border-radius:4px;text-transform:uppercase;font-size:0.7rem;letter-spacing:0.04em">' + m.listType + '</span> list when saved</span>'
              + '</label>';
          }).join('')
        + '</div>';
      _cdHtml = banner + _cdHtml;
    })();

    _cdWrap.innerHTML = _cdHtml;
    body.innerHTML = '';
    body.appendChild(_cdWrap);

  } else if (s.type === 'purchaseValue') {
    // ── SCREEN 4: Purchase & Value (combined screen) ──
    const _pvD = wizard.data;
    const _pvIsPaired = _pvD.tenderMatch && _pvD.tenderMatch !== 'none';
    const _pvIsSet = _pvD.setMatch === 'set-now';
    const _pvItemNum = (_pvD.itemNum || '').trim();
    
    // Year made: parse known production years
    const _pvMatch = state.masterData.find(function(m) {
      return normalizeItemNum(m.itemNum) === normalizeItemNum(_pvItemNum);
    });
    const _pvYearRange = _pvMatch ? (_pvMatch.yearProd || '') : '';
    let _pvYears = [];
    if (_pvYearRange) {
      _pvYearRange.split(/[,;]/).forEach(function(part) {
        part = part.trim();
        var rm = part.match(/^(\d{4})\s*[\-\u2013]\s*(\d{2,4})$/);
        if (rm) {
          var st = parseInt(rm[1]), en = parseInt(rm[2]);
          if (en < 100) en = Math.floor(st/100)*100 + en;
          for (var y = st; y <= Math.min(en, st+25); y++) _pvYears.push(y);
        } else if (/^\d{4}$/.test(part)) _pvYears.push(parseInt(part));
      });
      _pvYears = [...new Set(_pvYears)].sort((a,b) => a-b);
    }
    
    // Location chips
    const _pvAllLocs = {};
    Object.values(state.personalData).forEach(function(pd) {
      if (pd.location && pd.location.trim()) {
        var loc = pd.location.trim();
        _pvAllLocs[loc] = (_pvAllLocs[loc] || 0) + 1;
      }
    });
    const _pvSavedLocs = (typeof _getSavedLocations === 'function') ? _getSavedLocations().map(function(l){ return l.name; }).filter(Boolean) : [];
    const _pvRecentLocs = Object.entries(_pvAllLocs).sort((a,b) => b[1]-a[1]).map(e => e[0]).filter(function(n){ return _pvSavedLocs.indexOf(n) < 0; });
    const _pvLocList = _pvSavedLocs.concat(_pvRecentLocs);
    const _pvLocEnabled = _prefLocEnabled;
    
    let _pvHtml = '<div style="padding-top:0.25rem;max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch">';

    const _pvIsSetLoco  = _pvD._setMode && (_pvD._setItemIndex || 0) === 0;
    const _pvIsSetOther = _pvD._setMode && (_pvD._setItemIndex || 0) > 0;
    const _pvSetNum     = _pvD._resolvedSet ? _pvD._resolvedSet.setNum : '';
    const _pvLocoNum    = _pvD._setLocoNum || (_pvD._setFinalItems && _pvD._setFinalItems[0]) || '';

    // ── Set loco banner ──
    if (_pvIsSetLoco) {
      _pvHtml += '<div style="background:rgba(52,152,219,0.1);border:1.5px solid #3498db;border-radius:10px;padding:0.65rem 0.9rem;margin-bottom:0.85rem;font-size:0.82rem;color:var(--text-mid);line-height:1.45">'
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#3498db;margin-bottom:0.25rem">💰 Set Purchase Info</div>'
        + 'Enter what you paid and the <strong style="color:var(--text)">full set\'s estimated value</strong> below. Since you bought these together, price &amp; value are stored here on the locomotive'
        + (_pvSetNum ? ' and linked to set ' + _pvSetNum : '') + '.'
        + '</div>';
    }

    // ── Set non-loco info card (replaces price/date/worth) ──
    if (_pvIsSetOther) {
      _pvHtml += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.9rem;margin-bottom:0.85rem;font-size:0.82rem;color:var(--text-dim);line-height:1.45">'
        + '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.2rem">💰 Price &amp; Value</div>'
        + 'Stored on the locomotive'
        + (_pvLocoNum ? ' <span style="font-family:var(--font-mono);color:var(--accent);font-weight:600">' + _pvLocoNum + '</span>' : '')
        + (_pvSetNum ? ' · Set ' + _pvSetNum : '')
        + '</div>';
    }

    // v0.9.906 (Brad, item [1b]): field order is now Est. Worth → What did you
    // pay → Bought From → Date Purchased → (Location) → Notes.

    // Est. Worth — loco and normal items only
    if (!_pvIsSetOther) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'Est. Worth of Whole Set ($)' : 'Est. Worth ($)') + ' <a href="javascript:_wizResearchPrice()" style="float:right;color:#2ecc71;font-weight:700;text-decoration:none;text-transform:none;letter-spacing:0">\uD83D\uDD0D Research</a></div>';
      _pvHtml += '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">';
      _pvHtml += '<span style="color:var(--text-dim);font-size:1.1rem">$</span>';
      _pvHtml += '<input type="number" id="pv-worth" value="' + (_pvD.userEstWorth || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.userEstWorth=this.value"></div></div>';
    }

    // Price paid — loco and normal items only, not set non-loco
    if (!_pvIsSetOther) {
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'What did you pay for the whole set? ($)' : 'What did you pay? ($)') + '</div>';
      _pvHtml += '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem">';
      _pvHtml += '<span style="color:var(--text-dim);font-size:1.1rem">$</span>';
      _pvHtml += '<input type="number" id="pv-price" value="' + (_pvD.priceItem || '') + '" placeholder="0.00" min="0" step="0.01" style="flex:1;background:none;border:none;outline:none;color:var(--text);font-family:var(--font-body);font-size:1rem" oninput="wizard.data.priceItem=this.value"></div>';
      if (_pvIsPaired || _pvIsSet) {
        _pvHtml += '<div style="font-size:0.75rem;color:var(--accent2);margin-top:0.2rem">Full price — other units will reference this.</div>';
      }
      _pvHtml += '</div>';
    }

    // Bought From — optional seller link (v0.9.782, Brad brainstorm #3).
    // Remembers this session's last pick: ten items from Dave = ONE tap total.
    if (!_pvIsSetOther) {
      var _pvSellEsc = function (t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      var _pvLastSeller = '';
      try { _pvLastSeller = _pvD.purchasedFrom || sessionStorage.getItem('lv_last_seller') || ''; } catch (e) {}
      var _pvCts = (state.contactsData || []).slice().sort(function (a, b) { return (window._ctLastNameKey ? window._ctLastNameKey(a.name).localeCompare(window._ctLastNameKey(b.name)) : (a.name || '').localeCompare(b.name || '')); });
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Bought From (optional)</div>'
        + '<select id="pv-seller" onchange="window._pvSellerPick(this)" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">'
        + window._pvSellerEntries(_pvLastSeller).map(function (e) {
            return '<option value="' + _pvSellEsc(e.v) + '"' + (e.on ? ' selected' : '') + '>'
              + _pvSellEsc(e.label) + '</option>';
          }).join('')
        + '</select></div>';
      if (_pvLastSeller && !_pvD.purchasedFrom && _pvCts.some(function (ct) { return ct.id === _pvLastSeller; })) _pvD.purchasedFrom = _pvLastSeller;
      // Contacts not loaded yet (user hasn't visited the page)? Fill in place.
      if (!_pvCts.length && typeof window._ctLoadContacts === 'function') {
        window._ctLoadContacts().then(function () {
          var sel = document.getElementById('pv-seller');
          if (!sel) return;
          window._pvSellerFill(sel, _pvLastSeller);
          if (_pvLastSeller && sel.value === _pvLastSeller && !wizard.data.purchasedFrom) wizard.data.purchasedFrom = _pvLastSeller;
        }).catch(function () {});
      }
    }

    // Date purchased — loco and normal only. v0.9.906 (Brad, item [1b]):
    // auto-fill today's date when none has been chosen; the user can still change it.
    if (!_pvIsSetOther) {
      var _pvToday = '';
      try { var _pvDt = new Date(); _pvToday = _pvDt.getFullYear() + '-' + String(_pvDt.getMonth() + 1).padStart(2, '0') + '-' + String(_pvDt.getDate()).padStart(2, '0'); } catch (e) {}
      var _pvDateVal = _pvD.datePurchased || _pvToday;
      if (!_pvD.datePurchased && _pvToday) { wizard.data.datePurchased = _pvToday; }   // default so a blank date saves as today
      _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">' + (_pvIsSetLoco ? 'Date Set Purchased' : 'Date Purchased') + '</div>';
      _pvHtml += '<div style="position:relative;display:flex;align-items:center"><input type="date" value="' + _pvDateVal + '" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 2.5rem 0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box;color-scheme:dark" oninput="wizard.data.datePurchased=this.value" id="pvDate"><button type="button" onclick="event.preventDefault();event.stopPropagation();document.getElementById(&quot;pvDate&quot;).showPicker();" style="position:absolute;right:0.4rem;cursor:pointer;font-size:1rem;color:var(--accent2);background:none;border:none;padding:0.3rem;line-height:1;touch-action:manipulation">📅</button></div></div>';
    }

    // Location (if enabled)
    if (_pvLocEnabled) {
      _pvHtml += '<div style="margin-bottom:0.75rem">' + _wizLocationFieldHtml(_pvD.location || '') + '</div>';
    }

    // Notes
    _pvHtml += '<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">Notes (optional)</div>';
    _pvHtml += '<textarea id="pv-notes" placeholder="e.g. Purchased at train show, minor rust on trucks, runs well" style="width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + rrEsc(_pvD.notes) + '</textarea></div>';
    
    _pvHtml += '</div>';
    body.innerHTML = _pvHtml;
    setTimeout(function() { var i = document.getElementById('pv-worth') || document.getElementById('pv-price'); if(i) i.focus(); }, 50);

  } else if (s.type === 'confirm' && wizard.tab === 'set') {
    // ── SET CONFIRM / SUMMARY SCREEN ──
    const _scD = wizard.data;
    const _scSet = _scD._resolvedSet;
    const _scSaved = _scD._setItemsSaved || [];
    const _scGroupId = _scD._setGroupId || '';
    const _scSetNum = _scSet ? _scSet.setNum : (_scD.set_num || '');
    const _scItems = _scD._setFinalItems || [];
    const _scMode = _scD._setEntryMode || 'full';
    const _scHasBox = _scD.set_hasBox === 'Yes';
    const _scBoxCond = _scD.set_boxCond || '';
    const _scNotes = _scD.set_notes || '';

    body.innerHTML = '';
    const scWrap = document.createElement('div');
    scWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem';

    // Header
    const scHdr = document.createElement('div');
    scHdr.style.cssText = 'background:rgba(46,204,113,0.1);border:1.5px solid #2ecc71;border-radius:10px;padding:0.65rem 0.9rem';
    scHdr.innerHTML = '<div style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2ecc71">Set Complete \u2713</div>'
      + '<div style="font-family:var(--font-mono);font-size:1rem;font-weight:700;color:var(--accent2)">' + _scSetNum + '</div>'
      + '<div style="font-size:0.75rem;color:var(--text-dim)">' + _scSaved.length + ' item' + (_scSaved.length !== 1 ? 's' : '') + ' saved · Group: ' + _scGroupId + '</div>';
    scWrap.appendChild(scHdr);

    // Items list
    const scListHdr = document.createElement('div');
    scListHdr.style.cssText = 'font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-top:0.2rem';
    scListHdr.textContent = 'Saved Items';
    scWrap.appendChild(scListHdr);

    const scList = document.createElement('div');
    scList.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem';

    _scItems.forEach(function(itemNum, idx) {
      const isSaved = _scSaved.includes(itemNum);
      const master = state.masterData.find(function(m) { return normalizeItemNum(m.itemNum) === normalizeItemNum(itemNum); });
      const mType = master ? (master.itemType || '') : '';
      const mDesc = master ? (master.description || master.roadName || '') : '';
      const isEngine = (idx === 0);

      // Find the saved personal data for this item
      let pdCond = '';
      let pdWorth = '';
      let pdHasBox = 'No';
      Object.keys(state.personalData).forEach(function(k) {
        const pd = state.personalData[k];
        if (pd && pd.groupId === _scGroupId && normalizeItemNum(pd.itemNum) === normalizeItemNum(itemNum)) {
          pdCond = pd.condition || '';
          pdWorth = pd.userEstWorth || pd.priceItem || '';
          pdHasBox = pd.hasBox || 'No';
        }
      });

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.7rem';
      row.innerHTML = '<div style="flex:1">'
        + '<div style="display:flex;align-items:baseline;gap:0.4rem;flex-wrap:wrap">'
        + '<span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:' + (isSaved ? 'var(--accent)' : 'var(--text-dim)') + '">' + itemNum + '</span>'
        + (mType ? '<span style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em">' + mType + '</span>' : '')
        + (isEngine ? '<span style="font-size:0.65rem;padding:1px 5px;border-radius:4px;background:rgba(212,168,67,0.2);color:var(--accent2)">Engine</span>' : '')
        + '</div>'
        + '<div style="display:flex;gap:0.6rem;font-size:0.72rem;color:var(--text-dim);margin-top:2px">'
        + (pdCond ? '<span>Cond: <strong style="color:var(--text-mid)">' + pdCond + '</strong></span>' : '')
        + (pdWorth ? '<span>Worth: <strong style="color:var(--gold)">$' + pdWorth + '</strong></span>' : '')
        + (pdHasBox === 'Yes' ? '<span>\ud83d\udce6 Box</span>' : '')
        + (isSaved ? '<span style="color:#2ecc71">\u2713 Saved</span>' : '<span style="color:var(--accent)">\u2717 Not saved</span>')
        + '</div></div>'
        + '<button type="button" onclick="window._scEditItem(\'' + itemNum + '\')" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:0.25rem" title="Edit">\u270f\ufe0f</button>';
      scList.appendChild(row);
    });
    scWrap.appendChild(scList);

    // Set box info
    if (_scHasBox) {
      const boxInfo = document.createElement('div');
      boxInfo.style.cssText = 'display:flex;align-items:center;gap:0.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.7rem';
      boxInfo.innerHTML = '<div style="flex:1"><div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:1.1rem">\ud83d\udce6</span><span style="font-size:0.8rem;color:var(--text)">Set Box</span></div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px">Condition: <strong style="color:var(--text-mid)">' + (_scBoxCond || '\u2014') + '</strong>'
        + (_scNotes ? ' \u00b7 Notes: <em>' + _scNotes + '</em>' : '') + '</div></div>'
        + '<button type="button" onclick="window._scEditSetBox()" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:0.25rem" title="Edit">\u270f\ufe0f</button>';
      scWrap.appendChild(boxInfo);
    }

    // Notes shown in Set Box row — no separate display needed

    body.appendChild(scWrap);

    // Edit set box — go back to set_boxCond step
    window._scEditSetBox = function() {
      wizard.step = wizard.steps.findIndex(function(s) { return s.id === 'set_boxCond'; });
      if (wizard.step < 0) wizard.step = wizard.steps.length - 2;
      renderWizardStep();
    };

    // Edit item handler — opens the item detail modal
    window._scEditItem = function(itemNum) {
      // Find the pd key for this item in this group
      let targetKey = null;
      Object.keys(state.personalData).forEach(function(k) {
        const pd = state.personalData[k];
        if (pd && pd.groupId === _scGroupId && normalizeItemNum(pd.itemNum) === normalizeItemNum(itemNum)) {
          targetKey = k;
        }
      });
      if (targetKey) {
        openItem(targetKey);
      } else {
        showToast('Item not found — it may not have been saved');
      }
    };

    // Save button shows as "✓ Save" via the standard confirm logic
    if (nextBtn) {
      nextBtn.textContent = '\u2713 Done';
      nextBtn.style.display = 'inline-flex';
    }

  } else if (s.type === 'confirm') {
    let item = wizard.matchedItem;
    // Bugfix 2026-04-14: if the user picked a specific variation in the wizard,
    // re-fetch the master row for that exact variation so the header + details
    // reflect the picked variation (was showing Var 1 because matchedItem was
    // whichever master row .find() hit first).
    if (item && wizard.data.variation && String(item.variation || '') !== String(wizard.data.variation)) {
      const _specific = (state.masterData || []).find(m =>
        m.itemNum === item.itemNum && String(m.variation || '') === String(wizard.data.variation)
      );
      if (_specific) item = _specific;
    }
    const _isEph = ['catalogs','paper','mockups','other',...(state.userDefinedTabs||[]).map(t=>t.id)].includes(wizard.tab);
    const _keyLabels = {
      itemCategory:'Category', cat_type:'Type', cat_year:'Year',
      hasIS:'Has Instruction Sheet', is_sheetNum:'Sheet #', is_condition:'Sheet Condition', is_pricePaid:'Price Paid', is_estValue:'Est. Worth',
      hasMasterBox:'Has Master Box', masterBoxCond:'Master Box Condition', masterBoxNotes:'Master Box Notes',
      notOriginalDesc:'Modifications', tenderNotOriginalDesc:'Tender Modifications',
      unit2NotOriginalDesc:'Unit 2 Modifications', unit3NotOriginalDesc:'Unit 3 Modifications',
      cat_hasMailer:'Has Envelope/Mailer', cat_condition:'Condition',
      cat_pricePaid:'Price Paid', cat_estValue:'Est. Worth', cat_dateAcquired:'Date Acquired', cat_notes:'Notes',
      eph_title:'Title', eph_description:'Description', eph_year:'Year',
      eph_condition:'Condition', eph_quantity:'Quantity', eph_pricePaid:'Price Paid', eph_estValue:'Est. Worth',
      eph_dateAcquired:'Date Acquired', eph_notes:'Notes',
      eph_itemNumRef:'Item # Ref', eph_productionStatus:'Production Status',
      eph_material:'Material', eph_dimensions:'Dimensions',
      eph_lionelVerified:'Lionel Verified',
      location:'Storage Location',
      manualManufacturer:'Manufacturer', manualItemNum:'Item Number', manualItemType:'Item Type',
      manualRoadName:'Road Name', manualRoadNumber:'Road Number', manualCustomName:'Name',
      manualDesc:'Description', manualYear:'Year Made', manualCondition:'Condition',
      manualHasBox:'Has Box', manualBoxCond:'Box Condition', manualNotes:'Notes',
      isError:'Error Item', errorDesc:'Error Description',
      tenderIsError:'Tender Error', tenderErrorDesc:'Tender Error Desc',
      unit2IsError:'Unit 2 Error', unit2ErrorDesc:'Unit 2 Error Desc',
      unit3IsError:'Unit 3 Error', unit3ErrorDesc:'Unit 3 Error Desc',
      condition:'Condition', tenderCondition:'Tender Condition',
      unit2Condition:'Unit 2 Condition', unit3Condition:'Unit 3 Condition',
      allOriginal:'All Original', tenderAllOriginal:'Tender All Original',
      unit2AllOriginal:'Unit 2 All Original', unit3AllOriginal:'Unit 3 All Original',
      hasBox:'Has Box', tenderHasBox:'Tender Has Box',
      unit2HasBox:'Unit 2 Has Box', unit3HasBox:'Unit 3 Has Box',
      boxCond:'Box Condition', tenderBoxCond:'Tender Box Cond',
      unit2BoxCond:'Unit 2 Box Cond', unit3BoxCond:'Unit 3 Box Cond',
      pricePaid:'Price Paid', priceItem:'Price Paid', userEstWorth:'Est. Worth (insurance)',
      datePurchased:'Date Purchased', yearMade:'Year Made',
      variation:'Variation', itemNum:'Item Number',
      entryMode:'Entry Mode', boxOnly:'Box Only',
      priority:'Priority', expectedPrice:'Expected Price',
      salePrice:'Sale Price', dateSold:'Date Sold',
      set_num:'Set Number',
    };
    const _skipKeys = new Set(['tab','itemCategory','_photoOnly','_tenderDone','_setDone','tenderMatch','setMatch','setType','unitPower','wantErrorPhotos','photosMasterBox','boxOnly','entryMode','_setId','_rawItemNum','matchedItem','_partialMatches','_partialQuery','_itemGrouping','_fromWantList','_fromWantKey','_returnPage','_manualEntry','_drivePhotos','_setMode','_setGroupId','_setFinalItems','_setItemIndex','_setItemsSaved','_setEntryMode','_resolvedSet','_setLocoNum','_setPrice','_setDate','_setWorth','_setCondition','_setHasBoxChecked','_setWantPhotos','_setPhotoThenSave','_prefilledCondition','_setQEPhotos','_setMemberPhotos','set_hasBox','set_boxCond','set_boxPhotos','set_notes','_suggestions_cache','_biBoxPhotoFile','_idItemPhotoFile','_boxAutoKnown','_completingQuickEntry','_existingGroupId','_fillItemMode','_wizSaveLock','_qeSaving','_photoInventoryId','_addPhotoDriveId','_saveComplete','_era','suggestedRoadName','_manualEra','_alsoListForSale','_fromUpgradeList','_fromUpgradeKey','_cleanupWishlistMatches','_suggestedPricePaid','forSale_salePrice','forSale_dateListed','selectedForSaleKey','selectedSoldKey',
      '_photoUploadsInFlight','_identifyMeta','_identifyMfrHints','_identifyScaleHint','_identifyTypeHint','_alreadyOwnedFyi',
      '_skipAllPhotos']);  // v0.9.906 (Brad, item [6]): internal photo-skip flag — never a review row
    // Skip set_num from summary if it's already shown in the header
    if (wizard.data._resolvedSet || wizard.data.set_num) _skipKeys.add('set_num');
    // Skip notes from summary for tabs that have inline notes on confirm step
    if (['want','forsale','sold'].includes(wizard.tab)) _skipKeys.add('notes');
    // In set mode, hide tender/unit/masterBox/error fields from confirm (each set item is standalone)
    if (wizard.data._setMode) {
      ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
       'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
       'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc',
       'hasMasterBox','masterBoxCond','masterBoxNotes','isError','errorDesc','notOriginalDesc',
       'priceItem','userEstWorth','datePurchased','pricePaid','location','yearMade',
       '_existingGroupId'].forEach(k => _skipKeys.add(k));
    }
    // Ephemera/catalog items: hide ALL regular collection fields — only show cat_* or eph_* keys
    if (_isEph) {
      ['allOriginal','tenderAllOriginal','unit2AllOriginal','unit3AllOriginal',
       'hasBox','tenderHasBox','unit2HasBox','unit3HasBox',
       'condition','tenderCondition','unit2Condition','unit3Condition',
       'boxCond','tenderBoxCond','unit2BoxCond','unit3BoxCond',
       'isError','tenderIsError','unit2IsError','unit3IsError',
       'errorDesc','tenderErrorDesc','unit2ErrorDesc','unit3ErrorDesc',
       'notOriginalDesc','tenderNotOriginalDesc','unit2NotOriginalDesc','unit3NotOriginalDesc',
       'hasIS','is_sheetNum','is_condition','is_pricePaid','is_estValue',
       'hasMasterBox','masterBoxCond','masterBoxNotes',
       'priceItem','userEstWorth','datePurchased','pricePaid','location','yearMade',
       'variation','itemNum','_existingGroupId'].forEach(k => _skipKeys.add(k));
    }
    // Hide tender/unit fields that don't apply based on actual grouping
    const _cfGrouping = wizard.data._itemGrouping || 'single';
    if (!_isEph && !wizard.data._setMode) {
      // Single items: hide all tender + unit fields
      if (_cfGrouping === 'single') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // Engine+tender: hide unit2/unit3 fields
      if (_cfGrouping === 'engine_tender') {
        ['unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // AA/AB: hide unit3 and tender fields
      if (_cfGrouping === 'aa' || _cfGrouping === 'ab') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
      // ABA: hide tender fields only
      if (_cfGrouping === 'aba') {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc'
        ].forEach(k => _skipKeys.add(k));
      }
    }
    // Collection wizard with special item types (Paper/Other/Service/Science/Construction from Browse):
    // hide tender/unit/error/IS/masterBox fields that don't apply
    if (!_isEph && wizard.tab === 'collection' && wizard.matchedItem) {
      const _miTab = wizard.matchedItem._tab || '';
      const _miType = wizard.matchedItem.itemType || '';
      const _miIsPaperLike = [SHEET_TABS.paper, SHEET_TABS.other, SHEET_TABS.serviceTools].includes(_miTab)
        || ['Catalog','Instruction Sheet'].includes(_miType) || _miType.toLowerCase().includes('paper');
      const _miIsSimplified = ['Science Set','Construction Set'].includes(_miType);
      if (_miIsPaperLike || _miIsSimplified) {
        ['tenderAllOriginal','tenderHasBox','tenderCondition','tenderBoxCond','tenderIsError','tenderErrorDesc','tenderNotOriginalDesc',
         'unit2AllOriginal','unit2HasBox','unit2Condition','unit2BoxCond','unit2IsError','unit2ErrorDesc','unit2NotOriginalDesc',
         'unit3AllOriginal','unit3HasBox','unit3Condition','unit3BoxCond','unit3IsError','unit3ErrorDesc','unit3NotOriginalDesc',
         'hasIS','is_sheetNum','is_condition','is_pricePaid','is_estValue',
         'hasMasterBox','masterBoxCond','masterBoxNotes',
         'isError','errorDesc','notOriginalDesc'].forEach(k => _skipKeys.add(k));
      }
      if (_miIsPaperLike) {
        // Paper-like: also hide allOriginal, hasBox, boxCond
        ['allOriginal','hasBox','boxCond'].forEach(k => _skipKeys.add(k));
      }
    }
    const _summaryEntries = Object.entries(wizard.data).filter(function(e) {
      return !_skipKeys.has(e[0]) && !e[0].startsWith('_searchFilter') && e[1] && e[1] !== '' && !e[0].startsWith('photos') && !Array.isArray(e[1]) && typeof e[1] !== 'object';
    });

    const _yesNoKeys = ['hasIS','hasMasterBox','hasBox','tenderHasBox','unit2HasBox','unit3HasBox','isError','tenderIsError','unit2IsError','unit3IsError','cat_hasMailer','manualHasBox'];
    const _yesNoUnkKeys = ['allOriginal','tenderAllOriginal','unit2AllOriginal','unit3AllOriginal'];
    const _sliderKeys = ['condition','tenderCondition','unit2Condition','unit3Condition','boxCond','tenderBoxCond','unit2BoxCond','unit3BoxCond','is_condition','cat_condition','eph_condition','masterBoxCond','manualCondition','manualBoxCond'];
    const _moneyKeys = ['pricePaid','priceItem','userEstWorth','cat_pricePaid','cat_estValue','eph_pricePaid','eph_estValue','is_estValue','is_pricePaid','expectedPrice','salePrice'];
    const _dateKeys = ['datePurchased','cat_dateAcquired','eph_dateAcquired','dateSold'];

    // Store field type maps on window for edit functions
    window._cfYesNo = _yesNoKeys;
    window._cfYesNoUnk = _yesNoUnkKeys;
    window._cfSlider = _sliderKeys;
    window._cfMoney = _moneyKeys;
    window._cfDate = _dateKeys;

    let confirmHtml = '<div style="padding-top:0.5rem">';
    const _resolvedSet = wizard.data._resolvedSet;
    if (!_isEph && _resolvedSet) {
      // Set with resolved details
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">Set ' + _resolvedSet.setNum + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + (_resolvedSet.setName || '') + '</div>'
        + (_resolvedSet.year ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + _resolvedSet.year + '</div>' : '') + '</div>';
    } else if (!_isEph && item) {
      // Bugfix 2026-04-14: second line now shows the item description (was showing
      // redundant roadName/itemType which duplicates the third line).
      var _cfDesc = item.description || item.roadName || _typeLabel(item) || '';
      var _cfMeta = [item.roadName, item.yearProd, _typeLabel(item)].filter(function(x) {
        return x && x !== item.description;
      }).join(' · ');
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.8rem">No. ' + item.itemNum + (item.variation ? ' — Var ' + item.variation : '') + '</div>'
        + '<div style="font-weight:600;margin-top:0.2rem">' + _cfDesc + '</div>'
        + (_cfMeta ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">' + _cfMeta + '</div>' : '') + '</div>';
    } else if (!_isEph) {
      confirmHtml += '<div style="background:var(--surface2);border-radius:8px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="font-family:var(--font-mono);color:var(--accent2)">' + (wizard.data.itemCategory === 'set' ? 'Set ' : 'Item ') + (wizard.data.itemNum || wizard.data.set_num || '?') + (wizard.data.variation ? ' Var ' + wizard.data.variation : '') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">' + (wizard.data.itemCategory === 'set' ? 'Will be added to your Want List' : ((typeof _catalogReady === 'function' && !_catalogReady()) ? '⏳ Loading your catalog — one moment…' : 'Not found in master inventory — will save with entered data')) + '</div></div>';
    }
    // Session 115: grouping-candidate section. When the user already owns
    // something that naturally groups with this new item, surface it as
    // a checkbox / radio group on the Confirm step. Checkboxes bind to
    // the existing flags and wizard.data._groupingLinkChoices; the save
    // logic applies a shared Group ID to each picked candidate.
    //
    // Scope: only show on the collection add flow. Listing for sale,
    // recording a sale, and adding to the want list are metadata
    // changes on items that already exist (or aspirational in the
    // want-list case), not new collection adds — grouping doesn't
    // apply. Keep the grouping UI out of those flows entirely.
    var _grpCands = (wizard.tab === 'collection' && typeof findGroupingCandidates === 'function')
      ? findGroupingCandidates(wizard.data) : [];
    if (_grpCands.length > 0) {
      // Session 115 fix: group candidates by type so each physical
      // relationship is represented at-most-once. A box can only go
      // with ONE owned unit; an engine pairs with ONE tender; etc.
      // Within a type: single-select (checkbox if count=1, radios +
      // "None" if count>=2). Across types: independent choices.
      if (!wizard.data._groupingLinkChoices) wizard.data._groupingLinkChoices = {};
      var _byType = {};
      _grpCands.forEach(function(c) {
        if (!_byType[c.type]) _byType[c.type] = [];
        _byType[c.type].push(c);
      });
      // Default: first candidate of each type is selected, rest off.
      // Only initializes; existing user choices are preserved.
      Object.keys(_byType).forEach(function(t) {
        var list = _byType[t];
        var anyInit = list.some(function(c) { return c.invKey in wizard.data._groupingLinkChoices; });
        if (!anyInit) {
          list.forEach(function(c, i) {
            wizard.data._groupingLinkChoices[c.invKey] = (i === 0);
          });
        }
      });

      confirmHtml += '<div style="background:var(--surface2);border:1.5px solid var(--accent2);border-radius:10px;padding:0.85rem;margin-bottom:1rem">'
        + '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.45rem">'
        +   '<span style="font-size:1rem;line-height:1">\u{1F517}</span>'
        +   '<div style="font-weight:700;color:var(--accent2);font-size:0.92rem">'
        +     'Link with existing ' + (_grpCands.length > 1 ? 'items' : 'item') + '?'
        +   '</div>'
        + '</div>'
        + '<div style="font-size:0.78rem;color:var(--text-mid);margin-bottom:0.6rem">'
        +   'You already own '
        +   (_grpCands.length === 1 ? 'this related item' : 'these related items')
        +   '. Linking keeps them grouped in photos and reports.'
        + '</div>';

      Object.keys(_byType).forEach(function(t) {
        var list = _byType[t];
        if (list.length === 1) {
          // Single candidate of this type → checkbox
          var c = list[0];
          var linked = wizard.data._groupingLinkChoices[c.invKey] !== false;
          var handler = '_grpToggleOne(\'' + c.invKey + '\', this.checked)';
          confirmHtml += '<label style="display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.7rem;margin-top:0.35rem;'
            + 'border-radius:8px;background:var(--bg);border:1px solid var(--border);cursor:pointer">'
            + '<input type="checkbox" ' + (linked ? 'checked' : '') + ' onchange="' + handler + '" '
            + 'style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent2);flex-shrink:0">'
            + '<span style="font-size:0.85rem;color:var(--text)">' + c.label + '</span>'
            + '</label>';
        } else {
          // 2+ candidates of same type → radio group (pick one, or None)
          var radioName = 'grp-type-' + t;
          var noneSelected = !list.some(function(c) { return wizard.data._groupingLinkChoices[c.invKey]; });
          var typeLabel;
          switch (t) {
            case 'box':     typeLabel = 'Which box?'; break;
            case 'item':    typeLabel = 'Which item does this box go with?'; break;
            case 'tender':  typeLabel = 'Which tender?'; break;
            case 'engine':  typeLabel = 'Which engine?'; break;
            case 'partner': typeLabel = 'Which partner unit?'; break;
            case 'is':      typeLabel = 'Which instruction sheet?'; break;
            default:        typeLabel = 'Pick one'; break;
          }
          confirmHtml += '<div style="margin-top:0.55rem;padding:0.5rem 0.65rem;background:var(--bg);border:1px solid var(--border);border-radius:8px">'
            + '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.35rem;font-weight:600">'
            +   typeLabel + '</div>';
          list.forEach(function(c) {
            var sel = !!wizard.data._groupingLinkChoices[c.invKey];
            var handler = '_grpPickRadio(\'' + t + '\', \'' + c.invKey + '\')';
            confirmHtml += '<label style="display:flex;align-items:center;gap:0.55rem;padding:0.35rem 0.25rem;cursor:pointer">'
              + '<input type="radio" name="' + radioName + '" ' + (sel ? 'checked' : '') + ' onchange="' + handler + '" '
              + 'style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent2);flex-shrink:0">'
              + '<span style="font-size:0.85rem;color:var(--text)">' + c.label + '</span>'
              + '</label>';
          });
          // "None" option so the user can opt out of linking this type entirely
          confirmHtml += '<label style="display:flex;align-items:center;gap:0.55rem;padding:0.35rem 0.25rem;cursor:pointer;border-top:1px dashed var(--border);margin-top:0.2rem;padding-top:0.4rem">'
            + '<input type="radio" name="' + radioName + '" ' + (noneSelected ? 'checked' : '') + ' onchange="_grpPickRadio(\'' + t + '\', \'\')" '
            + 'style="width:15px;height:15px;cursor:pointer;accent-color:var(--text-dim);flex-shrink:0">'
            + '<span style="font-size:0.82rem;color:var(--text-dim)">None \u2014 don\u2019t link</span>'
            + '</label>';
          confirmHtml += '</div>';
        }
      });
      confirmHtml += '</div>';
    }

    confirmHtml += '<div style="display:flex;flex-direction:column;gap:0.3rem;font-size:0.83rem">';
    _summaryEntries.forEach(function(entry) {
      var k = entry[0], v = entry[1];
      var label = _keyLabels[k] || k.replace(/^(cat_|eph_)/,'').replace(/([A-Z])/g,' $1').replace(/_/g,' ').toLowerCase().replace(/^./,function(c){return c.toUpperCase();});
      var isMoney = _moneyKeys.indexOf(k) >= 0;
      var dispVal = isMoney && parseFloat(v) ? _currencySymbol() + parseFloat(v).toLocaleString() : v;
      confirmHtml += '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.5rem;border-radius:6px;background:var(--surface2)">'
        + '<span style="color:var(--text-dim);min-width:120px;flex-shrink:0;font-size:0.78rem">' + label + '</span>'
        + '<span id="confirm-val-' + k + '" style="flex:1;word-break:break-word">' + dispVal + '</span>'
        + '<button onclick="_confirmEdit(\'' + k + '\')" id="confirm-edit-btn-' + k + '" title="Edit" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:5px;padding:0.2rem 0.45rem;cursor:pointer;color:var(--text-dim);font-size:0.72rem;font-family:var(--font-body)">✏️</button>'
        + '</div>';
    });
    confirmHtml += '</div>';
    // Inline notes for want/forsale/sold confirm — no separate notes step needed
    if (['want','forsale','sold'].includes(wizard.tab)) {
      const _cfNotes = wizard.data.notes || '';
      confirmHtml += '<div style="margin-top:0.6rem"><div style="font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.25rem">Notes (optional)</div>'
        + '<textarea placeholder="Any notes..." style="width:100%;min-height:50px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.82rem;outline:none;resize:vertical;box-sizing:border-box" oninput="wizard.data.notes=this.value">' + rrEsc(_cfNotes) + '</textarea></div>';
    }
    confirmHtml += '</div>';
    body.innerHTML = confirmHtml;
  }

}

// ── Category/Tab/Choice handlers (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

// ── Picker UIs (moved to wizard-pickers.js — Session 110, Round 1 Chunk 5) ──

// ── Personal Data Lookup helpers (moved to wizard-pdlookup.js — Session 110, Round 1 Chunk 2) ──

// ── PHOTO UPLOAD HANDLERS ───────────────────────────────────────

// ── handlePhotoDrop + uploadWizardPhoto moved to wizard-photos.js (Session 110, Chunk 4) ──

// ── toggleBoxOnly (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──

// ── Collection/sold/forsale pickers (moved to wizard-pickers.js — Session 110, Round 1 Chunk 5) ──

// ── wizardChooseVariation/wizardChooseBoxVariation (moved to wizard-handlers.js — Session 110, Round 1 Chunk 6) ──


// ── Suggestion engines (moved to wizard-suggestions.js — Session 110, Round 1 Chunk 1) ──

// Returns:
//   true  — wizard.step moved to an earlier visible step (re-rendered)
//   false — no earlier visible step exists. Caller decides what to do
//           (close the wizard, show cancel prompt, etc.). This prevents
//           the silent loop that previously landed the user back on the
//           current step when all prior steps had skipIf → true.
function wizardBack() {
  // Session 159: on Step 3 with engine+tender after user confirmed a tender,
  // Back returns to the picker mode instead of jumping back to Step 2.
  // Second Back press (picker mode) goes to Step 2 normally.
  var _curS = wizard.steps[wizard.step];
  if (_curS && _curS.type === 'conditionDetails' &&
      wizard.data._itemGrouping === 'engine_tender' &&
      wizard.data._tenderConfirmed) {
    wizard.data._tenderConfirmed = false;
    renderWizardStep();
    return true;
  }

  if (wizard.step <= 0) return false;
  // Clear save locks — user is navigating back, not saving
  if (wizard.data) {
    wizard.data._wizSaveLock = false;
    wizard.data._qeSaving = false;
  }
  const _setFwdSkip = wizard.data._setMode
    ? new Set(['itemCategory', 'itemNumGrouping', 'itemPicker', 'entryMode'])
    : null;

  // Walk backwards to find the previous visible step
  let target = wizard.step - 1;
  while (target >= 0) {
    const st = wizard.steps[target];
    const isSkipped = (st.skipIf && st.skipIf(wizard.data));
    const isSetBlocked = (_setFwdSkip && _setFwdSkip.has(st.id));
    // Mirror the forward render: when "Save & Skip to Review" was used,
    // all photo steps are auto-skipped — Back must skip them too, or it
    // lands on a photo step that immediately re-skips forward (no-op bug).
    const isPhotoSkipped = (wizard.data._skipAllPhotos && st.type === 'drivePhotos');
    if (!isSkipped && !isSetBlocked && !isPhotoSkipped) break;
    target--;
  }
  // Session 159: removed Session-115 itemCategory revive. The era-picker step
  // is gone; if Back can't find an earlier visible step, just refuse — Step 1
  // hides Back anyway via current > 1 check at render time.
  if (target < 0) return false;
  wizard.step = target;
  renderWizardStep();
  return true;
}

// wizardNextWithYearCheck removed Session 120 (was never called)

function initCondDesc() {
  var _descs = {1:'Heavily worn, broken or missing parts',2:'Very rough, significant damage',3:'Worn, chipping or rust present',4:'Good — visible play wear',5:'Good plus — light wear throughout',6:'Very Good — minor wear only',7:'Very Good plus — light marks, sharp detail',8:'Excellent — near perfect, very light handling',9:'Excellent plus — virtually no flaws',10:'Mint — appears unrun, like new'};
  function _upd() { var v=document.getElementById('wiz-slider'); var d=document.getElementById('wiz-cond-desc'); if(v&&d) d.textContent=_descs[parseInt(v.value)]||''; }
  _upd();
  var sl = document.getElementById('wiz-slider');
  if (sl) sl.addEventListener('input', _upd);
}

// yearMadeReenter removed Session 120

// yearMadeNext removed Session 120

// Phase 1 streamline: skip every remaining drivePhotos step in this flow.
// Sets a flag the renderWizardStep skip-loop checks on each step transition.
async function wizardSkipAllPhotos() {
  if (!wizard || !wizard.data) return;
  // Bug 11 (Session 154): wait for any in-flight photo uploads so photos the
  // user just added persist into the save instead of being dropped by the
  // async race. Brief "Saving photos…" state while we wait.
  var _btn = document.getElementById('wizard-skip-photos-btn');
  var _origHtml = _btn ? _btn.innerHTML : '';
  if ((wizard.data._photoUploadsInFlight || 0) > 0 && typeof _awaitPhotoUploads === 'function') {
    if (_btn) { _btn.disabled = true; _btn.innerHTML = 'Saving photos\u2026'; }
    await _awaitPhotoUploads();
    if (_btn) { _btn.disabled = false; _btn.innerHTML = _origHtml; }
  }
  // Bug 12 (Session 154): in photo-only mode (adding a photo to an EXISTING
  // item), the skip button must write the photo to the existing row and close
  // — NOT advance into the full add flow, which appends a duplicate row.
  if (wizard.data._photoOnly && wizard.data._updatePdKey && typeof savePhotoOnlyUpdate === 'function') {
    await savePhotoOnlyUpdate();
    return;
  }
  if ((wizard.data._photosAdded || 0) > 0 && typeof showToast === 'function') {
    var _n = wizard.data._photosAdded;
    showToast('\u2713 Saved your ' + _n + ' photo' + (_n > 1 ? 's' : ''));
  }
  wizard.data._skipAllPhotos = true;
  wizard.step++;
  renderWizardStep();
}

// Advances wizard without triggering yearMade intercept — called by yearMadeNext
async function wizardAdvance() {
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;
  const _warn = document.getElementById('year-range-warning');
  if (_warn) _warn.remove();
  await _wizardNextCore();
}

// v0.9.647 (Brad): FYI toast when the item being added is already in the
// collection. Non-blocking — owning multiple copies is legit; just a heads-up.
// Once per wizard session (flag on wizard.data). Boxes (-BOX rows) excluded.
function _fyiAlreadyOwned(itemNum) {
  try {
    if (typeof wizard === 'undefined' || !wizard || !wizard.data || wizard.data._alreadyOwnedFyi) return;
    var _n = String(itemNum || '').trim().toLowerCase();
    if (!_n || _n.indexOf('-box') >= 0) return;
    var _copies = Object.values((typeof state !== 'undefined' && state.personalData) || {}).filter(function(pd) {
      return pd && pd.owned && String(pd.itemNum || '').trim().toLowerCase() === _n;
    });
    if (!_copies.length) return;
    wizard.data._alreadyOwnedFyi = true;
    if (typeof showToast === 'function') {
      showToast('FYI — ' + itemNum + ' is already in your collection' + (_copies.length > 1 ? ' (' + _copies.length + ' copies)' : '') + '. Adding another copy is fine.', 5000);
    }
  } catch (e) {}
}
if (typeof window !== 'undefined') window._fyiAlreadyOwned = _fyiAlreadyOwned;

async function wizardNext() {
  // Prevent double-save from rapid clicks
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;

  const steps = wizard.steps;
  const s = steps[wizard.step];

  // yearMade intercept removed Session 120

  await _wizardNextCore();
}

async function _wizardNextCore() {
  const _nextBtn = document.getElementById('wizard-next-btn');
  if (_nextBtn && _nextBtn.disabled) return;
  const steps = wizard.steps;
  const s = steps[wizard.step];
// Validate required fields
  // v0.9.722 (Brad): manual items MUST have a description — it becomes the
  // item's display name/description everywhere.
  if (s.id === 'manualDesc' && !String(wizard.data.manualDesc || '').trim()) {
    showToast('Please add a short description — it becomes this item\'s name in your lists.', 4000, true); return;
  }
  if (s.type === 'choice' && !wizard.tab) {
    showToast('Please select where to add the item.'); return;
  }
  // v0.9.1240: with more than one copy of this number owned, the app cannot
  // know which one is being sold and must not pick for you. One copy is not a
  // choice, so Next still walks straight past it.
  if (s.type === 'pickSoldItem' && !wizard.data.selectedSoldKey &&
      typeof soldCopyKeys === 'function' &&
      soldCopyKeys((wizard.data.itemNum || '').trim()).length > 1) {
    showToast('You own more than one of these — choose which one you sold.', 4000, true); return;
  }
  if ((s.type === 'choice2' || s.type === 'choice3' || s.type === 'choiceSearch') && !s.optional && !wizard.data[s.id]) {
    showToast('Please make a selection.'); return;
  }
  if (s.type === 'text' && !s.optional && !wizard.data[s.id]?.trim()) {
    showToast('This field is required.'); return;
  }
  if (s.type === 'manualManufacturer' && !(wizard.data.manualManufacturer || '').trim()) {
    showToast('Please select or type a manufacturer.'); return;
  }
  if (s.type === 'manualItemType' && !(wizard.data.manualItemType || '').trim()) {
    showToast('Please select or type an item type.'); return;
  }
  if (s.type === 'itemNumGrouping' && !(wizard.data.itemNum || '').trim()) {
    showToast('Please enter an item number.'); return;
  }
  // Session 159: require user to confirm which tender came with the engine
  if (s.type === 'conditionDetails' &&
      wizard.data._itemGrouping === 'engine_tender' &&
      !wizard.data._tenderConfirmed) {
    showToast('Please pick which tender came with this engine.'); return;
  }
  if (s.type === 'itemNumGrouping') {
    const _rawInput = (wizard.data.itemNum || '').trim();
    const _inputParts = _rawInput.toLowerCase().split(/\s+/);
    const _numPart = _inputParts[0];
    const _keyParts = _inputParts.slice(1).filter(p => p.length > 0);

    // Check for exact match first. Session 115: prefer the row matching
    // the user's picked itemType (+ roadName) from the suggestion click
    // so wizardNext doesn't clobber the right match with whichever row
    // happens to come first in iteration order (e.g. the Accessory
    // Fish Plate Set for item 773 when the user picked Steam Engine).
    let _exactMatch = null;
    const _rawLC = _rawInput.toLowerCase();
    const _prefType = (wizard.data && wizard.data._suggestedItemType) || '';
    const _prefRoad = (wizard.data && wizard.data._suggestedRoadName) || '';
    if (_prefType) {
      _exactMatch = state.masterData.find(i =>
        i.itemNum.toLowerCase() === _rawLC &&
        String(i.itemType || '').trim() === String(_prefType).trim() &&
        (!_prefRoad || String(i.roadName || '').trim() === String(_prefRoad).trim())
      );
      if (!_exactMatch) {
        _exactMatch = state.masterData.find(i =>
          i.itemNum.toLowerCase() === _rawLC &&
          String(i.itemType || '').trim() === String(_prefType).trim()
        );
      }
    }
    // Also honor an already-set matchedItem if it's for this itemNum
    // (e.g. _selectGrouping re-resolved it to the engine row).
    if (!_exactMatch && wizard.matchedItem && wizard.matchedItem.itemNum &&
        String(wizard.matchedItem.itemNum).toLowerCase() === _rawLC) {
      _exactMatch = wizard.matchedItem;
    }
    if (!_exactMatch) {
      _exactMatch = state.masterData.find(i => i.itemNum.toLowerCase() === _rawLC);
    }
    // Hyphen-variant fallback (2026-05-18). Some manufacturers store item
    // numbers with a hyphen before the letter suffix (Weaver "1076-L") while
    // Google Lens / casual text drops it ("1076L"). Try both forms before
    // declaring no exact match.
    if (!_exactMatch) {
      const _variants = [];
      const _mNoHyphen = _rawLC.match(/^(\d{2,5})([a-z]+)$/);     // 1076L -> 1076-L
      if (_mNoHyphen) _variants.push(_mNoHyphen[1] + '-' + _mNoHyphen[2]);
      const _mHyphen = _rawLC.match(/^(\d{2,5})-([a-z]+)$/);      // 1076-L -> 1076L
      if (_mHyphen) _variants.push(_mHyphen[1] + _mHyphen[2]);
      for (const _v of _variants) {
        const _hit = state.masterData.find(i => i.itemNum.toLowerCase() === _v);
        if (_hit) {
          _exactMatch = _hit;
          // Canonicalize wizard.data.itemNum to the master form so the
          // personal-sheet save and subsequent lookups all align.
          wizard.data.itemNum = _hit.itemNum;
          break;
        }
      }
    }

    if (!_exactMatch) {
      // No exact match — look for partial matches (items whose number contains the input)
      const _seen = new Set();
      const _partials = state.masterData.filter(m => {
        if (!m.itemNum.toLowerCase().includes(_numPart)) return false;
        if (_keyParts.length > 0) {
          const hay = (m.roadName + ' ' + m.description + ' ' + m.varDesc).toLowerCase();
          if (!_keyParts.every(kp => hay.includes(kp))) return false;
        }
        // Deduplicate by itemNum
        if (_seen.has(m.itemNum)) return false;
        _seen.add(m.itemNum);
        return true;
      });

      if (_partials.length === 1) {
        // Single match — auto-select it
        wizard.data.itemNum = _partials[0].itemNum;
        wizard.data._partialMatches = [];
        wizard.matchedItem = _partials[0];
        lookupItem(_partials[0].itemNum);
      } else if (_partials.length > 1) {
        // Multiple partial matches — store them for itemPicker step
        wizard.data._partialMatches = _partials;
        wizard.data._partialQuery = _rawInput;
      } else {
        // No matches at all — allow adding as custom item
        wizard.data._partialMatches = [];
      }
    } else {
      // Exact match found
      wizard.data._partialMatches = [];
      wizard.data.itemNum = _exactMatch.itemNum;
      wizard.matchedItem = _exactMatch;
    }

    // If grouping buttons are visible, require a selection before advancing
    const _grpEl = document.getElementById('wiz-grouping-btns');
    const _hasButtons = _grpEl && _grpEl.style.display !== 'none' && _grpEl.innerHTML.indexOf('button') >= 0;
    if (_hasButtons && !wizard.data._itemGrouping) {
      showToast('Please select how you are entering this item.'); return;
    }
    // If no buttons shown, default to single
    if (!wizard.data._itemGrouping) wizard.data._itemGrouping = 'single';
    _fyiAlreadyOwned(wizard.data.itemNum);   // v0.9.647
  }
  // conditionDetails: commit slider defaults if user never moved them
  if (s.type === 'conditionDetails') {
    if (!wizard.data.condition) wizard.data.condition = 7;
    const g = wizard.data._itemGrouping || 'single';
    if (g === 'engine_tender') {
      if (!wizard.data.tenderCondition) wizard.data.tenderCondition = 7;
    }
    if (['aa','ab','aba'].includes(g)) {
      if (!wizard.data.unit2Condition) wizard.data.unit2Condition = 7;
    }
    if (g === 'aba') {
      if (!wizard.data.unit3Condition) wizard.data.unit3Condition = 7;
    }
    // For simplified types (Catalog/Paper/IS/Science/Construction) est worth is embedded and required
    const _valMaster = wizard.matchedItem || findMaster((wizard.data.itemNum||''));
    const _valType = (_valMaster && _valMaster.itemType) ? _valMaster.itemType : '';
    const _valIsEmbedded = ['Science Set','Construction Set','Catalog','Instruction Sheet'].includes(_valType)
      || _valType.toLowerCase().includes('paper') || _valType.toLowerCase().includes('catalog');
    if (_valIsEmbedded && !(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // purchaseValue: est worth is required
  if (s.type === 'purchaseValue') {
    var _pvWorth = String(wizard.data.userEstWorth || '').trim();
    if (!_pvWorth || parseFloat(_pvWorth) <= 0) {
      // Bugfix 2026-04-14: was silently blocking — now highlight the field red + show inline message
      showToast('Please enter an estimated worth greater than 0.', 4000, true);
      var _pvInput = document.getElementById('pv-worth');
      if (_pvInput) {
        var _pvBox = _pvInput.closest('div');
        if (_pvBox) {
          _pvBox.style.border = '2px solid var(--accent)';
          _pvBox.style.boxShadow = '0 0 0 3px rgba(224,64,40,0.2)';
          _pvInput.focus();
          setTimeout(function() {
            _pvBox.style.border = ''; _pvBox.style.boxShadow = '';
          }, 3000);
        }
      }
      return;
    }
  }
  // boxCondDetails: commit slider defaults if user never moved them
  if (s.type === 'boxCondDetails') {
    if (!wizard.data.boxCond) wizard.data.boxCond = 7;
    var _bcg = wizard.data._itemGrouping || 'single';
    if (_bcg === 'engine_tender' && !wizard.data.tenderBoxCond) wizard.data.tenderBoxCond = 7;
    if ((_bcg === 'aa' || _bcg === 'ab') && !wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7;
    if (_bcg === 'aba') { if (!wizard.data.unit2BoxCond) wizard.data.unit2BoxCond = 7; if (!wizard.data.unit3BoxCond) wizard.data.unit3BoxCond = 7; }
  }
  // boxVariationPicker: require a selection
  if (s.type === 'boxVariationPicker') {
    if (!wizard.data.boxVariation && wizard.data.boxVariation !== '') {
      showToast('Please select a box type.'); return;
    }
  }
  // boxPurchaseValue: all optional
  if (s.type === 'boxPurchaseValue') { /* all optional */ }
  // paperExtras: est worth required
  if (s.type === 'paperExtras') {
    if (!(wizard.data.eph_estValue || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // drivePhotos with moneyField (IS flow): est worth required
  if (s.type === 'drivePhotos' && s.moneyField) {
    if (!(wizard.data[s.moneyField.key] || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  // manualPurchaseValue: est worth required
  if (s.type === 'manualPurchaseValue') {
    if (!(wizard.data.userEstWorth || '').trim()) {
      showToast('Please enter an estimated worth.'); return;
    }
  }
  if (s.type === 'money' && !s.optional && !wizard.data[s.id]) {
    showToast('Please enter a value.'); return;
  }
  if ((s.type === 'choice2' || s.type === 'choice3') && !wizard.data[s.id]) {
    showToast('Please make a selection.'); return;
  }

  // Photo-only mode: after completing a drivePhotos step, save the link and close
  if (wizard.data._photoOnly && s.type === 'drivePhotos') {
    await savePhotoOnlyUpdate();
    return;
  }

  // Set entry mode — store choice and launch first item
  if (s.id === 'set_entryMode') {
    // setEntryMode type handles its own save/advance via button handlers
    // This path is reached if entryMode=full was set and Next was clicked
    wizard.data._setEntryMode = wizard.data._setEntryMode || 'full';
    wizardAdvance();
    return;
  }

  // set_photos — after photos step, if came from QE Photo button, save and close
  if (s.id === 'set_photos' && wizard.data._setPhotoThenSave) {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving\u2026'; }
    try {
      // Convert drivePhotos data to file objects for upload
      const photoData = wizard.data.set_photos || {};
      const photoFiles = {};
      Object.keys(photoData).forEach(k => {
        if (photoData[k] && photoData[k].file) photoFiles[k] = photoData[k].file;
      });
      const cond = wizard.data._setCondition || 7;
      const worth = wizard.data._setWorth || '';
      await _quickEntrySaveSet(cond, worth, photoFiles);
    } catch(e) {
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Next \u2192'; }
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : '\u274c Save failed: ' + e.message, 5000);
    }
    return;
  }

  // set_walkItems — launch per-item wizard for Full Entry
  if (s.id === 'set_walkItems') {
    launchSetItemWizard();
    return;
  }

  // Set confirm
  if (s.id === 'set_confirm') {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveSet(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Instruction Sheet confirm
  if (s.id === 'is_confirm') {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveInstructionSheet(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }



  // Ephemera confirm — must be checked BEFORE generic confirm
  const _ephTabIds = ['paper','mockups','other',...(state.userDefinedTabs||[]).map(t=>t.id)];
  if (s.id === 'eph_confirm' || (s.type === 'confirm' && _ephTabIds.includes(wizard.tab))) {
    // If paper type is Instruction Sheet, route to IS save instead
    if (wizard.data.eph_paperType === 'Instruction Sheet') {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await saveInstructionSheet(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    // If paper type is Catalog, route to Catalogs tab save
    if (wizard.data.eph_paperType === 'Catalog') {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveCatalogFromPaper(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveEphemeraItem(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Manual entry confirm — separate save path, no catalog matching
  if (s.type === 'confirm' && wizard.data._manualEntry) {
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await _saveManualEntry(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Generic confirm — train/collection/sold/want items
  if (s.type === 'confirm') {
    // Check if this is a Science Set or Construction Set — save to dedicated tab
    const _scMaster = wizard.matchedItem || {};
    const _scType = _scMaster.itemType || '';
    const _scTab = _scMaster._tab || '';
    if (_scType === 'Science Set' || _scTab === SHEET_TABS.science) {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveScienceConstructionItem('Science Sets', 'scienceData'); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_scType === 'Construction Set' || _scTab === SHEET_TABS.construction) {
      if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
      try { await _saveScienceConstructionItem('Construction Sets', 'constructionData'); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
      if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
      return;
    }
    if (_nextBtn) { _nextBtn.disabled = true; _nextBtn.textContent = 'Saving…'; }
    try { await saveWizardItem(); } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true); }
    if (_nextBtn) { _nextBtn.disabled = false; _nextBtn.textContent = 'Save →'; }
    return;
  }

  // Commit slider default if user never moved it
  if (s.type === 'slider' && (wizard.data[s.id] === undefined || wizard.data[s.id] === null)) {
    wizard.data[s.id] = 7;
  }

  // Advance
  wizard.step++;

  // Skip steps based on skipIf
  while (wizard.step < steps.length - 1 && steps[wizard.step].skipIf && steps[wizard.step].skipIf(wizard.data)) {
    wizard.step++;
  }

  // Brad request (Session 161+): if we're on the For Sale tab and the next
  // step is pickForSaleItem, auto-trigger the reroute to the full collection
  // flow. The user wants the same screens as a normal Add to Collection plus
  // a Sale Price step at the end — never the short For Sale flow.
  if (wizard.tab === 'forsale' && wizard.steps[wizard.step]
      && wizard.steps[wizard.step].id === 'pickForSaleItem'
      && typeof wizardPickForSaleItem === 'function') {
    wizardPickForSaleItem('__new__');
    return;
  }

  // Push history so the back button returns to the previous step
  history.pushState({ appPage: 'wizard', step: wizard.step }, '', '');

  renderWizardStep();
}

// ── Save functions (moved to wizard-save.js — Session 110, Round 1 Chunk 9 / final) ──

// ── quickEntryAdd (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

// ── Multi-unit Quick Entry UI helpers (moved to wizard-quickentry.js — Session 110, Round 1 Chunk 7) ──

// ══════════════════════════════════════════════════════════════
// appConfirm — in-app replacement for native confirm().
// Returns a Promise<boolean>. Unlike window.confirm() (which is a
// blocking OS-level modal that hung Claude in Chrome + sometimes
// gets stuck on mobile), this is a non-blocking overlay that
// styles with the app theme.
//
// Usage: if (await appConfirm('Are you sure?')) { ... }
// ══════════════════════════════════════════════════════════════
// ── appConfirm + showToast (moved to wizard-utils.js — Session 110, Round 1 Chunk 3) ──


// ── Ident
// ══════════════════════════════════════════════════════════════
// v0.9.907 (Brad, item [1a]): variation-step photo preview.
// Shows the photo you're adding — from a barcode/Identify capture
// (a File in hand) or from the Photo Inbox (a Drive file id handed
// over by _pinAddNow) — at the top of the variation step, or to the
// right of the list on a wide desktop. Tap to zoom full-screen.
// ══════════════════════════════════════════════════════════════
window._wizVarZoom = function (src) {
  if (!src) return;
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:1rem;cursor:zoom-out';
  ov.innerHTML = '<img src="' + src + '" style="max-width:100%;max-height:100%;border-radius:8px" alt="">' +
    '<button type="button" style="position:absolute;top:12px;right:14px;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:1.6rem;line-height:1;cursor:pointer;border-radius:8px;padding:0.1rem 0.55rem">✕</button>';
  var close = function () { try { ov.remove(); } catch (e) {} if (window.BackStack) window.BackStack.pop('_wiz-var-zoom'); };
  ov.onclick = close;
  document.body.appendChild(ov);
  if (window.BackStack) window.BackStack.push('_wiz-var-zoom', function () { try { ov.remove(); } catch (e) {} });
};

window._wizVarInsertPhoto = function (container) {
  if (!container || typeof wizard === 'undefined' || !wizard || !wizard.data) return;
  var f = wizard.data._idItemPhotoFile || window._idLastPhotoFile || wizard.data._biBoxPhotoFile || null;
  var driveId = wizard.data._addPhotoDriveId || '';
  if (!f && !driveId) return;
  var wide = !window.IS_MOBILE_UA && (window.innerWidth || 0) >= 760;
  var box = document.createElement('div');
  box.style.cssText = wide ? 'flex:0 0 240px;align-self:flex-start' : 'width:100%;margin-bottom:0.7rem';
  box.innerHTML = '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-bottom:0.3rem">The photo you’re adding</div>' +
    '<div id="_wizVarPhotoWrap" title="Tap to zoom" style="position:relative;border-radius:10px;overflow:hidden;background:#0d0d0d;cursor:zoom-in;' + (wide ? '' : 'max-width:280px;') + '">' +
    '<img id="_wizVarPhotoImg" style="width:100%;display:block;object-fit:contain;max-height:' + (wide ? '340px' : '240px') + '" alt="Item photo">' +
    '<div style="position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,0.55);color:#fff;font-size:0.62rem;padding:2px 7px;border-radius:9px;pointer-events:none">tap to zoom</div>' +
    '</div>';
  if (wide) {
    var content = document.createElement('div');
    content.style.cssText = 'flex:1;min-width:0';
    while (container.firstChild) content.appendChild(container.firstChild);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:1rem;align-items:flex-start';
    row.appendChild(content);
    row.appendChild(box);
    container.appendChild(row);
  } else {
    container.insertBefore(box, container.firstChild);
  }
  var img = document.getElementById('_wizVarPhotoImg');
  var objUrl = '';
  if (f) {
    try { objUrl = URL.createObjectURL(f); if (img) img.src = objUrl; } catch (e) {}
  } else if (driveId && typeof loadDriveThumb === 'function' && img) {
    try { loadDriveThumb(driveId, img, img.parentElement); } catch (e) {}
  }
  var wrap = document.getElementById('_wizVarPhotoWrap');
  if (wrap) wrap.onclick = function () { window._wizVarZoom((img && img.src) || objUrl); };
};
