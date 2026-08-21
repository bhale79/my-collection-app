// ════════════════════════════════════════════════════════════════
// bulk-tag.js — putting your own words on many items at once.
// v0.9.1555 (Session 82). Brad's design, in his words:
//
//   "if i get into mint cars like scott is… i would want to have an add
//    column button. i set the column up to say sub collection. so the next
//    question is what is the sub collection, i would say Mint Cars. when i
//    hit next it brings up my collection page where i can check items like
//    the share button. i can then filter or search things. i would probably
//    type mint in the search and it would bring up all my mint cars. i can
//    then hit select all or tick the ones i want to. then i hit apply, and
//    it puts Mint Cars in those sub collection column. then i can hit done
//    or i can add another sub collection, say Disney."
//
// Two rules he added, both about not losing anything:
//   • "apply writes immediately" — so each Apply is its own undoable step.
//   • "let the user see if an item has a pre existing sub collection text"
//     — the value already on a row is shown IN the row while ticking, not
//     reported as a count afterwards.
//
// SELF-CONTAINED & REMOVABLE (the photo-inbox.js rule): delete the script
// tag, the sw.js precache line, and bump versions. Everything else this
// touches is a public entry point that already existed.
// ════════════════════════════════════════════════════════════════

/* eslint-disable no-var */

var _rrTag = null;      // { field, label, value, sel: {invId: true}, replace }
var _RR_TAG_UNDO = 'rr_tag_undo_v1';

// The fields a person may set in bulk: their OWN words about their own
// items. Never item number, variation or condition — those are facts about
// one item, not labels you paint across forty.
function rrTagFields() {
  // v0.9.1555b (Brad): "now location is a different beast, cause it can be 2
  // columns that need to be seen together — location, and sub location. so
  // storage room 2, tote 1." A place is one fact written in two columns, so
  // Location asks for both and writes both. Location Detail is not offered
  // on its own: a tote with no room is not an address.
  var out = [
    { key: 'subCollection', label: 'Sub-collection' },
    { key: 'subType', label: 'Sub Type' },
    { key: 'location', label: 'Location', pair: 'locationDetail', pairLabel: 'Location Detail' },
    { key: 'shipper', label: 'Shipper' },
  ];
  try {
    (window.RR_USER_FIELDS || []).forEach(function (f) {
      if (!f.custom) return;
      if (typeof rrFieldEnabled === 'function' && !rrFieldEnabled(f)) return;
      out.push({ key: f.key, label: (typeof rrFieldLabel === 'function') ? rrFieldLabel(f) : f.label });
    });
  } catch (e) {}
  return out;
}

function rrTagActive() { return !!_rrTag; }
function rrTagField() { return _rrTag ? _rrTag.field : ''; }

// ── Step 1 + 2: which column, and what goes in it ───────────────
function rrTagOpen(preField, preValue, prePair) {
  var fields = rrTagFields();
  var old = document.getElementById('rr-tag-setup'); if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'rr-tag-setup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9750;display:flex;'
    + 'align-items:center;justify-content:center;padding:1rem';
  ov.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:420px;width:100%;padding:1.1rem;font-family:var(--font-body)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">'
    +   '<strong style="font-size:1.02rem;color:var(--text)">Fill in a column</strong>'
    +   '<button onclick="document.getElementById(\'rr-tag-setup\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">&times;</button>'
    + '</div>'
    + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">'
    +   'Pick the column, say what goes in it, then tick the items it applies to.</div>'
    + '<label style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.2rem">Column</label>'
    + '<select id="rr-tag-field" class="pref-select" style="width:100%;margin-bottom:0.6rem">'
    +   fields.map(function (f) {
          return '<option value="' + f.key + '"' + (preField === f.key ? ' selected' : '') + '>' + f.label + '</option>';
        }).join('')
    + '</select>'
    + '<label id="rr-tag-vlabel" style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.2rem">What is it?</label>'
    + '<input id="rr-tag-value" type="text" list="rr-tag-dl" placeholder="e.g. Mint Cars" '
    +   'value="' + _rrTagEsc(preValue || '') + '" '
    +   'style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);border-radius:8px;'
    +   'padding:0.55rem 0.7rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem">'
    + '<datalist id="rr-tag-dl"></datalist>'
    // The second half of a paired field — the tote inside the room.
    + '<div id="rr-tag-pair-wrap" style="display:none;margin-top:0.55rem">'
    +   '<label id="rr-tag-plabel" style="display:block;font-size:0.75rem;color:var(--text-dim);margin-bottom:0.2rem">Location Detail</label>'
    +   '<input id="rr-tag-pair" type="text" list="rr-tag-dl2" placeholder="e.g. Tote 1" '
    +     'style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);border-radius:8px;'
    +     'padding:0.55rem 0.7rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem" '
    +     'value="' + _rrTagEsc(prePair || '') + '">'
    +   '<datalist id="rr-tag-dl2"></datalist>'
    +   '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Both are written together. Leave this empty to set only the place.</div>'
    + '</div>'
    + '<div id="rr-tag-seen" style="font-size:0.75rem;color:var(--text-dim);margin-top:0.4rem"></div>'
    + '<div style="display:flex;gap:0.5rem;margin-top:0.9rem">'
    +   '<button onclick="document.getElementById(\'rr-tag-setup\').remove()" style="flex:1;padding:0.55rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
    +   '<button onclick="rrTagNext()" style="flex:2;padding:0.55rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Next →</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  var sel = document.getElementById('rr-tag-field');
  if (sel) sel.addEventListener('change', rrTagShowSeen);
  var inp = document.getElementById('rr-tag-value');
  if (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') rrTagNext(); });
    inp.addEventListener('input', rrTagShowSeen);   // v0.9.1555b: re-scope the detail list
    setTimeout(function () {
      // Prefilled from Preferences → Storage Locations: the place is already
      // answered, so start where there is something to do.
      var pin2 = document.getElementById('rr-tag-pair');
      if (preValue && pin2 && document.getElementById('rr-tag-pair-wrap').style.display !== 'none') pin2.focus();
      else inp.focus();
    }, 40);
  }
  var pin = document.getElementById('rr-tag-pair');
  if (pin) pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') rrTagNext(); });
  rrTagShowSeen();
}

// What is already in this column, so nobody invents "Mint cars" when they
// already have "Mint Cars" on forty items.
function rrTagShowSeen() {
  var el = document.getElementById('rr-tag-seen');
  var sel = document.getElementById('rr-tag-field');
  if (!el || !sel) return;
  var key = sel.value, seen = {};
  // v0.9.1555b: paired field → show the second box, and offer the places the
  // user has already set up (Preferences → Storage Locations, v0.9.1532).
  try {
    var def = rrTagFields().filter(function (f) { return f.key === key; })[0] || {};
    var wrap = document.getElementById('rr-tag-pair-wrap');
    var plab = document.getElementById('rr-tag-plabel');
    var vlab = document.getElementById('rr-tag-vlabel');
    if (wrap) wrap.style.display = def.pair ? 'block' : 'none';
    if (plab && def.pairLabel) plab.textContent = def.pairLabel;
    if (vlab) vlab.textContent = def.pair ? 'Which place?' : 'What is it?';
    var dl = document.getElementById('rr-tag-dl');
    if (dl) {
      var opts = [];
      if (def.key === 'location' && typeof rrSavedLocations === 'function') {
        opts = rrSavedLocations().map(function (l) { return l.name; });
      }
      dl.innerHTML = opts.map(function (v) { return '<option value="' + _rrTagEsc(v) + '"></option>'; }).join('');
    }
    var v1 = document.getElementById('rr-tag-value');
    var dl2 = document.getElementById('rr-tag-dl2');
    if (dl2 && def.pair && typeof rrLocationDetails === 'function') {
      var det = rrLocationDetails(v1 ? v1.value : '');
      dl2.innerHTML = det.map(function (v) { return '<option value="' + _rrTagEsc(v) + '"></option>'; }).join('');
    }
  } catch (ePair) {}
  try {
    Object.values(state.personalData || {}).forEach(function (pd) {
      var v = pd && pd[key] ? String(pd[key]).trim() : '';
      if (v) seen[v] = (seen[v] || 0) + 1;
    });
  } catch (e) {}
  var names = Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; });
  if (!names.length) { el.textContent = 'Nothing uses this column yet.'; return; }
  el.innerHTML = 'Already in use: ' + names.slice(0, 6).map(function (n) {
    return '<button type="button" onclick="document.getElementById(\'rr-tag-value\').value=' +
      JSON.stringify(n).replace(/"/g, '&quot;') + '" style="border:1px solid var(--border);background:var(--surface2);' +
      'color:var(--text-mid);border-radius:999px;padding:0.05rem 0.5rem;font-size:0.72rem;cursor:pointer;margin:0.1rem 0.15rem 0 0">' +
      (n.replace(/</g, '&lt;')) + ' <span style="color:var(--text-dim)">' + seen[n] + '</span></button>';
  }).join('') + (names.length > 6 ? ' <span style="color:var(--text-dim)">+' + (names.length - 6) + ' more</span>' : '');
}

// ── Step 3: into the collection, ticking ────────────────────────
function rrTagNext() {
  var sel = document.getElementById('rr-tag-field');
  var inp = document.getElementById('rr-tag-value');
  var key = sel ? sel.value : '';
  var val = inp ? String(inp.value || '').trim() : '';
  if (!key) return;
  if (!val) {
    if (inp) { inp.style.borderColor = 'var(--accent)'; inp.focus(); }
    if (typeof showToast === 'function') showToast('Type what goes in the column first', 2500);
    return;
  }
  var fields = rrTagFields();
  var def = fields.filter(function (f) { return f.key === key; })[0] || {};
  var pinp = document.getElementById('rr-tag-pair');
  var pval = (def.pair && pinp) ? String(pinp.value || '').trim() : '';
  _rrTag = { field: key, label: def.label || key, value: val, sel: {}, replace: false,
             pair: def.pair || '', pairLabel: def.pairLabel || '', pairValue: pval };
  var ov = document.getElementById('rr-tag-setup'); if (ov) ov.remove();

  // Show the column being filled, so the value already on a row is visible
  // while ticking — Brad: "let the user see if an item has a pre existing
  // sub collection text."
  try {
    if (typeof _collVisibleCols === 'function' && typeof _collSaveCols === 'function') {
      var vis = _collVisibleCols().filter(function (c) { return (window._COLL_LOCKED || []).indexOf(c) < 0; });
      var want = [key];
      if (_rrTag.pair) want.push(_rrTag.pair);      // a place is two columns
      want.forEach(function (k) { if (vis.indexOf(k) < 0) vis.push(k); });
      _collSaveCols(vis);
    }
  } catch (e) {}

  if (typeof showPage === 'function') showPage('browse');
  try { if (!state.filters.owned) { state.filters.owned = true; } } catch (e) {}
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}
  if (typeof _renderCollectionHeader === 'function') _renderCollectionHeader();
  if (typeof renderBrowse === 'function') renderBrowse();
  rrTagBar();
}

function rrTagToggle(key) {
  if (!_rrTag || !key) return;
  if (_rrTag.sel[key]) delete _rrTag.sel[key]; else _rrTag.sel[key] = true;
  rrTagBar();
}
function rrTagIsSelected(key) { return !!(_rrTag && _rrTag.sel[key]); }

// "Select all" means everything the CURRENT search and filters are showing —
// which is how Brad described using it: type mint, select all.
function rrTagSelectAllShown() {
  if (!_rrTag) return;
  var n = 0;
  try {
    document.querySelectorAll('#page-browse .item-table tbody tr[id^="share-card-"]').forEach(function (tr) {
      var k = tr.id.replace('share-card-', '');
      if (!k) return;
      _rrTag.sel[k] = true; n++;
    });
  } catch (e) {}
  if (typeof renderBrowse === 'function') renderBrowse();
  rrTagBar();
  if (typeof showToast === 'function') showToast(n.toLocaleString() + ' selected on this page', 2200);
}
function rrTagClearSel() {
  if (!_rrTag) return;
  _rrTag.sel = {};
  if (typeof renderBrowse === 'function') renderBrowse();
  rrTagBar();
}

// How many of the ticked rows already carry a value in this column.
function rrTagConflicts() {
  if (!_rrTag) return [];
  var out = [];
  try {
    Object.keys(_rrTag.sel).forEach(function (k) {
      var pd = _rrTagPdFor(k);
      if (!pd) return;
      var cur = pd[_rrTag.field] ? String(pd[_rrTag.field]).trim() : '';
      if (cur && cur !== _rrTag.value) out.push({ key: k, pd: pd, cur: cur });
    });
  } catch (e) {}
  return out;
}
function _rrTagPdFor(key) {
  try {
    var all = Object.values(state.personalData || {});
    for (var i = 0; i < all.length; i++) {
      if (all[i] && String(all[i].inventoryId || '') === String(key)) return all[i];
    }
    // Composite fallback key: itemNum|variation|row (the share-key shape).
    var parts = String(key).split('|');
    if (parts.length === 3) {
      for (var j = 0; j < all.length; j++) {
        if (all[j] && String(all[j].itemNum) === parts[0] && String(all[j].row) === parts[2]) return all[j];
      }
    }
  } catch (e) {}
  return null;
}

function rrTagBar() {
  var bar = document.getElementById('rr-tag-bar');
  if (!_rrTag) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'rr-tag-bar';
    document.body.appendChild(bar);
  }
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9760;background:var(--surface);'
    + 'border-top:2px solid var(--accent);padding:0.6rem 0.9rem;display:flex;flex-wrap:wrap;gap:0.5rem;'
    + 'align-items:center;font-family:var(--font-body);box-shadow:0 -4px 18px rgba(0,0,0,0.35)';
  var n = Object.keys(_rrTag.sel).length;
  var conf = rrTagConflicts().length;
  bar.innerHTML =
    '<div style="flex:1;min-width:200px;font-size:0.85rem;color:var(--text)">'
    + 'Filling <strong>' + _rrTagEsc(_rrTag.label) + '</strong> with <strong style="color:var(--accent2,#d4a843)">'
    + _rrTagEsc(_rrTag.value)
    + (_rrTag.pairValue ? ' \u00b7 ' + _rrTagEsc(_rrTag.pairValue) : '') + '</strong>'
    + '<div style="font-size:0.76rem;color:var(--text-dim)">' + n.toLocaleString() + ' selected'
    + (conf ? ' · <span style="color:var(--accent2,#d4a843)">' + conf + ' already have something here</span>' : '')
    + ' · search and filter as you go; ticks are kept</div></div>'
    + '<button onclick="rrTagSelectAllShown()" style="' + _rrTagBtn() + '">Select all shown</button>'
    + (n ? '<button onclick="rrTagClearSel()" style="' + _rrTagBtn() + '">Clear</button>' : '')
    + '<button onclick="rrTagApply()" ' + (n ? '' : 'disabled ')
    + 'style="' + _rrTagBtn(true) + (n ? '' : ';opacity:0.45;cursor:default') + '">Apply to ' + n.toLocaleString() + '</button>'
    + '<button onclick="rrTagDone()" style="' + _rrTagBtn() + '">Done</button>';
}
function _rrTagBtn(primary) {
  return 'padding:0.45rem 0.9rem;border-radius:9px;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer;'
    + (primary ? 'border:none;background:var(--accent);color:var(--on-accent)'
               : 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)');
}
function _rrTagEsc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Apply — writes immediately, and remembers how to undo it ────
async function rrTagApply() {
  if (!_rrTag) return;
  var keys = Object.keys(_rrTag.sel);
  if (!keys.length) return;
  var conflicts = rrTagConflicts();
  var replaceThem = false;
  if (conflicts.length) {
    // Brad's rule: nothing is lost by accident. Say what is there, and let
    // him choose. Cancel means neither — go back and untick them.
    var msg = conflicts.length.toLocaleString() + ' of the ' + keys.length.toLocaleString()
      + ' you picked already have something in ' + _rrTag.label + ' (for example "'
      + conflicts[0].cur + '").\n\nOK  = replace those too\nCancel = leave those alone, fill the rest';
    replaceThem = window.confirm(msg);
  }
  var targets = [];
  keys.forEach(function (k) {
    var pd = _rrTagPdFor(k);
    if (!pd || !pd.row) return;
    var cur = pd[_rrTag.field] ? String(pd[_rrTag.field]).trim() : '';
    if (cur === _rrTag.value) return;                 // already says it
    if (cur && !replaceThem) return;                  // leave it alone
    targets.push({ key: k, pd: pd, prev: cur });
  });
  if (!targets.length) {
    if (typeof showToast === 'function') showToast('Nothing to change — those already say ' + _rrTag.value, 3000);
    return;
  }
  var col = _rrTagColLetter(_rrTag.field);
  if (!col) { if (typeof showToast === 'function') showToast('That column is not on your sheet yet', 4000, true); return; }
  // v0.9.1555b: a place is two columns written together, or it is half an
  // address. "Storage Room 2" with no tote helps nobody find anything.
  var col2 = (_rrTag.pair && _rrTag.pairValue) ? _rrTagColLetter(_rrTag.pair) : '';

  if (typeof showToast === 'function') showToast('Writing ' + targets.length.toLocaleString() + ' items…', 2000);
  var data = [];
  targets.forEach(function (t) {
    data.push({ range: PERSONAL_TAB + '!' + col + t.pd.row, values: [[_rrTag.value]] });
    if (col2) {
      t.prev2 = t.pd[_rrTag.pair] ? String(t.pd[_rrTag.pair]).trim() : '';
      data.push({ range: PERSONAL_TAB + '!' + col2 + t.pd.row, values: [[_rrTag.pairValue]] });
    }
  });
  try {
    // One request per 500 rows — the same shape the import uses, because a
    // request per row would take minutes on a collection this size.
    for (var i = 0; i < data.length; i += 500) {
      await _rrTagBatch(data.slice(i, i + 500));
    }
  } catch (e) {
    console.error('[bulk tag] write failed:', e);
    if (typeof showToast === 'function') showToast('Could not save: ' + (e && e.message ? e.message : 'error'), 6000, true);
    return;
  }
  // Local copy + undo record, then let the list repaint.
  targets.forEach(function (t) {
    t.pd[_rrTag.field] = _rrTag.value;
    if (col2) t.pd[_rrTag.pair] = _rrTag.pairValue;
  });
  _rrTagSaveUndo({
    when: new Date().toISOString(), field: _rrTag.field, label: _rrTag.label, value: _rrTag.value,
    pair: col2 ? _rrTag.pair : '', pairValue: col2 ? _rrTag.pairValue : '',
    rows: targets.map(function (t) {
      return { row: t.pd.row, prev: t.prev, prev2: (t.prev2 || ''), invId: t.pd.inventoryId || '' };
    }),
  });
  _rrTag.sel = {};
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}
  if (typeof renderBrowse === 'function') renderBrowse();
  rrTagBar();
  if (typeof showToast === 'function') {
    showToast('✓ ' + targets.length.toLocaleString() + ' items set to ' + _rrTag.value
      + (conflicts.length && !replaceThem ? ' · ' + conflicts.length + ' left as they were' : '')
      + ' — tap Undo in Preferences to reverse', 5000);
  }
}
async function _rrTagBatch(data) {
  var res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '/values:batchUpdate', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data }),
  });
  if (!res.ok) throw new Error('Sheets said ' + res.status);
  return res.json();
}
function _rrTagColLetter(field) {
  try {
    var i = (typeof PERSONAL_FIELD_INDEX !== 'undefined') ? PERSONAL_FIELD_INDEX[field] : undefined;
    if (i === undefined) return '';
    return (typeof _impColLetter === 'function') ? _impColLetter(i + 1) : _rrTagLetter(i + 1);
  } catch (e) { return ''; }
}
function _rrTagLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function _rrTagSaveUndo(batch) {
  try {
    var all = JSON.parse(localStorage.getItem(_RR_TAG_UNDO) || '[]');
    all.push(batch);
    localStorage.setItem(_RR_TAG_UNDO, JSON.stringify(all.slice(-10)));
  } catch (e) {}
}

// ── Done / another round ────────────────────────────────────────
function rrTagDone() {
  _rrTag = null;
  var bar = document.getElementById('rr-tag-bar'); if (bar) bar.remove();
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}
  if (typeof renderBrowse === 'function') renderBrowse();
}

// ── Undo, from Preferences ──────────────────────────────────────
function rrTagUndoListHtml() {
  var all = [];
  try { all = JSON.parse(localStorage.getItem(_RR_TAG_UNDO) || '[]'); } catch (e) {}
  if (!all.length) return '';
  return all.slice().reverse().slice(0, 3).map(function (b, i) {
    var when = String(b.when || '').slice(0, 16).replace('T', ' ');
    var _v = _rrTagEsc(b.value) + (b.pairValue ? ' \u00b7 ' + _rrTagEsc(b.pairValue) : '');
    return '<div class="pref-row"><div class="pref-row-label"><strong>' + _rrTagEsc(b.label) + ' → ' + _v + '</strong>'
      + '<span>' + (b.rows || []).length.toLocaleString() + ' items · ' + when + '</span></div>'
      + '<button class="pref-btn danger" onclick="rrTagUndo(' + (all.length - 1 - i) + ',this)">Undo</button></div>';
  }).join('');
}
async function rrTagUndo(idx, btn) {
  var all = [];
  try { all = JSON.parse(localStorage.getItem(_RR_TAG_UNDO) || '[]'); } catch (e) {}
  var b = all[idx];
  if (!b) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Undoing…'; }
  var col = _rrTagColLetter(b.field);
  if (!col) { if (btn) { btn.disabled = false; btn.textContent = 'Undo'; } return; }
  var col2 = b.pair ? _rrTagColLetter(b.pair) : '';
  var data = [];
  (b.rows || []).forEach(function (r) {
    data.push({ range: PERSONAL_TAB + '!' + col + r.row, values: [[r.prev || '']] });
    // Both halves go back, or undoing a place leaves a tote behind.
    if (col2) data.push({ range: PERSONAL_TAB + '!' + col2 + r.row, values: [[r.prev2 || '']] });
  });
  try {
    for (var i = 0; i < data.length; i += 500) await _rrTagBatch(data.slice(i, i + 500));
  } catch (e) {
    if (typeof showToast === 'function') showToast('Undo failed: ' + (e && e.message ? e.message : 'error'), 5000, true);
    if (btn) { btn.disabled = false; btn.textContent = 'Undo'; }
    return;
  }
  // Put the old values back in memory too.
  try {
    (b.rows || []).forEach(function (r) {
      Object.values(state.personalData || {}).forEach(function (pd) {
        if (!pd || String(pd.row) !== String(r.row)) return;
        pd[b.field] = r.prev || '';
        if (b.pair) pd[b.pair] = r.prev2 || '';
      });
    });
  } catch (e) {}
  all.splice(idx, 1);
  try { localStorage.setItem(_RR_TAG_UNDO, JSON.stringify(all)); } catch (e) {}
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}
  if (typeof renderBrowse === 'function') renderBrowse();
  if (typeof buildPreferences === 'function') buildPreferences();
  if (typeof showToast === 'function') showToast('✓ Put ' + (b.rows || []).length.toLocaleString() + ' items back', 4000);
}

if (typeof window !== 'undefined') {
  window.rrTagOpen = rrTagOpen;
  window.rrTagNext = rrTagNext;
  window.rrTagShowSeen = rrTagShowSeen;
  window.rrTagToggle = rrTagToggle;
  window.rrTagIsSelected = rrTagIsSelected;
  window.rrTagSelectAllShown = rrTagSelectAllShown;
  window.rrTagClearSel = rrTagClearSel;
  window.rrTagApply = rrTagApply;
  window.rrTagDone = rrTagDone;
  window.rrTagActive = rrTagActive;
  window.rrTagField = rrTagField;
  window.rrTagUndo = rrTagUndo;
  window.rrTagUndoListHtml = rrTagUndoListHtml;
  window.rrTagFields = rrTagFields;
}
