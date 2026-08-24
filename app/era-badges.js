// ═══════════════════════════════════════════════════════════════
// era-badges.js — helper functions for rendering the small colored
// era/manufacturer badge shown on browse rows and item detail.
//
// Reads config from ERA_BADGES (era-badges-config.js). Colors pulled
// from WHAT_I_COLLECT.eraColors (onboarding-config.js). Era labels
// pulled from ERAS (config.js). Nothing is hardcoded here.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Resolve a tab name to its era id. Returns null if we can't tell.
  function eraForTab(tabName) {
    if (!tabName) return null;
    var cfg = window.ERA_BADGES || {};
    // Explicit map first
    if (cfg.tabToEra && cfg.tabToEra[tabName]) return cfg.tabToEra[tabName];
    // Then try ERA_TABS.<era>.* — if tabName matches any tab in an era's
    // mapping, that's the era. (Auto-handles future tabs without needing
    // to extend ERA_BADGES.tabToEra.)
    if (typeof ERA_TABS !== 'undefined') {
      for (var eraKey in ERA_TABS) {
        var tabs = ERA_TABS[eraKey] || {};
        for (var k in tabs) {
          if (tabs[k] === tabName) return eraKey;
        }
      }
    }
    return null;
  }
  window.eraForTab = eraForTab;

  // Return the HTML string for a small era badge. Safe to drop anywhere.
  // Returns empty string when badge disabled, tab is unknown, or no era.
  function eraBadgeHTML(tabName, opts) {
    var cfg = window.ERA_BADGES || {};
    if (!cfg.enabled) return '';
    // Session 117: gate to All mode only by default. The badge purpose
    // is to tell the user which era a row came from when the unified
    // collection is being shown. In single-era mode the answer is
    // obvious from the dropdown. Override with showOnlyInAllMode:false
    // in era-badges-config.js if you want them everywhere.
    if (cfg.showOnlyInAllMode) {
      var curEra = (typeof _currentEra !== 'undefined') ? _currentEra : null;
      if (curEra !== 'all') return '';
    }
    var eraKey = eraForTab(tabName);
    if (!eraKey) return '';
    var shortLabel = (cfg.shortLabel && cfg.shortLabel[eraKey]) || eraKey.toUpperCase();
    var colors = (window.WHAT_I_COLLECT && window.WHAT_I_COLLECT.eraColors) || {};
    var accent = colors[eraKey] || 'var(--accent)';
    var era = (typeof ERAS !== 'undefined') ? (ERAS[eraKey] || {}) : {};
    var fullLabel = era.label || eraKey;
    // title= tooltip on hover — full era name
    var size = (opts && opts.size) || 'sm';
    var padY = size === 'lg' ? '3px' : '1px';
    var padX = size === 'lg' ? '8px' : '5px';
    var fontSize = size === 'lg' ? '0.7rem' : '0.62rem';
    return '<span class="era-badge era-badge-' + _escape(eraKey) + '" ' +
      'title="' + _escape(fullLabel) + '" ' +
      'style="display:inline-block;padding:' + padY + ' ' + padX + ';' +
      'border-radius:4px;font-size:' + fontSize + ';font-weight:700;' +
      'letter-spacing:0.05em;background:' + _escape(accent) + ';color:#fff;' +
      'vertical-align:middle;margin-left:4px;line-height:1;white-space:nowrap">' +
      _escape(shortLabel) + '</span>';
  }
  window.eraBadgeHTML = eraBadgeHTML;

  // Session 85: the product-LINE badge — "Williams by Bachmann" first,
  // K-Line by Lionel when its marker lands. Driven by the row's own
  // Category value via ERA_BADGES.lineBadges. Deliberately NOT gated to
  // all-eras mode: unlike the era, the line is never obvious from the
  // era dropdown — it's exactly what you browse the Williams catalog to
  // learn. Outlined chip, themed vars only (the colour ratchet stays
  // quiet), distinct at a glance from the solid era badges.
  function lineBadgeHTML(item, opts) {
    var cfg = window.ERA_BADGES || {};
    if (!cfg.enabled || !cfg.lineBadges) return '';
    var cat = item && item.category ? String(item.category).trim() : '';
    if (!cat || !cfg.lineBadges[cat]) return '';
    var b = cfg.lineBadges[cat];
    var size = (opts && opts.size) || 'sm';
    var padY = size === 'lg' ? '3px' : '1px';
    var padX = size === 'lg' ? '8px' : '5px';
    var fontSize = size === 'lg' ? '0.7rem' : '0.62rem';
    return '<span class="era-badge line-badge" ' +
      'title="' + _escape(b.title || cat) + '" ' +
      'style="display:inline-block;padding:' + padY + ' ' + padX + ';' +
      'border-radius:4px;font-size:' + fontSize + ';font-weight:700;' +
      'letter-spacing:0.05em;background:transparent;' +
      'border:1px solid var(--accent2);color:var(--accent2);' +
      'vertical-align:middle;margin-left:4px;line-height:1;white-space:nowrap">' +
      _escape(b.label || cat) + '</span>';
  }
  window.lineBadgeHTML = lineBadgeHTML;

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
