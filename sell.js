// ═══════════════════════════════════════════════════════════════
// sell.js — Share/Sell redesign
//   Tier 1: image-card sharing (For Sale / Want / Collection) via the
//           phone's native share sheet (no link, no permissions).
//   Tier 2: a live, always-current For-Sale Google Sheet shared
//           per-customer (view only) + a customer address book.
//   Tier 3: a dated public PDF link for buyers without Google.
// Loaded AFTER share.js (reuses _buildPDF, _fetchPhotoAsDataUrl) and
// after drive.js/sheets.js (driveRequest, sheetsUpdate, etc.).
// ═══════════════════════════════════════════════════════════════

var _SELL_SHEET_NAME = 'The Rail Roster - For Sale (shareable)';
var _SELL_CUST_FILE  = 'RailRoster_Customers.json';

function _sellTok() {
  if (typeof accessToken !== 'undefined' && accessToken) return accessToken;
  return localStorage.getItem('lv_token');
}
async function _sellRawDelete(path) {
  var r = await fetch('https://www.googleapis.com/drive/v3' + path, {
    method: 'DELETE', headers: { Authorization: 'Bearer ' + _sellTok() }
  });
  return r.ok || r.status === 204;
}

// ═══ TIER 1 — IMAGE CARDS ════════════════════════════════════════
function _rrWrap(ctx, text, x, y, maxW, lh, maxLines) {
  var words = String(text || '').split(' '), line = '', lines = 0;
  for (var i = 0; i < words.length; i++) {
    var test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); line = words[i]; y += lh; lines++;
      if (lines >= maxLines - 1) {
        var rest = words.slice(i).join(' ');
        while (ctx.measureText(rest + '…').width > maxW && rest.length) rest = rest.slice(0, -1);
        ctx.fillText(rest + (words.slice(i).join(' ').length > rest.length ? '…' : ''), x, y);
        return y;
      }
    } else line = test;
  }
  ctx.fillText(line, x, y); return y;
}
function _rrRound(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function _rrLoadImg(src) {
  return new Promise(function (res) {
    if (!src) { res(null); return; }
    var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src;
  });
}
function _rrCardData(it, source) {
  var master = it.master || {};
  var pd = it.pd || {}, fs = it.fs || {}, want = it.want || {};
  var chips = [];
  var price = '';
  if (source === 'forsale') {
    if (fs.askingPrice) price = 'asking $' + parseFloat(fs.askingPrice).toLocaleString();
    if (fs.condition || pd.condition) chips.push('Condition ' + (fs.condition || pd.condition) + '/10');
    if (pd.hasBox === 'Yes') chips.push('Has box');
    if (pd.allOriginal === 'Yes') chips.push('All original');
  } else if (source === 'want') {
    if (want.maxPrice) price = 'up to $' + parseFloat(want.maxPrice).toLocaleString();
    if (want.priority) chips.push(want.priority + ' priority');
    if (want.targetCond) chips.push('Want ' + want.targetCond + '/10+');
  } else {
    if (pd.userEstWorth) price = 'Est. $' + parseFloat(pd.userEstWorth).toLocaleString();
    if (pd.condition) chips.push('Condition ' + pd.condition + '/10');
    if (pd.hasBox === 'Yes') chips.push('Has box');
    if (pd.allOriginal === 'Yes') chips.push('All original');
  }
  return {
    num: it.itemNum || '',
    name: (master.roadName ? master.roadName + ' · ' : '') + (master.itemType || ''),
    price: price, chips: chips,
    note: fs.notes || pd.notes || want.notes || '',
    sub: master.subType || master.itemType || 'Lionel Postwar'
  };
}
function _rrCard(d, photoImg, source, photoIdx, photoTotal) {
  var W = 720, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d');
  var accent = source === 'want' ? '#2980b9' : (source === 'collection' ? '#2ecc71' : '#e8401c');
  var badge  = source === 'want' ? 'WANTED'  : (source === 'collection' ? 'MY COLLECTION' : 'FOR SALE');
  x.fillStyle = '#141a2e'; _rrRound(x, 0, 0, W, H, 28); x.fill();
  x.fillStyle = '#e7d4a8'; x.font = '600 22px Arial'; x.textBaseline = 'alphabetic'; x.fillText('THE RAIL ROSTER', 36, 52);
  x.font = '700 20px Arial'; var bw = x.measureText(badge).width + 40; x.fillStyle = accent;
  _rrRound(x, W - 36 - bw, 30, bw, 38, 19); x.fill(); x.fillStyle = '#fff'; x.fillText(badge, W - 36 - bw + 20, 56);
  var py = 84, ph = 420; x.fillStyle = '#1e2740'; _rrRound(x, 36, py, W - 72, ph, 16); x.fill();
  if (photoImg) {
    x.save(); _rrRound(x, 36, py, W - 72, ph, 16); x.clip();
    var iw = photoImg.width, ih = photoImg.height, s = Math.max((W - 72) / iw, ph / ih), dw = iw * s, dh = ih * s;
    x.drawImage(photoImg, 36 + ((W - 72) - dw) / 2, py + (ph - dh) / 2, dw, dh); x.restore();
  } else { x.fillStyle = '#46537a'; x.font = '400 20px Arial'; x.textAlign = 'center'; x.fillText('photo', W / 2, py + ph / 2); x.textAlign = 'left'; }
  if (photoTotal && photoTotal > 1) {
    var _lbl = (photoIdx || 1) + ' of ' + photoTotal;
    x.font = '700 18px Arial'; var _lw = x.measureText(_lbl).width + 24;
    x.fillStyle = 'rgba(0,0,0,0.55)'; _rrRound(x, 50, py + 14, _lw, 30, 15); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(_lbl, 62, py + 35);
  }
  var by = py + ph + 58;
  x.fillStyle = '#fff'; x.font = '700 46px Arial'; x.fillText('No. ' + (d.num || ''), 36, by);
  if (d.price) { x.fillStyle = accent; x.font = '700 38px Arial'; x.textAlign = 'right'; x.fillText(d.price, W - 36, by); x.textAlign = 'left'; }
  x.fillStyle = '#c8b88a'; x.font = '400 24px Arial'; _rrWrap(x, d.name || '', 36, by + 38, W - 72, 30, 2);
  var cy = by + 96, cx = 36;
  (d.chips || []).forEach(function (ch) {
    x.font = '400 19px Arial'; var cw = x.measureText(ch).width + 28;
    x.fillStyle = 'rgba(58,158,104,0.22)'; _rrRound(x, cx, cy - 22, cw, 32, 8); x.fill();
    x.fillStyle = '#bcd9c9'; x.fillText(ch, cx + 14, cy); cx += cw + 10;
  });
  if (d.note) { x.fillStyle = '#9aa3bd'; x.font = 'italic 20px Arial'; _rrWrap(x, '"' + d.note + '"', 36, cy + 52, W - 72, 26, 2); }
  x.strokeStyle = 'rgba(255,255,255,0.1)'; x.beginPath(); x.moveTo(36, H - 56); x.lineTo(W - 36, H - 56); x.stroke();
  x.fillStyle = '#6b769a'; x.font = '400 17px Arial'; x.fillText(d.sub || 'Lionel Postwar', 36, H - 30);
  x.textAlign = 'right'; x.fillText('Shared from The Rail Roster', W - 36, H - 30); x.textAlign = 'left';
  return c;
}
function _rrPhotoCard(num, photoImg, source, idx, total) {
  var W = 720, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d');
  var accent = source === 'want' ? '#2980b9' : (source === 'collection' ? '#2ecc71' : '#e8401c');
  var badge = source === 'want' ? 'WANTED' : (source === 'collection' ? 'MY COLLECTION' : 'FOR SALE');
  x.fillStyle = '#141a2e'; _rrRound(x, 0, 0, W, H, 28); x.fill();
  x.fillStyle = '#e7d4a8'; x.font = '600 22px Arial'; x.textBaseline = 'alphabetic'; x.fillText('THE RAIL ROSTER', 36, 52);
  x.font = '700 20px Arial'; var bw = x.measureText(badge).width + 40; x.fillStyle = accent;
  _rrRound(x, W - 36 - bw, 30, bw, 38, 19); x.fill(); x.fillStyle = '#fff'; x.fillText(badge, W - 36 - bw + 20, 56);
  var py = 84, ph = 680; x.fillStyle = '#1e2740'; _rrRound(x, 36, py, W - 72, ph, 16); x.fill();
  if (photoImg) {
    x.save(); _rrRound(x, 36, py, W - 72, ph, 16); x.clip();
    var iw = photoImg.width, ih = photoImg.height, s = Math.max((W - 72) / iw, ph / ih), dw = iw * s, dh = ih * s;
    x.drawImage(photoImg, 36 + ((W - 72) - dw) / 2, py + (ph - dh) / 2, dw, dh); x.restore();
  } else { x.fillStyle = '#46537a'; x.font = '400 20px Arial'; x.textAlign = 'center'; x.fillText('photo', W / 2, py + ph / 2); x.textAlign = 'left'; }
  var by = py + ph + 58;
  x.fillStyle = '#fff'; x.font = '700 40px Arial'; x.textAlign = 'left'; x.fillText('No. ' + (num || ''), 36, by);
  x.fillStyle = accent; x.font = '700 28px Arial'; x.textAlign = 'right'; x.fillText('Photo ' + idx + ' of ' + total, W - 36, by); x.textAlign = 'left';
  x.strokeStyle = 'rgba(255,255,255,0.1)'; x.beginPath(); x.moveTo(36, H - 56); x.lineTo(W - 36, H - 56); x.stroke();
  x.fillStyle = '#6b769a'; x.font = '400 17px Arial'; x.fillText('Additional photo', 36, H - 30);
  x.textAlign = 'right'; x.fillText('Shared from The Rail Roster', W - 36, H - 30); x.textAlign = 'left';
  return c;
}
function _canvasToFile(canvas, name) {
  return new Promise(function (res) {
    canvas.toBlob(function (b) { res(new File([b], name, { type: 'image/png' })); }, 'image/png', 0.92);
  });
}
function _dataUrlToFile(dataUrl, name) {
  var arr = dataUrl.split(','), mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
  var bin = atob(arr[1]), n = bin.length, u8 = new Uint8Array(n);
  while (n--) u8[n] = bin.charCodeAt(n);
  return new File([u8], name, { type: mime });
}
async function _rrItemPhotoDataUrls(pd, all) {
  var out = [];
  try {
    if (pd && pd.photoItem && typeof driveGetFolderPhotos === 'function') {
      var ph = await driveGetFolderPhotos(pd.photoItem);
      if (ph && ph.length) {
        var list = all ? ph : ph.slice(0, 1);
        for (var i = 0; i < list.length; i++) {
          var du = await _fetchPhotoAsDataUrl(list[i].id);
          if (du) out.push(du);
        }
      }
    }
  } catch (e) {}
  return out;
}
async function shareAsCards() {
  var source = (typeof _shareSource !== 'undefined' && _shareSource) ? _shareSource : 'forsale';
  if (source === 'upgrade') source = 'want';
  var items = (typeof _shareItems !== 'undefined') ? Object.values(_shareItems) : [];
  if (!items.length) { showToast('Select at least one item', 2500, true); return; }
  var allPhotos = (function () { var r = document.querySelector('input[name="rr-photomode"]:checked'); return r ? r.value === 'all' : false; })();
  var msg = (document.getElementById('share-message') || {}).value || '';
  var prog = document.getElementById('share-progress'), acts = document.getElementById('share-builder-actions');
  if (prog) { prog.style.display = 'block'; prog.textContent = 'Building cards…'; }
  if (acts) acts.style.display = 'none';
  try {
    var files = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (prog) prog.textContent = 'Building card ' + (i + 1) + ' of ' + items.length + '…';
      try {
      var pd = it.pd || (it.fs && it.fs.inventoryId && state.personalData[it.fs.inventoryId]) || {};
      if (pd && pd.itemNum && String(pd.itemNum) !== String(it.itemNum)) {
        var _cm = findMaster(pd.itemNum, pd.variation, pd) || it.master;
        it = Object.assign({}, it, { itemNum: pd.itemNum, variation: pd.variation || '', master: _cm });
      }
      var photoUrls = await _rrItemPhotoDataUrls(pd, allPhotos);
      var N = photoUrls.length;
      var mainImg = N ? await _rrLoadImg(photoUrls[0]) : null;
      var card = _rrCard(_rrCardData(it, source), mainImg, source, 1, N);
      files.push(await _canvasToFile(card, 'item-' + (it.itemNum || (i + 1)) + '-1.png'));
      if (allPhotos) {
        for (var p = 1; p < N; p++) {
          var pimg = await _rrLoadImg(photoUrls[p]);
          var pcard = _rrPhotoCard(it.itemNum || '', pimg, source, p + 1, N);
          files.push(await _canvasToFile(pcard, 'item-' + (it.itemNum || 'x') + '-' + (p + 1) + '.png'));
        }
      }
      } catch (itemErr) { console.warn('card build skipped for an item:', itemErr); }
    }
    var title = source === 'want' ? 'Items I am looking for' : (source === 'collection' ? 'From my collection' : 'Items for sale');
    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints || 0) > 1;
    var canFileShare = !!(navigator.canShare && navigator.canShare({ files: files }));
    if (isMobile && canFileShare) {
      // Cards are built. The share sheet must open from a FRESH tap (building the
      // cards used up the original tap's user-gesture), so show a button to tap.
      window._rrShareFiles = files; window._rrShareText = msg || title;
      if (prog) prog.style.display = 'none';
      if (acts) {
        acts.style.display = 'flex';
        acts.innerHTML = '<button onclick="_rrDoShareNow()" style="padding:0.75rem;border-radius:9px;border:none;background:#3a9e68;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Tap to share ' + files.length + ' image' + (files.length > 1 ? 's' : '') + '</button>';
      }
      return;
    }
    _rrDownloadFiles(files);
    showToast('Saved ' + files.length + ' image(s) — attach them to your email/text', 4000);
    if (prog) prog.textContent = 'Saved ' + files.length + ' image(s) to your downloads.';
    if (acts) acts.style.display = 'flex';
  } catch (err) {
    console.error('shareAsCards error:', err);
    if (err && err.name === 'AbortError') { if (acts) acts.style.display = 'flex'; if (prog) prog.style.display = 'none'; return; }
    if (prog) prog.textContent = 'Something went wrong — please try again.';
    if (acts) acts.style.display = 'flex';
  }
}

function _rrDownloadFiles(files) {
  for (var f = 0; f < files.length; f++) {
    var url = URL.createObjectURL(files[f]); var a = document.createElement('a');
    a.href = url; a.download = files[f].name; a.click(); (function (u) { setTimeout(function () { URL.revokeObjectURL(u); }, 4000); })(url);
  }
}
function _rrDoShareNow() {
  var files = window._rrShareFiles || [];
  if (!files.length) return;
  try {
    navigator.share({ files: files, text: window._rrShareText || '' }).then(function () {
      showToast('Shared!', 2000);
      var m = document.getElementById('share-builder-modal'); if (m) m.remove();
      if (typeof cancelShareMode === 'function') cancelShareMode();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      _rrDownloadFiles(files); showToast('Saved images to attach', 3000);
    });
  } catch (e) { _rrDownloadFiles(files); }
}
if (typeof window !== 'undefined') { window._rrDoShareNow = _rrDoShareNow; window._rrDownloadFiles = _rrDownloadFiles; }

// ═══ TIER 2 — LIVE FOR-SALE SHEET ════════════════════════════════
async function _sellEnsureSheet() {
  var cached = localStorage.getItem('rr_sell_sheet_id');
  if (cached) {
    try { var ok = await driveRequest('GET', '/files/' + cached + '?fields=id,trashed'); if (ok && ok.id && !ok.trashed) return cached; } catch (e) {}
  }
  var q = encodeURIComponent("name='" + _SELL_SHEET_NAME + "' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  var found = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&spaces=drive');
  if (found && found.files && found.files.length) { localStorage.setItem('rr_sell_sheet_id', found.files[0].id); return found.files[0].id; }
  var f = await driveRequest('POST', '/files', { name: _SELL_SHEET_NAME, mimeType: 'application/vnd.google-apps.spreadsheet' });
  localStorage.setItem('rr_sell_sheet_id', f.id);
  return f.id;
}
async function _sellSync() {
  var id = await _sellEnsureSheet();
  var fs = Object.values(state.forSaleData || {});
  var rows = [['THE RAIL ROSTER — For Sale', '', '', '', ''],
              ['Updated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), '', '', '', ''],
              ['', '', '', '', ''],
              ['Item #', 'Description', 'Condition', 'Box', 'Asking Price']];
  fs.forEach(function (e) {
    var pd = (e.inventoryId && state.personalData[e.inventoryId]) || {};
    var num = pd.itemNum || e.itemNum || '';
    var vr = pd.itemNum ? (pd.variation || '') : (e.variation || '');
    var m = findMaster(num, vr) || {};
    rows.push([
      num,
      (m.roadName ? m.roadName + ' ' : '') + (m.itemType || '') + (vr ? ' (var ' + vr + ')' : ''),
      (e.condition || pd.condition) ? (e.condition || pd.condition) + '/10' : '',
      pd.hasBox === 'Yes' ? 'Yes' : '',
      e.askingPrice ? '$' + parseFloat(e.askingPrice).toLocaleString() : ''
    ]);
  });
  try { await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values/Sheet1!A1:E1000:clear', { method: 'POST', headers: { Authorization: 'Bearer ' + _sellTok() } }); } catch (e) {}
  await sheetsUpdate(id, 'Sheet1!A1', rows);
  return id;
}
function _sellSheetLink(id) { return 'https://docs.google.com/spreadsheets/d/' + id + '/edit?usp=sharing'; }

// ═══ TIER 2 — CUSTOMER BOOK (private Drive JSON) ═════════════════
async function _sellReadCustomers() {
  try {
    var q = encodeURIComponent("name='" + _SELL_CUST_FILE + "' and trashed=false");
    var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&spaces=drive');
    if (!res.files || !res.files.length) return [];
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + res.files[0].id + '?alt=media', { headers: { Authorization: 'Bearer ' + _sellTok() } });
    var j = await r.json(); return Array.isArray(j) ? j : (j.customers || []);
  } catch (e) { return []; }
}
async function _sellWriteCustomers(arr) {
  var blob = new Blob([JSON.stringify(arr)], { type: 'application/json' });
  var q = encodeURIComponent("name='" + _SELL_CUST_FILE + "' and trashed=false");
  var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&spaces=drive');
  if (res.files && res.files.length) {
    await fetch('https://www.googleapis.com/upload/drive/v3/files/' + res.files[0].id + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + _sellTok(), 'Content-Type': 'application/json' }, body: blob });
  } else {
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: _SELL_CUST_FILE, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', blob);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: 'Bearer ' + _sellTok() }, body: form });
  }
}
async function _sellGrant(email) {
  var id = await _sellEnsureSheet();
  await driveRequest('POST', '/files/' + id + '/permissions?sendNotificationEmail=true&fields=id', { role: 'reader', type: 'user', emailAddress: email });
}
async function _sellRevoke(email) {
  var id = await _sellEnsureSheet();
  var perms = await driveRequest('GET', '/files/' + id + '/permissions?fields=permissions(id,emailAddress)');
  var hit = (perms.permissions || []).find(function (p) { return (p.emailAddress || '').toLowerCase() === email.toLowerCase(); });
  if (hit) await _sellRawDelete('/files/' + id + '/permissions/' + hit.id);
}

// ═══ TIER 3 — DATED PUBLIC PDF LINK ══════════════════════════════
async function _sellDatedPdfLink() {
  var items = Object.values(state.forSaleData || {}).map(function (e) {
    var m = findMaster(e.itemNum, e.variation, e) || {};
    var pd = (e.inventoryId && state.personalData[e.inventoryId]) || {};
    return { itemNum: e.itemNum, variation: e.variation, master: m, pd: pd, fs: e };
  });
  var fields = { itemnum: true, vardesc: true, cond: true, box: true, price: true, notes: true, photo: false };
  var pdfBlob = await _buildPDF(items, fields, 'For Sale list — updated ' + new Date().toLocaleDateString());
  if (typeof _uploadShareToDrive === 'function') return await _uploadShareToDrive(pdfBlob);
  throw new Error('PDF upload unavailable');
}

if (typeof window !== 'undefined') {
  window.shareAsCards = shareAsCards;
  window._sellSync = _sellSync; window._sellEnsureSheet = _sellEnsureSheet; window._sellSheetLink = _sellSheetLink;
  window._sellReadCustomers = _sellReadCustomers; window._sellWriteCustomers = _sellWriteCustomers;
  window._sellGrant = _sellGrant; window._sellRevoke = _sellRevoke; window._sellDatedPdfLink = _sellDatedPdfLink;
}

// ═══ SALES SHARING + CUSTOMERS UI ════════════════════════════════
var _sellCustomers = [];
var _sellLiveLink = '';
function _sellEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
async function openSalesShareModal() {
  var ex = document.getElementById('sell-modal'); if (ex) ex.remove();
  var m = document.createElement('div'); m.id = 'sell-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:flex-start;justify-content:center;padding:1rem;overflow-y:auto';
  m.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.25rem 1.25rem 1.5rem;width:100%;max-width:480px;margin:auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
        '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--text)">Share my For Sale list</div>' +
        '<button onclick="document.getElementById(\'sell-modal\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>' +
      '</div>' +
      // Live link section
      '<div style="border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.9rem">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:0.35rem">Live link (always current, view-only)</div>' +
        '<div style="font-size:0.76rem;color:var(--text-dim);margin-bottom:0.6rem">Add a customer below (they need a Google account) and they’ll get a link that always shows your latest list. Remove them anytime.</div>' +
        '<div id="sell-link-row" style="display:flex;gap:0.4rem">' +
          '<button onclick="_sellMakeLink()" id="sell-link-btn" style="flex:1;padding:0.5rem;border-radius:8px;border:1.5px solid #0891b2;background:rgba(8,145,178,0.1);color:#0891b2;font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Create / refresh live list</button>' +
        '</div>' +
      '</div>' +
      // Customers section
      '<div style="border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.9rem">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:0.5rem">Customers</div>' +
        '<div id="sell-cust-list" style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.6rem"><div style="font-size:0.8rem;color:var(--text-dim)">Loading…</div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem">' +
          '<input id="sell-c-name" placeholder="Name" style="padding:0.45rem 0.6rem;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' +
          '<input id="sell-c-email" placeholder="Email" style="padding:0.45rem 0.6rem;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' +
          '<input id="sell-c-phone" placeholder="Phone (optional)" style="padding:0.45rem 0.6rem;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' +
          '<button onclick="_sellAddCustomer()" style="padding:0.45rem;border-radius:7px;border:1.5px solid var(--accent);background:rgba(232,64,28,0.1);color:var(--accent);font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">+ Add customer</button>' +
        '</div>' +
      '</div>' +
      // PDF fallback
      '<div style="border:1px solid var(--border);border-radius:10px;padding:0.85rem">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:0.35rem">No Google account? Send a dated PDF</div>' +
        '<div style="font-size:0.76rem;color:var(--text-dim);margin-bottom:0.6rem">A snapshot link anyone can open — resend a fresh one to update.</div>' +
        '<button onclick="_sellMakePdf()" id="sell-pdf-btn" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Create dated PDF link</button>' +
      '</div>' +
      '<div id="sell-status" style="margin-top:0.8rem;font-size:0.8rem;color:var(--text-dim);text-align:center"></div>' +
    '</div>';
  document.body.appendChild(m);
  _sellCustomers = await _sellReadCustomers();
  _sellRenderCustomers();
}
function _sellRenderCustomers() {
  var el = document.getElementById('sell-cust-list'); if (!el) return;
  if (!_sellCustomers.length) { el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">No customers yet — add one below.</div>'; return; }
  el.innerHTML = _sellCustomers.map(function (c, i) {
    var on = !!c.access;
    return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;border:1px solid var(--border);border-radius:7px">' +
      '<div style="flex:1;min-width:0"><div style="font-size:0.84rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _sellEsc(c.name || c.email) + '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _sellEsc(c.email || '') + (c.phone ? ' · ' + _sellEsc(c.phone) : '') + '</div></div>' +
      '<button onclick="_sellToggleAccess(' + i + ')" style="padding:0.3rem 0.55rem;border-radius:6px;font-size:0.74rem;cursor:pointer;font-family:var(--font-body);font-weight:600;border:1.5px solid ' + (on ? '#3a9e68' : 'var(--border)') + ';background:' + (on ? 'rgba(58,158,104,0.14)' : 'var(--surface2)') + ';color:' + (on ? '#3a9e68' : 'var(--text-dim)') + '">' + (on ? '✓ Has access' : 'Grant access') + '</button>' +
      '<button onclick="_sellRemoveCustomer(' + i + ')" title="Remove" style="padding:0.3rem 0.45rem;border-radius:6px;font-size:0.74rem;cursor:pointer;font-family:var(--font-body);border:1px solid var(--border);background:var(--surface2);color:var(--text-dim)">✕</button>' +
    '</div>';
  }).join('');
}
function _sellStatus(t) { var el = document.getElementById('sell-status'); if (el) el.textContent = t || ''; }
async function _sellMakeLink() {
  var btn = document.getElementById('sell-link-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
  try {
    var id = await _sellSync(); _sellLiveLink = _sellSheetLink(id);
    var row = document.getElementById('sell-link-row');
    if (row) row.innerHTML = '<input readonly value="' + _sellEsc(_sellLiveLink) + '" style="flex:1;padding:0.5rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.78rem" onclick="this.select()">' +
      '<button onclick="navigator.clipboard.writeText(\'' + _sellLiveLink + '\');showToast(\'Link copied\')" style="padding:0.5rem 0.7rem;border-radius:8px;border:1.5px solid #0891b2;background:rgba(8,145,178,0.1);color:#0891b2;font-weight:600;font-size:0.82rem;cursor:pointer">Copy</button>';
    _sellStatus('Live list updated. Customers with access always see the latest.');
  } catch (e) { console.error(e); _sellStatus('Could not build the list — try again.'); if (btn) { btn.disabled = false; btn.textContent = 'Create / refresh live list'; } }
}
async function _sellAddCustomer() {
  var name = (document.getElementById('sell-c-name') || {}).value || '';
  var email = ((document.getElementById('sell-c-email') || {}).value || '').trim();
  var phone = (document.getElementById('sell-c-phone') || {}).value || '';
  if (!name && !email) { showToast('Add a name or email', 2500, true); return; }
  _sellCustomers.push({ name: name, email: email, phone: phone, access: false });
  await _sellWriteCustomers(_sellCustomers);
  document.getElementById('sell-c-name').value = ''; document.getElementById('sell-c-email').value = ''; document.getElementById('sell-c-phone').value = '';
  _sellRenderCustomers();
}
async function _sellToggleAccess(i) {
  var c = _sellCustomers[i]; if (!c) return;
  if (!c.email) { showToast('This customer needs an email to grant access', 3000, true); return; }
  _sellStatus(c.access ? 'Removing access…' : 'Granting access…');
  try {
    if (c.access) { await _sellRevoke(c.email); c.access = false; _sellStatus(_sellEsc(c.email) + ' removed.'); }
    else { await _sellSync(); await _sellGrant(c.email); c.access = true; _sellStatus(_sellEsc(c.email) + ' now has the live list (they’ll get an email).'); }
    await _sellWriteCustomers(_sellCustomers); _sellRenderCustomers();
  } catch (e) { console.error(e); _sellStatus('That didn’t work — check the email is a Google account.'); }
}
async function _sellRemoveCustomer(i) {
  var c = _sellCustomers[i]; if (!c) return;
  try { if (c.access && c.email) await _sellRevoke(c.email); } catch (e) {}
  _sellCustomers.splice(i, 1); await _sellWriteCustomers(_sellCustomers); _sellRenderCustomers();
}
async function _sellMakePdf() {
  var btn = document.getElementById('sell-pdf-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Building PDF…'; }
  try {
    var link = await _sellDatedPdfLink();
    if (btn) { btn.outerHTML = '<input readonly value="' + _sellEsc(link) + '" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.78rem" onclick="this.select()">'; }
    _sellStatus('Dated PDF link ready — copy it into a text or email.');
    try { await navigator.clipboard.writeText(link); showToast('PDF link copied'); } catch (e) {}
  } catch (e) { console.error(e); _sellStatus('Could not create the PDF — try again.'); if (btn) { btn.disabled = false; btn.textContent = 'Create dated PDF link'; } }
}
if (typeof window !== 'undefined') {
  window.openSalesShareModal = openSalesShareModal;
  window._sellMakeLink = _sellMakeLink; window._sellAddCustomer = _sellAddCustomer;
  window._sellToggleAccess = _sellToggleAccess; window._sellRemoveCustomer = _sellRemoveCustomer; window._sellMakePdf = _sellMakePdf;
}
