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
    + '<div style="text-align:center;font-size:0.8rem;color:var(--text-dim,#888);margin-bottom:14px;letter-spacing:0.04em">Your model train collection, organized.</div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid,#bbb);line-height:1.55;margin-bottom:14px">Three things to know:</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">📷</div>'
    // v0.9.1150 (beta punch list §7): this promised "snap a photo and let the
    // app identify it. The catalog fills in the rest." The in-flow wording is
    // already careful and honest about the reader being a helper that often
    // needs correcting — it was the ENTRY POINTS that set testers up to expect
    // magic and then feel let down. Typing the number is the reliable path and
    // is named first now; the photo reader is offered as the helper it is.
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Add fast.</strong> Tap <em>Add to Collection</em> and type the item number — the catalog fills in the rest. No number handy? Scan the box barcode (modern items only), or <strong style="color:var(--text,#eee)">let a photo suggest one</strong> — the photo reader is a helper, so check what it finds before you save.</div>'
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
    // v0.9.1000 (Brad): hand straight off to the photo-identification usage
    // card. Shown once, right after the welcome card, so the one part of the
    // app with a limit is explained before anyone bumps into it.
    try { if (typeof showAiUsageCard === 'function') showAiUsageCard(force); } catch (e) {}
  };
}
window.showWelcomeCard = showWelcomeCard;

// ── Photo-identification usage card (v0.9.1000, Brad) ────────────────────
// Numbers come from the relay (Code_v2.7): AI_DAILY_CAP_DEFAULT = 20 per
// device per day, refunded on failure, cache hits don't count, resets at
// midnight America/New_York. Premium devices get 100/day via the relay's
// `ai_premium_tokens` config — that's the "higher allowance" referred to
// below. If those relay values change, change this copy with them.
const AI_USAGE_SEEN_KEY = 'lv_ai_usage_seen';

function showAiUsageCard(force) {
  if (!force && localStorage.getItem(AI_USAGE_SEEN_KEY) === '1') return;
  const existing = document.getElementById('rr-ai-usage-card');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'rr-ai-usage-card';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
  const admin = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : 'support@therailroster.com';
  ov.innerHTML =
    '<div style="background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;max-width:480px;width:100%;padding:20px 22px 18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif);max-height:calc(100vh - 36px);overflow-y:auto;-webkit-overflow-scrolling:touch;margin:auto 0;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
    + '<div style="font-family:var(--font-head,sans-serif);font-size:1.25rem;text-align:center;font-weight:700;margin-bottom:4px">Scanning and photo ID</div>'
    + '<div style="text-align:center;font-size:0.8rem;color:var(--text-dim,#888);margin-bottom:14px;letter-spacing:0.04em">Scanning is free. Photo ID is the one part with a limit.</div>'

    + '<div style="font-size:0.88rem;color:var(--text-mid,#bbb);line-height:1.55;margin-bottom:14px">Most items go in without using anything up \u2014 here\'s the difference.</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Scanning is free and unlimited.</strong> Point the camera at a barcode or a printed label and the app reads it right on your own phone. Scan as much as you like \u2014 it never counts against anything.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Photo ID \u2014 20 a day.</strong> When there\'s no barcode and no label worth reading \u2014 an older piece, or one with no box \u2014 the app can work out what it is from a photo. That\'s a photo ID, and you get 20 a day. The count resets overnight, the same photo twice is free, and a failed one is given back.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Need more than 20 a day?</strong> Buying extra photo IDs is on the way. In the meantime email <a href="mailto:' + admin + '" style="color:var(--accent2,#d4a843);text-decoration:none">' + admin + '</a> and we\'ll sort you out.</div>'
    + '</div>'

    + '<div style="font-size:0.78rem;color:var(--text-dim,#888);line-height:1.5;margin-bottom:14px;text-align:center">Need this again? Preferences → Help &amp; Tips.</div>'

    + '<div style="display:flex;justify-content:center">'
    +   '<button id="rr-ai-usage-go" style="padding:0.7rem 1.6rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;font-family:inherit;font-size:0.95rem;cursor:pointer">Got it</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);
  ov.querySelector('#rr-ai-usage-go').onclick = function () {
    localStorage.setItem(AI_USAGE_SEEN_KEY, '1');
    ov.remove();
  };
}
window.showAiUsageCard = showAiUsageCard;

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
// v0.9.835 (Brad): real "Install the app" button. Chrome/Edge (Android +
// desktop) fire beforeinstallprompt — we stash it and trigger the browser's
// own install dialog from our menu item. iOS never fires it (Apple allows no
// programmatic install) — there the button shows the Safari 3-step hint.
// The menu item hides itself when the app is already running installed.
window._pwaPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window._pwaPrompt = e;
  var mi = document.getElementById('menu-install-app');
  if (mi && !_pwaIsInstalled()) mi.style.display = '';
});
function _pwaIsInstalled() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}
function _pwaInstall() {
  try { if (typeof toggleAccountMenu === 'function') toggleAccountMenu(); } catch (e) {}
  if (window._pwaPrompt) {
    var p = window._pwaPrompt;
    window._pwaPrompt = null;
    p.prompt();
    p.userChoice.then(function (r) {
      if (r && r.outcome === 'accepted') {
        if (typeof showToast === 'function') showToast('📲 Installing — look for the conductor on your home screen');
        var mi = document.getElementById('menu-install-app');
        if (mi) mi.style.display = 'none';
      }
    }).catch(function () {});
    return;
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    try { localStorage.removeItem('lv_ios_hint_dismissed'); } catch (e) {}
    var old = document.getElementById('ios-install-hint');
    if (old) old.remove();
    _showIOSInstallHint();
    return;
  }
  if (typeof showToast === 'function') showToast("Your browser didn't offer an install here — in Chrome use the \u22ee menu \u2192 Add to Home screen", 5000);
}
function _pwaMenuInit() {
  var mi = document.getElementById('menu-install-app');
  if (!mi) return;
  if (_pwaIsInstalled()) { mi.style.display = 'none'; return; }
  if (window._pwaPrompt || /iphone|ipad|ipod/i.test(navigator.userAgent)) mi.style.display = '';
}
if (typeof window !== 'undefined') { window._pwaInstall = _pwaInstall; window._pwaMenuInit = _pwaMenuInit; }
setTimeout(_pwaMenuInit, 3000);

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
  banner.textContent = window._offlineMode
    ? '📡 Offline — viewing your saved collection. Adding items needs a connection.'
    : '⚠ No internet connection — changes may not save until you reconnect';
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
// v0.9.826 (TODO-003): offline-view mode reconnect — reload into the normal
// signed-in flow once the connection is back.
window.addEventListener('online', function () {
  if (window._offlineMode) {
    if (typeof showToast === 'function') showToast('Back online — reconnecting…', 2500);
    setTimeout(function () { location.reload(); }, 1500);
  }
});
window.addEventListener('online', _hideOfflineBanner);

// Check on load in case they open the app already offline
if (!navigator.onLine) _showOfflineBanner();

// Trigger iOS install hint after a short delay (so app has rendered)
setTimeout(_showIOSInstallHint, 2500);
