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
// v0.9.1967 (Brad: "lets send all the sale card info like via text in the email
// with the picture links"): a card's details as lines of words — the price and
// the chips on one line, the note on the next. Built from _rrCardData's answer,
// never from the item again, so the words say exactly what the card says.
function _rrItemWords(cd) {
  var out = [], bits = [];
  if (cd && cd.price) bits.push(cd.price.charAt(0).toUpperCase() + cd.price.slice(1));
  ((cd && cd.chips) || []).forEach(function (c) { if (c) bits.push(c); });
  if (bits.length) out.push(bits.join(' \u00b7 '));
  if (cd && cd.note) out.push('\u201c' + String(cd.note).replace(/\s+/g, ' ').trim() + '\u201d');
  return out;
}
// v0.9.878 (Brad): shrink text with an ellipsis so it can never draw
// over whatever sits to its right (title vs price collided on
// no-number items whose whole name lives in the title slot).
function _rrFitText(x, txt, maxW) {
  if (x.measureText(txt).width <= maxW) return txt;
  var t = String(txt);
  while (t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '…';
}
// v0.9.1963 (Brad: the person he sent cards to "can zoom in and out but not the
// actually item picture, just the card"): the WHOLE photo goes on the card,
// fitted inside its frame — it was cropped to fill it, so the caboose's ends and
// wheels were cut off. ONE fit for both cards.
function _rrPhotoFit(iw, ih, bw, bh) {
  if (!(iw > 0) || !(ih > 0)) return { w: bw, h: bh, dx: 0, dy: 0 };
  var s = Math.min(bw / iw, bh / ih), w = iw * s, h = ih * s;
  return { w: w, h: h, dx: (bw - w) / 2, dy: (bh - h) / 2 };
}
if (typeof window !== 'undefined') window._rrPhotoFit = _rrPhotoFit;
function _rrCard(d, photoImg, source, photoIdx, photoTotal) {
  var W = 720, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d');
  // v0.9.1135: 'var(--accent)' was silently ignored — canvas fillStyle does NOT
  // resolve CSS custom properties. The assignment was dropped and the previous
  // fill kept, so the FOR SALE badge drew cream-on-cream and the asking price
  // white-on-white: invisible, on the main selling card. Want and Collection
  // were fine because they pass real hex. Literal value of --accent, app.css:17.
  var accent = source === 'want' ? '#2980b9' : (source === 'collection' ? '#2ecc71' : '#f05008');
  var badge  = source === 'want' ? 'WANTED'  : (source === 'collection' ? 'MY COLLECTION' : 'FOR SALE');
  x.fillStyle = '#141a2e'; _rrRound(x, 0, 0, W, H, 28); x.fill();
  x.fillStyle = '#e7d4a8'; x.font = '600 22px Arial'; x.textBaseline = 'alphabetic'; x.fillText('THE RAIL ROSTER', 36, 52);
  x.font = '700 20px Arial'; var bw = x.measureText(badge).width + 40; x.fillStyle = accent;
  _rrRound(x, W - 36 - bw, 30, bw, 38, 19); x.fill(); x.fillStyle = '#fff'; x.fillText(badge, W - 36 - bw + 20, 56);
  var py = 84, ph = 420; x.fillStyle = '#1e2740'; _rrRound(x, 36, py, W - 72, ph, 16); x.fill();
  if (photoImg) {
    x.save(); _rrRound(x, 36, py, W - 72, ph, 16); x.clip();
    var _f = _rrPhotoFit(photoImg.width, photoImg.height, W - 72, ph);
    x.drawImage(photoImg, 36 + _f.dx, py + _f.dy, _f.w, _f.h); x.restore();
  } else { x.fillStyle = '#46537a'; x.font = '400 20px Arial'; x.textAlign = 'center'; x.fillText('photo', W / 2, py + ph / 2); x.textAlign = 'left'; }
  if (photoTotal && photoTotal > 1) {
    var _lbl = (photoIdx || 1) + ' of ' + photoTotal;
    x.font = '700 18px Arial'; var _lw = x.measureText(_lbl).width + 24;
    x.fillStyle = 'rgba(0,0,0,0.55)'; _rrRound(x, 50, py + 14, _lw, 30, 15); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(_lbl, 62, py + 35);
  }
  var by = py + ph + 58;
  var priceW = 0;
  if (d.price) { x.font = '700 38px Arial'; priceW = x.measureText(d.price).width + 24; }
  x.fillStyle = '#fff'; x.font = '700 46px Arial';
  x.fillText(_rrFitText(x, 'No. ' + (d.num || ''), (W - 72) - priceW), 36, by);
  if (d.price) { x.fillStyle = accent; x.font = '700 38px Arial'; x.textAlign = 'right'; x.fillText(d.price, W - 36, by); x.textAlign = 'left'; }
  x.fillStyle = '#c8b88a'; x.font = '400 24px Arial'; _rrWrap(x, d.name || '', 36, by + 38, W - 72, 30, 2);
  var cy = by + 96, cx = 36;
  (d.chips || []).forEach(function (ch) {
    x.font = '400 19px Arial'; var cw = x.measureText(ch).width + 28;
    x.fillStyle = 'rgba(46,204,113,0.22)'; _rrRound(x, cx, cy - 22, cw, 32, 8); x.fill();
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
  // v0.9.1135: 'var(--accent)' was silently ignored — canvas fillStyle does NOT
  // resolve CSS custom properties. The assignment was dropped and the previous
  // fill kept, so the FOR SALE badge drew cream-on-cream and the asking price
  // white-on-white: invisible, on the main selling card. Want and Collection
  // were fine because they pass real hex. Literal value of --accent, app.css:17.
  var accent = source === 'want' ? '#2980b9' : (source === 'collection' ? '#2ecc71' : '#f05008');
  var badge = source === 'want' ? 'WANTED' : (source === 'collection' ? 'MY COLLECTION' : 'FOR SALE');
  x.fillStyle = '#141a2e'; _rrRound(x, 0, 0, W, H, 28); x.fill();
  x.fillStyle = '#e7d4a8'; x.font = '600 22px Arial'; x.textBaseline = 'alphabetic'; x.fillText('THE RAIL ROSTER', 36, 52);
  x.font = '700 20px Arial'; var bw = x.measureText(badge).width + 40; x.fillStyle = accent;
  _rrRound(x, W - 36 - bw, 30, bw, 38, 19); x.fill(); x.fillStyle = '#fff'; x.fillText(badge, W - 36 - bw + 20, 56);
  var py = 84, ph = 680; x.fillStyle = '#1e2740'; _rrRound(x, 36, py, W - 72, ph, 16); x.fill();
  if (photoImg) {
    x.save(); _rrRound(x, 36, py, W - 72, ph, 16); x.clip();
    var _f = _rrPhotoFit(photoImg.width, photoImg.height, W - 72, ph);
    x.drawImage(photoImg, 36 + _f.dx, py + _f.dy, _f.w, _f.h); x.restore();
  } else { x.fillStyle = '#46537a'; x.font = '400 20px Arial'; x.textAlign = 'center'; x.fillText('photo', W / 2, py + ph / 2); x.textAlign = 'left'; }
  var by = py + ph + 58;
  var _pl = 'Photo ' + idx + ' of ' + total;
  x.font = '700 28px Arial'; var _plw = x.measureText(_pl).width + 24;
  x.fillStyle = '#fff'; x.font = '700 40px Arial'; x.textAlign = 'left';
  x.fillText(_rrFitText(x, 'No. ' + (num || ''), (W - 72) - _plw), 36, by);
  x.fillStyle = accent; x.font = '700 28px Arial'; x.textAlign = 'right'; x.fillText(_pl, W - 36, by); x.textAlign = 'left';
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
async function _rrItemPhotoDataUrls(pd, all, idsOut) {
  var out = [];
  try {
    if (pd && pd.photoItem && typeof driveGetFolderPhotos === 'function') {
      var ph = await driveGetFolderPhotos(pd.photoItem);
      if (ph && ph.length) {
        var list = all ? ph : ph.slice(0, 1);
        for (var i = 0; i < list.length; i++) {
          var du = await _fetchPhotoAsDataUrl(list[i].id);
          if (du) { out.push(du); if (idsOut) idsOut.push(list[i].id); }   // v0.9.1961: which photo each card shows
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
    // v0.9.1961: the full-size photo links (the one setting both routes read)
    // v0.9.1964: every item's photo ids are collected whatever the box says;
    // the links themselves are made by _rrShareLinksRefresh, which the box also
    // calls when it changes AFTER the cards are built (it used to be read once,
    // here, so ticking it afterwards did nothing — Brad: "it still is the same
    // as not clicking it").
    var _src = [];
    // v0.9.1974 ([stated] Brad "yes" — "share cards faster"): the photos are
    // fetched SEVERAL AT ONCE. Each card waited for its own full-size Drive
    // download before the next one started; now the downloads for the next
    // RR_SHARE_PHOTOS_AT_ONCE items (config.js) run together while the cards
    // are still drawn ONE BY ONE in list order. Only that many items' photos
    // are ever held at a time (a phone's memory), and a failed download is an
    // item with no photo, never a stopped share — exactly as before.
    // (Drive's small ready-made copies are NOT usable here: lh3 refuses a page
    // that draws them onto a canvas — measured 2026-08-28, see drive.js.)
    var _prep = items.map(function (it0) {
      try {
        var it = it0;
        // v0.9.1302: ONE resolver for "where does this share entry's collection
        // record live" — shared with the PDF builder (rrSharePdOf in share.js).
        var pd = rrSharePdOf(it);
        if (pd && pd.itemNum && String(pd.itemNum) !== String(it.itemNum)) {
          var _cm = findMaster(pd.itemNum, pd.variation, pd) || it.master;
          it = Object.assign({}, it, { itemNum: pd.itemNum, variation: pd.variation || '', master: _cm });
        }
        return { it: it, pd: pd };
      } catch (prepErr) { console.warn('card build skipped for an item:', prepErr); return null; }
    });
    var _photos = [], _started = [];
    var _startPhotos = function (j) {
      if (j >= _prep.length || _started[j] || !_prep[j]) return;
      _started[j] = true;
      var ids = [];
      _photos[j] = _rrItemPhotoDataUrls(_prep[j].pd, allPhotos, ids)
        .then(function (u) { return { urls: u || [], ids: ids }; }, function () { return { urls: [], ids: [] }; });
    };
    for (var i = 0; i < items.length; i++) {
      for (var j = i; j < i + RR_SHARE_PHOTOS_AT_ONCE; j++) _startPhotos(j);
      if (prog) prog.textContent = 'Building card ' + (i + 1) + ' of ' + items.length + '…';
      if (!_prep[i]) continue;
      try {
      var it = _prep[i].it, pd = _prep[i].pd;
      var _got = await _photos[i];
      _photos[i] = null;   // let this item's photos go once its cards are drawn
      var photoIds = _got.ids;
      var photoUrls = _got.urls;
      // v0.9.1967: EVERY item goes in the message, written out from the same
      // _rrCardData the card is drawn from (so the two can never disagree),
      // whether or not it has photos to link.
      var _cd = _rrCardData(it, source) || {};
      _src.push({ name: ('No. ' + (it.itemNum || '') + (_cd.name ? ' ' + _cd.name.replace(/ · /g, ' ') : '')).replace(/\s+/g, ' ').trim(),
        words: _rrItemWords(_cd), ids: photoIds.slice() });
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
    window._rrShareLinkSrc = _src; window._rrShareOpened = {}; window._rrShareBase = msg || title;
    if (prog) prog.textContent = 'Getting the photo links ready…';
    await _rrShareLinksRefresh();
    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints || 0) > 1;
    var canFileShare = !!(navigator.canShare && navigator.canShare({ files: files }));
    if (isMobile && canFileShare) {
      // Cards are built. The share sheet must open from a FRESH tap (building the
      // cards used up the original tap's user-gesture), so show a button to tap.
      window._rrShareFiles = files; window._rrShareText = _rrShareTextWithLinks(msg || title);
      _rrStitchAhead(files);   // v0.9.2047
      if (prog) prog.style.display = 'none';
      if (acts) {
        _rrActsStash(acts);
        acts.style.display = 'flex';
        acts.innerHTML = '<button onclick="_rrDoShareNow()" style="padding:0.75rem;border-radius:9px;border:none;background:#2ecc71;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Tap to share ' + files.length + ' image' + (files.length > 1 ? 's' : '') + '</button>' +
          _rrBackBtnHtml();
      }
      return;
    }
    // v0.9.878 (Brad): DESKTOP — offer email via the system share menu
    // (images arrive attached) with downloads as the backup. Mobile flow
    // above is untouched. Share must open from a fresh click (building
    // the cards used up the original click's user-gesture).
    // v0.9.1965 (Brad, on Windows' share menu: "This doesn't seem useful at all"
    // — it offers no Gmail — then "okay, just do the gmail draft"): on a
    // computer the main button is EMAIL WITH GMAIL — it copies the cards as one
    // picture and opens a Gmail draft, in the app's own Google account, with the
    // message and the full-size photo links already written in; one paste puts
    // the picture in. Windows' share menu stays as a small "Other apps…".
    if (!isMobile) {
      window._rrShareFiles = files; window._rrShareText = _rrShareTextWithLinks(msg || title); window._rrShareTitle = title;
      _rrStitchAhead(files);   // v0.9.2047
      if (prog) prog.style.display = 'none';
      if (acts) {
        _rrActsStash(acts);
        acts.style.display = 'flex';
        acts.innerHTML =
          // v0.9.1967 (Brad: "why do i have to paste the card?" → every item is
          // written out in the draft): ONE click opens the finished draft — no
          // copy step first, nothing to paste.
          '<a id="rr-gmail-open" href="' + _rrGmailDraftUrl().replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" onclick="_rrGmailClick()" style="padding:0.75rem;border-radius:9px;border:none;background:#2ecc71;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;text-decoration:none">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' +
            'Email with Gmail' +
          '</a>' +
          '<div id="rr-gmail-note" style="text-align:center;font-size:0.78rem;color:var(--text-mid);margin-top:-0.2rem">' + _rrGmailNoteWords() + '</div>' +
          // v0.9.1302 (Brad): "the share copy button doesn't copy it to the
          // clipboard so i can paste in my email." The Copy in the system
          // share window is Windows' own and hands over FILES, which email
          // bodies won't paste. This one is OURS: it stitches the cards into
          // one image and copies THAT, which pastes anywhere.
          '<button onclick="_rrCopyCardsToClipboard()" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
            'Copy for email — the card picture, if you want it in too' +
          '</button>' +
          // v0.9.1961: a pasted picture cannot carry links, so the links are a
          // second paste — straight under the picture.
          // v0.9.1964: always drawn, shown only while there are links (the box
          // can be ticked after the cards are built)
          '<button id="rr-copy-photo-links" onclick="_rrCopyShareLinks()" style="' + (window._rrShareLinks ? '' : 'display:none;') + 'padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
            'Copy the item details and photo links' +
          '</button>' +
          '<button onclick="_rrDownloadFiles(window._rrShareFiles||[]);showToast(\'Saved to your downloads\',3000)" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
            'Save to downloads instead' +
          '</button>' +
          (canFileShare
            ? '<button id="rr-other-apps" onclick="_rrDoShareNow()" style="background:none;border:none;padding:0.2rem;color:var(--text-dim);font-family:var(--font-body);font-size:0.78rem;text-decoration:underline;cursor:pointer">Other apps… (your computer’s share menu — Outlook and others)</button>'
            : '') +
          _rrBackBtnHtml();
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

// ══ v0.9.1964 — the links follow the box, before AND after the cards ══════
// Reads "Full-size photo links" NOW: ticked → each card photo is opened up
// (once — remembered in _rrShareOpened) and its link written; unticked → no
// links. Then the message and the "Copy the photo links" button follow. Called
// when the cards are built and whenever the box changes.
var _rrLinksBusy = null;
async function _rrShareLinksRefresh() {
  if (_rrLinksBusy) { try { await _rrLinksBusy; } catch (e) {} }
  _rrLinksBusy = (async function () {
    var src = window._rrShareLinkSrc;
    if (!src) return;   // no cards built yet — the build will call this
    var f = (typeof _getShareFields === 'function') ? _getShareFields() : {};
    var opened = window._rrShareOpened = window._rrShareOpened || {};
    // v0.9.1967: one block per item — its name, its details in words, then its
    // photo links (only while the box is ticked, and only photos that opened up)
    var blocks = [], anyLink = false;
    var doLinks = !!(f.linkPhotos && typeof rrShareOpenPhoto === 'function');
    var exp = (doLinks && f.linkLifeMs > 0) ? Date.now() + f.linkLifeMs : 0;
    for (var i = 0; i < src.length; i++) {
      var ok = [];
      if (doLinks) {
        for (var q = 0; q < src[i].ids.length; q++) {
          var id = src[i].ids[q];
          // a link is written only if opening the photo up succeeded
          if (opened[id] === undefined) opened[id] = !!(await rrShareOpenPhoto(id, exp));
          if (opened[id]) ok.push(id);
        }
      }
      var lines = [src[i].name].concat(src[i].words || []);
      if (ok.length) {
        anyLink = true;
        lines.push(ok.length > 1 ? 'Full-size photos:' : 'Full-size photo:');
        ok.forEach(function (pid) { lines.push('https://drive.google.com/file/d/' + pid + '/view'); });
      }
      blocks.push(lines.join('\n'));
    }
    var lifeW = (typeof rrShareLinkLifeWords === 'function') ? rrShareLinkLifeWords() : '';
    window._rrShareLinks = blocks.length
      ? (anyLink ? 'Tap a link to see the full-size photo' + (lifeW ? ' (' + lifeW + ')' : '') + '.\n\n' : '') + blocks.join('\n\n')
      : '';
    if (window._rrShareBase !== undefined) window._rrShareText = _rrShareTextWithLinks(window._rrShareBase);
    var btn = document.getElementById('rr-copy-photo-links');
    if (btn) btn.style.display = window._rrShareLinks ? '' : 'none';
    var gm = document.getElementById('rr-gmail-open');   // v0.9.1965: the draft follows the box too
    if (gm) gm.href = _rrGmailDraftUrl();
    var gn = document.getElementById('rr-gmail-note'); if (gn) gn.textContent = _rrGmailNoteWords();
  })();
  try { await _rrLinksBusy; } finally { _rrLinksBusy = null; }
}
// ══ v0.9.1965 — Email with Gmail ════════════════════════════════════════════
// The draft opens in the account the app is signed in with (authuser), with
// the subject, the message, every item in words and the full-size photo links
// in its body. v0.9.1967: it opens straight from the button — the picture copy
// that came first (and needed a second click) is now the optional "Copy for
// email" below it.
// A draft link carries its words in the web address, and Google refuses a very
// long one. A list too long for it is never cut short: the button copies the
// whole message and the draft opens saying where to paste it.
var RR_GMAIL_URL_MAX = 7500;
function _rrGmailDraftUrl() {
  var who = (window.state && state.user && state.user.email) || '';
  var head = 'https://mail.google.com/mail/?' + (who ? 'authuser=' + encodeURIComponent(who) + '&' : '')
    + 'view=cm&fs=1&su=' + encodeURIComponent(window._rrShareTitle || 'From The Rail Roster') + '&body=';
  var full = head + encodeURIComponent(window._rrShareText || '');
  window._rrGmailTooLong = full.length > RR_GMAIL_URL_MAX;
  if (!window._rrGmailTooLong) return full;
  return head + encodeURIComponent(String(window._rrShareBase || '') +
    '\n\nThis list is too long to write into the draft by itself \u2014 it was copied when you clicked Email with Gmail. Click here and press Ctrl+V to put every item and its photo links in.');
}
function _rrGmailClick() {
  if (window._rrGmailTooLong) {
    try { navigator.clipboard.writeText(window._rrShareText || ''); } catch (e) {}
  }
  // v0.9.1981 (Brad 2026-10-17: "when you come back to the app, you have to hit
  // cancel"): the draft is open in its own tab, so the window behind it turns
  // into "Your email is open in Gmail" with ONE Done button. It still never
  // closes by itself (v0.9.1302: you may come back for the card picture).
  setTimeout(_rrShareEmailedScreen, 400);
}
// The window after Email with Gmail: Done closes it and clears the picks;
// the card picture and the links can still be copied into the email.
function _rrShareEmailedScreen() {
  var acts = document.getElementById('share-builder-actions');
  if (!acts) return;
  var prog = document.getElementById('share-progress');
  if (prog) prog.style.display = 'none';
  acts.style.display = 'flex';
  acts.innerHTML =
    '<div id="rr-emailed" style="text-align:center;padding:0.3rem 0 0.2rem">' +
      '<div style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;color:var(--text)">Your email is open in Gmail</div>' +
      '<div style="font-size:0.85rem;color:var(--text-mid);margin-top:0.3rem">Send it from the Gmail tab, then press Done here.</div>' +
    '</div>' +
    '<button id="rr-share-done" onclick="_rrShareDone()" style="padding:0.8rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent, #fff);font-family:var(--font-body);font-weight:700;font-size:1rem;cursor:pointer">Done</button>' +
    '<button onclick="_rrCopyCardsToClipboard()" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
      'Copy the card picture, to paste into the email' +
    '</button>' +
    (window._rrShareLinks
      ? '<button onclick="_rrCopyShareLinks()" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Copy the item details and photo links</button>'
      : '');
  try { document.getElementById('rr-share-done').focus(); } catch (e) {}
}
function _rrShareDone() {
  var m = document.getElementById('share-builder-modal');
  if (m) m.remove();
  try { if (typeof cancelShareMode === 'function') cancelShareMode(); } catch (e) {}
  try { showToast('Done \u2014 your picks are cleared.', 2500); } catch (e) {}
}
if (typeof window !== 'undefined') { window._rrShareEmailedScreen = _rrShareEmailedScreen; window._rrShareDone = _rrShareDone; }
// the words under the Gmail button follow the list's length
function _rrGmailNoteWords() {
  return window._rrGmailTooLong
    ? 'This list is long, so the button copies every item and its photo links \u2014 press Ctrl+V in the draft.'
    : 'Opens a Gmail draft with every item and its photo links already written in.';
}
// v0.9.1961: the message that goes with the images, with the full-size links
function _rrShareTextWithLinks(base) {
  return window._rrShareLinks ? (String(base || '') + '\n\n' + window._rrShareLinks) : String(base || '');
}
function _rrCopyShareLinks() {
  var t = window._rrShareLinks || '';
  if (!t) return;
  try {
    navigator.clipboard.writeText(t).then(function () {
      showToast('Item details and photo links copied — paste them into your message', 3500);
    }, function () { showToast('Could not copy the links on this browser', 3500, true); });
  } catch (e) { showToast('Could not copy the links on this browser', 3500, true); }
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
      // v0.9.1302 (Brad): the builder used to close and wipe the picks the
      // moment the system window said "done" — and Windows says "done" even
      // when all you did was hit its Copy button. Stay open, picks intact;
      // ✕ or Cancel on the bar ends it.
      showToast('Shared! Your picks are kept in case you want them another way too.', 3500);
      var _p = document.getElementById('share-progress');
      if (_p) { _p.style.display = 'block'; _p.textContent = 'Shared — you can also copy for email, save, or go back for the PDF.'; }
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      _rrDownloadFiles(files); showToast('Saved images to attach', 3000);
    });
  } catch (e) { _rrDownloadFiles(files); }
}

// v0.9.1302: the card screens replace the builder's buttons, so stash the
// originals once and let Back restore them — that's how "Download as PDF
// instead" comes back without re-picking anything.
function _rrActsStash(acts) {
  if (!window._rrShareActsHome) window._rrShareActsHome = acts.innerHTML;
}
function _rrActsBack() {
  var acts = document.getElementById('share-builder-actions');
  var prog = document.getElementById('share-progress');
  if (acts && window._rrShareActsHome) { acts.innerHTML = window._rrShareActsHome; acts.style.display = 'flex'; }
  if (prog) prog.style.display = 'none';
}
function _rrBackBtnHtml() {
  return '<button onclick="_rrActsBack()" style="padding:0.5rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">‹ Back to the share options</button>';
}

// v0.9.1302 (Brad): "the share copy button doesn't copy it to the clipboard
// so i can paste in my email." Stitch the built cards into ONE tall image
// and put THAT on the clipboard — a single picture pastes into any email
// body, where a clipboard full of files does not. The seams between cards
// are white because email bodies are; this is print-side, not themeable.
// v0.9.2047 (known-problems sweep): the stitching is its own step, started the
// moment the cards exist (_rrStitchAhead) — so the Copy tap finds the picture
// READY and hands it straight to the clipboard. Loading the images and drawing
// the canvas are waits, and iPhone Safari refuses a clipboard write that comes
// after a wait inside the tap: the button did nothing there. When the tap lands
// before the picture is done, the promise itself goes into the ClipboardItem —
// Safari's own form for exactly this; a browser without it falls to the download.
async function _rrStitchCards(files) {
  var imgs = [];
  for (var i = 0; i < files.length; i++) {
    var u = URL.createObjectURL(files[i]);
    var im = await _rrLoadImg(u);
    setTimeout(URL.revokeObjectURL.bind(URL, u), 4000);
    if (im) imgs.push(im);
  }
  if (!imgs.length) throw new Error('no images');
  var GAP = 16, W = 0, H = 0;
  for (var j = 0; j < imgs.length; j++) { W = Math.max(W, imgs[j].width); H += imgs[j].height; }
  H += GAP * (imgs.length - 1);
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  var y = 0;
  for (var k = 0; k < imgs.length; k++) { ctx.drawImage(imgs[k], 0, y); y += imgs[k].height + GAP; }
  var blob = await new Promise(function (res) { c.toBlob(res, 'image/png'); });
  if (!blob) throw new Error('canvas failed');
  return blob;
}
function _rrStitchAhead(files) {
  window._rrShareStitchBlob = null;
  window._rrShareStitch = null;
  if (!files || !files.length) return;
  var p = _rrStitchCards(files);
  window._rrShareStitch = p;
  p.then(function (b) { if (window._rrShareStitch === p) window._rrShareStitchBlob = b; }, function () {});
}
async function _rrCopyCardsToClipboard(opt) {
  var quiet = !!(opt && opt.quiet);   // v0.9.1965: Email with Gmail says its own words
  var files = window._rrShareFiles || [];
  if (!files.length) return false;
  try {
    if (!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) throw new Error('no clipboard api');
    // No wait before the write: the ready picture, else its promise (built ahead), else start it now
    var pic = window._rrShareStitchBlob || window._rrShareStitch || _rrStitchCards(files);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pic })]);
    if (!quiet) showToast('Copied! Click into your email and paste — all ' + files.length + ' card' + (files.length > 1 ? 's' : '') + ' arrive as one picture.', 4000);
    return true;
  } catch (e) {
    _rrDownloadFiles(files);
    if (!quiet) showToast('Couldn’t copy on this browser — saved the images to your downloads to attach instead', 4500, true);
    return false;
  }
}
if (typeof window !== 'undefined') { window._rrDoShareNow = _rrDoShareNow; window._rrDownloadFiles = _rrDownloadFiles; window._rrActsStash = _rrActsStash; window._rrActsBack = _rrActsBack; window._rrBackBtnHtml = _rrBackBtnHtml; window._rrCopyCardsToClipboard = _rrCopyCardsToClipboard; window._rrCopyShareLinks = _rrCopyShareLinks; window._rrShareTextWithLinks = _rrShareTextWithLinks; window._rrShareLinksRefresh = _rrShareLinksRefresh; window._rrGmailDraftUrl = _rrGmailDraftUrl; window._rrGmailClick = _rrGmailClick; window._rrItemWords = _rrItemWords; }

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
// ══ v0.9.1317 — the sales-list review (Brad: "that is garbage") ══════════
// What a buyer used to get: "Gondola (var 2)" — no maker, no era, no notes
// ("Cracked corner" stayed hidden; a SET sale read as one unit), collector
// jargon instead of the variation's own words, no photos, no contact line.
// The rebuilt sheet: title + the owner's contact line (typed once in the
// panel) + era column + descriptions built from road name, description and
// the variation's ACTUAL words + notes riding the condition + Box spelled
// Yes/No + optional photo links through the SAME open/track machinery as the
// share PDF (so Shared Photos can end them). The lookup carries the copy's
// own identity — era, maker, masterKey — never a bare number.
async function _sellSync() {
  var id = await _sellEnsureSheet();
  var fs = Object.values(state.forSaleData || {});
  var contact = '';
  try { contact = localStorage.getItem('rr_sell_contact') || ''; } catch (e) {}
  var wantLinks = false;
  try { wantLinks = localStorage.getItem('rr_sell_photo_links') === '1'; } catch (e) {}
  var W = 7;
  var pad = function (a) { while (a.length < W) a.push(''); return a; };
  var rows = [
    pad(['THE RAIL ROSTER — ITEMS FOR SALE']),
    pad([contact]),
    pad(['Updated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]),
    pad([]),
    pad(['Item #', 'Era', 'Description', 'Condition & Notes', 'Box', 'Asking Price', wantLinks ? 'Photo' : '']),
  ];
  for (var i = 0; i < fs.length; i++) {
    var e = fs[i];
    var pd = (e.inventoryId && state.personalData[e.inventoryId]) || {};
    var num = pd.itemNum || e.itemNum || '';
    var vr = pd.itemNum ? (pd.variation || '') : (e.variation || '');
    var m = findMaster(num, vr, { era: pd.era || '', manufacturer: pd.manufacturer || e.manufacturer || '', masterKey: pd.masterKey || '', masterRowId: pd.masterRowId || '' }) || {};   // v0.9.1880: + Row ID
    var eraLabel = (typeof ERAS !== 'undefined' && pd.era && ERAS[pd.era]) ? ERAS[pd.era].label
      : (pd.manufacturer || e.manufacturer || '');
    var descBits = [];
    if (m.roadName) descBits.push(m.roadName);
    if (m.description && m.description !== m.roadName) descBits.push(m.description);
    var vWords = String(m.varDesc || pd.variationDescription || '').replace(/\s+/g, ' ').trim();
    if (vWords) descBits.push(vWords.length > 120 ? vWords.slice(0, 117) + '…' : vWords);
    var desc = descBits.join(' — ') || (pd.description || m.itemType || num);
    var cond = (e.condition || pd.condition) ? (e.condition || pd.condition) + '/10' : '';
    var notes = String(e.notes || pd.notes || '').trim();
    if (notes) cond = cond ? cond + ' — ' + notes : notes;
    var link = '';
    if (wantLinks && pd.photoItem) {
      try {
        var ph = await driveGetFolderPhotos(pd.photoItem);
        // a link goes on the sheet ONLY if opening the photo up succeeded —
        // same no-dead-links contract as the share PDF (v0.9.1303).
        if (ph && ph.length && typeof rrShareOpenPhoto === 'function' && await rrShareOpenPhoto(ph[0].id, 0)) {
          link = 'https://drive.google.com/file/d/' + ph[0].id + '/view';
        }
      } catch (eL) {}
    }
    rows.push(pad([
      num,
      eraLabel,
      desc,
      cond,
      pd.hasBox === 'Yes' ? 'Yes' : 'No',
      e.askingPrice ? _currencySymbol() + parseFloat(e.askingPrice).toLocaleString() : '',
      link,
    ]));
  }
  // v0.9.1274 (audit 2026-08-02 round 2, finding R14): this was a raw fetch
  // inside a bare `catch (e) {}`. When it failed — and it never checked res.ok,
  // so a 403 did not even reach the catch — the update below wrote a shorter
  // list over a longer one and left the rest of the old list sitting there.
  // The customers this link is shared WITH would still be seeing items that
  // had been sold. sheetsClear records the failure and throws; both callers
  // already catch and say the list could not be built.
  await sheetsClear(id, 'Sheet1!A1:H1000');
  await sheetsUpdate(id, 'Sheet1!A1', rows);
  return id;
}

// v0.9.1317: the live list can no longer go stale by design — if the sheet
// exists (the feature has been used), every app start re-syncs it in the
// background. A cached id that has been trashed is left alone (no silent
// re-creation of a sheet the user deleted on purpose).
async function rrSellSheetStartupSync() {
  try {
    var cached = localStorage.getItem('rr_sell_sheet_id');
    if (!cached) return;
    var ok = await driveRequest('GET', '/files/' + cached + '?fields=id,trashed');
    if (!ok || !ok.id || ok.trashed) return;
    await _sellSync();
  } catch (e) { /* next start retries */ }
}
if (typeof window !== 'undefined') window.rrSellSheetStartupSync = rrSellSheetStartupSync;
function _sellSheetLink(id) { return 'https://docs.google.com/spreadsheets/d/' + id + '/edit?usp=sharing'; }

// ═══ TIER 2 — CUSTOMER BOOK (private Drive JSON) ═════════════════
// v0.9.1264 (audit 2026-08-02 round 2, finding R8): this used to answer BOTH
// "you have no customers yet" and "I could not read your customer list" with
// the same empty array, and the difference between those two matters more here
// than anywhere else in the app — because _sellWriteCustomers is a whole-file
// REPLACE. The sequence was:
//
//   read fails (403, offline, expired token) → [] → the panel says
//   "No customers yet — add one below" → the user adds one → the write
//   replaces the file with a one-entry list → every customer is gone.
//
// No confirmation, no undo, no message. The user's own action destroyed the
// data, which is the hardest kind of loss to notice and the hardest to explain.
//
// Two things were wrong. There was no `r.ok` check, so a Drive error envelope
// ({error:{code,message}}) parsed cleanly as JSON, was not an array, had no
// .customers, and became [] without ever throwing. And the outer catch turned
// every real failure into the same []. Both now produce a MARKED empty array,
// and _sellWriteCustomers refuses to write one.
//
// A genuinely absent file still returns a plain [] — that is a real answer, and
// the first customer must be writable.
function _sellCustReadFailed(why) {
  var out = [];
  out._failed = true;
  out._why = why || '';
  return out;
}
async function _sellReadCustomers() {
  try {
    var q = encodeURIComponent("name='" + _SELL_CUST_FILE + "' and trashed=false");
    var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&spaces=drive');
    if (!res.files || !res.files.length) return [];   // no file yet = genuinely no customers
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + res.files[0].id + '?alt=media', { headers: { Authorization: 'Bearer ' + _sellTok() } });
    if (!r.ok) return _sellCustReadFailed('HTTP ' + r.status);
    var j = await r.json();
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.customers)) return j.customers;
    return _sellCustReadFailed('the customer file did not contain a list');
  } catch (e) { return _sellCustReadFailed(e && e.message); }
}
async function _sellWriteCustomers(arr) {
  // v0.9.1264 (finding R8): the ONE place that can tell a real empty list from
  // a failed read is here, so this is where the refusal lives — not spread
  // across the three callers, all of which already handle a throw by putting
  // the user's entry back and saying so.
  if (arr && arr._failed) {
    throw new Error('Your customer list could not be read' + (arr._why ? ' (' + arr._why + ')' : '') + ' — nothing was saved, so nothing was lost');
  }
  var blob = new Blob([JSON.stringify(arr)], { type: 'application/json' });
  var q = encodeURIComponent("name='" + _SELL_CUST_FILE + "' and trashed=false");
  var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&spaces=drive');
  if (res.files && res.files.length) {
    // v0.9.1043: unchecked before — a Drive failure looked like a success.
    var _r1 = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + res.files[0].id + '?uploadType=media', { method: 'PATCH', headers: { Authorization: 'Bearer ' + _sellTok(), 'Content-Type': 'application/json' }, body: blob });
    if (!_r1.ok) throw new Error('Could not save the customer list (HTTP ' + _r1.status + ')');
  } else {
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: _SELL_CUST_FILE, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', blob);
    var _r2 = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: 'Bearer ' + _sellTok() }, body: form });
    if (!_r2.ok) throw new Error('Could not save the customer list (HTTP ' + _r2.status + ')');
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
  var pdfBlob = await _buildPDF(items, fields, 'For Sale list — updated ' + (typeof _formatDate === 'function' ? _formatDate(new Date()) : new Date().toLocaleDateString()));
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
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem 1.25rem 1.5rem;width:100%;max-width:480px;margin:auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
        '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--text)">Share my For Sale list</div>' +
        '<button onclick="document.getElementById(\'sell-modal\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>' +
      '</div>' +
      // Live link section
      '<div style="border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.9rem">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:0.35rem">Live link (always current, view-only)</div>' +
        '<div style="font-size:0.76rem;color:var(--text-dim);margin-bottom:0.6rem">Add a customer below (they need a Google account) and they’ll get a link that always shows your latest list. Remove them anytime.</div>' +
        // v0.9.1317 (Brad's sales-list review): the sheet finally says WHO is
        // selling — typed once here, saved, printed under the title. Never
        // pre-filled: his own no-seeded-data rule.
        '<input id="sell-contact-line" placeholder="Your contact line — name · phone · email (shown on the list)" value="' + _sellEsc((function () { try { return localStorage.getItem('rr_sell_contact') || ''; } catch (e) { return ''; } })()) + '" onchange="try{localStorage.setItem(\'rr_sell_contact\', this.value)}catch(e){}" style="width:100%;box-sizing:border-box;padding:0.5rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.8rem;margin-bottom:0.5rem">' +
        '<label style="display:flex;align-items:flex-start;gap:0.45rem;font-size:0.76rem;color:var(--text);margin-bottom:0.6rem;cursor:pointer;line-height:1.4">' +
          '<input type="checkbox" id="sell-photo-links"' + ((function () { try { return localStorage.getItem('rr_sell_photo_links') === '1'; } catch (e) { return false; } })() ? ' checked' : '') + ' onchange="try{localStorage.setItem(\'rr_sell_photo_links\', this.checked ? \'1\' : \'0\')}catch(e){}" style="accent-color:var(--accent);width:1rem;height:1rem;flex-shrink:0;margin-top:0.1rem">' +
          'Photo links on the list — each item’s photo becomes viewable by anyone with the link (end it anytime in Collection Tools › Shared Photos)' +
        '</label>' +
        '<div id="sell-link-row" style="display:flex;gap:0.4rem">' +
          '<button onclick="_sellMakeLink()" id="sell-link-btn" style="flex:1;padding:0.5rem;border-radius:8px;border:1.5px solid #0891b2;background:var(--bg-card);background:color-mix(in srgb, rgb(8,145,178) 10%, var(--bg-card));color:var(--t-teal);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Create / refresh live list</button>' +
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
          '<button onclick="_sellAddCustomer()" style="padding:0.45rem;border-radius:7px;border:1.5px solid var(--accent);background:var(--bg-card);background:color-mix(in srgb, rgb(232,64,28) 10%, var(--bg-card));color:var(--t-accent);font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">+ Add customer</button>' +
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
  if (window.BackStack && BackStack.wire) BackStack.wire(m); // v0.9.809 TODO-012: device Back closes this pop-up
  _sellCustomers = await _sellReadCustomers();
  _sellRenderCustomers();
}
function _sellRenderCustomers() {
  var el = document.getElementById('sell-cust-list'); if (!el) return;
  // v0.9.1264 (finding R8): "no customers yet" and "your list could not be
  // read" used to look identical here, and the first one invites the user to
  // start typing — which is exactly the action that would have overwritten the
  // list they still had. Say which it is.
  if (_sellCustomers && _sellCustomers._failed) {
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--warn)">Your customer list could not be loaded just now, so it is not shown. '
      + 'Nothing has been changed — close this and try again in a moment.</div>';
    return;
  }
  if (!_sellCustomers.length) { el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">No customers yet — add one below.</div>'; return; }
  el.innerHTML = _sellCustomers.map(function (c, i) {
    var on = !!c.access;
    return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;border:1px solid var(--border);border-radius:7px">' +
      '<div style="flex:1;min-width:0"><div style="font-size:0.84rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _sellEsc(c.name || c.email) + '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _sellEsc(c.email || '') + (c.phone ? ' · ' + _sellEsc(c.phone) : '') + '</div></div>' +
      '<button onclick="_sellToggleAccess(' + i + ')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;font-family:var(--font-body);font-weight:600;border:1.5px solid ' + (on ? '#2ecc71' : 'var(--border)') + ';background:' + (on ? 'rgba(46,204,113,0.14)' : 'var(--surface2)') + ';color:' + (on ? 'var(--t-green)' : 'var(--text-dim)') + '">' + (on ? '✓ Has access' : 'Grant access') + '</button>' +
      '<button onclick="_sellRemoveCustomer(' + i + ')" title="Remove" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;font-family:var(--font-body);border:1px solid var(--border);background:var(--surface2);color:var(--text-dim)">✕</button>' +
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
      '<button onclick="navigator.clipboard.writeText(\'' + _sellLiveLink + '\').then(function(){showToast(\'Link copied\')}).catch(function(){showToast(\'Could not copy it \u2014 tap the box and copy it by hand\',4000,true)})" style="padding:0.5rem 0.7rem;border-radius:8px;border:1.5px solid #0891b2;background:var(--bg-card);background:color-mix(in srgb, rgb(8,145,178) 10%, var(--bg-card));color:var(--t-teal);font-weight:600;font-size:0.82rem;cursor:pointer">Copy</button>';
    _sellStatus('Live list updated. Customers with access always see the latest.');
  } catch (e) { console.error(e); _sellStatus('Could not build the list — try again.'); if (btn) { btn.disabled = false; btn.textContent = 'Create / refresh live list'; } }
}
async function _sellAddCustomer() {
  var name = (document.getElementById('sell-c-name') || {}).value || '';
  var email = ((document.getElementById('sell-c-email') || {}).value || '').trim();
  var phone = (document.getElementById('sell-c-phone') || {}).value || '';
  if (!name && !email) { showToast('Add a name or email', 2500, true); return; }
  // v0.9.1043: this whole chain had no error handling. A failed Drive write
  // threw into nothing, the fields still cleared, and the customer the user had
  // just typed was gone with no message. Now the entry is only removed from the
  // form once it is safely written, and a failure says so and keeps the typing.
  var _entry = { name: name, email: email, phone: phone, access: false };
  _sellCustomers.push(_entry);
  try {
    await _sellWriteCustomers(_sellCustomers);
  } catch (e) {
    console.error('[sell] add customer', e);
    _sellCustomers.pop();
    showToast('Could not save that customer — your typing is still here, try again', 5000, true);
    _sellStatus('Could not save — check your connection and try again.');
    return;
  }
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
  // v0.9.1043: put the customer back if the write fails, rather than showing a
  // list that disagrees with what is stored.
  var _removed = _sellCustomers.splice(i, 1);
  try {
    await _sellWriteCustomers(_sellCustomers);
  } catch (e) {
    console.error('[sell] remove customer', e);
    _sellCustomers.splice(i, 0, _removed[0]);
    showToast('Could not remove that customer — try again', 4000, true);
  }
  _sellRenderCustomers();
}
async function _sellMakePdf() {
  var btn = document.getElementById('sell-pdf-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Building PDF…'; }
  try {
    var link = await _sellDatedPdfLink();
    // v0.9.2047 (known-problems sweep): the copy used to run right here, after
    // the PDF was built — a wait iPhone Safari will not write the clipboard
    // after (and the failure was swallowed). Now a Copy button sits beside the
    // link box and the copy runs inside ITS tap (rrSellPdfLinkCopy).
    window._sellPdfLink = link;
    if (btn) { btn.outerHTML = '<div style="display:flex;gap:0.4rem;align-items:stretch"><input readonly value="' + _sellEsc(link) + '" style="flex:1;min-width:0;padding:0.5rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:0.78rem" onclick="this.select()"><button type="button" onclick="rrSellPdfLinkCopy()" style="padding:0.5rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-weight:600;font-size:0.8rem;cursor:pointer;white-space:nowrap">Copy</button></div>'; }
    _sellStatus('Dated PDF link ready — tap Copy, then paste it into a text or email.');
  } catch (e) { console.error(e); _sellStatus('Could not create the PDF — try again.'); if (btn) { btn.disabled = false; btn.textContent = 'Create dated PDF link'; } }
}
function rrSellPdfLinkCopy() {
  var link = window._sellPdfLink || '';
  if (!link) return;
  try {
    navigator.clipboard.writeText(link).then(function () { showToast('PDF link copied'); },
      function () { showToast('Could not copy on this browser — select the link and copy it', 4000, true); });
  } catch (e) { showToast('Could not copy on this browser — select the link and copy it', 4000, true); }
}
if (typeof window !== 'undefined') {
  window.rrSellPdfLinkCopy = rrSellPdfLinkCopy;
  window.openSalesShareModal = openSalesShareModal;
  window._sellMakeLink = _sellMakeLink; window._sellAddCustomer = _sellAddCustomer;
  window._sellToggleAccess = _sellToggleAccess; window._sellRemoveCustomer = _sellRemoveCustomer; window._sellMakePdf = _sellMakePdf;
}
