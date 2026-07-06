// ══════════════════════════════════════════════════════════════════
// sheet-builder.js — Sheet formatting, Dashboard tab, Lock/Unlock
// Depends on: accessToken, state, sheetsUpdate(), normalizeItemNum()
// All functions are non-destructive — never touch data rows (row 3+)
// ══════════════════════════════════════════════════════════════════

// Bump this number to push a visual refresh to all users on next sync
const SHEET_FORMAT_VER = 20; // v20 (v0.9.736): deterministic column widths (header-fit + curated My Collection table, autoResize REMOVED), Dashboard button merge sized to its text per tab, conductor images served from therailroster.com so no GitHub URL shows in the formula bar. Was 19: // v19 (v0.9.720): +Date Added trailing personal column. Was 18: // v18 (v0.9.666): +Scale/Gauge trailing personal column — header row rewritten. // Session 165 v12: Dashboard header rebuilt to match the app (mascot left, multicolor Oswald title, app navy + orange underline bar) + no-white styling (hide gridlines, flood page with app bg).

// ── Color palette ──────────────────────────────────────────────────
const SB = {
  navy:     { red: 0.063, green: 0.098, blue: 0.169 },   // #10182B banner (data tabs)
  navyMid:  { red: 0.118, green: 0.227, blue: 0.373 },   // #1e3a5f section headers
  gold:     { red: 1.000, green: 0.878, blue: 0.376 },   // #FFDF60 accent gold
  goldBg:   { red: 0.996, green: 0.953, blue: 0.808 },   // #FEF3CE stat value bg
  white:    { red: 1, green: 1, blue: 1 },
  dimText:  { red: 0.4, green: 0.4, blue: 0.4 },
  divider:  { red: 0.118, green: 0.227, blue: 0.373 },   // col C divider
  labelBg:  { red: 0.133, green: 0.196, blue: 0.31  },   // #223250 label rows
  // App-matched dashboard palette (mirrors app.css :root).
  appBg:    { red: 0.059, green: 0.071, blue: 0.125 },   // #0f1220 app page bg
  appNavy:  { red: 0.102, green: 0.114, blue: 0.227 },   // #1a1d3a app header band
  accent:   { red: 0.941, green: 0.314, blue: 0.031 },   // #f05008 app orange
  cream:    { red: 0.973, green: 0.910, blue: 0.753 },   // #f8e8c0 app cream text
};

const CONDUCTOR_URL = 'https://therailroster.com/conductor-list.png';   // v13: own domain, no GitHub address visible to users
// App header mascot — matches the app's top-left conductor exactly.
const CONDUCTOR_HEADER_URL = 'https://therailroster.com/img/conductor-header.png';   // v13: own domain

async function applySheetFormatting(sheetId, opts) {
  // Session 155 v7: opts.force=true bypasses the version check (used by
  // the "Rebuild Dashboard Tab" button so user can force a full re-apply
  // even when storedVer matches code's SHEET_FORMAT_VER).
  if (!sheetId || !accessToken) return;
  const _force = !!(opts && opts.force);
  let _wasLocked = false;  // accessible from catch handler
  try {
    // ── 1. Fetch metadata ──────────────────────────────────────────
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    if (meta.error) return;
    const tabMap = {};
    (meta.sheets || []).forEach(s => { tabMap[s.properties.title] = s.properties.sheetId; });

    // ── 2. Check version stamp ─────────────────────────────────────
    const needsDash = !tabMap.hasOwnProperty('Dashboard');
    if (!needsDash) {
      const verRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Dashboard!A50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const verData = await verRes.json();
      const storedVer = parseInt(((verData.values || [[]])[0] || [])[0] || '0');
      if (!_force && storedVer >= SHEET_FORMAT_VER) {
        // Just refresh stats content, skip full format
        await _writeDashboardContent(sheetId);
        return;
      }
      if (_force) {
        console.log('[SheetFormat] Force mode: bypassing version check (storedVer=' + storedVer + ', code=' + SHEET_FORMAT_VER + ')');
      }
    }

    // Session 155: unlock structural protections before formatting,
    // because warningOnly:false protection would otherwise block our writes.
    try {
      const _lockState = await getSheetLockState(sheetId);
      _wasLocked = _lockState.locked;
      if (_wasLocked && typeof unlockSheetTabs === 'function') {
        await unlockSheetTabs(sheetId);
        console.log('[Format] Unlocked sheet for formatting');
      }
    } catch(e) { console.warn('[Format] Pre-format unlock failed:', e); }

    // ── 3. Create Dashboard tab if missing ─────────────────────────
    if (needsDash) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: {
          title: 'Dashboard', index: 0, tabColor: SB.navyMid
        } } }] })
      });
      const m2 = await (await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )).json();
      (m2.sheets || []).forEach(s => { tabMap[s.properties.title] = s.properties.sheetId; });
    }

    const dashId = tabMap['Dashboard'];

    // ── 4. Tab colors ──────────────────────────────────────────────
    const TAB_COLORS = {
      'Dashboard':     SB.navyMid,
      'My Collection': { red: 0.118, green: 0.227, blue: 0.373 },
      'Sold':          { red: 0.153, green: 0.682, blue: 0.376 },
      'For Sale':      { red: 0.902, green: 0.494, blue: 0.133 },
      'Want-Upgrade List': { red: 0.353, green: 0.431, blue: 0.845 },  // combined (blend of want-blue + upgrade-purple)
      'Catalogs':      { red: 0.827, green: 0.651, blue: 0.263 },
      'Paper Items':   { red: 0.086, green: 0.627, blue: 0.522 },
      'Mock-Ups':      { red: 0.608, green: 0.349, blue: 0.714 },
      'Other Lionel':  { red: 0.498, green: 0.549, blue: 0.553 },
    };
    const tabColorReqs = Object.entries(TAB_COLORS)
      .filter(([n]) => tabMap.hasOwnProperty(n))
      .map(([n, c]) => ({ updateSheetProperties: {
        properties: { sheetId: tabMap[n], tabColor: c }, fields: 'tabColor'
      }}));

    // ── 5. Data tab header + freeze + banding ─────────────────────
    const DATA_TABS = ['My Collection','Sold','For Sale','Want-Upgrade List','Catalogs','Paper Items','Mock-Ups','Other Lionel','Instruction Sheets','Science Sets','Construction Sets','My Sets'];
    // ── v13 (fmt 20): deterministic column widths ─────────────────
    // autoResize sized columns to CONTENT: "Variation" shrank to 3 digits wide
    // (mid-word header wrap) while Notes ballooned past 250 chars. Now every
    // column fits its header's longest word, long-text columns get a fixed
    // readable width, and every user's sheet comes out looking the same.
    const MC_WIDTH_PX = {   // My Collection curated widths (0-based col index)
      0:110, 1:95, 2:125, 3:300, 4:150, 5:85, 6:80, 7:340, 8:80, 9:80,
      10:280, 11:80, 12:85, 13:85, 14:95, 15:65, 16:90, 17:200, 18:200,
      19:90, 20:110, 21:160, 22:80, 23:65, 24:110, 25:75, 26:85, 27:170,
      28:90, 29:60, 30:230, 31:150, 32:95,
    };
    const _wTabs = DATA_TABS.filter(t => tabMap.hasOwnProperty(t));
    let tabWidths = {};   // tab -> array of pixel widths per column
    try {
      const _hdrRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?` +
        _wTabs.map(t => 'ranges=' + encodeURIComponent(`'${t}'!2:2`)).join('&'),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const _hdrData = await _hdrRes.json();
      _wTabs.forEach((t, i) => {
        const hdrs = (((_hdrData.valueRanges || [])[i] || {}).values || [[]])[0] || [];
        tabWidths[t] = hdrs.map((h, ci) => {
          if (t === 'My Collection' && MC_WIDTH_PX[ci] !== undefined) return MC_WIDTH_PX[ci];
          const longest = String(h || '').split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
          return Math.min(320, Math.max(70, longest * 8 + 26));
        });
      });
    } catch (e) { console.warn('[SheetFormat] header width fetch failed, widths skipped:', e); }
    const widthReqs = _wTabs.flatMap(t =>
      (tabWidths[t] || []).map((px, ci) => ({
        updateDimensionProperties: {
          range: { sheetId: tabMap[t], dimension: 'COLUMNS', startIndex: ci, endIndex: ci + 1 },
          properties: { pixelSize: px }, fields: 'pixelSize'
        }
      }))
    );
    // Dashboard-button merge span: extend from col C until ~120px so the text
    // never clips, but never swallow a wide column into an orange slab.
    const btnEndCol = (t) => {
      const w = tabWidths[t] || [];
      let px = 0, c = 2;
      while (c < Math.min(w.length, 6)) { px += (w[c] || 90); c++; if (px >= 120) break; }
      return Math.max(c, 3);   // exclusive end col index; 3 = button is C1 alone
    };

    const dataReqs = DATA_TABS.filter(t => tabMap.hasOwnProperty(t)).flatMap(tab => {
      const sid = tabMap[tab];
      // Session 155 v6: header wrap, banding fix, My Collection gets col-A freeze
      const isMyCollection = (tab === 'My Collection');
      return [
        // Row 1 — branded header bar matching the Dashboard (appNavy + Oswald cream
        // + orange underline). The tab name stays in A1 (the app enforces it).
        { repeatCell: {
          range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: {
            backgroundColor: SB.appNavy,
            textFormat: { bold: true, foregroundColor: SB.cream, fontSize: 14, fontFamily: 'Oswald' },
            verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT'
          }},
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
        }},
        // Orange underline bar (thick bottom border on row 1) — matches Dashboard.
        { updateBorders: {
          range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 32 },
          bottom: { style: 'SOLID_THICK', color: SB.accent }
        }},
        { updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 34 }, fields: 'pixelSize'
        }},
        // Row 2 — column header band, v6: wrapStrategy WRAP added
        { repeatCell: {
          range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2 },
          cell: { userEnteredFormat: {
            backgroundColor: SB.navyMid,
            textFormat: { bold: true, foregroundColor: SB.white, fontSize: 9 },
            verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER',
            wrapStrategy: 'WRAP',
          }},
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy)'
        }},
        // Row 2 height bump for wrapped 2-line headers
        { updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 40 }, fields: 'pixelSize'
        }},
        // Freeze rows 1-2; My Collection also freezes column A
        { updateSheetProperties: {
          properties: {
            sheetId: sid,
            gridProperties: isMyCollection
              ? { frozenRowCount: 2, frozenColumnCount: 1 }
              : { frozenRowCount: 2 }
          },
          fields: isMyCollection
            ? 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
            : 'gridProperties.frozenRowCount'
        }},
        // Row banding — v6: NO headerColor (was causing navy row 3)
        { addBanding: { bandedRange: {
          range: { sheetId: sid, startRowIndex: 2, endRowIndex: 1000 },
          rowProperties: {
            firstBandColor:  { red: 0.957, green: 0.961, blue: 0.976 },
            secondBandColor: SB.white,
          }
        }}},
        // Quick link back to the Dashboard, right of the tab name (merged C1:D1).
        ...(dashId != null ? [
          // v13: clear any old fixed C1:D1 merge, then merge only as many
          // columns as the button text needs (wide col: C1 alone; narrow: 2-4).
          { unmergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 } }},
          ...(btnEndCol(tab) > 3 ? [{ mergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: btnEndCol(tab) }, mergeType: 'MERGE_ALL' }}] : []),
          { updateCells: {
            start: { sheetId: sid, rowIndex: 0, columnIndex: 2 },
            fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            rows: [{ values: [{
              userEnteredValue: { formulaValue: `=HYPERLINK("#gid=${dashId}","🏠 Dashboard")` },
              userEnteredFormat: { backgroundColor: SB.accent, textFormat: { bold: true, foregroundColor: SB.white, fontSize: 10, underline: false }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' }
            }] }]
          }},
          { updateBorders: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: btnEndCol(tab) }, top: { style: 'SOLID_THICK', color: SB.navyMid }, bottom: { style: 'SOLID_THICK', color: SB.navyMid }, left: { style: 'SOLID_THICK', color: SB.navyMid }, right: { style: 'SOLID_THICK', color: SB.navyMid } }}
        ] : [])
      ];
    });

    // Session 155: hide noise columns on My Collection by default.
    // (User can unhide manually in Sheets; app only sets visibility on apply,
    // never overrides user choice after that.)
    // Session 156: new schema positions —
    //   20=Matched Tender, 21=Set ID, 23=Is Error, 24=Error Desc,
    //   25=Quick Entry, 26=Inventory ID, 27=Group ID.
    const HIDE_COL_RANGES = [
      { start: 20, end: 22 },   // cols U, V (matchedTo, setId)
      { start: 23, end: 28 },   // cols X, Y, Z, AA, AB (isError, errorDesc, quickEntry, inventoryId, groupId)
    ];
    const hideReqs = tabMap.hasOwnProperty('My Collection')
      ? HIDE_COL_RANGES.map(r => ({
          updateDimensionProperties: {
            range: {
              sheetId: tabMap['My Collection'],
              dimension: 'COLUMNS',
              startIndex: r.start,
              endIndex:   r.end,
            },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser'
          }
        }))
      : [];

    // ─────────────────────────────────────────────────────────────
    // Session 155 Push B: data validation + number formatting on My Collection
    // Centralized config — one place to tweak column maps if schema changes.
    // ─────────────────────────────────────────────────────────────
    // Session 156 (Push 2): re-mapped to new 32-col schema
    const MC_VALIDATION = {
      yesNoCols:   [11, 15, 23, 25], // All Original, Has Box, Is Error, Quick Entry
      cond1to10:   [8, 16],          // Condition, Box Condition
      currencyCols:[9, 12, 13, 14],  // User Est. Worth, Item Only Price, Box Only Price, Item+Box Complete
      dateCols:    [19],             // Date Purchased
    };
    const DATA_START_ROW = 2;        // row 3 onward (skip title+header)

    let mcReqs = [];
    if (tabMap.hasOwnProperty('My Collection')) {
      const mcSid = tabMap['My Collection'];

      // Yes/No dropdowns
      MC_VALIDATION.yesNoCols.forEach(c => {
        mcReqs.push({
          setDataValidation: {
            range: {
              sheetId: mcSid,
              startRowIndex: DATA_START_ROW, endRowIndex: 5000,
              startColumnIndex: c, endColumnIndex: c + 1,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Yes' },
                  { userEnteredValue: 'No'  },
                ],
              },
              strict: false,           // soft validation — warns, allows manual override
              showCustomUi: true,      // shows the dropdown arrow in the cell
            }
          }
        });
      });

      // 1-10 condition number validation
      MC_VALIDATION.cond1to10.forEach(c => {
        mcReqs.push({
          setDataValidation: {
            range: {
              sheetId: mcSid,
              startRowIndex: DATA_START_ROW, endRowIndex: 5000,
              startColumnIndex: c, endColumnIndex: c + 1,
            },
            rule: {
              condition: {
                type: 'NUMBER_BETWEEN',
                values: [
                  { userEnteredValue: '1'  },
                  { userEnteredValue: '10' },
                ],
              },
              strict: false,
              inputMessage: 'Enter a number from 1 (poor) to 10 (mint).',
            }
          }
        });
      });

      // Currency format ($#,##0.00)
      MC_VALIDATION.currencyCols.forEach(c => {
        mcReqs.push({
          repeatCell: {
            range: {
              sheetId: mcSid,
              startRowIndex: DATA_START_ROW, endRowIndex: 5000,
              startColumnIndex: c, endColumnIndex: c + 1,
            },
            cell: { userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }
            }},
            fields: 'userEnteredFormat.numberFormat'
          }
        });
      });

      // Date format (yyyy-mm-dd)
      MC_VALIDATION.dateCols.forEach(c => {
        mcReqs.push({
          repeatCell: {
            range: {
              sheetId: mcSid,
              startRowIndex: DATA_START_ROW, endRowIndex: 5000,
              startColumnIndex: c, endColumnIndex: c + 1,
            },
            cell: { userEnteredFormat: {
              numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' }
            }},
            fields: 'userEnteredFormat.numberFormat'
          }
        });
      });
    }

    // v13: autoResize removed — it sized columns to whatever data happened to
    // be present (Notes -> 250+ wide, Variation -> 3 digits). widthReqs above
    // now sets deterministic widths for every data tab.

    // ── 6. Dashboard formatting requests ──────────────────────────
    const dashReqs = [
      // No-white: flood the ENTIRE Dashboard grid with the app page bg so no
      // white rows/columns show anywhere (content formats below override this).
      { repeatCell: {
        range: { sheetId: dashId },
        cell: { userEnteredFormat: { backgroundColor: SB.appBg } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Freeze row 3 (banner = rows 1-3) + hide gridlines (no-white look)
      { updateSheetProperties: {
        properties: { sheetId: dashId, gridProperties: { frozenRowCount: 4, hideGridlines: true } },
        fields: 'gridProperties.frozenRowCount,gridProperties.hideGridlines'
      }},
      // Row heights
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 34 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 30 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 30 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 8  }, fields: 'pixelSize' }},
      // (Body row heights + tile formatting are applied dynamically in
      //  _writeDashboardContent — they depend on which cards are chosen.)
      // Column widths: A=190 B=100 C=12 D=190 E=100 F=60 G=60 H=60
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 190 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 100 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 12  }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 190 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 100 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 5, endIndex: 9 }, properties: { pixelSize: 78  }, fields: 'pixelSize' }},
      // Banner rows 1-3 full width (A:H) — app header navy (#1a1d3a)
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColor: SB.appNavy } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Clear any stale header merges from prior format versions (old layout
      // merged the mascot into F1:H3) before applying the new merges.
      { unmergeCells: { range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 9 } }},
      // Mascot now lives on the LEFT (col A, rows 1-3) — matches the app header.
      { mergeCells: { range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 }, mergeType: 'MERGE_ALL' }},
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { backgroundColor: SB.appNavy, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment)'
      }},
      // Title spans B1:E1 — the rich-text "THE RAIL ROSTER" is written in
      // _writeDashboardContent (multicolor runs can't be set via the values API).
      { mergeCells: { range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 5 }, mergeType: 'MERGE_ALL' }},
      // Row 2: user name — cream medium (cols B:E)
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { bold: false, foregroundColor: SB.cream, fontSize: 11 },
          verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(textFormat,verticalAlignment)'
      }},
      // Row 3: last synced — dim cream small (cols B:E)
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { bold: false, foregroundColor: { red: 0.85, green: 0.78, blue: 0.55 }, fontSize: 9 },
          verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(textFormat,verticalAlignment)'
      }},
      // Row 4: the app's orange underline bar (thin accent strip under the header)
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColor: SB.accent } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
    ];

    // ── 7. Fetch existing banding so we can delete-then-re-add ────
    // Sheets API rejects addBanding if a banded range already exists on the
    // same range. We have to delete first. (Was the silent killer of every
    // batchUpdate when applySheetFormatting ran more than once.)
    let deleteBandingReqs = [];
    try {
      const bandMetaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties.title,bandedRanges.bandedRangeId)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const bandMeta = await bandMetaRes.json();
      const dataTabsSet = new Set(DATA_TABS.concat(['Dashboard']));
      (bandMeta.sheets || []).forEach(s => {
        if (!dataTabsSet.has(s.properties.title)) return;
        (s.bandedRanges || []).forEach(b => {
          if (b.bandedRangeId) {
            deleteBandingReqs.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
          }
        });
      });
      if (deleteBandingReqs.length) {
        console.log('[SheetFormat] Will delete', deleteBandingReqs.length, 'existing banding(s) before re-adding');
      }
    } catch(e) { console.warn('[SheetFormat] Could not fetch existing bandings:', e); }

    // ── 7b. Delete existing bandings in a SEPARATE batch (v10).
    // This way "No BandedRange with id" errors don't tank the whole format apply.
    // (Happens when applySheetFormatting fires concurrently — second call tries
    // to delete bandings the first call already removed.)
    if (deleteBandingReqs.length) {
      try {
        const delRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: deleteBandingReqs })
        });
        if (!delRes.ok) {
          const t = await delRes.text();
          console.warn('[SheetFormat] deleteBanding batch had errors (proceeding anyway):', t.substring(0, 200));
        }
      } catch(e) { console.warn('[SheetFormat] deleteBanding batch threw (proceeding):', e); }
    }

    // ── 8. Send all format requests ────────────────────────────────
    const allReqs = [...tabColorReqs, ...dataReqs, ...hideReqs, ...mcReqs, ...dashReqs, ...widthReqs];
    // v8: check response — Google batchUpdate returns 400 with a body explaining
    // which request failed. Don't write the version stamp if batch failed!
    const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: allReqs })
    });
    if (!batchRes.ok) {
      const errBody = await batchRes.text();
      console.error('[SheetFormat] batchUpdate FAILED:', batchRes.status, errBody);
      throw new Error('batchUpdate failed: ' + batchRes.status);
    }

    // ── 8. Write dashboard content ─────────────────────────────────
    await _writeDashboardContent(sheetId);

    // ── 9. Version stamp (only on success — guarded by above throw) ────
    // v18: label the new trailing Scale/Gauge column (idempotent full-header rewrite).
    try { await sheetsUpdate(sheetId, "'My Collection'!A1", [PERSONAL_HEADERS]); }
    catch (eH) { console.warn('[SheetFormat] personal header rewrite failed:', eH); }
    await sheetsUpdate(sheetId, 'Dashboard!A50', [[SHEET_FORMAT_VER]]);
    console.log('[SheetFormat] Applied v' + SHEET_FORMAT_VER);

    // Session 155: re-apply structural protections after formatting completes.
    if (_wasLocked && typeof lockSheetTabs === 'function') {
      try {
        await lockSheetTabs(sheetId);
        console.log('[Format] Re-locked sheet after formatting');
      } catch(e) { console.warn('[Format] Re-lock failed:', e); }
    }
  } catch(e) {
    console.warn('[SheetFormat] Non-fatal:', e.message);
    // Try to re-lock even if formatting threw, so we don't leave sheet unlocked
    if (_wasLocked && typeof lockSheetTabs === 'function') {
      try { await lockSheetTabs(sheetId); } catch(_) {}
    }
  }
}

// Build a sheet-friendly model for one dashboard card. Single-number cards
// reuse the card's own compute() (so the numbers match the app exactly);
// breakdown cards are re-derived into [name,count] rows using the same globals.
function _sheetCardModel(card, state) {
  var out = { label: card.label, value: '', sub: '', rows: null };
  var r = {};
  try { r = card.compute(state) || {}; } catch (e) { r = {}; }
  if (r && r.value !== undefined && r.html === undefined) {
    out.value = String(r.value); out.sub = r.sub || ''; return out;
  }
  var eraEnabled = (typeof _pdEraEnabled === 'function') ? _pdEraEnabled : function () { return true; };
  try {
    switch (card.id) {
      case 'owned': {
        var items = _ownedNonBox(state), extra = 0;
        Object.values(state.ephemeraData || {}).forEach(function (b) { extra += Object.keys(b).length; });
        if (typeof _standaloneISCount === 'function') extra += _standaloneISCount(state);
        extra += Object.keys(state.scienceData || {}).length + Object.keys(state.constructionData || {}).length;
        out.value = (items.length + extra).toLocaleString(); out.sub = 'total';
        var byEra = {}; items.forEach(function (pd) { var e = _eraOf(pd); byEra[e] = (byEra[e] || 0) + 1; });
        var rows = [];
        Object.keys(ERAS).forEach(function (ek) {
          if (ek === 'all') return;
          if (typeof _isEraEnabled === 'function' && !_isEraEnabled(ek)) return;
          if (byEra[ek]) rows.push([ERAS[ek].label, byEra[ek].toLocaleString()]);
        });
        if (extra > 0) rows.push(['Paper / Sets', extra.toLocaleString()]);
        out.rows = rows; return out;
      }
      case 'activity': {
        var w = Object.keys((typeof _filterByEraPref === 'function' ? _filterByEraPref(state.wantData || {}) : (state.wantData || {}))).length;
        var fs = Object.keys(_forSaleLeads(state)).length;
        var sd = Object.keys((typeof _filterByEraPref === 'function' ? _filterByEraPref(state.soldData || {}) : (state.soldData || {}))).length;
        out.rows = [['Want', w], ['For Sale', fs], ['Sold', sd]]; return out;
      }
      case 'eraProgress': {
        if (typeof _cacheEraMasterTotal === 'function') _cacheEraMasterTotal();
        var items2 = _ownedNonBox(state), byEra2 = {};
        items2.forEach(function (pd) { var e = _eraOf(pd); byEra2[e] = (byEra2[e] || 0) + 1; });
        var rows2 = [];
        Object.keys(ERAS).forEach(function (ek) {
          if (ek === 'all') return;
          if (typeof _isEraEnabled === 'function' && !_isEraEnabled(ek)) return;
          var owned = byEra2[ek] || 0, total = 0;
          if (typeof _currentEra !== 'undefined' && _currentEra === 'all') {
            total = (typeof _getEraMasterTotal === 'function' && _getEraMasterTotal(ek)) || (state.masterData || []).filter(function (m) { return m._era === ek; }).length;
          } else if (typeof _currentEra !== 'undefined' && ek === _currentEra) {
            total = (state.masterData || []).length;
          } else {
            total = (typeof _getEraMasterTotal === 'function' && _getEraMasterTotal(ek)) || 0;
          }
          rows2.push([ERAS[ek].label, owned + (total > 0 ? ' / ' + total.toLocaleString() : '')]);
        });
        out.rows = rows2; return out;
      }
      case 'topRoads': {
        var roads = {};
        Object.values(state.personalData).filter(function (pd) { return pd.owned; }).filter(eraEnabled).forEach(function (pd) {
          var master = (typeof findMaster==='function') ? findMaster(pd.itemNum, pd.variation, pd) : null;
          var road = master ? (master.roadName || '').trim() : '';
          if (road && road !== '—' && road !== 'N/A') roads[road] = (roads[road] || 0) + 1;
        });
        var sorted = Object.entries(roads).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
        out.rows = sorted.map(function (e) { return [e[0], e[1]]; });
        if (!out.rows.length) out.sub = 'No road names yet';
        return out;
      }
      case 'collectionByType': {
        var eS = _ownedTypeNumSet(state, _ENGINE_BUCKETS), tS = _ownedTypeNumSet(state, _TENDER_BUCKETS), cS = _ownedTypeNumSet(state, _CABOOSE_BUCKETS),
            pS = _ownedTypeNumSet(state, _PASSENGER_BUCKETS), fS = _ownedTypeNumSet(state, _FREIGHT_BUCKETS), aS = _ownedTypeNumSet(state, _ACCESSORY_BUCKETS);
        var types = { Engines: 0, Tenders: 0, Freight: 0, Passenger: 0, Cabooses: 0, Accessories: 0, Other: 0 };
        _ownedNonBox(state).filter(eraEnabled).forEach(function (pd) {
          if (_pdMatchSet(pd, eS)) types.Engines++;
          else if (_pdMatchSet(pd, tS)) types.Tenders++;
          else if (_pdMatchSet(pd, cS)) types.Cabooses++;
          else if (_pdMatchSet(pd, pS)) types.Passenger++;
          else if (_pdMatchSet(pd, fS)) types.Freight++;
          else if (_pdMatchSet(pd, aS)) types.Accessories++;
          else types.Other++;
        });
        var rows3 = []; Object.entries(types).forEach(function (e) { if (e[1] > 0) rows3.push([e[0], e[1]]); });
        out.rows = rows3; return out;
      }
      default:
        out.value = '—'; out.sub = 'open the app to view'; return out;
    }
  } catch (e) { out.value = '—'; return out; }
}

async function _writeDashboardContent(sheetId) {
  if (!sheetId) return;

  var userName = (state.user && state.user.name) ? state.user.name : 'Collector';
  var firstName = userName.split(' ')[0];
  var now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Resolve all tab ids (rich-text title + nav buttons jump to a tab's gid).
  var ids = {}, dId = null;
  try {
    var meta = await (await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )).json();
    (meta.sheets || []).forEach(function (s) { ids[s.properties.title] = s.properties.sheetId; if (s.properties.title === 'Dashboard') dId = s.properties.sheetId; });
  } catch (e) { console.warn('[Dashboard] tab lookup failed:', e); }

  function _btn(tab, label) { var g = ids[tab]; return (g != null) ? `=HYPERLINK("#gid=${g}","${label}")` : label; }

  // Header (rows 1-3): mascot (A1) + title (B1, rich text below) + name/sync (B2/B3),
  // and the Quick Tab Buttons block on the RIGHT (cols F-I).
  await sheetsUpdate(sheetId, 'Dashboard!A1:I3', [
    [`=IMAGE("${CONDUCTOR_HEADER_URL}",4,80,65)`, '', '', '', '', 'QUICK TAB BUTTONS', '', '', ''],
    ['', `${firstName}'s Collection`, '', '', '', _btn('My Collection', '📋  My Collection'), '', _btn('Want-Upgrade List', '🔎  Want / Upgrade'), ''],
    ['', `Last app sync: ${now}`, '', '', '', _btn('For Sale', '🏷️  For Sale'), '', _btn('Sold', '✅  Sold'), '']
  ]);

  // Body = the app's chosen cards as compact 2-column tiles (start at sheet row 5).
  var TOTAL = 64, NCOLS = 8;
  var active = [];
  try {
    var slots = (typeof _getSlots === 'function') ? _getSlots() : [{ id: 'owned' }, { id: 'value' }, { id: 'eraProgress' }, { id: 'activity' }];
    (slots || []).forEach(function (s) { if (s && s.id && typeof CARD_CATALOG !== 'undefined') { var c = CARD_CATALOG.find(function (x) { return x.id === s.id; }); if (c) active.push(c); } });
  } catch (e) { console.warn('[Dashboard] slot read failed:', e); }
  if (!active.length && typeof CARD_CATALOG !== 'undefined') {
    ['owned', 'value', 'eraProgress', 'activity'].forEach(function (id) { var c = CARD_CATALOG.find(function (x) { return x.id === id; }); if (c) active.push(c); });
  }
  active = active.slice(0, 6);
  var models = active.map(function (c) { return _sheetCardModel(c, state); });

  function _tileLines(m) {
    var lines = 0;
    if (m.value) { if (m.rows && m.rows.length) { lines += 1; } else { lines += 1 + (m.sub ? 1 : 0); } }
    if (m.rows && m.rows.length) { lines += m.rows.length; }
    else if (!m.value && m.sub) { lines += 1; }
    return 1 + Math.max(lines, 1);
  }
  function _placeTile(body, m, top, tcol, ncol) {
    body[top][tcol] = (m.label || '').toUpperCase();
    var line = top + 1;
    if (m.value) {
      if (m.rows && m.rows.length) { body[line][tcol] = 'Total'; body[line][ncol] = m.value; line++; }
      else { body[line][tcol] = m.value; line++; if (m.sub) { body[line][tcol] = m.sub; line++; } }
    }
    if (m.rows && m.rows.length) { m.rows.forEach(function (rw) { body[line][tcol] = rw[0]; body[line][ncol] = String(rw[1]); line++; }); }
    else if (!m.value && m.sub) { body[line][tcol] = m.sub; }
  }

  var body = [];
  for (var r = 0; r < TOTAL; r++) { body.push(new Array(NCOLS).fill('')); }
  var bands = [];
  var cursor = 0;   // body row 0 = sheet row 5
  for (var i = 0; i < models.length; i += 2) {
    var L = models[i], R = (i + 1 < models.length) ? models[i + 1] : null;
    var bh = Math.max(_tileLines(L), R ? _tileLines(R) : 0);
    _placeTile(body, L, cursor, 0, 1);
    if (R) _placeTile(body, R, cursor, 3, 4);
    bands.push({ top: cursor, h: bh, hasR: !!R });
    cursor += bh + 1;   // 1-row gap between bands
  }
  var footerRow = cursor;
  if (footerRow < TOTAL) body[footerRow][0] = 'Open The Rail Roster app to manage your collection  ·  read-only';
  await sheetsUpdate(sheetId, 'Dashboard!A5:H' + (5 + TOTAL - 1), body);

  if (dId == null) return;

  // ── Formatting (tiles + nav buttons + borders + title) in one batchUpdate. ──
  var BODY_START = 4;  // sheet row 5
  var navyMid = { red: 0.118, green: 0.227, blue: 0.373 }, labelBg = { red: 0.133, green: 0.196, blue: 0.31 },
      appBg = { red: 0.059, green: 0.071, blue: 0.125 }, appNavy = { red: 0.102, green: 0.114, blue: 0.227 },
      accent = { red: 0.941, green: 0.314, blue: 0.031 }, gold = { red: 1.0, green: 0.878, blue: 0.376 },
      white = { red: 1, green: 1, blue: 1 }, dim = { red: 0.7, green: 0.74, blue: 0.8 };
  function S(rb) { return BODY_START + rb; }
  var BORDER = { style: 'SOLID_THICK', color: navyMid };
  function _box(r0, r1, c0, c1) { return { updateBorders: { range: { sheetId: dId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 }, top: BORDER, bottom: BORDER, left: BORDER, right: BORDER } }; }
  var reqs = [];

  // Clear stale body formatting.
  reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: BODY_START, endRowIndex: BODY_START + TOTAL, startColumnIndex: 0, endColumnIndex: 26 }, cell: { userEnteredFormat: { backgroundColor: appBg } }, fields: 'userEnteredFormat.backgroundColor' } });
  // Body row heights (22px so the big values aren't clipped).
  reqs.push({ updateDimensionProperties: { range: { sheetId: dId, dimension: 'ROWS', startIndex: BODY_START, endIndex: S(footerRow) + 2 }, properties: { pixelSize: 22 }, fields: 'pixelSize' } });

  // Tiles.
  bands.forEach(function (band) {
    var sides = [[0, 1]]; if (band.hasR) sides.push([3, 4]);
    sides.forEach(function (cc) {
      var tcol = cc[0], ncol = cc[1], hdr = S(band.top), bot = hdr + band.h;
      reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: hdr, endRowIndex: bot, startColumnIndex: tcol, endColumnIndex: ncol + 1 }, cell: { userEnteredFormat: { backgroundColor: labelBg } }, fields: 'userEnteredFormat.backgroundColor' } });
      reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: hdr + 1, endRowIndex: bot, startColumnIndex: tcol, endColumnIndex: ncol + 1 }, cell: { userEnteredFormat: { textFormat: { foregroundColor: white, fontSize: 9 }, verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT' } }, fields: 'userEnteredFormat(textFormat,verticalAlignment,horizontalAlignment)' } });
      reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: hdr + 1, endRowIndex: bot, startColumnIndex: ncol, endColumnIndex: ncol + 1 }, cell: { userEnteredFormat: { textFormat: { foregroundColor: gold, bold: true, fontSize: 9 }, horizontalAlignment: 'RIGHT', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)' } });
      reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: hdr, endRowIndex: hdr + 1, startColumnIndex: tcol, endColumnIndex: ncol + 1 }, cell: { userEnteredFormat: { backgroundColor: navyMid, textFormat: { bold: true, foregroundColor: gold, fontSize: 9 }, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)' } });
    });
  });
  // Single-number cards: big value (font 14 so it isn't clipped) + dim sub.
  models.forEach(function (m, i) {
    if (!(m.value && !(m.rows && m.rows.length))) return;
    var bi = Math.floor(i / 2), side = i % 2;
    if (bi >= bands.length) return;
    var top = bands[bi].top, tcol = side ? 3 : 0, ncol = side ? 4 : 1;
    reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: S(top) + 1, endRowIndex: S(top) + 2, startColumnIndex: tcol, endColumnIndex: tcol + 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: gold, fontSize: 14 }, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)' } });
    if (m.sub) reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: S(top) + 2, endRowIndex: S(top) + 3, startColumnIndex: tcol, endColumnIndex: ncol + 1 }, cell: { userEnteredFormat: { textFormat: { foregroundColor: dim, fontSize: 8 } } }, fields: 'userEnteredFormat.textFormat' } });
  });

  // Footer.
  reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: S(footerRow), endRowIndex: S(footerRow) + 1, startColumnIndex: 0, endColumnIndex: 8 }, cell: { userEnteredFormat: { backgroundColor: appBg, textFormat: { italic: true, foregroundColor: { red: 0.55, green: 0.6, blue: 0.65 }, fontSize: 8 }, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)' } });

  // ── Quick Tab Buttons block (header right, rows 1-3, cols F-I). ──
  reqs.push({ unmergeCells: { range: { sheetId: dId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 5, endColumnIndex: 9 } } });
  // Title line F1:I1
  reqs.push({ mergeCells: { range: { sheetId: dId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 5, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 5, endColumnIndex: 9 }, cell: { userEnteredFormat: { backgroundColor: appNavy, textFormat: { bold: true, foregroundColor: white, fontSize: 9 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)' } });
  reqs.push(_box(0, 1, 5, 9));
  // 4 buttons (2x2): row index, col start, col end
  [[1, 5, 7], [1, 7, 9], [2, 5, 7], [2, 7, 9]].forEach(function (b) {
    reqs.push({ mergeCells: { range: { sheetId: dId, startRowIndex: b[0], endRowIndex: b[0] + 1, startColumnIndex: b[1], endColumnIndex: b[2] }, mergeType: 'MERGE_ALL' } });
    reqs.push({ repeatCell: { range: { sheetId: dId, startRowIndex: b[0], endRowIndex: b[0] + 1, startColumnIndex: b[1], endColumnIndex: b[2] }, cell: { userEnteredFormat: { backgroundColor: accent, textFormat: { bold: true, foregroundColor: white, fontSize: 10, underline: false }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)' } });
    reqs.push(_box(b[0], b[0] + 1, b[1], b[2]));
  });

  // Rich-text title (B1).
  var TITLE = 'THE RAIL ROSTER', railStart = TITLE.indexOf('RAIL'), railEnd = railStart + 4;
  var cream = { red: 0.973, green: 0.910, blue: 0.753 }, orange = { red: 0.941, green: 0.314, blue: 0.031 };
  reqs.push({ updateCells: {
    start: { sheetId: dId, rowIndex: 0, columnIndex: 1 },
    fields: 'userEnteredValue,userEnteredFormat(textFormat,verticalAlignment,horizontalAlignment,backgroundColor),textFormatRuns',
    rows: [{ values: [{
      userEnteredValue: { stringValue: TITLE },
      userEnteredFormat: { backgroundColor: { red: 0.102, green: 0.114, blue: 0.227 }, verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT', textFormat: { bold: true, fontFamily: 'Oswald', fontSize: 18, foregroundColor: cream } },
      textFormatRuns: [{ startIndex: 0, format: { foregroundColor: cream } }, { startIndex: railStart, format: { foregroundColor: orange } }, { startIndex: railEnd, format: { foregroundColor: cream } }]
    }] }]
  } });

  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: reqs })
    });
  } catch (e) { console.warn('[Dashboard] body/title format failed (non-fatal):', e); }
}

// ══════════════════════════════════════════════════════════════════
// LOCK / UNLOCK SHEET PROTECTION
// ══════════════════════════════════════════════════════════════════

async function getSheetLockState(sheetId) {
  // Returns { locked: bool, protectionIds: [] }
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties.title,protectedRanges)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    const ids = [];
    (data.sheets || []).forEach(s => {
      (s.protectedRanges || []).forEach(p => {
        // Session 155: recognize current + legacy descriptions
        if (p.description === 'railroster-structural-v1' ||
            p.description === 'boxcar-data-lock') ids.push(p.protectedRangeId);
      });
    });
    return { locked: ids.length > 0, protectionIds: ids };
  } catch(e) {
    return { locked: false, protectionIds: [] };
  }
}

// Centralized config — every tweakable value lives here.
// Bump LOCK_DESCRIPTION when changing the set of protected ranges so old
// protections get cleaned up.
const LOCK_CONFIG = {
  description: 'railroster-structural-v1',
  legacyDescriptions: ['boxcar-data-lock'],  // older versions, cleaned up on next lock
  // Tabs whose row 1 (title) and row 2 (headers) get locked.
  headerTabs: ['My Collection','Sold','For Sale','Want-Upgrade List',
               'Catalogs','Paper Items','Mock-Ups','Other Lionel',
               'Instruction Sheets','Science Sets','Construction Sets','My Sets'],
  // Tabs locked entirely (no row/col bounds = whole sheet).
  fullLockTabs: ['Dashboard'],
  // My Collection technical columns to lock (0-indexed column numbers from PERSONAL_HEADERS).
  // 14=Matched Tender, 15=Set ID, 17=Is Error, 18=Error Description,
  // 19=Quick Entry, 20=Inventory ID, 21=Group ID.
  myCollectionTechColRanges: [
    { start: 14, end: 16 },   // Matched Tender + Set ID  (cols O, P)
    { start: 17, end: 22 },   // Is Error..Group ID       (cols R, S, T, U, V)
  ],
};

async function lockSheetTabs(sheetId) {
  if (!sheetId || !accessToken) return;
  try {
    // 1. Remove ALL existing protections (current + legacy descriptions) so we never duplicate.
    const allDescriptions = [LOCK_CONFIG.description].concat(LOCK_CONFIG.legacyDescriptions);
    const stateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties.sheetId,properties.title,properties.gridProperties,protectedRanges)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const stateData = await stateRes.json();
    const toRemove = [];
    (stateData.sheets || []).forEach(s => {
      (s.protectedRanges || []).forEach(p => {
        if (allDescriptions.indexOf(p.description) >= 0) toRemove.push(p.protectedRangeId);
      });
    });
    if (toRemove.length > 0) {
      const removeReqs = toRemove.map(id => ({ deleteProtectedRange: { protectedRangeId: id } }));
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: removeReqs })
      });
    }

    // 2. Build sheet-id lookup + col-count lookup from the already-fetched metadata
    const tabMap = {};
    const tabCols = {};
    (stateData.sheets || []).forEach(s => {
      tabMap[s.properties.title] = s.properties.sheetId;
      tabCols[s.properties.title] = (s.properties.gridProperties || {}).columnCount || 26;
    });

    const requests = [];

    // 3. Lock rows 1-2 on every data tab (the title + header bands)
    LOCK_CONFIG.headerTabs.forEach(tabName => {
      if (!tabMap.hasOwnProperty(tabName)) return;
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: {
              sheetId: tabMap[tabName],
              startRowIndex: 0,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: tabCols[tabName],
            },
            description: LOCK_CONFIG.description,
            warningOnly: false,
          }
        }
      });
    });

    // 4. Lock entire Dashboard / other full-lock tabs
    LOCK_CONFIG.fullLockTabs.forEach(tabName => {
      if (!tabMap.hasOwnProperty(tabName)) return;
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId: tabMap[tabName] },
            description: LOCK_CONFIG.description,
            warningOnly: false,
          }
        }
      });
    });

    // 5. Lock My Collection technical columns (rows 3+ only — leave headers in headerTab lock)
    if (tabMap.hasOwnProperty('My Collection')) {
      LOCK_CONFIG.myCollectionTechColRanges.forEach(colRange => {
        requests.push({
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId: tabMap['My Collection'],
                startRowIndex: 2,                  // row 3 onward (skip the header range)
                startColumnIndex: colRange.start,
                endColumnIndex: colRange.end,
              },
              description: LOCK_CONFIG.description,
              warningOnly: false,
            }
          }
        });
      });
    }

    if (!requests.length) {
      console.log('[SheetLock] Nothing to lock');
      return;
    }

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    console.log('[SheetLock] Applied', requests.length, 'structural protections');
  } catch(e) {
    console.warn('[SheetLock] Lock failed:', e.message);
    throw e;
  }
}

async function unlockSheetTabs(sheetId) {
  if (!sheetId || !accessToken) return;
  try {
    const { protectionIds } = await getSheetLockState(sheetId);
    if (!protectionIds.length) return;
    const requests = protectionIds.map(id => ({ deleteProtectedRange: { protectedRangeId: id } }));
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    console.log('[SheetLock] Tabs unlocked');
  } catch(e) {
    console.warn('[SheetLock] Unlock failed:', e.message);
    throw e;
  }
}
