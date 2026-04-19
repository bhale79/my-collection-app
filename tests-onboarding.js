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
    ['onboarding-map-overlay', 'gmail-help-overlay', 'onboarding-return-bar'].forEach(function(id) {
      var el = $(id); if (el) el.remove();
    });
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

    { name: '94 migration: stub function returns {moved:false} while disabled', fn: async function() {
        if (typeof migrateItemBetweenTabs !== 'function') return fail('migrateItemBetweenTabs missing');
        var r = await migrateItemBetweenTabs('9999', 'MPC-Modern', 'Atlas O');
        if (!r || r.moved !== false) return fail('expected {moved:false} got ' + JSON.stringify(r));
        return okMsg();
    }},

    //  ── Tutorial GIFs scaffold (Phase D) ──
    { name: '95 gifs: TUTORIAL_GIFS config exposed', fn: function() {
        var g = window.TUTORIAL_GIFS || {};
        return (Array.isArray(g.demos) && g.demos.length) ? okMsg(g.demos.length + ' demos configured') : fail('TUTORIAL_GIFS.demos missing/empty');
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
