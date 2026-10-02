// ═══════════════════════════════════════════════════════════════════════════
// table-columns.js — ONE column editor for any table (v0.9.1864)
//
// Brad, 2026-10-02: "probably need the edit column function on the for sale
// page as well." Until now the ✎ / + Add / drag / × machinery was welded to
// My Collection (browse.js, v1517/v1543/v1862): its own column list, its own
// saved layout, its own header renderer, its own menu. Giving For Sale the
// same thing by copying it would have been a second copy of ~250 lines that
// drift apart — the exact pattern this app keeps paying for.
//
// So the machinery lives HERE, once, and a table REGISTERS itself:
//
//   rrTableDefine({
//     id:         'collection',                   // the handle every call takes
//     cols:       [{ col, label, field, noSort }], // the standard columns
//     extras:     RR_ROW_EXTRA_COLS,              // columns a user can add
//     locked:     ['mfr', 'num'],                 // always first, never moved
//     defaults:   ['mfr', 'num', ...],            // the layout with nothing saved
//     storageKey: 'lv_coll_columns_v1',           // the saved layout (travels — look-sync)
//     theadSel:   '#page-browse .item-table thead tr',
//     editKey:    '_collColEdit',                 // state[editKey] = edit mode on/off
//     sortState:  () => state._collSort,          // { col, dir } or null
//     sortCall:   '_collSortBy',                  // the global a heading's onclick calls
//     repaint:    () => { ... },                  // header + rows, after any change
//     // optional hooks — a table adds only what is its own:
//     label(col)        a custom label (My Collection: a named custom column)
//     noSort(c)         true when the column cannot sort
//     thStyle(c, edit)  extra inline style for its heading (widths, alignment)
//     leadTh()          a heading before the first column (the share/tag gutter)
//     afterHeader()     after the header is written (the sticky scrollbar)
//     visibleHook(list, hasSaved)   adjust the visible list (v1585's auto-join)
//     onAdd(col)        after a column is added (v1862: its Preferences switch)
//     menuFilter(c, vis)            list this column in + Add? (default: not shown, not locked)
//     menuExtra()       extra entries at the end of + Add (the spare custom slot)
//     editExtras()      extra buttons between + Add and Done (+ Custom column)
//   });
//
// What every table then gets, identically: rrTableVisible / Save / Add / Drop /
// SetOrder / Reset, the header in normal and edit mode (sort arrows, the
// one-sentence hover help from rrFieldHelp, 🔒 for locked, ☰ drag handles,
// × to remove, "+ Add" / "Done"), drag to reorder, and the + Add menu (hover
// help on desktop, the sentence under the name on a phone). A fix lands in
// both tables because there is only one place for it to land.
//
// The ROWS stay the table's own business: each builds its cells into a map
// and emits them in rrTableVisible(id) order. The engine never draws a row.
// ═══════════════════════════════════════════════════════════════════════════

// The personal-row columns ANY table of owned items can offer in + Add —
// plain values straight off the personal row (pdKey). One list, both tables.
// (Was browse.js's _COLL_EXTRA_COLS, v1517; browse.js aliases it.)
var RR_ROW_EXTRA_COLS = [
  { col: 'location',      label: 'Location',      pdKey: 'location' },
  { col: 'locationDetail',label: 'Location Detail', pdKey: 'locationDetail' },
  { col: 'cond',          label: 'Condition',     pdKey: 'condition' },
  { col: 'yourGrade',     label: 'Your Grade',    pdKey: 'yourGrade' },
  { col: 'yourDesc',      label: 'Your Description', pdKey: 'yourDescription' },
  { col: 'paid',          label: 'Price Paid',    pdKey: 'priceItem', money: true },
  { col: 'roadName',      label: 'Road Name',     pdKey: 'roadName' },
  { col: 'roadNumber',    label: 'Road Number',   pdKey: 'roadNumber' },
  { col: 'yearMade',      label: 'Year Made',     pdKey: 'yearMade' },
  { col: 'hasBox',        label: 'Has Box',       pdKey: 'hasBox' },
  { col: 'notes',         label: 'Notes',         pdKey: 'notes' },
  { col: 'subType',       label: 'Sub Type',      pdKey: 'subType' },
  { col: 'shipper',       label: 'Shipper',       pdKey: 'shipper' },
  { col: 'subCollection', label: 'Sub-collection', pdKey: 'subCollection' },
  { col: 'custom1',       label: 'Custom 1',      pdKey: 'custom1', userField: true },
  { col: 'custom2',       label: 'Custom 2',      pdKey: 'custom2', userField: true },
  { col: 'custom3',       label: 'Custom 3',      pdKey: 'custom3', userField: true },
  { col: 'custom4',       label: 'Custom 4',      pdKey: 'custom4', userField: true },
  { col: 'custom5',       label: 'Custom 5',      pdKey: 'custom5', userField: true },
];

// The value an extra column shows for a personal row, formatted (money gets
// the currency symbol). One formatter, both tables.
function rrRowExtraValue(xc, pd) {
  var v = (pd && pd[xc.pdKey] != null) ? String(pd[xc.pdKey]).trim() : '';
  if (xc.money && v) {
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    if (!isNaN(n)) v = (typeof _currencySymbol === 'function' ? _currencySymbol() : '$') + n.toLocaleString();
  }
  return v;
}
// …and the whole cell, escaped, with the column id stamped on it so widths
// follow the column (collection_columns_tests) and tests can read it back.
function rrRowExtraCellHtml(xc, pd, extraAttr) {
  var v = rrRowExtraValue(xc, pd);
  var esc = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return '<td data-col="' + xc.col + '"' + (extraAttr || '') +
    ' style="font-size:0.78rem;color:var(--text-mid);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc + '">' +
    (esc || '<span style="color:var(--text-dim)">—</span>') + '</td>';
}

var RR_TABLES = {};
function rrTableDefine(spec) {
  if (!spec || !spec.id || !Array.isArray(spec.cols) || !spec.storageKey || !spec.theadSel) {
    throw new Error('rrTableDefine: a table needs id, cols, storageKey and theadSel');
  }
  spec.extras = spec.extras || [];
  spec.locked = spec.locked || [];
  spec.defaults = spec.defaults || spec.cols.map(function (c) { return c.col; });
  RR_TABLES[spec.id] = spec;
  return spec;
}
function rrTable(id) {
  var t = RR_TABLES[id];
  if (!t) throw new Error('rrTable: no table "' + id + '" is defined');
  return t;
}
function rrTableCols(id) { var t = rrTable(id); return t.cols.concat(t.extras); }
function rrTableCol(id, col) {
  return rrTableCols(id).filter(function (c) { return c.col === col; })[0] || null;
}
function rrTableLabel(id, col) {
  var t = rrTable(id);
  if (typeof t.label === 'function') { var l = t.label(col); if (l) return l; }
  var c = rrTableCol(id, col);
  return c ? c.label : col;
}
// The personal-sheet field a column shows (pdKey for an extra, field for a
// standard one) — the key into RR_FIELD_HELP.
function rrTableField(id, col) {
  var c = rrTableCol(id, col);
  return c ? (c.pdKey || c.field || '') : '';
}
function rrTableHelp(id, col) {
  return (typeof rrFieldHelp === 'function') ? rrFieldHelp(rrTableField(id, col)) : '';
}
function rrTableEditOn(id) {
  var t = rrTable(id);
  try { return !!(typeof state !== 'undefined' && state && t.editKey && state[t.editKey]); } catch (e) { return false; }
}
function rrTableLocked(id, col) { return rrTable(id).locked.indexOf(col) >= 0; }

// The columns on screen, in order: the saved layout (locked first, unknown
// ids dropped) or the defaults; then the table's own hook.
function rrTableVisible(id) {
  var t = rrTable(id);
  var chosen = null;
  try { var raw = localStorage.getItem(t.storageKey); if (raw) chosen = JSON.parse(raw); } catch (e) {}
  var hasSaved = Array.isArray(chosen) && chosen.length > 0;
  var out;
  if (!hasSaved) {
    out = t.defaults.slice();
  } else {
    var known = {};
    rrTableCols(id).forEach(function (c) { known[c.col] = 1; });
    out = t.locked.slice();
    chosen.forEach(function (c) { if (known[c] && t.locked.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c); });
  }
  if (typeof t.visibleHook === 'function') { var h = t.visibleHook(out, hasSaved); if (Array.isArray(h)) out = h; }
  return out;
}
// THE writer of a layout. The locked columns are never stored (they are
// always first); the layout travels between devices (look-sync, v1585).
function rrTableSave(id, list) {
  var t = rrTable(id);
  var clean = (list || []).filter(function (c) { return t.locked.indexOf(c) < 0; });
  try { localStorage.setItem(t.storageKey, JSON.stringify(clean)); } catch (e) {}
  if (typeof rrLookTouch === 'function') rrLookTouch();
}
function rrTableRepaint(id) {
  var t = rrTable(id);
  if (typeof t.repaint === 'function') t.repaint();
}
function rrTableAdd(id, col) {
  var box = document.getElementById('rr-addcol'); if (box) box.remove();
  var t = rrTable(id);
  var vis = rrTableVisible(id).filter(function (c) { return t.locked.indexOf(c) < 0; });
  if (vis.indexOf(col) < 0) vis.push(col);
  rrTableSave(id, vis);
  if (typeof t.onAdd === 'function') t.onAdd(col);   // v1862: the column's Preferences switch comes on with it
  rrTableRepaint(id);
}
function rrTableDrop(id, col) {
  var t = rrTable(id);
  rrTableSave(id, rrTableVisible(id).filter(function (c) { return c !== col && t.locked.indexOf(c) < 0; }));
  rrTableRepaint(id);
}
function rrTableSetOrder(id, ids) {
  rrTableSave(id, ids);
  rrTableRepaint(id);
}
function rrTableReset(id) {
  try { localStorage.removeItem(rrTable(id).storageKey); } catch (e) {}
  rrTableRepaint(id);
}
// Edit mode: the header IS the control (v1543 — Brad: "i hit an edit
// button... the existing headers get an x on them that will remove them,
// and then i can drag them left and right").
function rrTableEdit(id, on) {
  var t = rrTable(id);
  try { if (typeof state !== 'undefined' && state && t.editKey) state[t.editKey] = !!on; } catch (e) {}
  rrTableRepaint(id);
  if (on && typeof showToast === 'function') {
    showToast('Drag a heading to move it · × removes it · + Add brings one back', 4500);
  }
}
function rrTableColSpan(id) {
  var t = rrTable(id);
  var lead = (typeof t.leadTh === 'function' && t.leadTh()) ? 1 : 0;
  return rrTableVisible(id).length + 1 /* Actions */ + lead;
}

var _RR_TH_BTN = 'border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:7px;padding:0.15rem 0.5rem;font-size:0.7rem;font-family:var(--font-body);cursor:pointer;margin-right:0.3rem';
function rrTableHeaderHtml(id) {
  var t = rrTable(id);
  var edit = rrTableEditOn(id);
  var cs = (typeof t.sortState === 'function' ? t.sortState() : null) || {};
  var html = rrTableVisible(id).map(function (col) {
    var c = rrTableCol(id, col) || { col: col, label: col, noSort: true };
    var label = rrTableLabel(id, col);
    var noSort = (typeof t.noSort === 'function') ? !!t.noSort(c) : !!c.noSort;
    var style = (typeof t.thStyle === 'function') ? (t.thStyle(c, edit) || '') : '';
    // v1862: every heading says what its column is on hover (one copy of the
    // words — rrFieldHelp); the sortable ones add how to sort.
    var help = rrTableHelp(id, col);
    var helpAttr = function (extra) {
      var s = [help, extra].filter(Boolean).join(' ');
      return s ? ' title="' + s.replace(/"/g, '&quot;') + '"' : '';
    };
    if (edit) {
      var locked = t.locked.indexOf(col) >= 0;
      return '<th data-col="' + col + '" draggable="' + (locked ? 'false' : 'true') + '" ' +
        'class="rr-th-edit' + (locked ? ' locked' : '') + '"' + helpAttr(locked ? '' : 'Drag to move it; × removes it.') + ' ' +
        'style="white-space:nowrap;' + (locked ? '' : 'cursor:grab;') + style + '">' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem">' +
        (locked ? '<span style="opacity:0.5">🔒</span>' : '<span style="opacity:0.55;cursor:grab">☰</span>') +
        '<span>' + label + '</span>' +
        (locked ? '' : '<button type="button" title="Remove this column" onclick="event.stopPropagation();rrTableDrop(\'' + id + '\',\'' + col + '\')" ' +
          'style="border:none;background:none;color:var(--t-accent);font-size:0.95rem;line-height:1;cursor:pointer;padding:0 0.1rem">×</button>') +
        '</span></th>';
    }
    if (noSort) return '<th data-col="' + col + '"' + helpAttr('') + ' style="white-space:nowrap;' + style + '">' + label + '</th>';
    var arrow = (cs.col === col) ? (cs.dir === 'desc' ? ' ▼' : ' ▲') : '';
    return '<th data-col="' + col + '" onclick="' + t.sortCall + '(\'' + col + '\')" style="cursor:pointer;white-space:nowrap;' + style + '"' +
      helpAttr('Click to sort by ' + label + '.') + '>' + label + arrow + '</th>';
  }).join('');
  // The edit controls live on the header bar itself, in the Actions cell.
  var extras = (edit && typeof t.editExtras === 'function') ? (t.editExtras() || '') : '';
  html += '<th data-col="actions" style="text-align:right;white-space:nowrap">' +
    (edit
      ? '<button type="button" onclick="rrTableAddMenu(\'' + id + '\',event)" style="' + _RR_TH_BTN + '">+ Add</button>' + extras +
        '<button type="button" onclick="rrTableEdit(\'' + id + '\',false)" style="border:none;background:var(--accent);color:var(--on-accent);border-radius:7px;padding:0.15rem 0.6rem;font-size:0.7rem;font-family:var(--font-body);font-weight:700;cursor:pointer">Done</button>'
      : 'Actions <button type="button" title="Edit columns — add, remove, drag to reorder" ' +
        'onclick="event.stopPropagation();rrTableEdit(\'' + id + '\',true)" ' +
        'style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);' +
        'border-radius:6px;font-size:0.8rem;line-height:1;cursor:pointer;padding:0.15rem 0.35rem;margin-left:0.25rem">✎</button>') +
    '</th>';
  var lead = (typeof t.leadTh === 'function') ? (t.leadTh() || '') : '';
  return lead + html;
}
function rrTableRenderHeader(id) {
  var t = rrTable(id);
  var thead = document.querySelector(t.theadSel);
  if (!thead) return;
  thead.innerHTML = rrTableHeaderHtml(id);
  if (rrTableEditOn(id)) rrTableWireDrag(id, thead);
  if (typeof t.afterHeader === 'function') t.afterHeader();
}
// Drag a heading left or right. The locked ones stay put.
function rrTableWireDrag(id, thead) {
  var t = rrTable(id);
  var ths = Array.prototype.slice.call(thead.querySelectorAll('th.rr-th-edit:not(.locked)'));
  ths.forEach(function (th) {
    th.addEventListener('dragstart', function (e) {
      window._rrDragCol = th.getAttribute('data-col');
      th.style.opacity = '0.45';
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', window._rrDragCol); } catch (er) {}
    });
    th.addEventListener('dragend', function () { th.style.opacity = ''; window._rrDragCol = null; });
    th.addEventListener('dragover', function (e) { e.preventDefault(); th.style.borderLeft = '3px solid var(--accent)'; });
    th.addEventListener('dragleave', function () { th.style.borderLeft = ''; });
    th.addEventListener('drop', function (e) {
      e.preventDefault();
      th.style.borderLeft = '';
      var from = window._rrDragCol, to = th.getAttribute('data-col');
      if (!from || from === to) return;
      var order = rrTableVisible(id).filter(function (c) { return t.locked.indexOf(c) < 0; });
      var fi = order.indexOf(from); if (fi >= 0) order.splice(fi, 1);
      var ti = order.indexOf(to);
      order.splice(ti < 0 ? order.length : ti, 0, from);
      rrTableSetOrder(id, order);
    });
  });
}
// The + Add menu: only what is not already on the table. Hover shows what a
// column is (Brad: "a pop up when you hover over these with a short
// description"); a phone has no hover, so there the same line sits under the
// name. A table filters its own entries (menuFilter) and may add its own at
// the end (menuExtra — My Collection's spare custom slot).
function rrTableAddMenu(id, ev) {
  if (ev) ev.stopPropagation();
  var old = document.getElementById('rr-addcol'); if (old) old.remove();
  var t = rrTable(id);
  var vis = rrTableVisible(id);
  var avail = rrTableCols(id).filter(function (c) {
    if (vis.indexOf(c.col) >= 0 || t.locked.indexOf(c.col) >= 0) return false;
    return (typeof t.menuFilter === 'function') ? !!t.menuFilter(c, vis) : true;
  });
  var extra = (typeof t.menuExtra === 'function') ? (t.menuExtra() || '') : '';
  var box = document.createElement('div');
  box.id = 'rr-addcol';
  box.style.cssText = 'position:fixed;z-index:9700;background:var(--surface);border:1px solid var(--border);' +
    'border-radius:10px;box-shadow:0 8px 28px var(--scrim);padding:0.4rem;max-height:60vh;overflow:auto;min-width:190px;max-width:330px';
  if (!avail.length && !extra) {
    box.innerHTML = '<div style="padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--text-dim)">Every column is already on the table.</div>';
  } else {
    box.innerHTML = '<div style="padding:0.3rem 0.6rem;font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">Add a column</div>' +
      avail.map(function (c) {
        return rrTableMenuEntry('rrTableAdd(\'' + id + '\',\'' + c.col + '\')', rrTableLabel(id, c.col), rrTableHelp(id, c.col));
      }).join('') + extra;
  }
  document.body.appendChild(box);
  try {
    var r = ev && ev.target ? ev.target.getBoundingClientRect() : { bottom: 90, right: window.innerWidth - 20 };
    box.style.top = Math.min(window.innerHeight - box.offsetHeight - 12, r.bottom + 6) + 'px';
    box.style.left = Math.max(8, r.right - box.offsetWidth) + 'px';
  } catch (e) {}
  setTimeout(function () {
    document.addEventListener('click', function _close(e2) {
      if (box.contains(e2.target)) return;
      box.remove(); document.removeEventListener('click', _close, true);
    }, true);
  }, 0);
}
// One entry of the + Add menu. Exported so a table's menuExtra draws its own
// entries the same way.
function rrTableMenuEntry(onclick, name, help) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var phone = !!window.IS_MOBILE_UA;
  return '<button type="button" class="rr-addcol-item" onclick="' + onclick + '" title="' + esc(help) + '" style="display:block;width:100%;text-align:left;' +
    'background:none;border:none;color:var(--text);font-family:var(--font-body);font-size:0.85rem;' +
    'padding:0.4rem 0.6rem;border-radius:7px;cursor:pointer">' + esc(name) +
    (phone && help ? '<span class="rr-addcol-help" style="display:block;font-size:0.72rem;color:var(--text-dim);line-height:1.35;margin-top:1px;white-space:normal">' + esc(help) + '</span>' : '') +
    '</button>';
}

if (typeof window !== 'undefined') {
  window.RR_ROW_EXTRA_COLS = RR_ROW_EXTRA_COLS;
  window.rrRowExtraValue = rrRowExtraValue;
  window.rrRowExtraCellHtml = rrRowExtraCellHtml;
  window.rrTableDefine = rrTableDefine;
  window.rrTable = rrTable;
  window.rrTableCols = rrTableCols;
  window.rrTableCol = rrTableCol;
  window.rrTableLabel = rrTableLabel;
  window.rrTableField = rrTableField;
  window.rrTableHelp = rrTableHelp;
  window.rrTableVisible = rrTableVisible;
  window.rrTableSave = rrTableSave;
  window.rrTableAdd = rrTableAdd;
  window.rrTableDrop = rrTableDrop;
  window.rrTableSetOrder = rrTableSetOrder;
  window.rrTableReset = rrTableReset;
  window.rrTableEdit = rrTableEdit;
  window.rrTableEditOn = rrTableEditOn;
  window.rrTableColSpan = rrTableColSpan;
  window.rrTableHeaderHtml = rrTableHeaderHtml;
  window.rrTableRenderHeader = rrTableRenderHeader;
  window.rrTableWireDrag = rrTableWireDrag;
  window.rrTableAddMenu = rrTableAddMenu;
  window.rrTableMenuEntry = rrTableMenuEntry;
}
