// ═══════════════════════════════════════════════════════════════
// show-mode.js — 🎪 Show Mode (Phase 1) — v0.9.760
//
// SELF-CONTAINED & REMOVABLE (Brad: "keep it where we can take it out"):
//   • This file is the ENTIRE feature. To remove Show Mode, delete the
//     <script src="show-mode.js"> tag from index.html and bump versions.
//   • No schema changes. Sessions/recaps live in localStorage only
//     (lv_show_session / lv_show_history). Quick grabs are ordinary
//     Quick Entry rows (existing ⚡ machinery). Adds/sales are attributed
//     to a show by DATE at recap time — nothing extra written to the sheet.
//   • Touches other modules only by CALLING public entry points
//     (openResearch, openWizard, _researchLookupTyped, goToMyCollection)
//     and by injecting its dashboard button after buildDashboard.
//
// Phase 1: kiosk overlay, show session + recap, Research handoff,
//          The Hunt (folded want list), Quick Grab, needs-details chip.
// Phase 2 (planned): Selling + Trades.  Phase 3: Dealers, table marking,
//          floor-plan pins.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SESSION_KEY = 'lv_show_session';
  var HISTORY_KEY = 'lv_show_history';

  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _todayISO() { try { return new Date().toLocaleDateString('en-CA'); } catch (e) { return ''; } }
  function _session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function _saveSession(s) {
    try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function _history() {
    try { var a = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  function _needsDetailsCount() {
    try {
      return Object.values(state.personalData || {}).filter(function (p) { return p && p.owned && p.quickEntry; }).length;
    } catch (e) { return 0; }
  }

  function _kill() {
    var el = document.getElementById('sm-overlay');
    if (el) el.remove();
    var pill = document.getElementById('sm-return-pill');
    if (pill) pill.remove();
    document.body.style.overflow = '';
  }
  window._smExit = _kill;

  function _handoff(run) {
    var ov = document.getElementById('sm-overlay');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    var old = document.getElementById('sm-return-pill');
    if (old) old.remove();
    var pill = document.createElement('button');
    pill.id = 'sm-return-pill';
    pill.textContent = '🎪 Back to Show Mode';
    pill.style.cssText = 'position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);z-index:8000;padding:0.7rem 1.3rem;border-radius:999px;border:none;background:#8b5cf6;color:#fff;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,0.45);font-family:var(--font-body,sans-serif)';
    pill.onclick = function () {
      pill.remove();
      var o = document.getElementById('sm-overlay');
      if (o) { o.style.display = 'flex'; document.body.style.overflow = 'hidden'; _render(); }
      else window.openShowMode();
    };
    document.body.appendChild(pill);
    try { run(); } catch (e) { console.warn('[show-mode handoff]', e); }
  }

  window.openShowMode = function () {
    _kill();
    var ov = document.createElement('div');
    ov.id = 'sm-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:7500;background:var(--bg,#10131f);display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    if (window.BackStack) window.BackStack.push('show-mode', _kill);
    _render();
  };

  function _render() {
    var ov = document.getElementById('sm-overlay');
    if (!ov) return;
    var s = _session();
    ov.innerHTML = s ? _activeHtml(s) : _startHtml();
    _wire(ov, s);
  }

  function _startHtml() {
    var hist = _history().slice(-5).reverse();
    var nd = _needsDetailsCount();
    return '<div style="max-width:520px;width:100%;margin:0 auto;padding:1.25rem;box-sizing:border-box">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">'
      +   '<div style="font-family:var(--font-head,sans-serif);font-size:1.4rem;color:var(--text,#fff)">🎪 Show Mode</div>'
      +   '<button onclick="_smExit()" style="padding:0.5rem 1rem;border-radius:9px;border:1.5px solid var(--border,#333);background:var(--surface2,#26262e);color:var(--text-mid,#aaa);cursor:pointer;font-family:var(--font-body,sans-serif)">✕ Exit</button>'
      + '</div>'
      + '<div style="font-size:0.9rem;color:var(--text-mid,#aaa);margin-bottom:1rem;line-height:1.5">Start a session and everything you add, find, or sell today rolls into a recap when you leave.</div>'
      + '<input id="sm-name" type="text" placeholder="Show name — e.g. York, October 2026" style="width:100%;box-sizing:border-box;padding:0.85rem 1rem;border-radius:10px;border:1.5px solid var(--border,#333);background:var(--surface2,#26262e);color:var(--text,#fff);font-size:1rem;font-family:var(--font-body,sans-serif);margin-bottom:0.75rem">'
      + '<button id="sm-start" style="width:100%;padding:1rem;border-radius:10px;border:none;background:#8b5cf6;color:#fff;font-weight:800;font-size:1.05rem;cursor:pointer;font-family:var(--font-body,sans-serif)">Start the Show →</button>'
      + (nd ? '<div style="margin-top:0.9rem;padding:0.7rem 0.9rem;border-radius:9px;border:1.5px solid var(--accent2,#c9922a);background:rgba(201,146,42,0.1);color:var(--accent2,#c9922a);font-size:0.85rem;cursor:pointer" onclick="_smExit();goToMyCollection()">⚡ ' + nd + ' quick grab' + (nd > 1 ? 's' : '') + ' still need details — tap to finish them</div>' : '')
      + (hist.length ? '<div style="margin-top:1.5rem"><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim,#777);margin-bottom:0.5rem">Past shows</div>'
        + hist.map(function (h) {
            return '<div style="padding:0.6rem 0.8rem;border:1px solid var(--border,#333);border-radius:9px;margin-bottom:0.4rem;background:var(--surface,#1c1c22)">'
              + '<div style="font-weight:700;color:var(--text,#eee);font-size:0.9rem">' + _esc(h.name) + ' <span style="color:var(--text-dim,#777);font-weight:400;font-size:0.78rem">' + _esc(h.date) + '</span></div>'
              + '<div style="font-size:0.78rem;color:var(--text-mid,#aaa);margin-top:0.15rem">Added ' + h.adds + ' ($' + Number(h.spend || 0).toLocaleString() + ') · Sold ' + h.sold + ' ($' + Number(h.soldTotal || 0).toLocaleString() + ') · Wants found: ' + h.wantsFound + '</div>'
              + '</div>';
          }).join('') + '</div>' : '')
      + '</div>';
  }

  function _tile(id, emoji, title, sub) {
    return '<button id="' + id + '" style="width:100%;padding:1.1rem 1rem;border-radius:14px;border:1.5px solid var(--border,#333);background:var(--surface,#1c1c22);cursor:pointer;text-align:left;font-family:var(--font-body,sans-serif);display:flex;align-items:center;gap:0.9rem">'
      + '<span style="font-size:1.8rem;flex-shrink:0">' + emoji + '</span>'
      + '<span style="min-width:0"><span style="display:block;font-weight:800;font-size:1.05rem;color:var(--text,#fff)">' + title + '</span>'
      + '<span style="display:block;font-size:0.8rem;color:var(--text-mid,#aaa);margin-top:0.1rem">' + sub + '</span></span>'
      + '</button>';
  }
  function _activeHtml(s) {
    var nd = _needsDetailsCount();
    return '<div style="max-width:520px;width:100%;margin:0 auto;padding:1.25rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.7rem">'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      +   '<div style="min-width:0"><div style="font-family:var(--font-head,sans-serif);font-size:1.25rem;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🎪 ' + _esc(s.name) + '</div>'
      +   '<div style="font-size:0.75rem;color:var(--text-dim,#777)">' + _esc(s.date) + '</div></div>'
      +   '<button onclick="_smExit()" style="padding:0.45rem 0.8rem;border-radius:9px;border:1.5px solid var(--border,#333);background:var(--surface2,#26262e);color:var(--text-mid,#aaa);cursor:pointer;font-family:var(--font-body,sans-serif);flex-shrink:0">✕</button>'
      + '</div>'
      + _tile('sm-research', '🔍', 'Research', 'Is it a good price? Do I own it? Photo, number, or words')
      + _tile('sm-hunt', '⭐', 'The Hunt', 'Your want list with max prices — check them off as you find them')
      + _tile('sm-grab', '🛒', 'Quick Grab', 'Bought something — capture it in 20 seconds, finish at home')
      + _tile('sm-sell', '💰', 'Selling', 'Your For Sale list and record-a-sale')
      + (nd ? '<div style="padding:0.6rem 0.9rem;border-radius:9px;border:1.5px solid var(--accent2,#c9922a);background:rgba(201,146,42,0.1);color:var(--accent2,#c9922a);font-size:0.82rem">⚡ ' + nd + ' quick grab' + (nd > 1 ? 's' : '') + ' waiting for details (finish at home)</div>' : '')
      + '<div id="sm-hunt-list"></div>'
      + '<button id="sm-end" style="margin-top:0.4rem;padding:0.85rem;border-radius:10px;border:1.5px solid var(--accent,#e8401c);background:rgba(232,64,28,0.1);color:var(--accent,#e8401c);font-weight:700;cursor:pointer;font-family:var(--font-body,sans-serif)">🏁 End Show & See Recap</button>'
      + '</div>';
  }

  function _huntRows() {
    try {
      var rows = Object.values(state.wantData || {});
      if (typeof foldWantEntries === 'function') rows = foldWantEntries(rows);
      var pri = { High: 0, Medium: 1, Low: 2 };
      rows.sort(function (a, b) { return (pri[a.priority] || 1) - (pri[b.priority] || 1); });
      return rows;
    } catch (e) { return []; }
  }
  function _renderHunt(ov, s) {
    var host = ov.querySelector('#sm-hunt-list');
    if (!host) return;
    var rows = _huntRows();
    if (!rows.length) { host.innerHTML = ''; return; }
    var found = (s.log || []).filter(function (l) { return l.t === 'found'; }).map(function (l) { return l.num; });
    host.innerHTML = '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim,#777);margin:0.4rem 0">The Hunt — ' + rows.length + ' item' + (rows.length > 1 ? 's' : '') + '</div>'
      + rows.map(function (w) {
          var m = (typeof findMaster === 'function') ? findMaster(w.itemNum, '', w) : null;
          var name = (m && (m.roadName || m.itemType)) || '';
          if (w._wantMates) name += ' 🔗 ' + w._wantMates.join(' + ');
          var price = w._pairPrice || w.expectedPrice || w.maxPrice || '';
          var isFound = found.indexOf(w.itemNum) >= 0;
          return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.7rem;border:1px solid var(--border,#333);border-radius:9px;margin-bottom:0.35rem;background:var(--surface,#1c1c22)' + (isFound ? ';opacity:0.55' : '') + '">'
            + '<div style="flex:1;min-width:0">'
            + '<span style="font-family:var(--font-mono,monospace);font-weight:700;color:var(--accent2,#d4a843)">' + _esc(w.itemNum) + '</span>'
            + (name ? ' <span style="font-size:0.78rem;color:var(--text-mid,#aaa)">' + _esc(name) + '</span>' : '')
            + (price ? '<span style="display:block;font-size:0.75rem;color:#2ecc71">max $' + Number(price).toLocaleString() + (w.priority ? ' · ' + _esc(w.priority) : '') + '</span>' : '')
            + '</div>'
            + '<button data-sm-research="' + _esc(w.itemNum) + '" style="padding:0.4rem 0.55rem;border-radius:7px;border:1px solid #3498db;background:rgba(52,152,219,0.1);color:#3498db;cursor:pointer;font-size:0.78rem">🔍</button>'
            + (isFound
              ? '<span style="font-size:0.78rem;color:#2ecc71;font-weight:700">✓ found</span>'
              : '<button data-sm-found="' + _esc(w.itemNum) + '" style="padding:0.4rem 0.6rem;border-radius:7px;border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-weight:700">Found it</button>')
            + '</div>';
        }).join('');
  }

  function _wire(ov, s) {
    var start = ov.querySelector('#sm-start');
    if (start) start.onclick = function () {
      var name = (ov.querySelector('#sm-name') || {}).value || '';
      name = name.trim() || ('Show ' + _todayISO());
      _saveSession({ name: name, date: _todayISO(), startTs: Date.now(), log: [] });
      _render();
    };
    if (!s) return;
    var r = ov.querySelector('#sm-research');
    if (r) r.onclick = function () { _handoff(function () { if (typeof window.openResearch === 'function') window.openResearch(); }); };
    var g = ov.querySelector('#sm-grab');
    if (g) g.onclick = function () {
      _handoff(function () {
        if (typeof openWizard === 'function') Promise.resolve(openWizard('collection')).then(function () {
          if (typeof showToast === 'function') showToast('Type the number, then tap ⚡ Save Quick Entry — details can wait until home', 4500);
        });
      });
    };
    var sell = ov.querySelector('#sm-sell');
    if (sell) sell.onclick = function () { _handoff(function () { var nav = document.querySelector('.nav-item[onclick*="forsale"]'); if (typeof showPage === 'function') showPage('forsale', nav); }); };
    var end = ov.querySelector('#sm-end');
    if (end) end.onclick = _endShow;
    ov.addEventListener('click', function (e) {
      var rb = e.target.closest && e.target.closest('[data-sm-research]');
      if (rb) { var n = rb.getAttribute('data-sm-research'); _handoff(function () { if (typeof window._researchLookupTyped === 'function') window._researchLookupTyped(n, {}); }); return; }
      var fb = e.target.closest && e.target.closest('[data-sm-found]');
      if (fb) {
        var num = fb.getAttribute('data-sm-found');
        var ses = _session();
        if (ses) { ses.log.push({ t: 'found', num: num, ts: Date.now() }); _saveSession(ses); }
        _handoff(function () {
          if (typeof openWizard === 'function') Promise.resolve(openWizard('collection')).then(function () {
            try { wizard.data.itemNum = num; if (typeof renderWizardStep === 'function') renderWizardStep(); } catch (e2) {}
            if (typeof showToast === 'function') showToast('🎉 Found one! Add it — ⚡ Quick Entry is fine, finish at home', 4500);
          });
        });
      }
    });
    _renderHunt(ov, s);
  }

  function _endShow() {
    var s = _session();
    if (!s) return;
    var adds = 0, spend = 0, sold = 0, soldTotal = 0;
    try {
      Object.values(state.personalData || {}).forEach(function (p) {
        if (!p || !p.owned) return;
        if ((p.dateAdded && p.dateAdded === s.date) || (p._savedAt && p._savedAt >= s.startTs)) {
          adds++; spend += parseFloat(p.priceItem) || 0;
        }
      });
      Object.values(state.soldData || {}).forEach(function (x) {
        if (x && x.dateSold === s.date) { sold++; soldTotal += parseFloat(x.salePrice) || 0; }
      });
    } catch (e) {}
    var wantsFound = (s.log || []).filter(function (l) { return l.t === 'found'; }).length;
    var recap = { name: s.name, date: s.date, adds: adds, spend: spend, sold: sold, soldTotal: soldTotal, wantsFound: wantsFound };
    var hist = _history(); hist.push(recap);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-50))); } catch (e) {}
    _saveSession(null);
    var ov = document.getElementById('sm-overlay');
    if (!ov) return;
    ov.innerHTML = '<div style="max-width:520px;width:100%;margin:0 auto;padding:1.5rem;box-sizing:border-box;text-align:center">'
      + '<div style="font-size:2.2rem;margin-bottom:0.4rem">🏁</div>'
      + '<div style="font-family:var(--font-head,sans-serif);font-size:1.35rem;color:var(--text,#fff);margin-bottom:0.2rem">' + _esc(s.name) + '</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim,#777);margin-bottom:1.25rem">' + _esc(s.date) + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;text-align:left">'
      +   '<div style="padding:0.9rem;border-radius:11px;border:1px solid var(--border,#333);background:var(--surface,#1c1c22)"><div style="font-size:1.5rem;font-weight:800;color:#2ecc71">' + adds + '</div><div style="font-size:0.78rem;color:var(--text-mid,#aaa)">items added · $' + spend.toLocaleString() + ' spent</div></div>'
      +   '<div style="padding:0.9rem;border-radius:11px;border:1px solid var(--border,#333);background:var(--surface,#1c1c22)"><div style="font-size:1.5rem;font-weight:800;color:#e67e22">' + sold + '</div><div style="font-size:0.78rem;color:var(--text-mid,#aaa)">sold · $' + soldTotal.toLocaleString() + ' in</div></div>'
      +   '<div style="padding:0.9rem;border-radius:11px;border:1px solid var(--border,#333);background:var(--surface,#1c1c22)"><div style="font-size:1.5rem;font-weight:800;color:var(--accent2,#d4a843)">' + wantsFound + '</div><div style="font-size:0.78rem;color:var(--text-mid,#aaa)">want-list finds</div></div>'
      +   '<div style="padding:0.9rem;border-radius:11px;border:1px solid var(--border,#333);background:var(--surface,#1c1c22)"><div style="font-size:1.5rem;font-weight:800;color:#8b5cf6">' + _needsDetailsCount() + '</div><div style="font-size:0.78rem;color:var(--text-mid,#aaa)">quick grabs to finish at home</div></div>'
      + '</div>'
      + '<button onclick="_smExit()" style="margin-top:1.25rem;width:100%;padding:1rem;border-radius:10px;border:none;background:#8b5cf6;color:#fff;font-weight:800;font-size:1rem;cursor:pointer;font-family:var(--font-body,sans-serif)">Done — great show 🎉</button>'
      + '</div>';
  }

  function _injectEntry() {
    try {
      // Desktop: joins the quick-action button row.
      var host = document.querySelector('.dash-desktop-actions');
      if (host && !document.getElementById('sm-entry-btn')) {
        var b = document.createElement('button');
        b.id = 'sm-entry-btn';
        b.className = 'btn';
        b.innerHTML = '🎪 SHOW MODE';
        b.style.cssText = 'border:1.5px solid #8b5cf6;color:#8b5cf6;background:rgba(139,92,246,0.08)';
        b.onclick = function () { window.openShowMode(); };
        host.appendChild(b);
      }
      // Phone (v0.9.761): the desktop row is display:none on mobile — Show Mode
      // is a PHONE feature, so it gets its own full-width banner button under
      // the mobile quick-action panels.
      var mhost = document.querySelector('.dash-mobile-actions');
      if (mhost && !document.getElementById('sm-entry-mobile') && mhost.parentElement) {
        var mb = document.createElement('button');
        mb.id = 'sm-entry-mobile';
        mb.innerHTML = '🎪 SHOW MODE — research, hunt & grab on the floor';
        mb.style.cssText = 'width:100%;margin-top:0.45rem;padding:0.8rem;border-radius:9px;border:1.5px solid #8b5cf6;color:#8b5cf6;background:rgba(139,92,246,0.1);font-family:var(--font-body,sans-serif);font-size:0.85rem;font-weight:800;cursor:pointer';
        mb.onclick = function () { window.openShowMode(); };
        mhost.parentElement.insertBefore(mb, mhost.nextSibling);
      }
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    var _hookBD = function () {
      if (typeof window.buildDashboard === 'function' && !window.buildDashboard._smWrapped) {
        var _origBD = window.buildDashboard;
        window.buildDashboard = function () { var r = _origBD.apply(this, arguments); _injectEntry(); return r; };
        window.buildDashboard._smWrapped = true;
      }
    };
    var _tries = 0;
    var _t = setInterval(function () {
      _hookBD(); _injectEntry();
      if ((document.getElementById('sm-entry-btn') && window.buildDashboard && window.buildDashboard._smWrapped) || ++_tries > 30) clearInterval(_t);
    }, 1000);
  }
})();
