// ═══════════════════════════════════════════════════════════════
// photo-inbox-reader.js — the Photo Inbox's on-device number reader
//
// Moved WORD FOR WORD out of photo-inbox.js on 2026-10-20 (Photo Inbox split,
// step 3 of PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md — Brad: "now"). Nothing in
// it changed: Tesseract on the device, _numberFromText (reads a catalogue
// number out of whatever the OCR saw), barcodes, the catalogue quote and
// word matches, the arbitration between them, and the image preparation the
// reader audit chose.
//
// One of the Photo Inbox's pieces: it loads right after photo-inbox.js and
// meets the other pieces only through window._pinFns (PINF) — see the
// hand-over block at the top of photo-inbox.js. The app's own window.rr…
// entry points defined here (rrFreeReadBlob and friends) are unchanged.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';
  var PINF = window._pinFns;   // made by photo-inbox.js, which loads first
  // From app/photo-inbox.js:
  var _pinFamilyPick = PINF.from('_pinFamilyPick');
  var _pinDemotedRow = PINF.from('_pinDemotedRow');
  var _pinKinRowsFor = PINF.from('_pinKinRowsFor');
  var _pinAiRowConflict = PINF.from('_pinAiRowConflict');
  var _pinPreferOf = PINF.from('_pinPreferOf');
  // Handed over to the other pieces (function declarations are hoisted):
  Object.assign(PINF, { _numberFromText: _numberFromText, _freeReadBlob: _freeReadBlob, _tessGet: _tessGet, _prefEras: _prefEras, _pinIsSetRow: _pinIsSetRow, _pinQuoteMatch: _pinQuoteMatch, _pinDescMatch: _pinDescMatch, _pinReconcileAiNum: _pinReconcileAiNum, _pinAiHints: _pinAiHints });

  var _tessWorker = null, _tessTried = false;   // the OCR worker (made once) and whether it would not load

  function _loadTesseract() {
    if (window.Tesseract) return Promise.resolve(true);
    if (_loadTesseract._p) return _loadTesseract._p;
    _loadTesseract._p = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';  // v0.9.1408: pinned exact (was @5 — a floating major that could swap the OCR engine under us on any load)
      s.onload = function () { resolve(!!window.Tesseract); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return _loadTesseract._p;
  }

  async function _tessGet() {
    if (_tessWorker) return _tessWorker;
    if (_tessTried && !window.Tesseract) return null;
    if (!(await _loadTesseract())) { _tessTried = true; return null; }
    try {
      _tessWorker = await Tesseract.createWorker('eng');
      // v0.9.1065: page-segmentation 6 ("one uniform block") nearly tripled the
      // free reader's hits in the audit on Brad's own 73 photos — 35 confirmed
      // against 13 for the shipping default. A model train photo is scattered
      // lettering on a body, not a page of prose, and the default mode was
      // trying to read it as a document.
      await _tessWorker.setParameters({
        tessedit_char_whitelist: '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        tessedit_pageseg_mode: '6',
      });
    } catch (e) { _tessWorker = null; }
    _tessTried = true;
    return _tessWorker;
  }

  async function _scaledCanvas(blob, maxDim) {
    var bmp = await createImageBitmap(blob);
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    // v0.9.1065: a full histogram stretch, not a fixed contrast bump. A silver
    // passenger car occupies a narrow band of greys and a fixed multiplier
    // barely moves it; stretching whatever range the photo actually uses out to
    // full black-to-white is what makes those numbers legible.
    try { _stretchCanvas(c); } catch (e) {}
    return c;
  }

  // Grayscale, then map the darkest pixel to black and the lightest to white.
  function _stretchCanvas(c) {
    var ctx = c.getContext('2d');
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    var lo = 255, hi = 0, i, g;
    for (i = 0; i < d.length; i += 4) {
      g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = (d[i] - lo) * 255 / span;
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    ctx.putImageData(img, 0, 0);
  }

  // Pull the best catalog-number candidate out of OCR text and confirm it
  // against the master. Busy box photos are full of noise text (marketing
  // copy, UPC barcodes, prices, years), so we: drop UPC/barcode-length runs,
  // PREFER a number the master actually knows, and prefer dashed catalog-style
  // numbers (6-17259, 6464-475) over bare digit blobs.
  // v0.9.1063 — two changes, both from Brad's inbox.
  //
  // (a) TWO-DIGIT NUMBERS. The token filter required 3 characters, to stop junk
  //     like a "26" wheel arrangement becoming an item number. It also threw
  //     away every genuine two-digit Lionel number: his Great Northern 58 could
  //     never be read, no matter how sharp the photo. Short tokens are now kept
  //     but must be CONFIRMED by the master list — 58 is a real catalog number
  //     and survives; a stray 26 is not and does not.
  //
  // (b) ERA. `prefer` is the photo's own era stamp, handed to findMaster, which
  //     already knows how to weight a catalog tab (+8) and a maker (+4). His
  //     2410 Santa Fe car, stamped Lionel Postwar O, was misread as "210" and
  //     then matched against a Lionel PRE-WAR standard-gauge switch pair. The
  //     app had the era written on the photo and was not using it.
  // v0.9.1831: the v1448 family question, asked in ONE place. Of the numbers
  // READ (the candidate list), which heads a dashed family in the stamped
  // catalog? Word evidence wins, then the head read most often. Writes the
  // "Family:" line on dbg and returns the pick, or null when no candidate
  // heads a family. Callers decide whether a bare head (no evidence) is enough.
  function _pinReadFamily(uniq, prefer, UP, dbg) {
    var _famHits = [];
    (uniq || []).slice(0, 8).forEach(function (cF) {
      var fpF = _pinFamilyPick(cF, prefer, UP);
      if (fpF) _famHits.push(fpF);
    });
    if (!_famHits.length) return null;
    var _famBest = _famHits[0];
    _famHits.slice(1).forEach(function (h) {
      if (h.why && !_famBest.why) { _famBest = h; return; }
      if (!!h.why === !!_famBest.why) {
        var _fA = (UP.match(new RegExp('\\b' + _famBest.fam + '\\b', 'g')) || []).length;
        var _fB = (UP.match(new RegExp('\\b' + h.fam + '\\b', 'g')) || []).length;
        if (_fB > _fA) _famBest = h;
      }
    });
    if (dbg) {
      dbg.family = _famBest.fam + ' heads ' + _famBest.count + ' dashed relative'
        + (_famBest.count === 1 ? '' : 's') + ' in the stamped catalog'
        + (_famBest.why ? ' — ' + _famBest.num + ' matched: ' + _famBest.why : '')
        + (_famBest.tied ? ' — narrowed to ' + _famBest.tied.join(' or ')
             + (_famBest.tiedWhy ? ' on: ' + _famBest.tiedWhy : '') : '');
    }
    return _famBest;
  }

  function _numberFromText(text, prefer) {
    if (!text) return null;
    var UP = String(text).toUpperCase();
    // v0.9.1168: numbers the user has explicitly rejected on this photo. Filtered
    // out at the CANDIDATE stage, so every downstream path — direct hit, join,
    // dash repair, quote match, hedge — is covered by one rule rather than five.
    var _rejN = function (v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var _rejectSet = ((prefer && prefer.reject) || []).map(_rejN).filter(Boolean);
    var _isRejected = function (c) {
      return _rejectSet.length > 0 && _rejectSet.indexOf(_rejN(c)) >= 0;
    };
    // v0.9.1277 (Brad's 6561 read as 1656): remember WHICH direct tokens the
    // reject list silenced. If one of them turns out to be stamped beside the
    // maker's own name, the human needs to hear that before any
    // reconstruction gets asserted in its place.
    var _rejSeen = [];

    // v0.9.959 (Brad): a 4-digit number sitting next to a © or a copyright
    // holder is a YEAR, not the catalog number — the Thomas box's "© 2012
    // LIONEL" was being read as item #2012. Ban those exact year tokens so they
    // can never be offered. Real Lionel numbers like 2037 / 2046 are never in a
    // copyright context, so they're untouched.
    var banned = {}, m;
    var reCopy = /(?:©|\(C\)|COPYRIGHT)\s*((?:19|20)\d{2})/g;
    while ((m = reCopy.exec(UP))) { banned[m[1]] = 1; }
    // ©-dropped fallback: OCR sometimes misses the © glyph, leaving "2012
    // GULLANE (THOMAS) LIMITED". Ban a year-range number only when a legal
    // suffix (L.L.C / LIMITED / INC …) sits within ~25 chars after it — that's
    // unmistakably a copyright line, not an item marking.
    var reHolder = /\b((?:19|20)\d{2})\b(?=[^0-9]{0,25}(?:L\.?L\.?C\b|LLC\b|LIMITED\b|LTD\b|\bINC\b|CORP\b|ENTERTAINMENT\b|TRADEMARK\b|GMBH\b))/g;
    while ((m = reHolder.exec(UP))) { banned[m[1]] = 1; }
    // v0.9.1065 — BUILD DATES. The audit read "5-54" off five different cars
    // and the catalog confirmed every one, because numbers like that collide
    // with real entries. They are not item numbers: Lionel stamps the build
    // date on the side of postwar rolling stock ("BLT 5-54" = May 1954), and it
    // is frequently the crispest printed thing in the photo. A real catalog
    // number never looks like this — dashed Lionel numbers are 6464-475 or
    // 2333-20, three or four digits before the dash, never one or two.
    // v0.9.1069 — widened. "10-2210" slipped through a rule that only looked
    // for one or two digits AFTER the dash. Real dashed Lionel numbers are
    // 6464-475 or 2333-20: three or four digits BEFORE it, always.
    // ══ v0.9.1076 — the strongest signal on the model itself ═══════════════
    // Brad's Lehigh Valley hopper carries FOUR numbers: road number 25000 in the
    // largest lettering, CAPY 100000, LD LMT 128300, and — in the smallest print
    // on the car — "BUILT 1-48 LIONEL 6176". Only the last is the catalog
    // number, and the car tells you which by putting it directly after the
    // maker's name. That is a manufacturing convention, not a guess: Lionel
    // stamps its catalog number next to LIONEL on essentially every postwar
    // piece. It is also exactly the cue a collector's eye uses.
    var namedByMaker = {};
    (function () {
      // v0.9.1077d — Brad's Lionel 50 gang car came through as "IONEL DE 50":
      // the maker's own name is long, curved and often the first thing OCR
      // mangles. Requiring it spelled perfectly threw away the strongest signal
      // we have precisely when the reading was rough. L1ONEL, IONEL, LIONE and
      // LIONEL all count; the pattern is still specific enough that nothing
      // else on a train matches it.
      var MAKER = '(?:[LI1][I1l]?[O0]NEL|LI[O0]NE)';
      // The gap allows a little junk, not just spaces: Brad's gang car reads
      // "IONEL DE 50" — OCR invents letters between the name and the number as
      // readily as it mangles the name itself. Ten non-digit characters is wide
      // enough for that and far too narrow to reach the next real number.
      var reAfter = new RegExp(MAKER + '(?:[ ]?LINES)?[^0-9]{0,10}(\\d{2,6}(?:-\\d{1,3})?)', 'g');
      var reBefore = new RegExp('(\\d{2,6}(?:-\\d{1,3})?)[^0-9]{0,10}' + MAKER, 'g');
      var mm;
      while ((mm = reAfter.exec(UP))) { namedByMaker[mm[1]] = 1; }
      while ((mm = reBefore.exec(UP))) { namedByMaker[mm[1]] = 1; }
    })();
    // ══ v0.9.1901 — A ONE-DIGIT NUMBER, ONLY WHEN THE CAR SAYS SO ══════════
    // Lionel's first items are numbered 1–9 (4U, 8E, 9E …): the No. 4 and No. 8
    // trolleys, the No. 8 Standard Gauge electric. The token scan below drops
    // every one-character token, so those could never be read. A loose digit
    // is everywhere on a train ("4 WHEEL", "3 RAIL", a build date), so one is
    // a lead ONLY stamped right after the maker's name ("LIONEL 8", "LIONEL
    // LINES 4" — a gap of three characters, not the ten a longer number gets)
    // or after "NO." ("NO. 8"), and never before RAIL / GAUGE / WHEEL / VOLT …
    // It must still exist in the stamped catalogue (fm below), and it never
    // outranks a confirmed number of two or more digits (the matched step).
    var _oneDigit = {};
    (function () {
      var MAKER1 = '(?:[LI1][I1L]?[O0]NEL|LI[O0]NE)';
      var NOT_UNIT = '(?![0-9A-Z]|\\s*-?\\s*(?:RAIL|GAUGE|WHEEL|AXLE|VOLT|WATT|AMP|INCH|IN\\b|PC|PIECE|CAR|TRUCK|SPEED|WAY))';
      var re1 = new RegExp('(?:' + MAKER1 + '(?:[ ]?LINES)?[^0-9A-Z]{0,3}|(?:^|[^A-Z])NO\\.?\\s?)(\\d[A-Z]?)' + NOT_UNIT, 'g');
      var m1;
      while ((m1 = re1.exec(UP))) { _oneDigit[m1[1]] = 1; namedByMaker[m1[1]] = 1; }
    })();

    // ══ ROAD NUMBERS AND WEIGHTS ARE TOO LONG TO BE CATALOG NUMBERS ════════
    // Postwar and prewar Lionel numbers top out at four digits — 6464 is about
    // as long as they get — so on a photo stamped as one of those eras, a bare
    // five- or six-digit number is never the answer. 25000 (a road number that
    // also happens to exist in the catalog as a Mathematics Set), 100000 and
    // 128300 all fail here. MPC, MTH and the rest genuinely use longer numbers
    // and are deliberately left alone.
    var MAX_PLAIN_DIGITS = { prewar: 4, pw: 4 };
    // v0.9.1167: the cap applies when EVERY era the filter covers has one —
    // take the most permissive. A single covered era behaves exactly as before.
    var digitCap = (function () {
      var es = _prefEras(prefer);
      if (!es.length) return 0;
      var mx = 0;
      for (var i = 0; i < es.length; i++) {
        var c = MAX_PLAIN_DIGITS[es[i]];
        if (!c) return 0;                           // one uncapped era = no cap
        if (c > mx) mx = c;
      }
      return mx;
    })();

    // v0.9.1084 — this shape means different things in different catalogs.
    // "5-54" on a postwar car is a build date. "6-16661" is a real modern Lionel
    // SKU. Banning it everywhere would make MPC and MTH items unidentifiable, so
    // it only applies where such a number cannot be a catalog number — the same
    // eras that cap plain numbers at four digits.
    // Allowed ONLY on a photo stamped as an era that genuinely uses the format —
    // Lionel MPC (6-16661), MTH (20-xxxxx). On a postwar or prewar photo, and on
    // an UNSTAMPED one, it stays banned: without an era we cannot tell a build
    // date from a modern SKU, and defaulting to "date" is what keeps 5-54 out.
    var _shortDashOk = !!(_prefEras(prefer).length && !digitCap);   // v0.9.1167
    var isBuildDate = function (c) { return !_shortDashOk && /^\d{1,2}-\d+$/.test(c); };
    // CAPACITY AND LOAD LIMIT. The audit confirmed "40200" on five different
    // cars, plus 48200 and 25000. Those are the CAPY / LD LMT stamps printed on
    // the side of every freight car — genuinely on the item, genuinely in some
    // catalog somewhere, and never what the user is looking at. Same shape as
    // the build-date problem, different costume.
    // v0.9.1975 (Brad's 6556 M-K-T stock car): CU FT (cubic feet, "CU FT 2111")
    // is the same kind of stencil — a size, never an item number.
    var reCap = /(?:CAPY|CAP'?Y|LD\s*LMT|LDLMT|LT\s*WT|LTWT|WT\s*LMT|CAPACITY|CU\s*FT|CUFT)[^0-9]{0,10}(\d{3,7})/g;
    var capStamp = {};
    while ((m = reCap.exec(UP))) { capStamp[m[1]] = 1; }
    var toks = (UP.match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g) || [])
      .map(function (c) { return c.replace(/^-+|-+$/g, ''); })
      .filter(function (c) {
        if (!/\d/.test(c) || c.length < 2 || c.length > 10) return false;
        if (banned[c]) return false;                            // copyright year, not a catalog number
        if (isBuildDate(c)) return false;                       // "BLT 5-54" — a date, not an item
        if (capStamp[c.replace(/\D/g, '')]) return false;        // "CAPY 40200" — a weight, not an item
        if (_isRejected(c)) { if (_rejSeen.indexOf(c) < 0) _rejSeen.push(c); return false; }   // the user already said this is wrong
        // v0.9.1071: the weight block on a freight car reads CAPY 103000,
        // LD LMT 129300, LT WT 40200 — and OCR garbles those labels often
        // enough that keyword matching alone misses them. No Lionel catalog
        // number has six or more digits, so on a Lionel-stamped photo they are
        // never the answer regardless of what the label came out as.
        // The era-aware ceiling replaces the blunt six-digit rule.
        if (digitCap && c.indexOf('-') < 0 && c.replace(/\D/g, '').length > digitCap) return false;
        if (!digitCap && _prefEras(prefer).length && /^\d{6,}$/.test(c)) return false;   // v0.9.1167
        var digits = c.replace(/\D/g, '');
        var alnum = c.replace(/[^0-9A-Za-z]/g, '');
        if (digits.length < alnum.length * 0.6) return false;   // mostly letters = junk (e.g. "4LIONEL", "MADE")
        if (digits.length >= 8 && c.indexOf('-') < 0) return false;   // UPC / barcode run
        return true;
      });
    var seen = {}, uniq = [];
    toks.forEach(function (c) { if (!seen[c]) { seen[c] = 1; uniq.push(c); } });
    Object.keys(_oneDigit).forEach(function (c) {   // v0.9.1901: after every longer token
      if (!seen[c] && !_isRejected(c)) { seen[c] = 1; uniq.push(c); }
    });
    // v0.9.1069 — THE ERA IS NOW A FILTER, not a tiebreak. Brad's idea, taken
    // one step on. Until now a token counted as confirmed if it existed in ANY
    // catalog, which is how a capacity stamp on a Lionel Postwar car "confirmed"
    // against something in another maker's list. If the photo says which catalog
    // it belongs to, a number that is not in THAT catalog is not a confirmation.
    //
    // The real prize is not the rejection — it is what happens next. A rejected
    // token falls through and the NEXT candidate in the same text gets its turn,
    // which is often the number actually printed on the item. It turns a wrong
    // answer into a right one rather than into a blank.
    // v0.9.1093 (Brad: "why are we matching to set item numbers"). His 6817
    // scraper came back "1545 — 027 Diesel Freight Set" and his 6817 earlier
    // hit "1615 — Cannonball Express Set". The master list indexes SET rows
    // alongside item rows, and text scraped off a photo was allowed to confirm
    // against them. A number painted on a car is an ITEM number — set numbers
    // live on boxes and paperwork, not on rolling stock. Set rows are invisible
    // to the free reader's validation now. (The PAID reader is untouched: it
    // sees the photo, and a photo genuinely can be of a boxed set.)
    var _isSetRow = _pinIsSetRow;   // v0.9.1094: hoisted — three indexes share it now
    // ══ v0.9.1733 — "…AND PAPERWORK", the other half of the v1094 sentence ══
    // The note above says it outright: "set numbers live on boxes and paperwork,
    // not on rolling stock." Sets were made invisible to the free reader's
    // validation; BOXES never were, and it shows on Brad's real inbox. A photo
    // reading 6462 came back "Paper / Box / Misc — NYC Gondola": the plain 6462
    // exists in Lionel Postwar ONLY as a box, while the seven real gondolas are
    // filed 6462-1, 6462-25, 6462-100, 6462-125, 6462-50, 6462-500. Same for
    // 6436 and 6476.
    //
    // Nothing is missing from the catalog and nothing needs picking here. The
    // file already has the right answer one step further down: _pinFamilyPick
    // asks whether a seen number HEADS A DASHED FAMILY and offers the variants
    // for a human to settle (rrDashedKin's own rule — "callers offer; the human
    // decides", because choosing among seven would be the number-only
    // first-find bug wearing a new hat). That path never ran, because the box
    // row answered first and looked like a hit.
    //
    // So a box/paper row stops being an answer for a number read off a MODEL,
    // exactly as a set row already does, and 6462 falls through to the family
    // offer. The kind is read through getTypeBucket, the same single source of
    // truth v1731 uses, so Box / Box Reference / Form / Service Manual are all
    // covered without a private list here.
    //
    // Unless, of course, the photo IS of paperwork: a photo tagged Paper, Box
    // or Catalog keeps the old behaviour, so scanning a box individually still
    // finds the box. (The BATCH reader skips paper-tagged photos entirely —
    // v0.9.1340 — so this only affects a deliberate single scan.)
    //
    // "Is this a real item row?" is NOT re-answered here. _pinDemotedRow above
    // already is that answer — "box, set, paper, catalog, display and
    // instruction rows alike", quoted from v0.9.1444, shared with browse.js as
    // window.rrDemotedRow and with the relatives panel. A second opinion in
    // this file is how this project produced eight bugs from one fact; the
    // first draft of THIS change reached for getTypeBucket and would have been
    // the ninth (and would have silently no-opped, since getTypeBucket is not
    // in the reader's scope in every harness).
    var _photoIsPaper = false;
    try {
      var _ptK = String((prefer && (prefer.type || prefer.itemType)) || '').trim();
      if (_ptK) _photoIsPaper = _pinDemotedRow({ itemType: _ptK });
      // and the group kind, which is how a box photo says it is a box
      if (!_photoIsPaper && /^(box|paper)$/i.test(String((prefer && prefer.kind) || ''))) _photoIsPaper = true;
    } catch (ePT) {}
    var _isPaperRow = function (row) {
      if (!row || _photoIsPaper) return false;
      // _isSetRow is already applied beside this one; this is the rest of the
      // same sentence — the box and paperwork half.
      try { return _pinDemotedRow(row) && !_isSetRow(row); } catch (eP) { return false; }
    };
    // v0.9.1168 — THE CHOKEPOINT for a rejected answer. Filtering the producers
    // was whack-a-mole: the token list, the maker-adjacent scan, the whole-run
    // reconstruction and the sliding-window slicer each build candidates their own
    // way, and a rejected number kept reappearing through whichever one had not
    // been patched yet. But every one of them has to come THROUGH here to become an
    // answer, because this is the only thing that turns digits into a catalog row.
    // One guard here covers direct hits, joins, windows, dash repairs, the hedge
    // and the quote match — and any path added later gets it for free.
    var fmAny = (typeof findMaster === 'function')
      ? function (c) {
          if (_isRejected(c)) return null;
          var r = findMaster(c, null, prefer || null);
          return (r && !_isSetRow(r) && !_isPaperRow(r)) ? r : null;
        }
      : null;
    // v0.9.1167 (Brad: "if i once again tell you its a lionel, don't suggest to
    // me atlas"). THE FIFTH COPY of the single-era gate, and the one that was
    // still live. His chips were Lionel / O / Modern, but when a filter covers
    // more than one era `prefer.era` is '' — so this returned true for EVERY row,
    // every catalog counted, and a number assembled out of OCR fragments went
    // shopping until some maker's list accepted it. His MKT steam locomotive came
    // back "2500 — Atlas Undecorated (Low Nose)", and the disclosure said so in
    // as many words: "Photo is stamped: nothing — no era filter applied".
    //
    // v0.9.1165 widened four of these gates and missed this one. Fifth place,
    // same class, enumerated from source this time.
    var _inEraSet = _prefEras(prefer);
    var inEra = function (row) {
      if (!_inEraSet.length) return true;           // genuinely unfiltered — old behaviour
      return !!(row && _inEraSet.indexOf(row._era) >= 0);
    };
    // ══ v0.9.1886 / v0.9.1887 — THE LETTER STAMPED ON THE CAR, READ AS STAMPED ══
    // Brad's Baby Ruth boxcar is lettered X6014 BUILT BY LIONEL. The token
    // scan above starts every token at a DIGIT, so the X was dropped before
    // the catalogue was asked, and 6014 (Chun King) answered. v1885 made X6014
    // a relative in the pick list; this keeps the letter in the READ itself.
    // The rule is the same one, so the two can never disagree: the letter
    // counts only when the catalogue spells the number that way (measured
    // 2026-10-05: for Lionel that letter is X and only X; other makers'
    // letters are product codes), only in the stamped catalogue, and only
    // where that SAME catalogue holds the plain number too (Weaver's U1001 is
    // not a Lionel 1001; X6454 with no plain Lionel 6454 is findMaster's own
    // v1730 bridge). Never a list of letters to try.
    //
    // Two ways the letter arrives (v1887, from the disclosure on Brad's own
    // re-scan): GLUED — "X6014" in a full-alphabet pass (a letter standing
    // alone before the digits; "NO6014" and "BOX6014" do not count); and AS A
    // DIGIT — the digits-only passes cannot output a letter, so the X came
    // back as "16014": one digit longer than the stamped era allows, whose
    // tail the catalogue spells with a letter. Only the catalogue's own
    // spelling is used for that, and only when it has exactly one.
    //
    // A plain number the user has marked wrong ("not the Chun King 6014") is
    // still a lead to its lettered twin — the mark was on that product, and
    // X6014 is another. The spelling is placed before its digits.
    var _lettered = [];
    (function () {
      if (!fmAny) return;
      var leads = [], seenL = {};
      var reL = /(?:^|[^A-Z0-9])([A-Z])(\d{2,6})(?![\dA-Z-])/g, mm;
      while ((mm = reL.exec(UP))) leads.push({ d: mm[2], spelled: mm[1] + mm[2], how: 'read' });
      if (digitCap) {
        var reD = new RegExp('(?:^|[^A-Z0-9])\\d(\\d{' + digitCap + '})(?![\\dA-Z-])', 'g');
        while ((mm = reD.exec(UP))) leads.push({ d: mm[1], spelled: '', how: 'digit' });
      }
      leads.forEach(function (L) {
        var d = L.d;
        var known = uniq.indexOf(d) >= 0 || _rejSeen.indexOf(d) >= 0 || L.how === 'digit';
        if (!known) return;
        // the catalogue (era) that holds the plain number — never reject-gated
        var plainRows = [];
        try { plainRows = (typeof _pinKinRowsFor === 'function') ? (_pinKinRowsFor(d) || []) : []; } catch (eK) { plainRows = []; }
        var rP = null; try { rP = findMaster(d, null, prefer || null); } catch (eF) {}
        if (rP) plainRows = plainRows.concat([rP]);
        var plainEras = {};
        plainRows.forEach(function (rK) { if (rK && inEra(rK)) plainEras[String(rK._era || '')] = 1; });
        if (!Object.keys(plainEras).length) return;
        var spellings = L.spelled ? [L.spelled] : [];
        if (!L.spelled && typeof _letterKinRows === 'function') {
          try {
            var seenS = {};
            _letterKinRows((window.state && state.masterByItem) || null, d).forEach(function (rK) {
              if (rK && plainEras[String(rK._era || '')] && !seenS[String(rK.itemNum)]) { seenS[String(rK.itemNum)] = 1; spellings.push(String(rK.itemNum).toUpperCase()); }
            });
          } catch (eS) {}
          if (spellings.length !== 1) return;   // the catalogue must be unambiguous when the letter was not read
        }
        spellings.forEach(function (spelled) {
          if (seenL[spelled] || uniq.indexOf(spelled) >= 0) return;
          var rL = fmAny(spelled);
          if (!rL || String(rL.itemNum || '').toUpperCase() !== spelled) return;   // only a spelling the catalogue has
          if (!inEra(rL) || !plainEras[String(rL._era || '')]) return;              // in the stamped catalogue, beside its plain twin
          seenL[spelled] = 1;
          var at = uniq.indexOf(d);
          if (at >= 0) uniq.splice(at, 0, spelled); else uniq.unshift(spelled);     // the letter spelling leads its digits
          if (namedByMaker[d]) namedByMaker[spelled] = 1;                            // "X6014 BUILT BY LIONEL" names both
          _lettered.push(spelled);
        });
      });
    })();
    // v0.9.1167 — THE CAP FOLLOWS THE CANDIDATE'S ERA, not the filter's.
    // Brad's A.T.&S.F. gondola is stamped CAPY 100000 / LD LMT 120000 / LT WT
    // 40200, and it came back "40200 — Atlas N UNDECORATED (ADM/MCP)". The rule
    // meant to stop that is MAX_PLAIN_DIGITS ({prewar:4, pw:4}): no Lionel
    // pre-war or postwar catalog number has five plain digits, so a five-digit
    // run on such a car is a weight, never the item. But it was keyed on
    // prefer.era — one era — so a filter covering two eras switched it off, and
    // the keyword rule above it could not help either because OCR had shredded
    // the words "LT WT" into "- 4 - - - - -".
    //
    // Asking the CANDIDATE's own row instead needs no filter at all: if the row
    // this number would match is pre-war or postwar Lionel, a five-digit plain
    // number cannot be it, whatever the user is filtered to.
    // v0.9.1167 (Brad: "if i once again tell you its a lionel, don't suggest to
    // me atlas"). An off-era LEAD is a genuinely useful offer WITHIN a maker: a
    // postwar number read off a car while the user sits in Lionel Modern is worth
    // putting in front of them. Across makers it is noise in an answer's clothes.
    // His MKT locomotive was handed "2500 — Atlas O (Low Nose)" and his
    // A.T.&S.F. gondola "40200 — Atlas N (ADM/MCP)", each because the digits
    // existed in SOME catalog. If the filter names a maker, another maker's row is
    // not a lead — it is a different product that happens to share a number.
    var _sameMakerAsFilter = function (row) {
      var want = String((prefer && prefer.manufacturer) || '').toLowerCase().trim();
      if (!want) return true;                       // no maker named — nothing to contradict
      var got = '';
      try {
        if (typeof _manufacturerOfEra === 'function') {
          got = String(_manufacturerOfEra(row && row._era) || '').toLowerCase();
        }
      } catch (e) {}
      if (!got && row && row._tab) got = String(row._tab).toLowerCase().split(' ')[0];
      if (!got) return true;                        // unknown maker — never hide on a guess
      return got === want || got.indexOf(want) === 0 || want.indexOf(got) === 0;
    };
    var _capForRow = function (row, c) {
      if (!row || !row._era) return false;
      var cap = MAX_PLAIN_DIGITS[row._era];
      if (!cap) return false;
      var plain = String(c || '');
      if (plain.indexOf('-') >= 0) return false;      // dashed numbers are catalog-shaped
      return plain.replace(/\D/g, '').length > cap;
    };
    var fm = fmAny ? function (c) {
      var r = fmAny(c);
      if (!r || !inEra(r)) return null;
      if (_capForRow(r, c)) return null;              // a weight stamp, not a catalog number
      return r;
    } : null;
    // v0.9.1065 — short tokens are a LEAD, never a fact. Catalog backing is
    // too weak a filter for them on its own: the audit turned stray markings
    // into 13, 20, 25, 40, 50, 53 and 77, and Lionel has real items at every
    // one of those numbers, so each was reported as confirmed. They are kept
    // (Brad's Great Northern 58 is genuine) but only when nothing longer was
    // found, and they are always returned as a best guess for a human to
    // accept — never stated as certain.
    var shortOnes = uniq.filter(function (c) {
      return c.replace(/\D/g, '').length < 3 && fm && fm(c);
    });
    // v0.9.1078: a short number is weak because it could be anything — but not
    // when the maker stamped its own name beside it. "LIONEL 50" on Brad's gang
    // car is as strong a statement as a car can make, and it was being demoted
    // to a hedge purely for being two digits. Promote those back.
    uniq = uniq.filter(function (c) {
      if (c.replace(/\D/g, '').length >= 3) return true;
      return !!namedByMaker[c];
    });
    shortOnes = shortOnes.filter(function (c) { return !namedByMaker[c]; });
    var dashRank = function (a, b) {
      return (b.indexOf('-') >= 0 ? 1 : 0) - (a.indexOf('-') >= 0 ? 1 : 0) || b.length - a.length;
    };
    // v0.9.1070 — say WHY. Brad re-read a Santa Fe 2412 and it still came back
    // as an MPC set number, and I could not tell from the outside whether the
    // era filter had run, whether the photo was stamped at all, or whether the
    // right number had even been a candidate. Guessing at that from screenshots
    // is what this whole audit was supposed to replace. Every read now carries
    // its own reasoning.
    // ══ v0.9.1076c — HOW MUCH DID IT ACTUALLY READ? ════════════════════════
    // Brad's 2408 Santa Fe car produced the entire text "-600 2" and the app
    // reported No. 600, NW2 Switcher, as a finding. His M&StL boxcar produced
    // "- 7 - 5 - 1001- - 4 - 0" and got 1001, a steam locomotive. Both numbers
    // are real postwar items, so both confirmed. But a catalog hit inside four
    // characters of noise is a coincidence, not a reading — with a few thousand
    // numbers in the catalog, almost any stray digits land on one.
    //
    // So a match needs some corroboration around it. Below this much recovered
    // text the answer is still offered, as a guess for a human to accept, but it
    // is never stated as fact.
    var evidence = UP.replace(/[^0-9A-Z]/g, '').length;
    // ══ v0.9.1168 — NOTHING WAS READ, SO NOTHING IS THE ANSWER ═════════════
    // Brad's MKT 0-8-0 carries no lettering at all: the herald is a graphic, the
    // cab number is a decal the OCR broke up, and the recovered text was
    //   "- -- -- 3 43 -- - - 9 7 - - - 4 - - - - - 3 10 --- - 5 - 4 ... 2 2500 ..."
    // Eighteen characters, not one of them a LETTER. The re-scan said "No number
    // picked up automatically" — correct — and then a later pass joined scattered
    // digits into 2233810, seven digits that happen to be a real Lionel row (an
    // AT&SF F7 A-A set). Right maker, so v0.9.1167's refusal cannot catch it;
    // completely the wrong item.
    //
    // A catalog number printed on a model never sits alone. LIONEL, a road name,
    // BLT, CAPY, NEW — something lettered is always beside it, and the same OCR
    // that can resolve the digits can resolve those. Text with NO letters in it
    // means nothing was truly read, only artifacts of light and shadow, and a
    // number assembled from artifacts is an artifact.
    //
    // Brad said it plainly: "I know there is not text on here to read and don't
    // expect it to get it right." Saying so IS the answer, and it costs him one
    // step (type it, or spend a read) instead of five spent unpicking a confident
    // wrong item.
    var _noLetters = !/[A-Z]/.test(UP);
    var THIN = 18;

    var dbg = {
      era: (prefer && prefer.era) || '',
      evidence: evidence,
      cand: uniq.slice(0, 8),
      shortCand: shortOnes.slice(0, 5),
      inEra: [],
      offEra: [],
      joined: '',
      viaMaker: '',
      // v0.9.1277: the marks are invisible nowhere now — every read narrates
      // what the user has excluded, because a silent exclusion of the RIGHT
      // answer reads exactly like a wrong reader.
      rejectedList: ((prefer && prefer.reject) || []).slice(0, 6),
      lettered: _lettered.slice(0, 3),   // v0.9.1886: the letter kept as stamped (X6014)
    };
    uniq.slice(0, 8).forEach(function (c) {
      var any = fmAny ? fmAny(c) : null;
      if (!any) return;
      (inEra(any) ? dbg.inEra : dbg.offEra).push(c + (any._era ? ':' + any._era : ''));
    });
    // v0.9.1071 — SPLIT NUMBERS. Brad: "this is a hard number to read because
    // the number is 3562-1 and its split on the car." He was describing the
    // mechanism exactly, and the raw text proved it. On that ATSF gondola the
    // reader saw:
    //
    //     ... CAPY 100000  3 3 5 6 2 1  LD LMT 128000 ...
    //
    // The number is stamped across separate raised panels, so it arrives as six
    // SINGLE DIGITS. Every one of them is discarded before any catalog lookup —
    // a lone "3" is not a token worth considering — so 3562-1 never had a
    // chance, however sharp the photo. No amount of image processing fixes this;
    // the characters were read correctly and then thrown away.
    //
    // So: take runs of digits separated only by spaces, close them up, and try
    // every contiguous window of catalog-plausible length, exact and then
    // dash-repaired. "3 3 5 6 2 1" closes to 335621, whose window 35621 repairs
    // to 3562-1, which the catalog knows. Only ever accepted on an exact hit in
    // the stamped catalog, so this recovers numbers that were already there and
    // cannot invent one.
    var joined = [];
    (function () {
      var runs = UP.match(/\d(?:[ \t]?\d){3,11}/g) || [];
      runs.forEach(function (run) {
        var d = run.replace(/\D/g, '');
        if (!d || d.length < 4) return;
        if (capStamp[d] || banned[d]) return;         // a weight or a copyright year
        for (var len = Math.min(8, d.length); len >= 4; len--) {
          for (var st = 0; st + len <= d.length; st++) {
            var w = d.substr(st, len);
            // v0.9.1076b: the join was bypassing every guard the direct path
            // has. On Brad's Lehigh Valley hopper it reassembled the ROAD
            // NUMBER 25000 out of "LEY 25000" and won on length, after the
            // ordinary filters had correctly thrown that very number away.
            // A recovery route must not be a way around the rules.
            if (capStamp[w] || banned[w]) continue;
            if (joined.indexOf(w) < 0) joined.push(w);
          }
        }
      });
    })();

    // v0.9.1072b — ORDER MATTERS, and I had it wrong. On Brad's ATSF gondola the
    // reader saw "... 35 621 ..." and the direct match ran first, so "621" — the
    // tail half of 3562-1, sitting on its own panel — was accepted as a catalog
    // number before the joining step was ever reached. A fragment that happens
    // to exist in the catalog beat the complete number it was part of.
    //
    // Both are computed now and the LONGER confirmed number wins. That is the
    // right tie-break on its own terms: 3562-1 is more specific than 621, and a
    // catalog hit on more digits is far less likely to be a coincidence.
    var direct = null;
    var matched = uniq.filter(function (c) { return fm && (fm(c) || fm(c.replace(/^\d-/, ''))); });
    // v0.9.1901: a one-digit lead counts only when nothing longer was confirmed.
    if (matched.some(function (c) { return !_oneDigit[c]; })) matched = matched.filter(function (c) { return !_oneDigit[c]; });
    if (matched.length) {
      // A number the maker put its own name beside outranks everything, before
      // any length or specificity tie-break gets a say. Length was deciding this
      // and length is meaningless between two unrelated numbers — it picked the
      // road number 25000 over the catalog number 6176 purely for being longer.
      var named = matched.filter(function (c) { return namedByMaker[c]; });
      // v0.9.1887: the letter stamped on the car is the same kind of evidence
      // as the maker's name beside the number — a spelling only that product
      // carries, confirmed by the catalogue. It outranks a plain number read
      // more often (Brad's Baby Ruth: "153" off a dimension line read once,
      // X6014 from "16014" in the digits pass — the count would have picked
      // the block signal).
      var letteredHit = matched.filter(function (c) { return _lettered.indexOf(c) >= 0; });
      if (named.length) { named.sort(dashRank); direct = named[0]; dbg.viaMaker = direct; }
      else if (letteredHit.length) { letteredHit.sort(dashRank); direct = letteredHit[0]; dbg.viaLetter = direct; }
      else {
        matched.sort(dashRank);
        // v0.9.1104 (Brad's 6816 asserted as "1043 — Transformer"): BOTH were
        // valid in-era candidates. 6816 was read three times — twice by the
        // light-numbers pass, straight off the car — while 1043 appeared once,
        // inside the catalog page pinned to the wall above the shelf. The
        // tiebreak was position in the text. Evidence decides now: the
        // candidate read MOST OFTEN wins; dashRank still breaks real ties.
        var _bestC = matched[0], _bestF = -1;
        matched.forEach(function (cD) {
          var _lit = cD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var _f = (UP.match(new RegExp('\\b' + _lit + '\\b', 'g')) || []).length;
          if (_f > _bestF) { _bestF = _f; _bestC = cD; }
        });
        if (_bestC !== matched[0]) dbg.freqPick = _bestC + ' (read ' + _bestF + '\u00d7)';
        direct = _bestC;
      }
    }

    // ══ v0.9.1079 — one misread digit ══════════════════════════════════════
    // Brad, on his Boston & Maine boxcar: "i see where it read 5 instead of 6.
    // so it says 5464475 instead of 6464475. we may need to look at a number
    // being off like 5 and 6 or 5 and 8." Exactly right, and the fix is narrow
    // enough to be safe: try changing ONE character to something it is commonly
    // confused with, and accept only an exact catalog hit. A single substitution
    // on a seven-digit run is about fifteen candidates — cheap — while allowing
    // two would let almost anything become almost anything.
    var _OCR_CONFUSE = {
      '0': '68', '1': '7', '2': '7', '3': '8', '4': '9',
      '5': '68', '6': '58', '7': '1', '8': '360', '9': '4',
    };
    function _oneOffVariants(d) {
      var out = [];
      for (var i = 0; i < d.length; i++) {
        var alt = _OCR_CONFUSE[d[i]];
        if (!alt) continue;
        for (var j = 0; j < alt.length; j++) {
          out.push(d.slice(0, i) + alt[j] + d.slice(i + 1));
        }
      }
      return out;
    }
    // v0.9.1097 (Brad's 6175 asserted as "1523 — Diesel Freight Set, 81"):
    // the v0.9.1093 set exclusion keys on the tab name, but Brad's workbook
    // also carries set rows INSIDE the items list, where the tab cannot give
    // them away. Their own descriptions can. A RECONSTRUCTED number — glued
    // from scattered digits, windowed, or one-digit-repaired — must not
    // validate against a row that describes a boxed outfit; set numbers live
    // on boxes and paperwork, not stamped on rolling stock. Direct tokens
    // are deliberately untouched: "110" painted on a box lid is a legitimate
    // direct read even though its row says "Trestle Set".
    var fmJoin = fm ? function (c) {
      var row = fm(c);
      if (!row) return null;
      if (/\b(set|outfit)\b/i.test(String(row.description || ''))) return null;
      return row;
    } : null;

    // Exact, then dash-repaired, for one candidate string.
    function _tryNumber(d) {
      if (!fmJoin) return null;
      if ((!digitCap || d.length <= digitCap) && fmJoin(d)) return d;
      for (var cut = 3; cut <= 4; cut++) {
        if (d.length <= cut) continue;
        var cand = d.slice(0, cut) + '-' + d.slice(cut);
        if (fmJoin(cand)) return cand;
      }
      return null;
    }

    var jHit = null, wholeRuns = [], _jSrc = '';
    // Whole runs first, and a one-character repair of them, BEFORE any window.
    // Order matters: "5464475" cut into windows yields "6447", a real postwar
    // caboose, and it was winning over the boxcar the car actually is. A
    // complete number with one digit corrected beats a fragment of it.
    if (fm) {
      // v0.9.1168: remember HOW each run was obtained. An unbroken run of digits
      // was genuinely read — Brad's "5464475" is 6464-475 with one digit misread,
      // and repairing it is the whole point of this path. A run glued together
      // across gaps is a different animal: on his MKT locomotive, scattered
      // singles and pairs were welded into 2233810, a real Lionel row and utterly
      // the wrong item. Same code path, opposite trustworthiness.
      var _runSrc = {};
      var _addRun = function (d, src) {
        if (d && d.length >= 4 && d.length <= 12 && !capStamp[d] && !banned[d]
            && wholeRuns.indexOf(d) < 0) { wholeRuns.push(d); _runSrc[d] = src; }
      };
      // An UNBROKEN digit token first — that is the printed number when the
      // reader managed to keep it together, and it is what "5464475" is. Only
      // then the space-joined runs, which on this car swallow the neighbouring
      // "0 20" and produce a ten-digit string matching nothing.
      (UP.match(/\d+/g) || []).forEach(function (d) { _addRun(d, 'solid'); });
      (UP.match(/\d(?:[ \t]?\d){3,11}/g) || []).forEach(function (run) {
        _addRun(run.replace(/\D/g, ''), 'glued');
      });
      wholeRuns.some(function (d) {
        jHit = _tryNumber(d);
        if (jHit) _jSrc = _runSrc[d] || '';
        return !!jHit;
      });
      if (!jHit) {
        wholeRuns.some(function (d) {
          // ══ v0.9.1088 — two gates the repair badly needed ══════════════════
          // Brad's 6817 scraper flatcar: the reader never saw 6817. It read the
          // catalog page pinned to the WALL — 1015, 110, 108, 950 — all off-era,
          // all correctly rejected. Then this repair took 1015, a real prewar
          // transformer it had read PERFECTLY, changed one digit, landed on
          // 1615 in the stamped catalog, and called it confirmed. "Cannonball
          // Express Set", from a wall poster, presented as fact.
          //
          // Gate 1: never mutate a number that exists in ANY catalog. A token
          // that is a real item somewhere was almost certainly read correctly —
          // it is just not THIS item. Correcting a correct reading is
          // manufacturing evidence.
          if (fmAny && (fmAny(d) || (d.length > 4 && fmAny(d.slice(0, 4))))) return false;
          // Gate 2: four digits with one changed is three digits of evidence —
          // and with thousands of catalog numbers, some variant nearly always
          // lands on one. Five or more digits (5464475 \u2192 6464-475, the case
          // this was built for) is specific enough to trust.
          if (d.length < 5) return false;
          return _oneOffVariants(d).some(function (v) {
            var hit = _tryNumber(v);
            // v0.9.1305: a repair inherits its run's trustworthiness \u2014 a
            // solid run with one digit corrected is still a number that was
            // READ (5464475 \u2192 6464-475); only gluing makes it ASSEMBLED.
            if (hit) { jHit = hit; _jSrc = _runSrc[d] || ''; dbg.oneOff = d + ' \u2192 ' + hit; return true; }
            return false;
          });
        });
      }
    }
    var wHits = [];
    if (fm && !jHit && joined.length) {
      // v0.9.1093 (Brad's Summit car): the reader saw "12446" — 2446 with one
      // junk digit in front. The window search tried 1244 before 2446, both are
      // real postwar items, and the first won by position alone. Two windows of
      // one run both existing in the catalog is AMBIGUITY: all hits are
      // collected, exactly one confirms, several become a guess with the
      // choices offered as chips for a human to settle.
      joined.forEach(function (d) {
        if (wHits.length >= 4) return;
        // A BARE reassembled number must obey the same length ceiling as any
        // other; a DASH-REPAIRED one may exceed it (3562-1, 6464-475).
        // v0.9.1097: windows are reconstructions too — same no-set-rows check.
        if ((!digitCap || d.length <= digitCap) && fmJoin(d)) {
          if (wHits.indexOf(d) < 0) wHits.push(d);
          return;
        }
        for (var cut = 3; cut <= 4; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fmJoin(cand)) { if (wHits.indexOf(cand) < 0) wHits.push(cand); return; }
        }
      });
      if (wHits.length === 1) jHit = wHits[0];
    }
    dbg.joinTried = joined.slice(0, 10);
    if (jHit) dbg.joined = jHit;
    if (!jHit && wHits.length > 1) {
      dbg.windowAmbig = wHits.join(', ');
      // ══ v0.9.1105 — a number READ beats numbers GLUED (Brad's Modern 6817) ═
      // The windows assembled 38994 and 9475 from scattered digits, while the
      // car's own number — 6817, read twice, a real item in ANOTHER era's
      // catalog — sat parked as an off-era lead and never got its turn,
      // because the ambiguous-windows return fired first. A directly-read
      // off-era token now outranks reconstructions: the tag settles it when
      // the catalog quotes it (v0.9.1089), and otherwise it leads the pick —
      // Brad's own rule: "say its a modern 6817 or its a postwar 6817 and
      // let the user pick."
      var _offLead = null;
      if (fmAny && fm) {
        for (var oi = 0; oi < uniq.length; oi++) {
          var oc = uniq[oi];
          if (fm(oc)) continue;
          // v0.9.1167: same maker only. A number that exists solely in another
          // maker's catalog is not a lead the user asked for.
          var _oRow = fmAny(oc) || fmAny(oc.replace(/^\d-/, ''));
          if (_oRow && _sameMakerAsFilter(_oRow)) { _offLead = oc; break; }
        }
      }
      if (_offLead && typeof _pinQuoteMatch === 'function') {
        var _qm3 = _pinQuoteMatch(_offLead, prefer, dbg);
        if (_qm3 && _qm3.row && _qm3.row.itemNum) {
          dbg.quoted = _offLead + ' \u2192 ' + _qm3.row.itemNum;
          return { num: String(_qm3.row.itemNum), matched: true, viaQuote: _offLead, dbg: dbg };
        }
      }
      // ══ v0.9.1831 — THE FAMILY THE CAR NAMES OUTRANKS ANOTHER CATALOG'S LEAD ═
      // Brad's Great Northern boxcar, 2026-09-28, on his phone: "Numbers seen:
      // 6464, 2300, 3727, 523" and the answer was "2300 — Operating Oil Drum
      // Loader" from the MPC list. 6464 was read off the car, it heads 196
      // dashed relatives in the stamped catalog, and GREAT NORTHERN sat right
      // beside it — but this branch conceded to another era's catalog (the
      // v1105 off-era lead) before the v1448 family question, one step below,
      // was ever asked. The same ordering fault v1772 fixed for glued dashes,
      // one branch up. A quote-confirmed lead (above) still wins: that is a
      // match, not a lead. An unconfirmed lead does not beat the car.
      var _famAmb = _pinReadFamily(uniq, prefer, UP, dbg);
      if (_famAmb && (_famAmb.why || (_famAmb.tied && _famAmb.tied.length))) {
        dbg.familyOverLead = _offLead ? String(_offLead) : '';
        return { num: _famAmb.num, matched: false, family: true,
                 alts: (_famAmb.tied && _famAmb.tied.length)
                         ? _famAmb.tied.slice(0, 6)
                         : [String(_famAmb.num)], dbg: dbg };
      }
      if (_offLead) {
        dbg.offEraLead = _offLead;
        return { num: _offLead, matched: false, offEra: true,
                 alts: [String(_offLead)].concat(wHits.slice(0, 3)), dbg: dbg };
      }
      return { num: wHits[0], matched: false, alts: wHits.slice(0), dbg: dbg };
    }

    var digitsOf = function (x) { return String(x || '').replace(/\D/g, '').length; };
    // v0.9.1168: no letters anywhere = no reading happened. Report that, and keep
    // the reasoning on dbg so the disclosure expander can show what it saw.
    // (Deliberately not quoting the expander's wording here — a comment naming a
    // UI string gets counted as code by the tests that assert how many copies of
    // that string exist. Seventh time that class has bitten on 2026-07-30.)
    if (_noLetters && jHit && _jSrc === 'glued' && !direct && !dbg.viaMaker) {
      dbg.noLetters = String(jHit);
      return { num: '', matched: false, dbg: dbg };
    }
    if (direct || jHit) {
      // v0.9.1277 (Brad's 6561 cable reel car asserted as "1656 — 0-4-0 Steam
      // Locomotive"): the reject list had swallowed 6561 — the number stamped
      // TWICE beside LIONEL LINES, the strongest read in the photo — and the
      // window machinery then assembled 1656, an anagram of those same digits,
      // and stated it as fact. A reconstruction must never be asserted while a
      // maker-named direct read sits silenced on the reject list. Offer it as
      // a guess, and say out loud what the car itself reads.
      var _rejStrong = '';
      for (var _ri = 0; _ri < _rejSeen.length; _ri++) {
        if (namedByMaker[_rejSeen[_ri]]) { _rejStrong = _rejSeen[_ri]; break; }
      }
      if (_rejStrong && !direct && !dbg.viaMaker && jHit) {
        dbg.rejectedStrong = _rejStrong;
        return { num: jHit, matched: false, alts: [String(jHit)], dbg: dbg };
      }
      // Order of authority: what the maker stamped next to its own name, then
      // the more specific of a joined reconstruction and a direct hit. Length
      // only ever breaks a tie between those last two — it is meaningless
      // between two unrelated numbers, which is how a road number won earlier.
      //
      // v0.9.1305 (Brad's New Haven 232 asserted as "1241 — Transformer",
      // "i scanned a few times, its a 232"): longer-wins was built for a
      // fragment and the number that CONTAINS it — 621 losing to 3562-1,
      // the same digits on the same car. His 232 was read off the cab and
      // confirmed in the stamped catalog, then lost to 1241, a number WELDED
      // from scattered stray digits, purely for being one digit longer.
      // Length is meaningless between unrelated numbers — the road-number
      // lesson again. A joined reconstruction now outranks a direct catalog
      // hit only when the direct number is a digit-fragment of it, or when
      // the run was READ unbroken ('solid') rather than glued. "A number
      // READ beats numbers GLUED" (v0.9.1105) — applied to the one corner
      // that never got it.
      var _fragOfJoin = !!(direct && jHit &&
        String(jHit).replace(/\D/g, '').indexOf(String(direct).replace(/\D/g, '')) >= 0);
      var win;
      if (dbg.viaMaker && direct) win = direct;
      else if (jHit && digitsOf(jHit) > digitsOf(direct)
               && (!direct || _jSrc === 'solid' || _fragOfJoin)) win = jHit;
      else {
        win = direct || jHit;
        if (direct && jHit && win === direct && digitsOf(jHit) > digitsOf(direct)) {
          dbg.directOverJoin = String(direct) + ' (read) kept over ' + String(jHit) + ' (assembled)';
        }
      }
      // A number the maker named is trustworthy however little else was read —
      // "LIONEL 6176" is corroboration in itself.
      var solid = (evidence >= THIN) || !!dbg.viaMaker;
      // v0.9.1099 (Brad's 6175 asserted as "225 — Alco Diesel"): the same
      // photo yielded "4225", a four-digit run that matched nothing — strong
      // evidence the real number is LONGER than the three digits being
      // asserted. A short token cannot be stated as fact while a longer run
      // from the same photo went unexplained; it is offered instead.
      if (solid && win === direct && !jHit && !dbg.viaMaker
          && String(direct).replace(/\D/g, '').length <= 3
          && wholeRuns.some(function (dR) { return dR.replace(/\D/g, '').length >= 4; })) {
        dbg.longerUnexplained = wholeRuns[0];
        return { num: win, matched: false, alts: [String(win)], dbg: dbg };
      }
      // v0.9.1099b (Brad's Rio Grande 53 asserted as "988 — Railroad
      // Structure Set", then "213 — Alco Diesel" on re-scan; his 6175 as
      // "225"): with a few thousand catalog numbers, a stray three-digit
      // token lands on a real item too easily to be stated as FACT on one
      // sighting. Seen once → offered as a guess. Read twice or more in the
      // pooled text, or vouched for by the maker's name, it still confirms.
      if (solid && win === direct && !jHit && !dbg.viaMaker
          && String(direct).replace(/\D/g, '').length <= 3) {
        var _dD = String(direct).replace(/\D/g, '');
        var _frD = (UP.match(new RegExp('\\b' + _dD + '\\b', 'g')) || []).length;
        if (_frD < 2) {
          dbg.shortSolo = String(direct);
          return { num: win, matched: false, alts: [String(win)], dbg: dbg };
        }
      }
      // v0.9.1097 (Brad's era-less 3545 asserted as an ATLAS "2501"): with no
      // era stamped on the photo there is no particular catalog to check a
      // reconstruction against — the join found 2501 in a different maker's
      // list entirely and called it fact. A reconstruction validated against
      // "any catalog at all" is a guess; the direct token rides along as the
      // other chip so the user picks between what was actually seen.
      // Only a SHORT reconstruction that DIFFERS from the direct token is
      // demoted: 250+1 glued into 2501 is a coincidence waiting to happen,
      // while 5464475 dash-repaired into 6464-475 is seven digits of evidence,
      // and a jHit that merely re-found the direct token is no join at all.
      // ══ v0.9.1732 — A STAMPED ERA IS NOT CORROBORATION ═══════════════════
      // Brad's Erie boxcar came back "3830 — Flatcar with Operating Submarine"
      // from digits pieced together, on a photo tagged Lionel Postwar. The
      // guard above would have caught it — except for `!prefer.era`. The
      // reasoning in v1097 was that a stamped era gives the reconstruction a
      // particular catalog to answer to. That is true and it is not enough:
      // Lionel Postwar holds thousands of four-digit numbers, so a four-digit
      // window landing on one is MORE likely inside a dense catalog, not less.
      // The era narrows where the coincidence can happen; it does not make it
      // evidence.
      //
      // So the demotion now also applies, era or no era, when the number was
      // not genuinely READ: `_jSrc === 'solid'` marks an unbroken run the
      // reader kept together (5464475), and anything else — welded across
      // gaps, or carved out as a window — is assembled. That is this file's
      // own rule from v1105, "a number READ beats numbers GLUED", applied to
      // the last corner that never got it.
      //
      // A DASH-REPAIRED reconstruction is exempt and stays a fact: the dash
      // has to land where a real catalog family splits (3562-1, 6464-475), and
      // that is structural evidence a bare four-digit window simply does not
      // have. Demoting those would put a question in front of Brad on the
      // cases this machinery was built to get right.
      var _joinIsBare = jHit && String(jHit).indexOf('-') < 0;
      var _joinWasRead = (_jSrc === 'solid');
      if (win === jHit && jHit && String(jHit) !== String(direct || '')
          && String(jHit).replace(/\D/g, '').length <= 5
          && ((!prefer || !prefer.era) || (_joinIsBare && !_joinWasRead))
          && !dbg.viaMaker) {
        var _altsJ = [String(jHit)];
        if (direct && String(direct) !== String(jHit)) _altsJ.push(String(direct));
        if (!prefer || !prefer.era) dbg.noEraJoin = true;
        else dbg.assembledNotRead = String(jHit) + ' was assembled from split digits, not read';
        return { num: win, matched: false, alts: _altsJ, dbg: dbg };
      }
      // ══ v0.9.1772 — A NUMBER READ OFF THE CAR OUTRANKS ONE GLUED TOGETHER,
      // EVEN WHEN THE GLUE LANDS ON A DASH ═══════════════════════════════════
      // Brad's Great Northern, 2026-09-19. The car is stamped G.N. 6464 and the
      // reader SAW it — his own card said "Numbers seen: 6464". But the catalog
      // has no bare 6464 row (0 of 164,820 rows; findMaster('6464') returns
      // null), only 196 dashed variations, so the direct hit died. Meanwhile the
      // join glued digits into 6464-525, the dash-repair exemption above
      // promoted that back to a FACT, and the answer became a Minneapolis & St.
      // Louis boxcar on a car lettered GREAT NORTHERN. The card admitted where
      // it came from: "Numbers seen: 457, 700, 57 - Pieced 6464-525 together
      // from split digits."
      //
      // The exemption's reasoning — a dash landing where a real family splits is
      // structural evidence — is true and it is half the sentence. It proves the
      // glue found a FAMILY. It never proves it found the right MEMBER. And the
      // family question already has an answer one step further down (v0.9.1448,
      // whose comment names this very car) that was never asked, because this
      // path returned first. This file's own rule, stated twice: a number READ
      // beats numbers GLUED.
      //
      // Two guards keep it narrow. The head must have been READ (present in
      // `uniq`) — a head assembled from loose digits, like 3562-1 out of
      // "3 3 5 6 2 1", never is, so every case the join machinery was built for
      // is untouched. And the family must have actual word EVIDENCE: with none,
      // the glued answer stands, because a bare head with nothing behind it is
      // not an improvement on a dash-repaired hit.
      var _jDashHead = (win === jHit && jHit && String(jHit).indexOf('-') > 0)
        ? String(jHit).split('-')[0] : '';
      if (_jDashHead && uniq.indexOf(_jDashHead) >= 0) {
        var _fpD = _pinFamilyPick(_jDashHead, prefer, UP);
        var _fpHasEvidence = !!(_fpD && (_fpD.why || (_fpD.tied && _fpD.tied.length)));
        if (_fpHasEvidence && String(_fpD.num) !== String(jHit)) {
          dbg.gluedOutranked = String(jHit) + ' was assembled from split digits, but '
            + _jDashHead + ' is printed on the item';
          dbg.family = _fpD.fam + ' heads ' + _fpD.count + ' dashed relative'
            + (_fpD.count === 1 ? '' : 's') + ' in the stamped catalog'
            + (_fpD.why ? ' — ' + _fpD.num + ' matched: ' + _fpD.why : '')
            + (_fpD.tied ? ' — narrowed to ' + _fpD.tied.join(' or ')
                 + (_fpD.tiedWhy ? ' on: ' + _fpD.tiedWhy : '') : '');
          return { num: _fpD.num, matched: false, family: true,
                   alts: (_fpD.tied && _fpD.tied.length)
                           ? _fpD.tied.slice(0, 6)
                           : [String(_fpD.num), String(jHit)], dbg: dbg };
        }
      }
      return { num: win, matched: solid, thin: !solid, dbg: dbg };
    }

    // ── v0.9.1448: before conceding to another era's catalog, ask whether a
    // seen number HEADS A DASHED FAMILY in the stamped era. Brad's 6464-25:
    // 6464 heads ~29 postwar rows, and it lost to a literal prewar 500. When
    // several candidates head families, word evidence wins, then the one
    // read most often. (v0.9.1831: the question is asked by _pinReadFamily,
    // ONE helper, here and in the ambiguous-windows branch above.)
    var _famBest = _pinReadFamily(uniq, prefer, UP, dbg);
    if (_famBest) {
      return { num: _famBest.num, matched: false, family: true,
               alts: (_famBest.tied && _famBest.tied.length)
                       ? _famBest.tied.slice(0, 6)
                       : [String(_famBest.num)], dbg: dbg };
    }

    // Nothing in the stamped catalog. Before giving up, look in every catalog —
    // but a hit there is a LEAD, not a confirmation, because the whole reason we
    // are here is that the photo says it belongs somewhere else. This also
    // protects against the stamped era's data simply not being loaded.
    // v0.9.1099 (Brad's Santa Fe guessed "0000"): a token whose digits are
    // all zeros is smudge, not a number.
    uniq = uniq.filter(function (cZ) { return !/^0+$/.test(String(cZ).replace(/\D/g, '')); });
    var loose = fmAny
      ? uniq.filter(function (c) { return fmAny(c) || fmAny(c.replace(/^\d-/, '')); })
      : [];

    // 1b) v0.9.1065 — DASH REPAIR. The audit produced "6464475" twice and the
    // catalog rejected both, because the real number is 6464-475: OCR drops a
    // dash far more often than it invents a digit. Try putting one back at each
    // plausible split and see if the catalog then recognises it. Only an exact
    // catalog hit is accepted, so this can add answers but never invent them.
    if (fm) {
      var repaired = null;
      uniq.some(function (c) {
        if (c.indexOf('-') >= 0) return false;
        var d = c.replace(/\D/g, '');
        if (d.length < 5 || d.length > 8) return false;
        for (var cut = 3; cut <= 4 && !repaired; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fm(cand)) repaired = cand;
        }
        return !!repaired;
      });
      if (repaired) { dbg.repaired = repaired; return { num: repaired, matched: true, dbg: dbg }; }
    }
    // 1c) v0.9.1089 — an off-era number may be THIS era's reissue. A Modern-
    // stamped photo reading "6817" resolves to the Modern row whose description
    // quotes 6817. The tag settles it; an ambiguous quote does not.
    if (loose.length && typeof _pinQuoteMatch === 'function') {
      loose.sort(dashRank);
      for (var qi = 0; qi < loose.length; qi++) {
        var qm = _pinQuoteMatch(loose[qi], prefer, dbg);
        if (qm && qm.row && qm.row.itemNum) {
          dbg.quoted = qm.quoted + ' \u2192 ' + qm.row.itemNum;
          return { num: String(qm.row.itemNum), matched: true, viaQuote: qm.quoted, dbg: dbg };
        }
      }
    }
    // ══ v0.9.1168b — NOTHING LEGIBLE, SO NOTHING OFFERED (Brad's call) ═════
    // "Block it — blank beats wrong."
    //
    // Brad's MKT 0-8-0 came back "2233810 — AT&SF EMD F7 A-A Set", and the number
    // reached the card through THIS hedge: a token that merely looks catalog-shaped,
    // offered because it exists in some list. On a photo whose recovered text holds
    // not one letter, that is a coincidence dressed as a finding.
    //
    // This narrows v0.9.1067, and the distinction matters. That rule came from his
    // 2408 Santa Fe car — "saying still no clear number will piss people off when
    // the number is obviously to a user clear" — a photo where a HUMAN can read the
    // number and the reader could not. Such a car is covered in lettering, so the
    // recovered text has letters in it and this gate never fires. Text with NO
    // letters at all is the opposite situation: the reader saw nothing, and saying
    // so is the honest answer rather than an insult to the photographer.
    //
    // The confirmed paths above are untouched: a solid run with a misread digit
    // still repairs, a quote match still resolves, a maker-adjacent number still
    // counts. Only the unconfirmed HEDGE is withheld.
    // MY FIRST CUT OF THIS WAS ALSO WRONG, and Brad's own photos caught it again:
    // his Great Northern rotary snowplow is letterless too — "4 25 5 - -8 6 194 1
    // - - - 58 5 - 7 7 9 5 / 0 58 0 58" — and 58 IS the right answer. Blanking
    // every letterless hedge would have thrown that away.
    //
    // What separates them is REPETITION. 58 was read three times across the passes,
    // because it is genuinely painted on the car. 2233810 was seen once, and so was
    // 2500. With no lettering to corroborate anything, being seen more than once is
    // the only evidence available — so a token read a single time is not offered,
    // and one read repeatedly still is.
    if (_noLetters && loose.length) {
      var _seenTimes = function (c) {
        var d = String(c).replace(/[^0-9A-Za-z-]/g, '');
        if (!d) return 0;
        try {
          return (UP.match(new RegExp('(?:^|[^0-9])' + d.replace(/-/g, '\\-') + '(?:$|[^0-9])', 'g')) || []).length;
        } catch (eR) { return 0; }
      };
      var _repeated = loose.filter(function (c) { return _seenTimes(c) > 1; });
      if (!_repeated.length) { dbg.noLetters = String(loose[0]); loose = []; }
      else loose = _repeated;
    }
    // 2) nothing confirmed — offer the best catalog-shaped token as a hedge
    if (loose.length) { loose.sort(dashRank); return { num: loose[0], matched: false, offEra: true, dbg: dbg }; }
    uniq.sort(dashRank);
    if (uniq.length) {
      // v0.9.1098 (Brad's Great Northern 58): the card offered "194" — a
      // number in NO catalog — while the cab's 58, read twice, IS in the
      // stamped catalog. Backing beats length between two guesses. The
      // v0.9.1080 rule stands: a backed short is only offered here INSTEAD
      // of unbacked junk, never on its own.
      // When several backed shorts were seen (his card listed "25, 58"), the
      // one painted on the car shows up REPEATEDLY — 58 was read three times
      // across the passes, 25 once. Frequency picks.
      var shortBacked = null, _sbBest = 0;
      if (fm) (shortOnes || []).forEach(function (sB) {
        if (!fm(sB)) return;
        var _fr = (UP.match(new RegExp('\\b' + sB + '\\b', 'g')) || []).length;
        if (_fr > _sbBest) { _sbBest = _fr; shortBacked = sB; }
      });
      if (shortBacked) {
        dbg.shortBacked = shortBacked;
        return { num: shortBacked, matched: false, alts: [String(shortBacked), String(uniq[0])], dbg: dbg };
      }
      // v0.9.1168b: and the last-ditch offer is not exempt. On a letterless photo a
      // token in NO catalog, seen once, is the weakest thing this function can
      // produce — exactly the case Brad asked to come back blank.
      if (_noLetters) { dbg.noLetters = String(uniq[0]); return { num: '', matched: false, dbg: dbg }; }
      return { num: uniq[0], matched: false, dbg: dbg };
    }
    // 3) last resort: a catalog-backed short number, always as a guess
    // v0.9.1080 — a bare two-digit number is never offered on its own any more.
    //
    // Brad's Santa Fe 2414 offered "71"; his 1877 horse car offered "53". Both
    // came out of text containing no readable word, and both numbers exist in
    // the postwar catalog — which is precisely why they surfaced. I first tried
    // gating this on how much text was recovered, and it does not work: that
    // Santa Fe string has thirty characters in it, they are simply meaningless.
    // Length was measuring the wrong thing.
    //
    // The rule that does hold is about evidence, not volume: two digits alone
    // are never enough. With a few thousand numbers in the catalog, almost any
    // stray pair lands on one. A short number is only ever accepted when
    // something else vouches for it — the maker's name stamped beside it, which
    // promotes it to a full candidate above, or a description match. Otherwise
    // the honest answer is nothing, and nothing is what the user gets.
    dbg.shortDropped = shortOnes.slice(0, 3);
    // v0.9.1072 — a read that finds NOTHING is the case most worth explaining,
    // and it was the only one that explained nothing. Brad's Lionel 50 gang car
    // has the clearest lettering of any photo in his inbox and came back blank,
    // with no way to see whether "50" was read and rejected, read and discarded
    // as too short, or never read at all. Thirty-eight of his seventy-three
    // photos are in this state. Return the reasoning with an empty answer.
    return { num: '', matched: false, empty: true, dbg: dbg };
  }

  // Read any barcode on the photo and resolve it with the SAME brain the
  // Add-wizard scanner uses (window._barcodeDebug.decodeBarcode): it decodes a
  // Lionel UPC via the maker prefix + code and looks up the real catalog item.
  // So a modern retail UPC (e.g. 0-23922-… on a Thomas set) resolves to the
  // correct item instead of a stray number the OCR might grab.
  // v0.9.1136: every barcode this resolved used to be thrown away. The Photo
  // Inbox is the highest-volume identification surface in the app and it
  // contributed ZERO pairings — rrBcMapLearn was called only from the wizard
  // scanner (barcode.js:838 and :2864), never from here.
  //
  // _bcLearn records the pairing without blocking the read. rrBcMapLearn is
  // fail-quiet, dedupes against what this device already knows before touching
  // the sheet, and dedupes again in the community queue, so calling it on every
  // photo of the same box is cheap after the first.
  //
  // The `notInMaster` case is learned too, and is the MOST valuable one — it is
  // literally what Brad asked for when this was built: "make sure when users
  // take a pic with a barcode and enter an item that we don't have in the
  // master it submits through our community share deal to our sheet". It is
  // still not RETURNED as a read, because a number the catalog doesn't know
  // can't fill in an item — but the pairing is worth having.
  function _bcLearn(rawValue, itemNum, mfr, inMaster) {
    try {
      if (typeof rrBcMapLearn !== 'function') return;
      Promise.resolve(rrBcMapLearn(rawValue, itemNum, mfr || '', 'photo-inbox', inMaster))
        .catch(function () {});   // never let a pairing failure disturb a read
    } catch (e) {}
  }

  // v0.9.1977 — ONE READER: the barcode is found the way Photo ID finds it
  // (_biDetectCanvas: the browser's own detector, then the ZXing reader, which
  // is the only one an iPhone has — the native-only read found nothing there),
  // and decoded with the era the screen's filters point to.
  async function _barcodeCodes(blob) {
    var bmp = await createImageBitmap(blob);
    try {
      if (typeof window._biDetectCanvas === 'function') {
        var cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0);
        return await window._biDetectCanvas(cv);
      }
      if (!('BarcodeDetector' in window)) return [];
      return await new window.BarcodeDetector().detect(bmp);
    } finally { if (bmp && bmp.close) bmp.close(); }
  }
  async function _readBarcode(blob, prefer) {
    var decode = (window._barcodeDebug && window._barcodeDebug.decodeBarcode) || null;
    var eraHint = (prefer && prefer.era) || '';
    try {
      var codes = await _barcodeCodes(blob);
      var fm = (typeof findMaster === 'function') ? findMaster : null;
      for (var i = 0; i < (codes || []).length; i++) {
        var rv = String(codes[i].rawValue || '');
        var fmt = String(codes[i].format || '');
        if (!rv) continue;
        // Primary: the app's real UPC resolver (shared with the wizard scanner).
        if (decode) {
          try {
            var r = await decode({ rawValue: rv, format: fmt }, eraHint);
            if (r && r.itemNum) {
              var known = !!(r.masterItem && !r.notInMaster);
              _bcLearn(rv, r.itemNum, r.manufacturer, known);
              if (known) return { num: r.itemNum, matched: true };
            }
          } catch (eD) {}
        }
        // Fallback: a barcode whose value IS a catalog number.
        var t = rv.replace(/\D/g, '');
        // (with what the screen knows — never a number-only first find)
        if (fm && fm(rv, '', prefer || undefined)) { _bcLearn(rv, rv, '', true); return { num: rv, matched: true }; }
        if (fm && t.length >= 3 && t.length <= 7 && fm(t, '', prefer || undefined)) { _bcLearn(rv, t, '', true); return { num: t, matched: true }; }
      }
    } catch (e) {}
    return null;
  }

  // ══ v0.9.1077 — identify by what the car SAYS, not just its number ═══════
  // Brad: "can we use description to help find some of these. ballast tamper
  // would work or road name may help." He is right, and his own photos make the
  // case better than any argument: a BALLAST TAMPER whose number never read, a
  // TIE-JECTOR, a gondola lettered NYC, a GP9 where the reader recovered
  // "MINNEAPOLIS ST LOUIS" perfectly and then fumbled 2348 into 2388.
  //
  // On most Lionel rolling stock the road name and the item's own name are the
  // LARGEST text on the model, and the catalog number is the smallest. We have
  // been reading the easy part and discarding it.
  //
  // This is deliberately conservative. It only speaks when the numbers have
  // failed, it only counts DISTINCTIVE words (a word shared by four hundred
  // catalog rows tells you nothing), it requires a clear winner rather than a
  // narrow one, and it never claims to be certain — it hands back a candidate
  // with the item named, so a glance confirms or kills it.
  // ══ v0.9.1089 — the tag settles it (Brad's rule, verbatim) ═══════════════
  // His 6817 scraper car carries the PW roundel: it is the modern Celebration
  // Series remake, correctly tagged Modern. The number painted on it — 6817 —
  // is the POSTWAR number, so a perfect read is off-era for its own photo.
  // Brad: "the fallback could be to say its a modern 6817 or its a postwar
  // 6817 and let the user pick. but if its already tagged modern, then that
  // should settle it."
  //
  // The catalog already contains the bridge: Lionel's reissue rows quote the
  // original number in their own descriptions — 6-39457 reads Postwar "6175"
  // Flatcar with rocket. So: index every number QUOTED in an era's
  // descriptions, and when a read lands on a number that is off-era for the
  // stamped photo, the row in the stamped catalog that quotes it is the
  // answer. Only an unambiguous quote settles it — two candidate rows means
  // the user picks, same as before.
  var _quoteIdx = null, _quoteIdxKey = '', _quoteIdxMap = null;
  function _quoteIndexFor(era) {
    var srcMap = null;
    try { srcMap = (window.state && state.masterByItem) || null; } catch (e0) {}
    if (!srcMap || !srcMap.forEach || !era) return null;
    if (_quoteIdx && _quoteIdxKey === era && _quoteIdxMap === srcMap) return _quoteIdx;
    var idx = {};
    try {
      srcMap.forEach(function (rows) {
        (rows || []).forEach(function (row) {
          if (!row || row._era !== era) return;
          // v0.9.1094: set descriptions quote their members' numbers. Letting
          // them into this index would "settle" an off-era read onto a SET
          // number — exactly what Brad flagged ("why are we matching to set
          // item numbers"). Only item rows may quote.
          if (_pinIsSetRow(row)) return;
          var toks = String(row.description || '').match(/\d[\dA-Za-z]*(?:-[\dA-Za-z]+)*/g) || [];
          var seen = {};
          toks.forEach(function (t) {
            t = t.replace(/^-+|-+$/g, '');
            if (t.length < 3 || t.length > 8) return;
            if (/^(?:19|20)\d{2}$/.test(t)) return;          // a year, not a number
            if (t === String(row.itemNum)) return;            // its own number
            if (seen[t]) return;
            seen[t] = 1;
            (idx[t] || (idx[t] = [])).push(row);
          });
        });
      });
    } catch (e) { return null; }
    _quoteIdx = idx; _quoteIdxKey = era; _quoteIdxMap = srcMap;
    return idx;
  }
  // ══ v0.9.1165 — WHICH ERAS IS THE USER FILTERED TO? ══════════════════════
  // A single-era filter covers one. A chip filter like "Lionel / O Gauge / Any
  // Era" covers several — Postwar and MPC/Modern — and rrActiveFilter names them
  // all as of this version. Every consumer below used to demand ONE era key and
  // return early on '', so under "Any Era" the number rescue, the quote rescue
  // and the word rescue were ALL switched off. That is the state Brad was
  // actually sitting in when his M-K-T read kept an MTH number: the correct
  // answer, 2631200, was sitting in the read's own saved text and nothing was
  // allowed to look for it.
  //
  // The unfinished half of v0.9.1157 — that version taught the resolver to
  // DESCRIBE a multi-era filter and never taught these consumers to USE one.
  function _prefEras(prefer) {
    if (!prefer) return [];
    if (prefer.eras && prefer.eras.length) return prefer.eras;
    return prefer.era ? [prefer.era] : [];
  }

  function _pinQuoteMatch(num, prefer, dbg) {
    var eras = _prefEras(prefer);
    if (!num || !eras.length) return null;
    // ── v0.9.1486 (Brad's EP-do-these-trains-exis-010: a noise-grade "113"
    // rode the quote chain into a PAPER row and wore the Best-guess crown).
    // Gate 1: a token under four digits may not ride the chain at all — the
    // legit v1089 case (6817 read off the car) is four digits.
    if (String(num).replace(/\D/g, '').length < 4) {
      if (dbg) dbg.quoteGated = String(num) + ' (too short to trust a catalog-quote match)';
      return null;
    }
    // Try each era the filter covers; the FIRST unambiguous hit wins, and an
    // ambiguous one still means the user picks.
    for (var i = 0; i < eras.length; i++) {
      var idx = _quoteIndexFor(eras[i]);
      if (!idx) continue;
      var rows = idx[String(num).trim()];
      if (rows && rows.length === 1) {
        // Gate 2: a paper/catalog/drawing row can never be the answer for an
        // ITEM photo (Paper-tagged photos never reach these reads at all).
        var _qr = rows[0];
        var _qt = String(_qr.itemType || '').toLowerCase();
        var _qn = String(_qr.itemNum || '');
        if (/paper|catalog|instruction|drawing|ephemera/.test(_qt) || /^(EP|DWG|IS|CAT)-/i.test(_qn)) {
          if (dbg) dbg.quoteGated = String(num) + ' \u2192 ' + _qn + ' (a paper item cannot be a car photo\u2019s answer)';
          return null;
        }
        return { row: _qr, quoted: String(num).trim() };
      }
    }
    return null;
  }

  var _descIdx = null, _descIdxKey = '', _descIdxMap = null;

  // ══ v0.9.1094 — is this catalog row a SET? ═══════════════════════════════
  // One shared answer. v0.9.1093 taught the number validator that text scraped
  // off a photo must not confirm against set rows; this session's Ballast
  // Tamper taught the WORD index the same lesson, so the rule lives in one
  // place and every index asks the same question.
  function _pinIsSetRow(row) {
    if (!row) return false;
    if (/\bsets?\b/i.test(String(row._tab || ''))) return true;
    if (/\bset\b/i.test(String(row.itemType || ''))) return true;
    return false;
  }

  // Words that appear on half the catalog and identify nothing.
  var _DESC_STOP = {
    LIONEL:1, LINES:1, BUILT:1, BLT:1, BY:1, THE:1, AND:1, FOR:1, WITH:1, AND1:1,
    CAR:1, CARS:1, RAILROAD:1, RAILWAY:1, RY:1, RR:1, CO:1, INC:1, NEW:1, TYPE:1,
    CAPY:1, LMT:1, WT:1, CUFT:1, CU:1, FT:1, LD:1, LT:1, NUMBER:1, NO:1, SET:1,
    GAUGE:1, SCALE:1, MODEL:1, TRAIN:1, ITEM:1, PART:1, USA:1, MADE:1, ONE:1,
    // v0.9.1093 (Brad's Clifton): OCR noise produced "SEE" and "ERROR", which
    // matched a row whose description is an ERRATA NOTE imported into the
    // master as if it were an item ("Appears to be an error since O Gauge
    // track is shown - see revised form below"). Rare-in-the-catalog is not
    // the same as identifying — catalog-note vocabulary never names a train.
    SEE:1, ERROR:1, NOTE:1, NOTES:1, REVISED:1, FORM:1, BELOW:1, ABOVE:1,
    SHOWN:1, APPEARS:1, SINCE:1, ALSO:1, SAME:1, ONLY:1, EACH:1, FROM:1,
    TRACK:1, PAGE:1, CATALOG:1, VERSION:1, VARIATION:1,
  };

  function _descTokens(str) {
    return String(str || '').toUpperCase().match(/[A-Z][A-Z&.-]{1,}/g) || [];
  }

  // One inverted index per era: WORD -> [rows]. Built once, on first use.
  function _descIndexFor(eras) {
    // v0.9.1165: an ERA LIST, so a multi-era chip filter has an index too.
    eras = Array.isArray(eras) ? eras : (eras ? [eras] : []);
    var eraKey = eras.join('|');
    // v0.9.1077d: this was cached on the era alone, so once built it survived
    // the catalog itself changing — a stale index that answers confidently is
    // worse than no index. The size of the loaded master is a cheap proxy for
    // "the data underneath me changed"; caught by a test where two different
    // catalogs shared an era and the second silently got the first's answers.
    var srcMap = null;
    try { srcMap = (window.state && state.masterByItem) || null; } catch (e0) {}
    // Identity of the actual Map, not a count of it. A first attempt keyed on
    // era + size, and a test with two different single-row catalogs got the
    // first one's answer for the second — a stale index that answers with
    // confidence is worse than having no index at all.
    if (_descIdx && _descIdxKey === eraKey && _descIdxMap === srcMap) return _descIdx;
    var idx = {};
    try {
      var m = srcMap;
      if (!m || !m.forEach) return null;
      m.forEach(function (rows) {
        (rows || []).forEach(function (row) {
          if (!row || (eras.length && eras.indexOf(row._era) < 0)) return;
          // v0.9.1094 (Brad's Ballast Tamper, "138 — Water Tower"): a set's
          // description NAMES its member cars, so every member name also hit
          // the set rows, tied the score, and the matcher refused to pick.
          // The words painted on a car identify an ITEM; sets answer nothing.
          if (_pinIsSetRow(row)) return;
          // v0.9.1099 (the same Ballast Tamper, still "138"): the master also
          // carries the item's BOX and its INSTRUCTION SHEET as rows, each
          // wearing the item's own name — so the item TIED with its own
          // paperwork and the matcher called it ambiguous. Paper rows
          // duplicate item names by design; they cannot vote here. (Number
          // validation is untouched — a number on a box lid is real.)
          if (/\b(box|boxes|paper|instruction|catalog|catalogs|service|science|construction|companions|other)\b/i
              .test(String(row._tab || ''))) return;
          var words = {};
          _descTokens([row.description, row.roadName, row.itemType].filter(Boolean).join(' '))
            .forEach(function (w) {
              w = w.replace(/[.&-]+$/, '');
              if (w.length < 3 || _DESC_STOP[w]) return;
              words[w] = 1;
            });
          Object.keys(words).forEach(function (w) {
            (idx[w] || (idx[w] = [])).push(row);
          });
        });
      });
    } catch (e) { return null; }
    _descIdx = idx; _descIdxKey = eraKey; _descIdxMap = srcMap;
    return idx;
  }

  // Returns { row, score, words } or null.
  function _pinDescMatch(text, prefer) {
    // v0.9.1165: every era the filter covers, not just a single key.
    var eras = _prefEras(prefer);
    if (!eras.length) return null;            // without a catalog to search, don't guess
    var idx = _descIndexFor(eras);
    if (!idx) return null;
    var seen = {}, words = [];
    _descTokens(text).forEach(function (w) {
      w = w.replace(/[.&-]+$/, '');
      if (w.length < 3 || _DESC_STOP[w] || seen[w]) return;
      seen[w] = 1; words.push(w);
    });
    if (!words.length) return null;

    // v0.9.1077c — OCR breaks long words. Brad's Lackawanna Train Master came
    // through as "LACKAWAN NA", so an exact-word index found nothing at all. A
    // photo word of six or more characters also matches a catalog word that
    // begins with it (or that begins with the photo word) — long enough that a
    // prefix collision is not a coincidence, and it is exactly how OCR fails on
    // the longest and most identifying words on a model.
    var idxKeys = null;
    function _rowsFor(w) {
      if (idx[w]) return idx[w];
      if (w.length < 6) return null;
      if (!idxKeys) idxKeys = Object.keys(idx);
      var out = null;
      for (var i = 0; i < idxKeys.length; i++) {
        var k = idxKeys[i];
        if (k.length < 6) continue;
        if (k.indexOf(w) === 0 || w.indexOf(k) === 0) {
          out = (out || []).concat(idx[k]);
        }
      }
      return out;
    }

    var score = {}, hitWords = {}, rowOf = {};
    words.forEach(function (w) {
      var rows = _rowsFor(w);
      if (!rows || !rows.length) return;
      // A word carrying 40+ rows is a category, not an identity. Weight by how
      // rare it is — TIE-JECTOR is worth far more than GONDOLA.
      var weight = rows.length > 60 ? 0 : (rows.length > 12 ? 0.4 : (rows.length > 3 ? 1 : 2));
      if (!weight) return;
      // v0.9.1080b: dedupe rows within one word. Prefix matching can return the
      // same row from several index keys, and it was scoring each one — which is
      // how a single word "MAIL" counted three times on Brad's Western &
      // Atlantic mail car and pulled up a completely different boxcar.
      var seenRow = {};
      rows.forEach(function (row) {
        // v0.9.1489 (Brad's NYC F3 pair → "EP-do-these-trains-exis-005"): a
        // PAPER / catalog / drawing row can never be what a photographed
        // TRAIN "is" — same ban the quote chain got in v1486; this word
        // rescue never had it, so article match-words swallowed lettered
        // locomotives.
        var _rt0 = String(row.itemType || '').toLowerCase();
        var _rn0 = String(row.itemNum || '');
        if (/paper|catalog|instruction|drawing|ephemera/.test(_rt0) || /^(EP|DWG|IS|CAT)-/i.test(_rn0)) return;
        var k = _rn0 + '|' + String(row._tab || '');
        if (seenRow[k]) return;
        seenRow[k] = 1;
        score[k] = (score[k] || 0) + weight;
        (hitWords[k] || (hitWords[k] = [])).push(w);
        rowOf[k] = row;
      });
    });
    var keys = Object.keys(score);
    if (!keys.length) return null;
    keys.sort(function (a, b) { return score[b] - score[a]; });
    var top = score[keys[0]], second = keys.length > 1 ? score[keys[1]] : 0;
    // Needs to be worth something AND to be a clear winner. A near tie means the
    // words were generic and any of a dozen items would fit.
    // Two DISTINCT words minimum. "MAIL" on its own describes a mail car, a mail
    // boxcar and a mail crane equally well; "WESTERN" plus "ATLANTIC" describes
    // one train. A single word is a category, not an identity — and the whole
    // promise of this route is that a glance can confirm it, which only holds
    // when it had real evidence to begin with.
    // ...unless the single word is long AND essentially unique. TIE-JECTOR and
    // LACKAWANNA each name exactly one item in the catalog and are far too long
    // to collide by accident; MAIL is short and describes half a dozen cars.
    // Rarity and length are what separate a name from a category, not count.
    var w0 = (hitWords[keys[0]] || []);
    if (w0.length < 2) {
      var only = w0[0] || '';
      var rowsFor0 = only ? (_rowsFor(only) || []) : [];
      var nearUnique = rowsFor0.length && rowsFor0.length <= 2;
      // v0.9.1164 — a PUNCTUATED ROAD ABBREVIATION is an identity even when it
      // is short. Brad's M-K-T Legacy 0-8-0 turned on exactly this: 'M-K-T'
      // names ONE row among 23,236 Lionel-modern rows — a fingerprint — but it
      // is five characters, so the seven-character rule discarded the only
      // identifying word in the sentence and this returned nothing at all.
      // B&O, C&O, M-K-T, D&RGW, L&N, T&P: the most identifying text on a model
      // is often the shortest. The punctuation is what keeps ordinary short
      // words out — and near-uniqueness still has to hold, so a common
      // abbreviation cannot walk in on its shape alone.
      var isRoadAbbrev = only.length >= 3 && /[&.-]/.test(only);
      if (!(nearUnique && (only.length >= 7 || isRoadAbbrev))) return null;
    }
    // v0.9.1093: the matched words together must carry real substance — nine
    // characters of distinct matched text. FORT+KNOX+RESERVE is fifteen,
    // MINNEAPOLIS alone is eleven; two scraps of OCR noise that happen to be
    // rare in the catalog do not add up to a name.
    // Applies to MULTI-word matches only: a single word already passed the
    // stricter lone-word rule above (seven-plus characters, at most two rows),
    // which is how LACKAWAN — eight characters, one item — stays a match while
    // SEE+ERROR — eight characters of catalog-note noise — does not.
    var _wchars = 0;
    (hitWords[keys[0]] || []).forEach(function (wd) { _wchars += String(wd).length; });
    if ((hitWords[keys[0]] || []).length >= 2 && _wchars < 9) return null;
    if (top < 2) return null;
    if (second >= top * 0.75) return null;
    // v0.9.1166: does the winning match rest on a word that names one or two rows
    // in the whole era — a herald, a road abbreviation, a model name? That is a
    // fingerprint, and _pinDescArbitrate needs to know, because a fingerprint is
    // strong enough to contradict a number that merely EXISTS in the catalog.
    var _nearUnique = false;
    (hitWords[keys[0]] || []).forEach(function (wd) {
      var rs = _rowsFor(wd);
      if (rs && rs.length && rs.length <= 2) _nearUnique = true;
    });
    return { row: rowOf[keys[0]], score: top, nearUnique: _nearUnique,
             words: (hitWords[keys[0]] || []).slice(0, 6) };
  }

  // ══ v0.9.1069 — best of several passes ═══════════════════════════════════
  // The audit settled this. No single setting wins: tiling alone found Brad's
  // 6817, 6801, 2410 and 6828, and missed his Fort Knox 6445 — which INVERTED
  // caught. Counting rows where any setting confirmed a number gives 45 of 73
  // against the best single column's 40. Reading once and accepting the answer
  // was leaving a fifth of the inbox on the floor.
  //
  // So: try the strongest first and stop the moment the stamped catalog
  // confirms a number. Most photos still cost one pass; only the awkward ones
  // pay for the rest.
  //
  //   1  TILED   — the number is usually the SMALLEST text on the item, dwarfed
  //                by the road name. Reading each third blown up is what makes
  //                it legible, and it beat every other setting by a wide margin.
  //   2  INVERTED— light lettering on a dark body. Tesseract expects the
  //                opposite, and half of Lionel's rolling stock is the wrong way
  //                round for it.
  //   3  DIGITS  — no letters at all, so it cannot offer O for 0 or S for 5.
  //   5  STAMP   — v0.9.1095, the white-stamp pass. White serif numbers on
  //                saturated plastic (Brad's red 3512, blue 6017) melt into
  //                gray under luma conversion. min(R,G,B) is a whiteness
  //                detector: white stays bright, ANY strongly coloured body
  //                goes dark. Six overlapping close-up cells from the middle
  //                and bottom thirds (wall clutter lives in the top third)
  //                stacked into one sheet, read once in sparse-text mode.
  //                Runs last — it can only add reads, never lose one.
  var _FREE_PASSES = [
    { mode: 'sharp',  tiles: 3, wl: 'full'   },
    { mode: 'invert', tiles: 0, wl: 'full'   },
    { mode: 'sharp',  tiles: 0, wl: 'digits' },
    { mode: 'chan',   tiles: 3, wl: 'full'   },
    { mode: 'stamp',  tiles: 0, wl: 'digits' },
  ];
  var _WL_FULL = '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  var _WL_DIGITS = '0123456789-';

  // v0.9.1977: opt.barcodeDone — the one reader already looked for a barcode
  // on this picture (Photo ID, the Your Picture box), so it is not read twice
  async function _freeReadBlob(blob, maxDim, prefer, opt) {
    var bc = (opt && opt.barcodeDone) ? null : await _readBarcode(blob, prefer);
    if (bc) return bc;
    var w = await _tessGet(); if (!w) return null;
    var bmp = null;
    try { bmp = await createImageBitmap(blob); }
    catch (eB) {
      // A photo the browser cannot decode is a real answer, not a crash.
      console.warn('[inbox] could not decode this photo', eB && eB.message);
      return { num: '', matched: false, empty: true,
               dbg: { era: (prefer && prefer.era) || '', eras: _prefEras(prefer), cand: [], inEra: [], offEra: [],
                      note: 'the browser could not decode this photo' } };
    }
    var dim = maxDim || 2400;
    var _photoCols = _pinPhotoColors(bmp);   // v0.9.1101: before the bitmap closes
    var best = null, text = '', stampSaw = '', textAll = '';
    for (var pi = 0; pi < _FREE_PASSES.length; pi++) {
      var p = _FREE_PASSES[pi];
      var t = '', r = null;
      try {
        await w.setParameters({ tessedit_char_whitelist: p.wl === 'digits' ? _WL_DIGITS : _WL_FULL });
        if (p.mode === 'stamp') {
          // v0.9.1098 — the stamp pass reads TWO ways, from a nine-car lab
          // bench built on Brad's own photos. Sparse mode ('11') on the
          // stacked sheet catches the larger stamps (3512, 6017, 3428). The
          // small ones — 6816, 6175 — read ONLY in block mode ('6') at high
          // zoom, and block mode assumes ONE uniform block, so it gets one
          // close-up cell at a time, never the stack. Block mode is also the
          // shipping default since v0.9.1065, so the worker is left in the
          // right state for the other passes.
          try { await w.setParameters({ tessedit_pageseg_mode: '11' }); } catch (ePs) {}
          t = (((await w.recognize(_stampSheet(bmp, dim))).data) || {}).text || '';
          try { await w.setParameters({ tessedit_pageseg_mode: '6' }); } catch (ePr) {}
          r = _numberFromText(t, prefer);
          if (!(r && r.matched && r.num)) {
            var _cells = _stampCells(bmp, dim);
            for (var ci = 0; ci < _cells.length; ci++) {
              var ct = '';
              try { ct = (((await w.recognize(_cells[ci])).data) || {}).text || ''; } catch (eC2) { continue; }
              if (!ct.trim()) continue;
              t += '\n' + ct;
              var rC = _numberFromText(t, prefer);
              if (rC) r = rC;
              // The moment an in-era four-digit number confirms, stop paying.
              if (r && r.matched && r.num && String(r.num).replace(/\D/g, '').length >= 4) break;
            }
          }
          stampSaw = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 140);
          if (r && r.dbg) {
            r.dbg.stampPass = true;
            if (!r.dbg.note) r.dbg.note = 'found by the light-numbers-on-a-coloured-body pass';
          }
        } else if (p.tiles) {
          // v0.9.1076 — WHERE the text was found matters. Brad photographs his
          // shelf against a wall with a printed catalog page pinned to it, and
          // the reader was lifting numbers straight off it: a 6816 flatcar came
          // back "409" and a 6817 came back "6912", neither number anywhere on
          // the model. Background print is often CRISPER than stamped lettering,
          // so it wins on merit and is wrong every time.
          //
          // The item is in the middle of the frame; the wall is above it. So the
          // middle band gets asked first and on its own — if that alone yields a
          // catalog-confirmed number, nothing from the edges can overrule it.
          var bands = [];
          for (var ti = 0; ti < p.tiles; ti++) {
            bands.push((((await w.recognize(_auditTile(bmp, dim, p.mode, ti, p.tiles))).data) || {}).text || '');
          }
          var mid = bands[Math.floor(p.tiles / 2)] || '';
          var rMid = _numberFromText(mid, prefer);
          if (rMid && rMid.matched && rMid.num) {
            if (rMid.dbg) rMid.dbg.fromMiddle = true;
            r = rMid; t = mid;
          } else {
            t = ((((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '')
              + '\n' + bands.join('\n');
            var rAll = _numberFromText(t, prefer);
            // v0.9.1093 (Brad's 6816: "1043 — Transformer", read straight off
            // the catalog page pinned to the wall). The item sits in the middle
            // of the frame; a confirmed number whose digits never appear in the
            // middle band was found at the EDGE — the shelf above, the wall
            // behind — and is demoted to a guess rather than stated as fact.
            if (rAll && rAll.matched && rAll.num) {
              var _digits = String(rAll.num).replace(/\D/g, '');
              var _midDigits = mid.replace(/\D/g, '');
              if (_digits && _midDigits.indexOf(_digits) < 0 && !(rAll.dbg && rAll.dbg.viaMaker)) {
                rAll.matched = false;
                if (rAll.dbg) rAll.dbg.edgeOnly = true;
              }
            }
            if (rAll) { r = rAll; }
          }
        } else {
          t = (((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '';
        }
      } catch (eP) { continue; }
      if (!r) r = _numberFromText(t, prefer);
      // An empty answer still carries its reasoning, so keep it if nothing
      // better turns up — but never let it outrank a real one.
      if (t) textAll += (textAll ? '\n' : '') + t;
      if (r && (!best || (r.num && !best.num) || (r.matched && !best.matched))) { best = r; text = t; }
      // v0.9.1096 (Brad's 6175 read as "225", his 3545 as "250"): a later pass
      // that confirms a LONGER in-era number than an early short confirm is a
      // disagreement, not a refinement — the longer number leads, both are
      // offered as chips, and neither is asserted as fact.
      else if (r && r.matched && r.num && best && best.matched && best.num
               && String(r.num) !== String(best.num)
               && String(r.num).replace(/\D/g, '').length > String(best.num).replace(/\D/g, '').length) {
        var _shortN = String(best.num);
        r.matched = false;
        r.alts = [String(r.num), _shortN];
        if (r.dbg) r.dbg.shortVsLong = _shortN + ' vs ' + r.num;
        best = r; text = t;
      }
      // The early exit is earned by evidence, not by any confirm: four or more
      // digits, or the maker's name standing next to the number. A bare
      // 1-3 digit confirm is exactly what 225 and 250 were — real catalog
      // items scraped off the wrong part of the frame — so the remaining
      // passes (above all the white-stamp pass) still get their turn.
      if (best && best.matched && best.num
          && (String(best.num).replace(/\D/g, '').length >= 4
              || (best.dbg && best.dbg.viaMaker))) break;
    }
    try { await w.setParameters({ tessedit_char_whitelist: _WL_FULL }); } catch (eR) {}
    // ── v0.9.1099 — the passes compare notes ──────────────────────────────
    // Brad's Great Northern: pass texts held "58" three times, but each pass
    // ranked only its own text, so "25" (once) tied it and won by order. His
    // Santa Fe 2408: an early pass guessed "0000" while the stamp pass
    // plainly read 2408 — and lost the slot. When no pass confirmed, one
    // final read of the POOLED text decides: it sees every number every pass
    // saw, so frequency and backing are judged on the whole evidence.
    try {
      if (textAll && !(best && best.matched)) {
        var rPool = _numberFromText(textAll, prefer);
        if (rPool && rPool.num) {
          if (rPool.dbg) rPool.dbg.pooled = true;
          best = rPool; text = textAll;
        }
      }
    } catch (ePool) {}
    // ── v0.9.1977 — ONE READER: the box-label rules ───────────────────────
    // Photo ID's quick label read knows how a BOX prints its number — a maker's
    // own prefix ("6-36814", "10-2210", "Item No. …"). Those rules used to live
    // only there; now this reader uses them too, so nothing either one caught
    // is lost. Only when no pass confirmed a number, and only a number the
    // catalog holds inside the screen's filters.
    try {
      if (textAll && !(best && best.matched) && typeof window._extractItemNumberCandidates === 'function' && typeof findMaster === 'function') {
        var _rej = (prefer && Array.isArray(prefer.reject)) ? prefer.reject.map(String) : [];
        var _lc = window._extractItemNumberCandidates(textAll) || [];
        for (var li = 0; li < _lc.length; li++) {
          var _lr = String((_lc[li] && (_lc[li].raw || _lc[li].num)) || '').trim();
          if (!_lr) continue;
          var _try = [_lr]; if (/^6-\d/.test(_lr)) _try.push(_lr.slice(2));
          for (var lt = 0; lt < _try.length; lt++) {
            if (_rej.indexOf(_try[lt]) >= 0) continue;
            var _row = findMaster(_try[lt], null, prefer || null);
            if (!_row) continue;
            if (prefer && typeof window.rrRowFitsPrefer === 'function' && !window.rrRowFitsPrefer(_row, prefer)) continue;
            best = { num: String(_row.itemNum || _try[lt]), matched: true, alts: (best && best.alts) || [],
                     dbg: Object.assign({}, (best && best.dbg) || {}, { boxLabel: _lr, note: 'read by the box-label rules' }) };
            text = textAll; break;
          }
          if (best && best.matched) break;
        }
      }
    } catch (eBL) {}
    // What the stamp pass saw survives into the disclosure even when it lost —
    // the next failure report then shows what it read instead of a blank.
    try { if (best && best.dbg && stampSaw && !best.dbg.stampPass) best.dbg.stampSaw = stampSaw; } catch (eSS) {}
    try { if (bmp.close) bmp.close(); } catch (eC) {}
    // ── What does the car SAY? ────────────────────────────────────────────
    // v0.9.1099: the words are matched against the POOLED text of every pass
    // — a name half-read by one pass is often completed by another.
    try { best = _pinDescArbitrate(best, textAll || text, prefer); }
    catch (eD) { console.warn('[inbox] description match failed', eD && eD.message); }
    var out = best;
    // ── v0.9.1101 — the color veto ────────────────────────────────────────
    try {
      if (out && out.num && _photoCols) {
        var _rowsC = null;
        try {
          var _mbi = window.state && state.masterByItem;
          if (_mbi && _mbi.get) _rowsC = _mbi.get(String(out.num)) || null;
        } catch (eM) {}
        if ((!_rowsC || !_rowsC.length) && typeof findMaster === 'function') {
          var _r1 = findMaster(out.num, null, prefer || null);
          if (_r1) _rowsC = [_r1];
        }
        var _clash = _pinColorClash(_photoCols, _rowsC);
        if (_clash) {
          if (out.dbg) { out.dbg.colorClash = _clash; out.dbg.photoColors = _photoCols.join(', '); }
          if (out.matched) out.matched = false;
        }
      }
    } catch (eCC) {}
    // v0.9.1068 (Brad: "where does 120 come from?"). A number appears with no
    // way to tell whether the reader saw it on the item, on the shelf behind it,
    // or invented it from a shadow. Keep the words it actually read.
    if (out) out.raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    return out;
  }
  // v0.9.1950 (Brad's Woodruff 2-pack, "still can't read it"): Photo ID read
  // the lettering ONE way and found nothing, while this reader — several ways,
  // each checked against the catalog — read 1927690 off the same picture.
  // ONE strong free reader for the whole app: Photo ID asks it here when its
  // quick look comes back empty (barcode.js _biPipelineCore).
  // v0.9.1955: ONE read at a time through this door. The Your Picture box can
  // be reading in the background when Photo ID starts; both share one reader
  // whose settings change pass by pass, so a second read waits its turn.
  var _freeReadQueue = Promise.resolve();
  window.rrFreeReadBlob = function (blob, maxDim, prefer, opt) {
    var run = _freeReadQueue.then(function () { return _freeReadBlob(blob, maxDim, prefer, opt); });
    _freeReadQueue = run.catch(function () {});
    return run;
  };

  // ══ What the car SAYS versus what the number claims ══════════════════════
  // v0.9.1077b — this used to run only when the numbers had failed outright,
  // and Brad's Lackawanna 2321 showed why that is not enough. The reader saw
  // "D321" — 2321 with the leading 2 misread — and 321 IS a real postwar item,
  // a Trestle Bridge. So a wrong answer counted as a match and the word
  // LACKAWAN, sitting in the same text and naming the locomotive outright,
  // was never consulted. It runs every time now.
  // v0.9.1094 — pulled out of _freeReadBlob so the harness can call it with
  // Brad's exact scraped text; the v0.9.1085 lesson is that node --check
  // cannot catch what only a CALL can.
  function _pinDescArbitrate(best, text, prefer) {
    {
      var dm = _pinDescMatch(text, prefer);
      if (dm && dm.row && dm.row.itemNum) {
        var descNum = String(dm.row.itemNum);
        var haveNum = (best && best.num) ? String(best.num) : '';
        var descOf = [dm.row.description, dm.row.roadName].filter(Boolean)
          .filter(function (v, i, a) { return a.findIndex(function (x) { return String(x).toLowerCase() === String(v).toLowerCase(); }) === i; })
          .join(' \u2014 ');
        var dbg2 = (best && best.dbg) || {};
        dbg2.viaDesc = dm.words.join(', ');

        // TWO WEAK SIGNALS THAT AGREE. "321" is the tail of "2321", and the
        // lettering independently says Lackawanna. A misread leading digit and a
        // road name pointing at the same item is far stronger evidence than
        // either alone — this is the case worth being confident about.
        // v0.9.1978: a TAIL means a digit was lost in front — the lettering's
        // number is LONGER. Equal digits are not a tail: 2343-P read against
        // the lettering's 2343-T (powered vs dummy) used to "agree" here and
        // swap the powered unit for the dummy.
        var _dD = descNum.replace(/\D/g, ''), _hD = haveNum ? haveNum.replace(/\D/g, '') : '';
        var tailAgrees = haveNum && descNum !== haveNum && _hD && _dD.length > _hD.length &&
          (_dD.slice(-_hD.length) === _hD);
        // v0.9.1978 — THE SAME ITEM IS AGREEMENT. The number read and the
        // lettering naming the very same item (0526-1 both ways; 2343P and
        // 2343-P are one spelling apart) are two signals that agree — it was
        // falling to the "fingerprint word contradicts a matched number"
        // branch below and came out unsure, "disagreeing" with itself. Only a
        // dash before a letter suffix is bridged: 2343-P and 2343-T stay two
        // different items.
        var _sameSpelling = function (v) { return String(v || '').trim().toUpperCase().replace(/-(?=[A-Z]+$)/, ''); };
        var sameItem = !!haveNum && _sameSpelling(descNum) === _sameSpelling(haveNum);

        if (sameItem) {
          dbg2.corroborated = haveNum + ' (the number read, and the lettering names the same item)';
          best.matched = true; best.viaDesc = true; best.descWords = dm.words; best.descOf = descOf; best.dbg = dbg2;
          delete best.disagreed;
        } else if (tailAgrees) {
          dbg2.corroborated = descNum + ' (read ' + haveNum + ', lettering agrees)';
          best = { num: descNum, matched: true, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2 };
        } else if (!best || !best.matched) {
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2,
                   disagreed: (haveNum && haveNum !== descNum) ? haveNum : '' };
        } else if (dm.score >= 3 && haveNum.replace(/\D/g, '').length <= 3) {
          // A confident name beats a three-digit number that could be anything.
          // Offered rather than asserted, since the two genuinely disagree.
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf,
                   disagreed: haveNum, dbg: dbg2 };
        } else if (dm.nearUnique) {
          // v0.9.1166 — Brad's M-K-T steam locomotive was read as "2900 — Lockon",
          // a track accessory, and offered as a confident answer. 2900 IS a real
          // Lionel number, so best.matched was true, and the only branch that
          // could overturn a matched number demanded a score of 3+ AND no more
          // than three digits. A FOUR-digit number that merely exists therefore
          // outranked the herald painted on the car — and that herald, M-K-T,
          // names exactly ONE row among 23,236 Lionel-modern rows.
          //
          // A fingerprint word now contradicts a matched number whatever its
          // length. NEITHER side is asserted: the name leads because it is
          // physically on the item, the number rides along as `disagreed`, and
          // the card shows both for the user to settle.
          dbg2.nameVsNumber = descNum + ' (the lettering on the item) vs '
            + haveNum + ' (the number read)';
          // When the two answers are not even the same KIND of thing — a track
          // accessory against a locomotive — say so. That is the part a person
          // settles at a glance, and it is exactly what was missing from the
          // Lockon card.
          try {
            var _rowNum = (typeof findMaster === 'function') ? findMaster(haveNum, null, prefer) : null;
            var _tA = _rowNum ? String(_rowNum.itemType || '').trim() : '';
            var _tB = String(dm.row.itemType || '').trim();
            if (_tA && _tB && _tA.toLowerCase() !== _tB.toLowerCase()) {
              dbg2.typeClash = haveNum + ' is a ' + _tA + ', but the lettering points to a ' + _tB;
            }
          } catch (eTC) {}
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf,
                   disagreed: haveNum, dbg: dbg2 };
        }
      }
    }
    return best;
  }

  // ══ v0.9.1084 — the reader answered correctly; we took the wrong number ═══
  // Brad: "i think its how our app is reading the info wrong." He was right, and
  // it is a better diagnosis than mine. On his 6801 boat flatcar the reader
  // returned:
  //
  //   "Lionel Lionel Lines Lionel 6801-75 O/O27 Gauge Postwar Red Flat Freight
  //    Car ... manufactured by Lionel in 1958 (1957) — No. 6-16661"
  //
  // It said POSTWAR and it named 6801-75. The app filed it as 6-16661, Lionel
  // MPC/Modern. Same on his rocket flatcar: description "Postwar '6175' Flatcar
  // with rocket", filed as 6-39457.
  //
  // The cause is the question we ask. "Manufacturer SKU or catalog number" gets
  // answered with the SKU — and for a piece still in production as a reissue,
  // the SKU is the MODERN one. The postwar number lands in the description
  // instead, where nothing was looking for it.
  //
  // So: every number the reader mentioned anywhere in its answer is a candidate,
  // and the one that exists in the catalog the PHOTO says it belongs to wins.
  // The reader is not corrected — it is read properly.
  function _pinReconcileAiNum(meta, aiText, prefer) {
    var out = { num: (meta && meta.itemNum) ? String(meta.itemNum).trim() : '', swappedFrom: '' };
    // v0.9.1165: run for a multi-era filter too. This used to return here
    // whenever prefer.era was '' — which is exactly what "Any Era" produces — so
    // the whole rescue chain was silently disabled for Brad's actual filter.
    var _eras = _prefEras(prefer);
    if (!_eras.length || typeof findMaster !== 'function') return out;

    var inEra = function (c) {
      if (!c) return false;
      try {
        var r = findMaster(c, null, prefer);
        return !!(r && _eras.indexOf(r._era) >= 0);
      } catch (e) { return false; }
    };
    // Already right — leave it alone.
    // v0.9.1419 (Cooper's Big Boy): "already right" used to mean "this number
    // exists in the stamped catalog", and that is a weaker claim than it
    // sounds. The reader attached 6-11122 from memory (no printed number came
    // back) to a photo it had itself described as a Union Pacific 4-8-8-4 Big
    // Boy — and 6-11122 IS in the catalog, as a Southern 0-8-0. Existence
    // settled it, and nothing ever compared the row to the reader's own words.
    // Now a number is only settled when its row does not CONTRADICT the read
    // (wheel arrangement, railroad — _pinAiRowConflict). On contradiction the
    // words get their turn: the same _pinDescMatch the rescue chain trusts
    // hunts the catalog for what the reader actually described, and a clear,
    // non-conflicting winner comes back FLAGGED (viaDesc) exactly like every
    // other words-over-numbers swap — offered on the card, never silently
    // filed. No winner → the number stays, but carries the conflict so the
    // card can warn instead of vouching.
    if (out.num && inEra(out.num)) {
      var _setRow = null;
      try { _setRow = findMaster(out.num, null, prefer); } catch (eSR) {}
      var _setCf = '';
      try { _setCf = _pinAiRowConflict(meta, aiText || '', _setRow); } catch (eSC) {}
      if (!_setCf) return out;
      out.conflict = _setCf;
      if (typeof _pinDescMatch === 'function') {
        try {
          var dmCf = _pinDescMatch(aiText || (meta && meta.description) || '', prefer);
          if (dmCf && dmCf.row && dmCf.row.itemNum && String(dmCf.row.itemNum) !== out.num
              && !_pinAiRowConflict(meta, aiText || '', dmCf.row)) {
            out.swappedFrom = out.num;
            out.num = String(dmCf.row.itemNum);
            out.viaDesc = (dmCf.words || []).join(', ');
            out.descOf = [dmCf.row.description, dmCf.row.roadName]
              .filter(Boolean)
              .filter(function (v, i, a) {
                return a.findIndex(function (x) { return String(x).toLowerCase() === String(v).toLowerCase(); }) === i;
              })
              .join(' — ');
            return out;
          }
        } catch (eDC) {}
      }
      return out;
    }

    // Candidates, best sources first: the fields the reader labelled, then
    // anything number-shaped in the whole answer.
    var pool = [];
    var push = function (v) {
      String(v || '').toUpperCase().replace(/[^0-9A-Z\s-]/g, ' ')
        .match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g)
        ?.forEach(function (t) {
          t = t.replace(/^-+|-+$/g, '');
          if (t.length >= 3 && t.length <= 12 && pool.indexOf(t) < 0) pool.push(t);
        });
    };
    if (meta) { push(meta.description); push(meta.title); push(meta.formNumber); }
    push(aiText);

    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      if (c === out.num) continue;
      if (inEra(c)) { out.swappedFrom = out.num; out.num = c; return out; }
      // the reader writes 6801-75 for a variation of 6801 — accept the base
      var base = c.split('-')[0];
      if (base && base !== c && base.length >= 3 && inEra(base)) {
        out.swappedFrom = out.num; out.num = c; return out;
      }
    }
    // ── v0.9.1448: the paid reader names the road and the COLORS —
    // "orange Great Northern boxcar". If a read number heads a dashed family
    // in the stamped era, those words pick the variant — offered, never
    // asserted, and the card says which words decided it.
    var _famSrc = [aiText || '', (meta && meta.description) || '', (meta && meta.title) || ''].join(' ');
    var _famAll = [out.num].concat(pool);
    for (var fj = 0; fj < Math.min(_famAll.length, 9); fj++) {
      var fpj = _pinFamilyPick(_famAll[fj], prefer, _famSrc);
      if (fpj) {
        if (String(fpj.num) !== String(out.num)) out.swappedFrom = out.num;
        out.num = String(fpj.num);
        out.family = fpj.fam + ' → ' + fpj.num
          + (fpj.why ? ' (matched: ' + fpj.why + ')' : ' (' + fpj.count + ' in the family)');
        // A family answer is ALWAYS a hedge — both consumers read a falsy
        // viaDesc as "in-era catalog hit, no longer a guess", and a bare
        // family head is a number that by definition has no row of its own.
        // Word evidence names its words; a bare head names the family.
        out.viaDesc = fpj.why || ('the ' + fpj.fam + ' dashed family (' + fpj.count + ' variant' + (fpj.count === 1 ? '' : 's') + ') — the -XX is on the box');
        return out;
      }
    }
    // v0.9.1089: nothing in the stamped catalog directly — but one of the
    // numbers may be quoted by a stamped-era row (the reissue naming its
    // original). The tag settles it.
    if (typeof _pinQuoteMatch === 'function') {
      var qcands = [out.num].concat(pool);
      for (var q = 0; q < qcands.length; q++) {
        var qm2 = qcands[q] && _pinQuoteMatch(qcands[q], prefer);
        if (qm2 && qm2.row && qm2.row.itemNum && String(qm2.row.itemNum) !== out.num) {
          out.swappedFrom = out.num; out.num = String(qm2.row.itemNum);
          out.viaQuote = qm2.quoted;
          return out;
        }
      }
    }
    // v0.9.1164 — LAST RESORT: the reader's WORDS. Brad's M-K-T Legacy 0-8-0
    // showed the gap. The paid reader named the item exactly ("M-K-T LEGACY
    // 0-8-0 #43" is the catalog description of Lionel 2631200, near-verbatim,
    // and Brad confirmed "it is a lionel") and then attached 20-3151-1 — a real
    // number, but MTH's Union Pacific 0-8-0. Everything above hunts for NUMBERS,
    // and no number in that answer leads to 2631200, so the rescue never had a
    // chance.
    //
    // _pinDescMatch already scores catalog rows by rarity-weighted word overlap
    // within the filtered era, and it was wired into the FREE OCR path only — so
    // the read that costs a token could not use the app's best tool. Same
    // matcher, called from one more place: no second implementation to drift.
    //
    // It runs only once the numbers have failed, and its own thresholds (two
    // distinct words, or one long-or-punctuated near-unique word; real matched
    // substance; a clear winner) decide whether there is an answer at all.
    // Returned FLAGGED (viaDesc + descOf) because it overrides a number the
    // reader stated out loud: the card offers it for confirmation, and the user
    // can see both what matched and which row it landed on.
    if (typeof _pinDescMatch === 'function') {
      try {
        var dmR = _pinDescMatch(aiText || (meta && meta.description) || '', prefer);
        if (dmR && dmR.row && dmR.row.itemNum && String(dmR.row.itemNum) !== out.num) {
          out.swappedFrom = out.num;
          out.num = String(dmR.row.itemNum);
          out.viaDesc = (dmR.words || []).join(', ');
          out.descOf = [dmR.row.description, dmR.row.roadName]
            .filter(Boolean)
            .filter(function (v, i, a) {
              return a.findIndex(function (x) { return String(x).toLowerCase() === String(v).toLowerCase(); }) === i;
            })
            .join(' — ');
          return out;
        }
      } catch (eDsc) { console.warn('[Inbox] word rescue failed:', eDsc && eDsc.message); }
    }
    return out;
  }

  // v0.9.1083 — what we know about a photo, in the shape the paid reader wants.
  // Three of the four paid call sites were passing `{}`: the reader was being
  // asked "what is this?" with no mention of the era stamped on the photo, and
  // answering from a web that is overwhelmingly modern reissues.
  function _pinAiHints(group, extra) {
    var h = {};
    try {
      var pref = _pinPreferOf(group);
      // v0.9.1157: read the constraint off `pref` itself instead of re-deriving
      // it from ERAS[pref.era]. A chip filter spanning several eras has no
      // single era key, and gating on `pref.era` threw away a perfectly good
      // maker + scale constraint whenever it was blank.
      if (pref && (pref.label || pref.manufacturer || pref.scale || pref.type)) {
        h.eraLabel = pref.label || '';
        h.eraYears = pref.years || '';
        if (pref.manufacturer) h.mfrs = [pref.manufacturer];
        if (pref.scale) h.scale = pref.scale;
        // v0.9.1297: the Type tag goes to the paid reader too — the relay
        // already weaves hints.type into its subject line.
        if (pref.type) h.type = pref.type;
        // Said plainly as well as structurally — the relay weaves `note` into
        // the prompt, and a sentence survives a prompt rewrite better than a
        // field name does.
        h.note = 'This is a ' + (h.eraLabel || 'vintage') + (h.eraYears ? ' (' + h.eraYears + ')' : '')
          + ' item. Identify the ORIGINAL piece from that period, not a modern reissue,'
          + ' remake or Celebration Series version carrying the same number.';
      }
    } catch (e) {}
    if (extra && extra.note) h.note = (h.note ? h.note + ' ' : '') + extra.note;
    if (extra && extra.mfrs) h.mfrs = extra.mfrs;
    return h;
  }

  // ══ Image preparation for the free reader ════════════════════════════════
  // These passes came out of the v0.9.1063 reader audit, which ran the free
  // reader over Brad's whole inbox under several preprocessing variants and
  // scored them by how many numbers the CATALOG confirmed — not by how many
  // digits were read, since a variant that reads more and confirms fewer is
  // reading noise. "sharp" won and is what ships. The audit tool itself was
  // removed in v0.9.1352; what it taught is below, and _auditCanvas /
  // _auditTile keep their names because the live read path calls them.
  //
  // Local (adaptive) threshold, shared by the 'local' and 'chan' passes.
  // Compares each pixel with the mean of its own neighbourhood via an
  // integral image, so uneven lighting and specular highlights stop deciding
  // the result for the whole photo.
  function _localThreshold(c) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
      // v0.9.1080 — a silver passenger car has a blown-out highlight along the
      // roof and deep shadow under the skirt, so the global stretch is decided
      // by those two extremes and the lettering in between barely moves. Compare
      // each pixel with the average of its own neighbourhood instead: what
      // matters is whether a pixel is darker than the metal AROUND it, not
      // darker than the brightest thing in the photo. This is the standard
      // answer for reflective surfaces and uneven lighting.
      var box = Math.max(8, Math.round(Math.min(w, h) / 40));
      var integral = new Float64Array((w + 1) * (h + 1));
      var xx, yy;
      for (yy = 0; yy < h; yy++) {
        var rowSum = 0;
        for (xx = 0; xx < w; xx++) {
          rowSum += d[((yy * w) + xx) * 4];
          integral[((yy + 1) * (w + 1)) + (xx + 1)] = integral[(yy * (w + 1)) + (xx + 1)] + rowSum;
        }
      }
      var area = function (x0, y0, x1, y1) {
        return integral[(y1 * (w + 1)) + x1] - integral[(y0 * (w + 1)) + x1]
             - integral[(y1 * (w + 1)) + x0] + integral[(y0 * (w + 1)) + x0];
      };
      var outBuf = new Uint8ClampedArray(w * h);
      for (yy = 0; yy < h; yy++) {
        var y0 = Math.max(0, yy - box), y1 = Math.min(h, yy + box + 1);
        for (xx = 0; xx < w; xx++) {
          var x0 = Math.max(0, xx - box), x1 = Math.min(w, xx + box + 1);
          var n = (x1 - x0) * (y1 - y0);
          var mean = area(x0, y0, x1, y1) / n;
          var v2 = d[((yy * w) + xx) * 4];
          // 6% below the local mean counts as ink — tolerant enough for thin
          // stamped lettering, tight enough not to turn noise black.
          outBuf[(yy * w) + xx] = (v2 < mean * 0.94) ? 0 : 255;
        }
      }
      for (yy = 0; yy < h; yy++) {
        for (xx = 0; xx < w; xx++) {
          var o2 = ((yy * w) + xx) * 4;
          d[o2] = d[o2 + 1] = d[o2 + 2] = outBuf[(yy * w) + xx];
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
  }

  // ══ v0.9.1082 — the tiles were never preprocessed ═══════════════════════
  // _auditTile took a `mode` argument and ignored it completely: every band got
  // a plain grayscale stretch, whatever the pass was supposed to be doing. So
  // the inverted pass never inverted a band, the local threshold never touched
  // one, and tonight's colour-channel work would not have reached them either —
  // on the TILED pass, which is the one that won the audit and the one Brad's
  // red flatcars depend on. It won despite this.
  //
  // Making the canvas and processing it are separate jobs now, and the whole
  // frame and each band run the identical code.
  function _applyMode(c, mode) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    // grayscale + histogram bounds
    var lo = 255, hi = 0, i;
    for (i = 0; i < d.length; i += 4) {
      var g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    // stretch to full range — this is what a shiny silver car needs, where the
    // whole photo lives in a narrow band of greys
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = ((d[i] - lo) * 255 / span);
      v = v < 0 ? 0 : (v > 255 ? 255 : v);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    if (mode === 'chan') {
      // ══ v0.9.1081 — read the colour channel that actually shows the text ═══
      // Brad: "get the photo id to read the red flatcar numbers. this should be
      // easy." He was right, and the reason it was not working has nothing to do
      // with size or focus. Converting to grayscale mixes the three channels by
      // 0.299R + 0.587G + 0.114B, and on a warm-coloured body that mix destroys
      // the very contrast we need:
      //
      //   white lettering on...   grayscale   red ch   green ch   blue ch
      //   red flatcar                   169       54        220       212
      //   orange gang car               115       18        142       228
      //   yellow barrel car              62       10         60       210
      //
      // A yellow car keeps 62 levels of separation in grayscale and 210 in blue.
      // We were discarding three and a half times the signal before the reader
      // ever saw the photo. Lionel painted an awful lot of red, orange and
      // yellow rolling stock.
      //
      // So: measure each channel's spread and keep whichever one separates best,
      // rather than blending all three into mush. On a silver or black body the
      // channels are near-identical and this behaves exactly like grayscale.
      var n2 = 0, sum = [0, 0, 0], sumSq = [0, 0, 0];
      var step = Math.max(4, Math.floor((w * h) / 40000)) * 4;   // sample, don't scan
      for (var q = 0; q < d.length; q += step) {
        for (var ch = 0; ch < 3; ch++) {
          var vq = d[q + ch];
          sum[ch] += vq; sumSq[ch] += vq * vq;
        }
        n2++;
      }
      var best = 0, bestSd = -1;
      for (var ch2 = 0; ch2 < 3; ch2++) {
        var mean2 = sum[ch2] / Math.max(1, n2);
        var sd = Math.sqrt(Math.max(0, (sumSq[ch2] / Math.max(1, n2)) - (mean2 * mean2)));
        if (sd > bestSd) { bestSd = sd; best = ch2; }
      }
      for (var p2 = 0; p2 < d.length; p2 += 4) {
        var vv = d[p2 + best];
        d[p2] = d[p2 + 1] = d[p2 + 2] = vv;
      }
      ctx.putImageData(img, 0, 0);
      // then the same local threshold, which is what copes with the highlights
      return _localThreshold(c);
    }
    if (mode === 'local') { return _localThreshold(c); }
    if (mode === 'invert') {
      for (i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
      }
    }
    if (mode === 'sharp' || mode === 'invert') {
      // unsharp mask: subtract a cheap 3x3 blur, add the difference back
      var src = new Uint8ClampedArray(d.length);
      src.set(d);
      var idx = function (x, y) { return ((y * w) + x) * 4; };
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var sum = 0;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) sum += src[idx(x + dx, y + dy)];
          var blur = sum / 9;
          var o = idx(x, y);
          var sharp = src[o] + (src[o] - blur) * 1.8;
          d[o] = d[o + 1] = d[o + 2] = sharp < 0 ? 0 : (sharp > 255 ? 255 : sharp);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ══ v0.9.1101 — the color veto ═══════════════════════════════════════════
  // Brad: "can we compare our item picture is probably black or red and the
  // answer we think is probably red?" Yes — as a VETO only. The photo's
  // dominant body colors come from the middle of the frame (the shelf and
  // wall live at the edges); the answer's colors come from words in its own
  // catalog rows. When the row names colors and NONE of them — or their
  // lighting-blurred neighbours — appear in the photo, the match is demoted
  // to a guess and the card says why. It never confirms: warm light lies,
  // loads sit on cars, and half the catalog names no color at all.
  var _PIN_COLOR_WORDS = {
    RED: 'red', MAROON: 'red', TUSCAN: 'brown', ORANGE: 'orange',
    YELLOW: 'yellow', GOLD: 'yellow', BLACK: 'black', BLUE: 'blue',
    GREEN: 'green', GRAY: 'gray', GREY: 'gray', SILVER: 'gray',
    WHITE: 'white', CREAM: 'white', IVORY: 'white', BROWN: 'brown',
  };
  function _pinColorWords(str) {
    var out = {};
    String(str || '').toUpperCase().replace(/[A-Z]+/g, function (w) {
      if (_PIN_COLOR_WORDS[w]) out[_PIN_COLOR_WORDS[w]] = 1;
      return w;
    });
    return Object.keys(out);
  }
  function _pinPhotoColors(bmp) {
    try {
      var W = 96, H = Math.max(8, Math.round(bmp.height * W / bmp.width));
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, W, H);
      var y0 = Math.floor(H * 0.30), hh = Math.max(1, Math.ceil(H * 0.85) - y0);
      var d = ctx.getImageData(0, y0, W, hh).data;
      var n = {}, total = 0;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sp = mx - mn;
        var col;
        if (mx < 62) col = 'black';
        else if (mn > 185 && sp < 45) col = 'white';
        else if (sp < 34) col = 'gray';
        else if (r >= g && r >= b) {
          if (g > r * 0.72) col = 'yellow';
          else if (g > r * 0.45) col = (mx < 140 ? 'brown' : 'orange');
          else col = (mx < 120 ? 'brown' : 'red');
        } else if (g >= b) col = 'green';
        else col = 'blue';
        n[col] = (n[col] || 0) + 1; total++;
      }
      if (!total) return null;
      return Object.keys(n).sort(function (a, b2) { return n[b2] - n[a]; })
        .filter(function (k) { return n[k] / total >= 0.12; })
        .slice(0, 3);
    } catch (e) { return null; }
  }
  // Colors that lighting, fading and shadow blur into one another. A clash
  // must clear ALL of these to count — better to miss a veto than fire a
  // false one.
  var _PIN_COLOR_NEAR = {
    red: ['brown', 'orange'], brown: ['red', 'black', 'orange'],
    orange: ['red', 'yellow', 'brown'], yellow: ['white'],
    gray: ['white', 'black', 'blue'], white: ['gray', 'yellow'],
    black: ['brown', 'gray', 'blue'], blue: ['black', 'gray', 'green'],
    green: ['blue', 'black'],
  };
  function _pinColorClash(photoCols, rows) {
    if (!photoCols || !photoCols.length || !rows || !rows.length) return '';
    var rowCols = {}, any = false;
    rows.forEach(function (rw) {
      // v0.9.1102: the curated Body Color column (text pass + COTT photo
      // sampling) outranks parsing prose — when a row carries it, it IS the
      // answer. Prose fallback reads varDesc, the variation TEXT; `variation`
      // is just the variation number and never held a color.
      var srcTxt = (rw && rw.bodyColor)
        ? String(rw.bodyColor).replace(/\(photo\)/ig, '')
        : [rw && rw.description, rw && rw.roadName, rw && rw.varDesc]
            .filter(Boolean).join(' ');
      _pinColorWords(srcTxt).forEach(function (cw) { rowCols[cw] = 1; any = true; });
    });
    if (!any) return '';
    // Judged on the photo's DOMINANT color only. Every shelf photo carries
    // black frames and gray track as secondary colors, and letting those
    // vote cleared every veto through the neighbour table.
    var pc0 = photoCols[0];
    var okC = !!rowCols[pc0]
      || (_PIN_COLOR_NEAR[pc0] || []).some(function (nc) { return rowCols[nc]; });
    if (okC) return '';
    return 'the photo looks ' + photoCols.join('/')
      + '; this item is described as ' + Object.keys(rowCols).join('/');
  }

  // ══ v0.9.1095 — the white-stamp sheet ════════════════════════════════════
  // min(R,G,B) per pixel: white lettering keeps every channel high; coloured
  // plastic always has at least one dark channel. The result is a frame where
  // any red, blue, green or black body is near-black and the stamped number
  // glows. Then six overlapping close-up cells (middle + bottom thirds, three
  // columns each with a half-column of overlap so a number straddling a cut
  // is whole in one of them), each blown up 2-3x, stacked into one tall sheet
  // with white gaps — one recognize() call instead of six.
  // The top third is deliberately absent: that is where Brad's pinned catalog
  // pages and shelf clutter live, and this pass has no middle-band demotion
  // to protect it.
  function _stampSheet(bmp, maxDim) {
    var sc0 = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var W = Math.max(3, Math.round(bmp.width * sc0)), H = Math.max(3, Math.round(bmp.height * sc0));
    var src = document.createElement('canvas'); src.width = W; src.height = H;
    var sctx = src.getContext('2d');
    sctx.drawImage(bmp, 0, 0, W, H);
    var d = sctx.getImageData(0, 0, W, H), px = d.data;
    for (var i = 0; i < px.length; i += 4) {
      var m = Math.min(px[i], px[i + 1], px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = m;
    }
    sctx.putImageData(d, 0, 0);
    var third = Math.floor(H / 3), over = Math.floor(W / 12);
    var cells = [], CAP = 2900, GAP = 50;
    for (var rI = 1; rI <= 2; rI++) {
      var y0 = rI * third, h0 = (rI === 2) ? (H - y0) : third;
      if (h0 < 3) continue;
      for (var cI = 0; cI < 3; cI++) {
        var x0 = Math.max(0, Math.floor(W * cI / 3) - over);
        var x1 = Math.min(W, Math.floor(W * (cI + 1) / 3) + over);
        var cw = x1 - x0;
        if (cw < 3) continue;
        var sc = Math.max(2, Math.min(3, Math.floor(CAP / cw) || 2));
        cells.push({ x: x0, y: y0, w: cw, h: h0, sc: sc });
      }
    }
    var sheetW = 3, sheetH = GAP;
    cells.forEach(function (cl) {
      sheetW = Math.max(sheetW, cl.w * cl.sc);
      sheetH += cl.h * cl.sc + GAP;
    });
    var sheet = document.createElement('canvas'); sheet.width = sheetW; sheet.height = sheetH;
    var ctx = sheet.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.imageSmoothingEnabled = true;
    var y = GAP;
    cells.forEach(function (cl) {
      ctx.drawImage(src, cl.x, cl.y, cl.w, cl.h, 0, y, cl.w * cl.sc, cl.h * cl.sc);
      y += cl.h * cl.sc + GAP;
    });
    return sheet;
  }

  // The fine cells for the stamp pass's block-mode reads: the 25%–100% band
  // (wall clutter lives in the top quarter), three rows with a whisker of
  // vertical overlap and three columns with half a column of overlap, each
  // blown up so small sill stamps become large glyphs. Read one at a time.
  function _stampCells(bmp, maxDim) {
    var sc0 = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var W = Math.max(3, Math.round(bmp.width * sc0)), H = Math.max(3, Math.round(bmp.height * sc0));
    var src = document.createElement('canvas'); src.width = W; src.height = H;
    var sctx = src.getContext('2d');
    sctx.drawImage(bmp, 0, 0, W, H);
    var d = sctx.getImageData(0, 0, W, H), px = d.data;
    for (var i = 0; i < px.length; i += 4) {
      var m = Math.min(px[i], px[i + 1], px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = m;
    }
    sctx.putImageData(d, 0, 0);
    var yLo = Math.floor(H * 0.25), BH = H - yLo;
    var over = Math.floor(W / 12), vPad = Math.floor(BH * 0.06);
    var out = [];
    for (var rI = 0; rI < 3; rI++) {
      var y0 = Math.max(yLo, yLo + Math.floor(BH * rI / 3) - vPad);
      var y1 = Math.min(H, yLo + Math.floor(BH * (rI + 1) / 3) + vPad);
      if (y1 - y0 < 3) continue;
      for (var cI = 0; cI < 3; cI++) {
        var x0 = Math.max(0, Math.floor(W * cI / 3) - over);
        var x1 = Math.min(W, Math.floor(W * (cI + 1) / 3) + over);
        var cw = x1 - x0, ch = y1 - y0;
        if (cw < 3) continue;
        var sc = Math.max(2, Math.min(6, Math.floor(2900 / cw) || 2));
        var cell = document.createElement('canvas');
        cell.width = cw * sc; cell.height = ch * sc;
        var cctx = cell.getContext('2d');
        cctx.imageSmoothingEnabled = true;
        cctx.drawImage(src, x0, y0, cw, ch, 0, 0, cw * sc, ch * sc);
        out.push(cell);
      }
    }
    // ── v0.9.1107 — the sill strips (Brad's 6175: "this should be easy...
    // why is this not picking up"). The number lives on the car's side sill —
    // a THIN line of text that drowns inside a tall cell full of body and
    // background. Sliding half-overlapping thin bands, two columns, blown up
    // hard, read the sill as the text LINE it is. His own photo reads "6175"
    // this way and no other. These run last within the pass, so the early
    // exit prunes them on every photo an earlier stage resolves.
    var bandH = Math.max(8, Math.floor(BH / 4));
    var step = Math.max(4, Math.floor(bandH / 2));
    for (var yS = yLo, bIdx = 0; yS + bandH <= H && bIdx < 8; yS += step, bIdx++) {
      for (var cS = 0; cS < 2; cS++) {
        var sx0 = Math.max(0, Math.floor(W * cS / 2) - Math.floor(W / 8));
        var sx1 = Math.min(W, Math.floor(W * (cS + 1) / 2) + Math.floor(W / 8));
        var sw = sx1 - sx0;
        if (sw < 8) continue;
        var sSc = Math.max(2, Math.min(8, Math.floor(3200 / sw) || 2));
        var strip = document.createElement('canvas');
        strip.width = sw * sSc; strip.height = bandH * sSc;
        var sctx2 = strip.getContext('2d');
        sctx2.imageSmoothingEnabled = true;
        sctx2.drawImage(src, sx0, yS, sw, bandH, 0, 0, sw * sSc, bandH * sSc);
        out.push(strip);
      }
    }
    return out;
  }

  function _auditCanvas(bmp, maxDim, mode) {
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    if (mode === 'current') {
      try { ctx.filter = 'grayscale(1) contrast(1.3)'; } catch (e) {}
      ctx.drawImage(bmp, 0, 0, w, h);
      return c;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    return _applyMode(c, mode);
  }



  // Round 2. sharp6 won round 1 and is now the shipping default, so it is the
  // baseline every new idea has to beat. Each of the others attacks a specific
  // failure seen in Brad's 73: light lettering on a dark body (inverted),
  // letters being confused for digits (digits-only), and a number that is a
  // tiny part of a wide shelf photo (tiled — the single most common shape in
  // his inbox, and the one a whole-image pass is worst at).
  // One horizontal band of the photo, scaled up to the same working size, so
  // the lettering inside it is physically larger for the reader.
  function _auditTile(bmp, maxDim, mode, index, count) {
    var bh = Math.floor(bmp.height / count);
    var y0 = index * bh;
    var h0 = (index === count - 1) ? (bmp.height - y0) : bh;
    var sc = Math.min(3, maxDim / Math.max(bmp.width, h0));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(h0 * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, y0, bmp.width, h0, 0, 0, w, h);
    // v0.9.1082: the band gets the SAME treatment as the whole frame. It used to
    // get a plain stretch regardless of the pass, which quietly disabled every
    // preprocessing idea on the pass that works best.
    try { return _applyMode(c, mode); } catch (e) { try { _stretchCanvas(c); } catch (e2) {} }
    return c;
  }

})();
