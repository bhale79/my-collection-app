// ═══════════════════════════════════════════════════════════════════════════
// collections-ui.js — v0.9.2071, TRR Pro release 5: COLLECTIONS YOU CAN SEE
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Step 3:
// Section 1 "what a collection is", Section 2 "the drop-down", Section 4
// "safety rules"); [stated] Brad 2026-10-30 17:42 CT "yes" to building it.
//
// The screens only — the data and every rule are in collections.js:
//   the drop-down beside the logo   rrCollUiPaint / rrCollMenuOpen
//   + New collection                rrCollNewOpen  → rrCreateCollection
//   the details card                rrCollDetailsOpen → rrUpdateCollection
//   the client header               rrCollHeaderPaint (folds to one line on a phone)
//   "Adding to 7 – Hale"            rrAddingToHtml (wizard.js draws it)
//   at start                        rrCollectionsBoot (app-data.js, after the first load)
//
// ON only through rrFeatureOn(RR_COLL_UI.feature): the owners first, a Pro
// business when the Vault says so. A regular customer never sees any of it.
//
// PRIVACY ([stated] agreed 2026-10-28): the client's details (name, phone,
// email, address) are read ONLY through rrCollectionClient() here, and are
// shown ONLY on these screens. Nothing that is shared outward (the For Sale
// sheet and its cards, share cards, reports sent out) may call it — a test
// fails if one does (collections_ui_2071_tests.js P).
// Every word: RR_COLL_UI.words (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function U() { return (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI) || root.RR_COLL_UI || { words: {}, lists: [], starts: [], fieldTypes: [] }; }
  function W(k, vars) {
    var w = String((U().words || {})[k] || '');
    Object.keys(vars || {}).forEach(function (v) { w = w.split('{' + v + '}').join(String(vars[v])); });
    return w;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function phone() { try { return typeof rrIsPhone === 'function' && rrIsPhone(); } catch (e) { return false; } }

  function rrCollUiOn() {
    try { return typeof rrFeatureOn === 'function' && rrFeatureOn(U().feature); } catch (e) { return false; }
  }
  function _label(c) {
    if (!c || c.home) return W('home');
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }

  // ── PRIVACY: THE one way to the client's details ──────────────────────
  // Contacts always come from the HOME collection (collections.js). Returns
  // the contact or null. Screens of THIS file only.
  function rrCollectionClient(c) {
    try {
      var id = c && c.clientId;
      if (!id) return null;
      var list = (typeof state !== 'undefined' && state && state.contactsData) || [];
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    } catch (e) {}
    return null;
  }
  function _clientName(c) {
    var p = rrCollectionClient(c);
    return p ? (p.name || p.business || '') : '';
  }

  // ── at start ───────────────────────────────────────────────────────────
  var _booted = false, _data = null;
  async function rrCollectionsBoot() {
    if (!rrCollUiOn()) { rrCollUiPaint(); return; }
    if (_booted) { rrCollUiPaint(); return; }
    _booted = true;
    try { _data = await rrCollectionsLoad(); } catch (e) { _data = null; }
    try {
      var k = (typeof rrRememberedCollectionKey === 'function') ? rrRememberedCollectionKey() : 'home';
      var cur = rrCurrentCollection();
      if (k && cur && k !== cur.key) await _switchTo(k, { quiet: true });
      else if (typeof rrApplyListSwitches === 'function') rrApplyListSwitches();
    } catch (e) {}
    rrCollUiPaint();
  }

  // ── the button beside the logo + the client header ─────────────────────
  function rrCollUiPaint() {
    var slot = (typeof document !== 'undefined') && document.getElementById('rr-coll-slot');
    if (!slot) return;
    if (!rrCollUiOn()) { slot.innerHTML = ''; rrCollHeaderPaint(); return; }
    var c = rrCurrentCollection();
    slot.innerHTML = '<button id="rr-coll-btn" type="button" aria-haspopup="true" onclick="rrCollMenuOpen()" title="' + esc(W('title')) + '" ' +
      'style="max-width:' + (phone() ? '42vw' : '28rem') + ';min-height:40px;padding:0.35rem 0.8rem;border-radius:10px;border:1px solid var(--border);' +
      'background:var(--surface2);color:var(--text);font-family:var(--font-head);font-size:' + (phone() ? '1rem' : '1.25rem') + ';font-weight:700;' +
      'cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-self:center">' +
      esc(W('button', { label: _label(c) }) || (_label(c) + ' ▾')) + '</button>';
    rrCollHeaderPaint();
  }

  var _headerOpen = null;   // null = the screen's own default (folded on a phone)
  function rrCollHeaderPaint() {
    if (typeof document === 'undefined') return;
    var main = document.getElementById('main-content');
    var old = document.getElementById('rr-coll-header');
    var c = (typeof rrCurrentCollection === 'function') ? rrCurrentCollection() : null;
    if (!main || !c || c.home || !rrCollUiOn()) { if (old) old.remove(); return; }
    var p = rrCollectionClient(c);
    var open = (_headerOpen == null) ? !phone() : _headerOpen;
    var btn = 'display:inline-flex;align-items:center;min-height:36px;padding:0.25rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);font-size:0.82rem;font-weight:600;text-decoration:none;cursor:pointer';
    var line = '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' +
      '<span style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:var(--text)">' + esc(_label(c)) + '</span>' +
      (p ? '<span style="color:var(--text-dim);font-size:0.9rem">' + esc(p.name || p.business || '') + '</span>' : '<span style="color:var(--text-dim);font-size:0.85rem">' + esc(W('clientNone')) + '</span>') +
      '<span style="flex:1"></span>' +
      (p && (p.cellPhone || p.phone) ? '<a href="tel:' + esc(String(p.cellPhone || p.phone).replace(/[^0-9+]/g, '')) + '" style="' + btn + '">' + esc(W('clientCall')) + '</a>' : '') +
      (p && p.email ? '<a href="mailto:' + esc(p.email) + '" style="' + btn + '">' + esc(W('clientEmail')) + '</a>' : '') +
      '<button type="button" onclick="rrCollDetailsOpen(' + (typeof rrJsArg === 'function' ? rrJsArg(c.key) : "'" + c.key + "'") + ')" style="' + btn + '">' + esc(W('details')) + '</button>' +
      '<button type="button" onclick="rrCollHeaderFold()" aria-expanded="' + (open ? 'true' : 'false') + '" style="' + btn + '">' + esc(open ? W('clientLess') : W('clientMore')) + '</button>' +
      '</div>';
    var more = '';
    if (open) {
      var rows = [];
      if (p) {
        if (p.business && p.name) rows.push(esc(p.business));
        var ph = [p.cellPhone, p.phone, p.homePhone].filter(Boolean);
        if (ph.length) rows.push(esc(ph.join(' · ')));
        if (p.email) rows.push(esc(p.email));
        if (p.address) rows.push(esc(p.address));
      }
      if (c.createdAt) rows.push(esc(W('started')) + ': ' + esc(_day(c.createdAt)));
      (typeof rrCollFields === 'function' ? rrCollFields() : []).forEach(function (f) {
        var v = c.fields && c.fields[f.id];
        if (v !== undefined && v !== null && String(v).trim() !== '') rows.push(esc(f.name) + ': ' + esc(_fieldShow(f, v)));
      });
      if (c.notes) rows.push(esc(c.notes));
      more = rows.length ? '<div style="margin-top:0.4rem;display:grid;gap:0.15rem;font-size:0.85rem;color:var(--text)">' + rows.map(function (r) { return '<div>' + r + '</div>'; }).join('') + '</div>' : '';
    }
    var html = line + more;
    var el = old || document.createElement('div');
    el.id = 'rr-coll-header';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', W('detailsTitle', { label: _label(c) }));
    el.style.cssText = 'margin:0 0 0.8rem;padding:0.6rem 0.8rem;border-radius:10px;border:1px solid var(--border);border-left:4px solid var(--accent);background:var(--surface2)';
    el.innerHTML = html;
    if (!old) main.insertBefore(el, main.firstChild);
  }
  function rrCollHeaderFold() {
    var c = rrCurrentCollection();
    var open = (_headerOpen == null) ? !phone() : _headerOpen;
    _headerOpen = !open;
    rrCollHeaderPaint();
  }
  function _day(t) {
    try { return (typeof rrToday === 'function') ? rrToday(new Date(Number(t))) : new Date(Number(t)).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  function _fieldShow(f, v) {
    if (f.type === 'percent') return String(v).replace(/%$/, '') + '%';
    return String(v);
  }

  // ── a small pop-up (nothing closes on an outside click — rrDismissGuard) ──
  function _dialog(id, html, full) {
    var old = document.getElementById(id); if (old) old.remove();
    var d = document.createElement('div');
    d.id = id;
    d.style.cssText = 'position:fixed;inset:0;z-index:9700;background:var(--scrim);display:flex;align-items:' + (full ? 'stretch' : 'center') + ';justify-content:center;padding:' + (full ? '0' : '1rem');
    d.innerHTML = '<div role="dialog" aria-modal="true" style="position:relative;background:var(--surface);border:1px solid var(--border);border-radius:' + (full ? '0' : '14px') + ';max-width:' + (full ? '100%' : '520px') + ';width:100%;' +
      (full ? 'height:100vh;height:100dvh;' : 'max-height:88vh;max-height:88dvh;') + 'overflow:auto;padding:1rem 1.1rem calc(1rem + var(--rr-safe-b, 0px));color:var(--text);font-family:var(--font-body)">' +
      '<button type="button" data-cx aria-label="Close" style="position:absolute;top:0.35rem;right:0.5rem;min-width:40px;min-height:40px;background:none;border:none;color:var(--text-dim);font-size:1.5rem;line-height:1;cursor:pointer">&times;</button>' +
      html + '</div>';
    document.body.appendChild(d);
    d.querySelector('[data-cx]').addEventListener('click', function () { d.remove(); });
    if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d); } catch (e) {} }
    return d;
  }
  var _ROW = 'display:flex;align-items:center;gap:0.6rem;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.55rem 0.75rem;margin-top:0.35rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;cursor:pointer';
  var _BTN = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer';
  var _INP = 'width:100%;box-sizing:border-box;min-height:40px;padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:1rem';

  // ── the drop-down ──────────────────────────────────────────────────────
  // search · All Collections (later) · home · active (most recent first) ·
  // + New collection · Archived ▸ (folded). A phone gets the whole screen.
  function _entries() {
    var d = (typeof rrCollectionsData === 'function' && rrCollectionsData()) || _data || { items: {} };
    return Object.keys(d.items || {}).map(function (k) { return d.items[k]; });
  }
  function rrCollMenuOpen() {
    if (!rrCollUiOn()) return;
    var html = '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(W('title')) + '</div>' +
      '<input id="rr-coll-search" type="search" placeholder="' + esc(W('search')) + '" oninput="rrCollMenuFilter(this.value)" style="' + _INP + '">' +
      '<div id="rr-coll-list"></div>';
    _dialog('rr-coll-menu', html, phone());
    rrCollMenuFilter('');
  }
  function rrCollMenuFilter(q) {
    var box = document.getElementById('rr-coll-list'); if (!box) return;
    var cur = rrCurrentCollection();
    var n = String(q || '').trim().toLowerCase();
    var match = function (e) {
      if (!n) return true;
      return (String(e.number) + ' ' + String(e.name) + ' ' + _clientName(e)).toLowerCase().indexOf(n) >= 0;
    };
    var all = _entries();
    var active = all.filter(function (e) { return e.status === 'active' && match(e); })
      .sort(function (a, b) { return (Number(b.lastOpenedAt) || 0) - (Number(a.lastOpenedAt) || 0); });
    var making = all.filter(function (e) { return e.status === 'creating' && match(e); });
    var archived = all.filter(function (e) { return e.status === 'archived'; });
    var row = function (key, label, sub, isCur) {
      return '<button type="button" onclick="rrCollChoose(' + (typeof rrJsArg === 'function' ? rrJsArg(key) : "'" + key + "'") + ')" style="' + _ROW + (isCur ? ';border-color:var(--accent);border-width:2px' : '') + '">' +
        '<span style="flex:1;min-width:0"><span style="display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(label) + '</span>' +
        (sub ? '<span style="display:block;font-size:0.8rem;color:var(--text-dim)">' + esc(sub) + '</span>' : '') + '</span>' +
        (isCur ? '<span aria-hidden="true">✓</span>' : '') + '</button>';
    };
    var html = '';
    html += '<div style="' + _ROW + ';cursor:default;opacity:0.6" aria-disabled="true"><span style="flex:1">' + esc(W('all')) + '</span><span style="font-size:0.78rem">' + esc(W('allSoon')) + '</span></div>';
    if (!n || W('home').toLowerCase().indexOf(n) >= 0) html += row('home', W('home'), '', cur && cur.home);
    active.forEach(function (e) {
      var cnt = (e.itemCount == null) ? '' : (Number(e.itemCount) === 1 ? W('item1') : W('items', { n: e.itemCount }));
      html += row(e.key, e.number + ' – ' + e.name, [_clientName(e), cnt].filter(Boolean).join(' · '), cur && cur.key === e.key);
    });
    making.forEach(function (e) {
      html += '<div style="' + _ROW + ';cursor:default"><span style="flex:1">' + esc(e.number + ' – ' + e.name) + '</span>' +
        '<button type="button" onclick="rrCollFinish(' + (typeof rrJsArg === 'function' ? rrJsArg(e.key) : "'" + e.key + "'") + ', this)" style="' + _BTN + ';min-height:36px;padding:0.3rem 0.7rem;font-size:0.85rem">' + esc(W('finish')) + '</button></div>';
    });
    if (n && !active.length && !making.length) html += '<div style="padding:0.8rem 0.2rem;color:var(--text-dim)">' + esc(W('none')) + '</div>';
    html += '<button type="button" onclick="rrCollNewOpen()" style="' + _ROW + ';justify-content:center;font-weight:700;color:var(--t-link)">' + esc(W('newBtn')) + '</button>';
    if (archived.length) html += '<details style="margin-top:0.5rem"><summary style="cursor:pointer;min-height:40px;padding:0.4rem 0.2rem">' + esc(W('archived', { n: archived.length })) + '</summary></details>';
    box.innerHTML = html;
  }
  function rrCollChoose(key) {
    var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    return _switchTo(key, {});
  }
  // Switching: the cursor leaves any box first (typing counts as busy), the
  // switch WAITS for saves (collections.js), and the screen stays on the same
  // page — unless that list is off in the collection (showPage's door).
  async function _switchTo(key, opts) {
    opts = opts || {};
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    var page = (typeof window !== 'undefined' && window._rrLastPage) || 'dashboard';
    var target = rrCollectionByKey(key);
    if (!target) { toast(W('busy'), 3000, true); return { ok: false }; }
    if (!opts.quiet) toast(W('opening', { name: _label(target) }), 2500);
    var r = await rrSwitchCollection(key, { repaint: true });
    if (!r || !r.ok) { if (r && r.msg) toast(r.msg, 4500, true); rrCollUiPaint(); return r || { ok: false }; }
    try { if (!target.home) rrTouchCollection(key, Object.keys((state && state.personalData) || {}).length); } catch (e) {}
    rrCollUiPaint();
    try { if (typeof showPage === 'function' && page && page !== 'itemdetail') showPage(page, null); } catch (e) {}
    return r;
  }

  // ── + New collection ───────────────────────────────────────────────────
  function _contactsOptions(selected) {
    var list = ((typeof state !== 'undefined' && state && state.contactsData) || []).slice()
      .filter(function (c) { return c && c.id; })
      .sort(function (a, b) { return String(a.name || a.business).localeCompare(String(b.name || b.business)); });
    return '<option value="">' + esc(W('newNoClient')) + '</option>' + list.map(function (c) {
      var t = (c.name || c.business || c.id) + (c.name && c.business ? ' — ' + c.business : '');
      return '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
  }
  function rrCollNewOpen() {
    var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    var starts = U().starts || [];
    var html = '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.8rem 0">' + esc(W('newTitle')) + '</div>' +
      '<label style="display:block;font-size:0.85rem;margin-bottom:0.25rem" for="rr-coll-new-name">' + esc(W('newName')) + '</label>' +
      '<input id="rr-coll-new-name" maxlength="' + (U().nameMax || 60) + '" style="' + _INP + '">' +
      '<div style="font-size:0.85rem;margin:0.8rem 0 0.25rem">' + esc(W('newStart')) + '</div>' +
      starts.map(function (s, i) {
        return '<label style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.45rem 0.2rem;min-height:40px;cursor:pointer">' +
          '<input type="radio" name="rr-coll-start" value="' + esc(s.id) + '"' + (i === 0 ? ' checked' : '') + ' style="margin-top:0.2rem;width:1.1rem;height:1.1rem">' +
          '<span><span style="display:block;font-weight:700">' + esc(s.name) + '</span><span style="display:block;font-size:0.8rem;color:var(--text-dim)">' + esc(s.help) + '</span></span></label>';
      }).join('') +
      '<label style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem" for="rr-coll-new-client">' + esc(W('newClient')) + '</label>' +
      '<select id="rr-coll-new-client" style="' + _INP + '">' + _contactsOptions('') + '</select>' +
      '<label style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem" for="rr-coll-new-notes">' + esc(W('newNotes')) + '</label>' +
      '<textarea id="rr-coll-new-notes" rows="2" style="' + _INP + '"></textarea>' +
      '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" id="rr-coll-new-go" onclick="rrCollNewGo(this)" style="' + _BTN + '">' + esc(W('newGo')) + '</button></div>';
    _dialog('rr-coll-new', html, false);
  }
  function rrCollNewGo(btn) {
    var run = async function () {
      var name = (document.getElementById('rr-coll-new-name') || {}).value || '';
      if (!String(name).trim()) { toast(W('nameNeeded'), 3000, true); return; }
      var startEl = document.querySelector('input[name="rr-coll-start"]:checked');
      var r = await rrCreateCollection({
        name: name, startId: startEl ? startEl.value : '',
        clientId: (document.getElementById('rr-coll-new-client') || {}).value || '',
        notes: (document.getElementById('rr-coll-new-notes') || {}).value || '',
      });
      if (!r || !r.ok) { toast((r && r.msg) || W('newFailed'), 6000, true); return; }
      var d = document.getElementById('rr-coll-new'); if (d) d.remove();
      await _switchTo(r.key, { quiet: true });
      toast(W('newMade', { label: _label(rrCollectionByKey(r.key)) }), 4000);
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-new', function () { toast(W('newMaking'), 4000); return run(); }, btn);
    return run();
  }
  function rrCollFinish(key, btn) {
    var run = async function () {
      var r = await rrFinishCollection(key);
      if (!r || !r.ok) { toast((r && r.msg) || W('newFailed'), 6000, true); return; }
      var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
      await _switchTo(key, { quiet: true });
      toast(W('newMade', { label: _label(rrCollectionByKey(key)) }), 4000);
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-finish-' + key, run, btn);
    return run();
  }

  // ── the details card ───────────────────────────────────────────────────
  // number, name, client, status + started, the list switches, the business's
  // own fields (named once, filled per collection), notes, counts.
  var _fieldDraft = null, _detailsKey = null;
  function rrCollDetailsOpen(key) {
    var c = rrCollectionByKey(key);
    if (!c || c.home) return;
    _detailsKey = key;
    _fieldDraft = (typeof rrCollFields === 'function' ? rrCollFields() : []).map(function (f) { return Object.assign({}, f); });
    var lists = U().lists || [];
    var types = U().fieldTypes || [];
    var lab = function (t, forId) { return '<label style="display:block;font-size:0.85rem;margin:0.75rem 0 0.25rem"' + (forId ? ' for="' + forId + '"' : '') + '>' + esc(t) + '</label>'; };
    var html = '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.4rem 0">' + esc(W('detailsTitle', { label: _label(c) })) + '</div>' +
      '<div style="font-size:0.85rem;color:var(--text-dim)">' + esc(W('number')) + ' ' + esc(c.number) + ' · ' + esc(W('status')) + ': ' + esc(W('active')) +
      (c.createdAt ? ' · ' + esc(W('started')) + ' ' + esc(_day(c.createdAt)) : '') +
      (c.itemCount != null ? ' · ' + esc(Number(c.itemCount) === 1 ? W('item1') : W('items', { n: c.itemCount })) : '') + '</div>' +
      lab(W('newName'), 'rr-coll-d-name') + '<input id="rr-coll-d-name" maxlength="' + (U().nameMax || 60) + '" value="' + esc(c.name) + '" style="' + _INP + '">' +
      lab(W('newClient'), 'rr-coll-d-client') + '<select id="rr-coll-d-client" style="' + _INP + '">' + _contactsOptions(c.clientId) + '</select>' +
      '<div style="font-weight:700;margin-top:0.9rem">' + esc(W('lists')) + '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.2rem">' + esc(W('listsHelp')) + '</div>' +
      lists.map(function (d) {
        var on = !(c.lists && c.lists[d.key] === false);
        return '<label style="display:flex;align-items:center;gap:0.6rem;min-height:40px;cursor:pointer"><input type="checkbox" data-coll-list="' + esc(d.key) + '"' + (on ? ' checked' : '') + ' style="width:1.15rem;height:1.15rem">' + esc(d.word) + '</label>';
      }).join('') +
      '<div style="font-weight:700;margin-top:0.9rem">' + esc(W('fields')) + '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-dim)">' + esc(W('fieldsHelp')) + '</div>' +
      '<div id="rr-coll-d-fields"></div>' +
      lab(W('notes'), 'rr-coll-d-notes') + '<textarea id="rr-coll-d-notes" rows="3" style="' + _INP + '">' + esc(c.notes) + '</textarea>' +
      '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" id="rr-coll-d-save" onclick="rrCollDetailsSave(' + (typeof rrJsArg === 'function' ? rrJsArg(c.key) : "'" + c.key + "'") + ', this)" style="' + _BTN + '">' + esc(W('save')) + '</button></div>';
    _dialog('rr-coll-details', html, phone());
    _paintFields(c, types);
  }
  function _paintFields(c, types) {
    var box = document.getElementById('rr-coll-d-fields'); if (!box) return;
    types = types || U().fieldTypes || [];
    var keep = {};
    box.querySelectorAll('[data-fval]').forEach(function (el) { keep[el.getAttribute('data-fval')] = el.value; });
    box.innerHTML = (_fieldDraft || []).map(function (f, i) {
      var v = (f.id in keep) ? keep[f.id] : ((c && c.fields && c.fields[f.id]) || '');
      var inType = f.type === 'date' ? 'date' : (f.type === 'number' || f.type === 'percent') ? 'number' : 'text';
      return '<div style="display:grid;grid-template-columns:1fr 7rem 2.6rem;gap:0.35rem;align-items:center;margin-top:0.45rem">' +
        '<input aria-label="' + esc(W('fieldName')) + '" data-fname="' + i + '" value="' + esc(f.name) + '" style="' + _INP + '">' +
        '<select aria-label="' + esc(W('fieldName')) + '" data-ftype="' + i + '" onchange="rrCollFieldType(' + i + ', this.value)" style="' + _INP + '">' + types.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === f.type ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>' +
        '<button type="button" aria-label="' + esc(W('fieldRemove')) + '" title="' + esc(W('fieldRemove')) + '" onclick="rrCollFieldRemove(' + i + ')" style="min-width:40px;min-height:40px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer">&times;</button>' +
        '<input data-fval="' + esc(f.id) + '" type="' + inType + '" value="' + esc(v) + '" style="' + _INP + ';grid-column:1 / span 3">' +
        '</div>';
    }).join('') +
    ((_fieldDraft || []).length < (U().fieldsMax || 12) ? '<button type="button" onclick="rrCollFieldAdd()" style="' + _ROW + ';justify-content:center;color:var(--t-link)">' + esc(W('fieldAdd')) + '</button>' : '');
  }
  function _syncDraftNames() {
    document.querySelectorAll('#rr-coll-d-fields [data-fname]').forEach(function (el) {
      var i = Number(el.getAttribute('data-fname'));
      if (_fieldDraft && _fieldDraft[i]) _fieldDraft[i].name = el.value;
    });
  }
  function _curDetailsColl() { return _detailsKey ? rrCollectionByKey(_detailsKey) : null; }
  function rrCollFieldAdd() { _syncDraftNames(); (_fieldDraft = _fieldDraft || []).push({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: '', type: 'text' }); _paintFields(_curDetailsColl()); }
  function rrCollFieldRemove(i) { _syncDraftNames(); if (_fieldDraft) _fieldDraft.splice(i, 1); _paintFields(_curDetailsColl()); }
  function rrCollFieldType(i, t) { _syncDraftNames(); if (_fieldDraft && _fieldDraft[i]) _fieldDraft[i].type = t; _paintFields(_curDetailsColl()); }
  function rrCollDetailsSave(key, btn) {
    var run = async function () {
      _syncDraftNames();
      var lists = {};
      document.querySelectorAll('#rr-coll-details [data-coll-list]').forEach(function (el) { lists[el.getAttribute('data-coll-list')] = !!el.checked; });
      var defs = (typeof rrCollFieldsSave === 'function') ? rrCollFieldsSave(_fieldDraft || []) : [];
      var vals = {};
      document.querySelectorAll('#rr-coll-details [data-fval]').forEach(function (el) {
        var id = el.getAttribute('data-fval');
        if (defs.some(function (f) { return f.id === id; })) vals[id] = el.value;
      });
      var r = await rrUpdateCollection(key, {
        name: (document.getElementById('rr-coll-d-name') || {}).value,
        clientId: (document.getElementById('rr-coll-d-client') || {}).value || '',
        notes: (document.getElementById('rr-coll-d-notes') || {}).value || '',
        lists: lists, fields: vals,
      });
      if (!r || !r.ok) { toast((r && r.msg) || W('saveFailed'), 5000, true); return; }
      var d = document.getElementById('rr-coll-details'); if (d) d.remove();
      toast(W('saved'), 2500);
      rrCollUiPaint();
      // a list just switched off while its page is open → back to My Collection
      try { var pg = window._rrLastPage; if (pg && typeof rrPageAllowed === 'function' && !rrPageAllowed(pg)) showPage('browse', null); } catch (e) {}
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-details-' + key, run, btn);
    return run();
  }

  // ── the Add screen says where the item goes ─────────────────────────────
  function rrAddingToHtml() {
    try {
      var c = rrCurrentCollection();
      if (!c || c.home) return '';
      return '<div id="wizard-coll-banner" style="margin-top:0.5rem;padding:0.4rem 0.7rem;border-radius:6px;background:var(--surface2);border-left:3px solid var(--accent);font-size:0.85rem;font-weight:700;color:var(--text)">' +
        esc(W('addingTo', { label: _label(c) })) + '</div>';
    } catch (e) { return ''; }
  }

  var api = {
    rrCollUiOn: rrCollUiOn, rrCollectionsBoot: rrCollectionsBoot, rrCollUiPaint: rrCollUiPaint,
    rrCollHeaderPaint: rrCollHeaderPaint, rrCollHeaderFold: rrCollHeaderFold,
    rrCollMenuOpen: rrCollMenuOpen, rrCollMenuFilter: rrCollMenuFilter, rrCollChoose: rrCollChoose,
    rrCollNewOpen: rrCollNewOpen, rrCollNewGo: rrCollNewGo, rrCollFinish: rrCollFinish,
    rrCollDetailsOpen: rrCollDetailsOpen, rrCollDetailsSave: rrCollDetailsSave,
    rrCollFieldAdd: rrCollFieldAdd, rrCollFieldRemove: rrCollFieldRemove, rrCollFieldType: rrCollFieldType,
    rrAddingToHtml: rrAddingToHtml, rrCollectionClient: rrCollectionClient,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  root._rrCollUiReset = function () { _booted = false; _data = null; _headerOpen = null; _fieldDraft = null; };
})(typeof window !== 'undefined' ? window : globalThis);
