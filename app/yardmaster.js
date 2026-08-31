// ══════════════════════════════════════════════════════════════
//  yardmaster.js — The Yardmaster's Office (v0.9.1580, Session 86)
//
//  Brad: "I need something like an admin page that will help me keep
//  track of everything." Decided S86: queues front and center.
//
//  OWNER-ONLY: the nav item and page exist only when the signed-in
//  email is on OWNER_EMAILS below. Everyone else's app is untouched —
//  no nav item, no page div, no fetches.
//
//  SELF-CONTAINED FEATURE (the Dispatch Board pattern): this file
//  injects its own sidebar item, account-menu entry, and page div.
//  Delete the ONE script line in index.html to remove the feature.
//
//  Reads the VAULT sheet directly with the owner's own OAuth token
//  (the vault is not public; owners are editors on it):
//    submissions   — count of rows flagged in_master = no
//    barcode_pairs — count of rows not promoted/rejected
//    chores        — the recurring-maintenance list (relay v3.8 seeds
//                    it; setupV38Chores). Mark done writes ONLY the
//                    last_done cell of that row, nothing else.
//    usage         — anonymous daily opens (relay v3.7 heartbeat)
//  The Monday digest email (relay v3.8) reads the same tabs — one
//  source of truth, two views.
//
//  No hex colors — theme vars only, so the color ratchet stays flat.
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var YM = {
    OWNER_EMAILS: ['bhale@ipd-llc.com', 'support@therailroster.com'],
    VAULT_ID: '1h4LlDPT9SrToNjg450kU71kCo7ago-n6veI-DNB3nPU',
    VAULT_URL: 'https://docs.google.com/spreadsheets/d/1h4LlDPT9SrToNjg450kU71kCo7ago-n6veI-DNB3nPU/edit',
    pollMs: 2000,
    pollMax: 150
  };

  var _ymData = null;   // last fetch result
  var _ymErr = '';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _isOwner() {
    try {
      var em = window.state && state.user && String(state.user.email || '').toLowerCase();
      return !!em && YM.OWNER_EMAILS.indexOf(em) >= 0;
    } catch (e) { return false; }
  }

  // ── Vault reads: one batchGet, owner token ─────────────────────
  function _fetchVault() {
    var ranges = ['submissions!A1:L1000', 'barcode_pairs!A1:I1000', 'chores!A1:D200', 'usage!A1:C400',
                  'crawl_batches!A1:G50', 'crawl_deltas!A1:Q400']
      .map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&');
    return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID
        + '/values:batchGet?' + ranges,
        { headers: { Authorization: 'Bearer ' + window.accessToken } })
      .then(function (r) {
        if (!r.ok) throw new Error('Vault read failed (HTTP ' + r.status + ')');
        return r.json();
      })
      .then(function (j) {
        var v = (j.valueRanges || []).map(function (x) { return x.values || []; });
        return { submissions: v[0], barcodes: v[1], chores: v[2], usage: v[3],
                 crawlBatches: v[4], crawlDeltas: v[5] };
      });
  }

  function _colIdx(rows, name) {
    if (!rows || !rows.length) return -1;
    return rows[0].map(String).indexOf(name);
  }

  function _summarize(d) {
    var out = { subs: 0, pairs: 0, chores: [], usage: [] };
    var im = _colIdx(d.submissions, 'in_master');
    if (im >= 0) d.submissions.slice(1).forEach(function (r) {
      var v = String(r[im] || '').trim().toLowerCase();
      if (v === 'no' || v === 'false') out.subs++;
    });
    var st = _colIdx(d.barcodes, 'status');
    if (st >= 0) d.barcodes.slice(1).forEach(function (r) {
      var v = String(r[st] || '').trim().toLowerCase();
      if (v !== 'promoted' && v !== 'rejected') out.pairs++;
    });
    (d.chores || []).slice(1).forEach(function (r, i) {
      var name = String(r[0] || '').trim();
      if (!name) return;
      var every = Number(r[1]) || 0;
      var raw = r[2];
      var last = raw ? new Date(String(raw)) : null;
      var ok = last && !isNaN(last.getTime());
      var days = ok ? Math.floor((Date.now() - last.getTime()) / 864e5) : null;
      out.chores.push({
        row: i + 2, name: name, every: every, note: String(r[3] || ''),
        last: ok ? last : null,
        due: !ok || (every > 0 && days >= every)
      });
    });
    out.usage = (d.usage || []).slice(1).slice(-7).map(function (r) {
      return { date: String(r[0] || '').slice(0, 10), opens: r[1] || 0, versions: String(r[2] || '') };
    });
    // ── v0.9.1622: the review queue (Task #36's front door) ──────
    // crawl_batches / crawl_deltas are seeded by crawl sessions; the
    // Office is their review surface. Columns found BY HEADER NAME
    // (the house rule) so a future column at the END breaks nothing.
    out.batches = [];
    out.deltas = [];
    var _dcol = {};
    if (d.crawlDeltas && d.crawlDeltas.length) {
      d.crawlDeltas[0].forEach(function (h, i) { _dcol[String(h)] = i; });
      var g = function (r, name) { var i = _dcol[name]; return i == null ? '' : String(r[i] == null ? '' : r[i]); };
      out.deltas = d.crawlDeltas.slice(1).filter(function (r) { return g(r, 'delta_id'); }).map(function (r, i) {
        return {
          sheetRow: i + 2, batch: g(r, 'batch_id'), id: g(r, 'delta_id'), action: g(r, 'action'),
          tab: g(r, 'proposed_tab'), num: g(r, 'item_num'), type: g(r, 'item_type'),
          road: g(r, 'road_name'), desc: g(r, 'description'), gauge: g(r, 'gauge'),
          variation: g(r, 'variation'), years: g(r, 'years'), link: g(r, 'ref_link'),
          msrp: g(r, 'msrp'), flag: g(r, 'flag'), status: g(r, 'status') || 'pending'
        };
      });
    }
    var _bcol = {};
    if (d.crawlBatches && d.crawlBatches.length) {
      d.crawlBatches[0].forEach(function (h, i) { _bcol[String(h)] = i; });
      var gb = function (r, name) { var i = _bcol[name]; return i == null ? '' : String(r[i] == null ? '' : r[i]); };
      out.batches = d.crawlBatches.slice(1).filter(function (r) { return gb(r, 'batch_id'); }).map(function (r) {
        var id = gb(r, 'batch_id');
        var counts = { pending: 0, approved: 0, edited: 0, rejected: 0, deferred: 0 };
        out.deltas.forEach(function (dd) {
          if (dd.batch === id) counts[counts[dd.status] == null ? 'pending' : dd.status]++;
        });
        return { id: id, source: gb(r, 'source'), created: gb(r, 'created'), label: gb(r, 'label'),
                 status: gb(r, 'status'), total: gb(r, 'total'), note: gb(r, 'note'), counts: counts };
      });
    }
    return out;
  }

  // ── Mark a chore done: write TODAY into that row's last_done ───
  window._ymChoreDone = function (row, name) {
    if (!_isOwner()) return;
    var today = new Date().toISOString().slice(0, 10);
    fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID
        + '/values/' + encodeURIComponent('chores!C' + row) + '?valueInputOption=RAW',
        { method: 'PUT',
          headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[today]] }) })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (typeof showToast === 'function') showToast('Chore marked done: ' + name, 2500);
        ymBuildPage(true);
      })
      .catch(function (e) {
        if (typeof showToast === 'function') showToast('Could not mark the chore done — open the Vault sheet and check the chores tab.', 3500, true);
      });
  };

  // ── The page ───────────────────────────────────────────────────
  function _card(title, inner) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1rem 1.15rem;margin-top:0.9rem">'
      + '<div style="font-family:var(--font-head);font-size:1.35rem;font-weight:700;color:var(--text);margin-bottom:0.5rem">' + title + '</div>'
      + inner + '</div>';
  }

  window.ymBuildPage = function (refetch) {
    var page = document.getElementById('page-yardmaster');
    if (!page || !_isOwner()) return;
    var head =
      '<div style="display:flex;align-items:baseline;gap:0.8rem;flex-wrap:wrap">'
      + '<div class="page-title" style="margin:0">The Yardmaster’s Office</div>'
      + '<button onclick="ymBuildPage(true)" style="margin-left:auto;padding:0.35rem 0.9rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">↻ Refresh</button>'
      + '</div>'
      + '<div style="font-size:1.15rem;color:var(--text-dim)">Owner’s console — only you can see this page. The Monday email reads the same ledgers.</div>';

    if (refetch || !_ymData) {
      page.innerHTML = head + '<div style="color:var(--text-dim);padding:1.4rem 0.2rem;font-size:1.2rem">Reading the Vault…</div>';
      _fetchVault().then(function (d) {
        _ymData = _summarize(d); _ymErr = '';
        window.ymBuildPage(false);
      }).catch(function (e) {
        _ymErr = e.message; _ymData = null;
        window.ymBuildPage(false);
      });
      if (refetch) return;
    }

    var html = head;
    if (_ymErr) {
      html += _card('Trouble reaching the Vault',
        '<div style="color:var(--text-mid);font-size:1.1rem">' + _esc(_ymErr)
        + ' — try Refresh, or <a href="' + YM.VAULT_URL + '" target="_blank" rel="noopener" style="color:var(--accent2)">open the Vault sheet</a> directly.</div>');
      page.innerHTML = html;
      return;
    }
    if (!_ymData) { page.innerHTML = html; return; }
    var d = _ymData;

    // 1 — WAITING ON YOU (front and center, Brad's pick)
    var waiting = d.subs + d.pairs;
    html += _card('Waiting on you' + (waiting ? ' — ' + waiting : ''),
      '<div style="display:flex;gap:1.6rem;flex-wrap:wrap;font-size:1.2rem;color:var(--text-mid)">'
      + '<div><span style="font-size:1.9rem;font-weight:700;color:' + (d.subs ? 'var(--accent)' : 'var(--text-dim)') + '">' + d.subs + '</span> community submissions not in master</div>'
      + '<div><span style="font-size:1.9rem;font-weight:700;color:' + (d.pairs ? 'var(--accent)' : 'var(--text-dim)') + '">' + d.pairs + '</span> barcode pairings awaiting promotion</div>'
      + '</div>'
      + '<div style="margin-top:0.6rem;font-size:1.05rem"><a href="' + YM.VAULT_URL + '" target="_blank" rel="noopener" style="color:var(--accent2)">Review them in the Vault →</a>'
      + ' <span style="color:var(--text-dim)">(submission/barcode verdicts join the queue below in a coming release)</span></div>');

    // 1b — CATALOG REVIEW QUEUE (v0.9.1622, Task #36's front door)
    var open = d.batches.filter(function (b) { return b.status !== 'committed' && b.status !== 'dismissed'; });
    var brows = open.map(function (b) {
      var c = b.counts, done = c.approved + c.edited + c.rejected;
      return '<div style="display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap;padding:0.5rem 0;border-top:1px solid var(--border)">'
        + '<div style="flex:1;min-width:220px"><div style="font-weight:700;color:var(--text);font-size:1.15rem">' + _esc(b.label) + '</div>'
        + '<div style="font-size:0.98rem;color:var(--text-dim)">' + _esc(b.created) + ' · ' + _esc(b.note) + '</div></div>'
        + '<div style="font-size:1.05rem;color:var(--text-mid);white-space:nowrap">'
        + '<span style="font-weight:700;color:' + (c.pending ? 'var(--accent)' : 'var(--text-dim)') + '">' + c.pending + '</span> pending'
        + (done ? ' · ' + done + ' decided' : '') + (c.deferred ? ' · ' + c.deferred + ' deferred' : '') + '</div>'
        + '<button onclick="_ymBatchOpen(\'' + _esc(b.id) + '\')" style="padding:0.35rem 0.95rem;border-radius:8px;border:1px solid var(--accent2);'
        + 'background:var(--surface2);color:var(--accent2);font-family:var(--font-body);font-weight:700;cursor:pointer">Review →</button>'
        + '</div>';
    }).join('');
    html += _card('Catalog review queue' + (open.length ? '' : ' — empty'),
      open.length
        ? brows + '<div style="margin-top:0.5rem;font-size:0.95rem;color:var(--text-dim)">Read-only for now — approve/reject verdicts arrive in the next release.</div>'
        : '<div style="color:var(--text-dim)">No crawl batches waiting. New sweeps land here automatically.</div>');

    // 2 — CHORES
    var due = d.chores.filter(function (c) { return c.due; });
    var rows = d.chores.map(function (c) {
      return '<tr>'
        + '<td style="padding:0.35rem 0.6rem 0.35rem 0;color:var(--text)">' + _esc(c.name)
        + (c.note ? '<div style="font-size:0.95rem;color:var(--text-dim)">' + _esc(c.note) + '</div>' : '') + '</td>'
        + '<td style="padding:0.35rem 0.6rem;white-space:nowrap;color:var(--text-dim)">every ' + c.every + 'd</td>'
        + '<td style="padding:0.35rem 0.6rem;white-space:nowrap;color:var(--text-dim)">' + (c.last ? c.last.toISOString().slice(0, 10) : 'never') + '</td>'
        + '<td style="padding:0.35rem 0.6rem;white-space:nowrap">' + (c.due
            ? '<span style="color:var(--accent);font-weight:700">DUE</span>'
            : '<span style="color:var(--green)">ok</span>') + '</td>'
        + '<td style="padding:0.35rem 0 0.35rem 0.6rem"><button onclick="_ymChoreDone(' + c.row + ',\'' + _esc(c.name).replace(/'/g, '') + '\')"'
        + ' style="padding:0.25rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body)">Mark done</button></td>'
        + '</tr>';
    }).join('');
    html += _card('Chores' + (due.length ? ' — ' + due.length + ' due' : ' — all caught up'),
      d.chores.length
        ? '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:1.1rem;width:100%">' + rows + '</table></div>'
          + '<div style="margin-top:0.5rem;font-size:0.95rem;color:var(--text-dim)">Add or edit chores in the Vault’s <b>chores</b> tab — no deploy needed.</div>'
        : '<div style="color:var(--text-dim)">No chores tab yet — run setupV38Chores() in the relay once.</div>');

    // 3 — THIS WEEK
    var urows = d.usage.map(function (u) {
      return '<tr><td style="padding:0.25rem 0.8rem 0.25rem 0;color:var(--text-dim);white-space:nowrap">' + _esc(u.date) + '</td>'
        + '<td style="padding:0.25rem 0.8rem;font-weight:700;color:var(--text)">' + _esc(u.opens) + '</td>'
        + '<td style="padding:0.25rem 0;color:var(--text-dim);font-size:0.98rem">' + _esc(u.versions) + '</td></tr>';
    }).join('');
    html += _card('App opens, last 7 days',
      d.usage.length
        ? '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:1.15rem">'
          + '<tr><td style="color:var(--text-dim);padding-right:0.8rem">date</td><td style="color:var(--text-dim);padding-right:0.8rem">opens</td><td style="color:var(--text-dim)">versions</td></tr>'
          + urows + '</table></div>'
        : '<div style="color:var(--text-dim)">No heartbeats counted yet — they start arriving as devices update to this release.</div>');

    page.innerHTML = html;
  };

  // ── v0.9.1622: the batch review view (read-only first hop) ─────
  var _ymBatchId = '';
  var _ymFilter = 'all';
  window._ymBatchBack = function () { _ymBatchId = ''; window.ymBuildPage(false); };
  window._ymBatchFilter = function (f) { _ymFilter = f; window._ymBatchOpen(_ymBatchId); };
  window._ymBatchOpen = function (id) {
    var page = document.getElementById('page-yardmaster');
    if (!page || !_isOwner() || !_ymData) return;
    _ymBatchId = id;
    var b = null;
    _ymData.batches.forEach(function (x) { if (x.id === id) b = x; });
    if (!b) { window.ymBuildPage(false); return; }
    var all = _ymData.deltas.filter(function (dd) { return dd.batch === id; });
    var flagged = all.filter(function (dd) { return dd.flag; });
    var list = _ymFilter === 'flagged' ? flagged
             : _ymFilter === 'clean' ? all.filter(function (dd) { return !dd.flag; })
             : all;
    var chip = function (f, label) {
      var on = _ymFilter === f;
      return '<button onclick="_ymBatchFilter(\'' + f + '\')" style="padding:0.25rem 0.8rem;border-radius:999px;border:1px solid '
        + (on ? 'var(--accent)' : 'var(--border)') + ';background:' + (on ? 'var(--accent)' : 'var(--surface2)')
        + ';color:' + (on ? 'var(--on-accent)' : 'var(--text)') + ';font-family:var(--font-body);cursor:pointer;font-size:0.95rem">' + label + '</button>';
    };
    var rows = list.map(function (dd) {
      return '<div style="border-top:1px solid var(--border);padding:0.55rem 0;display:flex;gap:0.9rem;align-items:flex-start;flex-wrap:wrap">'
        + '<div style="min-width:88px;font-weight:700;color:var(--text);font-size:1.1rem">' + _esc(dd.num || '—') + '</div>'
        + '<div style="flex:1;min-width:240px">'
          + '<div style="color:var(--text);font-size:1.05rem">' + _esc(dd.desc) + '</div>'
          + '<div style="font-size:0.95rem;color:var(--text-dim)">'
            + _esc(dd.tab || 'no tab yet') + (dd.type ? ' · ' + _esc(dd.type) : '') + (dd.years ? ' · ' + _esc(dd.years) : '')
            + (dd.msrp ? ' · $' + _esc(dd.msrp) : '') + '</div>'
          + (dd.flag ? '<div style="font-size:0.95rem;color:var(--accent);margin-top:0.15rem">⚠ ' + _esc(dd.flag) + '</div>' : '')
        + '</div>'
        + '<div style="white-space:nowrap;display:flex;gap:0.5rem;align-items:center">'
          + '<span style="font-size:0.9rem;color:var(--text-dim)">' + _esc(dd.status) + '</span>'
          + (dd.link ? '<a href="' + _esc(dd.link) + '" target="_blank" rel="noopener" style="padding:0.25rem 0.7rem;border-radius:7px;'
              + 'border:1px solid var(--border);background:var(--surface2);color:var(--accent2);text-decoration:none;font-size:0.95rem">Research</a>' : '')
        + '</div></div>';
    }).join('');
    page.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap">'
      + '<button onclick="_ymBatchBack()" style="padding:0.35rem 0.9rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">← Office</button>'
      + '<div class="page-title" style="margin:0;font-size:1.6rem">' + _esc(b.label) + '</div></div>'
      + '<div style="font-size:1.05rem;color:var(--text-dim);margin:0.3rem 0 0.6rem">' + _esc(b.note)
      + ' — read-only preview; verdict buttons arrive in the next release.</div>'
      + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.4rem">'
      + chip('all', 'All (' + all.length + ')') + chip('flagged', '⚠ Flagged (' + flagged.length + ')')
      + chip('clean', 'Clean (' + (all.length - flagged.length) + ')') + '</div>'
      + '<div>' + rows + '</div>';
    try { var mc = document.getElementById('main-content'); if (mc) mc.scrollTop = 0; } catch (e) {}
  };

  // ── Injection (owner only) ─────────────────────────────────────
  function _ymInjectUI() {
    if (!_isOwner()) return false;
    if (!document.getElementById('page-yardmaster')) {
      var main = document.getElementById('main-content');
      if (!main) return false;
      var pg = document.createElement('div');
      pg.className = 'page';
      pg.id = 'page-yardmaster';
      main.appendChild(pg);
    }
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    if (!document.getElementById('nav-yardmaster-btn')) {
      var refreshBtn = sidebar.querySelector('#refresh-btn');
      var homeSection = refreshBtn ? refreshBtn.parentElement : sidebar.querySelector('.nav-section');
      if (!homeSection) return false;
      var btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.id = 'nav-yardmaster-btn';
      btn.setAttribute('data-ctip', 'Owner’s console — queues, chores, and usage. Only you see this.');
      btn.onclick = function () { showPage('yardmaster', this); ymBuildPage(true); };
      btn.innerHTML = '<span style="width:17px;text-align:center;flex-shrink:0">🚦</span>Yardmaster’s Office';
      if (refreshBtn) homeSection.insertBefore(btn, refreshBtn);
      else homeSection.appendChild(btn);
    }
    var menu = document.getElementById('account-menu');
    if (menu && !document.getElementById('menu-yardmaster-btn')) {
      var mbtn = document.createElement('button');
      mbtn.className = 'account-menu-item';
      mbtn.id = 'menu-yardmaster-btn';
      mbtn.onclick = function () {
        if (typeof toggleAccountMenu === 'function') toggleAccountMenu();
        var nb = document.getElementById('nav-yardmaster-btn');
        showPage('yardmaster', nb && nb.offsetParent ? nb : null);
        ymBuildPage(true);
      };
      mbtn.innerHTML = '<span style="width:15px;text-align:center">🚦</span>Yardmaster’s Office';
      var firstItem = menu.querySelector('.account-menu-item');
      if (firstItem) menu.insertBefore(mbtn, firstItem);
      else menu.appendChild(mbtn);
    }
    return true;
  }

  // ── Boot: wait for the shell + a signed-in OWNER ───────────────
  (function _ymBoot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (tries > YM.pollMax) { clearInterval(t); return; }
      var appEl = document.getElementById('app');
      var appActive = appEl && appEl.classList.contains('active');
      if (!appActive || !window.state || !state.user || !state.user.email) return;
      if (!_isOwner()) { clearInterval(t); return; }   // signed in, not an owner: stand down for good
      if (_ymInjectUI()) clearInterval(t);
    }, YM.pollMs);
  })();
})();
