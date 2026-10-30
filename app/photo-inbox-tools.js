// ═══════════════════════════════════════════════════════════════
// photo-inbox-tools.js — the Photo Inbox tools
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 5 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "yes"). Nothing
// in it changed: where-from and the vendor list, the help panel, crop before a read, Google Lens, photos → set members, items with no number, the pending-photo flush and its sweep, the stored-answer repairs and backfills, and the one-time set-photo rescue.
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
  var _pinSheetCardCss = PINF.from('_pinSheetCardCss');
  var _qcToken = PINF.from('_qcToken');
  var _pinOnScreenFid = PINF.from('_pinOnScreenFid');
  var _pinBtnBusy = PINF.from('_pinBtnBusy');
  var _pinPreferOf = PINF.from('_pinPreferOf');
  var _pinReadFid = PINF.from('_pinReadFid');
  var _render = PINF.from('_render');
  var _tokSave = PINF.from('_tokSave');
  var _pinAr = PINF.from('_pinAr');
  var _pinFilesToRead = PINF.from('_pinFilesToRead');
  var _pinBytes = PINF.from('_pinBytes');
  var _pinStepsReset = PINF.from('_pinStepsReset');
  var _pinStep = PINF.from('_pinStep');
  var _pinBusyBounce = PINF.from('_pinBusyBounce');
  var _pinLookup = PINF.from('_pinLookup');
  var _pinNoteFileMap = PINF.from('_pinNoteFileMap');
  var _setBusy = PINF.from('_setBusy');
  var _pinOffline = PINF.from('_pinOffline');
  var _folder = PINF.from('_folder');
  var _status = PINF.from('_status');
  var _pinIsPairRole = PINF.from('_pinIsPairRole');
  var _pinMetaOf = PINF.from('_pinMetaOf');
  var _pinBestMaster = PINF.from('_pinBestMaster');
  var _pinMfrAgree = PINF.from('_pinMfrAgree');
  var _pinGroupingFor = PINF.from('_pinGroupingFor');
  var _pinKindLabel = PINF.from('_pinKindLabel');
  var _pinDashedKin = PINF.from('_pinDashedKin');
  var _pinMetaSet = PINF.from('_pinMetaSet');
  // Fixed settings from app/photo-inbox.js (handed over once it has loaded, never changed):
  var _PIN_SHEET_OV = PINF._PIN_SHEET_OV;
  var READER_VER = PINF.READER_VER;
  var RR_READ_STEPS = PINF.RR_READ_STEPS;
  var SETSTAGE_KEY = PINF.SETSTAGE_KEY;
  var PENDING_KEY = PINF.PENDING_KEY;
  var CROPPED_KEY = PINF.CROPPED_KEY;
  // From the other pieces:
  var _pinAiHints = PINF.from('_pinAiHints');
  var _pinReconcileAiNum = PINF.from('_pinReconcileAiNum');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _ids: _ids, _pendList: _pendList, _idsSave: _idsSave, _cropped: _cropped, _croppedSave: _croppedSave, _flushPending: _flushPending, _repairMissingPhotoLinks: _repairMissingPhotoLinks, _backfillMasterKeys: _backfillMasterKeys, _backfillMasterRowIds: _backfillMasterRowIds, _pinLensBannerHtml: _pinLensBannerHtml, _pinHelpSeen: _pinHelpSeen });
  // (The review card's choice lists — alternatives, family, the kin panel — → app/photo-inbox-review.js, split step 4.)

  // Research by Photo — the app's existing Lens route (stage the photo
  // publicly for 10 minutes, open Google image search with a structured
  // question). Same machinery the wizard's identify uses.
  // ══ v0.9.1178 — where do you want to look? ═══════════════════════════════
  // Brad: "with the google search, we need a pop up to add 'where from' that has
  // vendors listed, we need any, ebay, and have the ability to add vendors
  // manually. these would be like trainz.com, trainworld, ect. I DON'T WANT TO
  // SUGGEST VENDORS, THE USER NEEDS TO MANUALLY PUT THEM IN."
  //
  // ⚠ READ THAT LAST SENTENCE BEFORE CHANGING THIS CODE. There is no seeded
  // list here, no "popular dealers", no autocomplete from a bundled set, and no
  // vendor is ever written to storage that the user did not type. trainz.com and
  // trainworld appear in his message as examples of what HE would enter — they
  // are not a starter list, and shipping them as one would be the opposite of
  // what he asked for. The list below starts EMPTY and stays empty until he
  // types into it.
  //
  // "Any" and "eBay" are not vendors the app is suggesting: they are the two
  // scopes Brad named by hand in that same sentence. Any is "don't narrow it",
  // which is the behaviour that already existed.
  var VENDOR_KEY = 'rr_vendors';        // [{name, site}] — user-entered ONLY
  var VENDOR_LAST_KEY = 'rr_vendor_last';
  function _pinVendors() {
    try {
      var a = JSON.parse(localStorage.getItem(VENDOR_KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (v) { return v && v.site; }) : [];
    } catch (e) { return []; }
  }
  function _pinVendorsSave(a) {
    try { localStorage.setItem(VENDOR_KEY, JSON.stringify(a || [])); } catch (e) {}
  }
  // Turn whatever was typed into a domain we can scope a search to. Anything
  // that is not recognisably a web address is refused with a reason rather than
  // stored as junk that silently produces an empty search later.
  function _pinVendorDomain(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase();
    if (!s) return '';
    s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
    s = s.split(/[\/?#\s]/)[0];
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
  }
  window._pinAddVendor = function () {
    var box = document.getElementById('pin-wf-new');
    var raw = box ? box.value : '';
    var dom = _pinVendorDomain(raw);
    if (!dom) {
      showToast('Type the vendor’s web address, like trainz.com', 3200, true);
      return;
    }
    var list = _pinVendors();
    if (list.some(function (v) { return v.site === dom; })) {
      showToast(dom + ' is already on the list', 2400, true);
      return;
    }
    list.push({ name: dom, site: dom });
    _pinVendorsSave(list);
    if (box) box.value = '';
    _pinWhereFromDraw();
  };
  window._pinRemoveVendor = function (site) {
    var list = _pinVendors().filter(function (v) { return v.site !== site; });
    _pinVendorsSave(list);
    try {
      if (localStorage.getItem(VENDOR_LAST_KEY) === site) localStorage.removeItem(VENDOR_LAST_KEY);
    } catch (e) {}
    _pinWhereFromDraw();
  };

  // The scopes offered, in order. Built fresh every draw so a vendor added in
  // the sheet appears immediately.
  function _pinWhereFromOptions() {
    var out = [
      { site: '', label: 'Any site', note: 'Search the whole web' },
      { site: 'ebay.com', label: 'eBay', note: '' },
    ];
    var seen = { 'ebay.com': 1 };
    _pinVendors().forEach(function (v) {
      if (seen[v.site]) return;
      seen[v.site] = 1;
      out.push({ site: v.site, label: v.name || v.site, note: '', mine: true });
    });
    // v0.9.1179 (Brad): "This can be from our contact list as well. On the
    // contact list, we can have a box added to the contacts detail page that
    // says preferred vendor. Then if they click that, it can populate the google
    // where from pop up."
    //
    // Still not the app suggesting anything: every one of these is a contact he
    // typed in himself and then ticked. They carry no remove button — taking one
    // off means un-ticking the contact, and a ✕ here that quietly edited a
    // contact record would be a nasty surprise.
    try {
      if (typeof window._ctPreferredVendors === 'function') {
        window._ctPreferredVendors().forEach(function (v) {
          if (!v || !v.site || seen[v.site]) return;
          seen[v.site] = 1;
          out.push({ site: v.site, label: v.name || v.site, note: 'From your contacts' });
        });
      }
    } catch (e) {}
    return out;
  }
  var _pinWfCb = null;
  function _pinWhereFromDraw() {
    var card = document.getElementById('pin-wf-card');
    if (!card) return;
    var last = '';
    try { last = localStorage.getItem(VENDOR_LAST_KEY) || ''; } catch (e) {}
    var opts = _pinWhereFromOptions();
    if (!opts.some(function (o) { return o.site === last; })) last = '';
    var rowBtn = 'width:100%;text-align:left;padding:0.7rem 0.8rem;border-radius:9px;'
      + 'font-family:var(--font-body);font-size:0.92rem;min-height:48px;cursor:pointer;'
      + 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.45rem';
    card.innerHTML =
      '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;margin-bottom:0.15rem">Where do you want to look?</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">'
      + 'Pick a place to search this item. Only the vendors you add yourself appear here.</div>'
      + opts.map(function (o) {
          var on = o.site === last;
          return '<div style="display:flex;align-items:center;gap:0.4rem">'
            + '<button onclick="_pinWhereFromPick(\'' + rrEsc(o.site) + '\')" style="' + rowBtn
              + ';border:1.5px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';background:'
              + (on ? 'var(--surface3)' : 'var(--surface2)') + ';color:var(--text);flex:1;min-width:0">'
            + '<span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rrEsc(o.label) + '</span>'
            + (o.note ? '<span style="font-size:0.74rem;color:var(--text-dim);font-weight:400">' + rrEsc(o.note) + '</span>' : '')
            + '</button>'
            + (o.mine
                ? '<button onclick="_pinRemoveVendor(\'' + rrEsc(o.site) + '\')" title="Remove ' + rrEsc(o.label)
                  + '" aria-label="Remove ' + rrEsc(o.label) + '" style="width:40px;min-width:40px;height:40px;border-radius:9px;'
                  + 'border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);'
                  + 'font-size:1.1rem;line-height:1;cursor:pointer;padding:0;margin-bottom:0.45rem">✕</button>'
                : '')
            + '</div>';
        }).join('')
      + '<div style="border-top:1px solid var(--border);margin:0.7rem 0 0.6rem"></div>'
      + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);font-weight:700;margin-bottom:0.3rem">Add a vendor</div>'
      + '<div style="display:flex;gap:0.5rem;align-items:stretch">'
        + '<input id="pin-wf-new" type="text" placeholder="Their web address, like trainz.com" autocomplete="off" spellcheck="false" '
          + 'style="flex:1;min-width:0;padding:0.6rem 0.7rem;border-radius:8px;border:1.5px solid var(--border);'
          + 'background:var(--surface2);color:var(--text);font-size:0.95rem;min-height:46px;box-sizing:border-box">'
        + '<button onclick="_pinAddVendor()" style="padding:0 1rem;border-radius:8px;border:1.5px solid var(--border);'
          + 'background:var(--surface2);color:var(--text);font-weight:700;font-size:0.9rem;min-height:46px;cursor:pointer">Add</button>'
      + '</div>'
      + '<button onclick="_pinWhereFromClose()" style="width:100%;margin-top:0.8rem;padding:0.6rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-size:0.88rem;cursor:pointer">Cancel</button>';
    var nb = document.getElementById('pin-wf-new');
    if (nb) nb.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); window._pinAddVendor(); } };
  }
  window._pinWhereFromClose = function () {
    var ov = document.getElementById('pin-wf-sheet');
    if (ov) ov.remove();
    _pinWfCb = null;
  };
  window._pinWhereFromPick = function (site) {
    try { if (site) localStorage.setItem(VENDOR_LAST_KEY, site); else localStorage.removeItem(VENDOR_LAST_KEY); } catch (e) {}
    var cb = _pinWfCb;
    var label = '';
    _pinWhereFromOptions().forEach(function (o) { if (o.site === site) label = o.label; });
    window._pinWhereFromClose();
    if (cb) { try { cb({ site: site, label: label }); } catch (e) { console.warn('[inbox] where-from callback', e && e.message); } }
  };
  function _pinWhereFrom(cb) {
    _pinWfCb = cb;
    var old = document.getElementById('pin-wf-sheet'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-wf-sheet';
    ov.style.cssText = _PIN_SHEET_OV;
    var card = document.createElement('div');
    card.id = 'pin-wf-card';
    card.style.cssText = _pinSheetCardCss(520, 82);
    ov.appendChild(card);
    rrDismissGuard(ov, function () { window._pinWhereFromClose(); });   // v0.9.1791: the backdrop closes nothing (Brad: "never close if you pick outside")
    document.body.appendChild(ov);
    _pinWhereFromDraw();
    // v0.9.1179: contacts only load when the Contacts page has been opened, so a
    // ticked vendor would be missing from this sheet on a fresh session. Fetch
    // them once, quietly, and redraw if any turned up — the same lazy load the
    // wizard's "Bought From" picker does.
    try {
      if (!(window.state && (window.state.contactsData || []).length)
          && typeof window._ctLoadContacts === 'function') {
        window._ctLoadContacts().then(function () {
          if (document.getElementById('pin-wf-card')) _pinWhereFromDraw();
        }).catch(function () {});
      }
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    window._pinVendors = _pinVendors;
    window._pinVendorDomain = _pinVendorDomain;
    window._pinWhereFromOptions = _pinWhereFromOptions;
    window._pinWhereFrom = _pinWhereFrom;
  }

  // v0.9.1838 (N5): _pinVendorSearchURL used to live here — a site:-narrowed
  // search builder with its own maker/period wording. Nothing in the app called
  // it (the where-from picker hands its site to googlePart, app-pages.js, which
  // asks the shared rules); only a test kept it alive. Removed rather than
  // routed: a query builder with no caller is one more place a brand can go
  // wrong.

  // ══ v0.9.1181 — the help panel ═══════════════════════════════════════════
  // Brad chose: it opens itself ONCE, on the very first review card a new user
  // ever sees, and after that only from the button. The flag is set the moment
  // it is shown rather than when it is dismissed — "once" has to mean once even
  // if they close it straight away, or it becomes the thing that nags.
  var HELP_SEEN_KEY = 'rr_photoid_help_seen';
  function _pinHelpSeen() {
    try { return localStorage.getItem(HELP_SEEN_KEY) === '1'; } catch (e) { return true; }
  }
  function _pinHelpMarkSeen() {
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch (e) {}
  }
  window._pinHelpClose = function () {
    var ov = document.getElementById('pin-help-sheet');
    if (ov) ov.remove();
  };
  window._pinHelpOpen = function (auto) {
    if (typeof window.rrPhotoIdHelpHtml !== 'function') return;
    var old = document.getElementById('pin-help-sheet'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-help-sheet';
    // z-index above the review card's own overlay, or it opens behind it.
    ov.style.cssText = _PIN_SHEET_OV.replace('z-index:10050', 'z-index:10060');
    var card = document.createElement('div');
    card.style.cssText = _pinSheetCardCss(560, 88);
    card.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.5rem">'
        + '<div style="flex:1;min-width:0;font-family:var(--font-head);font-size:1.2rem;'
          + 'font-weight:700;color:var(--text);line-height:1.25">How best to use these features</div>'
        + '<button onclick="_pinHelpClose()" aria-label="Close" style="background:none;border:none;'
          + 'color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;'
          + 'padding:0.1rem 0.3rem;flex-shrink:0">\u2715</button>'
      + '</div>'
      + window.rrPhotoIdHelpHtml()
      + '<button onclick="_pinHelpClose()" style="width:100%;margin-top:1.1rem;padding:0.75rem;'
        + 'border-radius:10px;border:none;background:var(--accent);color:var(--on-accent);'
        + 'font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer">'
        + (auto ? 'Got it \u2014 don\u2019t show this again' : 'Close') + '</button>';
    ov.appendChild(card);
    rrDismissGuard(ov, function () { window._pinHelpClose(); });   // v0.9.1791: the backdrop closes nothing (Brad: "never close if you pick outside")
    document.body.appendChild(ov);
    _pinHelpMarkSeen();
  };

  // v0.9.1184 (Brad: "I told you to add the prefered vendor to the research
  // google button. instead, you screw with google lens.") — v0.9.1178 put the
  // where-from picker HERE, in front of the photo search. Wrong button. His
  // request said "with the google search" and meant the plain text-search
  // Google buttons (Parts Needed's, for one) — not the photo flow, which was
  // one click and became two. The picker now lives on googlePart
  // (app-pages.js); this button is the photo search again, full stop.
  // v0.9.1184 (Brad: "I told you to add the prefered vendor to the research
  // google button. instead, you screw with google lens.") — v0.9.1178 put the
  // where-from picker HERE, in front of the photo search. Wrong button. His
  // request said "with the google search" and meant the plain text-search
  // Google buttons (Parts Needed's, for one) — not the photo flow, which was
  // one click and became two. The picker now lives on googlePart
  // (app-pages.js); this button is the photo search again, full stop.
  window._pinReviewLens = function () { return window._pinLensSearch(); };

  window._pinLensSearch = async function () {
    var gs = PIN._rvGroups;
    if (!gs.length) return;
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var tab = null;
    try { tab = window.open('', '_blank'); } catch (e) {}
    var btn = document.getElementById('pin-rv-lens');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending to Google…'; }
    try {
      // v0.9.1835 (Brad: "is there anyway to speed that up?"): the photo is
      // already in Drive, so Drive copies it on Google's side — one small
      // request — instead of the phone downloading the full picture and
      // uploading it back. A copy still alive is reused (same photo searched
      // again inside ten minutes → the link opens at once). The words on the
      // link below are untouched.
      // v0.9.1960 (Brad): the photo ON SCREEN — the one you highlighted, or the
      // Right Side the card opened on — not always the group's first photo.
      var staged = await driveStageLensCopy(_pinOnScreenFid() || gs[0].files[0].id);
      if (!staged.reused) setTimeout(function () { try { driveCleanupLensStaging(staged.id); } catch (e) {} }, 10 * 60 * 1000);
      // v0.9.917 (Brad): question text built by the ONE shared builder in
      // ai-id.js (rrIdentifyQuery) — change it there, every button updates.
      // v0.9.1083: the same era hint goes into the shared text question, so a
      // Research or Google search is asked about the right decade too.
      var _lh = _pinAiHints(gs[0]);
      // v0.9.1152: this passed ONLY eraLabel/eraYears and dropped the mfrs and
      // scale that _pinAiHints had just worked out — so the question never said
      // "Lionel" or "O". Pass the whole hint set.
      // ── v0.9.1489 (Brad: "google got it right, but we didn't help it like
      // we should with its tags and filters"): the wizard's Lens learned in
      // v1473 that uploadbyurl PASSES q + lns_mode through — the inbox never
      // did, so a tagged AA-unit photo went to Google naked. The photo's TAG
      // (and only the tag — v1488 rule) now rides the URL as plain search
      // words, e.g. "Lionel Postwar O gauge (1945-1969) diesel".
      var _hint = [(_lh.mfrs || []).join(' '), _lh.eraLabel || '',
                   _lh.eraYears ? ('(' + _lh.eraYears + ')') : '',
                   _lh.scale ? (_lh.scale + ' gauge') : '', _lh.type || 'model train']
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      var _hSeen = {};
      _hint = _hint.split(' ').filter(function (w) {
        var k = w.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!k) return true;
        if (_hSeen[k]) return false;
        _hSeen[k] = 1;
        return true;
      }).join(' ');
      var url = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(staged.url)
        + (_hint ? '&q=' + encodeURIComponent(_hint) + '&lns_mode=mu' : '');
      if (tab) { try { tab.location = url; } catch (e) { tab = null; } }
      if (!tab) window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.textContent = 'Google Photo ID'; }
      // v0.9.895 (Brad: "i copied it, now what?") — same return trip as the
      // wizard's Lens flow: when he comes back with Google's answer copied,
      // parse the clipboard and reopen the review card with it applied.
      _pinLensArm(gs);
      // v0.9.962 (Brad): show the reminder right on the open card now, and it
      // re-renders on the return-trip too (armed state -> banner in _pinReview).
      try {
        var _numEl = document.getElementById('pin-rv-num');
        if (_numEl && !document.getElementById('pin-lens-banner')) {
          var _bWrap = document.createElement('div');
          _bWrap.innerHTML = _pinLensBannerHtml();
          if (_bWrap.firstChild) _numEl.parentNode.insertBefore(_bWrap.firstChild, _numEl);
        }
      } catch (eB) {}
      showToast(window.IS_MOBILE_UA   // v0.9.1920 (camera list #6): phone wording on phones
        ? 'In the Google tab, press and hold on Google\u2019s answer, choose Select all, then Copy \u2014 come back and paste it into the gold box'
        : 'In the Google tab: Ctrl+A, Ctrl+C, then come back and press Ctrl+V', 4500);
    } catch (e) {
      console.warn('[Inbox] research-by-photo:', e);
      try { if (tab) tab.close(); } catch (e2) {}
      if (btn) { btn.disabled = false; btn.textContent = 'Google Photo ID'; }
      showToast('Could not stage the photo for Google — try again', 3000, true);
    }
  };

  // v0.9.962 (Brad): the "waiting for Google's answer" reminder shown on the
  // review card after Research by Photo. Can't draw on Google's tab (cross-site
  // security), so the reminder lives here, where the answer comes back.
  // v0.9.1170 (Brad: "when we use the google lens, we need a box to paste it into,
  // its natural and i can see that i did something and also that what i thought i
  // pasted, was really pasted"). The round trip worked entirely invisibly — a
  // keystroke listener and a clipboard watcher — so a paste that missed, or that
  // grabbed the wrong thing, looked exactly like a paste that worked. The box is
  // not a new mechanism; it is the same _pinProcessText the keystroke path uses, with
  // the paste made visible and reversible before it is acted on.
  function _pinLensBannerHtml() {
    var box = 'width:100%;box-sizing:border-box;min-height:4.2rem;margin-top:0.5rem;'
      + 'padding:0.5rem 0.6rem;border:1px solid var(--border);border-radius:8px;'
      + 'background:var(--surface2);color:var(--text);font-family:var(--font-mono);'
      + 'font-size:0.78rem;line-height:1.4;resize:vertical';
    // Theme variables only — the colour ratchet refused a second rgba() literal
    // here and was right to: the banner already carries the one it needs.
    var use = 'padding:0.4rem 0.8rem;border-radius:8px;border:1.5px solid var(--accent2);'
      + 'background:var(--surface2);color:var(--accent2);font-family:var(--font-body);'
      + 'font-weight:700;font-size:0.82rem;cursor:pointer';
    return '<div id="pin-lens-banner" style="background:rgba(212,168,67,0.14);border:1.5px solid var(--accent2,#d4a843);border-radius:9px;padding:0.55rem 0.7rem;margin-bottom:0.6rem;font-size:0.8rem;color:var(--text-mid);line-height:1.45">' +
      (window.IS_MOBILE_UA   // v0.9.1920 (camera list #6)
        ? '<b>Waiting for Google\u2019s answer.</b> In the Google tab, press and hold on the answer, choose <b>Select all</b>, then <b>Copy</b>. ' +
          'Come back here, press and hold in this box and choose <b>Paste</b>.'
        : '<b>Waiting for Google\u2019s answer.</b> In the Google tab press <b>Ctrl+A</b> then <b>Ctrl+C</b>, ' +
          'come back here and paste it into this box. (A snip works too \u2014 Win+Shift+S, then Ctrl+V anywhere on this card.)') +
      '<textarea id="pin-lens-paste" spellcheck="false" placeholder="Paste Google\u2019s answer here\u2026" ' +
        'oninput="_pinLensPasteChanged()" style="' + box + '"></textarea>' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.45rem;flex-wrap:wrap">' +
        '<button id="pin-lens-use" onclick="_pinUseLensPaste()" disabled style="' + use + ';opacity:0.5">Use this answer</button>' +
        '<span id="pin-lens-count" style="font-size:0.74rem;color:var(--text-dim)">nothing pasted yet</span>' +
      '</div>' +
      '</div>';
  }
  // Live confirmation that something landed, and how much — the whole point of the
  // box is that "what i thought i pasted, was really pasted" is visible.
  window._pinLensPasteChanged = function () {
    var ta = document.getElementById('pin-lens-paste');
    var btn = document.getElementById('pin-lens-use');
    var cnt = document.getElementById('pin-lens-count');
    var n = ta ? String(ta.value || '').trim().length : 0;
    if (btn) { btn.disabled = n < 10; btn.style.opacity = n < 10 ? '0.5' : '1'; }
    if (cnt) {
      cnt.textContent = n
        ? (n.toLocaleString() + ' character' + (n === 1 ? '' : 's') + ' pasted')
        : 'nothing pasted yet';
    }
  };
  window._pinUseLensPaste = function () {
    var ta = document.getElementById('pin-lens-paste');
    var txt = ta ? String(ta.value || '').trim() : '';
    if (txt.length < 10) { showToast('Paste Google\u2019s answer into the box first', 3000, true); return; }
    var _busy = _pinBtnBusy(document.getElementById('pin-lens-use'), 'Reading\u2026');
    try { _pinProcessText(txt); } finally { _busy(); }
  };

  // v0.9.915 (Brad): read a SCREENSHOT of a Google/Lens answer. Pick the
  // screenshot, run it through the same identify AI (it reads the labeled
  // Manufacturer/SKU/Description/Year text right off the image), then apply
  // the result to the group and reopen the review card — same shape as the
  // Lens clipboard return-trip, minus the fiddly text-copy step.
  // v0.9.962 (Brad): ONE place that applies a parsed reading (from a snip, a
  // copied answer, or the Lens return-trip) to the open group and reopens the
  // review card. Returns false if the metadata had nothing usable.
  // v0.9.1086 — `aiText` is a PARAMETER. In v0.9.1085 this function referenced
  // a variable named `ai` that exists in its callers and not here. Every paid
  // read threw a ReferenceError, the try/catch two lines down swallowed it, the
  // previous answer stayed on screen, and the credit was spent. Brad paid twice
  // for that. Syntax checking cannot catch an out-of-scope name; a test that
  // actually CALLS the function can, and there is one now.
  function _pinApplyMeta(meta, gs, aiText) {
    var got = meta && (meta.itemNum || meta.description || meta.manufacturer || meta.roadName);
    if (!got) return false;
    // v0.9.1087 — reconciliation happens HERE, once, for every path that stores
    // a paid read. The v0.9.1084 version was wired by a script that matched the
    // same anchor three times and inserted at the first match every time: all
    // three copies stacked up in the screenshot path (one referencing a variable
    // that does not exist there), and the token button and the batch got NONE.
    // Brad pressed "Read this photo", the reader said 6175 in its own words, and
    // the card kept 6-39457 because nothing on that path ever compared the two.
    // One shared location cannot be wired unevenly.
    try {
      if (typeof _pinReconcileAiNum === 'function') {
        var _rc0 = _pinReconcileAiNum(meta, aiText || '', _pinPreferOf(gs[0]));
        if (_rc0 && _rc0.num && _rc0.num !== meta.itemNum) {
          meta._aiSku = _rc0.swappedFrom || meta.itemNum || '';
          meta.itemNum = _rc0.num;
          // v0.9.1164: a NUMBER confirmed by the catalog is settled. A match on
          // the reader's WORDS overrides a number the reader stated out loud, so
          // it stays a best guess and carries its evidence to the card — a
          // silently swapped number would be worse than no swap at all.
          if (_rc0.viaDesc) {
            meta._hedge = 1;
            meta._viaDesc = _rc0.viaDesc;
            meta._descOf = _rc0.descOf || '';
          } else {
            meta._hedge = 0;            // in-era catalog hit — no longer a guess
          }
        }
        // v0.9.1419 (Cooper's Big Boy): the number survived reconciliation but
        // its catalog row contradicts the reader's own description. That is a
        // GUESS wearing a confirmed number's face — hedge it, so the card
        // offers it as a chip to tap instead of quietly pre-filling it, and
        // the collector meets the conflict warning before anything is filed.
        if (_rc0 && _rc0.conflict && _rc0.num === meta.itemNum) {
          meta._hedge = 1;
        }
      }
    } catch (eR0) { console.warn('[inbox] reconcile failed', eR0 && eR0.message); }
    try {
      var ids = _ids(); var fid0 = _pinOnScreenFid() || _pinReadFid(gs[0]) || gs[0].files[0].id; var prev = ids[fid0] || {};
      var _aiRaw = String(aiText || '').replace(/\s+/g, ' ').trim().slice(0, 900) || (prev.aiRaw || '');
      var _aiSku = (meta && meta._aiSku) || '';
      var trim = function (v, old) { return String(v || old || '').slice(0, 120); };
      ids[fid0] = { aiRaw: _aiRaw, aiSku: _aiSku,
        // v0.9.1490: an enumerated answer stores ALL candidates and keeps the
        // number BLANK until the user picks (Brad's call) — prev junk must
        // not linger under a fresh multi-candidate read.
        num: (meta._altCands && meta._altCands.length >= 2) ? ''
           : (meta.itemNum ? String(meta.itemNum) : (prev.num || '')),
        guess: (meta._altCands && meta._altCands.length >= 2) ? 1
           : (meta.itemNum ? (meta._hedge ? 1 : 0) : (prev.guess || 0)),
        alts: (meta._altCands && meta._altCands.length >= 2)
           ? meta._altCands.slice(0, 5).map(function (c) { return c.note ? (c.num + ' \u2014 ' + c.note) : c.num; })
           : (prev.alts || undefined),
        tried: 1,
        // v0.9.1151 (pre-beta audit, BLOCKER 3): PAID reads were stored with no
        // rv stamp. _pinAutoRead skips a photo only when rec.rv === READER_VER,
        // and _stale() calls a missing record stale — so every paid read with no
        // _freeTried marker was re-queued by the background reader (which fires
        // 400ms after each inbox refresh) and REPLACED wholesale by a bare free
        // read. Maker, description, road, year, gauge, subType and aiRaw gone,
        // silently, for money already spent. This file documents the same trap
        // at the re-crop path and fixed it there by stamping rv; the paid writers
        // were missed. Stamping here makes the auto-reader leave paid work alone.
        rv: READER_VER,
        paid: 1,
        mfr: trim(meta.manufacturer, prev.mfr), desc: trim(meta.description, prev.desc),
        road: trim(meta.roadName, prev.road), year: trim(meta.year, prev.year),
        // v0.9.968 (Brad): keep scale + item-type so the Add wizard can pre-fill
        // them (e.g. "O" gauge, "Accessory" for a building). Were being dropped.
        gauge: trim(meta.gauge, prev.gauge), subType: trim(meta.subType, prev.subType),
        // v0.9.1164: when the number came from the reader's WORDS rather than
        // from a number it printed, store the evidence in the same fields the
        // free path uses, so the review card's existing "Matched on the words"
        // disclosure covers the paid read too. One display, both routes.
        viaDesc: !!(meta && meta._viaDesc) || !!prev.viaDesc,
        descOf: (meta && meta._descOf) || prev.descOf || '',
        dbg: (meta && meta._viaDesc)
          ? Object.assign({}, prev.dbg || {}, { viaDesc: meta._viaDesc })
          : (prev.dbg || null)
      };
      _idsSave(ids);
    } catch (eS) {
      // v0.9.1086: this used to log and carry on, so a broken save looked exactly
      // like a good one — which is how a ReferenceError here cost Brad two
      // tokens before anyone noticed. A paid read that cannot be stored says so.
      console.error('[Inbox] could not store the read:', eS);
      showToast(rrSaveError(eS, 'the read \u2014 you were not charged for it again'), 5000, true);
    }
    _render();
    // v0.9.1325: was `_sel = {}; gs.forEach(...)` — staging the groups in the
    // shared selection map so _pinReview(null) would find them. That left them
    // ticked invisibly after the card closed. Named outright now.
    window._pinReview(gs.length === 1 ? gs[0].key : null, gs);
    // v0.9.1092: the re-opened card comes back to the photo that was read,
    // not the first one in the strip.
    try { if (fid0) window._pinRvSetMain(fid0); } catch (eM2) {}
    return true;
  }

  // Read a screenshot/snip blob: free OCR first, then a token read, then apply.
  async function _pinProcessShot(f) {
    var gs = PIN._rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    if (!f) return;
    var btn = document.getElementById('pin-rv-shot');
    var _shotBusy = _pinBtnBusy(btn, 'Reading screenshot\u2026');   // v0.9.1168
    try {
      // v0.9.917 (Brad): CHEAP FIRST. A screenshot is crisp digital text, so
      // try free on-device OCR (Tesseract) before spending a token. Only fall
      // back to the paid read when the free read doesn't yield an item number.
      var meta = null, _freeRead = false;
      try {
        if (typeof window._ensureTesseract === 'function' && typeof extractIdentifyMetadata === 'function') {
          var T = await window._ensureTesseract();
          var ocr = await T.recognize(f, 'eng', {});
          var _otxt = (ocr && ocr.data && ocr.data.text) || '';
          if (_otxt.trim()) {
            if (typeof window.rrSliceAiOverview === 'function') _otxt = window.rrSliceAiOverview(_otxt);   // v0.9.1486
            var m0 = extractIdentifyMetadata(_otxt);
            if (m0 && m0.itemNum) { meta = m0; _freeRead = true; }   // free read good enough only with a number
          }
        }
      } catch (eOcr) { console.warn('[Inbox] screenshot OCR (free pass) failed:', eOcr && eOcr.message); }
      if (!meta) {
        _shotBusy = _pinBtnBusy(btn, 'Reading\u2026');   // v0.9.1168
        var _h0 = _pinAiHints(PIN._rvGroups && PIN._rvGroups[0]);
        var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2([f], _h0) : await aiIdentifyImage(f, _h0);
        if (!ai || !ai.ok) {
          // v0.9.1163: one shared message source (rrReadFailMessage in ai-id.js).
          // This used to know only 'quota' and 'noconsent', so a switched-off
          // read reported as a failed one.
          var _m0 = (typeof rrReadFailMessage === 'function')
            ? rrReadFailMessage(ai && ai.reason, 'Could not read that screenshot — type the number instead')
            : 'Could not read that screenshot — type the number instead';
          if (_m0) showToast(_m0, 4500, true);
          return;
        }
        if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
        meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      }
      if (!_pinApplyMeta(meta, gs, ai && ai.text)) { showToast('No item info found in that screenshot — type the number instead', 4000, true); return; }
      showToast(meta._hedge
        ? 'Read the screenshot — the number is a best guess, double-check it'
        : ('Read the screenshot' + ((_freeRead && _pinAr()) ? ' (free — no photo ID used)' : '') + ' — check it over and hit Add'), 4000);
    } catch (e) {
      console.warn('[Inbox] read screenshot:', e);
      showToast('Could not read that screenshot — try again or type the number', 3800, true);
    } finally {
      if (typeof _shotBusy === 'function') _shotBusy();
    }
  }

  // Read copied TEXT (e.g. Ctrl+A, Ctrl+C of the Google answer) — parse it and
  // apply. No token used; text parsing is free.
  function _pinProcessText(txt) {
    var gs = PIN._rvGroups;
    if (!gs || !gs.length) return false;
    txt = String(txt || '').trim();
    if (!txt) return false;
    if (typeof window.rrSliceAiOverview === 'function') txt = window.rrSliceAiOverview(txt);   // v0.9.1486: answer only, never result titles
    var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
    // v0.9.1490 (Brad: "offer multiple item numbers... leave blank until
    // user picks"): when the answer ITSELF enumerates candidates (the NYC
    // F3 "2333, 2344, or 2354"), keep them ALL — number stays blank, the
    // alt-chips row offers each with its tell-note, tap runs the lookup
    // with references.
    try {
      var _enumC = (typeof window._identifyEnumCandidates === 'function') ? window._identifyEnumCandidates(txt) : [];
      if (_enumC.length >= 2 && (!meta.itemNum || _enumC.some(function (c) { return c.num === String(meta.itemNum).toUpperCase(); }))) {
        // v0.9.1502 (Brad's rule): a definitive LEAD wins outright -- only a
        // genuinely hedged answer earns the pick-one-yourself treatment.
        var _leadN = (typeof window.rrAnswerLeadNumber === 'function') ? window.rrAnswerLeadNumber(txt) : '';
        if (_leadN) {
          meta.itemNum = _leadN;
          meta._altCands = _enumC.filter(function (c) { return c.num !== _leadN; });
        } else {
          meta._altCands = _enumC;
          meta._hedge = 1;
          meta.itemNum = '';
        }
      }
    } catch (eEn) {}
    if (!_pinApplyMeta(meta, gs, txt)) return false;
    showToast((meta._altCands && meta._altCands.length)
      ? 'Google named ' + meta._altCands.length + ' possibles — pick the one you have on the card'
      : (meta._hedge
        ? 'Read the copied answer — the number is a best guess, double-check it'
        : 'Read the copied answer — check it over and hit Add'), 4000);
    return true;
  }

  window._pinReadShot = function () {
    var gs = PIN._rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var inp = document.getElementById('pin-shot-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'pin-shot-input'; inp.accept = 'image/*'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) _pinProcessShot(f); };
    inp.click();
  };

  // ══ v0.9.1052 — crop before a paid read ══════════════════════════════════
  // Brad photographs a wall, so most frames hold two items — one at the top,
  // one below. The reader answers about whatever it sees, and it took the top
  // one. Cropping does not make the read cheaper; it stops the SECOND read you
  // would otherwise need after the first answered about the wrong train. Over
  // a hundred photos that is a hundred reads instead of two hundred.
  //
  // It is not literally unskippable — a photo that is already tight should not
  // need ceremony. But the skip is a labelled, deliberate choice ("Use whole
  // photo"), not an accidental one, and the crop box opens on the rectangle you
  // used last so most photos need a nudge rather than a fresh drag.
  // v0.9.1309 (Brad: "just get rid of the crop toggle"): the Preferences
  // switch that skipped this step is GONE — the crop offer is unconditional
  // again. It never forces a crop: "Use whole photo" remains the one-tap
  // skip on any photo that is already tight, which is all the escape hatch
  // the step needs. (The stored setting and its reader were removed
  // together — no writer-less orphan key left behind, the v0.9.1130 audit
  // smell this very setting was once fixed FOR.)
  function _pinCropForRead(blob, cb) {
    if (!blob || typeof window._openCropper !== 'function') { cb(blob); return; }
    var url;
    try { url = URL.createObjectURL(blob); } catch (e) { cb(blob); return; }
    var done = false;
    function finish(out) {
      if (done) return; done = true;
      try { URL.revokeObjectURL(url); } catch (e) {}
      cb(out || blob);
    }
    window._openCropper(url,
      function (cropped) { finish(cropped); },
      function () { finish(blob); },
      {
        title: 'Crop to one item',
        hint: 'The reader answers about whatever is in frame',
        applyLabel: 'Read this',
        cancelLabel: 'Use whole photo',
      });
  }

  // v0.9.967 (Brad): identify THIS item straight from its own photo with one
  // token — no Google/Lens round-trip. The free reader already ran on drop, so
  // this goes straight to the paid read for the leftovers it couldn't place.
  window._pinReviewIdentify = async function () {
    if (!_pinAr()) return;   // v0.9.1927: paid read — beta feature
    var gs = PIN._rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var btn = document.getElementById('pin-rv-idtoken');
    // v0.9.1052: don't say "Reading…" while the crop screen is still open —
    // nothing is being read and nothing has been spent yet.
    var _idBusy = _pinBtnBusy(btn, 'Crop first\u2026');   // v0.9.1168; v0.9.1309: crop step always offered
    try {
      var g = gs[0];
      // v0.9.1092: "Read this photo" reads the photo ON SCREEN. For a set the
      // members are different items, so the extra "angles" are only sent when
      // this is a single-item group — same rule as the batch.
      var _curFid = _pinOnScreenFid();
      var fl;
      if (_pinFilesToRead(g).length > 1) {
        var _cur = g.files.filter(function (f) { return f.id === _curFid; });
        fl = _cur.length ? _cur : g.files.slice(0, 1);
      } else {
        fl = g.files.slice(0, 4);
        if (_curFid) {
          // lead with the photo on screen so it is the one that gets cropped
          fl.sort(function (a, b) { return (a.id === _curFid ? -1 : 0) - (b.id === _curFid ? -1 : 0); });
        }
      }
      var blobs = [];
      for (var i = 0; i < fl.length; i++) {
        try { blobs.push(await _pinBytes(fl[i].id)); } catch (eB) {}
      }
      if (!blobs.length) { showToast('Could not load the photo — try again', 3000, true); return; }
      // v0.9.1052: crop the PRIMARY frame before spending anything. The other
      // angles go as they are — several views genuinely help the read, and
      // cropping four photos one at a time would cost more than it saves.
      blobs[0] = await new Promise(function (res) { _pinCropForRead(blobs[0], res); });
      _idBusy = _pinBtnBusy(btn, 'Reading\u2026');   // v0.9.1168: crop closed, the read is really running now
      _pinStepsReset(); _pinStep(RR_READ_STEPS.paid);   // v0.9.1173
      var _h1 = _pinAiHints(PIN._rvGroups && PIN._rvGroups[0]);
      var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2(blobs, _h1) : await aiIdentifyImage(blobs[0], {});
      if (!ai || !ai.ok) {
        // v0.9.1163 — THE one Brad hit. His reads were switched off, so this
        // said "Could not read that photo — try Google Photo ID" and he went
        // looking for a broken reader. One shared message source now.
        var _m1 = (typeof rrReadFailMessage === 'function')
          ? rrReadFailMessage(ai && ai.reason)
          : 'Could not read that photo — try Google Photo ID, or type the number';
        if (_m1) showToast(_m1, 4500, true);
        return;
      }
      if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      // v0.9.1502: the reader's lead sentence names the item -- Brad's rule.
      if (!meta.itemNum && typeof window.rrAnswerLeadNumber === 'function') {
        var _ldR = window.rrAnswerLeadNumber(ai.text);
        if (_ldR) meta.itemNum = _ldR;
      }
      if (!_pinApplyMeta(meta, gs, ai && ai.text)) { showToast('Could not pull an item number from the photo — try Google Photo ID', 4200, true); return; }
      _pinStepsReset();
      showToast(meta._hedge
        ? 'Best guess from the photo — double-check the number (1 photo ID used)'
        : 'Read from the photo — check it over and add it (1 photo ID used)', 4000);
    } catch (e) {
      console.warn('[Inbox] review identify:', e);
      showToast('Could not read the photo — try again', 3000, true);
    } finally {
      var b2 = document.getElementById('pin-rv-idtoken');
      // v0.9.1168: the restore function puts back exactly what was there, so the
      // v0.9.1163 "reads are off" wording no longer has to be duplicated here.
      if (typeof _idBusy === 'function') _idBusy();
      else if (b2) { b2.disabled = false; }
    }
  };

  // v0.9.962 (Brad): paste-to-read. While the review card is open, press Ctrl+V
  // to read whatever you grabbed from Google — a snipped picture OR copied text
  // (highlight the answer, or just Ctrl+A the whole page). One keystroke, no
  // button, no file picker. A short manual paste into the number box is left
  // alone so typing/pasting a number still works.
  document.addEventListener('paste', function (e) {
    if (!document.getElementById('pin-review-ov')) return;      // only when the review card is open
    if (!PIN._rvGroups || !PIN._rvGroups.length) return;
    var cd = e.clipboardData; if (!cd) return;
    // A picture on the clipboard (a snip) — always read it.
    var items = cd.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); showToast('Reading your snip…', 1800); _pinProcessShot(f); return; }
      }
    }
    // Otherwise copied text (the answer). Don't hijack a short paste into a field.
    var txt = (cd.getData && cd.getData('text')) || '';
    txt = txt.trim();
    if (!txt) return;
    var t = e.target;
    // v0.9.1170: a paste aimed at the Lens box belongs IN the Lens box. Without
    // this the listener swallowed it, acted on it invisibly, and left the box
    // empty — which is precisely the "did that even work?" the box exists to end.
    if (t && t.id === 'pin-lens-paste') { setTimeout(window._pinLensPasteChanged, 0); return; }
    var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (inField && txt.length < 25) return;   // let a short manual paste land in the box
    e.preventDefault();
    showToast('Reading the copied answer…', 1800);
    _pinProcessText(txt);
  });

  // Return-trip watcher for Research by Photo (mirrors the wizard's
  // _identifyReadClipboard flow): on tab-return, read the clipboard, parse
  // Google's copied answer, merge it into the group's stored findings, and
  // reopen the review card. Watches for 15 minutes, ignores an unchanged
  // clipboard, and gives up silently on clipboard-permission denials.
  PIN._pinLensGroups = null;
  var _pinLensClip = '', _pinLensVisOn = false, _pinLensArmedAt = 0;
  function _pinLensArm(gs) {
    PIN._pinLensGroups = gs;
    _pinLensArmedAt = new Date().getTime();
    _pinLensClip = '';
    try { navigator.clipboard.readText().then(function (t) { _pinLensClip = (t || '').trim(); }).catch(function () {}); } catch (e) {}
    if (!_pinLensVisOn) {
      _pinLensVisOn = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && PIN._pinLensGroups) setTimeout(_pinLensCheck, 450);
      });
    }
  }
  function _pinLensCheck() {
    if (!PIN._pinLensGroups) return;
    if (new Date().getTime() - _pinLensArmedAt > 15 * 60 * 1000) { PIN._pinLensGroups = null; return; }
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then(function (txt) {
      txt = (txt || '').trim();
      if (!txt || txt === _pinLensClip) return;   // nothing new copied yet — keep watching
      _pinLensClip = txt;
      if (typeof window.rrSliceAiOverview === 'function') txt = window.rrSliceAiOverview(txt);   // v0.9.1486
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
      try {   // v0.9.1490: same enumeration handling as the paste path
        var _enumC2 = (typeof window._identifyEnumCandidates === 'function') ? window._identifyEnumCandidates(txt) : [];
        if (_enumC2.length >= 2 && (!meta.itemNum || _enumC2.some(function (c) { return c.num === String(meta.itemNum).toUpperCase(); }))) {
          // v0.9.1502: same lead-wins rule as the paste path
          var _leadN2 = (typeof window.rrAnswerLeadNumber === 'function') ? window.rrAnswerLeadNumber(txt) : '';
          if (_leadN2) {
            meta.itemNum = _leadN2;
            meta._altCands = _enumC2.filter(function (c) { return c.num !== _leadN2; });
          } else {
            meta._altCands = _enumC2;
            meta._hedge = 1;
            meta.itemNum = '';
          }
        }
      } catch (eEn2) {}
      var got = meta.itemNum || meta.description || meta.manufacturer || meta.roadName;
      if (!got) return;                            // unrelated clipboard — keep watching
      var gs = PIN._pinLensGroups;
      PIN._pinLensGroups = null;
      // v0.9.962: same shared applier as the snip/paste paths.
      // v0.9.1124 (audit finding): this passed `ai && ai.text` — but `ai` is a
      // local in the three OTHER callers and does not exist here, so every
      // successful return trip threw ReferenceError. `_pinLensGroups = null`
      // two lines up had already disarmed the watcher, and the .catch() below
      // (written for clipboard-permission denials) ate the error, so the whole
      // Google round trip failed silently and could not be retried. The text
      // the applier wants is the clipboard text itself — same as line 2252.
      if (_pinApplyMeta(meta, gs, txt)) {
        showToast(meta._hedge
          ? "Google's answer applied, but it hedged on the number — double-check it"
          : "Google's answer applied — check it over and hit Add", 4000);
      }
    }).catch(function () { /* permission denied — the number box still takes a manual paste */ });
  }

  window._pinReviewResearch = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    num = String(num).trim();
    if (!num) { showToast('Type an item number to research', 2500, true); return; }
    // v0.9.970 (Brad): remember this item's group(s) so Close on the Research
    // Result card brings you back to THIS item's card, not the inbox grid.
    var _keys = (PIN._rvGroups || []).map(function (g) { return g.key; });
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    if (typeof window._researchLookupTyped === 'function') {
      window._researchLookupTyped(num, { onClose: function () {
        if (!_keys.length) return;
        // v0.9.1325: re-resolve the keys against the LIVE groups rather than
        // staging them in _sel (see _pinReview's `only` note). Re-resolving
        // also means a group that left the inbox while Research was open
        // simply drops out instead of re-opening a card on a dead key.
        var _back = PIN._groups.filter(function (g) { return _keys.indexOf(g.key) >= 0; });
        if (!_back.length) return;
        try { window._pinReview(_back.length === 1 ? _back[0].key : null, _back); } catch (e) {}
      } });
    } else showToast('Research is still loading — try again in a moment', 3000, true);
  };

  // v0.9.1325 — THE INVISIBLE SELECTION BUG.
  //
  // This used to stage _rvGroups into the shared `_sel` map and call
  // _pinDiscard() with no argument. If the user then pressed Cancel at the
  // confirm, _pinDiscard returned without clearing _sel and without a
  // re-render — so the photos stayed SELECTED with no tick drawn anywhere
  // (the tick circle is built only in select mode, photo-inbox.js:_render),
  // while _selInfo armed both Discard and Identify on the count alone.
  //
  // The user's next tap on Identify then spent one photo ID per hidden photo,
  // and Discard binned photos they could not see were chosen. Same leak via
  // _pinApplyMeta (after a paid read) and via Research's onClose.
  //
  // Fixed at the root — the groups are passed as an argument — and belt and
  // braces in _selInfo, which now refuses to arm those two buttons outside
  // select mode no matter what is in _sel.
  window._pinReviewDiscard = function () {
    var gs = PIN._rvGroups;
    if (!gs.length) return;
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _pinDiscard(gs);
  };

  // Shared filing core: move every photo in `gs` into the item's Drive
  // folder, connect the sheet's photo link when the item is owned, or
  // remember the link + open the Add wizard when it isn't.
  // v0.9.1500: is this Drive folder the photo home of MORE copies than the
  // one in hand? The shared-folder era left both copies of a number linking
  // ONE folder; filing into a folder other copies also read re-mixes exactly
  // what the send-back/re-file cleanup is trying to split.
  function _pinFolderShared(fid, exceptPd) {
    if (!fid || !window.state || !state.personalData) return false;
    var all = Object.values(state.personalData);
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (!p || !p.owned || p === exceptPd) continue;
      var f = (String(p.photoItem || '').match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1] || '';
      if (f === fid) return true;
    }
    return false;
  }

  window._pinReviewAdd = async function (mode, targetKey) {
    mode = mode || 'auto';
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    // v0.9.1498 (task #28): an explicit attach target needs no typed number --
    // the picked copy already knows what it is.
    if (!num && !(mode === 'attach' && targetKey)) { showToast('Type or confirm the item number first', 2500, true); return; }
    var gs = PIN._rvGroups;
    // v0.9.1418: same silent guard as Apply had. Filing to the collection is
    // the single most consequential button on this page to press twice and
    // hear nothing from.
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!gs.length) return;
    // Ownership decides File-vs-Attach, so check it before we commit anything.
    var lkPre = _pinLookup(num);
    // v0.9.1498 (task #28): the copy picker hands the EXACT copy in targetKey
    // (a personalData key). Only a legacy no-target call still leans on the
    // first-owned-by-number lookup -- the very ambiguity the picker removes.
    var _tgt = (mode === 'attach')
      ? ((targetKey && window.state && state.personalData && state.personalData[targetKey]) || lkPre.ownedPd)
      : null;
    if (mode === 'attach' && !_tgt) {
      showToast('You don’t own ' + num + ' yet — use “File to my Collection” to add it, or type a number you already own', 5000, true);
      return;
    }
    // v0.9.1608: these photos may already belong to an add in progress —
    // saying yes twice is how the same picture makes two items. Ask, with
    // the claim named, before anything is staged again.
    try {
      // v0.9.2050: release abandoned holds first — only a REAL unfinished save warns
      try { if (typeof _pinSweepStaleClaims === 'function') _pinSweepStaleClaims(); } catch (eSw8) {}
      var _nm8 = _pinNoteFileMap();
      var _dupNum = '';
      for (var _g8 = 0; _g8 < gs.length && !_dupNum; _g8++) {
        for (var _f8 = 0; _f8 < gs[_g8].files.length; _f8++) {
          if (_nm8[gs[_g8].files[_f8].id]) { _dupNum = _nm8[gs[_g8].files[_f8].id]; break; }
        }
      }
      if (_dupNum) {
        // v0.9.1782: this carried the same misleading parenthetical the badge
        // did — it named being offline as the reason a save had not finished,
        // when an abandoned add is just as likely and was the actual case.
        // Found by the test written for the badge; the same wrong sentence
        // lived in two places.
        if (!(await appConfirm('These photos are already attached to an add of ' + _dupNum + ' that has not finished saving'
              + '. Adding again makes a SECOND item with the same pictures.',
              { title: 'Photos already spoken for', ok: 'Add a second item', cancel: 'Never mind', danger: true }))) {
          return;
        }
      }
    } catch (eDup) {}
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _setBusy(true, 'Filing to your collection');
    try {
      // ── v0.9.1606 (Brad, airplane test: "as soon as i hit add to my
      // collection it takes me back to the photo inbox") ─────────────────
      // MEASURED CAUSE: everything below resolves DRIVE FOLDERS first —
      // _folder(), driveEnsureItemFolder, driveFindOrCreateFolder — and
      // offline every one of those throws. The outer catch then wrote a
      // status line and stopped, with the review card already removed two
      // lines above, so the user landed back on the inbox grid and the Add
      // wizard never opened. The folders are not needed yet: for a NEW item
      // the note is staged and the wizard does the rest, and v0.9.1118
      // already established that a staged note may carry NO folders —
      // _flushPending resolves fromFid/toFid/link at move time (it has done
      // so for set-adds since then). So offline we skip the folder work
      // entirely and let the same pipeline finish on reconnect.
      var _offAdd = _pinOffline();
      var fromFid = _offAdd ? '' : await _folder();
      // v0.9.1498 (task #28): attaching to a copy that already HAS a photo
      // folder files into THAT folder -- making a second folder for the same
      // copy is how photos scatter. Only a copy with no folder yet gets one
      // made, named after ITS item number, and the link written to ITS row.
      var _tgtNum = (_tgt && String(_tgt.itemNum || '').trim()) || num;
      var _tgtFid = '';
      try { _tgtFid = (_tgt && _tgt.photoItem && (String(_tgt.photoItem).match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1]) || ''; } catch (eTF) { _tgtFid = ''; }
      if (_tgtFid === 'undefined') _tgtFid = '';
      var toFid, link;
      if (_offAdd) {
        // Offline: no folder can be made or read. Leave them blank —
        // _flushPending fills them in when the connection returns.
        toFid = ''; link = '';
      }
      else if (_tgtFid && _tgt && _tgt.inventoryId && typeof driveFindOrCreateFolder === 'function'
          && _pinFolderShared(_tgtFid, _tgt)) {
        // v0.9.1500: the picked copy's folder is ALSO another copy's folder.
        // Filing into it would re-mix the copies -- this copy gets its own
        // inventory-id subfolder inside it, and its link is repointed below.
        toFid = await driveFindOrCreateFolder(String(_tgt.inventoryId), _tgtFid);
        link = driveFolderLink(toFid);
      }
      else if (_tgtFid) { toFid = _tgtFid; link = String(_tgt.photoItem); }
      else if (_tgt && _tgt.inventoryId && typeof driveFindOrCreateFolder === 'function') {
        // v0.9.1499: a copy with no folder yet gets its OWN inventory-id
        // subfolder, never the number's shared folder (the two-6473s bug).
        var _tgBase = await driveEnsureItemFolder(_tgtNum);
        toFid = await driveFindOrCreateFolder(String(_tgt.inventoryId), _tgBase);
        link = driveFolderLink(toFid);
      } else { toFid = await driveEnsureItemFolder(_tgtNum); link = driveFolderLink(toFid); }
      var lk = lkPre;
      // Attach path when the user asked to attach, or when it's an owned item
      // being auto-filed / listed for sale. 'new' always makes a fresh item.
      // v0.9.966 (Brad): only the (now-unused) explicit 'attach' mode attaches.
      // 'new' and 'forsale' ALWAYS create a new item — multiples are allowed, so
      // we never silently fold photos into an item you already own.
      var _attach = (mode === 'attach');
      // Gather every selected file once (used whether we move now or on save).
      var fileList = [];
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) { fileList.push(gs[g].files[f]); }
      }
      var ts = new Date().getTime();
      // v0.9.1606: attaching to an item you ALREADY own needs Drive to move
      // the files, which offline cannot happen — but the note pipeline can
      // carry it. Stage the note and ARM it immediately (the row exists, so
      // _flushPending will file it the moment the connection returns), then
      // say so plainly instead of failing.
      if (_attach && _offAdd) {
        try {
          var _stgA = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
          _stgA[_tgtNum] = { link: '', fromFid: '', toFid: '', ts: ts,
            rsvFid: (fileList[0] && fileList[0].id) || '',
            files: fileList.map(function (fl) { return { id: fl.id, name: fl.name, role: (fl._meta && fl._meta.role) || '' }; }) };
          localStorage.setItem(SETSTAGE_KEY, JSON.stringify(_stgA));
          if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(_tgtNum);
        } catch (eSA) { console.warn('[Inbox] offline attach note:', eSA); }
        PIN._sel = {};
        _status('');
        _pinRefresh();
        showToast('You\u2019re offline \u2014 ' + fileList.length + ' photo' + (fileList.length > 1 ? 's' : '')
          + ' will move to ' + _tgtNum + ' when you\u2019re back online. They stay in the inbox until then.', 5200);
        return;
      }
      if (_attach) {
        // Already in the collection: committed action, no wizard to cancel,
        // so file the photos into its folder right away.
        // v0.9.1275 (R15): `moved` used to count files it was ABOUT to move,
        // and one failure abandoned the rest and skipped the toast entirely.
        // Now each move gets its own try, the count is of moves that landed,
        // and the toast below reports the real number either way.
        var moved = 0, _mvFail = 0, _mvRecs = [];   // v0.9.1499: what landed, for view placement
        for (var i2 = 0; i2 < fileList.length; i2++) {
          _status('Filing photo ' + (i2 + 1) + ' of ' + fileList.length + '…');
          var file = fileList[i2];
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
          try {
            await driveMoveFileToFolder(file.id, fromFid, toFid);
            moved++;
          } catch (eMv1) {
            _mvFail++;
            console.warn('[Inbox] attach move failed — continuing:', file.id, eMv1);
            continue;
          }
          try { await driveRequest('PATCH', '/files/' + file.id, { name: _tgtNum + ' ADD ' + (ts + moved) + '.' + ext }); } catch (eRn) {}
          _mvRecs.push({ id: file.id, name: _tgtNum + ' ADD ' + (ts + moved) + '.' + ext });
        }
        PIN._sel = {};
        _status('');
        var pd = _tgt || lk.ownedPd;   // v0.9.1498: the picked copy, exactly
        // v0.9.1252 (row-identity audit, finding 16): pd was captured before a
        // folder lookup and a per-file Drive move/rename loop — a long way back.
        // Its .row can be stale by now, and the sibling write in _flushPending
        // was hardened for exactly this in v0.9.1192 while this one was not.
        // Match it: re-resolve the live record, refuse a placeholder row, and
        // only record the link in memory once the sheet has actually taken it.
        var _pdKey = Object.keys(state.personalData || {}).find(function (k) { return state.personalData[k] === pd; });
        var _livePd = (_pdKey && state.personalData[_pdKey]) || pd;
        var _rowKnown = _livePd.row && Number(_livePd.row) !== 99999;
        if (link && String(_livePd.photoItem || '') !== link && _rowKnown
            && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && window.state.personalSheetId) {
          try {
            if (await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, _livePd.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + _livePd.row, [[link]], { num: _livePd.itemNum || '', invId: _livePd.inventoryId || '' }, 'collection'))
              _livePd.photoItem = link;   // only true once the sheet actually took it
          } catch (eUp) { console.warn('[Inbox] photo link write failed — leaving it for the repair pass:', eUp); }
        }
        if (_mvFail) showToast('Attached ' + moved + ' of ' + fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' to ' + _tgtNum + ' \u2014 ' + _mvFail + ' stayed in the inbox. Try them again.', 5000, true);
        else showToast('Attached ' + moved + ' photo' + (moved > 1 ? 's' : '') + ' to ' + _tgtNum, 3000);
        _pinRefresh();
        // v0.9.1499 (Brad): "it should just bring up that items detail page
        // and then let me select which view to put it in" -- open the copy
        // the photos just filed into and offer a view for each new photo.
        if (mode === 'attach' && moved > 0) {
          var _plPd = _livePd, _plLink = link, _plRecs = _mvRecs.slice();
          try { if (_plPd && _plPd.inventoryId && typeof _openOwnedByInvId === 'function') _openOwnedByInvId(_plPd.inventoryId); } catch (eNv1) {}
          setTimeout(function () { try { window._pinPlaceViews(_plRecs, _plLink); } catch (ePl) { console.warn('[Inbox] view placement:', ePl); } }, 700);
        }
        // v0.9.958 (Brad): "Send to For Sale" on an item you already own —
        // photos are filed above, now open the sale-price step for it.
        if (mode === 'forsale') {
          var _pdKey = Object.keys(state.personalData || {}).filter(function (k) { return state.personalData[k] === lk.ownedPd; })[0];
          if (_pdKey && typeof listForSaleFromCollection === 'function') { listForSaleFromCollection(-1, _pdKey); }
          else showToast('Photos attached — open ' + num + ' from My Collection to set a sale price', 4500);
        }
      } else {
        // NOT in the collection yet: the Add wizard opens next and may be
        // cancelled. DEFER moving the photos out of the inbox until the item
        // is actually saved (see _flushPending). Cancel = nothing moved and
        // the photos stay in the inbox. (Session 168, Brad — fixes vanishing photos)
        PIN._sel = {};
        _status('');
        // v0.9.1130 (audit #4) — this note used to go STRAIGHT into PENDING_KEY,
        // and _flushPending files a note the moment ANY owned row with that
        // number exists. Adding a second copy of something you already own made
        // that true instantly, so cancelling the wizard could not stop the
        // photos leaving the inbox. Exactly the bug v0.9.1122 fixed for sets;
        // the single-item lane never got the same treatment. It stages now and
        // is armed by rrPinSetPhotoSaved when a save really happens.
        try {
          var stage1 = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
          stage1[num] = _pinHoldMark({ link: link, fromFid: fromFid, toFid: toFid, ts: ts,
            rsvFid: (fileList[0] && fileList[0].id) || '',   // v0.9.935: files as the Right Side View
            files: fileList.map(function (fl) { return { id: fl.id, name: fl.name, role: (fl._meta && fl._meta.role) || '' }; }) });   // v0.9.1562: role rides along; v0.9.2053: which opening holds it
          localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage1));
        } catch (eP) {}
        _pinRefresh();
        showToast(fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' will attach when you save'
          + (_offAdd ? ' — and upload when you\u2019re back online' : ' — they stay in the inbox until then'), 3500);
        var _aiS = {}; try { _aiS = _ids()[gs[0].files[0].id] || {}; } catch (eAi) {}
        // v0.9.1735: if he picked an identity in "pick the one you have", that
        // is the road name the Add flow must carry - otherwise the wizard's
        // variation step scopes to the reader's guess and hides the very rows
        // he just chose between. Covers all three destinations at once (Add,
        // For Sale, and attach-to-an-item-I-own) because they share this path.
        try {
          if (PIN._rvPickedId && String(PIN._rvPickedId.num) === String(num)) {
            if (PIN._rvPickedId.road) _aiS = Object.assign({}, _aiS, { road: PIN._rvPickedId.road });
            if (PIN._rvPickedId.desc) _aiS = Object.assign({}, _aiS, { desc: PIN._rvPickedId.desc });
          }
        } catch (ePA) {}
        // v0.9.907 (Brad, item [1a]): hand the first inbox photo's Drive id to the
        // wizard so the variation step can preview the item you're adding.
        var _addPhotoId = (fileList[0] && fileList[0].id) || '';
        // v0.9.1369 (Brad): the WHOLE group rides along, not just the first
        // shot. A two-photo group is usually one picture of the piece and one
        // of the number stamped on it — handing over only the first is handing
        // over the half that cannot identify anything.
        var _addPhotoIds = fileList.map(function (fl) { return (fl && fl.id) || ''; }).filter(Boolean);
        _pinAddNow(num, { manufacturer: _aiS.mfr || '', description: _aiS.desc || '', roadName: _aiS.road || '', year: _aiS.year || '', gauge: _aiS.gauge || '', subType: _aiS.subType || '', _prefer: _pinPreferOf(gs[0]) }, _addPhotoId, { alsoListForSale: mode === 'forsale', photoIds: _addPhotoIds, groupKind: (gs[0] && (gs[0].kind || (gs[0].files[0] && gs[0].files[0]._meta && gs[0].files[0]._meta.kind))) || '' });
        if (mode === 'forsale') showToast('Adding ' + num + ' to your collection and For Sale list — set the price on the sale step', 4500);
      }
    } catch (e) {
      console.error('[Inbox] add/attach:', e);
      // v0.9.1606: a failure here used to leave a status line on a page the
      // user had just been bounced back to, with no idea why. Say it.
      if (_pinOffline()) {
        _status('You\u2019re offline — that did not go through. Try again once you\u2019re back on.');
        showToast('You\u2019re offline — that did not go through. Nothing was lost; try again when you reconnect.', 5000, true);
      } else {
        _status('Filing failed partway — hit Refresh to see what’s left, then try again.');
        showToast('That did not finish — hit Refresh to see what is left, then try again.', 4500, true);
      }
    } finally { _setBusy(false); }
  };

  // v0.9.958 (Brad): the four review-card exits are thin wrappers over the one
  // shared filer, so every path uses the exact same, tested Drive/sheet code.
  // v0.9.966 (Brad): "Add to my Collection" ALWAYS adds a new item — you can
  // own multiples of the same number, so it must never fold photos into an
  // existing item. (Adding photos to an item you already own is a separate flow.)
  // v0.9.1114 — the photo group walks into the wizard's EXISTING set flow
  // with its members pre-entered. The identify step's suggestion engine
  // (suggestSets) runs off _enteredNums on render, so with six member reads
  // the right set usually appears immediately with a "This is mine" button.
  // ══ v0.9.1296 (request #24): photos → set members, as ONE pure walk. ═════
  // Files are walked in display order. A 'together' shot belongs to nobody.
  // A 'detail' shot belongs to the PIECE ABOVE it — it contributes its
  // photos, never its own number, so a car with a close-up is one member
  // with two pictures instead of two members. A detail whose piece above
  // never produced a number stays in the inbox with that piece (attaching it
  // to the member before THAT would file it on the wrong car).
  function _pinSetMemberMap(files, ids0) {
    var nums = [], memberPhotos = {}, numFiles = {};
    var lastNum = '', lastFailed = false;
    // v0.9.1343 — pair shots ride with the set's ENGINE, wherever they sit.
    // Brad's call over "the piece below it": a shot of an engine+tender, an AA
    // or an ABA is always of the locomotive consist, so tying it to the engine
    // means he never has to think about photo order for these. That needs the
    // members resolved first, so pair shots are set aside here and attached in
    // a second pass below.
    var pairPhotos = [], engineNum = '';
    (files || []).forEach(function (f) {
      var meta = (f && f._meta) || {};
      if (meta.role === 'together') return;
      if (_pinIsPairRole(meta.role)) { pairPhotos.push(f); return; }
      if (meta.role === 'detail') {
        if (lastNum && !lastFailed) {
          (memberPhotos[lastNum] = memberPhotos[lastNum] || []).push(f.id);
          (numFiles[lastNum] = numFiles[lastNum] || []).push({ id: f.id, name: f.name, role: meta.role || '' });
        }
        return;
      }
      var s0 = f && ids0[f.id];
      var n0 = (s0 && s0.num) ? String(s0.num).trim() : '';
      if (!n0) { lastFailed = true; return; }
      lastFailed = false; lastNum = n0;
      // The first photo tagged Engine names the engine. Nothing tagged Engine
      // (he may not have bothered) → the set's lead item, which is the one the
      // set flow already treats as the locomotive.
      // v0.9.1448: a diesel set's locomotive is tagged "A unit \u2014 powered",
      // not "Steam Engine" \u2014 either one names the engine that pair shots
      // and the set's cover photo file with.
      if (!engineNum && (meta.role === 'engine' || meta.role === 'aunit_p')) engineNum = n0;
      if (nums.indexOf(n0) < 0) nums.push(n0);
      // v0.9.1117 (Brad: "its not putting the pictures in their rhs slot") —
      // each member's own inbox photo rides into that item's photo slot.
      // v0.9.1122: a LIST per number, not one id — a set that contains the
      // same car twice (1562W's two 2442s) hands slot 1 the first photo and
      // slot 2 the second, instead of both showing the same picture.
      (memberPhotos[n0] = memberPhotos[n0] || []).push(f.id);
      // v0.9.1118: every photo that read this member's number files with it.
      (numFiles[n0] = numFiles[n0] || []).push({ id: f.id, name: f.name, role: meta.role || '' });
    });
    // Second pass: file every pair shot with the engine. If the set produced no
    // members at all there is nothing to attach to, and the photo simply stays
    // in the inbox rather than being silently dropped.
    var homeNum = engineNum || nums[0] || '';
    if (homeNum) {
      pairPhotos.forEach(function (f) {
        (memberPhotos[homeNum] = memberPhotos[homeNum] || []).push(f.id);
        (numFiles[homeNum] = numFiles[homeNum] || []).push({ id: f.id, name: f.name, role: (f._meta && f._meta.role) || '' });
      });
    }
    return { nums: nums, memberPhotos: memberPhotos, numFiles: numFiles, pairHome: homeNum, pairCount: pairPhotos.length };
  }
  if (typeof window !== 'undefined') window._pinSetMemberMap = _pinSetMemberMap;

  window._pinAddSetFromGroup = function () {
    var g = PIN._rvGroups && PIN._rvGroups[0];
    if (!g) return;
    var ids0 = _ids();
    // The walk sees the FULL ordered file list (not _pinFilesToRead, which
    // strips the detail shots this walk exists to attach).
    var _mm = _pinSetMemberMap(g.files, ids0);
    var nums = _mm.nums, memberPhotos = _mm.memberPhotos, numFiles = _mm.numFiles;
    if (nums.length < 2) { showToast('Fewer than two member numbers are read \u2014 re-read or type them first', 3500, true); return; }
    if (typeof _buildWizardModal !== 'function' || typeof getSteps !== 'function' || typeof renderWizardStep !== 'function') {
      showToast('The add wizard is not available on this page', 3000, true); return;
    }
    // v0.9.1118 (Brad: "the set was added, but the picture group did not
    // disappear") — one note per member, so the SAME machinery that clears a
    // single add clears the whole group once the walkthrough saves. No Drive
    // calls here; _flushPending resolves the folders at move time.
    //
    // v0.9.1122 (Brad: "i hit discard … the set picture was there but no item
    // pictures"): these notes used to go straight into PENDING_KEY, and
    // _flushPending files a note the moment an owned row with that number
    // exists. For a set Brad had ALREADY added once, that was true instantly —
    // so the photos filed themselves before he finished, and cancelling could
    // not put them back. Notes now wait in a STAGING area and are armed one at
    // a time, only when that member actually saves (rrPinSetPhotoSaved, called
    // from the set-save hook). Cancel now genuinely leaves the photos alone.
    // A new set add supersedes any abandoned staging. Photos whose number
    // never read are left in the inbox on purpose.
    try {
      var stage0 = {}, ts0 = new Date().getTime();
      nums.forEach(function (n1) {
        var fl = numFiles[n1] || [];
        if (!fl.length) return;
        stage0[n1] = _pinHoldMark({ link: '', fromFid: '', toFid: '', ts: ts0,
                       rsvFid: fl[0].id, files: fl });   // v0.9.2053: which opening holds it
      });
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage0));
    } catch (eP0) {}
    // v0.9.2053: the Add screen knows which holds are this set's, so closing it
    // without a save lets them go (rrPinReleaseSetHolds, from _doCloseWizard).
    var _setHoldIds = [];
    try { Object.keys(stage0 || {}).forEach(function (k0) { (stage0[k0].files || []).forEach(function (f0) { if (f0 && f0.id) _setHoldIds.push(f0.id); }); }); } catch (eSH) {}
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _buildWizardModal();
    // v0.9.1115 (Brad: "it asks me the priority for this item, which is a
    // want list item"): `wizard` is a top-level `let` — it does NOT live on
    // window. Assigning window.wizard made a decoy while renderWizardStep
    // kept reading the real, script-scoped variable, which still held the
    // LAST wizard used — Brad's previous Want-list add, priority question
    // and all. Bare assignment reaches the real binding, exactly like
    // addSetToCollection does.
    wizard = {
      step: 0, tab: 'set',
      data: { tab: 'set', set_knowsNum: 'No', _enteredNums: nums.slice(0),
              _setMemberPhotos: memberPhotos, _returnPage: 'photo-inbox',
              _pinSetStagedNums: Object.keys(stage0 || {}), _pinSetStagedFiles: _setHoldIds },
      steps: [], matchedItem: null,
    };
    wizard.steps = getSteps('set');
    var _skip = { set_knowsNum: 1, set_num: 1, set_loco: 1 };
    while (wizard.step < wizard.steps.length && _skip[wizard.steps[wizard.step].id]) wizard.step++;
    document.getElementById('wizard-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderWizardStep();
  };

  window._pinFileToCollection = function () { return window._pinReviewAdd('new'); };
  // v0.9.1423 (Brad): the single Add button's router. Number in the box →
  // the fast lane exactly as before (wizard opens prefilled, past the
  // item-number step). Box empty → the no-number lane (wizard Step 1, Item
  // Type picker). The user never has to know two lanes exist.
  window._pinAddItem = async function () {
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    if (num) return window._pinReviewAdd('new');
    // v0.9.2053 (Mike, 2026-10-29): an empty box with a best guess on the card
    // is not "no number". The guess sat in a chip, the big button opened an
    // empty Add screen about paper and mock-ups, and a train went in blank.
    var g = await _pinAskGuess();
    if (g === 'use') return window._pinReviewAdd('new');
    if (g === 'none') return window._pinAddNoNumber();
    // 'stay' — he backed out of the question; the card stays as it was
  };
  window._pinAttachOwned      = function () { return window._pinReviewAdd('attach'); };
  window._pinSendForSale      = async function () {
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    if (!num && (PIN._rvGuess || PIN._rvGuessMany)) {
      // v0.9.2053: the same question — the sales list needs a number, and the
      // card has the reader's guess at one. ("It's something else" leaves the
      // box for him to type in: a sales listing has no no-number road.)
      var g = await _pinAskGuess(true);
      if (g !== 'use') return;
    }
    return window._pinReviewAdd('forsale');
  };
  // v0.9.2053 — THE "Add it as …?" QUESTION. Answers 'use' (the guess is now in
  // the box, looked up exactly as tapping its chip does), 'none' (no number),
  // 'stay' (backed out, or nothing to ask about). Words: RR_INBOX_GUESS.
  async function _pinAskGuess(forSale) {
    var W = (typeof RR_INBOX_GUESS !== 'undefined') ? RR_INBOX_GUESS : null;
    var guess = String(PIN._rvGuess || '');
    var esc = function (t) { return (typeof rrEsc === 'function') ? rrEsc(t) : String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var fill = function (t) { return String(t || '').split('{num}').join(esc(guess)); };
    if (!W) return forSale ? 'stay' : 'none';
    if (guess) {
      var yes = await appConfirm(fill(W.ask), { title: fill(W.title), ok: fill(W.yes), cancel: W.no, dismiss: null });
      if (yes === null) return 'stay';
      if (yes) {
        try { window._pinPickNum(guess); } catch (eP) { var b = document.getElementById('pin-rv-num'); if (b) b.value = guess; }
        return 'use';
      }
      if (forSale) { try { var b2 = document.getElementById('pin-rv-num'); if (b2) b2.focus(); } catch (eF) {} return 'stay'; }
      return 'none';
    }
    if (PIN._rvGuessMany) {
      if (forSale) { showToast(W.many.replace(/, or add it with no number\.?$/, '.'), 4500); return 'stay'; }
      var ok = await appConfirm(W.many, { title: W.manyTitle, ok: W.manyYes, cancel: W.manyNo, dismiss: null });
      return ok ? 'none' : 'stay';
    }
    return forSale ? 'stay' : 'none';
  }

  // == v0.9.1498 (task #28, Brad): "Add to an existing item in my collection" ==
  //
  // Photos of an item he ALREADY owns landed in the inbox with no door to the
  // owned copy -- leaving the inbox for the detail page was the only route.
  // This is that door. It revives the v0.9.958 attach lane (dormant since
  // v0.9.966 made "Add" always create a new item) and fixes the one thing
  // wrong with it: it took the FIRST owned copy by number. The picker names
  // the copy -- the card number's own copies first (the same rows the "You
  // have this item" panel shows), plus a search over everything owned -- and
  // _pinReviewAdd('attach', key) files the photos into exactly that copy.
  // Direct move, no wizard, no deferred note: the photos leave the inbox the
  // moment the copy is picked, and the toast reports the real count.
  var _attachPickKeys = [];
  function _pinAttachEsc(s) {
    return (typeof rrEsc === 'function') ? rrEsc(s)
      : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function _pinAttachRows(el, label, items) {
    _attachPickKeys = [];
    var h = label ? '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin-top:0.3rem">' + _pinAttachEsc(label) + '</div>' : '';
    items.forEach(function (it) {
      var pd = it.pd, i = _attachPickKeys.length;
      _attachPickKeys.push(it.key);
      var bits = [];
      if (String(pd.variation || '').trim()) bits.push('Var ' + _pinAttachEsc(String(pd.variation).trim()));
      if (String(pd.condition || '').trim()) bits.push('Cond ' + _pinAttachEsc(String(pd.condition).trim()));
      if (String(pd.location || '').trim()) bits.push(_pinAttachEsc(String(pd.location).trim()));
      bits.push(pd.photoItem ? 'has photos' : 'no photos yet');
      h += '<button type="button" onclick="_pinAttachOwnedGo(' + i + ')"'
        + ' style="display:flex;align-items:center;gap:0.5rem;width:100%;box-sizing:border-box;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.6rem;margin-top:0.35rem;cursor:pointer;color:var(--text);font-family:var(--font-body)">'
        + '<span style="font-family:var(--font-mono);font-weight:700;font-size:0.85rem;color:var(--accent2,#c9922a);flex-shrink:0">' + _pinAttachEsc(String(pd.itemNum || '')) + '</span>'
        + '<span style="font-size:0.76rem;color:var(--text-dim);flex:1;min-width:0">' + bits.join(' \u00b7 ') + '</span>'
        + '</button>';
    });
    if (!items.length) h += '<div style="font-size:0.82rem;color:var(--text-dim);padding:0.6rem 0">No owned items match \u2014 try another search.</div>';
    el.innerHTML = h;
  }
  function _pinAttachDefault(el) {
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    var copies = (num && typeof rrOwnedCopies === 'function') ? rrOwnedCopies(num) : [];
    if (copies.length) {
      _pinAttachRows(el, 'Your ' + (copies.length > 1 ? copies.length + ' copies' : 'copy') + ' of ' + num, copies);
    } else {
      _attachPickKeys = [];
      el.innerHTML = '<div style="font-size:0.82rem;color:var(--text-dim);padding:0.6rem 0">'
        + (num ? 'You don\u2019t own ' + _pinAttachEsc(num) + ' \u2014 search above for the item these photos belong to.'
               : 'Search above for the item these photos belong to.')
        + '</div>';
    }
  }
  window._pinAttachSearch = function (q) {
    q = String(q || '').trim().toLowerCase();
    var el = document.getElementById('pin-attach-list');
    if (!el) return;
    // v0.9.1895: a one-digit number (your No. 4) is a real search.
    if (q.length < 2 && !/^\d$/.test(q)) { _pinAttachDefault(el); return; }
    var pdMap = (window.state || {}).personalData || {};
    var hits = [];
    Object.keys(pdMap).forEach(function (k) {
      var pd = pdMap[k];
      if (!pd || !pd.owned) return;
      var hay = (String(pd.itemNum || '') + ' ' + String(pd.description || '') + ' '
        + String(pd.customName || '') + ' ' + String(pd.roadName || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) hits.push({ key: k, pd: pd });
    });
    // v0.9.1895: the item whose number IS what was typed comes first ("4" puts
    // your No. 4 above every item that merely has a 4 in its words).
    var _isExact = function (h) { return String(h.pd.itemNum || '').toLowerCase() === q ? 0 : 1; };
    hits.sort(function (a, b) { return (_isExact(a) - _isExact(b)) || String(a.pd.itemNum || '').localeCompare(String(b.pd.itemNum || ''), undefined, { numeric: true }); });
    var total = hits.length;
    if (hits.length > 30) hits = hits.slice(0, 30);
    _pinAttachRows(el, total > 30 ? 'First 30 of ' + total + ' matches' : (total + ' match' + (total === 1 ? '' : 'es')), hits);
  };
  window._pinAttachOwnedGo = function (i) {
    var key = _attachPickKeys[i];
    var ov = document.getElementById('pin-attach-ov'); if (ov) ov.remove();
    if (key == null) return;
    return window._pinReviewAdd('attach', key);
  };
  window._pinAttachOwnedPick = function () {
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!PIN._rvGroups.length) return;
    var old = document.getElementById('pin-attach-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-attach-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;max-width:480px;width:100%;max-height:80vh;max-height:80dvh;display:flex;flex-direction:column;overflow:hidden">'
      + '<div style="padding:0.9rem 1rem 0.6rem">'
      + '<div style="font-weight:700;color:var(--text);font-size:1rem">Add these photos to an item you own</div>'
      + '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.2rem">Pick the copy \u2014 the photos file into its photo folder right away.</div>'
      + '</div>'
      + '<div style="padding:0 1rem 0.5rem"><input id="pin-attach-q" type="text" placeholder="Search your collection \u2014 number or description" autocomplete="off" spellcheck="false" oninput="_pinAttachSearch(this.value)" style="width:100%;box-sizing:border-box;padding:0.55rem 0.7rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.9rem"></div>'
      + '<div id="pin-attach-list" style="padding:0 1rem 0.75rem;overflow-y:auto;flex:1"></div>'
      + '<div style="padding:0.6rem 1rem;border-top:1px solid var(--border)"><button onclick="document.getElementById(\'pin-attach-ov\').remove()" style="width:100%;padding:0.6rem;border-radius:10px;border:1.5px solid #8b8e94;background:var(--bg-card);color:var(--text-dim);font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Cancel</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    _pinAttachDefault(document.getElementById('pin-attach-list'));
    try { var q = document.getElementById('pin-attach-q'); if (q) q.focus(); } catch (eF) {}
  };

  // ══ v0.9.1387 — SOME THINGS DO NOT HAVE AN ITEM NUMBER ════════════════════
  //
  // Brad, on a photo of a Lionel engineering blueprint: "it forces you to
  // enter an item number for something that doesn't have one. this paper item
  // should be manually entered."
  //
  // Every exit from the review card ran through _pinReviewAdd, which opens
  // with `if (!num) ... return`. The card assumed the thing in the photo is a
  // catalogued train. A blueprint, a poster, a catalogue, a mock-up has no
  // catalogue number — and worse, the reader had FOUND numbers on his drawing
  // (2205, 1872-21, 272723) and offered 2205 as a catalogue match, so the card
  // looked confident about an item number the object does not have.
  //
  // The wizard has handled these since v0.9.1278: the Item Type selector at
  // the top of the first screen offers Paper Item, Catalog, Mock-Up, Other and
  // Manual, and an ephemera save generates its own number. The only thing
  // missing was a door into it that did not demand a number first.
  //
  // NOTHING is guessed here. Brad picks the type from that selector — his
  // call, screenshotted: "should be the picker i just uploaded".
  var NONUM_PREFIX = '__nonum__';
  window._pinAddNoNumber = function () {
    var gs = PIN._rvGroups;
    // v0.9.1418: the third silent guard.
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!gs.length) return;
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    var fileList = [];
    for (var g = 0; g < gs.length; g++)
      for (var f = 0; f < gs[g].files.length; f++) fileList.push(gs[g].files[f]);
    if (!fileList.length) return;

    // Stage with NO Drive work, exactly as the set lane does (v0.9.1122):
    // empty fromFid/toFid/link are resolved by _flushPending at save time.
    // That matters more here than anywhere else — the folder must be named
    // after the number the ephemera save GENERATES, which does not exist yet,
    // and a cancelled add must leave no empty folder behind in Drive.
    var key = NONUM_PREFIX + new Date().getTime();
    try {
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      // v0.9.1390 — SWEEP ANY ABANDONED SCRATCH NOTE FIRST.
      //
      // Caught walking a real two-photo group: cancelling cleared the note the
      // wizard was tracking and left an EARLIER one behind, holding both photo
      // ids forever. _doCloseWizard can only drop the key it was handed, so a
      // second press of this button (a double-tap, a re-render, a mis-click)
      // orphans the first note with nothing left pointing at it.
      //
      // Only one numberless add can be in flight at a time, so any scratch key
      // sitting here now is by definition abandoned. Harmless to the photos —
      // they never left the inbox — but the crumbs pile up invisibly and each
      // one keeps a stale list of Drive ids.
      Object.keys(stage).forEach(function (k0) {
        if (k0.indexOf(NONUM_PREFIX) === 0) delete stage[k0];
      });
      stage[key] = _pinHoldMark({ link: '', fromFid: '', toFid: '', ts: new Date().getTime(),
                     rsvFid: (fileList[0] && fileList[0].id) || '',
                     files: fileList.map(function (fl) { return { id: fl.id, name: fl.name, role: (fl._meta && fl._meta.role) || '' }; }) });   // v0.9.1562: role rides along; v0.9.2053: which opening holds it
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (eS) { console.warn('[Inbox] could not stage the numberless add', eS && eS.message); }

    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    PIN._sel = {};
    openWizard('collection');
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = (typeof wizard !== 'undefined') && wizard && wizard.steps && wizard.data
                  && document.getElementById('wizard-modal');
      if (ready) {
        clearInterval(t);
        try {
          // _fromInbox is what puts the Item Type selector on screen.
          // _pinStagedNum is re-keyed to the generated number by the ephemera
          // save (wizard-save.js) and survives a type change (_wizSetKind).
          // itemNum is deliberately NOT set: there is no number, and writing
          // the staging key into it would put "__nonum__…" on the sheet.
          wizard.data._fromInbox = true;
          wizard.data._pinStagedNum = key;
          wizard.data._noNumberEntry = true;
          wizard.data._returnPage = 'photo-inbox';
          var _hero = (fileList[0] && fileList[0].id) || '';
          if (_hero) wizard.data._addPhotoDriveId = _hero;
          var _all = fileList.map(function (fl) { return (fl && fl.id) || ''; }).filter(Boolean);
          if (_all.length) wizard.data._addPhotoDriveIds = _all;
          try {   // v0.9.1433: view stamps ride along here too
            var _vm2 = {};
            fileList.forEach(function (fl) { if (fl && fl.id) { var _v2 = _pinMetaOf(fl).view; if (_v2) _vm2[fl.id] = _v2; } });
            if (Object.keys(_vm2).length) wizard.data._addPhotoViews = _vm2;
          } catch (eVm2) {}
          if (typeof renderWizardStep === 'function') renderWizardStep();
          showToast('Pick what it is from Item Type at the top — paper, catalog, mock-up or other. '
            + fileList.length + ' photo' + (fileList.length > 1 ? 's' : '')
            + ' will attach when you save.', 5500);
        } catch (eW) { console.error('[Inbox] numberless add:', eW); }
      }
      if (tries > 60) clearInterval(t);
    }, 100);
  };

  // An add from the inbox that is CANCELLED must not leave its staging note behind.
  // Called from _doCloseWizard when the Add screen closes WITHOUT a save.
  // v0.9.1387: a "__nonum__…" key can never match anything — always dropped.
  // v0.9.2050 (Mike, 2026-10-29: "Photos get uploaded but I get message that the
  // app hasn't finished saving them"): a note keyed by a REAL number used to be
  // kept on purpose ("it arms itself if that number is ever added"), and that is
  // what held his photos for a week — every retry said "Photos already spoken
  // for … an add … that has not finished saving" when nothing was saving. Now
  // that note goes too, but ONLY when its photos are this add's photos
  // (fileIds = wizard.data._addPhotoDriveIds), so another add's note is never
  // touched. STAGED notes only — an armed (PENDING_KEY) note belongs to a saved
  // item and is never dropped here. The photos themselves stay in the inbox.
  // ══ v0.9.2053 — WHICH OPENING OF THE APP HOLDS THESE PHOTOS ══════════════
  // Mike's audit, second half: an iPhone restarts a home-screen app after a
  // trip to the camera or another app, and an add in progress simply vanishes —
  // no close runs, so v0.9.2051's release never fires, and the photos stayed
  // "spoken for" for up to 30 minutes. Every hold now carries the opening of
  // the app that made it (`open`) and a "still here" mark (`beat`) that an
  // open Add screen keeps fresh. Leaving the page (the app switched away)
  // zeroes the mark at once; coming back refreshes it. A hold from ANOTHER
  // opening whose mark is zero or quiet past RR_ADD_HOLD_QUIET_MS is let go by
  // the sweep. A hold from this opening is never let go by this rule.
  var _PIN_OPEN_ID = (function () {
    try {
      if (!window._rrAppOpenId) window._rrAppOpenId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      return window._rrAppOpenId;
    } catch (e) { return 'open-' + Date.now(); }
  })();
  function _pinHoldMark(rec) {
    try { rec.open = _PIN_OPEN_ID; rec.beat = _rrNowMs(); } catch (e) {}
    return rec;
  }
  // Refresh (alive=true) or zero (alive=false) the mark on THIS opening's holds.
  function _pinHoldBeat(alive) {
    try {
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}'), dirty = false, now = _rrNowMs();
      Object.keys(stage).forEach(function (k) {
        _pendList(stage[k]).forEach(function (rec) {
          if (rec && typeof rec === 'object' && rec.open === _PIN_OPEN_ID) { rec.beat = alive ? now : 0; dirty = true; }
        });
      });
      if (dirty) localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) {}
  }
  try {
    var _beatMs = (typeof RR_ADD_HOLD_BEAT_MS === 'number') ? RR_ADD_HOLD_BEAT_MS : 60000;
    var _beatT = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      if (typeof _pinWizardOpen === 'function' && _pinWizardOpen()) _pinHoldBeat(true);
    }, _beatMs);
    if (_beatT && _beatT.unref) _beatT.unref();   // a test runner's clock: never what keeps it alive
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') _pinHoldBeat(false);
      else if (typeof _pinWizardOpen === 'function' && _pinWizardOpen()) _pinHoldBeat(true);
    });
    window.addEventListener('pagehide', function () { _pinHoldBeat(false); });
  } catch (eHB) {}
  // The safety net: a save makes sure its photos are still held before it
  // arms them. If a hold was let go while this Add screen was in fact still
  // alive (a computer tab left in the background while another tab opened the
  // inbox), it is written again here from the Add screen's own photo list — so
  // the photos ALWAYS follow a real save. Nothing happens when the hold is
  // there, or when those photos are already armed for a saved item.
  window.rrPinEnsureStaged = function (key, fileIds) {
    try {
      var k = String(key || '').trim();
      var ids = (fileIds || []).filter(Boolean);
      if (!k || !ids.length) return false;
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      var pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
      var holds = function (store) {
        return Object.keys(store).some(function (sk) {
          return _pendList(store[sk]).some(function (rec) { return rec && rec.files && rec.files.some(function (f) { return f && ids.indexOf(f.id) >= 0; }); });
        });
      };
      if (holds(stage) || holds(pend)) return false;
      var known = {};
      try { (PIN._groups || []).forEach(function (g) { (g.files || []).forEach(function (f) { if (f && f.id) known[f.id] = f; }); }); } catch (eK) {}
      stage[k] = _pinHoldMark({ link: '', fromFid: '', toFid: '', ts: _rrNowMs(), rsvFid: ids[0],
        files: ids.map(function (id) { var f = known[id] || {}; return { id: id, name: f.name || '', role: (f._meta && f._meta.role) || '' }; }) });
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
      console.log('[Inbox] a saved add’s photo hold was missing — written again so its photos follow the save:', k);
      return true;
    } catch (e) { console.warn('[Inbox] could not re-make the photo hold', e && e.message); return false; }
  };
  // A cancelled SET add lets go of ITS holds — every staged note made only of
  // this set's photos. With alsoArmed (the set was cancelled AND its saved
  // members deleted), armed notes for those photos that have not moved yet go
  // too: their items no longer exist, so nothing will ever file them.
  window.rrPinReleaseSetHolds = function (fileIds, alsoArmed) {
    try {
      var ids = {}; (fileIds || []).forEach(function (id) { if (id) ids[id] = 1; });
      if (!Object.keys(ids).length) return 0;
      var gone = 0;
      [SETSTAGE_KEY].concat(alsoArmed ? [PENDING_KEY] : []).forEach(function (storeKey) {
        var store = JSON.parse(localStorage.getItem(storeKey) || '{}'), dirty = false;
        Object.keys(store).forEach(function (k) {
          var notes = _pendList(store[k]);
          var kept = notes.filter(function (rec) {
            var mine = rec && rec.files && rec.files.length && rec.files.every(function (f) { return f && ids[f.id]; });
            if (mine && storeKey === PENDING_KEY && rec.moved) mine = false;   // already filed — nothing to undo here
            if (mine) { gone++; dirty = true; }
            return !mine;
          });
          if (!kept.length) delete store[k];
          else if (kept.length !== notes.length) store[k] = (kept.length === 1 && !Array.isArray(store[k])) ? kept[0] : kept;
        });
        if (dirty) localStorage.setItem(storeKey, JSON.stringify(store));
      });
      return gone;
    } catch (e) { console.warn('[Inbox] could not release the set’s photo holds', e && e.message); return 0; }
  };
  window.rrPinDropStaged = function (key, fileIds) {
    try {
      var k = String(key || '');
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      if (!(k in stage)) return;
      if (k.indexOf(NONUM_PREFIX) !== 0) {
        var ids = {}; (fileIds || []).forEach(function (id) { if (id) ids[id] = 1; });
        var notes = (typeof _pendList === 'function') ? _pendList(stage[k]) : [stage[k]];
        var mine = notes.some(function (rec) {
          return rec && rec.files && rec.files.some(function (f) { return f && ids[f.id]; });
        });
        if (!mine) return;                          // not this add's photos — leave it
      }
      delete stage[k];
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not drop the staged note', e && e.message); }
  };

  // v0.9.2053 (Mike's audit, fix 7): is the full catalog still on its way to
  // this phone? rrCatalogIndexStatus (app-data.js) is the one honest answer.
  function _pinCatalogStillLoading() {
    try {
      var st = (typeof rrCatalogIndexStatus === 'function') ? rrCatalogIndexStatus() : null;
      return !!(st && !st.complete);
    } catch (e) { return false; }
  }
  // Wait for it (starting a build if none is running), then call back(true);
  // after RR_CATALOG_WAIT_MS, call back(false). Says what it is doing.
  function _pinWaitForCatalog(num, back) {
    var limit = (typeof RR_CATALOG_WAIT_MS === 'number') ? RR_CATALOG_WAIT_MS : 20000;
    var t0 = _rrNowMs(), finished = false;
    try {
      var st0 = rrCatalogIndexStatus();
      if (!st0.building && typeof _scheduleLookupIndex === 'function') _scheduleLookupIndex(0);
    } catch (eB) {}
    try { showToast((typeof RR_CATALOG_WAIT_TEXT !== 'undefined') ? RR_CATALOG_WAIT_TEXT.waiting : 'Looking it up in the catalog\u2026', limit); } catch (eT) {}
    var poll = setInterval(function () {
      if (finished) return;
      var done = !_pinCatalogStillLoading();
      if (done || (_rrNowMs() - t0) > limit) { finished = true; clearInterval(poll); back(done); }
    }, 400);
  }
  window._pinAddNow = function (num, aiMeta, photoDriveId, opts) {
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    // v0.9.1491: the stopwatch — one line per stage in the console, so a
    // still-slow add tells us exactly WHERE without another guessing round.
    var _T0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    var _tm = function (l) { try { if (_T0) console.log('[inbox-add] ' + l + ' +' + Math.round(performance.now() - _T0) + 'ms'); } catch (e) {} };
    openWizard('collection');
    _tm('openWizard returned');
    // v0.9.889 (Brad): pre-fill the ENTIRE catalog side of the add, the same
    // way a successful barcode scan does — lock the matched catalog item,
    // adopt its era, and jump past the item-number step. Only the personal
    // questions (condition, price, photos) remain for the user.
    var tries = 0;
    // v0.9.1491: the ready-poll ticked every 250ms — up to a quarter second
    // of pure waiting per stage. 50ms now, same 5s total budget.
    var t = setInterval(function () {
      tries++;
      var ready = (typeof wizard !== 'undefined') && wizard && wizard.steps && wizard.data && document.getElementById('wizard-modal');
      if (ready) {
        clearInterval(t);
        _tm('wizard ready');
        try {
          wizard.data.itemNum = num;
          // v0.9.1278 (Brad's framed Southern poster): an add that starts in
          // the inbox is not always a train. These two flags are what let the
          // Item Type selector appear and the staged photos follow the entry
          // whatever kind it turns out to be.
          wizard.data._fromInbox = true;
          wizard.data._pinStagedNum = num;
          // v0.9.958 (Brad): "Send to For Sale" on a not-yet-owned item — flag
          // the add so it lands in My Collection AND on the For Sale list.
          if (opts && opts.alsoListForSale) { wizard.data._alsoListForSale = true; wizard.data._returnPage = wizard.data._returnPage || 'forsale'; }
          // v0.9.1062 (Brad): "when you hit add an item and then hit cancel, it
          // kicks you back to the dashboard and not back to the photo inbox."
          // openWizard infers where to return from window._rrLastPage, which is
          // whatever page was last shown — and the review card is a MODAL over
          // the inbox, so whether that inference lands on 'photo-inbox' depends
          // on how the user got here. Inference is the wrong tool when the
          // answer is known: an add started from the inbox returns to the
          // inbox, stated outright. (For Sale keeps its own destination.)
          else wizard.data._returnPage = 'photo-inbox';
          // v0.9.907 (Brad, item [1a]): stash the inbox photo's Drive id so the
          // variation step can preview it (loaded via loadDriveThumb).
          if (photoDriveId) wizard.data._addPhotoDriveId = photoDriveId;
          // v0.9.1369 — and the rest of the group's photos, in the order they
          // were shot, so the viewer can flip between them. The hero above
          // stays whatever it was; this list only ever ADDS what to look at.
          try {
            var _pl = (opts && opts.photoIds) || [];
            if (!_pl.length && photoDriveId) _pl = [photoDriveId];
            if (_pl.length) wizard.data._addPhotoDriveIds = _pl;
            // v0.9.1433: each photo's view stamp rides along, so the wizard
            // files Right Side into Right Side instead of dealing by order.
            var _vm = {};
            PIN._groups.forEach(function (g) { g.files.forEach(function (f) {
              if (_pl.indexOf(f.id) >= 0) { var _v = _pinMetaOf(f).view; if (_v) _vm[f.id] = _v; }
            }); });
            if (Object.keys(_vm).length) wizard.data._addPhotoViews = _vm;
            // v0.9.1440 (Brad's 2344 AA): the ROLE he chose when grouping —
            // powered / dummy / both together — decides WHICH STEP a photo
            // belongs to. The wizard builds one photo step per unit and they
            // line up exactly with these roles; without the map all three
            // photos fell into the first step by queue order and the dummy
            // unit's picture became the powered unit's "Back" view.
            var _rm = {};
            PIN._groups.forEach(function (g) { g.files.forEach(function (f) {
              if (_pl.indexOf(f.id) >= 0) { var _r = _pinMetaOf(f).role; if (_r) _rm[f.id] = _r; }
            }); });
            if (Object.keys(_rm).length) wizard.data._addPhotoRoles = _rm;
            if (opts && opts.groupKind) wizard.data._addPhotoKind = String(opts.groupKind);
          } catch (ePl) {}
          // v0.9.1279 (Brad): a group marked "Paper / other collectible" skips
          // the train prefill entirely — the add opens in the paper flow, where
          // the Item Type selector still allows Catalog / Mock-Up / Other. The
          // flags above ride along (wizardChooseCategory keeps wizard.data), so
          // the staged photos attach on save exactly as v0.9.1278 arranged.
          if (opts && opts.groupKind === 'paper' && typeof wizardChooseCategory === 'function') {
            wizardChooseCategory('paper');
            showToast('Starting a paper/other item — the photos will attach when you save', 3000);
            return;
          }
          // v0.9.2053: the catalog side of the prefill, as one step that can run
          // again once a still-loading catalog arrives (waited = 'loaded' /
          // 'gaveUp'; false the first time).
          var _resolve = function (waited) {
            if (waited && !(_pinWizardOpen() && wizard && wizard.data && wizard.data._pinStagedNum === num)) return;   // closed meanwhile
            var m = _pinBestMaster(num, (aiMeta && aiMeta.manufacturer) || '', (aiMeta && aiMeta._prefer) || null);
            // v0.9.1371 — remember WHY there is no match. A brand disagreement
            // (v0.9.941, Marx 1303 vs Atlas 1303) is a deliberate "make a manual
            // entry for the real brand" and must keep working; only a genuinely
            // EMPTY catalogue lookup earns the dashed-relative widening below.
            var _mfrSuppressed = false;
            if (m && aiMeta && aiMeta.manufacturer) {
              var _mMk = m.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era].manufacturer : '');
              // v0.9.941: photo says one brand, number matches another -> treat as
              // no catalog match so the wizard makes a manual entry for the REAL
              // brand instead of silently adopting the wrong item (Marx 1303 vs
              // Atlas 1303).
              if (!_pinMfrAgree(aiMeta.manufacturer, _mMk)) { m = null; _mfrSuppressed = true; }
            }
            if (m) {
              wizard.matchedItem = m;
              if (m._era) wizard.data._era = m._era;
              // v0.9.1341: carry the inbox's own answer into the wizard. AFTER
              // the match, because a grouping resolves the B unit and the dummy
              // from the item number and the catalog. Through the SAME resolver
              // the grouping buttons use (rrApplyGroupingChoice) — reproducing
              // its fields here would have missed the engine-row lock, which is
              // the number-only first-find shape all over again.
              //
              // Deliberately does NOT advance past the grouping step. The tag
              // could be wrong, and a pre-filled answer he can see and change
              // beats a silent one he cannot.
              var _pg = _pinGroupingFor(opts && opts.groupKind);
              if (_pg && typeof rrApplyGroupingChoice === 'function') {
                try {
                  if (rrApplyGroupingChoice(_pg)) {
                    wizard.data._pinGroupingFromInbox = _pg;
                    if (typeof getSteps === 'function' && wizard.tab) wizard.steps = getSteps(wizard.tab);
                  }
                } catch (ePg) { console.warn('[Inbox] grouping prefill:', ePg); }
              }
              wizard.step++;              // same advance a barcode scan does
              renderWizardStep();
              _tm('prefilled + rendered');
              try { requestAnimationFrame(function () { setTimeout(function () { _tm('settled — paint done'); }, 0); }); } catch (eTm) {}
              showToast(_pg
                ? '\u2713 ' + num + ' \u2014 catalog details filled in, and it is already set up as ' + _pinKindLabel(opts.groupKind)
                : '\u2713 ' + num + ' \u2014 catalog details filled in', _pg ? 4000 : 2500);
            } else if (!waited && !_mfrSuppressed && _pinCatalogStillLoading()) {
              // v0.9.2053 (Mike's audit): no match AND the full catalog is still
              // loading on this phone — "isn't in the catalog" would be a guess
              // dressed as a fact (rrCatalogIndexStatus's own warning). Wait for
              // it, then match as normal; give up after RR_CATALOG_WAIT_MS.
              _pinWaitForCatalog(num, function (loaded) { try { _resolve(loaded ? 'loaded' : 'gaveUp'); } catch (eW) { console.warn('[Inbox] wizard prefill after the catalog wait:', eW); } });
            } else if (!_mfrSuppressed && _pinDashedKin(num).length) {
              // v0.9.1371 — the catalogue DOES know this number, as a family of
              // dashed relatives. Saying "isn't in the catalog" here was simply
              // false, and it threw away fourteen real rows. Hand it to the
              // wizard the way typing the number by hand does: the item-number
              // step's partial matching already offers every relative, and Brad
              // picks the one he is holding. No guessing on his behalf.
              var _kin = _pinDashedKin(num);
              var _inpK = document.getElementById('wiz-input');
              if (_inpK) _inpK.value = num;
              try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (eK) {}
              var _shown = _kin.slice(0, 3).join(', ');
              showToast('There is no plain ' + num + ' — it is catalogued as ' + _shown
                + (_kin.length > 3 ? ' and ' + (_kin.length - 3) + ' more' : '')
                + '. Pick the one you have.', 6000);
            } else if (typeof _identifyRouteToManualEntry === 'function' && _identifyRouteToManualEntry(num, aiMeta || {}, [])) {
              showToast(waited === 'gaveUp' && typeof RR_CATALOG_WAIT_TEXT !== 'undefined'
                ? RR_CATALOG_WAIT_TEXT.gaveUp.split('{num}').join(num)
                : num + " isn't in the catalog — details from the photo are filled in", waited === 'gaveUp' ? 6000 : 3000);
            } else {
              // Last resort: behave like typing the number by hand.
              var inp = document.getElementById('wiz-input');
              if (inp) inp.value = num;
              try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (e) {}
            }
          };
          _resolve(false);
        } catch (e) { console.warn('[Inbox] wizard prefill:', e); }
      }
      if (tries > 100) clearInterval(t);
    }, 50);
  };

  // ── v0.9.1496: CONSOLE-ONLY maintenance (deliberately in no UI). Brad's
  // Session-78 one-time wipe cleared localStorage, but reads are ALSO
  // stamped on each photo's Drive file, and the PULL sync above re-seeded
  // every stamped number on the next load ("how does this have 6120?").
  // Run from DevTools:  _pinMaintWipeReads()
  // Clears local reads AND blanks the Drive num stamps; keeps tags, groups,
  // and wrong-marks. Refresh the inbox afterwards.
  // -- v0.9.1499 (Brad): after an attach, name each new photo's view -------
  // A card over the detail page: every just-filed photo with tappable view
  // buttons (the same RSV/LSV/... tokens the drag chips write, through the
  // same one-view-one-photo committer). Tap works on the phone, where the
  // drag chips never did. "Skip" leaves a photo plain -- nothing is guessed,
  // nothing renamed until a button is pressed.
  window._pinPlaceViews = async function (recs, folderLink) {
    recs = (recs || []).filter(function (r) { return r && r.id; });
    if (!recs.length || !folderLink) return;
    var old = document.getElementById('pin-place-ov'); if (old) old.remove();
    var views = (typeof ITEM_VIEWS !== 'undefined' ? ITEM_VIEWS : []);
    var ov = document.createElement('div');
    ov.id = 'pin-place-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:1rem';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;max-height:85vh;max-height:85dvh;overflow-y:auto;padding:1rem';
    card.innerHTML = '<div style="font-weight:700;color:var(--text);font-size:1rem;margin-bottom:0.2rem">Where does each photo go?</div>'
      + '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.7rem">Tap a view for each new photo, or Skip to leave it a plain photo.</div>';
    recs.forEach(function (rec) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.7rem;align-items:flex-start;border:1px solid var(--border);border-radius:10px;padding:0.55rem;margin-bottom:0.55rem';
      var im = document.createElement('img');
      im.className = 'rr-fit';   // v0.9.1807: whole picture
      im.style.cssText = 'width:96px;height:72px;border-radius:8px;background:var(--surface2);flex-shrink:0';
      try { loadDriveThumb(rec.id, im, row); } catch (eT) {}
      var right = document.createElement('div');
      right.style.cssText = 'flex:1;min-width:0';
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem';
      var done = document.createElement('div');
      done.style.cssText = 'display:none;font-size:0.85rem;font-weight:700;color:var(--t-green);padding:0.3rem 0';
      function mk(label, key) {
        var b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'padding:0.45rem 0.6rem;border-radius:999px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.78rem;font-weight:700;cursor:pointer';
        b.onclick = async function () {
          btns.querySelectorAll('button').forEach(function (x) { x.disabled = true; x.style.opacity = '0.5'; });
          if (key !== null) {
            try {
              var photos = (await driveGetFolderPhotos(folderLink)) || [];
              if (typeof _rrGalCommitView === 'function' && photos.length) {
                await _rrGalCommitView(photos, rec.id, key, function () {});
              }
            } catch (eV) {
              console.warn('[Inbox] view rename failed:', eV);
              btns.querySelectorAll('button').forEach(function (x) { x.disabled = false; x.style.opacity = ''; });
              return;
            }
          }
          btns.style.display = 'none';
          done.textContent = (key === null) ? 'Left as a plain photo' : '\u2713 ' + label;
          done.style.display = 'block';
        };
        return b;
      }
      views.forEach(function (v) { btns.appendChild(mk(v.label, v.key)); });
      btns.appendChild(mk('Plain photo', ''));
      btns.appendChild(mk('Skip', null));
      right.appendChild(btns); right.appendChild(done);
      row.appendChild(im); row.appendChild(right);
      card.appendChild(row);
    });
    var doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.className = 'btn-primary';
    doneBtn.style.cssText = 'width:100%;padding:0.7rem;border-radius:10px;border:none;font-weight:700;font-size:0.92rem;cursor:pointer';
    doneBtn.onclick = function () {
      ov.remove();
      if (typeof rrDetailRepaint === 'function') rrDetailRepaint(150);   // v0.9.1765: by identity, not by remembered position
    };
    card.appendChild(doneBtn);
    ov.appendChild(card);
    document.body.appendChild(ov);
  };

  // -- v0.9.1499: the repair for the shared-folder years --------------------
  // Owned copies of the same number whose photo links point at the SAME Drive
  // folder have been showing each other's photos (the 6473/6414 discovery).
  // This sorts what can be PROVEN: a photo whose filename carries the
  // "ID<inventoryId>" stamp the wizard has always written belongs to that
  // copy and moves into that copy's own subfolder; each copy that received
  // photos gets its link repointed. Anything without a stamp stays put and is
  // listed -- re-file those by hand with the gallery's send-back button.
  //   rrMaintSplitCopyFolders()      -- dry run, writes nothing
  //   rrMaintSplitCopyFolders(true)  -- do it
  window.rrMaintSplitCopyFolders = async function (apply) {
    if (!window.state || !state.personalData) { console.log('Not loaded yet \u2014 open the app first.'); return; }
    var byNum = {};
    Object.values(state.personalData).forEach(function (p) {
      if (p && p.owned && p.itemNum) (byNum[String(p.itemNum)] = byNum[String(p.itemNum)] || []).push(p);
    });
    var out = { sharedFolders: 0, photosMoved: 0, linksFixed: 0, leftAlone: [], errors: [] };
    var nums = Object.keys(byNum);
    for (var i = 0; i < nums.length; i++) {
      var num = nums[i], rows = byNum[num];
      if (rows.length < 2) continue;
      var byFid = {};
      rows.forEach(function (p) {
        var f = (String(p.photoItem || '').match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1] || '';
        if (f && f !== 'undefined') (byFid[f] = byFid[f] || []).push(p);
      });
      var fids = Object.keys(byFid);
      for (var j = 0; j < fids.length; j++) {
        var fid = fids[j], sharers = byFid[fid];
        if (sharers.length < 2) continue;
        out.sharedFolders++;
        var photos = [];
        try { photos = (await driveGetFolderPhotos(driveFolderLink(fid))) || []; }
        catch (eL) { out.errors.push(num + ': could not list the shared folder'); continue; }
        var gained = {};   // inventoryId -> subfolder id (or placeholder in dry run)
        for (var k = 0; k < photos.length; k++) {
          var ph = photos[k];
          var m = String(ph.name || '').match(/\bID(\d+)\b/);
          if (!m) { out.leftAlone.push(num + ' \u2014 ' + ph.name); continue; }
          var owner = null;
          for (var r0 = 0; r0 < rows.length; r0++) if (String(rows[r0].inventoryId) === m[1]) { owner = rows[r0]; break; }
          if (!owner) { out.leftAlone.push(num + ' \u2014 ' + ph.name + ' (no copy has ID ' + m[1] + ')'); continue; }
          try {
            if (apply) {
              if (!gained[m[1]] || gained[m[1]] === 'would-create')
                gained[m[1]] = await driveFindOrCreateFolder(String(owner.inventoryId), fid);
              await driveMoveFileToFolder(ph.id, fid, gained[m[1]]);
            } else gained[m[1]] = gained[m[1]] || 'would-create';
            out.photosMoved++;
          } catch (eM) { out.errors.push(num + ' \u2014 ' + ph.name + ': move failed'); }
        }
        var invs = Object.keys(gained);
        for (var g = 0; g < invs.length; g++) {
          var pd2 = null;
          for (var r1 = 0; r1 < rows.length; r1++) if (String(rows[r1].inventoryId) === invs[g]) { pd2 = rows[r1]; break; }
          if (!pd2) continue;
          if (!apply) { out.linksFixed++; continue; }
          if (gained[invs[g]] === 'would-create') continue;
          try {
            var newLink = driveFolderLink(gained[invs[g]]);
            var rowOk = pd2.row && Number(pd2.row) !== 99999;
            if (rowOk && await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd2.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd2.row, [[newLink]], { num: pd2.itemNum || '', invId: pd2.inventoryId || '' }, 'collection')) {
              pd2.photoItem = newLink;
              out.linksFixed++;
              try { if (typeof rrThumbBust === 'function') rrThumbBust(pd2); } catch (eTB) {}
            } else out.errors.push(num + ' inv ' + pd2.inventoryId + ': link write refused \u2014 sync and re-run');
          } catch (eW) { out.errors.push(num + ' inv ' + pd2.inventoryId + ': link write failed'); }
        }
      }
    }
    try { if (apply && typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (eC) {}
    console.log(apply ? 'DONE.' : 'DRY RUN \u2014 nothing written. Run rrMaintSplitCopyFolders(true) to apply.');
    console.log('Shared folders found: ' + out.sharedFolders
      + '\nPhotos ' + (apply ? 'moved' : 'that would move') + ': ' + out.photosMoved
      + '\nLinks ' + (apply ? 'repointed' : 'that would repoint') + ': ' + out.linksFixed
      + '\nLeft for you to re-file (no ID stamp): ' + out.leftAlone.length
      + (out.errors.length ? '\nErrors: ' + out.errors.length : ''));
    if (out.leftAlone.length) console.log('Unstamped photos, staying put:\n' + out.leftAlone.join('\n'));
    if (out.errors.length) console.log('Errors:\n' + out.errors.join('\n'));
    return out;
  };

  window._pinMaintWipeReads = async function () {
    try {
      // v0.9.1497 (Brad ran it at boot, before the inbox had loaded — it
      // scanned an EMPTY photo list, reported "blanking 0 Drive stamps",
      // and the stamps re-seeded everything again): refuse to run until
      // the photo list is actually loaded.
      if (!PIN._groups || !PIN._groups.length) {
        console.log('[wipe] the photo list is not loaded yet — open the Photo Inbox page, wait for the grid to appear, THEN run _pinMaintWipeReads() again. Nothing was changed.');
        return;
      }
      var ids = _ids(); var kept = 0, total = 0;
      Object.keys(ids).forEach(function (id) {
        total++;
        var rej = ids[id] && Array.isArray(ids[id].rejected) ? ids[id].rejected : null;
        if (rej && rej.length) { ids[id] = { rejected: rej }; kept++; }
        else delete ids[id];
      });
      _idsSave(ids);
      var files = [];
      (PIN._groups || []).forEach(function (g) { (g.files || []).forEach(function (f) {
        try { var m = f && (f._meta || _pinMetaOf(f)); if (m && m.num) files.push(f.id); } catch (e) {}
      }); });
      console.log('[wipe] local reads cleared on ' + total + ' (wrong-marks kept on ' + kept + '); blanking ' + files.length + ' Drive stamps\u2026');
      for (var i = 0; i < files.length; i += 4) {
        var slice = files.slice(i, i + 4);
        try { await Promise.all(slice.map(function (id) { return _pinMetaSet(id, { num: '', conf: '' }); })); } catch (e) {}
        console.log('[wipe] ' + Math.min(i + 4, files.length) + ' / ' + files.length);
      }
      console.log('[wipe] done \u2014 hit Refresh in the Photo Inbox.');
    } catch (e) { console.error('[wipe] failed:', e); }
  };

  // v0.9.1122 — arm ONE staged set-photo note. Called from the set-save hook
  // the instant a member is really written to the sheet, so the photo move is
  // driven by a save that happened, never by a save that merely might.
  // v0.9.1278: an inbox add can finish as a PAPER ITEM (or catalog, mock-up,
  // other). Those save under a GENERATED number, not the one typed on the
  // review card — so the staged photo note, keyed by the typed number, would
  // be stranded forever. The save re-keys it to the number the row actually
  // carries, then arms it, and the photos file exactly like a train add's.
  window.rrPinRekeyStaged = function (oldNum, newNum) {
    try {
      var o = String(oldNum || '').trim(), n = String(newNum || '').trim();
      if (!o || !n || o === n) return;
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      var key = Object.keys(stage).find(function (k) {
        return k === o || (typeof normalizeItemNum === 'function' &&
                           normalizeItemNum(k) === normalizeItemNum(o));
      });
      if (!key) return;
      if (!stage[n]) stage[n] = stage[key];   // never clobber another note
      delete stage[key];
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not re-key the staged photo note', e && e.message); }
  };

  // v0.9.1370 — ONE reader for "what is queued under this number?". Three
  // shapes have existed: a plain link string (pre-1118), a single note object,
  // and now a list of note objects. Every caller comes through here so the
  // shape is decided in one place rather than sniffed at each use.
  function _pendList(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v.filter(function (x) { return x != null; }) : [v];
  }
  if (typeof window !== 'undefined') window._pendList = _pendList;

  window.rrPinSetPhotoSaved = function (itemNum) {
    try {
      var n = String(itemNum || '').trim();
      if (!n) return;
      var stage = JSON.parse(localStorage.getItem(SETSTAGE_KEY) || '{}');
      // v0.9.1560 — TIERED match. normalizeItemNum only strips a trailing
      // ".0"; it never bridged 2343P vs 2343-P, and it never bridged 2344
      // (the number read off the photo) against 2344-P (the number the row
      // actually saved under, suffixed at the last moment by _pdSuffix).
      // That silent miss is why grouped items had no photos: the arm found
      // no key, returned quietly, and the note was never flushed. Tiers run
      // most-precise first so a suffixed sibling can never steal a photo
      // that another key claims exactly:
      //   1. exact / normalized   (the original behavior, unchanged)
      //   2. dash-insensitive     (2343P == 2343-P)
      //   3. base number          (2344 == 2344-P) — last resort only.
      var _keys = Object.keys(stage);
      var _nrm  = function (x) { return (typeof normalizeItemNum === 'function') ? normalizeItemNum(x) : String(x); };
      var _dash = function (x) { return String(_nrm(x)).toUpperCase().replace(/-/g, ''); };
      // v0.9.1563 (Brad's 2356T-D): a set's third unit can save with a
      // STACKED suffix — 2356T-D — and baseItemNum strips only ONE layer,
      // so its base ('2356T') never met the staged key's base ('2356') and
      // the dummy's photo sat staged forever. The last-resort tier now
      // strips EVERY trailing P/D/T/C, but only when the number contains a
      // digit — letter-only numbers (LTC, ZW) must never be shaved.
      var _base = function (x) {
        var s = _dash(x);
        return /\d/.test(s) ? s.replace(/[PDTC]+$/, '') : s;
      };
      var key = _keys.find(function (k) { return k === n || _nrm(k) === _nrm(n); })
             || _keys.find(function (k) { return _dash(k) === _dash(n); })
             || _keys.find(function (k) { return _base(k) === _base(n); });
      if (!key) return;                                  // nothing staged for this member
      var pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
      // ── v0.9.1370 (Brad's two 3362s) ──────────────────────────────────
      // This used to read `if (!pend[n]) pend[n] = stage[key];` — one note
      // per item NUMBER, and it REFUSED to file a second one. Then it deleted
      // the staged copy regardless, so the second copy's photos were dropped
      // on the floor: nothing anywhere would ever move them, and they sat in
      // the inbox looking like they had been ignored. Brad added two 3362s
      // and the second one's photos never left.
      //
      // You can own several of the same number — the app has said so since
      // v0.9.966 — so a queue keyed by number was always going to lose one.
      // It is a LIST now, one note per copy, filed in the order they were
      // saved. Old entries (a bare object, or a plain link string from before
      // v0.9.1118) are read as a one-item list, so nothing already queued on
      // anyone's machine is lost.
      // ── v0.9.1562 (Brad: "it should automatically put them in the right
      // order") — UNIT-ROLE SPLIT. An AA/AB/ABA group's photos all read the
      // SAME base number, so one staged note holds the powered A, the B unit,
      // the dummy A and the set shot together. Arming used to hand the WHOLE
      // note to whichever member saved first. When the saved number carries a
      // unit suffix (-P / C / -T / -D) and the note's files carry unit roles,
      // each member now takes ONLY its own photos:
      //   P   ← aunit_p / p / engine, plus the set shot, pair shots, details
      //         and anything unroled (the lead carries the group's context)
      //   C   ← bunit / b
      //   T/D ← aunit_d / d
      // Each member's own unit photo becomes its Right Side View (rsvFid).
      // Files left over stay STAGED for the members still to save. A note
      // with no unit roles, or a save with no suffix, behaves exactly as
      // before — one note, one member.
      var _note = stage[key];
      var _sufL = (function (x) {
        var s = String(x || '').toUpperCase().replace(/-/g, '');
        var L = s.slice(-1);
        return 'PDTC'.indexOf(L) >= 0 ? L : '';
      })(n);
      var _hasUnitRoles = !!(_note && _note.files && _note.files.some && _note.files.some(function (f) {
        return /^(aunit_p|aunit_d|bunit|p|d|b)$/.test(String((f && f.role) || ''));
      }));
      if (_sufL && _hasUnitRoles) {
        var _mine = function (r) {
          r = String(r || '');
          if (_sufL === 'P') return /^(aunit_p|p|engine)$/.test(r) || r === 'together' || r === 'detail' || r === '' || r.indexOf('pair_') === 0;
          if (_sufL === 'C') return /^(bunit|b)$/.test(r);
          return /^(aunit_d|d)$/.test(r);              // T and D both mean the dummy A
        };
        var _take = _note.files.filter(function (f) { return _mine(f.role); });
        var _keep = _note.files.filter(function (f) { return !_mine(f.role); });
        if (!_take.length) return;                     // nothing of mine staged — leave the note for its member
        var _unitShot = _take.filter(function (f) { return /^(aunit_p|aunit_d|bunit|p|d|b|engine)$/.test(String(f.role || '')); })[0];
        var _sub = { link: '', fromFid: _note.fromFid || '', toFid: '', ts: _note.ts || new Date().getTime(),
                     rsvFid: (_unitShot && _unitShot.id) || (_take[0] && _take[0].id) || '',
                     files: _take };
        pend[n] = _pendList(pend[n]).concat([_sub]);
        if (_keep.length) {
          _note.files = _keep;
          if (_note.rsvFid && !_keep.some(function (f) { return f.id === _note.rsvFid; })) _note.rsvFid = _keep[0].id;
          stage[key] = _note;
        } else delete stage[key];
        localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
        localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
        return;
      }
      pend[n] = _pendList(pend[n]).concat([stage[key]]);
      delete stage[key];                                 // armed once — a repeat car reuses the same folder
      localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
      localStorage.setItem(SETSTAGE_KEY, JSON.stringify(stage));
    } catch (e) { console.warn('[Inbox] could not arm the set photo note', e && e.message); }
  };

  // When an item is actually saved, file any pending inbox photos into its
  // Drive folder and connect the photo link. Runs on every dashboard build but
  // only acts on items that now exist in the collection, so a cancelled add
  // leaves its photos untouched in the inbox. (Session 168, Brad)
  var _flushingNums = {};
  // v0.9.1602 (show mode, build 2): the pending-note pipeline was ALREADY
  // offline-tolerant by design — notes are localStorage, armed at save time
  // (a local act), and this flusher retries on every dashboard build for up
  // to a week. What was missing: a kick the moment the connection returns,
  // so photos filed offline move the minute they can instead of waiting for
  // the next dashboard visit. Exposed for the append-drain chain too.
  // v0.9.1782. A note whose add never finished used to keep its photos greyed
  // out and badged FOREVER if it was a STAGED one: the week-long retirement
  // below lives inside the pending loop and only ever looked at PENDING_KEY.
  // A set-add begun and abandoned writes to SETSTAGE_KEY, which nothing
  // retired at all. That is how Brad ended up asking why two photos had been
  // waiting eight days.
  //
  // Two rules, both applied to BOTH stores:
  //   · older than a week -> retire the note; the PHOTOS always stay.
  //   · no timestamp at all -> stamp it NOW so the clock starts. The old code
  //     admitted an undefined ts "meant the note could never retire" and only
  //     fixed the writing side, so notes written before that are immortal.
  //     Starting their clock is what makes the expiry actually reachable.
  //
  // It runs BEFORE the early return below on purpose. With no pending notes
  // that return fires first, and abandoned STAGING — the exact case here —
  // would never be swept.
  // v0.9.2050 (Mike): a STAGED note belongs to an Add screen that is open right
  // now — a save arms it (moves it to PENDING_KEY) before the screen closes. So
  // a staged note older than this, with no Add screen open in this tab, is an
  // add that was abandoned (closed before this release, or the app was closed
  // mid-add): its hold on the photos is released at once instead of after a
  // week. 30 minutes leaves a wide margin for an add left open in another tab.
  var RR_STAGED_ABANDON_MS = 30 * 60 * 1000;
  function _pinWizardOpen() {
    try { var m = document.getElementById('wizard-modal'); return !!(m && m.classList.contains('open')); } catch (e) { return false; }
  }
  function _pinSweepStaleClaims() {
    var now = _rrNowMs(), WEEK = 604800000;
    // typeof guards: the claim tests run this function on its own; without the
    // helpers it behaves as before (an Add screen counts as open — nothing extra released)
    var wizOpen = (typeof _pinWizardOpen === 'function') ? _pinWizardOpen() : true;
    var abandonMs = (typeof RR_STAGED_ABANDON_MS === 'number') ? RR_STAGED_ABANDON_MS : WEEK;
    [SETSTAGE_KEY, PENDING_KEY].forEach(function (storeKey) {
      var store;
      try { store = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch (e) { return; }
      var dirty = false;
      Object.keys(store).forEach(function (num) {
        var notes = (typeof _pendList === 'function') ? _pendList(store[num]) : [store[num]];
        var kept = [];
        notes.forEach(function (rec) {
          if (!rec || typeof rec !== 'object') { kept.push(rec); return; }
          if (!rec.ts) { rec.ts = now; dirty = true; kept.push(rec); return; }
          if ((now - rec.ts) > WEEK) {
            dirty = true;
            console.log('[Inbox] released photos from a claim that never completed:', num,
                        '(photos stay in the inbox)');
            return;                                  // drop the NOTE, never the photos
          }
          // v0.9.2053: a hold from ANOTHER opening of the app whose "still
          // here" mark is zero (that page left) or quiet is an add the iPhone
          // restarted out from under him — let go now, not in 30 minutes.
          var _openId = (typeof _PIN_OPEN_ID !== 'undefined') ? _PIN_OPEN_ID : '';
          var _quiet = (typeof RR_ADD_HOLD_QUIET_MS === 'number') ? RR_ADD_HOLD_QUIET_MS : 180000;
          if (storeKey === SETSTAGE_KEY && rec.open && _openId && rec.open !== _openId
              && (!rec.beat || (now - rec.beat) > _quiet)) {
            dirty = true;
            console.log('[Inbox] released photos held by an add from an earlier opening of the app:', num,
                        '(photos stay in the inbox)');
            return;
          }
          if (storeKey === SETSTAGE_KEY && !wizOpen && (now - rec.ts) > abandonMs) {
            dirty = true;                            // v0.9.2050: an abandoned add's hold
            console.log('[Inbox] released photos held by an add that was never saved:', num,
                        '(photos stay in the inbox)');
            return;
          }
          kept.push(rec);
        });
        if (!kept.length) { delete store[num]; dirty = true; }
        else store[num] = (kept.length === 1 && !Array.isArray(store[num])) ? kept[0] : kept;
      });
      if (dirty) { try { localStorage.setItem(storeKey, JSON.stringify(store)); } catch (e) {} }
    });
  }

  async function _flushPending() {
    try { _pinSweepStaleClaims(); } catch (eSw) {}
    var pend;
    try { pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (e) { pend = {}; }
    var nums = Object.keys(pend);
    if (!nums.length || !window.state || !state.personalData) return;
    // v0.9.1623 (Brad's missing Recent-Additions thumbnail): the dashboard
    // paints BEFORE this background filing finishes, then never hears the
    // link landed — the row's thumb and the inbox card stayed stale until
    // the next visit. Track whether anything actually FILED this pass, and
    // repaint the dashboard once at the end (only on success: a retried
    // failure keeps the old quiet behavior, so no rebuild loop is possible
    // — a filed note is retired and cannot file twice).
    var _filedAny = false;
    for (var ni = 0; ni < nums.length; ni++) {
      var num = nums[ni];
      if (_flushingNums[num]) continue;
      // v0.9.1118 SAID the normalizer bridges 2343P vs 2343-P. IT NEVER DID —
      // normalizeItemNum only strips a trailing ".0". The real bridge is the
      // tiered match at ARM time (rrPinSetPhotoSaved, v0.9.1560), which stores
      // the pending note under the row's saved number, so the exact match
      // below is sufficient here.
      // v0.9.1130 (audit #4, second half): this took the FIRST owned row with a
      // matching number, which contradicts the design note above — you can own
      // several of the same number, so a new copy's photos could be filed onto
      // an older copy. Prefer the copy with no photo link yet (the one just
      // added), and among those the highest inventory id.
      var _cands = Object.values(state.personalData).filter(function (p) {
        if (!p || !p.owned || !p.itemNum) return false;
        if (String(p.itemNum) === num) return true;
        return (typeof normalizeItemNum === 'function') &&
               normalizeItemNum(String(p.itemNum)) === normalizeItemNum(num);
      });
      var _fresh = _cands.filter(function (p) { return !p.photoItem; });
      var _pick = (_fresh.length ? _fresh : _cands).sort(function (a, b) {
        return (parseInt(b.inventoryId) || 0) - (parseInt(a.inventoryId) || 0);
      });
      var pd = _pick[0];
      if (!pd) {
        // v0.9.1204: "item not saved yet" is the RIGHT call for a note minutes
        // old — the row is about to appear. But a note whose item never
        // arrived (a cancelled add, an item later removed) waited forever:
        // Brad's store still held entries keyed 905 and 2348 from set-adds
        // days earlier, re-examined on every dashboard build. A note gets a
        // generous week to find its row, then retires. Its photos stay safely
        // in the inbox either way — this expires the NOTE, never the photos.
        try {
          // v0.9.1370 — read the timestamp off the OLDEST queued note, not off
          // the key. With a list, `pend[num].ts` is undefined, and an
          // undefined timestamp meant the note could never retire.
          var _first = _pendList(pend[num])[0];
          var _ts = (_first && typeof _first === 'object' && _first.ts) || 0;
          if (_ts && (_rrNowMs() - _ts) > 604800000) {
            var _pe = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            delete _pe[num];
            localStorage.setItem(PENDING_KEY, JSON.stringify(_pe));
            console.log('[Inbox] retired a pending note whose item never arrived:', num, '(photos stay in the inbox)');
          }
        } catch (eEx) {}
        continue;   // item not saved yet -> leave its photos in the inbox
      }
      _flushingNums[num] = true;
      try {
        // v0.9.1370 — the queue holds one note per COPY. Take the oldest and
        // pair it with the row picked above (which prefers a copy that has no
        // photo link yet). The rest wait for the next dashboard build, by
        // which time this row HAS a photo link, so the next note lands on the
        // next copy instead of piling onto the same one.
        var rec = _pendList(pend[num])[0];
        if (!rec) { try { var _p0 = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); delete _p0[num]; localStorage.setItem(PENDING_KEY, JSON.stringify(_p0)); } catch (e0) {} continue; }
        // v0.9.1118: set-add notes are written without Drive folders (keeps
        // the button instant) — resolve them here, at move time. A failure
        // just leaves the note for the next dashboard build to retry.
        if (rec && typeof rec === 'object' && rec.files && rec.files.length && (!rec.fromFid || !rec.toFid)) {
          try {
            if (!rec.fromFid) rec.fromFid = await _folder();
            if (!rec.toFid) rec.toFid = await driveEnsureItemFolder(num);
            if (!rec.link) rec.link = driveFolderLink(rec.toFid);
          } catch (eF) { console.warn('[Inbox] pending folder resolve failed — will retry:', eF); continue; }
        }
        // -- v0.9.1499 (Brad's two 6473s, then the 6414 pair) ------------
        // The note's toFid was resolved by NUMBER (driveEnsureItemFolder), so
        // a second copy's photos filed into the folder every copy of that
        // number shares -- and both detail pages showed both copies' photos.
        // The row is picked ABOVE this line, so the destination can be the
        // ROW's: its own linked folder if it has one, else its own
        // inventory-id subfolder -- the "<itemNum>/<inventoryId>/" shape
        // every wizard upload has used since v0.9.1128. Skipped once the move
        // already happened (rec.moved): re-aiming a done move re-moves files.
        if (rec && typeof rec === 'object' && !rec.moved && rec.files && rec.files.length) {
          try {
            var _cpFid = (String(pd.photoItem || '').match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1] || '';
            if (_cpFid === 'undefined') _cpFid = '';
            if (_cpFid && pd.inventoryId && typeof driveFindOrCreateFolder === 'function'
                && _pinFolderShared(_cpFid, pd)) {
              // v0.9.1500: this copy's linked folder is shared with another
              // copy -- give it its own subfolder and repoint (write below).
              var _cpSub0 = await driveFindOrCreateFolder(String(pd.inventoryId), _cpFid);
              if (_cpSub0) { rec.toFid = _cpSub0; rec.link = driveFolderLink(_cpSub0); rec._retarget = true; }
            }
            else if (_cpFid) { rec.toFid = _cpFid; rec.link = String(pd.photoItem); }
            else if (pd.inventoryId && typeof driveFindOrCreateFolder === 'function') {
              var _cpBase = await driveEnsureItemFolder(num);
              var _cpSub = await driveFindOrCreateFolder(String(pd.inventoryId), _cpBase);
              if (_cpSub) { rec.toFid = _cpSub; rec.link = driveFolderLink(_cpSub); }
            }
          } catch (eCp) { console.warn('[Inbox] per-copy folder resolve failed \u2014 will retry:', eCp); continue; }
        }
        var link = (rec && typeof rec === 'object') ? rec.link : rec;  // back-compat: old entries were a plain link string
        // v0.9.1192: `rec.moved` records that the Drive move already happened,
        // so the retry introduced below re-tries ONLY the sheet write. Without
        // it, holding the note back would re-walk every file on every build.
        if (rec && typeof rec === 'object' && !rec.moved && rec.files && rec.files.length && rec.fromFid && rec.toFid) {
          var mv = 0;
          for (var fi = 0; fi < rec.files.length; fi++) {
            var file = rec.files[fi]; mv++;
            var ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
            try {
              await driveMoveFileToFolder(file.id, rec.fromFid, rec.toFid);
              // v0.9.935 (Brad): the photo shown in the wizard's RSV slot files as
              // the Right Side View, so detail pages/thumbnails treat it as primary.
              // v0.9.1565: the group's together-shot files with the lead as its
              // SET photo — the detail hero looks for the literal token ' SET '
              // (app-collection isSet()), and ' ADD ' made inbox-filed set
              // photos invisible to it. Role rides on the note since v1562.
              var _fRole = String((file && file.role) || '');
              var _vTag = (rec.rsvFid && file.id === rec.rsvFid) ? ' RSV '
                        : (_fRole === 'together' ? ' SET ' : ' ADD ');
              try { await driveRequest('PATCH', '/files/' + file.id, { name: num + _vTag + ((rec.ts || new Date().getTime()) + mv) + '.' + ext }); } catch (eRn) {}
            } catch (eMv) { console.warn('[Inbox] deferred photo move skipped (removed?):', file.id, eMv); }
          }
          // Remember the move survived, so a held-back note never repeats it.
          rec.moved = true;
          try {
            // v0.9.1370 — mark the note we are actually working on (the first
            // in this number's queue), not "the entry for this number".
            var _pm = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            var _pmL = _pendList(_pm[num]);
            if (_pmL.length && typeof _pmL[0] === 'object') {
              _pmL[0].moved = true; _pm[num] = _pmL;
              localStorage.setItem(PENDING_KEY, JSON.stringify(_pm));
            }
          } catch (ePM) {}
        }
        // ── v0.9.1192 (Brad: every item added today has no photo link) ──
        // A row that was just appended carries the PLACEHOLDER row 99999 until
        // a sheet sync fills the real one. 99999 is TRUTHY, so `if (pd.row …)`
        // passed and the write addressed S99999 → Sheets 400 "exceeds grid
        // limits" → swallowed by the catch → and the note below was deleted
        // regardless, so it never retried. The photos were already in Drive by
        // then, which is why thumbnails found them and the sheet stayed blank.
        // v0.9.1130 moved the arming to save time, which is when this began.
        // v0.9.695 fixed exactly this for ONE save path and named Brad's
        // abacus; sixteen other sites still hand out the sentinel.
        // A placeholder row is not a row. Hold the note and finish next build.
        var _rowKnown = pd.row && Number(pd.row) !== 99999;
        var _linkDone = true;
        var _wantLinkWrite = (!pd.photoItem && link)
          || (link && rec && typeof rec === 'object' && rec._retarget && String(pd.photoItem || '') !== String(link));
        if (_wantLinkWrite) {
          if (_rowKnown && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && state.personalSheetId) {
            try {
              if (await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[link]], { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection'))
                pd.photoItem = link;   // only true once the sheet actually took it
              else _linkDone = false;   // v0.9.1284: a refused row is a moved row — retry after the next sync
            } catch (eUp) { _linkDone = false; console.warn('[Inbox] pending link write failed — keeping the note to retry:', eUp); }
          } else {
            _linkDone = false;      // row unknown yet — retry once the sync lands
          }
        }
        // v0.9.1201: this item's photo set just changed (files moved in and/or
        // link written) — forget its cached first-photo id so lists and the
        // reel re-resolve instead of showing the old picture forever.
        try { if (typeof rrThumbBust === 'function') rrThumbBust(pd); } catch (eTB) {}
        // Retire the note ONLY when its work finished. Deleting unconditionally
        // is what turned a retryable miss into permanent, silent data loss.
        if (_linkDone) {
          // v0.9.1370 — retire ONLY the note just filed. Any further copies of
          // this number keep their place in the queue; deleting the whole key
          // is what threw Brad's second 3362 away.
          try {
            var p2 = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
            var l2 = _pendList(p2[num]);
            l2.shift();
            if (l2.length) p2[num] = l2; else delete p2[num];
            localStorage.setItem(PENDING_KEY, JSON.stringify(p2));
          } catch (eD) {}
        }
        try { _pinRefresh(); } catch (eR) {}
        if (_linkDone) _filedAny = true;
      } finally { delete _flushingNums[num]; }
    }
    if (_filedAny) {
      try {
        var _dp = document.getElementById('page-dashboard');
        if (_dp && _dp.classList.contains('active') && typeof buildDashboard === 'function') buildDashboard();
      } catch (eDB) {}
    }
  }

  // ── v0.9.1192: repair rows whose photos reached Drive but whose link was
  // lost to the row-99999 write (see PHOTO_LINK_REGRESSION.md). Brad's sheet
  // had 21 of 21 items added on 2026-07-30 in this state — pictures safe,
  // pointer gone, and the detail page reading that blank cell as "no photos".
  //
  // Find-only and deliberately timid: it never creates a Drive folder, only
  // walks rows that have a REAL row number and no link, stops after a small
  // batch per build so a large collection heals over a few visits instead of
  // firing hundreds of requests at once, and treats every failure as "try
  // again next time" rather than as a reason to give up.
  // v0.9.1204: `_repairRan` alone let OVERLAPPING dashboard builds each start
  // a pass (it clears in `finally`, so build B began while build A awaited),
  // re-writing links that were already written — idempotent, but wasted API
  // calls every time. A short cooldown makes a second build within the same
  // moment a no-op instead of a duplicate run.
  function _rrNowMs() { try { return Date.now(); } catch (e) { return 0; } }
  var _repairRan = false, _repairDone = {}, _repairLastAt = 0;
  async function _repairMissingPhotoLinks() {
    if (_repairRan) return;                       // a pass is already in flight
    if (_rrNowMs() - _repairLastAt < 20000) return;   // and not again within 20s of the last one
    if (!window.state || !state.personalData || !state.personalSheetId) return;
    if (typeof driveFindItemFolder !== 'function' || typeof sheetsUpdate !== 'function'
        || typeof personalColLetter !== 'function') return;
    _repairRan = true; _repairLastAt = _rrNowMs();
    try {
      // v0.9.1624 (Brad's 238): this repair once FRONT-RAN the deferred
      // filing — it stamped the SHARED number-folder onto a fresh row while
      // the flush was about to file the photos into the copy's own
      // subfolder, so the page showed his OLD engine's pictures. A row with
      // a queued filing note is the flush's business, not ours.
      var _pendNums = {};
      try { _pendNums = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (ePN) {}
      var targets = Object.values(state.personalData).filter(function (p) {
        return p && p.owned && p.itemNum && !p.photoItem
            && p.row && Number(p.row) !== 99999          // a placeholder is not a row
            && !Object.prototype.hasOwnProperty.call(_pendNums, String(p.itemNum))
            && !_repairDone[String(p.inventoryId || p.itemNum)];
      }).slice(0, 12);                            // small batch; the rest heal next build
      for (var i = 0; i < targets.length; i++) {
        var p = targets[i], k = String(p.inventoryId || p.itemNum);
        _repairDone[k] = true;                    // don't re-probe this row this session
        var link = '';
        // v0.9.1325: the WRITE failure below deletes the sentinel so the row
        // retries; the LOOKUP failure did not, so one Drive hiccup skipped
        // that row for the whole session and its detail page kept saying "no
        // photos" — cured by a reload, so it looked intermittent. This
        // function's own doc comment claims it "treats every failure as 'try
        // again next time'"; one of its two failure paths didn't.
        try { link = await driveFindItemFolder(p.itemNum); }
        catch (eF) { delete _repairDone[k]; continue; }
        if (!link) continue;                      // genuinely has no folder — leave it alone
        // v0.9.1624: when the number-folder holds a subfolder named with
        // THIS row's inventory id, that is the copy's true home (the
        // "<itemNum>/<inventoryId>/" shape every wizard upload has used
        // since v0.9.1128) — link the copy's photos, not the shared pool.
        try {
          var _rpFid = (String(link).match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1] || '';
          if (_rpFid && p.inventoryId) {
            var _rpQ = await driveRequest('GET', '/files?q=' + encodeURIComponent("'" + _rpFid + "' in parents and name='" + String(p.inventoryId) + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") + '&fields=files(id)');
            if (_rpQ && _rpQ.files && _rpQ.files[0]) link = driveFolderLink(_rpQ.files[0].id);
          }
        } catch (eSub) {}
        try {
          if (!(await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, p.row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + p.row, [[link]], { num: p.itemNum || '', invId: p.inventoryId || '' }, 'collection'))) continue;
          p.photoItem = link;
          console.log('[Inbox] repaired photo link for', p.itemNum);
        } catch (eW) { delete _repairDone[k]; console.warn('[Inbox] photo-link repair deferred:', p.itemNum, eW); }
      }
    } catch (e) { console.warn('[Inbox] photo-link repair pass:', e); }
    finally { _repairRan = false; }               // eligible again on the next build
  }

  // ── v0.9.1199: backfill Master Keys for rows saved before v0.9.1198 ──
  // New saves store WHICH catalog row the user confirmed (col AK). Brad's
  // existing 168 rows predate that; this walks them once and writes each
  // row's best resolution — the SAME answer every render already trusts,
  // computed once with full context (era + maker + variation as prefer) and
  // then never re-guessed. Wired beside _repairMissingPhotoLinks and paced
  // the same way, with tonight's starvation lesson applied: RESOLUTION is
  // in-memory and free, so every row is examined each pass — only the sheet
  // WRITES are capped (12/build). A row that resolves to nothing is done
  // (off-catalog; nothing to store); a row whose WRITE fails is re-queued.
  var _mkDone = {};
  async function _backfillMasterKeys() {
    if (!window.state || !state.personalData || !state.personalSheetId) return;
    if (typeof findMaster !== 'function' || typeof rrMasterKeyOf !== 'function'
        || typeof sheetsUpdate !== 'function' || typeof personalColLetter !== 'function') return;
    var wrote = 0;
    // v0.9.1252 (row-identity audit, finding 15): iterate ENTRIES so the
    // store key is available. The done-marker used to be rebuilt from
    // p.row for rows with no Inventory ID — but _adjustRowsAfterDelete
    // mutates .row in place and _mkDone is module-scope, so a marker minted
    // before a deletion named a DIFFERENT copy afterwards and that copy was
    // skipped for the rest of the session, never getting its Master Key.
    // The store key is minted once per load and never recomputed.
    var rows = Object.entries(state.personalData);
    for (var i = 0; i < rows.length; i++) {
      var _storeKey = rows[i][0];
      var p = rows[i][1];
      if (!p || !p.owned || !p.itemNum || p.masterKey) continue;
      if (String(p.era || '') === 'Manual') continue;            // a manual entry's identity is its own
      if (!p.row || Number(p.row) === 99999) continue;           // a placeholder is not a row
      var k = String(p.inventoryId || _storeKey);
      if (_mkDone[k]) continue;
      var m = null;
      try { m = findMaster(p.itemNum, p.variation || '', p); } catch (e) {}
      var key = m ? rrMasterKeyOf(m) : '';
      if (!key) { _mkDone[k] = true; continue; }                 // off-catalog — nothing to store, no API spent
      if (wrote >= 12) continue;                                 // write cap only; resolution stays free
      try {
        if (!(await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, p.row, PERSONAL_TAB + '!' + personalColLetter('masterKey') + p.row, [[key]], { num: p.itemNum || '', invId: p.inventoryId || '' }, 'collection'))) continue;
        p.masterKey = key;                                       // memory learns it the moment the sheet does
        _mkDone[k] = true;
        wrote++;
        console.log('[MasterKey] backfilled', p.itemNum, key);
      } catch (e) { console.warn('[MasterKey] backfill deferred:', p.itemNum, e && e.message); }
    }
  }
  if (typeof window !== 'undefined') window._rrBackfillMasterKeys = _backfillMasterKeys;

  // ── v0.9.1882 (CATALOG_ROW_ID_PLAN Step 4): every saved item gets its Row ID ──
  // [stated] Brad: "yes". Master Version 2.20 put a permanent Row ID on every
  // catalog row; v0.9.1880 taught the app to read and save it. Rows saved
  // before that carry only the old link (Master Key). This writes each one's
  // Master Row ID = the ID of the entry the app SHOWS TODAY — findMaster with
  // the owned row as the hint, the very answer every screen already trusts
  // (a stored key that resolves; else era + maker, e.g. 6-49807 whose key
  // names a row that moved tabs). So nothing on screen changes; the link
  // simply becomes one no two products can share.
  //   • ONE read + ONE write for the whole batch, not a write per row: column
  //     A and the Inventory ID column are read once, every row is checked the
  //     way rrRowStillIs checks it (the id when both sides have one, else the
  //     number), and the IDs go up in one values:batchUpdate, RAW.
  //   • a row that fails the check is skipped this pass (not marked done);
  //     a row with no catalog entry is done (nothing to store)
  //   • the header cell must read "Master Row ID" first — the column exists
  //     only after the v0.9.1881 widen; if it does not, this waits
  //   • a flag guards against running twice (stability rule 4)
  var _mriDone = {}, _mriBusy = false;
  async function _backfillMasterRowIds() {
    if (_mriBusy) return;
    if (!window.state || !state.personalData || !state.personalSheetId) return;
    if (typeof findMaster !== 'function' || typeof rrMasterRowIdOf !== 'function'
        || typeof personalColLetter !== 'function' || typeof sheetsBatchGet !== 'function') return;
    if (typeof rrCatalogIndexStatus === 'function' && !rrCatalogIndexStatus().complete) return;   // v0.9.1527 rule: never resolve in bulk against a half-built catalog
    var todo = [];
    Object.entries(state.personalData).forEach(function (ent) {
      var p = ent[1];
      if (!p || !p.owned || !p.itemNum || p.masterRowId) return;
      if (String(p.era || '') === 'Manual') return;
      if (!p.row || Number(p.row) === 99999) return;
      var k = String(p.inventoryId || ent[0]);
      if (_mriDone[k]) return;
      var m = null;
      try { m = findMaster(p.itemNum, p.variation || '', p); } catch (e) {}
      var id = m ? rrMasterRowIdOf(m) : '';
      if (!id) { if (m) _mriDone[k] = true; return; }       // no entry, or an entry with no ID yet — nothing to store
      todo.push({ k: k, p: p, id: id });
    });
    if (!todo.length) return;
    _mriBusy = true;
    try {
      var mriCol = personalColLetter('masterRowId'), invCol = personalColLetter('inventoryId');
      if (!mriCol || !invCol) return;
      var tab = PERSONAL_TAB;
      var got = await sheetsBatchGet(state.personalSheetId, [tab + '!' + mriCol + '2', tab + '!A3:A', tab + '!' + invCol + '3:' + invCol]);
      var vrs = (got && got.valueRanges) || [];
      var hdr = String((((vrs[0] || {}).values || [[]])[0] || [])[0] || '').trim();
      if (hdr !== 'Master Row ID') { console.log('[RowId] column not on the sheet yet — waiting for the next start'); return; }
      var nums = ((vrs[1] || {}).values || []).map(function (r) { return String(r && r[0] != null ? r[0] : '').trim(); });
      var ids = ((vrs[2] || {}).values || []).map(function (r) { return String(r && r[0] != null ? r[0] : '').trim(); });
      var data = [], written = [];
      todo.forEach(function (t) {
        var i = Number(t.p.row) - 3, gotNum = nums[i] || '', gotId = ids[i] || '';
        var wantNum = String(t.p.itemNum).trim(), wantId = String(t.p.inventoryId || '').trim();
        var ok = (wantId && gotId) ? gotId === wantId : gotNum === wantNum;
        if (!ok) { console.warn('[RowId] row ' + t.p.row + ' is not ' + wantNum + ' any more — skipped this pass'); return; }
        data.push({ range: tab + '!' + mriCol + t.p.row, values: [[t.id]] });
        written.push(t);
      });
      if (!data.length) return;
      var res = await _withTokenRetry(function () {
        return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '/values:batchUpdate', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data: data }),
        });
      });
      if (!res.ok) { console.warn('[RowId] backfill deferred: HTTP ' + res.status); return; }
      written.forEach(function (t) { t.p.masterRowId = t.id; _mriDone[t.k] = true; });
      try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (eC) {}
      console.log('[RowId] ' + written.length + ' item(s) now carry their catalog entry\'s Row ID');
    } catch (e) { console.warn('[RowId] backfill deferred:', e && e.message); }
    finally { _mriBusy = false; }
  }
  if (typeof window !== 'undefined') window._rrBackfillMasterRowIds = _backfillMasterRowIds;

  // ══ v0.9.1561 — RESCUE STRANDED SET PHOTOS (one-time repair) ═════════════
  // Before v0.9.1560, a grouped save never armed its staged inbox photos:
  // the handoff matched "2344" (the number read off the photo) against
  // "2344-P" (the number the row saved under) with a normalizer that only
  // strips ".0", found nothing, and returned silently. The FILES are still
  // here in the inbox, stamped with rrNum / rrRole / rrGrp. This walks them,
  // proposes a target row for each, and moves NOTHING until Brad confirms on
  // a review screen. Every Apply is journaled and undoable from Preferences.
  // Scope is deliberately GROUPED photos only (kind aa/ab/aba/set/tender, a
  // real rrGrp, or a pair_* role): a single-add photo sitting in the inbox
  // may simply be waiting to become a new item, and guessing would misfile.

  var _RESCUE_UNDO = 'rr_photo_rescue_undo_v1';
  var _rescuePlanNow = null;

  function _rescueTier(a, b) {
    var nrm = function (x) { return (typeof normalizeItemNum === 'function') ? String(normalizeItemNum(x)) : String(x || ''); };
    var A = nrm(a), B = nrm(b);
    if (A && A === B) return 3;
    if (A.toUpperCase().replace(/-/g, '') === B.toUpperCase().replace(/-/g, '')) return 2;
    var bas = function (x) {   // v0.9.1563: strip stacked suffixes (2356T-D), digit-guarded
      var s = nrm(x).toUpperCase().replace(/-/g, '');
      return /\d/.test(s) ? s.replace(/[PDTC]+$/, '') : s;
    };
    if (bas(a) && bas(a) === bas(b)) return 1;
    return 0;
  }

  // role → the suffix letters that row's number should end with (Lionel
  // convention: P powered · T/D dummy-trailer · C B-unit).
  var _RESCUE_ROLE_SUFFIX = { p: 'P', aunit_p: 'P', d: 'DT', aunit_d: 'DT', b: 'C', bunit: 'C' };

  // Pure planner — window-exported so tests can run it headless.
  // files: [{id, name, meta:{num,grp,kind,role,stat,view,ord}}]
  // personal: the state.personalData object (keyed rows).
  window._rrRescuePlan = function (files, personal) {
    var GROUPY = { aa: 1, ab: 1, aba: 1, set: 1, tender: 1 };
    var inScope = (files || []).filter(function (f) {
      var m = (f && f.meta) || {};
      if (m.stat === 'filed') return false;
      var grouped = GROUPY[m.kind] || (m.grp && m.grp !== '-') ||
        (typeof _pinIsPairRole === 'function' && _pinIsPairRole(m.role));
      return !!grouped;
    });
    // bucket: grp (or per-number) → num → files. No-number files join their
    // group only when the group holds exactly ONE distinct number.
    var buckets = {}, noNum = {};
    inScope.forEach(function (f) {
      var m = f.meta || {};
      var g = (m.grp && m.grp !== '-') ? 'g:' + m.grp : (m.num ? 'n:' + m.num : '');
      if (!g) return;                                    // no group, no number: unmatchable
      if (!m.num) { (noNum[g] = noNum[g] || []).push(f); return; }
      buckets[g] = buckets[g] || {};
      (buckets[g][m.num] = buckets[g][m.num] || []).push(f);
    });
    Object.keys(noNum).forEach(function (g) {
      var nums = Object.keys(buckets[g] || {});
      if (nums.length === 1) buckets[g][nums[0]] = buckets[g][nums[0]].concat(noNum[g]);
    });
    var units = [], skipped = 0;
    Object.keys(buckets).forEach(function (g) {
      Object.keys(buckets[g]).forEach(function (num) {
        var fl = buckets[g][num];
        // best tier wins; only rows at that tier stay
        var best = 0, cands = [];
        Object.keys(personal || {}).forEach(function (k) {
          var p = personal[k];
          if (!p || !p.owned || !p.itemNum) return;
          if (!p.row || Number(p.row) === 99999) return;
          var t = _rescueTier(p.itemNum, num);
          if (!t) return;
          if (t > best) { best = t; cands = []; }
          if (t === best) cands.push(k);
        });
        if (!cands.length) { skipped += fl.length; return; }
        // role narrows when it maps to a suffix and someone matches it
        var role = (fl.map(function (f) { return (f.meta || {}).role; }).filter(function (r) { return _RESCUE_ROLE_SUFFIX[r]; })[0]) || '';
        if (role && cands.length > 1) {
          var want = _RESCUE_ROLE_SUFFIX[role];
          var narrowed = cands.filter(function (k) {
            var last = String(personal[k].itemNum || '').replace(/-/g, '').slice(-1).toUpperCase();
            return want.indexOf(last) >= 0;
          });
          if (narrowed.length) cands = narrowed;
        }
        cands.sort(function (a, b) {
          var pa = personal[a], pb = personal[b];
          var ph = (!pa.photoItem ? 0 : 1) - (!pb.photoItem ? 0 : 1);
          if (ph) return ph;
          return (parseInt(pb.inventoryId) || 0) - (parseInt(pa.inventoryId) || 0);
        });
        fl.sort(function (a, b) {
          var ra = ((a.meta || {}).view === 'RSV') ? 0 : 1, rb = ((b.meta || {}).view === 'RSV') ? 0 : 1;
          if (ra !== rb) return ra - rb;
          return (parseInt((a.meta || {}).ord) || 999) - (parseInt((b.meta || {}).ord) || 999);
        });
        units.push({
          num: num, grp: g, role: role, files: fl,
          candidates: cands, target: cands[0],
          auto: cands.length === 1 && !personal[cands[0]].photoItem,
        });
      });
    });
    units.sort(function (a, b) { return a.num < b.num ? -1 : a.num > b.num ? 1 : 0; });
    return { units: units, skipped: skipped };
  };

  window.rrPhotoRescueScan = async function () {
    if (PIN._busy) { _pinBusyBounce(); return; }
    if (!window.state || !state.personalData || !Object.keys(state.personalData).length) {
      showToast('Collection still loading — try again in a moment'); return;
    }
    _setBusy(true, 'Scanning the inbox');
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      var all = [], tok = '', guard = 0;
      do {
        var res = await driveRequest('GET', '/files?q=' + q +
          '&fields=nextPageToken,files(id,name,appProperties)&pageSize=200' + (tok ? '&pageToken=' + tok : ''));
        all = all.concat(res.files || []);
        tok = res.nextPageToken || '';
      } while (tok && ++guard < 40);
      var files = all.map(function (f) { return { id: f.id, name: f.name || '', meta: _pinMetaOf(f) }; });
      _rescuePlanNow = window._rrRescuePlan(files, state.personalData);
      _rescueRender(_rescuePlanNow);
    } catch (e) {
      console.warn('[Rescue] scan failed:', e && e.message);
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'the inbox scan') : 'Could not scan the inbox — please try again.', 4500, true);
    } finally { _setBusy(false); }
  };

  function _rescueEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function _rescueRender(plan) {
    var old = document.getElementById('rr-rescue-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'rr-rescue-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    var rows = '';
    if (!plan.units.length) {
      rows = '<div style="padding:1rem;color:var(--text-mid)">No stranded grouped photos found.' +
        (plan.skipped ? ' (' + plan.skipped + ' photo' + (plan.skipped > 1 ? 's' : '') + ' had no owned match and stay in the inbox.)' : '') + '</div>';
    } else {
      rows = plan.units.map(function (u, i) {
        var opts = u.candidates.map(function (k) {
          var p = state.personalData[k];
          var lbl = p.itemNum + (p.variation ? ' · Var ' + p.variation : '') +
            (p.condition ? ' · Cond ' + p.condition : '') + (p.location ? ' · ' + p.location : '') +
            (p.photoItem ? ' · has photos' : ' · no photos yet');
          return '<option value="' + _rescueEsc(k) + '"' + (k === u.target ? ' selected' : '') + '>' + _rescueEsc(lbl) + '</option>';
        }).join('');
        return '<div style="display:flex;gap:0.5rem;align-items:center;padding:0.45rem 0.2rem;border-bottom:1px solid var(--border)">' +
          '<input type="checkbox" data-ri="' + i + '"' + (u.auto ? ' checked' : '') + '>' +
          '<div style="flex:1;min-width:0"><strong>' + _rescueEsc(u.num) + '</strong>' +
          (u.role ? ' <span style="color:var(--text-dim);font-size:0.75rem">(' + _rescueEsc(u.role) + ')</span>' : '') +
          ' — ' + u.files.length + ' photo' + (u.files.length > 1 ? 's' : '') +
          (u.candidates.length > 1 ? '<br><select data-rs="' + i + '" onchange="_rrRescuePick(' + i + ',this.value)" style="max-width:100%">' + opts + '</select>'
            : '<br><span style="font-size:0.75rem;color:var(--text-mid)">' + _rescueEsc((state.personalData[u.target] || {}).itemNum || '') + (state.personalData[u.target] && state.personalData[u.target].photoItem ? ' · has photos (will add to its folder)' : ' · no photos yet') + '</span>') +
          '</div></div>';
      }).join('');
      rows += plan.skipped ? '<div style="padding:0.5rem 0.2rem;color:var(--text-dim);font-size:0.8rem">' + plan.skipped + ' photo' + (plan.skipped > 1 ? 's' : '') + ' had no owned match and stay in the inbox.</div>' : '';
    }
    ov.innerHTML = '<div class="rr-card" style="background:var(--surface,#fff);border-radius:12px;max-width:520px;width:100%;max-height:85vh;max-height:85dvh;display:flex;flex-direction:column;padding:1rem">' +
      '<div style="font-weight:700;font-size:1.05rem">Rescue stranded set photos</div>' +
      '<div style="color:var(--text-mid);font-size:0.8rem;margin:0.2rem 0 0.6rem">Nothing moves until you press Apply. Ticked rows are certain matches; the rest need you to pick which copy.</div>' +
      '<div style="overflow-y:auto;flex:1">' + rows + '</div>' +
      '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem">' +
      '<button class="pref-btn" onclick="document.getElementById(\'rr-rescue-ov\').remove()">Cancel</button>' +
      (plan.units.length ? '<button class="pref-btn" style="background:var(--accent);color:#fff" onclick="rrPhotoRescueApply(this)">Apply</button>' : '') +
      '</div></div>';
    document.body.appendChild(ov);
  }

  window._rrRescuePick = function (i, key) {
    if (_rescuePlanNow && _rescuePlanNow.units[i]) _rescuePlanNow.units[i].target = key;
  };

  window.rrPhotoRescueApply = async function (btn) {
    if (PIN._busy) { _pinBusyBounce(); return; }
    var plan = _rescuePlanNow; if (!plan) return;
    var ov = document.getElementById('rr-rescue-ov');
    var ticked = [];
    (ov ? ov.querySelectorAll('input[type=checkbox][data-ri]') : []).forEach(function (cb) {
      if (cb.checked) ticked.push(plan.units[parseInt(cb.getAttribute('data-ri'), 10)]);
    });
    if (!ticked.length) { showToast('Nothing ticked'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
    _setBusy(true, 'Rescuing photos');
    var journal = { when: new Date().toISOString(), units: [] };
    var okUnits = 0, failUnits = 0;
    try {
      var fromFid = await _folder();
      for (var ui = 0; ui < ticked.length; ui++) {
        var u = ticked[ui];
        var pd = state.personalData[u.target];
        if (!pd || !pd.row || Number(pd.row) === 99999) { failUnits++; continue; }
        try {
          // destination: the row's own folder → shared? use an inventoryId
          // subfolder → else <itemNum>/<inventoryId> — v1499/v1500 precedence.
          var toFid = '', link = '';
          var m = String(pd.photoItem || '').match(/folders\/([a-zA-Z0-9_-]+)/);
          if (m) {
            toFid = m[1]; link = pd.photoItem;
            if (pd.inventoryId && typeof _pinFolderShared === 'function' && await _pinFolderShared(toFid, pd)) {
              var sub = await driveFindOrCreateFolder(String(pd.inventoryId), toFid);
              if (sub) { toFid = sub; link = driveFolderLink(sub); }
            }
          } else {
            var basF = await driveEnsureItemFolder(pd.itemNum);
            var sub2 = pd.inventoryId ? await driveFindOrCreateFolder(String(pd.inventoryId), basF) : '';
            toFid = sub2 || basF; link = driveFolderLink(toFid);
          }
          var ju = { num: u.num, target: u.target, row: pd.row, invId: pd.inventoryId || '', toFid: toFid, fromFid: fromFid, wroteLink: false, prevPhotoItem: pd.photoItem || '', files: [] };
          var hadPhotos = !!pd.photoItem;
          for (var fi = 0; fi < u.files.length; fi++) {
            var f = u.files[fi];
            await driveMoveFileToFolder(f.id, fromFid, toFid);
            var ext = (String(f.name).match(/\.(\w+)$/) || [0, 'jpg'])[1];
            var tag = (fi === 0 && !hadPhotos) ? ' RSV ' : ' ADD ';
            var newName = pd.itemNum + tag + (Date.now() + fi) + '.' + ext;
            try { await driveRequest('PATCH', '/files/' + f.id + '?fields=id', { name: newName }); } catch (eR) {}
            try { await _pinMetaSet(f.id, { stat: 'filed' }); } catch (eS) {}
            ju.files.push({ id: f.id, oldName: f.name });
          }
          if (!pd.photoItem) {
            var okW = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
              PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[link]],
              { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection');
            if (okW) { pd.photoItem = link; ju.wroteLink = true; }
          }
          journal.units.push(ju);
          okUnits++;
        } catch (eU) {
          console.warn('[Rescue] unit failed:', u.num, eU && eU.message);
          failUnits++;
        }
      }
      if (journal.units.length) {
        try {
          var allJ = JSON.parse(localStorage.getItem(_RESCUE_UNDO) || '[]');
          allJ.push(journal);
          localStorage.setItem(_RESCUE_UNDO, JSON.stringify(allJ.slice(-10)));
        } catch (eJ) {}
      }
      showToast('✓ ' + okUnits + ' item' + (okUnits === 1 ? '' : 's') + ' got photos' + (failUnits ? ' · ' + failUnits + ' failed (see console)' : ''));
      if (ov) ov.remove();
      _rescuePlanNow = null;
      try { if (typeof buildDashboard === 'function') buildDashboard(); } catch (eD) {}
      try { if (typeof renderBrowse === 'function') renderBrowse(); } catch (eB) {}
    } finally { _setBusy(false); }
  };

  window.rrPhotoRescueRowHtml = function () {
    return '<div class="pref-row">' +
      '<div class="pref-row-label"><strong>Rescue stranded set photos</strong>' +
      '<span>Photos read in the inbox that never attached to a grouped item (a bug fixed in v0.9.1560). Shows a review first — nothing moves until you confirm.</span></div>' +
      '<button class="pref-btn" onclick="rrPhotoRescueScan()">Scan</button></div>';
  };

  window.rrPhotoRescueUndoHtml = function () {
    var allJ;
    try { allJ = JSON.parse(localStorage.getItem(_RESCUE_UNDO) || '[]'); } catch (e) { allJ = []; }
    if (!allJ.length) return '';
    return allJ.slice(-3).reverse().map(function (b, i) {
      var idx = allJ.length - 1 - i;
      var n = (b.units || []).length;
      var d = (b.when || '').slice(0, 10);
      return '<div class="pref-row"><div class="pref-row-label"><strong>Undo photo rescue</strong>' +
        '<span>' + d + ' · ' + n + ' item' + (n === 1 ? '' : 's') + ' — moves the photos back to the inbox</span></div>' +
        '<button class="pref-btn" onclick="rrPhotoRescueUndo(' + idx + ',this)">Undo</button></div>';
    }).join('');
  };

  window.rrPhotoRescueUndo = async function (idx, btn) {
    if (PIN._busy) { _pinBusyBounce(); return; }
    var allJ;
    try { allJ = JSON.parse(localStorage.getItem(_RESCUE_UNDO) || '[]'); } catch (e) { allJ = []; }
    var batch = allJ[idx]; if (!batch) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Undoing…'; }
    _setBusy(true, 'Undoing photo rescue');
    var problems = 0;
    try {
      for (var ui = 0; ui < batch.units.length; ui++) {
        var ju = batch.units[ui];
        try {
          for (var fi = 0; fi < ju.files.length; fi++) {
            var f = ju.files[fi];
            await driveMoveFileToFolder(f.id, ju.toFid, ju.fromFid);
            try { await driveRequest('PATCH', '/files/' + f.id + '?fields=id', { name: f.oldName }); } catch (eR) {}
            try { await _pinMetaSet(f.id, { stat: 'read' }); } catch (eS) {}
          }
          if (ju.wroteLink) {
            var pd = state.personalData[ju.target];
            if (pd && pd.row && Number(pd.row) !== 99999) {
              var okW = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
                PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[ju.prevPhotoItem || '']],
                { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection');
              if (okW) pd.photoItem = ju.prevPhotoItem || '';
            } else problems++;
          }
        } catch (eU) { problems++; console.warn('[Rescue] undo unit failed:', ju.num, eU && eU.message); }
      }
      allJ.splice(idx, 1);
      localStorage.setItem(_RESCUE_UNDO, JSON.stringify(allJ));
      showToast(problems ? 'Undo finished with ' + problems + ' problem(s) — see console' : '✓ Photos are back in the inbox');
      try { if (typeof buildPrefsPage === 'function') buildPrefsPage(); } catch (eP) {}
      try { if (typeof buildDashboard === 'function') buildDashboard(); } catch (eD) {}
    } finally { _setBusy(false); }
  };

  // ── Batch AI identify (Phase 3, v0.9.886) ────────────────────
  // One button: every un-identified item group gets its FIRST photo
  // run through the existing identify relay (ai-id.js → Gemini).
  // Suggestions persist in localStorage, show on the tiles, and
  // pre-fill the File-to-item dialog. Sequential + cancelable.
  var IDS_KEY = 'rr_inbox_ids';
  // v0.9.1324 (MEASURED, not guessed): _ids() is called once PER TILE inside
  // _render()'s map — and again by _pinStatusOf — so one repaint parsed this
  // whole store once for every visible photo. At 500 photos the store is
  // ~380KB, so a single repaint parsed ~190MB of JSON: 1,097ms on a desktop
  // and 5,705ms on a phone. And _render() fires after EVERY photo the reader
  // finishes, so the repaints alone roughly DOUBLED a 500-photo run that the
  // app itself estimates at 24 minutes.
  //
  // The fix caches the PARSED object keyed on the exact string it came from.
  // Keying on the raw text rather than invalidating in _idsSave is deliberate
  // and load-bearing: any writer at all — this file, another tab, a test that
  // pokes localStorage directly — changes the text and therefore busts the
  // cache for free. (The invalidate-in-_idsSave version measured slightly
  // faster and FAILED 12 assertions, because the suite writes the store
  // directly. Cheaper is not better if it is wrong.)
  //
  // Measured after: 5,705ms -> 127ms on a phone (45x), 1,097ms -> 13ms desktop.
  //
  // One caveat worth writing down: successive calls now hand back the SAME
  // object, so a caller that mutated the result without calling _idsSave would
  // leak that mutation to the next reader. rr_inbox_ids is written in exactly
  // one place (_idsSave, just below) and nowhere else in app/ — checked.
  var _idsRaw = null, _idsObj = null;
  var _idsWas = null;
  function _ids() {
    try {
      var raw = localStorage.getItem(IDS_KEY) || '{}';
      if (_idsObj && raw === _idsRaw) return _idsObj;
      _idsObj = JSON.parse(raw); _idsRaw = raw;
      _idsWas = _idsShadow(_idsObj);
      return _idsObj;
    } catch (e) { _idsRaw = null; _idsObj = null; _idsWas = null; return {}; }
  }

  // v0.9.1771 — ONE PLACE stamps a read with the moment it was decided.
  // Every writer of rr_inbox_ids goes through _idsSave, so putting the clock
  // here covers the reader, the paid read, the re-scan, a typed number and any
  // path added later — the same reason the rejected-answer guard lives at a
  // single chokepoint rather than in each producer.
  //
  // The shadow is the state as PARSED, which is a true "before": _ids() hands
  // back the same object and callers mutate it in place, so the live object
  // cannot be compared against itself. Only num and the rejected list count as
  // a new answer; a record whose rt the caller set deliberately (a pull from
  // Drive carries DRIVE's time) is left alone, or the pull would look local.
  //
  // A pre-1771 record that is not being changed is backfilled to 1, not to
  // now: legacy reads on two devices then TIE instead of both claiming to be
  // the newest, and any genuine new read beats them both.
  // Self-contained on purpose: the §269 suite runs _ids() in an isolated
  // scope, so the shadow may not reach for _rejStr (the Drive PACKER, which
  // caps at 100 characters and would make two different lists look identical
  // once they got long). This one only has to answer "did the list change".
  function _rejKey(list) {
    return (list || []).map(function (v) { return String(v == null ? '' : v); }).join(',');
  }
  function _idsShadow(m) {
    var out = {};
    Object.keys(m || {}).forEach(function (k) {
      var r = m[k] || {};
      out[k] = String(r.num || '') + '\u0001' + _rejKey(r.rejected)
             + '\u0001' + String(r.rt || '');
    });
    return out;
  }
  function _idsSave(m) {
    try {
      var was = _idsWas || {}, now = Date.now();
      Object.keys(m || {}).forEach(function (k) {
        var r = m[k];
        if (!r || typeof r !== 'object') return;
        var prev = was[k];
        var parts = (prev === undefined)
          ? ['\u0000', '\u0000', '\u0000']
          : String(prev).split('\u0001');
        var changed = String(r.num || '') !== parts[0] || _rejKey(r.rejected) !== parts[1];
        var rtByCaller = String(r.rt || '') !== parts[2];
        if (!r.rt) r.rt = changed ? now : 1;
        else if (changed && !rtByCaller) r.rt = now;
      });
    } catch (e) { /* stamping must never cost a save */ }
    try { localStorage.setItem(IDS_KEY, JSON.stringify(m)); } catch (e) {}
  }

  // v0.9.961 (Brad): persistent set of file IDs we've cropped. drive.js reads
  // window._rrForceFreshBytes to load their real (cropped) bytes instead of
  // Drive's stale server preview. Survives reloads via localStorage.
  function _cropped() { try { return JSON.parse(localStorage.getItem(CROPPED_KEY) || '{}'); } catch (e) { return {}; } }
  function _croppedSave(m) { try { localStorage.setItem(CROPPED_KEY, JSON.stringify(m)); } catch (e) {} window._rrForceFreshBytes = m; }
  function _markCropped(fid) {
    if (!fid) return;
    var c = _cropped(); c[fid] = 1; _croppedSave(c);
    // v0.9.1771 — stamp it on the photo as well. Drive keeps serving its old
    // preview after the bytes are replaced, and until now only the device that
    // did the cropping knew not to trust it, so the other device showed the
    // pre-crop picture indefinitely. Best-effort: a failed stamp leaves today's
    // behaviour exactly as it was.
    try { _pinMetaSet(fid, { crop: String(Date.now()) }); } catch (e) {}
  }
  window._rrMarkCropped = _markCropped;   // v0.9.1631: the crop healer (drive.js) marks detail-page crops too
  // Publish the current markers to drive.js up front, and again after each load
  // (pruned to what's still in the inbox so the set can't grow without bound).
  window._rrForceFreshBytes = _cropped();

  PIN._idAbort = false;
  window._pinIdentifyCancel = function () { PIN._idAbort = true; };
})();
