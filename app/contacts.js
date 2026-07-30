// ═══════════════════════════════════════════════════════════════
// contacts.js — 📇 Contacts (dealer/collector rolodex) — v0.9.792
//
// Brad's brainstorm picks: own page, listed as "Contacts", entry ABOVE
// Preferences in the account menu. Business-card photo capture (Drive
// folder "The Rail Roster - Contacts") with OCR prefill (reuses the
// box-label Tesseract via window._ensureTesseract). Data = "Contacts"
// tab in the personal sheet, auto-created on first save:
//   A Contact ID | B Name | C Business | D Phone | E Email |
//   F Specialties | G Notes | H Card Photo Link | I Met At | J Date Added
// Contact ID reserved for Phase 2 item-linking ("bought from Dave").
// Integration points (all marked "contacts hook"): index.html page div +
// script tag, app-setup.js menu item, app.js showPage hook,
// barcode.js _ensureTesseract export.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var TAB = 'Contacts';
  // v0.9.764 (Brad): + Mailing Address, Website. Columns K/L appended (tab is
  // created on first save, so widening now costs nothing). "Store name" = the
  // Business column (label reads Store / Business). Phase 2 (Brad-confirmed):
  // item linking ("bought from Dave") via Contact ID + per-purchase WARRANTY
  // notes/expiry shown on the contact's page.
  // v0.9.767 (Brad): + Home Phone / Cell Phone / Title — appended at END (M/N/O) so
  // existing rows keep their columns. D 'Phone' = store/main number.
  // v0.9.780 (Brad): + Person Photo Link (P).
  var HEADERS = ['Contact ID', 'Name', 'Business', 'Phone', 'Email', 'Specialties', 'Notes', 'Card Photo Link', 'Met At', 'Date Added', 'Mailing Address', 'Website', 'Home Phone', 'Cell Phone', 'Title', 'Person Photo Link'];
  // v0.9.778 (Brad): Era gets its own chip row; Lionel joins the brands.
  var ERA_CHIPS = ['Prewar', 'Postwar', 'Modern', 'All Eras'];
  var SPECIALTY_CHIPS = ['Lionel', 'MTH', 'Atlas', 'Menards', 'Parts', 'Repairs', 'Paper', 'Sets'];

  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // v0.9.804 (TODO-012): device Back button closes contact modals (BackStack
  // rule). _ctWireBack after append on open; _ctClose EVERYWHERE a modal is
  // removed voluntarily (Cancel/X/save/delete) so the stack stays balanced.
  function _ctWireBack(id) {
    if (window.BackStack) BackStack.push(id, function () { var el = document.getElementById(id); if (el) el.remove(); });
  }
  window._ctClose = function (id) {
    var el = document.getElementById(id); if (el) el.remove();
    if (window.BackStack) BackStack.pop(id);
  };
  function _today() { try { return new Date().toLocaleDateString('en-CA'); } catch (e) { return ''; } }

  // ── v0.9.769 — pre-OCR pipeline: auto-crop to the card, grayscale,
  // invert dark cards (white-on-black reads badly), stretch contrast, downscale.
  // EVERY stage fail-safes back to the plain photo, so a weird picture can
  // never make the scan worse than before.
  function _cardOcrImage(file) {
    return new Promise(function (resolve) {
      try {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth, h = img.naturalHeight;
            var crop = null;
            try { crop = _findCardBox(img, w, h); } catch (e0) { crop = null; }
            var sx = crop ? crop.x : 0, sy = crop ? crop.y : 0;
            var sw = crop ? crop.w : w, sh = crop ? crop.h : h;
            var MAX = 1600, sc = Math.min(1, MAX / Math.max(sw, sh));
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(sw * sc));
            cv.height = Math.max(1, Math.round(sh * sc));
            var ctx = cv.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
            try {
              var id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
              var hist = new Array(256).fill(0), n = cv.width * cv.height;
              for (var i = 0; i < d.length; i += 4) {
                var g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
                d[i] = d[i + 1] = d[i + 2] = g; hist[g]++;
              }
              var mean = 0;
              for (var m = 0; m < 256; m++) mean += m * hist[m];
              mean /= n;
              var invert = mean < 110;
              var lo = 0, hi = 255, acc = 0;
              for (var a = 0; a < 256; a++) { acc += hist[a]; if (acc >= n * 0.02) { lo = a; break; } }
              acc = 0;
              for (var b2 = 255; b2 >= 0; b2--) { acc += hist[b2]; if (acc >= n * 0.02) { hi = b2; break; } }
              var range = Math.max(1, hi - lo);
              for (var p = 0; p < d.length; p += 4) {
                var v = (d[p] - lo) * 255 / range;
                if (v < 0) v = 0; if (v > 255) v = 255;
                if (invert) v = 255 - v;
                d[p] = d[p + 1] = d[p + 2] = v;
              }
              ctx.putImageData(id, 0, 0);
            } catch (e1) {}
            URL.revokeObjectURL(url);
            cv.toBlob(function (bl) { resolve(bl || file); }, 'image/jpeg', 0.92);
          } catch (e) { try { URL.revokeObjectURL(url); } catch (e2) {} resolve(file); }
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e2) {} resolve(file); };
        img.src = url;
      } catch (e) { resolve(file); }
    });
  }
  // Find the card in the photo WITHOUT any library: shrink to 160px, split
  // light/dark with Otsu's threshold, flood-fill outward from the center
  // (people center the card), take the blob's bounding box. Only crop when the
  // result actually looks like a card (sane size + card-ish aspect ratio).
  function _findCardBox(img, w, h) {
    var AW = 160, scale = AW / w, AH = Math.max(1, Math.round(h * scale));
    var cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, AW, AH);
    var d = ctx.getImageData(0, 0, AW, AH).data;
    var g = new Uint8Array(AW * AH), hist = new Array(256).fill(0);
    for (var i = 0; i < AW * AH; i++) {
      var v = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0;
      g[i] = v; hist[v]++;
    }
    var total = AW * AH, sumAll = 0;
    for (var t = 0; t < 256; t++) sumAll += t * hist[t];
    var sumB = 0, wB = 0, best = 0, thr = 127;
    for (var t2 = 0; t2 < 256; t2++) {
      wB += hist[t2]; if (!wB) continue;
      var wF = total - wB; if (!wF) break;
      sumB += t2 * hist[t2];
      var mB = sumB / wB, mF = (sumAll - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t2; }
    }
    var cx = AW >> 1, cy = AH >> 1;
    var cardHigh = g[cy * AW + cx] > thr;
    var seen = new Uint8Array(AW * AH), stack = [cy * AW + cx];
    var minX = cx, maxX = cx, minY = cy, maxY = cy;
    while (stack.length) {
      var idx = stack.pop();
      if (seen[idx]) continue;
      seen[idx] = 1;
      if ((g[idx] > thr) !== cardHigh) continue;
      var x = idx % AW, y = (idx / AW) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0) stack.push(idx - 1);
      if (x < AW - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - AW);
      if (y < AH - 1) stack.push(idx + AW);
    }
    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    var areaFrac = (bw * bh) / (AW * AH);
    var aspect = bw / bh;
    if (areaFrac < 0.12 || areaFrac > 0.92) return null;
    if (!((aspect > 1.15 && aspect < 2.4) || (aspect > 0.42 && aspect < 0.87))) return null;
    var padX = Math.round(bw * 0.04), padY = Math.round(bh * 0.04);
    var fx = Math.max(0, Math.round((minX - padX) / scale));
    var fy = Math.max(0, Math.round((minY - padY) / scale));
    var fw = Math.min(w - fx, Math.round((bw + 2 * padX) / scale));
    var fh = Math.min(h - fy, Math.round((bh + 2 * padY) / scale));
    if (fw < 50 || fh < 50) return null;
    return { x: fx, y: fy, w: fw, h: fh };
  }
  // Map raw OCR text to contact fields. Heuristics tuned for US dealer cards;
  // every guess lands in an EDITABLE, previously-empty field, so a wrong read
  // costs one tap to fix — bad data is never silently saved.
  var _FREEMAIL = ['gmail.com','yahoo.com','aol.com','hotmail.com','outlook.com','icloud.com','msn.com','comcast.net','verizon.net','att.net','sbcglobal.net'];
  // v0.9.770: 'store'/'sales' removed — they appear in TITLES ("Retail Store
  // Manager") and caused false business picks on real cards.
  var _BIZ_RE = /\b(llc|l\.l\.c|inc|incorporated|co\.|company|corp|corporation|enterprises|trains?|railroads?|hobby|hobbies|shop|collectibles?|models?|antiques?|supply|depot|junction|emporium|exchange|galleries|toys?)\b/i;
  // v0.9.771: also matches OCR-truncated forms ("Retail Store Man...") via the
  // retail store / store man stems.
  var _TITLE_RE = /\b(owner|president|proprietor|manager|managing|director|founder|partner|ceo|coo|cfo|vice president|vp|sales rep|sales representative|account (rep|manager|executive)|engineer|estimator|consultant|specialist|coordinator|supervisor|buyer|appraiser|dealer|collector|retail store|store man\w*)\b/i;
  var _BARE_SUFFIX_RE = /^\W*(llc|l\.l\.c\.?|inc\.?|co\.?|corp\.?|ltd\.?)\W*$/i;
  var _STREET_RE = /(\d+[\w-]*\s+[^,\n]{2,40}?\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|cir|circle|hwy|highway|pike|way|route|rte|rt|plaza|pl|place|trail|turnpike|south|north|east|west)\.?\b[^\n]*|p\.?\s*o\.?\s*box\s+\d+[^\n]*)/i;
  var _CSZ_RE = /(?:[A-Z][A-Za-z.'\-]*(?:\s+[A-Z][A-Za-z.'\-]*)*)[,.]?\s+[A-Z]{2}\.?\s+\d{5}(?:-\d{4})?\b/;
  // ── v0.9.772 — finish truncated title words ("Retail Store Man" → Manager).
  // OCR drops low-confidence letters at word ends; job titles are a tiny
  // vocabulary, so snap a truncated LAST word to the known list.
  var _TITLE_DICT = ['Manager', 'President', 'Proprietor', 'Director', 'Founder', 'Partner', 'Representative', 'Executive', 'Engineer', 'Estimator', 'Consultant', 'Specialist', 'Coordinator', 'Supervisor', 'Appraiser', 'Collector', 'Owner', 'Dealer', 'Buyer', 'Salesman'];
  function _completeTitle(title) {
    title = String(title || '').trim();
    if (!title) return title;
    // v0.9.774: scrub junk micro-tokens off both ENDS (": i", "rd", "9") —
    // an end token must have 2+ letters to survive; middle tokens (like the
    // "|" in "Owner | Manager") are left alone.
    var toks = title.split(' ').filter(Boolean);
    var letters = function (t) { return t.replace(/[^A-Za-z]/g, '').length; };
    while (toks.length && letters(toks[toks.length - 1]) < 2) toks.pop();
    while (toks.length && letters(toks[0]) < 2) toks.shift();
    title = toks.join(' ');
    if (!title) return title;
    var words = title.split(' ');
    var last = words[words.length - 1].replace(/[^A-Za-z]/g, '');
    if (last.length < 3) return title;
    var lastLow = last.toLowerCase();
    for (var i = 0; i < _TITLE_DICT.length; i++) {
      if (_TITLE_DICT[i].toLowerCase() === lastLow) return title; // already complete
    }
    for (var j = 0; j < _TITLE_DICT.length; j++) {
      if (_TITLE_DICT[j].toLowerCase().indexOf(lastLow) === 0) {
        words[words.length - 1] = _TITLE_DICT[j];
        return words.join(' ');
      }
    }
    return title;
  }
  // Merge two OCR reads of the same card: empty fields fill from the second
  // read; for title/business ONLY, the longer reading wins (truncation is the
  // common failure). Everything else trusts the first (grayscale) read.
  function _mergeCardReads(a, b) {
    var out = {}, keys = ['name', 'title', 'business', 'phone', 'cell', 'home', 'email', 'website', 'address'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], av = a[k] || '', bv = b[k] || '';
      if (!av) out[k] = bv;
      else if ((k === 'title' || k === 'business') && bv.length > av.length + 1) out[k] = bv;
      else out[k] = av;
    }
    return out;
  }
  // Second-chance image: contrast = COLOR DISTANCE from the card's background
  // instead of brightness. Orange text on silver is nearly invisible in
  // grayscale but far from the background in color space, so it pops here.
  function _cardOcrImageColor(file) {
    return new Promise(function (resolve) {
      try {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth, h = img.naturalHeight;
            var crop = null;
            try { crop = _findCardBox(img, w, h); } catch (e0) { crop = null; }
            var sx = crop ? crop.x : 0, sy = crop ? crop.y : 0;
            var sw = crop ? crop.w : w, sh = crop ? crop.h : h;
            var MAX = 1600, sc = Math.min(1, MAX / Math.max(sw, sh));
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(sw * sc));
            cv.height = Math.max(1, Math.round(sh * sc));
            var ctx = cv.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
            var id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
            // background = median color of a sparse pixel sample
            var rs = [], gs = [], bs = [];
            for (var i = 0; i < d.length; i += 64) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
            var med = function (arr) { arr.sort(function (x, y) { return x - y; }); return arr[arr.length >> 1]; };
            var br = med(rs), bg = med(gs), bb = med(bs);
            // distance map + 98th-percentile normalization
            var n = cv.width * cv.height, dist = new Float32Array(n), maxs = [];
            for (var p = 0, q = 0; p < d.length; p += 4, q++) {
              var dr = d[p] - br, dg = d[p + 1] - bg, db = d[p + 2] - bb;
              dist[q] = Math.sqrt(dr * dr + dg * dg + db * db);
            }
            for (var m2 = 0; m2 < n; m2 += 37) maxs.push(dist[m2]);
            maxs.sort(function (x, y) { return x - y; });
            var hiD = Math.max(30, maxs[Math.floor(maxs.length * 0.98)] || 255);
            for (var p2 = 0, q2 = 0; p2 < d.length; p2 += 4, q2++) {
              var v = 255 - Math.min(255, dist[q2] * 255 / hiD); // text (far from bg) → dark
              d[p2] = d[p2 + 1] = d[p2 + 2] = v;
            }
            ctx.putImageData(id, 0, 0);
            URL.revokeObjectURL(url);
            cv.toBlob(function (bl) { resolve(bl || file); }, 'image/jpeg', 0.92);
          } catch (e) { try { URL.revokeObjectURL(url); } catch (e2) {} resolve(file); }
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e2) {} resolve(file); };
        img.src = url;
      } catch (e) { resolve(file); }
    });
  }
  // Does this line contain a web/email token? Such lines are never the business name.
  function _hasDomainTok(l) {
    return /@/.test(l) || /\b(?:[a-z0-9-]+\.)+[a-z]{2,6}\b/i.test(l.replace(/\d{3}[\s.\-]\d{4}/g, ''));
  }
  // OCR digit repair for web hosts: capital O amid a lowercase host is a zero;
  // an l/I next to a digit is a one ("securitylOl.com" → "security101.com").
  function _fixHost(hst) {
    hst = String(hst || '');
    var fixed = hst.replace(/([a-z0-9\-.])O(?=[a-z0-9\-.])/g, '$10');
    var prev = '';
    while (prev !== fixed) { prev = fixed; fixed = fixed.replace(/([0-9])[lI]/g, '$11').replace(/[lI](?=[0-9])/g, '1'); }
    return fixed;
  }
  function _parseCardText(text) {
    var out = { name: '', title: '', business: '', phone: '', cell: '', home: '', email: '', website: '', address: '' };
    var raw = String(text || '');
    function tc(s2) {
      s2 = String(s2 || '').trim();
      if (s2 && s2 === s2.toUpperCase() && /[A-Z]/.test(s2)) {
        s2 = s2.toLowerCase().replace(/(^|[\s\-.])([a-z])/g, function (m0, p, c) { return p + c.toUpperCase(); });
      }
      return s2.replace(/\bLlc\b/g, 'LLC').replace(/\bMth\b/g, 'MTH').replace(/\bIpd\b/g, 'IPD');
    }
    out.email = (raw.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0];

    // ── Phones: every number, with its label. Labels can FOLLOW the number
    // ("615.455.9399 (store)") or PRECEDE it as a word or single letter
    // ("c 609.500.8393", "f 732.982.8516"). Fax numbers are dropped.
    var phones = { store: '', cell: '', home: '' }, extras = [];
    var phoneRe = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
    var pm;
    while ((pm = phoneRe.exec(raw)) !== null) {
      var num = pm[0].trim();
      var before = raw.slice(Math.max(0, pm.index - 12), pm.index).toLowerCase();
      var after = raw.slice(pm.index + pm[0].length, pm.index + pm[0].length + 14).toLowerCase();
      var kind = '';
      if (/(^|[^a-z])(f|fax)[\s.:|)\]]*$/.test(before) || /^\s*[([]?\s*fax/.test(after)) kind = 'fax';
      else if (/(^|[^a-z])(c|cell|mobile|m)[\s.:|)\]]*$/.test(before) || /^\s*[([]?\s*(cell|mobile)/.test(after)) kind = 'cell';
      else if (/(^|[^a-z])(h|home)[\s.:|)\]]*$/.test(before) || /^\s*[([]?\s*home/.test(after)) kind = 'home';
      else if (/(^|[^a-z])(store|office|work|shop|main)[\s.:|)\]]*$/.test(before) || /^\s*[([]?\s*(store|office|work|shop|main)/.test(after)) kind = 'store';
      if (kind === 'fax') continue;
      if (kind && !phones[kind]) phones[kind] = num; else extras.push(num);
    }
    if (!phones.store && extras.length) phones.store = extras.shift();
    if (!phones.cell && extras.length) phones.cell = extras.shift();
    out.phone = phones.store; out.cell = phones.cell; out.home = phones.home;

    var lines = raw.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l.length > 2; });

    // ── Website — a www./http token or bare domain; never the email, never free-mail hosts.
    outer:
    for (var i = 0; i < lines.length; i++) {
      var toks = lines[i].split(' ');
      for (var j = 0; j < toks.length; j++) {
        var t = toks[j].replace(/^[,;()<>"']+|[,;()<>"'.]+$/g, '');
        if (!t || /@/.test(t)) continue;
        var wm = t.match(/^(?:https?:\/\/)?(www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,6})(\/\S*)?$/i);
        if (!wm) continue;
        // v0.9.770: KEEP the printed case — a capital O inside a lowercase host
        // is the OCR-repair clue that it's really a zero (securitylOl → 101).
        var host = wm[2];
        if (_FREEMAIL.indexOf(host.toLowerCase()) >= 0) continue;
        out.website = host + (wm[3] || '');
        break outer;
      }
    }

    // ── Address — first street match (label prefixes like "New Jersey" are cut
    // off because we keep the line only FROM the street-number match onward),
    // plus the city/state/zip (same line or a later line).
    var streetIdx = -1, streetStr = '', cszIdx = -1;
    for (var k = 0; k < lines.length; k++) {
      if (/@/.test(lines[k])) continue;
      var sm2 = lines[k].match(_STREET_RE);
      if (sm2 && streetIdx < 0) { streetIdx = k; streetStr = sm2[0].replace(/[\s~_|\\/*=+-]+$/, '').trim(); }
    }
    for (var k2 = 0; k2 < lines.length; k2++) {
      if (k2 !== streetIdx && _CSZ_RE.test(lines[k2])) { cszIdx = k2; break; }
    }
    if (streetIdx >= 0 && _CSZ_RE.test(streetStr)) { out.address = streetStr; cszIdx = -1; }
    else {
      var parts = [];
      if (streetStr) parts.push(streetStr);
      if (cszIdx >= 0) parts.push((lines[cszIdx].match(_CSZ_RE) || [lines[cszIdx]])[0]);
      out.address = parts.join(', ');
    }

    // ── Title — first title-keyword line without digits ("Retail Store
    // Manager", "Owner | Manager"). "Dave Miller, Owner" also yields the name.
    var titleIdx = -1, _tlClean = '';
    for (var t2 = 0; t2 < lines.length; t2++) {
      var cand = lines[t2].replace(/^[^A-Za-z]+/, ''); // OCR junk like ". 9 " ahead of the title
      if (_TITLE_RE.test(cand) && !/\d|@/.test(cand) && cand.length > 2 && cand.length < 50) { titleIdx = t2; _tlClean = cand; break; }
    }
    if (titleIdx >= 0) {
      var tl = _tlClean;
      var nm = tl.match(/^([A-Za-z .'\-]{4,40}),\s+(.{3,45})$/);
      if (nm && !_TITLE_RE.test(nm[1])) { out.name = tc(nm[1].trim()); out.title = tc(nm[2].trim()); }
      else out.title = tc(tl);
    }

    var used = function (idx) { return idx === streetIdx || idx === cszIdx || idx === titleIdx; };

    // ── Business — company-word line (never a title line); a bare "LLC"/"Inc"
    // line joins with the line above it; else the line matching the website
    // or email domain root.
    var bizIdx = -1, bizText = '';
    for (var b = 0; b < lines.length; b++) {
      if (used(b) || _TITLE_RE.test(lines[b]) || _hasDomainTok(lines[b]) || /\d{3}[\s.\-]\d{4}/.test(lines[b])) continue;
      if (_BIZ_RE.test(lines[b])) { bizIdx = b; break; }
    }
    if (bizIdx >= 0) {
      bizText = lines[bizIdx];
      if (_BARE_SUFFIX_RE.test(bizText) && bizIdx > 0 && !used(bizIdx - 1) && !/@|\d/.test(lines[bizIdx - 1])) {
        bizText = lines[bizIdx - 1] + ' ' + bizText.replace(/^\W+|\W+$/g, '');
      }
    } else {
      var roots = [];
      if (out.website) roots.push(out.website.split('/')[0].split('.')[0]);
      if (out.email) { var eh = out.email.split('@')[1] || ''; if (_FREEMAIL.indexOf(eh.toLowerCase()) < 0) roots.push(eh.split('.')[0]); }
      rootLoop:
      for (var r2 = 0; r2 < roots.length; r2++) {
        var root = String(roots[r2] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (root.length <= 3) continue;
        for (var b2 = 0; b2 < lines.length; b2++) {
          if (used(b2) || _hasDomainTok(lines[b2]) || _TITLE_RE.test(lines[b2])) continue;
          if (lines[b2].toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(root) >= 0) { bizIdx = b2; bizText = lines[b2]; break rootLoop; }
        }
      }
    }
    if (bizText) out.business = tc(bizText.replace(/^[^A-Za-z]+/, '').replace(/\s+[^A-Za-z]+$/, ''));

    // ── Name — 1) work backwards from the email (bhale@ → "Brad Hale",
    // NGraham@ → "Nathan Graham"); 2) the line just above the title line;
    // 3) first plain 2-4-word line.
    // v0.9.770: real-card OCR spits junk lines ("\\ Ll", "BRAD HALE rd :") —
    // name words must be real words: 2+ letters (or an initial like "Q."),
    // no slashes/tildes/digits, at least 5 letters total on the line.
    var _nameWords = function (l) {
      if (/[\\/~_=+*#<>{}\[\]]|\d|@/.test(l)) return null;
      var w = l.split(' ').filter(Boolean), outW = [], alpha = 0;
      for (var wi = 0; wi < w.length; wi++) {
        var aw = w[wi].replace(/[^A-Za-z.'\-]/g, '');
        var letters = aw.replace(/[^A-Za-z]/g, '');
        if (letters.length >= 2 || /^[A-Z]\.?$/.test(aw)) { outW.push(aw); alpha += letters.length; }
        else if (letters.length === 0 && aw.length === 0) { continue; }
        else return null; // junk token in the middle = not a clean name line
      }
      return (outW.length >= 2 && outW.length <= 4 && alpha >= 5) ? outW : null;
    };
    var nameOk = function (l, idx) {
      if (used(idx) || idx === bizIdx) return false;
      if (l.length >= 40 || _BIZ_RE.test(l) || _TITLE_RE.test(l)) return false;
      return !!_nameWords(l);
    };
    if (!out.name && out.email) {
      // Try every ADJACENT word pair on every line against the email's local
      // part — "BRAD HALE rd :" still yields "Brad Hale" (bhale@ = b+hale),
      // because only the matching PAIR is kept, junk around it is dropped.
      var local = out.email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
      if (local.length >= 4) {
        pairLoop:
        for (var n0 = 0; n0 < lines.length; n0++) {
          if (used(n0) || /@/.test(lines[n0]) || lines[n0].length >= 40) continue;
          var w0 = lines[n0].split(' ').filter(Boolean);
          for (var pw = 0; pw + 1 < w0.length; pw++) {
            var fw = w0[pw].toLowerCase().replace(/[^a-z]/g, ''), lw = w0[pw + 1].toLowerCase().replace(/[^a-z]/g, '');
            if (fw.length < 2 || lw.length < 2) continue;
            if (local === fw + lw || local === fw.charAt(0) + lw || local === fw + lw.charAt(0) || (lw.length >= 4 && local.indexOf(lw) >= 0 && local.charAt(0) === fw.charAt(0))) {
              out.name = tc(w0[pw].replace(/[^A-Za-z.'\-]/g, '') + ' ' + w0[pw + 1].replace(/[^A-Za-z.'\-]/g, ''));
              break pairLoop;
            }
          }
        }
      }
    }
    if (!out.name && titleIdx > 0 && nameOk(lines[titleIdx - 1], titleIdx - 1)) out.name = tc(lines[titleIdx - 1]);
    if (!out.name) {
      for (var n3 = 0; n3 < lines.length; n3++) { if (nameOk(lines[n3], n3)) { out.name = tc(lines[n3]); break; } }
    }

    // ── v0.9.769 cross-checks: the card corrects itself. OCR loves swapping
    // 1↔l↔i, 0↔O, 5↔S, m↔rn — if the email domain nearly matches the website
    // printed elsewhere on the card, trust the website. ".corn" is ".com".
    function _confNorm(s3) {
      return String(s3 || '').toLowerCase().replace(/rn/g, 'm').replace(/[l1i|]/g, '1').replace(/[o0]/g, '0').replace(/[s5]/g, '5').replace(/[b8]/g, '8');
    }
    function _editDist(a2, b3) {
      if (a2 === b3) return 0;
      var la = a2.length, lb = b3.length;
      if (Math.abs(la - lb) > 3) return 99;
      var prev = [], cur = [];
      for (var j2 = 0; j2 <= lb; j2++) prev[j2] = j2;
      for (var i2 = 1; i2 <= la; i2++) {
        cur[0] = i2;
        for (var j3 = 1; j3 <= lb; j3++) {
          cur[j3] = Math.min(prev[j3] + 1, cur[j3 - 1] + 1, prev[j3 - 1] + (a2.charAt(i2 - 1) === b3.charAt(j3 - 1) ? 0 : 1));
        }
        prev = cur.slice();
      }
      return prev[lb];
    }
    if (out.website) {
      out.website = out.website.replace(/\.corn($|\/)/i, function (m0, g2) { return '.com' + g2; });
      var wparts = out.website.split('/');
      wparts[0] = _fixHost(wparts[0]);
      out.website = wparts.join('/');
    }
    if (out.email) {
      var ep = out.email.split('@');
      var dom = _fixHost((ep[1] || '').replace(/\.corn$/i, '.com').replace(/\.c0m$/i, '.com'));
      if (out.website) {
        var whost = out.website.split('/')[0];
        if (dom.toLowerCase() !== whost.toLowerCase()
            && dom.length >= 7 && whost.length >= 7
            && _editDist(_confNorm(dom), _confNorm(whost)) <= 2) {
          dom = whost;
        }
      }
      out.email = ep[0] + '@' + dom;
      // No website line on the card? The email's domain IS the website (unless free-mail).
      if (!out.website && _FREEMAIL.indexOf(dom.toLowerCase()) < 0 && /\./.test(dom)) out.website = dom;
    }
    return out;
  }

  // ── v0.9.775 — AI card reading (Tier-3 relay; on-device OCR = fallback) ──
  // Parse the relay's labeled reply into contact fields.
  function _parseAiCardText(text) {
    var out = { name: '', title: '', business: '', phone: '', cell: '', home: '', email: '', website: '', address: '' };
    var map = { 'name': 'name', 'title': 'title', 'business': 'business', 'store phone': 'phone', 'cell phone': 'cell', 'home phone': 'home', 'email': 'email', 'website': 'website', 'address': 'address' };
    String(text || '').split('\n').forEach(function (ln) {
      var m = ln.match(/^\s*([A-Za-z ]+):\s*(.*)$/);
      if (!m) return;
      var k = map[m[1].trim().toLowerCase()];
      if (!k || out[k]) return;
      var v = m[2].trim();
      if (!v || /^(unknown|none|n\/a|-|\(blank\)|blank)$/i.test(v)) return;
      out[k] = v;
    });
    if (out.website) {
      out.website = out.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      var wp = out.website.split('/'); wp[0] = _fixHost(wp[0]); out.website = wp.join('/');
    }
    if (out.email) { var ep = out.email.split('@'); if (ep[1]) out.email = ep[0] + '@' + _fixHost(ep[1]); }
    out.title = _completeTitle(out.title);
    return (out.name || out.email || out.phone || out.cell) ? out : null;
  }
  // Send the card to the vault relay (same consent, image prep, cap and cache
  // as AI photo-ID). Returns fields, {_quota:true}, or null (use OCR instead).
  async function _aiReadCard(file) {
    try {
      if (typeof aiConsentEnsure !== 'function' || typeof aiPrepImage !== 'function'
          || typeof vaultPost !== 'function' || typeof vaultGetToken !== 'function') return null;
      if (navigator && navigator.onLine === false) return null;
      if (!(await aiConsentEnsure())) return null;
      var img = await aiPrepImage(file);
      if (!img) return null;
      // v0.9.779: 2 tries / 1.5s backoff (was 3 / up to 7.5s) — the card scan
      // races the on-device reader now, so a busy relay just loses the race.
      var res = null;
      for (var t = 0; t < 2; t++) {
        if (t) await new Promise(function (r) { setTimeout(r, 1500); });
        res = await vaultPost({ action: 'ai_card', token: vaultGetToken(), image: img.b64, mime: img.mime });
        if (res && res.status === 503) continue;
        break;
      }
      if (res && res.status === 429) return { _quota: true };
      if (!res || res.status !== 200 || !res.text) return null;   // incl. old relay: unknown action
      return _parseAiCardText(String(res.text));
    } catch (e) { console.warn('[card AI]', e); return null; }
  }

  // v0.9.779: the on-device read as ONE callable — pass 1 (grayscale), and the
  // color pass only when fields are missing AND the AI hasn't already won the
  // race (aiOkFn). Returns parsed fields or null.
  async function _ocrReadCard(f, aiOkFn, onPass2) {
    if (typeof window._ensureTesseract !== 'function') return null;
    var T = await window._ensureTesseract();
    var small = await _cardOcrImage(f);
    var res = await T.recognize(small, 'eng', {});
    var got = _parseCardText((res && res.data && res.data.text) || '');
    var complete = got.name && got.title && got.business && got.email && (got.phone || got.cell) && got.address;
    if (!complete && !(aiOkFn && aiOkFn())) {
      try {
        if (onPass2) onPass2();
        var small2 = await _cardOcrImageColor(f);
        var res2 = await T.recognize(small2, 'eng', {});
        got = _mergeCardReads(got, _parseCardText((res2 && res2.data && res2.data.text) || ''));
      } catch (eC) { console.warn('[card OCR pass2]', eC); }
    }
    got.title = _completeTitle(got.title);
    return got;
  }

  // ── v0.9.783 — QR-first card reading. Many dealer cards carry a QR code
  // holding a vCard: decoding it is ~1 second and EXACT (no print-reading).
  function _parseQrContact(txt) {
    txt = String(txt || '').trim();
    if (!txt) return null;
    var out = { name: '', title: '', business: '', phone: '', cell: '', home: '', email: '', website: '', address: '' };
    var unesc = function (v) { return String(v || '').replace(/\\n/gi, ', ').replace(/\\,/g, ',').replace(/\\;/g, ';').trim(); };
    var webClean = function (v) { return unesc(v).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, ''); };
    if (/^BEGIN:VCARD/i.test(txt)) {
      var lines = txt.replace(/\r/g, '').replace(/\n[ \t]/g, '').split('\n');
      lines.forEach(function (ln) {
        var m = ln.match(/^([^:]+):(.*)$/); if (!m) return;
        var keyFull = m[1].toUpperCase(), val = m[2], key = keyFull.split(';')[0];
        if (key === 'FN' && !out.name) out.name = unesc(val);
        else if (key === 'N' && !out.name) { var np = val.split(';'); out.name = ((np[1] || '') + ' ' + (np[0] || '')).trim(); }
        else if (key === 'ORG' && !out.business) out.business = unesc(val.split(';')[0]);
        else if (key === 'TITLE' && !out.title) out.title = unesc(val);
        else if (key === 'TEL') {
          if (/FAX/i.test(keyFull)) return;
          var num = val.replace(/^[^0-9+(]*/, '').trim(); if (!num) return;
          if (/CELL|MOBILE/i.test(keyFull)) { if (!out.cell) out.cell = num; }
          else if (/HOME/i.test(keyFull) && !/WORK/i.test(keyFull)) { if (!out.home) out.home = num; }
          else if (!out.phone) out.phone = num;
        }
        else if (key === 'EMAIL' && !out.email) out.email = unesc(val);
        else if (key === 'URL' && !out.website) out.website = webClean(val);
        else if (key === 'ADR' && !out.address) {
          var ap = val.split(';').map(unesc);
          out.address = [ap[2], ap[3], ((ap[4] || '') + ' ' + (ap[5] || '')).trim()].filter(Boolean).join(', ');
        }
      });
    } else if (/^MECARD:/i.test(txt)) {
      txt.substring(7).split(';').forEach(function (p) {
        var m2 = p.match(/^([A-Z]+):(.*)$/i); if (!m2) return;
        var k2 = m2[1].toUpperCase(), v2 = m2[2].trim();
        if (k2 === 'N' && !out.name) out.name = v2.split(',').reverse().join(' ').replace(/\s+/g, ' ').trim();
        else if (k2 === 'TEL' && !out.phone) out.phone = v2;
        else if (k2 === 'EMAIL' && !out.email) out.email = v2;
        else if (k2 === 'URL' && !out.website) out.website = webClean(v2);
        else if (k2 === 'ADR' && !out.address) out.address = v2;
        else if (k2 === 'ORG' && !out.business) out.business = v2;
      });
    } else if (/^https?:\/\/\S+$/i.test(txt)) {
      out.website = webClean(txt);   // URL-only QR: at least the website is exact
    } else return null;
    return (out.name || out.email || out.phone || out.cell || out.website) ? out : null;
  }
  function _qrReadCard(file) {
    return new Promise(function (resolve) {
      if (typeof window._decodeQrText !== 'function') { resolve(null); return; }
      try {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = async function () {
          try {
            var MAX = 2000, w = img.naturalWidth, h = img.naturalHeight;
            var sc = Math.min(1, MAX / Math.max(w, h));
            var cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(w * sc)); cv.height = Math.max(1, Math.round(h * sc));
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(url);
            var txt = await window._decodeQrText(cv);
            resolve(txt ? _parseQrContact(txt) : null);
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e2) {} resolve(null); };
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }

  // ── sheet plumbing ─────────────────────────────────────────────
  var _tabEnsured = false;
  async function _ensureTab() {
    if (_tabEnsured) return true;
    try {
      // v0.9.770: BOTH raw fetches here now go through _withTokenRetry — an
      // expired OAuth token used to make addSheet fail SILENTLY, then the
      // header write threw and every contact save died with "Could not save".
      var _tr = (typeof _withTokenRetry === 'function') ? _withTokenRetry : function (fn) { return fn(); };
      var metaRes = await _tr(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties', { headers: { Authorization: 'Bearer ' + accessToken } }); });
      var meta = await metaRes.json();
      if (meta.error) throw new Error(meta.error.message || 'could not read spreadsheet');
      var has = (meta.sheets || []).some(function (s) { return s.properties.title === TAB; });
      if (!has) {
        var addRes = await _tr(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
          method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
        }); });
        var addJson = await addRes.json();
        if (addJson.error && String(addJson.error.message || '').indexOf('already exists') < 0) throw new Error(addJson.error.message || 'could not create Contacts tab');
        await sheetsUpdate(state.personalSheetId, TAB + '!A1:P1', [HEADERS]);
      } else {
        // v0.9.767: tab predates the M/N/O columns — write those headers (idempotent).
        try { await sheetsUpdate(state.personalSheetId, TAB + '!M1:P1', [['Home Phone', 'Cell Phone', 'Title', 'Person Photo Link']]); } catch (e2) {}
      }
      _tabEnsured = true;
      return true;
    } catch (e) { console.warn('[contacts tab]', e); return false; }
  }

  // v0.9.827: THE contact-row parser — used by _load below AND the offline
  // snapshot loader in app-data.js (single source of truth).
  // v0.9.771: _cs() String-coerce on EVERY cell — Sheets hands back NUMBERS
  // for numeric-looking cells (a phone like 888678.7101), and .replace on a
  // number crashed the whole list render right after a successful save.
  function _ctParseRows(values) {
    var out = [];
    var _cs = function (x) { return (x === null || x === undefined) ? '' : String(x); };
    (values || []).forEach(function (v, i) {
      if (!v || !(v[1] || v[0])) return;
      out.push({ row: i + 2, id: _cs(v[0]), name: _cs(v[1]), business: _cs(v[2]), phone: _cs(v[3]), email: _cs(v[4]), specialties: _cs(v[5]), notes: _cs(v[6]), cardLink: _cs(v[7]), metAt: _cs(v[8]), dateAdded: _cs(v[9]), address: _cs(v[10]), website: _cs(v[11]), homePhone: _cs(v[12]), cellPhone: _cs(v[13]), title: _cs(v[14]), personPhoto: _cs(v[15]) });
    });
    return out;
  }
  window._ctParseRows = _ctParseRows;

  async function _load() {
    // v0.9.827 (TODO-003): offline — the phone snapshot already has them.
    if (window._offlineMode) { return state.contactsData || []; }
    try {
      var r = await sheetsGet(state.personalSheetId, TAB + '!A2:P');
      state.contactsData = _ctParseRows(r && r.values);
      return state.contactsData;
    } catch (e) { state.contactsData = state.contactsData || []; return state.contactsData; }
  }

  window._ctLoadContacts = _load;   // v0.9.781: Contacts report (reports.js) loads the rolodex

  // v0.9.792 (Brad): contacts sort alphabetically by LAST name, everywhere.
  // Key = last word of the name, then the full name as tie-breaker.
  function _ctLastNameKey(n) {
    n = String(n || '').trim();
    if (!n) return 'zzzz';
    var w = n.split(/\s+/);
    return (w[w.length - 1] + ' ' + n).toLowerCase();
  }
  window._ctLastNameKey = _ctLastNameKey;

  // ── page ───────────────────────────────────────────────────────
  window.buildContactsPage = async function () {
    var page = document.getElementById('page-contacts');
    if (!page) return;
    page.innerHTML = '<style>@media (max-width:640px){.ct-cthumb{display:none!important}.ct-clink{display:inline!important}}</style>'
      + '<div class="page-title">Contacts</div>'
      + '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap">'
      + '<input id="ct-search" type="text" placeholder="Search name, business, specialty…" oninput="_ctRenderList()" style="flex:1;min-width:200px;padding:0.6rem 0.8rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem">'
      + '<button onclick="_ctOpenEdit(null)" style="padding:0.6rem 1.1rem;border-radius:9px;border:1.5px solid var(--accent);background:rgba(232,64,28,0.1);color:var(--accent);font-weight:700;cursor:pointer;font-family:var(--font-body)">+ Add Contact</button>'
      + '<button onclick="_ctShareOpen()" style="padding:0.6rem 1.1rem;border-radius:9px;border:1.5px solid #3498db;background:rgba(52,152,219,0.08);color:#3498db;font-weight:700;cursor:pointer;font-family:var(--font-body)">↗ Share</button>'
      + '</div>'
      + '<div id="ct-list"><div class="loading"><div class="spinner"></div></div></div>';
    await _load();
    window._ctRenderList();
  };

  window._ctRenderList = function () {
    var el = document.getElementById('ct-list');
    if (!el) return;
    var q = ((document.getElementById('ct-search') || {}).value || '').toLowerCase();
    var rows = (state.contactsData || []).filter(function (c) {
      if (!q) return true;
      return (c.name + ' ' + c.business + ' ' + (c.title || '') + ' ' + c.specialties + ' ' + c.notes + ' ' + c.metAt).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) { return _ctLastNameKey(a.name).localeCompare(_ctLastNameKey(b.name)); });
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state"><p>' + (q ? 'No contacts match.' : 'No contacts yet — add your first dealer, repair shop, or collector friend.') + '</p></div>';
      return;
    }
    // v0.9.788 (Brad): COMPACT cards — card thumb left (tap = full size),
    // person photo inline right of the name, buttons tiled 2-3 per row.
    var _sb = 'padding:0.28rem 0.5rem;border-radius:6px;font-size:0.72rem;text-align:center;text-decoration:none;cursor:pointer;font-family:var(--font-body);background:none';
    // v0.9.791 (Brad): name · business, then his photo, then the card to its
    // RIGHT — all on one line. Right column: phones / address / buttons.
    // Phones + address + actions stack tight; no dead middle space.
    el.innerHTML = rows.map(function (c) {
      var chips = (c.specialties || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        .map(function (s) { return '<span style="font-size:0.62rem;border:1px solid var(--accent2);color:var(--accent2);border-radius:4px;padding:0.02rem 0.3rem;margin-right:0.2rem">' + _esc(s) + '</span>'; }).join('');
      var cardM = (c.cardLink || '').match(/\/d\/([\w-]+)/);
      var persM = (c.personPhoto || '').match(/\/d\/([\w-]+)/);
      var boughtN = Object.values(state.personalData || {}).filter(function (pd) { return pd && pd.owned && pd.purchasedFrom === c.id; }).length;
      return '<div style="border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:0.45rem 0.7rem;margin-bottom:0.4rem">'
        + '<div style="display:flex;align-items:flex-start;gap:0.6rem;flex-wrap:wrap">'
        + '<div style="flex:1;min-width:170px">'
        +   '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;line-height:1.25">'
        +     '<span style="font-weight:800;color:var(--text);font-size:0.92rem">' + _esc(c.name)
        +       (c.business ? ' <span style="font-weight:400;color:var(--text-mid);font-size:0.78rem">· ' + _esc(c.business) + '</span>' : '') + '</span>'
        +     (persM ? '<img data-card-thumb="' + persM[1] + '" alt="" style="width:26px;height:26px;object-fit:cover;border-radius:50%;border:1px solid var(--border);cursor:pointer;background:#111" onclick="window.open(\'' + _esc(c.personPhoto) + '\', \'_blank\')">' : '')
        +     (cardM ? '<img data-card-thumb="' + cardM[1] + '" alt="card" class="ct-cthumb" style="width:48px;height:30px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:pointer;background:#111" onclick="window.open(\'' + _esc(c.cardLink) + '\', \'_blank\')">'
        +       '<a class="ct-clink" href="' + _esc(c.cardLink) + '" target="_blank" rel="noopener" style="display:none;font-size:0.72rem;color:var(--accent2);text-decoration:none">📇 Card</a>' : '')
        +   '</div>'
        +   (c.title ? '<div style="font-size:0.7rem;color:var(--text-dim)">' + _esc(c.title) + '</div>' : '')
        +   (chips ? '<div style="margin-top:0.15rem">' + chips + '</div>' : '')
        +   (c.notes ? '<div style="font-size:0.72rem;color:var(--text-mid);margin-top:0.15rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + _esc(c.notes) + '</div>' : '')
        +   (c.metAt ? '<div style="font-size:0.66rem;color:var(--text-dim);margin-top:0.1rem">Met: ' + _esc(c.metAt) + '</div>' : '')
        +   (boughtN ? '<div onclick="_ctShowBought(\'' + _esc(c.id) + '\')" style="font-size:0.7rem;color:var(--accent2);margin-top:0.15rem;cursor:pointer">🛒 ' + boughtN + ' item' + (boughtN > 1 ? 's' : '') + ' bought — tap to see</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:0.25rem;align-items:flex-end;flex-shrink:0;max-width:270px">'
        +   '<div style="display:flex;flex-wrap:wrap;gap:0.25rem;justify-content:flex-end">'
        +     (c.phone ? '<a href="tel:' + _esc(c.phone.replace(/[^+0-9]/g, '')) + '" onclick="return _ctTel(event, \'' + _esc(c.phone) + '\')" style="' + _sb + ';border:1px solid #2ecc71;color:#2ecc71">📞 ' + _esc(c.phone) + '</a>' : '')
        +     (c.cellPhone ? '<a href="tel:' + _esc(c.cellPhone.replace(/[^+0-9]/g, '')) + '" onclick="return _ctTel(event, \'' + _esc(c.cellPhone) + '\')" style="' + _sb + ';border:1px solid #2ecc71;color:#2ecc71">📱 ' + _esc(c.cellPhone) + '</a>' : '')
        +     (c.homePhone ? '<a href="tel:' + _esc(c.homePhone.replace(/[^+0-9]/g, '')) + '" onclick="return _ctTel(event, \'' + _esc(c.homePhone) + '\')" style="' + _sb + ';border:1px solid #2ecc71;color:#2ecc71">🏠 ' + _esc(c.homePhone) + '</a>' : '')
        +   '</div>'
        +   (c.address ? '<a href="https://maps.google.com/?q=' + encodeURIComponent(c.address) + '" onclick="return _ctMap(event, \'' + encodeURIComponent(c.address) + '\')" target="_blank" rel="noopener" style="font-size:0.7rem;color:#16a085;text-decoration:none;text-align:right">📍 ' + _esc(c.address) + '</a>' : '')
        +   '<div style="display:flex;flex-wrap:wrap;gap:0.25rem;justify-content:flex-end">'
        +     (c.email ? '<a href="mailto:' + _esc(c.email) + '" target="_blank" rel="noopener" style="' + _sb + ';border:1px solid #3498db;color:#3498db">✉ Email</a>' : '')
        +     (c.website ? '<a href="' + _esc((/^https?:/i.test(c.website) ? c.website : 'https://' + c.website)) + '" target="_blank" rel="noopener" style="' + _sb + ';border:1px solid #9b59b6;color:#9b59b6">🌐 Web</a>' : '')
        +     '<button onclick="_ctOpenEdit(' + c.row + ')" style="' + _sb + ';border:1px solid var(--border);background:var(--surface2);color:var(--text-mid)">Edit</button>'
        +     '<button onclick="_ctDeleteRow(' + c.row + ')" style="' + _sb + ';border:1px solid #e74c3c;color:#e74c3c">Delete</button>'
        +   '</div>'
        + '</div></div></div>';
    }).join('');
    // v0.9.778: hydrate the card thumbnails (authenticated Drive fetch).
    if (typeof loadDriveThumb === 'function') {
      el.querySelectorAll('img[data-card-thumb]').forEach(function (im) {
        im.onerror = function () { this.style.display = 'none'; };
        loadDriveThumb(im.getAttribute('data-card-thumb'), im, im);
      });
    }
  };

  // v0.9.785 (Brad): platform-smart navigation. Android: geo: URI = the
  // system's own "open with" chooser (Waze shows up if installed). iPhone:
  // Apple Maps. Desktop: Google Maps in a new tab.
  window._ctMap = function (ev, encAddr) {
    var addr = '';
    try { addr = decodeURIComponent(encAddr); } catch (e) { addr = encAddr; }
    var ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) { ev.preventDefault(); location.href = 'geo:0,0?q=' + encodeURIComponent(addr); return false; }
    if (/iPhone|iPad|iPod/i.test(ua)) { ev.preventDefault(); location.href = 'https://maps.apple.com/?q=' + encodeURIComponent(addr); return false; }
    return true;   // desktop: let the Google Maps link open its tab
  };

  // v0.9.784 (Brad): desktop has no phone app — clicking a number there
  // copies it instead of navigating to a dead tel: link. Mobile still calls.
  window._ctTel = function (ev, num) {
    var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (mobile) return true;
    ev.preventDefault();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(num).then(function () { showToast('📞 ' + num + ' copied to the clipboard'); }).catch(function () {});
    }
    return false;
  };

  // v0.9.782 (Brad): everything you've bought from this contact.
  window._ctShowBought = function (cid) {
    var items = Object.values(state.personalData || {}).filter(function (pd) { return pd && pd.owned && pd.purchasedFrom === cid; });
    var c = (state.contactsData || []).find(function (x) { return x.id === cid; });
    window._ctClose('ct-bought-modal');
    var d = document.createElement('div');
    d.id = 'ct-bought-modal';
    d.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:420px;width:100%;padding:1rem;max-height:80vh;overflow-y:auto">'
      + '<div style="font-family:var(--font-head);font-size:1rem;color:var(--text);margin-bottom:0.6rem">🛒 Bought from ' + _esc((c && c.name) || 'this contact') + '</div>'
      + items.map(function (pd) {
          var label = 'No. ' + _esc(pd.itemNum || '?') + (pd.customName ? ' — ' + _esc(pd.customName) : (pd.description ? ' — ' + _esc(String(pd.description).substring(0, 40)) : ''));
          var when = pd.datePurchased ? ' <span style="color:var(--text-dim);font-size:0.72rem">' + _esc(pd.datePurchased) + '</span>' : '';
          return '<div style="padding:0.45rem 0.2rem;border-bottom:1px solid var(--border);font-size:0.85rem;color:var(--text);cursor:pointer" onclick="_ctClose(\'ct-bought-modal\'); if (typeof _openOwnedByInvId === \'function\') _openOwnedByInvId(\'' + _esc(pd.inventoryId || '') + '\')">' + label + when + '</div>';
        }).join('')
      + '<button onclick="_ctClose(\'ct-bought-modal\')" style="width:100%;margin-top:0.7rem;padding:0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Close</button>'
      + '</div>';
    document.body.appendChild(d);
    _ctWireBack('ct-bought-modal');
  };

  // v0.9.788 (Brad): share MULTIPLE contacts — pick from a checklist, send
  // via the phone's share sheet (desktop: copied to the clipboard).
  function _ctShareText(c) {
    var lines = [];
    lines.push(c.name + (c.title ? ' — ' + c.title : ''));
    if (c.business) lines.push(c.business);
    var ph = [];
    if (c.phone) ph.push('Store: ' + c.phone);
    if (c.cellPhone) ph.push('Cell: ' + c.cellPhone);
    if (c.homePhone) ph.push('Home: ' + c.homePhone);
    if (ph.length) lines.push(ph.join(' · '));
    if (c.email) lines.push('Email: ' + c.email);
    if (c.website) lines.push('Web: ' + c.website);
    if (c.address) lines.push(c.address);
    return lines.join('\n');
  }
  window._ctShareOpen = function () {
    var rows = (state.contactsData || []).slice().sort(function (a, b) { return _ctLastNameKey(a.name).localeCompare(_ctLastNameKey(b.name)); });
    if (!rows.length) { showToast('No contacts to share yet', 2500); return; }
    window._ctClose('ct-share-modal');
    var d = document.createElement('div');
    d.id = 'ct-share-modal';
    d.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:420px;width:100%;padding:1rem;max-height:80vh;display:flex;flex-direction:column">'
      + '<div style="font-family:var(--font-head);font-size:1rem;color:var(--text);margin-bottom:0.6rem">↗ Share contacts — pick who to send</div>'
      + '<div style="flex:1;overflow-y:auto;min-height:0">'
      + rows.map(function (c) {
          return '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.2rem;border-bottom:1px solid var(--border);cursor:pointer;font-size:0.88rem;color:var(--text)">'
            + '<input type="checkbox" data-ct-share-id="' + _esc(c.id) + '" style="width:18px;height:18px">'
            + _esc(c.name) + (c.business ? ' <span style="color:var(--text-mid);font-size:0.78rem">· ' + _esc(c.business) + '</span>' : '')
            + '</label>';
        }).join('')
      + '</div>'
      + '<div style="display:flex;gap:0.5rem;margin-top:0.7rem">'
      + '<button onclick="_ctShareGo()" style="flex:2;padding:0.65rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-weight:800;cursor:pointer;font-family:var(--font-body)">↗ Share selected</button>'
      + '<button onclick="_ctClose(\'ct-share-modal\')" style="flex:1;padding:0.65rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(d);
    _ctWireBack('ct-share-modal');
  };
  window._ctShareGo = function () {
    var d = document.getElementById('ct-share-modal');
    if (!d) return;
    var ids = [].slice.call(d.querySelectorAll('input[data-ct-share-id]:checked')).map(function (cb) { return cb.getAttribute('data-ct-share-id'); });
    if (!ids.length) { showToast('Tick at least one contact', 2500, true); return; }
    var picked = (state.contactsData || []).filter(function (c) { return ids.indexOf(c.id) >= 0; });
    var text = picked.map(_ctShareText).join('\n\n— — —\n\n') + '\n\n(shared from The Rail Roster)';
    window._ctClose('ct-share-modal');
    if (navigator.share) {
      navigator.share({ title: picked.length === 1 ? picked[0].name : (picked.length + ' contacts'), text: text }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast('📋 ' + picked.length + ' contact' + (picked.length > 1 ? 's' : '') + ' copied — paste into a text or email'); }).catch(function () {});
    }
  };

  // v0.9.773 (Brad): Delete straight from the list card (Edit | Delete split).
  window._ctDeleteRow = async function (row) {
    var c = (state.contactsData || []).find(function (x) { return x.row === row; });
    var okDel = (typeof appConfirm === 'function')
      ? await appConfirm('Delete ' + ((c && c.name) ? c.name : 'this contact') + '?', { danger: true, ok: 'Delete', title: 'Delete contact' })
      : confirm('Delete ' + ((c && c.name) ? c.name : 'this contact') + '?');
    if (!okDel) return;
    try {
      await sheetsUpdate(state.personalSheetId, TAB + '!A' + row + ':P' + row, [['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']]);
      showToast('Contact deleted');
      try { await _load(); window._ctRenderList(); } catch (e3) { console.warn('[contact list refresh]', e3); }
    } catch (e) { console.warn('[contact delete]', e); showToast('Delete failed — try again', 3500, true); }
  };

  // ── add / edit modal ───────────────────────────────────────────
  window._ctOpenEdit = function (row) {
    var c = row ? (state.contactsData || []).find(function (x) { return x.row === row; }) : null;
    c = c || { id: '', name: '', business: '', phone: '', email: '', specialties: '', notes: '', cardLink: '', metAt: '', dateAdded: '', address: '', website: '', homePhone: '', cellPhone: '', title: '', personPhoto: '' };
    window._ctClose('ct-modal');
    var ov = document.createElement('div');
    ov.id = 'ct-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    // v0.9.778: compact fields + side-by-side pairs — the form was a mile long.
    function fld(label, id, val, ph, type) {
      return '<div style="margin-bottom:0.4rem"><div style="font-size:0.66rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.1rem">' + label + '</div>'
        + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(val) + '" placeholder="' + _esc(ph || '') + '" style="width:100%;box-sizing:border-box;padding:0.45rem 0.6rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem"></div>';
    }
    function fld2(a, b) { return '<div style="display:flex;gap:0.45rem"><div style="flex:1;min-width:0">' + a + '</div><div style="flex:1;min-width:0">' + b + '</div></div>'; }
    var _chipRow = function (list) {
      var have = (c.specialties || '').split(',').map(function (x) { return x.trim().toLowerCase(); });
      return '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.35rem">' + list.map(function (s) {
        var on = have.indexOf(s.toLowerCase()) >= 0;
        return '<button data-ct-chip="' + s + '" style="padding:0.22rem 0.5rem;border-radius:999px;font-size:0.73rem;cursor:pointer;font-family:var(--font-body);border:1.5px solid ' + (on ? 'var(--accent2);background:rgba(201,146,42,0.15);color:var(--accent2)' : 'var(--border);background:var(--surface2);color:var(--text-mid)') + '">' + s + '</button>';
      }).join('') + '</div>';
    };
    var _knownChips = ERA_CHIPS.concat(SPECIALTY_CHIPS).map(function (x) { return x.toLowerCase(); });
    var _extraSpecs = (c.specialties || '').split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return x && _knownChips.indexOf(x.toLowerCase()) < 0; }).join(', ');
    ov.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:480px;width:100%;padding:0.9rem 1rem;max-height:92vh;overflow-y:auto">'
      + '<div style="font-family:var(--font-head);font-size:1.05rem;color:var(--text);margin-bottom:0.5rem">' + (row ? 'Edit Contact' : '📇 New Contact') + '</div>'
      + '<div id="ct-card-dropwrap" style="display:flex;gap:0.5rem;margin-bottom:0.7rem">'
      +   '<button onclick="document.getElementById(\'ct-card-file\').click()" style="flex:1;padding:0.75rem;border-radius:9px;border:1.5px dashed #3498db;background:rgba(52,152,219,0.08);color:#3498db;font-weight:700;cursor:pointer;font-family:var(--font-body)">📷 Take photo of card</button>'
      +   '<button onclick="document.getElementById(\'ct-card-gallery\').click()" style="flex:1;padding:0.75rem;border-radius:9px;border:1.5px dashed #3498db;background:rgba(52,152,219,0.08);color:#3498db;font-weight:700;cursor:pointer;font-family:var(--font-body)">🖼 From gallery</button>'
      + '</div>'
      + '<input type="file" id="ct-card-file" accept="image/*" capture="environment" style="display:none">'
      + '<input type="file" id="ct-card-gallery" accept="image/*" style="display:none">'
      + '<div style="font-size:0.68rem;color:var(--text-dim);margin:-0.4rem 0 0.4rem">Tip: fill the frame with the card, avoid glare — a close, flat shot reads best.</div>'
      + '<div id="ct-card-preview" style="display:none;margin:0 0 0.4rem;position:relative"><img id="ct-card-preview-img" alt="business card" style="width:100%;max-height:140px;object-fit:contain;border-radius:8px;border:1px solid var(--border);background:#111">'
      +   '<button id="ct-card-crop" title="Crop" style="position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:rgba(0,0,0,0.65);color:#fff;cursor:pointer;font-size:0.9rem;line-height:1">✂</button>'
      + '</div>'
      + '<div id="ct-person-row" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">'
      +   '<span id="ct-person-wrap" style="display:none;position:relative;flex-shrink:0"><img id="ct-person-preview" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:50%;border:1.5px solid var(--border);background:#111;display:block"><button id="ct-person-crop" title="Crop" style="position:absolute;right:-7px;bottom:-7px;width:24px;height:24px;border-radius:50%;border:1px solid var(--border);background:rgba(0,0,0,0.75);color:#fff;cursor:pointer;font-size:0.7rem;line-height:1">✂</button></span>'
      +   '<button onclick="document.getElementById(\'ct-person-file\').click()" style="flex:1;padding:0.5rem;border-radius:8px;border:1.5px dashed var(--border);background:none;color:var(--text-mid);font-size:0.8rem;cursor:pointer;font-family:var(--font-body)">🙂 Add a photo of them (optional)</button>'
      +   '<input type="file" id="ct-person-file" accept="image/*" style="display:none">'
      + '</div>'
      + '<div id="ct-card-status" style="font-size:0.75rem;color:var(--text-dim);margin:-0.3rem 0 0.5rem"></div>'
      + fld2(fld('Name', 'ct-f-name', c.name, 'Dave Miller'), fld('Title', 'ct-f-title', c.title, 'Owner'))
      + fld('Store / Business', 'ct-f-biz', c.business, "Dave's Trains")
      + fld2(fld('Store / Main Phone', 'ct-f-phone', c.phone, '(555) 123-4567', 'tel'), fld('Cell / Mobile', 'ct-f-cell', c.cellPhone, '(555) 123-9876', 'tel'))
      + fld2(fld('Home Phone', 'ct-f-home', c.homePhone, '', 'tel'), fld('Email', 'ct-f-email', c.email, 'dave@example.com', 'email'))
      + '<div style="margin-bottom:0.1rem;font-size:0.66rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">Era</div>'
      + _chipRow(ERA_CHIPS)
      + '<div style="margin-bottom:0.1rem;font-size:0.66rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)">Deals in</div>'
      + _chipRow(SPECIALTY_CHIPS)
      + fld('Other specialties', 'ct-f-spec', _extraSpecs, 'anything not covered above')
      + fld('Website', 'ct-f-web', c.website, 'davestrains.com')
      + fld('Mailing address', 'ct-f-addr', c.address, '123 Main St, Anytown PA 17400')
      + fld('Met at', 'ct-f-met', c.metAt, 'York, October 2026')
      + '<div style="margin-bottom:0.4rem"><div style="font-size:0.66rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.1rem">Notes</div>'
      + '<textarea id="ct-f-notes" rows="2" placeholder="strong on tinplate, will negotiate, ships…" style="width:100%;box-sizing:border-box;padding:0.45rem 0.6rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;resize:vertical">' + _esc(c.notes) + '</textarea></div>'
      + '<div style="display:flex;gap:0.5rem">'
      + '<button id="ct-save" style="flex:2;padding:0.8rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-weight:800;cursor:pointer;font-family:var(--font-body)">✓ Save Contact</button>'
      + (row ? '<button id="ct-del" style="flex:1;padding:0.8rem;border-radius:9px;border:1px solid #e74c3c;background:none;color:#e74c3c;cursor:pointer;font-family:var(--font-body)">Delete</button>' : '')
      + '<button onclick="_ctClose(\'ct-modal\')" style="flex:1;padding:0.8rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    _ctWireBack('ct-modal');
    // v0.9.779: warm up the on-device reader NOW — loading it used to be the
    // first thing that happened after picking a photo (5-10s of dead time).
    try { if (typeof window._ensureTesseract === 'function') window._ensureTesseract().catch(function () {}); } catch (eW) {}
    ov.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('[data-ct-chip]');
      if (chip) {
        var on = chip.style.borderColor !== 'var(--border)' && chip.style.color === 'var(--accent2)';
        if (on) { chip.style.cssText = chip.style.cssText.replace(/border:[^;]+;?/, '') + ';border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid)'; }
        else { chip.style.cssText = chip.style.cssText.replace(/border:[^;]+;?/, '') + ';border:1.5px solid var(--accent2);background:rgba(201,146,42,0.15);color:var(--accent2)'; }
      }
    });

    var _cardFile = null;
    // v0.9.778: show the card photo in the form — existing (from Drive) or
    // freshly picked (instant local preview).
    var _pv = ov.querySelector('#ct-card-preview'), _pvImg = ov.querySelector('#ct-card-preview-img');
    var _clm = (c.cardLink || '').match(/\/d\/([\w-]+)/);
    if (_clm && _pv && typeof loadDriveThumb === 'function') { _pv.style.display = 'block'; loadDriveThumb(_clm[1], _pvImg, _pv); }
    // v0.9.780: optional photo of the PERSON (gallery-first).
    var _personFile = null;
    var _ppImg = ov.querySelector('#ct-person-preview');
    var _ppWrap = ov.querySelector('#ct-person-wrap');
    var _ppm = (c.personPhoto || '').match(/\/d\/([\w-]+)/);
    if (_ppm && _ppImg && typeof loadDriveThumb === 'function') { _ppWrap.style.display = 'inline-block'; loadDriveThumb(_ppm[1], _ppImg, _ppImg); }
    var _pInp = ov.querySelector('#ct-person-file');
    if (_pInp) _pInp.addEventListener('change', function () {
      var pf = _pInp.files && _pInp.files[0];
      if (!pf) return;
      var _setPerson = function (file2) { _personFile = file2; try { _ppWrap.style.display = 'inline-block'; _ppImg.src = URL.createObjectURL(file2); } catch (eP) {} };
      _setPerson(pf);
      // v0.9.787: crop right after picking (Cancel keeps the full photo)
      if (typeof _openCropper === 'function') {
        try { _openCropper(URL.createObjectURL(pf), function (blob) { _setPerson(new File([blob], 'person.jpg', { type: 'image/jpeg' })); }, function () {}); } catch (eC) {}
      }
    });
    // v0.9.787 (Brad): flow = take/pick the picture → CROP → then read.
    // _skipCropOnce marks a re-dispatch that already went through the cropper.
    var _skipCropOnce = false;
    var _cropCard = ov.querySelector('#ct-card-crop');
    if (_cropCard) _cropCard.onclick = function () {
      if (typeof _openCropper !== 'function' || !_pvImg || !_pvImg.src) return;
      _openCropper(_pvImg.src, function (blob) {
        var nf = new File([blob], 'card.jpg', { type: 'image/jpeg' });
        var gal = ov.querySelector('#ct-card-gallery');
        try {
          var dt = new DataTransfer(); dt.items.add(nf);
          _skipCropOnce = true;
          gal.files = dt.files;
          gal.dispatchEvent(new Event('change'));      // re-scan the cropped card
        } catch (eD) { _skipCropOnce = false; _cardFile = nf; try { _pvImg.src = URL.createObjectURL(nf); } catch (e2) {} }
      });
    };
    // v0.9.800 (Brad): drag & drop a photo onto the card area or the person
    // row — same as picking it (card drops go through crop-then-read).
    var _dropToInput = function (inp) {
      return function (f2) {
        try { var dt = new DataTransfer(); dt.items.add(f2); inp.files = dt.files; inp.dispatchEvent(new Event('change')); } catch (e3) {}
      };
    };
    var _wireDrop = function (el, applyFn) {
      if (!el || !applyFn) return;
      el.addEventListener('dragover', function (e) { e.preventDefault(); el.style.outline = '2px dashed #3498db'; el.style.outlineOffset = '2px'; });
      el.addEventListener('dragleave', function () { el.style.outline = ''; });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); el.style.outline = '';
        var f2 = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f2 && /^image\//.test(f2.type)) applyFn(f2);
      });
    };
    var _galInp = ov.querySelector('#ct-card-gallery');
    _wireDrop(ov.querySelector('#ct-card-dropwrap'), _dropToInput(_galInp));
    _wireDrop(_pv, _dropToInput(_galInp));
    _wireDrop(ov.querySelector('#ct-person-row'), _dropToInput(_pInp));

    var _cropPerson = ov.querySelector('#ct-person-crop');
    if (_cropPerson) _cropPerson.onclick = function () {
      if (typeof _openCropper !== 'function' || !_ppImg || !_ppImg.src) return;
      _openCropper(_ppImg.src, function (blob) {
        _personFile = new File([blob], 'person.jpg', { type: 'image/jpeg' });
        try { _ppImg.src = URL.createObjectURL(blob); } catch (e2) {}
      });
    };
    // v0.9.776 (Brad): visible spinner while reading — text-only status looked
    // like the app had stalled during the AI/OCR passes.
    var _stBusy = function (st2, msg) {
      st2.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:-2px"></span>' + msg;
    };
    // v0.9.768 (Brad): camera AND gallery inputs share one handler — the
    // capture attribute forces the camera, so gallery picks need a second input.
    ['ct-card-file', 'ct-card-gallery'].forEach(function (_inpId) {
    var fileInp = ov.querySelector('#' + _inpId);
    if (!fileInp) return;
    fileInp.addEventListener('change', async function () {
      var f = fileInp.files && fileInp.files[0];
      if (!f) return;
      _cardFile = f;
      try { if (_pv && _pvImg) { _pv.style.display = 'block'; _pvImg.src = URL.createObjectURL(f); } } catch (e0) {}
      var st = ov.querySelector('#ct-card-status');
      // v0.9.787 (Brad): take the picture → CROP IT → then read. A fresh pick
      // opens the cropper first; Apply re-enters this handler with the cropped
      // file (_skipCropOnce), Cancel reads the full photo as-is.
      if (!_skipCropOnce && typeof _openCropper === 'function') {
        var _rawUrl = '';
        try { _rawUrl = URL.createObjectURL(f); } catch (eU) {}
        if (_rawUrl) {
          st.textContent = '✂ Crop to just the card, then hit Apply.';
          var _reDispatch = function (file3) {
            var nf3 = file3 || f;
            try {
              var dt3 = new DataTransfer(); dt3.items.add(nf3 instanceof File ? nf3 : new File([nf3], 'card.jpg', { type: 'image/jpeg' }));
              _skipCropOnce = true;
              fileInp.files = dt3.files;
              fileInp.dispatchEvent(new Event('change'));
            } catch (eD3) { _skipCropOnce = false; }
          };
          _openCropper(_rawUrl,
            function (blob) { _reDispatch(new File([blob], 'card.jpg', { type: 'image/jpeg' })); },
            function () { _reDispatch(f); });
          return;
        }
      }
      _skipCropOnce = false;
      // v0.9.779 (Brad: "45 seconds is too long"): the relay reader and the
      // on-device reader now run AT THE SAME TIME. Whoever finishes first
      // fills the form; the relay's answer (better quality) may replace an
      // auto-filled value afterwards — but NEVER a value the user has edited.
      _stBusy(st, '🔍 Reading the card…');
      var _autoVal = {};   // fieldId -> value WE put there (user edits break the match)
      var FIELD_MAP = [['name', 'ct-f-name', 'name'], ['title', 'ct-f-title', 'title'], ['business', 'ct-f-biz', 'business'], ['phone', 'ct-f-phone', 'store phone'], ['cell', 'ct-f-cell', 'cell'], ['home', 'ct-f-home', 'home phone'], ['email', 'ct-f-email', 'email'], ['website', 'ct-f-web', 'website'], ['address', 'ct-f-addr', 'address']];
      var _filledLabels = {};
      var _apply = function (got, canOverride, lock) {
        var n = 0;
        FIELD_MAP.forEach(function (fm) {
          var el = ov.querySelector('#' + fm[1]); if (!el) return;
          var v = (got && got[fm[0]]) || ''; if (!v) return;
          if (!el.value) { el.value = v; if (!lock) _autoVal[fm[1]] = v; _filledLabels[fm[2]] = 1; n++; }
          else if (canOverride && _autoVal[fm[1]] && el.value === _autoVal[fm[1]] && el.value !== v) {
            el.value = v; _autoVal[fm[1]] = v; _filledLabels[fm[2]] = 1; n++;
          }
        });
        return n;
      };
      var _sum = function () {
        var ks = Object.keys(_filledLabels);
        return ks.length ? ('📇 Card read — filled in ' + ks.join(', ') + '. Double-check before saving.')
                         : '📇 Card attached — couldn’t read details, type them in';
      };
      // ── QR code first (v0.9.783): ~1s and exact. A full vCard ends the scan
      // right here — no readers run, no daily-limit scan spent.
      try {
        _stBusy(st, '⚡ Checking for a QR code…');
        var _qrGot = await _qrReadCard(f);
        if (_qrGot) {
          _apply(_qrGot, false, true);   // locked: readers may fill AROUND these, never replace
          if (_qrGot.name && _qrGot.email && (_qrGot.phone || _qrGot.cell)) {
            st.textContent = '⚡ Read the card’s QR code — filled in ' + Object.keys(_filledLabels).join(', ') + '. Double-check before saving.';
            return;
          }
        }
      } catch (eQ2) { console.warn('[card QR]', eQ2); }
      _stBusy(st, '🔍 Reading the card…');
      var _aiWon = false, _quotaHit = false;
      var pAi = _aiReadCard(f).then(function (r) {
        if (r && r._quota) { _quotaHit = true; return null; }
        if (r) { _aiWon = true; _apply(r, true); }
        return r;
      }).catch(function (eA) { console.warn('[card AI]', eA); return null; });
      var pOcr = _ocrReadCard(f, function () { return _aiWon; }, function () { _stBusy(st, '🔍 Taking a second look…'); })
        .then(function (got) { if (got) _apply(got, false); return got; })
        .catch(function (eO) { console.warn('[card OCR]', eO); return null; });
      // first finisher updates the note right away, second finisher finalizes
      Promise.race([pAi, pOcr]).then(function () {
        if (Object.keys(_filledLabels).length) _stBusy(st, _sum().replace('📇 Card read —', '📇') + ' Still double-checking…');
      });
      try { await Promise.all([pAi, pOcr]); } catch (eB) {}
      st.textContent = _sum() + (_quotaHit ? ' (Daily photo-reading limit reached — quick reader only today.)' : '');
    });
    });

    ov.querySelector('#ct-save').onclick = async function () {
      var v = function (id) { var el = ov.querySelector('#' + id); return el ? el.value.trim() : ''; };
      var name = v('ct-f-name');
      if (!name) { showToast('Give them at least a name', 3000, true); return; }
      this.textContent = 'Saving…'; this.disabled = true;
      var chips = [].slice.call(ov.querySelectorAll('[data-ct-chip]')).filter(function (ch) { return ch.style.color === 'var(--accent2)'; }).map(function (ch) { return ch.getAttribute('data-ct-chip'); });
      var extra = v('ct-f-spec');
      var specialties = chips.concat(extra ? [extra] : []).join(', ');
      var cardLink = c.cardLink || '', personLink = c.personPhoto || '';
      try {
        // v0.9.789 FIX: photos never uploaded — driveFindOrCreateFolder REQUIRES
        // a parent (threw 'Missing parentId', swallowed here) and returns the ID
        // STRING, not {id}. Now: ensure the vault, parent the Contacts folder
        // under it, use the returned id directly.
        if ((_cardFile || _personFile) && typeof driveFindOrCreateFolder === 'function' && typeof driveUploadPhoto === 'function') {
          if (typeof driveEnsureSetup === 'function') await driveEnsureSetup();
          var _parentId = (typeof driveCache !== 'undefined' && driveCache.vaultId) ? driveCache.vaultId : 'root';
          var folderId = await driveFindOrCreateFolder('The Rail Roster - Contacts', _parentId);
          if (folderId) {
            if (_cardFile) {
              var up = await driveUploadPhoto(_cardFile, (name + ' card ' + _today() + '.jpg'), folderId);
              if (up && up.id) cardLink = 'https://drive.google.com/file/d/' + up.id + '/view';
            }
            if (_personFile) {
              var up2 = await driveUploadPhoto(_personFile, (name + ' photo ' + _today() + '.jpg'), folderId);
              if (up2 && up2.id) personLink = 'https://drive.google.com/file/d/' + up2.id + '/view';
            }
          }
        }
      } catch (e) {
        console.warn('[contact photo upload]', e);
        showToast('Contact will save, but the photo upload failed — open Edit and re-add the photo', 4500, true);
      }
      var id = c.id || ('C-' + Date.now());
      var rowVals = [id, name, v('ct-f-biz'), v('ct-f-phone'), v('ct-f-email'), specialties, v('ct-f-notes'), cardLink, v('ct-f-met'), c.dateAdded || _today(), v('ct-f-addr'), v('ct-f-web'), v('ct-f-home'), v('ct-f-cell'), v('ct-f-title'), personLink];
      try {
        if (!(await _ensureTab())) throw new Error('no tab');
        if (row) await sheetsUpdate(state.personalSheetId, TAB + '!A' + row + ':P' + row, [rowVals]);
        else await sheetsAppend(state.personalSheetId, TAB + '!A:P', [rowVals]);
        window._ctClose('ct-modal');
        showToast('✓ ' + name + ' saved to Contacts');
        try { await _load(); window._ctRenderList(); } catch (e3) { console.warn('[contact list refresh]', e3); }
      } catch (e) {
        console.warn('[contact save]', e);
        showToast('Could not save — ' + ((e && e.message) ? e.message : 'check your connection and try again'), 5000, true);
        this.textContent = '✓ Save Contact'; this.disabled = false;
      }
    };
    var del = ov.querySelector('#ct-del');
    if (del) del.onclick = async function () {
      var okDel2 = (typeof appConfirm === 'function')
        ? await appConfirm('Delete this contact?', { danger: true, ok: 'Delete', title: 'Delete contact' })
        : confirm('Delete this contact?');
      if (!okDel2) return;
      try {
        await sheetsUpdate(state.personalSheetId, TAB + '!A' + row + ':P' + row, [['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']]);
        window._ctClose('ct-modal');
        showToast('Contact deleted');
        await _load();
        window._ctRenderList();
      } catch (e) { showToast('Delete failed — try again', 3500, true); }
    };
  };
})();
