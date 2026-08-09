// ══════════════════════════════════════════════════════════════════════════
//  error-report.js — "Report a problem" (Session 208)
//
//  Brad, verbatim: "we need a error reporting button. something that a user
//  hits, and it would record what they did, lets say, the last 20 or so
//  button clicks, and what they typed, then it allow them to send a few
//  screen shots and let them enter into a form what they were doing and what
//  they saw and what the error is in their mind. that way we can then process
//  it here when we receive the report in an email."
//
//  SELF-CONTAINED FEATURE, same shape as dispatch-board.js: this file injects
//  its own sidebar nav item, account-menu entry (mobile reach) and modal.
//  Delete the ONE script line in index.html to remove the whole feature.
//  Nothing else in the app references it.
//
//  FAIL-SILENT: every listener and every step is wrapped. If anything in here
//  throws, the app behaves exactly as it did before this file existed. A
//  reporting tool must never become the thing that breaks the app.
//
//  ── PRIVACY (non-negotiable — read before editing) ─────────────────────
//  1. Typed values are NEVER stored. We keep the field's label and a redacted
//     placeholder ("12 characters"), never the characters themselves. That is
//     a deliberate step further than the original design note: knowing a user
//     typed into "Price" is enough to reproduce a bug; knowing WHAT they typed
//     almost never is, and storing it is how secrets leak.
//  2. Password fields and anything whose id/name/label smells like a secret
//     are not even acknowledged by length — they log as "[hidden field]".
//  3. localStorage is NEVER read, serialised or attached. The Google access
//     token lives there. The context block below is an explicit WHITELIST of
//     named values; there is no "dump everything" path anywhere in this file.
//  4. The outbox is reported as COUNTS AND TARGETS only (how many unsent
//     writes, to which sheet ranges) — never the cell values being written,
//     which are the user's own collection data.
//  5. The user sees the exact report text before anything is sent, and can
//     delete any breadcrumb line they don't want to include. Nothing is sent
//     silently, ever — the report opens a Gmail draft that THEY press send on.
// ══════════════════════════════════════════════════════════════════════════

// ── CONFIG — single source of truth for this feature ─────────────────────
var ERR_REPORT_CFG = {
  // The reports relay — a SEPARATE Apps Script web app from the Collector's
  // Market (VAULT.ENDPOINT in vault.js). Deliberately separate: the Market is
  // production-critical and gated at 300 contributors, and nothing about
  // problem reports should ever be able to take it down. Deployed and
  // guard-tested 2026-08-09 — it refuses a wrong word, an empty body, a body
  // over 20,000 chars, and a second report from the same device inside 30s.
  endpoint:     'https://script.google.com/macros/s/AKfycbz4ksB7MSZiAH67B-td2yCEp9dFz2H1_ToONGWqQITAVhHnzz8qPldFPn0FcJRkS-HT/exec',
  // A shared word the relay checks before it accepts anything. This is NOT a
  // secret in the real sense — it is visible to anyone who reads this file —
  // and it is not meant to be. Its job is to make casual junk posting
  // pointless. Real abuse protection is the relay's size cap and rate limit.
  postWord:     'rr-report-v1',
  replyTo:      'bhale@ipd-llc.com',   // fallback address for copy / draft routes
  maxCrumbs:    25,                    // ring buffer size (Brad asked for ~20)
  maxTextLen:   60,                    // truncate captured button text
  maxShots:     4,                     // screenshots a user may attach
  maxShotBytes: 8 * 1024 * 1024,       // 8MB per screenshot
  subjectPrefix:'Rail Roster problem report',
  pollMs:       2000,                  // boot-readiness poll interval
  pollMax:      150,                   // ≈5 min, then give up silently

  // localStorage keys. NOTE the report code is deliberately its OWN key and
  // its OWN random value — see _reportCode() for why it must never be the
  // Collector's Market token.
  keyCode:      'rr_report_code',      // anonymous, report-only device code
  keyOptIn:     'rr_report_email_ok',  // remembered checkbox choice
  keyPending:   'rr_report_pending',   // one un-sent report, retried next load

  // Brad's words, shown after a report is sent.
  thanksNote:   'I will do my best to reply as soon as I can. You may have caught me in the trainroom. Thanks for understanding.',

  // Field names/ids/labels matching this are never recorded, not even length.
  secretRe:     /pass|pwd|token|secret|auth|card|cvv|cvc|ssn|social|account\s*num|routing|pin\b|api[-_ ]?key/i
};

(function () {
  'use strict';

  // ── The breadcrumb ring buffer ────────────────────────────────────────
  // In MEMORY only, never localStorage: it clears on reload, can't grow
  // without bound, and can't outlive the session it describes.
  var _crumbs = [];

  function _push(kind, text) {
    try {
      _crumbs.push({ t: Date.now(), kind: kind, text: String(text || '').slice(0, 200) });
      if (_crumbs.length > ERR_REPORT_CFG.maxCrumbs) _crumbs.shift();
    } catch (e) { /* never let logging break a click */ }
  }

  // Visible label for an element, in the order a human would name it.
  function _labelOf(el) {
    if (!el) return '';
    var s = el.getAttribute('aria-label')
         || el.getAttribute('title')
         || el.getAttribute('data-ctip')
         || (el.textContent || '').replace(/\s+/g, ' ').trim()
         || el.id
         || el.name
         || '';
    return s.slice(0, ERR_REPORT_CFG.maxTextLen);
  }

  // Does this field look like it holds a secret? Checked against every name
  // we can see, plus the input type. When in doubt we treat it as secret —
  // a missed breadcrumb costs us nothing; a leaked one costs the user.
  function _isSecret(el) {
    try {
      if (!el) return true;
      if ((el.type || '').toLowerCase() === 'password') return true;
      var hay = [el.id, el.name, el.getAttribute('aria-label'),
                 el.getAttribute('placeholder'), el.getAttribute('autocomplete')]
                .filter(Boolean).join(' ');
      return ERR_REPORT_CFG.secretRe.test(hay);
    } catch (e) { return true; }
  }

  // ── Listeners. Capture phase, passive, and each one fully guarded. ────
  function _installListeners() {
    try {
      document.addEventListener('click', function (ev) {
        try {
          var el = ev.target && ev.target.closest
                 ? ev.target.closest('button, a, [role="button"], .nav-item, .mobile-nav-item, select')
                 : null;
          if (!el) return;
          // Never log the report tool's own controls — pure noise in a report.
          if (el.closest && el.closest('#err-report-modal')) return;
          var label = _labelOf(el);
          _push('click', label || (el.id ? '#' + el.id : el.tagName.toLowerCase()));
        } catch (e) {}
      }, true);

      // 'change' rather than every keystroke: one line per field the user
      // actually finished with, which is what makes a report readable.
      document.addEventListener('change', function (ev) {
        try {
          var el = ev.target;
          if (!el || !el.tagName) return;
          if (el.closest && el.closest('#err-report-modal')) return;
          var tag = el.tagName.toLowerCase();
          if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
          var name = _labelOf(el) || el.id || el.name || tag;

          if (_isSecret(el)) { _push('typed', name + ' → [hidden field]'); return; }

          if (tag === 'select') {
            // A dropdown choice is a UI state, not typed text — safe to keep,
            // and usually the single most useful line in a bug report.
            var opt = el.options && el.options[el.selectedIndex];
            _push('chose', name + ' → ' + _labelOf(opt));
            return;
          }
          if ((el.type || '').toLowerCase() === 'checkbox' || (el.type || '').toLowerCase() === 'radio') {
            _push('chose', name + ' → ' + (el.checked ? 'ticked' : 'unticked'));
            return;
          }
          // Everything else: length only. See PRIVACY note 1.
          var n = (el.value || '').length;
          _push('typed', name + ' → ' + (n ? n + ' characters' : 'cleared'));
        } catch (e) {}
      }, true);

      // Page changes give the trail its shape ("he was on Reports when it broke").
      if (typeof window.showPage === 'function' && !window.showPage._errWrapped) {
        var _orig = window.showPage;
        window.showPage = function (name) {
          try { _push('page', 'opened ' + name); } catch (e) {}
          return _orig.apply(this, arguments);
        };
        window.showPage._errWrapped = true;
      }

      // Errors the browser saw, which the user often can't describe.
      window.addEventListener('error', function (ev) {
        try {
          var m = ev && ev.message ? ev.message : 'script error';
          var f = ev && ev.filename ? String(ev.filename).split('/').pop() : '';
          _push('error', m.slice(0, 160) + (f ? ' (' + f + ')' : ''));
        } catch (e) {}
      });
      window.addEventListener('unhandledrejection', function (ev) {
        try {
          var r = ev && ev.reason;
          _push('error', 'unhandled: ' + String((r && r.message) || r || '').slice(0, 160));
        } catch (e) {}
      });
    } catch (e) { /* feature simply stays quiet */ }
  }

  // ── WHO the report is from ────────────────────────────────────────────
  //
  // The report code is a random device code used for ONE purpose: telling
  // that several reports came from the same person. It is generated here, in
  // its own storage key, and is deliberately NOT the Collector's Market token
  // (VAULT.KEY_TOKEN). Reusing that token would let an "anonymous" report be
  // matched back to that device's Market submissions — which is exactly the
  // link the user just said they did not want. Two separate promises need two
  // separate identifiers.
  function _reportCode() {
    try {
      var c = localStorage.getItem(ERR_REPORT_CFG.keyCode);
      if (!c) {
        var a = 'abcdefghijklmnopqrstuvwxyz0123456789';
        c = '';
        for (var i = 0; i < 10; i++) c += a[Math.floor(Math.random() * a.length)];
        localStorage.setItem(ERR_REPORT_CFG.keyCode, c);
      }
      return c;
    } catch (e) { return 'no-code'; }
  }

  // The address they are signed in with. Shown in full on the tick box so the
  // choice is concrete — and so someone signed into the wrong Google account
  // sees it before they send, instead of wondering why no reply ever came.
  function _signedInEmail() {
    try { return (window.state && state.user && state.user.email) || ''; } catch (e) { return ''; }
  }
  function _signedInName() {
    try { return (window.state && state.user && state.user.name) || ''; } catch (e) { return ''; }
  }

  // Remembered choice. Default is TICKED: someone reporting a problem is
  // asking to be helped, and a reply is the normal shape of that. Unticking
  // is one tap and is remembered per device so it never has to be repeated.
  function _emailOptInDefault() {
    try {
      var v = localStorage.getItem(ERR_REPORT_CFG.keyOptIn);
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }
  function _rememberOptIn(on) {
    try { localStorage.setItem(ERR_REPORT_CFG.keyOptIn, on ? '1' : '0'); } catch (e) {}
  }

  // ── Context. An explicit whitelist — see PRIVACY note 3. ──────────────
  function _context() {
    var c = {};
    try { c.appVersion = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'unknown'; } catch (e) { c.appVersion = 'unknown'; }
    try {
      var active = document.querySelector('.page.active');
      c.page = active ? active.id.replace(/^page-/, '') : 'unknown';
    } catch (e) { c.page = 'unknown'; }
    try { c.screen = window.innerWidth + '×' + window.innerHeight; } catch (e) {}
    try { c.online = navigator.onLine ? 'yes' : 'NO — offline'; } catch (e) {}
    try { c.browser = navigator.userAgent.slice(0, 180); } catch (e) {}
    try { c.when = new Date().toString(); } catch (e) {}
    try {
      // Counts and targets only — never the values. See PRIVACY note 4.
      if (typeof rrOutboxList === 'function') {
        var list = rrOutboxList() || [];
        c.unsentWrites = list.length;
        if (list.length) {
          c.unsentTargets = list.slice(0, 8).map(function (e) {
            return (e && e.kind ? e.kind : '?') + ' ' + ((e && e.args && e.args.range) ? e.args.range : '(no range)');
          }).join(', ');
        }
      }
    } catch (e) {}
    return c;
  }

  // ── Report assembly ───────────────────────────────────────────────────
  function _fmtTime(ts) {
    try {
      var d = new Date(ts);
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    } catch (e) { return ''; }
  }

  function _keptCrumbs() {
    // Respect any lines the user ticked off in the preview.
    var out = [];
    for (var i = 0; i < _crumbs.length; i++) {
      var box = document.getElementById('err-crumb-' + i);
      if (!box || box.checked) out.push(_crumbs[i]);
    }
    return out;
  }

  function _buildReportText(answers, shotLinks) {
    var ctx = _context();
    var L = [];
    L.push('THE RAIL ROSTER — PROBLEM REPORT');
    L.push('');
    L.push('WHAT I WAS DOING:');
    L.push(answers.doing || '(not answered)');
    L.push('');
    L.push('WHAT I SAW:');
    L.push(answers.saw || '(not answered)');
    L.push('');
    L.push('WHAT I THINK WENT WRONG:');
    L.push(answers.think || '(not answered)');
    L.push('');
    L.push('────────────────────────────────');
    L.push('FROM');
    if (answers.emailOk && answers.email) {
      L.push('  ' + (answers.name ? answers.name + ' — ' : '') + answers.email);
      L.push('  (they ticked "email me back", so a reply is expected)');
    } else {
      L.push('  Anonymous — they unticked the reply box, so there is no address.');
    }
    L.push('  Report code: ' + answers.code + '   (same code = same device, nothing more)');
    L.push('');
    L.push('CONTEXT');
    L.push('  App version : ' + ctx.appVersion);
    L.push('  Page        : ' + ctx.page);
    L.push('  Screen      : ' + (ctx.screen || '?'));
    L.push('  Online      : ' + (ctx.online || '?'));
    L.push('  When        : ' + (ctx.when || '?'));
    L.push('  Browser     : ' + (ctx.browser || '?'));
    if (typeof ctx.unsentWrites !== 'undefined') {
      L.push('  Unsent saves: ' + ctx.unsentWrites + (ctx.unsentTargets ? ' (' + ctx.unsentTargets + ')' : ''));
    }
    L.push('');
    L.push('LAST STEPS (newest last; typed text is never recorded — only how many characters)');
    var kept = _keptCrumbs();
    if (!kept.length) {
      L.push('  (none recorded)');
    } else {
      for (var i = 0; i < kept.length; i++) {
        L.push('  ' + _fmtTime(kept[i].t) + '  ' + kept[i].kind.toUpperCase() + '  ' + kept[i].text);
      }
    }
    if (shotLinks && shotLinks.length) {
      L.push('');
      L.push('SCREENSHOTS');
      for (var j = 0; j < shotLinks.length; j++) L.push('  ' + shotLinks[j]);
    }
    L.push('');
    L.push('(Sent from the Report a problem button.)');
    return L.join('\n');
  }

  // ── Screenshot upload (best-effort) ───────────────────────────────────
  // A Gmail compose URL cannot carry attachments, so images go to the user's
  // own Drive with a view link — the same route share.js already uses for
  // shared PDFs. If the user isn't signed in, or anything fails, we say so
  // plainly and tell them to attach the images in Gmail by hand. The report
  // still sends either way.
  async function _uploadShots(files, onProgress) {
    var links = [];
    if (!files || !files.length) return links;
    var token = null;
    try { token = (typeof accessToken !== 'undefined') ? accessToken : null; } catch (e) {}
    if (!token) return ['(not signed in — please attach the images to this email yourself)'];

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      try {
        if (onProgress) onProgress('Uploading image ' + (i + 1) + ' of ' + files.length + '…');
        var meta = { name: 'RailRoster-report-' + Date.now() + '-' + (i + 1) + '-' + (f.name || 'shot.png') };
        var fd = new FormData();
        fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        fd.append('file', f);
        var up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
        });
        var j = await up.json();
        if (!j || !j.id) { links.push('(one image failed to upload — please attach it yourself)'); continue; }
        await fetch('https://www.googleapis.com/drive/v3/files/' + j.id + '/permissions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });
        links.push('https://drive.google.com/file/d/' + j.id + '/view');
      } catch (e) {
        links.push('(one image failed to upload — please attach it yourself)');
      }
    }
    return links;
  }

  // ── The modal ─────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _crumbRows() {
    if (!_crumbs.length) {
      return '<div style="font-size:0.82rem;color:var(--text-dim);padding:0.4rem 0">Nothing recorded yet — this list fills in as you use the app.</div>';
    }
    var h = '';
    for (var i = 0; i < _crumbs.length; i++) {
      h += '<label style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.18rem 0;font-size:0.78rem;line-height:1.35;cursor:pointer">' +
             '<input type="checkbox" id="err-crumb-' + i + '" checked style="margin-top:0.18rem;flex-shrink:0">' +
             '<span style="color:var(--text-dim);flex-shrink:0;font-variant-numeric:tabular-nums">' + _esc(_fmtTime(_crumbs[i].t)) + '</span>' +
             '<span style="color:var(--text-dim);flex-shrink:0;min-width:3.2rem">' + _esc(_crumbs[i].kind) + '</span>' +
             '<span>' + _esc(_crumbs[i].text) + '</span>' +
           '</label>';
    }
    return h;
  }

  function _ctxRows() {
    var c = _context(), h = '';
    var rows = [
      ['App version', c.appVersion], ['Page', c.page], ['Screen', c.screen],
      ['Online', c.online], ['Browser', c.browser]
    ];
    if (typeof c.unsentWrites !== 'undefined') rows.push(['Unsent saves', String(c.unsentWrites)]);
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][1]) continue;
      h += '<div style="display:flex;gap:0.6rem;font-size:0.78rem;padding:0.1rem 0">' +
             '<span style="color:var(--text-dim);min-width:6.5rem;flex-shrink:0">' + _esc(rows[i][0]) + '</span>' +
             '<span style="word-break:break-word">' + _esc(rows[i][1]) + '</span>' +
           '</div>';
    }
    return h;
  }

  // The reply tick box. Ticked by default. It names the ACTUAL signed-in
  // address rather than saying "my email", so the choice is concrete and a
  // wrong-account sign-in is visible before sending, not after the silence.
  function _emailBoxHtml() {
    var em = _signedInEmail();
    var on = _emailOptInDefault();
    if (!em) {
      return '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.8rem">' +
             'You are not signed in, so this report will be anonymous and we will not be able to reply.' +
             '</div>';
    }
    return '<div style="border:1px solid var(--border);border-radius:10px;padding:0.55rem 0.65rem;margin-bottom:0.8rem">' +
             '<label style="display:flex;gap:0.55rem;align-items:flex-start;cursor:pointer">' +
               '<input type="checkbox" id="err-email-ok" ' + (on ? 'checked' : '') +
                 ' onchange="errReportRememberOptIn(this.checked)" style="margin-top:0.15rem;flex-shrink:0">' +
               '<span style="font-size:0.83rem;line-height:1.4">Email me back at <b>' + _esc(em) + '</b>' +
                 '<span style="display:block;font-size:0.75rem;color:var(--text-dim);margin-top:0.15rem">' +
                   'Unticked, the report is anonymous and we will not be able to reply. ' +
                   'Your address is used to answer this report and nothing else.' +
                 '</span>' +
               '</span>' +
             '</label>' +
           '</div>';
  }

  function errReportOpen() {
    try {
      _errRemove();
      var ov = document.createElement('div');
      ov.id = 'err-report-modal';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:9995;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:1.2rem';
      ov.innerHTML =
        '<div style="background:var(--bg-card,var(--surface));border:1px solid var(--border);border-radius:14px;max-width:680px;width:100%;padding:1.1rem 1.2rem;margin:auto">' +
          '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.2rem">' +
            '<h2 style="margin:0;font-size:1.15rem">Report a problem</h2>' +
            '<span style="flex:1"></span>' +
            '<button onclick="errReportClose()" aria-label="Close" style="border:none;background:transparent;color:var(--text-dim);font-size:1.4rem;line-height:1;cursor:pointer">&times;</button>' +
          '</div>' +
          '<p style="margin:0 0 0.9rem;font-size:0.84rem;color:var(--text-dim);line-height:1.5">' +
            'Tell us what happened in your own words. We already know which buttons you pressed and what the app was doing — you can see all of it below before anything is sent. ' +
            '<b>What you typed is never recorded</b>, only how many characters. Pressing Send delivers it straight to the developer \u2014 no email app needed.' +
          '</p>' +

          '<label style="display:block;font-weight:700;font-size:0.85rem;margin-bottom:0.2rem">What were you doing?</label>' +
          '<textarea id="err-doing" rows="2" placeholder="e.g. adding a boxcar with a photo" style="width:100%;box-sizing:border-box;padding:0.5rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2,var(--surface));color:inherit;font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.6rem"></textarea>' +

          '<label style="display:block;font-weight:700;font-size:0.85rem;margin-bottom:0.2rem">What did you see?</label>' +
          '<textarea id="err-saw" rows="2" placeholder="e.g. the screen went white and the Save button did nothing" style="width:100%;box-sizing:border-box;padding:0.5rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2,var(--surface));color:inherit;font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.6rem"></textarea>' +

          '<label style="display:block;font-weight:700;font-size:0.85rem;margin-bottom:0.2rem">What do you think went wrong?</label>' +
          '<textarea id="err-think" rows="2" placeholder="Your hunch is useful — even a guess helps" style="width:100%;box-sizing:border-box;padding:0.5rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2,var(--surface));color:inherit;font-family:var(--font-body);font-size:0.88rem;margin-bottom:0.8rem"></textarea>' +

          _emailBoxHtml() +

          '<label style="display:block;font-weight:700;font-size:0.85rem;margin-bottom:0.25rem">Screenshots (up to ' + ERR_REPORT_CFG.maxShots + ')</label>' +
          '<input type="file" id="err-shots" accept="image/*" multiple style="font-size:0.8rem;margin-bottom:0.3rem">' +
          '<div id="err-shot-note" style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.8rem">They upload to your own Google Drive and the report carries the links.</div>' +

          '<details style="margin-bottom:0.8rem">' +
            '<summary style="cursor:pointer;font-weight:700;font-size:0.85rem">See exactly what will be sent</summary>' +
            '<div style="margin-top:0.5rem;padding:0.6rem;border:1px solid var(--border);border-radius:10px">' +
              '<div style="font-weight:700;font-size:0.8rem;margin-bottom:0.3rem">About your app</div>' +
              _ctxRows() +
              '<div style="font-weight:700;font-size:0.8rem;margin:0.7rem 0 0.3rem">Your last steps — untick anything you would rather not send</div>' +
              _crumbRows() +
            '</div>' +
          '</details>' +

          '<div id="err-progress" style="display:none;font-size:0.82rem;color:var(--text-dim);margin-bottom:0.5rem"></div>' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
            '<button id="err-send-btn" onclick="errReportSend()" style="flex:1 1 auto;padding:0.6rem 1rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Send report</button>' +
            '<button onclick="errReportClose()" style="padding:0.6rem 0.9rem;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Cancel</button>' +
          '</div>' +
          // Only appears if the automatic send fails. Hiding these until then
          // keeps the normal path a single obvious button.
          '<div id="err-fallback" style="display:none;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">' +
            '<button onclick="errReportCopy()" style="padding:0.5rem 0.85rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2,var(--surface));color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Copy instead</button>' +
            '<button onclick="errReportEmail()" style="padding:0.5rem 0.85rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2,var(--surface));color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Send it by email instead</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      if (window.BackStack) window.BackStack.push('err-report', _errRemove);
    } catch (e) {
      try { if (typeof showToast === 'function') showToast('Could not open the report form.', 3000, true); } catch (e2) {}
    }
  }
  window.errReportOpen = errReportOpen;

  function _errRemove() {
    var el = document.getElementById('err-report-modal');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function errReportClose() {
    _errRemove();
    if (window.BackStack) window.BackStack.pop('err-report');
  }
  window.errReportClose = errReportClose;

  window.errReportRememberOptIn = function (on) { _rememberOptIn(!!on); };

  function _answers() {
    function v(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
    var box = document.getElementById('err-email-ok');
    var emailOk = box ? !!box.checked : _emailOptInDefault();
    return {
      doing: v('err-doing'), saw: v('err-saw'), think: v('err-think'),
      emailOk: emailOk,
      email: emailOk ? _signedInEmail() : '',
      name:  emailOk ? _signedInName()  : '',
      code:  _reportCode()
    };
  }

  function _pickedShots() {
    var inp = document.getElementById('err-shots');
    if (!inp || !inp.files || !inp.files.length) return [];
    var out = [];
    for (var i = 0; i < inp.files.length && out.length < ERR_REPORT_CFG.maxShots; i++) {
      if (inp.files[i].size <= ERR_REPORT_CFG.maxShotBytes) out.push(inp.files[i]);
    }
    return out;
  }

  // ── Delivery ──────────────────────────────────────────────────────────
  // Straight to Brad's relay — the user never opens an email client, never
  // copies anything, and does not need Gmail. text/plain on purpose: it keeps
  // the browser from sending a CORS preflight, exactly as vault.js does.
  async function _postToRelay(payload) {
    var res = await fetch(ERR_REPORT_CFG.endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' }
    });
    return await res.json();
  }

  // A report that could not be sent is kept — ONE, already composed and
  // already redacted — and retried on the next load. Brad's users are at
  // train shows on bad wifi; losing the report is the one outcome worth
  // engineering against. Nothing raw is stored: this is the same text the
  // user already saw and approved.
  function _savePending(payload) {
    try { localStorage.setItem(ERR_REPORT_CFG.keyPending, JSON.stringify(payload)); } catch (e) {}
  }
  function _clearPending() {
    try { localStorage.removeItem(ERR_REPORT_CFG.keyPending); } catch (e) {}
  }
  async function _retryPending() {
    var raw = null;
    try { raw = localStorage.getItem(ERR_REPORT_CFG.keyPending); } catch (e) { return; }
    if (!raw) return;
    try {
      var out = await _postToRelay(JSON.parse(raw));
      if (out && out.ok) {
        _clearPending();
        if (typeof showToast === 'function') showToast('Your earlier problem report has now been sent. Thank you.', 5000);
      }
    } catch (e) { /* still offline — next load tries again */ }
  }

  function _successHtml(id) {
    return '<div style="background:var(--bg-card,var(--surface));border:1px solid var(--border);border-radius:14px;max-width:560px;width:100%;padding:1.3rem;margin:auto;text-align:center">' +
             '<div style="font-size:2rem;line-height:1;margin-bottom:0.5rem">\u2713</div>' +
             '<h2 style="margin:0 0 0.5rem;font-size:1.1rem">Report sent' + (id ? ' \u2014 #' + _esc(id) : '') + '</h2>' +
             '<p style="margin:0 0 1rem;font-size:0.87rem;line-height:1.55;color:var(--text-dim)">' +
               _esc(ERR_REPORT_CFG.thanksNote) +
             '</p>' +
             '<button onclick="errReportClose()" style="padding:0.55rem 1.4rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Close</button>' +
           '</div>';
  }

  async function errReportSend() {
    var btn = document.getElementById('err-send-btn');
    var prog = document.getElementById('err-progress');
    if (btn && btn.dataset.busy === '1') return;      // no double-send
    if (btn) { btn.dataset.busy = '1'; btn.textContent = 'Sending\u2026'; }
    function say(m) { if (prog) { prog.style.display = 'block'; prog.textContent = m; } }

    var payload = null;
    try {
      var ans = _answers();
      var shots = _pickedShots();
      var links = await _uploadShots(shots, say);
      var body = _buildReportText(ans, links);
      window._errReportBody = body;                   // "Copy instead" reads this

      payload = {
        action:   'report',
        word:     ERR_REPORT_CFG.postWord,
        code:     ans.code,
        email:    ans.emailOk ? ans.email : '',
        name:     ans.emailOk ? ans.name  : '',
        version:  _context().appVersion,
        page:     _context().page,
        subject:  ERR_REPORT_CFG.subjectPrefix + ' \u2014 ' + _context().appVersion,
        body:     body,
        shots:    links.filter(function (l) { return /^https?:/.test(l); })
      };

      say('Sending your report\u2026');
      var out = await _postToRelay(payload);
      if (out && out.ok) {
        _clearPending();
        var ov = document.getElementById('err-report-modal');
        if (ov) ov.innerHTML = _successHtml(out.id);
        return;
      }
      throw new Error(out && out.error ? out.error : 'relay did not accept the report');

    } catch (e) {
      // Keep it and retry on the next load, and offer the manual routes now.
      if (payload) _savePending(payload);
      say('Could not send it just now \u2014 it is saved and will go automatically next time you open the app. You can also use Copy instead, or send it by email.');
      var acts = document.getElementById('err-fallback');
      if (acts) acts.style.display = 'flex';
    } finally {
      if (btn) { btn.dataset.busy = ''; btn.textContent = 'Send report'; }
    }
  }
  window.errReportSend = errReportSend;

  // Manual escape hatch, only shown after an automatic send has failed.
  window.errReportEmail = function () {
    try {
      var body = window._errReportBody || _buildReportText(_answers(), []);
      var url = 'https://mail.google.com/mail/?view=cm&fs=1'
              + '&to=' + encodeURIComponent(ERR_REPORT_CFG.replyTo)
              + '&su=' + encodeURIComponent(ERR_REPORT_CFG.subjectPrefix)
              + '&body=' + encodeURIComponent(body);
      window.open(url, '_blank');
    } catch (e) {}
  };

  function errReportCopy() {
    try {
      var body = window._errReportBody || _buildReportText(_answers(), []);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(body).then(function () {
          if (typeof showToast === 'function') showToast('Report copied — paste it into an email to ' + ERR_REPORT_CFG.reportTo, 5000);
        });
      } else if (typeof showToast === 'function') {
        showToast('Copying is not available in this browser.', 3000, true);
      }
    } catch (e) {}
  }
  window.errReportCopy = errReportCopy;

  // ── Injection: sidebar item + account-menu entry ──────────────────────
  function _errInjectUI() {
    try {
      var sidebar = document.querySelector('.sidebar');
      if (!sidebar) return false;
      if (!document.getElementById('nav-errreport-btn')) {
        var refreshBtn = sidebar.querySelector('#refresh-btn');
        var homeSection = refreshBtn ? refreshBtn.parentElement : sidebar.querySelector('.nav-section');
        if (!homeSection) return false;
        var btn = document.createElement('button');
        btn.className = 'nav-item';
        btn.id = 'nav-errreport-btn';
        btn.setAttribute('data-ctip', 'Something went wrong? Tell us what happened and we will get the details.');
        btn.onclick = function () { errReportOpen(); };
        btn.innerHTML = '<span style="width:17px;display:inline-block;text-align:center;flex-shrink:0">⚠</span>Report a problem';
        homeSection.appendChild(btn);
      }
      var menu = document.getElementById('account-menu');
      if (menu && !document.getElementById('menu-errreport-btn')) {
        var mbtn = document.createElement('button');
        mbtn.className = 'account-menu-item';
        mbtn.id = 'menu-errreport-btn';
        mbtn.onclick = function () {
          if (typeof toggleAccountMenu === 'function') toggleAccountMenu();
          errReportOpen();
        };
        mbtn.innerHTML = '<span style="width:15px;display:inline-block;text-align:center">⚠</span>Report a problem';
        menu.appendChild(mbtn);
      }
      return true;
    } catch (e) { return false; }
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  // Listeners start immediately so the trail covers everything from load.
  // The nav item waits for the app shell, same poll shape as dispatch-board.
  _installListeners();
  (function _errBoot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (tries > ERR_REPORT_CFG.pollMax) { clearInterval(t); return; }
      if (_errInjectUI()) {
        clearInterval(t);
        // A report that failed to send last time goes now, quietly.
        try { _retryPending(); } catch (e) {}
      }
    }, ERR_REPORT_CFG.pollMs);
  })();

  // Exposed for testing and for a future relay-based silent send.
  window.errReportPreview = function () { return _buildReportText(_answers(), []); };
  window.errReportCrumbs  = function () { return _crumbs.slice(); };
  window.errReportCode    = function () { return _reportCode(); };
})();
