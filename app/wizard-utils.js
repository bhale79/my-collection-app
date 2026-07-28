// ═══════════════════════════════════════════════════════════════
// wizard-utils.js — Small UI utilities used across the app
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 3).
// Loaded EARLY in index.html (right after config.js) so any other
// script (app.js, prefs.js, tools.js, etc.) can call these helpers.
//
// Despite the "wizard-" prefix (kept for naming consistency with the
// rest of the wizard split), these utilities are general-purpose:
//   - appConfirm — Promise-based confirmation modal (replaces window.confirm)
//   - showToast — non-blocking toast notification
//   - _sheetLinkClick — guard handler that warns before opening the
//                        Google Sheet (warning suppressible per user)
//
// Globals used (defined elsewhere):
//   - state.personalSheetId (app.js) — for _sheetLinkClick fallback href
//   - localStorage — for warning suppression / ack
// ═══════════════════════════════════════════════════════════════

function _sheetLinkClick(e) {
  // If user has already acknowledged the warning, open directly
  if (localStorage.getItem('lv_sheet_warn_ack') === 'true') return true;

  e.preventDefault();
  // Read href from the clicked element directly (sidebar element was removed)
  const href = (e.currentTarget || e.target).href || ('https://docs.google.com/spreadsheets/d/' + (state.personalSheetId || ''));

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.25rem';

  const box = document.createElement('div');
  box.className = 'rr-card'; box.style.fontFamily = 'var(--font-body)';
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.9rem">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:0.95rem;font-weight:700;color:var(--text)">Heads up before you edit</span>
    </div>
    <p style="font-size:0.85rem;color:var(--text-mid);line-height:1.55;margin:0 0 0.75rem">
      This sheet is managed entirely by The Rail Roster. <strong style="color:var(--text)">Editing rows, columns, or tab names directly can break the app</strong> and may cause data loss that can't be undone.
    </p>
    <p style="font-size:0.85rem;color:var(--text-mid);line-height:1.55;margin:0 0 1.1rem">
      It's safe to <strong style="color:var(--text)">read and export</strong> your data — just don't add, move, or delete anything while the app is in use.
    </p>
    <label style="display:flex;align-items:center;gap:0.6rem;font-size:0.8rem;color:var(--text-dim);cursor:pointer;margin-bottom:1.1rem">
      <input type="checkbox" id="sheet-warn-ack" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer">
      Don't show this again
    </label>
    <div style="display:flex;gap:0.6rem">
      <button onclick="document.body.removeChild(this.closest('.lv-overlay'))"
        style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">
        Cancel
      </button>
      <button id="sheet-warn-open"
        style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">
        Open anyway
      </button>
    </div>`;

  overlay.classList.add('lv-overlay');
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('sheet-warn-open').onclick = () => {
    if (document.getElementById('sheet-warn-ack')?.checked) {
      localStorage.setItem('lv_sheet_warn_ack', 'true');
    }
    document.body.removeChild(overlay);
    window.open(href, '_blank');
  };

  return false;
}

function appConfirm(message, opts) {
  opts = opts || {};
  const title = opts.title || 'Confirm';
  const okText = opts.ok || 'Yes';
  const cancelText = opts.cancel || 'No';
  const danger = !!opts.danger;
  return new Promise(function(resolve) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99998;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = '<div class="rr-card" style="color:var(--text);font-family:var(--font-body)">'
      + '<div style="font-size:1rem;font-weight:600;margin-bottom:0.55rem">' + title + '</div>'
      + '<div style="font-size:0.9rem;line-height:1.45;color:var(--text-mid,#bbb);margin-bottom:1.1rem">' + message + '</div>'
      + '<div style="display:flex;gap:0.5rem;justify-content:flex-end">'
      + '<button id="_ac-no" style="padding:0.55rem 1.05rem;border-radius:8px;border:1px solid var(--border,#444);background:transparent;color:var(--text-dim,#aaa);font-family:inherit;cursor:pointer">' + cancelText + '</button>'
      + '<button id="_ac-yes" style="padding:0.55rem 1.15rem;border-radius:8px;border:none;background:' + (danger ? '#c0392b' : 'var(--accent,#e04028)') + ';color:#fff;font-weight:600;font-family:inherit;cursor:pointer">' + okText + '</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    // v0.9.804 (TODO-012): device Back button cancels the confirm (BackStack
    // rule) instead of navigating the page underneath it.
    const done = function(val) { ov.remove(); if (window.BackStack) BackStack.pop('app-confirm'); resolve(val); };
    if (window.BackStack) BackStack.push('app-confirm', function() { ov.remove(); resolve(false); });
    ov.querySelector('#_ac-no').onclick = function() { done(false); };
    ov.querySelector('#_ac-yes').onclick = function() { done(true); };
    // ESC closes as cancel
    const keyHandler = function(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', keyHandler); done(false); } };
    document.addEventListener('keydown', keyHandler, { once: true });
  });
}
window.appConfirm = appConfirm;

// In-app text / number prompt — replaces the native blocking prompt(), which
// freezes automated tests and looks out of place. Returns the entered string,
// or null if cancelled. Mirrors appConfirm's styling. (Session 176)
function appPrompt(message, defaultValue, opts) {
  opts = opts || {};
  var title = opts.title || 'Enter a value';
  var okText = opts.ok || 'OK';
  var cancelText = opts.cancel || 'Cancel';
  var inputType = opts.type || 'text';
  var prefix = opts.prefix || '';
  return new Promise(function(resolve) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99998;display:flex;align-items:center;justify-content:center;padding:1rem';
    var safeVal = String(defaultValue == null ? '' : defaultValue).replace(/"/g, '&quot;');
    var numAttrs = (inputType === 'number') ? ' inputmode="decimal" step="any"' : '';
    ov.innerHTML = '<div class="rr-card" style="color:var(--text);font-family:var(--font-body)">'
      + '<div style="font-size:1rem;font-weight:600;margin-bottom:0.55rem">' + title + '</div>'
      + '<div style="font-size:0.9rem;line-height:1.45;color:var(--text-mid,#bbb);margin-bottom:0.9rem">' + message + '</div>'
      + '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:1.1rem">'
      + (prefix ? '<span style="font-size:1rem;color:var(--text-dim,#aaa)">' + prefix + '</span>' : '')
      + '<input id="_ap-input" type="' + inputType + '"' + numAttrs + ' value="' + safeVal + '" style="flex:1;padding:0.6rem 0.7rem;border-radius:8px;border:1px solid var(--border,#444);background:var(--surface2,#222);color:var(--text,#eee);font-family:inherit;font-size:0.95rem"></div>'
      + '<div style="display:flex;gap:0.5rem;justify-content:flex-end">'
      + '<button id="_ap-cancel" style="padding:0.55rem 1.05rem;border-radius:8px;border:1px solid var(--border,#444);background:transparent;color:var(--text-dim,#aaa);font-family:inherit;cursor:pointer">' + cancelText + '</button>'
      + '<button id="_ap-ok" style="padding:0.55rem 1.15rem;border-radius:8px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;font-family:inherit;cursor:pointer">' + okText + '</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('#_ap-input');
    var keyHandler;
    var done = function(val) { ov.remove(); if (keyHandler) document.removeEventListener('keydown', keyHandler); resolve(val); };
    keyHandler = function(e) {
      if (e.key === 'Escape') done(null);
      else if (e.key === 'Enter') done(inp ? inp.value : null);
    };
    document.addEventListener('keydown', keyHandler);
    ov.querySelector('#_ap-cancel').onclick = function() { done(null); };
    ov.querySelector('#_ap-ok').onclick = function() { done(inp ? inp.value : ''); };
    setTimeout(function() { if (inp) { inp.focus(); inp.select(); } }, 30);
  });
}
window.appPrompt = appPrompt;

function showToast(msg, duration, isError) {
  let t = document.getElementById('toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'toast';
  const err = isError || /error|failed|invalid|required/i.test(msg);
  t.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(8px);'
    + 'background:' + (err ? '#c0392b' : '#1a2e3d') + ';color:#fff;padding:0.7rem 1.4rem;'
    + 'border-radius:10px;font-size:0.88rem;font-weight:500;z-index:99999;'
    + 'font-family:var(--font-body);box-shadow:0 4px 20px rgba(0,0,0,0.35);'
    + 'max-width:88vw;text-align:center;opacity:0;transition:opacity 0.2s,transform 0.2s';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  const _timer = setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(4px)';
    setTimeout(() => { if (t.parentNode) t.remove(); }, 220);
  }, duration || 2400);
  t.onclick = () => { clearTimeout(_timer); t.remove(); };
}
