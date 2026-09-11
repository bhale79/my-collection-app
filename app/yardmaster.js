// ══════════════════════════════════════════════════════════════
//  yardmaster.js — The Yardmaster's Office (v0.9.1580, Session 86)
//  v0.9.1688: Clear finished / Show finished / Put back on the queue card.
//  v0.9.1689: Clear finished also ARCHIVES the decided rows (crawl_deltas →
//  crawl_deltas_archive, backup first, verified); verdicts/edits check the
//  row still carries their delta_id before writing.
//  v0.9.1712: a flag is a NOTE or a CHECK (rrFlagKind, config.js). Notes
//  count as clean; only checks are "flagged". Per-flag Approve all / Reject
//  all buttons on the batch view. Brad: "I have thousands to approve."
//  v0.9.1713: "Who's using the app" — beta testers by name/email with opens
//  in the last 7 days, opens in total and last seen (relay v4.0 keeps the
//  count on each tester's beta_testers row). Brad: "I want names/emails of
//  who used the app, opens in the past week and in total."
//  v0.9.1716: the Pre-sort also spots SOMEONE'S LIST NUMBER — a run of
//  consecutive numbers whose descriptions run A-Z is a collection export, not
//  catalog numbers (rrInventoryRows, config.js). Batch-wide by nature, so it
//  runs only in the Pre-sort, never at queue time.
//  v0.9.1715: the blank TYPE is read out of the description. Brad: "many say
//  boxcar in the title and the type is blank." rrTypeFromDescription
//  (config.js) does the reading; queueing and the Pre-sort both fill it, and
//  neither ever overwrites a type that is already there.
//  v0.9.1714: the community PRE-SORT. Brad: "it mixes real trains we lack
//  with junk (model airplanes, cars) … flag the obvious junk as a CHECK and
//  leave the obvious trains clean." Reasons come from rrPreSortReasons
//  (config.js — THE lists to edit); duplicates of a row already waiting are
//  never queued twice any more; Lionel with a modern number goes to the
//  MPC-Modern tab and small O-gauge brands to Other O Brands; a "Pre-sort"
//  button on the community batch rewrites the flags of PENDING rows only.
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
//    beta_testers  — v0.9.1713: who is using the app — beta testers ONLY;
//                    relay v4.0 stamps last_seen | app_version | opens |
//                    recent_days | name on each tester's row per open
//  The Monday digest email (relay v3.8) reads the same tabs — one
//  source of truth, two views.
//
//  No hex colors — theme vars only, so the color ratchet stays flat.
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var YM = {
    // v0.9.1697: the list moved to config.js (RR_OWNER_EMAILS) so it is not
    // typed out in two files any more. This copy is a FALLBACK ONLY, for the
    // case where config.js has not loaded yet — edit config.js, not this.
    OWNER_EMAILS: (typeof RR_OWNER_EMAILS !== 'undefined' && RR_OWNER_EMAILS)
                  || ['bhale@ipd-llc.com', 'support@therailroster.com'],
    VAULT_ID: '1h4LlDPT9SrToNjg450kU71kCo7ago-n6veI-DNB3nPU',
    VAULT_URL: 'https://docs.google.com/spreadsheets/d/1h4LlDPT9SrToNjg450kU71kCo7ago-n6veI-DNB3nPU/edit',
    DELTAS_TAB: 'crawl_deltas',                 // v0.9.1689: the working queue …
    ARCHIVE_TAB: 'crawl_deltas_archive',        // … and where decided rows of cleared batches go
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
      // v0.9.1697 RECORDING MODE: while Brad is recording the help videos on his
      // own account, the app must behave exactly like a stranger's copy — so
      // the Office is not merely hidden, it never injects. The switch that
      // turns this back off asks rrIsRealOwner(), which ignores recording mode.
      if (typeof window.rrRecordingMode === 'function' && window.rrRecordingMode()) return false;
      var em = window.state && state.user && String(state.user.email || '').toLowerCase();
      return !!em && YM.OWNER_EMAILS.indexOf(em) >= 0;
    } catch (e) { return false; }
  }
  // v0.9.1689: 0 → A, 25 → Z, 26 → AA. Every "which column is this header"
  // answer goes through here, so a 27th column cannot break a range.
  function _ymColLetter(i) {
    var s = ''; i = i + 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  // ── Vault reads: one batchGet, owner token ─────────────────────
  function _fetchVault() {
    // v0.9.1695: submissions is 3,638 rows and growing — the old A1:L1000 read
    // saw only the first thousand (all in_master=true) and reported 0 waiting
    // while 885 sat below the cut. Both queue tabs are read unbounded now.
    var ranges = ['submissions!A1:L', 'barcode_pairs!A1:I', 'chores!A1:D200', 'usage!A1:C400',
                  'crawl_batches!A1:G50', 'crawl_deltas!A1:X12000',   // v0.9.1683: image_url is column R; v0.9.1685: var_desc/sub_type/notes/category after it — all found BY HEADER. v0.9.1687: 4000 → 12000 rows (the two Greenberg transcriptions alone are 6,455 deltas)
                  'beta_testers!A1:H']                                // v0.9.1713: added at the END so v[0..5] keep their meaning; columns found BY HEADER
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
                 crawlBatches: v[4], crawlDeltas: v[5], betaTesters: v[6] };   // v0.9.1713
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

  // v0.9.1713: "2026-09-10:2;2026-09-11:1" → opens in the last N days (today
  // included). Pure: (ledger string, N, now) → number. Bad parts are ignored.
  function _ymLedgerSum(ledger, days, now) {
    var cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 864e5;
    var sum = 0;
    String(ledger || '').split(';').forEach(function (part) {
      var mm = part.split(':');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(mm[0])) return;
      var t = Date.parse(mm[0] + 'T00:00:00Z');
      if (t >= cutoff) sum += Number(mm[1]) || 0;
    });
    return sum;
  }
  function _ymBetaRows(rows, now) {
    if (!rows.length) return [];
    var h = (rows[0] || []).map(function (x) { return String(x || '').trim().toLowerCase(); });
    var g = function (r, name) { var i = h.indexOf(name); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
    return rows.slice(1).filter(function (r) { return g(r, 'email'); }).map(function (r) {
      var seen = g(r, 'last_seen').slice(0, 10);
      return { email: g(r, 'email'), name: g(r, 'name'), seen: seen, version: g(r, 'app_version'),
               total: Number(g(r, 'opens')) || 0, week: _ymLedgerSum(g(r, 'recent_days'), 7, now) };
    }).sort(function (a, b) { return (b.seen || '').localeCompare(a.seen || '') || a.email.localeCompare(b.email); });
  }

  function _summarize(d) {
    var out = { subs: 0, pairs: 0, chores: [], usage: [], subRows: [], pairRows: [] };
    // v0.9.1694: keep the waiting ROWS (by header, with their sheet row) so
    // "Queue into review" can turn them into deltas and stamp them back.
    var im = _colIdx(d.submissions, 'in_master');
    if (im >= 0) {
      var sh = (d.submissions[0] || []).map(String), sg = function (r, n) { var i = sh.indexOf(n); return i < 0 ? '' : String(r[i] == null ? '' : r[i]); };
      d.submissions.slice(1).forEach(function (r, i) {
        var v = String(r[im] || '').trim().toLowerCase();
        if (v === 'no' || v === 'false') {
          out.subs++;
          out.subRows.push({ row: i + 2, num: sg(r, 'item_num').trim(), variation: sg(r, 'variation').trim(), condition: sg(r, 'condition'),
                             mfr: sg(r, 'manufacturer').trim(), desc: sg(r, 'description').trim(), road: sg(r, 'road_name').trim(),
                             source: sg(r, 'source'), updated: sg(r, 'updated') });
        }
      });
      out.subInMasterCol = _ymColLetter(im);
    }
    var st = _colIdx(d.barcodes, 'status');
    if (st >= 0) {
      var bh = (d.barcodes[0] || []).map(String), bg = function (r, n) { var i = bh.indexOf(n); return i < 0 ? '' : String(r[i] == null ? '' : r[i]); };
      d.barcodes.slice(1).forEach(function (r, i) {
        var v = String(r[st] || '').trim().toLowerCase();
        if (v !== 'promoted' && v !== 'rejected' && v !== 'queued') {
          out.pairs++;
          out.pairRows.push({ row: i + 2, upc: bg(r, 'upc').trim(), num: bg(r, 'item_num').trim(), mfr: bg(r, 'mfr').trim(),
                              inMaster: bg(r, 'in_master'), how: bg(r, 'how'), count: bg(r, 'report_count') });
        }
      });
      out.pairStatusCol = _ymColLetter(st);
      out.pairUpcCol = _ymColLetter(Math.max(0, bh.indexOf('upc')));
    }
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
    // ── v0.9.1713: who is using the app (beta testers only) ────────
    // One row per tester, columns BY HEADER (relay v4.0 writes last_seen,
    // app_version, opens, recent_days, name at the END of the row; older
    // relays leave them blank and the card says so). "Last 7 days" is
    // summed from the 14-day ledger, today included; total is the relay's
    // running count. Most recently seen first; never-seen testers last.
    out.beta = _ymBetaRows(d.betaTesters || [], new Date());
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
      // v0.9.1689: number the rows BEFORE filtering. The old order (filter,
      // then i + 2) would have shifted every sheetRow below a blank row —
      // and a verdict writes by sheetRow. Same lesson as _loadMyDocs.
      out.deltaIdCol = _dcol.delta_id == null ? 'B' : _ymColLetter(_dcol.delta_id);
      out.deltaCols = { tab: _dcol.proposed_tab == null ? 'D' : _ymColLetter(_dcol.proposed_tab),   // v0.9.1714/1715: the Pre-sort writes these four
                        type: _dcol.item_type == null ? 'F' : _ymColLetter(_dcol.item_type),
                        flag: _dcol.flag == null ? 'O' : _ymColLetter(_dcol.flag),
                        notes: _dcol.notes == null ? 'U' : _ymColLetter(_dcol.notes) };
      out.deltas = d.crawlDeltas.slice(1).map(function (r, i) { r._sheetRow = i + 2; return r; })
        .filter(function (r) { return g(r, 'delta_id'); }).map(function (r) {
        return {
          sheetRow: r._sheetRow, batch: g(r, 'batch_id'), id: g(r, 'delta_id'), action: g(r, 'action'),
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
      // v0.9.1688: the status column's LETTER, read from the header once,
      // so every status write (commit, clear, put back) goes through
      // _ymBatchStatusRange — never a second hardcoded 'E'.
      out.batchStatusCol = _bcol.status == null ? 'E' : _ymColLetter(_bcol.status);
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
      + '<div style="margin-top:0.6rem;font-size:1.05rem;display:flex;gap:0.8rem;align-items:center;flex-wrap:wrap">'
      + (waiting ? '<button onclick="_ymQueueWaiting()" style="padding:0.35rem 0.95rem;border-radius:8px;border:1px solid var(--accent2);background:var(--surface2);color:var(--accent2);font-family:var(--font-body);font-weight:700;cursor:pointer">Queue ' + waiting + ' into review \u2192</button>' : '')
      + '<a href="' + YM.VAULT_URL + '" target="_blank" rel="noopener" style="color:var(--accent2)">Open the Vault \u2192</a>'
      + ' <span style="color:var(--text-dim)">' + (waiting ? 'Queued items become review rows below \u2014 approve, edit or reject them like any batch.' : 'Nothing waiting.') + '</span></div>');

    // 1b — CATALOG REVIEW QUEUE (v0.9.1622, Task #36's front door)
    // v0.9.1628: committed batches STAY (dimmed) — vanishing stranded
    // Brad's 3 no-tab rows behind an unreachable Review button.
    var open = d.batches.filter(function (b) { return b.status !== 'dismissed'; });
    // v0.9.1688 (Brad: "clean up my yardmaster office from the completed
    // items"): a batch is FINISHED when it is committed, nothing is
    // pending or deferred, and no approved row is still held (no tab or
    // no number) — the v1628 stranding case, kept visible on purpose.
    // "Clear finished" marks those batches dismissed in the Vault (one
    // cell each, reversible); "Show N finished" lists them again, each
    // with "Put back". Rows in crawl_deltas are never touched.
    var finished = open.filter(_ymIsFinished);
    var hidden = d.batches.filter(function (b) { return b.status === 'dismissed'; });
    var shown = _ymShowFinished ? open.concat(hidden) : open;
    var brows = shown.map(function (b) {
      var c = b.counts, done = c.approved + c.edited + c.rejected;
      var _cm = b.status === 'committed', _dm = b.status === 'dismissed', held = _ymHeldCount(b);
      return '<div style="display:flex;align-items:center;gap:0.9rem;flex-wrap:wrap;padding:0.5rem 0;border-top:1px solid var(--border)' + (_cm ? ';opacity:0.75' : _dm ? ';opacity:0.55' : '') + '">'
        + '<div style="flex:1;min-width:220px"><div style="font-weight:700;color:var(--text);font-size:1.15rem">' + _esc(b.label) + (_cm ? ' <span style="font-size:0.85rem;color:var(--green);font-weight:700">\u2713 committed</span>' : _dm ? ' <span style="font-size:0.85rem;color:var(--text-dim);font-weight:700">finished</span>' : '') + '</div>'
        + '<div style="font-size:0.98rem;color:var(--text-dim)">' + _esc(b.created) + ' · ' + _esc(b.note) + '</div></div>'
        + '<div style="font-size:1.05rem;color:var(--text-mid);white-space:nowrap">'
        + '<span style="font-weight:700;color:' + (c.pending ? 'var(--accent)' : 'var(--text-dim)') + '">' + c.pending + '</span> pending'
        + (done ? ' · ' + done + ' decided' : '') + (c.deferred ? ' · ' + c.deferred + ' deferred' : '')
        + (held ? ' · <span style="color:var(--accent);font-weight:700">' + (function () { var s = _ymHeldSplit(b), p = []; if (s.tab) p.push(s.tab + ' need a tab'); if (s.num) p.push(s.num + ' need a number'); return p.join(' \u00b7 '); })() + '</span>' : '') + '</div>'
        + '<button onclick="_ymBatchOpen(\'' + _esc(b.id) + '\')" style="padding:0.35rem 0.95rem;border-radius:8px;border:1px solid var(--accent2);'
        + 'background:var(--surface2);color:var(--accent2);font-family:var(--font-body);font-weight:700;cursor:pointer">Review →</button>'
        + (_dm && !(c.approved + c.edited + c.rejected + c.pending + c.deferred) ? '<span style="font-size:0.95rem;color:var(--text-dim)">rows in the archive tab</span>' : '')
        + (_dm ? '<button onclick="_ymPutBack(\'' + _esc(b.id) + '\')" title="Show this batch in the queue again" style="padding:0.35rem 0.95rem;border-radius:8px;border:1px solid var(--border);'
          + 'background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">Put back</button>' : '')
        + '</div>';
    }).join('');
    var _qbtn = 'padding:0.3rem 0.85rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer;font-size:0.95rem';
    var leftover = _ymArchivable().length;   // v0.9.1689: decided rows of cleared batches still in the working tab
    var qfoot = (finished.length || hidden.length || leftover)
      ? '<div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid var(--border)">'
        + (finished.length ? '<button onclick="_ymClearFinished()" title="Hides every committed batch with nothing left to do and moves its decided rows to the archive tab. Show finished brings a batch back." style="' + _qbtn + '">Clear finished (' + finished.length + ')</button>' : '')
        + (leftover ? '<button onclick="_ymArchiveLeftovers()" title="Decided rows of cleared batches are still in the working tab \u2014 move them to the archive so the Office loads faster" style="' + _qbtn + '">Archive ' + leftover + ' row' + (leftover === 1 ? '' : 's') + '</button>' : '')
        + (hidden.length ? '<button onclick="_ymToggleFinished()" style="' + _qbtn + '">' + (_ymShowFinished ? 'Hide finished' : 'Show ' + hidden.length + ' finished') + '</button>' : '')
        + '</div>'
      : '';
    html += _card('Catalog review queue' + (shown.length ? '' : ' — empty'),
      shown.length
        ? brows + qfoot   // v0.9.1712: the "read-only for now" line is gone — verdicts have worked since v0.9.1625
        : '<div style="color:var(--text-dim)">No crawl batches waiting. New sweeps land here automatically.</div>' + qfoot);

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

    // 3 — WHO IS USING THE APP (v0.9.1713, beta testers only)
    var counted = d.beta.filter(function (b) { return b.total > 0; }).length;
    var bsum = d.beta.reduce(function (acc, b) { acc.week += b.week; acc.total += b.total; return acc; }, { week: 0, total: 0 });
    var brws = d.beta.map(function (b) {
      var dim = 'color:var(--text-dim)';
      return '<tr>'
        + '<td style="padding:0.25rem 0.8rem 0.25rem 0;white-space:nowrap"><span style="font-weight:700;color:var(--text)">' + _esc(b.name || b.email) + '</span>'
          + (b.name ? '<br><span style="' + dim + ';font-size:0.95rem">' + _esc(b.email) + '</span>' : '') + '</td>'
        + '<td style="padding:0.25rem 0.8rem;font-weight:700;color:var(--text);text-align:right">' + b.week + '</td>'
        + '<td style="padding:0.25rem 0.8rem;font-weight:700;color:var(--text);text-align:right">' + b.total + '</td>'
        + '<td style="padding:0.25rem 0.8rem;' + dim + ';white-space:nowrap">' + (b.seen ? _esc(b.seen) : 'never') + '</td>'
        + '<td style="padding:0.25rem 0;' + dim + ';font-size:0.98rem">' + _esc(b.version) + '</td></tr>';
    }).join('');
    var bth = 'color:var(--text-dim);padding-right:0.8rem;text-align:right';
    html += _card('Who’s using the app' + (d.beta.length ? ' — ' + counted + ' of ' + d.beta.length + ' testers, ' + bsum.week + ' opens this week' : ''),
      d.beta.length
        ? '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:1.15rem">'
          + '<tr><td style="color:var(--text-dim);padding-right:0.8rem">tester</td><td style="' + bth + '">last 7 days</td><td style="' + bth + '">total</td>'
          + '<td style="color:var(--text-dim);padding-right:0.8rem">last seen</td><td style="color:var(--text-dim)">version</td></tr>'
          + brws + '</table></div>'
          + '<div style="margin-top:0.5rem;font-size:0.95rem;color:var(--text-dim)">Beta testers only — the relay (v4.0) counts one open each time a tester’s app loads; nobody outside the beta_testers tab is recorded.'
          + (counted ? '' : ' Counts start when relay v4.0 is in place.') + '</div>'
        : '<div style="color:var(--text-dim)">No beta_testers tab yet, or nobody enrolled.</div>');

    // 4 — THIS WEEK (anonymous devices per day)
    var urows = d.usage.map(function (u) {
      return '<tr><td style="padding:0.25rem 0.8rem 0.25rem 0;color:var(--text-dim);white-space:nowrap">' + _esc(u.date) + '</td>'
        + '<td style="padding:0.25rem 0.8rem;font-weight:700;color:var(--text)">' + _esc(u.opens) + '</td>'
        + '<td style="padding:0.25rem 0;color:var(--text-dim);font-size:0.98rem">' + _esc(u.versions) + '</td></tr>';
    }).join('');
    html += _card('App opens, last 7 days — devices per day',
      d.usage.length
        ? '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:1.15rem">'
          + '<tr><td style="color:var(--text-dim);padding-right:0.8rem">date</td><td style="color:var(--text-dim);padding-right:0.8rem">opens</td><td style="color:var(--text-dim)">versions</td></tr>'
          + urows + '</table></div>'
          + '<div style="margin-top:0.5rem;font-size:0.95rem;color:var(--text-dim)">Anonymous heartbeat: one per device per day, signed in or not — no names here by design.</div>'
        : '<div style="color:var(--text-dim)">No heartbeats counted yet — they start arriving as devices update to this release.</div>');

    page.innerHTML = html;
  };

  // ── v0.9.1688: clearing finished batches from the queue ────────
  // Everything below writes ONE cell per batch — the status cell of its
  // crawl_batches row, found by header — and nothing in crawl_deltas.
  var _ymShowFinished = false;
  var _ymStatusBusy = false;   // stability rule #5: one status write in flight
  // v0.9.1694 (S89 carried item #4): the SPLIT — a held row needs a tab OR
  // a number, and Brad fixes each with Edit. The card says which.
  function _ymHeldSplit(b) {
    var out = { tab: 0, num: 0 };
    if (!_ymData) return out;
    var validTabs = _ymMasterTabs();
    _ymData.deltas.forEach(function (dd) {
      if (dd.batch !== b.id || (dd.status !== 'approved' && dd.status !== 'edited')) return;
      if (!String(dd.num || '').trim()) out.num++;
      else if (validTabs.indexOf(String(dd.tab || '').trim()) < 0) out.tab++;
    });
    return out;
  }
  function _ymIsHeldRow(dd, validTabs) {
    if (dd.status !== 'approved' && dd.status !== 'edited') return false;
    return !String(dd.num || '').trim() || validTabs.indexOf(String(dd.tab || '').trim()) < 0;
  }
  function _ymHeldCount(b) {
    // approved/edited rows that could not land: blank number or no real tab
    var s = _ymHeldSplit(b);
    return s.tab + s.num;
  }
  // v0.9.1712: NOTE vs CHECK. Only a CHECK flag makes a row "flagged"; a
  // NOTE rides along in grey and the row counts as clean. If config.js has
  // not defined the rule (never expected), every flag is a check — the old,
  // stricter behaviour.
  function _ymFlagKind(dd) {
    if (!dd || !dd.flag) return '';
    return (typeof rrFlagKind === 'function') ? rrFlagKind(dd.flag) : 'check';
  }
  function _ymIsCheck(dd) { return _ymFlagKind(dd) === 'check'; }
  function _ymIsFinished(b) {
    var c = b.counts || {};
    return b.status === 'committed' && !c.pending && !c.deferred && !_ymHeldCount(b);
  }
  function _ymBatchStatusRange(b) {
    return 'crawl_batches!' + ((_ymData && _ymData.batchStatusCol) || 'E') + (b.sheetRow || 2);
  }
  async function _ymSetBatchStatus(list, status, doneMsg) {
    if (!_isOwner() || !_ymData || !list.length) return;
    if (_ymStatusBusy) { if (typeof showToast === 'function') showToast('Still saving the last change \u2014 one moment.', 2500); return; }
    _ymStatusBusy = true;
    try {
      var r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate',
        { method: 'POST',
          headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'RAW', data: list.map(function (b) { return { range: _ymBatchStatusRange(b), values: [[status]] }; }) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      list.forEach(function (b) { b.status = status; });   // local copies only after the Vault said yes
      if (doneMsg) {
        if (typeof showToast === 'function') showToast(doneMsg, 3000);
        window.ymBuildPage(false);
      }
      return true;
    } catch (e) {
      if (typeof showToast === 'function') showToast('That change didn\u2019t reach the Vault \u2014 check the connection and try again.', 4000, true);
      return false;
    } finally { _ymStatusBusy = false; }
  }
  // v0.9.1689: Clear finished = hide the batches AND move their decided
  // rows to the archive tab, after one confirm. If the archive half fails,
  // the batches stay hidden and "Archive N rows" appears — nothing is lost.
  window._ymClearFinished = async function () {
    if (!_ymData) return;
    var list = _ymData.batches.filter(function (b) { return b.status !== 'dismissed' && _ymIsFinished(b); });
    var ids = list.map(function (b) { return b.id; });
    var nRows = _ymData.deltas.filter(function (dd) { return ids.indexOf(dd.batch) >= 0; }).length + _ymArchivable().length;
    var lines = 'Hide ' + list.length + (list.length === 1 ? ' finished batch' : ' finished batches') + ' and move ' + nRows
      + ' decided row' + (nRows === 1 ? '' : 's') + ' to the archive tab (' + YM.ARCHIVE_TAB + ')? A dated backup of ' + YM.DELTAS_TAB
      + ' is written first. The rows stay in the Vault; the Office just stops loading them.';
    var yes = (typeof appConfirm === 'function')
      ? await appConfirm(lines, { title: 'Clear finished batches', ok: 'Back up, then clear' })
      : confirm(lines);
    if (!yes) return;
    if (!(await _ymSetBatchStatus(list, 'dismissed', ''))) return;
    var moved = await _ymArchiveRows(_ymDismissedIds());
    if (typeof showToast === 'function' && moved >= 0) showToast(list.length + (list.length === 1 ? ' batch cleared' : ' batches cleared') + ' \u00b7 ' + moved + ' row' + (moved === 1 ? '' : 's') + ' archived. Show finished brings a batch back.', 4500);
    _ymReload();
  };
  window._ymArchiveLeftovers = async function () {
    if (!_ymData) return;
    var n = _ymArchivable().length;
    var lines = 'Move ' + n + ' decided row' + (n === 1 ? '' : 's') + ' of cleared batches from ' + YM.DELTAS_TAB + ' to ' + YM.ARCHIVE_TAB + '? A dated backup is written first.';
    var yes = (typeof appConfirm === 'function')
      ? await appConfirm(lines, { title: 'Archive cleared rows', ok: 'Back up, then archive' })
      : confirm(lines);
    if (!yes) return;
    var moved = await _ymArchiveRows(_ymDismissedIds());
    if (typeof showToast === 'function' && moved >= 0) showToast(moved + ' row' + (moved === 1 ? '' : 's') + ' archived.', 3500);
    _ymReload();
  };
  function _ymDismissedIds() {
    return _ymData ? _ymData.batches.filter(function (b) { return b.status === 'dismissed'; }).map(function (b) { return b.id; }) : [];
  }
  // decided rows of cleared batches still sitting in the working tab (the cached view — for the button and the confirm only)
  function _ymArchivable() {
    if (!_ymData) return [];
    var dis = {};
    _ymDismissedIds().forEach(function (id) { dis[id] = 1; });
    return _ymData.deltas.filter(function (dd) { var st = dd.status || 'pending'; return dis[dd.batch] && st !== 'pending' && st !== 'deferred'; });
  }
  var _ymArchiveBusy = false;   // rule #5, again
  // THE MOVE. Order is everything: fresh read of the working tab (row
  // numbers must be current, never the cached copy) → dated CSV backup →
  // archive tab exists with the working tab's header → rows already
  // archived are skipped (a rerun after a half-finished move must not
  // double up) → append by header → the archive count VERIFIES → only then
  // the rows leave the working tab, highest row first, so no delete shifts
  // a later one. Returns rows moved, or -1 when it stopped (the toast said why).
  async function _ymArchiveRows(batchIds) {
    if (!_isOwner() || !batchIds.length) return 0;
    if (_ymArchiveBusy) { if (typeof showToast === 'function') showToast('An archive is already running \u2014 hold on.', 3000); return -1; }
    _ymArchiveBusy = true;
    var H = { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' };
    var today = new Date().toISOString().slice(0, 10);
    var SS = 'https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID;
    var colOf = _ymColLetter;
    var readVals = async function (range, what) {
      var r = await fetch(SS + '/values/' + encodeURIComponent(range), { headers: H });
      if (!r.ok) throw new Error('could not read ' + what + ' (HTTP ' + r.status + ')');
      return (await r.json()).values || [];
    };
    var idsIn = function (vals, idx) { var m = {}; vals.slice(1).forEach(function (r) { var v = String(r[idx] == null ? '' : r[idx]); if (v) m[v] = 1; }); return m; };
    try {
      // 1 — fresh read of the working tab
      var vals = await readVals(YM.DELTAS_TAB + '!A1:AZ', YM.DELTAS_TAB);
      var heads = (vals[0] || []).map(String);
      var iBatch = heads.indexOf('batch_id'), iId = heads.indexOf('delta_id'), iStatus = heads.indexOf('status');
      if (iBatch < 0 || iId < 0 || iStatus < 0) throw new Error(YM.DELTAS_TAB + ' is missing batch_id / delta_id / status in its header \u2014 stopped before any write');
      var want = {}; batchIds.forEach(function (id) { want[id] = 1; });
      var picks = [];
      vals.forEach(function (r, i) {
        if (i === 0) return;
        var st = String(r[iStatus] == null ? '' : r[iStatus]) || 'pending';
        var id = String(r[iId] == null ? '' : r[iId]);
        if (id && want[String(r[iBatch] == null ? '' : r[iBatch])] && st !== 'pending' && st !== 'deferred') picks.push({ row: i + 1, id: id, r: r });
      });
      if (!picks.length) return 0;
      // 2 — backup of the whole working tab FIRST (a failure here stops everything)
      var fq = encodeURIComponent("name='RailRoster Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      var ff = await fetch('https://www.googleapis.com/drive/v3/files?q=' + fq + '&fields=files(id)', { headers: { Authorization: H.Authorization } }).then(function (x) { return x.json(); });
      var folderId = ff.files && ff.files[0] && ff.files[0].id;
      if (!folderId) {
        var mk = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: H, body: JSON.stringify({ name: 'RailRoster Backups', mimeType: 'application/vnd.google-apps.folder' }) }).then(function (x) { return x.json(); });
        folderId = mk.id;
      }
      var bnd = 'rrbk' + Date.now();
      var meta = { name: YM.DELTAS_TAB + ' \u2014 backup ' + today + ' before archiving ' + picks.length + ' rows.csv', parents: [folderId] };
      var body = '--' + bnd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta)
        + '\r\n--' + bnd + '\r\nContent-Type: text/csv\r\n\r\n' + _ymCsv(vals) + '\r\n--' + bnd + '--';
      var up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: H.Authorization, 'Content-Type': 'multipart/related; boundary=' + bnd }, body: body });
      if (!up.ok) throw new Error('backup failed (HTTP ' + up.status + ') \u2014 nothing was archived');
      // 3 — the archive tab: create it with the working header, or extend its header if the working tab grew
      var sp = await fetch(SS + '?fields=sheets.properties', { headers: H });
      if (!sp.ok) throw new Error('could not read the Vault\u2019s tab list (HTTP ' + sp.status + ') \u2014 nothing was archived');
      var sheets = ((await sp.json()).sheets || []).map(function (x) { return x.properties; });
      var work = sheets.filter(function (x) { return x.title === YM.DELTAS_TAB; })[0];
      var arch = sheets.filter(function (x) { return x.title === YM.ARCHIVE_TAB; })[0];
      if (!work) throw new Error(YM.DELTAS_TAB + ' tab not found \u2014 nothing was archived');
      var aHeads;
      if (!arch) {
        var add = await fetch(SS + ':batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: YM.ARCHIVE_TAB, gridProperties: { rowCount: 1000, columnCount: heads.length + 4 } } } }] }) });
        if (!add.ok) throw new Error('could not create ' + YM.ARCHIVE_TAB + ' (HTTP ' + add.status + ') \u2014 nothing was archived');
        aHeads = heads.slice();
        var hw = await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: YM.ARCHIVE_TAB + '!A1', values: [aHeads] }] }) });
        if (!hw.ok) throw new Error('could not write the archive header (HTTP ' + hw.status + ') \u2014 nothing was archived');
      } else {
        aHeads = ((await readVals(YM.ARCHIVE_TAB + '!A1:AZ1', 'the archive header'))[0] || []).map(String);
        var missing = heads.filter(function (h) { return aHeads.indexOf(h) < 0; });
        if (missing.length) {
          aHeads = aHeads.concat(missing);   // new columns at the END — the column rule
          var hx = await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: YM.ARCHIVE_TAB + '!A1', values: [aHeads] }] }) });
          if (!hx.ok) throw new Error('could not extend the archive header (HTTP ' + hx.status + ') \u2014 nothing was archived');
        }
      }
      var aId = aHeads.indexOf('delta_id');
      if (aId < 0) throw new Error('the archive tab has no delta_id column \u2014 nothing was archived');
      // 4 — skip what a half-finished run already archived
      var aCol = colOf(aId);
      var have = idsIn(await readVals(YM.ARCHIVE_TAB + '!' + aCol + '1:' + aCol, 'the archive'), 0);
      var beforeA = Object.keys(have).length;
      var fresh = picks.filter(function (p) { return !have[p.id]; });
      // 5 — append BY HEADER, in chunks
      var rows = fresh.map(function (p) {
        return aHeads.map(function (h) { var i = heads.indexOf(h); return i < 0 || p.r[i] == null ? '' : p.r[i]; });
      });
      for (var ci = 0; ci < rows.length; ci += 500) {
        var ap = await fetch(SS + '/values/' + encodeURIComponent(YM.ARCHIVE_TAB + '!A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: H, body: JSON.stringify({ values: rows.slice(ci, ci + 500) }) });
        if (!ap.ok) throw new Error('archive append failed after ' + ci + ' rows (HTTP ' + ap.status + ') \u2014 nothing was removed from ' + YM.DELTAS_TAB + '; run Archive again, already-archived rows are skipped');
      }
      // 6 — the archive count VERIFIES before anything is removed
      var afterA = Object.keys(idsIn(await readVals(YM.ARCHIVE_TAB + '!' + aCol + '1:' + aCol, 'the archive'), 0)).length;
      if (afterA !== beforeA + fresh.length) throw new Error('archive count did not verify (expected ' + (beforeA + fresh.length) + ', found ' + afterA + ') \u2014 nothing was removed from ' + YM.DELTAS_TAB);
      // 7 — remove from the working tab: contiguous runs, highest first
      var rowsDesc = picks.map(function (p) { return p.row; }).sort(function (a, b) { return b - a; });
      var reqs = [], hi = rowsDesc[0], lo = rowsDesc[0];
      for (var ri = 1; ri <= rowsDesc.length; ri++) {
        var rr = rowsDesc[ri];
        if (rr === lo - 1) { lo = rr; continue; }
        reqs.push({ deleteDimension: { range: { sheetId: work.sheetId, dimension: 'ROWS', startIndex: lo - 1, endIndex: hi } } });
        hi = rr; lo = rr;
      }
      for (var di = 0; di < reqs.length; di += 300) {
        var del = await fetch(SS + ':batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ requests: reqs.slice(di, di + 300) }) });
        if (!del.ok) throw new Error('removing rows from ' + YM.DELTAS_TAB + ' stopped midway (HTTP ' + del.status + ') \u2014 the archive holds every row; run Archive again to finish, nothing is lost');
      }
      // 8 — verify none of the archived ids remain in the working tab
      var left = idsIn(await readVals(YM.DELTAS_TAB + '!' + colOf(iId) + '1:' + colOf(iId), YM.DELTAS_TAB), 0);
      var stray = picks.filter(function (p) { return left[p.id]; }).length;
      if (stray && typeof showToast === 'function') showToast(stray + ' archived row' + (stray === 1 ? ' is' : 's are') + ' still in ' + YM.DELTAS_TAB + ' \u2014 run Archive again.', 5000, true);
      return picks.length - stray;
    } catch (e) {
      // our own messages carry an em dash and say what to do; anything else
      // is a raw browser error the user cannot act on — say "connection"
      var why = (e && /\u2014/.test(String(e.message))) ? e.message : 'the connection dropped \u2014 nothing was removed from ' + YM.DELTAS_TAB + '; try again';
      if (typeof showToast === 'function') showToast('Archive stopped: ' + why, 7000, true);
      return -1;
    } finally { _ymArchiveBusy = false; }
  }
  window._ymToggleFinished = function () { _ymShowFinished = !_ymShowFinished; window.ymBuildPage(false); };
  window._ymPutBack = function (id) {
    if (!_ymData) return;
    var list = _ymData.batches.filter(function (b) { return b.id === id && b.status === 'dismissed'; });
    _ymSetBatchStatus(list, 'committed', 'Back in the queue.');
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
  // v0.9.1689: rows can MOVE now (the archive removes rows above them, and
  // a second Office tab may have done it). One read of the delta_id column;
  // every row about to be written must still carry the id the screen
  // thinks it has. On any mismatch: write NOTHING, reload, say so.
  async function _ymRowsStillMatch(list) {
    var bad = null;
    try {
      var col = (_ymData && _ymData.deltaIdCol) || 'B';
      var r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values/' + encodeURIComponent(YM.DELTAS_TAB + '!' + col + '1:' + col),
        { headers: { Authorization: 'Bearer ' + window.accessToken } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var ids = (await r.json()).values || [];
      bad = list.filter(function (dd) { var row = ids[dd.sheetRow - 1]; return !row || String(row[0] == null ? '' : row[0]) !== String(dd.id); });
    } catch (e) { bad = list; }   // could not check = do not write
    if (!bad.length) return true;
    if (typeof showToast === 'function') showToast('The queue changed underneath this screen \u2014 reloading it. Nothing was written; tap again.', 4500, true);
    _ymReload();
    return false;
  }
  // refetch the Vault and come back to the SAME view (batch or Office)
  function _ymReload() {
    return _fetchVault().then(function (d) {
      _ymData = _summarize(d); _ymErr = '';
      if (_ymBatchId) window._ymBatchOpen(_ymBatchId, true); else window.ymBuildPage(false);
    }).catch(function (e) {
      _ymErr = e.message; _ymData = null; _ymBatchId = '';
      window.ymBuildPage(false);
    });
  }
  window._ymApplyVerdicts = async function (pairs, recordUndo) {
    if (!_isOwner() || !pairs.length) return;
    if (!(await _ymRowsStillMatch(pairs.map(function (pr) { return pr.dd; })))) return;
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
      return dd.batch === _ymBatchId && !_ymIsCheck(dd) && (dd.status || 'pending') === 'pending';   // v0.9.1712: notes are clean
    });
    if (!clean.length) { if (typeof showToast === 'function') showToast('No clean pending rows left', 2500); return; }
    var go = function () { window._ymVerdictMany(clean, 'approved'); };
    if (typeof appConfirm === 'function') {
      appConfirm('Approve all ' + clean.length + ' clean pending rows?', { title: 'Approve clean rows', ok: 'Approve ' + clean.length })
        .then(function (yes) { if (yes) go(); });
    } else if (confirm('Approve all ' + clean.length + ' clean pending rows?')) go();
  };
  // ── v0.9.1712: one verdict for every pending row that carries the SAME flag ──
  // Brad: "I also need a faster way to approve multiple items that have the
  // same flag." The flag text is the key, exactly as the sheet holds it.
  window._ymVerdictFlag = function (flagText, status) {
    if (!_ymData) return;
    var want = String(flagText || '');
    var rows = _ymData.deltas.filter(function (dd) {
      return dd.batch === _ymBatchId && String(dd.flag || '') === want && (dd.status || 'pending') === 'pending';
    });
    if (!rows.length) { if (typeof showToast === 'function') showToast('No pending rows carry that flag any more', 2500); return; }
    var verb = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Defer';
    var go = function () { window._ymVerdictMany(rows, status); };
    var q = verb + ' all ' + rows.length + ' pending rows flagged \u201c' + want + '\u201d?';
    if (typeof appConfirm === 'function') {
      appConfirm(q, { title: verb + ' by flag', ok: verb + ' ' + rows.length }).then(function (yes) { if (yes) go(); });
    } else if (confirm(q)) go();
  };
  // ── v0.9.1714: PRE-SORT — Brad: "flag the obvious junk as a CHECK and
  // leave the obvious trains clean." Pending rows of the community batch
  // only. Each row gets its reasons from config's lists (rrPreSortReasons),
  // a "duplicate — filed again" mark when the same number + variation is
  // already earlier in the batch (same maker, or maker unknown on one side —
  // never two different known makers), and a tab from _ymTabFor when it had
  // none. Only the flag and an EMPTY proposed tab are rewritten — no
  // verdicts, so there is nothing to undo; running it again re-derives the
  // same flags. The per-flag strip then rejects a whole reason in one tap.
  // The flag a row ends up with. One shape, used at queue time AND by the
  // Pre-sort, so the per-flag strip groups cleanly: a duplicate carries ONLY
  // "duplicate — filed again" (its first copy carries the real reasons); a
  // junk row carries its reasons and no "needs a tab" tail (it is getting
  // eyes anyway — if Brad keeps it, the commit holds it until he picks a
  // tab, as v1628 always did); a clean row carries the tab / number needs.
  function _ymShapeFlag(reasons, tab, num, maker, isDup) {
    if (isDup) return 'duplicate \u2014 filed again';
    var flag = reasons.slice();
    if (!flag.length && !tab) flag.push(_ymNoTabFlag(maker));
    if (!num) flag.push('needs a number');
    return flag.join('; ');
  }
  function _ymPreSortPlan(rows) {
    var seen = {}, plan = [];
    var inv = _ymInventoryRows(rows);   // v0.9.1716: needs the whole batch
    rows.forEach(function (dd) {
      var maker = _ymDeltaMaker(dd), m = _ymMakerNorm(maker), isDup = false;
      var reasons = _ymPreSortReasons({ maker: maker, num: dd.num, desc: dd.desc, notes: dd.notes });
      if (inv[dd.id]) reasons.unshift('a list number, not a catalog number');   // v0.9.1716
      if (dd.num) {
        var bare = _ymDupKey('', dd.num, dd.variation), prev = seen[bare];
        if (prev && (!m || prev.unknown || prev.makers[m])) isDup = true;
        else { prev = prev || { makers: {}, unknown: false }; if (m) prev.makers[m] = 1; else prev.unknown = true; seen[bare] = prev; }
      }
      var tab = String(dd.tab || '') || _ymTabFor(maker, dd.num, dd.desc);
      // v0.9.1715: fill a BLANK type only — a type already on the row, whether
      // the crawl's or one Brad typed in Edit, is never overwritten.
      var type = String(dd.type || '') || _ymTypeFor(dd.num, dd.desc);
      var newFlag = _ymShapeFlag(reasons, tab, dd.num, maker, isDup);
      // a row queued before v1714 knows its maker only from the old flag text
      // or its tab; once the flag is rewritten that would be gone — so the
      // maker is filed into the notes first, the way v1714 queues rows.
      var notes = (maker && !/(?:^|; )maker /.test(String(dd.notes || ''))) ? (String(dd.notes || '') + (dd.notes ? '; ' : '') + 'maker ' + maker) : null;
      plan.push({ dd: dd, tab: tab, type: type, flag: newFlag, notes: notes, reasons: isDup ? ['duplicate \u2014 filed again'] : reasons,
                  changed: newFlag !== String(dd.flag || '') || tab !== String(dd.tab || '') || type !== String(dd.type || '') || notes !== null });
    });
    return plan;
  }
  var _ymPreSortBusy = false;
  window._ymPreSort = async function () {
    if (!_isOwner() || !_ymData || _ymBatchId !== SUBS_BATCH || _ymPreSortBusy) return;
    var toast = function (msg, bad) { if (typeof showToast === 'function') showToast(msg, bad ? 5000 : 3000, !!bad); };
    var rows = _ymData.deltas.filter(function (dd) { return dd.batch === SUBS_BATCH && (dd.status || 'pending') === 'pending'; });
    if (!rows.length) { toast('No pending rows to sort'); return; }
    var plan = _ymPreSortPlan(rows), changed = plan.filter(function (x) { return x.changed; });
    if (!changed.length) { toast('Already sorted \u2014 nothing would change'); return; }
    var counts = {};
    plan.forEach(function (x) { x.reasons.forEach(function (r) { var k = r.split(' \u2014 ')[0]; counts[k] = (counts[k] || 0) + 1; }); });
    var summary = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).map(function (k) { return counts[k] + ' ' + k; });
    var gotTab = plan.filter(function (x) { return x.tab && !x.dd.tab; }).length;
    var gotType = plan.filter(function (x) { return x.type && !x.dd.type; }).length;   // v0.9.1715
    var clean = plan.filter(function (x) { return !x.reasons.length && x.tab && x.dd.num; }).length;
    var q = 'Pre-sort ' + rows.length + ' pending rows? ' + (summary.length ? summary.join(' \u00b7 ') + '. ' : '')
      + clean + ' come out clean' + (gotTab ? ', ' + gotTab + ' get a tab' : '') + (gotType ? ', ' + gotType + ' get a type read from the description' : '')
      + '. Flags are rewritten (' + changed.length
      + ' row' + (changed.length === 1 ? '' : 's') + ' change); nothing is approved or rejected.';
    var yes = (typeof appConfirm === 'function') ? await appConfirm(q, { title: 'Pre-sort', ok: 'Sort ' + changed.length }) : confirm(q);
    if (!yes) return;
    _ymPreSortBusy = true;
    try {
      if (!(await _ymRowsStillMatch(changed.map(function (x) { return x.dd; })))) return;   // v0.9.1689 guard
      var cols = (_ymData && _ymData.deltaCols) || { tab: 'D', type: 'F', flag: 'O', notes: 'U' };
      var data = [];
      changed.forEach(function (x) {
        if (x.tab !== String(x.dd.tab || '')) data.push({ range: YM.DELTAS_TAB + '!' + cols.tab + x.dd.sheetRow, values: [[x.tab]] });
        if (x.type !== String(x.dd.type || '')) data.push({ range: YM.DELTAS_TAB + '!' + cols.type + x.dd.sheetRow, values: [[x.type]] });   // v0.9.1715
        if (x.flag !== String(x.dd.flag || '')) data.push({ range: YM.DELTAS_TAB + '!' + cols.flag + x.dd.sheetRow, values: [[x.flag]] });
        if (x.notes !== null) data.push({ range: YM.DELTAS_TAB + '!' + cols.notes + x.dd.sheetRow, values: [[x.notes]] });
      });
      var H = { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' };
      for (var i = 0; i < data.length; i += 400) {   // a few hundred cells per request, in order
        var r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate',
          { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: data.slice(i, i + 400) }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
      }
      toast('Pre-sorted ' + changed.length + ' row' + (changed.length === 1 ? '' : 's') + ' \u2014 use the per-flag strip to reject a whole reason at once');
    } catch (e) {
      toast('Pre-sort stopped: ' + (e && e.message) + ' \u2014 reloading; run it again', true);
    } finally {
      _ymPreSortBusy = false;
      _ymReload();
    }
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
    if (!(await _ymRowsStillMatch([dd]))) return;   // v0.9.1689
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

  // ── v0.9.1694: QUEUE INTO REVIEW — submissions + barcode pairs ────
  // Brad: the Waiting card used to send him to the spreadsheet. Now one
  // button turns every waiting submission and barcode pairing into review
  // rows in two ROLLING batches, and stamps the source row 'queued' so it
  // is counted once and never re-queued. The rows are then approved,
  // edited or rejected exactly like a crawl batch. Nothing here touches
  // the master.
  var SUBS_BATCH = 'CB-COMMUNITY-SUBS', PAIRS_BATCH = 'CB-BARCODE-PAIRS';
  // the ONE tab a maker maps to, or '' when the maker has several (Lionel
  // has four, MTH five) — then the row is flagged and Brad picks in Edit
  // v0.9.1714: makers compare through config's alias map ("K-Line by Lionel"
  // → k-line) when config.js is loaded; plain lowercase otherwise.
  function _ymMakerNorm(mfr) {
    return (typeof rrMakerNorm === 'function') ? rrMakerNorm(mfr) : String(mfr || '').trim().toLowerCase();
  }
  function _ymMakerTabs(mfr) {
    var m = _ymMakerNorm(mfr);
    if (!m || typeof ERAS === 'undefined' || typeof ERA_TABS === 'undefined') return [];
    var tabs = [];
    Object.keys(ERAS).forEach(function (id) {
      var e = ERAS[id];
      if (e && String(e.manufacturer || '').toLowerCase() === m && ERA_TABS[id] && ERA_TABS[id].items && tabs.indexOf(ERA_TABS[id].items) < 0) tabs.push(ERA_TABS[id].items);
    });
    return tabs;
  }
  function _ymTabForMaker(mfr) {
    var tabs = _ymMakerTabs(mfr);
    return tabs.length === 1 ? tabs[0] : '';
  }
  // v0.9.1714: two more ways to a tab, both Brad's rules (2026-09-11):
  //  • Lionel with a modern 5-to-7-digit number ("6-12345", "27780",
  //    "2401150") → the MPC-Modern tab, unless the description says HO or
  //    S gauge; a 4-digit postwar-style number still needs his pick.
  //  • a small O-gauge brand from RR_OTHER_O_BRANDS → the Other O Brands tab.
  // Era ids (mpc, mod_ho, mod_s, other_o) are the stable handles; the tab
  // NAMES come from ERA_TABS and are never typed here.
  function _ymTabFor(mfr, num, desc) {
    var one = _ymTabForMaker(mfr);
    if (one) return one;
    var m = _ymMakerNorm(mfr), d = ' ' + String(desc || '') + ' ';
    var tabOf = function (id) { return (typeof ERA_TABS !== 'undefined' && ERA_TABS[id] && ERA_TABS[id].items) || ''; };
    if (m === 'lionel') {
      if (/^\d{5,7}$/.test(String(num || '').trim().replace(/^6-/, ''))) {
        if (/[^a-z0-9]HO[^a-z0-9]/.test(d)) return tabOf('mod_ho');
        if (/[^a-z0-9]S[- ](gauge|scale)[^a-z0-9]/i.test(d)) return tabOf('mod_s');
        return tabOf('mpc');
      }
      return '';
    }
    if (typeof RR_OTHER_O_BRANDS !== 'undefined' && RR_OTHER_O_BRANDS.indexOf(m) >= 0) return tabOf('other_o');
    return '';
  }
  // v0.9.1714: the no-tab flag says WHY — "has several" only when that is
  // true; a maker the app has no tab for at all says so instead.
  function _ymNoTabFlag(mfr) {
    var m = String(mfr || '').trim();
    if (!m) return 'needs a tab \u2014 no maker given';
    return _ymMakerTabs(m).length > 1 ? 'needs a tab \u2014 ' + m + ' has several' : 'needs a tab \u2014 no tab yet for ' + m;
  }
  // v0.9.1714: config's pre-sort reasons, or none when config is not loaded
  // (the old behaviour — never a guess).
  function _ymPreSortReasons(o) {
    try { return (typeof rrPreSortReasons === 'function') ? (rrPreSortReasons(o) || []) : []; } catch (e) { return []; }
  }
  // v0.9.1715: the type read out of the description, or '' when config.js is
  // not loaded or nothing in the words names a body.
  function _ymTypeFor(num, desc) {
    try { return (typeof rrTypeFromDescription === 'function') ? (rrTypeFromDescription(num, desc) || '') : ''; } catch (e) { return ''; }
  }
  // v0.9.1716: which of these rows carry a list number rather than a catalog
  // number. Batch-wide — the answer for one row depends on its neighbours.
  function _ymInventoryRows(list) {
    try {
      if (typeof rrInventoryRows !== 'function') return {};
      return rrInventoryRows(list.map(function (dd) { return { id: dd.id, num: dd.num, desc: dd.desc }; })) || {};
    } catch (e) { return {}; }
  }
  // v0.9.1714: a delta's maker — from "maker X" in its notes (queued by
  // v1714+), else the maker whose ONE tab it carries, else the maker named
  // in an old needs-a-tab flag. '' when nothing says.
  function _ymDeltaMaker(dd) {
    var mm = String(dd.notes || '').match(/(?:^|; )maker ([^;]+)/);
    if (mm) return mm[1].trim();
    if (dd.tab && typeof ERAS !== 'undefined' && typeof ERA_TABS !== 'undefined') {
      var found = '';
      Object.keys(ERAS).forEach(function (id) { if (!found && ERA_TABS[id] && ERA_TABS[id].items === dd.tab && ERAS[id]) found = String(ERAS[id].manufacturer || ''); });
      if (found) return found;
    }
    var fm = String(dd.flag || '').match(/needs a tab \u2014 (?:no tab yet for )?(.+?)(?: has several)?(?:;|$)/);
    return (fm && fm[1].trim() !== 'no maker given') ? fm[1].trim() : '';
  }
  // the cross-run duplicate key: number + variation (+ maker when known)
  function _ymDupKey(mfr, num, variation) {
    var k = String(num || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') + '|' + String(variation || '').trim().toLowerCase();
    var m = _ymMakerNorm(mfr);
    return m ? m + '|' + k : k;
  }
  var _ymQueueBusy = false;
  window._ymQueueWaiting = async function () {
    if (!_isOwner() || !_ymData || _ymQueueBusy) return;
    var subs = _ymData.subRows || [], pairs = _ymData.pairRows || [];
    if (!subs.length && !pairs.length) return;
    var lines = 'Queue ' + (subs.length ? subs.length + ' community submission' + (subs.length === 1 ? '' : 's') : '')
      + (subs.length && pairs.length ? ' and ' : '') + (pairs.length ? pairs.length + ' barcode pairing' + (pairs.length === 1 ? '' : 's') : '')
      + ' into the review queue? Numbers already in the catalog are skipped and marked; a number filed twice becomes one row. Each row is then approved, edited or rejected like a crawl batch.';
    var yes = (typeof appConfirm === 'function') ? await appConfirm(lines, { title: 'Queue into review', ok: 'Queue them' }) : confirm(lines);
    if (!yes) return;
    _ymQueueBusy = true;
    var H = { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'application/json' };
    var SS = 'https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID;
    var today = new Date().toISOString().slice(0, 10);
    try {
      // headers, by name, fresh
      var dhRes = await fetch(SS + '/values/' + encodeURIComponent(YM.DELTAS_TAB + '!A1:AZ1'), { headers: H });
      var bhRes = await fetch(SS + '/values/' + encodeURIComponent('crawl_batches!A1:Z1'), { headers: H });
      if (!dhRes.ok || !bhRes.ok) throw new Error('could not read the queue headers \u2014 nothing was queued');
      var dh = ((await dhRes.json()).values || [[]])[0].map(String), bh = ((await bhRes.json()).values || [[]])[0].map(String);
      var ex = (await (await fetch(SS + '/values/' + encodeURIComponent('crawl_batches!A1:G'), { headers: H })).json()).values || [];
      var bAt = function (h) { return bh.indexOf(h); };
      var ensureBatch = async function (id, label, note) {
        var idx = -1; ex.forEach(function (r, i) { if (String(r[bAt('batch_id')] || '') === id) idx = i; });
        if (idx < 0) {
          var row = bh.map(function (h) { return { batch_id: id, source: 'The Rail Roster users (relay)', created: today, label: label, status: 'pending', total: '0', note: note }[h] || ''; });
          var ap = await fetch(SS + '/values/' + encodeURIComponent('crawl_batches!A1:G') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: H, body: JSON.stringify({ values: [row] }) });
          if (!ap.ok) throw new Error('could not create the ' + label + ' batch \u2014 nothing was queued');
          ex.push(row); idx = ex.length - 1;
        } else if (['committed', 'dismissed'].indexOf(String(ex[idx][bAt('status')] || '')) >= 0) {
          // a rolling batch reopens when new rows arrive
          await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'crawl_batches!' + _ymColLetter(bAt('status')) + (idx + 1), values: [['pending']] }] }) });
        }
        return idx + 1;   // sheet row
      };
      // existing delta ids in these batches, so sequence numbers never collide
      var idsRes = await fetch(SS + '/values/' + encodeURIComponent(YM.DELTAS_TAB + '!A1:B'), { headers: H });
      var seq = {}; seq[SUBS_BATCH] = 0; seq[PAIRS_BATCH] = 0;
      ((await idsRes.json()).values || []).slice(1).forEach(function (r) {
        var b = String(r[0] || ''), id = String(r[1] || ''); var m = id.match(/-(\d+)$/);
        if (seq[b] != null && m) seq[b] = Math.max(seq[b], parseInt(m[1], 10) || 0);
      });
      var mk = function (o) { return dh.map(function (h) { return o[h] == null ? '' : String(o[h]); }); };
      var rows = [], stampSubs = [], stampPairs = [], stampYes = [];
      // v0.9.1695: a submission whose number is ALREADY in the master today
      // (the catalog grew since it was filed) is not a candidate — it is
      // stamped in_master=yes, the relay's own meaning, and never queued.
      // One read of every real tab's Item Number column, ~2 s.
      var inMaster = {};
      try {
        var MID2 = (typeof MASTER_SHEET_ID !== 'undefined') ? MASTER_SHEET_ID : '';
        var tabsAll = _ymMasterTabs();
        var mg = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID2 + '/values:batchGet?' + tabsAll.map(function (t) { return 'ranges=' + encodeURIComponent("'" + t + "'!A2:A"); }).join('&'), { headers: H });
        if (!mg.ok) throw new Error('master read ' + mg.status);
        ((await mg.json()).valueRanges || []).forEach(function (vr, i) {
          (vr.values || []).forEach(function (r) { var n = String(r[0] == null ? '' : r[0]).trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (n && !inMaster[n]) inMaster[n] = tabsAll[i]; });
        });
      } catch (e) { throw new Error('could not read the master item numbers \u2014 nothing was queued (try again)'); }
      var normNum = function (n) { return String(n || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      // v0.9.1714: a number already WAITING in the queue is not queued again
      // (the 2026-09-11 batch held 565 second copies from a second run). The
      // filing is stamped queued — it IS in the queue, as the first copy.
      var pendingKeys = {};
      (_ymData.deltas || []).forEach(function (dd) {
        if (dd.batch !== SUBS_BATCH || (dd.status || 'pending') !== 'pending' || !dd.num) return;
        pendingKeys[_ymDupKey(_ymDeltaMaker(dd), dd.num, dd.variation)] = 1;
        pendingKeys[_ymDupKey('', dd.num, dd.variation)] = 1;
      });
      var seenSub = {};
      subs = subs.filter(function (s) {
        var k = normNum(s.num);
        if (k && inMaster[k]) { stampYes.push(s.row); return false; }          // already in the catalog now
        var dk = (s.mfr || '').toLowerCase() + '|' + k + '|' + (s.variation || '').toLowerCase();
        if (k && seenSub[dk]) { stampSubs.push(s.row); return false; }         // same item filed twice — one review row, both stamped
        if (k && (pendingKeys[_ymDupKey(s.mfr, s.num, s.variation)] || pendingKeys[_ymDupKey('', s.num, s.variation)])) { stampSubs.push(s.row); return false; }   // v0.9.1714: already waiting
        seenSub[dk] = 1; return true;
      });
      if (subs.length) {
        var sRow = await ensureBatch(SUBS_BATCH, 'Community submissions (not in the catalog)', 'rolling \u2014 grows as users add items the catalog lacks');
        subs.forEach(function (s) {
          // v0.9.1714: junk reasons first (config lists), then the tab rules
          var tab = _ymTabFor(s.mfr, s.num, s.desc);
          var flag = _ymShapeFlag(_ymPreSortReasons({ maker: s.mfr, num: s.num, desc: s.desc, notes: s.source ? 'via ' + s.source : '' }), tab, s.num, s.mfr, false);
          rows.push(mk({ batch_id: SUBS_BATCH, delta_id: SUBS_BATCH + '-' + String(++seq[SUBS_BATCH]).padStart(4, '0'), action: 'add', proposed_tab: tab,
            item_num: s.num, item_type: _ymTypeFor(s.num, s.desc), road_name: s.road, description: s.desc, gauge: '', variation: s.variation, years: '', ref_link: '', msrp: '',   // v0.9.1715: the type, read from the description
            source: 'community submission' + (s.updated ? ' ' + String(s.updated).slice(0, 10) : ''), flag: flag, status: 'pending', decided: '',
            image_url: '', var_desc: '', sub_type: '', notes: 'submissions row ' + s.row + (s.mfr ? '; maker ' + s.mfr : '') + (s.condition ? '; condition ' + s.condition : '') + (s.source ? '; via ' + s.source : ''), category: '' }));
          stampSubs.push(s.row);
        });
        var subTotal = seq[SUBS_BATCH];
        await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'crawl_batches!' + _ymColLetter(bAt('total')) + sRow, values: [[String(subTotal)]] }] }) });
      }
      if (pairs.length) {
        var pRow = await ensureBatch(PAIRS_BATCH, 'Barcode pairings (UPC \u2192 item)', 'rolling \u2014 from users\u2019 scans; approving writes the UPC onto the master row');
        pairs.forEach(function (p) {
          var tab = _ymTabForMaker(p.mfr), flag = [];
          if (!tab) flag.push(_ymNoTabFlag(p.mfr));   // v0.9.1714: same wording helper
          if (!p.num) flag.push('needs a number');
          if (!/^\d{8,14}$/.test(p.upc)) flag.push('UPC looks wrong');
          rows.push(mk({ batch_id: PAIRS_BATCH, delta_id: PAIRS_BATCH + '-' + String(++seq[PAIRS_BATCH]).padStart(4, '0'), action: 'barcode', proposed_tab: tab,
            item_num: p.num, item_type: '', road_name: '', description: 'UPC ' + p.upc + ' \u2192 ' + p.num + (p.mfr ? ' (' + p.mfr + ')' : ''), gauge: '', variation: '', years: '', ref_link: '', msrp: '',
            source: 'barcode pairing from users\u2019 scans', flag: flag.join('; '), status: 'pending', decided: '',
            image_url: '', var_desc: '', sub_type: '', notes: 'UPC ' + p.upc + '; barcode_pairs row ' + p.row + (p.count ? '; reported ' + p.count + 'x' : '') + (p.how ? '; how: ' + p.how : ''), category: '' }));
          stampPairs.push(p.row);
        });
        await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'crawl_batches!' + _ymColLetter(bAt('total')) + pRow, values: [[String(seq[PAIRS_BATCH])]] }] }) });
      }
      // deltas first, then the source stamps — a stamp without a row would lose the item
      for (var i = 0; i < rows.length; i += 200) {
        var ap2 = await fetch(SS + '/values/' + encodeURIComponent(YM.DELTAS_TAB + '!A1:V') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: H, body: JSON.stringify({ values: rows.slice(i, i + 200) }) });
        if (!ap2.ok) throw new Error('queue append failed after ' + i + ' rows (HTTP ' + ap2.status + ') \u2014 source rows were NOT marked; run Queue again');
      }
      var data = [];
      stampYes.forEach(function (r) { data.push({ range: 'submissions!' + _ymData.subInMasterCol + r, values: [['yes']] }); });
      stampSubs.forEach(function (r) { data.push({ range: 'submissions!' + _ymData.subInMasterCol + r, values: [['queued']] }); });
      stampPairs.forEach(function (r) { data.push({ range: 'barcode_pairs!' + _ymData.pairStatusCol + r, values: [['queued']] }); });
      if (data.length) {
        var st = await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: data }) });
        if (!st.ok) throw new Error('the rows were queued but the source rows could not be marked (HTTP ' + st.status + ') \u2014 they will show as waiting again; do not re-queue, tell Claude');
      }
      if (typeof showToast === 'function') showToast(rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' queued into review' + (stampYes.length ? '; ' + stampYes.length + ' already in the catalog, marked yes' : '') + '.', 5000);
      _ymReload();
    } catch (e) {
      if (typeof showToast === 'function') showToast('Queue stopped: ' + ((e && /\u2014/.test(String(e.message))) ? e.message : 'the connection dropped \u2014 nothing was marked; try again'), 7000, true);
    } finally { _ymQueueBusy = false; }
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
    // v0.9.1694: a barcode batch commits by a different path — it EDITS one
    // cell of an existing row instead of appending. Never mixed with adds.
    if (approved.every(function (dd) { return dd.action === 'barcode'; })) { await _ymCommitBarcodes(b, approved, MID, H, today); return; }
    if (approved.some(function (dd) { return dd.action === 'barcode'; })) { if (typeof showToast === 'function') showToast('This batch mixes barcode rows with catalog rows \u2014 it cannot commit as one. Tell Claude.', 6000, true); return; }
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
        await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: _ymBatchStatusRange(b), values: [['committed']] }] }) });
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
          var _colL = _ymColLetter(_newIdx);   // v0.9.1689: one letter helper for the whole file
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
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: _ymBatchStatusRange(b), values: [['committed']] }] }) });
      b.status = 'committed';
      _ymUndoStack = null;
      if (b.id === SUBS_BATCH) await _ymStampSubmissions(H);   // v0.9.1694: yes / rejected back onto the submissions tab
      if (typeof showToast === 'function') showToast('Committed \u2014 ' + appended + ' rows added to the master catalog. Backups are in RailRoster Backups.', 6000);
      window.ymBuildPage(true);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Commit stopped: ' + (e && e.message), 6000, true);
    } finally {
      window._ymCommitBusy = false;
    }
  };
  // v0.9.1694: after the submissions batch lands, tell the submissions tab
  // what became of each row (in_master yes / rejected) — by the row number
  // the delta's notes carry, verified against a fresh read of that column.
  async function _ymStampSubmissions(H) {
    try {
      var SS = 'https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID;
      var col = _ymData.subInMasterCol || 'H';
      var cur = (await (await fetch(SS + '/values/' + encodeURIComponent('submissions!' + col + '1:' + col), { headers: H })).json()).values || [];
      var data = [];
      _ymData.deltas.forEach(function (dd) {
        if (dd.batch !== SUBS_BATCH) return;
        var m = String(dd.notes || '').match(/submissions row (\d+)/); if (!m) return;
        var row = parseInt(m[1], 10), now = String((cur[row - 1] || [])[0] || '').toLowerCase();
        if (now !== 'queued') return;   // only rows this queue marked; never touch anything else
        if (dd.status === 'approved' || dd.status === 'edited') data.push({ range: 'submissions!' + col + row, values: [['yes']] });
        else if (dd.status === 'rejected') data.push({ range: 'submissions!' + col + row, values: [['rejected']] });
      });
      if (data.length) await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: data }) });
    } catch (e) { if (typeof showToast === 'function') showToast('Committed, but the submissions tab could not be marked \u2014 tell Claude.', 5000, true); }
  }

  // v0.9.1694: BARCODE COMMIT — the cockpit's first edit of a live master
  // row, and it is as narrow as it can be (Brad approved these guards):
  // one cell, only the "UPC / Barcode" column, only when that cell is empty
  // or already equal, the Item Number re-read at that row right before the
  // write, a dated backup of the tab first, and rows that cannot be placed
  // are HELD and said. The column is added at the END of the tab when it is
  // missing (the v1683 Image URL precedent — a header cell, never a row).
  async function _ymCommitBarcodes(b, approved, MID, H, today) {
    var validTabs = _ymMasterTabs(), byTab = {}, heldNoTab = [], heldNoNum = [], heldBadUpc = [];
    approved.forEach(function (dd) {
      var upc = (String(dd.notes || '').match(/UPC (\d{8,14})/) || [])[1] || '';
      var t = String(dd.tab || '').trim();
      if (!String(dd.num || '').trim()) heldNoNum.push(dd);
      else if (!upc) heldBadUpc.push(dd);
      else if (validTabs.indexOf(t) >= 0) { dd._upc = upc; (byTab[t] = byTab[t] || []).push(dd); }
      else heldNoTab.push(dd);
    });
    if (window._ymCommitBusy) { if (typeof showToast === 'function') showToast('A commit is already running \u2014 hold on.', 3000); return; }
    window._ymCommitBusy = true;
    try {
      var tabs = Object.keys(byTab), plan = {}, heldNotFound = [], heldDifferent = [], writes = 0, same = 0;
      for (var ti = 0; ti < tabs.length; ti++) {
        var t = tabs[ti];
        var gotRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID + '/values/' + encodeURIComponent("'" + t + "'!A1:AD"), { headers: H });
        if (!gotRes.ok) throw new Error('could not read ' + t + ' (HTTP ' + gotRes.status + ') \u2014 stopped before any write');
        var vals = (await gotRes.json()).values || [], heads = (vals[0] || []).map(String);
        var numIdx = heads.indexOf('Item Number'), upcIdx = heads.indexOf('UPC / Barcode');
        if (numIdx < 0) throw new Error(t + ' has no Item Number column \u2014 stopped before any write');
        var byNum = {};
        vals.slice(1).forEach(function (r, i) { var n = String(r[numIdx] == null ? '' : r[numIdx]).trim(); if (n && byNum[n] == null) byNum[n] = i + 2; });
        var todo = [];
        byTab[t].forEach(function (dd) {
          var row = byNum[String(dd.num).trim()];
          if (!row) { heldNotFound.push(dd); return; }
          var cur = upcIdx >= 0 ? String((vals[row - 1] || [])[upcIdx] == null ? '' : vals[row - 1][upcIdx]).trim() : '';
          if (cur && cur !== dd._upc) { heldDifferent.push(dd); return; }
          if (cur === dd._upc) { same++; dd._done = true; return; }
          todo.push({ dd: dd, row: row });
        });
        plan[t] = { vals: vals, heads: heads, numIdx: numIdx, upcIdx: upcIdx, todo: todo };
      }
      var total = 0; tabs.forEach(function (t) { total += plan[t].todo.length; });
      var lines = 'Write ' + total + ' UPC' + (total === 1 ? '' : 's') + ' onto existing master rows'
        + (tabs.length ? ' (' + tabs.map(function (t) { return plan[t].todo.length + ' in ' + t; }).join(', ') + ')' : '') + '.'
        + (same ? ' ' + same + ' already there.' : '') + (heldNotFound.length ? ' ' + heldNotFound.length + ' held \u2014 number not in that tab.' : '')
        + (heldDifferent.length ? ' ' + heldDifferent.length + ' held \u2014 a different UPC is already on the row.' : '')
        + (heldNoTab.length ? ' ' + heldNoTab.length + ' held \u2014 no tab.' : '') + (heldNoNum.length ? ' ' + heldNoNum.length + ' held \u2014 no number.' : '')
        + (heldBadUpc.length ? ' ' + heldBadUpc.length + ' held \u2014 no usable UPC.' : '')
        + ' One cell per row, nothing else on the row is touched. Dated backups first.';
      if (!total) {
        if (typeof showToast === 'function') showToast(lines.replace(/^Write 0 UPCs[^.]*\./, 'Nothing to write.'), 7000);
        if (!heldNotFound.length && !heldDifferent.length && !heldNoTab.length && !heldNoNum.length && !heldBadUpc.length) {
          await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: _ymBatchStatusRange(b), values: [['committed']] }] }) });
          b.status = 'committed'; await _ymStampPairs(H); window.ymBuildPage(true);
        }
        return;
      }
      var yes = (typeof appConfirm === 'function') ? await appConfirm(lines, { title: 'Write UPCs onto master rows', ok: 'Back up, then write' }) : confirm(lines);
      if (!yes) return;
      // backups first — every tab that will be touched
      var fq = encodeURIComponent("name='RailRoster Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      var ff = await fetch('https://www.googleapis.com/drive/v3/files?q=' + fq + '&fields=files(id)', { headers: { Authorization: H.Authorization } }).then(function (x) { return x.json(); });
      var folderId = ff.files && ff.files[0] && ff.files[0].id;
      if (!folderId) { var mk = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: H, body: JSON.stringify({ name: 'RailRoster Backups', mimeType: 'application/vnd.google-apps.folder' }) }).then(function (x) { return x.json(); }); folderId = mk.id; }
      for (var bi = 0; bi < tabs.length; bi++) {
        var t3 = tabs[bi]; if (!plan[t3].todo.length) continue;
        var bnd = 'rrbk' + Date.now();
        var meta = { name: t3 + ' \u2014 backup ' + today + ' before ' + b.id + ' (UPC write).csv', parents: [folderId] };
        var body = '--' + bnd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + bnd + '\r\nContent-Type: text/csv\r\n\r\n' + _ymCsv(plan[t3].vals) + '\r\n--' + bnd + '--';
        var up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: H.Authorization, 'Content-Type': 'multipart/related; boundary=' + bnd }, body: body });
        if (!up.ok) throw new Error('backup failed for ' + t3 + ' (HTTP ' + up.status + ') \u2014 nothing was written');
      }
      for (var wi = 0; wi < tabs.length; wi++) {
        var t4 = tabs[wi], p = plan[t4]; if (!p.todo.length) continue;
        // the column, at the END, if the tab never had one (header cell only)
        if (p.upcIdx < 0) {
          if (typeof sheetsUpdate !== 'function') throw new Error('sheetsUpdate unavailable \u2014 reload the app');
          await sheetsUpdate(MID, "'" + t4 + "'!" + _ymColLetter(p.heads.length) + '1', [['UPC / Barcode']]);
          p.upcIdx = p.heads.length; p.heads = p.heads.concat(['UPC / Barcode']);
        }
        // VERIFY: re-read the Item Number cell of every target row, right now
        var numCol = _ymColLetter(p.numIdx), upcCol = _ymColLetter(p.upcIdx);
        var ranges = p.todo.map(function (x) { return 'ranges=' + encodeURIComponent("'" + t4 + "'!" + numCol + x.row); }).join('&');
        var vr = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID + '/values:batchGet?' + ranges, { headers: H });
        if (!vr.ok) throw new Error('verify read failed on ' + t4 + ' \u2014 nothing was written to it');
        var seen = ((await vr.json()).valueRanges || []).map(function (x) { return String(((x.values || [[]])[0] || [])[0] || '').trim(); });
        var data = [];
        p.todo.forEach(function (x, i) {
          if (seen[i] !== String(x.dd.num).trim()) { heldNotFound.push(x.dd); return; }   // the row moved — hold, never guess
          data.push({ range: "'" + t4 + "'!" + upcCol + x.row, values: [[x.dd._upc]] }); x.dd._done = true;
        });
        if (data.length) {
          var wr = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + MID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: data }) });
          if (!wr.ok) throw new Error('UPC write failed on ' + t4 + ' (HTTP ' + wr.status + ') \u2014 check the tab; the backup is in RailRoster Backups');
          writes += data.length;
        }
      }
      await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: _ymBatchStatusRange(b), values: [['committed']] }] }) });
      b.status = 'committed'; _ymUndoStack = null;
      await _ymStampPairs(H);
      if (typeof showToast === 'function') showToast('Committed \u2014 ' + writes + ' UPC' + (writes === 1 ? '' : 's') + ' written' + (same ? ', ' + same + ' already there' : '') + ((heldNotFound.length + heldDifferent.length) ? ', ' + (heldNotFound.length + heldDifferent.length) + ' held (see the Held filter)' : '') + '.', 6000);
      window.ymBuildPage(true);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Commit stopped: ' + (e && e.message), 6000, true);
    } finally { window._ymCommitBusy = false; }
  }
  // the pairs tab learns what happened: promoted when the UPC landed (or was
  // already there), rejected when Brad said no; found by the row in the notes
  async function _ymStampPairs(H) {
    try {
      var SS = 'https://sheets.googleapis.com/v4/spreadsheets/' + YM.VAULT_ID;
      var col = _ymData.pairStatusCol || 'I';
      var cur = (await (await fetch(SS + '/values/' + encodeURIComponent('barcode_pairs!' + col + '1:' + col), { headers: H })).json()).values || [];
      var data = [];
      _ymData.deltas.forEach(function (dd) {
        if (dd.batch !== PAIRS_BATCH) return;
        var m = String(dd.notes || '').match(/barcode_pairs row (\d+)/); if (!m) return;
        var row = parseInt(m[1], 10), now = String((cur[row - 1] || [])[0] || '').toLowerCase();
        if (now !== 'queued') return;
        if (dd._done) data.push({ range: 'barcode_pairs!' + col + row, values: [['promoted']] });
        else if (dd.status === 'rejected') data.push({ range: 'barcode_pairs!' + col + row, values: [['rejected']] });
      });
      if (data.length) await fetch(SS + '/values:batchUpdate', { method: 'POST', headers: H, body: JSON.stringify({ valueInputOption: 'RAW', data: data }) });
    } catch (e) { if (typeof showToast === 'function') showToast('Committed, but the barcode_pairs tab could not be marked \u2014 tell Claude.', 5000, true); }
  }

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
    var flagged = pend.filter(_ymIsCheck);                                        // v0.9.1712: CHECK flags only
    var noted = pend.filter(function (dd) { return _ymFlagKind(dd) === 'note'; });   // v0.9.1712: notes ride along as clean
    var _vt = _ymMasterTabs();
    var heldRows = all.filter(function (dd) { return _ymIsHeldRow(dd, _vt); });   // v0.9.1694
    var list = _ymFilter === 'flagged' ? flagged
             : _ymFilter === 'clean' ? pend.filter(function (dd) { return !_ymIsCheck(dd); })
             : _ymFilter === 'decided' ? decided
             : _ymFilter === 'held' ? heldRows
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
    // v0.9.1712: a CHECK is red with a warning sign; a NOTE is grey with an info mark.
    var _flagLine = function (dd, extra) {
      var kind = _ymFlagKind(dd);
      if (!kind) return '';
      return kind === 'check'
        ? '<div style="' + extra + 'color:var(--accent)">\u26a0 ' + _esc(dd.flag) + '</div>'
        : '<div style="' + extra + 'color:var(--text-dim)">\u24d8 ' + _esc(dd.flag) + '</div>';
    };
    // v0.9.1712: the per-flag strip — every distinct flag in the list on screen,
    // with its count and one-tap Approve all / Reject all. Counts are PENDING
    // rows only, which is exactly what _ymVerdictFlag will act on.
    var _flagStrip = function (items) {
      var groups = {}, order = [];
      items.forEach(function (dd) {
        if (!dd.flag || (dd.status || 'pending') !== 'pending') return;
        var k = String(dd.flag);
        if (!groups[k]) { groups[k] = { n: 0, kind: _ymFlagKind(dd) }; order.push(k); }
        groups[k].n++;
      });
      if (!order.length) return '';
      order.sort(function (a, b) { return groups[b].n - groups[a].n || a.localeCompare(b); });
      var sbtn = 'padding:0.15rem 0.55rem;border-radius:6px;background:var(--surface);font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer;';
      return '<div style="display:flex;flex-direction:column;gap:0.3rem;margin:0.45rem 0 0.2rem;padding:0.55rem 0.7rem;border:1px dashed var(--border);border-radius:10px">'
        + '<div style="font-size:0.85rem;color:var(--text-dim)">Same flag, one tap \u2014 red needs your eyes, grey is a note about a real item</div>'
        + order.map(function (k) {
            // The flag text rides inside a JS string inside an HTML attribute:
            // JS-escape first (backslash, quote), THEN HTML-escape — an entity
            // in the attribute would be decoded back into a bare quote before
            // the JS is ever parsed, which is the wrong order.
            var g = groups[k], ke = _esc(k.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
            return '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">'
              + '<span style="color:' + (g.kind === 'check' ? 'var(--accent)' : 'var(--text-dim)') + ';font-size:0.92rem">' + (g.kind === 'check' ? '\u26a0 ' : '\u24d8 ') + _esc(k) + '</span>'
              + '<span style="font-weight:700;color:var(--text)">' + g.n + '</span>'
              + '<button onclick="_ymVerdictFlag(\'' + ke + '\',\'approved\')" style="' + sbtn + 'border:1.5px solid var(--green);color:var(--green)">Approve all ' + g.n + '</button>'
              + '<button onclick="_ymVerdictFlag(\'' + ke + '\',\'rejected\')" style="' + sbtn + 'border:1.5px solid var(--accent);color:var(--accent)">Reject all ' + g.n + '</button>'
              + '</div>';
          }).join('')
        + '</div>';
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
          + _flagLine(dd, 'width:100%;font-size:0.92rem;')
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
          + _flagLine(dd, 'font-size:0.95rem;margin-top:0.15rem;')
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
        + (_ymFilter === 'decided' ? 'Nothing decided yet.' : _ymFilter === 'held' ? 'Nothing held \u2014 every approved row has a tab and a number.' : 'Nothing left to review here \u2014 nice work.') + '</div>';
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
          + '<button onclick="_ymApproveClean()" title="Every pending row without a red flag \u2014 rows carrying only a grey note are included" style="padding:0.3rem 0.85rem;border-radius:8px;border:1.5px solid var(--green);background:var(--surface);color:var(--green);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">Approve all clean</button>'
          + ((_ymBatchId === SUBS_BATCH && pend.length)   // v0.9.1714
              ? '<button onclick="_ymPreSort()" title="Junk gets a red check, trains stay clean, second copies are marked duplicate \u2014 pending rows only; nothing is approved or rejected" style="padding:0.3rem 0.85rem;border-radius:8px;border:1.5px solid var(--accent2);background:var(--surface);color:var(--accent2);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">Pre-sort ' + pend.length + '</button>'
              : '')
          + (_ymUndoStack && _ymUndoStack.length
              ? '<button onclick="_ymUndoLast()" style="padding:0.3rem 0.85rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:0.92rem">\u21a9 Undo last</button>'
              : '')
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.55rem 0 0.2rem">'
      + chip('all', 'To review (' + pend.length + ')') + chip('flagged', '\u26a0 Needs a look (' + flagged.length + ')')
      + chip('clean', 'Clean (' + (pend.length - flagged.length) + (noted.length ? ', ' + noted.length + ' with notes' : '') + ')') + chip('decided', 'Decided (' + decided.length + ')')
      + (heldRows.length ? chip('held', 'Held \u2014 needs a tab or number (' + heldRows.length + ')') : '') + '</div>'
      + ((_ymFilter === 'all' || _ymFilter === 'flagged' || _ymFilter === 'clean') ? _flagStrip(list) : '')   // v0.9.1712
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
