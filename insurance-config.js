// ═══════════════════════════════════════════════════════════════
// insurance-config.js — SINGLE SOURCE OF TRUTH for the insurance report.
//
// All user-visible copy (title, subtitle, footer, labels) and column
// layout live here. reports.js reads from this file. Never hardcode
// any of these strings or column names elsewhere.
// ═══════════════════════════════════════════════════════════════

const INSURANCE_REPORT = {
  // ──────────────────────────────────────────────────────────────
  // Title + subtitle.
  // Generic — not Lionel-specific, since the app now supports Atlas,
  // MPC/Modern, etc. `{year}` placeholder is replaced at render time.
  // ──────────────────────────────────────────────────────────────
  title:    'Model Train Collection — Insurance Documentation',
  subtitle: 'Prepared for scheduled-coverage submission',

  // Meta lines shown under the title. Keys reference fields computed
  // at render time: ownerName, dateStr, itemCount, totalWorth.
  metaTemplate: [
    'Owner: {ownerName}',
    'Generated: {dateStr}',
    'Items: {itemCount}',
    'Total Estimated Worth: ${totalWorth}',
  ],

  // Footnote shown beside the totals.
  totalsNote: 'Est. Worth = user-entered value for insurance purposes. ' +
              'Not a market appraisal.',

  // ──────────────────────────────────────────────────────────────
  // Columns in the visible report (in order).
  // To add/remove/reorder columns, edit this array. Supported types:
  //   photo  — 48px thumbnail from first Drive photo
  //   itemnum — formatted item number
  //   text   — plain text (optional align: 'center'|'left'|'right')
  //   dim    — smaller/muted text
  //   money  — $-prefixed number
  //
  // Each column has a `source` function that pulls the value from
  // { pd, master }. Centralizing here keeps the renderer dumb.
  // ──────────────────────────────────────────────────────────────
  columns: [
    { key: 'photo',       label: 'Photo',       type: 'photo' },
    { key: 'itemNum',     label: 'Item #',      type: 'itemnum' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'year',        label: 'Year',        type: 'text',  align: 'center' },
    { key: 'variation',   label: 'Variation',   type: 'dim' },
    { key: 'condition',   label: 'Cond.',       type: 'text',  align: 'center' },
    { key: 'allOriginal', label: 'All Orig.',   type: 'text',  align: 'center' },
    { key: 'hasBox',      label: 'Box',         type: 'text',  align: 'center' },
    { key: 'boxCond',     label: 'Box Cond.',   type: 'text',  align: 'center' },
    { key: 'pricePaid',   label: 'Paid',        type: 'money', align: 'right' },
    { key: 'estWorth',    label: 'Est. Worth',  type: 'money', align: 'right' },
    { key: 'notes',       label: 'Notes',       type: 'dim' },
  ],

  // ──────────────────────────────────────────────────────────────
  // Footer / signature block — required on most insurance documents.
  // ──────────────────────────────────────────────────────────────
  footerCertification: 'I certify that the items listed above represent my ' +
                       'personal model train collection as of the date shown. ' +
                       'Values are estimated for insurance purposes only and ' +
                       'do not constitute a professional appraisal.',
  signatureLabel: 'Owner signature',
  dateLabel:      'Date',

  // Button labels
  printButtonLabel: '\uD83D\uDDA8  Print / Save PDF',
};

window.INSURANCE_REPORT = INSURANCE_REPORT;
