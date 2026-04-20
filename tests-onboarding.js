// ═══════════════════════════════════════════════════════════════
// tests-onboarding.js — on-demand automated test suite.
//
// NOT loaded by index.html. Only fetched + executed when I explicitly
// load it from dev tools / Chrome automation. No impact on real users.
//
// To run from a browser console:
//   const s=document.createElement('script');
//   s.src='/tests-onboarding.js?v='+Date.now();
//   s.onload=async()=>console.table((await TR_TESTS.run()).all);
//   document.head.appendChild(s);
//
// The suite saves/restores localStorage baselines and cleans up every
// overlay it creates, so running it is safe on any user's browser.
//
// When adding new features, ADD TESTS HERE. Keep this file self-contained.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // TEST_CONFIG — parameters the suite checks against the live app.
  // Edit here if the app's shape changes.
  // ──────────────────────────────────────────────────────────────
  var TEST_CONFIG = {
    expectedEraKeys:       ['prewar', 'pw', 'mpc', 'atlas'],
    expectedGmailPathIds:  ['ready', 'forgot', 'unsure', 'create'],
    expectedFeatureIds:    ['dashboard', 'collection', 'add-item', 'want', 'for-sale', 'reports'],
    totalOnboardingSteps:  3,
    tapTargetMinHeightPx:  48,      // older-user rule
    bodyFontMinPx:         16,      // older-user rule (18 preferred, 16 acceptable)
    buildPartnerMapMaxMs:  50,      // perf sentinel after Session 112 fix
    fetchTimeoutMs:        5000,
  };

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
  function text(el) { return (el && el.innerText) || ''; }
  function okMsg(msg) { return { ok: true,  msg: msg || '' }; }
  function fail(msg)  { return { ok: false, msg: msg || 'failed' }; }

  function cleanupAllOverlays() {
    ['onboarding-map-overlay', 'gmail-help-overlay', 'onboarding-return-bar',
     'onboard-gifs-preview', 'migration-overlay', 'rb-overlay'].forEach(function(id) {
      var el = $(id); if (el) el.remove();
    });
    // Wizard modal needs the 'open' class stripped, not removal, since
    // it's a persistent DOM element built once.
    var wiz = $('wizard-modal');
    if (wiz) { wiz.classList.remove('open'); }
    try { document.body.style.overflow = ''; } catch(e){}
    // Keep the BackStack clean between tests so nothing bleeds across cases.
    if (window.BackStack && typeof window.BackStack.clear === 'function') {
      window.BackStack.clear();
    }
  }

  function snapshotLS(keys) {
    var snap = {};
    keys.forEach(function(k) { snap[k] = localStorage.getItem(k); });
    return snap;
  }
  function restoreLS(snap) {
    Object.keys(snap).forEach(function(k) {
      if (snap[k] === null) localStorage.removeItem(k);
      else                  localStorage.setItem(k, snap[k]);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // TESTS — each returns { ok, msg } (msg optional on pass).
  // ──────────────────────────────────────────────────────────────
  var TESTS = [

    //  ── Config integrity ──
    { name: '01 config: FEATURE_MAP has expected ids', fn: function() {
        var map = window.FEATURE_MAP || [];
        var got = map.map(function(f) { return f.id; }).sort();
        var want = TEST_CONFIG.expectedFeatureIds.slice().sort();
        return JSON.stringify(got) === JSON.stringify(want) ? okMsg() :
          fail('expected ' + JSON.stringify(want) + ' got ' + JSON.stringify(got));
    }},

    { name: '02 config: every FEATURE_MAP targetPage resolves to a real DOM element', fn: function() {
        var missing = [];
        (window.FEATURE_MAP || []).forEach(function(f) {
          var el = $('page-' + f.targetPage);
          if (!el) missing.push(f.id + '→page-' + f.targetPage);
        });
        return missing.length ? fail('missing: ' + missing.join(', ')) : okMsg();
    }},

    { name: '03 config: ERAS has expected keys', fn: function() {
        if (typeof ERAS === 'undefined') return fail('ERAS undefined');
        var got = Object.keys(ERAS).sort();
        var want = TEST_CONFIG.expectedEraKeys.slice().sort();
        return JSON.stringify(got) === JSON.stringify(want) ? okMsg() :
          fail('expected ' + JSON.stringify(want) + ' got ' + JSON.stringify(got));
    }},

    { name: '04 config: WHAT_I_COLLECT.eraOrder references only real ERAS keys', fn: function() {
        var order = ((window.WHAT_I_COLLECT || {}).eraOrder) || [];
        var bad = order.filter(function(k) { return !(ERAS && ERAS[k]); });
        return bad.length ? fail('unknown era keys in eraOrder: ' + bad.join(', ')) : okMsg();
    }},

    { name: '05 config: GMAIL_HELP has expected path ids', fn: function() {
        var paths = ((window.GMAIL_HELP || {}).paths || []).map(function(p) { return p.id; }).sort();
        var want = TEST_CONFIG.expectedGmailPathIds.slice().sort();
        return JSON.stringify(paths) === JSON.stringify(want) ? okMsg() :
          fail('expected ' + JSON.stringify(want) + ' got ' + JSON.stringify(paths));
    }},

    { name: '06 config: COMMUNITY_OPTIN has paragraphs + submittedList', fn: function() {
        var c = window.COMMUNITY_OPTIN || {};
        if (!Array.isArray(c.paragraphs) || !c.paragraphs.length) return fail('paragraphs missing/empty');
        if (!Array.isArray(c.submittedList) || !c.submittedList.length) return fail('submittedList missing/empty');
        var bad = c.submittedList.filter(function(x) { return typeof x.ok !== 'boolean' || !x.text; });
        return bad.length ? fail('submittedList entries missing ok/text: ' + bad.length) : okMsg();
    }},

    //  ── Global functions exist ──
    { name: '07 globals: all onboarding functions are defined', fn: function() {
        var need = ['showFeatureMap','onboardNext','onboardBack','onboardSkipTour',
                    'onboardSkipPrefs','onboardOptInYes','onboardOptInNo','onboardFinish',
                    'onboardPreviewFeature','onboardResumeMap','onboardReopenTour',
                    'gmailShowHelp','gmailShowPath','gmailCloseHelp','gmailBackToChooser','gmailPrintGuide'];
        var miss = need.filter(function(fn) { return typeof window[fn] !== 'function'; });
        return miss.length ? fail('missing: ' + miss.join(', ')) : okMsg();
    }},

    //  ── Phase A: Feature Map ──
    { name: '10 featureMap: renders overlay with 6 cards + progress 1/3', fn: function() {
        showFeatureMap();
        var ov = $('onboarding-map-overlay');
        if (!ov) return fail('overlay not created');
        var grid = $('onboarding-map-grid');
        if (!grid) return fail('grid not found');
        var cards = grid.querySelectorAll('[id^="onboarding-card-"]');
        if (cards.length !== 6) return fail('cards: ' + cards.length + ' expected 6');
        var panel = $('onboarding-map-panel');
        if (!/STEP\s*1\s*OF\s*3|Step\s*1\s*of\s*3/i.test(text(panel))) return fail('progress indicator missing');
        return okMsg();
    }},

    { name: '11 featureMap: preview nav activates target page + shows return bar', fn: async function() {
        showFeatureMap();
        onboardPreviewFeature('collection');
        await wait(50);
        var bar = $('onboarding-return-bar');
        if (!bar) return fail('return bar missing');
        var browsePage = $('page-browse');
        var active = browsePage && (browsePage.classList.contains('active') || getComputedStyle(browsePage).display !== 'none');
        if (!active) return fail('page-browse did not become active');
        onboardResumeMap();
        return okMsg();
    }},

    { name: '12 featureMap: every preview nav resolves to the right page', fn: async function() {
        var failures = [];
        for (var i = 0; i < (window.FEATURE_MAP || []).length; i++) {
            var f = window.FEATURE_MAP[i];
            showFeatureMap();
            onboardPreviewFeature(f.id);
            await wait(30);
            var pg = $('page-' + f.targetPage);
            var active = pg && (pg.classList.contains('active') || getComputedStyle(pg).display !== 'none');
            if (!active) failures.push(f.id + '→page-' + f.targetPage);
            onboardResumeMap();
        }
        return failures.length ? fail('nav failed: ' + failures.join(', ')) : okMsg();
    }},

    //  ── Phase B: What I Collect preferences ──
    { name: '20 prefs: screen 2 renders 4 era checkboxes all checked by default', fn: function() {
        localStorage.removeItem('lv_collect_eras');
        showFeatureMap();
        onboardNext();       // screen 1 → 2
        var rows = document.querySelectorAll('#onboarding-era-rows input[type="checkbox"][data-era]');
        if (rows.length !== TEST_CONFIG.expectedEraKeys.length)
          return fail('rows: ' + rows.length + ' expected ' + TEST_CONFIG.expectedEraKeys.length);
        var checkedCount = Array.prototype.filter.call(rows, function(r) { return r.checked; }).length;
        if (checkedCount !== rows.length) return fail('not all checked by default');
        var panel = $('onboarding-map-panel');
        if (!/STEP\s*2\s*OF\s*3/i.test(text(panel))) return fail('progress 2/3 missing');
        return okMsg();
    }},

    { name: '21 prefs: saving unchecks persists to lv_collect_eras', fn: function() {
        showFeatureMap();
        onboardNext();
        // Uncheck prewar
        var pb = document.querySelector('#onboarding-era-rows input[data-era="prewar"]');
        if (!pb) return fail('prewar checkbox missing');
        pb.checked = false;
        onboardNext();  // save + move to screen 3
        var saved = JSON.parse(localStorage.getItem('lv_collect_eras') || '[]');
        if (saved.indexOf('prewar') >= 0) return fail('prewar was not excluded');
        var expect = TEST_CONFIG.expectedEraKeys.filter(function(k) { return k !== 'prewar'; });
        var ok = expect.every(function(k) { return saved.indexOf(k) >= 0; });
        return ok ? okMsg('saved ' + JSON.stringify(saved)) : fail('expected ' + JSON.stringify(expect) + ' got ' + JSON.stringify(saved));
    }},

    { name: '22 prefs: skip resets to all eras', fn: function() {
        localStorage.removeItem('lv_collect_eras');
        showFeatureMap();
        onboardNext();
        // Uncheck everything
        var rows = document.querySelectorAll('#onboarding-era-rows input[type="checkbox"][data-era]');
        Array.prototype.forEach.call(rows, function(r) { r.checked = false; });
        onboardSkipPrefs();
        var saved = JSON.parse(localStorage.getItem('lv_collect_eras') || '[]');
        var ok = TEST_CONFIG.expectedEraKeys.every(function(k) { return saved.indexOf(k) >= 0; });
        return ok ? okMsg() : fail('skipPrefs should reset to all; got ' + JSON.stringify(saved));
    }},

    { name: '23 prefs: empty-selection save falls back to all (no zero-era trap)', fn: function() {
        localStorage.removeItem('lv_collect_eras');
        showFeatureMap();
        onboardNext();
        var rows = document.querySelectorAll('#onboarding-era-rows input[type="checkbox"][data-era]');
        Array.prototype.forEach.call(rows, function(r) { r.checked = false; });
        onboardNext();  // save with all unchecked
        var saved = JSON.parse(localStorage.getItem('lv_collect_eras') || '[]');
        var ok = TEST_CONFIG.expectedEraKeys.every(function(k) { return saved.indexOf(k) >= 0; });
        return ok ? okMsg() : fail('empty save should fall back to all; got ' + JSON.stringify(saved));
    }},

    //  ── Phase C: Community opt-in ──
    { name: '30 community: screen 3 renders submitted list + yes/no buttons', fn: function() {
        showFeatureMap();
        onboardNext();
        onboardNext();
        var panel = $('onboarding-map-panel');
        if (!/STEP\s*3\s*OF\s*3/i.test(text(panel))) return fail('progress 3/3 missing');
        var btns = Array.prototype.slice.call(panel.querySelectorAll('button'));
        var hasYes = btns.some(function(b) { return /contribute/i.test(b.innerText); });
        var hasNo  = btns.some(function(b) { return /not right now/i.test(b.innerText); });
        var hasSubmitted = /what gets submitted/i.test(text(panel));
        var hasCheckmark = text(panel).indexOf('\u2713') >= 0;
        if (!hasYes || !hasNo || !hasSubmitted || !hasCheckmark)
          return fail('yes:' + hasYes + ' no:' + hasNo + ' submitted:' + hasSubmitted + ' chk:' + hasCheckmark);
        return okMsg();
    }},

    { name: '31 community: Yes sets lv_vault_optin=true and advances', fn: function() {
        localStorage.removeItem('lv_vault_optin');
        showFeatureMap();
        onboardNext(); onboardNext();
        onboardOptInYes();
        var v = localStorage.getItem('lv_vault_optin');
        if (v !== 'true') return fail('lv_vault_optin=' + v);
        var panel = $('onboarding-map-panel');
        var hasFinish = Array.prototype.some.call(panel.querySelectorAll('button'), function(b) { return /Finish/.test(b.innerText); });
        return hasFinish ? okMsg() : fail('Finish button missing on done screen');
    }},

    { name: '32 community: No sets lv_vault_optin=false and advances', fn: function() {
        localStorage.removeItem('lv_vault_optin');
        showFeatureMap();
        onboardNext(); onboardNext();
        onboardOptInNo();
        var v = localStorage.getItem('lv_vault_optin');
        if (v !== 'false') return fail('lv_vault_optin=' + v);
        return okMsg();
    }},

    //  ── Finish / skip cleanup ──
    { name: '40 finish: sets lv_onboarded=1 and removes overlay', fn: function() {
        localStorage.removeItem('lv_onboarded');
        showFeatureMap();
        onboardNext(); onboardNext(); onboardOptInNo();
        onboardFinish();
        if (localStorage.getItem('lv_onboarded') !== '1') return fail('lv_onboarded not persisted');
        if ($('onboarding-map-overlay')) return fail('overlay not removed');
        return okMsg();
    }},

    { name: '41 skipTour: works from any screen, sets lv_onboarded', fn: function() {
        localStorage.removeItem('lv_onboarded');
        showFeatureMap();
        onboardNext(); // now on screen 2
        onboardSkipTour();
        if (localStorage.getItem('lv_onboarded') !== '1') return fail('lv_onboarded not persisted from skipTour');
        if ($('onboarding-map-overlay')) return fail('overlay not removed');
        return okMsg();
    }},

    //  ── Phase 0: Gmail help ──
    { name: '50 gmail: chooser opens with 4 path buttons', fn: function() {
        gmailShowHelp();
        var ov = $('gmail-help-overlay');
        if (!ov) return fail('overlay missing');
        var btnLabels = Array.prototype.map.call(ov.querySelectorAll('button'), function(b) { return b.innerText.trim(); });
        var expected = TEST_CONFIG.expectedGmailPathIds.map(function(id) {
          return (window.GMAIL_HELP.paths.find(function(p) { return p.id === id; }) || {}).label || '';
        });
        var hitAll = expected.every(function(lbl) {
          return btnLabels.some(function(b) { return b.indexOf(lbl) >= 0; });
        });
        gmailCloseHelp();
        return hitAll ? okMsg() : fail('missing path buttons: ' + expected.filter(function(e){ return !btnLabels.some(function(b){return b.indexOf(e)>=0;}); }).join(', '));
    }},

    { name: '51 gmail: each path renders correct step count', fn: function() {
        var mismatches = [];
        TEST_CONFIG.expectedGmailPathIds.forEach(function(id) {
          gmailShowHelp();
          gmailShowPath(id);
          var ov = $('gmail-help-overlay');
          var ol = ov && ov.querySelector('ol');
          var rendered = ol ? ol.querySelectorAll('li').length : 0;
          var path = window.GMAIL_HELP.paths.find(function(p) { return p.id === id; });
          var expected = (path && path.steps) ? path.steps.length : 0;
          if (rendered !== expected) mismatches.push(id + ':' + rendered + '!=' + expected);
        });
        gmailCloseHelp();
        return mismatches.length ? fail(mismatches.join(', ')) : okMsg();
    }},

    { name: '52 gmail: back button returns to chooser, close removes overlay', fn: function() {
        gmailShowHelp();
        gmailShowPath('forgot');
        gmailBackToChooser();
        var ov = $('gmail-help-overlay');
        if (!ov) return fail('overlay disappeared on back');
        var hasPath1 = /I have Gmail and I'm ready/.test(text(ov));
        if (!hasPath1) return fail('chooser did not re-render');
        gmailCloseHelp();
        if ($('gmail-help-overlay')) return fail('close did not remove overlay');
        return okMsg();
    }},

    //  ── Tap-target & font-size guardrails (Session 112 older-user rules) ──
    { name: '60 tap: Feature Map buttons all ≥48px tall', fn: function() {
        showFeatureMap();
        var btns = document.querySelectorAll('#onboarding-map-panel button, #onboarding-map-grid button');
        var small = [];
        Array.prototype.forEach.call(btns, function(b) {
          if (b.offsetHeight < TEST_CONFIG.tapTargetMinHeightPx)
            small.push(b.innerText.substring(0, 30) + ':' + b.offsetHeight + 'px');
        });
        return small.length ? fail('undersized: ' + small.join('; ')) : okMsg();
    }},

    { name: '61 tap: Prefs screen buttons all ≥48px tall', fn: function() {
        showFeatureMap();
        onboardNext();
        var btns = document.querySelectorAll('#onboarding-map-panel button');
        var small = [];
        Array.prototype.forEach.call(btns, function(b) {
          if (b.offsetHeight < TEST_CONFIG.tapTargetMinHeightPx)
            small.push(b.innerText.substring(0, 30) + ':' + b.offsetHeight + 'px');
        });
        return small.length ? fail('undersized: ' + small.join('; ')) : okMsg();
    }},

    { name: '62 tap: Community screen buttons all ≥48px tall', fn: function() {
        showFeatureMap();
        onboardNext(); onboardNext();
        var btns = document.querySelectorAll('#onboarding-map-panel button');
        var small = [];
        Array.prototype.forEach.call(btns, function(b) {
          if (b.offsetHeight < TEST_CONFIG.tapTargetMinHeightPx)
            small.push(b.innerText.substring(0, 30) + ':' + b.offsetHeight + 'px');
        });
        return small.length ? fail('undersized: ' + small.join('; ')) : okMsg();
    }},

    { name: '63 font: Gmail modal buttons all ≥48px tall', fn: function() {
        gmailShowHelp();
        var btns = document.querySelectorAll('#gmail-help-overlay button');
        var small = [];
        Array.prototype.forEach.call(btns, function(b) {
          // Skip the tiny × close button — it's not the primary action
          if (/^[\u00D7x]$/.test(b.innerText.trim())) return;
          if (b.offsetHeight < TEST_CONFIG.tapTargetMinHeightPx)
            small.push(b.innerText.substring(0, 30) + ':' + b.offsetHeight + 'px');
        });
        gmailCloseHelp();
        return small.length ? fail('undersized: ' + small.join('; ')) : okMsg();
    }},

    //  ── Accessibility (Session 112: font-size + high-contrast) ──
    { name: '80 a11y: A11Y config exposes fontScale + theme + ui', fn: function() {
        var a = window.A11Y || {};
        if (!a.fontScale || !Array.isArray(a.fontScale.options) || !a.fontScale.options.length)
          return fail('A11Y.fontScale.options missing/empty');
        if (!a.theme || !Array.isArray(a.theme.options) || !a.theme.options.length)
          return fail('A11Y.theme.options missing/empty');
        var hcPresent = a.theme.options.some(function(o) { return o.key === 'high-contrast'; });
        return hcPresent ? okMsg() : fail('high-contrast theme option missing from A11Y.theme');
    }},

    { name: '81 a11y: applyFontScale + setFontScale globals exist', fn: function() {
        var miss = ['applyFontScale','setFontScale'].filter(function(fn) { return typeof window[fn] !== 'function'; });
        return miss.length ? fail('missing: ' + miss.join(', ')) : okMsg();
    }},

    { name: '82 a11y: setFontScale persists + updates html font-size', fn: function() {
        var origScale = localStorage.getItem('lv_font_scale');
        var origFontSize = document.documentElement.style.fontSize;
        try {
          setFontScale('large');
          var stored = localStorage.getItem('lv_font_scale');
          var applied = document.documentElement.style.fontSize;
          if (stored !== 'large') return fail('lv_font_scale=' + stored);
          if (!/115%/.test(applied)) return fail('html fontSize=' + applied + ' expected 115%');
          return okMsg();
        } finally {
          // Restore whatever was there before
          if (origScale === null) localStorage.removeItem('lv_font_scale');
          else localStorage.setItem('lv_font_scale', origScale);
          if (origFontSize) document.documentElement.style.fontSize = origFontSize;
          else document.documentElement.style.fontSize = '';
          applyFontScale();
        }
    }},

    { name: '83 a11y: invalid font-scale key falls back to default', fn: function() {
        var orig = localStorage.getItem('lv_font_scale');
        try {
          localStorage.setItem('lv_font_scale', 'bogus-value');
          applyFontScale();
          var applied = document.documentElement.style.fontSize;
          // default is 'normal' = 100%
          return /100%/.test(applied) ? okMsg() : fail('fallback didn\'t reset; fontSize=' + applied);
        } finally {
          if (orig === null) localStorage.removeItem('lv_font_scale');
          else localStorage.setItem('lv_font_scale', orig);
          applyFontScale();
        }
    }},

    { name: '84 a11y: high-contrast theme sets documentElement.dataset.theme', fn: function() {
        var origTheme = localStorage.getItem('lv_theme');
        var origDataset = document.documentElement.dataset.theme;
        try {
          localStorage.setItem('lv_theme', 'high-contrast');
          if (typeof applyTheme === 'function') applyTheme();
          var set = document.documentElement.dataset.theme;
          return set === 'high-contrast' ? okMsg() : fail('dataset.theme=' + set);
        } finally {
          if (origTheme === null) localStorage.removeItem('lv_theme');
          else localStorage.setItem('lv_theme', origTheme);
          if (typeof applyTheme === 'function') applyTheme();
          if (origDataset) document.documentElement.dataset.theme = origDataset;
        }
    }},

    //  ── Save path (scaffold — non-destructive) ──
    // These tests verify the presence and shape of the wizard save path
    // without actually writing to Google Sheets. Full integration tests
    // that use a TEST_AUTO_ guarded row are deferred; the guard pattern
    // is documented in MIGRATION / save-path scaffold notes.
    { name: '90 save: saveItem function exists globally', fn: function() {
        return typeof saveItem === 'function' ? okMsg() : fail('saveItem not global');
    }},

    { name: '91 save: state.personalData is the expected shape', fn: function() {
        if (!state || typeof state.personalData !== 'object') return fail('state.personalData missing');
        // Pick one entry (if any) and verify it has the expected shape
        var sample = Object.values(state.personalData || {})[0];
        if (!sample) return okMsg('(no personalData entries to sample — pass by default)');
        var required = ['itemNum'];
        var miss = required.filter(function(k) { return sample[k] === undefined; });
        return miss.length ? fail('sample missing: ' + miss.join(', ')) : okMsg();
    }},

    { name: '92 save: CONSTRUCTION_HEADERS + MY_SETS_HEADERS are defined', fn: function() {
        var ok1 = Array.isArray(typeof CONSTRUCTION_HEADERS !== 'undefined' ? CONSTRUCTION_HEADERS : null);
        var ok2 = Array.isArray(typeof MY_SETS_HEADERS !== 'undefined' ? MY_SETS_HEADERS : null);
        return (ok1 && ok2) ? okMsg() : fail('headers: CONSTRUCTION_HEADERS=' + ok1 + ' MY_SETS_HEADERS=' + ok2);
    }},

    //  ── Migration scaffold (Phase: MPC → Atlas) ──
    { name: '93 migration: MIGRATION config exposed with routes', fn: function() {
        var m = window.MIGRATION || {};
        if (typeof m.enabled !== 'boolean') return fail('MIGRATION.enabled missing');
        if (!m.routes || typeof m.routes !== 'object') return fail('MIGRATION.routes missing');
        return okMsg('enabled=' + m.enabled);
    }},

    { name: '94 migration: three-step functions exist + route validation works', fn: async function() {
        var miss = ['migrationFindItem','migrationAppendToDest','migrationClearSource','openMigrationModal']
          .filter(function(f) { return typeof window[f] !== 'function'; });
        if (miss.length) return fail('missing: ' + miss.join(', '));
        // Route validation: trying a disallowed route should throw
        try {
          await migrationFindItem('9999', 'Lionel PW - Items', 'Atlas O');
          return fail('expected route-denied throw');
        } catch (e) {
          if (!/route not allowed|Route not allowed/i.test(e.message || String(e)))
            return fail('wrong error: ' + (e.message || e));
        }
        return okMsg();
    }},

    //  ── Tutorial GIFs scaffold (Phase D) ──
    { name: '95 gifs: TUTORIAL_GIFS config exposed', fn: function() {
        var g = window.TUTORIAL_GIFS || {};
        return (Array.isArray(g.demos) && g.demos.length) ? okMsg(g.demos.length + ' demos configured') : fail('TUTORIAL_GIFS.demos missing/empty');
    }},

    //  ── Era badges (Session 112) ──
    { name: '96 badges: ERA_BADGES config + helpers exposed', fn: function() {
        if (!window.ERA_BADGES) return fail('ERA_BADGES missing');
        if (typeof eraForTab !== 'function') return fail('eraForTab missing');
        if (typeof eraBadgeHTML !== 'function') return fail('eraBadgeHTML missing');
        return okMsg();
    }},

    { name: '97 badges: eraForTab resolves known tabs', fn: function() {
        var cases = [
          ['Lionel PW - Items', 'pw'],
          ['MPC-Modern', 'mpc'],
          ['Atlas O', 'atlas'],
          ['Pre-War', 'prewar'],
        ];
        var fails = [];
        cases.forEach(function(c) {
          var got = eraForTab(c[0]);
          if (got !== c[1]) fails.push(c[0] + '→' + got + ' expected ' + c[1]);
        });
        return fails.length ? fail(fails.join(', ')) : okMsg();
    }},

    { name: '98 badges: eraBadgeHTML returns markup for known tab, empty for unknown', fn: function() {
        var html = eraBadgeHTML('Lionel PW - Items');
        if (!/era-badge/.test(html)) return fail('known tab produced empty/wrong HTML: ' + html);
        var unknown = eraBadgeHTML('NotARealTab');
        if (unknown !== '') return fail('unknown tab should return empty string, got: ' + unknown);
        return okMsg();
    }},

    //  ── Feature Map → GIFs link (Session 112) ──
    { name: '99 gifsLink: onboardShowGifsPreview global exists', fn: function() {
        return typeof onboardShowGifsPreview === 'function' ? okMsg() : fail('missing');
    }},

    //  ── Back-button / BackStack (Session 113) ──
    { name: '100 backstack: BackStack API exposed', fn: function() {
        if (!window.BackStack) return fail('BackStack global missing');
        var missing = ['push','pop','has','size','clear'].filter(function(m) {
          return typeof window.BackStack[m] !== 'function';
        });
        return missing.length ? fail('missing methods: ' + missing.join(', ')) : okMsg();
    }},

    { name: '101 backstack: push/pop size accounting', fn: async function() {
        var BS = window.BackStack;
        BS.clear();
        var size0 = BS.size();
        BS.push('test-a', function(){});
        BS.push('test-b', function(){});
        if (BS.size() !== size0 + 2) return fail('expected size ' + (size0+2) + ' got ' + BS.size());
        if (!BS.has('test-a') || !BS.has('test-b')) return fail('has() missed pushed ids');
        BS.pop('test-b');
        // history.back is async — wait a frame before checking
        await wait(50);
        if (BS.size() !== size0 + 1) return fail('after pop expected ' + (size0+1) + ' got ' + BS.size());
        BS.pop('test-a');
        await wait(50);
        if (BS.size() !== size0) return fail('after final pop expected ' + size0 + ' got ' + BS.size());
        return okMsg();
    }},

    { name: '102 backstack: popstate runs closeFn and removes entry', fn: async function() {
        var BS = window.BackStack;
        BS.clear();
        var closed = false;
        BS.push('test-popstate', function() { closed = true; });
        if (!BS.has('test-popstate')) return fail('push did not register');
        // Simulate the device back press
        history.back();
        await wait(100);
        if (!closed) return fail('closeFn never fired on popstate');
        if (BS.has('test-popstate')) return fail('entry not removed after popstate');
        return okMsg();
    }},

    { name: '103 backstack: gmail help back-press closes the modal', fn: async function() {
        if (typeof gmailShowHelp !== 'function') return fail('gmailShowHelp missing');
        var BS = window.BackStack;
        BS.clear();
        gmailShowHelp();
        await wait(50);
        if (!$('gmail-help-overlay')) return fail('modal did not open');
        if (!BS.has('gmail-help')) return fail('BackStack entry missing after open');
        history.back();
        await wait(100);
        if ($('gmail-help-overlay')) return fail('modal still present after back press');
        if (BS.has('gmail-help')) return fail('BackStack entry not removed after back');
        return okMsg();
    }},

    { name: '104 backstack: gmail help path-view back-press returns to chooser', fn: async function() {
        if (typeof gmailShowHelp !== 'function' || typeof gmailShowPath !== 'function') return fail('gmail funcs missing');
        var BS = window.BackStack;
        BS.clear();
        gmailShowHelp();
        await wait(30);
        gmailShowPath('forgot');
        await wait(30);
        if (!BS.has('gmail-help:path')) return fail('nested path entry not pushed');
        // Device back should drop the path entry and show the chooser again,
        // not close the whole modal.
        history.back();
        await wait(100);
        if (!$('gmail-help-overlay')) return fail('modal closed instead of returning to chooser');
        if (BS.has('gmail-help:path')) return fail('path entry not removed after back');
        if (!BS.has('gmail-help')) return fail('base gmail-help entry should still be present');
        // One more back should now close the whole modal.
        history.back();
        await wait(100);
        if ($('gmail-help-overlay')) return fail('modal not closed on second back press');
        return okMsg();
    }},

    { name: '106 wizard: openWizard registers BackStack entry', fn: async function() {
        if (typeof openWizard !== 'function') return fail('openWizard missing');
        if (typeof _doCloseWizard !== 'function') return fail('_doCloseWizard missing');
        var BS = window.BackStack;
        BS.clear();
        try {
          openWizard('collection');
          await wait(60);
          if (!BS.has('wizard')) { _doCloseWizard(); return fail('BackStack entry not pushed by openWizard'); }
          _doCloseWizard();
          await wait(60);
          if (BS.has('wizard')) return fail('BackStack entry not removed by _doCloseWizard');
        } catch (e) { _doCloseWizard(); throw e; }
        return okMsg();
    }},

    { name: '107 wizard: device back on step 1 closes the wizard (no lingering overlay)', fn: async function() {
        if (typeof openWizard !== 'function' || typeof _wizardBackHandler !== 'function') return fail('wizard funcs missing');
        var BS = window.BackStack;
        BS.clear();
        // Stub confirm so the cancel guard never blocks the test — we're
        // simulating the empty-state case, but also defensive if state leaks.
        var realConfirm = window.confirm;
        window.confirm = function() { return true; };
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined' || wizard.step !== 0) {
            _doCloseWizard();
            return fail('wizard did not initialize at step 0 (got ' + (typeof wizard === 'undefined' ? 'undefined' : wizard.step) + ')');
          }
          // Simulate device back
          history.back();
          await wait(150);
          var mod = document.getElementById('wizard-modal');
          var stillOpen = mod && mod.classList.contains('open');
          if (stillOpen) { _doCloseWizard(); return fail('wizard still open after device back on step 1'); }
          if (BS.has('wizard')) return fail('BackStack entry still present after close');
        } finally {
          window.confirm = realConfirm;
        }
        return okMsg();
    }},

    { name: '108 wizard: device back on step 2 steps back to step 1 (does not close)', fn: async function() {
        if (typeof openWizard !== 'function' || typeof _wizardBackHandler !== 'function') return fail('wizard funcs missing');
        var BS = window.BackStack;
        BS.clear();
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined') { _doCloseWizard(); return fail('wizard not initialized'); }
          // Manually advance to step 2-ish; skip to first non-skipped step after 0
          wizard.step = 1;
          if (typeof renderWizardStep === 'function') renderWizardStep();
          var prevStep = wizard.step;
          history.back();
          await wait(150);
          var mod = document.getElementById('wizard-modal');
          if (!mod || !mod.classList.contains('open')) {
            // wizard closed — unexpected
            _doCloseWizard();
            return fail('wizard closed on back from step ' + prevStep + ' (should have stepped back)');
          }
          if (wizard.step >= prevStep) {
            _doCloseWizard();
            return fail('wizard.step did not decrease (was ' + prevStep + ', now ' + wizard.step + ')');
          }
          if (!BS.has('wizard')) {
            _doCloseWizard();
            return fail('BackStack entry not re-pushed after step-back');
          }
          _doCloseWizard();
          await wait(40);
        } catch (e) { _doCloseWizard(); throw e; }
        return okMsg();
    }},

    { name: '120 wizard: back from step 1 with itemCategory set reopens category chooser', fn: async function() {
        // Session 115 UX change: when the user is on step 1 (itemNumGrouping)
        // and hits back, we no longer close the wizard. Instead we un-skip
        // the itemCategory step by clearing wizard.data.itemCategory, so
        // the "What would you like to add?" screen reappears. This lets
        // the user change their category pick without cancelling the
        // whole add flow. The previous behavior (v0.9.153) was to close;
        // the bug before THAT was to silently re-render the same step.
        if (typeof openWizard !== 'function' || typeof _wizardBackHandler !== 'function') return fail('wizard funcs missing');
        if (typeof wizardBack !== 'function') return fail('wizardBack missing');
        var BS = window.BackStack;
        BS.clear();
        var realConfirm = window.confirm;
        window.confirm = function() { return true; };
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined') { _doCloseWizard(); return fail('wizard not initialized'); }
          // Simulate user picking an item category — mark step 0 skippable
          wizard.data.itemCategory = 'lionel';
          // Advance to the first visible step after 0 (itemNumGrouping)
          wizard.step = 1;
          if (typeof renderWizardStep === 'function') renderWizardStep();
          await wait(40);
          // wizardBack() should now return TRUE, unskip itemCategory, and
          // land wizard.step on the itemCategory step index (normally 0).
          var moved = wizardBack();
          if (moved !== true) {
            _doCloseWizard();
            return fail('wizardBack() should return true and reopen category chooser; got ' + moved);
          }
          if (wizard.data.itemCategory !== '') {
            _doCloseWizard();
            return fail('itemCategory should be cleared to unskip the step; got ' + JSON.stringify(wizard.data.itemCategory));
          }
          var _catStepIdx = wizard.steps.findIndex(function(s) { return s.type === 'itemCategory'; });
          if (wizard.step !== _catStepIdx) {
            _doCloseWizard();
            return fail('wizard.step should be itemCategory (' + _catStepIdx + '); got ' + wizard.step);
          }
          // A second Back from the itemCategory step (no earlier step, no
          // category set) should fall through to close — _wizardBackHandler
          // sees wizardBack() return false and calls _doCloseWizard().
          var moved2 = wizardBack();
          if (moved2 !== false) {
            _doCloseWizard();
            return fail('second wizardBack() from itemCategory should return false; got ' + moved2);
          }
        } finally {
          window.confirm = realConfirm;
          var mod2 = document.getElementById('wizard-modal');
          if (mod2 && mod2.classList.contains('open')) _doCloseWizard();
        }
        return okMsg();
    }},

    { name: '121 wizard: era filter leak guard — Postwar search excludes Modern rows', fn: async function() {
        // Session 115 fix: updateItemSuggestions and getMasterDistinct now
        // filter state.masterData by wizard.data._era via ERA_TABS. Stub
        // state.masterData with a mix of tabs and verify the era filter
        // only surfaces the matching era's rows.
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (typeof window.ERA_TABS === 'undefined') return fail('ERA_TABS missing');
        var BS = window.BackStack;
        BS.clear();
        var realConfirm = window.confirm;
        window.confirm = function() { return true; };
        var realMaster = state.masterData;
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined') { _doCloseWizard(); return fail('wizard not initialized'); }
          // Craft a mixed-era master array: one row per era, same itemNum
          state.masterData = [
            { itemNum: '55', itemType: 'Motorized Unit', roadName: '', description: 'Postwar test row',  _tab: (ERA_TABS.pw  && ERA_TABS.pw.items)  || 'Lionel PW - Items' },
            { itemNum: '55', itemType: 'Modern Loco',    roadName: '', description: 'MPC/Modern test row', _tab: (ERA_TABS.mpc && ERA_TABS.mpc.items) || 'MPC-Modern' },
          ];
          wizard.data._era = 'pw';
          wizard.data.itemNum = '55';
          // Render a hidden suggestions host if one isn't on the page
          var host = document.getElementById('wiz-suggestions');
          if (!host) {
            host = document.createElement('div');
            host.id = 'wiz-suggestions';
            host.style.display = 'none';
            document.body.appendChild(host);
          }
          updateItemSuggestions('55');
          var html = host.innerHTML || '';
          if (html.indexOf('Postwar test row') < 0) {
            _doCloseWizard();
            return fail('Postwar row should appear in suggestions when era=pw');
          }
          if (html.indexOf('MPC/Modern test row') >= 0) {
            _doCloseWizard();
            return fail('MPC/Modern row leaked into Postwar search');
          }
        } finally {
          state.masterData = realMaster;
          window.confirm = realConfirm;
          var mod2 = document.getElementById('wizard-modal');
          if (mod2 && mod2.classList.contains('open')) _doCloseWizard();
        }
        return okMsg();
    }},

    { name: '125 wizard: findGroupingCandidates — engine↔tender + A↔B partner (v0.9.165)', fn: async function() {
        // Session 115 Stages 2+3: partner-map based grouping detection.
        // Stubs state.partnerMap so the getMatchingTenders/Locos/SetPartner
        // helpers resolve without depending on real master data.
        if (typeof findGroupingCandidates !== 'function') return fail('findGroupingCandidates missing');
        var realPD = state.personalData;
        var realPM = state.partnerMap;
        try {
          state.partnerMap = {
            '2037':  { tenders: ['6026W'],       locos: [],        isDiesel: false, configs: [] },
            '6026W': { tenders: [],              locos: ['2037'],  isDiesel: false, configs: [] },
            '2343':  { tenders: [], locos: [], bUnit: '2343C', isDiesel: true, configs: ['AB'] },
            '2343C': { tenders: [], locos: [], aUnit: '2343',  isDiesel: true, configs: [] },
          };
          state.personalData = {
            'a': { itemNum: '6026W', owned: true, groupId: '', condition: 8 },
            'b': { itemNum: '2037',  owned: true, groupId: '', condition: 7 },
            'c': { itemNum: '2343',  owned: true, groupId: '', condition: 6 },
            'd': { itemNum: '2343C', owned: true, groupId: '', condition: 6 },
          };

          // Adding 2037 (engine): owned tender 6026W should be a candidate
          var a = findGroupingCandidates({ itemNum: '2037', boxOnly: false });
          if (a.length !== 1 || a[0].type !== 'tender' || a[0].itemNum !== '6026W') {
            return fail('engine→tender: expected tender 6026W; got ' + JSON.stringify(a));
          }
          if (a[0].flagKey !== '_groupWithExistingTender') {
            return fail('engine→tender: flagKey wrong: ' + a[0].flagKey);
          }

          // Adding 6026W (tender): owned engine 2037 should be a candidate
          var b = findGroupingCandidates({ itemNum: '6026W', boxOnly: false });
          if (b.length !== 1 || b[0].type !== 'engine' || b[0].itemNum !== '2037') {
            return fail('tender→engine: expected engine 2037; got ' + JSON.stringify(b));
          }
          if (b[0].flagKey !== '_groupWithExistingEngine') {
            return fail('tender→engine: flagKey wrong: ' + b[0].flagKey);
          }

          // Adding 2343 (A-unit): owned 2343C (B-unit) should be partner candidate
          var c = findGroupingCandidates({ itemNum: '2343', boxOnly: false });
          if (c.length !== 1 || c[0].type !== 'partner' || c[0].itemNum !== '2343C') {
            return fail('A→B: expected partner 2343C; got ' + JSON.stringify(c));
          }
          if (c[0].flagKey !== '_groupWithExistingPartner') {
            return fail('A→B: flagKey wrong: ' + c[0].flagKey);
          }
          if (c[0].label.indexOf('B-unit') < 0) {
            return fail('A→B: label should mention B-unit; got ' + c[0].label);
          }

          // Adding 2343C (B-unit): owned 2343 (A-unit) should be partner candidate
          var d2 = findGroupingCandidates({ itemNum: '2343C', boxOnly: false });
          if (d2.length !== 1 || d2[0].type !== 'partner' || d2[0].itemNum !== '2343') {
            return fail('B→A: expected partner 2343; got ' + JSON.stringify(d2));
          }
          if (d2[0].label.indexOf('Paired unit') < 0) {
            return fail('B→A: label should say Paired unit; got ' + d2[0].label);
          }
        } finally {
          state.personalData = realPD;
          state.partnerMap = realPM;
        }
        return okMsg();
    }},

    { name: '124 wizard: findGroupingCandidates — item↔box bidirectional (v0.9.164)', fn: async function() {
        // Session 115 Stage 1: grouping detector for item↔box. Verifies:
        //   (a) adding a regular item returns the matching -BOX row
        //   (b) adding a box (boxOnly=true) returns the matching item
        //   (c) candidates already in a group are excluded
        //   (d) non-owned rows are excluded
        if (typeof findGroupingCandidates !== 'function') return fail('findGroupingCandidates missing');
        var realPersonal = state.personalData;
        try {
          // Seed a fake collection
          state.personalData = {
            'k1': { itemNum: '55',     owned: true, groupId: '', condition: 7 },
            'k2': { itemNum: '55-BOX', owned: true, groupId: '', boxCond: 8 },
            'k3': { itemNum: '60',     owned: true, groupId: '' },
            'k4': { itemNum: '60-BOX', owned: true, groupId: 'GRP-60-EXISTING' }, // already grouped
            'k5': { itemNum: '70-BOX', owned: false, groupId: '' }, // not owned
          };

          // (a) Adding item 55 — should find the matching -BOX
          var cands1 = findGroupingCandidates({ itemNum: '55', boxOnly: false });
          if (cands1.length !== 1) return fail('(a) expected 1 candidate for item 55; got ' + cands1.length);
          if (cands1[0].type !== 'box' || cands1[0].itemNum !== '55-BOX') {
            return fail('(a) wrong candidate: ' + JSON.stringify(cands1[0]));
          }
          if (cands1[0].flagKey !== '_groupWithExistingBox') {
            return fail('(a) flagKey should be _groupWithExistingBox; got ' + cands1[0].flagKey);
          }

          // (b) Adding a box for 55 — should find the matching plain item
          var cands2 = findGroupingCandidates({ itemNum: '55', boxOnly: true });
          if (cands2.length !== 1) return fail('(b) expected 1 candidate for box 55; got ' + cands2.length);
          if (cands2[0].type !== 'item' || cands2[0].itemNum !== '55') {
            return fail('(b) wrong candidate: ' + JSON.stringify(cands2[0]));
          }
          if (cands2[0].flagKey !== 'boxGroupSuggest') {
            return fail('(b) flagKey should be boxGroupSuggest; got ' + cands2[0].flagKey);
          }

          // (c) Adding item 60 — matching box is already grouped, should be excluded
          var cands3 = findGroupingCandidates({ itemNum: '60', boxOnly: false });
          if (cands3.length !== 0) return fail('(c) candidates with existing groupId should be excluded; got ' + cands3.length);

          // (d) Adding item 70 — matching box exists but isn't owned, should be excluded
          var cands4 = findGroupingCandidates({ itemNum: '70', boxOnly: false });
          if (cands4.length !== 0) return fail('(d) non-owned candidates should be excluded; got ' + cands4.length);

          // (e) Empty item number — returns empty list without error
          var cands5 = findGroupingCandidates({ itemNum: '', boxOnly: false });
          if (cands5.length !== 0) return fail('(e) empty itemNum should return []; got ' + cands5.length);
        } finally {
          state.personalData = realPersonal;
        }
        return okMsg();
    }},

    { name: '123 wizard: Back past entryMode step does not bounce forward (v0.9.162)', fn: async function() {
        // Regression: entryMode step's render code auto-advances because
        // the Quick Entry UI was removed in a prior session. Without
        // skipIf:true on the step, wizardBack lands on entryMode and the
        // render immediately forwards back to the originating step, so
        // the Back button appears broken on any step after entryMode.
        // This test walks the collection step list and asserts entryMode
        // is marked as always-skipped.
        if (typeof getSteps !== 'function') return fail('getSteps missing');
        // Ensure we're testing the regular Lionel flow (no manual, no
        // box-only, no ephemera redirect).
        var savedCat = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data.itemCategory : undefined;
        var savedBox = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data.boxOnly : undefined;
        try {
          if (typeof wizard !== 'undefined' && wizard && wizard.data) {
            wizard.data.itemCategory = 'lionel';
            wizard.data.boxOnly = false;
          }
          var steps = getSteps('collection');
          var em = steps.find(function(s) { return s.id === 'entryMode'; });
          if (!em) return fail('entryMode step missing from collection flow');
          if (typeof em.skipIf !== 'function') return fail('entryMode.skipIf should be a function');
          // skipIf must return true for a plain flow (no _completingQuickEntry, no _setMode).
          var skipped = em.skipIf({});
          if (skipped !== true) return fail('entryMode.skipIf should always return true while QE UI is removed; got ' + skipped);
        } finally {
          if (typeof wizard !== 'undefined' && wizard && wizard.data) {
            wizard.data.itemCategory = savedCat;
            wizard.data.boxOnly = savedBox;
          }
        }
        return okMsg();
    }},

    { name: '122 wizard: dedup key collapses variations to one row per (itemNum, roadName)', fn: async function() {
        // Session 115 fix: dedupKeyFields is now ['itemNum', 'roadName'] —
        // variations with different subType/varDesc are collapsed into a
        // single suggestion row, deferring variation selection to a later
        // step in the wizard. This test seeds master with three variations
        // of a fake item and confirms only one row appears.
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.ITEM_SEARCH_FILTERS || !Array.isArray(ITEM_SEARCH_FILTERS.dedupKeyFields)) return fail('dedupKeyFields missing');
        var k = ITEM_SEARCH_FILTERS.dedupKeyFields;
        if (k.length !== 2 || k[0] !== 'itemNum' || k[1] !== 'roadName') {
          return fail('dedupKeyFields should be [itemNum, roadName]; got ' + JSON.stringify(k));
        }
        var BS = window.BackStack;
        BS.clear();
        var realConfirm = window.confirm;
        window.confirm = function() { return true; };
        var realMaster = state.masterData;
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined') { _doCloseWizard(); return fail('wizard not initialized'); }
          var pwTab = (ERA_TABS.pw && ERA_TABS.pw.items) || 'Lionel PW - Items';
          state.masterData = [
            { itemNum: '999', itemType: 'Test', roadName: 'TestRoad', subType: 'A', varDesc: 'var A', description: 'desc A', _tab: pwTab },
            { itemNum: '999', itemType: 'Test', roadName: 'TestRoad', subType: 'B', varDesc: 'var B', description: 'desc B', _tab: pwTab },
            { itemNum: '999', itemType: 'Test', roadName: 'TestRoad', subType: 'C', varDesc: 'var C', description: 'desc C', _tab: pwTab },
          ];
          wizard.data._era = 'pw';
          wizard.data.itemNum = '999';
          var host = document.getElementById('wiz-suggestions');
          if (!host) {
            host = document.createElement('div');
            host.id = 'wiz-suggestions';
            host.style.display = 'none';
            document.body.appendChild(host);
          }
          updateItemSuggestions('999');
          var rows = host.querySelectorAll('[data-idx]');
          if (rows.length !== 1) {
            _doCloseWizard();
            return fail('expected 1 collapsed suggestion row for item 999; got ' + rows.length);
          }
        } finally {
          state.masterData = realMaster;
          window.confirm = realConfirm;
          var mod2 = document.getElementById('wizard-modal');
          if (mod2 && mod2.classList.contains('open')) _doCloseWizard();
        }
        return okMsg();
    }},

    { name: '105 backstack: empty stack falls through (does not throw)', fn: async function() {
        var BS = window.BackStack;
        BS.clear();
        // Fire a popstate event manually with no entries on the stack.
        // BackStack should no-op and NOT throw.
        try {
          window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        } catch (e) {
          return fail('popstate with empty stack threw: ' + (e.message || e));
        }
        await wait(30);
        return okMsg();
    }},

    //  ── Item-search filters + COTT link (Session 113b) ──
    { name: '109 filters: ITEM_SEARCH_FILTERS config exposed', fn: function() {
        var c = window.ITEM_SEARCH_FILTERS;
        if (!c) return fail('ITEM_SEARCH_FILTERS missing');
        if (!c.ui || !c.sizing) return fail('config shape wrong (need ui + sizing)');
        if (!c.applyToTabs || c.applyToTabs.indexOf('collection') === -1)
          return fail('applyToTabs should include "collection"');
        return okMsg();
    }},

    { name: '110 filters: getMasterDistinct returns sorted non-blank values', fn: function() {
        if (typeof getMasterDistinct !== 'function') return fail('getMasterDistinct missing');
        var roads = getMasterDistinct('roadName');
        if (!Array.isArray(roads)) return fail('expected array');
        // Verify sorted + non-blank
        for (var i = 0; i < roads.length; i++) {
          if (!roads[i] || !roads[i].trim().length) return fail('blank value at idx ' + i);
          if (i > 0 && roads[i-1].localeCompare(roads[i]) > 0) return fail('not sorted at idx ' + i);
        }
        return okMsg(roads.length + ' roads');
    }},

    { name: '111 filters: updateItemSuggestions respects Type/Road filters', fn: async function() {
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.wizard) window.wizard = { tab: 'collection', data: {} };
        else { wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        // Need the suggestions container to exist
        var box = document.getElementById('wiz-suggestions');
        var created = false;
        if (!box) {
          box = document.createElement('div');
          box.id = 'wiz-suggestions';
          box.style.display = 'none';
          document.body.appendChild(box);
          created = true;
        }
        try {
          // Baseline: unfiltered search for a common letter returns some rows
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          updateItemSuggestions('a');
          var unfilteredCount = box.querySelectorAll('[data-idx]').length;
          // Pick an actual road that exists in the data
          var roads = getMasterDistinct('roadName');
          if (!roads.length) return okMsg('no road names in data — skipped filter check');
          wizard.data._searchFilterRoad = roads[0];
          updateItemSuggestions('a');
          var filteredCount = box.querySelectorAll('[data-idx]').length;
          if (filteredCount > unfilteredCount) return fail('filter INCREASED results (was ' + unfilteredCount + ', now ' + filteredCount + ')');
          // Check every surviving row's dataset.roadName matches the filter
          var rows = box.querySelectorAll('[data-idx]');
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].dataset.roadName !== roads[0])
              return fail('row ' + i + ' has road "' + rows[i].dataset.roadName + '" expected "' + roads[0] + '"');
          }
        } finally {
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          if (created && box.parentNode) box.parentNode.removeChild(box);
        }
        return okMsg();
    }},

    { name: '112 filters: reference link label resolves per URL (atlas.com → Atlas, cott → COTT, other → default)', fn: async function() {
        var c = window.ITEM_SEARCH_FILTERS || {};
        var ll = (c.ui || {}).linkLabel || {};
        if (!ll.patterns || !ll.patterns.length) return fail('linkLabel.patterns missing');
        var atlasHit = ll.patterns.some(function(p) { return p.match && p.match.test && p.match.test('https://www.atlasrr.com/items/123'); });
        var cottHit  = ll.patterns.some(function(p) { return p.match && p.match.test && p.match.test('https://cott.somewhere/ref/6464'); });
        if (!atlasHit) return fail('no pattern matched atlasrr.com URL');
        if (!cottHit)  return fail('no pattern matched cott URL');
        if (!(ll.defaultShort || ll.default)) return fail('linkLabel.defaultShort/default missing');
        if (!(ll.defaultVerbose || ll.default)) return fail('linkLabel.defaultVerbose/default missing');
        return okMsg();
    }},

    { name: '113 filters: resolveRefLabel() returns short + verbose for each source', fn: async function() {
        if (typeof window.resolveRefLabel !== 'function') return fail('window.resolveRefLabel missing');
        var cases = [
          { url: 'https://www.atlasrr.com/x', expectShort: /atlas/i, expectVerbose: /view on .*atlas/i },
          { url: 'http://cott.example/x',     expectShort: /cott/i,  expectVerbose: /view on .*cott/i  },
          { url: 'https://greenberg-books.example/x', expectShort: /view/i, expectVerbose: /view/i },
          { url: '',                           expectShort: /^$/,     expectVerbose: /^$/ },
        ];
        for (var i = 0; i < cases.length; i++) {
          var cse = cases[i];
          var s = window.resolveRefLabel(cse.url);
          var v = window.resolveRefLabel(cse.url, { verbose: true });
          if (!cse.expectShort.test(s)) return fail('short for ' + JSON.stringify(cse.url) + ' = "' + s + '"');
          if (!cse.expectVerbose.test(v)) return fail('verbose for ' + JSON.stringify(cse.url) + ' = "' + v + '"');
        }
        return okMsg();
    }},

    { name: '114 filters: dedupKeyFields + rowDetailsFields configured', fn: function() {
        var c = window.ITEM_SEARCH_FILTERS || {};
        if (!Array.isArray(c.dedupKeyFields) || c.dedupKeyFields.indexOf('itemNum') === -1)
          return fail('dedupKeyFields must include itemNum');
        if (!Array.isArray(c.rowDetailsFields) || !c.rowDetailsFields.length)
          return fail('rowDetailsFields missing or empty');
        return okMsg();
    }},

    { name: '115 filters: suggestion rows render line-1 + line-2 when details present', fn: async function() {
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.state || !Array.isArray(state.masterData)) return okMsg('no master data — skipped');
        if (!window.wizard) window.wizard = { tab: 'collection', data: {} };
        else { wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        var box = document.getElementById('wiz-suggestions');
        var created = false;
        if (!box) {
          box = document.createElement('div');
          box.id = 'wiz-suggestions';
          box.style.display = 'none';
          document.body.appendChild(box);
          created = true;
        }
        try {
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          // Find a query that returns at least one candidate with details
          var queries = ['a', 'e', 'i', '1', '2'];
          var foundDetailsRow = false;
          var foundAnyRow = false;
          for (var qi = 0; qi < queries.length && !foundDetailsRow; qi++) {
            updateItemSuggestions(queries[qi]);
            var rows = box.querySelectorAll('[data-idx]');
            if (!rows.length) continue;
            foundAnyRow = true;
            for (var ri = 0; ri < rows.length; ri++) {
              // Each row should have a line-1 (first child div with flex-row)
              var children = rows[ri].children;
              if (children.length < 1) return fail('row has no children');
              // If there's a second child, it's the details line
              if (children.length >= 2 && children[1].textContent && children[1].textContent.trim().length > 0) {
                foundDetailsRow = true;
                break;
              }
            }
          }
          if (!foundAnyRow) return okMsg('no rows matched common letters — skipped');
          // Not a failure if none of the shown items happened to have details,
          // but we should at least verify the row STRUCTURE is column-flex.
          var anyRow = box.querySelector('[data-idx]');
          if (anyRow) {
            var style = anyRow.style.cssText || '';
            if (style.indexOf('flex-direction:column') === -1 && style.indexOf('column') === -1)
              return fail('row not using column flex layout');
          }
          return foundDetailsRow ? okMsg() : okMsg('structure OK; no shown rows had details content');
        } finally {
          if (created && box.parentNode) box.parentNode.removeChild(box);
        }
    }},

    { name: '116 search: Enter without highlighted row does NOT advance the wizard', fn: async function() {
        if (typeof handleSuggestionKey !== 'function') return fail('handleSuggestionKey missing');
        if (!window.wizard) window.wizard = { step: 0, tab: 'collection', data: {} };
        else { wizard.step = 0; wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        var initialStep = wizard.step;
        // Simulate an Enter keypress with no suggestion highlighted
        var prevented = false;
        var fakeEvent = {
          key: 'Enter',
          preventDefault: function() { prevented = true; },
        };
        // Also stub wizardNext so we'd notice if the old behavior sneaks back
        var realWizardNext = window.wizardNext;
        var advanceTried = false;
        window.wizardNext = function() { advanceTried = true; };
        try {
          handleSuggestionKey(fakeEvent);
        } finally {
          window.wizardNext = realWizardNext;
        }
        if (!prevented) return fail('Enter was not preventDefault()ed');
        if (advanceTried) return fail('Enter still called wizardNext');
        if (wizard.step !== initialStep) return fail('wizard.step changed (was ' + initialStep + ', now ' + wizard.step + ')');
        return okMsg();
    }},

    { name: '117 wizard: device back on step 1 closes silently (no confirm) even with search text', fn: async function() {
        if (typeof openWizard !== 'function' || typeof _wizardBackHandler !== 'function') return fail('wizard funcs missing');
        var BS = window.BackStack;
        BS.clear();
        // Sentinel: any confirm() call means the bug is back.
        var realConfirm = window.confirm;
        var confirmCalls = 0;
        window.confirm = function() { confirmCalls++; return true; };
        try {
          openWizard('collection');
          await wait(60);
          if (typeof wizard === 'undefined') { _doCloseWizard(); return fail('wizard not initialized'); }
          wizard.step = 0;
          // Simulate typing a search query (what the oninput handler does).
          wizard.data.itemNum = 'nashville';
          history.back();
          await wait(150);
          var mod = document.getElementById('wizard-modal');
          if (mod && mod.classList.contains('open')) {
            _doCloseWizard();
            return fail('wizard still open after device back on step 1');
          }
          if (confirmCalls > 0) return fail('discard confirm fired — bug still present');
        } finally {
          window.confirm = realConfirm;
        }
        return okMsg();
    }},

    { name: '118 filters: bare candidate dropped when populated sibling exists (no phantom rows)', fn: async function() {
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.state || !Array.isArray(state.masterData)) return okMsg('no master data — skipped');
        if (!window.wizard) window.wizard = { tab: 'collection', data: {} };
        else { wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        var box = document.getElementById('wiz-suggestions');
        var created = false;
        if (!box) {
          box = document.createElement('div');
          box.id = 'wiz-suggestions';
          box.style.display = 'none';
          document.body.appendChild(box);
          created = true;
        }
        // Inject two synthetic master rows for a fake itemNum: one bare, one populated.
        var marker = '__TRR_TEST_ITEM__';
        var bareRow = { itemNum: marker, roadName:'', subType:'', varDesc:'', description:'', itemType:'Locomotive', refLink:'', _tab:'Test' };
        var infoRow = { itemNum: marker, roadName:'', subType:'C-628', varDesc:'', description:'Louisville & Nashville 9999', itemType:'Locomotive', refLink:'', _tab:'Test' };
        state.masterData.unshift(bareRow, infoRow);
        try {
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          updateItemSuggestions(marker.toLowerCase());
          var rows = box.querySelectorAll('[data-idx]');
          if (rows.length === 0) return fail('no rows rendered for synthetic query');
          // The bare row (all disambiguator fields blank) must be dropped.
          if (rows.length > 1) return fail('expected 1 row, got ' + rows.length + ' — phantom bare row not filtered');
          // The surviving row should have line 2 (details present)
          var lines = rows[0].children;
          if (lines.length < 2) return fail('surviving row is missing line-2 details');
          if (!/C-628/.test(lines[1].textContent || '')) return fail('line-2 missing expected subType');
          return okMsg();
        } finally {
          // Remove synthetic rows
          state.masterData = state.masterData.filter(function(m) { return m.itemNum !== marker; });
          if (created && box.parentNode) box.parentNode.removeChild(box);
        }
    }},

    { name: '119 filters: line 2 renders with non-zero height when details populated', fn: async function() {
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.state || !Array.isArray(state.masterData)) return okMsg('no master data — skipped');
        if (!window.wizard) window.wizard = { tab: 'collection', data: {} };
        else { wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        // Put the dropdown into the real DOM so offsetHeight works.
        var box = document.getElementById('wiz-suggestions');
        var created = false;
        if (!box) {
          box = document.createElement('div');
          box.id = 'wiz-suggestions';
          box.style.cssText = 'display:flex;flex-direction:column;max-height:340px;overflow-y:auto';
          document.body.appendChild(box);
          created = true;
        }
        var marker = '__TRR_TEST_ROW_HEIGHT__';
        var infoRow = { itemNum: marker, roadName:'Test Road', subType:'Test Subtype', varDesc:'', description:'A description that should make line 2 render with non-zero height', itemType:'Locomotive', refLink:'', _tab:'Test' };
        state.masterData.unshift(infoRow);
        try {
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          updateItemSuggestions(marker.toLowerCase());
          var row = box.querySelector('[data-idx]');
          if (!row) return fail('no row rendered');
          if (row.children.length < 2) return fail('expected 2 child lines, got ' + row.children.length);
          var line2 = row.children[1];
          if (!line2.textContent) return fail('line 2 has no text content');
          // offsetHeight > 0 only works if element is in actual layout — but even on a detached root this is reliable enough
          if (line2.offsetHeight === 0) return fail('line 2 rendered at 0 height (rows are being compressed by parent flex)');
          return okMsg('line2 h=' + line2.offsetHeight + 'px');
        } finally {
          state.masterData = state.masterData.filter(function(m) { return m.itemNum !== marker; });
          if (created && box.parentNode) box.parentNode.removeChild(box);
        }
    }},

    { name: '120 filters: getMasterDistinct accepts a predicate for cross-filtering', fn: function() {
        if (typeof getMasterDistinct !== 'function') return fail('getMasterDistinct missing');
        // Inject a small synthetic dataset of known shape to exercise the predicate.
        if (!window.state || !Array.isArray(state.masterData)) return okMsg('no master data — skipped');
        var marker1 = '__TRR_CROSS_1__', marker2 = '__TRR_CROSS_2__';
        var rowA = { itemNum: marker1, itemType: 'Caboose', roadName: 'Nickel Plate', description: 'A' };
        var rowB = { itemNum: marker2, itemType: 'Locomotive', roadName: 'Nickel Plate', description: 'B' };
        var rowC = { itemNum: marker1 + 'c', itemType: 'Caboose', roadName: 'Santa Fe', description: 'C' };
        state.masterData.unshift(rowA, rowB, rowC);
        try {
          var cabooseRoads = getMasterDistinct('roadName', function(m) { return m.itemType === 'Caboose'; });
          if (cabooseRoads.indexOf('Nickel Plate') === -1) return fail('Caboose predicate missed Nickel Plate');
          if (cabooseRoads.indexOf('Santa Fe')     === -1) return fail('Caboose predicate missed Santa Fe');
          // Types for Santa Fe should be Caboose only (from our synthetic rows)
          var sfTypes = getMasterDistinct('itemType', function(m) { return m.roadName === 'Santa Fe' && (m.itemNum === marker1 + 'c'); });
          if (sfTypes.length !== 1 || sfTypes[0] !== 'Caboose')
            return fail('expected ["Caboose"] for Santa Fe synthetic, got ' + JSON.stringify(sfTypes));
          return okMsg();
        } finally {
          state.masterData = state.masterData.filter(function(m) {
            return m.itemNum !== marker1 && m.itemNum !== marker2 && m.itemNum !== marker1 + 'c';
          });
        }
    }},

    { name: '121 filters: empty query + Type set shows filter-matched suggestions (no typing required)', fn: async function() {
        if (typeof updateItemSuggestions !== 'function') return fail('updateItemSuggestions missing');
        if (!window.state || !Array.isArray(state.masterData)) return okMsg('no master data — skipped');
        if (!window.wizard) window.wizard = { tab: 'collection', data: {} };
        else { wizard.tab = 'collection'; wizard.data = wizard.data || {}; }
        var box = document.getElementById('wiz-suggestions');
        var created = false;
        if (!box) {
          box = document.createElement('div');
          box.id = 'wiz-suggestions';
          box.style.cssText = 'display:none;flex-direction:column;max-height:340px;overflow-y:auto';
          document.body.appendChild(box);
          created = true;
        }
        var marker = '__TRR_FILTER_ONLY__';
        var row = { itemNum: marker, itemType: 'TestOnlyType_Z', roadName: 'TestRoad_Z', subType: 'SomeSub', varDesc: '', description: 'Visible via filter only', refLink: '', _tab: 'Test' };
        state.masterData.unshift(row);
        try {
          // With no filters AND empty query → box should be hidden.
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          updateItemSuggestions('');
          if (box.style.display !== 'none') return fail('box should be hidden when no filter and empty query');
          // With Type filter set AND empty query → suggestions should show.
          wizard.data._searchFilterType = 'TestOnlyType_Z';
          updateItemSuggestions('');
          var rows = box.querySelectorAll('[data-idx]');
          if (rows.length < 1) return fail('expected ≥ 1 row with Type filter set, got ' + rows.length);
          var found = Array.from(rows).some(function(r) { return r.dataset.roadName === 'TestRoad_Z'; });
          if (!found) return fail('synthetic row not surfaced by filter-only search');
          // Clearing the filter with empty query → box hides again
          wizard.data._searchFilterType = '';
          updateItemSuggestions('');
          if (box.style.display !== 'none') return fail('box should re-hide when filter cleared');
          return okMsg();
        } finally {
          state.masterData = state.masterData.filter(function(m) { return m.itemNum !== marker; });
          wizard.data._searchFilterType = '';
          wizard.data._searchFilterRoad = '';
          if (created && box.parentNode) box.parentNode.removeChild(box);
        }
    }},

    //  ── Performance sentinel ──
    { name: '70 perf: buildPartnerMap under 50ms on current data', fn: function() {
        if (typeof buildPartnerMap !== 'function') return fail('buildPartnerMap missing');
        // Run 3x and take median so one outlier doesn't fail us
        var samples = [];
        for (var i = 0; i < 3; i++) {
          var t = performance.now();
          buildPartnerMap();
          samples.push(performance.now() - t);
        }
        samples.sort(function(a, b) { return a - b; });
        var median = samples[1];
        return median <= TEST_CONFIG.buildPartnerMapMaxMs
          ? okMsg(Math.round(median) + 'ms')
          : fail('median ' + Math.round(median) + 'ms > ' + TEST_CONFIG.buildPartnerMapMaxMs + 'ms');
    }},

    //  ── Road Typeahead ──
    { name: '116 typeahead: RoadTypeahead + config present', fn: function() {
        if (!window.RoadTypeahead) return fail('RoadTypeahead missing');
        if (typeof RoadTypeahead.attach !== 'function') return fail('attach() missing');
        if (typeof RoadTypeahead.refresh !== 'function') return fail('refresh() missing');
        if (!window.ROAD_TYPEAHEAD_CONFIG) return fail('ROAD_TYPEAHEAD_CONFIG missing');
        return okMsg('RoadTypeahead + config exposed');
    }},

    { name: '117 typeahead: attach() wraps select with input + list', fn: function() {
        if (!window.RoadTypeahead) return fail('RoadTypeahead missing');
        var host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(host);
        try {
          var sel = document.createElement('select');
          ['', 'Pennsylvania', 'New York Central', 'Santa Fe'].forEach(function(v) {
            var o = document.createElement('option');
            o.value = v === '' ? '' : v;
            o.textContent = v === '' ? '(any)' : v;
            sel.appendChild(o);
          });
          host.appendChild(sel);
          RoadTypeahead.attach(sel);
          var wrap = sel.parentNode;
          if (!wrap || !wrap.classList.contains('road-ty-wrap')) return fail('wrapper not created');
          var input = wrap.querySelector('.road-ty-input');
          var list = wrap.querySelector('.road-ty-list');
          if (!input) return fail('input not created');
          if (!list) return fail('list not created');
          if (sel.style.display !== 'none') return fail('original select still visible');
          return okMsg('select wrapped with input + list');
        } finally {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
    }},

    { name: '118 typeahead: typing filters options (starts-then-contains)', fn: async function() {
        if (!window.RoadTypeahead) return fail('RoadTypeahead missing');
        var host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(host);
        try {
          var sel = document.createElement('select');
          ['', 'Pennsylvania', 'Penn Central', 'New York Central', 'Santa Fe', 'Reading'].forEach(function(v) {
            var o = document.createElement('option');
            o.value = v === '' ? '' : v;
            o.textContent = v === '' ? '(any)' : v;
            sel.appendChild(o);
          });
          host.appendChild(sel);
          RoadTypeahead.attach(sel);
          var wrap = sel.parentNode;
          var input = wrap.querySelector('.road-ty-input');
          // Simulate typing "penn"
          input.focus();
          input.value = 'penn';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(function(r) { setTimeout(r, 10); });
          var opts = wrap.querySelectorAll('.road-ty-option');
          // Expect (any) + Pennsylvania + Penn Central (starts), no Santa Fe
          var labels = [];
          for (var i = 0; i < opts.length; i++) labels.push(opts[i].textContent);
          if (labels.indexOf('Santa Fe') >= 0) return fail('Santa Fe should be filtered out: ' + labels.join(', '));
          if (labels.indexOf('Pennsylvania') < 0) return fail('Pennsylvania missing');
          if (labels.indexOf('Penn Central') < 0) return fail('Penn Central missing');
          return okMsg('filtered to: ' + labels.join(', '));
        } finally {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
    }},

    { name: '119 typeahead: picking an option sets select.value and fires change', fn: async function() {
        if (!window.RoadTypeahead) return fail('RoadTypeahead missing');
        var host = document.createElement('div');
        host.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(host);
        try {
          var sel = document.createElement('select');
          ['', 'Pennsylvania', 'Santa Fe'].forEach(function(v) {
            var o = document.createElement('option');
            o.value = v; o.textContent = v || '(any)';
            sel.appendChild(o);
          });
          host.appendChild(sel);
          var changed = 0;
          sel.addEventListener('change', function() { changed++; });
          RoadTypeahead.attach(sel);
          var wrap = sel.parentNode;
          var input = wrap.querySelector('.road-ty-input');
          input.focus();
          await new Promise(function(r) { setTimeout(r, 5); });
          // Find the Santa Fe option and simulate mousedown (our pick trigger)
          var opts = wrap.querySelectorAll('.road-ty-option');
          var target = null;
          for (var i = 0; i < opts.length; i++) {
            if (opts[i].textContent === 'Santa Fe') { target = opts[i]; break; }
          }
          if (!target) return fail('Santa Fe option not rendered');
          var ev = new Event('mousedown', { bubbles: true, cancelable: true });
          target.dispatchEvent(ev);
          if (sel.value !== 'Santa Fe') return fail('select.value=' + sel.value);
          if (changed < 1) return fail('change event did not fire');
          return okMsg('value set + change fired');
        } finally {
          if (host.parentNode) host.parentNode.removeChild(host);
        }
    }},

  ];

  // ──────────────────────────────────────────────────────────────
  // Runner
  // ──────────────────────────────────────────────────────────────
  async function run() {
    // Save baselines we might clobber
    var baseline = snapshotLS(['lv_onboarded', 'lv_collect_eras', 'lv_vault_optin']);

    // Close any lingering overlays so we start clean
    cleanupAllOverlays();

    var results = [];
    for (var i = 0; i < TESTS.length; i++) {
      var t = TESTS[i];
      var r;
      try {
        var out = await t.fn();
        r = (out && typeof out.ok === 'boolean')
          ? { name: t.name, pass: out.ok, msg: out.msg || '' }
          : { name: t.name, pass: !!out, msg: '' };
      } catch (e) {
        r = { name: t.name, pass: false, msg: 'threw: ' + (e && e.message ? e.message : String(e)) };
      }
      results.push(r);
      // Always clean up overlays between tests so failures don't cascade
      cleanupAllOverlays();
    }

    // Restore baseline so running the suite doesn't persist test state
    restoreLS(baseline);
    cleanupAllOverlays();

    var passed = results.filter(function(r) { return r.pass; }).length;
    var failed = results.length - passed;
    return {
      total:  results.length,
      passed: passed,
      failed: failed,
      failures: results.filter(function(r) { return !r.pass; }),
      all:    results,
    };
  }

  window.TR_TESTS = { run: run, TESTS: TESTS, CONFIG: TEST_CONFIG };
})();
