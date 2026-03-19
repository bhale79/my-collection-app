// ══════════════════════════════════════════════════════════════════
// sheet-builder.js — Sheet formatting, Dashboard tab, Lock/Unlock
// Depends on: accessToken, state, sheetsUpdate(), normalizeItemNum()
// All functions are non-destructive — never touch data rows (row 3+)
// ══════════════════════════════════════════════════════════════════

// Bump this number to push a visual refresh to all users on next sync
const SHEET_FORMAT_VER = 2;

// ── Color palette ──────────────────────────────────────────────────
const SB = {
  navy:     { red: 0.063, green: 0.098, blue: 0.169 },   // #10182B banner
  navyMid:  { red: 0.118, green: 0.227, blue: 0.373 },   // #1e3a5f section headers
  gold:     { red: 1.000, green: 0.878, blue: 0.376 },   // #FFDF60 accent gold
  goldBg:   { red: 0.996, green: 0.953, blue: 0.808 },   // #FEF3CE stat value bg
  white:    { red: 1, green: 1, blue: 1 },
  dimText:  { red: 0.4, green: 0.4, blue: 0.4 },
  divider:  { red: 0.118, green: 0.227, blue: 0.373 },   // col C divider
  labelBg:  { red: 0.133, green: 0.196, blue: 0.31  },   // #223250 label rows
};

const CONDUCTOR_URL = 'https://raw.githubusercontent.com/bhale79/my-collection-app/main/conductor-list.png';

async function applySheetFormatting(sheetId) {
  if (!sheetId || !accessToken) return;
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
      if (storedVer >= SHEET_FORMAT_VER) {
        // Just refresh stats content, skip full format
        await _writeDashboardContent(sheetId);
        return;
      }
    }

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
      'Want List':     { red: 0.161, green: 0.502, blue: 0.725 },
      'Upgrade List':  { red: 0.545, green: 0.361, blue: 0.965 },
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
    const DATA_TABS = ['My Collection','Sold','For Sale','Want List','Upgrade List'];
    const dataReqs = DATA_TABS.filter(t => tabMap.hasOwnProperty(t)).flatMap(tab => {
      const sid = tabMap[tab];
      return [
        { repeatCell: {
          range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2 },
          cell: { userEnteredFormat: {
            backgroundColor: SB.navyMid,
            textFormat: { bold: true, foregroundColor: SB.white, fontSize: 9 },
            verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
          }},
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
        }},
        { updateSheetProperties: {
          properties: { sheetId: sid, gridProperties: { frozenRowCount: 2 } },
          fields: 'gridProperties.frozenRowCount'
        }},
        { addBanding: { bandedRange: {
          range: { sheetId: sid, startRowIndex: 2, endRowIndex: 1000 },
          rowProperties: {
            headerColor:     SB.navyMid,
            firstBandColor:  { red: 0.957, green: 0.961, blue: 0.976 },
            secondBandColor: SB.white,
          }
        }}}
      ];
    });

    // ── 6. Dashboard formatting requests ──────────────────────────
    const dashReqs = [
      // Freeze row 3 (banner = rows 1-3)
      { updateSheetProperties: {
        properties: { sheetId: dashId, gridProperties: { frozenRowCount: 3 } },
        fields: 'gridProperties.frozenRowCount'
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
      // Banner rows 1-3 full width (A:H) — dark navy bg
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.navy } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 1: app title — gold bold large
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { bold: true, foregroundColor: SB.gold, fontSize: 16, fontFamily: 'Arial' },
          verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(textFormat,verticalAlignment)'
      }},
      // Row 2: user name — white medium
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { bold: false, foregroundColor: SB.white, fontSize: 11 },
          verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(textFormat,verticalAlignment)'
      }},
      // Row 3: last synced — dim gold small
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { bold: false, foregroundColor: { red: 0.85, green: 0.78, blue: 0.55 }, fontSize: 9 },
          verticalAlignment: 'MIDDLE'
        }},
        fields: 'userEnteredFormat(textFormat,verticalAlignment)'
      }},
      // Merge F1:H3 for mascot
      { mergeCells: { range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 5, endColumnIndex: 8 }, mergeType: 'MERGE_ALL' }},
      // Mascot cell format — center/middle
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 5, endColumnIndex: 8 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)'
      }},
      // Row 4: spacer — navy
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.navy } },
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
      // Cols F-H rows 5-9 — navy bg
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 4, endRowIndex: 10, startColumnIndex: 5, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.navy } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 10: spacer — navy
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { backgroundColor: SB.navy } },
        fields: 'userEnteredFormat.backgroundColor'
      }},
      // Row 11: footer — dim italic small
      { repeatCell: {
        range: { sheetId: dashId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: {
          backgroundColor: SB.navy,
          textFormat: { italic: true, foregroundColor: { red: 0.55, green: 0.6, blue: 0.65 }, fontSize: 8 },
          verticalAlignment: 'MIDDLE', horizontalAlignment: 'CENTER'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)'
      }},
    ];

    // ── 7. Send all format requests ────────────────────────────────
    const allReqs = [...tabColorReqs, ...dataReqs, ...dashReqs];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: allReqs })
    });

    // ── 8. Write dashboard content ─────────────────────────────────
    await _writeDashboardContent(sheetId);

    // ── 9. Version stamp ───────────────────────────────────────────
    await sheetsUpdate(sheetId, 'Dashboard!A50', [[SHEET_FORMAT_VER]]);
    console.log('[SheetFormat] Applied v' + SHEET_FORMAT_VER);

  } catch(e) {
    console.warn('[SheetFormat] Non-fatal:', e.message);
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

  const valueStr = totalValue > 0 ? '$' + Math.round(totalValue).toLocaleString() : '—';

  const rows = [
    // Row 1: App title (A1), mascot formula (F1)
    ['THE RAIL ROSTER', '', '', '', '', `=IMAGE("${CONDUCTOR_URL}",1)`],
    // Row 2: User name
    [`${firstName}'s Collection`, '', '', '', '', ''],
    // Row 3: Last synced
    [`Last synced: ${now}`, '', '', '', '', ''],
    // Row 4: spacer
    ['', '', '', '', '', ''],
    // Row 5: Section headers
    ['MY COLLECTION', '', '', 'ACTIVITY', '', ''],
    // Rows 6-9: Stats  [label, value, divider, label, value]
    ['Items in Collection', totalItems.toLocaleString(), '', 'Locomotives',    engines.toLocaleString(), ''],
    ['Collection Value',    valueStr,                    '', 'Avg Condition',  avgCond + ' / 10',        ''],
    ['Want List',           wantCount.toLocaleString(),  '', 'For Sale',       forSaleCount.toLocaleString(), ''],
    ['Upgrade List',        upgradeCount.toLocaleString(),'','Items Sold',     soldCount.toLocaleString(), ''],
    // Row 10: spacer
    ['', '', '', '', '', ''],
    // Row 11: footer
    ['Open The Rail Roster app to manage your collection  ·  This sheet is read-only', '', '', '', '', ''],
  ];

  await sheetsUpdate(sheetId, 'Dashboard!A1:F11', rows);
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
        if (p.description === 'boxcar-data-lock') ids.push(p.protectedRangeId);
      });
    });
    return { locked: ids.length > 0, protectionIds: ids };
  } catch(e) {
    return { locked: false, protectionIds: [] };
  }
}

async function lockSheetTabs(sheetId) {
  if (!sheetId || !accessToken) return;
  try {
    // Get sheet IDs for all data tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const DATA_TABS = ['My Collection','Sold','For Sale','Want List','Upgrade List','Catalogs','Paper Items','Mock-Ups','Other Lionel','Instruction Sheets'];
    const tabMap = {};
    (meta.sheets || []).forEach(s => { tabMap[s.properties.title] = s.properties.sheetId; });

    const requests = DATA_TABS.filter(t => tabMap.hasOwnProperty(t)).map(t => ({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId: tabMap[t] },
          description: 'boxcar-data-lock',
          warningOnly: false,
          editors: { users: [state.user?.email || ''] }
        }
      }
    }));

    if (!requests.length) return;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    console.log('[SheetLock] Tabs locked');
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
