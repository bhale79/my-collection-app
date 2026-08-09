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
  // v0.9.997 (Brad): two-column on desktop \u2014 brand + feature blurbs on the
  // left, sign-in card on the right \u2014 so "Continue with Google" is above the
  // fold instead of below it. Stacks back to one column on phones (.auth-wrap
  // media query in app.css). The old duplicate tagline line is gone: it was
  // printed once inside the logo block AND again as .auth-sub. Tagline copy
  // now comes from BRAND_TAGLINE in config.js (single source).
  var _tag = (typeof BRAND_TAGLINE === 'string') ? BRAND_TAGLINE : 'Model Train Collection Tracker';
  // v0.9.1327: counted once in config.js — see BRAND_CATALOG_COUNT. This
  // screen and the Master Catalog page used to disagree (130,000+ vs 60,000+).
  var _cat = (typeof BRAND_CATALOG_COUNT === 'string') ? BRAND_CATALOG_COUNT : '130,000+';
  var _mark = (typeof BRAND_WORDMARK_HTML === 'string') ? BRAND_WORDMARK_HTML
            : 'The <span style="color:var(--accent)">Rail</span> Roster';
  d.innerHTML =
    '<div class="auth-wrap">' +
    '<div class="auth-brand">' +
      '<img class="auth-conductor" src="conductor.png" alt="" aria-hidden="true">' +
      '<div class="auth-wordmark">' + _mark + '</div>' +
      '<div class="auth-tagline">' + _tag + '</div>' +
      // v0.9.998 (Brad): blurbs lead with the payoff, not the plumbing.
      '<div class="auth-features">' +
        '<div class="auth-feature">' +
          '<div style="font-size:0.98rem;color:var(--text-mid);line-height:1.55"><strong style="color:#fff">Know exactly what you own</strong><br>Condition, variation, box, price paid \u2014 one record per item.</div>' +
        '</div>' +
        '<div class="auth-feature">' +
          '<div style="font-size:0.98rem;color:var(--text-mid);line-height:1.55"><strong style="color:#fff">Every item, every picture, one list</strong><br>Add photos from your phone or desktop \u2014 they attach to the item automatically.</div>' +
        '</div>' +
        '<div class="auth-feature">' +
          '<div style="font-size:0.98rem;color:var(--text-mid);line-height:1.55"><strong style="color:#fff">' + _cat + ' items already catalogued</strong><br>Lionel, Atlas, MTH, Weaver and more, prewar through modern \u2014 type a number and the details fill in.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // v0.9.999 (Brad): the right column is now TWO cards. The top card has ONE
    // job - sign in - so the amber notice has nothing competing with it. The
    // reassurance ("Why Google sign-in?") and the Gmail help moved into a
    // quieter second card below, where secondary material belongs.
    '<div class="auth-col">' +
    '<div class="auth-card">' +
      '<h2>Sign in to get started</h2>' +
      // Google's granular-permissions screen shows the Drive checkbox
      // UNCHECKED by default and an app cannot pre-check it (v0.9.998).
      // Solid amber with dark text: every other element here is light-on-dark,
      // so this is the one block that cannot be skimmed past. Welded to the
      // top of the button (no gap, shared corners) so they read as one unit.
      '<div class="auth-alert">' +
        '<div class="auth-alert-head">One step people miss</div>' +
        '<div class="auth-alert-body">Google\'s next screen has a <strong>checkbox for Google Drive</strong>. <u>Tick it</u> — that\'s what lets us create your collection sheet. It stays unticked unless you tap it.</div>' +
      '</div>' +
      '<button class="btn-google btn-google-welded" onclick="handleSignIn()">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>' +
          '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
          '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
          '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
        '</svg>' +
        'Continue with Google' +
      '</button>' +
      // v0.9.999: the old 4-line permissions paragraph said the same thing as
      // the amber block three lines above it - two warnings about one
      // permission dilute each other. One line now; the alert carries it.
      '<p class="auth-note">The app can only touch the files it makes for you. We never see your password.</p>' +
      // v0.9.939 (Brad): consent line - agreement belongs at sign-in, BEFORE
      // an account exists. Links also live in Preferences > About.
      '<p style="font-size:0.72rem;color:var(--text-dim);margin-top:0.6rem;line-height:1.5">By continuing, you agree to our ' +
        '<a href="/terms/" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:none">Terms of Service</a> and ' +
        '<a href="/privacy/" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:none">Privacy Policy</a>.</p>' +
    '</div>' +
    // ── Secondary card: reassurance + help, deliberately quieter ──────────
    '<div class="auth-help-card">' +
      '<div class="auth-help-title">Questions before you sign in?</div>' +
      '<div class="auth-help-q">Why Google sign-in?</div>' +
      '<p class="auth-help-a">Your collection lives in <strong style="color:var(--text)">your own Google Sheet</strong> and your photos in <strong style="color:var(--text)">your own Google Drive</strong> — nothing is kept on our servers.</p>' +
      // Session 112: Gmail help - chooser modal (gmail-help.js). Copy lives
      // in onboarding-config.js.
      '<button class="auth-help-btn" onclick="if(typeof gmailShowHelp===\'function\')gmailShowHelp();">' +
        'Need help with Gmail?' +
        '<div style="font-size:0.78rem;color:var(--text-mid);font-weight:400;margin-top:0.25rem">' +
          'Step-by-step help for signing in, password reset, or creating an account.' +
        '</div>' +
      '</button>' +
    '</div>' +
    '</div>';
}

// v0.9.1285: _buildSetupScreen removed — see the note in app-auth.js's
// initGoogle. Its Set Up button was the only path to completeSetup(),
// which was therefore unreachable too (left in place, written up for
// audit round 3 rather than removed the same night it was discovered).
//
// v0.9.1290: completeSetup() removed as well, with Brad's approval. It was not
// merely unreachable, it was SUPERSEDED: it asked a new user to paste a Master
// Sheet ID and a Personal Sheet ID by hand, and the app has not needed either
// for a long time. initGoogle now resolves the master from config and either
// finds the user's collection sheet or calls createPersonalSheet() to make one
// — which runs the same initPersonalSheet() header setup completeSetup() used
// to run, without ever asking. There is no first-run flow to revive here; the
// automatic one IS the first-run flow. See §239, which fails if a manual
// sheet-ID paste ever comes back without a decision to bring it back.

function _buildAppShell() {
  var app = document.getElementById('app');
  if (!app || document.querySelector('.header')) return;
  // Build header
  var header = document.createElement('header');
  header.className = 'header';
  header.innerHTML =
    '<div class="header-logo" style="display:flex;align-items:flex-end;gap:0.6rem;align-self:stretch;height:100%">' +
      /* v0.9.1259 (audit 2026-08-02, finding 5): the "?v=203" that used to be
         here meant this image was never once served from cache. sw.js
         precaches "./img/conductor-header.png" bare, and a cache is keyed by
         the whole URL — so the stamped request and the bare precache entry
         were two different keys and never met. Offline, the mascot at the top
         of every screen was a broken image. The stamp was also about a
         thousand deploys stale, because it lived in a JavaScript string
         rather than in index.html and so was never swept. Bumping CACHE_NAME
         is what busts images; they need no stamp of their own. */
      '<img src="img/conductor-header.png" alt="" aria-hidden="true" style="height:55px;width:auto;flex-shrink:0;display:block;filter:drop-shadow(0 0 5px rgba(190,195,205,0.45)) drop-shadow(0 0 14px rgba(190,195,205,0.25))">' +   /* v0.9.914 (Brad): mascot +15% (48->55px) */
      '<div style="font-family:var(--font-head);font-size:1.8rem;font-weight:700;color:var(--cream);letter-spacing:0.06em;text-transform:uppercase;line-height:1;padding-bottom:6px">The <span style="color:var(--cream)">Rail</span> Roster</div>' +
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
        '<button class="account-menu-item" onclick="toggleAccountMenu(); showPage(\'contacts\', null)">' +   // contacts hook (Brad: above Preferences)
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
          'Contacts' +
        '</button>' +
        '<button class="account-menu-item" id="menu-install-app" style="display:none" onclick="_pwaInstall()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          'Install on this device' +
        '</button>' +
        '<button class="account-menu-item" onclick="toggleAccountMenu(); showPage(\'prefs\', null); buildPrefsPage()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
          'Preferences' +
        '</button>' +
        // v0.9.1414 (Brad): Help had NO route on a phone at all — the "Need
        // Help?" conductor lives in the sidebar, and the sidebar is hidden at
        // phone width. This calls the SAME tutToggleMenu() the conductor does,
        // so there is one help system with two doors, not a second list that
        // can drift out of step with the first.
        '<button class="account-menu-item" id="menu-help-btn" onclick="toggleAccountMenu(); if (typeof tutToggleMenu === \'function\') tutToggleMenu();">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          'Help' +
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
      '<button class="nav-item" onclick="showPage(\'browse\', this); filterOwned()" data-ctip="This is your inventory list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
        'My Collection<span class="nav-badge" id="nav-owned" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'upgrade\', this); buildUpgradePage();" data-ctip="Things you\'re looking for \u2014 want list + upgrade targets, combined.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        'Want / Upgrade<span class="nav-badge" id="nav-wishlist-count" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'forsale\', this); buildForSalePage();" data-ctip="Items you have listed for sale.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' +
        'For Sale<span class="nav-badge" id="nav-forsale" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'parts\', this); buildPartsPage();" data-ctip="Parts you need to track down \u2014 bring this to a show.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
        'Parts Needed<span class="nav-badge" id="nav-parts" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'browse\', this); resetFilters(); renderBrowse();" data-ctip="Opens the cataloged item master list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
        'Master Catalog' +
      '</button>' +
    '</div>' +
    '<div class="nav-section">' +
      (window.MARKET_ENABLED ? '<button class="nav-item" onclick="showPage(\'vault\', this); vaultRenderPage()" data-page="vault" data-ctip="Community market values, buy/sale trends, and rarity scores.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>' +
        'Collector\'s Market' +
      '</button>' : '') +
      '<button class="nav-item" onclick="showPage(\'tools\', this)" data-ctip="Smart tools to group items and build sets from your collection.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
        'Collection Tools' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'reports\', this)" data-ctip="Generate reports for insurance, want lists, and more.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        'Reports' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'sold\', this)" data-ctip="Items you have sold.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
        'Sold Items<span class="nav-badge" id="nav-sold" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'prefs\', this); buildPrefsPage()" data-ctip="Customize the app to your liking.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        'Preferences' +
      '</button>' +
    '</div>' +
    '<div class="nav-section" style="padding-top:0.5rem;border-top:1px solid var(--border)">' +
      '<button id="refresh-btn" onclick="forceRefreshData()" data-ctip="Reload your data straight from your sheet."' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.42rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body);font-weight:700"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'var(--text)\'"' +
        ' onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-dim)\'">' +
        '<svg id="refresh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        'Sync from Sheet' +
      '</button>' +
      '<button onclick="showContactModal()"' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.42rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body);font-weight:700"' +
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
  // v0.9.1209: the collector's own marks. appearance.js runs before the shell
  // exists, so its boot call can only reach the watermark — the header and
  // sidebar marks need a shell to hang on. This is that one call, made at the
  // moment there is something to hang them on.
  if (typeof window.applyBranding === 'function') window.applyBranding();
  // v0.9.1230: once the app is up and usable, ask Drive one small question —
  // has the look changed since this device last saw it? Never before the
  // shell exists, and never on the critical path.
  if (typeof window.rrOutboxStart === 'function') window.rrOutboxStart();
  if (typeof window.rrLookCheckLater === 'function') window.rrLookCheckLater();
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
  document.getElementById('dash-greeting').innerHTML = _greet + ', <span style="color:var(--accent);font-size:138%;font-weight:700">' + _name + '</span>';
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

// v0.9.984: A1 column letter for the Nth column (1→A, 26→Z, 27→AA). Header-write
// ranges are built from PERSONAL_HEADERS.length via this helper so they track the
// schema automatically and never drift from the real column count again — the
// schema grew to 35 cols while the writes stayed hard-coded at A2:AF2 (32), which
// broke new-user setup with a 400 "tried writing to column AG".
function _pdColLetter(n){ var s=''; while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26); } return s; }

async function initPersonalSheet(sheetId) {
  // Write My Collection title + headers if empty
  // Read the full header range (schema-length driven) so we can detect drift.
  const _pdEnd = _pdColLetter(PERSONAL_HEADERS.length);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/My%20Collection!A1:${_pdEnd}2`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
    // Brand new sheet — write title row 1 and headers row 2
    await sheetsUpdate(sheetId, PERSONAL_TAB + '!A1:A1', [['My Collection']]);
    await sheetsUpdate(sheetId, PERSONAL_TAB + '!A2:' + _pdEnd + '2', [PERSONAL_HEADERS]);
  } else if (rows.length === 1 || !rows[1] || rows[1].length < PERSONAL_HEADERS.length) {
    // Has title but missing/old headers — rewrite the full row 2
    await sheetsUpdate(sheetId, PERSONAL_TAB + '!A2:' + _pdEnd + '2', [PERSONAL_HEADERS]);
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
  // Want-Upgrade combined (Session 161+): one tab replaces 'Want List' + 'Upgrade List'.
  if (!existingTabs.includes('Want-Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Want-Upgrade List' } } });

  if (toCreate.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate }),
    });
  }

  // Write headers to all tabs
  await sheetsUpdate(sheetId, 'Sold!A1:A1',      [['Sold']]);
  await sheetsUpdate(sheetId, 'Sold!A2:T2',      [SOLD_HEADERS]);
  await sheetsUpdate(sheetId, 'For Sale!A1:A1',   [['For Sale']]);
  await sheetsUpdate(sheetId, 'For Sale!A2:J2',   [FOR_SALE_HEADERS]);
  // Want-Upgrade combined (Session 161+): 9-col schema with List Type column.
  await sheetsUpdate(sheetId, 'Want-Upgrade List!A1:A1', [['Want-Upgrade List']]);
  await sheetsUpdate(sheetId, 'Want-Upgrade List!A2:I2', [WISHLIST_HEADERS]);

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
    // Want-Upgrade combined: single tab replaces the old pair.
    if (!existingTabs.includes('Want-Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Want-Upgrade List' } } });
    if (toCreate.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: toCreate }),
      });
      // Write headers for newly created tabs
      if (!existingTabs.includes('Sold')) {
        await sheetsUpdate(sheetId, 'Sold!A1:A1', [['Sold']]);
        await sheetsUpdate(sheetId, 'Sold!A2:T2', [SOLD_HEADERS]);
      }
      if (!existingTabs.includes('For Sale')) {
        await sheetsUpdate(sheetId, 'For Sale!A1:A1', [['For Sale']]);
        await sheetsUpdate(sheetId, 'For Sale!A2:J2', [FOR_SALE_HEADERS]);
      }
      if (!existingTabs.includes('Want-Upgrade List')) {
        await sheetsUpdate(sheetId, 'Want-Upgrade List!A1:A1', [['Want-Upgrade List']]);
        await sheetsUpdate(sheetId, 'Want-Upgrade List!A2:I2', [WISHLIST_HEADERS]);
      }
      console.log('[Setup] Created missing tabs:', toCreate.map(t => t.addSheet.properties.title).join(', '));
    }

    // v0.9.989 (unified inventory Phase 1): header check is schema-driven.
    // The old hardcoded A2:AF2 (32 cols) meant: read 32 headers, compare all
    // 35 → always "wrong" → try to write 35 into 32 cells → silent 400 error
    // on every login. Header repair had been failing quietly since the schema
    // passed 32 columns.
    const _pdEndHdr = _pdColLetter(PERSONAL_HEADERS.length);

    // v0.9.1326 (MEASURED): these five header reads used to be five serial
    // `await sheetsGet` calls, and this whole function is awaited BEFORE the
    // collection itself is fetched — so a signed-in start spent roughly
    // 2.4-2.8s at a 400ms RTT doing nothing but verifying column captions
    // before the user saw a single item. One batchGet asks for all five ranges
    // in a single request. sheetsBatchGet already exists and is already used
    // this way for master data (7 ranges in one call).
    //
    // The repair logic below is UNCHANGED — same comparisons, same writes, same
    // per-tab try/catch. Only the reads were merged. Deliberately NOT also
    // un-blocking this from the collection load: a header repair racing the
    // data read is a different and riskier change, and this alone removes most
    // of the wait.
    const _R_PD = PERSONAL_TAB + '!A2:' + _pdEndHdr + '2';
    const _R_TITLE = PERSONAL_TAB + '!A1';
    const _R_WU = 'Want-Upgrade List!A2:I2';
    const _R_SOLD = 'Sold!A2:T2';
    const _R_FS = 'For Sale!A2:J2';
    var _hdrVals = {};
    try {
      const _bg = await sheetsBatchGet(sheetId, [_R_PD, _R_TITLE, _R_WU, _R_SOLD, _R_FS]);
      // batchGet answers in the order asked, so index by position rather than
      // by the returned range string (Sheets normalises quoting on tab names
      // with spaces, and matching on that text has bitten this project before).
      [_R_PD, _R_TITLE, _R_WU, _R_SOLD, _R_FS].forEach(function (rg, i) {
        var vr = (_bg && _bg.valueRanges && _bg.valueRanges[i]) || {};
        _hdrVals[rg] = (vr.values && vr.values[0]) || [];
      });
    } catch (eBG) {
      // One failed read used to skip only its own tab's check; keep that shape
      // by leaving every slot empty-but-defined. An empty slot reads as
      // "headers wrong" and triggers a repair write, which is idempotent and
      // is exactly what the old code did with an empty response.
      console.warn('[Headers] batched header read failed:', eBG && eBG.message);
      return;   // nothing read = nothing to compare; next sign-in retries
    }
    const current = _hdrVals[_R_PD];

    // Check each expected header — write the full row if anything is missing or wrong
    const needsUpdate = PERSONAL_HEADERS.some((h, i) => current[i] !== h);
    if (needsUpdate) {
      await sheetsUpdate(sheetId, PERSONAL_TAB + '!A2:' + _pdEndHdr + '2', [PERSONAL_HEADERS]);
      console.log('[Headers] My Collection headers repaired');
    }

    // Also ensure row 1 title
    const title = _hdrVals[_R_TITLE][0] || '';
    if (title !== 'My Collection') {
      await sheetsUpdate(sheetId, PERSONAL_TAB + '!A1', [['My Collection']]);
    }

    // Repair Want-Upgrade List headers if missing or wrong (combined tab, Session 161+).
    try {
      const wuCurrent = _hdrVals[_R_WU];
      const wuNeedsUpdate = WISHLIST_HEADERS.some((h, i) => wuCurrent[i] !== h);
      if (wuNeedsUpdate) {
        await sheetsUpdate(sheetId, 'Want-Upgrade List!A1:A1', [['Want-Upgrade List']]);
        await sheetsUpdate(sheetId, 'Want-Upgrade List!A2:I2', [WISHLIST_HEADERS]);
        console.log('[Headers] Want-Upgrade List headers repaired');
      }
    } catch(e) {
      console.warn('[Headers] Want-Upgrade List header check failed:', e.message);
    }

    // Repair Sold / For Sale / Want List headers (Manufacturer column added — new users ok,
    // older users need this to pick up the schema change without data loss).
    var _tabsToCheck = [
      { name: 'Sold',      range: 'Sold!A2:T2',      headers: SOLD_HEADERS     },
      { name: 'For Sale',  range: 'For Sale!A2:J2',  headers: FOR_SALE_HEADERS },

    ];
    for (var _i = 0; _i < _tabsToCheck.length; _i++) {
      var _t = _tabsToCheck[_i];
      try {
        var _cur = _hdrVals[_t.range] || [];
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
  //
  // v0.9.1325 (MEASURED): these 16 header stamps were serial `await`s, so a
  // signed-in start paid 16 round trips of pure latency — about 6.4s at a
  // 400ms RTT, which is what a phone in a train room actually looks like.
  // They write to 16 DIFFERENT ranges and none reads another's result, so
  // there was never a reason to queue them. Running them together turns 16
  // waits into one. 16 concurrent writes is well inside Google's 60/minute.
  //
  // NOT changed, on purpose: these still run on EVERY start rather than only
  // when a tab is missing. They double as a stale-header repair (see the clear
  // above), so skipping them when the tab exists would quietly retire that
  // repair — a real trade, and Brad's to make, not one to slip into a perf
  // pass. Flagged in the morning report.
  await Promise.all([
    sheetsUpdate(sheetId, 'Catalogs!A1:Q1',    [['Catalogs','','','','','','','','','','','','','','','','']]),
    sheetsUpdate(sheetId, 'Catalogs!A2:J2',    [CATALOG_HEADERS]),
    sheetsUpdate(sheetId, 'Paper Items!A1:Q1', [['Paper Items','','','','','','','','','','','','','','','','']]),
    sheetsUpdate(sheetId, 'Paper Items!A2:N2', [EPHEMERA_HEADERS]),
    sheetsUpdate(sheetId, 'Mock-Ups!A1:Q1',    [['Mock-Ups','','','','','','','','','','','','','','','','']]),
    sheetsUpdate(sheetId, 'Mock-Ups!A2:Q2',    [MOCKUP_HEADERS]),
    sheetsUpdate(sheetId, 'Other Lionel!A1:Q1',[['Other Lionel','','','','','','','','','','','','','','','','']]),
    sheetsUpdate(sheetId, 'Other Lionel!A2:N2',[EPHEMERA_HEADERS]),
  ]);
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
  // v0.9.1325: the run-once flag MOVED HERE, from the middle of the function.
  //
  // It used to be set right after the first four tabs, with ~30 lines of
  // awaited writes still to come. sheetsUpdate throws on failure (including
  // synchronously when offline or read-only), and the startup caller swallows
  // it — app-data.js: `ensureEphemeraSheets(...).catch(() => {})`. So one
  // transient Sheets hiccup at sign-in left the Instruction Sheets / Science
  // Sets / Construction Sets / My Sets tabs uncreated AND the flag set, so the
  // two callers that await this before appending (wizard-save.js) returned
  // instantly from the guard and their append then failed. Result: "Error
  // saving your item" every time the user added a science set or an
  // instruction sheet, for the whole session — cured by a reload, which made
  // it look random.
  //
  // Set last, so a failure means "not done" and the next caller retries.
  _ensureEphemDone = true;
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
      // v0.9.984: give the tab enough columns for the FULL header schema. A
      // fresh sheet otherwise defaults to 26 columns, but the schema is 35 —
      // the header write then overflows the grid and new-user setup fails.
      sheets: [{ properties: { title: 'My Collection', gridProperties: { rowCount: 1000, columnCount: Math.max(40, (typeof PERSONAL_HEADERS !== 'undefined' ? PERSONAL_HEADERS.length : 40) + 3) } } }]
    })
  });
  const data = await res.json().catch(function () { return {}; });
  // v0.9.1151 (pre-beta audit, BLOCKER 2): there was no res.ok check here, so a
  // 403 / 429 / quota hiccup — and this path fires ~30 sequential Sheets writes
  // — stored the STRING "undefined" as the sheet id. The sign-in fallback then
  // treats that as a real sheet forever, so signing out and back in never
  // recreates it: the account is bricked and only clearing site data recovers,
  // which no beta tester will ever find. Fail loudly and store nothing instead.
  if (!res.ok || !data.spreadsheetId) {
    var _why = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
    console.error('[setup] sheet creation failed:', _why);
    throw new Error('Could not create your collection sheet (' + _why + '). Nothing was saved — please try signing in again.');
  }
  state.personalSheetId = data.spreadsheetId;
  localStorage.setItem('lv_personal_id', state.personalSheetId);

  // 3. Write headers and create all tabs
  await sheetsUpdate(state.personalSheetId, PERSONAL_TAB + '!A1:A1', [['My Collection']]);
  await sheetsUpdate(state.personalSheetId, PERSONAL_TAB + '!A2:' + _pdColLetter(PERSONAL_HEADERS.length) + '2', [PERSONAL_HEADERS]);
  await initPersonalSheet(state.personalSheetId);

  // 4. Move the sheet file into the vault folder
  try { await driveMoveSheetToVault(state.personalSheetId); } catch(e) { console.warn('Could not move sheet to vault:', e); }



  // 5. Write config to Drive so other devices can find this sheet
  // v0.9.1266 (R2): driveWriteConfig used to swallow every failure; it now
  // re-throws so callers can react. This one is a bare await in the middle of
  // creating a brand-new collection, and the sheet itself already exists and
  // is populated by this point — aborting here would leave the user with no
  // collection at all over a config file that the next successful load
  // rewrites anyway (app-data.js does it after every load). So: catch, name it
  // in the console, and carry on returning the sheet we just built.
  try {
    await driveWriteConfig({
      personalSheetId: state.personalSheetId,
      vaultId: driveCache.vaultId,
      photosId: driveCache.photosId,
      soldPhotosId: driveCache.soldPhotosId,
    });
  } catch (e) {
    console.warn('[Setup] Config write after sheet creation failed (non-fatal):', e);
  }

  return state.personalSheetId;
}

// ── LOAD DATA ───────────────────────────────────────────────────
// Load/save user-defined tab names
function loadUserDefinedTabs() {
  try {
    state.userDefinedTabs = JSON.parse(localStorage.getItem('lv_user_tabs') || '[]');
  } catch(e) { state.userDefinedTabs = []; }
}
// Audit NEW #9: cross-device backfill of userDefinedTabs from the sheet.
// localStorage only persists per-device, so a user signing in on a second
// browser sees no custom tabs until they recreate them. Walk the sheet tabs
// metadata, find any tab whose title doesn't match a known canonical tab,
// and add it as a user-defined tab. Idempotent — adds only new ones.
async function syncUserDefinedTabsFromSheet(sheetId) {
  if (!sheetId || !accessToken) return;
  try {
    const res = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '?fields=sheets.properties.title',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!res.ok) return;
    const meta = await res.json();
    const titles = ((meta.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean));
    // Canonical (non-user) tabs to filter out
    const canonical = new Set([
      'My Collection', 'Sold', 'For Sale', 'Want-Upgrade List',
      // Legacy names kept so users with un-migrated sheets still treat them as canonical:
      'Want List', 'Upgrade List',
      'Catalogs', 'Paper Items', 'Mock-Ups', 'Other Lionel',
      'Instruction Sheets', 'Science Sets', 'Construction Sets', 'My Sets',
      'Dashboard',
      // Standalone feature tabs that are NOT collection/ephemera tabs:
      'Parts Needed',
      'Contacts',   // v0.9.794: the rolodex leaked into My Collection as "Contactss"
    ]);
    // Prune any reserved tab that was wrongly captured as user-defined before
    // it was added to the canonical set above (e.g. 'Parts Needed').
    if (state.userDefinedTabs && state.userDefinedTabs.length) {
      const _before = state.userDefinedTabs.length;
      state.userDefinedTabs = state.userDefinedTabs.filter(t => !canonical.has(t.label));
      if (state.userDefinedTabs.length !== _before) {
        saveUserDefinedTabs();
        if (state.ephemeraData) { delete state.ephemeraData.parts_needed; delete state.ephemeraData.contacts; }
      }
    }
    // v0.9.1204 (structural audit #10): this function ADDED unknown tabs but
    // never removed vanished ones, so a tab renamed or deleted in the sheet
    // was probed forever — Brad's four retired "LEGACY - …" tabs threw
    // "Unable to parse range" on EVERY load, four console warnings a load,
    // for weeks. The title list we just fetched is the authority on what
    // exists; anything user-defined that is not in it is gone. Guarded on a
    // non-empty title list so a partial or failed metadata read can never
    // wipe a legitimate tab, and the tab's bucket goes with it.
    if (titles.length && state.userDefinedTabs && state.userDefinedTabs.length) {
      const _live = new Set(titles);
      const _stale = state.userDefinedTabs.filter(t => t && !_live.has(t.label));
      if (_stale.length) {
        state.userDefinedTabs = state.userDefinedTabs.filter(t => t && _live.has(t.label));
        _stale.forEach(t => { try { if (state.ephemeraData) delete state.ephemeraData[t.id]; } catch (e) {} });
        saveUserDefinedTabs();
        console.log('[UserTabs] pruned', _stale.length, 'tab(s) no longer in the sheet:', _stale.map(t => t.label).join(', '));
      }
    }
    const known = new Set((state.userDefinedTabs || []).map(t => t.label));
    let added = 0;
    titles.forEach(t => {
      if (canonical.has(t) || known.has(t)) return;
      // Treat unknown tabs as user-defined. id is slug-ified label.
      const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      state.userDefinedTabs = state.userDefinedTabs || [];
      state.userDefinedTabs.push({ id: id, label: t });
      added++;
    });
    if (added > 0) {
      saveUserDefinedTabs();
      console.log('[UserTabs] backfilled', added, 'tabs from sheet metadata');
    }
  } catch(e) {
    console.warn('[UserTabs sync failed]', e && e.message);
  }
}
if (typeof window !== 'undefined') window.syncUserDefinedTabsFromSheet = syncUserDefinedTabsFromSheet;
function saveUserDefinedTabs() {
  localStorage.setItem('lv_user_tabs', JSON.stringify(state.userDefinedTabs));
}

