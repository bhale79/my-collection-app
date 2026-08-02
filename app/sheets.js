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

// v0.9.1246: the three write functions below are the ONE place every write to
// the user's sheet passes through — 193 call sites, 70 of them behind a catch
// that swallows the error. Recording the failure HERE means those catches keep
// swallowing the exception but no longer swallow the fact. The error is
// rethrown untouched, so nothing downstream behaves any differently.
function _rrWriteFailed(kind, args, err) {
  try { if (typeof rrOutboxRecord === 'function') rrOutboxRecord(kind, args, err); } catch (e) {}
  return err;
}

// v0.9.1253 (row-identity audit, findings 3, 4, 12): verify before writing to
// a row you did not just read.
//
// A row number is a POSITION. Inside the app nothing shifts on these tabs —
// Ephemera, Parts and Sold rows are BLANKED, never deleted, and the only
// tabs the app deletes from are My Collection and For Sale. But Brad edits
// the same spreadsheet on his PC, and the phone can still be showing data it
// cached before that edit. A blind write then overwrites a different record,
// and for Sold that record is a price/date/photo snapshot the app itself
// warns cannot be undone.
//
// ONE reader for "is row N still the record I think it is". Every tab this
// guards keeps its identifying value in column A — Item ID, Part ID, Item
// Number — so one check covers all of them.
//
// A definite MISMATCH refuses the write. A failed CHECK does not: a network
// hiccup is not evidence of a mismatch, and refusing on one would make
// editing fail whenever the connection wobbles. That leaves the pre-existing
// behaviour exactly as it was in the only case this cannot improve on.
async function rrRowStillIs(spreadsheetId, tab, rowNum, expected) {
  if (!rowNum || Number(rowNum) === 99999) return false;
  const want = String(expected == null ? '' : expected).trim();
  if (!want) return true;                    // nothing to compare — do not block
  let got;
  try {
    const res = await sheetsGet(spreadsheetId, tab + '!A' + rowNum + ':A' + rowNum);
    got = String((((res && res.values) || [[]])[0] || [])[0] || '').trim();
  } catch (e) {
    console.warn('[rows] could not verify ' + tab + ' row ' + rowNum + ' — writing anyway:', e && e.message);
    return true;
  }
  if (got === want) return true;
  console.warn('[rows] ' + tab + ' row ' + rowNum + ' now holds "' + got + '", expected "' + want +
               '" — refusing to write. The sheet was changed somewhere else.');
  return false;
}
if (typeof window !== 'undefined') window.rrRowStillIs = rrRowStillIs;

async function sheetsUpdate(spreadsheetId, range, values) {
  // v0.9.985 (perf): any write = data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.826 (TODO-003): view-only offline mode — writes need a connection.
  if (window._offlineMode) {
    if (typeof showToast === 'function') showToast("You're offline — this change needs a connection", 3500, true);
    throw new Error('offline');
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
    return json;
  } catch (e) {
    throw _rrWriteFailed('update', { sheetId: spreadsheetId, range: range, values: values }, e);
  }
}

async function sheetsAppend(spreadsheetId, range, values) {
  // v0.9.985 (perf): any write = data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // v0.9.826 (TODO-003): view-only offline mode — writes need a connection.
  if (window._offlineMode) {
    if (typeof showToast === 'function') showToast("You're offline — this change needs a connection", 3500, true);
    throw new Error('offline');
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

async function sheetsDeleteRow(spreadsheetId, sheetName, rowNumber) {
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
  if (!sheet) return;
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
  } catch (e) {
    // Recorded so it can be SHOWN. Never replayed — see write-outbox.js.
    throw _rrWriteFailed('delete', { sheetId: spreadsheetId, sheetName: sheetName, rowNumber: rowNumber }, e);
  }
}

