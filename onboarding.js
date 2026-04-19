// ═══════════════════════════════════════════════════════════════
// onboarding.js — Phase A Feature Map.
//
// Replaces the old 3-bullet welcome modal with a feature-map: illustrated
// icon + title + one-line description per feature card, with an optional
// "See it in the app" live-nav preview (or screenshot if configured).
//
// All copy and the feature list come from onboarding-config.js. Do NOT
// hardcode feature names / descriptions / target pages here.
// ═══════════════════════════════════════════════════════════════

(function() {
  // State tracked only for duration of the tour
  var _inTourPreview = false;   // true if user clicked "See it in the app"
  var _lastCardId    = null;    // so we can scroll back to it on return

  // ─── Public entry points ───

  function showFeatureMap() {
    _inTourPreview = false;
    _lastCardId = null;
    _hideReturnBar();
    _removeMap();

    var u = window.ONBOARD_UI || {};
    var s = _styles();

    var ov = document.createElement('div');
    ov.id = 'onboarding-map-overlay';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(10,14,20,0.94);' +
      'z-index:' + s.z + ';display:flex;align-items:flex-start;justify-content:center;' +
      'overflow-y:auto;padding:1.5rem';

    var panel = document.createElement('div');
    panel.id = 'onboarding-map-panel';
    panel.style.cssText =
      'background:var(--surface);border-radius:' + s.cardR + ';' +
      'max-width:860px;width:100%;padding:1.6rem 1.5rem 1.3rem;' +
      'color:var(--text);font-family:var(--font-body);' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);margin:auto 0';

    // Header: title + skip link
    var firstName = '';
    try { firstName = (state && state.user && state.user.name || '').split(' ')[0] || ''; } catch(e){}
    var titleText = (u.welcomeTitle || 'Welcome');
    if (firstName) titleText += ', ' + firstName;

    var header =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.6rem">' +
        '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;line-height:1.2">' +
          _escape(titleText) +
        '</div>' +
        '<button onclick="onboardSkipTour()" style="' +
          'background:none;border:none;color:var(--text-mid);' +
          'font-size:' + s.small + ';cursor:pointer;padding:0.4rem 0.6rem;font-family:var(--font-body);' +
          'text-decoration:underline">' +
          _escape(u.skipTourLabel || 'Skip tour') +
        '</button>' +
      '</div>';

    var intro =
      '<div style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.55;margin-bottom:1.2rem">' +
        (u.welcomeSubtitle ? '<div style="color:var(--accent);font-weight:600;margin-bottom:0.35rem">' + _escape(u.welcomeSubtitle) + '</div>' : '') +
        _escape(u.welcomeIntro || '') +
      '</div>';

    // Grid of feature cards
    var cardsHtml = '<div id="onboarding-map-grid" style="' +
      'display:grid;gap:0.85rem;' +
      'grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));' +
      'margin-bottom:1.3rem">';

    (window.FEATURE_MAP || []).forEach(function(f) {
      cardsHtml += _buildCardHtml(f);
    });
    cardsHtml += '</div>';

    // Bottom actions
    var footer =
      '<div style="display:flex;justify-content:center;margin-top:0.5rem">' +
        '<button onclick="onboardFinish()" style="' +
          'padding:0.95rem 2.5rem;background:var(--accent);border:none;' +
          'border-radius:' + s.btnR + ';color:#fff;font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(u.getStartedLabel || 'Get Started') +
        '</button>' +
      '</div>';

    panel.innerHTML = header + intro + cardsHtml + footer;
    ov.appendChild(panel);
    document.body.appendChild(ov);

    // If we stored a lastCardId (returning from preview), scroll it into view
    if (_lastCardId) {
      var el = document.getElementById('onboarding-card-' + _lastCardId);
      if (el && typeof el.scrollIntoView === 'function') {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
      }
    }
  }
  window.showFeatureMap = showFeatureMap;

  // User clicked "See it in the app" on a card.
  // Approach: hide the map overlay (don't destroy), navigate to the target
  // page in the real app, and show a persistent "Back to the tour" bar
  // at the top of the viewport. When tapped, we restore the map.
  function onboardPreviewFeature(cardId) {
    var f = (window.FEATURE_MAP || []).find(function(c) { return c.id === cardId; });
    if (!f) return;
    _lastCardId = cardId;
    _inTourPreview = true;

    // Hide the overlay (keep in DOM so we don't lose state)
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.style.display = 'none';

    // Navigate to target page using the app's own router
    try {
      if (typeof showPage === 'function' && f.targetPage) {
        showPage(f.targetPage);
      }
    } catch(e) { console.warn('[Onboarding] preview navigation failed:', e); }

    _showReturnBar(f);
  }
  window.onboardPreviewFeature = onboardPreviewFeature;

  function onboardResumeMap() {
    _inTourPreview = false;
    _hideReturnBar();
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) {
      ov.style.display = 'flex';
    } else {
      // If overlay was removed for some reason, rebuild
      showFeatureMap();
    }
  }
  window.onboardResumeMap = onboardResumeMap;

  function onboardSkipTour() {
    _persistSeen();
    _removeMap();
    _hideReturnBar();
    _fireLegacyAfterOnboard();
  }
  window.onboardSkipTour = onboardSkipTour;

  function onboardFinish() {
    _persistSeen();
    _removeMap();
    _hideReturnBar();
    _fireLegacyAfterOnboard();
  }
  window.onboardFinish = onboardFinish;

  // Reopen the tour later — called from Help menu entry.
  function onboardReopenTour() {
    showFeatureMap();
  }
  window.onboardReopenTour = onboardReopenTour;

  // ─── Internal helpers ───

  function _buildCardHtml(f) {
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var hasShot = !!(f.screenshot && f.screenshot.length);
    // "See in app" can be either a live-nav link or an image modal.
    // Both go through onboardPreviewFeature — it dispatches internally.
    var previewLabel = hasShot ? 'See what it looks like \u2192' : 'See it in the app \u2192';
    return '<div id="onboarding-card-' + _escape(f.id) + '" style="' +
      'background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:' + s.cardR + ';padding:1.1rem 1rem;position:relative;' +
      'border-top:3px solid ' + _escape(f.accentColor || 'var(--accent)') + ';' +
      'display:flex;flex-direction:column;gap:0.5rem;min-height:150px">' +
      '<div style="font-size:2.3rem;line-height:1">' + (f.icon || '') + '</div>' +
      '<div style="font-family:var(--font-head);font-size:' + s.cardTitle + ';' +
        'font-weight:700;color:var(--text);letter-spacing:0.02em">' +
        _escape(f.title || '') +
      '</div>' +
      '<div style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.5;flex:1">' +
        _escape(f.description || '') +
      '</div>' +
      '<button onclick="onboardPreviewFeature(\'' + _escape(f.id) + '\')" style="' +
        'align-self:flex-start;background:none;border:none;padding:0.5rem 0 0.2rem;' +
        'color:' + _escape(f.accentColor || 'var(--accent)') + ';font-weight:600;' +
        'font-size:' + s.small + ';cursor:pointer;font-family:var(--font-body);' +
        'text-decoration:underline">' +
        previewLabel +
      '</button>' +
      '</div>';
  }

  function _showReturnBar(feature) {
    _hideReturnBar();
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var bar = document.createElement('div');
    bar.id = 'onboarding-return-bar';
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:' + (s.z + 2) + ';' +
      'background:var(--accent);color:#fff;' +
      'padding:0.75rem 1rem;font-family:var(--font-body);' +
      'font-size:' + s.body + ';font-weight:600;' +
      'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer';
    bar.innerHTML =
      '<span>' + _escape(u.tourBackBarLabel || '\u2190 Back to the tour') +
        (feature && feature.title ? '<span style="opacity:0.8;margin-left:0.5rem;font-weight:400"> \u00B7 viewing: ' + _escape(feature.title) + '</span>' : '') +
      '</span>' +
      '<button onclick="event.stopPropagation();onboardSkipTour()" style="' +
        'background:rgba(0,0,0,0.15);border:none;color:#fff;padding:0.4rem 0.7rem;' +
        'border-radius:8px;font-size:' + s.small + ';font-weight:600;cursor:pointer;' +
        'font-family:var(--font-body)">Exit tour</button>';
    bar.onclick = function(e) {
      // Any click on the bar (except the Exit button) returns to the tour
      if (e.target && e.target.tagName === 'BUTTON') return;
      onboardResumeMap();
    };
    document.body.appendChild(bar);
  }

  function _hideReturnBar() {
    var b = document.getElementById('onboarding-return-bar');
    if (b) b.remove();
  }

  function _removeMap() {
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.remove();
  }

  function _persistSeen() {
    try { localStorage.setItem('lv_onboarded', '1'); } catch(e){}
  }

  // Fire the same post-onboarding side-effect the old flow had:
  // the community opt-in modal. Left unchanged so Phase C can relocate it.
  function _fireLegacyAfterOnboard() {
    setTimeout(function() {
      try {
        if (typeof vaultShowOptInModal === 'function' && !localStorage.getItem('lv_vault_optin')) {
          vaultShowOptInModal(false);
        }
      } catch(e){}
    }, 500);
  }

  function _styles() {
    var u = window.ONBOARD_UI || {};
    return {
      body:      (u.bodyFontPx      || 18) + 'px',
      head:      (u.headingFontPx   || 28) + 'px',
      small:     (u.smallFontPx     || 15) + 'px',
      cardTitle: ((u.bodyFontPx || 18) + 4) + 'px',
      btnH:      (u.buttonMinHeightPx || 52) + 'px',
      btnR:      (u.buttonRadiusPx    || 12) + 'px',
      cardR:     (u.cardRadiusPx      || 14) + 'px',
      z:          u.overlayZIndex     || 9990,
    };
  }

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
