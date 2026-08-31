// ═══════════════════════════════════════════════════════════════
// app-auth.js — Authentication: beta gate, OAuth, sign-in/out, tokens
//
// Extracted from app.js in Session 110 (App Split Round 2, Chunk 11).
//
// Exposes globals: tokenClient, accessToken, _BETA_CODE, _tokenIsInitial
//
// Sections:
//   1. Beta gate
//   2. OAuth + Google Identity (initGoogle, overlay helpers)
//   3. Token receipt + lifecycle (onTokenReceived, etc.)
//   4. Sign-out + account menu
//   5. JWT util (parseJwt)
// ═══════════════════════════════════════════════════════════════

// ── 1. Beta gate ──
// ── GOOGLE IDENTITY / AUTH ──────────────────────────────────────
var tokenClient;

// ── BETA GATE ──────────────────────────────────────────────────
const _BETA_CODE = 'BETA2026';

// ── v0.9.998 (Brad): granted-scope check ────────────────────────────────
// Google's granular-permissions consent screen shows the Drive checkbox
// UNCHECKED by default, and an app cannot pre-check it. Someone who clicks
// Continue without ticking it gets a token that can't create their
// collection sheet — previously that failed later, silently and confusingly.
//
// Google tells us which scopes were actually granted (the `scope` field on
// the token response / redirect hash). We record it and check it.
//
// FAILS OPEN BY DESIGN: we only block when Google explicitly tells us Drive
// was NOT granted. If the scope string is missing or unreadable for any
// reason, the user proceeds exactly as before. A permissions checker that
// locked out working users would be worse than the problem it solves.
function _rrNoteGrantedScopes(s) {
  if (typeof s === 'string' && s.trim()) window._rrGrantedScopes = s;
}
function _rrDriveScopeDenied() {
  var g = window._rrGrantedScopes;
  if (typeof g !== 'string' || !g.trim()) return false;  // unknown -> allow
  return g.indexOf('drive.file') === -1 && g.indexOf('auth/drive') === -1;
}

// Full-screen "one more step" panel, shown instead of dropping the user into
// an app that cannot save. Offers one button: run sign-in again, this time
// forcing Google to re-show the consent screen (prompt:'consent').
function _rrShowScopeNeededScreen() {
  console.warn('[Auth] Drive permission not granted. Granted scopes:', window._rrGrantedScopes);
  try { if (typeof hideLoading === 'function') hideLoading(); } catch (e) {}
  try { var _ov = document.getElementById('signin-loading-overlay'); if (_ov) _ov.remove(); } catch (e) {}
  try { var _app = document.getElementById('app'); if (_app) _app.classList.remove('active'); } catch (e) {}
  try { var _bg = document.getElementById('beta-gate'); if (_bg) _bg.style.display = 'none'; } catch (e) {}
  try { var _as = document.getElementById('auth-screen'); if (_as) _as.style.display = 'none'; } catch (e) {}

  var d = document.getElementById('rr-scope-needed');
  if (!d) {
    d = document.createElement('div');
    d.id = 'rr-scope-needed';
    document.body.appendChild(d);
  }
  d.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;'
    + 'justify-content:center;padding:1.5rem;background:var(--bg,#0d0d1a);'
    + 'color:var(--text,#eee);font-family:var(--font-body,sans-serif);overflow:auto';
  d.innerHTML =
    '<div style="max-width:420px;width:100%;text-align:center">' +
      '<img src="conductor.png" alt="" aria-hidden="true" style="height:110px;width:auto;display:block;margin:0 auto 0.75rem">' +
      '<div style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;color:var(--cream,#f8e8c0);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:0.4rem">One more step</div>' +
      '<p style="font-size:0.92rem;color:var(--text-mid,#bbb);line-height:1.6;margin-bottom:1.25rem">' +
        'Almost there — but the <strong style="color:var(--text,#eee)">Google Drive</strong> box on the permission screen wasn\'t ticked, ' +
        'so we can\'t create your collection sheet yet.' +
      '</p>' +
      '<div style="background:var(--surface,#161c34);border:1px solid var(--border,#2a3355);border-radius:12px;padding:1rem 1.1rem;text-align:left;margin-bottom:1.25rem">' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--cream,#f8e8c0);margin-bottom:0.4rem">Why we need it</div>' +
        '<p style="font-size:0.82rem;color:var(--text-mid,#bbb);line-height:1.6;margin:0">' +
          'Your collection lives in a Google Sheet in <strong style="color:var(--text,#eee)">your own Drive</strong> — we have to create that file for you. ' +
          'This permission only covers files this app makes. It can never see the rest of your Drive.' +
        '</p>' +
      '</div>' +
      '<button onclick="_rrRetryScopeConsent()" style="width:100%;padding:0.85rem;border:none;border-radius:8px;background:var(--accent,#f05008);color:#fff;font-family:var(--font-body,sans-serif);font-size:0.95rem;font-weight:600;cursor:pointer">' +
        'Try again — tick the Drive box' +
      '</button>' +
      '<p style="font-size:0.75rem;color:var(--text-dim,#8d7f5e);margin-top:1rem;line-height:1.5">' +
        'Still stuck? Email <a href="mailto:' + (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'support@therailroster.com') + '" style="color:var(--accent2,#d4a843);text-decoration:none">' + (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'support@therailroster.com') + '</a>.' +
      '</p>' +
    '</div>';
}

// Retry: drop the half-granted token and force Google to show consent again.
function _rrRetryScopeConsent() {
  try {
    accessToken = null;
    window._rrGrantedScopes = null;
    localStorage.removeItem('lv_token');
    localStorage.removeItem('lv_token_expiry');
    sessionStorage.removeItem('lv_signing_in');
  } catch (e) {}
  window._signInInFlight = false;
  var d = document.getElementById('rr-scope-needed');
  if (d) d.remove();
  _tokenIsInitial = true;
  try {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      window.location.href = _oauthRedirectUrl('consent');
    }
  } catch (e) {
    console.error('[Auth] retry consent failed:', e);
    if (typeof showToast === 'function') showToast('Could not reopen the Google window. Please reload and try again.', 4000, true);
  }
}
if (typeof window !== 'undefined') { window._rrRetryScopeConsent = _rrRetryScopeConsent; }

function _buildBetaGate() {
  var d = document.getElementById('beta-gate');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;background:var(--bg);text-align:center';
  // v0.9.997 (Brad): conductor artwork above the wordmark; tagline + blurb
  // come from config.js (BRAND_TAGLINE / BRAND_BLURB) so this screen and the
  // sign-in screen can never drift apart again. Copy is maker-neutral — the
  // app covers every era and every manufacturer, not just postwar Lionel.
  var _tag  = (typeof BRAND_TAGLINE === 'string') ? BRAND_TAGLINE : 'Model Train Collection Tracker';
  var _blb  = (typeof BRAND_BLURB === 'string') ? BRAND_BLURB
            : 'A web-based inventory tool for model train collectors.';
  var _mark = (typeof BRAND_WORDMARK_HTML === 'string') ? BRAND_WORDMARK_HTML
            : 'The <span style="color:var(--accent)">Rail</span> Roster';
  d.innerHTML =
    '<div style="max-width:420px;width:100%">' +
      '<img src="conductor.png" alt="" aria-hidden="true" style="height:clamp(96px,13vh,140px);width:auto;display:block;margin:0 auto 0.6rem">' +
      '<div style="font-family:var(--font-head);font-size:2.4rem;font-weight:700;color:var(--cream);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:0.5rem">' + _mark + '</div>' +
      '<div style="font-size:0.75rem;letter-spacing:0.22em;color:var(--text-dim);text-transform:uppercase;font-family:var(--font-head);font-weight:400;margin-bottom:1.5rem">' + _tag + '</div>' +
      '<div style="background:var(--accent);color:var(--on-accent);font-family:var(--font-head);font-size:0.85rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:0.5rem 1.25rem;border-radius:6px;display:inline-block;margin-bottom:1.5rem">Beta Testing In Progress</div>' +
      '<p style="font-size:0.9rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem">' + _blb + '</p>' +
      // v0.9.997: box-sizing set explicitly on the card/input/button. The
      // global reset in app.css never reaches the page (stray <style> on its
      // line 1), so width:100% + padding was pushing the invite-code input
      // and the Enter Beta button past the right edge of their own card.
      '<div style="box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem;text-align:left">' +
        '<label style="font-size:0.8rem;color:var(--text-mid);display:block;margin-bottom:0.5rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Enter Invite Code</label>' +
        '<input type="text" id="beta-code-input" placeholder="Enter your beta access code" autocomplete="off" spellcheck="false" style="box-sizing:border-box;width:100%;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.75rem" onkeydown="if(event.key===\'Enter\')_checkBetaCode()">' +
        '<div id="beta-error" style="display:none;font-size:0.8rem;color:var(--accent);margin-bottom:0.75rem">Invalid code. Please check with your invite contact.</div>' +
        '<button onclick="_checkBetaCode()" style="box-sizing:border-box;width:100%;padding:0.75rem;border:none;border-radius:8px;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseenter="this.style.background=\'#d84800\'" onmouseleave="this.style.background=\'var(--accent)\'">Enter Beta</button>' +
      '</div>' +
      '<p style="font-size:0.75rem;color:var(--text-dim);margin-top:1.25rem">Don\'t have a code? Contact <a href="mailto:' + ADMIN_EMAIL + '" style="color:var(--accent2);text-decoration:none">' + ADMIN_EMAIL + '</a> to request access.</p>' +
    '</div>';
}

function _checkBetaCode() {
  var input = document.getElementById('beta-code-input');
  var code = (input.value || '').trim().toUpperCase();
  if (code === _BETA_CODE) {
    localStorage.setItem('lv_beta_verified', '1');
    _showAppAfterBeta();
  } else {
    document.getElementById('beta-error').style.display = 'block';
    input.style.borderColor = 'var(--accent)';
    input.focus();
  }
}

function _showAppAfterBeta() {
  document.getElementById('beta-gate').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

function _isBetaVerified() {
  return localStorage.getItem('lv_beta_verified') === '1';
}


// ── 2. OAuth + Google Identity ──

// ── OAuth Redirect Flow (no popups) ────────────────────────────
function _oauthRedirectUrl(prompt) {
  var redir = window.location.origin + window.location.pathname;
  // Strip trailing slash to match Google OAuth config exactly
  redir = redir.replace(/\/+$/, '');
  return 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(redir) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(SCOPES) +
    '&prompt=' + (prompt || 'select_account') +
    '&include_granted_scopes=true';
}

function _checkOAuthRedirect() {
  // Check if we're returning from a Google OAuth redirect
  var hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;

  // Parse the token from the URL hash
  var params = {};
  hash.substring(1).split('&').forEach(function(pair) {
    var kv = pair.split('=');
    params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });

  if (params.access_token) {
    // Clean the hash from the URL so it doesn't linger
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // Store the token
    accessToken = params.access_token;
    _rrNoteGrantedScopes(params.scope);   // v0.9.998: what Google actually granted
    var expiresIn = parseInt(params.expires_in || '3600');
    localStorage.setItem('lv_token', accessToken);
    localStorage.setItem('lv_token_expiry', String(Date.now() + (expiresIn - 300) * 1000));
    return true;
  }
  return false;
}

// ── v0.9.995: incremental OAuth scopes ──────────────────────────────────
// The default sign-in is minimal (no red "unverified app" wall). Features
// that need more permission ask HERE at the moment of use. Google shows a
// small consent popup once; the returned token covers old + new scopes.
function _rrRequestExtraScope(extraScope, onDone) {
  try {
    var tc = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES + ' ' + extraScope,
      include_granted_scopes: true,
      callback: function (resp) {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          window.accessToken = accessToken;
          try {
            var _ei = parseInt(resp.expires_in || '3600');
            localStorage.setItem('lv_token', accessToken);
            localStorage.setItem('lv_token_expiry', String(Date.now() + (_ei - 300) * 1000));
          } catch (eP) {}
          if (onDone) onDone(true);
        } else if (onDone) onDone(false);
      },
    });
    tc.requestAccessToken({ prompt: '', login_hint: (state.user && state.user.email) || undefined });
  } catch (e) {
    console.warn('[Auth] extra-scope request failed:', e);
    if (onDone) onDone(false);
  }
}
// Google Photos picker (photo inbox + wizard slots)
function _ensurePhotosScope() {
  return new Promise(function (resolve) {
    if (window._rrPhotosScoped) return resolve(true);
    _rrRequestExtraScope(SCOPE_PHOTOS, function (ok) {
      if (ok) window._rrPhotosScoped = true;
      resolve(ok);
    });
  });
}
// Full Sheets access — admin-only master-sheet tools (and maintenance work)
function _ensureFullSheetsScope() {
  return new Promise(function (resolve) {
    if (window._rrSheetsScoped) return resolve(true);
    _rrRequestExtraScope(SCOPE_SHEETS_FULL, function (ok) {
      if (ok) window._rrSheetsScoped = true;
      resolve(ok);
    });
  });
}
if (typeof window !== 'undefined') {
  window._rrRequestExtraScope = _rrRequestExtraScope;
  window._ensurePhotosScope = _ensurePhotosScope;
  window._ensureFullSheetsScope = _ensureFullSheetsScope;
  window._rrElevate = _ensureFullSheetsScope;   // maintenance-session helper
}

function _finishRedirectSignIn() {
  // Fetch user info since we don't have it from a popup callback
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  })
  .then(function(r) { return r.json(); })
  .then(function(info) {
    state.user = { name: info.given_name || info.name || 'User', email: info.email };
    localStorage.setItem('lv_user', JSON.stringify(state.user));
    // Now run the normal post-token flow
    _tokenIsInitial = true;
    onTokenReceived({ access_token: accessToken });
  })
  .catch(function(e) {
    console.error('[Auth] Failed to fetch user info after redirect:', e);
    showToast('Sign-in failed. Please try again.', 3000, true);
  });
}


// v0.9.1287 — THE FIRST SCREEN, decided and painted from local evidence only.
//
// Why this exists: the app used to build its whole first screen inside
// window.onload, and window.onload waits for EVERY subresource on the page —
// including Google's font stylesheet and Google's sign-in script. Measured
// 2026-08-03 with the font server stalled 3s (a train-show connection): the
// first screen appeared at 3.2s. Nothing was on screen the whole time.
//
// This function is the part of start-up that needs NO network, NO Google
// script and NO token — only localStorage, sessionStorage and the URL. So it
// can run the moment the HTML is parsed. It is called TWICE: once early
// (_rrEarlyFirstScreen in app.js) and once from initGoogle() below. Every
// thing it does is idempotent — the three builders guard on their own
// dataset.built / .header checks, and setting the same display twice is free.
//
// It is deliberately the ONLY place the "which of the three screens" question
// is answered. Do not re-write this decision anywhere else: an early paint
// that disagreed with initGoogle() would flash the wrong screen at the user.
// Returns 'app' | 'auth' | 'signing-in' | 'gate' so initGoogle() can follow
// the same branch for the token work, which is the half that DOES need Google.
function _rrShowFirstScreen() {
  _buildBetaGate();
  _buildAuthScreen();
  // v0.9.1285: _buildSetupScreen() was built into the DOM on every load,
  // yet showSetup() — the only thing that would reveal it — had no caller.
  // A whole form built for nobody, every page load. Both removed.
  _buildAppShell();

  var gate = document.getElementById('beta-gate');
  var auth = document.getElementById('auth-screen');

  // Master ID is a build-time constant, so this needs nothing external.
  state.masterSheetId = MASTER_SHEET_ID;
  try { localStorage.setItem('lv_master_id', state.masterSheetId); } catch (e) {}

  var savedUser = null, savedPersonalId = null;
  try {
    savedUser = localStorage.getItem('lv_user');
    savedPersonalId = localStorage.getItem('lv_personal_id');
  } catch (e) {}

  if (savedUser) {
    // Returning user — skip beta gate, they already have access
    if (gate) gate.style.display = 'none';
    try { state.user = JSON.parse(savedUser); } catch (e) {}
    state.personalSheetId = savedPersonalId;
    showApp();
    showLoading();
    return 'app';
  }
  if (_isBetaVerified()) {
    // Beta code already entered — show auth screen
    if (gate) gate.style.display = 'none';
    // Bugfix 2026-04-14: if we're in the middle of an OAuth sign-in flow,
    // don't flash the auth screen behind the overlay. The overlay is already
    // shown by the window.onload handler that checks sessionStorage.
    var _midSignIn = false;
    try { _midSignIn = sessionStorage.getItem('lv_signing_in') === '1'; } catch (e) {}
    if (auth) auth.style.display = _midSignIn ? 'none' : 'flex';
    return _midSignIn ? 'signing-in' : 'auth';
  }
  // New user, no beta code — show the gate, hide auth
  if (auth) auth.style.display = 'none';
  if (gate) gate.style.display = 'flex';
  return 'gate';
}

// Is this page load a return trip from Google's OAuth redirect?
//
// This is the side-effect-free HALF of _checkOAuthRedirect()'s condition, and
// it exists so the early paint can ASK the question without ANSWERING it.
// _checkOAuthRedirect() rewrites the URL with history.replaceState and writes
// lv_token / lv_token_expiry — running that early would consume the token
// before initGoogle() ever sees it. So the early paint checks this instead,
// and when it is true it paints nothing at all and leaves the whole OAuth
// path to initGoogle(), exactly as today.
function _rrOAuthReturnPending() {
  try {
    var hash = window.location.hash;
    return !!hash && hash.indexOf('access_token') !== -1;
  } catch (e) { return false; }
}

function initGoogle() {
  _buildBetaGate();
  _buildAuthScreen();
  _buildAppShell();

  // Check if returning from OAuth redirect (GIS redirect mode)
  if (_checkOAuthRedirect()) {
    document.getElementById('beta-gate').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    showApp();
    showLoading();
    _finishRedirectSignIn();
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenReceived,
  });

  // Paint (or re-affirm) the first screen. On a normal load this already ran
  // at DOMContentLoaded and every line of it is a no-op the second time.
  var _firstScreen = _rrShowFirstScreen();

  if (_firstScreen === 'app') {
    // If we already have a valid token (restored from localStorage), use it directly
    var _restoredExpiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (accessToken && _restoredExpiry > Date.now() + 60 * 1000) {
      // Token is good for at least 1 more minute — load data now
      console.log('[Auth] Using restored token, skipping GIS popup');
      _tokenIsInitial = true;
      onTokenReceived({ access_token: accessToken });
      // Schedule a silent refresh for later
      if (window._tokenRefreshTimer) clearTimeout(window._tokenRefreshTimer);
      var _msLeft = _restoredExpiry - Date.now() - 5 * 60 * 1000;
      if (_msLeft < 60000) _msLeft = 60000;
      window._tokenRefreshTimer = setTimeout(function() {
        rrEnsureFreshToken('scheduled');       // v0.9.1540
      }, _msLeft);
    } else {
      // Token expired or missing — must request a new one via GIS
      const savedEmail = state.user?.email || '';
      tokenClient.requestAccessToken({ prompt: '', login_hint: savedEmail });
    }
  }
  // The 'auth', 'signing-in' and 'gate' cases need nothing further here —
  // _rrShowFirstScreen() already put the right screen on the display.
}

// v0.9.826 (TODO-003): view-only OFFLINE start. Returning user + saved
// snapshot → open the app on cached data with a banner; every write path is
// guarded elsewhere. When the connection returns, app-misc reloads the page
// into the normal signed-in flow. Uses the SAME loadAllData() pipeline as an
// online boot — the cache layers below it know to accept any-age caches.
function _enterOfflineMode() {
  var savedUser = null;
  try { savedUser = localStorage.getItem('lv_user'); } catch (e) {}
  var snap = null;
  try { snap = localStorage.getItem('lv_personal_cache'); } catch (e) {}
  if (!savedUser || !snap) {
    // First-time user or no snapshot — nothing useful to show offline.
    if (typeof _showOfflineBanner === 'function') _showOfflineBanner();
    return;
  }
  window._offlineMode = true;
  try { state.user = JSON.parse(savedUser); } catch (e) {}
  state.personalSheetId = localStorage.getItem('lv_personal_id');
  state.masterSheetId = MASTER_SHEET_ID;
  var _bg = document.getElementById('beta-gate');   if (_bg) _bg.style.display = 'none';
  var _as = document.getElementById('auth-screen'); if (_as) _as.style.display = 'none';
  showApp();
  showLoading();
  try { updateUserUI(); } catch (e) {}
  if (typeof _showOfflineBanner === 'function') _showOfflineBanner();
  console.warn('[Auth] OFFLINE MODE — booting from saved snapshot');
  loadAllData();
}
if (typeof window !== 'undefined') window._enterOfflineMode = _enterOfflineMode;

function handleSignIn() {
  // Use GIS popup flow — it caches consent so users only approve once
  // Popups work after user click (not blocked when triggered by button)
  // Bugfix 2026-04-14: cover the sign-in screen with a full overlay during
  // the OAuth round-trip so users don't see "Sign in to get started" again
  // after they pick their account. Persist the flag in sessionStorage too
  // so that if mobile Chrome reloads the page on OAuth return, we still
  // show the overlay during boot.
  if (window._signInInFlight) return; // ignore re-taps
  window._signInInFlight = true;
  try { sessionStorage.setItem('lv_signing_in', '1'); } catch(e) {}
  _showSignInLoadingOverlay();
  // Safety: if Google popup is cancelled/closed silently, restore screen after 45s
  if (window._signInSafetyTimer) clearTimeout(window._signInSafetyTimer);
  window._signInSafetyTimer = setTimeout(function() { _resetSignInButton(); }, 45000);
  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (e) {
    _resetSignInButton();
    if (typeof showToast === 'function') showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'sign-in') : 'Sign-in failed: ' + e.message, 4000, true);
  }
}

function _showSignInLoadingOverlay() {
  var existing = document.getElementById('signin-loading-overlay');
  if (existing) return;
  var ov = document.createElement('div');
  ov.id = 'signin-loading-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:var(--bg,#0d0d1a);z-index:99997;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text,#eee);font-family:var(--font-body,sans-serif);padding:1rem';
  ov.innerHTML =
    '<div style="text-align:center;max-width:340px">'
    +   '<div style="font-family:var(--font-head,sans-serif);font-size:1.6rem;font-weight:700;margin-bottom:1.5rem">'
    +     'THE <span style="color:var(--accent,#e04028)">RAIL</span> ROSTER'
    +   '</div>'
    +   '<div style="display:inline-block;width:44px;height:44px;border:3px solid rgba(255,255,255,0.15);border-top-color:var(--accent,#e04028);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:1.2rem"></div>'
    +   '<div style="font-size:1rem;color:var(--text,#eee);margin-bottom:0.4rem">Signing you in…</div>'
    +   '<div style="font-size:0.8rem;color:var(--text-dim,#888);line-height:1.5">If a Google popup appeared, finish picking your account.<br>This usually takes a few seconds.</div>'
    + '</div>';
  document.body.appendChild(ov);
}

function _resetSignInButton() {
  // Hide the loading overlay (sign-in failed or was cancelled)
  var ov = document.getElementById('signin-loading-overlay');
  if (ov) ov.remove();
  window._signInInFlight = false;
  try { sessionStorage.removeItem('lv_signing_in'); } catch(e) {}
  if (window._signInSafetyTimer) { clearTimeout(window._signInSafetyTimer); window._signInSafetyTimer = null; }
  // Re-enable the .btn-google button (legacy state from earlier inline-spinner version)
  var _btn = document.querySelector('.btn-google');
  if (_btn && _btn.dataset.signing === '1') {
    _btn.dataset.signing = '';
    _btn.disabled = false;
    _btn.style.opacity = '';
    _btn.style.cursor = '';
    if (_btn.dataset.origHtml) _btn.innerHTML = _btn.dataset.origHtml;
  }
}

// Hide the loading overlay once the app actually shows (token success path).
// Hooked separately because onTokenReceived already calls _resetSignInButton
// on the error branch; on success we want the overlay to persist visually
// through showApp() until the dashboard renders, then disappear.
function _hideSignInOverlayWhenAppReady() {
  var ov = document.getElementById('signin-loading-overlay');
  if (!ov) return;
  // Fade out so the transition feels smoother than a hard cut
  ov.style.transition = 'opacity 0.25s';
  ov.style.opacity = '0';
  setTimeout(function() { if (ov && ov.parentNode) ov.remove(); }, 280);
  window._signInInFlight = false;
  try { sessionStorage.removeItem('lv_signing_in'); } catch(e) {}
  if (window._signInSafetyTimer) { clearTimeout(window._signInSafetyTimer); window._signInSafetyTimer = null; }
}
window._hideSignInOverlayWhenAppReady = _hideSignInOverlayWhenAppReady;


// ── 3. Token receipt + lifecycle ──
// ── Welcome card / contextual hints (moved to app-misc.js — Session 110, Round 2 Chunk 10) ──
function onGoogleSignIn(response) {
  const payload = parseJwt(response.credential);
  state.user = { name: payload.given_name, email: payload.email, picture: payload.picture };
  localStorage.setItem('lv_user', JSON.stringify(state.user));
}

// ── v0.9.1620: the token keeper writes the FLIGHT RECORDER ──────────────
// Brad's reconnect/account-picker loop survived the phone-Chrome sign-in
// fix (S87 open item 2), so per that plan the keeper now writes its diary
// into rr_sync_log ('auth' lines): every renewal attempt with its reason,
// every Google answer with its error code, the gesture layer, the card,
// and the 6-second consent fallback. Instrumentation ONLY — behavior is
// byte-for-byte v1619 (§324 pins the requestAccessToken count to prove it).
// Guarded: write-outbox.js loads first, but odd worlds get a silent no-op.
function _rrAuthLog(m) { try { if (window.rrSyncLog) window.rrSyncLog('auth', m); } catch (e) {} }

var accessToken = null;

// Restore token from localStorage (survives mobile page suspension)
(function _restoreToken() {
  var saved = localStorage.getItem('lv_token');
  var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
  if (saved && expiry > Date.now()) {
    accessToken = saved;
    console.log('[Auth] Restored token from localStorage, expires in', Math.round((expiry - Date.now())/60000), 'min');
    _rrAuthLog('boot: token restored, ' + Math.round((expiry - Date.now())/60000) + ' min left');
  } else if (saved) {
    _rrAuthLog('boot: stored token expired');
  }
})();

// Track whether this is the first token receipt (triggers full load) or a background refresh (just updates token)
var _tokenIsInitial = true;

function onTokenReceived(resp) {
  // Bugfix 2026-04-14: only clear the sign-in overlay on ERROR path.
  // On SUCCESS path, leave the overlay up until showApp() runs — otherwise
  // the auth screen flashes for 2-3 seconds between token arrival and
  // dashboard render. showApp() calls _hideSignInOverlayWhenAppReady().
  if (resp.error) {
    try { _resetSignInButton(); } catch(e) {}
    console.error('Token error:', resp);
    _rrAuthLog('token error: ' + (resp.error || '?') + (resp.error_subtype ? '/' + resp.error_subtype : ''));
    // If silent token refresh failed, prompt user to sign in again
    if (resp.error === 'interaction_required' || resp.error === 'login_required') {
      // v0.9.1540 (Brad: "i don't want the user to have to sign out and sign
      // back in for a stupid token — they won't understand that"). This used
      // to throw the whole app back to the sign-in screen, which reads as
      // "you have been logged out" for what is really a one-hour token doing
      // exactly what Google designed it to do. If the app is already open and
      // showing data, keep it open: retry on their next click, and only ask
      // if that fails too.
      var _appOpen = document.getElementById('app');
      _rrTokenRenewing = false;
      if (_appOpen && _appOpen.classList.contains('active')) {
        _rrArmGestureRenew();
        return;
      }
      _tokenIsInitial = true;
      // Nothing on screen yet — the sign-in screen IS the right answer here.
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app').classList.remove('active');
    }
    return;
  }

  const isInitial = _tokenIsInitial;
  _tokenIsInitial = false; // all subsequent tokens are background refreshes
  _rrAuthLog('token ok (' + (isInitial ? 'initial' : 'refresh') + ')');

  _rrNoteGrantedScopes(resp && resp.scope);   // v0.9.998: what Google actually granted
  accessToken = resp.access_token;
  // Persist token + expiry so it survives mobile page suspension
  localStorage.setItem('lv_token', accessToken);
  localStorage.setItem('lv_token_expiry', String(Date.now() + 55 * 60 * 1000));

  // v0.9.1540: a live token means every fallback stands down.
  _rrTokenRenewing = false;
  _rrTokenGestureArmed = false;
  try {
    var _rb = document.getElementById('rr-reconnect-bar');
    if (_rb) _rb.remove();
  } catch (eRB) {}

  // Renew well before the hour is up, not at the last minute — the old timer
  // fired at 55 minutes, leaving five minutes to get it right if the quiet
  // path was blocked. 45 gives the click-retry room to work unnoticed.
  if (window._tokenRefreshTimer) clearTimeout(window._tokenRefreshTimer);
  window._tokenRefreshTimer = setTimeout(() => {
    rrEnsureFreshToken('scheduled');
  }, 45 * 60 * 1000);

  // Background refresh — just update the token, don't reload data
  if (!isInitial) {
    // v0.9.1540: unless the app has been sitting there with NOTHING, which is
    // what a dead token looks like on screen — Brad's empty Master Catalog.
    // Getting the token back has to bring the trains back with it, or he is
    // still looking at "No items match your filters" and none the wiser.
    try {
      var _empty = !state.masterData || !state.masterData.length;
      if (_empty && typeof loadAllData === 'function') {
        console.log('[Auth] token restored while the app had no data — reloading');
        loadAllData();
      }
    } catch (eRL) {}
    return;
  }

  // ── Initial sign-in / app startup path ──

  // v0.9.998: stop here if Google told us Drive access was NOT granted —
  // the user unticked (or never ticked) the granular-permissions checkbox.
  // Going further would create a session that silently cannot save.
  if (_rrDriveScopeDenied()) {
    _rrShowScopeNeededScreen();
    return;
  }

  // Fetch user info from Google if we don't have it yet
  if (!state.user) {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    })
    .then(r => r.json())
    .then(info => {
      state.user = { name: info.given_name || info.name || 'User', email: info.email };
      localStorage.setItem('lv_user', JSON.stringify(state.user));
      updateUserUI();
    }).catch(e => { console.warn('[Auth] User info fetch failed (non-fatal):', e); });
  } else {
    updateUserUI();
  }

  // Master sheet is hardcoded
  state.masterSheetId = MASTER_SHEET_ID;
  localStorage.setItem('lv_master_id', state.masterSheetId);

  // Always sync from Drive config to ensure correct sheet ID across devices
  driveReadConfig().then(async config => {
    if (config && config.personalSheetId) {
      // Always use Drive config as source of truth
      state.personalSheetId = config.personalSheetId;
      localStorage.setItem('lv_personal_id', config.personalSheetId);
      if (config.vaultId)      { driveCache.vaultId = config.vaultId;           localStorage.setItem('lv_vault_id', config.vaultId); }
      if (config.photosId)     { driveCache.photosId = config.photosId;         localStorage.setItem('lv_photos_id', config.photosId); }
      if (config.soldPhotosId) { driveCache.soldPhotosId = config.soldPhotosId; localStorage.setItem('lv_sold_photos_id', config.soldPhotosId); }
      loadAllData();
    } else {
      // Config file not found — try searching Drive by sheet name
      const foundId = await driveFindPersonalSheet();
      if (foundId) {
        state.personalSheetId = foundId;
        localStorage.setItem('lv_personal_id', foundId);
        // Write config so future loads are faster
        // v0.9.1266 (R2): this used to write {personalSheetId} on its own, and
        // driveWriteConfig replaced the whole file — so arriving here (which
        // happens whenever the config read fails, including a transient 403)
        // wiped the three photo-folder ids for every other device. Send what
        // we know, and let the merge keep the rest.
        driveWriteConfig(Object.assign({ personalSheetId: foundId }, driveKnownFolderIds()))
          .catch(e => console.warn('Config write after sheet search:', e));
        loadAllData();
        return;
      }
      // No config and no sheet found — check localStorage before creating anything new
      state.personalSheetId = localStorage.getItem('lv_personal_id');
      if (!state.personalSheetId) {
        // No sheet found anywhere — create one for this new user
        createPersonalSheet().then(loadAllData).catch(e => {
          console.error('[Setup] createPersonalSheet failed:', e);
          showToast('Could not create your collection sheet. Please sign out and try again.', 4000, true);
          hideLoading();
        });
      } else {
        driveEnsureSetup().catch(e => console.warn('Drive setup:', e));
        loadAllData();
      }
    }
  }).catch(async () => {
    // Drive read failed — try searching by sheet name
    const foundId = await driveFindPersonalSheet();
    if (foundId) {
      state.personalSheetId = foundId;
      localStorage.setItem('lv_personal_id', foundId);
      // v0.9.1266 (R2) — same as the branch above. This one is reached after
      // driveReadConfig has already thrown, which is exactly when we know the
      // least and so exactly when a whole-file replace did the most damage.
      driveWriteConfig(Object.assign({ personalSheetId: foundId }, driveKnownFolderIds()))
        .catch(e => console.warn('Config write after sheet search:', e));
      loadAllData();
      return;
    }
    // Fall back to localStorage
    state.personalSheetId = localStorage.getItem('lv_personal_id');
    if (!state.personalSheetId) {
      // No sheet found anywhere — create one for this new user
      createPersonalSheet().then(loadAllData).catch(e => {
        console.error('[Setup] createPersonalSheet failed:', e);
        showToast('Could not create your collection sheet. Please sign out and try again.', 4000, true);
        hideLoading();
      });
    } else {
      loadAllData();
    }
  });
}

// Refresh token when page resumes from background (e.g. returning from camera on mobile)
// (Session 155: removed auto-lock on visibilitychange/beforeunload.
//  Structural protection is applied once per session by ensureSheetProtection,
//  scheduled from loadAllData, and can be re-applied from the "Protect key
//  columns" button in Preferences — no per-pause API noise.
//
//  v0.9.1269 (R10): this note used to say the same thing in the present tense
//  while neither the sign-in call nor the button existed. It was written in
//  Session 155 describing an intention, and read for twelve sessions as a
//  description of the code. Both now exist; that is the only reason this
//  sentence is allowed to stand.)

// ── v0.9.1540: the token keeper ─────────────────────────────────────────
// Brad, when his second account showed an empty Master Catalog: "we don't
// ever need a token to fail... i don't want the user to have to sign out and
// sign back in for a stupid token. they won't understand that."
//
// He is right, and the failure was ugly: Google access tokens last an hour,
// the quiet renewal needs an active Google session for THAT account in the
// browser, and when it cannot get one it falls back to a popup — which Chrome
// blocks, because no one clicked anything. Result: no token, every fetch
// returns nothing, and the app cheerfully renders "No items match your
// filters" over a collection of 3,370 items. A tester reads that as: the app
// lost my trains.
//
// Three layers, in order of how invisible they are:
//   1. RENEW EARLY — top up while the app is in use, long before expiry, and
//      whenever the tab is brought back to the front.
//   2. RENEW ON THE NEXT CLICK — if the quiet renewal is blocked, wait for the
//      user's next click or keypress and retry then. A click is exactly the
//      gesture the browser wanted, so the popup is allowed and usually never
//      appears at all. The user does nothing and notices nothing.
//   3. ONLY THEN, ASK — a small banner with one Reconnect button. Never a
//      sign-out, never an empty collection pretending to be an empty
//      collection.
var _rrTokenRenewing = false;      // a request is in flight
var _rrTokenGestureArmed = false;  // waiting for the user's next click
var _RR_TOKEN_MARGIN_MS = 15 * 60 * 1000;   // renew when under 15 minutes left

function _rrTokenExpiry() {
  try { return parseInt(localStorage.getItem('lv_token_expiry') || '0'); } catch (e) { return 0; }
}
function _rrTokenHealthy() {
  return !!accessToken && _rrTokenExpiry() > Date.now() + _RR_TOKEN_MARGIN_MS;
}
// The only place that asks Google for a token outside of first sign-in.
function rrEnsureFreshToken(reason) {
  try {
    if (!state || !state.user) return;
    if (_rrTokenHealthy() || _rrTokenRenewing) return;
    _rrTokenRenewing = true;
    var hint = (state.user && state.user.email) || '';
    console.log('[Auth] renewing token (' + (reason || 'check') + ')');
    _rrAuthLog('renewing (' + (reason || 'check') + ')');
    tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
    // If nothing comes back, the quiet path was blocked. Do not nag — wait
    // for a click and try again then, when the browser will allow it.
    setTimeout(function () {
      if (_rrTokenRenewing && !_rrTokenHealthy()) {
        _rrTokenRenewing = false;
        _rrAuthLog('quiet renew silent after 6s');
        _rrArmGestureRenew();
      }
    }, 6000);
  } catch (e) {
    _rrTokenRenewing = false;
    console.warn('[Auth] renew failed:', e && e.message);
    _rrArmGestureRenew();
  }
}
// Layer 2. One-shot listeners; they remove themselves the moment they fire.
function _rrArmGestureRenew() {
  if (_rrTokenGestureArmed || _rrTokenHealthy()) return;
  _rrTokenGestureArmed = true;
  console.log('[Auth] quiet renewal blocked — will retry on your next click');
  _rrAuthLog('armed: retry on next tap');
  var go = function () {
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    _rrTokenGestureArmed = false;
    _rrAuthLog('tap retry: requesting token');
    try {
      _rrTokenRenewing = true;
      tokenClient.requestAccessToken({ prompt: '', login_hint: (state.user && state.user.email) || '' });
      setTimeout(function () {
        if (!_rrTokenHealthy()) { _rrTokenRenewing = false; _rrAuthLog('tap retry silent after 6s \u2192 card'); _rrShowReconnect(); }
      }, 6000);
    } catch (e) { _rrTokenRenewing = false; _rrAuthLog('tap retry threw: ' + (e && e.message)); _rrShowReconnect(); }
  };
  document.addEventListener('pointerdown', go, true);
  document.addEventListener('keydown', go, true);
  // A click may never come — someone reading a list. Give it a while, then ask.
  setTimeout(function () { if (!_rrTokenHealthy()) { _rrAuthLog('no tap for 90s \u2192 card'); _rrShowReconnect(); } }, 90000);
}
// Layer 3. Plain words, one button, and the app stays where it is.
function _rrShowReconnect() {
  try {
    if (_rrTokenHealthy()) return;
    if (document.getElementById('rr-reconnect-bar')) return;
    var appEl = document.getElementById('app');
    if (!appEl || !appEl.classList.contains('active')) return;   // never over sign-in
    var bar = document.createElement('div');
    bar.id = 'rr-reconnect-bar';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:100011;' +
      'display:flex;align-items:center;gap:0.7rem;padding:0.55rem 0.85rem;border-radius:10px;' +
      'background:var(--surface);border:1px solid var(--accent);font-family:var(--font-body);' +
      'font-size:0.83rem;color:var(--text);max-width:calc(100vw - 2rem)';
    bar.innerHTML =
      '<span>Google needs you to reconnect. <span style="color:var(--text-dim)">Nothing is lost \u2014 ' +
      'your collection is safe in your Google Sheet.</span></span>' +
      '<button type="button" onclick="rrReconnectNow()" style="border:none;border-radius:7px;padding:0.35rem 0.8rem;' +
        'background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.8rem;' +
        'font-weight:700;cursor:pointer;flex-shrink:0">Reconnect</button>';
    document.body.appendChild(bar);
    _rrAuthLog('reconnect card SHOWN');
  } catch (e) {}
}
// The button. A click IS the gesture, so this is the request that works.
function rrReconnectNow() {
  _rrAuthLog('Reconnect tapped: quiet request');
  var bar = document.getElementById('rr-reconnect-bar');
  if (bar) {
    var b = bar.querySelector('button');
    if (b) { b.disabled = true; b.textContent = 'Reconnecting\u2026'; }
  }
  try {
    _rrTokenRenewing = true;
    tokenClient.requestAccessToken({ prompt: '', login_hint: (state.user && state.user.email) || '' });
    setTimeout(function () {
      if (_rrTokenHealthy()) return;
      // Still nothing: ask Google to show the account chooser. Still not a
      // sign-out — the app and its data stay exactly where they are.
      _rrTokenRenewing = false;
      _rrAuthLog('6s CONSENT FALLBACK: forcing account chooser');
      try { tokenClient.requestAccessToken({ prompt: 'consent', login_hint: (state.user && state.user.email) || '' }); }
      catch (e2) {}
      var b2 = bar && bar.querySelector('button');
      if (b2) { b2.disabled = false; b2.textContent = 'Reconnect'; }
    }, 6000);
  } catch (e) {
    _rrTokenRenewing = false;
    _rrAuthLog('Reconnect threw: ' + (e && e.message));
    var b3 = bar && bar.querySelector('button');
    if (b3) { b3.disabled = false; b3.textContent = 'Reconnect'; }
  }
}
// Layer 1. A heartbeat while the app is open, cheap because it does nothing
// at all until the token is actually near its end.
if (typeof window !== 'undefined') {
  window.rrEnsureFreshToken = rrEnsureFreshToken;
  window.rrReconnectNow = rrReconnectNow;
  setInterval(function () { rrEnsureFreshToken('heartbeat'); }, 5 * 60 * 1000);
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && state.user) {
    var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    var savedToken = localStorage.getItem('lv_token');
    // Restore from localStorage if JS variable was lost (page suspension)
    if (!accessToken && savedToken && expiry > Date.now()) {
      accessToken = savedToken;
      console.log('[Auth] Restored token on resume');
    }
    // v0.9.1540: one owner for renewals — see the token keeper above. The old
    // code here fired a bare request and assumed it worked; when the browser
    // blocked it, nothing noticed and the app ran on with no token.
    rrEnsureFreshToken('resume');
  }
});

// v0.9.1270 (audit R11). This function used to name the things it cleared —
// nine keys — and then swap the auth screen back over the app. Both halves
// were wrong in the same way: they were lists of things to remember.
//
//   • The storage half missed ~35 account-scoped keys, because every new
//     feature had to remember to add itself here and thirty-five of them
//     did not. Among the survivors: both consent flags, the queue of unsent
//     edits (still aimed at the PREVIOUS account's sheet), lv_inv_hwm (so
//     the next account minted colliding inventory IDs), and rr_mk_header_v1
//     (a "this sheet is already migrated" flag, so the next account's sheet
//     never got its header). Now inverted: config.js names the handful that
//     SURVIVE and rrClearAccountStorage() removes everything else, so an
//     unclassified new key fails safe.
//
//   • The screen half was a DOM swap, not a reload, so every module-level
//     cache in the app stayed alive and signed-in. driveCache (drive.js:91)
//     kept the previous account's Drive folder ids and its _validated flag,
//     and driveEnsureSetup() short-circuits on that flag — so the next
//     account never re-discovered its folders and filed its photos into the
//     first account's. A reload cannot forget a cache; it does not have to
//     know they exist. That is why the twenty lines of state.* nulling that
//     used to live here are gone rather than kept "to be safe" — they
//     duplicated a guarantee the reload already makes, and a duplicated
//     guarantee is the one that drifts.
//
// Still deliberate: do NOT revoke the Google grant. Revoking forces the full
// consent screen on every single sign-in.
var _signOutRunning = false;

async function handleSignOut() {
  if (_signOutRunning) return;          // double-tap on the menu item
  _signOutRunning = true;
  try {
    // Unsent edits are about to be discarded — they belong to this account
    // and cannot be replayed against the next one. Ask before losing them.
    var pending = 0;
    try { pending = (typeof rrOutboxCount === 'function') ? rrOutboxCount() : 0; } catch (e) {}
    if (pending > 0 && typeof appConfirm === 'function') {
      var go = await appConfirm(
        'You have ' + pending + ' change' + (pending === 1 ? '' : 's') +
        " that hasn't saved to your sheet yet. Signing out will discard " +
        (pending === 1 ? 'it' : 'them') + '.',
        { title: 'Sign out anyway?', ok: 'Sign out', cancel: 'Stay signed in', danger: true }
      );
      if (!go) { _signOutRunning = false; return; }
    }
    var removed = rrClearAccountStorage();
    console.log('[Auth] Sign-out cleared ' + removed.length + ' stored key(s)');
  } catch (e) {
    // Never trap someone in a signed-in app because cleanup failed — but a
    // reload only signs out if the credentials actually went. Take those
    // three by name as a last resort, then reload regardless.
    console.warn('[Auth] Sign-out cleanup failed:', e);
    ['lv_token', 'lv_token_expiry', 'lv_user'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e2) {}
    });
  }
  location.reload();
}

function toggleAccountMenu() {
  var menu = document.getElementById('account-menu');
  if (!menu) return;
  var isOpen = menu.style.display !== 'none';
  if (isOpen) {
    menu.style.display = 'none';
    document.removeEventListener('click', _accountMenuOutsideClick);
    return;
  }
  // Populate name/email/avatar each time it opens so it's always fresh
  var u = state.user || {};
  var nameEl = document.getElementById('account-menu-name');
  var emailEl = document.getElementById('account-menu-email');
  var avatarEl = document.getElementById('account-menu-avatar');
  if (nameEl) nameEl.textContent = u.name || '';
  if (emailEl) emailEl.textContent = u.email || '';
  if (avatarEl) {
    if (u.picture) {
      avatarEl.innerHTML = '<img src="' + u.picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">';
    } else {
      avatarEl.textContent = (u.name || '?')[0].toUpperCase();
    }
  }
  menu.style.display = 'block';
  // Close when clicking outside — defer so this click doesn't immediately close it
  setTimeout(function() {
    document.addEventListener('click', _accountMenuOutsideClick);
  }, 0);
}

function _accountMenuOutsideClick(e) {
  var chip = document.getElementById('user-chip');
  var menu = document.getElementById('account-menu');
  if (menu && chip && !chip.contains(e.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', _accountMenuOutsideClick);
  }
}

// ── 5. JWT util ──

// ── UTILITIES ───────────────────────────────────────────────────
function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(base64));
}
