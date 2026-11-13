// ═══════════════════════════════════════════════════════════════════════════
// collections-invoice.js — TRR Pro release 10: INVOICES
// ═══════════════════════════════════════════════════════════════════════════
// BUILD_PLAN_2026-10-28_TRR_PRO.md Release 10 ("From the Sold list; buyer from
// Contacts; numbered (never reused); business header + tax + shipping +
// terms; PDF; Paid/Unpaid; Invoices tab in the home sheet; void, never
// delete; one live invoice per item; no client info"). [stated] Brad
// 2026-10-28: the invoice stays simple; 2026-10-31 09:39 CT "build all the
// releases". The email goes out through the person's OWN mail program (a
// ready message + the saved PDF) — writing Gmail drafts would need a new Google
// permission and another Google review.
//
//   the tab     "Invoices" in the HOME sheet (every collection's sales, one
//               numbering); made on the first invoice, AFTER a backup of the
//               sheet — no backup, no new tab. Row 1 headers, row 2 the note,
//               invoices from row 3. A row is found by its Invoice ID
//               (column P), never by its position.
//   a number    the highest on the tab + 1, read fresh; after the row lands it
//               is read back — if another device took the same number first,
//               ours moves to the next free one (the inventory-number rule).
//   one item    a sold item (collection + inventory number + item number +
//               sale date) is on at most ONE invoice that is not void.
//   void        the row stays, marked Void, with the reason; its number is
//               never used again; its items can go on a new invoice.
//   archive     RR_COLL_ARCHIVE.checks 'invoices': unpaid invoices for the
//               collection are listed before it is archived.
//   dates       the sheet hands a date back as a serial number (46337). Every
//               invoice date is READ through the app's one date reader
//               (_isoDate / _showDate below, _formatDate in app.js) — and the
//               sold item's date inside its lasting name too, so an item made
//               into an invoice before a reload is still found after one.
//   optional    invoices are NEVER required. [stated] Brad 2026-11-11 11:13 CT
//               "they probably don't want to change their invoice system. we
//               need to make sure that is not something that is a have to";
//               11:15 CT "yes on the we do our own". The owner's Business
//               tools switch "We do our own invoices" (an ACCOUNT setting,
//               RR_COLL_INVOICE.ownKey) hides every way in — rrInvOn() is the
//               ONE door the menu, the Sold page, the screen and the archive
//               check ask. Nothing is deleted; switched back, all is there.
//
// ON only through RR_COLL_UI.feature. Every word: RR_COLL_INVOICE (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function I() { return (typeof RR_COLL_INVOICE !== 'undefined' && RR_COLL_INVOICE) || root.RR_COLL_INVOICE || { words: {}, headers: [], status: {} }; }
  function W(k, vars) {
    var t = String((I().words || {})[k] || '');
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // A value inside an on-click, QUOTED (rrJsArg makes it safe; the quotes make it a string).
  function jsArg(s) { return "'" + (typeof rrJsArg === 'function' ? rrJsArg(s) : String(s == null ? '' : s).replace(/[\\']/g, '\\$&').replace(/[&<>"]/g, '')) + "'"; }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function st() { try { return (typeof state !== 'undefined' && state) || root.state || {}; } catch (e) { return root.state || {}; } }
  function _on() { try { return typeof rrCollUiOn === 'function' && rrCollUiOn(); } catch (e) { return false; } }
  function _offline() {
    try { if (root._offlineMode) return true; } catch (e) {}
    try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return true; } catch (e) {}
    return false;
  }
  function _money(v) { return (typeof root._money === 'function') ? root._money(v) : (parseFloat(String(v || '').replace(/[$,\s]/g, '')) || 0); }
  function _round(n) { return Math.round(n * 100) / 100; }
  function _price(n) { try { return (typeof _formatPrice === 'function') ? _formatPrice(_round(n)) : '$' + _round(n).toFixed(2); } catch (e) { return String(n); } }
  function _label(c) {
    if (!c) return '';
    if (c.home) return (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI.words && RR_COLL_UI.words.home) || 'My Collection';
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }
  function _home() { return (typeof rrHomeSheet === 'function') ? rrHomeSheet() : (st().personalSheetId || null); }
  // ── dates: ONE reading (the sheet gives a serial, this device may hold "2026-11-11") ──
  // _isoDate → "YYYY-MM-DD" (for names and matching: never the person's display format);
  // _showDate → the person's own date format (_formatDate, app.js — it reads serials too).
  function _isoDate(v) {
    if (v === null || v === undefined || v === '') return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var n = (typeof v === 'number') ? v : (/^\d{4,5}(\.\d+)?$/.test(String(v).trim()) ? parseFloat(v) : NaN);
    if (isFinite(n) && n > 25000 && n < 80000) {   // days since 1899-12-30 (the _formatDate / rrDateTs window)
      var d = new Date(Math.round((n - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
    }
    var t = String(v).trim(), m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + p(Number(m[1])) + '-' + p(Number(m[2]));
    return t;
  }
  function _showDate(v) {
    if (v === null || v === undefined || v === '') return '';
    try { if (typeof _formatDate === 'function') return String(_formatDate(v)); } catch (e) {}
    return _isoDate(v);
  }
  // a sold item's lasting name, its date read the ONE way (old invoices hold either form)
  function _refKey(ref) {
    var a = String(ref == null ? '' : ref).split('|');
    if (a.length >= 4) a[3] = _isoDate(a[3]);
    return a.join('|');
  }
  // ── optional: "We do our own invoices" (the owner's switch, an ACCOUNT setting) ──
  function rrInvOwn() {
    var v = '';
    try { v = String((typeof rrPrefRead === 'function' ? rrPrefRead(I().ownKey) : '') || ''); } catch (e) { v = ''; }
    return v === '1';
  }
  // THE door: are the app's invoices offered at all here?
  function rrInvOn() { return _on() && !rrInvOwn(); }
  function rrInvOwnSet(own) {
    if (!_on()) return false;
    if (typeof rrStaffGate === 'function' && !rrStaffGate('business')) return false;   // TRR Pro staff PINs: the roles door (staff.js)
    if (typeof rrPrefWrite === 'function') rrPrefWrite(I().ownKey, own ? '1' : '');   // '' = unset (the account merge never forgets a key)
    try { rrInvPaintSoldButton(); } catch (e) {}
    ['rr-coll-inv', 'rr-coll-inv-new', 'rr-coll-inv-one', 'rr-coll-inv-set'].forEach(function (id) { if (own) _close(id); });
    try { var r = document.getElementById('rr-inv-own-row'); if (r) r.innerHTML = _ownRowInner(); } catch (e) {}
    toast(own ? W('ownOnSaved') : W('ownOffSaved'), 4000);
    return true;
  }
  // registered where it is born (config.js RR_FEATURE_TABS): never read as a list of items
  var _TAB = (typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Invoices');
  function _tab() { return _TAB; }
  function _col(h) { return (I().headers || []).indexOf(h); }
  function _L(i) { var s = '', n = i + 1; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function _lastL() { return _L((I().headers || []).length - 1); }
  function _dialog(id, html) {
    var full = false; try { full = typeof rrIsPhone === 'function' && rrIsPhone(); } catch (e) {}
    return (typeof rrCollDialog === 'function') ? rrCollDialog(id, html, full) : null;
  }
  function _close(id) { try { var d = document.getElementById(id); if (d) d.remove(); } catch (e) {} }
  var _BTN = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer';
  var _BTN2 = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer';
  var _INP = 'width:100%;box-sizing:border-box;min-height:40px;padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:1rem';
  function _title(t) { return '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(t) + '</div>'; }
  function _lab(t, forId) { return '<label style="display:block;font-size:0.85rem;margin:0.7rem 0 0.25rem"' + (forId ? ' for="' + forId + '"' : '') + '>' + esc(t) + '</label>'; }

  // ── the business's own header (an ACCOUNT setting) ─────────────────────
  function rrInvSettings() {
    var d = {};
    try { d = JSON.parse((typeof rrPrefRead === 'function' ? rrPrefRead(I().settingsKey) : '') || '{}') || {}; } catch (e) { d = {}; }
    return { name: String(d.name || ''), address: String(d.address || ''), phone: String(d.phone || ''), email: String(d.email || ''),
      taxRate: (d.taxRate == null || d.taxRate === '') ? 0 : Number(d.taxRate) || 0, terms: String(d.terms == null ? W('setTermsDefault') : d.terms) };
  }
  function rrInvSettingsSave(v) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('business')) return rrInvSettings();   // TRR Pro staff PINs: the roles door (staff.js)
    var o = { name: String(v.name || '').trim(), address: String(v.address || '').trim(), phone: String(v.phone || '').trim(), email: String(v.email || '').trim(),
      taxRate: Math.max(0, Number(v.taxRate) || 0), terms: String(v.terms || '').trim() };
    if (typeof rrPrefWrite === 'function') rrPrefWrite(I().settingsKey, JSON.stringify(o));
    return rrInvSettings();
  }

  // ── the tab ────────────────────────────────────────────────────────────
  var _tabOk = {};
  async function _ensureTab(sid) {
    if (_tabOk[sid]) return true;
    var tok = (typeof accessToken !== 'undefined') ? accessToken : root.accessToken;
    var meta = await (await _withTokenRetry(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + '?fields=sheets.properties', { headers: { Authorization: 'Bearer ' + tok } }); })).json();
    if (!meta || !Array.isArray(meta.sheets)) throw new Error('could not read the sheet');   // a failed read is not "missing" — never create on a guess
    if (!meta.sheets.some(function (sh) { return sh.properties && sh.properties.title === _tab(); })) {
      await backupCreateAuto(I().backupReason || 'before-invoices', sid);   // no backup, no new tab
      await _withTokenRetry(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: _TAB } } }] }) }); });
      var note = [I().note]; while (note.length < I().headers.length) note.push('');
      await sheetsUpdate(sid, "'" + _tab() + "'!A1:" + _lastL() + '2', [I().headers.slice(), note]);
    }
    _tabOk[sid] = true;
    return true;
  }
  // Every invoice on the tab, read fresh: [{ row, no, date, status, …, id, data }]
  function _parse(values) {
    var out = [];
    (values || []).forEach(function (r, i) {
      var id = String((r && r[_col('Invoice ID')]) || '').trim();
      if (!id) return;
      var data = {};
      try { data = JSON.parse(r[_col('Lines (app data)')] || '{}') || {}; } catch (e) { data = {}; }
      out.push({ row: i + 3, no: Number(r[_col('Invoice No')]) || 0, date: _showDate(r[_col('Date')]), dateIso: _isoDate(r[_col('Date')]), status: String(r[_col('Status')] || ''),
        buyerName: String(r[_col('Buyer')] || ''), subtotal: _money(r[_col('Subtotal')]), taxRate: _money(r[_col('Tax rate %')]), tax: _money(r[_col('Tax')]),
        shipping: _money(r[_col('Shipping')]), total: _money(r[_col('Total')]), terms: String(r[_col('Terms')] || ''), paidOn: _showDate(r[_col('Paid on')]),
        voidReason: String(r[_col('Void reason')] || ''), id: id, data: data, lines: Array.isArray(data.lines) ? data.lines : [] });
    });
    return out;
  }
  async function rrInvList() {
    var sid = _home(); if (!sid) return [];
    var res;
    try { res = await sheetsGet(sid, "'" + _tab() + "'!A3:" + _lastL()); }
    catch (e) { if (/Unable to parse range|not found/i.test(String(e && e.message))) return []; throw e; }
    if (res && res.error) return [];
    return _parse(res && res.values);
  }
  function _live(inv) { return inv.status !== (I().status.void || 'Void'); }
  // The sold item's lasting name: its collection, inventory number, item number and sale date.
  function rrInvRef(coll, s) { return [coll && coll.key || 'home', s.inventoryId || '', s.itemNum || '', _isoDate(s.dateSold)].join('|'); }

  // ── the sold items of the open collection, with where each is invoiced ─
  function rrInvSoldItems(list) {
    var c = rrCurrentCollection(), sold = st().soldData || {};
    var on = {};
    (list || []).filter(_live).forEach(function (inv) { inv.lines.forEach(function (l) { on[_refKey(l.ref)] = inv.no; }); });
    return Object.keys(sold).map(function (k) {
      var s = sold[k];
      return { key: k, s: s, ref: rrInvRef(c, s), onNo: on[_refKey(rrInvRef(c, s))] || 0 };
    });
  }
  function _line(c, s) {
    var name = (typeof rrShelveItemName === 'function') ? rrShelveItemName(s) : String(s.itemNum || '');
    return { ref: rrInvRef(c, s), coll: c.key, collLabel: _label(c), fullId: (typeof rrFullId === 'function') ? rrFullId(s.inventoryId, c) : String(s.inventoryId || ''),
      itemNum: String(s.itemNum || ''), name: name, condition: String(s.condition || ''), price: _round(_money(s.salePrice)), dateSold: _isoDate(s.dateSold) };
  }

  // ── making one ─────────────────────────────────────────────────────────
  var _making = false;
  // opts: { keys: [soldData keys], buyerId, taxRate, shipping, terms }
  async function rrInvCreate(opts) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('clients')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    if (!rrInvOn()) return { ok: false, why: 'off' };   // "We do our own invoices" — not made here
    opts = opts || {};
    if (_offline()) return { ok: false, why: 'offline' };
    if (_making) return { ok: false, why: 'busy' };
    var c = rrCurrentCollection(), sold = st().soldData || {};
    var picked = (opts.keys || []).map(function (k) { return sold[k]; }).filter(Boolean);
    if (!picked.length) return { ok: false, why: 'items' };
    var buyer = ((st().contactsData) || []).filter(function (x) { return x && x.id === opts.buyerId; })[0];
    if (!buyer) return { ok: false, why: 'buyer' };
    var sid = _home();
    _making = true;
    try {
      await _ensureTab(sid);
      var list = await rrInvList();
      var on = {};
      list.filter(_live).forEach(function (inv) { inv.lines.forEach(function (l) { on[_refKey(l.ref)] = inv.no; }); });
      var lines = picked.map(function (s) { return _line(c, s); });
      var taken = lines.filter(function (l) { return on[_refKey(l.ref)]; });
      if (taken.length) return { ok: false, why: 'taken', no: on[_refKey(taken[0].ref)], items: taken.map(function (l) { return l.fullId || l.itemNum; }).join(', ') };
      var set = rrInvSettings();
      var rate = (opts.taxRate == null || opts.taxRate === '') ? set.taxRate : Math.max(0, Number(opts.taxRate) || 0);
      var subtotal = _round(lines.reduce(function (a, l) { return a + l.price; }, 0));
      var tax = _round(subtotal * rate / 100), ship = _round(Math.max(0, _money(opts.shipping)));
      var total = _round(subtotal + tax + ship);
      var no = list.reduce(function (m, x) { return Math.max(m, x.no); }, 0) + 1;
      var id = 'inv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var who = (st().user && (st().user.email || st().user.name)) || '';
      var data = { buyerId: buyer.id, buyer: { name: buyer.name || buyer.business || '', business: buyer.business || '', address: buyer.address || '', email: buyer.email || '', phone: buyer.phone || buyer.cell || '' },
        lines: lines, business: set };
      var row = new Array(I().headers.length).fill('');
      row[_col('Invoice No')] = String(no); row[_col('Date')] = rrToday(); row[_col('Status')] = I().status.unpaid || 'Unpaid';
      row[_col('Buyer')] = data.buyer.name; row[_col('Items')] = lines.map(function (l) { return l.fullId + ' ' + l.name + ' — ' + _price(l.price); }).join('; ');
      row[_col('Subtotal')] = String(subtotal); row[_col('Tax rate %')] = String(rate); row[_col('Tax')] = String(tax); row[_col('Shipping')] = String(ship);
      row[_col('Total')] = String(total); row[_col('Terms')] = String(opts.terms == null ? set.terms : opts.terms); row[_col('Created by')] = who;
      row[_col('Collections')] = Array.from(new Set(lines.map(function (l) { return l.collLabel; }))).join(', ');
      row[_col('Invoice ID')] = id; row[_col('Lines (app data)')] = JSON.stringify(data);
      await sheetsAppend(sid, "'" + _tab() + "'!A:" + _lastL(), [row]);
      // read back: two devices that took the same number at once — the later one moves on
      var after = await rrInvList();
      var mine = after.filter(function (x) { return x.id === id; })[0];
      if (!mine) throw new Error('the invoice did not land');
      var clash = after.some(function (x) { return x.id !== id && x.no === mine.no && x.row < mine.row; });
      if (clash) {
        var next = after.reduce(function (m, x) { return Math.max(m, x.no); }, 0) + 1;
        // the guarded writer reads the row first: it must still hold OUR Invoice ID
        var moved = !(await rrVerifiedRowUpdate(sid, _tab(), mine.row, "'" + _tab() + "'!A" + mine.row, [[String(next)]],
          { num: String(mine.no), invId: id }, W('what')));
        if (moved) return { ok: true, invoice: mine, renumbered: false };
        mine.no = next;
      }
      return { ok: true, invoice: mine };
    } catch (e) {
      console.warn('[Invoices] make:', e && e.message);
      return { ok: false, why: 'failed' };
    } finally { _making = false; }
  }

  // ── paid / void: the row found by its Invoice ID, never its position ────
  async function _setCells(id, cells) {
    var sid = _home();
    var list = await rrInvList();
    var inv = list.filter(function (x) { return x.id === id; })[0];
    if (!inv) return { ok: false, why: 'gone' };
    // each cell goes through the guarded writer: the row must still hold this Invoice ID
    for (var h in cells) {
      var okW = await rrVerifiedRowUpdate(sid, _tab(), inv.row, "'" + _tab() + "'!" + _L(_col(h)) + inv.row, [[cells[h]]],
        { num: String(inv.no), invId: id }, W('what'));
      if (!okW) return { ok: false, why: 'moved' };
    }
    var again = (await rrInvList()).filter(function (x) { return x.id === id; })[0];
    if (!again || again.row !== inv.row) return { ok: false, why: 'moved' };
    return { ok: true, invoice: again };
  }
  async function rrInvMarkPaid(id, date) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('clients')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    if (_offline()) return { ok: false, why: 'offline' };
    var c = {}; c.Status = I().status.paid || 'Paid'; c['Paid on'] = date || rrToday();
    return _setCells(id, c);
  }
  async function rrInvVoid(id, reason) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('clients')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    if (_offline()) return { ok: false, why: 'offline' };
    var c = {}; c.Status = I().status.void || 'Void'; c['Void reason'] = String(reason || '').trim() || '—';
    return _setCells(id, c);
  }
  // Unpaid invoices with an item from this collection (the archive check).
  async function rrInvUnpaidFor(key) {
    if (!rrInvOn()) return [];   // "We do our own invoices": the archive check says nothing about them
    var list = await rrInvList();
    return list.filter(function (inv) { return inv.status === (I().status.unpaid || 'Unpaid') && inv.lines.some(function (l) { return l.coll === key; }); });
  }

  // ── the PDF ────────────────────────────────────────────────────────────
  function rrInvPdf(inv) {
    if (!(root.jspdf && root.jspdf.jsPDF)) { toast(W('pdfLoading'), 4000, true); return null; }
    var d = inv.data || {}, b = d.business || rrInvSettings(), buyer = d.buyer || {};
    var doc = new root.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var M = 48, y = 56, pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(b.name || '', M, y);
    doc.setFontSize(20); doc.text(W('pdfInvoice'), pageW - M, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    [b.address, b.phone, b.email].filter(Boolean).forEach(function (t) { y += 14; doc.text(String(t), M, y); });
    var ry = 74;
    doc.text(W('pdfNo', { no: inv.no }), pageW - M, ry, { align: 'right' }); ry += 14;
    doc.text(W('pdfDate', { date: inv.date }), pageW - M, ry, { align: 'right' });
    y = Math.max(y, ry) + 28;
    doc.setFont('helvetica', 'bold'); doc.text(W('pdfBillTo'), M, y); doc.setFont('helvetica', 'normal');
    [buyer.name, buyer.business && buyer.business !== buyer.name ? buyer.business : '', buyer.address, buyer.email].filter(Boolean).forEach(function (t) { y += 14; doc.text(String(t), M, y); });
    y += 28;
    doc.setFont('helvetica', 'bold');
    doc.text(W('pdfId'), M, y); doc.text(W('pdfItem'), M + 70, y); doc.text(W('pdfPrice'), pageW - M, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 6; doc.line(M, y, pageW - M, y);
    inv.lines.forEach(function (l) {
      y += 16;
      if (y > 720) { doc.addPage(); y = 56; }
      doc.text(String(l.fullId || ''), M, y);
      doc.text(String((l.name || l.itemNum) + (l.collLabel ? ' (' + l.collLabel + ')' : '')).slice(0, 70), M + 70, y);
      doc.text(_price(l.price), pageW - M, y, { align: 'right' });
    });
    y += 10; doc.line(M, y, pageW - M, y);
    var sum = function (label, v, bold) { y += 16; if (bold) doc.setFont('helvetica', 'bold'); doc.text(label, pageW - M - 110, y); doc.text(_price(v), pageW - M, y, { align: 'right' }); doc.setFont('helvetica', 'normal'); };
    sum(W('pdfSubtotal'), inv.subtotal); if (inv.tax) sum(W('pdfTax', { rate: inv.taxRate }), inv.tax); if (inv.shipping) sum(W('pdfShipping'), inv.shipping); sum(W('pdfTotal'), inv.total, true);
    if (inv.terms) { y += 30; doc.text(String(inv.terms), M, y); }
    if (inv.status === (I().status.paid || 'Paid')) { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(W('pdfPaid', { date: inv.paidOn }), M, y + 40); }
    if (inv.status === (I().status.void || 'Void')) { doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.text(W('pdfVoid'), M, y + 44); }
    var file = W('pdfFile', { no: inv.no, date: inv.dateIso || _isoDate(inv.date) });   // never the display format: "11/11/2026" has slashes
    doc.save(file);
    return file;
  }
  function rrInvMailto(inv) {
    var d = inv.data || {}, b = d.business || rrInvSettings(), buyer = d.buyer || {};
    var subj = W('emailSubject', { no: inv.no, business: b.name || '' });
    var body = W('emailBody', { no: inv.no, total: _price(inv.total), name: buyer.name || '', business: b.name || '' });
    return 'mailto:' + encodeURIComponent(buyer.email || '') + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
  }

  // ═══ the screens ════════════════════════════════════════════════════════
  var _filter = 'all', _last = [];
  async function rrInvOpen() {
    if (!rrInvOn()) return;
    var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    var html = _title(W('title')) +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
      '<button type="button" data-inv-new onclick="rrInvNewOpen()" style="' + _BTN + '">' + esc(W('newBtn')) + '</button>' +
      '<button type="button" data-inv-settings onclick="rrInvSettingsOpen()" style="' + _BTN2 + '">' + esc(W('settingsBtn')) + '</button>' +
      '<select id="rr-inv-filter" onchange="rrInvFilter(this.value)" style="' + _INP + ';width:auto">' +
      [['all', W('filterAll')], ['Unpaid', I().status.unpaid], ['Paid', I().status.paid], ['Void', I().status.void]].map(function (o) { return '<option value="' + esc(o[0]) + '"' + (_filter === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div id="rr-inv-list" style="margin-top:0.7rem">…</div>';
    _dialog('rr-coll-inv', html);
    return _paintList();
  }
  async function _paintList() {
    var box = document.getElementById('rr-inv-list'); if (!box) return;
    try { _last = await rrInvList(); } catch (e) { box.textContent = W('saveFailed'); return; }
    box = document.getElementById('rr-inv-list'); if (!box) return;
    var list = _last.filter(function (x) { return _filter === 'all' || x.status === _filter; }).sort(function (a, b) { return b.no - a.no; });
    if (!list.length) { box.innerHTML = '<div style="color:var(--text-dim);padding:0.6rem 0.2rem">' + esc(W('none')) + '</div>'; return; }
    box.innerHTML = '<div style="font-size:0.85rem;color:var(--text-dim)">' + esc(W('showing', { n: list.length })) + '</div>' + list.map(function (inv) {
      return '<button type="button" data-inv-row="' + esc(inv.no) + '" onclick="rrInvShow(' + jsArg(inv.id) + ')" style="display:flex;flex-wrap:wrap;gap:0.2rem 0.7rem;align-items:baseline;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.45rem 0.7rem;margin-top:0.3rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);cursor:pointer">' +
        '<span style="font-weight:700">' + esc(W('invTitle', { no: inv.no })) + '</span><span>' + esc(inv.date) + '</span><span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(inv.buyerName) + '</span>' +
        '<span style="font-weight:600">' + esc(_price(inv.total)) + '</span><span data-inv-status style="font-size:0.82rem;font-weight:700">' + esc(inv.status) + '</span></button>';
    }).join('');
  }
  function rrInvFilter(v) { _filter = v || 'all'; return _paintList(); }

  function rrInvNewOpen() {
    var c = rrCurrentCollection();
    var html = _title(W('newTitle')) + '<div id="rr-inv-new-body">…</div>';
    _dialog('rr-coll-inv-new', html);
    return (async function () {
      var list = [];
      try { list = await rrInvList(); } catch (e) { list = []; }
      var items = rrInvSoldItems(list);
      var set = rrInvSettings();
      var contacts = ((st().contactsData) || []).filter(function (x) { return x && x.id; })
        .sort(function (a, b) { return String(a.name || a.business).localeCompare(String(b.name || b.business)); });
      var body = document.getElementById('rr-inv-new-body'); if (!body) return;
      var unbilled = items.filter(function (x) { return !x.onNo; });
      body.innerHTML = '<div style="font-weight:700">' + esc(W('pickItems', { label: _label(c) })) + '</div>' +
        (items.length ? items.map(function (x) {
          var s = x.s, name = (typeof rrShelveItemName === 'function') ? rrShelveItemName(s) : s.itemNum;
          return '<label style="display:flex;gap:0.5rem;align-items:center;min-height:40px;' + (x.onNo ? 'opacity:0.55' : 'cursor:pointer') + '">' +
            '<input type="checkbox" data-inv-pick="' + esc(x.key) + '"' + (x.onNo ? ' disabled' : '') + ' style="width:1.1rem;height:1.1rem">' +
            '<span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(((typeof rrFullId === 'function') ? rrFullId(s.inventoryId, c) : s.inventoryId) + ' ' + name) + '</span>' +
            '<span>' + esc(_price(_money(s.salePrice))) + '</span>' + (x.onNo ? '<span style="font-size:0.78rem">' + esc(W('onInvoice', { no: x.onNo })) + '</span>' : '') + '</label>';
        }).join('') : '') + (unbilled.length ? '' : '<div style="color:var(--text-dim);margin-top:0.3rem">' + esc(W('noItems')) + '</div>') +
        _lab(W('buyer'), 'rr-inv-buyer') + '<select id="rr-inv-buyer" style="' + _INP + '"><option value="">' + esc(W('buyerNone')) + '</option>' +
        contacts.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc((x.name || x.business) + (x.name && x.business ? ' — ' + x.business : '')) + '</option>'; }).join('') + '</select>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
        '<div>' + _lab(W('taxRate'), 'rr-inv-tax') + '<input id="rr-inv-tax" type="number" min="0" step="0.01" value="' + esc(set.taxRate) + '" style="' + _INP + '"></div>' +
        '<div>' + _lab(W('shipping'), 'rr-inv-ship') + '<input id="rr-inv-ship" type="number" min="0" step="0.01" value="0" style="' + _INP + '"></div></div>' +
        _lab(W('terms'), 'rr-inv-terms') + '<input id="rr-inv-terms" value="' + esc(set.terms) + '" style="' + _INP + '">' +
        '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" data-inv-make onclick="rrInvMake(this)" style="' + _BTN + '">' + esc(W('make')) + '</button></div>';
    })();
  }
  function rrInvMake(btn) {
    var run = async function () {
      var keys = Array.prototype.map.call(document.querySelectorAll('#rr-coll-inv-new [data-inv-pick]:checked'), function (el) { return el.getAttribute('data-inv-pick'); });
      if (!keys.length) { toast(W('needItems'), 3500, true); return { ok: false }; }
      var buyerId = (document.getElementById('rr-inv-buyer') || {}).value || '';
      if (!buyerId) { toast(W('needBuyer'), 3500, true); return { ok: false }; }
      var r = await rrInvCreate({ keys: keys, buyerId: buyerId, taxRate: (document.getElementById('rr-inv-tax') || {}).value,
        shipping: (document.getElementById('rr-inv-ship') || {}).value, terms: (document.getElementById('rr-inv-terms') || {}).value });
      if (!r.ok) { toast(r.why === 'taken' ? W('taken', { items: r.items, no: r.no }) : r.why === 'offline' ? W('offline') : W('failed'), 7000, true); return r; }
      _close('rr-coll-inv-new');
      rrInvPdf(r.invoice);
      toast(W('made', { no: r.invoice.no }), 6000);
      await _paintList();
      rrInvShow(r.invoice.id);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-inv-make', run, btn);
    return run();
  }
  function _find(id) { return _last.filter(function (x) { return x.id === id; })[0]; }
  function rrInvShow(id) {
    var inv = _find(id); if (!inv) return;
    var S = I().status, k = jsArg(id);
    var html = _title(W('invTitle', { no: inv.no })) +
      '<div style="font-size:0.9rem;line-height:1.5">' + esc(inv.date) + ' · ' + esc(inv.buyerName) + ' · <strong data-inv-status>' + esc(inv.status) + '</strong>' +
      (inv.paidOn ? ' · ' + esc(W('paidOn', { date: inv.paidOn })) : '') + (inv.voidReason && inv.status === S.void ? ' · ' + esc(inv.voidReason) : '') + '</div>' +
      inv.lines.map(function (l) { return '<div style="display:flex;gap:0.6rem;font-size:0.9rem;padding:0.25rem 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">' + esc(l.fullId) + '</span><span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(l.name) + '</span><span>' + esc(_price(l.price)) + '</span></div>'; }).join('') +
      '<div style="text-align:right;margin-top:0.4rem;font-weight:700">' + esc(W('pdfTotal')) + ' ' + esc(_price(inv.total)) + '</div>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.9rem">' +
      '<button type="button" data-inv-pdf onclick="rrInvPdfGo(' + k + ')" style="' + _BTN2 + '">' + esc(W('pdf')) + '</button>' +
      (inv.status !== S.void ? '<a data-inv-email href="' + esc(rrInvMailto(inv)) + '" onclick="rrInvPdfGo(' + k + ')" style="' + _BTN2 + ';text-decoration:none;display:inline-flex;align-items:center">' + esc(W('email')) + '</a>' : '') +
      (inv.status === S.unpaid ? '<button type="button" data-inv-paid onclick="rrInvPaidGo(' + k + ', this)" style="' + _BTN + '">' + esc(W('markPaid')) + '</button>' : '') +
      (inv.status !== S.void ? '<button type="button" data-inv-void onclick="rrInvVoidGo(' + k + ', this)" style="' + _BTN2 + '">' + esc(W('voidBtn')) + '</button>' : '') + '</div>' +
      (inv.status !== S.void ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.4rem">' + esc(W('emailHint')) + '</div>' : '');
    _dialog('rr-coll-inv-one', html);
  }
  function rrInvPdfGo(id) { var inv = _find(id); return inv ? rrInvPdf(inv) : null; }
  function rrInvPaidGo(id, btn) {
    var run = async function () {
      var r = await rrInvMarkPaid(id);
      toast(r.ok ? W('saved') : W('saveFailed'), 3500, !r.ok);
      await _paintList(); if (r.ok) rrInvShow(id);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-inv-paid', run, btn);
    return run();
  }
  function rrInvVoidGo(id, btn) {
    var run = async function () {
      var inv = _find(id); if (!inv) return { ok: false };
      var yes = await appConfirm(W('voidAsk', { no: inv.no }), { ok: W('voidOk') });
      if (!yes) return { ok: false };
      var r = await rrInvVoid(id, '');
      toast(r.ok ? W('voided', { no: inv.no }) : W('saveFailed'), 4000, !r.ok);
      await _paintList(); if (r.ok) rrInvShow(id);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-inv-void', run, btn);
    return run();
  }
  function rrInvSettingsOpen() {
    var s = rrInvSettings();
    var f = function (k, w, type) { return _lab(W(w), 'rr-inv-s-' + k) + '<input id="rr-inv-s-' + k + '"' + (type ? ' type="' + type + '" min="0" step="0.01"' : '') + ' value="' + esc(s[k]) + '" style="' + _INP + '">'; };
    var html = _title(W('setTitle')) + f('name', 'setName') + f('address', 'setAddress') + f('phone', 'setPhone') + f('email', 'setEmail') + f('taxRate', 'setTax', 'number') + f('terms', 'setTerms') +
      '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" data-inv-set-save onclick="rrInvSettingsSaveGo()" style="' + _BTN + '">' + esc(W('setSave')) + '</button></div>';
    _dialog('rr-coll-inv-set', html);
  }
  function rrInvSettingsSaveGo() {
    var g = function (k) { return (document.getElementById('rr-inv-s-' + k) || {}).value || ''; };
    rrInvSettingsSave({ name: g('name'), address: g('address'), phone: g('phone'), email: g('email'), taxRate: g('taxRate'), terms: g('terms') });
    _close('rr-coll-inv-set');
    toast(W('saved'), 2500);
  }
  // The Sold page's own button (only with the Pro switch on).
  function rrInvPaintSoldButton() {
    try {
      var title = document.querySelector('#page-sold .page-title'); if (!title) return;
      var old = document.getElementById('rr-inv-sold-btn');
      if (!rrInvOn()) { if (old) old.remove(); return; }
      if (old) return;
      var b = document.createElement('button');
      b.id = 'rr-inv-sold-btn'; b.type = 'button'; b.textContent = W('btn');
      b.setAttribute('onclick', 'rrInvOpen()');
      b.style.cssText = _BTN2 + ';min-height:36px;padding:0.3rem 0.8rem;font-size:0.85rem';
      title.appendChild(b);
    } catch (e) {}
  }

  // ── Preferences → Business tools: "We do our own invoices" (owners) ──────
  function _ownRowInner() {
    var own = rrInvOwn();
    // the tick box sits UNDER the words, inside the label column — beside them it squeezed the
    // words into a narrow strip on a phone ([stated] Brad 2026-11-11 13:12 CT "yes" to fixing it)
    return '<div class="pref-row-label"><strong>' + esc(W('ownRow')) + '</strong><span>' + esc(own ? W('ownHelpOn') : W('ownHelpOff')) + '</span>' +
      '<label style="display:flex;align-items:center;gap:0.45rem;min-height:44px;margin-top:0.3rem;cursor:pointer;font-weight:600;color:var(--text)">' +
      '<input type="checkbox" data-inv-own' + (own ? ' checked' : '') + ' onchange="rrInvOwnSet(this.checked)" style="width:22px;height:22px;flex-shrink:0;cursor:pointer">' +
      esc(W('ownLabel')) + '</label></div>';
  }
  function rrPrefsInvHtml() {
    if (!_on()) return '';
    if (typeof rrStaffCan === 'function' && !rrStaffCan('business')) return '';   // owners only (when PINs are in use)
    return '<div class="pref-row" id="rr-inv-own-row">' + _ownRowInner() + '</div>';
  }

  var api = {
    rrInvOn: rrInvOn, rrInvOwn: rrInvOwn, rrInvOwnSet: rrInvOwnSet, rrPrefsInvHtml: rrPrefsInvHtml,
    rrInvSettings: rrInvSettings, rrInvSettingsSave: rrInvSettingsSave, rrInvList: rrInvList, rrInvRef: rrInvRef, rrInvSoldItems: rrInvSoldItems,
    rrInvCreate: rrInvCreate, rrInvMarkPaid: rrInvMarkPaid, rrInvVoid: rrInvVoid, rrInvUnpaidFor: rrInvUnpaidFor, rrInvPdf: rrInvPdf, rrInvMailto: rrInvMailto,
    rrInvOpen: rrInvOpen, rrInvFilter: rrInvFilter, rrInvNewOpen: rrInvNewOpen, rrInvMake: rrInvMake, rrInvShow: rrInvShow, rrInvPdfGo: rrInvPdfGo,
    rrInvPaidGo: rrInvPaidGo, rrInvVoidGo: rrInvVoidGo, rrInvSettingsOpen: rrInvSettingsOpen, rrInvSettingsSaveGo: rrInvSettingsSaveGo,
    rrInvPaintSoldButton: rrInvPaintSoldButton, rrInvTabName: _tab,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  root._rrInvReset = function () { _tabOk = {}; _making = false; _filter = 'all'; _last = []; };   // test hook
})(typeof window !== 'undefined' ? window : globalThis);
