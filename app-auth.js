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

function _buildBetaGate() {
  var d = document.getElementById('beta-gate');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;background:var(--bg);text-align:center';
  d.innerHTML =
    '<div style="max-width:420px;width:100%">' +
      '<div style="font-family:var(--font-head);font-size:2.4rem;font-weight:700;color:var(--cream);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:0.5rem">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
      '<div style="font-size:0.75rem;letter-spacing:0.22em;color:var(--text-dim);text-transform:uppercase;font-family:var(--font-head);font-weight:400;margin-bottom:1.5rem">Postwar Collector\'s Inventory</div>' +
      '<div style="background:var(--accent);color:#fff;font-family:var(--font-head);font-size:0.85rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:0.5rem 1.25rem;border-radius:6px;display:inline-block;margin-bottom:1.5rem">Beta Testing In Progress</div>' +
      '<p style="font-size:0.9rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem">A web-based inventory tool built for serious Lionel train collectors. Track every item, variation, and box in your collection — from postwar classics to modern production.</p>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;text-align:left">' +
        '<label style="font-size:0.8rem;color:var(--text-mid);display:block;margin-bottom:0.5rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Enter Invite Code</label>' +
        '<input type="text" id="beta-code-input" placeholder="Enter your beta access code" autocomplete="off" spellcheck="false" style="width:100%;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.75rem" onkeydown="if(event.key===\'Enter\')_checkBetaCode()">' +
        '<div id="beta-error" style="display:none;font-size:0.8rem;color:var(--accent);margin-bottom:0.75rem">Invalid code. Please check with your invite contact.</div>' +
        '<button onclick="_checkBetaCode()" style="width:100%;padding:0.75rem;border:none;border-radius:8px;background:var(--accent);color:#fff;font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseenter="this.style.background=\'#d84800\'" onmouseleave="this.style.background=\'var(--accent)\'">Enter Beta</button>' +
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
    var expiresIn = parseInt(params.expires_in || '3600');
    localStorage.setItem('lv_token', accessToken);
    localStorage.setItem('lv_token_expiry', String(Date.now() + (expiresIn - 300) * 1000));
    return true;
  }
  return false;
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


function initGoogle() {
  _buildBetaGate();
  _buildAuthScreen();
  _buildSetupScreen();
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

  // Check for existing session — master ID is hardcoded, just need saved user
  const savedUser = localStorage.getItem('lv_user');
  const savedPersonalId = localStorage.getItem('lv_personal_id');
  state.masterSheetId = MASTER_SHEET_ID;
  localStorage.setItem('lv_master_id', state.masterSheetId);

  if (savedUser) {
    // Returning user — skip beta gate, they already have access
    document.getElementById('beta-gate').style.display = 'none';
    state.user = JSON.parse(savedUser);
    state.personalSheetId = savedPersonalId;
    showApp();
    showLoading();
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
        if (accessToken) {
          var hint = state.user?.email || '';
          tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
        }
      }, _msLeft);
    } else {
      // Token expired or missing — must request a new one via GIS
      const savedEmail = state.user?.email || '';
      tokenClient.requestAccessToken({ prompt: '', login_hint: savedEmail });
    }
  } else if (_isBetaVerified()) {
    // Beta code already entered — show auth screen
    document.getElementById('beta-gate').style.display = 'none';
    // Bugfix 2026-04-14: if we're in the middle of an OAuth sign-in flow,
    // don't flash the auth screen behind the overlay. The overlay is already
    // shown by the window.onload handler that checks sessionStorage.
    var _midSignIn = false;
    try { _midSignIn = sessionStorage.getItem('lv_signing_in') === '1'; } catch(e) {}
    document.getElementById('auth-screen').style.display = _midSignIn ? 'none' : 'flex';
  } else {
    // New user, no beta code — show the gate, hide auth
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('beta-gate').style.display = 'flex';
  }
}

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
    if (typeof showToast === 'function') showToast('Sign-in failed: ' + e.message, 4000, true);
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

var accessToken = null;

// Restore token from localStorage (survives mobile page suspension)
(function _restoreToken() {
  var saved = localStorage.getItem('lv_token');
  var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
  if (saved && expiry > Date.now()) {
    accessToken = saved;
    console.log('[Auth] Restored token from localStorage, expires in', Math.round((expiry - Date.now())/60000), 'min');
  }
})();

// Track whether this is the first token receipt (triggers full load) or a background refresh (just updates token)
let _tokenIsInitial = true;

function onTokenReceived(resp) {
  // Bugfix 2026-04-14: only clear the sign-in overlay on ERROR path.
  // On SUCCESS path, leave the overlay up until showApp() runs — otherwise
  // the auth screen flashes for 2-3 seconds between token arrival and
  // dashboard render. showApp() calls _hideSignInOverlayWhenAppReady().
  if (resp.error) {
    try { _resetSignInButton(); } catch(e) {}
    console.error('Token error:', resp);
    // If silent token refresh failed, prompt user to sign in again
    if (resp.error === 'interaction_required' || resp.error === 'login_required') {
      _tokenIsInitial = true;
      // Show the sign-in screen so user can click the button (avoids popup blocker)
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app').classList.remove('active');
    }
    return;
  }

  const isInitial = _tokenIsInitial;
  _tokenIsInitial = false; // all subsequent tokens are background refreshes

  accessToken = resp.access_token;
  // Persist token + expiry so it survives mobile page suspension
  localStorage.setItem('lv_token', accessToken);
  localStorage.setItem('lv_token_expiry', String(Date.now() + 55 * 60 * 1000));

  // Schedule next silent refresh 55 min from now (tokens last 1 hour)
  if (window._tokenRefreshTimer) clearTimeout(window._tokenRefreshTimer);
  window._tokenRefreshTimer = setTimeout(() => {
    if (accessToken) {
      const hint = state.user?.email || '';
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
    }
  }, 55 * 60 * 1000);

  // Background refresh — just update the token, don't reload data
  if (!isInitial) {
    return;
  }

  // ── Initial sign-in / app startup path ──

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
        driveWriteConfig({ personalSheetId: foundId }).catch(() => {});
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
      driveWriteConfig({ personalSheetId: foundId }).catch(() => {});
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
// ── Auto-lock sheet when app is closed ────────────────────────
function _autoLockOnClose() {
  if (!state.personalSheetId || typeof lockSheetTabs !== 'function') return;
  // Use sendBeacon-style fire-and-forget — best effort on close
  lockSheetTabs(state.personalSheetId).catch(() => {});
}
window.addEventListener('beforeunload', _autoLockOnClose);
document.addEventListener('pagehide', _autoLockOnClose);

document.addEventListener('visibilitychange', function() {
  // Auto-lock sheet when app is hidden/closed
  if (document.visibilityState === 'hidden' && state.personalSheetId) {
    if (typeof lockSheetTabs === 'function') {
      lockSheetTabs(state.personalSheetId).catch(() => {});
    }
  }
  if (document.visibilityState === 'visible' && state.user) {
    var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    var savedToken = localStorage.getItem('lv_token');
    // Restore from localStorage if JS variable was lost (page suspension)
    if (!accessToken && savedToken && expiry > Date.now()) {
      accessToken = savedToken;
      console.log('[Auth] Restored token on resume');
    }
    // If token is expired or about to expire (< 5 min), request fresh one
    if (!accessToken || expiry < Date.now() + 5 * 60 * 1000) {
      console.log('[Auth] Token expired or expiring, requesting refresh');
      try {
        var hint = state.user?.email || '';
        tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      } catch(e) { console.warn('[Auth] Silent refresh failed:', e); }
    }
  }
});

function handleSignOut() {
  // Clear local state only — do NOT revoke the Google grant
  // (revoking forces full consent screens on every sign-in)
  localStorage.removeItem('lv_user');
  localStorage.removeItem('lv_token');
  localStorage.removeItem('lv_token_expiry');
  state.user = null;
  _tokenIsInitial = true; // ensure next sign-in triggers full data load
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
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
