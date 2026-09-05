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
                  'crawl_batches!A1:G50', 'crawl_deltas!A1:X4000']   // v0.9.1683: image_url is column R; v0.9.1685: var_desc/sub_type/notes/category after it — all found BY HEADER
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

  // ── v0.9.1633: every real era tab is a commit target ───────────
  // ONE source of truth: REAL_ERA_IDS + ERA_TABS (config.js). A new
  // era tab added there becomes a commit target automatically — no
  // second list to forget to update here.
  function _ymMasterTabs() {
    try {
      if (typeof REAL_ERA_IDS !== 'undefined' && typeof ERA_TABS !== 'undefined') {
        var out = [];
        REAL_ERA_IDS.forEach(function (id) {
          var t = ERA_TABS[id] && ERA_TABS[id].items;
          if (t && out.indexOf(t) < 0) out.push(t);
        });
        if (out.length) return out;
      }
    } catch (e) {}
    return ['Menards O', 'Menards HO'];   // config unavailable — the v1627 pair, never expected
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
          msrp: g(r, 'msrp'), flag: g(r, 'flag'), status: g(r, 'status') || 'pending',
          imageUrl: g(r, 'image_url'),   // v0.9.1683: the maker's product-photo LINK (stock-photos.js draws it, by link)
          // v0.9.1685 (Greenberg Marx transcription): the columns a BOOK row
          // carries that a crawl row never did — the variation's own text,
          // the guide's sub-type, the page citation, the section. Optional,
          // at the END, by header; older batches simply leave them blank.
          varDesc: g(r, 'var_desc'), subType: g(r, 'sub_type'), notes: g(r, 'notes'), category: g(r, 'category')
        };
      });
    }
    var _bcol = {};
    if (d.crawlBatches && d.crawlBatches.length) {
      d.crawlBatches[0].forEach(function (h, i) { _bcol[String(h)] = i; });
      var gb = function (r, name) { var i = _bcol[name]; return i == null ? '' : String(r[i] == null ? '' : r[i]); };
      out.batches = d.crawlBatches.slice(1).map(function (r, i) { r._sheetRow = i + 2; return r; })
        .filter(function (r) { return gb(r, 'batch_id'); }).map(function (r) {
        var id = gb(r, 'batch_id');
        var counts = { pending: 0, approved: 0, edited: 0, rejected: 0, deferred: 0 };
        out.deltas.forEach(function (dd) {
          if (dd.batch === id) counts[counts[dd.status] == null ? 'pending' : dd.status]++;
        });
        return { id: id, sheetRow: r._sheetRow, source: gb(r, 'source'), created: gb(r, 'created'), label: gb(r, 'label'),
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
    // v0.9.1628: committed batches STAY (dimmed) — vanishing stranded
    // Brad's 3 no-tab rows behind an unreachable Review button.
    var open = d.batches.filter(function (b) { return b.status !== 'dismissed'; });
    var brows = open.map(function (b) {
      var c = b.counts, done = c.approved + c.edited + c.rejected;
      var _cm = b.status === 'committed';
      return '<div style="display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap;padding:0.5rem 0;border-top:1px solid var(--border)' + (_cm ? ';opacity:0.75' : '') + '">'
        + '<div style="flex:1;min-width:220px"><div style="font-weight:700;color:var(--text);font-size:1.15rem">' + _esc(b.label) + (_cm ? ' <span style="font-size:0.85rem;color:var(--green);font-weight:700">\u2713 committed</span>' : '') + '</div>'
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

  // ── v0.9.1622 → v0.9.1626: the batch review view ───────────────
  // v1625: solid card, verdicts saved on tap, Google-first research.
  // v1626, Brad's rhythm: a verdict repaint KEEPS the scroll (only
  // opening a batch goes to the top); decided rows LEAVE the working
  // views (a Decided chip holds them for second thoughts); and Undo-
  // last sits beside Approve-all-clean, reversing the last action —
  // a bulk approve included. One write path (_ymApplyVerdicts) serves
  // taps, bulk, and undo, so the Vault and the screen cannot drift.
  var _ymBatchId = '';
  var _ymFilter = 'all';
  var _ymUndoStack = null;   // the LAST action only: [{dd, prev}]
  window._ymBatchBack = function () { _ymBatchId = ''; _ymUndoStack = null; window.ymBuildPage(false); };
  window._ymBatchFilter = function (f) { _ymFilter = f; window._ymBatchOpen(_ymBatchId, true); };
  function _ymRecount() {
    if (!_ymData) return;
    _ymData.batches.forEach(function (b) {
      var c = { pending: 0, approved: 0, edited: 0, rejected: 0, deferred: 0 };
      _ymData.deltas.forEach(function (dd) {
        if (dd.batch === b.id) c[c[dd.status] == null ? 'pending' : dd.status]++;
      });
      b.counts = c;
    });
  }
  // One write path for everything: pairs of {dd, status}. Local copies
  // update only after the Vault says yes — the screen never claims what
  // didn't save. recordUndo captures each row's PREVIOUS verdict so a
  // bulk approve undoes as one gesture.
  window._ymApplyVerdicts = async function (pairs, recordUndo) {
    if (!_isOwner() || !pairs.length) return;
    var today = new Date().toISOString().slice(0, 10);
    var data = pairs.map(function (pr) {
      return { range: 'crawl_deltas!P' + pr.dd.sheetRow + ':Q' + pr.dd.sheetRow,
               values: [[pr.status, pr.status === 'pending' ? '' : today]] };
    });
    try {
      var r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate',
        { method: 'POST',
          headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data: data }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (recordUndo) _ymUndoStack = pairs.map(function (pr) { return { dd: pr.dd, prev: pr.dd.status || 'pending' }; });
      pairs.forEach(function (pr) { pr.dd.status = pr.status; });
      _ymRecount();
      window._ymBatchOpen(_ymBatchId, true);
    } catch (e) {
      if (typeof showToast === 'function') showToast('That verdict didn\u2019t reach the Vault \u2014 check the connection and tap it again.', 4000, true);
    }
  };
  window._ymVerdictMany = function (list, status) {
    window._ymApplyVerdicts(list.map(function (dd) { return { dd: dd, status: status }; }), true);
  };
  window._ymVerdict = function (deltaId, status) {
    if (!_ymData) return;
    var dd = null;
    _ymData.deltas.forEach(function (x) { if (x.id === deltaId && x.batch === _ymBatchId) dd = x; });
    if (!dd) return;
    var cur = dd.status || 'pending';
    // the same verdict again = take it back (returns the row to pending)
    window._ymVerdictMany([dd], status === cur ? 'pending' : status);
  };
  window._ymUndoLast = function () {
    if (!_ymUndoStack || !_ymUndoStack.length) return;
    var pairs = _ymUndoStack.map(function (u) { return { dd: u.dd, status: u.prev }; });
    _ymUndoStack = null;
    window._ymApplyVerdicts(pairs, false);
    if (typeof showToast === 'function') showToast('Undone \u2014 ' + pairs.length + (pairs.length === 1 ? ' row went back' : ' rows went back'), 2500);
  };
  window._ymApproveClean = function () {
    if (!_ymData) return;
    var clean = _ymData.deltas.filter(function (dd) {
      return dd.batch === _ymBatchId && !dd.flag && (dd.status || 'pending') === 'pending';
    });
    if (!clean.length) { if (typeof showToast === 'function') showToast('No clean pending rows left', 2500); return; }
    var go = function () { window._ymVerdictMany(clean, 'approved'); };
    if (typeof appConfirm === 'function') {
      appConfirm('Approve all ' + clean.length + ' clean pending rows?', { title: 'Approve clean rows', ok: 'Approve ' + clean.length })
        .then(function (yes) { if (yes) go(); });
    } else if (confirm('Approve all ' + clean.length + ' clean pending rows?')) go();
  };
  // ── v0.9.1627(b): EDIT — Brad: "how do i change things you flagged?" ──
  // Every row opens into an inline editor: proposed tab (the door for the
  // 11 no-gauge rows), number, type, road, description, years, MSRP.
  // Saving writes the delta back to the Vault and stamps it 'edited' —
  // which the commit treats exactly like approved.
  var _ymEditId = '';
  window._ymEditOpen = function (id) { _ymEditId = id; window._ymBatchOpen(_ymBatchId, true); };
  window._ymEditCancel = function () { _ymEditId = ''; window._ymBatchOpen(_ymBatchId, true); };
  window._ymEditSave = async function (id) {
    if (!_isOwner() || !_ymData) return;
    var dd = null;
    _ymData.deltas.forEach(function (x) { if (x.id === id && x.batch === _ymBatchId) dd = x; });
    if (!dd) return;
    var gv = function (eid) { var el = document.getElementById(eid); return el ? String(el.value).trim() : ''; };
    var nv = { tab: gv('ym-ed-tab'), num: gv('ym-ed-num'), type: gv('ym-ed-type'), road: gv('ym-ed-road'),
               desc: gv('ym-ed-desc'), years: gv('ym-ed-years'), msrp: gv('ym-ed-msrp') };
    if (!nv.num) { if (typeof showToast === 'function') showToast('The item number can\u2019t be empty.', 3000, true); return; }
    var today = new Date().toISOString().slice(0, 10);
    try {
      var r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate',
        { method: 'POST',
          headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data: [
            { range: 'crawl_deltas!D' + dd.sheetRow + ':H' + dd.sheetRow, values: [[nv.tab, nv.num, nv.type, nv.road, nv.desc]] },
            { range: 'crawl_deltas!K' + dd.sheetRow, values: [[nv.years]] },
            { range: 'crawl_deltas!M' + dd.sheetRow, values: [[nv.msrp]] },
            { range: 'crawl_deltas!P' + dd.sheetRow + ':Q' + dd.sheetRow, values: [['edited', today]] }
          ] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      dd.tab = nv.tab; dd.num = nv.num; dd.type = nv.type; dd.road = nv.road;
      dd.desc = nv.desc; dd.years = nv.years; dd.msrp = nv.msrp; dd.status = 'edited';
      _ymEditId = '';
      _ymRecount();
      window._ymBatchOpen(_ymBatchId, true);
      if (typeof showToast === 'function') showToast('Saved \u2014 counted as approved with your changes.', 3000);
    } catch (e) {
      if (typeof showToast === 'function') showToast('The edit didn\u2019t reach the Vault \u2014 try again.', 3500, true);
    }
  };

  // ── v0.9.1627: COMMIT — the cockpit's last mile ────────────────
  // The standing rules, enforced in order: dated per-tab CSV backups
  // reach the RailRoster Backups folder BEFORE any master write (a
  // backup failed = the commit ABORTS untouched); master rows are
  // built BY HEADER NAME against the target tab's own header row; a
  // number already in master is HELD, never overwritten — append-only,
  // so no existing row (trap rows included) can be touched; approved
  // rows with no tab are held and SAID; the batch is marked committed
  // only after the appended counts VERIFY against a fresh read.
  function _ymCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var v = String(c == null ? '' : c);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
  }
  function _ymMasterCell(h, dd, today) {
    switch (String(h)) {
      case 'Item Number': return dd.num;
      case 'Item Type': return dd.type;
      case 'Road Name': return dd.road;
      case 'Description': return dd.desc;
      case 'Gauge': return dd.gauge;
      case 'Year Produced': return dd.years;
      case 'Variation': return dd.variation;
      case 'Reference Link': return dd.link;
      case 'MSRP': return dd.msrp;
      case 'Image URL': return dd.imageUrl || '';   // v0.9.1683
      // v0.9.1685: book rows — the master spells these two ways across tabs
      case 'Variation Description': case 'Variation Details': return dd.varDesc || '';
      case 'Sub Type': case 'Sub-Type': return dd.subType || '';
      case 'Notes': return dd.notes || '';
      case 'Category': return dd.category || '';
      case 'Source': return (dd.source || 'Wayback sweep') + ' \u2014 approved ' + today + ' (Yardmaster cockpit)';
      default: return '';
    }
  }
  window._ymCommit = async function () {
    if (!_isOwner() || !_ymData) return;
    var b = null;
    _ymData.batches.forEach(function (x) { if (x.id === _ymBatchId) b = x; });
    if (!b) return;   // v0.9.1628: a committed batch may commit again — the dedupe holds what's landed; only fresh rows append
    var MID = (typeof MASTER_SHEET_ID !== 'undefined') ? MASTER_SHEET_ID : '';
    if (!MID) { if (typeof showToast === 'function') showToast('Master sheet id unavailable \u2014 reload the app.', 3500, true); return; }
    var H = { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' };
    var today = new Date().toISOString().slice(0, 10);
    var approved = _ymData.deltas.filter(function (dd) {
      return dd.batch === _ymBatchId && (dd.status === 'approved' || dd.status === 'edited');
    });
    if (!approved.length) { if (typeof showToast === 'function') showToast('Nothing approved to commit yet.', 3000); return; }
    var byTab = {}, heldNoTab = [], heldNoNum = [];
    var validTabs = _ymMasterTabs();
    approved.forEach(function (dd) {
      var t = String(dd.tab || '').trim();
      if (!String(dd.num || '').trim()) heldNoNum.push(dd);   // v1634: a blank number must never reach master
      else if (validTabs.indexOf(t) >= 0) (byTab[t] = byTab[t] || []).push(dd);
      else heldNoTab.push(dd);   // no tab picked (or not a real master tab) — held and said below
    });
    // ── v0.9.1634: the in-flight guard — stability rule #5, learned the
    // hard way when five stacked Commit taps each read the still-clean
    // K-Line O tab during the backup upload and appended 250 rows.
    if (window._ymCommitBusy) { if (typeof showToast === 'function') showToast('A commit is already running \u2014 hold on.', 3000); return; }
    window._ymCommitBusy = true;
    try {
      // read each target tab's headers + existing numbers; dedupe HOLDS
      var tabs = Object.keys(byTab), plan = {}, heldDup = [];
      for (var ti = 0; ti < tabs.length; ti++) {
        var t2 = tabs[ti];
        var gotRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID + '/values/' + encodeURIComponent("'" + t2 + "'!A1:AD"), { headers: H });   // v0.9.1683: was A1:V — MTH tabs run to W, and Image URL lands after that
        if (!gotRes.ok) throw new Error('could not read ' + t2 + ' (HTTP ' + gotRes.status + ') \u2014 commit stopped before any write');
        var got = await gotRes.json();
        var vals = got.values || [];
        var heads = vals[0] || [];
        var numIdx = heads.map(String).indexOf('Item Number');
        var existing = {};
        vals.slice(1).forEach(function (r) { var n = String((r[numIdx] || '')).trim(); if (n) existing[n] = 1; });
        // v0.9.1628: the first cut counted the HEADER on this side only —
        // one short every time, a false alarm AFTER the rows had landed.
        var fresh = [], rowsBefore = vals.slice(1).filter(function (r) { return String((r[numIdx] || '')).trim(); }).length;
        byTab[t2].forEach(function (dd) {
          if (existing[String(dd.num).trim()]) heldDup.push(dd); else fresh.push(dd);
        });
        plan[t2] = { heads: heads, fresh: fresh, rowsBefore: rowsBefore, allVals: vals };
      }
      var totFresh = 0, perTab = [];
      tabs.forEach(function (tt) { var n = plan[tt].fresh.length; totFresh += n; if (n) perTab.push(n + ' to ' + tt); });
      if (totFresh === 0) {
        // everything approved already sits in the master — the dedupe held
        // it all. Say so and mark the batch committed; nothing to write.
        await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'crawl_batches!E' + (b.sheetRow || 2), values: [['committed']] }] }) });
        b.status = 'committed';
        if (typeof showToast === 'function') showToast('Everything approved is already in the master' + (heldNoTab.length ? ' \u2014 ' + heldNoTab.length + ' still need a tab (use Edit)' : '') + (heldNoNum.length ? ' \u2014 ' + heldNoNum.length + ' still need an item number (use Edit)' : '') + '.', 5000);
        window._ymBatchOpen(_ymBatchId, true);
        return;
      }
      var lines = 'Append ' + totFresh + ' row' + (totFresh === 1 ? '' : 's') + ' — ' + perTab.join(', ') + '.'
        + (heldDup.length ? ' ' + heldDup.length + ' held \u2014 number already in master.' : '')
        + (heldNoTab.length ? ' ' + heldNoTab.length + ' held \u2014 no tab picked.' : '')
        + (heldNoNum.length ? ' ' + heldNoNum.length + ' held \u2014 no item number.' : '')
        + ' Dated backups of both tabs are written first.';
      var yes = (typeof appConfirm === 'function')
        ? await appConfirm(lines, { title: 'Commit to the master catalog', ok: 'Back up, then commit' })
        : confirm(lines);
      if (!yes) return;
      // ── backups FIRST — a failure here aborts with master untouched ──
      var fq = encodeURIComponent("name='RailRoster Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      var ff = await fetch('https://www.googleapis.com/drive/v3/files?q=' + fq + '&fields=files(id)', { headers: { Authorization: H.Authorization } }).then(function (x) { return x.json(); });
      var folderId = ff.files && ff.files[0] && ff.files[0].id;
      if (!folderId) {
        var mk = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: H, body: JSON.stringify({ name: 'RailRoster Backups', mimeType: 'application/vnd.google-apps.folder' }) }).then(function (x) { return x.json(); });
        folderId = mk.id;
      }
      for (var bi = 0; bi < tabs.length; bi++) {
        var t3 = tabs[bi];
        var csv = _ymCsv(plan[t3].allVals);
        var bnd = 'rrbk' + Date.now();
        var meta = { name: t3 + ' \u2014 backup ' + today + ' before ' + _ymBatchId + '.csv', parents: [folderId] };
        var body = '--' + bnd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta)
          + '\r\n--' + bnd + '\r\nContent-Type: text/csv\r\n\r\n' + csv + '\r\n--' + bnd + '--';
        var up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: H.Authorization, 'Content-Type': 'multipart/related; boundary=' + bnd }, body: body });
        if (!up.ok) throw new Error('backup failed for ' + t3 + ' (HTTP ' + up.status + ') \u2014 nothing was committed');
      }
      // ── append, by header name, one call per tab ──
      var appended = 0;
      for (var ai = 0; ai < tabs.length; ai++) {
        var t4 = tabs[ai];
        if (!plan[t4].fresh.length) continue;
        // v0.9.1683: a row carrying an image link needs somewhere to put it.
        // The column is added at the END of the tab's header row (the column
        // rule), once, only when a fresh row actually has a link — Bachmann
        // tabs already have it; Lionel MPC-Modern gets it on its first
        // approved crawl row. Header write first, so the row below lines up.
        var _hasImg = plan[t4].fresh.some(function (dd) { return !!(dd.imageUrl && String(dd.imageUrl).trim()); });
        if (_hasImg && plan[t4].heads.map(String).indexOf('Image URL') < 0) {
          var _newIdx = plan[t4].heads.length;   // 0-based index of the new last column
          var _colL = (typeof colLetter === 'function') ? colLetter(_newIdx) : String.fromCharCode(65 + _newIdx);
          if (typeof sheetsUpdate !== 'function') throw new Error('sheetsUpdate unavailable \u2014 reload the app');
          await sheetsUpdate(MID, "'" + t4 + "'!" + _colL + '1', [['Image URL']]);
          plan[t4].heads = plan[t4].heads.concat(['Image URL']);
        }
        var rows = plan[t4].fresh.map(function (dd) {
          return plan[t4].heads.map(function (h) { return _ymMasterCell(h, dd, today); });
        });
        // §224's census is right: raw :append belongs in sheets.js alone.
        // The guarded sheetsAppend does the write — same chokepoint, same
        // outbox protection, as every other append in the app.
        if (typeof sheetsAppend !== 'function') throw new Error('sheetsAppend unavailable \u2014 reload the app');
        await sheetsAppend(MID, "'" + t4 + "'!A:A", rows);
        appended += rows.length;
        // verify the counts against a fresh read before believing anything
        var chkRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID + '/values/' + encodeURIComponent("'" + t4 + "'!A1:A"), { headers: H });
        if (!chkRes.ok) throw new Error('verify read failed on ' + t4 + ' (HTTP ' + chkRes.status + ') \u2014 rows were appended; check the tab before recommitting');
        var chk = await chkRes.json();
        var after = (chk.values || []).slice(1).filter(function (r) { return String((r[0] || '')).trim(); }).length;
        if (after !== plan[t4].rowsBefore + plan[t4].fresh.length) throw new Error('count verify failed on ' + t4 + ' \u2014 check the tab before trusting this commit');
      }
      // ── only now: the batch is committed ──
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'crawl_batches!E' + (b.sheetRow || 2), values: [['committed']] }] }) });
      b.status = 'committed';
      _ymUndoStack = null;
      if (typeof showToast === 'function') showToast('Committed \u2014 ' + appended + ' rows added to the master catalog. Backups are in RailRoster Backups.', 6000);
      window.ymBuildPage(true);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Commit stopped: ' + (e && e.message), 6000, true);
    } finally {
      window._ymCommitBusy = false;
    }
  };
  window._ymBatchOpen = function (id, keepScroll) {
    var page = document.getElementById('page-yardmaster');
    if (!page || !_isOwner() || !_ymData) return;
    _ymBatchId = id;
    var b = null;
    _ymData.batches.forEach(function (x) { if (x.id === id) b = x; });
    if (!b) { window.ymBuildPage(false); return; }
    var mc = document.getElementById('main-content');
    var _scroll = (keepScroll && mc) ? mc.scrollTop : 0;
    var maker = String(b.label || '').split(' ')[0] || '';
    var all = _ymData.deltas.filter(function (dd) { return dd.batch === id; });
    var pend = all.filter(function (dd) { return (dd.status || 'pending') === 'pending'; });
    var decided = all.filter(function (dd) { return (dd.status || 'pending') !== 'pending'; });
    var flagged = pend.filter(function (dd) { return dd.flag; });
    var list = _ymFilter === 'flagged' ? flagged
             : _ymFilter === 'clean' ? pend.filter(function (dd) { return !dd.flag; })
             : _ymFilter === 'decided' ? decided
             : pend;
    var chip = function (f, label) {
      var on = _ymFilter === f;
      return '<button onclick="_ymBatchFilter(\'' + f + '\')" style="padding:0.25rem 0.8rem;border-radius:999px;border:1px solid '
        + (on ? 'var(--accent)' : 'var(--border)') + ';background:' + (on ? 'var(--accent)' : 'var(--surface2)')
        + ';color:' + (on ? 'var(--on-accent)' : 'var(--text)') + ';font-family:var(--font-body);cursor:pointer;font-size:0.95rem">' + label + '</button>';
    };
    var vbtn = function (dd, st, label) {
      var on = (dd.status || 'pending') === st;
      var tone = st === 'approved' ? 'var(--green)' : st === 'rejected' ? 'var(--accent)' : 'var(--text-dim)';
      return '<button onclick="_ymVerdict(\'' + _esc(dd.id) + '\',\'' + st + '\')" title="Tap the same verdict again to undo it" style="padding:0.25rem 0.65rem;border-radius:7px;cursor:pointer;font-family:var(--font-body);font-size:0.9rem;font-weight:600;'
        + 'border:1.5px solid ' + (on ? tone : 'var(--border)') + ';background:var(--surface);color:' + (on ? tone : 'var(--text-mid)') + '">'
        + (on ? '\u2713 ' : '') + label + '</button>';
    };
    var _inp = function (eid, label, val, w) {
      return '<label style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.8rem;color:var(--text-dim)">' + label
        + '<input id="' + eid + '" value="' + _esc(val) + '" style="width:' + (w || '9rem') + ';background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:0.35rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.95rem"></label>';
    };
    var rows = list.map(function (dd) {
      if (dd.id === _ymEditId) {
        var tabOpts = '<option value=""' + (dd.tab ? '' : ' selected') + '>\u2014 pick \u2014</option>'
          + _ymMasterTabs().map(function (tt) { return '<option value="' + _esc(tt) + '"' + (dd.tab === tt ? ' selected' : '') + '>' + _esc(tt) + '</option>'; }).join('');
        return '<div style="border-top:1px solid var(--border);padding:0.7rem 0;display:flex;gap:0.7rem;flex-wrap:wrap;align-items:flex-end">'
          + '<label style="display:flex;flex-direction:column;gap:0.15rem;font-size:0.8rem;color:var(--text-dim)">Tab'
            + '<select id="ym-ed-tab" style="background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:0.35rem 0.5rem;color:var(--text);font-family:var(--font-body);font-size:0.95rem">'
            + tabOpts + '</select></label>'
          + _inp('ym-ed-num', 'Number', dd.num, '7rem')
          + _inp('ym-ed-type', 'Type', dd.type, '9rem')
          + _inp('ym-ed-road', 'Road name', dd.road, '10rem')
          + _inp('ym-ed-desc', 'Description', dd.desc, '22rem')
          + _inp('ym-ed-years', 'Years', dd.years, '9rem')
          + _inp('ym-ed-msrp', 'MSRP', dd.msrp, '5rem')
          + '<div style="display:flex;gap:0.4rem">'
            + '<button onclick="_ymEditSave(\'' + _esc(dd.id) + '\')" style="padding:0.35rem 0.9rem;border-radius:7px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;cursor:pointer">Save</button>'
            + '<button onclick="_ymEditCancel()" style="padding:0.35rem 0.9rem;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);cursor:pointer">Cancel</button>'
          + '</div>'
          + (dd.flag ? '<div style="width:100%;font-size:0.92rem;color:var(--accent)">\u26a0 ' + _esc(dd.flag) + '</div>' : '')
        + '</div>';
      }
      var gq = encodeURIComponent((maker + ' ' + dd.num + ' ' + dd.desc).trim());
      return '<div style="border-top:1px solid var(--border);padding:0.6rem 0;display:flex;gap:0.9rem;align-items:flex-start;flex-wrap:wrap">'
        + '<div style="min-width:88px;font-weight:700;color:var(--text);font-size:1.1rem">' + _esc(dd.num || '\u2014') + '</div>'
        + '<div style="flex:1;min-width:240px">'
          + '<div style="color:var(--text);font-size:1.05rem">' + _esc(dd.desc) + (dd.varDesc && dd.varDesc !== dd.desc && dd.varDesc !== 'no variation' ? ' <span style="color:var(--text-dim)">— var ' + _esc(dd.variation || '') + ': ' + _esc(dd.varDesc) + '</span>' : '') + '</div>'
          + '<div style="font-size:0.95rem;color:var(--text-dim)">'
            + _esc(dd.tab || 'no tab yet') + (dd.type ? ' \u00b7 ' + _esc(dd.type) : '') + (dd.years ? ' \u00b7 ' + _esc(dd.years) : '')
            + (dd.msrp ? ' \u00b7 $' + _esc(dd.msrp) : '') + '</div>'
          + (dd.flag ? '<div style="font-size:0.95rem;color:var(--accent);margin-top:0.15rem">\u26a0 ' + _esc(dd.flag) + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end">'
          + '<div style="display:flex;gap:0.4rem">'
            + '<a href="https://www.google.com/search?q=' + gq + '" target="_blank" rel="noopener" style="padding:0.25rem 0.7rem;border-radius:7px;'
              + 'border:1px solid var(--accent2);background:var(--surface);color:var(--accent2);text-decoration:none;font-size:0.9rem;font-weight:600">Google</a>'
            + (dd.link ? '<a href="' + _esc(dd.link) + '" target="_blank" rel="noopener" style="padding:0.25rem 0.7rem;border-radius:7px;'
              + 'border:1px solid var(--border);background:var(--surface);color:var(--text-dim);text-decoration:none;font-size:0.9rem">Archive</a>' : '')
            + (dd.imageUrl ? '<a href="' + _esc(dd.imageUrl) + '" target="_blank" rel="noopener" title="The maker\u2019s product photo this row carries (shown to users by link only)" style="padding:0.25rem 0.7rem;border-radius:7px;'
              + 'border:1px solid var(--border);background:var(--surface);color:var(--text-dim);text-decoration:none;font-size:0.9rem">Photo</a>' : '')   // v0.9.1683
          + '</div>'
          + '<div style="display:flex;gap:0.4rem">' + vbtn(dd, 'approved', 'Approve') + vbtn(dd, 'rejected', 'Reject') + vbtn(dd, 'deferred', 'Defer')
            + '<button onclick="_ymEditOpen(\'' + _esc(dd.id) + '\')" title="Change the tab, number, description\u2026 then it counts as approved with your changes" style="padding:0.25rem 0.65rem;border-radius:7px;cursor:pointer;font-family:var(--font-body);font-size:0.9rem;font-weight:600;border:1.5px solid var(--accent2);background:var(--surface);color:var(--accent2)">' + (dd.status === 'edited' ? '\u2713 ' : '') + 'Edit</button>'
          + '</div>'
        + '</div></div>';
    }).join('');
    if (!list.length) {
      rows = '<div style="border-top:1px solid var(--border);padding:1rem 0;color:var(--text-dim);font-size:1.05rem">'
        + (_ymFilter === 'decided' ? 'Nothing decided yet.' : 'Nothing left to review here \u2014 nice work.') + '</div>';
    }
    var c = b.counts || {};
    page.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap">'
      + '<button onclick="_ymBatchBack()" style="padding:0.35rem 0.9rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">\u2190 Office</button>'
      + '<div class="page-title" style="margin:0;font-size:1.6rem">' + _esc(b.label) + '</div></div>'
      + '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:0.9rem 1.1rem;margin-top:0.7rem">'
      + '<div style="display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap">'
        + '<div style="font-size:1.02rem;color:var(--text-mid)">' + _esc(b.note) + ' \u2014 '
          + c.pending + ' to review \u00b7 ' + (c.approved + c.edited) + ' approved \u00b7 ' + c.rejected + ' rejected \u00b7 ' + c.deferred + ' deferred</div>'
        + '<div style="margin-left:auto;display:flex;gap:0.5rem">'
          + (((c.approved + c.edited) > 0)
              ? '<button onclick="_ymCommit()" style="padding:0.3rem 0.85rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">Commit ' + (c.approved + c.edited) + ' \u2192 master</button>'
              : '')
          + '<button onclick="_ymApproveClean()" style="padding:0.3rem 0.85rem;border-radius:8px;border:1.5px solid var(--green);background:var(--surface);color:var(--green);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">Approve all clean</button>'
          + (_ymUndoStack && _ymUndoStack.length
              ? '<button onclick="_ymUndoLast()" style="padding:0.3rem 0.85rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">\u21a9 Undo last</button>'
              : '')
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.55rem 0 0.2rem">'
      + chip('all', 'To review (' + pend.length + ')') + chip('flagged', '\u26a0 Flagged (' + flagged.length + ')')
      + chip('clean', 'Clean (' + (pend.length - flagged.length) + ')') + chip('decided', 'Decided (' + decided.length + ')') + '</div>'
      + rows + '</div>';
    try {
      if (mc) {
        if (!keepScroll) mc.scrollTop = 0;
        else mc.scrollTop = _scroll;
      }
    } catch (e) {}
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
