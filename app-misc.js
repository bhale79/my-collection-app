// ═══════════════════════════════════════════════════════════════
// app-misc.js — Miscellaneous UI helpers
//
// Extracted from app.js in Session 110 (App Split Round 2, Chunk 10).
// Loaded after app.js. All functions are called only via event
// handlers, contextual prompts, or the prefs page, so load order
// is not strict.
//
// Includes:
//   - showWelcomeCard / maybeShowContextualHint / resetContextualHints
//     — first-run welcome card and tap-target tips
//   - _showIOSInstallHint — iOS-specific "Add to Home Screen" prompt
//   - _showOfflineBanner / _hideOfflineBanner — offline status banner
//   - bottom of file: window listeners for online/offline + delayed
//     iOS install hint trigger
//
// Globals used (defined elsewhere):
//   - state, showToast, _prefGet (app.js / wizard-utils.js)
// ═══════════════════════════════════════════════════════════════

const WELCOME_SEEN_KEY = 'lv_welcome_seen';
const HINT_PREFIX = 'lv_hint_';

function showWelcomeCard(force) {
  if (!force && localStorage.getItem(WELCOME_SEEN_KEY) === '1') return;
  const existing = document.getElementById('rr-welcome-card');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'rr-welcome-card';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
  ov.innerHTML =
    '<div style="background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;max-width:480px;width:100%;padding:20px 22px 18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif);max-height:calc(100vh - 36px);overflow-y:auto;-webkit-overflow-scrolling:touch;margin:auto 0;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
    + '<div style="text-align:center;margin-bottom:8px;font-size:1.4rem">🚂</div>'
    + '<div style="font-family:var(--font-head,sans-serif);font-size:1.35rem;text-align:center;font-weight:700;margin-bottom:4px">Welcome to <span style="color:var(--accent,#e04028)">The Rail Roster</span></div>'
    + '<div style="text-align:center;font-size:0.8rem;color:var(--text-dim,#888);margin-bottom:14px;letter-spacing:0.04em">Your Lionel collection, organized.</div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid,#bbb);line-height:1.55;margin-bottom:14px">Three things to know:</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">📷</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Add fast.</strong> Tap <em>Add to Collection</em>, then either type the item number or scan the box barcode (modern items only). The catalog fills in everything we know.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">📋</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Organize.</strong> Use the lists in the side menu — Collection, Want List, For Sale, Sold, Upgrade — to track every item through its lifecycle.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">💾</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Your data, your control.</strong> Everything saves to your own Google Sheet &amp; Drive. Open them anytime from Preferences → Account.</div>'
    + '</div>'

    + '<div style="font-size:0.78rem;color:var(--text-dim,#888);line-height:1.5;margin-bottom:14px;text-align:center">Need this again? Preferences → Help &amp; Tips → Show Welcome Tour.</div>'

    + '<div style="display:flex;justify-content:center">'
    +   '<button id="rr-welcome-go" style="padding:0.7rem 1.6rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;font-family:inherit;font-size:0.95rem;cursor:pointer">Got it — let\'s go</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);
  ov.querySelector('#rr-welcome-go').onclick = function() {
    localStorage.setItem(WELCOME_SEEN_KEY, '1');
    ov.remove();
  };
}
window.showWelcomeCard = showWelcomeCard;

function maybeShowContextualHint(spotId, message, anchorEl) {
  if (!spotId || !message) return;
  if (localStorage.getItem(HINT_PREFIX + spotId) === '1') return;
  if (!anchorEl) return;
  // Avoid duplicates if the page re-renders
  const existingHint = anchorEl.querySelector(':scope > .rr-ctx-hint[data-hint-id="' + spotId + '"]');
  if (existingHint) return;
  const hint = document.createElement('div');
  hint.className = 'rr-ctx-hint';
  hint.dataset.hintId = spotId;
  hint.style.cssText = 'background:rgba(232,64,28,0.1);border:1px solid var(--accent,#e04028);border-radius:10px;padding:10px 12px;margin:0 0 12px;display:flex;align-items:flex-start;gap:10px;font-size:0.85rem;color:var(--text-mid,#bbb);line-height:1.5';
  hint.innerHTML =
    '<div style="font-size:1.1rem;flex-shrink:0;color:var(--accent,#e04028)">💡</div>'
    + '<div style="flex:1">' + message + '</div>'
    + '<button onclick="(function(b){localStorage.setItem(\'' + HINT_PREFIX + spotId + '\',\'1\');b.closest(\'.rr-ctx-hint\').remove();})(this)" style="background:none;border:none;color:var(--text-dim,#888);font-size:1.1rem;cursor:pointer;padding:0 0.2rem;line-height:1;flex-shrink:0" title="Got it, hide this">×</button>';
  anchorEl.insertBefore(hint, anchorEl.firstChild);
}
window.maybeShowContextualHint = maybeShowContextualHint;

function resetContextualHints() {
  // Clear every hint dismissal flag
  Object.keys(localStorage).forEach(function(k) {
    if (k.startsWith(HINT_PREFIX)) localStorage.removeItem(k);
  });
}
window.resetContextualHints = resetContextualHints;


// ── iOS install hint + offline banner ──
function _showIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('lv_ios_hint_dismissed');
  if (!isIOS || isStandalone || dismissed) return;

  const banner = document.createElement('div');
  banner.id = 'ios-install-hint';
  banner.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:calc(100% - 2rem)',
    'max-width:380px',
    'background:#1c2544',
    'border:1.5px solid var(--border)',
    'border-radius:12px',
    'padding:0.8rem 1rem',
    'z-index:8000',
    'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
    'display:flex',
    'align-items:center',
    'gap:0.75rem',
    'animation:fadeIn 0.3s ease'
  ].join(';');

  banner.innerHTML = `
    <div style="font-size:1.4rem;flex-shrink:0">📲</div>
    <div style="flex:1;font-family:var(--font-body);font-size:0.8rem;color:var(--text);line-height:1.4">
      <strong style="color:var(--gold)">Install The Rail Roster</strong><br>
      Tap <strong>Share</strong> <span style="font-size:1rem">⎙</span> then <strong>Add to Home Screen</strong> for the best experience.
    </div>
    <button onclick="localStorage.setItem('lv_ios_hint_dismissed','1');document.getElementById('ios-install-hint').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.2rem;cursor:pointer;flex-shrink:0;padding:0;line-height:1">✕</button>
  `;

  document.body.appendChild(banner);

  // Auto-dismiss after 12 seconds
  setTimeout(() => {
    const el = document.getElementById('ios-install-hint');
    if (el) {
      el.style.transition = 'opacity 0.5s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }
  }, 12000);
}

// ── OFFLINE / ONLINE BANNER ─────────────────────────────────────
function _showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:9998',
    'background:#7f1d1d',
    'color:#fecaca',
    'text-align:center',
    'padding:0.5rem 1rem',
    'font-family:var(--font-body)',
    'font-size:0.82rem',
    'font-weight:600',
    'letter-spacing:0.02em',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
  ].join(';');
  banner.textContent = '⚠ No internet connection — changes may not save until you reconnect';
  document.body.appendChild(banner);
}

function _hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.transition = 'opacity 0.4s ease';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 400);
    showToast('✓ Back online', 2500);
  }
}

window.addEventListener('offline', _showOfflineBanner);
window.addEventListener('online', _hideOfflineBanner);

// Check on load in case they open the app already offline
if (!navigator.onLine) _showOfflineBanner();

// Trigger iOS install hint after a short delay (so app has rendered)
setTimeout(_showIOSInstallHint, 2500);
