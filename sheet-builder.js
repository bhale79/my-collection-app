// ══════════════════════════════════════════════════════════════════
// sheet-builder.js — Sheet formatting, Dashboard tab, Lock/Unlock
// Depends on: accessToken, state, sheetsUpdate(), normalizeItemNum()
// All functions are non-destructive — never touch data rows (row 3+)
// ══════════════════════════════════════════════════════════════════

// Bump this number to push a visual refresh to all users on next sync
const SHEET_FORMAT_VER = 12; // Session 165 v12: Dashboard header rebuilt to match the app (mascot left, multicolor Oswald title, app navy + orange underline bar) + no-white styling (hide gridlines, flood page with app bg).

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

const CONDUCTOR_URL = 'https://raw.githubusercontent.com/bhale79/my-collection-app/main/conductor-list.png';
// App header mascot — matches the app's top-left conductor exactly.
const CONDUCTOR_HEADER_URL = 'https://raw.githubusercontent.com/bhale79/my-collection-app/main/img/conductor-header.png';

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
    const dataReqs = DATA_TABS.filter(t => tabMap.hasOwnProperty(t)).flatMap(tab => {
      const sid = tabMap[tab];
      // Session 155 v6: header wrap, banding fix, My Collection gets col-A freeze
      const isMyCollection = (tab === 'My Collection');
      return [
        // Row 1 — branded title bar (v8: removed padding; Sheets API requires all 4 sides or none)
        { repeatCell: {
          range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: {
            backgroundColor: SB.navy,
            textFormat: { bold: true, foregroundColor: SB.gold, fontSize: 13, fontFamily: 'Arial' },
            verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
          }},
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
        }},
        { updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 30 }, fields: 'pixelSize'
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
        }}}
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

    // Session 155 v6: auto-resize columns on every data tab
    // (sizes each col to its longest content; hidden cols stay hidden)
    const autoResizeReqs = DATA_TABS.filter(t => tabMap.hasOwnProperty(t)).map(t => ({
      autoResizeDimensions: {
        dimensions: {
          sheetId: tabMap[t],
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 30,
        }
      }
    }));

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
        properties: { sheetId: dashId, gridProperties: { frozenRowCount: 3, hideGridlines: true } },
        fields: 'gridProperties.frozenRowCount,gridProperties.hideGridlines'
      }},
      // Row heights
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 48 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 24 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 20 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 8  }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 22 }, fields: 'pixelSize' }},
      // Stat rows 6-9
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 5, endIndex: 9 }, properties: { pixelSize: 32 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 10 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'ROWS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 22 }, fields: 'pixelSize' }},
      // Column widths: A=190 B=100 C=12 D=190 E=100 F=60 G=60 H=60
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 190 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 100 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 12  }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 190 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 100 }, fields: 'pixelSize' }},
      { updateDimensionProperties: { range: { sheetId: dashId, dimension: 'COLUMNS', startIndex: 5, endIndex: 8 }, properties: { pixelSize: 60  }, fields: 'pixelSize' }},
      // Banner rows 1-3 full width (A:H) — app header navy (#1a1d3a)
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.appNavy } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Clear any stale header merges from prior format versions (old layout
      // merged the mascot into F1:H3) before applying the new merges.
      { unmergeCells: { range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 8 } }},
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
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.accent } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 5: section headers — navyMid bg, gold text, bold, small caps
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.navyMid,
          textFormat: { bold: true, foregroundColor: SB.gold, fontSize: 8 },
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }},
      // Col C (divider) rows 5-10 — navy bg
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 10, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { backgroundColor: SB.navyMid } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Stat label cols A+D rows 6-9 — labelBg, white text, 10pt
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.labelBg,
          textFormat: { bold: false, foregroundColor: SB.white, fontSize: 10 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
      }},
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 3, endColumnIndex: 4 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.labelBg,
          textFormat: { bold: false, foregroundColor: SB.white, fontSize: 10 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
      }},
      // Stat value cols B+E rows 6-9 — goldBg, navy bold, 14pt, center
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.goldBg,
          textFormat: { bold: true, foregroundColor: SB.navy, fontSize: 13 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
      }},
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.goldBg,
          textFormat: { bold: true, foregroundColor: SB.navy, fontSize: 13 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
      }},
      // Session 164: explicit NUMBER format for all stat value cells so
      // counts don't show as "$52" because of a leftover currency format.
      // Currency/text formulas (Collection Value, Avg Condition) wrap their
      // result in TEXT(...) so the cell format doesn't matter for them.
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
        fields: 'userEnteredFormat.numberFormat'
      }},
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 5, endRowIndex: 9, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
        fields: 'userEnteredFormat.numberFormat'
      }},
      // Cols F-H rows 5-9 — app page bg
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 10, startColumnIndex: 5, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.appBg } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 10: spacer — app page bg
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.appBg } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 11: footer — dim italic small
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.appBg,
          textFormat: { italic: true, foregroundColor: { red: 0.55, green: 0.6, blue: 0.65 }, fontSize: 8 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
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
    const allReqs = [...tabColorReqs, ...dataReqs, ...hideReqs, ...mcReqs, ...dashReqs, ...autoResizeReqs];
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

async function _writeDashboardContent(sheetId) {
  if (!sheetId) return;

  const userName = (state.user?.name || 'Collector');
  const firstName = userName.split(' ')[0];
  const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const ownedItems = Object.values(state.personalData).filter(pd => {
    if (!pd.owned) return false;
    const noC = !pd.condition || pd.condition === 'N/A';
    const noP = !pd.priceItem || pd.priceItem === 'N/A';
    return !(pd.hasBox === 'Yes' && noC && noP);
  });
  let ephCount = 0;
  Object.values(state.ephemeraData || {}).forEach(b => { ephCount += Object.keys(b).length; });
  const totalItems = ownedItems.length + ephCount;

  let totalValue = 0;
  ownedItems.forEach(pd => { if (pd.userEstWorth) totalValue += parseFloat(pd.userEstWorth) || 0; });
  Object.values(state.ephemeraData || {}).forEach(b => {
    Object.values(b).forEach(it => { if (it.estValue) totalValue += parseFloat(it.estValue) || 0; });
  });

  const condItems = ownedItems.filter(pd => pd.condition && !isNaN(parseFloat(pd.condition)));
  const avgCond = condItems.length > 0
    ? (condItems.reduce((s, pd) => s + parseFloat(pd.condition), 0) / condItems.length).toFixed(1)
    : '—';

  const engines = state.masterData.filter(m => {
    const t = (m.itemType || '').toLowerCase();
    return (t.includes('steam') || t.includes('diesel') || t.includes('electric') || t.includes('locomotive'))
      && ownedItems.some(pd => normalizeItemNum(pd.itemNum) === normalizeItemNum(m.itemNum));
  }).length;

  const wantCount    = Object.keys(state.wantData    || {}).length;
  const forSaleCount = Object.keys(state.forSaleData || {}).length;
  const upgradeCount = Object.keys(state.upgradeData || {}).length;
  const soldCount    = Object.keys(state.soldData    || {}).length;

  const valueStr = totalValue > 0 ? _currencySymbol() + Math.round(totalValue).toLocaleString() : '—';

  // Session 164: replace static values with LIVE FORMULAS so the dashboard
  // stays accurate even when the user edits the personal sheet directly
  // (e.g. deletes rows). Locomotives stays as a static value because it
  // requires a join against master-data Item Type — that can only be
  // computed by the app at sync time.
  const rows = [
    // Row 1: mascot on the LEFT (A1, merged A1:A3) + title in B1 (rich-text,
    // written separately below so "RAIL" can be orange). Matches the app header.
    [`=IMAGE("${CONDUCTOR_HEADER_URL}",4,80,65)`, '', '', '', '', ''],
    // Row 2: User name (col B — col A is the mascot merge)
    ['', `${firstName}'s Collection`, '', '', '', ''],
    // Row 3: Last app sync timestamp (col B)
    ['', `Last app sync: ${now}`, '', '', '', ''],
    // Row 4: spacer (orange underline bar — formatted, no content)
    ['', '', '', '', '', ''],
    // Row 5: Section headers
    ['MY COLLECTION', '', '', 'ACTIVITY', '', ''],
    // Rows 6-9: Stats. Most are live formulas; Locomotives stays static.
    // Data on each tab starts at row 3 (row 1 = label, row 2 = headers).
    ['Items in Collection',
       `=IFERROR(MAX(0,COUNTA('My Collection'!A:A)-2),0)`,
       '', 'Locomotives',
       engines.toLocaleString(),
       ''],
    ['Collection Value',
       `=IFERROR(TEXT(SUM('My Collection'!N3:N), "$#,##0"), "—")`,
       '', 'Avg Condition',
       `=IFERROR(ROUND(AVERAGE('My Collection'!C3:C),1) & " / 10", "—")`,
       ''],
    ['Want-Upgrade List',
       // Combined count (Want + Upgrade together, since they share one tab now).
       `=IFERROR(MAX(0,COUNTA('Want-Upgrade List'!A:A)-2),0)`,
       '', 'For Sale',
       `=IFERROR(MAX(0,COUNTA('For Sale'!A:A)-2),0)`,
       ''],
    ['Items Sold',
       `=IFERROR(MAX(0,COUNTA('Sold'!A:A)-2),0)`,
       '', '', '', ''],
    // Row 10: spacer
    ['', '', '', '', '', ''],
    // Row 11: footer
    ['Open The Rail Roster app to manage your collection  ·  This sheet is read-only', '', '', '', '', ''],
  ];

  // Session 164: USE_FORMULAS — switch from 'USER_ENTERED' default which
  // would have written formulas as strings. sheetsUpdate already handles
  // this; just verify formulas survive the write.
  await sheetsUpdate(sheetId, 'Dashboard!A1:F11', rows);

  // ── Title (B1): rich text "THE RAIL ROSTER" so "RAIL" is orange, the rest
  // cream — exactly like the app header. Multicolor runs in one cell can only
  // be set via updateCells (textFormatRuns), not the values API.
  try {
    const TITLE = 'THE RAIL ROSTER';
    const railStart = TITLE.indexOf('RAIL');
    const railEnd   = railStart + 'RAIL'.length;
    const dashMeta = await (await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )).json();
    let dId = null;
    (dashMeta.sheets || []).forEach(s => { if (s.properties.title === 'Dashboard') dId = s.properties.sheetId; });
    if (dId != null) {
      const cream  = { red: 0.973, green: 0.910, blue: 0.753 };
      const orange = { red: 0.941, green: 0.314, blue: 0.031 };
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ updateCells: {
          start: { sheetId: dId, rowIndex: 0, columnIndex: 1 },
          fields: 'userEnteredValue,userEnteredFormat(textFormat,verticalAlignment,horizontalAlignment,backgroundColor),textFormatRuns',
          rows: [{ values: [{
            userEnteredValue: { stringValue: TITLE },
            userEnteredFormat: {
              backgroundColor: { red: 0.102, green: 0.114, blue: 0.227 },
              verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT',
              textFormat: { bold: true, fontFamily: 'Oswald', fontSize: 18, foregroundColor: cream }
            },
            textFormatRuns: [
              { startIndex: 0,         format: { foregroundColor: cream } },
              { startIndex: railStart, format: { foregroundColor: orange } },
              { startIndex: railEnd,   format: { foregroundColor: cream } }
            ]
          }] }]
        }}]})
      });
    }
  } catch(e) { console.warn('[Dashboard] rich-text title write failed (non-fatal):', e); }
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
