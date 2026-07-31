// ═══════════════════════════════════════════════════════════════
// logo-cards.js — the collector's own cards on the dashboard (v0.9.1210)
//
// Brad: "you can go ahead and do the large and small 'logo' cards. The small
// card will just have the logo you select, and you can create as many small
// or large logo cards as you want to select from. The large card we should
// be able to select a logo, and then have a text at the top and or bottom,
// like the header line, be able to choose font and text color, and card
// background color."
// …and, when asked where they are used: "when i say cards, i mean the large
// and small cards on the dashboard screen."
//
// So these are dashboard cards, sitting alongside the stat cards that are
// already there. A LIBRARY of cards is built here; the dashboard's existing
// slot system picks which card goes in which slot, exactly the way the
// Catalog Coverage card already carries its own per-slot setting.
//
// THREE THINGS THIS FILE DELIBERATELY DOES NOT DO:
//
//  1. It does not prepare images. appearance.js already trims the white box
//     off a pasted logo and fits it to size; this file calls
//     window.rrPrepLogoFile. Two copies of that would trim differently in
//     two places, which is the shape of every bug this app has had.
//  2. It does not invent a second font list or a second way to style text.
//     window.rrBrandFonts and window.rrTitleStyle are the same ones the
//     header line uses, so a card and the header cannot drift apart.
//  3. It does not depend on APPEARANCE_ENABLED. Cards are a feature the user
//     keeps after the skin editor is hidden.
//
// Storage is one key, on this device, like everything else in this corner.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var CARDS_KEY = 'rr_logo_cards';
  var MAX_LIBRARY = 24;          // a cap, so a runaway loop cannot fill storage

  function _esc(s) {
    return (typeof window.rrEscape === 'function') ? window.rrEscape(s)
      : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── the library ──────────────────────────────────────────────────
  // Every card comes back FILLED, so no renderer ever has to test for a
  // missing key on a card saved by an older version.
  function _fill(c) {
    c = c || {};
    return {
      id:    String(c.id || ''),
      size:  c.size === 'large' ? 'large' : 'small',
      name:  String(c.name || ''),
      logo:  (c.logo && c.logo.data) ? { data: c.logo.data, kind: String(c.logo.kind || '') } : null,
      top:    String(c.top || ''),
      bottom: String(c.bottom || ''),
      font:   String(c.font || ''),
      color:  String(c.color || ''),
      bg:     String(c.bg || '')
    };
  }
  function rrLogoCards() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(CARDS_KEY) || 'null'); } catch (e) {}
    return Array.isArray(raw) ? raw.map(_fill).filter(function (c) { return !!c.id; }) : [];
  }
  function rrLogoCard(id) {
    var list = rrLogoCards(), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function _saveCards(list) {
    try { localStorage.setItem(CARDS_KEY, JSON.stringify(list.slice(0, MAX_LIBRARY))); return true; }
    catch (e) { return false; }
  }
  // Ids are derived from the library, never from a clock or a random number —
  // both of those are unavailable in the test harness, and a counter is
  // easier to reason about anyway.
  function _nextId(list) {
    var n = 1, used = {}, i;
    for (i = 0; i < list.length; i++) used[list[i].id] = true;
    while (used['c' + n]) n++;
    return 'c' + n;
  }
  function _defaultName(list, size) {
    var n = 1, used = {}, i;
    for (i = 0; i < list.length; i++) used[list[i].name] = true;
    var base = size === 'large' ? 'Large card ' : 'Small card ';
    while (used[base + n]) n++;
    return base + n;
  }

  // ── how a card looks ─────────────────────────────────────────────
  // ONE renderer, used by the dashboard AND by the composer's preview. Two
  // would let the preview stop matching the thing it previews.
  function rrLogoCardHtml(card, opts) {
    card = _fill(card);
    opts = opts || {};
    var style = (typeof window.rrTitleStyle === 'function')
      ? window.rrTitleStyle({ font: card.font, color: card.color, border: 'none' })
      : 'color:var(--text)';
    var small = card.size !== 'large';
    var imgMax = opts.imgMax || (small ? 66 : 92);
    var fs = opts.fontSize || (small ? '0.72rem' : '0.86rem');

    var img = card.logo
      ? '<img src="' + card.logo.data + '" alt="" style="max-width:100%;max-height:' + imgMax
        + 'px;width:auto;object-fit:contain;display:block;margin:0 auto">'
      : '<div style="font-size:0.7rem;color:var(--text-dim);text-align:center;padding:0.6rem 0">No logo chosen yet</div>';

    if (small) return '<div class="rr-lc rr-lc-small">' + img + '</div>';

    var line = function (t) {
      return t ? '<div class="rr-lc-t" style="' + style + ';font-size:' + fs + '">' + _esc(t) + '</div>' : '';
    };
    return '<div class="rr-lc rr-lc-large">' + line(card.top) + img + line(card.bottom) + '</div>';
  }

  // The card's own background colour, applied to the dashboard tile itself
  // rather than to an inner box — a colour that stops short of the card's
  // edges reads as a mistake, not a choice.
  function rrLogoCardBg(card) {
    var bg = (_fill(card)).bg;
    return /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : '';
  }

  // ── the composer ─────────────────────────────────────────────────
  var _editing = null;      // the card being edited (a copy, not the stored one)
  var _slotIdx = -1;        // which dashboard slot asked

  function _close() {
    var p = document.getElementById('rrlc-pop'); if (p) p.remove();
    _editing = null;
  }

  function _open(slotIdx) {
    _close();
    _slotIdx = (typeof slotIdx === 'number') ? slotIdx : -1;
    _editing = null;
    var ov = document.createElement('div');
    ov.id = 'rrlc-pop';
    ov.onclick = function (e) { if (e.target === ov) _close(); };
    document.body.appendChild(ov);
    _render();
    if (window.BackStack && BackStack.wire) BackStack.wire('rrlc-pop');
  }

  function _render() {
    var ov = document.getElementById('rrlc-pop'); if (!ov) return;
    ov.innerHTML = '<div class="rrlc-box">' + (_editing ? _editorHtml() : _listHtml()) + '</div>';
    var f = document.getElementById('rrlc-file');
    if (f) f.addEventListener('change', function () { if (f.files && f.files[0]) _loadLogo(f.files[0]); });
  }

  function _listHtml() {
    var list = rrLogoCards();
    return '<div class="rrlc-h">Your cards</div>'
      + '<div class="rrlc-sub">Pick one for this spot on the dashboard, or make a new one.</div>'
      + (list.length
          ? '<div class="rrlc-grid">' + list.map(function (c) {
              return '<div class="rrlc-item">'
                + '<div class="rrlc-prev" style="' + (rrLogoCardBg(c) ? 'background:' + rrLogoCardBg(c) : '') + '"'
                + ' onclick="window._rrlcChoose(\'' + c.id + '\')">' + rrLogoCardHtml(c, { imgMax: 46, fontSize: '0.6rem' }) + '</div>'
                + '<div class="rrlc-name">' + _esc(c.name) + '</div>'
                + '<div class="rrlc-row">'
                + '<button class="rrlc-btn" onclick="window._rrlcEdit(\'' + c.id + '\')">Edit</button>'
                + '<button class="rrlc-btn" onclick="window._rrlcDelete(\'' + c.id + '\')">Delete</button>'
                + '</div></div>';
            }).join('') + '</div>'
          : '<div class="rrlc-empty">No cards yet. Make one below — a small card is just your logo; a large one adds a line above and below it.</div>')
      + '<div class="rrlc-row" style="margin-top:0.9rem">'
      + '<button class="rrlc-btn rrlc-go" onclick="window._rrlcNew(\'small\')">＋ New small card</button>'
      + '<button class="rrlc-btn rrlc-go" onclick="window._rrlcNew(\'large\')">＋ New large card</button>'
      + '<button class="rrlc-btn" style="margin-left:auto" onclick="window._rrlcClose()">Close</button>'
      + '</div>';
  }

  // A new card starts from the skin the app is WEARING, so it looks like it
  // belongs before a single choice is made — and so this file holds no
  // colour of its own to drift from the theme.
  function _themeHex(name) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '';
    } catch (e) { return ''; }
  }
  function _editorHtml() {
    var c = _editing, large = c.size === 'large';
    var fonts = window.rrBrandFonts || [['', 'Default']];
    var col = /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : _themeHex('--text');
    var bg = /^#[0-9a-fA-F]{6}$/.test(c.bg) ? c.bg : _themeHex('--surface');
    var colAttr = col ? ' value="' + col + '"' : '';
    var bgAttr = bg ? ' value="' + bg + '"' : '';
    return '<div class="rrlc-h">' + (large ? 'Large card' : 'Small card') + '</div>'
      + '<div class="rrlc-2col">'
      + '<div>'
      +   '<div class="rrlc-drop" onclick="document.getElementById(\'rrlc-file\').click()">'
      +     (c.logo ? '<img src="' + c.logo.data + '" alt="">'
                    : '<span style="font-size:1.7rem">🖼</span><span>Paste, drop, or click<br>to add a logo</span>')
      +   '</div>'
      +   '<input type="file" id="rrlc-file" accept="image/*" style="display:none">'
      +   (c.logo && c.logo.kind && typeof window.rrLogoNote === 'function'
            ? '<div class="rrlc-note">' + _esc(window.rrLogoNote(c.logo.kind)) + '</div>' : '')
      + '</div>'
      + '<div>'
      +   '<label class="rrlc-l">Card name</label>'
      +   '<input class="rrlc-in" value="' + _esc(c.name) + '" maxlength="28" oninput="window._rrlcSet(\'name\',this.value)">'
      +   (large
            ? '<label class="rrlc-l">Line above the logo</label>'
              + '<input class="rrlc-in" value="' + _esc(c.top) + '" maxlength="40" placeholder="e.g. The Short Line" oninput="window._rrlcSet(\'top\',this.value)">'
              + '<label class="rrlc-l">Line below the logo</label>'
              + '<input class="rrlc-in" value="' + _esc(c.bottom) + '" maxlength="40" placeholder="e.g. Rail Collection" oninput="window._rrlcSet(\'bottom\',this.value)">'
              + '<label class="rrlc-l">Typeface</label>'
              + '<select class="rrlc-in" onchange="window._rrlcSet(\'font\',this.value)">'
              + fonts.map(function (f) {
                  return '<option value="' + _esc(f[0]) + '"' + (f[0] === c.font ? ' selected' : '')
                    + ' style="font-family:' + (f[0] || 'var(--font-head)') + '">' + _esc(f[1]) + '</option>';
                }).join('')
              + '</select>'
              + '<div class="rrlc-row">'
              + '<label class="rrlc-l" style="flex:1;margin:0">Text colour<input class="rrlc-col" type="color"' + colAttr + ' oninput="window._rrlcSet(\'color\',this.value)"></label>'
              + '<label class="rrlc-l" style="flex:1;margin:0">Card background<input class="rrlc-col" type="color"' + bgAttr + ' oninput="window._rrlcSet(\'bg\',this.value)"></label>'
              + '</div>'
            : '<div class="rrlc-note">A small card shows your logo and nothing else. Make a large one if you want words with it.</div>')
      + '</div>'
      + '</div>'
      + '<div class="rrlc-l" style="margin-top:0.7rem">How it will look</div>'
      + '<div class="rrlc-prev rrlc-prevbig" style="' + (rrLogoCardBg(c) ? 'background:' + rrLogoCardBg(c) : '') + '">'
      + rrLogoCardHtml(c) + '</div>'
      + '<div class="rrlc-row" style="margin-top:0.9rem">'
      + '<button class="rrlc-btn" onclick="window._rrlcBack()">← Back</button>'
      + '<button class="rrlc-btn rrlc-go" style="margin-left:auto" onclick="window._rrlcSave()">Save this card</button>'
      + '</div>';
  }

  function _loadLogo(file) {
    if (typeof window.rrPrepLogoFile !== 'function') return;
    window.rrPrepLogoFile(file, function (p) {
      if (!p) {
        if (typeof showToast === 'function') showToast('That didn’t look like an image file', 3000, true);
        return;
      }
      if (_editing) { _editing.logo = p; _render(); }
    });
  }

  // ── the handlers ─────────────────────────────────────────────────
  window._rrlcClose = _close;
  window._rrlcBack = function () { _editing = null; _render(); };
  window._rrlcNew = function (size) {
    var list = rrLogoCards();
    if (list.length >= MAX_LIBRARY) {
      if (typeof showToast === 'function') showToast('That is as many cards as one device keeps — delete one first', 3600, true);
      return;
    }
    _editing = _fill({ id: _nextId(list), size: size, name: _defaultName(list, size) });
    _render();
  };
  window._rrlcEdit = function (id) {
    var c = rrLogoCard(id); if (!c) return;
    _editing = _fill(c);
    _render();
  };
  window._rrlcSet = function (field, value) {
    if (!_editing) return;
    _editing[field] = String(value == null ? '' : value);
    // Re-rendering under a cursor would eat what is being typed, so only the
    // controls that cannot hold a cursor trigger a repaint.
    if (field === 'font' || field === 'color' || field === 'bg') _render();
    else _refreshPreview();
  };
  function _refreshPreview() {
    var el = document.querySelector('#rrlc-pop .rrlc-prevbig');
    if (!el || !_editing) return;
    el.style.background = rrLogoCardBg(_editing) || '';
    el.innerHTML = rrLogoCardHtml(_editing);
  }
  window._rrlcSave = function () {
    if (!_editing) return;
    var list = rrLogoCards(), i, found = -1;
    for (i = 0; i < list.length; i++) if (list[i].id === _editing.id) found = i;
    if (found >= 0) list[found] = _fill(_editing); else list.push(_fill(_editing));
    if (!_saveCards(list)) {
      if (typeof showToast === 'function') showToast('This device has no room left to keep another card', 4000, true);
      return;
    }
    var id = _editing.id;
    _editing = null;
    // Coming from a dashboard slot, saving should also fill that slot — the
    // user asked for a card there, not for a trip back to a list.
    if (_slotIdx >= 0) { _choose(id); return; }
    _render();
  };
  window._rrlcDelete = function (id) {
    var go = function () {
      _saveCards(rrLogoCards().filter(function (c) { return c.id !== id; }));
      _render();
      if (typeof buildDashboard === 'function') { try { buildDashboard(); } catch (e) {} }
    };
    // appConfirm returns a promise; it has never taken a callback. Passed one,
    // it silently became the options object and the answer went nowhere —
    // so Delete did nothing at all.
    if (typeof appConfirm === 'function') {
      appConfirm('Delete this card? Anywhere on the dashboard showing it will go back to “Choose a card”.',
        { title: 'Delete card', ok: 'Delete', danger: true })
        .then(function (yes) { if (yes) go(); });
    } else go();
  };
  function _choose(id) {
    if (_slotIdx >= 0 && typeof window.rrDashSetSlotCard === 'function') {
      window.rrDashSetSlotCard(_slotIdx, id);
    }
    _close();
    if (typeof buildDashboard === 'function') { try { buildDashboard(); } catch (e) {} }
  }
  window._rrlcChoose = _choose;
  window._rrlcOpen = _open;

  // ── exports the dashboard uses ───────────────────────────────────
  window.rrLogoCards = rrLogoCards;
  window.rrLogoCard = rrLogoCard;
  window.rrLogoCardHtml = rrLogoCardHtml;
  window.rrLogoCardBg = rrLogoCardBg;
  window.rrLogoCardsFill = _fill;
  window.rrLogoCardsNextId = _nextId;
})();
