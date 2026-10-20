// ═══════════════════════════════════════════════════════════════
// service-manual.js — THE SERVICE MANUAL CHECKLIST (v0.9.2005)
//
// [stated] Brad, 2026-10-20: "i meant making the service manuals collectible"
// → "tick the page checklist" → "yes their own tab" ("they may want to add
// their picture to it") → "leave them off as they will soon be on the cott
// site" (no scans shown).
//
// The master's service-manual tab (SERVICE_MANUAL_TAB, config.js — one row per
// page per printing: SM-0001 …) is shown as a checklist under Lionel Postwar in
// the Master Catalog (Section ▾ → Service Manual, browse panel 'sm'). Grouped
// category → section, with "1 of 2" counts. Ticking a page writes a row to the
// collector's OWN "Service Manual" tab; unticking asks first and removes the
// row through the app's confirmed-removal helper (a copy goes to Deleted Rows). Each owned
// page has a photo button (Drive: Paper › Service Manual › SM-0204, the folder
// rule in config.js RR_PHOTO_HOME) and a details button (condition, notes).
//
// Identity: the page's Sheet ID (SM-0204) — never a row position. The row is
// only the address for the write, and every write first re-reads the tab.
// Words / keys / headings: config.js RR_SERVICE_MANUAL. The tab's NAME is
// born here, registered as a feature tab (so it never becomes a Show chip or
// loads as collection items — it is read only by this file).
// ═══════════════════════════════════════════════════════════════
const SM_MY_TAB = (typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Service Manual');

var _smPages = null;        // the master list: [{ id, cat, sec, pg, dt, ty, fb, rep, cov, note }]
var _smPagesLoading = null;
var _smOwned = null;        // the collector's pages: { 'SM-0204': { row, id, cat, sec, pg, dt, cond, notes, photo, cov, added } }
var _smOwnedLoading = null;
var _smBusy = {};           // one write per page at a time (double-tap guard)
var _smView = { ownedOnly: false, q: '', open: {} };

function _smEsc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _smStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

// ── the master list, read BY HEADER NAME ─────────────────────────────────
function rrSmParseMaster(values) {
  if (!values || !values.length) return [];
  var H = RR_SERVICE_MANUAL.MASTER_HDR;
  var hdr = values[0].map(function (h) { return _smStr(h).toLowerCase().replace(/[^a-z0-9]/g, ''); });
  var col = {};
  Object.keys(H).forEach(function (k) { col[k] = hdr.indexOf(H[k]); });
  if (col.id < 0 || col.sec < 0) {
    console.warn('[service-manual] master tab header missing Sheet ID / Section — nothing shown');
    return [];
  }
  var out = [], seen = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i] || [];
    var g = function (k) { return col[k] < 0 ? '' : _smStr(r[col[k]]); };
    var id = g('id');
    if (!/^SM-\d+$/i.test(id) || seen[id]) continue;   // a heading, a blank line or a repeat is not a page
    seen[id] = 1;
    out.push({ id: id, cat: g('cat') || 'Other', sec: g('sec'), pg: g('pg'), dt: g('dt'), ty: g('ty'),
               fb: g('fb'), rep: g('rep'), cov: g('cov'), note: g('note') });
  }
  return out;
}

// ── the collector's tab (row 1 title, row 2 headings, rows from 3) ──────
function rrSmParseOwned(values, firstRow) {
  var start = firstRow || 3, out = {};
  (values || []).forEach(function (r, i) {
    r = r || [];
    var id = _smStr(r[0]);
    if (!/^SM-\d+$/i.test(id) || out[id]) return;      // blank (a removed row) or a heading
    out[id] = { row: start + i, id: id, cat: _smStr(r[1]), sec: _smStr(r[2]), pg: _smStr(r[3]), dt: _smStr(r[4]),
                cond: _smStr(r[5]), notes: _smStr(r[6]), photo: _smStr(r[7]), cov: _smStr(r[8]), added: _smStr(r[9]) };
  });
  return out;
}

// The row a ticked page writes. Text that Sheets would turn into a date
// ("10-59", the day it was added) goes in as text (leading apostrophe, which
// Sheets does not keep).
function rrSmRowFor(page, todayIso) {
  var t = function (v) { v = _smStr(v); return v ? "'" + v : ''; };
  return [page.id, page.cat, page.sec, t(page.pg), t(page.dt), '', '', '', t(page.cov), t(todayIso)];
}

// Grouped for drawing: [{ cat, total, owned, sections: [{ sec, pages, owned }] }],
// in the master's own order. ownedOnly / q narrow the pages; the counts are
// always of the whole section, so "1 of 2" stays true while searching.
function rrSmGroups(pages, owned, q, ownedOnly) {
  owned = owned || {};
  q = _smStr(q).toLowerCase();
  var cats = [], byCat = {};
  (pages || []).forEach(function (p) {
    var c = byCat[p.cat];
    if (!c) { c = byCat[p.cat] = { cat: p.cat, total: 0, owned: 0, sections: [], _bySec: {} }; cats.push(c); }
    var s = c._bySec[p.sec];
    if (!s) { s = c._bySec[p.sec] = { sec: p.sec, total: 0, owned: 0, pages: [] }; c.sections.push(s); }
    var has = !!owned[p.id];
    c.total++; s.total++;
    if (has) { c.owned++; s.owned++; }
    if (ownedOnly && !has) return;
    if (q && !_smMatches(p, q)) return;
    s.pages.push(p);
  });
  return cats.map(function (c) {
    var secs = c.sections.filter(function (s) { return s.pages.length; });
    return { cat: c.cat, total: c.total, owned: c.owned, sections: secs };
  }).filter(function (c) { return c.sections.length; });
}

// An item number is matched as a whole number ("646" is not "6464"); any other
// words anywhere in the page's line.
function _smMatches(p, q) {
  if (/^[0-9]+[a-z]?$/.test(q)) {
    var re = new RegExp('(^|[^0-9a-z])' + q + '($|[^0-9a-z])');
    return re.test((p.sec + ' ' + p.cov).toLowerCase()) || p.id.toLowerCase() === q;
  }
  return (p.id + ' ' + p.sec + ' ' + p.pg + ' ' + p.ty + ' ' + p.dt + ' ' + p.cov + ' ' + p.cat).toLowerCase().indexOf(q) >= 0;
}

// ALL-CAPS category words read as headings ("ACCESSORIES" → "Accessories");
// short codes (PS, STC) stay as Lionel printed them.
function _smCatLabel(cat) {
  return String(cat || '').replace(/\b([A-Z])([A-Z]{3,})\b/g, function (m, a, b) { return a + b.toLowerCase(); });
}

// ── loading ──────────────────────────────────────────────────────────────
function _smMasterId() {
  return (typeof state !== 'undefined' && state.masterSheetId) || (typeof MASTER_SHEET_ID !== 'undefined' ? MASTER_SHEET_ID : '');
}
function _smCacheGet() {
  try {
    var c = JSON.parse(localStorage.getItem(RR_SERVICE_MANUAL.CACHE_KEY) || 'null');
    if (!c || !Array.isArray(c.pages) || !c.pages.length) return null;
    var mv = (typeof state !== 'undefined' && state.masterVersion && state.masterVersion.v) || '';
    if (mv && c.mv && c.mv !== mv) return null;                         // the master changed — read it again
    var days = (typeof CATALOG_REFRESH_MAX_AGE_DAYS === 'number') ? CATALOG_REFRESH_MAX_AGE_DAYS : 7;
    if (!(Date.now() - (c.at || 0) < days * 86400000)) return null;
    return c.pages;
  } catch (e) { return null; }
}
function rrSmLoadPages() {
  if (_smPages) return Promise.resolve(_smPages);
  var cached = _smCacheGet();
  if (cached) { _smPages = cached; return Promise.resolve(_smPages); }
  if (_smPagesLoading) return _smPagesLoading;
  var sid = _smMasterId();
  if (!sid || typeof sheetsGet !== 'function') return Promise.resolve([]);
  _smPagesLoading = sheetsGet(sid, "'" + SERVICE_MANUAL_TAB + "'!A1:Z").then(function (resp) {
    var pages = rrSmParseMaster(resp && resp.values);
    if (pages.length) {
      _smPages = pages;
      try {
        var mv = (typeof state !== 'undefined' && state.masterVersion && state.masterVersion.v) || '';
        localStorage.setItem(RR_SERVICE_MANUAL.CACHE_KEY, JSON.stringify({ mv: mv, at: Date.now(), pages: pages }));
      } catch (e) {}
    }
    return pages;
  }).catch(function (e) {
    console.warn('[service-manual] could not read the master list:', e && e.message);
    return [];
  }).then(function (p) { _smPagesLoading = null; return p; });
  return _smPagesLoading;
}
// fresh = read the tab again even if this session already has it (every write does).
function rrSmLoadOwned(fresh) {
  if (_smOwned && !fresh) return Promise.resolve(_smOwned);
  if (_smOwnedLoading && !fresh) return _smOwnedLoading;
  var sid = (typeof state !== 'undefined' && state.personalSheetId) || '';
  if (!sid || typeof sheetsGet !== 'function') { _smOwned = _smOwned || {}; return Promise.resolve(_smOwned); }
  var p = sheetsGet(sid, SM_MY_TAB + '!A3:J').then(function (resp) {
    // a sheet without the tab answers with an error — that is "no pages yet"
    if (resp && resp.error) { _smOwned = {}; return _smOwned; }
    _smOwned = rrSmParseOwned(resp && resp.values, 3);
    return _smOwned;
  }).catch(function (e) {
    console.warn('[service-manual] could not read your pages:', e && e.message);
    if (!_smOwned) _smOwned = {};
    return _smOwned;
  }).then(function (o) { if (_smOwnedLoading === p) _smOwnedLoading = null; return o; });
  _smOwnedLoading = p;
  return p;
}
function rrSmOwnedCount() { return _smOwned ? Object.keys(_smOwned).length : 0; }

// The tab is made the first time a page is ticked — never on start-up.
async function _smEnsureTab() {
  var sid = (typeof state !== 'undefined' && state.personalSheetId) || '';
  if (!sid || typeof accessToken === 'undefined' || !accessToken) return false;
  var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + '?fields=sheets.properties',
    { headers: { Authorization: 'Bearer ' + accessToken } })).json();
  if (!meta || !Array.isArray(meta.sheets)) return false;          // a failed read is not a missing tab
  if (meta.sheets.some(function (s) { return s.properties && s.properties.title === SM_MY_TAB; })) return true;
  await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + ':batchUpdate', {
    method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SM_MY_TAB, tabColor: { red: 0.17, green: 0.48, blue: 0.48 } } } }] })
  });
  await sheetsUpdate(sid, SM_MY_TAB + '!A1', [[RR_SERVICE_MANUAL.MY_TAB_TITLE]]);
  await sheetsUpdate(sid, SM_MY_TAB + '!A2:J2', [RR_SERVICE_MANUAL.MY_HEADERS]);
  return true;
}

function _smToday() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function _smPageById(id) {
  return (_smPages || []).filter(function (p) { return p.id === id; })[0] || null;
}
function _smToastErr(e, what) {
  if (e && /readonly/.test(String(e.message || ''))) return;          // the read-only toast has already said it
  if (typeof showToast === 'function') {
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, what) : 'Could not save that — please try again.', 4500, true);
  }
}

// ── tick / untick ────────────────────────────────────────────────────────
async function rrSmSetOwned(id, on) {
  if (_smBusy[id]) return false;
  _smBusy[id] = true;
  var sid = (typeof state !== 'undefined' && state.personalSheetId) || '';
  try {
    if (!sid) { if (typeof showToast === 'function') showToast('Sign in to keep track of your pages.', 3000); return false; }
    if (on) {
      var page = _smPageById(id);
      if (!page) return false;
      if (!(await _smEnsureTab())) { if (typeof showToast === 'function') showToast('Could not reach your Google sheet \u2014 please try again.', 4000, true); return false; }
      await rrSmLoadOwned(true);                                       // another device may have ticked it already
      if (!_smOwned[id]) {
        await sheetsAppend(sid, SM_MY_TAB + '!A:J', [rrSmRowFor(page, _smToday())]);
        await rrSmLoadOwned(true);
        if (!_smOwned[id]) _smOwned[id] = { row: 0, id: id, cat: page.cat, sec: page.sec, pg: page.pg, dt: page.dt, cond: '', notes: '', photo: '', cov: page.cov, added: _smToday() };   // queued while offline — it goes up later
      }
      return true;
    }
    var rec = _smOwned && _smOwned[id];
    if (!rec) return false;
    var p2 = _smPageById(id) || rec;
    var yes = await appConfirm('Take ' + id + ' (' + (p2.sec || '') + (p2.pg ? ', ' + p2.pg : '') + ') off your list?' +
        (rec.photo ? '\nIts photo stays in your Google Drive.' : ''),
        { title: 'Remove this page?', ok: 'Remove', cancel: 'Keep it', danger: true });
    if (!yes) return false;
    await rrSmLoadOwned(true);
    rec = _smOwned[id];
    if (!rec) return true;                                             // already gone (another device)
    if (!rec.row) { if (typeof showToast === 'function') showToast('That page is still being saved — try again in a moment.', 3500); return false; }
    var blanks = [RR_SERVICE_MANUAL.MY_HEADERS.map(function () { return ''; })];
    var gone = await rrRemoveRowConfirmed(sid, SM_MY_TAB, rec.row, SM_MY_TAB + '!A' + rec.row + ':J' + rec.row, blanks, { num: id }, 'Service Manual page');
    if (gone) delete _smOwned[id];
    return gone;
  } catch (e) {
    _smToastErr(e, on ? 'that page' : 'the removal');
    return false;
  } finally {
    delete _smBusy[id];
  }
}

// Condition + notes, one after the other (the app's own boxes).
async function rrSmEditDetails(id) {
  if (_smBusy[id]) return false;
  var rec = _smOwned && _smOwned[id];
  if (!rec || !rec.row) return false;
  var cond = await appPrompt('How is your copy? (for example: Excellent, Good, worn edges)', rec.cond, { title: 'Condition — ' + id, ok: 'Next' });
  if (cond === null || cond === undefined) return false;
  var notes = await appPrompt('Anything else about this page?', rec.notes, { title: 'Notes — ' + id, ok: 'Save' });
  if (notes === null || notes === undefined) return false;
  _smBusy[id] = true;
  try {
    var sid = state.personalSheetId;
    await rrSmLoadOwned(true);
    rec = _smOwned[id];
    if (!rec || !rec.row) return false;
    var wrote = await rrVerifiedRowUpdate(sid, SM_MY_TAB, rec.row, SM_MY_TAB + '!F' + rec.row + ':G' + rec.row,
      [[String(cond), String(notes)]], { num: id }, 'Service Manual page');
    if (wrote) { rec.cond = String(cond); rec.notes = String(notes); }
    return wrote;
  } catch (e) { _smToastErr(e, 'the details'); return false; }
  finally { delete _smBusy[id]; }
}

// A photo of the collector's own copy → Drive (Paper › Service Manual › SM-…),
// and the folder link on the page's row.
async function rrSmAddPhoto(id, file) {
  if (!file || _smBusy[id]) return false;
  var rec = _smOwned && _smOwned[id];
  if (!rec || !rec.row) return false;
  _smBusy[id] = true;
  try {
    if (typeof showToast === 'function') showToast('Saving your photo…', 2000);
    var link = await driveUploadItemPhoto(file, id, RR_SERVICE_MANUAL.PHOTO_VIEW, '', 'Lionel Service Manual ' + id);
    await rrSmLoadOwned(true);
    rec = _smOwned[id];
    if (!rec || !rec.row || !link) return false;
    var wrote = await rrVerifiedRowUpdate(state.personalSheetId, SM_MY_TAB, rec.row, SM_MY_TAB + '!H' + rec.row,
      [[link]], { num: id }, 'Service Manual page');
    if (wrote) { rec.photo = link; if (typeof showToast === 'function') showToast('✓ Photo saved', 2000); }
    return wrote;
  } catch (e) { _smToastErr(e, 'the photo'); return false; }
  finally { delete _smBusy[id]; }
}

// ── drawing ──────────────────────────────────────────────────────────────
function _smRoot() { return document.getElementById('sm-root'); }
function _smPageLine(p) {
  var rec = _smOwned && _smOwned[p.id];
  var busy = !!_smBusy[p.id];
  var bits = [];
  if (p.pg && !/^no number$/i.test(p.pg)) bits.push(_smEsc(p.pg));
  if (p.ty) bits.push(_smEsc(p.ty));
  if (p.dt) bits.push(/^no date$/i.test(p.dt) ? 'no date printed' : 'printed ' + _smEsc(p.dt));
  if (p.fb === 'yes') bits.push('front &amp; back');
  if (p.cov) bits.push('covers ' + _smEsc(p.cov));
  var signedIn = !!(typeof state !== 'undefined' && state.personalSheetId);
  var html = '<div class="sm-page" data-sm-id="' + _smEsc(p.id) + '" style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.45rem 0.2rem;border-top:1px solid var(--border)">'
    + '<input type="checkbox" class="sm-tick" data-sm-id="' + _smEsc(p.id) + '" aria-label="I own ' + _smEsc(p.id) + '"'
    + (rec ? ' checked' : '') + (busy || !signedIn ? ' disabled' : '')
    + ' style="width:22px;height:22px;flex:0 0 auto;margin-top:0.1rem;accent-color:var(--accent);cursor:pointer">'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:0.88rem;color:var(--text);line-height:1.4"><span style="font-weight:700">' + _smEsc(p.id) + '</span> · ' + bits.join(' · ') + '</div>';
  if (rec && (rec.cond || rec.notes)) {
    html += '<div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.15rem">' + _smEsc([rec.cond, rec.notes].filter(Boolean).join(' — ')) + '</div>';
  }
  if (rec) {
    var b = 'border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:7px;padding:0.3rem 0.65rem;font-size:0.78rem;font-family:var(--font-body);cursor:pointer;min-height:32px';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.35rem">'
      + '<button type="button" class="sm-photo" data-sm-id="' + _smEsc(p.id) + '" style="' + b + '">📷 ' + (rec.photo ? 'Add another photo' : 'Add a photo') + '</button>'
      + (rec.photo ? '<a href="' + _smEsc(rec.photo) + '" target="_blank" rel="noopener" style="' + b + ';text-decoration:none;display:inline-flex;align-items:center">View my photos ↗</a>' : '')
      + '<button type="button" class="sm-edit" data-sm-id="' + _smEsc(p.id) + '" style="' + b + '">✎ Condition &amp; notes</button>'
      + '</div>';
  }
  return html + '</div></div>';
}
function _smSectionHtml(s) {
  return '<div class="sm-sec" style="margin:0.3rem 0 0.6rem 0.2rem">'
    + '<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.84rem;font-weight:700;color:var(--text-mid);padding:0.2rem 0">'
    + '<span>' + _smEsc(s.sec || '—') + '</span><span style="font-weight:600;white-space:nowrap">' + s.owned + ' of ' + s.total + '</span></div>'
    + s.pages.map(_smPageLine).join('') + '</div>';
}
function renderServiceManualTab() {
  var root = _smRoot();
  if (!root) return;
  var inColl = !!(typeof state !== 'undefined' && state.filters && state.filters.owned);
  if (!_smPages || !_smOwned) {
    root.innerHTML = '<div style="padding:1.2rem 0.4rem;color:var(--text-mid);font-size:0.9rem">Loading the service manual…</div>';
    Promise.all([rrSmLoadPages(), rrSmLoadOwned(false)]).then(function () {
      if (_smPages && _smPages.length) { renderServiceManualTab(); return; }
      var r = _smRoot();
      if (r) r.innerHTML = '<div style="padding:1.2rem 0.4rem;color:var(--text-mid);font-size:0.9rem">The service manual list could not be loaded. Check your connection and try again.</div>';
    });
    return;
  }
  if (inColl && !_smView._collSet) { _smView.ownedOnly = true; _smView._collSet = true; }
  var total = _smPages.length, mine = rrSmOwnedCount();
  var groups = rrSmGroups(_smPages, _smOwned, _smView.q, _smView.ownedOnly);
  var narrowed = !!(_smView.q || _smView.ownedOnly);
  // The lit one wears the app's solid primary button (.btn-primary); the other
  // the quiet chip look. No accent colour in a style here: app.css reskins any
  // inline accent button, which made both look alike.
  var tog = function (on, label, val) {
    return '<button type="button" class="sm-view' + (on ? ' btn-primary' : '') + '" data-sm-owned="' + val + '" aria-pressed="' + (on ? 'true' : 'false') + '" style="height:34px;padding:0 0.85rem;border-radius:999px;font-family:var(--font-body);font-size:0.82rem;font-weight:700;cursor:pointer;'
      + (on ? 'border:1.5px solid transparent' : 'border:1.5px solid var(--border);background:var(--bg-card);color:var(--text-mid)') + '">' + label + '</button>';
  };

  var head = (inColl ? '<button type="button" class="sm-back" style="height:34px;padding:0 0.85rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer;margin-bottom:0.6rem">\u2190 Back to My Collection</button>' : '')
    + '<div style="font-size:1.05rem;font-weight:700;color:var(--text);margin:0.2rem 0 0.25rem">' + _smEsc(inColl ? RR_SERVICE_MANUAL.MY_TITLE : RR_SERVICE_MANUAL.TITLE) + '</div>'
    + '<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-bottom:0.6rem">' + _smEsc(RR_SERVICE_MANUAL.INTRO) + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:0.7rem">'
    + '<input id="sm-search" type="text" placeholder="Search page, section or item #…" value="' + _smEsc(_smView.q) + '" style="flex:1 1 14rem;min-width:0;max-width:24rem;height:34px;box-sizing:border-box;border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:0 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none">'
    + tog(!_smView.ownedOnly, 'All pages', '0') + tog(_smView.ownedOnly, 'Pages I own (' + mine + ')', '1')
    + '<span style="font-size:0.8rem;color:var(--text-mid);margin-left:auto">You own ' + mine + ' of ' + total.toLocaleString() + ' pages</span>'
    + '</div>';
  if (!(typeof state !== 'undefined' && state.personalSheetId)) {
    head += '<div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:0.6rem">Sign in to tick the pages you own.</div>';
  }
  var body = groups.length ? groups.map(function (g) {
    var open = narrowed || !!_smView.open[g.cat];
    return '<details class="sm-cat" data-sm-cat="' + _smEsc(g.cat) + '"' + (open ? ' open' : '') + ' style="border:1px solid var(--border);border-radius:10px;background:var(--bg-card);margin-bottom:0.5rem;padding:0 0.75rem">'
      + '<summary style="cursor:pointer;padding:0.65rem 0;display:flex;justify-content:space-between;gap:0.5rem;font-size:0.95rem;font-weight:700;color:var(--text)">'
      + '<span>' + _smEsc(_smCatLabel(g.cat)) + '</span><span style="font-weight:600;color:var(--text-mid);white-space:nowrap">' + g.owned + ' of ' + g.total + ' owned</span></summary>'
      + '<div class="sm-cat-body">' + (open ? g.sections.map(_smSectionHtml).join('') : '') + '</div></details>';
  }).join('') : '<div style="padding:1rem 0.4rem;color:var(--text-mid);font-size:0.9rem">'
      + (_smView.ownedOnly && !mine ? 'You have not ticked any pages yet. Tap “All pages” and tick the ones you own.' : 'No pages match that search.') + '</div>';
  root.innerHTML = head + body;
  _smWire(root);
}
function _smRedrawKeepScroll() {
  var y = window.scrollY;
  renderServiceManualTab();
  try { window.scrollTo(0, y); } catch (e) {}
}
// One set of listeners on the panel (no inline handlers carrying data).
function _smWire(root) {
  if (root._smWired) return;
  root._smWired = true;
  root.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('sm-tick')) return;
    var id = t.getAttribute('data-sm-id');
    var want = !!t.checked;
    t.checked = !want;                       // the box shows the SAVED answer, not the tap
    t.disabled = true;
    rrSmSetOwned(id, want).then(_smRedrawKeepScroll, _smRedrawKeepScroll);
  });
  root.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    var id = t.getAttribute('data-sm-id');
    if (t.classList.contains('sm-back')) {
      if (typeof renderBrowseTab === 'function') renderBrowseTab('items');
    } else if (t.classList.contains('sm-view')) {
      _smView.ownedOnly = t.getAttribute('data-sm-owned') === '1';
      renderServiceManualTab();
    } else if (t.classList.contains('sm-edit')) {
      rrSmEditDetails(id).then(_smRedrawKeepScroll, _smRedrawKeepScroll);
    } else if (t.classList.contains('sm-photo')) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (f) rrSmAddPhoto(id, f).then(_smRedrawKeepScroll, _smRedrawKeepScroll);
      });
      inp.click();
    }
  });
  root.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (!d || !d.classList || !d.classList.contains('sm-cat')) return;
    var cat = d.getAttribute('data-sm-cat');
    _smView.open[cat] = d.open;
    var bodyEl = d.querySelector('.sm-cat-body');
    if (d.open && bodyEl && !bodyEl.innerHTML) {
      var g = rrSmGroups(_smPages, _smOwned, _smView.q, _smView.ownedOnly).filter(function (x) { return x.cat === cat; })[0];
      if (g) bodyEl.innerHTML = g.sections.map(_smSectionHtml).join('');
    }
  }, true);
  var _smT = null;
  root.addEventListener('input', function (ev) {
    if (!ev.target || ev.target.id !== 'sm-search') return;
    var v = ev.target.value;
    clearTimeout(_smT);
    _smT = setTimeout(function () {
      _smView.q = v;
      renderServiceManualTab();
      var s = document.getElementById('sm-search');
      if (s) { s.focus(); try { s.setSelectionRange(v.length, v.length); } catch (e) {} }
    }, 250);
  });
}

// My Collection: the Show chip opens this list on "Pages I own".
function rrSmOpenMine() {
  _smView.ownedOnly = true; _smView._collSet = true;
  if (typeof renderBrowseTab === 'function') renderBrowseTab(RR_SERVICE_MANUAL.BROWSE_TAB);
}
// My Collection asks for the count once per session (the chip shows only when
// the collector owns a page). The answer arrives later; redraw once if it is >0.
function rrSmWarmOwned(onReady) {
  if (_smOwned || _smOwnedLoading) return;
  rrSmLoadOwned(false).then(function (o) { if (o && Object.keys(o).length && typeof onReady === 'function') onReady(); });
}

if (typeof window !== 'undefined') {
  window.rrSmParseMaster = rrSmParseMaster;
  window.rrSmParseOwned = rrSmParseOwned;
  window.rrSmRowFor = rrSmRowFor;
  window.rrSmGroups = rrSmGroups;
  window.rrSmLoadPages = rrSmLoadPages;
  window.rrSmLoadOwned = rrSmLoadOwned;
  window.rrSmOwnedCount = rrSmOwnedCount;
  window.rrSmSetOwned = rrSmSetOwned;
  window.rrSmEditDetails = rrSmEditDetails;
  window.rrSmAddPhoto = rrSmAddPhoto;
  window.renderServiceManualTab = renderServiceManualTab;
  window.rrSmOpenMine = rrSmOpenMine;
  window.rrSmWarmOwned = rrSmWarmOwned;
  window.SM_MY_TAB = SM_MY_TAB;
}
