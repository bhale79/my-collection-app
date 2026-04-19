// ═══════════════════════════════════════════════════════════════
// migration-config.js — Item-migration scaffold.
//
// This is architectural plumbing for moving catalog items between
// master sheet tabs (e.g. MPC → Atlas, MPC → MTH, Modern → Menards).
//
// The UI layer (Preferences → Admin Tools → "Move item between tabs")
// is intentionally NOT built yet — it needs more of Brad's real-world
// migration patterns. This file provides:
//   - A list of allowed migration routes (config)
//   - A stub function migrateItemBetweenTabs() that performs the
//     actual sheet move when wired up
//   - A no-op console implementation so nothing breaks until enabled
//
// Once Brad says "build the migration UI," the plumbing is here and
// the UI work can focus on the form, not the data plumbing.
// ═══════════════════════════════════════════════════════════════

const MIGRATION = {
  // Admin-only feature — check via _isAdmin() before exposing the UI.
  // Keep this false until the UI is ready.
  enabled: false,

  // Allowed migration routes. source → allowed destinations.
  // Edit this list when new manufacturer tabs are added.
  routes: {
    'MPC-Modern': ['Atlas O', 'MTH', 'Menards', 'Williams'],
    'Atlas O':   ['MPC-Modern'],
    'Lionel PW - Items': [],        // PW items should never be migrated
  },

  // Confirmation copy shown in the (future) confirmation modal.
  confirmTitle:    'Move item to another tab?',
  confirmTemplate: 'Move item {itemNum} from "{sourceTab}" to "{destTab}"? This updates the master sheet.',
  successMessage:  'Item moved successfully.',
  errorTemplate:   'Could not move item: {error}',
};

window.MIGRATION = MIGRATION;

// ──────────────────────────────────────────────────────────────
// migrateItemBetweenTabs(itemNum, sourceTab, destTab)
//
// Scaffold only — does NOT write to sheets today. Returns a promise
// that resolves with { moved: false, reason: 'scaffold' } so callers
// can wire up UI without risking data.
//
// When ready to implement:
//   1. Validate route exists in MIGRATION.routes[sourceTab]
//   2. sheetsGet source row, sheetsAppend to dest, sheetsClear source row
//   3. Call _rebuildMasterIndex() + renderBrowse() to refresh UI
//   4. Update localStorage cache (lv_master_cache) with the moved item
// ──────────────────────────────────────────────────────────────
window.migrateItemBetweenTabs = async function(itemNum, sourceTab, destTab) {
  var cfg = window.MIGRATION || {};
  if (!cfg.enabled) {
    console.info('[migration] scaffold call — feature not enabled yet.', { itemNum: itemNum, sourceTab: sourceTab, destTab: destTab });
    return { moved: false, reason: 'scaffold: feature disabled' };
  }
  var allowed = (cfg.routes && cfg.routes[sourceTab]) || [];
  if (allowed.indexOf(destTab) < 0) {
    return { moved: false, reason: 'route not allowed: ' + sourceTab + ' → ' + destTab };
  }
  // TODO: implement the real sheet move here when UI is ready.
  throw new Error('migrateItemBetweenTabs: UI enabled but implementation still stubbed. See migration-config.js.');
};
