// ═══════════════════════════════════════════════════════════════════════════
// collections-inbox.js — v0.9.2077, TRR Pro release 6: THE PHOTO INBOX'S
// COLLECTION TAG
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Section 4:
// "Photo Inbox needs a REQUIRED collection tag"); [stated] Brad 2026-10-30
// 22:03 CT: a photo for another collection asks first — "yes but with a
// confirmation pop up" — and 22:05 CT "yes" to building it.
//
// One inbox for the whole business (as today). Each photo remembers the
// collection that was open when it was ADDED (its Drive record, rrColl):
//   stamped    drive.js driveUploadFile — THE one door every inbox upload
//              passes — asks rrInboxUploadTag(); a photo staged offline keeps
//              the collection it was taken in (photo-inbox-offline.js)
//   shown      a badge on each card, a filter by collection (photo-inbox.js)
//   changed    select → Collection… (rrInboxRetagOpen); switching collections
//              never changes a tag
//   used       opening a photo to add it (the review card, and every add door
//              behind it) while ANOTHER collection is open asks first —
//              "This photo is for 7 – Hale. Switch to Hale to add it?" — and
//              switches; the add then runs exactly as it always does, in the
//              open collection. A photo with no tag asks which collection it
//              is for — never a guess. With only one collection nothing asks.
// ON only through RR_COLL_UI.feature. Every word: RR_COLL_MOVE.inbox (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function I() { return (typeof RR_COLL_MOVE !== 'undefined' && RR_COLL_MOVE.inbox) || (root.RR_COLL_MOVE && root.RR_COLL_MOVE.inbox) || {}; }
  function rrInboxWord(k, vars) {
    var t = String(I()[k] || '');
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function PIN() { return root._pinShared || {}; }
  function PINF() { return root._pinFns || {}; }
  function _on() { try { return typeof rrCollUiOn === 'function' && rrCollUiOn(); } catch (e) { return false; } }
  function _colls() {
    var all = (typeof rrCollections === 'function') ? rrCollections() : [];
    return all.filter(function (c) { return c && (c.home || (c.status || 'active') === 'active'); });
  }

  // More than one collection to choose between (only then is anything shown or asked).
  function rrInboxCollOn() { return _on() && _colls().length > 1; }
  // The tag a photo added right now gets ('' = none: the switch is off).
  function rrInboxUploadTag() {
    if (!_on()) return '';
    var c = (typeof rrCurrentCollection === 'function') ? rrCurrentCollection() : null;
    return (c && c.key) || '';
  }
  function rrInboxCollLabel(key) {
    if (!key) return rrInboxWord('none');
    var c = (typeof rrCollectionByKey === 'function') ? rrCollectionByKey(key) : null;
    if (!c || c.home) return c ? rrInboxWord('home') : String(key);
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : String(c.number);
  }
  function _fileColl(f) { return ((f && f._meta) || {}).coll || ''; }
  function _tags(groups) {
    var out = [];
    (groups || []).forEach(function (g) { (g.files || []).forEach(function (f) { var t = _fileColl(f); if (out.indexOf(t) < 0) out.push(t); }); });
    return out;
  }
  function _fileIds(groups, onlyUntagged) {
    var ids = [];
    (groups || []).forEach(function (g) { (g.files || []).forEach(function (f) { if (f && f.id && (!onlyUntagged || !_fileColl(f))) ids.push(f.id); }); });
    return ids;
  }
  function _selGroups() {
    var P = PIN();
    return (P._groups || []).filter(function (g) { return P._sel && P._sel[g.key]; });
  }
  async function _stamp(ids, key) {
    var many = PINF()._pinMetaSetMany || root._pinMetaSetMany;
    if (typeof many !== 'function' || !ids.length) return 0;
    return many(ids, { coll: key });
  }
  function _repaint() { try { if (typeof PINF()._render === 'function') PINF()._render(); } catch (e) {} }

  // A list of the collections to pick from; resolves the chosen key or ''.
  function _pick(title, rowId) {
    return new Promise(function (done) {
      var rows = _colls().map(function (c) {
        return '<button type="button" data-pin-pick="' + esc(c.key) + '" style="display:flex;align-items:center;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.5rem 0.75rem;margin-top:0.35rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer">' + esc(rrInboxCollLabel(c.key)) + '</button>';
      }).join('');
      var html = '<div style="font-family:var(--font-head);font-size:1.15rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(title) + '</div>' + rows;
      var d = (typeof rrCollDialog === 'function') ? rrCollDialog(rowId, html, false) : null;
      if (!d) { done(''); return; }
      var settled = false;
      var finish = function (v) { if (settled) return; settled = true; try { d.remove(); } catch (e) {} done(v); };
      d.querySelectorAll('[data-pin-pick]').forEach(function (b) { b.addEventListener('click', function () { finish(b.getAttribute('data-pin-pick')); }); });
      var x = d.querySelector('[data-cx]'); if (x) x.addEventListener('click', function () { finish(''); });
    });
  }

  // ── select → Collection… ───────────────────────────────────────────────
  async function rrInboxRetagOpen() {
    var gs = _selGroups();
    if (!gs.length) return false;
    var key = await _pick(rrInboxWord('retagTitle'), 'rr-pin-coll');
    if (!key) return false;
    return rrInboxRetag(key, gs);
  }
  async function rrInboxRetag(key, groups) {
    var ids = _fileIds(groups, false);
    var ok = await _stamp(ids, key);
    _repaint();
    toast(rrInboxWord('retagDone', { n: ok, label: rrInboxCollLabel(key) }), 3500);
    return ok;
  }

  // ── the gate before a photo is added ───────────────────────────────────
  // true = go on (now in the photo's collection); false = stop, nothing done.
  // `needsAsk` is decided WITHOUT waiting, so when nothing has to be asked the
  // add opens exactly as it always did.
  function _needsAsk(groups) {
    if (!rrInboxCollOn() || !groups || !groups.length) return false;
    var cur = rrCurrentCollection();
    var t = _tags(groups);
    return !(t.length === 1 && t[0] === cur.key);
  }
  async function rrInboxGate(groups) {
    if (!_needsAsk(groups)) return true;
    var t = _tags(groups);
    if (t.indexOf('') >= 0) {
      var key = await _pick(rrInboxWord('askTitle'), 'rr-pin-coll');
      if (!key) return false;
      await _stamp(_fileIds(groups, true), key);
      t = _tags(groups);
    }
    if (t.length !== 1) {   // photos for two collections in one add — never mix them
      var one = await _pick(rrInboxWord('retagTitle'), 'rr-pin-coll');
      if (!one) return false;
      await _stamp(_fileIds(groups, false), one);
      t = [one];
    }
    var cur = rrCurrentCollection();
    if (t[0] === cur.key) { _repaint(); return true; }
    var c = rrCollectionByKey(t[0]);
    if (!c || !c.sheetId) { toast(rrInboxWord('none'), 3500, true); return false; }
    var name = c.home ? rrInboxCollLabel(c.key) : (c.name || rrInboxCollLabel(c.key));
    var yes = await appConfirm(rrInboxWord('switchAsk', { label: rrInboxCollLabel(c.key), name: name }), { ok: rrInboxWord('switchBtn', { name: name }), cancel: rrInboxWord('cancel') });
    if (!yes) return false;
    var r = (typeof rrCollSwitchTo === 'function') ? await rrCollSwitchTo(c.key, {}) : null;
    if (!r || !r.ok) return false;
    try { if (typeof showPage === 'function') showPage('photo-inbox', null); } catch (e) {}
    return true;
  }

  // Every way into adding a photo passes the gate: opening the review card,
  // and the add doors on it (in case a switch happened while it was open).
  function _wrap(name, groupsOf) {
    var orig = root[name];
    if (typeof orig !== 'function' || orig._rrCollGate) return;
    var w = function () {
      var args = arguments, self = this;
      var groups = groupsOf.apply(null, args);
      if (!_needsAsk(groups)) return orig.apply(self, args);
      return rrInboxGate(groups).then(function (ok) { return ok ? orig.apply(self, args) : undefined; });
    };
    w._rrCollGate = true;
    root[name] = w;
  }
  function rrInboxGateInstall() {
    _wrap('_pinReview', function (key, only) {
      var P = PIN();
      return key ? (P._groups || []).filter(function (g) { return g.key === key; })
                 : (only && only.length ? only : _selGroups());
    });
    var rv = function () { return PIN()._rvGroups || []; };
    ['_pinReviewAdd', '_pinAddNoNumber', '_pinAddSetFromGroup'].forEach(function (n) { _wrap(n, rv); });
  }
  rrInboxGateInstall();

  var api = {
    rrInboxWord: rrInboxWord, rrInboxCollOn: rrInboxCollOn, rrInboxUploadTag: rrInboxUploadTag, rrInboxCollLabel: rrInboxCollLabel,
    rrInboxRetagOpen: rrInboxRetagOpen, rrInboxRetag: rrInboxRetag, rrInboxGate: rrInboxGate, rrInboxGateInstall: rrInboxGateInstall,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
