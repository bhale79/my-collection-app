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
  // offline BOOT is no longer view-only. The v826 refusal predates the
  // write-outbox — the write is now RECORDED exactly like a mid-session
  // network failure, so it reaches the sheet after reconnect. Same throw
  // contract downstream; only the bookkeeping and the words changed.
  if (window._offlineMode) {
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
  if (window._offlineMode) {
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
  if (window._offlineMode) {
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

