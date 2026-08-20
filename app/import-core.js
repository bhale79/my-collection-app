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
function rrImpGuessCondition(rawGrade) {
  var m = /(?:^|[^0-9])(10|[1-9])(?:[^0-9]|$)/.exec(rrImpNormCell(rawGrade));
  return m ? m[1] : '';
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
    if (exact.length === 1) {
      res.matched.push({ item: it, master: exact[0] });
    } else if (exact.length > 1) {
      res.ambiguous.push({ item: it, candidates: exact });
    } else {
      var dym = [];
      if (lookups && lookups.baseOf && lookups.candidatesFor) {
        var base = lookups.baseOf(num);
        if (base && base !== num) dym = lookups.candidatesFor(base, hints) || [];
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
      'itemNum', 'manufacturer', 'gauge', 'yourDesc', 'rawGrade', 'location',
      'priceItem', 'userEstWorth', 'yearMade', 'notes', 'roadName',
      'roadNumber', 'hasBox', 'datePurchased', 'purchasedFrom', 'quantity', 'ignore',
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
  rrImpTriage: rrImpTriage,
  rrImpCopyCounterEvidence: rrImpCopyCounterEvidence,
  rrImpBuildAiPayload: rrImpBuildAiPayload,
  rrImpValidateAiAnswer: rrImpValidateAiAnswer,
};

if (typeof module !== 'undefined' && module.exports) module.exports = RR_IMPORT_CORE;
if (typeof window !== 'undefined') {
  Object.keys(RR_IMPORT_CORE).forEach(function (k) { window[k] = RR_IMPORT_CORE[k]; });
}
