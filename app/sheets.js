// ══════════════════════════════════════════════════════════════
//  sheets.js — Google Sheets API Layer
//  Extracted from app.js (Session 63)
//
//  Dependencies (all globals from app.js, loaded before this file):
//    accessToken, tokenClient, state, API_KEY
//
//  Exports (global functions):
//    _encodeRange(range)
//    sheetsGet(spreadsheetId, range)
//    sheetsBatchGet(spreadsheetId, ranges)
//    _withTokenRetry(fetchFn)
//    sheetsUpdate(spreadsheetId, range, values)
//    sheetsAppend(spreadsheetId, range, values)
//    sheetsDeleteRow(spreadsheetId, sheetName, rowNumber)
// ══════════════════════════════════════════════════════════════

// ── SHEETS API ──────────────────────────────────────────────────
// Encode range for URL path — just encode spaces
function _encodeRange(range) {
  return range.replace(/ /g, '%20');
}

async function sheetsGet(spreadsheetId, range) {
  const isMaster = spreadsheetId === state.masterSheetId;
  const useApiKey = isMaster && API_KEY && API_KEY !== 'YOUR_API_KEY';
  const urlRange = _encodeRange(range);
  if (useApiKey) {
    // Public master read — no bearer token, won't 401 for auth reasons.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: {} });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Sheets read failed (${res.status}): ${errBody.slice(0, 200)}`);
    }
    return res.json();
  }
  // Session 159: wrap bearer-token reads in _withTokenRetry so expired tokens
  // silently refresh + retry instead of bombing the save (sheetsAppend calls
  // sheetsGet internally to find the next empty row).
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await _withTokenRetry(() => fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  return res.json();
}

async function sheetsBatchGet(spreadsheetId, ranges) {
  // Fetch multiple ranges in a single API call
  // Returns { valueRanges: [ { range, values }, ... ] }
  const isMaster = spreadsheetId === state.masterSheetId;
  const useApiKey = isMaster && API_KEY && API_KEY !== 'YOUR_API_KEY';
  const params = ranges.map(r => 'ranges=' + _encodeRange(r)).join('&');
  if (useApiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}&key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: {} });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Sheets batchGet failed (${res.status}): ${errBody.slice(0, 200)}`);
    }
    return res.json();
  }
  // Session 159: wrap bearer-token reads in _withTokenRetry
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`;
  const res = await _withTokenRetry(() => fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  return res.json();
}

// ── Token refresh helper — silently refreshes expired token then retries ──
// On mobile, tokens expire and the silent refresh sometimes doesn't fire in time.
// This wraps any fetch so a 401 triggers a fresh token request before retrying once.
async function _withTokenRetry(fetchFn) {
  // If no token at all, try to get one silently first
  if (!accessToken && tokenClient) {
    await new Promise((resolve, reject) => {
      const hint = state.user?.email || '';
      const prev = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = prev;
        if (resp.error) { reject(new Error('Token required: ' + resp.error)); return; }
        accessToken = resp.access_token;
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      setTimeout(() => reject(new Error('Sign-in timed out')), 10000);
    });
  }
  if (!accessToken) throw new Error('Not signed in — please reload and sign in again');

  let res = await fetchFn();
  // Audit NEW #7: retry on 429 (rate limit) with Retry-After or 2s backoff.
  if (res.status === 429) {
    var _ra = parseInt(res.headers && res.headers.get && res.headers.get('Retry-After') || '0');
    var _waitMs = (isNaN(_ra) || _ra <= 0) ? 2000 : Math.min(_ra * 1000, 30000);
    console.warn('[Sheets] 429 rate limited — backing off ' + _waitMs + 'ms');
    await new Promise(function(r){ setTimeout(r, _waitMs); });
    res = await fetchFn();
    if (res.status === 429) {
      console.warn('[Sheets] 429 persists after backoff — caller must handle');
    }
  }
  if (res.status === 401 || res.status === 403) {
    if (!tokenClient) throw new Error('Cannot refresh token — please reload');
    await new Promise((resolve, reject) => {
      const hint = state.user?.email || '';
      const prevCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = prevCallback;
        if (resp.error) {
          // Session 159: typed sentinel so catch blocks can show friendly re-sign-in prompt
          if (resp.error === 'interaction_required' || resp.error === 'login_required' || resp.error === 'consent_required') {
            reject(new Error('SESSION_EXPIRED'));
          } else {
            reject(new Error('Token refresh failed: ' + resp.error));
          }
          return;
        }
        accessToken = resp.access_token;
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      setTimeout(() => reject(new Error('SESSION_EXPIRED')), 8000);
    });
    const retryRes = await fetchFn();
    if (!retryRes.ok) {
      const errBody = await retryRes.json().catch(() => ({}));
      throw new Error(`Sheets API error ${retryRes.status}: ${errBody?.error?.message || retryRes.statusText}`);
    }
    return retryRes;
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Sheets API error ${res.status}: ${errBody?.error?.message || res.statusText}`);
  }
  return res;
}

// v0.9.1246: the write functions below are where every VALUE write to the
// user's sheet passes through — 193 call sites, 70 of them behind a catch that
// swallows the error. Recording the failure HERE means those catches keep
// swallowing the exception but no longer swallow the fact. The error is
// rethrown untouched, so nothing downstream behaves any differently.
//
// v0.9.1274 (audit 2026-08-02 round 2, finding R14): this used to say "the ONE
// place EVERY write passes through", and that was not true. Two value writes
// went round it on raw fetch:
//
//   sell.js:331        a :clear of the For Sale sheet in a bare catch (e) {}
//   sheet-builder.js   a :batchUpdate of the Dashboard tab's formatting
//
// The first is now sheetsClear, below, and is inside the guarantee. The second
// is formatting — colours, merges, the title's rich text — and stays outside
// it deliberately; losing it costs a plain-looking Dashboard tab, not data.
// (It no longer lies about having failed, though: it checks res.ok now, which
// it did not, so its "non-fatal" warning never actually fired on a 403.)
//
// Roughly fifteen STRUCTURAL writes — addSheet, protectRange, column widths —
// are also outside, in app-setup.js, sheet-builder.js, barcode.js, contacts.js,
// app-pages.js and wizard-handlers.js. Those create and shape tabs rather than
// putting values in them, and the outbox has no way to replay one usefully.
//
// So: every write that puts a USER'S VALUE into a cell goes through here. That
// is the claim, and it is the one worth keeping true.
// ── v0.9.1604 (Brad: "i added an item in airplane mode, but it did not add
// it") ─────────────────────────────────────────────────────────────────
// MEASURED in Brad's own Chrome: these three doors checked ONLY
// window._offlineMode — the flag app-auth sets when the app BOOTS with no
// connection. Airplane flipped ON mid-session leaves that flag false, so a
// write took the live path, fetch failed, and sheetsAppend THREW. A wizard
// save is a sequence of appends (engine + tender, item + box, the IS row);
// a throw at the first aborts the rest, so the item never reached local
// state and never appeared — the exact report. Both flavours of offline
// mean the same thing to a write, and now they read the same:
//   • _offlineMode        — booted with no connection (view-only start)
//   • navigator.onLine===false — airplane/wifi dropped while running
// The same dual check the photo inbox (_pinOffline) and the dashboard have
// used for versions.
function _rrOfflineNow() {
  try {
    return !!(window._offlineMode || (typeof navigator !== 'undefined' && navigator.onLine === false));
  } catch (e) { return false; }
}
if (typeof window !== 'undefined') window._rrOfflineNow = _rrOfflineNow;

function _rrWriteFailed(kind, args, err) {
  try { if (typeof rrOutboxRecord === 'function') rrOutboxRecord(kind, args, err); } catch (e) {}
  return err;
}

// v0.9.1253 (row-identity audit, findings 3, 4, 12): verify before writing to
// a row you did not just read.
//
// A row number is a POSITION, and a position is only meaningful relative to a
// snapshot. Rows move when a row above them is DELETED, and the app deletes
// from exactly two tabs: My Collection and For Sale. Everywhere else — Sold,
// Parts Needed, the ephemera tabs — a removed record is BLANKED in place, so
// nothing below it ever shifts.
//
// v0.9.1267 (audit 2026-08-02 round 2, finding R3) — READ THAT PARAGRAPH
// AGAIN BEFORE EDITING THIS. The original version of this comment drew the
// premise correctly and then reached the opposite conclusion: the guard was
// wired onto Ephemera, Parts and Sold, the three tabs whose rows cannot move,
// and left off the two that can. It protected everything except the thing it
// was written to protect.
//
// The hazard is not the app racing itself. It is a SECOND view of the same
// spreadsheet: the phone deletes an item, every My Collection row below it
// moves up one, and the desktop tab that has been sitting open all morning
// still holds the old numbers — there is no polling, and the one refresh path
// needs the tab to go hidden AND the snapshot to be over five minutes old, so
// a visible desktop tab never re-reads at all. Brad editing the sheet directly
// on his PC is the same thing from the other direction, and more common. The
// stale side then writes a whole row onto a record it has never seen. Google
// answers 200. Nothing anywhere notices.
//
// ONE reader for "is row N still the record I think it is."
//
// WHAT IT COMPARES, and why that changed. The first version compared column A
// only — the Item Number. That is not an identity: you can own three 2343s, so
// a shift of one row lands on another 2343 and the check passes on the wrong
// record. Every tab that can shift already carries a genuinely unique per-copy
// Inventory ID, so the guard now prefers it and falls back to the item number
// only when the row has no id to compare (rows written before ids existed, or
// a backfill that has not landed yet). An ABSENT id is not evidence of a
// mismatch, so it must not be treated as one — that is the difference between
// a guard and an outage.
//
// A definite MISMATCH refuses the write. A failed CHECK does not: a network
// hiccup is not evidence of a mismatch, and refusing on one would make
// editing fail whenever the connection wobbles. That leaves the pre-existing
// behaviour exactly as it was in the only case this cannot improve on.

// Where each tab keeps its per-copy Inventory ID, derived from the header
// arrays that already define these tabs rather than written out as letters.
// Add or reorder a column and the guard moves with it; hand-written letters
// are exactly how the pre-Session-156 code ended up writing inventoryId into
// the matchedTo column. Returns null for a tab with no id column, which is not
// a failure — it means "compare the item number, that is all this tab has".
function _rrTabIdentity(tab) {
  try {
    if (typeof PERSONAL_TAB !== 'undefined' && tab === PERSONAL_TAB) {
      const i = PERSONAL_FIELD_INDEX.inventoryId;
      return (i === undefined) ? null : { idx: i, col: colLetter(i) };
    }
    let headers = null;
    if (tab === 'For Sale' && typeof FOR_SALE_HEADERS !== 'undefined') headers = FOR_SALE_HEADERS;
    else if (tab === 'Sold' && typeof SOLD_HEADERS !== 'undefined') headers = SOLD_HEADERS;
    else if (tab === 'Want-Upgrade List' && typeof WISHLIST_HEADERS !== 'undefined') headers = WISHLIST_HEADERS;
    if (!headers) return null;
    let i = headers.indexOf('Inventory ID');
    if (i < 0) i = headers.indexOf('Upgrading Inventory ID');
    return (i < 0) ? null : { idx: i, col: colLetter(i) };
  } catch (e) {
    return null;
  }
}

// expectedNum   — the item number the caller believes is in column A
// expectedInvId — the per-copy Inventory ID the caller believes is on the row.
//                 Optional, and worth passing wherever it is in hand: it is the
//                 only value here that identifies ONE COPY rather than a model.
async function rrRowStillIs(spreadsheetId, tab, rowNum, expectedNum, expectedInvId) {
  if (!rowNum || Number(rowNum) === 99999) return false;
  const wantNum = String(expectedNum == null ? '' : expectedNum).trim();
  const wantId  = String(expectedInvId == null ? '' : expectedInvId).trim();
  if (!wantNum && !wantId) return true;      // nothing to compare — do not block

  const ident = wantId ? _rrTabIdentity(tab) : null;
  const range = ident
    ? tab + '!A' + rowNum + ':' + ident.col + rowNum
    : tab + '!A' + rowNum + ':A' + rowNum;

  let cells;
  try {
    const res = await sheetsGet(spreadsheetId, range);
    cells = (((res && res.values) || [[]])[0] || []);
  } catch (e) {
    console.warn('[rows] could not verify ' + tab + ' row ' + rowNum + ' — writing anyway:', e && e.message);
    return true;
  }
  const _cell = function (i) { return String(cells[i] == null ? '' : cells[i]).trim(); };
  const gotNum = _cell(0);
  const gotId  = ident ? _cell(ident.idx) : '';

  // The id settles it in both directions when both sides have one.
  if (wantId && gotId) {
    if (gotId === wantId) return true;
    console.warn('[rows] ' + tab + ' row ' + rowNum + ' now holds Inventory ID "' + gotId +
                 '", expected "' + wantId + '" — refusing to write. The sheet was changed somewhere else.');
    return false;
  }
  // No id to compare on one side or the other. Fall back to the item number,
  // which is what this guard has always done. Weaker — item numbers repeat —
  // but an absent id cannot prove a mismatch, and refusing here would break
  // editing on every row written before Inventory IDs existed.
  if (!wantNum) return true;
  if (gotNum === wantNum) return true;
  console.warn('[rows] ' + tab + ' row ' + rowNum + ' now holds "' + gotNum + '", expected "' + wantNum +
               '" — refusing to write. The sheet was changed somewhere else.');
  return false;
}
if (typeof window !== 'undefined') window.rrRowStillIs = rrRowStillIs;

// v0.9.1267 (R3): the message the user sees when a write is refused. One copy,
// because it is going to appear at ~20 call sites and "roughly the same
// wording twenty times" is how a product ends up sounding like twenty
// products. It has to say three things: nothing was saved, why, and what to do.
const RR_ROW_MOVED_MSG = 'That row moved in your spreadsheet — nothing was saved. Refresh and try again.';
if (typeof window !== 'undefined') window.RR_ROW_MOVED_MSG = RR_ROW_MOVED_MSG;
function rrRowMovedToast() {
  try { if (typeof showToast === 'function') showToast(RR_ROW_MOVED_MSG, 5000, true); } catch (e) {}
}
if (typeof window !== 'undefined') window.rrRowMovedToast = rrRowMovedToast;

// v0.9.1267 (R3): verify-then-write for a write that replaces a WHOLE ROW.
//
// The range is the single source of truth for which tab and row are being
// written — parsed out of it rather than passed alongside it, because a
// separate tab/row pair is a second copy of the same fact and the two can
// drift apart on the next edit. "My Collection!A123:AD123" -> tab "My
// Collection", row 123.
//
// Scope, stated plainly: this is for the writes that replace or blank an
// entire row, where landing on the wrong row erases an item. Single-cell
// writes (a photo link, one price) are a smaller blast radius and are not
// converted yet — see the R3 note in the audit findings.
//
// Returns true if the write happened, false if it was refused. On false the
// user has already been told; the caller must not update its own state.
// Errors from the write itself still throw, exactly as sheetsUpdate does.
async function sheetsUpdateRow(spreadsheetId, range, values, expected) {
  if (expected === undefined) {
    throw new Error('sheetsUpdateRow: `expected` is required — say which record you believe is at ' +
                    range + ' before replacing it.');
  }
  const m = /^(.*)!([A-Z]+)(\d+)(?::|$)/.exec(String(range || ''));
  if (!m) {
    // Not a row-scoped range. Refusing outright would be worse than the bug:
    // fail loudly at the gate instead, where a bad range is a code error.
    throw new Error('sheetsUpdateRow: could not read a tab and row out of "' + range + '".');
  }
  const tab = m[1];
  const rowNum = Number(m[3]);
  const _exp = (expected && typeof expected === 'object') ? expected : { itemNum: expected, inventoryId: '' };
  const _still = await rrRowStillIs(spreadsheetId, tab, rowNum, _exp.itemNum, _exp.inventoryId);
  if (!_still) {
    console.warn('[rows] refusing to replace ' + range + ' — it is not the record we meant.');
    rrRowMovedToast();
    return false;
  }
  await sheetsUpdate(spreadsheetId, range, values);
  return true;
}
if (typeof window !== 'undefined') window.sheetsUpdateRow = sheetsUpdateRow;

async function sheetsUpdate(spreadsheetId, range, values) {
  // v0.9.985 (perf): any write = data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.1599 (Brad: work the lists at a train show with no wifi): an
  // offline BOOT — v0.9.1604: or airplane mid-session — is no longer view-only. The v826 refusal predates the
  // write-outbox — the write is now RECORDED exactly like a mid-session
  // network failure, so it reaches the sheet after reconnect. Same throw
  // contract downstream; only the bookkeeping and the words changed.
  if (_rrOfflineNow()) {
    if (typeof showToast === 'function') showToast('You\u2019re offline \u2014 saved on this device. It goes to your sheet when you\u2019re back on.', 3500);
    throw _rrWriteFailed('update', { sheetId: spreadsheetId, range: range, values: values }, new Error('offline'));
  }
  // v0.9.840 (Phase C): lapsed trial/subscription = view-and-export-only.
  if (window._readOnlyMode) {
    if (typeof showToast === 'function') showToast('Your trial has ended — subscribe to keep adding and editing', 4000, true);
    throw new Error('readonly');
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(range)}?valueInputOption=USER_ENTERED`;
  const body = JSON.stringify({ range, majorDimension: 'ROWS', values });
  try {
    const res = await _withTokenRetry(() => fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body,
    }));
    const json = await res.json();
    if (json.error) {
      console.error('sheetsUpdate error:', JSON.stringify(json.error));
      throw new Error('Sheets update failed: ' + (json.error.message || JSON.stringify(json.error)));
    }
    // v0.9.1409 — this write LANDED, so any queued write to the same cells is
    // now a stale older value. Clear it before it can replay on top of what
    // just went up (the other half of the coalesce in write-outbox.js). Guarded
    // and best-effort: never let outbox bookkeeping fail a successful save.
    try { if (typeof rrOutboxSupersede === 'function') rrOutboxSupersede(spreadsheetId, range); } catch (e) {}
    return json;
  } catch (e) {
    throw _rrWriteFailed('update', { sheetId: spreadsheetId, range: range, values: values }, e);
  }
}

async function sheetsAppend(spreadsheetId, range, values) {
  // v0.9.985 (perf): any write = data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.1599: offline boot records the append instead of refusing it (see
  // sheetsUpdate). New rows are the train-show case — they auto-send after
  // reconnect through rrOutboxDrainAppends, with the app's row-exists check
  // standing guard against a request that died AFTER reaching Google.
  if (_rrOfflineNow()) {
    if (typeof showToast === 'function') showToast('You\u2019re offline \u2014 saved on this device. It goes to your sheet when you\u2019re back on.', 3500);
    // v0.9.1600 (show mode 2): record, then RETURN row-unknown instead of
    // throwing. A wizard save is many appends in sequence (engine + tender,
    // item + box, the IS row); a throw at the first aborts the rest, so only
    // one row of a multi-row save would ever queue — a partial save wearing
    // a kept-toast. 0 is the v1200 documented "row unknown" answer every
    // caller already tolerates; the save runs to completion, every row
    // queues, local state updates, and the wizard closes normally.
    _rrWriteFailed('append', { sheetId: spreadsheetId, range: range, values: values }, new Error('offline'));
    return 0;
  }
  // v0.9.840 (Phase C): lapsed trial/subscription = view-and-export-only.
  if (window._readOnlyMode) {
    if (typeof showToast === 'function') showToast('Your trial has ended — subscribe to keep adding and editing', 4000, true);
    throw new Error('readonly');
  }
  // Extract raw tab name from range (e.g. "For Sale!A:A" -> "For Sale")
  const tabName = range.includes('!') ? range.split('!')[0] : range;

  // ── v0.9.1200 (structural audit #1): a REAL append, atomic at Google ──
  // The old shape was read-then-write: count column A, compute nextRow, PUT
  // to that exact range. Two saves in flight at once — Brad's phone at a
  // train show and his PC at home, or a double-fired handler slipping a
  // guard — both counted the same rows, computed the same nextRow, and the
  // SECOND PUT silently replaced the first row. No error, no trace: an item
  // that was saved simply never existed. Worse than a failed write, because
  // this one succeeds — over someone else's data.
  //
  // Sheets' own append endpoint (:append with insertDataOption=INSERT_ROWS)
  // does the find-the-end and the write as ONE server-side operation, so
  // concurrent appends interleave instead of colliding. The row the data
  // actually landed on comes back in updates.updatedRange — parsed and
  // returned, same contract as before (v0.9.1196 callers store it). If the
  // response ever lacks a parsable range, return 0 — the honest "row
  // unknown", which every downstream guard already treats as do-not-write.
  const body = JSON.stringify({ majorDimension: 'ROWS', values: values });
  const appendRange = `${tabName}!A3:A`;   // anchor the table below the two header rows
  try {
    const res = await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body }
    ));
    const json = await res.json();
    if (json.error) {
      console.error('sheetsAppend error:', JSON.stringify(json.error));
      throw new Error('Sheets write failed: ' + (json.error.message || JSON.stringify(json.error)));
    }
    const _ur = (json.updates && json.updates.updatedRange) || '';
    const _rm = _ur.match(/![A-Z]+(\d+)/);
    const firstRow = _rm ? parseInt(_rm[1], 10) : 0;
    console.log('[Sheets] Appended', values.length, 'row(s) at', _ur || '(range not reported)');
    return firstRow;
  } catch (e) {
    // An append names a TABLE, not a row, so it is the one write that stays
    // safe to replay however long it waited — nothing can shift under it.
    throw _rrWriteFailed('append', { sheetId: spreadsheetId, range: range, values: values }, e);
  }
}

// v0.9.1274 (audit 2026-08-02 round 2, finding R14): emptying a range is a
// write, and a destructive one. sell.js did it on raw fetch inside a bare
// `catch (e) {}` — no res.ok check, no retry, no outbox record — and then
// wrote the new list straight over the top.
//
// What that cost when it failed: the clear silently does nothing, the update
// writes a SHORTER list, and every row of the old list below the new one
// stays exactly where it was. The user's customers open a link showing items
// that are no longer for sale, and nothing anywhere says so.
//
// Same guards, same retry, same failure record as the other three. It throws
// like they do — the two callers already catch and tell the user the list
// could not be built, which is the honest outcome. A sale sheet that did not
// update beats one that updated wrongly.
async function sheetsClear(spreadsheetId, range) {
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.1599: deliberately NOT recorded-for-later (unlike update/append) —
  // a queued clear replayed against a list that changed meanwhile is the
  // half-rebuilt-sale-sheet disaster this function's header describes.
  if (_rrOfflineNow()) {
    if (typeof showToast === 'function') showToast('You\u2019re offline \u2014 rebuilding the sale list needs a connection.', 3500, true);
    throw new Error('offline');
  }
  if (window._readOnlyMode) {
    if (typeof showToast === 'function') showToast('Your trial has ended — subscribe to keep adding and editing', 4000, true);
    throw new Error('readonly');
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(range)}:clear`;
  try {
    const res = await _withTokenRetry(() => fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    }));
    const json = await res.json().catch(() => ({}));
    if (json.error) {
      console.error('sheetsClear error:', JSON.stringify(json.error));
      throw new Error('Sheets clear failed: ' + (json.error.message || JSON.stringify(json.error)));
    }
    if (!res.ok) throw new Error('Sheets clear failed: HTTP ' + res.status);
    return json;
  } catch (e) {
    throw _rrWriteFailed('clear', { sheetId: spreadsheetId, range: range }, e);
  }
}
if (typeof window !== 'undefined') window.sheetsClear = sheetsClear;

// ══ v0.9.1284 (overnight safety sweep — the ~45 sites R3 deferred) ═══════
// ONE guarded writer for every row-addressed update outside the four §203
// sites. A sheet range is a position, not an identity: rows on My Collection
// and For Sale genuinely shift (sheetsDeleteRow is used on both), so a write
// addressed by a REMEMBERED row number must confirm the row still holds the
// record it thinks it does — and refuse, with a message, when it does not.
//
// The check inherits rrRowStillIs's manners: nothing to compare -> allow;
// verify READ failed -> write anyway (availability), the same trade §203
// chose. `expect` carries what the caller believes: { num, invId } — pass
// whatever the record has; blanks compare as "nothing to compare".
// Returns true when the write landed, false when it refused. Callers whose
// surrounding code tolerates a failed write may ignore the return; callers
// that celebrate success must check it.
async function rrVerifiedRowUpdate(spreadsheetId, tab, rowNum, range, values, expect, what) {
  const _ok = await rrRowStillIs(spreadsheetId, tab, rowNum,
    (expect && expect.num) || '', (expect && expect.invId) || '');
  if (!_ok) {
    if (typeof showToast === 'function') {
      showToast('Your ' + (what || tab) + ' changed somewhere else — nothing was written. Refresh and try again.', 5000, true);
    }
    return false;
  }
  await sheetsUpdate(spreadsheetId, range, values);
  return true;
}
if (typeof window !== 'undefined') window.rrVerifiedRowUpdate = rrVerifiedRowUpdate;

// ══ v0.9.1288 (audit R3-3) — "did the removal actually land?" ════════════
// rrVerifiedRowUpdate has THREE outcomes and the remove flows were written
// for one of them:
//
//   true    the row was ours and it is now blank — the removal happened
//   false   the row is not ours anymore. Nothing was written, and it has
//           ALREADY told the user so. Say nothing further; a second toast
//           would just talk over the first.
//   throws  the write itself failed — offline, signed out, no permission,
//           rate-limited. sheetsUpdate has already handed it to the outbox
//           where applicable; rrSaveError turns the exception into the
//           sentence that fits, including "it is kept and will go up".
//
// Every remove flow needs the same answer to the same question, so it lives
// here once rather than as seven copies of the same try/catch. Collapses all
// three outcomes to a boolean and guarantees the user was told something in
// both failing cases — so a caller can put "✓ Removed" behind one honest if:
//
//     if (!(await rrRemoveRowConfirmed(...))) return;
//
// The old shape — fire the write, never look back, announce success on the
// next line — meant a refused removal looked exactly like a successful one
// until the page was reloaded. That is the bug this exists to make hard to
// write again. See test section 238.
async function rrRemoveRowConfirmed(spreadsheetId, tab, rowNum, range, values, expect, what) {
  try {
    // v0.9.1762: this shape blanks the row where it stands, which erases it
    // just as surely as a delete does. Same rule — keep a copy or don't remove.
    if (!(await rrArchiveRowBeforeRemoval(spreadsheetId, tab, rowNum, 'cleared from ' + (what || tab), expect))) return false;
    return await rrVerifiedRowUpdate(spreadsheetId, tab, rowNum, range, values, expect, what);
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast((typeof rrSaveError === 'function')
        ? rrSaveError(e, 'the removal')
        : 'Could not remove that — please try again.', 4500, true);
    }
    return false;
  }
}
if (typeof window !== 'undefined') window.rrRemoveRowConfirmed = rrRemoveRowConfirmed;

// ══ v0.9.1762 — NOTHING LEAVES THE SHEET WITHOUT A COPY ══════════════════
//
// Brad, after v0.9.1761 shipped: "now can we make sure this doesn't happen
// again."
//
// v1761 fixed the bug that deleted his original 6-24177 and added a sweep that
// fails the build if that shape comes back. This is the other half, and it is
// the half that matters more: it does not try to be RIGHT, it makes being
// WRONG cost nothing. When his row went, the only reason it could be put back
// was that its values happened to still be sitting in an open page's memory.
// That was luck. Luck is not a recovery plan, and the next bug of this kind
// will be one nobody has thought of yet.
//
// So: every row this app removes from the user's OWN sheet is copied to a
// "Deleted Rows" tab first — whole, with when it went, which tab it came from,
// which row it was, what the user was doing, and its Inventory ID. The app
// never deletes anything from that tab.
//
// TWO shapes remove data, and both come through this file:
//   sheetsDeleteRow        takes the row out (everything below shifts up)
//   rrRemoveRowConfirmed   blanks the row where it stands
// Archiving at those two gates rather than at the ~20 call sites is the same
// reasoning that put the delete guard here in v1267: a check at the call sites
// is a check that four places remember and the one that matters forgets.
//
// **If the copy cannot be made, the removal does not happen.** That is the
// whole point — an unrecoverable removal is the thing being prevented. The
// failure is always announced, never silent.
const RR_TRASH_TAB = 'Deleted Rows';
let _rrTrashReady = false;          // the tab is checked once per session, not per row

function _rrTrashSkip(spreadsheetId, sheetName) {
  // Only the user's OWN sheet. tools.js removes rows from the shared master
  // catalog; that is not the user's data and does not belong in their bin.
  try {
    if (typeof state === 'undefined' || !state || !state.personalSheetId) return true;
    if (String(spreadsheetId) !== String(state.personalSheetId)) return true;
  } catch (e) { return true; }
  return String(sheetName) === RR_TRASH_TAB;      // never archive the archive
}

async function _rrTrashEnsureTab(spreadsheetId) {
  if (_rrTrashReady) return true;
  const metaRes = await _withTokenRetry(() => fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ));
  const meta = await metaRes.json();
  const titles = (((meta && meta.sheets) || [])).map(s => (s && s.properties && s.properties.title) || '');
  if (titles.indexOf(RR_TRASH_TAB) < 0) {
    await _withTokenRetry(() => fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: RR_TRASH_TAB } } }] })
    }));
    // Two header rows, because every table in this workbook has two and the
    // app's own append anchors at A3.
    await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(RR_TRASH_TAB + '!A1')}?valueInputOption=RAW`,
      { method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [
          ['Removed rows are kept here. The Rail Roster never deletes anything from this tab \u2014 if something went that should not have, it is below.'],
          ['Removed at', 'From tab', 'Was row', 'What happened', 'Inventory ID', 'Item Number', 'The row exactly as it was, from here on \u2192']
        ] }) }
    ));
    console.log('[trash] created the "' + RR_TRASH_TAB + '" tab');
  }
  _rrTrashReady = true;
  return true;
}

// The six columns in front of the row itself. One builder, so the single-row
// and bulk forms can never drift into two different archive shapes.
function _rrTrashHead(sheetName, rowNumber, why, cells, invId, itemNum) {
  let id = String(invId || '');
  if (!id) {
    // Not told which copy — read it off the row, the same way the delete guard
    // does. An archive with no Inventory ID is an archive you cannot match
    // back to anything.
    try {
      const ident = _rrTabIdentity(sheetName);
      if (ident && cells[ident.idx] != null) id = String(cells[ident.idx]).trim();
    } catch (e) {}
  }
  return [
    new Date().toISOString(),
    String(sheetName),
    String(rowNumber),
    String(why || 'removed'),
    id,
    String(itemNum || (cells[0] == null ? '' : cells[0])),
  ];
}

async function _rrTrashAppend(spreadsheetId, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(RR_TRASH_TAB + '!A3:A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows.slice(i, i + 500) }) }
    ));
    if (!res || !res.ok) throw new Error('append returned ' + (res && res.status));
  }
}

// The BULK form, for a removal that takes many rows in one request — today
// that is the import undo, which can take hundreds of rows and used to build
// its own raw row-delete request, going around sheetsDeleteRow and so around
// the archive. Found by this release's own sweep, not by a user losing
// something. (The name of that request is deliberately not written here: two
// suites locate the real one by its position in this file.)
//
// One read of the tab instead of one per row. Returns true only when every row
// that had anything in it has been copied.
async function rrArchiveRowsBeforeRemoval(spreadsheetId, sheetName, rowNumbers, why) {
  if (_rrTrashSkip(spreadsheetId, sheetName)) return true;
  const wanted = (rowNumbers || []).filter(n => n && Number(n) !== 99999);
  if (!wanted.length) return true;
  if (_rrOfflineNow()) {
    if (typeof showToast === 'function') showToast('You\u2019re offline, so nothing was removed. The app keeps a copy of every row before it goes, and it can\u2019t do that until you\u2019re back online.', 6000, true);
    return false;
  }
  try {
    const got = await sheetsGet(spreadsheetId, "'" + sheetName + "'!A:BZ");
    const all = (got && got.values) || [];
    const out = [];
    wanted.forEach(function (n) {
      const cells = all[n - 1] || [];
      if (!cells.length || !cells.join('').trim()) return;     // nothing there to keep
      out.push(_rrTrashHead(sheetName, n, why, cells, '', '')
               .concat(cells.map(c => (c == null ? '' : String(c)))));
    });
    if (!out.length) return true;
    await _rrTrashEnsureTab(spreadsheetId);
    await _rrTrashAppend(spreadsheetId, out);
    console.log('[trash] kept ' + out.length + ' rows from ' + sheetName + ' (' + why + ')');
    return true;
  } catch (e) {
    console.warn('[trash] could not keep copies of ' + wanted.length + ' rows from ' + sheetName +
                 ' — refusing to remove them:', (e && e.message) || e);
    if (typeof showToast === 'function') showToast('Nothing was removed \u2014 the app couldn\u2019t save copies of those rows first, and it won\u2019t remove anything it can\u2019t put back. Try again in a moment.', 6500, true);
    return false;
  }
}

// Returns true when it is safe to remove the row (a copy is kept, or there was
// nothing to keep), false when the removal must NOT go ahead.
async function rrArchiveRowBeforeRemoval(spreadsheetId, sheetName, rowNumber, why, expect) {
  if (_rrTrashSkip(spreadsheetId, sheetName)) return true;
  if (!rowNumber || Number(rowNumber) === 99999) return true;   // nothing on the sheet yet
  if (_rrOfflineNow()) {
    // Offline, the removal itself would fail anyway — but say the useful thing
    // rather than a generic write error.
    if (typeof showToast === 'function') showToast('You\u2019re offline, so nothing was removed. The app keeps a copy of every row before it goes, and it can\u2019t do that until you\u2019re back online.', 6000, true);
    return false;
  }
  try {
    const got = await sheetsGet(spreadsheetId, sheetName + '!A' + rowNumber + ':BZ' + rowNumber);
    const cells = (((got && got.values) || [[]])[0] || []);
    if (!cells.length || !cells.join('').trim()) return true;   // already empty — nothing to keep
    await _rrTrashEnsureTab(spreadsheetId);
    const _e = (expect && typeof expect === 'object') ? expect : {};
    const head = _rrTrashHead(sheetName, rowNumber, why, cells,
                              _e.inventoryId || _e.invId || '', _e.itemNum || _e.num || '');
    // RAW, deliberately: an archive records what was THERE, and USER_ENTERED
    // would reinterpret dates, leading zeros and anything starting with '='.
    await _rrTrashAppend(spreadsheetId, [head.concat(cells.map(c => (c == null ? '' : String(c))))]);
    console.log('[trash] kept a copy of ' + sheetName + ' row ' + rowNumber + ' (' + why + ')');
    return true;
  } catch (e) {
    console.warn('[trash] could not keep a copy of ' + sheetName + ' row ' + rowNumber +
                 ' — refusing to remove it:', (e && e.message) || e);
    if (typeof showToast === 'function') showToast('Nothing was removed \u2014 the app couldn\u2019t save a copy of that row first, and it won\u2019t remove anything it can\u2019t put back. Try again in a moment.', 6500, true);
    return false;
  }
}
if (typeof window !== 'undefined') {
  window.rrArchiveRowBeforeRemoval = rrArchiveRowBeforeRemoval;
  window.rrArchiveRowsBeforeRemoval = rrArchiveRowsBeforeRemoval;
  window.RR_TRASH_TAB = RR_TRASH_TAB;
}

// ══ v0.9.1763 — PUT IT BACK ══════════════════════════════════════════════
// v1762 made every removal recoverable. It did not make it RECOVERABLE BY THE
// USER: the rows were safe in the "Deleted Rows" tab, but getting one back
// meant opening the spreadsheet and copying cells, and Brad does not do manual
// steps. A safety net you have to be a spreadsheet user to reach is half a net.
//
// These two functions are the data side; backup.js draws the list, beside the
// backup/restore screen that already exists. They live HERE, next to the code
// that writes the archive, so the tab's shape is described in exactly one file.
const RR_TRASH_HEAD_COLS = 6;      // when · from tab · was row · why · inv id · item number
const RR_TRASH_FIRST_ROW = 3;      // two header rows, like every table in this workbook

// The most recent removals, newest first. Read-only.
async function rrTrashList(limit) {
  const out = [];
  if (typeof state === 'undefined' || !state || !state.personalSheetId) return out;
  let got;
  try {
    got = await sheetsGet(state.personalSheetId, "'" + RR_TRASH_TAB + "'!A" + RR_TRASH_FIRST_ROW + ':BZ');
  } catch (e) {
    // No tab yet simply means nothing has ever been removed.
    console.warn('[trash] could not read the bin:', (e && e.message) || e);
    return out;
  }
  const rows = (got && got.values) || [];
  for (let i = rows.length - 1; i >= 0 && out.length < (limit || 25); i--) {
    const r = rows[i] || [];
    if (!r.length || !String(r[1] || '').trim()) continue;          // no source tab = not one of ours
    const why = String(r[3] == null ? '' : r[3]);
    out.push({
      archiveRow: RR_TRASH_FIRST_ROW + i,
      when:     String(r[0] == null ? '' : r[0]),
      tab:      String(r[1] == null ? '' : r[1]),
      wasRow:   String(r[2] == null ? '' : r[2]),
      why:      why,
      invId:    String(r[4] == null ? '' : r[4]),
      itemNum:  String(r[5] == null ? '' : r[5]),
      cells:    r.slice(RR_TRASH_HEAD_COLS).map(c => (c == null ? '' : String(c))),
      restored: / \u2014 put back /.test(why),
    });
  }
  return out;
}
if (typeof window !== 'undefined') window.rrTrashList = rrTrashList;

// Put ONE row back on the list it came from. Returns {ok, reason, row}.
//
// It lands at the BOTTOM of that list rather than its old position: the old row
// number stopped meaning anything the moment the rows beneath it moved up. That
// is not a loss — the app finds owned copies by Inventory ID, never by position
// (v1761) — it just looks different in the sheet.
async function rrTrashRestore(archiveRow) {
  if (typeof state === 'undefined' || !state || !state.personalSheetId) return { ok: false, reason: 'not signed in' };
  if (_rrOfflineNow()) return { ok: false, reason: 'offline' };
  try {
    // Re-read the archive line rather than trusting the list on screen.
    const got = await sheetsGet(state.personalSheetId, "'" + RR_TRASH_TAB + "'!A" + archiveRow + ':BZ' + archiveRow);
    const r = (((got && got.values) || [[]])[0] || []).map(c => (c == null ? '' : String(c)));
    const tab = String(r[1] || '').trim();
    const why = String(r[3] || '');
    const invId = String(r[4] || '').trim();
    const cells = r.slice(RR_TRASH_HEAD_COLS);
    if (!tab || !cells.length || !cells.join('').trim()) return { ok: false, reason: 'that line has nothing to put back' };
    if (/ \u2014 put back /.test(why)) return { ok: false, reason: 'already' };

    // Already there? Never make a second copy of something that came back once,
    // or that never actually left. Guarded on the Inventory ID, which is the
    // only value that names ONE copy; a tab with no id column cannot be checked
    // this way and is allowed through.
    if (invId) {
      const ident = _rrTabIdentity(tab);
      if (ident) {
        const col = await sheetsGet(state.personalSheetId, "'" + tab + "'!" + ident.col + ':' + ident.col);
        const have = ((col && col.values) || []).some(x => String((x && x[0]) || '').trim() === invId);
        if (have) return { ok: false, reason: 'present' };
      }
    }

    // RAW, to match how it was archived: this restores what was THERE, and
    // USER_ENTERED would reinterpret a date, a leading zero or a leading '='.
    const res = await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${state.personalSheetId}/values/${_encodeRange(tab + '!A' + RR_TRASH_FIRST_ROW + ':A')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [cells] }) }
    ));
    if (!res || !res.ok) throw new Error('append returned ' + (res && res.status));
    const body = await res.json().catch(() => null);
    const landed = Number((((body && body.updates && body.updates.updatedRange) || '').match(/!A(\d+)/) || [])[1]) || 0;

    // Mark the archive line so the list cannot offer it twice. The line is kept
    // — the app never deletes anything from this tab — only annotated, and the
    // original reason stays in front of the note.
    try {
      await _withTokenRetry(() => fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${state.personalSheetId}/values/${_encodeRange(RR_TRASH_TAB + '!D' + archiveRow)}?valueInputOption=RAW`,
        { method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[why + ' \u2014 put back ' + new Date().toISOString().slice(0, 10)]] }) }
      ));
    } catch (eMark) {
      // The row IS back; failing to annotate is cosmetic. Say so in the log and
      // let the user see it listed again rather than pretend it failed.
      console.warn('[trash] restored but could not mark the archive line:', (eMark && eMark.message) || eMark);
    }
    try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
    console.log('[trash] put ' + (r[5] || '') + ' back on ' + tab + (landed ? ' at row ' + landed : ''));
    return { ok: true, row: landed, tab: tab, itemNum: String(r[5] || '') };
  } catch (e) {
    console.warn('[trash] could not put row back:', (e && e.message) || e);
    return { ok: false, reason: (e && e.message) || 'the write failed' };
  }
}
if (typeof window !== 'undefined') window.rrTrashRestore = rrTrashRestore;

// v0.9.1267 (audit 2026-08-02 round 2, finding R3): `expected` is REQUIRED,
// and omitting it throws rather than deleting.
//
// This is the operation the whole row-identity problem grows out of. Every
// other stale-row write damages one record; a delete removes a record AND
// moves every row beneath it, so one wrong delete invalidates the row numbers
// every other device is holding, in one stroke. It is the cause, not a symptom.
//
// The guard therefore lives HERE rather than at the seven call sites. Checking
// at the call sites is the arrangement that produced this finding in the first
// place: the check existed, four places remembered it, and the places that
// mattered did not. A parameter that throws when it is missing cannot be
// forgotten — the gate catches it, and it can never reach a user.
//
// `expected` is {itemNum, inventoryId} (either key may be blank), or a plain
// string treated as the item number. Pass the inventoryId whenever it is in
// hand; on My Collection it is the only value that names ONE COPY.
//
// Returns true if the row was deleted, false if it was refused. Callers must
// not update their in-memory state on a false — the row is still there.
async function sheetsDeleteRow(spreadsheetId, sheetName, rowNumber, expected) {
  if (expected === undefined) {
    throw new Error('sheetsDeleteRow: `expected` is required — say which record you believe is on ' +
                    sheetName + ' row ' + rowNumber + ' before deleting it. See the note above sheetsDeleteRow.');
  }
  const _exp = (expected && typeof expected === 'object') ? expected : { itemNum: expected, inventoryId: '' };
  const _still = await rrRowStillIs(spreadsheetId, sheetName, rowNumber, _exp.itemNum, _exp.inventoryId);
  if (!_still) {
    console.warn('[rows] refusing to delete ' + sheetName + ' row ' + rowNumber + ' — it is not the record we meant.');
    rrRowMovedToast();
    return false;
  }
  // v0.9.1762: keep a copy before it goes. No copy, no delete — and the row is
  // read here, while it is still the record the guard above just confirmed.
  if (!(await rrArchiveRowBeforeRemoval(spreadsheetId, sheetName, rowNumber, 'removed', _exp))) return false;
  // v0.9.985 (perf): any write = data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.1246: a delete moves every row beneath it, so every range write
  // already queued now names a position that may not be what it meant. Tell
  // the outbox BEFORE the delete, not after — if the delete succeeds and this
  // never ran, a stale entry would be replayed onto the wrong item.
  try { if (typeof rrOutboxRowsMoved === 'function') rrOutboxRowsMoved(); } catch (e) {}
  try {
  // First get the sheetId (numeric) for the named tab
  const metaRes = await _withTokenRetry(() => fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ));
  const meta = await metaRes.json();
  const sheet = meta.sheets.find(s => s.properties.title === sheetName);
  // v0.9.1267 (R3): false, not undefined. Nothing was deleted, and callers now
  // read the return value to decide whether to update their own state.
  if (!sheet) return false;
  const sheetId = sheet.properties.sheetId;

  // Delete the row (0-indexed, startIndex = rowNumber-1)
  await _withTokenRetry(() => fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          }
        }
      }]
    })
  }));
  return true;
  } catch (e) {
    // Recorded so it can be SHOWN. Never replayed — see write-outbox.js.
    throw _rrWriteFailed('delete', { sheetId: spreadsheetId, sheetName: sheetName, rowNumber: rowNumber }, e);
  }
}

