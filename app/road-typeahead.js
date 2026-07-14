// ═══════════════════════════════════════════════════════════════════
// road-typeahead.js — Type-to-filter overlay for any <select>.
//
// Used to turn the wizard step-1 Type + Road dropdowns (which can have
// 1,300+ options in Atlas) into something searchable without rewriting
// the dropdown logic.
//
// The helper is additive: if it fails to load, the plain <select> still
// works — so nothing breaks. The select stays in the DOM (hidden) and
// stays the source of truth for the value. We just render an input +
// list on top of it and write back via `select.value = ...` followed
// by a synthetic `change` event, so any existing `change` listener
// (e.g. the cross-filter logic in wizard.js) runs exactly as before.
//
// Public API:
//   RoadTypeahead.attach(selectEl)        — wrap a <select> in the UI
//   RoadTypeahead.refresh(selectEl)       — re-sync visible input after
//                                           the <select>'s options or
//                                           value were programmatically
//                                           changed (cross-filter path)
//
// Config lives in window.ROAD_TYPEAHEAD_CONFIG (config.js). Nothing
// hard-coded here.
// ═══════════════════════════════════════════════════════════════════

window.RoadTypeahead = (function() {
  'use strict';

  function _cfg() {
    var c = window.ROAD_TYPEAHEAD_CONFIG || {};
    return {
      minChars:    c.minChars != null ? c.minChars : 0,
      maxResults:  c.maxResults || 50,
      matchMode:   c.matchMode || 'starts-then-contains',
      placeholder: c.placeholder || 'Type to filter…',
      anyLabel:    c.anyLabel || '(any)',
      noMatchText: c.noMatchText || 'No matches',
    };
  }

  function _selectedLabel(sel) {
    if (!sel) return '';
    if (!sel.value) return ''; // "any" shown as empty so placeholder displays
    var idx = sel.selectedIndex;
    if (idx < 0) return '';
    var opt = sel.options[idx];
    return (opt && opt.textContent) || '';
  }

  function _readOptions(sel) {
    var out = [];
    if (!sel || !sel.options) return out;
    for (var i = 0; i < sel.options.length; i++) {
      out.push({ value: sel.options[i].value, text: sel.options[i].textContent || '' });
    }
    return out;
  }

  function attach(selectEl) {
    if (!selectEl || selectEl._tyAttached) return;
    if (selectEl.tagName !== 'SELECT') return;
    selectEl._tyAttached = true;

    var cfg = _cfg();

    // Wrap select with a positioned container so the dropdown can overlay.
    var wrap = document.createElement('div');
    wrap.className = 'road-ty-wrap';
    wrap.style.cssText = 'position:relative;width:100%';
    var parent = selectEl.parentNode;
    parent.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);
    selectEl.style.display = 'none';

    // Visible input — inherits the select's width/sizing where possible.
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'road-ty-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    // Match the select's original inline style as closely as possible.
    var baseCss = selectEl.getAttribute('style') || '';
    input.style.cssText = baseCss + ';display:block;box-sizing:border-box';
    input.placeholder = cfg.placeholder;
    input.value = _selectedLabel(selectEl);
    wrap.appendChild(input);

    // Dropdown list.
    var list = document.createElement('div');
    list.className = 'road-ty-list';
    list.setAttribute('role', 'listbox');
    list.style.cssText = [
      'display:none',
      'position:absolute',
      'top:100%', 'left:0', 'right:0',
      'z-index:9999',
      'max-height:260px',
      'overflow-y:auto',
      'background:var(--surface)',
      'color:var(--text)',
      'border:1px solid var(--border)',
      'border-radius:8px',
      'margin-top:2px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
      '-webkit-overflow-scrolling:touch'
    ].join(';');
    wrap.appendChild(list);

    var activeIdx = -1; // keyboard highlight

    function renderList(query) {
      list.innerHTML = '';
      activeIdx = -1;
      var q = (query || '').trim().toLowerCase();
      var opts = _readOptions(selectEl);
      // Always keep the "(any)" option first (value === '').
      var anyOpt = null;
      var rest = [];
      opts.forEach(function(o) {
        if (o.value === '') { if (!anyOpt) anyOpt = o; }
        else rest.push(o);
      });
      var filtered;
      if (!q) {
        filtered = rest;
      } else if (cfg.matchMode === 'starts-then-contains') {
        var starts = [], contains = [];
        rest.forEach(function(o) {
          var t = o.text.toLowerCase();
          if (t.indexOf(q) === 0) starts.push(o);
          else if (t.indexOf(q) >= 0) contains.push(o);
        });
        filtered = starts.concat(contains);
      } else {
        filtered = rest.filter(function(o) { return o.text.toLowerCase().indexOf(q) >= 0; });
      }
      if (cfg.maxResults > 0) filtered = filtered.slice(0, cfg.maxResults);

      var toShow = [];
      if (anyOpt) {
        // Render "any" with its display label (or the config anyLabel).
        toShow.push({ value: '', text: anyOpt.text || cfg.anyLabel });
      }
      toShow = toShow.concat(filtered);

      if (!toShow.length || (toShow.length === 1 && toShow[0].value === '' && q)) {
        var nohit = document.createElement('div');
        nohit.className = 'road-ty-nomatch';
        nohit.style.cssText = 'padding:0.7rem 0.85rem;font-size:0.85rem;color:var(--text-dim);font-style:italic';
        nohit.textContent = cfg.noMatchText;
        list.appendChild(nohit);
        return;
      }

      toShow.forEach(function(o, i) {
        var row = document.createElement('div');
        row.className = 'road-ty-option';
        row.setAttribute('role', 'option');
        row.setAttribute('data-idx', String(i));
        row.setAttribute('data-value', o.value);
        row.style.cssText = [
          'padding:0.7rem 0.85rem',
          'cursor:pointer',
          'font-size:0.92rem',
          'color:var(--text)',
          'min-height:44px',
          'display:flex',
          'align-items:center',
          'border-bottom:1px solid var(--border)'
        ].join(';');
        row.textContent = o.text;
        row.addEventListener('mouseenter', function() { _setActive(i); });
        row.addEventListener('mousedown', function(e) {
          // mousedown not click, so we win the race against blur->close.
          e.preventDefault();
          pick(o.value, o.text);
        });
        list.appendChild(row);
      });
    }

    function _setActive(i) {
      activeIdx = i;
      var rows = list.querySelectorAll('.road-ty-option');
      for (var k = 0; k < rows.length; k++) {
        rows[k].style.background = (k === i) ? 'var(--surface2)' : '';
      }
    }

    function open() {
      input.setAttribute('aria-expanded', 'true');
      list.style.display = 'block';
      // Fresh list on each open (options may have changed via cross-filter).
      renderList('');
    }

    function close() {
      input.setAttribute('aria-expanded', 'false');
      list.style.display = 'none';
    }

    function pick(value, label) {
      selectEl.value = value;
      input.value = value ? (label || '') : '';
      close();
      // Fire change so existing listeners (cross-filter etc.) run.
      try {
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        // Older browsers: fall back to legacy event init.
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', true, true);
        selectEl.dispatchEvent(ev);
      }
    }

    input.addEventListener('focus', function() {
      // Show everything on focus (like a normal dropdown click).
      open();
    });
    input.addEventListener('input', function() {
      list.style.display = 'block';
      renderList(input.value);
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        close();
        input.blur();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        var rows = list.querySelectorAll('.road-ty-option');
        if (!rows.length) return;
        var idx = activeIdx >= 0 ? activeIdx : 0;
        var row = rows[idx];
        if (row) pick(row.getAttribute('data-value') || '', row.textContent || '');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        var rows = list.querySelectorAll('.road-ty-option');
        if (!rows.length) return;
        if (list.style.display !== 'block') open();
        _setActive(Math.min(rows.length - 1, (activeIdx < 0 ? 0 : activeIdx + 1)));
        rows[activeIdx].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        var rows = list.querySelectorAll('.road-ty-option');
        if (!rows.length) return;
        _setActive(Math.max(0, (activeIdx < 0 ? 0 : activeIdx - 1)));
        rows[activeIdx].scrollIntoView({ block: 'nearest' });
        return;
      }
    });

    // Close on outside click (use capture so we see it before the
    // outside handler closes modals etc.).
    var _outsideHandler = function(e) {
      if (!wrap.contains(e.target)) close();
    };
    document.addEventListener('mousedown', _outsideHandler, true);
    document.addEventListener('touchstart', _outsideHandler, true);

    // Expose refresh so the cross-filter code can re-sync visible text
    // after it programmatically rewrites the <select>'s options.
    selectEl._tyRefresh = function() {
      input.value = _selectedLabel(selectEl);
      if (list.style.display === 'block') renderList(input.value);
    };
  }

  function refresh(selectEl) {
    if (selectEl && typeof selectEl._tyRefresh === 'function') {
      selectEl._tyRefresh();
    }
  }

  return { attach: attach, refresh: refresh };
})();
