// ═══════════════════════════════════════════════════════════════
// detail-nav.js — prev / next through the list you came from
// v0.9.1155 (Brad: "We need a next item, previous item with arrows on
// the detail pages to advance to the next item in the list it just came
// from, like want, or sale, or whatever")
//
// WHY IT CAPTURES AT CLICK TIME
// Every list in the app — Want/Upgrade, For Sale, Sold, Collection,
// Master Catalog, Sets — renders its rows with an inline onclick that
// opens the shared detail page. Rather than rewiring six renderers to
// each publish their ordered array (six chances to miss one, and any new
// list would silently lack arrows), this reads the rows that are ON
// SCREEN at the instant a row is clicked.
//
// That has a property worth stating plainly: the sequence is whatever the
// user was actually looking at. Filters, sort order, search, the mobile
// card view vs the desktop table — all inherently respected, because it
// is the same DOM the user's eyes were on. No renderer changes at all.
//
// The captured entries are the onclick STRINGS, not DOM references: the
// list markup is destroyed the moment the detail page renders, so a node
// reference would be dead by the time an arrow is pressed.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // An onclick that opens an item detail page. _wantViewDetail is the
  // Want/Upgrade route (it resolves the master index itself, then calls
  // showItemDetailPage with wantMode).
  var OPENS_DETAIL = /(?:^|[^\w])(?:showItemDetailPage|_wantViewDetail|showNonItemDetailPage)\s*\(/;

  // Rows carry inner controls — share checkboxes, the photo toggle, a
  // "view on Google" link — whose handlers stop propagation. Those are not
  // list rows and must never become a navigation step.
  function _isRowish(el) {
    var oc = el.getAttribute('onclick') || '';
    if (!OPENS_DETAIL.test(oc)) return false;
    if (/stopPropagation/.test(oc)) return false;
    return true;
  }

  // The clicked row's siblings, in display order. Rows live directly in a
  // <tbody> (desktop tables) or a cards container (mobile), so the row's
  // parent is the list. Each sibling may itself carry the onclick, or
  // contain a single element that does (table rows put it on a cell).
  function _openCallOf(node) {
    if (node.nodeType !== 1) return '';
    if (_isRowish(node)) return node.getAttribute('onclick');
    var inner = node.querySelectorAll ? node.querySelectorAll('[onclick]') : [];
    for (var i = 0; i < inner.length; i++) {
      if (_isRowish(inner[i])) return inner[i].getAttribute('onclick');
    }
    return '';
  }

  function _labelOf(node) {
    var el = node.querySelector ? (node.querySelector('.item-num') || node) : node;
    var t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 44);
  }

  // Which list is this? Used for the arrow tooltips only — the Back button
  // keeps its own origin logic, which already works.
  function _originLabel() {
    try {
      var p = document.querySelector('.page.active');
      var id = (p && p.id) || '';
      return ({
        'page-upgrade': 'Want / Upgrade', 'page-want': 'Want List',
        'page-forsale': 'Sale List', 'page-sold': 'Sold Items',
        'page-collection': 'Collection', 'page-browse': 'Master Catalog',
        'page-tools': 'Collection Tools', 'page-dashboard': 'Dashboard',
      })[id] || 'the list';
    } catch (e) { return 'the list'; }
  }

  // Capture phase, so this runs BEFORE the inline onclick tears the list
  // down and swaps in the detail page.
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest('[onclick]');
      if (!hit || !_isRowish(hit)) return;

      // Walk out to the element sitting directly inside the list container.
      var row = hit;
      while (row.parentElement && !_looksLikeList(row.parentElement)) row = row.parentElement;
      var host = row.parentElement;
      if (!host) return;

      var items = [], pos = -1;
      for (var i = 0; i < host.children.length; i++) {
        var child = host.children[i];
        var call = _openCallOf(child);
        if (!call) continue;
        if (child === row || child.contains(hit)) pos = items.length;
        items.push({ call: call, label: _labelOf(child) });
      }
      if (pos < 0 || items.length < 2) { window._rrNav = null; return; }
      window._rrNav = { items: items, pos: pos, origin: _originLabel() };
    } catch (err) { window._rrNav = null; }
  }, true);

  // A list container: a tbody, or a flex/grid box holding several rows that
  // each open a detail page.
  function _looksLikeList(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TBODY') return true;
    var n = 0;
    for (var i = 0; i < el.children.length && n < 2; i++) {
      if (_openCallOf(el.children[i])) n++;
    }
    return n >= 2;
  }

  // ── The control the detail page renders ──────────────────────────
  // Returns '' when there is nothing to step through, so a detail page
  // opened from a search result or a deep link simply has no arrows.
  window.rrDetailNavHtml = function () {
    var n = window._rrNav;
    if (!n || !n.items || n.items.length < 2 || n.pos < 0) return '';
    var atStart = n.pos <= 0;
    var atEnd   = n.pos >= n.items.length - 1;
    // Brad chose: stop at the ends, greyed out — so working through a stack
    // you can SEE that you are done rather than silently looping.
    var btn = function (dir, disabled, tip) {
      var arrow = dir < 0
        ? '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'
        : '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>';
      return '<button ' + (disabled ? 'disabled ' : '') + 'onclick="rrDetailNavGo(' + dir + ')" '
        + 'title="' + tip.replace(/"/g, '&quot;') + '" '
        + 'style="display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;'
        + 'border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card);'
        + 'color:' + (disabled ? 'var(--text-dim)' : '#2980b9') + ';'
        + (disabled ? 'opacity:0.45;cursor:default;' : 'cursor:pointer;')
        + '">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
        + arrow + '</svg></button>';
    };
    var prevLbl = atStart ? 'Already at the first item' : ('Previous: ' + n.items[n.pos - 1].label);
    var nextLbl = atEnd   ? 'Last item in ' + n.origin  : ('Next: ' + n.items[n.pos + 1].label);
    return '<div style="display:inline-flex;align-items:center;gap:0.45rem;margin-left:auto">'
      + btn(-1, atStart, prevLbl)
      + '<span style="font-size:0.76rem;color:var(--text-dim);white-space:nowrap;min-width:4.5rem;text-align:center">'
      +   (n.pos + 1) + ' of ' + n.items.length
      + '</span>'
      + btn(1, atEnd, nextLbl)
      + '</div>';
  };

  window.rrDetailNavGo = function (dir) {
    var n = window._rrNav;
    if (!n || !n.items) return;
    var next = n.pos + (dir < 0 ? -1 : 1);
    if (next < 0 || next >= n.items.length) return;
    n.pos = next;                       // move BEFORE running the call, so the
                                        // page we are about to draw sees its own
                                        // position, not the one we left.
    var call = n.items[next].call;
    try {
      // Same string the row itself would have run. Re-running it keeps every
      // origin flag (_detailReturn, wantMode) exactly as the list intended.
      new Function(call).call(window);
      try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (eS) { window.scrollTo(0, 0); }
    } catch (err) {
      console.warn('[detail-nav] could not open the next item:', err);
      if (typeof showToast === 'function') showToast('Could not open that item — go back to the list and tap it', 3500, true);
    }
  };

  // Desktop keyboard: left/right step through the stack. Ignored while
  // typing, and while any overlay/modal is open, so it can never fire
  // underneath a dialog the user is actually working in.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var a = document.activeElement;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    if (document.querySelector('[id$="-modal"], [id$="-overlay"], #rrap')) return;
    if (!document.getElementById('rr-detail-nav')) return;   // only on a detail page
    e.preventDefault();
    window.rrDetailNavGo(e.key === 'ArrowLeft' ? -1 : 1);
  });
})();
