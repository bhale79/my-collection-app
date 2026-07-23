// ══════════════════════════════════════════════════════════════
//  dispatch-board.js — The Dispatch Board (Session 174)
//
//  Station announcements + release notes, driven by an
//  "Announcements" tab on the master Google Sheet. Brad posts by
//  adding a row to the sheet — no deploy needed.
//
//  SELF-CONTAINED FEATURE: this file injects its own sidebar nav
//  item, account-menu entry (mobile reach), page div, popup, and
//  badge. Delete the ONE script line in index.html to remove the
//  entire feature. Nothing else in the app references it.
//
//  Sheet tab layout (master sheet, tab "Announcements"):
//    A: ID       — stable unique id, never reused (e.g. A001, R974)
//    B: Date     — post date
//    C: Type     — "News" or "Release"
//    D: Version  — app version for Release rows (e.g. v0.9.974)
//    E: Title    — short headline
//    F: Message  — body text (plain text; blank line = paragraph)
//    G: Expires  — optional; after this date: no popup, no badge,
//                  still listed on the board as a past announcement
//
//  Fail-silent: if the tab is missing or the fetch errors, the app
//  behaves exactly as before — no popup, no badge, board shows the
//  last cached announcements (or a friendly empty state).
// ══════════════════════════════════════════════════════════════

// ── CONFIG — single source of truth for this feature ────────────
var DISPATCH_CFG = {
  tabName: 'Announcements',
  range: 'Announcements!A2:G500',
  seenKey: 'lv_dispatch_seen',          // JSON array of seen IDs
  cacheKey: 'lv_dispatch_cache',        // JSON {ts, rows} offline copy
  iconLg: 'img/dispatch-board-192.png', // popup
  iconBg: 'img/dispatch-board-512.png', // board page full-page backdrop
  iconSm: 'img/dispatch-board-64.png',  // sidebar + account menu
  pollMs: 2000,                         // boot-readiness poll interval
  pollMax: 150                          // ≈5 min, then give up silently
};

var _dbItems = null;      // parsed announcements (newest first)
var _dbPopupShown = false; // one popup per app open, max

// ── Helpers ─────────────────────────────────────────────────────
function _dbEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Sheets UNFORMATTED_VALUE returns real dates as serial numbers
// (days since 1899-12-30). Accept those, ISO strings, or US dates.
function _dbParseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
  }
  var d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function _dbFmtDate(d) {
  if (!d) return '';
  try {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch (e) { return ''; }
}

function _dbSeen() {
  try { return JSON.parse(localStorage.getItem(DISPATCH_CFG.seenKey) || '[]'); }
  catch (e) { return []; }
}

function _dbMarkSeen(ids) {
  try {
    var seen = _dbSeen();
    ids.forEach(function (id) { if (seen.indexOf(id) < 0) seen.push(id); });
    localStorage.setItem(DISPATCH_CFG.seenKey, JSON.stringify(seen));
  } catch (e) {}
}

function _dbIsExpired(item) {
  return !!(item.expires && item.expires.getTime() < Date.now() - 86400000);
}

function _dbUnseen() {
  if (!_dbItems) return [];
  var seen = _dbSeen();
  return _dbItems.filter(function (it) {
    return seen.indexOf(it.id) < 0 && !_dbIsExpired(it);
  });
}

// Body text: escape first, then paragraphs on blank lines / breaks.
function _dbBodyHtml(msg) {
  var esc = _dbEsc(msg);
  return esc.split(/\n\s*\n/).map(function (p) {
    return '<p style="margin:0 0 0.6em">' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

// ── Parse sheet rows → items ────────────────────────────────────
function _dbParseRows(rows) {
  var items = [];
  (rows || []).forEach(function (r) {
    if (!r || !r[0]) return;                    // no ID → skip row
    var title = r[4] != null ? String(r[4]) : '';
    var msg = r[5] != null ? String(r[5]) : '';
    if (!title && !msg) return;
    items.push({
      id: String(r[0]).trim(),
      date: _dbParseDate(r[1]),
      type: /^r/i.test(String(r[2] || '')) ? 'Release' : 'News',
      version: r[3] != null ? String(r[3]).trim() : '',
      title: title,
      message: msg,
      expires: _dbParseDate(r[6])
    });
  });
  items.sort(function (a, b) {
    var ta = a.date ? a.date.getTime() : 0, tb = b.date ? b.date.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });
  return items;
}

// ── Fetch (fail-silent, with offline cache) ─────────────────────
async function dbFetchAnnouncements() {
  try {
    var resp = await sheetsGet(state.masterSheetId, DISPATCH_CFG.range);
    var rows = (resp && resp.values) || [];
    _dbItems = _dbParseRows(rows);
    try {
      localStorage.setItem(DISPATCH_CFG.cacheKey,
        JSON.stringify({ ts: Date.now(), rows: rows }));
    } catch (e) {}
  } catch (e) {
    console.log('Dispatch Board: fetch skipped (' + (e && e.message) + ')');
    _dbLoadFromCache();
  }
  _dbUpdateBadge();
  _dbMaybePopup();
}

function _dbLoadFromCache() {
  try {
    var c = JSON.parse(localStorage.getItem(DISPATCH_CFG.cacheKey) || 'null');
    if (c && c.rows) _dbItems = _dbParseRows(c.rows);
  } catch (e) {}
}

// ── Badge ───────────────────────────────────────────────────────
function _dbUpdateBadge() {
  var n = _dbUnseen().length;
  ['nav-dispatch-badge', 'menu-dispatch-badge'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = n;
    el.style.display = n > 0 ? '' : 'none';
  });
}

// ── Popup — newest unseen announcement, once per app open ───────
function _dbMaybePopup() {
  if (_dbPopupShown) return;
  var unseen = _dbUnseen();
  if (!unseen.length) return;
  // Don't fight the welcome card / onboarding for attention.
  if (document.getElementById('rr-welcome-card') ||
      document.getElementById('onboarding-overlay') ||
      document.getElementById('onboarding-map-overlay')) {
    setTimeout(_dbMaybePopup, 15000);
    return;
  }
  _dbPopupShown = true;
  var it = unseen[0];
  var more = unseen.length - 1;
  var ov = document.createElement('div');
  ov.id = 'db-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
  ov.innerHTML =
    '<div style="background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;max-width:460px;width:100%;padding:20px 22px 18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif);max-height:calc(100vh - 36px);overflow-y:auto;-webkit-overflow-scrolling:touch;margin:auto 0;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
    + '<div style="text-align:center;margin-bottom:10px"><img src="' + DISPATCH_CFG.iconLg + '" alt="" style="width:110px;height:110px;display:inline-block"></div>'
    + '<div style="text-align:center;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold,#d4a843);margin-bottom:4px">Incoming from the Dispatch Board</div>'
    + '<div style="font-family:var(--font-head,sans-serif);font-size:1.25rem;text-align:center;font-weight:700;margin-bottom:4px">' + _dbEsc(it.title) + '</div>'
    + '<div style="text-align:center;font-size:0.76rem;color:var(--text-dim,#888);margin-bottom:12px">'
    +   _dbEsc(_dbFmtDate(it.date))
    +   (it.type === 'Release' && it.version ? ' &nbsp;·&nbsp; <span style="background:rgba(212,168,67,0.18);border:1px solid rgba(212,168,67,0.5);color:var(--gold,#d4a843);border-radius:999px;padding:0.1rem 0.55rem;font-weight:700">What’s new in ' + _dbEsc(it.version) + '</span>' : '')
    + '</div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid,#ccc);line-height:1.55;margin-bottom:14px">' + _dbBodyHtml(it.message) + '</div>'
    + (more > 0 ? '<div style="font-size:0.78rem;color:var(--text-dim,#888);text-align:center;margin-bottom:12px">' + more + ' more announcement' + (more > 1 ? 's' : '') + ' waiting on the board.</div>' : '')
    + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">'
    +   '<button id="db-popup-open" style="padding:0.65rem 1.2rem;border-radius:9px;border:1px solid var(--border,#444);background:var(--surface2,#242440);color:var(--text,#eee);font-weight:600;font-family:inherit;font-size:0.9rem;cursor:pointer">Open Dispatch Board</button>'
    +   '<button id="db-popup-ok" style="padding:0.65rem 1.6rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;font-family:inherit;font-size:0.9rem;cursor:pointer">Got it</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);
  document.getElementById('db-popup-ok').onclick = function () {
    _dbMarkSeen([it.id]); _dbUpdateBadge(); ov.remove();
  };
  document.getElementById('db-popup-open').onclick = function () {
    _dbMarkSeen([it.id]); ov.remove();
    var btn = document.getElementById('nav-dispatch-btn');
    showPage('dispatch', btn && btn.offsetParent ? btn : null);
    dbBuildPage();
  };
}

// ── The Dispatch Board page ─────────────────────────────────────
function dbBuildPage() {
  var page = document.getElementById('page-dispatch');
  if (!page) return;
  if (_dbItems === null) _dbLoadFromCache();
  var items = _dbItems || [];
  // Visiting the board reads everything — clear the badge.
  _dbMarkSeen(items.map(function (i) { return i.id; }));
  _dbUpdateBadge();

  var html =
    '<div style="margin-bottom:0.35rem">'
    +   '<div class="page-title" style="margin:0">The Dispatch Board</div>'
    +   '<div style="font-size:0.85rem;color:var(--text-dim,#888)">Station announcements &amp; what’s new in The Rail Roster.</div>'
    + '</div>';

  if (!items.length) {
    html += '<div style="background:var(--surface2,#222);border:1px solid var(--border,#333);border-radius:12px;padding:1.6rem;text-align:center;color:var(--text-dim,#888);font-size:0.9rem;margin-top:1rem">All quiet at the station — no announcements posted yet. Check back soon!</div>';
  } else {
    items.forEach(function (it) {
      var expired = _dbIsExpired(it);
      html +=
        '<div style="background:var(--surface2,#1e2438);border:1px solid var(--border,#333);border-left:4px solid ' + (it.type === 'Release' ? 'var(--gold,#d4a843)' : 'var(--accent,#e04028)') + ';border-radius:11px;padding:0.95rem 1.15rem;margin-top:0.85rem;' + (expired ? 'opacity:0.55' : '') + '">'
        + '<div style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.25rem">'
        +   '<span style="font-family:var(--font-head,sans-serif);font-size:1.05rem;font-weight:700;color:var(--text,#eee)">' + _dbEsc(it.title) + '</span>'
        +   (it.type === 'Release'
              ? '<span style="background:rgba(212,168,67,0.18);border:1px solid rgba(212,168,67,0.5);color:var(--gold,#d4a843);border-radius:999px;padding:0.08rem 0.55rem;font-size:0.68rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Release' + (it.version ? ' ' + _dbEsc(it.version) : '') + '</span>'
              : '<span style="background:rgba(224,64,40,0.15);border:1px solid rgba(224,64,40,0.45);color:#e88;border-radius:999px;padding:0.08rem 0.55rem;font-size:0.68rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">News</span>')
        +   (expired ? '<span style="font-size:0.68rem;color:var(--text-dim,#888);letter-spacing:0.05em;text-transform:uppercase">Departed</span>' : '')
        +   '<span style="margin-left:auto;font-size:0.74rem;color:var(--text-dim,#888)">' + _dbEsc(_dbFmtDate(it.date)) + '</span>'
        + '</div>'
        + '<div style="font-size:0.86rem;color:var(--text-mid,#ccc);line-height:1.55">' + _dbBodyHtml(it.message) + '</div>'
        + '</div>';
    });
  }
  // Full-page backdrop: the board artwork as a big centered watermark
  // behind the cards (absolute layer, pointer-events off, content above).
  page.style.position = 'relative';
  page.innerHTML =
    '<div style="position:absolute;inset:0;background:url(' + DISPATCH_CFG.iconBg + ') center center / min(92%, 640px) no-repeat;opacity:0.3;pointer-events:none"></div>'
    + '<div style="position:relative">' + html + '</div>';
}

// ── Injection: page div, sidebar item, account-menu item ────────
function _dbInjectUI() {
  // Page div (showPage needs it to exist)
  if (!document.getElementById('page-dispatch')) {
    var main = document.getElementById('main-content');
    if (!main) return false;
    var pg = document.createElement('div');
    pg.className = 'page';
    pg.id = 'page-dispatch';
    main.appendChild(pg);
  }
  // Sidebar item — bottom section, directly above "Sync from Sheet"
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return false;
  if (!document.getElementById('nav-dispatch-btn')) {
    var refreshBtn = sidebar.querySelector('#refresh-btn');
    var homeSection = refreshBtn ? refreshBtn.parentElement : sidebar.querySelector('.nav-section');
    if (!homeSection) return false;
    var btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.id = 'nav-dispatch-btn';
    btn.setAttribute('data-ctip', 'Station announcements and what’s new in the app.');
    btn.onclick = function () { showPage('dispatch', this); dbBuildPage(); };
    btn.innerHTML =
      '<img src="' + DISPATCH_CFG.iconSm + '" alt="" style="width:17px;height:17px;border-radius:50%;flex-shrink:0">'
      + 'Dispatch Board'
      + '<span class="nav-badge" id="nav-dispatch-badge" style="display:none;background:var(--accent,#e04028);color:#fff">0</span>';
    if (refreshBtn) homeSection.insertBefore(btn, refreshBtn);
    else homeSection.appendChild(btn);
  }
  // Account menu entry (reachable on mobile, where the sidebar hides)
  var menu = document.getElementById('account-menu');
  if (menu && !document.getElementById('menu-dispatch-btn')) {
    var mbtn = document.createElement('button');
    mbtn.className = 'account-menu-item';
    mbtn.id = 'menu-dispatch-btn';
    mbtn.onclick = function () {
      if (typeof toggleAccountMenu === 'function') toggleAccountMenu();
      var nb = document.getElementById('nav-dispatch-btn');
      showPage('dispatch', nb && nb.offsetParent ? nb : null);
      dbBuildPage();
    };
    mbtn.innerHTML =
      '<img src="' + DISPATCH_CFG.iconSm + '" alt="" style="width:15px;height:15px;border-radius:50%">'
      + 'Dispatch Board'
      + '<span id="menu-dispatch-badge" style="display:none;margin-left:auto;background:var(--accent,#e04028);color:#fff;border-radius:999px;font-size:0.68rem;font-weight:700;padding:0.05rem 0.45rem">0</span>';
    var firstItem = menu.querySelector('.account-menu-item');
    if (firstItem) menu.insertBefore(mbtn, firstItem);
    else menu.appendChild(mbtn);
  }
  return true;
}

// ── Boot: wait for the app shell + a signed-in session ──────────
(function _dbBoot() {
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    if (tries > DISPATCH_CFG.pollMax) { clearInterval(t); return; }
    var appEl = document.getElementById('app');
    var shellReady = _dbInjectUI();
    var appActive = appEl && appEl.classList.contains('active');
    var dataReady = shellReady && appActive
      && typeof sheetsGet === 'function'
      && window.state && state.masterSheetId;
    if (dataReady) {
      clearInterval(t);
      dbFetchAnnouncements();
    }
  }, DISPATCH_CFG.pollMs);
})();
