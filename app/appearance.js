// ═══════════════════════════════════════════════════════════════
// appearance.js — the Appearance editor (v0.9.1148)
//
// Brad: "a page that allows me now but will turn into a customizing screen
// for a user later… little boxes with the color… you click the box a color
// wheel pops up… it changes instantly all the things that are tied to that…
// then we can set presets." Mock v2.1 approved 2026-07-28.
//
// This is the "picker UI" that applyTheme()'s custom-skin plumbing
// (app.js v0.9.944) has been waiting for: the editor writes CSS variables
// inline while you experiment, and Save persists the map to lv_skin_custom
// + sets lv_theme='custom', which is exactly what applyTheme() replays on
// every boot. Cancel removes the experiments and replays the saved theme.
//
// The annotated screens are live replicas drawn from the SAME variables as
// the app (a screenshot could not repaint while you drag the wheel). Chip
// boxes auto-dock to the gutter nearest their target and stack in target
// order, so leader lines cannot cross; hover a chip and everything that
// color touches lights up.
//
// Visibility is gated on APPEARANCE_ENABLED (config.js) — flip it false to
// hide the whole feature before beta invites go out.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Every box the editor shows: [cssVar, label, sub]. The order here is not
  // the layout — docking + stacking are computed from each scene's targets.
  var EDIT_VARS = [
    ['--bg',       'Background',      'whole app canvas'],
    ['--surface',  'Panels',          'cards · sidebar · tables'],
    ['--surface2', 'Input fields',    'boxes · dropdowns'],
    ['--text',     'Text',            'the cream'],
    ['--border',   'Lines',           'borders · dividers'],
    ['--accent',   'Brand orange',    'numbers · bars · Next'],
    ['--accent2',  'Gold',            'values · era chips'],
    ['--green',    'Collection green','owned · sold · success'],
    ['--want',     'Want blue',       'want list · headings'],
    ['--forsale',  'Sale orange',     'for-sale · asking'],
    ['--accent3',  'Upgrade purple',  'upgrade list'],
  ];

  var BUILTIN_PRESETS = {
    'Lionel Box':   { '--bg':'#0f1220','--surface':'#161c34','--surface2':'#1c2544','--text':'#f8e8c0','--border':'#2a3560','--accent':'#f05008','--accent2':'#d4a843','--green':'#2ecc71','--want':'#2980b9','--forsale':'#e67e22','--accent3':'#8b5cf6' },
    'Pennsy Tuscan':{ '--bg':'#2b100d','--surface':'#3d1512','--surface2':'#4a1c16','--text':'#f2e2c4','--border':'#5a2a22','--accent':'#c9922a','--accent2':'#e8c060','--green':'#3aad70','--want':'#4a7ba6','--forsale':'#d97c22','--accent3':'#9b6fd0' },
    'Santa Fe':     { '--bg':'#1c0908','--surface':'#8c1c13','--surface2':'#7a1810','--text':'#f5efe0','--border':'#a83a2a','--accent':'#e8b830','--accent2':'#d8d4c8','--green':'#3aad70','--want':'#3a7ba6','--forsale':'#e07020','--accent3':'#a07ad0' },
    'Alaska':       { '--bg':'#0d1830','--surface':'#132447','--surface2':'#1a2f5a','--text':'#f6efdd','--border':'#28406e','--accent':'#f2b428','--accent2':'#e8cf8a','--green':'#3ec47a','--want':'#5a94d4','--forsale':'#e0862a','--accent3':'#a48ae8' },
  };
  var USER_PRESETS_KEY = 'rr_skin_presets';

  var _root = document.documentElement;
  var _live = {};        // vars set during this editing session (not yet saved)
  var _saved = false;

  function _cur(v) {
    return (_root.style.getPropertyValue(v) || getComputedStyle(_root).getPropertyValue(v) || '').trim();
  }
  function _set(v, val) {
    _root.style.setProperty(v, val);
    _live[v] = val;
    var i = document.querySelector('#rrap .rrap-chip[data-var="' + v + '"] input');
    if (i && i.value !== val) { try { i.value = val; } catch (e) {} }
  }
  function _userPresets() {
    try { return JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function _chipHtml(v, label, sub) {
    return '<div class="rrap-chip" data-var="' + v + '">'
      + '<span class="rrap-cs"><input type="color" value="' + (_cur(v) || '#888888') + '">'
      + '<span class="rrap-cface" style="background:var(' + v + ')"></span></span>'
      + '<span class="rrap-cl"><b>' + label + '</b><span>' + sub + '</span></span></div>';
  }
  function _chips(list) {
    return list.map(function (v) {
      var d = EDIT_VARS.filter(function (e) { return e[0] === v; })[0];
      return d ? _chipHtml(d[0], d[1], d[2]) : '';
    }).join('');
  }

  // ── the two approved scenes; replicas use the app's real variables ──
  function _sceneDash() {
    return '<div class="rrap-scene rrap-on" id="rrap-scene-dash">'
      + '<div class="rrap-app" id="ra-app" data-c="bg">'
      +  '<div class="rrap-apph" id="ra-head" data-c="surface"><span class="rrap-logo" data-c="text">THE RAIL <i data-c="accent">ROSTER</i></span></div>'
      +  '<div class="rrap-body">'
      +   '<div class="rrap-side" data-c="surface"><div class="rrap-nav rrap-navon" id="ra-nav" data-c="accent">Dashboard</div><div class="rrap-nav">My Collection</div><div class="rrap-nav">Want / Upgrade</div><div class="rrap-nav">For Sale</div></div>'
      +   '<div class="rrap-content">'
      +    '<div class="rrap-acts">'
      +     '<span class="rrap-act" style="color:var(--green);border-color:var(--green)" id="ra-green" data-c="green">＋ COLLECTION</span>'
      +     '<span class="rrap-act" style="color:var(--want);border-color:var(--want)" id="ra-want" data-c="want">★ WANT LIST</span>'
      +     '<span class="rrap-act" style="color:var(--accent3);border-color:var(--accent3)" id="ra-upg" data-c="accent3">↑ UPGRADE</span>'
      +     '<span class="rrap-act" style="color:var(--forsale);border-color:var(--forsale)" id="ra-fs" data-c="forsale">$ FOR SALE</span>'
      +    '</div>'
      +    '<div class="rrap-stats">'
      +     '<div class="rrap-stat" id="ra-stat" data-c="surface"><div class="rrap-n" data-c="text">' + (Object.keys((window.state && state.personalData) || {}).length || 135) + '</div><div class="rrap-l" data-c="want">ITEMS</div></div>'
      +     '<div class="rrap-stat" style="border-top-color:var(--green)" data-c="surface"><div class="rrap-n" data-c="text">$12,480</div><div class="rrap-l" data-c="want">EST. VALUE</div></div>'
      +     '<div class="rrap-stat" style="border-top-color:var(--want)" data-c="surface"><div class="rrap-n" data-c="text">30</div><div class="rrap-l" data-c="want">WANT LIST</div></div>'
      +    '</div>'
      +    '<div class="rrap-panel" id="ra-rows" data-c="surface"><div class="rrap-pt" data-c="want">RECENT ACTIVITY</div>'
      +     '<div class="rrap-row" id="ra-border" data-c="border"><span class="rrap-inum" id="ra-inum" data-c="accent">6464-475</span><span class="rrap-rd">Boston &amp; Maine Boxcar</span><span class="rrap-price" id="ra-gold" data-c="accent2">$50</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)" data-c="green">OWNED</span></div>'
      +     '<div class="rrap-row" data-c="border"><span class="rrap-inum" data-c="accent">2343-P</span><span class="rrap-rd">Santa Fe F3 A Unit</span><span class="rrap-price" data-c="accent2">$420</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--want) 16%,transparent);color:var(--want)" data-c="want">WANTED</span></div>'
      +     '<div class="rrap-row" data-c="border"><span class="rrap-inum" data-c="accent">6017</span><span class="rrap-rd">Lionel Lines SP Caboose</span><span class="rrap-price" data-c="accent2">$20</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--forsale) 16%,transparent);color:var(--forsale)" data-c="forsale">FOR SALE</span></div>'
      +    '</div>'
      +   '</div>'
      +  '</div>'
      + '</div>'
      + _chips(['--bg', '--surface', '--text', '--border', '--accent', '--accent2', '--green', '--want', '--forsale', '--accent3'])
      + '</div>';
  }
  function _sceneWiz() {
    return '<div class="rrap-scene" id="rrap-scene-wiz">'
      + '<div class="rrap-scrim" id="rw-scrim">'
      +  '<div class="rrap-wiz" id="rw-card" data-c="bg">'
      +   '<div class="rrap-wh"><div class="rrap-wstep" data-c="text">Collection · Step 2 of 6</div><div class="rrap-wt" id="rw-title" data-c="text">What is the item number?</div></div>'
      +   '<div class="rrap-wprog" id="rw-bar"><i data-c="accent"></i></div>'
      +   '<div class="rrap-wb">'
      +    '<div class="rrap-wlbl">ITEM NUMBER</div>'
      +    '<div class="rrap-win" id="rw-input" data-c="surface2">e.g. 726, 2046, 6464-1</div>'
      +    '<div class="rrap-wphoto" id="rw-photo" data-c="want">📷 DON\'T KNOW THE NUMBER? IDENTIFY BY PHOTO</div>'
      +   '</div>'
      +   '<div class="rrap-wf"><span class="rrap-wbtn">CANCEL</span><span class="rrap-wbtn rrap-go" id="rw-next" data-c="accent">NEXT →</span></div>'
      +  '</div>'
      + '</div>'
      + _chips(['--accent', '--bg', '--surface2', '--text', '--want'])
      + '</div>';
  }

  // chip → what it points at, per scene (ids above)
  var TARGETS = {
    'rrap-scene-dash': { '--bg': 'ra-app', '--surface': 'ra-head', '--text': 'ra-stat', '--border': 'ra-border', '--accent': 'ra-inum', '--accent2': 'ra-gold', '--green': 'ra-green', '--want': 'ra-want', '--forsale': 'ra-fs', '--accent3': 'ra-upg' },
    'rrap-scene-wiz':  { '--accent': 'rw-bar', '--bg': 'rw-card', '--surface2': 'rw-input', '--text': 'rw-title', '--want': 'rw-photo' },
  };

  function _presetPills() {
    var user = _userPresets();
    var html = '';
    Object.keys(BUILTIN_PRESETS).forEach(function (n) { html += _pill(n, BUILTIN_PRESETS[n], false); });
    Object.keys(user).forEach(function (n) { html += _pill(n, user[n], true); });
    html += '<div class="rrap-preset rrap-addp" onclick="window._rrapSavePreset()">＋ Save current…</div>';
    return html;
  }
  function _pill(name, map, isUser) {
    var dots = ['--bg', '--accent', '--text'].map(function (v) {
      return '<span class="rrap-d" style="background:' + (map[v] || '#888') + '"></span>';
    }).join('');
    return '<div class="rrap-preset" data-preset="' + name.replace(/"/g, '&quot;') + '">' + dots + name
      + (isUser ? ' <span class="rrap-del" title="Delete preset">✕</span>' : '') + '</div>';
  }

  var CSS = ''
    + '#rrap{position:fixed;inset:0;z-index:100040;background:var(--bg);overflow-y:auto;font-family:var(--font-body)}'
    + '.rrap-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 94%,black);border-bottom:1px solid var(--border);padding:0.8rem 1.25rem;display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap}'
    + '.rrap-top h2{font-family:var(--font-head);font-size:1.1rem;font-weight:600;color:var(--text)}'
    + '.rrap-top .rrap-sub{font-size:0.7rem;color:var(--text-dim)}'
    + '.rrap-actions{margin-left:auto;display:flex;gap:0.45rem;flex-wrap:wrap}'
    + '.rrap-btn{font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.05em;padding:0.5rem 0.85rem;border-radius:8px;border:1px solid var(--border-hi);background:var(--surface2);color:var(--text);cursor:pointer}'
    + '.rrap-btn.rrap-primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}'
    + '.rrap-presets{display:flex;gap:0.5rem;padding:0.7rem 1.25rem;border-bottom:1px solid var(--border);overflow-x:auto}'
    + '.rrap-preset{flex:none;display:flex;align-items:center;gap:0.4rem;padding:0.42rem 0.8rem;border-radius:999px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;font-size:0.75rem;color:var(--text-mid);white-space:nowrap}'
    + '.rrap-preset:hover{border-color:var(--text-mid)}'
    + '.rrap-d{width:10px;height:10px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);display:inline-block}'
    + '.rrap-del{color:var(--text-dim);font-size:0.65rem;padding-left:0.2rem}'
    + '.rrap-addp{border-style:dashed;color:var(--text-dim)}'
    + '.rrap-tabs{display:flex;gap:0.35rem;padding:0.85rem 1.25rem 0;max-width:1200px;margin:0 auto}'
    + '.rrap-tab{font-family:var(--font-head);font-size:0.76rem;letter-spacing:0.05em;padding:0.55rem 1rem;border-radius:9px 9px 0 0;border:1px solid var(--border);border-bottom:none;background:var(--surface);color:var(--text-dim);cursor:pointer}'
    + '.rrap-tab.rrap-on{background:var(--surface2);color:var(--text);border-color:var(--border-hi)}'
    + '.rrap-stagewrap{max-width:1200px;margin:0 auto;padding:0 1.25rem 2rem;overflow-x:auto}'
    + '.rrap-stage{position:relative;border:1px solid var(--border-hi);border-radius:0 14px 14px 14px;background:var(--surface2);padding:26px 208px;min-width:1020px}'
    + '.rrap-wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}'
    + '.rrap-wires line{stroke-width:1.5;stroke-dasharray:4 3;opacity:0.85}'
    + '.rrap-scene{display:none}.rrap-scene.rrap-on{display:block}'
    + '.rrap-chip{position:absolute;z-index:10;width:182px;display:flex;align-items:center;gap:0.5rem;background:color-mix(in srgb,var(--bg) 80%,black);border:1px solid var(--border-hi);border-radius:10px;padding:0.4rem 0.55rem;box-shadow:0 6px 22px rgba(0,0,0,0.45);cursor:pointer}'
    + '.rrap-chip:hover{border-color:var(--text-mid)}'
    + '.rrap-cs{position:relative;width:30px;height:24px;flex:none}'
    + '.rrap-chip input[type=color]{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}'
    + '.rrap-cface{position:absolute;inset:0;border-radius:6px;border:1.5px solid rgba(255,255,255,0.25);pointer-events:none}'
    + '.rrap-cl{font-size:0.64rem;line-height:1.25;color:var(--text)}'
    + '.rrap-cl b{display:block;font-size:0.7rem}'
    + '.rrap-cl span{color:var(--text-dim);font-size:0.57rem}'
    + '.rrap-hl{outline:2px solid #fff !important;outline-offset:2px}'
    // replica
    + '.rrap-app{background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;font-size:13px}'
    + '.rrap-apph{display:flex;align-items:center;background:var(--surface);border-bottom:1px solid var(--border);padding:9px 13px}'
    + '.rrap-logo{font-family:var(--font-head);font-weight:700;letter-spacing:0.04em;color:var(--text)}'
    + '.rrap-logo i{color:var(--accent);font-style:normal}'
    + '.rrap-body{display:flex}'
    + '.rrap-side{width:130px;background:var(--surface);border-right:1px solid var(--border);padding:8px;flex:none}'
    + '.rrap-nav{padding:6px 9px;border-radius:7px;color:var(--text-mid);font-size:0.7rem;margin-bottom:2px}'
    + '.rrap-navon{background:var(--surface2);color:var(--text);border-left:3px solid var(--accent)}'
    + '.rrap-content{flex:1;padding:11px;display:flex;flex-direction:column;gap:9px;background:var(--bg)}'
    + '.rrap-acts{display:flex;gap:6px;flex-wrap:wrap}'
    + '.rrap-act{font-family:var(--font-head);font-size:0.58rem;letter-spacing:0.06em;padding:5px 9px;border-radius:7px;border:1.5px solid}'
    + '.rrap-stats{display:flex;gap:7px}'
    + '.rrap-stat{flex:1;background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--accent);border-radius:9px;padding:8px 9px}'
    + '.rrap-n{font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:var(--text)}'
    + '.rrap-l{font-size:0.53rem;letter-spacing:0.06em;color:var(--want);font-weight:700}'
    + '.rrap-panel{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px}'
    + '.rrap-pt{font-family:var(--font-head);font-size:0.6rem;letter-spacing:0.09em;color:var(--want);margin-bottom:6px}'
    + '.rrap-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)}'
    + '.rrap-row:last-child{border-bottom:none}'
    + '.rrap-inum{font-family:var(--font-mono);color:var(--accent);font-weight:600;font-size:0.76rem}'
    + '.rrap-rd{flex:1;font-size:0.68rem;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.rrap-price{font-family:var(--font-mono);font-size:0.68rem;color:var(--accent2)}'
    + '.rrap-badge{font-size:0.52rem;font-family:var(--font-head);letter-spacing:0.06em;border-radius:5px;padding:2px 6px}'
    // wizard replica
    + '.rrap-scrim{background:rgba(0,0,0,0.55);border-radius:10px;padding:24px;display:flex;justify-content:center}'
    + '.rrap-wiz{width:330px;background:var(--bg);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-top:3px solid var(--accent);border-radius:13px;overflow:hidden}'
    + '.rrap-wh{padding:11px 13px 0}'
    + '.rrap-wstep{font-family:var(--font-mono);font-size:0.62rem;color:var(--text-mid)}'
    + '.rrap-wt{font-family:var(--font-head);font-size:1rem;font-weight:600;color:var(--text);margin:2px 0 8px}'
    + '.rrap-wprog{height:3px;background:rgba(255,255,255,0.08)}'
    + '.rrap-wprog i{display:block;height:100%;width:33%;background:var(--accent)}'
    + '.rrap-wb{padding:11px 13px;display:flex;flex-direction:column;gap:8px}'
    + '.rrap-wlbl{font-family:var(--font-head);font-size:0.56rem;letter-spacing:0.1em;color:var(--text-mid)}'
    + '.rrap-win{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:0.76rem;color:var(--text-dim);font-family:var(--font-mono)}'
    + '.rrap-wphoto{border:1.5px dashed var(--want);color:var(--want);border-radius:8px;padding:7px;text-align:center;font-family:var(--font-head);font-size:0.56rem;letter-spacing:0.08em}'
    + '.rrap-wf{display:flex;gap:6px;justify-content:flex-end;padding:10px 13px;border-top:1px solid color-mix(in srgb,var(--accent) 25%,transparent)}'
    + '.rrap-wbtn{font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.05em;padding:7px 12px;border-radius:7px;border:1px solid var(--border-hi);background:var(--surface2);color:var(--text)}'
    + '.rrap-go{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}'
    + '.rrap-note{max-width:1200px;margin:0 auto;padding:0 1.25rem 2.5rem;font-size:0.7rem;color:var(--text-dim);line-height:1.6}';

  window.openAppearance = function () {
    if (typeof APPEARANCE_ENABLED !== 'undefined' && !APPEARANCE_ENABLED) return;
    var old = document.getElementById('rrap'); if (old) old.remove();
    _live = {}; _saved = false;

    if (!document.getElementById('rrap-css')) {
      var st = document.createElement('style'); st.id = 'rrap-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }

    var ov = document.createElement('div'); ov.id = 'rrap';
    ov.innerHTML =
      '<div class="rrap-top"><div><h2>🎨 Appearance</h2>'
      + '<div class="rrap-sub">Click a color box — the whole app changes instantly. Hover a box to see everything it controls. Nothing is kept unless you Save.</div></div>'
      + '<div class="rrap-actions">'
      + '<button class="rrap-btn" onclick="window._rrapReset()">Reset to Default</button>'
      + '<button class="rrap-btn" onclick="window._rrapExport()">Export</button>'
      + '<button class="rrap-btn" onclick="window._rrapImport()">Import…</button>'
      + '<button class="rrap-btn" onclick="window._rrapClose(false)">Cancel</button>'
      + '<button class="rrap-btn rrap-primary" onclick="window._rrapClose(true)">💾 Save &amp; Use</button>'
      + '</div></div>'
      + '<div class="rrap-presets" id="rrap-presets">' + _presetPills() + '</div>'
      + '<div class="rrap-tabs">'
      + '<div class="rrap-tab rrap-on" data-scene="dash">📊 Dashboard</div>'
      + '<div class="rrap-tab" data-scene="wiz">🪟 Add Item Pop-up</div>'
      + '</div>'
      + '<div class="rrap-stagewrap"><div class="rrap-stage" id="rrap-stage">'
      + '<svg class="rrap-wires" id="rrap-wires"></svg>'
      + _sceneDash() + _sceneWiz()
      + '</div></div>'
      + '<div class="rrap-note"><b style="color:var(--text-mid)">While you experiment, the real app behind this page is repainting too.</b> '
      + 'Save &amp; Use keeps this as your look on this device (Preferences → Theme switches back any time). '
      + 'Some copies of these colors are still hard-wired in older corners of the app — they join the system sweep by sweep (see the census); the boxes here only claim what they truly control.</div>';
    document.body.appendChild(ov);
    if (window.BackStack && BackStack.wire) BackStack.wire(ov);

    // wire chips
    ov.querySelectorAll('.rrap-chip').forEach(function (ch) {
      var v = ch.dataset.var, inp = ch.querySelector('input');
      inp.value = /^#[0-9a-fA-F]{6}$/.test(_cur(v)) ? _cur(v) : inp.value;
      inp.addEventListener('input', function () { _set(v, inp.value); _wires(); });
      ch.addEventListener('mouseenter', function () {
        var key = v.replace('--', '');
        ov.querySelectorAll('[data-c="' + key + '"]').forEach(function (e) { e.classList.add('rrap-hl'); });
        _wires(ch);
      });
      ch.addEventListener('mouseleave', function () {
        ov.querySelectorAll('.rrap-hl').forEach(function (e) { e.classList.remove('rrap-hl'); });
        _wires();
      });
      ch.addEventListener('click', function (e) { if (e.target !== inp) inp.click(); });
    });
    // tabs
    ov.querySelectorAll('.rrap-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        ov.querySelectorAll('.rrap-tab').forEach(function (x) { x.classList.toggle('rrap-on', x === t); });
        ov.querySelectorAll('.rrap-scene').forEach(function (s) { s.classList.toggle('rrap-on', s.id === 'rrap-scene-' + t.dataset.scene); });
        requestAnimationFrame(function () { _layout(); _wires(); });
      });
    });
    // presets (delegated so refreshed pills keep working)
    document.getElementById('rrap-presets').addEventListener('click', function (e) {
      var del = e.target.closest('.rrap-del');
      var pill = e.target.closest('.rrap-preset[data-preset]');
      if (del && pill) {
        var up = _userPresets(); delete up[pill.dataset.preset];
        try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(up)); } catch (e2) {}
        document.getElementById('rrap-presets').innerHTML = _presetPills();
        return;
      }
      if (!pill) return;
      var map = BUILTIN_PRESETS[pill.dataset.preset] || _userPresets()[pill.dataset.preset];
      if (map) { Object.keys(map).forEach(function (k) { _set(k, map[k]); }); _wires(); }
    });

    window.addEventListener('resize', _onResize);
    requestAnimationFrame(function () { _layout(); _wires(); });
    setTimeout(function () { _layout(); _wires(); }, 300);
  };

  function _onResize() { if (document.getElementById('rrap')) { _layout(); _wires(); } }

  // dock each chip to the gutter nearest its target; stack in target order —
  // same order on both ends means the lines cannot cross (mock v2.1 rule).
  function _layout() {
    var stage = document.getElementById('rrap-stage'); if (!stage) return;
    var scene = stage.querySelector('.rrap-scene.rrap-on'); if (!scene) return;
    var sr = stage.getBoundingClientRect();
    var tmap = TARGETS[scene.id] || {};
    var info = [];
    scene.querySelectorAll('.rrap-chip').forEach(function (ch) {
      var t = document.getElementById(tmap[ch.dataset.var] || '');
      if (!t) return;
      var r = t.getBoundingClientRect();
      info.push({ ch: ch, t: t,
        dock: (r.left - sr.left) < (sr.right - r.right) ? 'l' : 'r',
        ty: r.top + r.height / 2 - sr.top });
    });
    ['l', 'r'].forEach(function (side) {
      var col = info.filter(function (i) { return i.dock === side; })
                    .sort(function (a, b) { return a.ty - b.ty; });
      var y = 30;
      col.forEach(function (i) {
        y = Math.max(y, i.ty - 20);
        i.ch.style.top = y + 'px';
        i.ch.style.left = side === 'l' ? '14px' : '';
        i.ch.style.right = side === 'r' ? '14px' : '';
        i.ch.dataset.dock = side;
        y += i.ch.offsetHeight + 12;
      });
    });
  }

  function _wires(hot) {
    var stage = document.getElementById('rrap-stage'), w = document.getElementById('rrap-wires');
    if (!stage || !w) return;
    var scene = stage.querySelector('.rrap-scene.rrap-on'); if (!scene) return;
    var sr = stage.getBoundingClientRect(), tmap = TARGETS[scene.id] || {}, html = '';
    scene.querySelectorAll('.rrap-chip').forEach(function (ch) {
      var t = document.getElementById(tmap[ch.dataset.var] || ''); if (!t) return;
      var c = ch.getBoundingClientRect(), r = t.getBoundingClientRect();
      var l = ch.dataset.dock === 'l';
      var x1 = (l ? c.right : c.left) - sr.left, y1 = c.top + c.height / 2 - sr.top;
      var x2 = (l ? r.left : r.right) - sr.left, y2 = r.top + r.height / 2 - sr.top;
      var col = _cur(ch.dataset.var) || '#888';
      var hi = hot === ch;
      html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '"' + (hi ? ' stroke-width="2.5" stroke-dasharray="none"' : '') + '/>'
        + '<circle cx="' + x2 + '" cy="' + y2 + '" r="' + (hi ? 5 : 3.5) + '" fill="' + col + '"/>';
    });
    w.innerHTML = html;
  }

  // ── actions ──
  window._rrapReset = function () {
    Object.keys(_live).forEach(function (v) { _root.style.removeProperty(v); });
    _live = {};
    if (typeof applyTheme === 'function') applyTheme();
    var ov = document.getElementById('rrap');
    if (ov) ov.querySelectorAll('.rrap-chip').forEach(function (ch) {
      var c = _cur(ch.dataset.var);
      if (/^#[0-9a-fA-F]{6}$/.test(c)) ch.querySelector('input').value = c;
    });
    _wires();
  };
  window._rrapSavePreset = function () {
    var go = function (name) {
      if (!name) return;
      var up = _userPresets(); var map = {};
      EDIT_VARS.forEach(function (e) { map[e[0]] = _cur(e[0]); });
      up[String(name).slice(0, 24)] = map;
      try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(up)); } catch (e2) {}
      document.getElementById('rrap-presets').innerHTML = _presetPills();
    };
    if (typeof appPrompt === 'function') appPrompt('Name this preset', '', go);
    else go(window.prompt('Name this preset'));
  };
  window._rrapExport = function () {
    var map = {}; EDIT_VARS.forEach(function (e) { map[e[0]] = _cur(e[0]); });
    var json = JSON.stringify(map);
    var done = function () { if (typeof showToast === 'function') showToast('Skin copied — paste it anywhere to share', 3000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, done);
    else { window.prompt('Copy this skin:', json); }
  };
  window._rrapImport = function () {
    var go = function (txt) {
      if (!txt) return;
      try {
        var map = JSON.parse(txt);
        Object.keys(map).forEach(function (k) {
          var name = k.charAt(0) === '-' ? k : '--' + k;
          if (/^#[0-9a-fA-F]{3,8}$/.test(String(map[k]))) _set(name, map[k]);
        });
        _wires();
      } catch (e) { if (typeof showToast === 'function') showToast('That didn’t look like a skin — paste the exported text exactly', 3500, true); }
    };
    if (typeof appPrompt === 'function') appPrompt('Paste a skin', '', go);
    else go(window.prompt('Paste a skin'));
  };
  window._rrapClose = function (save) {
    var ov = document.getElementById('rrap');
    if (save && Object.keys(_live).length) {
      // Persist through the EXISTING plumbing: applyTheme('custom') replays
      // lv_skin_custom on every boot — this editor is just its picker.
      var map = {}; EDIT_VARS.forEach(function (e) { map[e[0]] = _cur(e[0]); });
      try {
        localStorage.setItem((window.A11Y && A11Y.theme && A11Y.theme.customStorageKey) || 'lv_skin_custom', JSON.stringify(map));
        localStorage.setItem((window.A11Y && A11Y.theme && A11Y.theme.storageKey) || 'lv_theme', 'custom');
      } catch (e2) {}
      _saved = true;
      if (typeof showToast === 'function') showToast('Saved — this is your look now. Preferences → Theme switches back any time.', 3800);
    }
    // drop the session's inline experiments; applyTheme replays the truth
    Object.keys(_live).forEach(function (v) { _root.style.removeProperty(v); });
    _live = {};
    if (typeof applyTheme === 'function') applyTheme();
    if (ov) ov.remove();
    window.removeEventListener('resize', _onResize);
  };
})();
