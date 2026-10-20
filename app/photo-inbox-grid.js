// ═══════════════════════════════════════════════════════════════
// photo-inbox-grid.js — the Photo Inbox grid
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 6 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "yes"). Nothing
// in it changed: the floating grouping panel (and its never-destroy-a-group-by-surprise guard), the file map, the tile grid and its column count, select and tag mode, duplicate a photo, and the group-photo tint.
//
// One of the Photo Inbox's pieces: it loads with the others, right after
// photo-inbox.js and the pieces before it, and meets them only through
// window._pinShared (PIN — the shared values) and window._pinFns (PINF — the
// hand-over), both made by photo-inbox.js. The window._pin… entry points
// defined here are unchanged.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  var PIN = window._pinShared;   // the shared values — made by photo-inbox.js, which loads first
  var PINF = window._pinFns;     // the hand-over — made by photo-inbox.js
  // From app/photo-inbox.js:
  var _pinMetaSet = PINF.from('_pinMetaSet');
  var _pinKind = PINF.from('_pinKind');
  var _pinDefaultRoles = PINF.from('_pinDefaultRoles');
  var _pinCarryRole = PINF.from('_pinCarryRole');
  var _pinKindLabel = PINF.from('_pinKindLabel');
  var _pinVisibleGroups = PINF.from('_pinVisibleGroups');
  var _pinIsMultiPiece = PINF.from('_pinIsMultiPiece');
  var _pinRecFor = PINF.from('_pinRecFor');
  var _pinReadFid = PINF.from('_pinReadFid');
  var _pinGroupCaption = PINF.from('_pinGroupCaption');
  var _pinEraLabel = PINF.from('_pinEraLabel');
  var _pinCoverFid = PINF.from('_pinCoverFid');
  var _pinRenderFilters = PINF.from('_pinRenderFilters');
  var _pinFilterActive = PINF.from('_pinFilterActive');
  var _pinRenderBar = PINF.from('_pinRenderBar');
  var _navBadge = PINF.from('_navBadge');
  var _updateIdentifyBtn = PINF.from('_updateIdentifyBtn');
  var _pinBusyBounce = PINF.from('_pinBusyBounce');
  var _setBusy = PINF.from('_setBusy');
  var _status = PINF.from('_status');
  var _folder = PINF.from('_folder');
  var _pinMetaOf = PINF.from('_pinMetaOf');
  var _pinMetaSetMany = PINF.from('_pinMetaSetMany');
  var _pinAr = PINF.from('_pinAr');
  // Fixed settings from app/photo-inbox.js (handed over once it has loaded, never changed):
  var _PIN_KINDS = PINF._PIN_KINDS;
  var SETSTAGE_KEY = PINF.SETSTAGE_KEY;
  var PENDING_KEY = PINF.PENDING_KEY;
  var _PIN_TYPES = PINF._PIN_TYPES;
  // From the other pieces:
  var _pendList = PINF.from('_pendList');
  var _cropped = PINF.from('_cropped');
  var _croppedSave = PINF.from('_croppedSave');
  var _ids = PINF.from('_ids');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _pinOffline: _pinOffline, _render: _render, _pinNoteFileMap: _pinNoteFileMap, _pinConfirm: _pinConfirm, _pinOpaqueTint: _pinOpaqueTint, _selGroups: _selGroups, _pinOfflineRefuse: _pinOfflineRefuse });

  // "Group as…" — takes the ticked photos, gives them one group id, a kind and
  // a role each, and writes all of it to the Drive files.
  // ══ v0.9.1297 (Brad): grouping is a FLOATING PANEL, not a pop-over. ══════
  // "so i hit group photos, i select two or more photos, those thumbnails
  //  appear on a samll grid on the popup, and the i select what type they
  //  are, and hit an apply button. then i can select another group. I can
  //  scroll up and down and the pop up stays on the top right of the screen.
  //  there will also be a cancel and done button."
  //
  // The panel pins to the top-right (bottom of the screen on phones), fills
  // live as photos are ticked, and STAYS through Apply so the next group is
  // two taps away. Saving is the same v0.9.1050 machinery — one group id, a
  // kind, a role per photo — extracted into _pinGroupApply below so the old
  // dialog's behavior survives with a different roof over it.
  // v0.9.1615 (Brad): "the default should be one item not aba-a,b,a."
  var _grpPanelKind = 'single';
  var _grpPanelRoles = [];

  // The one writer for "make these photos a group" (was the dialog's save).
  // Returns {blocked:'detail'} without saving when the first photo is marked
  // as a detail shot — a detail chains to the photo ABOVE it, and the first
  // photo has nothing above.
  async function _pinGroupApply(files, kindId, roles, onProgress) {
    if (roles && roles[0] === 'detail') return { blocked: 'detail', ok: 0, total: files.length };
    var gid = 'G' + Date.now().toString(36);
    var okAll = 0;
    for (var i = 0; i < files.length; i++) {
      var ok = await _pinMetaSet(files[i].id, { grp: gid, kind: kindId, role: (roles && roles[i]) || '' });
      if (ok) okAll++;
      if (onProgress) { try { onProgress(i + 1, files.length); } catch (e) {} }
    }
    return { ok: okAll, total: files.length };
  }

  // ══ v0.9.1340 — grouping must not DESTROY a group by surprise ════════════
  // Brad tried to pull his already-made "Engine + tender · 3" tile into a train
  // set. Selection works on whole GROUPS, not photos, so that tap would have
  // dragged all three photos into the new set, minted a fresh id over them and
  // overwritten their kind and roles — the pairing gone, silently, with Split
  // apart as the only way back. The grouping itself is unchanged; it just says
  // so first.
  function _pinExistingGroupsIn(files) {
    var byGrp = {}, out = [];
    (files || []).forEach(function (f) {
      var g = (((f && f._meta) || {}).grp) || '';
      if (!g) return;
      (byGrp[g] = byGrp[g] || []).push(f);
    });
    Object.keys(byGrp).forEach(function (k) {
      if (byGrp[k].length > 1) {
        out.push({ grp: k, n: byGrp[k].length, kind: ((byGrp[k][0]._meta) || {}).kind || '' });
      }
    });
    return out;
  }
  // Re-tagging ONE existing group as itself is not a dissolve — no warning for
  // the commonest legitimate case (fixing the kind you picked last time).
  function _pinDissolveWarning(files, kindLabelOf) {
    var ex = _pinExistingGroupsIn(files);
    if (!ex.length) return '';
    if (ex.length === 1 && ex[0].n === (files || []).length) return '';
    var bits = ex.map(function (e) {
      var lbl = kindLabelOf ? kindLabelOf(e.kind) : e.kind;
      return '<b>' + (lbl || 'a group') + '</b> (' + e.n + ' photos)';
    });
    return 'This will break up ' + (ex.length === 1 ? 'an existing group' : ex.length + ' existing groups')
      + ' — ' + bits.join(' and ') + ' — and fold '
      + (ex.length === 1 ? 'its photos' : 'their photos') + ' into the new one. Continue?';
  }
  if (typeof window !== 'undefined') {
    window._pinExistingGroupsIn = _pinExistingGroupsIn;
    window._pinDissolveWarning = _pinDissolveWarning;
  }

  function _pinGrpPanelFiles() {
    var files = [];
    _selGroups().forEach(function (g) { g.files.forEach(function (f) { files.push(f); }); });
    return files;
  }

  function _pinGrpPanelClose() {
    var p = document.getElementById('pin-grp-panel');
    if (p) p.remove();
    // v0.9.1598: the sheet takes its clearance spacer with it.
    try {
      var _sp98c = document.getElementById('pin-grp-spacer');
      if (_sp98c) _sp98c.remove();
    } catch (ePad) {}
  }

  function _pinGrpPanelRender() {
    if (PIN._selPurpose !== 'group') { _pinGrpPanelClose(); return; }
    var files = _pinGrpPanelFiles();
    var k = _pinKind(_grpPanelKind);
    _grpPanelRoles = _grpPanelRoles.slice(0, files.length);
    while (_grpPanelRoles.length < files.length) {
      var _gi = _grpPanelRoles.length;
      var d = _pinDefaultRoles(_grpPanelKind, files.length);
      // v0.9.1448: a photo arriving from an existing pair group brings its
      // role with it (translated), instead of defaulting to "Other piece".
      var _cr = (_grpPanelKind === 'set') ? _pinCarryRole(files[_gi]) : '';
      _grpPanelRoles.push(_cr || d[_gi] || (k.roles.length ? k.roles[k.roles.length - 1][0] : ''));
    }
    var p = document.getElementById('pin-grp-panel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'pin-grp-panel';
      document.body.appendChild(p);
    }
    // Top-right on a desktop; docked to the bottom on a phone, where a fixed
    // right-hand card would sit on top of the grid being picked from.
    var narrow = (window.innerWidth || 0) < 700;
    p.style.cssText = narrow
      ? 'position:fixed;left:0;right:0;bottom:0;z-index:10040;background:var(--surface);border-top:2px solid var(--accent2);box-shadow:0 -4px 18px var(--scrim);padding:0.7rem 0.8rem;max-height:34vh;overflow-y:auto'
      : 'position:fixed;top:70px;right:16px;width:300px;z-index:10040;background:var(--surface);border:1.5px solid var(--accent2);border-radius:12px;box-shadow:0 6px 22px var(--scrim);padding:0.75rem 0.85rem;max-height:72vh;overflow-y:auto';
    // v0.9.1615 (Brad's circle around the panel sitting on his photos): on
    // desktop the card can be GRABBED by its title and moved; the spot is
    // remembered for the session, and every re-render (each tick re-paints
    // this panel) puts it back where he left it.
    if (!narrow && window._grpPanelPos) {
      try { p.style.left = window._grpPanelPos.left; p.style.top = window._grpPanelPos.top; p.style.right = 'auto'; } catch (eP) {}
    }
    // v0.9.1593 (Brad, phone screenshot): the seven-line explainer plus a
    // 45vh sheet left ZERO visible grid on a phone — "when grouping items on
    // your phone you cant see anything to be able to pick photos". On narrow
    // screens the sheet is capped at 34vh and the full explainer collapses
    // behind a ? toggle (one hint line stays). The TEXT itself is unchanged
    // and still rendered (display:none) — §282's promises stay pinned to it.
    var _grpHelpFull = 'Tap photos in the grid — they collect here. An AA, AB or ABA saves as separate items that stay linked. A set shot of everything together becomes the group\'s cover picture, and is never read for a number \u2014 it has several.' + ' In a train set, a photo showing a PAIR (engine + tender, AA, AB, ABA) files with the set\'s engine instead of becoming its own item. A paper or other collectible stays one item however many shots. Tap a thumbnail to see it full size.';
    var html =
      (narrow
        ? '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">'
          + '<span style="font-family:var(--font-head);font-size:0.95rem;font-weight:700">Group photos</span>'
          + '<span style="font-size:0.72rem;color:var(--text-dim);flex:1;min-width:0">Tap photos in the grid \u2014 they collect here.</span>'
          + '<button type="button" onclick="var h=document.getElementById(\'pin-grp-help-more\');if(h)h.style.display=h.style.display===\'none\'?\'\':\'none\'" aria-label="How grouping works" style="flex-shrink:0;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid);font-weight:700;font-size:0.8rem;line-height:1;cursor:pointer;padding:0">?</button>'
          + '</div>'
          + '<div id="pin-grp-help-more" style="display:none;font-size:0.74rem;color:var(--text-dim);line-height:1.45;margin-bottom:0.55rem">' + _grpHelpFull
            // v0.9.1598 diagnostic (temporary): the phone scroll ceiling has
            // resisted two blind fixes — these are the numbers a screenshot
            // of this panel hands back. Remove once the case closes.
            + '<div id="pin-grp-diag" style="margin-top:0.4rem;font-size:0.62rem;opacity:0.7">' + (function () {
                try {
                  var _mc = document.getElementById('main-content');
                  var _dr = document.getElementById('pin-drop');
                  var _gr = document.getElementById('pin-grid');
                  return 'diag ' + APP_VERSION + ': mc=' + (_mc ? _mc.clientHeight + '/' + _mc.scrollHeight + '@' + Math.round(_mc.scrollTop) : 'x')
                    + ' win=' + window.innerWidth + 'x' + window.innerHeight + '@' + Math.round(window.scrollY || 0)
                    + ' doc=' + Math.round((document.documentElement || {}).scrollHeight || 0)
                    + ' drop=' + (_dr ? _dr.offsetHeight : 'x') + ' grid=' + (_gr ? _gr.children.length : 'x');
                } catch (eD) { return 'diag unavailable'; }
              })() + '</div>'
            + '</div>'
        : '<div style="font-family:var(--font-head);font-size:0.95rem;font-weight:700;margin-bottom:0.15rem">Group photos</div>'
          + '<div style="font-size:0.74rem;color:var(--text-dim);line-height:1.45;margin-bottom:0.55rem">' + _grpHelpFull + '</div>')
      + (files.length
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:0.35rem;margin-bottom:0.6rem">'
            + files.map(function (f, i) {
                return '<div onmousedown="event.preventDefault()" onclick="event.stopPropagation();_pinZoomPhoto(\'' + f.id + '\')" title="Open this photo full size" style="position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;background:var(--surface2);cursor:zoom-in">'
                  + '<img data-gppfid="' + f.id + '" class="rr-fit" style="width:100%;height:100%;display:block" alt="">'
                  + '<div style="position:absolute;left:0;bottom:0;background:var(--scrim);color:#fff;font-size:0.55rem;padding:0 3px;border-radius:0 4px 0 0">' + (i + 1) + '</div>'
                  + '</div>';
              }).join('')
            + '</div>'
          : '<div style="font-size:0.78rem;color:var(--text-dim);font-style:italic;margin-bottom:0.6rem">Nothing selected yet.</div>')
      + '<select id="pin-grp-panel-kind" style="width:100%;padding:0.5rem 0.6rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.88rem;min-height:42px;box-sizing:border-box;margin-bottom:0.55rem">'
      +   _PIN_KINDS.map(function (kk) { return '<option value="' + kk.id + '"' + (kk.id === _grpPanelKind ? ' selected' : '') + '>' + rrEsc(kk.label) + '</option>'; }).join('')
      + '</select>'
      + (k.roles.length && files.length
          ? files.map(function (f, i) {
              return '<div style="display:flex;align-items:center;gap:0.45rem;padding:0.25rem 0;border-top:1px solid var(--border)">'
                + '<div onmousedown="event.preventDefault()" onclick="event.stopPropagation();_pinZoomPhoto(\'' + f.id + '\')" title="Open this photo full size" style="width:30px;height:30px;border-radius:5px;overflow:hidden;background:var(--surface2);flex-shrink:0;position:relative;cursor:zoom-in">'
                +   '<img data-gppfid="' + f.id + '" class="rr-fit" style="width:100%;height:100%;display:block" alt="">'
                +   '<div style="position:absolute;left:0;bottom:0;background:var(--scrim);color:#fff;font-size:0.5rem;padding:0 2px">' + (i + 1) + '</div>'
                + '</div>'
                + '<select data-gpri="' + i + '" class="pin-grp-panel-role" style="flex:1;min-width:0;padding:0.35rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.78rem;min-height:36px">'
                +   k.roles.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === _grpPanelRoles[i] ? ' selected' : '') + '>' + rrEsc(r[1]) + '</option>'; }).join('')
                + '</select></div>';
            }).join('')
          : (files.length ? '<div style="font-size:0.75rem;color:var(--text-dim);padding:0.25rem 0 0.45rem">All ' + files.length + ' photos will be filed as one item.</div>' : ''))
      + '<div style="display:flex;gap:0.4rem;margin-top:0.6rem">'
      +   '<button id="pin-grp-panel-apply" ' + (files.length >= 2 ? '' : 'disabled ') + 'style="flex:2;padding:0.6rem;border-radius:8px;border:none;background:' + (files.length >= 2 ? 'var(--accent)' : 'var(--surface2)') + ';color:' + (files.length >= 2 ? 'var(--on-accent)' : 'var(--text-dim)') + ';font-weight:700;font-size:0.88rem;min-height:44px;cursor:' + (files.length >= 2 ? 'pointer' : 'default') + '">Apply</button>'
      +   '<button id="pin-grp-panel-cancel" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:600;font-size:0.82rem;min-height:44px;cursor:pointer">Cancel</button>'
      +   '<button id="pin-grp-panel-done" style="flex:1;padding:0.6rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-weight:700;font-size:0.82rem;min-height:44px;cursor:pointer">Done</button>'
      + '</div>';
    p.innerHTML = html;
    // v0.9.1615: grab the title to move the desktop card out of the way.
    if (!narrow) {
      try {
        var _ttl = p.querySelector ? p.firstChild : null;
        var _hdr = null;
        // the title element is the first div carrying "Group photos"
        var _cands = p.querySelectorAll ? p.querySelectorAll('div') : [];
        for (var _h = 0; _h < _cands.length; _h++) { if (/Group photos/.test(_cands[_h].textContent || '')) { _hdr = _cands[_h]; break; } }
        if (_hdr) {
          _hdr.style.cursor = 'move';
          _hdr.title = 'Drag to move this panel';
          _hdr.onpointerdown = function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            var r = p.getBoundingClientRect();
            var ox = e.clientX - r.left, oy = e.clientY - r.top;
            function mv(ev) {
              var L = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - ox));
              var T = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - oy));
              p.style.left = L + 'px'; p.style.top = T + 'px'; p.style.right = 'auto';
              window._grpPanelPos = { left: L + 'px', top: T + 'px' };
            }
            function up() { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }
            document.addEventListener('pointermove', mv);
            document.addEventListener('pointerup', up);
            e.preventDefault();
          };
        }
      } catch (eDrag) {}
    }
    // v0.9.1598 (Brad: "i can't scroll down to see the last picture", still,
    // on a confirmed v1597): the clearance moves from PADDING (v1596 CSS
    // constant, v1597 measured inline — neither reached his device's scroll
    // ceiling) to a real SPACER ELEMENT after the grid, sized from the
    // sheet's measured height + the phone nav bar. A layout element's height
    // cannot be absorbed by any box-model or scroll-architecture quirk: if
    // the grid scrolls at all, it now scrolls past the sheet. Re-measured on
    // every paint (every tick re-renders this panel).
    try {
      if (narrow) {
        var _drop98 = document.getElementById('pin-drop');
        if (_drop98) {
          var _sp98 = document.getElementById('pin-grp-spacer');
          if (!_sp98) {
            _sp98 = document.createElement('div');
            _sp98.id = 'pin-grp-spacer';
            _drop98.appendChild(_sp98);
          }
          _sp98.style.cssText = 'height:' + ((p.offsetHeight || 260) + 110) + 'px;flex:0 0 auto;pointer-events:none';
        }
      }
    } catch (ePad) {}
    try {
      Array.prototype.forEach.call(p.querySelectorAll('img[data-gppfid]'), function (im) {
        loadDriveThumb(im.getAttribute('data-gppfid'), im, im.parentElement, null, 'hi');
      });
    } catch (eTh) {}
    var ks = document.getElementById('pin-grp-panel-kind');
    if (ks) ks.onchange = function () {
      _grpPanelKind = this.value;
      var _fs2 = _pinGrpPanelFiles();
      _grpPanelRoles = _pinDefaultRoles(_grpPanelKind, _fs2.length);
      // v0.9.1448: switching TO "Train set" re-runs the carry-over, so roles
      // from folded-in pair groups survive a kind change too.
      if (_grpPanelKind === 'set') {
        _fs2.forEach(function (f, i) { var c = _pinCarryRole(f); if (c) _grpPanelRoles[i] = c; });
      }
      _pinGrpPanelRender();
    };
    Array.prototype.forEach.call(p.querySelectorAll('.pin-grp-panel-role'), function (sel) {
      sel.onchange = function () { _grpPanelRoles[parseInt(this.getAttribute('data-gpri'), 10)] = this.value; };
    });
    var ap = document.getElementById('pin-grp-panel-apply');
    if (ap) ap.onclick = async function () {
      var files2 = _pinGrpPanelFiles();
      if (files2.length < 2) { showToast('Tick two or more photos first', 2800, true); return; }
      this.disabled = true; this.textContent = 'Saving…';
      var self = this;
      var _warn = _pinDissolveWarning(files2, _pinKindLabel);
      if (_warn) {
        var _goW = await _pinConfirm(_warn, 'Break up and regroup');
        if (!_goW) { self.disabled = false; self.textContent = 'Apply'; return; }
      }
      var res = await _pinGroupApply(files2, _grpPanelKind, _grpPanelRoles.slice(0, files2.length), function (done, total) {
        self.textContent = 'Saving… ' + done + '/' + total;
      });
      if (res.blocked === 'detail') {
        showToast('The first photo can\'t be a detail — mark the piece itself first, then its detail below it', 4500, true);
        self.disabled = false; self.textContent = 'Apply';
        return;
      }
      if (res.ok === res.total) showToast('Grouped as ' + _pinKindLabel(_grpPanelKind), 3000);
      else showToast('Grouped ' + res.ok + ' of ' + res.total + ' — try the rest again', 5000, true);
      // The panel STAYS — clear the ticks and the roles so the next group
      // starts clean, and refresh the grid behind it.
      PIN._sel = {}; _grpPanelRoles = [];
      _pinGrpPanelRender();
      _pinRefresh();
    };
    var cn = document.getElementById('pin-grp-panel-cancel');
    // v0.9.1306 (Brad: "cancel button doesn't work"): with nothing ticked,
    // Cancel cleared an already-empty selection and the popup just sat there.
    // One button, both expectations: ticks present → clear them and stay for
    // the next group (and SAY so); nothing ticked → close, same as Done.
    if (cn) cn.onclick = function () {
      var _had = _pinGrpPanelFiles().length;
      PIN._sel = {}; _grpPanelRoles = [];
      if (_had) {
        _render();
        _pinGrpPanelRender();
        showToast('Cleared — tap photos to start a new group', 2500);
      } else {
        window._pinFinishMode();
      }
    };
    var dn = document.getElementById('pin-grp-panel-done');
    if (dn) dn.onclick = function () { window._pinFinishMode(); };
  }


  window._pinConfirmUngroup = async function (key) {
    var g = null;
    PIN._groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || g.files.length < 2) return;
    var ok = await _pinConfirm('Split this back into ' + g.files.length
      + ' separate photos? Nothing is deleted \u2014 they just stop being one item.', 'Split apart');
    if (ok) window._pinUngroup(key);
  };

  // ── v0.9.1608 (Brad: "the photo doesn't go away once its added. i can
  // keep adding the same picture over and over") ───────────────────────
  // The photos of a saved add leave the inbox only when _flushPending
  // MOVES them — deliberately deferred since Session 168 so a cancelled
  // wizard costs nothing, and offline that deferral lasts until reconnect.
  // The gap: nothing SHOWED that a photo was already spoken for, so
  // re-adding it looked natural and minted duplicate items. This map reads
  // both note stores (staged + armed) and answers, per file id, which
  // item's add has claimed it. The tile wears it; _pinReviewAdd warns on it.
  function _pinNoteFileMap() {
    var map = {};
    try {
      [SETSTAGE_KEY, PENDING_KEY].forEach(function (storeKey) {
        var store = JSON.parse(localStorage.getItem(storeKey) || '{}');
        Object.keys(store).forEach(function (num) {
          var notes = (typeof _pendList === 'function') ? _pendList(store[num]) : [store[num]];
          notes.forEach(function (rec) {
            if (rec && typeof rec === 'object' && rec.files) {
              rec.files.forEach(function (f) { if (f && f.id && !map[f.id]) map[f.id] = num; });
            }
          });
        });
      });
    } catch (e) {}
    return map;
  }

  // v0.9.1776 (Brad, 2026-09-19): "lets just go two wide." The inbox grid used
  // to let `auto-fill` guess, and on a ~320pt phone — once the page margins and
  // the dashed drop-zone's padding come out — there was no room for two tiles
  // of 150px, so CSS gave him ONE. The Dashboard's inbox card never had this
  // problem because it COUNTS its columns rather than guessing.
  //
  // Same helper, so there is ONE rule and not two that drift apart. The card
  // and the Showcase keep their own numbers (104px, floor of 3) by passing
  // nothing; this page asks for larger tiles with a HARD floor of two.
  var PIN_COLS = { target: 150, min: 2, minLarge: 2 };
  function _pinApplyCols() {
    try {
      var grid = document.getElementById('pin-grid');
      if (!grid) return;
      var cols = (typeof window._dashPhotoCols === 'function')
        ? window._dashPhotoCols(grid, PIN_COLS)
        : Math.max(2, Math.floor((grid.clientWidth || 500) / PIN_COLS.target));
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    } catch (e) {}
  }
  // Rotating the phone changes the answer; a toolbar sliding away does not.
  // Debounced, registered once, and it does nothing at all when the inbox is
  // not on screen.
  // Guarded because this file is EVAL'd whole by photo-inbox-tests.js against a
  // stub `window` that has no addEventListener — and it threw there, which is
  // how this guard came to exist. A module must not need a real browser just to
  // finish loading.
  if (!window._pinColsHooked && typeof window.addEventListener === 'function') {
    window._pinColsHooked = true;
    var _pinColsT = null;
    window.addEventListener('resize', function () {
      if (_pinColsT) clearTimeout(_pinColsT);
      _pinColsT = setTimeout(_pinApplyCols, 150);
    });
  }

  function _render() {
    var grid = document.getElementById('pin-grid'), empty = document.getElementById('pin-empty');
    if (!grid) return;
    _pinApplyCols();
    var _noteMap = _pinNoteFileMap();
    // v0.9.1051: draw what passes the filters, but keep counting the whole inbox.
    var _vis = _pinVisibleGroups();
    // v0.9.1871 — the tour's three sample photos (config.js rrSampleRows): only on
    // an inbox KNOWN to be empty, and only in the DRAWN list. `total` below — the
    // menu badge, the remembered count, the Identify buttons — stays the collector's own.
    var _pinSmp = (PIN._pinHaveListing && !PIN._groups.length && typeof rrSampleRows === 'function') ? rrSampleRows('inbox', 0) : [];
    if (_pinSmp.length) _vis = _pinSmp;
    // v0.9.1609 (Brad: "can we not gray out the picture and push it to the
    // bottom of the list?"): claimed groups — photos an add in progress has
    // spoken for — SINK below the open ones. A stable partition, not a
    // sort: within each half the listing order (newest first) is untouched.
    var _visOpen9 = [], _visClaimed9 = [];
    _vis.forEach(function (g) {
      var claimed = false;
      for (var i9 = 0; i9 < g.files.length; i9++) { if (_noteMap[g.files[i9].id]) { claimed = true; break; } }
      (claimed ? _visClaimed9 : _visOpen9).push(g);
    });
    _vis = _visOpen9.concat(_visClaimed9);
    var total = 0;
    PIN._groups.forEach(function (g) { total += g.files.length; });
    grid.innerHTML = _vis.map(function (g) {
      var isSel = !!PIN._sel[g.key];
      // v0.9.1050: a stack says WHAT it is, not just how many photos.
      var _gk = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || 'single';
      // v0.9.1176: an untagged stack whose photos read different numbers is not
      // "1 item" either, whatever the kind field says.
      var _gkTxt = (_gk && _gk !== 'single') ? _pinKindLabel(_gk)
        : (g.files.length + ' photos · ' + (_pinIsMultiPiece(g) ? 'several items' : '1 item'));
      var chip = g.files.length > 1 ? '<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.66);color:#fff;font-size:0.62rem;font-weight:700;padding:1px 7px;border-radius:9px">' + rrEsc(_gkTxt) + (_gk !== 'single' ? ' · ' + g.files.length : '') + '</div>' : '';
      // v0.9.1608: a photo an add has already claimed says so on its face.
      var _claimedBy = '';
      for (var _ci = 0; _ci < g.files.length; _ci++) {
        if (_noteMap[g.files[_ci].id]) { _claimedBy = _noteMap[g.files[_ci].id]; break; }
      }
      // v0.9.1782: the badge is a BUTTON now. It used to be read-only, and its
      // tooltip blamed being offline \u2014 the one cause that was not Brad's when
      // he asked why two photos had been waiting eight days. Tap it to release.
      var claimBadge = _claimedBy
        ? '<div onclick="event.stopPropagation();_pinReleaseClaim(\'' + g.key + '\')" title="Waiting to move to item ' + rrEsc(_claimedBy) + ' when that add finishes saving. Tap to release it back to the inbox." style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.72);color:#ffd27d;font-size:0.6rem;font-weight:700;padding:1px 7px;border-radius:9px;cursor:pointer">\u23f3 \u2192 ' + rrEsc(_claimedBy) + '</div>'
        : '';
      var when = '';
      try { when = new Date(g.files[0].createdTime).toLocaleDateString(); } catch (e) {}
      // v0.9.886: AI suggestion (from Identify all) shows on the tile bar
      var sug = _pinRecFor(_pinReadFid(g)).rec;   // v0.9.1960: a one-item group's tile shows the number any of its photos was given
      var _altN = '';   // v0.9.902 (Brad): candidates but no confident number = still a lead, not "no read"
      if (sug && !sug.num && Array.isArray(sug.alts) && sug.alts.length) {
        var _a0 = String(sug.alts[0]); var _mm = _a0.match(/[0-9][0-9A-Za-z.\-\/]*/); _altN = _mm ? _mm[0] : _a0.slice(0, 12);
      }
      // v0.9.1176 (Brad): on a stack of several pieces the caption used to show
      // the FIRST readable photo's number, which reads as "this stack is a
      // 2328" — one member wearing the whole set's name. Say what the stack is
      // instead: the set it looks like, or how far the reading has got.
      if (_pinIsMultiPiece(g)) {
        when = '<span style="color:var(--info);font-weight:700">' + rrEsc(_pinGroupCaption(g)) + '</span> · ' + when;
      }
      else if (sug && sug.num && sug.guess) when = '<span style="color:#ffb454;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.898: hedged read, kept but marked
      else if (sug && sug.num) when = '<span style="color:#7ec3ef;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + '</span> · ' + when;   // v0.9.1920 (Brad, camera list #4): a SURE read (found in the catalog) shows plain — the "?" made a confident answer look doubtful; doubtful reads have their own orange "best guess" above
      else if (_altN) when = '<span style="color:#ffb454;font-weight:700">' + _altN.replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.902
      else if (sug && sug.tried) when = '<span style="color:#999">could not read</span> · ' + when;
      // v0.9.888 (Brad): click the photo = open the review (add / research /
      // discard); the corner circle is the multi-select toggle.
      // Default: clicking a tile opens Review. In Select-multiple mode, the tile
      // toggles selection (circles + crop appear/hide accordingly).
      var _tileClick = PIN._selectMode ? '_pinToggle' : '_pinReview';
      var _circle = PIN._selectMode
        ? '<div onclick="event.stopPropagation();_pinToggle(\'' + g.key + '\')" title="Select" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? '#2980b9' : 'rgba(255,255,255,0.75)') + ';background:' + (isSel ? '#2980b9' : 'rgba(0,0,0,0.35)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">' + (isSel ? '✓' : '') + '</div>'
        : '';
      // v0.9.1058 (Brad: "somehow we need to update the picture to show what it
      // is"). A tag you cannot see is a tag you cannot trust — after tagging 80
      // photos there was no way to tell whether it had worked.
      // v0.9.1060: the era badge sat at top-right, exactly where the group chip
      // ("Set · 7") already lives — they would have stacked on top of each other
      // the moment a grouped photo was also tagged. It goes in the bottom strip
      // instead, which already carries the number and the date and has room.
      var _m0 = (g.files[0] && g.files[0]._meta) || {};
      if (_m0.era) {
        when = '<span style="color:#7ec3ef;font-weight:700">' + rrEsc(_pinEraLabel(_m0.era)) + '</span> · ' + when;
      }
      var _crop = PIN._selectMode ? ''
        : '<div onclick="event.stopPropagation();_pinTileCrop(\'' + g.key + '\')" title="Crop / Rotate" style="position:absolute;right:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;cursor:pointer">✂</div>';
      // v0.9.1439 (Brad): "it would be nice to make a copy of a picture." The
      // real use is one photo showing two items — copy it, then crop each copy
      // to its own item. Deliberate, labelled, and undoable by discarding.
      var _copy = (PIN._selectMode || g.files.length > 1) ? ''
        : '<div onclick="event.stopPropagation();_pinTileCopy(\'' + g.key + '\')" title="Make a copy of this photo" style="position:absolute;right:34px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.78rem;cursor:pointer">⧉</div>';
      // v0.9.1057: grouping had no undo. Photos could be put together and never
      // taken apart, so one wrong tick was permanent. Only on stacks, only out
      // of select mode.
      var _ungroup = (PIN._selectMode || g.files.length < 2) ? ''
        : '<div onclick="event.stopPropagation();_pinConfirmUngroup(\'' + g.key + '\')" title="Split this group apart" style="position:absolute;left:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.9rem;cursor:pointer">⊟</div>';
      return '<div class="pin-tile" data-key="' + g.key + '"' + rrSampleAttrs(g) + ' onclick="' + _tileClick + '(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:var(--rr-photo-tile-ratio);border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        // v0.9.1871: a sample's picture is built into the app, not on Drive — src, and no data-fid for the Drive loader below
        '<img loading="lazy" ' + (rrIsSample(g) ? 'src="' + rrEsc(g._rrSample.photo) + '" title="' + rrEsc(g._rrSample.alt) + '"' : 'data-fid="' + _pinCoverFid(g) + '"') + ' class="rr-fit" style="width:100%;height:100%;object-position:center;display:block'
          // v0.9.1609: the filter rides the IMG, not the tile, so the amber
          // claim badge above it stays readable at full colour.
          + (_claimedBy ? ';filter:grayscale(85%);opacity:0.55' : '') + '" alt="">' +
        chip + claimBadge + rrSampleTag(g, 'rr-sample-tag-onphoto') +
        _circle +
        _crop +
        _copy +
        _ungroup +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);color:#ddd;font-size:0.6rem;padding:0.1rem 0.35rem">' + when + '</div>' +
        '</div>';
    }).join('');
    empty.style.display = (PIN._groups.length || _pinSmp.length) ? 'none' : 'block';   // v0.9.1871: three sample photos are not an empty inbox
    if (PIN._groups.length && !_vis.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:1.5rem 0;text-align:center;color:var(--text-dim);font-size:0.88rem">'
        + 'No photos match that filter. <button onclick="_pinClearFilters()" style="background:none;border:none;color:var(--t-accent);text-decoration:underline;cursor:pointer;font-size:0.88rem">Show all</button></div>';
    }
    try { _pinRenderFilters(); } catch (eF) {}
    var cnt = document.getElementById('pin-count');
    // v0.9.1051 (Brad counted 93, the label said 99): the grid draws one tile per
    // GROUP and the count summed FILES. Both were true and neither matched what
    // he could count, so say both.
    if (cnt) {
      var _items = PIN._groups.length;
      var _shown = _vis.length;
      cnt.textContent = !total ? ''
        : (_pinFilterActive()
            ? (_shown + ' of ' + _items + ' item' + (_items > 1 ? 's' : '') + ' shown')
            : (_items === total
                ? (total + ' photo' + (total > 1 ? 's' : '') + ' waiting')
                : (_items + ' item' + (_items > 1 ? 's' : '') + ' \u00b7 ' + total + ' photos waiting')));
    }
    grid.querySelectorAll('img[data-fid]').forEach(function (img) {
      // v0.9.1326: hand over the link the listing already gave us. A missing
      // entry passes null and degrades to the old per-file fetch, so a photo
      // Drive declined to thumbnail still behaves exactly as before.
      var _fid = img.getAttribute('data-fid');
      loadDriveThumb(_fid, img, img.parentElement, PIN._thumbLink[_fid] || null, 'hi');
    });
    _selInfo();
    try { _pinRenderBar(); } catch (eB) {}   // v0.9.1048; v0.9.1057 the bar decides its own visibility
    _navBadge(total);
    _updateIdAllBtn();
    try { _updateIdentifyBtn(); } catch (eRC) {}
    // v0.9.961 (Brad): keep the "cropped" marker set trimmed to files still in
    // the inbox (filed/discarded photos drop out), then republish to drive.js.
    try {
      if (PIN._groups.length) {   // only prune once photos have actually loaded
        var live = {}; PIN._groups.forEach(function (g) { g.files.forEach(function (f) { live[f.id] = 1; }); });
        var c = _cropped(), pruned = {}, changed = false;
        Object.keys(c).forEach(function (fid) { if (live[fid]) pruned[fid] = 1; else changed = true; });
        if (changed) _croppedSave(pruned); else window._rrForceFreshBytes = c;
      } else {
        window._rrForceFreshBytes = _cropped();
      }
    } catch (ePr) {}
  }

  // v0.9.956 (Brad): the gold "Read with a token" button only appears when there
  // are leftover photos the free reader couldn't place — and it says exactly
  // how many, so a paid batch never runs by surprise. Free auto-read handles
  // the easy ones for nothing; this button is the deliberate "spend a credit
  // on the ones that are left" step.
  function _updateIdAllBtn() {
    var b = document.getElementById('pin-idall-btn');
    if (!b) return;
    var ids = _ids();
    var n = PIN._groups.filter(function (g) { return !_pinRecFor(_pinReadFid(g)).rec; }).length;   // v0.9.1960: identified on any photo = identified
    // v0.9.1436 (Brad): "get rid of the paid ai reader button here. we will
    // keep it on the individual photo add page." The batch paid-read button is
    // retired from the toolbar (and from the phone's More menu, which only
    // existed to reach it) — the paid read now lives solely on the review
    // card's "Read this photo (1 photo ID)", where the cost is one photo,
    // stated on the button, for the photo you are looking at.
    b.style.display = 'none';
    var mb = document.getElementById('pin-more-btn');
    if (mb) mb.dataset.pinHas = '';
  }

  // v0.9.956 (Brad): a plain in-app confirm so a paid batch always asks first.
  // Returns a promise that resolves true (go) or false (cancel). No browser
  // confirm() dialog — that would freeze the extension bridge.
  function _pinConfirm(msg, okLabel) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1.2rem';
      ov.innerHTML =
        '<div class="rr-card">' +
          '<div style="font-size:0.92rem;color:var(--text-mid);line-height:1.55;margin-bottom:1.1rem">' + msg + '</div>' +
          '<div style="display:flex;gap:0.6rem;justify-content:flex-end">' +
            '<button id="_pcc" style="padding:0.5rem 1rem;border-radius:8px;border:1.5px solid #8b8e94;background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));color:var(--text-mid);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Not now</button>' +
            '<button id="_pco" style="padding:0.5rem 1.1rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">' + (okLabel || 'Continue') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      function done(v) { try { ov.remove(); } catch (e) {} resolve(v); }
      ov.querySelector('#_pcc').onclick = function () { done(false); };
      ov.querySelector('#_pco').onclick = function () { done(true); };
      rrDismissGuard(ov, function () { done(false); });   // v0.9.1791: the backdrop closes nothing (Brad: "never close if you pick outside")
    });
  }

  // v0.9.900 (Brad): crop straight from the grid tile — one-photo items open
  // the cropper directly; multi-photo stacks open the review card, where every
  // photo has its own ✂.
  // ══ v0.9.1439 — duplicate a photo ═══════════════════════════════════
  // Drive copies the file server-side (no download/re-upload), so a 4 MB photo
  // costs one request and the pixels never touch this device. The copy keeps
  // the original's tags — era, type, view — because a duplicate of a tagged
  // photo is still that maker, that era, that side of the item. It deliberately
  // does NOT keep the group tag: the copy is a new, separate thing, and
  // inheriting a group would silently add a photo to an item you already filed.
  window._pinTileCopy = async function (key) {
    if (PIN._busy) { _pinBusyBounce(); return; }
    var g = PIN._groups.filter(function (x) { return x.key === key; })[0];
    var src = g && g.files && g.files[0];
    if (!src) { showToast('Could not find that photo', 2600, true); return; }
    _setBusy(true, 'Copying a photo');
    _status('Making a copy\u2026');
    try {
      var fid = await _folder();
      var base = String(src.name || 'photo');
      var dot = base.lastIndexOf('.');
      var stem = dot > 0 ? base.slice(0, dot) : base;
      var ext = dot > 0 ? base.slice(dot) : '.jpg';
      // The name carries INBOX + a fresh timestamp so the copy is its own item
      // and never re-joins the original's filename-derived group (v0.9.1132).
      var name = 'INBOX ' + new Date().getTime() + ' ' + stem + ' copy' + ext;
      var res = await driveRequest('POST', '/files/' + src.id + '/copy?fields=id',
        { name: name, parents: [fid] });
      if (!res || !res.id) throw new Error('no id back');
      var m = _pinMetaOf(src) || {};
      var patch = {};
      if (m.era) patch.era = m.era;
      if (m.type) patch.type = m.type;
      if (m.view) patch.view = m.view;
      if (m.era) patch.stat = 'stamped';
      if (Object.keys(patch).length) { try { await _pinMetaSet(res.id, patch); } catch (eM) {} }
      showToast('Copied \u2014 crop each one to its own item', 3600);
    } catch (e) {
      console.warn('[inbox] copy failed', e && e.message);
      showToast('Could not copy that photo \u2014 try again', 3600, true);
    } finally {
      _setBusy(false);
      _status('');
    }
    await window._pinRefresh();
  };

  window._pinTileCrop = function (key) {
    var g = PIN._groups.filter(function (x) { return x.key === key; })[0];
    if (!g || !g.files.length) return;
    if (g.files.length === 1) return window._pinCropPhoto(g.files[0].id);
    window._pinReview(key);
    showToast('Several photos in this item — use the ✂ on the one you want to crop', 3000);
  };

  window._pinToggle = function (key) {
    if (PIN._sel[key]) delete PIN._sel[key]; else PIN._sel[key] = true;
    _render();
  };

  // Select all / Deselect all (only meaningful in select mode).
  // v0.9.1057: acts on what is VISIBLE, not on everything. That is what makes
  // the filter chips do the heavy lifting — narrow to "Not touched yet", Select
  // all, Apply, and 43 photos are tagged in four taps. Selecting hidden photos
  // would have been an invisible edit, which is the worst kind.
  window._pinSelectAll = function () {
    var vis = _pinVisibleGroups();
    var allSel = vis.length && vis.every(function (g) { return PIN._sel[g.key]; });
    PIN._sel = {};
    if (!allSel) vis.forEach(function (g) { PIN._sel[g.key] = true; });
    _render();
  };

  // Both named buttons run the SAME selection mechanic — circles on the tiles,
  // Select all, a running count, Finished — and differ only in what Apply does.
  // One thing to learn, two jobs.
  window._pinStartMode = function (purpose) {
    if (PIN._selPurpose === purpose) return window._pinFinishMode();
    // switching between the two modes is not "leaving", so no warning here
    PIN._selPurpose = purpose;
    PIN._selectMode = true;
    PIN._sel = {};
    if (purpose === 'tag' && !PIN._tagEra) PIN._tagEra = PIN._sessionEra || '';
    _render();
    // v0.9.1297: group mode opens the floating panel immediately (empty, so
    // its blurb explains the flow); any other mode closes it.
    try { if (purpose === 'group') _pinGrpPanelRender(); else _pinGrpPanelClose(); } catch (eGP) {}
    // v0.9.1593: on a phone the toolbar above + the sheet below left no grid
    // in view — scroll the photos to the top so what remains is tappable.
    try {
      if (purpose === 'group' && (window.innerWidth || 0) < 700) {
        var _gd = document.getElementById('pin-drop');
        if (_gd && _gd.scrollIntoView) _gd.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch (eSV) {}
  };

  function _pinCloseMode() {
    PIN._selPurpose = '';
    PIN._selectMode = false;
    PIN._sel = {};
    try { _pinGrpPanelClose(); } catch (eGP) {}
    _render();
  }

  // v0.9.1060 (Brad: "the finished button needs to throw up a warning if nothing
  // has changed as in i didn't hit apply"). Apply CLEARS the ticks, so ticks
  // still sitting there when you press Finished means exactly one thing: that
  // selection was never applied to anything. No extra state to get out of step
  // — the ticks are the evidence.
  window._pinFinishMode = async function () {
    var n = 0;
    _selGroups().forEach(function (g) { n += g.files.length; });
    if (n > 0) {
      var what = PIN._selPurpose === 'tag'
        ? 'tagged with a manufacturer, era and scale'
        : 'put into a group';
      var ok = await _pinConfirm(
        '<b>' + n + ' photo' + (n > 1 ? 's are' : ' is') + ' still selected and '
        + (n > 1 ? 'have' : 'has') + ' not been ' + what + '.</b><br><br>'
        + 'Pressing Apply is what saves the change \u2014 Finished only closes this mode. '
        + 'Leave now and the selection is dropped.',
        'Leave without saving');
      if (!ok) return;                 // stay put, ticks intact
    }
    _pinCloseMode();
  };

  // Kept so nothing that still calls the old name breaks.
  window._pinToggleSelectMode = function () {
    if (PIN._selectMode) return window._pinFinishMode();
    return window._pinStartMode('group');
  };
  window._pinCloseModeNow = _pinCloseMode;   // used by tests and by Apply

  // ── Tag mode: one era onto every ticked photo ───────────────────────────
  function _pinRenderTagBar() {
    var el = document.getElementById('pin-tagbar');
    if (!el) return;
    if (PIN._selPurpose !== 'tag') {
      el.style.display = 'none';
      var ap0 = document.getElementById('pin-apply-btn');
      if (ap0) ap0.style.display = 'none';
      return;
    }
    var n = 0, changing = 0;
    _selGroups().forEach(function (g) {
      g.files.forEach(function (f) {
        n++;
        var m = _pinMetaOf(f);
        // v0.9.1432: only meaningful once an era is chosen. With _tagEra empty
        // this compared every photo's era against '' and announced "N of those
        // will be changed" on a bar that could not apply anything yet.
        if (PIN._tagEra && m && m.era && m.era !== PIN._tagEra) changing++;
      });
    });
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;'
      + 'padding:0.55rem 0.75rem;border-radius:10px;border:2px solid rgba(41,128,185,0.55);'
      + 'background:rgba(41,128,185,0.08)';
    // v0.9.1432 (Brad: "the apply button doesn't work" — it was DISABLED).
    // ready used to require an era, and !ready set apb.disabled, so clicking
    // with "Tag as: Not set" did nothing at all — the explaining toast lives
    // inside the handler a disabled button can never reach. v0.9.1418 removed
    // this trap's twin INSIDE the handler; this was the same trap one layer
    // up. Type-only tagging now counts as ready too ("Engine" with no era),
    // and the button is NEVER disabled — an unready click walks the user to
    // what's missing instead of ignoring them.
    var ready = n > 0 && (!!PIN._tagEra || !!PIN._tagType);
    // v0.9.1060 (Brad: "the apply button needs to be to the left of the finished
    // button. its lost where its at."). Apply lives in the toolbar beside
    // Finished now — the two decisions that end this mode sit together.
    var apb = document.getElementById('pin-apply-btn');
    if (apb) {
      apb.style.display = '';
      apb.disabled = false;   // v0.9.1432: never — see note above
      apb.textContent = 'Apply' + (n ? ' to ' + n : '');
      if (ready) apb.style.background = 'var(--accent)';
      else _pinOpaqueTint(apb, '139,142,148', 25);   // v0.9.1282
      apb.style.color = ready ? '#fff' : 'var(--text-dim)';
      apb.style.cursor = 'pointer';
    }
    el.innerHTML =
      '<span style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:700">Tag as</span>'
      + '<button onclick="_pinPickTagEra()" style="flex:1;min-width:150px;text-align:left;padding:0.45rem 0.7rem;border-radius:8px;'
        + 'border:1.5px solid ' + (PIN._tagEra ? '#2980b9' : 'var(--border)') + ';background:' + (PIN._tagEra ? '#f7f0dc' : 'var(--bg)') + ';'
        + 'color:' + (PIN._tagEra ? 'var(--t-link)' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
        + rrEsc(_pinEraLabel(PIN._tagEra)) + ' \u25be</button>'
      // v0.9.1297 (Brad: "on the tag, lets add type to it as well. so i can
      // put paper, or boxcar or whatever"). '' = leave each photo's type
      // as-is, so tagging an era never silently blanks a type set earlier.
      + '<select id="pin-tag-type" style="min-width:130px;padding:0.45rem 0.55rem;border-radius:8px;'
        + 'border:1.5px solid ' + (PIN._tagType ? '#2980b9' : 'var(--border)') + ';background:var(--bg);'
        + 'color:' + (PIN._tagType ? 'var(--t-link)' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">'
        + '<option value="">Type: (leave as-is)</option>'
        + _PIN_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === PIN._tagType ? ' selected' : '') + '>' + t + '</option>'; }).join('')
      + '</select>'
      + (changing
          ? '<span style="font-size:0.74rem;color:#ffb454;font-weight:600;width:100%">'
            + changing + ' of those already ' + (changing === 1 ? 'has' : 'have') + ' a different era and will be changed</span>'
          : '');
    var _tt = document.getElementById('pin-tag-type');
    if (_tt) _tt.onchange = function () { PIN._tagType = this.value; };
  }

  window._pinPickTagEra = function () {
    window._pinPickContext({
      title: 'Tag these photos as\u2026',
      blurb: 'This gets saved with each ticked photo, so the app knows which catalog to look in.',
      okLabel: 'Use this',
      onPick: function (era) { PIN._tagEra = era; _pinRenderTagBar(); },
    });
  };

  // Applies to every FILE in every ticked group — an engine and its tender are
  // one item and must not end up with different makers.
  window._pinApplyTags = async function () {
    // v0.9.1418 (Cooper): THE reported bug. This was a bare `return` — the
    // Apply button's only silent exit, and the one he hit eight times.
    if (PIN._busy) { _pinBusyBounce(); return; }
    var ids = [];
    _selGroups().forEach(function (g) { g.files.forEach(function (f) { ids.push(f.id); }); });
    if (!ids.length) { showToast('Tick some photos first', 2400, true); return; }
    // v0.9.1432: with nothing chosen, the click OPENS the era picker instead
    // of toasting about it — the click becomes the fix, not a dead end.
    if (!PIN._tagEra && !PIN._tagType) { _pinPickTagEra(); return; }
    _setBusy(true, 'Tagging photos');
    var label = (PIN._tagEra ? _pinEraLabel(PIN._tagEra) : '') + (PIN._tagEra && PIN._tagType ? ' \u00b7 ' : '') + (PIN._tagType || '');
    _status('Tagging ' + ids.length + ' photo' + (ids.length > 1 ? 's' : '') + '\u2026');
    var ok = 0;
    try {
      // v0.9.1297: the Type rides with the era when one is picked; '' means
      // "leave as-is" and is deliberately NOT sent, so it can never blank a
      // type that an earlier tagging pass set.
      // v0.9.1432: send only what is SET, in both directions. Type-only
      // tagging ("Engine", era untouched) mirrors the v0.9.1297 rule that an
      // empty Type is never sent — an empty era now isn't either. And the
      // 'stamped' status rides ONLY with an era: _pinStatusOf derives status
      // from era presence, so a type-only patch claiming 'stamped' would show
      // in the Tagged filter with no era behind it.
      var _patch = {};
      if (PIN._tagEra) { _patch.era = PIN._tagEra; _patch.stat = 'stamped'; }
      if (PIN._tagType) _patch.type = PIN._tagType;
      ok = await _pinMetaSetMany(ids, _patch, function (done) {
        _status('Tagging ' + done + ' of ' + ids.length + '\u2026');
      });
    } catch (e) {
      console.warn('[inbox] tagging failed', e && e.message);
    } finally {
      // v0.9.1325: was a bare `_busy = false` here. Two statements run BEFORE
      // the try (the label build and the _status call), so a throw in either
      // left _busy stuck and every batch button in the inbox answered "still
      // working on the last batch…" until a reload. This was the last of the
      // seven _busy writers in this file without a finally.
      _setBusy(false);
      _status('');
    }
    // Say what actually happened. A partial write reported as a win is the bug
    // this app has been burned by before.
    if (ok === ids.length) showToast('Tagged ' + ok + ' photo' + (ok > 1 ? 's' : '') + ' as ' + label, 3200);
    else showToast('Tagged ' + ok + ' of ' + ids.length + ' \u2014 the rest did not save, try again', 4200, true);
    PIN._sel = {};                 // clear the ticks, STAY in tag mode for the next batch
    await window._pinRefresh();
  };

  // ══ v0.9.1282 (Brad: "you can see the logo through group photos and tag
  // photo") — THE THIRD PAINTER. v0.9.1273 fixed the markup, v0.9.1274 fixed
  // the stylesheet, and these buttons were still see-through because
  // JavaScript repaints them on every selection change — and the FIRST time
  // JS touches an element's style, the browser re-serialises the style
  // attribute, "#2980b9" becomes "rgb(41, 128, 185)", and the v0.9.869
  // lever's [style*="#2980b9"] selector silently stops matching. The lever's
  // opaque background walks away at the exact moment a translucent JS wash
  // is painted on. Every JS tint goes through this helper now: fallback
  // first, then the mix — a browser without color-mix keeps the opaque
  // fallback, exactly like the two-declaration markup pattern.
  function _pinOpaqueTint(el, rgbCsv, pct) {
    el.style.background = 'var(--bg-card)';
    el.style.background = 'color-mix(in srgb, rgb(' + rgbCsv + ') ' + pct + '%, var(--bg-card))';
  }

  function _selGroups() { return PIN._groups.filter(function (g) { return PIN._sel[g.key]; }); }

  function _selInfo() {
    var gs = _selGroups(), n = 0;
    gs.forEach(function (g) { n += g.files.length; });
    var info = document.getElementById('pin-selinfo');
    var ab = document.getElementById('pin-assign-btn'), db = document.getElementById('pin-discard-btn');
    var ib = document.getElementById('pin-idsel-btn');   // v0.9.897 (Brad): identify just the ticked photos
    if (info) info.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' selected') : (PIN._selectMode ? 'Tap photos to select' : '');
    var sa = document.getElementById('pin-selall-btn');
    if (sa) {
      sa.style.display = PIN._selectMode ? '' : 'none';
      var vis = _pinVisibleGroups();
      var allSel = vis.length && vis.every(function (g) { return PIN._sel[g.key]; });
      sa.textContent = allSel ? 'Deselect all' : 'Select all';
    }
    // v0.9.1057: which actions show depends on WHY you are selecting.
    var isGroup = PIN._selPurpose === 'group', isTag = PIN._selPurpose === 'tag';
    // v0.9.1594 (Brad, second phone screenshot: "when you select, the other
    // buttons become too much too"). While GROUPING on a phone the toolbar
    // slims to what grouping needs — Finished, Select all, the count, and
    // Combine (which exists only in group mode, so it must stay reachable).
    // The class is the whole mechanism; app.css hides the rest behind a
    // max-width media query, so desktop never changes and every button's
    // own display logic is untouched underneath.
    try {
      var _pgSlim = document.getElementById('page-photo-inbox');
      if (_pgSlim && _pgSlim.classList) _pgSlim.classList.toggle('pin-grp-slim', isGroup && PIN._selectMode);
    } catch (eSl) {}
    if (ab) ab.style.display = (isGroup && gs.length > 1) ? '' : 'none';   // combine needs 2+ items
    // v0.9.1297: the "Group as…" toolbar button is gone — the floating panel
    // IS the grouping surface, and every tick repaints it.
    if (isGroup) { try { _pinGrpPanelRender(); } catch (eGP) {} }
    // Discard and Read stay available in both modes — you are already looking
    // at photos with ticks on them, and binning the junk is the same gesture.
    //
    // v0.9.1325: gated on _selectMode as well as the count. These two are the
    // only buttons here that SPEND or DESTROY, and they used to arm on the
    // count alone — so any stray entry left in `_sel` outside select mode
    // offered them against photos with no tick drawn anywhere. The root leak
    // is fixed (see _pinReviewDiscard), and this makes the class impossible:
    // no ticks visible, no destructive button.
    if (db) db.style.display = (PIN._selectMode && n) ? '' : 'none';
    if (ib) {
      ib.style.display = (PIN._selectMode && n && _pinAr()) ? '' : 'none';   // v0.9.1927: paid — beta feature
      // v0.9.1351: say the COST on the button, not only in the confirm dialog.
      // This is the same purchase as "Read this photo (1 photo ID)" on the card
      // and the toolbar's "Read the N still unread" — one word, "Read", for all
      // three, and the price visible before the click rather than after it.
      ib.textContent = (n === 1) ? 'Read this · 1 photo ID'
                                 : 'Read these ' + n + ' · ' + n + ' photo IDs';
    }
    var fb = document.getElementById('pin-finish-btn');
    if (fb) fb.style.display = PIN._selectMode ? '' : 'none';
    [['pin-group-btn', isGroup], ['pin-tag-btn', isTag]].forEach(function (p) {
      var b = document.getElementById(p[0]);
      if (!b) return;
      _pinOpaqueTint(b, p[1] ? '41,128,185' : '139,142,148', p[1] ? 18 : 12);   // v0.9.1282: opaque, see _pinOpaqueTint
      b.style.borderColor = p[1] ? '#2980b9' : '#8b8e94';
      b.style.display = (PIN._selectMode && !p[1]) ? 'none' : '';
    });
    try { _pinRenderTagBar(); } catch (eT) {}
  }

  // ── v0.9.1589: OFFLINE = REFUSE UP FRONT (Session 87, Brad's airplane
  // test). Photos added offline used to run the whole upload loop, fail file
  // by file, and vanish — the app looked like it accepted them (S86 finding).
  // Until local staging exists, every door into the inbox refuses an offline
  // add before touching a single file, and says so plainly. Both flavours of
  // offline count: an offline BOOT (window._offlineMode, view-only snapshot)
  // and airplane mode flipped on mid-session (navigator.onLine === false) —
  // the same dual check the dashboard uses.
  function _pinOffline() {
    return !!(window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false));
  }
  function _pinOfflineRefuse(doing) {
    if (!_pinOffline()) return false;
    showToast('You\u2019re offline \u2014 ' + doing + ' needs a connection. Nothing was added; reconnect and try again.', 4500, true);
    return true;
  }
})();
