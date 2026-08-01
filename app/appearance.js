// ═══════════════════════════════════════════════════════════════
// appearance.js — the Appearance editor
// v0.9.1148 · logo→palette v0.9.1149 · logo prep v0.9.1205
// v0.9.1206: paper chrome, square logo tile, colour-match box,
//            desktop-only editing, and Preview-before-Apply.
//
// Brad, 2026-07-31, on the editor itself:
//   "We need a big square box to the top left that looks like a logo shape,
//    not a long text box. Also this whole page is super dark, its hard to
//    see anything. This should be the cream background. Also size the box
//    with the app background in such a way that there is not scrolling.
//    Making and editing skins will only be done on a desktop. Only presets
//    can be on the mobile app to be selected."
//   "the actual app shouldn't change until we hit preview, which then will
//    let us flip through the app to see it completely while a pop up stays
//    on top with apply it, edit it, and cancel."
//
// THREE STRUCTURAL RULES FALL OUT OF THAT, AND THEY ARE WHY THIS FILE LOOKS
// THE WAY IT DOES:
//
//  1. The tool never wears the skin it is making. The editor's chrome reads
//     --p-* (declared once in app.css, beside the light .main island) and
//     nothing else. Building a black skin used to make the editor unreadable.
//
//  2. The candidate skin lives on the STAGE, not on :root. _set() writes the
//     variable onto #rrap-stage, so only the preview replica repaints and the
//     real app behind is untouched until Preview is pressed. That is the whole
//     of Brad's second note, and it is one line of plumbing rather than a mode.
//
//  3. Preview is a round trip, not a commit. Preview paints :root, hides the
//     editor, and floats a bar with Apply it / Edit it / Cancel. Edit puts you
//     back exactly where you were; Cancel leaves no trace. Persistence still
//     rides the EXISTING plumbing — lv_skin_custom + lv_theme='custom', which
//     applyTheme() replays on every boot.
//
// Visibility is gated on APPEARANCE_ENABLED (config.js) — flip it false to
// hide the whole feature before beta invites.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Every box the editor shows: [cssVar, label, sub]. The order here is not
  // the layout — docking + stacking are computed from each scene's targets.
  var EDIT_VARS = [
    ['--bg',       'Background',      'whole app canvas'],
    ['--surface',  'Panels',          'cards · sidebar · top bar'],
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

  // The colour-match box (Brad: "a color match box… allow them to adjust the
  // colors and apply those colors to the different areas"). Five plain-English
  // jobs, NOT eleven variables — the chips on the preview stay the precise
  // path for anyone who wants one. The four status colours are deliberately
  // absent: owned-is-green and wanted-is-blue are meaning, not decoration.
  var ROLES = [
    ['--bg',      'Background',      'the whole page'],
    ['--surface', 'Panels & header', 'cards · sidebar · top bar'],
    ['--accent',  'Brand accent',    'numbers · buttons · bars'],
    ['--accent2', 'Highlights',      'values · era chips'],
    ['--text',    'Text',            'all the writing'],
  ];

  var BUILTIN_PRESETS = {
    'Lionel Box':   { '--bg':'#0f1220','--surface':'#161c34','--surface2':'#1c2544','--text':'#f8e8c0','--border':'#2a3560','--accent':'#f05008','--accent2':'#d4a843','--green':'#2ecc71','--want':'#2980b9','--forsale':'#e67e22','--accent3':'#8b5cf6' },
    'Pennsy Tuscan':{ '--bg':'#2b100d','--surface':'#3d1512','--surface2':'#4a1c16','--text':'#f2e2c4','--border':'#5a2a22','--accent':'#c9922a','--accent2':'#e8c060','--green':'#3aad70','--want':'#4a7ba6','--forsale':'#d97c22','--accent3':'#9b6fd0' },
    'Santa Fe':     { '--bg':'#1c0908','--surface':'#8c1c13','--surface2':'#7a1810','--text':'#f5efe0','--border':'#a83a2a','--accent':'#e8b830','--accent2':'#d8d4c8','--green':'#3aad70','--want':'#3a7ba6','--forsale':'#e07020','--accent3':'#a07ad0' },
    'Alaska':       { '--bg':'#0d1830','--surface':'#132447','--surface2':'#1a2f5a','--text':'#f6efdd','--border':'#28406e','--accent':'#f2b428','--accent2':'#e8cf8a','--green':'#3ec47a','--want':'#5a94d4','--forsale':'#e0862a','--accent3':'#a48ae8' },
  };
  var USER_PRESETS_KEY = 'rr_skin_presets';
  // Not boxes in the editor — shades that follow --text. Saved with the
  // skin because applyTheme() replays whatever the saved map contains.
  var DERIVED_VARS = ['--text-mid', '--text-dim'];

  // v0.9.1149 (Brad, overnight): "clip a Santa Fe logo and paste it in that
  // box and have it create a palette." No AI involved — a palette is pixel
  // math. The image is sampled on a canvas RIGHT HERE in the browser: free
  // forever, instant, and the logo never leaves the device. The logo itself
  // can live on as a subtle watermark behind the app (off by default-able).
  var LOGO_KEY = 'rr_skin_logo';   // {data, mode: 'watermark'|'off', kind, sw}
  // v0.9.1208. Brad: "cancel doesn't delete out the logo… reset to default
  // didn't get rid of it either." One cause, not three: the logo was written
  // to LOGO_KEY the instant it was pasted, so it lived OUTSIDE the
  // Preview/Apply flow — already committed before Cancel could refuse it, and
  // its watermark already painted on the real app. The logo is now part of
  // the candidate, exactly like the colours. It rides a DRAFT key rather than
  // a variable so the size-fitting ladder still proves it fits at paste time.
  var LOGO_DRAFT_KEY = 'rr_skin_logo_draft';

  // ── v0.9.1209: three marks, not one ─────────────────────────────
  // Brad: "you should have a color match box, and 3 logo boxes. 1 for
  // water mark, 1 for left side bar logo, and 1 for header logo… on the
  // third upload, in that box let them type a custom header. 'The Short
  // Line Rail Collection' With fonts and color and border options."
  //
  // One record holds all three slots plus the typed line, and the whole
  // record is the candidate — so Cancel, Reset and Apply keep meaning
  // exactly what they meant for one logo. The old single-logo record is
  // migrated into the watermark slot on first read; nothing is lost.
  var BRAND_KEY = 'rr_skin_brand';
  var BRAND_DRAFT_KEY = 'rr_skin_brand_draft';
  var SLOTS = [
    ['watermark', 'Watermark', 'faint, behind the whole app'],
    ['sidebar',   'Sidebar',   'foot of the menu, on the left'],
    ['header',    'Header',    'top bar, beside THE RAIL ROSTER'],
  ];

  // Brad: "offer all fonts like you would select in word or whatever,
  // auto start with our fonts." These are all already on the machine —
  // nothing downloads, so a custom title cannot slow the app's start or
  // fail to appear on a bad connection.
  var FONTS = [
    ['', 'The Rail Roster headline'],
    ['var(--font-body)', 'The Rail Roster body'],
    ['var(--font-mono)', 'The Rail Roster typewriter'],
    ['Arial, Helvetica, sans-serif', 'Arial'],
    ['"Arial Black", Gadget, sans-serif', 'Arial Black'],
    ['"Arial Narrow", Arial, sans-serif', 'Arial Narrow'],
    ['Calibri, Candara, sans-serif', 'Calibri'],
    ['Candara, Calibri, sans-serif', 'Candara'],
    ['"Century Gothic", CenturyGothic, sans-serif', 'Century Gothic'],
    ['"Franklin Gothic Medium", Arial, sans-serif', 'Franklin Gothic'],
    ['Futura, "Trebuchet MS", sans-serif', 'Futura'],
    ['Geneva, Verdana, sans-serif', 'Geneva'],
    ['"Gill Sans", "Gill Sans MT", Calibri, sans-serif', 'Gill Sans'],
    ['Helvetica, Arial, sans-serif', 'Helvetica'],
    ['Impact, Charcoal, sans-serif', 'Impact'],
    ['"Lucida Sans Unicode", "Lucida Grande", sans-serif', 'Lucida Sans'],
    ['Optima, Candara, sans-serif', 'Optima'],
    ['"Segoe UI", Tahoma, sans-serif', 'Segoe UI'],
    ['Tahoma, Geneva, sans-serif', 'Tahoma'],
    ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet MS'],
    ['Verdana, Geneva, sans-serif', 'Verdana'],
    ['Baskerville, "Baskerville Old Face", serif', 'Baskerville'],
    ['"Book Antiqua", Palatino, serif', 'Book Antiqua'],
    ['Cambria, Georgia, serif', 'Cambria'],
    ['Constantia, Georgia, serif', 'Constantia'],
    ['Garamond, Baskerville, serif', 'Garamond'],
    ['Georgia, serif', 'Georgia'],
    ['"Hoefler Text", "Times New Roman", serif', 'Hoefler Text'],
    ['"Palatino Linotype", Palatino, serif', 'Palatino'],
    ['Rockwell, "Courier Bold", serif', 'Rockwell'],
    ['"Times New Roman", Times, serif', 'Times New Roman'],
    ['"Consolas", "Courier New", monospace', 'Consolas'],
    ['"Courier New", Courier, monospace', 'Courier New'],
    ['"Lucida Console", Monaco, monospace', 'Lucida Console'],
    ['Monaco, "Lucida Console", monospace', 'Monaco'],
    ['"Brush Script MT", "Segoe Script", cursive', 'Brush Script'],
    ['"Comic Sans MS", "Chalkboard SE", cursive', 'Comic Sans'],
    ['"Copperplate", "Copperplate Gothic Light", fantasy', 'Copperplate'],
    ['"Papyrus", fantasy', 'Papyrus'],
    ['"Segoe Script", "Brush Script MT", cursive', 'Segoe Script'],
    ['"Snell Roundhand", "Brush Script MT", cursive', 'Snell Roundhand']
  ];
  var BORDERS = [
    ['none',  'No border'],
    ['rule',  'Line underneath'],
    ['over',  'Line above'],
    ['both',  'Lines above and below'],
    ['left',  'Bar down the left'],
    ['ends',  'Bars at both ends'],
    ['box',   'Box around it'],
    ['round', 'Rounded box']
  ];
  var TITLE_SIZES = [['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']];
  var LOGO_MAX = 512;              // longest side of the copy we keep

  // Editing needs the wide stage; a phone gets the presets only. Brad:
  // "Making and editing skins will only be done on a desktop. Only presets
  // can be on the mobile app to be selected."
  var EDIT_MIN_WIDTH = 940;
  // The stand-in shown when a variable has no readable value yet. One
  // constant, because six copies of a grey is six chances to drift.
  var NO_COLOUR = '#888888';
  function _canEdit() { return (window.innerWidth || 0) >= EDIT_MIN_WIDTH; }
  window.rrAppearanceCanEdit = _canEdit;

  var _root = document.documentElement;
  var _live = {};        // the CANDIDATE skin — not on :root until Preview
  var _saved = false;
  var _scale = 1;        // stage fit-to-window factor
  var _swatches = [];    // colours pulled from the logo
  var _armed = -1;       // which swatch is picked up, ready to drop on a role
  var _preview = false;
  var _activePreset = '';        // the saved look currently loaded, if any
  var _loadingPreset = false;    // …and the one moment when _set must not clear it
  var _slotArmed = 'watermark';   // which of the three boxes a paste lands in

  function _stage() { return document.getElementById('rrap-stage'); }

  // The candidate value: what the user has chosen this session, else what the
  // app is wearing right now. Never reads the stage back, so it cannot drift.
  function _cur(v) {
    if (_live[v]) return _live[v];
    return (getComputedStyle(_root).getPropertyValue(v) || '').trim();
  }

  // RULE 2 lives here. The variable goes on the STAGE, so the preview replica
  // repaints and the real app does not. One line, no mode flag.
  function _set(v, val, derived) {
    if (!derived && !_loadingPreset && _activePreset) { _activePreset = ''; _refreshPresets(); }
    _live[v] = val;
    var st = _stage();
    if (st) st.style.setProperty(v, val);
    if (_preview) _root.style.setProperty(v, val);
    // The dimmer text shades follow the text colour. `derived` stops the
    // two calls below from calling straight back into here.
    if (!derived && (v === '--text' || v === '--bg')) {
      var d = _rrDeriveText(_cur('--text'), _cur('--bg'));
      Object.keys(d).forEach(function (k) { _set(k, d[k], true); });
    }
  }
  function _userPresets() {
    try { return JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }


  // ── the two approved scenes; replicas use the app's real variables ──
  function _sceneDash() {
    return '<div class="rrap-scene rrap-on" id="rrap-scene-dash">'
      + '<div class="rrap-app" id="ra-app" data-c="bg">'
      +  '<div class="rrap-apph" id="ra-head" data-c="surface"><span class="rrap-logo" data-c="text">THE RAIL <i data-c="accent">ROSTER</i></span><span id="ra-brand-head" class="rrap-rhead"></span></div>'
      +  '<div class="rrap-body">'
      +   '<div class="rrap-side" data-c="surface"><div class="rrap-nav rrap-navon" id="ra-nav" data-c="accent">Dashboard</div><div class="rrap-nav" data-c="text">My Collection</div><div class="rrap-nav" data-c="text">Want / Upgrade</div><div class="rrap-nav" data-c="text">For Sale</div><div id="ra-brand-side" class="rrap-rside"></div></div>'
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
      +     '<div class="rrap-row" id="ra-border" data-c="border"><span class="rrap-inum" id="ra-inum" data-c="accent">6464-475</span><span class="rrap-rd" data-c="text">Boston &amp; Maine Boxcar</span><span class="rrap-price" id="ra-gold" data-c="accent2">$50</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)" data-c="green">OWNED</span></div>'
      +     '<div class="rrap-row" data-c="border"><span class="rrap-inum" data-c="accent">2343-P</span><span class="rrap-rd" data-c="text">Santa Fe F3 A Unit</span><span class="rrap-price" data-c="accent2">$420</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--want) 16%,transparent);color:var(--want)" data-c="want">WANTED</span></div>'
      +     '<div class="rrap-row" data-c="border"><span class="rrap-inum" data-c="accent">6017</span><span class="rrap-rd" data-c="text">Lionel Lines SP Caboose</span><span class="rrap-price" data-c="accent2">$20</span><span class="rrap-badge" style="background:color-mix(in srgb,var(--forsale) 16%,transparent);color:var(--forsale)" data-c="forsale">FOR SALE</span></div>'
      +    '</div>'
      +   '</div>'
      +  '</div>'
      + '</div>'
      + '</div>';
  }
  function _sceneWiz() {
    return '<div class="rrap-scene" id="rrap-scene-wiz">'
      + '<div class="rrap-scrim" id="rw-scrim">'
      +  '<div class="rrap-wiz" id="rw-card" data-c="bg">'
      +   '<div class="rrap-wh"><div class="rrap-wstep" data-c="text">Collection · Step 2 of 6</div><div class="rrap-wt" id="rw-title" data-c="text">What is the item number?</div></div>'
      +   '<div class="rrap-wprog" id="rw-bar"><i data-c="accent"></i></div>'
      +   '<div class="rrap-wb">'
      +    '<div class="rrap-wlbl" data-c="text">ITEM NUMBER</div>'
      +    '<div class="rrap-win" id="rw-input" data-c="surface2"><span data-c="text">e.g. 726, 2046, 6464-1</span></div>'
      +    '<div class="rrap-wphoto" id="rw-photo" data-c="want">📷 DON\'T KNOW THE NUMBER? IDENTIFY BY PHOTO</div>'
      +   '</div>'
      +   '<div class="rrap-wf"><span class="rrap-wbtn" data-c="text">CANCEL</span><span class="rrap-wbtn rrap-go" id="rw-next" data-c="accent">NEXT →</span></div>'
      +  '</div>'
      + '</div>'
      + '</div>';
  }


  function _presetPills() {
    var user = _userPresets();
    var html = '';
    Object.keys(BUILTIN_PRESETS).forEach(function (n) { html += _pill(n, BUILTIN_PRESETS[n], false); });
    Object.keys(user).forEach(function (n) { html += _pill(n, user[n], true); });
    html += '<div class="rrap-preset rrap-addp" onclick="window._rrapSavePreset()">＋ Save current…</div>';
    return html;
  }
  // Brad: "if we are working on a preset, the button needs to be highlighted."
  // _activePreset is the name of the look currently loaded, and it is cleared
  // the moment any colour is changed by hand — because at that point it is no
  // longer that look, and saying otherwise would be a small lie.
  function _pill(name, map, isUser) {
    var dots = ['--bg', '--accent', '--text'].map(function (v) {
      return '<span class="rrap-d" style="background:' + (map[v] || NO_COLOUR) + '"></span>';
    }).join('');
    var esc = name.replace(/"/g, '&quot;');
    return '<div class="rrap-preset' + (name === _activePreset ? ' rrap-preset-on' : '')
      + '" data-preset="' + esc + '">' + dots + name
      + (isUser ? ' <button class="rrap-del" type="button" title="Delete “' + esc + '”" aria-label="Delete ' + esc + '">✕</button>' : '')
      + '</div>';
  }

  // ── CSS. Every colour here is a var — the paper set (--p-*) is declared
  // once in app.css, the skin set (--bg, --accent…) only inside the stage.
  var CSS = ''
    + '#rrap{position:fixed;inset:0;z-index:100040;background:var(--p-paper);color:var(--p-ink);'
    +   'display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-body)}'
    + '.rrap-top{flex:none;background:var(--p-panel);border-bottom:1px solid var(--p-line);padding:0.7rem 1.1rem;display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap}'
    + '.rrap-top h2{font-family:var(--font-head);font-size:1.05rem;font-weight:600;color:var(--p-ink)}'
    + '.rrap-top .rrap-sub{font-size:0.7rem;color:var(--p-ink-dim)}'
    + '.rrap-actions{margin-left:auto;display:flex;gap:0.45rem;flex-wrap:wrap}'
    + '.rrap-btn{font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.05em;padding:0.5rem 0.85rem;border-radius:8px;border:1px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);cursor:pointer}'
    + '.rrap-btn:hover{border-color:var(--p-ink-mid)}'
    + '.rrap-btn.rrap-primary{background:var(--p-accent);border-color:var(--p-accent);color:var(--p-panel);font-weight:600}'
    + '.rrap-main{flex:1;display:flex;min-height:0}'
    // left: the control panel (logo tile → swatches → roles)
    + '.rrap-left{flex:none;width:252px;background:var(--p-panel);border-right:1px solid var(--p-line);padding:0.85rem;overflow-y:auto;display:flex;flex-direction:column;gap:0.85rem}'
    + '.rrap-lh{font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--p-ink-dim)}'
    + '.rrap-bottom{flex:none;display:flex;flex-direction:column;align-items:center;gap:0.55rem;'
    +   'background:var(--p-panel);border-top:1px solid var(--p-line);padding:0.7rem 1.1rem}'
    + '.rrap-bsec{min-width:0;width:100%;max-width:940px;text-align:center}'
    + '.rrap-bgrow{width:100%;max-width:940px}'
    + '.rrap-tiles{display:flex;gap:1rem;justify-content:space-between;width:100%}'
    + '.rrap-tilewrap{display:flex;flex-direction:column;gap:0.3rem;width:172px;flex:none;text-align:center}'
    + '.rrap-tlabel{font-size:0.63rem;line-height:1.2;color:var(--p-ink)}'
    + '.rrap-tlabel b{display:block;font-size:0.68rem}'
    + '.rrap-tlabel span{color:var(--p-ink-dim);font-size:0.56rem}'
    + '.rrap-logotile.rrap-tileon{border-style:solid;border-color:var(--p-accent);box-shadow:0 0 0 2px var(--p-paper),0 0 0 4px var(--p-accent)}'
    + '.rrap-tin{width:100%;box-sizing:border-box;padding:0.45rem 0.6rem;border-radius:8px;border:1.5px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);font-family:var(--font-body);font-size:0.8rem;margin-bottom:0.35rem}'
    + '.rrap-tsel{width:100%;box-sizing:border-box;padding:0.4rem 0.5rem;border-radius:8px;border:1.5px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);font-size:0.76rem;margin-bottom:0.35rem}'
    + '.rrap-trow{display:flex;align-items:flex-end;justify-content:center;gap:0.45rem;flex-wrap:wrap}'+ '.rrap-fld{flex:1;min-width:150px;display:flex;flex-direction:column;gap:0.15rem;text-align:left}'+ '.rrap-trow .rrap-rc{width:64px;height:32px}'+ '.rrap-wmwrap{display:block;margin-top:0.35rem;text-align:left}'
    + '.rrap-wm{width:100%;accent-color:var(--p-accent);cursor:pointer}'
    + '.rrap-tbtn{width:30px;height:30px;border-radius:7px;border:1.5px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);font-size:0.85rem;cursor:pointer;padding:0}'
    + '.rrap-tbtn.rrap-ton{border-color:var(--p-accent);background:var(--p-accent);color:var(--p-panel)}'
    + '.rrap-flab{font-size:0.58rem;letter-spacing:0.07em;text-transform:uppercase;color:var(--p-ink-dim)}'
    + '.rrap-rhead{position:absolute;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:5px;max-width:60%;overflow:hidden;white-space:nowrap;pointer-events:none}'
    + '.rrap-rside{margin-top:auto;padding-top:10px;display:flex;justify-content:center}'
    + '.rrap-side{display:flex;flex-direction:column}'
    + '.rrap-logotile{width:100%;aspect-ratio:1/1;border:2px dashed var(--p-line-hi);border-radius:14px;background:var(--p-panel2);'
    +   'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem;padding:0.8rem;text-align:center;cursor:pointer;overflow:hidden}'
    + '.rrap-logotile:hover,.rrap-logotile.rrap-over{border-color:var(--p-accent);background:var(--p-panel)}'
    + '.rrap-logotile .rrap-tiletxt{font-size:0.66rem}'
    + '.rrap-logotile img{max-width:100%;max-height:100%;object-fit:contain}'
    + '.rrap-tileicon{font-size:1.9rem;line-height:1}'
    + '.rrap-tiletxt{font-size:0.72rem;color:var(--p-ink-mid);line-height:1.35}'
    + '.rrap-lnote{font-size:0.66rem;color:var(--p-ink-dim);line-height:1.35}'
    // A short window is still a desktop. Rather than let the colour box
    // start scrolling, the strip and the rows give back the few dozen
    // pixels they can spare.
    + '@media (max-height:800px){'
    +   '.rrap-tilewrap{width:104px}'
    +   '.rrap-role{padding:0.26rem 0.45rem;margin-bottom:0.2rem}'
    +   '.rrap-bottom{padding:0.45rem 1.1rem;gap:0.35rem}'
    +   '.rrap-tiles{gap:0.6rem}'
    +   '.rrap-bottom .rrap-hint,.rrap-bottom .rrap-lnote{display:none}'
    +   '.rrap-tlabel span{display:none}'
    +   '.rrap-top .rrap-sub{display:none}'
    + '}'
    + '.rrap-lbtns{display:flex;gap:0.3rem;flex-wrap:wrap}'
    + '.rrap-lbtn{font-size:0.66rem;padding:0.32rem 0.55rem;border-radius:7px;border:1px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);cursor:pointer}'
    + '.rrap-lbtn.rrap-lon{border-color:var(--p-accent);color:var(--p-accent);font-weight:600}'
    // swatches + roles
    + '.rrap-sw{display:flex;flex-wrap:wrap;gap:0.35rem}'
    + '.rrap-swb{width:32px;height:32px;border-radius:8px;border:2px solid var(--p-line);cursor:pointer;padding:0}'
    + '.rrap-swb.rrap-armed{border-color:var(--p-ink);box-shadow:0 0 0 2px var(--p-paper),0 0 0 4px var(--p-ink)}'
    + '.rrap-hint{font-size:0.66rem;color:var(--p-ink-dim);line-height:1.4}'
    + '.rrap-role{display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;margin-bottom:0.3rem;border-radius:9px;border:1px solid var(--p-line);background:var(--p-panel2);cursor:pointer}'
    + '.rrap-role:hover{border-color:var(--p-accent)}'
    + '.rrap-role.rrap-ready{border-color:var(--p-accent);border-style:dashed}'
    + '.rrap-rc{position:relative;width:30px;height:24px;flex:none}'
    + '.rrap-role input[type=color]{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}'
    + '.rrap-rcface{position:absolute;inset:0;border-radius:6px;border:1.5px solid var(--p-line-hi);pointer-events:none}'
    + '.rrap-rl{font-size:0.7rem;line-height:1.25;color:var(--p-ink)}'
    + '.rrap-rl b{display:block;font-size:0.75rem}'
    + '.rrap-rl span{color:var(--p-ink-dim);font-size:0.62rem}'
    // right: presets, tabs, the fitted stage
    + '.rrap-right{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}'
    + '.rrap-presets{flex:none;display:flex;gap:0.5rem;padding:0.6rem 1.1rem;border-bottom:1px solid var(--p-line);overflow-x:auto}'
    + '.rrap-preset{flex:none;display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;border-radius:999px;border:1.5px solid var(--p-line);background:var(--p-panel);cursor:pointer;font-size:0.75rem;color:var(--p-ink-mid);white-space:nowrap}'
    + '.rrap-preset:hover{border-color:var(--p-accent)}'
    + '.rrap-preset-on{border-color:var(--p-accent);border-width:2px;background:var(--p-panel2);color:var(--p-ink);font-weight:600;box-shadow:0 0 0 3px color-mix(in srgb,var(--p-accent) 22%,transparent)}'
    + '.rrap-d{width:10px;height:10px;border-radius:50%;border:1px solid var(--p-line-hi);display:inline-block}'
    + '.rrap-del{margin-left:0.3rem;width:18px;height:18px;line-height:1;border-radius:50%;border:1px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink-mid);font-size:0.62rem;cursor:pointer;padding:0;flex:none}'
    + '.rrap-del:hover{border-color:var(--p-accent);color:var(--p-accent)}'
    + '.rrap-addp{border-style:dashed;color:var(--p-ink-dim)}'
    + '.rrap-tabs{flex:none;display:flex;gap:0.35rem;padding:0.7rem 1.1rem 0}'
    + '.rrap-tab{font-family:var(--font-head);font-size:0.74rem;letter-spacing:0.05em;padding:0.5rem 0.9rem;border-radius:9px 9px 0 0;border:1px solid var(--p-line);border-bottom:none;background:var(--p-panel2);color:var(--p-ink-dim);cursor:pointer}'
    + '.rrap-tab.rrap-on{background:var(--p-panel);color:var(--p-ink);border-color:var(--p-line-hi);font-weight:600}'
    // The wrapper clips; the stage scales to fit inside it. Brad: "size the
    // box with the app background in such a way that there is not scrolling."
    + '.rrap-stagewrap{flex:1;min-height:0;overflow:hidden;padding:1.1rem;display:flex;align-items:center;justify-content:center}'
    + '.rrap-stage{position:relative;box-sizing:border-box;width:100%;min-width:760px;border:1px solid var(--p-line-hi);border-radius:0 14px 14px 14px;background:var(--p-panel2);padding:22px;transform-origin:center}'
    + '.rrap-scene{display:none}.rrap-scene.rrap-on{display:block}'
    + '.rrap-cs{position:relative;width:30px;height:24px;flex:none}'
    + '.rrap-cface{position:absolute;inset:0;border-radius:6px;border:1.5px solid var(--p-line-hi);pointer-events:none}'
    + '.rrap-cl{font-size:0.6rem;line-height:1.2;color:var(--p-ink);min-width:0}'
    + '.rrap-cl b{display:block;font-size:0.67rem}'
    + '.rrap-cl span{display:block;color:var(--p-ink-dim);font-size:0.54rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.rrap-stage{cursor:pointer}'
    + '.rrap-hl{outline:2px dashed var(--p-accent) !important;outline-offset:1px}'
    + '#rrap-tip{position:fixed;z-index:100062;pointer-events:none;background:var(--p-panel);color:var(--p-ink);'
    +   'border:1px solid var(--p-line-hi);border-radius:9px;padding:0.3rem 0.55rem;font-family:var(--font-body);'
    +   'font-size:0.7rem;line-height:1.25;box-shadow:0 6px 20px var(--scrim)}'
    + '#rrap-tip b{display:block;font-size:0.76rem}'
    + '#rrap-tip span{color:var(--p-ink-dim);font-size:0.62rem}'
    + '#rrap-what{position:fixed;z-index:100061;background:var(--p-panel);color:var(--p-ink);'
    +   'border:1px solid var(--p-line-hi);border-radius:12px;padding:0.45rem;min-width:190px;'
    +   'font-family:var(--font-body);box-shadow:0 12px 34px var(--scrim)}'
    + '.rrap-whatlab{font-size:0.58rem;letter-spacing:0.07em;text-transform:uppercase;color:var(--p-ink-dim);padding:0.15rem 0.4rem 0.35rem}'
    + '.rrap-whatbtn{display:flex;align-items:center;gap:0.5rem;width:100%;text-align:left;padding:0.35rem 0.4rem;'
    +   'border:none;background:none;color:var(--p-ink);font-family:var(--font-body);font-size:0.76rem;cursor:pointer;border-radius:8px}'
    + '.rrap-whatbtn:hover{background:var(--p-panel2)}'
    + '.rrap-whatbtn b{display:block}'
    + '.rrap-whatbtn span span{display:block;color:var(--p-ink-dim);font-size:0.62rem}'
    + '.rrap-whatsw{width:20px;height:20px;border-radius:5px;border:1px solid var(--p-line);flex:none}'
    // the shared colour picker
    + '#rrap-pal{position:fixed;z-index:100060;background:var(--p-panel);color:var(--p-ink);'
    +   'border:1px solid var(--p-line-hi);border-radius:12px;padding:0.6rem;'
    +   'box-shadow:0 12px 34px var(--scrim);font-family:var(--font-body)}'
    + '.rrap-palgrid{display:grid;grid-template-columns:repeat(10,22px);gap:3px}'
    + '.rrap-pallogo{grid-template-columns:repeat(auto-fit,22px)}'
    + '.rrap-palsw{width:22px;height:22px;border-radius:4px;border:1px solid var(--p-line);cursor:pointer;padding:0}'
    + '.rrap-palsw:hover{transform:scale(1.18);border-color:var(--p-ink)}'
    + '.rrap-palsw.rrap-palon{outline:2px solid var(--p-ink);outline-offset:1px}'
    + '.rrap-pallab{font-size:0.58rem;letter-spacing:0.07em;text-transform:uppercase;color:var(--p-ink-dim);margin:0.5rem 0 0.2rem}'
    + '.rrap-palbtn{display:block;width:100%;margin:0.45rem 0 0;padding:0.4rem 0.6rem;border-radius:8px;'
    +   'border:1px solid var(--p-line-hi);background:var(--p-panel2);color:var(--p-ink);font-size:0.74rem;cursor:pointer}'
    + '.rrap-palbtn:hover{border-color:var(--p-accent)}'
    + '#rrap-pal .rrap-palbtn:first-child{margin:0 0 0.5rem}'
    + '#rrap-palnative{position:absolute;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none}'
    // replica — these DO read the skin variables, which is the point
    + '.rrap-app{background:var(--bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;font-size:13px}'
    + '.rrap-apph{position:relative;display:flex;align-items:center;background:var(--surface);border-bottom:1px solid var(--border);padding:9px 13px}'
    + '.rrap-logo{font-family:var(--font-head);font-weight:700;letter-spacing:0.04em;color:var(--text)}'
    + '.rrap-logo i{color:var(--accent);font-style:normal}'
    + '.rrap-body{display:flex}'
    + '.rrap-side{width:130px;background:var(--surface);border-right:1px solid var(--border);padding:8px;flex:none}'
    + '.rrap-nav{padding:6px 9px;border-radius:7px;color:var(--text-mid);font-size:0.7rem;margin-bottom:2px}'
    + '.rrap-side .rrap-nav{color:var(--text-mid)}'
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
    + '.rrap-wbtn{font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.05em;padding:7px 12px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text)}'
    + '.rrap-go{background:var(--accent);border-color:var(--accent);color:var(--text);font-weight:600}'
    // the Preview bar — lives OUTSIDE #rrap, so it carries its own paper vars
    + '#rrap-prevbar{position:fixed;left:50%;bottom:1.1rem;transform:translateX(-50%);z-index:100050;'
    +   'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;justify-content:center;max-width:94vw;'
    +   'background:var(--p-panel);color:var(--p-ink);border:1px solid var(--p-line-hi);border-radius:14px;'
    +   'padding:0.6rem 0.85rem;box-shadow:0 10px 34px rgba(0,0,0,0.4);font-family:var(--font-body)}'
    + '#rrap-prevbar .rrap-pvt{font-size:0.74rem;color:var(--p-ink-mid);max-width:280px;line-height:1.35}'
    // the phone sheet — presets only
    + '#rrap-mini{position:fixed;inset:0;z-index:100040;background:var(--p-paper);color:var(--p-ink);overflow-y:auto;padding:1.1rem;font-family:var(--font-body)}'
    + '#rrap-mini h2{font-family:var(--font-head);font-size:1.05rem;margin-bottom:0.2rem}'
    + '#rrap-mini .rrap-preset{margin-bottom:0.5rem;width:100%;justify-content:flex-start;padding:0.7rem 0.9rem;border-radius:12px}';

  // ═══ the editor ═══════════════════════════════════════════════
  window.openAppearance = function () {
    if (typeof APPEARANCE_ENABLED !== 'undefined' && !APPEARANCE_ENABLED) return;
    _ensureCss();
    if (!_canEdit()) { _openMini(); return; }

    var old = document.getElementById('rrap'); if (old) old.remove();
    // A draft left behind by a tab that closed mid-edit is not a candidate,
    // it is litter. Every session starts from what is actually saved.
    _live = {}; _saved = false; _armed = -1; _preview = false; _scale = 1; _activePreset = '';
    _dropDraft();
    _swatches = _savedSwatches();

    var ov = document.createElement('div'); ov.id = 'rrap';
    ov.innerHTML =
      '<div class="rrap-top"><div><h2>🎨 Appearance</h2>'
      + '<div class="rrap-sub">Point at the picture to see what a colour controls, then click to change it. Nothing changes in the app until you press Preview.</div></div>'
      + '<div class="rrap-actions">'
      + '<button class="rrap-btn" onclick="window._rrapReset()">Reset to Default</button>'
      + '<button class="rrap-btn" onclick="window._rrapExport()">Export</button>'
      + '<button class="rrap-btn" onclick="window._rrapImport()">Import…</button>'
      + '<button class="rrap-btn" onclick="window._rrapClose(false)">Cancel</button>'
      + '<button class="rrap-btn rrap-primary" onclick="window._rrapPreview()">👁 Preview in the app</button>'
      + '</div></div>'
      + '<div class="rrap-main">'
      +  '<div class="rrap-left" id="rrap-colourbox">' + _leftPanelHtml() + '</div>'
      +  '<div class="rrap-right">'
      +   '<div class="rrap-presets" id="rrap-presets">' + _presetPills() + '</div>'
      +   '<div class="rrap-tabs">'
      +    '<div class="rrap-tab rrap-on" data-scene="dash">📊 Dashboard</div>'
      +    '<div class="rrap-tab" data-scene="wiz">🪟 Add Item Pop-up</div>'
      +   '</div>'
      +   '<div class="rrap-stagewrap"><div class="rrap-stage" id="rrap-stage">'
      +    _sceneDash() + _sceneWiz()
      +   '</div></div>'
      +  '</div>'
      + '</div>'
      + '<div class="rrap-bottom" id="rrap-logobar">' + _bottomPanelHtml() + '</div>';
    document.body.appendChild(ov);
    if (window.BackStack && BackStack.wire) BackStack.wire(ov);

    ov.querySelectorAll('.rrap-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        ov.querySelectorAll('.rrap-tab').forEach(function (x) { x.classList.toggle('rrap-on', x === t); });
        ov.querySelectorAll('.rrap-scene').forEach(function (s) { s.classList.toggle('rrap-on', s.id === 'rrap-scene-' + t.dataset.scene); });
        requestAnimationFrame(_relayout);
      });
    });
    // presets (delegated so refreshed pills keep working)
    document.getElementById('rrap-presets').addEventListener('click', function (e) {
      var del = e.target.closest('.rrap-del');
      var pill = e.target.closest('.rrap-preset[data-preset]');
      if (del && pill) {
        var nm = pill.dataset.preset;
        var drop = function () {
          var up = _userPresets(); delete up[nm];
          try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(up)); } catch (e2) {}
          if (_activePreset === nm) _activePreset = '';
          _refreshPresets();
          if (typeof showToast === 'function') showToast('“' + nm + '” deleted', 2600);
        };
        if (typeof appConfirm === 'function') {
          appConfirm('Delete the saved look “' + nm + '”? The colours you are using now are not affected.',
            { title: 'Delete saved look', ok: 'Delete', danger: true })
            .then(function (yes) { if (yes) drop(); });
        } else drop();
        return;
      }
      if (!pill) return;
      var map = BUILTIN_PRESETS[pill.dataset.preset] || _userPresets()[pill.dataset.preset];
      if (map) {
        _loadingPreset = true;
        Object.keys(map).forEach(function (k) { _set(k, map[k]); });
        _loadingPreset = false;
        _activePreset = pill.dataset.preset;
        _refreshPanel();
        _refreshPresets();
      }
    });

    _wireLogoInput();
    document.addEventListener('paste', _onPaste);
    document.addEventListener('dragover', _onDrag);
    document.addEventListener('dragleave', _onDrag);
    document.addEventListener('drop', _onDrop);

    var stg = document.getElementById('rrap-stage');
    if (stg) {
      stg.addEventListener('mousemove', _onStageMove);
      stg.addEventListener('mouseleave', _onStageLeave);
      stg.addEventListener('click', _onStageClick);
    }
    window.addEventListener('resize', _onResize);
    requestAnimationFrame(_relayout);
    setTimeout(_relayout, 300);
  };

  function _ensureCss() {
    if (!document.getElementById('rrap-css')) {
      var st = document.createElement('style'); st.id = 'rrap-css'; st.textContent = CSS;
      document.head.appendChild(st);
    }
  }

  // "Back to default" for one variable: drop this session's override and let
  // whatever the app is actually wearing show through again.
  function _resetVar(v) {
    delete _live[v];
    var st = _stage();
    if (st) st.style.removeProperty(v);
    if (_preview) _root.style.removeProperty(v);
    _refreshPanel();
  }

  // ── the phone sheet: presets only ────────────────────────────────
  function _openMini() {
    var old = document.getElementById('rrap-mini'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'rrap-mini';
    el.innerHTML = '<h2>🎨 Appearance</h2>'
      + '<div style="font-size:0.75rem;color:var(--p-ink-dim);line-height:1.5;margin-bottom:0.9rem">'
      + 'Designing a skin needs the room of a desktop screen. Here you can pick one that is already made — it applies straight away.</div>'
      + '<div id="rrap-minilist">' + _presetPills().replace(/<div class="rrap-preset rrap-addp"[\s\S]*?<\/div>/, '') + '</div>'
      + '<button class="rrap-btn" style="width:100%;margin-top:0.9rem" onclick="var m=document.getElementById(\'rrap-mini\');if(m)m.remove()">Close</button>';
    document.body.appendChild(el);
    if (window.BackStack && BackStack.wire) BackStack.wire(el);
    el.querySelector('#rrap-minilist').addEventListener('click', function (e) {
      var pill = e.target.closest('.rrap-preset[data-preset]'); if (!pill) return;
      var map = BUILTIN_PRESETS[pill.dataset.preset] || _userPresets()[pill.dataset.preset];
      if (!map) return;
      _persist(map);
      if (typeof applyTheme === 'function') applyTheme();
      if (typeof showToast === 'function') showToast(pill.dataset.preset + ' applied', 2600);
    });
  }

  function _onResize() { if (document.getElementById('rrap')) _relayout(); }

  // Measure unscaled, then scale. Doing it in this order means _layout never
  // has to know about the transform.
  function _relayout() {
    var st = _stage(); if (!st) return;
    st.style.transform = 'none';
    _scale = 1;
    _fitStage();
  }

  function _fitStage() {
    var wrap = document.querySelector('.rrap-stagewrap'), st = _stage();
    if (!wrap || !st) return;
    // What the stage really occupies, chips included. offsetWidth is the
    // padding box only — an absolutely-positioned chip that overhangs it is
    // invisible to the fit, and gets clipped instead of scaled.
    var sw = Math.max(st.offsetWidth, st.scrollWidth);
    var sh = Math.max(st.offsetHeight, st.scrollHeight);
    // …and what the wrapper really OFFERS. clientWidth includes the
    // wrapper's own padding, so fitting to it overhangs by exactly that
    // padding — which is how the right-hand chips ended up cut off the
    // screen at 1200px wide while looking fine at 1900.
    var cs = getComputedStyle(wrap);
    var px = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var py = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var aw = wrap.clientWidth - px, ah = wrap.clientHeight - py;
    if (!sw || !sh || aw <= 0 || ah <= 0) return;
    _scale = Math.min(1, aw / sw, ah / sh);
    st.style.transform = 'scale(' + _scale + ')';
  }


  // ── logo → palette (v0.9.1149) ──────────────────────────────────
  // Pure pixel math — no AI, no network. See the note at LOGO_KEY.

  function _rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
  }
  function _hsl2hex(h, s, l) {
    var f = function (n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }

  // ── logo image prep (v0.9.1205) ─────────────────────────────────
  // Brad: "shrink whatever gets pasted… also worth auto-trimming the white
  // box that surrounds most logos people copy off the web."
  //
  // Everything from _rgb2hsl above down to "end logo image prep" is PURE
  // math on numbers and flat RGBA arrays — no canvas, no document, no
  // window. That is on purpose: the test suite runs these exact functions,
  // so the behaviour that ships is the behaviour that was proved. The canvas
  // wrapper below only feeds them pixels and draws the answer.

  // Fit a box inside a square limit. Never upscales — a 90px herald stays
  // 90px rather than being blown up into mush.
  function _rrFitDims(w, h, max) {
    w = Math.max(1, Math.round(w || 0));
    h = Math.max(1, Math.round(h || 0));
    var sc = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * sc)), h: Math.max(1, Math.round(h * sc)) };
  }

  // Find the real mark inside the white (or transparent) box it was copied
  // in. The border ring decides what "background" means — if the ring is not
  // near-uniform the image bleeds to its own edge (a photograph), and we
  // trim NOTHING rather than guess. A crop that eats the logo is far worse
  // than a crop that never happens.
  function _rrTrimBox(px, w, h) {
    var full = { x: 0, y: 0, w: w, h: h, trimmed: false };
    if (!px || !(w >= 4) || !(h >= 4)) return full;
    var TOL = 18, i, x, y;
    var at = function (xx, yy) { return (yy * w + xx) * 4; };

    var ring = [];
    for (x = 0; x < w; x++) { ring.push(at(x, 0)); ring.push(at(x, h - 1)); }
    for (y = 1; y < h - 1; y++) { ring.push(at(0, y)); ring.push(at(w - 1, y)); }

    var clear = 0, sr = 0, sg = 0, sb = 0, solid = 0;
    for (i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (px[p + 3] < 16) { clear++; continue; }
      sr += px[p]; sg += px[p + 1]; sb += px[p + 2]; solid++;
    }
    var clearBg = (clear / ring.length) >= 0.9;
    var br = solid ? sr / solid : 0, bg = solid ? sg / solid : 0, bb = solid ? sb / solid : 0;
    if (!clearBg) {
      if (!solid) return full;
      var near = 0;
      for (i = 0; i < ring.length; i++) {
        var q = ring[i];
        if (px[q + 3] < 16) { near++; continue; }
        if (Math.abs(px[q] - br) <= TOL && Math.abs(px[q + 1] - bg) <= TOL &&
            Math.abs(px[q + 2] - bb) <= TOL) near++;
      }
      if ((near / ring.length) < 0.9) return full;   // bleeds to the edge — nothing to trim
    }

    var isBg = function (p) {
      if (px[p + 3] < 16) return true;
      if (clearBg) return false;
      return Math.abs(px[p] - br) <= TOL && Math.abs(px[p + 1] - bg) <= TOL &&
             Math.abs(px[p + 2] - bb) <= TOL;
    };
    var rowBg = function (yy) { for (var xx = 0; xx < w; xx++) if (!isBg(at(xx, yy))) return false; return true; };
    var colBg = function (xx) { for (var yy = 0; yy < h; yy++) if (!isBg(at(xx, yy))) return false; return true; };

    var t = 0, b = h - 1, l = 0, r = w - 1;
    while (t < b && rowBg(t)) t++;
    while (b > t && rowBg(b)) b--;
    while (l < r && colBg(l)) l++;
    while (r > l && colBg(r)) r--;

    var bw = r - l + 1, bh = b - t + 1;
    if (bw < 4 || bh < 4) return full;                  // trimmed to nothing — keep the original
    if (bw * bh < w * h * 0.01) return full;            // suspiciously aggressive — keep the original
    if (bw === w && bh === h) return full;              // nothing to do

    var pad = Math.max(1, Math.round(Math.min(bw, bh) * 0.02));
    var nx = Math.max(0, l - pad), ny = Math.max(0, t - pad);
    var nr = Math.min(w - 1, r + pad), nb = Math.min(h - 1, b + pad);
    return { x: nx, y: ny, w: nr - nx + 1, h: nb - ny + 1, trimmed: true };
  }

  // Flat herald or photograph? A Santa Fe cross is a handful of flat colors;
  // a Big Boy poster is thousands. The top six colors' share of the picture
  // separates them cleanly, and the answer is told to the user in plain
  // words rather than discovered later as disappointment.
  function _rrClassifyPixels(px) {
    var buckets = {}, total = 0, i;
    for (i = 0; i + 3 < px.length; i += 4) {
      if (px[i + 3] < 128) continue;                    // transparent pixels are not colors
      var k = (px[i] >> 3) + ',' + (px[i + 1] >> 3) + ',' + (px[i + 2] >> 3);
      buckets[k] = (buckets[k] || 0) + 1; total++;
    }
    if (!total) return { kind: 'photo', top6: 0, colors: 0 };
    var counts = Object.keys(buckets).map(function (k) { return buckets[k]; })
                       .sort(function (a, b) { return b - a; });
    var top6 = counts.slice(0, 6).reduce(function (a, b) { return a + b; }, 0) / total;
    return {
      kind: top6 >= 0.60 ? 'herald' : (top6 >= 0.35 ? 'mixed' : 'photo'),
      top6: top6, colors: counts.length
    };
  }

  function _rrHasAlpha(px) {
    for (var i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
    return false;
  }

  function _rrLogoNote(kind) {
    if (kind === 'herald') return 'Clean logo — it will stay sharp wherever it is shown.';
    if (kind === 'mixed')  return 'Part logo, part picture — good as a background, a little soft when small.';
    return 'This is a photograph, not a flat logo — fine as a background, but fuzzy when small.';
  }

  function _rrHexToHsl(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex == null ? '' : hex).trim());
    if (!m) return [0, 0, 0];
    var v = parseInt(m[1], 16);
    return _rgb2hsl((v >> 16) & 255, (v >> 8) & 255, v & 255);
  }

  // Relative luminance and contrast ratio, straight from the accessibility
  // definition. This is what stops a pale logo producing a pale skin with
  // pale writing on it — a look nobody can read and everybody blames on us.
  function _rrLum(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex == null ? '' : hex).trim());
    if (!m) return 0;
    var v = parseInt(m[1], 16);
    var ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(function (x) {
      x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function _rrContrast(a, b) {
    var la = _rrLum(a), lb = _rrLum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Keep the user's HUE, move only its lightness, until the writing is
  // readable on the background they chose. Returns the same colour when it
  // was already fine, so callers can compare and stay quiet.
  function _rrReadableText(bgHex, textHex) {
    if (_rrContrast(bgHex, textHex) >= 4.5) return textHex;
    var hsl = _rrHexToHsl(textHex);
    var lighten = _rrLum(bgHex) < 0.18;
    var l = hsl[2], step = lighten ? 0.04 : -0.04, i, cand;
    for (i = 0; i < 25; i++) {
      l = Math.min(1, Math.max(0, l + step));
      cand = _hsl2hex(hsl[0], hsl[1], l);
      if (_rrContrast(bgHex, cand) >= 4.5) return cand;
      if (l <= 0 || l >= 1) break;
    }
    return _hsl2hex(0, 0, lighten ? 1 : 0);   // white or black, without a literal
  }

  // The swatches offered in the colour-match box: the logo's own colours,
  // spread out so six near-identical creams can never fill the row.
  function _rrPickSwatches(cols, n) {
    var out = [], i, c;
    var far = function (a, b) {
      var dh = Math.abs(a.h - b.h); dh = Math.min(dh, 1 - dh);
      return (dh > 0.06) || (Math.abs(a.l - b.l) > 0.18) || (Math.abs(a.s - b.s) > 0.3);
    };
    for (i = 0; i < (cols || []).length && out.length < (n || 6); i++) {
      c = cols[i];
      if (!c || c.share < 0.005) continue;
      if (out.every(function (o) { return far(c, o); })) out.push(c);
    }
    return out.map(function (o) { return o.hex; });
  }

  // Dropping a colour on "Background" has to move its neighbours too, or the
  // panels and lines stay from the old skin and the result looks broken. The
  // ladder steps AWAY from the background's own lightness, so it works for a
  // cream background as well as a black one.
  // The typed header line's look, from the four things the user chose.
  // Pure, so the test suite can prove that an empty choice falls back to the
  // app's own headline face and cream rather than to nothing at all.
  function _rrTitleStyle(t) {
    t = t || {};
    var col = /^#[0-9a-fA-F]{6}$/.test(String(t.color || '')) ? t.color : 'var(--cream)';
    // Brad: "The text color is not showing up though selected."
    //
    // A font-family like  "Brush Script MT", cursive  carries DOUBLE quotes,
    // and this whole string is dropped into  style="…"  — so the first quote
    // ENDED the attribute and everything after it was thrown away: the
    // colour, the border, the lot. The text still appeared, in the default
    // style, which is why it looked like the colour was being ignored rather
    // than the markup being broken. Single quotes are safe inside a
    // double-quoted attribute, and this is the one place a font becomes CSS.
    var fam = String(t.font || '').replace(/"/g, "'") || 'var(--font-head)';
    // Sizes are keys, never free text — the value below reaches a style
    // attribute, and a map is the difference between a choice and an opening.
    var sizes = { s: '0.85rem', m: '1.05rem', l: '1.35rem', xl: '1.7rem' };
    var css = 'font-family:' + fam + ';color:' + col;
    if (sizes[t.size]) css += ';font-size:' + sizes[t.size];
    if (t.bold) css += ';font-weight:700';
    if (t.italic) css += ';font-style:italic';
    var b = t.border;
    if (b === 'rule')       css += ';border-bottom:2px solid ' + col + ';padding-bottom:2px';
    else if (b === 'over')  css += ';border-top:2px solid ' + col + ';padding-top:2px';
    else if (b === 'both')  css += ';border-top:2px solid ' + col + ';border-bottom:2px solid ' + col + ';padding:2px 0';
    else if (b === 'box')   css += ';border:2px solid ' + col + ';padding:2px 10px';
    else if (b === 'round') css += ';border:2px solid ' + col + ';padding:2px 12px;border-radius:999px';
    else if (b === 'left')  css += ';border-left:3px solid ' + col + ';padding-left:8px';
    else if (b === 'ends')  css += ';border-left:3px solid ' + col + ';border-right:3px solid ' + col + ';padding:0 8px';
    return css;
  }

  // Brad's red circle: the sidebar's menu labels never changed colour. They
  // read --text-mid, and the editor only ever set --text. Those two, plus
  // --text-dim, are not separate decisions — they ARE the text colour, faded
  // toward the background. Hundreds of places in the app use them, so the
  // moment --text moves they have to move with it or half the writing keeps
  // the old skin. 35% and 65% of the way to the background reproduces the
  // built-in themes' own values closely.
  function _rrDeriveText(textHex, bgHex) {
    var t = _rrHexToHsl(textHex), b = _rrHexToHsl(bgHex);
    var mix = function (f) {
      return _hsl2hex(t[0], t[1] * (1 - f * 0.5), t[2] + (b[2] - t[2]) * f);
    };
    return { '--text-mid': mix(0.35), '--text-dim': mix(0.65) };
  }

  function _rrDeriveFromBg(hex) {
    var hsl = _rrHexToHsl(hex), h = hsl[0], s = hsl[1], l = hsl[2];
    var dir = l < 0.5 ? 1 : -1;
    var at = function (d) { return _hsl2hex(h, s, Math.min(1, Math.max(0, l + dir * d))); };
    return { '--bg': hex, '--surface': at(0.05), '--surface2': at(0.09), '--border': at(0.16) };
  }
  // ── end logo image prep ─────────────────────────────────────────

  // Sample the image small, bucket similar colors, return the dominant
  // buckets with their average color + HSL + share of the pixels.
  // v0.9.1205: accepts a canvas as well as an <img>, so the palette is built
  // from the TRIMMED mark — the white box a logo was copied inside is no
  // longer half the pixels being averaged.
  function _extractColors(img) {
    var W = 64;
    var iw = img.naturalWidth || img.width || W, ih = img.naturalHeight || img.height || W;
    var cv = document.createElement('canvas');
    var ratio = Math.min(1, W / Math.max(iw, ih));
    cv.width = Math.max(1, Math.round(iw * ratio));
    cv.height = Math.max(1, Math.round(ih * ratio));
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    var d = cx.getImageData(0, 0, cv.width, cv.height).data;
    var buckets = {}, total = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;                        // transparent
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4); // 16-step buckets
      var bk = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
      bk.n++; bk.r += r; bk.g += g; bk.b += b; total++;
    }
    return Object.keys(buckets).map(function (k) {
      var bk = buckets[k];
      var r = Math.round(bk.r / bk.n), g = Math.round(bk.g / bk.n), b = Math.round(bk.b / bk.n);
      var hsl = _rgb2hsl(r, g, b);
      return { hex: '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1),
               h: hsl[0], s: hsl[1], l: hsl[2], share: bk.n / (total || 1) };
    }).sort(function (a, b) { return b.share - a.share; });
  }

  // Turn the dominant colors into a coherent skin. The brand hue drives the
  // dark backgrounds and the accent; the second distinct hue becomes the
  // gold slot. Status colors (green/want/forsale/purple) are LEFT ALONE —
  // "owned is green, wanted is blue" must survive any logo.
  function _paletteFromColors(cols) {
    var vivid = cols.filter(function (c) { return c.s > 0.25 && c.l > 0.12 && c.l < 0.9 && c.share > 0.01; });
    var accent = vivid.sort(function (a, b) { return (b.s * Math.sqrt(b.share)) - (a.s * Math.sqrt(a.share)); })[0];
    var second = accent && vivid.filter(function (c) {
      var dh = Math.abs(c.h - accent.h); dh = Math.min(dh, 1 - dh);
      return dh > 0.12;
    })[0];
    // A colorless logo (all grays) still makes a handsome neutral dark
    // theme, but the accents are left ALONE — inventing a hue that isn't
    // in the logo would be doing "whatever we want", not what was asked.
    var baseH = accent ? accent.h : (cols[0] ? cols[0].h : 0),
        baseS = accent ? Math.min(accent.s * 0.55, 0.5) : 0.04;
    var map = {
      '--bg':       _hsl2hex(baseH, baseS, 0.075),
      '--surface':  _hsl2hex(baseH, baseS, 0.125),
      '--surface2': _hsl2hex(baseH, baseS, 0.17),
      '--border':   _hsl2hex(baseH, baseS, 0.24),
      '--text':     _hsl2hex(baseH, accent ? 0.28 : 0.06, 0.9),
    };
    if (accent) {
      map['--accent'] = _hsl2hex(accent.h, Math.max(accent.s, 0.55), Math.min(Math.max(accent.l, 0.42), 0.58));
      map['--accent2'] = second ? _hsl2hex(second.h, Math.max(second.s, 0.4), Math.min(Math.max(second.l, 0.55), 0.72))
                                : _hsl2hex(baseH, 0.45, 0.68);
    }
    return map;
  }

  // Reading a logo's colours and IMPOSING them are two different things.
  // Brad: "when you upload a logo, i know i said to auto suggest, don't…
  // cause if you want to load a logo, it changes everything before you save."
  // Quite right — dropping in a mark should not silently repaint a look you
  // have spent ten minutes on. Reading fills the swatch row, which is only an
  // offer; applying is a decision, and it is now asked for.
  function _readLogoColours(img) {
    var cols = _extractColors(img);
    _swatches = _rrPickSwatches(cols, 6);
    _armed = -1;
    return _paletteFromColors(cols);
  }
  // Still used by the 🎨 button on a filled tile — pressing that IS the
  // request, so it applies without asking again.
  function _applyLogoPalette(img, kind) {
    var map = _readLogoColours(img);
    Object.keys(map).forEach(function (k) { _set(k, map[k]); });
    if (typeof showToast === 'function') {
      showToast('Colours taken from your logo — point at the picture to adjust any of them'
        + (kind ? '. ' + _rrLogoNote(kind) : ''), 5000);
    }
  }

  // ── point at the thing you want to change (v0.9.1220) ───────────
  // Brad: "it would be kind of nice if i just hovered over certain areas and
  // it hightlights all the area that would change if i picked it. Then let me
  // click it, and the color picker pops up. Then we can get rid of the 'text',
  // 'sale orange' boxes and lines. it would be cleaner and easier to adjust
  // what you want."
  //
  // He is right, and it deleted more code than it added: the chips, the
  // leader lines, the docking rule, the column balancing and the spreading
  // are all gone, and with them the 208px gutters they needed — so the
  // preview is now nearly twice the size it was.
  //
  // Every part of the replica already carried a data-c saying which variable
  // paints it, for the old hover-highlight. That annotation is now the whole
  // mechanism.
  //
  // The one hard part is small targets: Lines is a one-pixel border. So a
  // click does not take whatever happens to be on top — it collects EVERY
  // annotated thing under the pointer and, when there is more than one, asks.
  // A hairline is never something you have to hit exactly.
  var _hoverVar = '';

  function _varOf(el) {
    var k = el && el.dataset && el.dataset.c;
    return k ? ('--' + k) : '';
  }
  // Innermost first: the most specific thing under the pointer is the one a
  // person means, and the rest are the fallbacks the chooser offers.
  function _regionsAt(x, y) {
    var stage = _stage(); if (!stage) return [];
    var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    var out = [], seen = {};
    for (var i = 0; i < els.length; i++) {
      if (!stage.contains(els[i])) continue;
      var v = _varOf(els[i]);
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out;
  }
  function _labelFor(v) {
    var d = EDIT_VARS.filter(function (e) { return e[0] === v; })[0];
    if (d) return { name: d[1], sub: d[2] };
    return { name: v.replace('--', ''), sub: '' };
  }
  function _highlight(v) {
    var stage = _stage(); if (!stage) return;
    if (_hoverVar === v) return;
    _hoverVar = v;
    stage.querySelectorAll('.rrap-hl').forEach(function (e) { e.classList.remove('rrap-hl'); });
    var tip = document.getElementById('rrap-tip');
    if (!v) { if (tip) tip.remove(); return; }
    stage.querySelectorAll('[data-c="' + v.replace('--', '') + '"]')
      .forEach(function (e) { e.classList.add('rrap-hl'); });
    if (!tip) { tip = document.createElement('div'); tip.id = 'rrap-tip'; document.body.appendChild(tip); }
    var l = _labelFor(v);
    tip.innerHTML = '<b>' + l.name + '</b>' + (l.sub ? '<span>' + l.sub + '</span>' : '');
  }
  function _onStageMove(e) {
    var regions = _regionsAt(e.clientX, e.clientY);
    _highlight(regions[0] || '');
    var tip = document.getElementById('rrap-tip');
    if (tip) {
      var b = tip.getBoundingClientRect();
      tip.style.left = Math.round(Math.min(e.clientX + 14, window.innerWidth - b.width - 8)) + 'px';
      tip.style.top = Math.round(Math.max(8, e.clientY - b.height - 12)) + 'px';
    }
  }
  function _onStageLeave() { _highlight(''); }

  function _pickVar(v) {
    var stage = _stage();
    var el = stage && stage.querySelector('[data-c="' + v.replace('--', '') + '"]');
    _openPal(el || stage, _cur(v), function (hex) {
      _set(v, hex); _refreshPanel();
    }, function () { _resetVar(v); });
  }

  function _onStageClick(e) {
    var regions = _regionsAt(e.clientX, e.clientY);
    if (!regions.length) return;
    if (regions.length === 1) { _pickVar(regions[0]); return; }
    // More than one thing here — ask, rather than guess and be wrong on a
    // one-pixel border.
    var old = document.getElementById('rrap-what'); if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'rrap-what';
    box.innerHTML = '<div class="rrap-whatlab">What did you mean?</div>'
      + regions.map(function (v) {
          var l = _labelFor(v);
          return '<button class="rrap-whatbtn" onmouseenter="window._rrapWhatHover(\'' + v + '\')"'
            + ' onclick="window._rrapWhatPick(\'' + v + '\')">'
            + '<span class="rrap-whatsw" style="background:' + (_cur(v) || NO_COLOUR) + '"></span>'
            + '<span><b>' + l.name + '</b>' + (l.sub ? '<span>' + l.sub + '</span>' : '') + '</span></button>';
        }).join('');
    document.body.appendChild(box);
    var b = box.getBoundingClientRect();
    box.style.left = Math.round(Math.min(e.clientX + 8, window.innerWidth - b.width - 8)) + 'px';
    box.style.top = Math.round(Math.min(e.clientY + 8, window.innerHeight - b.height - 8)) + 'px';
    setTimeout(function () { document.addEventListener('mousedown', _whatAway); }, 0);
  }
  function _whatAway(ev) {
    var w = document.getElementById('rrap-what');
    if (w && !w.contains(ev.target)) { document.removeEventListener('mousedown', _whatAway); _closeWhat(); }
  }
  function _closeWhat() {
    var w = document.getElementById('rrap-what'); if (w) w.remove();
  }
  window._rrapWhatHover = function (v) { _highlight(v); };
  window._rrapWhatPick = function (v) { _closeWhat(); _pickVar(v); };

  // ── the colour picker (v0.9.1218) ───────────────────────────────
  // Brad, after clicking a colour box and getting the browser's own picker:
  // "this is hard for a user to get the color they want, i am think
  // something along these lines" — and a picture of a swatch grid.
  //
  // He is right. A saturation square and three numbers is a tool for someone
  // who already knows the colour they want in RGB. A grid is a tool for
  // someone who wants "a darker green". So: one grid, used by EVERY colour
  // control in this editor — the chips on the picture, the five jobs, and
  // the header line. One picker means one answer to "how do I choose a
  // colour", and the browser's own is still one click away for anyone who
  // does want to type numbers.
  //
  // Every swatch is COMPUTED, not listed. That keeps the no-hardcoded-colour
  // rule honest and means the grid is described by the two arrays below
  // rather than by sixty literals somebody would have to keep consistent.
  var PAL_HUES  = [0, 0.07, 0.12, 0.18, 0.33, 0.47, 0.55, 0.62, 0.72, 0.85];
  var PAL_LIGHT = [0.86, 0.72, 0.58, 0.46, 0.34, 0.22];

  function _palRows() {
    var rows = [];
    // A greyscale row first: black through white, the row people reach for.
    rows.push([0, 0.13, 0.26, 0.39, 0.52, 0.63, 0.74, 0.84, 0.93, 1]
      .map(function (l) { return _hsl2hex(0, 0, l); }));
    PAL_LIGHT.forEach(function (l) {
      rows.push(PAL_HUES.map(function (h) {
        return _hsl2hex(h, l > 0.75 ? 0.55 : (l < 0.3 ? 0.62 : 0.72), l);
      }));
    });
    return rows;
  }

  var _palCb = null;      // what to do with the colour that gets picked
  var _palReset = null;   // what "Reset" means for the control that opened it

  function _closePal() {
    var p = document.getElementById('rrap-pal');
    if (p) p.remove();
    _palCb = null; _palReset = null;
  }

  // anchor: the element clicked, so the grid opens beside it rather than in
  // the middle of the screen where it would cover the thing being changed.
  function _openPal(anchorEl, current, onPick, onReset) {
    _closePal();
    _palCb = onPick; _palReset = onReset || null;
    var el = document.createElement('div');
    el.id = 'rrap-pal';
    var cur = String(current || '').toLowerCase();
    el.innerHTML =
      (onReset ? '<button class="rrap-palbtn" onclick="window._rrapPalReset()">↺ Back to default</button>' : '')
      + '<div class="rrap-palgrid">'
      + _palRows().map(function (row) {
          return row.map(function (hex) {
            return '<button class="rrap-palsw' + (hex.toLowerCase() === cur ? ' rrap-palon' : '')
              + '" style="background:' + hex + '" title="' + hex
              + '" onclick="window._rrapPalPick(\'' + hex + '\')"></button>';
          }).join('');
        }).join('')
      + '</div>'
      + (_swatches.length
          ? '<div class="rrap-pallab">From your logo</div><div class="rrap-palgrid rrap-pallogo">'
            + _swatches.map(function (hex) {
                return '<button class="rrap-palsw" style="background:' + hex + '" title="' + hex
                  + '" onclick="window._rrapPalPick(\'' + hex + '\')"></button>';
              }).join('') + '</div>'
          : '')
      + '<button class="rrap-palbtn" onclick="window._rrapPalCustom()">🎨 Custom…</button>'
      + '<input type="color" id="rrap-palnative" value="'
      + (/^#[0-9a-fA-F]{6}$/.test(cur) ? cur : NO_COLOUR) + '">';
    document.body.appendChild(el);

    var nat = document.getElementById('rrap-palnative');
    if (nat) nat.addEventListener('input', function () { if (_palCb) _palCb(nat.value); });

    // Beside the anchor, never on top of it — a picker that covers the very
    // swatch you are changing hides the one thing you need to see. Right of
    // it if there is room, otherwise left; only below as a last resort. Then
    // pull the whole thing back inside the window, because a picker that
    // opens half off the screen is worse than no picker.
    var r = anchorEl.getBoundingClientRect(), b = el.getBoundingClientRect();
    var pad = 8, left, top;
    if (r.right + pad + b.width <= window.innerWidth - pad) left = r.right + pad;
    else if (r.left - pad - b.width >= pad) left = r.left - pad - b.width;
    else left = Math.max(pad, Math.min(r.left, window.innerWidth - b.width - pad));
    top = r.top + r.height / 2 - b.height / 2;
    top = Math.max(pad, Math.min(top, window.innerHeight - b.height - pad));
    // If it still lands on the anchor (a narrow window), drop it clear.
    if (left < r.right && left + b.width > r.left && top < r.bottom && top + b.height > r.top) {
      top = (r.bottom + b.height + pad <= window.innerHeight) ? r.bottom + pad
          : Math.max(pad, r.top - b.height - pad);
    }
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    setTimeout(function () { document.addEventListener('mousedown', _palAway); }, 0);
  }
  function _palAway(e) {
    var p = document.getElementById('rrap-pal');
    if (p && !p.contains(e.target)) { document.removeEventListener('mousedown', _palAway); _closePal(); }
  }
  window._rrapPalPick = function (hex) { if (_palCb) _palCb(hex); _closePal(); };
  window._rrapPalReset = function () { if (_palReset) _palReset(); _closePal(); };
  window._rrapPalCustom = function () {
    var n = document.getElementById('rrap-palnative');
    if (n) n.click();
  };

  // ── the left-hand control panel ─────────────────────────────────
  // Every record that leaves a reader is FILLED — three slots and a title,
  // always present, even when empty. Callers never test for a missing key,
  // which is where half-migrated records usually bite.
  // The watermark carries one extra thing: how faint it is. 5% was the fixed
  // value from the day it was built; Brad wants the dial.
  var WM_DEFAULT = 0.05;
  function _fillSlot(sl) {
    var o = { data: sl.data, kind: String(sl.kind || ''), sw: sl.sw };
    var n = parseFloat(sl.opacity);
    o.opacity = (isFinite(n) && n >= 0.01 && n <= 1) ? n : WM_DEFAULT;
    return o;
  }
  function _brandFill(r) {
    r = r || {};
    var t = r.title || {};
    return {
      watermark: r.watermark ? _fillSlot(r.watermark) : null,
      sidebar:   r.sidebar   || null,
      header:    r.header    || null,
      title: {
        text:   String(t.text || ''),
        font:   String(t.font || ''),
        color:  String(t.color || ''),
        size:   ({ s: 1, m: 1, l: 1, xl: 1 })[t.size] ? t.size : 'm',
        bold:   !!t.bold,
        italic: !!t.italic,
        border: BORDERS.some(function (b) { return b[0] === t.border; }) ? t.border : 'none'
      }
    };
  }

  // The SAVED marks — what the app is actually wearing. Migrates the old
  // single-logo record into the watermark slot on first read. A logo whose
  // watermark had been switched OFF was only ever used as a watermark, so
  // honouring that choice means it does not come back on by surprise.
  function _brandRec() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(BRAND_KEY) || 'null'); } catch (e) {}
    if (r && typeof r === 'object') return _brandFill(r);
    var old = null;
    try { old = JSON.parse(localStorage.getItem(LOGO_KEY) || 'null'); } catch (e) {}
    if (old && old.data) {
      return _brandFill({ watermark: old.mode === 'off' ? null
        : { data: old.data, kind: old.kind, sw: old.sw } });
    }
    return _brandFill({});
  }

  // The CANDIDATE — what the editor is showing. Draft beats saved. Every
  // part of the editor asks this; only Apply and boot ask _brandRec. That
  // split is the whole of Brad's cancel/reset bug, kept for three slots.
  function _brandNow() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(BRAND_DRAFT_KEY) || 'null'); } catch (e) {}
    return d && typeof d === 'object' ? _brandFill(d) : _brandRec();
  }
  function _brandDirty() {
    try { return !!localStorage.getItem(BRAND_DRAFT_KEY); } catch (e) { return false; }
  }
  // Every edit goes through here: take the candidate, change it, write it
  // back as the draft. One writer for the draft, one for the saved record.
  function _brandEdit(fn) {
    var rec = _brandNow();
    fn(rec);
    try { localStorage.setItem(BRAND_DRAFT_KEY, JSON.stringify(rec)); } catch (e) {}
    return rec;
  }
  function _dropDraft() {
    try { localStorage.removeItem(BRAND_DRAFT_KEY); localStorage.removeItem(LOGO_DRAFT_KEY); } catch (e) {}
  }
  function _slotNow(slot) { return _brandNow()[slot] || null; }

  // The swatches shown in the colour box: from whichever slot last built a
  // palette, else the first slot that has any.
  function _savedSwatches() {
    var rec = _brandNow(), i, s;
    for (i = 0; i < SLOTS.length; i++) {
      s = rec[SLOTS[i][0]];
      if (s && Array.isArray(s.sw) && s.sw.length) return s.sw.slice(0, 6);
    }
    return [];
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Brad, seeing v1209: "this is clustered. maybe put the logos across the
  // bottom of the screen and leave the color box to the left." Three square
  // tiles plus a header-line form plus swatches plus five role rows never fit
  // one 300px column — it scrolled, and the labels wrapped. The colour box
  // keeps the left; the marks get the full width along the bottom, where
  // three tiles sit side by side with room for their labels.
  function _leftPanelHtml() {
    return _swatchHtml() + _rolesHtml();
  }
  function _bottomPanelHtml() {
    return _titleHtml() + _logoBarHtml();
  }

  // The three square logo tiles. Brad: "a big square box to the top left that
  // looks like a logo shape, not a long text box" — now one per home. The
  // ARMED tile is the one a paste, a drop or the file picker lands in, so
  // there is never a question of where an image went.
  function _logoBarHtml() {
    var rec = _brandNow();
    var html = '<div class="rrap-bsec"><div class="rrap-lh">Your marks</div><div class="rrap-tiles">';
    SLOTS.forEach(function (s) {
      var key = s[0], slot = rec[key], on = (_slotArmed === key);
      html += '<div class="rrap-tilewrap">'
        + '<div class="rrap-logotile' + (on ? ' rrap-tileon' : '') + '" data-slot="' + key + '"'
        + ' onclick="window._rrapSlotPick(\'' + key + '\')">'
        + (slot && slot.data
            ? '<img src="' + slot.data + '" alt="' + _esc(s[1]) + '">'
            : '<span class="rrap-tileicon">🖼</span><span class="rrap-tiletxt">add</span>')
        + '</div>'
        + '<div class="rrap-tlabel"><b>' + s[1] + '</b><span>' + s[2] + '</span></div>'
        + (key === 'watermark' && slot && slot.data
            ? '<label class="rrap-wmwrap"><span class="rrap-flab">How faint</span>'
              + '<input class="rrap-wm" type="range" min="2" max="40" step="1" value="'
              + Math.round((slot.opacity || WM_DEFAULT) * 100) + '"'
              + ' oninput="window._rrapWmSet(this.value)"></label>'
            : '')
        + (slot && slot.data
            ? '<div class="rrap-lbtns">'
              + '<button class="rrap-lbtn" onclick="window._rrapSlotPalette(\'' + key + '\')" title="Build the colours from this mark">🎨</button>'
              + '<button class="rrap-lbtn" onclick="window._rrapSlotRemove(\'' + key + '\')" title="Remove this mark">✕</button></div>'
            : '')
        + '</div>';
    });
    html += '</div>';
    var armed = rec[_slotArmed];
    html += '<div class="rrap-hint" style="margin-top:0.4rem">'
      + 'Paste, drop, or click a box to fill it. <b>' + _slotLabel(_slotArmed) + '</b> is selected.'
      + '</div>'
      + (armed && armed.kind ? '<div class="rrap-lnote" style="margin-top:0.3rem">' + _rrLogoNote(armed.kind) + '</div>' : '')
      + '<input type="file" id="rrap-lfile" accept="image/*" style="display:none"></div>';
    return html;
  }
  function _slotLabel(key) {
    var s = SLOTS.filter(function (x) { return x[0] === key; })[0];
    return s ? s[1] : key;
  }

  // The typed header line. Brad: "let them type a custom header. 'The Short
  // Line Rail Collection' With fonts and color and border options."
  // It sits WITH the header logo rather than instead of it — a mark and a
  // name side by side is a normal thing to want, and offering both removes
  // a decision instead of adding one.
  function _titleHtml() {
    var t = _brandNow().title;
    var col = t.color || _cur('--text') || NO_COLOUR;
    if (!/^#[0-9a-fA-F]{6}$/.test(col)) col = NO_COLOUR;
    return '<div class="rrap-bsec rrap-bgrow"><div class="rrap-trow">'
      + '<label class="rrap-fld" style="flex:2;min-width:190px"><span class="rrap-flab">Header line — the words</span>'
      + '<input class="rrap-tin" id="rrap-title" type="text" maxlength="48" placeholder="e.g. The Short Line Rail Collection"'
      + ' value="' + _esc(t.text) + '" oninput="window._rrapTitleSet(\'text\',this.value)"></label>'
      + '<label class="rrap-fld"><span class="rrap-flab">Typeface</span>'
      + '<select class="rrap-tsel" onchange="window._rrapTitleSet(\'font\',this.value)">'
      + FONTS.map(function (f) {
          return '<option value="' + _esc(f[0]) + '"' + (f[0] === t.font ? ' selected' : '')
            + ' style="font-family:' + (f[0] || 'var(--font-head)') + '">' + _esc(f[1]) + '</option>';
        }).join('')
      + '</select></label>'
      + '<label class="rrap-fld"><span class="rrap-flab">Border</span>'
      + '<select class="rrap-tsel" onchange="window._rrapTitleSet(\'border\',this.value)">'
      + BORDERS.map(function (b) {
          return '<option value="' + b[0] + '"' + (b[0] === t.border ? ' selected' : '') + '>' + b[1] + '</option>';
        }).join('')
      + '</select>'
      + '</select></label>'
      + '<label class="rrap-fld" style="flex:none;min-width:110px"><span class="rrap-flab">Size</span>'
      + '<select class="rrap-tsel" onchange="window._rrapTitleSet(\'size\',this.value)">'
      + TITLE_SIZES.map(function (z) {
          return '<option value="' + z[0] + '"' + (z[0] === t.size ? ' selected' : '') + '>' + z[1] + '</option>';
        }).join('')
      + '</select></label>'
      + '<label class="rrap-fld" style="flex:none"><span class="rrap-flab">Style</span>'
      + '<span class="rrap-trow" style="gap:0.3rem">'
      + '<button class="rrap-tbtn' + (t.bold ? ' rrap-ton' : '') + '" style="font-weight:700"'
      + ' onclick="window._rrapTitleToggle(\'bold\')" title="Bold">B</button>'
      + '<button class="rrap-tbtn' + (t.italic ? ' rrap-ton' : '') + '" style="font-style:italic;font-family:serif"'
      + ' onclick="window._rrapTitleToggle(\'italic\')" title="Italic">I</button>'
      + '</span></label>'
      + '<label class="rrap-fld" style="flex:none"><span class="rrap-flab">Text colour</span>'
      + '<span class="rrap-rc" title="Colour of the words" onclick="window._rrapTitleColour(event)">'
      + '<span class="rrap-rcface" style="background:' + col + '"></span></span></label>'
      + '</div>'
      + '<div class="rrap-hint" style="margin-top:0.3rem">Shows in the top bar next to THE RAIL ROSTER. Leave it empty for none.</div>'
      + '</div>';
  }

  function _swatchHtml() {
    if (!_swatches.length) {
      return '<div><div class="rrap-lh">Its colours</div>'
        + '<div class="rrap-hint">Add a logo above and its colours land here, ready to drop onto the jobs below.</div></div>';
    }
    return '<div><div class="rrap-lh">Its colours</div>'
      + '<div class="rrap-sw">' + _swatches.map(function (hex, i) {
          return '<button class="rrap-swb' + (i === _armed ? ' rrap-armed' : '') + '" style="background:' + hex
            + '" title="' + hex + '" onclick="window._rrapArm(' + i + ')"></button>';
        }).join('') + '</div>'
      + '<div class="rrap-hint" style="margin-top:0.35rem">'
      + (_armed >= 0 ? 'Now click the job you want it to do.' : 'Click a colour, then click a job below.')
      + '</div></div>';
  }

  // Brad: "the boxes… with background, panels and headers, change color on
  // the app but not on the button themselves."
  //
  // He was right, and the cause is the same structural rule that fixed the
  // dark page. The candidate skin lives on the STAGE; this panel sits OUTSIDE
  // the stage, so a `var(--bg)` here resolved against :root — the app's
  // current colour — and the button showed the old skin while the preview
  // showed the new one. The panel must be painted with the VALUE, never the
  // variable. Same reason the swatch buttons above already use a literal.
  function _rolesHtml() {
    return '<div><div class="rrap-lh">What each colour does</div>'
      + ROLES.map(function (r) {
          var v = _cur(r[0]) || NO_COLOUR;
          var hex = /^#[0-9a-fA-F]{6}$/.test(v) ? v : NO_COLOUR;
          return '<div class="rrap-role' + (_armed >= 0 ? ' rrap-ready' : '') + '" onclick="window._rrapRole(event,\'' + r[0] + '\')">'
            + '<span class="rrap-rc"><span class="rrap-rcface" style="background:' + hex + '"></span></span>'
            + '<span class="rrap-rl"><b>' + r[1] + '</b><span>' + r[2] + '</span></span></div>';
        }).join('')
      + '<div class="rrap-hint" style="margin-top:0.3rem">Owned-green and wanted-blue are left alone on purpose — they mean something.</div></div>';
  }

  function _refreshPresets() {
    var pl = document.getElementById('rrap-presets');
    if (pl) pl.innerHTML = _presetPills();
  }
  function _refreshPanel() {
    var left = document.getElementById('rrap-colourbox');
    if (left) left.innerHTML = _leftPanelHtml();
    var bot = document.getElementById('rrap-logobar');
    if (bot) { bot.innerHTML = _bottomPanelHtml(); _wireLogoInput(); }
    _fitStage();
  }
  function _refreshRoles() { _refreshPanel(); }

  window._rrapArm = function (i) {
    _armed = (_armed === i) ? -1 : i;
    _refreshPanel();
  };
  window._rrapRole = function (ev, v) {
    // With a swatch armed, clicking a job drops that colour on it. With
    // nothing armed, the same click opens the picker — one control, and the
    // meaning is whichever you set up first.
    if (_armed >= 0 && _swatches[_armed]) {
      _rrApplyRole(v, _swatches[_armed]);
      _armed = -1;
      return;
    }
    var row = ev && ev.currentTarget;
    if (row) _openPal(row, _cur(v), function (hex) { _rrApplyRole(v, hex); },
                      function () { _resetVar(v); });
  };
  window._rrapRoleColor = function (v, hex) { _rrApplyRole(v, hex); };
  window._rrapWmSet = function (pct) {
    var v = Math.min(1, Math.max(0.01, (parseFloat(pct) || 5) / 100));
    _brandEdit(function (r) { if (r.watermark) r.watermark.opacity = v; });
    _paintCandidate();
  };
  window._rrapTitleToggle = function (field) {
    var cur = _brandNow().title[field];
    _brandEdit(function (r) { r.title[field] = !cur; });
    _refreshPanel(); _paintCandidate();
  };
  window._rrapTitleColour = function (ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var t = _brandNow().title;
    var el = (ev && ev.currentTarget) || document.querySelector('#rrap-logobar .rrap-rc');
    if (!el) return;
    _openPal(el, t.color || _cur('--text'),
      function (hex) { window._rrapTitleSet('color', hex); },
      function () { window._rrapTitleSet('color', ''); });
  };

  function _rrApplyRole(v, hex) {
    if (v === '--bg') {
      var d = _rrDeriveFromBg(hex);
      Object.keys(d).forEach(function (k) { _set(k, d[k]); });
    } else {
      _set(v, hex);
    }
    // The readability guard runs last, every time, whatever was changed.
    var want = _rrReadableText(_cur('--bg'), _cur('--text'));
    if (want && want.toLowerCase() !== String(_cur('--text')).toLowerCase()) {
      _set('--text', want);
      if (typeof showToast === 'function') showToast('Text adjusted so it stays readable on that background', 3000);
    }
    _refreshPanel();
  }

  function _wireLogoInput() {
    var f = document.getElementById('rrap-lfile');
    if (f) f.addEventListener('change', function () { if (f.files && f.files[0]) _rrapLogoLoad(f.files[0]); });
  }

  // The canvas wrapper around the pure math above: draw → trim → fit →
  // classify → encode. Returns everything the caller needs and touches no
  // storage, so it is safe to call repeatedly.
  function _rrPrepLogo(img, maxSide) {
    var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    if (!sw || !sh) return null;

    // A working copy: small enough to scan instantly even for a 12-megapixel
    // phone photo, big enough that the trim edge is still accurate.
    var work = _rrFitDims(sw, sh, 1024);
    var wc = document.createElement('canvas');
    wc.width = work.w; wc.height = work.h;
    var wx = wc.getContext('2d', { willReadFrequently: true });
    wx.drawImage(img, 0, 0, work.w, work.h);
    var box;
    try { box = _rrTrimBox(wx.getImageData(0, 0, work.w, work.h).data, work.w, work.h); }
    catch (e) { box = { x: 0, y: 0, w: work.w, h: work.h, trimmed: false }; }

    // Map the crop back onto the ORIGINAL pixels, so the kept copy is drawn
    // once at full quality rather than downscaled twice.
    var kx = sw / work.w, ky = sh / work.h;
    var sx = Math.round(box.x * kx), sy = Math.round(box.y * ky);
    var sW = Math.max(1, Math.round(box.w * kx)), sH = Math.max(1, Math.round(box.h * ky));

    var fit = _rrFitDims(sW, sH, maxSide || LOGO_MAX);
    var cv = document.createElement('canvas');
    cv.width = fit.w; cv.height = fit.h;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, sx, sy, sW, sH, 0, 0, fit.w, fit.h);

    var cls = { kind: 'mixed', top6: 0, colors: 0 }, alpha = true;
    try {
      var px = cx.getImageData(0, 0, fit.w, fit.h).data;
      cls = _rrClassifyPixels(px);
      alpha = _rrHasAlpha(px);
    } catch (e) {}

    // Flat marks and anything see-through stay PNG (transparency is the
    // whole point of a herald). A photograph as PNG is enormous for no gain.
    var data = (alpha || cls.kind === 'herald')
      ? cv.toDataURL('image/png')
      : cv.toDataURL('image/jpeg', 0.85);
    return { canvas: cv, data: data, kind: cls.kind, trimmed: box.trimmed, w: fit.w, h: fit.h };
  }

  // Store it as a DRAFT, stepping down in size rather than giving up. The old
  // code had one shot at 360px and told the user the image was too big to
  // keep — a dead end with an apology. A logo that has to be 160px is still a
  // logo. It goes to the draft key, not the live one, so the size ladder
  // still proves the image fits while Cancel can still refuse it.
  // Fill ONE slot in the draft record, stepping the image down in size
  // rather than giving up. A logo that has to be 160px is still a logo.
  function _rrKeepLogo(img, slot, firstTry) {
    var sizes = [LOGO_MAX, 384, 256, 160], i, p;
    for (i = 0; i < sizes.length; i++) {
      p = (i === 0 && firstTry) ? firstTry : _rrPrepLogo(img, sizes[i]);
      if (!p) return null;
      try {
        var rec = _brandNow();
        rec[slot] = { data: p.data, kind: p.kind, sw: _swatches };
        localStorage.setItem(BRAND_DRAFT_KEY, JSON.stringify(rec));
        return p;
      } catch (e) {}
    }
    return null;
  }

  // Load a pasted/dropped/picked image into the ARMED slot. The palette is
  // applied FIRST so a full localStorage can never block the main point.
  function _rrapLogoLoad(fileOrBlob) {
    var url = URL.createObjectURL(fileOrBlob);
    var slot = _slotArmed;
    var img = new Image();
    img.onload = function () {
      var prep = _rrPrepLogo(img, LOGO_MAX);
      URL.revokeObjectURL(url);
      if (!prep) {
        if (typeof showToast === 'function') showToast('That didn’t look like an image file', 3000, true);
        return;
      }
      // Read first, so a full localStorage can never cost the user the
      // colours — but do not apply them yet.
      var map = _readLogoColours(prep.canvas);
      var kept = _rrKeepLogo(img, slot, prep);
      if (!kept && typeof showToast === 'function') {
        showToast(_slotLabel(slot) + ' — this device has no room left to keep the image', 4500, true);
      }
      _refreshPanel();
      _paintCandidate();
      _askApplyScheme(map, slot, prep.kind);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function') showToast('That didn’t look like an image file', 3000, true);
    };
    img.src = url;
  }

  // The offer. Answering no still leaves the logo in place and its colours
  // sitting in the swatch row, ready to drop on one job at a time.
  function _askApplyScheme(map, slot, kind) {
    var apply = function () {
      Object.keys(map).forEach(function (k) { _set(k, map[k]); });
      _refreshPanel();
      if (typeof showToast === 'function') showToast('Colours taken from your logo — press Preview to see them in the app', 4000);
    };
    var note = _slotLabel(slot) + ' set.' + (kind ? ' ' + _rrLogoNote(kind) : '');
    if (typeof appConfirm !== 'function') { _toastOnly(note); return; }
    appConfirm(note + ' Would you like the whole look built from this logo\u2019s colours? '
      + 'Say no and they simply wait in the row on the left, to use where you choose.',
      { title: 'Auto-apply generated logo scheme', ok: 'Yes, use them', cancel: 'No, leave my colours' })
      .then(function (yes) { if (yes) apply(); else _toastOnly(note); });
  }
  function _toastOnly(note) {
    if (typeof showToast === 'function') showToast(note + ' Its colours are in the row on the left.', 4000);
  }

  // Clicking a tile ARMS it. If it already holds a mark, the click also opens
  // the file picker — one control, no hunting for a second button.
  window._rrapSlotPick = function (slot) {
    _slotArmed = slot;
    _refreshPanel();
    var f = document.getElementById('rrap-lfile');
    if (f) f.click();
  };
  window._rrapSlotPalette = function (slot) {
    var s = _slotNow(slot); if (!s || !s.data) return;
    var img = new Image();
    img.onload = function () { _applyLogoPalette(img, s.kind); _refreshPanel(); };
    img.src = s.data;
  };
  // Brad: "there is not logo delete button." There was one, but it deleted
  // the SAVED logo outright — no Cancel, no undo. It now clears the
  // candidate slot, and only Apply makes that permanent.
  window._rrapSlotRemove = function (slot) {
    _brandEdit(function (r) { r[slot] = null; });
    _slotArmed = slot;
    _refreshPanel(); _paintCandidate();
  };
  window._rrapTitleSet = function (field, value) {
    _brandEdit(function (r) { r.title[field] = String(value == null ? '' : value); });
    // The text box must not be rebuilt under the cursor while typing.
    if (field !== 'text') _refreshPanel();
    _paintCandidate();
  };

  // Show the CANDIDATE marks: in the preview replica always, and on the real
  // app only while previewing. Outside those two the app keeps wearing what
  // is saved — the point of the whole draft mechanism.
  function _paintCandidate() {
    var rec = _brandNow();
    var wm = rec.watermark;
    var on = !!(wm && wm.data);
    var replica = document.getElementById('ra-app');
    _paintReplicaMark('ra-brand-side', rec.sidebar, 62);
    _paintReplicaHeader(rec.header, rec.title);
    if (replica) {
      // Two layers: the mark, and a 95%-opaque wash of the background over
      // it. That reproduces the real watermark's 5% strength honestly —
      // showing the logo at full strength here would promise something the
      // app never delivers.
      var pct = Math.round(100 - (wm && wm.opacity ? wm.opacity : WM_DEFAULT) * 100);
      var wash = 'color-mix(in srgb,var(--bg) ' + pct + '%,transparent)';
      replica.style.backgroundImage = on
        ? 'linear-gradient(' + wash + ',' + wash + '),url(' + wm.data + ')' : '';
      replica.style.backgroundRepeat = 'no-repeat';
      replica.style.backgroundPosition = 'center';
      replica.style.backgroundSize = 'auto,38%';
    }
    if (_preview) applyBranding(rec);
  }
  function _paintReplicaMark(id, slot, maxH) {
    var el = document.getElementById(id); if (!el) return;
    el.innerHTML = (slot && slot.data)
      ? '<img src="' + slot.data + '" style="max-width:100%;max-height:' + maxH + 'px;object-fit:contain">' : '';
  }
  function _paintReplicaHeader(slot, title) {
    var el = document.getElementById('ra-brand-head'); if (!el) return;
    el.innerHTML = _brandHeaderHtml(slot, title, 18, '0.62rem');
  }

  // ── the three homes in the real app ─────────────────────────────
  // Called with no argument they read what is SAVED — that is the boot path,
  // and the path Cancel uses to put the app back the way it was.
  function applyBranding(rec) {
    if (rec === undefined) rec = _brandRec();
    applyLogoBackdrop(rec.watermark);
    _applySidebarMark(rec.sidebar);
    _applyHeaderMark(rec.header, rec.title);
  }
  window.applyBranding = applyBranding;

  // ── shared with the dashboard's logo cards (v0.9.1210) ──────────
  // Deliberately OUTSIDE the APPEARANCE_ENABLED gate. Logo cards are a
  // dashboard feature the user keeps once Appearance is hidden, and there
  // must be exactly ONE image-prep implementation — a second copy would
  // trim and size logos differently in two places, which is the same shape
  // as every bug this app has had.
  window.rrBrandFonts = FONTS;
  window.rrBrandBorders = BORDERS;
  window.rrTitleStyle = _rrTitleStyle;
  window.rrLogoNote = _rrLogoNote;
  window.rrEscape = _esc;
  window.rrPrepLogoFile = function (fileOrBlob, cb) {
    var url = URL.createObjectURL(fileOrBlob);
    var img = new Image();
    img.onload = function () {
      var p = _rrPrepLogo(img, LOGO_MAX);
      URL.revokeObjectURL(url);
      cb(p ? { data: p.data, kind: p.kind } : null);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  };

  // A faint watermark, BEHIND the page (v0.9.1241, Brad).
  //
  // It used to be a fixed div on <body> at z-index:1, which put it above every
  // ordinary block in the page — so the dashboard's photo strip, the stat
  // cards and the lists all had a 5% wash laid over them and the photographs
  // looked faded. Brad: "should be underneath everything. also the photos
  // going through the middle should not be transparent."
  //
  // WHY z-index:-1 INSIDE .main AND NOT ON <body>:
  //   CSS paints, within one stacking context: the element's own background,
  //   then negative-z-index descendants, then the backgrounds of ordinary
  //   blocks, then everything else. So z-index:-1 is exactly the layer we
  //   want — above the page's cream, below every card and photo.
  //   But .main paints its own opaque cream, and on <body> the watermark
  //   would sit below that and never be seen at all. It therefore lives
  //   INSIDE .main, and .main is made a stacking context (position:relative;
  //   z-index:0) so -1 is measured against .main's background rather than the
  //   document's. Without that one line the watermark disappears completely.
  //
  // pointer-events:none so it can never block a tap. position:fixed so it
  // stays put while the page scrolls under it.
  function applyLogoBackdrop(slot) {
    if (slot === undefined) slot = _brandRec().watermark;
    var el = document.getElementById('rr-logo-bg');
    if (!slot || !slot.data) { if (el) el.remove(); return; }
    var host = document.querySelector('.main') || document.body;
    if (!el) {
      el = document.createElement('div'); el.id = 'rr-logo-bg';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:-1;'
        + 'background-position:center;background-repeat:no-repeat;'
        // v0.9.1241: twice the old min(55vmin,420px), at Brad's ask.
        + 'background-size:min(110vmin,840px)';
    }
    // .main is rebuilt by app-setup, so re-home the mark rather than assume
    // the node it was appended to still exists.
    if (el.parentNode !== host) host.appendChild(el);
    el.style.backgroundImage = 'url(' + slot.data + ')';
    el.style.opacity = String(slot.opacity || WM_DEFAULT);
  }
  window.applyLogoBackdrop = applyLogoBackdrop;

  // The foot of the menu. Appended to .sidebar itself, never to a nav
  // section, so it stays last however many sections other code adds — the
  // Need Help widget goes INTO the final section and cannot displace it.
  function _applySidebarMark(slot) {
    var host = document.querySelector('.sidebar');
    var el = document.getElementById('rr-brand-sidebar');
    if (!host || !slot || !slot.data) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'rr-brand-sidebar'; }
    el.innerHTML = '<img src="' + slot.data + '" alt="">';
    host.appendChild(el);
  }

  // The top bar, beside THE RAIL ROSTER — inserted before .header-right so
  // it can never push the account chip off the end.
  function _applyHeaderMark(slot, title) {
    var host = document.querySelector('.header');
    var el = document.getElementById('rr-brand-header');
    var html = _brandHeaderHtml(slot, title, 0, '');
    if (!host || !html) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'rr-brand-header';
      var right = host.querySelector('.header-right');
      if (right) host.insertBefore(el, right); else host.appendChild(el);
    }
    el.innerHTML = html;
  }

  // ONE builder for the header mark, used by the real header and by the
  // preview replica. Two builders would be two answers to the same question,
  // and the preview would eventually stop matching the thing it previews.
  function _brandHeaderHtml(slot, title, imgH, fontSize) {
    var t = title || {};
    var text = String(t.text || '').trim();
    var hasLogo = !!(slot && slot.data);
    if (!hasLogo && !text) return '';
    return (hasLogo ? '<img src="' + slot.data + '" alt=""'
             + (imgH ? ' style="height:' + imgH + 'px;width:auto;display:block"' : '') + '>' : '')
      + (text ? '<span style="' + _rrTitleStyle(t) + (fontSize ? ';font-size:' + fontSize : '') + '">'
             + _esc(text) + '</span>' : '');
  }

  // The tile a paste or a drop will land in — the one that is armed. There
  // is no fixed drop zone any more, so the highlight has to follow the arming.
  function _armedTile() {
    return document.querySelector('#rrap .rrap-logotile[data-slot="' + _slotArmed + '"]');
  }

  // paste + drag-drop, only while the editor is open
  function _onPaste(e) {
    if (!document.getElementById('rrap')) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault(); _rrapLogoLoad(items[i].getAsFile()); return;
      }
    }
  }
  function _onDrop(e) {
    var ov = document.getElementById('rrap'); if (!ov) return;
    e.preventDefault();
    var dz = _armedTile(); if (dz) dz.classList.remove('rrap-over');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) _rrapLogoLoad(f);
  }
  function _onDrag(e) {
    if (!document.getElementById('rrap')) return;
    e.preventDefault();
    var dz = _armedTile();
    if (dz) dz.classList.toggle('rrap-over', e.type === 'dragover');
  }

  // ── actions ──────────────────────────────────────────────────────
  // The app's BUILT-IN palette, read from the stylesheet rather than from
  // whatever :root happens to be wearing. A saved custom skin lives as inline
  // properties on :root, so simply removing this session's overrides falls
  // back to that skin — which is why Reset never reached the default. The
  // inline values are lifted off, the real cascade is read, and they go
  // straight back; nothing on screen changes while it happens.
  function _defaultPalette() {
    var all = EDIT_VARS.map(function (e) { return e[0]; }).concat(DERIVED_VARS);
    var saved = {}, out = {};
    all.forEach(function (v) {
      saved[v] = _root.style.getPropertyValue(v);
      _root.style.removeProperty(v);
    });
    var cs = getComputedStyle(_root);
    all.forEach(function (v) { out[v] = (cs.getPropertyValue(v) || '').trim(); });
    all.forEach(function (v) { if (saved[v]) _root.style.setProperty(v, saved[v]); });
    return out;
  }

  window._rrapReset = function () {
    // Brad: "reset to default doesn't reset it back to our normal layout."
    // It used to work by ABSENCE — drop this session's overrides and let
    // whatever is underneath show through. Underneath is the saved skin, so
    // Reset returned you to your last look, not to the app's. It now states
    // the default outright, which is also the only version of this that can
    // be tested.
    var st = _stage();
    Object.keys(_live).forEach(function (v) {
      if (st) st.style.removeProperty(v);
      if (_preview) _root.style.removeProperty(v);
    });
    _live = {};
    var def = _defaultPalette();
    // `true` because every one is being set explicitly — deriving the text
    // shades here would overwrite the defaults we just read for them.
    Object.keys(def).forEach(function (v) { if (def[v]) _set(v, def[v], true); });
    // Brad: "reset to default didn't get rid of it either." Default means the
    // plain app — no skin AND no logo. The removal is still only a candidate;
    // Apply makes it real, Cancel puts the logo back.
    _dropDraft();
    _brandEdit(function (r) {
      r.watermark = null; r.sidebar = null; r.header = null;
      r.title = { text: '', font: '', color: '', border: 'none' };
    });
    _swatches = []; _armed = -1;
    if (_preview && typeof applyTheme === 'function') applyTheme();
    _paintCandidate();
    var ov = document.getElementById('rrap');
    _refreshPanel();
  };
  // ONE writer for a saved look, used by "Save current…" and by Apply.
  function _storePreset(name) {
    name = String(name || '').slice(0, 24).trim();
    if (!name) return '';
    var up = _userPresets(), map = {};
    EDIT_VARS.forEach(function (e) { map[e[0]] = _cur(e[0]); });
    DERIVED_VARS.forEach(function (v) { var c = _cur(v); if (c) map[v] = c; });
    up[name] = map;
    try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(up)); } catch (e2) {}
    _activePreset = name;
    _refreshPresets();
    return name;
  }
  // "My look 2", "My look 3"… so the name box is never empty and cancelling
  // is a real choice rather than the only way past a blank field.
  function _nextLookName() {
    var up = _userPresets(), n = 1;
    while (up['My look ' + n]) n++;
    return 'My look ' + n;
  }

  // ── Where should this look be saved? (v0.9.1243) ────────────────────────
  // Brad: "when saving, we need a way to save as an existing one as well as
  // creating a new one. maybe a dropdown."
  //
  // The old box could only make a NEW look. Typing the name of one you already
  // had silently replaced it with no warning, and there was no way to see what
  // you already had while deciding.
  //
  // Resolves to { name } to save under that name, or { skip: true } to apply
  // without saving. Never rejects — closing it is "apply without saving",
  // which is what the old dialog's Cancel did.
  //
  // With no saved looks yet there is nothing to choose between, so it stays
  // exactly the single name box it always was.
  function _askSaveTarget() {
    return new Promise(function (resolve) {
      var names = Object.keys(_userPresets());
      var NEW = '\u0000new';
      var old = document.getElementById('rrap-save');
      if (old) old.remove();

      var ov = document.createElement('div');
      ov.id = 'rrap-save';
      ov.innerHTML =
        '<div class="rrap-savebox">'
        + '<div class="rrap-saveh">Apply and save this look</div>'
        + '<div class="rrap-savep">Save over one you already have, or keep it as a new one. '
        +   'You can also apply it without saving.</div>'
        + (names.length
            ? '<label class="rrap-savel" for="rrap-save-sel">Save as</label>'
              + '<select id="rrap-save-sel" class="rrap-savesel">'
              + names.map(function (n) {
                  return '<option value="' + _esc(n) + '">Replace \u201c' + _esc(n) + '\u201d</option>';
                }).join('')
              + '<option value="' + NEW + '" selected>\uFF0B Save as a new look\u2026</option>'
              + '</select>'
            : '')
        + '<input id="rrap-save-name" class="rrap-savein" type="text" maxlength="24" '
        +   'value="' + _esc(_nextLookName()) + '" placeholder="Name this look">'
        + '<div class="rrap-saveb">'
        +   '<button type="button" id="rrap-save-skip" class="rrap-savebtn">Apply without saving</button>'
        +   '<button type="button" id="rrap-save-ok" class="rrap-savebtn rrap-saveok">Apply</button>'
        + '</div></div>';
      document.body.appendChild(ov);

      var sel  = document.getElementById('rrap-save-sel');
      var name = document.getElementById('rrap-save-name');
      var ok   = document.getElementById('rrap-save-ok');
      var isNew = function () { return !sel || sel.value === NEW; };
      // The name box is only meaningful for a NEW look; for a replacement the
      // dropdown already IS the name, and a second name box beside it would be
      // two answers to one question.
      var sync = function () {
        name.style.display = isNew() ? '' : 'none';
        ok.textContent = isNew() ? 'Apply' : 'Apply and replace';
      };
      if (sel) sel.onchange = sync;
      sync();

      var done = function (val) { ov.remove(); resolve(val); };
      ok.onclick = function () {
        done({ name: isNew() ? String(name.value || '').trim() : sel.value });
      };
      document.getElementById('rrap-save-skip').onclick = function () { done({ skip: true }); };
      ov.onclick = function (e) { if (e.target === ov) done({ skip: true }); };
      name.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } };
      setTimeout(function () { try { (sel || name).focus(); } catch (e) {} }, 30);
    });
  }

  window._rrapSavePreset = function () {
    var go = function (name) {
      if (!_storePreset(name)) return;
      if (typeof showToast === 'function') showToast('Saved as “' + String(name).slice(0, 24) + '” — it is in the row above', 3200);
    };
    // Brad: "save current doesn't do anything. it should let me make a name
    // and then save it."
    //
    // Two faults, both mine. appPrompt RETURNS A PROMISE — it has never taken
    // a callback — so `go` was being handed in as the options object and the
    // name the user typed was resolved to nobody. And the dialog paints at
    // z-index 99998 while this editor sits at 100040, so it opened BEHIND the
    // editor: a dialog you cannot see, discarding an answer nobody collects.
    if (typeof appPrompt === 'function') {
      appPrompt('Give this look a name so you can come back to it.', '',
        { title: 'Save this look' }).then(go);
    } else go(window.prompt('Name this look'));
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
        _refreshPanel();
      } catch (e) { if (typeof showToast === 'function') showToast('That didn’t look like a skin — paste the exported text exactly', 3500, true); }
    };
    if (typeof appPrompt === 'function') {
      appPrompt('Paste the text you exported from another device.', '',
        { title: 'Import a look' }).then(go);
    } else go(window.prompt('Paste a skin'));
  };

  // ── Preview: the round trip Brad asked for ───────────────────────
  // "the actual app shouldn't change until we hit preview, which then will
  //  let us flip through the app to see it completely while a pop up stays
  //  on top with apply it, edit it, and cancel."
  window._rrapPreview = function () {
    // A logo on its own is a change worth previewing, so the guard asks
    // about both halves of the candidate, not just the colours.
    if (!Object.keys(_live).length && !_brandDirty()) {
      if (typeof showToast === 'function') showToast('Nothing has changed yet — add a logo or pick some colours first', 3200, true);
      return;
    }
    var ov = document.getElementById('rrap'); if (ov) ov.style.display = 'none';
    _preview = true;
    Object.keys(_live).forEach(function (v) { _root.style.setProperty(v, _live[v]); });
    applyBranding(_brandNow());
    var bar = document.getElementById('rrap-prevbar'); if (bar) bar.remove();
    bar = document.createElement('div'); bar.id = 'rrap-prevbar';
    bar.innerHTML = '<span class="rrap-pvt">This is your new look — move around the app and see it everywhere.</span>'
      + '<button class="rrap-btn rrap-primary" onclick="window._rrapApply()">✓ Apply it</button>'
      + '<button class="rrap-btn" onclick="window._rrapEdit()">✎ Edit it</button>'
      + '<button class="rrap-btn" onclick="window._rrapCancel()">✕ Cancel</button>';
    document.body.appendChild(bar);
  };

  // Take the preview back off :root. applyTheme() then replays whatever is
  // actually saved — the old look, or the new one if Apply just stored it.
  function _endPreview() {
    var bar = document.getElementById('rrap-prevbar'); if (bar) bar.remove();
    Object.keys(_live).forEach(function (v) { _root.style.removeProperty(v); });
    _preview = false;
    if (typeof applyTheme === 'function') applyTheme();
    applyBranding();          // back to the SAVED marks, whatever they now are
  }

  function _persist(map) {
    try {
      localStorage.setItem((window.A11Y && A11Y.theme && A11Y.theme.customStorageKey) || 'lv_skin_custom', JSON.stringify(map));
      localStorage.setItem((window.A11Y && A11Y.theme && A11Y.theme.storageKey) || 'lv_theme', 'custom');
    } catch (e2) {}
  }

  // Apply is the ONE place a candidate becomes real — colours AND logo. Keep
  // it that way: any other writer resurrects the bug Brad found, where a
  // logo was already saved before Cancel had a say.
  function _commitBrand() {
    var d = _brandNow();
    var any = d.watermark || d.sidebar || d.header || String(d.title.text || '').trim();
    try {
      if (any) localStorage.setItem(BRAND_KEY, JSON.stringify(d));
      else localStorage.removeItem(BRAND_KEY);
      // The legacy single-logo record has been migrated by now; leaving it
      // behind would let a future read resurrect a mark the user deleted.
      localStorage.removeItem(LOGO_KEY);
    } catch (e) {}
    _dropDraft();
  }

  // Brad: "when you hit apply it, you need to save it either as the one you
  // were working on, or as a new one."
  //
  // Applying used to make a look the current one and nothing else — so a look
  // you had spent time on existed only as "whatever the app is wearing", and
  // the next thing you built replaced it with no way back. Apply now also
  // files it in the row: over the look you were working on if there was one,
  // otherwise under a name it asks for.
  window._rrapApply = function () {
    var finish = function (extra) {
      var map = {}; EDIT_VARS.forEach(function (e) { map[e[0]] = _cur(e[0]); });
      // The derived shades are not editor boxes, but they ARE part of the look
      // and must be replayed on every boot like everything else.
      DERIVED_VARS.forEach(function (v) { var c = _cur(v); if (c) map[v] = c; });
      _persist(map);
      _commitBrand();
      _saved = true;
      // This device's look just changed — stamp it, then send it on. Both are
      // no-ops if look-sync.js is not loaded or Drive is not reachable.
      if (typeof window.rrLookTouch === 'function') window.rrLookTouch();
      if (typeof window.rrLookPush === 'function') window.rrLookPush({ loud: false });
      _endPreview();
      _teardown();
      if (typeof showToast === 'function') {
        showToast('This is your look now' + (extra || '') + '. Preferences → Theme switches back any time.', 4200);
      }
    };
    if (_activePreset) {
      _storePreset(_activePreset);
      finish(', and “' + _activePreset + '” is up to date');
      return;
    }
    // v0.9.1243: pick an existing look to replace, or name a new one.
    _askSaveTarget().then(function (r) {
      if (!r || r.skip) { finish(' — not saved to the row above'); return; }
      var existed = Object.prototype.hasOwnProperty.call(_userPresets(), r.name);
      var saved = _storePreset(r.name);
      finish(saved ? (existed ? ', and \u201c' + saved + '\u201d is up to date'
                              : ', saved as \u201c' + saved + '\u201d')
                   : ' — not saved to the row above');
    });
  };
  window._rrapEdit = function () {
    _endPreview();
    var ov = document.getElementById('rrap');
    if (ov) { ov.style.display = ''; requestAnimationFrame(_relayout); }
    else window.openAppearance();
  };
  window._rrapCancel = function () {
    _live = {};
    _dropDraft();          // the pasted logo goes with everything else
    _endPreview();         // …then put the app back on what is SAVED
    _teardown();
  };

  function _teardown() {
    _closePal(); _closeWhat();
    var tip = document.getElementById('rrap-tip'); if (tip) tip.remove();
    var ov = document.getElementById('rrap');
    if (ov) ov.remove();
    var bar = document.getElementById('rrap-prevbar'); if (bar) bar.remove();
    _preview = false;
    window.removeEventListener('resize', _onResize);
    document.removeEventListener('paste', _onPaste);
    document.removeEventListener('dragover', _onDrag);
    document.removeEventListener('dragleave', _onDrag);
    document.removeEventListener('drop', _onDrop);
  }

  window._rrapClose = function (save) {
    if (save) { window._rrapApply(); return; }
    _live = {};
    _dropDraft();
    if (_preview) _endPreview();
    if (typeof applyTheme === 'function') applyTheme();
    applyBranding();
    _teardown();
  };

  // A saved watermark is a user choice, not an editor feature — it applies
  // on every boot even when APPEARANCE_ENABLED is false (hiding the editor
  // before beta must not strip Brad's own look).
  applyBranding();
})();
