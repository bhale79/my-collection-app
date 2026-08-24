// ═══════════════════════════════════════════════════════════════
// import-core.js — Task #25 Phase 1 (Session 81). PURE LOGIC ONLY.
//
// Everything here is a plain function: no DOM, no state object, no
// network. import-ui.js owns the screens and the writes; the relay
// owns the AI. This split exists so `node tests/import_core_tests.js`
// can prove the parsing/matching brain against the standing fixture
// (Scott_Inventory_TEST_FIXTURE.xlsx) without a browser.
//
// Standing rules honored here:
//  - SUFFIX RULE (Brad, Session 80): an exact item-number match ALWAYS
//    wins and suffixes are NEVER silently stripped. Atlas 0936-1 and
//    0936-2 are real, different items. Base-number candidates are only
//    ever OFFERED (didYouMean), never auto-applied.
//  - Scott is the ceiling, not the norm: every function degrades to
//    "nothing detected" on a plain 5-column sheet without complaining.
//  - AI suggests, user confirms, deterministic code writes: nothing in
//    this file trusts an AI answer; the mapping that reaches
//    rrImpApplyMapping has always been confirmed by the user first.
// ═══════════════════════════════════════════════════════════════

/* eslint-disable no-var */

// ── Cell normalization ──────────────────────────────────────────
// ExcelJS cell values arrive as strings, numbers, dates, rich text,
// formula results, or hyperlink objects. One funnel to a trimmed string.
function rrImpNormCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') {
    // Keep integers clean (1946 not 1946.0); cap float noise.
    return (v % 1 === 0) ? String(v) : String(Math.round(v * 10000) / 10000);
  }
  if (v instanceof Date) {
    // v0.9.1512 (Brad's export audit: 137 of Scott's SCALE cells came through
    // as "Fri Dec 29 1899 19:43" — Excel silently converts entries like 1:20
    // or 7:38 into times). A 1899/1900 date is Excel's zero-epoch fingerprint,
    // not a date anyone typed: recover the ORIGINAL text where the sheet kept
    // it, otherwise return blank rather than store a nonsense timestamp.
    if (v.getFullYear() <= 1900) return '';
    // Date-only render — imports care about "when", not the midnight.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'object') {
    if (v.richText && Array.isArray(v.richText)) {
      return v.richText.map(function (t) { return t.text || ''; }).join('').trim();
    }
    if (v.result !== undefined) return rrImpNormCell(v.result);   // formula
    if (v.text !== undefined) return rrImpNormCell(v.text);       // hyperlink
    if (v.hyperlink !== undefined) return rrImpNormCell(v.hyperlink);
    if (v.error !== undefined) return '';
  }
  return String(v).trim();
}

// ── Header-row detection ────────────────────────────────────────
// Input: first N rows of a tab as arrays of normalized strings.
// Output: 0-based index of the most header-like row, or -1 if the tab
// has no plausible header (e.g. a stray notes tab).
//
// What makes a row a header, measured on real sheets (Session 80):
//  - several distinct, short, non-numeric strings ("Item #", "Brand"…)
//  - the row BELOW it looks like data (some cells, not all identical)
//  - title rows above headers are usually ONE value repeated across a
//    merged range ("Scott Knerr's Lionel Trains" × 11) — near-zero
//    distinct count kills their score.
function rrImpDetectHeaderRow(rows) {
  var bestIdx = -1, bestScore = 0;
  var scan = Math.min(rows.length, 8);
  for (var i = 0; i < scan; i++) {
    var cells = (rows[i] || []).map(rrImpNormCell).filter(function (c) { return c !== ''; });
    if (cells.length < 2) continue;
    var distinct = {};
    cells.forEach(function (c) { distinct[c.toLowerCase()] = 1; });
    var nDistinct = Object.keys(distinct).length;
    if (nDistinct < 2) continue;                       // merged title row
    var short = cells.filter(function (c) { return c.length <= 40; }).length;
    var texty = cells.filter(function (c) { return !/^[\d.,$%\-\/\s]+$/.test(c); }).length;
    var score = nDistinct * 2 + short + texty * 2;
    // The row below should exist and hold SOMETHING that isn't a repeat
    // of this row (headers directly above data).
    var below = rows[i + 1] ? rows[i + 1].map(rrImpNormCell).filter(function (c) { return c !== ''; }) : [];
    if (below.length === 0) score -= 6;
    // Prefer earlier rows on ties: real headers sit high in the sheet.
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  // Floor: a "header" of fewer than 2 distinct labels is not a header.
  return bestScore >= 8 ? bestIdx : -1;
}

// ── Layout signatures & grouping ────────────────────────────────
function rrImpNormHeader(h) {
  return rrImpNormCell(h).toLowerCase().replace(/\s+/g, ' ').trim();
}
function rrImpLayoutKey(headers) {
  return headers.map(rrImpNormHeader).filter(function (h) { return h !== ''; }).join('|');
}

// Group tabs whose headers are the same or nearly the same, so the user
// confirms a mapping ONCE per family ("apply to all matching tabs").
// Nearly: every header of the smaller set appears in the larger, or the
// two differ by at most maxDiff names (covers "Description" vs
// "Description/Type", and Menards' missing "Paid").
// Mapping is header-NAME-keyed, never position-keyed, so tabs in one
// family may lay their columns out differently and still map right.
function rrImpGroupLayouts(tabs, maxDiff) {
  if (maxDiff === undefined) maxDiff = 2;
  var groups = [];   // { key, headerSet, tabs: [] }
  tabs.forEach(function (tab) {
    if (!tab.headers || tab.headers.length === 0) {
      groups.push({ key: '(no headers: ' + tab.name + ')', headerSet: {}, tabs: [tab] });
      return;
    }
    var hs = {};
    tab.headers.forEach(function (h) { var n = rrImpNormHeader(h); if (n) hs[n] = 1; });
    var placed = false;
    for (var g = 0; g < groups.length; g++) {
      var ghs = groups[g].headerSet;
      var gKeys = Object.keys(ghs), tKeys = Object.keys(hs);
      if (gKeys.length === 0) continue;
      var shared = tKeys.filter(function (k) { return ghs[k]; }).length;
      var diff = (gKeys.length - shared) + (tKeys.length - shared);
      var overlapOk = shared >= Math.max(2, Math.min(gKeys.length, tKeys.length) - maxDiff);
      if (overlapOk && diff <= maxDiff * 2 && shared >= Math.ceil(Math.max(gKeys.length, tKeys.length) * 0.6)) {
        groups[g].tabs.push(tab);
        // Union the header set so later near-matches compare to the family.
        tKeys.forEach(function (k) { ghs[k] = 1; });
        placed = true; break;
      }
    }
    if (!placed) groups.push({ key: rrImpLayoutKey(tab.headers), headerSet: hs, tabs: [tab] });
  });
  return groups;
}

// ── Fill (formatting) detection ─────────────────────────────────
// Standard Excel indexed palette (fallback when the workbook does not
// override it). Only the slots that ever show up in the wild.
var RR_IMP_DEFAULT_INDEXED = [
  'FF000000', 'FFFFFFFF', 'FFFF0000', 'FF00FF00', 'FF0000FF', 'FFFFFF00',
  'FFFF00FF', 'FF00FFFF', 'FF000000', 'FFFFFFFF', 'FFFF0000', 'FF00FF00',
  'FF0000FF', 'FFFFFF00', 'FFFF00FF', 'FF00FFFF', 'FF800000', 'FF008000',
  'FF000080', 'FF808000', 'FF800080', 'FF008080', 'FFC0C0C0', 'FF808080',
  'FF9999FF', 'FF993366', 'FFFFFFCC', 'FFCCFFFF', 'FF660066', 'FFFF8080',
  'FF0066CC', 'FFCCCCFF', 'FF000080', 'FFFF00FF', 'FFFFFF00', 'FF00FFFF',
  'FF800080', 'FF800000', 'FF008080', 'FF0000FF', 'FF00CCFF', 'FFCCFFFF',
  'FFCCFFCC', 'FFFFFF99', 'FF99CCFF', 'FFFF99CC', 'FFCC99FF', 'FFFFCC99',
  'FF3366FF', 'FF33CCCC', 'FF99CC00', 'FFFFCC00', 'FFFF9900', 'FFFF6600',
  'FF666699', 'FF969696', 'FF003366', 'FF339966', 'FF003300', 'FF333300',
  'FF993300', 'FF993366', 'FF333399', 'FF333333',
];

// Parse a custom <indexedColors> palette out of xl/styles.xml (Numbers
// exports carry one — Scott's reds live at indexes 13/14 of HIS palette,
// which the default palette calls yellow/magenta. Check the palette.)
function rrImpPaletteFromStylesXml(xml) {
  if (!xml) return null;
  var m = /<indexedColors>([\s\S]*?)<\/indexedColors>/.exec(xml);
  if (!m) return null;
  var out = [];
  var re = /rgb="([0-9A-Fa-f]{8})"/g, r;
  while ((r = re.exec(m[1])) !== null) out.push(r[1].toUpperCase());
  return out.length ? out : null;
}

// fgColor object ({argb} | {indexed} | {theme}) → 'RRGGBB' hex or null.
function rrImpResolveFillRgb(fgColor, palette) {
  if (!fgColor) return null;
  if (fgColor.argb) return String(fgColor.argb).toUpperCase().slice(-6);
  if (fgColor.indexed !== undefined) {
    var pal = (palette && palette[fgColor.indexed]) ? palette
            : RR_IMP_DEFAULT_INDEXED;
    var argb = pal[fgColor.indexed];
    return argb ? String(argb).toUpperCase().slice(-6) : null;
  }
  return null;   // theme colors: not resolvable without the theme part; sig still groups them
}

function rrImpFillSig(fill) {
  if (!fill || fill.type !== 'pattern' || !fill.pattern || fill.pattern === 'none') return '';
  var fg = fill.fgColor || {};
  if (fg.argb) return 'argb:' + String(fg.argb).toUpperCase();
  if (fg.indexed !== undefined) return 'idx:' + fg.indexed;
  if (fg.theme !== undefined) return 'theme:' + fg.theme + ':' + (fg.tint || 0);
  return 'pat:' + fill.pattern;
}

function rrImpColorDistance(a, b) {   // 'RRGGBB' × 2 → number
  if (!a || !b) return 999;
  var pr = parseInt(a.slice(0, 2), 16) - parseInt(b.slice(0, 2), 16);
  var pg = parseInt(a.slice(2, 4), 16) - parseInt(b.slice(2, 4), 16);
  var pb = parseInt(a.slice(4, 6), 16) - parseInt(b.slice(4, 6), 16);
  return Math.sqrt(pr * pr + pg * pg + pb * pb);
}

// tabs: [{ name, rows: [{ fillSig, fillRgb, rowIdx }] }] (data rows only).
// Returns question-worthy fill groups: the BACKGROUND (most common sig,
// or any sig covering the majority of rows) is never asked about, and
// near-identical colors merge into one group (Scott's two salmons = ONE
// "what does red mean?" question, not two).
function rrImpFillGroups(tabs) {
  var counts = {};   // sig → { count, rgb, tabs:{}, samples:[] }
  var total = 0;
  tabs.forEach(function (tab) {
    (tab.rows || []).forEach(function (row) {
      total++;
      var sig = row.fillSig || '';
      if (!counts[sig]) counts[sig] = { sig: sig, count: 0, rgb: row.fillRgb || null, tabs: {}, samples: [] };
      counts[sig].count++;
      counts[sig].tabs[tab.name] = 1;
      if (counts[sig].samples.length < 3) counts[sig].samples.push({ tab: tab.name, rowIdx: row.rowIdx });
    });
  });
  var sigs = Object.keys(counts).map(function (k) { return counts[k]; });
  if (sigs.length <= 1) return [];
  // Background = the single most common signature (plain sheets: the ''
  // no-fill sig; Scott's sheet: the gray idx:12 on every ordinary row).
  sigs.sort(function (a, b) { return b.count - a.count; });
  var background = sigs[0];
  var candidates = sigs.slice(1).filter(function (s) {
    // A "group" the user should be asked about is a MINORITY highlight,
    // not a second background: <40% of rows, at least 2 rows.
    return s.count >= 2 && s.count < total * 0.4;
  });
  // Merge visually-near colors into one group.
  var merged = [];
  candidates.forEach(function (c) {
    for (var i = 0; i < merged.length; i++) {
      if (c.rgb && merged[i].rgb && rrImpColorDistance(c.rgb, merged[i].rgb) < 40) {
        merged[i].count += c.count;
        merged[i].sigs.push(c.sig);
        Object.keys(c.tabs).forEach(function (t) { merged[i].tabs[t] = 1; });
        merged[i].samples = merged[i].samples.concat(c.samples).slice(0, 3);
        return;
      }
    }
    merged.push({ sigs: [c.sig], rgb: c.rgb, count: c.count, tabs: c.tabs, samples: c.samples });
  });
  merged.forEach(function (m) { m.tabNames = Object.keys(m.tabs); delete m.tabs; });
  merged.sort(function (a, b) { return b.count - a.count; });
  return merged;
}

// ── Heuristic column mapping (the no-AI fallback) ───────────────
// Header-name → app field. The AI proposes the same shape; either way
// the user confirms before anything is applied. Field names are the
// PERSONAL_SCHEMA field names, plus three import-only pseudo-fields:
//   rawGrade   → "Your Grade" column (kept verbatim; conversion table
//                fills `condition` separately)
//   yourDesc   → "Your Description" testimony column
//   ignore     → explicit don't-import
var RR_IMP_HEADER_SYNONYMS = [
  { field: 'itemNum',      re: /^(item\s*#|item\s*(number|num|no\.?)|catalog\s*#?|cat\s*(no|num)|sku|number|#)$/ },
  { field: 'manufacturer', re: /^(brand|manufacturer|maker|mfg|mfr|make)$/ },
  { field: 'gauge',        re: /^(scale|gauge|scale\/gauge)$/ },
  { field: 'yourDesc',     re: /^(description|desc|description\/type|item|name|title|item\s*description)$/ },
  { field: 'rawGrade',     re: /^(condition|cond|grade|grading|condition\s*\(.*\)|c\d+)$/ },
  { field: 'location',     re: /^(location|storage\s*location|storage|where|box\s*location|shelf)$/ },
  { field: 'priceItem',    re: /^(paid|price\s*paid|cost|purchase\s*price|bought\s*for|my\s*cost)$/ },
  { field: 'userEstWorth', re: /^(value|worth|est\.?\s*(value|worth)|estimated\s*value|current\s*value|user\s*est\.?\s*worth)$/ },
  { field: 'yearMade',     re: /^(year|year\s*made|date\s*made|era|produced)$/ },
  { field: 'notes',        re: /^(notes?|comments?|remarks?)$/ },
  { field: 'roadName',     re: /^(road\s*name|railroad|road)$/ },
  { field: 'roadNumber',   re: /^(road\s*(number|num|no\.?)|cab\s*(number|no\.?))$/ },
  { field: 'hasBox',       re: /^(has\s*box|box\??|boxed|ob|original\s*box)$/ },
  { field: 'datePurchased', re: /^(date\s*(purchased|bought|acquired)|purchased|acquired)$/ },
  { field: 'purchasedFrom', re: /^(purchased\s*from|bought\s*from|seller|source|dealer)$/ },
  { field: 'quantity',     re: /^(qty|quantity|count|copies|how\s*many)$/ },
  // Session 85 (Brad, over Lyle's fullnumber.xlsx): a photo-filename column
  // is a first-class mapping target — photos import WITH the import.
  { field: 'photoFile',    re: /^(photos?|photo\s*file(name)?s?|images?|image\s*file(name)?s?|pictures?|pics?)$/ },
  // v0.9.1514 (Phase 2): the user columns are real mapping targets now.
  { field: 'locationDetail', re: /^(location\s*detail|sub\s*location|tote|shelf|bin|spot)$/ },
  { field: 'shipper',        re: /^(shipper|shipping\s*box|outer\s*box|carton)$/ },
  { field: 'subCollection',  re: /^(sub[-\s]*collection|collection|series|grouping|set\s*name)$/ },
];

// headers: raw header strings → { map: { headerNorm: field }, unmapped: [names] }
function rrImpHeuristicMap(headers) {
  var map = {}, unmapped = [], used = {};
  headers.forEach(function (h) {
    var n = rrImpNormHeader(h);
    if (!n) return;
    if (map[n] !== undefined) return;   // duplicate header name — first wins
    var hit = null;
    for (var i = 0; i < RR_IMP_HEADER_SYNONYMS.length; i++) {
      if (RR_IMP_HEADER_SYNONYMS[i].re.test(n)) { hit = RR_IMP_HEADER_SYNONYMS[i].field; break; }
    }
    // One column per field (except ignore): a second "Value"-ish column
    // stays unmapped for the user to place.
    if (hit && hit !== 'ignore' && used[hit]) hit = null;
    if (hit) { map[n] = hit; used[hit] = 1; }
    else unmapped.push(n);
  });
  return { map: map, unmapped: unmapped };
}

// ── Applying a confirmed mapping ────────────────────────────────
// tab: { name, headers, rows: [{ cells, rowIdx, fillSig, fillRgb }] }
// mapping: { headerNorm: field } — CONFIRMED by the user.
// Returns staged items (still raw — triage/conversion come after):
//   { itemNum, manufacturer, gauge, yourDesc, rawGrade, location,
//     priceItem, userEstWorth, ..., quantity, fillSig, fillRgb,
//     srcTab, srcRow }
function rrImpApplyMapping(tab, mapping) {
  var colField = [];   // column index → field
  (tab.headers || []).forEach(function (h, i) {
    var f = mapping[rrImpNormHeader(h)];
    colField[i] = f && f !== 'ignore' ? f : null;
  });
  var out = [];
  (tab.rows || []).forEach(function (row) {
    var item = { srcTab: tab.name, srcRow: row.rowIdx, fillSig: row.fillSig || '', fillRgb: row.fillRgb || null };
    var any = false;
    (row.cells || []).forEach(function (cell, i) {
      var f = colField[i];
      if (!f) return;
      var v = rrImpNormCell(cell);
      if (v === '') return;
      if (item[f] === undefined) { item[f] = v; any = true; }
    });
    if (any) out.push(item);
  });
  return out;
}

// ── Reading the item TYPE out of the description ────────────────
// v0.9.1526 (Brad: "many of the descriptions have the types listed as in
// flat car engine etc — can we not run something to decipher this").
//
// Measured on Scott's real sheet before it was built: 2,466 of 3,370
// descriptions (73%) carry their own type in plain words, and tuning the
// misses he could see ("Fort Knox MINT CAR", "Automatic GATEMAN", "#164 LOG
// LOADER", "FT 10\" STRAIGHT", "Strasburg Freight 2 PACK") lifts it further.
// This is deliberately NOT an AI call: "Flatcar" in the text is not a
// judgment call, and a table costs nothing, runs in a millisecond, and can
// be tested. What it CANNOT read stays blank and lands in "Needs details" —
// a blank type is honest, a wrong one is not.
//
// ORDER IS THE ALGORITHM. First match wins, so the list runs from the most
// specific evidence to the loosest:
//   1. Paper goods first  — a "Boxcar catalog" is a CATALOG, not a boxcar,
//      and the word boxcar appears in half of them.
//   2. Sets before car types — "Strasburg Freight 2 Pack" is a set even
//      though "freight" is in it.
//   3. Named car bodies before the generic engine words, because "Mint Car
//      with Diesel" should be the car.
//   4. Accessories LAST among the specifics: "log loader" contains "log",
//      "coal ramp" contains "coal", and those must not be read as loads.
// The vocabulary is the one the app already uses (photo inbox _PIN_TYPES),
// so imported items filter alongside everything else.
var RR_IMP_TYPE_RULES = [
  // 1. paper / printed
  [/\bcatalog(ue)?\b|\bwish ?book\b/i, 'Catalog'],
  [/\bbook\b|\bmanual\b|\bblueprint\b|\bpaper\b|\bposter\b|\bbrochure\b|\bmagazine\b|advertis|\bcalendar\b|\bpostcard\b|\bdecal\b|instruction sheet|\bpaperwork\b/i, 'Paper'],
  // 2. sets and multi-packs
  [/\btrain set\b|\bstarter set\b|\bready[- ]to[- ]run set\b|\bset\b(?=\s*$)|\d\s*[- ]?pack\b|\bpack\b(?=\s*$)|\badd[- ]?on\b/i, 'Set'],
  // 3. power / control
  [/\btransformer\b|\bZW\b|\bKW\b|\bLW\b|\bRW\b|\bTW\b|power ?(supply|master|house)|\bcontroller\b|\brheostat\b|\bCW-?80\b/i, 'Transformer'],
  // 4. track and wiring
  [/\btrack\b|\bswitch(es)?\b|\bturnout\b|\bfas ?track\b|\bo-?27\b|\bstraight\b|\bcurve\b|\bbumpers?\b|re-?railer|rail joiner|\bterminal (section|joiner)\b|\bwire spool\b|\btie end\b|\buncoupling section\b|\bcrossover\b|\btrestle set\b/i, 'Track'],
  // 5. named car bodies
  [/\bcaboose\b|\bcabin car\b|\bbobber\b|\bN5C\b|\bwork caboose\b/i, 'Caboose'],
  [/\btender\b/i, 'Tender'],
  [/\bflat ?car\b|\bflatcar\b|depressed cent|\bTOFC\b|piggy ?back|\bbulkhead\b|\bmaxi-?I?V?\b|\bwell car\b|\bcontainer\b|\bskeleton log\b/i, 'Flatcar'],
  [/\bbox ?car\b|\bboxcar\b|\breefer\b|refrigerat|\bstock car\b|\bcattle car\b|\bmint car\b|\bDD box\b|\bplug door\b|\bhi-?cube\b|\bbunk car\b/i, 'Boxcar'],
  // v0.9.1526: Lionel's novelty car names carry no body word at all —
  // "TV Car", "Animal Car", "Auto Carrier". Named here or they read as
  // nothing. Combo/combine is a PASSENGER car, so it sits with those.
  [/\bauto ?(carrier|rack)\b|\bcar carrier\b|\bTV car\b|\banimal car\b|\bcircus car\b|\bhorse car\b|\bcoal dump\b/i, 'Freight Car'],
  [/\bgondola\b|\bgon\b/i, 'Gondola'],
  [/\btank ?car\b|\btanker\b/i, 'Tank Car'],
  [/\bhopper\b|covered hop|\bore car\b|\bquad hop\b|\bcoal car\b|\bballast car\b/i, 'Hopper'],
  [/\bpassenger\b|\bcoach\b|\bpullman\b|\bobservation\b|\bcombine\b|vista ?dome|\bbaggage\b|\bdiner\b|\bRPO\b|streamliner|\bmadison\b|\bheavyweight\b|\baluminum car\b|\bcombo car\b|\bfull vista\b/i, 'Passenger Car'],
  // 6. engines — after the cars, so "Mint Car w/ diesel sound" stays a car
  [/\blocomotive\b|\bloco\b|\bengine\b|\bdiesel\b|\bsteam\b|\bGP-?\d|\bF-?[37]\b|\bSD-?\d|\bALCO\b|\bswitcher\b|\bNW-?2\b|\bGG-?1\b|\bberkshire\b|\bhudson\b|\bpacific\b|\bmikado\b|\bnorthern\b|\bRS-?\d|\bU\d\dB?\b|\bC-?4\d\d\b|\bdocksider\b|\btrainmaster\b|\bFA-?\d|\bPA-?\d|\bbig boy\b|\bchallenger\b|\bshay\b|\btrolley\b|\bmotorized unit\b|\b\d-[468]-\d\b|\bpowered\b|\bunpowered\b|\bdummy\b|\bA-?B-?A\b|\bAA set\b|\b[AB] ?unit\b|\bcab unit\b|\brail ?sounds?\b/i, 'Engine'],
  // 7. work / operating freight with no body word of its own
  [/\bcrane\b|\bwork car\b|\bsearchlight\b|\bderrick\b|\bdump car\b|\blog car\b|\bmilk car\b|\bvat car\b|\bhelper\b|\bsnow plow\b|\bpoultry\b|\bsubmarine car\b|\bmissile\b|\bexploding\b|\baquarium\b|\bgiraffe\b/i, 'Freight Car'],
  // 8. accessories LAST — "log loader", "coal ramp", "water tower"
  [/\bstation\b|\btower\b|\bbridge\b|\btrestle\b|water tank|water tower|coal (loader|ramp|bin|tipple)|\bbuilding\b|\bhouse\b|\bbarn\b|\bplatform\b|\bcrossing\b|\bbillboard\b|street ?light|\blamp\b|\bfigure|\bpeople\b|\btree|\bscenery\b|accessor|\bsign(al)?\b|\bshed\b|\bdepot\b|\bmill\b|\bfactory\b|\bgateman\b|\bwatchman\b|\bloader\b|\bunloader\b|\bicing\b|\bsawmill\b|\bdiner\b|\bfreight shed\b|\byard light\b|\bfloodlight\b|\bsemaphore\b|\bcorral\b|\btractor\b|\btrailer\b|\bvehicle\b|\bfire car\b|\bshop\b|\bstore\b|\bstand\b|\bhotel\b|\bmotel\b|\brink\b|\bgolf\b|\bswings\b|\bbeacon\b|\bdock\b|\bflag ?pole\b|\bfence\b|\bsilo\b|\belevator\b|\bwindmill\b|\bchurch\b|\bschool\b|\bbank\b|\bcafe\b|\bcafé\b|\brestaurant\b|\bbakery\b|\bmarket\b|\bgarage\b|\bfirehouse\b|\bhospital\b|\boil tank\b|\bgas station\b|\bpump\b|\bcrossing gate\b|\blights?\b|\bpylon\b|\bbillboard\b/i, 'Accessory'],
];

// One description in, one type out (or '' when it says nothing useful).
function rrImpTypeFromText(text) {
  var s = rrImpNormCell(text);
  if (!s) return '';
  for (var i = 0; i < RR_IMP_TYPE_RULES.length; i++) {
    if (RR_IMP_TYPE_RULES[i][0].test(s)) return RR_IMP_TYPE_RULES[i][1];
  }
  return '';
}

// Reads a whole staged list and reports what it found, grouped, with real
// examples — so the screen can show the user what it is about to do instead
// of announcing a number they have to take on faith.
function rrImpTypeSurvey(items, opts) {
  var o = opts || {};
  var groups = {};
  var read = 0, blank = 0;
  (items || []).forEach(function (it) {
    if (o.onlyEmpty && rrImpNormCell(it.itemType)) return;
    var text = rrImpNormCell(it.yourDesc) || rrImpNormCell(it.description) || '';
    var t = rrImpTypeFromText(text);
    if (!t) { blank++; return; }
    read++;
    if (!groups[t]) groups[t] = { type: t, count: 0, examples: [] };
    groups[t].count++;
    if (groups[t].examples.length < 3) groups[t].examples.push(text.slice(0, 70));
  });
  var list = Object.keys(groups).map(function (k) { return groups[k]; })
    .sort(function (a, b) { return b.count - a.count; });
  return { groups: list, read: read, blank: blank };
}

// ── Tabs that cannot possibly match the catalog ─────────────────
// v0.9.1529 (Brad: his Books tab imported with no type and no maker). The
// "what kind of things are these?" question is only asked for a tab the AI
// judged NOT to be trains — and this time it read Books as trains, so nobody
// was asked and 115 books arrived untyped.
//
// This is the deterministic half of the fix. A row with no item number has
// nothing to match against, so a tab that is mostly numberless is not a list
// of catalogue items whatever anyone thinks. Measured on Scott's sheet:
// Books 100% numberless, Trotta's Trains 98%, RGS 79%, Lionel 1/120 100% —
// against Lionel 2%, Atlas 1%, MTH 3%. The gap is wide and the signal clean.
// (It does NOT catch a non-train tab that HAS numbers, like his Vehicles or
// Wings of Texaco — those are caught after matching, by their match rate.)
function rrImpNumberlessShare(items) {
  var list = items || [];
  if (!list.length) return 0;
  var none = 0;
  for (var i = 0; i < list.length; i++) {
    if (!rrImpNormCell(list[i].itemNum)) none++;
  }
  return none / list.length;
}
// Enough rows to be sure, and lopsided enough to be certain.
function rrImpTabIsNonCatalog(items) {
  var list = items || [];
  if (list.length < 10) return false;
  return rrImpNumberlessShare(list) >= 0.6;
}

// ── Reading the user's own words to settle a tie ────────────────
// v0.9.1533 (Brad, on the picker: "the description says pennsylvania so why
// do we not match it. there could be a reason, so tell me if there is").
// The reason was real: the matcher works on the NUMBER, narrowed by maker and
// his digit-length era rule. It never read a word of anyone's description. So
// his row "Pennsylvania '6464' Blue Boxcar METCA" sat next to a Long Island
// center-beam flatcar and a PRR 6464 dark blue boxcar, and the app had no
// opinion — three agreements against zero, invisible to it.
//
// Evidence is counted by CATEGORY, not by word, so a long description cannot
// bully a short one: road name, a distinctive number quoted in the text, a
// colour, and a body type each count once. A candidate wins only by winning
// on more categories than every other, and only with at least two — one
// shared word is a coincidence, two independent ones is a match.
var _RR_COLORS = ['black','blue','brown','cream','green','grey','gray','maroon','orange','red','silver','tuscan','white','yellow','gold','copper','bronze'];
var _RR_BODIES = ['boxcar','flatcar','gondola','hopper','caboose','reefer','tank car','stock car','tender','locomotive','loco','engine','coach','observation','baggage','crane','dump car'];

function _rrImpWords(s) { return rrImpNormCell(s).toLowerCase(); }
// Numbers a human would quote to identify a model — 3+ digits, so a road
// number or a series like 6464 counts and "2 pack" does not.
function _rrImpQuotedNums(s) {
  var out = {}, m, re = /\b(\d{3,6})\b/g, t = _rrImpWords(s);
  while ((m = re.exec(t)) !== null) out[m[1]] = 1;
  return Object.keys(out);
}
function rrImpScoreCandidate(userText, master, selfNum) {
  var u = _rrImpWords(userText);
  if (!u) return { score: 0, why: [] };
  var c = _rrImpWords((master.roadName || '') + ' ' + (master.description || '') + ' ' +
                      (master.varDesc || '') + ' ' + (master.itemType || ''));
  var why = [];
  // 1. road name — the most telling single fact on a train
  var road = _rrImpWords(master.roadName);
  if (road) {
    var head = road.split(/\s+/)[0];
    if (head.length >= 4 && u.indexOf(head) >= 0) why.push(master.roadName);
  }
  // 2. a number quoted in BOTH texts, other than the catalogue number itself
  var mine = _rrImpQuotedNums(userText), theirs = {}, hit = '';
  _rrImpQuotedNums((master.description || '') + ' ' + (master.varDesc || '')).forEach(function (n) { theirs[n] = 1; });
  for (var i = 0; i < mine.length; i++) {
    if (theirs[mine[i]] && mine[i] !== rrImpNormCell(selfNum)) { hit = mine[i]; break; }
  }
  if (hit) why.push('#' + hit);
  // 3. colour
  for (var k = 0; k < _RR_COLORS.length; k++) {
    if (u.indexOf(_RR_COLORS[k]) >= 0 && c.indexOf(_RR_COLORS[k]) >= 0) { why.push(_RR_COLORS[k]); break; }
  }
  // 4. body type
  for (var b = 0; b < _RR_BODIES.length; b++) {
    if (u.indexOf(_RR_BODIES[b]) >= 0 && c.indexOf(_RR_BODIES[b]) >= 0) { why.push(_RR_BODIES[b]); break; }
  }
  return { score: why.length, why: why };
}
// Returns {index, why} when one candidate is the clear answer, else null.
function rrImpPickByDescription(userText, candidates, selfNum) {
  var list = candidates || [];
  if (list.length < 2) return null;
  var best = -1, bestScore = 0, second = 0, bestWhy = [];
  for (var i = 0; i < list.length; i++) {
    var r = rrImpScoreCandidate(userText, list[i], selfNum);
    if (r.score > bestScore) { second = bestScore; bestScore = r.score; best = i; bestWhy = r.why; }
    else if (r.score > second) { second = r.score; }
  }
  if (best < 0 || bestScore < 2 || bestScore === second) return null;
  return { index: best, why: bestWhy };
}
// Candidates that are the SAME catalogue item differing only by variation
// (Brad's 28069: the base Century Club Niagara and "variation 3 — yellow",
// rendered identically on screen). When his own row says nothing about which,
// the base entry is the honest default — it is the item, not a colour of it.
function rrImpOnlyVariationDiffers(candidates) {
  var list = candidates || [];
  if (list.length < 2) return false;
  var sig = function (m) {
    return rrImpNormCell(m._era) + '|' + _rrImpWords(m.description) + '|' + _rrImpWords(m.roadName);
  };
  var first = sig(list[0]);
  for (var i = 1; i < list.length; i++) if (sig(list[i]) !== first) return false;
  return true;
}
function rrImpBaseVariationIndex(candidates) {
  var list = candidates || [];
  for (var i = 0; i < list.length; i++) {
    if (!rrImpNormCell(list[i].variation)) return i;
  }
  return -1;
}

// ── Other ways people write the same number ─────────────────────
// v0.9.1538. The triage screen has been promising a "fix-up picker" for rows
// that are close to a catalogue number — Brad's example was "1666 T", which
// is Lionel's 1666T with a space in it. Until now the only near-miss we
// looked for was the SUFFIX BASE (0936-1 → 0936), so a spacing or punctuation
// difference found nothing at all.
//
// These are SPELLINGS of the same number, not different numbers: spaces,
// dashes and letter case. Nothing here changes what the number MEANS, and
// per the standing suffix rule none of it is ever applied automatically —
// every hit is an offer the user accepts or declines.
function rrImpNumberVariants(num) {
  var n = rrImpNormCell(num);
  if (!n) return [];
  var out = {}, add = function (v) {
    v = String(v || '').trim();
    if (v && v !== n) out[v] = 1;
  };
  var squashed = n.replace(/\s+/g, '');
  add(squashed);                          // "1666 T" → "1666T"
  add(n.replace(/\s+/g, '-'));            // "1666 T" → "1666-T"
  add(squashed.replace(/-/g, ''));        // "6-8912" → "68912"
  add(squashed.toUpperCase());
  // a trailing letter joined to / split from the digits
  var m = /^([0-9]+)[\s-]*([A-Za-z]{1,2})$/.exec(n);
  if (m) { add(m[1] + m[2].toUpperCase()); add(m[1] + '-' + m[2].toUpperCase()); add(m[1]); }
  // a number written with leading zeros, or without them
  var digits = /^0+([0-9].*)$/.exec(squashed);
  if (digits) add(digits[1]);
  if (/^[0-9]/.test(squashed)) add('0' + squashed);
  return Object.keys(out);
}

// ── Values that mean "empty" ────────────────────────────────────
// v0.9.1548 (Task #40, from the collector-database export in Task #39).
// His sheet says NO SET on 1,738 rows, "None" for a condition, "( )" for an
// unrecorded variation code. Every one of those means BLANK. Imported
// literally, he gets a group called "NO SET" holding most of his collection.
//
// Frequency alone cannot decide this: "Excellent" appears 1,160 times in his
// condition column and is entirely real. So we do NOT guess from counts — we
// recognise the SHAPE of a non-value, then show the user what we found with
// its count and let them confirm. Two confidence levels, because they are
// genuinely different:
//   CONFIDENT — punctuation and standard nothing-words: "( )", "--", "N/A",
//     "NO SET". Nobody names a group "N/A". Ticked by default.
//   AMBIGUOUS — "None", "0", "N". These can be real: a box condition of
//     "None" may mean the box is missing, which is a fact worth keeping.
//     Shown and counted, but NOT ticked. The user decides.
var _RR_EMPTY_CONFIDENT = /^(n\/a|n\.a\.|na|nil|null|nan|unknown|unspecified|tbd|none given|not recorded|no\s+\w+|-{1,3}|—|–|\.|\?+|\(\s*\)|\(\s*[-.]?\s*\)|\[\s*\]|#n\/a|#value!|blank|empty)$/i;
var _RR_EMPTY_AMBIGUOUS = /^(none|no|n|0|0\.0+|\(\s*0*\s*\)|unk|misc|other|various)$/i;

function rrImpIsPlaceholderValue(v) {
  var s = rrImpNormCell(v);
  if (!s) return '';
  if (_RR_EMPTY_CONFIDENT.test(s)) return 'confident';
  if (_RR_EMPTY_AMBIGUOUS.test(s)) return 'ambiguous';
  return '';
}

// Look across the staged rows and report every placeholder-shaped value, per
// field, with how often it occurs and a real example. Only fields the user
// actually mapped are considered — we ask only about data that is going
// somewhere.
function rrImpPlaceholderCandidates(items, opts) {
  var o = opts || {};
  var minCount = o.minCount || 3;
  var skip = { itemNum: 1, srcTab: 1, srcRow: 1, fillSig: 1, fillRgb: 1, tabClass: 1 };
  var byField = {};
  (items || []).forEach(function (it) {
    Object.keys(it || {}).forEach(function (k) {
      if (skip[k]) return;
      var v = rrImpNormCell(it[k]);
      if (!v) return;
      var kind = rrImpIsPlaceholderValue(v);
      if (!kind) return;
      var key = k + ' ' + v.toLowerCase();
      if (!byField[key]) byField[key] = { field: k, value: v, kind: kind, count: 0, example: '' };
      byField[key].count++;
      if (!byField[key].example) {
        byField[key].example = rrImpNormCell(it.yourDesc || it.description || it.itemNum || '').slice(0, 60);
      }
    });
  });
  return Object.keys(byField).map(function (k) { return byField[k]; })
    .filter(function (c) { return c.count >= minCount; })
    .sort(function (a, b) { return b.count - a.count; });
}

// ── Quantity: one row that means many items ─────────────────────
// v0.9.1548. 78 of his rows carry 2-18 in a quantity column. Importing that
// as one item loses seventeen of them silently — the exact failure this
// session has spent the day removing everywhere else.
function rrImpQuantityHeader(headers) {
  var list = headers || [];
  for (var i = 0; i < list.length; i++) {
    var h = rrImpNormCell(list[i]).toLowerCase();
    if (!h) continue;
    if (/^(qty|quantity|count|how many|# ?owned|number owned|copies)$/.test(h)) return list[i];
  }
  return '';
}
// Only offer to expand when the column really is a count: whole numbers,
// none enormous, and at least one greater than 1.
function rrImpQuantityStats(items, key) {
  var n = 0, over1 = 0, max = 0, zero = 0, bad = 0, total = 0;
  (items || []).forEach(function (it) {
    var raw = rrImpNormCell(it[key]);
    if (!raw) return;
    n++;
    if (!/^\d{1,4}$/.test(raw)) { bad++; return; }
    var v = parseInt(raw, 10);
    if (v === 0) zero++;
    if (v > 1) { over1++; total += (v - 1); }
    if (v > max) max = v;
  });
  return { rows: n, over1: over1, extra: total, max: max, zero: zero, bad: bad,
           // v0.9.1548: measured against the real column, which contains
           // 1,966 ones, a "TOTAL" summary row, a 999 meaning "lots", and a
           // genuine 172 and 192 (track sections — a collector really does
           // own 172 pieces of track). So: tolerate a stray non-number
           // rather than demand perfection, and never judge on the maximum —
           // the outliers are handled by the cap, not by refusing the column.
           // One stray is forgivable at any size (his 2,060-row column has a
           // single "TOTAL"); beyond that, judge by proportion.
           looksLikeCount: n > 0 && over1 > 0 && (bad <= 1 || (bad / n) <= 0.02) };
}
// Rows asking for more copies than the cap. Shown to the user by name, not
// quietly clamped: 172 pieces of track is a real answer, and turning it into
// 25 without saying so is the silent-loss failure in a new coat.
function rrImpQuantityOutliers(items, key, cap) {
  var lim = cap || 25;
  var out = [];
  (items || []).forEach(function (it) {
    var raw = rrImpNormCell(it[key]);
    if (!/^\d{1,4}$/.test(raw)) return;
    var v = parseInt(raw, 10);
    if (v > lim) {
      out.push({ itemNum: rrImpNormCell(it.itemNum), qty: v,
                 desc: rrImpNormCell(it.yourDesc || it.description || '').slice(0, 50) });
    }
  });
  return out.sort(function (a, b) { return b.qty - a.qty; });
}
// Turn one row of quantity N into N rows. Copies are physically separate
// items — the same collector's sheet proves it: 394 of his numbers already
// repeat as separate rows for exactly that reason.
function rrImpExpandQuantities(items, key, cap) {
  var lim = cap || 25;
  var out = [];
  (items || []).forEach(function (it) {
    var raw = rrImpNormCell(it[key]);
    var v = /^\d{1,4}$/.test(raw) ? parseInt(raw, 10) : 1;
    if (!(v > 1)) { out.push(it); return; }
    // Over the cap: ONE row, with the count kept on it. Never 172 silent
    // copies, and never a silent 25 either.
    if (v > lim) {
      var single = {};
      Object.keys(it).forEach(function (k) { single[k] = it[k]; });
      single._qtyKept = v;
      out.push(single);
      return;
    }
    for (var i = 0; i < v; i++) {
      var copy = {};
      Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
      copy._copyOf = rrImpNormCell(it.itemNum);
      copy._copyIndex = i + 1;
      copy._copyTotal = v;
      out.push(copy);
    }
  });
  return out;
}

// ── Money / number cleanup ──────────────────────────────────────
function rrImpCleanMoney(v) {
  var s = rrImpNormCell(v).replace(/[$,\s]/g, '');
  if (s === '' || isNaN(Number(s))) return '';
  return String(Number(s));
}

// ── Grade collection ────────────────────────────────────────────
// Distinct raw grade strings with counts, most common first — feeds the
// per-user grade conversion table (AI pre-fills, user adjusts once).
function rrImpCollectGrades(items) {
  var counts = {};
  items.forEach(function (it) {
    var g = rrImpNormCell(it.rawGrade);
    if (!g) return;
    counts[g] = (counts[g] || 0) + 1;
  });
  return Object.keys(counts)
    .map(function (g) { return { grade: g, count: counts[g] }; })
    .sort(function (a, b) { return b.count - a.count || (a.grade < b.grade ? -1 : 1); });
}

// A crude deterministic pre-fill for the conversion table when the AI is
// unreachable: pull the first 1-10 number out of the string. "C10/P10"→10,
// "C7"→7, "Excellent"→''. The user adjusts in the table either way.
// v0.9.1549 (Brad, from the collector-database export): "his excellent,
// good, fair etc are conditions that we need to map to 1-10."
//
// Until now this read C-numbers only (C10, C9/P8, a bare 8) — which is how
// Scott writes them, so it worked and nobody noticed. A collector who writes
// WORDS got thirteen empty rows to fill in by hand.
//
// The numbers below are OUR scale, taken from the wizard's own slider, not
// the TCA scale — deliberately. The app tells every user that 8 is
// "Excellent — near perfect", 6 is "Very Good — minor wear only", 4 is
// "Good — visible play wear". TCA numbers Excellent as C7. Two scales cannot
// both own the number, and the one the user reads on every item afterwards
// has to win. The grade table SHOWS each mapping before a single row is
// written, so anyone grading to TCA can move them all in one screen.
var _RR_GRADE_WORDS = [
  [/^(mint|mib|new in box|nib|factory ?sealed|sealed)$/i, '10'],
  [/^(near ?mint|nm|excellent ?\+{1,2}|excellent plus|exc ?\+)$/i, '9'],
  [/^(excellent|exc|ex|like ?new|ln|c ?8)$/i, '8'],
  [/^(very ?good ?\+{1,2}|very good plus|vg ?\+)$/i, '7'],
  [/^(very ?good|vg|v\.?g\.?)$/i, '6'],
  [/^(good ?\+{1,2}|good plus|g ?\+)$/i, '5'],
  [/^(good|gd|g)$/i, '4'],
  [/^(fair|fr|played ?with|worn)$/i, '3'],
  [/^(poor|pr|rough|damaged|restoration|needs ?restoration)$/i, '2'],
  [/^(junk|parts|for ?parts|scrap|broken|incomplete)$/i, '1'],
];
function rrImpGuessCondition(rawGrade) {
  var s = rrImpNormCell(rawGrade);
  if (!s) return '';
  // A number in the text still wins — "C9/P8" and a bare "8" are explicit.
  var m = /(?:^|[^0-9])(10|[1-9])(?:[^0-9]|$)/.exec(s);
  if (m) return m[1];
  // Otherwise read the words. Punctuation and case are noise.
  var w = s.replace(/[.\u2013\u2014_]/g, ' ').replace(/\s+/g, ' ').trim();
  for (var i = 0; i < _RR_GRADE_WORDS.length; i++) {
    if (_RR_GRADE_WORDS[i][0].test(w)) return _RR_GRADE_WORDS[i][1];
  }
  // A compound like "Excellent, small chip" — take the leading word.
  var lead = w.split(/[,;/(]/)[0].trim();
  if (lead && lead !== w) {
    for (var j = 0; j < _RR_GRADE_WORDS.length; j++) {
      if (_RR_GRADE_WORDS[j][0].test(lead)) return _RR_GRADE_WORDS[j][1];
    }
  }
  return '';
}

// v0.9.1512: how many cells Excel turned into 1899/1900 timestamps — shown
// on the triage screen so a mangled column is visible, not silent.
function rrImpCountDateJunk(tabs) {
  var n = 0;
  (tabs || []).forEach(function (t) {
    (t.rows || []).forEach(function (r) {
      (r.cells || []).forEach(function (c) {
        if (c instanceof Date && c.getFullYear() <= 1900) n++;
      });
    });
  });
  return n;
}

// ── Summary-row detection (v0.9.1509, found live: Scott's per-tab
// "Total:" rows imported as ITEMS and added $372k of fake value) ────────
// A summary row is one whose number-or-first cell is a totals word and
// which carries no grade (real items in the wild always had one or the
// other). Conservative on purpose: "Total Package Deal 123" is an item.
function rrImpIsSummaryItem(it) {
  // v0.9.1554 (Brad: "why are these numbers off. they should be exact").
  // One of Scott's twenty summary rows got through and was imported as an
  // item worth $780 — which is exactly why his import totalled $379,438
  // against a real $378,658, and counted 3,370 items instead of 3,369.
  //
  // CAUSE: this looked at itemNum, then yourDesc. His "Lionel 1/120
  // Big-Rugged Loco" tab has no Item # column at all — its columns are
  // Series · Name · Condition · Value — so the mapping put the word "Total:"
  // into SUB-COLLECTION, where nothing was looking for it.
  //
  // A totals row does not know which of our fields it will land in. Check
  // every text field the mapping can fill, and keep the two rules that stop
  // a real item being thrown away: the word must START the cell, and the row
  // must carry no grade (a real item in the wild always had one).
  var fields = ['itemNum', 'yourDesc', 'description', 'subCollection', 'itemType',
                'manufacturer', 'roadName', 'location', 'notes'];
  for (var i = 0; i < fields.length; i++) {
    var probe = rrImpNormCell(it && it[fields[i]]);
    if (!probe) continue;
    if (/^(grand\s+)?(sub\s*)?totals?\s*[:.]?$/i.test(probe)) {
      return !rrImpNormCell(it && it.rawGrade);
    }
  }
  return false;
}

// ── Year from description (v0.9.1509, Brad: "the date is in the title so
// it should be in the modern era") — 395 of Scott's items carried their
// year ONLY in the description text. Conservative: exactly ONE plausible
// year in the text, else nothing (never guess between two years).
function rrImpYearFromText(s) {
  var m = String(s || '').match(/\b(19[0-9]{2}|20[0-2][0-9])\b/g);
  if (!m) return '';
  var uniq = {};
  m.forEach(function (y) { uniq[y] = 1; });
  var years = Object.keys(uniq);
  return years.length === 1 ? years[0] : '';
}

// ── Maker from tab name (v0.9.1509) — Scott's tabs ARE maker names.
// Returns the canonical maker string when the tab name plainly says one,
// else ''. Diacritics normalized (Märklín). This produces a PREFILL for
// the tab-questions screen — the USER confirms (Brad: "not everybody's
// sheet will be like Scott's, these are questions we have to ask").
function rrImpMakerFromTab(tabName, knownMakers) {
  var t = String(tabName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!t) return '';
  var makers = knownMakers || [];
  for (var i = 0; i < makers.length; i++) {
    var k = String(makers[i]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t === k || t.indexOf(k + ' ') === 0 || t === k + ' trains') return makers[i];
  }
  // "K-Line by Lionel" → K-Line wins (it IS the maker; Lionel bought them).
  for (var j = 0; j < makers.length; j++) {
    var k2 = String(makers[j]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (k2.length >= 4 && t.indexOf(k2) === 0) return makers[j];
  }
  return '';
}

// ── Lionel number-length era rule (v0.9.1518 — BRAD'S DOMAIN RULE) ─────
// Brad: "you can infer that if it is 4 numbers or less its prewar or
// postwar. Modern numbers are 5 plus. I'm not counting the -xxx in the
// postwar stuff. Even the remakes of postwar items have the 5+ digit
// numbers." His 26077 example proves the second half: a MODERN 5-digit
// number for a reproduction of postwar 6424 — and note the description
// says "#6424", which is exactly why we read the NUMBER, never the words.
//
// Returns 'modern' | 'vintage' (prewar OR postwar — still two eras, Brad's
// correction) | '' when the rule does not apply.
function rrImpLionelEraClass(num) {
  var first = String(num || '').trim().split('-')[0];   // 6464-25 → 6464
  var digits = first.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length >= 5) return 'modern';
  if (digits.length <= 4) return 'vintage';
  return '';
}
// Which class a catalog row belongs to, by its era/tab.
function rrImpEraClassOfRow(m) {
  var e = String((m && m._era) || '').toLowerCase();
  var t = String((m && m._tab) || '').toLowerCase();
  if (e === 'mpc' || t.indexOf('mpc') >= 0 || t.indexOf('modern') >= 0) return 'modern';
  if (e === 'pw' || e === 'prewar' || t.indexOf('pw') >= 0 || t.indexOf('pre-war') >= 0) return 'vintage';
  return '';
}
// prewar vs postwar for a row, once we know it is vintage.
function rrImpVintagePeriod(m) {
  var e = String((m && m._era) || '').toLowerCase();
  var t = String((m && m._tab) || '').toLowerCase();
  if (e === 'prewar' || t.indexOf('pre-war') >= 0) return 'prewar';
  if (e === 'pw' || t.indexOf('pw') >= 0) return 'postwar';
  return '';
}

// ── Triage ──────────────────────────────────────────────────────
// items: staged items (post-mapping). lookups: injected hooks so this
// stays pure and node-testable —
//   candidatesFor(itemNum, hints) → array of master candidates
//     (exact-number matches only; NEVER pre-stripped)
//   baseOf(itemNum) → base number with suffix removed (app baseItemNum)
// Buckets:
//   matched   — exactly one exact candidate. Ships in Phase 1.
//   ambiguous — 2+ exact candidates. Phase 1 stages them visibly but the
//               picker ships Phase 2; user can leave them out or force
//               manual.
//   unmatched — zero exact candidates → default MANUAL entry with an
//               honest flag; if the BASE number has candidates, offer
//               them as didYouMean (offer only — suffix rule).
function rrImpTriage(items, lookups) {
  var res = { matched: [], ambiguous: [], unmatched: [] };
  items.forEach(function (it) {
    var num = rrImpNormCell(it.itemNum);
    if (!num) { res.unmatched.push({ item: it, didYouMean: [] }); return; }
    var hints = { manufacturer: it.manufacturer || '', gauge: it.gauge || '' };
    var exact = (lookups && lookups.candidatesFor) ? (lookups.candidatesFor(num, hints) || []) : [];
    // ── v0.9.1509 PREFIX PASS (measured live on Scott's sheet: 274 of 387
    // "unmatched" Lionel items existed in the catalog as 6-<their number>;
    // K-Line by Lionel: 26 of 33). Modern-Lionel collectors write 11169,
    // catalogs write 6-11169 — same number, Lionel's own convention. Runs
    // ONLY on a total exact miss (the suffix rule is untouched: an exact
    // match still always wins) and only accepts an UNAMBIGUOUS single hit.
    if (exact.length === 0 && /^[0-9]{4,6}$/.test(num)
        && /lionel/i.test(String((it.manufacturer || '') + ' ' + (it.srcTab || '')))) {
      var viaPrefix = (lookups && lookups.candidatesFor) ? (lookups.candidatesFor('6-' + num, hints) || []) : [];
      if (viaPrefix.length === 1) {
        res.matched.push({ item: it, master: viaPrefix[0], matchedVia: '6-prefix', catalogNum: '6-' + num });
        return;
      }
    }
    if (exact.length === 1) {
      res.matched.push({ item: it, master: exact[0] });
    } else if (exact.length > 1) {
      // v0.9.1518: Brad's number-length rule splits Lionel's reused numbers.
      var isLionel = /lionel/i.test(String((it.manufacturer || '') + ' ' + (it.srcTab || '')));
      var cls = isLionel ? rrImpLionelEraClass(num) : '';
      if (cls) {
        var inClass = exact.filter(function (m) { return rrImpEraClassOfRow(m) === cls; });
        if (inClass.length === 1) {
          res.matched.push({ item: it, master: inClass[0], matchedVia: 'lionel-digits' });
          return;
        }
        if (inClass.length > 1 && cls === 'vintage') {
          // Still prewar OR postwar (Brad: "those are still two different
          // eras"). Held for the bulk verify screen, defaulted to postwar.
          res.ambiguous.push({ item: it, candidates: inClass, eraChoice: 'vintage',
            prewar: inClass.filter(function (m) { return rrImpVintagePeriod(m) === 'prewar'; })[0] || null,
            postwar: inClass.filter(function (m) { return rrImpVintagePeriod(m) === 'postwar'; })[0] || null });
          return;
        }
        if (inClass.length > 1) { res.ambiguous.push({ item: it, candidates: inClass }); return; }
      }
      res.ambiguous.push({ item: it, candidates: exact });
    } else {
      var dym = [];
      if (lookups && lookups.baseOf && lookups.candidatesFor) {
        var base = lookups.baseOf(num);
        if (base && base !== num) dym = lookups.candidatesFor(base, hints) || [];
      }
      // v0.9.1538: also try the other ways the SAME number gets written —
      // "1666 T" for 1666T. Offers only; the user's number still wins unless
      // they say otherwise, and the catalogue number they accept is recorded
      // so the item links up properly.
      if (lookups && lookups.candidatesFor) {
        var seen = {};
        dym.forEach(function (m) { seen[rrImpNormCell(m.itemNum) + '|' + (m._era || '')] = 1; });
        rrImpNumberVariants(num).forEach(function (v) {
          if (dym.length >= 4) return;
          (lookups.candidatesFor(v, hints) || []).forEach(function (m) {
            var k = rrImpNormCell(m.itemNum) + '|' + (m._era || '');
            if (seen[k] || dym.length >= 4) return;
            seen[k] = 1; dym.push(m);
          });
        });
      }
      res.unmatched.push({ item: it, didYouMean: dym });
    }
  });
  return res;
}

// Copy-counter evidence (Session 80 suffix rule): rows like 6464-1/-2 may
// be COPIES ONLY IF their descriptions are identical. Different
// descriptions = real variants — don't even ask. Returns groups that
// justify ONE interview question, never an automatic action.
function rrImpCopyCounterEvidence(items, baseOf) {
  var byBase = {};
  items.forEach(function (it) {
    var num = rrImpNormCell(it.itemNum);
    if (!num || !baseOf) return;
    var base = baseOf(num);
    if (!base || base === num) return;
    (byBase[base] = byBase[base] || []).push(it);
  });
  var evidence = [];
  Object.keys(byBase).forEach(function (base) {
    var group = byBase[base];
    if (group.length < 2) return;
    var descs = {};
    group.forEach(function (it) { descs[rrImpNormCell(it.yourDesc).toLowerCase()] = 1; });
    if (Object.keys(descs).length === 1 && Object.keys(descs)[0] !== '') {
      evidence.push({ base: base, count: group.length, items: group });
    }
  });
  return evidence;
}

// ── AI payload ──────────────────────────────────────────────────
// Compact, once-per-import. ~10 sample rows per tab (first rows plus one
// highlighted row when present, so the AI sees the pattern the interview
// will ask about). No photos, no full inventory — headers + samples only.
function rrImpBuildAiPayload(tabs, fillGroups, appFields) {
  var outTabs = tabs.map(function (tab) {
    var rows = tab.rows || [];
    var samples = [];
    for (var i = 0; i < rows.length && samples.length < 9; i++) samples.push(rows[i]);
    // One highlighted row if the first 9 didn't include one.
    var hasHl = samples.some(function (r) { return r.fillSig && r.fillSig !== (tab.bgSig || ''); });
    if (!hasHl) {
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].fillSig && rows[j].fillSig !== (tab.bgSig || '')) { samples.push(rows[j]); break; }
      }
    }
    return {
      name: tab.name,
      headers: (tab.headers || []).map(rrImpNormCell),
      rowCount: rows.length,
      samples: samples.map(function (r) {
        return {
          cells: (r.cells || []).map(rrImpNormCell),
          highlighted: !!(r.fillSig && r.fillSig !== (tab.bgSig || '')),
          fillRgb: r.fillRgb || null,
        };
      }),
    };
  });
  return {
    tabs: outTabs,
    fillGroups: (fillGroups || []).map(function (g) {
      return { rgb: g.rgb, count: g.count, tabs: g.tabNames };
    }),
    appFields: appFields || [
      // v0.9.1519 (Brad, live: the AI put Shipper into "Custom column 1" and
      // left it unnamed). Custom slots are NEVER offered to the model — a
      // custom column is created by the USER, named from their own header.
      'itemNum', 'manufacturer', 'gauge', 'yourDesc', 'rawGrade', 'location',
      'locationDetail', 'shipper', 'subCollection',
      'priceItem', 'userEstWorth', 'yearMade', 'notes', 'roadName',
      'roadNumber', 'hasBox', 'datePurchased', 'purchasedFrom', 'quantity',
      'photoFile', 'ignore',
    ],
  };
}

// ── AI answer validation ────────────────────────────────────────
// The relay answer is UNTRUSTED input. Only shapes we can render survive;
// anything else falls back to the heuristic. Never throws.
function rrImpValidateAiAnswer(ans, tabs) {
  var out = { ok: false, mappings: {}, tabClass: {}, gradeTable: [], questions: [] };
  try {
    if (!ans || typeof ans !== 'object') return out;
    var validFields = {};
    rrImpBuildAiPayload([], []).appFields.forEach(function (f) { validFields[f] = 1; });
    var tabNames = {};
    (tabs || []).forEach(function (t) { tabNames[t.name] = 1; });
    if (ans.mappings && typeof ans.mappings === 'object') {
      Object.keys(ans.mappings).forEach(function (tabName) {
        if (!tabNames[tabName]) return;
        var m = ans.mappings[tabName];
        if (!m || typeof m !== 'object') return;
        var clean = {};
        Object.keys(m).forEach(function (hdr) {
          var f = String(m[hdr] || '');
          if (/^custom[1-5]$/.test(f)) return;   // v0.9.1519: user-only
          if (validFields[f]) clean[rrImpNormHeader(hdr)] = f;
        });
        if (Object.keys(clean).length) out.mappings[tabName] = clean;
      });
    }
    if (ans.tabClass && typeof ans.tabClass === 'object') {
      Object.keys(ans.tabClass).forEach(function (tabName) {
        if (!tabNames[tabName]) return;
        var c = String(ans.tabClass[tabName] || '');
        if (/^(trains|books|vehicles|other)$/.test(c)) out.tabClass[tabName] = c;
      });
    }
    if (Array.isArray(ans.gradeTable)) {
      ans.gradeTable.forEach(function (g) {
        if (!g || typeof g !== 'object') return;
        var raw = rrImpNormCell(g.raw), cond = rrImpNormCell(g.condition);
        if (raw && (/^([1-9]|10)$/.test(cond) || cond === '')) out.gradeTable.push({ raw: raw, condition: cond });
      });
    }
    if (Array.isArray(ans.questions)) {
      ans.questions.slice(0, 5).forEach(function (q) {
        if (!q || typeof q !== 'object') return;
        var text = rrImpNormCell(q.text);
        var opts = Array.isArray(q.options) ? q.options.map(rrImpNormCell).filter(Boolean).slice(0, 6) : [];
        if (text && opts.length >= 2) out.questions.push({ id: rrImpNormCell(q.id) || ('q' + out.questions.length), text: text, options: opts });
      });
    }
    out.ok = Object.keys(out.mappings).length > 0;
  } catch (e) { /* fall through — heuristic path takes over */ }
  return out;
}

// ── Exports ─────────────────────────────────────────────────────

// ═══ Session 85: photos travel WITH the import ═══════════════════
// Brad's decisions, verbatim spirit: photos attach DURING the import,
// never later ("that can become a mess"); matching is case-insensitive
// EXACT filename — the sheet column IS the pairing, nothing inferred;
// a photo-shaped column left unmapped earns an explicit warning.
// Measured on Lyle's fullnumber.xlsx: 2,052 bare .JPG names, all but
// one unique, zero paths, zero URLs — bare basenames are the format.

var RR_IMP_PHOTO_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|tiff?)$/i;

// Share of non-blank values that read as photo FILENAMES (an extension,
// no URL, no drive-letter path). 0 when nothing does.
function rrImpPhotoishShare(values) {
  var seen = 0, hits = 0;
  (values || []).forEach(function (v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return;
    seen++;
    if (/^https?:/i.test(t)) return;             // a link is the web tier, not a file
    if (!RR_IMP_PHOTO_EXT_RE.test(t)) return;
    hits++;
  });
  return seen ? hits / seen : 0;
}

// Columns that LOOK like photo filenames but were not mapped to
// photoFile — the "you'll want to know this now" detector. 60% of a
// column's non-blank values must be filename-shaped, and at least 3 rows.
function rrImpPhotoColumnCandidates(tab, mapping) {
  var out = [];
  (tab && tab.headers || []).forEach(function (h, i) {
    var n = rrImpNormHeader(h);
    if (!n) return;
    if ((mapping || {})[n] === 'photoFile') return;
    var vals = [], nonBlank = 0;
    (tab.rows || []).forEach(function (r) {
      var v = (r.cells || [])[i];
      if (String(v == null ? '' : v).trim()) nonBlank++;
      vals.push(v);
    });
    if (nonBlank < 3) return;
    var share = rrImpPhotoishShare(vals);
    if (share >= 0.6) out.push({ header: h, share: share, count: nonBlank });
  });
  return out;
}

// files: [{ name }] where name may carry a relative path (folder drops
// recurse) — the BASENAME is the identity, lowercased. Non-image files
// never enter the index. Value is an array: identical basenames from two
// subfolders both survive (first is used; the report says so).
function rrImpPhotoIndex(files) {
  var idx = {};
  (files || []).forEach(function (f) {
    var name = String(f && f.name || '');
    var base = name.split(/[\\/]/).pop();
    if (!base || !RR_IMP_PHOTO_EXT_RE.test(base)) return;
    var k = base.toLowerCase();
    if (!idx[k]) idx[k] = [];
    idx[k].push(f);
  });
  return idx;
}

// items: staged rows (photoFile optional) × index from rrImpPhotoIndex.
// Exact basename match, case-insensitive. Two rows naming one file BOTH
// match it — the Task #39 quantity pattern; the file uploads once and is
// shared (the write handles that; this just pairs).
function rrImpPhotoMatch(items, idx) {
  var matched = [], missing = {}, used = {};
  (items || []).forEach(function (it) {
    var t = String(it && it.photoFile || '').trim();
    if (!t) return;
    var k = t.split(/[\\/]/).pop().toLowerCase();
    if (idx && idx[k] && idx[k].length) {
      matched.push({ item: it, key: k, file: idx[k][0] });
      used[k] = 1;
    } else {
      missing[t] = 1;
    }
  });
  var unclaimed = [];
  Object.keys(idx || {}).forEach(function (k) { if (!used[k]) unclaimed.push(k); });
  return {
    matched: matched,
    missingNames: Object.keys(missing),
    unclaimedNames: unclaimed,
    uniqueFilesUsed: Object.keys(used).length,
  };
}

var RR_IMPORT_CORE = {
  rrImpNormCell: rrImpNormCell,
  rrImpDetectHeaderRow: rrImpDetectHeaderRow,
  rrImpNormHeader: rrImpNormHeader,
  rrImpLayoutKey: rrImpLayoutKey,
  rrImpGroupLayouts: rrImpGroupLayouts,
  rrImpPaletteFromStylesXml: rrImpPaletteFromStylesXml,
  rrImpResolveFillRgb: rrImpResolveFillRgb,
  rrImpFillSig: rrImpFillSig,
  rrImpColorDistance: rrImpColorDistance,
  rrImpFillGroups: rrImpFillGroups,
  rrImpHeuristicMap: rrImpHeuristicMap,
  rrImpApplyMapping: rrImpApplyMapping,
  rrImpCleanMoney: rrImpCleanMoney,
  rrImpCollectGrades: rrImpCollectGrades,
  rrImpGuessCondition: rrImpGuessCondition,
  rrImpLionelEraClass: rrImpLionelEraClass,
  rrImpEraClassOfRow: rrImpEraClassOfRow,
  rrImpVintagePeriod: rrImpVintagePeriod,
  rrImpCountDateJunk: rrImpCountDateJunk,
  rrImpIsSummaryItem: rrImpIsSummaryItem,
  rrImpYearFromText: rrImpYearFromText,
  rrImpMakerFromTab: rrImpMakerFromTab,
  rrImpTriage: rrImpTriage,
  rrImpCopyCounterEvidence: rrImpCopyCounterEvidence,
  rrImpBuildAiPayload: rrImpBuildAiPayload,
  rrImpValidateAiAnswer: rrImpValidateAiAnswer,
  rrImpIsPlaceholderValue: rrImpIsPlaceholderValue,
  rrImpPlaceholderCandidates: rrImpPlaceholderCandidates,
  rrImpQuantityHeader: rrImpQuantityHeader,
  rrImpQuantityStats: rrImpQuantityStats,
  rrImpQuantityOutliers: rrImpQuantityOutliers,
  rrImpExpandQuantities: rrImpExpandQuantities,
  rrImpNumberVariants: rrImpNumberVariants,
  rrImpScoreCandidate: rrImpScoreCandidate,
  rrImpPickByDescription: rrImpPickByDescription,
  rrImpOnlyVariationDiffers: rrImpOnlyVariationDiffers,
  rrImpBaseVariationIndex: rrImpBaseVariationIndex,
  rrImpNumberlessShare: rrImpNumberlessShare,
  rrImpTabIsNonCatalog: rrImpTabIsNonCatalog,
  rrImpTypeFromText: rrImpTypeFromText,
  rrImpTypeSurvey: rrImpTypeSurvey,
  RR_IMP_TYPE_RULES: RR_IMP_TYPE_RULES,
  rrImpPhotoishShare: rrImpPhotoishShare,
  rrImpPhotoColumnCandidates: rrImpPhotoColumnCandidates,
  rrImpPhotoIndex: rrImpPhotoIndex,
  rrImpPhotoMatch: rrImpPhotoMatch,
};

if (typeof module !== 'undefined' && module.exports) module.exports = RR_IMPORT_CORE;
if (typeof window !== 'undefined') {
  Object.keys(RR_IMPORT_CORE).forEach(function (k) { window[k] = RR_IMPORT_CORE[k]; });
}
