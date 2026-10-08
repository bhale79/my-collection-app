// ═══════════════════════════════════════════════════════════════
// onboarding.js — first-run setup: two short questions, then the tour.
//
// v0.9.1893 (Brad, 2026-10-08, after walking it on his phone as a brand-new
// account): "I don't think we need … all the welcome to the rail roster
// scrolling pages. I think we need the app to open up and start the tour …
// I think the community page should be first, then the what do you collect …
// if we do this, we don't need the skip tour option at the top either."
//
// Screen 1: Community opt-in      (_buildCommunity)
// Screen 2: What do you collect?  (_buildPrefs — scale buttons on top)
// Screen 3: Put it on this device (_buildInstall — only when not installed)
// Then the overlay closes and the real guided tour starts on the dashboard
// (startDashboardTour, tutorial.js).
//
// Gone: the feature-card welcome screen, "See it in the app" and its
// "Back to the tour" bar, "Skip tour", and the "You're all set" screen.
// Every screen has its own buttons; nothing here is skippable by accident.
// Copy comes from onboarding-config.js.
// ═══════════════════════════════════════════════════════════════

(function() {
  // v0.9.1416 (Brad: "on start up, we should ask that as a start up question")
  // The install screen is skipped entirely when the app is ALREADY running
  // installed — there is nothing to offer then. _totalScreens() is asked
  // fresh each time so the "Step n of N" counter never promises a screen we
  // won't show.
  var TOTAL_SCREENS = 2;                    // screens before the install offer
  var SCREEN_COMMUNITY = 1, SCREEN_COLLECT = 2, SCREEN_INSTALL = 3;
  function _installOffered() {
    try { if (typeof window._pwaIsInstalled === 'function' && window._pwaIsInstalled()) return false; } catch (e) {}
    return true;
  }
  function _totalScreens() { return TOTAL_SCREENS + (_installOffered() ? 1 : 0); }
  var _screen = 1;

  // ─── Public entry points ───

  function showFeatureMap() {
    _screen = 1;
    _removeOverlay();
    _mountOverlay();
    _renderScreen();
    _pushBack();
  }
  window.showFeatureMap = showFeatureMap;   // name kept: app-setup.js showOnboarding() calls it

  // Device Back steps back one screen — it never skips the setup (there is no
  // skip any more). On the first screen it simply stays put.
  function _pushBack() {
    if (window.BackStack) window.BackStack.push('onboarding-tour', _onDeviceBack);
  }
  function _onDeviceBack() {
    if (!document.getElementById('onboarding-map-overlay')) return;   // already finished
    if (_screen > 1) { _screen = _screen - 1; _renderScreen(); }
    _pushBack();
  }

  function onboardNext() {
    if (_screen === SCREEN_COLLECT) _savePrefsFromForm();   // save whatever was ticked
    _screen = _screen + 1;
    if (_screen > _totalScreens()) { _complete(); return; }
    _renderScreen();
  }
  window.onboardNext = onboardNext;

  function onboardBack() {
    _screen = Math.max(1, _screen - 1);
    _renderScreen();
  }
  window.onboardBack = onboardBack;

  function onboardSkipPrefs() {
    // "Skip (keep all eras)" — reset to default (all)
    if (typeof _setEnabledEras === 'function' && typeof ERAS !== 'undefined') {
      try { _setEnabledEras(Object.keys(ERAS)); } catch(e){}
    }
    _screen = SCREEN_COLLECT;   // onboardNext must not read the (empty) form
    _screen = _screen + 1;
    if (_screen > _totalScreens()) { _complete(); return; }
    _renderScreen();
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
    if (_screen === SCREEN_COMMUNITY) p.appendChild(_buildCommunity());
    if (_screen === SCREEN_COLLECT)   p.appendChild(_buildPrefs());
    if (_screen === SCREEN_INSTALL)   p.appendChild(_buildInstall());
    // Scroll to top so long content begins fresh
    var ov = document.getElementById('onboarding-map-overlay');
    if (ov) ov.scrollTop = 0;
  }

  // ─── Screen builders (content only, header+footer added by dispatcher) ───

  function _buildHeader() {
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var title;
    if (_screen === SCREEN_COMMUNITY) {
      title = (window.COMMUNITY_OPTIN || {}).title || 'Community';
    } else if (_screen === SCREEN_COLLECT) {
      title = (window.WHAT_I_COLLECT || {}).title || 'What do you collect?';
    } else if (_screen === SCREEN_INSTALL) {
      title = 'Put it on this device';
    } else {
      title = '';
    }
    var progress = (u.progressTemplate || 'Step {n} of {total}')
      .replace('{n}', String(_screen)).replace('{total}', String(_totalScreens()));
    var el = document.createElement('div');
    el.innerHTML =
      '<div style="font-size:' + s.small + ';color:var(--text-dim);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.4rem">' +
        _escape(progress) +
      '</div>' +
      '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;line-height:1.2;margin-bottom:0.8rem">' +
        _escape(title) +
      '</div>';
    return el;
  }

  // Screen 2 — What I Collect preferences (scale buttons on top, v0.9.1893)
  function _buildPrefs() {
    var cfg = window.WHAT_I_COLLECT || {};
    var u = window.ONBOARD_UI || {};
    var s = _styles();
    var eras = (typeof ERAS !== 'undefined') ? ERAS : {};

    // v0.9.1415 (Brad, after a real tester hit it): this screen used to open
    // with EVERY era ticked, so someone who collects postwar Lionel had to
    // untick seventeen boxes before they could get on. It now opens BLANK on a
    // first run and they tick what they want.
    //
    // The distinction that makes this safe is "never chosen" vs "chose
    // everything" — not "is the list full". _getEnabledEras() defaults to ALL
    // when nothing is stored, so it cannot tell those apart; the raw key can.
    // No stored key => first run => start blank. A stored key => they have
    // been here before => show exactly what they picked, because silently
    // wiping someone's saved choices for opening a settings screen would be a
    // worse bug than the one this fixes.
    var _everChosen = false;
    try { _everChosen = !!_prefGet('lv_collect_eras', null); } catch (e) {}   // v0.9.1825: through the one reader
    var currentEnabled = [];
    if (_everChosen) {
      try { currentEnabled = (typeof _getEnabledEras === 'function') ? _getEnabledEras() : Object.keys(eras); }
      catch(e) { currentEnabled = Object.keys(eras); }
    }
    var enabledSet = {};
    currentEnabled.forEach(function(k) { enabledSet[k] = true; });

    // v0.9.1000 (Brad): the picker used to render ONLY cfg.eraOrder, a
    // hand-maintained list. Eras added to config.js (Atlas HO/N/Z in
    // v0.9.980, plus Weaver, RMT, Menards, 3rd Rail, USA Trains, LGB) never
    // got added to it, so 9 of 18 eras were invisible here. Now the SOURCE
    // is REAL_ERA_IDS and cfg.eraOrder is only a sort preference — anything
    // it doesn't mention still renders, at the end. A new era can no longer
    // go missing from this screen.
    var _order = cfg.eraOrder || [];
    var _allEraKeys = (typeof REAL_ERA_IDS !== 'undefined' && REAL_ERA_IDS.length)
      ? REAL_ERA_IDS.slice()
      : Object.keys(eras).filter(function (k) { return k !== 'all' && k !== 'placeholder'; });
    _allEraKeys = _allEraKeys.filter(function (k) { return !!eras[k]; });
    // v0.9.1749: a lookup-only era (the parts catalog) is not a thing to collect — never a card here.
    if (typeof LOOKUP_ONLY_ERAS !== 'undefined') _allEraKeys = _allEraKeys.filter(function (k) { return LOOKUP_ONLY_ERAS.indexOf(k) < 0; });
    _allEraKeys.sort(function (x, y) {
      var ix = _order.indexOf(x), iy = _order.indexOf(y);
      if (ix === -1) ix = 999;
      if (iy === -1) iy = 999;
      return ix - iy;
    });

    // Two columns on anything desktop-ish — 18 eras in one column was a
    // scroll marathon. Falls back to one column on phones.
    var _grid = (window.innerWidth >= 700)
      ? 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem'
      : 'display:flex;flex-direction:column;gap:0.7rem';
    // Bulk controls. With a blank start, "I collect nearly everything" would
    // otherwise be eighteen taps — this makes it two (Select all, then untick
    // the few you don't).
    var bulkHtml =
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.9rem 0 0.2rem">' +
        '<button type="button" onclick="onboardEraSelectAll(true)" style="' +
          'padding:0.5rem 0.9rem;background:none;border:1px solid var(--border);border-radius:' + s.btnR + ';' +
          'color:var(--text);font-family:var(--font-body);font-size:' + s.linkBtn + ';font-weight:600;cursor:pointer">' +
          'Select all' +
        '</button>' +
        '<button type="button" onclick="onboardEraSelectAll(false)" style="' +
          'padding:0.5rem 0.9rem;background:none;border:1px solid var(--border);border-radius:' + s.btnR + ';' +
          'color:var(--text-mid);font-family:var(--font-body);font-size:' + s.linkBtn + ';font-weight:600;cursor:pointer">' +
          'Clear all' +
        '</button>' +
        '<span id="onboarding-era-count" style="align-self:center;font-size:' + s.small + ';color:var(--text-dim)"></span>' +
      '</div>';

    // v0.9.1893: one button per scale that has at least one era on this list.
    _pressedScales = {};
    var chipsHtml = '';
    var _chips = (cfg.scaleChips || []).filter(function (c) {
      return _allEraKeys.some(function (k) { return _eraHasScale(k, c.id); });
    });
    if (_chips.length) {
      chipsHtml =
        '<div style="font-size:' + s.small + ';color:var(--text-mid);margin:0.9rem 0 0.5rem">' + _escape(cfg.scaleChipsTitle || '') + '</div>' +
        '<div id="onboarding-scale-chips" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.4rem">' +
        _chips.map(function (c) {
          return '<button type="button" data-scale="' + _escape(c.id) + '" aria-pressed="false" onclick="onboardScaleToggle(\'' + _escape(c.id) + '\')" style="' +
            'min-width:64px;min-height:' + s.btnH + ';padding:0.55rem 1rem;background:none;border:2px solid var(--border);' +
            'border-radius:' + s.btnR + ';color:var(--text);font-family:var(--font-head);font-size:' + s.body + ';font-weight:700;cursor:pointer">' +
            _escape(c.label || c.id) + '</button>';
        }).join('') +
        '</div>' +
        '<div style="font-size:' + s.small + ';color:var(--text-mid);margin:0.9rem 0 0">' + _escape(cfg.makersTitle || '') + '</div>';
    }

    var rowsHtml = '<div id="onboarding-era-rows" style="' + _grid + ';margin:0.8rem 0 1.2rem">';
    _allEraKeys.forEach(function(eraKey) {
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
            // v0.9.1584 (Brad: "you select several and then cant move
            // forward. its grayed out"): the v1415 gate only re-checked on
            // Select all/Clear all and at screen-open — ticking boxes BY
            // HAND never called onboardEraSync, so Save stayed disabled for
            // exactly the people who made careful choices. One wire fixes it.
            'onchange="onboardEraSync()" ' +
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
          '<button id="onboarding-era-save" onclick="onboardNext()" style="' +
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
      chipsHtml +
      bulkHtml +
      rowsHtml +
      (cfg.helperNote ? '<div style="font-size:' + s.small + ';color:var(--text-dim);line-height:1.5;margin-bottom:0.5rem;font-style:italic">' + _escape(cfg.helperNote) + '</div>' : '') +
      actions;
    // Set the gate once this screen is actually on the page (wrap is still
    // detached here, so the elements cannot be found yet).
    setTimeout(function () { try { onboardEraSync(); } catch (e) {} }, 0);
    return wrap;
  }

  // ── v0.9.1415 — the era picker's live state ────────────────────────────
  // With a blank start, "Save and continue" must not be pressable until they
  // have actually chosen something — otherwise a user taps straight past it,
  // the zero-selection fallback in _savePrefsFromForm quietly turns ALL eras
  // back on, and they get the very screen we were trying to spare them with no
  // idea why. "Skip (keep all eras)" stays as the honest, labelled way to take
  // everything, so there is no silent third path.
  function _eraBoxes() {
    return Array.prototype.slice.call(
      document.querySelectorAll('#onboarding-era-rows input[type="checkbox"][data-era]'));
  }
  function onboardEraSync() {
    try {
      var boxes = _eraBoxes();
      var n = boxes.filter(function (b) { return b.checked; }).length;
      var save = document.getElementById('onboarding-era-save');
      if (save) {
        var off = (n === 0);
        save.disabled = off;
        save.style.opacity = off ? '0.45' : '';
        save.style.cursor = off ? 'not-allowed' : 'pointer';
        save.title = off ? 'Pick at least one, or use Skip to keep them all' : '';
      }
      var lbl = document.getElementById('onboarding-era-count');
      if (lbl) lbl.textContent = n ? (n + ' of ' + boxes.length + ' chosen') : 'none chosen yet';
      _syncScaleChips(boxes);
    } catch (e) {}
  }
  window.onboardEraSync = onboardEraSync;

  // ── v0.9.1893: the scale buttons ───────────────────────────────────────
  // An era's scales: ERA_SCALES_MULTI first (Pre-War and MTH Tinplate are
  // both O and Standard), else its one ERA_SCALE. Compared without case —
  // ERA_SCALE writes G scale as 'g' for some makers and 'G' for others.
  function _eraHasScale(eraKey, scaleId) {
    var want = String(scaleId || '').toLowerCase();
    var list = (typeof ERA_SCALES_MULTI !== 'undefined' && ERA_SCALES_MULTI[eraKey])
      || [(typeof ERA_SCALE !== 'undefined' && ERA_SCALE[eraKey]) || ''];
    return list.some(function (x) { return String(x || '').toLowerCase() === want && want !== ''; });
  }
  // A button is "on" only when the person TAPPED it (and has not since
  // unticked one of its lines by hand). Judging "on" by "every line of that
  // scale is ticked" lit Standard whenever O was tapped, because Pre-War and
  // MTH Tinplate are both — the screenshot check caught it. Tapping an "on"
  // button unticks its lines, except any line another "on" button still wants.
  var _pressedScales = {};
  function _scaleBoxes(boxes, scaleId) {
    return boxes.filter(function (b) { return _eraHasScale(b.getAttribute('data-era'), scaleId); });
  }
  function _syncScaleChips(boxes) {
    Object.keys(_pressedScales).forEach(function (id) {
      var mine = _scaleBoxes(boxes, id);
      if (!mine.length || !mine.every(function (b) { return b.checked; })) delete _pressedScales[id];
    });
    var chips = document.querySelectorAll('#onboarding-scale-chips button[data-scale]');
    Array.prototype.forEach.call(chips, function (chip) {
      var on = !!_pressedScales[chip.getAttribute('data-scale')];
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      chip.style.background = on ? 'var(--accent)' : 'none';
      chip.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
      chip.style.color = on ? 'var(--on-accent)' : 'var(--text)';
    });
  }
  function onboardScaleToggle(scaleId) {
    try {
      var boxes = _eraBoxes();
      var mine = _scaleBoxes(boxes, scaleId);
      if (!mine.length) return;
      if (_pressedScales[scaleId]) {
        delete _pressedScales[scaleId];
        mine.forEach(function (b) {
          var era = b.getAttribute('data-era');
          var wanted = Object.keys(_pressedScales).some(function (id) { return _eraHasScale(era, id); });
          if (!wanted) b.checked = false;
        });
      } else {
        _pressedScales[scaleId] = true;
        mine.forEach(function (b) { b.checked = true; });
      }
      onboardEraSync();
    } catch (e) {}
  }
  window.onboardScaleToggle = onboardScaleToggle;

  function onboardEraSelectAll(on) {
    try {
      _eraBoxes().forEach(function (b) { b.checked = !!on; });
      onboardEraSync();
    } catch (e) {}
  }
  window.onboardEraSelectAll = onboardEraSelectAll;

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
      var markColor = item.ok ? '#2ecc71' : '#c0392b';
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

    // v0.9.1893: this is the FIRST screen now — nothing to go back to.
    var actions =
      '<div style="display:flex;justify-content:flex-end;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
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
      (cfg.subtitle ? '<div style="font-size:' + s.small + ';color:var(--t-accent);font-family:var(--font-head);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:0.6rem">' +
        _escape(cfg.subtitle) +
      '</div>' : '') +
      paraHtml +
      submittedBox +
      actions;
    return wrap;
  }

  // ── Screen 4 — put the app on this device (v0.9.1416) ──────────────────
  // Brad, after a beta tester never found the install button: "on start up, we
  // should ask that as a start up question."
  //
  // Three different devices, three different truths, so this screen asks the
  // browser what it can actually do rather than showing one set of steps and
  // hoping:
  //   • Chrome / Edge (Android + desktop) hand us a real install prompt — one
  //     button, the browser's own dialog.
  //   • iOS Safari allows no programmatic install at all, so the steps are
  //     printed here inline. (Deliberately NOT routed through _pwaInstall's
  //     iOS hint — that hint paints its own overlay, which would land behind
  //     this one.)
  //   • Anything else gets the honest menu instruction and no dead button.
  function _buildInstall() {
    var s = _styles();
    var isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var canPrompt = !!window._pwaPrompt;

    var lead =
      '<p style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.65;margin:0 0 1rem">' +
        'The Rail Roster can live on your home screen or desktop like any other app — its own ' +
        'conductor icon, its own window, no address bar, and it opens straight to your collection.' +
      '</p>';

    var laterLabel = 'Not right now';
    var body, primary;

    if (canPrompt) {
      body = lead +
        '<p style="font-size:' + s.small + ';color:var(--text-dim);line-height:1.6;margin:0 0 1.2rem">' +
          'Your browser can do this in one tap. You can always add it later from the menu under ' +
          'your name → <strong>Install on this device</strong>.' +
        '</p>';
      primary =
        '<button onclick="onboardInstallNow()" style="' +
          'padding:0.95rem 1.5rem;background:var(--accent);border:none;' +
          'border-radius:' + s.btnR + ';color:var(--on-accent);font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
          'Install now' +
        '</button>';
    } else if (isIOS) {
      body = lead + _stepBox([
        'Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow going up).',
        'Scroll down and tap <strong>Add to Home Screen</strong>.',
        'Tap <strong>Add</strong> in the top corner. The conductor icon appears with your other apps.'
      ], s);
      laterLabel = 'Got it — continue';
      primary = '';
    } else {
      body = lead + _stepBox([
        'Open your browser’s menu (the <strong>⋮</strong> or <strong>⋯</strong> button).',
        'Choose <strong>Install</strong>, <strong>Add to Home screen</strong>, or <strong>Create shortcut</strong> — the wording varies by browser.'
      ], s) +
        '<p style="font-size:' + s.small + ';color:var(--text-dim);line-height:1.6;margin:0 0 1.2rem">' +
          'If you don’t see one of those, this browser doesn’t support installing. Everything still ' +
          'works normally in the tab.' +
        '</p>';
      laterLabel = 'Continue';
      primary = '';
    }

    var actions =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
        '<button onclick="onboardBack()" style="' +
          'padding:0.9rem 1.2rem;background:none;border:1px solid var(--border);' +
          'border-radius:' + s.btnR + ';color:var(--text);font-family:var(--font-body);' +
          'font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape((window.ONBOARD_UI || {}).backLabel || '← Back') +
        '</button>' +
        '<div id="onboard-install-actions" style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
          '<button onclick="onboardNext()" style="' +
            'padding:0.9rem 1.4rem;background:' + (primary ? 'none' : 'var(--accent)') + ';' +
            'border:' + (primary ? '1px solid var(--border)' : 'none') + ';' +
            'border-radius:' + s.btnR + ';color:' + (primary ? 'var(--text-mid)' : 'var(--on-accent)') + ';' +
            'font-family:var(--font-body);font-size:' + s.body + ';font-weight:' + (primary ? '600' : '700') + ';' +
            'cursor:pointer;min-height:' + s.btnH + '">' +
            _escape(laterLabel) +
          '</button>' +
          primary +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = body + actions;
    return wrap;
  }

  // Numbered steps box — the copy above is authored here, so it is trusted
  // markup on purpose (bold tags). Nothing user-supplied reaches it.
  function _stepBox(steps, s) {
    var rows = steps.map(function (t, i) {
      return '<div style="display:flex;gap:0.7rem;align-items:flex-start;padding:0.4rem 0">' +
        '<span style="flex-shrink:0;width:1.5rem;height:1.5rem;border-radius:50%;background:var(--accent);' +
          'color:var(--on-accent);font-size:' + s.small + ';font-weight:700;display:flex;align-items:center;' +
          'justify-content:center;line-height:1">' + (i + 1) + '</span>' +
        '<span style="font-size:' + s.body + ';color:var(--text-mid);line-height:1.5">' + t + '</span>' +
      '</div>';
    }).join('');
    return '<div style="background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:' + s.cardR + ';padding:1rem 1.1rem;margin:0 0 1.2rem">' + rows + '</div>';
  }

  // The browser's install dialog is modal and gives us no reliable "finished"
  // signal we can hang navigation on, so we don't guess: fire the prompt, then
  // swap the button row to a single Continue the collector taps when they're
  // done with whatever the browser put on screen.
  function onboardInstallNow() {
    try { if (typeof window._pwaInstall === 'function') window._pwaInstall(); } catch (e) {}
    var row = document.getElementById('onboard-install-actions');
    if (!row) return;
    var s = _styles();
    row.innerHTML =
      '<button onclick="onboardNext()" style="' +
        'padding:0.95rem 1.8rem;background:var(--accent);border:none;' +
        'border-radius:' + s.btnR + ';color:var(--on-accent);font-family:var(--font-body);' +
        'font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
        'Continue →' +
      '</button>';
  }
  window.onboardInstallNow = onboardInstallNow;

  // ─── Completion / persistence ───

  function _persistSeen() {
    // v0.9.1793: records WHICH account finished, so signing back in as the
    // same person goes straight to the dashboard.
    try { rrMarkOnboardingSeen(); } catch(e){}
  }

  // Finished the last screen: remember it for this account, close, and start
  // the real guided tour on the dashboard (Brad: "the app to open up and start
  // the tour"). The tour has its own Cancel on every card.
  function _complete() {
    _persistSeen();
    _removeOverlay();
    _screen = 1;
    if (window.BackStack) window.BackStack.pop('onboarding-tour');
    setTimeout(function () {
      try {
        if (typeof rrRecordingMode === 'function' && rrRecordingMode()) return;
        if (typeof showPage === 'function') showPage('dashboard');
        if (typeof startDashboardTour === 'function') startDashboardTour();
      } catch (e) { console.warn('[Onboarding] tour start failed:', e); }
    }, 450);
  }
  window.onboardFinish = _complete;

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
