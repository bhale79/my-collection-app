// ═══════════════════════════════════════════════════════════════
// a11y.js — applies accessibility preferences at runtime.
//
// Reads config from a11y-config.js (window.A11Y). Persists choices to
// localStorage keys defined there. Exposes applyFontScale() globally so
// prefs.js can call it on change. applyTheme() continues to live in
// app.js (it's already wired up) — we don't override it here.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  function _getScaleKey() {
    var cfg = (window.A11Y && window.A11Y.fontScale) || {};
    var saved = null;
    try { saved = localStorage.getItem(cfg.storageKey || 'lv_font_scale'); } catch(e){}
    // Validate against known options — fallback to default if unknown key
    var options = cfg.options || [];
    var valid = options.some(function(o) { return o.key === saved; });
    return valid ? saved : (cfg.defaultKey || 'normal');
  }

  function _pctForKey(key) {
    var cfg = (window.A11Y && window.A11Y.fontScale) || {};
    var opt = (cfg.options || []).find(function(o) { return o.key === key; });
    return (opt && typeof opt.pct === 'number') ? opt.pct : 100;
  }

  // Applies the saved font-scale to <html>. Called at boot and whenever
  // the user picks a new size in preferences.
  function applyFontScale() {
    try {
      var key = _getScaleKey();
      var pct = _pctForKey(key);
      document.documentElement.style.fontSize = pct + '%';
      document.documentElement.dataset.fontScale = key;
    } catch(e) { console.warn('[a11y] applyFontScale failed:', e); }
  }
  window.applyFontScale = applyFontScale;

  // Persists choice + applies immediately. Called by the prefs dropdown.
  function setFontScale(key) {
    var cfg = (window.A11Y && window.A11Y.fontScale) || {};
    try { localStorage.setItem(cfg.storageKey || 'lv_font_scale', key); } catch(e){}
    applyFontScale();
  }
  window.setFontScale = setFontScale;

  // Apply at boot. If a11y.js loads before app boot, we still set the
  // html font-size immediately — no flash of wrong-sized text.
  applyFontScale();
})();
