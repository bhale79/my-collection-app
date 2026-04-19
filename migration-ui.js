// ═══════════════════════════════════════════════════════════════
// migration-ui.js — Admin modal for moving items between master-sheet tabs.
//
// Purely rendering + wiring. All copy + routing rules come from
// MIGRATION (migration-config.js). All sheet writes happen in the
// migration* functions exposed from migration-config.js.
//
// Invoked from the Preferences → Admin Tools section via the global
// window.openMigrationModal() function.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Module state — tracks where we are in the 3-step flow.
  var _st = { step: 1, preview: null, destRowNum: null };

  function $ (id) { return document.getElementById(id); }

  function openMigrationModal() {
    if (typeof _isAdmin !== 'function' || !_isAdmin()) {
      console.warn('[migration-ui] non-admin tried to open modal');
      return;
    }
    _st = { step: 1, preview: null, destRowNum: null };
    _mount();
    _render();
  }
  window.openMigrationModal = openMigrationModal;

  function closeMigrationModal() {
    var ov = $('migration-overlay'); if (ov) ov.remove();
    _st = { step: 1, preview: null, destRowNum: null };
  }
  window.closeMigrationModal = closeMigrationModal;

  // ─── Mount / render ───────────────────────────────────────

  function _mount() {
    if ($('migration-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'migration-overlay';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:10030;' +
      'display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:1.5rem';
    var panel = document.createElement('div');
    panel.id = 'migration-panel';
    panel.style.cssText =
      'background:var(--surface);border-radius:14px;max-width:600px;width:100%;' +
      'padding:1.3rem 1.3rem 1.1rem;color:var(--text);font-family:var(--font-body);' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);margin:auto 0';
    ov.appendChild(panel);
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) {
      // clicks on the backdrop dismiss only if not mid-action
      if (e.target === ov && _st.step !== 2 && _st.step !== 3) closeMigrationModal();
    });
  }

  function _render() {
    var p = $('migration-panel'); if (!p) return;
    var cfg = (window.MIGRATION && window.MIGRATION.ui) || {};
    var header =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.6rem">' +
        '<div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700">' + _esc(cfg.modalTitle || 'Migrate item') + '</div>' +
        '<button onclick="closeMigrationModal()" aria-label="Close" style="background:none;border:none;color:var(--text-mid);font-size:1.6rem;cursor:pointer;padding:0.2rem 0.5rem;line-height:1">\u00D7</button>' +
      '</div>';

    var body = '';
    if (_st.step === 1) body = _renderFindForm();
    else if (_st.step === 2) body = _renderPreviewAndAppend();
    else if (_st.step === 3) body = _renderClearStep();
    else if (_st.step === 4) body = _renderDone();

    p.innerHTML = header + body;
  }

  function _renderFindForm() {
    var cfg = (window.MIGRATION && window.MIGRATION.ui) || {};
    var routes = (window.MIGRATION && window.MIGRATION.routes) || {};
    // Only show source tabs that HAVE at least one destination
    var sourceTabs = Object.keys(routes).filter(function(k) { return (routes[k] || []).length > 0; });
    // Further filter: destination must exist in ERA_TABS
    var validDestsFor = function(src) {
      return (routes[src] || []).filter(function(dst) { return _destExists(dst); });
    };
    sourceTabs = sourceTabs.filter(function(s) { return validDestsFor(s).length > 0; });

    var sourceOptions = sourceTabs.map(function(s) {
      return '<option value="' + _esc(s) + '">' + _esc(s) + '</option>';
    }).join('');
    var firstSource = sourceTabs[0] || '';
    var destOptions = validDestsFor(firstSource).map(function(d) {
      return '<option value="' + _esc(d) + '">' + _esc(d) + '</option>';
    }).join('');

    return '' +
      '<div style="font-size:0.92rem;color:var(--text-mid);margin-bottom:1rem;line-height:1.5">' + _esc(cfg.adminButtonHint || '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:0.7rem">' +
        _row(cfg.sourceLabel || 'From tab',
          '<select id="mig-source" style="width:100%;padding:0.7rem 0.8rem;font-size:1rem;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px">' + sourceOptions + '</select>') +
        _row(cfg.itemNumLabel || 'Item number',
          '<input id="mig-itemnum" type="text" placeholder="e.g. 8501" style="width:100%;padding:0.7rem 0.8rem;font-size:1rem;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px">') +
        _row(cfg.destLabel || 'To tab',
          '<select id="mig-dest" style="width:100%;padding:0.7rem 0.8rem;font-size:1rem;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px">' + destOptions + '</select>') +
      '</div>' +
      '<div id="mig-err" style="display:none;margin-top:0.8rem;padding:0.7rem 0.9rem;background:rgba(240,80,8,0.12);border-left:3px solid var(--red);border-radius:6px;font-size:0.88rem;color:var(--text)"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.1rem">' +
        '<button onclick="closeMigrationModal()" style="padding:0.8rem 1.2rem;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-mid);font-size:1rem;cursor:pointer;min-height:48px">' + _esc(cfg.cancelButton || 'Cancel') + '</button>' +
        '<button onclick="_migFindClick()" id="mig-find-btn" style="padding:0.8rem 1.4rem;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;min-height:48px">' + _esc(cfg.findButton || 'Find item') + '</button>' +
      '</div>' +
      '<script>(function(){' +
        'var src=document.getElementById("mig-source");' +
        'var dst=document.getElementById("mig-dest");' +
        'if(!src||!dst)return;' +
        'src.addEventListener("change",function(){' +
          'var routes=(window.MIGRATION&&window.MIGRATION.routes)||{};' +
          'var dests=(routes[src.value]||[]).filter(function(d){return window._migDestExists(d);});' +
          'dst.innerHTML=dests.map(function(d){return "<option value=\\""+d+"\\">"+d+"</option>";}).join("");' +
        '});' +
      '})();</script>';
  }

  function _renderPreviewAndAppend() {
    var cfg = (window.MIGRATION && window.MIGRATION.ui) || {};
    var p = _st.preview || {};
    var previewText = _fill(cfg.previewTemplate || '', {
      itemNum: p.itemNum, rowNum: p.sourceRowNumber,
      sourceTab: p.sourceTab, description: p.description || '(none)',
    });
    var readyText = _fill(cfg.readyTemplate || '', { destTab: p.destTab });
    var appendLabel = _fill(cfg.appendButton || 'Append', { destTab: p.destTab });

    return '' +
      '<div style="font-size:0.82rem;color:var(--accent);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem">' + _esc(cfg.previewTitle || 'Preview') + '</div>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;font-size:0.95rem;line-height:1.6;margin-bottom:0.8rem">' + _esc(previewText) + '</div>' +
      '<div style="font-size:0.9rem;color:var(--text-mid);line-height:1.55;margin-bottom:1rem">' + _esc(readyText) + '</div>' +
      '<div id="mig-err" style="display:none;margin-bottom:0.8rem;padding:0.7rem 0.9rem;background:rgba(240,80,8,0.12);border-left:3px solid var(--red);border-radius:6px;font-size:0.88rem;color:var(--text)"></div>' +
      '<div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;margin-top:1rem">' +
        '<button onclick="_migBackToFind()" style="padding:0.8rem 1.2rem;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-mid);font-size:1rem;cursor:pointer;min-height:48px">\u2190 Back</button>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button onclick="closeMigrationModal()" style="padding:0.8rem 1.2rem;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-mid);font-size:1rem;cursor:pointer;min-height:48px">' + _esc(cfg.cancelButton || 'Cancel') + '</button>' +
          '<button onclick="_migAppendClick()" id="mig-append-btn" style="padding:0.8rem 1.4rem;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;min-height:48px">' + _esc(appendLabel) + '</button>' +
        '</div>' +
      '</div>';
  }

  function _renderClearStep() {
    var cfg = (window.MIGRATION && window.MIGRATION.ui) || {};
    var p = _st.preview || {};
    var appendedText = _fill(cfg.appendedTemplate || '', {
      destTab: p.destTab, rowNum: _st.destRowNum,
      sourceTab: p.sourceTab, sourceRow: p.sourceRowNumber,
    });
    var clearText = _fill(cfg.clearPromptText || '', { sourceTab: p.sourceTab });

    return '' +
      '<div style="font-size:0.82rem;color:#27ae60;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem">Step 2 of 3 complete</div>' +
      '<div style="background:rgba(39,174,96,0.10);border:1px solid rgba(39,174,96,0.4);border-radius:10px;padding:1rem;font-size:0.95rem;line-height:1.6;margin-bottom:0.8rem">' + _esc(appendedText) + '</div>' +
      '<div style="font-size:0.95rem;color:var(--text);line-height:1.55;margin-bottom:1rem">' + _esc(clearText) + '</div>' +
      '<div id="mig-err" style="display:none;margin-bottom:0.8rem;padding:0.7rem 0.9rem;background:rgba(240,80,8,0.12);border-left:3px solid var(--red);border-radius:6px;font-size:0.88rem;color:var(--text)"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;margin-top:1rem">' +
        '<button onclick="_migLeaveSource()" style="padding:0.8rem 1.2rem;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text-mid);font-size:1rem;cursor:pointer;min-height:48px">' + _esc(cfg.leaveButton || 'Leave source') + '</button>' +
        '<button onclick="_migClearClick()" id="mig-clear-btn" style="padding:0.8rem 1.4rem;background:var(--red);border:none;border-radius:8px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;min-height:48px">' + _esc(cfg.clearButton || 'Clear source row') + '</button>' +
      '</div>';
  }

  function _renderDone() {
    var cfg = (window.MIGRATION && window.MIGRATION.ui) || {};
    var msg = cfg.doneTemplate || 'Done.';
    return '' +
      '<div style="text-align:center;padding:1.5rem 0">' +
        '<div style="font-size:3rem;margin-bottom:0.5rem">\u2705</div>' +
        '<div style="font-size:1rem;color:var(--text);line-height:1.6;margin-bottom:1.5rem">' + _esc(msg) + '</div>' +
        '<button onclick="closeMigrationModal()" style="padding:0.9rem 2rem;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;min-height:48px">' + _esc(cfg.closeButton || 'Close') + '</button>' +
      '</div>';
  }

  // ─── Button handlers ──────────────────────────────────────

  window._migFindClick = async function() {
    var src  = ($('mig-source') || {}).value;
    var inum = ($('mig-itemnum') || {}).value;
    var dst  = ($('mig-dest')   || {}).value;
    if (!inum) return _showErr('Enter an item number.');
    var btn = $('mig-find-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Finding…'; }
    try {
      _st.preview = await migrationFindItem(inum.trim(), src, dst);
      _st.step = 2;
      _render();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = (window.MIGRATION.ui.findButton || 'Find item'); }
      _showErr(e.message || String(e));
    }
  };

  window._migAppendClick = async function() {
    var p = _st.preview; if (!p) return;
    var btn = $('mig-append-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Appending…'; }
    try {
      var rowNum = await migrationAppendToDest(p.sourceRow, p.destTab);
      _st.destRowNum = rowNum;
      _st.step = 3;
      _render();
    } catch (e) {
      if (btn) { btn.disabled = false; }
      _showErr(e.message || String(e));
    }
  };

  window._migClearClick = async function() {
    var p = _st.preview; if (!p) return;
    var btn = $('mig-clear-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Clearing…'; }
    try {
      await migrationClearSource(p.sourceTab, p.sourceRowNumber);
      _st.step = 4;
      _render();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = (window.MIGRATION.ui.clearButton || 'Clear'); }
      _showErr(e.message || String(e));
    }
  };

  window._migLeaveSource = function() {
    _st.step = 4;
    _render();
  };

  window._migBackToFind = function() {
    _st.step = 1;
    _st.preview = null;
    _render();
  };

  // Destination-exists helper used both server-side (when filtering) and
  // from the inline change handler in _renderFindForm.
  window._migDestExists = function(tabName) { return _destExists(tabName); };

  // ─── Helpers ──────────────────────────────────────────────

  function _destExists(tabName) {
    // Destination tab must actually appear somewhere in ERA_TABS so we
    // don't try to write to a non-existent tab.
    if (typeof ERA_TABS === 'undefined') return false;
    for (var eraKey in ERA_TABS) {
      var tabs = ERA_TABS[eraKey] || {};
      for (var k in tabs) {
        if (tabs[k] === tabName) return true;
      }
    }
    return false;
  }

  function _showErr(msg) {
    var box = $('mig-err');
    if (box) {
      box.textContent = msg;
      box.style.display = '';
    } else {
      alert(msg);
    }
  }

  function _row(label, inputHtml) {
    return '<div><div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem;font-weight:600">' + _esc(label) + '</div>' + inputHtml + '</div>';
  }

  function _fill(tmpl, vals) {
    return String(tmpl || '').replace(/\{(\w+)\}/g, function(_, k) {
      return vals && vals[k] != null ? String(vals[k]) : '';
    });
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
