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

  // ══ v0.9.1414 — KEYBOARD REACH FOR CLICKABLE ROWS AND PREF SECTIONS ═════
  //
  // Two things a keyboard-only user could not do: OPEN an item (the delete
  // button in a row is a real <button> and focusable, but the row itself is a
  // <tr onclick> — clickable by mouse, invisible to Tab), and open any section
  // in Preferences, which is the one screen holding Text Size and Theme. So the
  // person most likely to need larger text was the person who could not reach
  // the setting.
  //
  // Done in ONE place rather than at ~17 markup sites. Editing each row builder
  // would be churn, would miss any row added later, and every one of those
  // sites is a template string where a typo is a silent break. Instead: stamp
  // the attributes on whatever is currently in the DOM, re-stamp when the DOM
  // changes, and handle the key press once by delegation. New clickable rows
  // are covered automatically, with no rule for anyone to remember.
  //
  // The pattern copied is the one wizard-suggestions.js already uses correctly:
  // role="button" + tabindex="0" + Enter/Space activation.

  var A11Y_CLICKABLE = 'tr[onclick], .pref-section-title';

  // ══ v0.9.2063 (known-problems sweep A3) — A BUTTON THAT SHOWS ONLY A SYMBOL ══
  // (× ▲ ✂ 📷 ✏️ 📅 ‹ › + − ?) says what it does. Its words are written ONCE
  // where the button is built — aria-label or title — and the stamp below
  // copies them to the other: title is what a resting mouse shows, aria-label
  // is what a screen reader says. A phone shows neither, so tutorial.js's
  // press and hold shows the same words in the conductor's bubble.
  // RR_SYMBOL_CONTROL: what counts as a button (links are left out — a held
  // link opens the phone's own link menu). rrSymbolOnly(el): its text has
  // something in it, but no letter or number. rrControlWords(el): its words —
  // aria-label, else title, else its data-ctip tip as plain text; '' if none.
  // tests/symbol_words_2063_tests.js holds every symbol button to these.
  var RR_SYMBOL_CONTROL = 'button, [role="button"], [onclick]:not(a)';
  var A11Y_SYMBOL_HALF = 'button[title]:not([aria-label]), button[aria-label]:not([title]), [role="button"][title]:not([aria-label]), [role="button"][aria-label]:not([title]), button[data-ctip]:not([aria-label])';
  function rrSymbolOnly(el) {
    if (!el) return false;
    var t = String(el.textContent || '').replace(/\s+/g, '');
    return t !== '' && !/[A-Za-z0-9]/.test(t);
  }
  function rrControlWords(el) {
    if (!el || !el.getAttribute) return '';
    var c = [el.getAttribute('aria-label'), el.getAttribute('title'), String(el.getAttribute('data-ctip') || '').replace(/<[^>]*>/g, ' ')];
    for (var i = 0; i < c.length; i++) { var w = String(c[i] || '').replace(/\s+/g, ' ').trim(); if (/[A-Za-z0-9]/.test(w)) return w; }
    return '';
  }
  window.RR_SYMBOL_CONTROL = RR_SYMBOL_CONTROL; window.rrSymbolOnly = rrSymbolOnly; window.rrControlWords = rrControlWords;

  function _stamp(root) {
    try {
      (root || document).querySelectorAll(A11Y_CLICKABLE).forEach(function (el) {
        if (el.hasAttribute('tabindex')) return;          // already handled
        if (el.closest && el.closest('[aria-hidden="true"]')) return;
        el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      });
    } catch (e) { /* never let this break a render */ }
    try {   // v0.9.2063: a symbol button's words — both halves (see above)
      (root || document).querySelectorAll(A11Y_SYMBOL_HALF).forEach(function (el) {
        if (!rrSymbolOnly(el)) return;
        var w = rrControlWords(el);
        if (!w) return;
        if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', w);
        if (!el.hasAttribute('title') && !el.hasAttribute('data-ctip')) el.setAttribute('title', w);   // a data-ctip button already has the conductor's tip
      });
    } catch (e) { /* never let this break a render */ }
  }

  // Enter or Space fires the element's own click handler — so there is exactly
  // one behaviour, not a keyboard copy of it that can drift out of step.
  document.addEventListener('keydown', function (ev) {
    try {
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      var el = ev.target;
      if (!el || !el.matches || !el.matches(A11Y_CLICKABLE)) return;
      ev.preventDefault();          // stop Space scrolling the page
      el.click();
    } catch (e) {}
  });

  // Re-stamp after renders. Debounced to one pass per frame: the collection
  // list rebuilds every row at once, and this must not turn one render into
  // hundreds of DOM passes.
  var _pending = false;
  function _schedule() {
    if (_pending) return;
    _pending = true;
    (window.requestAnimationFrame || window.setTimeout)(function () {
      _pending = false;
      _stamp(document);
    }, 0);
  }
  try {
    new MutationObserver(_schedule).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* very old browser: the boot pass below still covers first paint */ }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { _stamp(document); });
  } else { _stamp(document); }

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
