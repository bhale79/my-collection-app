// ═══════════════════════════════════════════════════════════════════════════
// collections-all.js — TRR Pro release 8: THE ALL COLLECTIONS VIEW, THE
// EXPORT SNAPSHOT, THE BUSINESS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
// [stated] Brad 2026-10-28: a business-wide list of every item across all
// collections to sort and find — "yes" to a LIVE combined view (plus an export
// snapshot), not a second stored sheet. BUILD_PLAN_2026-10-28_TRR_PRO.md
// Release 8; [stated] 2026-10-31 09:39 CT "build all the releases".
//
//   read      every collection's My Collection, read the way its OWN list
//             reads it (rrHeldRecordFromRow, app-data.js — the one row
//             reader): a header row, a junk row and a row moved out are never
//             held. Nothing is stored: the view is read when it opens (a read
//             younger than RR_COLL_ALL.freshMs is reused; Refresh reads again).
//   items     search · one collection or every one · archived only when
//             asked · sort · "Showing N of M" · tap → that collection opens
//             and the item with it — so every edit is made in the item's own
//             collection, through the doors that already guard it. This
//             screen never writes to a collection.
//   summary   one row per collection: items, value, labelled / shelved /
//             with a photo, last opened, what is left to do; the total.
//   export    a NEW Google sheet in The Rail Roster › Collections, stamped
//             "edits here do NOT go back", with an All Items tab and a Summary
//             tab. It never names a client (the privacy rule of Release 5).
//
// ON only through RR_COLL_UI.feature. Every word: RR_COLL_ALL (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function A() { return (typeof RR_COLL_ALL !== 'undefined' && RR_COLL_ALL) || root.RR_COLL_ALL || { words: { sorts: {} } }; }
  function W(k, vars) {
    var w = A().words || {};
    var t = k.indexOf('.') > 0 ? (w[k.split('.')[0]] || {})[k.split('.')[1]] : w[k];
    t = String(t || '');
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // A value inside an on-click, QUOTED (rrJsArg makes it safe; the quotes make it a string).
  function jsArg(s) { return "'" + (typeof rrJsArg === 'function' ? rrJsArg(s) : String(s == null ? '' : s).replace(/[\\']/g, '\\$&').replace(/[&<>"]/g, '')) + "'"; }
  function _close(id) { try { var d = document.getElementById(id); if (d) d.remove(); } catch (e) {} }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function _on() { try { return typeof rrCollUiOn === 'function' && rrCollUiOn(); } catch (e) { return false; } }
  function _money(v) { return (typeof root._money === 'function') ? root._money(v) : (parseFloat(String(v || '').replace(/[$,\s]/g, '')) || 0); }
  function _price(n) { try { return (typeof _formatPrice === 'function') ? _formatPrice(Math.round(n * 100) / 100) : '$' + Math.round(n).toLocaleString(); } catch (e) { return String(n); } }
  function _day(t) { try { return t ? rrToday(new Date(Number(t))) : ''; } catch (e) { return ''; } }
  function _label(c) {
    if (!c) return '';
    if (c.home) return (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI.words && RR_COLL_UI.words.home) || 'My Collection';
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }
  function _name(rec) { return (typeof rrShelveItemName === 'function') ? rrShelveItemName(rec) : String(rec.itemNum || ''); }
  function _fullId(inv, c) { return (typeof rrFullId === 'function') ? rrFullId(inv, c) : String(inv || ''); }
  function _place(rec) { return [rec.location, rec.locationDetail].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' › '); }

  // ── the read ───────────────────────────────────────────────────────────
  // Which collections: home, every active and linked one; archived on request.
  function rrAllCollections(withArchived) {
    var all = (typeof rrCollections === 'function') ? rrCollections() : [];
    return all.filter(function (c) {
      if (!c || !c.sheetId) return false;
      if (c.home) return true;
      var s = c.status || 'active';
      return s === 'active' || s === 'linked' || (withArchived && s === 'archived');
    });
  }
  var _cache = null;   // { at, withArchived, rows, per, failed }
  // { rows: [{ coll, rec }], per: { key: { coll, recs } }, failed: [labels] }
  async function rrAllRead(opts) {
    opts = opts || {};
    var withArchived = !!opts.withArchived;
    var fresh = (A().freshMs != null) ? Number(A().freshMs) : 120000;
    if (!opts.force && _cache && _cache.withArchived === withArchived && Date.now() - _cache.at < fresh) return _cache;
    var colls = rrAllCollections(withArchived);
    var last = personalColLetter(PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field);
    var out = { at: Date.now(), withArchived: withArchived, rows: [], per: {}, failed: [] };
    var reads = await Promise.all(colls.map(function (c) {
      return sheetsGet(c.sheetId, PERSONAL_TAB + '!A3:' + last).then(function (r) { return { c: c, values: (r && r.values) || [] }; })
        .catch(function () { return { c: c, failed: true }; });
    }));
    reads.forEach(function (x) {
      var c = x.c;
      if (x.failed) { out.failed.push(_label(c)); return; }
      var recs = [];
      x.values.forEach(function (r, i) {
        var rec = rrHeldRecordFromRow(r, i + 3);   // THE one row reader — the same items its own list holds
        if (rec) recs.push(rec);
      });
      out.per[c.key] = { coll: c, recs: recs };
      recs.forEach(function (rec) { out.rows.push({ coll: c, rec: rec }); });
    });
    _cache = out;
    return out;
  }

  // ── the items: filter, search, sort ────────────────────────────────────
  function _norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function rrAllFilter(rows, f) {
    f = f || {};
    var q = _norm(f.q).trim(), words = q ? q.split(/\s+/) : [];
    var list = (rows || []).filter(function (x) {
      if (f.coll && x.coll.key !== f.coll) return false;
      if (!words.length) return true;
      var hay = _norm([_fullId(x.rec.inventoryId, x.coll), x.rec.itemNum, _name(x.rec), x.rec.manufacturer, x.rec.roadName, x.rec.description,
        x.rec.condition, _place(x.rec), _label(x.coll), x.rec.stickerCode].join(' '));
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    var by = f.sort || 'coll';
    var collOrder = function (c) { return c.home ? 0 : Number(c.number) || 0; };
    var num = function (s) { var m = String(s || '').match(/^\d+/); return m ? Number(m[0]) : Infinity; };
    list.sort(function (a, b) {
      if (by === 'value') return _money(b.rec.userEstWorth) - _money(a.rec.userEstWorth);
      if (by === 'place') return _place(a.rec).localeCompare(_place(b.rec)) || collOrder(a.coll) - collOrder(b.coll);
      if (by === 'num') return (num(a.rec.itemNum) - num(b.rec.itemNum)) || String(a.rec.itemNum).localeCompare(String(b.rec.itemNum)) || collOrder(a.coll) - collOrder(b.coll);
      return (collOrder(a.coll) - collOrder(b.coll)) || (num(a.rec.inventoryId) - num(b.rec.inventoryId));
    });
    return list;
  }

  // ── the summary ────────────────────────────────────────────────────────
  // Counted over the SAME items the lists hold (the one row reader).
  function rrAllSummary(read) {
    var rows = [], tot = { items: 0, value: 0, labelled: 0, shelved: 0, photo: 0 };
    Object.keys((read && read.per) || {}).map(function (k) { return read.per[k]; })
      .sort(function (a, b) { return (a.coll.home ? 0 : Number(a.coll.number) || 0) - (b.coll.home ? 0 : Number(b.coll.number) || 0); })
      .forEach(function (p) {
        var s = { coll: p.coll, items: p.recs.length, value: 0, labelled: 0, shelved: 0, photo: 0, lastOpenedAt: p.coll.lastOpenedAt || 0 };
        p.recs.forEach(function (r) {
          s.value += _money(r.userEstWorth);
          if (String(r.stickerCode || '').trim()) s.labelled++;
          if (String(r.location || '').trim()) s.shelved++;
          if (String(r.photoItem || '').trim()) s.photo++;
        });
        ['items', 'value', 'labelled', 'shelved', 'photo'].forEach(function (k) { tot[k] += s[k]; });
        rows.push(s);
      });
    return { rows: rows, total: tot };
  }
  function _pct(n, of) { return of ? Math.round(100 * n / of) + '%' : '—'; }

  // ── the export snapshot ────────────────────────────────────────────────
  function _stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return rrToday() + ' ' + p(d.getHours()) + p(d.getMinutes());
  }
  function rrAllItemRows(rows) {
    return rows.map(function (x) {
      return [_fullId(x.rec.inventoryId, x.coll), _label(x.coll), _name(x.rec), x.rec.itemNum || '', x.rec.manufacturer || '',
        x.rec.condition || '', x.rec.userEstWorth || '', _place(x.rec), x.rec.stickerCode ? W('yes') : ''];
    });
  }
  function rrAllSummaryRows(sum) {
    var line = function (label, s) {
      return [label, s.items, Math.round(s.value * 100) / 100, _pct(s.labelled, s.items), _pct(s.shelved, s.items), _pct(s.photo, s.items),
        s.lastOpenedAt ? _day(s.lastOpenedAt) : '', W('todo', { label: s.items - s.labelled, shelf: s.items - s.shelved, photo: s.items - s.photo })];
    };
    return sum.rows.map(function (s) { return line(_label(s.coll), s); }).concat([line(W('total'), sum.total)]);
  }
  async function rrAllExport(opts) {
    opts = opts || {};
    var read = await rrAllRead({ withArchived: !!opts.withArchived, force: true });
    var rows = rrAllFilter(read.rows, { sort: 'coll' });
    var sum = rrAllSummary(read);
    var tok = (typeof accessToken !== 'undefined') ? accessToken : root.accessToken;
    var title = String(A().exportTitle || 'All Collections {stamp}').split('{stamp}').join(_stamp());
    var res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title: title }, sheets: [{ properties: { title: W('snapItems') } }, { properties: { title: W('snapSummary') } }] }) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.spreadsheetId) throw new Error('the snapshot sheet could not be made');
    var sid = data.spreadsheetId;
    var note = W('snapNote', { when: _stamp() });
    var ih = [W('cId'), W('cColl'), W('cItem'), W('cNum'), W('cMaker'), W('cCond'), W('cValue'), W('cPlace'), W('cLabel')];
    var sh = [W('sColl'), W('sItems'), W('sValue'), W('sLabelled'), W('sShelved'), W('sPhoto'), W('sLast'), W('sTodo')];
    await sheetsUpdate(sid, "'" + W('snapItems') + "'!A1", [[note]].concat([ih]).concat(rrAllItemRows(rows)));
    await sheetsUpdate(sid, "'" + W('snapSummary') + "'!A1", [[note]].concat([sh]).concat(rrAllSummaryRows(sum)));
    // into The Rail Roster › Collections (a move — the file keeps its id)
    try {
      var vault = (typeof driveCache !== 'undefined' && driveCache.vaultId) || null;
      if (vault) {
        var folder = await driveFindOrCreateFolder((typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI.folderName) || 'Collections', vault);
        var cur = await driveRequest('GET', '/files/' + sid + '?fields=parents');
        var from = (cur && cur.parents || []).join(',');
        await driveRequest('PATCH', '/files/' + sid + '?addParents=' + folder + (from ? '&removeParents=' + from : '') + '&fields=id', {});
      }
    } catch (eMv) { console.warn('[All Collections] snapshot move:', eMv && eMv.message); }
    return { ok: true, sheetId: sid, title: title, items: rows.length, url: 'https://docs.google.com/spreadsheets/d/' + sid + '/edit' };
  }

  // ═══ the screen ═══════════════════════════════════════════════════════
  var _ui = { tab: 'items', q: '', coll: '', sort: 'coll', withArchived: false, shown: 0 };
  var _BTN = 'min-height:40px;padding:0.4rem 0.9rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer';
  var _INP = 'min-height:40px;padding:0.4rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem';
  function rrAllOpen() {
    if (!_on()) return;
    var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    _ui.shown = A().pageSize || 200;
    var tab = function (id, w) { return '<button type="button" data-all-tab="' + id + '" onclick="rrAllTab(' + jsArg(id) + ')" style="' + _BTN + '">' + esc(W(w)) + '</button>'; };
    var html = '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(W('title')) + '</div>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center">' + tab('items', 'tabItems') + tab('summary', 'tabSummary') +
      '<span style="flex:1"></span>' +
      '<button type="button" data-all-refresh onclick="rrAllRefresh(this)" style="' + _BTN + '">' + esc(W('refresh')) + '</button>' +
      '<button type="button" data-all-export onclick="rrAllExportGo(this)" style="' + _BTN + '">' + esc(W('export')) + '</button></div>' +
      '<div id="rr-all-controls" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem">' +
      '<input id="rr-all-q" type="search" placeholder="' + esc(W('search')) + '" oninput="rrAllSet(\'q\', this.value)" style="' + _INP + ';flex:1 1 14rem;min-width:0">' +
      '<select id="rr-all-coll" aria-label="' + esc(W('allColl')) + '" onchange="rrAllSet(\'coll\', this.value)" style="' + _INP + ';max-width:100%"></select>' +
      '<select id="rr-all-sort" aria-label="' + esc(W('sortBy')) + '" onchange="rrAllSet(\'sort\', this.value)" style="' + _INP + '">' +
      ['coll', 'num', 'value', 'place'].map(function (k) { return '<option value="' + k + '"' + (_ui.sort === k ? ' selected' : '') + '>' + esc(W('sortBy')) + ': ' + esc(W('sorts.' + k)) + '</option>'; }).join('') + '</select>' +
      '<label style="display:flex;align-items:center;gap:0.4rem;min-height:40px;font-size:0.88rem;cursor:pointer"><input id="rr-all-arch" type="checkbox"' + (_ui.withArchived ? ' checked' : '') + ' onchange="rrAllSet(\'withArchived\', this.checked)" style="width:1.1rem;height:1.1rem">' + esc(W('withArchived')) + '</label></div>' +
      '<div id="rr-all-body" style="margin-top:0.7rem">' + esc(W('reading')) + '</div>';
    var full = true;
    var d = (typeof rrCollDialog === 'function') ? rrCollDialog('rr-coll-all', html, full) : null;
    if (d) { var box = d.querySelector('[role="dialog"]'); if (box) box.style.maxWidth = '100%'; }
    return rrAllPaint(false);
  }
  async function rrAllPaint(force) {
    var body = document.getElementById('rr-all-body'); if (!body) return;
    document.querySelectorAll('[data-all-tab]').forEach(function (b) { var on = b.getAttribute('data-all-tab') === _ui.tab; b.style.borderColor = on ? 'var(--accent)' : 'var(--border)'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var read;
    try { read = await rrAllRead({ withArchived: _ui.withArchived, force: !!force }); }
    catch (e) { body.textContent = W('exportFailed'); return; }
    body = document.getElementById('rr-all-body'); if (!body) return;
    // the collection choice lists what was read
    var sel = document.getElementById('rr-all-coll');
    if (sel) {
      var keys = Object.keys(read.per).map(function (k) { return read.per[k].coll; })
        .sort(function (a, b) { return (a.home ? 0 : Number(a.number) || 0) - (b.home ? 0 : Number(b.number) || 0); });
      if (_ui.coll && !read.per[_ui.coll]) _ui.coll = '';
      sel.innerHTML = '<option value="">' + esc(W('allColl')) + '</option>' + keys.map(function (c) {
        return '<option value="' + esc(c.key) + '"' + (_ui.coll === c.key ? ' selected' : '') + '>' + esc(_label(c)) + (c.status === 'archived' ? ' (' + esc(W('archivedTag')) + ')' : '') + '</option>';
      }).join('');
    }
    var ctl = document.getElementById('rr-all-controls'); if (ctl) ctl.style.display = _ui.tab === 'items' ? 'flex' : 'none';
    var warn = read.failed.length ? '<div style="color:var(--t-red);font-size:0.86rem;margin-bottom:0.4rem">' + read.failed.map(function (l) { return esc(W('readFailed', { label: l })); }).join('<br>') + '</div>' : '';
    if (_ui.tab === 'summary') { body.innerHTML = warn + _summaryHtml(rrAllSummary(read)); return; }
    var list = rrAllFilter(read.rows, _ui);
    var shown = list.slice(0, _ui.shown);
    body.innerHTML = warn +
      '<div data-all-count style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.3rem">' + esc(W('showing', { n: list.length, total: read.rows.length })) + ' · ' + esc(W('openHint')) + '</div>' +
      (shown.length ? shown.map(_rowHtml).join('') : '<div style="padding:0.8rem 0.2rem;color:var(--text-dim)">' + esc(W('none')) + '</div>') +
      (list.length > shown.length ? '<button type="button" data-all-more onclick="rrAllMore()" style="' + _BTN + ';width:100%;margin-top:0.5rem">' + esc(W('more')) + '</button>' : '');
  }
  function _rowHtml(x) {
    var r = x.rec, c = x.coll;
    var val = _money(r.userEstWorth);
    return '<button type="button" data-all-row="' + esc(c.key + '|' + r.inventoryId) + '" onclick="rrAllOpenItem(' + jsArg(c.key) + ', ' + jsArg(r.inventoryId) + ')" ' +
      'style="display:flex;flex-wrap:wrap;gap:0.15rem 0.7rem;align-items:baseline;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.45rem 0.7rem;margin-top:0.3rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">' +
      '<span style="font-weight:700;min-width:4.5rem">' + esc(_fullId(r.inventoryId, c)) + '</span>' +
      '<span style="flex:1 1 12rem;min-width:0;overflow-wrap:anywhere">' + esc(_name(r)) + '</span>' +
      '<span style="font-size:0.82rem;color:var(--text-dim)">' + esc(_label(c)) + '</span>' +
      (r.condition ? '<span style="font-size:0.82rem">' + esc(r.condition) + '</span>' : '') +
      (val ? '<span style="font-size:0.82rem;font-weight:600">' + esc(_price(val)) + '</span>' : '') +
      (_place(r) ? '<span style="font-size:0.82rem;color:var(--text-dim);flex-basis:100%">' + esc(_place(r)) + '</span>' : '') +
      '</button>';
  }
  function _summaryHtml(sum) {
    var td = 'padding:0.35rem 0.5rem;border-bottom:1px solid var(--border);text-align:left;vertical-align:top';
    var head = [W('sColl'), W('sItems'), W('sValue'), W('sLabelled'), W('sShelved'), W('sPhoto'), W('sLast'), W('sTodo')];
    var line = function (label, s, strong) {
      return '<tr' + (strong ? ' data-all-total style="font-weight:700"' : ' data-all-sum') + '><td style="' + td + '">' + esc(label) + '</td><td style="' + td + '">' + s.items + '</td><td style="' + td + '">' + esc(_price(s.value)) +
        '</td><td style="' + td + '">' + _pct(s.labelled, s.items) + '</td><td style="' + td + '">' + _pct(s.shelved, s.items) + '</td><td style="' + td + '">' + _pct(s.photo, s.items) +
        '</td><td style="' + td + '">' + esc(s.lastOpenedAt ? _day(s.lastOpenedAt) : '') + '</td><td style="' + td + ';font-size:0.82rem">' + esc(W('todo', { label: s.items - s.labelled, shelf: s.items - s.shelved, photo: s.items - s.photo })) + '</td></tr>';
    };
    return '<div style="overflow-x:auto;max-width:100%"><table style="border-collapse:collapse;width:100%;font-size:0.9rem;min-width:38rem"><thead><tr>' +
      head.map(function (h) { return '<th style="' + td + '">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      sum.rows.map(function (s) { return line(_label(s.coll), s, false); }).join('') + line(W('total'), sum.total, true) + '</tbody></table></div>';
  }
  function rrAllTab(t) { _ui.tab = t === 'summary' ? 'summary' : 'items'; return rrAllPaint(false); }
  function rrAllSet(k, v) { _ui[k] = v; _ui.shown = A().pageSize || 200; return rrAllPaint(false); }
  function rrAllMore() { _ui.shown += A().pageSize || 200; return rrAllPaint(false); }
  function rrAllRefresh(btn) {
    var run = function () { return rrAllPaint(true); };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-all-refresh', run, btn);
    return run();
  }
  // Tap → that collection opens, and the item with it. Every edit happens there.
  async function rrAllOpenItem(key, inv) {
    _close('rr-coll-all');
    var cur = (typeof rrCurrentCollection === 'function') ? rrCurrentCollection() : null;
    if (!cur || cur.key !== key) {
      var r = (typeof rrCollSwitchTo === 'function') ? await rrCollSwitchTo(key, {}) : null;
      if (!r || !r.ok) return false;
    }
    if (typeof _openOwnedByInvId === 'function') _openOwnedByInvId(inv);
    return true;
  }
  function rrAllExportGo(btn) {
    var run = async function () {
      toast(W('exporting'), 4000);
      var r;
      try { r = await rrAllExport({ withArchived: _ui.withArchived }); }
      catch (e) { console.warn('[All Collections] export:', e && e.message); toast(W('exportFailed'), 6000, true); return { ok: false }; }
      var body = document.getElementById('rr-all-body');
      if (body) {
        var note = document.createElement('div');
        note.setAttribute('data-all-exported', '');
        note.style.cssText = 'margin:0 0 0.6rem;padding:0.5rem 0.7rem;border-radius:9px;background:var(--surface2);font-size:0.9rem';
        note.innerHTML = esc(W('exported')) + ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener" style="color:var(--t-link);font-weight:700">' + esc(W('exportOpen')) + '</a>';
        body.insertBefore(note, body.firstChild);
      }
      toast(W('exported'), 5000);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-all-export', run, btn);
    return run();
  }

  var api = {
    rrAllCollections: rrAllCollections, rrAllRead: rrAllRead, rrAllFilter: rrAllFilter, rrAllSummary: rrAllSummary,
    rrAllItemRows: rrAllItemRows, rrAllSummaryRows: rrAllSummaryRows, rrAllExport: rrAllExport,
    rrAllOpen: rrAllOpen, rrAllPaint: rrAllPaint, rrAllTab: rrAllTab, rrAllSet: rrAllSet, rrAllMore: rrAllMore,
    rrAllRefresh: rrAllRefresh, rrAllOpenItem: rrAllOpenItem, rrAllExportGo: rrAllExportGo,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  root._rrAllReset = function () { _cache = null; _ui = { tab: 'items', q: '', coll: '', sort: 'coll', withArchived: false, shown: 0 }; };   // test hook
})(typeof window !== 'undefined' ? window : globalThis);
