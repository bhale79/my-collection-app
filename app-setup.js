// The Rail Roster — app-setup.js
// Extracted from app.js in Session 111 (Round 2 Chunk 12).
// Contents: dynamic UI shell builders, onboarding show/hide helpers,
// user profile UI, Google Sheet creation + header/tab initialization,
// and user-defined tab persistence.
//
// Depends on globals defined in app.js: state, driveCache, gapi, tokenClient,
// PERSONAL_HEADERS, SOLD_HEADERS, FOR_SALE_HEADERS, WANT_HEADERS,
// UPGRADE_HEADERS, EPHEMERA_TABS, EPHEMERA_HEADERS, MY_SETS_HEADERS,
// CATALOG_HEADERS, IS_HEADERS, _getPersonalSheetName(), _maybeRenamePersonalSheet(),
// and helpers from sheets.js / drive.js.

// DYNAMIC UI BUILDERS — replaces static HTML in index.html
// ══════════════════════════════════════════════════════════════════

function _buildAuthScreen() {
  var d = document.getElementById('auth-screen');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.innerHTML =
    '<div class="auth-logo" style="line-height:1.1">' +
      '<div style="font-family:var(--font-head);font-size:2.4rem;font-weight:700;color:var(--cream);letter-spacing:0.07em;text-transform:uppercase">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
      '<div style="font-size:0.75rem;letter-spacing:0.22em;color:var(--text-dim);margin-top:7px;text-transform:uppercase;font-family:var(--font-head);font-weight:400">Postwar Collector\'s Inventory</div>' +
    '</div>' +
    '<div class="auth-sub">Postwar Collector\'s Inventory</div>' +
    '<div style="display:flex;flex-direction:column;gap:0.6rem;margin:1.25rem 0;max-width:340px;text-align:left">' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F4CB;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Catalog every item you own</strong><br>Condition, price paid, box, photos \u2014 all in one place.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F4F8;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Store photos to Google Drive</strong><br>Every view, every box \u2014 organized automatically.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F682;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Built for postwar collectors</strong><br>Pre-loaded master catalog of every item 1945\u20131969.</div>' +
      '</div>' +
    '</div>' +
    '<div class="auth-card">' +
      '<h2>Sign in to get started</h2>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem;text-align:left">' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--cream);margin-bottom:0.4rem">Why Google sign-in?</div>' +
        '<p style="font-size:0.8rem;color:var(--text-mid);line-height:1.6;margin:0">This app stores your collection data in <strong style="color:var(--text)">your own Google Sheet</strong> and photos in <strong style="color:var(--text)">your own Google Drive</strong>. Nothing is stored on our servers \u2014 you own all your data and can access it anytime, even outside the app.</p>' +
      '</div>' +
      '<button class="btn-google" onclick="handleSignIn()">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>' +
          '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
          '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
          '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
        '</svg>' +
        'Continue with Google' +
      '</button>' +
      '<p class="auth-note">You\'ll be asked to allow access to Google Sheets and Google Drive. This is how the app reads and saves your collection data. We never see your password.</p>' +
      // Session 112: Gmail help — large plain-language button that opens a
      // chooser modal (gmail-help.js). Copy lives in onboarding-config.js.
      '<button onclick="if(typeof gmailShowHelp===\'function\')gmailShowHelp();" style="' +
        'display:block;width:100%;margin-top:1rem;padding:0.9rem 1rem;' +
        'background:var(--surface2);border:1px solid var(--border);border-radius:10px;' +
        'color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;' +
        'cursor:pointer;text-align:left;min-height:52px;line-height:1.4">' +
        '\uD83D\uDCAC  Need help with Gmail?' +
        '<div style="font-size:0.78rem;color:var(--text-mid);font-weight:400;margin-top:0.25rem">' +
          'Step-by-step help for signing in, password reset, or creating an account.' +
        '</div>' +
      '</button>' +
    '</div>';
}

function _buildSetupScreen() {
  var d = document.getElementById('setup-screen');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.innerHTML =
    '<div class="setup-card">' +
      '<h2>Welcome!</h2>' +
      '<p>One-time setup \u2014 just two steps to connect your inventory.</p>' +
      '<div class="setup-step"><div class="setup-num">1</div>' +
        '<p>Enter the Master Inventory Sheet ID (get this from whoever shared the app with you).</p>' +
      '</div>' +
      '<div class="setup-step"><div class="setup-num">2</div>' +
        '<p>Create a blank Google Sheet for your personal collection, then paste its ID below. Go to <a href="https://sheets.google.com" target="_blank" style="color:var(--accent2)">sheets.google.com</a>, create a blank sheet, name it "The Rail Roster", and copy the ID from the URL.</p>' +
      '</div>' +
      '<div class="input-group"><label>Master Sheet ID</label>' +
        '<input id="master-sheet-input" type="text" placeholder="1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0">' +
      '</div>' +
      '<div class="input-group" style="margin-top:0.75rem"><label>Your Personal Collection Sheet ID</label>' +
        '<input id="personal-sheet-input" type="text" placeholder="Paste your blank sheet ID here">' +
      '</div>' +
      '<div style="margin-top:1.25rem">' +
        '<button class="btn btn-primary" style="width:100%" onclick="completeSetup()">Set Up My Collection</button>' +
      '</div>' +
    '</div>';
}

function _buildAppShell() {
  var app = document.getElementById('app');
  if (!app || document.querySelector('.header')) return;
  // Build header
  var header = document.createElement('header');
  header.className = 'header';
  header.innerHTML =
    '<div class="header-logo" style="display:flex;align-items:flex-end;gap:0.6rem;align-self:stretch;height:100%">' +
      '<img src="img/conductor-header.png?v=201" alt="" aria-hidden="true" style="height:48px;width:auto;flex-shrink:0;display:block">' +
      '<div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--cream);letter-spacing:0.06em;text-transform:uppercase;line-height:1;padding-bottom:6px">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
    '</div>' +
    '<div class="header-right" style="position:relative">' +
      '<div class="user-chip" id="user-chip" onclick="toggleAccountMenu()" role="button" aria-haspopup="true">' +
        '<div class="user-avatar" id="user-avatar">?</div>' +
        '<span id="user-name">Loading\u2026</span>' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:2px;opacity:0.6"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="account-menu" id="account-menu" style="display:none">' +
        '<div class="account-menu-header">' +
          '<div class="account-menu-avatar" id="account-menu-avatar"></div>' +
          '<div>' +
            '<div class="account-menu-name" id="account-menu-name"></div>' +
            '<div class="account-menu-email" id="account-menu-email"></div>' +
          '</div>' +
        '</div>' +
        '<div class="account-menu-divider"></div>' +
        '<button class="account-menu-item" onclick="toggleAccountMenu(); showPage(\'prefs\', null); buildPrefsPage()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
          'Preferences' +
        '</button>' +
        '<button class="account-menu-item account-menu-signout" onclick="handleSignOut()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
          'Sign Out' +
        '</button>' +
      '</div>' +
    '</div>';
  app.insertBefore(header, app.firstChild);
  // Build app-body wrapper with sidebar + main placeholder
  var appBody = document.createElement('div');
  appBody.className = 'app-body';
  var nav = document.createElement('nav');
  nav.className = 'sidebar';
  nav.innerHTML =
    '<div class="nav-section">' +
      '<button class="nav-item active" onclick="showPage(\'dashboard\', this)" data-ctip="This will take you to the main page so you can navigate to where you want to go!">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
        'Dashboard' +
      '</button>' +
    '</div>' +
    '<div class="nav-section">' +
      '<button class="nav-item" onclick="showPage(\'browse\', this); resetFilters(); renderBrowse();" data-ctip="Opens the cataloged item master list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
        'Cataloged Item Master List' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'browse\', this); filterOwned()" data-ctip="This is your inventory list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
        'My Collection List<span class="nav-badge" id="nav-owned" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'want\', this); buildWantPage();" data-ctip="Your want list \u2014 great to take to a train show.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        'Want List<span class="nav-badge" id="nav-wanted2" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'upgrade\', this); buildUpgradePage();" data-ctip="Track items you own but want to upgrade.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>' +
        'Upgrade List<span class="nav-badge" id="nav-upgrade-count" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'forsale\', this); buildForSalePage();" data-ctip="Items you have listed for sale.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' +
        'For Sale List<span class="nav-badge" id="nav-forsale" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'sold\', this)" data-ctip="Items you have sold.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
        'Sold Items<span class="nav-badge" id="nav-sold" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" id="nav-quickentry-btn" onclick="showPage(\'quickentry\', this); buildQuickEntryList();" data-ctip="Items quickly uploaded to fill in details later.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        'Quick Entry List<span class="nav-badge" id="nav-qe-count" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
    '</div>' +
    '<div class="nav-section">' +
      '<button class="nav-item" onclick="showPage(\'vault\', this); vaultRenderPage()" data-page="vault" data-ctip="Community market values, buy/sale trends, and rarity scores.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>' +
        'Collector\'s Market' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'tools\', this)" data-ctip="Smart tools to group items and build sets from your collection.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
        'Collection Tools' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'reports\', this)" data-ctip="Generate reports for insurance, want lists, and more.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        'Reports' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'prefs\', this); buildPrefsPage()" data-ctip="Customize the app to your liking.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        'Preferences' +
      '</button>' +
    '</div>' +
    '<div class="nav-section" style="padding-top:0.75rem;border-top:1px solid var(--border)">' +
      '<button id="refresh-btn" onclick="forceRefreshData()" data-ctip="Reload your data straight from your sheet."' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body)"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'var(--text)\'"' +
        ' onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-dim)\'">' +
        '<svg id="refresh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        'Sync from Sheet' +
      '</button>' +
      '<button onclick="showContactModal()"' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body)"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'var(--text)\'"' +
        ' onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-dim)\'">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
        'Contact' +
      '</button>' +
    '</div>';
  // Move existing main content into app-body
  var existingMain = app.querySelector('main, .main, #main-content');
  appBody.appendChild(nav);
  if (existingMain) {
    app.removeChild(existingMain);
    appBody.appendChild(existingMain);
  }
  app.appendChild(appBody);
}

// ── OAuth + sign-in helpers moved to app-auth.js (Session 110, Round 2 Chunk 11) ──
// ══════════════════════════════════════════════════════════════
// Welcome card (Option C) + contextual hints (Option D)
// Built 2026-04-14. Replaces the auto-launching tutorial tour.
//
// showWelcomeCard(force) — single-page intro modal. Auto-shows once for
//   brand-new users, replayable from Preferences → Help & Tips → Show.
//
// maybeShowContextualHint(spotId, message, anchorEl) — shows a small
//   dismissable hint banner once per spotId. Persists dismissal in
//   localStorage. Used by empty-state list pages.
//
// resetContextualHints() — un-dismisses all hints (Preferences action).
// ══════════════════════════════════════════════════════════════
// ── Misc helpers state moved to app-misc.js (Session 110, Round 2 Chunk 10) ──

// ── Token receipt / lifecycle / sign-out / account menu moved to app-auth.js (Session 110, Round 2 Chunk 11) ──

// Session 112: community opt-in is now Screen 3 of the onboarding flow
// (see onboarding.js). closeOnboarding only handles the legacy fallback
// overlay; the surprise-popup behavior is gone — no more auto-fired modal.
function closeOnboarding() { var o = document.getElementById("onboarding-overlay"); if (o) o.remove(); }

function showOnboarding() {
  if (localStorage.getItem('lv_onboarded')) return;
  // Session 112: new feature-map onboarding (onboarding.js) replaces the
  // old 3-bullet welcome modal. lv_onboarded is now set by onboardFinish /
  // onboardSkipTour so we don't persist until the user actually completes
  // or skips the tour — gives them a second chance if they close the tab.
  if (typeof showFeatureMap === 'function') {
    showFeatureMap();
    return;
  }
  // Fallback (onboarding.js not loaded for any reason): minimal safe welcome.
  localStorage.setItem('lv_onboarded', '1');
  var ov = document.createElement('div');
  ov.id = 'onboarding-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:18px;max-width:380px;width:100%;padding:2rem;text-align:center">' +
    '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:700;margin-bottom:0.75rem">Welcome to The Rail Roster</div>' +
    '<button onclick="closeOnboarding()" style="width:100%;padding:0.9rem;border-radius:12px;border:none;background:var(--accent);color:white;font-size:1rem;font-weight:700;cursor:pointer">Get Started</button>' +
    '</div>';
  document.body.appendChild(ov);
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('setup-screen').classList.remove('active');
  const _appEl = document.getElementById('app');
  _appEl.style.opacity = '0';
  _appEl.classList.add('active');
  requestAnimationFrame(() => { _appEl.style.transition = 'opacity 0.3s ease'; _appEl.style.opacity = '1'; });
  updateUserUI();
  // Bugfix 2026-04-14: dismiss the sign-in loading overlay once the app
  // is rendered so the user doesn't see the auth screen flash back.
  if (typeof _hideSignInOverlayWhenAppReady === 'function') _hideSignInOverlayWhenAppReady();
  if (typeof tutShowHelpBtn === 'function') tutShowHelpBtn();
  const hr = new Date().getHours();
  const _greet = hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  const _name = (state.user?.name || '').split(' ')[0] || 'Collector';
  document.getElementById('dash-greeting').innerHTML = _greet + ', <span style="color:var(--accent)">' + _name + '</span>';
}

function showSetup() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('active');
  document.getElementById('setup-screen').classList.add('active');
}

function updateUserUI() {
  if (!state.user) return;
  var nameEl = document.getElementById('user-name');
  var avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = state.user.name;
  if (avatarEl) {
    if (state.user.picture) {
      avatarEl.innerHTML = '<img src="' + state.user.picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">';
    } else {
      avatarEl.textContent = state.user.name[0].toUpperCase();
    }
  }
}

async function completeSetup() {
  let rawMaster = document.getElementById('master-sheet-input').value.trim();
  let rawPersonal = document.getElementById('personal-sheet-input').value.trim();
  if (!rawMaster) { showToast('Please enter the Master Sheet ID.', 3000, true); return; }
  if (!rawPersonal) { showToast('Please enter your Personal Collection Sheet ID.', 3000, true); return; }

  // Extract IDs if full URLs were pasted
  const masterMatch = rawMaster.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const personalMatch = rawPersonal.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const masterId = masterMatch ? masterMatch[1] : rawMaster;
  const personalId = personalMatch ? personalMatch[1] : rawPersonal;

  state.masterSheetId = masterId;
  state.personalSheetId = personalId;
  localStorage.setItem('lv_master_id', masterId);
  localStorage.setItem('lv_personal_id', personalId);

  // Initialize personal sheet headers
  try {
    await initPersonalSheet(personalId);
    applySheetFormatting(personalId).catch(() => {});
    showApp();
    loadAllData();
  } catch(e) {
    console.error('Setup error:', e);
    showToast('Could not connect to sheet. Make sure you\'re signed in and the sheet exists.', 4000, true);
  }
}

async function initPersonalSheet(sheetId) {
  // Write My Collection title + headers if empty
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/My%20Collection!A1:M2`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
    // Brand new sheet — write title row 1 and headers row 2
    await sheetsUpdate(sheetId, 'My Collection!A1:A1', [['My Collection']]);
    await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  } else if (rows.length === 1 || !rows[1] || rows[1].length < 13) {
    // Has title but missing/old headers — rewrite row 2
    await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  }
  // Get existing sheet tab names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const existingTabs = (meta.sheets || []).map(s => s.properties.title);

  // Build list of tabs to create
  const toCreate = [];
  if (!existingTabs.includes('Sold'))      toCreate.push({ addSheet: { properties: { title: 'Sold' } } });
  if (!existingTabs.includes('For Sale'))  toCreate.push({ addSheet: { properties: { title: 'For Sale' } } });
  if (!existingTabs.includes('Want List'))    toCreate.push({ addSheet: { properties: { title: 'Want List' } } });
  if (!existingTabs.includes('Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Upgrade List' } } });

  if (toCreate.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate }),
    });
  }

  // Write headers to all tabs
  await sheetsUpdate(sheetId, 'Sold!A1:A1',      [['Sold']]);
  await sheetsUpdate(sheetId, 'Sold!A2:J2',      [SOLD_HEADERS]);
  await sheetsUpdate(sheetId, 'For Sale!A1:A1',   [['For Sale']]);
  await sheetsUpdate(sheetId, 'For Sale!A2:J2',   [FOR_SALE_HEADERS]);
  await sheetsUpdate(sheetId, 'Want List!A1:A1',    [['Want List']]);
  await sheetsUpdate(sheetId, 'Want List!A2:F2',    [WANT_HEADERS]);
  await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
  await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);

  // Ephemera tabs
  await ensureEphemeraSheets(sheetId);
}

let _ensureEphemDone = false;
async function ensurePersonalHeaders(sheetId) {
  if (!sheetId) return;
  try {
    // Ensure all tabs exist (For Sale, Sold, Want List may not exist for older sheets)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const existingTabs = (meta.sheets || []).map(s => s.properties.title);
    const toCreate = [];
    if (!existingTabs.includes('Sold'))      toCreate.push({ addSheet: { properties: { title: 'Sold' } } });
    if (!existingTabs.includes('For Sale'))  toCreate.push({ addSheet: { properties: { title: 'For Sale' } } });
    if (!existingTabs.includes('Want List'))    toCreate.push({ addSheet: { properties: { title: 'Want List' } } });
    if (!existingTabs.includes('Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Upgrade List' } } });
    if (toCreate.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: toCreate }),
      });
      // Write headers for newly created tabs
      if (!existingTabs.includes('Sold')) {
        await sheetsUpdate(sheetId, 'Sold!A1:A1', [['Sold']]);
        await sheetsUpdate(sheetId, 'Sold!A2:J2', [SOLD_HEADERS]);
      }
      if (!existingTabs.includes('For Sale')) {
        await sheetsUpdate(sheetId, 'For Sale!A1:A1', [['For Sale']]);
        await sheetsUpdate(sheetId, 'For Sale!A2:J2', [FOR_SALE_HEADERS]);
      }
      if (!existingTabs.includes('Want List')) {
        await sheetsUpdate(sheetId, 'Want List!A1:A1', [['Want List']]);
        await sheetsUpdate(sheetId, 'Want List!A2:F2', [WANT_HEADERS]);
      }
      if (!existingTabs.includes('Upgrade List')) {
        await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
        await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);
      }
      console.log('[Setup] Created missing tabs:', toCreate.map(t => t.addSheet.properties.title).join(', '));
    }

    // Fetch current row 2 headers (A2:Y2 — 25 cols)
    const res = await sheetsGet(sheetId, 'My Collection!A2:Y2');
    const current = (res.values && res.values[0]) || [];

    // Check each expected header — write the full row if anything is missing or wrong
    const needsUpdate = PERSONAL_HEADERS.some((h, i) => current[i] !== h);
    if (needsUpdate) {
      await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
      console.log('[Headers] My Collection headers repaired');
    }

    // Also ensure row 1 title
    const titleRes = await sheetsGet(sheetId, 'My Collection!A1');
    const title = (titleRes.values && titleRes.values[0] && titleRes.values[0][0]) || '';
    if (title !== 'My Collection') {
      await sheetsUpdate(sheetId, 'My Collection!A1', [['My Collection']]);
    }

    // Repair Upgrade List headers if missing or wrong
    try {
      const upgRes = await sheetsGet(sheetId, 'Upgrade List!A2:H2');
      const upgCurrent = (upgRes.values && upgRes.values[0]) || [];
      const upgNeedsUpdate = UPGRADE_HEADERS.some((h, i) => upgCurrent[i] !== h);
      if (upgNeedsUpdate) {
        await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
        await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);
        console.log('[Headers] Upgrade List headers repaired');
      }
    } catch(e) {
      console.warn('[Headers] Upgrade List header check failed:', e.message);
    }

    // Repair Sold / For Sale / Want List headers (Manufacturer column added — new users ok,
    // older users need this to pick up the schema change without data loss).
    var _tabsToCheck = [
      { name: 'Sold',      range: 'Sold!A2:J2',      headers: SOLD_HEADERS     },
      { name: 'For Sale',  range: 'For Sale!A2:J2',  headers: FOR_SALE_HEADERS },
      { name: 'Want List', range: 'Want List!A2:F2', headers: WANT_HEADERS     },
    ];
    for (var _i = 0; _i < _tabsToCheck.length; _i++) {
      var _t = _tabsToCheck[_i];
      try {
        var _hr = await sheetsGet(sheetId, _t.range);
        var _cur = (_hr.values && _hr.values[0]) || [];
        var _need = _t.headers.some(function(h, i) { return _cur[i] !== h; });
        if (_need) {
          await sheetsUpdate(sheetId, _t.range, [_t.headers]);
          console.log('[Headers] ' + _t.name + ' headers repaired');
        }
      } catch(e) {
        console.warn('[Headers] ' + _t.name + ' header check failed:', e.message);
      }
    }
  } catch(e) {
    console.warn('[Headers] ensurePersonalHeaders failed:', e.message);
  }
}

async function ensureEphemeraSheets(sheetId) {
  if (_ensureEphemDone) return;  // Only run once per session — tabs and headers don't change
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const existingTabs = (meta.sheets || []).map(s => s.properties.title);
  const tabNames = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
  const toCreate = [];
  Object.values(tabNames).forEach(t => {
    if (!existingTabs.includes(t)) toCreate.push({ addSheet: { properties: { title: t } } });
  });
  if (toCreate.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate }),
    });
  }
  // Write headers — clear extra columns first to fix any stale headers
  // Clear row 1 and row 2 across all ephemera tabs (A1:Q covers any previous wide headers)
  const _clearReqs = ['Catalogs','Paper Items','Mock-Ups','Other Lionel'].map(t => ({
    updateCells: {
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 17 },
      fields: 'userEnteredValue',
    }
  }));
  // Use values API to clear then rewrite cleanly
  await sheetsUpdate(sheetId, 'Catalogs!A1:Q1',    [['Catalogs','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Catalogs!A2:J2',    [CATALOG_HEADERS]);
  await sheetsUpdate(sheetId, 'Paper Items!A1:Q1', [['Paper Items','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Paper Items!A2:N2', [EPHEMERA_HEADERS]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A1:Q1',    [['Mock-Ups','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A2:Q2',    [MOCKUP_HEADERS]);
  await sheetsUpdate(sheetId, 'Other Lionel!A1:Q1',[['Other Lionel','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Other Lionel!A2:N2',[EPHEMERA_HEADERS]);
  _ensureEphemDone = true;  // Don't run again this session
  // Instruction Sheets tab
  if (!existingTabs.includes('Instruction Sheets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Instruction Sheets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Instruction Sheets!A1:A1', [['Instruction Sheets']]);
  await sheetsUpdate(sheetId, 'Instruction Sheets!A2:K2', [IS_HEADERS]);
  // Science Sets tab
  if (!existingTabs.includes('Science Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Science Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Science Sets!A1:A1', [['Science Sets']]);
  await sheetsUpdate(sheetId, 'Science Sets!A2:O2', [SCIENCE_HEADERS]);
  // Construction Sets tab
  if (!existingTabs.includes('Construction Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Construction Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Construction Sets!A1:A1', [['Construction Sets']]);
  await sheetsUpdate(sheetId, 'Construction Sets!A2:O2', [CONSTRUCTION_HEADERS]);
  // My Sets tab
  if (!existingTabs.includes('My Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'My Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'My Sets!A1:A1', [['My Sets']]);
  await sheetsUpdate(sheetId, 'My Sets!A2:N2', [MY_SETS_HEADERS]);
}


// ── Drive helpers — moved to drive.js (Session 63) ──────────

// ── SHEETS API — moved to sheets.js (Session 63) ───────────────

async function createPersonalSheet() {
  // 0. Wait for user info if not yet loaded (async race on first sign-in)
  if (!state.user || !state.user.name) {
    try {
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken }
      }).then(r => r.json());
      state.user = { name: info.given_name || info.name || 'My', email: info.email, picture: info.picture };
      localStorage.setItem('lv_user', JSON.stringify(state.user));
      updateUserUI();
    } catch(e) { console.warn('[Setup] Could not fetch user info:', e); }
  }

  // 1. Set up Drive vault folders first
  await driveSetupVault();

  // 2. Create new spreadsheet
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: _getPersonalSheetName() },
      sheets: [{ properties: { title: 'My Collection' } }]
    })
  });
  const data = await res.json();
  state.personalSheetId = data.spreadsheetId;
  localStorage.setItem('lv_personal_id', state.personalSheetId);

  // 3. Write headers and create all tabs
  await sheetsUpdate(state.personalSheetId, 'My Collection!A1:A1', [['My Collection']]);
  await sheetsUpdate(state.personalSheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  await initPersonalSheet(state.personalSheetId);

  // 4. Move the sheet file into the vault folder
  try { await driveMoveSheetToVault(state.personalSheetId); } catch(e) { console.warn('Could not move sheet to vault:', e); }

  // 5. Write config to Drive so other devices can find this sheet
  await driveWriteConfig({
    personalSheetId: state.personalSheetId,
    vaultId: driveCache.vaultId,
    photosId: driveCache.photosId,
    soldPhotosId: driveCache.soldPhotosId,
  });

  return state.personalSheetId;
}

// ── LOAD DATA ───────────────────────────────────────────────────
// Load/save user-defined tab names
function loadUserDefinedTabs() {
  try {
    state.userDefinedTabs = JSON.parse(localStorage.getItem('lv_user_tabs') || '[]');
  } catch(e) { state.userDefinedTabs = []; }
}
function saveUserDefinedTabs() {
  localStorage.setItem('lv_user_tabs', JSON.stringify(state.userDefinedTabs));
}
