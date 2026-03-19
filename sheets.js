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
  const url = useApiKey
    ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}?key=${API_KEY}`
    : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}`;
  const headers = useApiKey
    ? {}
    : { Authorization: `Bearer ${accessToken}` };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Sheets read failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
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

  const res = await fetchFn();
  if (res.status === 401 || res.status === 403) {
    if (!tokenClient) throw new Error('Cannot refresh token — please reload');
    await new Promise((resolve, reject) => {
      const hint = state.user?.email || '';
      const prevCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = prevCallback;
        if (resp.error) { reject(new Error('Token refresh failed: ' + resp.error)); return; }
        accessToken = resp.access_token;
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      setTimeout(() => reject(new Error('Token refresh timed out')), 8000);
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

async function sheetsUpdate(spreadsheetId, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(range)}?valueInputOption=USER_ENTERED`;
  const body = JSON.stringify({ range, majorDimension: 'ROWS', values });
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
}

async function sheetsAppend(spreadsheetId, range, values) {
  // Extract raw tab name from range (e.g. "For Sale!A:A" -> "For Sale")
  const tabName = range.includes('!') ? range.split('!')[0] : range;

  // Helper: convert column number (1-based) to letter(s): 1=A, 26=Z, 27=AA
  function colLetter(n) {
    let s = '';
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
  }

  // Find the last used row in column A (data starts at row 3)
  const colARes = await sheetsGet(spreadsheetId, `${tabName}!A3:A`);
  const nextRow = 3 + ((colARes.values || []).length);

  // Write each row with PUT to an exact range
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const endCol = colLetter(Math.max(row.length, 1));
    const writeRange = `${tabName}!A${nextRow + i}:${endCol}${nextRow + i}`;
    const body = JSON.stringify({ range: writeRange, majorDimension: 'ROWS', values: [row] });
    const res = await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(writeRange)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body }
    ));
    const json = await res.json();
    if (json.error) {
      console.error('sheetsAppend (PUT) error:', JSON.stringify(json.error));
      throw new Error('Sheets write failed: ' + (json.error.message || JSON.stringify(json.error)));
    }
    console.log('[Sheets] Wrote row to', writeRange);
  }
}

async function sheetsDeleteRow(spreadsheetId, sheetName, rowNumber) {
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
}
