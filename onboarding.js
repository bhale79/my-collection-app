// ═══════════════════════════════════════════════════════════════
// onboarding.js — 3-screen onboarding flow.
//
// Screen 1: Feature Map (Phase A)
// Screen 2: What I Collect preferences (Phase B)
// Screen 3: Community opt-in (Phase C — relocated from surprise popup)
// Screen 4 (done): brief "all set" confirmation + Finish.
//
// All screens share the same overlay, same styling, same Back/Next/Skip
// chrome. Copy and feature list come from onboarding-config.js.
// ═══════════════════════════════════════════════════════════════

(function() {
  var TOTAL_SCREENS = 3;
  var _screen = 1;
  var _inTourPreview = false;
  var _lastCardId    = null;

  // ─── Public entry points ───

  function showFeatureMap() {
    _screen = 1;
    _inTourPreview = false;
    _lastCardId = null;
    _hideReturnBar();
    _removeOverlay();
    _mountOverlay();
    _renderScreen();
    // Device back = skip the tour (same as the in-modal "Skip tour" button).
    // In-tour Next/Back handle cross-screen navigation separately.
    if (window.BackStack) window.BackStack.push('onboarding-tour', _completeSilently);
  }
  window.showFeatureMap = showFeatureMap;

  function onboardReopenTour() { showFeatureMap(); }
  window.onboardReopenTour = onboardReopenTour;

  // Session 112: open a small standalone modal showing the GIF demo list.
  // Placeholders today; once TUTORIAL_GIFS.demos have gifUrl populated the
  // buttons become launchers (same _openGifModal used by the Help menu).
  function _closeGifsPreviewSilently() {
    var el = document.getElementById('onboard-gifs-preview');
    if (el) el.remove();
  }
  function onboardCloseGifsPreview() {
    _closeGifsPreviewSilently();
    if (window.BackStack) window.BackStack.pop('onboard-gifs-preview');
  }
  window.onboardCloseGifsPreview = onboardCloseGifsPreview;

  function onboardShowGifsPreview() {
    var cfg = window.TUTORIAL_GIFS || {};
    var existing = document.getElementById('onboard-gifs-preview');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'onboard-gifs-preview';
    var s = _styles();
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(10,14,20,0.90);z-index:' + (s.z + 5) + ';' +
      'display:flex;align-items:flex-start;justify-content:center;padding:1.5rem;overflow-y:auto';
    var list = (cfg.demos || []).map(function(d) {
      var comingSoon = !d.gifUrl;
      var badge = comingSoon
        ? '<span style="font-size:' + s.small + ';color:var(--text-dim);font-style:italic">' + _escape(cfg.comingSoonBadge || 'Coming soon') + '</span>'
        : '<span style="font-size:' + s.small + ';color:#27ae60;font-weight:600">Ready</span>';
      return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.9rem 0;border-bottom:1px solid var(--border)">' +
        '<div style="font-size:1.5rem">\uD83C\uDFAC</div>' +
        '<div style="flex:1">' +
          '<div style="font-weight:600;font-size:' + s.body + ';color:var(--text)">' + _escape(d.title || '') + '</div>' +
          (d.description ? '<div style="font-size:' + s.small + ';color:var(--text-mid);margin-top:0.15rem">' + _escape(d.description) + '</div>' : '') +
        '</div>' +
        badge +
      '</div>';
    }).join('');
    ov.innerHTML =
      '<div style="background:var(--surface);border-radius:14px;max-width:560px;width:100%;padding:1.4rem;box-shadow:0 20px 60px rgba(0,0,0,0.5);margin:auto 0">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.8rem">' +
          '<div style="font-family:var(--font-head);font-size:1.3rem;font-weight:700;color:var(--text)">' + _escape(cfg.sectionTitle || 'Watch how it works') + '</div>' +
          '<button onclick="onboardCloseGifsPreview()" aria-label="Close" style="background:none;border:none;color:var(--text-mid);font-size:1.6rem;cursor:pointer;padding:0.2rem 0.5rem;line-height:1">\u00D7</button>' +
        '</div>' +
        (cfg.sectionNote ? '<div style="font-size:' + s.small + ';color:var(--text-dim);margin-bottom:0.8rem;font-style:italic">' + _escape(cfg.sectionNote) + '</div>' : '') +
        '<div>' + list + '</div>' +
        '<div style="font-size:' + s.small + ';color:var(--text-dim);margin-top:1.2rem;padding-top:0.8rem;border-top:1px solid var(--border);text-align:center">You can also find these in the <strong>Help menu</strong> any time.</div>' +
        '<div style="text-align:center;margin-top:1rem">' +
          '<button onclick="onboardCloseGifsPreview()" style="padding:0.8rem 1.6rem;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">Back to tour</button>' +
        '</div>' +
      '</div>';
    ov.onclick = function(e) { if (e.target === ov) onboardCloseGifsPreview(); };
    document.body.appendChild(ov);
    if (window.BackStack) window.BackStack.push('onboard-gifs-preview', _closeGifsPreviewSilently);
  }
  window.onboardShowGifsPreview = onboardShowGifsPreview;

  function onboardNext() {
    if (_screen === 2) _savePrefsFromForm();   // save whatever was ticked
    _screen = Math.min(TOTAL_SCREENS + 1, _screen + 1);
    if (_screen > TOTAL_SCREENS) { _renderDone(); return; }
    _renderScreen();
  }
  window.onboardNext = onboardNext;

  function onboardBack() {
    _screen = Math.max(1, _screen - 1);
    _renderScreen();
  }
  window.onboardBack = onboardBack;

  function onboardSkipTour() { _complete(); }
  window.onboardSkipTour = onboardSkipTour;

  function onboardSkipPrefs() {
    // "Skip (keep all eras)" — reset to default (all)
    if (typeof _setEnabledEras === 'function' && typeof ERAS !== 'undefined') {
      try { _setEnabledEras(Object.keys(ERAS)); } catch(e){}
    }
    onboardNext();
  }
  window.onboardSkipPrefs = onboardSkipPrefs;

  function onboardOptInYes() {
    try { if (typeof vaultSetOptIn === 'function') vaultSetOptIn(true); } catch(e){}
    onboardNext();
  }
  window.onboardOptInYes = onboardOptInYes;

  function onboardOptInNo() {
    try { if (typeof vaultSetOptIn === 'function') vaultSetOptIn(false); } catch(e){}
    onboardNext();
  }
  window.onboardOptInNo = onboardOptInNo;

  function onboardFinish() { _complete(); }
  window.onboardFinish = onboardFinish;

  // Preview a feature in-place (Screen 1 action only).
  function onboardPreviewFeature(cardId) {
    var f = (window.FEATURE_MAP || []).find(function(c) { return c.id === cardId; });
    if (!f) return;
    _lastCardId = cardId;
    _inTourPreview = true;
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.style.display = 'none';
    try {
      if (typeof showPage === 'function' && f.targetPage) showPage(f.targetPage);
    } catch(e) { console.warn('[Onboarding] preview navigation failed:', e); }
    _showReturnBar(f);
  }
  window.onboardPreviewFeature = onboardPreviewFeature;

  function onboardResumeMap() {
    _inTourPreview = false;
    _hideReturnBar();
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) { ov.style.display = 'flex'; } else { showFeatureMap(); }
  }
  window.onboardResumeMap = onboardResumeMap;

  // ─── Overlay mount / teardown ───

  function _mountOverlay() {
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
    ov.appendChild(panel);
    document.body.appendChild(ov);
  }

  function _removeOverlay() {
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.remove();
  }

  function _panel() { return document.getElementById('onboarding-map-panel'); }

  // ─── Screen dispatcher ───

  function _renderScreen() {
    var p = _panel();
    if (!p) { _mountOverlay(); p = _panel(); }
    p.innerHTML = '';
    p.appendChild(_buildHeader());
    if (_screen === 1) p.appendChild(_buildFeatureMap());
    if (_screen === 2) p.appendChild(_buildPrefs());
    if (_screen === 3) p.appendChild(_buildCommunity());
    p.appendChild(_buildFooter());
    // Scroll to top so long content begins fresh
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.scrollTop = 0;
  }

  function _renderDone() {
    var p = _panel();
    if (!p) return;
    var s = _styles();
    var u = window.ONBOARD_UI || {};
    var c = window.COMMUNITY_OPTIN || {};
    var optedIn = false;
    try { optedIn = localStorage.getItem('lv_vault_optin') === 'true'; } catch(e){}
    p.innerHTML =
      '<div style="text-align:center;padding:2rem 1rem">' +
        '<div style="font-size:3rem;margin-bottom:0.5rem">\uD83C\uDF89</div>' +
        '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;color:var(--text);margin-bottom:0.8rem">You\'re all set!</div>' +
        '<div style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.55;margin-bottom:1.5rem">' +
          _escape(optedIn ? (c.doneMessage || 'Thanks! Tap Finish to start adding items.')
                          : (c.doneOptedOut || 'Tap Finish to begin.')) +
        '</div>' +
        '<button onclick="onboardFinish()" style="' +
          'padding:1rem 3rem;background:var(--accent);border:none;border-radius:' + s.btnR + ';' +
          'color:#fff;font-family:var(--font-body);font-size:' + s.body + ';font-weight:700;' +
          'cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(c.finishLabel || 'Finish') +
        '</button>' +
      '</div>';
  }

  // ─── Screen builders (content only, header+footer added by dispatcher) ───

  function _buildHeader() {
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    // Title is context-sensitive per screen
    var title;
    if (_screen === 1) {
      var firstName = '';
      try { firstName = (state && state.user && state.user.name || '').split(' ')[0] || ''; } catch(e){}
      title = (u.welcomeTitle || 'Welcome') + (firstName ? (', ' + firstName) : '');
    } else if (_screen === 2) {
      title = (window.WHAT_I_COLLECT || {}).title || 'What do you collect?';
    } else if (_screen === 3) {
      title = (window.COMMUNITY_OPTIN || {}).title || 'Community';
    } else {
      title = '';
    }
    var progress = (u.progressTemplate || 'Step {n} of {total}')
      .replace('{n}', String(_screen)).replace('{total}', String(TOTAL_SCREENS));
    var el = document.createElement('div');
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.4rem">' +
        '<div style="font-size:' + s.small + ';color:var(--text-dim);font-weight:600;letter-spacing:0.1em;text-transform:uppercase">' +
          _escape(progress) +
        '</div>' +
        '<button onclick="onboardSkipTour()" style="' +
          'background:none;border:none;color:var(--text-mid);' +
          'font-size:' + s.linkBtn + ';cursor:pointer;padding:0.85rem 1rem;' +
          'min-height:' + s.btnH + ';min-width:88px;font-family:var(--font-body);' +
          'text-decoration:underline">' +
          _escape(u.skipTourLabel || 'Skip tour') +
        '</button>' +
      '</div>' +
      '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;line-height:1.2;margin-bottom:0.8rem">' +
        _escape(title) +
      '</div>';
    return el;
  }

  function _buildFooter() {
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var isFirst = _screen === 1;
    var isLast  = _screen === TOTAL_SCREENS;

    // Screen 2 has its own footer (Save vs Skip). Screen 3 uses Yes/No buttons
    // rendered in the content. Only Screen 1 uses this shared Next/Back footer.
    if (_screen !== 1) return document.createElement('div');

    var el = document.createElement('div');
    el.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap';
    el.innerHTML =
      (isFirst ? '<span></span>' :
        '<button onclick="onboardBack()" style="' +
          'padding:0.9rem 1.2rem;background:none;border:1px solid var(--border);' +
          'border-radius:' + s.btnR + ';color:var(--text);font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(u.backLabel || '\u2190 Back') + '</button>') +
      '<button onclick="onboardNext()" style="' +
        'padding:0.95rem 2rem;background:var(--accent);border:none;' +
        'border-radius:' + s.btnR + ';color:#fff;font-family:var(--font-body);' +
        'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
        _escape(u.nextLabel || 'Next \u2192') +
      '</button>';
    return el;
  }

  // Screen 1 — Feature Map body
  function _buildFeatureMap() {
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var wrap = document.createElement('div');
    var intro =
      '<div style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.55;margin-bottom:1.2rem">' +
        (u.welcomeSubtitle ? '<div style="color:var(--accent);font-weight:600;margin-bottom:0.35rem">' + _escape(u.welcomeSubtitle) + '</div>' : '') +
        _escape(u.welcomeIntro || '') +
      '</div>';
    var cards = '<div id="onboarding-map-grid" style="' +
      'display:grid;gap:0.85rem;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));' +
      'margin-bottom:1.3rem">';
    (window.FEATURE_MAP || []).forEach(function(f) { cards += _buildCardHtml(f); });
    cards += '</div>';
    // Session 112: link to GIFs section of Help menu (closes onboarding
    // arc from earlier user ask: "mentioned or ability to click on it").
    var gifsLink = '';
    if (window.TUTORIAL_GIFS && (window.TUTORIAL_GIFS.demos || []).length) {
      gifsLink =
        '<div style="text-align:center;margin:0.3rem 0 1rem">' +
          '<button onclick="onboardShowGifsPreview()" style="' +
            'background:none;border:1px dashed var(--border);border-radius:10px;' +
            'padding:0.8rem 1.2rem;color:var(--accent);font-family:var(--font-body);' +
            'font-size:' + s.linkBtn + ';cursor:pointer;min-height:' + s.btnH + ';font-weight:600">' +
            '\uD83C\uDFAC  Watch how-to demos \u2192' +
          '</button>' +
        '</div>';
    }
    wrap.innerHTML = intro + cards + gifsLink;
    // Restore scroll position if returning from a preview
    setTimeout(function() {
      if (_lastCardId) {
        var el = document.getElementById('onboarding-card-' + _lastCardId);
        if (el && typeof el.scrollIntoView === 'function') {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
        }
      }
    }, 0);
    return wrap;
  }

  function _buildCardHtml(f) {
    var s = _styles();
    var hasShot = !!(f.screenshot && f.screenshot.length);
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
        'align-self:stretch;background:none;border:none;' +
        'padding:0.9rem 0.4rem;margin:0.3rem -0.4rem -0.3rem;' +
        'color:' + _escape(f.accentColor || 'var(--accent)') + ';font-weight:600;' +
        'font-size:' + s.linkBtn + ';cursor:pointer;font-family:var(--font-body);' +
        'text-decoration:underline;text-align:left;min-height:' + s.btnH + '">' +
        previewLabel +
      '</button>' +
      '</div>';
  }

  // Screen 2 — What I Collect preferences
  function _buildPrefs() {
    var cfg = window.WHAT_I_COLLECT || {};
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var eras = (typeof ERAS !== 'undefined') ? ERAS : {};

    // Current selection: use saved list if present, else all.
    var currentEnabled;
    try { currentEnabled = (typeof _getEnabledEras === 'function') ? _getEnabledEras() : Object.keys(eras); }
    catch(e) { currentEnabled = Object.keys(eras); }
    var enabledSet = {};
    currentEnabled.forEach(function(k) { enabledSet[k] = true; });

    var rowsHtml = '<div id="onboarding-era-rows" style="display:flex;flex-direction:column;gap:0.7rem;margin:0.8rem 0 1.2rem">';
    (cfg.eraOrder || Object.keys(eras)).forEach(function(eraKey) {
      var era = eras[eraKey];
      if (!era) return;
      var accent = (cfg.eraColors || {})[eraKey] || 'var(--accent)';
      var checked = !!enabledSet[eraKey];
      rowsHtml +=
        '<label style="' +
          'display:flex;align-items:center;gap:0.9rem;cursor:pointer;' +
          'background:var(--surface2);border:1px solid var(--border);border-radius:' + s.cardR + ';' +
          'padding:0.9rem 1rem;border-left:4px solid ' + _escape(accent) + ';' +
          'min-height:' + s.btnH + '">' +
          '<input type="checkbox" data-era="' + _escape(eraKey) + '" ' + (checked ? 'checked' : '') + ' ' +
            'style="width:22px;height:22px;flex-shrink:0;cursor:pointer;accent-color:' + _escape(accent) + '">' +
          '<div style="flex:1">' +
            '<div style="font-family:var(--font-head);font-size:' + s.cardTitle + ';font-weight:700;color:var(--text);line-height:1.2">' +
              _escape(era.label || eraKey) +
            '</div>' +
            '<div style="font-size:' + s.small + ';color:var(--text-mid);margin-top:0.2rem">' +
              _escape((era.manufacturer || '') + ' \u00B7 ' + (era.years || '')) +
            '</div>' +
          '</div>' +
        '</label>';
    });
    rowsHtml += '</div>';

    var actions =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
        '<button onclick="onboardBack()" style="' +
          'padding:0.9rem 1.2rem;background:none;border:1px solid var(--border);' +
          'border-radius:' + s.btnR + ';color:var(--text);font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(u.backLabel || '\u2190 Back') +
        '</button>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
          '<button onclick="onboardSkipPrefs()" style="' +
            'padding:0.9rem 1.2rem;background:none;border:1px solid var(--border);' +
            'border-radius:' + s.btnR + ';color:var(--text-mid);font-family:var(--font-body);' +
            'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
            _escape(cfg.skipLabel || 'Skip') +
          '</button>' +
          '<button onclick="onboardNext()" style="' +
            'padding:0.95rem 1.8rem;background:var(--accent);border:none;' +
            'border-radius:' + s.btnR + ';color:#fff;font-family:var(--font-body);' +
            'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
            _escape(cfg.saveLabel || 'Save and continue \u2192') +
          '</button>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.55;margin-bottom:0.4rem">' +
        _escape(cfg.subtitle || '') +
      '</div>' +
      rowsHtml +
      (cfg.helperNote ? '<div style="font-size:' + s.small + ';color:var(--text-dim);line-height:1.5;margin-bottom:0.5rem;font-style:italic">' + _escape(cfg.helperNote) + '</div>' : '') +
      actions;
    return wrap;
  }

  function _savePrefsFromForm() {
    // Reads checkboxes in the currently-rendered prefs screen and persists.
    var selected = [];
    var boxes = document.querySelectorAll('#onboarding-era-rows input[type="checkbox"][data-era]');
    boxes.forEach(function(b) {
      if (b.checked) selected.push(b.getAttribute('data-era'));
    });
    // If nothing is ticked, fall back to "all" so user can't end up with zero eras.
    if (!selected.length && typeof ERAS !== 'undefined') {
      selected = Object.keys(ERAS);
    }
    try {
      if (typeof _setEnabledEras === 'function') _setEnabledEras(selected);
      if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
    } catch(e) { console.warn('[Onboarding] save prefs failed:', e); }
  }

  // Screen 3 — Community opt-in
  function _buildCommunity() {
    var cfg = window.COMMUNITY_OPTIN || {};
    var u = window.ONBOARD_UI || {};
    var s = _styles();

    var paraHtml = (cfg.paragraphs || []).map(function(p) {
      return '<p style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.65;margin:0 0 0.9rem">' + _escape(p) + '</p>';
    }).join('');

    var listRows = (cfg.submittedList || []).map(function(item) {
      var mark = item.ok ? '\u2713' : '\u00D7';
      var markColor = item.ok ? '#27ae60' : '#c0392b';
      return '<div style="display:flex;gap:0.7rem;align-items:flex-start;padding:0.35rem 0">' +
        '<span style="color:' + markColor + ';font-weight:700;font-size:' + s.body + ';flex-shrink:0;width:1.2rem;text-align:center">' + mark + '</span>' +
        '<span style="font-size:' + s.body + ';color:' + (item.ok ? 'var(--text-mid)' : 'var(--text)') + ';line-height:1.5">' + _escape(item.text) + '</span>' +
      '</div>';
    }).join('');

    var submittedBox =
      '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:' + s.cardR + ';padding:1rem 1.1rem;margin:1rem 0 1.3rem">' +
        '<div style="font-size:' + s.small + ';color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem">' +
          _escape(cfg.submittedTitle || 'What gets submitted') +
        '</div>' +
        listRows +
      '</div>';

    var actions =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
        '<button onclick="onboardBack()" style="' +
          'padding:0.9rem 1.2rem;background:none;border:1px solid var(--border);' +
          'border-radius:' + s.btnR + ';color:var(--text);font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(u.backLabel || '\u2190 Back') +
        '</button>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
          '<button onclick="onboardOptInNo()" style="' +
            'padding:0.9rem 1.4rem;background:none;border:1px solid var(--border);' +
            'border-radius:' + s.btnR + ';color:var(--text-mid);font-family:var(--font-body);' +
            'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
            _escape(cfg.noLabel || 'Not right now') +
          '</button>' +
          '<button onclick="onboardOptInYes()" style="' +
            'padding:0.95rem 1.5rem;background:var(--accent);border:none;' +
            'border-radius:' + s.btnR + ';color:#fff;font-family:var(--font-body);' +
            'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
            _escape(cfg.yesLabel || 'Yes, I\'ll contribute') +
          '</button>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="font-size:' + s.small + ';color:var(--accent);font-family:var(--font-head);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:0.6rem">' +
        _escape(cfg.subtitle || '') +
      '</div>' +
      paraHtml +
      submittedBox +
      actions;
    return wrap;
  }

  // ─── Preview-nav "back to the tour" bar (Screen 1 only) ───

  function _showReturnBar(feature) {
    _hideReturnBar();
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var bar = document.createElement('div');
    bar.id = 'onboarding-return-bar';
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:' + (s.z + 2) + ';' +
      'background:var(--accent);color:#fff;padding:0.75rem 1rem;' +
      'font-family:var(--font-body);font-size:' + s.body + ';font-weight:600;' +
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
      if (e.target && e.target.tagName === 'BUTTON') return;
      onboardResumeMap();
    };
    document.body.appendChild(bar);
  }

  function _hideReturnBar() {
    var b = document.getElementById('onboarding-return-bar');
    if (b) b.remove();
  }

  // ─── Completion / persistence ───

  function _persistSeen() {
    try { localStorage.setItem('lv_onboarded', '1'); } catch(e){}
  }

  function _complete() {
    _completeSilently();
    if (window.BackStack) window.BackStack.pop('onboarding-tour');
  }

  // Same teardown without touching BackStack — used when BackStack itself
  // triggered the close (device-back press already popped its own entry).
  function _completeSilently() {
    _persistSeen();
    _removeOverlay();
    _hideReturnBar();
    _screen = 1;
  }

  // ─── Shared style tokens (derived from ONBOARD_UI each render) ───

  function _styles() {
    var u = window.ONBOARD_UI || {};
    return {
      body:      (u.bodyFontPx      || 18) + 'px',
      head:      (u.headingFontPx   || 28) + 'px',
      small:     (u.smallFontPx     || 15) + 'px',
      linkBtn:   ((u.linkFontPx || u.smallFontPx || 15) + 1) + 'px',
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
